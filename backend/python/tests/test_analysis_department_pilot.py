"""Phase 2B-2 chat-2B-dept pilot tests — ``analysis_department.py``.

Per ``docs/qa-audits/2026-05-12-python-migration-test-coverage-audit.md``
§2.3 row 7 + §3 priority row 17 + §5 template + §8.2 row 4.

Coverage scope (per §1 audit table — 1 endpoint + 13 internal helpers):

* **Sync arithmetic helpers** — ``_calculate_completion_rate`` (Rule 10
  divide-then-quantize ordering), ``_determine_target_completion_alert``
  (Rule 7 integer thresholds 60/85), ``_determine_quadrant`` (C3 per-point
  avg recompute, 4 quadrant labels), ``_aggregate_department_data`` (Rule 1
  null-default-to-Decimal("0"), C1 headcount MAX).

* **Sync shape helpers** — ``_create_empty_chart`` (7-key ChartConfig with
  lowercase-a ``xaxisField``/``yaxisField``, Rule 9 emit all nulls),
  ``_build_date_range`` (7-key DateRange with derived ``days``/``valid``).

* **Async DB seam helpers Rule 6** — ``_query_department_full`` and
  ``_query_department_daily_trend`` raise ``ValueError`` on ``None`` date
  rather than silent zero-result from ``BETWEEN NULL AND NULL``.

* **Async sub-services** — ``_get_department_ranking`` (6-key RankingItem
  per Java @Builder),  ``_get_department_completion_rates`` (11-key
  MetricResult, Rule 9 Lombok @Data + no @JsonInclude),
  ``_get_department_efficiency_matrix`` (7-key ChartConfig scatter with
  quadrant per data point), ``_get_department_trend_comparison`` (LINE
  ChartConfig with period bucketing).

* **Composite** — ``_get_department_analysis`` (6-key Jackson HashMap
  hash-iter order: ``completionRates`` / ``efficiencyMatrix`` / ``dateRange``
  / ``generatedAt`` / ``ranking`` / ``trendComparison``).

* **HTTP endpoint** — ``GET /api/mobile/{factory_id}/smart-bi/analysis/department``
  auth (401 missing/invalid/expired) + factory boundary (403 cross-factory,
  403 no-factoryId + non-privileged role) + happy path (200 + ApiResponse
  wrap shape).

Rule checklist (per ``.claude/rules/python-java-port.md``):

- [x] **Rule 1** — null fields default via ``is None`` ternary, NOT ``or``;
      ``Decimal("0")`` accumulator iterates.
- [x] **Rule 4** — ``_decimal_to_number`` int-collapse for integral Decimals
      (e.g. ``Decimal("50.00")`` → ``int(50)``) emitted in ranking values.
- [x] **Rule 6** — ``_query_department_full`` / ``_query_department_daily_trend``
      raise ``ValueError`` on ``None`` boundary.
- [x] **Rule 7** — integer thresholds 60/85 use ``float(value)`` comparison
      (Java ``value.doubleValue()`` parity, safe for integer thresholds).
- [x] **Rule 9** — MetricResult Lombok @Data emits all 11 keys including
      nulls; ChartConfig emits 7 keys with lowercase-``a`` ``xaxisField``.
- [x] **Rule 10** — ``_calculate_completion_rate`` uses
      ``((actual*100)/target).quantize(scale=4, HALF_UP)`` matching Java
      ``divide(target, 4, HALF_UP).multiply(100)``.

Gold-standard pilot pattern: ``test_config_thresholds_pilot.py``;
sister pilots: ``test_analysis_inventory_pilot.py`` /
``test_analysis_sales_pilot.py`` / ``test_analysis_procurement_pilot.py``.
"""
from __future__ import annotations

import os
from datetime import date
from decimal import Decimal

import jwt
import pytest

# JWT secret must be set before importing analysis_department so
# verify_jwt_and_factory finds it at request time.
os.environ.setdefault("JWT_SECRET", "phase-2b2-dept-pilot-test-secret")

from smartbi_compat.api import analysis_department as mod  # noqa: E402
from smartbi_compat.api.analysis_department import (  # noqa: E402
    _aggregate_department_data,
    _build_date_range,
    _calculate_completion_rate,
    _create_empty_chart,
    _determine_quadrant,
    _determine_target_completion_alert,
    _get_department_analysis,
    _get_department_completion_rates,
    _get_department_efficiency_matrix,
    _get_department_ranking,
    _get_department_trend_comparison,
    _query_department_daily_trend,
    _query_department_full,
    router,
)
from smartbi_compat.auth import JWT_ALGORITHM  # noqa: E402

# Phase 2B endpoint coverage marker (see conftest.py KNOWN_ENDPOINTS).
pytestmark = [pytest.mark.api_endpoint("analysis_department")]


JWT_SECRET = "phase-2b2-dept-pilot-test-secret"


@pytest.fixture(autouse=True)
def _jwt_env(monkeypatch):
    """Force JWT_SECRET to our value for the duration of each test —
    survives import-order collisions with sister test_analysis_*_pilot
    files that set their own secret at module load."""
    monkeypatch.setenv("JWT_SECRET", JWT_SECRET)
    yield


