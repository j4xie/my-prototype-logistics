"""Phase 2A /datasource endpoints port.

Implements 5 endpoints:
  Wave 2 Tier 1 (GET, full parity):
    - GET  /api/mobile/{factoryId}/smart-bi/datasource/{datasourceId}/fields
    - GET  /api/mobile/{factoryId}/smart-bi/datasource/{datasourceId}/history

  Wave G Phase-2A scope-completeness stub-mirror (POST + GET preview):
    - POST /api/mobile/{factoryId}/smart-bi/datasource/upload     (multipart)
    - GET  /api/mobile/{factoryId}/smart-bi/datasource/{datasourceId}/preview
    - POST /api/mobile/{factoryId}/smart-bi/datasource/apply

The 3 stub-mirror endpoints port Java's TODO-stub behavior — Java's
SmartBiSchemaServiceImpl.{uploadAndDetectSchema, previewSchemaChanges,
applySchemaChanges} are documented stubs with TODO markers (see
.worktrees notes). Real schema-management impl is deferred to Phase 3
per docs/superpowers/plans/2026-05-01-phase2a-remaining-endpoints-backlog.md
§2.4 (PR #45 / #49 / #50). The stubs exist to remove the "no 404" gap
left after T6.4 nginx cutover (2026-05-09) — without these, 75 customer
factories would hit Python 404 for routes that nginx routes to Python.

INTENTIONAL DIVERGENCE FROM JAVA (apply endpoint):
  Java's applySchemaChanges DOES write to DB: increments schema_version
  and inserts a smart_bi_schema_history row, both with hardcoded "{}"
  oldSchema/newSchema (see SmartBiSchemaServiceImpl.java:107-147 +
  serializeCurrentSchema:337-341 stub returning "{}"). Python skips both
  writes per organizer directive — mirroring a write-stub that doesn't
  actually do real work risks silent prod-DB mutation if a real client
  ever calls it. Real schema management will be reconciled in Phase 3
  (PR #50). Read-side Java behavior (datasource lookup + 400 if not
  found) IS mirrored.

Java reference:
  - Controller: SmartBIAnalysisController.java line 677-729 (upload/preview/apply)
                + line 747-780 (fields/history)
  - Service: SmartBiSchemaServiceImpl.java line 57-147 (stub methods)
                + line 225-298 (real fields/history methods)

Spec: docs/superpowers/specs/2026-05-01-phase2a-datasource-gets-design.md
Backlog (Phase 3): docs/superpowers/plans/2026-05-01-phase2a-remaining-endpoints-backlog.md §2.4
"""
from __future__ import annotations

import logging
from typing import Optional

from fastapi import APIRouter, Depends, File, Form, Query, UploadFile

from smartbi_compat.auth import AuthContext, verify_jwt_and_factory
from smartbi_compat.schema_compat import _java_isoformat, _now_iso, wrap_response

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
        "createdAt": _java_isoformat(row.get("created_at")),
        "updatedAt": _java_isoformat(row.get("updated_at")),
        "deletedAt": _java_isoformat(row.get("deleted_at")),
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
        "createdAt": _java_isoformat(row.get("created_at")),
        "updatedAt": _java_isoformat(row.get("updated_at")),
        "deletedAt": _java_isoformat(row.get("deleted_at")),
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


# ============================================================
# Section 4: Schema-management stub helpers (Wave G — Phase 2A scope completeness)
#
# These mirror Java's TODO stubs. Real schema management deferred to Phase 3
# (PR #45/#49/#50 per backlog plan §2.4).
# ============================================================


async def _query_datasource_by_id(datasource_id: int) -> Optional[dict]:
    """Look up smart_bi_datasource by id (no factoryId filter — mirrors Java).

    Java SmartBiSchemaServiceImpl.previewSchemaChanges (line 99-101) calls
    datasourceRepository.findById(datasourceId) WITHOUT factoryId scoping —
    so passing factoryId=F999 with datasourceId=1 (which is F001's data)
    returns F001's noChanges envelope. We mirror this exactly to preserve
    Java byte-shape parity (the existing Java behavior is a known stub
    limitation, not validated by this Python port).

    Returns None if not found OR connection fails (Java throws
    EntityNotFoundException → controller catch-all wraps as 400 error).
    Returns dict with at minimum {id, name, schema_version} on success.
    """
    pool = await _get_cretas_pool()
    if pool is None:
        return None

    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """
            SELECT id, name, factory_id, schema_version
            FROM smart_bi_datasource
            WHERE id = $1 AND deleted_at IS NULL
            """,
            datasource_id,
        )
        return dict(row) if row else None


