"""test_hooks.py"""
import asyncio
import pytest
from unittest.mock import AsyncMock, patch

from smartbi.services.materialized_analytics.hooks import (
    schedule_materialization, _trigger_materialization,
)


@pytest.mark.asyncio
async def test_trigger_materialization_swallows_errors():
    """Hook never raises even if dependencies fail."""
    with patch("smartbi.config.get_pg_pool", new_callable=AsyncMock, side_effect=RuntimeError("boom")):
        # Must not raise
        await _trigger_materialization(upload_id=999)


@pytest.mark.asyncio
async def test_trigger_materialization_handles_no_pool():
    """When pool is None, logs warning and returns cleanly."""
    with patch("smartbi.config.get_pg_pool", new_callable=AsyncMock, return_value=None):
        await _trigger_materialization(upload_id=999)  # no exception


def test_schedule_without_loop_returns_none():
    """Called from sync context with no running loop → returns None, no crash."""
    task = schedule_materialization(upload_id=123)
    assert task is None


@pytest.mark.asyncio
async def test_schedule_with_loop_returns_task():
    """In async context, returns a Task that can be awaited."""
    with patch("smartbi.config.get_pg_pool", new_callable=AsyncMock, return_value=None):
        task = schedule_materialization(upload_id=123)
        assert task is not None
        assert isinstance(task, asyncio.Task)
        await task  # should complete cleanly
