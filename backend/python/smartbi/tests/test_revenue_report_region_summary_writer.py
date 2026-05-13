"""Tests for canonical.silver_writers.region_summary_writer (stub)."""
import logging
from unittest.mock import MagicMock

import pytest

from smartbi.canonical.silver_writers.base import WriteSummary
from smartbi.canonical.silver_writers.region_summary_writer import (
    RegionSummaryWriter,
)


@pytest.mark.asyncio
async def test_stub_returns_empty_write_summary():
    writer = RegionSummaryWriter(pool=MagicMock(), orchestrator=MagicMock())
    summary = await writer.write(upload_id=11, factory_id="R_QINGHUAJIAO_REAL")
    assert isinstance(summary, WriteSummary)
    assert summary.rows_written == 0


@pytest.mark.asyncio
async def test_stub_logs_warning(caplog):
    writer = RegionSummaryWriter(pool=MagicMock(), orchestrator=MagicMock())
    with caplog.at_level(logging.WARNING):
        await writer.write(upload_id=22, factory_id="R_QINGHUAJIAO_REAL")
    assert any("RegionSummaryWriter stub" in r.message for r in caplog.records)
