"""Silver normalizer — writes canonical rows to fact/dim tables.

Week 2 Day 4 of Unified Data Layer v1 spec (§1.2 data flow).

Role in the pipeline
--------------------
Bronze emits `RawEvent`. Upstream, a field-resolution step (Week 4
wire-in via semantic_mapper + FieldRegistry) converts each RawEvent's
raw columns into a `CanonicalRow`. THIS module takes CanonicalRow and
performs all the writes:

  1. dim upserts: store, staff (if present), payment channels, discounts
  2. fact_pos_transaction insert (bill grain)
  3. combo_parser → fact_pos_item rows (with product_id dim upsert per item)
  4. fact_pos_payment rows (EAV)
  5. fact_pos_discount rows (EAV)

Everything for one row happens in one transaction — partial writes on
failure would corrupt bill totals, so atomic per-row is correct.

Idempotency
-----------
If the same (factory_id, source_type, store_id, source_bill_no) tuple
arrives twice, the second INSERT fails UniqueViolation and the caller
should log + skip — don't re-insert child rows. `write_row` returns
None on duplicate; a non-None transaction_id means the row is new.

Why not auto-resolve canonical_field here
-----------------------------------------
Separation of concerns: resolution (raw_column → canonical_field) is
FieldRegistry + semantic_mapper's job. This module takes the already-
resolved CanonicalRow and does the write-path. Keeps normalizer testable
without mocking LLMs or embedding services.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import date, datetime  # noqa: F401 — `date` re-exported for downstream usage
from decimal import Decimal
from typing import List, Optional, Tuple

import asyncpg

from smartbi.canonical.combo_parser import parse_combo
from smartbi.canonical.dim_resolver import DimResolver

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class CanonicalRow:
    """One POS bill as the normalizer expects it.

    Required fields (store_name, source_bill_no, date) match the fact_pos_
    transaction UNIQUE constraint. Everything else is optional — missing
    amounts become NULL, missing combo_string means zero items, missing
    payments/discounts mean zero EAV rows.
    """
    factory_id: str
    source_type: str          # "excel" | "meituan_api" | ...
    store_name: str
    source_bill_no: str
    date: date

    # Optional dimensions
    staff_name: Optional[str] = None

    # Optional bill metadata
    time: Optional[datetime] = None
    upload_id: Optional[int] = None
    table_no: Optional[str] = None
    order_type: Optional[str] = None
    channel_origin: Optional[str] = None
    customer_count: Optional[int] = None
    # meal_period (Task C4) — populates fact_pos_transaction.meal_period;
    # feeds materialize_daily_order_type_meal() Gold aggregation.
    meal_period: Optional[str] = None

    # Optional bill-level aggregates
    gross_amount: Optional[Decimal] = None
    discount_amount: Optional[Decimal] = None
    tax_amount: Optional[Decimal] = None
    net_amount: Optional[Decimal] = None
    actual_receive: Optional[Decimal] = None
    avg_per_capita: Optional[Decimal] = None

    # Combo / line items (raw combo string — parser output drives fact_pos_item)
    combo_string: Optional[str] = None

    # EAV sub-facts: payments = [(channel_name, amount)], discounts = [(name, amount, qty)]
    payments: Tuple[Tuple[str, Decimal], ...] = ()
    discounts: Tuple[Tuple[str, Decimal, int], ...] = ()


@dataclass(frozen=True)
class CostLine:
    """One cost entry — period-scoped by default (transaction_id=None).

    cost_type is one of 'material' / 'labor' / 'overhead' / 'other'.
    category_name is free-form ("食材-主料", "人工-正式员工", "租金"), will
    be upserted into dim_cost_category.

    Attach transaction_id when the cost is per-bill (rare; e.g. per-order
    COGS). For monthly rent or payroll, leave it None and set `date` to
    the period's first-of-month.
    """
    factory_id: str
    source_type: str
    cost_type: str
    category_name: str
    date: date
    amount: Decimal
    upload_id: Optional[int] = None
    transaction_id: Optional[int] = None
    is_fixed: bool = False
    note: Optional[str] = None


@dataclass
class NormalizeStats:
    """Running totals produced by `ingest_rows`."""
    transactions_written: int = 0
    items_written: int = 0
    items_unresolved: int = 0     # product_id=NULL (parser miss)
    payments_written: int = 0
    discounts_written: int = 0
    duplicates_skipped: int = 0
    cost_lines_written: int = 0


_TXN_INSERT_SQL = """
INSERT INTO fact_pos_transaction (
    factory_id, upload_id, source_type, source_bill_no, store_id, staff_id,
    date, time,
    gross_amount, discount_amount, tax_amount, net_amount, actual_receive,
    customer_count, avg_per_capita,
    table_no, order_type, channel_origin, meal_period,
    item_count, has_discount
)
VALUES (
    $1, $2, $3, $4, $5, $6,
    $7, $8,
    $9, $10, $11, $12, $13,
    $14, $15,
    $16, $17, $18, $19,
    $20, $21
)
ON CONFLICT (factory_id, source_type, store_id, source_bill_no) DO NOTHING
RETURNING id
"""


class SilverNormalizer:
    """One instance per upload/batch. Shares a DimResolver so dim lookups
    are cached across rows."""

    def __init__(self, pool: asyncpg.Pool, factory_id: str):
        if not factory_id:
            raise ValueError("factory_id required")
        self.pool = pool
        self.factory_id = factory_id
        self.dim = DimResolver(pool, factory_id)

    async def write_row(self, row: CanonicalRow) -> Optional[int]:
        """Write one CanonicalRow as a transaction + children.

        Returns the new transaction_id, or None if the bill already existed
        (ON CONFLICT DO NOTHING fired). Caller logs duplicates but shouldn't
        treat them as an error — re-uploading the same Excel is a real use
        case (customer re-submits after correction).
        """
        if row.factory_id != self.factory_id:
            raise ValueError(
                f"CanonicalRow factory_id {row.factory_id!r} doesn't match "
                f"normalizer's {self.factory_id!r}"
            )

        # 1. Resolve store + staff dims.
        store_id = await self.dim.resolve_store(row.store_name)
        staff_id: Optional[int] = None
        if row.staff_name:
            staff_id = await self.dim.resolve_staff(row.staff_name, store_id=store_id)

        # 2. Parse combo → item tuples (before INSERT, so we can populate
        #    item_count on the transaction row).
        items = parse_combo(row.combo_string)
        item_count = len(items)
        has_discount = bool(row.discounts) or (
            row.discount_amount is not None and row.discount_amount > 0
        )

        # 3. Insert transaction row (may hit ON CONFLICT DO NOTHING).
        async with self.pool.acquire() as conn:
            async with conn.transaction():
                txn_id = await conn.fetchval(
                    _TXN_INSERT_SQL,
                    row.factory_id, row.upload_id, row.source_type, row.source_bill_no,
                    store_id, staff_id,
                    row.date, row.time,
                    row.gross_amount, row.discount_amount, row.tax_amount,
                    row.net_amount, row.actual_receive,
                    row.customer_count, row.avg_per_capita,
                    row.table_no, row.order_type, row.channel_origin, row.meal_period,
                    item_count, has_discount,
                )
                if txn_id is None:
                    # Duplicate bill — child rows already exist from first run.
                    logger.info(
                        "skip duplicate bill factory=%s source=%s bill=%s",
                        row.factory_id, row.source_type, row.source_bill_no,
                    )
                    return None

                # 4. Write fact_pos_item rows (one per combo piece).
                for item in items:
                    product_id: Optional[int] = None
                    if item.parse_ok and item.name:
                        # For v1.1 normalized_name = name verbatim; Week 5 will
                        # wire alias_normalizer for proper trad→simp + collapse.
                        product_id = await self.dim.resolve_product(
                            item.name, item.name,
                        )
                    await conn.execute(
                        """
                        INSERT INTO fact_pos_item (
                            transaction_id, factory_id, product_id,
                            qty, unit_price, amount, source_item_raw
                        )
                        VALUES ($1, $2, $3, $4, $5, $6, $7)
                        """,
                        txn_id, row.factory_id, product_id,
                        item.qty, item.unit_price, item.amount, item.source_raw,
                    )

                # 5. Write fact_pos_payment rows.
                for channel_name, amount in row.payments:
                    channel_id = await self.dim.resolve_payment_channel(channel_name)
                    await conn.execute(
                        """
                        INSERT INTO fact_pos_payment (
                            transaction_id, factory_id, channel_id, amount
                        )
                        VALUES ($1, $2, $3, $4)
                        """,
                        txn_id, row.factory_id, channel_id, amount,
                    )

                # 6. Write fact_pos_discount rows.
                for disc_name, amount, qty in row.discounts:
                    disc_id = await self.dim.resolve_discount(disc_name)
                    await conn.execute(
                        """
                        INSERT INTO fact_pos_discount (
                            transaction_id, factory_id, discount_id, quantity, amount
                        )
                        VALUES ($1, $2, $3, $4, $5)
                        """,
                        txn_id, row.factory_id, disc_id, qty, amount,
                    )

        return txn_id

    async def write_cost_line(self, line: CostLine) -> int:
        """Write one cost entry. Resolves dim_cost_category on-the-fly,
        inserts fact_cost_line, returns the new id.

        Raises ValueError on factory_id mismatch (like write_row).
        """
        if line.factory_id != self.factory_id:
            raise ValueError(
                f"CostLine factory_id {line.factory_id!r} doesn't match "
                f"normalizer's {self.factory_id!r}"
            )
        category_id = await self.dim.resolve_cost_category(
            line.category_name, line.cost_type, is_fixed=line.is_fixed,
        )
        async with self.pool.acquire() as conn:
            fid = await conn.fetchval(
                """
                INSERT INTO fact_cost_line (
                    factory_id, upload_id, source_type,
                    transaction_id, category_id, date, amount, note
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                RETURNING id
                """,
                line.factory_id, line.upload_id, line.source_type,
                line.transaction_id, category_id, line.date, line.amount, line.note,
            )
        return fid

    async def ingest_cost_lines(self, lines: List[CostLine]) -> int:
        """Batch write. Per-line failures are logged but don't abort the
        batch. Returns count written."""
        n = 0
        for line in lines:
            try:
                await self.write_cost_line(line)
                n += 1
            except Exception as e:
                logger.exception("write_cost_line failed: %s", e)
        return n

    async def ingest_rows(self, rows: List[CanonicalRow]) -> NormalizeStats:
        """Write many rows, accumulating stats. Per-row failures are
        logged but don't abort the batch (each row is its own transaction)."""
        stats = NormalizeStats()
        for row in rows:
            try:
                txn_id = await self.write_row(row)
            except Exception as e:
                logger.exception(
                    "write_row failed for bill=%s: %s",
                    row.source_bill_no, e,
                )
                continue
            if txn_id is None:
                stats.duplicates_skipped += 1
                continue
            stats.transactions_written += 1
            items = parse_combo(row.combo_string)
            stats.items_written += len(items)
            stats.items_unresolved += sum(1 for i in items if not i.parse_ok)
            stats.payments_written += len(row.payments)
            stats.discounts_written += len(row.discounts)
        return stats
