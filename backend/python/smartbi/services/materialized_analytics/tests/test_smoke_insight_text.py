"""test_smoke_insight_text.py — Smoke test to verify insight_text length and content
for the 9 K2-modified templates. Run with -s flag to see output.
"""
from smartbi.services.materialized_analytics.compute.polars_backend import PolarsBackend
from smartbi.services.materialized_analytics.schema import DataSchema, Domain, Field, FieldRole

from smartbi.services.materialized_analytics.templates.dish_sales_top_n import DishSalesTopN
from smartbi.services.materialized_analytics.templates.dish_slow_movers import DishSlowMovers
from smartbi.services.materialized_analytics.templates.channel_analysis import ChannelAnalysis
from smartbi.services.materialized_analytics.templates.staff_performance import StaffPerformance
from smartbi.services.materialized_analytics.templates.store_performance import StorePerformance
from smartbi.services.materialized_analytics.templates.member_consumption import MemberConsumption


def test_insight_includes_action_rec_dish_sales_top_n():
    schema = DataSchema(upload_id=1, factory_id='F001', domain=Domain.RESTAURANT,
        fields=tuple([Field('门店名称', FieldRole.DIMENSION, 'string'),
                      Field('营业额', FieldRole.MEASURE, 'float'),
                      Field('商品信息', FieldRole.DIMENSION, 'string')]),
        row_count=3, primary_measure='营业额')
    rows = [
        {'商品信息': '招牌青花椒鱼_2份*200+米饭_2份*5', '营业额': 410.0},
        {'商品信息': '招牌青花椒鱼_1份*200+饮料_1份*10', '营业额': 210.0},
    ]
    backend = PolarsBackend.from_rows(rows)
    result = DishSalesTopN().run(backend, schema)
    assert "建议: 针对" in result.insight_text
    assert "前置:" in result.insight_text
    assert "完成)" in result.insight_text
    assert len(result.insight_text) <= 400


def test_insight_includes_action_rec_dish_slow_movers():
    schema = DataSchema(upload_id=1, factory_id='F001', domain=Domain.RESTAURANT,
        fields=tuple([Field('商品信息', FieldRole.DIMENSION, 'string'),
                      Field('营业额', FieldRole.MEASURE, 'float')]),
        row_count=10, primary_measure='营业额')
    rows = [{'商品信息': '可口可乐_1听*6', '营业额': 6} for _ in range(10)]
    rows += [{'商品信息': '冷门菜A_1份*20', '营业额': 20}]
    rows += [{'商品信息': '冷门菜B_1份*15', '营业额': 15}]
    rows += [{'商品信息': '冷门菜C_1份*10', '营业额': 10}]
    backend = PolarsBackend.from_rows(rows)
    result = DishSlowMovers().run(backend, schema)
    assert "建议: 针对" in result.insight_text
    assert "前置:" in result.insight_text
    assert "完成)" in result.insight_text


def test_insight_includes_action_rec_channel_analysis():
    schema = DataSchema(upload_id=1, factory_id='F001', domain=Domain.RESTAURANT,
        fields=tuple([Field('订单来源', FieldRole.DIMENSION, 'string'),
                      Field('营业额', FieldRole.MEASURE, 'float')]),
        row_count=5, primary_measure='营业额')
    rows = [
        {'订单来源': '店内桌位单', '营业额': 400},
        {'订单来源': '店内桌位单', '营业额': 600},
        {'订单来源': '美团外卖', '营业额': 200},
        {'订单来源': '饿了么', '营业额': 100},
        {'订单来源': '微信', '营业额': 50},
    ]
    backend = PolarsBackend.from_rows(rows)
    result = ChannelAnalysis().run(backend, schema)
    assert "建议: 针对" in result.insight_text
    assert "前置:" in result.insight_text


def test_insight_includes_action_rec_staff_performance():
    schema = DataSchema(upload_id=1, factory_id='F001', domain=Domain.RESTAURANT,
        fields=tuple([Field('服务员', FieldRole.DIMENSION, 'string'),
                      Field('营业额', FieldRole.MEASURE, 'float')]),
        row_count=4, primary_measure='营业额')
    rows = [
        {'服务员': '杨生', '营业额': 4000},
        {'服务员': '杨生', '营业额': 5000},
        {'服务员': '李四', '营业额': 1000},
        {'服务员': '王五', '营业额': 3000},
    ]
    backend = PolarsBackend.from_rows(rows)
    result = StaffPerformance().run(backend, schema)
    assert "建议: 针对" in result.insight_text
    assert "前置:" in result.insight_text


