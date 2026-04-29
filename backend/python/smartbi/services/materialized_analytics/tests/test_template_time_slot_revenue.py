"""test_template_time_slot_revenue.py"""
import pytest
from smartbi.services.materialized_analytics.compute.polars_backend import PolarsBackend
from smartbi.services.materialized_analytics.schema import DataSchema, Domain, Field, FieldRole
from smartbi.services.materialized_analytics.templates.time_slot_revenue import TimeSlotRevenue


def _schema():
    return DataSchema(upload_id=1, factory_id="F001", domain=Domain.RESTAURANT,
        fields=tuple([Field("开单时间", FieldRole.TIME, "datetime"),
                      Field("区域", FieldRole.DIMENSION, "string"),
                      Field("营业额", FieldRole.MEASURE, "float")]),
        row_count=10, primary_measure="营业额", time_field="开单时间")


def test_time_slot_buckets():
    rows = [
        {"开单时间": "2025-03-01 12:00:00", "区域": "A", "营业额": 100},  # 午餐
        {"开单时间": "2025-03-01 12:30:00", "区域": "A", "营业额": 150},  # 午餐
        {"开单时间": "2025-03-01 19:00:00", "区域": "B", "营业额": 300},  # 晚餐
    ]
    backend = PolarsBackend.from_rows(rows)
    result = TimeSlotRevenue().run(backend, _schema())
    assert result.applies
    assert result.kpis["peak_slot"] == "晚餐"
    assert result.kpis["peak_area"] == "B"
    assert result.kpis["peak_revenue"] == 300


def test_time_slot_skip_no_time():
    schema = DataSchema(upload_id=1, factory_id="F001", domain=Domain.RESTAURANT,
        fields=tuple([Field("区域", FieldRole.DIMENSION, "string"),
                      Field("营业额", FieldRole.MEASURE, "float")]),
        row_count=1, primary_measure="营业额", time_field=None)
    backend = PolarsBackend.from_rows([{"区域": "A", "营业额": 100}])
    result = TimeSlotRevenue().run(backend, schema)
    assert not result.applies
