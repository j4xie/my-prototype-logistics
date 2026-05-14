"""Backfill Gold layer for chains that already have Silver POS data.

Pre-II ETL Backfill — Track B (per spec
`docs/superpowers/specs/2026-05-14-restaurant-phase-ii-analytics-spec.md` §0.5).

Use case: a restaurant chain has rows in `fact_pos_transaction` and
`fact_pos_item` (Silver) but no rows in `agg_daily`, `agg_product`,
`agg_channel`, `agg_daily_order_type_meal` (Gold). This typically
happens when the chain's upload predates the
`SMARTBI_ENABLE_SILVER_DUAL_WRITE=1` env flag, OR when a one-off
ingestion script wrote Silver without invoking `ingest_and_materialize`.

This script queries Silver to find the date range per factory_id, then
calls `GoldMaterializer` + `materialize_daily_order_type_meal` to refresh
Gold for that range.

Usage (CLI, admin-triggered on server):
    python -m scripts.backfill_gold_for_chains \\
        --factory-ids R_GML_DEMO,R_XMX_CHAIN

Idempotent: Gold materializers use ON CONFLICT DO UPDATE; safe to re-run.
"""
from __future__ import annotations

import argparse
import asyncio
import logging
import sys
from datetime import date

import asyncpg

logger = logging.getLogger(__name__)


async def _get_date_range(pool: asyncpg.Pool, factory_id: str) -> tuple[date, date] | None:
    """Return (min_date, max_date) of Silver POS data for factory_id, or
    None if no rows."""
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT MIN(date) AS d_min, MAX(date) AS d_max "
            "FROM fact_pos_transaction WHERE factory_id = $1",
            factory_id,
        )
    if not row or row["d_min"] is None:
        return None
    return (row["d_min"], row["d_max"])


async def backfill_one_factory(pool: asyncpg.Pool, factory_id: str) -> dict:
    """Materialize all Gold tables for one factory_id over its full Silver
    date range. Returns per-table affected row counts."""
    from smartbi.gold.materializer import GoldMaterializer
    from smartbi.services.materialized_analytics.daily_order_type_meal import (
        materialize_daily_order_type_meal,
    )
    from smartbi.tenant_ctx import set_factory_id

    set_factory_id(factory_id)

    date_range = await _get_date_range(pool, factory_id)
    if not date_range:
        return {"factory_id": factory_id, "skipped": "no Silver rows"}

    start, end = date_range
    logger.info("Materializing Gold for %s: %s..%s", factory_id, start, end)

    m = GoldMaterializer(pool, factory_id)

    daily_stats = await m.materialize_daily((start, end))
    channel_stats = await m.materialize_channel((start, end))

    # agg_product / agg_discount are monthly grain; iterate distinct months
    product_total = 0
    discount_total = 0
    cur_month = start.replace(day=1)
    end_month = end.replace(day=1)
    while cur_month <= end_month:
        p_stats = await m.materialize_product(cur_month)
        d_stats = await m.materialize_discount(cur_month)
        product_total += p_stats.rows_upserted
        discount_total += d_stats.rows_upserted
        # Advance to next month (no need for relativedelta, day=1 always exists)
        if cur_month.month == 12:
            cur_month = cur_month.replace(year=cur_month.year + 1, month=1)
        else:
            cur_month = cur_month.replace(month=cur_month.month + 1)

    # QHJ revenue Gold table (堂食/外卖 × 午/晚市 split)
    order_type_meal_affected = await materialize_daily_order_type_meal(
        pool, factory_id, start, end
    )

    return {
        "factory_id": factory_id,
        "date_range": f"{start}..{end}",
        "agg_daily": daily_stats.rows_upserted,
        "agg_channel": channel_stats.rows_upserted,
        "agg_product": product_total,
        "agg_discount": discount_total,
        "agg_daily_order_type_meal": order_type_meal_affected,
    }


async def _main_cli() -> int:
    parser = argparse.ArgumentParser(
        description="Backfill Gold tables for restaurant chains with Silver data"
    )
    parser.add_argument(
        "--factory-ids",
        required=True,
        help="Comma-separated factory_ids (e.g. R_GML_DEMO,R_XMX_CHAIN)",
    )
    args = parser.parse_args()

    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(message)s",
    )

    from smartbi.config import get_settings
    from smartbi.tenant_ctx import set_pg_connection_tenant

    settings = get_settings()
    if not settings.postgres_url:
        print("No Postgres configured", file=sys.stderr)
        return 1

    factory_ids = [f.strip() for f in args.factory_ids.split(",") if f.strip()]
    if not factory_ids:
        print("--factory-ids must contain at least one id", file=sys.stderr)
        return 1

    pool = await asyncpg.create_pool(
        settings.postgres_url,
        min_size=1,
        max_size=3,
        setup=set_pg_connection_tenant,
    )

    try:
        for factory_id in factory_ids:
            result = await backfill_one_factory(pool, factory_id)
            print()
            for k, v in result.items():
                print(f"  {k}: {v}")
    finally:
        await pool.close()

    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(_main_cli()))
