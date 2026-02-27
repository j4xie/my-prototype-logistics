"""
Insight Result Cache

In-memory TTL cache for LLM-generated insight results.
Prevents redundant LLM calls when the same upload/sheet is viewed repeatedly.

Key = SHA256(upload_id + sheet_index + first-5-rows JSON)[:24]
TTL  = 1 hour (3600s)
Max  = 200 entries (LRU eviction)
"""
from __future__ import annotations

import hashlib
import json
import logging
import time
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)


@dataclass
class CacheEntry:
    """Single cached insight result."""
    key: str
    insights: Any  # The insights payload (dict or string)
    executive_summary: Optional[str] = None
    created_at: float = field(default_factory=time.time)
    accessed_at: float = field(default_factory=time.time)
    access_count: int = 1


class InsightResultCache:
    """
    TTL-based in-memory cache for insight generation results.

    Thread-safe for single-process async usage (Python GIL).
    """

    def __init__(self, ttl_seconds: int = 3600, max_entries: int = 200):
        self._cache: Dict[str, CacheEntry] = {}
        self._ttl = ttl_seconds
        self._max = max_entries

    @staticmethod
    def make_key(
        upload_id: Any,
        sheet_index: Any,
        data_sample: List[dict],
    ) -> str:
        """
        Generate a cache key from upload context + data fingerprint.

        Args:
            upload_id: Upload identifier (int or str)
            sheet_index: Sheet index within the upload
            data_sample: First 5 rows of data (for content fingerprinting)

        Returns:
            24-char hex key
        """
        raw = json.dumps(
            {"u": str(upload_id), "s": str(sheet_index), "d": data_sample[:5]},
            sort_keys=True,
            ensure_ascii=False,
            default=str,
        )
        return hashlib.sha256(raw.encode()).hexdigest()[:24]

    def get(self, key: str) -> Optional[CacheEntry]:
        """Return cached entry if exists and not expired, else None."""
        entry = self._cache.get(key)
        if entry is None:
            return None
        if time.time() - entry.created_at > self._ttl:
            del self._cache[key]
            return None
        entry.accessed_at = time.time()
        entry.access_count += 1
        return entry

    def set(
        self,
        key: str,
        insights: Any,
        executive_summary: Optional[str] = None,
    ) -> None:
        """Store an insight result in the cache."""
        self._cache[key] = CacheEntry(
            key=key,
            insights=insights,
            executive_summary=executive_summary,
        )
        if len(self._cache) > self._max:
            self._evict()
        logger.debug(f"[InsightCache] SET key={key[:12]}... entries={len(self._cache)}")

    def _evict(self) -> None:
        """Evict oldest-accessed entries when over capacity."""
        if len(self._cache) <= self._max:
            return
        sorted_keys = sorted(
            self._cache, key=lambda k: self._cache[k].accessed_at
        )
        to_remove = max(1, len(sorted_keys) // 10)
        for k in sorted_keys[:to_remove]:
            del self._cache[k]
        logger.debug(f"[InsightCache] evicted {to_remove} entries")

    def stats(self) -> Dict[str, Any]:
        """Return cache statistics."""
        now = time.time()
        active = sum(1 for e in self._cache.values() if now - e.created_at < self._ttl)
        total_hits = sum(e.access_count - 1 for e in self._cache.values())
        return {
            "total_entries": len(self._cache),
            "active_entries": active,
            "total_hits": total_hits,
            "ttl_seconds": self._ttl,
            "max_entries": self._max,
        }

    def clear(self) -> None:
        """Clear all entries."""
        self._cache.clear()
        logger.info("[InsightCache] cleared")


# Module-level singleton
_cache: Optional[InsightResultCache] = None


def get_insight_cache() -> InsightResultCache:
    """Return the global InsightResultCache singleton."""
    global _cache
    if _cache is None:
        _cache = InsightResultCache()
    return _cache
