"""Restaurant daily ops Gold read API + ETL trigger endpoint.

Plan C Phase 3. Exposes:
- POST /api/smartbi/restaurant-ops/etl         → trigger ETL run for current factory
- GET  /api/smartbi/restaurant-ops/top-ingredients → Top N ingredients by qty or cost
- GET  /api/smartbi/restaurant-ops/daily-trend    → trend series for kpi_kind

All endpoints are tenant-scoped (factory_id from JWT via auth middleware) and
read from Gold agg tables for sub-100ms response times.
"""
from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Query, Request
from pydantic import BaseModel

logger = logging.getLogger(__name__)
router = APIRouter(tags=["RestaurantOpsGold"])


def _get_factory_id(request: Request) -> Optional[str]:
    """Extract factory_id set by auth middleware."""
    return getattr(request.state, "factory_id", None)


@router.post("/restaurant-ops/etl")
async def trigger_etl(request: Request) -> Dict[str, Any]:
    """Run the full ETL pipeline for the current tenant.

    Intended for admin / on-demand refresh. Production should run a cron job
    that iterates over active factories and calls the underlying function
    directly; this endpoint is for dev + manual triggers.
    """
    factory_id = _get_factory_id(request)
    if not factory_id:
        return {"success": False, "message": "missing factory context"}

    try:
        import asyncpg
        from config import get_settings
        from smartbi.config import get_pg_pool
        from smartbi.gold.restaurant_ops_etl import run_full_etl

        smartbi_pool = await get_pg_pool()
        if smartbi_pool is None:
            return {"success": False, "message": "smartbi_db pool unavailable"}

        settings = get_settings()
        cretas_pool = await asyncpg.create_pool(
            settings.food_kb_db_url, min_size=1, max_size=3, command_timeout=60,
        )
        try:
            stats = await run_full_etl(cretas_pool, smartbi_pool, factory_id)
        finally:
            await cretas_pool.close()

        return {
            "success": len(stats.errors) == 0,
            "data": {
                "dim_ingredient_upserted": stats.dim_ingredient_upserted,
                "fact_requisition_upserted": stats.fact_requisition_upserted,
                "fact_wastage_upserted": stats.fact_wastage_upserted,
                "fact_recipe_upserted": stats.fact_recipe_upserted,
                "fact_stocktaking_upserted": stats.fact_stocktaking_upserted,
                "agg_daily_ops_upserted": stats.agg_daily_ops_upserted,
                "agg_daily_totals_upserted": stats.agg_daily_totals_upserted,
                "agg_product_cost_upserted": stats.agg_product_cost_upserted,
                "errors": stats.errors,
            },
        }
    except Exception as e:
        logger.exception("[etl-endpoint] failed for %s", factory_id)
        return {"success": False, "message": f"ETL failed: {e}"}


@router.get("/restaurant-ops/top-ingredients")
async def top_ingredients(
    request: Request,
    kpi_kind: str = Query("requisition_cost", description="requisition_qty | requisition_cost | wastage_cost"),
    top_n: int = Query(10, ge=1, le=100),
    days: int = Query(30, ge=1, le=365, description="Rolling window"),
) -> Dict[str, Any]:
    """Top N ingredients by a given KPI in the last N days.

    Returns [{ingredient_id, name, category, value, rank}].
    """
    factory_id = _get_factory_id(request)
    if not factory_id:
        return {"success": False, "message": "missing factory context"}

    from smartbi.config import get_pg_pool
    pool = await get_pg_pool()
    if pool is None:
        return {"success": False, "message": "db pool unavailable"}

    async with pool.acquire() as conn:
        await conn.execute("SELECT set_config('app.factory_id', $1, true)", factory_id)
        rows = await conn.fetch(
            """
            SELECT i.ingredient_id, i.name, i.category, i.unit,
                   SUM(a.value_num)::NUMERIC(18,4) AS total_value
              FROM agg_restaurant_daily_ops a
              JOIN dim_ingredient i ON a.dim_value_id = i.ingredient_id
             WHERE a.factory_id = $1
               AND a.kpi_kind = $2
               AND a.date >= CURRENT_DATE - ($3::int)
             GROUP BY i.ingredient_id, i.name, i.category, i.unit
             ORDER BY total_value DESC NULLS LAST
             LIMIT $4
            """,
            factory_id, kpi_kind, days, top_n,
        )

    items = [
        {
            "ingredient_id": r["ingredient_id"],
            "name": r["name"],
            "category": r["category"],
            "unit": r["unit"],
            "value": float(r["total_value"]) if r["total_value"] is not None else 0.0,
            "rank": idx + 1,
        }
        for idx, r in enumerate(rows)
    ]
    return {"success": True, "data": items}


