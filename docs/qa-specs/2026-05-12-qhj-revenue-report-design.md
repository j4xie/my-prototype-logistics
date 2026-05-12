# 青花椒 收入管理报表 设计文档

| 元数据 | 值 |
|---|---|
| 状态 | DRAFT — 待 Steve review |
| 日期 | 2026-05-12 |
| 客户 | 青花椒（含青花椒砂锅鱼、鲜行者等子品牌）|
| factory_id | `R_QINGHUAJIAO_REAL` (per `V20260511_01__onboard_14_r_real_chains.sql` + `V20260511_02__t6_6_etl_seed_14_real_chains.sql`) |
| 数据源 | 二维火 POS 系统导出（CSV / zip）|
| 模板规格 | 客户提供的 `收入管理报表.xlsx`（4 sheet section，3 类表头）|
| 数据样本 | `smartbi维度分析/大众点评/真实餐饮连锁数据/青花椒/` + `青花椒25年/` |
| 设计层级 | brainstorming → spec → writing-plans（本文档是 spec 阶段产出）|

---

## 1. 背景与目标

### 1.1 客户原始要求

客户的 `收入管理报表.xlsx` 模板含 **3 类表头**：
1. 可比同比 / 环比表（多门店一行一店，按堂食/外卖切分）
2. 堂食外卖占比表
3. 客单人数分析表（单店单期分布）

客户希望"上传任意格式 POS 数据 → 转出符合此模板表头的报表"。客户实际数据源是二维火 POS（5+ 个原始报表 zip）。

### 1.2 不做"通用表头转换"的理由

"任意表头 → 任意模板"是 LLM 级别的字段语义匹配问题，准确率不稳，且客户实际只用二维火一个 POS。本 spec 采用 **定向 ETL** 方案：固定二维火源 → 固定收入管理报表模板。未来其他 POS（客如云 / 美团 / 哗啦啦）按需各加一套 mapping 即可。

### 1.3 长期定位

- 本 feature 是 SmartBI 模块的一个**通用** sub-menu 实现（`R_*_REAL` 工厂均可启用），首期文案指向青花椒
- Bronze 解析 / Silver 写入 / Gold 聚合 / 模板计算 / Excel renderer **全 Python**（Phase 2A 已迁完 SmartBI analysis 到 Python，本 feature 沿主线）
- AI Chat Tool 层留 Java（`project_apr30_tool_skill_stays_java`），新 `RevenueReportGenerateTool` 是 thin HTTP wrapper

---

## 2. 范围

### IN SCOPE（本 spec）

- Bronze 文件路由（filename + header 嗅探）
- 二维火 POS 6 个核心报表的 Silver 写入
- 新 Gold 聚合表 `agg_daily_order_type_meal`
- `qhj_revenue_report` 计算模板（4 个数据 block）
- 纯代码构建的 openpyxl xlsx renderer
- 流式 + Redis 智能缓存 API（6 个端点）
- Java `RevenueReportGenerateTool` + intent 配置
- Vue 单页面（SmartBI 子菜单 + AI Chat 双入口）
- 错误处理 / 测试策略 / 部署 / 监控 / rollout

### OUT OF SCOPE（Phase 2 候选）

- **同比对照（2024 同期数据）**— 数据缺口，首期 4 列留空 + UI 提示"需要 2024 数据"
- **工厂 ID 级 allowlist 菜单门控**— 项目现仅 type 级 (`hideForFactoryTypes`)，首期用类型粗筛
- **streaming progress / WebSocket 进度推送**— 客户面长任务的 UX 优化
- **多语言 i18n**— 项目未启用 vue-i18n
- **跨 POS 源支持**— 客如云 / 美团 / 哗啦啦
- **保存报表参数预设**— phase 2 加"保存为预设"按钮
- **前端遥测**— Sentry / analytics 事件
- **OSS / R2 离线存储**— 流式直返天然不需要

### Sunset 候选（独立 chat 处理 — 不在本 spec）

- `DynamicAnalysisServiceImpl.java`（orphaned，100% Java compute）
- `SmartBIServiceImpl.java` intent dispatch（95% legacy，需 P5.7 重构）
- `SmartBIUploadFlowServiceImpl.java` PostgreSQL dual-write

---

## 3. 关键决策记录（来源：brainstorming Q&A）

| Q | 决策 |
|---|---|
| Q1 同比 2024 数据 | 首期跳过，4 列留空 + UI 标注 |
| Q2 上传形式 | zip / xlsx / xls / csv 任一，N 个文件齐丢，后端按 filename + header 路由 |
| Q3 Block 4 多店 | 选的所有门店 × 选的期间，每店一个客单分析表（堆叠输出）|
| Q4 输出形态 | Vue 页面预览 + xlsx 下载并行 |
| Q5 功能入口 | SmartBI 子菜单 + AI Chat（LLM 通过 intent 触发）|
| Q6 LLM 数据来源 | 两者都支持：无附件查 Silver，有附件先上传再生成；首期实现"无附件 = 查 Silver" 路径，"有附件"留 phase 2 |
| Q6 多租户 | 实现通用，首期仅 R_QINGHUAJIAO_REAL 可见（通过 `hideForFactoryTypes: ['FACTORY']` 粗筛 RESTAURANT 类）|
| - "实际人均" 语义 | 双输出 — `revenue_per_diner` (实收/客流) + `revenue_per_item` (实收/份数) |
| - 缓存策略 | 智能缓存：cache_key 嵌 `gold_max_computed_at`，Gold 物化变了自然 miss；Redis TTL 24h + allkeys-LRU |

---

## 4. 架构总览

### 4.1 模块边界

```
[ Web-Admin Vue ]                              [ AI Chat (Java) ]
  views/smart-bi/RevenueReport.vue               IntentExecutor
       ↓ POST /smartbi-api/...                     ↓ tool_name=revenue_report_generate
       ↓                                            RevenueReportGenerateTool (Java thin wrapper)
       ↓                                              ↓ pythonClient.callRevenueReport(...)
       └──────────────────────────────────────────► Python smartbi 8083
                                                       ↓
       ┌──── /api/smartbi/{factory_id}/revenue-report ────┐
       │                                                    │
       │ /upload     ─►  pos_router → existing Silver       │
       │                  writers (复用 bill_flow /          │
       │                  product_summary) + 3 个新 writer   │
       │                                                    │
       │ /prepare    ─►  Gold materialization check         │
       │ /generate       compute_qhj_revenue_report()       │
       │ /download/{key} render xlsx (openpyxl, in-memory)  │
       │                  StreamingResponse / Redis cache   │
       │                                                    │
       │ /stores     ─►  dim_store query (fuzzy resolver)   │
       │ /audit-log  ─►  smart_bi_report_audit_log table    │
       └────────────────────────────────────────────────────┘
```

### 4.2 文件清单

**Python 端**（业务逻辑全在这）：

