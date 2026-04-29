# 餐饮端 Phase A+B 设计 — 数据闭环 + 字段识别 + UX 引导

**版本**: v1
**日期**: 2026-04-28
**作者**: Claude Opus 4.7 + Steve (brainstorm)
**状态**: 待评审 → 实施

---

## 0. 背景 + 触发

post-Day 30+ 餐饮端审计揭示：餐饮模块**框架/UI ~85% 完成**（5267 行 view + 5062 行后端 + 9 个路由 + 5 个 controller + 40+ Python 端点），但**数据闭环 + 字段识别 + UX 引导只到 ~50%**。

具体症状：
- 多数餐饮工厂 (`F002`/`R_BEJ`/`R_GML`/`R_ITE`/`R_SMH`/`R_YJJ`) 登录后**满屏 0 + 空骨架**，因为 prod `smartbi_prod_db` 的 `fact_pos_item` / `agg_restaurant_*` 全 0 行
- 字段识别脆弱：BEJ "连锁" 上传 1081 行营业数据，"门店列"识别失败 → 门店数=0
- BEJ 品均价 ¥46480 等 outlier 没过滤 → 用户误以为系统崩了
- `entity_resolution_admin_queue` 后端表存在但**无前端入口**，用户必须重传 Excel 修正字段
- `/smart-bi/data-completeness` 是 manufacturing 视角，餐饮工厂访问完全没意义
- DashboardRestaurant 仅 4 stat 卡（today/month），新工厂登录第一眼是 0

**目标**：4-4.5 周内推到 ~85% 可用，分两阶段（A 数据闭环，B 数据准 + UX）。

**用户原话**：「数据织网的目标是放在餐饮这边」「都要做」「单 spec 覆盖 A+B 详细，C 留 placeholder」。

---

## 1. 总览

### 1.1 范围 + 阶段

```
Phase A — Demo-ready (Week 1-2.5)
  A-1  prod 餐饮 ETL trigger + cron daily + admin status page
  A-2  /restaurant/data-completeness 新页 6 模块
  A-3  /restaurant/admin/field-queue 完整版 (in-place + 批量 + history + 4-eye)

Phase B — Beta-ready (Week 3-4)
  B-1  outlier 过滤 (Soft-warn IQR + 全局 fallback)
  B-2  LLM 字段识别 (Hardcoded → LLM + Few-shot prompting; 半异步 5s budget)
  B-3  DashboardRestaurant 信息密度 (4+4 stat + 4 摘要卡 + AI 推荐查询)

Phase C — Prod-ready (Month 2, placeholder)
  多租户性能 / ETL 增量 / 历史数据 cleanup / 离线 retrain ML / 监控告警 / outlier config 化
```

### 1.2 改动量估

- 后端 Python：~6 新文件 + ~4 修改
- 后端 Java：~1-2 修改（4-eye 字段在 entity_resolution_admin_queue 上）
- 前端 Vue：~5 新页/组件 + ~3 修改
- 测试：vitest + pytest + 1-2 新 smoke E2E

总 ~2500-3500 行（含测试）。Phase A 占 60%，Phase B 占 40%。

### 1.3 不在范围内（明确不做，留 Phase C）

- 多客户并发 ETL 调度 / 增量
- 历史脏数据 cleanup migration
- 离线 retrain ML model（自学习只走 in-context learning）
- ETL 失败告警 / LLM 调用监控
- outlier config 表 + admin 配置 UI（仅用 hardcoded 全局 + 自动 IQR）
- CapabilityGate 502 修
- 多餐饮 dashboard 编辑器

---

## 2. Phase A 详细组件

### 2.1 A-1: prod 餐饮 ETL trigger + cron

**新文件**:
- `backend/python/scripts/restaurant_etl_cron.py` — cron worker 启动入口
- `backend/python/smartbi/api/restaurant_etl_admin.py` — 手动 trigger + 状态查询端点
- `web-admin/src/views/restaurant/admin/etl-status.vue` — admin 页显示每工厂 last run + status

**修改文件**:
- `backend/python/main.py` — 启动时注册 cron task（参考已有 `[startup] restaurant-ops hourly ETL armed` 模式）
- `backend/python/smartbi/gold/restaurant_ops_etl.py` — 加 `trigger_for_factory(factory_id) -> JobStatus` 入口（如还没有）
- `web-admin/src/router/index.ts` — 加 `/restaurant/admin/etl-status` 路由 + meta.roles=admin

**API 契约**:

