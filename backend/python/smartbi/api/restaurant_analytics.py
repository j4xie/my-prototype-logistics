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

# V2 编排层 (Week 2+ 邓总救命组合)
from services.restaurant.analyzer import RestaurantAnalyzerV2

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


# ═══════════════════════════════════════════════════════════════════
# V2 Endpoints — 邓总救命组合 (Week 2+)
# ═══════════════════════════════════════════════════════════════════
#
# V2 编排层调用 RestaurantAnalyzerV2, 产出 5 sections:
#   - menuNormalization (改进 1 菜品命名归一 apply)
#   - channelMargin (改进 6 渠道毛利率 with 4 层 COGS)
#   - financialMetrics (cost_rigidity + 财务率)
#   - diagnostics (诊断引擎)
#   - benchmarkAlerts (对标预警, 估算年度影响)
#
# 跟 V1 (compute_restaurant_analytics) 的区别:
#   - V1: POS only, 输出 menuQuadrant + storeComparison + categoryBreakdown 等
#   - V2: POS + financial_data (可选), 输出诊断/对标预警/渠道毛利率
#   - 两者并存, 不互相替代
# ═══════════════════════════════════════════════════════════════════


def _load_v2_from_cache(db, upload_id: int) -> Optional[Dict[str, Any]]:
    """读 V2 缓存 (用 analysis_type='restaurant_analytics_v2' 区分 V1)"""
    cache = (
        db.query(SmartBiPgAnalysisResult)
        .filter(
            SmartBiPgAnalysisResult.upload_id == upload_id,
            SmartBiPgAnalysisResult.analysis_type == "restaurant_analytics_v2",
        )
        .order_by(SmartBiPgAnalysisResult.created_at.desc())
        .first()
    )
    if cache is None:
        return None
    return {
        "success": True,
        "cached": True,
        "data": cache.analysis_result,
        "cachedAt": cache.created_at.isoformat() if cache.created_at else None,
    }


def _save_v2_cache(
    db,
    upload_id: int,
    factory_id: str,
    result: Dict[str, Any],
    is_new: bool = True,
) -> None:
    """保存 V2 缓存"""
    try:
        if is_new:
            existing = (
                db.query(SmartBiPgAnalysisResult)
                .filter(
                    SmartBiPgAnalysisResult.upload_id == upload_id,
                    SmartBiPgAnalysisResult.analysis_type == "restaurant_analytics_v2",
                )
                .first()
            )
            if existing:
                existing.analysis_result = result
                existing.created_at = datetime.utcnow()
            else:
                cache = SmartBiPgAnalysisResult(
                    upload_id=upload_id,
                    factory_id=factory_id,
                    analysis_type="restaurant_analytics_v2",
                    analysis_result=result,
                    created_at=datetime.utcnow(),
                )
                db.add(cache)
        db.commit()
    except IntegrityError:
        db.rollback()
        logger.warning(f"V2 cache race condition for upload {upload_id}")
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to save V2 cache for upload {upload_id}: {e}", exc_info=True)


@router.get("/restaurant-analytics-v2/{upload_id}")
def get_restaurant_analytics_v2(upload_id: int, request: Request):
    """V2 缓存读取 — 没算过返回 {success: False, cached: False}"""
    if not is_postgres_enabled():
        return {"success": False, "message": "PostgreSQL not enabled"}
    try:
        with get_db_context() as db:
            error = _check_upload_ownership(db, upload_id, request)
            if error:
                return error

            cached = _load_v2_from_cache(db, upload_id)
            if cached:
                return cached
            return {"success": False, "cached": False, "message": "尚未计算 V2 分析, 请 POST 触发"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"get_restaurant_analytics_v2({upload_id}) failed: {e}", exc_info=True)
        return {"success": False, "message": "Failed to get V2 analytics"}


