"""餐饮 outlier API (Phase B-1).

Endpoints:
  GET    /api/restaurant/outliers
  POST   /api/restaurant/outliers/dismiss             (Task 6)
  DELETE /api/restaurant/outliers/dismiss/{id}        (Task 6)

Reviewer R6: cache 启动加 warning 提示单 worker 假设.
Reviewer R2 critical: response payload includes baselineSource + baselineN
to make the fallback (self vs global) transparent to admins.

Phase A reuse:
  - require_admin (admin-tier RBAC) from canonical.provenance._admin_auth
  - Quick-Win 3 cross-factory pattern: non-platform_admin only sees own factory
  - W0.4 finding 3: RLS GUC set_config MUST be inside conn.transaction()
"""
from __future__ import annotations

import logging
import time
from datetime import datetime, timezone
from typing import Any, Dict, List, Tuple

from fastapi import APIRouter, HTTPException, Query, Request

from smartbi.canonical.provenance._admin_auth import require_admin
from smartbi.services.outlier_service import (
    DEFAULT_WINDOW_DAYS,
    KPI_LABELS,
    OutlierService,
)

logger = logging.getLogger(__name__)
logger.warning(
    "[outlier_api] Module-level cache assumes single-worker uvicorn. "
    "If you switch to --workers > 1, add Redis backend (see backlog)."
)

router = APIRouter()
_service = OutlierService()

_CACHE_TTL_S = 300
_cache: Dict[str, Tuple[float, Dict[str, Any]]] = {}


def _invalidate_cache(factory_id: str) -> None:
    """Invalidate all cached outlier responses for a factory (used by POST/DELETE).

    Wipes all cache entries matching factory_id:* pattern (all windowDays variants).
    """
    keys_to_remove = [k for k in _cache if k.startswith(f"{factory_id}:")]
    for k in keys_to_remove:
        _cache.pop(k, None)


def _validate_factory_access(request: Request, factory_id: str) -> None:
    """Quick-Win 3 pattern: cross-factory check.

    Non-platform_admin can only access their own factory's outliers.
    The 403 detail must mention 'platform_admin' so the FE / docs can
    explain the rule.
    """
    role = getattr(request.state, "role", None)
    jwt_factory_id = getattr(request.state, "factory_id", None) or ""
    if role != "platform_admin" and factory_id != jwt_factory_id:
        raise HTTPException(
            status_code=403,
            detail=(
                f"非 platform_admin 仅可访问自己工厂的 outlier "
                f"(当前工厂 {jwt_factory_id!r})"
            ),
        )


def _outlier_to_json(o) -> Dict[str, Any]:
    """Convert DetectedOutlier → camelCase dict.

    Reviewer R2 critical: include baselineSource + baselineN so the FE
    can render a "基于全网基线" badge when source == 'global'.
    """
    return {
        "anomalyDate": o.anomaly_date.isoformat(),
        "kpiKind": o.kpi_kind,
        "kpiLabel": KPI_LABELS.get(o.kpi_kind, o.kpi_kind),
        "value": float(o.value),
        "q1": float(o.q1),
        "q3": float(o.q3),
        "iqr": float(o.iqr),
        "lowerFence": float(o.lower_fence),
        "upperFence": float(o.upper_fence),
        "deviationX": float(o.deviation_x),
        "severity": o.severity,
        "direction": o.direction,
        "baselineSource": o.baseline_source,
        "baselineN": o.baseline_n,
    }


async def _query_dismissed_this_month(factory_id: str) -> List[Dict[str, Any]]:
    """Query dismissals this calendar month for a factory.

    W0.4 finding 3: outlier_dismissals has RLS FORCE, so set_config MUST
    be inside an explicit conn.transaction() — set_config(..., is_local=true)
    is transaction-scoped; without an explicit txn wrapper asyncpg auto-
    commits the SELECT set_config call, the GUC is wiped, and the next
    SELECT silently returns 0 rows.

    Returns a list of camelCase dicts ready for JSON serialization.
    """
    from smartbi.config import get_pg_pool

    pool = await get_pg_pool()
    if pool is None:
        return []

    async with pool.acquire() as conn:
        # W0.4 finding 3: GUC inside transaction
        async with conn.transaction():
            await conn.execute(
                "SELECT set_config('app.factory_id', $1, true)", factory_id
            )
            rows = await conn.fetch(
                """
                SELECT id, anomaly_date, kpi_kind, dismissed_by, dismissed_at,
                       snapshot_value, snapshot_q1, snapshot_q3,
                       snapshot_baseline_source
                  FROM outlier_dismissals
                 WHERE factory_id = $1
                   AND dismissed_at >= date_trunc('month', NOW())
                 ORDER BY dismissed_at DESC
                """,
                factory_id,
            )

    return [
        {
            "id": int(r["id"]),
            "anomalyDate": r["anomaly_date"].isoformat(),
            "kpiKind": r["kpi_kind"],
            "kpiLabel": KPI_LABELS.get(r["kpi_kind"], r["kpi_kind"]),
            "dismissedBy": r["dismissed_by"],
            "dismissedAt": r["dismissed_at"].isoformat(),
            "snapshotValue": (
                float(r["snapshot_value"]) if r["snapshot_value"] is not None else None
            ),
            "snapshotQ1": (
                float(r["snapshot_q1"]) if r["snapshot_q1"] is not None else None
            ),
            "snapshotQ3": (
                float(r["snapshot_q3"]) if r["snapshot_q3"] is not None else None
            ),
            "snapshotBaselineSource": r["snapshot_baseline_source"],
        }
        for r in rows
    ]


