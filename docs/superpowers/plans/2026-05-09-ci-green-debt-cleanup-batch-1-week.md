# CI Green Debt Cleanup — 1-Week Batch Plan

> **For agentic workers**: This is a STRATEGIC ROADMAP doc, not a TDD bite-sized executable plan.
> Do NOT execute lint/type mass-edits from this doc directly.
> When trigger conditions in §3 are met, use this doc as the spec to author 4 follow-up sub-PRs (each gets its own bite-sized implementation plan via `superpowers:writing-plans`).

**Goal**: Eliminate 5 remaining `continue-on-error: true` masks in `.github/workflows/ci.yml` so CI failures become real signals, by clearing 1496 flake8 + 1064 vue-tsc errors + RN jest infra debt + Java mvn test failures over a focused 1-week window.

**Architecture**: Defer-and-batch. PR #212 audit revealed the mask debt is far larger than initially audited (1496 vs claimed 19 flake8; 1064 vs claimed "TS5052 only" vue-tsc). Cannot safely clear in single PR; needs **4 sub-PRs** with per-module test gates between each. Trigger condition: post-customer-return + Phase 2A/B/C closure (defer to ~Q3 2026 mid).

**Tech Stack**: ruff (Python auto-fixer), autoflake (F401/F541), flake8 (gate), vue-tsc (TypeScript gate), vitest (Vue unit tests), pytest (Python unit tests), Playwright (UI smoke).

---

## §0. TL;DR

| Item | Value |
|------|-------|
| **Scope** | 5 `continue-on-error` masks in `.github/workflows/ci.yml` (lines 33, 64, 91, 98, 115) |
| **Debt count** | 1496 flake8 + 1064 vue-tsc + 1 RN jest infra + 1 Java mvn test failure surface |
| **Sub-batches** | 4 sub-PRs over ~1 week (Sub-1 ½d + Sub-2 2d + Sub-3 2-3d + Sub-4 ½d, ~6d wall-clock) |
| **Execute trigger** | Post-customer-return active soak ≥7d + 0 customer regression + Phase 2A/B/C closed + Steve sign-off |
| **Recommended timing** | Defer to **~Q3 2026 mid** (per fast-track Option A discussion) |
| **Rollback path** | Per-sub-batch revert (each sub-PR independent, tests gate merge) |
| **Parallel work** | Subagent ✅ (per-module batch); multi-chat ❌ (same files race) |
| **Blocking risks** | Lint mass-edit silent regression (per-module pytest+Playwright gate mitigates) |

---

## §1. Discovery (2026-05-09)

Ran fresh `flake8` + `vue-tsc` against `origin/main` HEAD `45bb318d72`. Numbers confirm chat0 audit (1496 + 1064) and add per-error-code + per-file breakdown.

### §1.1 Flake8 — backend/python (1496 total)

```bash
cd backend/python
flake8 --max-line-length=120 --statistics --count --exclude=venv,__pycache__,.git .
```

**Per-error-code breakdown** (top 20 of 38 codes):

| Code | Count | Description | Auto-fixable? |
|------|-------|-------------|---------------|
| F401 | **457** | imported but unused | ✅ ruff `--fix` / autoflake `--remove-all-unused-imports` |
| E501 | **250** | line too long (>120 chars) | ⚠️ partial (`black`/`ruff format` reformats long lines but not always cleanly) |
| E402 | **134** | module level import not at top of file | ❌ manual (often deliberate — gated import after path manipulation) |
| E128 | **133** | continuation line under-indented for visual indent | ✅ `black`/`ruff format` |
| F541 | **106** | f-string is missing placeholders | ✅ ruff `--fix` (converts `f""` → `""`) |
| E302 | **64** | expected 2 blank lines, found 1 | ✅ `black`/`ruff format` |
| F841 | **57** | local variable assigned but never used | ✅ ruff `--fix` (removes assignment) |
| E221 | **48** | multiple spaces before operator | ✅ `black`/`ruff format` |
| E111 | **32** | indentation not multiple of 4 | ✅ `black`/`ruff format` |
| E225 | **30** | missing whitespace around operator | ✅ `black`/`ruff format` |
| E127 | **27** | continuation line over-indented for visual indent | ✅ `black`/`ruff format` |
| E261 | **22** | at least 2 spaces before inline comment | ✅ `black`/`ruff format` |
| F821 | **20** | undefined name (e.g. `pd`) | ❌ manual (genuine bug — missing import OR dead code) |
| E131 | 16 | continuation line unaligned for hanging indent | ✅ format |
| E701 | 14 | multiple statements on one line | ⚠️ partial format |
| E306 / E722 / E231 / E201 / E741 | 8 each | misc | ✅ format / manual |
| F811 | 3 | redefinition of unused name | ✅ ruff |
| F601 | 2 | dict key repeated with different values | ❌ manual (genuine bug) |
| W391 | 1 | blank line at end of file | ✅ format |

