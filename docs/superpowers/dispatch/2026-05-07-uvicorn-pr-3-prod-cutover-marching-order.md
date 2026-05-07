# ⚡ IMMEDIATE — PR-3 prod cutover: cretas-python.service N=1 → N=2 (Path X-lite)

**From**: organizer chat (Phase 2A T6 cutover)
**Date**: 2026-05-06
**Block resolved**: PR-1.7 N=2 + Path X-lite re-spike all gates pass (PR #107 merged `6d02ad42`)
**Final step before T6.3 50% factories cutover**

---

## 你的任务

切 prod cretas-python.service 从 single worker → N=2 workers,24h prod soak verify。这是 PR-3 of multi-worker enablement plan。

**Deliverable**: 1 PR (`cretas-python.service` ExecStart edit) + 24h prod monitoring + ping organizer with soak data。

---

## Step 0 — Worktree (强制)

```bash
cd C:\Users\Steve\my-prototype-logistics
cd .worktrees/uvicorn-workers   # 继续用同 worktree
git pull origin main             # 拿最新 (PR #106 #107 等)
pwd
git branch --show-current        # 应该 ops-uvicorn-workers
```

---

## Step 1 — Reference

- N=2 spike data: `docs/qa-audits/2026-05-07-uvicorn-workers-spike-N2-pathx-lite.md` (PR #107 merged)
- Plan: `docs/superpowers/plans/2026-05-07-cretas-python-multi-worker.md` PR-3 section
- Server ops rule: `.claude/rules/server-operations.md` "服务管理 (systemd)" section

---

## Step 2 — Pre-flight

确认 prod 当前状态 + N=2 spike 数据真实有效:

```bash
ssh root@47.100.235.168 "
echo '=== cretas-python.service current state ==='
systemctl status cretas-python --no-pager | head -10
echo
echo '=== current ExecStart ==='
grep ExecStart /etc/systemd/system/cretas-python.service
echo
echo '=== current process count ==='
ps aux | grep ':8083' | grep -v grep | wc -l
echo
echo '=== prod uptime + restart count ==='
systemctl show cretas-python --property=NRestarts --property=ActiveEnterTimestamp
echo
echo '=== T6.2 canary live? F001 hits last hour ==='
journalctl -u cretas-python --since '1 hour ago' --no-pager 2>&1 | grep -c 'F001'
"
```

记录:
- ExecStart 当前长度 (应该是 single worker,无 `--workers` 参数)
- prod uptime 长 (说明稳定)
- F001 traffic 仍走 Python (T6.2 canary 仍 live)

---

## Step 3 — Edit cretas-python.service

⛔ 这是 prod 改动,但 systemd unit edit 是 reversible (git revert + daemon-reload)。

```bash
ssh root@47.100.235.168 "bash -s" << 'INNER'
# Backup current unit
cp /etc/systemd/system/cretas-python.service /etc/systemd/system/cretas-python.service.bak.pre-pr3.$(date +%Y%m%d_%H%M%S)
ls -lh /etc/systemd/system/cretas-python.service.bak.pre-pr3.*

# Edit ExecStart to add --workers 2
# Current (single worker):
#   ExecStart=.../python -m uvicorn main:app --host 0.0.0.0 --port 8083
# Target (N=2):
#   ExecStart=.../python -m uvicorn main:app --host 0.0.0.0 --port 8083 --workers 2
sed -i 's|^\(ExecStart=.*uvicorn main:app --host 0\.0\.0\.0 --port 8083\)$|\1 --workers 2|' /etc/systemd/system/cretas-python.service

# Verify edit
echo "=== new ExecStart ==="
grep ExecStart /etc/systemd/system/cretas-python.service
INNER
```

Verify ExecStart now ends with `--workers 2`. **If sed failed** (e.g., line already had something after port 8083), STOP + ping organizer。

---

## Step 4 — Daemon-reload + restart

⛔ 这一步会让 cretas-python prod 重启 — F001 canary traffic 短暂中断 (~30s, ONNX 4× warmup). F001 是 test factory 没真实用户,可接受。

```bash
ssh root@47.100.235.168 "bash -s" << 'INNER'
echo '=== systemctl daemon-reload ==='
systemctl daemon-reload

echo '=== systemctl restart cretas-python ==='
systemctl restart cretas-python

echo '=== wait 90s for ONNX warmup ==='
sleep 90

echo '=== verify N=2 running ==='
ps aux | grep ':8083' | grep -v grep | head -10
echo "process count:"
ps aux | grep ':8083' | grep -v grep | wc -l
# 应该 3 行 (1 master + 2 workers)

echo
echo '=== verify health ==='
curl -s http://localhost:8083/health | head

echo
echo '=== verify leader gate logs ==='
journalctl -u cretas-python --since '2 minutes ago' --no-pager 2>&1 | grep -E '\[leader\]|\[follower\]'

echo
echo '=== verify NRestarts ==='
systemctl show cretas-python --property=NRestarts --property=ActiveEnterTimestamp
INNER
```

Verify (all must pass):
- Process count = 3 (1 master + 2 workers)
- Health 200
- Log 含 `[leader] PID=X env=prod acquired lock` + `[follower] PID=Y env=prod ... gated background tasks skipped`
- NRestarts 仍是稳定值 (restart 是预期的,不算 unexpected restart)

**If any verification fail** → 立即 rollback (Step 5) + ping organizer。

---

## Step 5 — Rollback procedure (if Step 4 fails)

```bash
ssh root@47.100.235.168 "bash -s" << 'INNER'
echo '=== rolling back ==='
cp /etc/systemd/system/cretas-python.service.bak.pre-pr3.* /etc/systemd/system/cretas-python.service
systemctl daemon-reload
systemctl restart cretas-python
sleep 60
curl -s http://localhost:8083/health | head
ps aux | grep ':8083' | grep -v grep | wc -l  # 应回 2 (1 master + 1 worker)
INNER
```

⛔ Rollback 后立即 ping organizer。不要继续。

---

## Step 6 — Smoke test 19 endpoints + F001 canary

```bash
ssh root@47.100.235.168 "bash /www/wwwroot/cretas/scripts/t6-smoke-test-prod.sh 2>&1 | tail -30" || \
  echo "smoke script 不存在 — 用 wrk loop 替代"

# Fallback: 跑 19 endpoints 单次 (用 PR-1 spike 的 token 生成方式)
TOKEN=$(...)  # 参考 PR-1 spike marching order Step 3 token 获取
for ep in $(cat /www/wwwroot/cretas/code/scripts/phase2a/t6-in-scope-endpoints.txt 2>/dev/null); do
    resolved="${ep//\{factoryId\}/F001}"
    code=$(curl -s -o /dev/null -w '%{http_code}' -H "Authorization: Bearer $TOKEN" "http://localhost:8083$resolved")
    echo "$code $resolved"
done | sort | uniq -c
# 全部应 200
```

Verify F001 canary nginx 路径仍 work:
```bash
curl -s -o /dev/null -w 'http=%{http_code} time=%{time_total}\n' \
  "http://api.cretaceousfuture.com/api/mobile/F001/smart-bi/alerts" \
  -H "Authorization: Bearer $TOKEN"
# 应 200, time < 1s
```

---

## Step 7 — 24h prod soak

让 prod N=2 自然跑。期间 organizer 监控:
- T6.1 dryrun 数据 (仍在跑,4123→24h ETA)
- F001 canary metrics
- prod cretas-python.service 日志 errors / NRestarts

⛔ 24h 内你**不要再动 prod**。如果 organizer 看 metrics 有 issue 会单独 ping 你。

---

## Step 8 — PR + ping organizer

⛔ HOLD: 必须 Step 4 verify 全 pass 才进 Step 8。Step 4 fail 走 Step 5 rollback。

```bash
git diff   # 应为空 (systemd 改在服务器,git 不 track)
```

但需要 commit `scripts/systemd/cretas-python.service` (如果 repo 里有这个 systemd unit 的 source-controlled copy — verify):

```bash
ls -lh scripts/systemd/cretas-python.service 2>/dev/null
```

如果 repo 有 source-controlled copy:
```bash
# Edit local copy mirror server change
sed -i 's|^\(ExecStart=.*uvicorn main:app --host 0\.0\.0\.0 --port 8083\)$|\1 --workers 2|' scripts/systemd/cretas-python.service

git add scripts/systemd/cretas-python.service
git status --short
git commit -- scripts/systemd/cretas-python.service \
  -m "ops(prod): cretas-python.service N=2 workers (PR-3, multi-worker enablement)"
git push -u origin ops-uvicorn-workers
gh pr create --title "PR-3: cretas-python.service N=2 prod cutover" \
  --body "Single ExecStart edit adding --workers 2. Server unit at /etc/systemd/system/cretas-python.service updated + daemon-reload + restart + smoke verified. N=2 spike data PR #107 all gates pass. Backup at /etc/systemd/system/cretas-python.service.bak.pre-pr3.YYYYMMDD_HHMMSS for emergency rollback."
```

如果 repo 没 source-controlled copy → PR-3 是 documentation-only PR (changelog / runbook update),systemd 改动只在 server (不 trackable in git)。

Ping organizer:
> PR-3 prod cutover done. cretas-python now N=2.
> - Process count: 3 (1 master + 2 workers) ✓
> - Health: 200 ✓
> - Leader gate: 1 leader + 1 follower ✓
> - F001 canary: 200 via nginx ✓
> - Smoke 19 endpoints: all 200 ✓
> - PR: <URL> (or "no source-controlled unit, server-only edit + backup at <path>")
>
> Awaiting 24h soak. Will only re-ping if issues fired.

---

## ⛔ HOLD blocks (per feedback_sister_chat_phase_skip_ping)

| Block | Trigger |
|---|---|
| ⛔ DO NOT touch other prod services (Java 10010 / Mall / nginx vhost) | scope = cretas-python.service only |
| ⛔ DO NOT change PG max_connections | Path X-lite 不动 PG |
| ⛔ DO NOT modify .env.prod | env file 跟 systemd 不动 |
| ⛔ DO NOT touch T6.2 canary nginx route | F001 canary 仍走 Python (这次 restart 后) |
| ⛔ DO NOT skip Step 6 smoke | Step 4 verify 不够 — must smoke 19 endpoints |
| ⛔ DO NOT proceed if any Step 4 verify fail | rollback (Step 5) + ping immediately |
| ⛔ DO NOT do PR-3 在 high-traffic 时段 | F001 是 test factory traffic,但 Java 10010 / Mall 在同 server,避开高峰 |

---

## Stop-and-ping 触发条件

立即 ping organizer 不要自己解决:
- Step 3 sed 失败 (ExecStart format unexpected)
- Step 4 process count != 3
- Step 4 health != 200
- Step 4 leader gate log 缺 [leader] 或 [follower]
- Step 4 后 NRestarts 不止 1 (说明启动后又崩)
- Step 6 smoke 19 endpoints 任何 != 200
- Step 6 F001 nginx 路径 5xx
- 24h soak 期间 NRestarts > 1 (prod 不稳定)
- 24h soak 期间 memory > 4GB total Python (异常)
- 24h soak 期间 PG conn count > 95
- 任何 unexpected log error pattern

---

## ⛔ 禁止事项

1. **不动其他 systemd unit** (java backend / embedding / postgresql)
2. **不动 PG cluster** (postgresql.conf, pg_hba.conf)
3. **不改 nginx vhost** (api.cretaceousfuture.com)
4. **不改 .env.prod / env vars**
5. **不并行其他 task** — 这是单一 cutover step
6. **不在 24h soak 内做任何额外改动**
7. **rollback 失败时不要尝试第二种 rollback** (per server-ops "destructive actions only when truly best") — ping organizer

---

## Resumption checklist

- [ ] `cd .worktrees/uvicorn-workers && git pull origin main` 拿最新
- [ ] Read 这 marching order
- [ ] Step 2 pre-flight: prod current state + N=2 spike PR #107 reference
- [ ] Step 3 edit cretas-python.service (server)
- [ ] Step 4 daemon-reload + restart + verify (5 checks)
- [ ] Step 5 rollback (only if Step 4 fail)
- [ ] Step 6 smoke 19 endpoints + F001 canary
- [ ] Step 7 24h soak (passive)
- [ ] Step 8 PR + ping
