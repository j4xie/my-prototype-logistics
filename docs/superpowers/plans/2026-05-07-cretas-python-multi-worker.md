# cretas-python uvicorn multi-worker — Spike + Impl Plan

**Author**: Phase 2A T6 organizer chat
**Date**: 2026-05-06
**Sister-chat owner**: TBD (suggest "chat ops-1")
**Working dir**: 在新 worktree `.worktrees/uvicorn-workers/` 做,**不要在主 worktree**
**Blocking**: T6.3 GO criteria (50% factories cutover) — Python p99 必须 <2000ms under 真实 concurrent load

---

## 背景

### 当前 prod 状态 (2026-05-06)

`cretas-python.service` ExecStart 单 worker:

```
ExecStart=.../python -m uvicorn main:app --host 0.0.0.0 --port 8083
```

T6.2 canary 路径 (F001) 4h 收到 7861 hits 全 200 OK,**但 F001 是 test factory**,流量全来自 localhost (T6.1 dryrun + healthcheck)。**没有真实并发流量验证过**。

### 已知瓶颈

- T6.1 pre-flight 同步 stress 测试: Python p99 = **3217ms @ 10-concurrent** vs Java p99 = **85ms** (40× 慢)
- 单 worker 单 GIL → JSON serialization on full-year analysis responses 阻塞 event loop
- 真实 single-user dashboard load (≤3 concurrent) currently passes T6.2 GO (Python p99=1017ms)
- 10-concurrent 合成 stress 暴露 GIL 阻塞 — T6.3 50% factories 会 compound concurrent pressure

### 不能简单 `--workers 4`

`backend/python/main.py` lifespan() 起了 5 个 background tasks (line 220-560+):

| Task | 行为 | Multi-worker 风险 |
|---|---|---|
| `populate_all(_emb_pool)` (L341) | startup 一次 populate template embeddings | ON CONFLICT idempotent,4× 慢但不出错 |
| `_narrative_pruner_task` (L371) | hourly DELETE narrative_cache expired | idempotent,4× 浪费 |
| `_restaurant_etl_task` (L493) | hourly INSERT/UPSERT Gold 写入 | **4 workers 同时 INSERT 可能 deadlock**,且 4× ETL 负载 |
| `_chat_session_pruner_task` (L527) | 30min DELETE chat_session expired | idempotent,4× 浪费 |
| `_llm_cache_pruner_task` | hourly DELETE llm_cache expired | idempotent,4× 浪费 |

**硬性 leader-only**: `_restaurant_etl_task` (deadlock 风险)。
**软性 leader-only** (省资源): 其他 4 个。

### 其他 multi-worker 影响

| 资源 | 单 worker | 4 workers |
|---|---|---|
| ONNX 模型 (food_kb NER) | 1× memory | **4× memory** (~每 worker 独立加载) |
| asyncpg pool | 当前 min/max 配置 1 pool | **4 pool** (DB connections × 4) |
| LLM HTTP client connection pool | 1 pool | 4 pool |
| memory baseline (Python) | ~500MB | **~2GB** (估) |

服务器 16GB RAM,4 worker 应该够,但需要实测。

---

## Deliverable

3 个 PR (按顺序):

### PR-1: Spike report (no code change)

**目标**: 在 test env (8084) 实测 uvicorn workers options 的性能影响。

**Task**:
1. 在 test env stop cretas-python (8084),改 ExecStart 加 `--workers 4` (或方案 B/C),启动
2. 跑 wrk/ab/locust stress test:
   - 1 / 5 / 10 / 50 / 100 concurrent 各 60s
   - 测 endpoints: `/api/mobile/F001/smart-bi/analysis/dashboard?period=year_to_date` (重),`/api/mobile/F001/smart-bi/alerts` (轻)
   - 收集 p50 / p95 / p99 / error_rate / throughput
3. 同样测 single worker baseline 作对照
4. 监测 memory + CPU + asyncpg pool 状态
5. 报告 in `docs/qa-audits/2026-05-07-uvicorn-workers-spike.md`,含 4 张表 (single vs multi × 2 endpoint)

**Spike 不动 prod 配置**。test env 完成测试 +报告即可。

### PR-2: Background tasks leader-only gate

**目标**: 让 5 个 background tasks 在 multi-worker 下**只在 leader worker 跑**。

**方案选项** (PR-1 spike 已有数据后选):

