"""Shared data quality queue admin API (Phase A A-3 Task 3.2 — list endpoint).

Future tasks will extend this module:
  Task 3.3: resolve/reject endpoints
  Task 3.4: batch-resolve endpoint
  Task 3.6: history endpoint

Per W0.4 binding findings:
  Finding 1: source_upload_id has no FK → LEFT JOIN must handle NULL uploaded_by
              gracefully (item.submitter can be None).
  Finding 2: created_at is nullable despite DEFAULT now() → use .isoformat() if
              not None pattern throughout.
  Finding 3: RLS FORCE on entity_resolution_admin_queue requires
             SELECT set_config('app.factory_id', $1, true) per query.
             Phase A: require factoryId (cross-factory deferred to Phase B —
             would require BYPASSRLS or SECURITY DEFINER function).
  Finding 4: Default to status='PENDING' for partial-index hit
             (idx_eraq_pending_priority).
  Finding 7: VALID_ENTITY_TYPES hardcoded from DB CHECK constraint (8 values).
"""
from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional, Tuple

from fastapi import APIRouter, HTTPException, Query, Request

from smartbi.canonical.provenance._admin_auth import require_admin
from smartbi.config import get_pg_pool

logger = logging.getLogger(__name__)
router = APIRouter()

# W0.4 finding 7: all 8 entity_type values from DB CHECK constraint.
# Must stay in sync with entity_resolution_admin_queue.entity_type CHECK.
VALID_ENTITY_TYPES = frozenset({
    "store",
    "product",
    "staff",
    "ingredient",
    "shape_detection",
    "sheet_merge",
    "period_inference",
    "field_conflict",
})


async def _fetch_queue_items(
    pool,
    factory_id: str,
    entity_type: Optional[str],
    status: str,
    page: int,
    page_size: int,
) -> Tuple[List[Dict[str, Any]], int]:
    """Run paginated query joining uploads for submitter info.

    W0.4 finding 3: GUC set_config is issued inside the same connection
    (same asyncpg connection context) as the SELECT, so RLS FORCE sees the
    correct factory_id and returns rows (rather than silently returning 0).

    W0.4 finding 1: LEFT JOIN so rows without a matching upload (NULL
    source_upload_id or orphaned FK) still appear; submitter becomes None.

    W0.4 finding 2: created_at / admin_at serialised as .isoformat() if
    the value is not None.
    """
    where_clauses: List[str] = ["q.factory_id = $1"]
    params: List[Any] = [factory_id]
    p_idx = 2

    if entity_type:
        if entity_type not in VALID_ENTITY_TYPES:
            raise HTTPException(
                status_code=400,
                detail=f"未知 entity_type: {entity_type!r}，有效值: {sorted(VALID_ENTITY_TYPES)}",
            )
        where_clauses.append(f"q.entity_type = ${p_idx}")
        params.append(entity_type)
        p_idx += 1

    where_clauses.append(f"q.status = ${p_idx}")
    params.append(status)
    p_idx += 1

    where_sql = "WHERE " + " AND ".join(where_clauses)
    offset = (page - 1) * page_size

    async with pool.acquire() as conn:
        # W0.4 finding 3: MUST set GUC inside an EXPLICIT TRANSACTION before
        # the SELECT — set_config(..., is_local=true) is transaction-scoped,
        # so without an explicit txn wrapper asyncpg auto-commits the SELECT
        # set_config call, the GUC is wiped, and the next query sees no
        # app.factory_id → RLS FORCE silently returns 0 rows. Pattern matches
        # smartbi/agent/budget_tracker.py:101-107 and narrative_cache.py:83-88.
        async with conn.transaction():
            await conn.execute(
                "SELECT set_config('app.factory_id', $1, true)", factory_id
            )

            rows = await conn.fetch(
                f"""
                SELECT q.id,
                       q.factory_id,
                       q.entity_type,
                       q.raw_name,
                       q.candidate_entity_id,
                       q.confidence,
                       q.decided_by_agent,
                       q.status,
                       q.priority,
                       q.source_upload_id,
                       q.admin_user,
                       q.admin_at,
                       q.admin_action,
                       q.admin_resolved_to_entity_id,
                       q.reasoning,
                       q.extra,
                       q.created_at,
                       u.uploaded_by AS submitter
                  FROM entity_resolution_admin_queue q
                  LEFT JOIN smart_bi_pg_excel_uploads u
                         ON u.id = q.source_upload_id
                  {where_sql}
                 ORDER BY q.priority DESC, q.created_at DESC
                 LIMIT ${p_idx} OFFSET ${p_idx + 1}
                """,
                *params,
                page_size,
                offset,
            )

            total = await conn.fetchval(
                f"""
                SELECT COUNT(*)
                  FROM entity_resolution_admin_queue q
                  {where_sql}
                """,
                *params,
            )

    items: List[Dict[str, Any]] = [
        {
            "id": int(r["id"]),
            "factoryId": r["factory_id"],
            "entityType": r["entity_type"],
            "rawName": r["raw_name"],
            "candidateEntityId": (
                int(r["candidate_entity_id"])
                if r["candidate_entity_id"] is not None
                else None
            ),
            "confidence": (
                float(r["confidence"])
                if r["confidence"] is not None
                else None
            ),
            "decidedByAgent": r["decided_by_agent"],
            "status": r["status"],
            "priority": r["priority"],
            "sourceUploadId": (
                int(r["source_upload_id"])
                if r["source_upload_id"] is not None
                else None
            ),
            # W0.4 finding 1: LEFT JOIN — uploaded_by (BIGINT) may be None
            "submitter": (
                str(r["submitter"]) if r["submitter"] is not None else None
            ),
            "adminUser": r["admin_user"],
            # W0.4 finding 2: admin_at is nullable
            "adminAt": (
                r["admin_at"].isoformat() if r["admin_at"] is not None else None
            ),
            "adminAction": r["admin_action"],
            "adminResolvedToEntityId": (
                int(r["admin_resolved_to_entity_id"])
                if r["admin_resolved_to_entity_id"] is not None
                else None
            ),
            "reasoning": r["reasoning"],
            "extra": r["extra"],
            # W0.4 finding 2: created_at is nullable despite DEFAULT now()
            "createdAt": (
                r["created_at"].isoformat()
                if r["created_at"] is not None
                else None
            ),
        }
        for r in rows
    ]

    return items, int(total or 0)


