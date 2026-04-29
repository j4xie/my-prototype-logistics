# 餐饮指数字典 — Design Notes (跨 session 续接用)

**日期**: 2026-04-28
**目的**: 留档本项目的关键设计决策,防止 Phase 2 在新 session 启动时丢上下文 (audit-I7 推荐)。
**主体清单**: `docs/plans/2026-04-28-restaurant-metrics-glossary-checklist.md`

---

## 客户驱动力 (Why)

2026-04-28 客户截图: 餐饮店主"edc"通过微信 @Steve 要求今天屏幕共享培训 **财务PBI看板** + **智能数据分析** 两个模块, 原话 **"这 2 个模块, 我有些指数看不明白"**。

**Steve 的判断**: 这种"指数解读"问题应该让 KB AI 能直接回答,不应该每次都让人去做屏幕共享培训。整个项目本质 = 把客户问的指数定义化 + 让现有的 `food_kb` RAG 能命中。

---

## 系统现状 (What 已存在)

### KB AI 实现位置

- `backend/python/food_kb/services/manual_ingester.py` — Ingester (按 `<h2>/<h3>` 切 chunk 入向量库, line 68)
- `backend/python/food_kb/api/manual_chat.py` — Chat 端点 (line 34-51 有 `_QUERY_EXPANSIONS` query 扩展 dict, 当前 0 条餐饮关键词)
- 已 ingest 的源: `docs/plans/operation-manual-full.html` (7236 行, 工厂语境为主) + 几个 markdown

### 操作指南现状

- `web-admin/public/operation-manual.html` ≡ `docs/plans/operation-manual-full.html` (相同内容)
- §13 SmartBI 章节: 6 节笼统页面操作 (无指数定义)
- §13.4 财务分析看板: 4 步导航说明 (line 4898)
- **餐饮场景内容近乎为零** (整个文档 1 处提到"汇庭餐饮"在测试数据示例)

### 餐饮代码资产

- `web-admin/src/views/smart-bi/RestaurantV2Dashboard.vue` (2318 行, 17 个 section)
- `web-admin/src/views/smart-bi/FinancialDashboardPBI.vue` (3126 行, 12 chart types)
- `web-admin/src/views/smart-bi/FinanceAnalysis.vue` (2948 行, 5 tab)
- `web-admin/src/views/smart-bi/SmartBIAnalysis.vue` (4218 行, 6 chart group rules + 3 AI insight cats)
- `web-admin/src/views/smart-bi/components/chat/cards/*.vue` 22 个餐饮专属 cards
- `backend/python/smartbi/services/financial/*.py` 16 个财务 KPI 计算器
- `backend/python/smartbi/services/industry_benchmark.py:169-260` 8 行业 5 种比率基准
- `backend/python/smartbi/services/confidence_calculator.py:55-143` 数据可信度评分 0-100

---

## 4 个关键设计决策 (Brainstorming)

### Q1 范围 — 用户选 B

> "餐饮全模块指数字典 — 扩展到所有餐饮场景看到的指数 (含 RestaurantV2Dashboard、餐饮 chat cards、销售分析、客户 RFM 等),量大约 80-120 个。一劳永逸。"

排除:
- A 紧贴客户问题 (只 2 模块, 30-50 条) — 太窄
- C 客户问什么答什么 (被动) — KB 留盲区

### Q2 字段深度 — 用户选 C

每条指数 **8 字段**:
1. 含义
2. 计算口径
3. 解读
4. 怎么用
5. **行业基准红线** (用户特别要)
6. **示例数值** (用户特别要)
7. 数据来源
8. 入口路径

排除:
- A 6 字段标准
- B 4 字段轻量
- D 8 字段含 ⚠ 待确认 (其实和 C 后来融合)

约 400 字/条, ~75 条 = 3 万字。

### Q3 计算口径策略 — 用户选 C

- **简单口径** (销售额/毛利率/客单价): 我从代码反推, 不标 ⚠
- **复杂口径** (校准因子/4 象限切分线/RFM 阈值/异常检测): 标 `⚠ 待确认`,留 user 填

