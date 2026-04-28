"""Tests for restaurant_outliers API (Phase B-1).

Pattern mirrors test_restaurant_etl_admin.py: mount only the target router
inside a minimal FastAPI test app, inject request.state fields via tiny
middleware. No global exception handlers — FastAPI default {detail: "..."}
format is used in test responses.

Reviewer R2 critical: response payload MUST include baselineSource + baselineN.
Quick-Win 3 pattern: cross-factory check returns 403 with 'platform_admin'
mention in detail.
"""
from __future__ import annotations

import time
from datetime import date, datetime, timezone, timedelta
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient


@pytest.fixture(autouse=True)
def _clear_cache():
    """Reset module-level cache between tests to avoid cross-test bleed."""
    from smartbi.api.restaurant_outliers import _cache
    _cache.clear()
    yield
    _cache.clear()


def _build_app():
    """Build minimal FastAPI app with restaurant_outliers router + auth middleware mock."""
    from smartbi.api.restaurant_outliers import router

    app = FastAPI()

    # Inject role + factory_id into request.state (Phase A pattern)
    @app.middleware("http")
    async def _mock_auth(request, call_next):
        request.state.role = request.headers.get('x-role', 'factory_super_admin')
        request.state.factory_id = request.headers.get('x-factory-id', 'F002')
        request.state.auth_method = 'jwt'
        return await call_next(request)

    app.include_router(router, prefix="/api/restaurant")
    return app


def _mock_outlier(anomaly_date, kpi='wastage_cost_total', value=8500, baseline='self'):
    from smartbi.services.outlier_service import DetectedOutlier
    return DetectedOutlier(
        anomaly_date=anomaly_date, kpi_kind=kpi, value=value,
        q1=1200, q3=3400, iqr=2200,
        lower_fence=-2100, upper_fence=6700,
        deviation_x=0.82, severity='medium', direction='above',
        baseline_source=baseline, baseline_n='100-499' if baseline == 'global' else '10-49',
    )


class TestGetOutliersAPI:
    def test_get_outliers_admin_success_returns_baseline_source_field(self):
        app = _build_app()
        client = TestClient(app)

        mock_outliers = [_mock_outlier(date.today() - timedelta(days=2))]
        mock_service = AsyncMock()
        mock_service.detect_totals = AsyncMock(return_value=(mock_outliers, []))

        with patch('smartbi.api.restaurant_outliers._service', mock_service), \
             patch('smartbi.api.restaurant_outliers._query_dismissed_this_month',
                   new=AsyncMock(return_value=[])):
            r = client.get('/api/restaurant/outliers?factoryId=F002')

        assert r.status_code == 200, r.text
        body = r.json()
        assert body['factoryId'] == 'F002'
        assert body['windowDays'] == 30
        assert body['summary']['totalAnomalies'] == 1
        assert len(body['outliers']) == 1
        # Reviewer R2 critical: baselineSource MUST be in response
        assert 'baselineSource' in body['outliers'][0]
        assert 'baselineN' in body['outliers'][0]
        assert body['outliers'][0]['baselineSource'] == 'self'

    def test_cross_factory_blocked_403(self):
        app = _build_app()
        client = TestClient(app)
        # Admin of F001 tries to query F002
        r = client.get(
            '/api/restaurant/outliers?factoryId=F002',
            headers={'x-role': 'factory_super_admin', 'x-factory-id': 'F001'},
        )
        assert r.status_code == 403
        assert 'platform_admin' in r.json()['detail']

    def test_platform_admin_can_query_any_factory(self):
        app = _build_app()
        client = TestClient(app)

        mock_service = AsyncMock()
        mock_service.detect_totals = AsyncMock(return_value=([], []))

        with patch('smartbi.api.restaurant_outliers._service', mock_service), \
             patch('smartbi.api.restaurant_outliers._query_dismissed_this_month',
                   new=AsyncMock(return_value=[])):
            r = client.get(
                '/api/restaurant/outliers?factoryId=F002',
                headers={'x-role': 'platform_admin', 'x-factory-id': 'F999'},
            )
        assert r.status_code == 200

    def test_invalid_factory_id_400(self):
        app = _build_app()
        client = TestClient(app)
        r = client.get('/api/restaurant/outliers?factoryId=' + 'X' * 51)
        assert r.status_code == 400

    def test_window_days_out_of_range_validation(self):
        app = _build_app()
        client = TestClient(app)
        r = client.get('/api/restaurant/outliers?factoryId=F002&windowDays=400')
        # FastAPI Query(ge=1, le=365) returns 422
        assert r.status_code == 422

    def test_unauthenticated_returns_401(self):
        """No auth middleware → require_admin should raise 401."""
        from smartbi.api.restaurant_outliers import router
        app = FastAPI()
        # NO auth middleware — request.state.role will be missing
        app.include_router(router, prefix="/api/restaurant")
        client = TestClient(app)
        r = client.get('/api/restaurant/outliers?factoryId=F002')
        # require_admin raises 401 when role is missing
        assert r.status_code == 401


