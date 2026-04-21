# Unified Data Middle-Layer v1 Design

**Status**: v2 (post-audit)
**Author**: brainstorm session Steve ↔ Claude (Apr 22 2026)
**Context**:
- Meeting transcript `C:\Users\Steve\Desktop\meeting-transcript.txt`
- Audit report by superpowers:code-reviewer, Apr 22 2026 (agent a7856a6ab4b9681ee)
- v1 (pre-audit) replaced; see git history for delta

---

## 0. Problem Statement & Scope (revised)

### 0.1 Problem

Current state (Apr 22 2026):
- qhj 客户上传 200K POS 数据 (upload 4169) 只喂了 5 个模块 (餐饮 4 页 + AI 问答 + 销售分析)
- 其他 7 个核心模块 (财务报表/分析概览/KPI/趋势/销售订单/开票/进销存) 即使有数据也不显示, 因为 `smart_bi_dynamic_data JSONB` 与 Java 业务表独立不打通
- 字段识别当前一次性 mapping, 没有知识积累; 同一 POS 厂商升级字段会重映射, 人工校正易丢失
- 未来要接美团/客如云 API + 大众点评评论 + 供应链数据, 当前架构没准备好

### 0.2 Goals (全 7 个都要, 但 v1.1 只覆盖一部分 — audit S5 修正)

1. 字段识别扩展性: 新 source / 新字段 <1 天接入, 不改代码 — **v1.1 foundation**
2. 下游模块覆盖: 财务/分析/KPI/趋势 等都能读 POS 衍生指标 — **v1.1 做 3 个最痛点 (财务报表/分析概览/KPI), 其余 7 个 v1.2**
3. 跨源融合: POS 销售 + 大众点评 评论 可 JOIN 分析 — **v1.3 (需 dim_store_alias 基础, v1.1 打)**
4. 实时性: POS API 推送 → 5 min 内 dashboard 更新 — **v1.2 only** (Excel v1.1 目标 2 min)
5. AI 建议可落地: 不再输出"直接涨价" — **v1.1 基础 (Agent 层), v1.2 打磨**
6. 成本控制: 月均 LLM 成本 <¥200/客户 — **v1.1 加 budget_daily + tool-call cap, v1.2 加 model 路由**
7. 多租户隔离: 任何查询必须带 factory_id scope — **v1.1 RLS 为硬门槛** (不 compromise)

### 0.3 Sprint Scope (12 weeks, 1 engineer — audit S5 修正)

**v1.1 (6 weeks) = restaurant end-to-end, 部分下游模块**

- Week 1: Bronze Excel adapter 重构 + field_registry + RLS + middleware (goal 7)
- Week 2: Silver schema — 5 dim + 3 fact + fact_pos_item parser (goal 1+2+7)
- Week 3: Gold 改名 smartbi/gold/ + agg_daily/product/channel + MaterializationTrigger (goal 2+6)
- Week 4: Downstream 3 模块切换 — 财务报表/分析概览/KPI (goal 2) + shadow-read + golden fixture
- Week 5: Agent budget guard + narrative_cache + AI 建议 prompt 升级 (goal 5+6)
- Week 6: 回归测试 + bake + 逐模块 feature flag flip

**v1.2 (4 weeks) = 1 new source + 剩余 9 模块 + 实时性**

- Week 7-8: 美团 API adapter (Bronze) + 增量物化 + webhook + hourly poll 兜底 (goal 4)
- Week 9: Downstream 剩余 9 模块切换 (趋势/开票/收款/进销存/销售订单/...)
- Week 10: Agent 层 model 路由 (Aliyun free → Zhipu free → DeepSeek paid) + 成本硬上限

**v1.3 (2 weeks) = supply chain + 点评评论**

- Week 11: 供应链数据接入 (沿用 Bronze 模式, 加 fact_production_batch + fact_purchase_order_item)
- Week 12: 点评评论 (fact_review) + dim_store_alias 跨源 JOIN 示范 2 个 (差评顾客/低分门店)

**deliberate deferrals** (不在 12 周内):
- 抖音/微信外卖平台 (v2)
- 客如云 API (v2, 先做美团)
- 会员数据 dim_customer (v2)

---

## 1. 架构总览 & 数据流

### 1.1 四层职责 (revised per audit)

