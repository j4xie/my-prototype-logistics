"""test_template_table_type_comparison.py"""
from smartbi.services.materialized_analytics.compute.polars_backend import PolarsBackend
from smartbi.services.materialized_analytics.schema import DataSchema, Domain, Field, FieldRole
from smartbi.services.materialized_analytics.templates.table_type_comparison import TableTypeComparison


def _schema():
    return DataSchema(upload_id=1, factory_id="F001", domain=Domain.RESTAURANT,
        fields=tuple([Field("桌位", FieldRole.DIMENSION, "string"),
                      Field("营业额", FieldRole.MEASURE, "float")]),
        row_count=10, primary_measure="营业额")


def test_table_type_splits_takeaway_vs_hall():
    rows = [
        {"桌位": "17", "营业额": 100},
        {"桌位": "23", "营业额": 150},
        {"桌位": "无桌位(美团外卖)", "营业额": 60},
        {"桌位": "无桌位(饿了么外卖)", "营业额": 80},
        {"桌位": "包厢VIP", "营业额": 500},
    ]
    backend = PolarsBackend.from_rows(rows)
    result = TableTypeComparison().run(backend, _schema())
    assert result.applies
    types_by_revenue = {t["type"]: t["revenue"] for t in result.data["types"]}
    assert "外卖" in types_by_revenue
    assert "大厅" in types_by_revenue
    assert types_by_revenue["外卖"] == 140  # 60 + 80
    assert types_by_revenue["大厅"] == 250  # 100 + 150


def test_table_type_skip_when_no_table_col():
    schema = DataSchema(upload_id=1, factory_id="F001", domain=Domain.RESTAURANT,
        fields=tuple([Field("营业额", FieldRole.MEASURE, "float")]),
        row_count=1, primary_measure="营业额")
    backend = PolarsBackend.from_rows([{"营业额": 100}])
    result = TableTypeComparison().run(backend, schema)
    assert not result.applies
