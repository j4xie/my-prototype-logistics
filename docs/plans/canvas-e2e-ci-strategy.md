# ADR: canvas-security-e2e CI Integration Strategy

**Date**: 2026-04-15
**Status**: Proposed
**Deciders**: Engineering lead + DevOps (pending approval)
**Related**: R7 Issue 4 (Rule 10.5 of `depth-first-e2e` skill)

---

## 1. Context

`tests/canvas-security-e2e/` is a 95-assertion depth-first E2E security suite covering Canvas V3 (dynamic fields, sub-tables, cross-tenant isolation, AI prompt injection, cron DDoS, RBAC).

Across R1-R6 + R7 work it has caught **3 real P0 silent-data-loss / schema bugs** that would not have been found by any other layer (R3 `@Transactional` missing, R4 UUID cast, R6 aggregate formula UUID cast).

**Current run mechanism (manual)**:
```bash
# 1. SSH tunnel to test env (manual, per-machine)
ssh -L 10011:localhost:10011 -fN root@47.100.235.168

# 2. Vite dev server for web checks (optional, default localhost:5173)
cd web-admin && npm run dev

# 3. Run
CANVAS_E2E_RUN_ID=<id> bash tests/canvas-security-e2e/run-all.sh
```

**Prerequisites**:
- Test factory seed data (F001, F002, F006 with specific role matrix)
- 10011 Java backend active
- 8084 Python service active (for AI journey J6)
- Network access from runner → test server (10011 via tunnel)
- Test accounts in DB (matched to `canvas-test-helpers.mjs` constants)

**Frequency today**: whenever a developer remembers / before a release.

**Recent trend**: framework has been upgraded significantly (Rule 8 same-cause sweep, Rule 9 independent Critic, Rule 10 delivery plan), but CI integration has lagged. Delivery is manual, regression protection relies on human memory.

---

## 2. Problem

Between manual runs, any regression in code that the E2E suite would catch goes undetected. Canvas V3 is actively evolving (R1-R7 alone modified ~5 backend files + introduced ~20 deep tests). The longer the gap between runs, the larger the blast radius when a regression finally surfaces.

The R3 canvas incident is instructive: the bug (missing `@Transactional`) existed for **months** before depth-first testing caught it. In that window, any dev could have touched the code and introduced a secondary regression that would have stacked on top. Without CI enforcement, the suite is a reactive lagging indicator, not a preventive guard.

---

## 3. Decision drivers

| Driver | Weight |
|---|---|
| Catch regressions between manual runs | HIGH |
| Low operational overhead (no 24/7 CI babysitting) | HIGH |
| Security / secrets management (prod test accounts) | HIGH |
| Infrastructure simplicity (avoid SSH tunnel mgmt in runners) | MEDIUM |
| Run cost (compute, minutes) | LOW |
| Flakiness tolerance (E2E inherently flaky) | MEDIUM |

---

## 4. Options considered

### Option A — Full CI integration per PR

**Shape**:
- GitHub Actions workflow on every PR to `main`
- Runner establishes SSH tunnel to test env (via secrets)
- Runs full canvas-security-e2e suite
- Blocks merge on failure

**Pros**:
- Every PR gets automatic regression check
- Zero gap between manual runs — CI is the manual run
- Strongest quality guarantee

**Cons**:
- **SSH secrets in GitHub runners**: storing a test-env SSH key as a GitHub Actions secret has security implications (key has root access; if leaked, prod at risk via 47.100.235.168)
- **Network setup complexity**: SSH tunnel establishment is flaky in CI contexts (hanging connections, timeout tuning)
- **Test env contention**: if multiple PRs run in parallel, they compete for the same test DB state. Phase F/G/H / I create test formulas + sub-table rows that would cross-pollute runs
- **Cost**: ~10 min E2E × every PR commit = significant runner minutes, slows iteration
- **Implementation time**: 2-3 days to design + debug

### Option B — Backend unit tests in CI only, E2E manual pre-deploy

