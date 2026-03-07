"""
Restaurant Analytics API

Dedicated endpoints for restaurant operations dashboards.
Data source: SmartBI uploaded POS Excel (stored in smart_bi_dynamic_data).
Cache: SmartBiPgAnalysisResult with analysis_type='restaurant_analytics'.
"""
from __future__ import annotations

import logging
import time
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

import pandas as pd
from fastapi import APIRouter, HTTPException, Request
from sqlalchemy.exc import IntegrityError

from smartbi.database.connection import get_db_context, is_postgres_enabled
from smartbi.database.models import (
    SmartBiDynamicData,
    SmartBiPgAnalysisResult,
    SmartBiPgExcelUpload,
)
from services.food_industry_detector import detect_restaurant_chain
from services.restaurant_analyzer import RestaurantAnalyzer

logger = logging.getLogger(__name__)
router = APIRouter()

_analyzer = RestaurantAnalyzer()

# Threshold for "large dataset" warning (data is NOT truncated, just flagged)
_LARGE_DATASET_THRESHOLD = 30_000
# Chunk size for streaming rows from DB (controls memory peak)
_YIELD_PER_CHUNK = 5_000


# ─── Helpers ─────────────────────────────────────────────────────

def _load_upload_df(db, upload_id: int) -> tuple[pd.DataFrame, bool]:
    """Load all dynamic_data rows for an upload into a DataFrame.
    Uses yield_per for chunked streaming to limit memory peak.
    Returns (df, is_large) — is_large=True if rows exceed threshold (NOT truncated).
    """
    row_count = (
        db.query(SmartBiDynamicData.id)
        .filter(SmartBiDynamicData.upload_id == upload_id)
        .count()
    )
    if row_count == 0:
        raise HTTPException(status_code=404, detail=f"No data found for upload {upload_id}")

    is_large = row_count > _LARGE_DATASET_THRESHOLD
    if is_large:
        logger.warning(f"Upload {upload_id}: {row_count} rows (large dataset, streaming)")

    # Stream rows in chunks to control memory peak
    query = (
        db.query(SmartBiDynamicData.row_data)
        .filter(SmartBiDynamicData.upload_id == upload_id)
        .order_by(SmartBiDynamicData.row_index)
        .yield_per(_YIELD_PER_CHUNK)
    )
    data = [r[0] for r in query if r[0]]
    return pd.DataFrame(data), is_large


_CACHE_TTL = timedelta(hours=24)


def _get_cached(db, upload_id: int) -> Optional[Dict[str, Any]]:
    """Load restaurant_analytics cache for upload (expires after 24h).
    Column projection: only loads analysis_result + created_at (skips 4 unused JSONB cols).
    """
    row = (
        db.query(
            SmartBiPgAnalysisResult.analysis_result,
            SmartBiPgAnalysisResult.created_at,
        )
        .filter(
            SmartBiPgAnalysisResult.upload_id == upload_id,
            SmartBiPgAnalysisResult.analysis_type == "restaurant_analytics",
        )
        .first()
    )
    if row:
        analysis_result, created_at = row
        # TTL check — expire after 24h
        if created_at and (datetime.utcnow() - created_at) > _CACHE_TTL:
            return None
        return {
            "success": True,
            "cached": True,
            "cachedAt": created_at.isoformat() if created_at else None,
            "data": analysis_result,
        }
    return None


