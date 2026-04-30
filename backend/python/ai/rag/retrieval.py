"""RAG retrieval from REAL Java schema (β C5, post-W0 fix-pass F1).

Reads:
- intent_match_records (Java IntentMatchRecordRepository writes every match).
  user_input → query, matched_intent_code → intent_code, confidence_score → confidence.
  query_embedding_vec is the new pgvector column added by V20260501_15 migration.
- ai_learned_expressions (curated expressions from Java's learning pipeline).
  expression → query, intent_code stays, confidence cast to real.
  embedding_vec is the new pgvector column added by V20260501_15 migration.

NO new tables; only ADD COLUMN of pgvector vec columns. Cold-start: rows without
the vec column populated are filtered out (legacy BLOB-only data needs a separate
backfill task to populate vec). Python writes to vec columns on fresh data via
ExpressionLearner + future intent-match-record persistence.

Returns top-K most similar historical cases by cosine similarity. Embedding via
ai.embedding.get_embedding_cached (request-scoped cache shared with stage 5).

asyncpg has no pgvector type adapter on the shared pool, so we stringify the
vector to pgvector text literal and let `$1::vector` cast handle parsing at PG.
Same pattern as ai/matcher/semantic.py.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import List, Sequence

from ai.embedding import get_embedding_cached

logger = logging.getLogger(__name__)


# UNION query: intent_match_records (every Java match) + ai_learned_expressions (curated).
# Both tables have the new pgvector vec columns added by V20260501_15.
# factory_id filter: per-tenant + global (NULL).
RAG_SQL = """
SELECT * FROM (
    SELECT
        user_input AS query, matched_intent_code AS intent_code,
        confidence_score AS confidence, factory_id,
        1 - (query_embedding_vec <=> $1::vector) AS similarity,
        'match_record' AS source
    FROM intent_match_records
    WHERE query_embedding_vec IS NOT NULL
      AND (factory_id = $2 OR factory_id IS NULL)
    UNION ALL
    SELECT
        expression AS query, intent_code, confidence::real AS confidence, factory_id,
        1 - (embedding_vec <=> $1::vector) AS similarity,
        'learned_expression' AS source
    FROM ai_learned_expressions
    WHERE embedding_vec IS NOT NULL
      AND is_active = true
      AND (factory_id = $2 OR factory_id IS NULL)
) combined
ORDER BY similarity DESC
LIMIT $3
"""


def _vec_to_pgvector_text(vec: Sequence[float]) -> str:
    """Convert List[float] to pgvector text literal `[v1,v2,...]`.

    asyncpg passes the string as text and the SQL `$1::vector` cast turns
    it into the vector type at the PG layer. Avoids needing pgvector's
    asyncpg type adapter registered on the shared pool. Same helper pattern
    as ai/matcher/semantic.py._vec_to_pgvector_text — kept inline here to
    avoid cross-module coupling, but functionally identical.
    """
    return "[" + ",".join(repr(float(x)) for x in vec) + "]"


@dataclass
class RAGCase:
    """One retrieved historical case for context enrichment."""
    query: str
    intent_code: str
    confidence: float
    similarity: float
    source: str  # "match_record" or "learned_expression"


class RAGRetriever:
    """Reads existing intent_match_records + ai_learned_expressions for context retrieval."""

    def __init__(self, pool):
        self.pool = pool

    async def retrieve(self, query: str, factory_id: str, top_k: int = 5) -> List[RAGCase]:
        """Returns top-K most similar historical cases. Empty if embedding fails or DB error."""
        vec = await get_embedding_cached(query)
        if vec is None:
            logger.warning("RAG: embedding unavailable, returning empty")
            return []
        vec_text = _vec_to_pgvector_text(vec)
        try:
            async with self.pool.acquire() as conn:
                rows = await conn.fetch(RAG_SQL, vec_text, factory_id, top_k)
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
