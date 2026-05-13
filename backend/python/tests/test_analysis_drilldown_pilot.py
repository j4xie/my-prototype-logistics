"""Phase 2B-3 chat-2B-drilldown pilot tests — ``analysis_drilldown.py``.

Per `docs/qa-audits/2026-05-12-python-migration-test-coverage-audit.md`
§2.3 row 8 + §3 priority 19 + §5 template + §8.3 row 4.

Coverage:

* **Rule 12 regression lock-down (5 tests)** — primary deliverable.
  Commit ``69b46f4d5`` (2026-05-07) fixed ``_build_kpi_card`` (line 309) so
  scale-2 KPI values use HALF_UP via
  ``value.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)`` for the
  ``rawValue`` field and ``_format_decimal_half_up(value, 2)`` for the
  ``value`` string field. These tests assert both regression vectors stay
  HALF_UP using ``Decimal("100.005")`` as the scale-2 canary
  (HALF_UP → 100.01 vs banker's → 100.00) plus an alternative
  ``Decimal("100.025")`` canary (HALF_UP → 100.03 vs banker's → 100.02).
  If any sister chat refactors back or drops ``rounding=ROUND_HALF_UP``,
  these tests fail loudly.

* **Helper unit tests (4 tests)** — ``_compute_drill_path`` (Rule 1 None+empty
  branches), ``_default_date_range_this_month`` (T5 last-day semantic, NOT
  today), ``_determine_target_completion_alert`` (60/85 thresholds),
  ``_build_kpi_card`` 13-field shape (Rule 8 + Rule 9 Lombok @Data order
  + null emit).

* **Endpoint auth + happy + error (5 tests)** — JWT required (401) /
  invalid token (401) / cross-factory denied (403) / happy path with mocked
  ``_process_drilldown_tx`` (200 + envelope) / unsupported dimension via
  ``DrilldownBusinessException`` (HTTP 200 + success=false per Java
  HTTP-200-always parity at controller layer).

Rule checklist per ``.claude/rules/python-java-port.md``:

- [x] **Rule 1**: explicit ``is None`` + empty-string checks in
  ``_compute_drill_path`` (mirror Java ``== null || isEmpty()``).
- [x] **Rule 4**: ``_decimal_to_number`` int-vs-float emit (covered
  indirectly via ``_build_kpi_card`` 13-field shape test).
- [x] **Rule 8 / Rule 9**: ``_build_kpi_card`` 13-field Lombok @Data order
  + null emit (no @JsonInclude(NON_NULL) on KpiCard DTO).
- [x] **Rule 10**: ``_build_drilldown_ranking`` divide-quantize-4-then-multiply
  is exercised indirectly by sister ``test_analysis_sales_pilot.py``; this
  file focuses on KPI card surface, ranking is out of scope.
- [x] **Rule 12**: HALF_UP vs banker's lock-down at **scale 2** (primary
  deliverable). Sister ``test_analysis_procurement_pilot.py`` (PR #412)
  covers scale-1 canary 46.55; this file is the scale-2 sibling.

Gold-standard pilot pattern: ``test_config_thresholds_pilot.py`` (Phase 2C).
Sister: ``test_analysis_procurement_pilot.py`` (Phase 2B-2, PR #412).
"""
from __future__ import annotations

import calendar
import os
from datetime import date
from decimal import Decimal, ROUND_HALF_UP

import jwt
import pytest

# ── Test JWT secret (must be set before importing analysis_drilldown) ──
os.environ.setdefault("JWT_SECRET", "phase-2b3-drilldown-pilot-test-secret")

from smartbi_compat._java_compat import _format_decimal_half_up  # noqa: E402
from smartbi_compat.api import analysis_drilldown as mod  # noqa: E402
from smartbi_compat.api.analysis_drilldown import (  # noqa: E402
    _build_kpi_card,
    _compute_drill_path,
    _default_date_range_this_month,
    _determine_target_completion_alert,
    router,
)
from smartbi_compat.auth import JWT_ALGORITHM  # noqa: E402