```
POST /api/smartbi/restaurant/etl/trigger
  Auth: admin only
  Body: { factoryId: string }
  Response 200: { jobId: string, status: "queued" | "running", eta: number }
  Response 4xx: { detail: "..." } (中文)

GET /api/smartbi/restaurant/etl/status?factoryId=F001
  Auth: admin only
  Response 200: {
    factoryId: string,
    lastRun: iso8601 | null,
    status: "success" | "failed" | "running" | "never_ran",
    rowCounts: { fact_pos_item, agg_restaurant_daily_ops, dim_ingredient, ... },
    failureCount: number
  }

GET /api/smartbi/restaurant/etl/all-status
  Auth: admin only
  Response 200: { factories: [{ factoryId, factoryName, ...status }] }
```

**Cron 策略**:
- 每天 03:00 (CST) 跑所有 `factoryType=RESTAURANT` 工厂
- 每工厂 timeout 5 min
- 失败重试 3 次（指数退避 1m / 5m / 15m）
- 全失败写 `restaurant_etl_failures` 日志表（schema: factory_id, run_at, error_msg）
- 单工厂失败不阻塞其他工厂

**FE UX**:
- `/restaurant/admin/etl-status` 表格：工厂 ID / 工厂名 / 上次运行 / 状态（emoji + 中文）/ 行数明细 / "立即同步" 按钮
- 立即同步按钮点击 → POST trigger → 5s polling status → toast 完成或失败

**验收标准**:
- cron 跑完后餐饮工厂的 `agg_restaurant_daily_ops` `fact_pos_item` `dim_ingredient` ≥ 0 行（XMX 等真客户工厂应非 0）
- 真窗 verify F002/BEJ 登录后餐饮总览页 + 菜品毛利分析页 能从空骨架变有数据

---

### 2.2 A-2: 餐饮完整度页 (新路由)

**新文件**:
- `web-admin/src/views/restaurant/data-completeness.vue` (~250 行)
- `web-admin/src/api/restaurant/completeness.ts` (~50 行)
- `backend/python/smartbi/api/restaurant_completeness.py` (~150 行)

**修改文件**:
- `web-admin/src/router/index.ts` — 加 route `/restaurant/data-completeness`
- `web-admin/src/components/layout/AppSidebar.vue` — RESTAURANT 工厂下"数据完整度" sidebar 链接指新路由

**6 模块定义**:

| ID | 名称 | 数据源 | hasData 判定 | coverage 计算 |
|---|---|---|---|---|
| `pos_sales` | POS 销售数据 | `smart_bi_pg_excel_uploads` (sheet name 含 销售/订单/营业) | 上传过任意 sheet | (sheets * 50 + transactions / 1000) clamp 0-100 |
| `menu_recipe` | 菜单/配方 | `cretas_db.recipes` join `dim_dish` | recipes > 0 | recipe_dish / total_dish * 100 |
| `requisition` | 领料记录 | `cretas_db.material_requisitions` | 近 30 天 > 0 | min(records_30d / 30 * 100, 100) |
| `wastage` | 损耗记录 | `cretas_db.wastage_records` | 近 30 天 > 0 | min(records_30d / 30 * 100, 100) |
| `stocktaking` | 盘点记录 | `cretas_db.stocktaking_records` | 近 30 天 > 0 | min(records_30d / 30 * 100, 100) |
| `review` | 顾客评价 | `restaurant_reviews` + `restaurant_review_sources` | 评价 > 0 | review_count / 100 clamp 0-100 |

**API 契约**:

```
GET /api/smartbi/restaurant/completeness?factoryId=F001
  Auth: factory user (非 admin 也可看自己工厂)
  Response 200:
  {
    factoryId, factoryName, factoryType,
    modules: [
      {
        id: "pos_sales",
        name: "POS 销售数据",
        hasData: bool,
        recordCount: int,
        lastUpdated: iso8601 | null,
        coverage: 0-100,
        missingHints: ["请上传含 订单时间/营业额 的 Excel"]
      },
      ... 5 个 ...
    ],
    overallCompleteness: 0-100  // 6 模块 coverage 简单平均
  }
```

**FE UX**:
- 页面顶部：工厂名 + 总体完整度 ring chart (0-100%) + "上次更新" 时间
- 中部：6 卡片 grid（2 列 × 3 行），每卡：
  - 模块名 + 覆盖率进度条（color 按 coverage：< 30% red / 30-70% yellow / > 70% green）
  - 关键数字（"41 道菜，9 道有配方，22% 覆盖率"）
  - "上传缺失数据" 按钮 → 跳 `/smart-bi/excel-upload`
  - 缺失提示 (`missingHints` 数组)