class TestDismissOutlierAPI:
    def test_dismiss_inserts_and_invalidates_cache(self):
        from smartbi.api.restaurant_outliers import _cache
        app = _build_app()
        client = TestClient(app)

        # Pre-populate cache to verify invalidation. Task 5 changed cache key
        # to f"{factoryId}:{windowDays}" so use 'F002:30'.
        _cache['F002:30'] = (time.monotonic(), {'cached': True})

        mock_pool = AsyncMock()
        mock_conn = AsyncMock()
        mock_conn.execute = AsyncMock(return_value=None)
        mock_conn.fetchrow = AsyncMock(return_value={
            'id': 99, 'dismissed_at': datetime.now(timezone.utc),
        })
        mock_conn.transaction = MagicMock()
        mock_conn.transaction.return_value.__aenter__ = AsyncMock(return_value=None)
        mock_conn.transaction.return_value.__aexit__ = AsyncMock(return_value=None)
        mock_pool.acquire = MagicMock()
        mock_pool.acquire.return_value.__aenter__ = AsyncMock(return_value=mock_conn)
        mock_pool.acquire.return_value.__aexit__ = AsyncMock(return_value=None)

        with patch('smartbi.config.get_pg_pool', new=AsyncMock(return_value=mock_pool)):
            r = client.post('/api/restaurant/outliers/dismiss', json={
                'factoryId': 'F002',
                'anomalyDate': '2026-04-25',
                'kpiKind': 'wastage_cost_total',
                'snapshotValue': 8500.0,
                'snapshotQ1': 1200.0,
                'snapshotQ3': 3400.0,
                'snapshotBaselineSource': 'self',
            })

        assert r.status_code == 201, r.text
        assert r.json()['id'] == 99
        # Cache invalidated — Task 5 wipes by prefix f"{factoryId}:"
        remaining = [k for k in _cache if k.startswith('F002:')]
        assert remaining == [], f"expected no F002:* cache keys, got {remaining}"

    def test_dismiss_invalid_baseline_source_400(self):
        app = _build_app()
        client = TestClient(app)
        r = client.post('/api/restaurant/outliers/dismiss', json={
            'factoryId': 'F002',
            'anomalyDate': '2026-04-25',
            'kpiKind': 'wastage_cost_total',
            'snapshotValue': 8500, 'snapshotQ1': 1200, 'snapshotQ3': 3400,
            'snapshotBaselineSource': 'INVALID',
        })
        assert r.status_code == 400

    def test_dismiss_unknown_kpi_kind_400(self):
        app = _build_app()
        client = TestClient(app)
        r = client.post('/api/restaurant/outliers/dismiss', json={
            'factoryId': 'F002',
            'anomalyDate': '2026-04-25',
            'kpiKind': 'unknown_kpi',
            'snapshotValue': 100, 'snapshotQ1': 50, 'snapshotQ3': 150,
            'snapshotBaselineSource': 'self',
        })
        assert r.status_code == 400

    def test_dismiss_duplicate_returns_409(self):
        """UniqueViolation on (factory_id, anomaly_date, kpi_kind) → 409."""
        import asyncpg
        app = _build_app()
        client = TestClient(app)

        mock_pool = AsyncMock()
        mock_conn = AsyncMock()
        mock_conn.execute = AsyncMock(return_value=None)
        # Simulate asyncpg raising UniqueViolationError on INSERT
        mock_conn.fetchrow = AsyncMock(
            side_effect=asyncpg.exceptions.UniqueViolationError(
                "duplicate key value violates unique constraint"
            )
        )
        mock_conn.transaction = MagicMock()
        mock_conn.transaction.return_value.__aenter__ = AsyncMock(return_value=None)
        mock_conn.transaction.return_value.__aexit__ = AsyncMock(return_value=None)
        mock_pool.acquire = MagicMock()
        mock_pool.acquire.return_value.__aenter__ = AsyncMock(return_value=mock_conn)
        mock_pool.acquire.return_value.__aexit__ = AsyncMock(return_value=None)

        with patch('smartbi.config.get_pg_pool', new=AsyncMock(return_value=mock_pool)):
            r = client.post('/api/restaurant/outliers/dismiss', json={
                'factoryId': 'F002',
                'anomalyDate': '2026-04-25',
                'kpiKind': 'wastage_cost_total',
                'snapshotValue': 8500.0,
                'snapshotQ1': 1200.0,
                'snapshotQ3': 3400.0,
                'snapshotBaselineSource': 'self',
            })

        assert r.status_code == 409
        assert "已被标记" in r.json()['detail']

    def test_dismiss_invalid_anomaly_date_format_400(self):
        """Invalid ISO date string → 400 (not 500)."""
        app = _build_app()
        client = TestClient(app)
        r = client.post('/api/restaurant/outliers/dismiss', json={
            'factoryId': 'F002',
            'anomalyDate': 'not-a-date',
            'kpiKind': 'wastage_cost_total',
            'snapshotValue': 8500.0, 'snapshotQ1': 1200.0, 'snapshotQ3': 3400.0,
            'snapshotBaselineSource': 'self',
        })
        assert r.status_code == 400
        assert "anomalyDate 格式无效" in r.json()['detail']


