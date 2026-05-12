"""Phase 2B-1 chat-2B-sales pilot tests — /analysis/sales endpoint.

Tier 1 critical KPI dashboard backfill per
``docs/qa-audits/2026-05-12-python-migration-test-coverage-audit.md`` §2.1
row 2 + §3 priorities row 4-5. Mirrors ``test_config_thresholds_pilot.py``
gold-standard pattern (auth boundary, factory-scope, role gating, fixtured
DB seams).

Coverage (Rule 1/4/6/10/12 per ``.claude/rules/python-java-port.md``):

* Threshold helpers — ``_determine_growth_alert_level`` /
  ``_determine_completion_alert_level`` / ``_determine_change_direction``.
  Rule 1 (``Decimal("0")`` not falsy), Rule 12 (HALF_UP boundary, NOT
  banker's rounding).
* Arithmetic — ``_calculate_completion_rate`` / ``_calculate_mom_growth``.
  Rule 10 (intermediate quantize at scale 4 before multiply by 100, NOT
  one-shot ``(n / d * K).quantize(scale_2)``).
* Aggregate builder — ``_build_kpi_cards_from_aggregates``. 4 vs 5 KPIs,
  Rule 4 (``_decimal_to_number`` int-collapse for integer-valued Decimals).
* SQL seams — ``_query_sales_aggregates`` (engine happy / no-row / raise).
  Rule 6 (existing helper — callers guarantee non-None per narrowed scope).
* Sub-services — ``_get_sales_overview`` / ``_get_salesperson_ranking`` /
  ``_get_product_ranking`` / ``_get_customer_ranking`` /
  ``_get_sales_trend_chart``.
* Endpoint — ``GET /analysis/sales`` auth boundary (401 / 403) + happy
  7-key envelope.
"""
from __future__ import annotations

import os
from dataclasses import dataclass
from datetime import date
from decimal import Decimal
from typing import Optional

import jwt
import pytest

os.environ.setdefault("JWT_SECRET", "phase-2b-sales-pilot-test-secret")

from smartbi_compat.api import analysis_sales as mod  # noqa: E402
from smartbi_compat.auth import JWT_ALGORITHM  # noqa: E402
from smartbi_compat.date_range import DateRange  # noqa: E402


JWT_SECRET = "phase-2b-sales-pilot-test-secret"


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


@dataclass
class _SalesRow:
    """Mirror smart_bi_sales_data row attrs read by _query_sales_data."""
    salesperson_name: Optional[str] = None
    amount: Optional[Decimal] = None
    monthly_target: Optional[Decimal] = None
    product_category: Optional[str] = None
    customer_name: Optional[str] = None
    order_date: Optional[date] = None


class _FakeEngine:
    """Stub for _get_sync_engine — returns _FakeConn with preset row."""

    def __init__(self, row=None, should_raise: bool = False):
        self._row = row
        self._should_raise = should_raise

    def connect(self):
        return _FakeConn(self._row, self._should_raise)


class _FakeConn:
    def __init__(self, row, should_raise: bool):
        self._row = row
        self._should_raise = should_raise

    def __enter__(self):
        return self

    def __exit__(self, *_):
        return False

    def execute(self, *args, **kwargs):
        if self._should_raise:
            raise RuntimeError("simulated engine failure")
        return _FakeResult(self._row)


class _FakeResult:
    def __init__(self, row):
        self._row = row

    def fetchone(self):
        return self._row

    def __iter__(self):
        if self._row is None:
            return iter([])
        return iter(self._row if isinstance(self._row, list) else [self._row])


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
# _determine_growth_alert_level — Rule 1 + 12 thresholds
# ============================================================


def test_growth_alert_red_below_neg_20_threshold():
    """Java line 1219: `if (growth < -20) return RED`. -25 < -20 → RED."""
    assert mod._determine_growth_alert_level(Decimal("-25")) == "RED"


def test_growth_alert_yellow_between_neg_20_and_neg_5():
    """-10 not < -20, but -10 < -5 → YELLOW."""
    assert mod._determine_growth_alert_level(Decimal("-10")) == "YELLOW"


