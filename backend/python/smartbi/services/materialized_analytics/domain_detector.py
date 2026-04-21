"""Domain detection — decides what kind of business data an upload holds.

W1 ships restaurant-only rules + fallback to UNKNOWN. Pluggable so we can
add other domains (finance/sales/...) or LLM fallback later without
touching template code.
"""
from __future__ import annotations

import logging
from typing import List, Protocol

from .schema import DataSchema, Domain, Field, FieldRole

logger = logging.getLogger(__name__)

# Restaurant domain signals — any 2+ matching dimension names ⇒ RESTAURANT.
_RESTAURANT_DIM_KEYWORDS = {
    "门店", "店铺", "餐厅", "档口", "分店",
    "菜品", "产品", "商品", "SKU", "品类",
    "订单", "单号", "流水", "桌号",
    "服务员", "收银员", "厨师",
}
_RESTAURANT_MEASURE_KEYWORDS = {
    "销售金额", "销售额", "营业额", "实收", "应收",
    "订单金额", "消费金额", "客单价",
    "毛利", "成本",
}


class DomainDetector(Protocol):
    def detect(self, fields: List[Field], sample_data: List[dict]) -> Domain: ...


class RestaurantRuleDetector:
    """Simple keyword-based rules; extend or swap for LLM later."""

    def detect(self, fields: List[Field], sample_data: List[dict]) -> Domain:
        dim_names = [f.name for f in fields if f.role == FieldRole.DIMENSION]
        measure_names = [f.name for f in fields if f.role == FieldRole.MEASURE]

        dim_hits = sum(
            1 for d in dim_names
            if any(kw in d for kw in _RESTAURANT_DIM_KEYWORDS)
        )
        measure_hits = sum(
            1 for m in measure_names
            if any(kw in m for kw in _RESTAURANT_MEASURE_KEYWORDS)
        )

        # Need dim + measure evidence to avoid false positives
        if dim_hits >= 2 and measure_hits >= 1:
            logger.info(
                f"[domain] RESTAURANT detected (dim_hits={dim_hits}, measure_hits={measure_hits})"
            )
            return Domain.RESTAURANT

        logger.info(
            f"[domain] UNKNOWN (dim_hits={dim_hits}, measure_hits={measure_hits})"
        )
        return Domain.UNKNOWN


def get_default_detector() -> DomainDetector:
    """Single entry point; future: read config to pick detector chain."""
    return RestaurantRuleDetector()