# ============================================================
# Fixtures — JWT, TestClient, row helpers
# ============================================================


def _make_token(
    *,
    user_id: int = 22,
    username: str = "alice",
    factory_id: str | None = "F001",
    role: str = "factory_super_admin",
    exp_offset: int = 3600,
) -> str:
    from time import time as _time

    payload: dict = {
        "userId": user_id,
        "username": username,
        "role": role,
        "exp": int(_time()) + exp_offset,
    }
    if factory_id is not None:
        payload["factoryId"] = factory_id
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def _auth_header(token: str | None = None, **token_kwargs) -> dict:
    if token is None:
        token = _make_token(**token_kwargs)
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def client():
    from fastapi import FastAPI
    from fastapi.testclient import TestClient

    app = FastAPI()
    app.include_router(router)
    return TestClient(app)


def _make_dept_row(**overrides) -> dict:
    """Mimic a smart_bi_department_data row (SELECT * shape per I3 lock)."""
    base = {
        "id": "row-1",
        "factory_id": "F001",
        "department": "销售部",
        "record_date": date(2026, 5, 15),
        "sales_amount": Decimal("1000"),
        "sales_target": Decimal("2000"),
        "cost_amount": Decimal("500"),
        "headcount": 10,
        # Precomputed columns — I3 lock: aggregator MUST ignore.
        "per_capita_sales": Decimal("999"),
        "per_capita_cost": Decimal("888"),
        "deleted_at": None,
    }
    base.update(overrides)
    return base


def _make_trend_row(**overrides) -> dict:
    """Mimic a smart_bi_sales_data row used by _query_department_daily_trend."""
    base = {
        "order_date": date(2026, 5, 15),
        "department": "销售部",
        "total_amount": Decimal("3000"),
    }
    base.update(overrides)
    return base


_DEPT_PATH = "/api/mobile/F001/smart-bi/analysis/department"
_DEFAULT_QS = {"startDate": "2026-05-01", "endDate": "2026-05-31"}


# ============================================================
# Section 1 — _determine_target_completion_alert (Rule 7 integer thresholds)
# ============================================================


def test_alert_red_below_60():
    """Java line 458: v < 60 → RED. 50 < 60 → RED."""
    assert _determine_target_completion_alert(Decimal("50")) == "RED"


def test_alert_yellow_between_60_and_85():
    """60 NOT < 60, but 60 < 85 → YELLOW. Likewise 70."""
    assert _determine_target_completion_alert(Decimal("60")) == "YELLOW"
    assert _determine_target_completion_alert(Decimal("70")) == "YELLOW"


def test_alert_green_at_85_boundary_strict_less_than():
    """Rule 7 strict semantic: Decimal('85') NOT < 85 → GREEN."""
    assert _determine_target_completion_alert(Decimal("85")) == "GREEN"
    assert _determine_target_completion_alert(Decimal("120")) == "GREEN"


def test_alert_red_on_zero_rule1():
    """Rule 1: Decimal('0') is a valid numeric, NOT falsy. 0 < 60 → RED."""
    assert _determine_target_completion_alert(Decimal("0")) == "RED"


def test_alert_yellow_just_below_85_strict_boundary():
    """Rule 7 boundary: float(84.9999) < 85 → YELLOW."""
    assert _determine_target_completion_alert(Decimal("84.9999")) == "YELLOW"


# ============================================================
# Section 2 — _calculate_completion_rate (Rule 10 + Rule 1)
# ============================================================


def test_completion_rate_happy_half():
    """100/200 * 100 = 50.0000 (intermediate quantize at scale 4)."""
    assert _calculate_completion_rate(Decimal("100"), Decimal("200")) == Decimal("50.0000")


def test_completion_rate_target_none_returns_zero():
    """Java line 612: target == null → ZERO."""
    assert _calculate_completion_rate(Decimal("100"), None) == Decimal("0")


def test_completion_rate_target_decimal_zero_returns_zero_rule1():
    """Rule 1: explicit ``target == Decimal('0')`` check (NOT ``not target``)."""
    assert _calculate_completion_rate(Decimal("100"), Decimal("0")) == Decimal("0")


def test_completion_rate_rule10_intermediate_quantize_at_scale_4():
    """Rule 10 — 200/300 = 0.6666... ; *100 = 66.6666... ; quantize(0.0001, HALF_UP)
    yields 66.6667 because the 5th decimal digit (6) rounds the 4th up. Java
    ``(actual*100).divide(target, 4, HALF_UP)`` produces the same byte.
    """
    assert _calculate_completion_rate(Decimal("200"), Decimal("300")) == Decimal("66.6667")


def test_completion_rate_rule10_exact_third_quantizes_down():
    """Rule 10 — 100/300 = 33.3333... ; 5th decimal is 3 → 33.3333 (no round-up).
    Lock-in for the most common 1/3 case to catch arithmetic regressions.
    """
    assert _calculate_completion_rate(Decimal("100"), Decimal("300")) == Decimal("33.3333")


