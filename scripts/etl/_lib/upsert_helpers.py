"""Sub-ETL-2b — Idempotent UPSERT + RLS-aware connection helpers for Silver/Gold loader.

Spec: docs/superpowers/specs/2026-05-11-t6-6-etl-infra-design-spec.md §3.1 / §3.3 / §1.5
PR #332 (Sub-ETL-2a Day 0 audit) baseline:
- dim_store / dim_product / dim_ingredient: UPSERT via existing UNIQUE constraints
- fact_pos_transaction: UPSERT via uq_fact_pos_txn (factory_id, source_type, store_id, source_bill_no)
- fact_pos_item: NO natural-key UNIQUE — Steve sign-off Option A: DELETE-by-parent-txn then INSERT
- fact_restaurant_requisition: UPSERT via uq_fact_req_factory_source (factory_id, source_pk)

RLS contract (per 2026_04_28_silver_dimensions.sql):
  All Silver tables ENABLE + FORCE RLS with policy
    factory_id = current_setting('app.factory_id', true)
  Caller MUST run `SET LOCAL app.factory_id = $1` BEFORE any INSERT/SELECT.
  See connect_factory_scoped() below.

Per python-java-port.md Rule 1 + Rule 6:
- Explicit None checks at function boundaries (no Python `or` for null fallback).
- Precondition assertion on factory_id (asyncpg silently maps None → NULL → RLS denies).

Per concurrent-edit-safety.md Rule 2: this file is in scripts/etl/_lib/ worktree-isolated.

Per Q-ETL-5: scripts/etl/ location (operational, mirrors scripts/migrations/).
"""

from __future__ import annotations

import logging
import re
from dataclasses import dataclass, field
from typing import Any, Optional


log = logging.getLogger("upsert_helpers")


# ────────────────────────────────────────────────────────────────────
# Normalized-name helper (mirrors backend/python/smartbi/alias_normalizer.py
# canonical contract — duplicated here to keep _lib/ stdlib-only per
# Q-ETL-5 + spec §3.2 "DO NOT IMPORT backend.python.smartbi.*").
# ────────────────────────────────────────────────────────────────────

_WHITESPACE_RE = re.compile(r"\s+")


def normalize_product_name(name: str) -> str:
    """Lowercase + collapse whitespace + strip for dedup key.

    Aligns with dim_product.normalized_name UPSERT contract per
    2026_04_28_silver_dimensions.sql line 78 (column comment).

    Args:
        name: raw product name from canonical CSV.

    Returns:
        Normalized form. NEVER returns "" for non-empty input — caller relies
        on this to be stable across re-runs.

    Raises:
        ValueError if name is None or whitespace-only (Q-ETL-6 fail-loud).
    """
    if name is None:
        raise ValueError("normalize_product_name: name required")
    s = name.strip().lower()
    s = _WHITESPACE_RE.sub(" ", s)
    if s == "":
        raise ValueError(f"normalize_product_name: empty after normalize ({name!r})")
    return s


# ────────────────────────────────────────────────────────────────────
# RLS-aware connection helper (per spec §3.3 line 432)
# ────────────────────────────────────────────────────────────────────

async def set_factory_scope(conn: Any, factory_id: str) -> None:
    """SET LOCAL app.factory_id = factory_id so RLS policies allow INSERT/SELECT.

    Caller is responsible for connection lifecycle and transaction control.
    This helper is wired separately from `connect_factory_scoped()` so callers
    can BEGIN/COMMIT around batch operations and the GUC stays SCOPED to the
    enclosing transaction.

    Args:
        conn: asyncpg.Connection (or compatible) — must be inside a transaction
              when called with SET LOCAL semantics.
        factory_id: tenant id (e.g. 'R_ILTEATRO_REAL'). Required non-empty.

    Raises:
        ValueError on missing factory_id (Rule 6).
    """
    if not factory_id:
        raise ValueError("set_factory_scope: factory_id required (got empty/None)")
    # PostgreSQL's `SET` statement is parser-level and does NOT accept bind
    # parameters (would raise PostgresSyntaxError on `$1`). Use `set_config(...)`
    # function form instead — `is_local=true` mirrors `SET LOCAL` semantics
    # (transaction-scoped GUC). Precedent: backend/python/smartbi/services/
    # llm_answer_cache.py:80,147,190. Caller (import_chain) opens a txn before
    # this call, so the GUC stays scoped to that txn as docstring intends.
    await conn.execute(
        "SELECT set_config('app.factory_id', $1, true)", factory_id
    )


