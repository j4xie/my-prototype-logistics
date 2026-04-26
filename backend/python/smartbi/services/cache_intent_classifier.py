"""Phase 6 P1 (Apr 26 2026): follow-up classifier — reject cache when query
intent diverges from matched template's domain.

Background: S3 270-followup audit caught case xmx-fu-29-2 "单店 vs 区域同业
差距通常多少" matching cache template "payment_method_mix" → answer was
"支付类型 Top 10:1481792.15 独占 99.2%..." which is completely unrelated. The
cache router fired without checking semantic alignment between query and
template.

afb9a5e71 fixed one symptom (top_n_by_dim with numeric-label dims). This
module is the systemic fix: at the cache-route boundary, classify both
sides and reject when mismatched. Reject → fall through to LLM, which has
the parent context (via v2 conversation memory) to do better than a
mis-routed cache.

Design:
- TEMPLATE_DOMAIN: hand-curated mapping of template_code → domain class
  ('dish' / 'store' / 'payment' / 'channel' / etc).
- classify_query_domain: re-uses query_router._QUERY_DIM_HINTS keywords
  to detect the most likely query domain.
- should_reject_cache: returns True when query_domain is detected, template
  has a known domain, and they differ.

Conservative: returns False (allow cache) when either side is unknown — we
prefer false negatives (let cache serve a marginal answer) over false
positives (force expensive LLM when cache was actually fine).
"""
from __future__ import annotations

import logging
from typing import Optional

logger = logging.getLogger(__name__)


# Hand-curated mapping. Domains intentionally coarse — finer granularity gives
# more false positives. Templates not listed (or with multiple plausible
# domains) get None and bypass the check entirely.
TEMPLATE_DOMAIN: dict[str, str] = {
    # dish / 菜品
    'dish_sales_top_n': 'dish',
    'dish_slow_movers': 'dish',
    'dish_category_breakdown': 'dish',
    'dish_by_table_type': 'dish',
    'combo_usage_rate': 'dish',
    'pareto_analysis': 'dish',
    # store / 门店
    'store_performance': 'store',
    'store_customer_stratification': 'store',
    # cross store↔dish — leave as None (multi-domain)
    # 'dish_store_drill': None,
    # channel
    'channel_analysis': 'channel',
    'groupon_channel_breakdown': 'channel',
    # payment
    'payment_method_mix': 'payment',
    # time
    'time_slot_revenue': 'time',
    'weekday_weekend_pattern': 'time',
    'monthly_trend': 'time',
    'monthly_anomaly': 'time',
    'period_comparison_trend': 'time',
    'kitchen_dispatch_heatmap': 'time',
    'dish_time_slot_matrix': 'time',
    # member
    'member_consumption': 'member',
    'member_deep_analytics': 'member',
    'stored_value_card_consumption': 'member',
    # finance
    'profit_loss_statement': 'finance',
    'revenue_management_report': 'finance',
    'refund_analysis': 'finance',
    # review
    'reviews_sentiment_summary': 'review',
    # ops
    'staff_performance': 'staff',
    'anomaly_detection': 'anomaly',
    'reverse_checkout_stats': 'refund',
    'promotion_impact': 'promotion',
    'business_overview_summary': 'overview',
    'category_distribution': 'category',
    'purchase_inventory_inflow': 'inventory',
    'table_type_comparison': 'store',
    # generic — top_n_by_dim is on purpose multi-domain (dim picked at runtime)
    # 'top_n_by_dim': None,
}


# Query → domain keywords. Mirrors query_router._QUERY_DIM_HINTS plus a few
# domain-specific hints for finance/review/staff that aren't in the dim hints.
QUERY_DOMAIN_HINTS: dict[str, list[str]] = {
    'dish': ['菜品', '商品', '产品', '菜', '单品', '主推', '畅销', '爆款', '滞销', '慢销'],
    'store': ['门店', '店', '店铺', '分店', '哪家店', '哪几家', '单店'],
    'channel': ['渠道', '美团', '饿了么', '抖音', '点评', '外卖渠道', '堂食外卖'],
    'time': ['时段', '小时', '早餐', '午餐', '晚餐', '宵夜', '午晚市', '周末', '工作日',
             '月度', '月份', '同比', '环比', '趋势', '周', '日'],
    'payment': ['支付', '付款', '微信', '支付宝', '现金'],
    'member': ['会员', '客户', '用户', 'VIP', '储值', '充值', '复购'],
    'finance': ['利润', '毛利', '净利', '营收', '收入', '成本', '费用', '财报', '损益'],
    'review': ['评价', '评论', '口碑', '差评', '好评', '星级', '评分'],
    'staff': ['员工', '服务员', '收银员', '厨师', '人效', '人均产出'],
    'refund': ['退款', '退单', '撤单', '反结算', '取消'],
    'promotion': ['促销', '优惠', '券', '满减', '打折', '活动'],
    'category': ['品类', '类别'],  # narrower than 'dish'
    'inventory': ['库存', '进货', '采购', '出库', '入库'],
    'anomaly': ['异常', '突变', '波动'],
}


def classify_query_domain(query: str) -> Optional[str]:
    """Detect the most likely domain of a query. Returns None if no hints
    match (caller should NOT reject cache — uncertain).

    First-match-wins by iteration order — finance/review/staff before more
    generic 'time' (so "上月利润" matches finance not time).
    """
    if not query:
        return None
    q = query.lower()
    # Order matters — more specific domains first.
    priority_order = [
        'finance', 'review', 'staff', 'refund', 'promotion', 'inventory',
        'anomaly', 'payment', 'member', 'channel', 'category', 'dish',
        'store', 'time',
    ]
    for domain in priority_order:
        hints = QUERY_DOMAIN_HINTS.get(domain, [])
        if any(h in q for h in hints):
            return domain
    return None


def should_reject_cache(query: str, template_code: str) -> bool:
    """Return True iff the query's detected domain conflicts with the
    matched template's domain.

    Conservative — returns False (allow cache) when:
    - Query domain undetectable (no hint keywords)
    - Template not in TEMPLATE_DOMAIN (unknown / multi-domain like top_n_by_dim)
    - Domains agree

    Only rejects when both sides are known and DIFFERENT.
    """
    if not query or not template_code:
        return False
    template_domain = TEMPLATE_DOMAIN.get(template_code)
    if template_domain is None:
        return False  # unknown / multi-domain template — let it through
    query_domain = classify_query_domain(query)
    if query_domain is None:
        return False  # query domain undetectable — don't risk false positive
    if query_domain == template_domain:
        return False  # aligned, allow cache
    # Genuine mismatch — reject.
    logger.info(
        f"[intent-classifier] cache REJECTED: "
        f"query_domain={query_domain} vs template_domain={template_domain} "
        f"(template={template_code})"
    )
    return True
