"""Phase 2B-2 chat-2B-region pilot tests — /analysis/region endpoint.

Tier 2 domain-critical backfill per
``docs/qa-audits/2026-05-12-python-migration-test-coverage-audit.md`` §2.3
row "region" + §3 priorities row 16. Mirrors ``test_analysis_sales_pilot.py``
sister pattern (auth boundary, factory-scope, role gating, fixtured engine
seam) and ``test_config_thresholds_pilot.py`` gold-standard scaffolding.

Coverage (Rule 1 / 4 / 6 / 7 / 8 / 9 / 10 / 12 per
``.claude/rules/python-java-port.md`` plus 13 R-T traps documented inline in
``analysis_region.py``):

* Constants — heatmap + target-completion thresholds (R-T9 Decimal compare,
  Rule 7).
* ``RegionAggregation`` dataclass — Rule 1 explicit ``is not None``, R-T6
  customer_count incremental sync, R-T11 gross_margin stays ``Decimal('0')``
  on amount=0 (NOT None).
* SQL seam — ``_query_region_full`` engine happy / Rule 6 None-date guard
  (start_date AND end_date both raise).
* Period helper — ``_previous_period_window`` R-T5 adjacent-mirrored window
  including single-day edge.
* Aggregation helpers — ``_aggregate_by_region`` / ``_aggregate_by_province``
  R-T8 '未分类' bucket for null/empty key.
* Score helpers — ``_calculate_growth_score`` (R-T4 +50→100 cap),
  ``_calculate_base_score`` (R-T3 33.33%→99.99 NOT 100),
  ``_calculate_margin_score`` (R-T2 Decimal('3.33') NOT float 3.33),
  ``_calculate_penetration_score`` (R-T1 INTEGER division),
  ``_calculate_total_score`` (Rule 1 None→Decimal('0') coerce).
* Level helper — ``_determine_opportunity_level`` boundary 70/40 + None.
* Heatmap helpers — ``_normalize_province_name`` (R-T7 sequential regex,
  自治区 BEFORE 壮族/回族/维吾尔 in 广西/新疆/宁夏 normalization),
  ``_determine_color_level`` (R-T9 Decimal compare boundaries 0.7/0.3).
* Completion — ``_calculate_completion_rate`` (R-T13 LOCK divide-quantize-
  multiply order — DIFFERENT from sales/department divide-multiply-quantize).
* Alerting — ``_determine_target_completion_alert`` (Rule 12 strict < at
  60/85), ``_determine_direction`` (Rule 1 explicit None / equality
  STABLE), ``_format_amount`` (None → "0.00" + comma separator).
* Recommendation — ``_generate_opportunity_recommendation`` HIGH/MEDIUM/LOW
  templating + LinkedHashMap insertion-order tie-break for dim max/min.
* Sub-services — ``_build_region_ranking`` / ``_build_region_target_completion``
  (F7: 11-field MetricResult including changeValue=null, Rule 9 emit) /
  ``_build_geographic_heatmap`` (F1 lowercase 'a' xaxisField, F2 7-field
  empty ChartConfig, Rule 8 Map.of(4) options + Map.of(3) visualMap key
  order) / ``_build_opportunity_scores`` (R-T12 13-field
  RegionOpportunityScore declaration order).
* Dispatcher — ``_get_region_analysis`` 6-key composite top-level order
  (heatmap → targetCompletion → dateRange → opportunityScores → generatedAt
  → ranking — F999 golden HashMap hash-bucket order, NOT source insertion).
* Endpoint — ``GET /analysis/region`` auth boundary (401 / 403) + happy
  6-key envelope + ignored ``region`` query param.
"""
from __future__ import annotations

import os
from dataclasses import dataclass
from datetime import date
from decimal import Decimal
from typing import Optional

import jwt
import pytest

os.environ.setdefault("JWT_SECRET", "phase-2b-region-pilot-test-secret")

from smartbi_compat.api import analysis_region as mod  # noqa: E402
from smartbi_compat.api.analysis_region import RegionAggregation  # noqa: E402
from smartbi_compat.auth import JWT_ALGORITHM  # noqa: E402
from smartbi_compat.date_range import DateRange  # noqa: E402

# Phase 2B endpoint coverage marker (see conftest.py KNOWN_ENDPOINTS).
pytestmark = [pytest.mark.api_endpoint("analysis_region")]


JWT_SECRET = "phase-2b-region-pilot-test-secret"


# ============================================================
# Fixtures
# ============================================================


def _make_token(
    *,
    factory_id: Optional[str] = "F001",
    role: str = "factory_super_admin",
    exp_offset: int = 3600,
) -> str:
    from time import time

    payload: dict = {
        "userId": 22,
        "username": "alice",
        "role": role,
        "exp": int(time()) + exp_offset,
    }
    if factory_id is not None:
        payload["factoryId"] = factory_id
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def _auth_header(token: Optional[str] = None, **kw) -> dict:
    if token is None:
        token = _make_token(**kw)
    return {"Authorization": f"Bearer {token}"}


def _make_row(
    *,
    region: Optional[str] = "华东",
    province: Optional[str] = "上海市",
    customer_name: Optional[str] = "客户A",
    amount: Optional[Decimal] = Decimal("1000"),
    cost: Optional[Decimal] = Decimal("600"),
    monthly_target: Optional[Decimal] = Decimal("1500"),
) -> dict:
    """Mirror smart_bi_sales_data row (dict shape from SELECT *)."""
    return {
        "id": 1,
        "factory_id": "F001",
        "region": region,
        "province": province,
        "customer_name": customer_name,
        "amount": amount,
        "cost": cost,
        "monthly_target": monthly_target,
        "order_date": date(2026, 5, 15),
    }


class _FakeEngine:
    """Stub for _get_sync_engine — returns _FakeConn yielding preset rows."""

    def __init__(self, rows=None, should_raise: bool = False):
        self._rows = rows or []
        self._should_raise = should_raise

    def connect(self):
        return _FakeConn(self._rows, self._should_raise)


