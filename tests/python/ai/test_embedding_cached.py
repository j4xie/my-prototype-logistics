"""Request-scoped embedding cache (β CR-2 fix)."""
from __future__ import annotations

from unittest.mock import AsyncMock, patch

import pytest


@pytest.mark.asyncio
async def test_get_embedding_cached_returns_value():
    """First call → gRPC. Second call (same text, same context) → cache."""
    from ai import embedding
    fake_vec = [0.1, 0.2, 0.3]

    with patch("ai.embedding.get_embedding", new=AsyncMock(return_value=fake_vec)) as mock:
        embedding._request_embedding_cache.set({})

        v1 = await embedding.get_embedding_cached("hello")
        v2 = await embedding.get_embedding_cached("hello")
        assert v1 == fake_vec
        assert v2 == fake_vec
        assert mock.call_count == 1, "gRPC should be called once per request"


@pytest.mark.asyncio
async def test_get_embedding_cached_different_texts_separate_calls():
    """Different texts → separate gRPC calls."""
    from ai import embedding

    with patch("ai.embedding.get_embedding", new=AsyncMock(side_effect=[[0.1], [0.2]])) as mock:
        embedding._request_embedding_cache.set({})

        v1 = await embedding.get_embedding_cached("foo")
        v2 = await embedding.get_embedding_cached("bar")
        assert v1 == [0.1]
        assert v2 == [0.2]
        assert mock.call_count == 2


@pytest.mark.asyncio
async def test_get_embedding_cached_skips_cache_on_none():
    """If gRPC returns None (failure), don't pollute cache; retry on next call."""
    from ai import embedding

    with patch("ai.embedding.get_embedding", new=AsyncMock(side_effect=[None, [0.5]])) as mock:
        embedding._request_embedding_cache.set({})

        v1 = await embedding.get_embedding_cached("test")
        v2 = await embedding.get_embedding_cached("test")
        assert v1 is None
        assert v2 == [0.5]
        assert mock.call_count == 2


@pytest.mark.asyncio
async def test_request_cache_isolation_via_contextvar():
    """Different request contexts → separate caches (no cross-request leak)."""
    from ai import embedding
    import asyncio

    async def request_a():
        embedding._request_embedding_cache.set({})
        with patch("ai.embedding.get_embedding", new=AsyncMock(return_value=[1.0])):
            return await embedding.get_embedding_cached("q_a")

    async def request_b():
        embedding._request_embedding_cache.set({})
        with patch("ai.embedding.get_embedding", new=AsyncMock(return_value=[2.0])):
            return await embedding.get_embedding_cached("q_b")

    a_task = asyncio.create_task(request_a())
    b_task = asyncio.create_task(request_b())
    a_result, b_result = await asyncio.gather(a_task, b_task)
    assert a_result == [1.0]
    assert b_result == [2.0]
