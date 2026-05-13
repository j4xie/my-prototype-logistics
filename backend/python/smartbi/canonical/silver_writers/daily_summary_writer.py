"""DailySummaryWriter — stub for 二维火 '营业概况报表' uploads.

Phase C scope decision (revised 2026-05-13):
  二维火 营业概况报表 is store × day pre-aggregated. For the QHJ revenue report
  feature, the same data is recoverable from 详细日报表 → bill_flow_writer →
  fact_pos_transaction (bill-level) → materialize_daily_order_type_meal()
  (Gold aggregation). So 营业概况报表 is REDUNDANT for Block 1-4 computation.

  pos_router still routes uploads of 营业概况报表.csv here to keep filename
  matching valid (no 422 on customer upload). This stub logs the upload and
  returns an empty WriteSummary. No Silver writes happen.

  If customer later supplies 营业概况报表 WITHOUT 详细日报表 (e.g. for a period
  pre-2024 lacking bill-level export), real implementation can replace this
  stub — read smart_bi_dynamic_data rows by upload_id, write synthetic bills
  to fact_pos_transaction.

Spec: docs/qa-specs/2026-05-12-qhj-revenue-report-design.md §5.1 + §6.7
Plan: docs/superpowers/plans/2026-05-12-qhj-revenue-report.md Task C1 (revised)
"""
from __future__ import annotations

import logging

from .base import BaseWriter, WriteSummary

logger = logging.getLogger(__name__)


class DailySummaryWriter(BaseWriter):
    """Stub: logs upload, returns empty WriteSummary. See module docstring."""

    async def write(self, upload_id: int, factory_id: str) -> WriteSummary:
        logger.warning(
            "DailySummaryWriter stub invoked (upload_id=%s, factory_id=%s). "
            "营业概况报表 ingestion deferred to Phase 2; data available via "
            "详细日报表 + bill_flow_writer instead.",
            upload_id, factory_id,
        )
        return WriteSummary(
            rows_written=0,
            rows_skipped=0,
            new_entity_count=0,
            admin_queue_count=0,
            tentative_count=0,
            elapsed_ms=0,
        )