@router.post("/restaurant-analytics-v2/{upload_id}")
async def compute_restaurant_analytics_v2(
    upload_id: int,
    request: Request,
    force: bool = False,
):
    """V2 计算 — POS DataFrame + 可选 financial_data + Week 4 inputs → unified report

    POST Body (JSON, 全部可选):
        {
            "sub_sector": "火锅",
            "store_id": "DENG-001",
            "store_name": "鼎鲜火锅·义乌",
            "period": "2026-02",
            "financial_data": {
                "current": {
                    "revenue": 731047.52,
                    "food_cost": 335212.75,
                    "labor_cost": 237660.00,
                    "rent": 57328.00,
                    "net_profit": -49724.24,
                    "stored_value_giveaway": 51680.61,   // Week 4.3 充卡赠送
                    "stored_value_charge": 200000         // Week 4.3 充卡新充
                },
                "previous": { ... },
                "monthly_revenue": 731047.52
            },
            // Week 4.5: 大众点评评论分析
            "reviews": [
                {"id": 1, "rating": 4.5, "content": "招牌毛肚很嫩", "created_at": "2026-02-01"},
                ...
            ],
            // Week 4.4: BOM Layer 2 — TOP 20 SKU 主料成本表
            "sku_forms": [
                {
                    "skuName": "招牌毛肚", "category": "招牌主菜",
                    "totalCogsAmount": 18.50, "sellingPrice": 58.0,
                    "ingredients": [
                        {"name": "毛肚", "cost": 14.0, "weightG": 180}
                    ]
                }
            ],
            // Week 4.4: BOM Layer 3 — 月度采购汇总
            "monthly_purchases": [
                {
                    "period": "2026-02",
                    "totalPurchase": 335212.75,
                    "totalRevenue": 731047.52,
                    "categoryBreakdown": {"肉类": 180000, "海鲜": 55000}
                }
            ]
        }

    Returns: {
        "success": True,
        "cached": False,
        "data": {
            "sections": {
                "menuNormalization": {...},
                "channelMargin": {...},
                "financialMetrics": {...},
                "diagnostics": [...],
                "benchmarkAlerts": [...],
                // Week 4 新增 sections
                "storePnlOnePager": {...},         // Week 4.1
                "diningHeatmap": {...},            // Week 4.2
                "storedValueDependency": {...},    // Week 4.3a
                "longTailSku": {...},              // Week 4.3b
                "reviewAnalysis": {...},           // Week 4.5
                "bomLayerStatus": {...}            // Week 4.4
            },
            "executiveSummary": [...],
            "summary": {...},
            "warnings": [...]
        }
    }
    """
    if not is_postgres_enabled():
        return {"success": False, "message": "PostgreSQL not enabled"}

    # 读 POST body
    try:
        body = await request.json()
    except Exception:
        body = {}

    sub_sector = body.get("sub_sector") or "餐饮连锁"
    store_id = body.get("store_id")
    store_name = body.get("store_name")
    period = body.get("period") or "current"
    financial_data = body.get("financial_data")

    # Week 4 新增输入 (全部可选)
    reviews = body.get("reviews")  # list[dict] — 大众点评评论
    sku_forms = body.get("sku_forms")  # list[dict] — TOP 20 SKU 主料成本表
    monthly_purchases = body.get("monthly_purchases")  # list[dict] — 月度采购汇总

    try:
        with get_db_context() as db:
            # Upload 权限检查 (跟 V1 一致)
            upload = (
                db.query(SmartBiPgExcelUpload.id, SmartBiPgExcelUpload.factory_id)
                .filter(SmartBiPgExcelUpload.id == upload_id)
                .first()
            )
            if not upload:
                raise HTTPException(
                    status_code=404, detail=f"Upload {upload_id} not found"
                )
            factory_id = upload[1] or "unknown"

            token_factory = getattr(request.state, "factory_id", None)
            auth_method = getattr(request.state, "auth_method", None)
            if (
                auth_method != "internal"
                and token_factory
                and upload[1]
                and upload[1] != token_factory
            ):
                logger.warning(
                    f"V2 IDOR blocked: user factory={token_factory}, upload factory={upload[1]}"
                )
                return {
                    "success": False,
                    "message": "Access denied",
                    "code": "FACTORY_MISMATCH",
                }

            # 缓存检查
            if not force:
                cached = _load_v2_from_cache(db, upload_id)
                if cached:
                    return cached

            # 加载 POS 数据
            t0 = time.perf_counter()
            df, is_large = _load_upload_df(db, upload_id)
            t_load = time.perf_counter() - t0
            logger.info(
                f"V2 analytics: upload={upload_id}, rows={len(df)}, load={t_load:.3f}s"
            )

            # 自动子行业检测 (如果 sub_sector 没指定或是默认)
            if sub_sector == "餐饮连锁":
                sample = df.head(20).to_dict("records") if len(df) > 0 else None
                from services.food_industry_detector import detect_food_sub_sector

                detected = detect_food_sub_sector(df.columns.tolist(), sample)
                if detected:
                    sub_sector = detected
                    logger.info(f"V2: auto-detected sub_sector={sub_sector}")

            # W5.1 — BOM Layer 2+3 managers 永远 DB-backed
            # 这样: (a) 不传新数据时读已有的 DB 数据 (b) 传新数据时 upsert 并持久化
            from services.restaurant.sku_form_manager import (
                SkuFormEntry,
                SkuFormIngredient,
                SkuFormManager,
            )
            from services.restaurant.monthly_purchase_calibrator import (
                MonthlyPurchaseCalibrator,
                MonthlyPurchaseEntry,
            )

            sku_form_manager = SkuFormManager(db_session=db)
            monthly_calibrator = MonthlyPurchaseCalibrator(db_session=db)

            # 如果 POST body 带了新的 sku_forms → UPSERT 到 DB
            if sku_forms:
                entries = []
                for sf in sku_forms:
                    ingredients = [
                        SkuFormIngredient(
                            name=ing.get("name", ""),
                            cost=float(ing.get("cost", 0)),
                            weight_g=ing.get("weightG") or ing.get("weight_g"),
                            unit_price_per_kg=ing.get("unitPricePerKg"),
                        )
                        for ing in sf.get("ingredients", [])
                    ]
                    entries.append(
                        SkuFormEntry(
                            sku_name=sf.get("skuName") or sf.get("sku_name", ""),
                            category=sf.get("category", ""),
                            total_cogs_amount=float(sf.get("totalCogsAmount") or sf.get("total_cogs_amount", 0)),
                            selling_price=sf.get("sellingPrice") or sf.get("selling_price"),
                            monthly_sales_quantity=sf.get("monthlySalesQuantity") or sf.get("monthly_sales_quantity"),
                            ingredients=ingredients,
                            uploaded_by=sf.get("uploadedBy") or sf.get("uploaded_by"),
                            notes=sf.get("notes"),
                        )
                    )
                sku_form_manager.upload(factory_id, entries)

            # 如果 POST body 带了新的 monthly_purchases → UPSERT 到 DB
            if monthly_purchases:
                for mp in monthly_purchases:
                    monthly_calibrator.upload(
                        MonthlyPurchaseEntry(
                            factory_id=factory_id,
                            period=mp.get("period", ""),
                            total_purchase=float(mp.get("totalPurchase") or mp.get("total_purchase", 0)),
                            total_revenue=float(mp.get("totalRevenue") or mp.get("total_revenue", 0)),
                            category_breakdown=mp.get("categoryBreakdown") or mp.get("category_breakdown", {}),
                            store_id=mp.get("storeId") or mp.get("store_id"),
                            notes=mp.get("notes"),
                        )
                    )

            # 跑 V2.analyze()
            t1 = time.perf_counter()
            v2 = RestaurantAnalyzerV2(
                factory_id=factory_id,
                sub_sector=sub_sector,
                db_session=db,
                sku_form_manager=sku_form_manager,
                monthly_calibrator=monthly_calibrator,
            )
            result = v2.analyze(
                pos_df=df,
                financial_data=financial_data,
                store_id=store_id,
                store_name=store_name,
                period=period,
                reviews=reviews,
            )
            t_compute = time.perf_counter() - t1

            # 保存缓存
            _save_v2_cache(db, upload_id, factory_id, result, is_new=True)
            t_total = time.perf_counter() - t0

            logger.info(
                f"V2 analytics done: upload={upload_id}, "
                f"compute={t_compute:.3f}s, total={t_total:.3f}s, "
                f"sections={list(result.get('sections', {}).keys())}"
            )

            resp: Dict[str, Any] = {
                "success": True,
                "cached": False,
                "data": result,
                "performance": {
                    "loadSeconds": round(t_load, 3),
                    "computeSeconds": round(t_compute, 3),
                    "totalSeconds": round(t_total, 3),
                    "posRows": len(df),
                },
            }
            if is_large:
                resp["warning"] = f"数据量较大({len(df)}行), V2 分析基于完整数据完成"
            return resp

    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            f"compute_restaurant_analytics_v2({upload_id}) failed: {e}", exc_info=True
        )
        return {
            "success": False,
            "message": f"Failed to compute V2 analytics: {str(e)[:200]}",
        }