async def connect_factory_scoped(asyncpg_module: Any, db_dsn: str, factory_id: str) -> Any:
    """Open a new asyncpg connection and set tenant scope.

    Convenience helper for one-shot operations. Long-lived loaders should
    manage pool + per-txn `set_factory_scope` themselves.

    Args:
        asyncpg_module: the asyncpg module (passed-in to keep _lib stdlib-only
                        in test environments without asyncpg installed).
        db_dsn: connection string, e.g. postgresql://user:pass@host/smartbi_prod_db
        factory_id: tenant id.

    Returns:
        Connected asyncpg.Connection with app.factory_id set.
    """
    if not factory_id:
        raise ValueError("connect_factory_scoped: factory_id required")
    if not db_dsn:
        raise ValueError("connect_factory_scoped: db_dsn required")
    conn = await asyncpg_module.connect(db_dsn)
    # Outside a transaction: session-scoped set_config (is_local=false).
    # PostgreSQL's `SET` does NOT accept bind params, so use set_config()
    # function form. Same precedent as set_factory_scope() above.
    await conn.execute(
        "SELECT set_config('app.factory_id', $1, false)", factory_id
    )
    return conn


# ────────────────────────────────────────────────────────────────────
# Stats accumulator (per import_chain return contract, spec §3.3 line 482)
# ────────────────────────────────────────────────────────────────────

@dataclass
class LoaderStats:
    """Per-chain loader run statistics.

    Cumulative across all canonical CSVs processed in one import_chain call.
    Returned to caller for logging / audit catalog updates.
    """
    factory_id: str = ""
    dim_store_upserts: int = 0
    dim_product_upserts: int = 0
    dim_ingredient_upserts: int = 0
    fact_pos_transaction_upserts: int = 0
    fact_pos_item_inserts: int = 0
    fact_pos_item_deletes: int = 0  # DELETE-then-INSERT pattern (Option A)
    fact_restaurant_requisition_upserts: int = 0
    gold_refresh_count: int = 0
    errors: list[str] = field(default_factory=list)

    def to_dict(self) -> dict:
        return {
            "factory_id": self.factory_id,
            "dim_store_upserts": self.dim_store_upserts,
            "dim_product_upserts": self.dim_product_upserts,
            "dim_ingredient_upserts": self.dim_ingredient_upserts,
            "fact_pos_transaction_upserts": self.fact_pos_transaction_upserts,
            "fact_pos_item_inserts": self.fact_pos_item_inserts,
            "fact_pos_item_deletes": self.fact_pos_item_deletes,
            "fact_restaurant_requisition_upserts": self.fact_restaurant_requisition_upserts,
            "gold_refresh_count": self.gold_refresh_count,
            "errors": list(self.errors),
        }


# ────────────────────────────────────────────────────────────────────
# Dim UPSERT helpers (idempotent — re-run on same input = same DB state)
#
# Each helper mirrors the documented pattern from
# 2026_04_28_silver_dimensions.sql line 22-30:
#
#   INSERT INTO <dim> (factory_id, name, ...)
#   VALUES ($1, $2, ...)
#   ON CONFLICT (factory_id, <unique_cols>)
#     DO UPDATE SET updated_at = NOW(),
#                    <opt: refresh non-key fields>
#   RETURNING <id>
#
# DO UPDATE (not DO NOTHING) is load-bearing — RETURNING is only emitted on
# INSERT or UPDATE, not on NOTHING, so NOTHING would lose concurrency safety.
# ────────────────────────────────────────────────────────────────────

DIM_STORE_UPSERT_SQL = """
    INSERT INTO dim_store (factory_id, name, brand, city, province, region)
    VALUES ($1, $2, $3, $4, $5, $6)
    ON CONFLICT (factory_id, name) DO UPDATE
       SET updated_at = NOW(),
           brand    = COALESCE(EXCLUDED.brand,    dim_store.brand),
           city     = COALESCE(EXCLUDED.city,     dim_store.city),
           province = COALESCE(EXCLUDED.province, dim_store.province),
           region   = COALESCE(EXCLUDED.region,   dim_store.region)
    RETURNING store_id
"""