| 路径 | 状态 | 说明 |
|---|---|---|
| `backend/python/smartbi/ingestion/pos_router.py` | 新建 | filename + header 嗅探 → writer 派发 |
| `backend/python/smartbi/ingestion/_zip_handler.py` | 新建 | zip 递归解压 |
| `backend/python/smartbi/ingestion/_filename_stripper.py` | 新建 | 剥 `\d{17}_[a-f0-9]+_` 前缀 |
| `backend/python/smartbi/knowledge/restaurant/pos/report_registry.yaml` | 新建 | 中文 keyword → writer name |
| `backend/python/smartbi/knowledge/restaurant/pos/field_aliases.yaml` | 改 | `2dfire:` 块补 5 字段 |
| `backend/python/smartbi/canonical/silver_writers/daily_summary_writer.py` | 新建 | 营业概况报表 |
| `backend/python/smartbi/canonical/silver_writers/meal_split_writer.py` | 新建 | 堂食外卖占比表 |
| `backend/python/smartbi/canonical/silver_writers/region_summary_writer.py` | 新建 | 区域销售报表 |
| `backend/python/smartbi/canonical/silver_writers/bill_flow_writer.py` | **复用** | 详细日报表 / 订单付款方式 |
| `backend/python/smartbi/canonical/silver_writers/product_summary_writer.py` | **复用** | 商品销售明细表 |
| `backend/python/smartbi/canonical/dim_resolver.py` | 改 | `resolve_store()` 加 `.strip()` 防尾空格 |
| `backend/python/smartbi/canonical/templates/qhj_revenue_report.py` | 新建 | 4 block 计算 |
| `backend/python/smartbi/services/excel_renderers/qhj_revenue_v1.py` | 新建 | 纯代码构建 openpyxl |
| `backend/python/smartbi/services/excel_renderers/_metrics.py` | 新建 | Prometheus 指标 |
| `backend/python/smartbi/services/materialized_analytics/hooks.py` | 改 | 注册 `materialize_daily_order_type_meal` trigger |
| `backend/python/smartbi/services/materialized_analytics/materializer.py` | 改 | 加 `materialize_daily_order_type_meal()` 函数 |
| `backend/python/smartbi/api/revenue_report.py` | 新建 | 6 个端点 |
| `backend/python/smartbi/api/excel_async.py` | 改 | `pd.read_csv` 加 `encoding="utf-8-sig"` + `engine="python"` |
| `backend/python/smartbi/main.py` | 改 | CORS `expose_headers` 加 3 个 X-* 头 + 注册新 router |
| `backend/python/smartbi/database/migrations/V20260513_01__qhj_revenue_silver_gold.sql` | 新建 | meal_period 列 + agg_daily_order_type_meal 表 + 索引 |
| `backend/python/smartbi/database/migrations/V20260513_02__upload_dedup.sql` | 新建 | content_hash 列 + UNIQUE |
| `backend/python/smartbi/database/migrations/V20260513_03__report_audit_log.sql` | 新建 | smart_bi_report_audit_log 表 |
| `scripts/backfill_agg_order_type_meal.py` | 新建 | 历史回填 |

**Java 端**（thin Tool wrapper）：

| 路径 | 状态 | 说明 |
|---|---|---|
| `backend/java/cretas-api/src/main/java/com/cretas/aims/ai/tool/impl/restaurant/RevenueReportGenerateTool.java` | 新建 | mirror `FinancialChartGenerateTool` |
| `backend/java/cretas-api/src/main/java/com/cretas/aims/ai/tool/impl/restaurant/MealPeriodNormalizer.java` | 新建 | "下午茶"→"午市" 等 enum |
| `backend/java/cretas-api/src/main/java/com/cretas/aims/client/PythonSmartBIClient.java` | 改 | 加 `callRevenueReport()` 方法 |
| `backend/java/cretas-api/src/main/resources/db/flyway/V20260513_01__revenue_report_intent.sql` | 新建 | 1 行 `INSERT INTO ai_intent_configs`（首次 `is_active=false`）|

**Vue 前端**：

| 路径 | 状态 | 说明 |
|---|---|---|
| `web-admin/src/views/smart-bi/RevenueReport.vue` | 新建 | 单 SFC ~1200 LOC |
| `web-admin/src/components/smartbi/MultiFileUploadArea.vue` | 新建 | 可复用多文件上传组件 |
| `web-admin/src/components/smartbi/SmartBIUploader.vue` | 改 | 加 `multiple` prop |
| `web-admin/src/api/smartbi/revenue-report.ts` | 新建 | API client |
| `web-admin/src/router/modules/smartbi.ts` | 改 | 加路由 |
| `web-admin/src/components/layout/AppSidebar.vue` | 改 | 加菜单（`hideForFactoryTypes: ['FACTORY']`）|

---

## 5. Bronze 路由 + 字段 Alias

### 5.1 路由决策树

```
upload file(s)
  ↓
① 剥前缀 (`20260422101444628_8e07f831c81_` → "")
  ↓
② 若 .zip → 递归解压，inner files 走 ①③④
  ↓
③ report_registry.yaml 中文 keyword 匹配:
   "营业概况报表"      → daily_summary_writer
   "堂食外卖占比表"    → meal_split_writer
   "区域销售报表"      → region_summary_writer
   "详细日报表"        → bill_flow_writer (复用)
   "订单付款方式"      → bill_flow_writer (复用)
   "商品销售明细表"    → product_summary_writer (复用)
   未匹配 → ④
  ↓
④ ShapeDetector 二级确认 (confidence ≥ 0.85)
   BILL_FLOW / PRODUCT_SUMMARY → 对应 writer
   不识别 → HTTP 400 + preview headers，让用户人工指定
```

**filename 路由优先于 header 嗅探**：二维火导出名都含固定中文标识，比 header 列名分布稳。

### 5.2 字段 alias 补丁

仅改 Python `field_aliases.yaml` 的 `2dfire:` 块（不动 Java `FieldMappingDictionary`，已审计确认作用域不同）：

```yaml
2dfire:
  brand_name: "二维火"
  field_mappings:
    # ...保留既有 16 条...
    order_type:        ["订单类型", "堂食/外卖"]
    meal_period:       ["班次", "市段", "午晚市"]
    revenue_ratio:     ["营业额占比", "营业额占比(%)"]
    avg_order_spend:   ["单均消费"]
    avg_diner_spend:   ["人均消费"]
    store_name:        ["门店名称", "店铺名称"]
```

### 5.3 dim_store 名规范化

`resolve_store(name)` 入口处 `name.strip()`，**`（闭店）` 前缀保留**（业务数据，闭店仍是历史来源，UI 端可灰显或过滤）。

### 5.4 上传去重

`smart_bi_pg_excel_uploads.content_hash`（sha256 文件字节）+ UNIQUE `(factory_id, content_hash)`。重传返 409 + 现有 upload_id。

### 5.5 meal_period 归一化责任链

二维火 CSV `班次` 列原始值可能为 `"午市"` / `"晚市"` / `"早餐"` / `"下午茶"` / 空。归一化在**三个不同入口**各自处理：

| 入口 | 归一化方 | 行为 |
|---|---|---|
| **CSV → Silver writer**（bill_flow / daily_summary / meal_split / region_summary writer 入口）| writer 内置 `.strip()` 仅 | 不做语义映射，原值入库（DB 接受 `早餐/午餐/下午茶/晚餐/其他/午市/晚市`，CHECK constraint 兜底）|
| **Vue 表单 → /prepare**（Web UI 入口）| 不需要归一化 | 表单 `el-checkbox` 仅暴露 `["午市", "晚市"]`，用户只能选这两个 |
| **LLM NL → Java Tool → /prepare**（AI Chat 入口）| Java `MealPeriodNormalizer.normalize()` | `"下午茶"→"午市"`, `"夜宵"→"晚市"`, `"早餐"→"早餐"`（透传 enum-defined 值，其他抛 IllegalArgumentException）|
| **/prepare API 入参** | 无 — 信任 caller 已归一 | Python 直接 `WHERE TRIM(meal_period) = ANY($5)` 查询；不在 Python 再做映射 |

**关键约束**：Vue 表单**不**让用户输入 "下午茶" 等自由文本；LLM 通过 Java Tool 路径自动归一。Python 层是被动的查询消费方。

### 5.6 `_resolve_store_ids` Python fuzzy 候选返回格式

当 fuzzy 匹配返 N>1，HTTP 400 body 形如：