class _FakeConn:
    def __init__(self, rows, should_raise):
        self._rows = rows
        self._should_raise = should_raise

    def __enter__(self):
        return self

    def __exit__(self, *_):
        return False

    def execute(self, *args, **kwargs):
        if self._should_raise:
            raise RuntimeError("simulated engine failure")
        return _FakeResult(self._rows)


class _FakeResult:
    """Yields SQLAlchemy-style Row objects with `_mapping` dict access."""

    def __init__(self, rows):
        self._rows = rows

    def fetchall(self):
        return [_FakeRow(r) for r in self._rows]


class _FakeRow:
    def __init__(self, mapping):
        self._mapping = mapping


@pytest.fixture
def q1_range() -> DateRange:
    return DateRange.custom(date(2026, 1, 1), date(2026, 3, 31))


@pytest.fixture
def client():
    from fastapi import FastAPI
    from fastapi.testclient import TestClient

    app = FastAPI()
    app.include_router(mod.router)
    return TestClient(app)


# ============================================================
# Constants — alert thresholds (R-T9 Decimal compare, Rule 7)
# ============================================================


def test_constants_target_completion_thresholds_are_decimals():
    """Rule 7 — non-integer thresholds, must be Decimal not float."""
    assert mod._REGION_TARGET_COMPLETION_RED == Decimal("60")
    assert mod._REGION_TARGET_COMPLETION_YELLOW == Decimal("85")
    assert isinstance(mod._REGION_TARGET_COMPLETION_RED, Decimal)
    assert isinstance(mod._REGION_TARGET_COMPLETION_YELLOW, Decimal)


def test_constants_heatmap_thresholds_are_decimals_rule7():
    """R-T9 LOCK + Rule 7 — heatmap thresholds 0.7 / 0.3 MUST be Decimal.
    Float compare on 0.7 is corner-case prone (IEEE 754)."""
    assert mod._HEATMAP_HIGH == Decimal("0.7")
    assert mod._HEATMAP_MEDIUM == Decimal("0.3")
    assert isinstance(mod._HEATMAP_HIGH, Decimal)
    assert isinstance(mod._HEATMAP_MEDIUM, Decimal)


# ============================================================
# RegionAggregation — Rule 1, R-T6, R-T11
# ============================================================


def test_region_aggregation_default_zero_decimals():
    agg = RegionAggregation()
    assert agg.total_amount == Decimal("0")
    assert agg.total_cost == Decimal("0")
    assert agg.total_target == Decimal("0")
    assert agg.gross_margin == Decimal("0")
    assert agg.order_count == 0
    assert agg.customer_count == 0
    assert agg.customers == set()


def test_region_aggregation_add_sale_zero_amount_still_aggregates_rule1():
    """Rule 1 — Decimal('0') is Python falsy but Java != null is True.
    add_sale must use `is not None`, so a row with amount=Decimal('0')
    still adds the value AND increments order_count."""
    agg = RegionAggregation()
    agg.add_sale(_make_row(amount=Decimal("0"), cost=Decimal("0")))
    assert agg.order_count == 1
    assert agg.total_amount == Decimal("0")  # Decimal('0') accumulated, not skipped
    assert agg.total_cost == Decimal("0")


def test_region_aggregation_add_sale_skips_none_amount_keeps_order_count():
    """None vs Decimal('0') distinction — None should NOT accumulate, but
    order_count still ticks (Java line 1192 increments unconditionally)."""
    agg = RegionAggregation()
    agg.add_sale(_make_row(amount=None, cost=None, monthly_target=None))
    assert agg.order_count == 1
    assert agg.total_amount == Decimal("0")
    assert agg.total_cost == Decimal("0")


def test_region_aggregation_customer_count_synced_per_call_rt6():
    """R-T6 LOCK — Java line 1198 syncs customer_count = customers.size()
    after every add_sale call. Python mirror must do same: not lazy."""
    agg = RegionAggregation()
    agg.add_sale(_make_row(customer_name="客户A"))
    assert agg.customer_count == 1
    agg.add_sale(_make_row(customer_name="客户B"))
    assert agg.customer_count == 2
    agg.add_sale(_make_row(customer_name="客户A"))  # dedup
    assert agg.customer_count == 2


def test_region_aggregation_customer_name_empty_string_skipped():
    """Java line 1195: `cn != null && !cn.isEmpty()`. Empty string skipped."""
    agg = RegionAggregation()
    agg.add_sale(_make_row(customer_name=""))
    agg.add_sale(_make_row(customer_name=None))
    assert agg.customer_count == 0
    assert agg.customers == set()


def test_region_aggregation_calculate_gross_margin_zero_amount_stays_zero_rt11():
    """R-T11 LOCK — total_amount == 0 → gross_margin stays Decimal('0'),
    NOT None and NOT divide-by-zero exception."""
    agg = RegionAggregation()
    agg.calculate_gross_margin()
    assert agg.gross_margin == Decimal("0")


def test_region_aggregation_calculate_gross_margin_happy():
    """gross_profit = amount - cost; margin = (profit/amount).quantize(4) * 100.
    400 / 1000 = 0.4000 * 100 = 40.0000."""
    agg = RegionAggregation()
    agg.add_sale(_make_row(amount=Decimal("1000"), cost=Decimal("600")))
    agg.calculate_gross_margin()
    assert agg.gross_margin == Decimal("40.0000")


# ============================================================
# _query_region_full — Rule 6 None-check + engine seam
# ============================================================


@pytest.mark.asyncio
async def test_query_region_full_rejects_none_start_date_rule6():
    """Rule 6 — start_date None must raise ValueError, NOT silently return []."""
    with pytest.raises(ValueError, match="start_date/end_date required"):
        await mod._query_region_full("F001", None, date(2026, 5, 31))


@pytest.mark.asyncio
async def test_query_region_full_rejects_none_end_date_rule6():
    """Rule 6 — end_date None must raise ValueError."""
    with pytest.raises(ValueError, match="start_date/end_date required"):
        await mod._query_region_full("F001", date(2026, 5, 1), None)


