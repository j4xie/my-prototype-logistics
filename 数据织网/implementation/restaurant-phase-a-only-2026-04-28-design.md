# 餐饮端 Phase A 设计 v2 — 数据闭环 + 共享数据质量队列

**版本**: v2 (砍 scope post-audit)
**日期**: 2026-04-28
**作者**: Claude Opus 4.7 + Steve (brainstorm + audit)
**状态**: 待评审 → 实施
**取代**: v1 (`restaurant-phase-ab-2026-04-28-design.md`) — v1 含 30% 技术假设错误（详见 §0.2）

---

## 0. 背景 + audit 教训

### 0.1 触发

post-Day 30+ 餐饮端审计揭示餐饮模块代码 ~85% 完成但**数据闭环 + 字段识别 + UX 引导只到 ~50%**。多数餐饮工厂登录后满屏 0 + 空骨架，因 prod `smartbi_prod_db` 的 `fact_pos_item` / `agg_restaurant_*` 全 0 行。

### 0.2 v1 → v2 关键变更

v1 design audit 抓 5 P0 + 11 P1。v2 修复 + 砍 scope：

| v1 错的假设 | v2 修法 |
|---|---|
| `entity_resolution_admin_queue` schema 是 raw_value/submitter/canonical_field 等 | **实际**：raw_name + candidate_entity_id + admin_action enum + RLS FORCE。spec §2.3 整段重写 |
| 新建 `restaurant/field_classifier.py` | **现已存在** `services/field_classifier.py` 395 行（role classifier）。本 spec 不重名，B-2 LLM 推迟到下一 spec |
| LLM 用 `qwen3.5-plus` + `DASHSCOPE_API_KEY` env | **真**：走 `common.llm_router` SLOT.MAPPER → qwen-turbo-1101 chain fallback，env `LLM_ALIYUN_B_API_KEY`。**B-2 LLM 推迟** |
| ETL "cron daily 03:00" + 重试 3 次 | **真**：现 hourly + 不重试 + 没失败日志表。**保留 hourly 不改 daily**，加 admin trigger 端点 + 重试新写 |
| completeness API 跨 DB 每请求建 pool | **真**：cretas_db 在 Java 侧。**复用 main.py singleton pool + 5min cache** |
| Phase A 时间 2.5 周 | **真**：Phase A 单独 4-5 周（v1 全部 4.5 周低估 60-70%）|

### 0.3 v2 scope（砍掉）

仅做 **Phase A**：
- A-0 W0 spike (3 天)
- A-1 prod 餐饮 ETL admin trigger + cron 重试 + 失败日志
- A-2 餐饮完整度页（6 模块，复用 cretas pool + cache）
- A-3 共享数据质量队列（覆盖所有 entity_type，跟数据织网 C Day 23-30 handoff 协调）

**不做（推迟到 Phase B spec v3, brainstorm 时机：A 跑完后）**：
- B-1 outlier 过滤
- B-2 LLM 字段识别（依赖现 field_classifier.py 命中率分析，需 W0.2 数据支持）
- B-3 DashboardRestaurant 信息密度

**不做（Phase C placeholder）**：multi-tenant ETL 调度 / ETL 增量 / 历史脏数据清理 / 离线 retrain ML / outlier config 化 / 监控告警 / CapabilityGate 502 修

---

## 1. W0 — Spike (3 天，spec v2 的前置必做)

不做 W0 进 W1 风险大。每个 spike task 给 deliverable，做完更新本 spec。

### 1.1 W0.1 — `entity_resolution_admin_queue` schema + 现使用情况盘点

**Task**:
- SSH 47:5432 smartbi_db
- `\d entity_resolution_admin_queue` 拿实际列定义
- `SELECT entity_type, status, COUNT(*) FROM entity_resolution_admin_queue GROUP BY entity_type, status` 看现使用情况（数据织网 B 的 store/product/staff/ingredient + C 的 field_conflict + 还有什么）
- query 现 admin queue 是否已有 row 在 prod，看 RLS 怎么应用，看 source_upload_id 字段是否真存在

**Deliverable**: 更新 §2.3 真 schema 段（不是 v1 的假 schema）。

### 1.2 W0.2 — 现 hardcoded normalizer 命中率 baseline

