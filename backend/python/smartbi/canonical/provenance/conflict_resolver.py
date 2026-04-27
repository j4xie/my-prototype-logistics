"""Conflict resolution engine for field_provenance writes.

Per 04-C v1.3 §3.2 + §3.3:
- ``resolve_conflict()`` reads current authoritative + new value, decides:
    - "written": write new + supersede old (if priority warrants)
    - "queued":  30% diff or same-priority disagreement → admin queue
    - "no_change": new value identical / lower priority
- ``_get_factory_config()`` with 5-min TTL cache (per S-13)
- ``_compute_priority()`` runtime JOIN with factory override (per C-6, no
  persisted column)
"""
from __future__ import annotations

import asyncio
import json
import logging
import time
from datetime import date
from typing import TYPE_CHECKING, Any, Dict, Optional, Tuple

from smartbi.canonical.provenance.types import ProvenanceValue
from smartbi.canonical.provenance.writer import (
    read_authoritative_value,
    write_provenance,
)

if TYPE_CHECKING:
    import asyncpg  # pragma: no cover — type-only import

logger = logging.getLogger(__name__)


# Global priority table (lower = higher priority). Source: spec §3.1.
# This is the authoritative default; factory_provenance_config.priority_overrides
# can re-rank per-factory at runtime.
GLOBAL_PRIORITY_TABLE: Dict[str, int] = {
    "manual": 1,
    "bill_flow": 2,
    "product_summary": 3,
    "review": 4,
    "external_platform": 4,
    "pos_excel": 3,  # alias used by writer for spreadsheet-derived values
    "inferred": 5,
    "industry_default": 6,
}

_DEFAULT_DIFF_THRESHOLD = 0.30
_DEFAULT_TIME_WINDOW_DAYS = 7
_CACHE_TTL_SECONDS = 300

# Factory config cache: factory_id → (config_dict, expiry_epoch).
_factory_config_cache: Dict[str, Tuple[Dict[str, Any], float]] = {}
_cache_lock = asyncio.Lock()


# Field-type hints used by the 30%-diff safety check (C-7). Drop a known field
# into the right bucket; unknown fields default to "string" (treated as opaque).
# NOTE: not exhaustive — extend as B writers introduce new canonical fields.
_FIELD_TYPE_MAP: Dict[str, str] = {
    # numeric
    "cost_per_unit": "decimal",
    "revenue": "decimal",
    "qty_sold": "decimal",
    "avg_unit_price": "decimal",
    "rating": "decimal",
    "avg_rating": "decimal",
    "review_count": "int",
    "positive_count": "int",
    "negative_count": "int",
    "customer_count": "int",
    "stock_qty": "decimal",
    "safe_stock_qty": "decimal",
    "reorder_point": "decimal",
    "tax": "decimal",
    "tip": "decimal",
    "service_fee": "decimal",
    "debit_amount": "decimal",
    "credit_amount": "decimal",
    "balance": "decimal",
    # string
    "store_name": "string",
    "product_name": "string",
    "category": "string",
    "brand": "string",
    "city": "string",
    "unit": "string",
    # array/object
    "top_keywords": "array",
    "tags": "array",
}


def _field_type(field_name: str) -> str:
    """Return ``'decimal'`` / ``'int'`` / ``'string'`` / ``'array'`` / ``'object'``."""
    return _FIELD_TYPE_MAP.get(field_name, "string")


async def _get_factory_config(
    conn: "asyncpg.Connection", factory_id: str
) -> Dict[str, Any]:
    """Read ``factory_provenance_config`` with 5-min TTL cache.

    Returns dict with keys:
      ``diff_threshold`` (float)
      ``priority_overrides`` (dict[str, int] or None)
      ``industry_default_overrides`` (dict[str, float] or None)
      ``time_inheritance_window_days`` (int)

    Defaults are returned for missing rows or fields. Per S-13 (cache).
    """
    async with _cache_lock:
        cached = _factory_config_cache.get(factory_id)
        if cached and cached[1] > time.time():
            return cached[0]

    row = await conn.fetchrow(
        """
        SELECT diff_threshold, priority_overrides,
               industry_default_overrides, time_inheritance_window_days
          FROM factory_provenance_config
         WHERE factory_id = $1
        """,
        factory_id,
    )

    config: Dict[str, Any]
    if row is None:
        config = {
            "diff_threshold": _DEFAULT_DIFF_THRESHOLD,
            "priority_overrides": None,
            "industry_default_overrides": None,
            "time_inheritance_window_days": _DEFAULT_TIME_WINDOW_DAYS,
        }
    else:
        # asyncpg may return JSONB columns as either str or dict depending on
        # codec config; normalize either form to dict.
        po = row["priority_overrides"]
        if isinstance(po, str):
            po = json.loads(po)
        ido = row["industry_default_overrides"]
        if isinstance(ido, str):
            ido = json.loads(ido)
        config = {
            "diff_threshold": float(row["diff_threshold"]),
            "priority_overrides": po,
            "industry_default_overrides": ido,
            "time_inheritance_window_days": int(row["time_inheritance_window_days"]),
        }

    async with _cache_lock:
        _factory_config_cache[factory_id] = (config, time.time() + _CACHE_TTL_SECONDS)
    return config


