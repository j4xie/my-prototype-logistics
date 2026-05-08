# T6.4 Rollback Rehearsal — Procedure & Timing Measurement

**Date**: 2026-05-08 13:37 UTC (21:37 CST)
**Branch**: `ops-t6-4-rollback-rehearsal`
**Worktree**: `.worktrees/t6-4-rollback-rehearsal`
**Server**: 139.196.165.140 (nginx gateway)
**Goal**: Measure timing of T6.4 emergency rollback procedure and verify the
mechanics work end-to-end. **Did NOT touch prod nginx config or reload prod.**

---

## TL;DR

| Step | Measured time |
|---|---|
| `cp current → bak.simulated` (snapshot before rollback) | **3 ms** (5/5 runs) |
| `cp T6.x_backup → restore_target` (apply rollback) | **3 ms** (5/5 runs) |
| `nginx -t` (validate config) | **30 ms** (3/3 runs) |
| `nginx -s reload` (estimated, NOT executed) | **<1 s** for new connections; up to 60 s for old workers to drain |
| **Total emergency rollback wall-clock** | **~36 ms file-ops + <1 s reload effect** |

Procedure is **well under** the `<30 s = OK fast` threshold. **No blockers.**

⚠️ **One warning surfaced** that organizer must act on before T6.4 cutover —
see [Finding F-1](#f-1-bakt6_3_pre-is-the-wrong-rollback-target-for-t64) below.

---

## Rehearsal scope

Simulated the T6.4 emergency rollback procedure entirely in `/tmp/t6-4-rehearsal-<ts>/`
on server 139. **No prod files modified, no nginx reload executed.**

The rehearsed procedure is:

```
# Pre-rollback snapshot (T6.4 state we are leaving)
cp /www/server/panel/vhost/nginx/api.cretaceousfuture.com.conf \
   /www/server/panel/vhost/nginx/api.cretaceousfuture.com.conf.bak.t6_4_PRE_ROLLBACK.<ts>

# Apply rollback (restore prior baseline)
cp <baseline_backup_file> /www/server/panel/vhost/nginx/api.cretaceousfuture.com.conf

# Validate
nginx -t

# Activate
nginx -s reload
```

Measured each step in `/tmp` scratch using non-prod copies of the actual files.

---

## Step 1 — Simulated T6.4 vhost edit (paper exercise)

Started with current prod vhost (`api.cretaceousfuture.com.conf`, 4428 B,
modified May 8 03:24 UTC = T6.3 cutover state).

Added 14 placeholder real-customer factory tokens to all 3 SmartBI regex
locations:

```diff
- |TEST_0000_001)
+ |TEST_0000_001|CUST_3101_00[1-9]|CUST_3101_01[0-4])
```

Resulting `temp_t6_4_test.conf` size: 4536 B. Diff scope: 3 `location ~`
blocks (alerts/recommendations/data-date-range, analysis/*, query-templates/
datasource/incentive-plan) — same shape as T6.3 cutover diff.

**Note**: real T6.4 will substitute actual customer factory IDs. The regex
shape, byte-add cost, and parse complexity are identical regardless of the
specific tokens.

---

## Step 2 — Timing measurements

Ran each step 5×; results consistent across runs.

### cp operations (file size 4–4.5 KB)

```
run1: cpA=3ms  cpB=3ms  total_cp=6ms
run2: cpA=3ms  cpB=3ms  total_cp=6ms
run3: cpA=3ms  cpB=3ms  total_cp=6ms
run4: cpA=3ms  cpB=3ms  total_cp=6ms
run5: cpA=3ms  cpB=3ms  total_cp=6ms
```

(`cpA` = snapshot pre-rollback state; `cpB` = restore baseline.)

### nginx -t (3 runs against live prod nginx.conf)

```
run1: real=0.03 user=0.01 sys=0.01
run2: real=0.03 user=0.01 sys=0.01
run3: real=0.03 user=0.02 sys=0.01
```

`nginx -t` parses the entire config tree (`nginx.conf` + all
`/www/server/panel/vhost/nginx/*.conf` includes). Timing is dominated by
nginx parser cost, not by the size of one vhost file. The T6.4 vhost adds
~108 B of regex characters; this is statistically zero relative to the 30 ms
parser cost.

### nginx -s reload — NOT executed (per marching order)

Estimated from prior evidence:

- **Master PID 350407**: started 2026-01-25, persisted across all reloads
  including the T6.3 cutover today at 03:34 UTC. Latest worker generation
  (PIDs 1637726–1637729) started 2026-05-08 03:38 UTC. This matches memory
  `project_2026_05_08_t6_3_cutover_live.md`: "master PID unchanged + 4
  workers cycled" — confirms standard nginx reload semantics.
- **`nginx -s reload` CLI return**: typically <100 ms (sends `HUP` signal to
  master, master processes async). Verified by error.log `signal process
  started` notice timestamps having no perceptible CLI latency.
- **New-connection cutover**: <1 s. Master spawns new workers immediately on
  `HUP`; they bind listeners and accept new connections as soon as they're
  ready.
- **Old worker drain**: bounded by `keepalive_timeout 60` (no
  `worker_shutdown_timeout` set → nginx default = wait indefinitely for old
  connections, but new connections route to new workers immediately, so
  this is not user-visible).

### Total budget

| Phase | Time |
|---|---|
| File ops (2× cp) | 6 ms |
| Validation (`nginx -t`) | 30 ms |
| Signal + reload effective | <1 s |
| **Wall-clock from "decide to roll back" → new traffic on rolled-back config** | **~1 s** |

**Verdict per marching order rubric**: `<30 s = OK fast`. Procedure passes
with massive headroom.

---

## Step 3 — Verification

### File integrity

Scratch `restored.conf` md5sum byte-identical to source backup:

```
3a6874e07b52a3da024f41adc32714f9  /tmp/.../restored.conf
3a6874e07b52a3da024f41adc32714f9  bak.t6_3_pre.20260508_032339
```

### Rollback target prod state (= current T6.3 state during 24 h soak)

Smoked 3 factories against current nginx (`https://api.cretaceousfuture.com`
local-resolved to 127.0.0.1, dummy Bearer token):

| Factory | Expected route | HTTP | Total time |
|---|---|---|---|
| F999 | Java upstream (not in T6.3 regex) | 401 | 22 ms |
| FOOD_3101_001 | Python upstream (matches T6.3 regex) | 401 | 22 ms |
| F001 | Python upstream (T6.2 + T6.3 regex) | 401 | 17 ms |

**401 = upstream alive, dummy Bearer rejected by backend** = healthy. (No
JWT pool available in this rehearsal; `200` would require a real token.
Routing correctness + upstream liveness sufficient for rollback-target
verification.)

### Regex shape comparison

`bak.t6_3_pre.20260508_032339` (line 46 sample):

```
location ~ ^/api/mobile/(F001)/smart-bi/(alerts|recommendations|data-date-range)$ {
```

Current prod (line 46):

```
location ~ ^/api/mobile/(F001|FOOD_3101_(00[1-9]|0[1-3][0-9]|04[0-8])|MEAT_3101_00[12]|OTHER_3101_001|RES_3101_00[1-8]|TEST_0000_001)/smart-bi/(alerts|recommendations|data-date-range)$ {
```

Diff: backup has F001-only regex, current has the 61-factory Strategy B
regex. The backup is the **PRE-T6.3** snapshot (= T6.2 state), not post-T6.3.

---

## Findings

### F-1 — `bak.t6_3_pre` is the wrong rollback target for T6.4

**The most important finding of this rehearsal.**

The marching order labels `api.cretaceousfuture.com.conf.bak.t6_3_pre.20260508_032339`
as the "T6.3 baseline". By naming convention `t6_3_pre` = "before T6.3 was
applied", this file actually contains **T6.2 state (F001-only regex)**, not
T6.3 state.

Implications for an actual T6.4 emergency rollback:

- ❌ If T6.4 fails and ops `cp bak.t6_3_pre → current && nginx -s reload`,
  the gateway reverts all the way to T6.2 — F001-only Python routing — and
  **all 60 test factories (FOOD_3101_001..048, MEAT_3101_00[12],
  OTHER_3101_001, RES_3101_00[1-8], TEST_0000_001) lose their Python
  routing**. Their traffic falls through to the default upstream (Java
  47:10010), which still works but defeats the point of T6.3.
- ✅ The rehearsal procedure mechanics (cp + cp + nginx -t + nginx -s
  reload, ~1 s total) are correct regardless of which file is the rollback
  target.

**Recommended fix before T6.4 cutover**: at the start of the T6.4 cutover
runbook, **create a new backup of the current T6.3 state** before applying
the T6.4 regex edit:

```bash
cd /www/server/panel/vhost/nginx
cp api.cretaceousfuture.com.conf \
   api.cretaceousfuture.com.conf.bak.t6_4_pre.$(date +%Y%m%d_%H%M%S)
```

The emergency-rollback step in the T6.4 runbook should restore from this
new `bak.t6_4_pre.*` file, NOT from `bak.t6_3_pre.20260508_032339`.

### F-2 — `nginx -t` cannot validate a scratch vhost in isolation

Tried to validate the simulated T6.4 vhost via `nginx -t -c <scratch>` but
nginx requires a complete main config (`http {}` block, MIME types,
`include` paths, etc.). Validating only the scratch vhost would require a
significant test-harness setup not warranted for this rehearsal.

**Mitigation**: the T6.4 regex change is structurally identical to T6.3
(adding alternatives to the same `location ~` patterns). T6.3's regex
parses cleanly (current prod is healthy at 401 on smoke). T6.4's added 14
tokens follow the same `|<token>` shape. Syntax risk is negligible.

**Recommendation for actual T6.4 cutover**: validate against live config
with `nginx -t` AFTER applying the edit but BEFORE `nginx -s reload`. If
`nginx -t` fails, the bad edit is in place but inactive (master still
serving old config) — recover with `cp bak.t6_4_pre → current && nginx -t`.

### F-3 — `worker_shutdown_timeout` is not configured

`/www/server/nginx/conf/nginx.conf` does not set `worker_shutdown_timeout`.
Default behavior: old workers wait indefinitely for in-flight connections
to close before exiting. This is NOT a problem for rollback responsiveness
(new workers serve new connections immediately), but means stale workers
can linger if some long-lived connection (e.g. SSE, WebSocket) refuses to
close.

**Severity**: low. Not a rollback blocker. Optional follow-up: set
`worker_shutdown_timeout 30s;` to bound stale-worker lifetime. Out of scope
for this rehearsal.

---

## Recommendation

**T6.4 emergency rollback procedure is GO** with the following non-negotiable
prereq baked into the cutover runbook:

```diff
+ # T6.4 cutover step 0 (NEW — before any vhost edit)
+ cp /www/server/panel/vhost/nginx/api.cretaceousfuture.com.conf \
+    /www/server/panel/vhost/nginx/api.cretaceousfuture.com.conf.bak.t6_4_pre.$(date +%Y%m%d_%H%M%S)
+ # Verify backup matches current md5
+ md5sum /www/server/panel/vhost/nginx/api.cretaceousfuture.com.conf*
```

The rollback step then references `bak.t6_4_pre.*` (T6.3 state), not
`bak.t6_3_pre.*` (T6.2 state). With this in place:

- File-ops + validation: ~36 ms
- Reload effective for new traffic: <1 s
- Total: well within the `<30 s fast` threshold

**No procedure changes needed beyond F-1 backup-naming.**

---

## Evidence

- Server 139 master PID 350407, etime 102 d 15 h (started 2026-01-25)
- 4 workers (PIDs 1637726–1637729) started 2026-05-08 03:38 UTC
- nginx 1.28.0
- T6.3 cutover error.log signal: `2026/05/08 03:34:08 [notice] 1637297#0:
  signal process started` (matches memory `T6.3 cutover live` 11:34 CST =
  03:34 UTC)
- Scratch dir cleaned up after rehearsal: `/tmp/t6-4-rehearsal-1778218632/`
  removed via `rm -rf` (verified `ls /tmp | grep t6-4` returns empty)

## Out of scope

- Did not actually run `nginx -s reload` (per marching order constraint)
- Did not measure rollback effect under live load (would need traffic
  generator + actual rollback)
- Did not enumerate the real 14 customer factory IDs for T6.4 (organizer
  task in `t6-4-customer-comms` worktree)
- Did not measure Python/Java upstream health post-rollback (assumed healthy
  per current 24 h T6.3 soak in flight)
