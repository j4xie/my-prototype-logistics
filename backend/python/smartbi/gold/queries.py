"""Gold read-path queries — downstream modules hit these instead of
recomputing aggregates on every request.

Week 4 Phase B v0 of Unified Data Layer v1 spec (§5).

Scope today
-----------
One query shape per downstream module that will eventually cut over to
Gold. Started with `finance_summary` (the spec's §5 pilot). The actual
Java cutover touches the existing FinanceAnalysisService and is deferred
to a future session — today's deliverable is the Python primitive that
the cutover will use (Python service) or replicate (Java JDBC).

All queries
-----------
- Accept `factory_id` + a date range
- Assume tenant_ctx is set so RLS on agg_* enforces tenant scope (the
  `factory_id` arg is belt-and-suspenders — it's also in the WHERE)
- Return plain dicts (not dataclasses) so they're JSON-serializable
  directly via FastAPI

Why not pydantic models
-----------------------
Keeping this layer dict-based because the shape will evolve rapidly
(v1.1 pilot → v1.2 more modules → v1.3 review adapters) and pydantic
versioning churn would create friction. The FastAPI route layer will
wrap these in response_model schemas as we lock shapes down.
"""
from __future__ import annotations

import logging
from datetime import date
from decimal import Decimal
from typing import Any, Dict, Optional, Tuple

import asyncpg

logger = logging.getLogger(__name__)


async def finance_summary(
    pool: asyncpg.Pool,
    factory_id: str,
    date_range: Tuple[date, date],
    *,
    top_n_stores: int = 10,
) -> Dict[str, Any]:
    """Finance KPI summary for the Vue 财务报表 page.

    Returns a dict with:
      - `factory_id`, `start_date`, `end_date` — echoes input
      - `total_revenue` — SUM(net_amount) across range
      - `bill_count` — SUM(bill_count) across range
      - `avg_bill_value` — revenue / bills (None if bills=0)
      - `store_count` — distinct stores with any activity
      - `day_count` — distinct dates with any activity
      - `top_stores` — top N stores by revenue, each with
        {store_id, store_name, revenue, bill_count}

    Current v1.1 scope intentionally omits cost metrics (material/labor/
    overhead) because Silver doesn't yet capture them — those live in
    smart_bi_finance_data legacy records. Week 5+ will add cost Silver
    tables and extend this shape.
    """
    start, end = date_range
    if start > end:
        raise ValueError(f"start {start} > end {end}")

    async with pool.acquire() as conn:
        # Grand totals + row counts.
        totals = await conn.fetchrow(
            """
            SELECT
              COALESCE(SUM(net_amount), 0)::numeric(18,2)  AS total_revenue,
              COALESCE(SUM(bill_count), 0)                 AS bill_count,
              COUNT(DISTINCT store_id)                     AS store_count,
              COUNT(DISTINCT date)                         AS day_count
            FROM agg_daily
            WHERE factory_id = $1
              AND date BETWEEN $2 AND $3
            """,
            factory_id, start, end,
        )

        top_stores = await conn.fetch(
            """
            SELECT a.store_id,
                   s.name AS store_name,
                   SUM(a.net_amount)::numeric(18,2) AS revenue,
                   SUM(a.bill_count)                AS bill_count
              FROM agg_daily a
              JOIN dim_store s ON s.store_id = a.store_id
             WHERE a.factory_id = $1
               AND a.date BETWEEN $2 AND $3
             GROUP BY a.store_id, s.name
             ORDER BY SUM(a.net_amount) DESC
             LIMIT $4
            """,
            factory_id, start, end, int(top_n_stores),
        )

    total_revenue = Decimal(totals["total_revenue"])
    bill_count = int(totals["bill_count"])
    avg_bill_value: Optional[Decimal] = (
        (total_revenue / bill_count).quantize(Decimal("0.01"))
        if bill_count > 0 else None
    )

    return {
        "factory_id": factory_id,
        "start_date": start.isoformat(),
        "end_date": end.isoformat(),
        "total_revenue": float(total_revenue),
        "bill_count": bill_count,
        "avg_bill_value": float(avg_bill_value) if avg_bill_value is not None else None,
        "store_count": int(totals["store_count"]),
        "day_count": int(totals["day_count"]),
        "top_stores": [
            {
                "store_id": int(r["store_id"]),
                "store_name": r["store_name"],
                "revenue": float(r["revenue"]),
                "bill_count": int(r["bill_count"]),
            }
            for r in top_stores
        ],
    }