# ─────────────────────────────────────────────────────
# GET /api/restaurant/outliers
# ─────────────────────────────────────────────────────
@router.get("/outliers")
async def get_outliers(
    request: Request,
    factoryId: str = Query(..., description="Factory ID"),
    windowDays: int = Query(
        DEFAULT_WINDOW_DAYS,
        ge=1,
        le=365,
        description="Rolling window in days (1-365, default 30)",
    ),
) -> Dict[str, Any]:
    """List pending outliers for a factory + dismissed-this-month log.

    Auth: admin-tier (factory_super_admin / permission_admin / platform_admin).
    Cross-factory: non-platform_admin can only read their own factory.
    Cache: 5-minute TTL keyed by factory_id (single-worker assumption).

    Returns:
        {
            factoryId, windowDays, cachedAt,
            summary: {totalAnomalies, dismissedThisMonth, insufficientKpis},
            outliers: [...],   # each item has baselineSource + baselineN (R2)
            dismissed: [...],
        }
    """
    require_admin(request, action_name="餐饮 outlier 查询")

    # Validate factoryId BEFORE cross-factory check so that obviously-bad
    # input (e.g. > 50 chars) returns 400 rather than 403.
    if not factoryId or not factoryId.strip():
        raise HTTPException(status_code=400, detail="factoryId 不能为空")
    factoryId = factoryId.strip()
    if len(factoryId) > 50:
        raise HTTPException(
            status_code=400,
            detail=f"factoryId 长度不能超过 50 (收到 {len(factoryId)})",
        )

    _validate_factory_access(request, factoryId)

    # Cache check (5-minute TTL)
    now_ts = time.monotonic()
    cache_key = f"{factoryId}:{windowDays}"
    cached = _cache.get(cache_key)
    if cached:
        cached_ts, cached_body = cached
        if now_ts - cached_ts < _CACHE_TTL_S:
            return cached_body

    # Detect outliers
    try:
        outliers, insufficient = await _service.detect_totals(
            factoryId, window_days=windowDays,
        )
    except RuntimeError as exc:
        # OutlierService raises RuntimeError when SmartBI pool is unavailable
        raise HTTPException(status_code=503, detail=f"数据库连接失败: {exc}")
    except Exception:
        logger.exception("[outlier] detect failed for %s", factoryId)
        raise HTTPException(status_code=500, detail="outlier 检测内部错误")

    # Query dismissed this calendar month
    try:
        dismissed = await _query_dismissed_this_month(factoryId)
    except Exception:
        logger.exception("[outlier] dismiss query failed for %s", factoryId)
        raise HTTPException(status_code=500, detail="dismiss 查询内部错误")
    dismissed_keys = {(d["anomalyDate"], d["kpiKind"]) for d in dismissed}

    # Filter pending = outliers not in dismissed set
    pending = [
        o
        for o in outliers
        if (o.anomaly_date.isoformat(), o.kpi_kind) not in dismissed_keys
    ]

    body: Dict[str, Any] = {
        "factoryId": factoryId,
        "windowDays": windowDays,
        "cachedAt": datetime.now(timezone.utc).isoformat(),
        "summary": {
            "totalAnomalies": len(pending),
            "dismissedThisMonth": len(dismissed),
            "insufficientKpis": insufficient,
        },
        "outliers": [_outlier_to_json(o) for o in pending],
        "dismissed": dismissed,
    }
    _cache[cache_key] = (now_ts, body)
    return body
