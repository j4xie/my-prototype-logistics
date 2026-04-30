"""ai/cache.py — LRU cache with TTL."""
from __future__ import annotations

import time
from unittest.mock import patch

import pytest


def test_cache_hit_returns_cached_value():
    from ai.cache import IntentResultCache
    cache = IntentResultCache(max_size=10, ttl_s=60)
    cache.put("query1", "F001", "admin", "FACTORY", {"intentCode": "X"})
    got = cache.get("query1", "F001", "admin", "FACTORY")
    assert got == {"intentCode": "X"}


def test_cache_miss_returns_none():
    from ai.cache import IntentResultCache
    cache = IntentResultCache(max_size=10, ttl_s=60)
    assert cache.get("nope", "F001", "admin", "FACTORY") is None


def test_cache_key_isolation_by_factory():
    """Same query different factoryId → separate cache entries."""
    from ai.cache import IntentResultCache
    cache = IntentResultCache(max_size=10, ttl_s=60)
    cache.put("q", "F001", "admin", "FACTORY", {"v": 1})
    cache.put("q", "F002", "admin", "FACTORY", {"v": 2})
    assert cache.get("q", "F001", "admin", "FACTORY") == {"v": 1}
    assert cache.get("q", "F002", "admin", "FACTORY") == {"v": 2}


def test_cache_key_isolation_by_role():
    from ai.cache import IntentResultCache
    cache = IntentResultCache(max_size=10, ttl_s=60)
    cache.put("q", "F001", "admin", "FACTORY", {"v": "admin"})
    cache.put("q", "F001", "operator", "FACTORY", {"v": "op"})
    assert cache.get("q", "F001", "admin", "FACTORY") == {"v": "admin"}
    assert cache.get("q", "F001", "operator", "FACTORY") == {"v": "op"}


def test_cache_ttl_eviction():
    from ai.cache import IntentResultCache
    cache = IntentResultCache(max_size=10, ttl_s=1)
    cache.put("q", "F", "r", "FACTORY", {"v": 1})
    assert cache.get("q", "F", "r", "FACTORY") == {"v": 1}
    # Fast-forward time past TTL
    with patch("ai.cache.time.time", return_value=time.time() + 2):
        assert cache.get("q", "F", "r", "FACTORY") is None


def test_cache_lru_eviction():
    from ai.cache import IntentResultCache
    cache = IntentResultCache(max_size=2, ttl_s=60)
    cache.put("q1", "F", "r", "FACTORY", {"v": 1})
    cache.put("q2", "F", "r", "FACTORY", {"v": 2})
    # Hit q1 to mark it fresh
    cache.get("q1", "F", "r", "FACTORY")
    # Insert q3 → q2 should be evicted (least recently used)
    cache.put("q3", "F", "r", "FACTORY", {"v": 3})
    assert cache.get("q1", "F", "r", "FACTORY") == {"v": 1}
    assert cache.get("q2", "F", "r", "FACTORY") is None
    assert cache.get("q3", "F", "r", "FACTORY") == {"v": 3}


def test_cache_invalidate_all():
    """Used when ai_intent_configs config_version bumps."""
    from ai.cache import IntentResultCache
    cache = IntentResultCache(max_size=10, ttl_s=60)
    cache.put("q1", "F", "r", "FACTORY", {"v": 1})
    cache.put("q2", "F", "r", "FACTORY", {"v": 2})
    cache.invalidate_all()
    assert cache.get("q1", "F", "r", "FACTORY") is None
    assert cache.get("q2", "F", "r", "FACTORY") is None
