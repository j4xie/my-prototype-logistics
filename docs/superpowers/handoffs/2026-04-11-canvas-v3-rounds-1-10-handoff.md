# Canvas V3 Audit Rounds 1-10 — Session Handoff Manual

**Document date**: 2026-04-11
**Session end**: After Round 9 deployed to prod
**Purpose**: Continuity document so future sessions (R10+) don't re-learn the 10-round history

---

## The 30-Second Summary

Canvas V3 is a dynamic configuration system in the Cretas Food Traceability platform.
The system has been through 9 completed audit rounds and 1 in-progress (R10 planned).

**What Canvas V3 is supposed to do**: Let factory admins configure everything — dynamic fields, validation rules, formulas, trigger chains, scheduled tasks, workflows, permissions — via a UI (`web-admin/src/views/platform/canvas-editor/`), stored in `factory_*` tables, executed by Java Service layer.

**The brutal truth after 9 rounds**: UI ~50% done, Config storage ~100% done, **execution layer only ~22% honors the config**. Customer can configure things that backend silently ignores. This is a "Canvas facade" structural problem discovered in R8, partially addressed by R9's template pattern.

**The goal**: "Canvas operates everything" — 80% execution fidelity. Realistic timeline: **multi-quarter program**, ~13 more sessions to finish.

---

## The 10-Round Timeline

### Rounds 1-3 (early, before this session)
Initial functional builds. CRUD, entities, basic flows. Not covered in this handoff — see earlier memory files.

### Round 4 — Functional Completeness (before this session)
**Scope**: 32 functional gaps fixed — CRUD, rollback, E2E tests, templates, validation rules, trigger chains
**Key memory**: `project_canvas_v3_complete.md`
**Status**: Deployed before this session started
**Key commit**: `2f3b199c9 feat(canvas-v3): Round 4 batch 4`

### Round 5 — Production Readiness (this session)
**Commit**: `bfa889bc3 fix(canvas-v3): Round 5 Production Readiness`
**Scope**: 10 items
- **SEC-1**: Custom `@RequireRole` annotation — Spring Security was silently excluded, so R4's `@PreAuthorize` annotations were no-ops. Built a custom interceptor reading the `role` attribute set by JwtAuthInterceptor:106.
- **SEC-2**: `SpelConditionEvaluator` switched from `StandardEvaluationContext` to `SimpleEvaluationContext` — blocks `T(Runtime).getRuntime().exec()` type RCE via SpEL
- **SEC-3/4**: Regex validation for fieldCode/moduleCode/sub-table paths — blocks SQL injection via DDL concat
- **SEC-6**: `BusinessRuleController` 4 mutating PUTs (validation-rules, default-values, formulas, scheduler) had ZERO auth — added `@RequireRole`
- **SEC-10**: SpEL length limit (1000 chars) + bounded cache (500 entries) + dangerous token blacklist
- **PERF-1**: `getEnabledModules` N+1 fix — was 270+ queries for 68 modules, batched to 3
- **PERF-2**: `DDLExecutor.executePendingDDL` → `@Transactional(propagation = REQUIRES_NEW)` — DDL no longer held ACCESS EXCLUSIVE lock across audit writes
- **PERF-3**: `getVersions` + `getDDLLog` paginated (default 20/50)
- **OBS-1**: `FactoryConfigServiceImpl.logWorkflowTransition` — DRAFT→PENDING_REVIEW→APPROVED→PUBLISHED transitions now persist to `config_change_log`
- **OBS-2**: `createCustomModule` real operatorId (was hardcoded 0L)
- **DATA-1**: V18 FERMENTATION migration idempotent — `NOT @>` JSONB containment check + `WHERE NOT EXISTS` for INSERT guards

### Round 5 follow-up — Deploy scripts
**Commits**: `19d8d41ab`, `ca513f05f`
**Scope**: 3 items
- Deploy script `wait_for_health` timeout 60s → 180s (first R5 deploy failed because Spring + BERT startup >60s)
- Server `restart-test.sh` / `restart.sh` / `restart-prod.sh` had `$\!` escaped instead of `$!` (literal written to log instead of background PID). Fixed on server.
- **Concurrent-edit-safety rule updated** with new rule 5: "commit 前必须 `git status` 二次确认 staging 区"
  - Background: Apr 8 session got files overwritten by concurrent session. Apr 11 first commit accidentally swept up another session's 5 files (husky/lint-staged auto-staged). New rule prevents this.