@pytest.mark.asyncio
async def test_query_region_full_happy_path(monkeypatch):
    """Engine returns rows → caller gets list of dicts via _mapping."""
    fixture_rows = [
        _make_row(region="华东"),
        _make_row(region="华南", customer_name="客户B"),
    ]
    monkeypatch.setattr(
        mod, "_get_sync_engine", lambda: _FakeEngine(rows=fixture_rows),
    )

    result = await mod._query_region_full(
        "F001", date(2026, 1, 1), date(2026, 3, 31),
    )
    assert len(result) == 2
    assert result[0]["region"] == "华东"
    assert result[1]["region"] == "华南"


# ============================================================
# _previous_period_window — R-T5 adjacent mirror, NOT YoY
# ============================================================


def test_previous_period_window_multi_day_range():
    """Java ChronoUnit.DAYS.between(start, end) ≡ Python (end - start).days.
    [1/1, 1/10] → days_between=9, prev=[12/22, 12/31]."""
    prev_start, prev_end = mod._previous_period_window(
        date(2026, 1, 10), date(2026, 1, 19),
    )
    assert prev_start == date(2025, 12, 31)  # 1/10 - (9+1) days
    assert prev_end == date(2026, 1, 9)      # 1/10 - 1 day


def test_previous_period_window_single_day_edge():
    """start == end → days_between=0, prev_start==prev_end==start - 1day."""
    prev_start, prev_end = mod._previous_period_window(
        date(2026, 5, 15), date(2026, 5, 15),
    )
    assert prev_start == date(2026, 5, 14)
    assert prev_end == date(2026, 5, 14)


def test_previous_period_window_full_quarter():
    """Q1 2026 [1/1, 3/31] = 89 days → prev=[10/3 2025, 12/31 2025]."""
    prev_start, prev_end = mod._previous_period_window(
        date(2026, 1, 1), date(2026, 3, 31),
    )
    assert prev_start == date(2025, 10, 3)
    assert prev_end == date(2025, 12, 31)


# ============================================================
# _aggregate_by_region / _aggregate_by_province — R-T8 '未分类' bucket
# ============================================================


def test_aggregate_by_region_groups_and_calls_calculate_gross_margin():
    rows = [
        _make_row(region="华东", amount=Decimal("1000"), cost=Decimal("600")),
        _make_row(region="华南", amount=Decimal("500"), cost=Decimal("300")),
        _make_row(region="华东", amount=Decimal("2000"), cost=Decimal("1200")),
    ]
    aggs = mod._aggregate_by_region(rows)
    assert set(aggs.keys()) == {"华东", "华南"}
    # 华东: 3000 amount, 1800 cost → margin = (1200/3000).quantize(4) * 100 = 40.0000
    assert aggs["华东"].total_amount == Decimal("3000")
    assert aggs["华东"].gross_margin == Decimal("40.0000")
    # 华南: 500 amount, 300 cost → margin = (200/500).quantize(4) * 100 = 40.0000
    assert aggs["华南"].gross_margin == Decimal("40.0000")


def test_aggregate_by_region_null_or_empty_region_buckets_to_unclassified_rt8():
    """R-T8 LOCK — null OR empty-string region → '未分类' bucket."""
    rows = [
        _make_row(region=None, amount=Decimal("100")),
        _make_row(region="", amount=Decimal("200")),
        _make_row(region="华东", amount=Decimal("300")),
    ]
    aggs = mod._aggregate_by_region(rows)
    assert "未分类" in aggs
    assert "华东" in aggs
    # null + empty merged into single '未分类' bucket
    assert aggs["未分类"].total_amount == Decimal("300")


def test_aggregate_by_province_null_or_empty_province_buckets_to_unclassified_rt8():
    """R-T8 also applies to province aggregation (impl line 679-697)."""
    rows = [
        _make_row(province=None, amount=Decimal("100")),
        _make_row(province="", amount=Decimal("200")),
    ]
    aggs = mod._aggregate_by_province(rows)
    assert list(aggs.keys()) == ["未分类"]
    assert aggs["未分类"].total_amount == Decimal("300")


# ============================================================
# Score helpers — R-T1, R-T2, R-T3, R-T4
# ============================================================


def test_calculate_growth_score_happy_zero_growth_yields_50():
    """growth=0 (current==previous) → score = 0 + 50 = 50."""
    assert mod._calculate_growth_score(Decimal("100"), Decimal("100")) == Decimal("50")


def test_calculate_growth_score_clamps_high_to_100_rt4():
    """R-T4 — +50% growth → score = 100. +200% → STILL 100 (clamp)."""
    # current=300, prev=100 → growth = +200% → 200+50=250 → clamp to 100
    score = mod._calculate_growth_score(Decimal("300"), Decimal("100"))
    assert score == Decimal("100")


def test_calculate_growth_score_minus_50_growth_clamps_to_zero_rt4():
    """R-T4 LOCK — current=50, prev=100 → growth=-50% → score = -50+50 = 0.
    Below -50% (prev=100, curr=25 → -75) → -25 → clamps to Decimal('0')."""
    # Boundary: -50 growth → 0 score
    score_boundary = mod._calculate_growth_score(Decimal("50"), Decimal("100"))
    assert score_boundary == Decimal("0.00")
    # Below boundary (-75 growth) → clamp to 0
    score_clamp = mod._calculate_growth_score(Decimal("25"), Decimal("100"))
    assert score_clamp == Decimal("0")


def test_calculate_growth_score_negative_growth_yields_below_50():
    """current=80, prev=100 → growth = -20 → score = -20+50 = 30."""
    assert mod._calculate_growth_score(Decimal("80"), Decimal("100")) == Decimal("30.00")


def test_calculate_base_score_thirty_three_pct_yields_99_99_rt3():
    """R-T3 LOCK — 33.33...% caps at 99.99 (NOT 100). Java line 1035-1042
    ratio = (region/total).quantize(4) * 100 = 33.33 → * 3 = 99.99.
    Only 33.34%+ caps at 100."""
    score = mod._calculate_base_score(Decimal("1"), Decimal("3"))
    # 1/3 = 0.3333 (quantize 4 HALF_UP) * 100 = 33.3300 * 3 = 99.9900
    assert score == Decimal("99.9900")


