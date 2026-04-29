"""Dish name normalization for top-N aggregations.

Many POS systems split dish variants by SKU even though customers perceive
them as one item:
  招牌青花椒鱼(一吃)  - 招牌青花椒鱼(二吃)  - 招牌青花椒鱼(三吃)
  招牌青花椒鱼可乐套餐(大份) - 招牌青花椒鱼可乐套餐(小份)

For top-N dish ranking, customers want "Top 5 dishes I sell" — so we
normalize by stripping trailing parenthetical variant suffixes before
aggregation. This collapses (一吃)/(二吃)/(大份)/(小份)/(单人份) etc.
back to the parent dish name.

Why a lightweight helper here (vs. RestaurantMenuNormalizer in
services/restaurant/menu_normalizer.py)?
  - menu_normalizer is the alias-table-backed normalizer used during
    SKU registration / merge proposals; it requires a DB session and
    factory context.
  - This helper is a pure-string fast path used inside materialized
    template compute() functions, which run in tight per-row loops and
    must be DB-free (the polars backend has no Session).

Cross-references:
  - services.restaurant.menu_normalizer.RestaurantMenuNormalizer.ALL_SUFFIX_PATTERNS
    inspired this module's regex; we keep the regex narrower (single
    trailing paren) on purpose to avoid over-merging.
  - parse_items() in restaurant/item_parser.py preserves raw names so
    audit/signature detection still sees the original; normalization is
    applied by templates AFTER parse_items returns.
"""
from __future__ import annotations

import re
from typing import Optional

# Match a trailing parenthetical (Chinese 全/半角 or English) at the end
# of the name. Capped at 8 inner characters so we don't accidentally
# strip long mid-name parens (defensive — although this regex anchors on
# end-of-string with `$`).
#
# Examples matched:
#   (一吃) （二吃） (大份) (小份) (单人份) (双人份) (微辣) (无辣)
#   (2-3人份) (中辣)
# Examples NOT matched (paren is mid-name, not at end):
#   "店内特价(限时)50份"  → unchanged (paren not at end)
_VARIANT_SUFFIX_RE = re.compile(r"[\(（][^)）]{1,8}[\)）]\s*$")


def normalize_dish_name(name: Optional[str]) -> Optional[str]:
    """Strip trailing variant suffix from a dish name.

    Examples:
        normalize_dish_name("招牌青花椒鱼(一吃)") == "招牌青花椒鱼"
        normalize_dish_name("招牌青花椒鱼（二吃）") == "招牌青花椒鱼"
        normalize_dish_name("青菜(大份)") == "青菜"
        normalize_dish_name("套餐(单人份)") == "套餐"
        normalize_dish_name("正常菜名") == "正常菜名"
        normalize_dish_name("店内特价(限时)50份") == "店内特价(限时)50份"
        normalize_dish_name("") == ""
        normalize_dish_name(None) is None

    Args:
        name: Raw dish name (may be None or empty).

    Returns:
        Normalized name with trailing variant paren stripped. Returns
        the input unchanged when no trailing paren is found, or when
        input is None / empty / non-string.
    """
    if name is None:
        return None
    if not isinstance(name, str):
        return name
    if not name:
        return name
    return _VARIANT_SUFFIX_RE.sub("", name).strip()
