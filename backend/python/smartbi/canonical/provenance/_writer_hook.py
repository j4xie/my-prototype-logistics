"""Dual-write hook for B Silver writers.

Per spec 04-C v1.3 §5.2: each B writer, after its main INSERT, optionally
calls write_provenance_for_fields() to record cell-level lineage. Gated by
SMARTBI_ENABLE_PROVENANCE env flag (default OFF until prod observation
confirms safety).

The hook uses resolve_conflict() so concurrent uploads of the same product/
field with different values either supersede correctly (priority-based) or
queue for admin review (30% diff). Writers always pass their canonical
source_type ('product_summary' / 'review' / 'bill_flow' / 'inventory') so the
priority chain works correctly.
"""
from __future__ import annotations

import logging
import os
from datetime import date
from typing import TYPE_CHECKING, Any, Dict, Optional

if TYPE_CHECKING:
    import asyncpg


logger = logging.getLogger(__name__)


def is_provenance_enabled() -> bool:
    """Env flag SMARTBI_ENABLE_PROVENANCE (default OFF; opt-in via 1/true/yes/on)."""
    val = os.environ.get("SMARTBI_ENABLE_PROVENANCE", "0").strip().lower()
    return val in ("1", "true", "yes", "on")


async def write_provenance_for_fields(
    conn: "asyncpg.Connection",
    factory_id: str,
    entity_type: str,
    entity_id: int,
    fields: Dict[str, Any],
    source_type: str,
    mapper_method: str,
    confidence: float,
    source_upload_id: Optional[int] = None,
    valid_from: Optional[date] = None,
    valid_to: Optional[date] = None,
) -> Dict[str, int]:
    """Write provenance rows for a batch of cells on the same entity.

    Args:
        fields: Mapping of field_name -> field_value. NULL/None values skipped.
        Other args mirror resolve_conflict() / write_provenance().

    Returns: counter dict {"written": N, "queued": M, "no_change": K, "skipped_null": P}.

    Caller MUST be inside conn.transaction(). Each resolve_conflict() takes an
    advisory lock per (factory, entity_type, entity_id, field_name) — the lock
    is xact-scoped so it's released when the writer's transaction commits.

    Errors are logged but NOT re-raised, so a provenance failure can't block
    the main Silver write. (Day 6+ blocker mitigation: env-flag default OFF
    means most uploads skip this entirely until we're confident.)
    """
    from smartbi.canonical.provenance.conflict_resolver import resolve_conflict

    counts: Dict[str, int] = {
        "written": 0,
        "queued": 0,
        "no_change": 0,
        "skipped_null": 0,
    }
    for field_name, value in fields.items():
        if value is None:
            counts["skipped_null"] += 1
            continue
        try:
            result = await resolve_conflict(
                conn,
                factory_id=factory_id,
                entity_type=entity_type,
                entity_id=entity_id,
                field_name=field_name,
                new_value=value,
                confidence=confidence,
                source_type=source_type,
                mapper_method=mapper_method,
                source_upload_id=source_upload_id,
                valid_from=valid_from,
                valid_to=valid_to,
            )
            action = result.get("action", "unknown")
            counts[action] = counts.get(action, 0) + 1
        except Exception as exc:  # log + swallow per docstring
            logger.warning(
                "provenance write failed: factory=%s entity=%s:%s field=%s err=%s",
                factory_id,
                entity_type,
                entity_id,
                field_name,
                exc,
            )
    return counts
