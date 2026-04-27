"""数据织网 C BF1: backfill historical Silver rows into field_provenance.

per spec 04-C v1.4 §5.3 + §9.2.

Usage:
    # Single table, resume from last checkpoint
    python -m smartbi.scripts.backfill_provenance --table agg_product_period

    # Multiple tables, all from scratch
    python -m smartbi.scripts.backfill_provenance \\
        --table agg_product_period dim_review_summary \\
        --reset

    # Dry run (count rows, no INSERT)
    python -m smartbi.scripts.backfill_provenance --table agg_product_period --dry-run

Conventions:
- Idempotent via ON CONFLICT DO NOTHING + uq_fp_dedup partial unique index.
  Re-running on same source rows produces 0 new field_provenance rows.
- Crash-resume via backfill_progress.last_id checkpoint per table.
- Batch size 5000, sleep 200ms between batches (avoid prod load spike).
- Compound field_name (`<base>@store_<id>`) matches Day 10-12 writer hooks
  (product_summary_writer.py:161-175, inventory_writer.py:185-197).
- created_by = 'backfill_from_<source_table>' for audit trail.
- confidence_method = 'rule' (per V20260501_01 column).

Source-table column-name reality check (v1.4 spec §5.3 was loose):
- agg_product_period: factory_id, upload_id, product_id, store_id,
  period_start, period_end, qty_sold, revenue, avg_unit_price.
- dim_review_summary: factory_id, product_id, store_id (NOT *_for_summary —
  spec §5.3 used the writer-side variable names; actual table columns are
  unsuffixed per V20260427_02 schema), period_start, period_end, avg_rating,
  total_count, positive_count, negative_count. NOTE: dim_review_summary has
  no upload_id column — backfill writes source_upload_id = sentinel 0.
- fact_finance_voucher: factory_id, upload_id, subject_id, voucher_date,
  debit_amount, credit_amount.
- fact_inventory_snapshot: factory_id, upload_id, ingredient_id, store_id,
  snapshot_date, stock_qty, unit.
"""
from __future__ import annotations

import argparse
import asyncio
import json
import logging
import os
import sys
from collections import defaultdict
from typing import Optional

import asyncpg

logger = logging.getLogger(__name__)


_DEFAULT_BATCH_SIZE = 5000
_DEFAULT_SLEEP_BETWEEN_BATCHES_S = 0.2
_SENTINEL_UPLOAD_ID = 0  # V20260430_01 reserved sentinel for non-upload sources

SUPPORTED_TABLES = (
    "agg_product_period",
    "dim_review_summary",
    "fact_finance_voucher",
    "fact_inventory_snapshot",
)


# ── Checkpoint helpers ─────────────────────────────────────────────

async def _load_checkpoint(conn: asyncpg.Connection, table_name: str) -> int:
    row = await conn.fetchrow(
        "SELECT last_id FROM backfill_progress WHERE table_name = $1", table_name
    )
    return int(row["last_id"]) if row else 0


async def _save_checkpoint(
    conn: asyncpg.Connection,
    table_name: str,
    last_id: int,
    rows_processed_delta: int,
    rows_inserted_delta: int,
    rows_skipped_delta: int = 0,
) -> None:
    await conn.execute(
        """
        INSERT INTO backfill_progress
          (table_name, last_id, rows_processed, rows_inserted, rows_skipped)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (table_name) DO UPDATE SET
          last_id = EXCLUDED.last_id,
          rows_processed = backfill_progress.rows_processed + EXCLUDED.rows_processed,
          rows_inserted = backfill_progress.rows_inserted + EXCLUDED.rows_inserted,
          rows_skipped = backfill_progress.rows_skipped + EXCLUDED.rows_skipped
        """,
        table_name, last_id,
        rows_processed_delta, rows_inserted_delta, rows_skipped_delta,
    )


async def _mark_completed(conn: asyncpg.Connection, table_name: str) -> None:
    await conn.execute(
        "UPDATE backfill_progress SET completed_at = NOW() WHERE table_name = $1",
        table_name,
    )


