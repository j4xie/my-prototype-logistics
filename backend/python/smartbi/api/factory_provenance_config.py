"""Factory-level provenance config admin endpoints (Sub-Project C Day 27).

Per 04-C v1.4 §6.4 (lines ~1133-1183): admin GET + PUT for the three
factory-tunable knobs of the provenance system:

  Q1 ``diff_threshold`` (slider, 0.05-0.50, default 0.30)
      "How much can a new value differ from the current authoritative value
      before the conflict_resolver routes it through admin review instead
      of writing it directly?"

  Q2 ``priority_overrides`` (table of source types)
      "Which source wins when two sources disagree at the same field?"
      Lower number = higher priority. Global defaults come from
      ``conflict_resolver.GLOBAL_PRIORITY_TABLE``; the factory can re-rank
      any subset.

  Q3 ``industry_default_overrides`` (table of cuisine categories)
      "What cost-rate should we assume for a category that has no recipe
      data?" Global defaults come from
      ``industry_defaults.INDUSTRY_DEFAULT_COST_RATIO``; the factory can
      override any subset. Keys are stored as ``"cost_rate.<category>"``.

Endpoints
---------
    GET  /api/smartbi/factory-config/provenance?factory_id=...
    PUT  /api/smartbi/factory-config/provenance

Auth
----
Same admin-gate model as ``provenance_audit.py``: ``platform_admin`` /
``factory_super_admin`` / ``permission_admin``. ``factory_id`` query/body
must match the JWT tenant.

Cache invalidation
------------------
PUT calls ``invalidate_factory_config_cache(factory_id)`` after a successful
UPSERT so the in-process 5-min TTL cache in conflict_resolver picks up
the new rules immediately. Without this, factory admins would have to wait
up to 5 minutes for their changes to take effect.
"""
from __future__ import annotations

import json as _json
import logging
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException, Query, Request
from pydantic import BaseModel

from smartbi.canonical.provenance.conflict_resolver import (
    GLOBAL_PRIORITY_TABLE,
    invalidate_factory_config_cache,
)
from smartbi.canonical.provenance.industry_defaults import (
    INDUSTRY_DEFAULT_COST_RATIO,
)
from smartbi.config import get_pg_pool

logger = logging.getLogger(__name__)

router = APIRouter()


# ── RBAC (copied from provenance_audit.py — operator said "duplicate or
#       import is fine, we can extract later"). Reimported via the symbol
#       ``_require_admin`` to keep the call sites identical to Day 26's
#       file so the next refactor is mechanical. ──────────────────────────
_ADMIN_ROLES = {"platform_admin", "factory_super_admin", "permission_admin"}


def _require_admin(request: Request) -> str:
    """Return the JWT factory_id, or raise 403 if caller isn't admin.

    Mirrors ``provenance_audit._require_admin`` exactly. Internal Java→Python
    calls (``auth_method=='internal'``) bypass the role check but still get
    factory_id RLS scoping downstream.
    """
    role = getattr(request.state, "role", None)
    auth_method = getattr(request.state, "auth_method", None)
    factory_id = getattr(request.state, "factory_id", None)

    if auth_method == "internal":
        return factory_id or ""

    if role is None:
        raise HTTPException(status_code=401, detail="未登录或会话已过期")

    if role not in _ADMIN_ROLES:
        raise HTTPException(
            status_code=403,
            detail=f"Provenance 配置需要管理员权限 (当前角色 {role!r} 无权访问)",
        )

    return factory_id or ""


# ── Display labels for the 6 canonical source types (Q2 table) ────────────
#
# Spec §6.4 mentions Q2 as "table of 6 source types". GLOBAL_PRIORITY_TABLE
# carries 9 entries but several are aliases (e.g. ``inventory`` and
# ``pos_excel`` ride on ``product_summary``'s priority=3 slot). The 6
# canonical types surfaced to the admin UI are the user-decision-bearing
# ones — admins shouldn't be tweaking ``pos_excel`` separately because it
# rides on whatever ``product_summary`` is set to.
_CANONICAL_SOURCE_TYPES: List[Dict[str, Any]] = [
    {"source_type": "manual", "name": "客户手动确认"},
    {"source_type": "bill_flow", "name": "账单流水"},
    {"source_type": "product_summary", "name": "商品汇总"},
    {"source_type": "review", "name": "评论数据"},
    {"source_type": "inferred", "name": "AI 推断"},
    {"source_type": "industry_default", "name": "行业默认值"},
]


