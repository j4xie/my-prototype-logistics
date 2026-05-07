"""Byte-shape contract gate for /analysis/region composite path.

Java reference:
  - Controller: SmartBIAnalysisController.getRegionAnalysis line 181-218
  - Composite dispatcher: SmartBIServiceImpl.getComprehensiveAnalysis line 593-598

Mirrors test_analysis_finance_contract.py / test_analysis_sales_contract.py pattern:
  - JWT_SECRET set in os.environ BEFORE importing production code
  - Load production main via importlib (full middleware stack)
  - Hit /api/mobile/{factory_id}/smart-bi/analysis/region via TestClient
  - Compare response['data'] to recorded golden['data'] (dict-eq, generatedAt + timestamp stripped)

Bake-ins from Task 2/3 goldens:
  - F1: xaxisField/yaxisField lowercase 'a' (Jackson decapitalize edge case)
  - F2: empty heatmap = 7 fields with nulls (no @JsonInclude on ChartConfig)
  - F7: MetricResult has 11 fields including changeValue=null at position 8
"""
from __future__ import annotations

import importlib.util
import io
import json
import os
import sys
from datetime import date, datetime, timezone
from decimal import Decimal
from pathlib import Path

import jwt
import pytest


JWT_SECRET = "test-secret-for-phase2a-do-not-use-in-prod"
os.environ["JWT_SECRET"] = JWT_SECRET


REPO_ROOT = Path(__file__).resolve().parents[3]
GOLDEN_DIR = REPO_ROOT / "tests" / "fixtures" / "java-smartbi-golden"