**Task**:
- query `smart_bi_pg_field_definitions` 拿历史所有 raw column name（区分按 `default_to_dimension` / `dtype_fallback_*` / 真识别成功）
- 测算 90 天上传数据中 hardcoded normalizer miss 比例
- 看 `services/field_classifier.py:_MEASURE_KEYWORDS / _DIMENSION_KEYWORDS` 现有覆盖

**Deliverable**: miss 率报告 + 决策"B-2 LLM 是否真必要"。如果 miss 率 < 10%，spec v3 可能不需要 B-2，只需扩 hardcoded list 即可。

### 1.3 W0.3 — 跟数据织网 C Day 23-30 handoff 协调

**Task**:
- 读 `数据织网/implementation/C-trust-ui-startup-prompt.md` 完整
- 看 C Day 23-30 计划的 cell-audit page + admin queue UI for `entity_type='field_conflict'` 实施状态（已 ship？还是没 ship？）
- 决策：A-3 共享数据质量队列页跟 C 的 cell-audit page **是否同 view**？

**3 种协调路径**:
- (协-α) A-3 单独 page (`/admin/data-quality-queue`)，跟 C cell-audit 是不同页面
- (协-β) A-3 跟 C cell-audit 同 page（`/audit/cell` 扩成支持所有 entity_type tab）
- (协-γ) A-3 page 嵌 C cell-audit 作为某 row 的 detail tab

**Deliverable**: 协-{α/β/γ} 选择 + spec v2 §2.3 路径敲定 + 跟 C handoff session 备忘录。

### 1.4 W0 时间盒

3 天。W0.1 半天，W0.2 1 天（含写 SQL + 出报告），W0.3 1.5 天（含读 C handoff + 协调讨论）。**W0 末尾 review meeting**，根据发现决定 spec v3 / 修 spec v2 路径。

---

## 2. Phase A 详细组件

### 2.1 A-1: prod 餐饮 ETL admin trigger + 重试 + 失败日志

**已有现状**（W0 verify 后修订）:
- `main.py:356-421` 已有 hourly cron 跑 `run_full_etl(cretas_pool, smartbi_pool, factory_id)` for all RESTAURANT factories
- env flag `RESTAURANT_OPS_ETL_ENABLED` (default true)
- 单工厂失败 except + warning，**不重试**，**无持久化**
- `POST /api/smartbi/restaurant-ops/etl` 已存在但**user-scoped**（从 JWT 取 factory_id）

**新增 + 修改**:

新文件:
- `backend/python/smartbi/api/restaurant_etl_admin.py` (~200 行) — admin-scoped trigger + 状态查询端点
- `backend/python/smartbi/database/migrations/V20260501_XX__restaurant_etl_failures.sql` — 失败日志表
- `web-admin/src/views/restaurant/admin/etl-status.vue` (~300 行)
- `web-admin/src/api/restaurant/etl-admin.ts` (~50 行)

修改文件:
- `backend/python/main.py` — cron 加重试逻辑 + 启动 catchup tick
- `backend/python/smartbi/gold/restaurant_ops_etl.py` — 加 helper `run_full_etl_with_retry(...)` 包 `run_full_etl(...)`
- `web-admin/src/router/index.ts` — 加 admin-only route
- `web-admin/src/components/layout/AppSidebar.vue` — admin 菜单加 "餐饮 ETL 状态"

**新表 schema**:
```sql
CREATE TABLE restaurant_etl_failures (
  id BIGSERIAL PRIMARY KEY,
  factory_id VARCHAR(50) NOT NULL,
  run_at TIMESTAMP NOT NULL DEFAULT NOW(),
  status VARCHAR(20) NOT NULL,  -- 'failed' | 'retrying' | 'failed_final'
  attempt INT NOT NULL,         -- 1-3
  error_msg TEXT,
  error_class VARCHAR(100),     -- 异常类名 e.g. 'asyncpg.exceptions.PostgresError'
  duration_ms INT,
  trace TEXT,                    -- truncated 4KB
  created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX idx_etl_fail_factory_run ON restaurant_etl_failures (factory_id, run_at DESC);

-- 90 天后归档（cron 跑）
-- 后续: 加 monthly cron DELETE FROM restaurant_etl_failures WHERE run_at < NOW() - INTERVAL '90 days';
```

