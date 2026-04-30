"""F999 empty-state byte-shape gate (Phase 2A pattern).

For factoryId=F999 (non-existent), Python's response after _strip_volatile
must equal Java's IntentMatchResult.empty(...) JSON dump after same strip.

This is the Phase 2B-α merge gate.
"""
from __future__ import annotations

import json
import os
import pathlib
from unittest.mock import AsyncMock, patch

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient


VOLATILE_KEYS = {"timingMs", "generatedAt", "lastUpdated", "cacheExpireAt", "timestamp"}


def _strip_volatile(obj):
    """Recursively remove volatile keys for byte-shape compare."""
    if isinstance(obj, dict):
        return {k: _strip_volatile(v) for k, v in obj.items() if k not in VOLATILE_KEYS}
    if isinstance(obj, list):
        return [_strip_volatile(item) for item in obj]
    return obj


@pytest.fixture
def app():
    from ai.api import router

    app = FastAPI()
    app.include_router(router)

    @app.middleware("http")
    async def inject_factory(request, call_next):
        secret = request.headers.get("X-Internal-Secret", "")
        factory = request.headers.get("X-Factory-Id", "")
        if secret == os.environ.get("INTERNAL_API_SECRET", "test-secret"):
            request.state.factory_id = factory or None
            request.state.auth_method = "internal"
        return await call_next(request)
    return app


@pytest.mark.asyncio
async def test_F999_empty_state_byte_shape(app, monkeypatch):
    """Foundation merge gate.

    Strategy:
    - Patch get_current_snapshot to return EMPTY rows (F999 has no intents)
    - Patch matchers to return [] (no DB calls in test)
    - POST /api/ai/intent/match with F999
    - Compare response.json() to golden after _strip_volatile
    """
    monkeypatch.setenv("INTERNAL_API_SECRET", "test-secret")

    from ai.db import IntentSnapshot
    empty_snap = IntentSnapshot(rows=[], loaded_at_unix=0.0, max_config_version=0)

    fake_sem = AsyncMock(return_value=[])
    fake_cls = AsyncMock(return_value=[])
    fake_llm = AsyncMock(return_value=[])

    # Set up fake orchestrator for the app.state lookup
    from ai.matcher.semantic import SemanticMatcher
    from ai.matcher.classifier import ClassifierMatcher
    from ai.matcher.llm import LlmMatcher
    from ai.orchestrator import Orchestrator
    from unittest.mock import MagicMock

    sem_matcher = MagicMock(spec=SemanticMatcher)
    sem_matcher.match = fake_sem
    cls_matcher = MagicMock(spec=ClassifierMatcher)
    cls_matcher.match = fake_cls
    llm_matcher = MagicMock(spec=LlmMatcher)
    llm_matcher.match = fake_llm

    app.state.ai_orchestrator = Orchestrator(sem_matcher, cls_matcher, llm_matcher)

    with patch("ai.api.get_current_snapshot", return_value=empty_snap):
        client = TestClient(app)
        response = client.post(
            "/api/ai/intent/match",
            headers={
                "X-Internal-Secret": "test-secret",
                "X-Factory-Id": "F999",
            },
            json={
                "query": "测试 F999 空",
                "factoryId": "F999",
                "userId": "999",
                "username": "test",
                "role": "factory_super_admin",
                "businessType": "FACTORY",
            },
        )

    assert response.status_code == 200, f"Got {response.status_code}: {response.text}"

    golden_path = (
        pathlib.Path(__file__).resolve().parents[2]
        / "fixtures" / "java-intent-golden" / "F999-empty.json"
    )
    with open(golden_path, encoding="utf-8") as f:
        golden = json.load(f)

    actual = _strip_volatile(response.json())
    expected = _strip_volatile(golden["response"])

    assert actual["success"] == expected["success"]
    assert actual["data"] == expected["data"], (
        f"\nExpected: {json.dumps(expected['data'], ensure_ascii=False, indent=2)}"
        f"\nActual:   {json.dumps(actual['data'], ensure_ascii=False, indent=2)}"
    )


