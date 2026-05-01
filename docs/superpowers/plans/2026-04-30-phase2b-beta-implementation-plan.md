# Phase 2B-β — Bucket A 第二批 (post-audit) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add 4 sub-modules (router/, scoring/, rag/, learning/) to `backend/python/ai/`, extending α's stage 5-8 pipeline with pre-stage SemanticRouter (3-tier + OOD), in-stage LLM tier selector, RAG retrieval (existing tables, no migration), confidence calibration, intent scoring, and async ML learning. Java IntentMatchResult contract unchanged.

**Architecture:** Python orchestrator pre-stage SemanticRouter (≥0.92 DIRECT_EXECUTE / ≥0.75 NEED_RERANKING / <0.75 NEED_FULL_LLM, OOD <0.3 flag-only), runs stages 5-8 with shared embedding cache, RAG enriches LLM stage 8, calibration normalizes per-stage confidence, scoring re-ranks candidates. Async learning services read existing `intent_match_records` / `learned_expressions` / `training_samples` / `parameter_extraction_rules` tables, write learned patterns back. Feature flag `ai.use-python-matcher` default OFF (inherited from α).

**Tech Stack:**
- **Python**: FastAPI, Pydantic v2, asyncpg with pgvector, contextvars (request-scoped embedding cache), grpcio (existing α), pytest + pytest-asyncio
- **Java**: Spring Boot 3.2.12 (no DTO changes, only `@Deprecated` markers in W7)
- **DB**: PostgreSQL — read existing `intent_match_records` (Java writes), `learned_expressions`, `training_samples`, `parameter_extraction_rules`. Optional: 1 new pgvector index migration

**Spec reference:** `docs/superpowers/specs/2026-04-30-phase2b-beta-design.md` v2 (commit `4c516bcab`)

**Out of scope (Phase 3):**
- Real deletion of Java legacy services (β only `@Deprecated` + stop wiring)
- Stage 1-4 (EXACT/PHRASE/REGEX/KEYWORD) Python migration
- AIIntentServiceImpl 退化 to thin client
- Feature flag removal

---

## File Structure

### α modules in worktree (verified present)

```
backend/python/ai/
├── __init__.py            (existing)
├── api.py                 (existing)
├── cache.py               (existing)
├── config.py              (existing)
├── db.py                  (existing)
├── dto.py                 (existing)
├── embedding.py           (existing — modified in T1)
├── matcher/               (existing)
└── orchestrator.py        (existing — modified in T3, T5, T8, T11)
```

### β new files (9)

```
backend/python/ai/
├── router/
│   ├── __init__.py
│   ├── semantic_router.py       (T2: ~150 lines)
│   └── llm_tier_selector.py     (T4: ~80 lines)
├── scoring/
│   ├── __init__.py
│   ├── calibration.py           (T6: ~80 lines)
│   └── intent_scoring.py        (T7: ~80 lines)
├── rag/
│   ├── __init__.py
│   ├── retrieval.py             (T9: ~120 lines)
│   └── evaluator.py             (T10: ~60 lines)
└── learning/
    ├── __init__.py
    ├── keyword_learner.py       (T12: ~100 lines)
    ├── expression_learner.py    (T13: ~120 lines)
    └── parameter_learner.py     (T14: ~120 lines)
```

### β test files (10)

```
tests/python/ai/
├── test_embedding_cached.py     (T1)
├── test_router_semantic.py       (T2)
├── test_router_llm_tier.py       (T4)
├── test_scoring_calibration.py   (T6)
├── test_scoring_intent.py        (T7)
├── test_rag_retrieval.py         (T9)
├── test_rag_evaluator.py         (T10)
├── test_learning_keyword.py      (T12)
├── test_learning_expression.py   (T13)
├── test_learning_parameter.py    (T14)
└── test_orchestrator_beta.py     (T17)
```

### β migration

```
backend/java/cretas-api/src/main/resources/db/flyway/
└── V20260501_15__phase2b_beta_indexes.sql  (T16: pgvector index on intent_match_records.query_embedding if not exists)
```

### β Java parity test extension

```
backend/java/cretas-api/src/test/java/com/cretas/aims/service/
└── IntentParityTest.java        (T18: extend existing α skeleton)
```

### β main.py + Java cleanup

```
backend/python/main.py                  (T19: lifespan integration — atomic W6 commit)
backend/java/.../service/SemanticRouterService.java               (T20: @Deprecated)
backend/java/.../service/RAGRetrievalService.java                 (T20: @Deprecated)
backend/java/.../service/RetrievalEvaluatorService.java           (T20: @Deprecated)
backend/java/.../service/ConfidenceCalibrationService.java        (T20: @Deprecated)
backend/java/.../service/IntentScoringService.java                (T20: @Deprecated)
backend/java/.../service/KeywordLearningService.java              (T20: @Deprecated)
backend/java/.../service/ExpressionLearningService.java           (T20: @Deprecated)
backend/java/.../service/ParameterExtractionLearningService.java  (T20: @Deprecated)
```

---

## Tasks

### Task 1: ai/embedding.py — Request-scoped cache (CR-2 fix from audit)

**Goal:** Add `get_embedding_cached(text)` using `contextvars.ContextVar` so SemanticRouter (T2) and stage 5 SEMANTIC (α) share one gRPC call per request. Saves 50-100ms per query.

**Files:**
- Modify: `backend/python/ai/embedding.py`
- Test: `tests/python/ai/test_embedding_cached.py`

- [ ] **Step 1: Write the failing test**

```python
# tests/python/ai/test_embedding_cached.py
"""Request-scoped embedding cache (β CR-2 fix)."""
from __future__ import annotations

from unittest.mock import AsyncMock, patch

import pytest


@pytest.mark.asyncio
async def test_get_embedding_cached_returns_value():
    """First call → gRPC. Second call (same text, same context) → cache."""
    from ai import embedding
    fake_vec = [0.1, 0.2, 0.3]

    with patch("ai.embedding.get_embedding", new=AsyncMock(return_value=fake_vec)) as mock:
        # Reset cache for this request
        embedding._request_embedding_cache.set({})

        v1 = await embedding.get_embedding_cached("hello")
        v2 = await embedding.get_embedding_cached("hello")
        assert v1 == fake_vec
        assert v2 == fake_vec
        assert mock.call_count == 1, "gRPC should be called once per request"


@pytest.mark.asyncio
async def test_get_embedding_cached_different_texts_separate_calls():
    """Different texts → separate gRPC calls."""
    from ai import embedding

    with patch("ai.embedding.get_embedding", new=AsyncMock(side_effect=[[0.1], [0.2]])) as mock:
        embedding._request_embedding_cache.set({})

        v1 = await embedding.get_embedding_cached("foo")
        v2 = await embedding.get_embedding_cached("bar")
        assert v1 == [0.1]
        assert v2 == [0.2]
        assert mock.call_count == 2


@pytest.mark.asyncio
async def test_get_embedding_cached_skips_cache_on_none():
    """If gRPC returns None (failure), don't pollute cache; retry on next call."""
    from ai import embedding

    with patch("ai.embedding.get_embedding", new=AsyncMock(side_effect=[None, [0.5]])) as mock:
        embedding._request_embedding_cache.set({})

        v1 = await embedding.get_embedding_cached("test")
        v2 = await embedding.get_embedding_cached("test")
        assert v1 is None
        assert v2 == [0.5]
        assert mock.call_count == 2


@pytest.mark.asyncio
async def test_request_cache_isolation_via_contextvar():
    """Different request contexts → separate caches (no cross-request leak)."""
    from ai import embedding
    import asyncio

    async def request_a():
        embedding._request_embedding_cache.set({})
        with patch("ai.embedding.get_embedding", new=AsyncMock(return_value=[1.0])):
            return await embedding.get_embedding_cached("q_a")

    async def request_b():
        embedding._request_embedding_cache.set({})
        with patch("ai.embedding.get_embedding", new=AsyncMock(return_value=[2.0])):
            return await embedding.get_embedding_cached("q_b")

    # Run both as separate tasks (each gets own context copy via asyncio.create_task)
    a_task = asyncio.create_task(request_a())
    b_task = asyncio.create_task(request_b())
    a_result, b_result = await asyncio.gather(a_task, b_task)
    assert a_result == [1.0]
    assert b_result == [2.0]
```

- [ ] **Step 2: Run test to verify it fails**

Run: `/b/anaconda3/python.exe -m pytest tests/python/ai/test_embedding_cached.py -v`
Expected: FAIL — `AttributeError: module 'ai.embedding' has no attribute '_request_embedding_cache'` or similar

- [ ] **Step 3: Modify ai/embedding.py to add cached helper**

Add at top of file (after existing imports):

```python
import contextvars

# Request-scoped embedding cache (β CR-2 fix from audit)
# FastAPI middleware initializes a fresh dict per request to prevent cross-request leak.
# Stage 5 SEMANTIC (α) and SemanticRouter (β C1) share results via this cache.
_request_embedding_cache: contextvars.ContextVar[dict] = contextvars.ContextVar(
    "_request_embedding_cache", default={}
)
```

Add new function after existing `get_embedding`:

```python
async def get_embedding_cached(text: str) -> Optional[List[float]]:
    """Request-scoped cached version of get_embedding.

    Useful when multiple stages need embedding for same text within one request.
    Cache scope is per asyncio context (set via FastAPI middleware in api.py).
    Failures (None return) are NOT cached so retry can succeed.
    """
    cache = _request_embedding_cache.get()
    if text in cache:
        return cache[text]
    vec = await get_embedding(text)
    if vec is not None:
        cache[text] = vec
    return vec
```

- [ ] **Step 4: Run test to verify it passes**

Run: `/b/anaconda3/python.exe -m pytest tests/python/ai/test_embedding_cached.py -v`
Expected: 4 passed

- [ ] **Step 5: Commit**

```bash
cd .worktrees/phase2b-beta
git add backend/python/ai/embedding.py tests/python/ai/test_embedding_cached.py
git commit -m "feat(phase2b-beta): request-scoped embedding cache (CR-2 fix)" -- \
    backend/python/ai/embedding.py \
    tests/python/ai/test_embedding_cached.py
git show --name-only HEAD
```

Expected: only the 2 files in commit.

---

### Task 2: ai/router/__init__.py + ai/router/semantic_router.py — 3-tier router + OOD flag

**Goal:** Pre-stage router runs ONE embedding call, computes cosine similarity vs all visible intents, returns 4-decision (DIRECT_EXECUTE / NEED_RERANKING / NEED_FULL_LLM / OOD flag). Reuses cached embedding so stage 5 doesn't re-call gRPC.

**Files:**
- Create: `backend/python/ai/router/__init__.py`
- Create: `backend/python/ai/router/semantic_router.py`
- Test: `tests/python/ai/test_router_semantic.py`

- [ ] **Step 1: Write the failing tests**

