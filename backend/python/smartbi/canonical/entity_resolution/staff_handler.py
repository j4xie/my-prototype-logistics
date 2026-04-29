"""Half-auto STAFF dedup: same-store first-seen → autocreate; cross-store → admin queue."""
from __future__ import annotations

import json
from typing import TYPE_CHECKING, List

from smartbi.canonical.entity_resolution.agents.deterministic import normalize_for_dim

if TYPE_CHECKING:
    import asyncpg


# dim_staff has columns (factory_id, name, role, store_id) — no normalized_name
# column exists. Normalize in Python and compare against stored name on load.
_STAFF_INSERT_SQL = """
INSERT INTO dim_staff (factory_id, name, role, store_id)
VALUES ($1, $2, $3, $4)
ON CONFLICT (factory_id, name, store_id)
  DO UPDATE SET updated_at = NOW(),
                role = COALESCE(EXCLUDED.role, dim_staff.role)
RETURNING staff_id
"""


async def resolve_staff_with_autocreate(
    raw_name: str,
    factory_id: str,
    store_id: int,
    conn: "asyncpg.Connection",
) -> tuple[int, bool]:
    """Returns (staff_id, was_auto_created).

    same-store + name match → existing id, was_auto=False
    cross-store name match → new id, queue admin dedup, was_auto=True
    no match → autocreate new id, was_auto=True
    """
    if not raw_name:
        raise ValueError("raw_name required")
    if not store_id:
        raise ValueError("store_id required")

    normalized = normalize_for_dim(raw_name)

    same_store_rows = await conn.fetch(
        "SELECT staff_id, name FROM dim_staff "
        "WHERE factory_id = $1 AND store_id = $2",
        factory_id, store_id,
    )
    for row in same_store_rows:
        if normalize_for_dim(row["name"]) == normalized:
            return row["staff_id"], False

    cross_store_rows = await conn.fetch(
        "SELECT staff_id, store_id, name FROM dim_staff "
        "WHERE factory_id = $1 AND store_id != $2",
        factory_id, store_id,
    )
    cross_match_ids = [
        r["staff_id"] for r in cross_store_rows
        if normalize_for_dim(r["name"]) == normalized
    ]
    new_id = await conn.fetchval(
        _STAFF_INSERT_SQL, factory_id, raw_name, None, store_id,
    )
    if cross_match_ids:
        await _queue_staff_dedup_admin(
            conn, factory_id, raw_name, new_id, cross_match_ids,
        )
    return new_id, True


async def _queue_staff_dedup_admin(
    conn: "asyncpg.Connection",
    factory_id: str,
    raw_name: str,
    new_staff_id: int,
    candidate_ids: List[int],
) -> None:
    """Cross-store same-name → admin confirms whether same person."""
    await conn.execute(
        """
        INSERT INTO entity_resolution_admin_queue
          (factory_id, entity_type, raw_name, candidate_entity_id, confidence,
           decided_by_agent, dropped_row_refs)
        VALUES ($1, 'staff', $2, $3, 0.5, 'cross_store_heuristic', $4::jsonb)
        """,
        factory_id, raw_name, new_staff_id,
        json.dumps([
            {"candidate_staff_id": sid, "store_id": None}
            for sid in candidate_ids
        ]),
    )