| 层 | 名字 | 目录 | 职责 | 反模式 |
|---|---|---|---|---|
| Bronze | 接入层 | `smartbi/ingestion/` | 5 个 source adapter, 只把源数据归一成 RawEvent 写暂存. 保留原字段 + 源元数据 | 不做语义解释, 不做业务映射 |
| Silver | 统一 Schema 层 | `smartbi/canonical/` | 领域无关 Fact/Dim 模型 + field_registry 知识库. **所有下游唯一读点**. RLS 强制 tenant scope | 不做预聚合, 不存报表结果 |
| Gold | 物化分析层 | `smartbi/gold/` (改名自 materialized_analytics, 保留全部现有代码) | 按 domain template 预计算 durable agg_* 表 + per-upload chart cache (现有 SmartBiPgAnalysisResult). Trigger: upload_complete / field_registry_reviewed / api_append_incremental | 不做 narrative, 不做自由问答, 不做 per-upload 的单次图表 (那是现有 materialized_analytics 覆盖, 保留) |
| Agent | AI 编排层 | `smartbi/agent/` | LLM 只接 Gold agg 摘要 + 用户问题, 生成 narrative / 建议. Tool call 受限 (per-turn ≤3). 成本守门员有具体实现: agent_budget_daily + narrative_cache 24h + model 路由 | 不直接看 raw rows. 不存 charts (Gold 职责) |

### 1.2 单次 upload 数据流

```
Excel 263MB
  ↓
Bronze.ExcelAdapter (stream parse, no full-load)
  ↓
raw_events (upload_id, row_idx, raw_json, source_meta)
  ↓
Silver.normalizer (resolve field_registry, apply combo parser)
  ↓
  ├── dim_* (第一次见 UPSERT)
  ├── dim_store_alias (跨源关联)
  ├── fact_pos_transaction (每笔账单 × 门店: qhj 4169 = 199,996 行)
  ├── fact_pos_item (每条商品明细, 从 combo 串解析: ~400K-800K 行)
  ├── fact_pos_payment (支付渠道 EAV, qhj ~500K 行)
  └── fact_pos_discount (代金券 EAV)
  ↓ (trigger: upload_complete)
Gold.materialize(upload_id, domain='restaurant')
  ↓
  ├── agg_daily (UPSERT on factory_id+date+store)       — durable
  ├── agg_product (UPSERT on factory_id+product_id+month) — durable
  ├── agg_channel (UPSERT on factory_id+date+channel)     — durable
  ├── narrative_cache (factory_id, question_hash → answer, 24h TTL)
  └── smart_bi_pg_analysis_results (现有 per-upload chart cache, 保留)
  ↓
下游模块通过 SilverQueryAPI 或直接读 agg_*
下游业务 Java 端点改 HTTP 调 Python Gold endpoints
```

### 1.3 现有代码去留 (revised per audit S1/reuse)

| 文件 / 模块 | 去留 | 估算改动 |
|---|---|---|
| `chat.py` C1/C2/C3 时间过滤 | 保留, 数据源切 Silver (shadow-read 验证后) | ~200 行重定向 |
| `restaurant_analytics.py` + `RestaurantAnalyzerV2` + `restaurant/sections/*` | 全部保留, 数据源切 Silver | ~300 行重定向 |
| `materialized_analytics/` (schema/domain_detector/materializer/persistence/hooks/templates×5) | **保留 85-90% + 改名 `smartbi/gold/`**. 扩展: 加 `agg_*` durable 表, 加 `MaterializationTrigger` 接口 | ~500 行新增, 0 行删除 |
| `excel_async.py` streaming worker | 插入 `ingest_via_bronze` 函数, 旧路径保留 (dual-write 阶段) | ~200 行新增 |
| `semantic_mapper.py` | 保留, 作为 Silver.normalizer 内部服务. 不拆 | 0 行删除, 集成点变 |
| `alias_normalizer.py` (已有) | **reuse** 做 dim_product normalized_name | 0 改动 |
| `smart_bi_llm_usage` 表 (已有) | **reuse + 扩展** 给 Agent cost 用 | 加 2-3 列 |
| `upload_aggregate_cache` (chat.py:1101) | **reuse + 扩展** key schema 包含 filter 签名 | ~50 行 |
| `smart_bi_dynamic_data` 表 | **4 阶段 phased**: A 双写保读 (30d) → B 每模块独立 flag 切读 → C 只读 bronze (90d) → D 归档/删除 | 不动表, 逐步加 READ_FROM flag |
| Java `sales_orders` / `finance_transactions` | 不动 | - |
| Java `SmartBIAnalysisController` / `SmartBIDashboardController` / `SmartBIPublicDemoController` | 改 HTTP 调 Python Gold | ~150 行/每个 |

