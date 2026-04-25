"""test_action_rec_formatter.py — K2 / C-rec 8 helper tests."""
from smartbi.services.materialized_analytics.restaurant.action_rec_formatter import (
    format_action_rec,
    format_data_insufficient,
)


def test_format_action_rec_includes_all_4_fields():
    out = format_action_rec(
        object_target="青花椒徐汇日月光店",
        benefit_range="客单价提升 3-5%",
        prerequisite="服务员推销话术培训",
        timeline="本月内",
    )
    # Spec §4.3 requirements: a对象 b收益区间 c前置 d时间窗
    assert "青花椒徐汇日月光店" in out          # a 对象
    assert "客单价提升 3-5%" in out               # b 收益区间
    assert "服务员推销话术培训" in out            # c 前置
    assert "本月内" in out                        # d 时间窗
    assert "建议:" in out                         # 标准前缀
    assert "前置:" in out                         # 结构标识


def test_format_action_rec_uses_braces_for_object():
    out = format_action_rec("店A", "营收提升 10%", "调整菜单结构", "下季度")
    assert "【店A】" in out


def test_format_data_insufficient_signals_lack_of_data():
    out = format_data_insufficient(
        needed="补充门店客单价对标数据",
        next_action="联系产品组对接行业基准",
    )
    assert "数据不足" in out
    assert "补充门店客单价对标数据" in out
    assert "联系产品组对接行业基准" in out


def test_format_data_insufficient_default_next_action():
    out = format_data_insufficient(needed="补充客单价对标数据")
    assert "补充数据来源" in out