# ── Validation bounds (mirror migration CHECK constraints) ────────────────
_DIFF_THRESHOLD_MIN = 0.05
_DIFF_THRESHOLD_MAX = 0.50
_PRIORITY_MIN = 1
_PRIORITY_MAX = 6
_COST_RATE_MIN = 0.0
_COST_RATE_MAX = 1.0


def _build_source_priority_rows(
    factory_priorities: Optional[Dict[str, Any]],
) -> List[Dict[str, Any]]:
    """Merge global defaults with factory overrides into 6 display rows."""
    overrides: Dict[str, int] = {}
    if isinstance(factory_priorities, dict):
        for k, v in factory_priorities.items():
            try:
                overrides[str(k)] = int(v)
            except (TypeError, ValueError):
                # Migration trigger should already block this, but be defensive.
                continue

    rows: List[Dict[str, Any]] = []
    for entry in _CANONICAL_SOURCE_TYPES:
        st = entry["source_type"]
        rows.append(
            {
                "sourceType": st,
                "name": entry["name"],
                "globalDefault": GLOBAL_PRIORITY_TABLE.get(st, 5),
                "factoryOverride": overrides.get(st),
            }
        )
    return rows


def _build_industry_default_rows(
    factory_overrides: Optional[Dict[str, Any]],
) -> List[Dict[str, Any]]:
    """Merge global cost-rate defaults with factory overrides.

    Keys in the JSONB are namespaced as ``"cost_rate.<category>"`` (per
    ``industry_defaults.get_industry_default``). The Q3 page only manages
    cost_rate today, so we filter on that prefix and strip it for display.
    The synthetic ``_default`` category is excluded — it's not a real cuisine
    and operators shouldn't see it.
    """
    overrides_cost: Dict[str, float] = {}
    if isinstance(factory_overrides, dict):
        for k, v in factory_overrides.items():
            sk = str(k)
            if not sk.startswith("cost_rate."):
                continue
            cat = sk[len("cost_rate."):]
            try:
                overrides_cost[cat] = float(v)
            except (TypeError, ValueError):
                continue

    rows: List[Dict[str, Any]] = []
    for category, default in INDUSTRY_DEFAULT_COST_RATIO.items():
        if category == "_default":
            continue
        rows.append(
            {
                "category": category,
                "name": category,  # category id == display name (Chinese)
                "globalDefault": float(default),
                "override": overrides_cost.get(category),
            }
        )
    return rows


def _row_to_response(
    factory_id: str,
    diff_threshold: float,
    priority_overrides: Any,
    industry_default_overrides: Any,
    updated_at: Any,
    updated_by: Any,
) -> Dict[str, Any]:
    """Build the GET / PUT response shape from raw row fields."""
    # asyncpg JSONB codec may surface as str OR already-decoded dict.
    po = priority_overrides
    if isinstance(po, str):
        try:
            po = _json.loads(po)
        except ValueError:
            po = None
    ido = industry_default_overrides
    if isinstance(ido, str):
        try:
            ido = _json.loads(ido)
        except ValueError:
            ido = None

    return {
        "factoryId": factory_id,
        "diffThreshold": float(diff_threshold),
        "sourcePriorities": _build_source_priority_rows(po),
        "industryDefaults": _build_industry_default_rows(ido),
        "updatedAt": updated_at.isoformat() if updated_at is not None else None,
        "updatedBy": updated_by,
    }