def test_growth_alert_green_at_neg_5_boundary_strict_less_than():
    """Rule 12 — boundary semantic: Decimal('-5') NOT < Decimal('-5') → GREEN."""
    assert mod._determine_growth_alert_level(Decimal("-5")) == "GREEN"


def test_growth_alert_yellow_just_below_neg_5_boundary():
    """Rule 12 — Decimal HALF_UP semantic: -5.01 strictly < -5 → YELLOW."""
    assert mod._determine_growth_alert_level(Decimal("-5.01")) == "YELLOW"


def test_growth_alert_yellow_at_neg_20_boundary_strict():
    """-20 NOT < -20, falls through to second check (-20 < -5) → YELLOW."""
    assert mod._determine_growth_alert_level(Decimal("-20")) == "YELLOW"


def test_growth_alert_green_on_decimal_zero_rule1():
    """Rule 1 — Decimal('0') must NOT be treated as falsy. 0 not < -5 → GREEN."""
    assert mod._determine_growth_alert_level(Decimal("0")) == "GREEN"


def test_growth_alert_green_on_positive():
    assert mod._determine_growth_alert_level(Decimal("15.5")) == "GREEN"


# ============================================================
# _determine_completion_alert_level — Rule 12 thresholds
# ============================================================


def test_completion_alert_red_below_60():
    assert mod._determine_completion_alert_level(Decimal("30")) == "RED"


def test_completion_alert_yellow_below_85():
    assert mod._determine_completion_alert_level(Decimal("70")) == "YELLOW"


def test_completion_alert_green_at_85_boundary_strict_less_than():
    """Rule 12 — 85 NOT < 85 → GREEN (strict less than)."""
    assert mod._determine_completion_alert_level(Decimal("85")) == "GREEN"


def test_completion_alert_green_above_100():
    assert mod._determine_completion_alert_level(Decimal("120.55")) == "GREEN"


# ============================================================
# _determine_change_direction — Rule 1 (Decimal("0") explicit ==)
# ============================================================


def test_change_direction_stable_on_none():
    assert mod._determine_change_direction(None) == "STABLE"


def test_change_direction_stable_on_decimal_zero_rule1():
    """Rule 1 — code does `== Decimal('0')` not `not change_percent`.
    Decimal('0.00') equals Decimal('0') → STABLE."""
    assert mod._determine_change_direction(Decimal("0")) == "STABLE"
    assert mod._determine_change_direction(Decimal("0.00")) == "STABLE"


def test_change_direction_up_positive():
    assert mod._determine_change_direction(Decimal("5.5")) == "UP"


def test_change_direction_down_negative():
    assert mod._determine_change_direction(Decimal("-5")) == "DOWN"


# ============================================================
# _calculate_completion_rate — Rule 10 (divide.quantize.multiply)
# ============================================================


def test_completion_rate_happy_half():
    """100 / 200 * 100 = 50.0000 (scale 4 preserved by *100)."""
    rate = mod._calculate_completion_rate(Decimal("100"), Decimal("200"))
    assert rate == Decimal("50.0000")


def test_completion_rate_target_none_returns_zero():
    assert mod._calculate_completion_rate(Decimal("100"), None) == Decimal("0")


def test_completion_rate_target_decimal_zero_returns_zero_rule1():
    """Rule 1 — explicit `target == Decimal('0')` check, not falsy."""
    assert mod._calculate_completion_rate(Decimal("100"), Decimal("0")) == Decimal("0")


def test_completion_rate_rule10_intermediate_quantize_at_scale_4():
    """Rule 10 — 100/300 = 0.3333... must quantize to 0.3333 BEFORE *100.
    Java BigDecimal divide(scale=4, HALF_UP).multiply(100) = 33.3300.
    One-shot (100/300*100).quantize(0.01) = 33.33 — same final but Python
    Decimal arithmetic without intermediate quantize accumulates 28-digit
    precision and breaks byte parity. Assertion locks intermediate-quantize."""
    rate = mod._calculate_completion_rate(Decimal("100"), Decimal("300"))
    assert rate == Decimal("33.3300")


