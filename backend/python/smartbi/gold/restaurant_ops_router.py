"""Gold-backed restaurant daily-ops query router.

Sits parallel to materialized_analytics/query_router.py. This one handles
queries that should be answered from agg_restaurant_daily_* tables rather
than per-upload xlsx cache.

Trigger points:
- smartbi/api/chat.py stream handler: before the materialized-cache router
  runs, check match_restaurant_ops(query); if hit, serve from Gold and
  return early (fast path, <100ms).

Template codes (RESTAURANT_OPS_* prefix to namespace from xlsx templates):
  RESTAURANT_OPS_REQUISITION_TREND — last N days requisition cost + top 5 ingredients
  RESTAURANT_OPS_WASTAGE_TOP       — wastage ranking by ingredient or type
  RESTAURANT_OPS_RECIPE_COST       — dish food cost ranking
  RESTAURANT_OPS_STOCK_SHORTAGE    — stocktaking shortage hot spots

Sample queries for each code used both for keyword matching AND for RAG
semantic routing (Phase 3 of learned-template plan).
"""
from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Tuple

logger = logging.getLogger(__name__)


# Keyword patterns per ops template. Each entry: (code, [[kw_group_1], [kw_group_2], ...]).
# Query must contain at least one keyword from each group. First match wins.
_OPS_PATTERNS: List[Tuple[str, List[List[str]]]] = [
    # Wastage: "损耗/浪费" + "最多/哪/top/类型/占比"
    (
        "RESTAURANT_OPS_WASTAGE_TOP",
        [["损耗", "浪费", "报损", "腐坏", "过期"],
         ["最多", "排名", "top", "TOP", "哪个", "哪种", "类型", "占比", "分布", "原因", "多少"]],
    ),
    # Stocktaking shortage: "盘点/盘亏/亏损" + "哪/top/最多"
    (
        "RESTAURANT_OPS_STOCK_SHORTAGE",
        [["盘点", "盘亏", "盘损", "库存差异", "账实差"],
         ["哪个", "哪些", "最多", "top", "TOP", "排名", "频率", "经常"]],
    ),
    # Recipe cost: "配方/成本/毛利" + "菜/哪/高/低"
    (
        "RESTAURANT_OPS_RECIPE_COST",
        [["食材成本", "配方成本", "菜品成本", "食材费用", "毛利"],
         ["最高", "最低", "哪道", "哪个", "top", "TOP", "排名", "多少"]],
    ),
    # Requisition trend: "领料/领/领用" + "趋势/最多/食材"
    (
        "RESTAURANT_OPS_REQUISITION_TREND",
        [["领料", "领用", "用料", "食材用量"],
         ["趋势", "最多", "top", "TOP", "哪个食材", "哪些食材", "排名"]],
    ),
]


# Sample queries per template for RAG semantic routing + user suggestions.
SAMPLE_QUERIES: Dict[str, List[str]] = {
    "RESTAURANT_OPS_WASTAGE_TOP": [
        "最近7天损耗最多的食材是什么",
        "哪种损耗类型最多?",
        "过期和破损哪个更严重",
        "损耗金额排名",
        "这个月损耗分布如何",
        "浪费最多的菜是哪些",
        "报损原因占比",
        "损耗食材 top 10",
    ],
    "RESTAURANT_OPS_STOCK_SHORTAGE": [
        "最近哪个食材盘亏最严重",
        "盘点差异最大的食材 top 10",
        "盘亏金额排名",
        "哪些食材经常盘亏",
        "账实差距最大的是哪些食材",
        "本月盘点情况",
    ],
    "RESTAURANT_OPS_RECIPE_COST": [
        "食材成本最高的菜是哪些",
        "配方成本 top 10",
        "毛利最低的菜品",
        "哪道菜食材费用最贵",
        "菜品成本排行",
        "食材占销售额比重最高的菜",
    ],
    "RESTAURANT_OPS_REQUISITION_TREND": [
        "最近30天领料趋势",
        "领用最多的食材是哪些",
        "本月食材用量 top 10",
        "哪些食材领料频率最高",
        "领料数量趋势",
        "食材消耗排名",
    ],
}


