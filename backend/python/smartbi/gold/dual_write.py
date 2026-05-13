"""Phase A dual-write helper — safe-to-fail Silver+Gold ingest alongside
the legacy smart_bi_dynamic_data path.

Week 4 wire-in of Unified Data Layer v1 spec (§2.4 Phase A).

Purpose
-------
After the legacy streaming worker finishes writing an upload to
smart_bi_dynamic_data (upload_status=COMPLETED), this helper reads those
freshly-written rows back and pushes them through
scripts.backfill_silver → gold.pipeline.ingest_and_materialize.

Design constraints
------------------
- **Must not affect legacy status.** Legacy path is the source of truth
  during Phase A. Silver failure here is logged and swallowed; upload
  stays COMPLETED regardless.
- **Gated by env var SMARTBI_ENABLE_SILVER_DUAL_WRITE.** Default off.
  Flip to "1"/"true"/"yes" to activate for all new uploads.
- **Owns pool lifecycle.** Creates a small asyncpg pool scoped to this
  one upload; closes in finally. Doesn't share the app's main pool
  because this function may run on a worker thread's fresh event loop
  (excel_async uses asyncio.run per BG task).
- **Idempotent.** If dual-write runs twice for the same upload (e.g.
  manual re-trigger), Silver ON CONFLICT DO NOTHING makes it safe.

Wire-in example (in excel_async.py after schedule_materialization):
    if silver_dual_write_enabled():
        await run_silver_dual_write(factory_id=upload.factory_id,
                                    upload_id=upload.id)
"""
from __future__ import annotations

import logging
import os
import sys
from pathlib import Path
from typing import Optional

import asyncpg

logger = logging.getLogger(__name__)


_ENABLED_VALUES = frozenset({"1", "true", "yes", "on"})


def silver_dual_write_enabled() -> bool:
    """Check env flag. Inlined for cheap repeated lookup."""
    val = os.environ.get("SMARTBI_ENABLE_SILVER_DUAL_WRITE", "").strip().lower()
    return val in _ENABLED_VALUES


def _ensure_scripts_on_path() -> None:
    """scripts/ isn't a package; add it to sys.path exactly once so
    `from backfill_silver import backfill_upload` works."""
    scripts_dir = Path(__file__).resolve().parent.parent.parent / "scripts"
    sd_str = str(scripts_dir)
    if scripts_dir.is_dir() and sd_str not in sys.path:
        sys.path.insert(0, sd_str)


async def run_silver_dual_write(
    factory_id: str,
    upload_id: int,
    *,
    source_type: str = "excel",
) -> Optional[object]:
    """Run Phase A dual-write for one upload. Returns BackfillStats on
    success, None on any failure (always logged). Never raises."""
    if not silver_dual_write_enabled():
        return None

    try:
        _ensure_scripts_on_path()
        from backfill_silver import backfill_upload  # noqa: E402
        from smartbi.config import get_settings
        from smartbi.tenant_ctx import set_factory_id, set_pg_connection_tenant, reset_factory_id

        settings = get_settings()
        if not settings.postgres_url:
            logger.warning(
                "[silver-dual-write] no postgres_url configured; skipping upload=%d",
                upload_id,
            )
            return None

        pool = await asyncpg.create_pool(
            settings.postgres_url,
            min_size=1, max_size=2,
            setup=set_pg_connection_tenant,
        )
        token = set_factory_id(factory_id)
        try:
            stats = await backfill_upload(
                pool, upload_id=upload_id,
                factory_id=factory_id, source_type=source_type,
            )
            pipeline = stats.pipeline
            logger.info(
                "[silver-dual-write] upload=%d factory=%s "
                "read=%d skipped=%d queued=%d silver_txn=%d silver_items=%d "
                "silver_dup=%d gold_upserts=%d",
                upload_id, factory_id,
                stats.rows_read, stats.rows_skipped_missing_required,
                stats.rows_queued,
                pipeline.normalize.transactions_written if pipeline else 0,
                pipeline.normalize.items_written if pipeline else 0,
                pipeline.normalize.duplicates_skipped if pipeline else 0,
                pipeline.trigger.total_rows_upserted if pipeline else 0,
            )

            # Task D2 — QHJ revenue report Gold aggregator.
            # After bills land in fact_pos_transaction, refresh
            # agg_daily_order_type_meal for the just-inserted date range.
            # Cache_key (revenue_report:...:{computed_at}) flips on the UPSERT,
            # so the next /generate or /prepare returns fresh data.
            await _materialize_qhj_revenue_gold(
                pool, factory_id, upload_id,
            )

            return stats
        finally:
            reset_factory_id(token)
            await pool.close()
    except Exception as e:
        logger.warning(
            "[silver-dual-write] upload=%d factory=%s failed: %s",
            upload_id, factory_id, e,
            exc_info=True,
        )
        return None


async def _materialize_qhj_revenue_gold(
    pool: "asyncpg.Pool",
    factory_id: str,
    upload_id: int,
) -> None:
    """Refresh agg_daily_order_type_meal for the upload's actual date range.

    Spec §6.7 / Task D2. Reads min/max date from fact_pos_transaction WHERE
    upload_id = $1, then calls materialize_daily_order_type_meal() for that
    window. Never raises — Gold refresh failure must not affect dual-write
    success.
    """
    try:
        async with pool.acquire() as conn:
            row = await conn.fetchrow(
                """
                SELECT MIN(date) AS min_date, MAX(date) AS max_date
                FROM fact_pos_transaction
                WHERE upload_id = $1 AND factory_id = $2
                """,
                upload_id, factory_id,
            )
        if not row or row["min_date"] is None or row["max_date"] is None:
            logger.debug(
                "[qhj-gold] upload=%d factory=%s: no fact rows, skip aggregator",
                upload_id, factory_id,
            )
            return

        from smartbi.services.materialized_analytics.daily_order_type_meal import (
            materialize_daily_order_type_meal,
        )
        affected = await materialize_daily_order_type_meal(
            pool, factory_id, row["min_date"], row["max_date"],
        )
        logger.info(
            "[qhj-gold] upload=%d factory=%s: agg_daily_order_type_meal "
            "upserts=%d range=[%s..%s]",
            upload_id, factory_id, affected, row["min_date"], row["max_date"],
        )
    except Exception as e:
        logger.warning(
            "[qhj-gold] upload=%d factory=%s aggregator failed (non-fatal): %s",
            upload_id, factory_id, e, exc_info=True,
        )
