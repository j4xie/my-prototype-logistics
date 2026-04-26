"""Product Top N by revenue from agg_product_period."""
from __future__ import annotations

from datetime import date
from typing import TYPE_CHECKING, Optional

from smartbi.canonical.templates.base import TemplateResult

if TYPE_CHECKING:
    import asyncpg


async def compute_product_top10(
    pool: "asyncpg.Pool",
    factory_id: str,
    period_start: Optional[date] = None,
    period_end: Optional[date] = None,
    top_n: int = 10,
) -> TemplateResult:
    """Top N products by revenue. Tenant: caller must set app.factory_id.

    period_start / period_end filter agg_product_period rows; None = all-time.
    """
    where = ["a.factory_id = $1"]
    params: list = [factory_id]
    if period_start is not None:
        where.append(f"a.period_start >= ${len(params) + 1}")
        params.append(period_start)
    if period_end is not None:
        where.append(f"a.period_end <= ${len(params) + 1}")
        params.append(period_end)
    where_sql = " AND ".join(where)

    sql = f"""
        SELECT
          p.product_id,
          p.name,
          p.normalized_name,
          SUM(a.qty_sold) AS total_qty,
          SUM(a.revenue) AS total_revenue,
          AVG(a.avg_unit_price) AS avg_price,
          SUM(COALESCE(a.refund_qty, 0)) AS total_refund_qty,
          SUM(COALESCE(a.refund_amount, 0)) AS total_refund_amount
        FROM agg_product_period a
        JOIN dim_product p ON p.product_id = a.product_id
        WHERE {where_sql}
        GROUP BY p.product_id, p.name, p.normalized_name
        ORDER BY total_revenue DESC NULLS LAST
        LIMIT ${len(params) + 1}
    """
    params.append(top_n)

    async with pool.acquire() as conn:
        rows = await conn.fetch(sql, *params)

    if not rows:
        return TemplateResult(
            code="product_top10",
            title="商品销售 Top 10",
            data={},
            applies=False,
            skip_reason="no agg_product_period rows for the given period",
        )

    items = [
        {
            "product_id": r["product_id"],
            "name": r["name"],
            "qty": float(r["total_qty"] or 0),
            "revenue": float(r["total_revenue"] or 0),
            "avg_price": float(r["avg_price"] or 0),
            "refund_qty": float(r["total_refund_qty"] or 0),
            "refund_amount": float(r["total_refund_amount"] or 0),
        }
        for r in rows
    ]

    total_revenue = sum(i["revenue"] for i in items)
    total_qty = sum(i["qty"] for i in items)
    top_product = items[0]
    top_share = (top_product["revenue"] / total_revenue * 100) if total_revenue else 0.0

    return TemplateResult(
        code="product_top10",
        title="商品销售 Top 10",
        data={"items": items},
        kpis={
            "total_revenue": round(total_revenue, 2),
            "total_qty": round(total_qty, 2),
            "top_product_name": top_product["name"],
            "top_product_revenue": round(top_product["revenue"], 2),
            "top_product_share_pct": round(top_share, 2),
            "n_products": len(items),
        },
        chart_config={
            "type": "bar",
            "x_field": "name",
            "y_fields": ["revenue", "qty"],
            "title": "商品销售 Top 10 (按销售额)",
        },
        insight_text=(
            f"Top 1 「{top_product['name']}」 销售额 ¥{top_product['revenue']:,.0f}，"
            f"占 Top 10 总额 {top_share:.1f}%。"
        ),
    )
