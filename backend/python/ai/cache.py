"""Python-side query→IntentMatchResult cache.

This is independent of Java's IntentResultCache. Both caches exist:
- Java cache: hot path, repeated identical query within 5min → 0 HTTP calls
- Python cache: deduplicates concurrent identical queries hitting Python in 5min

Key: SHA256 hash of (query + factoryId + role + businessType). All four fields
are part of the security/scope envelope — same query different role might
match different intents (e.g. operator vs admin sensitivity gating).

Invalidate triggered by:
- TTL (default 5min, AI_CACHE_TTL_S env)
- LRU eviction (default 1000 entries, AI_CACHE_MAX_SIZE env)
- /api/ai/intent/cache/invalidate POST (Java admin update bumps
  ai_intent_configs.config_version)
"""
from __future__ import annotations

import hashlib
import time
from collections import OrderedDict
from threading import RLock
from typing import Any, Optional

from ai.config import default_config


def _make_key(query: str, factoryId: str, role: str, businessType: str) -> str:
    """Stable 64-char hex hash. Includes all four scope fields so cross-tenant
    or cross-role contamination is impossible."""
    h = hashlib.sha256()
    h.update(query.encode("utf-8"))
    h.update(b"\x00")
    h.update(factoryId.encode("utf-8"))
    h.update(b"\x00")
    h.update(role.encode("utf-8"))
    h.update(b"\x00")
    h.update(businessType.encode("utf-8"))
    return h.hexdigest()


class IntentResultCache:
    """LRU cache with TTL.

    Thread-safe via RLock. Async usage is fine because GIL serializes
    operations within the OrderedDict, and the RLock guards the
    move_to_end + pop sequences from racing.

    Backed by ``collections.OrderedDict`` so insertion order = LRU order;
    ``move_to_end`` is O(1).
    """

    def __init__(
        self,
        max_size: Optional[int] = None,
        ttl_s: Optional[int] = None,
    ):
        self.max_size = max_size or default_config.cache_max_size
        self.ttl_s = ttl_s or default_config.cache_ttl_s
        self._store: "OrderedDict[str, tuple[float, Any]]" = OrderedDict()
        self._lock = RLock()

    def get(
        self,
        query: str,
        factoryId: str,
        role: str,
        businessType: str,
    ) -> Optional[Any]:
        key = _make_key(query, factoryId, role, businessType)
        with self._lock:
            entry = self._store.get(key)
            if entry is None:
                return None
            stored_at, value = entry
            if time.time() - stored_at > self.ttl_s:
                # Expired — pop and return None
                self._store.pop(key, None)
                return None
            # Mark as recently used
            self._store.move_to_end(key)
            return value

    def put(
        self,
        query: str,
        factoryId: str,
        role: str,
        businessType: str,
        value: Any,
    ) -> None:
        key = _make_key(query, factoryId, role, businessType)
        with self._lock:
            self._store[key] = (time.time(), value)
            self._store.move_to_end(key)
            while len(self._store) > self.max_size:
                self._store.popitem(last=False)  # evict LRU (oldest)

    def invalidate_all(self) -> None:
        """Wipe the cache. Called when ai_intent_configs.config_version bumps
        on admin write — Python's snapshot is no longer authoritative for
        previously cached results."""
        with self._lock:
            self._store.clear()

    def size(self) -> int:
        with self._lock:
            return len(self._store)


# Module singleton — initialized lazily so tests can construct fresh
# IntentResultCache instances without polluting the singleton.
_default_cache: Optional[IntentResultCache] = None


def get_default_cache() -> IntentResultCache:
    """Return the process-wide cache (lazy-init).

    The router/matcher uses this. Tests construct their own
    IntentResultCache instances and never touch the singleton.
    """
    global _default_cache
    if _default_cache is None:
        _default_cache = IntentResultCache()
    return _default_cache


__all__ = [
    "IntentResultCache",
    "get_default_cache",
]
