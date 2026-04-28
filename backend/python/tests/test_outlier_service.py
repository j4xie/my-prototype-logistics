"""Tests for OutlierService (Phase B-1) — local + fallback + insufficient paths."""
from __future__ import annotations
import pytest
from datetime import date, timedelta
from unittest.mock import AsyncMock, MagicMock, patch

from smartbi.services.outlier_service import (
    OutlierService, DetectedOutlier, DEFAULT_KPI_KINDS,
)


def _make_mock_conn(local_rows=None, global_row=None):
    """Helper: make AsyncMock connection that returns specified data."""
    conn = AsyncMock()
    conn.execute = AsyncMock(return_value=None)

    async def _fetch(query, *args):
        # _query_local hits agg_restaurant_daily_totals
        if 'agg_restaurant_daily_totals' in query:
            return local_rows or []
        return []

    async def _fetchrow(query, *args):
        # _query_global_baseline hits get_global_kpi_stats function
        if 'get_global_kpi_stats' in query:
            return global_row
        return None

    conn.fetch = _fetch
    conn.fetchrow = _fetchrow
    return conn


def _make_mock_pool(conn):
    """Helper: make AsyncMock pool that yields the given conn from acquire()."""
    pool = MagicMock()
    pool.acquire = MagicMock()
    # async with pool.acquire() as conn:
    pool.acquire.return_value.__aenter__ = AsyncMock(return_value=conn)
    pool.acquire.return_value.__aexit__ = AsyncMock(return_value=None)
    # async with conn.transaction():
    conn.transaction = MagicMock()
    conn.transaction.return_value.__aenter__ = AsyncMock(return_value=None)
    conn.transaction.return_value.__aexit__ = AsyncMock(return_value=None)
    return pool


class TestDetectTotalsLocalPath:
    @pytest.mark.asyncio
    async def test_local_n_above_threshold_uses_self_baseline(self):
        # Build 30-row local data with 1 obvious outlier
        rows = []
        for i in range(30):
            d = date.today() - timedelta(days=29 - i)
            value = 100.0 if i < 29 else 5000.0  # last row is outlier
            rows.append({'date': d, 'value': value})

        conn = _make_mock_conn(local_rows=rows)
        pool = _make_mock_pool(conn)

        with patch('smartbi.config.get_pg_pool', new=AsyncMock(return_value=pool)):
            svc = OutlierService()
            outliers, insufficient = await svc.detect_totals(
                'F002', window_days=30, kpi_kinds=['wastage_cost_total'],
            )

        # Should detect 5000.0 as outlier with baseline_source='self'
        assert any(o.value == 5000.0 and o.baseline_source == 'self' for o in outliers)
        assert insufficient == []


class TestDetectTotalsFallbackPath:
    @pytest.mark.asyncio
    async def test_local_n_below_threshold_falls_back_to_global(self):
        # Only 5 local rows (< 10 threshold)
        rows = [{'date': date.today() - timedelta(days=i), 'value': 8500.0}
                for i in range(5)]
        # Mock global baseline indicating wastage cost normal range
        global_row = {'q1': 1000.0, 'q3': 3000.0, 'median': 2000.0, 'n_bucket': '100-499'}

        conn = _make_mock_conn(local_rows=rows, global_row=global_row)
        pool = _make_mock_pool(conn)

        with patch('smartbi.config.get_pg_pool', new=AsyncMock(return_value=pool)):
            svc = OutlierService()
            outliers, insufficient = await svc.detect_totals(
                'R_NEW', window_days=30, kpi_kinds=['wastage_cost_total'],
            )

        # 8500 vs upper fence (3000 + 1.5*2000 = 6000) → outlier with baseline='global'
        assert any(o.value == 8500.0 and o.baseline_source == 'global' for o in outliers)
        assert any(o.baseline_n == '100-499' for o in outliers)
        assert insufficient == []


class TestDetectTotalsInsufficientPath:
    @pytest.mark.asyncio
    async def test_global_also_insufficient_returns_insufficient_kpi(self):
        rows = [{'date': date.today(), 'value': 8500.0}]    # 1 local row
        global_row = {'q1': None, 'q3': None, 'median': None, 'n_bucket': '<10'}

        conn = _make_mock_conn(local_rows=rows, global_row=global_row)
        pool = _make_mock_pool(conn)

        with patch('smartbi.config.get_pg_pool', new=AsyncMock(return_value=pool)):
            svc = OutlierService()
            outliers, insufficient = await svc.detect_totals(
                'R_NEW', window_days=30, kpi_kinds=['wastage_cost_total'],
            )

        assert outliers == []
        assert 'wastage_cost_total' in insufficient


class TestDetectPerDimNotImplemented:
    @pytest.mark.asyncio
    async def test_detect_per_dim_raises(self):
        svc = OutlierService()
        with pytest.raises(NotImplementedError, match="Phase B-N"):
            await svc.detect_per_dim('F002', 'wastage_cost', 1, 30)
