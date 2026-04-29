"""Unit tests for shared EmbeddingCache (entity_resolution._embedding_cache)."""
from __future__ import annotations

from unittest.mock import AsyncMock

import pytest

from smartbi.canonical.entity_resolution._embedding_cache import EmbeddingCache


# --- LRU semantics -------------------------------------------------------


def test_lru_evicts_oldest():
    """Insert > max_size → oldest key evicted."""
    cache = EmbeddingCache(max_size=3)
    cache.put(("k", "a"), [1.0])
    cache.put(("k", "b"), [2.0])
    cache.put(("k", "c"), [3.0])
    cache.put(("k", "d"), [4.0])  # evicts ("k","a")

    assert cache.get(("k", "a")) is None
    assert cache.get(("k", "d")) == [4.0]
    assert len(cache) == 3


def test_lru_move_to_end_on_hit():
    """Reading a key marks it MRU so the next eviction skips it."""
    cache = EmbeddingCache(max_size=3)
    cache.put(("k", "a"), [1.0])
    cache.put(("k", "b"), [2.0])
    cache.put(("k", "c"), [3.0])

    # touch 'a' → now 'b' is the LRU
    assert cache.get(("k", "a")) == [1.0]

    cache.put(("k", "d"), [4.0])

    assert cache.get(("k", "a")) == [1.0]
    assert cache.get(("k", "b")) is None


def test_put_overwrite_updates_value_and_marks_mru():
    """put() on existing key updates value AND moves to end."""
    cache = EmbeddingCache(max_size=3)
    cache.put(("k", "a"), [1.0])
    cache.put(("k", "b"), [2.0])
    cache.put(("k", "c"), [3.0])

    cache.put(("k", "a"), [99.0])  # overwrite + MRU
    assert cache.get(("k", "a")) == [99.0]

    cache.put(("k", "d"), [4.0])  # should evict 'b'
    assert cache.get(("k", "b")) is None
    assert cache.get(("k", "a")) == [99.0]


def test_get_miss_returns_none():
    """Missing key → None."""
    cache = EmbeddingCache(max_size=10)
    assert cache.get(("k", "missing")) is None


# --- get_or_embed --------------------------------------------------------


async def test_get_or_embed_caches_result():
    """First call invokes embed_fn; second call hits cache (no extra call)."""
    embed_fn = AsyncMock(return_value=[0.1, 0.2, 0.3])
    cache = EmbeddingCache(max_size=10)

    out1 = await cache.get_or_embed(embed_fn, "hello", key=("k", "hello"))
    out2 = await cache.get_or_embed(embed_fn, "hello", key=("k", "hello"))

    assert out1 == [0.1, 0.2, 0.3]
    assert out2 == [0.1, 0.2, 0.3]
    embed_fn.assert_awaited_once_with("hello")


async def test_get_or_embed_skips_none_result():
    """If embed_fn returns None, do NOT cache; next call retries."""
    embed_fn = AsyncMock(side_effect=[None, [0.5]])
    cache = EmbeddingCache(max_size=10)

    out1 = await cache.get_or_embed(embed_fn, "x", key=("k", "x"))
    out2 = await cache.get_or_embed(embed_fn, "x", key=("k", "x"))

    assert out1 is None
    assert out2 == [0.5]
    assert embed_fn.await_count == 2


# --- namespace separation -----------------------------------------------


def test_namespace_keys_separate_agents():
    """Tuples like ('embedding', f, t) and ('contextual', f, et, t) don't collide."""
    cache = EmbeddingCache(max_size=10)
    cache.put(("embedding", "F001", "门店A"), [1.0])
    cache.put(("contextual", "F001", "store", "门店A"), [2.0])

    assert cache.get(("embedding", "F001", "门店A")) == [1.0]
    assert cache.get(("contextual", "F001", "store", "门店A")) == [2.0]
    # Different shapes → both coexist; no collision.
    assert len(cache) == 2