@router.get("/provenance")
async def get_factory_provenance_config(
    request: Request,
    factory_id: str = Query(..., description="Tenant factory_id; must match JWT"),
) -> Dict[str, Any]:
    """Read the factory's provenance config (or globals when no row exists).

    Response shape (camelCase friendly with the FE transformKeys helper):
      {
        "factoryId": "F001",
        "diffThreshold": 0.30,
        "sourcePriorities": [
          {"sourceType": "manual", "name": "客户手动确认",
           "globalDefault": 1, "factoryOverride": null|int}, ... 6 rows ...
        ],
        "industryDefaults": [
          {"category": "川菜", "name": "川菜",
           "globalDefault": 0.35, "override": null|float}, ... N rows ...
        ],
        "updatedAt": str|null,
        "updatedBy": str|null,
      }
    """
    jwt_factory = _require_admin(request)
    if jwt_factory and factory_id != jwt_factory:
        raise HTTPException(
            status_code=403,
            detail=f"factory_id 参数 {factory_id!r} 与登录工厂 {jwt_factory!r} 不一致",
        )

    pool = await get_pg_pool()
    if pool is None:
        raise HTTPException(
            status_code=503,
            detail="数据库不可用，无法读取 Provenance 配置",
        )

    try:
        async with pool.acquire() as conn:
            row = await conn.fetchrow(
                """
                SELECT diff_threshold, priority_overrides,
                       industry_default_overrides, updated_at, updated_by
                  FROM factory_provenance_config
                 WHERE factory_id = $1
                """,
                factory_id,
            )
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("get_factory_provenance_config failed: %s", e)
        raise HTTPException(status_code=500, detail=f"配置查询失败: {e}")

    if row is None:
        # No row → globals only. diff_threshold defaults to 0.30 (matches the
        # CHECK + DEFAULT in V20260501_02 migration).
        return _row_to_response(
            factory_id,
            diff_threshold=0.30,
            priority_overrides=None,
            industry_default_overrides=None,
            updated_at=None,
            updated_by=None,
        )

    return _row_to_response(
        factory_id,
        diff_threshold=row["diff_threshold"],
        priority_overrides=row["priority_overrides"],
        industry_default_overrides=row["industry_default_overrides"],
        updated_at=row["updated_at"],
        updated_by=row["updated_by"],
    )


# ── PUT body model ────────────────────────────────────────────────────────


class ProvenanceConfigBody(BaseModel):
    """PUT body shape for factory_provenance_config.

    ``sourcePriorities`` is a flat ``{source_type: priority}`` dict — only
    rows the admin actually wants to override. Same for ``industryDefaults``
    (which is ``{category: cost_rate}`` — keys are namespaced to
    ``cost_rate.<category>`` server-side before the UPSERT).
    """

    factoryId: str
    diffThreshold: float
    sourcePriorities: Dict[str, int] = {}
    industryDefaults: Dict[str, float] = {}


def _validate_body(body: ProvenanceConfigBody) -> None:
    """Range-check all fields; raise 400 on any out-of-range value."""
    if not (
        _DIFF_THRESHOLD_MIN <= body.diffThreshold <= _DIFF_THRESHOLD_MAX
    ):
        raise HTTPException(
            status_code=400,
            detail=(
                f"差异阈值必须在 [{_DIFF_THRESHOLD_MIN}, {_DIFF_THRESHOLD_MAX}] 之间，"
                f"收到 {body.diffThreshold}"
            ),
        )

    canonical_source_types = {e["source_type"] for e in _CANONICAL_SOURCE_TYPES}
    for st, prio in body.sourcePriorities.items():
        if st not in canonical_source_types:
            raise HTTPException(
                status_code=400,
                detail=(
                    f"未知数据来源 {st!r}，仅支持以下 6 种: "
                    f"{sorted(canonical_source_types)}"
                ),
            )
        try:
            p = int(prio)
        except (TypeError, ValueError):
            raise HTTPException(
                status_code=400,
                detail=f"来源 {st!r} 的优先级必须是整数，收到 {prio!r}",
            )
        if not (_PRIORITY_MIN <= p <= _PRIORITY_MAX):
            raise HTTPException(
                status_code=400,
                detail=(
                    f"来源 {st!r} 的优先级必须在 "
                    f"[{_PRIORITY_MIN}, {_PRIORITY_MAX}] 之间，收到 {p}"
                ),
            )

    valid_categories = {
        c for c in INDUSTRY_DEFAULT_COST_RATIO.keys() if c != "_default"
    }
    for cat, rate in body.industryDefaults.items():
        if cat not in valid_categories:
            raise HTTPException(
                status_code=400,
                detail=(
                    f"未知品类 {cat!r}，仅支持系统已配置的 {len(valid_categories)} 个品类"
                ),
            )
        try:
            r = float(rate)
        except (TypeError, ValueError):
            raise HTTPException(
                status_code=400,
                detail=f"品类 {cat!r} 的成本率必须是数字，收到 {rate!r}",
            )
        if not (_COST_RATE_MIN <= r <= _COST_RATE_MAX):
            raise HTTPException(
                status_code=400,
                detail=(
                    f"品类 {cat!r} 的成本率必须在 "
                    f"[{_COST_RATE_MIN}, {_COST_RATE_MAX}] 之间，收到 {r}"
                ),
            )


