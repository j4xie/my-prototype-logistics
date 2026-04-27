"""Cell-level field_provenance audit endpoint (Sub-Project C Day 26).

Per 04-C v1.4 §6.3 (lines 1073-1180): one admin-gated read endpoint that
returns the FULL lineage (active + superseded chain) for a single
(factory_id, entity_type, entity_id, field_name) tuple. Powers the
``/audit/cell`` Vue page reachable from any TrustIndicator's "查看来源"
button.

Auth model
----------
Auth is JWT-based (see ``backend/python/auth_middleware.py``). The middleware
populates ``request.state.role``; we gate this route to admin roles only
(``platform_admin`` / ``factory_super_admin`` / ``permission_admin``).
Non-admin callers get 403. The factory_id query param is also matched against
``request.state.factory_id`` (belt-and-suspenders alongside RLS — the
``field_provenance.tenant_isolation`` policy already filters reads to the
JWT tenant via ``app.factory_id``).

Sentinel handling (NC-4)
------------------------
``source_upload_id = 0`` is the sentinel for non-upload sources (manual /
inferred / industry_default / system). The sentinel row in
``smart_bi_pg_excel_uploads`` has ``factory_id='__internal__'``, so a real
LEFT JOIN typically returns NULL for it under the tenant's RLS context.
We additionally treat ``source_upload_id = 0`` as "no upload" explicitly so
the UI never has to depend on whether uploads carries RLS — ``file_name``
is forced to NULL in that case and the UI shows the friendly source label
instead.
"""
from __future__ import annotations

import json as _json
import logging
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException, Query, Request

from smartbi.config import get_pg_pool

logger = logging.getLogger(__name__)

router = APIRouter()


# Roles allowed to query cell-level provenance audit. Mirrors the Vue
# router's ``meta.roles`` on the matching ``/audit/cell`` route entry —
# any change here MUST be reflected there too.
_ADMIN_ROLES = {"platform_admin", "factory_super_admin", "permission_admin"}


def _require_admin(request: Request) -> str:
    """Return the JWT factory_id, or raise 403 if caller isn't admin.

    Raises:
        HTTPException(401) when no auth state on the request (middleware
            should already have rejected, but this is defense-in-depth).
        HTTPException(403) when role isn't in the admin allow-list.
    """
    role = getattr(request.state, "role", None)
    auth_method = getattr(request.state, "auth_method", None)
    factory_id = getattr(request.state, "factory_id", None)

    # Internal Java→Python calls bypass the role check (no JWT to inspect)
    # but still benefit from the factory_id RLS filter below.
    if auth_method == "internal":
        return factory_id or ""

    if role is None:
        raise HTTPException(status_code=401, detail="Authentication required")

    if role not in _ADMIN_ROLES:
        raise HTTPException(
            status_code=403,
            detail=(
                "Cell-level audit requires admin role; "
                f"current role={role!r} is not permitted"
            ),
        )

    return factory_id or ""


def _parse_entity_id(raw: str) -> int:
    """Validate and cast entity_id from URL string → BIGINT.

    Accepts only positive integers. Anything else → 400.
    """
    try:
        v = int(raw)
    except (TypeError, ValueError):
        raise HTTPException(
            status_code=400,
            detail=f"entity_id must be a positive integer, got {raw!r}",
        )
    if v <= 0:
        raise HTTPException(
            status_code=400,
            detail=f"entity_id must be a positive integer, got {v}",
        )
    return v


def _row_to_audit(row: Any) -> Dict[str, Any]:
    """Shape a single field_provenance row + uploads JOIN into JSON.

    - ``field_value`` JSONB is decoded (asyncpg may return string or dict).
    - NUMERIC ``confidence`` → float so JSON serialization is happy.
    - DATE / TIMESTAMPTZ → ISO-8601 string.
    - ``file_name`` is forced to NULL when ``source_upload_id = 0`` (sentinel,
      see module docstring) regardless of what the JOIN produced.
    - ``is_backfill`` is computed from ``created_by == 'backfill_from_agg'``
      to surface Day 16 backfill provenance in the UI.
    """
    def _j(v: Any) -> Any:
        if v is None:
            return None
        if isinstance(v, str):
            try:
                return _json.loads(v)
            except ValueError:
                return v
        return v

    def _iso(dt: Any) -> Optional[str]:
        return dt.isoformat() if dt is not None else None

    source_upload_id = row["source_upload_id"]
    file_name: Optional[str] = row["file_name"]
    if source_upload_id == 0:
        # NC-4: sentinel — never expose '_sentinel_manual' as the file name.
        file_name = None

    confidence_raw = row["confidence"]
    confidence: Optional[float] = (
        float(confidence_raw) if confidence_raw is not None else None
    )

    return {
        "id": int(row["id"]),
        "source_type": row["source_type"],
        "source_upload_id": (
            int(source_upload_id) if source_upload_id is not None else None
        ),
        "file_name": file_name,
        "confidence": confidence,
        "valid_from": _iso(row["valid_from"]),
        "valid_to": _iso(row["valid_to"]),
        "field_value": _j(row["field_value"]),
        "mapper_method": row["mapper_method"],
        "confidence_method": row["confidence_method"],
        "created_at": _iso(row["created_at"]),
        "created_by": row["created_by"],
        "superseded_by_id": (
            int(row["superseded_by_id"]) if row["superseded_by_id"] is not None else None
        ),
        "superseded_reason": row["superseded_reason"],
        "notes": row["notes"],
        "is_backfill": (row["created_by"] == "backfill_from_agg"),
    }