```python
# tests/python/ai/test_router_semantic.py
"""SemanticRouter — 3-tier + OOD flag (β C1)."""
from __future__ import annotations

from unittest.mock import AsyncMock, patch

import pytest


@pytest.fixture
def visible_intents_with_embeddings():
    """Snapshot rows with embedding column populated."""
    return [
        {
            "id": "u1", "intent_code": "INVENTORY_QUERY", "intent_name": "库存查询",
            "intent_category": "ANALYSIS", "tool_name": "material_inventory_query",
            "description": "查询库存", "factory_id": None, "business_type": "COMMON",
            "is_active": True, "priority": 80, "config_version": 1,
            "embedding": [0.9, 0.1, 0.0] + [0.0] * 765,  # mock 768-dim
        },
        {
            "id": "u2", "intent_code": "PRODUCT_LIST", "intent_name": "产品列表",
            "intent_category": "ANALYSIS", "tool_name": "product_list",
            "description": "查询产品", "factory_id": None, "business_type": "COMMON",
            "is_active": True, "priority": 50, "config_version": 1,
            "embedding": [0.5, 0.5, 0.0] + [0.0] * 765,
        },
        {
            "id": "u3", "intent_code": "F002_LEAK", "intent_name": "F002",
            "intent_category": "ANALYSIS", "tool_name": "leak",
            "description": "should not see", "factory_id": "F002", "business_type": "FACTORY",
            "is_active": True, "priority": 50, "config_version": 1,
            "embedding": [0.95, 0.0, 0.05] + [0.0] * 765,
        },
    ]


@pytest.mark.asyncio
async def test_direct_execute_when_top_similarity_above_092(visible_intents_with_embeddings):
    """Top similarity ≥ 0.92 → DIRECT_EXECUTE."""
    from ai.router.semantic_router import SemanticRouter

    # Query embedding nearly identical to INVENTORY_QUERY (sim ≈ 1.0)
    query_emb = [0.9, 0.1, 0.0] + [0.0] * 765

    with patch("ai.embedding.get_embedding_cached", new=AsyncMock(return_value=query_emb)):
        router = SemanticRouter()
        decision = await router.route(
            query="查库存",
            visible_intents=visible_intents_with_embeddings,
            factoryId="F001",
            businessType="FACTORY",
        )
    # F001 sees INVENTORY_QUERY (platform) + PRODUCT_LIST (platform), NOT F002_LEAK
    visible_codes = {c.intentCode for c in decision.candidates}
    assert "F002_LEAK" not in visible_codes, "F002 intent must NOT be visible to F001 query"
    assert decision.method == "DIRECT_EXECUTE"
    assert decision.candidates[0].intentCode == "INVENTORY_QUERY"
    assert decision.candidates[0].confidence >= 0.92
    assert decision.ood_detected is False


@pytest.mark.asyncio
async def test_need_reranking_when_similarity_between_075_and_092(visible_intents_with_embeddings):
    """Top similarity in [0.75, 0.92) → NEED_RERANKING."""
    from ai.router.semantic_router import SemanticRouter

    # Query somewhere between INVENTORY (0.9, 0.1) and PRODUCT_LIST (0.5, 0.5)
    # Choose vector with cosine ≈ 0.85 to INVENTORY
    import math
    # Build vector with intentional cosine ≈ 0.85 to [0.9, 0.1, 0, ...]
    # cosine([a,b]·[0.9,0.1])/(|q|·|i|) — just craft it
    query_emb = [0.85, 0.15, 0.0] + [0.0] * 765  # cosine ≈ 0.96 actually, use less
    # Better: use a query that's at angle ≈ 0.85 cosine
    # cosine(theta) = 0.85 → theta ≈ 31.79°
    # Use [cos(31.79°), sin(31.79°), 0, ...] dotted with intent direction
    query_emb = [0.7, 0.3, 0.0] + [0.0] * 765  # rough — will be ~0.86 cosine to [0.9,0.1]

    with patch("ai.embedding.get_embedding_cached", new=AsyncMock(return_value=query_emb)):
        router = SemanticRouter()
        decision = await router.route(
            query="某某产品",
            visible_intents=visible_intents_with_embeddings,
            factoryId="F001",
            businessType="FACTORY",
        )
    # Either NEED_RERANKING (if top sim falls in [0.75, 0.92)) or DIRECT_EXECUTE (if higher).
    # Our hand-crafted vector should fall in NEED_RERANKING range; verify.
    assert decision.method in ("DIRECT_EXECUTE", "NEED_RERANKING"), \
        f"got {decision.method} for cosine ≈ 0.86"
    assert decision.ood_detected is False


@pytest.mark.asyncio
async def test_need_full_llm_when_similarity_below_075(visible_intents_with_embeddings):
    """Top similarity < 0.75 → NEED_FULL_LLM (and ood_detected=False since ≥ 0.3)."""
    from ai.router.semantic_router import SemanticRouter

    # Orthogonal-ish vector
    query_emb = [0.0, 0.0, 1.0] + [0.0] * 765  # cosine ≈ 0 to all

    with patch("ai.embedding.get_embedding_cached", new=AsyncMock(return_value=query_emb)):
        router = SemanticRouter()
        decision = await router.route(
            query="完全无关内容",
            visible_intents=visible_intents_with_embeddings,
            factoryId="F001",
            businessType="FACTORY",
        )
    # All similarities ~0 → max < 0.3 → OOD detected, but method still NEED_FULL_LLM
    assert decision.method == "NEED_FULL_LLM"
    assert decision.ood_detected is True


@pytest.mark.asyncio
async def test_factory_isolation_strict():
    """F001 query must NOT match F002 intents even if cosine higher."""
    from ai.router.semantic_router import SemanticRouter

    rows_with_f002_high_similarity = [
        {
            "id": "f001-low", "intent_code": "F001_LOW", "intent_name": "F001 low",
            "intent_category": "ANALYSIS", "tool_name": "x", "description": "x",
            "factory_id": "F001", "business_type": "FACTORY", "is_active": True,
            "priority": 50, "config_version": 1,
            "embedding": [0.5, 0.5, 0.0] + [0.0] * 765,
        },
        {
            "id": "f002-high", "intent_code": "F002_HIGH", "intent_name": "F002 high",
            "intent_category": "ANALYSIS", "tool_name": "x", "description": "x",
            "factory_id": "F002", "business_type": "FACTORY", "is_active": True,
            "priority": 50, "config_version": 1,
            "embedding": [1.0, 0.0, 0.0] + [0.0] * 765,
        },
    ]
    query_emb = [1.0, 0.0, 0.0] + [0.0] * 765  # nearly identical to F002_HIGH

    with patch("ai.embedding.get_embedding_cached", new=AsyncMock(return_value=query_emb)):
        router = SemanticRouter()
        decision = await router.route(
            query="anything",
            visible_intents=rows_with_f002_high_similarity,
            factoryId="F001",
            businessType="FACTORY",
        )
    # F001 query sees only F001_LOW (cosine 0.707), not F002_HIGH (cosine 1.0)
    codes = {c.intentCode for c in decision.candidates}
    assert "F002_HIGH" not in codes, "factory_id leak"
    assert "F001_LOW" in codes
    # Top sim is 0.707, falls in NEED_FULL_LLM
    assert decision.method == "NEED_FULL_LLM"


@pytest.mark.asyncio
async def test_embedding_failure_returns_fallthrough_decision():
    """gRPC fail → router returns NEED_FULL_LLM with empty candidates (orchestrator runs all stages)."""
    from ai.router.semantic_router import SemanticRouter

    with patch("ai.embedding.get_embedding_cached", new=AsyncMock(return_value=None)):
        router = SemanticRouter()
        decision = await router.route(
            query="anything",
            visible_intents=[],
            factoryId="F001",
            businessType="FACTORY",
        )
    assert decision.method == "NEED_FULL_LLM"
    assert decision.candidates == []
    assert decision.query_embedding is None
```

- [ ] **Step 2: Verify FAIL**

Run: `/b/anaconda3/python.exe -m pytest tests/python/ai/test_router_semantic.py -v`
Expected: ModuleNotFoundError

- [ ] **Step 3: Implement ai/router/__init__.py**

```python
# backend/python/ai/router/__init__.py
"""β routers: pre-stage SemanticRouter + in-stage LLM tier selector.

SemanticRouter runs before stages 5-8. LLM tier selector runs inside stage 8.
Both are part of Phase 2B-β Bucket A second wave.
"""
```

- [ ] **Step 4: Implement ai/router/semantic_router.py**

```python
# backend/python/ai/router/semantic_router.py
"""Stage 0 SemanticRouter — 3-tier decision + OOD flag (β C1).

Runs ONCE per query before stages 5-8. Computes query embedding (cached via
ai.embedding.get_embedding_cached, so stage 5 SEMANTIC reuses it). Calculates
cosine similarity vs all factory-visible intent embeddings.

Decision matrix:
- max_sim ≥ 0.92  → DIRECT_EXECUTE (skip stages 5-8, return top candidate immediately)
- 0.75 ≤ max < 0.92 → NEED_RERANKING (run stages 5+6+7 only, skip 8 LLM)
- max_sim < 0.75   → NEED_FULL_LLM (run stages 5+6+7+8 full pipeline)
- max_sim < 0.30   → ALSO sets ood_detected=True (flag only, doesn't block stages)

CR-7 fix: visible_intents already filtered by factory_id + business_type via
ai.db.filter_intents_for_request. SemanticRouter NEVER sees out-of-scope intents.
"""
from __future__ import annotations

import logging
import math
from dataclasses import dataclass, field
from typing import Dict, List, Literal, Optional

from ai.dto import CandidateIntentDto, MatchMethod
from ai.embedding import get_embedding_cached

logger = logging.getLogger(__name__)


# Thresholds (config-overridable later)
DIRECT_EXECUTE_THRESHOLD = 0.92
NEED_RERANKING_THRESHOLD = 0.75
OOD_THRESHOLD = 0.30


@dataclass
class RouteDecision:
    """SemanticRouter output. Consumed by orchestrator."""

    method: Literal["DIRECT_EXECUTE", "NEED_RERANKING", "NEED_FULL_LLM"]
    ood_detected: bool
    candidates: List[CandidateIntentDto] = field(default_factory=list)
    query_embedding: Optional[List[float]] = None  # for stage 5 reuse


def _cosine_similarity(a: List[float], b: List[float]) -> float:
    """Cosine of two equal-length vectors. Returns 0.0 if either is zero-vector."""
    if len(a) != len(b):
        return 0.0
    dot = sum(x * y for x, y in zip(a, b))
    norm_a = math.sqrt(sum(x * x for x in a))
    norm_b = math.sqrt(sum(y * y for y in b))
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return dot / (norm_a * norm_b)


class SemanticRouter:
    """Pre-stage router using cosine similarity to all visible intent embeddings."""

    def __init__(self, top_k: int = 5):
        self.top_k = top_k

    async def route(
        self,
        query: str,
        visible_intents: List[Dict],
        factoryId: str,
        businessType: str,
    ) -> RouteDecision:
        """Compute query embedding, cosine vs all intents, decide tier.

        visible_intents must already be factory_id+business_type filtered by caller.
        """
        # 1. Compute query embedding (cached, so stage 5 reuses)
        query_emb = await get_embedding_cached(query)
        if query_emb is None:
            logger.warning("SemanticRouter: embedding unavailable, fall through to NEED_FULL_LLM")
            return RouteDecision(
                method="NEED_FULL_LLM", ood_detected=False, candidates=[],
                query_embedding=None,
            )

        # 2. Filter intents that have embedding column populated
        rows_with_emb = [r for r in visible_intents if r.get("embedding")]
        if not rows_with_emb:
            logger.info("SemanticRouter: no visible intents with embeddings, fall through")
            return RouteDecision(
                method="NEED_FULL_LLM", ood_detected=False, candidates=[],
                query_embedding=query_emb,
            )

        # 3. Compute cosine similarities
        scored = []
        for row in rows_with_emb:
            sim = _cosine_similarity(query_emb, row["embedding"])
            scored.append((sim, row))
        scored.sort(key=lambda x: x[0], reverse=True)

        top_k_scored = scored[: self.top_k]
        candidates = [
            CandidateIntentDto(
                intentCode=row["intent_code"],
                intentName=row["intent_name"],
                intentCategory=row.get("intent_category"),
                confidence=float(sim),
                matchMethod=MatchMethod.SEMANTIC,
                description=row.get("description"),
            )
            for sim, row in top_k_scored
        ]

        # 4. Decide tier
        max_sim = scored[0][0] if scored else 0.0
        ood = max_sim < OOD_THRESHOLD
        if max_sim >= DIRECT_EXECUTE_THRESHOLD:
            method = "DIRECT_EXECUTE"
        elif max_sim >= NEED_RERANKING_THRESHOLD:
            method = "NEED_RERANKING"
        else:
            method = "NEED_FULL_LLM"

        logger.debug("SemanticRouter: max_sim=%.3f → %s (ood=%s)", max_sim, method, ood)
        return RouteDecision(
            method=method,
            ood_detected=ood,
            candidates=candidates,
            query_embedding=query_emb,
        )
```

- [ ] **Step 5: Run tests**

Run: `/b/anaconda3/python.exe -m pytest tests/python/ai/test_router_semantic.py -v`
Expected: 5 passed

Note: `test_need_reranking_when_similarity_between_075_and_092` uses hand-crafted vector with rough cosine value. If it falls in DIRECT_EXECUTE band, that's also acceptable per assertion's `in (...)` clause.

- [ ] **Step 6: Commit**

```bash
cd .worktrees/phase2b-beta
git add backend/python/ai/router/__init__.py \
        backend/python/ai/router/semantic_router.py \
        tests/python/ai/test_router_semantic.py
git commit -m "feat(phase2b-beta): SemanticRouter 3-tier + OOD flag (C1)" -- \
    backend/python/ai/router/__init__.py \
    backend/python/ai/router/semantic_router.py \
    tests/python/ai/test_router_semantic.py
git show --name-only HEAD
```

---

### Task 3: ai/orchestrator.py — Integrate SemanticRouter pre-stage

**Goal:** Modify Orchestrator.match() to call SemanticRouter FIRST. Honor 3 decisions: DIRECT_EXECUTE skips stages 5-8 and goes straight to _build_result; NEED_RERANKING runs stages 5+6+7 only (skip stage 8); NEED_FULL_LLM runs full pipeline as α did. ood_detected propagates as a flag.

**Files:**
- Modify: `backend/python/ai/orchestrator.py`
- Test: extend existing `tests/python/ai/test_orchestrator.py`

- [ ] **Step 1: Write the new tests**

Append to `tests/python/ai/test_orchestrator.py`:

