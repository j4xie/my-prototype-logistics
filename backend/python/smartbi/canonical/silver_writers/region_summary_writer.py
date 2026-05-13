"""RegionSummaryWriter — stub for 二维火 '区域销售报表' uploads.

Phase C scope decision (revised 2026-05-13):
  区域销售报表 (region × period grain) is out-of-scope for the QHJ revenue
  report (which is store-level). No Gold table for region aggregation
  exists. Phase 2 candidate: add agg_region Gold table + real region
  ingestion if customer asks for region-level analysis.

  This stub keeps pos_router dispatch valid so customer uploads don't 422.

Spec: docs/qa-specs/2026-05-12-qhj-revenue-report-design.md §5.1 + §11.7
Plan: docs/superpowers/plans/2026-05-12-qhj-revenue-report.md Task C3 (revised)
"""
from __future__ import annotations

import logging

from .base import BaseWriter, WriteSummary

logger = logging.getLogger(__name__)


class RegionSummaryWriter(BaseWriter):
    """Stub: logs upload, returns empty WriteSummary. See module docstring."""

    async def write(self, upload_id: int, factory_id: str) -> WriteSummary:
        logger.warning(
            "RegionSummaryWriter stub invoked (upload_id=%s, factory_id=%s). "
            "区域销售报表 ingestion is Phase 2 — no agg_region Gold table yet.",
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
