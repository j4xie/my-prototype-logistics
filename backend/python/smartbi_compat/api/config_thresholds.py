"""Phase 2C Tier 1 pilot — /smartbi-config/thresholds Java→Python port.

This is the **first pilot** of Phase 2C Tier 1 (`SmartBIConfigController`
41 endpoints port per design spec
`docs/superpowers/specs/2026-05-09-phase-2c-tier-1-config-design.md`).
chat2 ships threshold sub-module first to establish the pattern for the
remaining 7 sister sub-modules (intents / incentive-rules / field-mappings
/ metric-formulas / chart-templates / reload+status / data-sources).

Mirror surface (per spec §1.2):

| # | Java line | Method | Path |
|---|---|---|---|
| 1 | 150 | GET    | /api/mobile/smartbi-config/thresholds[?type=...] |
| 2 | 167 | POST   | /api/mobile/smartbi-config/thresholds |
| 3 | 188 | PUT    | /api/mobile/smartbi-config/thresholds/{id} |
| 4 | 209 | DELETE | /api/mobile/smartbi-config/thresholds/{id} (soft-delete) |
| 5 | 229 | POST   | /api/mobile/smartbi-config/thresholds/reload |

Pilot scope decisions (documented in PR body):

* **Cache**: spec §4 recommends Option A (cachetools + Redis pub/sub) but
  pilot uses Option C (no cache, reload is no-op success). Sister chats
  add the shared `config_cache.py` later — Tier 1 cutover orchestrator
  decides timing. Reload endpoint returns success for contract parity.
* **Auth**: new `verify_jwt_admin` dep (no URL `factory_id` required;
  Tier 1 endpoints have no `{factoryId}` in path per spec §5.1). Reuses
  `PRIVILEGED_ROLES` gate from `smartbi_compat.auth` for cross-factory
  tokens. Q2 `@RequirePermission` semantics deferred to follow-up — Java
  side keeps the aspect-level check during cutover window.
* **RLS**: admin endpoints serve cross-factory queries; tenant context
  set to `__internal__` sentinel via `smartbi.tenant_ctx.set_factory_id(None)`.
  `smart_bi_alert_thresholds` has no RLS policy so `__internal__` does
  NOT block reads (sanity-checked via spec §5.4).

Rule compliance (`.claude/rules/python-java-port.md`):

* **Rule 4** dict-eq parity gate ≥99.945% — pilot does not yet record
  goldens; sidecar dryrun in Phase 2C-Tier-1-B (per spec §6.2) will.
* **Rule 8** dict literal key order = Java `SmartBiAlertThreshold` Lombok
  declaration order verified manually against entity (line 52-114).
* **Rule 9** `ConfigOperationResult` emits ALL fields incl `null` — Java
  Lombok DTO has no `@JsonInclude(NON_NULL)` (spec §3.1 verified). Python
  `_operation_result` mirrors via explicit dict literal with `None` defaults.
* **Rule 11** `_java_isoformat()` used for every datetime → ISO-8601 emit
  to mirror Java Jackson trailing-zero microsecond trim.

Java references:

* Controller: `SmartBIConfigController.java` lines 150-229
* Service interface: `AlertThresholdService.java`
* Service impl: `AlertThresholdServiceImpl.java`
* Entity: `SmartBiAlertThreshold.java` (table `smart_bi_alert_thresholds`)
* Request DTO: `CreateAlertThresholdRequest.java` (Issue #320 Rule 17.1 fix)
* Response DTO: `ConfigOperationResult.java`
"""
from __future__ import annotations

import logging
import os
import uuid
from datetime import datetime
from decimal import Decimal
from typing import Any, Optional

import jwt
from fastapi import APIRouter, Depends, HTTPException, Path, Query, Request
from pydantic import BaseModel, ConfigDict, Field

from smartbi_compat.auth import JWT_ALGORITHM, PRIVILEGED_ROLES, AuthContext
from smartbi_compat.schema_compat import _java_isoformat, wrap_response

logger = logging.getLogger(__name__)
router = APIRouter()


# ============================================================
# Auth — new dep for Tier 1 (no factory_id in URL path)
# ============================================================


