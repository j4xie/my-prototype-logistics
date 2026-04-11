"""Unit tests for SectionCache — in-memory TTL cache used by the sections router."""
from smartbi.services.restaurant.sections.cache import SectionCache


def test_cache_set_and_get():
    cache = SectionCache(ttl_seconds=60)
    cache.set("key1", {"data": 1})
    assert cache.get("key1") == {"data": 1}


def test_cache_miss_returns_none():
    cache = SectionCache(ttl_seconds=60)
    assert cache.get("nonexistent") is None


def test_cache_ttl_expiry(monkeypatch):
    import time
    cache = SectionCache(ttl_seconds=1)
    cache.set("key1", {"data": 1})
    # Capture the real time.time before patching to avoid recursion.
    _real_time = time.time
    monkeypatch.setattr(time, "time", lambda: _real_time() + 2)
    assert cache.get("key1") is None