# ============================================================
# Section 3 — _aggregate_department_data (Rule 1, C1 headcount MAX, I3 ignore)
# ============================================================


def test_aggregate_two_departments_preserves_insertion_order():
    """LinkedHashMap → Python dict insertion order. Java line 546 iteration."""
    rows = [
        _make_dept_row(department="销售部", sales_amount=Decimal("1000")),
        _make_dept_row(department="生产部", sales_amount=Decimal("500")),
    ]
    agg = _aggregate_department_data(rows)
    # First key is 销售部 (insertion order preserved).
    assert list(agg.keys()) == ["销售部", "生产部"]


def test_aggregate_sums_within_department():
    """Java line 561: salesAmount += data.getSalesAmount() (when not null)."""
    rows = [
        _make_dept_row(department="销售部", sales_amount=Decimal("1000"),
                       sales_target=Decimal("2000"), cost_amount=Decimal("500"),
                       headcount=5),
        _make_dept_row(department="销售部", sales_amount=Decimal("500"),
                       sales_target=Decimal("1000"), cost_amount=Decimal("200"),
                       headcount=8),
    ]
    agg = _aggregate_department_data(rows)
    assert agg["销售部"]["salesAmount"] == Decimal("1500")
    assert agg["销售部"]["salesTarget"] == Decimal("3000")
    assert agg["销售部"]["costAmount"] == Decimal("700")
    # C1: headcount = MAX(5, 8) = 8, NOT 5+8=13, NOT latest-by-date.
    assert agg["销售部"]["headcount"] == 8


def test_aggregate_rule1_null_fields_default_to_zero():
    """Rule 1 — Java line 553 ``data.getSalesAmount() != null ? ... : ZERO``.
    Python MUST use ``is None`` ternary, NOT ``or`` (Decimal('0') is falsy).
    """
    rows = [
        _make_dept_row(
            department="生产部",
            sales_amount=None,
            sales_target=None,
            cost_amount=None,
            headcount=None,
        ),
        _make_dept_row(
            department="生产部",
            sales_amount=Decimal("100"),
            sales_target=Decimal("200"),
            cost_amount=Decimal("50"),
            headcount=3,
        ),
    ]
    agg = _aggregate_department_data(rows)
    # Null-default to ZERO accumulates correctly with second row.
    assert agg["生产部"]["salesAmount"] == Decimal("100")
    assert agg["生产部"]["salesTarget"] == Decimal("200")
    assert agg["生产部"]["costAmount"] == Decimal("50")
    assert agg["生产部"]["headcount"] == 3


def test_aggregate_rule1_decimal_zero_iterates_not_skipped():
    """Rule 1 dual: Decimal('0') row contributes (accumulates 0) — must
    NOT be truthy-skipped. Code path: ``row.get("sales_amount") is not None``.
    """
    rows = [
        _make_dept_row(
            department="财务部",
            sales_amount=Decimal("0"),
            sales_target=Decimal("0"),
            cost_amount=Decimal("0"),
            headcount=0,
        ),
        _make_dept_row(
            department="财务部",
            sales_amount=Decimal("100"),
            sales_target=Decimal("100"),
            cost_amount=Decimal("100"),
            headcount=2,
        ),
    ]
    agg = _aggregate_department_data(rows)
    # 0 + 100 = 100 (zero accumulated, not silently skipped).
    assert agg["财务部"]["salesAmount"] == Decimal("100")
    # MAX(0, 2) = 2.
    assert agg["财务部"]["headcount"] == 2


def test_aggregate_i3_ignores_per_capita_columns():
    """I3 lock — SELECT * pulls precomputed per_capita_sales / per_capita_cost
    but aggregator MUST IGNORE (recomputed in efficiencyMatrix from headcount).
    """
    rows = [
        _make_dept_row(
            department="销售部",
            sales_amount=Decimal("1000"),
            cost_amount=Decimal("400"),
            headcount=10,
            per_capita_sales=Decimal("9999"),  # noise — must be ignored
            per_capita_cost=Decimal("8888"),
        ),
    ]
    agg = _aggregate_department_data(rows)
    assert "per_capita_sales" not in agg["销售部"]
    assert "per_capita_cost" not in agg["销售部"]
    # Aggregate shape is exactly the 4 standard keys.
    assert set(agg["销售部"].keys()) == {
        "salesAmount", "salesTarget", "costAmount", "headcount",
    }


# ============================================================
# Section 4 — _determine_quadrant (C3 per-point avg + 4 labels)
# ============================================================


def _two_dept_aggregated(
    sales_a: int, cost_a: int, sales_b: int, cost_b: int,
) -> dict:
    """Build a 2-dept aggregated dict each with headcount=10 (so per_capita
    equals the per-dept amount / 10). Used to control avg_sales / avg_cost
    so quadrant tests can pick known sides.
    """
    return {
        "A": {
            "salesAmount": Decimal(sales_a),
            "costAmount":  Decimal(cost_a),
            "salesTarget": Decimal("0"),
            "headcount":   10,
        },
        "B": {
            "salesAmount": Decimal(sales_b),
            "costAmount":  Decimal(cost_b),
            "salesTarget": Decimal("0"),
            "headcount":   10,
        },
    }


