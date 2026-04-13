"""Unit tests for RawMaterial + UnitConverter (P3.5B F4)."""
import pytest

from smartbi.services.bom.raw_material import RawMaterial, UnitConverter


def test_raw_material_basic_creation():
    mat = RawMaterial(
        name="小青龙(冻-好)200-300g",
        category="海鲜类",
        inventory_unit="斤",
        calc_unit="克",
        calc_spec=500,  # 1 斤 = 500 克
        recent_price=147.02,
        supplier="长沙四季商贸",
    )
    assert mat.name == "小青龙(冻-好)200-300g"
    assert mat.calc_spec == 500


def test_unit_converter_inventory_to_calc():
    """1 斤 of 小青龙 = 500 g."""
    mat = RawMaterial(
        name="小青龙", category="海鲜", inventory_unit="斤",
        calc_unit="克", calc_spec=500, recent_price=147.02, supplier="test",
    )
    assert UnitConverter.inventory_to_calc(mat, 1) == 500
    assert UnitConverter.inventory_to_calc(mat, 2.5) == 1250


def test_unit_converter_calc_to_inventory():
    """500 g of 小青龙 = 1 斤 (reverse direction)."""
    mat = RawMaterial(
        name="小青龙", category="海鲜", inventory_unit="斤",
        calc_unit="克", calc_spec=500, recent_price=147.02, supplier="test",
    )
    assert UnitConverter.calc_to_inventory(mat, 500) == 1
    assert UnitConverter.calc_to_inventory(mat, 250) == 0.5


def test_unit_converter_cost_per_calc_unit():
    """Per-gram cost: ¥147.02/斤 ÷ 500 g/斤 = ¥0.29404/g."""
    mat = RawMaterial(
        name="小青龙", category="海鲜", inventory_unit="斤",
        calc_unit="克", calc_spec=500, recent_price=147.02, supplier="test",
    )
    cost_per_gram = UnitConverter.cost_per_calc_unit(mat)
    assert cost_per_gram == pytest.approx(0.29404, rel=1e-4)


def test_unit_converter_cost_of_calc_quantity():
    """800 g of 小青龙 at ¥0.294/g = ¥235.23."""
    mat = RawMaterial(
        name="小青龙", category="海鲜", inventory_unit="斤",
        calc_unit="克", calc_spec=500, recent_price=147.02, supplier="test",
    )
    total = UnitConverter.cost_of_calc_quantity(mat, 800)
    # 800 × (147.02 / 500) = 800 × 0.29404 = 235.232
    assert total == pytest.approx(235.232, rel=1e-3)


def test_unit_converter_handles_1_to_1_spec():
    """For 包 → 包 (1:1), conversion is identity."""
    mat = RawMaterial(
        name="硬中华", category="烟草", inventory_unit="包",
        calc_unit="包", calc_spec=1, recent_price=41.5, supplier="烟草公司",
    )
    assert UnitConverter.inventory_to_calc(mat, 10) == 10
    assert UnitConverter.cost_per_calc_unit(mat) == 41.5


def test_unit_converter_raises_on_zero_spec():
    """calc_spec=0 is a data error — divide by zero would be silent."""
    mat = RawMaterial(
        name="broken", category="test", inventory_unit="斤",
        calc_unit="克", calc_spec=0, recent_price=10, supplier="test",
    )
    with pytest.raises(ValueError, match="calc_spec.*zero"):
        UnitConverter.inventory_to_calc(mat, 1)


def test_multi_cuisine_raw_materials():
    """Different cuisines use different raw materials — universal pattern."""
    hotpot_mat = RawMaterial(
        name="肥牛卷", category="肉类", inventory_unit="斤",
        calc_unit="克", calc_spec=500, recent_price=48.0, supplier="test",
    )
    bakery_mat = RawMaterial(
        name="高筋面粉", category="粮油", inventory_unit="kg",
        calc_unit="克", calc_spec=1000, recent_price=8.5, supplier="test",
    )
    western_mat = RawMaterial(
        name="澳洲牛排", category="肉类", inventory_unit="块",
        calc_unit="块", calc_spec=1, recent_price=68.0, supplier="test",
    )

    # 肥牛卷: 48/500 = 0.096 per gram
    assert UnitConverter.cost_per_calc_unit(hotpot_mat) == pytest.approx(0.096, rel=1e-4)
    # 高筋面粉: 8.5/1000 = 0.0085 per gram
    assert UnitConverter.cost_per_calc_unit(bakery_mat) == pytest.approx(0.0085, rel=1e-4)
    # 澳洲牛排: 68.0 per piece (identity)
    assert UnitConverter.cost_per_calc_unit(western_mat) == 68.0