async def _query_datasource_by_name(factory_id: str, name: str) -> Optional[dict]:
    """Look up smart_bi_datasource by factory_id + name.

    Java SmartBiSchemaServiceImpl.uploadAndDetectSchema (line 67) calls
    datasourceRepository.findByFactoryIdAndName(factoryId, datasourceName)
    to decide between the existing-datasource path (noChanges envelope) and
    the new-datasource path (autoApplicable empty-report envelope).

    Returns None if not found OR connection fails. Returns dict with at
    minimum {id, name, schema_version} on success.
    """
    pool = await _get_cretas_pool()
    if pool is None:
        return None

    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """
            SELECT id, name, factory_id, schema_version
            FROM smart_bi_datasource
            WHERE factory_id = $1 AND name = $2 AND deleted_at IS NULL
            """,
            factory_id,
            name,
        )
        return dict(row) if row else None


def _build_schema_change_preview_no_changes(
    datasource_name: str, current_version: int, *, with_detected_at: bool
) -> dict:
    """Mirror SchemaChangePreview.noChanges(datasourceName, currentVersion).

    Java factory method (SchemaChangePreview.java line 76-82):
        SchemaChangePreview.builder()
            .changes(SchemaChangeReport.noChanges(datasourceName, currentVersion))
            .requiresApproval(false)
            .affectedReportsCount(0)
            .build()

    Inner SchemaChangeReport.noChanges (SchemaChangeReport.java line 92-100)
    sets detectedAt = LocalDateTime.now() — non-null timestamp.

    Lombok @Data @Builder defaults emit ALL fields including unset → null.
    Field order from Lombok getter reflection (verified against Java goldens
    datasource-preview-F999.json + datasource-upload-schema-F001.json).

    The `with_detected_at` flag exists because the autoApplicable factory
    path (used when uploading a NEW datasource name) builds an inner
    SchemaChangeReport WITHOUT calling .detectedAt(...), so Java emits
    detectedAt=null — see _build_schema_change_preview_auto_applicable.
    Verified against datasource-upload-schema-F999.json line 13.
    """
    detected_at = _now_iso() if with_detected_at else None
    return {
        "changes": {
            "datasourceName": datasource_name,
            "currentVersion": current_version,
            "newVersion": current_version,
            "addedFields": [],
            "removedFields": [],
            "modifiedFields": [],
            "hasChanges": False,
            "detectedAt": detected_at,
            "totalChanges": 0,
        },
        "suggestedMappings": [],
        "warningMessage": None,
        "requiresApproval": False,
        "affectedReportsCount": 0,
        "affectedReportNames": None,
        "estimatedMigrationTime": None,
        "confirmationRequiredCount": 0,
    }


def _build_schema_change_preview_auto_applicable(datasource_name: str) -> dict:
    """Mirror SchemaChangePreview.autoApplicable(emptyReport, []).

    Java factory method (SchemaChangePreview.java line 101-108):
        SchemaChangePreview.builder()
            .changes(<emptyReport>)
            .suggestedMappings([])
            .requiresApproval(false)
            .build()

    The inner SchemaChangeReport is built directly via .builder() WITHOUT
    .detectedAt() call (SmartBiSchemaServiceImpl.java line 79-86), so
    detectedAt = null. currentVersion=0, newVersion=1 (Java line 81-82).

    Used for the NEW datasource path in uploadAndDetectSchema. Verified
    against datasource-upload-schema-F999.json (where the recording was
    against a never-before-seen datasource name).
    """
    return {
        "changes": {
            "datasourceName": datasource_name,
            "currentVersion": 0,
            "newVersion": 1,
            "addedFields": [],
            "removedFields": [],
            "modifiedFields": [],
            "hasChanges": False,
            "detectedAt": None,  # Java doesn't set it — Lombok emits null
            "totalChanges": 0,
        },
        "suggestedMappings": [],
        "warningMessage": None,
        "requiresApproval": False,
        "affectedReportsCount": 0,
        "affectedReportNames": None,
        "estimatedMigrationTime": None,
        "confirmationRequiredCount": 0,
    }