```json
{
  "success": false,
  "message": "门店名 '颛桥' 匹配多个，请使用完整名",
  "data": {
    "ambiguous_name": "颛桥",
    "candidates": [
      {"store_id": 123, "name": "青花椒颛桥龙湖店"},
      {"store_id": 456, "name": "青花椒颛桥万达店"}
    ]
  }
}
```

Vue UI 处理（Section 9.x）：弹 ElMessageBox.confirm 列出候选名，用户点击其中一个，前端用完整名重新调 /prepare。AI Chat 路径：Tool 把候选列表回给 LLM，LLM 生成 "请确认是哪个门店：1. xxx 2. yyy" 类对话续问。

---

## 6. 模板计算层

### 6.1 入参

```python
@dataclass
class RevenueReportParams:
    factory_id: str
    store_ids: list[int]                       # 空 = 全门店
    date_from: date
    date_to: date
    meal_periods: list[str] | None = None      # ["午市","晚市"]; None=全
    include_yoy: bool = False                  # 首期固定 False
```

### 6.2 入口

```python
async def compute_qhj_revenue_report(pool, params) -> TemplateResult:
    # 依赖 tenant_ctx.set_factory_id() 调用方已设置
    # 不要 SET LOCAL — 项目用 set_config(..., false) session-scoped pool setup
    
    block4_sem = asyncio.Semaphore(3)  # pool max_size=5, 留 2 给 Block 1/2/3
    
    async with pool.acquire() as conn:
        block1, block2, block3, block4 = await asyncio.gather(
            _compute_block1_yoy(conn, params),
            _compute_block2_mom(conn, params),
            _compute_block3_meal_split(conn, params),
            _compute_block4_diner_dist(pool, params, block4_sem),
        )
    return TemplateResult(code="qhj_revenue_report", ...)
```

### 6.3 Block 1 / 2 SQL（可比同比 / 环比共享结构）

数据源：**新建** `agg_daily_order_type_meal` Gold 表。`LEFT JOIN dim_store` 保留零订单店。

```sql
WITH selected_stores AS (
  SELECT store_id, name AS store_name
  FROM dim_store
  WHERE factory_id = $1 AND store_id = ANY($2)
),
current_period AS (
  SELECT
    s.store_id, s.store_name,
    COALESCE(SUM(a.actual_receive), 0) AS total,
    COALESCE(SUM(CASE WHEN TRIM(a.order_type) = '堂食'
                      THEN a.actual_receive END), 0) AS dine_in,
    COALESCE(SUM(CASE WHEN TRIM(a.order_type) = '外卖'
                      THEN a.actual_receive END), 0) AS takeout
  FROM selected_stores s
  LEFT JOIN agg_daily_order_type_meal a
    ON a.factory_id = $1 AND a.store_id = s.store_id
   AND a.date BETWEEN $3 AND $4
   AND (CARDINALITY($5::text[]) = 0 OR a.meal_period = ANY($5))
  GROUP BY s.store_id, s.store_name
),
previous_period AS (
  SELECT /* 同结构, date 用 prev_from/prev_to */ ...
)
SELECT
  c.store_name,
  c.total, c.dine_in, c.takeout,
  p.total AS prev_total, p.dine_in AS prev_dine_in, p.takeout AS prev_takeout,
  ROUND((c.total - p.total) * 100.0 / NULLIF(p.total, 0), 2) AS total_ratio,
  ROUND((c.dine_in - p.dine_in) * 100.0 / NULLIF(p.dine_in, 0), 2) AS dine_in_ratio,
  ROUND((c.takeout - p.takeout) * 100.0 / NULLIF(p.takeout, 0), 2) AS takeout_ratio
FROM current_period c LEFT JOIN previous_period p USING (store_id)
ORDER BY c.store_name;
```

**Block 1 同比** (`include_yoy=True`): `prev_date_from = current - 365 days`. 首期 `include_yoy=False`，相关列返 NULL。
**Block 2 环比**: `prev_date_from = current_date_from - (current_date_to - current_date_from)`.

### 6.4 Block 3 SQL（堂食外卖占比）

```sql
SELECT s.store_name,
  SUM(CASE WHEN TRIM(a.order_type)='堂食' THEN a.actual_receive ELSE 0 END) AS dine_in_revenue,
  SUM(CASE WHEN TRIM(a.order_type)='外卖' THEN a.actual_receive ELSE 0 END) AS takeout_revenue,
  SUM(CASE WHEN TRIM(a.order_type)='堂食' THEN a.bill_count ELSE 0 END) AS dine_in_bills,
  SUM(CASE WHEN TRIM(a.order_type)='外卖' THEN a.bill_count ELSE 0 END) AS takeout_bills
FROM /* 同 Block 1 source */ ...
```

Python 派生：`revenue_ratio = dine_in_revenue / (dine_in + takeout)`，`bill_ratio` 同理。

### 6.5 Block 4 SQL（客单人数分析 — 每店一表）

**列名修正**：`fact_pos_item.transaction_id`（不是 `bill_id`），FK 到 `fact_pos_transaction.id`（BIGSERIAL PK）。

```sql
WITH bill_items AS (
  SELECT t.id AS txn_id, t.customer_count, t.actual_receive,
         (SELECT COALESCE(SUM(i.qty), 0)
          FROM fact_pos_item i
          WHERE i.transaction_id = t.id) AS items_per_bill
  FROM fact_pos_transaction t
  WHERE t.factory_id = $1 AND t.store_id = $2
    AND t.date BETWEEN $3 AND $4
    AND t.customer_count IS NOT NULL AND t.customer_count > 0
    AND (CARDINALITY($5::text[]) = 0 OR TRIM(t.meal_period) = ANY($5))
),
totals AS (
  SELECT COUNT(*) AS total_bills, SUM(actual_receive) AS total_revenue
  FROM bill_items
)
SELECT
  bi.customer_count                                          AS diner_count,
  COUNT(*)                                                   AS bill_count,
  ROUND(COUNT(*)::numeric / NULLIF(t.total_bills, 0), 3)     AS bill_ratio,
  SUM(bi.items_per_bill)                                     AS total_items,
  ROUND(SUM(bi.items_per_bill) / NULLIF(COUNT(*), 0), 1)     AS avg_items_per_bill,
  SUM(bi.actual_receive)                                     AS revenue,
  -- 实际人均 v1: 实收 / 客流量 (= 实收 / (人数 × 单数))
  ROUND(SUM(bi.actual_receive) /
        NULLIF(bi.customer_count * COUNT(*), 0), 0)          AS revenue_per_diner,
  -- 实际人均 v2: 实收 / 点单份数
  ROUND(SUM(bi.actual_receive) /
        NULLIF(SUM(bi.items_per_bill), 0), 0)                AS revenue_per_item,
  ROUND(SUM(bi.actual_receive) /
        NULLIF(t.total_revenue, 0), 3)                       AS revenue_ratio
FROM bill_items bi CROSS JOIN totals t
GROUP BY bi.customer_count, t.total_bills, t.total_revenue
ORDER BY bi.customer_count;
```

### 6.6 Schema 变更（V20260513_01）

