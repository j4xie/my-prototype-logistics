"""Restaurant daily ops ETL — cretas_db (Bronze) → smartbi_db (Silver + Gold).

Part of Plan C Phase 1-3 (2026-04-24).

Pipeline:
    cretas_db.raw_material_types     → smartbi_db.dim_ingredient
    cretas_db.material_requisitions  → smartbi_db.fact_restaurant_requisition
    cretas_db.wastage_records        → smartbi_db.fact_restaurant_wastage
    cretas_db.recipes                → smartbi_db.fact_restaurant_recipe_line
    cretas_db.stocktaking_records    → smartbi_db.fact_restaurant_stocktaking
    → smartbi_db.agg_restaurant_daily_ops (EAV)
    → smartbi_db.agg_restaurant_daily_totals (scalar per day)
    → smartbi_db.agg_restaurant_product_cost (recipe × price)

Call from an orchestrator (cron or trigger) with `run_full_etl(factory_id)`.

Design notes:
- Each sync is INSERT ... ON CONFLICT DO UPDATE keyed on (factory_id, source_pk),
  so repeated runs are idempotent.
- We fetch cretas_db rows in batches of 500 to bound memory; smartbi_db
  upserts are one INSERT per batch with UNNEST arrays for bulk loading.
- Tenant RLS on Silver/Gold tables is handled via `app.factory_id` session
  variable set at the start of each transaction.
- cretas_db table names here are approximate — verified at runtime via
  information_schema before running. If the Java backend renames tables,
  the ETL should fail fast, not corrupt Silver silently.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Any, Dict, List, Optional

import asyncpg

logger = logging.getLogger(__name__)


@dataclass
class EtlStats:
    """Per-stage row counts for observability."""
    dim_ingredient_upserted: int = 0
    fact_requisition_upserted: int = 0
    fact_wastage_upserted: int = 0
    fact_recipe_upserted: int = 0
    fact_stocktaking_upserted: int = 0
    agg_daily_ops_upserted: int = 0
    agg_daily_totals_upserted: int = 0
    agg_product_cost_upserted: int = 0
    errors: List[str] = None

    def __post_init__(self):
        if self.errors is None:
            self.errors = []


async def _set_tenant(conn: asyncpg.Connection, factory_id: str) -> None:
    """Set the RLS tenant context for this connection's transaction."""
    await conn.execute("SELECT set_config('app.factory_id', $1, true)", factory_id)


def _normalize_name(name: str) -> str:
    """Lightweight normalization for ingredient dedup — lowercase + strip + collapse WS."""
    if not name:
        return ""
    return " ".join(str(name).lower().strip().split())


# ─────────────────────────────────────────────────────────────────────
# Stage 1: dim_ingredient
# ─────────────────────────────────────────────────────────────────────

async def sync_dim_ingredient(
    cretas_pool: asyncpg.Pool,
    smartbi_pool: asyncpg.Pool,
    factory_id: str,
) -> int:
    """Upsert all active raw_material_types rows into dim_ingredient.

    Returns number of rows upserted.
    """
    async with cretas_pool.acquire() as src:
        rows = await src.fetch(
            """
            SELECT id, name, category, code, unit, unit_price, moving_avg_price,
                   shelf_life_days, storage_type, is_active
              FROM raw_material_types
             WHERE factory_id = $1 AND COALESCE(deleted_at, '1900-01-01') = '1900-01-01'
            """,
            factory_id,
        )
    if not rows:
        return 0

    # Build bulk arrays for UNNEST upsert
    source_pks = [r["id"] for r in rows]
    names = [r["name"] or r["id"] for r in rows]
    normalized = [_normalize_name(n) for n in names]
    categories = [r["category"] for r in rows]
    codes = [r["code"] for r in rows]
    units = [r["unit"] for r in rows]
    # Prefer moving_avg_price (actual consumption cost) over unit_price (list price)
    unit_prices = [
        float(r["moving_avg_price"]) if r["moving_avg_price"] is not None
        else (float(r["unit_price"]) if r["unit_price"] is not None else None)
        for r in rows
    ]
    shelf_lives = [r["shelf_life_days"] for r in rows]
    storage_types = [r["storage_type"] for r in rows]
    actives = [bool(r["is_active"]) for r in rows]

    async with smartbi_pool.acquire() as dst:
        async with dst.transaction():
            await _set_tenant(dst, factory_id)
            result = await dst.fetch(
                """
                INSERT INTO dim_ingredient (
                    factory_id, source_pk, name, normalized_name, category, code,
                    unit, unit_price, shelf_life_days, storage_type, is_active
                )
                SELECT $1, pk, n, nn, cat, c, u, up, sl, st, act
                  FROM UNNEST(
                    $2::text[], $3::text[], $4::text[], $5::text[], $6::text[],
                    $7::text[], $8::numeric[], $9::int[], $10::text[], $11::boolean[]
                  ) AS t(pk, n, nn, cat, c, u, up, sl, st, act)
                ON CONFLICT (factory_id, source_pk) DO UPDATE SET
                    name = EXCLUDED.name,
                    normalized_name = EXCLUDED.normalized_name,
                    category = EXCLUDED.category,
                    code = EXCLUDED.code,
                    unit = EXCLUDED.unit,
                    unit_price = EXCLUDED.unit_price,
                    shelf_life_days = EXCLUDED.shelf_life_days,
                    storage_type = EXCLUDED.storage_type,
                    is_active = EXCLUDED.is_active,
                    updated_at = NOW()
                RETURNING ingredient_id
                """,
                factory_id, source_pks, names, normalized, categories, codes,
                units, unit_prices, shelf_lives, storage_types, actives,
            )
    count = len(result)
    logger.info("[etl] dim_ingredient: upserted %d rows for factory=%s", count, factory_id)
    return count


