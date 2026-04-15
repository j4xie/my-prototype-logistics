# Contributing to Cretas

Internal engineering workflow notes. For full project context see `CLAUDE.md`.

Per-domain rules live under `.claude/rules/` (database / JWT / response-format / deploy / etc.) — read those before the first change to a given subsystem.

---

## Canvas V3 — mandatory E2E gate before merge

The `canvas-security-e2e` suite has caught **4 real P0 silent-data-loss bugs** during R1-R6 (all now in prod):

1. R3: `setCustomFields` missing `@Transactional` → silent rollback under hikari `auto-commit=false`
2. R4: `DynamicTableService.addRow/updateRow/deleteRow` — same `@Transactional` pattern, 3 siblings
3. R4: hardcoded `?::uuid` cast for sub-table `parent_id` broke VARCHAR-id parents (sales_orders)
4. R6: same UUID cast bug in `AggregateFormulaExecutor` — aggregate formulas 500-errored for VARCHAR-id parents

Each existed in production for weeks to months before the depth-first suite caught it. Without manual gating, an equivalent bug could re-enter prod via a "looks routine" PR.

### 1. When to run `canvas-security-e2e` manually

**MUST run** before requesting review on any PR that modifies:

**Backend**:
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

**Tests**: anything under `tests/canvas-security-e2e/`

**Database**: any Flyway migration affecting Canvas V3 tables (`schema_fields`, `canvas_dynamic_field`, `factory_formulas`, sub-tables matching `*_items` pattern)

**SHOULD run** (not required but recommended):
- Any change to tenant isolation / cross-tenant paths
- Any change to JWT / authentication middleware
- Any new `@Transactional` annotations or removals near Canvas services

**NOT required**:
- Pure frontend changes (Vue, React)
- Python-service-only changes (`backend/python/`)
- Documentation-only PRs
- Test-only changes under `tests/e2e-comprehensive/` (different scope)

### 2. How to run

**Prerequisites (one-time per dev machine)**:

```bash
# 1. SSH tunnel to test env
ssh -L 10011:localhost:10011 -fN root@47.100.235.168

# 2. (Optional) Vite dev server for web-based checks in J2/J3
cd web-admin && npm run dev   # separate terminal, leave running

# 3. Verify test backend is responsive
curl -s http://localhost:10011/api/mobile/health
# Expect: {"status":"UP",...}
```

**Run the suite**:

```bash
# From repo root
CANVAS_E2E_RUN_ID="preview_$(date +%Y%m%d_%H%M%S)" \
  bash tests/canvas-security-e2e/run-all.sh

# Expected: 100/100 PASS / 0 FAIL / 0 WARN / EXIT 0
```

Runtime ≈ 3-5 minutes across 7 journeys (J0-J6). **WARN is treated as failure** per the `depth-first-e2e` skill rules.

### 3. What to put in the PR description

After a clean run, add this line:

```markdown
## E2E verification

- Canvas-security-e2e: **100/100 PASS** / 0 FAIL / 0 WARN at commit `<short-sha>`
- Run ID: `<CANVAS_E2E_RUN_ID used>`
- Tested via: SSH tunnel to test env 10011 + local Vite dev server 5173
```

Reviewers can grep git log for the run ID to verify against the nightly cron results.

### 4. What reviewers should look for

If a PR touches the sensitive-file list above and **does NOT include the E2E verification line**:
- Ask the PR author to run the suite and add the line
- Don't approve until done (unless the change is clearly not canvas-related — e.g., Javadoc-only edit to one of those files)

If the PR author says "tested locally, no notable changes", still require the run. Every silent-data-loss bug the suite has caught was in a "looks routine" PR.

### 5. Failure handling

**If any testId FAILs**:
- Do NOT submit for review
- Read `evidence` field of the failing testId (in `tests/canvas-security-e2e/results/`)
- Check if it's a legitimate regression (touched file X, broke testId Y) vs environment drift (stale token cache, tunnel dropped)
- Regression → fix the code, rerun
- Env drift → clear `.token-cache.json`, restart tunnel, rerun. If still failing with clean env → treat as regression

**If E2E infra is down** (SSH tunnel can't connect, test env offline):
- Document in PR: "E2E deferred — test env offline, tracking via <issue link>"
- Request explicit PM+eng approval to merge without run
- Follow up when infra is back

**If the PR itself fixes a broken E2E test**:
- e.g., the suite needs an endpoint-URL update because that endpoint was renamed
- Document: "E2E: 96/97 PASS, J1-X fail is fixed by this PR — see test delta"
- Reviewer verifies the fix matches the failing test's contract

**Flaky test**: if one specific testId is intermittent across 3+ runs with no other changes, open a GitHub Issue tagged `canvas-e2e-flake`. Don't suppress — fix the flake (usually a timing issue in the test, not in the code).

### 6. Defense-in-depth: nightly cron

A nightly cron (`scripts/ops/nightly-canvas-e2e.sh`) runs the same suite every night against `main`. It is the 24-hour backstop.

- Manual run (this section) protects the **PR-submit → merge → deploy** window
- Nightly cron protects the **merged → next-release** window

If the nightly alert fires:
1. Check which commit range was newly merged (use the timestamp in the log file name)
2. Identify the PR(s) in that range that touched sensitive files
3. The PR that should have run the manual gate but didn't → fix + post-mortem

### 7. Related docs

- `docs/plans/canvas-e2e-ci-strategy.md` — the accepted ADR (Option B+C hybrid)
- `scripts/ops/nightly-canvas-e2e.sh` — nightly cron script (needs DevOps install)
- `tests/canvas-security-e2e/EVIDENCE.md` — suite design decisions
- `tests/canvas-security-e2e/GAPS.md` — 3 infra-blocked coverage gaps with unblock paths
- `.claude/skills/depth-first-e2e/SKILL.md` — the framework skill (11 rules)

---

## Other domains

See `.claude/rules/` for per-domain conventions:

- `concurrent-edit-safety.md` — milestone commits for 3+ edits on shared files (the reason deploy scripts aren't mysteriously truncated anymore)
- `api-response-handling.md` — unified `{ success, data, message }` response shape
- `typescript-type-safety.md` — no `as any`, no `catch (error: any)`
- `jwt-token-handling.md` — SecureStore only, never AsyncStorage
- `database-entity-sync.md` — Entity + column name conventions
- `field-naming-convention.md` — camelCase everywhere in Java/JSON/TS, snake_case only in SQL
- `server-operations.md` — deploy rules + systemd unit layout
- `ai-intent-tool-skill-architecture.md` — Tool/Skill wiring for AI intents (IntentHandler is dead, don't re-introduce)
- `python-services-architecture.md` — one Python process on 8083, modular routes under `backend/python/`
- `aliyun-credentials.md` + `CREDENTIAL-MANAGEMENT.md` — server credentials (never commit, never hardcode)