# ═══════════════════════════════════════════════════════════════
# W5.2 — 客户数据录入 API (SKU 表单 + 月度采购)
#
# 这些端点让客户能独立上传 BOM Layer 2+3 数据, 不必每次跑 V2 分析
# 都重新提交. 数据持久化在 restaurant_sku_forms + restaurant_monthly_purchases
# 表, 下次分析时自动命中.
# ═══════════════════════════════════════════════════════════════


def _get_factory_id(request: Request) -> str:
    """从请求 state 拿 factory_id (需登录, 不支持 internal)"""
    factory_id = getattr(request.state, "factory_id", None)
    if not factory_id:
        # internal auth mode or test: 允许 query/body 里传 factory_id
        return ""
    return factory_id


# ── SKU 表单 (Layer 2) ─────────────────────────────────────────


@router.get("/restaurant-sku-forms")
def list_sku_forms(request: Request, factory_id: Optional[str] = None):
    """列出工厂的所有 SKU 主料成本表"""
    if not is_postgres_enabled():
        return {"success": False, "message": "PostgreSQL not enabled"}

    fid = factory_id or _get_factory_id(request)
    if not fid:
        return {"success": False, "message": "factory_id required"}

    try:
        with get_db_context() as db:
            from services.restaurant.sku_form_manager import SkuFormManager
            mgr = SkuFormManager(db_session=db)
            entries = mgr.list_all(fid)
            return {
                "success": True,
                "data": {
                    "factoryId": fid,
                    "totalCount": len(entries),
                    "byCategory": mgr.count_by_category(fid),
                    "items": [e.to_dict() for e in entries],
                },
            }
    except Exception as e:
        logger.error(f"list_sku_forms({fid}) failed: {e}", exc_info=True)
        return {"success": False, "message": f"Failed: {str(e)[:200]}"}


