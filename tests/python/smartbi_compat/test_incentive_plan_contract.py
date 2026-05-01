"""Contract tests: Python /incentive-plan/{targetType}/{targetId} byte-shape parity.

Goldens (recorded 2026-04-29 to 04-30):
  - tests/fixtures/java-smartbi-golden/incentive-plan-salesperson-F999.json
  - tests/fixtures/java-smartbi-golden/incentive-plan-salesperson-F001.json

Both are empty-data branch (no row matches `salesperson_name=SP001` in F999/F001
current-month data). They cover the `targetGoal` default-fallback path
(currentPerformance=0 → completionRate=0 → nextLevelName="铜牌").

T3 / T4 / T5 use synthetic mocked data for level-hit / department / region
fall-through assertions (Java bug parity, see spec §5 Trap B).

Volatile fields stripped before dict-eq:
  - `id` (random UUID per request)
  - `createdAt` (LocalDateTime.now per request)
  - envelope `timestamp`
"""
from __future__ import annotations

import importlib.util
import json
import os
import pathlib
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from typing import Any

import jwt
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

JWT_SECRET = "test-secret-for-phase2a-do-not-use-in-prod"
os.environ["JWT_SECRET"] = JWT_SECRET

GOLDEN_DIR = (
    pathlib.Path(__file__).resolve().parents[2]
    / "fixtures"
    / "java-smartbi-golden"
)


def _load_production_main() -> Any:
    main_py = (
        pathlib.Path(__file__).resolve().parents[3]
        / "backend"
        / "python"
        / "main.py"
    )
    spec = importlib.util.spec_from_file_location(
        "phase2a_production_main_incentive_plan", main_py
    )
    assert spec is not None and spec.loader is not None
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


_production_main = _load_production_main()


# ── Helpers ──────────────────────────────────────────────────────────────

VOLATILE_KEYS = frozenset({"id", "createdAt", "timestamp"})


def _strip_volatile(obj: Any) -> Any:
    """Recursively strip non-deterministic keys before byte compare.

    See spec §5 Trap A: `id` (random UUID) and `createdAt` (now()) cannot
    byte-equal goldens; `timestamp` is the envelope-level Java
    LocalDateTime.now per response.
    """
    if isinstance(obj, dict):
        return {k: _strip_volatile(v) for k, v in obj.items() if k not in VOLATILE_KEYS}
    if isinstance(obj, list):
        return [_strip_volatile(item) for item in obj]
    return obj


def _make_token(factory_id: str) -> str:
    payload = {
        "userId": 1355,
        "username": "phase2a_test_user",
        "role": "factory_super_admin",
        "factoryId": factory_id,
        "iat": datetime.now(timezone.utc),
        "exp": datetime.now(timezone.utc) + timedelta(hours=1),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm="HS256")


def _load_golden(name: str) -> dict:
    with open(GOLDEN_DIR / f"{name}.json", encoding="utf-8") as f:
        return json.load(f)


def _assert_envelope(body: Any) -> None:
    """Java ApiResponse 5-key envelope assertion (success path)."""
    assert isinstance(body, dict), f"body not a dict: {type(body)}"
    missing = {"code", "message", "data", "timestamp", "success"} - set(body.keys())
    assert not missing, f"envelope missing keys: {missing}"
    assert body["success"] is True
    assert isinstance(body["message"], str)


# ── Fixtures ─────────────────────────────────────────────────────────────


@pytest.fixture
def app_with_empty_data(monkeypatch: pytest.MonkeyPatch) -> FastAPI:
    """All seams return [] — matches the F999/F001 salesperson goldens."""
    from smartbi_compat.api import incentive_plan as inc

    async def empty_query(*args, **kwargs):
        return []

    monkeypatch.setattr(inc, "_query_salesperson_sales", empty_query)
    monkeypatch.setattr(inc, "_query_department_data", empty_query)
    monkeypatch.setattr(inc, "_query_all_sales_rows", empty_query)
    monkeypatch.setattr(inc, "_query_all_department_rows", empty_query)
    return _production_main.app


@pytest.fixture
def app_with_silver_salesperson(monkeypatch: pytest.MonkeyPatch) -> FastAPI:
    """Salesperson seam returns rows summing to 85% completion → 银牌 tier."""
    from smartbi_compat.api import incentive_plan as inc

    async def fake_sp_sales(factory_id, range_, salesperson_id):
        return [
            {"amount": Decimal("85000.00"), "monthly_target": Decimal("100000.00")},
        ]

    async def empty_query(*args, **kwargs):
        return []

    monkeypatch.setattr(inc, "_query_salesperson_sales", fake_sp_sales)
    monkeypatch.setattr(inc, "_query_department_data", empty_query)
    monkeypatch.setattr(inc, "_query_all_sales_rows", empty_query)
    monkeypatch.setattr(inc, "_query_all_department_rows", empty_query)
    return _production_main.app