@router.get("/audit")
async def get_cell_audit(
    request: Request,
    factory_id: str = Query(..., description="Tenant factory_id; must match JWT"),
    entity_type: str = Query(..., description="e.g., 'product', 'store', 'staff'"),
    entity_id: str = Query(..., description="canonical entity id (BIGINT, encoded as string for URL safety)"),
    field: str = Query(..., description="exact field_name (may carry @store_<id> suffix)"),
) -> Dict[str, Any]:
    """Return the FULL lineage (active + superseded) for one cell.

    Response shape:
      {
        "current": <row | null>,    # active row (superseded_by_id IS NULL),
                                    # null if the cell has no provenance.
                                    # If multiple actives match (degenerate),
                                    # the highest-confidence wins for `current`
                                    # and the rest stay in `history`.
        "history": [<row>, ...],     # all rows for this cell, ordered
                                    # valid_from DESC NULLS LAST, created_at DESC
        "key": {factory_id, entity_type, entity_id, field}
      }

    Each row carries:
      id, source_type, source_upload_id, file_name (null for sentinel),
      confidence, valid_from, valid_to, field_value (JSONB → dict),
      mapper_method, confidence_method, created_at, created_by,
      superseded_by_id, superseded_reason, notes, is_backfill.

    Auth: admin only (platform_admin / factory_super_admin /
    permission_admin). The factory_id query param must match the JWT
    tenant; mismatch → 403. Internal Java→Python calls bypass the role
    check but still get factory_id verification.
    """
    jwt_factory = _require_admin(request)

    # Belt-and-suspenders: factory_id must match JWT (RLS already enforces,
    # but a mismatch is a sign of a misconfigured client and should fail loud).
    if jwt_factory and factory_id != jwt_factory:
        raise HTTPException(
            status_code=403,
            detail=(
                f"factory_id query param {factory_id!r} doesn't match JWT tenant {jwt_factory!r}"
            ),
        )

    eid = _parse_entity_id(entity_id)

    pool = await get_pg_pool()
    try:
        async with pool.acquire() as conn:
            rows = await conn.fetch(
                """
                SELECT fp.id,
                       fp.source_type,
                       fp.source_upload_id,
                       fp.confidence,
                       fp.valid_from,
                       fp.valid_to,
                       fp.field_value,
                       fp.mapper_method,
                       fp.confidence_method,
                       fp.created_at,
                       fp.created_by,
                       fp.superseded_by_id,
                       fp.superseded_reason,
                       fp.notes,
                       u.file_name
                  FROM field_provenance fp
                  LEFT JOIN smart_bi_pg_excel_uploads u
                         ON u.id = fp.source_upload_id
                        AND fp.source_upload_id <> 0
                 WHERE fp.factory_id = $1
                   AND fp.entity_type = $2
                   AND fp.entity_id = $3
                   AND fp.field_name = $4
                 ORDER BY fp.valid_from DESC NULLS LAST,
                          fp.created_at DESC
                """,
                factory_id, entity_type, eid, field,
            )
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("provenance audit failed: %s", e)
        raise HTTPException(status_code=500, detail=f"Audit query failed: {e}")

    history: List[Dict[str, Any]] = [_row_to_audit(r) for r in rows]

    # Identify current (active) rows. There SHOULD be at most one for a
    # single (entity_type, entity_id, field_name) tuple thanks to
    # uq_fp_dedup (V20260430_01) — but defensively pick the highest-
    # confidence one when somehow multiple slip through.
    actives = [h for h in history if h["superseded_by_id"] is None]
    current: Optional[Dict[str, Any]] = None
    if actives:
        current = max(
            actives,
            key=lambda r: (r["confidence"] if r["confidence"] is not None else -1.0),
        )

    return {
        "current": current,
        "history": history,
        "key": {
            "factory_id": factory_id,
            "entity_type": entity_type,
            "entity_id": str(eid),
            "field": field,
        },
    }