async def _reset_checkpoint(conn: asyncpg.Connection, table_name: str) -> None:
    await conn.execute(
        """
        INSERT INTO backfill_progress (table_name, last_id) VALUES ($1, 0)
        ON CONFLICT (table_name) DO UPDATE SET
          last_id = 0,
          rows_processed = 0,
          rows_inserted = 0,
          rows_skipped = 0,
          started_at = NOW(),
          completed_at = NULL,
          last_error = NULL
        """,
        table_name,
    )


def _store_suffix(store_id: Optional[int]) -> str:
    """Compound field_name suffix '@store_<id>' or '' for NULL store_id.

    Must match Day 10-12 writer hooks (product_summary_writer.py:161-165,
    inventory_writer.py:184-188).
    """
    return f"@store_{store_id}" if store_id is not None else ""


# ── agg_product_period mapper ──────────────────────────────────────

_AGG_PRODUCT_PERIOD_FETCH_SQL = """
    SELECT id, factory_id, upload_id, product_id, store_id,
           period_start, period_end, qty_sold, revenue, avg_unit_price
      FROM agg_product_period
     WHERE id > $1
     ORDER BY id
     LIMIT $2
"""


async def _backfill_agg_product_period_batch(
    conn: asyncpg.Connection, batch_rows: list,
) -> tuple[int, int]:
    """INSERT up to 3 provenance rows per source row (revenue/qty_sold/avg_unit_price).

    Skips rows missing product_id (entity_id is NOT NULL) or with all-NULL value
    fields. Returns (rows_attempted, rows_inserted_actually). Idempotency:
    ON CONFLICT DO NOTHING via uq_fp_dedup partial unique.
    """
    attempted = 0
    inserted = 0
    for src in batch_rows:
        if src["product_id"] is None:
            continue  # skip — no entity to anchor to
        store_suffix = _store_suffix(src["store_id"])
        upload_id = src["upload_id"] if src["upload_id"] is not None else _SENTINEL_UPLOAD_ID
        for field_base, value in (
            ("revenue", src["revenue"]),
            ("qty_sold", src["qty_sold"]),
            ("avg_unit_price", src["avg_unit_price"]),
        ):
            if value is None:
                continue
            attempted += 1
            field_name = f"{field_base}{store_suffix}"
            value_json = json.dumps(float(value), ensure_ascii=False)
            row = await conn.fetchrow(
                """
                INSERT INTO field_provenance
                  (factory_id, entity_type, entity_id, field_name, field_value,
                   source_upload_id, source_type, confidence, mapper_method,
                   confidence_method, valid_from, valid_to, created_by)
                VALUES ($1, 'product', $2, $3, $4::jsonb,
                        $5, 'product_summary', 0.85, 'rule',
                        'rule', COALESCE($6::date, '-infinity'::date), $7, $8)
                ON CONFLICT DO NOTHING
                RETURNING id
                """,
                src["factory_id"], src["product_id"], field_name, value_json,
                upload_id, src["period_start"], src["period_end"],
                "backfill_from_agg_product_period",
            )
            if row is not None:
                inserted += 1
    return attempted, inserted


# ── dim_review_summary mapper ──────────────────────────────────────

# NOTE: dim_review_summary has columns product_id / store_id (NOT *_for_summary
# as spec §5.3 implied — the *_for_summary names are local variable names
# inside review_writer.py; actual table columns from V20260427_02 are bare).
# Also: dim_review_summary does NOT have an upload_id column, so we use the
# sentinel upload_id (0) for these provenance rows — consistent with the
# writer hook which also writes one aggregate row per upload but loses the
# direct linkage at the table level.
_DIM_REVIEW_SUMMARY_FETCH_SQL = """
    SELECT id, factory_id, product_id, store_id,
           period_start, period_end, avg_rating, total_count,
           positive_count, negative_count
      FROM dim_review_summary
     WHERE id > $1
     ORDER BY id
     LIMIT $2
"""


