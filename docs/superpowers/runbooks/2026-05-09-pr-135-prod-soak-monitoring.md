# PR #135 Prod Soak Monitoring Runbook (24h)

**Phase**: Phase 2A T6.4 prerequisite — PR #135 (`2e90a2016`, Pattern B PR-B v2) prod deploy 24h soak
**Status**: Doc-only readiness — execution chat picks up post-deploy on May 9 ~13:30+ CST
**Author**: organizer chat (T6.4 readiness coordinator)
**Date**: 2026-05-09
**Predecessor**: PR [#145](https://github.com/j4xie/my-prototype-logistics/pull/145) — PR #135 prod deploy marching order (this runbook is the operational expansion of §7 of that MO)
**Successor**: PR [#144](https://github.com/j4xie/my-prototype-logistics/pull/144) — T6.4 Stage 1 cutover MO (`docs/superpowers/dispatch/2026-05-10-t6-4-stage-1-marching-order.md`), unblocked once §4 GO criteria pass

---

## 0. Scope and how to use this runbook

PR #145 (deploy MO) §7 establishes the *high-level* 24h soak structure: one checkpoint command, a single T+24h GO criteria table, and 5 NO-GO triggers. This runbook is the **operational expansion**:

- **Tighter progressive thresholds** at T+1h and T+6h (not just T+24h) so drift is caught while still cheap to roll back.
- **Pattern B 3-state distribution** monitoring — grep on the three helper function names to confirm production traffic is correctly hitting State C only (flag=false default).
- **Reusable log query templates** as copy-paste blocks (saves the on-call from re-deriving grep patterns each checkpoint).
- **Anomaly → response decision tree** mapping each tripped threshold to the specific action (BG flip / git revert / manual escape / schedule restart).
- **Customer comms during soak** — explicit "no comms needed" guidance to avoid spurious notifications.
- **Soak GO → T6.4 trigger handoff** — explicit prereq verify against PR #144 Stage 1 MO.

**Use this runbook in tandem with PR #145 §7.** PR #145 is the high-level MO ("what to do"); this runbook is the dense operational reference ("what to grep, what to do when X").

⛔ **HOLD blocks honored throughout this doc**: doc-only deliverable, no prod / nginx / systemd state mutation during draft. Cross-references only — no logic redefined here that contradicts PR #145.

---

## 1. Pre-soak baseline capture (T-30min, before deploy)

This expands PR #145 §1 pre-flight — same data, tighter format for diff comparison at T+1h.

```bash
ssh root@47.100.235.168 "
set -euo pipefail
echo '===== T-30min baseline $(date -Iseconds) ====='

echo '--- systemd NRestarts + uptime baseline ---'
for unit in cretas-backend cretas-backend-green cretas-python cretas-embedding; do
  echo \"# \$unit\"
  systemctl show \$unit --property=NRestarts --property=ActiveEnterTimestamp --property=MainPID --property=ActiveState 2>/dev/null
done

echo '--- Python prod 8083 N=2 multi-worker baseline ---'
ss -tlnp | grep ':8083' | head -3
PYTHON_PIDS=\$(pgrep -f 'uvicorn.*:8083' | tr '\n' ' ')
echo \"Python prod PIDs: \$PYTHON_PIDS\"
echo \"Worker count: \$(echo \$PYTHON_PIDS | wc -w)   (expect 2: leader + follower per PR-3 #109)\"
ps -o pid,vsz,rss,cmd --no-headers -p \$(echo \$PYTHON_PIDS | tr ' ' ',') 2>/dev/null | head -5

echo '--- Total Python prod RSS (sum across N=2 workers) ---'
ps -o pid,rss --no-headers -p \$(echo \$PYTHON_PIDS | tr ' ' ',') 2>/dev/null \
  | awk '{rss+=\$2} END {printf \"baseline RSS = %.2f GB\\n\", rss/1024/1024}'

echo '--- Java active port + RSS baseline ---'
JAVA_PID=\$(systemctl show cretas-backend --property=MainPID --value)
[ \"\$JAVA_PID\" -gt 0 ] && ps -o pid,rss,etime --no-headers -p \"\$JAVA_PID\" \
  | awk '{printf \"java active PID=%s RSS=%.2f GB etime=%s\\n\", \$1, \$2/1024/1024, \$3}'

echo '--- F001 SmartBI baseline 3-sample latency (analysis-finance, analysis-sales, dashboard) ---'
set -a; source /www/wwwroot/cretas/.env.prod; set +a
TOKEN=\$(FACTORY_ID=F001 python3 -c '
import jwt, os, time
print(jwt.encode({
    \"userId\": 1, \"username\": \"soak_baseline\",
    \"factoryId\": os.environ[\"FACTORY_ID\"], \"role\": \"factory_super_admin\",
    \"exp\": int(time.time()) + 3600,
}, os.environ[\"JWT_SECRET\"], algorithm=\"HS256\")
' | tr -d '\n')

# Hits Python prod 8083 directly via loopback (bypasses 139 nginx)
for endpoint in 'analysis/finance?startDate=2025-01-01&endDate=2025-12-31' 'analysis/sales?startDate=2025-01-01&endDate=2025-12-31' 'analysis/inventory?startDate=2025-01-01&endDate=2025-12-31'; do
  for sample in 1 2 3; do
    curl -s -o /dev/null -H \"Authorization: Bearer \$TOKEN\" \
      -w \"F001 \$endpoint sample\$sample: %{http_code} (%{time_total}s)\\n\" \
      \"http://localhost:8083/api/mobile/F001/smart-bi/\$endpoint\"
  done
done

echo '--- Pattern B helper call frequency baseline (last 1h, expect all 0 since deploy not yet happened) ---'
for fn in '_build_finance_overview_from_gold' '_build_empty_dashboard_response' '_build_finance_overview_legacy'; do
  count=\$(journalctl -u cretas-python --since '1 hour ago' --no-pager 2>/dev/null | grep -c \"\$fn\" || echo 0)
  echo \"\$fn: \$count calls\"
done

echo '--- 5xx baseline (pre-deploy 1h window) ---'
journalctl -u cretas-python --since '1 hour ago' --no-pager 2>/dev/null \
  | grep -oE 'HTTP/1\\.1\" [0-9]{3}' | sort | uniq -c | sort -rn | head -10

echo '===== baseline captured ====='
"
```

**Save the captured output to** `docs/qa-audits/2026-05-09-pr-135-prod-deploy.md` (the deploy log per PR #145 §9). Each later checkpoint diffs against these numbers.

**STOP if any baseline anomaly fires** (per PR #145 §1 stop conditions): `cretas-python.MainPID` doesn't match a running uvicorn process; smartbi_migrations row count != 35; T6.3 regex moved on nginx 139.

---

## 2. T+1h checkpoint — early drift detection (loosest thresholds)

Run 60 minutes after `cretas-python` is post-deploy and accepting traffic. Goal: catch immediate post-deploy regressions while rollback (§6 8a) is still cheap (BG flip back is <2 min).

```bash
ssh root@47.100.235.168 "$(cat <<'CHECKPOINT_BLOCK'
set -euo pipefail
echo '===== T+1h checkpoint $(date -Iseconds) ====='

# (re-run the same 6 sections from §1 — NRestarts, worker count, RSS, F001 latency,
#  Pattern B helper counts, 5xx counts — diff each against baseline)

# ... (identical command structure as §1; saved as a separate variable on server-side,
#      see §5 §5.1 for the reusable function definition) ...
CHECKPOINT_BLOCK
)"
```

### T+1h thresholds (early — generous)

| Metric | Threshold | Action if exceeded |
|---|---|---|
| `cretas-python.NRestarts` Δ from baseline | **= 0** | **BLOCK** — abort soak, engage §6 anomaly path |
| `cretas-backend.NRestarts` Δ from baseline (active) | = 0 (BG cycle counts as 0 since deploy script reset-failed) | BLOCK if > 0 unprompted |
| Python prod worker count | = 2 (PR-3 leader gate stable) | BLOCK if not 2 |
| Python prod total RSS growth | < +500 MB above baseline | WARN — log and re-check at T+6h |
| Java active RSS growth | < +300 MB | WARN |
| 5xx rate per-endpoint (1h rolling window) | < 0.5% | WARN; if > 1%, escalate to §6 5xx-surge path |
| p99 latency (F001 baseline endpoints) | < 2× baseline sample mean | WARN |
| Pattern B `_build_finance_overview_legacy` call freq | > 0 (expect non-zero — F001 default-flag traffic exercises legacy) | normal — not a threshold; just confirm > 0 |
| Pattern B `_build_finance_overview_from_gold` call freq | **= 0** (flag=false default — Gold path must NOT fire on prod) | BLOCK if > 0 — flag was inadvertently flipped |
| Pattern B `_build_empty_dashboard_response` call freq | **= 0** (only fires when flag=true + Gold null) | BLOCK if > 0 — same as above |
| Java fallback hits (T6.2 F001 + T6.3 61 test factories scope) | = 0 | BLOCK if > 0 |

### T+1h NO-GO actions

- `NRestarts ↑` or `_from_gold` / `_empty_dashboard` calls > 0: **immediately** engage §6 NRestarts-increment path or env-var-leak path. Do not wait for T+6h.
- 5xx rate 0.5–1%: log to deploy artifact, continue to T+6h. Re-evaluate stricter thresholds.
- 5xx rate > 1%: §6 5xx-surge path (BG flip back).
- RSS growth > +500 MB: WARN only; many causes are benign (worker JIT compile, heap warmup). Continue.

---

## 3. T+6h checkpoint — mid-soak stability gate (tighter)

Run 6 hours after deploy completion. By T+6h all post-deploy heap warmup / JIT / connection-pool seeding should have settled. Drift detected here is real, not transient.

### T+6h thresholds (tighter)

| Metric | Threshold | Action if exceeded |
|---|---|---|
| `cretas-python.NRestarts` Δ from baseline | **= 0** | BLOCK |
| `cretas-backend.NRestarts` Δ from baseline | = 0 | BLOCK if > 0 unprompted |
| Python prod worker count | = 2 sustained | BLOCK if not 2 |
| Python prod total RSS growth | < +800 MB above baseline | WARN; if > +1.5 GB, schedule restart per §6 RSS-leak path |
| Java active RSS growth | < +500 MB | WARN |
| 5xx rate per-endpoint (1h rolling) | **< 0.3%** (tighter than T+1h's 0.5%) | WARN; if > 0.5%, treat as regression |
| p99 latency (F001 baseline endpoints) | < 1.5× baseline sample mean | WARN |
| Pattern B `_from_gold` / `_empty_dashboard` call freq | **= 0 cumulative** | BLOCK |
| Java fallback hits (cumulative 6h) | **= 0** | BLOCK if > 0 — cutover scope is 100% Python-served |

### T+6h NO-GO actions

- 5xx rate 0.3–0.5%: tighter scrutiny — pull last 100 5xx requests via `journalctl -u cretas-python --since '6 hours ago' | grep 'HTTP/1.1\" 5'`, look for endpoint clustering. If clustered on one endpoint, that endpoint may have a Pattern B regression.
- 5xx rate > 0.5%: §6 5xx-surge path.
- Java fallback hit *anywhere* in 6h: BLOCK and investigate. T6.2 F001 + T6.3 61 test factories should be 100% Python-served per nginx regex; any fallback indicates Python prod 8083 was unhealthy long enough for nginx upstream to mark it down (or N=2 leader gate broke and only 1 worker is up but failing).
- RSS growth > +1.5 GB: §6 RSS-leak path — schedule restart at low-traffic window (typically 03:00 CST for cretas).

---

## 4. T+24h checkpoint — final GO criteria

This is the gate for unblocking T6.4 Stage 1 (PR #144). All thresholds below must hold simultaneously.

### T+24h GO criteria (final)

| Metric | Threshold | Source / Why |
|---|---|---|
| `cretas-python.NRestarts` Δ from baseline | **= 0** | No process-level instability over 24h. PR-3 #109 baseline soak GO standard. |
| `cretas-backend.NRestarts` Δ from baseline (active) | **= 0** | BG cycle resets failed state once; soak should not require additional restarts. |
| Python prod worker count | = 2 sustained 24h | PR-3 leader gate held. |
| Python prod total RSS | within ±5% of T+6h reading | Stable steady-state — no slow leak. |
| Java active RSS | within ±5% of T+6h reading | Same. |
| 5xx rate per-endpoint (24h rolling) | **< 0.1%** (tightest threshold) | T6.2/T6.3 24h soak GO standard precedent. |
| p99 latency per-endpoint | within 1.2× baseline sample mean | Same. |
| Pattern B `_from_gold` / `_empty_dashboard` call freq | **= 0 cumulative 24h** | flag=false on prod throughout — these helpers only fire when flag is flipped, which is Phase B work. |
| Pattern B `_legacy` call freq | > 0 (expected — every default-flag finance overview hit) | Confirms code path is wired correctly. |
| Java fallback hits (24h cumulative) | **= 0** | Same as T+6h. |
| Pattern B exception count (24h, `from_gold` / `legacy` / `gold throw` paths) | **< 10 cumulative** | T6.1 dryrun parity standard ≥99.94% match → equivalent ≤6e-4 exception rate over typical 1500/h request volume = ~14/24h. Set conservative threshold 10. |
| Customer-reported P1 (T6.3 + T6.2 cutover scope) | = 0 | T6.3 test factories have no real users; F001 is Steve internal. Any P1 must originate from sales channel for the 14 T6.4-pending real customers — but those are still on Java per pre-T6.4 routing. So P1 should be impossible from this set. |

### Soak GO declaration

When all thresholds hold at T+24h, write the GO summary into the deploy artifact log per PR #145 §9 §10 template:

```text
✅ PR #135 prod deploy + 24h soak GO (commit 2e90a2016 deployed 2026-05-09 <hh:mm> CST)
   - cretas-python NRestarts: <pre> → <post> (Δ=0 over 24h)
   - cretas-backend NRestarts: <pre> → <post> (Δ=0 over 24h)
   - Python prod RSS @T+24h: <X.X> GB (T+6h baseline ±5% range: [<lo>, <hi>] GB)
   - Java active RSS @T+24h: <X.X> GB
   - 5xx rate per-endpoint p99 (24h): <X.XX>% (cap 0.1%)
   - p99 latency per-endpoint: <XXX> ms (within 1.2× baseline mean <YYY> ms)
   - Java fallback hits 24h: 0
   - Pattern B exception count 24h: <N> (cap 10)
   - Pattern B State distribution: from_gold=0, empty_dashboard=0, legacy=<M>
   - flag=false on prod confirmed at T+1h, T+6h, T+24h
   - Customer P1 reports: 0
   T6.4 Stage 1 unblocked. Ping organizer for ⚡ IMMEDIATE on PR #144's 2026-05-10 stage-1 MO.
```

### Soak NO-GO declaration

If any threshold fails at T+24h (or earlier checkpoint trips a BLOCK condition):

1. Engage the matching §6 anomaly response path.
2. Open a follow-up audit doc `docs/qa-audits/2026-05-09-pr-135-soak-no-go-<reason>.md` capturing the threshold trip, the affected metric history, and the action taken.
3. Ping organizer with the audit link + `gh pr view 145` deploy artifact link.
4. **Do NOT trigger T6.4 Stage 1 (PR #144).** Stage 1 prereqs explicitly include PR #135 prod-deployed-and-soaked; a NO-GO blocks the stage gate.

---

## 5. Reusable log query templates

These are copy-paste blocks to drop into per-checkpoint runs. Each template is parameterized on `$WINDOW` (defaulting to `'1 hour ago'`).

### 5.1 Pattern B 3-state call distribution

```bash
WINDOW='1 hour ago'   # change per checkpoint: '6 hours ago', '24 hours ago'
ssh root@47.100.235.168 "
echo '--- Pattern B helper distribution last \$WINDOW ---'
for fn in '_build_finance_overview_from_gold' '_build_empty_dashboard_response' '_build_finance_overview_legacy'; do
  count=\$(journalctl -u cretas-python --since '\$WINDOW' --no-pager 2>/dev/null | grep -c \"\$fn\" || echo 0)
  printf '  %-45s : %d\n' \"\$fn\" \"\$count\"
done
"
```

**Interpretation**:
- `_legacy > 0` is **expected** (default flag-false path serving real traffic).
- `_from_gold > 0` or `_empty_dashboard > 0` is **a BLOCK** — flag was flipped on prod somehow.

### 5.2 Pattern B exception count (analysis_finance.py / smartbi_compat tracebacks)

```bash
ssh root@47.100.235.168 "
WINDOW='\${WINDOW:-1 hour ago}'
journalctl -u cretas-python --since \"\$WINDOW\" --no-pager 2>/dev/null \
  | grep -iE 'traceback|exception' \
  | grep -iE 'analysis_finance|smartbi_compat' \
  | head -30
"
```

Threshold per checkpoint: T+1h ≤ 3, T+6h ≤ 6, T+24h ≤ 10.

### 5.3 5xx rate per-endpoint

```bash
ssh root@47.100.235.168 "
WINDOW='\${WINDOW:-1 hour ago}'
journalctl -u cretas-python --since \"\$WINDOW\" --no-pager 2>/dev/null \
  | grep -oE 'HTTP/1\\.1\" 5[0-9]{2}' | sort | uniq -c
"
```

**Total 5xx / total requests** = rate. Compute total requests via:

```bash
journalctl -u cretas-python --since "$WINDOW" --no-pager | grep -c 'HTTP/1\.1"'
```

### 5.4 Java fallback hit count

```bash
ssh root@47.100.235.168 "
WINDOW='\${WINDOW:-1 hour ago}'
journalctl -u cretas-backend --since \"\$WINDOW\" --no-pager 2>/dev/null \
  | grep -iE 'fallback.*python|python.*unavailable|python.*fallback' \
  | wc -l
"
```

Expected: 0. Anything > 0 means nginx upstream marked Python prod down momentarily and traffic spilled to Java legacy paths.

### 5.5 RSS / process state snapshot

```bash
ssh root@47.100.235.168 "
echo '--- RSS snapshot ---'
ps -o pid,rss,vsz,etime,cmd --no-headers \
  -p \$(pgrep -f 'uvicorn.*:8083' | tr '\n' ',' | sed 's/,$//')
JAVA_PID=\$(systemctl show cretas-backend --property=MainPID --value)
[ \"\$JAVA_PID\" -gt 0 ] && ps -o pid,rss,vsz,etime,cmd --no-headers -p \"\$JAVA_PID\"
echo '--- aggregate Python RSS ---'
ps -o pid,rss --no-headers -p \$(pgrep -f 'uvicorn.*:8083' | tr '\n' ',' | sed 's/,$//') \
  | awk '{rss+=\$2} END {printf \"%.2f GB total\\n\", rss/1024/1024}'
"
```

---

## 6. Anomaly → response decision tree

Each anomaly maps to **one** primary action. Multiple anomalies trip → engage the highest-severity action first (rollback > restart > investigate).

| Anomaly | Trigger threshold | Primary response | Reference |
|---|---|---|---|
| **5xx surge** | > 1% rate sustained 5+ min, OR > 0.5% sustained 30+ min | **BG flip back** to old Java jar via `./scripts/deploy/deploy-backend.sh --rollback` (rollback path 8a in PR #145 §8a) | PR #145 §8a |
| **Pattern B exception > threshold** | > 10 cumulative in 24h, OR > 6 in 6h, OR > 3 in 1h | Inspect `journalctl -u cretas-python` for traceback origin. If origin is `_build_finance_overview_legacy`, escalate as Python regression → §8b git revert. If origin is `_build_finance_overview_from_gold` or `_build_empty_dashboard_response`, the flag was flipped — **immediately** check §6 env-var-leak path. | PR #145 §8b |
| **Pattern B `_from_gold` or `_empty_dashboard` call freq > 0** (env var leak) | Any non-zero count at any checkpoint | **STOP soak immediately.** Verify `/proc/<MainPID>/environ` for `SMARTBI_GOLD_READ_PRIMARY_ENABLED`. If set to `true`: revert `.env.prod` (must be `false`), `systemctl restart cretas-python`, re-baseline. Investigate who/what set it. | This runbook §6, PR #145 §6 |
| **NRestarts increment unprompted** | `cretas-python.NRestarts` > baseline at any checkpoint | **STOP soak.** Run `journalctl -u cretas-python --since <baseline-ts> | grep -iE 'kill|fatal|abort|oom'`. If OOM: §6 RSS-leak path. Otherwise: §8b git revert. | PR #145 §7 NO-GO trigger |
| **RSS leak** | Python prod RSS > +2 GB above T+0 baseline OR ratio of T+6h to baseline > 1.6× | Schedule restart at low-traffic window (typically 03:00 CST). `systemctl restart cretas-python` reseats N=2 workers; soak counter resets but PR #135 code stays. **Don't** revert PR #135 unless RSS leak persists post-restart for another 6h. | This runbook §6 |
| **Java fallback hit > 0** | Any cumulative count in T6.2/T6.3 cutover scope (F001 or 61 test factories) | Investigate Python prod health. Check `journalctl -u cretas-python --since` for the timestamp of the fallback log line. Likely Python was momentarily down during deploy or N=2 leader-gate transition. If recurring: §8b git revert. | PR #145 §7 NO-GO trigger |
| **Customer P1** | Any P1 from cutover-scope factory | Engage on-call + sales lead per PR [#141](https://github.com/j4xie/my-prototype-logistics/pull/141) escalation chain (5min ack / 12min decide / 15min recover). For PR #135 soak, expect zero — if a P1 fires, it's almost certainly unrelated (T6.4 customers still on Java). Confirm scope before rollback. | PR #141 §5 |

### 6.1 Env var leak path (special: `SMARTBI_GOLD_READ_PRIMARY_ENABLED=true` on prod)

This is the most dangerous anomaly because it silently exposes State A/B paths to all customers without comms. If any Pattern B `_from_gold` or `_empty_dashboard` call appears in prod logs:

```bash
ssh root@47.100.235.168 "
PID=\$(systemctl show cretas-python --property=MainPID --value)
echo '--- in-process env ---'
tr '\\0' '\\n' < /proc/\$PID/environ | grep -i SMARTBI_GOLD || echo '(unset in process)'
echo '--- .env.prod ---'
grep SMARTBI_GOLD /www/wwwroot/cretas/.env.prod || echo '(unset in .env.prod)'

# If flag is true: revert immediately
if tr '\\0' '\\n' < /proc/\$PID/environ | grep -qi 'SMARTBI_GOLD_READ_PRIMARY_ENABLED=true'; then
  echo '⛔ FLAG IS TRUE ON PROD — reverting'
  cp /www/wwwroot/cretas/.env.prod /www/wwwroot/cretas/.env.prod.bak.flag-leak.\$(date +%Y%m%d_%H%M%S)
  sed -i 's/^SMARTBI_GOLD_READ_PRIMARY_ENABLED=.*/SMARTBI_GOLD_READ_PRIMARY_ENABLED=false/' /www/wwwroot/cretas/.env.prod
  grep SMARTBI_GOLD /www/wwwroot/cretas/.env.prod
  systemctl restart cretas-python
  sleep 35   # ONNX warmup
  curl -s -o /dev/null -w 'post-restart 8083: %{http_code}\\n' http://localhost:8083/health
fi
"
```

After revert: open a follow-up audit doc capturing **who** flipped the flag (git blame on `.env.prod` is not possible since it's gitignored — check `journalctl --since` for sudo / ssh sessions; check `last -F` for login history; check if `.env.test` was edited on a recent deploy that accidentally synced).

---

## 7. Customer comms during soak

**No customer-facing comms required during this 24h soak.** Per PR [#141](https://github.com/j4xie/my-prototype-logistics/pull/141) customer comms plan:

| Audience | State during soak | Comms required |
|---|---|---|
| T6.3 test factories (61 factories per `(F001\|FOOD_3101_*\|MEAT_3101_00[12]\|OTHER_3101_001\|RES_3101_00[1-8]\|TEST_0000_001)` regex) | All on Python 8083 since 2026-05-08 11:34 CST. PR #135 deploy cycles their Python service but does not change routing. | None — these are internal/test, no real customer users. |
| F001 (Steve internal) | On Python 8083 since 2026-05-07 04:01 CST T6.2. | None — Steve self-managed. |
| 14 T6.4 real customers (F002/F003/F004/F006, R001, RES_3101_009, RES_GML_001, R_GML_DEMO, R_XMX_*, R_YHDJ_DEMO, R_YJJ_DEMO) | **All still on Java 10010** — T6.4 not yet triggered. PR #135 deploy is a *code* prereq, not a *routing* change. | None — no customer-visible behavior change during soak. T-24h pre-notice fires only when Stage 1 cutover triggers (per PR #144 stage-1 MO). |

If a soak NO-GO triggers and rollback is engaged: still no customer comms required (rollback restores pre-PR-#135 code; no customer-facing impact since no customer-facing routing changed).

The first customer-facing comms event in this overall T6.4 sequence is the **T-24h pre-notice for Stage 1** which goes out approximately one day before 2026-05-10 03:00 CST execution — **not** during this soak.

---

## 8. Soak GO → T6.4 Stage 1 trigger handoff

When §4 T+24h GO criteria pass, the next action is to unblock PR #144's Stage 1 MO (`docs/superpowers/dispatch/2026-05-10-t6-4-stage-1-marching-order.md`). That MO has its own prereq gate (stage-1-marching-order.md §"⛔ HOLD until trigger"); confirm each item before declaring Stage 1 unblocked:

- [ ] T6.3 24h soak GO declared (this should already be true by the time this runbook runs — gates PR #135 deploy itself per PR #145 §"⛔ HOLD blocks" item 1).
- [ ] **PR #135 prod-deployed via `./scripts/deploy/deploy-smartbi-python.sh --env prod`** ✅ (this runbook is the soak verification — its GO is the prereq satisfaction).
- [ ] **24h soak GO declared per §4 of this runbook** ✅
- [ ] PR #141 customer comms plan templates available (already merged 2026-05-08).
- [ ] Sales team T-24h pre-notice scheduled for F002 + F003 customers (Stage 1 scope) — NOT this runbook's job; ping sales channel.
- [ ] PR #143's 14-customer baseline metrics captured for F002 + F003 (already done in `tests/fixtures/t6-4-baseline/java/F002-*.json` and `F003-*.json`).
- [ ] Today's smartbi_prod_db backup verified ≥ 400 MB.
- [ ] No active P1 incident on prod.

When all items above are checked, ping organizer with:

```text
✅ PR #135 prod deploy + 24h soak GO (per docs/qa-audits/2026-05-09-pr-135-prod-deploy.md)
   T6.4 Stage 1 prereqs all satisfied. Ready for ⚡ IMMEDIATE on
   docs/superpowers/dispatch/2026-05-10-t6-4-stage-1-marching-order.md.
   Suggested execution window: 2026-05-10 03:00-05:00 CST.
```

Organizer then issues the `⚡ IMMEDIATE` label to the Stage 1 chat — that's the trigger that unblocks Stage 1's HOLD gate.

---

## 9. ⛔ HOLD blocks (this runbook does NOT execute deploy or cutover)

- This runbook is **monitoring guidance only**. Deploy execution is PR #145; Stage 1 cutover execution is PR #144's Stage 1 MO.
- Do NOT modify `.env.prod`, nginx vhost, systemd units, or any prod state based on this runbook alone. Each of those actions has its own MO + audit trail.
- Anomaly response paths in §6 reference rollback procedures defined in PR #145 §8 — this runbook does not redefine them.
- Customer comms templates are in PR #141; this runbook only documents *when* comms are NOT needed.

---

## 10. Resumption checklist (for execution chat May 9 ~13:30+ CST)

When PR #135 prod deploy completes per PR #145 (Steps 0-6) and Python prod 8083 returns 200 stably:

1. ✅ Read this runbook end-to-end (don't skim — §6 anomaly tree has 7 paths)
2. ✅ Capture T-30min baseline per §1 if not already captured during PR #145 §1 pre-flight (deploy and soak share the same baseline)
3. ✅ Schedule T+1h, T+6h, T+24h checkpoints (use `ScheduleWakeup` or external cron — don't poll manually for hours)
4. ✅ At each checkpoint, run §1 capture command + §5 query templates, write to deploy artifact log per PR #145 §9
5. ✅ At each checkpoint, evaluate the matching threshold table (§2 / §3 / §4)
6. ✅ If any threshold trips, engage §6 anomaly path immediately. Do not "wait and see" — soak with a tripped threshold is a tainted soak; the GO declaration would be false.
7. ✅ At T+24h GO: write the §4 GO summary to deploy artifact log; ping organizer per §8 handoff template.
8. ✅ Open the §4 deploy artifact log PR after GO declaration; cross-link from this runbook in cross-references section of the audit.

If anything STOPS (any §2/§3/§4 BLOCK condition fires): leave prod in current state, paste the stop-output to chat, await organizer instruction. Do **not** unilaterally rollback unless §6 trigger criteria explicitly met (5xx > 1% sustained, or env var leak detected).

---

## 11. Cross-references

- PR [#145](https://github.com/j4xie/my-prototype-logistics/pull/145) (commit `63a44d1d0`) — PR #135 prod deploy MO (this runbook is the §7 expansion)
- PR [#144](https://github.com/j4xie/my-prototype-logistics/pull/144) (commit `0c8f85af7`) — T6.4 Strategy B 5-stage cutover MOs (this runbook's GO unblocks Stage 1 at `docs/superpowers/dispatch/2026-05-10-t6-4-stage-1-marching-order.md`)
- PR [#143](https://github.com/j4xie/my-prototype-logistics/pull/143) (commit `8b8f758752`) — T6.4 baseline metrics (per-factory baseline fixtures used in §8 prereq verify)
- PR [#142](https://github.com/j4xie/my-prototype-logistics/pull/142) (commit `41552a96221d70365162c76dc29280874f5dc5e3`) — rollback rehearsal + backup mislabel finding (referenced in PR #145 §8 nginx-out-of-scope note)
- PR [#141](https://github.com/j4xie/my-prototype-logistics/pull/141) (commit `068ebd8b8`) — customer comms templates (referenced in §7)
- PR [#138](https://github.com/j4xie/my-prototype-logistics/pull/138) (commit `6310f00278`) — chat 1 PR #135 smoke verify (State B + State C confirmed on test 8084)
- PR [#135](https://github.com/j4xie/my-prototype-logistics/pull/135) (commit `2e90a2016`) — Pattern B PR-B v2 impl (the code being soaked)
- Memory `project_2026_05_07_uvicorn_n2_path_x_lite.md` — N=2 leader-gate prod state (worker count baseline = 2 + leader/follower election expected)
- Memory `reference_blue_green_java_deploy.md` — BG flip thresholds (5x6s post-switch verify, ports 10010 ↔ 10020)
- Memory `reference_smartbi_gold_layer_architecture.md` — Pattern B State distribution (F001 has Gold POS data; other factories don't — but this only matters when flag=true, which is forbidden during this soak)
- Memory `project_2026_05_07_t6_2_canary_live.md` — T6.2 cutover live (F001 → Python since 2026-05-07 04:01 CST; Java fallback rate must be 0)
- Memory `project_2026_05_08_t6_3_cutover_live.md` — T6.3 cutover live (61 test factories → Python since 2026-05-08 11:34 CST; Java fallback rate must be 0)
- Memory `project_2026_05_08_t6_4_readiness_gates.md` — T6.4 readiness 3/3 gates closed; PR #135 deploy + 24h soak is the next gate before Stage 1
- Hard rule `.claude/rules/server-operations.md` — systemd unit names, port assignments, env file locations
