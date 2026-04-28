# 餐饮版产品使用手册 — Handoff to Next Session

**Date**: 2026-04-29 (handoff written end of Apr 28-29 session)
**Branch**: `e2e/v1-framework`
**Status**: brainstorming + spec + plan all complete (R3 APPROVED), implementation **not started**

---

## TL;DR (for next chat — paste this whole file as first message)

You're picking up a brainstorm-then-implement project that completed the **design phase** in the prior session. Your job: **execute the implementation plan**, starting from Task 1.

**Read these 2 files first** (in order):
1. `docs/superpowers/specs/2026-04-28-restaurant-product-manual-design.md` (578 行) — design spec, round 3 APPROVED
2. `docs/superpowers/plans/2026-04-28-restaurant-product-manual.md` (1438 行) — 20-task implementation plan

**Don't redo brainstorming.** Spec + plan are locked. If a Task in the plan looks wrong, push back to user before deviating — the plan went through 3 reviewer rounds and is sign-off ready.

---

## Project context (1 paragraph)

Customer "edc" asked for screen-share training on 财务 PBI 看板 + 智能数据分析 modules saying "我有些指数看不明白". This triggered building a comprehensive 餐饮版产品使用手册 (`restaurant-product-manual.html`, 24 chapters) to ingest into food_kb RAG so the management-end AI chat can answer "怎么用" questions instead of needing manual screen-shares. The manual lives alongside two existing KB docs — `factory-operation-manual.html` (7236 lines, factory context) and `restaurant-metrics-glossary.html` (2331 lines / 161 chunks, indicator dictionary). The new manual is **product-usage focused** (workflow + onboarding + management decision), distinct from the indicator dictionary which is metric definition focused.

---

## What was done this session (8 commits on `e2e/v1-framework`)

| commit | content |
|---|---|
| `2e8eb2972` | feat(web-admin): foodKb.ts + useKbChat composable (Phase A — management end KB chat integration) |
| `59fb41b7d` | refactor: rename `operation-manual-full.html` → `factory-operation-manual.html` (differentiate from restaurant) |
| `4a2a35b87` | docs(spec): 餐饮版产品使用手册 design v1 (Q1-Q7 brainstorm 锁定) |
| `1a8ab3635` | docs(spec): R1 全改 — C1+C2+I1-I4+M1-M3 (9 reviewer issues) |
| `5664f3b36` | docs(spec): R2 全改 — 7 residual + 1 new anchor check |
| `541ae9c24` | docs(plan): 1438-line implementation plan (20 tasks / 7 sessions / 24-35 hr) |