```sql
-- 1. meal_period 列
ALTER TABLE fact_pos_transaction
  ADD COLUMN meal_period VARCHAR(50);
ALTER TABLE fact_pos_transaction
  ADD CONSTRAINT chk_meal_period
    CHECK (meal_period IS NULL OR meal_period IN
      ('早餐','午餐','下午茶','晚餐','其他','午市','晚市'));

-- 2. 新 Gold 表
CREATE TABLE agg_daily_order_type_meal (
    factory_id VARCHAR(50) NOT NULL,
    date DATE NOT NULL,
    store_id BIGINT NOT NULL,
    order_type VARCHAR(50),
    meal_period VARCHAR(50),
    gross_amount NUMERIC(18,2),
    actual_receive NUMERIC(18,2),
    bill_count INT,
    customer_count INT,
    version BIGINT NOT NULL DEFAULT 1,
    computed_at TIMESTAMP NOT NULL DEFAULT NOW(),
    PRIMARY KEY (factory_id, date, store_id, order_type, meal_period),
    CONSTRAINT fk_agg_daily_omt_store
      FOREIGN KEY (store_id) REFERENCES dim_store(store_id) ON DELETE CASCADE
);
ALTER TABLE agg_daily_order_type_meal ENABLE ROW LEVEL SECURITY;
ALTER TABLE agg_daily_order_type_meal FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON agg_daily_order_type_meal FOR ALL
    USING (factory_id = current_setting('app.factory_id', true))
    WITH CHECK (factory_id = current_setting('app.factory_id', true));

-- 3. 索引
CREATE INDEX idx_agg_daily_omt_factory_date_store_meal
  ON agg_daily_order_type_meal (factory_id, date, store_id, meal_period);
```

### 6.7 物化策略

**源表**：`fact_pos_transaction`（Silver bill 级），不读 `fact_pos_item`。聚合粒度 (factory_id, date, store_id, order_type, meal_period)。

**函数实现**（in `backend/python/smartbi/services/materialized_analytics/materializer.py`）：

```python
_AGG_DAILY_OMT_UPSERT_SQL = """
INSERT INTO agg_daily_order_type_meal AS a (
    factory_id, date, store_id, order_type, meal_period,
    gross_amount, actual_receive, bill_count, customer_count,
    version, computed_at
)
SELECT
    t.factory_id,
    t.date,
    t.store_id,
    COALESCE(TRIM(t.order_type), '未分类') AS order_type,
    COALESCE(TRIM(t.meal_period), '未分类') AS meal_period,
    SUM(COALESCE(t.gross_amount,   0)) AS gross_amount,
    SUM(COALESCE(t.actual_receive, 0)) AS actual_receive,
    COUNT(*)                            AS bill_count,
    SUM(COALESCE(t.customer_count, 0))  AS customer_count,
    1, NOW()
FROM fact_pos_transaction t
WHERE t.factory_id = $1
  AND t.date BETWEEN $2 AND $3
GROUP BY t.factory_id, t.date, t.store_id,
         COALESCE(TRIM(t.order_type), '未分类'),
         COALESCE(TRIM(t.meal_period), '未分类')
ON CONFLICT (factory_id, date, store_id, order_type, meal_period)
DO UPDATE SET
    gross_amount   = EXCLUDED.gross_amount,
    actual_receive = EXCLUDED.actual_receive,
    bill_count     = EXCLUDED.bill_count,
    customer_count = EXCLUDED.customer_count,
    version        = a.version + 1,
    computed_at    = NOW();
"""

async def materialize_daily_order_type_meal(
    conn,
    factory_id: str,
    date_min: date,
    date_max: date,
) -> int:
    """返回受影响行数。upsert + version bump + computed_at 更新（缓存失效信号）。"""
    result = await conn.execute(_AGG_DAILY_OMT_UPSERT_SQL,
                                factory_id, date_min, date_max)
    return int(result.split()[-1])
```

**Trigger 接入**（同 `UploadCompleteTrigger` 现有模式）：
- `materialize_all(factory_id, date_min, date_max)` 内追加一行调用
- 触发时机：post-upload 立即 + daily cron + on-demand (per `ensure_gold_freshness`)

**回填**：`python scripts/backfill_agg_order_type_meal.py --factory R_QINGHUAJIAO_REAL --date-from 2025-01-01 --date-to 2025-12-31`

### 6.8 V20260513_02 — Upload dedup

```sql
-- backend/python/smartbi/database/migrations/V20260513_02__upload_dedup.sql
ALTER TABLE smart_bi_pg_excel_uploads
  ADD COLUMN content_hash VARCHAR(64);

CREATE UNIQUE INDEX uq_upload_factory_hash
  ON smart_bi_pg_excel_uploads (factory_id, content_hash)
  WHERE content_hash IS NOT NULL;

COMMENT ON COLUMN smart_bi_pg_excel_uploads.content_hash IS
  'sha256(file_bytes); UNIQUE per factory; 重传同文件返 409 with existing upload_id';
```

### 6.9 V20260513_03 — 审计日志表

```sql
-- backend/python/smartbi/database/migrations/V20260513_03__report_audit_log.sql
CREATE TABLE smart_bi_report_audit_log (
    id BIGSERIAL PRIMARY KEY,
    factory_id VARCHAR(50) NOT NULL,
    report_type VARCHAR(50) NOT NULL,         -- 'qhj_revenue_v1'
    generated_by VARCHAR(100) NOT NULL,       -- JWT sub / user_id
    generated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    params_snapshot JSONB NOT NULL,           -- 全部入参快照, 用于 cache miss 反查
    params_hash VARCHAR(64) NOT NULL,         -- sha256(params_snapshot)
    cache_key VARCHAR(255),                   -- Redis cache key (for trace)
    cache_hit BOOLEAN NOT NULL DEFAULT FALSE,
    file_size_bytes INT,
    duration_ms INT,
    status VARCHAR(20) NOT NULL,              -- 'ok' / 'error'
    error_message TEXT,
    gold_materialized_at TIMESTAMP            -- 数据新鲜度
);

ALTER TABLE smart_bi_report_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE smart_bi_report_audit_log FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON smart_bi_report_audit_log FOR ALL
    USING (factory_id = current_setting('app.factory_id', true))
    WITH CHECK (factory_id = current_setting('app.factory_id', true));

CREATE INDEX idx_audit_log_factory_generated
  ON smart_bi_report_audit_log (factory_id, generated_at DESC);
CREATE INDEX idx_audit_log_params_hash
  ON smart_bi_report_audit_log (factory_id, params_hash);
```

---

## 7. xlsx Renderer

### 7.1 设计原则

- **纯代码构建** workbook（`openpyxl.Workbook()`），**不**加载模板文件运行时
- **流式 BytesIO 返回**，永不落盘
- 模板视觉规格保留 `docs/qa-specs/_assets/qhj_revenue_v1_template.xlsx` 供人工对照
- 多租户：模板 = Python 模块（不同客户 = 不同 renderer module）
- i18n 准备：labels 通过参数注入，**不**写死中文进源码（首期 zh-CN 内置）

### 7.2 实现框架

```python
# backend/python/smartbi/services/excel_renderers/qhj_revenue_v1.py
from openpyxl import Workbook
from openpyxl.styles import Font, Alignment, Border, Side, PatternFill
from io import BytesIO

RENDERERS = {"qhj_revenue_v1": render}  # 多租户 registry

def render(report_data: dict, labels: dict) -> BytesIO:
    wb = Workbook()
    ws = wb.active
    ws.title = "收入管理报表"
    
    cursor = 3
    cursor = _write_block1(ws, cursor, report_data["block1_yoy"], labels)
    cursor += 2
    cursor = _write_block2(ws, cursor, report_data["block2_mom"], labels)
    cursor += 2
    cursor = _write_block3(ws, cursor, report_data["block3_meal_split"], labels)
    cursor += 2
    cursor = _write_block4(ws, cursor, report_data["block4_diner_dist"], labels)
    
    buf = BytesIO()
    wb.save(buf)
    buf.seek(0)
    return buf
```

每个 `_write_blockN` 通过 `ws.merge_cells()` 程序化定义合并表头 → 写表头行 → 循环写 N 行数据（**门店数无上限**）。

### 7.3 智能缓存

```
cache_key = f"revenue_report:{factory_id}:sha256(params):{gold_max_computed_at}"
```