def test_quadrant_q1_high_output_high_cost():
    """A: sales=1000,cost=500 (per_capita 100/50); B: sales=200,cost=100
    (per_capita 20/10). avg = (100+20)/2=60 sales, (50+10)/2=30 cost.
    A: 100>=60 (high_output) AND 50>=30 (high_cost) → Q1.
    """
    agg = _two_dept_aggregated(1000, 500, 200, 100)
    q = _determine_quadrant(Decimal("100"), Decimal("50"), agg)
    assert q == "Q1_HIGH_OUTPUT_HIGH_COST"


def test_quadrant_q2_low_output_low_cost():
    """Same agg as Q1 test, B's per_capita (20/10): 20<60 AND 10<30 → Q2."""
    agg = _two_dept_aggregated(1000, 500, 200, 100)
    q = _determine_quadrant(Decimal("20"), Decimal("10"), agg)
    assert q == "Q2_LOW_OUTPUT_LOW_COST"


def test_quadrant_q4_high_output_low_cost():
    """A: sales=1000,cost=10 (per_capita 100/1); B: sales=100,cost=1000
    (per_capita 10/100). avg_sales=55, avg_cost=50.5.
    A: 100>=55 (high_output) AND 1<50.5 (low_cost) → Q4.
    """
    agg = _two_dept_aggregated(1000, 10, 100, 1000)
    q = _determine_quadrant(Decimal("100"), Decimal("1"), agg)
    assert q == "Q4_HIGH_OUTPUT_LOW_COST"


def test_quadrant_q3_low_output_high_cost():
    """Same agg as Q4 test, B's per_capita (10/100): 10<55 AND 100>=50.5 → Q3."""
    agg = _two_dept_aggregated(1000, 10, 100, 1000)
    q = _determine_quadrant(Decimal("10"), Decimal("100"), agg)
    assert q == "Q3_LOW_OUTPUT_HIGH_COST"


def test_quadrant_zero_headcount_dept_excluded_from_avg():
    """C3 — headcount=0 dept doesn't contribute to avg (Java line 226 if hc>0).
    A: 1000/10=100,500/10=50; B has headcount=0 → excluded.
    avg_sales=100, avg_cost=50 (single contributor).
    Pass A's per_capita (100,50): 100>=100 AND 50>=50 → Q1.
    """
    agg = _two_dept_aggregated(1000, 500, 200, 100)
    agg["B"]["headcount"] = 0
    q = _determine_quadrant(Decimal("100"), Decimal("50"), agg)
    assert q == "Q1_HIGH_OUTPUT_HIGH_COST"


# ============================================================
# Section 5 — _create_empty_chart (Rule 9: all 7 keys + lowercase-a)
# ============================================================


def test_create_empty_chart_emits_seven_keys_with_nulls():
    """Rule 9 — ChartConfig Lombok @Data + no @JsonInclude → 7 keys including
    null fields. ``xaxisField`` / ``yaxisField`` are LOWERCASE-A per Jackson
    PropertyNamingStrategy quirk on adjacent uppercase letters.
    """
    chart = _create_empty_chart("SCATTER", "部门效率矩阵")
    expected_keys = [
        "chartType",
        "title",
        "seriesField",
        "data",
        "options",
        "xaxisField",
        "yaxisField",
    ]
    assert list(chart.keys()) == expected_keys
    assert len(chart) == 7
    assert chart["chartType"] == "SCATTER"
    assert chart["title"] == "部门效率矩阵"
    assert chart["seriesField"] is None
    assert chart["data"] == []
    assert chart["options"] is None
    # Lowercase-a confirmed.
    assert chart["xaxisField"] is None
    assert chart["yaxisField"] is None
    assert "xAxisField" not in chart  # NOT camelCase
    assert "yAxisField" not in chart


# ============================================================
# Section 6 — _build_date_range (7-key DateRange + granularity inference)
# ============================================================


def test_date_range_emits_seven_keys_with_derived_fields():
    """Rule 9 — DateRange Lombok getters emit derived ``days`` + ``valid``
    in addition to the 5 stored fields.
    """
    dr = _build_date_range(date(2026, 5, 1), date(2026, 5, 31))
    expected_keys = [
        "startDate",
        "endDate",
        "granularity",
        "originalExpression",
        "relative",
        "days",
        "valid",
    ]
    assert list(dr.keys()) == expected_keys
    assert dr["startDate"] == "2026-05-01"
    assert dr["endDate"] == "2026-05-31"
    assert dr["days"] == 31
    assert dr["granularity"] == "MONTH"
    assert dr["relative"] is False
    assert dr["valid"] is True
    assert dr["originalExpression"] == "2026-05-01 至 2026-05-31"