def invalidate_factory_config_cache(factory_id: Optional[str] = None) -> None:
    """Drop cached config for a factory (or all). Call after admin UI updates."""
    if factory_id is None:
        _factory_config_cache.clear()
    else:
        _factory_config_cache.pop(factory_id, None)


def _compute_priority(source_type: str, factory_config: Dict[str, Any]) -> int:
    """Resolve priority: factory override > GLOBAL_PRIORITY_TABLE > 5 (inferred)."""
    overrides = factory_config.get("priority_overrides")
    if overrides and source_type in overrides:
        try:
            return int(overrides[source_type])
        except (TypeError, ValueError):
            pass
    return GLOBAL_PRIORITY_TABLE.get(source_type, 5)


def _values_equal(a: Any, b: Any, field_type: str) -> bool:
    """Type-aware equality. Numerics compare with float tolerance."""
    if a is None and b is None:
        return True
    if a is None or b is None:
        return False
    if field_type in ("decimal", "int"):
        try:
            return abs(float(a) - float(b)) < 1e-9
        except (TypeError, ValueError):
            return False
    if field_type in ("array", "object"):
        try:
            return json.dumps(a, sort_keys=True) == json.dumps(b, sort_keys=True)
        except TypeError:
            return a == b
    return str(a) == str(b)


def _is_significant_diff(
    current_value: Any, new_value: Any, field_type: str, threshold: float
) -> bool:
    """C-7 safe diff: ``current=0`` / strings / arrays handled separately."""
    if field_type in ("decimal", "int"):
        try:
            cur = float(current_value or 0)
            new = float(new_value or 0)
        except (TypeError, ValueError):
            return False
        if cur == 0 and new != 0:
            return True
        if cur == 0:
            return False
        return abs(new - cur) / abs(cur) > threshold
    # strings/arrays: any different value at >= same priority is significant
    return not _values_equal(current_value, new_value, field_type)


async def _enqueue_field_conflict(
    conn: "asyncpg.Connection",
    factory_id: str,
    entity_type: str,
    entity_id: int,
    field_name: str,
    current: Optional[ProvenanceValue],
    current_priority: int,
    new_value: Any,
    new_source_type: str,
    new_priority: int,
    new_confidence: float,
    diff_threshold: float,
) -> None:
    """Insert into ``entity_resolution_admin_queue`` with ``entity_type='field_conflict'``.

    Re-uses B's admin queue table (per spec §3.5.1 S-23). ``raw_name`` carries
    the field locator ``'entity_type:entity_id.field_name'``. ``extra`` JSONB has
    full conflict details for the admin UI.
    """
    raw_name = f"{entity_type}:{entity_id}.{field_name}"
    extra = {
        "field_name": field_name,
        "entity_type": entity_type,
        "entity_id": entity_id,
        "current_value": current.field_value if current else None,
        "current_source_type": current.source_type if current else None,
        "current_priority": current_priority,
        "new_value": new_value,
        "new_source_type": new_source_type,
        "new_priority": new_priority,
        "new_confidence": new_confidence,
        "diff_threshold": diff_threshold,
    }
    reasoning = (
        f"diff > {diff_threshold * 100:.0f}%: "
        f"old={current.field_value if current else 'NULL'} "
        f"(prio {current_priority}) → new={new_value} (prio {new_priority})"
    )
    await conn.execute(
        """
        INSERT INTO entity_resolution_admin_queue
          (factory_id, entity_type, raw_name, candidate_entity_id, confidence,
           decided_by_agent, reasoning, priority, status, extra)
        VALUES ($1, 'field_conflict', $2, $3, NULL,
                'provenance_conflict_detector', $4, 'medium', 'PENDING', $5::jsonb)
        """,
        factory_id,
        raw_name,
        entity_id,
        reasoning,
        json.dumps(extra, default=str, ensure_ascii=False),
    )