最后一段是 Gold 物化时间戳。Gold 表 `computed_at` 任何一行变了 → cache_key 变 → 旧 cache 自动 miss。

```python
cached_bytes = await redis_client.get(cache_key)
if cached_bytes:
    return StreamingResponse(BytesIO(cached_bytes), ...)
# else: with_factory_serialization → 生成 → SET ex=24h
```

**Redis 容量管理**：max-memory 8 GB，`allkeys-lru` 策略；TTL 24h。Redis 不可用时不阻塞业务，直接走生成路径（WARN 日志）。

---

## 8. API + LLM Tool 集成

### 8.1 端点（全部 snake_case，HTTP 200 + 中文 message + 项目 envelope `{success, data, message}`）

| 方法 | 路径 | 用途 |
|---|---|---|
| POST | `/api/smartbi/{factory_id}/revenue-report/upload` | 多文件上传 |
| POST | `/api/smartbi/{factory_id}/revenue-report/prepare` | LLM Tool 触发；返元数据 + download_url |
| POST | `/api/smartbi/{factory_id}/revenue-report/generate` | Web UI 流式 xlsx |
| GET  | `/api/smartbi/{factory_id}/revenue-report/download/{cache_key}` | 通过 download_url 下载 |
| GET  | `/api/smartbi/{factory_id}/revenue-report/stores` | 门店选择器列表（exclude_closed 可选）|
| GET  | `/api/smartbi/{factory_id}/revenue-report/audit-log` | 最近生成记录 |

**CORS expose headers**（Section 6 必修）：FastAPI CORS middleware `expose_headers=["X-Cache-Hit","X-Gold-Materialized-At","X-Store-Count"]`。

### 8.2 `/upload` 锁粒度

**不**用 `with_factory_serialization` 包整个 multi-file 流（避免 200MB byte stream 锁 N 分钟）。仅锁 writer-write 阶段。Mirror 现有 `excel_async` 无锁 byte streaming 模式。

```python
async def upload_pos_files(factory_id, files, request, pool):
    _check_factory(factory_id, request)
    batch_id = uuid.uuid4()
    results = []
    
    # ① bytes streaming 阶段 - 无锁,可并发
    for upload_file in files:
        content = await upload_file.read()                    # 大字节流不持锁
        content_hash = hashlib.sha256(content).hexdigest()
        if await _exists_by_hash(factory_id, content_hash):
            results.append({"filename": upload_file.filename, "status": "duplicate"})
            continue
        
        # ② parse 阶段 - 仍无锁
        try:
            parsed = await pos_router.parse(filename=upload_file.filename, content=content)
        except UnknownReportTypeError as e:
            results.append({"filename": upload_file.filename, "status": "unknown",
                            "preview_headers": e.preview_headers})
            continue
        
        # ③ writer-write 阶段 - 仅此 critical section 持 per-factory 锁
        async def _persist():
            async with pool.acquire() as conn:
                await _set_factory_ctx(conn, factory_id)
                await parsed.writer.write(conn, factory_id, batch_id, parsed)
                await _record_upload(conn, factory_id, batch_id,
                                     upload_file.filename, content_hash)
        
        await with_factory_serialization(factory_id, pool, _persist)
        results.append({"filename": upload_file.filename, "status": "ok", ...})
    
    schedule_materialization(batch_id, factory_id)             # fire-and-forget
    return {"success": True, "data": {"batch_id": str(batch_id), "files": results}}
```

锁仅覆盖 ③，N MB bytes 流 + parse 全程无锁。

### 8.3 门店名 fuzzy resolver（Python 端）

```python
async def _resolve_store_ids(factory_id, names: list[str]) -> list[int]:
    if not names:
        # 默认全门店
        return await _all_active_store_ids(factory_id)
    
    resolved = []
    for name in names:
        rows = await conn.fetch("""
            SELECT store_id, name FROM dim_store
            WHERE factory_id = $1 AND name ILIKE '%' || $2 || '%'
        """, factory_id, name)
        if len(rows) == 0:
            raise HTTPException(400, f"未找到门店: {name}")
        elif len(rows) == 1:
            resolved.append(rows[0]["store_id"])
        else:
            candidates = [r["name"] for r in rows]
            raise HTTPException(400,
                f"门店名 '{name}' 匹配多个: {candidates}, 请使用完整名")
    return resolved
```

### 8.4 Java AI Tool

```java
@Slf4j @Component
public class RevenueReportGenerateTool extends AbstractBusinessTool {

    @Autowired private PythonSmartBIClient pythonClient;

    @Override public String getToolName() { return "revenue_report_generate"; }

    @Override public String getDescription() {
        return "生成餐饮收入管理报表（同比环比/堂食外卖占比/客单人数）。" +
               "参数: date_from/date_to 必填 YYYY-MM-DD（LLM 须先 resolve '上周'/'本月' 等短语）；" +
               "store_names 可选，省略=全门店；" +
               "meal_periods 可选 enum ['午市','晚市']（'下午茶'→'午市', '夜宵'→'晚市' 由 Tool 内化）。";
    }

    @Override public Map<String,Object> getParametersSchema() {
        return Map.of(
            "type", "object",
            "properties", Map.of(
                "date_from", Map.of(
                    "type", "string",
                    "format", "date",
                    "description", "本期开始日期 YYYY-MM-DD (LLM 必须先 resolve '上周'/'本月' 等短语)"
                ),
                "date_to", Map.of(
                    "type", "string",
                    "format", "date",
                    "description", "本期结束日期 YYYY-MM-DD (含)"
                ),
                "store_names", Map.of(
                    "type", "array",
                    "items", Map.of("type", "string"),
                    "description", "门店名列表 (支持模糊匹配); 省略 = 全部门店"
                ),
                "meal_periods", Map.of(
                    "type", "array",
                    "items", Map.of(
                        "type", "string",
                        "enum", List.of("午市", "晚市")
                    ),
                    "description", "班次过滤; 省略 = 全班次。Tool 内化映射: '下午茶'->'午市', '夜宵'->'晚市'"
                )
            ),
            "required", List.of("date_from", "date_to")
        );
    }

    @Override protected List<String> getRequiredParameters() {
        return List.of("date_from", "date_to");
    }

    @Override
    protected Map<String,Object> doExecute(String factoryId,
            Map<String,Object> params, Map<String,Object> ctx) throws Exception {
        // 不在 Java 端解析 store_names → store_ids (跨 DB)
        // 直接传 store_names 给 Python, Python 做 fuzzy
        List<String> mealPeriods = MealPeriodNormalizer.normalize(
            (List<String>) params.getOrDefault("meal_periods", List.of()));
        
        Map<String,Object> req = Map.of(
            "store_names", params.getOrDefault("store_names", List.of()),
            "date_from",   params.get("date_from"),
            "date_to",     params.get("date_to"),
            "meal_periods", mealPeriods
        );
        
        try {
            Map<String,Object> resp = pythonClient.callRevenueReport(
                "/api/smartbi/" + factoryId + "/revenue-report/prepare", req);
            Map data = (Map) resp.get("data");
            Map summary = (Map) data.get("summary");
            return buildSimpleResult(
                String.format("已生成 %s~%s 收入管理报表（%d 门店, %.1f KB%s）",
                    params.get("date_from"), params.get("date_to"),
                    summary.get("store_count"),
                    ((Number)summary.get("file_size_bytes")).doubleValue()/1024,
                    Boolean.TRUE.equals(summary.get("cache_hit")) ? ", 缓存命中" : ""),
                Map.of("download_url", data.get("download_url"), "summary", summary));
        } catch (HttpClientErrorException e) {
            return buildErrorResult("生成失败: " + e.getMessage());
        }
    }
}
```