def test_date_range_granularity_inference_day_to_year():
    """Spec §3.9: days<=1 DAY / <=7 WEEK / <=31 MONTH / <=93 QUARTER / else YEAR."""
    # 1 day → DAY (inclusive: (start-end).days + 1 = 1)
    assert _build_date_range(date(2026, 5, 1), date(2026, 5, 1))["granularity"] == "DAY"
    # 7 days → WEEK
    assert _build_date_range(date(2026, 5, 1), date(2026, 5, 7))["granularity"] == "WEEK"
    # 31 days → MONTH (boundary)
    assert _build_date_range(date(2026, 5, 1), date(2026, 5, 31))["granularity"] == "MONTH"
    # 93 days → QUARTER
    assert _build_date_range(date(2026, 1, 1), date(2026, 4, 3))["granularity"] == "QUARTER"
    # 94 days → YEAR
    assert _build_date_range(date(2026, 1, 1), date(2026, 4, 4))["granularity"] == "YEAR"


def test_date_range_invalid_when_start_after_end():
    """``valid = start_date <= end_date`` — derived from Lombok ``isValid()``."""
    dr = _build_date_range(date(2026, 5, 31), date(2026, 5, 1))
    assert dr["valid"] is False


# ============================================================
# Section 7 — Rule 6 None-check on DB seam helpers
# ============================================================


async def test_query_department_full_rejects_none_start_date():
    """Rule 6 — silent zero-result via ``BETWEEN NULL AND NULL`` is forbidden."""
    with pytest.raises(ValueError, match="start_date / end_date required"):
        await _query_department_full("F001", None, date(2026, 5, 31))


async def test_query_department_full_rejects_none_end_date():
    """Rule 6 — symmetric end_date guard."""
    with pytest.raises(ValueError, match="start_date / end_date required"):
        await _query_department_full("F001", date(2026, 5, 1), None)


async def test_query_department_daily_trend_rejects_none_date():
    """Rule 6 — _query_department_daily_trend also guards None inputs."""
    with pytest.raises(ValueError, match="start_date / end_date required"):
        await _query_department_daily_trend("F001", None, date(2026, 5, 31))


# ============================================================
# Section 8 — _get_department_ranking (RankingItem 6-key)
# ============================================================


async def test_ranking_empty_rows_returns_empty_list(monkeypatch):
    """Java line 70: rows.isEmpty() → return Collections.emptyList()."""

    async def _empty(*_a, **_kw):
        return []

    monkeypatch.setattr(mod, "_query_department_full", _empty)
    result = await _get_department_ranking("F001", date(2026, 5, 1), date(2026, 5, 31))
    assert result == []


async def test_ranking_sorted_by_sales_desc_with_six_key_items(monkeypatch):
    """Java line 76-87: sort by salesAmount desc + RankingItem put-order
    [rank, name, value, target, completionRate, alertLevel]. Rule 4 int-collapse
    on integral values via ``_decimal_to_number``.
    """
    rows = [
        _make_dept_row(department="A", sales_amount=Decimal("500"),
                       sales_target=Decimal("1000"), headcount=10),
        _make_dept_row(department="B", sales_amount=Decimal("2000"),
                       sales_target=Decimal("4000"), headcount=10),
        _make_dept_row(department="C", sales_amount=Decimal("100"),
                       sales_target=Decimal("200"), headcount=10),
    ]

    async def _rows(*_a, **_kw):
        return rows

    monkeypatch.setattr(mod, "_query_department_full", _rows)
    result = await _get_department_ranking("F001", date(2026, 5, 1), date(2026, 5, 31))

    assert len(result) == 3
    # Sort by salesAmount desc → B, A, C.
    assert [r["name"] for r in result] == ["B", "A", "C"]
    assert result[0]["rank"] == 1
    assert result[1]["rank"] == 2
    assert result[2]["rank"] == 3

    # RankingItem 6-key shape per Java @Builder declaration order.
    expected_keys = ["rank", "name", "value", "target", "completionRate", "alertLevel"]
    for item in result:
        assert list(item.keys()) == expected_keys

    # Rule 4 int-collapse: Decimal('2000').quantize(0.01) → Decimal('2000.00')
    # → _decimal_to_number → int(2000) because integral.
    b = result[0]
    assert b["value"] == 2000
    assert isinstance(b["value"], int)
    assert b["target"] == 4000
    # completionRate: 2000/4000*100 = 50.0000 → quantize(0.01) = 50.00 → int(50).
    assert b["completionRate"] == 50
    # alertLevel: 50 < 60 → RED.
    assert b["alertLevel"] == "RED"


# ============================================================
# Section 9 — _get_department_completion_rates (Rule 9 11-key MetricResult)
# ============================================================


async def test_completion_rates_empty_rows_returns_empty(monkeypatch):
    """Empty rows → return []."""

    async def _empty(*_a, **_kw):
        return []

    monkeypatch.setattr(mod, "_query_department_full", _empty)
    result = await _get_department_completion_rates(
        "F001", date(2026, 5, 1), date(2026, 5, 31),
    )
    assert result == []


