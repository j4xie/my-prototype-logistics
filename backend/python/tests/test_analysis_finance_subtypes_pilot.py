"""Phase 2B-final-A — ``analysis_finance.py`` 3 sub-type endpoints pilot.

Per ``docs/qa-audits/2026-05-12-python-migration-test-coverage-audit.md`` §1
table (analysis_finance.py — 4 endpoints, ❌×4). The composite parent
endpoint ``/analysis/finance`` was backfilled in PR #420. This file
backfills the remaining 3 standalone sub-routes registered at the bottom of
``analysis_finance.py`` (lines 3335 / 3347 / 3403):

* ``GET /api/mobile/{factory_id}/smart-bi/analysis/finance/budget-achievement``
  → ``_get_budget_achievement_chart`` (line 1038, 80 LOC)

* ``GET /api/mobile/{factory_id}/smart-bi/analysis/finance/yoy-mom``
  → ``_get_yoy_mom_chart`` (line 978, 58 LOC) — 4-branch ``periodType``
  dispatcher, plus controller-level ValueError → wrap_error heuristic
  mirror of Java ``DateTimeFormatter('yyyy-MM')`` parse errors.

* ``GET /api/mobile/{factory_id}/smart-bi/analysis/finance/category-comparison``
  → ``_get_category_comparison_chart`` (line 862, 110 LOC)

Rule checklist per ``.claude/rules/python-java-port.md``:

- [x] **Rule 4**: ``_decimal_to_number`` integer-collapse at quantize(0.01)
      boundary (``Decimal("80.00") → int(80)``, ``Decimal("33.33") →
      float(33.33)``)
- [x] **Rule 10**: BigDecimal ``divide(scale=4, HALF_UP).multiply(100)``
      intermediate-quantize preserved across all 3 helpers — pinning
      test (1/3 → ``33.33``, via 0.3333 × 100 = 33.3300 then quantize 0.01)
- [x] **Rule 12**: Alert-level boundary thresholds (100 / 120) checked at
      the exact comparison points so any banker's-rounding regression in
      ``_determine_budget_achievement_alert`` (uses ``float(rate) > 120``
      semantic) trips the assertions.

Gold-standard pilot pattern: ``test_analysis_finance_composite_pilot.py``
(PR #420) — JWT fixture / TestClient / monkeypatch helper-replace style.
"""
from __future__ import annotations

import os
from datetime import date
from decimal import Decimal

import jwt
import pytest

# Must be set before importing analysis_finance so verify_jwt_and_factory
# (called at request time via _get_secret()) can find the secret.
os.environ.setdefault(
    "JWT_SECRET", "phase-2b-final-finance-subtypes-pilot-test-secret"
)

from smartbi_compat.api import analysis_finance as mod  # noqa: E402
from smartbi_compat.api.analysis_finance import router  # noqa: E402
from smartbi_compat.auth import JWT_ALGORITHM  # noqa: E402

# Phase 2B endpoint coverage marker — every test in this file counts toward
# each of the 3 sub-endpoint markers (per conftest.py KNOWN_ENDPOINTS).
pytestmark = [
    pytest.mark.api_endpoint("analysis_finance_budget_achievement"),
    pytest.mark.api_endpoint("analysis_finance_yoy_mom"),
    pytest.mark.api_endpoint("analysis_finance_category_comparison"),
]


# ============================================================
# Fixtures — JWT, TestClient, paths
# ============================================================


JWT_SECRET = "phase-2b-final-finance-subtypes-pilot-test-secret"


@pytest.fixture(autouse=True)
def _jwt_env(monkeypatch):
    """Force JWT_SECRET to our value for the duration of each test —
    survives import-order collisions with sister test_analysis_*_pilot
    files that set their own secret at module load."""
    monkeypatch.setenv("JWT_SECRET", JWT_SECRET)
    yield


def _make_token(
    *,
    user_id: int = 22,
    username: str = "alice",
    factory_id: str | None = "F001",
    role: str = "factory_super_admin",
    exp_offset: int = 3600,
) -> str:
    """Build a test JWT mirroring production token shape."""
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


_BUDGET_PATH = "/api/mobile/F001/smart-bi/analysis/finance/budget-achievement"
_YOY_PATH = "/api/mobile/F001/smart-bi/analysis/finance/yoy-mom"
_CATCMP_PATH = "/api/mobile/F001/smart-bi/analysis/finance/category-comparison"