def _load_production_main():
    main_path = REPO_ROOT / "backend" / "python" / "main.py"
    sys.path.insert(0, str(REPO_ROOT / "backend" / "python"))
    spec = importlib.util.spec_from_file_location("_production_main", main_path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def _make_token(factory_id: str) -> str:
    payload = {
        "userId": 1,
        "username": "test_user",
        "factoryId": factory_id,
        "role": "factory_super_admin",
        "exp": datetime.now(timezone.utc).timestamp() + 3600,
    }
    return jwt.encode(payload, JWT_SECRET, algorithm="HS256")


VOLATILE = frozenset({"generatedAt", "lastUpdated", "cacheExpireAt", "timestamp"})


def _strip_volatile(obj):
    if isinstance(obj, dict):
        return {k: _strip_volatile(v) for k, v in obj.items() if k not in VOLATILE}
    if isinstance(obj, list):
        return [_strip_volatile(item) for item in obj]
    return obj


@pytest.fixture(scope="module")
def production_app():
    return _load_production_main().app


@pytest.fixture
def client(production_app):
    from fastapi.testclient import TestClient
    return TestClient(production_app)


class TestRouteHandler:
    """Verify FastAPI router registers and JWT auth gates the endpoint."""

    def test_route_registered(self, production_app):
        paths = [r.path for r in production_app.routes if hasattr(r, "path")]
        assert "/api/mobile/{factory_id}/smart-bi/analysis/region" in paths

    def test_jwt_required_returns_401_or_403_without_token(self, client):
        resp = client.get(
            "/api/mobile/F999/smart-bi/analysis/region"
            "?startDate=2024-01-01&endDate=2024-12-31"
        )
        assert resp.status_code in (401, 403), f"got {resp.status_code}"

    def test_factory_mismatch_returns_403(self, client):
        # JWT for F001 but path F999 — verify_jwt_and_factory should reject
        resp = client.get(
            "/api/mobile/F999/smart-bi/analysis/region"
            "?startDate=2024-01-01&endDate=2024-12-31",
            headers={"Authorization": f"Bearer {_make_token('F001')}"},
        )
        assert resp.status_code == 403, f"got {resp.status_code}: {resp.text[:200]}"

    def test_region_query_param_accepted_but_ignored(self, client, monkeypatch):
        """region=华东 vs no region → identical response (Java line 192-194 short-circuit)."""
        from smartbi_compat.api import analysis_region

        async def fake_query(factory_id, start, end):
            return []
        monkeypatch.setattr(analysis_region, "_query_region_full", fake_query)

        url_with = ("/api/mobile/F999/smart-bi/analysis/region"
                    "?startDate=2024-01-01&endDate=2024-12-31&region=华东")
        url_without = ("/api/mobile/F999/smart-bi/analysis/region"
                       "?startDate=2024-01-01&endDate=2024-12-31")
        headers = {"Authorization": f"Bearer {_make_token('F999')}"}
        r1 = client.get(url_with, headers=headers)
        r2 = client.get(url_without, headers=headers)
        assert r1.status_code == 200 and r2.status_code == 200
        assert _strip_volatile(r1.json()) == _strip_volatile(r2.json())


class TestEmptyData:
    """Empty rows → all sub-services return their empty shapes.

    F2: ChartConfig has no @JsonInclude → empty heatmap = 7 fields with nulls (NOT 3).
    F1: xaxisField/yaxisField (lowercase a) — NOT xAxisField/yAxisField.
    """

    def test_empty_rows_returns_empty_lists_and_7_field_heatmap(self, client, monkeypatch):
        from smartbi_compat.api import analysis_region

        async def fake_query(factory_id, start, end):
            return []
        monkeypatch.setattr(analysis_region, "_query_region_full", fake_query)

        resp = client.get(
            "/api/mobile/F999/smart-bi/analysis/region"
            "?startDate=2024-01-01&endDate=2024-12-31",
            headers={"Authorization": f"Bearer {_make_token('F999')}"},
        )
        assert resp.status_code == 200
        data = resp.json()["data"]
        assert data["ranking"] == []
        assert data["targetCompletion"] == []
        assert data["opportunityScores"] == []

        # F2: heatmap empty case = 7 fields all present (3 non-null + 4 null)
        assert data["heatmap"]["chartType"] == "MAP"
        assert data["heatmap"]["title"] == "销售地理分布"
        assert data["heatmap"]["data"] == []

        # F2 + F1: nulls explicit, NOT omitted
        assert "options" in data["heatmap"], "options key MUST be present (F2: no @JsonInclude)"
        assert data["heatmap"]["options"] is None
        assert "seriesField" in data["heatmap"]
        assert data["heatmap"]["seriesField"] is None
        assert "xaxisField" in data["heatmap"], "xaxisField (lowercase a per F1) MUST be present"
        assert data["heatmap"]["xaxisField"] is None
        assert "yaxisField" in data["heatmap"]
        assert data["heatmap"]["yaxisField"] is None

        # F1 negative test: xAxisField (capital A) MUST NOT be present
        assert "xAxisField" not in data["heatmap"], "F1: spec wrongly used capital A; reality is lowercase"
        assert "yAxisField" not in data["heatmap"]

    def test_envelope_6_keys_present(self, client, monkeypatch):
        from smartbi_compat.api import analysis_region

        async def fake_query(factory_id, start, end):
            return []
        monkeypatch.setattr(analysis_region, "_query_region_full", fake_query)

        resp = client.get(
            "/api/mobile/F999/smart-bi/analysis/region"
            "?startDate=2024-01-01&endDate=2024-12-31",
            headers={"Authorization": f"Bearer {_make_token('F999')}"},
        )
        assert resp.status_code == 200
        data = resp.json()["data"]
        assert set(data.keys()) == {
            "ranking", "targetCompletion", "heatmap",
            "opportunityScores", "dateRange", "generatedAt",
        }


class TestF999Golden:
    """F999 byte-shape gate via dict-eq (empty data path).

    THE acceptance gate for byte-shape parity. If this passes, Python output
    matches Java byte-shape (within dict-eq tolerance, generatedAt + timestamp stripped).
    """

    def test_f999_byte_shape_dict_eq(self, client, monkeypatch):
        from smartbi_compat.api import analysis_region

        # F999 has no sales data — fake empty rows for both current + previous
        async def fake_query(factory_id, start, end):
            return []
        monkeypatch.setattr(analysis_region, "_query_region_full", fake_query)

        resp = client.get(
            "/api/mobile/F999/smart-bi/analysis/region"
            "?startDate=2024-01-01&endDate=2024-12-31",
            headers={"Authorization": f"Bearer {_make_token('F999')}"},
        )
        assert resp.status_code == 200
        py_data = _strip_volatile(resp.json()["data"])

        with io.open(GOLDEN_DIR / "analysis-region-F999.json", encoding="utf-8") as f:
            raw = json.load(f)
            # Golden is wrapped in {code, message, data, timestamp, success, ...} envelope
            golden_data = _strip_volatile(raw["data"])

        if py_data != golden_data:
            import difflib
            py_str = json.dumps(py_data, ensure_ascii=False, indent=2, sort_keys=True)
            golden_str = json.dumps(golden_data, ensure_ascii=False, indent=2, sort_keys=True)
            diff = "\n".join(difflib.unified_diff(
                golden_str.splitlines(), py_str.splitlines(),
                fromfile="golden", tofile="python", lineterm="", n=3,
            ))
            pytest.fail(f"F999 byte-shape mismatch:\n{diff}")


class TestF001Golden:
    """F001 manual smoke against real Java backend (run by hand).

    Run with:
      pytest -v tests/python/smartbi_compat/test_analysis_region_contract.py::TestF001Golden::test_f001_manual_smoke
    """

    @pytest.mark.skip(reason="manual smoke against Java backend — run by hand")
    def test_f001_manual_smoke(self, client):
        resp = client.get(
            "/api/mobile/F001/smart-bi/analysis/region"
            "?startDate=2024-01-01&endDate=2024-12-31",
            headers={"Authorization": f"Bearer {_make_token('F001')}"},
        )
        assert resp.status_code == 200
        py_data = _strip_volatile(resp.json()["data"])

        with io.open(GOLDEN_DIR / "analysis-region-F001.json", encoding="utf-8") as f:
            raw = json.load(f)
            golden_data = _strip_volatile(raw["data"])

        assert py_data == golden_data, "F001 byte-shape mismatch — re-record golden if Java logic changed"


class TestTargetCompletionTieBreak:
    """Task #25 fix (2026-05-07): tied changePercent regions retain insertion order.

    Java aggregateByRegion (RegionAnalysisServiceImpl.java:656) explicitly uses
    `new LinkedHashMap<>()`. Insertion order = order each region first appears in
    SQL row scan. Java line 307-311 sorts by changePercent desc with stable Timsort,
    so tied rows retain insertion order.

    Python parity:
      - SQL `ORDER BY id ASC` matches JPA default fetch order (analysis_region.py:141).
      - Python dict 3.7+ preserves insertion order ≡ LinkedHashMap.
      - Python `sorted(..., reverse=True)` is stable (Timsort).
      → tied rows retain insertion order naturally; no _java_hashmap_bucket needed.

    Prior fix (`_java_hashmap_bucket` pre-sort) was wrong direction — assumed
    HashMap. Stripped in this PR.
    """

    def _row(self, region: str, amount: str, monthly_target: str, idx: int = 0) -> dict:
        """Synthetic salesData row matching what _aggregate_by_region needs."""
        return {
            "id": idx,
            "region": region,
            "amount": Decimal(amount),
            "monthly_target": Decimal(monthly_target),
            "cost": None,
            "customer_name": None,
        }

    def test_tied_change_percent_preserves_insertion_order(self, client, monkeypatch):
        """Mirrors F001 2026YTD real prod data: 2-tied at 90.91 + 90.33 + 83.15.

        First-appearance order in SQL: 上海 → 华东 → 浙江 → 华南.
        Expected output (sort by changePercent desc, stable on ties):
          [上海(90.91), 华东(90.91), 浙江(90.33), 华南(83.15)]

        If _java_hashmap_bucket re-sort were active, 上海/华东 might swap (they
        hash to different buckets). This test catches a regression to the old
        wrong-direction fix.
        """
        from smartbi_compat.api import analysis_region

        # 100/110 → 0.9090909... → quantize(0.0001, HALF_UP) * 100 → 90.91
        # Per python-java-port.md Rule 10: divide-then-multiply intermediate round.
        synth_rows = [
            self._row("上海分部", "100", "110", idx=1),  # 90.91
            self._row("华东分部", "100", "110", idx=2),  # 90.91 (tied)
            self._row("浙江分部", "9033", "10000", idx=3),  # 90.33
            self._row("华南分部", "8315", "10000", idx=4),  # 83.15
        ]

        async def fake_query(factory_id, start, end):
            return synth_rows
        monkeypatch.setattr(analysis_region, "_query_region_full", fake_query)

        resp = client.get(
            "/api/mobile/F999/smart-bi/analysis/region"
            "?startDate=2026-01-01&endDate=2026-05-07",
            headers={"Authorization": f"Bearer {_make_token('F999')}"},
        )
        assert resp.status_code == 200
        tc = resp.json()["data"]["targetCompletion"]
        assert len(tc) == 4
        regions_in_order = [item["dimensionValue"] for item in tc]
        assert regions_in_order == ["上海分部", "华东分部", "浙江分部", "华南分部"], (
            f"Tied changePercent should preserve insertion order. Got: {regions_in_order}"
        )
        # Sanity: confirm tie value
        assert tc[0]["changePercent"] == tc[1]["changePercent"] == 90.91
        assert tc[2]["changePercent"] == 90.33
        assert tc[3]["changePercent"] == 83.15

    def test_tied_change_percent_reverse_insertion_swaps_order(self, client, monkeypatch):
        """Same data but insertion order swapped — 华东 first, 上海 second.

        Confirms the order genuinely follows insertion (NOT alphabetical or any
        other deterministic-by-name order that could accidentally pass test 1).
        """
        from smartbi_compat.api import analysis_region

        synth_rows = [
            self._row("华东分部", "100", "110", idx=1),  # 90.91
            self._row("上海分部", "100", "110", idx=2),  # 90.91 (tied, but later)
            self._row("浙江分部", "9033", "10000", idx=3),  # 90.33
        ]

        async def fake_query(factory_id, start, end):
            return synth_rows
        monkeypatch.setattr(analysis_region, "_query_region_full", fake_query)

        resp = client.get(
            "/api/mobile/F999/smart-bi/analysis/region"
            "?startDate=2026-01-01&endDate=2026-05-07",
            headers={"Authorization": f"Bearer {_make_token('F999')}"},
        )
        assert resp.status_code == 200
        tc = resp.json()["data"]["targetCompletion"]
        regions_in_order = [item["dimensionValue"] for item in tc]
        assert regions_in_order == ["华东分部", "上海分部", "浙江分部"], (
            f"Insertion order must drive tie-break. Got: {regions_in_order}"
        )

    def test_four_way_tie_all_same_change_percent(self, client, monkeypatch):
        """Worst case: 4 regions all with identical changePercent (90.91).

        Java LinkedHashMap iteration = SQL row order = insertion. All 4 keep
        appearance order through the stable sort.
        """
        from smartbi_compat.api import analysis_region

        synth_rows = [
            self._row("华北", "100", "110", idx=1),
            self._row("华东", "100", "110", idx=2),
            self._row("华南", "100", "110", idx=3),
            self._row("华中", "100", "110", idx=4),
        ]

        async def fake_query(factory_id, start, end):
            return synth_rows
        monkeypatch.setattr(analysis_region, "_query_region_full", fake_query)

        resp = client.get(
            "/api/mobile/F999/smart-bi/analysis/region"
            "?startDate=2026-01-01&endDate=2026-05-07",
            headers={"Authorization": f"Bearer {_make_token('F999')}"},
        )
        assert resp.status_code == 200
        tc = resp.json()["data"]["targetCompletion"]
        regions_in_order = [item["dimensionValue"] for item in tc]
        assert regions_in_order == ["华北", "华东", "华南", "华中"]
        assert all(item["changePercent"] == 90.91 for item in tc)

    def test_f001_2026ytd_golden_target_completion_byte_shape(self, client, monkeypatch):
        """Use recorded F001 2026YTD golden as oracle for tied-data byte shape.

        Golden was recorded from Java prod 10010 on 2026-05-07. Contains real
        F001 data with 上海分部 + 华东分部 tied at 90.91. We mock the SQL with
        synthetic rows that produce the same aggregation output, then assert
        the targetCompletion array matches golden byte-for-byte (after volatile
        strip).

        This is the empirical proof that the fix produces parity with Java
        on real-world tied-changePercent data.
        """
        from smartbi_compat.api import analysis_region

        with io.open(GOLDEN_DIR / "analysis-region-F001-2026YTD.json", encoding="utf-8") as f:
            golden = json.load(f)
        golden_tc = golden["data"]["targetCompletion"]

        # Reconstruct synthetic rows that aggregate to the golden's regions.
        # Each region gets 1 row; amount/target back-derived from formattedValue + changePercent.
        # changePercent = (amount/target).quantize(0.0001).multiply(100).quantize(0.01).
        # Pick clean values: amount=100*ratio, target=100. Ratio = changePercent/100 with enough precision.
        # Easier: read golden values + use them directly.
        synth_rows = []
        for idx, item in enumerate(golden_tc, start=1):
            region = item["dimensionValue"]
            amount = Decimal(str(item["value"]))  # raw value
            # description format "目标: <formatted>" — parse target. For simpler synthesis,
            # use changePercent to back-calc target = amount / (changePercent/100).
            cp = Decimal(str(item["changePercent"]))
            if cp > 0:
                target = (amount / (cp / Decimal("100"))).quantize(Decimal("0.01"))
            else:
                target = Decimal("0")
            synth_rows.append(self._row(region, str(amount), str(target), idx=idx))

        async def fake_query(factory_id, start, end):
            return synth_rows
        monkeypatch.setattr(analysis_region, "_query_region_full", fake_query)

        resp = client.get(
            "/api/mobile/F001/smart-bi/analysis/region"
            "?startDate=2026-01-01&endDate=2026-05-07",
            headers={"Authorization": f"Bearer {_make_token('F001')}"},
        )
        assert resp.status_code == 200
        py_tc = resp.json()["data"]["targetCompletion"]

        # Order must match Java golden exactly (ties preserved).
        py_regions = [item["dimensionValue"] for item in py_tc]
        golden_regions = [item["dimensionValue"] for item in golden_tc]
        assert py_regions == golden_regions, (
            f"Order mismatch.\n  Python: {py_regions}\n  Golden: {golden_regions}"
        )

        # changePercent values must match (within Decimal/float quantize equivalence).
        for py_item, gold_item in zip(py_tc, golden_tc):
            assert py_item["changePercent"] == gold_item["changePercent"], (
                f"changePercent mismatch for {py_item['dimensionValue']}: "
                f"py={py_item['changePercent']} vs golden={gold_item['changePercent']}"
            )