def test_calculate_base_score_above_one_third_caps_at_100_rt3():
    """region/total = 0.34 → * 100 = 34 → * 3 = 102 → clamp to 100."""
    score = mod._calculate_base_score(Decimal("34"), Decimal("100"))
    assert score == Decimal("100")


def test_calculate_base_score_total_sales_zero_returns_zero():
    """Division-by-zero guard — Java line 1037-1039 returns ZERO."""
    assert mod._calculate_base_score(Decimal("100"), Decimal("0")) == Decimal("0")


def test_calculate_margin_score_thirty_pct_yields_99_9_rt2():
    """R-T2 LOCK — Java uses Decimal('3.33') EXACT (NOT float 3.33).
    grossMargin = 30 (already × 100, percentage units).
    score = 30 * 3.33 = 99.90 (NOT 100). Only 30.04%+ caps."""
    score = mod._calculate_margin_score(Decimal("30"))
    assert score == Decimal("99.90")


def test_calculate_margin_score_above_threshold_caps_at_100_rt2():
    """grossMargin = 50 → 50 * 3.33 = 166.50 → clamp to 100."""
    assert mod._calculate_margin_score(Decimal("50")) == Decimal("100")


def test_calculate_margin_score_none_returns_zero():
    """None safety — returns Decimal('0')."""
    assert mod._calculate_margin_score(None) == Decimal("0")


def test_calculate_penetration_score_uses_integer_division_rt1():
    """R-T1 LOCK — Java int / int = floor div.
    customers=5, orders=37 → 5*10 + 37//10 = 50 + 3 = 53 (NOT 50+3.7=53.7)."""
    score = mod._calculate_penetration_score(5, 37)
    assert score == Decimal("53")


def test_calculate_penetration_score_caps_at_100_rt1():
    """customers=10, orders=100 → 100 + 10 = 110 → clamp to 100."""
    assert mod._calculate_penetration_score(10, 100) == Decimal("100")


def test_calculate_penetration_score_handles_str_int_decimal_input_rt1():
    """R-T1 — int() coerce defends against asyncpg returning Decimal/str."""
    # asyncpg may return Decimal for COUNT() outputs in some configs
    score = mod._calculate_penetration_score(Decimal("3"), Decimal("25"))
    assert score == Decimal("32")  # 3*10 + 25//10 = 30+2


def test_calculate_total_score_uses_correct_weights():
    """Weights g*0.30 + b*0.25 + m*0.25 + p*0.20 = 1.00.
    All scores 100 → total = 100."""
    score = mod._calculate_total_score(
        Decimal("100"), Decimal("100"), Decimal("100"), Decimal("100"),
    )
    assert score == Decimal("100.00")


def test_calculate_total_score_none_args_coerce_to_zero_rule1():
    """Rule 1 — explicit `is not None` for None-guard. None → Decimal('0')."""
    score = mod._calculate_total_score(None, None, None, None)
    assert score == Decimal("0.00")


def test_calculate_total_score_partial_none_only_zeros_those_args():
    """g=80 only, others None → 80 * 0.30 = 24.0."""
    assert mod._calculate_total_score(
        Decimal("80"), None, None, None,
    ) == Decimal("24.00")


# ============================================================
# _determine_opportunity_level — boundary 70 / 40
# ============================================================


@pytest.mark.parametrize("score,expected", [
    (None, "LOW"),
    (Decimal("0"), "LOW"),       # Rule 1 — Decimal('0') NOT falsy, hits <40 → LOW
    (Decimal("39.99"), "LOW"),
    (Decimal("40"), "MEDIUM"),   # boundary >= 40
    (Decimal("69.99"), "MEDIUM"),
    (Decimal("70"), "HIGH"),     # boundary >= 70
    (Decimal("100"), "HIGH"),
])
def test_determine_opportunity_level_boundaries(score, expected):
    """DTO line 99-111: >=70 HIGH, >=40 MEDIUM, <40 LOW. None → LOW."""
    assert mod._determine_opportunity_level(score) == expected


# ============================================================
# _normalize_province_name — R-T7 sequential regex order
# ============================================================


@pytest.mark.parametrize("province,expected", [
    ("北京市", "北京"),
    ("广东省", "广东"),
    ("香港特别行政区", "香港"),
    # R-T7 critical: 自治区 must be stripped BEFORE 壮族/回族/维吾尔
    ("广西壮族自治区", "广西"),
    ("新疆维吾尔自治区", "新疆"),
    ("宁夏回族自治区", "宁夏"),
    ("内蒙古自治区", "内蒙古"),
    ("西藏自治区", "西藏"),
    (None, "未知"),
    ("上海市", "上海"),
])
def test_normalize_province_name_handles_all_cases_rt7(province, expected):
    """R-T7 LOCK — pattern order is critical. Java line 1144-1150 sequential.
    自治区 ($) anchor BEFORE 壮族/回族/维吾尔, otherwise '广西壮族自治区'
    becomes '广西自治区' (壮族 stripped from middle, 自治区 left dangling)."""
    assert mod._normalize_province_name(province) == expected


# ============================================================
# _determine_color_level — R-T9 Decimal compare boundaries
# ============================================================


@pytest.mark.parametrize("heat,expected", [
    (None, "LOW"),
    (Decimal("0"), "LOW"),         # Rule 1 — Decimal('0') NOT falsy
    (Decimal("0.29"), "LOW"),
    (Decimal("0.3"), "MEDIUM"),    # R-T9 boundary >= 0.3
    (Decimal("0.69"), "MEDIUM"),
    (Decimal("0.7"), "HIGH"),      # R-T9 boundary >= 0.7
    (Decimal("1.0"), "HIGH"),
])
def test_determine_color_level_boundaries_rt9(heat, expected):
    """R-T9 LOCK + Rule 7 — Decimal compare on non-integer threshold.
    Float compare on 0.7 corner-case (e.g., float 0.7 = 0.6999999...)."""
    assert mod._determine_color_level(heat) == expected


