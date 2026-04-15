# Canvas E2E Manual Gate Guide (Pre-Deploy Checklist)

**Status**: Draft (pending ADR approval — see `docs/plans/canvas-e2e-ci-strategy.md`)
**Date**: 2026-04-15
**Related**: R7 Issue 4 Phase 1 (Option B implementation)

This guide documents when and how to manually run the `canvas-security-e2e` suite before requesting code review or deploying to production. Pairs with the nightly cron (`scripts/ops/nightly-canvas-e2e.sh`) as a defense-in-depth regression gate.

**Team decision needed**: once the ADR is accepted, this guide's content should either:
- A. Be merged into a top-level `CONTRIBUTING.md`, or
- B. Stay as a standalone guide under `docs/plans/`

Pick whichever fits current team doc conventions.

---

## 1. When to run canvas-security-e2e manually

Run the full suite before requesting review on any PR that modifies:

### Sensitive files (MUST run suite)

Backend:
- `backend/java/cretas-api/src/main/java/com/cretas/aims/controller/DynamicFieldController.java`
- `backend/java/cretas-api/src/main/java/com/cretas/aims/controller/BusinessRuleController.java`
- `backend/java/cretas-api/src/main/java/com/cretas/aims/controller/ConfigController.java`
- `backend/java/cretas-api/src/main/java/com/cretas/aims/controller/CanvasAIController.java`
- `backend/java/cretas-api/src/main/java/com/cretas/aims/engine/DynamicFieldService.java`
- `backend/java/cretas-api/src/main/java/com/cretas/aims/engine/DynamicTableService.java`
- `backend/java/cretas-api/src/main/java/com/cretas/aims/engine/DDLExecutor.java`
- `backend/java/cretas-api/src/main/java/com/cretas/aims/engine/AggregateFormulaExecutor.java`
- `backend/java/cretas-api/src/main/java/com/cretas/aims/engine/FormulaEngine.java`
- `backend/java/cretas-api/src/main/java/com/cretas/aims/config/JwtAuthInterceptor.java`
- `backend/java/cretas-api/src/main/java/com/cretas/aims/config/RequireRoleInterceptor.java`

Tests:
- Anything under `tests/canvas-security-e2e/`

Database:
- Any Flyway migration that affects Canvas V3 tables (schema_fields, canvas_dynamic_field, factory_formulas, sub-tables matching `*_items` pattern)

### Optional but recommended (SHOULD run suite)

- Any change to tenant isolation / cross-tenant paths
- Any change to JWT / authentication middleware
- Any new `@Transactional` annotations or removals near Canvas services

### Not required

- Pure frontend changes (Vue, React)
- Python-service-only changes (`backend/python/`)
- Documentation-only PRs
- Test-only changes in `tests/e2e-comprehensive/` (different scope)

---

## 2. How to run

### Prerequisites (one-time setup per dev machine)

```bash
# 1. SSH tunnel to test env (backgrounded)
ssh -L 10011:localhost:10011 -fN root@47.100.235.168

# 2. (Optional) Vite dev server for web-based checks in J2/J3
cd web-admin && npm run dev   # separate terminal, leave running

# 3. Verify test backend is responsive
curl -s http://localhost:10011/api/mobile/health
# Expect: {"status":"UP",...}
```

### Run the suite

```bash
# From repo root
CANVAS_E2E_RUN_ID="preview_$(date +%Y%m%d_%H%M%S)" \
  bash tests/canvas-security-e2e/run-all.sh

# Expected: 95/95 PASS / 0 FAIL / 0 WARN / EXIT 0
```

The runtime is ~3-5 minutes total across 7 journeys. WARN is treated as failure per the E2E skill rules.

### Interpreting results

Each journey writes a `*-results-<RUN_ID>.json` file in `tests/canvas-security-e2e/results/`. Individual test IDs (e.g., `J1-F2`, `J4-9`) are logged in the `tests[]` array with PASS/FAIL/WARN status + evidence.

If any test FAILs:
- **Don't submit the PR for review yet**
- Read `evidence` field of the failing testId
- Check if it's a legitimate regression (touched file X, that broke testId Y) or environment drift (stale token cache, tunnel dropped, etc.)
- If regression: fix the code, re-run
- If env drift: clear `.token-cache.json`, restart tunnel, re-run. If still failing with clean env → treat as regression

---

## 3. What to put in the PR description

After a clean run, add this line to the PR description:

```markdown
## E2E verification

- Canvas-security-e2e: **95/95 PASS** / 0 FAIL / 0 WARN at commit `<short-sha>`
- Run ID: `<CANVAS_E2E_RUN_ID used>`
- Tested via: SSH tunnel to test env 10011 + local Vite dev server 5173
```

This gives reviewers a one-glance check that you ran the suite. They can grep git log for the run ID if they want to verify against the nightly cron results.

---

## 4. What reviewers should look for

If a PR touches the sensitive-file list (§1) and does NOT include the E2E verification line (§3):
- Ask the PR author to run the suite and add the line
- Don't approve until this is done (unless the change is clearly not canvas-related — e.g., the PR touches one of those files but only rewrites a Javadoc comment)

If the PR author says "tested locally, no notable changes", still require the run. Every silent-data-loss bug canvas-security-e2e has caught (R3 `@Transactional`, R4 UUID cast, R6 aggregate formula) was in a "looks routine" PR at the time.

---

## 5. Relationship with nightly cron

The nightly cron (`scripts/ops/nightly-canvas-e2e.sh`) runs the same suite every night against `main`. It's the 24-hour backstop.

Manual run (this doc) protects the **PR-submit → merge → deploy** window. Nightly cron protects the **merged → next-release** window. Both have roles.

If the nightly alert fires:
- Check which commit range was newly merged (use the timestamp in the log file name)
- Identify the PR(s) in that range that touched sensitive files
- The PR that should have run the manual gate but didn't → fix + post-mortem

---

## 6. Failure modes and escape hatches

**E2E infrastructure is down** (SSH tunnel can't connect, test env offline):
- Document in PR: "E2E deferred — test env offline, tracking via <issue link>"
- Request explicit PM+eng approval to merge without run
- Follow up when infra is back

**E2E genuinely broken by the PR, but the PR is the fix for that broken E2E**:
- e.g., test suite itself needs a URL update because an endpoint was renamed
- Document: "E2E: 94/95 PASS, J1-X fail is fixed by this PR — see test delta"
- Reviewer verifies the fix matches the failing test's contract

**Flaky test**:
- If one specific testId is intermittent across 3+ runs with no other changes, open a GitHub Issue tagged `canvas-e2e-flake`
- Don't suppress it — fix the flake (usually a timing issue in the test, not in the code)

---

## 7. Meta: why this gate exists

canvas-security-e2e has caught **3 real P0 silent-data-loss bugs** across R1-R6:
1. R3 (commit `6fe099863`): `setCustomFields` missing `@Transactional` → silent rollback on every direct API PUT
2. R4 (commit `7b23217b0`): sub-table `parent_id` hardcoded UUID → broke CRUD for VARCHAR-id parent tables (e.g., sales_orders)
3. R6 (commit `b878a0472`): `AggregateFormulaExecutor` hardcoded UUID cast → aggregate formulas 500-errored for VARCHAR-id parents

All three bugs existed in production for weeks to months before detection. The depth-first E2E tests caught them on first execution. Without manual gating, a future equivalent bug could re-enter prod via a "looks routine" PR.

The cost of running the suite (5 min) is negligible. The cost of a P0 customer-facing silent-data-loss bug in prod is not.