@router.get("/restaurant-ops/daily-trend")
async def daily_trend(
    request: Request,
    kpi_kind: str = Query("requisition_cost"),
    days: int = Query(30, ge=1, le=365),
) -> Dict[str, Any]:
    """Daily time series of a scalar KPI.

    Returns [{date, value}]. Dates with no data are skipped (not zero-filled —
    callers that need continuous series should zero-fill themselves).
    """
    factory_id = _get_factory_id(request)
    if not factory_id:
        return {"success": False, "message": "missing factory context"}

    from smartbi.config import get_pg_pool
    pool = await get_pg_pool()
    if pool is None:
        return {"success": False, "message": "db pool unavailable"}

    # Map friendly kpi_kind to totals column name
    col_map = {
        "requisition_qty":   "requisition_qty_total",
        "requisition_cost":  "requisition_cost_total",
        "requisition_count": "requisition_count",
        "wastage_qty":       "wastage_qty_total",
        "wastage_cost":      "wastage_cost_total",
        "stocktaking_shortage": "stocktaking_shortage_total",
    }
    col = col_map.get(kpi_kind)
    if not col:
        return {"success": False, "message": f"unsupported kpi_kind: {kpi_kind}"}

    async with pool.acquire() as conn:
        await conn.execute("SELECT set_config('app.factory_id', $1, true)", factory_id)
        # Safe to interpolate col since it's from a whitelist
        rows = await conn.fetch(
            f"""
            SELECT date, {col} AS value
              FROM agg_restaurant_daily_totals
             WHERE factory_id = $1
               AND date >= CURRENT_DATE - ($2::int)
             ORDER BY date
            """,
            factory_id, days,
        )
    items = [
        {"date": r["date"].isoformat(), "value": float(r["value"]) if r["value"] is not None else 0.0}
        for r in rows
    ]
    return {"success": True, "data": items}


@router.get("/restaurant-ops/gross-margin")
async def gross_margin(request: Request, days: int = Query(30, ge=1, le=365)) -> Dict[str, Any]:
    """Per-dish gross margin breakdown for the dedicated dashboard page.

    Reuses resolve_gross_margin but returns the full per-dish list (not just top N)
    in a structured format the FE page can sort/filter/export.
    """
    factory_id = _get_factory_id(request)
    if not factory_id:
        return {"success": False, "message": "missing factory context"}

    from smartbi.config import get_pg_pool
    from smartbi.gold.restaurant_ops_router import resolve_gross_margin
    pool = await get_pg_pool()
    if pool is None:
        return {"success": False, "message": "db pool unavailable"}

    try:
        ans = await resolve_gross_margin(pool, factory_id, days=days, top_n=500)
    except Exception as e:
        logger.exception("[gross-margin] resolver failed")
        return {"success": False, "message": f"compute failed: {e}"}

    # Resolver returns enriched[] via .answer_text string; to avoid re-parsing,
    # recompute the per-dish dict here directly from the same join logic (thin wrapper).
    # For cleanliness: extend resolver to return structured rows.
    # For now: call back into the DB to build the structured list:
    async with pool.acquire() as conn:
        await conn.execute("SELECT set_config('app.factory_id', $1, true)", factory_id)
        pos_rows = await conn.fetch(
            """
            SELECT p.name AS dish_name, p.normalized_name,
                   SUM(i.qty)::float AS qty,
                   SUM(i.amount)::float AS revenue,
                   COUNT(DISTINCT i.transaction_id)::int AS bills
              FROM fact_pos_item i
              JOIN fact_pos_transaction t ON t.id = i.transaction_id
              JOIN dim_product p ON p.product_id = i.product_id
             WHERE i.factory_id = $1 AND t.factory_id = $1 AND p.factory_id = $1
               AND t.date >= CURRENT_DATE - ($2::int)
             GROUP BY p.name, p.normalized_name
             ORDER BY revenue DESC NULLS LAST
            """,
            factory_id, days,
        )

    normalized_names = list({r["normalized_name"] for r in pos_rows})
    cretas_map: Dict[str, str] = {}
    if normalized_names:
        try:
            import asyncpg as _asyncpg
            from config import get_settings as _get_settings
            cretas_url = _get_settings().food_kb_db_url
            cretas = await _asyncpg.connect(cretas_url)
            try:
                name_rows = await cretas.fetch(
                    "SELECT id, name FROM product_types WHERE factory_id = $1 AND name = ANY($2::text[])",
                    factory_id, normalized_names,
                )
                cretas_map = {r["name"]: r["id"] for r in name_rows}
            finally:
                await cretas.close()
        except Exception as e:
            logger.warning(f"[gross-margin] cretas lookup failed: {e}")

    cost_map: Dict[str, float] = {}
    if cretas_map:
        async with pool.acquire() as conn:
            await conn.execute("SELECT set_config('app.factory_id', $1, true)", factory_id)
            cost_rows = await conn.fetch(
                """
                SELECT product_source_pk, food_cost::float AS food_cost
                  FROM agg_restaurant_product_cost
                 WHERE factory_id = $1 AND product_source_pk = ANY($2::text[])
                """,
                factory_id, list(cretas_map.values()),
            )
            cost_map = {r["product_source_pk"]: r["food_cost"] for r in cost_rows}

    dishes = []
    total_rev = 0.0
    total_profit = 0.0
    for r in pos_rows:
        source_pk = cretas_map.get(r["normalized_name"])
        food_cost = cost_map.get(source_pk, 0) if source_pk else 0
        total_cost = food_cost * r["qty"]
        gp = r["revenue"] - total_cost
        rate = gp / r["revenue"] if r["revenue"] > 0 else 0
        dishes.append({
            "name": r["dish_name"],
            "qty": r["qty"],
            "revenue": r["revenue"],
            "foodCostUnit": food_cost,
            "totalCost": total_cost,
            "grossProfit": gp,
            "marginRate": rate,
            "bills": r["bills"],
            "hasCost": food_cost > 0,
        })
        total_rev += r["revenue"]
        if food_cost > 0:
            total_profit += gp

    avg_rate = total_profit / total_rev if total_rev > 0 else 0

    return {
        "success": True,
        "data": {
            "windowDays": days,
            "totalRevenue": total_rev,
            "totalProfit": total_profit,
            "avgRate": avg_rate,
            "dishes": dishes,
        },
    }


