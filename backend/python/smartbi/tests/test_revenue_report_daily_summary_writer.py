"""Tests for canonical.silver_writers.daily_summary_writer (stub).

Spec: §5.1 / §6.7 — revised Phase C: 营业概况报表 stub (redundant with bill_flow path).
"""
from unittest.mock import MagicMock

import pytest

from smartbi.canonical.silver_writers.base import WriteSummary
from smartbi.canonical.silver_writers.daily_summary_writer import (
    DailySummaryWriter,
)


@pytest.mark.asyncio
async def test_stub_returns_empty_write_summary():
    writer = DailySummaryWriter(pool=MagicMock(), orchestrator=MagicMock())
    summary = await writer.write(upload_id=123, factory_id="R_QINGHUAJIAO_REAL")
    assert isinstance(summary, WriteSummary)
    assert summary.rows_written == 0
    assert summary.rows_skipped == 0
    assert summary.new_entity_count == 0


@pytest.mark.asyncio
async def test_stub_logs_warning(caplog):
    import logging
    writer = DailySummaryWriter(pool=MagicMock(), orchestrator=MagicMock())
    with caplog.at_level(logging.WARNING):
        await writer.write(upload_id=42, factory_id="R_QINGHUAJIAO_REAL")
    assert any(
        "DailySummaryWriter stub" in r.message and "upload_id=42" in r.message
        for r in caplog.records
    )
