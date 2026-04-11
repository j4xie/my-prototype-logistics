# Canvas V3 Round 6 — Robustness & Edge Cases Audit

**Date**: 2026-04-11
**Scope**: Post-Round-5 production robustness audit. Find and fix P0 issues that Rounds 1-5 missed.
**Mode**: Hybrid (audit → P0 fix immediately → P1/P2 follow-up tickets)
**Hard timeout**: 90 min total, 30 min per subagent

## Background

Canvas V3 has been through 5 audit rounds. R4 closed 32 functional gaps. R5 closed 10 production readiness items (SEC-1/2/3/4/6/10, PERF-1/2/3, OBS-1/2, DATA-1) and is deployed to prod via blue-green (`cretas-backend.service` on port 10010, MD5 `99da9182ee9b1292b286333db6d0b082`).

Three red-team critics reviewed the initial Round 6 plan and found:

- **Critic A**: Original 5 angles missed a whole class of attack surface (AggregateFormulaExecutor SQL injection, ValidationRuleEvaluator auto-hydration SELECT *, publishConfig missing event publication). A new Angle 6 is required.
- **Critic B**: Original 7 E2E scenarios covered ~40% of the stress surface. Every editor button has no submit guard, not just save. 9 more scenarios added (total 16), split into 2 execution tracks.
- **Critic C**: Main session doing angle 1+2+E2E orchestration is too heavy. Subagent open-ended tasks risk hallucination (memory `feedback_subagent_code_search_unreliable.md`). E2E was going to run against prod and pollute `config_change_log`.

This spec is the revised plan after critic synthesis.

## Scope — 6 Audit Angles

### Angle 1: Concurrency & Transactions (main session)
- `publishConfig` race between two concurrent admins
- `DDLExecutor` REQUIRES_NEW (R5 PERF-2) grabbing a 2nd Hikari connection — pool exhaustion risk
- `DynamicFieldService` cache vs DDL write race
- Optimistic locking via `row_version` actually fires under concurrent save
- Hikari pool size vs expected concurrency

### Angle 2: Data Integrity / Lifecycle (subagent A with checklist)
- **A3**: `publishConfig` doesn't `publishEvent` → `DynamicScheduler` doesn't reload → stale cron
- **B6**: `exportConfig` only dumps modules + dynamic fields, misses validation rules / scheduler / trigger chains / default values / formulas
- **B7**: `rollbackConfig` only rolls back module config + dynamic field, misses validation rules / scheduler / formulas
- **B2**: `applyTemplate` long transaction (1000-row loop in single TX)
- Silent drift: `TriggerChainExecutor.HANDLED_EVENTS` hardcoded — unknown event types are silently dropped

### Angle 3: Cross-tenant Isolation Depth (subagent B with suspicious-point checklist)
- `factory_id IS NULL` global rules (V18 seed) — do they leak across factories under misquery?
- `SpelConditionEvaluator` shared cache — does it leak variables between evaluations?
- Global validation rule `operator_id` attribution
- URL factoryId guard in `JwtAuthInterceptor` — are there any endpoints that bypass the guard because they don't match `FACTORY_ID_PATTERN`?

### Angle 4: Frontend Contract Alignment (subagent C with file pair list)
- R5 PERF-3 changed `getVersions` return type from `List<FactoryConfiguration>` → `Map{content, totalElements, ...}`. Did the Vue web-admin version history page get updated?
- R5 PERF-3 changed `getDDLLog` same way. DDL log page?
- R5 SEC-1 introduced a new 403 JSON shape (`{success:false, message:..., code:"FORBIDDEN"}`). Does the axios interceptor handle it differently from JWT 401?
- `@RequireRole` throws before controllers run — does the frontend show "permission denied" toast or a white screen?

### Angle 5: Round 5 Test Coverage (subagent D with specific test file list)
- Which of the 10 R5 fixes have unit tests? Integration tests? E2E tests?
- Specifically target: SEC-1 (@RequireRole enforcement), SEC-2 (SpEL restriction), OBS-1 (audit log persistence), PERF-2 (REQUIRES_NEW semantics).
- Reference files: `tests/canvas-v3/*.mjs`, `src/test/java/**/*.java`, `src/test/java/**/canvas*.java`

### Angle 6: Config Engine SEC Attack Surface (main session — NEW)
- **A1**: `AggregateFormulaExecutor` `execute()` / `executeRatio()` — formula regex captures `sourceTable/groupField/valueField/numField/denField` and string-concats into SQL. No whitelist. P0.
- **A2**: `ValidationRuleEvaluator` `autoHydrate` does `"SELECT * FROM " + tableName` where `tableName` comes from `ddlExecutor.resolveTable(moduleCode)`. Custom modules via `createCustomModule` register arbitrary table names. P1.
- **A6**: `importConfig` accepts `label` / `config` JSONB without size or content validation. Malicious bundle could OOM the server. P2.
- **A4**: `DynamicSchedulerService` hardcoded pool size=2 with unbounded queue — DoS surface when many factories have schedulers.

## E2E Stress Scenarios — 16 Total, Split Into 2 Tracks

All scenarios use **test env 10011 + `cretas_db` + dedicated test factory `F_TEST_R6`**. Each scenario runs in a **×20 loop** to surface race conditions. Playwright uses `chromium.launch({headless:true})` (per `feedback_e2e_skill_enforcement.md`). Cleanup via `afterAll`: delete F_TEST_R6 data from `config_change_log`, `factory_configurations`, `factory_module_configs`, `canvas_dynamic_field`.

