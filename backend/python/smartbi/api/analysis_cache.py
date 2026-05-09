"""
Analysis Cache API

Provides GET/POST/DELETE endpoints for persisting and retrieving
enrichment results (charts, KPIs, AI analysis) per upload_id.
Enables cache-first loading on the frontend (< 1s vs 30-40s).

Apr 25 2026 (Task C / PROD-1 fix): added /precompute-cache/{upload_id}
endpoint that computes the cheap part of enrichment (KPI summary via
quick_summary, no LLM) and persists as a "partial" enrichment_cache row.
Called by Java γ-2c afterCommit hook on every successful upload, so
200K-row uploads no longer hit the 120s axios timeout on first visit.
The full enrichment (LLM-driven charts + AI insights) still runs lazily
when the user opens the page, but KPIs render in <1s from the partial
cache while LLM enrichment proceeds in the background.

Apr 25 2026 (P3 architecture cleanup): extended the precompute helper to
ALSO populate smart_bi_pg_field_definitions.statistics with per-numeric-
column mean/min/max/sum stats, then re-run infer_agg_strategy with the
freshly populated stats so rating columns (星级分/口味分/服务分/...) get
'mean' agg_strategy in DB. Eliminates the empty-statistics regression
that forced the Apr 24 dual-source design (live-mean fallback in
compute_quick_summary, commit ce30773d9). Single-source-of-truth: the
DB column drives all agg decisions; the live fallback is now defense-
in-depth only.
"""

import json
import logging
from datetime import datetime
from typing import Any, Dict, List, Optional

from fastapi import APIRouter
from pydantic import BaseModel

from smartbi.database.connection import get_db_context, is_postgres_enabled
from smartbi.database.models import SmartBiPgAnalysisResult

logger = logging.getLogger(__name__)
router = APIRouter()


# ─── Request / Response Models ───────────────────────────────────

class SaveCacheRequest(BaseModel):
    factory_id: str
    charts: Optional[List[Dict[str, Any]]] = None
    kpiSummary: Optional[Dict[str, Any]] = None
    aiAnalysis: Optional[str] = None
    structuredAI: Optional[Dict[str, Any]] = None
    financialMetrics: Optional[Dict[str, Any]] = None


# ─── GET: Load cached enrichment result ──────────────────────────

@router.get("/analysis-cache/{upload_id}")
async def get_analysis_cache(upload_id: int):
    """
    Retrieve cached enrichment result for a given upload_id.
    Merges chart_recommendation + insight_generation + kpi_calculation records
    into a single response that matches the frontend EnrichResult shape.
    """
    if not is_postgres_enabled():
        return {"success": False, "cached": False, "message": "PostgreSQL not enabled"}

    try:
        with get_db_context() as db:
            rows = db.query(SmartBiPgAnalysisResult).filter(
                SmartBiPgAnalysisResult.upload_id == upload_id,
                SmartBiPgAnalysisResult.analysis_type.in_([
                    "enrichment_cache"
                ])
            ).all()

            if not rows:
                return {"success": False, "cached": False}

            # We store all enrichment data in a single "enrichment_cache" record
            row = rows[0]
            result = row.analysis_result or {}

            return {
                "success": True,
                "cached": True,
                "cachedAt": row.created_at.isoformat() if row.created_at else None,
                "charts": result.get("charts"),
                "kpiSummary": result.get("kpiSummary"),
                "aiAnalysis": result.get("aiAnalysis"),
                "structuredAI": result.get("structuredAI"),
                "financialMetrics": result.get("financialMetrics"),
                "chartConfig": result.get("chartConfig"),
                # Apr 25 2026 (Task C): pass-through partial-cache marker so FE
                # knows it should still kick off the LLM enrichment pipeline to
                # fill in charts / aiAnalysis / structuredAI after rendering KPIs.
                "_partial": bool(result.get("_partial")),
            }

    except Exception as e:
        logger.error(f"Failed to get analysis cache for upload {upload_id}: {e}", exc_info=True)
        return {"success": False, "cached": False, "message": "处理失败，请稍后重试"}


# ─── POST: Save enrichment result to cache ───────────────────────