**Auto-fixable subset (Sub-1 scope)**: `F401 + F541 + F841 + W391 + F811` = **624 errors** (42% of total) clear via `ruff check --fix --select F` or `autoflake --remove-all-unused-imports --remove-unused-variables`.

**Format-fixable subset (Sub-2 wave-A scope)**: `E1xx + E2xx + E3xx (most) + W` = ~**450 errors** clear via `black` or `ruff format`.

**Manual review subset (Sub-2 wave-B scope)**: `E402 + F821 + F601 + some E5xx + E7xx + E722` = ~**220 errors** require per-occurrence judgment.

**Per-file top-10** (excluding auto-generated):

| File | Errors | Note |
|------|--------|------|
| `grpc_stubs/embedding/embedding_pb2.py` | 64 | **EXCLUDE** — auto-generated protobuf |
| `grpc_stubs/embedding/embedding_pb2_grpc.py` | 51 | **EXCLUDE** — auto-generated grpc stub |
| `main.py` | 48 | Manual review — likely E501 + F401 mix |
| `smartbi/api/chat.py` | 39 | Manual review |
| `smartbi_compat/api/analysis_department.py` | 23 | Phase 2A port — F401 likely from copy-paste port |
| `smartbi/api/excel.py` | 23 | Manual review |
| `smartbi_compat/api/analysis_procurement.py` | 22 | Phase 2A port |
| `smartbi_compat/api/analysis_inventory.py` | 22 | Phase 2A port |
| `smartbi/services/unified_analyzer.py` | 15 | Manual review |
| `smartbi/services/fixed_executor.py` | 15 | Manual review |

**Recommendation**: Add `grpc_stubs/` to flake8 `--exclude` in `.flake8` config OR ci.yml command — eliminates 115 auto-generated errors immediately (no source code change).

### §1.2 Vue-tsc — web-admin (1064 total)

```bash
cd web-admin
npx vue-tsc -b 2>&1 | grep -oE "error TS[0-9]+" | sort | uniq -c | sort -rn
```

**Per-error-code breakdown** (top 15 of 34 codes):

| Code | Count | Description | Fix complexity |
|------|-------|-------------|----------------|
| TS2339 | **353** | Property X does not exist on type Y | High — typically `unknown` from API response unwrap; need typed interfaces |
| TS2322 | **200** | Type X not assignable to Y | High — usually `unknown → string/number` casts needed |
| TS2345 | **120** | Argument type mismatch | High — function call site type narrowing |
| TS2352 | 81 | Conversion may be a mistake | Medium — `as Foo` conversion needs `unknown` intermediate |
| TS2724 | 56 | Module declares X locally but not exported | Low — add `export` keyword (likely sister-PR scope creep) |
| TS2694 | 47 | Namespace has no exported member | Medium — typings drift from echarts/element-plus version bump |
| TS7018 | 23 | Object literal property implicitly has 'any' type | Low — add explicit type annotations in test fixtures |
| TS2538 | 20 | Type 'unknown' cannot be used as index | Medium — narrow before indexing |
| TS2362 | 20 | Operand must be number type | Medium |
| TS2365 | 18 | Operator cannot be applied | Medium |
| TS2363 | 15 | Operand must be number type | Medium |
| TS2551 | 13 | Property does not exist, did you mean Y | Low — typo fix |
| TS7053 | 11 | No index signature with parameter type | Medium |
| TS2740 | 11 | Type missing required properties | Medium |
| TS7006 | 9 | Implicit 'any' parameter | Low — add type annotation |