### Track B1: Canvas Editor Stress (Element Plus web-admin)

| # | Scenario | Target | Pass Criteria |
|---|---|---|---|
| 1 | Double-click every button (save / submit-review / approve / reject / publish-now / apply-template) within 200ms | System-wide submit guard | Only 1 backend call per button-click pair |
| 4 | 2 browser contexts, both edit F_TEST_R6 canvas, both save | Optimistic lock | Second save gets 409 or diff merge |
| 5 | `applyTemplate('FOOD_PROCESSING')` → `applyTemplate('BAKERY')` → `applyTemplate('FOOD_PROCESSING')` rapid-fire | No in-flight protection | No orphan dynamic fields; final state = FOOD_PROCESSING cleanly |
| 6 | SubTableEditor add 20 rows + rapid delete 10 | Reactive race | No ghost rows; DB row count matches UI |
| 8 | Edit field, `page.close()` without save, reopen | `beforeunload` warning | User sees confirm dialog or drafts persist |
| 10 | `AIChatPanel` Ctrl+Enter × 5 rapid | Loading lock bypass | Only 1 `/ai/chat` POST, not 5 |
| 13 | `FormCanvas` vuedraggable drag-reorder × 20 reversed | `setDirty()` semantic | `dirtyCount == 20` not 40 |
| 14 | Module A → B → A → B × 10 | Global singleton leak (`useCanvasEditor`) | `dirtyCount` resets per module, no cross-module pollution |
| 16 | `ReferenceSelector` type 4 different keywords 50ms apart | Stale response override | Final dropdown options match last keyword |

### Track B2: SchemaFormRenderer Consumer Stress (RN + web consumer)

| # | Scenario | Target | Pass Criteria |
|---|---|---|---|
| 2 | `submit-review` → `reject` × 5 on same DRAFT | State machine race | `config_change_log` has exactly 10 rows per loop, no duplicates |
| 3 | Edit canvas → browser back → re-enter | State persistence | User sees their in-flight edits (or clear discard prompt) |
| 7 | Playwright stalls `/publish-now`, user clicks refresh | Mid-flight network break | No double-publish; status = APPROVED still |
| 9 | Click save, then `page.goBack()` | XHR cancel | Backend state matches UI state (committed or not) |
| 11 | Evict JWT, fire 5 parallel requests | Token refresh queue | Only 1 refresh POST, 5 retries with new token |
| 12 | Paste 100KB into a string field | Frontend guard | Either maxlength cap or graceful 400 + rollback |
| 15 | RN app switch factoryId mid-form × 5 | useEffect dep race | `values` always corresponds to current factoryId |

## Execution Architecture

```
Main Session (me):
  ├── Generate angle 3 "suspicious point checklist" (5 min)
  ├── Setup F_TEST_R6 test factory (5 min)
  ├── Launch 4 subagents in parallel (background)
  ├── Launch E2E Track B1 + B2 in parallel (background bash)
  ├── While subagents run:
  │     ├── Angle 1 concurrency audit (main session manual trace)
  │     └── Angle 6 config engine SEC audit (main session manual trace)
  ├── Collect all results (90 min hard gate)
  ├── Verify each P0 finding via Grep (hallucination defense)
  ├── Write round6-findings.md + round6-findings.json
  ├── P0 fix + commit + deploy
  └── P1/P2 follow-up ticket

Subagents (Opus):
  - A: Angle 2 Data Integrity (verified checklist)
  - B: Angle 3 Cross-tenant (suspicious-point checklist)
  - C: Angle 4 Contract Alignment (file-pair diff list)
  - D: Angle 5 Test Coverage (specific test file list)
```

## Circuit Breakers

1. **F_TEST_R6 isolation**: E2E only touches this factory. `afterAll` SQL cleanup.
2. **`verified_by` field mandatory**: Every finding must say how it was verified (`manual_grep` / `playwright_run` / `db_query` / `code_trace`). Subagent outputs without this field are rejected.
3. **Main session P0 re-verification**: For every P0 finding claimed by a subagent, main session runs independent Grep/Read before including it in the fix list (R5 hallucination lesson).
4. **Explicit P0 → P1 downgrade**: No silent reclassification. Any P0 that we decide not to fix this session must have a written reason in the follow-up ticket.
5. **90 min hard total timeout**. **30 min subagent kill** timeout.
6. **Dual output files**: `round6-findings.md` (human) + `round6-findings.json` (machine-readable for commit generation). JSON schema: `{id, severity, angle, file, line, evidence, repro, impact, fix, verified_by}`.

## Output Files

- `.claude/agent-team-outputs/2026-04-11_round6-findings.md` — human-readable report
- `.claude/agent-team-outputs/2026-04-11_round6-findings.json` — machine-readable finding list
- Any P0 fix commits
- Follow-up tickets file for P1/P2 (plain MD)

## Deliberate Deviations from Brainstorming Skill

The brainstorming skill mandates invoking `writing-plans` as the terminal state. For this audit (not a feature plan), writing-plans is the wrong skill — audit execution is iterative (find → verify → fix → repeat), not TDD-sequential. We proceed directly to execution after this spec is written.

## Success Criteria

- All 6 angles have a structured finding list (P0/P1/P2 with evidence)
- All P0 findings have been manually verified by main session (no hallucinations)
- All P0 findings are either fixed-and-deployed this session OR explicitly deferred with written reason
- Both E2E tracks have completed (or explicit kill reason if timed out)
- `round6-findings.json` is parseable and has every finding with all required fields