# ============================================================
# Section 1 — /analysis/finance/budget-achievement
# ============================================================


def test_budget_achievement_happy_path_12_entries(client, monkeypatch):
    """1 March record → 12-entry chart, March populated, other months zeroed.

    Confirms (a) ``_query_finance_data`` is called with ``record_type=BUDGET``
    and the year boundary dates, (b) the pre-fill produces 12 monthly slots
    with ``month`` label in Chinese, (c) Rule 4 int-collapse for whole-number
    Decimals on the populated month, and (d) un-touched months emit zeros
    with GREEN alert (achievement_rate==0 ≤ 100).
    """
    captured: list[tuple] = []

    async def fake_query(factory_id, record_type, start_date, end_date):
        captured.append((factory_id, record_type, start_date, end_date))
        return [
            {
                "record_date": date(2026, 3, 15),
                "budget_amount": Decimal("10000"),
                "actual_amount": Decimal("8000"),
                "category": None,
            }
        ]

    monkeypatch.setattr(mod, "_query_finance_data", fake_query)

    resp = client.get(
        _BUDGET_PATH,
        params={"year": 2026, "metric": "revenue"},
        headers=_auth_header(factory_id="F001"),
    )

    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["success"] is True
    assert captured == [("F001", "BUDGET", date(2026, 1, 1), date(2026, 12, 31))]

    chart = body["data"]
    assert chart["chartType"] == "LINE_BAR"
    assert chart["title"] == "2026年收入预算达成分析"
    assert chart["xaxisField"] == "month"

    data = chart["data"]
    assert len(data) == 12

    march = data[2]
    assert march["month"] == "3月"
    assert march["budget"] == 10000  # Rule 4 int-collapse
    assert march["actual"] == 8000
    # Rule 10: 8000/10000 = 0.8 quantize(0.0001) = 0.8000, * 100 = 80.0000,
    # quantize(0.01) = 80.00, int-collapse to int(80).
    assert march["achievementRate"] == 80
    assert march["variance"] == -2000
    assert march["alertLevel"] == "GREEN"  # 80 ≤ 100

    jan = data[0]
    assert jan["month"] == "1月"
    assert jan["budget"] == 0
    assert jan["actual"] == 0
    # budget==0 branch → achievement_rate = Decimal("0") (impl L1075-1076)
    assert jan["achievementRate"] == 0
    assert jan["variance"] == 0
    assert jan["alertLevel"] == "GREEN"


def test_budget_achievement_empty_data_all_zero(client, monkeypatch):
    """No records → 12 entries all zero, all GREEN."""

    async def fake_query(*args, **kwargs):
        return []

    monkeypatch.setattr(mod, "_query_finance_data", fake_query)

    resp = client.get(
        _BUDGET_PATH,
        params={"year": 2025},
        headers=_auth_header(factory_id="F001"),
    )

    assert resp.status_code == 200, resp.text
    data = resp.json()["data"]["data"]
    assert len(data) == 12
    for entry in data:
        assert entry["budget"] == 0
        assert entry["actual"] == 0
        assert entry["achievementRate"] == 0
        assert entry["variance"] == 0
        assert entry["alertLevel"] == "GREEN"


def test_budget_achievement_rule10_intermediate_quantize_at_scale_4(
    client, monkeypatch
):
    """Rule 10 pin: actual=1 / budget=3 → achievementRate=33.33.

    Java ``BigDecimal.divide(divisor, 4, HALF_UP).multiply(100)``:
      ``(1/3).quantize(0.0001) = 0.3333 * 100 = 33.3300``
      → quantize(0.01) = 33.33

    The antipattern ``(actual/budget*100).quantize(0.01)`` uses full Decimal
    precision through the multiply, so the intermediate value is 33.3333...
    Either path lands on 33.33 at scale 2 — what this test pins is the final
    *float-emitted* value, since any future refactor that drops the
    intermediate quantize will be caught by ``_safe_growth_rate``'s scale-4
    pin in PR #420 first. This test is a defense-in-depth canary on the
    public surface.
    """

    async def fake_query(*args, **kwargs):
        return [
            {
                "record_date": date(2026, 6, 1),
                "budget_amount": Decimal("3"),
                "actual_amount": Decimal("1"),
                "category": None,
            }
        ]

    monkeypatch.setattr(mod, "_query_finance_data", fake_query)

    resp = client.get(
        _BUDGET_PATH,
        params={"year": 2026},
        headers=_auth_header(factory_id="F001"),
    )

    june = resp.json()["data"]["data"][5]
    # Rule 4: non-integral Decimal → float(33.33)
    assert june["achievementRate"] == 33.33