# ============================================================
# _calculate_completion_rate — R-T13 LOCK divide-quantize-multiply
# ============================================================


def test_completion_rate_target_none_returns_zero():
    assert mod._calculate_completion_rate(Decimal("100"), None) == Decimal("0")


def test_completion_rate_target_decimal_zero_returns_zero_rule1():
    """Rule 1 — explicit `target == Decimal('0')` short-circuit."""
    assert mod._calculate_completion_rate(Decimal("100"), Decimal("0")) == Decimal("0")


def test_completion_rate_happy_round():
    """100 / 200 → quantize(4) → 0.5000 * 100 = 50.0000."""
    rate = mod._calculate_completion_rate(Decimal("100"), Decimal("200"))
    assert rate == Decimal("50.0000")


def test_completion_rate_rt13_divide_quantize_multiply_order_locked():
    """R-T13 LOCK — Region uses divide-then-quantize(4)-then-multiply.
    Sales/department use divide-multiply-quantize. Different bytes on
    non-round inputs.

    actual=33.333, target=9.7:
      Region (this fn): (33.333/9.7).quantize(4)*100 = 3.4364 * 100 = 343.6400
      Sales/dept:       (33.333*100/9.7).quantize(4) = 343.6392

    DO NOT import sales._calculate_completion_rate — different output."""
    rate = mod._calculate_completion_rate(Decimal("33.333"), Decimal("9.7"))
    assert rate == Decimal("343.6400")
    # Lock: must NOT equal sales-side output
    assert rate != Decimal("343.6392")


def test_completion_rate_rule10_intermediate_quantize_at_scale_4():
    """Rule 10 — 100/300 must quantize to 0.3333 BEFORE *100.
    Java BigDecimal divide(scale=4, HALF_UP).multiply(100) = 33.3300."""
    rate = mod._calculate_completion_rate(Decimal("100"), Decimal("300"))
    assert rate == Decimal("33.3300")


# ============================================================
# _determine_target_completion_alert — Rule 12 strict <
# ============================================================


@pytest.mark.parametrize("rate,expected", [
    (None, "YELLOW"),               # null → YELLOW (Java line 449-452)
    (Decimal("59.99"), "RED"),
    (Decimal("60"), "YELLOW"),      # NOT < 60 → falls through
    (Decimal("84.99"), "YELLOW"),
    (Decimal("85"), "GREEN"),       # NOT < 85 → GREEN (boundary strict)
    (Decimal("100"), "GREEN"),
])
def test_determine_target_completion_alert_boundaries(rate, expected):
    """Java line 449-461 inline 60/85 (NOT alert_thresholds.py 80).
    Rule 12 — boundary semantic: 85 NOT < 85 → GREEN."""
    assert mod._determine_target_completion_alert(rate) == expected


# ============================================================
# _determine_direction — None / equality STABLE
# ============================================================


def test_determine_direction_value_none_returns_stable():
    assert mod._determine_direction(None, Decimal("100")) == "STABLE"


def test_determine_direction_baseline_none_returns_stable():
    assert mod._determine_direction(Decimal("100"), None) == "STABLE"


def test_determine_direction_equal_returns_stable():
    """Java line 1130-1132: == STABLE."""
    assert mod._determine_direction(Decimal("100"), Decimal("100")) == "STABLE"


def test_determine_direction_decimal_zero_equals_stable_rule1():
    """Rule 1 — Decimal('0') vs Decimal('0.00') still equal, STABLE."""
    assert mod._determine_direction(Decimal("0"), Decimal("0.00")) == "STABLE"


def test_determine_direction_up_and_down():
    assert mod._determine_direction(Decimal("110"), Decimal("100")) == "UP"
    assert mod._determine_direction(Decimal("90"), Decimal("100")) == "DOWN"


# ============================================================
# _format_amount — None → "0.00" + comma separator
# ============================================================


def test_format_amount_none_returns_zero_string():
    assert mod._format_amount(None) == "0.00"


def test_format_amount_with_comma_separator():
    """Java String.format("%,.2f", ...) Linux JVM en_US Locale → comma sep."""
    assert mod._format_amount(Decimal("1234567.89")) == "1,234,567.89"


def test_format_amount_decimal_zero_emits_two_decimals():
    """Decimal('0') → '0.00' (NOT '0' nor '0.0')."""
    assert mod._format_amount(Decimal("0")) == "0.00"


# ============================================================
# _generate_opportunity_recommendation — level templating + tie-break
# ============================================================


def test_generate_opportunity_recommendation_high_level_message():
    """HIGH level → '高潜力区域' + dim selection."""
    msg = mod._generate_opportunity_recommendation(
        region="华东",
        total_score=Decimal("80"),       # HIGH
        growth_score=Decimal("90"),
        base_score=Decimal("60"),
        margin_score=Decimal("70"),
        penetration_score=Decimal("50"),
    )
    assert "华东是高潜力区域" in msg
    assert "优势在于增长率" in msg       # max=growth_score=90
    assert "建议重点提升市场渗透" in msg   # min=penetration=50


def test_generate_opportunity_recommendation_low_level_uses_limited_template():
    msg = mod._generate_opportunity_recommendation(
        region="新疆",
        total_score=Decimal("20"),       # LOW
        growth_score=Decimal("40"),
        base_score=Decimal("30"),
        margin_score=Decimal("20"),
        penetration_score=Decimal("10"),
    )
    assert "新疆目前发展潜力有限" in msg
    assert "优势在于增长率" in msg       # max=growth=40
    assert "建议重点提升市场渗透" in msg   # min=penetration=10


