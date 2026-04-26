"""BillFlowWriter — adapts backfill_silver.py:backfill_upload to BaseWriter."""
from __future__ import annotations

import time

from .base import BaseWriter, WriteSummary


class BillFlowWriter(BaseWriter):

    async def write(self, upload_id: int, factory_id: str) -> WriteSummary:
        from scripts.backfill_silver import backfill_upload

        t0 = time.time()
        stats = await backfill_upload(
            self._pool, upload_id=upload_id, factory_id=factory_id
        )
        return WriteSummary(
            rows_written=stats.rows_queued,
            rows_skipped=stats.rows_skipped_missing_required,
            new_entity_count=0,
            admin_queue_count=0,
            tentative_count=0,
            elapsed_ms=int((time.time() - t0) * 1000),
        )