@pytest.fixture
def app_with_excellent_department(monkeypatch: pytest.MonkeyPatch) -> FastAPI:
    """Department seam returns rows summing to 120% completion → 卓越 (top tier, no next)."""
    from smartbi_compat.api import incentive_plan as inc

    async def fake_dept(factory_id, range_, department_id):
        return [
            {"sales_amount": Decimal("600000.00"), "sales_target": Decimal("500000.00")},
        ]

    async def empty_query(*args, **kwargs):
        return []

    monkeypatch.setattr(inc, "_query_salesperson_sales", empty_query)
    monkeypatch.setattr(inc, "_query_department_data", fake_dept)
    monkeypatch.setattr(inc, "_query_all_sales_rows", empty_query)
    monkeypatch.setattr(inc, "_query_all_department_rows", empty_query)
    return _production_main.app


@pytest.fixture
def app_with_region_fallthrough(monkeypatch: pytest.MonkeyPatch) -> FastAPI:
    """`_query_all_sales_rows` returns one row → region path falls through to it."""
    from smartbi_compat.api import incentive_plan as inc

    async def fake_all_sales(factory_id, range_):
        return [
            {
                "salesperson_name": "李四",
                "amount": Decimal("0"),
                "monthly_target": None,
            },
        ]

    async def fake_sp_sales(factory_id, range_, salesperson_id):
        # When falling through with first_sp="李四", filter should match
        if salesperson_id == "李四":
            return [
                {"amount": Decimal("0"), "monthly_target": None},
            ]
        return []

    async def empty_query(*args, **kwargs):
        return []

    monkeypatch.setattr(inc, "_query_salesperson_sales", fake_sp_sales)
    monkeypatch.setattr(inc, "_query_department_data", empty_query)
    monkeypatch.setattr(inc, "_query_all_sales_rows", fake_all_sales)
    monkeypatch.setattr(inc, "_query_all_department_rows", empty_query)
    return _production_main.app


# ── Tests ────────────────────────────────────────────────────────────────


def test_salesperson_empty_data_matches_F999_golden(app_with_empty_data: FastAPI) -> None:
    """T1: salesperson + no data → goldens-equivalent shape (default target=100k)."""
    client = TestClient(app_with_empty_data)
    resp = client.get(
        "/api/mobile/F999/smart-bi/incentive-plan/salesperson/SP001",
        headers={"Authorization": f"Bearer {_make_token('F999')}"},
    )
    assert resp.status_code == 200, f"got {resp.status_code}: {resp.text[:300]}"
    body = resp.json()
    _assert_envelope(body)

    actual = _strip_volatile(body["data"])
    expected = _strip_volatile(_load_golden("incentive-plan-salesperson-F999")["response"]["data"])
    assert actual == expected, (
        f"data mismatch:\n"
        f"  actual={json.dumps(actual, ensure_ascii=False, indent=2)[:500]}\n"
        f"  expected={json.dumps(expected, ensure_ascii=False, indent=2)[:500]}"
    )


def test_salesperson_empty_data_matches_F001_golden(app_with_empty_data: FastAPI) -> None:
    """T2: same shape for F001 (separate fixture, same dict-eq result post-strip)."""
    client = TestClient(app_with_empty_data)
    resp = client.get(
        "/api/mobile/F001/smart-bi/incentive-plan/salesperson/SP001",
        headers={"Authorization": f"Bearer {_make_token('F001')}"},
    )
    assert resp.status_code == 200, f"got {resp.status_code}: {resp.text[:300]}"
    body = resp.json()
    _assert_envelope(body)

    actual = _strip_volatile(body["data"])
    expected = _strip_volatile(_load_golden("incentive-plan-salesperson-F001")["response"]["data"])
    assert actual == expected