async def upsert_dim_store(
    conn: Any,
    factory_id: str,
    name: str,
    brand: Optional[str] = None,
    city: Optional[str] = None,
    province: Optional[str] = None,
    region: Optional[str] = None,
) -> int:
    """UPSERT dim_store. Returns store_id (BIGINT, BIGSERIAL).

    Per Rule 6: precondition assertion on factory_id + name.
    Per Rule 1: COALESCE preserves non-NULL existing values on re-run.
    """
    if not factory_id:
        raise ValueError("upsert_dim_store: factory_id required")
    if name is None or (isinstance(name, str) and name.strip() == ""):
        raise ValueError(f"upsert_dim_store: name required (got {name!r})")
    row = await conn.fetchrow(
        DIM_STORE_UPSERT_SQL, factory_id, name.strip(), brand, city, province, region,
    )
    if row is None:
        # ON CONFLICT DO UPDATE always returns a row; missing = bug, fail loud.
        raise RuntimeError(
            f"upsert_dim_store: no row returned for factory={factory_id} name={name!r}"
        )
    return int(row["store_id"])


DIM_PRODUCT_UPSERT_SQL = """
    INSERT INTO dim_product (factory_id, name, normalized_name, category, sub_category, sku_code)
    VALUES ($1, $2, $3, $4, $5, $6)
    ON CONFLICT (factory_id, normalized_name) DO UPDATE
       SET updated_at   = NOW(),
           name         = EXCLUDED.name,
           category     = COALESCE(EXCLUDED.category,     dim_product.category),
           sub_category = COALESCE(EXCLUDED.sub_category, dim_product.sub_category),
           sku_code     = COALESCE(EXCLUDED.sku_code,     dim_product.sku_code)
    RETURNING product_id
"""


async def upsert_dim_product(
    conn: Any,
    factory_id: str,
    name: str,
    normalized_name: Optional[str] = None,
    category: Optional[str] = None,
    sub_category: Optional[str] = None,
    sku_code: Optional[str] = None,
) -> int:
    """UPSERT dim_product. Returns product_id.

    normalized_name defaults to normalize_product_name(name).
    Two raw names that normalize to the same string become one product row.
    """
    if not factory_id:
        raise ValueError("upsert_dim_product: factory_id required")
    if name is None or (isinstance(name, str) and name.strip() == ""):
        raise ValueError(f"upsert_dim_product: name required (got {name!r})")
    norm = normalized_name if normalized_name is not None else normalize_product_name(name)
    row = await conn.fetchrow(
        DIM_PRODUCT_UPSERT_SQL, factory_id, name.strip(), norm, category, sub_category, sku_code,
    )
    if row is None:
        raise RuntimeError(
            f"upsert_dim_product: no row returned for factory={factory_id} name={name!r}"
        )
    return int(row["product_id"])


# dim_ingredient has TWO UNIQUE constraints (per PR #332 audit):
#   uq_dim_ingredient_factory_source (factory_id, source_pk)
#   uq_dim_ingredient_factory_normname (factory_id, normalized_name)
# Loader uses source_pk path (deterministic from source CSV row).
DIM_INGREDIENT_UPSERT_SQL = """
    INSERT INTO dim_ingredient (factory_id, source_pk, name, normalized_name,
                                category, code, unit, unit_price, shelf_life_days,
                                storage_type, is_active)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    ON CONFLICT (factory_id, source_pk) DO UPDATE
       SET updated_at      = NOW(),
           name            = EXCLUDED.name,
           normalized_name = EXCLUDED.normalized_name,
           category        = COALESCE(EXCLUDED.category,        dim_ingredient.category),
           code            = COALESCE(EXCLUDED.code,            dim_ingredient.code),
           unit            = COALESCE(EXCLUDED.unit,            dim_ingredient.unit),
           unit_price      = COALESCE(EXCLUDED.unit_price,      dim_ingredient.unit_price),
           shelf_life_days = COALESCE(EXCLUDED.shelf_life_days, dim_ingredient.shelf_life_days),
           storage_type    = COALESCE(EXCLUDED.storage_type,    dim_ingredient.storage_type),
           is_active       = EXCLUDED.is_active
    RETURNING ingredient_id
"""