async def _backfill_dim_review_summary_batch(
    conn: asyncpg.Connection, batch_rows: list,
) -> tuple[int, int]:
    """ReviewWriter is aggregate-then-INSERT (per upload). Anchor to
    product if available, else store, else skip — matches Day 12 hook
    (review_writer.py:202-211).

    Field names match writer: avg_rating / review_count / positive_count /
    negative_count. NOTE: writer maps total_count → review_count.
    """
    attempted = 0
    inserted = 0
    for src in batch_rows:
        if src["product_id"] is not None:
            entity_type = "product"
            entity_id = src["product_id"]
        elif src["store_id"] is not None:
            entity_type = "store"
            entity_id = src["store_id"]
        else:
            continue  # skip — no anchor

        for field_name, value, value_caster in (
            ("avg_rating", src["avg_rating"], lambda v: float(v) if v is not None else None),
            ("review_count", src["total_count"], lambda v: int(v) if v is not None else None),
            ("positive_count", src["positive_count"], lambda v: int(v) if v is not None else None),
            ("negative_count", src["negative_count"], lambda v: int(v) if v is not None else None),
        ):
            casted = value_caster(value)
            if casted is None:
                continue
            attempted += 1
            value_json = json.dumps(casted)
            row = await conn.fetchrow(
                """
                INSERT INTO field_provenance
                  (factory_id, entity_type, entity_id, field_name, field_value,
                   source_upload_id, source_type, confidence, mapper_method,
                   confidence_method, valid_from, valid_to, created_by)
                VALUES ($1, $2, $3, $4, $5::jsonb,
                        $6, 'review', 0.80, 'rule',
                        'rule', COALESCE($7::date, '-infinity'::date), $8, $9)
                ON CONFLICT DO NOTHING
                RETURNING id
                """,
                src["factory_id"], entity_type, entity_id, field_name, value_json,
                _SENTINEL_UPLOAD_ID,  # dim_review_summary has no upload_id column
                src["period_start"], src["period_end"],
                "backfill_from_dim_review_summary",
            )
            if row is not None:
                inserted += 1
    return attempted, inserted


# ── fact_finance_voucher mapper ────────────────────────────────────

_FACT_FINANCE_VOUCHER_FETCH_SQL = """
    SELECT id, factory_id, upload_id, subject_id, voucher_date,
           debit_amount, credit_amount
      FROM fact_finance_voucher
     WHERE id > $1
     ORDER BY id
     LIMIT $2
"""


async def _backfill_fact_finance_voucher_batch(
    conn: asyncpg.Connection, batch_rows: list,
) -> tuple[int, int]:
    """Roll up per (factory, subject_id, voucher_date) — matches Day 12
    FinanceWriter hook rollup behavior (finance_writer.py:196-204).

    Per-voucher cell-level lineage isn't analytically useful;
    daily-subject SUM is. Skips 0-rolled-up rows (no signal to record).
    """
    rollup: dict = defaultdict(
        lambda: {"debit_amount": 0.0, "credit_amount": 0.0, "upload_id": None}
    )
    null_skipped = 0
    for src in batch_rows:
        if src["subject_id"] is None or src["voucher_date"] is None:
            null_skipped += 1
            continue
        key = (src["factory_id"], src["subject_id"], src["voucher_date"])
        rollup[key]["debit_amount"] += float(src["debit_amount"] or 0)
        rollup[key]["credit_amount"] += float(src["credit_amount"] or 0)
        # Keep first non-null upload_id for this group (any will do for audit)
        if rollup[key]["upload_id"] is None and src["upload_id"] is not None:
            rollup[key]["upload_id"] = src["upload_id"]

    if null_skipped > 0:
        logger.warning(
            "fact_finance_voucher backfill: %d rows skipped (NULL subject_id/voucher_date)",
            null_skipped,
        )

    attempted = 0
    inserted = 0
    for (factory_id, subject_id, voucher_date), totals in rollup.items():
        upload_id = totals["upload_id"] if totals["upload_id"] is not None else _SENTINEL_UPLOAD_ID
        for field_name in ("debit_amount", "credit_amount"):
            value = totals[field_name]
            if value == 0:
                continue  # don't write zero-rolled-up rows
            attempted += 1
            value_json = json.dumps(value)
            row = await conn.fetchrow(
                """
                INSERT INTO field_provenance
                  (factory_id, entity_type, entity_id, field_name, field_value,
                   source_upload_id, source_type, confidence, mapper_method,
                   confidence_method, valid_from, valid_to, created_by)
                VALUES ($1, 'finance_subject', $2, $3, $4::jsonb,
                        $5, 'bill_flow', 0.90, 'rule',
                        'rule', $6, NULL, $7)
                ON CONFLICT DO NOTHING
                RETURNING id
                """,
                factory_id, subject_id, field_name, value_json,
                upload_id, voucher_date,
                "backfill_from_fact_finance_voucher",
            )
            if row is not None:
                inserted += 1
    return attempted, inserted