**验收标准**:
- F002 登录后看到 6 模块各自状态
- 能区分"完全无数据" vs "有数据但不全"
- 每个模块给出明确补全提示
- 总体完整度合理（不应是 0% 或 100% 极端值）

---

### 2.3 A-3: admin queue FE 完整版 (γ)

**新文件**:
- `web-admin/src/views/restaurant/admin/field-queue.vue` (~600 行) — 列表 + 筛选 + 批量 + in-place 映射弹窗
- `web-admin/src/views/restaurant/admin/field-queue-detail.vue` (~200 行) — 单条详情 + 历史 + approve UI
- `web-admin/src/api/restaurant/admin-queue.ts` (~100 行)
- `backend/python/smartbi/api/entity_resolution_admin.py` (~300 行)

**修改文件**:
- `web-admin/src/router/index.ts` — 加 admin route + meta.roles=['platform_admin','factory_super_admin','permission_admin']
- `web-admin/src/components/layout/AppSidebar.vue` — admin 菜单加 "字段标注队列"
- `entity_resolution_admin_queue` 表（数据织网 B 阶段已 ship）— **检查现有 schema 是否有 `submitter` / `submitter_role` 字段**，若无加 migration

**DB schema 假设**（待 verify 后调整）:

```sql
-- 数据织网 B 已有
CREATE TABLE entity_resolution_admin_queue (
  id BIGSERIAL PRIMARY KEY,
  factory_id VARCHAR(50) NOT NULL,
  entity_type VARCHAR(50) NOT NULL,  -- 'field_name', 'dish_name', 'store_name', etc.
  raw_value TEXT NOT NULL,
  suggested_canonical TEXT,           -- LLM/normalizer 建议
  suggested_confidence NUMERIC(3,2),
  source VARCHAR(20),                 -- 'llm' / 'normalizer' / 'manual'
  status VARCHAR(20) DEFAULT 'pending', -- 'pending' / 'resolved' / 'rejected' / 'llm_pending'
  submitter VARCHAR(50),              -- ⚠️ 4-eye 用 (新加)
  submitter_role VARCHAR(50),         -- ⚠️ 4-eye 用 (新加)
  resolved_canonical TEXT,
  resolved_by VARCHAR(50),
  resolved_at TIMESTAMP,
  reject_reason TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  notes TEXT
);
```

若 `submitter` / `submitter_role` 不存在，加 migration `V20260501_X__add_submitter_to_admin_queue.sql`。

**API 契约**:

```
GET /api/smartbi/restaurant/admin/field-queue
  Auth: admin only
  Query: factoryId (optional), status, entityType, page, pageSize
  Response 200: {
    items: [{ id, factoryId, entityType, rawValue, suggestedCanonical, suggestedConfidence,
              source, status, submitter, submitterRole, createdAt, ... }],
    total, page, pageSize
  }

POST /api/smartbi/restaurant/admin/field-queue/{id}/resolve
  Auth: admin only
  Body: { canonicalField: string, notes: string | null }
  4-eye check: 拒绝 submitter === current user (除非工厂只 1 个 admin, 见 §2.3 单 admin 降级)
  Side effects:
    - UPDATE queue.status='resolved', resolved_by, resolved_at, resolved_canonical
    - INSERT entity_resolution_labels (factory_id, raw_value, canonical_value, source='admin', confidence=1.0)
  Response 200: { resolved: true, labelsCacheUpdated: bool }
  Response 403: { detail: "您是该字段的提交者, 需另一管理员审核 (4-eye 原则)" }

POST /api/smartbi/restaurant/admin/field-queue/{id}/reject
  Body: { reason: string }
  Auth + 4-eye 同 resolve
  Response 200: { rejected: true }

POST /api/smartbi/restaurant/admin/field-queue/batch-resolve
  Body: { ids: int[], canonicalField: string }
  Auth + 4-eye on each id
  Returns: { successCount, failedItems: [{ id, reason }] }

GET /api/smartbi/restaurant/admin/field-queue/{id}/history
  Response: { items: [{ raw_value, canonical, resolved_at, resolved_by }] }
  // 该 (factory_id, raw_value) 的所有历史决策
```

**4-eye 单 admin 降级**:
- 若工厂只有 1 个 admin（query users WHERE factory_id=X AND role IN admin），自动降级到 1-eye
- UI 在该工厂的 queue 顶部显警告 banner: "该工厂仅 1 名管理员, 4-eye 原则降级。建议加第二名管理员"

