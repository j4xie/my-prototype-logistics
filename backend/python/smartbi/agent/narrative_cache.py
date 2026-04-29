"""SHA256-keyed narrative cache for LLM insight responses.

Table: narrative_cache (PK: factory_id, question_hash).

Hash composition:
    SHA256(normalized_q + "|" + start_date + "|" + end_date + "|" + factory_id)

- `normalized_q` = question lowered + stripped + collapsed whitespace
- `start_date`/`end_date` = ISO YYYY-MM-DD strings (or empty for non-range)
- `factory_id` in the hash is belt-and-suspenders — the PK already
  includes factory_id, but hashing it in makes cross-tenant collision
  impossible even if someone forgets to bind factory_id in the query

Invalidation:
- Time: expires_at < now() (24h default TTL)
- Upload event: `invalidate_on_upload(factory_id)` wipes ALL cache rows
  for that factory. Simple > precise; Agent-layer insights span
  multi-month ranges and tracing which hash references a given upload
  is not worth the complexity.

Cleanup:
- `prune_expired()` deletes rows where expires_at < now(). Caller is
  responsible for scheduling (not baked in here — defer to a
  background task/cron layer).
"""
from __future__ import annotations

import hashlib
import json
import logging
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional

import asyncpg

logger = logging.getLogger(__name__)


DEFAULT_TTL_HOURS = 24


def compute_question_hash(
    question: str,
    start_date: Optional[str],
    end_date: Optional[str],
    factory_id: str,
) -> str:
    """Deterministic SHA256 over normalized components.

    Inputs are joined with `|` (never appears in dates; rare in
    questions — and even if a user's question contains `|`, the
    separator-free alternative risks collisions between e.g. Q="ab" date="c"
    and Q="a" date="bc").
    """
    normalized_q = " ".join((question or "").strip().lower().split())
    parts = [
        normalized_q,
        (start_date or "").strip(),
        (end_date or "").strip(),
        (factory_id or "").strip(),
    ]
    raw = "|".join(parts).encode("utf-8")
    return hashlib.sha256(raw).hexdigest()


class NarrativeCacheService:
    """Thin wrapper over narrative_cache table.

    Stateless — pool connections carry RLS context via
    set_pg_connection_tenant setup callback.
    """

    def __init__(self, pool: asyncpg.Pool):
        self._pool = pool

    async def get(
        self, factory_id: str, question_hash: str
    ) -> Optional[Dict[str, Any]]:
        """Return cached answer if present AND not expired, else None.

        Apr 27 2026 (F12 fix): RLS GUC for tenant_isolation on narrative_cache.
        """
        async with self._pool.acquire() as conn:
            async with conn.transaction():
                await conn.execute(
                    "SELECT set_config('app.factory_id', $1, true)",
                    factory_id,
                )
                row = await conn.fetchrow(
                    """
                    SELECT answer, chart_config, tokens, created_at, expires_at
                      FROM narrative_cache
                     WHERE factory_id    = $1
                       AND question_hash = $2
                       AND expires_at    > NOW()
                    """,
                    factory_id, question_hash,
                )
        if row is None:
            return None
        # asyncpg returns JSONB as a string unless a codec is registered
        # on the pool. Parse inline here so callers always see a dict.
        chart = row["chart_config"]
        if isinstance(chart, str):
            chart = json.loads(chart)
        return {
            "answer": row["answer"],
            "chart_config": chart,
            "tokens": int(row["tokens"]),
            "created_at": row["created_at"],
            "expires_at": row["expires_at"],
        }

    async def put(
        self,
        factory_id: str,
        question_hash: str,
        answer: str,
        chart_config: Optional[Dict[str, Any]],
        tokens: int,
        ttl_hours: int = DEFAULT_TTL_HOURS,
    ) -> None:
        """Upsert a cache entry. Existing row for the same key is replaced."""
        expires_at = datetime.now(timezone.utc) + timedelta(hours=ttl_hours)
        # asyncpg maps None → NULL, dict → jsonb via explicit cast.
        chart_json = json.dumps(chart_config) if chart_config is not None else None
        async with self._pool.acquire() as conn:
            async with conn.transaction():
                await conn.execute(
                    "SELECT set_config('app.factory_id', $1, true)",
                    factory_id,
                )
                await conn.execute(
                    """
                    INSERT INTO narrative_cache
                        (factory_id, question_hash, answer, chart_config,
                         tokens, expires_at)
                    VALUES ($1, $2, $3, $4::jsonb, $5, $6)
                    ON CONFLICT (factory_id, question_hash) DO UPDATE
                        SET answer       = EXCLUDED.answer,
                            chart_config = EXCLUDED.chart_config,
                            tokens       = EXCLUDED.tokens,
                            expires_at   = EXCLUDED.expires_at,
                            created_at   = NOW()
                    """,
                    factory_id, question_hash, answer, chart_json,
                    int(tokens), expires_at,
                )

    async def invalidate_on_upload(self, factory_id: str) -> int:
        """Delete all cache rows for this factory. Returns row count.

        Called when a new Excel upload lands (data has changed; any
        cached insights are potentially stale). Coarse but correct.

        F11.1 fix: tenant_isolation RLS policy filters by app.factory_id GUC.
        Without SET, DELETE finds 0 rows when caller is outside per-request
        context (cron / upload event handler).
        """
        async with self._pool.acquire() as conn:
            async with conn.transaction():
                await conn.execute(
                    "SELECT set_config('app.factory_id', $1, true)",
                    factory_id,
                )
                result = await conn.execute(
                    "DELETE FROM narrative_cache WHERE factory_id = $1",
                    factory_id,
                )
        # asyncpg returns "DELETE <n>"; parse count defensively.
        try:
            return int(result.rsplit(" ", 1)[-1])
        except ValueError:
            return 0

    async def prune_expired(self) -> int:
        """Delete all expired rows (any factory). For scheduled cleanup."""
        async with self._pool.acquire() as conn:
            result = await conn.execute(
                "DELETE FROM narrative_cache WHERE expires_at <= NOW()"
            )
        try:
            return int(result.rsplit(" ", 1)[-1])
        except ValueError:
            return 0