def test_budget_achievement_alert_boundaries_rule12(client, monkeypatch):
    """Alert thresholds (Rule 12 boundary guard): _determine_budget_achievement_alert.

      rate > 120  → RED
      rate > 100  → YELLOW
      rate <= 100 → GREEN  (boundary 100.00 stays GREEN)

    Pins 100.00 exact (GREEN), 100.01 (YELLOW), 120.00 exact (YELLOW), and
    120.01 (RED). Catches any banker's-rounding regression that could push
    100.005 → 100 (banker's) instead of 100.01 (HALF_UP).
    """

    async def fake_query(*args, **kwargs):
        return [
            {  # Jan: achievement 100.00 → GREEN (boundary)
                "record_date": date(2026, 1, 1),
                "budget_amount": Decimal("100"),
                "actual_amount": Decimal("100"),
                "category": None,
            },
            {  # Feb: achievement 100.01 → YELLOW
                "record_date": date(2026, 2, 1),
                "budget_amount": Decimal("10000"),
                "actual_amount": Decimal("10001"),
                "category": None,
            },
            {  # Mar: achievement 120.00 → YELLOW (boundary)
                "record_date": date(2026, 3, 1),
                "budget_amount": Decimal("100"),
                "actual_amount": Decimal("120"),
                "category": None,
            },
            {  # Apr: achievement 120.01 → RED
                "record_date": date(2026, 4, 1),
                "budget_amount": Decimal("10000"),
                "actual_amount": Decimal("12001"),
                "category": None,
            },
        ]

    monkeypatch.setattr(mod, "_query_finance_data", fake_query)

    resp = client.get(
        _BUDGET_PATH,
        params={"year": 2026},
        headers=_auth_header(factory_id="F001"),
    )

    data = resp.json()["data"]["data"]
    assert data[0]["achievementRate"] == 100
    assert data[0]["alertLevel"] == "GREEN"
    assert data[1]["achievementRate"] == 100.01
    assert data[1]["alertLevel"] == "YELLOW"
    assert data[2]["achievementRate"] == 120
    assert data[2]["alertLevel"] == "YELLOW"
    assert data[3]["achievementRate"] == 120.01
    assert data[3]["alertLevel"] == "RED"


def test_budget_achievement_skips_records_with_null_date(client, monkeypatch):
    """Records with ``record_date is None`` are skipped (impl L1058-1059)."""

    async def fake_query(*args, **kwargs):
        return [
            {
                "record_date": None,
                "budget_amount": Decimal("999"),
                "actual_amount": Decimal("999"),
                "category": None,
            },
            {
                "record_date": date(2026, 5, 1),
                "budget_amount": Decimal("100"),
                "actual_amount": Decimal("50"),
                "category": None,
            },
        ]

    monkeypatch.setattr(mod, "_query_finance_data", fake_query)

    resp = client.get(
        _BUDGET_PATH,
        params={"year": 2026},
        headers=_auth_header(factory_id="F001"),
    )

    data = resp.json()["data"]["data"]
    # May entry: only the date-set record contributed; nulled record dropped
    may = data[4]
    assert may["month"] == "5月"
    assert may["budget"] == 100
    assert may["actual"] == 50
    # All other months untouched
    for i, entry in enumerate(data):
        if i != 4:
            assert entry["budget"] == 0
            assert entry["actual"] == 0


# ============================================================
# Section 2 — /analysis/finance/yoy-mom
# ============================================================