**Shape**:
- Existing JUnit / Spring Boot tests run in CI on every PR (may already exist)
- canvas-security-e2e explicitly documented as "manual pre-deploy gate" in CONTRIBUTING.md
- Developer runs E2E locally before requesting review or merging

**Pros**:
- Zero new CI infra
- No SSH secrets in runners
- No test-env contention
- Human owns the final "is this ready" decision

**Cons**:
- **Relies on developer discipline**: easy to forget, especially for small patches
- Same problem this ADR is trying to solve (regression window between manual runs) remains

### Option C — Scheduled nightly E2E on test server

**Shape**:
- Cron job on 47.100.235.168 itself (no runner-to-server network hop needed)
- Runs `bash tests/canvas-security-e2e/run-all.sh` at 02:00 CST daily
- Results posted to Slack channel / email if any FAIL/WARN
- Test data: reset seed data at start of run, or use SUFFIX-scoped test data (current pattern)

**Pros**:
- Catches any regression within 24h
- No runner-to-test-env network bridging (runs on the test server itself)
- No SSH secrets in runners (cron job uses local service account)
- Single sequential run = no contention issues
- Full suite runs in clean state every night

**Cons**:
- 24h feedback lag (vs. PR-level feedback in Option A)
- Test server needs to stay healthy (but it already runs test env 10011 24/7)
- Cron requires ops ownership — who fixes it when it breaks?
- Notification channel needs maintenance (Slack webhook, email, etc.)

---

## 5. Decision

**Option B + C hybrid** — with C as the active regression monitor and B as the human gate.

### Concretely:

1. **B (Manual pre-deploy)**:
   - Update `CONTRIBUTING.md` to require manual canvas-security-e2e run before requesting review on any PR that touches:
     - `backend/.../controller/DynamicFieldController.java`
     - `backend/.../engine/DynamicFieldService.java`
     - `backend/.../engine/DynamicTableService.java`
     - `backend/.../engine/AggregateFormulaExecutor.java`
     - `backend/.../engine/DDLExecutor.java`
     - `backend/.../controller/BusinessRuleController.java`
     - Any file under `tests/canvas-security-e2e/`
   - PR description must include "E2E: X/X PASS at commit abc1234" line
   - Self-enforced, but reviewers can ask for it explicitly

2. **C (Scheduled nightly)**:
   - Add cron job on 47.100.235.168: `02:00 CST daily → run canvas-security-e2e → post result`
   - Initial implementation: simple bash wrapper that pipes results to a file + curls a Slack webhook on FAIL/WARN
   - Owner: DevOps (with engineering backup)
   - Failure playbook: Slack alert → engineer on-call reviews results JSON → opens a GH Issue if real regression (vs. env flake)

3. **NOT Option A** (rejected):
   - Too much infra for current team size
   - Security overhead outweighs benefit given Option C catches regressions within 24h
   - Can be reconsidered if the codebase grows such that "24h gap" becomes unacceptable (e.g., multi-deploy-per-day cadence)

---

## 6. Consequences

**Positive**:
- Regression protection within 24h (Option C) — acceptable for Canvas V3's current deploy cadence (weekly-ish)
- Low infra lift: cron job is ~30 lines of bash
- No new secrets to manage
- Manual pre-deploy gate (B) catches obvious regressions before they reach nightly run

**Negative**:
- If a PR merges at 03:00 and introduces a regression, users might hit it before 02:00 the next night (23-hour window). Mitigation: B's pre-deploy gate should prevent this for the "sensitive files" list.
- Option B relies on developer discipline. First incident with a skipped pre-deploy run may prompt tightening to pre-commit hook or CODEOWNERS gate.

**Reversibility**:
- Option C cron can be disabled in 1 minute
- Option A can be added on top of B+C if future needs demand per-PR enforcement
- No lock-in

---

## 7. Implementation plan

### Phase 1: Option B documentation (no code change)

- Update `CONTRIBUTING.md` with canvas-security-e2e pre-deploy rules
- Draft the "sensitive files" regex for reviewer reference
- Owner: **Engineering** (Claude can draft CONTRIBUTING.md patch)
- Timeline: 1 hour

