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
