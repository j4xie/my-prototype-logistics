"""test_template_channel_analysis.py"""
from smartbi.services.materialized_analytics.compute.polars_backend import PolarsBackend
from smartbi.services.materialized_analytics.schema import DataSchema, Domain, Field, FieldRole
from smartbi.services.materialized_analytics.templates.channel_analysis import ChannelAnalysis


def _schema():
    return DataSchema(upload_id=1, factory_id="F001", domain=Domain.RESTAURANT,
                      fields=tuple([Field("订单来源", FieldRole.DIMENSION, "string"),
                                    Field("营业额", FieldRole.MEASURE, "float")]),
                      row_count=5, primary_measure="营业额")


def test_channel_buckets_splits_dine_takeaway():
    rows = [
        {"订单来源": "店内桌位单", "营业额": 400},  # 堂食
        {"订单来源": "店内桌位单", "营业额": 600},  # 堂食
        {"订单来源": "美团外卖", "营业额": 200},    # 外卖
        {"订单来源": "饿了么", "营业额": 100},      # 外卖
        {"订单来源": "微信", "营业额": 50},         # 自有
    ]
    backend = PolarsBackend.from_rows(rows)
    result = ChannelAnalysis().run(backend, _schema())
    assert result.applies
    # 堂食 1000 / 总 1350 = 74.1%
    assert abs(result.kpis["dine_in_share"] - 74.07) < 0.5
    # 外卖 300 / 1350 = 22.2%
    assert abs(result.kpis["takeaway_share"] - 22.22) < 0.5


def test_channel_skip_when_no_source_col():
    schema = DataSchema(upload_id=1, factory_id="F001", domain=Domain.RESTAURANT,
                        fields=tuple([Field("营业额", FieldRole.MEASURE, "float")]),
                        row_count=1, primary_measure="营业额")
    backend = PolarsBackend.from_rows([{"营业额": 100}])
    result = ChannelAnalysis().run(backend, schema)
    assert not result.applies