async def test_completion_rates_emits_eleven_key_metric_result(monkeypatch):
    """Rule 9 — MetricResult Lombok @Data + no @JsonInclude → emit all 11
    keys incl nulls. Code path emits in Jackson hash-iter order: [metricCode,
    metricName, value, formattedValue, unit, changePercent, changeDirection,
    changeValue, alertLevel, dimensionValue, description].

    Sort by ``value`` desc (Java line 198).
    """
    rows = [
        _make_dept_row(department="A", sales_amount=Decimal("300"),
                       sales_target=Decimal("1000")),
        _make_dept_row(department="B", sales_amount=Decimal("900"),
                       sales_target=Decimal("1000")),
    ]

    async def _rows(*_a, **_kw):
        return rows

    monkeypatch.setattr(mod, "_query_department_full", _rows)
    result = await _get_department_completion_rates(
        "F001", date(2026, 5, 1), date(2026, 5, 31),
    )

    assert len(result) == 2
    # Sort by value desc: B(90) > A(30).
    assert [m["dimensionValue"] for m in result] == ["B", "A"]

    expected_keys = [
        "metricCode", "metricName", "value", "formattedValue", "unit",
        "changePercent", "changeDirection", "changeValue", "alertLevel",
        "dimensionValue", "description",
    ]
    for metric in result:
        assert list(metric.keys()) == expected_keys
        assert metric["metricCode"] == "TARGET_COMPLETION"
        assert metric["metricName"] == "目标完成率"
        assert metric["unit"] == "%"
        # Rule 9 null fields emit explicitly.
        assert metric["changePercent"] is None
        assert metric["changeDirection"] is None
        assert metric["changeValue"] is None
        assert metric["description"] is None

    # B: 900/1000*100=90 → alert: 90>=85 GREEN.
    b = result[0]
    assert b["value"] == 90
    assert b["alertLevel"] == "GREEN"
    # formattedValue: ``f"{cr_display:,.2f}%"`` = "90.00%".
    assert b["formattedValue"] == "90.00%"

    # A: 300/1000*100=30 → alert: 30<60 RED.
    a = result[1]
    assert a["value"] == 30
    assert a["alertLevel"] == "RED"


# ============================================================
# Section 10 — _get_department_efficiency_matrix (SCATTER 7-key)
# ============================================================


async def test_efficiency_matrix_empty_returns_empty_scatter_chart(monkeypatch):
    """Empty rows → ``_create_empty_chart("SCATTER", "部门效率矩阵")`` —
    7 keys including null seriesField/options and empty data list.
    """

    async def _empty(*_a, **_kw):
        return []

    monkeypatch.setattr(mod, "_query_department_full", _empty)
    chart = await _get_department_efficiency_matrix(
        "F001", date(2026, 5, 1), date(2026, 5, 31),
    )
    assert chart["chartType"] == "SCATTER"
    assert chart["title"] == "部门效率矩阵"
    assert chart["data"] == []
    assert list(chart.keys()) == [
        "chartType", "title", "seriesField", "data", "options",
        "xaxisField", "yaxisField",
    ]


async def test_efficiency_matrix_with_data_emits_seven_key_chart(monkeypatch):
    """Populated ChartConfig with 6-key data points (incl quadrant) +
    options.quadrantLines / .quadrantLabels.
    """
    rows = [
        _make_dept_row(department="A", sales_amount=Decimal("1000"),
                       cost_amount=Decimal("500"), headcount=10),
        _make_dept_row(department="B", sales_amount=Decimal("200"),
                       cost_amount=Decimal("100"), headcount=10),
    ]

    async def _rows(*_a, **_kw):
        return rows

    monkeypatch.setattr(mod, "_query_department_full", _rows)
    chart = await _get_department_efficiency_matrix(
        "F001", date(2026, 5, 1), date(2026, 5, 31),
    )

    # ChartConfig 7-key shape.
    assert list(chart.keys()) == [
        "chartType", "title", "seriesField", "data", "options",
        "xaxisField", "yaxisField",
    ]
    assert chart["chartType"] == "SCATTER"
    assert chart["seriesField"] == "department"
    assert chart["xaxisField"] == "perCapitaSales"
    assert chart["yaxisField"] == "perCapitaCost"

    # Each data point has 6 keys incl quadrant.
    assert len(chart["data"]) == 2
    point_keys = {"department", "perCapitaSales", "perCapitaCost",
                  "salesAmount", "headcount", "quadrant"}
    for pt in chart["data"]:
        assert set(pt.keys()) == point_keys

    # A: per_capita 100/50 vs avg 60/30 → Q1.
    a = chart["data"][0]
    assert a["department"] == "A"
    assert a["perCapitaSales"] == 100
    assert a["perCapitaCost"] == 50
    assert a["quadrant"] == "Q1_HIGH_OUTPUT_HIGH_COST"

    # options shape per impl: quadrantLines + quadrantLabels +
    # bubbleSizeField + colorField.
    opts = chart["options"]
    assert opts["quadrantLines"] == {"xAxis": 60, "yAxis": 30}
    assert set(opts["quadrantLabels"].keys()) == {"q1", "q2", "q3", "q4"}
    assert opts["bubbleSizeField"] == "salesAmount"
    assert opts["colorField"] == "department"


# ============================================================
# Section 11 — _get_department_trend_comparison (LINE chart)
# ============================================================