**FE UX 流程**:
1. 列表页 — el-table 显示：raw 列名 / Excel 文件名 / 上传时间 / LLM 建议（含 confidence tag）/ 提交人 / 状态
2. 顶部筛选条：工厂、状态、来源、entity type
3. 点 row → 弹 in-place 映射 modal:
   - 当前 raw 值（"经营点"）+ LLM 建议（"建议: store_name, confidence 0.85"）
   - 下拉选 canonical 字段（含搜索）
   - 备注输入
   - 4-eye 检查：submitter === current user 时 button disabled + 提示 "需另一管理员审核"
   - 点确认 → API call → toast 成功 → list 自动 refresh
4. 批量操作：勾选 N row + 顶部 "批量映射"按钮 → 弹 "全部映射为 X" 对话框 + 确认
5. 详情页：单 row 详情 + 该 (factoryId, rawValue) 历史所有决策

**自学习闭环触发点**: resolve API 同步写 `entity_resolution_labels` 表（无新 schema，仅 INSERT）。后续上传同 (factoryId, rawValue) 命中 cache 跳过 LLM。

**验收标准**:
- BEJ 上传含 "门店名称" 列且 hardcoded miss 后，LLM 给出 "建议: store_name, confidence 0.85" 进 queue
- 另一管理员能 in-place 确认，确认后 BEJ 重新触发分析门店数 != 0
- 4-eye：submitter 自己点 resolve 返 403 + 友好中文提示
- 批量 resolve 5 行同 canonical 字段一次性成功
- 单 admin 工厂自动降级且 UI 显警告

---

## 3. Phase B 详细组件

### 3.1 B-1: outlier 过滤 (Soft-warn)

**新文件**:
- `backend/python/smartbi/services/restaurant/outlier.py` (~200 行)
- `web-admin/src/utils/restaurant-outlier.ts` (~80 行)

**修改文件**:
- `backend/python/smartbi/api/restaurant_analytics.py` — KPI 输出处调 outlier service 标记
- 餐饮 view 文件 (`overview.vue` / `menu-board.vue` / `gross-margin.vue` / `store-comparison.vue` / `dianping-gap.vue`) — KPI 渲染处用 `<el-tooltip>` 包 outlier 黄标

**算法核心**:

```python
def detect_outliers(values: list[float], factory_id: str, metric: str) -> list[float]:
    """返回值列表中的异常值列表 (不删除原数据，仅标记)."""
    history = load_metric_history(factory_id, metric, days=90)
    if len(history) >= 30:
        # IQR-based per-factory baseline
        q1, q3 = np.percentile(history, [25, 75])
        iqr = q3 - q1
        bounds = (q1 - 3*iqr, q3 + 3*iqr)
    else:
        # Fallback global default per metric
        bounds = GLOBAL_BOUNDS[metric]
    return [v for v in values if not (bounds[0] <= v <= bounds[1])]


GLOBAL_BOUNDS = {
    "avg_order_amount":  (1.0, 2000.0),       # 人均消费 ¥
    "gross_margin_pct":  (-50.0, 95.0),       # 毛利率 %
    "dish_qty":          (0.0, float("inf")), # 菜品销量
    "order_count":       (0.0, float("inf")), # 订单数
    "dish_cost":         (0.0, 500.0),        # 单菜成本 ¥
    "wastage_pct":       (0.0, 50.0),         # 损耗率 %
    "review_score":      (1.0, 5.0),          # 评分
}
```

**API 增强**: 现有 `/restaurant/analytics/*` 端点响应增加 `outlierFlags: { metric: bool }` 字段，FE 据此渲染黄标。

**FE 渲染规则**:
- KPI 卡：异常值用普通颜色但加黄色 ⚠️ 角标 + tooltip "该值高于历史 95% 分位"
- chart：异常点用橙色高亮（不删除数据点，仅 markPoint）
- tooltip 内含 "查看历史分布" 按钮（弹小弹窗，Phase A/B 用 placeholder，Phase C 实现）

**验收标准**:
- BEJ 品均价 ¥46480 显 ⚠️ + tooltip "该值高于历史 P99，可能为异常上传"
- 其他正常工厂 KPI 不受影响（IQR baseline 工作）
- 新工厂（< 30 天历史）使用 global fallback 不会误判

---

### 3.2 B-2: LLM 字段识别管道 (Hardcoded → LLM + 半异步)

**新文件**:
- `backend/python/smartbi/services/restaurant/field_classifier.py` (~250 行) — 主管道
- `backend/python/smartbi/services/restaurant/llm_field_prompt.py` (~120 行) — Prompt 构造
- `backend/python/smartbi/services/restaurant/store_name_normalizer.py` (~80 行) — mirror dish_name_normalizer

