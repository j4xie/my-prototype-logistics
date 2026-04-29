"""Phase 2A alias routes for SmartBIAnalysisController paths.

T5b: GET /api/mobile/{factory_id}/smart-bi/query-templates — Java-shape
list of saved query templates (sorted by created_at DESC, soft-delete
filtered).

Java reference: SmartBIAnalysisController.getQueryTemplates (line 954)
backed by SmartBiQueryTemplateRepository.findByFactoryIdOrderByCreatedAtDesc
which returns List<SmartBiQueryTemplate> (BaseEntity + 7 fields). Lombok
@Data on BaseEntity then SmartBiQueryTemplate fixes Jackson key order:
    createdAt, updatedAt, deletedAt, id, factoryId, name, category,
    description, queryTemplate, parameters, deleted
where ``deleted`` is the @Where soft-delete derived flag (deletedAt != null).

T5c: GET /api/mobile/{factory_id}/smart-bi/datasource/list — Java-shape
list of active datasources for a factory (no explicit ORDER BY, soft-delete
filtered, is_active=true filtered).

Java reference: SmartBIAnalysisController.listDatasources (line 731-745)
backed by SmartBiSchemaServiceImpl.listDatasources, which returns
List<SmartBiDatasource> via SmartBiDatasourceRepository
.findByFactoryIdAndIsActiveTrue (BaseEntity adds @Where deleted_at IS NULL
auto-filter). Lombok @Data on BaseEntity then SmartBiDatasource fixes
Jackson key order:
    createdAt, updatedAt, deletedAt, id, name, sourceType, factoryId,
    schemaVersion, lastSchemaChange, description, connectionConfig,
    isActive, code, refreshInterval, linkedUploadId, fieldDefinitions,
    deleted
where ``fieldDefinitions`` is a Hibernate lazy @OneToMany collection that
the list query never loads (always serialises as []) and ``deleted`` is
the @Where soft-delete derived flag (deletedAt != null).
"""
from __future__ import annotations

import logging
from typing import Any, List

from fastapi import APIRouter, Depends
from sqlalchemy import text

from smartbi_compat.auth import AuthContext, verify_jwt_and_factory
from smartbi_compat.schema_compat import wrap_response

router = APIRouter()
logger = logging.getLogger(__name__)


def _row_to_dict(row: Any) -> dict:
    """Convert a smart_bi_query_templates row to a Java-shape JSON dict.

    ``row`` is duck-typed: production passes a SQLAlchemy ``Row``, tests
    pass ``types.SimpleNamespace``. Both expose columns as attributes
    (``row.created_at``, ``row.factory_id``, etc.), so we annotate the
    parameter as ``Any`` rather than a structural protocol.

    Field key order MUST match Jackson serialisation of
    SmartBiQueryTemplate (Lombok @Data on BaseEntity superclass first,
    then on SmartBiQueryTemplate, then the @Where-derived ``deleted``
    boolean):
        createdAt, updatedAt, deletedAt, id, factoryId, name, category,
        description, queryTemplate, parameters, deleted

    Timestamps render as ``datetime.isoformat()`` to match Java's Jackson
    LocalDateTime default (no timezone, microseconds — see schema_compat
    module docstring on the Java/Python precision compromise).
    """
    return {
        "createdAt": row.created_at.isoformat() if row.created_at else None,
        "updatedAt": row.updated_at.isoformat() if row.updated_at else None,
        "deletedAt": row.deleted_at.isoformat() if row.deleted_at else None,
        "id": row.id,
        "factoryId": row.factory_id,
        "name": row.name,
        "category": row.category,
        "description": row.description,
        "queryTemplate": row.query_template,
        "parameters": row.parameters,
        "deleted": row.deleted_at is not None,
    }


def _query_templates(factory_id: str) -> List[dict]:
    """Return saved query templates for a factory, sorted by created_at DESC.

    Mirrors Java
    SmartBiQueryTemplateRepository.findByFactoryIdOrderByCreatedAtDesc.
    BaseEntity adds ``@Where(clause = "deleted_at IS NULL")`` so we
    filter the soft-deleted rows in SQL.

    Isolated as a module-level function so contract tests can monkey-patch
    it without standing up a Postgres instance. Production calls go through
    smartbi.database.connection.get_db_context() against the SmartBI DB.
    """
    # Lazy import: keeps smartbi_compat tests independent of smartbi.database
    # initialisation when POSTGRES_ENABLED is unset (e.g. CI / unit tests).
    from smartbi.database.connection import get_db_context, is_postgres_enabled

    if not is_postgres_enabled():
        logger.warning(
            "query-templates: postgres not enabled; returning [] "
            "(factory_id=%s)",
            factory_id,
        )
        return []

    sql = text(
        "SELECT id, factory_id, name, category, description, query_template, "
        "parameters, created_at, updated_at, deleted_at "
        "FROM smart_bi_query_templates "
        "WHERE factory_id = :fid AND deleted_at IS NULL "
        "ORDER BY created_at DESC"
    )
    with get_db_context() as db:
        rows = db.execute(sql, {"fid": factory_id}).all()
    return [_row_to_dict(r) for r in rows]


