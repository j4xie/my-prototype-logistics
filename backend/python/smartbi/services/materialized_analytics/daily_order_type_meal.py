"""QHJ revenue report — agg_daily_order_type_meal Gold aggregator.

Spec: docs/qa-specs/2026-05-12-qhj-revenue-report-design.md §6.7
Plan: docs/superpowers/plans/2026-05-12-qhj-revenue-report.md Task D1 (revised)

Source: fact_pos_transaction (Silver bill grain)
Target: agg_daily_order_type_meal (Gold, PK
        (factory_id, date, store_id, order_type, meal_period))

Trigger: called from hooks._trigger_materialization after the upload's
bill rows land in fact_pos_transaction (via BillFlowWriter → backfill_silver).

CHECK constraint on fact_pos_transaction.meal_period allows
('早餐','午餐','下午茶','晚餐','其他','午市','晚市','未分类'); aggregator
COALESCEs NULL/empty to '未分类' to fit the not-null PK column of the Gold
table.

Cache invalidation: computed_at column is bumped on every UPSERT → the
revenue-report cache_key (revenue_report:{factory}:{params}:{gold_ts}) flips
automatically when fresh data arrives, so Redis cache misses on stale gen.
"""
from __future__ import annotations

from datetime import date

import asyncpg


_AGG_DAILY_OMT_UPSERT_SQL = """
INSERT INTO agg_daily_order_type_meal AS a (
    factory_id, date, store_id, order_type, meal_period,
    gross_amount, actual_receive, bill_count, customer_count,
    version, computed_at
)
SELECT
    t.factory_id,
    t.date,
    t.store_id,
    COALESCE(TRIM(t.order_type), '未分类')  AS order_type,
    COALESCE(TRIM(t.meal_period), '未分类') AS meal_period,
    SUM(COALESCE(t.gross_amount,   0))      AS gross_amount,
    SUM(COALESCE(t.actual_receive, 0))      AS actual_receive,
    COUNT(*)                                AS bill_count,
    SUM(COALESCE(t.customer_count, 0))      AS customer_count,
    1, NOW()
FROM fact_pos_transaction t
WHERE t.factory_id = $1
  AND t.date BETWEEN $2 AND $3
GROUP BY t.factory_id, t.date, t.store_id,
         COALESCE(TRIM(t.order_type), '未分类'),
         COALESCE(TRIM(t.meal_period), '未分类')
ON CONFLICT (factory_id, date, store_id, order_type, meal_period)
DO UPDATE SET
    gross_amount   = EXCLUDED.gross_amount,
    actual_receive = EXCLUDED.actual_receive,
    bill_count     = EXCLUDED.bill_count,
    customer_count = EXCLUDED.customer_count,
    version        = a.version + 1,
    computed_at    = NOW();
"""


async def materialize_daily_order_type_meal(
    pool: asyncpg.Pool,
    factory_id: str,
    date_min: date,
    date_max: date,
) -> int:
    """Upsert agg_daily_order_type_meal from fact_pos_transaction.

    Args:
        pool: asyncpg pool. Caller is responsible for any worktree-level locking.
        factory_id: tenant ID; sets app.factory_id GUC so RLS allows the INSERT.
        date_min: inclusive lower bound of the source-data window.
        date_max: inclusive upper bound.

    Returns:
        Number of rows affected by the UPSERT (parsed from PG command tag).
    """
    async with pool.acquire() as conn:
        # RLS requires app.factory_id set; same pattern as backfill_silver and
        # other Gold aggregators. Session-scoped (false) so it survives in this
        # acquired connection but doesn't leak to other pool users.
        await conn.execute(
            "SELECT set_config('app.factory_id', $1, false)", factory_id
        )
        status = await conn.execute(
            _AGG_DAILY_OMT_UPSERT_SQL,
            factory_id, date_min, date_max,
        )
    # PG returns 'INSERT 0 N' where N is rows affected (incl. ON CONFLICT updates).
    parts = status.split()
    return int(parts[-1]) if parts and parts[-1].isdigit() else 0
