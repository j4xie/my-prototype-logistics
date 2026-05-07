# ⚡ IMMEDIATE — PR-1 spike: uvicorn workers benchmark on test env (8084)

**From**: organizer chat (Phase 2A T6 cutover)
**Date**: 2026-05-06
**Plan ref**: `docs/superpowers/plans/2026-05-07-cretas-python-multi-worker.md` PR-1 section
**Block**: T6.3 50% factories GO criteria
**Scope discipline**: 此 marching order **只做 PR-1 spike**。PR-2 leader gate + PR-3 prod cutover 等 organizer 看 PR-1 数据后再派。

---

## 你的任务 (sister chat)

在 `cretas-python-test` (8084) 上 benchmark 单 worker vs `--workers 4` 性能,写报告交给 organizer。**不动 prod (8083)**。

最终 deliverable: 一份 markdown 报告 `docs/qa-audits/2026-05-07-uvicorn-workers-spike.md`,含 4 张表 + 推荐 N。

---

## Step 0 — Worktree 隔离 (强制)

```bash
cd C:\Users\Steve\my-prototype-logistics
git fetch origin
git worktree add .worktrees/uvicorn-workers -b ops-uvicorn-workers origin/main
cd .worktrees/uvicorn-workers
pwd                    # ← verify path 包含 .worktrees/uvicorn-workers
git branch --show-current   # ← verify ops-uvicorn-workers
```

**不要**在主 worktree 工作。如已在主 worktree,先 `cd ..` 退出再 `git worktree add`。

---

## Step 1 — 阅读

- `docs/superpowers/plans/2026-05-07-cretas-python-multi-worker.md` 全篇 (PR-1 section 重点)
- `backend/python/main.py` L210-L600 (lifespan + 5 background tasks 概览,知道哪些会 4× 浪费/race)
- `.claude/rules/server-operations.md` "双环境部署最佳实践" (test env 是 nohup 管理,不是 systemd)

---

## Step 2 — Test env 当前状态盘点

```bash
ssh root@47.100.235.168 "
ps aux | grep ':8084' | grep -v grep
ls -lh /www/wwwroot/cretas/python-test.log
free -h
nproc
"
```

记录:
- 当前 8084 PID
- 当前 ExecStart (从 ps 输出看)
- 系统 CPU 数 (`nproc`)
- 当前 free memory

---

## Step 3 — 准备 token + endpoint list

测两个端点:
- 重: `/api/mobile/F001/smart-bi/analysis/dashboard?period=year_to_date`
- 轻: `/api/mobile/F001/smart-bi/alerts`

获取 F001 JWT token (复用 baseline-java-metrics.sh 的方式):

```bash
ssh root@47.100.235.168 "bash /www/wwwroot/cretas/scripts/get-test-token.sh 2>&1 | tail -1" > /tmp/token.txt
# 如脚本不存在,手动:
# curl -s -X POST http://localhost:10011/api/mobile/auth/unified-login \
#   -H 'Content-Type: application/json' \
#   -d '{"username":"<test-user>","password":"<password>","factoryId":"F001"}' \
#   | python -c 'import sys,json;d=json.load(sys.stdin);print(d["data"]["tokens"]["accessToken"])'
```

如果 token 获取失败 → **stop and ping organizer**,不要硬跑无 token 的 stress (会全 401 噪音)。

---

## Step 4 — 安装 wrk (如未装)

```bash
ssh root@47.100.235.168 "which wrk || (yum install -y wrk || apt install -y wrk || \
  (cd /tmp && git clone https://github.com/wg/wrk.git && cd wrk && make && cp wrk /usr/local/bin/))"
```

---

## Step 5 — Baseline (单 worker) 测试

确认 8084 是单 worker (默认 ExecStart 没 `--workers` 参数):

```bash
ssh root@47.100.235.168 "ps aux | grep ':8084' | grep -v grep | wc -l"
# 应该是 1 行 (只有 1 个 uvicorn 进程)
```

跑 stress test (5 个 concurrency level × 2 endpoints):