class TestUndismissOutlierAPI:
    def test_undismiss_404_when_not_exist(self):
        app = _build_app()
        client = TestClient(app)

        mock_pool = AsyncMock()
        mock_conn = AsyncMock()
        mock_conn.execute = AsyncMock(return_value=None)
        mock_conn.fetchrow = AsyncMock(return_value=None)  # not found
        mock_conn.transaction = MagicMock()
        mock_conn.transaction.return_value.__aenter__ = AsyncMock(return_value=None)
        mock_conn.transaction.return_value.__aexit__ = AsyncMock(return_value=None)
        mock_pool.acquire = MagicMock()
        mock_pool.acquire.return_value.__aenter__ = AsyncMock(return_value=mock_conn)
        mock_pool.acquire.return_value.__aexit__ = AsyncMock(return_value=None)

        with patch('smartbi.config.get_pg_pool', new=AsyncMock(return_value=mock_pool)):
            r = client.delete('/api/restaurant/outliers/dismiss/9999')

        assert r.status_code == 404

    def test_undismiss_happy_path_204_and_invalidates_cache(self):
        """DELETE returns 204 + uses row's factory_id for cache invalidation."""
        from smartbi.api.restaurant_outliers import _cache
        app = _build_app()
        client = TestClient(app)

        # Pre-populate cache with row's factory_id
        _cache['F002:30'] = (time.monotonic(), {'cached': True})

        mock_pool = AsyncMock()
        mock_conn = AsyncMock()
        mock_conn.execute = AsyncMock(return_value=None)
        # SELECT returns row, DELETE succeeds
        mock_conn.fetchrow = AsyncMock(return_value={'factory_id': 'F002'})
        mock_conn.transaction = MagicMock()
        mock_conn.transaction.return_value.__aenter__ = AsyncMock(return_value=None)
        mock_conn.transaction.return_value.__aexit__ = AsyncMock(return_value=None)
        mock_pool.acquire = MagicMock()
        mock_pool.acquire.return_value.__aenter__ = AsyncMock(return_value=mock_conn)
        mock_pool.acquire.return_value.__aexit__ = AsyncMock(return_value=None)

        with patch('smartbi.config.get_pg_pool', new=AsyncMock(return_value=mock_pool)):
            r = client.delete('/api/restaurant/outliers/dismiss/123')

        assert r.status_code == 204
        assert r.text == ""
        # Cache invalidated by row's factory_id (not jwt's)
        assert 'F002:30' not in _cache

    def test_undismiss_cross_factory_returns_404_not_403(self):
        """Cross-factory delete attempt returns 404 (security-by-obscurity, not 403)."""
        app = _build_app()
        client = TestClient(app)

        # F001 admin tries to delete; row is F002's so RLS hides it
        mock_pool = AsyncMock()
        mock_conn = AsyncMock()
        mock_conn.execute = AsyncMock(return_value=None)
        # RLS-blocked → fetchrow returns None
        mock_conn.fetchrow = AsyncMock(return_value=None)
        mock_conn.transaction = MagicMock()
        mock_conn.transaction.return_value.__aenter__ = AsyncMock(return_value=None)
        mock_conn.transaction.return_value.__aexit__ = AsyncMock(return_value=None)
        mock_pool.acquire = MagicMock()
        mock_pool.acquire.return_value.__aenter__ = AsyncMock(return_value=mock_conn)
        mock_pool.acquire.return_value.__aexit__ = AsyncMock(return_value=None)

        with patch('smartbi.config.get_pg_pool', new=AsyncMock(return_value=mock_pool)):
            r = client.delete(
                '/api/restaurant/outliers/dismiss/9999',
                headers={'x-role': 'factory_super_admin', 'x-factory-id': 'F001'},
            )

        # Must be 404, NOT 403 — don't leak existence
        assert r.status_code == 404
        assert r.status_code != 403