# ── fact_inventory_snapshot mapper ─────────────────────────────────

_FACT_INVENTORY_SNAPSHOT_FETCH_SQL = """
    SELECT id, factory_id, upload_id, ingredient_id, store_id,
           snapshot_date, stock_qty, unit
      FROM fact_inventory_snapshot
     WHERE id > $1
     ORDER BY id
     LIMIT $2
"""


async def _backfill_fact_inventory_snapshot_batch(
    conn: asyncpg.Connection, batch_rows: list,
) -> tuple[int, int]:
    """INSERT up to 2 provenance rows per source (stock_qty/unit) with
    @store_<id> compound suffix. Matches Day 10-12 InventoryWriter hook
    (inventory_writer.py:189-202).
    """
    attempted = 0
    inserted = 0
    for src in batch_rows:
        if src["ingredient_id"] is None:
            continue
        store_suffix = _store_suffix(src["store_id"])
        upload_id = src["upload_id"] if src["upload_id"] is not None else _SENTINEL_UPLOAD_ID
        for field_base, value, value_caster in (
            ("stock_qty", src["stock_qty"], lambda v: float(v) if v is not None else None),
            ("unit", src["unit"], lambda v: str(v) if v is not None else None),
        ):
            casted = value_caster(value)
            if casted is None:
                continue
            attempted += 1
            field_name = f"{field_base}{store_suffix}"
            value_json = json.dumps(casted)
            row = await conn.fetchrow(
                """
                INSERT INTO field_provenance
                  (factory_id, entity_type, entity_id, field_name, field_value,
                   source_upload_id, source_type, confidence, mapper_method,
                   confidence_method, valid_from, valid_to, created_by)
                VALUES ($1, 'ingredient', $2, $3, $4::jsonb,
                        $5, 'inventory', 0.80, 'rule',
                        'rule', $6, NULL, $7)
                ON CONFLICT DO NOTHING
                RETURNING id
                """,
                src["factory_id"], src["ingredient_id"], field_name, value_json,
                upload_id, src["snapshot_date"],
                "backfill_from_fact_inventory_snapshot",
            )
            if row is not None:
                inserted += 1
    return attempted, inserted


# ── Dispatch ───────────────────────────────────────────────────────

_TABLE_DISPATCH = {
    "agg_product_period": (_AGG_PRODUCT_PERIOD_FETCH_SQL, _backfill_agg_product_period_batch),
    "dim_review_summary": (_DIM_REVIEW_SUMMARY_FETCH_SQL, _backfill_dim_review_summary_batch),
    "fact_finance_voucher": (_FACT_FINANCE_VOUCHER_FETCH_SQL, _backfill_fact_finance_voucher_batch),
    "fact_inventory_snapshot": (_FACT_INVENTORY_SNAPSHOT_FETCH_SQL, _backfill_fact_inventory_snapshot_batch),
}


