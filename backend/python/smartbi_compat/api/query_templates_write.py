"""Phase 2A WRITE endpoints for /smart-bi/query-templates.

POST/PUT/DELETE — verbatim Java byte-shape mirror.
GET is in analysis.py:53-130 (Apr 28 T5b work).

Java reference: SmartBIAnalysisController.java:965-1009.
Empirical Java behavior recorded 2026-05-02 against test env (10011).
See docs/superpowers/specs/2026-05-01-phase2a-query-templates-design.md §2.2.
"""
from __future__ import annotations

import logging
from datetime import datetime
from typing import Any, Optional

from fastapi import APIRouter, Body, Depends, Path
from sqlalchemy import text

from smartbi_compat.auth import AuthContext, verify_jwt_and_factory
from smartbi_compat.api.analysis import _row_to_dict as _query_template_row_to_dict
from smartbi_compat.schema_compat import _java_isoformat

router = APIRouter()
logger = logging.getLogger(__name__)


# ============================================================
# Envelope helpers (mirror Java ApiResponse.success / .error)
# ============================================================

def _now_iso_nano() -> str:
    """ISO-format current time. Volatile — stripped by test helper.

    Uses ``_java_isoformat`` so the format mirrors Java Jackson
    ``LocalDateTime`` (Rule 11) — keeps the envelope timestamp consistent
    with non-volatile timestamps elsewhere.
    """
    return _java_isoformat(datetime.now())


def _envelope_success(data: Any, message: str = "操作成功") -> dict:
    return {
        "code": 200,
        "message": message,
        "data": data,
        "timestamp": _now_iso_nano(),
        "success": True,
        "actionHint": None,
        "severity": None,
        "hintTarget": None,
    }


def _envelope_error(message: str, code: int = 400) -> dict:
    return {
        "code": code,
        "message": message,
        "data": None,
        "timestamp": _now_iso_nano(),
        "success": False,
        "actionHint": None,
        "severity": None,
        "hintTarget": None,
    }


# ============================================================
# Module-level DB helpers (monkeypatch surface for tests)
# ============================================================

def _create_template(factory_id: str, body: dict) -> Optional[dict]:
    """INSERT (no body.id) or MERGE (body.id non-null).

    Returns entity dict in Java field order (with synthetic `deleted` boolean).
    For the merge path, mirrors Java JPA quirk: response.createdAt = None.

    Mirrors Java SmartBIAnalysisController.java:965-973.
    Returns None if postgres is disabled.
    """
    from smartbi.database.connection import get_cretas_db_context, is_postgres_enabled

    if not is_postgres_enabled():
        logger.warning("query-templates write: postgres not enabled (factory_id=%s)", factory_id)
        return None

    body_id = body.get("id")
    name = body.get("name")
    category = body.get("category")
    description = body.get("description")
    query_template = body.get("queryTemplate")
    parameters = body.get("parameters")

    with get_cretas_db_context() as db:
        if body_id is not None:
            sql = text(
                "INSERT INTO smart_bi_query_templates "
                "  (id, factory_id, name, category, description, "
                "   query_template, parameters, created_at, updated_at, deleted_at) "
                "VALUES (:id, :fid, :name, :category, :description, "
                "        :query_template, :parameters, NOW(), NOW(), NULL) "
                "ON CONFLICT (id) DO UPDATE SET "
                "  factory_id = EXCLUDED.factory_id, "
                "  name = EXCLUDED.name, "
                "  category = EXCLUDED.category, "
                "  description = EXCLUDED.description, "
                "  query_template = EXCLUDED.query_template, "
                "  parameters = EXCLUDED.parameters, "
                "  updated_at = NOW() "
                "RETURNING id, factory_id, name, category, description, "
                "          query_template, parameters, created_at, updated_at, deleted_at"
            )
            row = db.execute(sql, {
                "id": body_id, "fid": factory_id, "name": name,
                "category": category, "description": description,
                "query_template": query_template, "parameters": parameters,
            }).first()
            db.commit()
            if row is None:
                return None
            entity = _query_template_row_to_dict(row)
            # Java JPA quirk: merge returns transient entity, response.createdAt = None
            entity["createdAt"] = None
            return entity
        else:
            sql = text(
                "INSERT INTO smart_bi_query_templates "
                "  (factory_id, name, category, description, "
                "   query_template, parameters, created_at, updated_at, deleted_at) "
                "VALUES (:fid, :name, :category, :description, "
                "        :query_template, :parameters, NOW(), NOW(), NULL) "
                "RETURNING id, factory_id, name, category, description, "
                "          query_template, parameters, created_at, updated_at, deleted_at"
            )
            row = db.execute(sql, {
                "fid": factory_id, "name": name, "category": category,
                "description": description, "query_template": query_template,
                "parameters": parameters,
            }).first()
            db.commit()
            return _query_template_row_to_dict(row) if row else None


