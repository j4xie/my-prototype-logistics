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
         ["菜品", "商品", "点单", "点菜", "点什么", "偏好", "爱点", "点的菜", "点什么菜", "吃什么"]],
    ),
    # revenue_management_report must precede table_type_comparison — 堂食外卖 +
    # 午晚市/时段 context means the user wants the composite report, not just
    # the channel comparison.
    (
        "revenue_management_report",
        # "收入管理报表" / "堂食外卖午晚市" / "渠道时段营收"
        [["收入管理", "堂食外卖", "堂食午晚", "外卖午晚", "渠道时段", "复合报表",
          "堂食和外卖", "外卖和堂食"],
         ["报表", "分析", "占比", "分布", "对比", "午晚市", "午市", "晚市"]],
    ),
    # channel_analysis must precede table_type_comparison. Both can match "外卖
    # + 分析" queries, but when user says 渠道/来源 or a platform name (美团/饿了
    # 么/京东/抖音) they mean channel breakdown, not dine-in table comparison.
    (
        "channel_analysis",
        # Higher-priority channel match — fires first when user explicitly
        # mentions 渠道/来源 or a platform name. Prevents table_type_comparison
        # from stealing the query when user meant channel breakdown.
        [["渠道", "来源", "美团", "饿了么", "京东", "抖音"],
         ["分析", "占比", "对比", "销售", "订单", "营收"]],
    ),
    (
        "table_type_comparison",
        # Require at least one true dine-in keyword (包厢/大厅/堂食/桌位/就餐/散客).
        # Removed 外卖 from group 1 — it ambiguously matched channel queries.
        # Pure 外卖 questions still route via channel_analysis below.
        [["包厢", "大厅", "堂食", "桌位", "就餐", "散客"],
         ["对比", "比较", "分析", "销售", "订单", "客单价", "人均", "数量"]],
    ),
    (
        "staff_performance",
        [["服务员", "销售员", "收银员", "员工", "店员"], ["业绩", "排名", "销售", "Top", "绩效", "表现"]],
    ),
    (
        "time_slot_revenue",
        [["时段", "早晨", "上午", "下午", "晚上", "早餐", "午餐", "晚餐", "宵夜", "小时"], ["营业额", "营收", "销售额", "收入", "门店", "区域", "地区"]],
    ),
    # groupon_channel_breakdown must precede channel_analysis — when user mentions
    # multiple groupon-specific platforms (点评 + 美团 + 抖音) together, they want
    # groupon breakdown not generic channel analysis.
    (
        "groupon_channel_breakdown",
        [["团购", "团购券", "券使用", "点评", "美团"],
         ["三端", "点评", "美团", "抖音", "占比", "对比", "分析"]],
    ),
    (
        "channel_analysis",
        [["外卖", "堂食", "美团", "饿了么", "京东", "抖音", "渠道", "来源"], ["订单", "销售", "营收", "占比", "对比", "分析"]],
    ),
    # stored_value_card_consumption must precede member_consumption — the latter
    # lists 储值卡 in its keywords too, so ordering matters.
    (
        "stored_value_card_consumption",
        [["储值卡", "预付卡"], ["消费", "流水", "金额", "使用", "报表", "分析", "多少"]],
    ),
    (
        "member_consumption",
        [["会员", "会员卡"], ["消费", "金额", "频次", "次数", "支付"]],
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
    # W3 财务端补充: profit_loss_statement (not in conflict with earlier patterns)
    (
        "profit_loss_statement",
        # "利润表" / "营收结构" / "毛利" / "损益"
        [["利润", "营收结构", "毛利", "净利", "损益", "应收", "实收"], ["报表", "结构", "分析", "多少", "合计", "对比"]],
    ),
    # W3 进销存 (采购入库侧)
    (
        "purchase_inventory_inflow",
        # "采购入库" / "进销存" / "供应商分析"
        [["采购", "进销存", "入库", "供应商", "原料"], ["分析", "多少", "报表", "金额", "Top", "占比"]],
    ),
    # W3 营业概况报表
    (
        "business_overview_summary",
        # "营业概况" / "月度汇总" / "门店日报"
        [["营业概况", "营业汇总", "月度", "月报", "汇总", "概况", "日报"],
         ["报表", "分析", "多少", "总", "合计", "峰值", "最高", "最低"]],
    ),
    # W3 会员深度 — must precede member_consumption / stored_value_card_consumption
    # which look at order-level 会员卡/储值卡 columns. member_deep is triggered
    # by member-level exports with 卡号/等级/余额 — more specific intent.
    (
        "member_deep_analytics",
        # "会员卡数据" / "会员等级分布" / "会员余额"
        [["会员卡", "会员数据", "会员等级", "卡余额", "储值会员", "会员充值"],
         ["分布", "数据", "等级", "余额", "多少", "统计", "分析"]],
    ),
    # W4 专项报表 (Apr 22 2026)
    (
        "reviews_sentiment_summary",
        # "评价/星级/投诉" queries
        [["评价", "大众点评", "美团点评", "口碑", "星级", "评分", "差评", "好评", "投诉"],
         ["分析", "分布", "多少", "统计", "平均", "率", "比例"]],
    ),
    (
        "payment_method_mix",
        # "付款方式/支付方式占比"
        [["付款方式", "支付方式", "付款", "收款", "现金", "移动支付"],
         ["占比", "分布", "分析", "多少", "对比"]],
    ),
    (
        "kitchen_dispatch_heatmap",
        # "传菜/档口/厨房"
        [["传菜", "档口", "厨房", "上什", "后厨"],
         ["分析", "多少", "分布", "Top", "报表", "份"]],
    ),
    (
        "period_comparison_trend",
        # "月度对比/环比/同比"
        [["环比", "同比", "月度", "上个月", "本月", "上月", "近月", "增长", "涨跌", "趋势"],
         ["多少", "分析", "对比", "变化", "涨", "跌", "增长", "营业额"]],
    ),
    # W4 quality-audit new templates
    (
        "monthly_anomaly",
        # "哪个月营业额掉了/暴跌/异常"
        [["月", "异常", "暴跌", "暴涨", "突降", "突增", "掉了", "大跌", "大涨"],
         ["分析", "多少", "检测", "哪个", "哪几个", "波动", "异常"]],
    ),
    (
        "dish_store_drill",
        # W4-Q10: match "X哪家店卖得最多" where X is a dish name. Group 1 accepts
        # either an explicit 菜/菜品 keyword OR a "卖/点得最多" phrase (implies user
        # named a specific dish). Group 2 requires store reference. Placed before
        # top_n_by_dim so "米饭哪家门店卖得最多" routes here, not to generic top-N.
        [["菜品", "哪个菜", "什么菜", "菜",
          "卖得最多", "卖得最好", "卖最多", "卖最好", "点最多", "点得最多"],
         ["门店", "店铺", "哪家店", "哪家分店", "店"]],
    ),
    # Note: revenue_management_report / stored_value_card_consumption /
    # groupon_channel_breakdown are placed above, ahead of their respective
    # broader siblings (table_type_comparison / member_consumption / channel_analysis).
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


# W4-Q4 / W4-Q10: two modifier classes with different severity.
#
# HARD modifiers: cached template is guaranteed wrong. Pre-empt the router
#   → immediately LLM fallback. User said "exclude", "why", "next" — no
#   cached aggregation can honor that.
# SOFT modifiers: no template match after all. Log LLM fallback reason.
#   User said "which store" — if dish_store_drill matched, serve it; else LLM.
_HARD_MODIFIERS = (
    # Exclusion / filter — no template can re-filter cache results
    "排除", "除了", "不算", "去掉", "过滤", "剔除", "忽略",
    # Narrowing — too specific for pre-computed cache
    "只看", "只要", "只统计", "单独", "特定",
    # Why / cause — no causal-inference template
    "为什么", "为啥", "原因", "归因", "解释",
    # Pronominal reference / nth — template returns Top N but can't jump
    "第二", "第三", "下一个", "接下来", "还有哪些",
    # Year-over-year — no template has historical year data
    "对比去年", "vs去年", "比去年",
    # Pronominal reference — resolved only with conversation history (Fix 2)
    "这个月", "那个月", "上个月", "这家", "那家", "这个", "那个",
)

_SOFT_MODIFIERS = (
    # Drill-down by extra dim — dish_store_drill handles some cases
    "哪家店", "哪个门店", "哪家分店", "哪家铺子",
)


# Apr 23 2026: explicit time limiters. When the user mentions a specific
# time window ("8月", "2025-08", "昨天", "近7天"), pre-computed templates
# that return upload-total aggregates give the wrong answer — the answer
# needs to be filtered to that window. Route to LLM fallback so the
# C1/C2/C3 time-scoped aggregate path in chat.py fires.
_TIME_LIMITER_KEYWORDS = (
    # Single-char month form: 1月, 2月 ... 12月 matched via regex below,
    # not this tuple. Keep explicit phrases here:
    "本月", "本周", "今日", "今天", "昨天", "前天", "当天",
    "上月", "上周", "近一周", "近一月", "近30天", "近7天", "近3天",
    "最近一周", "最近一月", "最近30天", "最近7天", "最近3天",
    "最后两天", "最后一天", "月末", "月初", "周末",
)

# Regex: 年份(2024/2025) 或 月份(1月-12月) 或 日期(YYYY-MM-DD)
import re as _re
_TIME_LIMITER_RE = _re.compile(
    r"(?:"
    r"20\d{2}[-年]\d{1,2}|"          # 2025-08 / 2025年8
    r"(?:^|\s|、|，|,)"       # boundary
    r"(?:1[0-2]|[1-9])"               # 1-12
    r"月"                             # 月字
    r"|"
    r"\d{1,2}月\d{1,2}日"             # 8月15日
    r")"
)


def _has_time_limiter(query: str) -> bool:
    if any(kw in query for kw in _TIME_LIMITER_KEYWORDS):
        return True
    if _TIME_LIMITER_RE.search(query):
        return True
    return False


# Fix 4 (Apr 23 2026): relational drill-down queries. User references a
# ranked entity from a previous template ("第一名菜品在哪家店卖得最好",
# "Top 1 服务员主要卖什么菜", "外卖占比最低的门店是哪家") and asks for
# cross-dimensional analysis. No single template covers this — need LLM
# with conversation history (Fix 2) to resolve the anaphor and do the
# drill. Without this routing, template patterns greedily match the dim
# keyword (菜品/服务员/门店) and return full-upload Top-N, ignoring the
# "which store/dish/etc." part of the query.
_RELATIONAL_DRILL_RE = _re.compile(
    r"(?:"
    # Anaphoric rank prefix at start of query + cross-dim interrogative
    r"^(?:第[一二三四五六七八九十]名|Top\s*\d+)"
    r".*?(?:哪家|哪款|哪种|哪个|什么菜|主要卖|在哪|是哪|卖.*得最)"
    r"|"
    # "最X的{dim} 是哪家/在哪家" — per-entity min/max that no template stores
    r"最(?:高|低|多|少|好|差)的(?:门店|店|员工|服务员|分店|铺子|区域)"
    r".*?(?:是哪家|在哪家|哪家|是哪个|是哪)"
    r")"
)


def _has_relational_drill(query: str) -> bool:
    return bool(_RELATIONAL_DRILL_RE.search(query))


def _has_hard_modifier(query: str) -> bool:
    q = query.lower()
    if any(kw.lower() in q for kw in _HARD_MODIFIERS):
        return True
    if _has_time_limiter(query):
        return True
    return _has_relational_drill(query)


def _has_soft_modifier(query: str) -> bool:
    q = query.lower()
    return any(kw.lower() in q for kw in _SOFT_MODIFIERS)


def match_template(query: str) -> Optional[str]:
    """Try to match user query to a template code.

    Returns template_code if matched, None otherwise.

    Order:
      1. Check HARD modifiers (排除/为什么/第二) → return None immediately.
         Even if a template appears to match, the user's modifier guarantees
         the cached result is wrong.
      2. Check patterns in priority order. First match wins.
      3. After loop, if no match AND SOFT modifier present, also return None
         with explicit log.
    """
    if not query or not isinstance(query, str):
        return None
    if _has_hard_modifier(query):
        logger.info(f"[query-router] hard modifier in '{query[:50]}' → LLM fallback")
        return None
    q = query.lower()
    for code, groups in _PATTERNS:
        hit = True
        for group in groups:
            if not any(kw.lower() in q for kw in group):
                hit = False
                break
        if hit:
            logger.info(f"[query-router] matched '{query[:50]}' → {code}")
            return code
    if _has_soft_modifier(query):
        logger.info(f"[query-router] no template + soft modifier in '{query[:50]}' → LLM")
        return None
    logger.debug(f"[query-router] no match for '{query[:50]}'")
    return None


# Apr 23 2026 — KPI key → Chinese label map. Templates emit technical keys
# (peak_month, worst_mom_delta_pct, combo_orders) that confuse non-technical
# users. This map translates them to readable labels at display time.
# Unknown keys fall back to humanized-snake-case. Unit hints are appended
# when present.
_KPI_LABEL_MAP: Dict[str, str] = {
    # Monthly anomaly
    "peak_month": "峰值月份",
    "trough_month": "谷值月份",
    "worst_month": "最差月份",
    "best_month": "最佳月份",
    "anomaly_count": "异常月数",
    "worst_mom_delta_pct": "最大波动率",
    "best_mom_delta_pct": "最大涨幅",
    "avg_month_revenue": "月均营业额",
    "peak_revenue": "峰值营业额",
    "trough_revenue": "谷值营业额",
    # Dish sales Top N
    "top_dish_name": "冠军菜品",
    "top_dish_qty": "冠军销量",
    "top_dish_revenue": "冠军营业额",
    "distinct_dishes": "菜品总数",
    "second_dish_name": "亚军菜品",
    "second_dish_qty": "亚军销量",
    # Staff performance
    "role_type": "角色类型",
    "top_staff": "Top1 员工",
    "top_revenue": "Top1 销售额",
    "staff_count": "员工人数",
    "avg_per_staff": "人均销售额",
    # Combo usage
    "combo_orders": "含套餐订单",
    "total_orders": "总订单数",
    "combo_rate": "套餐使用率",
    "combo_usage_rate": "套餐使用率",
    "top_combo_name": "Top1 套餐",
    "top_combo_qty": "Top1 套餐销量",
    "top_combo_revenue": "Top1 套餐营收",
    # Reverse checkout
    "reverse_count": "反结账数",
    "reverse_share_pct": "反结账占比",
    "top_store_reverse": "高发门店",
    # Channel analysis
    "top_channel": "主导渠道",
    "dine_in_share": "堂食占比",
    "takeaway_share": "外卖占比",
    "takeaway_total": "外卖订单数",
    "dine_in_total": "堂食订单数",
    "channel_count": "渠道数量",
    "avg_dine_in": "堂食客单价",
    "avg_takeaway": "外卖客单价",
    "dine_in_avg_price": "堂食客单价",
    "takeaway_avg_price": "外卖客单价",
    # Dish×store drill
    "top_dish": "头名菜品",
    "dominant_store": "主导门店",
    "top_dish_top_store": "冠军菜主销门店",
    "top_dish_top_store_pct": "主销集中度",
    # Period comparison
    "month_count": "覆盖月数",
    "latest_month": "最新月",
    "latest_revenue": "最新月营业额",
    "latest_mom_delta_pct": "最新环比",
    "dod_delta_pct": "日环比",
    # Table type comparison
    "avg_hall_spend": "大厅客单",
    "avg_vip_spend": "包厢客单",
    "avg_takeaway_spend": "外卖客单",
    "dominant_type": "主导类型",
    # Time slot revenue
    "peak_slot": "营业高峰时段",
    "peak_area": "高峰区域",
    # Weekday/weekend
    "weekday_avg_order": "工作日客单",
    "weekend_avg_order": "周末客单",
    "delta_pct": "差异百分比",
    "weekend_share_pct": "周末占比",
    # Payment method
    "top_payment": "Top1 付款方式",
    "top_payment_share": "Top1 占比",
    "total_payment": "付款合计",
    "payment_method_count": "付款方式数",
    # Stored value card
    "card_orders": "储值卡订单",
    "card_revenue": "储值卡收入",
    "card_share_pct": "储值卡占比",
    # Member consumption
    "member_revenue": "会员营收",
    "member_orders": "会员订单",
    "member_share_pct": "会员占比",
    "avg_spend": "会员人均",
    # Groupon / promotion
    "groupon_revenue": "团购营收",
    "groupon_orders": "团购订单",
    "promotion_total": "促销总额",
    "coupon_total": "代金券总额",
    # Reviews sentiment
    "avg_rating": "平均评分",
    "positive_share_pct": "好评率",
    "negative_share_pct": "差评率",
    "complaint_count": "投诉数",
    # Kitchen dispatch
    "top_kitchen_station": "主档口",
    # Business overview
    "total_revenue": "总营业额",
    "total_orders_all": "总订单量",
    "avg_daily_revenue": "日均营业额",
    # Domain-agnostic generic
    "count": "数量",
    "sum": "合计",
    "avg": "均值",
    "max": "最大",
    "min": "最小",
}

# Unit suffix per key. Empty string means no unit. Percentage keys (ending
# in _pct / _rate / _share) automatically get "%" appended.
_KPI_UNIT_MAP: Dict[str, str] = {
    "peak_revenue": " 元",
    "trough_revenue": " 元",
    "avg_month_revenue": " 元",
    "top_dish_qty": " 份",
    "top_dish_revenue": " 元",
    "distinct_dishes": " 个",
    "top_revenue": " 元",
    "staff_count": " 位",
    "avg_per_staff": " 元",
    "combo_orders": " 单",
    "total_orders": " 单",
    "top_combo_qty": " 份",
    "top_combo_revenue": " 元",
    "reverse_count": " 笔",
    "avg_dine_in": " 元",
    "avg_takeaway": " 元",
    "dine_in_avg_price": " 元",
    "takeaway_avg_price": " 元",
    "takeaway_total": " 单",
    "dine_in_total": " 单",
    "channel_count": " 个",
    "latest_revenue": " 元",
    "avg_hall_spend": " 元",
    "avg_vip_spend": " 元",
    "avg_takeaway_spend": " 元",
    "weekday_avg_order": " 元",
    "weekend_avg_order": " 元",
    "total_payment": " 元",
    "payment_method_count": " 种",
    "card_orders": " 单",
    "card_revenue": " 元",
    "member_revenue": " 元",
    "member_orders": " 单",
    "avg_spend": " 元",
    "groupon_revenue": " 元",
    "groupon_orders": " 单",
    "promotion_total": " 元",
    "coupon_total": " 元",
    "complaint_count": " 条",
    "total_revenue": " 元",
    "total_orders_all": " 单",
    "avg_daily_revenue": " 元",
    "anomaly_count": " 个",
    "month_count": " 个",
}


def _humanize_kpi_key(key: str) -> str:
    """Fallback humanization when key isn't in _KPI_LABEL_MAP.
    Snake_case → Space Separated, with a couple common word swaps."""
    parts = key.replace("_", " ").split()
    replacements = {
        "pct": "占比", "rate": "率", "share": "份额", "count": "数",
        "avg": "均值", "total": "合计", "top": "Top",
    }
    return " ".join(replacements.get(p.lower(), p) for p in parts)


def _fmt_kpi_value(key: str, value: Any) -> str:
    """Format a single KPI value with unit + label.

    Rules:
      - Floats render as comma-separated with 2 decimals. If the key looks
        like a percentage (_pct / _rate / _share), append '%'.
      - Integers render as comma-separated.
      - Strings pass through.
      - Explicit unit in _KPI_UNIT_MAP wins over auto-percent.
    """
    if value is None:
        return "—"
    is_pct = key.endswith("_pct") or key.endswith("_rate") or key.endswith("_share_pct")
    unit = _KPI_UNIT_MAP.get(key, "")
    if not unit and is_pct:
        unit = "%"
    if isinstance(value, bool):
        return "是" if value else "否"
    if isinstance(value, float):
        # Percentages usually come as 0-100 range from templates
        return f"{value:,.2f}{unit}"
    if isinstance(value, int):
        return f"{value:,}{unit}"
    return f"{value}{unit}" if unit else str(value)


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
            label = _KPI_LABEL_MAP.get(k) or _humanize_kpi_key(k)
            answer += f"- **{label}**: {_fmt_kpi_value(k, v)}\n"

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
