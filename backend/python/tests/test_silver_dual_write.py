"""Tests for smartbi.gold.dual_write — Phase A feature-flag guard.

Week 4 wire-in of Unified Data Layer v1 spec.

Focuses on the safety contract (flag off → no-op, failure → swallowed).
The backfill code path itself is exercised by test_backfill_silver.py.
"""
from __future__ import annotations

import os
from unittest.mock import patch

import pytest

from smartbi.gold.dual_write import (
    run_silver_dual_write,
    silver_dual_write_enabled,
)


# ── env flag ─────────────────────────────────────────────────

def test_disabled_by_default(monkeypatch):
    monkeypatch.delenv("SMARTBI_ENABLE_SILVER_DUAL_WRITE", raising=False)
    assert silver_dual_write_enabled() is False


@pytest.mark.parametrize("value", ["1", "true", "True", "YES", "on", " 1 "])
def test_enabled_values(monkeypatch, value):
    monkeypatch.setenv("SMARTBI_ENABLE_SILVER_DUAL_WRITE", value)
    assert silver_dual_write_enabled() is True


@pytest.mark.parametrize("value", ["0", "false", "no", "off", "", "random"])
def test_disabled_values(monkeypatch, value):
    monkeypatch.setenv("SMARTBI_ENABLE_SILVER_DUAL_WRITE", value)
    assert silver_dual_write_enabled() is False


# ── behavior when disabled ───────────────────────────────────

@pytest.mark.asyncio
async def test_run_returns_none_when_flag_disabled(monkeypatch):
    monkeypatch.delenv("SMARTBI_ENABLE_SILVER_DUAL_WRITE", raising=False)
    result = await run_silver_dual_write(factory_id="F001", upload_id=999)
    assert result is None


# ── failure paths swallowed ──────────────────────────────────

@pytest.mark.asyncio
async def test_run_swallows_missing_postgres_url(monkeypatch):
    """When postgres_url isn't configured, function logs + returns None,
    doesn't raise. Legacy upload status unaffected."""
    monkeypatch.setenv("SMARTBI_ENABLE_SILVER_DUAL_WRITE", "1")

    # Patch get_settings to return a settings object with no postgres_url.
    class _FakeSettings:
        postgres_url = ""

    with patch("smartbi.config.get_settings", return_value=_FakeSettings()):
        result = await run_silver_dual_write(factory_id="F001", upload_id=999)
    assert result is None


@pytest.mark.asyncio
async def test_run_swallows_unknown_upload(monkeypatch):
    """When the upload doesn't exist in smart_bi_pg_excel_uploads,
    backfill raises ValueError internally — run_silver_dual_write catches
    it and returns None."""
    monkeypatch.setenv("SMARTBI_ENABLE_SILVER_DUAL_WRITE", "1")
    from smartbi.config import get_settings
    settings = get_settings()
    if not settings.postgres_url:
        pytest.skip("No Postgres configured")
    # upload_id 8_888_888 almost certainly doesn't exist
    result = await run_silver_dual_write(
        factory_id="NONEXISTENT_FACTORY_XYZ", upload_id=8_888_888,
    )
    assert result is None  # swallowed, not raised