@router.post("/restaurant-sku-forms")
async def upload_sku_forms(request: Request):
    """批量上传/更新 SKU 主料成本表 (UPSERT)

    POST Body:
        {
            "factory_id": "F001",  // optional, 默认取 token
            "entries": [
                {
                    "skuName": "招牌毛肚",
                    "category": "招牌主菜",
                    "totalCogsAmount": 18.5,
                    "sellingPrice": 58.0,
                    "monthlySalesQuantity": 820,
                    "ingredients": [
                        {"name": "毛肚", "cost": 14.0, "weightG": 180}
                    ]
                }
            ]
        }
    """
    if not is_postgres_enabled():
        return {"success": False, "message": "PostgreSQL not enabled"}

    try:
        body = await request.json()
    except Exception:
        return {"success": False, "message": "Invalid JSON body"}

    fid = body.get("factory_id") or _get_factory_id(request)
    if not fid:
        return {"success": False, "message": "factory_id required"}

    entries_raw = body.get("entries") or []
    if not isinstance(entries_raw, list):
        return {"success": False, "message": "entries must be a list"}

    try:
        with get_db_context() as db:
            from services.restaurant.sku_form_manager import (
                SkuFormEntry,
                SkuFormIngredient,
                SkuFormManager,
            )
            mgr = SkuFormManager(db_session=db)

            entries = []
            for sf in entries_raw:
                ingredients = [
                    SkuFormIngredient(
                        name=ing.get("name", ""),
                        cost=float(ing.get("cost", 0)),
                        weight_g=ing.get("weightG") or ing.get("weight_g"),
                        unit_price_per_kg=ing.get("unitPricePerKg"),
                    )
                    for ing in sf.get("ingredients", [])
                ]
                entries.append(
                    SkuFormEntry(
                        sku_name=sf.get("skuName") or sf.get("sku_name", ""),
                        category=sf.get("category", ""),
                        total_cogs_amount=float(sf.get("totalCogsAmount") or sf.get("total_cogs_amount", 0)),
                        selling_price=sf.get("sellingPrice") or sf.get("selling_price"),
                        monthly_sales_quantity=sf.get("monthlySalesQuantity") or sf.get("monthly_sales_quantity"),
                        ingredients=ingredients,
                        uploaded_by=sf.get("uploadedBy") or sf.get("uploaded_by"),
                        notes=sf.get("notes"),
                    )
                )

            result = mgr.upload(fid, entries)
            total_count = mgr.count(fid)
            by_category = mgr.count_by_category(fid)

            return {
                "success": True,
                "data": {
                    "factoryId": fid,
                    "uploaded": result["uploaded"],
                    "updated": result["updated"],
                    "invalid": result["invalid"],
                    "totalAfterUpload": total_count,
                    "byCategory": by_category,
                },
            }
    except Exception as e:
        logger.error(f"upload_sku_forms({fid}) failed: {e}", exc_info=True)
        return {"success": False, "message": f"Failed: {str(e)[:200]}"}


