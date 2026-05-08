"""Mock-driven 4-state tests for _get_sales_overview flag-gated dispatch.

Companion to PR #146 K-1 finding (Pattern B sister-endpoint scan) — verifies
that _get_sales_overview now reads SMARTBI_GOLD_READ_PRIMARY_ENABLED and
mirrors the 3-state branching baked into _get_finance_overview by PR #135.

States verified (mirror Java SalesAnalysisServiceImpl line 80-175):
  - State A: flag=true, Gold populated → return Gold dashboard
  - State B: flag=true, Gold returns None → return empty dashboard, SKIP legacy
  - State C (flag-false): flag=false → STRAIGHT to legacy (Gold path NOT entered)
  - State C (flag-true exception): flag=true, Gold raises → fall through to legacy

Tests are mock-driven (no DB, no real Gold service). Goldens for byte-shape
parity tests would be PR-C scope per PR #135 model.
"""
from __future__ import annotations

import os
import sys
from datetime import date
from pathlib import Path
from unittest.mock import AsyncMock, patch

import pytest

# JWT_SECRET must be set BEFORE importing production code
JWT_SECRET = "test-secret-for-phase2a-do-not-use-in-prod"
os.environ["JWT_SECRET"] = JWT_SECRET

REPO_ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(REPO_ROOT / "backend" / "python"))

from smartbi_compat.api.analysis_sales import _get_sales_overview  # noqa: E402
from smartbi_compat.date_range import DateRange  # noqa: E402


@pytest.fixture
def date_range():
    return DateRange.custom(date(2025, 1, 1), date(2025, 12, 31))


# Sentinel return values to verify which path executed.
GOLD_DASHBOARD_SENTINEL = {"_state": "A_gold_populated", "kpiCards": [{"key": "x"}]}
LEGACY_DASHBOARD_SENTINEL = {"_state": "C_legacy_populated", "kpiCards": [{"key": "y"}]}