(Concurrent sessions also committed `208689097`, `c6309690d`, `fd638605e`, `a6d49b823`, `252c74033` — those are unrelated 餐饮 Phase B-1 outlier filter work + smartbi OOM fixes. Don't touch.)

---

## Architecture summary (from spec, in case you skim plan first)

- **24 chapters** (5 Tiers): Tier 1 deep (3 ch) + Tier 2-5 skeleton (21 ch). 加盟体系 cut to v2.
- **4 training paths**: A1 (前台/收银) + A2 (中台/财务) + B (店长) + C (老板)
- **6 §B 决策合成 chunks** (cross-chapter: 客单价/食材成本/翻台率/复购流失/扩张/绩效联动)
- **每章双视角**: 入门 (新员工) + 管理 (店长/老板). 同一功能两个角度写.
- **chunk 预算 [4, 12]**: Tier 1 ≤12, Tier 2-5 ≥4 (跟 §4.2 4-section 模板对齐). soft 监控.
- **关键架构变更**: `food_kb` 表加 `subcategory` 列 (factory / restaurant) 防 3 个 manual 同 retrieval pool 互相挤. 这是 Phase 0 的核心.
- **Phased delivery**: Phase 0 (schema + retriever, 1 session) → Phase 1a (Tier 1 深, 1 session) → Phase 1b (Tier 2-5 骨架, 5 batch / 5 session) → Phase 2 (CI lint drift防腐, 3-4 hr 独立).
- **drift防腐**: PR-checklist gate (CODEOWNERS) + 季度 KB drift audit + CI lint (last-verified meta + §B anchor consistency)

---

## How to execute (recommended approach)

**Use `superpowers:subagent-driven-development`** — fresh subagent per task + review between tasks. Reasons:
1. Plan has clear task boundaries with verify steps. Subagent-friendly.
2. Phase 0 (Tasks 1-7) is code work that benefits from independent review.
3. Phase 1a (Tasks 9-11) is content writing per chapter — subagent can focus on one chapter without polluting context.
4. Phase 1b (Tasks 13-17) batch tasks have natural milestone commits.

**Start at Task 1** (DDL migration). Don't skip Phase 0 — Phase 1a/1b will produce wrong RAG behavior without subcategory routing.

**Recommended pacing**:
- This new chat: complete Phase 0 (Tasks 1-7) — ~4-6 hr. Verify counter-test passes.
- Next chat: Phase 1a (Tasks 8-12) — ~5-7 hr. Verify Phase 1a smoke test.
- Following 5 chats: Phase 1b batches (1 batch per chat).
- Last chat: Phase 2 CI infra (Tasks 19-20).

---

## Critical guardrails (DO NOT skip — Apr 28 had 3 incidents)

1. **Concurrent-edit safety** (per `.claude/rules/concurrent-edit-safety.md` rule 5b):
   - **Always commit with `git commit -m "msg" -- file1 file2`** (--only mode) — protects against husky/lint-staged auto-staging concurrent session's files
   - Run `git status --short` BEFORE every commit to verify staging
   - Use `./scripts/safe-commit.sh "msg" file1 file2` if available
   - Concurrent sessions are active right now (5 unrelated commits during Apr 28 session)

2. **Atomic swap ingest** (per `manual_ingester.py:265-289`):
   - Re-ingest is safe (temp_source + transaction). No KB downtime.
   - But Phase 0 DDL must complete BEFORE re-ingesting factory + glossary, or the subcategory column writes will silently fail.

3. **Test env first** (test backend = 8084, prod = 8083):
   - Phase 0 deploy/migrate/ingest on test 8084 → run counter-test → only then prod 8083.
   - Test env 8084 is freely accessible via SSH tunnel from this Windows host.
   - Direct external access blocked by security group; use `ssh root@47.100.235.168 "curl http://localhost:8084/..."`.

4. **Don't re-brainstorm**:
   - Spec went through 3 reviewer rounds. R3 verdict: APPROVE. Reviewer's words: *"Three rounds of revision is enough; further iteration is yak-shaving."*
   - If implementation reveals a real spec gap, document it in a follow-up commit but don't loop back into brainstorming mode.

5. **Don't deploy prod without explicit user approval per phase**:
   - User said "等手册定稿后一次性 re-ingest" — but Phase 0 needs prod re-ingest BEFORE Phase 1a starts (since Phase 0 backfills subcategory on factory + glossary)
   - Confirm with user when Phase 0 test counter-test passes, before running prod deploy
   - Same for Phase 1a (Tier 1 chapters), Phase 1b (final 24 ch), Phase 2 (CI)

---

## Pending tasks list (what's actually open)

From this session:
- `#38` B3 重新 ingest KB (factory + restaurant 都 refresh) — **deferred**, Phase 0 Task 6 will do this. Mark complete after Task 6.

New tasks for next session (use TaskCreate when starting):
- Phase 0 Task 1-7 → 7 tasks
- Phase 1a Task 8-12 → 5 tasks
- Phase 1b Task 13-18 → 6 tasks
- Phase 2 Task 19-20 → 2 tasks

---

## Where to find existing code referenced in plan

| Component | File | Notes |
|---|---|---|
| Document ingester | `backend/python/food_kb/services/document_ingester.py:134` | `ingest_document` signature gets `subcategory` param |
| Manual ingester (HTML chunker) | `backend/python/food_kb/services/manual_ingester.py:22` | `MANUAL_SOURCES` list, atomic swap at line 265-289 |
| Knowledge retriever | `backend/python/food_kb/services/knowledge_retriever.py:88` | `retrieve()` gets `subcategories` param, 4 internal SQL methods need update |
| Manual chat endpoint | `backend/python/food_kb/api/manual_chat.py:387` | Add domain detection here |
| KB chat composable (web-admin) | `web-admin/src/composables/useKbChat.ts` | Already integrated this session, no changes needed for Phase 0-1b |
| KB chat API client (web-admin) | `web-admin/src/api/foodKb.ts` | Same — already integrated |

---

## Memory / pattern recall

- **DeepSeek API config** at `backend/python/smartbi/config.py` (kb_chat_provider/base_url/api_key/model). Hybrid retrieval (vector + BM25 + rerank) verified working this session.
- **Server**: 47.100.235.168 (prod), test backend 8084, prod 8083. systemd: `cretas-python` service.
- **deploy script**: `./scripts/deploy/deploy-smartbi-python.sh --env test|prod`. Default `--env prod` only — explicitly use `--env test` first per pacing recommendation above.
- **DB**: cretas_db on prod. food_knowledge_documents table is the KB store.

---

## When in doubt

- **Read the spec** before deviating from the plan
- **Ask the user** before prod deploys, schema migrations on prod, or re-ingestion on prod
- **Pause and confirm** if a task takes substantially longer than estimated (e.g. Task 9 estimate is single-chapter writing — if you're 2 hr in and not done, surface to user)
- **Don't expand scope** — 加盟体系 is deferred to v2, no other Tier 6, no factory-side updates this round

---

## First user message you should produce (after reading spec + plan)

Something like:

> 已读完 spec + plan. 24 章 / 7 sessions / Phase 0 优先. 准备开始 Task 1 (DDL migration). 这个 task 会改 cretas_db schema (加 subcategory 列), 先在 test DB 跑, 通过后再 prod. 同意吗?

Then wait for user 同意 / 不同意 / 改主意 before running migration.

---

**End of handoff.** Good luck.