async def upsert_dim_ingredient(
    conn: Any,
    factory_id: str,
    source_pk: str,
    name: str,
    normalized_name: Optional[str] = None,
    category: Optional[str] = None,
    code: Optional[str] = None,
    unit: Optional[str] = None,
    unit_price: Optional[float] = None,
    shelf_life_days: Optional[int] = None,
    storage_type: Optional[str] = None,
    is_active: bool = True,
) -> int:
    """UPSERT dim_ingredient via uq_dim_ingredient_factory_source.

    source_pk path (deterministic) per PR #332 audit Finding 1. Caller derives
    source_pk from canonical CSV row (e.g. 'R_QHJ:supplier:product' hash).
    """
    if not factory_id:
        raise ValueError("upsert_dim_ingredient: factory_id required")
    if not source_pk:
        raise ValueError("upsert_dim_ingredient: source_pk required")
    if name is None or (isinstance(name, str) and name.strip() == ""):
        raise ValueError(f"upsert_dim_ingredient: name required (got {name!r})")
    norm = normalized_name if normalized_name is not None else normalize_product_name(name)
    row = await conn.fetchrow(
        DIM_INGREDIENT_UPSERT_SQL,
        factory_id, source_pk, name.strip(), norm,
        category, code, unit, unit_price, shelf_life_days, storage_type, is_active,
    )
    if row is None:
        raise RuntimeError(
            f"upsert_dim_ingredient: no row returned for factory={factory_id} source_pk={source_pk!r}"
        )
    return int(row["ingredient_id"])


# ────────────────────────────────────────────────────────────────────
# Fact UPSERT/INSERT helpers
# ────────────────────────────────────────────────────────────────────

# fact_pos_transaction: uq_fact_pos_txn (factory_id, source_type, store_id, source_bill_no)
FACT_POS_TXN_UPSERT_SQL = """
    INSERT INTO fact_pos_transaction
        (factory_id, upload_id, source_type, source_bill_no, store_id, staff_id,
         date, time, gross_amount, discount_amount, tax_amount, net_amount,
         actual_receive, customer_count, avg_per_capita, table_no,
         order_type, channel_origin, item_count, has_discount)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15,
            $16, $17, $18, $19, $20)
    ON CONFLICT (factory_id, source_type, store_id, source_bill_no) DO UPDATE
       SET updated_at      = NOW(),
           upload_id       = COALESCE(EXCLUDED.upload_id,       fact_pos_transaction.upload_id),
           staff_id        = COALESCE(EXCLUDED.staff_id,        fact_pos_transaction.staff_id),
           date            = EXCLUDED.date,
           time            = COALESCE(EXCLUDED.time,            fact_pos_transaction.time),
           gross_amount    = EXCLUDED.gross_amount,
           discount_amount = EXCLUDED.discount_amount,
           tax_amount      = EXCLUDED.tax_amount,
           net_amount      = EXCLUDED.net_amount,
           actual_receive  = EXCLUDED.actual_receive,
           customer_count  = EXCLUDED.customer_count,
           avg_per_capita  = EXCLUDED.avg_per_capita,
           table_no        = COALESCE(EXCLUDED.table_no,        fact_pos_transaction.table_no),
           order_type      = COALESCE(EXCLUDED.order_type,      fact_pos_transaction.order_type),
           channel_origin  = COALESCE(EXCLUDED.channel_origin,  fact_pos_transaction.channel_origin),
           item_count      = EXCLUDED.item_count,
           has_discount    = EXCLUDED.has_discount
    RETURNING id
"""