### 1.4 架构选型 Why

| 选择 | 为什么 |
|---|---|
| Silver 独立表 (非 view on JSONB) | 物化是成本守护线: JSONB 扫 2s+, Silver 扫 <50ms |
| Bronze / Silver / Gold 分三层 (非二层) | Bronze 保原字段 (追溯), Silver 统一 (下游), Gold 物化 (性能) |
| Python 承担 Silver+Gold, Java 只读 Gold | 会议: "Python 是数据分析最好的工具" + Java 负责事务 |
| Agent 不直接看 raw | 成本 + 准确度双保险 |
| PostgreSQL 不用 Iceberg/Spark | 200K 行离 10M 门槛 50x, 过度工程 (v1.3 加 5M 合成数据 load-test 确认上限) |
| RLS (非手工加 factory_id) | Apr 21 leaks 教训, 不能靠自律 |

### 1.5 Freshness Contract (**新增 per audit F3**)

| Source 类型 | SLA | 物化方式 |
|---|---|---|
| Excel upload | 2 min (from upload complete) | upload-level, Polars batch, `freshness_version` 版本切换 |
| POS API (v1.2) | 5 min (from API row arrival) | 增量: INSERT ... ON CONFLICT DO UPDATE SET metric = metric + EXCLUDED.metric |
| 评论爬取 (v1.3) | 1 hour | batch, 每小时一次, incremental by created_at |
| 供应链 (v1.3) | 日级 | nightly batch |

所有 Gold 表加 `freshness_version BIGINT` 列. Reader 在 tx 内 SELECT 时取最大已 committed 版本, 保证读到完整一致快照, 不读半写状态.

---

## 2. Silver 统一 Schema

### 2.1 Dimensions

```sql
-- Shared across all domains
dim_store (
  store_id     BIGSERIAL PK,
  factory_id   VARCHAR(50) NOT NULL,
  name         VARCHAR(200) NOT NULL,
  brand        VARCHAR(100),
  city, province, region VARCHAR(50),
  created_at, updated_at TIMESTAMP,
  UNIQUE (factory_id, name)
)
-- RLS: factory_id = current_setting('app.factory_id')

dim_store_alias (              -- 新增 per audit S4, OP-5
  alias_id     BIGSERIAL PK,
  store_id     BIGINT FK dim_store,
  factory_id   VARCHAR(50) NOT NULL,
  platform     VARCHAR(50),     -- meituan / dianping / douyin / eleme / wechat
  external_id  VARCHAR(200),    -- 平台上的 shop_id
  confidence   NUMERIC(3,2),
  reviewed_by  BIGINT,
  reviewed_at  TIMESTAMP,
  valid_from, valid_to DATE,    -- 门店改 meituan 关联时历史可追
  UNIQUE (platform, external_id) WHERE valid_to IS NULL
)

dim_product (
  product_id       BIGSERIAL PK,
  factory_id       VARCHAR(50) NOT NULL,
  name             VARCHAR(500) NOT NULL,
  normalized_name  VARCHAR(500) NOT NULL,  -- via alias_normalizer.py
  category, sub_category VARCHAR(100),
  sku_code         VARCHAR(100),
  created_at, updated_at TIMESTAMP,
  UNIQUE (factory_id, normalized_name)
)
-- 注: source_signature hash 从 v1 spec 移除 per audit S2 — 20411 combos 不是 20411 产品

dim_date (date DATE PK, ...)   -- 用 view over generate_series(), 不物化

dim_staff (
  staff_id    BIGSERIAL PK,
  factory_id  VARCHAR(50),
  name        VARCHAR(100),
  role        VARCHAR(50),      -- 服务员/收银员/店长
  store_id    BIGINT,
  UNIQUE (factory_id, name, store_id)
)

dim_payment_channel (
  channel_id  BIGSERIAL PK,
  factory_id  VARCHAR(50) NOT NULL,
  name        VARCHAR(100) NOT NULL,  -- 美团/抖音/...
  category    VARCHAR(50),            -- online/offline/voucher
  UNIQUE (factory_id, name)
)
-- Concurrent-safe upsert pattern required:
-- INSERT ... ON CONFLICT (factory_id, name) DO UPDATE SET name=EXCLUDED.name RETURNING channel_id

dim_discount (                   -- 扩展 per audit S3
  discount_id     BIGSERIAL PK,
  factory_id      VARCHAR(50),
  name            VARCHAR(200),  -- "点评98代100"
  discount_type   VARCHAR(50),
  platform        VARCHAR(50),   -- meituan / dianping / douyin / voucher / ...
  face_value      NUMERIC(18,2), -- 100 (代金券面额)
  actual_price    NUMERIC(18,2), -- 98 (客户实付)
  start_date, end_date DATE,
  parsed_ok       BOOLEAN,       -- 规则解析失败 = false, 可人工补
  UNIQUE (factory_id, name)
)

-- dim_customer 从 v1.1 移除 per audit S3 — qhj 无 customer ID, 延到 v1.2 (review 带 user_pseudo_id)
```

