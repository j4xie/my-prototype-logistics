# 派工 — T6.5 Phase C: 8-chat parallel method-level audit + delete (Decision 4B refined scope)

**Status**: ⛔ HOLD — DRAFT ONLY. Do not execute. Awaiting organizer trigger after Phase B 24h passive monitor + active E2E PASS confirm + Phase B successor green-light.
**Dispatch date**: TBD (target ~mid-July 2026 per spec §C / audit §6.2; may compress per HARD rule `active-E2E-replaces-passive-soak` to ~end of Phase B + 24h soak window).
**Predecessor**: Phase B 23-endpoint stub-out (PR #213 merged + prod cutover live 2026-05-09 23:33 CST + chat4 active E2E 12/12 PASS).
**Author**: organizer T6.5 Phase C dispatch draft (2026-05-09 fresh organizer chat, deferred trigger).
**Successor**: Phase D ongoing schema-write audit (~quarterly post-T6.5).

---

## 0. 必读 context (~25 min)

1. **PR #178 audit v3.1** (the source of scope truth — supersedes PR #150 spec where they conflict):
   - `docs/qa-audits/2026-05-09-t6-5-phase-a-deletion-candidates.md`
   - §3.1.a (22 SAFE_NGINX_ROUTED endpoints stubbed in Phase B) + §3.1.b (`/data-date-range` 23rd Phase B stub on Dashboard)
   - §3.2.a (10 analysis service classes ALL SHARED — wholesale class-file deletion forbidden)
   - §3.5 (`SmartBiQueryTemplateRepository` orphan + companion entity)
   - §6.2 (Phase C method-level audit, NOT file deletion — refined scope)
2. **PR #150 spec** §C.1.1 (Safe to delete) + §C.1.2 (Forbidden HARD KEEP) + §C.1.3 (FinanceAnalysisServiceImpl worked example) + §C.2 (test removal mirrors source) + §C.3 (orphan grep verification):
   - `docs/superpowers/specs/2026-05-15-t6-5-java-smartbi-deprecation-spec.md`
3. **PR #220 cross-PR consistency audit** — Phase C amendment cross-checks across PRs #199/#202/#203/#204:
   - `docs/qa-audits/2026-05-09-t6-6-cross-pr-consistency.md` (relevant Phase C sections)
4. **Phase B impl PR** (PR #213) — stub bodies that Sub-A is the inverse of; treat as "what Phase B left in place" baseline.
5. **Memory** (read before any push / deploy / Java code delete):
   - `feedback_pause_before_deploy_or_push.md` — STOP-and-ping organizer before deploy or push
   - `feedback_concurrent_edit_safety.md` — Rule 5b safe-commit `git commit -- F1 F2 ...` paths-only mode
   - `reference_blue_green_java_deploy.md` — Java prod default Blue-Green via 10010↔10020 nginx upstream switch
   - `feedback_active_e2e_replaces_passive_soak.md` — pre-customer-return state, no passive soak; active Playwright/curl probe is the verification
   - `feedback_dispatch_on_technical_readiness.md` — fire on technical readiness, not inherited timing anchors
   - `feedback_no_defensive_in_verify_scripts.md` — Phase C grep / verify scripts must let exceptions bubble; no try/except fallback masking real failures
   - `feedback_30s_precheck_selective_bug_pattern.md` — if compile fails on a specific factory cohort or service, grep factory_id literals + env flags FIRST (~30 sec)
   - `feedback_marching_order_method_name_grep.md` — every method name in this MO must be `grep`-verified against actual `*ServiceImpl.java` source before action; do not trust paraphrased names
   - `feedback_audit_endpoint_impl_not_router.md` — "method removed" verification must check every call-site in main + test, not just controller file

---

## ⛔ Pre-flight gates (organizer responsibility — verify BEFORE dispatching this MO)

- [ ] **Phase B prod cutover live ≥24h** with passive monitor green (no 5xx spike on `/api/mobile/*/smart-bi/*` paths; 410 rate matches expected stub-out volume only).
- [ ] **Active E2E PASS confirmed** (chat4 PR #213 followup or organizer-rerun) — frontend gracefully handles 410 across all 23 stubbed endpoints + alive Java fallthrough paths still serve.
- [ ] **No P1 customer reports** open against any SmartBI controller path (Analysis / Dashboard / Config / Upload / PublicDemo).
- [ ] **F999 internal team confirmed accept Option A behavior** (per Phase B comms; Phase C does not change F999 contract — 410 already in effect post-Phase-B).
- [ ] **PR #150 spec amend (Decision 4B)** merged so §C.1.1 + §C.1.2 + §C.1.3 are the authoritative scope.
- [ ] **PR #178 audit v3.1** merged.
- [ ] No competing T6.5/T6.6 PRs in flight that touch `controller/SmartBI*.java` or `service/smartbi/impl/*AnalysisServiceImpl.java` — concurrent edit safety check (memory rule).

If any gate not green → **STOP, do not dispatch**. Ping Steve.

---

## 1. Scope summary (Decision 4B refined)

| Sub-batch | Owner | Scope | Estimated effort |
|---|---|---|---|
| **Sub-A** | chat-A | 23 controller endpoint method body delete (inverse of Phase B PR #213 stubs) | ~0.5 day |
| **Sub-B** | chat-B | `SalesAnalysisServiceImpl` method-level audit + delete | ~1 day |
| **Sub-C** | chat-C | `DepartmentAnalysisServiceImpl` method-level audit + delete | ~1 day |
| **Sub-D** | chat-D | `RegionAnalysisServiceImpl` method-level audit + delete | ~1 day |
| **Sub-E** | chat-E | `FinanceAnalysisServiceImpl` method-level audit + delete (worked example per spec §C.1.3) | ~1 day |
| **Sub-F** | chat-F | `ProductionAnalysisServiceImpl` method-level audit + delete (mostly NOT_SAFE_FALLTHROUGH — expect tiny removable surface) | ~0.5 day |
| **Sub-G** | chat-G | `QualityAnalysisServiceImpl` method-level audit + delete (mostly NOT_SAFE_FALLTHROUGH — expect tiny removable surface) | ~0.5 day |
| **Sub-H** | chat-H | `InventoryHealthAnalysisServiceImpl` method-level audit + delete | ~1 day |
| **Sub-I** | chat-I | `ProcurementAnalysisServiceImpl` method-level audit + delete | ~1 day |
| **Sub-J** | chat-J | `SmartBiQueryTemplateRepository.java` orphan delete + repo Test file | ~0.25 day |
| **Sub-K** | chat-K | `SmartBiQueryTemplate.java` companion entity delete (Phase C grep verify) | ~0.25 day |

**Total**: ~9 person-days serialized; ~1-2 days wall-clock with 8 chats parallel.

**HARD KEEP (do not touch in Phase C)** per spec §C.1.2:
- Controller files themselves (`SmartBIAnalysisController.java`, `SmartBIDashboardController.java`) — keep class structure for NOT_SAFE_FALLTHROUGH + KEEP_FOR_COMPOSITE_DASHBOARD methods.
- `DynamicAnalysisServiceImpl` (alive — `/query` + `/drill-down` NOT_SAFE_FALLTHROUGH + Dashboard `/analysis/dynamic` + Upload).
- `RecommendationServiceImpl` (Dashboard + PublicDemo composite).
- All entity recognizers, chart sub-package, intent service ecosystem, IncentiveRule/AlertThreshold/ChartTemplate services, Excel/Schema services, Gold layer, all DTOs, all entities except `SmartBiQueryTemplate`, all repos except `SmartBiQueryTemplateRepository`.

---

## 2. Cross-cutting per-sub-batch protocol

Every sub-batch (A through K) follows this exact protocol. **No deviations without organizer approval.**

### 2.1 Step 0 — Worktree + base sync

```bash
git fetch origin
git worktree add .worktrees/t6-5-phase-c-sub-<X> -b ops-t6-5-phase-c-sub-<X> origin/main
cd .worktrees/t6-5-phase-c-sub-<X>
git log --oneline -1                  # MUST be at origin/main HEAD; verify base contains Phase B PR #213 merge commit
```

**Concurrent edit safety**: each sub-batch gets its own worktree — physical isolation per memory rule §2. **Never share a worktree across sub-batches.**

### 2.2 Pre-flight build gate (run BEFORE any edits)

```bash
cd backend/java/cretas-api
mvn clean compile -DskipTests          # MUST pass — establishes pre-edit baseline
mvn clean test -DskipTests=false       # MUST pass — record green test count
```

Record baseline test count + log it in PR description. If pre-flight fails on origin/main HEAD, **STOP and ping organizer** — base is broken, do not proceed (do not "fix" unrelated breakage in this PR).

### 2.3 Method-level grep audit (Sub-B through Sub-I only)

Per spec §C.1.3 worked example. For your assigned `*AnalysisServiceImpl.java`:

```bash
# 1. Enumerate public methods (verified against actual source — do not paraphrase)
SVC=backend/java/cretas-api/src/main/java/com/cretas/aims/service/smartbi/impl/<YourServiceImpl>.java
grep -nE "^\s*(public|@Override\s+public)" "$SVC"

# 2. For each public method, grep callers in OUT-OF-SCOPE controllers (KEEP'd controllers)
for method in <list-from-step-1>; do
    echo "=== $method ==="
    grep -rnE "\.${method}\(" backend/java/cretas-api/src/main/java/com/cretas/aims/controller/ \
        --include="SmartBIDashboardController.java" \
        --include="SmartBIPublicDemoController.java" \
        --include="SmartBIUploadController.java" \
        --include="SmartBIConfigController.java"
done

# 3. Also grep entire main-source tree to catch any non-controller caller
for method in <list-from-step-1>; do
    hits=$(grep -rnE "\.${method}\(" backend/java/cretas-api/src/main/java/ \
           | grep -v "service/smartbi/impl/<YourServiceImpl>.java" | wc -l)
    echo "$method: $hits external caller(s)"
done

# 4. Verify against test files (do they cover this method?)
for method in <list-from-step-1>; do
    test_hits=$(grep -rnE "\.${method}\(" backend/java/cretas-api/src/test/java/ | wc -l)
    echo "$method: $test_hits test reference(s)"
done
```

**Classification rule** (per spec §C.1.3 step 3):
- 0 callers in KEEP'd controllers AND 0 external callers in main-source → **method dead, removable**
- ≥1 caller in any KEEP'd controller OR external main-source caller → **method stays**

**Output**: produce a `phase-c-sub-<X>-audit.md` artifact in your worktree at `docs/qa-audits/2026-XX-XX-t6-5-phase-c-sub-<X>-audit.md` listing every public method + its caller count + classification + decision. **Commit this audit doc as the FIRST commit of your PR** (separate from the source-delete commit).

### 2.4 ⛔ STOP-and-ping organizer (Steve) BEFORE any Java code delete

After Sub-B-I audit doc is committed — **STOP**. Do NOT delete any methods yet. Push the audit-only commit, open a draft PR with title `audit(t6-5-phase-c-sub-<X>): <ServiceImpl> method-level inventory`, and ping organizer in the dispatch thread. Wait for explicit GO before proceeding to Step 2.5.

For Sub-A / Sub-J / Sub-K (no method-level audit), STOP-and-ping is still required after the file/method-body removal commit is staged but BEFORE push.

**Rationale**: Phase C is irreversible per spec §2.3 ("Java code removal — irreversible"). Method removal in shared service classes risks compile breakage in OUT-OF-SCOPE controllers. Organizer review of the audit + classification is the gate that catches misclassification before the deletion lands.

### 2.5 Source-level removal (after organizer GO)

Per your audit's classification:
- **Sub-A**: Delete the 23 controller method bodies wholesale. Keep imports / class skeleton / `@RestController` annotation. Verify Phase B stub structure is the inverse of what you're removing (`return ResponseEntity.status(HttpStatus.GONE)...` blocks → gone).
- **Sub-B-I**: Delete each method classified "removable", plus its private helpers (chase down `private` methods called only by the now-deleted public method — grep within same file). Class file stays.
- **Sub-J**: Delete `repository/smartbi/SmartBiQueryTemplateRepository.java` + `SmartBiQueryTemplateRepositoryTest.java` (entire test file per spec §C.2).
- **Sub-K**: Delete `entity/smartbi/SmartBiQueryTemplate.java`. Re-verify zero non-self callers per spec §C.3 step 4 immediately before delete.

Also remove the corresponding test methods (mirroring rule per spec §C.2): if you removed `getFooThing()` in `<YourServiceImpl>.java`, remove `@Test void testGetFooThing()` (and any helpers it owns) in `<YourServiceImpl>Test.java`. Test class file stays.

### 2.6 Post-edit verification gate

```bash
cd backend/java/cretas-api
mvn clean compile -DskipTests          # MUST pass
mvn clean test -DskipTests=false       # MUST pass; remaining test count ≥ pre-flight baseline minus removed tests
mvn clean package -DskipTests          # MUST produce aims-0.0.1-SNAPSHOT.jar

# Method-level orphan grep — sanity re-verify post-removal (catches half-deleted state)
for method in <removed-method-list>; do
    hits=$(grep -rnE "\.${method}\(" backend/java/cretas-api/src/main/java/ | wc -l)
    [ "$hits" -eq 0 ] || { echo "FAIL: $method still has $hits caller(s)"; exit 1; }
done
```

If any check fails → revert local changes, do NOT push. Re-audit. Ping organizer.

### 2.7 Safe-commit (memory rule §5b)

```bash
git status --short                     # MUST show only your sub-batch's files in staged + dirty
# Only commit explicit paths — paths-only mode prevents husky/lint-staged from sweeping concurrent-session files
./scripts/safe-commit.sh "feat(t6-5-phase-c-sub-<X>): <ServiceImpl> method-level removal (N methods, M tests)" \
    backend/java/cretas-api/src/main/java/com/cretas/aims/service/smartbi/impl/<YourServiceImpl>.java \
    backend/java/cretas-api/src/test/java/com/cretas/aims/service/smartbi/impl/<YourServiceImpl>Test.java \
    docs/qa-audits/2026-XX-XX-t6-5-phase-c-sub-<X>-audit.md

# Post-commit verify
git show --name-only HEAD              # MUST equal exactly the paths you listed; flag if husky added anything
```

### 2.8 ⛔ STOP-and-ping organizer BEFORE git push

Per memory `feedback_pause_before_deploy_or_push.md` — Steve uses multi-worktree / multi-chat. Push without ping risks colliding with concurrent worktree merges Steve hasn't sequenced yet.

```
ORGANIZER PING TEMPLATE:
> Sub-<X> Phase C ready to push. Audit doc + source removal commits staged on branch ops-t6-5-phase-c-sub-<X>.
> Diff: <git diff --stat HEAD~2..HEAD>
> Removed: N public methods + M test methods + P private helpers
> Compile + tests: PASS (N→N-M tests green)
> Awaiting GO to push + open PR.
```

### 2.9 Push + open PR (after organizer GO)

```bash
git push -u origin ops-t6-5-phase-c-sub-<X>
gh pr create --title "feat(t6-5-phase-c-sub-<X>): <ServiceImpl> method-level removal" --body "$(cat <<'EOF'
## Summary

Phase C method-level removal for `<YourServiceImpl>` per spec §C.1.3 + audit §3.2.a.

- N public methods removed (zero callers in KEEP'd controllers post-Phase-B)
- M test methods removed (mirroring §C.2)
- P private helpers chased down + removed (single-caller, dead post-removal)

Audit doc: `docs/qa-audits/2026-XX-XX-t6-5-phase-c-sub-<X>-audit.md`

## Verification

- Pre-flight: mvn clean compile + test PASS at base origin/main
- Post-edit: mvn clean compile + test + package PASS; method-orphan grep returns 0 callers per removed method
- Test count: <pre> → <post> (delta = M removed)

## Predecessors

- PR #150 (T6.5 spec, Decision 4B amend)
- PR #178 (Phase A audit v3.1)
- PR #213 (Phase B 23-endpoint stub)

## Test plan

- [ ] Reviewer spot-checks 3 removed methods via `grep -rnE "\.<method>\(" backend/java/cretas-api/src/main/java/` → expect 0 hits
- [ ] Reviewer verifies HARD KEEP list (spec §C.1.2) untouched: controller files, alive service impls, Gold layer, etc.
- [ ] Reviewer confirms audit doc methodology matches spec §C.1.3
- [ ] Steve approves before admin merge

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

### 2.10 ⛔ Blue-Green prod deploy is ORGANIZER-OWNED, not sub-batch-owned

**Sub-batches do NOT deploy.** After all 11 sub-batch PRs merge to `main`, organizer dispatches a single follow-up Blue-Green prod deploy via `./scripts/deploy/deploy-backend.sh --env prod` (default Blue-Green per memory `reference_blue_green_java_deploy.md`).

If a sub-batch chat tries to deploy → **STOP, ping Steve**. Phase C deploy needs all 11 sub-batches green-merged + cross-batch compile sanity (organizer-side `mvn clean package -DskipTests` on origin/main HEAD post all merges) before any prod cutover. Per spec §B.4 GO criteria + Phase B blue-green pattern.

---

## 3. Per-sub-batch specifics

### Sub-A — 23 controller method body delete (chat-A)

**Files**:
- `backend/java/cretas-api/src/main/java/com/cretas/aims/controller/SmartBIAnalysisController.java` (22 method bodies)
- `backend/java/cretas-api/src/main/java/com/cretas/aims/controller/SmartBIDashboardController.java` (1 method body — `getDataDateRange` only; other 10 endpoints HARD KEEP per spec §C.1.2)

**Method names to delete** (per audit §3.1.a + §3.1.b — `grep`-verified against actual source per memory `feedback_marching_order_method_name_grep.md`):

SmartBIAnalysisController (22):
```
getSalesAnalysis, getDepartmentAnalysis, getRegionAnalysis,
getFinanceAnalysis, getBudgetAchievementChart, getYoYMoMComparisonChart, getCategoryStructureComparisonChart,
getInventoryAnalysis, getProcurementAnalysis,
getAlerts, getRecommendations, getIncentivePlan,
uploadAndDetectSchema, previewSchemaChanges, applySchemaChanges,
listDatasources, getDatasourceFields, getSchemaHistory,
getQueryTemplates, createQueryTemplate, updateQueryTemplate, deleteQueryTemplate
```

SmartBIDashboardController (1):
```
getDataDateRange
```

**HARD KEEP method bodies** (NOT_SAFE_FALLTHROUGH — these stay alive Java code):
```
getProductionAnalysis, getQualityAnalysis, query, drillDown
```

**Action**: Per protocol §2.1-§2.9. Sub-A skips §2.3 method-level grep (controller endpoint methods are by definition the call sites — Phase B already validated they're nginx-routed to Python). Sub-A directly deletes the 23 method bodies + their `@*Mapping` annotations + any private helpers exclusive to them.

**Test removal**: Per spec §C.2 — `SmartBIDashboardControllerTest.java` keeps file, removes only `getDataDateRange` test method. `SmartBIAnalysisControllerTest.java` does NOT exist in the repo (verified per Phase B MO §0 footnote). Skip controller-test work.

**Sub-A is the only sub-batch that requires immediate organizer approval before push** (irreversible removal of public API surface — even though Phase B has stubbed them to 410, removing the method itself ends the route registration entirely).

### Sub-B — `SalesAnalysisServiceImpl` (chat-B)

Apply protocol §2.3 method-level grep on `service/smartbi/impl/SalesAnalysisServiceImpl.java`. Expected callers in KEEP'd controllers:
- `SmartBIDashboardController` — `/dashboard/executive*`
- `SmartBIPublicDemoController` — composite endpoints

Methods that ONLY served `getSalesAnalysis` on the now-stubbed controller → removable.

### Sub-C — `DepartmentAnalysisServiceImpl` (chat-C)

Same protocol. Expected callers in `SmartBIDashboardController` + `SmartBIPublicDemoController`.

### Sub-D — `RegionAnalysisServiceImpl` (chat-D)

Same protocol. Expected callers in `SmartBIDashboardController` + `SmartBIPublicDemoController`.

### Sub-E — `FinanceAnalysisServiceImpl` (chat-E) — worked example per spec §C.1.3

Same protocol. Spec §C.1.3 walks through this service in detail — read it before starting. Expected callers: `SmartBIDashboardController` (executive composite, Gold-layer chain) + `SmartBIPublicDemoController` + `GoldDashboardBuilder` (KEEP per spec §C.1.2). The Gold-layer chain means `getFinanceOverview`-style methods may stay even when Phase B has stubbed `/analysis/finance` directly.

### Sub-F — `ProductionAnalysisServiceImpl` (chat-F) — minimal scope expected

`/analysis/production` is NOT_SAFE_FALLTHROUGH per audit §3.1.a — the controller method body STAYS. So `ProductionAnalysisServiceImpl` is HARD KEEP for the `getProductionAnalysis` method. Only candidate Phase C removals are private helpers or unused public methods that Phase B stubs *might* have orphaned (likely 0). Run protocol §2.3 — if audit shows 0 removable methods, ship a doc-only PR with `audit(t6-5-phase-c-sub-F): ProductionAnalysisServiceImpl 0 removable methods` and close.

### Sub-G — `QualityAnalysisServiceImpl` (chat-G) — minimal scope expected

Same as Sub-F — `/analysis/quality` is NOT_SAFE_FALLTHROUGH. Likely 0 removable. Ship audit doc only if so.

### Sub-H — `InventoryHealthAnalysisServiceImpl` (chat-H)

Same protocol. Expected callers in `SmartBIDashboardController` only (per audit §3.2.a — no PublicDemo / Upload coupling).

### Sub-I — `ProcurementAnalysisServiceImpl` (chat-I)

Same protocol. Expected callers in `SmartBIDashboardController` only.

### Sub-J — `SmartBiQueryTemplateRepository` orphan delete (chat-J)

**Files**:
- `backend/java/cretas-api/src/main/java/com/cretas/aims/repository/smartbi/SmartBiQueryTemplateRepository.java`
- `backend/java/cretas-api/src/test/java/com/cretas/aims/repository/smartbi/SmartBiQueryTemplateRepositoryTest.java` (entire file, per spec §C.2)

**Pre-delete verification** (spec §C.3 step 3):
```bash
grep -rnE "SmartBiQueryTemplateRepository" backend/java/cretas-api/src/main/java/ | \
  grep -v "repository/smartbi/SmartBiQueryTemplateRepository.java" | \
  grep -v "controller/SmartBIAnalysisController.java"
```
Expected: 0 lines (the 4 controller method bodies referencing this repo were removed by Sub-A — so Sub-J ships AFTER Sub-A merges). **Sub-J has dependency on Sub-A — do not start until Sub-A merged.**

If non-zero → STOP, investigate per memory `feedback_30s_precheck_selective_bug_pattern.md`.

### Sub-K — `SmartBiQueryTemplate` companion entity delete (chat-K)

**Files**:
- `backend/java/cretas-api/src/main/java/com/cretas/aims/entity/smartbi/SmartBiQueryTemplate.java`
- Companion test if exists (verify via `find backend/java/cretas-api/src/test -name 'SmartBiQueryTemplate*Test*.java'`)

**Pre-delete verification** (spec §C.3 step 4):
```bash
grep -rnE "SmartBiQueryTemplate[^a-zA-Z]" backend/java/cretas-api/src/main/java/ | \
  grep -v "entity/smartbi/SmartBiQueryTemplate.java" | \
  grep -v "repository/smartbi/SmartBiQueryTemplateRepository.java"
```
Expected: 0 lines. **Sub-K depends on Sub-J merging first** (entity has 1 known consumer = the repo Sub-J deletes).

If non-zero (e.g. another JPA reference, DTO mapping, or service injection) → STOP, do NOT delete entity. Re-audit + ping organizer.

---

## 4. Dispatch sequencing

```
Pre-flight gates green
    ↓
Dispatch Sub-A + Sub-B + Sub-C + Sub-D + Sub-E + Sub-F + Sub-G + Sub-H + Sub-I in parallel (9 chats, 8+ active)
    ↓
All 9 audit docs reviewed by organizer (parallel)
    ↓
Per-sub-batch GO from organizer → source delete → STOP-and-ping → push → PR open
    ↓
All 9 PRs reviewed + admin-merged (organizer)
    ↓
Cross-batch compile sanity: mvn clean package -DskipTests on origin/main HEAD (organizer-side)
    ↓
Dispatch Sub-J (depends on Sub-A merged)
    ↓
Sub-J PR merged
    ↓
Dispatch Sub-K (depends on Sub-J merged)
    ↓
Sub-K PR merged
    ↓
Cross-batch final compile + test sanity (organizer-side)
    ↓
Blue-Green prod deploy (organizer-owned) → 24h passive monitor + active E2E
    ↓
Phase C complete → Phase D ongoing
```

---

## 5. Open questions for organizer (resolve before dispatch)

1. **Cohort batch vs serialized**: dispatch all 9 (Sub-A through Sub-I) parallel as documented, OR serialize Sub-B/C/D/E/F/G/H/I behind Sub-A merge so each sub-batch sees a clean post-stub-removal source tree? Recommendation: parallel — independent service files, no cross-file edit collision.
2. **Sub-A scope**: do we ALSO want to remove the Phase B-stubbed `@RestController` method declarations entirely (current draft says yes), OR leave declarations + remove only bodies (keeping route registration as a deliberate 410 stub)? Recommendation: remove entirely per spec §C.1.1 ("delete the @*Mapping methods themselves, not the controller files").
3. **Audit doc storage**: 9 separate `phase-c-sub-<X>-audit.md` files in `docs/qa-audits/`, OR one merged `phase-c-method-level-audit.md` Steve writes after all 9 land? Recommendation: per-sub-batch audit doc — sub-batch PR contains its own audit, organizer can synthesize a Phase C close-out memo later.
4. **Sub-F / Sub-G expected-empty audit**: if these find 0 removable methods, do they still ship a PR with audit-doc-only, OR just post audit findings in the dispatch thread without a PR? Recommendation: ship audit-only PR (creates artifact in `docs/qa-audits/` for traceability + reviewer signoff).

---

## 6. ⛔ HOLD INSTRUCTIONS

This document is a **DRAFT MARCHING ORDER**. Do NOT:
- Touch any Java source code
- Run any deploy script
- Push branches to origin (other than the dispatch doc itself per Step 7 below)
- Create any sub-batch chats / worktrees

Until organizer (Steve) explicitly says "GO Phase C dispatch".

---

## 7. Dispatch doc finalization (this PR — what THIS chat does)

This chat (the MO drafter) does **only** the following:

```bash
# Already in worktree .worktrees/t6-5-phase-c-mo-draft (per Step 0 above)
git status --short                      # confirm only this dispatch file is staged/dirty
./scripts/safe-commit.sh "docs(t6-5-phase-c): 8-chat parallel method-level audit + delete marching order draft" \
    docs/superpowers/dispatch/2026-05-15-t6-5-phase-c-method-level-audit-marching-order.md
git push -u origin ops-t6-5-phase-c-mo-draft

gh pr create --title "docs(t6-5-phase-c): method-level audit + delete marching order draft (8-chat parallel, HOLD)" --body "$(cat <<'EOF'
## Summary

Drafts the T6.5 Phase C marching order per Decision 4B refined scope (PR #178 audit §6.2 + PR #150 spec §C.1.1/§C.1.2/§C.1.3).

11 sub-batches (8+ chats parallel):
- Sub-A: 23 controller method body delete
- Sub-B through Sub-I: 8 chats × 1 *AnalysisServiceImpl method-level audit + delete
- Sub-J: SmartBiQueryTemplateRepository orphan delete
- Sub-K: SmartBiQueryTemplate companion entity delete

Each sub-batch enforces: pre-flight build gate, per-method grep verify, safe-commit Rule 5b paths-only mode, STOP-and-ping organizer BEFORE Java code delete, BG prod deploy organizer-owned (not sub-batch-owned).

## Status

⛔ **DRAFT / HOLD** — Do not execute. Awaiting organizer trigger after:
- Phase B prod cutover ≥24h passive monitor green
- Active E2E PASS confirmed
- Pre-flight gates §⛔ all green

## Predecessors

- PR #178 (Phase A audit v3.1)
- PR #150 spec amend (Decision 4B)
- PR #213 (Phase B 23-endpoint stub) — must merge + soak before this MO fires

## Test plan

- [ ] Organizer reviews scope vs audit §6.2 + spec §C.1.1
- [ ] Organizer resolves §5 open questions
- [ ] Organizer confirms HARD KEEP list (spec §C.1.2) is fully reflected in §1 + per-sub-batch sections
- [ ] Steve approves before any sub-batch dispatch fires

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

After PR opens — ping organizer for admin-merge. **Do not deploy. Do not start any sub-batch chat from this session.**

---

**End of T6.5 Phase C marching order DRAFT.**
