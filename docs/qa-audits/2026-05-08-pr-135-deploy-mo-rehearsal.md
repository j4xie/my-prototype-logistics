# PR #135 prod deploy MO — pre-flight gap detection rehearsal (chat 4)

**Date**: 2026-05-08 (~16h before MO dispatch at 2026-05-09 13:01 CST)
**Source MO**: `docs/superpowers/dispatch/2026-05-09-pr-135-prod-deploy-marching-order.md` (PR #145 commit `e25642120`)
**Rehearsal type**: READ-ONLY verification — no prod mutation, no nginx edits, no deploy
**BG dryrun task**: `bccuc6z3e` poll continues parallel (auto-trigger NDJSON ≥ 25080), not disrupted
**Verdict**: 🟡 **YELLOW with caveats** — 2 real gaps need organizer decision before dispatch

---

## §1 — Reference verify table

### §1.1 Memory file references

| File | Path exists | Verdict |
|---|---|---|
| `reference_blue_green_java_deploy.md` | ✓ | ✅ Ready |
| `reference_smartbi_migration_runner.md` | ✓ | ✅ Ready |
| `project_2026_05_07_uvicorn_n2_path_x_lite.md` | ✓ | ✅ Ready |
| `project_2026_05_08_t6_4_readiness_gates.md` | ✓ | ✅ Ready |
| `project_2026_05_07_t6_1_dryrun_in_flight.md` | ✓ | ✅ Ready |
| `feedback_deploy_pipeline.md` | ✓ | ✅ Ready |

### §1.2 PR cross-references — git SHA + gh meta

| PR | MO ref SHA | git rev-parse | gh state | gh mergeCommit | Title prefix | Verdict |
|---|---|---|---|---|---|---|
| #135 | `2e90a2016` | `2e90a2016e622dd...` | MERGED | `2e90a2016` | feat(phase2a): _get_finance_overview full 3-state... | ✅ |
| #138 | `6310f00278` | `6310f00278c6361...` | MERGED | `6310f0027` | audit(phase2a): PR #135 Pattern B 3-state smoke... | ✅ |
| #141 | `068ebd8b8` | `068ebd8b836f07d...` | MERGED | `068ebd8b8` | docs(t6-4): customer comms plan + bilingual... | ✅ |
| #142 | `41552a9622` | `41552a96221d703...` | MERGED | `41552a962` | audit(t6-4): rollback rehearsal + critical backup... | ✅ |
| #143 | `8b8f758752` | `8b8f758752ef3ca...` | MERGED | `8b8f75875` | audit(t6-4): real customer baseline metrics... | ✅ |
| #145 | `e25642120` | `e25642120351ba2...` | MERGED | `e25642120` | docs(deploy): PR #135 prod deploy marching order... | ✅ |
| #148 | `4e48f16b2` | `4e48f16b2d0eb63...` | MERGED | `4e48f16b2` | docs(soak): PR #135 prod 24h soak monitoring... | ✅ |
| #149 | `7e6c35495` | `7e6c35495968220...` | MERGED | `7e6c35495` | fix(phase2a): K-1 sales overview flag gate... | ✅ |
| #151 | `8912e137d` | `8912e137dad2899...` | MERGED | `8912e137d` | audit(phase2a): retrospective — 50 endpoints... | ✅ |
| #152 | `8b88dbb9b` | `8b88dbb9bd57231...` | MERGED | `8b88dbb9b` | spec(phase2b): port pipeline scoping... | ✅ |
| #153 | `2f7bd9bda` | `2f7bd9bda2d35ed...` | MERGED | `2f7bd9bda` | spec(phase3+): strict-byte gate adoption... | ✅ |

11/11 PR cross-references valid. SHAs match between MO body, git rev-parse, and GitHub gh meta.

### §1.3 Deploy script references

| Script | Exists | Executable | Lines | Verdict |
|---|---|---|---|---|
| `scripts/deploy/deploy-backend.sh` | ✓ | ✓ | 1168 | ✅ |
| `scripts/deploy/deploy-smartbi-python.sh` | ✓ | ✓ | 262 | ✅ |
| `scripts/migrations/apply-smartbi-migrations.sh` | ✓ | ✓ | 226 | ✅ |

---

## §2 — SSH-side state verify (READ-ONLY, no mutation)

### §2.1 Systemd service state

| Service | Active | Enabled | NRestarts | MainPID | Verdict |
|---|---|---|---|---|---|
| `cretas-backend` (10010 active) | active | enabled | 0 | 1177743 | ✅ Running clean since today's deploy |
| `cretas-backend-green` (10020 idle) | inactive | disabled | 0 | 0 | ✅ Expected (BG idle peer) |
| `cretas-python` (8083 prod) | active | enabled | 0 | 665167 | ✅ Running clean since 5/7 N=2 cutover |
| `cretas-embedding` (9090 gRPC) | active | enabled | 0 | 3936589 | ✅ |

NRestarts=0 across all services → MO Step 1 baseline captures will be clean.

### §2.2 Port listeners

| Port | Service | PID | Verdict |
|---|---|---|---|
| 10010 | Java prod active | 1177743 | ✅ |
| 10011 | Java test | 1424411 | ✅ |
| 10012 | Java prod mgmt | 1177743 | ✅ |
| 10013 | Java test mgmt | 1424411 | ✅ |
| 10020 | Java prod green | (down) | ✅ Expected (BG idle) |
| 8083 | Python prod | 665167 + 1320417 + 1586497 | ✅ N=2 multi-worker (parent + 2 spawn workers) |
| 8084 | Python test | 1424437 | ✅ |
| 9090 | Embedding gRPC | 3936589 | ✅ |

### §2.3 smartbi_migrations tracker

| DB | Row count | Expected | Verdict |
|---|---|---|---|
| `smartbi_prod_db` | **35** | 35 | ✅ |
| `smartbi_db` (test) | **35** | 35 | ✅ |

No drift. MO Step 1 stop condition "smartbi_migrations row count != 35 on either env" will not fire. PR #135 adds zero migrations (single-file Python edit), so Step 3.5 expected output `No pending migrations (35 already applied)` is consistent.

### §2.4 Python prod 8083 worker count (PR-3 N=2 leader gate)

```text
Parent (MainPID=665167): /www/wwwroot/cretas/code/backend/python/venv38/bin/python -m uvicorn main:app --host 0.0.0.0 --port 8083 --workers 2
Children:
  665171  resource_tracker (multiprocessing internal)
  1320417 spawn_main (worker 1, pipe_handle=17)
  1586497 spawn_main (worker 2, pipe_handle=16)
```

= main + resource_tracker + **2 workers** = N=2 confirmed per PR-3 #109. ✅

⚠️ Note: MO Step 1 line 107 uses pattern `ps aux | grep -E 'uvicorn.*:8083' | grep -v grep | wc -l` — this returns **1** (only parent matches the regex), not 2. Workers spawn via `multiprocessing.spawn`, not direct uvicorn invocation. **MO grep pattern is misleading but not incorrect** (the intent is alive-check, parent count = 1 confirms uvicorn root running). For accurate worker count use `ps --ppid <MainPID> | grep -c spawn_main`.

### §2.5 nginx upstream config (139 server)

| Item | Expected (per MO) | Actual on 139 | Verdict |
|---|---|---|---|
| File path | `/www/server/panel/vhost/nginx/cretas-java-upstream.conf` | `/www/server/panel/vhost/nginx/_upstream_cretas.conf` | ⚠️ **Filename mismatch** |
| Active server line | `server 47.100.235.168:10010;` | `server 47.100.235.168:10010;` | ✅ Matches today's BG state |
| T6.3 regex (F001/FOOD_3101 cutover) | Present in `api.cretaceousfuture.com.conf` | F001 + FOOD_3101 found | ✅ |

### §2.6 `SMARTBI_GOLD_READ_PRIMARY_ENABLED` env var (CRITICAL)

| Source | Value | Expected per MO §6 | Verdict |
|---|---|---|---|
| `.env.prod` file | **`true`** | `false` or unset | 🚨 **GAP — MISMATCH** |
| Running process env (`/proc/665167/environ`) | **`true`** | `false` | 🚨 **GAP — MISMATCH** |
| File mtime | 2026-05-06 03:24:55 (~3 days ago) | (n/a, MO assumes false at deploy time) | — |

**File backup history** suggests this was a deliberate flip 3 days ago, not a recent accident:
```text
.env.prod.bak.20260505_015029              (5/5 01:50)
.env.prod.bak.20260505_023843_stage3       (5/5 02:38)
.env.prod.bak.20260505_091800_stage4       (5/5 09:18)
.env.prod.bak.20260506_024911_before_semthreshold      (5/6 02:49)
.env.prod.bak.20260506_032128_before_bge_threshold_restore (5/6 03:21)
.env.prod.bak.20260506_032455_before_bge_threshold     (5/6 03:24)  ← last backup, file flipped 3s after
```

Other related env vars also `true` on prod:
- `SMARTBI_AGENT_LAYER_ENABLED=true`
- `SMARTBI_ENABLE_SILVER_DUAL_WRITE=true`
- `SMARTBI_ENABLE_SHEET_MERGER=true`
- `SMARTBI_ENABLE_B_WRITERS=true`
- `SMARTBI_GOLD_SHADOW_READ_ENABLED=false`

→ Looks like Phase 2B/Gold rollout flags toggled on for some recent test or staged enablement. Not a recent accident.

### §2.7 origin/main HEAD

```text
2f7bd9bda spec(phase3+): strict-byte gate adoption decision (#153)   ← latest origin/main HEAD
8b88dbb9b spec(phase2b): port pipeline scoping (#152)
8912e137d audit(phase2a): retrospective (#151)
cf8cc48e8 spec(t6-5): Java SmartBI deprecation trigger (#150)
7e6c35495 fix(phase2a): K-1 sales overview flag gate (#149)
4e48f16b2 docs(soak): PR #135 prod 24h soak monitoring runbook (#148)
e25642120 docs(deploy): PR #135 prod deploy marching order (#145)
8b8f758752 audit(t6-4): real customer baseline metrics (#143)
41552a9622 audit(t6-4): rollback rehearsal (#142)
068ebd8b8 docs(t6-4): customer comms plan (#141)
6310f00278 audit(phase2a): PR #135 Pattern B 3-state smoke verify (#138)
2e90a2016 feat(phase2a): _get_finance_overview full 3-state branching (#135)
```

✅ All MO-referenced PRs in main; rebase not needed.

### §2.8 T6.1 BG dryrun parallel state

```text
PID 1237516 etime=10h21m  (launched ~07:01 UTC May 7)
NDJSON: 11685 lines (target 25080 = 22h × 60 batches × 19 endpoints, ~46% complete)
ETA full window: ~2026-05-09 05:00 UTC = 13:00 CST May 9
```

✅ Not disrupted by this rehearsal (read-only ops). BG poll task `bccuc6z3e` continues independently.

---

## §3 — Gaps detected

### 🚨 GAP-1: `SMARTBI_GOLD_READ_PRIMARY_ENABLED=true` on prod (was expected `false`)

**Severity**: 🔴 **RED** — must resolve before MO dispatch (May 9 13:01 CST)

**Evidence**:
- `.env.prod` file content + running process env both confirm `=true`
- Has been `true` since 2026-05-06 03:24:55 (3 days, deliberate flip per backup history)
- Related Phase 2B Gold rollout flags also `true` (likely batch-flipped during Phase 2B prep)

**Impact on MO Step 5 + Step 6**:

| MO step | Expected behavior (assumes flag=false) | Actual behavior (flag=true) |
|---|---|---|
| Step 5 State C smoke F001 | `kpiCards=10 charts=3` (legacy path) | `kpiCards=4 keys=[total_revenue, bill_count, avg_bill_value, store_count]` (State A Gold path because F001 has Gold POS data) |
| MO Step 5 line 315 | "If F001 returns 4-card Gold shape... **STOP, ping organizer immediately**" | Will trigger this STOP |
| Step 6 env var verify line 392 | "either `=false` or unset" | Will fail "STOP, ping organizer" condition |

→ MO will **STOP at Step 5 or Step 6**, not because of bug but because actual prod state differs from MO assumption.

**Recommended resolution** (organizer decides):

1. **Option A** — flip flag back to `false` before dispatch + re-verify with MO unchanged (preserves MO assumption + continues legacy-path-only customer behavior). Backup → edit → restart Python → re-test.
2. **Option B** — keep flag `true` + revise MO Step 5 (F001 expects State A 4-card) + revise MO Step 6 (expect `=true`, document why intentional) + add State A regression check (Gold returning expected 4 keys).
3. **Option C** — investigate whether the 3-day-old flag flip is intentional (some Phase 2B staged rollout) vs forgotten leftover from a test. If forgotten → Option A. If intentional → Option B.

→ Without this resolution, MO execution at May 9 13:01 will halt within Step 5/6.

### ⚠️ GAP-2: nginx upstream config filename mismatch

**Severity**: 🟡 **YELLOW** — fixable in MO before dispatch

**Evidence**:
- MO Step 1 line 111 references `/www/server/panel/vhost/nginx/cretas-java-upstream.conf`
- MO Step 2 line 184 references same filename
- Actual file on 139: `/www/server/panel/vhost/nginx/_upstream_cretas.conf`
- Both files don't co-exist; MO references a non-existent path
- The grep regex (`server 47\.100\.235\.168:\K[0-9]+`) is correct for the actual file content

**Impact**:
- MO Step 1 active-port detection grep returns empty → "Active BG color" deploy-log line will be blank
- MO Step 2 post-flip active-port verification fails the same way → smoke command sets `ACTIVE_PORT=` empty → curl hits `http://localhost:/api/mobile/health` → returns 000
- Doesn't break the deploy itself (deploy-backend.sh handles BG flip internally), but makes the MO's verify steps non-functional

**Recommended fix**: Search-and-replace in MO before dispatch:
```bash
sed -i 's|cretas-java-upstream.conf|_upstream_cretas.conf|g' \
  docs/superpowers/dispatch/2026-05-09-pr-135-prod-deploy-marching-order.md
```

Note: also relates to memory `reference_blue_green_java_deploy.md` Step 4 "Files reference" section line 77 mentioning `cretas-java-upstream.conf`. Consider updating both for consistency.

### ⚠️ GAP-3 (downgraded from previous suspicion): worker count grep pattern

**Severity**: 🟢 **GREEN** — false alarm, but worth a one-line MO improvement

**Evidence**: MO Step 1 line 107 grep pattern `uvicorn.*:8083` returns 1 (only parent). N=2 workers ARE running but spawn via `multiprocessing.spawn` (not direct uvicorn process). Already verified ✅.

**Recommended fix**: replace MO line 107 with:
```bash
ps aux | grep -E 'main:app.*--port 8083' | grep -v grep | wc -l   # parent count
ps --ppid $(systemctl show cretas-python --property=MainPID --value) | grep -c spawn_main   # actual N=2 workers
```

Optional polish, not blocker.

---

## §4 — Pre-flight readiness verdict

| Category | Status |
|---|---|
| Memory file references | ✅ All 6 valid |
| PR cross-references | ✅ All 11 valid (git + gh meta) |
| Deploy scripts | ✅ All 3 exist + executable |
| systemd state | ✅ All services active, NRestarts=0 |
| Port listeners | ✅ Expected ports listening |
| smartbi_migrations tracker | ✅ 35 rows prod + test |
| Python prod N=2 workers | ✅ Confirmed (parent + 2 spawns) |
| origin/main HEAD | ✅ Has all 11 referenced PRs |
| **`SMARTBI_GOLD_READ_PRIMARY_ENABLED` flag** | 🚨 **RED — `true` on prod, MO assumes false** |
| **nginx upstream config filename in MO** | 🟡 **YELLOW — wrong filename in 2 places** |
| BG dryrun parallel state | ✅ Not disrupted, on track for ~13:00 CST May 9 |

### Verdict: 🟡 **YELLOW with caveats**

**Rationale**: 9/11 categories ✅ READY. Two gaps detected, both fixable BEFORE May 9 13:01 dispatch:

1. **GAP-1 (RED)** is genuinely blocking — MO will halt at Step 5/6 unless flag is flipped back to `false` OR MO is revised to handle the `true` reality. Organizer decision needed (Option A / B / C in §3.GAP-1).

2. **GAP-2 (YELLOW)** is a 30-second `sed` fix in the MO doc + memory file. Not blocking deploy, but blocks MO verify steps. Recommend doing this fix when GAP-1 is being resolved.

3. No emergency. Plenty of runway (~13h until dispatch).

### Action items for organizer

- [ ] **Decide GAP-1**: flip flag back to `false` (Option A) OR revise MO to expect `true` (Option B) OR investigate intent (Option C). Recommended: Option A unless there's a Phase 2B reason to keep `true`.
- [ ] **Fix GAP-2**: `sed` filename replace in deploy MO + relevant memory file (or accept gap as known limitation).
- [ ] **Optional GAP-3 polish**: improve MO Step 1 worker-count grep pattern.

After resolution, ping execution chat (chat 4 or other) at May 9 13:01 dispatch.

---

## §5 — Out-of-scope notes

- This rehearsal **did NOT** mutate prod state (verified via systemd NRestarts=0, no `.env.prod` edit, no nginx config touch, no service restart).
- T6.1 BG dryrun task `bccuc6z3e` continues unaffected (verified PID 1237516 still running etime 10h21m).
- chat 4 returns to standby after this PR. BG trigger fires at NDJSON ≥ 25080 lines (~13:00 CST May 9), then chat 4 reports T6.1 final 22h verdict per the assigned scope.

---

## Cross-references

- Source MO: `docs/superpowers/dispatch/2026-05-09-pr-135-prod-deploy-marching-order.md` (commit `e25642120`)
- T6.4 readiness gates: memory `project_2026_05_08_t6_4_readiness_gates.md`
- BG deploy pattern: memory `reference_blue_green_java_deploy.md`
- N=2 multi-worker context: memory `project_2026_05_07_uvicorn_n2_path_x_lite.md`
- migration runner: memory `reference_smartbi_migration_runner.md`
- This rehearsal commit: TBD (single-file doc commit + STOP ping organizer per Step 5 of rehearsal task)