### 2.2 Facts (核心, revised per audit F1/F2/S2)

```sql
fact_pos_transaction (          -- 每笔账单 × 门店 (qhj 4169 = 199,996 行)
  id                BIGSERIAL PK,
  factory_id        VARCHAR(50) NOT NULL,
  upload_id         BIGINT,
  source_type       VARCHAR(20),        -- excel / meituan_api / ...
  source_bill_no    VARCHAR(100) NOT NULL,
  store_id          BIGINT FK NOT NULL,
  staff_id          BIGINT,
  date              DATE NOT NULL,
  time              TIMESTAMP,
  -- bill-level aggregates (新增 per audit F1 后建议)
  gross_amount      NUMERIC(18,2),
  discount_amount   NUMERIC(18,2),
  tax_amount        NUMERIC(18,2),
  net_amount        NUMERIC(18,2),
  actual_receive    NUMERIC(18,2),
  customer_count    INT,
  avg_per_capita    NUMERIC(18,2),
  table_no          VARCHAR(50),
  order_type        VARCHAR(50),
  channel_origin    VARCHAR(50),
  item_count        INT,                -- 本单商品条数 (from fact_pos_item 计数)
  has_discount      BOOLEAN,
  UNIQUE (factory_id, source_type, store_id, source_bill_no),  -- 修正 per audit F1
  INDEX (factory_id, date, store_id),
  INDEX (factory_id, store_id, date)
)
-- 注: 移除了 product_id 字段 (grain 错误, per audit F1)

fact_pos_item (                  -- 新增 REQUIRED per audit S2: bill × product 明细
  id                  BIGSERIAL PK,
  transaction_id      BIGINT FK fact_pos_transaction NOT NULL,
  factory_id          VARCHAR(50) NOT NULL,
  product_id          BIGINT FK dim_product,  -- NULL 表示 parser 未能识别
  qty                 NUMERIC(18,3),
  unit_price          NUMERIC(18,2),
  amount              NUMERIC(18,2),
  source_item_raw     TEXT,                   -- 原始 combo 片段, parser 失败时存整串
  INDEX (factory_id, product_id, amount),
  INDEX (transaction_id)
)
-- combo parser: "#招牌青花椒味(单人份)#_1份*58+#米饭#_1份*3+..." 按 '+' split,
-- 每段 regex r'#?([^#]+)#?_(\d+(?:\.\d+)?)份?\*(\d+(?:\.\d+)?)' 提取 name/qty/price

fact_pos_payment (               -- 支付 sub-fact, EAV
  transaction_id    BIGINT NOT NULL,
  factory_id        VARCHAR(50) NOT NULL,
  channel_id        BIGINT NOT NULL,
  amount            NUMERIC(18,2),
  INDEX (factory_id, channel_id, amount),
  INDEX (transaction_id)
)

fact_pos_discount (
  transaction_id    BIGINT NOT NULL,
  factory_id        VARCHAR(50) NOT NULL,
  discount_id       BIGINT NOT NULL,
  quantity          INT,
  amount            NUMERIC(18,2),
  INDEX (factory_id, discount_id, amount),
  INDEX (transaction_id)
)

fact_review (                    -- v1.3
  id              BIGSERIAL PK,
  factory_id      VARCHAR(50) NOT NULL,
  store_id        BIGINT FK dim_store,
  platform        VARCHAR(50),
  rating          NUMERIC(2,1),
  content         TEXT,
  reply_content   TEXT,
  user_pseudo_id  VARCHAR(100),
  created_at      TIMESTAMP,
  sentiment_score NUMERIC(3,2),
  keywords        JSONB
)

fact_production_batch (          -- v1.3, 从现有 Java production_batches 迁
  ... 字段 TBD
)

fact_purchase_order_item (       -- v1.3
  ... 字段 TBD
)
```

