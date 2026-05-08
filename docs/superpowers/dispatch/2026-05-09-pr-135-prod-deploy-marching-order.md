# ⚡ PR #135 prod deploy — Pattern B 3-state branching

**From**: organizer chat (T6.4 prerequisite gate)
**Date**: 2026-05-09 (target execution window: ~13:01 CST May 9 after T6.3 24h soak GO + T6.1 22h BG dryrun GO)
**Block resolved by**: T6.3 24h soak GO (~12:05 CST May 9) + T6.1 22h BG dryrun GO (~13:01 CST May 9)
**Block this resolves**: T6.4 cutover earliest start (~14:00 CST May 10 Strategy B Day 1)
**Deliverable**: 1 PR (deploy artifact log + 24h soak summary) + ping organizer with 24h GO/NO-GO data

---

## Background

PR [#135](https://github.com/j4xie/my-prototype-logistics/pull/135) (`2e90a2016`) shipped the full Pattern B 3-state branching for `_get_finance_overview` in `analysis_finance.py`:

| State | Trigger | Behavior |
|---|---|---|
| **A** | `SMARTBI_GOLD_READ_PRIMARY_ENABLED=true` + Gold POS data populated (e.g. F001) | `_build_finance_overview_from_gold` returns Gold-derived overview (4 KPIs + top_stores rankings) |
| **B** | `SMARTBI_GOLD_READ_PRIMARY_ENABLED=true` + Gold null/empty | `_build_empty_dashboard_response` returns empty stub (Java line 135-142 mirror) |
| **C** | `SMARTBI_GOLD_READ_PRIMARY_ENABLED=false` (default) **OR** flag=true + Gold throws | `_build_finance_overview_legacy` returns 10 KPIs + 3 charts + insights + suggestions |

PR [#138](https://github.com/j4xie/my-prototype-logistics/pull/138) (`6310f00278`) verified States B and C against test env 8084 (State A deferred — needs Gold mock, follow-up). Code review against `FinanceAnalysisServiceImpl.java:111-189` clean per Phase 2A Rules 4 / 8 / 9 / 11 / 12.

**Default behavior unchanged after deploy**: `SMARTBI_GOLD_READ_PRIMARY_ENABLED` defaults to `"false"` on prod (per `.env.prod`). Customers continue hitting State C (legacy aggregation) until the flag is explicitly flipped — which is **NOT** part of T6.4 cutover scope. T6.4 is nginx-routing only; PR #135 is the *code* prerequisite that lands the new flag-gated paths so future Phase B (Gold-primary) can flip without another code deploy.

Per memory `project_2026_05_07_uvicorn_n2_path_x_lite.md`, prod Python (`cretas-python.service`) currently runs N=2 workers (PIDs paired leader+follower). PR #135 deploys to this multi-worker service via the existing `deploy-smartbi-python.sh` flow — both workers cycle in-place, ~30s ONNX warmup per worker.

Per memory `reference_blue_green_java_deploy.md`, prod Java deploy uses **Blue-Green** mode (10010 ↔ 10020, nginx upstream switch on 139). PR #135 has zero Java changes (single-file Python edit), but **deploy Java anyway** to rebuild the JAR + cycle the BG pair so any inflight Java state at 10010 doesn't drift relative to test 10011 (deploy hygiene per `feedback_deploy_pipeline.md` "test long-term stale" pattern).

---

## ⛔ HOLD blocks (read before any step)

1. **DO NOT execute this MO before**:
   - T6.3 24h soak GO confirmed (Python error <0.5%, p99 <2000ms, 0 Java fallback for 61 test factories) — ~12:05 May 9 CST
   - T6.1 22h BG dryrun GO confirmed (chat 4 final report + parity ≥99.94%) — ~13:01 May 9 CST
2. **DO NOT change `SMARTBI_GOLD_READ_PRIMARY_ENABLED` on prod** — it stays `false`. Smoke State A/B happen on **test env 8084 only** (or local Python with override). Prod env var is a hard rule per §6 below.
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
ps aux | grep -E 'uvicorn.*:8083' | grep -v grep | wc -l
echo

echo '=== Active Java BG color check (which port nginx upstream points to) ==='
ssh -o StrictHostKeyChecking=no root@139.196.165.140 \"grep -oP 'server 47\\\\.100\\\\.235\\\\.168:\\\\K[0-9]+' /www/server/panel/vhost/nginx/cretas-java-upstream.conf | head -1\"
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
- `cretas-python.MainPID` doesn't match a running `uvicorn ... :8083` process (worker drift indicates pre-existing N=2 leader-gate bug)
- T6.3 regex no longer present in nginx vhost (someone moved it back during the night)
- Python prod 8083 returns non-200 (T6.3 24h soak might already be tainted)

---

## Step 2 — Blue-Green Java deploy

PR #135 has zero Java changes, but a clean BG cycle is good hygiene and verifies the BG path before T6.4 (which depends on Java being deployable mid-cutover for any emergency hotfix). Memory `feedback_deploy_pipeline.md` "test long-term stale" — `--env prod` defaults to prod-only; deploy-backend.sh v4.2's defensive ping will warn if test 10011 is already stale.

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
ACTIVE_PORT=\$(ssh root@139.196.165.140 \"grep -oP 'server 47\\\\.100\\\\.235\\\\.168:\\\\K[0-9]+' /www/server/panel/vhost/nginx/cretas-java-upstream.conf | head -1\")
curl -s -o /dev/null -w '%{http_code}' \"http://localhost:\$ACTIVE_PORT/api/mobile/health\"
echo
"
```

---

## Step 3 — Python deploy (smartbi_compat with PR #135 impl)

PR #135's only file change is `backend/python/smartbi_compat/api/analysis_finance.py`. The deploy script syncs `backend/python/` to the server, runs the migration runner (Step 3.5 — should be no-op since PR #135 adds no migrations), then `systemctl restart cretas-python` which cycles both N=2 workers (~30s ONNX warmup × 2 sequential).

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

## Step 5 — Pattern B 3-state prod smoke

The new code paths in PR #135 only fire when `SMARTBI_GOLD_READ_PRIMARY_ENABLED=true`. Prod env var stays `false` (per §6), so on prod **only State C is exercised by real traffic**. State A/B verification happens against **test env 8084** with the flag flipped.

This matches the pattern from PR #138 (chat 1 already did the same verify on test env, but that was *before* the deploy lands prod-side; we re-verify post-deploy to catch any drift in the rsync or systemd-restart path).

### State C — default flag=false × F999 (legacy aggregation)

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

# Note: hits Python prod 8083 directly (loopback) — bypasses 139 nginx routing.
# F999 has no Gold POS data, so legacy path returns 10 zero-KPIs + 3 chart skeletons.
curl -s -H \"Authorization: Bearer \$TOKEN\" \
  'http://localhost:8083/api/mobile/F999/smart-bi/analysis/finance?startDate=2025-01-01&endDate=2025-12-31' \
  | python3 -c 'import json,sys; r=json.load(sys.stdin); ov=r[\"data\"][\"overview\"]; print(f\"kpiCards=\\\"{len(ov[\\\"kpiCards\\\"])}\\\" charts=\\\"{len(ov[\\\"charts\\\"])}\\\" insights=\\\"{len(ov[\\\"aiInsights\\\"])}\\\" suggestions=\\\"{len(ov[\\\"suggestions\\\"])}\\\"\")'
"
```

**Expected**: `kpiCards=10 charts=3 insights=1 suggestions=2` (matches PR #138 §State C verify).

### State C — default flag=false × F001 (legacy aggregation, real Gold-POS factory)

F001 has Gold POS data populated (per memory `reference_smartbi_gold_layer_architecture.md` + memory `project_2026_05_07_t6_1_dryrun_in_flight.md`). With flag=false the legacy path runs regardless — Gold data is *not* consulted in State C.

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

curl -s -H \"Authorization: Bearer \$TOKEN\" \
  'http://localhost:8083/api/mobile/F001/smart-bi/analysis/finance?startDate=2025-01-01&endDate=2025-12-31' \
  | python3 -c 'import json,sys; r=json.load(sys.stdin); ov=r[\"data\"][\"overview\"]; print(f\"kpiCards=\\\"{len(ov[\\\"kpiCards\\\"])}\\\" charts=\\\"{len(ov[\\\"charts\\\"])}\\\"\")'
"
```

**Expected**: `kpiCards=10 charts=3` (legacy path, same as F999). If F001 returns the 4-card Gold shape (`total_revenue`/`bill_count`/`avg_bill_value`/`store_count`) the flag is incorrectly enabled — **STOP, ping organizer immediately**.

### State A + State B — test env 8084 only (do NOT flip prod flag)

PR #138 already did this against test 8084 with `2e90a2016` and got State C ✓ + State B ✓. Re-running on test env post-prod-deploy is **optional sanity** — only do it if you suspect rsync drift or you want fresh evidence in the deploy log:

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

⛔ **HARD RULE: prod env var stays `false`. Do not flip during this MO or T6.4.**

This MO lands the *code* that handles flag=true paths. The actual flag flip on prod is a **separate Phase B work** (per memory `project_2026_05_07_t6_1_dryrun_in_flight.md` task #20 SMARTBI_GOLD_READ_PRIMARY_ENABLED) gated by Gold producer dataflow validation across more factories than just F001. Forcing the flag here would expose all customers to State A/B with no rollback plan if Gold quality drifts.

```bash
ssh root@47.100.235.168 "
echo '=== prod .env.prod flag (must be false or unset) ==='
grep -E '^SMARTBI_GOLD_READ_PRIMARY_ENABLED' /www/wwwroot/cretas/.env.prod || echo '(unset, defaults to false in code)'
echo
echo '=== Running prod Python process env (must show false) ==='
PID=\$(systemctl show cretas-python --property=MainPID --value)
if [ \"\$PID\" -gt 0 ]; then
  tr '\\0' '\\n' < /proc/\$PID/environ | grep SMARTBI_GOLD_READ_PRIMARY_ENABLED || echo '(unset in process env)'
fi
"
```

**Expected**: either `SMARTBI_GOLD_READ_PRIMARY_ENABLED=false` or unset (code defaults to `"false"` per `os.environ.get("SMARTBI_GOLD_READ_PRIMARY_ENABLED", "false")` at `analysis_finance.py:1853`).

If anything else, **STOP, ping organizer**.

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
- **Step 5 smoke results table**:
  | State | Factory | Endpoint | kpiCards | charts | insights | suggestions | Result |
  |---|---|---|---:|---:|---:|---:|---|
  | C (default flag) | F999 | analysis/finance | 10 | 3 | 1 | 2 | ✅ |
  | C (default flag) | F001 | analysis/finance | 10 | 3 | n/a | n/a | ✅ |
  | B (flag=true, test 8084) | F999 | analysis/finance | 0 | 0 | 0 | 0 | ✅ (optional) |
  | A (flag=true, test 8084) | F001 | analysis/finance | 4 | 0 | 0 | 0 | ✅ (optional) |
- **Step 6 env var verify**: paste output showing flag=false on prod
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
✅ PR #135 prod deploy + 24h soak GO (commit 2e90a2016 deployed 2026-05-09 <hh:mm> CST)
   - cretas-python NRestarts: <pre> → <post> (Δ=0 over 24h)
   - cretas-backend NRestarts: <pre> → <post> (Δ=0 over 24h)
   - Python prod RSS @T+24h: <X.X> GB (cap 4 GB)
   - Java active RSS @T+24h: <X.X> GB (cap 3 GB)
   - 5xx rate per-endpoint p99: <X.XX>% (cap 0.5%)
   - p99 latency per-endpoint: <XXX> ms (cap 2000 ms)
   - Java fallback hits: 0 (cutover scope)
   - Pattern B exception count: 0
   - flag=false on prod confirmed
   - State C smoke F999/F001 ✅
   T6.4 cutover unblocked. Customer comms T-24h notice (per PR #141) → schedule Strategy B Day 1 (3-4 customers) for ~14:00 CST May 10.
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
