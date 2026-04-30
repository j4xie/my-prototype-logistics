"""RAG retrieval from EXISTING tables (β C5, audit fix CR-3).

Reads:
- intent_match_records (Java IntentMatchRecordRepository writes every match)
- learned_expressions (curated expressions from Java's learning pipeline)

NO new migration. Cold-start: tables already populated by Java in production.
Returns top-K most similar historical cases by cosine similarity. Embedding via
ai.embedding.get_embedding_cached (request-scoped cache shared with stage 5).

Uses pgvector cosine similarity operator <=>. Caller must have pgvector adapter
registered on connection (done in main.py asyncpg pool init via β B1 / α handoff).
"""
from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import List

from ai.embedding import get_embedding_cached

logger = logging.getLogger(__name__)


# UNION query: intent_match_records (every Java match) + learned_expressions (curated).
# Both have query_embedding/expression_embedding columns of type vector(768).
# factory_id filter: per-tenant + global (NULL).
RAG_SQL = """
SELECT * FROM (
    SELECT
        query, intent_code, confidence, factory_id,
        1 - (query_embedding <=> $1::vector) AS similarity,
        'match_record' AS source
    FROM intent_match_records
    WHERE query_embedding IS NOT NULL
      AND (factory_id = $2 OR factory_id IS NULL)
    UNION ALL
    SELECT
        expression AS query, intent_code, 1.0 AS confidence, factory_id,
        1 - (expression_embedding <=> $1::vector) AS similarity,
        'learned_expression' AS source
    FROM learned_expressions
    WHERE expression_embedding IS NOT NULL
      AND (factory_id = $2 OR factory_id IS NULL)
) combined
ORDER BY similarity DESC
LIMIT $3
"""


@dataclass
class RAGCase:
    """One retrieved historical case for context enrichment."""
    query: str
    intent_code: str
    confidence: float
    similarity: float
    source: str  # "match_record" or "learned_expression"


class RAGRetriever:
    """Reads existing intent_match_records + learned_expressions for context retrieval."""

    def __init__(self, pool):
        self.pool = pool

    async def retrieve(self, query: str, factory_id: str, top_k: int = 5) -> List[RAGCase]:
        """Returns top-K most similar historical cases. Empty if embedding fails or DB error."""
        vec = await get_embedding_cached(query)
        if vec is None:
            logger.warning("RAG: embedding unavailable, returning empty")
            return []
        try:
            async with self.pool.acquire() as conn:
                rows = await conn.fetch(RAG_SQL, vec, factory_id, top_k)
        except Exception:
            logger.exception("RAG retrieval failed (table missing? schema mismatch?)")
            return []
        return [
            RAGCase(
                query=r["query"], intent_code=r["intent_code"],
                confidence=float(r["confidence"]), similarity=float(r["similarity"]),
                source=r["source"],
            )
            for r in rows
        ]