### Round 6 — Robustness & R5 Regression Recovery
**Commit**: `c5691a3f5 fix(canvas-v3): Round 6 P0/P1`
**Scope**: 5 P0/P1 items
- **P0-1 Canvas editor crash**: R5 PERF-3 changed `getVersions` from List to Page shape `{content, totalElements, ...}` but the Vue web-admin was still doing `historyRes.data.some()` on an object → `TypeError: history.some is not a function`. **Every user opening Canvas editor crashed for ~14 hours.**
- **P0-2 publishConfig scheduler drift**: `publishConfig` never called `dynamicSchedulerService.reloadAll()`, so new cron schedules took effect only after JVM restart
- **P1-1 ValidationRuleEvaluator cross-tenant autoHydrate**: `SELECT * FROM tableName WHERE id::text = ?` — no factory_id filter. Fixed: check table has factory_id column first, then add `AND factory_id = ?`
- **P1-2 AggregateFormulaExecutor cross-tenant read**: factoryId filter only applied when target table had factory_id column. Now rejects any table without factory_id entirely.
- **P1-3 TriggerChainExecutor silent drop**: Unknown event types hit `return` with no log. Now rate-limited warn with configured chain count.

**Deferred to R7a**: A whole category of SEC issues was not audited in R6 — the "SEC-7~SEC-9 config engine attack surface" that R6 critic A found but R6 didn't address (these became R7a scope).

### Round 7a — The Critical Security Session
**Commit**: `c30a7e6b3 fix(canvas-v3): Round 7a audit`
**Scope**: 7 P0 fixes, triggered by Subagent C's critical discovery

**The single biggest finding of all 9 rounds**: **Canvas AI Chat endpoint was DOUBLE-unprotected**
- `CanvasAIController.chat` and `.applyDiffs` had zero auth on backend AND frontend
- Any authenticated user could use "autopilot" mode to have the LLM execute arbitrary canvas_* tools (DDL changes, template apply, module disable)
- This was a **full RCE-via-LLM for any logged-in user**
- **Fixed**: added `@RequireRole({"factory_super_admin", "permission_admin"})` to both endpoints

**Other P0s**:
- **Router meta.roles**: `canvas-editor` route had no role meta, so ANY role could load the editor and see all buttons (~20 mutation buttons)
- **DDLExecutor REFERENCE/LINE_ITEMS fallthrough**: Neither type was in `mapFieldTypeToSQL` switch, both fell to `default -> VARCHAR(500)`. Customer created "reference" field → got text blob, FK semantics lost.
- **CanvasHeader single-flight locks**: All 8 action buttons (save/submit-review/approve/reject/publish-now/etc.) had no `:loading` or `:disabled`. Double-click produced duplicate requests.
- **useCanvasEditor beforeunload guard**: Zero `beforeunload`/`beforeRouteLeave` in entire web-admin. Closing tab with dirty state = silent data loss.
- **RN DynamicFieldsView cross-factory race**: `useEffect` had no cleanup; rapid factoryId switch could leak factory A's data into factory B's display (compliance issue)

**R7a method**: 3 red-team critics (A/B/C) reviewed the plan, each found structural problems the original plan missed. Critic B alone found 9/16 E2E stress scenarios would fail. The critic pattern PROVED ITS VALUE by finding P0 issues (like the Canvas AI hole) that the naive plan wouldn't have caught.

### Round 7b + Round 8 — The Canvas Facade Discovery
**Commit**: `596e20baa fix(canvas-v3): Round 7b + Round 8`
**Scope**: 5 P0 fixes + biggest structural finding of the session