async def test_trend_comparison_empty_returns_line_empty_chart(monkeypatch):
    """Empty daily trend → ``_create_empty_chart("LINE", "部门销售趋势对比")``."""

    async def _empty(*_a, **_kw):
        return []

    monkeypatch.setattr(mod, "_query_department_daily_trend", _empty)
    chart = await _get_department_trend_comparison(
        "F001", date(2026, 5, 1), date(2026, 5, 31), period="WEEK",
    )
    assert chart["chartType"] == "LINE"
    assert chart["title"] == "部门销售趋势对比"
    assert chart["data"] == []


async def test_trend_comparison_buckets_by_period_and_emits_chart(monkeypatch):
    """Java line 354-416 — period bucketing via ``_get_period_key`` + 7-key
    ChartConfig. Period default = WEEK per composite path.
    """
    rows = [
        _make_trend_row(order_date=date(2026, 5, 1), department="销售部",
                        total_amount=Decimal("100")),
        _make_trend_row(order_date=date(2026, 5, 1), department="生产部",
                        total_amount=Decimal("200")),
        _make_trend_row(order_date=date(2026, 5, 8), department="销售部",
                        total_amount=Decimal("300")),
    ]

    async def _rows(*_a, **_kw):
        return rows

    monkeypatch.setattr(mod, "_query_department_daily_trend", _rows)
    chart = await _get_department_trend_comparison(
        "F001", date(2026, 5, 1), date(2026, 5, 31), period="WEEK",
    )
    assert chart["chartType"] == "LINE"
    assert chart["title"] == "部门销售趋势对比"
    assert chart["seriesField"] == "department"
    assert chart["xaxisField"] == "period"
    assert chart["yaxisField"] == "amount"
    # 销售部 inserted before 生产部.
    assert chart["options"]["series"] == ["销售部", "生产部"]
    assert chart["options"]["period"] == "WEEK"
    # 2 period buckets (week 18 and 19), per-period entry has period + each
    # dept's amount (Rule 4 int-collapse on integral values).
    assert len(chart["data"]) >= 1
    first_point = chart["data"][0]
    assert "period" in first_point
    assert "销售部" in first_point
    assert "生产部" in first_point


async def test_trend_comparison_null_department_falls_back_to_unknown(monkeypatch):
    """Java line 372 fallback: null department → '未知部门'."""
    rows = [
        _make_trend_row(order_date=date(2026, 5, 1), department=None,
                        total_amount=Decimal("500")),
    ]

    async def _rows(*_a, **_kw):
        return rows

    monkeypatch.setattr(mod, "_query_department_daily_trend", _rows)
    chart = await _get_department_trend_comparison(
        "F001", date(2026, 5, 1), date(2026, 5, 31), period="WEEK",
    )
    # Single bucket with the unknown-department fallback key present.
    assert chart["options"]["series"] == ["未知部门"]
    assert "未知部门" in chart["data"][0]


# ============================================================
# Section 12 — _get_department_analysis (6-key composite)
# ============================================================


async def test_department_analysis_composite_emits_six_keys_in_jackson_order(monkeypatch):
    """Top-level data composite uses Jackson HashMap hash-iter order
    [completionRates, efficiencyMatrix, dateRange, generatedAt, ranking,
    trendComparison] (NOT Java put-order). ``generatedAt`` is volatile and
    asserted only for presence.
    """

    async def _rows(*_a, **_kw):
        return []

    async def _empty_trend(*_a, **_kw):
        return []

    monkeypatch.setattr(mod, "_query_department_full", _rows)
    monkeypatch.setattr(mod, "_query_department_daily_trend", _empty_trend)

    result = await _get_department_analysis(
        "F001", date(2026, 5, 1), date(2026, 5, 31),
    )
    assert list(result.keys()) == [
        "completionRates",
        "efficiencyMatrix",
        "dateRange",
        "generatedAt",
        "ranking",
        "trendComparison",
    ]
    # Sub-shapes confirmed in earlier tests; here just lock the composite.
    assert result["ranking"] == []
    assert result["completionRates"] == []
    assert result["efficiencyMatrix"]["chartType"] == "SCATTER"
    assert result["trendComparison"]["chartType"] == "LINE"
    assert result["dateRange"]["days"] == 31
    # ``generatedAt`` is volatile (per _utc_now_iso); assert presence + ISO shape.
    assert isinstance(result["generatedAt"], str)
    assert "T" in result["generatedAt"]


# ============================================================
# Section 13 — HTTP endpoint auth boundaries
# ============================================================


def test_endpoint_missing_bearer_returns_401(client):
    """auth.py L45-46 — no Authorization header → 401."""
    r = client.get(_DEPT_PATH, params=_DEFAULT_QS)
    assert r.status_code == 401


def test_endpoint_invalid_token_returns_401(client):
    """auth.py L53-54 — InvalidTokenError → 401."""
    r = client.get(
        _DEPT_PATH,
        params=_DEFAULT_QS,
        headers={"Authorization": "Bearer garbage.token.value"},
    )
    assert r.status_code == 401