def match_restaurant_ops(query: str) -> Optional[str]:
    """Return the ops template code if query matches, else None.

    Pure keyword match for <1ms routing. RAG-based fallback can live in
    chat.py's existing fallback chain.
    """
    if not query:
        return None
    q = query.strip()
    for code, groups in _OPS_PATTERNS:
        if all(any(kw in q for kw in group) for group in groups):
            return code
    return None


@dataclass
class OpsAnswer:
    """Structured answer returned from resolve_* functions."""
    code: str
    title: str
    answer_text: str
    charts: List[Dict[str, Any]]
    kpis: List[Dict[str, Any]]
    meta: Dict[str, Any]


async def resolve_wastage_top(
    smartbi_pool, factory_id: str, days: int = 30, top_n: int = 10,
) -> OpsAnswer:
    """Top N wastage ingredients + wastage type breakdown, last N days."""
    async with smartbi_pool.acquire() as conn:
        await conn.execute("SELECT set_config('app.factory_id', $1, true)", factory_id)
        top_rows = await conn.fetch(
            """
            SELECT i.name, i.category, i.unit,
                   SUM(a.value_num)::float AS qty
              FROM agg_restaurant_daily_ops a
              JOIN dim_ingredient i ON a.dim_value_id = i.ingredient_id
             WHERE a.factory_id = $1 AND a.kpi_kind = 'wastage_qty'
               AND a.date >= CURRENT_DATE - ($2::int)
             GROUP BY i.name, i.category, i.unit
             ORDER BY qty DESC NULLS LAST
             LIMIT $3
            """,
            factory_id, days, top_n,
        )
        type_rows = await conn.fetch(
            """
            SELECT a.dim_value_str AS type, SUM(a.value_num)::float AS cost
              FROM agg_restaurant_daily_ops a
             WHERE a.factory_id = $1 AND a.kpi_kind = 'wastage_cost_by_type'
               AND a.date >= CURRENT_DATE - ($2::int)
             GROUP BY a.dim_value_str
             ORDER BY cost DESC NULLS LAST
            """,
            factory_id, days,
        )
        total = await conn.fetchrow(
            """
            SELECT COALESCE(SUM(wastage_qty_total), 0)::float AS total_qty,
                   COALESCE(SUM(wastage_cost_total), 0)::float AS total_cost,
                   COALESCE(SUM(wastage_count), 0)::int AS total_count
              FROM agg_restaurant_daily_totals
             WHERE factory_id = $1 AND date >= CURRENT_DATE - ($2::int)
            """,
            factory_id, days,
        )

    type_name_map = {
        "EXPIRED": "过期", "DAMAGED": "破损", "SPOILED": "变质",
        "PROCESSING": "加工损耗", "OTHER": "其他",
    }
    top_list_text = "\n".join([
        f"  {i+1}. {r['name']} ({r['category'] or '—'}): {r['qty']:.2f} {r['unit'] or ''}"
        for i, r in enumerate(top_rows)
    ]) or "  (近 %d 天无损耗记录)" % days

    type_summary = "、".join([
        f"{type_name_map.get(r['type'], r['type'])} ¥{r['cost']:.2f}"
        for r in type_rows[:5]
    ]) or "无数据"

    answer = (
        f"近 {days} 天损耗总览:\n"
        f"- 总损耗 {total['total_count']} 次, {total['total_qty']:.2f} 单位, 损失 ¥{total['total_cost']:.2f}\n"
        f"- 损耗类型分布: {type_summary}\n\n"
        f"Top {len(top_rows)} 损耗食材 (按数量):\n{top_list_text}"
    )

    charts = []
    if top_rows:
        charts.append({
            "chartType": "bar",
            "title": f"Top {len(top_rows)} 损耗食材 (近{days}天)",
            "xAxis": {"data": [r["name"] for r in top_rows]},
            "series": [{"name": "损耗量", "type": "bar", "data": [r["qty"] for r in top_rows]}],
        })
    if type_rows:
        charts.append({
            "chartType": "pie",
            "title": "损耗类型占比",
            "series": [{
                "name": "损耗类型", "type": "pie",
                "data": [{"name": type_name_map.get(r["type"], r["type"]), "value": r["cost"]} for r in type_rows],
            }],
        })

    return OpsAnswer(
        code="RESTAURANT_OPS_WASTAGE_TOP",
        title=f"近{days}天损耗分析",
        answer_text=answer,
        charts=charts,
        kpis=[
            {"title": "损耗次数", "value": total["total_count"], "rawValue": total["total_count"]},
            {"title": "损耗量", "value": f"{total['total_qty']:.1f}", "rawValue": total["total_qty"]},
            {"title": "损耗金额", "value": f"¥{total['total_cost']:.2f}", "rawValue": total["total_cost"]},
            {"title": "Top 食材", "value": top_rows[0]["name"] if top_rows else "—", "rawValue": 0},
        ],
        meta={"window_days": days, "top_n": top_n},
    )