class TestSalesOverviewFlagGate:
    """Mock-driven 4-state dispatch verification."""

    @pytest.mark.asyncio
    async def test_state_a_flag_true_gold_populated(self, date_range, monkeypatch):
        """Flag=true + Gold returns non-None dict → return Gold response,
        legacy path NOT called.
        """
        monkeypatch.setenv("SMARTBI_GOLD_READ_PRIMARY_ENABLED", "true")

        gold_mock = AsyncMock(return_value=GOLD_DASHBOARD_SENTINEL)
        legacy_mock = AsyncMock(return_value=LEGACY_DASHBOARD_SENTINEL)

        with patch(
            "smartbi.config.get_pg_pool", new=AsyncMock(return_value=None)
        ), patch(
            "smartbi_compat.api.analysis_sales._build_from_gold_with_charts", new=gold_mock
        ), patch(
            "smartbi_compat.api.analysis_sales._build_legacy_sales_overview", new=legacy_mock
        ):
            result = await _get_sales_overview("F001", date_range)

        assert result == GOLD_DASHBOARD_SENTINEL, "State A should return Gold dashboard"
        gold_mock.assert_awaited_once()
        legacy_mock.assert_not_awaited()

    @pytest.mark.asyncio
    async def test_state_b_flag_true_gold_empty(self, date_range, monkeypatch):
        """Flag=true + Gold returns None → return empty dashboard,
        legacy path NOT called (Java line 105-107 mirror).
        """
        monkeypatch.setenv("SMARTBI_GOLD_READ_PRIMARY_ENABLED", "true")

        gold_mock = AsyncMock(return_value=None)  # Gold null = Silver empty
        legacy_mock = AsyncMock(return_value=LEGACY_DASHBOARD_SENTINEL)

        with patch(
            "smartbi.config.get_pg_pool", new=AsyncMock(return_value=None)
        ), patch(
            "smartbi_compat.api.analysis_sales._build_from_gold_with_charts", new=gold_mock
        ), patch(
            "smartbi_compat.api.analysis_sales._build_legacy_sales_overview", new=legacy_mock
        ):
            result = await _get_sales_overview("F999", date_range)

        # Empty dashboard from _build_empty_dashboard — verify shape, not exact
        # content (subject to PR #135-style empty envelope structure).
        assert isinstance(result, dict), "State B should return a dict"
        assert result.get("_state") != "C_legacy_populated", \
            "State B must NOT fall through to legacy"
        gold_mock.assert_awaited_once()
        legacy_mock.assert_not_awaited()

    @pytest.mark.asyncio
    async def test_state_c_flag_false_goes_straight_to_legacy(self, date_range, monkeypatch):
        """Flag=false → legacy is called directly, Gold path NOT entered
        (mirror Java line 87 `if` skipped, fall through to line 114+).
        """
        monkeypatch.setenv("SMARTBI_GOLD_READ_PRIMARY_ENABLED", "false")

        gold_mock = AsyncMock(return_value=GOLD_DASHBOARD_SENTINEL)
        legacy_mock = AsyncMock(return_value=LEGACY_DASHBOARD_SENTINEL)

        with patch(
            "smartbi.config.get_pg_pool", new=AsyncMock(return_value=None)
        ), patch(
            "smartbi_compat.api.analysis_sales._build_from_gold_with_charts", new=gold_mock
        ), patch(
            "smartbi_compat.api.analysis_sales._build_legacy_sales_overview", new=legacy_mock
        ):
            result = await _get_sales_overview("F001", date_range)

        assert result == LEGACY_DASHBOARD_SENTINEL, "State C should return legacy dashboard"
        gold_mock.assert_not_awaited()  # ← CRITICAL: Gold path skipped
        legacy_mock.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_state_c_flag_true_gold_raises_falls_back(self, date_range, monkeypatch):
        """Flag=true + Gold raises Exception → fall through to legacy
        (mirror Java line 108-111 catch).
        """
        monkeypatch.setenv("SMARTBI_GOLD_READ_PRIMARY_ENABLED", "true")

        gold_mock = AsyncMock(side_effect=RuntimeError("simulated Gold failure"))
        legacy_mock = AsyncMock(return_value=LEGACY_DASHBOARD_SENTINEL)

        with patch(
            "smartbi.config.get_pg_pool", new=AsyncMock(return_value=None)
        ), patch(
            "smartbi_compat.api.analysis_sales._build_from_gold_with_charts", new=gold_mock
        ), patch(
            "smartbi_compat.api.analysis_sales._build_legacy_sales_overview", new=legacy_mock
        ):
            result = await _get_sales_overview("F001", date_range)

        assert result == LEGACY_DASHBOARD_SENTINEL, \
            "State C (flag=true Gold throws) should fall back to legacy"
        gold_mock.assert_awaited_once()
        legacy_mock.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_pool_acquisition_failure_falls_back_to_legacy(self, date_range, monkeypatch):
        """Flag=true + get_pg_pool raises → fall through to legacy.

        Defensive coverage for Python-side pool failure (Java doesn't have
        this path because Spring wires GoldDashboardBuilder via DI — Python
        gets it via lazy import which can fail at runtime).
        """
        monkeypatch.setenv("SMARTBI_GOLD_READ_PRIMARY_ENABLED", "true")

        legacy_mock = AsyncMock(return_value=LEGACY_DASHBOARD_SENTINEL)
        pool_mock = AsyncMock(side_effect=ConnectionError("simulated pool failure"))
        gold_mock = AsyncMock(return_value=GOLD_DASHBOARD_SENTINEL)

        with patch("smartbi.config.get_pg_pool", new=pool_mock), patch(
            "smartbi_compat.api.analysis_sales._build_from_gold_with_charts", new=gold_mock
        ), patch(
            "smartbi_compat.api.analysis_sales._build_legacy_sales_overview", new=legacy_mock
        ):
            result = await _get_sales_overview("F001", date_range)

        assert result == LEGACY_DASHBOARD_SENTINEL, \
            "Pool acquisition failure should fall back to legacy"
        gold_mock.assert_not_awaited()  # never reached because pool failed first
        legacy_mock.assert_awaited_once()


