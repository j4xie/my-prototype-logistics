"""Phase 2A /datasource GET endpoints port (Wave 2 Tier 1).

Implements 2 GET endpoints:
  - GET /api/mobile/{factoryId}/smart-bi/datasource/{datasourceId}/fields
  - GET /api/mobile/{factoryId}/smart-bi/datasource/{datasourceId}/history

/preview endpoint deferred to Wave 3 (separate chat) — see spec §1.2.

Java reference:
  - Controller: SmartBIAnalysisController.java line 747-780
  - Service: SmartBiSchemaServiceImpl.java line 225-298

Spec: docs/superpowers/specs/2026-05-01-phase2a-datasource-gets-design.md
"""
from __future__ import annotations

import logging
from datetime import date, datetime, timezone
from typing import Any, Optional

from fastapi import APIRouter, Depends, Query

from smartbi_compat.auth import AuthContext, verify_jwt_and_factory
from smartbi_compat.schema_compat import wrap_response

logger = logging.getLogger(__name__)
router = APIRouter()


# ============================================================
# Section 1: SQL helpers (cretas_db pool, mirrors PR #23 pattern)
# ============================================================


async def _get_cretas_pool():
    """Lazy import to avoid module-load cycle. Mirrors profit/cost pattern."""
    try:
        from smartbi.config import get_cretas_pool  # type: ignore
        return await get_cretas_pool()
    except Exception as e:
        logger.warning("[datasource] cretas pool acquisition failed: %s", e)
        return None


async def _query_field_definitions(datasource_id: int) -> Optional[list]:
    """Query smart_bi_field_definition for given datasource_id, sorted by display_order ASC.

    Mirrors Java SmartBiSchemaServiceImpl.getDatasourceFields (line 225-234):
      1. Check datasource exists (Java line 229) — returns None if not
      2. Query findByDatasourceIdOrderByDisplayOrderAsc (Java line 233)
      3. Apply soft-delete filter (Java @Where deleted_at IS NULL)

    Returns:
      None if datasource doesn't exist (caller wraps as success=false error)
      list[dict] of field definitions (snake_case keys from DB) otherwise
    """
    pool = await _get_cretas_pool()
    if pool is None:
        # Treat connection failure as not-found per Java behavior (catch-all → error wrap)
        return None

    async with pool.acquire() as conn:
        # Java line 229: !datasourceRepository.existsById(datasourceId)
        exists = await conn.fetchval(
            "SELECT 1 FROM smart_bi_datasource WHERE id = $1 AND deleted_at IS NULL",
            datasource_id,
        )
        if not exists:
            return None

        # Java line 233: findByDatasourceIdOrderByDisplayOrderAsc + @Where deleted_at IS NULL
        rows = await conn.fetch(
            """
            SELECT * FROM smart_bi_field_definition
            WHERE datasource_id = $1 AND deleted_at IS NULL
            ORDER BY display_order ASC
            """,
            datasource_id,
        )
        return [dict(r) for r in rows]


async def _query_schema_history_page(
    datasource_id: int, page: int, size: int
) -> Optional[dict]:
    """Query smart_bi_schema_history with pagination, default ORDER BY created_at DESC.

    Mirrors Java SmartBiSchemaServiceImpl.getSchemaHistory (line 289-298):
      1. Check datasource exists (Java line 293) — returns None if not
      2. Query findByDatasourceIdOrderByCreatedAtDesc with Pageable
      3. Apply soft-delete filter

    Returns Spring PageImpl-shaped dict (built via _build_page_impl).
    Returns None if datasource not exist.

    Note: First version supports default sort only (created_at DESC). Spring
    `?sort=field,direction` parsing deferred — see spec §3.5 backlog.
    """
    pool = await _get_cretas_pool()
    if pool is None:
        return None

    async with pool.acquire() as conn:
        exists = await conn.fetchval(
            "SELECT 1 FROM smart_bi_datasource WHERE id = $1 AND deleted_at IS NULL",
            datasource_id,
        )
        if not exists:
            return None

        # Total count for pagination metadata
        total = await conn.fetchval(
            """
            SELECT COUNT(*) FROM smart_bi_schema_history
            WHERE datasource_id = $1 AND deleted_at IS NULL
            """,
            datasource_id,
        )

        # Page rows (default ORDER BY created_at DESC per Java repo method)
        rows = await conn.fetch(
            """
            SELECT * FROM smart_bi_schema_history
            WHERE datasource_id = $1 AND deleted_at IS NULL
            ORDER BY created_at DESC
            LIMIT $2 OFFSET $3
            """,
            datasource_id,
            size,
            page * size,
        )

        return _build_page_impl(
            content=[_history_to_json(dict(r)) for r in rows],
            page=page,
            size=size,
            total=total,
        )


# ============================================================
# Section 2: DTO transformers (snake_case DB → camelCase JSON)
# Key order matches golden recording (Lombok @Data getter reflection order)
# ============================================================