**修改文件**:
- `backend/python/smartbi/api/excel_async.py` 或上传处理入口 — 集成 field_classifier + 5s budget timeout
- 现有 `entity_resolution_labels` 表无需 schema 变化

**主管道流程**:

```python
async def classify_columns(factory_id: str, columns: list[str]) -> dict[str, ClassificationResult]:
    results: dict[str, ClassificationResult] = {}
    miss: list[str] = []

    # 第 1 道：hardcoded normalizer (含 store_name_normalizer / dish_name_normalizer / etc.)
    for col in columns:
        if hit := hardcoded_normalize(col):
            results[col] = ClassificationResult(canonical=hit, source="rule", confidence=1.0)
            continue
        # 第 2 道：labels cache lookup (历史 admin 标过的 = 高 confidence)
        if cached := await labels_cache_lookup(factory_id, col):
            results[col] = ClassificationResult(canonical=cached, source="cache", confidence=1.0)
            continue
        miss.append(col)

    if not miss:
        return results

    # 第 3 道：LLM with 5s budget
    try:
        llm_results = await asyncio.wait_for(
            classify_with_llm_few_shot(factory_id, miss),
            timeout=5.0,
        )
        for col, classified in llm_results.items():
            results[col] = classified
            # 写 admin queue 待人工确认 (低 confidence)
            await enqueue_admin_queue(factory_id, col, classified, source="llm")
    except asyncio.TimeoutError:
        # 超时把剩余列丢 admin queue 标 "处理中"
        for col in miss:
            await enqueue_admin_queue(factory_id, col, suggested=None, source="llm_pending")
            results[col] = ClassificationResult(canonical=None, source="pending", confidence=0.0)

    return results
```

**LLM Prompt 模板** (in-context learning):

```
你是餐饮数据列名分类器. 给定一个 Excel 列名, 判断它最可能对应的 canonical 字段.

候选 canonical 字段 (从 schema 注册表读):
- order_time, order_amount, dish_name, dish_qty, store_name,
  customer_count, table_number, server_name, payment_method, ...

历史样本 (该工厂 admin 已确认, 取最近 20 条):
- "营业日" → order_time
- "门店编号" → store_name
- "菜品类目" → dish_category
- "桌台号" → table_number

请分类: "{raw_column_name}"
返回纯 JSON (无其他文字):
{ "canonical": "<canonical_field_id>", "confidence": <0-1>, "reasoning": "<short>" }
```

**Few-shot 样本来源**: `entity_resolution_labels WHERE factory_id=X AND source='admin' ORDER BY created_at DESC LIMIT 20`. 新工厂没历史就用全局 admin 标的高 confidence 样本（取 source='admin' AND confidence>=0.9 LIMIT 20）。

**LLM 模型**: `qwen3.5-plus` (准确度) — 项目已有 DashScope 集成，从 `.env.prod` 读 `DASHSCOPE_API_KEY` 已配置。

**验收标准**:
- 上传含 "经营点" 列的 Excel：hardcoded miss → LLM 5s 内返 "建议: store_name, confidence 0.85"
- 该建议进 admin queue，admin 确认后下次同工厂同列名直接 cache 命中（不调 LLM）
- 超时分支：模拟 LLM 慢，5s 后用户看到部分识别结果 + admin queue 显 "LLM 处理中" tag
- LLM 调用失败（API down）：fallback 到 admin queue 标 "处理中"，不阻塞上传

---

### 3.3 B-3: DashboardRestaurant 信息密度

**修改文件**:
- `web-admin/src/components/dashboard/DashboardRestaurant.vue` — 从 234 行扩到 ~450 行
- `backend/python/smartbi/api/restaurant_dashboard.py` — 新增 ~150 行

**新 layout**:

```
┌─────────────────────────────────────────────────────────────┐
│  4 stat 卡 (现有): 今日领料 / 待审批 / 本月损耗 / 最近盘点   │
├─────────────────────────────────────────────────────────────┤
│  4 stat 卡 (新): 7天平均日营收 / 7天总订单数 /                │
│                  本周新菜品 / 本月异常预警数                  │
├─────────────────────────────────────────────────────────────┤
│  最近上传 Excel 摘要 (最近 1 个月新文件, 最多 3 条)            │
│   📄 营业日报-2026-04.xlsx (3 天前)                         │
│      识别 41 道菜 / Top 3: 牛肉面 / 招牌饭 / ...               │
│      异常 2 条 → [去 admin queue 处理]                        │
├─────────────────────────────────────────────────────────────┤
│  本周 Top 5 菜品 (mini bar chart)  │  本月异常预警 (list)    │
│  招牌牛肉面  ¥3,500              │  ⚠️ 损耗率超 20%          │
│  萝卜牛腩煲  ¥2,800              │  ⚠️ 1 道菜亏损             │
│  ...                              │  ⚠️ 字段未识别 3 个       │
├─────────────────────────────────────────────────────────────┤
│  💡 AI 推荐查询 (3 个一键问题)                                 │
│  [哪道菜亏损最严重?] [本周营收异常吗?] [损耗率谁最高?]        │
│  (点击 → 跳 SmartBI AI 问答页 + 自动 prefill 问题)            │
├─────────────────────────────────────────────────────────────┤
│  快捷操作 (现有 7 个)                                          │
└─────────────────────────────────────────────────────────────┘
```

