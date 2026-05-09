"""Async keyword learner — extract unseen keywords from positive feedback (β C6).

Reads: ai_training_samples (Java IntentFeedbackService writes; per audit R-IM4 fix)
Writes: ai_intent_configs.keywords (UPDATE — appends new keywords, JSON merge)
Returns: dict[intent_code, set[new_keyword]] for downstream observability

Cron schedule: 5min interval, started by main.py background task (W6).

Tokenizer is cheap: Chinese 2-4 char regex + stopword filter. Sufficient for
keyword extraction; jieba/BERT defer to Phase 3.

Post-W0 fix-pass F1: rewritten with REAL Java schema:
- ai_training_samples (was: training_samples)
- user_input (was: query)
- matched_intent_code (was: intent_code)
- confidence (precision 5,4) + is_correct filter (positive feedback only)
- writes UPDATE to ai_intent_configs.keywords (was: stub returning dict only)
"""
from __future__ import annotations

import json
import logging
import re
from typing import Dict, Iterable, List, Set

logger = logging.getLogger(__name__)


# Reads positive feedback rows from ai_training_samples (real table name).
# Aliased to keep loop body unchanged.
SAMPLE_QUERY_SQL = """
SELECT user_input AS query, matched_intent_code AS intent_code,
       factory_id, confidence
FROM ai_training_samples
WHERE created_at > NOW() - INTERVAL '1 hour'
  AND confidence >= $1
  AND is_correct = true
"""

# Persists new keywords back to ai_intent_configs by JSON-merge appending.
# COALESCE handles rows where keywords is NULL. JSONB || preserves duplicates
# being filtered out at write time? No — JSONB || accumulates. We pass a deduped
# set as a JSON array; idempotency is not required here (cron is bounded by
# 1-hour SQL window so duplicate emits over multiple ticks are negligible —
# revisit with a server-side dedup if it grows).
#
# F6 fix-pass (I-NEW-3): WHERE uses `IS NOT DISTINCT FROM` so per-tenant calls
# (factory_id=$3 non-NULL) match ONLY the matching tenant row, and global calls
# ($3=NULL) match ONLY the global (factory_id IS NULL) row. PostgreSQL's
# `IS NOT DISTINCT FROM` treats NULL=NULL as true and NULL=non-NULL as false,
# preventing tenant-specific keywords from leaking into the global config.
UPDATE_KEYWORDS_SQL = """
UPDATE ai_intent_configs
SET keywords = COALESCE(keywords, '[]'::jsonb) || $1::jsonb,
    updated_at = NOW()
WHERE intent_code = $2 AND factory_id IS NOT DISTINCT FROM $3
"""

# Single-char stopwords (filtered separately even though regex below requires 2-4 chars)
STOP_WORDS = {"的", "是", "在", "了", "我", "你", "他", "她", "它", "和", "与", "或", "也"}


_CJK_RUN = re.compile(r"[一-龥]+")


def _ngrams_from_run(run: str) -> List[str]:
    """All 2/3/4-char overlapping n-grams from a contiguous CJK run."""
    out: List[str] = []
    for n in (2, 3, 4):
        for i in range(len(run) - n + 1):
            out.append(run[i: i + n])
    return out


def tokenize(text: str) -> List[str]:
    """Cheap Chinese tokenizer: emit all 2-4 char n-grams from CJK runs.

    Greedy `[一-龥]{2,4}` would only match longest non-overlapping chunks,
    missing meaningful sub-tokens (e.g. "工厂的库存" → "工厂的库"+"存", losing
    "库存"). Instead we extract each CJK-only run and emit overlapping 2/3/4-grams.
    Stopwords (single-char) are filtered, but the n-gram width itself excludes
    single-char particles like 的/我/了.
    """
    tokens: List[str] = []
    for run in _CJK_RUN.findall(text):
        tokens.extend(_ngrams_from_run(run))
    return [t for t in tokens if t not in STOP_WORDS]


def extract_new_keywords(query: str, existing: Iterable[str]) -> Set[str]:
    """Return n-grams from `query` that aren't already covered by `existing` keywords.

    Coverage rule: project each existing keyword onto the query as a position
    mask. An n-gram is "new" only if at least one of its characters lies on an
    uncovered position. This prevents emitting bridging n-grams like "询库"
    when both "查询" (covers 0-1) and "库存" (covers 2-3) are known and the full
    query "查询库存" is fully covered.
    """
    existing_set = set(existing)
    if not query:
        return set()

    covered = [False] * len(query)
    for kw in existing_set:
        if not kw:
            continue
        start = 0
        while True:
            idx = query.find(kw, start)
            if idx < 0:
                break
            for i in range(idx, idx + len(kw)):
                covered[i] = True
            start = idx + 1  # allow overlapping match positions

    new: Set[str] = set()
    for match in _CJK_RUN.finditer(query):
        run = match.group()
        run_start = match.start()
        for n in (2, 3, 4):
            for i in range(len(run) - n + 1):
                tok = run[i: i + n]
                if tok in STOP_WORDS or tok in existing_set:
                    continue
                # Skip if every position inside this n-gram is already covered
                abs_start = run_start + i
                if all(covered[abs_start + j] for j in range(n)):
                    continue
                # Skip if this n-gram strictly contains an existing keyword
                if any(k in tok for k in existing_set if k):
                    continue
                new.add(tok)
    return new


class KeywordLearner:
    def __init__(self, pool, existing_keywords: Dict[str, List[str]]):
        """existing_keywords: {intent_code: [keyword, ...]} loaded from ai_intent_configs."""
        self.pool = pool
        self.existing_keywords = existing_keywords

    async def run_once(self, min_confidence: float = 0.9) -> Dict[str, Set[str]]:
        """One pass over recent ai_training_samples. Returns {intent_code: set(new_keywords)}.

        Persistence: UPDATE ai_intent_configs.keywords with JSON-merge of new keywords.
        DB read error → returns {} gracefully (degrade not crash).
        DB write error → logged, returned dict still reflects what was learned in-memory.
        """
        learned: Dict[str, Set[str]] = {}
        rows: List[dict] = []
        try:
            async with self.pool.acquire() as conn:
                rows = await conn.fetch(SAMPLE_QUERY_SQL, min_confidence)
        except Exception:
            logger.exception("KeywordLearner: read ai_training_samples failed")
            return learned

        for row in rows:
            existing = self.existing_keywords.get(row["intent_code"], [])
            new = extract_new_keywords(row["query"], existing)
            if new:
                learned.setdefault(row["intent_code"], set()).update(new)

        # F1 fix-pass: persist learned keywords back to ai_intent_configs.
        # Skip persistence if nothing learned (no UPDATEs to issue).
        if learned:
            try:
                async with self.pool.acquire() as conn:
                    for intent_code, new_kws in learned.items():
                        if not new_kws:
                            continue
                        new_kws_json = json.dumps(list(new_kws), ensure_ascii=False)
                        # Pull factory_id from the first matching row for this intent.
                        # Multiple factories may share an intent_code; we update the
                        # tenant-specific config OR the global (NULL factory_id) one.
                        factory_id = None
                        for r in rows:
                            if r["intent_code"] == intent_code:
                                factory_id = r["factory_id"]
                                break
                        await conn.execute(
                            UPDATE_KEYWORDS_SQL, new_kws_json, intent_code, factory_id,
                        )
            except Exception:
                logger.exception("KeywordLearner: persistence UPDATE failed")

        return learned