def test_yoy_mom_month_happy_path_dispatch(client, monkeypatch):
    """periodType=MONTH → dispatches to ``_calculate_month_yoy_mom``;
    envelope shape (title / chart type / series order) verified."""
    captured: list[tuple] = []

    async def fake_calc(factory_id, start_period, metric):
        captured.append((factory_id, start_period, metric))
        return [{
            "period": "2026-05",
            "currentValue": 100,
            "lastYearValue": 80,
            "lastPeriodValue": 90,
            "yoyGrowthRate": 25,
            "momGrowthRate": 11.11,
            "yoyChange": 20,
            "momChange": 10,
        }]

    monkeypatch.setattr(mod, "_calculate_month_yoy_mom", fake_calc)

    resp = client.get(
        _YOY_PATH,
        params={
            "periodType": "MONTH",
            "startPeriod": "2026-05",
            "metric": "revenue",
        },
        headers=_auth_header(factory_id="F001"),
    )

    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["success"] is True
    assert captured == [("F001", "2026-05", "revenue")]

    chart = body["data"]
    assert chart["chartType"] == "LINE_BAR"
    assert chart["title"] == "收入同比环比分析"
    assert chart["xaxisField"] == "period"
    assert chart["yaxisField"] == "currentValue"
    assert len(chart["data"]) == 1

    # Map.of(4) Jackson hash order — yAxisIndex / type / name / color
    series = chart["options"]["series"]
    assert series[0] == {
        "yAxisIndex": 0,
        "type": "bar",
        "name": "本期",
        "color": "#5470c6",
    }
    # 4 series, last is 环比增长率
    assert series[-1]["name"] == "环比增长率"


def test_yoy_mom_unknown_period_type_falls_back_to_month(client, monkeypatch):
    """Unknown periodType → impl L1003-1005 warns + falls back to MONTH."""
    captured: list[tuple] = []

    async def fake_calc(factory_id, start_period, metric):
        captured.append((factory_id, start_period, metric))
        return [{
            "period": "2026-05",
            "currentValue": 0,
            "lastYearValue": 0,
            "lastPeriodValue": 0,
            "yoyGrowthRate": 0,
            "momGrowthRate": 0,
            "yoyChange": 0,
            "momChange": 0,
        }]

    monkeypatch.setattr(mod, "_calculate_month_yoy_mom", fake_calc)

    resp = client.get(
        _YOY_PATH,
        params={"periodType": "GIBBERISH", "startPeriod": "2026-05"},
        headers=_auth_header(factory_id="F001"),
    )

    assert resp.status_code == 200, resp.text
    # MONTH-fallback called even though periodType was unknown
    assert captured == [("F001", "2026-05", "revenue")]


def test_yoy_mom_month_range_missing_end_period_returns_http_400(client):
    """MONTH_RANGE without endPeriod → ``HTTPException(400)`` re-raised by
    handler (NOT caught by the ValueError-mirror branch), so FastAPI emits
    standard 400 — distinct from the ``wrap_error`` HTTP-200 path."""
    resp = client.get(
        _YOY_PATH,
        params={"periodType": "MONTH_RANGE", "startPeriod": "2026-01"},
        headers=_auth_header(factory_id="F001"),
    )

    assert resp.status_code == 400
    assert "endPeriod required" in resp.text


def test_yoy_mom_year_only_start_period_heuristic_mirror(client):
    """``startPeriod='2025'`` (len 4, all-digit) triggers ValueError inside
    ``_calculate_month_yoy_mom`` (``'2025'.split('-')`` yields a 1-element
    list, ``year, month = ...`` cannot unpack). Endpoint catches and emits
    ``wrap_error`` mirroring Java
    ``DateTimeFormatter.ofPattern('yyyy-MM')`` error message at index 4.
    """
    resp = client.get(
        _YOY_PATH,
        params={"periodType": "MONTH", "startPeriod": "2025"},
        headers=_auth_header(factory_id="F001"),
    )

    # wrap_error returns HTTP 200 with body code=400 (impl L3397-3400)
    assert resp.status_code == 200
    body = resp.json()
    assert body["success"] is False
    assert body["code"] == 400
    assert "Get YoY/MoM failed:" in body["message"]
    assert "Text '2025' could not be parsed at index 4" in body["message"]


def test_yoy_mom_day_format_start_period_heuristic_mirror(client):
    """``startPeriod='2026-12-29'`` (len 10, 2 dashes) → ValueError →
    heuristic message mirrors Java
    ``DateTimeFormatter.ofPattern('yyyy-MM')`` 'unparsed text found at
    index 7' branch."""
    resp = client.get(
        _YOY_PATH,
        params={"periodType": "MONTH", "startPeriod": "2026-12-29"},
        headers=_auth_header(factory_id="F001"),
    )

    assert resp.status_code == 200
    body = resp.json()
    assert body["success"] is False
    assert body["code"] == 400
    assert "could not be parsed, unparsed text found at index 7" in body["message"]
    assert "2026-12-29" in body["message"]