**API 契约**:
```
POST /api/smartbi/restaurant/etl/trigger
  Auth: admin only (platform_admin / factory_super_admin / permission_admin)
  Body: { factoryId: string }
  Response 200: { jobId: string, status: "queued" | "running", eta: number }
  Response 4xx: { detail: "...中文..." }

GET /api/smartbi/restaurant/etl/status?factoryId=F001
  Auth: admin only
  Response 200: {
    factoryId, factoryName,
    lastSuccessRun: iso8601 | null,
    lastAttempt: iso8601 | null,
    lastStatus: "success" | "failed" | "running" | "never_ran",
    rowCounts: { fact_pos_item, agg_restaurant_daily_ops, dim_ingredient, ... },
    recentFailures: [{ runAt, attempt, errorClass, errorMsgShort }]  // 近 7 天最多 10 条
  }

GET /api/smartbi/restaurant/etl/all-status
  Auth: platform_admin only (跨工厂只 platform 看)
  Response 200: { factories: [{ factoryId, factoryName, ...status, lastSuccessRun }] }
```

**Cron 修改逻辑**:
- **保留 hourly**（不改 daily，用户上传当小时内能看到结果）
- 启动 sleep 30s（不 120s）
- 启动后立即跑 1 次 catchup tick: `if last_full_run < now - 1.5h: run_now()` 然后再 sleep 1h
- 单工厂失败重试 3 次：尝试间隔 1m / 5m / 15m
- 单工厂总 timeout 5min/attempt，3 次共 ≤ 18min
- 失败重试每次写 `restaurant_etl_failures` 行（status 'retrying' / 'failed_final'）
- 单工厂失败不阻塞其他工厂（continue 下个）

**手动 trigger 行为**:
- admin 点 "立即同步" → POST `/restaurant/etl/trigger` body=factoryId
- 后端写入 in-memory `running_jobs` dict + 启动 background task → run_full_etl_with_retry → 完成后 update + 写入 status row
- 前端轮询 `/restaurant/etl/status?factoryId=X` 每 5s 直到 status != 'running'
- 列表本身刷 30s（不每 5s 拉所有工厂）

**FE UX**:
- `/restaurant/admin/etl-status` 表格：工厂 ID / 工厂名 / 上次成功 / 上次状态 (emoji + 中文) / 行数明细 / "立即同步" 按钮
- 立即同步按钮 disabled if status='running'
- "查看失败日志" link → modal 显近 7 天 recentFailures 列表

**验收**:
- cron 跑完后餐饮工厂的 `agg_restaurant_daily_ops` `fact_pos_item` `dim_ingredient` ≥ 0 行（XMX 等真客户工厂应非 0）
- F002/BEJ 登录后餐饮总览页 + 菜品毛利分析页 从空骨架变有数据
- 故意让 cretas_pool 临时不可用 → admin trigger 应重试 3 次然后写 failed_final，下次 hourly tick 自动恢复
- 服务重启后 30s 内 cron 启动，1.5h 以内未跑过的工厂 catchup 立刻跑

---

### 2.2 A-2: 餐饮完整度页

**新文件**:
- `web-admin/src/views/restaurant/data-completeness.vue` (~250 行)
- `web-admin/src/api/restaurant/completeness.ts` (~50 行)
- `backend/python/smartbi/api/restaurant_completeness.py` (~200 行)

**修改文件**:
- `web-admin/src/router/index.ts` — `/restaurant/data-completeness`
- `web-admin/src/components/layout/AppSidebar.vue` — RESTAURANT 工厂下"数据完整度"指新路由

**6 模块定义** (post-audit P1-9 公平 coverage 公式):

| ID | 名称 | 数据源 | hasData | coverage 公式 |
|---|---|---|---|---|
| `pos_sales` | POS 销售数据 | `smart_bi_pg_excel_uploads` (sheet 含 销售/订单/营业) | 有 sheet | clamp((sheets * 50 + transactions / 1000), 0, 100) |
| `menu_recipe` | 菜单/配方 | `cretas_db.recipes` join `dim_dish` | recipes > 0 | recipe_dish / total_dish * 100 |
| `requisition` | 领料记录 | `cretas_db.material_requisitions` | 近 N 天 > 0 | min(records_N / N * 100, 100) |
| `wastage` | 损耗记录 | `cretas_db.wastage_records` | 近 N 天 > 0 | 同上 |
| `stocktaking` | 盘点记录 | `cretas_db.stocktaking_records` | 近 N 天 > 0 | 同上 |
| `review` | 顾客评价 | `restaurant_reviews` + `restaurant_review_sources` | 评价 > 0 | review_count / 100 clamp 0-100 |