def _save_cache(db, upload_id: int, factory_id: str, result: Dict[str, Any], *, is_new: bool = False) -> None:
    """Upsert restaurant_analytics cache.
    Pass is_new=True when caller already checked _get_cached() returned None (skips SELECT).
    Handles concurrent INSERT race via IntegrityError fallback to UPDATE.
    """
    if not is_new:
        existing = (
            db.query(SmartBiPgAnalysisResult)
            .filter(
                SmartBiPgAnalysisResult.upload_id == upload_id,
                SmartBiPgAnalysisResult.analysis_type == "restaurant_analytics",
            )
            .first()
        )
        if existing:
            existing.analysis_result = result
            existing.created_at = datetime.utcnow()
            return
    try:
        db.add(SmartBiPgAnalysisResult(
            factory_id=factory_id,
            upload_id=upload_id,
            analysis_type="restaurant_analytics",
            analysis_result=result,
        ))
        db.flush()
    except IntegrityError:
        # Concurrent request inserted first — fall back to UPDATE
        db.rollback()
        existing = (
            db.query(SmartBiPgAnalysisResult)
            .filter(
                SmartBiPgAnalysisResult.upload_id == upload_id,
                SmartBiPgAnalysisResult.analysis_type == "restaurant_analytics",
            )
            .first()
        )
        if existing:
            existing.analysis_result = result
            existing.created_at = datetime.utcnow()


def _check_upload_ownership(db, upload_id: int, request: Request) -> Optional[Dict[str, Any]]:
    """Verify the authenticated user's factory owns this upload (IDOR protection).
    Returns error dict if mismatch, None if OK.
    Platform admins (no factory_id) and internal calls bypass the check.
    """
    token_factory = getattr(request.state, "factory_id", None)
    auth_method = getattr(request.state, "auth_method", None)

    # Internal calls (Java→Python) and platform admins bypass
    if auth_method == "internal" or not token_factory:
        return None

    upload = db.query(SmartBiPgExcelUpload.factory_id).filter(
        SmartBiPgExcelUpload.id == upload_id
    ).first()
    if not upload:
        return None  # let the endpoint handle 404

    if upload[0] and upload[0] != token_factory:
        logger.warning(f"IDOR blocked: user factory={token_factory}, upload factory={upload[0]}, upload_id={upload_id}")
        return {"success": False, "message": "Access denied", "code": "FACTORY_MISMATCH"}

    return None


# ─── GET: List restaurant uploads (MUST be before {upload_id} routes) ───