@router.post("/analysis-cache/{upload_id}")
async def save_analysis_cache(upload_id: int, body: SaveCacheRequest):
    """
    Save a complete EnrichResult to the database.
    Uses a single 'enrichment_cache' analysis_type record with all data in JSONB.
    Upserts: replaces existing cache for the same upload_id.
    """
    if not is_postgres_enabled():
        return {"success": False, "message": "PostgreSQL not enabled"}

    try:
        # Build the JSONB payload
        payload: Dict[str, Any] = {}
        if body.charts:
            payload["charts"] = body.charts
            if body.charts:
                payload["chartConfig"] = body.charts[0].get("config")
        if body.kpiSummary:
            payload["kpiSummary"] = body.kpiSummary
        if body.aiAnalysis:
            payload["aiAnalysis"] = body.aiAnalysis
        if body.structuredAI:
            payload["structuredAI"] = body.structuredAI
        if body.financialMetrics:
            payload["financialMetrics"] = body.financialMetrics

        with get_db_context() as db:
            existing = db.query(SmartBiPgAnalysisResult).filter(
                SmartBiPgAnalysisResult.upload_id == upload_id,
                SmartBiPgAnalysisResult.analysis_type == "enrichment_cache"
            ).first()

            if existing:
                existing.analysis_result = payload
                existing.factory_id = body.factory_id
                existing.created_at = datetime.utcnow()
                logger.info(f"Updated enrichment cache for upload {upload_id}")
            else:
                record = SmartBiPgAnalysisResult(
                    factory_id=body.factory_id,
                    upload_id=upload_id,
                    analysis_type="enrichment_cache",
                    analysis_result=payload,
                )
                db.add(record)
                logger.info(f"Created enrichment cache for upload {upload_id}")

        return {"success": True}

    except Exception as e:
        logger.error(f"Failed to save analysis cache for upload {upload_id}: {e}", exc_info=True)
        return {"success": False, "message": "处理失败，请稍后重试"}


# ─── DELETE: Invalidate cache (for "refresh analysis") ──────────

@router.delete("/analysis-cache/{upload_id}")
async def delete_analysis_cache(upload_id: int):
    """
    Delete all cached enrichment results for an upload_id.
    Called when the user clicks "刷新分析" to force re-enrichment.
    """
    if not is_postgres_enabled():
        return {"success": False, "message": "PostgreSQL not enabled"}

    try:
        with get_db_context() as db:
            deleted = db.query(SmartBiPgAnalysisResult).filter(
                SmartBiPgAnalysisResult.upload_id == upload_id,
                SmartBiPgAnalysisResult.analysis_type == "enrichment_cache"
            ).delete()
            logger.info(f"Deleted {deleted} cache record(s) for upload {upload_id}")

        return {"success": True, "deleted": deleted}

    except Exception as e:
        logger.error(f"Failed to delete analysis cache for upload {upload_id}: {e}", exc_info=True)
        return {"success": False, "message": "处理失败，请稍后重试"}


# ─── Shared precompute helper (callable from materialized_analytics route) ──