`N` = `min(30, days_since_factory_created)` — 防新工厂上线第 1 周显黄色误导用户（P1-9 修复）。

**实现要点（post-audit P0-5 修复）**:
- **复用 `main.py` 已有 `cretas_pool` singleton**（不每请求建 pool）
- 后端 module-level cache: `LRU(maxsize=64) cache_completeness(factory_id, ttl=300s)` — 5min TTL
- 6 个 SQL count 全用 prepared statement，加 `WHERE factory_id = $1` 第一位

**API 契约**:
```
GET /api/smartbi/restaurant/completeness?factoryId=F001
  Auth: factory user (非 admin 也可看自己工厂; admin 可跨工厂查)
  Response 200:
  {
    factoryId, factoryName, factoryType,
    factoryAgeDays: int,         // 上线天数
    modules: [
      {
        id: "pos_sales",
        name: "POS 销售数据",
        hasData: bool,
        recordCount: int,
        recordCountWindow: int,   // 近 N 天计数（factory_age 决定 N）
        windowDays: int,
        lastUpdated: iso8601 | null,
        coverage: 0-100,
        missingHints: ["请上传含 订单时间/营业额 的 Excel"]
      },
      ... 5 个 ...
    ],
    overallCompleteness: 0-100,   // 6 模块 coverage 简单平均
    cachedAt: iso8601              // cache hit 标识
  }
```

**FE UX**:
- 顶部：工厂名 + 总体完整度 ring chart (0-100%) + "上次更新" + "上线天数 X" 标签
- 中部：6 卡片 grid（2 列 × 3 行），每卡：
  - 模块名 + 覆盖率进度条（颜色：< 30% red / 30-70% yellow / > 70% green）
  - 关键数字（"41 道菜，9 道有配方，22% 覆盖率"）
  - "上传缺失数据" 按钮 → 跳 `/smart-bi/excel-upload`
  - 缺失提示 (`missingHints` 数组)

**验收**:
- F002 登录后看到 6 模块各自状态
- 新工厂（factory_age < 7 天）coverage 不会因为"近 30 天"逻辑显示假性 yellow
- cache hit 第 2 次 / 第 3 次访问 < 50ms（API response time 监控）

---

### 2.3 A-3: 共享数据质量队列 (跟 C handoff 协调)

⚠️ **本节路径取决于 W0.3 协调结果**。spec v2 假设 W0.3 选 (协-α) 或 (协-β)。决策后回填本段。

**v1 错的假设 vs 真 schema** (post-audit P0-1 修复):

| 字段 | v1 假设 | 真实 |
|---|---|---|
| 标识 | `id` | `id BIGSERIAL` ✓ |
| 工厂 | `factory_id` | `factory_id VARCHAR(50)` + RLS FORCE ✓ |
| 类型 | `entity_type` 含 'field_name' | `entity_type` CHECK 含 store/product/staff/ingredient/shape_detection/sheet_merge/period_inference/field_conflict — **没 'field_name'** |
| 待标值 | `raw_value` | `raw_name TEXT` |
| 候选 | `suggested_canonical` | `candidate_entity_id BIGINT` (NULL=新建) |
| 置信 | `suggested_confidence` | `confidence` ✓ |
| 来源 | `source` ('llm'/'normalizer') | `decided_by_agent` (string) |
| 状态 | `status` ('pending'/'resolved'/'rejected') | `status` ('PENDING'/'CONFIRMED'/'REJECTED'/'DEFERRED') |
| 提交人 | `submitter` / `submitter_role` | **不存在** — 必须 `JOIN smart_bi_pg_excel_uploads ON source_upload_id` 拿 `uploaded_by` |
| 解决 | `resolved_canonical` | `admin_resolved_to_entity_id BIGINT` |
| 解决人 | `resolved_by` | `admin_user`, `admin_at` |
| 拒绝 | `reject_reason` | `admin_action` ('confirm'/'reject'/'create_new') 没专列 reason，可放 `extra` JSONB |
| 多级审核 | 无 | `reviewed_by`, `reviewed_at` 已存在 |
| 优先级 | 无 | `priority` ✓ |
| 上下文 | 无 | `dropped_row_refs JSONB`, `reasoning`, `extra JSONB` ✓ |