**R7b (R7a deferred P0s)**:
- **SUB_TABLE row data export** — `FactoryConfigServiceImpl.exportConfig` now queries each `{moduleCode}_{fieldCode}_items` table, dumps rows in `subTableRows` bucket. Bundle version bumped to 2.0.
- **ATTACHMENT file manifest** — scans `cf_<fieldCode>` values, writes `attachmentManifest` bucket with refs. Customer ops migrates files separately.

**R8 findings** (2 parallel subagents):

- **Subagent α** (business flow audit): **Only 1/17 Service methods fully honor Canvas config**. `SalesServiceImpl.createSalesOrder` is the ONLY fully-integrated method. 9/17 partial, 7/17 completely bypass Canvas. **SalesDeliveryRecord has ZERO Canvas integration** — customer-configured validation rules for delivery never fire.

- **Subagent β** (tool reachability audit): **362 registered tools, only ~180 (50%) reachable**. `factory_tool_configs` was a **write-only table** — Canvas UI wrote to it but ToolDispatchService/SkillExecutor/TriggerChain **never read it**. Canvas tool on/off switch was purely decorative.

**R8 fixes**:
- **R8-β P0**: Added `isToolEnabledForFactory` check to `ToolDispatchService` (1 of 3 layers)
- **R8-α Gap #2**: Added `InvoiceIssuedEvent` + `SalesOrderSettledEvent` to `TriggerChainExecutor.HANDLED_EVENTS`
- **R8-α Gap #4**: `ArApServiceImpl.recordArPayment`/`recordApPayment` now call `validationRuleEvaluator.validate` (payment paths were bypassing Canvas)

**The structural finding**: UI/config looked complete, but execution layer only ~15-18% honored the config. Customer expectation ≠ reality.

### Round 9 — Canvas Integration Template
**Commit**: `5e752ed94 fix(canvas-v3): Round 9`
**Scope**: 8 P0 fixes + the template artifact

**Key deliverable**: **Canvas Integration Template** — a reusable 5-hook pattern for integrating any Service method with Canvas:

```
Hook 1 (DTO):     add Map<String,Object> customFields field
Hook 2 (Service): inject DynamicFieldService
Hook 3 (Validate): runConfiguredValidation(factoryId, moduleCode, op, ctx)
                   with customFields merged as cf_* keys in ctx
Hook 4 (Persist): dynamicFieldService.setDynamicFields after repository.save()
Hook 5 (Event):   applicationEventPublisher.publishEvent(new <Module><Action>Event(...))
                  + add event class to TriggerChainExecutor.HANDLED_EVENTS
```

**Applied to 3 services**:
- `SalesServiceImpl.createDeliveryRecord` — full 5-hook (includes new `SalesDeliveryCreatedEvent` class)
- `MaterialBatchServiceImpl.createMaterialBatch` — 2/3 (missing event)
- `ProductionPlanServiceImpl.createProductionPlan` — 2/3 (missing event, no `ProductionPlanCreatedEvent` class yet)

**R8-β tail closed**: Both `SkillExecutorImpl` and `TriggerChainExecutor` now check `isToolEnabledForFactory`. All 3 execution paths respect Canvas config.

**R9-α subagent** (production chain audit): Found **5 more events missing from HANDLED_EVENTS** (ProductionAlertEvent, SampleApprovedEvent, SkuComplexityChangedEvent, SopUploadedEvent, RescheduleNeededEvent) — all added. HANDLED_EVENTS total: 7 → 9 (R8) → 15 (R9).

**15 stale intent refs cleanup**: Migration `V20260411_09` nulls out 15 tool_name references pointing at non-existent Tool classes. Applied to prod manually (Flyway not running on cretas_prod_db — known issue).

---

## Cumulative P0 Fixes (Rounds 5-9)

| Round | Commit | P0 count | Files | Key theme |
|---|---|---|---|---|
| R5 | `bfa889bc3` | 10 | 14 | Production readiness (SEC/PERF/OBS/DATA) |
| R5 follow-up | `19d8d41ab` + `ca513f05f` | 2 | 2+1 | Deploy scripts + concurrent-edit rule |
| R6 | `c5691a3f5` | 5 | 9 | Canvas editor regression + cross-tenant |
| R7a | `c30a7e6b3` | 7 | 8 | **Canvas AI auth hole** + router + DDL types |
| R7b+R8 | `596e20baa` | 5 | 5 | **Canvas facade discovery** + export/tool config |
| R9 | `5e752ed94` | 8 | 11 | **Canvas integration template** + R8-β tail |
| **TOTAL** | **6 commits** | **37 P0** | **50 files** | |