async def upsert_fact_pos_transaction(
    conn: Any,
    factory_id: str,
    source_type: str,
    source_bill_no: str,
    store_id: int,
    date: Any,
    upload_id: Optional[int] = None,
    staff_id: Optional[int] = None,
    time: Optional[Any] = None,
    gross_amount: Optional[float] = None,
    discount_amount: Optional[float] = None,
    tax_amount: Optional[float] = None,
    net_amount: Optional[float] = None,
    actual_receive: Optional[float] = None,
    customer_count: Optional[int] = None,
    avg_per_capita: Optional[float] = None,
    table_no: Optional[str] = None,
    order_type: Optional[str] = None,
    channel_origin: Optional[str] = None,
    item_count: Optional[int] = None,
    has_discount: Optional[bool] = None,
) -> int:
    """UPSERT fact_pos_transaction. Returns transaction_id.

    Natural key: (factory_id, source_type, store_id, source_bill_no).
    Per PR #332 audit: matches uq_fact_pos_txn at 2026_04_29_silver_facts.sql:54.
    """
    if not factory_id:
        raise ValueError("upsert_fact_pos_transaction: factory_id required")
    if not source_type:
        raise ValueError("upsert_fact_pos_transaction: source_type required")
    if source_bill_no is None or (isinstance(source_bill_no, str) and source_bill_no.strip() == ""):
        raise ValueError(
            f"upsert_fact_pos_transaction: source_bill_no required (got {source_bill_no!r})"
        )
    if store_id is None:
        raise ValueError("upsert_fact_pos_transaction: store_id required (got None)")
    if date is None:
        raise ValueError("upsert_fact_pos_transaction: date required")
    row = await conn.fetchrow(
        FACT_POS_TXN_UPSERT_SQL,
        factory_id, upload_id, source_type, source_bill_no, store_id, staff_id,
        date, time, gross_amount, discount_amount, tax_amount, net_amount,
        actual_receive, customer_count, avg_per_capita, table_no,
        order_type, channel_origin, item_count, has_discount,
    )
    if row is None:
        raise RuntimeError(
            f"upsert_fact_pos_transaction: no row returned for "
            f"factory={factory_id} bill={source_bill_no!r}"
        )
    return int(row["id"])


# fact_pos_item: NO natural-key UNIQUE per PR #332 audit Finding 2.
# Steve sign-off Option A 2026-05-12: DELETE-by-parent-txn then INSERT.
# Safe within RLS + parent transaction (CASCADE-via-parent is the design).
DELETE_FACT_POS_ITEM_BY_TXN_SQL = """
    DELETE FROM fact_pos_item
     WHERE transaction_id = $1
       AND factory_id     = $2
"""

INSERT_FACT_POS_ITEM_SQL = """
    INSERT INTO fact_pos_item
        (transaction_id, factory_id, product_id, qty, unit_price, amount,
         source_item_raw, return_qty)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
"""


async def replace_fact_pos_items(
    conn: Any,
    factory_id: str,
    transaction_id: int,
    items: list[dict],
    stats: Optional[LoaderStats] = None,
) -> tuple[int, int]:
    """DELETE-then-INSERT fact_pos_item rows for one parent transaction.

    Per PR #332 audit + spec §1.5: fact_pos_item has NO natural-key UNIQUE
    (parser-output grain, ambiguous line dedup contract). Steve sign-off
    Option A 2026-05-12: idempotent via DELETE-by-parent-txn then INSERT.

    Args:
        conn:           asyncpg connection inside an open transaction (RLS scope set).
        factory_id:     tenant id (defensive double-check on RLS).
        transaction_id: parent fact_pos_transaction.id (must exist).
        items:          list of dicts with keys: product_id (Optional[int]),
                        qty, unit_price, amount, source_item_raw, return_qty.
        stats:          optional accumulator updated in-place.

    Returns:
        (deleted_count, inserted_count). deleted_count is the rows removed
        from the prior load (≥0); inserted_count = len(items).

    Idempotence:
        Run #1: insert N items.
        Run #2 (same input): delete N rows, insert N (same byte shape on read).
        Run #3 (modified input M items): delete N, insert M.
    """
    if not factory_id:
        raise ValueError("replace_fact_pos_items: factory_id required")
    if transaction_id is None:
        raise ValueError("replace_fact_pos_items: transaction_id required")
    if items is None:
        raise ValueError("replace_fact_pos_items: items required (use [] for empty)")

    deleted = await conn.execute(
        DELETE_FACT_POS_ITEM_BY_TXN_SQL, transaction_id, factory_id,
    )
    # asyncpg execute() returns command tag like 'DELETE 5'; parse count.
    deleted_count = 0
    if isinstance(deleted, str):
        parts = deleted.rsplit(" ", 1)
        if len(parts) == 2 and parts[1].isdigit():
            deleted_count = int(parts[1])

    inserted_count = 0
    for item in items:
        if item is None:
            continue
        await conn.execute(
            INSERT_FACT_POS_ITEM_SQL,
            transaction_id,
            factory_id,
            item.get("product_id"),
            item.get("qty"),
            item.get("unit_price"),
            item.get("amount"),
            item.get("source_item_raw"),
            item.get("return_qty"),
        )
        inserted_count += 1

    if stats is not None:
        stats.fact_pos_item_deletes += deleted_count
        stats.fact_pos_item_inserts += inserted_count

    return deleted_count, inserted_count