# ============================================================
# _calculate_mom_growth — Rule 10 + edge cases
# ============================================================


def test_mom_growth_happy_positive():
    """((120-100)/100)*100 = 20.00 (final quantize at scale 2)."""
    assert mod._calculate_mom_growth(Decimal("120"), Decimal("100")) == Decimal("20.00")


def test_mom_growth_previous_none_current_positive_returns_100():
    assert mod._calculate_mom_growth(Decimal("100"), None) == Decimal("100")


def test_mom_growth_previous_zero_current_positive_returns_100():
    """Rule 1 — explicit `previous == Decimal('0')` check + current > 0 guard."""
    assert mod._calculate_mom_growth(Decimal("100"), Decimal("0")) == Decimal("100")


def test_mom_growth_previous_zero_current_zero_returns_zero():
    """Both zero — Java line 432 returns ZERO (current <= 0 path)."""
    assert mod._calculate_mom_growth(Decimal("0"), Decimal("0")) == Decimal("0")


def test_mom_growth_current_none_returns_neg_100():
    """Java line 433-435: previous != 0 AND current null → -100."""
    assert mod._calculate_mom_growth(None, Decimal("100")) == Decimal("-100")


def test_mom_growth_negative_growth():
    assert mod._calculate_mom_growth(Decimal("80"), Decimal("100")) == Decimal("-20.00")


# ============================================================
# _build_kpi_cards_from_aggregates — composite
# ============================================================


@pytest.mark.asyncio
async def test_build_kpi_cards_emits_four_when_no_prev_period(monkeypatch):
    """Java line 249 conditional — prev=None → 4 KPIs (no MoM 5th)."""
    async def _no_prev(*_a, **_kw):
        return None

    monkeypatch.setattr(mod, "_query_sales_aggregates_previous_period", _no_prev)

    cards = await mod._build_kpi_cards_from_aggregates(
        factory_id="F001",
        start_date=date(2026, 1, 1),
        end_date=date(2026, 3, 31),
        total_sales=Decimal("10000"),
        total_quantity=Decimal("50"),
        total_profit=Decimal("2000"),
        total_cost=Decimal("8000"),
        total_target=Decimal("15000"),
        order_count=10,
    )
    assert len(cards) == 4
    codes = [c["metricCode"] for c in cards]
    assert codes == [
        "SALES_AMOUNT", "ORDER_COUNT", "AVG_ORDER_VALUE", "TARGET_COMPLETION",
    ]


@pytest.mark.asyncio
async def test_build_kpi_cards_emits_five_when_prev_period_positive(monkeypatch):
    """Java line 249-261 — prev_sales > 0 → MoM 5th KPI appended."""
    async def _prev(*_a, **_kw):
        return (Decimal("8000"), Decimal("40"), Decimal("1500"),
                Decimal("6500"), Decimal("12000"), 8)

    monkeypatch.setattr(mod, "_query_sales_aggregates_previous_period", _prev)

    cards = await mod._build_kpi_cards_from_aggregates(
        factory_id="F001",
        start_date=date(2026, 1, 1),
        end_date=date(2026, 3, 31),
        total_sales=Decimal("10000"),
        total_quantity=Decimal("50"),
        total_profit=Decimal("2000"),
        total_cost=Decimal("8000"),
        total_target=Decimal("15000"),
        order_count=10,
    )
    assert len(cards) == 5
    assert cards[4]["metricCode"] == "MOM_GROWTH"
    # (10000-8000)/8000 = 0.25 * 100 = 25.00 — Rule 10 intermediate quantize.
    assert cards[4]["value"] == 25
    assert cards[4]["changeDirection"] == "UP"
    assert cards[4]["alertLevel"] == "GREEN"