**重要**: audit-I4 后,12 个推断指标 (无代码 hardcoded 的, 如翻台率/坪效/客单价/复购率) 单独划入 **Gate 1**,Phase 2 启动前必须 user 给业务公式或明确授权"白垩纪默认采用 XX 定义"。

### Q4 落地节奏 — 用户选 A

- A 直接开 Phase 1 ✅ (放弃 D 写正式 spec doc)
- 三阶段:
  - **Phase 1**: 扫码 → 出 markdown 勾选清单 (本次完成 + audit-fix 应用)
  - **Phase 2**: 用户勾选 → 写 HTML 8 字段 → 注册 ingester → 跑 ingest
  - **Phase 3**: KB 集成 + 5-10 客户原话验证

---

## Audit 应用 (2026-04-28 superpowers:code-reviewer)

### Critical (3) — 全部应用

- **C1**: §1.6 加 5 个财务比率 (来自 `industry_benchmark.py`)
- **C2**: HTML 层级锁定 — chapter→h1, sub→h2, **每个 metric 一个 h3** (避免一个 chunk 混 6 个指数)
- **C3**: 字典 vs 现有 §13.4 边界声明 — manual 管"怎么打开",字典管"指数解读"

### Important (7) — 全部应用

- **I1**: §1.7 加 FinanceAnalysis 5 tab + budgetUsageRate / budgetRemaining
- **I2**: §6.5 加 数据可信度评分 (Confidence Score)
- **I3**: 充卡依赖度 锁定 §1.4 现金流为唯一家,§4.2 stub 引用
- **I4**: 文件顶部加 Gate 1 — 12 推断指标 user 决策门
- **I5**: 第 6 章 方法论用 4 字段简版 (用户选 A) — 含义/解读/怎么用/入口
- **I6**: Phase 3 章节直接枚举 `_QUERY_EXPANSIONS` 餐饮关键词补丁 (~30 词)
- **I7**: 本文件就是 I7 应用

### Minor (4) — Phase 2 内部处理

- **M1**: 入口路径用短格式 `智能分析→餐饮V2→#7`
- **M2**: Top 10 FAQ 默认全 `[x]`
- **M3**: 加 staleness 检测脚本 (Phase 2)
- **M4**: 跨 session 时 invoke `superpowers:writing-plans` (Phase 2 启动判断)

---

## Phase 2 文件清单 (待改)

```
docs/plans/restaurant-metrics-glossary.html     ← 新建主交付物
docs/plans/2026-04-28-restaurant-metrics-glossary-checklist.md  ← 用户勾选完后归档
backend/python/food_kb/services/manual_ingester.py:22-47  ← MANUAL_SOURCES 加新源
backend/python/food_kb/api/manual_chat.py:34-51  ← _QUERY_EXPANSIONS 追加 ~30 词
scripts/check-metrics-glossary-coverage.sh  ← 新建 staleness 检测 (M3)
```

---

## Phase 2 启动 prerequisites

1. ✅ Phase 1 checklist v2 已应用 audit fix
2. ✅ Design notes 留档 (本文件)
3. ⬜ 用户回应 Gate 1 (12 推断指标公式策略)
4. ⬜ 用户决定行业版本 (A 正餐 / B 快餐 / C 火锅 / D 多版本对照)
5. ⬜ 用户逐条勾选 (默认全 `[x]`,扫一遍标 `[ ]` 不要的)
6. ⬜ 决定是否需要正式 invoke `superpowers:writing-plans` (Phase 2 跨 session 时建议)

---

## 跨 session 续接 hint

如果 Phase 2 在新 session 启动:

1. 先 Read 本文件 (`design-notes`) 恢复 4 决策 + audit 应用上下文
2. Read `2026-04-28-restaurant-metrics-glossary-checklist.md` 作为 spec
3. 检查用户对 Gate 1 / 行业版本 / 逐条勾选的回应是否到位
4. 如果到位 → 直接进 Phase 2 写 `restaurant-metrics-glossary.html`
5. 如果未到位 → 提醒用户先回应 prerequisites 3-5