@pytest.mark.asyncio
async def test_F001_inventory_query_populated_byte_shape(app, monkeypatch):
    """I4: byte-shape parity test for populated result.

    Drives the orchestrator to return a SEMANTIC-stage match for
    INVENTORY_QUERY (sem_candidate confidence 0.85 >= semantic_threshold,
    triggering stage-5 short-circuit), then byte-compares the response
    against the hand-authored Java-shape golden.

    Why SEMANTIC and not KEYWORD: Phase 2B-α only ports stages 5-8 to
    Python. Stage 4 KEYWORD remains in Java in-process — if Java's stage 4
    matches, Python is never called. So a "Python returned KEYWORD" path
    is impossible by design. SEMANTIC is the closest realistic stage where
    bestMatch + populated topCandidates round-trip end-to-end.
    """
    monkeypatch.setenv("INTERNAL_API_SECRET", "test-secret")

    # The intent registry row must match what the golden expects bestMatch
    # to be — row_to_dto(...) of this row should serialize exactly as the
    # `bestMatch` block in the golden.
    inventory_row = {
        "id": "uuid-inv-001",
        "factory_id": None,
        "business_type": "COMMON",
        "intent_code": "INVENTORY_QUERY",
        "intent_name": "库存查询",
        "intent_category": "ANALYSIS",
        "sensitivity_level": "LOW",
        "required_roles": "[\"factory_super_admin\",\"manager\"]",
        "quota_cost": 1,
        "cache_ttl_minutes": 30,
        "requires_approval": False,
        "approval_chain_id": None,
        "keywords": "[\"库存\",\"查询\"]",
        "negative_keywords": None,
        "negative_keyword_penalty": 15,
        "regex_pattern": None,
        "description": "查询物料/产品库存",
        "example_queries": "[\"查库存\",\"看一下库存\"]",
        "negative_examples": None,
        "handler_class": None,
        "tool_name": "material_inventory_query",
        "max_tokens": 2000,
        "response_template": None,
        "is_active": True,
        "priority": 80,
        "metadata": None,
        "chart_type": "table",
        "required_entities": "[\"factory\",\"item_type\"]",
        "confidence_boost": 0.1,
        "config_version": 1,
        "previous_snapshot": None,
        "semantic_domain": "DATA",
        "semantic_action": "QUERY",
        "semantic_object": "MATERIAL",
        "semantic_path": "DATA.QUERY.MATERIAL",
        "deleted_at": None,
    }

    from ai.db import IntentSnapshot
    snapshot_with_inventory = IntentSnapshot(
        rows=[inventory_row], loaded_at_unix=0.0, max_config_version=1
    )

    # Stage 5 SEMANTIC short-circuit: matcher returns the candidate with
    # confidence 0.85 >= semantic_threshold. is_strong_signal triggers
    # stage 5 return without running stages 6-8.
    from ai.dto import CandidateIntentDto, MatchMethod
    fake_inventory_candidate = CandidateIntentDto(
        intentCode="INVENTORY_QUERY",
        intentName="库存查询",
        intentCategory="ANALYSIS",
        confidence=0.85,
        matchScore=95,
        matchedKeywords=["库存"],
        matchMethod=MatchMethod.SEMANTIC,
        description="查询物料/产品库存",
    )

    fake_sem = AsyncMock(return_value=[fake_inventory_candidate])
    fake_cls = AsyncMock(return_value=[])
    fake_llm = AsyncMock(return_value=[])

    from ai.matcher.semantic import SemanticMatcher
    from ai.matcher.classifier import ClassifierMatcher
    from ai.matcher.llm import LlmMatcher
    from ai.orchestrator import Orchestrator
    from unittest.mock import MagicMock

    sem_matcher = MagicMock(spec=SemanticMatcher); sem_matcher.match = fake_sem
    cls_matcher = MagicMock(spec=ClassifierMatcher); cls_matcher.match = fake_cls
    llm_matcher = MagicMock(spec=LlmMatcher); llm_matcher.match = fake_llm
    app.state.ai_orchestrator = Orchestrator(sem_matcher, cls_matcher, llm_matcher)

    with patch("ai.api.get_current_snapshot", return_value=snapshot_with_inventory):
        client = TestClient(app)
        response = client.post(
            "/api/ai/intent/match",
            headers={
                "X-Internal-Secret": "test-secret",
                "X-Factory-Id": "F001",
            },
            json={
                "query": "查 F001 工厂的库存",
                "factoryId": "F001",
                "userId": "22",
                "username": "factory_admin",
                "role": "factory_super_admin",
                "businessType": "FACTORY",
            },
        )

    assert response.status_code == 200, f"Got {response.status_code}: {response.text}"

    golden_path = (
        pathlib.Path(__file__).resolve().parents[2]
        / "fixtures" / "java-intent-golden" / "F001-inventory-query.json"
    )
    with open(golden_path, encoding="utf-8") as f:
        golden = json.load(f)

    actual = _strip_volatile(response.json())
    expected = _strip_volatile(golden["response"])

    # Byte-shape parity: data block (after volatile strip) must equal golden
    assert actual["success"] == expected["success"]
    assert actual["data"] == expected["data"], (
        f"\nExpected: {json.dumps(expected['data'], ensure_ascii=False, indent=2)}"
        f"\nActual:   {json.dumps(actual['data'], ensure_ascii=False, indent=2)}"
    )


def test_strip_volatile_keys():
    """Sanity: _strip_volatile removes timingMs, generatedAt, etc."""
    sample = {
        "data": {
            "bestMatch": None,
            "timingMs": {"totalMs": 100},
            "generatedAt": "2026-04-29",
            "topCandidates": [
                {"intentCode": "X", "timingMs": {"x": 1}}
            ],
        }
    }
    cleaned = _strip_volatile(sample)
    assert "timingMs" not in cleaned["data"]
    assert "generatedAt" not in cleaned["data"]
    assert "timingMs" not in cleaned["data"]["topCandidates"][0]
    assert cleaned["data"]["bestMatch"] is None
    assert cleaned["data"]["topCandidates"][0]["intentCode"] == "X"
