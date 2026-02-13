"""
Analysis Cache API

Provides GET/POST/DELETE endpoints for persisting and retrieving
enrichment results (charts, KPIs, AI analysis) per upload_id.
Enables cache-first loading on the frontend (< 1s vs 30-40s).
"""

import logging
from datetime import datetime
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException
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
