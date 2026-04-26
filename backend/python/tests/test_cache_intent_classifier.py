"""Tests for template_intent_classifier — Phase 6 P1 cache mismatch reject.

Pure-python tests, no DB needed.
"""
from __future__ import annotations

from smartbi.services.cache_intent_classifier import (
    TEMPLATE_DOMAIN,
    classify_query_domain,
    should_reject_cache,
)


# ---------- classify_query_domain ----------

def test_classify_dish_keywords():
    assert classify_query_domain("畅销品 Top 5") == 'dish'
    assert classify_query_domain("哪些菜卖得最好") == 'dish'
    assert classify_query_domain("滞销菜品有哪些") == 'dish'


def test_classify_store_keywords():
    assert classify_query_domain("哪家店业绩最好") == 'store'
    assert classify_query_domain("门店排名") == 'store'
    assert classify_query_domain("单店表现如何") == 'store'


def test_classify_payment_keywords():
    assert classify_query_domain("微信支付占比") == 'payment'
    assert classify_query_domain("现金付款多少") == 'payment'


def test_classify_finance_priority_over_time():
    # "上月利润" contains both "月" (time) and "利润" (finance) — finance wins.
    assert classify_query_domain("上月利润多少") == 'finance'


def test_classify_review_keywords():
    assert classify_query_domain("客户评价怎么样") == 'review'
    assert classify_query_domain("差评率多少") == 'review'


def test_classify_returns_none_when_unclassifiable():
    assert classify_query_domain("") is None
    assert classify_query_domain("hello") is None
    assert classify_query_domain("数据情况") is None  # no domain-specific hint


def test_classify_xmx_fu_29_2_actual_query():
    # The S3 audit failure case — query mentions "单店" + "同业" (store domain).
    assert classify_query_domain("单店 vs 区域同业差距通常多少") == 'store'


# ---------- should_reject_cache ----------

def test_reject_xmx_fu_29_2_payment_mismatch():
    # The exact case that motivated this module: store-domain query mistakenly
    # routed to payment_method_mix — must be rejected.
    assert should_reject_cache(
        "单店 vs 区域同业差距通常多少", "payment_method_mix"
    ) is True


def test_allow_cache_when_domain_aligned():
    assert should_reject_cache(
        "微信支付占比", "payment_method_mix"
    ) is False
    assert should_reject_cache(
        "畅销品 Top 5", "dish_sales_top_n"
    ) is False
    assert should_reject_cache(
        "哪家店业绩最好", "store_performance"
    ) is False


def test_allow_top_n_by_dim_for_native_domains():
    # top_n_by_dim is multi-domain. Native domains (dish/store/channel/etc.)
    # should be allowed.
    assert should_reject_cache("畅销品 Top 5", "top_n_by_dim") is False
    assert should_reject_cache("哪家店业绩最好", "top_n_by_dim") is False
    assert should_reject_cache("微信支付占比", "top_n_by_dim") is False


def test_reject_top_n_by_dim_for_mismatch_domains():
    # S4 audit P0 fix: top_n_by_dim is unsuitable for review/finance/staff/etc.
    # qhj-fu-15-1 case: review query routed to top_n_by_dim sales — must reject.
    assert should_reject_cache(
        "Top 1 提及菜被夸什么", "top_n_by_dim"
    ) is True
    assert should_reject_cache(
        "员工业绩排名", "top_n_by_dim"
    ) is True
    assert should_reject_cache(
        "上月利润 Top 3 来源", "top_n_by_dim"
    ) is True
    assert should_reject_cache(
        "异常订单 Top 5", "top_n_by_dim"
    ) is True


def test_allow_when_query_undetectable():
    # No domain hint in query — don't risk false positive.
    assert should_reject_cache(
        "数据情况", "payment_method_mix"
    ) is False
    assert should_reject_cache(
        "", "dish_sales_top_n"
    ) is False


def test_reject_dish_query_on_finance_template():
    # Reverse class: dish query mistakenly routed to a finance template.
    assert should_reject_cache(
        "畅销菜品有哪些", "profit_loss_statement"
    ) is True


def test_reject_review_query_on_member_template():
    assert should_reject_cache(
        "差评率多少", "member_consumption"
    ) is True


def test_classify_manufacturing_domains():
    # Apr 26 2026 A1: F001/F002/F003 制造业租户的查询
    assert classify_query_domain("不良率多少") == 'quality'
    assert classify_query_domain("良品率走势") == 'quality'
    assert classify_query_domain("客诉数") == 'quality'
    assert classify_query_domain("设备 OEE") == 'equipment'
    assert classify_query_domain("产线稼动率") == 'equipment'
    assert classify_query_domain("机台故障次数") == 'equipment'
    assert classify_query_domain("工单完成率") == 'production'
    assert classify_query_domain("批次良率") == 'production'
    assert classify_query_domain("工序排产") == 'production'


def test_reject_top_n_for_manufacturing_domains():
    # Manufacturing query routed to top_n_by_dim (餐饮 Top-N) → reject.
    assert should_reject_cache("不良率 Top 5 工序", "top_n_by_dim") is True
    assert should_reject_cache("OEE Top 10 设备", "top_n_by_dim") is True
    assert should_reject_cache("良率最低工单 Top 3", "top_n_by_dim") is True


def test_manufacturing_priority_over_time():
    # "工序异常率本月" 含 quality(异常) + production(工序) + time(本月) — 制造业先
    assert classify_query_domain("工序异常率本月") in ('production', 'quality')
    # "本月不良率" — 含 finance(?) + time + quality — quality 先
    assert classify_query_domain("本月不良率") == 'quality'


def test_template_domain_coverage():
    # Sanity: TEMPLATE_DOMAIN covers the main known templates from the
    # Apr 26 audit. Specifically the F4 case template must be mapped.
    assert TEMPLATE_DOMAIN.get('payment_method_mix') == 'payment'
    assert TEMPLATE_DOMAIN.get('dish_sales_top_n') == 'dish'
    assert TEMPLATE_DOMAIN.get('store_performance') == 'store'
    assert TEMPLATE_DOMAIN.get('reviews_sentiment_summary') == 'review'
    # top_n_by_dim is intentionally absent (multi-domain).
    assert 'top_n_by_dim' not in TEMPLATE_DOMAIN
