"""JWT middleware unit tests for SmartBI alias endpoints (Phase 2A T3)."""
import os
import jwt
import pytest
from fastapi import FastAPI, Depends
from fastapi.testclient import TestClient
from datetime import datetime, timedelta, timezone

JWT_SECRET = "test-secret-for-phase2a-do-not-use-in-prod"
os.environ["JWT_SECRET"] = JWT_SECRET


@pytest.fixture
def app():
    from smartbi_compat.auth import verify_jwt_and_factory
    a = FastAPI()

    @a.get("/api/mobile/{factory_id}/smart-bi/analysis/sales")
    async def sales(factory_id: str, auth=Depends(verify_jwt_and_factory)):
        return {"factory_id": factory_id, "user_id": auth.user_id, "role": auth.role}

    return a


@pytest.fixture
def client(app):
    return TestClient(app)


def make_token(*, factory_id=None, role="factory_admin", user_id=42, username="alice", expires_in=3600):
    now = datetime.now(timezone.utc)
    payload = {
        "userId": user_id,
        "username": username,
        "role": role,
        "iat": now,
        "exp": now + timedelta(seconds=expires_in),
    }
    if factory_id is not None:
        payload["factoryId"] = factory_id
    return jwt.encode(payload, JWT_SECRET, algorithm="HS256")


def test_missing_bearer_returns_401(client):
    r = client.get("/api/mobile/F001/smart-bi/analysis/sales")
    assert r.status_code == 401
    assert "Bearer" in r.json()["detail"]


def test_expired_token_returns_401(client):
    expired = make_token(factory_id="F001", expires_in=-10)
    r = client.get("/api/mobile/F001/smart-bi/analysis/sales",
                   headers={"Authorization": f"Bearer {expired}"})
    assert r.status_code == 401
    assert "expired" in r.json()["detail"].lower()


def test_cross_factory_token_returns_403(client):
    token = make_token(factory_id="F001", role="factory_admin")
    r = client.get("/api/mobile/F002/smart-bi/analysis/sales",
                   headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 403
    assert "factory" in r.json()["detail"].lower()


def test_null_factoryid_non_admin_returns_403(client):
    token = make_token(factory_id=None, role="factory_admin")
    r = client.get("/api/mobile/F001/smart-bi/analysis/sales",
                   headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 403
    assert "platform_admin" in r.json()["detail"]


def test_platform_admin_can_cross_factory(client):
    token = make_token(factory_id=None, role="platform_admin", user_id=1)
    r = client.get("/api/mobile/F999/smart-bi/analysis/sales",
                   headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 200
    body = r.json()
    assert body["factory_id"] == "F999"
    assert body["user_id"] == 1
    assert body["role"] == "platform_admin"