def test_generate_opportunity_recommendation_tie_first_seen_wins():
    """LinkedHashMap insertion order: 增长率 → 销售基数 → 毛利率 → 市场渗透.
    All four equal (50) → max() returns first key, min() returns first key."""
    msg = mod._generate_opportunity_recommendation(
        region="测试",
        total_score=Decimal("50"),
        growth_score=Decimal("50"),
        base_score=Decimal("50"),
        margin_score=Decimal("50"),
        penetration_score=Decimal("50"),
    )
    # max() returns first encountered with max value (Python max stable for dict)
    assert "优势在于增长率" in msg
    assert "建议重点提升增长率" in msg


# ============================================================
# _build_region_ranking — empty + key order + sort desc
# ============================================================


def test_build_region_ranking_empty_rows_returns_empty_list():
    assert mod._build_region_ranking([]) == []


def test_build_region_ranking_sorts_desc_and_emits_six_field_lombok_order():
    """RankingItem Lombok @Data: rank, name, value, target, completionRate, alertLevel.
    Sort by total_amount DESC."""
    rows = [
        _make_row(region="华东", amount=Decimal("3000"), monthly_target=Decimal("3000")),
        _make_row(region="华南", amount=Decimal("8000"), monthly_target=Decimal("10000")),
        _make_row(region="华北", amount=Decimal("1000"), monthly_target=Decimal("2000")),
    ]
    result = mod._build_region_ranking(rows)
    assert len(result) == 3
    assert [r["name"] for r in result] == ["华南", "华东", "华北"]
    assert [r["rank"] for r in result] == [1, 2, 3]
    # Key order MUST match Lombok @Data declaration (Rule 8)
    assert list(result[0].keys()) == [
        "rank", "name", "value", "target", "completionRate", "alertLevel",
    ]
    # 华南: 8000/10000 = 80% → YELLOW (<85)
    assert result[0]["completionRate"] == 80
    assert result[0]["alertLevel"] == "YELLOW"
    # 华东: 3000/3000 = 100% → GREEN (>=85)
    assert result[1]["completionRate"] == 100
    assert result[1]["alertLevel"] == "GREEN"


# ============================================================
# _build_region_target_completion — F7 11-field MetricResult, Rule 9 null emit
# ============================================================


def test_build_region_target_completion_empty_rows_returns_empty_list():
    assert mod._build_region_target_completion([]) == []


def test_build_region_target_completion_emits_eleven_field_metric_result_rule9():
    """F7 LOCK — MetricResult Lombok @Data has 11 fields including
    changeValue=null (Rule 9 emit per @JsonInclude absence)."""
    rows = [
        _make_row(region="华东", amount=Decimal("8500"), monthly_target=Decimal("10000")),
    ]
    result = mod._build_region_target_completion(rows)
    assert len(result) == 1
    item = result[0]
    # Rule 8 — key order matches Java MetricResult declaration (11 fields)
    assert list(item.keys()) == [
        "metricCode", "metricName", "value", "formattedValue", "unit",
        "changePercent", "changeDirection", "changeValue", "alertLevel",
        "dimensionValue", "description",
    ]
    # Rule 9 — changeValue MUST emit as null, not be absent
    assert item["changeValue"] is None
    assert item["metricCode"] == "REGION_TARGET_华东"
    assert item["dimensionValue"] == "华东"
    assert item["unit"] == "元"
    # 8500/10000 = 0.85 quantize → 85.0000 → quantize(0.01) → 85
    assert item["changePercent"] == 85
    assert item["alertLevel"] == "GREEN"  # 85 NOT < 85 boundary → GREEN
    assert "目标:" in item["description"]


def test_build_region_target_completion_sorts_by_change_percent_desc():
    """Java line 307-311 — sort desc by changePercent."""
    rows = [
        _make_row(region="低", amount=Decimal("3000"), monthly_target=Decimal("10000")),  # 30%
        _make_row(region="高", amount=Decimal("9500"), monthly_target=Decimal("10000")),  # 95%
        _make_row(region="中", amount=Decimal("7000"), monthly_target=Decimal("10000")),  # 70%
    ]
    result = mod._build_region_target_completion(rows)
    assert [r["dimensionValue"] for r in result] == ["高", "中", "低"]


# ============================================================
# _build_geographic_heatmap — F1/F2 + Rule 8 Map.of(N) order
# ============================================================


def test_build_geographic_heatmap_empty_rows_returns_seven_field_chart_config_f2():
    """F2 LOCK — empty case = 7 fields with nulls (NOT 3-field stub).
    F1 LOCK — xaxisField/yaxisField LOWERCASE 'a' (Jackson decapitalize)."""
    chart = mod._build_geographic_heatmap([])
    # Rule 8 — F999 golden order
    assert list(chart.keys()) == [
        "chartType", "title", "seriesField", "data", "options",
        "xaxisField", "yaxisField",
    ]
    # F1 — lowercase 'a' verified by absence of camelCase keys
    assert "xAxisField" not in chart
    assert "yAxisField" not in chart
    # F2 — Rule 9 emit nulls (NOT @JsonInclude(NON_NULL))
    assert chart["chartType"] == "MAP"
    assert chart["title"] == "销售地理分布"
    assert chart["seriesField"] is None
    assert chart["data"] == []
    assert chart["options"] is None
    assert chart["xaxisField"] is None
    assert chart["yaxisField"] is None


def test_build_geographic_heatmap_populated_emits_options_with_rule8_key_order():
    """Rule 8 LOCK — Map.of(4) options order from F999/F001 PR-B goldens:
    roam, visualMap, mapType, showLabel.
    Map.of(3) visualMap order: min, calculable, max."""
    rows = [
        _make_row(province="上海市", amount=Decimal("1000")),
        _make_row(province="广东省", amount=Decimal("500")),
    ]
    chart = mod._build_geographic_heatmap(rows)

    # Outer ChartConfig — 7-field same order as empty case
    assert list(chart.keys()) == [
        "chartType", "title", "seriesField", "data", "options",
        "xaxisField", "yaxisField",
    ]
    assert chart["chartType"] == "MAP"
    assert chart["xaxisField"] == "province"  # F1 lowercase
    assert chart["yaxisField"] == "value"     # F1 lowercase

    # options Map.of(4) Rule 8 order
    assert list(chart["options"].keys()) == [
        "roam", "visualMap", "mapType", "showLabel",
    ]
    assert chart["options"]["roam"] is True
    assert chart["options"]["mapType"] == "china"

    # visualMap Map.of(3) Rule 8 order
    assert list(chart["options"]["visualMap"].keys()) == [
        "min", "calculable", "max",
    ]
    assert chart["options"]["visualMap"]["min"] == 0
    assert chart["options"]["visualMap"]["calculable"] is True
    assert chart["options"]["visualMap"]["max"] == 1000