# fact_restaurant_requisition: uq_fact_req_factory_source (factory_id, source_pk)
# per PR #332 audit Finding 4 (NOT source_bill_no, NOT (factory_id, source_bill_no)).
FACT_REQUISITION_UPSERT_SQL = """
    INSERT INTO fact_restaurant_requisition
        (factory_id, source_pk, requisition_number, date, ingredient_id, product_id,
         type, status, requested_qty, actual_qty, unit, est_cost, notes,
         requested_by, approved_by, approved_at)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
    ON CONFLICT (factory_id, source_pk) DO UPDATE
       SET updated_at         = NOW(),
           requisition_number = COALESCE(EXCLUDED.requisition_number,
                                         fact_restaurant_requisition.requisition_number),
           date               = EXCLUDED.date,
           ingredient_id      = COALESCE(EXCLUDED.ingredient_id,
                                         fact_restaurant_requisition.ingredient_id),
           product_id         = COALESCE(EXCLUDED.product_id,
                                         fact_restaurant_requisition.product_id),
           type               = EXCLUDED.type,
           status             = EXCLUDED.status,
           requested_qty      = EXCLUDED.requested_qty,
           actual_qty         = EXCLUDED.actual_qty,
           unit               = COALESCE(EXCLUDED.unit,    fact_restaurant_requisition.unit),
           est_cost           = EXCLUDED.est_cost,
           notes              = COALESCE(EXCLUDED.notes,   fact_restaurant_requisition.notes),
           requested_by       = COALESCE(EXCLUDED.requested_by,
                                         fact_restaurant_requisition.requested_by),
           approved_by        = COALESCE(EXCLUDED.approved_by,
                                         fact_restaurant_requisition.approved_by),
           approved_at        = COALESCE(EXCLUDED.approved_at,
                                         fact_restaurant_requisition.approved_at)
    RETURNING id
"""


async def upsert_fact_restaurant_requisition(
    conn: Any,
    factory_id: str,
    source_pk: str,
    date: Any,
    requisition_number: Optional[str] = None,
    ingredient_id: Optional[int] = None,
    product_id: Optional[int] = None,
    type_: Optional[str] = None,
    status: Optional[str] = None,
    requested_qty: Optional[float] = None,
    actual_qty: Optional[float] = None,
    unit: Optional[str] = None,
    est_cost: Optional[float] = None,
    notes: Optional[str] = None,
    requested_by: Optional[int] = None,
    approved_by: Optional[int] = None,
    approved_at: Optional[Any] = None,
) -> int:
    """UPSERT fact_restaurant_requisition via uq_fact_req_factory_source.

    Natural key per PR #332 audit: (factory_id, source_pk).
    source_pk is the cretas_db.material_requisitions.id mirror for cretas-side
    sources, OR a deterministic hash of (chain + date + doc_no) for Excel-only.
    """
    if not factory_id:
        raise ValueError("upsert_fact_restaurant_requisition: factory_id required")
    if not source_pk:
        raise ValueError("upsert_fact_restaurant_requisition: source_pk required")
    if date is None:
        raise ValueError("upsert_fact_restaurant_requisition: date required")
    row = await conn.fetchrow(
        FACT_REQUISITION_UPSERT_SQL,
        factory_id, source_pk, requisition_number, date, ingredient_id, product_id,
        type_, status, requested_qty, actual_qty, unit, est_cost, notes,
        requested_by, approved_by, approved_at,
    )
    if row is None:
        raise RuntimeError(
            f"upsert_fact_restaurant_requisition: no row returned for "
            f"factory={factory_id} source_pk={source_pk!r}"
        )
    return int(row["id"])