def test_salesperson_with_data_hits_silver_level(app_with_silver_salesperson: FastAPI) -> None:
    """T3: 85% completion → 银牌 current, 金牌 next, "距离目标只差" message branch."""
    client = TestClient(app_with_silver_salesperson)
    resp = client.get(
        "/api/mobile/F999/smart-bi/incentive-plan/salesperson/SP001",
        headers={"Authorization": f"Bearer {_make_token('F999')}"},
    )
    assert resp.status_code == 200, f"got {resp.status_code}: {resp.text[:300]}"
    data = resp.json()["data"]

    assert data["targetType"] == "salesperson"
    assert data["targetId"] == "SP001"
    assert data["currentPerformance"] == 85000
    assert data["targetGoal"] == 100000
    assert data["gapAmount"] == 15000
    # completionRate = 85000/100000 * 100 = 85.0000 → _decimal_to_number → int(85)
    assert data["completionRate"] == 85
    assert data["currentLevelName"] == "银牌"
    assert data["nextLevelName"] == "金牌"
    # gapToNextLevel = 100 - 85 = 15
    assert data["gapToNextLevel"] == 15
    assert data["estimatedReward"] == 1000
    assert data["potentialReward"] == 2000
    # 80 <= rate < 100 → "距离目标只差" branch
    assert "距离目标只差" in data["motivationalMessage"]
    assert "SP001" in data["motivationalMessage"]
    # 银牌 should be `current=true,achieved=true`; 铜牌 `achieved=true` only
    levels_by_name = {lv["levelName"]: lv for lv in data["levels"]}
    assert levels_by_name["铜牌"]["achieved"] is True
    assert levels_by_name["铜牌"]["current"] is False
    assert levels_by_name["银牌"]["achieved"] is True
    assert levels_by_name["银牌"]["current"] is True
    assert levels_by_name["金牌"]["achieved"] is False
    assert levels_by_name["钻石"]["achieved"] is False
    # 钻石 description: targetTo=null produces "完成率达到 120%-%" (Trap C)
    assert levels_by_name["钻石"]["description"] == "完成率达到 120%-%"


def test_department_with_data_hits_top_tier(app_with_excellent_department: FastAPI) -> None:
    """T4: 120% completion on department → 卓越 (top tier, no next), "太棒了！" branch."""
    client = TestClient(app_with_excellent_department)
    resp = client.get(
        "/api/mobile/F999/smart-bi/incentive-plan/department/D001",
        headers={"Authorization": f"Bearer {_make_token('F999')}"},
    )
    assert resp.status_code == 200, f"got {resp.status_code}: {resp.text[:300]}"
    data = resp.json()["data"]

    assert data["targetType"] == "department"
    assert data["targetId"] == "D001"
    assert data["currentPerformance"] == 600000
    assert data["targetGoal"] == 500000
    # gap = 500000 - 600000 = -100000 (Java preserves sign)
    assert data["gapAmount"] == -100000
    # completionRate = 600000/500000 * 100 = 120.0000 → 120
    assert data["completionRate"] == 120
    assert data["currentLevelName"] == "卓越"
    # Top tier — no next level
    assert data["nextLevelName"] is None
    assert data["gapToNextLevel"] is None
    assert data["potentialReward"] is None
    assert data["estimatedReward"] == 20000
    # rate >= 100 → "太棒了！" branch
    assert data["motivationalMessage"].startswith("太棒了！")
    # 3-tier ladder for department (not 4)
    assert len(data["levels"]) == 3
    assert [lv["levelName"] for lv in data["levels"]] == ["达标", "优秀", "卓越"]
    # 优秀 had targetTo=120 not None — note its description
    assert data["levels"][1]["description"] == "完成率达到 100%-120%"
    # 卓越 has null targetTo — produces "120%-%"
    assert data["levels"][2]["description"] == "完成率达到 120%-%"


def test_region_falls_through_to_first_salesperson(app_with_region_fallthrough: FastAPI) -> None:
    """T5: Java bug parity (spec §5 Trap B) — `region` path returns salesperson plan.

    URL targetId is silently ignored; response uses first salesperson_name from
    `_query_all_sales_rows` instead.
    """
    client = TestClient(app_with_region_fallthrough)
    resp = client.get(
        "/api/mobile/F999/smart-bi/incentive-plan/region/IGNORED_REGION_ID",
        headers={"Authorization": f"Bearer {_make_token('F999')}"},
    )
    assert resp.status_code == 200, f"got {resp.status_code}: {resp.text[:300]}"
    data = resp.json()["data"]

    # Java bug: targetType is OVERWRITTEN to "salesperson" by IncentivePlan.forSalesperson
    assert data["targetType"] == "salesperson", (
        "spec §5 Trap B: region path falls through to salesperson generation, "
        "and IncentivePlan.forSalesperson sets targetType='salesperson'"
    )
    # targetId is the first salesperson name, NOT the URL's IGNORED_REGION_ID
    assert data["targetId"] == "李四"
    assert data["targetName"] == "李四"
    # 4-tier salesperson ladder
    assert [lv["levelName"] for lv in data["levels"]] == ["铜牌", "银牌", "金牌", "钻石"]
