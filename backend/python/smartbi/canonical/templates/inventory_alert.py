"""Inventory alerts: most-recent snapshot < safe_stock_qty threshold."""
from __future__ import annotations

from typing import TYPE_CHECKING, Any, Dict, List

from smartbi.canonical.templates.base import TemplateResult

if TYPE_CHECKING:
    import asyncpg


async def compute_inventory_alert(
    pool: "asyncpg.Pool",
    factory_id: str,
    limit: int = 50,
) -> TemplateResult:
    """For each (ingredient × store) take most recent snapshot, compare to threshold.

    Threshold may live at (ingredient, store) granularity OR at (ingredient,
    NULL store) for cross-store defaults. We use ``LEFT JOIN LATERAL`` with
    an ORDER-BY-then-LIMIT-1 inner query so a single (ingredient, store) pair
    matches at most ONE threshold row — store-specific is preferred over
    NULL/global. Without this, the older ``LEFT JOIN ... OR store_id IS NULL``
    pattern produced 2 rows when both store-specific and global thresholds
    existed for the same ingredient.

    Tenant safety: caller MUST set ``app.factory_id`` (via tenant_ctx.set_factory_id
    or pool setup callback) before invoking. Forgetting → FORCE RLS silently returns
    0 rows. Mirrors BaseWriter.write contract.
    """
    sql = """
        WITH latest AS (
            SELECT
                fis.factory_id, fis.ingredient_id, fis.store_id,
                fis.stock_qty, fis.unit, fis.snapshot_date,
                ROW_NUMBER() OVER (
                    PARTITION BY fis.factory_id, fis.ingredient_id, fis.store_id
                    ORDER BY fis.snapshot_date DESC
                ) AS rn
            FROM fact_inventory_snapshot fis
            WHERE fis.factory_id = $1
        )
        SELECT
            l.ingredient_id,
            i.name AS ingredient_name,
            l.store_id,
            st.name AS store_name,
            l.stock_qty,
            l.unit,
            l.snapshot_date,
            th.safe_stock_qty,
            th.reorder_point
        FROM latest l
        JOIN dim_ingredient i ON i.ingredient_id = l.ingredient_id
        LEFT JOIN dim_store st ON st.store_id = l.store_id
        LEFT JOIN LATERAL (
            SELECT safe_stock_qty, reorder_point
            FROM dim_ingredient_threshold
            WHERE factory_id = l.factory_id
              AND ingredient_id = l.ingredient_id
              AND (store_id = l.store_id OR store_id IS NULL)
            ORDER BY (store_id IS NULL) ASC, store_id NULLS LAST
            LIMIT 1
        ) th ON true
        WHERE l.rn = 1
          AND th.safe_stock_qty IS NOT NULL
          AND l.stock_qty < th.safe_stock_qty
        ORDER BY (th.safe_stock_qty - l.stock_qty) DESC
        LIMIT $2
    """

    async with pool.acquire() as conn:
        rows = await conn.fetch(sql, factory_id, limit)

    if not rows:
        return TemplateResult(
            code="inventory_alert",
            title="库存预警",
            data={},
            applies=False,
            skip_reason="no inventory snapshots below safe stock threshold",
        )

    items: List[Dict[str, Any]] = []
    max_shortage = 0.0
    max_name = ""
    max_unit = ""
    for r in rows:
        stock = float(r["stock_qty"] or 0)
        safe = float(r["safe_stock_qty"] or 0)
        shortage = safe - stock
        items.append(
            {
                "ingredient_id": r["ingredient_id"],
                "ingredient_name": r["ingredient_name"],
                "store_id": r["store_id"],
                "store_name": r["store_name"],
                "stock_qty": round(stock, 4),
                "safe_stock_qty": round(safe, 4),
                "shortage": round(shortage, 4),
                "unit": r["unit"],
                "reorder_point": (
                    float(r["reorder_point"]) if r["reorder_point"] is not None else None
                ),
                "snapshot_date": (
                    r["snapshot_date"].isoformat() if r["snapshot_date"] else None
                ),
            }
        )
        if shortage > max_shortage:
            max_shortage = shortage
            max_name = r["ingredient_name"] or ""
            max_unit = r["unit"] or ""

    return TemplateResult(
        code="inventory_alert",
        title="库存预警",
        data={"items": items},
        kpis={
            "n_alerts": len(items),
            "max_shortage_ingredient": max_name,
            "max_shortage_amount": round(max_shortage, 4),
        },
        chart_config={
            "type": "bar",
            "x_field": "ingredient_name",
            "y_fields": ["shortage"],
            "title": "库存短缺排行 (Top {} )".format(len(items)),
        },
        insight_text=(
            f"{len(items)} 项食材低于安全库存，"
            f"最严重的是「{max_name}」短缺 {max_shortage:.2f} {max_unit}。"
        ),
    )
