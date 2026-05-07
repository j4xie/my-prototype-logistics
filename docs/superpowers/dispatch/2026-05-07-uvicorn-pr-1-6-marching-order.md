# ⚡ IMMEDIATE — PR-1.6 + re-spike: N=2 + Path X-lite (no PG restart)

**From**: organizer chat (Phase 2A T6 cutover)
**Date**: 2026-05-06
**Spec ref**: 接续 `docs/superpowers/plans/2026-05-07-cretas-python-multi-worker.md` 的 PR-3 prereq
**Audit ref**: 独立 audit agent 发现 PR-1.5 + Path Y 都 misdiagnosed/under-budgeted
**Block**: T6.3 50% factories cutover GO criteria

---

## 背景: audit 修正 PR-1 + PR-1.5 + Path Y 的 math

独立 audit agent 抓到我跟你都漏了:

1. **food_kb 3 个 PG pools** (knowledge_retriever 5 + document_ingester 3 + feedback 3 = 11 per worker) — 你的 mid-stress snapshot 数据看 idle 但 max-bound 计算需要算上
2. **completeness_calculator** 每 request 起 pool max=3 (no caching, leak risk on bursts)
3. **Path Y as scoped 实际 over 100 cap** — 我标 86/100 错的,加 food_kb 后是 ~110
4. **Path 3 (single worker) actually GO-able for T6.3** — 真实 50% factories load c~10-15 落在 single-worker p99=196ms zone (sales),不是 GO-fail

## 选定方案: **N=2 + Path X-lite (不动 PG)**

```
backend/python/smartbi/config.py:
  L102 postgres_pool_size:  40 → 15   (asyncpg smartbi pool)
  L253 _cretas_pool max_size: 8 → 6   (hardcoded, asyncpg cretas pool)

SQLAlchemy: 保持 PR-1.5 现状 (2+3)
PG max_connections: 不动 (100 cap)
N: 2 workers
```

Math (post audit, full accounting):
```
2 workers × (asyncpg smartbi 15 + asyncpg cretas 6 + SQL smartbi 5 + SQL cretas 5)
+ JDBC ~30 + food_kb steady ~5 + completeness/transient misc ~5
= 2 × 31 + 30 + 10 = 102, audit 校正算 ~97 ≈ fits 100 cap ✓
```

**Why N=2 (not N=4)**:
- Math 安全 fit 100 cap **不需要** PG restart
- Memory 半 (~1.3GB vs ~2.7GB N=4)
- 真实 load c≤15 N=2 应该够 (PR-1 alerts c=10 RPS single 305 → multi-4 445;N=2 估 ~370,中间)
- 失败 fallback path (升 N=4 + Path X full) 仍开放,数据驱动决定

**Why 不动 PG**:
- ~5-15s downtime 影响所有 PG client (cretas Java + smartbi Python + Mall + 其他)
- 当前 audit 推荐数学已 fit 100 cap,无必要

---

## Deliverable: 2 PRs

### PR-1.6: pool size adjustment (single PR)

改 `backend/python/smartbi/config.py`:
- L102: `postgres_pool_size: int = 40` → `postgres_pool_size: int = 15`
- L253 (in `_get_cretas_pool` or wherever `_cretas_pool` 创建,grep `max_size=8`): `max_size=8` → `max_size=6`
- 注释加 reference: "Multi-worker safe per audit 2026-05-07; see docs/qa-audits/2026-05-07-uvicorn-workers-spike-rerun.md and follow-up audit"

测试 (test env 跑一次 single worker smoke,verify pool 调整不破坏现状):
```bash
ssh root@47.100.235.168 "bash /www/wwwroot/cretas/restart-test.sh"
# 等 30s
curl -s http://localhost:8084/health  # 应 200
```

⛔ DO NOT 改 prod cretas-python.service。这 PR 只动 Python config。

Commit + push + PR + ping organizer。

---

### PR-1.7 (re-spike report): N=2 + Path X-lite benchmark

⛔ HOLD: PR-1.6 必须先 merge,然后 deploy test env 一次让 config 生效,再做 spike。**不**在 PR-1.6 还没 merge 时跑 spike,数据无效。

Spike 步骤 (test env 8084):

1. Deploy PR-1.6 to test env:
   ```bash
   ssh root@47.100.235.168 "cd /www/wwwroot/cretas/code && git pull && bash /www/wwwroot/cretas/restart-test.sh"
   ```

2. 切 test env 到 N=2:
   ```bash
   ssh root@47.100.235.168 "
     pkill -f ':8084'
     sleep 5
     cd /www/wwwroot/cretas/code/backend/python
     source venv38/bin/activate
     # 用 restart-test.sh 的 env-var prefix 启动 (per PR-1 spike 第 4 节 misconfiguration 教训)
     nohup uvicorn main:app --host 0.0.0.0 --port 8084 --workers 2 > /www/wwwroot/cretas/python-test.log 2>&1 &
     sleep 90  # 2× ONNX warmup
     ps aux | grep ':8084' | grep -v grep | wc -l  # 应该 3 (1 master + 2 workers)
   "
   ```

3. Verify leader gate: 看 `/www/wwwroot/cretas/python-test.log` 应有:
   ```
   [leader] PID=XXX env=test acquired lock /tmp/cretas-python-leader-test.lock
   [follower] PID=YYY env=test ...
   ```

