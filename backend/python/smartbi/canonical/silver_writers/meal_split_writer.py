"""MealSplitWriter — stub for 二维火 '堂食外卖占比表' uploads.

Phase C scope decision (revised 2026-05-13):
  二维火 堂食外卖占比表 is period × store × order_type pre-aggregated. The
  same dine-in/takeout split is recoverable at finer grain from 详细日报表's
  订单类型 column → fact_pos_transaction.order_type → Block 3 SQL aggregates.
  So this writer is REDUNDANT for the QHJ revenue report.

  pos_router still routes 堂食外卖占比表.csv uploads here to keep filename
  matching valid. This stub logs the upload and returns empty WriteSummary.

  Future implementation (Phase 2) could read smart_bi_dynamic_data rows by
  upload_id, parse the multi-section header layout (3 skip rows + nested
  汇总/堂食/外卖 column groups), and emit period-level synthetic rows.

Spec: docs/qa-specs/2026-05-12-qhj-revenue-report-design.md §5.1 + §6.4
Plan: docs/superpowers/plans/2026-05-12-qhj-revenue-report.md Task C2 (revised)
"""
from __future__ import annotations

import logging

from .base import BaseWriter, WriteSummary

logger = logging.getLogger(__name__)


class MealSplitWriter(BaseWriter):
    """Stub: logs upload, returns empty WriteSummary. See module docstring."""

    async def write(self, upload_id: int, factory_id: str) -> WriteSummary:
        logger.warning(
            "MealSplitWriter stub invoked (upload_id=%s, factory_id=%s). "
            "堂食外卖占比表 ingestion deferred to Phase 2; same data available "
            "via 详细日报表.order_type + bill_flow_writer.",
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