### 8.5 Intent 配置（Flyway）

```sql
-- backend/java/cretas-api/src/main/resources/db/flyway/V20260513_01__revenue_report_intent.sql
INSERT INTO ai_intent_configs (
    id, intent_code, intent_name, intent_category, sensitivity_level,
    quota_cost, cache_ttl_minutes, keywords, tool_name, is_active, priority
) VALUES (
    UUID(),
    'REVENUE_REPORT_GENERATE',
    '收入管理报表生成',
    'ANALYSIS',
    'LOW',
    3,
    0,
    '["收入管理报表","收入报表","营业收入","门店收入分析","堂食外卖占比","客单人数分析","环比报表","同比报表"]',
    'revenue_report_generate',
    false,  -- 首期 disabled，部署 + smoke 完后 UPDATE 启用 (项目首例渐进 rollout pattern, 见 runbook)
    70      -- 客户面 critical, 高于通用 50 低于关键 finance 80
);
```

### 8.6 前置 verify items（impl 前必须确认）

1. AIIntentService → Python LLM 调用是否注入 `currentDate`（"上周" 解析依赖）
2. `PythonSmartBIClient` 默认 timeout 是否够 cache miss 场景（>10s 的 `/prepare`）
3. Chat UI 渲染 Tool 返回 `data.download_url` 的实际机制（markdown 链接 vs 按钮）

---

## 9. Vue 前端

### 9.1 文件结构（单页 + 1 个可复用组件）

```
web-admin/src/views/smart-bi/RevenueReport.vue              (单 SFC ~1200 LOC)
web-admin/src/views/smart-bi/__tests__/RevenueReport.spec.ts (Vitest 单元 - 项目兼容)
web-admin/revenue-report.spec.ts                             (Playwright E2E - 项目根)
web-admin/src/components/smartbi/MultiFileUploadArea.vue     (可复用)
web-admin/src/api/smartbi/revenue-report.ts                  (API client)
```

### 9.2 必须遵循的项目惯例

| 项 | 约束 |
|---|---|
| 路径 | `getSmartBIBasePath()` → `/${factory_id}/smart-bi`；Vite proxy `/smartbi-api → :8083` |
| 字段命名 | snake_case 全链路 |
| Blob 下载 | `responseType: 'blob'` → `new Blob(...)` → `URL.createObjectURL` → `<a>.download` 点击 → `setTimeout(revokeObjectURL, 1000)` |
| 防重复点击 | `isProcessing` ref + `if (isProcessing.value) return` + `:disabled="generating"` |
| Loading | `el-button :loading` + 弹层 `已等待 N 秒...` elapsed time |
| el-tabs 状态保留 | localStorage `revenue-report-filters-${factoryId}` 保存表单，onMount 还原 |
| 错误展示 | API 错误 `ElMessage.error`；表单验证 `el-alert type="warning"` 内联 |
| 工厂级菜单 | `hideForFactoryTypes: ['FACTORY']`（只 RESTAURANT 类可见）|
| 中文文件名 | Chrome/Edge/Safari OK；Firefox UA 检测降级为 ASCII + ISO 日期 |
| TypeScript | 显式 union 类型，禁 `as any` |
| URL params | 查询字符串保留参数 `?stores=...&date_start=...&date_end=...`（phase 2 预设可平滑接入）|
| i18n | 项目未启用 vue-i18n，hardcoded 中文是标准 |
| 移动端 | 支持 768px+；<480px out of scope |

### 9.3 SmartBIUploader 扩展

加 `multiple` prop + 多文件进度数组 + 顺序调用 `uploadFileAsync()`（不并发，避免 200MB×N 网络饱和）。

---

## 10. 错误处理 + 测试 + 部署 + 监控

### 10.1 错误契约

| HTTP | 触发 | UI 行为 |
|---|---|---|
| 400 | date_from > date_to | `el-alert warning` 表单内联 |
| 400 | store_names ambiguous / not found | `el-alert` + 候选列表 |
| 400 | meal_period 非 enum | 表单校验阻止提交 |
| 400 | upload 文件不可识别 | per-file status "unknown" + preview headers |
| 403 | JWT factory_id ≠ URL factory_id | `ElMessage.error` + 跳登录 |
| 409 | content_hash 重复 | per-file status "duplicate"，不阻塞其他文件 |
| 500 | openpyxl render 异常 | `ElMessage.error` + 提示联系运营 |
| 502 | Python 不可用（Java→Python）| Tool returns buildErrorResult |
| 504 | 生成 >60s | `ElMessage.error` + "请缩小数据范围" |

**降级允许**：
- ✅ Redis 不可用 → 跳过 cache（WARN 日志）
- ✅ Gold 物化未完成 → on-demand 触发 + 等 5s（超时返 stale + header 标注）
- ❌ 禁止返假数据 / 静默成功

### 10.2 测试策略

**Python pytest**（flat 命名，`backend/python/smartbi/tests/`）：
- `test_revenue_report_router.py` — pos_router filename + header 嗅探
- `test_revenue_report_writers.py` — 3 新 silver writer + 复用 writer 行为
- `test_revenue_report_template.py` — 4 个 block SQL（含 NULL / 零订单店 / 多店并发）
- `test_revenue_report_renderer.py` — openpyxl 输出 snapshot（合并范围 / 单元格值）
- `test_revenue_report_api.py` — 6 个端点契约
- `test_revenue_report_store_resolver.py` — fuzzy 0/1/N 匹配

Inline `@pytest.fixture` 数据；不建中心化 fixtures 目录。

**Java JUnit + Mockito**（`backend/java/cretas-api/src/test/java/.../`）：
- `RevenueReportGenerateToolTest.java` — 参数校验 + mock pythonClient（success / timeout / 500）

**Vue Vitest + Playwright**：
- `web-admin/src/views/smart-bi/__tests__/RevenueReport.spec.ts` — 表单 / blob / 日期 shortcuts / 防重复点击
- `web-admin/revenue-report.spec.ts`（**项目根**，Playwright 习惯位置）— 全流程 E2E：登录 → 上传 → 生成 → 下载 → 验证 xlsx

**集成测试**：
- `backend/python/smartbi/tests/test_revenue_report_e2e.py` — 真 DB fixture → upload → silver → gold materialize → /generate → 解析 xlsx 比对

### 10.3 数据库 Migration 顺序

```
Python (smartbi_db / smartbi_prod_db):
  V20260513_01__qhj_revenue_silver_gold.sql  (meal_period + agg_daily_order_type_meal)
  V20260513_02__upload_dedup.sql              (content_hash + UNIQUE)
  V20260513_03__report_audit_log.sql          (smart_bi_report_audit_log + RLS)

Java (cretas_db):
  V20260513_01__revenue_report_intent.sql     (ai_intent_configs 1 行, is_active=false)
```

**部署顺序**（test → prod，遵守 server-operations HARD rule）：

```
1. ./scripts/deploy/deploy-smartbi-python.sh --env test  # Python migration via Step 3.5 runner
2. ./scripts/deploy/deploy-backend.sh --env test          # Java Flyway on startup
3. ./scripts/deploy/deploy-web-admin.sh --env test        # Vue dist deploy
4. Smoke (curl /upload + /generate + 登录 web-admin 试)
5. UPDATE ai_intent_configs SET is_active=true ...        # test env 启用 intent
6. LLM smoke "生成上周收入报表"
7. 重复 1-3 with --env prod
8. UPDATE ai_intent_configs SET is_active=true ... in prod (24h soak 后)
```

**回滚**：
- 代码：`deploy-backend.sh --rollback`（恢复 jar）
- Intent：`UPDATE ai_intent_configs SET is_active=false`（秒级生效）
- Schema：**Flyway 不回滚**；新表/列 additive 设计，保留不删