async def resolve_conflict(
    conn: "asyncpg.Connection",
    factory_id: str,
    entity_type: str,
    entity_id: int,
    field_name: str,
    new_value: Any,
    confidence: float,
    source_type: str,
    mapper_method: str,
    source_upload_id: Optional[int] = None,
    valid_from: Optional[date] = None,
    valid_to: Optional[date] = None,
    notes: Optional[str] = None,
) -> Dict[str, Any]:
    """Decide write vs queue vs no-change based on existing authoritative value.

    Returns: ``{"action": "written" | "queued" | "no_change", "id": int | None,
    "reason": str}``.

    Caller MUST be inside ``conn.transaction()`` — ``write_provenance`` grabs an
    advisory lock on the cell key before INSERT, which only holds inside a tx.

    Per spec §3.2 + §3.3:
      1. Read factory config (cached) → diff_threshold, priority_overrides
      2. Read current authoritative value via ``read_authoritative_value``
      3. If no current: write directly
      4. If current value == new value: ``no_change``
      5. Compute new_priority + current_priority
      6. If new_priority < current_priority: write + supersede current
      7. Else (>= same priority):
         - significant diff → enqueue, no write
         - non-significant diff → write (low priority but newer info)
    """
    factory_config = await _get_factory_config(conn, factory_id)
    diff_threshold = factory_config["diff_threshold"]
    new_priority = _compute_priority(source_type, factory_config)
    field_type = _field_type(field_name)

    current = await read_authoritative_value(
        conn, factory_id, entity_type, entity_id, field_name
    )

    if current is None:
        new_id = await write_provenance(
            conn,
            factory_id=factory_id,
            entity_type=entity_type,
            entity_id=entity_id,
            field_name=field_name,
            field_value=new_value,
            confidence=confidence,
            source_type=source_type,
            mapper_method=mapper_method,
            source_upload_id=source_upload_id,
            valid_from=valid_from,
            valid_to=valid_to,
            notes=notes,
        )
        return {"action": "written", "id": new_id, "reason": "no_prior_value"}

    if _values_equal(current.field_value, new_value, field_type):
        return {"action": "no_change", "id": None, "reason": "value_unchanged"}

    current_priority = _compute_priority(current.source_type, factory_config)

    # Higher priority always wins (lower number = higher).
    if new_priority < current_priority:
        # Order matters: must mark prior superseded BEFORE inserting the new
        # row. The uq_fp_dedup partial unique index covers
        # (factory, entity_type, entity_id, field_name, COALESCE(valid_from, '-infinity'))
        # WHERE superseded_by_id IS NULL — so two active rows on the same dedup
        # key would collide. We supersede the prior to a sentinel id (-1) first
        # to free the dedup slot, then INSERT the new row, then UPDATE the
        # prior's superseded_by_id to the real new row id.
        prior_id = await conn.fetchval(
            """
            SELECT id FROM field_provenance
             WHERE factory_id = $1 AND entity_type = $2 AND entity_id = $3
               AND field_name = $4 AND superseded_by_id IS NULL
             ORDER BY valid_from DESC NULLS LAST, created_at DESC
             LIMIT 1
            """,
            factory_id, entity_type, entity_id, field_name,
        )
        if prior_id is not None:
            # Self-reference is the safest sentinel: it's a real existing id, so
            # the FK is happy. Once the new row exists we re-point this column.
            await conn.execute(
                """
                UPDATE field_provenance
                   SET superseded_by_id = id,
                       superseded_reason = 'higher_priority'
                 WHERE id = $1
                """,
                prior_id,
            )

        new_id = await write_provenance(
            conn,
            factory_id=factory_id,
            entity_type=entity_type,
            entity_id=entity_id,
            field_name=field_name,
            field_value=new_value,
            confidence=confidence,
            source_type=source_type,
            mapper_method=mapper_method,
            source_upload_id=source_upload_id,
            valid_from=valid_from,
            valid_to=valid_to,
            notes=notes,
        )

        if prior_id is not None:
            # Re-point the prior row's superseded_by_id from itself to the new
            # row so the audit chain reads correctly.
            await conn.execute(
                """
                UPDATE field_provenance
                   SET superseded_by_id = $1
                 WHERE id = $2
                """,
                new_id, prior_id,
            )
        return {"action": "written", "id": new_id, "reason": "higher_priority"}

    # Same-or-lower priority: only write if the change isn't "significant".
    if _is_significant_diff(current.field_value, new_value, field_type, diff_threshold):
        await _enqueue_field_conflict(
            conn,
            factory_id=factory_id,
            entity_type=entity_type,
            entity_id=entity_id,
            field_name=field_name,
            current=current,
            current_priority=current_priority,
            new_value=new_value,
            new_source_type=source_type,
            new_priority=new_priority,
            new_confidence=confidence,
            diff_threshold=diff_threshold,
        )
        return {
            "action": "queued",
            "id": None,
            "reason": "significant_diff_same_or_lower_priority",
        }

    # Same-or-lower priority + minor diff: existing value already covers it.
    # We can't INSERT a new row at the same dedup key (factory, entity_type,
    # entity_id, field_name, valid_from) without superseding — and superseding
    # for a tiny float drift would churn history. Spec §3.3 doesn't mandate a
    # write here; cleanest semantics is "ignore."
    return {
        "action": "no_change",
        "id": None,
        "reason": "minor_diff_same_or_lower_priority",
    }
