"""Async parameter rule learner (β C6).

Reads: training_samples (rows with extracted_params JSON)
Writes: parameter_extraction_rules (regex patterns per intent_code + param_name)

Pattern generation is heuristic: for each (param_name, value) pair in feedback,
infer a simple regex (factory ID pattern, numeric pattern, alpha-numeric, etc).
Future calls can use these regex rules to skip LLM and directly extract params.

Cron: 5min interval (W6 wiring).
DB error → returns 0.
"""
from __future__ import annotations

import json
import logging
import re

logger = logging.getLogger(__name__)


READ_SQL = """
SELECT query, intent_code, factory_id, extracted_params
FROM training_samples
WHERE confidence >= $1
  AND created_at > NOW() - INTERVAL '1 hour'
  AND extracted_params IS NOT NULL
"""

INSERT_SQL = """
INSERT INTO parameter_extraction_rules(intent_code, param_name, pattern, factory_id, learned_at)
VALUES($1, $2, $3, $4, NOW())
ON CONFLICT DO NOTHING
"""


def generate_pattern(param_name: str, value: str) -> str:
    """Heuristic regex generator.

    Examples:
    - "F001" → r"F\\d+"
    - "100" → r"\\d+"
    - "ABC123" → r"[A-Z]+\\d+"
    - default → re.escape(value) (literal match)
    """
    if not value:
        return ""
    # Factory-style: letter prefix + digits
    if re.fullmatch(r"[A-Z]+\d+", value):
        prefix = re.match(r"[A-Z]+", value).group()
        return prefix + r"\d+"
    # Pure digits
    if re.fullmatch(r"\d+", value):
        return r"\d+"
    # Pure letters
    if re.fullmatch(r"[A-Za-z]+", value):
        return r"[A-Za-z]+"
    # Default: literal match
    return re.escape(value)


class ParameterLearner:
    def __init__(self, pool):
        self.pool = pool

    async def run_once(self, min_confidence: float = 0.9) -> int:
        """Returns number of new parameter rules learned. 0 on error or empty."""
        count = 0
        try:
            async with self.pool.acquire() as conn:
                rows = await conn.fetch(READ_SQL, min_confidence)
                for row in rows:
                    raw = row.get("extracted_params") or "{}"
                    try:
                        params = json.loads(raw) if isinstance(raw, str) else raw
                    except (json.JSONDecodeError, TypeError):
                        continue
                    if not params or not isinstance(params, dict):
                        continue
                    for param_name, value in params.items():
                        if value is None:
                            continue
                        pattern = generate_pattern(param_name, str(value))
                        if not pattern:
                            continue
                        await conn.execute(
                            INSERT_SQL,
                            row["intent_code"], param_name, pattern, row["factory_id"],
                        )
                        count += 1
        except Exception:
            logger.exception("ParameterLearner failed")
        return count
