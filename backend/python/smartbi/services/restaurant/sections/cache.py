"""Section result cache. In-memory TTL-based, thread-safe.

Future: swap for Redis if multi-worker deployment needs shared cache.
For now, per-worker memory cache is fine — each section runs in seconds
and V2 API traffic is low.
"""
from __future__ import annotations

import threading
import time
from typing import Any, Optional


class SectionCache:
    def __init__(self, ttl_seconds: int = 300):
        self._store: dict[str, tuple[float, Any]] = {}
        self._lock = threading.Lock()
        self._ttl = ttl_seconds

    def get(self, key: str) -> Optional[Any]:
        with self._lock:
            entry = self._store.get(key)
            if entry is None:
                return None
            expires_at, value = entry
            if time.time() > expires_at:
                del self._store[key]
                return None
            return value

    def set(self, key: str, value: Any) -> None:
        with self._lock:
            self._store[key] = (time.time() + self._ttl, value)

    def invalidate(self, prefix: str) -> int:
        with self._lock:
            keys = [k for k in self._store if k.startswith(prefix)]
            for k in keys:
                del self._store[k]
            return len(keys)
