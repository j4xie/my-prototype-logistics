"""Byte-shape contract gate for /drill-down (PR-A).

Java reference:
  - Controller: SmartBIAnalysisController.drillDown line 531-586
  - Service: SmartBIServiceImpl.processDrillDown line 1018-1069

Mirrors sister test_analysis_finance_contract.py / test_analysis_procurement_contract.py
pattern.
"""
from __future__ import annotations

import importlib.util
import io
import json
import os
import sys
from datetime import date, datetime, timezone
from pathlib import Path

import jwt
import pytest


JWT_SECRET = "test-secret-for-phase2a-do-not-use-in-prod"
os.environ["JWT_SECRET"] = JWT_SECRET


REPO_ROOT = Path(__file__).resolve().parents[3]
GOLDEN_DIR = REPO_ROOT / "tests" / "fixtures" / "java-smartbi-golden"


def _load_production_main():
    """Mirror sister test pattern."""
    main_path = REPO_ROOT / "backend" / "python" / "main.py"
    sys.path.insert(0, str(REPO_ROOT / "backend" / "python"))
    spec = importlib.util.spec_from_file_location("_production_main", main_path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def _make_token(factory_id: str, user_id: int = 1) -> str:
    payload = {
        "userId": user_id, "username": "test_user", "factoryId": factory_id,
        "role": "factory_super_admin",
        "exp": datetime.now(timezone.utc).timestamp() + 3600,
    }
    return jwt.encode(payload, JWT_SECRET, algorithm="HS256")


# Volatile keys (timestamps) stripped before byte-shape compare.
VOLATILE = frozenset({"timestamp", "generatedAt", "lastUpdated", "cacheExpireAt"})

# ApiResponse 8-field envelope: 5 always-set + 3 optional UX (actionHint/severity/hintTarget).
# F999 goldens emit all 8; sister test pattern strips the 3 optional defensively
# (also future-proofing for endpoints where Java may not emit them).
ENVELOPE_EXTRAS = frozenset({"actionHint", "severity", "hintTarget"})


def _strip_volatile(obj):
    if isinstance(obj, dict):
        return {k: _strip_volatile(v) for k, v in obj.items() if k not in VOLATILE}
    if isinstance(obj, list):
        return [_strip_volatile(item) for item in obj]
    return obj


def _strip_envelope_extras(body):
    if not isinstance(body, dict):
        return body
    return {k: v for k, v in body.items() if k not in ENVELOPE_EXTRAS}


@pytest.fixture(scope="module")
def production_app():
    return _load_production_main().app


@pytest.fixture
def client(production_app):
    from fastapi.testclient import TestClient
    return TestClient(production_app)


@pytest.fixture
def patched_helpers(monkeypatch):
    """Patch all sister + owned helpers + recordUsage to return F999 stub shapes.

    F999 has empty data, so most return [] / empty chart / empty list.
    Charts are returned with full 7-field shape per Rule 9 carry-over.
    """
    from smartbi_compat.api import analysis_drilldown as adr

    async def _empty_region(*a, **k):
        return {"ranking": []}

    async def _empty_dept_ranking(*a, **k):
        return []

    async def _empty_product(*a, **k):
        return []

    async def _empty_trend(factory_id, range_, period):
        # Mirror sister analysis_sales._get_sales_trend_chart empty shape — must match
        # F999 time-L1 golden's data.data ChartConfig 7-field shape.
        return {
            "chartType": "LINE",
            "title": "销售趋势",
            "seriesField": None,
            "data": [],
            "options": {"showDataLabels": False, "smooth": True},
            "xaxisField": "date",
            "yaxisField": "amount",
        }

    async def _empty_salesperson(*a, **k):
        return []

    async def _empty_province(*a, **k):
        return []

    async def _empty_city(*a, **k):
        return []

    async def _empty_dept_detail(*a, **k):
        # Use real builder for empty case (matches dept-L2 golden 16-field shape)
        return adr._build_department_detail_response(None)

    async def _empty_product_chart(*a, **k):
        return adr._build_product_distribution_chart([])

    async def _empty_salesperson_metrics(*a, **k):
        return []

    async def _noop_record(**kwargs):
        pass

    monkeypatch.setattr(adr, "_get_region_analysis", _empty_region)
    monkeypatch.setattr(adr, "_get_department_ranking", _empty_dept_ranking)
    monkeypatch.setattr(adr, "_get_product_ranking", _empty_product)
    monkeypatch.setattr(adr, "_get_sales_trend_chart", _empty_trend)
    monkeypatch.setattr(adr, "_get_salesperson_ranking", _empty_salesperson)
    monkeypatch.setattr(adr, "_drilldown_get_province_ranking", _empty_province)
    monkeypatch.setattr(adr, "_drilldown_get_city_ranking", _empty_city)
    monkeypatch.setattr(adr, "_drilldown_get_department_detail", _empty_dept_detail)
    monkeypatch.setattr(adr, "_drilldown_get_product_distribution_chart", _empty_product_chart)
    monkeypatch.setattr(adr, "_drilldown_get_salesperson_metrics", _empty_salesperson_metrics)
    monkeypatch.setattr(adr, "_drilldown_record_usage_async", _noop_record)


def _post(client, body, factory_id="F999"):
    return client.post(
        f"/api/mobile/{factory_id}/smart-bi/drill-down",
        json=body,
        headers={"Authorization": f"Bearer {_make_token(factory_id)}"},
    )


# 7 success goldens + 1 error golden = 8 total.
GOLDEN_CASES = [
    ("drill-down-F999-region-L1",
     {"dimension": "region", "startDate": "2024-01-01", "endDate": "2024-12-31"}),
    ("drill-down-F999-region-L2",
     {"dimension": "region", "value": "华东", "level": 1,
      "startDate": "2024-01-01", "endDate": "2024-12-31"}),
    ("drill-down-F999-department-L1",
     {"dimension": "department", "startDate": "2024-01-01", "endDate": "2024-12-31"}),
    ("drill-down-F999-department-L2",
     {"dimension": "department", "value": "销售部",
      "startDate": "2024-01-01", "endDate": "2024-12-31"}),
    ("drill-down-F999-product",
     {"dimension": "product", "startDate": "2024-01-01", "endDate": "2024-12-31"}),
    ("drill-down-F999-time-L1",
     {"dimension": "time", "level": 1,
      "startDate": "2024-01-01", "endDate": "2024-12-31"}),
    ("drill-down-F999-salesperson-L1",
     {"dimension": "salesperson", "startDate": "2024-01-01", "endDate": "2024-12-31"}),
]


@pytest.mark.parametrize("golden_name,request_body", GOLDEN_CASES)
def test_drilldown_byte_shape(client, patched_helpers, golden_name, request_body):
    """Per-dim byte-shape gate. Strips volatile timestamps before compare."""
    resp = _post(client, request_body)
    assert resp.status_code == 200, f"got {resp.status_code}: {resp.text[:300]}"
    py_data = _strip_volatile(resp.json()["data"])

    with io.open(GOLDEN_DIR / f"{golden_name}.json", encoding="utf-8") as f:
        raw = json.load(f)
    golden_data = _strip_volatile(raw["data"])

    if py_data != golden_data:
        diffs = {}
        for k in set(py_data.keys() if isinstance(py_data, dict) else []) | set(
            golden_data.keys() if isinstance(golden_data, dict) else []
        ):
            if py_data.get(k) != golden_data.get(k):
                diffs[k] = {"python": py_data.get(k), "golden": golden_data.get(k)}
        pytest.fail(
            f"{golden_name} BYTE SHAPE MISMATCH on {list(diffs.keys())}\n"
            f"{json.dumps(diffs, indent=2, ensure_ascii=False, default=str)[:2500]}"
        )


def test_drilldown_unknown_dim_error(client, patched_helpers):
    """T10: error envelope. Java emits 8-field envelope; defensive strip of 3 UX extras."""
    resp = _post(client, {
        "dimension": "invalid",
        "startDate": "2024-01-01", "endDate": "2024-12-31",
    })
    assert resp.status_code == 200
    body = resp.json()
    body_stripped = _strip_envelope_extras(_strip_volatile(body))
    assert body_stripped["success"] is False
    assert body_stripped["code"] == 400
    assert "不支持的下钻维度" in body_stripped["message"]
    assert body_stripped["data"] is None

    with io.open(GOLDEN_DIR / "drill-down-F999-error-unknown-dim.json", encoding="utf-8") as f:
        golden = json.load(f)
    golden_stripped = _strip_envelope_extras(_strip_volatile(golden))
    assert body_stripped == golden_stripped, (
        f"error envelope mismatch:\n  py={body_stripped}\n  golden={golden_stripped}"
    )


class TestDispatchBranching:
    """T3 case-insensitive dispatch + T5 default range + customer dim."""

    def test_uppercase_dimension_dispatched(self, client, patched_helpers):
        """T3: 'REGION' → region processor; original casing in `dimension` field."""
        resp = _post(client, {
            "dimension": "REGION",
            "startDate": "2024-01-01", "endDate": "2024-12-31",
        })
        assert resp.status_code == 200
        assert resp.json()["data"]["dimension"] == "REGION"

    def test_customer_dim_returns_business_exception(self, client, patched_helpers):
        """customer dim → BusinessException (out of switch per Java)."""
        resp = _post(client, {
            "dimension": "customer",
            "startDate": "2024-01-01", "endDate": "2024-12-31",
        })
        assert resp.status_code == 200
        body = resp.json()
        assert body["success"] is False
        assert "不支持" in body["message"]

    def test_default_date_range_used_when_dates_missing(self, client, patched_helpers):
        """T5: missing startDate/endDate → defaults to thisMonth."""
        resp = _post(client, {"dimension": "region"})
        assert resp.status_code == 200, resp.text[:300]


class TestRecordUsageAtomicity:
    """T7+T8: success → 1 recordUsage call; BusinessException → 0 calls."""

    def test_record_usage_called_on_success(self, client, monkeypatch):
        from smartbi_compat.api import analysis_drilldown as adr
        called = []

        async def _spy(**kw):
            called.append(kw)

        async def _empty(*a, **k):
            return {"ranking": []}

        monkeypatch.setattr(adr, "_get_region_analysis", _empty)
        monkeypatch.setattr(adr, "_drilldown_record_usage_async", _spy)

        resp = _post(client, {
            "dimension": "region",
            "startDate": "2024-01-01", "endDate": "2024-12-31",
        })
        assert resp.status_code == 200, resp.text[:200]
        assert len(called) == 1, f"expected 1 recordUsage call, got {len(called)}"
        assert called[0]["factory_id"] == "F999"
        assert called[0]["action_type"] == "DRILLDOWN"

    def test_record_usage_NOT_called_on_business_exception(self, client, monkeypatch):
        """T8 atomicity: BusinessException raised before write tx → no record."""
        from smartbi_compat.api import analysis_drilldown as adr
        called = []

        async def _spy(**kw):
            called.append(kw)

        monkeypatch.setattr(adr, "_drilldown_record_usage_async", _spy)

        resp = _post(client, {
            "dimension": "invalid",
            "startDate": "2024-01-01", "endDate": "2024-12-31",
        })
        assert resp.status_code == 200
        assert resp.json()["success"] is False
        assert called == [], f"expected 0 recordUsage calls, got {len(called)}"


class TestEdgeCases:
    """Regression tests for issues caught in final review."""

    def test_time_dim_not_implemented_returns_501_envelope_not_500(
        self, client, monkeypatch
    ):
        """C1 regression: sister `_get_sales_trend_chart` is DAY-only and raises
        NotImplementedError for MONTH/WEEK. Production HTTP traffic sends time dim
        with default level=1 → period="MONTH". Without the catch in
        `_process_time_drilldown`, this would propagate as HTTP 500 (Java emits
        HTTP 200 + success=false via controller catch-all)."""
        from smartbi_compat.api import analysis_drilldown as adr

        async def _real_unsupported(factory_id, range_, period):
            raise NotImplementedError(
                f"trend chart period='{period}' not supported"
            )

        async def _noop_record(**kw):
            pass

        monkeypatch.setattr(adr, "_get_sales_trend_chart", _real_unsupported)
        monkeypatch.setattr(adr, "_drilldown_record_usage_async", _noop_record)

        resp = _post(client, {
            "dimension": "time", "level": 1,
            "startDate": "2024-01-01", "endDate": "2024-12-31",
        })
        # HTTP 200 even on error (Java parity)
        assert resp.status_code == 200
        body = resp.json()
        assert body["success"] is False
        assert body["code"] == 501
        assert "时间维度" in body["message"]

    def test_generic_exception_returns_envelope_not_500(self, client, monkeypatch):
        """I1 regression: any other exception in dispatch path must be wrapped
        as HTTP 200 + success=false envelope (Java `catch (Exception e)` parity)."""
        from smartbi_compat.api import analysis_drilldown as adr

        async def _boom(*a, **k):
            raise RuntimeError("DB connection lost")

        monkeypatch.setattr(adr, "_get_region_analysis", _boom)

        resp = _post(client, {
            "dimension": "region",
            "startDate": "2024-01-01", "endDate": "2024-12-31",
        })
        assert resp.status_code == 200
        body = resp.json()
        assert body["success"] is False
        assert body["code"] == 500
        assert "Drill-down failed" in body["message"]

    def test_client_provided_level_ignored_at_handler_entry(self, client, patched_helpers):
        """I3 regression: Java DTO has no `level` field → service always sees
        level=1. Python must mirror by overriding at handler entry."""
        # Client sends level=5 (would hit D6 dead branch if propagated)
        resp = _post(client, {
            "dimension": "region", "value": "华东", "level": 5,
            "startDate": "2024-01-01", "endDate": "2024-12-31",
        })
        assert resp.status_code == 200
        body = resp.json()
        assert body["success"] is True
        # If level=5 had propagated, response would have nextLevel=null (D6 dead).
        # With handler override level=1 → L2 path → nextLevel="city".
        assert body["data"]["level"] == 1
        assert body["data"]["nextLevel"] == "city"

    def test_client_provided_parent_context_ignored_at_handler_entry(
        self, client, patched_helpers
    ):
        """I4 regression: Java DTO doesn't propagate parentContext → service sees
        null → drillPath = filterValue or '全部'. Python must override too."""
        resp = _post(client, {
            "dimension": "region", "value": "华东",
            "parentContext": "全国",  # client tries to inject
            "startDate": "2024-01-01", "endDate": "2024-12-31",
        })
        assert resp.status_code == 200
        body = resp.json()
        assert body["success"] is True
        # If parentContext propagated: drillPath would be "全国 > 华东".
        # With override: drillPath = filterValue = "华东".
        assert body["data"]["drillPath"] == "华东"
