"""
In-memory LLM prompt → response cache (Bug #13 fix, Apr 17 2026).

Same input prompt within TTL window returns cached response without LLM call.
Dramatically speeds up batch uploads of same-template files where mapper /
structure_detector receive identical prompts back-to-back.

Observed before fix: 8 consecutive uploads of 商品销量报表 all called mapper
LLM with identical result `mapped=17, unmapped=3, confidence=0.91`. 8 wasted
LLM calls × ~10s each = 80s avoidable latency per batch.

Design:
- sha256 prompt hash + slot tag → response (str | dict)
- Thread-safe dict with simple TTL + LRU eviction at 1000 entries
- No DB persistence — process-restart evicts all, acceptable trade-off

Callers must be deterministic: mapper / structure_detector feed the same
prompt for same columns. Do not cache CHAT / INSIGHTS (response varies with
temperature/history).
"""
from __future__ import annotations

import hashlib
import logging
import time
from threading import Lock
from typing import Any, Dict, Optional, Tuple

logger = logging.getLogger(__name__)

_cache: Dict[str, Tuple[float, Any]] = {}
_lock = Lock()
_TTL_SECS = 86400  # 24 hours
_MAX_SIZE = 1000
_stats = {"hits": 0, "misses": 0, "puts": 0, "evictions": 0}


def cache_key(prompt: str, slot: str = "") -> str:
    """Stable hash of prompt text + slot tag. 32 hex chars."""
    h = hashlib.sha256(f"{slot}||{prompt}".encode("utf-8"))
    return h.hexdigest()[:32]


def cache_get(key: str) -> Optional[Any]:
    """Return cached value if present and fresh; None otherwise."""
    with _lock:
        item = _cache.get(key)
        if item is None:
            _stats["misses"] += 1
            return None
        ts, val = item
        if time.time() - ts > _TTL_SECS:
            del _cache[key]
            _stats["misses"] += 1
            return None
        _stats["hits"] += 1
        return val


def cache_put(key: str, val: Any) -> None:
    """Store value with current timestamp. Evicts oldest if above size limit."""
    with _lock:
        _cache[key] = (time.time(), val)
        _stats["puts"] += 1
        if len(_cache) > _MAX_SIZE:
            oldest = min(_cache, key=lambda k: _cache[k][0])
            del _cache[oldest]
            _stats["evictions"] += 1


def cache_stats() -> Dict[str, Any]:
    """Diagnostic snapshot."""
    with _lock:
        total = _stats["hits"] + _stats["misses"]
        hit_rate = _stats["hits"] / total if total > 0 else 0.0
        return {**_stats, "size": len(_cache), "hit_rate": round(hit_rate, 3)}


def cache_clear() -> None:
    """Testing utility."""
    with _lock:
        _cache.clear()
        for k in _stats:
            _stats[k] = 0
