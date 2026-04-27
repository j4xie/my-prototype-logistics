"""Industry default cost ratios + margin rates for cascade gap fallback.

Per spec 04-C v1.4 §4.3 (Q3 user decision: hardcode + factory override).

Used by ``cascade._get_industry_default_cost`` when a product has no recipe
in ``field_provenance`` — we infer the menu category from ``dim_product``
and apply a per-category cost ratio against the historical
``avg_unit_price`` to synthesise a ``cost_per_unit`` value with
``confidence=0.5`` (medium — better than nothing, worse than a real recipe).

Factory-level overrides come from
``factory_provenance_config.industry_default_overrides`` JSONB, with keys of
the form ``"<default_type>.<category>"`` (e.g. ``"cost_rate.川菜": 0.32``).
"""
from __future__ import annotations

import json
import logging
from typing import TYPE_CHECKING, Dict, Optional

if TYPE_CHECKING:
    import asyncpg  # pragma: no cover — type-only import

logger = logging.getLogger(__name__)


# 餐饮行业经验值, 来源: 美味不用等 + 哗啦啦 + 客如云行业报告聚合.
# Lower ratio = lower food cost as a fraction of price (i.e. higher margin).
INDUSTRY_DEFAULT_COST_RATIO: Dict[str, float] = {
    # 中餐细分 (食材成本 / 售价)
    "川菜": 0.35,
    "粤菜": 0.40,
    "湘菜": 0.32,
    "鲁菜": 0.38,
    "江浙菜": 0.38,
    "东北菜": 0.30,
    "西北菜": 0.32,

    # 类别
    "火锅": 0.28,
    "烧烤": 0.30,
    "麻辣烫/冒菜": 0.25,
    "快餐/简餐": 0.28,
    "面食": 0.20,
    "粥粉": 0.18,
    "饮品/茶饮": 0.15,
    "甜品": 0.22,
    "西餐/牛排": 0.40,
    "日韩料理": 0.42,
    "海鲜": 0.50,
    "自助餐": 0.45,

    # 菜品类型
    "招牌菜": 0.45,    # 一般高于品类均值
    "套餐": 0.30,
    "饮料": 0.15,
    "酒水": 0.12,
    "凉菜": 0.25,
    "主食": 0.22,
    "汤品": 0.20,

    # 默认 (找不到任何匹配)
    "_default": 0.35,
}

# Margin rate = 1 - cost_ratio for the same category. Spec only seeded a
# subset; this is a complete mirror so callers asking for ``margin_rate``
# never fall back to the generic ``1 - _default`` for a known category.
INDUSTRY_DEFAULT_MARGIN_RATE: Dict[str, float] = {
    cat: round(1.0 - ratio, 4)
    for cat, ratio in INDUSTRY_DEFAULT_COST_RATIO.items()
    if cat != "_default"
}


_VALID_DEFAULT_TYPES = ("cost_rate", "margin_rate")


async def get_industry_default(
    conn: "asyncpg.Connection",
    factory_id: str,
    default_type: str,
    key: str,
) -> Optional[float]:
    """Return the industry default value for ``(default_type, key)``.

    Resolution order (per spec §4.3):
      1. ``factory_provenance_config.industry_default_overrides`` JSONB —
         key format ``"<default_type>.<category>"`` (e.g.
         ``"cost_rate.川菜": 0.32``). Factory override wins.
      2. ``INDUSTRY_DEFAULT_COST_RATIO`` / ``INDUSTRY_DEFAULT_MARGIN_RATE``
         hardcoded global table. Falls back to ``_default`` (cost_rate)
         or ``1 - _default`` (margin_rate) for unknown categories.

    Returns ``None`` only for an unknown ``default_type``.

    asyncpg JSONB codec may surface the override column as either a
    ``str`` (default codec) or already-decoded ``dict``; we normalise both.
    """
    if default_type not in _VALID_DEFAULT_TYPES:
        logger.warning(
            "get_industry_default: unknown default_type=%r (expected %s)",
            default_type, _VALID_DEFAULT_TYPES,
        )
        return None

    row = await conn.fetchrow(
        """
        SELECT industry_default_overrides
          FROM factory_provenance_config
         WHERE factory_id = $1
        """,
        factory_id,
    )
    if row and row["industry_default_overrides"] is not None:
        overrides = row["industry_default_overrides"]
        if isinstance(overrides, str):
            try:
                overrides = json.loads(overrides)
            except json.JSONDecodeError:
                logger.warning(
                    "factory_provenance_config.industry_default_overrides "
                    "is not valid JSON for factory_id=%s; ignoring override",
                    factory_id,
                )
                overrides = None
        if isinstance(overrides, dict):
            full_key = f"{default_type}.{key}"
            if full_key in overrides:
                try:
                    return float(overrides[full_key])
                except (TypeError, ValueError):
                    logger.warning(
                        "industry_default_overrides[%r] is not numeric "
                        "(factory_id=%s); falling through to global default",
                        full_key, factory_id,
                    )

    # Global hardcode fallback.
    if default_type == "cost_rate":
        return INDUSTRY_DEFAULT_COST_RATIO.get(
            key, INDUSTRY_DEFAULT_COST_RATIO["_default"]
        )
    # margin_rate
    if key in INDUSTRY_DEFAULT_MARGIN_RATE:
        return INDUSTRY_DEFAULT_MARGIN_RATE[key]
    return round(1.0 - INDUSTRY_DEFAULT_COST_RATIO["_default"], 4)