async def backfill_table(
    pool: asyncpg.Pool,
    table_name: str,
    batch_size: int = _DEFAULT_BATCH_SIZE,
    sleep_between_batches_s: float = _DEFAULT_SLEEP_BETWEEN_BATCHES_S,
    dry_run: bool = False,
) -> dict:
    """Run BF1 backfill for one source table.

    Returns: dict with table, rows_processed, rows_inserted, batches,
    last_id_start, last_id_end, dry_run.
    """
    if table_name not in _TABLE_DISPATCH:
        raise ValueError(
            f"Unsupported table: {table_name}. Supported: {SUPPORTED_TABLES}"
        )
    fetch_sql, batch_handler = _TABLE_DISPATCH[table_name]

    total_processed = 0
    total_inserted = 0
    batch_count = 0

    async with pool.acquire() as ckpt_conn:
        last_id_at_start: int = await _load_checkpoint(ckpt_conn, table_name)
    last_id = last_id_at_start
    logger.info(
        "[%s] resuming from last_id=%d batch_size=%d dry_run=%s",
        table_name, last_id, batch_size, dry_run,
    )

    while True:
        async with pool.acquire() as conn:
            rows = await conn.fetch(fetch_sql, last_id, batch_size)
            if not rows:
                break

            if dry_run:
                attempted, inserted = len(rows), 0
            else:
                async with conn.transaction():
                    attempted, inserted = await batch_handler(conn, rows)

            total_processed += len(rows)
            total_inserted += inserted
            batch_count += 1
            new_last_id = rows[-1]["id"]

            if not dry_run:
                await _save_checkpoint(
                    conn, table_name, new_last_id,
                    rows_processed_delta=len(rows),
                    rows_inserted_delta=inserted,
                    rows_skipped_delta=attempted - inserted,
                )

            last_id = new_last_id
            logger.info(
                "[%s] batch %d: rows=%d inserted=%d cumulative_processed=%d",
                table_name, batch_count, len(rows), inserted, total_processed,
            )

        if sleep_between_batches_s > 0:
            await asyncio.sleep(sleep_between_batches_s)

    if not dry_run and batch_count > 0:
        async with pool.acquire() as conn:
            await _mark_completed(conn, table_name)

    return {
        "table": table_name,
        "rows_processed": total_processed,
        "rows_inserted": total_inserted,
        "batches": batch_count,
        "last_id_start": last_id_at_start,
        "last_id_end": last_id,
        "dry_run": dry_run,
    }


async def main_async(args) -> int:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")

    dsn = os.environ.get("BACKFILL_PG_DSN") or os.environ.get("INTEGRATION_PG_DSN")
    if not dsn:
        logger.error("Set BACKFILL_PG_DSN or INTEGRATION_PG_DSN env var")
        return 2

    pool = await asyncpg.create_pool(dsn, min_size=1, max_size=2, timeout=10)
    try:
        if args.reset:
            async with pool.acquire() as conn:
                for tbl in args.table:
                    await _reset_checkpoint(conn, tbl)
                    logger.info("[%s] checkpoint reset to last_id=0", tbl)

        results = []
        for tbl in args.table:
            result = await backfill_table(
                pool, tbl,
                batch_size=args.batch_size,
                sleep_between_batches_s=args.sleep,
                dry_run=args.dry_run,
            )
            results.append(result)

        for r in results:
            logger.info(
                "[%s] DONE: processed=%d inserted=%d batches=%d (last_id %d->%d)%s",
                r["table"], r["rows_processed"], r["rows_inserted"],
                r["batches"], r["last_id_start"], r["last_id_end"],
                " (DRY RUN)" if r["dry_run"] else "",
            )
        return 0
    finally:
        await pool.close()


def main():
    parser = argparse.ArgumentParser(
        description="Backfill historical Silver rows into field_provenance."
    )
    parser.add_argument(
        "--table", nargs="+", required=True, choices=list(SUPPORTED_TABLES),
        help="One or more source tables to backfill.",
    )
    parser.add_argument("--batch-size", type=int, default=_DEFAULT_BATCH_SIZE)
    parser.add_argument("--sleep", type=float, default=_DEFAULT_SLEEP_BETWEEN_BATCHES_S)
    parser.add_argument("--dry-run", action="store_true", help="Count rows, skip INSERT.")
    parser.add_argument("--reset", action="store_true", help="Reset checkpoint to 0 before starting.")
    args = parser.parse_args()

    sys.exit(asyncio.run(main_async(args)))


if __name__ == "__main__":
    main()