@pytest.mark.asyncio
async def test_build_kpi_cards_rule4_decimal_int_collapse(monkeypatch):
    """Rule 4 — _decimal_to_number(Decimal('10000.00').quantize(0.01)) = int(10000),
    because Decimal('10000.00') == Decimal('10000.00').to_integral_value()."""
    async def _no_prev(*_a, **_kw):
        return None

    monkeypatch.setattr(mod, "_query_sales_aggregates_previous_period", _no_prev)

    cards = await mod._build_kpi_cards_from_aggregates(
        factory_id="F001",
        start_date=date(2026, 1, 1),
        end_date=date(2026, 3, 31),
        total_sales=Decimal("10000"),
        total_quantity=Decimal("50"),
        total_profit=Decimal("2000"),
        total_cost=Decimal("8000"),
        total_target=Decimal("15000"),
        order_count=10,
    )
    sales_kpi = next(c for c in cards if c["metricCode"] == "SALES_AMOUNT")
    assert sales_kpi["value"] == 10000
    assert isinstance(sales_kpi["value"], int)
    order_kpi = next(c for c in cards if c["metricCode"] == "ORDER_COUNT")
    assert order_kpi["value"] == 10
    assert isinstance(order_kpi["value"], int)


@pytest.mark.asyncio
async def test_build_kpi_cards_emits_four_kpis_on_zero_aggregates(monkeypatch):
    """Rule 1 — Decimal('0') must not short-circuit KPI emission. Even
    with all-zero aggregates we still emit 4 zero-valued cards."""
    async def _no_prev(*_a, **_kw):
        return None

    monkeypatch.setattr(mod, "_query_sales_aggregates_previous_period", _no_prev)

    cards = await mod._build_kpi_cards_from_aggregates(
        factory_id="F001",
        start_date=date(2026, 1, 1),
        end_date=date(2026, 3, 31),
        total_sales=Decimal("0"),
        total_quantity=Decimal("0"),
        total_profit=Decimal("0"),
        total_cost=Decimal("0"),
        total_target=Decimal("0"),
        order_count=0,
    )
    assert len(cards) == 4
    sales_kpi = next(c for c in cards if c["metricCode"] == "SALES_AMOUNT")
    # _decimal_to_number(Decimal('0.00')) = int(0)
    assert sales_kpi["value"] == 0
    # AVG_ORDER_VALUE divides by 0 — guarded path emits Decimal("0").
    avg_kpi = next(c for c in cards if c["metricCode"] == "AVG_ORDER_VALUE")
    assert avg_kpi["value"] == 0
    # TARGET_COMPLETION — target=0 → completion=0 → alert RED (0 < 60).
    target_kpi = next(c for c in cards if c["metricCode"] == "TARGET_COMPLETION")
    assert target_kpi["value"] == 0
    assert target_kpi["alertLevel"] == "RED"


# ============================================================
# _query_sales_aggregates — engine seam
# ============================================================


@pytest.mark.asyncio
async def test_query_sales_aggregates_happy(monkeypatch):
    """Mock _get_sync_engine to return 6-tuple — caller gets it verbatim."""
    fake_row = (Decimal("10000"), Decimal("50"), Decimal("2000"),
                Decimal("8000"), Decimal("15000"), 10)
    monkeypatch.setattr(
        mod, "_get_sync_engine", lambda: _FakeEngine(row=fake_row),
    )

    result = await mod._query_sales_aggregates(
        "F001", date(2026, 1, 1), date(2026, 3, 31),
    )
    assert result == fake_row


@pytest.mark.asyncio
async def test_query_sales_aggregates_returns_none_on_empty_row(monkeypatch):
    """Java repo returns null when no row — Python mirror returns None."""
    monkeypatch.setattr(
        mod, "_get_sync_engine", lambda: _FakeEngine(row=None),
    )

    result = await mod._query_sales_aggregates(
        "F001", date(2026, 1, 1), date(2026, 3, 31),
    )
    assert result is None


@pytest.mark.asyncio
async def test_query_sales_aggregates_returns_none_on_engine_error(monkeypatch):
    """Engine raises → caught by try/except, returns None (logged warning)."""
    monkeypatch.setattr(
        mod, "_get_sync_engine", lambda: _FakeEngine(should_raise=True),
    )

    result = await mod._query_sales_aggregates(
        "F001", date(2026, 1, 1), date(2026, 3, 31),
    )
    assert result is None