def test_insight_includes_action_rec_store_performance():
    schema = DataSchema(upload_id=1, factory_id='F001', domain=Domain.RESTAURANT,
        fields=tuple([Field('门店名称', FieldRole.DIMENSION, 'string'),
                      Field('营业额', FieldRole.MEASURE, 'float')]),
        row_count=3, primary_measure='营业额')
    rows = [
        {'门店名称': '青花椒徐汇日月光店', '营业额': 10000},
        {'门店名称': '青花椒徐汇日月光店', '营业额': 15000},
        {'门店名称': '青花椒长宁来福士店', '营业额': 5000},
        {'门店名称': '青花椒虹桥南丰城店', '营业额': 8000},
    ]
    backend = PolarsBackend.from_rows(rows)
    result = StorePerformance().run(backend, schema)
    assert "建议: 针对" in result.insight_text
    assert "前置:" in result.insight_text


def test_insight_includes_action_rec_member_consumption():
    schema = DataSchema(upload_id=1, factory_id='F001', domain=Domain.RESTAURANT,
        fields=tuple([Field('会员卡', FieldRole.MEASURE, 'float'),
                      Field('营业额', FieldRole.MEASURE, 'float')]),
        row_count=4, primary_measure='营业额')
    rows = [
        {'会员卡': 100, '营业额': 200},
        {'会员卡': 50, '营业额': 80},
        {'会员卡': 0, '营业额': 50},
        {'会员卡': 0, '营业额': 70},
    ]
    backend = PolarsBackend.from_rows(rows)
    result = MemberConsumption().run(backend, schema)
    assert "建议: 针对" in result.insight_text
    assert "前置:" in result.insight_text


def test_insight_print_for_audit(capsys):
    """Print all insight_texts for visual inspection — run with pytest -s."""
    schema_top_n = DataSchema(upload_id=1, factory_id='F001', domain=Domain.RESTAURANT,
        fields=tuple([Field('门店名称', FieldRole.DIMENSION, 'string'),
                      Field('营业额', FieldRole.MEASURE, 'float'),
                      Field('商品信息', FieldRole.DIMENSION, 'string')]),
        row_count=3, primary_measure='营业额')
    rows1 = [
        {'商品信息': '招牌青花椒鱼_2份*200', '营业额': 400},
        {'商品信息': '米饭_2份*5', '营业额': 10},
    ]
    r1 = DishSalesTopN().run(PolarsBackend.from_rows(rows1), schema_top_n)
    print('\n--- dish_sales_top_n ---')
    print(r1.insight_text)
    print(f'(len={len(r1.insight_text)})')

    schema_staff = DataSchema(upload_id=1, factory_id='F001', domain=Domain.RESTAURANT,
        fields=tuple([Field('服务员', FieldRole.DIMENSION, 'string'),
                      Field('营业额', FieldRole.MEASURE, 'float')]),
        row_count=4, primary_measure='营业额')
    rows3 = [
        {'服务员': '杨生', '营业额': 9000},
        {'服务员': '李四', '营业额': 1000},
    ]
    r3 = StaffPerformance().run(PolarsBackend.from_rows(rows3), schema_staff)
    print('\n--- staff_performance ---')
    print(r3.insight_text)
    print(f'(len={len(r3.insight_text)})')

    schema_member = DataSchema(upload_id=1, factory_id='F001', domain=Domain.RESTAURANT,
        fields=tuple([Field('会员卡', FieldRole.MEASURE, 'float'),
                      Field('营业额', FieldRole.MEASURE, 'float')]),
        row_count=4, primary_measure='营业额')
    rows4 = [
        {'会员卡': 100, '营业额': 200},
        {'会员卡': 50, '营业额': 80},
        {'会员卡': 0, '营业额': 50},
        {'会员卡': 0, '营业额': 70},
    ]
    r4 = MemberConsumption().run(PolarsBackend.from_rows(rows4), schema_member)
    print('\n--- member_consumption ---')
    print(r4.insight_text)
    print(f'(len={len(r4.insight_text)})')
