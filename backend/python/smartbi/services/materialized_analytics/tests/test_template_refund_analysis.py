"""test_template_refund_analysis.py"""
from smartbi.services.materialized_analytics.compute.polars_backend import PolarsBackend
from smartbi.services.materialized_analytics.schema import DataSchema, Domain, Field, FieldRole
from smartbi.services.materialized_analytics.templates.refund_analysis import RefundAnalysis


def _schema():
    return DataSchema(upload_id=1, factory_id="F001", domain=Domain.RESTAURANT,
                      fields=tuple([Field("订单状态", FieldRole.DIMENSION, "string"),
                                    Field("营业额", FieldRole.MEASURE, "float")]),
                      row_count=5, primary_measure="营业额")


def test_refund_strategy_a_counts_non_completed():
    rows = [
        {"订单状态": "已结账", "营业额": 100},
        {"订单状态": "已结账", "营业额": 200},
        {"订单状态": "已结账", "营业额": 150},
        {"订单状态": "撤单", "营业额": 80},
        {"订单状态": "退款", "营业额": 60},
    ]
    backend = PolarsBackend.from_rows(rows)
    result = RefundAnalysis().run(backend, _schema())
    assert result.applies
    assert result.kpis["refund_count"] == 2
    assert result.kpis["strategy"] == "A"


def test_refund_skip_when_no_signals():
    schema = DataSchema(upload_id=1, factory_id="F001", domain=Domain.RESTAURANT,
                        fields=tuple([Field("营业额", FieldRole.MEASURE, "float")]),
                        row_count=1, primary_measure="营业额")
    backend = PolarsBackend.from_rows([{"营业额": 100}])
    result = RefundAnalysis().run(backend, schema)
    assert not result.applies