def _update_template(factory_id: str, template_id: int, body: dict) -> Optional[dict]:
    """findById + factoryId filter + 5-field update.

    Returns updated entity dict, or None if not found / cross-factory.
    Body's id and factoryId are IGNORED (mirror Java line 985-989).

    Mirrors Java SmartBIAnalysisController.java:976-994.
    """
    from smartbi.database.connection import get_cretas_db_context, is_postgres_enabled

    if not is_postgres_enabled():
        return None

    with get_cretas_db_context() as db:
        existing_check = text(
            "SELECT id FROM smart_bi_query_templates "
            "WHERE id = :id AND factory_id = :fid AND deleted_at IS NULL"
        )
        existing = db.execute(existing_check, {"id": template_id, "fid": factory_id}).first()
        if existing is None:
            return None

        sql = text(
            "UPDATE smart_bi_query_templates "
            "SET name = :name, "
            "    category = :category, "
            "    description = :description, "
            "    query_template = :query_template, "
            "    parameters = :parameters, "
            "    updated_at = NOW() "
            "WHERE id = :id "
            "RETURNING id, factory_id, name, category, description, "
            "          query_template, parameters, created_at, updated_at, deleted_at"
        )
        row = db.execute(sql, {
            "id": template_id,
            "name": body.get("name"),
            "category": body.get("category"),
            "description": body.get("description"),
            "query_template": body.get("queryTemplate"),
            "parameters": body.get("parameters"),
        }).first()
        db.commit()
        return _query_template_row_to_dict(row) if row else None


def _delete_template(factory_id: str, template_id: int) -> bool:
    """findById + factoryId filter + HARD DELETE.

    Returns True if deleted, False if not found / cross-factory.
    HARD DELETE — entity's @Where(deleted_at IS NULL) is a READ filter only.

    Mirrors Java SmartBIAnalysisController.java:997-1009.
    """
    from smartbi.database.connection import get_cretas_db_context, is_postgres_enabled

    if not is_postgres_enabled():
        return False

    with get_cretas_db_context() as db:
        existing_check = text(
            "SELECT id FROM smart_bi_query_templates "
            "WHERE id = :id AND factory_id = :fid AND deleted_at IS NULL"
        )
        existing = db.execute(existing_check, {"id": template_id, "fid": factory_id}).first()
        if existing is None:
            return False

        db.execute(
            text("DELETE FROM smart_bi_query_templates WHERE id = :id"),
            {"id": template_id},
        )
        db.commit()
        return True


# ============================================================
# Endpoints
# ============================================================

def _require_nonempty_name(body: dict) -> Optional[dict]:
    """Return envelope error if body.name is missing/blank, else None.

    Java handler deleted in T6.5; no parity constraint. Returning explicit
    400 with envelope shape is consistent with `_envelope_error` UX everywhere
    else in this module and avoids the DB-level NOT NULL constraint surfacing
    as a 500 (the original P2 finding).
    """
    name = body.get("name")
    if name is None or (isinstance(name, str) and not name.strip()):
        return _envelope_error("name is required", code=400)
    return None


@router.post("/api/mobile/{factory_id}/smart-bi/query-templates")
async def create_query_template(
    factory_id: str = Path(..., min_length=1),
    body: dict = Body(default_factory=dict),
    auth: AuthContext = Depends(verify_jwt_and_factory),
) -> dict:
    """Mirror Java SmartBIAnalysisController.createQueryTemplate (deleted in T6.5)."""
    err = _require_nonempty_name(body)
    if err is not None:
        return err
    entity = _create_template(factory_id, body)
    if entity is None:
        return _envelope_error("Database unavailable", code=500)
    return _envelope_success(entity)


@router.put("/api/mobile/{factory_id}/smart-bi/query-templates/{template_id}")
async def update_query_template(
    factory_id: str = Path(..., min_length=1),
    template_id: int = Path(...),
    body: dict = Body(default_factory=dict),
    auth: AuthContext = Depends(verify_jwt_and_factory),
) -> dict:
    """Mirror Java SmartBIAnalysisController.updateQueryTemplate (deleted in T6.5)."""
    err = _require_nonempty_name(body)
    if err is not None:
        return err
    entity = _update_template(factory_id, template_id, body)
    if entity is None:
        return _envelope_error("Template not found")
    return _envelope_success(entity)


@router.delete("/api/mobile/{factory_id}/smart-bi/query-templates/{template_id}")
async def delete_query_template(
    factory_id: str = Path(..., min_length=1),
    template_id: int = Path(...),
    auth: AuthContext = Depends(verify_jwt_and_factory),
) -> dict:
    """Mirror Java SmartBIAnalysisController.deleteQueryTemplate (line 997-1009)."""
    deleted = _delete_template(factory_id, template_id)
    if not deleted:
        return _envelope_error("Template not found")
    return _envelope_success(None)
