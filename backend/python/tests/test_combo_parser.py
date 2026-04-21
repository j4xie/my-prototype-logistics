"""Tests for combo_parser — per-piece parse with spec regex.

Week 2 Day 3 of Unified Data Layer v1 spec.
"""
from __future__ import annotations

from smartbi.canonical.combo_parser import ComboItem, parse_combo


def test_empty_input_returns_empty_list():
    assert parse_combo("") == []
    assert parse_combo(None) == []
    assert parse_combo("   ") == []


def test_single_item_with_hash_delimiters():
    items = parse_combo("#招牌青花椒味(单人份)#_1份*58")
    assert len(items) == 1
    it = items[0]
    assert it.parse_ok is True
    assert it.name == "招牌青花椒味(单人份)"
    assert it.qty == 1.0
    assert it.unit_price == 58.0
    assert it.amount == 58.0


def test_three_item_combo():
    combo = "#招牌青花椒味(单人份)#_1份*58+#米饭#_1份*3+#可乐#_1份*8"
    items = parse_combo(combo)
    assert len(items) == 3
    assert [i.name for i in items] == ["招牌青花椒味(单人份)", "米饭", "可乐"]
    assert [i.qty for i in items] == [1.0, 1.0, 1.0]
    assert [i.unit_price for i in items] == [58.0, 3.0, 8.0]
    assert all(i.parse_ok for i in items)


def test_decimal_qty_and_price():
    items = parse_combo("#青花椒味(单人份)#_1.5份*58.5")
    assert len(items) == 1
    assert items[0].qty == 1.5
    assert items[0].unit_price == 58.5
    assert items[0].amount == 87.75


def test_no_hash_delimiters_still_parses():
    items = parse_combo("招牌青花椒_1份*58+米饭_1份*3")
    assert len(items) == 2
    assert items[0].name == "招牌青花椒"
    assert items[1].name == "米饭"
    assert all(i.parse_ok for i in items)


def test_without_份_qualifier():
    items = parse_combo("可乐_2*8")
    assert len(items) == 1
    assert items[0].name == "可乐"
    assert items[0].qty == 2.0
    assert items[0].unit_price == 8.0
    assert items[0].amount == 16.0


def test_partial_unparseable_piece_kept_as_blob():
    """A bad piece in the middle doesn't kill the whole combo — it yields
    a ComboItem(parse_ok=False, source_raw=...) so the normalizer can write
    it to fact_pos_item with product_id=NULL."""
    items = parse_combo("#招牌#_1份*58+盘子坏了_空盘*0+#米饭#_1份*3")
    assert len(items) == 3
    assert items[0].parse_ok is True
    assert items[1].parse_ok is False
    assert items[1].source_raw == "盘子坏了_空盘*0"
    assert items[1].name is None
    assert items[2].parse_ok is True


def test_entirely_garbled_input():
    items = parse_combo("这不是一个combo字符串")
    assert len(items) == 1
    assert items[0].parse_ok is False
    assert items[0].source_raw == "这不是一个combo字符串"


def test_whitespace_in_combo_handled():
    items = parse_combo("  #招牌#_1份*58  +  #米饭#_1份*3  ")
    assert len(items) == 2
    assert items[0].name == "招牌"
    assert items[1].name == "米饭"


def test_empty_pieces_between_plusses_skipped():
    """'#A#_1*2++#B#_1*3' → two items, not three; empty '+' splits filtered."""
    items = parse_combo("#A#_1*2++#B#_1*3")
    assert len(items) == 2
    assert items[0].name == "A"
    assert items[1].name == "B"


def test_comboitem_is_immutable():
    it = ComboItem(name="x", qty=1.0, unit_price=1.0, amount=1.0,
                   source_raw="x", parse_ok=True)
    import pytest
    with pytest.raises(Exception):
        it.name = "y"  # type: ignore[misc]


def test_amount_rounded_to_2dp():
    """0.1 * 0.2 ≠ 0.02 in float arithmetic — verify we round."""
    items = parse_combo("x_0.1份*0.2")
    assert items[0].amount == 0.02  # not 0.020000...0004
