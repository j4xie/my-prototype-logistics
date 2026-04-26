"""Per-factory serialization for entity resolution + sheet merger + writers."""
from __future__ import annotations

import asyncio
import hashlib
import logging
from collections import defaultdict
from typing import Awaitable, Callable, Dict, TypeVar, TYPE_CHECKING

if TYPE_CHECKING:
    import asyncpg

logger = logging.getLogger(__name__)

T = TypeVar("T")

# Module-level: one asyncio.Lock per factory_id seen so far.
_factory_locks: Dict[str, asyncio.Lock] = defaultdict(asyncio.Lock)


def _factory_lock_key(factory_id: str) -> int:
    """Stable int4 hash for pg_advisory_xact_lock (signed 32-bit range)."""
    h = hashlib.md5(factory_id.encode("utf-8")).hexdigest()[:8]
    return int(h, 16) % (2**31)


async def with_factory_serialization(
    factory_id: str,
    conn: "asyncpg.Connection",
    work: Callable[["asyncpg.Connection"], Awaitable[T]],
) -> T:
    """3-layer defense: asyncio.Lock + pg_advisory_xact_lock + dim cache invalidate.

    Layer 1 (asyncio.Lock): prevents Python-process-internal concurrency on the
    same factory_id (multiple uvicorn coroutines).
    Layer 2 (pg_advisory_xact_lock): prevents cross-connection / cross-worker
    concurrency at the Postgres layer.
    Layer 3 (dim_resolver.clear_cache): prevents stale entity_id mappings after
    entity resolution writes (in-memory cache not thread-safe per spec).

    Same factory uploads serialize; different factories run in parallel.
    """
    if not factory_id:
        raise ValueError("factory_id required")
    lock_key = _factory_lock_key(factory_id)

    async with _factory_locks[factory_id]:
        async with conn.transaction():
            await conn.execute("SELECT pg_advisory_xact_lock($1)", lock_key)
            try:
                result = await work(conn)
            finally:
                # Layer 3: invalidate even on error to prevent stale cache holding
                # partially-resolved entities for the next caller.
                from smartbi.canonical.dim_resolver import clear_cache
                clear_cache(factory_id)
        return result


def cleanup_factory_lock(factory_id: str) -> None:
    """Drop the asyncio.Lock for a factory. Call when factory is hard-deleted (admin)."""
    _factory_locks.pop(factory_id, None)


def _peek_factory_locks() -> Dict[str, asyncio.Lock]:
    """For tests: read-only view of the lock registry."""
    return dict(_factory_locks)
