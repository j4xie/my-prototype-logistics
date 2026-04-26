"""Shared LRU embedding cache for EmbeddingAgent + ContextualAgent.

Per-instance (worker-local, asyncio single-thread safe). Each agent owns its
own cache; key tuples are namespaced by the agent so the two caches stay
logically separate even when sharing this class.
"""
from __future__ import annotations

from collections import OrderedDict
from typing import Any, Awaitable, Callable, List, Optional, Tuple


EmbedFn = Callable[[str], Awaitable[Optional[List[float]]]]


class EmbeddingCache:
    """Bounded LRU cache for embedding vectors keyed by an opaque tuple."""

    def __init__(self, max_size: int = 50_000) -> None:
        self._cache: "OrderedDict[Tuple[Any, ...], List[float]]" = OrderedDict()
        self._max_size = max_size

    def get(self, key: Tuple[Any, ...]) -> Optional[List[float]]:
        """Return cached vector + bump to MRU; ``None`` if miss."""
        if key in self._cache:
            self._cache.move_to_end(key)
            return self._cache[key]
        return None

    def put(self, key: Tuple[Any, ...], value: List[float]) -> None:
        """Insert/update vector; evict oldest if over ``max_size``."""
        if key in self._cache:
            self._cache[key] = value
            self._cache.move_to_end(key)
        else:
            self._cache[key] = value
            if len(self._cache) > self._max_size:
                self._cache.popitem(last=False)

    async def get_or_embed(
        self,
        embed_fn: EmbedFn,
        text: str,
        key: Tuple[Any, ...],
    ) -> Optional[List[float]]:
        """Return cache hit, else call ``embed_fn(text)`` + cache iff non-None."""
        cached = self.get(key)
        if cached is not None:
            return cached
        emb = await embed_fn(text)
        if emb is not None:
            self.put(key, emb)
        return emb

    def __len__(self) -> int:
        return len(self._cache)