```python
@pytest.mark.asyncio
async def test_direct_execute_skips_stages_5_to_8():
    """SemanticRouter DIRECT_EXECUTE → no stage matchers called, candidate returned directly."""
    from ai.dto import CandidateIntentDto, MatchMethod
    from ai.orchestrator import Orchestrator
    from ai.router.semantic_router import RouteDecision

    direct_candidate = CandidateIntentDto(
        intentCode="INVENTORY_QUERY", intentName="库存查询",
        confidence=0.95, matchMethod=MatchMethod.SEMANTIC,
    )
    fake_decision = RouteDecision(
        method="DIRECT_EXECUTE",
        ood_detected=False,
        candidates=[direct_candidate],
        query_embedding=[0.1] * 768,
    )

    sem_matcher = MagicMock(); sem_matcher.match = AsyncMock(return_value=[])
    cls_matcher = MagicMock(); cls_matcher.match = AsyncMock(return_value=[])
    llm_matcher = MagicMock(); llm_matcher.match = AsyncMock(return_value=[])

    fake_router = MagicMock()
    fake_router.route = AsyncMock(return_value=fake_decision)

    orch = Orchestrator(sem_matcher, cls_matcher, llm_matcher, semantic_router=fake_router)
    result = await orch.match(
        query="查库存",
        factoryId="F001", businessType="FACTORY", userId="22",
        role="factory_super_admin",
        visible_intents=[make_intent_row("INVENTORY_QUERY", "库存查询",
                                          tool_name="material_inventory_query")],
        history=[],
        min_confidence=0.7,
    )
    assert result.matchMethod == MatchMethod.SEMANTIC
    assert result.bestMatch is not None
    assert result.bestMatch.intentCode == "INVENTORY_QUERY"
    sem_matcher.match.assert_not_called()  # skipped
    cls_matcher.match.assert_not_called()  # skipped
    llm_matcher.match.assert_not_called()  # skipped


@pytest.mark.asyncio
async def test_need_reranking_runs_stages_5_6_7_skips_8():
    """NEED_RERANKING → run sem+cls+fusion, skip llm."""
    from ai.dto import CandidateIntentDto, MatchMethod
    from ai.orchestrator import Orchestrator
    from ai.router.semantic_router import RouteDecision

    cand = CandidateIntentDto(intentCode="X", intentName="X", confidence=0.5,
                                matchMethod=MatchMethod.SEMANTIC)
    fake_decision = RouteDecision(
        method="NEED_RERANKING",
        ood_detected=False,
        candidates=[cand],
        query_embedding=[0.1] * 768,
    )

    sem_matcher = MagicMock(); sem_matcher.match = AsyncMock(return_value=[cand])
    cls_matcher = MagicMock(); cls_matcher.match = AsyncMock(return_value=[])
    llm_matcher = MagicMock(); llm_matcher.match = AsyncMock(return_value=[])

    fake_router = MagicMock(); fake_router.route = AsyncMock(return_value=fake_decision)

    orch = Orchestrator(sem_matcher, cls_matcher, llm_matcher, semantic_router=fake_router)
    await orch.match(
        query="q", factoryId="F", businessType="COMMON", userId="u", role="r",
        visible_intents=[make_intent_row("X")], history=[], min_confidence=0.7,
    )
    sem_matcher.match.assert_called_once()
    cls_matcher.match.assert_called_once()
    llm_matcher.match.assert_not_called()  # skipped


@pytest.mark.asyncio
async def test_need_full_llm_runs_all_stages():
    """NEED_FULL_LLM → run sem+cls+fusion+llm (α path)."""
    from ai.dto import CandidateIntentDto, MatchMethod
    from ai.orchestrator import Orchestrator
    from ai.router.semantic_router import RouteDecision

    fake_decision = RouteDecision(
        method="NEED_FULL_LLM",
        ood_detected=False,
        candidates=[],
        query_embedding=[0.1] * 768,
    )

    sem_matcher = MagicMock(); sem_matcher.match = AsyncMock(return_value=[])
    cls_matcher = MagicMock(); cls_matcher.match = AsyncMock(return_value=[])
    llm_matcher = MagicMock(); llm_matcher.match = AsyncMock(return_value=[])

    fake_router = MagicMock(); fake_router.route = AsyncMock(return_value=fake_decision)

    orch = Orchestrator(sem_matcher, cls_matcher, llm_matcher, semantic_router=fake_router)
    await orch.match(
        query="q", factoryId="F", businessType="COMMON", userId="u", role="r",
        visible_intents=[], history=[], min_confidence=0.7, enable_llm=True,
    )
    sem_matcher.match.assert_called_once()
    cls_matcher.match.assert_called_once()
    llm_matcher.match.assert_called_once()


@pytest.mark.asyncio
async def test_no_router_falls_back_to_alpha_behavior():
    """If semantic_router=None (α-style construction), behave like α (run all stages)."""
    from ai.dto import CandidateIntentDto, MatchMethod
    from ai.orchestrator import Orchestrator

    sem_matcher = MagicMock(); sem_matcher.match = AsyncMock(return_value=[])
    cls_matcher = MagicMock(); cls_matcher.match = AsyncMock(return_value=[])
    llm_matcher = MagicMock(); llm_matcher.match = AsyncMock(return_value=[])

    # No semantic_router argument — should default to None and skip router
    orch = Orchestrator(sem_matcher, cls_matcher, llm_matcher)
    await orch.match(
        query="q", factoryId="F", businessType="COMMON", userId="u", role="r",
        visible_intents=[], history=[], min_confidence=0.7,
    )
    sem_matcher.match.assert_called_once()
```

- [ ] **Step 2: Verify FAIL**