**Per-file top-10**:

| File | Errors | Notes |
|------|--------|-------|
| `src/views/smart-bi/SmartBIAnalysis.vue` | **103** | 10% of all vue-tsc errors. Recommend dedicated sub-PR. |
| `src/components/smartbi/DynamicChartRenderer.vue` | 79 | Recommend dedicated sub-PR or co-batch with above. |
| `src/views/production/bom/index.vue` | 55 | High-density single file. |
| `src/views/sales/orders/detail.vue` | 32 | |
| `src/views/production/batches/detail.vue` | 27 | |
| `src/views/sales/orders/list.vue` | 25 | |
| `src/views/hr/attendance/list.vue` | 24 | |
| `src/views/analytics/smart-bi/AdvancedFinanceAnalysis.vue` | 24 | |
| `src/views/quality/standards/list.vue` | 20 | |
| `src/views/system/workflow-designer/index.vue` | 17 | |

**Top-4 files = 269 errors (25% of total)**. Top-30 files ≈ 600 errors (56%). Long tail of ~170 files with <10 errors each.

**Root cause pattern**: Most TS2339/TS2322/TS2345 errors stem from `apiClient.get()` returning `Promise<unknown>` (intentional safety per `api-response-handling.md`), with view code accessing `.content`, `.totalElements`, `.factoryConfigs` etc. without narrowing. Fix typically: define `ApiResponse<T>` interfaces per endpoint + use `as` casts at the boundary OR generic `apiClient.get<T>()`.

### §1.3 Other CI debt

| Site | Line | Status | Debt |
|------|------|--------|------|
| `java-build-test` mvn verify | 33 | masked | Pre-existing test failures (54+235 across IntentExecutorStreamIT, SemanticCacheServiceTest, ProcessTaskServiceImplTest, AnalysisFlowIntegrationTest etc. — DI/Mockito-strict/Spring-context-bootstrap test infra issues). Verified during PR #205 build (T6.5 Phase B execute). |
| `python-lint-test` flake8 | 64 | masked | 1496 errors per §1.1 |
| `vue-build-check` vue-tsc | 91 | masked | 1064 errors per §1.2 |
| `vue-build-check` vitest | 98 | masked | "Phase B C-6 (May 9 2026): 28 unit tests for Canvas reactive default framework" + pre-existing CapabilityGate / data-quality test failures (per ci.yml comment) |
| `rn-test` jest | 115 | masked | "jest missing from devDeps — pre-existing infra debt" (per ci.yml comment) |

---

## §2. Sub-batch Breakdown (4 Sub-PRs, ~1-week wall-clock)

Each sub-PR is **independent**: can be merged/reverted without blocking others. **Each sub-PR has its own test gate** (per `feedback_no_defensive_in_verify_scripts.md` — no try/except masking, fail loud).

### §2.1 Sub-PR 1 — Python F-codes auto-fix (~½ day)

**Scope**: Auto-fixable flake8 F-codes + W391 = 624 errors.
- `F401` (457) — unused imports
- `F541` (106) — empty f-strings
- `F841` (57) — unused local vars
- `F811` (3) — redefinitions
- `W391` (1) — blank EOF line
- **Plus**: add `grpc_stubs/` to flake8 `--exclude` (eliminates 115 auto-generated errors no-source-change)

**Tooling**:
```bash
# Option A (preferred): ruff (single tool, faster)
pip install ruff
cd backend/python
ruff check --select F401,F541,F811,F841,W391 --fix --exclude=grpc_stubs,venv,__pycache__,.git .

# Option B (if ruff causes parser issues): autoflake + manual
pip install autoflake
autoflake --remove-all-unused-imports --remove-unused-variables --in-place --recursive --exclude=grpc_stubs .
```