**Option A — file-lock leader election**:
```python
# main.py lifespan 开头
LEADER_LOCK = pathlib.Path("/tmp/cretas-python-leader.lock")
fd = os.open(LEADER_LOCK, os.O_CREAT | os.O_RDWR, 0o644)
try:
    fcntl.flock(fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
    is_leader = True
except BlockingIOError:
    is_leader = False

# 后面 5 个 _asyncio.create_task(...) 包在 if is_leader: 里
```
✅ 简单
⚠️ Python crash 时 fd 释放,但 OS 自动回收 → 重启后另一个 worker 抢
⚠️ 不依赖外部基础设施

**Option B — gunicorn worker_id env var**:
- 改 ExecStart 用 gunicorn 启动 uvicorn workers
- gunicorn 提供 `WORKER_ID` env var
- ExecStart 改成: `gunicorn main:app -k uvicorn.workers.UvicornWorker -w 4 -b 0.0.0.0:8083`
- main.py 读 `os.environ.get("WORKER_ID") == "0"` 决定 leader

✅ Gunicorn 标准方案
⚠️ 引入新依赖
⚠️ 需要改启动方式 (test prod 都要)

**Option C — Redis-based lock**:
- 用 Redis SET NX EX 抢锁 (renewable)
- 跨 worker / 跨 host 都 work

✅ 最 robust
⚠️ 引入 Redis 依赖 (虽然项目已有 redis)
⚠️ 网络往返开销

**推荐**: Option A 优先 (最简). 如果遇到 race 边缘 case 退到 Option B/C.

**Task**:
1. 改 main.py lifespan,5 个 background tasks 都用 leader gate
2. 启动日志区分 `[leader] background tasks armed` 跟 `[follower] skipping background tasks`
3. test env 部署,验证 4 worker 启动后只有 1 个 worker 报 leader
4. kill leader worker → 等 5min → 验证另一 worker 升级 leader (file-lock 释放)
5. 跑 background task observability check: 1h 后查 narrative_cache prune log 只有 1 条

### PR-3: Prod cutover

**目标**: prod 切到 multi-worker,T6.3 50% factories 之前完成。

**Task**:
1. 改 `/etc/systemd/system/cretas-python.service`:
   - ExecStart 加 `--workers N` (N 由 PR-1 spike 决定,默认 4)
2. `systemctl daemon-reload && systemctl restart cretas-python`
3. 等 60s warmup
4. smoke test 19 endpoints PASS
5. 监 24h:
   - memory < 8GB (16GB 服务器,留 headroom)
   - p99 在合成 stress 下 < 2000ms
   - 0 crash
   - 0 deadlock log
6. 记录到 server-operations.md 作为 hard-rule

**Rollback**: 单一 git revert 改 service 文件,daemon-reload + restart。

---

## 风险 + 缓解

| 风险 | 影响 | 缓解 |
|---|---|---|
| Multi-worker memory 超出 16GB | OOM kill | PR-1 spike 实测 4 worker 内存使用,如超过 8GB 降到 2 worker |
| Leader election race | background task 跑两次 | PR-2 Option A 文件锁,Python 退出 OS 自动释放 |
| ONNX 模型 4× load 慢启动 | 启动从 30s → 120s+ | 接受,systemd Restart=always 自愈 |
| asyncpg pool 4× connections | DB 连接耗尽 | 监 `pg_stat_activity` connection count,超过 80 调整 pool size |
| restaurant_etl deadlock | INSERT 阻塞 | leader-only gate 解决根本问题 |

---

## 不在 scope

- **不动** Java backend
- **不动** main.py 业务 endpoint 代码 (只动 lifespan() 的 background task)
- **不动** asyncpg pool config (除非 PR-1 spike 数据指明需要调)
- **不引入** Celery / RQ 等外部 task queue (over-engineering)

---

## Coordinate with organizer

完 PR-1 spike 后 ping organizer with marching-order data,组织者审完决定走 Option A/B/C 给 PR-2。

完 PR-3 后 organizer 验证 T6.3 GO criteria 是否 unblock,然后启动 T6.3 50% factories cutover。

---

## Resumption checklist (sister chat 接手)

- [ ] `git fetch origin && git checkout -b ops-uvicorn-workers origin/main` 在新 worktree
- [ ] Read 这 plan 全篇
- [ ] Read main.py L210-L600 (lifespan + 5 background tasks)
- [ ] Read /etc/systemd/system/cretas-python.service (ssh 47)
- [ ] PR-1 spike: stand up test env multi-worker, run wrk, write report
- [ ] Ping organizer with PR-1 data
- [ ] PR-2 leader gate impl + test env smoke
- [ ] PR-3 prod cutover after organizer GO