All commits pushed to origin/main. All backends deployed via blue-green to prod.

---

## Canvas V3 Current State (End of R9)

### Execution fidelity
- **UI**: ~50% complete (PageEditor, ValidationRulePanel, TriggerChainDesigner, SchedulerPanel, ToolSkillMatrix, AIChatPanel)
- **Config storage**: ~100% (17 `factory_*` tables working correctly)
- **Execution layer**: **~22%** (was 15-18% at R8; R9 added 3 template-integrated services = +4%)
- **factory_tool_configs execution layer**: **3/3** layers honor the config (ToolDispatch + SkillExecutor + TriggerChain)
- **HANDLED_EVENTS**: 15 event types (from 7 initial)

### Service integration status (40 key methods across 17 modules)

| Status | Count | Examples |
|---|---|---|
| **FULL** (all 5 hooks) | **1** | `SalesServiceImpl.createSalesOrder` + `createDeliveryRecord` (R9) |
| **2/3 hooks** | **3** | `MaterialBatchServiceImpl.createMaterialBatch`, `ProductionPlanServiceImpl.createProductionPlan`, `ArApServiceImpl.recordReceivable` |
| **Partial (1 hook)** | **~10** | Various services with only validation or only dynamic fields |
| **BYPASS (0 hooks)** | **~26** | Most delete/approve/reject/cancel paths, all workreport approve paths, entire quality chain for customFields |

### Tool registry status
- **Total tools**: 362 (registered via `@Component extends AbstractBusinessTool`)
- **Reachable**: ~180 (50%)
- **Orphans**: ~200 (never bound to intent, not in any Skill, not in trigger chains)
- **Intent-bound**: 166 (after R9 cleanup)
- **Stale refs removed**: 15

### Trigger chain system status
- **HANDLED_EVENTS**: 15 event types (good)
- **Actual execution**: ~0% — all seed trigger chains have `enabled=false`, and 7/9 seed tool names were phantom (fixed via R9-2 cleanup, but chains still disabled)
- **Decision needed**: activate the system (fix seed data + flip enabled=true) or delete it entirely

### Formula engine status
- **Code complete**: GROUP_BY + RATIO patterns work
- **Actual use**: 5 call sites total in entire `service/` dir — BOM × 4 + Sales × 1
- **Production/Quality/Material/Inbound/Outbound chains**: 0 formula engine calls
- **Customer-configured formulas** in `factory_formulas` table: stored but **never read** by production code
- **Capability gaps**: no cross-table JOIN, no WHERE clause (beyond parentId/factoryId), no per-row auto-hydrated aggregate

---

## The Goal: "Canvas Operates Everything"

### What this means concretely
A factory admin should be able to configure via Canvas UI:
1. Which modules are enabled
2. Every field's visibility, label, required status, default value (DONE)
3. Validation rules in SpEL (DONE for storage, partial for execution)
4. Formulas for derived fields and aggregates (DONE for storage, LIMITED for execution)
5. Trigger chains that react to business events (STORAGE DONE, EXECUTION ~0%)
6. Scheduled tasks with cron expressions (DONE)
7. Workflow states and transitions (DONE)
8. Permissions per role (DONE)
9. Menu/navigation ordering and grouping (NOT STARTED)
10. Email/notification templates (NOT STARTED)
11. Report templates (NOT STARTED — SmartBI is separate Python service)
12. Custom module types (Runtime createCustomModule works)

### Honest completion timeline
- **Current** (R9): ~22% execution fidelity
- **R10-R14** (~5 sessions, template expansion): estimated ~40% execution fidelity
- **R15-R18** (~4 sessions, formula engine + trigger chain revival): ~55%
- **R19-R24** (~6 sessions, remaining Service methods + edge cases): ~70%
- **R25+** (menu config, report templates, i18n, etc.): ~80%