# ============================================================
# Sub-services — ranking + trend
# ============================================================


@pytest.mark.asyncio
async def test_salesperson_ranking_aggregates_and_orders_desc(monkeypatch, q1_range):
    """Java line 371-400 — aggregate SUM(amount)+SUM(monthly_target) per name,
    order by value DESC."""
    rows = [
        _SalesRow(salesperson_name="Alice", amount=Decimal("3000"), monthly_target=Decimal("5000")),
        _SalesRow(salesperson_name="Bob",   amount=Decimal("8000"), monthly_target=Decimal("10000")),
        _SalesRow(salesperson_name="Alice", amount=Decimal("2000"), monthly_target=Decimal("0")),
    ]
    monkeypatch.setattr(mod, "_query_sales_data", lambda *_a, **_kw: rows)

    result = await mod._get_salesperson_ranking("F001", q1_range)
    assert [r["name"] for r in result] == ["Bob", "Alice"]
    assert result[0]["rank"] == 1
    assert result[0]["value"] == 8000
    # Alice: 5000 total against 5000 target → 100% completion → GREEN
    alice = result[1]
    assert alice["value"] == 5000
    assert alice["completionRate"] == 100
    assert alice["alertLevel"] == "GREEN"


@pytest.mark.asyncio
async def test_salesperson_ranking_filters_null_names(monkeypatch, q1_range):
    """Java line 379: null name → continue."""
    rows = [
        _SalesRow(salesperson_name=None,  amount=Decimal("9999"), monthly_target=None),
        _SalesRow(salesperson_name="Bob", amount=Decimal("100"),  monthly_target=Decimal("200")),
    ]
    monkeypatch.setattr(mod, "_query_sales_data", lambda *_a, **_kw: rows)

    result = await mod._get_salesperson_ranking("F001", q1_range)
    assert len(result) == 1
    assert result[0]["name"] == "Bob"


@pytest.mark.asyncio
async def test_product_ranking_filters_null_category_and_uses_share_pct(monkeypatch, q1_range):
    """Java line 491-533 — null category filtered, completionRate = share % of total."""
    rows = [
        _SalesRow(product_category="A", amount=Decimal("400")),
        _SalesRow(product_category=None, amount=Decimal("9999")),
        _SalesRow(product_category="B", amount=Decimal("100")),
    ]
    monkeypatch.setattr(mod, "_query_sales_data", lambda *_a, **_kw: rows)

    result = await mod._get_product_ranking("F001", q1_range)
    assert len(result) == 2
    # A: 400 / 500 = 80%
    assert result[0]["name"] == "A"
    assert result[0]["completionRate"] == 80
    assert result[0]["alertLevel"] == "GREEN"  # Java hard-codes GREEN line 528


@pytest.mark.asyncio
async def test_customer_ranking_caps_at_top_10(monkeypatch, q1_range):
    """Java line 574: `.limit(10)` — top 10 cap enforced after sort."""
    rows = [
        _SalesRow(customer_name=f"C{i:02d}", amount=Decimal(i * 100))
        for i in range(1, 16)  # 15 customers
    ]
    monkeypatch.setattr(mod, "_query_sales_data", lambda *_a, **_kw: rows)

    result = await mod._get_customer_ranking("F001", q1_range)
    assert len(result) == 10
    assert result[0]["name"] == "C15"  # highest amount


