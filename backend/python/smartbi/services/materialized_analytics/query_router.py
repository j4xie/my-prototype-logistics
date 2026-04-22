"""Map natural-language user query to a materialized template code.

Uses keyword patterns per template. First high-confidence match wins.
No LLM — deterministic, fast (<1ms).

Future: swap in semantic embedding match via pgvector (W3).
"""
from __future__ import annotations

import logging
from typing import Dict, List, Optional, Tuple

logger = logging.getLogger(__name__)


# Each pattern: tuple of (must_contain_any_of_these) — query must contain AT LEAST ONE keyword from EACH group.
# Order matters: first match wins.
# Format: [(template_code, [[keywords_group_1], [keywords_group_2], ...]), ...]
_PATTERNS: List[Tuple[str, List[List[str]]]] = [
    # === Restaurant-specific (higher priority, more specific) ===
    (
        "dish_slow_movers",
        [["菜品", "商品", "产品"], ["滞销", "卖得不好", "不好卖", "末位", "末尾", "最差", "最少", "低销"]],
    ),
    (
        "dish_sales_top_n",
        [["菜品", "商品", "产品"], ["销量", "销售", "卖", "热销", "畅销", "排名", "Top", "最多", "最高"]],
    ),
    (
        "dish_time_slot_matrix",
        [["菜品", "商品"], ["时段", "早餐", "午餐", "晚餐", "宵夜", "时间", "小时", "早晚"]],
    ),
    (
        "dish_category_breakdown",
        [["分类", "品类", "类别", "饮品", "主食", "小吃", "啤酒", "套餐"], ["销量", "销售", "占比", "份额", "结构"]],
    ),
    # dish_by_table_type must precede table_type_comparison — both match 包厢/大厅/外卖
    # keywords, but when the user also mentions 菜品/点单/点菜/偏好, dish drill-down is
    # the right answer. Router takes the first pattern that matches.
    (
        "dish_by_table_type",
        # "包厢客人点什么" / "大厅点单菜品" / "外卖菜品和堂食差什么"
        [["包厢", "大厅", "堂食", "外卖", "桌位", "散客"],
         ["菜品", "商品", "点单", "点菜", "点什么", "偏好", "爱点"]],
    ),
    (
        "table_type_comparison",
        [["包厢", "大厅", "堂食", "外卖", "桌位", "就餐", "散客"], ["对比", "比较", "分析", "销售", "订单", "客单价", "人均", "数量"]],
    ),
    (
        "staff_performance",
        [["服务员", "销售员", "收银员", "员工", "店员"], ["业绩", "排名", "销售", "Top", "绩效", "表现"]],
    ),
    (
        "time_slot_revenue",
        [["时段", "早晨", "上午", "下午", "晚上", "早餐", "午餐", "晚餐", "宵夜", "小时"], ["营业额", "营收", "销售额", "收入", "门店", "区域", "地区"]],
    ),
    (
        "channel_analysis",
        [["外卖", "堂食", "美团", "饿了么", "京东", "抖音", "渠道", "来源"], ["订单", "销售", "营收", "占比", "对比", "分析"]],
    ),
    (
        "member_consumption",
        [["会员", "会员卡", "储值卡"], ["消费", "金额", "频次", "次数", "支付"]],
    ),
    (
        "refund_analysis",
        [["退菜", "退单", "撤单", "损耗", "损失"], ["分析", "统计", "次数", "多少"]],
    ),
    (
        "promotion_impact",
        [["代金券", "优惠券", "折扣", "促销", "优惠"], ["使用", "占比", "金额", "影响", "分析"]],
    ),
    (
        "weekday_weekend_pattern",
        [["周末", "工作日", "周一", "周日", "平日"], ["对比", "差异", "差别", "分析", "营业额", "销售"]],
    ),
    # === W3 餐饮常见 Q-A 补充 (Apr 22 2026) ===
    # Note: dish_by_table_type is placed above, ahead of table_type_comparison.
    (
        "combo_usage_rate",
        # "套餐使用率" / "有多少客人点套餐" / "套餐销量"
        [["套餐"], ["使用率", "占比", "多少", "分析", "销量", "使用", "点"]],
    ),
    (
        "reverse_checkout_stats",
        # "反结账统计" / "反结账次数" / "哪些单反结了"
        [["反结账", "反结", "已反结"], ["统计", "次数", "多少", "分析", "门店", "哪些"]],
    ),
    (
        "store_customer_stratification",
        # "门店客单人数分层" / "几人桌占比" / "1 人桌多少"
        [["门店", "客单", "几人", "人数"], ["分层", "占比", "分布", "分析", "桌"]],
    ),
    # === Generic W1 templates (lower priority, broader match) ===
    (
        "monthly_trend",
        [["趋势", "走势", "变化", "增长"], ["月度", "日", "周", "时间", "趋势"]],
    ),
    (
        "pareto_analysis",
        [["80", "20", "帕累托", "Pareto", "80/20", "贡献", "头部"], ["分析", "占比", "集中"]],
    ),
    (
        "anomaly_detection",
        [["异常", "异常值", "离群", "偏离", "突变"], ["检测", "发现", "找出", "分析"]],
    ),
    (
        "top_n_by_dim",
        [["Top", "排名", "头部", "最高", "最多", "前", "第一", "最大"], ["门店", "区域", "分类"]],
    ),
    (
        "category_distribution",
        [["占比", "份额", "结构", "构成", "分布"], ["营业额", "销售额", "收入"]],
    ),
]


def match_template(query: str) -> Optional[str]:
    """Try to match user query to a template code.

    Returns template_code if matched, None otherwise.
    All groups must have ≥1 keyword hit in query.
    """
    if not query or not isinstance(query, str):
        return None
    q = query.lower()  # case-insensitive (works for Chinese too — pass-through)
    for code, groups in _PATTERNS:
        hit = True
        for group in groups:
            if not any(kw.lower() in q for kw in group):
                hit = False
                break
        if hit:
            logger.info(f"[query-router] matched '{query[:50]}' → {code}")
            return code
    logger.debug(f"[query-router] no match for '{query[:50]}'")
    return None


def format_cached_as_sse(template_result: Dict, query: str) -> Dict:
    """Format a cached template result as a response dict suitable for SSE streaming.

    Returns dict with keys:
      - answer: str (insight_text + context)
      - charts: list (chart_config wrapped as [{type, title, option}])
      - kpis: dict
      - source: 'materialized_cache'
      - template_code: str
    """
    code = template_result.get("code", "")
    title = template_result.get("title", "")
    insight = template_result.get("insight_text") or ""
    chart_config = template_result.get("chart_config")
    kpis = template_result.get("kpis") or {}

    # Build a rich answer that references the template + data
    answer = f"## {title}\n\n{insight}\n\n"
    if kpis:
        answer += "**关键指标:**\n"
        for k, v in list(kpis.items())[:8]:
            if isinstance(v, (int, float)):
                answer += f"- {k}: {v:,.2f}\n" if isinstance(v, float) else f"- {k}: {v:,}\n"
            else:
                answer += f"- {k}: {v}\n"

    charts = []
    if chart_config and isinstance(chart_config, dict):
        charts.append({
            "type": chart_config.get("type") or "bar",
            "title": title,
            "option": chart_config,
        })

    return {
        "answer": answer,
        "charts": charts,
        "kpis": kpis,
        "source": "materialized_cache",
        "template_code": code,
    }