class TestSalesOverviewFlagParsing:
    """Verify flag string parsing matches PR #135 finance dispatcher exactly."""

    @pytest.mark.asyncio
    async def test_flag_unset_defaults_to_false(self, date_range, monkeypatch):
        """No env var set → behave as flag=false (legacy path).

        Mirrors Java @Value("${smartbi.gold.read-primary.enabled:false}").
        """
        monkeypatch.delenv("SMARTBI_GOLD_READ_PRIMARY_ENABLED", raising=False)

        gold_mock = AsyncMock(return_value=GOLD_DASHBOARD_SENTINEL)
        legacy_mock = AsyncMock(return_value=LEGACY_DASHBOARD_SENTINEL)

        with patch(
            "smartbi.config.get_pg_pool", new=AsyncMock(return_value=None)
        ), patch(
            "smartbi_compat.api.analysis_sales._build_from_gold_with_charts", new=gold_mock
        ), patch(
            "smartbi_compat.api.analysis_sales._build_legacy_sales_overview", new=legacy_mock
        ):
            result = await _get_sales_overview("F001", date_range)

        assert result == LEGACY_DASHBOARD_SENTINEL
        gold_mock.assert_not_awaited()

    @pytest.mark.asyncio
    @pytest.mark.parametrize("raw_value", ["TRUE", "True", " true ", "true"])
    async def test_flag_true_variants_normalize_correctly(self, date_range, monkeypatch, raw_value):
        """`"TRUE"` / `"True"` / `" true "` / `"true"` all enable Gold path.

        Mirrors `flag_raw.strip().lower() == "true"` parsing in _get_finance_overview.
        """
        monkeypatch.setenv("SMARTBI_GOLD_READ_PRIMARY_ENABLED", raw_value)

        gold_mock = AsyncMock(return_value=GOLD_DASHBOARD_SENTINEL)
        legacy_mock = AsyncMock(return_value=LEGACY_DASHBOARD_SENTINEL)

        with patch(
            "smartbi.config.get_pg_pool", new=AsyncMock(return_value=None)
        ), patch(
            "smartbi_compat.api.analysis_sales._build_from_gold_with_charts", new=gold_mock
        ), patch(
            "smartbi_compat.api.analysis_sales._build_legacy_sales_overview", new=legacy_mock
        ):
            result = await _get_sales_overview("F001", date_range)

        assert result == GOLD_DASHBOARD_SENTINEL, f"raw_value={raw_value!r} should enable Gold"
        gold_mock.assert_awaited_once()

    @pytest.mark.asyncio
    @pytest.mark.parametrize("raw_value", ["FALSE", "False", " false ", "0", "no", "", "yes"])
    async def test_flag_non_true_variants_disable_gold(self, date_range, monkeypatch, raw_value):
        """Anything other than `"true"` (case/space-insensitive) → legacy path.

        Notably "yes" / "1" / "on" are NOT recognized — only literal "true"
        per PR #135 parsing rule.
        """
        monkeypatch.setenv("SMARTBI_GOLD_READ_PRIMARY_ENABLED", raw_value)

        gold_mock = AsyncMock(return_value=GOLD_DASHBOARD_SENTINEL)
        legacy_mock = AsyncMock(return_value=LEGACY_DASHBOARD_SENTINEL)

        with patch(
            "smartbi.config.get_pg_pool", new=AsyncMock(return_value=None)
        ), patch(
            "smartbi_compat.api.analysis_sales._build_from_gold_with_charts", new=gold_mock
        ), patch(
            "smartbi_compat.api.analysis_sales._build_legacy_sales_overview", new=legacy_mock
        ):
            result = await _get_sales_overview("F001", date_range)

        assert result == LEGACY_DASHBOARD_SENTINEL, \
            f"raw_value={raw_value!r} should NOT enable Gold"
        gold_mock.assert_not_awaited()