@router.get("/api/mobile/{factory_id}/smart-bi/query-templates")
async def list_query_templates(
    factory_id: str,
    auth: AuthContext = Depends(verify_jwt_and_factory),
) -> dict[str, Any]:
    """Java-compatible alias: list saved query templates for a factory.

    Uses ``auth.factory_id`` rather than the path ``factory_id`` to match
    dashboard.py's pattern; the auth dependency already enforces
    path-equals-token-factoryId, so the two are equivalent in practice.
    """
    rows = _query_templates(auth.factory_id)
    return wrap_response(rows)


def _datasource_row_to_dict(row: Any) -> dict:
    """Convert a smart_bi_datasource row to a Java-shape JSON dict.

    ``row`` is duck-typed: production passes a SQLAlchemy ``Row``, tests
    pass ``types.SimpleNamespace``. Both expose columns as attributes
    (``row.created_at``, ``row.factory_id``, ``row.source_type``, etc.),
    so we annotate the parameter as ``Any`` rather than a structural
    protocol.

    Field key order MUST match Jackson serialisation of SmartBiDatasource
    (Lombok @Data on BaseEntity superclass first, then on
    SmartBiDatasource fields in declaration order, then the @Where-derived
    ``deleted`` boolean from BaseEntity.isDeleted() last):
        createdAt, updatedAt, deletedAt, id, name, sourceType, factoryId,
        schemaVersion, lastSchemaChange, description, connectionConfig,
        isActive, code, refreshInterval, linkedUploadId, fieldDefinitions,
        deleted

    ``fieldDefinitions`` is a Hibernate lazy @OneToMany collection that
    findByFactoryIdAndIsActiveTrue never loads — it is always serialised
    as ``[]``. The Python alias unconditionally emits ``[]`` for this key
    (does NOT query the smart_bi_field_definition table) to match Java
    byte-shape exactly.

    Timestamps render as ``datetime.isoformat()`` to match Java's Jackson
    LocalDateTime default (no timezone, microseconds — see schema_compat
    module docstring on the Java/Python precision compromise).
    """
    return {
        "createdAt": row.created_at.isoformat() if row.created_at else None,
        "updatedAt": row.updated_at.isoformat() if row.updated_at else None,
        "deletedAt": row.deleted_at.isoformat() if row.deleted_at else None,
        "id": row.id,
        "name": row.name,
        "sourceType": row.source_type,
        "factoryId": row.factory_id,
        "schemaVersion": row.schema_version,
        "lastSchemaChange": (
            row.last_schema_change.isoformat() if row.last_schema_change else None
        ),
        "description": row.description,
        "connectionConfig": row.connection_config,
        "isActive": row.is_active,
        "code": row.code,
        "refreshInterval": row.refresh_interval,
        "linkedUploadId": row.linked_upload_id,
        # Hibernate lazy @OneToMany never loaded by the list query; always [].
        "fieldDefinitions": [],
        "deleted": row.deleted_at is not None,
    }


def _query_datasources(factory_id: str) -> List[dict]:
    """Return active datasources for a factory.

    Mirrors Java SmartBiSchemaServiceImpl.listDatasources, which calls
    SmartBiDatasourceRepository.findByFactoryIdAndIsActiveTrue. BaseEntity
    adds ``@Where(clause = "deleted_at IS NULL")`` so we filter the
    soft-deleted rows in SQL.

    No explicit ORDER BY: Java's findByFactoryIdAndIsActiveTrue does not
    add one, and the recorded golden was captured under PG's natural
    (effectively physical row) order. Adding ORDER BY here would diverge
    from Java byte-shape on ties.

    Isolated as a module-level function so contract tests can monkey-patch
    it without standing up a Postgres instance. Production calls go through
    smartbi.database.connection.get_db_context() against the SmartBI DB.
    """
    # Lazy import: keeps smartbi_compat tests independent of smartbi.database
    # initialisation when POSTGRES_ENABLED is unset (e.g. CI / unit tests).
    from smartbi.database.connection import get_db_context, is_postgres_enabled

    if not is_postgres_enabled():
        logger.warning(
            "datasource-list: postgres not enabled; returning [] "
            "(factory_id=%s)",
            factory_id,
        )
        return []

    sql = text(
        "SELECT id, name, source_type, factory_id, schema_version, "
        "last_schema_change, description, connection_config, is_active, "
        "code, refresh_interval, linked_upload_id, "
        "created_at, updated_at, deleted_at "
        "FROM smart_bi_datasource "
        "WHERE factory_id = :fid AND is_active = TRUE AND deleted_at IS NULL"
    )
    with get_db_context() as db:
        rows = db.execute(sql, {"fid": factory_id}).all()
    return [_datasource_row_to_dict(r) for r in rows]


@router.get("/api/mobile/{factory_id}/smart-bi/datasource/list")
async def list_datasources(
    factory_id: str,
    auth: AuthContext = Depends(verify_jwt_and_factory),
) -> dict[str, Any]:
    """Java-compatible alias: list active datasources for a factory.

    Uses ``auth.factory_id`` rather than the path ``factory_id`` to match
    dashboard.py's pattern; the auth dependency already enforces
    path-equals-token-factoryId, so the two are equivalent in practice.
    """
    rows = _query_datasources(auth.factory_id)
    return wrap_response(rows)
