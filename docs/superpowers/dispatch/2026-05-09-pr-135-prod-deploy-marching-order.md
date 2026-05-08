# ⚡ PR #135 prod **smoke re-verification** — Pattern B 3-state branching (post-deploy)

**From**: organizer chat (T6.4 prerequisite gate)
**Date**: 2026-05-09 (target execution window: ~13:01 CST May 9 after T6.3 24h soak GO + T6.1 22h BG dryrun GO)
**Block resolved by**: T6.3 24h soak GO (~12:05 CST May 9) + T6.1 22h BG dryrun GO (~13:01 CST May 9)
**Block this resolves**: T6.4 cutover earliest start (~14:00 CST May 10 Strategy B Day 1)
**Deliverable**: 1 PR (smoke re-verification log + 24h soak summary) + ping organizer with 24h GO/NO-GO data

---

## ⚠️ Amendment History (post-PR #157 investigation)

This MO was originally drafted assuming `SMARTBI_GOLD_READ_PRIMARY_ENABLED=false` on prod and PR #135 not yet deployed. Both assumptions are **WRONG** per PR [#157](https://github.com/j4xie/my-prototype-logistics/pull/157) (`45a71487b`) flag-flip investigation:

| # | Original assumption | Reality (per PR #157) | Amendment |
|---|---|---|---|
| 1 | F001 smoke = State C 10-card legacy | F001 = **State A 4-card Gold** (Gold POS data populated since Apr 23) | §5 F001 smoke updated below |
| 2 | F999 + 14 customers smoke not specified | F999 = **State B empty stub**; 14 customers = State B (Gold empty per K-1 audit PR #147 — Java legacy reads same `smart_bi_sales_data` table = 0 rows for all 14 → empty parity) | §5 F999/14 customers smoke added below |
| 3 | §6 HARD RULE: "flag must be `false` or unset" | Flag=true intentional since Apr 23 Phase B Dashboard Gold UI port (memory `project_apr23_dashboard_gold_uiport.md`) — Bug #417 perf fix dependency | §6 HARD RULE rewrite below |
| 4 | "PR #135 to be deployed" | PR #135 (`2e90a2016`) **ALREADY DEPLOYED** via N=2 cutover 2026-05-07 11:36 CST, Python prod log confirms Pattern B 3-state firing | Step 2/3 deploy → re-verification framing |
| 5 | Step 1 worker grep `uvicorn.*:8083` returns 1 only | N=2 workers spawn via `multiprocessing.spawn`, parent grep ≠ worker count (per chat 4 rehearsal `df5ded859` GAP-3) | Step 1 grep replaced |
| 6 | nginx config: `_upstream_cretas.conf` | Actual filename `_upstream_cretas.conf` (per chat 4 rehearsal GAP-2) | §1+§2 filename replaced |

**Net effect**: This MO is now a **smoke re-verification + 24h soak monitoring runbook**, NOT a fresh deploy. Step 2 (Java BG) and Step 3 (Python deploy) are downgraded — Java is optional hygiene cycle, Python deploy is no-op since current code = `2e90a2016`.

---

## Background

PR [#135](https://github.com/j4xie/my-prototype-logistics/pull/135) (`2e90a2016`) shipped the full Pattern B 3-state branching for `_get_finance_overview` in `analysis_finance.py`:

| State | Trigger | Behavior |
|---|---|---|
| **A** | `SMARTBI_GOLD_READ_PRIMARY_ENABLED=true` + Gold POS data populated (e.g. F001) | `_build_finance_overview_from_gold` returns Gold-derived overview (4 KPIs + top_stores rankings) |
| **B** | `SMARTBI_GOLD_READ_PRIMARY_ENABLED=true` + Gold null/empty | `_build_empty_dashboard_response` returns empty stub (Java line 135-142 mirror) |
| **C** | `SMARTBI_GOLD_READ_PRIMARY_ENABLED=false` (default) **OR** flag=true + Gold throws | `_build_finance_overview_legacy` returns 10 KPIs + 3 charts + insights + suggestions |

PR [#138](https://github.com/j4xie/my-prototype-logistics/pull/138) (`6310f00278`) verified States B and C against test env 8084 (State A deferred — needs Gold mock, follow-up). Code review against `FinanceAnalysisServiceImpl.java:111-189` clean per Phase 2A Rules 4 / 8 / 9 / 11 / 12.

**Current prod state** (per PR #157 investigation `45a71487b`):
- `SMARTBI_GOLD_READ_PRIMARY_ENABLED=true` on prod since 2026-04-23 Phase B Dashboard Gold UI port (memory `project_apr23_dashboard_gold_uiport.md`, commits `b1cf06fd8` + `315887092`). Intentional — Bug #417 perf fix (legacy 53s → Gold 228ms) depends on flag=true.
- PR #135 (`2e90a2016`) deployed via N=2 cutover 2026-05-07 11:36 CST. Python prod log confirms Pattern B 3-state firing (`[gold-primary] finance factory=F999 Gold empty — skipping legacy`).
- F001 customer-visible behavior: **State A** (Gold-derived 4 KPIs + top_stores rankings). T6.2 canary routes F001 traffic to Python prod 8083 since 2026-05-07 04:01 CST.
- 14 T6.4 customers (currently on Java 10010): **State B** equivalent — Java's `smart_bi_sales_data` legacy table has 0 rows for all 14 (per K-1 audit PR #147), so Java legacy = empty == Gold empty → byte-shape parity by data state.

**This MO does NOT change flag state**. T6.4 is nginx-routing only.

Per memory `project_2026_05_07_uvicorn_n2_path_x_lite.md`, prod Python (`cretas-python.service`) currently runs N=2 workers (PIDs paired leader+follower). PR #135 deploys to this multi-worker service via the existing `deploy-smartbi-python.sh` flow — both workers cycle in-place, ~30s ONNX warmup per worker.

Per memory `reference_blue_green_java_deploy.md`, prod Java deploy uses **Blue-Green** mode (10010 ↔ 10020, nginx upstream switch on 139). PR #135 has zero Java changes (single-file Python edit), but **deploy Java anyway** to rebuild the JAR + cycle the BG pair so any inflight Java state at 10010 doesn't drift relative to test 10011 (deploy hygiene per `feedback_deploy_pipeline.md` "test long-term stale" pattern).

---

## ⛔ HOLD blocks (read before any step)

1. **DO NOT execute this MO before**:
   - T6.3 24h soak GO confirmed (Python error <0.5%, p99 <2000ms, 0 Java fallback for 61 test factories) — ~12:05 May 9 CST
   - T6.1 22h BG dryrun GO confirmed (chat 4 final report + parity ≥99.94%) — ~13:01 May 9 CST
2. **DO NOT change `SMARTBI_GOLD_READ_PRIMARY_ENABLED` on prod** — it stays `true` (intentional Apr 23 Phase B state per PR #157 + memory `project_apr23_dashboard_gold_uiport.md`). HARD RULE per §6: track current prod state during deploy, do NOT toggle. Flipping back to `false` would revert Bug #417 perf fix (legacy 53s scan).
3. **DO NOT use `bak.t6_3_pre.20260508_032339` as a rollback target for nginx config** — per PR [#142](https://github.com/j4xie/my-prototype-logistics/pull/142), that file contains pre-T6.3 state (T6.2 F001-only regex). T6.4 cutover Step 0 will create a fresh `bak.t6_4_pre.<ts>`; nginx-side is **out of scope for this MO** (PR #135 is code deploy only, no nginx edits).
4. **DO NOT skip the smartbi_migrations tracker check in Step 1** — task #30 incident pattern. PR #135 itself adds zero migrations, but a stale tracker would cause the deploy hook to fail late in Step 3.
5. **DO NOT push during draft** — this MO is doc-only. Local commit + ping organizer.

---

## Step 0 — Worktree

```bash
cd C:/Users/Steve/my-prototype-logistics
# Re-fetch in case T6.1/T6.3 chats land follow-ups while waiting
git fetch origin
git worktree add .worktrees/pr-135-prod-deploy -b ops-pr-135-prod-deploy origin/main
cd .worktrees/pr-135-prod-deploy
pwd
git branch --show-current   # should print: ops-pr-135-prod-deploy
git log -1 --oneline         # confirm tip includes PR #135 (commit 2e90a2016) + #138 + #141 + #142 + #143
```

Verify the deploy scripts in this worktree match `origin/main` (no in-flight chat-2 edits to `deploy-backend.sh` or `deploy-smartbi-python.sh`):

```bash
git diff origin/main scripts/deploy/deploy-backend.sh scripts/deploy/deploy-smartbi-python.sh
# expect empty
```

---

## Step 1 — Pre-flight

Capture baseline state so post-deploy comparison is meaningful. Run the SSH block as a single connection to minimize round-trip noise.

```bash
ssh root@47.100.235.168 "
set -euo pipefail

echo '=== git rebase preflight (worktree must be on origin/main) ==='
cd /www/wwwroot/cretas/code
git fetch origin
git log -1 origin/main --oneline
git status --short
echo

echo '=== smartbi_migrations tracker check (expect 35 rows per env) ==='
source /www/wwwroot/cretas/.env.prod
PGPASSWORD=\"\$SMARTBI_DB_PASSWORD\" psql -U cretas_user -d \"\$SMARTBI_DB_NAME\" -h localhost -At -c \"
  SELECT COUNT(*) AS prod_count FROM smartbi_migrations;
\"
PGPASSWORD=\"\$DB_PASSWORD\" psql -U cretas_user -d cretas_db -h localhost -At -c \"SELECT 1;\" >/dev/null   # sanity
PGPASSWORD=\"\$SMARTBI_DB_PASSWORD\" psql -U cretas_user -d smartbi_db -h localhost -At -c \"
  SELECT COUNT(*) AS test_count FROM smartbi_migrations;
\"
echo

echo '=== systemd state baseline (record NRestarts before deploy) ==='
systemctl show cretas-backend       --property=NRestarts --property=ActiveEnterTimestamp --property=MainPID
systemctl show cretas-backend-green --property=NRestarts --property=ActiveEnterTimestamp --property=MainPID || true
systemctl show cretas-python        --property=NRestarts --property=ActiveEnterTimestamp --property=MainPID
echo

echo '=== Java heap baseline (prod 10010 — record before BG flip) ==='
JAVA_PID=\$(systemctl show cretas-backend --property=MainPID --value)
if [ \"\$JAVA_PID\" -gt 0 ]; then
  jstat -gc \"\$JAVA_PID\" 2>/dev/null | tail -1 || echo '  jstat unavailable (jdk-tools not installed for non-root jvm)'
  ps -o pid,vsz,rss,cmd -p \"\$JAVA_PID\" | tail -1
fi
echo

echo '=== Python prod 8083 multi-worker baseline (expect 1 leader + 1 follower from PR-3 #109) ==='
ss -tlnp | grep ':8083' || true
# Per chat 4 rehearsal df5ded859 GAP-3: parent grep returns 1 (only uvicorn root matches),
# workers spawn via multiprocessing.spawn so use --ppid for accurate N=2 verify
PYTHON_MAINPID=\$(systemctl show cretas-python --property=MainPID --value)
echo \"  parent uvicorn PID: \$PYTHON_MAINPID\"
echo \"  spawn_main worker count: \$(ps --ppid \$PYTHON_MAINPID 2>/dev/null | grep -c spawn_main || echo 0)\"  # expect 2
echo

echo '=== Active Java BG color check (which port nginx upstream points to) ==='
ssh -o StrictHostKeyChecking=no root@139.196.165.140 \"grep -oP 'server 47\\\\.100\\\\.235\\\\.168:\\\\K[0-9]+' /www/server/panel/vhost/nginx/_upstream_cretas.conf | head -1\"
echo

echo '=== Health snapshot (all 4 ports) ==='
curl -s -o /dev/null -w 'java prod 10010: %{http_code}\n' http://localhost:10010/api/mobile/health
curl -s -o /dev/null -w 'java prod 10020: %{http_code}\n' http://localhost:10020/api/mobile/health || true
curl -s -o /dev/null -w 'java test 10011: %{http_code}\n' http://localhost:10011/api/mobile/health
curl -s -o /dev/null -w 'python prod 8083: %{http_code}\n' http://localhost:8083/health
curl -s -o /dev/null -w 'python test 8084: %{http_code}\n' http://localhost:8084/health
echo

echo '=== T6.3 cutover regex still in place (sanity) ==='
ssh root@139.196.165.140 \"grep -oE 'F001\\|FOOD_3101|TEST_0000_001' /www/server/panel/vhost/nginx/api.cretaceousfuture.com.conf | head -3\"
"
```

**Record into deploy log** (`docs/qa-audits/2026-05-09-pr-135-prod-deploy.md` — created in Step 9):

- `prod_count` and `test_count` from smartbi_migrations (expect both 35; if drift → STOP, ping organizer)
- `cretas-backend.NRestarts` (post-deploy must equal `pre + 0` if BG works; +1 acceptable if old blue auto-restart fires during cleanup)
- `cretas-python.NRestarts` (post-deploy = `pre + 1`, in-place restart)
- Active BG color (10010 vs 10020) — Step 2 will flip to the *other* one
- Heap baseline RSS for ratio compare in §7
- All 5 health checks return 200 (10020 may 404/connection-refused if currently idle — that's expected pre-deploy)

**STOP and ping organizer if**:
- smartbi_migrations row count != 35 on either env
- `cretas-python.MainPID` is 0 OR `spawn_main worker count != 2` (PR-3 N=2 leader gate broken — pre-existing)
- T6.3 regex no longer present in nginx vhost (someone moved it back during the night)
- Python prod 8083 returns non-200 (T6.3 24h soak might already be tainted)
- `SMARTBI_GOLD_READ_PRIMARY_ENABLED != true` on prod (someone flipped flag back unilaterally — pre-MO discrepancy, do NOT toggle, ping organizer to investigate)

---

## Step 2 — Blue-Green Java deploy (OPTIONAL hygiene cycle, per PR #157 amendment)

⚠️ **Amendment**: PR #135 was deployed via N=2 cutover 2026-05-07. This MO is now smoke re-verification. Java BG cycle is **optional** — only run if you want pre-T6.4 BG path verification (T6.4 depends on Java being deployable mid-cutover for any emergency hotfix). Memory `feedback_deploy_pipeline.md` "test long-term stale" — `--env prod` defaults to prod-only; deploy-backend.sh v4.2's defensive ping will warn if test 10011 is already stale.

**Skip Step 2 if**: BG dryrun task `bccuc6z3e` already verified BG path within last 24h (T6.1 22h dryrun completion confirms BG flip works end-to-end). In that case, jump to Step 4 health check + Step 5 smoke.

```bash
# From worktree root
./scripts/deploy/deploy-backend.sh --env prod --mode bluegreen
```

**Watch the output for**:

```text
🔄 [3b] Blue-Green 切换...
   当前 active: blue (10010) → 切换到: green (10020)        # OR reverse if active was 10020
   [BG 1/4] 启动 green (cretas-backend-green)...
   [BG 2/4] 等待 green 健康 (远端 loop, 最多 150s)...
   ✓ green 健康 (XXs, 远端计数: YYs)                          # YY = systemd-reported uptime, ~80s expected for Spring Boot warmup
   [BG 3/4] 切换 139 nginx upstream: 10010 → 10020...
   ✓ upstream 切换完成
   ✓ 切换后健康轮次 1/5: HTTP=200 systemd=active             # 5x6s = 30s post-switch verify window
   ...
   ✓ 切换后健康轮次 5/5: HTTP=200 systemd=active
   ✓ 切换后验证全部通过 (5/5 轮 nginx 200 + idle systemd active)
   [BG 4/4] 停旧 active (blue cretas-backend), 5s 优雅等待...
   [BG 5/5] Systemd 收尾检查...
```

If any post-switch round fails (HTTP != 200 or systemd != active), deploy-backend.sh **auto-rollbacks**: nginx upstream reverts, jar restored from `aims-0.0.1-SNAPSHOT.jar.bak.<ts>`, old active service restarted. The script exits 1. Ping organizer immediately with the failed round number and `journalctl -u cretas-backend-green --since '5 min ago' --no-pager | tail -50`.

**Smoke after Java BG flip** (the deploy script's 5x6s already covers nginx-side; this is for direct-port confirmation):

```bash
ssh root@47.100.235.168 "
echo '=== new active port (should be the flipped one) ==='
ss -tlnp | grep -E ':10010|:10020' | grep LISTEN
echo
echo '=== old port should NOT be listening (5s grace already passed) ==='
echo
echo '=== prod Java health via direct port ==='
ACTIVE_PORT=\$(ssh root@139.196.165.140 \"grep -oP 'server 47\\\\.100\\\\.235\\\\.168:\\\\K[0-9]+' /www/server/panel/vhost/nginx/_upstream_cretas.conf | head -1\")
curl -s -o /dev/null -w '%{http_code}' \"http://localhost:\$ACTIVE_PORT/api/mobile/health\"
echo
"
```

---

## Step 3 — Python deploy (NO-OP per PR #157 amendment — already deployed May 7)

⚠️ **Amendment**: Per PR #157 investigation, PR #135 (`2e90a2016`) is **already on prod disk** (verified via `cd /www/wwwroot/cretas/code && git log --oneline -1`). Python prod uptime since 2026-05-07 11:36 CST = N=2 cutover deploy that brought PR #135 with it. Pattern B 3-state branching IS firing — log evidence: `[gold-primary] finance factory=F999 Gold empty — skipping legacy`.

**Skip Step 3 default — re-deploy is no-op**. Only run `deploy-smartbi-python.sh --env prod` if:
1. You suspect rsync drift (Python prod log shows pre-PR-#135 behavior despite commit being on disk), OR
2. You want fresh systemd cycle for N=2 worker re-verification

If running anyway: PR #135's only file change is `backend/python/smartbi_compat/api/analysis_finance.py`. The deploy script syncs `backend/python/` to the server, runs the migration runner (Step 3.5 — should be no-op since PR #135 adds no migrations), then `systemctl restart cretas-python` which cycles both N=2 workers (~30s ONNX warmup × 2 sequential).

```bash
./scripts/deploy/deploy-smartbi-python.sh --env prod
```

**Watch the output for**:

```text
[INFO] [3/5] 同步文件到服务器 (rsync 增量传输)...
[INFO] [3b/5] 同步 ops scripts (T6 dryrun + Java baseline)...
[INFO] [3.5/5] 应用 smartbi migrations (env=prod)...
[INFO]   No pending migrations (35 already applied)            # expected — PR #135 adds zero V*.sql
[INFO] [4/5] 安装依赖...
[INFO] [4.5/5] 重启 Python 服务 (环境: prod)...
Production Python restarted (systemd)
[INFO] [5/5] 健康检查...
✓ python prod 8083 healthy
```

**ONNX warmup wait** — the script's health check exits as soon as 8083 returns 200, but the *first request* per worker may still hit cold-start ONNX load. Manually verify after the script returns:

```bash
ssh root@47.100.235.168 "
echo '=== both workers re-spawned ==='
ps aux | grep 'uvicorn.*:8083' | grep -v grep | awk '{print \$2, \$10, \$11}' | head -5
echo
echo '=== leader/follower election (PR-2 #103 leader gate verify) ==='
journalctl -u cretas-python --since '2 min ago' --no-pager | grep -E 'leader|follower|background tasks armed' | tail -10
echo
echo '=== sleep 35s for ONNX warmup, then probe ==='
sleep 35
for i in 1 2 3; do
  curl -s -o /dev/null -w 'probe \$i: %{http_code} (%{time_total}s)\n' http://localhost:8083/health
done
"
```

**STOP and ping organizer if**:
- migration runner reports any `apply` (not "no pending") — PR #135 should be zero migrations; any apply is unexpected scope creep
- `cretas-python` systemd unit doesn't reach `active (running)` within 90s of restart
- ONNX probe takes >5s after sleep 35s — workers may have crashed and restart-looped (check `journalctl -u cretas-python --since '5 min ago'` for tracebacks)
- `journalctl` shows leader/follower election didn't fire (PR-3 leader gate broken — `_workers_ready_count` stuck at 0)

---

## Step 4 — Health check (all 4 ports + nginx 139)

After Steps 2 + 3, run a consolidated health snapshot. All 5 must be 200; nginx-side covers the customer-visible path.

```bash
ssh root@47.100.235.168 "
echo '=== Direct loopback (server-side) ==='
curl -s -o /dev/null -w 'java prod active: %{http_code}\n' http://localhost:10010/api/mobile/health
curl -s -o /dev/null -w 'java prod green:  %{http_code}\n' http://localhost:10020/api/mobile/health
curl -s -o /dev/null -w 'java test 10011:  %{http_code}\n' http://localhost:10011/api/mobile/health
curl -s -o /dev/null -w 'python prod 8083: %{http_code}\n' http://localhost:8083/health
curl -s -o /dev/null -w 'python test 8084: %{http_code}\n' http://localhost:8084/health
"

ssh root@139.196.165.140 "
echo '=== Customer-visible path (139 nginx) ==='
curl -sk -o /dev/null -w 'nginx api: %{http_code}\n' -H 'Host: api.cretaceousfuture.com' https://127.0.0.1/api/mobile/health
"
```

Expected: 1 of {10010, 10020} returns 200 (the active one); the other returns 200 **or** connection-refused (BG cycle leaves the old active stopped — that's expected, not an error). All other ports + nginx return 200.

---

## Step 5 — Pattern B 3-state prod smoke (re-verification under flag=true)

⚠️ **Amendment per PR #157**: Prod has flag=true since Apr 23 + PR #135 deployed since May 7 N=2 cutover. **All 3 states are exercised by real traffic** — F001 hits State A (Gold-derived), F999 hits State B (Gold empty stub), exception path hits State C legacy fallback. This is **the primary verification step** of this MO, replacing the original "fresh-deploy smoke".

State A/B verify on **prod 8083 directly** (T6.2 routes F001 through Python prod since May 7). Test env 8084 verify still optional sanity.

### State A — F001 (Gold POS populated, real customer traffic via T6.2)

```bash
ssh root@47.100.235.168 "
set -a; source /www/wwwroot/cretas/.env.prod; set +a
TOKEN=\$(FACTORY_ID=F001 python3 -c '
import jwt, os, time
print(jwt.encode({
    \"userId\": 1, \"username\": \"pr135_prod_smoke\",
    \"factoryId\": os.environ[\"FACTORY_ID\"], \"role\": \"factory_super_admin\",
    \"exp\": int(time.time()) + 3600,
}, os.environ[\"JWT_SECRET\"], algorithm=\"HS256\")
' | tr -d '\n')

# Note: hits Python prod 8083 directly (loopback) — bypasses 139 nginx routing.
# F001 has Gold POS data per task #20 reversal + Apr 23 Phase B deployment.
# With flag=true (Apr 23 baseline), Gold-primary path returns 4-card State A shape.
curl -s -H \"Authorization: Bearer \$TOKEN\" \
  'http://localhost:8083/api/mobile/F001/smart-bi/analysis/finance?startDate=2025-01-01&endDate=2025-12-31' \
  | python3 -c 'import json,sys; r=json.load(sys.stdin); ov=r[\"data\"][\"overview\"]; cards=ov[\"kpiCards\"]; rk=ov.get(\"rankings\",{}); print(f\"State A: kpiCards={len(cards)} keys={[c[\\\"key\\\"] for c in cards]} top_stores={len(rk.get(\\\"top_stores\\\",[]))}\")'
"
```

**Expected (State A)**: `kpiCards=4 keys=['total_revenue', 'bill_count', 'avg_bill_value', 'store_count'] top_stores≤10`. Charts/aiInsights/suggestions empty per `GoldDashboardBuilder.java:31-35` ("Gold doesn't emit those yet").

⚠️ **STOP, ping organizer if** F001 returns 10-card legacy shape — this would mean either (a) Python rsync drift corrupted PR #135 impl, or (b) flag was unilaterally flipped to false on prod (verify §6 first).

### State B — F999 (no Gold POS data, empty stub via Gold-empty)

```bash
ssh root@47.100.235.168 "
set -a; source /www/wwwroot/cretas/.env.prod; set +a
TOKEN=\$(FACTORY_ID=F999 python3 -c '
import jwt, os, time
print(jwt.encode({
    \"userId\": 1, \"username\": \"pr135_prod_smoke\",
    \"factoryId\": os.environ[\"FACTORY_ID\"], \"role\": \"factory_super_admin\",
    \"exp\": int(time.time()) + 3600,
}, os.environ[\"JWT_SECRET\"], algorithm=\"HS256\")
' | tr -d '\n')

curl -s -H \"Authorization: Bearer \$TOKEN\" \
  'http://localhost:8083/api/mobile/F999/smart-bi/analysis/finance?startDate=2025-01-01&endDate=2025-12-31' \
  | python3 -c 'import json,sys; r=json.load(sys.stdin); ov=r[\"data\"][\"overview\"]; print(f\"State B: kpiCards={len(ov[\\\"kpiCards\\\"])} charts={len(ov[\\\"charts\\\"])}\")'
"
```

**Expected (State B)**: `kpiCards=0 charts=0` (empty stub, Java line 135-142 mirror, `_build_empty_dashboard_response`). Confirmed by `journalctl -u cretas-python | grep "factory=F999 Gold empty — skipping legacy"`.

### State B equivalent — 14 T6.4 customers (currently on Java 10010, will move to Python in T6.4)

Per K-1 audit PR #147 (`a687814bd`), all 14 T6.4 customers have **0 rows** in `smart_bi_sales_data` (Java legacy table). Python's `_build_empty_dashboard_response` and Java's empty legacy fallback both return identical empty shape — **byte-shape parity by data state**, not by code.

```bash
# Sample 3 of 14 to confirm Java side empty (currently nginx routes them to Java 10010):
ssh root@47.100.235.168 "
set -a; source /www/wwwroot/cretas/.env.prod; set +a
for FID in F002 R001 RES_GML_001; do
  TOKEN=\$(FACTORY_ID=\$FID python3 -c '
import jwt, os, time, sys
print(jwt.encode({
    \"userId\": 1, \"username\": \"pr135_prod_smoke\",
    \"factoryId\": sys.argv[1], \"role\": \"factory_super_admin\",
    \"exp\": int(time.time()) + 3600,
}, os.environ[\"JWT_SECRET\"], algorithm=\"HS256\")
' \$FID | tr -d '\n')
  echo \"--- \$FID (Java 10010) ---\"
  curl -s -H \"Authorization: Bearer \$TOKEN\" \
    \"http://localhost:10010/api/mobile/\$FID/smart-bi/analysis/finance?startDate=2025-01-01&endDate=2025-12-31\" \
    | python3 -c 'import json,sys; r=json.load(sys.stdin); ov=r[\"data\"][\"overview\"]; print(f\"  Java empty: kpiCards={len(ov[\\\"kpiCards\\\"])} charts={len(ov[\\\"charts\\\"])}\")'
done
"
```

**Expected (14-customer State B equivalent)**: each returns `kpiCards=0 charts=0` (Java legacy empty). Post-T6.4 cutover, Python will emit identical shape via Pattern B State B (Gold empty → empty stub). Parity verified.

### State C — exception fallback (legacy 10-card shape)

State C only fires on Gold pool exception OR `SMARTBI_GOLD_READ_PRIMARY_ENABLED=false` (default code-level fallback). Neither is exercised by current prod traffic — verified via Python prod log absence of `[gold-primary] failed, falling back to legacy` messages in last 24h.

State C remains code-tested via `tests/python/smartbi_compat/test_pattern_b_3state.py` (PR #137 16 tests + 5 goldens). Prod runtime State C verification = "log scan shows zero exception fallbacks in 24h soak" per Step 7.

### State A + State B — test env 8084 (optional sanity, NO prod flag flip)

PR #138 already verified State B+C against test 8084 with `2e90a2016`. Re-running on test env post-PR #157 is **optional sanity** — only do it if Step 5 prod smoke shows unexpected results or you want fresh evidence in the verification log. Test env can have flag toggled freely (separate `.env.test`); prod stays untouched per §6 HARD RULE:

```bash
# Optional — test env smoke (prod env stays untouched)
ssh root@47.100.235.168 "
# Backup current .env.test, flip flag, restart test, smoke, restore
cp /www/wwwroot/cretas/.env.test /www/wwwroot/cretas/.env.test.bak.pr135-deploy.\$(date +%Y%m%d_%H%M%S)
sed -i 's/^SMARTBI_GOLD_READ_PRIMARY_ENABLED=.*/SMARTBI_GOLD_READ_PRIMARY_ENABLED=true/' /www/wwwroot/cretas/.env.test
grep SMARTBI_GOLD_READ_PRIMARY_ENABLED /www/wwwroot/cretas/.env.test    # confirm true
bash /www/wwwroot/cretas/restart-test.sh
sleep 35    # ONNX warmup on test 8084

set -a; source /www/wwwroot/cretas/.env.test; set +a
TOKEN=\$(FACTORY_ID=F999 python3 -c '
import jwt, os, time
print(jwt.encode({
    \"userId\": 1, \"username\": \"pr135_test_state_b\",
    \"factoryId\": os.environ[\"FACTORY_ID\"], \"role\": \"factory_super_admin\",
    \"exp\": int(time.time()) + 3600,
}, os.environ[\"JWT_SECRET\"], algorithm=\"HS256\")
' | tr -d '\n')

# State B — F999 (Gold null) → empty stub
curl -s -H \"Authorization: Bearer \$TOKEN\" \
  'http://localhost:8084/api/mobile/F999/smart-bi/analysis/finance?startDate=2025-01-01&endDate=2025-12-31' \
  | python3 -c 'import json,sys; r=json.load(sys.stdin); ov=r[\"data\"][\"overview\"]; print(f\"kpiCards=\\\"{len(ov[\\\"kpiCards\\\"])}\\\" charts=\\\"{len(ov[\\\"charts\\\"])}\\\"\")'
# Expect: kpiCards=0 charts=0   (empty stub, Java line 135-142 mirror)

# State A — F001 (Gold populated) → 4 KPI Gold shape
TOKEN_F001=\$(FACTORY_ID=F001 python3 -c '
import jwt, os, time
print(jwt.encode({
    \"userId\": 1, \"username\": \"pr135_test_state_a\",
    \"factoryId\": os.environ[\"FACTORY_ID\"], \"role\": \"factory_super_admin\",
    \"exp\": int(time.time()) + 3600,
}, os.environ[\"JWT_SECRET\"], algorithm=\"HS256\")
' | tr -d '\n')
curl -s -H \"Authorization: Bearer \$TOKEN_F001\" \
  'http://localhost:8084/api/mobile/F001/smart-bi/analysis/finance?startDate=2025-01-01&endDate=2025-12-31' \
  | python3 -c 'import json,sys; r=json.load(sys.stdin); ov=r[\"data\"][\"overview\"]; cards=ov[\"kpiCards\"]; print(f\"kpiCards={len(cards)} keys={[c[\\\"key\\\"] for c in cards]}\")'
# Expect: kpiCards=4 keys=['total_revenue', 'bill_count', 'avg_bill_value', 'store_count']

# Restore test env
cp /www/wwwroot/cretas/.env.test.bak.pr135-deploy.* /www/wwwroot/cretas/.env.test
grep SMARTBI_GOLD_READ_PRIMARY_ENABLED /www/wwwroot/cretas/.env.test    # confirm false again
bash /www/wwwroot/cretas/restart-test.sh
sleep 35
"
```

**STOP and ping organizer if** State B returns non-empty kpiCards on test (Pattern B State B regressed) **or** State A returns the 10-card legacy shape on test (Pattern B State A regressed). Either indicates the rsync/restart path corrupted PR #135 impl.

---

## Step 6 — `SMARTBI_GOLD_READ_PRIMARY_ENABLED` env var verify

⛔ **HARD RULE (post-PR #157 amendment): track current prod state during deploy — do NOT toggle flag.**

Current prod state: `SMARTBI_GOLD_READ_PRIMARY_ENABLED=true` since 2026-04-23 Phase B Dashboard Gold UI port (intentional, documented in memory `project_apr23_dashboard_gold_uiport.md`). Bug #417 perf fix (legacy 53s scan → Gold 228ms) depends on flag=true. PR #135 deploys the code that respects this flag for Python's analysis path (Java side has been Gold-primary since Apr 23).

**Do NOT flip flag back to false** — that would revert the Apr 23 Phase B work + Bug #417 fix. Any future flag-toggle requires separate marching order with explicit business trigger (per PR #157 §5).

```bash
ssh root@47.100.235.168 "
echo '=== prod .env.prod flag (must be true per Apr 23 Phase B baseline) ==='
grep -E '^SMARTBI_GOLD_READ_PRIMARY_ENABLED' /www/wwwroot/cretas/.env.prod
echo
echo '=== Running prod Python process env (must show true — inherited from .env.prod via systemd EnvironmentFile) ==='
PID=\$(systemctl show cretas-python --property=MainPID --value)
if [ \"\$PID\" -gt 0 ]; then
  tr '\\0' '\\n' < /proc/\$PID/environ | grep SMARTBI_GOLD_READ_PRIMARY_ENABLED
fi
echo
echo '=== Sister flags (Phase B baseline — should all match Apr 23 state) ==='
grep -E '^(SMARTBI_GOLD_SHADOW_READ_ENABLED|SMARTBI_ENABLE_SILVER_DUAL_WRITE|ALIYUN_OSS_ENABLED)' /www/wwwroot/cretas/.env.prod
"
```

**Expected** (per PR #157 + Apr 23 state):
- `SMARTBI_GOLD_READ_PRIMARY_ENABLED=true`
- `SMARTBI_GOLD_SHADOW_READ_ENABLED=false`
- `SMARTBI_ENABLE_SILVER_DUAL_WRITE=true`
- `ALIYUN_OSS_ENABLED=true`

If any flag mismatches Apr 23 baseline, **STOP, ping organizer** — someone may have unilaterally edited `.env.prod` outside this MO scope.

---

## Step 7 — 24h soak monitor

T6.4 cutover is gated on PR #135 surviving 24h prod soak with no regression. Schedule three checkpoints (T+1h, T+6h, T+24h) — at each checkpoint capture the same diagnostics and compare against Step 1 baseline.

### Per-checkpoint command

```bash
ssh root@47.100.235.168 "
set -euo pipefail
echo '===== checkpoint $(date -Iseconds) ====='

echo '--- systemd state (NRestarts must equal post-deploy baseline + 0) ---'
systemctl show cretas-backend       --property=NRestarts --property=ActiveEnterTimestamp
systemctl show cretas-backend-green --property=NRestarts --property=ActiveEnterTimestamp
systemctl show cretas-python        --property=NRestarts --property=ActiveEnterTimestamp

echo '--- Python prod 8083 worker count (must stay N=2) ---'
ps aux | grep 'uvicorn.*:8083' | grep -v grep | wc -l
ss -tlnp | grep ':8083'

echo '--- Python prod RSS (warn if >4GB total = 2GB/worker = 33% headroom of 16GB box) ---'
ps -o pid,rss,cmd --no-headers -p \$(pgrep -f 'uvicorn.*:8083' | tr '\n' ',') | awk '{rss+=\$2} END {printf \"total RSS = %.1f GB\\n\", rss/1024/1024}'

echo '--- Java active port heap RSS ---'
JAVA_PID=\$(systemctl show cretas-backend --property=MainPID --value)
[ \"\$JAVA_PID\" -gt 0 ] && ps -o pid,rss,cmd --no-headers -p \"\$JAVA_PID\" | awk '{printf \"java active RSS = %.1f GB\\n\", \$2/1024/1024}'

echo '--- 5xx rate last 1h (Python prod log) ---'
tail -50000 /www/wwwroot/cretas/python-prod.log 2>/dev/null \
  | awk '/HTTP\\/1\\.1\" 5/' | wc -l
echo '(divide by total request count from journalctl for ratio — see below)'

echo '--- Pattern B exception scan in Python prod log (last 1h, expect 0) ---'
journalctl -u cretas-python --since '1 hour ago' --no-pager \
  | grep -iE '_build_finance_overview_from_gold|_build_finance_overview_legacy|gold.*throw|gold.*null' || true
journalctl -u cretas-python --since '1 hour ago' --no-pager \
  | grep -iE 'traceback|exception' | grep -iE 'analysis_finance|smartbi_compat' | head -20

echo '--- Java fallback rate (T6.3 + T6.2 cutover scope: zero allowed) ---'
journalctl -u cretas-backend --since '1 hour ago' --no-pager \
  | grep -iE 'fallback.*python|python.*fallback' | wc -l

echo '--- Health snapshot ---'
curl -s -o /dev/null -w 'java prod active: %{http_code}\\n' http://localhost:10010/api/mobile/health
curl -s -o /dev/null -w 'java prod green:  %{http_code}\\n' http://localhost:10020/api/mobile/health
curl -s -o /dev/null -w 'python prod 8083: %{http_code}\\n' http://localhost:8083/health
"
```

### GO criteria (all must hold at T+24h)

| Metric | Threshold | Source |
|---|---|---|
| `cretas-python.NRestarts` | Equal to post-deploy baseline + 0 (no auto-restart fired during soak) | This MO Step 1 |
| `cretas-backend.NRestarts` (active) | Equal to post-deploy baseline + 0 | This MO Step 1 |
| Python prod worker count | Stays = 2 (PR-3 N=2 leader gate stable) | Memory `project_2026_05_07_uvicorn_n2_path_x_lite.md` |
| Python prod total RSS | < 4 GB (2 GB/worker × 2 = 4 GB cap, 33% headroom on 16 GB box) | Same memory |
| Java active RSS | < 3 GB (Spring Boot + Embedding service share heap budget) | `feedback_deploy_pipeline.md` |
| 5xx rate per-endpoint (1h rolling) | < 0.5% | T6.2/T6.3 GO criteria precedent |
| p99 latency per-endpoint | < 2000 ms | Same |
| Java fallback rate | = 0 for T6.2 (F001) and T6.3 (61 test factories) cutover scope | `project_2026_05_07_t6_2_canary_live.md` |
| Pattern B exception count | = 0 (`from_gold` / `legacy` / Gold-throw paths) in `journalctl` last 24h | This MO §5 |

### NO-GO triggers (action: rollback per §8 + ping organizer)

- Any `cretas-python` auto-restart fires unprompted (NRestarts increment)
- 5xx rate > 0.5% for >5 min on any endpoint in T6.2/T6.3 scope
- Memory growth > 5%/hour (heap leak indicator) sustained 3+ hours
- Pattern B exception in logs (means flag was inadvertently flipped on prod or Gold queries broke)
- Java fallback hit (T6.2/T6.3 test factories should be 100% Python-served)

---

## Step 8 — Rollback procedure

PR #135 changes are **reversible at three layers**, in order of preference:

### 8a — Java BG flip back (instant, milliseconds)

If post-deploy Java BG flip exposes a regression (unlikely since PR #135 has 0 Java changes, but BG cycle still cycles JVM):

```bash
./scripts/deploy/deploy-backend.sh --rollback
```

This re-flips nginx upstream to the previous `bak.<ts>` jar's port, restarts old active. <2 min total.

### 8b — Python git revert + redeploy (~5 min)

If PR #135 Python code regresses (e.g., post-deploy Pattern B exception in real traffic that test 8084 didn't catch):

```bash
# In a NEW worktree (don't touch this MO's worktree)
cd C:/Users/Steve/my-prototype-logistics
git fetch origin
git worktree add .worktrees/pr-135-revert -b ops-pr-135-revert origin/main
cd .worktrees/pr-135-revert
git revert 2e90a2016 --no-edit    # PR #135 commit
# Push + admin merge revert PR
git push -u origin ops-pr-135-revert
gh pr create --title "revert: PR #135 — Pattern B PR-B v2" --body "Emergency revert. See deploy log."
# After admin merge:
./scripts/deploy/deploy-smartbi-python.sh --env prod
```

Soak after revert: same Step 7 checkpoints, but expect baseline = pre-#135 state (legacy code path only).

### 8c — Manual escape hatch (if both fail)

If BG rollback + git revert both fail (e.g., deploy script itself broken), engage memory `feedback_deploy_pipeline.md` "manual escape" — restore jar from `aims-0.0.1-SNAPSHOT.jar.bak.<ts>` directly:

```bash
ssh root@47.100.235.168 "
LAST_BAK=\$(ls -t /www/wwwroot/cretas/aims-0.0.1-SNAPSHOT.jar.bak.* | head -1)
echo \"restoring from: \$LAST_BAK\"
cp \"\$LAST_BAK\" /www/wwwroot/cretas/aims-0.0.1-SNAPSHOT.jar
systemctl restart cretas-backend
"
```

For Python, restart is in-place; if rsync corrupted code, git checkout the prior commit on server-side `/www/wwwroot/cretas/code/` and `systemctl restart cretas-python`.

### nginx config rollback — out of scope

PR #135 is **code-only**. Nginx vhost stays untouched. **Do not** reference `bak.t6_3_pre.20260508_032339` for any rollback decision in this MO — that file is mislabeled (T6.2 state, per PR #142 finding) and is reserved for T6.4 cutover Step 0 forensics, not for code-deploy rollback.

---

## Step 9 — Deploy artifact log

Create `docs/qa-audits/2026-05-09-pr-135-prod-deploy.md` with:

- **Header**: deploy timestamp, BG flip direction (e.g., 10010 → 10020), commit deployed (`2e90a2016`), pre/post systemd state diff
- **Step 1 baseline snapshot**: smartbi_migrations rowcounts, NRestarts, RSS baselines
- **Step 2 BG output**: copy-paste `[BG 1/4]` through `[BG 5/5]` lines + post-switch 5/5 rounds
- **Step 3 Python output**: copy-paste `[3.5/5]` through `[5/5]` + ONNX warmup probe times
- **Step 5 smoke results table** (amended per PR #157 — flag=true Apr 23 baseline):
  | State | Factory | Path | Expected kpiCards | Expected top_stores | Result |
  |---|---|---|---:|---:|---|
  | A | F001 | Python prod 8083 | 4 (revenue/bills/avgBill/stores) | ≤10 | ✅ |
  | B | F999 | Python prod 8083 | 0 | n/a | ✅ |
  | B-equiv | F002 | Java 10010 (pre-T6.4) | 0 | n/a | ✅ |
  | B-equiv | R001 | Java 10010 (pre-T6.4) | 0 | n/a | ✅ |
  | B-equiv | RES_GML_001 | Java 10010 (pre-T6.4) | 0 | n/a | ✅ |
  | A (test) | F001 | Python test 8084 | 4 | ≤10 | ✅ (optional sanity) |
  | B (test) | F999 | Python test 8084 | 0 | n/a | ✅ (optional sanity) |
- **Step 6 env var verify**: paste output confirming flag=true on prod (matches Apr 23 Phase B baseline)
- **Step 7 24h soak data**: T+1h, T+6h, T+24h checkpoint outputs side-by-side
- **GO/NO-GO verdict** at T+24h

Local commit + push + PR with title like:

```text
audit(t6-4): PR #135 prod deploy + 24h soak — Pattern B 3-state code prerequisite
```

---

## Step 10 — T6.4 GO criteria + handoff to T6.4 cutover chat

When all Step 7 thresholds hold at T+24h, T6.4 trigger is unblocked. Ping organizer with:

```text
✅ PR #135 prod re-verification + 24h soak GO (commit 2e90a2016 deployed 2026-05-07 11:36 CST via N=2 cutover)
   - cretas-python NRestarts: <pre> → <post> (Δ=0 over 24h soak window)
   - cretas-backend NRestarts: <pre> → <post> (Δ=0 over 24h)
   - Python prod RSS @T+24h: <X.X> GB (cap 4 GB)
   - Java active RSS @T+24h: <X.X> GB (cap 3 GB)
   - 5xx rate per-endpoint p99: <X.XX>% (cap 0.5%)
   - p99 latency per-endpoint: <XXX> ms (cap 2000 ms)
   - Java fallback hits: 0 (T6.2 + T6.3 cutover scope)
   - Pattern B exception count: 0 (no `[gold-primary] failed, falling back to legacy` in 24h log)
   - flag=true on prod confirmed (Apr 23 Phase B baseline preserved)
   - State A smoke F001 ✅ (4-card Gold)
   - State B smoke F999 ✅ (empty stub)
   - State B-equiv 14 T6.4 customers (Java 10010) ✅ (empty per K-1 audit)
   T6.4 cutover unblocked. Customer comms T-24h notice (per PR #141) → schedule Strategy B Day 1 (F002 + F003) for ~03:00 CST May 10.
```

If any criterion fails, ping with NO-GO summary + which `--rollback` path was engaged.

---

## Resumption checklist (for execution chat May 9 ~13:01 CST)

When this MO triggers (T6.3 24h soak GO + T6.1 22h dryrun GO both confirmed):

1. ✅ Read this MO end-to-end (not skim — Step 1 alone has 6 stop conditions)
2. ✅ Read latest state of memory `project_2026_05_08_t6_4_readiness_gates.md` for any drift since 2026-05-08
3. ✅ `cd .worktrees/pr-135-prod-deploy` (created via Step 0 — re-do `git fetch + worktree add` if absent)
4. ✅ Run Step 1 in **one** SSH session, capture full output to deploy log
5. ✅ STOP if any Step 1 stop condition fires; ping organizer; do NOT proceed to Step 2
6. ✅ Run Step 2 BG deploy; copy-paste full output to log
7. ✅ Run Step 3 Python deploy; copy-paste output + ONNX probe
8. ✅ Run Step 4 health snapshot
9. ✅ Run Step 5 State C smoke (F999 + F001) on prod 8083 directly
10. ✅ (Optional) Run Step 5 State A/B smoke on test 8084 with flag flip + restore
11. ✅ Run Step 6 env var verify (must be false)
12. ✅ Schedule Step 7 checkpoints at T+1h / T+6h / T+24h (use ScheduleWakeup or your own runner)
13. ✅ At T+24h: run final checkpoint + write GO/NO-GO verdict in deploy log
14. ✅ Open PR per Step 9; ping organizer per Step 10

**If anything STOPS (any §1-§7 stop condition fires)**: leave prod in current state, paste the stop-output to chat, await organizer instruction. Do **not** unilaterally rollback unless §8 trigger criteria met (5xx > threshold, NRestarts incrementing). Process drift > rollback drift.

---

## Cross-references

- PR [#135](https://github.com/j4xie/my-prototype-logistics/pull/135) (`2e90a2016`) — Pattern B PR-B v2 impl
- PR [#138](https://github.com/j4xie/my-prototype-logistics/pull/138) (`6310f00278`) — chat 1 smoke verify (State B+C confirmed)
- PR [#141](https://github.com/j4xie/my-prototype-logistics/pull/141) (`068ebd8b8`) — customer comms templates (T-24h notice template applies after this MO 24h GO)
- PR [#142](https://github.com/j4xie/my-prototype-logistics/pull/142) (`41552a9622`) — rollback rehearsal + backup mislabel finding (relevant to T6.4 cutover Step 0, **not** to this MO)
- PR [#143](https://github.com/j4xie/my-prototype-logistics/pull/143) (`8b8f758752`) — T6.4 baseline metrics (this MO uses the same `scripts/capture-t6-4-baseline.sh` pattern for prod smoke; baseline fixtures in `tests/fixtures/t6-4-baseline/` are the post-T6.4-cutover comparison reference)
- PR [#147](https://github.com/j4xie/my-prototype-logistics/pull/147) (`a687814bd`) — K-1 customer Gold state audit (14 T6.4 customers all 0 rows in `smart_bi_sales_data`; State B-equiv parity by data state)
- PR [#157](https://github.com/j4xie/my-prototype-logistics/pull/157) (`45a71487b`) — flag-flip investigation (Apr 23 Phase B baseline confirmed, May 6 mtime misinterpretation corrected, this MO amended per §4.3)
- Memory `project_apr23_dashboard_gold_uiport.md` — Apr 23 Phase B Dashboard Gold UI port (commits `b1cf06fd8` + `315887092`, Bug #417 perf fix dependency on flag=true)
- Memory `project_2026_05_08_t6_4_readiness_gates.md` — overall T6.4 readiness 3/3 gates closed
- Memory `reference_blue_green_java_deploy.md` — BG mode internals
- Memory `reference_smartbi_migration_runner.md` — Step 3.5 migration runner
- Memory `project_2026_05_07_uvicorn_n2_path_x_lite.md` — N=2 leader-gate prod state
- Memory `feedback_deploy_pipeline.md` — deploy script v4.2 channels (OSS/R2/SKIP_RSYNC) + double-env defensive ping
- Hard rule `.claude/rules/server-operations.md` — smartbi schema migration discipline
- `scripts/deploy/deploy-backend.sh` (lines 95-167 arg-parsing, lines 820-970 BG flow)
- `scripts/deploy/deploy-smartbi-python.sh` (line 110-135 migration runner Step 3.5, line 140-190 restart)
- `backend/python/smartbi_compat/api/analysis_finance.py:1746-1932` — PR #135 impl (3 functions + dispatcher)

---

## Right-sizing

This is **doc-only**. Single deliverable PR opens AFTER 24h soak GO; PR contains:
1. The deploy artifact log (`docs/qa-audits/2026-05-09-pr-135-prod-deploy.md`, ~250 LOC)
2. (Optional) `scripts/probe-pattern-b.sh` if the State C smoke pattern is reused enough to extract — likely not, since it's a one-shot

Estimated execution wall time: ~3 min Java BG + ~5 min Python deploy + ~5 min smoke + 24h soak (3 checkpoints, ~5 min each) = ~30 min hands-on across the day. Right-sized for one execution chat.