**Estimate**: ~15-20 more focused sessions to reach 80%. At 1 session/day cadence = 3-4 weeks of work.

---

## How Future Sessions Should Continue

### R10 plan (next session, already decided)
**B + A hybrid**: Close R7a deferred critical bugs + continue template expansion.

**R7a tail (critical)**:
1. **drag-reorder saveDraft silent data loss** (Scenario 7 from R6 Critic B) — `FormCanvas.vue` onReorder updates local sortOrder, but `saveDraft()` in `index.vue:160` only sends `{enabled: true}`, never the field list. Customer drag-reorders 20 fields, clicks save, nothing persists.
2. **Optimistic lock version header** — `canvasApi.ts` PUT payloads don't include `version` field. Two-tab concurrent edit causes silent overwrite without warning.
3. **13 frontend role-gating buttons** — all inside `canvas-editor/` subdirectory, not gated by `v-if`. Solution: `<RoleGate>` wrapper component applied systematically.

**Template expansion (R9 pattern)**:
4. Complete MaterialBatch + ProductionPlan 3rd hooks — create `MaterialBatchCreatedEvent` + `ProductionPlanCreatedEvent` classes, add to HANDLED_EVENTS
5. Apply template to 2-3 new services: `QualityInspectionService.createInspection`, `WorkReportingServiceImpl.submitReport`, `InvoiceServiceImpl.requestInvoice`

### R11-R12 plan (template expansion)
- Remaining 12-15 Service methods via template
- Trigger chain seed data fix (7 phantom tools)
- Orphan tool first-batch triage (50 easy decisions)

### R13-R14 plan (formula engine)
- Add WHERE clause support to AggregateFormulaExecutor
- Add cross-table JOIN via new `CROSS_MODULE_AGGREGATE` formula type
- Per-row auto-hydrated aggregate (pre-populate context with sub-row sums)

### R15+ plan (remaining ambitions)
- Menu/navigation configuration (NEW feature)
- Report template customization (integration with SmartBI)
- Email template configuration
- Custom role types (currently FactoryUserRole is hardcoded enum)

---

## Lessons Every Session Should Remember

These are the 9 lessons from Rounds 1-9 that should NEVER be repeated:

### 1. Silent failures are the most common bug class
Every round found 3-5 of these. Examples: `@PreAuthorize` on excluded Spring Security (R5), `publishConfig` without scheduler reload (R6), TriggerChainExecutor silent drop (R6+R9), FactoryToolConfig write-only table (R8), 0 Skill/Trigger layer checks (R9).
**Rule**: Never trust "annotation present" — verify end-to-end runtime behavior.

### 2. Cross-tenant blind spots exist beyond URL filtering
R6 found `factory_id IS NULL` fallback logic, autoHydrate missing filter, formula executor missing column check. Multi-tenancy must be enforced at EVERY DB touch point.
**Rule**: When adding any DB query, ask "does this filter by factory_id?"

### 3. Fixes introduce regressions
R5 PERF-3 pagination broke R6 Canvas editor crash for 14 hours. R6 PERF-2 REQUIRES_NEW introduced R7a Hikari pool pressure concern.
**Rule**: Every backend API shape change requires a frontend parser audit.

### 4. Test coverage is essentially zero
0/37 P0 fixes have tests. This is the biggest tech debt.
**Rule**: At some point, stop finding new bugs and backfill tests for the critical ones.

### 5. Contract drift between frontend and backend
R6 P0-1 is the canonical example. Fix: when backend shape changes, MUST grep frontend for call sites and update parsers simultaneously.
**Rule**: "Backend shape change → frontend type update → E2E test" is a mandatory checklist.

### 6. Export/import incompleteness
R6 missed 5 tables, R7b added SUB_TABLE rows + ATTACHMENT manifest, future sessions will probably find more (e.g. `factory_role_permissions` might be missing).
**Rule**: Every new `factory_*` table must be added to `exportConfig`/`importConfig` as part of the same PR.

