"""Unit tests for IntermediateProduct (P3.5C B1)."""
import pytest

from smartbi.services.bom.intermediate_product import (
    IngredientLine, IntermediateProduct,
)
from smartbi.services.bom.raw_material import RawMaterial


@pytest.fixture
def hotpot_raw_materials():
    """3 raw materials for 自制鸡爪酱 recipe (hotpot cuisine)."""
    return {
        "南乳汁": RawMaterial(
            name="南乳汁", category="调料", inventory_unit="瓶", calc_unit="克",
            calc_spec=500, recent_price=12.0, supplier="test",
        ),
        "色拉油": RawMaterial(
            name="色拉油", category="粮油", inventory_unit="斤", calc_unit="克",
            calc_spec=500, recent_price=6.5, supplier="test",
        ),
        "姜": RawMaterial(
            name="姜", category="蔬菜", inventory_unit="斤", calc_unit="克",
            calc_spec=500, recent_price=8.0, supplier="test",
        ),
    }


def test_intermediate_product_basic(hotpot_raw_materials):
    """Recipe: 1 batch of 自制鸡爪酱 yields 45 units, uses 3 ingredients."""
    ip = IntermediateProduct(
        name="自制鸡爪酱",
        department="明档",
        batch_yield_qty=45,
        batch_yield_unit="斤",
        ingredients=[
            IngredientLine(raw_material_name="南乳汁", raw_amount_calc=600, yield_rate=1.0),
            IngredientLine(raw_material_name="色拉油", raw_amount_calc=1500, yield_rate=1.0),
            IngredientLine(raw_material_name="姜", raw_amount_calc=421, yield_rate=0.95),
        ],
    )
    assert len(ip.ingredients) == 3
    assert ip.batch_yield_qty == 45
    assert ip.name == "自制鸡爪酱"


def test_calculate_batch_cost_simple(hotpot_raw_materials):
    """Batch cost = sum(raw_amount × cost_per_calc_unit) — no yield loss."""
    ip = IntermediateProduct(
        name="自制鸡爪酱",
        department="明档",
        batch_yield_qty=45,
        batch_yield_unit="斤",
        ingredients=[
            IngredientLine(raw_material_name="南乳汁", raw_amount_calc=600, yield_rate=1.0),
            IngredientLine(raw_material_name="色拉油", raw_amount_calc=1500, yield_rate=1.0),
        ],
    )
    # 南乳汁: 600 × (12.0/500) = 600 × 0.024 = 14.4
    # 色拉油: 1500 × (6.5/500) = 1500 × 0.013 = 19.5
    total = ip.calculate_batch_cost(hotpot_raw_materials)
    assert total == pytest.approx(14.4 + 19.5, rel=0.01)


def test_calculate_unit_cost(hotpot_raw_materials):
    """Unit cost = batch_cost / batch_yield_qty."""
    ip = IntermediateProduct(
        name="自制鸡爪酱",
        department="明档",
        batch_yield_qty=45,
        batch_yield_unit="斤",
        ingredients=[
            IngredientLine(raw_material_name="南乳汁", raw_amount_calc=600, yield_rate=1.0),
        ],
    )
    # Batch cost: 600 × 0.024 = 14.4
    # Unit cost: 14.4 / 45 = 0.32 per 斤
    unit_cost = ip.calculate_unit_cost(hotpot_raw_materials)
    assert unit_cost == pytest.approx(14.4 / 45, rel=0.01)


def test_yield_rate_adjusts_gross_amount():
    """For 大葱 with yield 0.5: recipe says net 500g, buy 1000g gross."""
    mat = RawMaterial(
        name="大葱", category="蔬菜", inventory_unit="斤", calc_unit="克",
        calc_spec=500, recent_price=3.0, supplier="test",
    )
    line = IngredientLine(
        raw_material_name="大葱",
        raw_amount_calc=500,  # net
        yield_rate=0.5,       # 50% loss
    )
    # Gross = net / yield = 500 / 0.5 = 1000 g
    assert line.gross_amount_calc() == 1000

    # Cost uses gross amount
    cost = line.calculate_cost({"大葱": mat})
    # 1000 × (3.0/500) = 1000 × 0.006 = 6.0
    assert cost == pytest.approx(6.0, rel=0.01)


def test_missing_raw_material_raises():
    ip = IntermediateProduct(
        name="broken",
        department="test",
        batch_yield_qty=1,
        batch_yield_unit="份",
        ingredients=[
            IngredientLine(raw_material_name="不存在", raw_amount_calc=100),
        ],
    )
    with pytest.raises(KeyError, match="不存在"):
        ip.calculate_batch_cost({})


def test_zero_yield_rate_raises():
    """yield_rate=0 would divide by zero silently — must raise."""
    line = IngredientLine(
        raw_material_name="broken",
        raw_amount_calc=100,
        yield_rate=0,
    )
    with pytest.raises(ValueError, match="yield_rate"):
        line.gross_amount_calc()


def test_universal_bakery_intermediate():
    """Bakery 自制面团 proves cross-cuisine universality."""
    mats = {
        "高筋面粉": RawMaterial(
            name="高筋面粉", category="粮油", inventory_unit="kg", calc_unit="克",
            calc_spec=1000, recent_price=8.5, supplier="test",
        ),
        "酵母": RawMaterial(
            name="酵母", category="辅料", inventory_unit="袋", calc_unit="克",
            calc_spec=100, recent_price=12.0, supplier="test",
        ),
    }
    dough = IntermediateProduct(
        name="自制面团",
        department="烘焙间",
        batch_yield_qty=10,
        batch_yield_unit="kg",
        ingredients=[
            IngredientLine(raw_material_name="高筋面粉", raw_amount_calc=5000, yield_rate=1.0),
            IngredientLine(raw_material_name="酵母", raw_amount_calc=50, yield_rate=1.0),
        ],
    )
    # 面粉: 5000 × (8.5/1000) = 42.5
    # 酵母: 50 × (12.0/100) = 6.0
    total = dough.calculate_batch_cost(mats)
    assert total == pytest.approx(42.5 + 6.0, rel=0.01)


def test_intermediate_to_dict(hotpot_raw_materials):
    ip = IntermediateProduct(
        name="自制鸡爪酱",
        department="明档",
        batch_yield_qty=45,
        batch_yield_unit="斤",
        ingredients=[
            IngredientLine(raw_material_name="南乳汁", raw_amount_calc=600, yield_rate=1.0),
        ],
    )
    d = ip.to_dict()
    assert d["name"] == "自制鸡爪酱"
    assert d["department"] == "明档"
    assert d["batchYieldQty"] == 45
    assert d["batchYieldUnit"] == "斤"
    assert len(d["ingredients"]) == 1
    assert d["ingredients"][0]["rawMaterial"] == "南乳汁"
