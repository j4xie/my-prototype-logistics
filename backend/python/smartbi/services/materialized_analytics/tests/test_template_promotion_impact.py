"""test_template_promotion_impact.py"""
from smartbi.services.materialized_analytics.compute.polars_backend import PolarsBackend
from smartbi.services.materialized_analytics.schema import DataSchema, Domain, Field, FieldRole
from smartbi.services.materialized_analytics.templates.promotion_impact import PromotionImpact


def _schema(with_rate=True):
    fields = [Field("代金券优惠", FieldRole.MEASURE, "float"),
              Field("营业额", FieldRole.MEASURE, "float")]
    if with_rate:
        fields.append(Field("折扣率", FieldRole.MEASURE, "float"))
    return DataSchema(upload_id=1, factory_id="F001", domain=Domain.RESTAURANT,
        fields=tuple(fields), row_count=5, primary_measure="营业额")


def test_promotion_coupon_share():
    rows = [
        {"代金券优惠": 50, "营业额": 200, "折扣率": 25},  # coupon + heavy discount
        {"代金券优惠": 20, "营业额": 100, "折扣率": 20},  # coupon
        {"代金券优惠": 0, "营业额": 80, "折扣率": 0},     # no promo
        {"代金券优惠": 0, "营业额": 120, "折扣率": 5},    # light discount
    ]
    backend = PolarsBackend.from_rows(rows)
    result = PromotionImpact().run(backend, _schema())
    assert result.applies
    assert result.kpis["coupon_share_pct"] == 50.0  # 2/4
    assert result.kpis["total_coupon"] == 70


def test_promotion_skip_when_no_fields():
    schema = DataSchema(upload_id=1, factory_id="F001", domain=Domain.RESTAURANT,
        fields=tuple([Field("营业额", FieldRole.MEASURE, "float")]),
        row_count=1, primary_measure="营业额")
    backend = PolarsBackend.from_rows([{"营业额": 100}])
    result = PromotionImpact().run(backend, schema)
    assert not result.applies