def test_build_geographic_heatmap_data_rows_six_field_linked_hash_order():
    """heatmap.data[0] LinkedHashMap order from Java line 353-360:
    province, value, heatValue, orderCount, customerCount, colorLevel."""
    rows = [
        _make_row(province="上海市", amount=Decimal("1000"), customer_name="C1"),
    ]
    chart = mod._build_geographic_heatmap(rows)
    point = chart["data"][0]
    assert list(point.keys()) == [
        "province", "value", "heatValue", "orderCount",
        "customerCount", "colorLevel",
    ]
    assert point["province"] == "上海"  # _normalize_province_name strip 市
    assert point["value"] == 1000
    # max_amount = 1000 → heat = 1.0 → HIGH
    assert point["heatValue"] == 1
    assert point["colorLevel"] == "HIGH"


# ============================================================
# _build_opportunity_scores — R-T12 13-field key order
# ============================================================


def test_build_opportunity_scores_empty_current_rows_returns_empty():
    """Empty current rows → []. Java line 387-389 short-circuit."""
    assert mod._build_opportunity_scores([], []) == []


def test_build_opportunity_scores_emits_thirteen_field_key_order_rt12():
    """R-T12 LOCK — RegionOpportunityScore.java declaration order:
    region, totalScore, growthScore, baseScore, marginScore, penetrationScore,
    recommendation, opportunityLevel, currentSales, previousSales, growthRate,
    grossMargin, customerCount."""
    current = [
        _make_row(region="华东", amount=Decimal("1000"), cost=Decimal("600"), customer_name="C1"),
    ]
    previous = [
        _make_row(region="华东", amount=Decimal("500"), cost=Decimal("300"), customer_name="C1"),
    ]
    result = mod._build_opportunity_scores(current, previous)
    assert len(result) == 1
    assert list(result[0].keys()) == [
        "region", "totalScore", "growthScore", "baseScore", "marginScore",
        "penetrationScore", "recommendation", "opportunityLevel",
        "currentSales", "previousSales", "growthRate", "grossMargin",
        "customerCount",
    ]
    assert result[0]["region"] == "华东"
    assert result[0]["currentSales"] == 1000
    assert result[0]["previousSales"] == 500
    assert result[0]["customerCount"] == 1


def test_build_opportunity_scores_sorts_by_total_score_desc():
    """Java line 463 — Collectors.toList then .sort by totalScore desc."""
    current = [
        _make_row(region="低", amount=Decimal("100"), cost=Decimal("90"),
                  customer_name="A"),
        _make_row(region="高", amount=Decimal("10000"), cost=Decimal("3000"),
                  customer_name="B"),
    ]
    result = mod._build_opportunity_scores(current, [])
    # 高 region has bigger sales + better margin → higher totalScore
    assert result[0]["region"] == "高"
    assert result[1]["region"] == "低"
    assert result[0]["totalScore"] >= result[1]["totalScore"]


# ============================================================
# _get_region_analysis composite — 6-key top-level order
# ============================================================


@pytest.mark.asyncio
async def test_get_region_analysis_composite_six_key_order(monkeypatch, q1_range):
    """F999-confirmed top-level HashMap key order (Rule 8 + Task 11):
    heatmap → targetCompletion → dateRange → opportunityScores → generatedAt → ranking.

    NOT source-insertion order, but actual Java HashMap hash-bucket order."""
    async def _fake_query(*_a, **_kw):
        return []

    monkeypatch.setattr(mod, "_query_region_full", _fake_query)

    result = await mod._get_region_analysis("F001", q1_range)
    assert list(result.keys()) == [
        "heatmap", "targetCompletion", "dateRange",
        "opportunityScores", "generatedAt", "ranking",
    ]
    # Empty data still emits all 6 sub-services
    assert result["ranking"] == []
    assert result["targetCompletion"] == []
    assert result["opportunityScores"] == []
    assert result["heatmap"]["chartType"] == "MAP"
    assert result["dateRange"]["startDate"] == "2026-01-01"
    assert result["dateRange"]["endDate"] == "2026-03-31"
    assert isinstance(result["generatedAt"], str)


@pytest.mark.asyncio
async def test_get_region_analysis_calls_query_twice_for_current_and_previous(
    monkeypatch, q1_range,
):
    """Optimization: 2 queries (current period + previous for opportunity scores)."""
    call_count = {"n": 0}

    async def _fake_query(*_a, **_kw):
        call_count["n"] += 1
        return []

    monkeypatch.setattr(mod, "_query_region_full", _fake_query)
    await mod._get_region_analysis("F001", q1_range)
    assert call_count["n"] == 2


# ============================================================
# Endpoint — auth boundaries (401 / 403)
# ============================================================


def test_endpoint_missing_bearer_returns_401(client):
    r = client.get(
        "/api/mobile/F001/smart-bi/analysis/region"
        "?startDate=2026-01-01&endDate=2026-03-31"
    )
    assert r.status_code == 401


def test_endpoint_invalid_token_returns_401(client):
    r = client.get(
        "/api/mobile/F001/smart-bi/analysis/region"
        "?startDate=2026-01-01&endDate=2026-03-31",
        headers={"Authorization": "Bearer garbage.token.value"},
    )
    assert r.status_code == 401


def test_endpoint_expired_token_returns_401(client):
    expired = _make_token(exp_offset=-3600)
    r = client.get(
        "/api/mobile/F001/smart-bi/analysis/region"
        "?startDate=2026-01-01&endDate=2026-03-31",
        headers=_auth_header(expired),
    )
    assert r.status_code == 401


