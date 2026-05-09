"""test_template_member_consumption.py"""
from smartbi.services.materialized_analytics.compute.polars_backend import PolarsBackend
from smartbi.services.materialized_analytics.schema import DataSchema, Domain, Field, FieldRole
from smartbi.services.materialized_analytics.templates.member_consumption import MemberConsumption


def _schema(with_time=False):
    fields = [Field("会员卡", FieldRole.MEASURE, "float"),
              Field("营业额", FieldRole.MEASURE, "float")]
    if with_time:
        fields.append(Field("营业日期", FieldRole.TIME, "datetime"))
    return DataSchema(upload_id=1, factory_id="F001", domain=Domain.RESTAURANT,
                      fields=tuple(fields), row_count=10, primary_measure="营业额",
                      time_field="营业日期" if with_time else None)


def test_member_consumption_calculates_share():
    rows = [
        {"会员卡": 100, "营业额": 200},   # member order
        {"会员卡": 50, "营业额": 80},     # member order
        {"会员卡": 0, "营业额": 50},      # non-member
        {"会员卡": 0, "营业额": 70},      # non-member
    ]
    backend = PolarsBackend.from_rows(rows)
    result = MemberConsumption().run(backend, _schema())
    assert result.applies
    assert result.kpis["member_orders"] == 2
    # member_revenue (营业额 for orders with 会员卡>0) = 200+80 = 280
    # total = 400, share = 70%
    assert result.kpis["member_share_pct"] == 70.0


def test_member_skip_when_no_member_column():
    schema = DataSchema(upload_id=1, factory_id="F001", domain=Domain.RESTAURANT,
                        fields=tuple([Field("营业额", FieldRole.MEASURE, "float")]),
                        row_count=1, primary_measure="营业额")
    backend = PolarsBackend.from_rows([{"营业额": 100}])
    result = MemberConsumption().run(backend, schema)
    assert not result.applies