@router.get("/restaurant-ops/summary")
async def summary(request: Request, days: int = Query(30, ge=1, le=365)) -> Dict[str, Any]:
    """Combined summary for a factory — total requisition cost, top 5 ingredients, etc.

    Single endpoint used by Dashboard strip + AIQuery fast-path.
    """
    factory_id = _get_factory_id(request)
    if not factory_id:
        return {"success": False, "message": "missing factory context"}

    from smartbi.config import get_pg_pool
    pool = await get_pg_pool()
    if pool is None:
        return {"success": False, "message": "db pool unavailable"}

    async with pool.acquire() as conn:
        await conn.execute("SELECT set_config('app.factory_id', $1, true)", factory_id)
        totals = await conn.fetchrow(
            """
            SELECT
                COALESCE(SUM(requisition_count), 0)::int             AS total_requisitions,
                COALESCE(SUM(requisition_qty_total), 0)::float       AS total_req_qty,
                COALESCE(SUM(requisition_cost_total), 0)::float      AS total_req_cost,
                COALESCE(SUM(wastage_count), 0)::int                 AS total_wastage,
                COALESCE(SUM(wastage_qty_total), 0)::float           AS total_wastage_qty,
                COALESCE(SUM(wastage_cost_total), 0)::float          AS total_wastage_cost,
                COALESCE(SUM(stocktaking_count), 0)::int             AS total_stocktaking,
                COALESCE(SUM(stocktaking_shortage_total), 0)::float  AS total_shortage,
                COALESCE(SUM(stocktaking_surplus_total), 0)::float   AS total_surplus,
                COUNT(DISTINCT date)                                 AS active_days
              FROM agg_restaurant_daily_totals
             WHERE factory_id = $1
               AND date >= CURRENT_DATE - ($2::int)
            """,
            factory_id, days,
        )
        top5 = await conn.fetch(
            """
            SELECT i.name, i.category,
                   SUM(a.value_num)::float AS cost
              FROM agg_restaurant_daily_ops a
              JOIN dim_ingredient i ON a.dim_value_id = i.ingredient_id
             WHERE a.factory_id = $1 AND a.kpi_kind = 'requisition_cost'
               AND a.date >= CURRENT_DATE - ($2::int)
             GROUP BY i.name, i.category
             ORDER BY cost DESC NULLS LAST
             LIMIT 5
            """,
            factory_id, days,
        )

    # Apr 24 Plan C Phase 7+: compute gross margin totals by reusing the
    # resolver. Wraps the same POS × food_cost join already used by AI query.
    # Returns zeros gracefully if POS or recipe data is missing.
    margin_totals = {
        "total_pos_revenue": 0.0,
        "total_gross_profit": 0.0,
        "avg_margin_rate": 0.0,
        "dish_count_with_cost": 0,
        "total_dish_count": 0,
    }
    try:
        from smartbi.gold.restaurant_ops_router import resolve_gross_margin
        margin_ans = await resolve_gross_margin(pool, factory_id, days=days, top_n=100)
        if margin_ans.kpis:
            for kpi in margin_ans.kpis:
                if kpi["title"] == "总营收":
                    margin_totals["total_pos_revenue"] = float(kpi["rawValue"]) if kpi["rawValue"] else 0.0
                elif kpi["title"] == "总毛利":
                    margin_totals["total_gross_profit"] = float(kpi["rawValue"]) if kpi["rawValue"] else 0.0
                elif kpi["title"] == "平均毛利率":
                    margin_totals["avg_margin_rate"] = float(kpi["rawValue"]) if kpi["rawValue"] else 0.0
        meta = margin_ans.meta or {}
        margin_totals["total_dish_count"] = meta.get("total_dishes", 0)
        margin_totals["dish_count_with_cost"] = (
            meta.get("total_dishes", 0) - meta.get("missing_cost_count", 0)
        )
    except Exception as e:
        logger.warning(f"[summary] gross margin compute failed: {e}")

    return {
        "success": True,
        "data": {
            "window_days": days,
            "totals": dict(totals) if totals else {},
            "top5_ingredients": [
                {"name": r["name"], "category": r["category"], "cost": r["cost"]}
                for r in top5
            ],
            "margin": margin_totals,
        },
    }