async def resolve_stock_shortage(
    smartbi_pool, factory_id: str, days: int = 30, top_n: int = 10,
) -> OpsAnswer:
    """Top N stocktaking shortage ingredients, last N days."""
    async with smartbi_pool.acquire() as conn:
        await conn.execute("SELECT set_config('app.factory_id', $1, true)", factory_id)
        rows = await conn.fetch(
            """
            SELECT i.name, i.category, i.unit,
                   SUM(a.value_num)::float AS shortage_qty
              FROM agg_restaurant_daily_ops a
              JOIN dim_ingredient i ON a.dim_value_id = i.ingredient_id
             WHERE a.factory_id = $1 AND a.kpi_kind = 'stocktaking_shortage_qty'
               AND a.date >= CURRENT_DATE - ($2::int)
             GROUP BY i.name, i.category, i.unit
             HAVING SUM(a.value_num) > 0
             ORDER BY shortage_qty DESC NULLS LAST
             LIMIT $3
            """,
            factory_id, days, top_n,
        )
        total = await conn.fetchrow(
            """
            SELECT COALESCE(SUM(stocktaking_shortage_total), 0)::float AS shortage,
                   COALESCE(SUM(stocktaking_surplus_total), 0)::float AS surplus,
                   COALESCE(SUM(stocktaking_count), 0)::int AS count
              FROM agg_restaurant_daily_totals
             WHERE factory_id = $1 AND date >= CURRENT_DATE - ($2::int)
            """,
            factory_id, days,
        )

    top_text = "\n".join([
        f"  {i+1}. {r['name']} ({r['category'] or '—'}): 盘亏 {r['shortage_qty']:.2f} {r['unit'] or ''}"
        for i, r in enumerate(rows)
    ]) or f"  (近 {days} 天无盘亏记录)"

    answer = (
        f"近 {days} 天盘点总览:\n"
        f"- 盘点 {total['count']} 次, 盘亏总量 {total['shortage']:.2f}, 盘盈总量 {total['surplus']:.2f}\n\n"
        f"Top {len(rows)} 盘亏食材:\n{top_text}"
    )
    charts = []
    if rows:
        charts.append({
            "chartType": "bar",
            "title": f"Top {len(rows)} 盘亏食材 (近{days}天)",
            "xAxis": {"data": [r["name"] for r in rows]},
            "series": [{"name": "盘亏量", "type": "bar", "data": [r["shortage_qty"] for r in rows]}],
        })

    return OpsAnswer(
        code="RESTAURANT_OPS_STOCK_SHORTAGE",
        title=f"近{days}天盘点差异分析",
        answer_text=answer,
        charts=charts,
        kpis=[
            {"title": "盘点次数", "value": total["count"], "rawValue": total["count"]},
            {"title": "盘亏总量", "value": f"{total['shortage']:.1f}", "rawValue": total["shortage"]},
            {"title": "盘盈总量", "value": f"{total['surplus']:.1f}", "rawValue": total["surplus"]},
            {"title": "Top 盘亏", "value": rows[0]["name"] if rows else "—", "rawValue": 0},
        ],
        meta={"window_days": days, "top_n": top_n},
    )