# ============================================================
# Section 5: Schema-management stub route handlers
# ============================================================


@router.post("/api/mobile/{factory_id}/smart-bi/datasource/upload")
async def upload_and_detect_schema(
    factory_id: str,
    file: UploadFile = File(...),
    datasourceName: str = Form(...),
    auth: AuthContext = Depends(verify_jwt_and_factory),
) -> dict:
    """Mirror Java SmartBIAnalysisController.uploadAndDetectSchema (line 680).

    Java service `SmartBiSchemaServiceImpl.uploadAndDetectSchema` (line 57-93)
    is a TODO stub:
      - Excel parsing not implemented (TODO line 61-64)
      - Schema diff not implemented (TODO line 74-75)
      - LLM mapping not implemented (TODO line 88)

    Java's two branches:
      - Existing datasource (findByFactoryIdAndName returns Some) → returns
        SchemaChangePreview.noChanges(name, currentVersion). Inner report has
        detectedAt = LocalDateTime.now() (non-null).
      - New datasource (findByFactoryIdAndName returns None) → returns
        SchemaChangePreview.autoApplicable(emptyReport, []). Inner report
        has currentVersion=0, newVersion=1, detectedAt=null.

    Real impl deferred to Phase 3 (PR #49 per backlog §2.4). Python intentionally
    does NOT parse the uploaded file — same as Java's TODO behavior. The file
    is consumed by FastAPI multipart parser then immediately discarded.

    Response shape verified against:
      - datasource-upload-schema-F001.json (existing datasource path)
      - datasource-upload-schema-F999.json (new datasource path)
    """
    # Java line 58: log.info(...). We log at debug to avoid prod log spam — the
    # endpoint is dead-stub per Phase 2A audit, no live callers expected.
    logger.debug(
        "[datasource] upload (stub-mirror): factory=%s name=%s file=%s",
        factory_id,
        datasourceName,
        getattr(file, "filename", None),
    )

    # Drain (and discard) the multipart file body — Java reads it but doesn't
    # parse (TODO line 61). Python must also consume it so the request stream
    # is properly closed. We don't store it anywhere.
    try:
        await file.read()
    except Exception:
        # Best-effort: if read fails (client disconnect mid-stream etc.) we
        # still proceed — Java's TODO never references the file content.
        pass

    # Branch on existing vs new datasource name (Java line 67).
    existing = await _query_datasource_by_name(factory_id, datasourceName)
    if existing is not None:
        # Existing datasource path → noChanges envelope WITH detectedAt timestamp
        # (Java SchemaChangeReport.noChanges line 98 sets it via builder)
        data = _build_schema_change_preview_no_changes(
            datasource_name=datasourceName,
            current_version=int(existing.get("schema_version") or 0),
            with_detected_at=True,
        )
    else:
        # New datasource path → autoApplicable envelope with detectedAt=null
        # (Java SmartBiSchemaServiceImpl line 79-86 doesn't call .detectedAt())
        data = _build_schema_change_preview_auto_applicable(datasourceName)

    # Java line 689: ApiResponse.success("Schema detection complete", preview)
    return wrap_response(data=data, message="Schema detection complete")