async def precompute_enrichment_cache_for_upload(
    upload_id: int, factory_id: str
) -> Dict[str, Any]:
    """Pre-materialize KPI-only enrichment_cache for a given upload.

    Apr 25 2026 (Task C / PROD-1 fix). Idempotent. Pure compute (no LLM).
    Lives here next to the rest of the cache CRUD so the persistence
    shape stays consistent with save_analysis_cache. The HTTP route is
    on materialized_analytics.router (which is JWT/X-Factory-Id
    protected) — analysis_cache.router is in PUBLIC_PREFIXES so it
    cannot enforce tenant scope on its own.

    Apr 25 2026 (P3 architecture cleanup): also populates
    smart_bi_pg_field_definitions.statistics + re-runs infer_agg_strategy
    so 'mean' for rating cols ends up in DB rather than relying on the
    live fallback in compute_quick_summary. Order:
      1. compute_quick_summary (uses current persisted agg_strategy)
      2. extract per-numeric-col {mean, min, max, sum, nullCount, uniqueCount}
      3. UPDATE field_def.statistics (single transaction)
      4. re-run infer_agg_strategy(name, semantic_type, is_measure, statistics);
         UPDATE field_def.agg_strategy where it changed
      5. if any agg_strategy flipped, recompute summary so cached
         kpiSummary reflects the new aggregation choice
      6. persist enrichment_cache as before

    Returns the response body dict (success, cached, partial, ...).
    Caller is responsible for tenant gating (factory_id ↔ upload check).
    """
    if not is_postgres_enabled():
        return {"success": False, "message": "PostgreSQL not enabled"}

    # Lazy import to avoid circular deps at module load time.
    from smartbi.api.insight import (
        compute_quick_summary,
        _load_upload_data,
        _load_agg_strategy_map,
    )
    from smartbi.config import get_pg_pool
    from smartbi.services.field_classifier import infer_agg_strategy

    data = await _load_upload_data(upload_id)
    if not data:
        logger.info(f"[precompute-cache] upload {upload_id} has no data, skipping")
        return {
            "success": False,
            "cached": False,
            "message": "upload has no rows",
        }

    agg_by_name = await _load_agg_strategy_map(upload_id)

    # Pure compute — no LLM, no further DB I/O.
    summary = compute_quick_summary(data, agg_by_name)
    if not summary.get("success"):
        return {
            "success": False,
            "cached": False,
            "message": summary.get("message") or "summary failed",
        }

    # ── P3 cleanup: populate statistics + re-classify agg_strategy ───
    # Build a per-column stats map from compute_quick_summary's per-column
    # output. Only numeric columns have meaningful stats (mean/min/max);
    # non-numeric cols don't produce these keys so they're filtered out.
    stats_by_name: Dict[str, Dict[str, Any]] = {}
    for col_info in summary.get("columns", []):
        col_name = col_info.get("name")
        if not col_name:
            continue
        # Only persist when at least one numeric stat was produced.
        col_mean = col_info.get("mean")
        col_min = col_info.get("min")
        col_max = col_info.get("max")
        if col_mean is None and col_min is None and col_max is None:
            continue
        stats_by_name[col_name] = {
            "mean": col_mean,
            "min": col_min,
            "max": col_max,
            "sum": col_info.get("sum"),
            "nullCount": col_info.get("nullCount"),
            "uniqueCount": col_info.get("uniqueCount"),
        }

    agg_strategy_changes: List[Dict[str, Any]] = []
    new_agg_by_name = dict(agg_by_name)  # mutable copy for re-summary
    pool = await get_pg_pool() if stats_by_name else None
    if pool is not None and stats_by_name:
        try:
            # Load field_def rows once so we can both persist statistics and
            # re-derive agg_strategy in one round-trip per upload.
            async with pool.acquire() as conn:
                field_rows = await conn.fetch(
                    """SELECT original_name, field_type, semantic_type,
                              is_measure, agg_strategy
                       FROM smart_bi_pg_field_definitions
                       WHERE upload_id = $1""",
                    int(upload_id),
                )

                async with conn.transaction():
                    for fr in field_rows:
                        name = fr["original_name"]
                        if name not in stats_by_name:
                            continue
                        new_stats = stats_by_name[name]

                        # 1. Persist statistics JSONB
                        await conn.execute(
                            """UPDATE smart_bi_pg_field_definitions
                               SET statistics = $1::jsonb
                               WHERE upload_id = $2 AND original_name = $3""",
                            json.dumps(new_stats),
                            int(upload_id), name,
                        )

                        # 2. Re-derive agg_strategy with the new stats. Use the
                        # PERSISTED is_measure / semantic_type (γ-1c reclassify
                        # has already run, so these are authoritative). Falling
                        # back to classify_column would risk reverting role
                        # decisions made by reclassify with finer context.
                        new_agg = infer_agg_strategy(
                            name=name,
                            semantic_type=fr["semantic_type"],
                            is_measure=bool(fr["is_measure"]),
                            statistics=new_stats,
                        )
                        old_agg = fr["agg_strategy"] or "sum"
                        if new_agg != old_agg:
                            await conn.execute(
                                """UPDATE smart_bi_pg_field_definitions
                                   SET agg_strategy = $1
                                   WHERE upload_id = $2 AND original_name = $3""",
                                new_agg,
                                int(upload_id), name,
                            )
                            agg_strategy_changes.append({
                                "name": name,
                                "old": old_agg,
                                "new": new_agg,
                            })
                            new_agg_by_name[name] = new_agg
        except Exception as e:
            # Stats persistence is a nice-to-have; don't block the cache write.
            logger.warning(
                f"[precompute-cache] stats/agg persistence failed for upload "
                f"{upload_id} (continuing with cache write): {e}"
            )

    # If any agg_strategy flipped (e.g. rating cols 'sum' → 'mean'), recompute
    # the summary so the cached kpiSummary reflects the new aggregation. This
    # avoids a stale 'sum' summary surviving in cache after the DB has been
    # corrected.
    if agg_strategy_changes:
        logger.info(
            f"[precompute-cache] upload {upload_id}: agg_strategy changed for "
            f"{len(agg_strategy_changes)} cols (e.g. {agg_strategy_changes[:3]}), "
            "recomputing summary"
        )
        summary = compute_quick_summary(data, new_agg_by_name)
        if not summary.get("success"):
            # Defensive: shouldn't happen since first call succeeded with same
            # data, but guard anyway.
            logger.warning(
                f"[precompute-cache] upload {upload_id}: recompute failed, "
                "cache will reflect pre-update agg"
            )
            summary = compute_quick_summary(data, agg_by_name)  # fall back

    # Persist as enrichment_cache row with only kpiSummary populated.
    # _partial=true tells the FE that LLM-driven fields are missing and
    # the regular enrichment pipeline should still run to fill them.
    kpi_summary = {
        "rowCount": summary["rowCount"],
        "columnCount": summary["columnCount"],
        "columns": summary["columns"],
    }
    payload: Dict[str, Any] = {
        "kpiSummary": kpi_summary,
        "_partial": True,
        "_source": "precompute",
    }

    with get_db_context() as db:
        existing = db.query(SmartBiPgAnalysisResult).filter(
            SmartBiPgAnalysisResult.upload_id == upload_id,
            SmartBiPgAnalysisResult.analysis_type == "enrichment_cache"
        ).first()

        if existing:
            # Don't clobber a richer (full LLM) cache with a partial one.
            # Only overwrite if the existing row is also partial (idempotent
            # re-run) or empty.
            existing_payload = existing.analysis_result or {}
            is_existing_partial = bool(existing_payload.get("_partial"))
            has_llm_content = bool(
                existing_payload.get("charts")
                or existing_payload.get("aiAnalysis")
                or existing_payload.get("structuredAI")
            )
            if has_llm_content and not is_existing_partial:
                logger.info(
                    f"[precompute-cache] upload {upload_id} already has full "
                    "LLM cache, refreshing only kpiSummary in-place"
                )
                # Refresh just the KPI summary inside the existing payload so
                # repeat calls keep KPIs in sync with the latest agg_strategy
                # without dropping LLM artifacts.
                existing_payload["kpiSummary"] = kpi_summary
                existing.analysis_result = existing_payload
            else:
                existing.analysis_result = payload
            existing.factory_id = factory_id
            existing.created_at = datetime.utcnow()
        else:
            record = SmartBiPgAnalysisResult(
                factory_id=factory_id,
                upload_id=upload_id,
                analysis_type="enrichment_cache",
                analysis_result=payload,
            )
            db.add(record)

    logger.info(
        f"[precompute-cache] upload {upload_id} (factory={factory_id}): "
        f"kpiSummary cached, {summary['rowCount']} rows, "
        f"{summary['columnCount']} cols, "
        f"stats_persisted={len(stats_by_name)}, "
        f"agg_strategy_changes={len(agg_strategy_changes)}"
    )
    return {
        "success": True,
        "cached": True,
        "upload_id": upload_id,
        "rowCount": summary["rowCount"],
        "columnCount": summary["columnCount"],
        "partial": True,
        "stats_persisted": len(stats_by_name),
        "agg_strategy_changes": len(agg_strategy_changes),
    }