async def resolve_recipe_cost(
    smartbi_pool, factory_id: str, top_n: int = 10,
) -> OpsAnswer:
    """Top N dishes by food cost (standard_qty × unit_price rollup).

    Joins cretas_db.product_types for dish names at query time (no dim_product
    ETL needed yet — see 2026_04_24_recipe_product_source_pk.sql rationale).
    """
    async with smartbi_pool.acquire() as conn:
        await conn.execute("SELECT set_config('app.factory_id', $1, true)", factory_id)
        rows = await conn.fetch(
            """
            SELECT c.product_source_pk, c.food_cost, c.ingredient_count, c.has_price_data
              FROM agg_restaurant_product_cost c
             WHERE c.factory_id = $1 AND c.food_cost > 0
             ORDER BY c.food_cost DESC NULLS LAST
             LIMIT $2
            """,
            factory_id, top_n,
        )
    source_pks = [r["product_source_pk"] for r in rows]

    # Look up dish names from cretas_db.product_types (separate pool).
    name_map: Dict[str, str] = {}
    if source_pks:
        try:
            import asyncpg as _asyncpg
            from config import get_settings as _get_settings
            cretas_url = _get_settings().food_kb_db_url
            cretas = await _asyncpg.connect(cretas_url)
            try:
                name_rows = await cretas.fetch(
                    "SELECT id, name FROM product_types WHERE factory_id = $1 AND id = ANY($2::text[])",
                    factory_id, source_pks,
                )
                name_map = {r["id"]: r["name"] for r in name_rows}
            finally:
                await cretas.close()
        except Exception as e:
            logger.warning(f"[recipe_cost] dish name lookup failed: {e}")

    top_text = "\n".join([
        f"  {i+1}. {name_map.get(r['product_source_pk'], '#' + r['product_source_pk'])}: ¥{r['food_cost']:.2f} ({r['ingredient_count']} 种食材)"
        for i, r in enumerate(rows)
    ]) or "  (尚未录入配方数据或食材单价为空)"

    answer = (
        f"菜品食材成本 Top {len(rows)}:\n{top_text}\n\n"
        f"注: 成本 = 标准用量 × 食材单价. 售价数据可从 POS Gold (fact_pos_item) 获取后计算毛利."
    )
    charts = []
    if rows:
        charts.append({
            "chartType": "bar",
            "title": f"Top {len(rows)} 高成本菜品",
            "xAxis": {"data": [name_map.get(r["product_source_pk"], r["product_source_pk"]) for r in rows]},
            "series": [{"name": "食材成本", "type": "bar", "data": [r["food_cost"] for r in rows]}],
        })

    return OpsAnswer(
        code="RESTAURANT_OPS_RECIPE_COST",
        title="菜品食材成本排行",
        answer_text=answer,
        charts=charts,
        kpis=[
            {"title": "菜品数", "value": len(rows), "rawValue": len(rows)},
            {"title": "最高成本", "value": f"¥{rows[0]['food_cost']:.2f}" if rows else "—", "rawValue": rows[0]["food_cost"] if rows else 0},
            {"title": "Top 菜品", "value": name_map.get(rows[0]["product_source_pk"], "—") if rows else "—", "rawValue": 0},
        ],
        meta={"top_n": top_n},
    )


