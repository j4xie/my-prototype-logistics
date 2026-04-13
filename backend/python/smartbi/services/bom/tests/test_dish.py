"""Unit tests for Dish 2-layer BOM (P3.5C B2)."""
import pytest

from smartbi.services.bom.dish import Dish, DishIngredientLine
from smartbi.services.bom.intermediate_product import (
    IngredientLine, IntermediateProduct,
)
from smartbi.services.bom.raw_material import RawMaterial


@pytest.fixture
def kitchen_data():
    """Real 鼎鲜 金汤凤爪 recipe data — raw materials + 1 intermediate."""
    raw = {
        "凤爪": RawMaterial(
            name="凤爪", category="肉类", inventory_unit="斤", calc_unit="克",
            calc_spec=500, recent_price=22.0, supplier="test",
        ),
        "南乳汁": RawMaterial(
            name="南乳汁", category="调料", inventory_unit="瓶", calc_unit="克",
            calc_spec=500, recent_price=12.0, supplier="test",
        ),
        "色拉油": RawMaterial(
            name="色拉油", category="粮油", inventory_unit="斤", calc_unit="克",
            calc_spec=500, recent_price=6.5, supplier="test",
        ),
    }
    intermediates = {
        "自制鸡爪酱": IntermediateProduct(
            name="自制鸡爪酱",
            department="明档",
            batch_yield_qty=45000,  # 45 斤 × 1000 = 45000 克 (batch in g)
            batch_yield_unit="克",
            ingredients=[
                IngredientLine(raw_material_name="南乳汁", raw_amount_calc=600),
                IngredientLine(raw_material_name="色拉油", raw_amount_calc=1500),
            ],
        ),
    }
    return raw, intermediates


def test_dish_references_raw_and_intermediate(kitchen_data):
    raw, intermediates = kitchen_data
    dish = Dish(
        name="金汤凤爪",
        department="明档",
        sell_price=69.0,
        ingredients=[
            DishIngredientLine(name="凤爪", amount_calc=750, source="raw"),
            DishIngredientLine(name="自制鸡爪酱", amount_calc=800, source="intermediate"),
        ],
    )
    assert len(dish.ingredients) == 2
    assert dish.ingredients[0].source == "raw"
    assert dish.ingredients[1].source == "intermediate"


def test_dish_calculates_cost_with_both_layers(kitchen_data):
    raw, intermediates = kitchen_data
    dish = Dish(
        name="金汤凤爪",
        department="明档",
        sell_price=69.0,
        ingredients=[
            DishIngredientLine(name="凤爪", amount_calc=750, source="raw"),
            DishIngredientLine(name="自制鸡爪酱", amount_calc=800, source="intermediate"),
        ],
    )
    cost = dish.calculate_cost(raw, intermediates)

    # 凤爪: 750 × (22.0/500) = 750 × 0.044 = 33.0
    # 鸡爪酱 unit cost: (600×0.024 + 1500×0.013) / 45000
    #   = (14.4 + 19.5) / 45000 ≈ 0.0007533/g
    # 鸡爪酱 amount cost: 800 × 0.0007533 ≈ 0.6027
    expected = 33.0 + (14.4 + 19.5) / 45000 * 800
    assert cost == pytest.approx(expected, rel=0.01)


def test_dish_gross_margin_calculation(kitchen_data):
    raw, intermediates = kitchen_data
    dish = Dish(
        name="金汤凤爪",
        department="明档",
        sell_price=69.0,
        ingredients=[
            DishIngredientLine(name="凤爪", amount_calc=750, source="raw"),
        ],
    )
    margin = dish.gross_margin(raw, intermediates)
    # cost = 33.0, price = 69.0, margin = (69-33)/69 ≈ 0.5217
    assert margin == pytest.approx((69 - 33) / 69, rel=0.01)


def test_dish_zero_sell_price_returns_zero_margin(kitchen_data):
    raw, intermediates = kitchen_data
    dish = Dish(
        name="free_dish",
        department="test",
        sell_price=0,
        ingredients=[
            DishIngredientLine(name="凤爪", amount_calc=100, source="raw"),
        ],
    )
    assert dish.gross_margin(raw, intermediates) == 0


def test_dish_missing_raw_material_raises(kitchen_data):
    _, intermediates = kitchen_data
    dish = Dish(
        name="broken",
        department="test",
        sell_price=50.0,
        ingredients=[
            DishIngredientLine(name="不存在", amount_calc=100, source="raw"),
        ],
    )
    with pytest.raises(KeyError, match="不存在"):
        dish.calculate_cost({}, intermediates)


def test_dish_missing_intermediate_raises(kitchen_data):
    raw, _ = kitchen_data
    dish = Dish(
        name="broken",
        department="test",
        sell_price=50.0,
        ingredients=[
            DishIngredientLine(name="不存在的半成品", amount_calc=100, source="intermediate"),
        ],
    )
    with pytest.raises(KeyError, match="不存在的半成品"):
        dish.calculate_cost(raw, {})


def test_dish_invalid_source_raises(kitchen_data):
    raw, intermediates = kitchen_data
    dish = Dish(
        name="bad_source",
        department="test",
        sell_price=50.0,
        ingredients=[
            DishIngredientLine(name="凤爪", amount_calc=100, source="invalid"),
        ],
    )
    with pytest.raises(ValueError, match="source"):
        dish.calculate_cost(raw, intermediates)


def test_dish_to_dict(kitchen_data):
    raw, intermediates = kitchen_data
    dish = Dish(
        name="金汤凤爪",
        department="明档",
        sell_price=69.0,
        ingredients=[
            DishIngredientLine(name="凤爪", amount_calc=750, source="raw"),
        ],
    )
    d = dish.to_dict(raw, intermediates)
    assert d["name"] == "金汤凤爪"
    assert d["sellPrice"] == 69.0
    assert d["cost"] > 0
    assert "grossMargin" in d
    assert len(d["ingredients"]) == 1