def _field_def_to_json(row: dict) -> dict:
    """Mirror Lombok @Data getter reflection order for SmartBiFieldDefinition.

    Field order verified against F999 golden recording (Phase B.2). If golden
    differs from this order, update both helpers atomically.

    Notes:
      - JsonIgnore on `datasource` field (Java line 52) — NOT emitted
      - Soft-delete filter ensures `deletedAt` always None
      - Enum fields (fieldType, metricType, aggregation) emit as string
      - chartTypes is JSON-string (Java @Column columnDefinition="JSON")
    """
    return {
        "id": row["id"],
        "datasourceId": row.get("datasource_id"),
        "fieldName": row["field_name"],
        "fieldAlias": row.get("field_alias"),
        "fieldType": row["field_type"],
        "metricType": row["metric_type"],
        "aggregation": row.get("aggregation"),
        "isKpi": row["is_kpi"],
        "chartTypes": row.get("chart_types"),
        "description": row.get("description"),
        "displayOrder": row.get("display_order"),
        "isVisible": row["is_visible"],
        "formatPattern": row.get("format_pattern"),
        "createdAt": row["created_at"].isoformat() if row.get("created_at") else None,
        "updatedAt": row["updated_at"].isoformat() if row.get("updated_at") else None,
        "deletedAt": row["deleted_at"].isoformat() if row.get("deleted_at") else None,
    }


def _history_to_json(row: dict) -> dict:
    """Mirror Lombok @Data getter reflection order for SmartBiSchemaHistory.

    Field order verified against F999 golden recording (Phase C.2). If golden
    differs from this order, update both helpers atomically.
    """
    return {
        "id": row["id"],
        "datasourceId": row["datasource_id"],
        "changeType": row["change_type"],
        "versionBefore": row.get("version_before"),
        "versionAfter": row.get("version_after"),
        "oldSchema": row.get("old_schema"),
        "newSchema": row.get("new_schema"),
        "ddlExecuted": row.get("ddl_executed"),
        "createdBy": row.get("created_by"),
        "changeDescription": row.get("change_description"),
        "isReversible": row["is_reversible"],
        "isApplied": row["is_applied"],
        "errorMessage": row.get("error_message"),
        "createdAt": row["created_at"].isoformat() if row.get("created_at") else None,
        "updatedAt": row["updated_at"].isoformat() if row.get("updated_at") else None,
        "deletedAt": row["deleted_at"].isoformat() if row.get("deleted_at") else None,
    }


def _build_page_impl(
    content: list, page: int, size: int, total: int
) -> dict:
    """Mirror Spring PageImpl JSON serialization shape.

    Field order verified against F999 golden recording (Phase C.2). Spring's
    PageImpl uses Jackson default reflection order on getter methods — typically:
      content, pageable, totalElements, totalPages, last, size, number, sort,
      first, numberOfElements, empty

    Sort defaults to UNSORTED (Spring's default when no sort param provided).
    """
    total_pages = (total + size - 1) // size if size > 0 else 0
    sort_obj = {"empty": True, "sorted": False, "unsorted": True}
    return {
        "content": content,
        "pageable": {
            "sort": sort_obj,
            "offset": page * size,
            "pageNumber": page,
            "pageSize": size,
            "paged": True,
            "unpaged": False,
        },
        "totalElements": total,
        "totalPages": total_pages,
        "last": (page >= total_pages - 1) if total_pages > 0 else True,
        "size": size,
        "number": page,
        "sort": sort_obj,
        "first": page == 0,
        "numberOfElements": len(content),
        "empty": len(content) == 0,
    }


# ============================================================
# Section 3: Route handlers
# ============================================================


@router.get("/api/mobile/{factory_id}/smart-bi/datasource/{datasource_id}/fields")
async def get_datasource_fields(
    factory_id: str,
    datasource_id: int,
    auth: AuthContext = Depends(verify_jwt_and_factory),
) -> dict:
    """Java reference: SmartBIAnalysisController.getDatasourceFields line 747-762.

    Behavior mirror:
    - datasource not exist → 200 + success=false + sanitized error message (Java line 230)
    - empty fields list → 200 + success=true + data=[]
    - non-empty → 200 + success=true + data=[entity dicts in display_order ASC]
    """
    rows = await _query_field_definitions(datasource_id)
    if rows is None:
        # Java line 230 EntityNotFoundException → controller catch → ApiResponse.error
        return wrap_response(
            data=None,
            success=False,
            code=400,
            message=f"Get field definitions failed: 数据源不存在: {datasource_id}",
        )
    return wrap_response(data=[_field_def_to_json(r) for r in rows])


@router.get("/api/mobile/{factory_id}/smart-bi/datasource/{datasource_id}/history")
async def get_schema_history(
    factory_id: str,
    datasource_id: int,
    page: int = Query(0, ge=0),
    size: int = Query(20, ge=1, le=100),
    auth: AuthContext = Depends(verify_jwt_and_factory),
) -> dict:
    """Java reference: SmartBIAnalysisController.getSchemaHistory line 764-780.

    Behavior mirror:
    - datasource not exist → 200 + success=false + sanitized error message (code=400 per Sub-B.2 finding)
    - empty history (datasource exists, no history) → 200 + success=true + PageImpl(content=[])
    - default sort: createdAt DESC (Java findByDatasourceIdOrderByCreatedAtDesc)

    Pagination: ?page=N&size=N (defaults: page=0, size=20). Sort param deferred (spec §3.5).
    """
    page_data = await _query_schema_history_page(datasource_id, page, size)
    if page_data is None:
        return wrap_response(
            data=None,
            success=False,
            code=400,
            message=f"Get history failed: 数据源不存在: {datasource_id}",
        )
    return wrap_response(data=page_data)