# ────────────────────────────────────────────────────────────────────
# Gold materialization helpers
#
# Per spec §3.3 line 470: existing agg_restaurant_* tables from
# 2026_04_24_gold_restaurant_ops.sql are MATERIALIZED via SQL aggregator
# routines (not Postgres MATERIALIZED VIEW). Loader trigger = call the
# aggregator for the cutover factory_id × date range that was just loaded.
#
# This module exposes a thin REFRESH SQL helper; the actual aggregation
# logic lives in service code (out of ETL scope per Q4 boundary §4.2).
# ────────────────────────────────────────────────────────────────────

# Aggregator SQL — UPSERT into agg_restaurant_daily_totals from fact_pos_transaction.
# Per spec §3.3 line 471: "Refresh agg_restaurant_* materialized views for this factory".
# These are tables (not MVs) so we use INSERT ... ON CONFLICT DO UPDATE.
#
# NOTE: `$1` appears in both the SELECT list (INSERT target column is `varchar`)
# and the WHERE clause (`factory_id` column is `varchar`). asyncpg sends `str`
# Python params without an explicit type, so PostgreSQL deduces conflicting
# types (`text` vs `character varying`) → AmbiguousParameterError. Explicit
# `$1::text` casts in BOTH places resolve the ambiguity (PG cleanly coerces
# `text` ↔ `varchar` at insert/comparison time).
REFRESH_AGG_RESTAURANT_DAILY_TOTALS_SQL = """
    INSERT INTO agg_restaurant_daily_totals
        (factory_id, date, requisition_count, requisition_qty_total, requisition_cost_total,
         version, computed_at)
    SELECT $1::text, date::DATE,
           COUNT(*)::INT,
           SUM(COALESCE(actual_qty, requested_qty))::NUMERIC(14,4),
           SUM(est_cost)::NUMERIC(14,2),
           1, NOW()
      FROM fact_restaurant_requisition
     WHERE factory_id = $1::text
       AND date BETWEEN $2 AND $3
     GROUP BY date::DATE
    ON CONFLICT (factory_id, date) DO UPDATE
       SET requisition_count       = EXCLUDED.requisition_count,
           requisition_qty_total   = EXCLUDED.requisition_qty_total,
           requisition_cost_total  = EXCLUDED.requisition_cost_total,
           version                 = agg_restaurant_daily_totals.version + 1,
           computed_at             = NOW()
"""


async def refresh_agg_restaurant_daily_totals(
    conn: Any,
    factory_id: str,
    start_date: Any,
    end_date: Any,
    stats: Optional[LoaderStats] = None,
) -> int:
    """Refresh agg_restaurant_daily_totals for one factory × date range.

    Idempotent per ON CONFLICT DO UPDATE — version increments each refresh.
    Empty date range or zero source rows = no-op (no rows match the SELECT).

    Args:
        conn:       asyncpg connection (RLS scope set).
        factory_id: tenant id.
        start_date / end_date: inclusive date range (per Rule 6 None-check).
        stats:      optional accumulator.

    Returns:
        Number of (factory_id, date) rows touched. asyncpg returns command tag
        "INSERT 0 N" where N is total affected — parse it.
    """
    if not factory_id:
        raise ValueError("refresh_agg_restaurant_daily_totals: factory_id required")
    if start_date is None or end_date is None:
        raise ValueError(
            f"refresh_agg_restaurant_daily_totals: start_date + end_date required "
            f"(got {start_date!r}, {end_date!r})"
        )

    result = await conn.execute(
        REFRESH_AGG_RESTAURANT_DAILY_TOTALS_SQL, factory_id, start_date, end_date,
    )
    # asyncpg INSERT returns 'INSERT 0 N'
    touched = 0
    if isinstance(result, str):
        parts = result.rsplit(" ", 1)
        if len(parts) == 2 and parts[1].isdigit():
            touched = int(parts[1])

    if stats is not None:
        stats.gold_refresh_count += touched

    return touched
