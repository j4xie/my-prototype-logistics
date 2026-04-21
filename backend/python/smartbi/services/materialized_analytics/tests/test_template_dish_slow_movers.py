"""test_template_dish_slow_movers.py"""
from smartbi.services.materialized_analytics.compute.polars_backend import PolarsBackend
from smartbi.services.materialized_analytics.schema import DataSchema, Domain, Field, FieldRole
from smartbi.services.materialized_analytics.templates.dish_slow_movers import DishSlowMovers


def _schema():
    return DataSchema(upload_id=1, factory_id="F001", domain=Domain.RESTAURANT,
        fields=tuple([Field("商品信息", FieldRole.DIMENSION, "string"),
                      Field("营业额", FieldRole.MEASURE, "float")]),
        row_count=10, primary_measure="营业额")


def test_slow_movers_detects_low_sellers():
    # 热销: 可口可乐(10), 娃娃菜(8). 滞销: 冷门菜(1).
    rows = [{"商品信息": "可口可乐_1听*6", "营业额": 6} for _ in range(10)]
    rows += [{"商品信息": "娃娃菜_1份*8", "营业额": 8} for _ in range(8)]
    rows += [{"商品信息": "冷门菜_1份*20", "营业额": 20}]
    backend = PolarsBackend.from_rows(rows)
    result = DishSlowMovers().run(backend, _schema())
    assert result.applies
    names = [r["name"] for r in result.data["bottom_15"]]
    assert "冷门菜" in names  # definitely slow-mover
    assert result.kpis["near_zero_count"] >= 1  # 冷门菜 appears in 1 order < 3


def test_slow_movers_skip_when_no_item_col():
    schema = DataSchema(upload_id=1, factory_id="F001", domain=Domain.RESTAURANT,
        fields=tuple([Field("营业额", FieldRole.MEASURE, "float")]),
        row_count=1, primary_measure="营业额")
    backend = PolarsBackend.from_rows([{"营业额": 100}])
    result = DishSlowMovers().run(backend, schema)
    assert not result.applies