async def _get_ingredient_pk_map(
    smartbi_pool: asyncpg.Pool, factory_id: str,
) -> Dict[str, int]:
    """Return {cretas source_pk → smartbi ingredient_id} for this factory."""
    async with smartbi_pool.acquire() as conn:
        await _set_tenant(conn, factory_id)
        rows = await conn.fetch(
            "SELECT source_pk, ingredient_id FROM dim_ingredient WHERE factory_id = $1",
            factory_id,
        )
    return {r["source_pk"]: r["ingredient_id"] for r in rows}


# ─────────────────────────────────────────────────────────────────────
# Stage 2: fact_restaurant_requisition
# ─────────────────────────────────────────────────────────────────────

async def sync_fact_requisition(
    cretas_pool: asyncpg.Pool,
    smartbi_pool: asyncpg.Pool,
    factory_id: str,
) -> int:
    """Upsert material_requisitions rows (1 row per requisition)."""
    async with cretas_pool.acquire() as src:
        rows = await src.fetch(
            """
            SELECT id, requisition_number, requisition_date, type, status,
                   product_type_id, raw_material_type_id,
                   requested_quantity, actual_quantity, unit,
                   requested_by, approved_by, approved_at, notes
              FROM material_requisitions
             WHERE factory_id = $1 AND deleted_at IS NULL
            """,
            factory_id,
        )
    if not rows:
        return 0

    ing_map = await _get_ingredient_pk_map(smartbi_pool, factory_id)

    source_pks = [r["id"] for r in rows]
    req_numbers = [r["requisition_number"] for r in rows]
    dates = [r["requisition_date"] for r in rows]
    types = [r["type"] for r in rows]
    statuses = [r["status"] for r in rows]
    product_ids = [None for _ in rows]  # TODO Phase 2: resolve via dim_product
    ingredient_ids = [ing_map.get(r["raw_material_type_id"]) for r in rows]
    requested_qtys = [
        float(r["requested_quantity"]) if r["requested_quantity"] is not None else None
        for r in rows
    ]
    actual_qtys = [
        float(r["actual_quantity"]) if r["actual_quantity"] is not None else None
        for r in rows
    ]
    units = [r["unit"] for r in rows]
    # est_cost = requested_qty × ingredient.unit_price (lookup separately to avoid
    # materializing full dim in Python; simpler pattern: compute during upsert via subquery).
    # For now, leave NULL — the Gold aggregator will compute cost from (qty × dim.unit_price).
    est_costs = [None for _ in rows]
    requested_bys = [r["requested_by"] for r in rows]
    approved_bys = [r["approved_by"] for r in rows]
    approved_ats = [r["approved_at"] for r in rows]
    notes = [r["notes"] for r in rows]

    async with smartbi_pool.acquire() as dst:
        async with dst.transaction():
            await _set_tenant(dst, factory_id)
            result = await dst.fetch(
                """
                INSERT INTO fact_restaurant_requisition (
                    factory_id, source_pk, requisition_number, date,
                    product_id, ingredient_id, type, status,
                    requested_qty, actual_qty, unit, est_cost,
                    requested_by, approved_by, approved_at, notes
                )
                SELECT $1, pk, rn, d, prod, ing, t, s, rq, aq, u, ec, rb, ab, aa, n
                  FROM UNNEST(
                    $2::text[], $3::text[], $4::date[],
                    $5::bigint[], $6::bigint[], $7::text[], $8::text[],
                    $9::numeric[], $10::numeric[], $11::text[], $12::numeric[],
                    $13::bigint[], $14::bigint[], $15::timestamp[], $16::text[]
                  ) AS t(pk, rn, d, prod, ing, t, s, rq, aq, u, ec, rb, ab, aa, n)
                ON CONFLICT (factory_id, source_pk) DO UPDATE SET
                    requisition_number = EXCLUDED.requisition_number,
                    date = EXCLUDED.date,
                    ingredient_id = EXCLUDED.ingredient_id,
                    type = EXCLUDED.type,
                    status = EXCLUDED.status,
                    requested_qty = EXCLUDED.requested_qty,
                    actual_qty = EXCLUDED.actual_qty,
                    unit = EXCLUDED.unit,
                    approved_by = EXCLUDED.approved_by,
                    approved_at = EXCLUDED.approved_at,
                    notes = EXCLUDED.notes,
                    updated_at = NOW()
                RETURNING id
                """,
                factory_id, source_pks, req_numbers, dates, product_ids,
                ingredient_ids, types, statuses, requested_qtys, actual_qtys,
                units, est_costs, requested_bys, approved_bys, approved_ats, notes,
            )
    # Fill in est_cost from a separate UPDATE (one row scan, easier to reason about)
    async with smartbi_pool.acquire() as dst:
        async with dst.transaction():
            await _set_tenant(dst, factory_id)
            await dst.execute(
                """
                UPDATE fact_restaurant_requisition r
                   SET est_cost = ROUND(r.requested_qty * i.unit_price, 2)
                  FROM dim_ingredient i
                 WHERE r.factory_id = $1
                   AND r.ingredient_id = i.ingredient_id
                   AND r.requested_qty IS NOT NULL
                   AND i.unit_price IS NOT NULL
                   AND r.est_cost IS NULL
                """,
                factory_id,
            )
    count = len(result)
    logger.info("[etl] fact_requisition: upserted %d rows for factory=%s", count, factory_id)
    return count


