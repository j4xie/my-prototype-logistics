"""test_restaurant_parsers.py — item_parser + dish_classifier + table_classifier unit tests"""
from smartbi.services.materialized_analytics.restaurant.item_parser import (
    parse_item, parse_items,
)
from smartbi.services.materialized_analytics.restaurant.dish_classifier import classify_dish
from smartbi.services.materialized_analytics.restaurant.table_classifier import classify_table


# ── item_parser ──

def test_parse_item_simple():
    r = parse_item("咸蛋黄牛蛙_1份*24")
    assert r["name"] == "咸蛋黄牛蛙"
    assert r["quantity"] == 1.0
    assert r["unit"] == "份"
    assert r["unit_price"] == 24.0
    assert r["total"] == 24.0
    assert not r["is_signature"]
    assert not r["is_system"]


def test_parse_item_signature():
    r = parse_item("#招牌青花椒味(单人份)#_1份*58")
    assert r["name"] == "招牌青花椒味(单人份)"
    assert r["is_signature"] is True
    assert r["quantity"] == 1.0


def test_parse_item_decimal_qty_and_kg():
    r = parse_item("招牌青花椒鱼(微麻微辣)_2.5斤*69")
    assert r["name"] == "招牌青花椒鱼(微麻微辣)"
    assert r["quantity"] == 2.5
    assert r["unit"] == "斤"
    assert r["total"] == 172.5


def test_parse_item_no_unit():
    # Some tokens might lack the unit
    r = parse_item("可口可乐_1*6")
    assert r is not None
    assert r["name"] == "可口可乐"
    assert r["unit"] == ""
    assert r["total"] == 6.0


def test_parse_item_system_filtered():
    r = parse_item("#无需餐具#_1份*0")
    assert r["is_system"] is True


def test_parse_item_malformed_returns_none():
    assert parse_item("") is None
    assert parse_item("garbage") is None
    assert parse_item("name_*") is None


def test_parse_items_real_sample():
    s = "#无需餐具#_1份*0+打包盒_1份*4.5+#招牌青花椒味(单人份)#_1份*58+咸蛋黄牛蛙_1份*24"
    items = parse_items(s)
    # 无需餐具 + 打包盒 filtered as system; 2 real items remain
    names = [x["name"] for x in items]
    assert "招牌青花椒味(单人份)" in names
    assert "咸蛋黄牛蛙" in names
    assert "无需餐具" not in names
    assert "打包盒" not in names
    assert len(items) == 2


def test_parse_items_multi_with_decimals():
    s = "豆腐皮_1份*8+招牌青花椒鱼(微麻微辣)(一吃)_2.5斤*69+可口可乐_1听*6"
    items = parse_items(s)
    assert len(items) == 3
    totals = sum(x["total"] for x in items)
    assert 8 + 172.5 + 6 == totals


def test_parse_items_empty_input():
    assert parse_items("") == []
    assert parse_items(None) == []


# ── dish_classifier ──

def test_classify_beverage():
    assert classify_dish("可口可乐") == "饮品"
    assert classify_dish("超大杯杨梅爆柠茶") == "饮品"
    assert classify_dish("雪碧") == "饮品"


def test_classify_beer():
    assert classify_dish("百威啤酒") == "啤酒"
    assert classify_dish("青岛啤酒") == "啤酒"


def test_classify_signature():
    # is_signature flag dominates
    assert classify_dish("招牌青花椒味", is_signature=True) == "招牌菜"


def test_classify_main():
    assert classify_dish("咸蛋黄牛蛙") == "主菜"
    assert classify_dish("成都冒烤鸭(单人份)") == "主菜"


def test_classify_side():
    assert classify_dish("豆腐皮") == "配菜"
    assert classify_dish("娃娃菜") == "配菜"


def test_classify_other():
    assert classify_dish("某个看不出是啥的菜") == "其他"


# ── table_classifier ──

def test_classify_table_hall():
    assert classify_table("17") == "大厅"
    assert classify_table("1") == "大厅"
    assert classify_table("12A") == "大厅"


def test_classify_table_takeaway():
    assert classify_table("无桌位(美团外卖)") == "外卖"
    assert classify_table("无桌位(饿了么外卖)") == "外卖"
    assert classify_table("无桌位(京东外卖)") == "外卖"


def test_classify_table_vip():
    assert classify_table("包厢01") == "包厢"
    assert classify_table("VIP001") == "包厢"
    assert classify_table("贵宾厅") == "包厢"


def test_classify_table_unknown():
    assert classify_table(None) == "未知"
    assert classify_table("") == "未知"