@router.delete("/restaurant-sku-forms/{sku_name}")
def delete_sku_form(
    sku_name: str, request: Request, factory_id: Optional[str] = None
):
    """删除某个 SKU 表单"""
    if not is_postgres_enabled():
        return {"success": False, "message": "PostgreSQL not enabled"}

    fid = factory_id or _get_factory_id(request)
    if not fid:
        return {"success": False, "message": "factory_id required"}

    try:
        with get_db_context() as db:
            from services.restaurant.sku_form_manager import SkuFormManager
            mgr = SkuFormManager(db_session=db)
            deleted = mgr.delete(fid, sku_name)
            return {
                "success": deleted,
                "data": {"factoryId": fid, "skuName": sku_name, "deleted": deleted},
            }
    except Exception as e:
        logger.error(f"delete_sku_form({fid},{sku_name}) failed: {e}", exc_info=True)
        return {"success": False, "message": f"Failed: {str(e)[:200]}"}


# ── 月度采购 (Layer 3) ─────────────────────────────────────────


@router.get("/restaurant-monthly-purchases")
def list_monthly_purchases(request: Request, factory_id: Optional[str] = None):
    """列出工厂的所有月度采购汇总"""
    if not is_postgres_enabled():
        return {"success": False, "message": "PostgreSQL not enabled"}

    fid = factory_id or _get_factory_id(request)
    if not fid:
        return {"success": False, "message": "factory_id required"}

    try:
        with get_db_context() as db:
            from smartbi.database.models import RestaurantMonthlyPurchase
            rows = (
                db.query(RestaurantMonthlyPurchase)
                .filter(RestaurantMonthlyPurchase.factory_id == fid)
                .order_by(RestaurantMonthlyPurchase.period)
                .all()
            )

            # Also compute current calibration status
            from services.restaurant.monthly_purchase_calibrator import (
                MonthlyPurchaseCalibrator,
            )
            cal = MonthlyPurchaseCalibrator(db_session=db)
            calibration = cal.compute(fid)

            return {
                "success": True,
                "data": {
                    "factoryId": fid,
                    "totalCount": len(rows),
                    "items": [r.to_dict() for r in rows],
                    "currentCalibration": calibration.to_dict() if calibration else None,
                },
            }
    except Exception as e:
        logger.error(f"list_monthly_purchases({fid}) failed: {e}", exc_info=True)
        return {"success": False, "message": f"Failed: {str(e)[:200]}"}


