"""test_api.py — unit tests for the materialized analytics API router.

Uses FastAPI TestClient + a stubbed asyncpg pool. Integration against
real DB happens in Task 16 smoke.
"""
from __future__ import annotations

import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from fastapi import FastAPI
from fastapi.testclient import TestClient
from starlette.requests import Request

from smartbi.api.materialized_analytics import router


@pytest.fixture
def app_with_router():
    app = FastAPI()

    # Inject fake factory_id into request.state via middleware
    @app.middleware("http")
    async def inject_factory(request: Request, call_next):
        request.state.factory_id = request.headers.get("X-Test-Factory", "F001")
        return await call_next(request)

    app.include_router(router, prefix="/api/smartbi")
    return app


def test_cached_returns_empty_when_no_results(app_with_router):
    """With no persisted results, endpoint returns cached=False + empty list."""
    with patch("smartbi.api.materialized_analytics.get_pg_pool", new_callable=AsyncMock) as mock_pool_fn:
        mock_pool = MagicMock()

        # _get_upload_factory returns F001
        conn_mock = MagicMock()
        async def _fetchrow(sql, *args):
            if "smart_bi_pg_excel_uploads" in sql:
                return {"factory_id": "F001"}
            return None
        conn_mock.fetchrow = AsyncMock(side_effect=_fetchrow)
        conn_mock.fetch = AsyncMock(return_value=[])

        async def _acquire():
            class _CM:
                async def __aenter__(self): return conn_mock
                async def __aexit__(self, *a): pass
            return _CM()
        # pool.acquire() returns a context manager
        mock_pool.acquire = lambda: _Acquire(conn_mock)
        mock_pool_fn.return_value = mock_pool

        # Also stub load_materialization_results to return []
        with patch(
            "smartbi.api.materialized_analytics.load_materialization_results",
            new_callable=AsyncMock, return_value=[]
        ):
            client = TestClient(app_with_router)
            resp = client.get(
                "/api/smartbi/analytics/cached/3971",
                headers={"X-Test-Factory": "F001"},
            )
            assert resp.status_code == 200
            body = resp.json()
            assert body["success"] is True
            assert body["cached"] is False
            assert body["count"] == 0
            assert body["results"] == []
            assert body["factory_id"] == "F001"


class _Acquire:
    def __init__(self, conn):
        self._conn = conn
    async def __aenter__(self):
        return self._conn
    async def __aexit__(self, *a):
        pass


def test_cached_forbidden_on_factory_mismatch(app_with_router):
    """user factory != upload factory ⇒ 403."""
    with patch("smartbi.api.materialized_analytics.get_pg_pool", new_callable=AsyncMock) as mock_pool_fn:
        mock_pool = MagicMock()
        conn_mock = MagicMock()
        conn_mock.fetchrow = AsyncMock(return_value={"factory_id": "F_OTHER"})
        mock_pool.acquire = lambda: _Acquire(conn_mock)
        mock_pool_fn.return_value = mock_pool

        client = TestClient(app_with_router)
        resp = client.get(
            "/api/smartbi/analytics/cached/3971",
            headers={"X-Test-Factory": "F001"},
        )
        assert resp.status_code == 403
        assert "cross-tenant" in resp.json()["detail"].lower()


def test_cached_404_when_upload_missing(app_with_router):
    """upload not found ⇒ 404."""
    with patch("smartbi.api.materialized_analytics.get_pg_pool", new_callable=AsyncMock) as mock_pool_fn:
        mock_pool = MagicMock()
        conn_mock = MagicMock()
        conn_mock.fetchrow = AsyncMock(return_value=None)
        mock_pool.acquire = lambda: _Acquire(conn_mock)
        mock_pool_fn.return_value = mock_pool

        client = TestClient(app_with_router)
        resp = client.get(
            "/api/smartbi/analytics/cached/99999999",
            headers={"X-Test-Factory": "F001"},
        )
        assert resp.status_code == 404