### 10.4 监控

**Prometheus 指标**（Section 4 + 7.4）：
- `smartbi_report_gen_seconds{report_type, status}`
- `smartbi_report_file_bytes{report_type}`
- `smartbi_report_gen_errors_total{type}`
- `smartbi_report_cache_hit_total / cache_miss_total {report_type}`

**`/metrics` 端点已存在**（`backend/python/main.py` `Instrumentator()`），新指标自动 expose。

**Grafana dashboard**：项目 `monitoring/grafana/dashboards/` 无现成配置，**dashboard 需 ops 单独配置**（spec 仅提供指标定义）。

**告警**：项目无 PagerDuty / AlertManager / Slack webhook 集成。首期 **log-only + 业务自查**；告警渠道 ops 配齐后启用规则：

| 指标 | Critical | Warning |
|---|---|---|
| p95 生成时长 | >60s 持续 5min | >30s 持续 10min |
| 错误率 | >10% 持续 5min | >5% 持续 10min |
| Cache hit rate | <10% 持续 1h | <30% 持续 1h |
| Redis 不可用 | 持续 >1min | — |

### 10.5 Rollout 计划

```
Week 1
  D1-3: Migration + 代码部 test env，内部 smoke + bug fix loop
  D4-5: Steve 验收 test env
  D6:   Migration + 代码部 prod，intent is_active=false，给 1-2 个内部账号试用
  D7:   监控 24h 数据 OK → UPDATE is_active=true，通知客户 + 推教程

Week 2+
  持续监控 p95 / 错误率 / cache hit
  phase 2 候选评估
```

### 10.6 性能假设（部 prod 前必跑）

| P0 | Block 4 N=10 店并发 p95 (决定 semaphore 数) |
| P0 | 真青花椒 60 店 30 天 → 端到端 generate 时长 |
| P0 | openpyxl 60 店 × 30 天 xlsx 大小 + 生成耗时 |
| P0 | RLS 实测开销 |
| P1 | 4-worker × N 并发 pool 争用 |
| P1 | Redis cache 容量 + LRU 频率 |
| P1 | 物化 lag 实测 |

---

### 10.7 API Endpoint Contracts

每个 endpoint 标准响应 envelope `{success: bool, data: any, message: str, code?: str}`（项目 `api-response-handling.md` 标准），错误用 HTTP status + message，**不**引 enum code 字段。

### POST `/upload`

```jsonc
// Request: multipart/form-data with field `files` (List[UploadFile])
// Response 200:
{
  "success": true,
  "data": {
    "batch_id": "uuid",
    "files": [
      {"filename": "营业概况报表.csv", "status": "ok",
       "report_type": "daily_summary", "rows_ingested": 1244,
       "stores_touched": ["青花椒南方百联店", ...]},
      {"filename": "x.csv", "status": "duplicate"},
      {"filename": "y.csv", "status": "unknown",
       "preview_headers": ["列1", "列2", ...]}
    ]
  },
  "message": "上传完成"
}
```

### POST `/prepare`（LLM Tool 路径）

```jsonc
// Request:
{
  "store_names": ["颛桥龙湖店"] | [],       // [] = 全部
  "date_from": "2025-10-01",
  "date_to":   "2025-10-07",
  "meal_periods": ["午市", "晚市"] | []     // [] = 全班次
}
// Response 200:
{
  "success": true,
  "data": {
    "cache_key": "revenue_report:R_QINGHUAJIAO_REAL:abc123:2025-10-07T18:00:00",
    "download_url": "/api/smartbi/R_QINGHUAJIAO_REAL/revenue-report/download/{cache_key}",
    "summary": {
      "store_count": 3,
      "date_range": "2025-10-01 - 2025-10-07",
      "gold_materialized_at": "2025-10-07T18:00:00",
      "file_size_bytes": 28456,
      "cache_hit": true,
      "is_stale": false                       // true if gold lag > 5s timeout
    }
  }
}
```

### POST `/generate`（Web UI 路径，流式 xlsx）

Request 同 `/prepare`。Response：
- Content-Type: `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`
- Content-Disposition: `attachment; filename*=UTF-8''收入管理报表_YYYY-MM-DD_YYYY-MM-DD.xlsx`
- Body: xlsx 字节流
- 响应头：`X-Cache-Hit: true/false`、`X-Gold-Materialized-At: ISO8601`、`X-Store-Count: N`、`X-Is-Stale: true/false`

### GET `/download/{cache_key}`

无 body 入参。Response 同 `/generate`。如 Redis 不命中，按 cache_key 反查 audit_log 的 `params_snapshot` 重新生成。

### GET `/stores`

```jsonc
// Query: ?exclude_closed=true (默认 true)
// Response 200:
{
  "success": true,
  "data": [
    {"store_id": 123, "name": "青花椒南方百联店"},
    ...
  ]
}
```

### GET `/audit-log`

```jsonc
// Query: ?limit=20
// Response 200:
{
  "success": true,
  "data": [
    {
      "id": 12345,
      "generated_by": "user_id_xxx",
      "generated_at": "2025-10-07T18:00:00",
      "params_snapshot": {"store_names": [...], "date_from": "...", ...},
      "file_size_bytes": 28456,
      "status": "ok",
      "cache_hit": false,
      "duration_ms": 4200
    }
  ]
}
```

### 内部共享 helper

```python
async def _generate_with_cache(factory_id, params, request_ctx) -> tuple[str, dict, BytesIO]:
    """两条端点 (/prepare + /generate) 共享。返回 (cache_key, summary, bytes_io)。"""
    # 1. 计算 cache_key (含 gold_max_computed_at)
    # 2. Redis GET; hit → 返回缓存字节 + summary
    # 3. miss → with_factory_serialization → compute_qhj_revenue_report → render → SET cache
    # 4. 写 audit_log (cache_hit/duration_ms/file_size 都记入)
    # 5. 返回结果
```

`/prepare` 用其 summary 部分，`/generate` 直接流式 BytesIO 部分。

---

## 11. Pre-Implementation Clarifications（F 审计 MAJORs 解决）

### 11.1 Block 4 NULLIF 边界行为

```sql
ROUND(SUM(bi.actual_receive) /
      NULLIF(bi.customer_count * COUNT(*), 0), 0) AS revenue_per_diner
```

- `customer_count` 是 INT > 0（SQL 已 WHERE 过滤 `customer_count > 0`），所以 `bi.customer_count * COUNT(*)` 在 GROUP BY 单 bin 内 ≥ 1
- NULLIF 实际不会触发（防御性写法）
- `revenue_per_item` 分母是 `SUM(items_per_bill)`，理论可能 0（订单无商品行），NULLIF 触发 → NULL → 前端渲染 "—"
- `revenue_ratio` 分母 `t.total_revenue` 若全期零销售，NULLIF → NULL → 前端 "—"
- 前端规约：所有 NULL 数值列渲染 `—`，不渲染 `0` 或 `null`

### 11.2 `include_yoy` 参数来源

- **首期固定 `False`**：Python `RevenueReportParams.include_yoy` 默认 False，调用方**不传**
- 不在 Vue 表单暴露，不在 URL query 出现，不在 Java Tool 入参出现
- Phase 2 加 2024 数据后，Vue 加 checkbox + API 接受 `include_yoy: true`
- API 入参可选字段不破坏向后兼容

### 11.3 cache_hit 场景指标语义

| 字段 | cache miss 场景 | cache hit 场景 |
|---|---|---|
| `file_size_bytes` | 实际生成的字节数 | 缓存中的字节数（与首次生成一致）|
| `duration_ms` (audit log) | 全程耗时含生成 | Redis fetch 耗时 (~5-50ms) |
| `cache_hit` (audit log) | `false` | `true` |
| Prometheus `gen_seconds` | 实际生成时长 | Redis 命中时**不上报** `gen_seconds`，改上报 `cache_hit_total` counter |