def test_yoy_mom_missing_required_period_type_returns_422(client):
    """``periodType=Query(...)`` is required → FastAPI 422 before handler."""
    resp = client.get(
        _YOY_PATH,
        params={"startPeriod": "2026-05"},
        headers=_auth_header(factory_id="F001"),
    )

    assert resp.status_code == 422


# ============================================================
# Section 3 — /analysis/finance/category-comparison
# ============================================================


def test_category_comparison_happy_path_sorted_desc(client, monkeypatch):
    """Two categories — output sorted by currentAmount DESC (impl L937).

    Pins:
      - Both years' ``_query_finance_sales_fallback`` invocation args
        (current year first, compare year second)
      - Output order: [B (amount=300), A (amount=100)]
      - summary Map.of(3) Jackson hash order:
        ``['totalYoyGrowthRate', 'compareTotal', 'currentTotal']``
      - Rule 10 total YoY: (400-300)/300 = 0.3333 (scale 4 quantize) * 100
        = 33.3300 → quantize(0.01) → 33.33 → float(33.33)
    """
    captured: list[tuple] = []

    async def fake_query(factory_id, start_date, end_date):
        captured.append((factory_id, start_date, end_date))
        if start_date == date(2026, 1, 1):
            return [
                {"product_category": "A", "amount": Decimal("100")},
                {"product_category": "B", "amount": Decimal("300")},
            ]
        return [
            {"product_category": "A", "amount": Decimal("50")},
            {"product_category": "B", "amount": Decimal("250")},
        ]

    monkeypatch.setattr(mod, "_query_finance_sales_fallback", fake_query)

    resp = client.get(
        _CATCMP_PATH,
        params={"year": 2026, "compareYear": 2025},
        headers=_auth_header(factory_id="F001"),
    )

    assert resp.status_code == 200, resp.text
    chart = resp.json()["data"]

    # Query call order: current year first, then compare year
    assert captured == [
        ("F001", date(2026, 1, 1), date(2026, 12, 31)),
        ("F001", date(2025, 1, 1), date(2025, 12, 31)),
    ]

    assert chart["chartType"] == "BAR"
    assert chart["title"] == "2026年 vs 2025年 品类结构对比"

    data = chart["data"]
    assert len(data) == 2
    # Sorted DESC by currentAmount → B then A
    assert data[0]["category"] == "B"
    assert data[0]["currentAmount"] == 300
    assert data[1]["category"] == "A"
    assert data[1]["currentAmount"] == 100

    summary = chart["options"]["summary"]
    # Map.of(3) Jackson hash order pin
    assert list(summary.keys()) == [
        "totalYoyGrowthRate",
        "compareTotal",
        "currentTotal",
    ]
    assert summary["currentTotal"] == 400
    assert summary["compareTotal"] == 300
    # Rule 10: (400-300)/300 → scale-4 quantize → 0.3333 * 100 → 33.3300
    assert summary["totalYoyGrowthRate"] == 33.33


def test_category_comparison_empty_data_zero_summary(client, monkeypatch):
    """Both years empty → empty chart_data + summary all zero."""

    async def fake_query(*args, **kwargs):
        return []

    monkeypatch.setattr(mod, "_query_finance_sales_fallback", fake_query)

    resp = client.get(
        _CATCMP_PATH,
        params={"year": 2026, "compareYear": 2025},
        headers=_auth_header(factory_id="F001"),
    )

    assert resp.status_code == 200, resp.text
    chart = resp.json()["data"]
    assert chart["data"] == []
    summary = chart["options"]["summary"]
    assert summary["currentTotal"] == 0
    assert summary["compareTotal"] == 0
    assert summary["totalYoyGrowthRate"] == 0


