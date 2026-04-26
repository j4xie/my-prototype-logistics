"""Tests for smartbi.services.dataset_capabilities — UX-2 fix."""
from __future__ import annotations

from smartbi.services.dataset_capabilities import (
    build_capability_prompt_hint,
    detect_capabilities,
)


def _fields(*names):
    return [{'original_name': n} for n in names]


def test_xmx_member_only_dataset():
    """xmx tenant: only member-card fields, no sales/review."""
    caps = detect_capabilities(_fields(
        '会员卡号', '充值金额', '余额', '储值方式',
    ))
    assert caps.has('has_member')
    assert not caps.has('has_sales')
    assert not caps.has('has_review')
    assert not caps.has('has_dish')


def test_qhj_review_dataset():
    """qhj review export: review fields + store but no sales."""
    caps = detect_capabilities(_fields(
        '门店名称', '评分', '评论内容', '星级', '差评数',
    ))
    assert caps.has('has_review')
    assert caps.has('has_store')
    assert not caps.has('has_sales')


def test_gml_sales_dataset():
    """gml sales export: dish + sales + time."""
    caps = detect_capabilities(_fields(
        '商品编码', '商品名称', '销售金额', '销量', '日期',
    ))
    assert caps.has('has_dish')
    assert caps.has('has_sales')
    assert caps.has('has_time')


def test_empty_field_meta():
    caps = detect_capabilities([])
    assert caps.field_count == 0
    assert build_capability_prompt_hint(caps) == ""


def test_hint_includes_present_and_absent():
    caps = detect_capabilities(_fields('会员卡号', '余额'))
    hint = build_capability_prompt_hint(caps)
    assert "数据集能力边界" in hint
    assert "会员/储值" in hint
    # absent (sales/review) should be in 不含
    assert "本数据集**不含**" in hint
    assert "销售/营业额" in hint or "评价/评分" in hint
    # Must instruct LLM to NOT say "建议补充数据"
    assert "禁止建议" in hint or "不要" in hint


def test_hint_with_only_present_no_absent():
    """Datasets covering all 12 capabilities (rare) — hint omits 不含."""
    caps = detect_capabilities(_fields(
        '销售金额', '会员卡号', '评分', '商品名称', '门店名称',
        '日期', '支付方式', '美团渠道', '员工姓名', '利润',
        '库存', '促销',
    ))
    hint = build_capability_prompt_hint(caps)
    assert "数据集能力边界" in hint
    assert "本数据集**包含**" in hint
    # All 12 caps present → 不含 line should be absent
    assert "本数据集**不含**" not in hint


def test_xmx_29_2_actual_scenario():
    """Reproduce S4 audit xmx-fu-29-2 setup: query 'store comparison' but
    dataset has no store-level data."""
    caps = detect_capabilities(_fields('会员卡号', '充值金额', '余额'))
    hint = build_capability_prompt_hint(caps)
    # Without store/sales fields, LLM should be told NOT to fabricate
    # store-comparison answers.
    assert "门店/店铺" in hint
    assert "销售/营业额" in hint