cache hit 也写 audit log 一行（cache_hit=true），方便客户争议时反查"上次下载了什么"。

### 11.4 Stale data UI 展示

API 返 `X-Is-Stale: true` 时（gold 物化超 5s 未完成，返 stale 数据）：

- Vue 页面顶部弹 `el-alert type="warning"` 持久横幅："⚠️ 数据延迟，最新截至 {X-Gold-Materialized-At}，可能不含最近一次上传的数据"
- xlsx 文件首 sheet 底部注释行加红字 "本报表数据截至 {timestamp}"（renderer 在 stale=true 时插入）
- LLM Tool 返回 message 加 "（数据延迟，截至 YYYY-MM-DD HH:MM）" 后缀

### 11.5 测试 fixture 数据源

- 真二维火 CSV 字节样本 → 抽取 5-10 行从 `smartbi维度分析/大众点评/真实餐饮连锁数据/青花椒25年/青花椒25年/` 各报表
- 存为 `backend/python/smartbi/tests/fixtures/qhj_pos/*.csv`（首次创建该目录）
- 每个 fixture 文件 < 10 KB，敏感字段（如真实店名）保留（已在 `dim_store` 公开数据）
- 测试用 `@pytest.fixture` 引用：
  ```python
  @pytest.fixture
  def daily_summary_csv() -> bytes:
      path = Path(__file__).parent / "fixtures" / "qhj_pos" / "daily_summary_sample.csv"
      return path.read_bytes()
  ```
- 不 vendoring 完整 120MB 详细日报表，生成时用合成数据 (5 店 × 7 天 × 10 单)

### 11.6 渐进 rollout `is_active` 操作

`UPDATE ai_intent_configs SET is_active=true WHERE intent_code='REVENUE_REPORT_GENERATE';` 由**部署负责人**手动在 test/prod psql 中执行（项目首例此 pattern，runbook 文档化）。未来可考虑加 admin UI 切换 / DB-backed feature flag 服务。

### 11.7 Phase 2 候选明确化

| 候选 | 决策 |
|---|---|
| LLM 路径有附件上传（Q6 提及）| **Phase 2** — 首期 LLM 不支持附件，要求 LLM "查 Silver 已有数据"。Tool description 不暴露上传能力 |
| 工厂 ID 级菜单 allowlist | **Phase 2** — 首期 `hideForFactoryTypes: ['FACTORY']` 粗筛够 |
| streaming progress | **Phase 2** — 首期用 elapsed-time 弹层 |
| 多 POS 源 | **Phase 2** — 各 POS 独立 spec |

---

## 12. Open Questions / Phase 2 候选

- 工厂 ID 级菜单 allowlist 字段（首期类型粗筛够用，后续需要时新增 `showOnlyForFactoryIds`）
- streaming progress / WebSocket 长任务推送
- 跨 session 审计日志 UI（首期仅查最近 20 条）
- 报表参数预设保存
- 前端遥测（pageview / click / error）
- OSS / R2 离线导出（流式直返天然不需要，除非客户要发邮件链接）
- 同比 4 列（需 2024 年压缩包数据导入）
- 客如云 / 美团 / 哗啦啦 多 POS 源支持

---

## 附录

### A. report_registry.yaml 完整定义

```yaml
# backend/python/smartbi/knowledge/restaurant/pos/report_registry.yaml
2dfire:
  filename_keywords:
    - keyword: "营业概况报表"
      writer: daily_summary_writer
      grain: "store × day"
    - keyword: "堂食外卖占比表"
      writer: meal_split_writer
      grain: "store × period × order_type"
    - keyword: "区域销售报表"
      writer: region_summary_writer
      grain: "region × period"
    - keyword: "详细日报表"
      writer: bill_flow_writer
      grain: "transaction"
    - keyword: "订单付款方式汇总"
      writer: bill_flow_writer
      grain: "transaction"
    - keyword: "商品销售明细表"
      writer: product_summary_writer
      grain: "product × period"
```

### B. CORS expose_headers 配置位置

`backend/python/smartbi/main.py` CORSMiddleware 加：
```python
app.add_middleware(
    CORSMiddleware,
    ...
    expose_headers=["X-Cache-Hit", "X-Gold-Materialized-At", "X-Store-Count"],
)
```

### C. Runbook（独立文件）

`docs/operations/qhj-revenue-report-runbook.md` 涵盖：
- Gold 物化失败如何手动补
- Redis 清缓存如何操作
- migration 应急回滚（虽然不推荐）
- `is_active` 渐进开关切换 SQL（项目首例新 pattern，记录用法）
- 客户反馈"数据不对"如何查审计日志反查参数

### D. 复用现有 helper 清单

| Helper | 路径 | 用途 |
|---|---|---|
| `with_factory_serialization` | `smartbi.canonical.concurrency` | per-factory 锁 |
| `schedule_materialization` | `smartbi.services.materialized_analytics.hooks` | Gold 物化 fire-and-forget |
| `getSmartBIBasePath()` | `web-admin/src/api/smartbi/common.ts` | factory_id 前缀 |
| `ExcelAdapter` | `smartbi.ingestion.excel_adapter` | CSV/xlsx 流式读取 |
| `ShapeDetector` | `smartbi.canonical.shape_detector` | header 形状二级确认 |
| `dim_resolver.resolve_store()` | `smartbi.canonical.dim_resolver` | 门店 upsert（改：加 .strip()）|
| `_decimal_to_number` | `smartbi.api.analysis_finance` 或 helper | Decimal → JSON number |
| `Instrumentator` Prometheus | `backend/python/main.py` | 指标 export |
| `AbstractBusinessTool.buildSimpleResult` | Java | Tool result 构造 |
| `PythonSmartBIClient.executeWithRetry` | Java | 熔断重试 |

---

## E. 审计追溯（本 spec 经过的审计员清单）

| 阶段 | 审计员 | 关键发现 |
|---|---|---|
| Section 1 | A (Python infra) | Silver 表已有，不需新建 fact_* 表（改用 Gold） |
| Section 1 | B (Java Tool) | `FinancialChartGenerateTool` 是 mirror 参考 |
| Section 1 | C (Vue + DB) | smart-bi 目录带连字符、CORS expose_headers 缺 |
| Section 2 | P (Schema) | `meal_period` 不存在需 ALTER、`dim_resolver` 无 trim |
| Section 2 | Q (Routing) | zip handler 不存在，3 个 summary writer 要新建 |
| Section 3 | R (SQL) | `bill_id` 不存在 → `transaction_id`；零订单店要 LEFT JOIN |
| Section 3 | S (Index) | FK 索引存在 ✓；pool max=5 vs gather 10 需 semaphore |
| Section 4 | T (xlsx infra) | `insert_rows` + 合并单元格不可用，需纯代码构建 |
| Section 4 | U (硬化) | StreamingResponse 流式无落盘，多数 U 项不需要 |
| Section 5 | V (API) | snake_case；upload 锁粒度收窄；store 解析改 Python |
| Section 5 | W (LLM) | LLM currentDate 注入 verify；meal_period enum 化 |
| Section 6 | X (Vue) | SmartBIUploader 加 multiple；CORS expose；factory_id allowlist 不存在 |
| Section 6 | Y (长期) | 单文件 SFC 是项目惯例；URL params 预留 phase 2；i18n 未启用 |
| Section 7 | Z (部署) | Flyway 命名修正；HTTP 422→400；factory_id `R_QINGHUAJIAO_REAL` |

---

**END OF SPEC**
