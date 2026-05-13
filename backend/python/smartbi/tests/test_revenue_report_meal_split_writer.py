"""Tests for canonical.silver_writers.meal_split_writer (stub)."""
import logging
from unittest.mock import MagicMock

import pytest

from smartbi.canonical.silver_writers.base import WriteSummary
from smartbi.canonical.silver_writers.meal_split_writer import (
    MealSplitWriter,
)


@pytest.mark.asyncio
async def test_stub_returns_empty_write_summary():
    writer = MealSplitWriter(pool=MagicMock(), orchestrator=MagicMock())
    summary = await writer.write(upload_id=99, factory_id="R_QINGHUAJIAO_REAL")
    assert isinstance(summary, WriteSummary)
    assert summary.rows_written == 0


@pytest.mark.asyncio
async def test_stub_logs_warning(caplog):
    writer = MealSplitWriter(pool=MagicMock(), orchestrator=MagicMock())
    with caplog.at_level(logging.WARNING):
        await writer.write(upload_id=7, factory_id="R_QINGHUAJIAO_REAL")
    assert any("MealSplitWriter stub" in r.message for r in caplog.records)
