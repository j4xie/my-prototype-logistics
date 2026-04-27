"""Provenance writer — INSERT field_provenance rows with sentinel + dedup."""
from __future__ import annotations

import hashlib
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

# Namespace=99 reserved for C field-conflict advisory locks. B uses the 1-arg
# form per-factory (concurrency.py), so the 2-arg form with namespace 99
# can't collide with B even if hash keys happen to match.
_C_FIELD_LOCK_NAMESPACE = 99


def _field_lock_key(
    factory_id: str, entity_type: str, entity_id: int, field_name: str
) -> int:
    """Stable int4 hash for pg_advisory_xact_lock (signed 32-bit range).

    Uses md5 (not Python's builtin hash) so it's stable across processes and
    immune to PYTHONHASHSEED randomization. Mirrors B's _factory_lock_key
    pattern in smartbi.canonical.concurrency.
    """
    payload = f"{factory_id}|{entity_type}|{entity_id}|{field_name}".encode("utf-8")
    return int(hashlib.md5(payload).hexdigest()[:8], 16) % (2**31)


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

    Concurrency (spec C-3 / NS-3): this function acquires
    ``pg_advisory_xact_lock(99, md5_int(factory||entity_type||entity_id||field_name))``
    INTERNALLY before the INSERT — callers no longer need to manage the
    lock manually. Namespace ``99`` is reserved for C field-conflict locks
    so we don't collide with B's 1-arg per-factory lock.

    Caller MUST already be inside ``conn.transaction()`` because
    ``pg_advisory_xact_lock`` is transaction-scoped (released automatically
    on COMMIT/ROLLBACK). Calling outside a transaction silently no-ops the
    lock, which defeats the whole point.

    PG advisory locks are reentrant within the same session, so a caller
    that invokes ``write_provenance`` multiple times in one transaction
    won't deadlock — the lock counter increments and decrements normally.

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

    # Spec C-3 / NS-3: acquire field-conflict advisory lock BEFORE the
    # INSERT so two writers racing on the same (factory, entity, field) dedup
    # key serialize at the PG layer. xact-scoped → released on COMMIT/ROLLBACK.
    # Reentrant within the same session, so multiple write_provenance calls
    # in one transaction won't deadlock.
    lock_key = _field_lock_key(factory_id, entity_type, entity_id, field_name)
    await conn.execute(
        "SELECT pg_advisory_xact_lock($1::int, $2::int)",
        _C_FIELD_LOCK_NAMESPACE,
        lock_key,
    )

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

    Validity window (spec 04-C v1.3 §3.2): the result row must satisfy BOTH
    ``valid_from <= as_of`` AND ``(valid_to IS NULL OR valid_to >= as_of)``
    so a superseded-by-time-window row from a previous period doesn't leak
    into a later query. ``as_of`` defaults to ``date.today()`` when omitted —
    callers that want absolute-latest semantics still pay the valid_to filter
    against today, which matches the intent (an expired row should not be
    returned just because the caller forgot to specify the date).
    """
    target_date = as_of if as_of is not None else date.today()
    where_clauses: List[str] = [
        "factory_id = $1",
        "entity_type = $2",
        "entity_id = $3",
        "field_name = $4",
        "superseded_by_id IS NULL",
        "valid_from <= $5",
        "(valid_to IS NULL OR valid_to >= $6)",
    ]
    params: List[Any] = [
        factory_id,
        entity_type,
        entity_id,
        field_name,
        target_date,
        target_date,
    ]
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