@router.get("/restaurant-analytics/uploads")
def list_restaurant_uploads(request: Request):
    """List uploads that are detected as restaurant data."""
    if not is_postgres_enabled():
        return {"success": False, "data": []}

    try:
        with get_db_context() as db:
            # Factory-scoped: only show uploads belonging to user's factory
            token_factory = getattr(request.state, "factory_id", None)
            auth_method = getattr(request.state, "auth_method", None)

            # Column projection: skip detected_structure, error_message (unused, can be large)
            query = (
                db.query(
                    SmartBiPgExcelUpload.id,
                    SmartBiPgExcelUpload.file_name,
                    SmartBiPgExcelUpload.sheet_name,
                    SmartBiPgExcelUpload.row_count,
                    SmartBiPgExcelUpload.created_at,
                    SmartBiPgExcelUpload.factory_id,
                    SmartBiPgExcelUpload.context_info,
                    SmartBiPgExcelUpload.detected_table_type,
                    SmartBiPgExcelUpload.field_mappings,
                )
                .filter(SmartBiPgExcelUpload.upload_status == "COMPLETED")
            )
            # Non-platform users only see their own factory's uploads
            if auth_method != "internal" and token_factory:
                query = query.filter(SmartBiPgExcelUpload.factory_id == token_factory)

            uploads = (
                query
                .order_by(SmartBiPgExcelUpload.created_at.desc())
                .limit(200)
                .all()
            )

            # Unpack column-projected tuples into named fields
            # Columns: id, file_name, sheet_name, row_count, created_at,
            #          factory_id, context_info, detected_table_type, field_mappings
            upload_ids = [u[0] for u in uploads]

            # Batch pre-fetch: IDs that have restaurant_analytics cache
            cached_ids = set()
            if upload_ids:
                cached_rows = (
                    db.query(SmartBiPgAnalysisResult.upload_id)
                    .filter(
                        SmartBiPgAnalysisResult.upload_id.in_(upload_ids),
                        SmartBiPgAnalysisResult.analysis_type == "restaurant_analytics",
                    )
                    .all()
                )
                cached_ids = {r[0] for r in cached_rows}

            restaurant_uploads: List[Dict[str, Any]] = []
            # Two-pass detection: metadata-only first, then batch fallback

            # Pass 1: detect via metadata (no extra DB queries)
            needs_fallback = []  # uploads that need dynamic_data sample
            for uid, file_name, sheet_name, row_count, created_at, _fid, context_info, detected_table_type, field_mappings in uploads:
                # Short-circuit: cached analytics = definitively restaurant
                if uid in cached_ids:
                    restaurant_uploads.append({
                        "id": uid, "fileName": file_name, "sheetName": sheet_name,
                        "rowCount": row_count,
                        "createdAt": created_at.isoformat() if created_at else None,
                        "hasCachedAnalytics": True,
                    })
                    continue

                is_restaurant = False

                # Fast path: check context_info metadata
                ctx = context_info or {}
                if ctx.get("is_restaurant") or ctx.get("sub_sector") in (
                    "火锅", "鱼类餐饮", "烧烤", "快餐", "餐饮连锁"
                ):
                    is_restaurant = True

                # Medium path: check detected_table_type
                if not is_restaurant and detected_table_type:
                    ttype = detected_table_type.lower()
                    if "restaurant" in ttype or "餐饮" in ttype or "pos" in ttype:
                        is_restaurant = True

                # Slow path: check column names via field_mappings
                if not is_restaurant and field_mappings:
                    col_names = []
                    if isinstance(field_mappings, list):
                        col_names = [m.get("original", "") for m in field_mappings if isinstance(m, dict)]
                    elif isinstance(field_mappings, dict):
                        col_names = list(field_mappings.keys())

                    if col_names:
                        detection = detect_restaurant_chain(col_names)
                        is_restaurant = detection.get("is_restaurant_chain", False)

                if is_restaurant:
                    restaurant_uploads.append({
                        "id": uid, "fileName": file_name, "sheetName": sheet_name,
                        "rowCount": row_count,
                        "createdAt": created_at.isoformat() if created_at else None,
                        "hasCachedAnalytics": False,
                    })
                else:
                    needs_fallback.append((uid, file_name, sheet_name, row_count, created_at))

            # Pass 2: batch-fetch sample rows for fallback detection (single query)
            if needs_fallback:
                fallback_ids = [fb[0] for fb in needs_fallback]
                sample_rows = (
                    db.query(SmartBiDynamicData.upload_id, SmartBiDynamicData.row_data)
                    .filter(SmartBiDynamicData.upload_id.in_(fallback_ids))
                    .distinct(SmartBiDynamicData.upload_id)
                    .order_by(SmartBiDynamicData.upload_id, SmartBiDynamicData.row_index)
                    .all()
                )
                sample_map = {r[0]: r[1] for r in sample_rows if r[1]}

                for uid, file_name, sheet_name, row_count, created_at in needs_fallback:
                    sample_data = sample_map.get(uid)
                    if not sample_data:
                        continue
                    col_names = list(sample_data.keys())
                    detection = detect_restaurant_chain(col_names)
                    is_restaurant = detection.get("is_restaurant_chain", False)

                    if not is_restaurant:
                        col_set = set(col_names)
                        has_store = "门店名称" in col_set
                        has_amount = bool(col_set & {"实收", "销售金额"})
                        has_restaurant_col = bool(col_set & {"点单方式", "套餐内销量"})
                        if has_store and has_amount and has_restaurant_col:
                            is_restaurant = True

                    if is_restaurant:
                        restaurant_uploads.append({
                            "id": uid, "fileName": file_name, "sheetName": sheet_name,
                            "rowCount": row_count,
                            "createdAt": created_at.isoformat() if created_at else None,
                            "hasCachedAnalytics": False,
                        })

            # Sort: cached first, then by row_count descending (in-place, stable)
            restaurant_uploads.sort(
                key=lambda x: (not x["hasCachedAnalytics"], -(x["rowCount"] or 0))
            )
            logger.info(f"list_restaurant_uploads: {len(restaurant_uploads)}/{len(uploads)} detected as restaurant")
            return {"success": True, "data": restaurant_uploads}

    except Exception as e:
        logger.error(f"list_restaurant_uploads failed: {e}", exc_info=True)
        return {"success": False, "data": [], "message": "Failed to list restaurant uploads"}