```bash
TOKEN=$(cat /tmp/token.txt)
for c in 1 5 10 50 100; do
  for ep in "analysis/dashboard?period=year_to_date" "alerts"; do
    echo "=== single-worker, c=$c, ep=$ep ==="
    ssh root@47.100.235.168 "wrk -t4 -c$c -d60s --timeout 30s \
      -H 'Authorization: Bearer $TOKEN' \
      'http://localhost:8084/api/mobile/F001/smart-bi/$ep' 2>&1"
    sleep 5  # let server cool
  done
done > /tmp/single-worker-results.txt 2>&1
```

并行监 memory + asyncpg:

```bash
ssh root@47.100.235.168 "
while true; do
  date +%s
  ps -o rss,pid,cmd -p \$(pgrep -f ':8084') 2>/dev/null | head -3
  sudo -u postgres psql -d smartbi_prod_db -tAc \"SELECT count(*) FROM pg_stat_activity WHERE application_name LIKE '%asyncpg%' OR usename='smartbi_user'\"
  sleep 10
done
" > /tmp/single-worker-monitor.txt &
MONITOR_PID=$!
sleep 700  # ~12 min, 覆盖 stress test 全程
kill $MONITOR_PID 2>/dev/null
```

---

## Step 6 — Multi-worker 测试

改 test env 为 4 workers (test env 是 nohup 管理):

```bash
ssh root@47.100.235.168 "bash -s" << 'INNER'
# 找到当前 8084 PID
TEST_PID=$(pgrep -f ':8084' | head -1)
[ -n "$TEST_PID" ] && kill $TEST_PID
sleep 5

# 启动 4 worker
cd /www/wwwroot/cretas/code/backend/python
source venv38/bin/activate
export $(grep -v '^#' .env.test | xargs) 2>/dev/null || true
nohup uvicorn main:app --host 0.0.0.0 --port 8084 --workers 4 \
  > /www/wwwroot/cretas/python-test.log 2>&1 &
echo "new PIDs after multi-worker start:"
sleep 60  # warmup (ONNX 4× load 慢)
ps aux | grep ':8084' | grep -v grep | wc -l
INNER
```

**关键 verify**: 应该看到 4 个 worker PID + 1 个 master PID = 5 行。

⚠️ **背景任务现在会 4× 跑** — 这是 PR-1 spike 接受的风险 (短时间,leader gate 是 PR-2 工作)。如果观察到 deadlock 或 ETL 行为异常,记录但不修。

跑同样 stress test,标记 multi-worker:

```bash
TOKEN=$(cat /tmp/token.txt)
for c in 1 5 10 50 100; do
  for ep in "analysis/dashboard?period=year_to_date" "alerts"; do
    echo "=== multi-worker-4, c=$c, ep=$ep ==="
    ssh root@47.100.235.168 "wrk -t4 -c$c -d60s --timeout 30s \
      -H 'Authorization: Bearer $TOKEN' \
      'http://localhost:8084/api/mobile/F001/smart-bi/$ep' 2>&1"
    sleep 5
  done
done > /tmp/multi-worker-4-results.txt 2>&1
```

并行同样监 memory + asyncpg connections (PID 不一样了,改 grep)。

---

## Step 7 — 写报告

`docs/qa-audits/2026-05-07-uvicorn-workers-spike.md`,模板:

