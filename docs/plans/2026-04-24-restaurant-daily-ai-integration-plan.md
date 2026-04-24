# 餐饮日常 4 页 × AI 功能集成方案

**问题**: 新加的 AnalyticsStrip (领料/损耗/配方/盘点) 能否和 AI 问答、查询模板、持久化数据分析 (Gold) 串联?

**答案**: 可以, 分 **3 个层次** (由浅到深):

---

## 当前状态 (现状)

AI 系统目前知道的"数据":
- ✅ xlsx 上传数据 (smart_bi_dynamic_data 表) — POS 账单/商品销量等
- ✅ Gold 数据层 (agg_daily / agg_store / agg_channel / agg_discount)
- ✅ Silver (fact_pos_bill / fact_pos_payment / fact_pos_discount / dim_store / dim_product)
- ❌ **cretas_db.* 的餐饮日常表** (material_requisitions / wastage / recipes / stocktaking)

所以用户在 /smart-bi/query (AI 问答) 问:
- ✅ "上个月销售额多少" → 命中 fact_pos_bill 模板
- ❌ "上周损耗最多的食材是什么" → LLM fallback (无模板, 也不知道这个数据)

---

## 方案 A: 每页"AI 分析"按钮 (最快, 0.5 天)

### 做什么
在 4 页的 header 加一个"🤖 AI 分析"按钮, 点击后跳转到 /smart-bi/query 并预填关键问题:
- 领料管理 → "分析最近7天领料趋势, Top 5 食材和异常"
- 损耗管理 → "分析损耗金额趋势 + Top 5 损耗类型 + 同比"
- 配方管理 → "Top 10 高成本菜品 + 平均食材种类"
- 盘点管理 → "近期盘亏金额 + 最频繁盘亏的食材"

LLM 会自动调用 existing 数据 + GPT 推理. 不需要改 backend.

### 优点
- ✅ 半天可上线
- ✅ 不需要 ETL / schema 改动
- ✅ 对用户是 "一键求解" UX

### 缺点
- ❌ LLM 没有 restaurant/* 表的 context, 只能基于页面已显示数据做分析 (需要把 tableData 传给 LLM)
- ❌ 无 materialized_cache, 每次都是 LLM fallback (~10s + $0.03)

---

## 方案 B: 新增 4 个查询模板 (中期, 2-3 天)

### 做什么
在 `backend/python/smartbi/services/materialized_analytics/templates/` 加 4 个新模板:
- `restaurant_requisition_trend.py` — 按日汇总领料金额/频次
- `restaurant_wastage_analysis.py` — 损耗率 / TOP N 类型 / 成本占比
- `restaurant_recipe_cost.py` — 配方 BOM × 食材单价 = 菜品成本
- `restaurant_stocktaking_variance.py` — 盘点差异 / 周期分析

每个模板:
- `applies()`: 检测 query 意图 (关键词 + RAG embedding)
- `compute()`: SQL 读 `cretas_db.{material_requisitions, ...}` (需加跨库 DSN) → 返回 DataFrame
- `to_chart_config()`: ECharts 格式
- `sample_queries`: 10 个自然语言示例, 供 RAG 检索

Template 注册后:
- `/smart-bi/query` "最近7天损耗趋势" → 命中模板 → <0.5s 返回 + materialized_cache
- Dashboard / 4 页新增"模板卡" 显示最新结果
- 用户能 👍/👎 反馈 (已在 commit `ded7a8509` 开启模板反馈)

### 优点
- ✅ 快速命中 (不走 LLM)
- ✅ 可缓存 (materialized_cache 5-minute TTL)
- ✅ 可扩展: 用户 📍领料-异常预警, 📍配方-成本优化 等未来功能都走模板

### 缺点
- ❌ 需要定义 sample_queries + embed 每个模板的语义
- ❌ cretas_db 跨库读需加连接配置 (目前 templates 只读 smartbi_db)

---

## 方案 C: ETL 进 Silver/Gold (长期, 1 周)

### 做什么
仿现有 fact_pos_bill pipeline, 把 restaurant/* 表 ETL 到:

```
Bronze: cretas_db.material_requisitions (现有, 原始)
  ↓ (daily ETL job)
Silver: smartbi_db.fact_restaurant_requisition (标准化 + dim_ingredient 引用)
  ↓ (nightly aggregation)
Gold: smartbi_db.agg_restaurant_daily_ops {date, factory, kpi_kind, value}
```

然后:
- 所有模板可通过 Gold 读, 不跨库
- 可做**跨模块分析** (领料成本 × 销售额 = 食材成本率, 现有 POS Gold + 新 Ops Gold join)
- 支持历史趋势 (全年 / 同比环比)
- 可接入 AI agent budget / narrative cache (Week 5 agent 层)

### 优点
- ✅ 根本解决数据孤岛
- ✅ 和 POS Gold 统一成本分析 (目前 Silver 无 cost/profit — 正好填空)
- ✅ 支撑 v2.1 accounting_import 计划里的 `fact_cost_line` (之前 drop 是因为没数据源, 现在日常表就是天然数据源)

### 缺点
- ❌ 1 周工作量
- ❌ ETL job 需要 schedule + monitoring
- ❌ 改动 smartbi_db schema

---

## 推荐路径

**Step 1 (本 session, 0.5 天)**: 做方案 A — 4 页加 "🤖 AI 分析" 按钮, 跳转 AIQuery 预填 prompt. **零 backend 改动**. 快速给用户 ROI 感受.

**Step 2 (下 session, 2-3 天)**: 做方案 B — 新增 4 模板. 验证用户对这 4 模板的 👍/👎 反馈率 (复用 commit `ded7a8509` 的 template feedback 表). 反馈高 → 继续 Step 3.

**Step 3 (下 sprint, 1 周)**: 做方案 C — 仅当 Step 2 证明有强需求 (Top 模板反馈 ≥ 60%👍) 才投入 ETL. 否则停留在 B 已经能解决 80% 的分析需求.

---

## 其它"持久化分析"可串联点

除了 AI 问答, 4 页数据还可串:

| 现有功能 | 串联方式 |
|---------|---------|
| **经营驾驶舱** (Dashboard.vue) | 增加"餐饮日常"标签页, 显示 4 页汇总 KPI + 趋势 |
| **菜品四象限** | 现在仅基于销量/收入. 加入**食材成本** (从配方 × 单价) → BCG 分类更准确 (不是只看销量, 而是看"销量 × 毛利") |
| **门店对比** | 加"各店损耗率"列 — 直接揭示哪家门店浪费食材最多 |
| **AI 意图配置** (/system/ai-intents) | 新增 `RESTAURANT_WASTAGE_TOP` / `RESTAURANT_INGREDIENT_COST` 意图 → 自动路由到模板 B |
| **Skill/Tool治理** | 新增 `restaurant_daily_analysis` tool (AbstractBusinessTool) → AI Agent 可调用 |
| **异常预警** (/analytics/alert-dashboard) | 订阅"损耗率 > 5%"、"盘亏金额 > 1000" 等阈值 → 推送告警 |

---

## 本 session 要做什么?

**建议**: 先做方案 A (0.5 天), 上线"🤖 AI 分析"按钮. 然后等用户实际使用反馈再决定 B/C.

Scope:
1. AnalyticsStrip.vue 顶部 header 加 slot `ai-cta`
2. 4 页各定义自己的 AI 分析 prompt (领料用领料 prompt, 损耗用损耗 prompt 等)
3. 按钮点击 → router.push('/smart-bi/query') with initial prompt query param
4. AIQuery.vue 接收 query param → 自动填入 inputQuery + 触发 send

确认方向后即可开工.