**spec v2 实施决策**:

1. **不加 'field_name' entity_type 到 CHECK constraint**（推迟到 Phase B B-2 LLM 字段识别 spec v3 时一并加）。本 spec A-3 仅做 8 个现有 entity_type 的统一 admin UI。

2. **4-eye 通过 source_upload_id JOIN**:
   ```sql
   SELECT q.*, u.uploaded_by AS submitter
   FROM entity_resolution_admin_queue q
   LEFT JOIN smart_bi_pg_excel_uploads u ON u.id = q.source_upload_id
   WHERE q.factory_id = $1 AND q.status = 'PENDING'
   ```
   admin resolve 时检查 `current_user != submitter`（除非工厂 admin 数 = 1）。

3. **admin queue UI 路径**: 取决于 W0.3 协调结果。
   - 若 (协-α): 新建 `/admin/data-quality-queue` (admin only)
   - 若 (协-β): 扩 C cell-audit page (`/audit/cell`) 加 entity_type tabs
   - 若 (协-γ): 暂缓，跟 C handoff 同步设计后再 spec v3

4. **数据织网 C 已用 `field_conflict`**（V20260501_03 ship），spec v2 必须不破坏 C 的使用方式。

**新文件** (假设 (协-α) 路径):
- `web-admin/src/views/admin/data-quality-queue.vue` (~600 行) — 列表 + entity_type tabs + 筛选 + 批量
- `web-admin/src/views/admin/data-quality-queue-detail.vue` (~250 行) — 单条详情 + 历史 + approve UI
- `web-admin/src/api/admin/data-quality-queue.ts` (~120 行)
- `backend/python/smartbi/api/data_quality_queue_admin.py` (~350 行)

**修改文件**:
- `web-admin/src/router/index.ts` — `/admin/data-quality-queue` (admin only)
- `web-admin/src/components/layout/AppSidebar.vue` — 主 admin 菜单加 "数据质量队列"
- 数据织网 C handoff 协调：若 C cell-audit 已 ship，加跨链路链接

**API 契约**:
```
GET /api/smartbi/admin/data-quality-queue
  Auth: admin only
  Query: factoryId? entityType? status? page=1 pageSize=50
  Response 200: {
    items: [{
      id, factoryId, entityType,
      rawName, candidateEntityId, confidence,
      decidedByAgent, status, priority,
      sourceUploadId, submitter,         // computed via JOIN
      reviewedBy, reviewedAt,
      adminUser, adminAt, adminAction, adminResolvedToEntityId,
      reasoning, extra,
      createdAt, updatedAt
    }],
    total, page, pageSize
  }

POST /api/smartbi/admin/data-quality-queue/{id}/resolve
  Auth: admin only
  Body: {
    action: 'confirm' | 'create_new',
    resolvedToEntityId: int | null,    // confirm 时必填
    notes: string | null
  }
  4-eye check: 拒绝 current_user == submitter (除非工厂 admin 数 = 1)
  RLS: SET app.factory_id = q.factory_id 在 transaction 开头
  Side effects:
    - UPDATE queue.status='CONFIRMED', admin_action, admin_user, admin_at, admin_resolved_to_entity_id
    - 不直接写 entity_resolution_labels（B-2 LLM 上线时再做 cache 写入）
  Response 200: { resolved: true }
  Response 403: { detail: "您是该字段的提交者，需另一管理员审核（4-eye 原则）" }

POST /api/smartbi/admin/data-quality-queue/{id}/reject
  Body: { reason: string }
  Auth + 4-eye 同 resolve

POST /api/smartbi/admin/data-quality-queue/batch-resolve
  Body: { ids: int[], action, resolvedToEntityId? }
  Per-id transaction (不是大 transaction) — 单 ID 失败收集 failedItems 不影响其他
  按 factoryId grouping → 每组 1 次 set_config
  4-eye on each id
  Response 200: { successCount, failedItems: [{ id, reason }] }
  Idempotency: header `Idempotency-Key`，重复 request 不双写

GET /api/smartbi/admin/data-quality-queue/{id}/history
  // 该 (factoryId, entity_type, raw_name) 历史所有决策
  Response 200: { items: [...] }

GET /api/smartbi/admin/data-quality-queue/admin-count?factoryId=X
  // 用于 4-eye 单 admin 降级判断
  Auth: admin only
  Response 200: { count: int }
```