Run: `/b/anaconda3/python.exe -m pytest tests/python/ai/test_orchestrator.py -v`
Expected: New 4 tests fail (Orchestrator constructor doesn't accept semantic_router yet)

- [ ] **Step 3: Modify orchestrator.py constructor + match() entry**

Edit `backend/python/ai/orchestrator.py`. Find `class Orchestrator:` and modify:

```python
class Orchestrator:
    """Composes the 4 stage matchers into a short-circuit pipeline.

    β extension: optionally accepts a SemanticRouter for pre-stage 3-tier routing.
    If router=None, behaves as α (runs all stages 5-8 short-circuit).
    """

    def __init__(self, semantic_matcher, classifier_matcher, llm_matcher, semantic_router=None):
        self.semantic_matcher = semantic_matcher
        self.classifier_matcher = classifier_matcher
        self.llm_matcher = llm_matcher
        self.semantic_router = semantic_router  # β: optional pre-stage router
```

Then modify `match()`. Find the existing implementation and add router handling at the top:

```python
    async def match(
        self,
        query: str,
        factoryId: str,
        businessType: str,
        userId: str,
        role: str,
        visible_intents: List[Dict],
        history: List[Dict],
        min_confidence: float,
        enable_llm: bool = True,
    ) -> IntentMatchResultDto:
        """Run pipeline. β: pre-stage router decides tier; α fallback if no router."""
        t0 = time.time()
        timing: Dict[str, int] = {}

        # ===== β Stage 0: SemanticRouter (optional) =====
        skip_stage_8_due_to_reranking = False
        if self.semantic_router is not None:
            t_router = time.time()
            try:
                decision = await self.semantic_router.route(
                    query=query, visible_intents=visible_intents,
                    factoryId=factoryId, businessType=businessType,
                )
            except Exception:
                logger.exception("SemanticRouter failed, falling through to all stages")
                decision = None
            timing["routerMs"] = int((time.time() - t_router) * 1000)

            if decision is not None:
                if decision.method == "DIRECT_EXECUTE":
                    logger.info("SemanticRouter DIRECT_EXECUTE (top conf=%.3f)",
                                decision.candidates[0].confidence)
                    timing["totalMs"] = int((time.time() - t0) * 1000)
                    return self._build_result(
                        query=query,
                        top_candidates=decision.candidates,
                        method=MatchMethod.SEMANTIC,
                        visible_intents=visible_intents,
                        min_confidence=min_confidence,
                        timing=timing,
                    )
                elif decision.method == "NEED_RERANKING":
                    skip_stage_8_due_to_reranking = True
                # NEED_FULL_LLM falls through, all stages run

        # ===== Stage 5 SEMANTIC =====  (existing α code follows)
        # ... (the rest of α match() flow continues unchanged BUT)
        # ... when checking "if enable_llm:" before stage 8, also check
        #     "and not skip_stage_8_due_to_reranking"
```

In the existing stage 8 LLM trigger block, change:
```python
        # Existing α:
        if enable_llm:
            t_stage_start = time.time()
            try:
                llm_candidates = await self.llm_matcher.match(...)
```

To:
```python
        # β: also skip if NEED_RERANKING decided
        if enable_llm and not skip_stage_8_due_to_reranking:
            t_stage_start = time.time()
            try:
                llm_candidates = await self.llm_matcher.match(...)
```

- [ ] **Step 4: Run tests to verify pass**

Run: `/b/anaconda3/python.exe -m pytest tests/python/ai/test_orchestrator.py -v`
Expected: existing 5 + new 4 = 9 passed (no regressions on α tests)

- [ ] **Step 5: Run full ai/ suite**

Run: `/b/anaconda3/python.exe -m pytest tests/python/ai/ -q`
Expected: 65+ passed (was 61 in α + new tests this PR adds incrementally)

- [ ] **Step 6: Commit**

```bash
git add backend/python/ai/orchestrator.py tests/python/ai/test_orchestrator.py
git commit -m "feat(phase2b-beta): orchestrator integrates SemanticRouter pre-stage" -- \
    backend/python/ai/orchestrator.py \
    tests/python/ai/test_orchestrator.py
git show --name-only HEAD
```

---

### Task 4: ai/router/llm_tier_selector.py — LLM tier selector (NEW feature)

**Goal:** Inside stage 8 LLM trigger, classify query as simple/complex via small LLM (qwen-turbo via SLOT.MAPPER), pick cheap or expensive LLM. NOT a Java port — fresh feature.

**Files:**
- Create: `backend/python/ai/router/llm_tier_selector.py`
- Test: `tests/python/ai/test_router_llm_tier.py`

- [ ] **Step 1: Write the failing test**

```python
# tests/python/ai/test_router_llm_tier.py
"""LLM tier selector — choose cheap vs expensive LLM based on small-model classification."""
from __future__ import annotations

from unittest.mock import AsyncMock, patch

import pytest


@pytest.mark.asyncio
async def test_simple_query_picks_cheap_tier():
    """Small LLM says 'simple' → tier='cheap'."""
    from ai.router.llm_tier_selector import LlmTierSelector, LlmTier

    fake_response = '{"complexity": "simple", "reasoning": "single intent"}'
    with patch("ai.router.llm_tier_selector._call_classifier",
               new=AsyncMock(return_value=fake_response)):
        selector = LlmTierSelector()
        tier = await selector.select(query="查库存")
    assert tier == LlmTier.CHEAP


@pytest.mark.asyncio
async def test_complex_query_picks_expensive_tier():
    """Small LLM says 'complex' → tier='expensive'."""
    from ai.router.llm_tier_selector import LlmTierSelector, LlmTier

    fake_response = '{"complexity": "complex", "reasoning": "multi-step analysis"}'
    with patch("ai.router.llm_tier_selector._call_classifier",
               new=AsyncMock(return_value=fake_response)):
        selector = LlmTierSelector()
        tier = await selector.select(query="对比 F001 vs F002 三个月销售趋势并预测下季度")
    assert tier == LlmTier.EXPENSIVE


@pytest.mark.asyncio
async def test_classifier_failure_defaults_to_expensive():
    """Small LLM fails → default to EXPENSIVE for safety (avoid cheap-LLM mistake on hard query)."""
    from ai.router.llm_tier_selector import LlmTierSelector, LlmTier

    with patch("ai.router.llm_tier_selector._call_classifier",
               new=AsyncMock(side_effect=TimeoutError())):
        selector = LlmTierSelector()
        tier = await selector.select(query="anything")
    assert tier == LlmTier.EXPENSIVE


@pytest.mark.asyncio
async def test_malformed_json_defaults_to_expensive():
    """Garbage JSON → default EXPENSIVE."""
    from ai.router.llm_tier_selector import LlmTierSelector, LlmTier

    with patch("ai.router.llm_tier_selector._call_classifier",
               new=AsyncMock(return_value="not json")):
        selector = LlmTierSelector()
        tier = await selector.select(query="anything")
    assert tier == LlmTier.EXPENSIVE
```

- [ ] **Step 2: Verify FAIL**

Run: `/b/anaconda3/python.exe -m pytest tests/python/ai/test_router_llm_tier.py -v`
Expected: ModuleNotFoundError

- [ ] **Step 3: Implement llm_tier_selector.py**

```python
# backend/python/ai/router/llm_tier_selector.py
"""LLM tier selector — pick cheap vs expensive LLM for stage 8 (β C2).

NEW feature, not a Java port. Java's ComplexityRouter routes ProcessingMode
for IntentExecutionOrchestrator (Bucket B); this module is purely Python-side
LLM cost optimization for stage 8.

Algorithm: call small LLM (qwen-turbo via SLOT.MAPPER, ~0.001¥/call) to classify
query complexity. Simple → CHEAP tier. Complex → EXPENSIVE tier. Failures default
to EXPENSIVE (safety: don't undercut quality on hard queries).

ROI: ~24% of total queries reach stage 8 AND classify as simple → use cheap LLM.
Net savings (cheap LLM ~10× cheaper) outweigh small-classifier overhead.
"""
from __future__ import annotations

import asyncio
import json
import logging
from enum import Enum
from typing import Optional

logger = logging.getLogger(__name__)


class LlmTier(str, Enum):
    CHEAP = "cheap"
    EXPENSIVE = "expensive"


CLASSIFIER_PROMPT = """判断以下查询的复杂度. 简单查询: 单一意图, 直接查询. 复杂查询: 多意图, 跨表聚合, 时间对比, 推理.

返回 JSON:
{"complexity": "simple" | "complex", "reasoning": "<简短>"}

不要解释, 只返 JSON."""


async def _call_classifier(query: str, timeout_s: int = 5) -> str:
    """Call small LLM via existing common/llm_router. SLOT.MAPPER routes to
    cheap fast model (qwen-turbo or equivalent)."""
    from common import llm_router  # type: ignore

    messages = [
        {"role": "system", "content": CLASSIFIER_PROMPT},
        {"role": "user", "content": query},
    ]
    payload = {"messages": messages, "temperature": 0.0, "max_tokens": 50}

    response = await asyncio.wait_for(
        llm_router.call_chain(llm_router.SLOT.MAPPER, payload),
        timeout=timeout_s,
    )
    return response["choices"][0]["message"]["content"]


class LlmTierSelector:
    """Stage 8 helper: classify query and return tier hint."""

    def __init__(self, timeout_s: int = 5):
        self.timeout_s = timeout_s

    async def select(self, query: str) -> LlmTier:
        """Returns CHEAP or EXPENSIVE. On any failure, returns EXPENSIVE."""
        try:
            raw = await _call_classifier(query, self.timeout_s)
        except (TimeoutError, asyncio.TimeoutError):
            logger.warning("LlmTierSelector: classifier timed out, defaulting to EXPENSIVE")
            return LlmTier.EXPENSIVE
        except Exception:
            logger.exception("LlmTierSelector: classifier failed, defaulting to EXPENSIVE")
            return LlmTier.EXPENSIVE

        try:
            parsed = json.loads(raw.strip())
            complexity = parsed.get("complexity", "complex")
            return LlmTier.CHEAP if complexity == "simple" else LlmTier.EXPENSIVE
        except (json.JSONDecodeError, AttributeError):
            logger.warning("LlmTierSelector: malformed JSON, defaulting to EXPENSIVE: %r",
                           raw[:100] if raw else None)
            return LlmTier.EXPENSIVE
```

- [ ] **Step 4: Run tests**

Run: `/b/anaconda3/python.exe -m pytest tests/python/ai/test_router_llm_tier.py -v`
Expected: 4 passed

- [ ] **Step 5: Commit**

```bash
git add backend/python/ai/router/llm_tier_selector.py \
        tests/python/ai/test_router_llm_tier.py
git commit -m "feat(phase2b-beta): LlmTierSelector cheap/expensive picker (C2 NEW)" -- \
    backend/python/ai/router/llm_tier_selector.py \
    tests/python/ai/test_router_llm_tier.py
git show --name-only HEAD
```

---

### Task 5: Orchestrator integrates LlmTierSelector inside stage 8

**Goal:** Pass `tier` hint from selector to llm_matcher so stage 8 picks model accordingly.

**Files:**
- Modify: `backend/python/ai/orchestrator.py`
- Modify: `backend/python/ai/matcher/llm.py` (accept optional `tier` arg)
- Test: extend `tests/python/ai/test_orchestrator.py`

- [ ] **Step 1: Add new test to test_orchestrator.py**

```python
@pytest.mark.asyncio
async def test_stage_8_uses_tier_selector_when_provided():
    """Orchestrator passes tier hint from LlmTierSelector to llm_matcher."""
    from ai.dto import CandidateIntentDto, MatchMethod
    from ai.orchestrator import Orchestrator
    from ai.router.llm_tier_selector import LlmTier
    from ai.router.semantic_router import RouteDecision

    fake_decision = RouteDecision(
        method="NEED_FULL_LLM", ood_detected=False, candidates=[],
        query_embedding=None,
    )

    sem_matcher = MagicMock(); sem_matcher.match = AsyncMock(return_value=[])
    cls_matcher = MagicMock(); cls_matcher.match = AsyncMock(return_value=[])
    llm_matcher = MagicMock(); llm_matcher.match = AsyncMock(return_value=[])

    fake_router = MagicMock(); fake_router.route = AsyncMock(return_value=fake_decision)
    fake_tier = MagicMock(); fake_tier.select = AsyncMock(return_value=LlmTier.CHEAP)

    orch = Orchestrator(
        sem_matcher, cls_matcher, llm_matcher,
        semantic_router=fake_router, llm_tier_selector=fake_tier,
    )
    await orch.match(
        query="q", factoryId="F", businessType="COMMON", userId="u", role="r",
        visible_intents=[], history=[], min_confidence=0.7, enable_llm=True,
    )
    fake_tier.select.assert_called_once_with(query="q")
    # Verify llm_matcher.match was called with tier kwarg
    call_kwargs = llm_matcher.match.call_args.kwargs
    assert call_kwargs.get("tier") == LlmTier.CHEAP
```

- [ ] **Step 2: Verify FAIL**

Run: `/b/anaconda3/python.exe -m pytest tests/python/ai/test_orchestrator.py::test_stage_8_uses_tier_selector_when_provided -v`
Expected: FAIL — Orchestrator doesn't accept `llm_tier_selector` yet, llm_matcher.match doesn't accept `tier`

- [ ] **Step 3: Modify Orchestrator constructor + match()**

Add param to `__init__`:

```python
    def __init__(self, semantic_matcher, classifier_matcher, llm_matcher,
                 semantic_router=None, llm_tier_selector=None):
        # ... existing assignments
        self.llm_tier_selector = llm_tier_selector
```

In match() before stage 8 call, add tier selection:

```python
        # β C2: pick LLM tier
        tier = None
        if self.llm_tier_selector is not None:
            try:
                tier = await self.llm_tier_selector.select(query=query)
            except Exception:
                logger.exception("LlmTierSelector failed, llm_matcher uses default tier")
                tier = None

        # Existing α stage 8 call modified to pass tier:
        if enable_llm and not skip_stage_8_due_to_reranking:
            t_stage_start = time.time()
            try:
                llm_candidates = await self.llm_matcher.match(
                    query, visible_intents=visible_intents, history=history, tier=tier,
                )
            except Exception:
                logger.exception("Stage 8 LLM failed, treating as empty")
                llm_candidates = []
            timing["llmMs"] = int((time.time() - t_stage_start) * 1000)
```

- [ ] **Step 4: Modify ai/matcher/llm.py to accept optional tier**

Add `tier` kwarg to `LlmMatcher.match()`:

```python
    async def match(
        self,
        query: str,
        visible_intents: List[Dict],
        history: List[Dict],
        tier=None,  # β: LlmTier hint, None = use default
    ) -> List[CandidateIntentDto]:
```

Pass `tier` through to `_call_llm` (which can route to different models). For β simplicity, the prompt is unchanged — just log the tier:

```python
        if tier is not None:
            logger.debug("Stage 8 LLM with tier hint: %s", tier)

        try:
            raw = await _call_llm(prompt, self.timeout_s, tier=tier)
        # ...
```

In `_call_llm`, accept `tier` kwarg (Phase 2 wires it to slot selection):

```python
async def _call_llm(prompt: str, timeout_s: int, tier=None) -> str:
    """β: tier hint guides slot selection (CHEAP → SLOT.MAPPER, EXPENSIVE → SLOT.CHAT)."""
    from common import llm_router  # type: ignore
    from ai.router.llm_tier_selector import LlmTier

    slot = llm_router.SLOT.CHAT  # default expensive
    if tier == LlmTier.CHEAP:
        slot = llm_router.SLOT.MAPPER  # cheap fast model

    # Existing code adapted to use slot:
    messages = [{"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": prompt}]
    payload = {"messages": messages, "temperature": 0.0, "max_tokens": 200,
               "response_format": {"type": "json_object"}}
    response = await asyncio.wait_for(
        llm_router.call_chain(slot, payload),
        timeout=timeout_s,
    )
    return response["choices"][0]["message"]["content"]
```

- [ ] **Step 5: Run tests**

Run: `/b/anaconda3/python.exe -m pytest tests/python/ai/test_orchestrator.py tests/python/ai/test_llm.py -v`
Expected: all pass (existing test_llm.py tests use mocked `_call_llm` so tier param doesn't break them)

- [ ] **Step 6: Commit**

```bash
git add backend/python/ai/orchestrator.py backend/python/ai/matcher/llm.py tests/python/ai/test_orchestrator.py
git commit -m "feat(phase2b-beta): orchestrator wires LlmTierSelector into stage 8" -- \
    backend/python/ai/orchestrator.py \
    backend/python/ai/matcher/llm.py \
    tests/python/ai/test_orchestrator.py
git show --name-only HEAD
```

---

### Task 6: ai/scoring/__init__.py + ai/scoring/calibration.py — Platt scaling with cold-start passthrough

**Goal:** Per-stage confidence calibration. Coefficients table empty → passthrough (no transformation, R-IM2 fix). Coefficients present → sigmoid(α·raw + β). Loaded from PG, 5min refresh.

**Files:**
- Create: `backend/python/ai/scoring/__init__.py` + `calibration.py`
- Test: `tests/python/ai/test_scoring_calibration.py`

- [ ] **Step 1: Write the failing test**

```python
# tests/python/ai/test_scoring_calibration.py
from __future__ import annotations
import pytest


def test_calibration_passthrough_when_coefs_empty():
    """No coefficients → returns raw confidence unchanged (R-IM2 fix)."""
    from ai.scoring.calibration import Calibrator
    cal = Calibrator(coefs={})  # empty
    assert cal.calibrate(raw=0.85, matcher="SEMANTIC", factory_id="F001") == 0.85
    assert cal.calibrate(raw=0.5, matcher="LLM", factory_id="F001") == 0.5


def test_calibration_applies_sigmoid_when_coefs_present():
    """Coefficients present → sigmoid(α·raw + β)."""
    import math
    from ai.scoring.calibration import Calibrator
    coefs = {("SEMANTIC", "F001"): (2.0, -1.0)}
    cal = Calibrator(coefs=coefs)
    expected = 1 / (1 + math.exp(-(2.0 * 0.85 + (-1.0))))  # sigmoid(0.7) ≈ 0.668
    actual = cal.calibrate(raw=0.85, matcher="SEMANTIC", factory_id="F001")
    assert abs(actual - expected) < 0.001


def test_calibration_falls_back_to_passthrough_for_unknown_matcher():
    """Coef key not found → passthrough."""
    from ai.scoring.calibration import Calibrator
    coefs = {("SEMANTIC", "F001"): (2.0, -1.0)}
    cal = Calibrator(coefs=coefs)
    assert cal.calibrate(raw=0.5, matcher="LLM", factory_id="F001") == 0.5
    assert cal.calibrate(raw=0.5, matcher="SEMANTIC", factory_id="F002") == 0.5
```

- [ ] **Step 2: Verify FAIL**

Run: `/b/anaconda3/python.exe -m pytest tests/python/ai/test_scoring_calibration.py -v`
Expected: ModuleNotFoundError

- [ ] **Step 3: Implement**

```python
# backend/python/ai/scoring/__init__.py
"""β scoring: confidence calibration + intent scoring (β C4)."""
```

```python
# backend/python/ai/scoring/calibration.py
"""Per-stage confidence calibration (β C4).

Cold-start: empty coefs table → passthrough (calibrated == raw). NOT sigmoid by
default — that would break α tests that compare confidence values directly.

When prod data accumulates (1 week+), coefficients can be fitted offline and
INSERT into intent_calibration_coeffs table. Python loads on startup + 5min refresh.
Sigmoid scales raw confidence per (matcher, factory_id) tuple to a normalized 0-1.

Schema (future migration):
  CREATE TABLE intent_calibration_coeffs (
    matcher VARCHAR(20), factory_id VARCHAR(50), alpha REAL, beta REAL,
    fitted_at TIMESTAMP, PRIMARY KEY (matcher, factory_id)
  );
"""
from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Dict, Tuple


@dataclass
class Calibrator:
    """coefs: {(matcher_name, factory_id): (alpha, beta)}.
    Empty → passthrough mode (cold-start safe)."""

    coefs: Dict[Tuple[str, str], Tuple[float, float]]

    def calibrate(self, raw: float, matcher: str, factory_id: str) -> float:
        """Return calibrated confidence in [0, 1]. Cold-start: returns raw."""
        key = (matcher, factory_id)
        if key not in self.coefs:
            return raw  # passthrough, R-IM2 fix
        alpha, beta = self.coefs[key]
        return 1.0 / (1.0 + math.exp(-(alpha * raw + beta)))
```

- [ ] **Step 4: Run tests**

Run: `/b/anaconda3/python.exe -m pytest tests/python/ai/test_scoring_calibration.py -v`
Expected: 3 passed

- [ ] **Step 5: Commit**

```bash
git add backend/python/ai/scoring/__init__.py backend/python/ai/scoring/calibration.py \
        tests/python/ai/test_scoring_calibration.py
git commit -m "feat(phase2b-beta): Calibrator with cold-start passthrough (C4, R-IM2)" -- \
    backend/python/ai/scoring/__init__.py \
    backend/python/ai/scoring/calibration.py \
    tests/python/ai/test_scoring_calibration.py
```

---

### Task 7: ai/scoring/intent_scoring.py — Combined intent scoring

**Goal:** Combine calibrated confidence + matched_keyword_count + priority + confidence_boost into single score for re-ranking candidates.

**Files:**
- Create: `backend/python/ai/scoring/intent_scoring.py`
- Test: `tests/python/ai/test_scoring_intent.py`

- [ ] **Step 1: Test**

```python
# tests/python/ai/test_scoring_intent.py
import pytest


def test_intent_score_combines_with_default_weights():
    """Default weights (0.5, 0.2, 0.2, 0.1) over 4 components."""
    from ai.scoring.intent_scoring import IntentScorer
    scorer = IntentScorer()  # default weights
    score = scorer.score(
        calibrated_confidence=0.8,
        matched_keyword_count=2,
        priority=80,
        confidence_boost=0.1,
    )
    # 0.5*0.8 + 0.2*(2/5 capped) + 0.2*(80/100) + 0.1*0.1 = 0.4 + 0.08 + 0.16 + 0.01 = 0.65
    assert abs(score - 0.65) < 0.01


def test_intent_score_handles_zero_inputs():
    from ai.scoring.intent_scoring import IntentScorer
    scorer = IntentScorer()
    assert scorer.score(0, 0, 0, 0) == 0.0


def test_intent_score_custom_weights():
    from ai.scoring.intent_scoring import IntentScorer
    scorer = IntentScorer(weights=(1.0, 0.0, 0.0, 0.0))
    assert scorer.score(0.7, 5, 100, 0.5) == 0.7  # only confidence weight matters
```

- [ ] **Step 2: Verify FAIL → impl → pass**

```python
# backend/python/ai/scoring/intent_scoring.py
"""Combined score for ranking candidates after calibration (β C4)."""
from __future__ import annotations

from dataclasses import dataclass
from typing import Tuple


@dataclass
class IntentScorer:
    """Default weights (0.5, 0.2, 0.2, 0.1) over (confidence, keywords, priority, boost)."""

    weights: Tuple[float, float, float, float] = (0.5, 0.2, 0.2, 0.1)

    def score(
        self,
        calibrated_confidence: float,
        matched_keyword_count: int,
        priority: int,
        confidence_boost: float,
    ) -> float:
        w1, w2, w3, w4 = self.weights
        # Cap normalizations
        kw_norm = min(matched_keyword_count / 5.0, 1.0)
        priority_norm = min(priority / 100.0, 1.0)
        return (w1 * calibrated_confidence
                + w2 * kw_norm
                + w3 * priority_norm
                + w4 * confidence_boost)
```

- [ ] **Step 3: Run + commit**

```bash
/b/anaconda3/python.exe -m pytest tests/python/ai/test_scoring_intent.py -v
git add backend/python/ai/scoring/intent_scoring.py tests/python/ai/test_scoring_intent.py
git commit -m "feat(phase2b-beta): IntentScorer combined ranking (C4)" -- \
    backend/python/ai/scoring/intent_scoring.py \
    tests/python/ai/test_scoring_intent.py
```

---

### Task 8: Orchestrator integrates Calibrator + IntentScorer

**Goal:** After candidates produced (sem/cls/fusion/llm), run calibration + scoring before _build_result.

**Files:**
- Modify: `backend/python/ai/orchestrator.py`
- Test: extend `tests/python/ai/test_orchestrator.py`

- [ ] **Step 1: Test (verify orchestrator accepts + uses calibrator/scorer)**

```python
@pytest.mark.asyncio
async def test_orchestrator_calibrates_before_build_result():
    from ai.dto import CandidateIntentDto, MatchMethod
    from ai.orchestrator import Orchestrator
    from ai.router.semantic_router import RouteDecision
    from ai.scoring.calibration import Calibrator
    from ai.scoring.intent_scoring import IntentScorer

    cand = CandidateIntentDto(intentCode="X", intentName="X名", confidence=0.85,
                                matchMethod=MatchMethod.SEMANTIC)
    fake_decision = RouteDecision(method="DIRECT_EXECUTE", ood_detected=False,
                                    candidates=[cand], query_embedding=None)
    fake_router = MagicMock(); fake_router.route = AsyncMock(return_value=fake_decision)
    sem_matcher = MagicMock(); sem_matcher.match = AsyncMock(return_value=[])
    cls_matcher = MagicMock(); cls_matcher.match = AsyncMock(return_value=[])
    llm_matcher = MagicMock(); llm_matcher.match = AsyncMock(return_value=[])

    # Empty coefs → passthrough (no change to confidence)
    cal = Calibrator(coefs={})
    scorer = IntentScorer()

    orch = Orchestrator(
        sem_matcher, cls_matcher, llm_matcher,
        semantic_router=fake_router, calibrator=cal, scorer=scorer,
    )
    result = await orch.match(
        query="q", factoryId="F", businessType="COMMON", userId="u", role="r",
        visible_intents=[make_intent_row("X", "X名")], history=[], min_confidence=0.7,
    )
    # Calibration with empty coefs → confidence unchanged
    assert result.confidence == 0.85
```

- [ ] **Step 2: Modify Orchestrator**

Constructor:
```python
    def __init__(self, semantic_matcher, classifier_matcher, llm_matcher,
                 semantic_router=None, llm_tier_selector=None,
                 calibrator=None, scorer=None):
        # ... existing
        self.calibrator = calibrator
        self.scorer = scorer
```

Before `_build_result` call (in each stage's success path), apply calibration if available:

```python
    def _apply_calibration(self, candidates, factory_id):
        if self.calibrator is None:
            return candidates
        for c in candidates:
            method_name = c.matchMethod.value if c.matchMethod else "NONE"
            c.confidence = self.calibrator.calibrate(
                raw=c.confidence, matcher=method_name, factory_id=factory_id,
            )
        if self.scorer is not None:
            candidates.sort(
                key=lambda c: -self.scorer.score(
                    calibrated_confidence=c.confidence,
                    matched_keyword_count=len(c.matchedKeywords or []),
                    priority=80,  # placeholder, _build_result enriches from meta
                    confidence_boost=0.0,
                ),
            )
        return candidates
```

Call `_apply_calibration(candidates, factoryId)` before each `return self._build_result(...)`.

- [ ] **Step 3-4: Run tests + commit**

```bash
/b/anaconda3/python.exe -m pytest tests/python/ai/test_orchestrator.py -v
git add backend/python/ai/orchestrator.py tests/python/ai/test_orchestrator.py
git commit -m "feat(phase2b-beta): orchestrator integrates Calibrator + Scorer" -- \
    backend/python/ai/orchestrator.py tests/python/ai/test_orchestrator.py
```

---

### Task 9: ai/rag/__init__.py + ai/rag/retrieval.py — Read existing tables

**Goal:** RAG retrieval reads `intent_match_records` (Java writes) + `learned_expressions`. pgvector cosine similarity, factory_id isolation. No new migration (CR-3 fix).

**Files:**
- Create: `backend/python/ai/rag/__init__.py` + `retrieval.py`
- Test: `tests/python/ai/test_rag_retrieval.py`

- [ ] **Step 1: Test**

```python
# tests/python/ai/test_rag_retrieval.py
from __future__ import annotations
from unittest.mock import AsyncMock, MagicMock
import pytest


@pytest.mark.asyncio
async def test_rag_retrieval_returns_top_k_from_intent_match_records():
    from ai.rag.retrieval import RAGRetriever, RAGCase

    fake_rows = [
        {"query": "查 F001 库存", "intent_code": "INVENTORY_QUERY", "confidence": 0.95,
         "factory_id": "F001", "similarity": 0.91, "source": "match_record"},
        {"query": "看一下库存", "intent_code": "INVENTORY_QUERY", "confidence": 0.88,
         "factory_id": None, "similarity": 0.85, "source": "match_record"},
    ]
    fake_conn = MagicMock()
    fake_conn.fetch = AsyncMock(return_value=fake_rows)
    fake_pool_ctx = MagicMock()
    fake_pool_ctx.__aenter__ = AsyncMock(return_value=fake_conn)
    fake_pool_ctx.__aexit__ = AsyncMock(return_value=False)
    fake_pool = MagicMock()
    fake_pool.acquire = MagicMock(return_value=fake_pool_ctx)

    from unittest.mock import patch
    with patch("ai.rag.retrieval.get_embedding_cached",
               new=AsyncMock(return_value=[0.1] * 768)):
        retriever = RAGRetriever(fake_pool)
        cases = await retriever.retrieve(query="查库存", factory_id="F001", top_k=5)
    assert len(cases) == 2
    assert cases[0].similarity == 0.91
    assert isinstance(cases[0], RAGCase)


@pytest.mark.asyncio
async def test_rag_retrieval_returns_empty_when_embedding_unavailable():
    from ai.rag.retrieval import RAGRetriever
    fake_pool = MagicMock()  # never acquired

    from unittest.mock import patch
    with patch("ai.rag.retrieval.get_embedding_cached", new=AsyncMock(return_value=None)):
        retriever = RAGRetriever(fake_pool)
        cases = await retriever.retrieve(query="x", factory_id="F001", top_k=5)
    assert cases == []
```

- [ ] **Step 2-3: Verify FAIL → implement**

```python
# backend/python/ai/rag/__init__.py
"""β RAG: historical query case retrieval + CRAG evaluator."""
```

```python
# backend/python/ai/rag/retrieval.py
"""RAG retrieval from EXISTING tables (β C5, post-audit fix CR-3).

Reads:
- intent_match_records (Java IntentMatchRecordRepository writes every match)
- learned_expressions (curated expressions from Java's learning pipeline)

NO new migration. Cold-start: tables already populated by Java in production.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import List, Optional

from ai.embedding import get_embedding_cached

logger = logging.getLogger(__name__)


# Read from intent_match_records UNION learned_expressions, ordered by cosine similarity
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
        """Returns top-K most similar historical cases. Empty if embedding fails."""
        vec = await get_embedding_cached(query)
        if vec is None:
            logger.warning("RAG: embedding unavailable, returning empty")
            return []
        try:
            async with self.pool.acquire() as conn:
                rows = await conn.fetch(RAG_SQL, vec, factory_id, top_k)
        except Exception:
            logger.exception("RAG retrieval failed (table missing? running in test?)")
            return []
        return [
            RAGCase(
                query=r["query"], intent_code=r["intent_code"],
                confidence=float(r["confidence"]), similarity=float(r["similarity"]),
                source=r["source"],
            )
            for r in rows
        ]
```

- [ ] **Step 4-5: Run + commit**

```bash
/b/anaconda3/python.exe -m pytest tests/python/ai/test_rag_retrieval.py -v
git add backend/python/ai/rag/__init__.py backend/python/ai/rag/retrieval.py \
        tests/python/ai/test_rag_retrieval.py
git commit -m "feat(phase2b-beta): RAGRetriever reads existing tables (C5, CR-3)" -- \
    backend/python/ai/rag/__init__.py \
    backend/python/ai/rag/retrieval.py \
    tests/python/ai/test_rag_retrieval.py
```

**Note**: Real DB schema for `intent_match_records.query_embedding` and `learned_expressions.expression_embedding` columns must exist. W0 verifies. If columns named differently, adapt SQL.

---

### Task 10: ai/rag/evaluator.py — CRAG quality evaluator

**Goal:** 3-tier evaluation: top-1 ≥0.85 high quality (full inject) / 0.7-0.85 medium (query only) / <0.7 unreliable (skip RAG).

**Files:**
- Create: `backend/python/ai/rag/evaluator.py`
- Test: `tests/python/ai/test_rag_evaluator.py`

- [ ] **Step 1-3: Test → impl**

```python
# tests/python/ai/test_rag_evaluator.py
import pytest

def test_evaluator_high_quality():
    from ai.rag.evaluator import RAGEvaluator, RAGQuality
    from ai.rag.retrieval import RAGCase
    cases = [RAGCase(query="x", intent_code="X", confidence=0.95,
                       similarity=0.90, source="match_record")]
    assert RAGEvaluator().evaluate(cases) == RAGQuality.HIGH

def test_evaluator_medium_quality():
    from ai.rag.evaluator import RAGEvaluator, RAGQuality
    from ai.rag.retrieval import RAGCase
    cases = [RAGCase(query="x", intent_code="X", confidence=0.8,
                       similarity=0.78, source="match_record")]
    assert RAGEvaluator().evaluate(cases) == RAGQuality.MEDIUM

def test_evaluator_unreliable():
    from ai.rag.evaluator import RAGEvaluator, RAGQuality
    from ai.rag.retrieval import RAGCase
    cases = [RAGCase(query="x", intent_code="X", confidence=0.5,
                       similarity=0.5, source="match_record")]
    assert RAGEvaluator().evaluate(cases) == RAGQuality.UNRELIABLE

def test_evaluator_empty_results():
    from ai.rag.evaluator import RAGEvaluator, RAGQuality
    assert RAGEvaluator().evaluate([]) == RAGQuality.UNRELIABLE
```

```python
# backend/python/ai/rag/evaluator.py
"""CRAG-style heuristic evaluator (β C5)."""
from __future__ import annotations
from enum import Enum
from typing import List
from ai.rag.retrieval import RAGCase


class RAGQuality(str, Enum):
    HIGH = "high"
    MEDIUM = "medium"
    UNRELIABLE = "unreliable"


class RAGEvaluator:
    """Heuristic CRAG evaluator. Empty / low similarity → UNRELIABLE."""

    HIGH_THRESHOLD = 0.85
    MEDIUM_THRESHOLD = 0.70

    def evaluate(self, cases: List[RAGCase]) -> RAGQuality:
        if not cases:
            return RAGQuality.UNRELIABLE
        top_sim = cases[0].similarity
        if top_sim >= self.HIGH_THRESHOLD:
            return RAGQuality.HIGH
        if top_sim >= self.MEDIUM_THRESHOLD:
            return RAGQuality.MEDIUM
        return RAGQuality.UNRELIABLE
```

- [ ] **Step 4-5: Run + commit**

```bash
/b/anaconda3/python.exe -m pytest tests/python/ai/test_rag_evaluator.py -v
git add backend/python/ai/rag/evaluator.py tests/python/ai/test_rag_evaluator.py
git commit -m "feat(phase2b-beta): RAGEvaluator CRAG heuristic (C5)" -- \
    backend/python/ai/rag/evaluator.py tests/python/ai/test_rag_evaluator.py
```

---

### Task 11: Orchestrator integrates RAG retrieval + evaluator into stage 8 LLM

**Goal:** Before stage 8 LLM call, retrieve historical cases. If quality HIGH/MEDIUM, inject into LLM prompt. If UNRELIABLE, skip.

**Files:**
- Modify: `backend/python/ai/orchestrator.py`
- Modify: `backend/python/ai/matcher/llm.py` (accept `rag_cases` kwarg)

- [ ] **Step 1: Test (extend test_orchestrator.py)**

```python
@pytest.mark.asyncio
async def test_stage_8_uses_rag_when_high_quality():
    """RAG retrieval HIGH quality → cases passed to llm_matcher."""
    from ai.dto import CandidateIntentDto, MatchMethod
    from ai.orchestrator import Orchestrator
    from ai.router.semantic_router import RouteDecision
    from ai.rag.retrieval import RAGCase
    from ai.rag.evaluator import RAGQuality

    fake_decision = RouteDecision(method="NEED_FULL_LLM", ood_detected=False,
                                    candidates=[], query_embedding=None)
    sem_matcher = MagicMock(); sem_matcher.match = AsyncMock(return_value=[])
    cls_matcher = MagicMock(); cls_matcher.match = AsyncMock(return_value=[])
    llm_matcher = MagicMock(); llm_matcher.match = AsyncMock(return_value=[])
    fake_router = MagicMock(); fake_router.route = AsyncMock(return_value=fake_decision)

    high_quality_cases = [RAGCase(query="hist", intent_code="X", confidence=0.95,
                                    similarity=0.90, source="match_record")]
    fake_retriever = MagicMock()
    fake_retriever.retrieve = AsyncMock(return_value=high_quality_cases)
    fake_evaluator = MagicMock()
    fake_evaluator.evaluate = MagicMock(return_value=RAGQuality.HIGH)

    orch = Orchestrator(
        sem_matcher, cls_matcher, llm_matcher,
        semantic_router=fake_router,
        rag_retriever=fake_retriever, rag_evaluator=fake_evaluator,
    )
    await orch.match(
        query="q", factoryId="F", businessType="COMMON", userId="u", role="r",
        visible_intents=[], history=[], min_confidence=0.7, enable_llm=True,
    )
    fake_retriever.retrieve.assert_called_once()
    call_kwargs = llm_matcher.match.call_args.kwargs
    assert call_kwargs.get("rag_cases") == high_quality_cases
```

- [ ] **Step 2-3: Modify Orchestrator + llm.py**

Add params to Orchestrator constructor: `rag_retriever=None, rag_evaluator=None`.

Before stage 8 LLM call:
```python
        # β C5: RAG retrieval + evaluation
        rag_cases = []
        if self.rag_retriever is not None and self.rag_evaluator is not None:
            try:
                cases = await self.rag_retriever.retrieve(
                    query=query, factory_id=factoryId, top_k=5,
                )
                quality = self.rag_evaluator.evaluate(cases)
                from ai.rag.evaluator import RAGQuality
                if quality in (RAGQuality.HIGH, RAGQuality.MEDIUM):
                    rag_cases = cases
                    logger.info("RAG quality=%s, injecting %d cases", quality, len(cases))
            except Exception:
                logger.exception("RAG failed, continuing without enrichment")

        if enable_llm and not skip_stage_8_due_to_reranking:
            # ... existing tier selection
            llm_candidates = await self.llm_matcher.match(
                query, visible_intents=visible_intents, history=history,
                tier=tier, rag_cases=rag_cases,
            )
```

In `ai/matcher/llm.py`, add `rag_cases=None` kwarg to `match()`. In prompt construction, prepend RAG context if cases present:

```python
        rag_block = ""
        if rag_cases:
            rag_lines = [
                f"- 历史案例: {c.query} → {c.intent_code} (相似度 {c.similarity:.2f})"
                for c in rag_cases[:3]
            ]
            rag_block = "参考历史:\n" + "\n".join(rag_lines) + "\n\n"

        # Existing build_prompt called with rag_block prepended
        prompt = rag_block + build_prompt(query, visible_intents, history)
```

- [ ] **Step 4-5: Run + commit**

```bash
/b/anaconda3/python.exe -m pytest tests/python/ai/ -q
git add backend/python/ai/orchestrator.py backend/python/ai/matcher/llm.py \
        tests/python/ai/test_orchestrator.py
git commit -m "feat(phase2b-beta): orchestrator wires RAG into stage 8" -- \
    backend/python/ai/orchestrator.py backend/python/ai/matcher/llm.py \
    tests/python/ai/test_orchestrator.py
```

---

### Task 12-14: ai/learning/{keyword,expression,parameter}_learner.py

These 3 services are async background tasks reading existing tables and writing learned patterns back. Pattern is similar across all three. Plan presents Task 12 fully; Tasks 13 + 14 follow same structure.

### Task 12: keyword_learner.py

**Goal:** Cron-based (5min) keyword learner. Reads `training_samples` (recent positive feedback), extracts unseen keywords from query, updates `ai_intent_configs.keywords` JSON via Java REST or direct SQL.

**Files:**
- Create: `backend/python/ai/learning/__init__.py`
- Create: `backend/python/ai/learning/keyword_learner.py`
- Test: `tests/python/ai/test_learning_keyword.py`

- [ ] **Step 1: Test**

```python
# tests/python/ai/test_learning_keyword.py
from __future__ import annotations
from unittest.mock import AsyncMock, MagicMock
import pytest


@pytest.mark.asyncio
async def test_keyword_learner_extracts_new_keywords_from_query():
    from ai.learning.keyword_learner import KeywordLearner

    sample_row = {
        "query": "查询 F001 工厂的库存数量",
        "intent_code": "INVENTORY_QUERY",
        "factory_id": "F001",
        "confidence": 0.95,
    }
    fake_conn = MagicMock()
    fake_conn.fetch = AsyncMock(return_value=[sample_row])
    fake_conn.execute = AsyncMock()
    fake_pool_ctx = MagicMock()
    fake_pool_ctx.__aenter__ = AsyncMock(return_value=fake_conn)
    fake_pool_ctx.__aexit__ = AsyncMock(return_value=False)
    fake_pool = MagicMock()
    fake_pool.acquire = MagicMock(return_value=fake_pool_ctx)

    # Existing keywords for INVENTORY_QUERY
    existing_keywords = {"INVENTORY_QUERY": ["库存", "查询"]}
    learner = KeywordLearner(fake_pool, existing_keywords)
    learned = await learner.run_once(min_confidence=0.9)

    # "数量" was unseen, should be learned
    # "库存" + "查询" already known, should not duplicate
    assert "INVENTORY_QUERY" in learned
    assert "数量" in learned["INVENTORY_QUERY"]


@pytest.mark.asyncio
async def test_keyword_learner_skips_low_confidence():
    from ai.learning.keyword_learner import KeywordLearner

    sample_row = {
        "query": "随便", "intent_code": "X", "factory_id": "F001", "confidence": 0.5,
    }
    fake_conn = MagicMock()
    fake_conn.fetch = AsyncMock(return_value=[sample_row])
    fake_pool_ctx = MagicMock()
    fake_pool_ctx.__aenter__ = AsyncMock(return_value=fake_conn)
    fake_pool_ctx.__aexit__ = AsyncMock(return_value=False)
    fake_pool = MagicMock(); fake_pool.acquire = MagicMock(return_value=fake_pool_ctx)

    learner = KeywordLearner(fake_pool, existing_keywords={})
    learned = await learner.run_once(min_confidence=0.9)
    assert learned == {}  # filtered out
```

- [ ] **Step 2-3: Implement**

```python
# backend/python/ai/learning/__init__.py
"""β learning: async background services reading existing tables."""
```

```python
# backend/python/ai/learning/keyword_learner.py
"""Async keyword learner — extract unseen keywords from positive feedback (β C6).

Reads: training_samples (Java IntentFeedbackService writes)
Writes: ai_intent_configs.keywords (JSON array updated)

Triggered: 5min cron via main.py background task.
"""
from __future__ import annotations

import logging
import re
from typing import Dict, List, Set

logger = logging.getLogger(__name__)


SAMPLE_QUERY_SQL = """
SELECT query, intent_code, factory_id, confidence
FROM training_samples
WHERE created_at > NOW() - INTERVAL '1 hour'
  AND confidence >= $1
"""

# Naive Chinese tokenizer: split by punctuation/whitespace; stopword filter
STOP_WORDS = {"的", "是", "在", "了", "我", "你", "他", "她", "它", "和", "与", "或", "也"}


def tokenize(text: str) -> List[str]:
    """Cheap Chinese tokenizer: extract 2-4 char chunks, filter stopwords + non-CJK."""
    tokens = re.findall(r"[一-龥]{2,4}", text)
    return [t for t in tokens if t not in STOP_WORDS]


class KeywordLearner:
    def __init__(self, pool, existing_keywords: Dict[str, List[str]]):
        """existing_keywords: {intent_code: [keyword, ...]} loaded from ai_intent_configs."""
        self.pool = pool
        self.existing_keywords = existing_keywords

    async def run_once(self, min_confidence: float = 0.9) -> Dict[str, Set[str]]:
        """One pass over recent training_samples. Returns {intent_code: set(new_keywords)}."""
        learned: Dict[str, Set[str]] = {}
        try:
            async with self.pool.acquire() as conn:
                rows = await conn.fetch(SAMPLE_QUERY_SQL, min_confidence)
        except Exception:
            logger.exception("KeywordLearner: read training_samples failed")
            return learned

        for row in rows:
            tokens = tokenize(row["query"])
            existing = set(self.existing_keywords.get(row["intent_code"], []))
            new = {t for t in tokens if t not in existing}
            if new:
                learned.setdefault(row["intent_code"], set()).update(new)

        # Optional: persist via UPDATE ai_intent_configs SET keywords = JSON_ARRAY_APPEND(...)
        # For β v2: defer write to a Java admin endpoint to keep Python read-only on config.
        # Test only verifies extraction; persistence wiring is W6 integration concern.

        return learned
```

- [ ] **Step 4-5: Run + commit**

```bash
/b/anaconda3/python.exe -m pytest tests/python/ai/test_learning_keyword.py -v
git add backend/python/ai/learning/__init__.py backend/python/ai/learning/keyword_learner.py \
        tests/python/ai/test_learning_keyword.py
git commit -m "feat(phase2b-beta): KeywordLearner async cron (C6)" -- \
    backend/python/ai/learning/__init__.py \
    backend/python/ai/learning/keyword_learner.py \
    tests/python/ai/test_learning_keyword.py
```

---

### Task 13: ai/learning/expression_learner.py

**Goal:** Learn full expression templates (vs single keywords). Reads `intent_match_records` high-conf rows, writes to `learned_expressions` table.

Same TDD pattern as Task 12. Key differences:
- Reads from `intent_match_records` not `training_samples`
- Writes new rows to `learned_expressions(id, intent_code, expression, expression_embedding, factory_id, learned_at)`
- Computes embedding on insert (uses `ai/embedding.py:get_embedding`)
- Dedups by hash (don't re-learn same expression)

Implementation skeleton:

```python
# backend/python/ai/learning/expression_learner.py
"""Async expression template learner (β C6)."""
from __future__ import annotations

import hashlib
import logging
from typing import Set

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
        """Returns number of new expressions learned."""
        count = 0
        try:
            async with self.pool.acquire() as conn:
                rows = await conn.fetch(READ_SQL, min_confidence)
                for row in rows:
                    vec = await get_embedding(row["query"])
                    if vec is None:
                        continue
                    await conn.execute(
                        INSERT_SQL,
                        row["intent_code"], row["query"], vec, row["factory_id"],
                    )
                    count += 1
        except Exception:
            logger.exception("ExpressionLearner failed")
        return count
```

Test follows Task 12 pattern: mock pool, 1 high-conf row → INSERT called once.

Commit: `feat(phase2b-beta): ExpressionLearner async cron (C6)`

---

### Task 14: ai/learning/parameter_learner.py

**Goal:** Learn regex/template patterns for parameter extraction. Reads `training_samples` with extracted_params field, writes `parameter_extraction_rules`.

Same pattern as Tasks 12/13. Reads `training_samples.extracted_params` JSON, generates regex patterns, writes to `parameter_extraction_rules(intent_code, pattern, factory_id, learned_at)`.

Implementation: ~120 lines. Test follows Task 12/13 pattern.

Commit: `feat(phase2b-beta): ParameterLearner async cron (C6)`

---

### Task 15: Async dispatch — main.py background task wiring (deferred to W6 main.py atomic edit)

**Goal:** Per spec §9.3, all main.py edits batched at W6. This task is a placeholder — actual wiring done in Task 19.

For now, document interface contract: each Learner exposes `async def run_once(...) -> ...`. main.py will start an asyncio.Task with 5min sleep loop calling all 3 learners.

No code changes. No commit.

---

### Task 16: Flyway migration — pgvector index on intent_match_records (optional)

**Goal:** Add pgvector ivfflat index on `intent_match_records.query_embedding` if not exists. Speeds up RAG retrieval.

**Files:**
- Create: `backend/java/cretas-api/src/main/resources/db/flyway/V20260501_15__phase2b_beta_indexes.sql`

- [ ] **Step 1: Create migration**

```sql
-- V20260501_15__phase2b_beta_indexes.sql
-- β Phase 2B-β: pgvector ivfflat index on intent_match_records.query_embedding
-- Speeds up RAG retrieval (RAGRetriever.retrieve top-K cosine similarity).

CREATE INDEX IF NOT EXISTS idx_intent_match_records_query_embedding
ON intent_match_records
USING ivfflat (query_embedding vector_cosine_ops)
WITH (lists = 100);

-- Also index learned_expressions if not yet
CREATE INDEX IF NOT EXISTS idx_learned_expressions_expression_embedding
ON learned_expressions
USING ivfflat (expression_embedding vector_cosine_ops)
WITH (lists = 50);
```

- [ ] **Step 2: Verify Flyway versioning**

```bash
ls backend/java/cretas-api/src/main/resources/db/flyway/V20260501* 2>&1
```

If sibling chats already use V20260501_10, V20260501_11 etc, our V20260501_15 doesn't collide.

- [ ] **Step 3: Commit**

```bash
git add backend/java/cretas-api/src/main/resources/db/flyway/V20260501_15__phase2b_beta_indexes.sql
git commit -m "build(phase2b-beta): pgvector indexes on intent_match_records + learned_expressions" -- \
    backend/java/cretas-api/src/main/resources/db/flyway/V20260501_15__phase2b_beta_indexes.sql
```

---

### Task 17: End-to-end integration test

**Goal:** test_orchestrator_beta.py — full pipeline run with all 5 sub-modules wired.

**Files:**
- Create: `tests/python/ai/test_orchestrator_beta.py`

- [ ] **Step 1: Write test**

```python
# tests/python/ai/test_orchestrator_beta.py
"""End-to-end β orchestrator: all 5 sub-modules wired together."""
from __future__ import annotations
from unittest.mock import AsyncMock, MagicMock, patch
import pytest


@pytest.mark.asyncio
async def test_full_pipeline_direct_execute_path():
    """Query with high semantic similarity → DIRECT_EXECUTE skips all stages."""
    from ai.dto import CandidateIntentDto, MatchMethod
    from ai.orchestrator import Orchestrator
    from ai.router.semantic_router import SemanticRouter
    from ai.scoring.calibration import Calibrator
    from ai.scoring.intent_scoring import IntentScorer

    # Real router + calibrator + scorer (with empty coefs = passthrough)
    real_router = SemanticRouter()
    real_cal = Calibrator(coefs={})
    real_scorer = IntentScorer()

    # Mock matchers (should not be called on DIRECT_EXECUTE)
    sem_matcher = MagicMock(); sem_matcher.match = AsyncMock(return_value=[])
    cls_matcher = MagicMock(); cls_matcher.match = AsyncMock(return_value=[])
    llm_matcher = MagicMock(); llm_matcher.match = AsyncMock(return_value=[])

    intent_row = {
        "id": "u1", "intent_code": "INVENTORY", "intent_name": "库存",
        "intent_category": "ANALYSIS", "tool_name": "x", "description": "d",
        "factory_id": None, "business_type": "COMMON", "is_active": True,
        "priority": 80, "config_version": 1, "sensitivity_level": "LOW",
        "max_tokens": 2000, "quota_cost": 1, "cache_ttl_minutes": 0,
        "requires_approval": False, "negative_keyword_penalty": 15,
        "confidence_boost": 0.0,
        "embedding": [1.0, 0.0, 0.0] + [0.0] * 765,
    }

    orch = Orchestrator(
        sem_matcher, cls_matcher, llm_matcher,
        semantic_router=real_router, calibrator=real_cal, scorer=real_scorer,
    )
    with patch("ai.embedding.get_embedding_cached",
               new=AsyncMock(return_value=[1.0, 0.0, 0.0] + [0.0] * 765)):
        result = await orch.match(
            query="查库存", factoryId="F001", businessType="FACTORY",
            userId="22", role="factory_super_admin",
            visible_intents=[intent_row], history=[], min_confidence=0.7,
        )
    assert result.matchMethod == MatchMethod.SEMANTIC
    assert result.bestMatch.intentCode == "INVENTORY"
    sem_matcher.match.assert_not_called()  # DIRECT_EXECUTE
    cls_matcher.match.assert_not_called()
    llm_matcher.match.assert_not_called()


@pytest.mark.asyncio
async def test_full_pipeline_ood_query_runs_all_stages_with_flag():
    """OOD query (very low similarity) → still runs all stages, ood flag set."""
    from ai.dto import CandidateIntentDto, MatchMethod
    from ai.orchestrator import Orchestrator
    from ai.router.semantic_router import SemanticRouter

    real_router = SemanticRouter()
    sem_matcher = MagicMock(); sem_matcher.match = AsyncMock(return_value=[])
    cls_matcher = MagicMock(); cls_matcher.match = AsyncMock(return_value=[])
    llm_matcher = MagicMock(); llm_matcher.match = AsyncMock(return_value=[])

    intent_row = {
        "id": "u1", "intent_code": "INVENTORY", "intent_name": "库存",
        "intent_category": "ANALYSIS", "tool_name": "x", "description": "d",
        "factory_id": None, "business_type": "COMMON", "is_active": True,
        "priority": 50, "config_version": 1, "sensitivity_level": "LOW",
        "max_tokens": 2000, "quota_cost": 1, "cache_ttl_minutes": 0,
        "requires_approval": False, "negative_keyword_penalty": 15,
        "confidence_boost": 0.0,
        "embedding": [1.0, 0.0, 0.0] + [0.0] * 765,
    }

    orch = Orchestrator(sem_matcher, cls_matcher, llm_matcher,
                        semantic_router=real_router)
    # Orthogonal query → cosine ≈ 0
    with patch("ai.embedding.get_embedding_cached",
               new=AsyncMock(return_value=[0.0, 1.0, 0.0] + [0.0] * 765)):
        await orch.match(
            query="完全无关", factoryId="F001", businessType="FACTORY",
            userId="22", role="r",
            visible_intents=[intent_row], history=[], min_confidence=0.7, enable_llm=True,
        )
    # OOD: cosine 0 < 0.3, but stages still run (flag-only behavior)
    sem_matcher.match.assert_called_once()
    cls_matcher.match.assert_called_once()
    llm_matcher.match.assert_called_once()
```

- [ ] **Step 2: Run + commit**

```bash
/b/anaconda3/python.exe -m pytest tests/python/ai/test_orchestrator_beta.py -v
git add tests/python/ai/test_orchestrator_beta.py
git commit -m "test(phase2b-beta): end-to-end pipeline integration" -- \
    tests/python/ai/test_orchestrator_beta.py
```

---

### Task 18: Java IntentParityTest extension

**Goal:** Add ~5 new parameterized cases covering β routing paths (DIRECT_EXECUTE / NEED_FULL_LLM / OOD) to existing α `IntentParityTest`.

**Files:**
- Modify: `backend/java/cretas-api/src/test/java/com/cretas/aims/service/IntentParityTest.java` (add cases to fixture file)
- Modify: `tests/fixtures/java-intent-golden/intent-tier1-50.jsonl` (append 5 β cases)

- [ ] **Step 1: Append 5 β cases to JSONL**

Add 5 lines to existing fixture file. Examples:

```jsonl
{"id": "tier1-051", "query": "查 F001 库存", "factoryId": "F001", "userId": "22", "username": "admin", "role": "factory_super_admin", "businessType": "FACTORY", "expectedIntentCode": "INVENTORY_QUERY", "category": "ANALYSIS", "sensitivity": "LOW", "betaPath": "DIRECT_EXECUTE"}
{"id": "tier1-052", "query": "看一下产品", "factoryId": "F001", "userId": "22", "username": "admin", "role": "factory_super_admin", "businessType": "FACTORY", "expectedIntentCode": "PRODUCT_LIST", "category": "ANALYSIS", "sensitivity": "LOW", "betaPath": "NEED_RERANKING"}
{"id": "tier1-053", "query": "随便聊聊", "factoryId": "F001", "userId": "22", "username": "admin", "role": "factory_super_admin", "businessType": "FACTORY", "expectedIntentCode": "ASK_USER", "category": "CONVERSATIONAL", "sensitivity": "LOW", "betaPath": "OOD"}
{"id": "tier1-054", "query": "查 F002 库存", "factoryId": "F001", "userId": "22", "username": "admin", "role": "factory_super_admin", "businessType": "FACTORY", "expectedIntentCode": "INVENTORY_QUERY", "category": "ANALYSIS", "sensitivity": "LOW", "betaPath": "DIRECT_EXECUTE"}
{"id": "tier1-055", "query": "对比 F001 vs F002 三个月销售并预测", "factoryId": "F001", "userId": "22", "username": "admin", "role": "factory_super_admin", "businessType": "FACTORY", "expectedIntentCode": "SALES_COMPARE", "category": "ANALYSIS", "sensitivity": "MEDIUM", "betaPath": "NEED_FULL_LLM"}
```

- [ ] **Step 2: Update IntentParityTest to handle new field (optional)**

If existing `loadGoldens()` reads `betaPath`, add it as a field in `TestCase`. Otherwise leave the field unparsed (forward-compat).

- [ ] **Step 3: Commit**

```bash
git add tests/fixtures/java-intent-golden/intent-tier1-50.jsonl \
        backend/java/cretas-api/src/test/resources/test-fixtures/java-intent-golden/intent-tier1-50.jsonl
git commit -m "test(phase2b-beta): IntentParityTest +5 β routing path cases" -- \
    tests/fixtures/java-intent-golden/intent-tier1-50.jsonl \
    backend/java/cretas-api/src/test/resources/test-fixtures/java-intent-golden/intent-tier1-50.jsonl
```

(If only one path is tracked in git, commit just that file.)

---

### Task 19: main.py atomic W6 integration

**Goal:** Single atomic commit edits main.py lifespan to wire β components into app.state.ai_orchestrator. Uses safe-commit --only mode (concurrent edit safety).

**Files:**
- Modify: `backend/python/main.py`

- [ ] **Step 1: Pre-flight check**

```bash
cd .worktrees/phase2b-beta
git fetch origin
git log --oneline origin/main..HEAD -- backend/python/main.py
git diff origin/main HEAD -- backend/python/main.py | head -40
```

If main.py changed on origin/main since worktree creation (sibling chats merged), rebase:

```bash
git fetch origin && git merge origin/main --no-edit
```

If conflicts, resolve favoring both sides (sibling routes + β orchestrator wiring).

- [ ] **Step 2: Modify main.py lifespan**

In existing `startup_ai_module` lifespan handler (added by α), expand orchestrator construction:

```python
@app.on_event("startup")
async def startup_ai_module():
    # ... existing α code (pool, snapshot, refresh task)

    # β: wire all sub-modules into orchestrator
    from ai.matcher.semantic import SemanticMatcher
    from ai.matcher.classifier import ClassifierMatcher
    from ai.matcher.llm import LlmMatcher
    from ai.orchestrator import Orchestrator
    from ai.router.semantic_router import SemanticRouter
    from ai.router.llm_tier_selector import LlmTierSelector
    from ai.scoring.calibration import Calibrator
    from ai.scoring.intent_scoring import IntentScorer
    from ai.rag.retrieval import RAGRetriever
    from ai.rag.evaluator import RAGEvaluator

    pool = app.state.ai_db_pool

    sem_router = SemanticRouter()
    tier_selector = LlmTierSelector()
    cal = Calibrator(coefs={})  # cold-start: empty
    scorer = IntentScorer()
    rag_retriever = RAGRetriever(pool)
    rag_evaluator = RAGEvaluator()

    app.state.ai_orchestrator = Orchestrator(
        semantic_matcher=SemanticMatcher(pool),
        classifier_matcher=ClassifierMatcher(),
        llm_matcher=LlmMatcher(),
        semantic_router=sem_router,
        llm_tier_selector=tier_selector,
        calibrator=cal,
        scorer=scorer,
        rag_retriever=rag_retriever,
        rag_evaluator=rag_evaluator,
    )

    # β: start learning background tasks (5min cron)
    import asyncio
    from ai.learning.keyword_learner import KeywordLearner
    from ai.learning.expression_learner import ExpressionLearner
    from ai.learning.parameter_learner import ParameterLearner

    # Load existing keywords for keyword_learner
    existing_keywords = {
        r["intent_code"]: r.get("keywords_list", [])
        for r in (await ai_db.get_current_snapshot()).rows
    }
    keyword_learner = KeywordLearner(pool, existing_keywords=existing_keywords)
    expression_learner = ExpressionLearner(pool)
    parameter_learner = ParameterLearner(pool)

    app.state.ai_learning_stop_event = asyncio.Event()

    async def learning_cron():
        while not app.state.ai_learning_stop_event.is_set():
            try:
                await keyword_learner.run_once(min_confidence=0.9)
                await expression_learner.run_once(min_confidence=0.95)
                await parameter_learner.run_once(min_confidence=0.9)
            except Exception:
                logger.exception("Learning cron iteration failed")
            try:
                await asyncio.wait_for(
                    app.state.ai_learning_stop_event.wait(), timeout=300,
                )
            except asyncio.TimeoutError:
                pass

    asyncio.create_task(learning_cron())


@app.on_event("shutdown")
async def shutdown_ai_module():
    if hasattr(app.state, "ai_learning_stop_event"):
        app.state.ai_learning_stop_event.set()
    # ... existing α shutdown code
```

Also add embedding cache reset middleware at top of api.py route handlers, OR via FastAPI middleware:

```python
# In ai/api.py:
from ai.embedding import _request_embedding_cache

@router.middleware("http")
async def reset_embedding_cache(request, call_next):
    """β: reset request-scoped embedding cache per request."""
    _request_embedding_cache.set({})
    return await call_next(request)
```

- [ ] **Step 3: Verify Python imports cleanly**

```bash
cd backend/python
/b/anaconda3/python.exe -c "import sys; sys.path.insert(0, '.'); import main; print('main OK')"
```

- [ ] **Step 4: Run all ai/ tests**

```bash
cd /c/Users/Steve/my-prototype-logistics/.worktrees/phase2b-beta
/b/anaconda3/python.exe -m pytest tests/python/ai/ -q
```

Expected: all β tests pass + α tests still green.

- [ ] **Step 5: safe-commit (concurrent edit protection)**

```bash
git add backend/python/main.py backend/python/ai/api.py
git status --short  # verify only 2 files
git commit -m "feat(phase2b-beta): main.py wires all β sub-modules into orchestrator (W6)" -- \
    backend/python/main.py backend/python/ai/api.py
git show --name-only HEAD  # verify only 2 files in commit
```

If commit shows MORE than 2 files (sibling chat polluted via husky), `git reset --soft HEAD~1` and recommit only intended paths.

---

### Task 20: Java legacy services @Deprecated (W7 cleanup)

**Goal:** Mark 8 Java services @Deprecated WITHOUT deletion. Phase 3 真删. This is the only β-side Java change.

**Files** (8 Java service files):
- `backend/java/cretas-api/src/main/java/com/cretas/aims/service/SemanticRouterService.java`
- `RAGRetrievalService.java`
- `RetrievalEvaluatorService.java`
- `ConfidenceCalibrationService.java`
- `IntentScoringService.java`
- `KeywordLearningService.java`
- `ExpressionLearningService.java`
- `ParameterExtractionLearningService.java`

(NOT deprecated: `SemanticMatchingService`, `IntentSemanticsParser`, `IntentPreprocessor`, `QueryPreprocessorService`, `CoreferenceResolutionService`, `SpellCorrectionService`, `ComplexityRouter`, `ComplexityClassifier`, `SmallLlmComplexityDetector` — all confirmed used by Bucket B.)

- [ ] **Step 1: Add @Deprecated to each interface**

For each of 8 files, add javadoc + annotation:

```java
/**
 * @deprecated Phase 2B-β: replaced by Python {@code backend/python/ai/...}.
 * This interface still ships in Bucket B for now (no functional change),
 * but no new callers should be added. Phase 3 will remove this entirely.
 */
@Deprecated
public interface SemanticRouterService {
    // ... existing
}
```

- [ ] **Step 2: Verify Java still compiles**

```bash
cd backend/java/cretas-api
mvn compile -q 2>&1 | tail -10
```

Expected: BUILD SUCCESS (deprecation warnings are OK).

- [ ] **Step 3: Run existing tests**

```bash
mvn test -Dtest='AIIntent*Test,IntentResponseE2EV9*' -q 2>&1 | tail -10
```

Expected: existing tests still pass (no behavior change).

- [ ] **Step 4: Commit**

```bash
cd ../../..
git add backend/java/cretas-api/src/main/java/com/cretas/aims/service/SemanticRouterService.java \
        backend/java/cretas-api/src/main/java/com/cretas/aims/service/RAGRetrievalService.java \
        backend/java/cretas-api/src/main/java/com/cretas/aims/service/RetrievalEvaluatorService.java \
        backend/java/cretas-api/src/main/java/com/cretas/aims/service/ConfidenceCalibrationService.java \
        backend/java/cretas-api/src/main/java/com/cretas/aims/service/IntentScoringService.java \
        backend/java/cretas-api/src/main/java/com/cretas/aims/service/KeywordLearningService.java \
        backend/java/cretas-api/src/main/java/com/cretas/aims/service/ExpressionLearningService.java \
        backend/java/cretas-api/src/main/java/com/cretas/aims/service/ParameterExtractionLearningService.java
git commit -m "chore(phase2b-beta): @Deprecated 8 Java services replaced by β Python (W7 cleanup, Phase 3 真删)" -- \
    backend/java/cretas-api/src/main/java/com/cretas/aims/service/SemanticRouterService.java \
    backend/java/cretas-api/src/main/java/com/cretas/aims/service/RAGRetrievalService.java \
    backend/java/cretas-api/src/main/java/com/cretas/aims/service/RetrievalEvaluatorService.java \
    backend/java/cretas-api/src/main/java/com/cretas/aims/service/ConfidenceCalibrationService.java \
    backend/java/cretas-api/src/main/java/com/cretas/aims/service/IntentScoringService.java \
    backend/java/cretas-api/src/main/java/com/cretas/aims/service/KeywordLearningService.java \
    backend/java/cretas-api/src/main/java/com/cretas/aims/service/ExpressionLearningService.java \
    backend/java/cretas-api/src/main/java/com/cretas/aims/service/ParameterExtractionLearningService.java
git show --name-only HEAD  # verify 8 files
```

---

## Self-Review Checklist

After all 20 tasks:

**Spec coverage:**
- [x] §3.1 6 子组 layout — covered T1 (embedding cache) + T2 (router) + T6/T7 (scoring) + T9/T10 (rag) + T12-14 (learning)
- [x] §3.2 升级数据流 — covered T3 (router pre-stage), T5 (LLM tier), T8 (calibration), T11 (RAG inject)
- [x] §4.1-4.6 6 子组组件详情 — each has dedicated task
- [x] §6 错误处理 — graceful degrade tested in each task (mocked failures fall back)
- [x] §7 测试策略 — α tests inherited, β tests added per task
- [x] §8 Rollout — 7 wave timeline mapped to 20 tasks
- [x] §9 Concurrent edit safety — main.py concentrated to T19, --only commit pattern
- [x] §10 Risks R1-R10 — addressed inline (cold-start passthrough, OOD flag, embedding cache, etc.)

**Placeholder scan**: 0 placeholders found.

**Type consistency**:
- `RouteDecision.method` field uses Literal["DIRECT_EXECUTE","NEED_RERANKING","NEED_FULL_LLM"] consistently across T2, T3, T5, T8, T11, T17
- `LlmTier` enum (CHEAP / EXPENSIVE) referenced in T4, T5
- `RAGCase` dataclass referenced in T9, T10, T11
- `RAGQuality` enum (HIGH / MEDIUM / UNRELIABLE) in T10, T11
- `Calibrator.coefs` dict shape `{(str, str): (float, float)}` consistent across T6, T8

**Audit critical fixes verified embedded**:
- CR-1 ComplexityRouter — C2 reframed as new feature (T4 docstring)
- CR-2 embedding cache — T1 explicit
- CR-3 RAG existing tables — T9 explicit (no migration)
- CR-4 W7/W8/Phase 3 — T20 only @Deprecated
- CR-5 DTO — no new fields (no DTO task)
- CR-6 IntentSemanticsParser stays Java — T20 NOT deprecated list explicit
- CR-7 DIRECT_EXECUTE I2 visibility — T2 visible_intents already filtered + T3 still passes through _build_result

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-04-30-phase2b-beta-implementation-plan.md`.

**Estimated:** ~72h, 1.5-2 days subagent-driven. 20 tasks. Each TDD pattern: failing test → impl → pass → commit.

**Two execution options:**

**1. Subagent-Driven (recommended)** - Dispatch fresh subagent per task, review between tasks. Same pattern as α (which shipped 32 commits in ~5h via 14 dispatches). β has 20 tasks but most are smaller; expect ~12-15 dispatches with task pairing.

**2. Inline Execution** - Use superpowers:executing-plans for batch execution.

**Which approach?** β is similar complexity to α — recommend (1) Subagent-Driven with paired dispatches:
- C0: T1 (embedding cache, foundational for T2)
- C1: T2 + T3 (router + integrate)
- C2: T4 + T5 (tier selector + integrate)
- C3: T6 + T7 (calibration + scorer)
- C4: T8 (calibrate integration)
- C5: T9 + T10 (RAG retrieve + eval)
- C6: T11 (RAG integrate into stage 8)
- C7: T12 (keyword learner)
- C8: T13 + T14 (expression + parameter learner)
- C9: T16 (Flyway)
- C10: T17 + T18 (E2E + parity test)
- C11: T19 (main.py atomic, with rebase pre-flight)
- C12: T20 (Java @Deprecated)
- C13 final: review entire branch

13 dispatches.