@pytest.mark.asyncio
async def test_trend_chart_day_period_happy(monkeypatch, q1_range):
    """DAY period — buckets by order_date, returns LINE ChartConfig with data."""
    rows = [
        _SalesRow(amount=Decimal("100"), order_date=date(2026, 1, 15)),
        _SalesRow(amount=Decimal("200"), order_date=date(2026, 1, 15)),
        _SalesRow(amount=Decimal("50"),  order_date=date(2026, 1, 16)),
    ]
    monkeypatch.setattr(mod, "_query_sales_data", lambda *_a, **_kw: rows)

    chart = await mod._get_sales_trend_chart("F001", q1_range, period="DAY")
    assert chart["chartType"] == "LINE"
    assert chart["title"] == "销售趋势"
    assert chart["xaxisField"] == "date"
    assert chart["yaxisField"] == "amount"
    assert chart["options"] == {"showDataLabels": False, "smooth": True}
    assert len(chart["data"]) == 2
    # Bucketed by date, sorted ASC, aggregated
    assert chart["data"][0] == {"date": "2026-01-15", "amount": 300}
    assert chart["data"][1] == {"date": "2026-01-16", "amount": 50}


@pytest.mark.asyncio
async def test_trend_chart_rejects_non_day_period_raises(monkeypatch, q1_range):
    """Spec §5 — only DAY is wired; WEEK/MONTH/YEAR must fail fast BEFORE query."""

    def _should_not_be_called(*_a, **_kw):
        pytest.fail("_query_sales_data must NOT be called for non-DAY periods")

    monkeypatch.setattr(mod, "_query_sales_data", _should_not_be_called)

    with pytest.raises(NotImplementedError, match="period='WEEK'"):
        await mod._get_sales_trend_chart("F001", q1_range, period="WEEK")

    with pytest.raises(NotImplementedError, match="period='MONTH'"):
        await mod._get_sales_trend_chart("F001", q1_range, period="MONTH")


# ============================================================
# _get_sales_overview — flag-gated dispatch
# ============================================================


@pytest.mark.asyncio
async def test_overview_falls_back_to_empty_dashboard_when_no_data(monkeypatch, q1_range):
    """Flag false (default) → legacy. Aggregates empty → _build_empty_dashboard."""
    monkeypatch.delenv("SMARTBI_GOLD_READ_PRIMARY_ENABLED", raising=False)

    async def _empty(*_a, **_kw):
        return None

    monkeypatch.setattr(mod, "_query_sales_aggregates", _empty)

    result = await mod._get_sales_overview("F001", q1_range)
    # _build_empty_dashboard sets a YELLOW "数据状态" insight
    assert result["kpiCards"] == []
    assert result["aiInsights"][0]["category"] == "数据状态"
    assert result["aiInsights"][0]["level"] == "YELLOW"


@pytest.mark.asyncio
async def test_overview_legacy_happy_path_returns_kpi_cards(monkeypatch, q1_range):
    """Flag false → legacy path. Aggregates returns realistic 6-tuple →
    _build_legacy_sales_overview produces populated KPIs + rankings/charts."""
    monkeypatch.delenv("SMARTBI_GOLD_READ_PRIMARY_ENABLED", raising=False)

    async def _aggregates(*_a, **_kw):
        return (Decimal("10000"), Decimal("50"), Decimal("2000"),
                Decimal("8000"), Decimal("15000"), 10)

    async def _prev(*_a, **_kw):
        return None  # no MoM

    async def _empty_list(*_a, **_kw):
        return []

    monkeypatch.setattr(mod, "_query_sales_aggregates", _aggregates)
    monkeypatch.setattr(mod, "_query_sales_aggregates_previous_period", _prev)
    monkeypatch.setattr(mod, "_query_top_salespersons_aggregate", _empty_list)
    monkeypatch.setattr(mod, "_query_daily_sales_trend_aggregate", _empty_list)
    monkeypatch.setattr(mod, "_query_category_distribution_aggregate", _empty_list)

    result = await mod._get_sales_overview("F001", q1_range)
    assert len(result["kpiCards"]) == 4
    # First KPI = total sales formatted
    assert result["kpiCards"][0]["key"] == "SALES_AMOUNT"
    assert result["kpiCards"][0]["unit"] == "元"
    # rankings dict carries salesperson (empty) — legacy non-Gold shape
    assert "salesperson" in result["rankings"]


# ============================================================
# Endpoint — GET /analysis/sales auth boundaries + happy
# ============================================================