### Phase 2: Option C cron job

- Write `scripts/ops/nightly-canvas-e2e.sh`:
  ```bash
  #!/usr/bin/env bash
  set -euo pipefail
  LOG_DIR=/var/log/cretas-nightly-canvas-e2e
  TIMESTAMP=$(date +%Y%m%d_%H%M%S)
  mkdir -p "$LOG_DIR"

  cd /www/wwwroot/cretas/code
  git pull --rebase
  cd tests/canvas-security-e2e

  CANVAS_E2E_RUN_ID=nightly_$TIMESTAMP \
  E2E_API_BASE=http://localhost:10011/api/mobile \
  E2E_WEB_URL=http://localhost:5173 \
    bash run-all.sh > "$LOG_DIR/$TIMESTAMP.log" 2>&1
  EXIT=$?

  if [ "$EXIT" -ne 0 ]; then
    # Extract summary + post to Slack
    TAIL=$(tail -30 "$LOG_DIR/$TIMESTAMP.log")
    curl -X POST "$SLACK_WEBHOOK_URL" \
      -H 'Content-Type: application/json' \
      -d "{\"text\":\"Canvas E2E FAILED at $TIMESTAMP: \\n\`\`\`$TAIL\`\`\`\"}"
  fi
  exit $EXIT
  ```
- Install crontab: `0 18 * * * /opt/cretas/scripts/ops/nightly-canvas-e2e.sh` (18:00 UTC = 02:00 CST next day)
- Seed data: rely on SUFFIX-scoped test data (current pattern) — each nightly run creates fresh sub-tables / records, nothing to reset
- Log rotation: keep 30 days of nightly logs in `/var/log/cretas-nightly-canvas-e2e/`
- Owner: **DevOps** (Claude can write the script draft, DevOps owns cron + Slack secret)
- Timeline: 1 day (write + test + install + verify notification)

### Phase 3: Dashboard (optional, later)

- Not in R7 scope
- If nightly alerts become noisy, consider a dashboard with historical pass rate
- Punt to future round when data volume justifies it

---

## 8. Open questions

- **Who gets the Slack alert**? Proposed: #cretas-eng channel, with @oncall tag on FAIL
- **How do we distinguish test-env flakes from real regressions**? Proposal: nightly run retries once on failure; only alert if second run also fails
- **Does Python service (8084) need to be healthy for J6**? Yes — nightly job should health-check dependencies before run, alert if deps down (to avoid false-positive "E2E failed")
- **Branch**: should nightly pull latest `main` only, or also test PR branches? Recommended: `main` only. PR branches are B's responsibility.
- **Can we run against prod**? Strong NO — E2E creates test data (sub-table rows, formulas) that would pollute prod. Test env only.

---

## 9. Rejected alternatives

- **Run E2E on every commit (trunk-based)**: too expensive (~10 min × many commits/day), test env contention, no real benefit over 24h nightly for current team size
- **Disable E2E, rely on unit tests**: unit tests do NOT catch the bug class E2E was designed for (silent data loss, cross-tenant, end-to-end integration). Would regress R3 / R4 / R6 discovery capability
- **Outsource E2E to third-party QA**: overkill for current scale + adds 3rd-party dependency

---

## 10. Decision status

**Status**: Proposed. Awaiting engineering lead + DevOps approval.

**Claude will NOT execute Phase 2 cron install** — DevOps action required (server config, Slack webhook secret, log dir ownership).

**Claude can draft**:
- `scripts/ops/nightly-canvas-e2e.sh` (ready when decision approved)
- `CONTRIBUTING.md` section (ready when decision approved)

**Follow-up**: once this ADR is accepted, close R7 Issue 4 as "decided" and open implementation tickets for Phase 1 + Phase 2.

---

**Linked docs**:
- `.claude/skills/depth-first-e2e/SKILL.md` — Rule 10.5 context
- `.claude/agent-team-outputs/2026-04-15_canvas-delivery-verified-and-backlog.md` — R7 backlog origin
- Canvas R1-R7 commits on branch `e2e/v1-framework`
