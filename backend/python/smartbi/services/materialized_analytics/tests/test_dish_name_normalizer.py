"""Unit tests for dish_name_normalizer.normalize_dish_name."""
from smartbi.services.materialized_analytics.restaurant.dish_name_normalizer import (
    normalize_dish_name,
)


def test_strip_chinese_variant_eating_style():
    assert normalize_dish_name("招牌青花椒鱼(一吃)") == "招牌青花椒鱼"
    assert normalize_dish_name("招牌青花椒鱼（二吃）") == "招牌青花椒鱼"
    assert normalize_dish_name("招牌青花椒鱼(三吃)") == "招牌青花椒鱼"


def test_strip_size_variant():
    assert normalize_dish_name("青菜(大份)") == "青菜"
    assert normalize_dish_name("青菜（小份）") == "青菜"
    assert normalize_dish_name("套餐(单人份)") == "套餐"
    assert normalize_dish_name("套餐（双人份）") == "套餐"
    assert normalize_dish_name("套餐(2-3人份)") == "套餐"


def test_strip_flavor_variant():
    assert normalize_dish_name("水煮鱼(微辣)") == "水煮鱼"
    assert normalize_dish_name("水煮鱼（中辣）") == "水煮鱼"
    assert normalize_dish_name("水煮鱼(无辣)") == "水煮鱼"


def test_preserve_middle_parens():
    # Paren is NOT at end → not stripped (safe-guard against
    # accidentally collapsing dishes whose name legitimately contains a
    # paren in the middle).
    assert normalize_dish_name("店内特价(限时)50份") == "店内特价(限时)50份"


def test_no_paren_passthrough():
    assert normalize_dish_name("正常菜名") == "正常菜名"
    assert normalize_dish_name("咸蛋黄牛蛙") == "咸蛋黄牛蛙"


def test_empty_safe():
    assert normalize_dish_name("") == ""
    assert normalize_dish_name(None) is None


def test_non_string_safe():
    # Defensive: if a numeric somehow reaches us, do not crash.
    assert normalize_dish_name(123) == 123  # type: ignore[arg-type]