**API 契约**:

```
GET /api/mobile/{factoryId}/restaurant/dashboard/summary
  Response 200: {
    rolling7d: {
      avgDailyRevenue: number,
      totalOrders: number,
      newDishesAdded: number,
      anomalyCount: number
    },
    recentUploads: [
      {
        uploadId, fileName, uploadedAt,
        dishCount, topDishes: ["牛肉面", "萝卜煲"],
        anomalyCount,
        adminQueueLink: "/restaurant/admin/field-queue?uploadId=X"
      },
      // 最多 3 条
    ],
    weeklyTopDishes: [{ dishName, revenue, qty }],
    monthlyAnomalies: [{ type, message, severity, link }],
    aiSuggestedQueries: [
      { question: "哪道菜亏损最严重?", intent: "loss_analysis" }
    ]
  }
```

**`aiSuggestedQueries` 生成规则** (Phase A/B 用 hardcoded rule，Phase C 接 LLM):

| 触发条件 | 推荐问题 |
|---|---|
| 工厂有亏损菜品（毛利率 < 0） | 哪道菜亏损最严重? |
| 本月异常预警 > 5 | 本月预警都是哪些类型? |
| 损耗率 > 10% | 损耗率谁最高? |
| 无配方覆盖菜品 > 50% | 我应该先给哪些菜配配方? |
| 近 7 天营收同比下降 > 20% | 本周营收为何下降? |
| 新工厂（无历史） | 我应该上传哪些数据? |

每次最多返 3 条，按上面优先级。

**点击行为**: AI 推荐查询按钮 → `router.push({ name: 'AIQuery', query: { q: question, intent: intent } })` → SmartBI AI 问答页接收 `route.query.q` 自动填问题。

**验收标准**:
- 新工厂登录看到 dashboard 不再全 0：上传过 Excel 的工厂在 "最近上传摘要" 卡看到关键发现
- AI 推荐查询点击后跳到 SmartBI AI 问答页 + 自动填问题
- 信息密度从 4 数字 → ~15 数字 + 1 mini chart + 3 AI 入口
- 真窗 verify F002 / R_BEJ / qhj_prod 各登录验证一遍

---

## 4. 数据流图

