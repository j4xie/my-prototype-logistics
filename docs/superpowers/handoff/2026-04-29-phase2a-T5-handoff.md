# Phase 2A T5 Handoff Prompt — Resume from T5a

> **Copy the entire fenced block below into the next chat as your first message.**

---

```
继续 Phase 2A SmartBI 迁移，接 T5a。下面是完整背景。

## 项目

Cretas 食品溯源系统（Java + Python + Postgres + RN + Web-Admin）。我们正在做 Python migration 的 Phase 2A：把 50 个 Java SmartBI 端点切到 Python alias 实现，前端代码零改动。

工作目录：`C:\Users\Steve\my-prototype-logistics`
当前分支：`main`（已 push origin/main 全部进度）

## 背景文档（按重要性）

1. **Plan**：`docs/superpowers/plans/2026-04-29-smartbi-phase2a-implementation.md` — 完整 10 task 实施计划（T0-T9）
2. **Spec**：`docs/superpowers/specs/2026-04-28-smartbi-phase2a-design.md` — 6 节 design
3. **T0 分类**：`docs/superpowers/research/2026-04-29-smartbi-50-endpoints-classification.md` — 50 端点 X/Y/Z 分类（关键资料，T5 实施依据）
4. **本次 handoff**：`docs/superpowers/handoff/2026-04-29-phase2a-T5-handoff.md` — 你正在读这个

## 已完成（T0-T4 + T5d，6 commits 在 origin/main）

| Task | Commit | 内容 |
|------|--------|------|
| T0 | `955937744` | 50 端点 X/Y/Z 分类（Y=4, Z=17, X=29 → 256h ≈ 6-7 周工作量） |
| T1 | `a4a8e6eab` | systemd EnvironmentFile baseline（prod + test 都已能读 JWT_SECRET） |
| T2 | `e819e2a9d` | Java 录到 43 个 golden samples + 13 skip markers |
| T3 | `6b532e477` | Python `verify_jwt_and_factory` dependency + 5 unit tests |
| T4 | `26c4a99ca` | asyncpg pool 5→40 + `backend/python/smartbi_compat/` 脚手架 |
| T5d | `cb64638a1` | `gather_with_pool_safety` semaphore 测试 3/3 pass |

## 已存在的代码资产

- `backend/python/smartbi_compat/auth.py` — `verify_jwt_and_factory(request, factory_id) → AuthContext`，HS256 验证 + cross-factory 校验（含 null factoryId platform_admin 例外）
- `backend/python/smartbi_compat/schema_compat.py` — `wrap_response(data, message="操作成功")` 返回 Java 格式 `{success, data, message}`
- `backend/python/smartbi_compat/aggregator.py` — `gather_with_pool_safety(*coros, max_concurrent=16)` 防止 pool exhaustion
- `backend/python/smartbi_compat/api/{analysis,upload,dashboard}.py` — 3 个**空 router 文件**（已注册到 main.py，等 T5 加路由）
- `tests/python/smartbi_compat/test_jwt_middleware.py` — JWT 5 类测试 done
- `tests/python/smartbi_compat/test_alias_aggregation.py` — aggregator 3 类测试 done
- `tests/python/smartbi_compat/conftest.py` — sys.path injection
- `tests/fixtures/java-smartbi-golden/*.json` — 43 个 live + 13 skip Java golden samples（fixture 顶层有 `verb/path/factory/response` + `_meta` 详细 metadata）

## 还要做的

### T5a: 26 个 SmartBIAnalysis aliases（主体）
按 T0 分类：11 Z + 15 X。读 T0 分类报告找每个端点的 class 和 Java 实现路径。

### T5b: 13 个 SmartBIUpload aliases
3 Y + 1 Z + 9 X。**注意**：Y 类 3 个全是 multipart upload，T2 没录 fixture，contract test 不可行（见下方 critical issue 1）。

### T5c: 11 个 SmartBIDashboard aliases
1 SSE Y + 5 Z + 5 X。注意 SSE 端点 `/dashboard/executive/insights/custom/stream` 需要特殊处理（StreamingResponse + nginx buffering off）。

### T6/T7/T8/T9
- T6 nginx 139 测试环境改 location（plan 第 4 节有完整配置）
- T7 e2e smoke + perf + 30s pool stress
- T8 用户手工 UI 验证（5 屏 web-admin + RN test 包）
- T9 prod 切换 + 24h monitor

## 关键 Critical Issues 必须先解决

### Issue 1: Y 类 4 个端点没 contract test fixture

T0 把以下端点标为 Y 类（thin proxy 调 Python）：
- `POST /upload`（multipart）
- `POST /upload-and-analyze`（multipart）
- `POST /upload/confirm`（依赖 multipart 后续）
- `GET /dashboard/executive/insights/custom/stream`（SSE）

T2 录制时全部 `skipIfMissing: true`（multipart 不便录 / SSE 不是 JSON），所以**没 golden samples 无法 contract test**。

**3 个走法（开 chat 第一件事请决定）**：
- A. 接受 Y 类无 contract test，靠 T7 e2e 真实流量验证
- B. T2 补录 binary fixture（写 multipart 请求 + 保存 binary response，复杂）
- C. 给 Y 类写"manual verification" 测试（启 prod Python + 调真实端点 + 对比响应字段）

### Issue 2: T5 工作量 256h（≈ 6-7 周），单 chat 无法完成

**强烈建议**：拆成多个 chat sessions，每次完成一批。建议节奏：

```
本 chat: 先做 1 个端点 PoC（如 /analysis/finance）—— 走完整 TDD：
  1. 写 contract test 用 golden sample
  2. 实施 alias 路由（用 plan 第 5a.4 步的 Y 模板，本端点是 Z）
  3. 跑 contract test pass
  4. nginx 测试环境改 location（T6）
  5. curl 调一次 alias 端点验证
  6. commit + push
这样能验证整条链路（JWT/alias/nginx/contract）实际跑通

下一 chat: 批量做 5-10 个 Z 类端点
后续 chat: 继续批量做 X 类端点
最后 chat: T7/T8/T9 完成 prod 切换
```

### Issue 3: Concurrent edit 风险（已踩过 3 次）

本 Phase 2A 实施过程多次出现 commit 吞了别 session 的 staged 文件。**Subagent dispatch 时必须强调**：

```bash
# 提交前先看 staging 区
git status --short

# 只 commit 列出的文件（即使 staging 区有别人的也不动）
git commit -m "msg" -- <file1> <file2>

# commit 后立刻自检
git show --stat HEAD | head

# 如果吞了别人的文件：
# 1. git reset --soft HEAD~1
# 2. git restore --staged <他人文件>
# 3. 重 commit
```

参考 `.claude/rules/concurrent-edit-safety.md` 规则 5b。

## 第一步建议

1. 读取 plan + T0 分类 + 本 handoff
2. 决定 Issue 1 走法（推荐 A）
3. 选 1 个 Z 类端点（推荐 `/analysis/finance` 或 `/analysis/sales` 因为 fixture 完整）做 PoC：
   - 用 superpowers:subagent-driven-development 派发 implementer subagent
   - 实施 alias 路由 + contract test
   - 通过后 nginx 测试环境改 location
   - curl 真实调一次确认链路通
   - commit + push
4. PoC 跑通后再批量

## 关键命令速查

```bash
# Run smartbi_compat tests
cd backend/python && python -m pytest ../../tests/python/smartbi_compat/ -v

# Recompile Java (verify shim still ok)
cd backend/java/cretas-api && mvn compile -q

# 查 Java 测试环境健康
curl http://47.100.235.168:10011/api/mobile/health  # 注意：10010/10011 仅 139 网关可达，本地用 SSH tunnel

# 查 Python 测试环境健康
curl http://47.100.235.168:8084/health  # 同上

# SSH tunnel for direct Java/Python access
ssh -N -L 10011:localhost:10011 -L 8084:localhost:8084 root@47.100.235.168
# 然后本地 http://localhost:10011/... 可达
```

请告诉我你决定 Issue 1 的走法（A/B/C），然后我们开始 PoC。
```

---

## 备注

memory 已更新：
- `project_phase2a_in_progress.md`（详细进度）
- MEMORY.md 索引行