def test_endpoint_missing_bearer_returns_401(client):
    r = client.get(
        "/api/mobile/F001/smart-bi/analysis/sales"
        "?startDate=2026-01-01&endDate=2026-03-31"
    )
    assert r.status_code == 401


def test_endpoint_expired_token_returns_401(client):
    expired = _make_token(exp_offset=-3600)
    r = client.get(
        "/api/mobile/F001/smart-bi/analysis/sales"
        "?startDate=2026-01-01&endDate=2026-03-31",
        headers=_auth_header(expired),
    )
    assert r.status_code == 401


def test_endpoint_cross_factory_denied_returns_403(client):
    """Token factoryId=F001 but URL F002 → 403."""
    r = client.get(
        "/api/mobile/F002/smart-bi/analysis/sales"
        "?startDate=2026-01-01&endDate=2026-03-31",
        headers=_auth_header(factory_id="F001"),
    )
    assert r.status_code == 403


def test_endpoint_no_factory_id_non_privileged_role_returns_403(client):
    """Token without factoryId + non-privileged role → 403."""
    r = client.get(
        "/api/mobile/F001/smart-bi/analysis/sales"
        "?startDate=2026-01-01&endDate=2026-03-31",
        headers=_auth_header(factory_id=None, role="operator"),
    )
    assert r.status_code == 403


def test_endpoint_happy_returns_seven_key_composite(monkeypatch, client):
    """Java reference: SmartBIAnalysisController.getSalesAnalysis returns the
    7-key composite (overview / customerRanking / productRanking / dateRange /
    salespersonRanking / generatedAt / trendChart) wrapped in standard envelope."""

    async def _fake_overview(*_a, **_kw):
        return mod._build_empty_dashboard()

    async def _fake_ranking(*_a, **_kw):
        return []

    async def _fake_trend(*_a, **_kw):
        return mod._new_chart_config_dict(
            chart_type="LINE", title="销售趋势",
            xaxis_field="date", yaxis_field="amount",
            data=[], options={"showDataLabels": False, "smooth": True},
        )

    monkeypatch.setattr(mod, "_get_sales_overview", _fake_overview)
    monkeypatch.setattr(mod, "_get_salesperson_ranking", _fake_ranking)
    monkeypatch.setattr(mod, "_get_product_ranking", _fake_ranking)
    monkeypatch.setattr(mod, "_get_customer_ranking", _fake_ranking)
    monkeypatch.setattr(mod, "_get_sales_trend_chart", _fake_trend)

    r = client.get(
        "/api/mobile/F001/smart-bi/analysis/sales"
        "?startDate=2026-01-01&endDate=2026-03-31",
        headers=_auth_header(),
    )
    assert r.status_code == 200
    body = r.json()
    assert body["success"] is True
    data = body["data"]
    # 7-key composite per Jackson-observed order
    assert list(data.keys()) == [
        "overview", "customerRanking", "productRanking", "dateRange",
        "salespersonRanking", "generatedAt", "trendChart",
    ]
    assert data["dateRange"]["startDate"] == "2026-01-01"
    assert data["dateRange"]["endDate"] == "2026-03-31"
    assert data["dateRange"]["days"] == 90
    assert data["trendChart"]["chartType"] == "LINE"


# ============================================================
# Module surface — exported symbols (regression guard)
# ============================================================


def test_module_exports_router_and_helpers():
    """Stable surface for sister chats / cleanup PRs."""
    assert hasattr(mod, "router")
    assert hasattr(mod, "_determine_growth_alert_level")
    assert hasattr(mod, "_determine_completion_alert_level")
    assert hasattr(mod, "_determine_change_direction")
    assert hasattr(mod, "_calculate_completion_rate")
    assert hasattr(mod, "_calculate_mom_growth")
    assert hasattr(mod, "_build_kpi_cards_from_aggregates")
    assert hasattr(mod, "_query_sales_aggregates")
    assert hasattr(mod, "_get_sales_overview")
    assert hasattr(mod, "_get_sales_trend_chart")
