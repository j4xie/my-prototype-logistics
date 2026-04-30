"""Async expression template learner (β C6).

Reads: intent_match_records (high-confidence rows)
Writes: learned_expressions (full template with embedding)

Different from KeywordLearner: keeps full query as expression template,
preserves linguistic context. Future intent matching can reuse these as
exemplars in stage 5 SEMANTIC or stage 8 LLM RAG context.

Cron schedule: 5min interval (background task in main.py / T19).
DB error → returns 0 gracefully.
"""
from __future__ import annotations

import logging

from ai.embedding import get_embedding

logger = logging.getLogger(__name__)


READ_SQL = """
SELECT query, intent_code, factory_id
FROM intent_match_records
WHERE confidence >= $1
  AND created_at > NOW() - INTERVAL '1 hour'
"""

INSERT_SQL = """
INSERT INTO learned_expressions(intent_code, expression, expression_embedding, factory_id, learned_at)
VALUES($1, $2, $3, $4, NOW())
ON CONFLICT DO NOTHING
"""


class ExpressionLearner:
    def __init__(self, pool):
        self.pool = pool

    async def run_once(self, min_confidence: float = 0.95) -> int:
        """Returns number of new expressions learned (INSERT count). 0 on error."""
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
                    await conn.execute(
                        INSERT_SQL,
                        row["intent_code"], row["query"], vec, row["factory_id"],
                    )
                    count += 1
        except Exception:
            logger.exception("ExpressionLearner failed")
        return count
