"""test_template_dish_sales_top_n.py"""
from smartbi.services.materialized_analytics.compute.polars_backend import PolarsBackend
from smartbi.services.materialized_analytics.schema import DataSchema, Domain, Field, FieldRole
from smartbi.services.materialized_analytics.templates.dish_sales_top_n import DishSalesTopN


def _schema(has_item_col=True):
    fields = [Field("门店名称", FieldRole.DIMENSION, "string"),
              Field("营业额", FieldRole.MEASURE, "float")]
    if has_item_col:
        fields.append(Field("商品信息", FieldRole.DIMENSION, "string"))
    return DataSchema(upload_id=1, factory_id="F001", domain=Domain.RESTAURANT,
                      fields=tuple(fields), row_count=10, primary_measure="营业额")


def test_top_n_computes_from_parsed_items():
    rows = [
        {"商品信息": "可口可乐_1听*6+娃娃菜_2份*8", "营业额": 22.0},
        {"商品信息": "可口可乐_1听*6", "营业额": 6.0},
        {"商品信息": "娃娃菜_1份*8", "营业额": 8.0},
    ]
    backend = PolarsBackend.from_rows(rows)
    result = DishSalesTopN().run(backend, _schema())
    assert result.applies
    # 可口可乐 = 2 份 x 6 = 12 (revenue), 娃娃菜 = 3 份 x 8 = 24 (revenue)
    assert result.kpis["distinct_dishes"] == 2
    names_by_rev = [r["name"] for r in result.data["top_by_revenue"]]
    assert names_by_rev[0] == "娃娃菜"  # 24 > 12


def test_top_n_skip_when_no_item_column():
    rows = [{"门店名称": "A", "营业额": 100}]
    backend = PolarsBackend.from_rows(rows)
    result = DishSalesTopN().run(backend, _schema(has_item_col=False))
    assert not result.applies