### 7. Documentation debt
MySQL dead code in `application.properties`, stale Swagger after @PreAuthorize removal, "68 modules" myth (actually 17), earlier design docs that drifted from reality.
**Rule**: When finding stale doc, either update or delete. No "we'll fix it later".

### 8. Concurrent edit hazards
Apr 8: files overwritten by concurrent session. Apr 11: commit scope creep from husky/lint-staged auto-staging. Fixed by concurrent-edit-safety rule v2 (commit 前 git status).
**Rule**: `git status` before commit. Worktree for 1h+ tasks. Never have same file open in 2 editors.

### 9. Subagent hallucinations
R5 and R9 both had subagent claims that proved wrong when verified. R6 Subagent B reported 11 stale intents (actual = 15). Subagent α reported "ArApServiceImpl evaluator injected but never called" — partially wrong (used in recordReceivable, not payment paths).
**Rule**: For every subagent P0 claim, main session MUST re-verify via Grep/Read before acting. The "VERIFIED CHECKLIST" pattern (give subagent a yes/no list instead of open-ended task) reduces hallucination rate substantially.

---

## Session-Specific Conventions (Earned the Hard Way)

### Git / Commit discipline
- **Explicit file staging**: `git add <specific files>` — never `git add .` or `git add -A`
- **Mandatory `git status` check before commit**: pre-commit hooks (husky/lint-staged) can auto-stage files. Always verify the staging area contains ONLY your intended files.
- **Scope-check commit message**: if you claim "8 files changed" in the message, verify by running `git show --stat HEAD` after commit.
- **No amend after push**: create follow-up commits instead of amending.
- **Co-author line**: every commit includes `Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>` via HEREDOC.

### Deploy discipline
- **Always verify via public nginx URL** after deploy, not just local systemd status
- **Blue-green aware**: prod has `cretas-backend` (blue) + `cretas-backend-green` (green). Active slot swaps on each deploy. `systemctl is-active cretas-backend = inactive` is NORMAL when green is active.
- **Flyway doesn't run on cretas_prod_db** — migrations must be applied manually via `sudo -u postgres psql`
- **Incremental compile can corrupt JARs** — if `unzip -l target/*.jar | grep <interface>` is empty after `mvn package`, run `mvn clean package`. This happened in R7a first deploy.
- **Deploy script has `wait_for_health` 180s timeout** (was 60s, R5 follow-up bumped it because Spring + BERT cold start is ~90-120s)

### Subagent discipline
- **Max 3-5 parallel subagents** — more hits Anthropic 429 rate limit (R7a had 2 subagents rate-limited)
- **Prefer VERIFIED CHECKLIST over open-ended tasks** — give subagent specific items to verify with yes/no + file:line, not "find all issues with X"
- **Main session re-verifies every P0 claim** — subagent hallucinations are real (see Lesson 9)
- **Don't re-read subagent JSONL output file** — it overflows context. Wait for the completion notification.

### Audit methodology
- **Critic pattern proved its value** — R7a had 3 critics (A/B/C) that found P0 issues (Canvas AI auth hole) the naive plan missed. Use critics for any non-trivial design.
- **Each round finds things prior rounds missed** — don't assume "audit complete" means "bug-free". The pattern is: each round zooms out a bit, finds new structural issues.
- **Scope creep in audits is normal** — R5 discovered something, R6 discovered R5's regression, R7a discovered issues R6 missed, R8 discovered the facade. This is healthy, not failure.

---

## Key Files to Know

### Canvas V3 core files
- `FactoryConfigServiceImpl.java` — the central orchestration service (~1100 lines, maybe getting too big)
- `DDLExecutor.java` — dynamic field DDL execution
- `SpelConditionEvaluator.java` — SpEL with security guards
- `ValidationRuleEvaluator.java` — runs configured rules per factory/module
- `DynamicFieldService.java` — dynamic field read/write
- `AggregateFormulaExecutor.java` — formula engine (GROUP_BY + RATIO)
- `TriggerChainExecutor.java` — event-driven tool orchestration (hardcoded HANDLED_EVENTS whitelist)
- `DynamicSchedulerService.java` — cron scheduler
- `RequireRole.java` + `RequireRoleInterceptor.java` — custom auth (Spring Security excluded)
- `CanvasAIController.java` — AI chat + applyDiffs (NOW properly @RequireRole guarded)

