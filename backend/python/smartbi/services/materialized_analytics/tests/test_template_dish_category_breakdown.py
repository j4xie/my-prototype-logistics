"""test_template_dish_category_breakdown.py"""
from smartbi.services.materialized_analytics.compute.polars_backend import PolarsBackend
from smartbi.services.materialized_analytics.schema import DataSchema, Domain, Field, FieldRole
from smartbi.services.materialized_analytics.templates.dish_category_breakdown import DishCategoryBreakdown


def _schema():
    return DataSchema(upload_id=1, factory_id="F001", domain=Domain.RESTAURANT,
        fields=tuple([Field("商品信息", FieldRole.DIMENSION, "string"),
                      Field("营业额", FieldRole.MEASURE, "float")]),
        row_count=3, primary_measure="营业额")


def test_category_splits_drink_main_side():
    # 可口可乐=饮品(6), 咸蛋黄牛蛙=主菜(24), 豆腐皮=配菜(8)
    rows = [
        {"商品信息": "可口可乐_1听*6", "营业额": 6},
        {"商品信息": "咸蛋黄牛蛙_1份*24", "营业额": 24},
        {"商品信息": "豆腐皮_1份*8", "营业额": 8},
    ]
    backend = PolarsBackend.from_rows(rows)
    result = DishCategoryBreakdown().run(backend, _schema())
    assert result.applies
    assert result.kpis["top_category"] == "主菜"  # 24 is biggest
    assert result.kpis["category_count"] >= 3


def test_category_skip_when_no_item_column():
    schema = DataSchema(upload_id=1, factory_id="F001", domain=Domain.RESTAURANT,
        fields=tuple([Field("营业额", FieldRole.MEASURE, "float")]),
        row_count=1, primary_measure="营业额")
    backend = PolarsBackend.from_rows([{"营业额": 100}])
    result = DishCategoryBreakdown().run(backend, schema)
    assert not result.applies
