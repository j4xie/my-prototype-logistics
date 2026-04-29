"""field_registry service — global mapper-result cache.

Problem it solves
-----------------
semantic_mapper.py resolves raw Excel columns to canonical fields via
rule → embedding → LLM, taking 0.5-5 seconds per column for LLM fallback.
A typical qhj upload has 40-80 raw columns × 100 stores' repeat uploads;
without caching, the same "商品名称" → product_name LLM call fires thousands
of times. This registry caches resolved mappings keyed by
(source_type, source_version, normalizer_version, raw_column) so the second
sighting is a 0ms PK lookup.

Scope
-----
**Global**, not tenant-scoped. One tenant's resolution benefits all tenants
(mapping the Chinese string "商品名称" to product_name is universal knowledge,
not tenant secret). RLS deliberately NOT applied.

Manual overrides (mapper_method='manual') are sticky — upserts from automated
mappers must NOT overwrite them. Admin UI (Week 4) corrects low-confidence
auto-mappings; those corrections persist across mapper logic changes.

Invalidation
------------
Mapper logic changes bump `normalizer_version` in code. Old rows stay for
audit but are no longer hit (different PK). No DELETE, no migration churn.

Contract for callers (Silver.normalizer, Week 2)
------------------------------------------------
1. Call ``lookup_batch(source_type, source_version, raw_columns)``.
2. For each miss, run your own mapper (rule/embedding/LLM).
3. Call ``upsert(..., mapper_method='rule'|'embedding'|'llm', confidence=...)``
   for each newly-resolved mapping. Upserts skip rows where existing
   mapper_method='manual' (see ``_UPSERT_SQL``).
"""
from __future__ import annotations

import json
import logging
from dataclasses import dataclass
from typing import Any, Dict, Iterable, List, Optional, Sequence

import asyncpg

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class RegistryEntry:
    """One resolved mapping as stored in field_registry."""
    source_type: str
    source_version: str
    normalizer_version: str
    raw_column: str
    canonical_field: Optional[str]
    domain: Optional[str]
    role: Optional[str]
    mapper_method: str  # 'rule' | 'embedding' | 'llm' | 'manual'
    confidence: float
    sample_values: Optional[List[Any]] = None


@dataclass(frozen=True)
class RegistryLookupResult:
    """Result of a batch lookup: split into hits and misses.

    `hits` is keyed by raw_column so the caller can merge them with mapper
    output for misses. `misses` is the list of raw_columns the caller
    must resolve themselves.
    """
    hits: Dict[str, RegistryEntry]
    misses: List[str]


# Max `sample_values` stored per row — enough to illustrate the column to an
# admin without bloating the JSONB column. Enforced at write time.
_SAMPLE_VALUES_CAP = 5


# `ON CONFLICT ... DO UPDATE` with a guard clause: never overwrite a manual
# mapping with an automated one. The WHERE clause on the DO UPDATE is what
# gives us the "manual is sticky" invariant. Automated re-resolutions still
# refresh sample_values and confidence for the same mapper_method.
_UPSERT_SQL = """
INSERT INTO field_registry (
    source_type, source_version, normalizer_version, raw_column,
    canonical_field, domain, role,
    mapper_method, confidence, sample_values,
    reviewed_by, reviewed_at
) VALUES (
    $1, $2, $3, $4,
    $5, $6, $7,
    $8, $9, $10,
    $11, $12
)
ON CONFLICT (source_type, source_version, normalizer_version, raw_column)
DO UPDATE SET
    canonical_field = EXCLUDED.canonical_field,
    domain          = EXCLUDED.domain,
    role            = EXCLUDED.role,
    mapper_method   = EXCLUDED.mapper_method,
    confidence      = EXCLUDED.confidence,
    sample_values   = EXCLUDED.sample_values
WHERE field_registry.mapper_method <> 'manual'
   OR EXCLUDED.mapper_method = 'manual'
"""


_LOOKUP_SQL = """
SELECT source_type, source_version, normalizer_version, raw_column,
       canonical_field, domain, role,
       mapper_method, confidence, sample_values
  FROM field_registry
 WHERE source_type       = $1
   AND source_version    = $2
   AND normalizer_version = $3
   AND raw_column = ANY($4::varchar[])
"""


