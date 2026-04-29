"""test_template_weekday_weekend_pattern.py"""
from smartbi.services.materialized_analytics.compute.polars_backend import PolarsBackend
from smartbi.services.materialized_analytics.schema import DataSchema, Domain, Field, FieldRole
from smartbi.services.materialized_analytics.templates.weekday_weekend_pattern import WeekdayWeekendPattern


def _schema():
    return DataSchema(upload_id=1, factory_id="F001", domain=Domain.RESTAURANT,
        fields=tuple([Field("营业日期", FieldRole.TIME, "datetime"),
                      Field("营业额", FieldRole.MEASURE, "float")]),
        row_count=14, primary_measure="营业额", time_field="营业日期")


def test_weekday_weekend_split():
    # 2025-03-03 Monday ... 2025-03-09 Sunday
    rows = []
    # Weekday (Mon-Fri 3/3 ~ 3/7): 5 rows × 100
    for day in range(3, 8):
        rows.append({"营业日期": f"2025-03-{day:02d} 12:00:00", "营业额": 100})
    # Weekend (Sat-Sun 3/8, 3/9): 2 rows × 300
    rows.append({"营业日期": "2025-03-08 12:00:00", "营业额": 300})
    rows.append({"营业日期": "2025-03-09 12:00:00", "营业额": 300})
    # Doubled to meet row_count >= 14
    rows = rows * 2
    backend = PolarsBackend.from_rows(rows)
    result = WeekdayWeekendPattern().run(backend, _schema())
    assert result.applies
    # weekday total = 5 * 100 * 2 = 1000
    # weekend total = 2 * 300 * 2 = 1200
    # weekend_revenue_share = 1200 / 2200 = 54.5%
    assert result.kpis["weekend_revenue_share"] > 50.0


def test_weekday_weekend_skip_small_data():
    rows = [{"营业日期": "2025-03-01 12:00:00", "营业额": 100}]
    backend = PolarsBackend.from_rows(rows)
    schema = DataSchema(upload_id=1, factory_id="F001", domain=Domain.RESTAURANT,
        fields=tuple([Field("营业日期", FieldRole.TIME, "datetime"),
                      Field("营业额", FieldRole.MEASURE, "float")]),
        row_count=1, primary_measure="营业额", time_field="营业日期")
    result = WeekdayWeekendPattern().run(backend, schema)
    assert not result.applies