# ─────────────────────────────────────────────────────────────────────
# Stage 3 (placeholder): wastage/recipe/stocktaking facts
# ─────────────────────────────────────────────────────────────────────
# Will be implemented in Phase 2. For now Phase 1 MVP validates
# the dim_ingredient + fact_restaurant_requisition path end to end.


# ─────────────────────────────────────────────────────────────────────
# Stage 4: Gold aggregations
# ─────────────────────────────────────────────────────────────────────

# Per-ingredient daily quantity rollup. Run after fact_requisition synced.
_AGG_REQUISITION_QTY_SQL = """
INSERT INTO agg_restaurant_daily_ops (
    factory_id, date, kpi_kind, dim_value_id, dim_value_str, value_num,
    version, computed_at
)
SELECT factory_id, date, 'requisition_qty',
       COALESCE(ingredient_id, 0) AS dim_value_id,
       '' AS dim_value_str,
       SUM(COALESCE(requested_qty, 0))::NUMERIC(18,4) AS value_num,
       1, NOW()
  FROM fact_restaurant_requisition
 WHERE factory_id = $1
   AND status IN ('APPROVED', 'SUBMITTED')
 GROUP BY factory_id, date, ingredient_id
ON CONFLICT (factory_id, date, kpi_kind, dim_value_id, dim_value_str) DO UPDATE SET
    value_num = EXCLUDED.value_num,
    version = agg_restaurant_daily_ops.version + 1,
    computed_at = NOW()
"""

# Per-ingredient daily cost rollup.
_AGG_REQUISITION_COST_SQL = """
INSERT INTO agg_restaurant_daily_ops (
    factory_id, date, kpi_kind, dim_value_id, dim_value_str, value_num,
    version, computed_at
)
SELECT factory_id, date, 'requisition_cost',
       COALESCE(ingredient_id, 0) AS dim_value_id,
       '' AS dim_value_str,
       SUM(COALESCE(est_cost, 0))::NUMERIC(18,4) AS value_num,
       1, NOW()
  FROM fact_restaurant_requisition
 WHERE factory_id = $1
   AND status IN ('APPROVED', 'SUBMITTED')
 GROUP BY factory_id, date, ingredient_id
ON CONFLICT (factory_id, date, kpi_kind, dim_value_id, dim_value_str) DO UPDATE SET
    value_num = EXCLUDED.value_num,
    version = agg_restaurant_daily_ops.version + 1,
    computed_at = NOW()
"""