```markdown
# uvicorn workers spike — 2026-05-07

**Server**: 47.100.235.168, 8C/16GB
**Test env**: 8084 (nohup-managed cretas-python-test)
**JDK**: cretas-python venv38 + uvicorn

## 配置对比

| Config | Workers | ONNX load | asyncpg pool count |
|---|---|---|---|
| baseline | 1 | 1× (~XGB) | 1 |
| multi-worker-4 | 4 | 4× (~XGB) | 4 |

## Performance — analysis/dashboard?period=year_to_date

| Concurrency | Worker | p50 | p95 | p99 | error% | RPS |
|---|---|---|---|---|---|---|
| 1 | single | ... | ... | ... | ... | ... |
| 1 | 4 | ... | ... | ... | ... | ... |
| 5 | single | ... | ... | ... | ... | ... |
| 5 | 4 | ... | ... | ... | ... | ... |
| 10 | single | ... | ... | ... | ... | ... |
| 10 | 4 | ... | ... | ... | ... | ... |
| 50 | single | ... | ... | ... | ... | ... |
| 50 | 4 | ... | ... | ... | ... | ... |
| 100 | single | ... | ... | ... | ... | ... |
| 100 | 4 | ... | ... | ... | ... | ... |

## Performance — alerts (light endpoint)

(同样表格)

## Memory + asyncpg observations

- Single worker peak RSS: ___ MB
- 4-worker peak RSS (sum): ___ MB
- Single worker asyncpg connections: ___
- 4-worker asyncpg connections: ___

## Anomalies during multi-worker run

- Deadlock observed? Y/N
- Background task 4× run evidence (narrative_cache prune log 出现 4 行?)
- ETL log 出现 race?

## 推荐

基于数据,推荐 prod ExecStart 用 `--workers N`,N = ___,理由:
- p99 在 ___ concurrency 从 ___ 降到 ___
- memory 总用量 ___ GB,留 ___ GB headroom
- ...

## Risks identified

- ...
```

---

## Step 8 — 清理 + ping organizer

**重要**: spike 结束后必须把 test env 还原到单 worker (避免 background task 4× 跑过周末):

```bash
ssh root@47.100.235.168 "bash -s" << 'INNER'
TEST_PIDS=$(pgrep -f ':8084')
[ -n "$TEST_PIDS" ] && kill $TEST_PIDS
sleep 5

cd /www/wwwroot/cretas/code/backend/python
source venv38/bin/activate
export $(grep -v '^#' .env.test | xargs) 2>/dev/null || true
nohup uvicorn main:app --host 0.0.0.0 --port 8084 \
  > /www/wwwroot/cretas/python-test.log 2>&1 &
sleep 30
curl -s http://localhost:8084/health | head
INNER
```

Verify 8084 health 200 + 单 worker。

Commit + push:

```bash
git add docs/qa-audits/2026-05-07-uvicorn-workers-spike.md
git status --short  # ← 验证只有 1 个文件 staged (并发-safe commit rule 5b)
git commit -- docs/qa-audits/2026-05-07-uvicorn-workers-spike.md \
  -m "docs(spike): uvicorn workers benchmark — single vs 4-worker on test env"
git push -u origin ops-uvicorn-workers
gh pr create --title "spike: uvicorn workers benchmark report" \
  --body "PR-1 of multi-worker plan. Data only, no impl. See plan: docs/superpowers/plans/2026-05-07-cretas-python-multi-worker.md"
```

Ping organizer:
> PR-1 spike done. Report: <PR URL>. Highlight: ___ (1-2 line summary of data + recommendation).

---

## ⛔ 禁止事项 (in scope)

1. 不动 prod (8083) 任何配置
2. 不改 main.py 业务代码
3. 不引入 leader gate (那是 PR-2 工作)
4. 不调 asyncpg pool size (那是 PR-2 决定)
5. 不写 leader election 代码
6. 不要在主 worktree 工作 — `pwd` 必须含 `.worktrees/`

---

## Stop-and-ping 触发条件

遇到以下情况立即 ping organizer **不要自己解决**:
- Token 获取失败
- multi-worker 启动后只起来 1 个 worker (说明 ExecStart 写错或 ONNX OOM)
- Test env 8084 health 长时间 5xx
- wrk 报错 Socket connection reset
- Memory > 12GB (16GB server,留太少 headroom)
- 任何 prod (8083) 受影响信号

---

## Resumption checklist (中断后接手)

- [ ] `cd .worktrees/uvicorn-workers && pwd` 确认在正确路径
- [ ] `git status` 看是否有未 commit 工作
- [ ] `ssh root@47.100.235.168 "ps aux | grep ':8084' | grep -v grep"` 看 test env 在什么状态
- [ ] 决定从 Step 5 / 6 / 7 / 8 哪里接手