**所有 fact 表都 ENABLE ROW LEVEL SECURITY** (详见 §6).

### 2.3 Field Registry (revised per audit M3)

```sql
field_registry (
  source_type        VARCHAR(20),
  source_version     VARCHAR(50),     -- "qhj_2025_v1", "meituan_api_v3.2"; 由 adapter emit (User-Agent / API version header)
  normalizer_version VARCHAR(20),     -- 新增: mapper 逻辑改了就 bump, 自动失效老映射
  raw_column         VARCHAR(200),
  canonical_field    VARCHAR(100),
  domain             VARCHAR(20),
  role               VARCHAR(20),
  mapper_method      VARCHAR(20),     -- {rule, embedding, llm, manual} 统一 (per audit M3)
  confidence         NUMERIC(3,2),
  sample_values      JSONB,
  reviewed_by        BIGINT,
  reviewed_at        TIMESTAMP,
  PRIMARY KEY (source_type, source_version, normalizer_version, raw_column)
)
```

**工作流**:
1. Bronze adapter 读 `raw_column` + 知 `source_version`, 查 registry 命中 → 直接用 (0ms)
2. 未命中 → mapper 三级 (rule → embedding → llm), 写回 registry
3. 低置信度 (<0.7) 打 `needs_review`; 管理员 UI (`/smart-bi-admin/fields`, 新建, per audit OP-4) 可改 `canonical_field`, `mapper_method='manual'`, 下次自动用
4. 客户追加列 (老 upload v2) → 仅映射新列, 老列复用
5. mapper 逻辑改 (如新增 subcategory) → 改 `normalizer_version` → 下次 upload 自动重映射, 老记录保留做审计

### 2.4 Migration 4 Phases (revised per audit F4)

**Phase A (Week 4)**: Silver + Gold 表全新建. 不动 `smart_bi_dynamic_data`. 新 upload Bronze → Silver (新表) + 老路径 (`smart_bi_dynamic_data`) **双写**. 下游仍读 `smart_bi_dynamic_data`.

**Phase A.5 (Week 4-5)**: 给 upload 4169 跑**迁移脚本** JSONB → Silver. 产出 **golden fixture**: 30-50 个标杆 Q→A (e.g. "总营业额", "门店 Top 3", "3月 Top 5 product", "Top 支付渠道"). 记为 `tests/golden/4169/` pytest suite.

**Phase B (Week 5-6)**: 每个下游模块加 `READ_FROM` feature flag, shadow-read (两路同时跑, log div). Div=0 连续 3 天才可 flip. 逐模块 flip, 一个一个来.

**Phase C (Week 10+, after v1.2 完)**: 90 天 bake 期, `smart_bi_dynamic_data` 降级 read-only. 写入停.

**Phase D (v2)**: 归档/删除老表.

**每次 flip 前 check**:
```
pytest tests/golden/4169/test_regression.py -v
# 必须所有 30+ 断言数字差 <0.1% 才能 merge
```

---

## 3. Bronze 接入管道 (预留, 待 Section 3 专门写)

5 个 adapter 基类 + Excel 实现 (v1.1) + 美团 API (v1.2) + 评论 (v1.3) + 供应链 (v1.3).

`BronzeAdapter.ingest(source_config) → AsyncIterator[RawEvent]`. Silver.normalizer 消费 iterator, 产 fact/dim 行.

---

## 4. Gold 物化 + Agent 层 (预留, 待 Section 4 专门写)

### 4.1 Gold 扩展

