"""test_template_monthly_trend.py"""
import pytest
from smartbi.services.materialized_analytics.compute.polars_backend import PolarsBackend
from smartbi.services.materialized_analytics.schema import (
    DataSchema, Domain, Field, FieldRole,
)
from smartbi.services.materialized_analytics.templates.monthly_trend import MonthlyTrend


@pytest.fixture
def time_series_schema() -> DataSchema:
    return DataSchema(
        upload_id=1, factory_id="F001", domain=Domain.RESTAURANT,
        fields=tuple([
            Field("订单日期", FieldRole.TIME, "datetime"),
            Field("销售金额", FieldRole.MEASURE, "float"),
        ]),
        row_count=10, primary_measure="销售金额", time_field="订单日期",
    )


def test_monthly_trend_daily_small_range(time_series_schema):
    rows = [
        {"订单日期": "2026-01-01", "销售金额": 100.0},
        {"订单日期": "2026-01-02", "销售金额": 200.0},
        {"订单日期": "2026-01-03", "销售金额": 50.0},
    ]
    backend = PolarsBackend.from_rows(rows)
    result = MonthlyTrend().run(backend, time_series_schema)
    assert result.applies
    assert result.data["freq"] == "D"
    assert result.kpis["peak_value"] == 200.0
    assert result.kpis["trough_value"] == 50.0


def test_monthly_trend_skip_when_no_time_field():
    schema = DataSchema(
        upload_id=1, factory_id="F001", domain=Domain.RESTAURANT,
        fields=tuple([Field("销售金额", FieldRole.MEASURE, "float")]),
        row_count=1, primary_measure="销售金额", time_field=None,
    )
    backend = PolarsBackend.from_rows([{"销售金额": 100.0}])
    result = MonthlyTrend().run(backend, schema)
    assert not result.applies
