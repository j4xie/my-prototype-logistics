"""Fire-and-forget materialization trigger for upload completion.

Separate module so excel_async.py can import without circular deps.
"""
from __future__ import annotations

import asyncio
import logging
import time
from typing import Optional

logger = logging.getLogger(__name__)


async def _trigger_materialization(upload_id: int) -> None:
    """Internal: run materialize + persist. Swallow all errors."""
    try:
        from smartbi.config import get_pg_pool
        from smartbi.services.materialized_analytics.materializer import (
            build_schema, materialize_upload,
        )
        from smartbi.services.materialized_analytics.persistence import (
            save_materialization_results,
        )
        from smartbi.services.materialized_analytics.schema import Domain

        pool = await get_pg_pool()
        if pool is None:
            logger.warning(f"[hook] upload {upload_id}: no pool, skipping materialization")
            return

        t0 = time.time()
        # out_ctx captures the in-memory backend so we can piggyback the
        # aggregate compute on the same polars DataFrame (avoids a 30-70s
        # second pass of JSONB scans).
        materialize_ctx: dict = {}
        results = await materialize_upload(pool, upload_id, _out_ctx=materialize_ctx)

        # Derive domain + factory_id from upload / field_defs
        async with pool.acquire() as conn:
            upload_row = await conn.fetchrow(
                "SELECT factory_id, row_count FROM smart_bi_pg_excel_uploads WHERE id = $1",
                upload_id
            )
            if upload_row is None:
                logger.warning(f"[hook] upload {upload_id} vanished before materialization")
                return
            field_rows = await conn.fetch(
                """SELECT original_name, is_measure, is_dimension, is_time
                   FROM smart_bi_pg_field_definitions WHERE upload_id = $1
                   ORDER BY display_order""",
                upload_id
            )

        factory_id = upload_row['factory_id']
        field_meta = [dict(r) for r in field_rows]
        if field_meta:
            schema = build_schema(
                upload_id, factory_id, field_meta, upload_row['row_count'] or 0
            )
            domain_value = schema.domain.value
        else:
            domain_value = Domain.UNKNOWN.value

        saved = await save_materialization_results(
            pool, upload_id, factory_id, domain_value, results
        )
        applied = sum(1 for r in results if r.applies)
        logger.info(
            f"[hook] upload {upload_id}: materialized "
            f"{applied}/{len(results)} templates, saved {saved}, "
            f"domain={domain_value}, wall={time.time() - t0:.1f}s"
        )

        # Also pre-warm the L2 aggregate cache used by the LLM fallback path
        # in chat.py. We piggyback on the polars DataFrame that materialize
        # already built — polars in-memory aggregation runs in ~1s vs ~30-70s
        # for the SQL path. Falls back to the SQL compute if the backend
        # didn't make it into out_ctx for any reason.
        try:
            from smartbi.services.upload_aggregate_cache import (
                compute_aggregates_from_polars,
                compute_upload_aggregates,
                save_bundle_to_db,
                get_cache,
            )
            backend = materialize_ctx.get("backend")
            mat_field_meta = materialize_ctx.get("field_meta") or field_meta
            if backend is not None and mat_field_meta:
                bundle = compute_aggregates_from_polars(
                    backend, mat_field_meta, sample_size=0
                )
                get_cache().set(upload_id, bundle)
                await save_bundle_to_db(pool, upload_id, bundle, factory_id=factory_id)
                logger.info(
                    f"[hook] upload {upload_id}: L2 agg cache warmed via polars "
                    f"in {bundle.get('compute_time_s', 0):.2f}s"
                )
                # Explicit release: drop polars DataFrame now that we've
                # harvested the bundle. Without this the backend stays alive
                # via the materialize_ctx dict reference, and polars' internal
                # arena (~200-500 MB on 200K rows) stays in RSS even after
                # this function returns.
                backend._df = None  # noqa: SLF001 — intentional drop
                materialize_ctx.clear()
                backend = None
            elif field_meta:
                # Fallback: the polars backend wasn't exposed (older build or
                # materialize skipped). Pay the SQL cost.
                async with pool.acquire() as conn:
                    bundle = await compute_upload_aggregates(
                        conn, pool, upload_id, field_meta, sample_size=0
                    )
                get_cache().set(upload_id, bundle)
                await save_bundle_to_db(pool, upload_id, bundle, factory_id=factory_id)
                logger.info(
                    f"[hook] upload {upload_id}: L2 agg cache warmed via SQL "
                    f"in {bundle.get('compute_time_s', 0):.1f}s (polars fallback)"
                )
        except Exception as warm_err:
            logger.warning(
                f"[hook] upload {upload_id}: L2 aggregate warm failed: {warm_err}"
            )

        # Final heap release: after templates + warm completed (or failed),
        # force gc + malloc_trim so the 200K-row polars arena and Python
        # object freelists return to the OS. Prevents process RSS from
        # growing unbounded across multiple uploads.
        try:
            from smartbi.services.memory_cleanup import release_and_trim
            release_and_trim(label=f"hook_upload_{upload_id}")
        except Exception as trim_err:
            logger.debug(f"[hook] memory trim skipped: {trim_err}")
    except Exception as e:
        # Fire-and-forget: never re-raise
        logger.error(
            f"[hook] upload {upload_id}: materialization failed: {e}",
            exc_info=True
        )


def schedule_materialization(upload_id: int) -> Optional[asyncio.Task]:
    """Kick off materialization in the background. Returns Task for testing.

    Safe to call from sync or async context — uses running event loop if
    available, otherwise logs and no-ops.
    """
    try:
        loop = asyncio.get_running_loop()
    except RuntimeError:
        logger.warning(
            f"[hook] upload {upload_id}: no running event loop, "
            "materialization skipped"
        )
        return None
    task = loop.create_task(_trigger_materialization(upload_id))
    return task