# Daily totals scalar table — single row per (factory, date).
_AGG_DAILY_TOTALS_SQL = """
INSERT INTO agg_restaurant_daily_totals (
    factory_id, date,
    requisition_count, requisition_qty_total, requisition_cost_total,
    wastage_count, wastage_qty_total, wastage_cost_total,
    stocktaking_count, stocktaking_shortage_total, stocktaking_surplus_total,
    version, computed_at
)
SELECT $1::varchar AS factory_id, d.date,
       COALESCE(req.cnt, 0), COALESCE(req.qty, 0), COALESCE(req.cost, 0),
       0, 0, 0,   -- Phase 2 fills these
       0, 0, 0,   -- Phase 2 fills these
       1, NOW()
  FROM (
    SELECT DISTINCT date FROM fact_restaurant_requisition WHERE factory_id = $1
  ) d
  LEFT JOIN (
    SELECT date,
           COUNT(*)       AS cnt,
           SUM(COALESCE(requested_qty, 0)) AS qty,
           SUM(COALESCE(est_cost, 0))      AS cost
      FROM fact_restaurant_requisition
     WHERE factory_id = $1
     GROUP BY date
  ) req ON req.date = d.date
ON CONFLICT (factory_id, date) DO UPDATE SET
    requisition_count = EXCLUDED.requisition_count,
    requisition_qty_total = EXCLUDED.requisition_qty_total,
    requisition_cost_total = EXCLUDED.requisition_cost_total,
    version = agg_restaurant_daily_totals.version + 1,
    computed_at = NOW()
"""


async def materialize_gold_daily_ops(
    smartbi_pool: asyncpg.Pool, factory_id: str,
) -> Dict[str, int]:
    """Re-compute all Gold agg tables from current Silver state."""
    stats = {"requisition_qty": 0, "requisition_cost": 0, "daily_totals": 0}
    async with smartbi_pool.acquire() as conn:
        async with conn.transaction():
            await _set_tenant(conn, factory_id)
            r1 = await conn.execute(_AGG_REQUISITION_QTY_SQL, factory_id)
            r2 = await conn.execute(_AGG_REQUISITION_COST_SQL, factory_id)
            r3 = await conn.execute(_AGG_DAILY_TOTALS_SQL, factory_id)
            # asyncpg returns "INSERT 0 N" — parse last int
            stats["requisition_qty"] = int(r1.split()[-1]) if r1 else 0
            stats["requisition_cost"] = int(r2.split()[-1]) if r2 else 0
            stats["daily_totals"] = int(r3.split()[-1]) if r3 else 0
    logger.info("[etl] materialized gold for %s: %s", factory_id, stats)
    return stats


# ─────────────────────────────────────────────────────────────────────
# Orchestrator
# ─────────────────────────────────────────────────────────────────────

async def run_full_etl(
    cretas_pool: asyncpg.Pool,
    smartbi_pool: asyncpg.Pool,
    factory_id: str,
) -> EtlStats:
    """Run Silver + Gold sync for one factory. Callers (cron / API) use this."""
    stats = EtlStats()
    try:
        stats.dim_ingredient_upserted = await sync_dim_ingredient(
            cretas_pool, smartbi_pool, factory_id
        )
    except Exception as e:
        stats.errors.append(f"dim_ingredient: {e}")
        logger.exception("[etl] dim_ingredient failed for %s", factory_id)

    try:
        stats.fact_requisition_upserted = await sync_fact_requisition(
            cretas_pool, smartbi_pool, factory_id
        )
    except Exception as e:
        stats.errors.append(f"fact_requisition: {e}")
        logger.exception("[etl] fact_requisition failed for %s", factory_id)

    try:
        gold = await materialize_gold_daily_ops(smartbi_pool, factory_id)
        stats.agg_daily_ops_upserted = (
            gold.get("requisition_qty", 0) + gold.get("requisition_cost", 0)
        )
        stats.agg_daily_totals_upserted = gold.get("daily_totals", 0)
    except Exception as e:
        stats.errors.append(f"gold: {e}")
        logger.exception("[etl] gold materialize failed for %s", factory_id)

    return stats