@router.put("/provenance")
async def put_factory_provenance_config(
    request: Request,
    body: ProvenanceConfigBody,
) -> Dict[str, Any]:
    """UPSERT factory_provenance_config + invalidate the in-process cache.

    Validation:
      - diffThreshold ∈ [0.05, 0.50]
      - each source priority ∈ [1, 6] and source_type must be one of the 6
        canonical types
      - each cost-rate ∈ [0.0, 1.0] and category must be a known cuisine
      - body.factoryId must match JWT tenant

    On success: returns the same shape as GET so the FE can refresh state
    without a second roundtrip.
    """
    jwt_factory = _require_admin(request)
    if jwt_factory and body.factoryId != jwt_factory:
        raise HTTPException(
            status_code=403,
            detail=f"请求体中的 factoryId {body.factoryId!r} 与登录工厂 {jwt_factory!r} 不一致",
        )

    _validate_body(body)

    # JSONB shapes: priority_overrides is {source_type: int}; industry_defaults
    # is namespaced as {"cost_rate.<category>": float} so the writer/reader
    # in industry_defaults.get_industry_default can find it.
    priority_overrides_json: Optional[str] = (
        _json.dumps(
            {st: int(p) for st, p in body.sourcePriorities.items()},
            ensure_ascii=False,
        )
        if body.sourcePriorities
        else None
    )
    industry_overrides_json: Optional[str] = (
        _json.dumps(
            {f"cost_rate.{cat}": float(r) for cat, r in body.industryDefaults.items()},
            ensure_ascii=False,
        )
        if body.industryDefaults
        else None
    )

    user_id = getattr(request.state, "user_id", None)
    username = getattr(request.state, "username", None)
    updated_by = (
        str(user_id) if user_id is not None
        else (str(username) if username else None)
    )

    pool = await get_pg_pool()
    if pool is None:
        raise HTTPException(
            status_code=503,
            detail="数据库不可用，无法保存 Provenance 配置",
        )

    try:
        async with pool.acquire() as conn:
            row = await conn.fetchrow(
                """
                INSERT INTO factory_provenance_config
                  (factory_id, diff_threshold, priority_overrides,
                   industry_default_overrides, updated_at, updated_by)
                VALUES ($1, $2, $3::jsonb, $4::jsonb, NOW(), $5)
                ON CONFLICT (factory_id) DO UPDATE
                  SET diff_threshold = EXCLUDED.diff_threshold,
                      priority_overrides = EXCLUDED.priority_overrides,
                      industry_default_overrides = EXCLUDED.industry_default_overrides,
                      updated_at = NOW(),
                      updated_by = EXCLUDED.updated_by
                RETURNING diff_threshold, priority_overrides,
                          industry_default_overrides, updated_at, updated_by
                """,
                body.factoryId,
                body.diffThreshold,
                priority_overrides_json,
                industry_overrides_json,
                updated_by,
            )
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("put_factory_provenance_config UPSERT failed: %s", e)
        raise HTTPException(status_code=500, detail=f"配置保存失败: {e}")

    # CRITICAL: drop the cached config so conflict_resolver picks up the new
    # priorities/threshold immediately. Without this, factory admins wait up
    # to 5 minutes for changes to take effect.
    try:
        invalidate_factory_config_cache(body.factoryId)
    except Exception as e:
        # Don't fail the save if cache invalidation glitches — log and move on.
        logger.warning(
            "invalidate_factory_config_cache(%s) raised: %s; row was saved anyway",
            body.factoryId, e,
        )

    return _row_to_response(
        body.factoryId,
        diff_threshold=row["diff_threshold"],
        priority_overrides=row["priority_overrides"],
        industry_default_overrides=row["industry_default_overrides"],
        updated_at=row["updated_at"],
        updated_by=row["updated_by"],
    )