**4-eye 单 admin 降级**:
- 客户端调 `/admin-count?factoryId=X` 查工厂 admin 数
- 数 == 1 时：UI 顶 banner 显警告 "该工厂仅 1 名管理员, 4-eye 降级"
- 后端 resolve 时 admin_count == 1 也允许 self-resolve，但 `extra` JSONB 存 `{"single_admin_degraded": true, "submitter": "..."}` 留审计

**FE UX**:
1. 列表页 — el-table，按 entity_type 强制 tab（store / product / staff / ingredient / field_conflict / shape_detection / sheet_merge / period_inference）
2. 顶部筛选：工厂、状态、优先级、来源 (decided_by_agent)
3. 点 row → 弹 in-place 处理 modal:
   - 当前 raw 值 + 候选 entity (candidate_entity_id)
   - 操作 radio: confirm / reject / create_new
   - confirm 时下拉选 entity（按 entity_type 类型）
   - reject 时填 reason → 写 extra.reject_reason
   - 4-eye 检查：UI 在弹窗顶部显 "提交人: X, 当前: Y, 4-eye OK" 或 "您是提交人，无法处理"
4. 批量操作：勾 N row + 顶部 "批量 confirm" → 弹 "确认 N 条同 entity_type" 对话框
5. 详情页：单 row 详情 + 该 (factoryId, raw_name) 历史所有决策 + dropped_row_refs 展开

**单工厂 admin 数判定**:
- Java 端新加 `GET /api/mobile/{factoryId}/users/admin-count` 端点
- query: `WHERE factory_id = X AND role IN ('factory_super_admin', 'permission_admin', 'factory_admin') AND deleted_at IS NULL`
- platform_admin 不算（跨工厂）
- 不要 Python 直查 cretas_db users（隔离，post-audit P1-4）

**验收**:
- F002 登录看到现有 store/product/staff/ingredient row 列表（数据织网 B 已 ship）
- 模拟 store 候选入 queue → admin 确认 → status 变 CONFIRMED + admin_user 记录
- 4-eye：submitter 自己点 resolve 返 403 + 友好中文提示
- 批量 5 行同 entity_type 一次性成功
- 单 admin 工厂自动降级且 UI 显警告
- 跟 C `entity_type='field_conflict'` 共存不冲突

---

## 3. 数据流图