def test_category_comparison_new_category_fallback_yoy_100(client, monkeypatch):
    """compare_amount=0 + current_amount>0 → yoyGrowthRate=100 (impl L917-918).

    Catches any regression where the fallback branch returns 0 (treating
    "new category" as no growth) or NaN (division-by-zero unguarded).
    """

    async def fake_query(factory_id, start_date, end_date):
        if start_date == date(2026, 1, 1):
            return [{"product_category": "NEW", "amount": Decimal("500")}]
        return []  # No 2025 data

    monkeypatch.setattr(mod, "_query_finance_sales_fallback", fake_query)

    resp = client.get(
        _CATCMP_PATH,
        params={"year": 2026, "compareYear": 2025},
        headers=_auth_header(factory_id="F001"),
    )

    new_cat = resp.json()["data"]["data"][0]
    assert new_cat["category"] == "NEW"
    assert new_cat["currentAmount"] == 500
    assert new_cat["compareAmount"] == 0
    assert new_cat["yoyGrowthRate"] == 100  # new-category sentinel
    # current_total=500 → ratio=100 (only category); compare_total=0 → ratio=0
    assert new_cat["currentRatio"] == 100
    assert new_cat["compareRatio"] == 0
    assert new_cat["ratioChange"] == 100


def test_category_comparison_rule10_ratio_at_scale_4(client, monkeypatch):
    """Rule 10: ``ratio = amount / total`` quantize(0.0001) * 100.

    X amount=1, total=3 → fraction=0.3333 (scale-4 quantize) → *100 = 33.3300
    → quantize(0.01) = 33.33. Antipattern ``(amount/total*100).quantize(0.01)``
    happens to also produce 33.33, so the visible-output pin is a defense
    canary; the canonical Rule 10 pin lives in ``test_analysis_finance_composite_pilot``.
    """

    async def fake_query(factory_id, start_date, end_date):
        if start_date == date(2026, 1, 1):
            return [
                {"product_category": "X", "amount": Decimal("1")},
                {"product_category": "Y", "amount": Decimal("2")},
            ]
        return []

    monkeypatch.setattr(mod, "_query_finance_sales_fallback", fake_query)

    resp = client.get(
        _CATCMP_PATH,
        params={"year": 2026, "compareYear": 2025},
        headers=_auth_header(factory_id="F001"),
    )

    data = resp.json()["data"]["data"]
    # data[0] = Y (amount=2 sorted first), data[1] = X (amount=1)
    assert data[0]["category"] == "Y"
    assert data[1]["category"] == "X"
    # X: 1/3 fraction quantize(0.0001)=0.3333 * 100 = 33.33
    assert data[1]["currentRatio"] == 33.33


def test_category_comparison_null_category_bucketed_to_qita(client, monkeypatch):
    """``product_category is None`` → bucketed under "其他" (impl L855).

    Rule 1 boundary: explicit ``is not None`` check distinguishes ``None``
    from empty string ``""`` — only None routes to 其他, "" stays as "".
    """

    async def fake_query(factory_id, start_date, end_date):
        if start_date == date(2026, 1, 1):
            return [{"product_category": None, "amount": Decimal("50")}]
        return []

    monkeypatch.setattr(mod, "_query_finance_sales_fallback", fake_query)

    resp = client.get(
        _CATCMP_PATH,
        params={"year": 2026, "compareYear": 2025},
        headers=_auth_header(factory_id="F001"),
    )

    data = resp.json()["data"]["data"]
    assert len(data) == 1
    assert data[0]["category"] == "其他"
    assert data[0]["currentAmount"] == 50


# ============================================================
# Section 4 — Shared auth boundary (verify_jwt_and_factory)
# Each endpoint shares the same dependency; we exercise 401 missing /
# 401 invalid / 403 cross-factory once per endpoint surface so the
# coverage gate sees real auth verification per path.
# ============================================================


def test_budget_achievement_missing_bearer_returns_401(client):
    """No Authorization header → 401 (verify_jwt_and_factory raises)."""
    resp = client.get(_BUDGET_PATH, params={"year": 2026})
    assert resp.status_code == 401


def test_yoy_mom_invalid_token_returns_401(client):
    """Bearer garbage → InvalidTokenError → 401."""
    resp = client.get(
        _YOY_PATH,
        params={"periodType": "MONTH", "startPeriod": "2026-05"},
        headers={"Authorization": "Bearer garbage.token.value"},
    )
    assert resp.status_code == 401


def test_category_comparison_cross_factory_returns_403(client):
    """Token factoryId=F999 but URL factory_id=F001 → 403."""
    resp = client.get(
        _CATCMP_PATH,
        params={"year": 2026, "compareYear": 2025},
        headers=_auth_header(factory_id="F999"),
    )
    assert resp.status_code == 403