def test_endpoint_expired_token_returns_401(client):
    """auth.py L51-52 — ExpiredSignatureError → 401."""
    expired = _make_token(exp_offset=-3600)
    r = client.get(_DEPT_PATH, params=_DEFAULT_QS, headers=_auth_header(expired))
    assert r.status_code == 401


def test_endpoint_cross_factory_returns_403(client):
    """auth.py L66-69 — token factoryId=F999 vs URL F001 → 403."""
    r = client.get(
        _DEPT_PATH,
        params=_DEFAULT_QS,
        headers=_auth_header(factory_id="F999"),
    )
    assert r.status_code == 403


def test_endpoint_no_factory_id_non_privileged_returns_403(client):
    """auth.py L59-63 — null factoryId + role not in PRIVILEGED_ROLES → 403."""
    r = client.get(
        _DEPT_PATH,
        params=_DEFAULT_QS,
        headers=_auth_header(factory_id=None, role="operator"),
    )
    assert r.status_code == 403


# ============================================================
# Section 14 — HTTP endpoint happy path (full envelope)
# ============================================================


def test_endpoint_happy_returns_wrapped_six_key_data(client, monkeypatch):
    """Endpoint wraps ``_get_department_analysis`` result via ``wrap_response``.
    Outer envelope: 8 keys (``ApiResponse.success`` shape). Inner data: 6 keys
    in Jackson order. Mock the underlying composite to keep test DB-free.
    """
    sentinel = {
        "completionRates":  [],
        "efficiencyMatrix": _create_empty_chart("SCATTER", "部门效率矩阵"),
        "dateRange":        _build_date_range(
            date(2026, 5, 1), date(2026, 5, 31),
        ),
        "generatedAt":      "2026-05-12T08:00:00",
        "ranking":          [],
        "trendComparison":  _create_empty_chart("LINE", "部门销售趋势对比"),
    }

    async def _fake_analysis(factory_id, start_date, end_date):
        return sentinel

    monkeypatch.setattr(mod, "_get_department_analysis", _fake_analysis)

    r = client.get(_DEPT_PATH, params=_DEFAULT_QS, headers=_auth_header())
    assert r.status_code == 200, r.text
    body = r.json()

    # ApiResponse envelope 8 keys.
    expected_envelope = {
        "code", "message", "data", "timestamp",
        "success", "actionHint", "severity", "hintTarget",
    }
    assert set(body.keys()) == expected_envelope
    assert body["success"] is True
    assert body["code"] == 200
    assert body["actionHint"] is None
    assert body["severity"] is None
    assert body["hintTarget"] is None

    # Inner data — 6-key composite per Jackson hash-iter order.
    assert list(body["data"].keys()) == [
        "completionRates", "efficiencyMatrix", "dateRange",
        "generatedAt", "ranking", "trendComparison",
    ]
    assert body["data"]["dateRange"]["days"] == 31
    assert body["data"]["efficiencyMatrix"]["chartType"] == "SCATTER"


def test_endpoint_accepts_ignored_department_query_param(client, monkeypatch):
    """Endpoint accepts ``department`` query but IGNORES it (composite path
    is always taken per Java prod). Verify no 422 and the param doesn't
    reach the underlying service.
    """
    seen_kwargs: dict = {}

    async def _fake_analysis(factory_id, start_date, end_date):
        seen_kwargs["positional"] = (factory_id, start_date, end_date)
        return {
            "completionRates":  [],
            "efficiencyMatrix": _create_empty_chart("SCATTER", "x"),
            "dateRange":        _build_date_range(date(2026, 5, 1), date(2026, 5, 31)),
            "generatedAt":      "2026-05-12T08:00:00",
            "ranking":          [],
            "trendComparison":  _create_empty_chart("LINE", "y"),
        }

    monkeypatch.setattr(mod, "_get_department_analysis", _fake_analysis)

    r = client.get(
        _DEPT_PATH,
        params={**_DEFAULT_QS, "department": "销售部"},
        headers=_auth_header(),
    )
    assert r.status_code == 200, r.text
    # Underlying service called with 3 positional args, NO department keyword.
    assert seen_kwargs["positional"] == ("F001", date(2026, 5, 1), date(2026, 5, 31))


# ============================================================
# Section 15 — Module surface (stable exports for sister chats)
# ============================================================


def test_module_exports_router_and_helpers():
    """Stable surface for cleanup PRs / sister chats."""
    assert hasattr(mod, "router")
    assert hasattr(mod, "_query_department_full")
    assert hasattr(mod, "_query_department_daily_trend")
    assert hasattr(mod, "_aggregate_department_data")
    assert hasattr(mod, "_calculate_completion_rate")
    assert hasattr(mod, "_determine_target_completion_alert")
    assert hasattr(mod, "_determine_quadrant")
    assert hasattr(mod, "_create_empty_chart")
    assert hasattr(mod, "_build_date_range")
    assert hasattr(mod, "_get_department_ranking")
    assert hasattr(mod, "_get_department_completion_rates")
    assert hasattr(mod, "_get_department_efficiency_matrix")
    assert hasattr(mod, "_get_department_trend_comparison")
    assert hasattr(mod, "_get_department_analysis")