class FieldRegistry:
    """Thin async service layer over the field_registry table.

    Holds no state besides the pool + normalizer_version. Safe to instantiate
    per-request or once per process; connection pooling is the asyncpg pool's
    job.
    """

    def __init__(self, pool: asyncpg.Pool, normalizer_version: str):
        if not normalizer_version:
            raise ValueError("normalizer_version required — bump it when mapper logic changes")
        self.pool = pool
        self.normalizer_version = normalizer_version

    async def lookup_batch(
        self,
        source_type: str,
        source_version: str,
        raw_columns: Sequence[str],
    ) -> RegistryLookupResult:
        """Look up many raw_columns in one round-trip.

        Empty input → empty result (no query). Duplicate raw_columns in the
        input are de-duplicated; the caller can fan results back out.
        """
        unique_cols = list(dict.fromkeys(raw_columns))  # preserves order, de-dupes
        if not unique_cols:
            return RegistryLookupResult(hits={}, misses=[])

        async with self.pool.acquire() as conn:
            rows = await conn.fetch(
                _LOOKUP_SQL,
                source_type,
                source_version,
                self.normalizer_version,
                unique_cols,
            )

        hits: Dict[str, RegistryEntry] = {}
        for r in rows:
            sv = r["sample_values"]
            # asyncpg decodes JSONB to Python types when jsonb codec is set
            # up; in this project it isn't globally, so the raw string comes
            # back. Decode defensively.
            if isinstance(sv, str):
                try:
                    sv = json.loads(sv)
                except json.JSONDecodeError:
                    sv = None
            hits[r["raw_column"]] = RegistryEntry(
                source_type=r["source_type"],
                source_version=r["source_version"],
                normalizer_version=r["normalizer_version"],
                raw_column=r["raw_column"],
                canonical_field=r["canonical_field"],
                domain=r["domain"],
                role=r["role"],
                mapper_method=r["mapper_method"],
                confidence=float(r["confidence"]),
                sample_values=sv,
            )

        misses = [c for c in unique_cols if c not in hits]
        return RegistryLookupResult(hits=hits, misses=misses)

    async def _execute_upsert(
        self,
        conn,
        *,
        source_type: str,
        source_version: str,
        raw_column: str,
        canonical_field: Optional[str],
        domain: Optional[str],
        role: Optional[str],
        mapper_method: str,
        confidence: float,
        sample_values: Optional[Iterable[Any]] = None,
        reviewed_by: Optional[int] = None,
    ) -> None:
        if mapper_method not in ("rule", "embedding", "llm", "manual"):
            raise ValueError(f"Invalid mapper_method: {mapper_method}")
        if not (0.0 <= confidence <= 1.0):
            raise ValueError(f"confidence must be 0..1, got {confidence}")

        sv_capped: Optional[str] = None
        if sample_values is not None:
            sv_list = list(sample_values)[:_SAMPLE_VALUES_CAP]
            sv_capped = json.dumps(sv_list, ensure_ascii=False, default=str)

        reviewed_at = None
        # Only manual mappings carry reviewer metadata; automated ones don't
        # need "reviewed" status — they go through the `needs_review` partial
        # index instead based on confidence < 0.7.
        if mapper_method == "manual":
            if reviewed_by is None:
                raise ValueError("manual mappings require reviewed_by (admin user id)")
            from datetime import datetime
            reviewed_at = datetime.utcnow()

        await conn.execute(
            _UPSERT_SQL,
            source_type,
            source_version,
            self.normalizer_version,
            raw_column,
            canonical_field,
            domain,
            role,
            mapper_method,
            confidence,
            sv_capped,
            reviewed_by,
            reviewed_at,
        )

    async def upsert(
        self,
        *,
        source_type: str,
        source_version: str,
        raw_column: str,
        canonical_field: Optional[str],
        domain: Optional[str],
        role: Optional[str],
        mapper_method: str,
        confidence: float,
        sample_values: Optional[Iterable[Any]] = None,
        reviewed_by: Optional[int] = None,
    ) -> None:
        """Upsert one mapping. Manual rows are not overwritten by automated
        ones (invariant: once an admin says "this is product_name", it stays
        product_name until another admin changes it)."""
        async with self.pool.acquire() as conn:
            await self._execute_upsert(
                conn,
                source_type=source_type,
                source_version=source_version,
                raw_column=raw_column,
                canonical_field=canonical_field,
                domain=domain,
                role=role,
                mapper_method=mapper_method,
                confidence=confidence,
                sample_values=sample_values,
                reviewed_by=reviewed_by,
            )

    async def upsert_many(
        self,
        entries: Sequence[RegistryEntry],
        *,
        reviewed_by: Optional[int] = None,
    ) -> None:
        """Batch upsert in one transaction.

        All entries must share this service's normalizer_version (drift is
        almost always a bug). Manual entries pick up reviewed_by from the
        parameter; automated entries ignore it.
        """
        if not entries:
            return
        for e in entries:
            if e.normalizer_version != self.normalizer_version:
                raise ValueError(
                    f"Entry normalizer_version {e.normalizer_version!r} "
                    f"doesn't match service's {self.normalizer_version!r}"
                )

        async with self.pool.acquire() as conn:
            async with conn.transaction():
                for e in entries:
                    await self._execute_upsert(
                        conn,
                        source_type=e.source_type,
                        source_version=e.source_version,
                        raw_column=e.raw_column,
                        canonical_field=e.canonical_field,
                        domain=e.domain,
                        role=e.role,
                        mapper_method=e.mapper_method,
                        confidence=e.confidence,
                        sample_values=e.sample_values,
                        reviewed_by=reviewed_by if e.mapper_method == "manual" else None,
                    )
