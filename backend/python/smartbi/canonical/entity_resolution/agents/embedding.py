"""EmbeddingAgent: cosine similarity over factory dim embeddings."""
from __future__ import annotations

from collections import OrderedDict
from typing import (
    TYPE_CHECKING,
    Awaitable,
    Callable,
    List,
    Optional,
    Tuple,
)

from smartbi.canonical.entity_resolution.agents.base import BaseAgent
from smartbi.canonical.entity_resolution.orchestrator import (
    AgentResult,
    EntityType,
    ResolutionInput,
)

if TYPE_CHECKING:
    import asyncpg


EmbedFn = Callable[[str], Awaitable[Optional[List[float]]]]


class EmbeddingAgent(BaseAgent):
    """Cosine sim over per-factory dim embeddings, with bounded LRU cache."""

    name = "embedding"
    ship_threshold = 0.90
    CACHE_MAX_SIZE = 50_000

    def __init__(self, embed_fn: Optional[EmbedFn] = None) -> None:
        self._embed_fn: Optional[EmbedFn] = embed_fn
        self._cache: "OrderedDict[Tuple[str, str], List[float]]" = OrderedDict()

    def _cache_get(self, key: Tuple[str, str]) -> Optional[List[float]]:
        if key in self._cache:
            self._cache.move_to_end(key)
            return self._cache[key]
        return None

    def _cache_put(self, key: Tuple[str, str], value: List[float]) -> None:
        if key in self._cache:
            self._cache.move_to_end(key)
            self._cache[key] = value
        else:
            self._cache[key] = value
            if len(self._cache) > self.CACHE_MAX_SIZE:
                self._cache.popitem(last=False)

    async def _embed(self, text: str, factory_id: str) -> Optional[List[float]]:
        key = (factory_id, text)
        cached = self._cache_get(key)
        if cached is not None:
            return cached
        if self._embed_fn is None:
            from smartbi.services.llm_fallback_logger import (
                get_embedding as default_embed,
            )

            self._embed_fn = default_embed
        emb = await self._embed_fn(text)
        if emb is not None:
            self._cache_put(key, emb)
        return emb

    @staticmethod
    def _cosine(a: List[float], b: List[float]) -> float:
        dot = 0.0
        na = 0.0
        nb = 0.0
        for x, y in zip(a, b):
            dot += x * y
            na += x * x
            nb += y * y
        if na == 0 or nb == 0:
            return 0.0
        return dot / ((na ** 0.5) * (nb ** 0.5))

    async def resolve(
        self,
        input: ResolutionInput,
        pool: "asyncpg.Pool",
    ) -> AgentResult:
        query_emb = await self._embed(input.raw_name, input.factory_id)
        if query_emb is None:
            return AgentResult(
                matched_entity_id=None,
                confidence=0.0,
                reasoning="embedding 服务返回 None",
            )

        async with pool.acquire() as conn:
            entity_table = f"dim_{input.entity_type.value}"
            id_column = f"{input.entity_type.value}_id"
            if input.entity_type == EntityType.PRODUCT:
                rows = await conn.fetch(
                    f"SELECT {id_column} AS eid, name, normalized_name "
                    f"FROM {entity_table} WHERE factory_id = $1 LIMIT 1000",
                    input.factory_id,
                )
                cmp_field = "normalized_name"
            else:
                rows = await conn.fetch(
                    f"SELECT {id_column} AS eid, name FROM {entity_table} "
                    f"WHERE factory_id = $1 LIMIT 1000",
                    input.factory_id,
                )
                cmp_field = "name"

        if not rows:
            return AgentResult(
                matched_entity_id=None,
                confidence=0.0,
                reasoning=f"{entity_table} 表为空",
            )

        scores: List[Tuple[int, str, float]] = []
        for r in rows:
            cand_text = r[cmp_field]
            if not cand_text:
                continue
            cand_emb = await self._embed(cand_text, input.factory_id)
            if cand_emb is None:
                continue
            sim = self._cosine(query_emb, cand_emb)
            scores.append((r["eid"], cand_text, sim))

        if not scores:
            return AgentResult(
                matched_entity_id=None,
                confidence=0.0,
                reasoning="所有候选 embedding 失败",
            )

        scores.sort(key=lambda x: x[2], reverse=True)
        top_5 = [
            {"entity_id": s[0], "name": s[1], "sim": s[2]} for s in scores[:5]
        ]
        best = scores[0]
        return AgentResult(
            matched_entity_id=best[0] if best[2] > 0.7 else None,
            confidence=best[2],
            reasoning=f"cosine sim={best[2]:.3f}, candidate='{best[1]}'",
            candidates=top_5,
        )