async def resolve_requisition_trend(
    smartbi_pool, factory_id: str, days: int = 30, top_n: int = 10,
) -> OpsAnswer:
    """Requisition trend + Top N ingredients by qty, last N days."""
    async with smartbi_pool.acquire() as conn:
        await conn.execute("SELECT set_config('app.factory_id', $1, true)", factory_id)
        trend = await conn.fetch(
            """
            SELECT date, requisition_qty_total::float AS qty,
                   requisition_cost_total::float AS cost
              FROM agg_restaurant_daily_totals
             WHERE factory_id = $1 AND date >= CURRENT_DATE - ($2::int)
             ORDER BY date
            """,
            factory_id, days,
        )
        top = await conn.fetch(
            """
            SELECT i.name, i.category, i.unit,
                   SUM(a.value_num)::float AS qty
              FROM agg_restaurant_daily_ops a
              JOIN dim_ingredient i ON a.dim_value_id = i.ingredient_id
             WHERE a.factory_id = $1 AND a.kpi_kind = 'requisition_qty'
               AND a.date >= CURRENT_DATE - ($2::int)
             GROUP BY i.name, i.category, i.unit
             ORDER BY qty DESC NULLS LAST
             LIMIT $3
            """,
            factory_id, days, top_n,
        )

    total_qty = sum(r["qty"] or 0 for r in trend)
    total_cost = sum(r["cost"] or 0 for r in trend)
    top_text = "\n".join([
        f"  {i+1}. {r['name']} ({r['category'] or '—'}): {r['qty']:.2f} {r['unit'] or ''}"
        for i, r in enumerate(top)
    ]) or "  (近 %d 天无领料记录)" % days

    answer = (
        f"近 {days} 天领料总览:\n"
        f"- 总量 {total_qty:.2f} 单位, 估算成本 ¥{total_cost:.2f}, {len(trend)} 天有活动\n\n"
        f"Top {len(top)} 领用食材:\n{top_text}"
    )
    charts = [{
        "chartType": "line",
        "title": f"近{days}天领料数量趋势",
        "xAxis": {"data": [r["date"].isoformat() for r in trend]},
        "series": [{"name": "领料量", "type": "line", "data": [r["qty"] for r in trend]}],
    }]
    if top:
        charts.append({
            "chartType": "bar",
            "title": f"Top {len(top)} 领用食材",
            "xAxis": {"data": [r["name"] for r in top]},
            "series": [{"name": "领用量", "type": "bar", "data": [r["qty"] for r in top]}],
        })

    return OpsAnswer(
        code="RESTAURANT_OPS_REQUISITION_TREND",
        title=f"近{days}天领料趋势+食材 Top {top_n}",
        answer_text=answer,
        charts=charts,
        kpis=[
            {"title": "总领料量", "value": f"{total_qty:.1f}", "rawValue": total_qty},
            {"title": "估算成本", "value": f"¥{total_cost:.2f}", "rawValue": total_cost},
            {"title": "活动天数", "value": len(trend), "rawValue": len(trend)},
            {"title": "Top 食材", "value": top[0]["name"] if top else "—", "rawValue": 0},
        ],
        meta={"window_days": days, "top_n": top_n},
    )


_RESOLVERS = {
    "RESTAURANT_OPS_WASTAGE_TOP": resolve_wastage_top,
    "RESTAURANT_OPS_STOCK_SHORTAGE": resolve_stock_shortage,
    "RESTAURANT_OPS_RECIPE_COST": resolve_recipe_cost,
    "RESTAURANT_OPS_REQUISITION_TREND": resolve_requisition_trend,
}


async def resolve_by_code(
    code: str, smartbi_pool, factory_id: str, **kwargs
) -> Optional[OpsAnswer]:
    """Dispatch to the right resolver. Returns None if code unknown."""
    resolver = _RESOLVERS.get(code)
    if resolver is None:
        return None
    return await resolver(smartbi_pool, factory_id, **kwargs)
