"""ai/api.py — POST /api/ai/intent/match endpoint."""
from __future__ import annotations

import os
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient


@pytest.fixture
def app_with_router():
    """Build a minimal app for testing the router directly with simulated middleware."""
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


def test_match_endpoint_returns_envelope(app_with_router, monkeypatch):
    monkeypatch.setenv("INTERNAL_API_SECRET", "test-secret")

    fake_result = MagicMock()
    fake_result.model_dump = MagicMock(return_value={
        "bestMatch": None,
        "topCandidates": [],
        "confidence": 0.0,
        "matchMethod": "NONE",
        "matchedKeywords": [],
        "isStrongSignal": False,
        "requiresConfirmation": False,
        "clarificationQuestion": None,
        "userInput": "test",
        "actionType": "UNKNOWN",
        "questionType": None,
        "targetEntity": None,
        "sessionId": None,
        "conversationMessage": None,
        "isMultiIntent": False,
        "additionalIntents": [],
        "executionStrategy": None,
        "timingMs": {"totalMs": 1},
        "preprocessedQuery": None,
    })

    with patch("ai.api._do_match", new=AsyncMock(return_value=fake_result)):
        client = TestClient(app_with_router)
        response = client.post(
            "/api/ai/intent/match",
            headers={
                "X-Internal-Secret": "test-secret",
                "X-Factory-Id": "F001",
            },
            json={
                "query": "test",
                "factoryId": "F001",
                "userId": "22",
                "username": "admin",
                "role": "factory_super_admin",
                "businessType": "FACTORY",
            },
        )
    assert response.status_code == 200
    body = response.json()
    assert body["success"] is True
    assert body["data"] is not None
    assert "bestMatch" in body["data"]
    assert "matchMethod" in body["data"]


def test_match_rejects_factoryId_header_body_mismatch(app_with_router, monkeypatch):
    monkeypatch.setenv("INTERNAL_API_SECRET", "test-secret")
    client = TestClient(app_with_router)
    response = client.post(
        "/api/ai/intent/match",
        headers={
            "X-Internal-Secret": "test-secret",
            "X-Factory-Id": "F001",
        },
        json={
            "query": "test",
            "factoryId": "F002",  # MISMATCH
            "userId": "22",
            "username": "admin",
            "role": "factory_super_admin",
            "businessType": "FACTORY",
        },
    )
    assert response.status_code == 403
    body = response.json()
    assert body["success"] is False
    assert body["code"] == "AUTH_FACTORY_ID_MISMATCH"


def test_match_rejects_missing_internal_secret(app_with_router, monkeypatch):
    monkeypatch.setenv("INTERNAL_API_SECRET", "test-secret")
    client = TestClient(app_with_router)
    response = client.post(
        "/api/ai/intent/match",
        headers={
            "X-Factory-Id": "F001",
        },
        json={
            "query": "test",
            "factoryId": "F001",
            "userId": "22",
            "username": "admin",
            "role": "factory_super_admin",
            "businessType": "FACTORY",
        },
    )
    assert response.status_code == 401
    body = response.json()
    assert body["success"] is False
    assert body["code"] == "AUTH_INTERNAL_SECRET_MISMATCH"