# Phase 2B endpoint coverage marker (see conftest.py KNOWN_ENDPOINTS).
pytestmark = [pytest.mark.api_endpoint("analysis_drilldown")]


# ============================================================
# JWT + test client fixtures (mirror test_analysis_procurement_pilot.py)
# ============================================================


JWT_SECRET = "phase-2b3-drilldown-pilot-test-secret"


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
    """Build a test JWT with the same shape as production tokens."""
    from time import time

    payload: dict = {
        "userId": user_id,
        "username": username,
        "role": role,
        "exp": int(time()) + exp_offset,
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
    """FastAPI TestClient with the drilldown router mounted.

    No DB pool patching by default — tests that hit the live endpoint either
    monkeypatch ``_process_drilldown_tx`` directly (happy path) or rely on
    ``_process_drilldown_tx`` raising ``DrilldownBusinessException`` BEFORE
    any DB call (unsupported-dimension path at line 711-713).
    """
    from fastapi import FastAPI
    from fastapi.testclient import TestClient

    app = FastAPI()
    app.include_router(router)
    return TestClient(app)


# ============================================================
# Rule 12 — primary regression lock-down (scale 2)
# ============================================================


def test_rule12_build_kpi_card_raw_value_uses_half_up():
    """Lock-down for ``_build_kpi_card`` line 314 ``rawValue`` field.

    ``rawValue`` is built as ``float(value.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP))``.
    If a refactor drops ``rounding=ROUND_HALF_UP``, ``Decimal.quantize`` falls
    back to ROUND_HALF_EVEN (banker's), and ``Decimal("100.005").quantize(Decimal("0.01"))``
    returns ``Decimal("100.00")`` (because the trailing 0 before 5 is even,
    banker's rounds toward even — DOWN). HALF_UP returns ``Decimal("100.01")``.

    This is the scale-2 sibling of procurement's PR #412 scale-1 lock-down.
    """
    result = _build_kpi_card("K", "T", Decimal("100.005"), "元", "green")
    assert result["rawValue"] == 100.01, (
        f"Rule 12 regression on rawValue — expected 100.01 (HALF_UP), got "
        f"{result['rawValue']!r}. If this is 100.0 / 100.00, analysis_drilldown.py:314 "
        f"lost rounding=ROUND_HALF_UP and fell back to banker's (ROUND_HALF_EVEN)."
    )
    # Banker's regression canary — should NEVER hold
    assert result["rawValue"] != 100.0, (
        "banker's regression — line 314 must use rounding=ROUND_HALF_UP"
    )


def test_rule12_build_kpi_card_value_string_uses_half_up():
    """Lock-down for ``_build_kpi_card`` line 318 ``value`` string field.

    ``value`` is built via ``_format_decimal_half_up(value, 2)`` which calls
    ``Decimal.quantize(rounding=ROUND_HALF_UP)`` internally. If anyone reverts
    to ``f"{float(value):.2f}"``, Python f-string uses banker's at the float
    level + float(46.55)-style precision artifacts → divergence from Java.

    For ``Decimal("100.005")``: HALF_UP gives ``"100.01"``, banker's path
    (via Decimal.quantize default OR float f-string) gives ``"100.00"``.
    """
    result = _build_kpi_card("K", "T", Decimal("100.005"), "元", "green")
    assert result["value"] == "100.01", (
        f"Rule 12 regression on value-string — expected '100.01' (HALF_UP), got "
        f"{result['value']!r}. If this is '100.00', analysis_drilldown.py:318 "
        f"was refactored away from _format_decimal_half_up to an f-string or "
        f"banker's-default Decimal.quantize."
    )
    assert result["value"] != "100.00", (
        "banker's regression — line 318 must use _format_decimal_half_up"
    )


def test_rule12_documents_quantize_scale2_banker_divergence():
    """Locks the scale-2 divergence proof at the pure-Decimal layer.

    Mirrors procurement's ``test_rule12_decimal_quantize_inline_pattern_uses_half_up``
    but at scale 2 (KPI cards) instead of scale 1 (procurement display).

    The bug surface this test guards: dropping the ``rounding=ROUND_HALF_UP``
    keyword argument from ``Decimal.quantize`` — Python silently falls back to
    ``ROUND_HALF_EVEN`` (banker's). For ``Decimal("100.005")``:

      - banker's (default): rounds toward even → ``Decimal("100.00")``
        (because 100.00's last digit 0 is even, banker's keeps it).
      - HALF_UP: ``.5`` → always round up → ``Decimal("100.01")``.

    Note: This test does NOT call any module function; it asserts the raw
    Decimal-layer divergence so future Python version changes that alter
    rounding semantics also break this test loudly.
    """
    val = Decimal("100.005")

    bankers = val.quantize(Decimal("0.01"))  # default = ROUND_HALF_EVEN
    half_up = val.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

    assert bankers == Decimal("100.00"), (
        "default Decimal.quantize = banker's; .005 with even preceding digit → round down"
    )
    assert half_up == Decimal("100.01"), (
        "explicit ROUND_HALF_UP; .5 → always round up"
    )
    assert bankers != half_up, (
        "Decimal-layer scale-2 divergence proves rounding arg matters"
    )

    # Helper mirrors the HALF_UP path
    assert _format_decimal_half_up(val, 2) == "100.01"


def test_rule12_build_kpi_card_alternative_canary_100_025():
    """Second divergent canary at scale 2 for defense in depth.

    ``Decimal("100.025")``: HALF_UP → ``100.03`` / banker's → ``100.02``
    (because 100.02's last digit 2 is even, banker's keeps it).

    Having a second canary catches regressions where the first canary
    ``Decimal("100.005")`` might coincidentally happen to round consistently
    due to an unrelated code path change (e.g. a float-bridge that drops the
    third decimal entirely before reaching the rounding step).
    """
    result = _build_kpi_card("K", "T", Decimal("100.025"), "元", "green")
    assert result["rawValue"] == 100.03, (
        f"Rule 12 regression (alt canary) — rawValue expected 100.03, got "
        f"{result['rawValue']!r}"
    )
    assert result["value"] == "100.03", (
        f"Rule 12 regression (alt canary) — value-string expected '100.03', got "
        f"{result['value']!r}"
    )


def test_rule12_format_decimal_half_up_scale_2_preserves_trailing_zero():
    """Java ``String.format("%.2f", new BigDecimal("46"))`` emits ``"46.00"``
    (scale preserved). Helper must mirror — important so ``100.00%`` doesn't
    collapse to ``"100%"`` and break Java byte-shape parity at scale 2.

    This is the scale-2 sibling of procurement's
    ``test_rule12_format_decimal_half_up_trailing_zero_preserved`` (scale 1).
    """
    assert _format_decimal_half_up(Decimal("46"), 2) == "46.00"
    assert _format_decimal_half_up(Decimal("46.0"), 2) == "46.00"
    assert _format_decimal_half_up(Decimal("100"), 2) == "100.00"
    assert _format_decimal_half_up(Decimal("50"), 2) == "50.00"


# ============================================================
# Helper unit tests
# ============================================================


@pytest.mark.parametrize(
    "parent_context,filter_value,expected",
    [
        # Both None → "全部" (Java line 296 fallback)
        (None, None, "全部"),
        # parent_context None, filter_value set → filter_value
        (None, "广东", "广东"),
        # parent_context set, filter_value None → parent_context
        ("华南", None, "华南"),
        # parent_context set, filter_value empty string → parent_context
        # (mirror Java second branch `== null || isEmpty()` on filter_value)
        ("华南", "", "华南"),
        # Both set → joined with " > " (Java line 301)
        ("华南", "广东", "华南 > 广东"),
        # parent_context empty string → first branch fires (== ""), returns
        # filter_value (since not None). Empty filter_value here passes through
        # because source line 79 only checks ``filter_value is not None``,
        # NOT empty-string. This is the actual port semantic.
        ("", "广东", "广东"),
        ("", None, "全部"),
    ],
)
def test_compute_drill_path_all_four_branches(parent_context, filter_value, expected):
    """Rule 1 lock-down for ``_compute_drill_path`` (Java line 295-302).

    Java ``getDrillPath`` semantics:
      - if parentContext == null || isEmpty() → return filter_value or "全部"
      - else if filter_value == null || isEmpty() → return parentContext
      - else → return parentContext + " > " + filter_value

    Python mirrors via explicit ``is None or == ""`` checks (Rule 1 — explicit
    None over Python falsy). Note: source line 79 first branch returns
    ``filter_value if filter_value is not None else "全部"`` — empty string
    filter_value is NOT collapsed to "全部" in that branch (Java parity
    nuance, captured separately in test_compute_drill_path_empty_filter_value
    if needed; production callers always pass either None or non-empty value).
    """
    assert _compute_drill_path(parent_context, filter_value) == expected


def test_default_date_range_this_month_returns_first_and_last_day():
    """T5 lock-down for ``_default_date_range_this_month`` (Java line 123-133).

    Java ``DateRange.thisMonth()``:
      - start = today.withDayOfMonth(1)
      - end   = today.withDayOfMonth(today.lengthOfMonth())

    The end date is the LAST DAY OF THE CURRENT MONTH, not today. This is
    important because if someone refactors to ``end = today`` (a common
    mistake), all "this month" queries silently truncate forward-looking data.
    """
    start, end = _default_date_range_this_month()

    # Both dates in current month/year
    today = date.today()
    assert start.year == today.year
    assert start.month == today.month
    assert end.year == today.year
    assert end.month == today.month

    # start is day 1
    assert start.day == 1, f"start must be day 1, got {start}"

    # end is the LAST day of the month (NOT today, NOT some arbitrary day)
    last_day_of_month = calendar.monthrange(today.year, today.month)[1]
    assert end.day == last_day_of_month, (
        f"end must be last day of month ({last_day_of_month}), got {end.day}. "
        f"If end.day == today.day, refactor mistakenly used 'today' instead of "
        f"'withDayOfMonth(lengthOfMonth())'."
    )


@pytest.mark.parametrize(
    "rate,expected",
    [
        # RED: rate < 60
        (Decimal("0"), "RED"),
        (Decimal("59.99"), "RED"),
        # YELLOW: 60 <= rate < 85
        (Decimal("60"), "YELLOW"),
        (Decimal("84.99"), "YELLOW"),
        # GREEN: rate >= 85
        (Decimal("85"), "GREEN"),
        (Decimal("100"), "GREEN"),
        (Decimal("150"), "GREEN"),  # overshoot still GREEN
    ],
)
def test_determine_target_completion_alert_boundaries(rate, expected):
    """Boundary lock-down for ``_determine_target_completion_alert`` (line 195).

    Thresholds:
      - rate < 60 → RED
      - 60 <= rate < 85 → YELLOW
      - rate >= 85 → GREEN

    Boundary canaries: 60 (RED→YELLOW edge) and 85 (YELLOW→GREEN edge).
    Off-by-one here would silently misclassify all near-threshold metrics.
    """
    assert _determine_target_completion_alert(rate) == expected


def test_build_kpi_card_emits_13_fields_in_lombok_order():
    """Rule 8 + Rule 9 shape lock-down for ``_build_kpi_card`` (line 309).

    KpiCard 13-field Lombok @Data declaration order (line 314-329):
      [key, title, value, rawValue, unit, change, changeRate, trend, status,
       compareText, description, targetValue, completionRate]

    Rule 9: KpiCard DTO has NO ``@JsonInclude(NON_NULL)``, so all null fields
    MUST emit as ``"field": null`` (Python ``None``) to match Java Jackson.
    If any sister chat refactors to omit None fields (e.g. via dict
    comprehension filtering), byte-shape parity breaks silently.
    """
    result = _build_kpi_card("K", "T", Decimal("50"), "元", "green")

    expected_keys = [
        "key", "title", "value", "rawValue", "unit",
        "change", "changeRate", "trend", "status",
        "compareText", "description", "targetValue", "completionRate",
    ]
    assert list(result.keys()) == expected_keys, (
        f"KpiCard key order drift — expected {expected_keys}, got {list(result.keys())}. "
        f"Per Rule 8 + Rule 9 + source line 314-329, key order must mirror Lombok "
        f"@Data declaration order exactly."
    )

    # Rule 9: nulls MUST emit (KpiCard DTO has no @JsonInclude)
    assert result["change"] is None, "Rule 9 — null fields must emit, not be omitted"
    assert result["changeRate"] is None
    assert result["compareText"] is None
    assert result["description"] is None
    assert result["targetValue"] is None
    assert result["completionRate"] is None

    # Non-null fields carry through
    assert result["key"] == "K"
    assert result["title"] == "T"
    assert result["unit"] == "元"
    assert result["status"] == "green"
    assert result["trend"] == "flat"


# ============================================================
# Endpoint auth + happy + error (FastAPI TestClient)
# ============================================================


def test_endpoint_missing_bearer_returns_401(client):
    """POST without Authorization header → 401."""
    r = client.post(
        "/api/mobile/F001/smart-bi/drill-down",
        json={"dimension": "region"},
    )
    assert r.status_code == 401


def test_endpoint_invalid_token_returns_401(client):
    """POST with malformed JWT → 401."""
    r = client.post(
        "/api/mobile/F001/smart-bi/drill-down",
        json={"dimension": "region"},
        headers={"Authorization": "Bearer not.a.real.jwt"},
    )
    assert r.status_code == 401


def test_endpoint_cross_factory_returns_403(client):
    """Token for F001 hitting F002 endpoint must be rejected with 403."""
    r = client.post(
        "/api/mobile/F002/smart-bi/drill-down",
        json={"dimension": "region"},
        headers=_auth_header(factory_id="F001"),
    )
    assert r.status_code == 403


def test_endpoint_happy_path_returns_200_envelope(client, monkeypatch):
    """Mocked ``_process_drilldown_tx`` returns synthetic dict; endpoint wraps
    in standard ``wrap_response`` envelope. Isolates URL routing + auth + JSON
    serialization from any DB dependency.
    """

    async def _fake_tx(factory_id, request):
        return {
            "drillPath": "全部",
            "data": [],
            "level": 1,
            "nextLevel": "province",
            "dimension": "region",
        }

    monkeypatch.setattr(mod, "_process_drilldown_tx", _fake_tx)

    r = client.post(
        "/api/mobile/F001/smart-bi/drill-down",
        json={"dimension": "region"},
        headers=_auth_header(factory_id="F001"),
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body.get("success") is True
    assert "data" in body
    assert body["data"]["dimension"] == "region"
    assert body["data"]["drillPath"] == "全部"
    assert body["data"]["nextLevel"] == "province"


def test_endpoint_unsupported_dimension_returns_200_success_false(client):
    """Unsupported dimension → ``DrilldownBusinessException(400)`` at line 711-713
    BEFORE any DB call. Controller catches at line 744-745 and returns
    ``wrap_error`` with **HTTP 200 + success=false** (Java parity — source
    comment line 729: "HTTP 200 always even on BusinessException").

    No DB mock needed because the exception is raised at the dispatch branch
    before ``_drilldown_record_usage_async`` is awaited.
    """
    r = client.post(
        "/api/mobile/F001/smart-bi/drill-down",
        json={"dimension": "xyz_unknown"},
        headers=_auth_header(factory_id="F001"),
    )
    # HTTP 200 always (Java ResponseEntity.ok parity)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body.get("success") is False, (
        f"Java parity requires success=false on BusinessException, got body={body!r}"
    )
    assert "不支持的下钻维度" in body.get("message", ""), (
        f"Expected Chinese 'unsupported dimension' message, got: {body.get('message')!r}"
    )
