"""Async expression template learner (β C6).

Reads: intent_match_records (high-confidence rows from Java's match pipeline)
Writes: ai_learned_expressions (full template with embedding_vec)

Different from KeywordLearner: keeps full query as expression template,
preserves linguistic context. Future intent matching can reuse these as
exemplars in stage 5 SEMANTIC or stage 8 LLM RAG context.

Cron schedule: 5min interval (background task in main.py / W6).
DB error → returns 0 gracefully.

Post-W0 fix-pass F1: rewritten with REAL Java schema:
- intent_match_records.user_input → query (SQL alias)
- intent_match_records.matched_intent_code → intent_code (SQL alias)
- intent_match_records.confidence_score (was: confidence)
- ai_learned_expressions.embedding_vec (new pgvector col, V20260501_15)
- expression_hash (SHA256, NOT NULL, ON CONFLICT key) — added per real schema
- source_type = 'SEMANTIC_HIGH' (NOT NULL, matches Java enum LearnedExpression.SourceType)
- id auto-generated via gen_random_uuid()
"""
from __future__ import annotations

import hashlib
import logging

from ai.embedding import get_embedding, vec_to_pgvector_text

logger = logging.getLogger(__name__)


# Reads recent high-confidence matches. SQL aliases preserve original loop body.
READ_SQL = """
SELECT user_input AS query, matched_intent_code AS intent_code, factory_id
FROM intent_match_records
WHERE confidence_score >= $1
  AND created_at > NOW() - INTERVAL '1 hour'
  AND matched_intent_code IS NOT NULL
"""

# REAL ai_learned_expressions has required NOT NULL columns:
# id (uuid → gen_random_uuid()::text), expression_hash (SHA256 hex), source_type.
# embedding_vec is the new pgvector column added by V20260501_15. Java's BLOB
# column embedding_vector is left untouched by Python writes.
INSERT_SQL = """
INSERT INTO ai_learned_expressions(
    id, intent_code, expression, expression_hash, source_type,
    embedding_vec, factory_id, is_active, created_at, updated_at
)
VALUES(gen_random_uuid()::text, $1, $2, $3, 'SEMANTIC_HIGH',
       $4::vector, $5, true, NOW(), NOW())
ON CONFLICT (expression_hash, factory_id) DO NOTHING
"""


def _compute_expression_hash(expression: str) -> str:
    """SHA256 hex digest. Real schema enforces NOT NULL + UNIQUE on expression_hash
    so Python must compute the same hash Java would (UTF-8, hex)."""
    return hashlib.sha256(expression.encode("utf-8")).hexdigest()


class ExpressionLearner:
    def __init__(self, pool):
        self.pool = pool

    async def run_once(self, min_confidence: float = 0.95) -> int:
        """Returns number of new expressions inserted (best-effort, ON CONFLICT skips dup).
        0 on error or empty.
        """
        count = 0
        try:
            async with self.pool.acquire() as conn:
                rows = await conn.fetch(READ_SQL, min_confidence)
                for row in rows:
                    vec = await get_embedding(row["query"])
                    if vec is None:
                        logger.warning("ExpressionLearner: embedding failed for %r, skipping",
                                       row["query"][:50])
                        continue
                    expr_hash = _compute_expression_hash(row["query"])
                    vec_text = vec_to_pgvector_text(vec)
                    await conn.execute(
                        INSERT_SQL,
                        row["intent_code"], row["query"], expr_hash,
                        vec_text, row["factory_id"],
                    )
                    count += 1
        except Exception:
            logger.exception("ExpressionLearner failed")
        return count