**Test gate** (per-occurrence safety from PR #212 marching order: "If any flake8 file actually NEEDS the imported symbol ... STOP"):
```bash
# 1. Verify no import was inside __all__ or otherwise re-exported
grep -rn "^__all__" backend/python --include="*.py" | head -20

# 2. Run pytest — any import-removal that broke a test surfaces here
cd backend/python
pytest tests/ -v --timeout=30 \
  --ignore=tests/test_data_accuracy.py \
  -k "not e2e and not integration"

# 3. Run a smoke against test env (47:8084) to catch runtime import errors
ssh root@47.100.235.168 "curl -s http://localhost:8084/health"
ssh root@47.100.235.168 "curl -s http://localhost:8084/api/smartbi/excel/list"
# (or other smoke that exercises common import paths)
```

**Expected outcome**:
- Flake8 count drops from 1496 → ~872 (1496 - 624 = 872; further -115 from grpc_stubs exclude → **~757**)
- `continue-on-error: true` on line 64 STAYS (still 757 errors remaining → Sub-2)

**CI changes**: `.github/workflows/ci.yml` line 65 — add `--exclude=venv,__pycache__,.git,grpc_stubs` (currently `--exclude=venv,__pycache__,.git`).

**Risk**: Low. F-codes are syntactic, not semantic. Mock import that was pulled in as side-effect (rare) might break — caught by pytest.

**Rollback**: `git revert <Sub-1 commit>`. Since this is the first sub-PR and isolated to Python source, no cascading impact.

**ETA**: 30-60 min auto-fix execution + 1-2h test gate + per-file spot-check.

### §2.2 Sub-PR 2 — Python format + manual fixes (~2 days)

**Scope**: Remaining 757 flake8 errors (post Sub-1).
- **Wave A — format-fixable** (~450 errors): `E1xx + E2xx + E3xx + most E7xx` clear via `black backend/python --line-length=120` or `ruff format`.
- **Wave B — manual review** (~220 errors): `E402 + F821 + F601 + some E5xx + E7xx + E722` require per-file judgment.
- **Wave C — line-length judgment** (~250 E501): some legitimate long strings (e.g. SQL queries, log messages) — wrap with `\` continuation OR `# noqa: E501` annotation per occurrence.

**Strategy**:

```bash
# Wave A — format pass
cd backend/python
black --line-length=120 --exclude="grpc_stubs|venv|__pycache__" .
# OR equivalent: ruff format --line-length 120 --exclude=grpc_stubs,venv .

# Wave B — manual per-file pass (top files first)
# E402 (134): import ordering — usually deliberate. Add `# noqa: E402` after a comment explaining WHY.
# F821 (20): genuine bugs. Either add missing import (`import pandas as pd`) or remove dead code.
# F601 (2): dict key duplication — fix the data shape.
# E722 (8): bare except — replace with `except Exception:` or specific exception class.

# Wave C — E501 line-length per-file judgment
# Use grep to find each + manually wrap or annotate.
flake8 --max-line-length=120 --select=E501 backend/python | head -50
```

**Test gate**:
```bash
# After Wave A (format pass)
cd backend/python && pytest tests/ -v --timeout=30 -k "not e2e and not integration"
# Run formatter check separately to confirm idempotency
black --check --line-length=120 --exclude="grpc_stubs|venv|__pycache__" .

# After Wave B (manual fixes)
flake8 --max-line-length=120 --statistics --count --exclude=venv,__pycache__,.git,grpc_stubs . | tail -5
# Expected: 0 errors

# After Wave C (E501 judgment)
# All E501 either wrapped or `# noqa: E501` annotated
flake8 --max-line-length=120 --select=E501 --exclude=grpc_stubs . | wc -l
# Expected: 0
```

**Per-module ordering** (smallest blast radius first):
1. `tests/` directory first (test code; regression contained)
2. `smartbi_compat/api/analysis_*.py` (Phase 2A port code; isolated)
3. `smartbi/services/` (business logic)
4. `smartbi/api/` (route handlers)
5. `main.py` (entry point) last

**Expected outcome**:
- Flake8 count: 757 → **0**
- `.github/workflows/ci.yml` line 64 — REMOVE `continue-on-error: true`

**Risk**: Medium. `black` reformat may shift line numbers but preserves AST. Manual edits to F821/F601/E722 are genuine bug fixes — pytest gate catches regressions. Per Phase 2A `dict-eq parity gate` standard, add a re-run of T6.1 dryrun-style API parity check post-format to verify no unintended business-logic shift (very unlikely from format-only, defensive).

**Rollback**: `git revert <Sub-2 commit>`. Sub-2 is isolated to Python source. If Wave A black-format is the issue, revert just that commit (within Sub-2). If Wave B manual edits broke something, surgical fix instead of revert.

**ETA**: ~2 days wall-clock. ~4h Wave A (mostly waiting for tests). ~6-8h Wave B (per-file judgment). ~4-6h Wave C.

### §2.3 Sub-PR 3 — Vue-tsc per-component (~2-3 days)

**Scope**: 1064 vue-tsc errors. Per-file batched, top-density first.

**Strategy**:

```bash
# Discovery: re-run per-file count to track progress
cd web-admin
npx vue-tsc -b 2>&1 | grep -E "^src/" | sed -E "s|^(src/[^(]+)\(.*|\1|" | sort | uniq -c | sort -rn > /tmp/vue-tsc-per-file.txt
```

**Sub-batches within Sub-3** (per-file phases):

| Phase | Files | Errors | Strategy |
|-------|-------|--------|----------|
| 3a | SmartBIAnalysis.vue | 103 | Define typed `SmartBiAnalysisResponse` interface; replace `unknown` access with typed accessors |
| 3b | DynamicChartRenderer.vue | 79 | Same pattern |
| 3c | production/bom/index.vue | 55 | Same |
| 3d | sales/orders/* + production/batches/detail.vue | 84 | Same |
| 3e | hr/* + analytics/smart-bi/AdvancedFinanceAnalysis.vue + quality/* | 79 | Same |
| 3f | system/workflow-designer/* + smart-bi/{FinanceAnalysis, Dashboard, AIQuery, composables} | ~70 | Same |
| 3g | api/smartbi/{restaurant-v2, analysis} (TypeScript files) | 32 | Define ApiResponse<T> generics |
| 3h | Long tail (~170 files <10 errors each) | ~600 | Bulk pass with shared types |

**Common pattern** (most TS2339/TS2322/TS2345):
```typescript
// ❌ Current — unknown leaks into view code
const response = await apiClient.get('/api/mobile/F001/sales/orders');
const list = response.content;  // TS2339: Property 'content' does not exist on type 'unknown'

// ✅ Fix — define typed interface + cast at boundary
interface PageResponse<T> { content: T[]; totalElements: number; totalPages: number; }
const response = await apiClient.get<PageResponse<SalesOrder>>('/api/mobile/F001/sales/orders');
const list = response.content;  // typed
```

**Test gate (per phase)**:
```bash
# After each phase 3a-3h
cd web-admin
npx vue-tsc -b 2>&1 | grep -cE "^src/"
# Expected: monotonically decreasing toward 0

# Vitest unit tests must continue passing (or improving)
npm test -- --run

# Playwright spot-check (optional but recommended for high-impact files like SmartBIAnalysis.vue)
# - Open page in browser via dev server
# - Verify no TypeError in console
# - Verify chart renders + data loads
```

**Expected outcome**:
- Vue-tsc count: 1064 → **0**
- `.github/workflows/ci.yml` line 91 — REMOVE `continue-on-error: true`

**Risk**: Medium-high. Type fixes that change runtime narrowing (e.g., adding `as string` where it was previously `unknown`) can mask genuine type mismatches at runtime. Per `typescript-type-safety.md` rule (`as any` is forbidden), prefer type guards over casts where feasible. Playwright spot-check on top-density files is mandatory.

**Rollback**: Per-phase revert (each phase is its own commit within Sub-3 PR; if 3c breaks, revert just 3c, keep 3a/3b shipped).

**ETA**: ~2-3 days. Phase 3a alone (SmartBIAnalysis.vue, 103 errors) likely 4-6h. Phase 3h (long tail) 6-10h. Total estimate: 16-24h.

### §2.4 Sub-PR 4 — RN jest infra + Java mvn cleanup + vitest cleanup (~½ day)

**Scope**: 3 separate masks bundled because each is small.

#### Sub-4a: RN jest devDeps fix

```bash
cd frontend/CretasFoodTrace
yarn add --dev jest jest-expo @testing-library/react-native @types/jest
yarn jest --listTests | head -5  # verify discovery works
yarn test --ci --coverage --forceExit  # full run
```

**CI change**: `.github/workflows/ci.yml` line 115 — REMOVE `continue-on-error: true`.

**Risk**: Low. Adds devDeps; doesn't touch source. If `yarn test` reveals genuine pre-existing test failures (likely), file separate sub-PR for each test fix — Sub-4 only enforces the runner.

**Sub-Sub-4a contingency**: If existing tests fail (e.g., 5+ test failures discovered), STOP-and-ping organizer. Decision: either fix tests in this sub-PR or split out + keep mask until separate cleanup ships.

#### Sub-4b: Java mvn test cleanup

**Scope**: Pre-existing test failures verified during PR #205 build:
- `IntentExecutorStreamIT` — DI not wired (`sseStreamingService is null`)
- `LlmIntentFallbackClientImplClarificationTest` — reflection arg count mismatch
- `ProcessTaskServiceImplTest` — repository mocks not wired
- `SemanticCacheServiceTest` / `ProtocolMatcherTest` — Mockito strict-mode UnnecessaryStubbing
- `AnalysisFlowIntegrationTest` — Spring context bootstrap failure cascade

**Strategy**: Fix tests per-class. Each fix likely 30-60 min. Estimated 5-10 test classes need touching.

```bash
# Run failed tests individually to investigate
cd backend/java/cretas-api
mvn test -Dtest=IntentExecutorStreamIT
mvn test -Dtest=ProcessTaskServiceImplTest

# Common fixes:
# - DI not wired → add @MockBean or @InjectMocks to test class
# - Mockito strict → either remove unnecessary stubbing OR add @Mock(strictness = LENIENT)
# - Spring context cascade → fix the root cause class (often a missing @MockBean for some dependency)
```

**CI change**: `.github/workflows/ci.yml` line 33 — REMOVE `continue-on-error: true`.

**Test gate**:
```bash
mvn clean verify -Dspring.profiles.active=test -pl .
# Expected: BUILD SUCCESS, 0 failures, 0 errors
```

**Risk**: Medium. Test fixes that mask underlying production-code bugs are dangerous. Each fix needs root-cause confirmation, not "make the test green" surface fix. Per `feedback_no_defensive_in_verify_scripts.md` — no try/except wrapping just to make tests pass.

#### Sub-4c: Vitest pre-existing failures cleanup

**Scope**: Pre-existing CapabilityGate / data-quality unit test failures (per ci.yml line 95-97 comment) + 28 Phase B C-6 tests added 2026-05-09 that may have spec-vs-code drift.

```bash
cd web-admin
npm test -- --run
# Identify failing tests, fix per-file
```

**CI change**: `.github/workflows/ci.yml` line 98 — REMOVE `continue-on-error: true`.

**Risk**: Medium. Same as Sub-4b — fix root cause not surface.

**Sub-4 ETA**: ½ day if straightforward, 1-1.5 days if Java/vitest test cleanup uncovers cascading issues.

---

## §3. Execute Trigger Conditions

**ALL of the following MUST be green before kickoff** (per `feedback_dispatch_on_technical_readiness.md` — fire on technical readiness):

- [ ] **Customer return active soak ≥ 7 days** post first customer comeback (currently 0-customer state)
- [ ] **0 customer regression** reports in soak window
- [ ] **Phase 2A scope completeness 100%** (✅ already true per memory `project_2026_05_09_phase_2a_complete.md`)
- [ ] **Phase 2B kickoff in progress** OR explicitly deferred (current: deferred per memory `project_2026_05_07_t6_1_dryrun_in_flight.md`)
- [ ] **Phase B real close** (✅ executed 2026-05-09 per PR #205 + audit doc PR #210)
- [ ] **Phase C trigger condition met** (30-day soak per spec §B.4 OR active-E2E compressed per HARD rule)
- [ ] **Steve organizer-level sign-off** to start cleanup batch

**Rationale for waiting**:
1. **No customer impact tolerance during cutover monitoring**: lint mass-edits introduce diff churn that could obscure regression signals during 24-48h Phase B/C soak windows.
2. **Phase 2A/B/C work in flight**: Sister chats actively edit `backend/python/smartbi_compat/`, `backend/java/cretas-api/src/main/java/com/cretas/aims/controller/SmartBI*.java`, `web-admin/src/views/smart-bi/*` — concurrent lint mass-edit creates merge-conflict storm + Rule 5b violation risk.
3. **Phase 3 backlog reference**: this plan doc serves as the spec for future cleanup; numbers + per-error-code breakdown will be slightly stale by execute time but methodology stays valid (just re-run Discovery commands in §1 to refresh).

**Recommended execute timing**: **~Q3 2026 mid** (post-customer-return + Phase 2A/B/C closure). Earlier execution = higher risk of merge-conflict + scope creep. Later execution = debt accumulation makes batch larger.

---

## §4. Risk Register

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Lint mass-edit introduces silent regression | Medium | High (production bug) | Per-sub-batch pytest+vitest+Playwright gate. Re-run T6.1-style dict-eq parity check post-format pass. |
| F401 auto-fix removes `import side_effect` (mock registration etc.) | Low | Medium | grep `__all__` and `# noqa: F401` annotations before auto-fix. Pytest catches if mock breaks. |
| Black/format reorders dict keys → API contract drift | Very Low | Low (Phase 2A dict-eq tolerant) | `dict` is unordered in Python 3.6 + insertion-order-preserving in 3.7+, format pass doesn't reorder. Defensive parity check. |
| TS type narrowing introduces runtime error (was previously runtime-OK because TS2339 silently passed) | Medium | Medium-High | Playwright smoke per Sub-3 phase. Top-density files (SmartBIAnalysis.vue 103 errors) get manual browser verify. |
| `as` cast hides type drift between API contract change + view code | Medium | Medium | Prefer type guards over `as`. Where `as` necessary, add code comment explaining WHY. |
| Concurrent sister-chat edits to same files race during cleanup batch | High (during execution) | High (lost work) | Strict trigger condition: NO sister chat editing target files during cleanup window. Use git worktree isolation per `concurrent-edit-safety.md`. |
| Pre-existing Java test failures mask production regressions | Medium | High | Sub-4b root-cause fix policy (no try/except). If a test reveals genuine prod bug, surface as separate issue + fix in dedicated PR. |
| 1-week timeline slips to 2-3 weeks | High | Low | Each sub-PR independent; partial completion still reduces debt. Update plan §6 recommendation if mid-execute discovers larger scope. |
| Customer arrives mid-execute → 0-customer-state assumption violated | Medium | High | STOP-and-ping organizer immediately. Preserve completed sub-PRs; defer remaining. |
| Plan doc itself becomes stale before execute (numbers drift) | High | Low | Re-run Discovery commands (§1) at execute time to refresh per-error-code + per-file counts. Methodology stable. |

---

## §5. Parallel Work Analysis

Per `.claude/rules/parallel-work-analysis.md`:

### §5.1 Subagent parallel (single chat)

✅ **Subagent ❌ → ✅ within same sub-PR**:
- **Sub-1**: Single auto-fix command, no parallel benefit
- **Sub-2 Wave A**: Single black/format pass, no parallel benefit
- **Sub-2 Wave B**: Per-module manual review CAN run subagents in parallel (different files)
- **Sub-3 phases 3a-3h**: ❌ **NO** — phases process different files but type definitions cascade (e.g., new `ApiResponse<T>` interface defined in 3a used in 3g). Sequential dependency.
- **Sub-4a/4b/4c**: ✅ Independent (RN devDeps + Java tests + vitest tests touch different file trees) — can subagent-parallel ALL 3 simultaneously

### §5.2 Multi-chat parallel

❌ **Multi-chat ❌**:
- All 4 sub-PRs touch overlapping infrastructure (`.github/workflows/ci.yml` is the merge contention point — every sub-PR removes a `continue-on-error: true` line)
- Sister-chat chaos risk during cleanup window. Strict serialization: **one chat owns CI debt cleanup window end-to-end**, sister chats either pause or work on non-target files.

### §5.3 Recommended dispatch model

**Single-chat sequential** with **subagent-parallel within Sub-4**:

```
Chat owns cleanup window (Day 0-7)
├─ Day 0-0.5: Sub-1 (single auto-fix + test gate)
├─ Day 0.5-2.5: Sub-2 (Wave A → Wave B → Wave C, sequential)
├─ Day 2.5-5: Sub-3 (phases 3a-3h, sequential per-file dependency)
└─ Day 5-5.5: Sub-4 (3 subagents parallel: 4a + 4b + 4c)
```

---

## §6. Recommendation

**DEFER execute to ~Q3 2026 mid** per §3 trigger conditions.

**Ship this PLAN doc to main NOW** as Phase 3 backlog reference. Plan doc's value:
1. Authoritative discovery numbers (1496 + 1064 confirmed via local re-run, not assumed from chat0 audit)
2. Per-error-code + per-file breakdown for accurate sub-batch sizing
3. Risk register + rollback strategy locked in BEFORE execute (when stakes are higher)
4. Parallel work + dispatch model clarity
5. Execute trigger conditions explicit (avoids premature execute when sister chats active)

**Plan doc is NOT executable code** — when triggered, follow-up author writes 4 individual implementation plans per sub-PR using `superpowers:writing-plans` skill (TDD bite-sized format) referencing this strategic doc as spec.

**Alternative**: **fast-track Option A** (deferred per current scope) — wait until Phase 3 trigger conditions naturally met. Same outcome, less coordination overhead.

---

## §7. Cross-references

| Resource | Location |
|----------|----------|
| Audit PR (chat0 reduced scope) | [#212](https://github.com/j4xie/my-prototype-logistics/pull/212) |
| CI workflow | `.github/workflows/ci.yml` (lines 33, 64, 91, 98, 115 = the 5 masks) |
| Phase 2A close-out | memory `project_2026_05_09_phase_2a_complete.md` |
| Phase B prod cutover | PR #205 + audit PR #210 |
| Phase C trigger spec | `docs/superpowers/specs/2026-05-15-t6-5-java-smartbi-deprecation-spec.md` §B.4 |
| Active-E2E HARD rule | `feedback_active_e2e_replaces_passive_soak.md` |
| Concurrent edit safety | `feedback_concurrent_edit_safety.md` (Rule 5b paths-only commit) |
| Parallel work analysis | `.claude/rules/parallel-work-analysis.md` |
| TypeScript type safety | `.claude/rules/typescript-type-safety.md` (no `as any`) |
| Python-Java port | `.claude/rules/python-java-port.md` (Phase 2A dict-eq parity standard) |
| No defensive in verify scripts | `feedback_no_defensive_in_verify_scripts.md` |
| Dispatch on technical readiness | `feedback_dispatch_on_technical_readiness.md` |

---

**End of CI green debt cleanup batch plan. Status: ROADMAP — DEFER EXECUTE until trigger conditions met (§3).**