def _get_secret() -> str:
    secret = os.environ.get("JWT_SECRET")
    if not secret:
        raise RuntimeError(
            "JWT_SECRET env var not set. systemd cretas-python.service must "
            "have EnvironmentFile=/www/wwwroot/cretas/.env.prod."
        )
    return secret


async def verify_jwt_admin(request: Request) -> AuthContext:
    """JWT verify for Tier 1 admin endpoints (no factory_id in path).

    Returns ``AuthContext`` with ``factory_id`` from JWT claim (or empty
    string for privileged tokens without ``factoryId``). Rejects:

    * missing / invalid Bearer token → 401
    * expired token → 401
    * token without ``factoryId`` AND role NOT in ``PRIVILEGED_ROLES`` → 403

    Tier 1 endpoints are admin-only per spec §5.1; cross-factory queries
    are served via ``__internal__`` tenant sentinel (see ``set_factory_id``
    call sites in the endpoint handlers below).
    """
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        raise HTTPException(401, "Missing Bearer token in Authorization header")
    token = auth_header[len("Bearer "):]
    try:
        payload = jwt.decode(token, _get_secret(), algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(401, "Token expired")
    except jwt.InvalidTokenError as e:
        raise HTTPException(401, f"Invalid token: {e}")

    token_factory: Optional[str] = payload.get("factoryId")
    role: str = payload.get("role") or ""

    if token_factory is None and role not in PRIVILEGED_ROLES:
        raise HTTPException(
            403,
            "Token without factoryId requires platform_admin role for Tier 1 admin access",
        )

    return AuthContext(
        user_id=int(payload["userId"]),
        username=payload.get("username") or "",
        factory_id=token_factory or "",
        role=role,
    )


# ============================================================
# DTOs — Pydantic mirror of Java CreateAlertThresholdRequest
# ============================================================


class CreateAlertThresholdRequest(BaseModel):
    """Mirror of Java ``CreateAlertThresholdRequest`` (Issue #320 Rule 17.1).

    Java DTO has ``@JsonInclude(JsonInclude.Include.NON_NULL)`` on the
    serialization side. Pydantic accepts ``null`` / missing optional
    fields on the INPUT side; service layer applies business defaults
    (``comparisonOperator='GT'``, ``isActive=true``) per Java service.
    """
    model_config = ConfigDict(extra="ignore")

    thresholdType: str = Field(..., min_length=1, max_length=64)
    metricCode: str = Field(..., min_length=1, max_length=64)
    warningValue: Optional[Decimal] = None
    criticalValue: Optional[Decimal] = None
    comparisonOperator: Optional[str] = Field(None, max_length=16)
    unit: Optional[str] = Field(None, max_length=32)
    description: Optional[str] = Field(None, max_length=255)
    factoryId: Optional[str] = Field(None, max_length=32)
    isActive: Optional[bool] = None


# ============================================================
# Helpers — row → dict (Rule 8 key order) + ConfigOperationResult (Rule 9)
# ============================================================


_CONFIG_TYPE_THRESHOLD = "THRESHOLD"


def _decimal_or_none(v: Any) -> Optional[Decimal]:
    """Pass-through helper for asyncpg NUMERIC → Decimal column reads."""
    if v is None:
        return None
    return v if isinstance(v, Decimal) else Decimal(str(v))


def _row_to_dict(row) -> Optional[dict]:
    """Convert ``asyncpg.Record`` → dict matching Java ``SmartBiAlertThreshold``
    Jackson serialization (Lombok ``@Data`` declaration order, all fields
    emit including null — per Rule 9).
    """
    if row is None:
        return None
    return {
        "id": row["id"],
        "thresholdType": row["threshold_type"],
        "metricCode": row["metric_code"],
        "warningValue": _decimal_or_none(row["warning_value"]),
        "criticalValue": _decimal_or_none(row["critical_value"]),
        "comparisonOperator": row["comparison_operator"],
        "unit": row["unit"],
        "description": row["description"],
        "factoryId": row["factory_id"],
        "isActive": row["is_active"],
        "createdAt": _java_isoformat(row["created_at"]),
        "updatedAt": _java_isoformat(row["updated_at"]),
        "deletedAt": _java_isoformat(row["deleted_at"]),
    }


def _operation_result(
    op_type: str,
    message: str,
    *,
    data: Any = None,
    affected: Optional[int] = None,
) -> dict:
    """Mirror Java ``ConfigOperationResult`` — Rule 9 emit all fields incl null.

    Java DTO has NO ``@JsonInclude`` annotation, so Jackson emits ``null``
    explicitly. Field order = Lombok ``@Data`` declaration order
    (``success / message / data / configType / timestamp / operationType /
    affectedCount``) per `ConfigOperationResult.java:32-66`.
    """
    return {
        "success": True,
        "message": message,
        "data": data,
        "configType": _CONFIG_TYPE_THRESHOLD,
        "timestamp": _java_isoformat(datetime.now()),
        "operationType": op_type,
        "affectedCount": affected,
    }


# ============================================================
# DB pool — smartbi DB (smart_bi_alert_thresholds lives here)
# ============================================================


_SELECT_COLUMNS = (
    "id, threshold_type, metric_code, warning_value, critical_value, "
    "comparison_operator, unit, description, factory_id, is_active, "
    "created_at, updated_at, deleted_at"
)


async def _get_pool():
    """Lazy import keeps test patching simple (monkeypatch this symbol)."""
    from smartbi.config import get_pg_pool
    return await get_pg_pool()


# ============================================================
# Endpoints — 5 endpoints CRUD + reload
# ============================================================


@router.get("/api/mobile/smartbi-config/thresholds")
async def list_thresholds(
    type: Optional[str] = Query(None, max_length=64, description="Filter by threshold type"),
    auth: AuthContext = Depends(verify_jwt_admin),
):
    """List active thresholds. Optional ``type`` filter — mirrors Java
    ``AlertThresholdService.getThresholdsByType(thresholdType)`` when
    type set, or full list when null."""
    from smartbi.tenant_ctx import reset_factory_id, set_factory_id

    pool = await _get_pool()
    if pool is None:
        return wrap_response([], message="数据库不可用")

    token = set_factory_id(None)
    try:
        async with pool.acquire() as conn:
            if type is not None:
                rows = await conn.fetch(
                    f"SELECT {_SELECT_COLUMNS} FROM smart_bi_alert_thresholds "
                    "WHERE deleted_at IS NULL AND threshold_type = $1 AND is_active = true "
                    "ORDER BY created_at DESC",
                    type,
                )
            else:
                rows = await conn.fetch(
                    f"SELECT {_SELECT_COLUMNS} FROM smart_bi_alert_thresholds "
                    "WHERE deleted_at IS NULL AND is_active = true "
                    "ORDER BY created_at DESC",
                )
    finally:
        reset_factory_id(token)

    return wrap_response([_row_to_dict(r) for r in rows], message="查询成功")


@router.post("/api/mobile/smartbi-config/thresholds")
async def create_threshold(
    body: CreateAlertThresholdRequest,
    auth: AuthContext = Depends(verify_jwt_admin),
):
    """Create a threshold. Service applies defaults per Java
    ``AlertThresholdServiceImpl.saveThreshold`` + Issue #320 fix:
    ``comparisonOperator`` → ``GT``, ``isActive`` → ``true`` when null."""
    from smartbi.tenant_ctx import reset_factory_id, set_factory_id

    pool = await _get_pool()
    if pool is None:
        raise HTTPException(503, "数据库不可用")

    new_id = str(uuid.uuid4())
    comparison_operator = body.comparisonOperator or "GT"
    is_active = body.isActive if body.isActive is not None else True

    token = set_factory_id(None)
    try:
        async with pool.acquire() as conn:
            await conn.execute(
                "INSERT INTO smart_bi_alert_thresholds "
                "(id, threshold_type, metric_code, warning_value, critical_value, "
                "comparison_operator, unit, description, factory_id, is_active, "
                "created_at, updated_at) "
                "VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())",
                new_id, body.thresholdType, body.metricCode,
                body.warningValue, body.criticalValue,
                comparison_operator, body.unit, body.description,
                body.factoryId, is_active,
            )
            row = await conn.fetchrow(
                f"SELECT {_SELECT_COLUMNS} FROM smart_bi_alert_thresholds WHERE id = $1",
                new_id,
            )
    finally:
        reset_factory_id(token)

    return wrap_response(
        _operation_result("CREATE", "创建成功", data=_row_to_dict(row), affected=1),
        message="创建成功",
    )


@router.put("/api/mobile/smartbi-config/thresholds/{id}")
async def update_threshold(
    body: CreateAlertThresholdRequest,
    id: str = Path(..., min_length=1, max_length=64),
    auth: AuthContext = Depends(verify_jwt_admin),
):
    """Update a threshold by UUID. 404 if not found or soft-deleted."""
    from smartbi.tenant_ctx import reset_factory_id, set_factory_id

    pool = await _get_pool()
    if pool is None:
        raise HTTPException(503, "数据库不可用")

    comparison_operator = body.comparisonOperator or "GT"
    is_active = body.isActive if body.isActive is not None else True

    token = set_factory_id(None)
    try:
        async with pool.acquire() as conn:
            existing = await conn.fetchrow(
                "SELECT id FROM smart_bi_alert_thresholds WHERE id = $1 AND deleted_at IS NULL",
                id,
            )
            if existing is None:
                raise HTTPException(404, f"Threshold not found: {id}")

            await conn.execute(
                "UPDATE smart_bi_alert_thresholds SET "
                "threshold_type=$2, metric_code=$3, warning_value=$4, critical_value=$5, "
                "comparison_operator=$6, unit=$7, description=$8, factory_id=$9, is_active=$10, "
                "updated_at=NOW() WHERE id=$1",
                id, body.thresholdType, body.metricCode,
                body.warningValue, body.criticalValue,
                comparison_operator, body.unit, body.description,
                body.factoryId, is_active,
            )
            row = await conn.fetchrow(
                f"SELECT {_SELECT_COLUMNS} FROM smart_bi_alert_thresholds WHERE id = $1",
                id,
            )
    finally:
        reset_factory_id(token)

    return wrap_response(
        _operation_result("UPDATE", "更新成功", data=_row_to_dict(row), affected=1),
        message="更新成功",
    )


@router.delete("/api/mobile/smartbi-config/thresholds/{id}")
async def delete_threshold(
    id: str = Path(..., min_length=1, max_length=64),
    auth: AuthContext = Depends(verify_jwt_admin),
):
    """Soft-delete a threshold (set ``deleted_at = NOW()``)."""
    from smartbi.tenant_ctx import reset_factory_id, set_factory_id

    pool = await _get_pool()
    if pool is None:
        raise HTTPException(503, "数据库不可用")

    token = set_factory_id(None)
    try:
        async with pool.acquire() as conn:
            existing = await conn.fetchrow(
                "SELECT id FROM smart_bi_alert_thresholds WHERE id = $1 AND deleted_at IS NULL",
                id,
            )
            if existing is None:
                raise HTTPException(404, f"Threshold not found: {id}")

            await conn.execute(
                "UPDATE smart_bi_alert_thresholds SET deleted_at = NOW(), updated_at = NOW() "
                "WHERE id = $1",
                id,
            )
    finally:
        reset_factory_id(token)

    return wrap_response(
        _operation_result("DELETE", "删除成功", affected=1),
        message="删除成功",
    )


@router.post("/api/mobile/smartbi-config/thresholds/reload")
async def reload_thresholds(
    auth: AuthContext = Depends(verify_jwt_admin),
):
    """Reload threshold config cache.

    Pilot impl: no Python-side cache (spec §4 Option C fallback). Sister
    chats add cachetools + Redis pub/sub via shared ``config_cache.py``
    when the second Tier 1 sub-module ships. Endpoint returns success
    message for contract parity with Java; the underlying op is currently
    a no-op until cache infrastructure lands.
    """
    return wrap_response(
        _operation_result("RELOAD", "阈值配置重载成功"),
        message="阈值配置重载成功",
    )
