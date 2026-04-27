"""Provenance writer — INSERT field_provenance rows with sentinel + dedup."""
from __future__ import annotations

import json
import logging
from datetime import date
from typing import TYPE_CHECKING, Any, List, Optional

from smartbi.canonical.provenance.types import ProvenanceValue

if TYPE_CHECKING:
    import asyncpg  # pragma: no cover — type-only import

logger = logging.getLogger(__name__)


# 0 is the sentinel upload_id reserved by V20260430_01 for non-upload sources
# (manual edits, system inference, industry defaults).
_SENTINEL_UPLOAD_ID = 0

_VALID_MAPPER_METHODS = ("manual", "rule", "embedding", "llm")


async def write_provenance(
    conn: "asyncpg.Connection",
    factory_id: str,
    entity_type: str,
    entity_id: int,
    field_name: str,
    field_value: Any,
    confidence: float,
    source_type: str,
    mapper_method: str,
    source_upload_id: Optional[int] = None,
    valid_from: Optional[date] = None,
    valid_to: Optional[date] = None,
    notes: Optional[str] = None,
) -> int:
    """Write a single provenance row and return its primary key.

    Tenant safety: the caller MUST set ``app.factory_id`` (or be inside a
    tenant-scoped pool conn). FORCE RLS WITH CHECK rejects the INSERT
    otherwise.

    Concurrency (spec C-3 / NS-3): callers should hold
    ``pg_advisory_xact_lock(99::int, hashtext(factory||entity_type||entity_id||field_name)::int)``
    around this call to prevent two writers racing on the same dedup key.
    The 2-arg form with namespace ``99`` is reserved here so we don't collide
    with B's 1-arg per-factory advisory lock.

    Day 1-5 simplification: if a duplicate row already exists for the dedup
    key (same factory/entity/field/valid_from + active), this raises
    ``asyncpg.UniqueViolationError``. Day 6+ conflict resolution will
    supersede the existing row before re-inserting.
    """
    if not factory_id:
        raise ValueError("factory_id is required")
    if not entity_type:
        raise ValueError("entity_type is required")
    if not field_name:
        raise ValueError("field_name is required")
    if not (0.0 <= float(confidence) <= 1.0):
        raise ValueError(f"confidence must be in [0.0, 1.0], got {confidence!r}")
    if mapper_method not in _VALID_MAPPER_METHODS:
        raise ValueError(
            f"mapper_method must be one of {_VALID_MAPPER_METHODS}, "
            f"got {mapper_method!r}"
        )
    if not source_type:
        raise ValueError("source_type is required")

    upload_id = (
        source_upload_id if source_upload_id is not None else _SENTINEL_UPLOAD_ID
    )

    # Serialize field_value to a JSONB-compatible string. Primitives, dicts,
    # and lists round-trip cleanly; anything else (e.g. Decimal, date) gets
    # str()-coerced via default=str so we never silently swallow an unknown
    # type.
    if isinstance(field_value, (str, int, float, bool)) or field_value is None:
        value_json = json.dumps(field_value, ensure_ascii=False)
    else:
        try:
            value_json = json.dumps(field_value, ensure_ascii=False, default=str)
        except (TypeError, ValueError) as exc:
            raise ValueError(f"field_value is not JSON-serializable: {exc}") from exc

    # COALESCE on valid_from: caller may pass None meaning "no anchor — use
    # DB default '-infinity'::date". asyncpg sends Python None as explicit
    # SQL NULL which bypasses column DEFAULT and trips NOT NULL constraint.
    # COALESCE($9, '-infinity'::date) handles both None and a real date.
    new_id = await conn.fetchval(
        """
        INSERT INTO field_provenance
          (factory_id, entity_type, entity_id, field_name, field_value,
           source_upload_id, source_type, confidence, valid_from, valid_to,
           mapper_method, notes)
        VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, $8,
                COALESCE($9::date, '-infinity'::date),
                $10, $11, $12)
        RETURNING id
        """,
        factory_id,
        entity_type,
        entity_id,
        field_name,
        value_json,
        upload_id,
        source_type,
        float(confidence),
        valid_from,
        valid_to,
        mapper_method,
        notes,
    )
    return int(new_id)


async def read_authoritative_value(
    conn: "asyncpg.Connection",
    factory_id: str,
    entity_type: str,
    entity_id: int,
    field_name: str,
    as_of: Optional[date] = None,
) -> Optional[ProvenanceValue]:
    """Read the most recent active value for ``(entity_type, entity_id, field_name)``.

    Day 1-5 simplification: returns the row with the latest ``valid_from``
    (then ``created_at``) where ``superseded_by_id IS NULL``. No
    factory_provenance_config priority resolution yet — that's Day 6+.

    If ``as_of`` is given, restricts to rows whose ``valid_from <= as_of``.
    """
    where_clauses: List[str] = [
        "factory_id = $1",
        "entity_type = $2",
        "entity_id = $3",
        "field_name = $4",
        "superseded_by_id IS NULL",
    ]
    params: List[Any] = [factory_id, entity_type, entity_id, field_name]
    if as_of is not None:
        where_clauses.append(f"valid_from <= ${len(params) + 1}")
        params.append(as_of)
    where_sql = " AND ".join(where_clauses)

    row = await conn.fetchrow(
        f"""
        SELECT field_value, confidence, source_upload_id, source_type,
               mapper_method, valid_from, valid_to, notes
        FROM field_provenance
        WHERE {where_sql}
        ORDER BY valid_from DESC NULLS LAST, created_at DESC
        LIMIT 1
        """,
        *params,
    )
    if row is None:
        return None
    return ProvenanceValue.from_row(dict(row))