# ─── GET: Read cached analytics ─────────────────────────────────

@router.get("/restaurant-analytics/{upload_id}")
def get_restaurant_analytics(upload_id: int, request: Request):
    """Return cached restaurant analytics for an upload, or 404 if not cached."""
    if not is_postgres_enabled():
        return {"success": False, "message": "PostgreSQL not enabled"}

    try:
        with get_db_context() as db:
            # IDOR check: verify upload belongs to user's factory
            error = _check_upload_ownership(db, upload_id, request)
            if error:
                return error

            cached = _get_cached(db, upload_id)
            if cached:
                return cached
            return {"success": False, "cached": False}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"get_restaurant_analytics({upload_id}) failed: {e}", exc_info=True)
        return {"success": False, "message": "Failed to get restaurant analytics"}


# ─── POST: Compute + cache analytics ────────────────────────────

@router.post("/restaurant-analytics/{upload_id}")
def compute_restaurant_analytics(upload_id: int, request: Request, force: bool = False):
    """Load data, compute restaurant analytics, cache, and return."""
    if not is_postgres_enabled():
        return {"success": False, "message": "PostgreSQL not enabled"}

    try:
        with get_db_context() as db:
            # Load upload metadata (single query — also used for IDOR check)
            upload = db.query(
                SmartBiPgExcelUpload.id, SmartBiPgExcelUpload.factory_id
            ).filter(SmartBiPgExcelUpload.id == upload_id).first()
            if not upload:
                raise HTTPException(status_code=404, detail=f"Upload {upload_id} not found")

            factory_id = upload[1] or "unknown"

            # IDOR check: verify upload belongs to user's factory
            token_factory = getattr(request.state, "factory_id", None)
            auth_method = getattr(request.state, "auth_method", None)
            if auth_method != "internal" and token_factory and upload[1] and upload[1] != token_factory:
                logger.warning(f"IDOR blocked: user factory={token_factory}, upload factory={upload[1]}, upload_id={upload_id}")
                return {"success": False, "message": "Access denied", "code": "FACTORY_MISMATCH"}

            # Check cache first (skip if force refresh)
            if not force:
                cached = _get_cached(db, upload_id)
                if cached:
                    return cached

            # Load data (streams in chunks, never truncates)
            t0 = time.perf_counter()
            df, is_large = _load_upload_df(db, upload_id)
            t_load = time.perf_counter() - t0
            logger.info(f"Restaurant analytics: upload={upload_id}, rows={len(df)}, "
                        f"cols={list(df.columns[:8])}, load={t_load:.3f}s")

            # Compute
            t1 = time.perf_counter()
            result = _analyzer.analyze(df)
            t_compute = time.perf_counter() - t1

            # Cache (is_new=True when not force, since _get_cached returned None above;
            # when force=True, existing row may exist so let _save_cache check)
            _save_cache(db, upload_id, factory_id, result, is_new=not force)
            t_total = time.perf_counter() - t0
            logger.info(f"Restaurant analytics cached: upload={upload_id}, "
                        f"compute={t_compute:.3f}s, total={t_total:.3f}s")

            resp: Dict[str, Any] = {
                "success": True,
                "cached": False,
                "data": result,
            }
            if is_large:
                resp["warning"] = f"数据量较大({len(df)}行)，分析已基于完整数据完成"
            return resp

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"compute_restaurant_analytics({upload_id}) failed: {e}", exc_info=True)
        return {"success": False, "message": "Failed to compute restaurant analytics"}