@router.get("/list")
async def list_queue(
    request: Request,
    factoryId: Optional[str] = Query(
        None, description="工厂 ID，必填（Phase A 不支持跨工厂查询）"
    ),
    entityType: Optional[str] = Query(
        None, description="过滤 entity_type（store/product/staff/ingredient/…）"
    ),
    status: Optional[str] = Query(
        None, description="过滤 status，默认 PENDING（命中 idx_eraq_pending_priority）"
    ),
    page: int = Query(1, ge=1, description="页码，从 1 开始"),
    pageSize: int = Query(50, ge=1, le=200, description="每页条数（最大 200）"),
) -> Dict[str, Any]:
    """Paginated admin view of the entity resolution admin queue.

    Phase A constraint: factoryId is required.  Cross-factory view (where
    factoryId is omitted) requires BYPASSRLS or SECURITY DEFINER and is
    deferred to Phase B.

    W0.4 binding:
      - RLS GUC set_config issued inside same connection as SELECT (finding 3)
      - Default status='PENDING' for partial-index hit (finding 4)
      - VALID_ENTITY_TYPES validation on entityType (finding 7)
    """
    require_admin(request, action_name="数据质量队列查询")

    if not factoryId or not factoryId.strip():
        raise HTTPException(
            status_code=400,
            detail="factoryId 不能为空 (Phase A 不支持跨工厂查询，Phase B 实现)",
        )

    # W0.4 finding 4: default to PENDING to hit the partial index
    effective_status = (status or "PENDING").upper()

    pool = await get_pg_pool()
    if pool is None:
        raise HTTPException(status_code=503, detail="数据库不可用")

    items, total = await _fetch_queue_items(
        pool,
        factoryId.strip(),
        entityType,
        effective_status,
        page,
        pageSize,
    )

    return {
        "items": items,
        "total": total,
        "page": page,
        "pageSize": pageSize,
    }