保留 `materialized_analytics/` 85% 现有代码. 改名 `smartbi/gold/`. 新增:
- `agg_daily`, `agg_product`, `agg_channel` durable 表 (schema 在 Section 4 细化)
- `MaterializationTrigger` 接口, 实现: `upload_complete`, `field_registry_reviewed`, `api_append_incremental`
- Freshness version 列 + 读时挑最大 committed

### 4.2 Agent 成本守门 (concrete per audit F5)

```sql
agent_budget_daily (
  factory_id   VARCHAR(50),
  date         DATE,
  tokens_used  BIGINT DEFAULT 0,
  tokens_cap   BIGINT NOT NULL,   -- 基础客户 50K/日, 企业 200K/日
  blocked      BOOLEAN GENERATED AS (tokens_used >= tokens_cap),
  PRIMARY KEY (factory_id, date)
)

narrative_cache (
  factory_id       VARCHAR(50),
  question_hash    VARCHAR(64),   -- SHA256 of normalized question + upload_id
  answer           TEXT,
  chart_config     JSONB,
  tokens           INT,           -- for budget accounting
  created_at       TIMESTAMP,
  expires_at       TIMESTAMP,     -- 24h TTL, 或 upload_complete 失效
  PRIMARY KEY (factory_id, question_hash)
)
```

Agent 每次 call:
1. 先查 `narrative_cache`, 命中 → 直接返回 (0 token)
2. 查 `agent_budget_daily.blocked`, true → 降级返回 "今日 AI 预算已用完, 建议明天再问" + 保存 Q 供管理员分析
3. 组 prompt 只含 Gold agg 摘要, 不带 raw
4. Tool call 最多 3 次, 超过强制 narrative
5. 模型路由: 简单问 → Aliyun free (0 cost) → Zhipu free → DeepSeek paid
6. 累计 tokens_used

### 4.3 AI 建议 Prompt 升级 (goal 5)

当前问题: "提高营业额" → 输出"直接涨价".

升级后 prompt 框架:
```
System: 你是餐饮数据分析师. 用户问 "{Q}". 数据:
- 本月 KPI: 营业额 {X}, 环比 {Y}, 折扣率 {Z}, 客单价 {A}
- Top 3 门店表现: ...
- 同品类对标 (来自 dim / 外部数据): ...
- 成本结构: 食材 {M}%, 人工 {N}%, 租金 {O}%
- 近 N 天趋势: ...

要求:
- 不得输出"直接涨价", "加强营销"等空泛建议
- 每条建议必须指明 (a) 针对哪个具体指标/门店 (b) 预期收益区间 (c) 执行前置条件
- 若数据不足给不出建议, 明说"需要 X 数据才能判断"
```

Prompt + tool 设计将在 Section 5 展开.

---

## 5. 下游模块适配 (预留)

v1.1: 财务报表 / 分析概览 / KPI看板 3 个模块从 Java/JSONB 切换 Silver+Gold.
v1.2: 趋势 / 开票 / 收款 / 进销存 / 销售订单 / 成品库存 / 出货 / 客户管理 / 成本分析 9 个.

每个模块遵守同套 Phase A/B/C/D flip 流程.

---

## 6. Multi-Tenant Enforcement (**新增 per audit F6**)

### 6.1 Row-Level Security

所有 fact/dim 表:
```sql
ALTER TABLE fact_pos_transaction ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON fact_pos_transaction
  USING (factory_id = current_setting('app.factory_id'));

GRANT SELECT, INSERT, UPDATE ON fact_pos_transaction TO smartbi_user;
-- smartbi_user 不是 BYPASSRLS role; 任何 query 缺 app.factory_id setting → 0 行
```

### 6.2 FastAPI Middleware

```python
# smartbi/middleware/tenant_isolation.py
@app.middleware("http")
async def set_tenant_context(request, call_next):
    factory_id = extract_factory_from_jwt(request)  # from Authorization header
    if not factory_id:
        return 401
    async with pool.acquire() as conn:
        await conn.execute(f"SET LOCAL app.factory_id = $1", factory_id)
        request.state.db = conn
        return await call_next(request)
```

### 6.3 asyncpg Pool Adapter

`get_pg_pool()` 包 wrapper: 每次 `acquire()` 返回的 connection 必须已 SET LOCAL `app.factory_id`, 否则抛 `TenantIsolationError`.

