"""test_template_staff_performance.py"""
from smartbi.services.materialized_analytics.compute.polars_backend import PolarsBackend
from smartbi.services.materialized_analytics.schema import DataSchema, Domain, Field, FieldRole
from smartbi.services.materialized_analytics.templates.staff_performance import StaffPerformance


def _schema():
    return DataSchema(upload_id=1, factory_id="F001", domain=Domain.RESTAURANT,
                      fields=tuple([Field("服务员", FieldRole.DIMENSION, "string"),
                                    Field("营业额", FieldRole.MEASURE, "float")]),
                      row_count=5, primary_measure="营业额")


def test_staff_ranking():
    rows = [
        {"服务员": "张三", "营业额": 100},
        {"服务员": "张三", "营业额": 200},
        {"服务员": "李四", "营业额": 50},
        {"服务员": "王五", "营业额": 400},
    ]
    backend = PolarsBackend.from_rows(rows)
    result = StaffPerformance().run(backend, _schema())
    assert result.applies
    assert result.kpis["role_type"] == "服务员"
    assert result.kpis["top_staff"] == "王五"  # 400 > 张三 300 > 李四 50, no ties
    assert result.kpis["top_revenue"] == 400
    assert result.kpis["staff_count"] == 3


def test_staff_skip_when_no_staff_col():
    schema = DataSchema(upload_id=1, factory_id="F001", domain=Domain.RESTAURANT,
                        fields=tuple([Field("营业额", FieldRole.MEASURE, "float")]),
                        row_count=1, primary_measure="营业额")
    backend = PolarsBackend.from_rows([{"营业额": 100}])
    result = StaffPerformance().run(backend, schema)
    assert not result.applies