```
┌─────────────────────────────────────────────────────────────────────────┐
│                       用户上传 Excel (餐饮)                              │
└──────────────────────────┬──────────────────────────────────────────────┘
                           ↓
        ┌─────────────────────────────────────┐
        │  excel_async.py 解析 sheets         │
        │  + field_classifier 识别列名 (B-2)  │
        │     1. hardcoded normalizer         │
        │     2. labels_cache lookup          │
        │     3. LLM (5s budget)              │
        │  miss → admin queue (A-3 入)        │
        └──────────────────────────┬──────────┘
                                   ↓
        ┌─────────────────────────────────────┐
        │  smart_bi_pg_excel_uploads 入库      │
        │  + outlier service (B-1) 标记异常    │
        └──────────────────────────┬──────────┘
                                   ↓
        ┌─────────────────────────────────────┐
        │  cron daily 03:00 (A-1)             │
        │  restaurant_ops_etl.trigger_for_factory │
        │     bronze (uploads) → silver (fact/dim) │
        │     → gold (agg_restaurant_daily_ops)    │
        └──────────────────────────┬──────────┘
                                   ↓
        ┌────────────────────┬─────────────────────┬────────────────────┐
        │ /restaurant/data-  │ /restaurant/        │ DashboardRestaurant│
        │ completeness (A-2) │ analytics/* (现有)  │ (B-3)              │
        │ 6 模块覆盖率        │ 6 个分析页 + outlier │ 4+4 stat + AI      │
        │                    │ 黄标 (B-1)          │ 推荐查询           │
        └────────────────────┴─────────────────────┴────────────────────┘
                                   ↓
                           用户看到"数据准确 + 引导清晰"

┌─────────────────────────────────────────────────────────────────────────┐
│              admin 在 admin queue (A-3) 标 LLM 建议                      │
│              → 写 entity_resolution_labels 表                           │
│              → 下次同工厂同列名直接 cache 命中 (自学习闭环)              │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 5. 测试策略

### 5.1 vitest (FE 单元)

- A-2 `data-completeness.vue` — 6 模块渲染 + missingHints 显示 + coverage 进度条颜色规则
- A-3 `field-queue.vue` — in-place 映射弹窗 + 4-eye gate (submitter !== current user) + 单 admin 降级 banner
- A-3 `field-queue.vue` — 批量映射 + history tab
- B-1 `restaurant-outlier.ts` util — IQR 计算 + global fallback + edge cases
- B-3 `DashboardRestaurant.vue` — 各 widget 渲染 + AI 推荐 query 点击跳转

### 5.2 pytest (BE 单元)

- A-1 `restaurant_etl_admin` — trigger 端点 4 个测试 (RBAC + valid + invalid factoryId + 状态查询)
- A-3 `entity_resolution_admin` — 4-eye 拒绝 submitter self-resolve (403 + 中文提示)
- A-3 batch resolve — 多 ID 一次性 resolve + label 表写入 + 单 admin 降级
- B-1 `outlier service` — IQR 历史足 / 不足 fallback global / metric 边界 / 新工厂 fallback
- B-2 `field_classifier` — hardcoded 命中 / labels cache 命中 / LLM 5s budget 超时降级 / LLM 成功写 admin queue / LLM API down fallback

### 5.3 Java mvn (新 controller 时)

- 若 admin queue 4-eye 字段需要 Java 端 migration：mvn test 验 entity 字段 + repository

### 5.4 Playwright smoke E2E

新增到现有 `data-fabric-c-smoke-e2e.spec.ts` OR 新文件 `restaurant-phase-ab-smoke.spec.ts`:

- A-2 `/restaurant/data-completeness` — F002 登录后 6 模块卡片显示 + 至少 1 模块有数据
- A-3 admin queue — 模拟 LLM 建议入 queue → admin 确认 → labels 表 entry → 重新分析
- B-1 BEJ 品均价 outlier — 黄标 + tooltip
- B-2 上传含未识别列 → admin queue 出现 LLM 建议
- B-3 餐饮 dashboard — 信息密度从 4 数字 → 多元素

### 5.5 真窗 verify (deploy 后必须)

- F002 / R_BEJ / qhj_prod 各登录验证一遍 dashboard 不再 0 骨架
- BEJ 上传 1081 行营业数据 → 门店列识别（admin queue confirm 后）→ 门店数 ≠ 0 → 门店 Top 5 chart 出数据

---

## 6. 风险 + 缓解

| 风险 | 概率 | 影响 | 缓解 |
|---|---|---|---|
| ETL 跑很久卡 prod | 中 | 高 | cron 03:00 低峰 + 单工厂 timeout 5min + 失败不阻塞其他工厂 |
| LLM 调用慢/挂 | 中 | 中 | 5s budget + 异步降级到 admin queue + LLM 失败不阻塞上传 |
| LLM 误判（同字段多上下文） | 高 | 中 | LLM 结果默认 confidence < 1 → 必须 admin 确认才入 labels cache，不直接 production-trust |
| admin queue 对小工厂没人 approve | 中 | 低 | 4-eye 软规则：单 admin 工厂自动降级到 1-eye + 标 "未审核确认" |
| 现有 hardcoded normalizer 覆盖率不足致 LLM 调用爆量 | 低 | 中 | 部署后监控 LLM 调用频率，>30% miss 率说明 hardcoded 库需扩展 |
| 6 模块 stat SQL 慢 | 低 | 中 | 完整度页 SQL 全是 `count(*)`，应该 <100ms / 模块；加 5 分钟 cache 兜底 |
| `aiSuggestedQueries` 推荐质量差 | 中 | 低 | Phase A/B 用 hardcoded rule，Phase C 接 LLM |
| `entity_resolution_admin_queue` 现有 schema 缺 4-eye 字段 | 中 | 中 | 第 1 周先 verify schema，缺则 migration 加 `submitter` / `submitter_role` 列 |

---

## 7. 实施时间表

| 周 | 任务 | 可验证 milestone | 交付 |
|---|---|---|---|
| **W1** | A-1 ETL trigger + cron + admin status page | F001 + 餐饮工厂跑完 cron 后 `agg_restaurant_*` ≥ 0 行；admin 页能看每工厂 last run | 1 commit batch + deploy test |
| **W1.5-2** | A-2 餐饮完整度页 6 模块 (BE + FE) | F002 登录看到 6 模块卡，至少 1 模块有真数据 | 1 commit batch + deploy test |
| **W2-2.5** | A-3 admin queue 完整版 (in-place + 批量 + history + 4-eye) | 模拟 LLM 建议入 queue → admin 确认 → labels 写入；submitter self-resolve 4-eye 拒；批量 5 row 一次性 | 1 commit batch + deploy test |
| **W3** | B-1 outlier (BE service + FE util + 集成 6 餐饮 view) | BEJ 品均价 ¥46480 显黄 ⚠️；正常工厂 KPI 不受影响 | 1 commit batch + deploy test |
| **W3-4** | B-2 LLM field_classifier + store_name_normalizer + 半异步 5s budget | 上传含 "经营点" 列 → LLM 建议 → admin queue → 确认后 labels cache 命中；超时 fallback admin queue | 1 commit batch + deploy test |
| **W4** | B-3 DashboardRestaurant 信息密度 (4+4 stat + 4 摘要卡 + AI 推荐) | 餐饮工厂登录看到 ~15 数字 + mini chart + 3 AI 入口；新工厂登录非全 0 | 1 commit batch + deploy test |

每周末交付：1 个 commit batch + 1 次 deploy test → real-window verify → push origin。

**跨周依赖**:
- W1 必须先做（不跑 ETL，W1.5+ 所有改动看不到效果）
- A-3 admin queue (W2-2.5) 和 B-2 LLM (W3-4) 双向依赖：B-2 LLM miss 写 queue，A-3 用户 resolve 写 labels；建议 A-3 W2.5 ship 后立即进 W3-4 B-2，无缝衔接
- B-3 Dashboard (W4) 依赖 W1 ETL 跑完才有 7 天滚动数据可显

**风险缓冲**: 留 0.5-1 周 buffer 处理：LLM prompt 调优、ETL 真客户兼容、admin queue 4-eye 单 admin 降级体验。

---

## 8. Phase C 路标 (placeholder, Month 2)

| 项 | 简述 |
|---|---|
| 多租户性能 | ETL cron 跨数十工厂的并发调度 / 单工厂 ETL 失败不阻塞其他 |
| ETL 增量 | 上传 hash 增量同步（不重跑历史 fact 表） |
| 历史数据 cleanup migration | DB 中已有的 cost 负值、outlier 数据清洗 + Bug A 写入层根治 |
| 离线 retrain ML model | (B-2) (C) 升级 — 收集 admin 标签样本，weekly retrain `field_classifier_model` |
| CapabilityGate 502 修 | 当前 fallback 工作但 console 满屏 error，技术债 |
| outlier config 化 | (B-1) (γ) 升级 — `restaurant_outlier_config` 表 + admin override UI |
| 监控告警 | ETL 失败 / LLM 调用失败率 / 异常字段数阈值告警 → 飞书或邮件 |
| 餐饮 dashboard 编辑器 | (B-3) (γ) — 用户可拖拽自定义 widget |

---

## 9. 验收标准 (Phase A+B 整体)

完成后：

- [ ] F002 / R_BEJ / qhj_prod 登录后 dashboard 信息密度 ≥ 15 数据点 + mini chart + AI 推荐入口
- [ ] BEJ 1081 行营业数据 → 门店列识别 → 门店 Top 5 chart 不再空骨架
- [ ] BEJ 品均价 ¥46480 显 outlier ⚠️ 标记
- [ ] 上传含罕见列名 Excel → admin queue 出现 LLM 建议 → admin 确认 → 重新分析
- [ ] /restaurant/data-completeness 6 模块各自正确反映工厂数据状态
- [ ] cron 跑完后 `agg_restaurant_*` `fact_pos_item` 非 0 (有数据工厂)
- [ ] 真窗 smoke E2E 在新加 5+ 个 test 全 PASS
- [ ] vitest + pytest + Java mvn 测试基线不退（≥ 当前 107 个测试 + 新加的）

---

## 10. 后续行动

设计 approved 后:

1. 用 `superpowers:writing-plans` skill 转 implementation plan (按 W1-W4 分批，每周末 commit + deploy)
2. W1 启动 — 先 verify `entity_resolution_admin_queue` 现有 schema (检查是否有 submitter 字段)，决定是否加 migration
3. 实施过程中如发现新风险或 scope 变化，更新本 spec 并加版本号 v2

---

**作者**: Claude Opus 4.7 (1M context) + Steve
**审阅状态**: 待评审
