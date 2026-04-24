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
"""

import logging
from datetime import datetime
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException, Request
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


# ─── POST: Precompute KPI-only enrichment cache (Apr 25 2026 / Task C) ──

@router.post("/analysis-cache/{upload_id}/precompute")
async def precompute_enrichment_cache(upload_id: int, request: Request):
    """Precompute the cheap part of enrichment (KPI summary) and persist
    as a partial enrichment_cache row. Idempotent.

    Called by Java γ-2c afterCommit hook on every successful upload, so the
    FE cache-first branch (analysis.ts:1400-1411) hits an instant cache
    on first visit and renders KPI cards in <1s instead of running the
    full 30-60s LLM pipeline (which times out on 200K-row POS uploads).

    This endpoint:
      1. Checks tenant scope via X-Internal-Secret + X-Factory-Id auth
         (set by auth_middleware) or JWT factory_id, plus DB factory match.
      2. Loads upload data via _load_upload_data (50K row cap, same as
         /quick-summary).
      3. Loads agg_strategy map from smart_bi_pg_field_definitions.
      4. Calls compute_quick_summary (pure pandas, no LLM).
      5. Persists/upserts as enrichment_cache row with kpiSummary populated
         and a `_partial: true` marker so FE knows the LLM-driven fields
         (charts/aiAnalysis/structuredAI/financialMetrics) are missing
         and should be filled in by the regular enrichment pipeline.
      6. Returns success + cache hit metadata.

    Cost: pure polars/pandas compute. Typical 200K-row POS upload: 1-3s.
    No LLM calls — safe to call on every upload + safe to backfill in bulk.
    """
    if not is_postgres_enabled():
        return {"success": False, "message": "PostgreSQL not enabled"}

    # Tenant gate: factory_id from auth_middleware (JWT or X-Factory-Id header).
    user_factory = getattr(request.state, "factory_id", None)
    if not user_factory:
        raise HTTPException(status_code=401, detail="factory_id not in auth context")

    try:
        # Verify upload belongs to this factory before doing any work.
        with get_db_context() as db:
            from smartbi.database.models import SmartBiPgExcelUpload
            upload_row = db.query(SmartBiPgExcelUpload).filter(
                SmartBiPgExcelUpload.id == upload_id
            ).first()
            if upload_row is None:
                raise HTTPException(status_code=404, detail=f"upload {upload_id} not found")
            if upload_row.factory_id != user_factory:
                logger.warning(
                    f"[precompute-cache] factory mismatch: user={user_factory}, "
                    f"upload={upload_row.factory_id}"
                )
                raise HTTPException(status_code=403, detail="cross-tenant access denied")

        # Lazy import to avoid circular deps at module load time.
        from smartbi.api.insight import (
            compute_quick_summary,
            _load_upload_data,
            _load_agg_strategy_map,
        )

        # Load data + agg strategy in parallel-ish (both are small async calls).
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
                existing.factory_id = user_factory
                existing.created_at = datetime.utcnow()
            else:
                record = SmartBiPgAnalysisResult(
                    factory_id=user_factory,
                    upload_id=upload_id,
                    analysis_type="enrichment_cache",
                    analysis_result=payload,
                )
                db.add(record)

        logger.info(
            f"[precompute-cache] upload {upload_id} (factory={user_factory}): "
            f"kpiSummary cached, {summary['rowCount']} rows, "
            f"{summary['columnCount']} cols"
        )
        return {
            "success": True,
            "cached": True,
            "upload_id": upload_id,
            "rowCount": summary["rowCount"],
            "columnCount": summary["columnCount"],
            "partial": True,
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            f"[precompute-cache] upload {upload_id} failed: {e}",
            exc_info=True,
        )
        return {"success": False, "message": "处理失败，请稍后重试"}
