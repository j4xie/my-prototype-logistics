# Phase 2B-β Status Verify Audit

**Date**: 2026-05-09
**Author**: ops chat H (Phase 2B-β AI intent extensions status verification)
**Scope**: Doc-only — verify actual implementation vs Apr 30 spec; recommend status update for canonical naming + MEMORY.md
**Trigger**: PR #163 (`2026-05-09-phase-naming-clarification-audit.md` §4.1) tagged Phase 2B-β as "⚠️ Status verify needed — plan doc shipped, impl status not confirmed". Per Phase 2A 100% close (T6.4 cascade 2026-05-09), proactive verify before T6.5 / Phase 2C kickoff.
**Method**: Trace PR #24 ship → main.py wiring → prod log evidence → 8 Java services @Deprecated marks → unshipped artifacts.

---

## 0. TL;DR

**Phase 2B-α is DONE and live in production**, with `AI_USE_PYTHON_MATCHER=true` and an empty `AI_PYTHON_MATCHER_FACTORIES=` (per #73 §1.4 = all factories). Confirmed by prod env file inspection (47.100.235.168 `.env.prod`) and prod log startup banners (most recent: 2026-05-09 06:08:14 CST).

**Phase 2B-β is ESSENTIALLY DONE and live in production**, shipped in single PR #24 (commit `fb92f4b018`, merged Apr 30 2026). All 5 sub-buckets (C1 SemanticRouter / C2 LlmTierSelector / C4 Calibration+Scoring / C5 RAG / C6 Learning) wired into `backend/python/main.py` lifespan startup. **Two deviations from spec**, both intentional:

| Deviation | Spec | Actual | Reason |
|---|---|---|---|
| `parameter_learner.py` (C6, 1 of 3 learning files) | shipped | **NOT shipped** | F1 fix-pass: `ai_parameter_extraction_rules` is config table Java reads, not a learning sink. β plan was speculative (per main.py:768-770 inline comment). |
| `LlmTierSelector` (C2) | always-on | **dark-shipped** | F6 fix-pass: 1-3s pre-stage-8 latency penalty. Disabled by default via `AI_TIER_SELECTOR_ENABLED=false` (env flag default). Operator opt-in pending latency budget review. |

**Spec drift / low-priority bug found**: `ParameterExtractionLearningService.java:19` Javadoc still claims to be "replaced by Python `parameter_learner.py`" — the Python file does not exist. Javadoc was not updated when F1 fix-pass dropped the learner. Service stays Java for now (Bucket B placeholder); fully removed at Phase 3.

**Recommendation**: **Declare Phase 2B-β DONE**. Add MEMORY.md status entry capturing the 2 intentional deviations + Javadoc mismatch as known low-priority items. No code work required for β closure.

**Verdict**: ✅ **DONE** (with documented deviations) — same disposition as Phase 2B-α.

---

## 1. Phase 2B-α evidence (foundation merge gate)

### 1.1 Code shipped

PR #16 (commit `38b545d0c3`, merged 2026-04-30 02:44 EDT, 65 files +11611/-453):

| Artifact | File(s) |
|---|---|
| Spec | `docs/superpowers/specs/2026-04-29-phase2b-ai-intent-layer-design.md` (879 LOC) |
| Plan | `docs/superpowers/plans/2026-04-29-phase2b-alpha-implementation-plan.md` (5239 LOC, 25 tasks) |
| Handoff | `docs/superpowers/handoffs/2026-04-29-phase2b-alpha-handoff.md` (191 LOC) |
| Java client | `backend/java/cretas-api/src/main/java/com/cretas/aims/client/PythonAiMatcherClient.java` |
| Java cache | `backend/java/cretas-api/src/main/java/com/cretas/aims/cache/IntentResultCache.java` |
| Java config | `backend/java/cretas-api/src/main/java/com/cretas/aims/config/PythonAiClientConfig.java` |
| Java DTO | `backend/java/cretas-api/src/main/java/com/cretas/aims/dto/intent/Python{IntentMatchRequest,IntentMatchResponse}.java` |
| Java service patch | `backend/java/cretas-api/src/main/java/com/cretas/aims/service/impl/AIIntentServiceImpl.java` (+179 lines) |
| Python module root | `backend/python/ai/{__init__,api,cache,config,db,dto,embedding,orchestrator}.py` (8 files) |
| Python matchers | `backend/python/ai/matcher/{semantic,classifier,fusion,llm}.py` (4 files) |
| Tests | `tests/python/ai/test_*.py` (14 files) + `backend/java/.../IntentParityTest.java`, `AIIntentServiceImplPythonIntegrationTest.java`, etc. |
| Goldens | `tests/fixtures/java-intent-golden/{F999-empty.json, intent-tier1-50.jsonl}` |

### 1.2 Backlog cleanup (PR #19, commit `2d8a8a272`, merged Apr 30)

14 files +834/-69. Highlights:
- `backend/python/grpc_stubs/embedding/embedding_pb2{,_grpc}.py` — embedding gRPC stub regenerated locally
- `backend/python/ai/embedding.py` enhanced (~70 line patch)
- `backend/python/ai/matcher/semantic.py` (~27 line patch)
- `tests/python/ai/test_contract.py` +132 LOC (contract test)
- Hand-authored `tests/fixtures/java-intent-golden/F001-inventory-query.json` (Java env unavailable locally)

### 1.3 Production state

```bash
# /www/wwwroot/cretas/.env.prod (verified 2026-05-09)
AI_USE_PYTHON_MATCHER=true
AI_PYTHON_MATCHER_FACTORIES=        # empty = all factories per #73 §1.4
AI_SEMANTIC_THRESHOLD=0.55          # Stage 5 SEMANTIC threshold (active)
```

```
# /www/wwwroot/cretas/python-prod.log (most recent: 2026-05-09 06:08:14 CST)
[startup] AI orchestrator wired (orchestrator + 3 matchers + β: router/calibrator/scorer/rag,
          tier_selector=disabled (set AI_TIER_SELECTOR_ENABLED=true to opt in))
[startup] AI learning cron armed (KeywordLearner+ExpressionLearner, every 300s)
```

Both N=2 workers (leader + follower per `project_2026_05_07_uvicorn_n2_path_x_lite.md`) emit identical startup banners — confirming β wiring is loaded by every worker, not just leader.

### 1.4 Subsequent rollout PRs (also in 2B-α scope)

From git log search (`grep -iE "phase.?2b|2b-α|2b-β|stage.?[45]"`):
- PR #73 — flag flip execution runbook (`docs(phase2b)`)
- PR #75 — ops infrastructure prep (systemd cleanup + Prometheus dashboard config)
- PR #76 — Phase 2B IntentResultCache + PythonAiMatcherClient metrics
- PR #77 — canary whitelist for Phase 2B stage rollout
- Commit `8cfc13fc24` — `fix(phase2b): Python AI matcher prod bugs after Stage 4 flag flip`
- Commits `a9b3a2d031` / `60f6d33487` / `2de85607d2` — Stage 5 SEMANTIC (BGE-base-zh-v1.5 swap + embedding column + BGE prefix)
- Commit `e05013b251` — `fix(phase2b): regenerate gRPC pb2 stubs to match server protobuf 5.29.6 (PR-I)`

All shipped late Apr through early May. Stage 5 SEMANTIC infrastructure is in place. (`AI_SEMANTIC_THRESHOLD=0.55` in current prod overrides the May 5 `1.001` short-circuit-disable from `reference_embedding_model_collapse.md`; that disable was a temporary mitigation while embedding model was being swapped to BGE.)

---

## 2. Phase 2B-β scope per spec

Spec: `docs/superpowers/specs/2026-04-30-phase2b-beta-design.md` (513 LOC, post-audit v2 — scope reduced from v1 15 files / 98h to v2 9 files / 72h after `superpowers:code-reviewer` audit caught 6 critical + 6 important issues).

| Sub-bucket | Files (spec) | Java source replaced |
|---|---|---|
| **C1 SemanticRouter** | `ai/router/semantic_router.py` (1 file) | `SemanticRouterService` |
| **C2 LLM tier selector** | `ai/router/llm_tier_selector.py` (1 file) | (NEW feature, no Java equiv — Java `ComplexityRouter` stays Bucket B for ProcessingMode routing) |
| **C4 Calibration + Scoring** | `ai/scoring/calibration.py` + `ai/scoring/intent_scoring.py` (2 files) | `ConfidenceCalibrationService` + `IntentScoringService` |
| **C5 RAG retrieval + evaluator** | `ai/rag/retrieval.py` + `ai/rag/evaluator.py` (2 files) | `RAGRetrievalService` + `RetrievalEvaluatorService` |
| **C6 ML learning** | `ai/learning/keyword_learner.py` + `ai/learning/expression_learner.py` + `ai/learning/parameter_learner.py` (3 files) | `KeywordLearningService` + `ExpressionLearningService` + `ParameterExtractionLearningService` |
| **α modification** | `ai/embedding.py` get_embedding_cached + contextvars cache (1 patch) | — |

**Total spec'd: 9 new files + 1 α modification.**

Spec also defines:
- W7 Cleanup wave: `@Deprecated` + drop Spring `@Service` injection on the 8 Java legacy services (no real deletion until Phase 3 — per R-CR4 from audit).
- Migration: `V20260501_15__phase2b_beta_pgvector_columns.sql`.
- Tests: 10 new pytest files in `tests/python/ai/`.

---

## 3. β actual code state (origin/main `0452e52948`)

### 3.1 Python modules — 8 of 9 shipped

```
backend/python/ai/router/
  ├── __init__.py      (5 LOC)
  ├── semantic_router.py    (124 LOC)  ✅ C1
  └── llm_tier_selector.py  (76 LOC)   ✅ C2 (dark-shipped behind env flag)

backend/python/ai/scoring/
  ├── __init__.py      (1 LOC)
  ├── calibration.py        (30 LOC)   ✅ C4
  └── intent_scoring.py     (34 LOC)   ✅ C4

backend/python/ai/rag/
  ├── __init__.py      (1 LOC)
  ├── retrieval.py          (98 LOC)   ✅ C5
  └── evaluator.py          (38 LOC)   ✅ C5

backend/python/ai/learning/
  ├── __init__.py      (1 LOC)
  ├── keyword_learner.py    (187 LOC)  ✅ C6
  ├── expression_learner.py (90 LOC)   ✅ C6
  └── parameter_learner.py  ❌ NOT SHIPPED (intentional drop per F1 fix-pass)

backend/python/ai/embedding.py  (172 LOC, +75 from α — get_embedding_cached + contextvars cache present)
backend/python/ai/orchestrator.py (361 LOC, +123 from α — β sub-modules wired)
```

**Confirmed by `git log -- 'backend/python/ai/{router,scoring,rag,learning}/*'`**: only ONE commit (`fb92f4b018` = PR #24) ever touched these subdirectories. No follow-up commits adding `parameter_learner.py`.

### 3.2 main.py wiring (lines 643-794, lifespan startup)

**Phase 2B-α block** (lines 649-734): orchestrator construction + ai_intent_configs snapshot loader + 5min refresh cron — unchanged from α.

**Phase 2B-β block** (lines 655-705, 736-790):

```python
# β sub-module imports — all present
from ai.router.semantic_router import SemanticRouter         # ✅
from ai.router.llm_tier_selector import LlmTierSelector      # ✅ (gated)
from ai.scoring.calibration import Calibrator                # ✅
from ai.scoring.intent_scoring import IntentScorer           # ✅
from ai.rag.retrieval import RAGRetriever                    # ✅
from ai.rag.evaluator import RAGEvaluator                    # ✅
# (no ParameterLearner import — see line 768 comment)
from ai.learning.keyword_learner import KeywordLearner       # ✅
from ai.learning.expression_learner import ExpressionLearner # ✅

# β construction
_tier_selector_enabled = os.environ.get("AI_TIER_SELECTOR_ENABLED", "false").lower() == "true"
_ai_sem_router = SemanticRouter()
_ai_tier_selector = LlmTierSelector() if _tier_selector_enabled else None  # F6 fix-pass: dark-shipped
_ai_calibrator = Calibrator(coefs={})  # cold-start: empty coefs → direct passthrough per R-IM2
_ai_scorer = IntentScorer()
_ai_rag_retriever = RAGRetriever(ai_pg_pool)
_ai_rag_evaluator = RAGEvaluator()

app.state.ai_orchestrator = Orchestrator(
    semantic_matcher=SemanticMatcher(ai_pg_pool),
    classifier_matcher=ClassifierMatcher(),
    llm_matcher=LlmMatcher(),
    semantic_router=_ai_sem_router,
    llm_tier_selector=_ai_tier_selector,
    calibrator=_ai_calibrator,
    scorer=_ai_scorer,
    rag_retriever=_ai_rag_retriever,
    rag_evaluator=_ai_rag_evaluator,
)

# β C6 learning cron — 5min cadence, both learners
async def _ai_learning_cron():
    # 5min cadence per spec §C6 — runs both learners each iteration.
    # ParameterLearner removed (F1 fix-pass): no feedback data source —
    # `ai_parameter_extraction_rules` is a config table Java reads, not
    # a learning sink. β plan was speculative.
    while not app.state.ai_learning_stop_event.is_set():
        await _kw_learner.run_once(min_confidence=0.9)
        await _expr_learner.run_once(min_confidence=0.95)
        ...
```

The F1 fix-pass note at lines 768-770 is the canonical explanation for the dropped `parameter_learner.py`.

### 3.3 Orchestrator wiring (lines 50-248)

`Orchestrator.__init__` signature accepts all β sub-modules as **optional** (default `None`). Without router/rag/etc, behaves identically to α — graceful degradation.

β-specific code paths (`grep -nE "router|rag|learning|scoring|calibration|tier_selector"` in `orchestrator.py`):
- Line 86-114: SemanticRouter pre-stage routing (DIRECT_EXECUTE / NEED_RERANKING / NEED_FULL_LLM short-circuit)
- Line 144 / 174 / 231: `_apply_calibration` invoked at semantic / fusion / llm candidate stages
- Line 189-193: LLM tier selector invocation (gated behind `if self.llm_tier_selector is not None`)
- Line 197-217: RAG retrieval + evaluator before LLM stage 8

All wired correctly. Per spec §3.2 β v2 flow.

### 3.4 Java legacy services — all 8 @Deprecated (W7 cleanup wave)

```bash
$ grep -A1 "@deprecated Phase 2B-β" backend/java/cretas-api/src/main/java/com/cretas/aims/service/{ConfidenceCalibration,Expression,Keyword,ParameterExtraction,RAGRetrieval,RetrievalEvaluator,SemanticRouter}Service.java backend/java/cretas-api/src/main/java/com/cretas/aims/service/intent/IntentScoringService.java
```

All 8 interfaces have the canonical Javadoc:

> ```
> @deprecated Phase 2B-β: replaced by Python {@code backend/python/ai/<module>/<file>.py}.
> This interface still ships in Bucket B for now (no functional change),
> but no new callers should be added. Phase 3 will remove this entirely.
> ```

**Spec drift caught**: `ParameterExtractionLearningService.java:19` points to `backend/python/ai/learning/parameter_learner.py` — file does not exist. Javadoc not updated when F1 fix-pass dropped the learner. The service interface is itself dead-code-by-deprecation; full removal happens at Phase 3 (= T6.5 / cleanup successor). Low priority.

### 3.5 Tests — all spec'd β tests present

```
tests/python/ai/test_router_semantic.py        ✅ (135 LOC)
tests/python/ai/test_router_llm_tier.py        ✅ (56 LOC)
tests/python/ai/test_scoring_calibration.py    ✅ (33 LOC)
tests/python/ai/test_scoring_intent.py         ✅ (42 LOC)
tests/python/ai/test_rag_retrieval.py          ✅ (83 LOC)
tests/python/ai/test_rag_evaluator.py          ✅ (42 LOC)
tests/python/ai/test_learning_keyword.py       ✅ (169 LOC)
tests/python/ai/test_learning_expression.py    ✅ (160 LOC)
tests/python/ai/test_embedding_cached.py       ✅ (75 LOC)
tests/python/ai/test_orchestrator_beta.py      ✅ (147 LOC, end-to-end)
```

`tests/python/ai/test_learning_parameter.py` — **NOT present** (consistent with parameter_learner.py drop).

PR #24 commit log mentions "Tests: 121/121 pytest pass (was 120, +1 regression)" — historical run at merge time. Not re-verified in this audit.

### 3.6 Migration

PR #24 stat shows `V20260501_15__phase2b_beta_pgvector_columns.sql` (40 LOC) — present at the canonical path per spec §9.2.

### 3.7 Production runtime evidence

Prod log `/www/wwwroot/cretas/python-prod.log` startup banner (most recent 4 entries, 2026-05-08 09:10 → 2026-05-09 06:08, both worker PIDs):

```
[startup] AI orchestrator wired (orchestrator + 3 matchers + β: router/calibrator/scorer/rag,
          tier_selector=disabled (set AI_TIER_SELECTOR_ENABLED=true to opt in))
[startup] AI learning cron armed (KeywordLearner+ExpressionLearner, every 300s)
```

Both leader and follower workers (Path X-lite N=2 multi-worker per `project_2026_05_07_uvicorn_n2_path_x_lite.md`) successfully wire β on every restart.

---

## 4. Gap analysis (β actual vs spec)

| Spec sub-bucket | Spec scope | Actual | Verdict |
|---|---|---|---|
| C1 SemanticRouter | 1 file, 3-tier + OOD flag | `semantic_router.py` 124 LOC, wired always-on | ✅ DONE |
| C2 LlmTierSelector | 1 file, NEW feature, optional | `llm_tier_selector.py` 76 LOC, **dark-shipped behind `AI_TIER_SELECTOR_ENABLED`** (default off) | ⚠️ DONE BUT DARK — F6 fix-pass: 1-3s pre-stage-8 latency penalty discovered post-spec, operator opt-in pending latency review |
| C4 Calibration | 1 file, cold-start passthrough | `calibration.py` 30 LOC, `Calibrator(coefs={})` empty → passthrough per R-IM2 | ✅ DONE |
| C4 IntentScoring | 1 file, comprehensive scoring | `intent_scoring.py` 34 LOC, default weights (0.5, 0.2, 0.2, 0.1) per spec §4.3 | ✅ DONE |
| C5 RAG Retrieval | 1 file, read existing tables, factory_id isolation | `retrieval.py` 98 LOC, reads `intent_match_records` + `learned_expressions` per spec §4.4 | ✅ DONE |
| C5 RAG Evaluator | 1 file, CRAG heuristic 0.85/0.7 | `evaluator.py` 38 LOC | ✅ DONE |
| C6 KeywordLearner | 1 file, listens to `training_samples` (5min cron) | `keyword_learner.py` 187 LOC, F6 fix-pass per-tenant scope | ✅ DONE |
| C6 ExpressionLearner | 1 file, expression template learning | `expression_learner.py` 90 LOC, learned_expressions write | ✅ DONE |
| C6 ParameterLearner | 1 file, parameter rule learning, writes `parameter_extraction_rules` | **NOT shipped** — F1 fix-pass: no feedback data source, `ai_parameter_extraction_rules` is config table Java reads | ❌ INTENTIONALLY DROPPED |
| α modification: get_embedding_cached | contextvars per-request cache | `embedding.py` 172 LOC (was 97) — get_embedding_cached present, request-scoped via contextvars | ✅ DONE |
| W7 Java @Deprecated | 8 services marked, no Spring injection drop yet | All 8 @Deprecated with canonical Javadoc + module pointer | ✅ DONE |
| Migration | V20260501_15 | Present | ✅ DONE |
| Tests | 10 new pytest files | All 10 present | ✅ DONE |

**Score**: 11 of 13 spec line items fully shipped. 1 dark-shipped (C2 LlmTierSelector — operator opt-in). 1 intentionally dropped (C6 parameter_learner.py — F1 fix-pass, no data source).

**Net assessment**: Phase 2B-β is **complete in the spirit of the spec**. The 2 deviations are explicitly documented in the shipping commit (PR #24 commit message bodies for "F6" and "F1" fix-passes), inline code comments (`main.py:768-770`, `main.py:679-681`), and represent post-impl learnings that supersede the spec.

---

## 5. Spec drift / latent issues found

### 5.1 ParameterExtractionLearningService.java Javadoc points to nonexistent file (LOW)

```java
// backend/java/cretas-api/src/main/java/com/cretas/aims/service/ParameterExtractionLearningService.java:19
/**
 * @deprecated Phase 2B-β: replaced by Python {@code backend/python/ai/learning/parameter_learner.py}.
 * This interface still ships in Bucket B for now (no functional change),
 * but no new callers should be added. Phase 3 will remove this entirely.
 */
@Deprecated
public interface ParameterExtractionLearningService {
```

`backend/python/ai/learning/parameter_learner.py` does not exist. Javadoc was not updated when F1 fix-pass dropped the planned Python replacement.

**Severity**: LOW. The Java service interface is itself dead-code-by-deprecation. Phase 3 (= T6.5 / cleanup successor wave) will fully remove it. No functional impact today (Java callers, if any, still resolve the Java implementation; no Python redirection).

**Recommended action**: Either (a) update Javadoc to `@deprecated Phase 2B-β: parameter learning was deemed speculative and dropped (F1 fix-pass) — no Python replacement; full removal at Phase 3` or (b) leave as-is and rely on Phase 3 deletion. Not blocking.

### 5.2 No follow-up PRs after PR #24 for β subdirs

`git log --all -- 'backend/python/ai/{router,scoring,rag,learning}/*'` returns ONLY commit `fb92f4b018` (PR #24). No subsequent bug fixes / patches. Two interpretations:

(a) β code is bug-free in production — supported by absence of error-pattern hits in `python-prod.log` for AI orchestrator block. Plausible.

(b) β features don't see enough real traffic to surface bugs — supported by current `AI_USE_PYTHON_MATCHER=true` + tier_selector disabled + cold-start empty calibrator. Plausible.

Both can be true. Audit scope does not extend to traffic-volume / signal analysis. **No action required**.

### 5.3 AI_SEMANTIC_THRESHOLD diverges from May 5 memory note

MEMORY.md `reference_embedding_model_collapse.md` recommends `AI_SEMANTIC_THRESHOLD=1.001` to disable Stage 5 SEMANTIC short-circuit due to the gte-finetuned model collapse (cos_sim ≈ 0.999997 between unrelated phrases).

Current prod `.env.prod` has `AI_SEMANTIC_THRESHOLD=0.55` — Stage 5 SEMANTIC is **active**, not disabled.

This is consistent with the BGE-base-zh-v1.5 model swap (commits `a9b3a2d031` / `60f6d33487` / `2de85607d2`) which replaced the broken gte-finetuned model. The May 5 memory note was a temporary mitigation that is no longer needed. **Memory entry should be updated** to note "superseded by BGE swap; AI_SEMANTIC_THRESHOLD=0.55 now in prod".

Not a β issue per se, but adjacent. **Optional follow-up for memory hygiene**.

---

## 6. Recommendation

### 6.1 Status declaration

**Declare Phase 2B-β DONE**. Same disposition as Phase 2B-α. No additional code work required.

The 2 spec deviations (parameter_learner drop, LlmTierSelector dark-ship) are intentional engineering decisions that supersede the spec, and are documented in:
- PR #24 commit message (F1 / F6 fix-pass sections)
- `backend/python/main.py` inline comments (lines 679-681 for F6, lines 768-770 for F1)
- This audit doc §3.2, §3.3, §4

### 6.2 Update PR #163 naming-clarification audit (optional)

If a v2 of `2026-05-09-phase-naming-clarification-audit.md` ships, update §4.1 row for Phase 2B-β:

| BEFORE | AFTER |
|---|---|
| `⚠️ **Status verify needed** — plan doc shipped, impl status not confirmed in this audit` | `✅ **DONE** — PR #24 (`fb92f4b018`), live in prod since Apr 30. 2 intentional deviations: ParameterLearner dropped (F1 fix-pass), LlmTierSelector dark-shipped (F6 fix-pass). See `2026-05-09-phase-2b-beta-status-verify.md`.` |

Not blocking — original audit's `⚠️ Status verify needed` flag is honored by this audit's existence.

### 6.3 MEMORY.md status entry recommendation

Add or replace the implicit "Phase 2B-β AI intent extensions (status verify) pending" reference (which the marching order claimed was at top of MEMORY.md but was not present in current 272-line index) with a concrete entry:

```markdown
## May 9 2026 — Phase 2B-β AI intent extensions VERIFIED DONE (PR #24 already prod since Apr 30)
- [Phase 2B-β status verify](project_2026_05_09_phase_2b_beta_verified.md) — All 5 sub-buckets (C1 SemanticRouter / C2 LlmTierSelector dark-shipped / C4 Calibration+Scoring / C5 RAG / C6 Learning 2-of-3) wired into main.py lifespan, prod log confirms both N=2 workers initialize β on every restart. 2 intentional spec deviations: parameter_learner.py dropped (F1 fix-pass — `ai_parameter_extraction_rules` is config table not learning sink) + LlmTierSelector dark-shipped (F6 fix-pass — 1-3s pre-stage-8 latency, env-flag opt-in). 1 latent low-pri Javadoc drift: ParameterExtractionLearningService.java points to nonexistent `parameter_learner.py`. No follow-up PRs needed; β closure clean.
```

### 6.4 Optional Phase 3 backlog item (NOT blocking)

When Phase 3 (= T6.5 / cleanup successor) reaches the AI services deletion wave (W8), include `ParameterExtractionLearningService.java` in the deletion list and verify no callers exist (interface should already have zero callers since `@Deprecated` was added Apr 30).

If LlmTierSelector remains dark-shipped indefinitely (operator never opts in), Phase 3 should also revisit whether C2 itself was ROI-justified — the spec §4.2 calculated 24% of total traffic benefits at -0.0098¥/query saving, but that calculation depends on real stage-8 trigger rate that may differ from the assumed 30%.

---

## 7. Methodology

This audit relied on:
1. **Git ground truth** — `git log --all -- <path>` for shipping evidence; `git show --stat <SHA>` for PR scope verification
2. **File system inspection** — direct `ls` / `wc -l` / `grep` of origin/main + production server `47.100.235.168:/www/wwwroot/cretas/code/`
3. **Production env file** — SSH read of `/www/wwwroot/cretas/.env.prod`
4. **Production log** — SSH read of `/www/wwwroot/cretas/python-prod.log` startup banners (most recent restart 2026-05-09 06:08:14)
5. **Inline code comments** — explicit `# F6 fix-pass`, `# F1 fix-pass` markers in `main.py` are the canonical truth for spec deviations (predates this audit)

**Did NOT do** (out of scope):
- Re-run pytest test suite — relies on PR #24 commit message claim of 121/121 pass
- Trace real production AI request paths via log analysis
- Verify embedding model BGE-base-zh-v1.5 actually deployed (loaded via gRPC at `:9090`)
- Compare β vs α latency / cost metrics (Prometheus dashboard exists per PR #75 but not queried here)

---

## 8. Status

This is a doc-only audit. Action items:

- [ ] Steve / organizer reviews and accepts "Phase 2B-β DONE" declaration
- [ ] Optional: add MEMORY.md entry per §6.3
- [ ] Optional (low pri): fix `ParameterExtractionLearningService.java:19` Javadoc per §5.1
- [ ] Optional (memory hygiene): update `reference_embedding_model_collapse.md` per §5.3
- [ ] Optional (Phase 3 prep): add `ParameterExtractionLearningService.java` + revisit `LlmTierSelector` ROI to Phase 3 / T6.5 W8 deletion checklist

**No blocking work**. β closure is clean.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
