"""Industry benchmarks extracted from 《2025中国餐饮连锁化发展白皮书》(美团/中国连锁经营协会).

Hardcoded constants — update annually when a new white-paper drops.
Used by templates to add industry-context footers to their insights.
"""
from __future__ import annotations

from typing import Dict

# Macro market
MARKET_SIZE_TRILLION_CNY_2024 = 5.5          # 2024 中国餐饮市场规模 5.5 万亿元
CHAIN_RATE_PCT_2024 = 23.0                   # 连锁化率 23%
CHAIN_RATE_YOY_PP_2024 = 0.0                 # 小幅提升 (paper lists as "进一步提升")

# Price trend (堂食)
DINE_IN_AVG_PRICE_YOY_PCT_2024 = -10.2       # 堂食客单价同比 -10.2%
DINE_IN_ORDER_QTY_YOY_PCT_2024 = 15.4        # 人均堂食订单量同比 +15.4%

# Online channel growth
ONLINE_GROWTH_OUTPERFORMS_OVERALL = True     # 线上增速持续高于整体
COUNTY_LEVEL_REV_YOY_PCT_2024 = 19.6         # 县域餐饮消费额同比 +19.6%
COUNTY_LEVEL_ORDERS_YOY_PCT_2024 = 24.1

# Chain scale distribution (brand count buckets as % of overall stores, 2024)
BRAND_SCALE_SHARE_PCT_2024: Dict[str, float] = {
    "11-100 家": 8.4,
    "101-500 家": 5.0,     # (paper implies; use conservative proxy)
    "501-1000 家": 2.0,    # 增速 93.6% — fastest growing bucket
    "1001-5000 家": 3.5,
    "5001-10000 家": 1.5,
}

# 点评 ranking thresholds (from 必吃榜.docx + 点评榜单规则.docx)
QUALITY_RANKING_MIN_STAR = 4.0               # 好评/口味/环境/服务榜 最低星级
QUALITY_RANKING_MIN_REVIEWS = 50             # 最小评价数 (高线城市)
POPULAR_RANKING_MIN_STAR = 3.5               # 热门/销量/打卡榜 最低星级
MUST_EAT_TASTE_THRESHOLD = 4.5               # 必吃榜 口味分 参考线

# 黑珍珠 candidate — 3-钻级 approx (derived from 黑珍珠.docx rules)
BLACK_PEARL_MIN_STAR = 4.7
BLACK_PEARL_MIN_TASTE = 4.8
BLACK_PEARL_MIN_REVIEWS = 200


def industry_footer_short() -> str:
    """Short one-line industry footer to append at end of template insights."""
    return (
        f"（参考:2024 行业规模 {MARKET_SIZE_TRILLION_CNY_2024} 万亿元,"
        f"连锁化率 {CHAIN_RATE_PCT_2024:.0f}%,"
        f"堂食客单价 YoY {DINE_IN_AVG_PRICE_YOY_PCT_2024:+.1f}%）"
    )
