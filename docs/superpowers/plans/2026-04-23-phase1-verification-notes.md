# Phase 1 Verification Notes (Apr 23 2026)

Subagent-Driven Development execution of `2026-04-23-phase1-llm-fallback-logging.md`.

## Commits shipped to prod (all on `e2e/v1-framework`, pushed + deployed)

```
9b45b1c2d  Task 2 — migration smart_bi_llm_fallback_log
96ccbd241  Task 3 — llm_fallback_logger service + 4 unit tests
2d99ee51e  Task 4 — wire logger into chat.py LLM fallback
b940c10b5  Task 4 fix — anchor bg task via _spawn_bg + WARNING swallow level
fc5ed20fd  Task 5 — admin endpoints + feedback API
51c415b0d  Task 5 fix — factory-scope feedback writes (cross-tenant防护)
38003341d  Task 6 — FE 👍/👎 buttons on AIQuery.vue
```

Phase 0 (pgvector install) was executed directly without commits — infra only.

## End-to-end smoke test (prod admin.cretaceousfuture.com, qhj_prod = RES_3101_009)

### Query 1: 👍 flow
- Fired `"为什么外卖订单下降了?"` via `/api/chat/general-analysis-stream`
- HARD modifier `为什么` → LLM fallback path
- SSE `done` event returned `log_id = 1`, `answer_chars = 565`
- Total wall: 13343 ms (13.3s LLM)
- DB row 1 verified: factory_id=RES_3101_009, upload_id=4169, `query_embedding IS NOT NULL`
- `POST /api/smartbi/admin/fallback-log/1/feedback` with `{value:1}` → 200 OK
- DB re-query: `user_feedback = 1`, `feedback_comment = NULL` ✓

### Query 2: 👎 + comment flow
- Fired `"哪些地方还能优化?"` → `log_id = 2`, 12952 ms
- `POST /api/smartbi/admin/fallback-log/2/feedback` with `{value:-1, comment:"数字不对"}` → 200 OK
- DB re-query: `user_feedback = -1`, `feedback_comment = "数字不对"` ✓

### RAG preview (Phase 3 proof-of-concept)
Fired `GET /api/smartbi/admin/fallback-log/by-similarity?query=外卖销量为什么少&limit=3`.

| Stored query | Similarity | Fit |
|---|---|---|
| 为什么外卖订单下降了? (row 1) | **0.88** | correct — semantic match despite different wording |
| 哪些地方还能优化? (row 2) | 0.48 | correct — unrelated, lower score |

"外卖销量为什么少" shares only `"外卖"` + `"为什么"` substrings with row 1's query, yet cosine similarity is 0.88. This is genuine semantic embedding similarity via DashScope text-embedding-v3 + pgvector HNSW, NOT SQL keyword match. Phase 3 RAG retrieval is confirmed feasible on this infrastructure.

## Data collection state (as of Apr 23 2026 10:55 CST)

- Baseline before seeding: 0 rows
- After smoke test: 2 rows (1 👍, 1 👎 + comment)
- Embedding coverage: 2/2 = 100%
- Feedback coverage: 2/2 = 100%

## Go/No-Go criteria to Phase 2 (re-check in 2-4 weeks)

Will evaluate:
- [ ] Volume: ≥500 rows in last 14 days
- [ ] Embedding coverage: ≥98%
- [ ] Feedback rate: ≥20%
- [ ] Clusterability: ≥3 clusters with ≥5 similar queries via `/by-similarity`
- [ ] No chat latency regression

When all 5 satisfied → write Phase 2 detailed plan (DBSCAN + template draft generation).

## Known deferred items

- Live smoke of chat.py logger at Task 4 review time was deferred to Task 7 (done here — both queries logged correctly)
- Grafana dashboard from roadmap sketch — not built; `/admin/fallback-log/stats` endpoint serves same purpose, can wrap in a dashboard later
- FE sendFeedback lacks in-flight re-entrance guard (reviewer Nit #1 on Task 6) — accepted as deferred; backend is idempotent so double-click produces correct final state
- `total_wall_ms == llm_wall_ms` (both are the same number on Task 4) — deferred observability refinement, can split when we instrument phases

## Rollback

If Phase 1 causes regressions:
1. Revert FE: atomic-swap `/www/wwwroot/web-admin.bak.<ts>` back on 139.
2. Revert Python: `git revert 38003341d 51c415b0d fc5ed20fd b940c10b5 2d99ee51e 96ccbd241` and redeploy. Keep migration (additive, no-op if unused).
3. DB: `DROP TABLE smart_bi_llm_fallback_log;` — destructive but only affects the new observability log.

## Phase 2 trigger

When the 5 Go/No-Go criteria pass, write `docs/superpowers/plans/2026-05-<date>-phase2-pattern-clustering.md` with the DBSCAN + LLM-assisted template generator design. That plan inherits the infrastructure built here — no new DB work needed (table already has indexed embeddings).