### 6.4 Test

`tests/security/test_rls.py`:
- 上传 2 个工厂数据, 登录工厂 A, 跑所有 SELECT 断言不出现工厂 B 的 rows
- 故意漏掉 `WHERE factory_id = ...` 的查询仍只返工厂 A rows (RLS 兜底)
- 故意 SET `app.factory_id = 'hacker_factory'` 无对应数据 → 返 0

---

## 7. Regression & Testing Contract (**新增 per audit S6**)

### 7.1 Golden Dataset

upload 4169 (qhj_order_detail.csv, 200K 行) 为 frozen golden dataset.

`tests/golden/4169/questions.yaml`:
```yaml
- id: q01
  question: "本月总营业额"
  expected_answer_contains: ["3,617.60", "万"]
  expected_chart_type: null
- id: q02
  question: "门店 Top 5 by 营业额"
  expected_ranks:
    - 青花椒大丸百货店
    - 青花椒南方百联店
    - ...
- id: q03
  question: "3月份商品销量情况"
  expected_total: 1024799.12  # verified 真值
  tolerance: 0.001
- id: q04
  question: "5月大丸百货店的饮品销量是多少"
  expected_total: 95990.10
- ... 30-50 个问题
```

`tests/golden/4169/test_regression.py`:
- 跑每个 Q 通过 chat.py → 断言答案命中预期
- 分 2 模式:
  - `MODE=legacy` (smart_bi_dynamic_data 路径)
  - `MODE=silver` (Silver+Gold 路径)
- 两模式结果必须 match 100% (金额 <0.1% 差异) 才算 pass

### 7.2 Shadow Read

Phase B 期间所有下游模块: 运行时两路都跑, 比对, log `shadow_read_divergence`. 连续 3 天 divergence=0 才允许 flag flip.

### 7.3 Load Test (v1.3)

合成 5M-row upload (10 个 qhj-like), 跑完整 Bronze→Silver→Gold 管道. 确认:
- Silver write < 10 min
- Gold materialize < 5 min
- agg_daily query < 200ms
- chat.py P95 < 5s

若 fail → 评估 Iceberg / Trino (按 audit OP-1 caveat).

---

## 8. Open Questions (resolved per audit)

| # | 问题 | 决议 |
|---|---|---|
| OP-1 | PostgreSQL vs Iceberg | PostgreSQL v1.1-v1.3, v1.3 加 5M 合成数据 load test 确认上限 |
| OP-2 | Agent / templates 合并? | 保持分离. templates 产 charts (deterministic), Agent 产 narrative (probabilistic). 合并会让 Agent prompt 塞 ECharts config |
| OP-3 | API push vs poll | Webhook 主, hourly reconciliation poll 兜底 (per store-day, 对账 webhook vs API) |
| OP-4 | field_registry admin UI | 新建 `/smart-bi-admin/fields` 路由, role `factory_super_admin` + sub-perm `smartbi:field_registry:manage` |
| OP-5 | dim_store 关联 | dim_store_alias 专表 (非 JSONB), 可版本化 + confidence + reviewed_by |

---

## 9. Done Criteria v1.1 (6 weeks)

1. ✅ Silver 5 dim + 4 fact + field_registry 建好, 有 RLS, 通过 test_rls.py
2. ✅ upload 4169 迁移到 Silver, golden 30+ 断言全 pass, mode=silver 与 mode=legacy 无 divergence
3. ✅ Gold `agg_daily/product/channel` 物化 + narrative_cache + agent_budget_daily 工作
4. ✅ 3 模块 (财务报表/分析概览/KPI 看板) 从 Java/JSONB 切 Silver, 展示真数据 (qhj 4169 的 POS 衍生)
5. ✅ AI 问答 "3月份销量" 返 1,024,799.12 元 ± 0.1%; "5月大丸饮品" 返 95,990.10 元 ± 0.1% (来自 C1/C2/C3 继承)
6. ✅ 日 LLM 成本 <¥10 (月 ~¥200 的 5% 作缓冲)
7. ✅ 切换过程无任何下游模块 broken (feature flag 守护)

**如果 6 周做不完**: 优先级 1 > 7 > 4 > 2 > 3 > 5 > 6. 丢掉 4 (改保留老路径) 好过丢 1 或 7.