```
┌─────────────────────────────────────────────────────────────────────────┐
│                       用户上传 Excel (餐饮)                              │
└──────────────────────────┬──────────────────────────────────────────────┘
                           ↓
        ┌─────────────────────────────────────┐
        │  excel_async.py 解析 sheets         │
        │  + 现 hardcoded normalizer 识别     │
        │  miss → admin queue (existing flow) │
        └──────────────────────────┬──────────┘
                                   ↓
        ┌─────────────────────────────────────┐
        │  smart_bi_pg_excel_uploads 入库      │
        └──────────────────────────┬──────────┘
                                   ↓
        ┌─────────────────────────────────────┐
        │  hourly cron (A-1) 自动              │
        │  + admin "立即同步" 按钮 (A-1)       │
        │  restaurant_ops_etl.run_full_etl_with_retry │
        │     bronze (uploads) → silver (fact/dim) │
        │     → gold (agg_restaurant_*)            │
        │     失败重试 3 次 → 写 etl_failures 表   │
        └──────────────────────────┬──────────┘
                                   ↓
        ┌────────────────────┬─────────────────────┐
        │ /restaurant/data-  │ /restaurant/        │
        │ completeness (A-2) │ analytics/* (现有)  │
        │ 6 模块覆盖率        │ 6 个分析页（暂无 outlier 黄标） │
        │ 复用 cretas_pool    │                     │
        │ + 5min cache        │                     │
        └────────────────────┴─────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│  admin 在 /admin/data-quality-queue (A-3)                              │
│  - 列表所有 entity_type (store/product/staff/ingredient/field_conflict/│
│    shape_detection/sheet_merge/period_inference)                       │
│  - 4-eye via source_upload_id JOIN                                     │
│  - 单 admin 工厂自动降级                                                │
│  - 跟数据织网 C cell-audit page 协调 (W0.3 决策)                        │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 4. 测试策略

### 4.1 vitest (FE 单元)
- A-2 `data-completeness.vue` — 6 模块渲染 + missingHints + factoryAgeDays 公式 + cache 命中标识
- A-3 `data-quality-queue.vue` — entity_type tabs + in-place 处理弹窗 + 4-eye gate (submitter !== current user) + 单 admin 降级 banner
- A-3 `data-quality-queue.vue` — 批量处理 + history tab + idempotency

### 4.2 pytest (BE 单元)
- A-1 `restaurant_etl_admin` — trigger 端点 4 测试 (RBAC + valid + invalid factoryId + 状态查询)
- A-1 `run_full_etl_with_retry` — 重试 3 次后 failed_final 写日志表 / catchup tick / startup 30s 复苏
- A-1 失败日志表 — 90 天归档逻辑（cron）
- A-2 `restaurant_completeness` — 6 模块 SQL + cretas_pool 复用 + 5min cache + factoryAgeDays 公式
- A-3 `data_quality_queue_admin` — 4-eye 拒 submitter self-resolve (403 中文) + 单 admin 降级 + RLS context 切换 + 批量 partial success + idempotency
- A-3 跟 C field_conflict 共存测试

### 4.3 Java mvn (新 controller)
- `UserController.adminCount(factoryId)` — query users 排除 platform_admin + deleted_at IS NULL

### 4.4 Playwright smoke E2E (新增到 `data-fabric-c-smoke-e2e.spec.ts`)
- A-1 admin trigger — 模拟 ETL 状态查询 + 立即同步按钮 + 失败日志列表
- A-2 餐饮完整度页 — F002 登录 6 模块卡片 + 新工厂 factoryAge<7 天显示
- A-3 共享 admin queue — 模拟 store 候选入 queue → admin 确认；4-eye；批量

### 4.5 真窗 verify (deploy 后)
- F002 / R_BEJ / qhj_prod 登录验证 dashboard 不再 0 骨架
- BEJ 上传 1081 行营业数据 → ETL hourly 跑后 `agg_restaurant_*` 真有数
- 故意让 cretas_pool 下线 → admin trigger 重试 3 次 + 失败日志写入

---

## 5. 风险 + 缓解 (post-audit P1-7 补全)

| 风险 | 概率 | 影响 | 缓解 |
|---|---|---|---|
| ETL 跑很久卡 prod | 中 | 高 | hourly 03:00 不必做，单工厂 timeout 5min/attempt + 不阻塞其他 + 重试 3 次 |
| LLM 配额耗尽 | — | — | **本 spec 无 LLM 调用**（B-2 推迟） |
| admin queue 表数据快速增长 | 中 | 中 | 加 monthly cron `DELETE WHERE admin_at < NOW() - 90 days`（spec §5 验收 + Phase C 自动化） |
| admin queue 单 admin 工厂没人 approve | 中 | 低 | 4-eye 软规则：单 admin 自动降级到 1-eye + 标 `single_admin_degraded` audit |
| `entity_resolution_admin_queue` schema 跟 spec 假设不符 | **W0.1 就 verify** | — | spec v2 §2.3 已写明真 schema，W0.1 进一步 sanity check + sample data |
| 跟数据织网 C cell-audit page 重复实施 | **W0.3 协调** | — | W0.3 协调 (协-α/β/γ) 选定后回填本 spec |
| Python 跨 DB pool 性能 | 低 | 中 | 复用 main.py singleton + 5min cache + factory_id WHERE 第一位 |
| cron worker 进程崩溃 | 低 | 中 | systemd 自动重启 + 启动 30s + catchup tick if last_run < now-1.5h |
| Concurrent admin resolve 同 ID race | 低 | 中 | per-id transaction + Idempotency-Key + UPDATE WHERE status='PENDING' (单调状态机) |
| Prompt injection (列名含恶意内容) | — | — | **本 spec 无 LLM**（推迟到 spec v3） |

---

## 6. 实施时间表

| 周 | 任务 | 可验证 milestone | 改动量估 |
|---|---|---|---|
| **W0** | spike 3 任务 (schema verify / normalizer 命中率 / C handoff 协调) | spec v2 §2.3 路径敲定 + 决策"B-2 LLM 是否做" + spec v2 review meeting | 0 行代码，1 份 spike report |
| **W1** | A-1 ETL admin trigger + 重试 + 失败日志表 + 启动 catchup | F001 + 餐饮工厂 hourly cron 跑完 `agg_restaurant_*` 非 0；admin "立即同步" 端到端工作；模拟失败重试 3 次写 failure log | ~900 行 |
| **W2** | A-2 餐饮完整度页 6 模块 (BE + FE) | F002 登录看到 6 模块卡，至少 1 模块有真数据；factoryAge < 7 天显正确；cache hit 时间 < 50ms | ~500 行 |
| **W3-4** | A-3 共享数据质量队列 (覆盖 8 entity_type, 4-eye, 批量, 单 admin 降级) | 现有 store/product/staff/ingredient row 出现在 admin queue UI；4-eye 拒 submitter self-resolve；批量 5 row 同 entity_type 成功；跟 C field_conflict 共存 | ~1400 行 |
| **W4-5** | 测试补 + smoke E2E + 真窗 verify + push origin | vitest + pytest + Java mvn 全 PASS；新 5+ smoke E2E PASS；真窗 F002/BEJ/qhj_prod 全验过 | ~700 行 (含测试) |

**总计** ~3500-4000 行（v1 估 2500-3500，post-audit P1-8 修正后 3500-4000，因为砍 Phase B 减 ~2000 行）。

**总 4-5 周对单人现实**（v1 4.5 周 包含 Phase B 是低估的；本 v2 砍 B 后 4-5 周可行）。

**风险缓冲**: 留 0.5-1 周 buffer。

---

## 7. Phase B/C 路标 (placeholder, 等下次 brainstorm)

**Phase B brainstorm 时机**: Phase A 跑完 + W0.2 normalizer 命中率报告出来后再 brainstorm:
- B-1 outlier 过滤（Soft-warn IQR + global fallback + factor 历史采样源）
- B-2 LLM 字段识别（如 W0.2 命中率 < 90%; 用现有 `common.llm_router` SLOT.MAPPER + few-shot from `restaurant_field_canonical_labels` 新表）
- B-3 DashboardRestaurant 信息密度（4+4 stat + 4 摘要卡 + AI 推荐）

**Phase C placeholder** (Month 2):
- 多租户 ETL 调度 / ETL 增量 / 历史脏数据 cleanup migration / 离线 retrain ML / outlier config 化 / 监控告警 / CapabilityGate 502 修 / 餐饮 dashboard 编辑器

---

## 8. 验收标准 (Phase A 整体)

完成后：

- [ ] cron 跑完后餐饮工厂的 `agg_restaurant_daily_ops` `fact_pos_item` `dim_ingredient` 非 0（XMX/F002/BEJ）
- [ ] F002/BEJ 登录后餐饮总览页 + 菜品毛利分析页从空骨架变有数据
- [ ] /restaurant/data-completeness 6 模块各自正确反映工厂数据状态
- [ ] /admin/data-quality-queue (或协-β 路径下的 cell-audit 扩展) 8 entity_type 列表 + 4-eye + 单 admin 降级
- [ ] admin "立即同步" 按钮端到端工作
- [ ] 重试 3 次 + 失败日志表 verify
- [ ] 跟数据织网 C cell-audit page 协调一致 (W0.3 决策)
- [ ] 真窗 smoke E2E 在新加 5+ 测试全 PASS
- [ ] vitest + pytest + Java mvn 测试基线不退（≥ 当前 107 个测试 + 新加的）

---

## 9. 后续行动

设计 approved 后:

1. **W0 (3 天) 必做** — 不可跳。3 个 spike 报告决定 spec v2 §2.3 路径 + spec v3 是否需要 B-2
2. W0 末尾 review meeting → spec v2 修订 (W0 发现可能改路径) → 用 `superpowers:writing-plans` 转 implementation plan
3. W1-W5 按周 commit + deploy + 真窗 verify + push origin
4. Phase A 跑完后 brainstorm Phase B (基于 W0.2 normalizer 命中率报告)

---

## 10. 跟 v1 spec 关系

v1 spec (`restaurant-phase-ab-2026-04-28-design.md`) 保留作为历史参考 + audit findings 写明 v1 30% 技术假设错误。**v1 不实施**，只 v2 实施。

---

**作者**: Claude Opus 4.7 + Steve (brainstorm + audit)
**审阅状态**: 待评审
