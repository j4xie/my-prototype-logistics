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
    # Per-store margin (MUST come BEFORE dish-level gross_margin):
    # "哪家店赚钱" = store scope, not dish scope. Group-1 = store scope,
    # Group-2 = margin vocabulary.
    # Apr 25 2026 routing fix: removed "最好" from group-2 — it was over-broadly
    # matching unrelated queries like "哪个店服务最好" / "哪家店环境最好" /
    # "哪家店评价最好", which then routed to STORE_MARGIN (30-day POS window) and
    # returned the misleading "近 30 天无 POS 销售数据" message even when full
    # POS data was present. All legitimate margin triggers ("哪家店最赚钱",
    # "门店毛利排行", "分店利润对比", etc.) still match via the remaining
    # margin-specific vocabulary. See aiquery-OBSERVATIONS.md (Apr 24 audit C-4).
    (
        "RESTAURANT_OPS_STORE_MARGIN",
        [["门店", "店", "分店", "店铺", "哪家"],
         ["毛利", "毛利率", "赚钱", "净赚", "利润"]],
    ),
    # Cross-module gross margin — dish-level (MUST come BEFORE recipe_cost since
    # "毛利" on its own = margin not cost). Plan C's signature feature.
    # Apr 25 2026 routing fix (C-2 audit follow-up): removed bare "菜" from
    # group-2 — it created over-broad matches against 菜单/菜谱 type queries
    # (e.g. "菜单利润分析" wrongly routed dish-level margin instead of
    # menu-level). Replaced with the explicit dish-scope tokens 菜品 / 菜系 /
    # 菜价 plus existing dish-scoped pronouns. "菜单怎么改" / "菜价怎么样"
    # still fall through cleanly because they lack a group-1 margin keyword;
    # "菜系毛利率" / "菜品毛利率排行" continue to match (legitimate).
    (
        "RESTAURANT_OPS_GROSS_MARGIN",
        [["毛利", "毛利率", "净赚", "赚钱", "挣钱", "利润"],
         ["菜品", "菜系", "菜价", "哪道", "哪个", "排行", "排名", "top", "TOP", "最高", "最赚"]],
    ),
    # Recipe cost (食材成本 only — 毛利 moved to gross_margin)
    (
        "RESTAURANT_OPS_RECIPE_COST",
        [["食材成本", "配方成本", "菜品成本", "食材费用"],
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
    "RESTAURANT_OPS_GROSS_MARGIN": [
        "哪道菜毛利最高",
        "菜品毛利率排行",
        "最赚钱的菜 top 10",
        # Apr 25 2026: tightened from "哪些菜净赚最多" (bare 菜 was removed
        # from group-2 to stop 菜单/菜谱 false-positives) — explicit dish
        # marker now required.
        "哪些菜品净赚最多",
        "菜品毛利对比",
        "利润最高的菜品",
        "售价减去食材成本最多的菜",
    ],
    "RESTAURANT_OPS_STORE_MARGIN": [
        "哪家店最赚钱",
        "门店毛利排行",
        "哪家门店毛利率最高",
        "分店利润对比",
        "店铺毛利分析",
        "哪家店净赚最多",
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


async def resolve_gross_margin(
    smartbi_pool, factory_id: str, days: int = 30, top_n: int = 10,
) -> OpsAnswer:
    """Cross-module gross margin analysis: POS sold_price × recipe food_cost.

    Join logic:
      fact_pos_item (POS 卖价 + qty) →
      JOIN dim_product (POS side, name) →
      JOIN product_types (cretas side, name = dim_product.name via normalized name match) →
      JOIN agg_restaurant_product_cost (food cost per dish, keyed by product_source_pk=product_types.id) →
      compute gross_profit = sum(amount) - sum(qty × food_cost) per dish

    Plan C's signature feature — unlocks real gross margin analysis that
    was impossible before Silver/Gold restaurant ops layer.
    """
    # Need cretas connection for product_types name↔id lookup
    async with smartbi_pool.acquire() as conn:
        await conn.execute("SELECT set_config('app.factory_id', $1, true)", factory_id)

        # Step 1: POS sales aggregated per dish (past N days)
        # Use fact_pos_transaction.date to filter time window.
        pos_rows = await conn.fetch(
            """
            SELECT p.product_id, p.name AS dish_name, p.normalized_name,
                   SUM(i.qty)::float AS total_qty,
                   SUM(i.amount)::float AS total_revenue,
                   COUNT(DISTINCT i.transaction_id)::int AS bills
              FROM fact_pos_item i
              JOIN fact_pos_transaction t ON t.id = i.transaction_id
              JOIN dim_product p ON p.product_id = i.product_id
             WHERE i.factory_id = $1
               AND t.factory_id = $1
               AND t.date >= CURRENT_DATE - ($2::int)
               AND p.factory_id = $1
             GROUP BY p.product_id, p.name, p.normalized_name
             ORDER BY total_revenue DESC NULLS LAST
            """,
            factory_id, days,
        )

    if not pos_rows:
        return OpsAnswer(
            code="RESTAURANT_OPS_GROSS_MARGIN",
            title=f"菜品毛利分析 (近{days}天)",
            answer_text=(
                f"近 {days} 天无 POS 销售数据.\n"
                f"提示: 上传 POS 账单 Excel 到 SmartBI, materialize 后会写入 fact_pos_item, "
                f"本分析即可运行. 需要同时有配方+食材单价才能计算毛利."
            ),
            charts=[], kpis=[],
            meta={"window_days": days, "no_pos_data": True},
        )

    # Step 2: look up cretas product_types by name (primary) + dim_product_alias (fallback).
    # P0-2: alias lets merchants bind POS name → any product_type, handles the
    # "POS xlsx name vs recipe name" drift problem (括号/空格/[] differences).
    normalized_names = list({r["normalized_name"] for r in pos_rows})
    cretas_map: Dict[str, str] = {}  # pos_name → source_pk (product_type_id)
    try:
        import asyncpg as _asyncpg
        from config import get_settings as _get_settings
        cretas_url = _get_settings().food_kb_db_url
        cretas = await _asyncpg.connect(cretas_url)
        try:
            # Primary: exact name match
            name_rows = await cretas.fetch(
                "SELECT id, name FROM product_types WHERE factory_id = $1 AND name = ANY($2::text[])",
                factory_id, normalized_names,
            )
            for r in name_rows:
                cretas_map[r["name"]] = r["id"]
            # Fallback: alias table (table may not exist on older schemas → catch)
            unmapped = [n for n in normalized_names if n not in cretas_map]
            if unmapped:
                try:
                    alias_rows = await cretas.fetch(
                        """SELECT pos_name, product_type_id FROM dim_product_alias
                            WHERE factory_id = $1 AND pos_name = ANY($2::text[])""",
                        factory_id, unmapped,
                    )
                    for r in alias_rows:
                        cretas_map[r["pos_name"]] = r["product_type_id"]
                except Exception as e:
                    # Table doesn't exist yet — ignore, name match still works
                    if "does not exist" not in str(e):
                        logger.warning(f"[gross_margin] alias lookup failed: {e}")
        finally:
            await cretas.close()
    except Exception as e:
        logger.warning(f"[gross_margin] cretas name lookup failed: {e}")

    # Step 3: load food cost per source_pk
    cost_map: Dict[str, float] = {}
    if cretas_map:
        async with smartbi_pool.acquire() as conn:
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

    # Step 4: compute margin per dish
    enriched = []
    for r in pos_rows:
        source_pk = cretas_map.get(r["normalized_name"])
        food_cost = cost_map.get(source_pk, 0) if source_pk else 0
        total_cost = food_cost * r["total_qty"]
        gross_profit = r["total_revenue"] - total_cost
        margin_rate = gross_profit / r["total_revenue"] if r["total_revenue"] > 0 else 0
        enriched.append({
            "name": r["dish_name"],
            "qty": r["total_qty"],
            "revenue": r["total_revenue"],
            "bills": r["bills"],
            "food_cost_unit": food_cost,
            "gross_profit": gross_profit,
            "margin_rate": margin_rate,
            "has_cost": food_cost > 0,
        })
    enriched.sort(key=lambda x: x["gross_profit"], reverse=True)
    top_slice = enriched[:top_n]
    # "总营收" 用全菜营收 (users want total). "平均毛利率"/"总毛利" 用仅有
    # cost 菜, 避免无配方菜 (gross_profit=revenue) 污染真实毛利率.
    total_rev = sum(e["revenue"] for e in enriched)
    with_cost = [e for e in enriched if e["has_cost"]]
    total_rev_with_cost = sum(e["revenue"] for e in with_cost)
    total_profit = sum(e["gross_profit"] for e in with_cost)
    avg_margin = total_profit / total_rev_with_cost if total_rev_with_cost > 0 else 0

    top_text = "\n".join([
        f"  {i+1}. {e['name']}: 营收 ¥{e['revenue']:.2f} / 成本 ¥{e['food_cost_unit'] * e['qty']:.2f} / "
        f"毛利 ¥{e['gross_profit']:.2f} ({e['margin_rate'] * 100:.1f}%)"
        + ("" if e["has_cost"] else " [无配方数据, 成本按0估]")
        for i, e in enumerate(top_slice)
    ])
    missing_cost_count = len([e for e in enriched if not e["has_cost"]])
    missing_note = (
        f"\n\n注: {missing_cost_count} 个菜品缺配方/食材单价, 毛利按无成本估算. "
        f"录入配方后 ETL 自动重算."
        if missing_cost_count > 0 else ""
    )
    answer = (
        f"近 {days} 天菜品毛利分析:\n"
        f"- 总营收 ¥{total_rev:,.2f}, 总毛利 ¥{total_profit:,.2f}, 平均毛利率 {avg_margin * 100:.1f}%\n"
        f"- {len(with_cost)}/{len(enriched)} 菜品有完整成本数据\n\n"
        f"Top {len(top_slice)} 毛利菜品 (按绝对毛利):\n{top_text}{missing_note}"
    )

    charts = [{
        "chartType": "bar",
        "title": f"Top {len(top_slice)} 毛利菜品 (近{days}天)",
        "xAxis": {"data": [e["name"] for e in top_slice]},
        "series": [
            {"name": "营收", "type": "bar", "data": [e["revenue"] for e in top_slice]},
            {"name": "毛利", "type": "bar", "data": [e["gross_profit"] for e in top_slice]},
        ],
    }]

    return OpsAnswer(
        code="RESTAURANT_OPS_GROSS_MARGIN",
        title=f"菜品毛利分析 (近{days}天)",
        answer_text=answer,
        charts=charts,
        kpis=[
            {"title": "总营收", "value": f"¥{total_rev:,.0f}", "rawValue": total_rev},
            {"title": "总毛利", "value": f"¥{total_profit:,.0f}", "rawValue": total_profit},
            {"title": "平均毛利率", "value": f"{avg_margin * 100:.1f}%", "rawValue": avg_margin},
            {"title": "最赚菜品", "value": top_slice[0]["name"] if top_slice else "—", "rawValue": 0},
        ],
        meta={
            "window_days": days, "top_n": top_n,
            "missing_cost_count": missing_cost_count,
            "total_dishes": len(enriched),
        },
    )


async def resolve_store_margin(
    smartbi_pool, factory_id: str, days: int = 30, top_n: int = 10,
) -> OpsAnswer:
    """Per-store gross margin: fact_pos_item × fact_pos_transaction.store_id
    × dim_store.name × recipe food_cost. Connects POS bill → store → dish → cost
    for the chain-owner's core question "which store is most profitable".
    """
    async with smartbi_pool.acquire() as conn:
        await conn.execute("SELECT set_config('app.factory_id', $1, true)", factory_id)
        # Per-store per-dish aggregation — need this granularity to compute
        # cost correctly (dish-level food_cost × qty sold at each store).
        store_dish_rows = await conn.fetch(
            """
            SELECT s.store_id, s.name AS store_name,
                   p.name AS dish_name, p.normalized_name,
                   SUM(i.qty)::float AS qty,
                   SUM(i.amount)::float AS revenue,
                   COUNT(DISTINCT i.transaction_id)::int AS bills
              FROM fact_pos_item i
              JOIN fact_pos_transaction t ON t.id = i.transaction_id
              JOIN dim_product p ON p.product_id = i.product_id
              JOIN dim_store s ON s.store_id = t.store_id
             WHERE i.factory_id = $1 AND t.factory_id = $1
               AND t.date >= CURRENT_DATE - ($2::int)
             GROUP BY s.store_id, s.name, p.name, p.normalized_name
            """,
            factory_id, days,
        )

    if not store_dish_rows:
        return OpsAnswer(
            code="RESTAURANT_OPS_STORE_MARGIN",
            title=f"门店毛利分析 (近{days}天)",
            answer_text=f"近 {days} 天无 POS 销售数据, 需先上传 POS 账单.",
            charts=[], kpis=[],
            meta={"window_days": days, "no_pos_data": True},
        )

    # Lookup cretas product_types + dim_product_alias (P0-2) + agg_product_cost for food cost.
    dish_names = list({r["normalized_name"] for r in store_dish_rows})
    name_to_pk: Dict[str, str] = {}
    try:
        import asyncpg as _asyncpg
        from config import get_settings as _get_settings
        cretas = await _asyncpg.connect(_get_settings().food_kb_db_url)
        try:
            rows = await cretas.fetch(
                "SELECT id, name FROM product_types WHERE factory_id = $1 AND name = ANY($2::text[])",
                factory_id, dish_names,
            )
            for r in rows:
                name_to_pk[r["name"]] = r["id"]
            unmapped = [n for n in dish_names if n not in name_to_pk]
            if unmapped:
                try:
                    alias_rows = await cretas.fetch(
                        """SELECT pos_name, product_type_id FROM dim_product_alias
                            WHERE factory_id = $1 AND pos_name = ANY($2::text[])""",
                        factory_id, unmapped,
                    )
                    for r in alias_rows:
                        name_to_pk[r["pos_name"]] = r["product_type_id"]
                except Exception as e:
                    if "does not exist" not in str(e):
                        logger.warning(f"[store_margin] alias lookup failed: {e}")
        finally:
            await cretas.close()
    except Exception as e:
        logger.warning(f"[store_margin] cretas lookup failed: {e}")

    cost_by_pk: Dict[str, float] = {}
    if name_to_pk:
        async with smartbi_pool.acquire() as conn:
            await conn.execute("SELECT set_config('app.factory_id', $1, true)", factory_id)
            cr = await conn.fetch(
                """
                SELECT product_source_pk, food_cost::float AS c
                  FROM agg_restaurant_product_cost
                 WHERE factory_id = $1 AND product_source_pk = ANY($2::text[])
                """,
                factory_id, list(name_to_pk.values()),
            )
            cost_by_pk = {r["product_source_pk"]: r["c"] for r in cr}

    # Aggregate per store. Track revenue twice: all-dish (for display) and
    # with-cost-only (for margin rate denominator — same fix as gross-margin).
    per_store: Dict[int, Dict[str, Any]] = {}
    for r in store_dish_rows:
        pk = name_to_pk.get(r["normalized_name"])
        dish_cost = cost_by_pk.get(pk, 0) if pk else 0
        line_cost = dish_cost * r["qty"]
        s = per_store.setdefault(r["store_id"], {
            "store_id": r["store_id"], "name": r["store_name"],
            "revenue": 0.0, "revenue_with_cost": 0.0, "cost": 0.0,
            "bills": 0, "dishes": 0, "dishes_with_cost": 0,
        })
        s["revenue"] += r["revenue"]
        s["bills"] += r["bills"]
        s["dishes"] += 1
        if dish_cost > 0:
            s["revenue_with_cost"] += r["revenue"]
            s["cost"] += line_cost
            s["dishes_with_cost"] += 1

    store_list = []
    for s in per_store.values():
        s["gross_profit"] = s["revenue_with_cost"] - s["cost"]
        # marginRate only from with-cost dishes — avoid 89-97% inflation.
        s["margin_rate"] = (
            s["gross_profit"] / s["revenue_with_cost"]
            if s["revenue_with_cost"] > 0 else 0
        )
        store_list.append(s)
    store_list.sort(key=lambda x: x["gross_profit"], reverse=True)
    top_slice = store_list[:top_n]

    total_rev = sum(s["revenue"] for s in store_list)
    total_rev_with_cost = sum(s["revenue_with_cost"] for s in store_list)
    total_profit = sum(s["gross_profit"] for s in store_list)
    avg_rate = total_profit / total_rev_with_cost if total_rev_with_cost > 0 else 0

    top_text = "\n".join([
        f"  {i+1}. {s['name']}: 营收 ¥{s['revenue']:,.2f} / 毛利 ¥{s['gross_profit']:,.2f} ({s['margin_rate'] * 100:.1f}%), {s['bills']} 单"
        for i, s in enumerate(top_slice)
    ])
    answer = (
        f"近 {days} 天门店毛利对比 ({len(store_list)} 家店):\n"
        f"- 总营收 ¥{total_rev:,.2f}, 总毛利 ¥{total_profit:,.2f}, 平均毛利率 {avg_rate * 100:.1f}%\n\n"
        f"Top {len(top_slice)} 毛利门店:\n{top_text}"
    )

    charts = [{
        "chartType": "bar",
        "title": f"Top {len(top_slice)} 毛利门店",
        "xAxis": {"data": [s["name"] for s in top_slice]},
        "series": [
            {"name": "营收", "type": "bar", "data": [s["revenue"] for s in top_slice]},
            {"name": "毛利", "type": "bar", "data": [s["gross_profit"] for s in top_slice]},
        ],
    }]

    return OpsAnswer(
        code="RESTAURANT_OPS_STORE_MARGIN",
        title=f"门店毛利对比 (近{days}天)",
        answer_text=answer,
        charts=charts,
        kpis=[
            {"title": "门店数", "value": len(store_list), "rawValue": len(store_list)},
            {"title": "总营收", "value": f"¥{total_rev:,.0f}", "rawValue": total_rev},
            {"title": "总毛利", "value": f"¥{total_profit:,.0f}", "rawValue": total_profit},
            {"title": "最赚门店", "value": top_slice[0]["name"] if top_slice else "—", "rawValue": 0},
        ],
        meta={
            "window_days": days, "store_count": len(store_list),
            "totalRevenue": total_rev, "totalRevenueWithCost": total_rev_with_cost,
            "totalProfit": total_profit, "avgRate": avg_rate,
            "stores": [
                {"storeId": s["store_id"], "name": s["name"],
                 "revenue": s["revenue"],
                 "revenueWithCost": s["revenue_with_cost"],
                 "grossProfit": s["gross_profit"],
                 "marginRate": s["margin_rate"], "bills": s["bills"],
                 "dishesWithCost": s["dishes_with_cost"], "totalDishes": s["dishes"]}
                for s in store_list
            ],
        },
    )


_RESOLVERS = {
    "RESTAURANT_OPS_WASTAGE_TOP": resolve_wastage_top,
    "RESTAURANT_OPS_STOCK_SHORTAGE": resolve_stock_shortage,
    "RESTAURANT_OPS_RECIPE_COST": resolve_recipe_cost,
    "RESTAURANT_OPS_REQUISITION_TREND": resolve_requisition_trend,
    "RESTAURANT_OPS_GROSS_MARGIN": resolve_gross_margin,
    "RESTAURANT_OPS_STORE_MARGIN": resolve_store_margin,
}


async def resolve_by_code(
    code: str, smartbi_pool, factory_id: str, **kwargs
) -> Optional[OpsAnswer]:
    """Dispatch to the right resolver. Returns None if code unknown."""
    resolver = _RESOLVERS.get(code)
    if resolver is None:
        return None
    return await resolver(smartbi_pool, factory_id, **kwargs)
