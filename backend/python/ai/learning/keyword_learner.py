"""Async keyword learner — extract unseen keywords from positive feedback (β C6).

Reads: training_samples (Java IntentFeedbackService writes; per audit R-IM4 fix)
Returns: dict[intent_code, set[new_keyword]] for downstream persistence

Cron schedule: 5min interval, started by main.py background task (T19/W6).
For β-α scope this task only builds the class with `run_once()`. Actual UPDATE
of ai_intent_configs.keywords JSON is W6 wiring concern.

Tokenizer is cheap: Chinese 2-4 char regex + stopword filter. Sufficient for
keyword extraction; jieba/BERT defer to Phase 3.
"""
from __future__ import annotations

import logging
import re
from typing import Dict, Iterable, List, Set

logger = logging.getLogger(__name__)


SAMPLE_QUERY_SQL = """
SELECT query, intent_code, factory_id, confidence
FROM training_samples
WHERE created_at > NOW() - INTERVAL '1 hour'
  AND confidence >= $1
"""

# Single-char stopwords (filtered separately even though regex below requires 2-4 chars)
STOP_WORDS = {"的", "是", "在", "了", "我", "你", "他", "她", "它", "和", "与", "或", "也"}


_CJK_RUN = re.compile(r"[一-龥]+")


def _ngrams_from_run(run: str) -> List[str]:
    """All 2/3/4-char overlapping n-grams from a contiguous CJK run."""
    out: List[str] = []
    for n in (2, 3, 4):
        for i in range(len(run) - n + 1):
            out.append(run[i : i + n])
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
                tok = run[i : i + n]
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
        """One pass over recent training_samples. Returns {intent_code: set(new_keywords)}.

        Persistence (UPDATE ai_intent_configs.keywords) is W6 integration concern.
        DB error → returns {} gracefully (degrade not crash).
        """
        learned: Dict[str, Set[str]] = {}
        try:
            async with self.pool.acquire() as conn:
                rows = await conn.fetch(SAMPLE_QUERY_SQL, min_confidence)
        except Exception:
            logger.exception("KeywordLearner: read training_samples failed")
            return learned

        for row in rows:
            existing = self.existing_keywords.get(row["intent_code"], [])
            new = extract_new_keywords(row["query"], existing)
            if new:
                learned.setdefault(row["intent_code"], set()).update(new)

        return learned