4. 跑 stress (同 PR-1 spike pattern,但 N=2 instead of N=4):
   ```bash
   for c in 1 5 10 50 100; do
     for ep in "analysis/sales?startDate=2026-01-01&endDate=2026-05-07" "alerts"; do
       wrk -t4 -c$c -d60s --timeout 30s -H "Authorization: Bearer $TOKEN" \
         "http://localhost:8084/api/mobile/F001/smart-bi/$ep"
       sleep 5
     done
   done > /tmp/results-N2-PathX-lite.txt 2>&1
   ```

5. 监 PG conn count 全程:
   ```bash
   while true; do
     date +%H:%M:%S
     sudo -u postgres psql -d smartbi_db -tAc "SELECT count(*) FROM pg_stat_activity WHERE usename='smartbi_user'"
     sudo -u postgres psql -d smartbi_db -tAc "SELECT count(*) FROM pg_stat_activity WHERE usename='cretas_user'"
     sleep 5
   done > /tmp/pg-conns-N2.txt &
   ```

6. 写 report `docs/qa-audits/2026-05-07-uvicorn-workers-spike-N2-pathx-lite.md`,关键 verify:
   - **c=50 sales: 0% errors** (PR-1 N=4 是 67%/82%,N=2 应该 0%)
   - **c=100 sales: 0% errors** (PR-1 N=4 是 85%/90%,N=2 应该 0%)
   - p99 sales c=10 < 200ms
   - PG conn count peak < 95 (留 5 buffer)
   - background task 4× duplication 不再 (leader gate work)
   - prod (8083) 不受影响

7. 还原 test env single worker:
   ```bash
   ssh root@47.100.235.168 "pkill -f ':8084'; sleep 5; bash /www/wwwroot/cretas/restart-test.sh"
   ```

8. PR + ping organizer with data。

---

## ⛔ HOLD blocks (per feedback_sister_chat_phase_skip_ping memory)

| Block | Trigger |
|---|---|
| ⛔ Don't push PR-1.7 (re-spike) before PR-1.6 merged + deployed test | PR-1.6 必须 land 才有意义 spike |
| ⛔ DO NOT touch prod (8083 cretas-python.service) — even after PR-1.6 + PR-1.7 merge | PR-3 prod cutover 是单独决定,等 organizer 看 PR-1.7 数据再 GO |
| ⛔ DO NOT modify cretas-python.service | systemd unit edits 是 PR-3 工作 |
| ⛔ DO NOT change PG max_connections | Path X-lite 不动 PG |
| ⛔ DO NOT skip stop-and-ping | 完 PR-1.6 ping; 完 PR-1.7 ping; 任何 stop-and-ping 触发立即 ping |

---

## Stop-and-ping 触发条件

立即 ping organizer 不要自己解决:
- PR-1.6 改 L102 / L253 之后 test env smoke fail
- N=2 启动后只起来 1 个 worker
- Token 获取失败 (用 PR-1 spike 的 jwt 生成方式)
- c=50 sales 仍有 errors (说明 audit math 还有 miss)
- c=100 sales errors > 5%
- PG conn count peak > 95 (说明 budget 还紧)
- p99 c=10 sales > 500ms (单工厂 dashboard 慢)
- prod (8083) 受影响 (NRestarts != 0,error log)
- Memory > 2GB total Python (N=2 应该 ~1.3GB)
- 任何意料之外的 leader gate 行为 (e.g. 2 leaders / 0 leaders)

---

## ⛔ 禁止事项

1. **不动 prod** (8083, cretas-python.service, .env.prod) 全程
2. **不动 PG** (postgresql.conf, max_connections)
3. **不引入新 dependency** (PgBouncer 等 audit 提到的不在 scope)
4. **不并行 PR-1.6 + PR-1.7** — 顺序 (PR-1.6 merge → deploy test → re-spike → PR-1.7)
5. **不改 task #29 规划** PR-3 (那是 organizer 看 re-spike 数据决定)
6. **不在主 worktree** 工作 — 继续用 `.worktrees/uvicorn-workers/`,git pull origin main 拿最新 (3 PRs 已 merged: 101 / 103 / 105)

---

## Resumption checklist

- [ ] `cd .worktrees/uvicorn-workers && git pull origin main` (拿 PR 101/103/105 + 102 等)
- [ ] Read 这 marching order
- [ ] Read audit response in organizer reply (math accounting + path comparison)
- [ ] PR-1.6: 改 config.py L102 + L253 + test env smoke
- [ ] **STOP** ping organizer
- [ ] (organizer GO 后) deploy test env + re-spike
- [ ] **STOP** ping organizer with re-spike data
- [ ] (organizer GO 后) PR-3 prod cutover (separate marching order)

---

## 注意: 可能的第 3 个 bottleneck

audit agent 提示: PR-1 + PR-1.5 都 misdiagnosed,Path X-lite 也可能出第 3 个 bottleneck (e.g. SQLAlchemy queue under fan-out / asyncpg pool 即使 cap 大 但单 worker 内 await 拥塞)。

如果 re-spike 数据**仍**显示 c=50/100 sales errors,**不要**自己继续 fix,直接 ping organizer 报数据,我来决定下一步 (可能 N=2 → N=1 fallback / 调研 fan-out / 升 PG cap)。