### Canvas V3 frontend files
- `web-admin/src/views/platform/canvas-editor/` — entire editor subdirectory
- `useCanvasEditor.ts` composable — now has `inFlightAction` state + `beforeunload` guard
- `CanvasHeader.vue` — action buttons with single-flight locks
- `canvasApi.ts` — API client with paginated shapes

### Round-by-round findings docs
- `.claude/agent-team-outputs/2026-04-11_round6-findings.md`
- `.claude/agent-team-outputs/2026-04-11_round7a-findings.md`
- `.claude/agent-team-outputs/2026-04-11_round7b-r8-findings.md`
- `.claude/agent-team-outputs/2026-04-11_round9-findings.md`

### Design specs
- `docs/superpowers/specs/2026-04-11-round6-robustness-audit-design.md`
- (this handoff doc) `docs/superpowers/handoffs/2026-04-11-canvas-v3-rounds-1-10-handoff.md`

---

## The Current Mental Model

Imagine Canvas V3 as a three-layer pyramid:

```
      UI Layer (50% complete)
      ─────────────────────
    Config Storage Layer (100% complete)
    ──────────────────────────────────
  Execution Layer (22% complete) ← the real problem
  ──────────────────────────────────────
```

The UI and Config layers are fast to complete (straightforward coding). The Execution layer requires **per-Service-method integration** using the R9 template pattern. Each Service method takes ~15 min with the template (~1h without).

Estimate: 40 key Service methods × 15 min = **10 hours of focused template work** to reach execution layer ~60%. That's 2-3 sessions if you do nothing else.

The rest of the work (formula engine capability, trigger chain revival, menu config, reports, i18n) is incremental but not blocking the core "Canvas configures business behavior" promise.

---

## Open Decisions for User

These are decisions R10+ may need the user to make:

1. **Trigger chain system**: activate (fix 7 phantom tools + flip enabled=true) or delete? Current state: dead code, customers can't use it.

2. **Orphan tool triage**: 200 tools in restaurant_*/report_*/canvas_*/camera_*/equipment_* categories with zero reachability. Keep (hoping future intents bind) or delete (cleanup)?

3. **Global validation rules fallback**: current `if (factory has custom rules) use custom; else use global` means a factory with 1 custom rule loses ALL global rules. Fix to union semantics (might cause unexpected BLOCK errors) or keep fallback?

4. **Formula engine extension priority**: JOIN first? WHERE first? Per-row aggregate first? Customer LTV, BOM达成率, 库存周转, 毛利率 each blocked by different gaps.

5. **Module coverage truth**: the 17 seeded vs 68 claimed mismatch — should Canvas V3 support creating custom modules (`createCustomModule` exists) OR should we commit to the 17 and focus depth?

6. **Test coverage backfill priority**: SEC-1 (most dangerous zero-coverage) first? Or regression tests for R6 P0-1 class of bugs?

These shouldn't block R10 execution but should get addressed in R11-R12.

---

## How to Resume After This Session

**First command in next session** (R10 kickoff):
1. `git log --oneline -10` — see all commits since R9
2. Read this handoff doc
3. Read the 4 findings docs in `.claude/agent-team-outputs/`
4. Verify prod is still healthy: `curl -s https://centerapi.cretaceousfuture.com/api/mobile/health`
5. Continue with **R10 plan: B + A hybrid** (drag-reorder fix + optimistic lock + 13 role gates + 2-3 more template applications)

**If something surprising has happened** (another session committed, customer reported bug, etc.):
1. `git log` to see what's new
2. Update this handoff doc with the new context
3. Then continue R10

**Don't**:
- Start from scratch assuming you know the system — read this doc first
- Trust "audit complete" claims — every round finds new things
- Skip the concurrent-edit-safety rule (commit 前 git status) — it's saved us twice already