@router.post("/restaurant-monthly-purchases")
async def upload_monthly_purchases(request: Request):
    """批量上传/更新月度采购 (同 period UPSERT)

    POST Body:
        {
            "factory_id": "F001",
            "entries": [
                {
                    "period": "2026-02",
                    "totalPurchase": 335212.75,
                    "totalRevenue": 731047.52,
                    "categoryBreakdown": {"肉类": 180000, ...},
                    "storeId": "DENG-001",
                    "notes": "..."
                }
            ]
        }
    """
    if not is_postgres_enabled():
        return {"success": False, "message": "PostgreSQL not enabled"}

    try:
        body = await request.json()
    except Exception:
        return {"success": False, "message": "Invalid JSON body"}

    fid = body.get("factory_id") or _get_factory_id(request)
    if not fid:
        return {"success": False, "message": "factory_id required"}

    entries_raw = body.get("entries") or []

    try:
        with get_db_context() as db:
            from services.restaurant.monthly_purchase_calibrator import (
                MonthlyPurchaseCalibrator,
                MonthlyPurchaseEntry,
            )
            cal = MonthlyPurchaseCalibrator(db_session=db)

            count_before = cal.count(fid)
            saved = 0
            errors: list[str] = []

            for mp in entries_raw:
                try:
                    cal.upload(
                        MonthlyPurchaseEntry(
                            factory_id=fid,
                            period=mp.get("period", ""),
                            total_purchase=float(mp.get("totalPurchase") or mp.get("total_purchase", 0)),
                            total_revenue=float(mp.get("totalRevenue") or mp.get("total_revenue", 0)),
                            category_breakdown=mp.get("categoryBreakdown") or mp.get("category_breakdown", {}),
                            store_id=mp.get("storeId") or mp.get("store_id"),
                            notes=mp.get("notes"),
                        )
                    )
                    saved += 1
                except Exception as e:
                    errors.append(f"{mp.get('period','?')}: {str(e)[:80]}")

            count_after = cal.count(fid)
            calibration = cal.compute(fid)

            return {
                "success": True,
                "data": {
                    "factoryId": fid,
                    "saved": saved,
                    "countBefore": count_before,
                    "countAfter": count_after,
                    "errors": errors,
                    "currentCalibration": calibration.to_dict() if calibration else None,
                },
            }
    except Exception as e:
        logger.error(f"upload_monthly_purchases({fid}) failed: {e}", exc_info=True)
        return {"success": False, "message": f"Failed: {str(e)[:200]}"}


@router.delete("/restaurant-monthly-purchases/{period}")
def delete_monthly_purchase(
    period: str, request: Request, factory_id: Optional[str] = None
):
    """删除某期月度采购"""
    if not is_postgres_enabled():
        return {"success": False, "message": "PostgreSQL not enabled"}

    fid = factory_id or _get_factory_id(request)
    if not fid:
        return {"success": False, "message": "factory_id required"}

    try:
        with get_db_context() as db:
            from smartbi.database.models import RestaurantMonthlyPurchase
            deleted = (
                db.query(RestaurantMonthlyPurchase)
                .filter(
                    RestaurantMonthlyPurchase.factory_id == fid,
                    RestaurantMonthlyPurchase.period == period,
                    RestaurantMonthlyPurchase.store_id.is_(None),
                )
                .delete()
            )
            db.commit()
            return {
                "success": deleted > 0,
                "data": {"factoryId": fid, "period": period, "deleted": deleted},
            }
    except Exception as e:
        logger.error(f"delete_monthly_purchase({fid},{period}) failed: {e}", exc_info=True)
        return {"success": False, "message": f"Failed: {str(e)[:200]}"}
