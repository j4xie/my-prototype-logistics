"""Stage 5: SEMANTIC — pgvector similarity.

Assumes Java pipeline has populated ai_intent_configs.embedding column (vector
type) by calling embedding-service for each intent at config-write time.

If our Python query embedding cannot be obtained (gRPC down), return [] —
caller falls through to stage 6 (CLASSIFIER).

Vector binding (Phase 2B-α B1): the asyncpg pool used here (smartbi shared
pool) is created without the pgvector type adapter registered, because doing
so would require modifying the shared `setup=` hook in
`smartbi.config.get_pg_pool` — that pool is owned by sibling-chat code paths.
Workaround: stringify the embedding as `[v1,v2,...]` and let PostgreSQL
parse it via the `$1::vector` cast already present in the SQL. This is
slightly less efficient than native binding but functionally equivalent.
The `pgvector` package IS in requirements.txt for future native binding
once pool init can be safely modified (tracked: pgvector adapter wiring).
"""
from __future__ import annotations

import logging
from typing import List, Sequence

from ai.config import default_config
from ai.dto import CandidateIntentDto, MatchMethod
from ai.embedding import get_embedding

logger = logging.getLogger(__name__)


SEMANTIC_SQL = """
SELECT
    id, intent_code, intent_name, intent_category, tool_name, description,
    1 - (embedding <=> $1::vector) AS similarity
FROM ai_intent_configs
WHERE deleted_at IS NULL
  AND is_active = true
  AND (factory_id IS NULL OR factory_id = $2)
  AND (business_type = 'COMMON' OR business_type = $3)
  AND embedding IS NOT NULL
ORDER BY embedding <=> $1::vector
LIMIT $4
"""


def _vec_to_pgvector_text(vec: Sequence[float]) -> str:
    """Convert List[float] to pgvector text literal `[v1,v2,...]`.

    asyncpg passes the string as text and the SQL `$1::vector` cast turns
    it into the vector type at the PG layer. Avoids needing pgvector's
    asyncpg type adapter registered on the shared pool.
    """
    return "[" + ",".join(repr(float(x)) for x in vec) + "]"


def is_strong_signal(candidates: List[CandidateIntentDto]) -> bool:
    """Stage 5 short-circuit: top candidate confidence >= semantic_threshold
    indicates strong enough signal to skip stages 6-8."""
    if not candidates:
        return False
    return candidates[0].confidence >= default_config.semantic_threshold


class SemanticMatcher:
    """Encapsulates DB pool + embedding client for stage 5."""

    def __init__(self, pool, top_k: int = 10):
        self.pool = pool
        self.top_k = top_k

    async def match(
        self,
        query: str,
        factoryId: str,
        businessType: str,
    ) -> List[CandidateIntentDto]:
        """Compute query embedding, run pgvector kNN, return top-K candidates."""
        vec = await get_embedding(query)
        if vec is None:
            logger.warning("Stage 5 SEMANTIC: embedding unavailable, skipping")
            return []

        # Stringify vec so asyncpg can pass it as text; SQL `$1::vector`
        # cast handles parsing. See module docstring for rationale.
        vec_text = _vec_to_pgvector_text(vec)
        async with self.pool.acquire() as conn:
            rows = await conn.fetch(SEMANTIC_SQL, vec_text, factoryId, businessType, self.top_k)

        candidates = [
            CandidateIntentDto(
                intentCode=r["intent_code"],
                intentName=r["intent_name"],
                intentCategory=r.get("intent_category"),
                confidence=float(r["similarity"]),
                matchMethod=MatchMethod.SEMANTIC,
                description=r.get("description"),
            )
            for r in rows
        ]
        return candidates