@router.get("/api/mobile/{factory_id}/smart-bi/datasource/{datasource_id}/preview")
async def preview_schema_changes(
    factory_id: str,
    datasource_id: int,
    auth: AuthContext = Depends(verify_jwt_and_factory),
) -> dict:
    """Mirror Java SmartBIAnalysisController.previewSchemaChanges (line 698).

    Java service `SmartBiSchemaServiceImpl.previewSchemaChanges` (line 95-105)
    is a TODO stub:
      - Looks up datasource by id (Java line 99-100)
      - Returns SchemaChangePreview.noChanges(name, currentVersion)
      - TODO line 102: "实现从临时存储获取待应用的变更"

    NOTE on factory-id scoping: Java does NOT validate factoryId matches the
    datasource's factory_id (line 99: `findById(datasourceId)` only). Python
    mirrors this — passing factory=F999 with id=1 (which belongs to F001)
    returns F001's noChanges envelope. This is a Java stub limitation, not
    a Python bug. Real impl (Phase 3 PR #45) should add factory scoping.

    Datasource not exist → 200 + success=false + 400 code envelope.
    Java behavior: EntityNotFoundException → controller catch (line 707-709)
    → ApiResponse.error("Get preview failed: " + sanitized_msg).
    """
    logger.debug(
        "[datasource] preview (stub-mirror): factory=%s id=%d",
        factory_id,
        datasource_id,
    )

    ds = await _query_datasource_by_id(datasource_id)
    if ds is None:
        return wrap_response(
            data=None,
            success=False,
            code=400,
            message=f"Get preview failed: 数据源不存在: {datasource_id}",
        )

    # Java: SchemaChangePreview.noChanges(datasource.getName(), datasource.getSchemaVersion())
    # WITH detectedAt timestamp (SchemaChangeReport.noChanges sets it).
    data = _build_schema_change_preview_no_changes(
        datasource_name=str(ds.get("name") or ""),
        current_version=int(ds.get("schema_version") or 0),
        with_detected_at=True,
    )
    return wrap_response(data=data)


@router.post("/api/mobile/{factory_id}/smart-bi/datasource/apply")
async def apply_schema_changes(
    factory_id: str,
    request: dict,
    auth: AuthContext = Depends(verify_jwt_and_factory),
) -> dict:
    """Mirror Java SmartBIAnalysisController.applySchemaChanges (line 716).

    Java service `SmartBiSchemaServiceImpl.applySchemaChanges` (line 107-147)
    is a bookkeeping stub:
      - Looks up datasource by id
      - Bumps schema_version (Java line 126-127: datasource.incrementSchemaVersion())
      - Inserts smart_bi_schema_history row with both oldSchema AND newSchema
        set to the literal string "{}" (Java line 118+136 → serializeCurrentSchema
        line 337-341 stub returns "{}")
      - Real DDL not executed (TODO line 120-123)

    INTENTIONAL DIVERGENCE FROM JAVA — Python skips the DB writes:
      Per organizer directive (Phase 2A scope-completeness MO 2026-05-09),
      Python does NOT increment schema_version and does NOT insert a
      schema_history row. Mirroring a write-stub that doesn't do real work
      risks silent prod-DB mutation if a real client ever calls the endpoint.
      Real schema management (with proper DDL + audit trail) will land in
      Phase 3 (PR #50). Read-side behavior (datasource lookup + 400 if
      not-found) IS mirrored exactly.

    The accepted request body shape (SchemaApplyRequest DTO) fields:
      - datasourceId (Long, @NotNull)
      - confirmedMappings (List<FieldMapping>, optional)
      - executeDbMigration (boolean, default false)
      - createBackup (boolean, default true)
      - changeNote (String, optional)
      - approvedBy (String, optional)
      - forceApply (boolean, default false)

    Datasource not exist → 200 + success=false + 400 code envelope.
    Datasource found → 200 + success=true + Schema-changes-applied message
      (no real changes happened — see DIVERGENCE above).

    Response shape verified against datasource-apply-{F999,F001}.json.
    """
    datasource_id = request.get("datasourceId") if isinstance(request, dict) else None
    logger.debug(
        "[datasource] apply (stub-mirror, NO DB WRITE): factory=%s id=%s",
        factory_id,
        datasource_id,
    )

    if datasource_id is None:
        return wrap_response(
            data=None,
            success=False,
            code=400,
            message="Apply changes failed: 数据源ID不能为空",
        )

    try:
        datasource_id = int(datasource_id)
    except (TypeError, ValueError):
        return wrap_response(
            data=None,
            success=False,
            code=400,
            message="Apply changes failed: 数据源ID不能为空",
        )

    ds = await _query_datasource_by_id(datasource_id)
    if ds is None:
        return wrap_response(
            data=None,
            success=False,
            code=400,
            message=f"Apply changes failed: 数据源不存在: {datasource_id}",
        )

    # Java line 724: ApiResponse.successMessage("Schema changes applied")
    # successMessage sets data=null (ApiResponse.java line 71-79).
    # NO DB WRITE — see INTENTIONAL DIVERGENCE in docstring.
    return wrap_response(data=None, message="Schema changes applied")