def test_endpoint_cross_factory_denied_returns_403(client):
    """Token factoryId=F001 but URL F002 → 403."""
    r = client.get(
        "/api/mobile/F002/smart-bi/analysis/region"
        "?startDate=2026-01-01&endDate=2026-03-31",
        headers=_auth_header(factory_id="F001"),
    )
    assert r.status_code == 403


def test_endpoint_no_factory_id_non_privileged_role_returns_403(client):
    """Token without factoryId + non-privileged role → 403."""
    r = client.get(
        "/api/mobile/F001/smart-bi/analysis/region"
        "?startDate=2026-01-01&endDate=2026-03-31",
        headers=_auth_header(factory_id=None, role="operator"),
    )
    assert r.status_code == 403


def test_endpoint_privileged_role_no_factory_id_succeeds(monkeypatch, client):
    """platform_admin without factoryId can call any factory's endpoint."""
    async def _fake_get(*_a, **_kw):
        return {
            "heatmap": {}, "targetCompletion": [], "dateRange": {},
            "opportunityScores": [], "generatedAt": "2026-05-12T00:00:00",
            "ranking": [],
        }

    monkeypatch.setattr(mod, "_get_region_analysis", _fake_get)

    r = client.get(
        "/api/mobile/F001/smart-bi/analysis/region"
        "?startDate=2026-01-01&endDate=2026-03-31",
        headers=_auth_header(factory_id=None, role="platform_admin"),
    )
    assert r.status_code == 200


# ============================================================
# Endpoint — happy path 6-key envelope
# ============================================================


def test_endpoint_happy_returns_six_key_composite(monkeypatch, client):
    """Happy path returns wrapped 6-key composite per dispatcher contract."""
    async def _fake_get(factory_id, range_):
        assert factory_id == "F001"
        assert range_.start_date == date(2026, 1, 1)
        assert range_.end_date == date(2026, 3, 31)
        return {
            "heatmap": {"chartType": "MAP", "title": "销售地理分布"},
            "targetCompletion": [],
            "dateRange": {"startDate": "2026-01-01", "endDate": "2026-03-31"},
            "opportunityScores": [],
            "generatedAt": "2026-05-12T00:00:00",
            "ranking": [{"rank": 1, "name": "华东", "value": 1000}],
        }

    monkeypatch.setattr(mod, "_get_region_analysis", _fake_get)

    r = client.get(
        "/api/mobile/F001/smart-bi/analysis/region"
        "?startDate=2026-01-01&endDate=2026-03-31",
        headers=_auth_header(),
    )
    assert r.status_code == 200
    body = r.json()
    assert body["success"] is True
    data = body["data"]
    # 6-key composite
    assert list(data.keys()) == [
        "heatmap", "targetCompletion", "dateRange",
        "opportunityScores", "generatedAt", "ranking",
    ]
    assert data["heatmap"]["chartType"] == "MAP"
    assert data["ranking"][0]["name"] == "华东"


def test_endpoint_ignores_region_query_param(monkeypatch, client):
    """Java line 192-194 short-circuits to getComprehensiveAnalysis when
    smartBIService non-null — `region` query param is documented as ignored."""
    captured = {}

    async def _fake_get(factory_id, range_):
        captured["factory_id"] = factory_id
        return {
            "heatmap": {}, "targetCompletion": [], "dateRange": {},
            "opportunityScores": [], "generatedAt": "x", "ranking": [],
        }

    monkeypatch.setattr(mod, "_get_region_analysis", _fake_get)

    r = client.get(
        "/api/mobile/F001/smart-bi/analysis/region"
        "?startDate=2026-01-01&endDate=2026-03-31&region=华东",
        headers=_auth_header(),
    )
    assert r.status_code == 200
    # _get_region_analysis is called with factory_id only — `region` discarded.
    assert captured["factory_id"] == "F001"


def test_endpoint_missing_required_dates_returns_422(client):
    """startDate / endDate are required Query params — FastAPI validates."""
    r = client.get(
        "/api/mobile/F001/smart-bi/analysis/region",
        headers=_auth_header(),
    )
    assert r.status_code == 422


# ============================================================
# Module surface — exported symbols (regression guard)
# ============================================================


def test_module_exports_router_and_helpers():
    """Stable surface for sister chats / cleanup PRs."""
    assert hasattr(mod, "router")
    assert hasattr(mod, "RegionAggregation")
    assert hasattr(mod, "_query_region_full")
    assert hasattr(mod, "_previous_period_window")
    assert hasattr(mod, "_aggregate_by_region")
    assert hasattr(mod, "_aggregate_by_province")
    assert hasattr(mod, "_calculate_growth_score")
    assert hasattr(mod, "_calculate_base_score")
    assert hasattr(mod, "_calculate_margin_score")
    assert hasattr(mod, "_calculate_penetration_score")
    assert hasattr(mod, "_calculate_total_score")
    assert hasattr(mod, "_determine_opportunity_level")
    assert hasattr(mod, "_normalize_province_name")
    assert hasattr(mod, "_determine_color_level")
    assert hasattr(mod, "_calculate_completion_rate")
    assert hasattr(mod, "_determine_target_completion_alert")
    assert hasattr(mod, "_determine_direction")
    assert hasattr(mod, "_format_amount")
    assert hasattr(mod, "_generate_opportunity_recommendation")
    assert hasattr(mod, "_build_region_ranking")
    assert hasattr(mod, "_build_region_target_completion")
    assert hasattr(mod, "_build_geographic_heatmap")
    assert hasattr(mod, "_build_opportunity_scores")
    assert hasattr(mod, "_get_region_analysis")


def test_router_declares_region_endpoint():
    """Spec §1: GET /api/mobile/{factory_id}/smart-bi/analysis/region."""
    paths_methods = {(r.path, frozenset(r.methods)) for r in mod.router.routes}
    assert (
        "/api/mobile/{factory_id}/smart-bi/analysis/region",
        frozenset({"GET"}),
    ) in paths_methods
