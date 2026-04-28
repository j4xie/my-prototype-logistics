# 餐饮指数字典 — 勾选清单 (Phase 1 输出, audit-fix v2)

**日期**: 2026-04-28
**目的**: 用户(Steve)对每条指数勾选 [要 / 删 / 合并 / 拆分 / 改名],确认后进 Phase 2 写完整字段。
**总计**: 76 条核心指数 + 子项 (audit 后从 65 主条目 → 76,加 5 个财务比率 + 2 个预算 KPI + 1 个数据可信度 + 1 个店长助手等)
**修订**: 应用 superpowers:code-reviewer 2026-04-28 审计 (Critical 3 / Important 7 / Minor 4)

---

## ⚠ Phase 2 启动前的硬性 Gate

### Gate 1: 12 推断指标公式必须 user 确认 (audit-I4)

下面 12 条标 `[备] 推断` 的指数**没有代码 hardcoded 来源**,我无法从代码反推公式 (反推会变成"行业知识默认",写进 KB 会变成"系统官方说法",有风险):

1. 翻台率 — 餐次÷桌位 vs 用餐人数÷座位 vs 营业时长÷平均用餐时长 (3 种主流定义,差异大)
2. 上座率 — 时点 vs 时段平均
3. 客单价 — 含税 vs 不含税 / 是否扣赠送 / 是否拆套餐
4. 复购率 — 时间窗 7d / 30d / 90d / 365d 差异
5. 新客占比 — "新"的定义 (首单 / 30 天前无消费 / 永远未消费过)
6. 房租占比 — 含 / 不含管理费, 月租 vs 营业额比
7. 三费占比 — 营业 / 管理 / 财务,新会计准则改了
8. 班次效率 — 暂无明确口径
9. 净利率 — 净利润 / 营收,但净利润口径多
10. EBITDA — 国内连锁多用调整后,口径不一
11. 坪效 — 营业额 / 营业面积 vs 总面积 vs 厨房面积
12. 桌型缺口 (前端 SeatOccupancyCard 字段是 demand_count - table_count 但缺口的"需求"算法未反推)

**→ Phase 2 启动前,你需要逐条给出业务公式 (或者授权我用某个行业默认 + 文档里明确标"白垩纪默认采用 XX 定义,客户可联系实施定制")**

### Gate 2: HTML 层级规范 (audit-C2)

KB ingester (`backend/python/food_kb/services/manual_ingester.py:68`) 只按 `<h2>` 和 `<h3>` 切 chunk。 如果 metric 放 h4 → 一个 chunk 会混 4-6 个指数,RAG 答"翻台率怎么算"会取一坨混乱内容。

**Phase 2 HTML 必须遵守**:
- `<h2>` = 子章节级 (1.1 收入与成长, 1.2 成本结构, ..., 6.5 数据治理基础)
- `<h3>` = **每个指数自己一个 h3** (这样 ingester 切出来正好一个指数一个 chunk)
- `<h1>` = 大章 (财务健康 / 客流门店 / ...)
- 章节标题 (如 "1.1 收入与成长") 如果当 chunk 容器,内容只能是分类导航,不能塞具体计算

→ h2 数量从原计划 7 → 实际约 25 (每个 sub-section)。h3 数量 = 76 (每个 metric)。

### Gate 3: 边界声明 — 与现有 §13.4 手册的关系 (audit-C3)

`docs/plans/operation-manual-full.html:4898` 已有 §13.4 财务分析看板 (4 步导航说明)。新字典与它**职责区分**:

| 文档 | 管什么 | 不管什么 |
|---|---|---|
| operation-manual-full.html §13.4 | 怎么打开看板 / 页面操作步骤 / 导航路径 | 指数定义 / 公式 / 解读 |
| **本字典 (新)** | 指数定义 / 公式 / 解读 / 行业基准红线 / 怎么用 | 页面操作 (链接到 §13.4) |

**KB ingester 处理**:
- §13.4 chunk 保留不动
- 字典 chunk 优先级**高于** §13.4 (通过 title_prefix `餐饮指数字典` 让 KB 检索"指数"类问题时优先命中字典)
- 字典每条"入口路径"字段写最简形式 (`智能分析→财务PBI看板→损益表瀑布图`),不复制 §13.4 的步骤

---

## 勾选规则

- `[x]` = 要写完整字段 (默认 `[x]` 表示 Phase 2 会写,不勾就跳过)
- `[ ]` = 跳过 (KB AI 不需要答这个)
- `[?]` = 已 audit 决策,不再保留
- 后面写文字: `merge with: XX`(合并),`split into: A/B`(拆分),`rename: 新名`(改名)

## 字段标注说明 (每条已注好)

- `[源]` = 我从哪扫到的 (代码定位 / 推断标记)
- `[路]` = 客户在系统里的入口
- `[业]` = 业务领域提示 (快餐/正餐/火锅是否适用)
- `[备]` = 我已知的特殊提示 (口径推断难度等)

## 字段方案

- **指数条目** (主体内容): 8 字段 = 含义 / 计算口径 / 解读 / 怎么用 / 行业基准红线 / 示例数值 / 数据来源 / 入口路径
- **方法论条目** (audit-I5 用户选 A): 4 字段简版 = 含义 / 解读 / 怎么用 / 入口路径 (不强求基准红线/示例数值/计算口径,因为方法论不是数值)

---

## 序言专题: Top 10 客户最常问指数 FAQ (audit-M2 默认 [x])

放在字典开篇,客户截图问 "指数看不明白" 直接命中 KB。每条按完整 8 字段写,但额外加一行 "**客户原话怎么问**"。

- [x] **翻台率** — "翻台几次算正常""我们才 2 次是不是很差"
- [x] **食材成本率** — "食材率多少合理""为什么我家比对面高"
- [x] **客单价** — "客单价怎么算的""怎么提高客单价"
- [x] **毛利率 (含菜品 4 象限)** — "哪些菜赚钱""菜品工程是什么"
- [x] **人力成本占比** — "人力占比多少正常""餐饮行业一般多少"
- [x] **充卡依赖度** — "为什么储值占比高是风险"
- [x] **会员 RFM 分层** — "Champions / AtRisk 怎么区分""我应该先抓哪类客户"
- [x] **同店同比 (Temporal Comparison)** — "为什么和去年比要排除新店"
- [x] **AI 洞察 3 分类** — "积极发现 / 风险关注 / 改进建议 哪个最重要"
- [x] **数据可信度评分** — "为什么写'可信度高',怎么算的"

---

## 第 1 章 · 财务健康 (Financial Health)

### 1.1 收入与成长

- [x] **月度收入趋势** — 时间序列折线图,X 月份,Y 金额 [源] FinancialDashboardPBI [路] 智能分析→财务PBI看板
- [x] **同比增长率 (YoY)** — 与去年同期对比 [源] PBI:同环比分析 [路] 同上 [业] 通用
- [x] **环比增长率 (MoM)** — 与上月对比 [源] PBI:同环比分析 [路] 同上
- [x] **同店同比 (Temporal Comparison)** — 仅对老店生效,排除新开店扰动 [源] RestaurantV2:#12 W5.6 [备] 模式标签 modeLabel
- [x] **营收预测** — 基于历史趋势 + 季节性 [源] Card:ForecastCard [路] AI问答→"营收预测"
- [x] **销售计划追踪** — 目标/实际/完成度 三项 [源] Card:SalesPlanCard
- [x] **目标达成进度** — 子弹图(bullet chart) [源] PBI:目标达成进度 + Backend:bullet_chart.py
- [x] **预算达成分析** [源] PBI:预算达成分析 + Backend:budget_achievement.py
- [x] **品类同期对比** [源] PBI:品类同期对比 + Backend:category_yoy.py
- [x] **多维度对比矩阵** [源] PBI:多维度对比矩阵
- [ ] **执行摘要 (Executive Summary)** — 餐饮 V2 看板的总结性摘要 [源] RestaurantV2:#1 [备] 偏导航不是指数,默认跳过

### 1.2 成本结构

- [x] **成本流向桑基图** — 收入 → 各成本科目 → 利润的资金流向 [源] PBI:成本流向桑基图 + Backend:cost_flow_sankey.py
- [x] **食材成本率 / 食材率** — (食材成本 ÷ 营业收入)×100% [源] RestaurantV2 + Card [业] 餐饮核心 [备] 行业基准红线明确(快餐 28-32% / 正餐 30-35% / 火锅 38-42%)
- [x] **人力成本占比** [源] PBI:人力成本分析 + Backend:hr_cost_analysis.py [备] 行业基准 18-25%
- [x] **房租占比** [备] 推断指标,通常 8-15% (Gate 1 待确认)
- [x] **三费占比** (营业费用+管理费用+财务费用) [备] 推断 (Gate 1 待确认)
- [x] **成本刚性 (cost rigidity)** — 衡量成本调整空间,< 0.5 触发 metric-critical 红色 [源] RestaurantV2:financialMetrics.costRigidity [备] 口径需反推
- [x] **BOM 偏差分析** — 主因区分"供应链(采购价)"vs"管理(用量)" [源] Card:BomVarianceCard [备] dominant_factor 字段
- [x] **类目波动 Top 5** — 哪些类目波动最大 [源] RestaurantV2:1775

### 1.3 利润与毛利

- [x] **损益表瀑布图** — 收入到净利的逐项扣减可视化 [源] PBI:损益表瀑布图 + Backend:pnl_waterfall.py
- [x] **毛利率走势** [源] Backend:gross_margin_trend.py
- [x] **渠道毛利率 (Channel Margin)** — 堂食/外卖/外摆 各渠道毛利对比 [源] RestaurantV2:#5
- [x] **渠道分析** [源] PBI:渠道分析 + Backend:channel_analysis.py
- [x] **单店 P&L 一页纸 (Store P&L One Pager)** — 单店损益简表 [源] RestaurantV2:#6
- [x] **净利率** [备] 推断 (Gate 1 待确认)
- [x] **EBITDA** [备] 推断,中大型连锁可能要 (Gate 1 待确认)

### 1.4 现金流

- [x] **现金流趋势** [源] PBI:现金流趋势 + Backend:cashflow_trend.py
- [x] **现金流量瀑布图** [源] PBI:现金流量瀑布图 + Backend:cash_flow_waterfall.py
- [x] **应收账龄** — 0-30 / 31-60 / 61-90 / 90+ 天分桶 [源] Backend:ar_aging.py
- [x] **充卡依赖度** — 储值预收占月度营收比 [源] RestaurantV2:#8 [业] 餐饮特色,警戒 > 30% 高风险 [备] **唯一家在此章** (audit-I3),§4.2 stub 引用

### 1.5 预算与目标

- [x] **KPI 计分卡 (KPI Scorecard)** — 多指标综合评分 [源] Backend:kpi_scorecard.py
- [x] **同环比分析** [源] PBI:同环比分析 + Backend:yoy_mom_comparison.py
- [x] **费用同比预算差异** [源] Backend:expense_yoy_budget.py
- [x] **预算执行差异** [源] Backend:variance_analysis.py

### 1.6 财务比率 (audit-C1 新增)

来自 `backend/python/smartbi/services/industry_benchmark.py:169-260`,已 ship 8 个行业的基准数据,客户问 KB 必须能答。

- [x] **营业利润率** — 营业利润 ÷ 营业收入 [源] industry_benchmark.py [业] 通用
- [x] **存货周转率** — 销售成本 ÷ 平均存货 [源] industry_benchmark.py [业] 餐饮快餐周转高,正餐周转中
- [x] **应收账款周转率** — 营业收入 ÷ 平均应收账款 [源] industry_benchmark.py [业] B2C 餐饮多为现结,周转极高;团餐 / 加盟模式有应收
- [x] **流动比率** — 流动资产 ÷ 流动负债 [源] industry_benchmark.py [备] 健康 1.5-2.0
- [x] **资产负债率** — 总负债 ÷ 总资产 [源] industry_benchmark.py [备] 餐饮重资产 (装修、设备) 影响大

### 1.7 财务分析模块 (FinanceAnalysis 5 tab) (audit-I1 新增)

`web-admin/src/views/smart-bi/FinanceAnalysis.vue:562-572` 5 个 tab,客户在该页直接看到。

- [x] **利润分析 tab** — grossProfitMargin / netProfitMargin 字段 [源] FinanceAnalysis.vue:828-830
- [x] **成本分析 tab** [源] FinanceAnalysis.vue
- [x] **应收 tab** [源] FinanceAnalysis.vue (与 1.4 应收账龄关联)
- [x] **应付 tab** [源] FinanceAnalysis.vue
- [x] **预算分析 tab — 预算使用率 (budgetUsageRate)** [源] FinanceAnalysis.vue:1404
- [x] **预算分析 tab — 预算剩余 (budgetRemaining)** [源] FinanceAnalysis.vue:1424

---

## 第 2 章 · 客流与门店运营

### 2.1 翻台与上座

- [x] **翻台率** — (实际接待桌次 ÷ 桌位总数) [备] 推断 (Gate 1) — 行业红线快餐 4-6 / 正餐 1.5-3 / 火锅 2-3
- [x] **上座率** [备] 推断 (Gate 1)
- [x] **桌位配置分析 / 桌型缺口** — 哪种桌(2 人桌/4 人桌/包间)需求与供给缺口 [源] Card:SeatOccupancyCard [备] 缺口算法待反推 (Gate 1)
- [x] **营业时段热力图** — 周 × 时段二维热力,识别高峰低谷 [源] RestaurantV2:#7 + Card:HeatmapCard

### 2.2 客单与频次

- [x] **客单价** — 营业额 ÷ 客单数 [备] 推断 (Gate 1) — 含/不含套餐拆分定义影响大
- [x] **复购率** — (复购客户 ÷ 总客户) [备] 推断 (Gate 1) — 时间窗待定
- [x] **新客占比** [备] 推断 (Gate 1) — "新"定义待定

### 2.3 班次与时段

- [x] **排班结构分析** — 总人数 / 全职 / 兼职 / 全职占比 [源] Card:ShiftAnalysisCard
- [x] **全职占比建议** — full_time_ratio + benchmark [源] Card:ShiftAnalysisCard
- [x] **班次效率** [备] 推断 (Gate 1)

### 2.4 坪效与人效

- [x] **坪效** — 营业额 ÷ 经营面积 [备] 推断 (Gate 1) — 总面积 vs 营业面积定义
- [x] **人效监控** — 营收 / 人头 ,健康区间 thresholds.low - thresholds.high [源] Card:LaborProductivityCard
- [x] **校准因子 (vs 基准)** — 当前指标 ÷ 行业基准 [源] RestaurantV2 + financialMetrics
- [x] **月度校准历史** — 校准因子的月度变化曲线 [源] RestaurantV2:#14

---

## 第 3 章 · 菜品与产品

### 3.1 菜品工程

- [x] **菜品工程 4 象限 (Kasavana-Smith)** — 销量 × 毛利率 二维分析 [源] Card:MenuQuadrantCard
  - 子项: Star · Cash Cow · Puzzle · Dog 四象限解读

### 3.2 套餐与产品结构

- [x] **套餐拆单统计** — 套餐内单品销售拆解 [源] Card:ComboSplitCard
- [x] **产品结构** [源] PBI:产品结构 + Backend:category_structure.py
- [x] **产品排名** [源] Backend:product_ranking.py
- [x] **长尾 SKU 识别** — 销量极低 SKU,建议下架数 [源] RestaurantV2:#9

### 3.3 退货与异常

- [x] **退货异常检测** — 异常 SKU + 退货率 [源] Card:ReturnAnomalyCard
- [x] **退货率 (return_pct)** — (退货数 ÷ 销售数)×100% [源] Card:ReturnAnomalyCard

### 3.4 销售计划与补货

- [x] **智能叫货单** — 安全系数 + 提前期 + 待下单食材数 [源] Card:SmartReorderCard
- [x] **采购预测** — 预测 N 天 + 总营收 + 总客数 [源] Card:ProcurementForecastCard
- [x] **日清日结** — 食材容差 ±N% [源] Card:DailyReconciliationCard [业] 餐饮特色

---

## 第 4 章 · 客户与会员

### 4.1 RFM 分析

- [x] **会员 RFM 分层** — Recency / Frequency / Monetary 三维度分群 [源] RestaurantV2:#11 + Card:RfmGridCard
  - 子项: Champions · Loyal · Potential · AtRisk · Hibernating · Lost 6 个分群

### 4.2 储值与充卡

- [ ] ~~充卡依赖度~~ — **已锁定 §1.4 现金流为唯一家** (audit-I3)。本章不重复入条目,但在 Phase 2 HTML 加一个 stub h3 "见 §1.4 充卡依赖度",防止客户从"会员"角度搜不到。

### 4.3 评论分析

- [x] **大众点评分析** — 评论数 + 平均星级 + 评分趋势 [源] RestaurantV2:#10 W4.5
- [x] **评论竞品分析** — 自家 vs 同区域同价位竞品 [源] Card:ReviewCompetitiveCard
- [x] **评论数据管理** — 评论收集状态/覆盖率 [源] RestaurantV2:#16

---

## 第 5 章 · 跨门店对比

### 5.1 门店 KPI

- [x] **店长 KPI 三维度健康度** — 三个维度雷达 + 预警 [源] Card:StoreKpiDashboardCard

### 5.2 跨连锁/跨门店对标

- [x] **跨连锁对标** [源] Card:CrossChainCard
- [x] **多门店对比** — N 家门店核心指标对比 [源] RestaurantV2:#13

### 5.3 行业对标

- [x] **指标对标预警** — 当前值 vs 行业中位数,超阈值告警 [源] Card:BenchmarkBarsCard
- [x] **对标预警 (Benchmark Alerts)** [源] RestaurantV2:#4

### 5.4 加盟主表现

- [x] **绩效 KPI 评估** — 综合得分(/100) + 等级 [源] Card:PerformanceEvalCard
- [x] **计件提成计算** — 岗位数 + 总发放金额 [源] Card:PieceworkCalcCard

---

## 第 6 章 · 智能数据分析方法论 (4 字段简版)

> **方法论条目** (audit-I5 用户选 A) 用 4 字段 = **含义 / 解读 / 怎么用 / 入口**,不强求计算口径 / 行业基准红线 / 示例数值 (因为方法论不是数值指标)。

### 6.1 自动图表分组规则

- [x] **图表自动分组 6 类规则** [源] SmartBIAnalysis.vue CHART_GROUP_RULES — 收入与销售 / 成本与费用 / 利润与效率 / 趋势与时间 / 分布与占比 / 排名与对比

### 6.2 AI 洞察分类

- [x] **AI 洞察 3 分类** — 积极发现 / 风险关注 / 改进建议 [源] SmartBIAnalysis.vue 1064-1066

### 6.3 异常值检测

- [x] **2σ 异常检测算法** — 离群值阈值定义,2 倍标准差以外标记 [源] SmartBIAnalysis:detectAnomalies

### 6.4 诊断与处方

- [x] **诊断引擎 (Diagnostics)** [源] RestaurantV2:#3
- [x] **处方建议 (Rx)** — 诊断指标 + 推荐 action [源] Card:RxPrescriptionCard

### 6.5 数据治理基础

- [x] **数据可信度评分 (Confidence Score)** (audit-I2 新增) — 数据完整度 / 字段覆盖 / 行数充足度 综合 0-100 评分 [源] backend/python/smartbi/services/confidence_calculator.py:55-143 [备] 客户在 AI 回复看到"数据可信度高"会问怎么算
- [x] **BOM 精度层级 (BOM Layer Status)** [源] RestaurantV2:#15
- [x] **命名归一 (Menu Normalization)** [源] RestaurantV2:#17

---

## 附录 A · 模块入口对照表

| 客户问的模块 | 系统入口 | 主要看哪几章 |
|---|---|---|
| 财务 PBI 看板 | `/smart-bi/financial-dashboard` | 第 1 章 (1.1-1.7) |
| 智能数据分析 | `/smart-bi/analysis`(上传 Excel) | 第 6 章 + 各分析视角 |
| 餐饮 V2 看板 | `/smart-bi/restaurant-v2` | 第 2-5 章 |
| AI 问答 | `/smart-bi/query` | 全部章节 |
| 财务分析模块 (5 tab) | `/smart-bi/finance-analysis` | 第 1.7 节 |

---

## Phase 3 准备 — `_QUERY_EXPANSIONS` 关键词清单 (audit-I6)

`backend/python/food_kb/api/manual_chat.py:34-51` 的 `_QUERY_EXPANSIONS` dict 需追加以下条目,提升餐饮指数检索精度:

```python
_QUERY_EXPANSIONS_RESTAURANT_PATCH = {
    # 客流
    "翻台率": "翻台率 翻台 turn over 桌次 接待 翻桌",
    "上座率": "上座率 上座 occupancy 满桌",
    "坪效": "坪效 平效 平均面积 营业额面积",
    "客单价": "客单价 人均 ARPU 单客 average check",
    "复购率": "复购率 复购 重复消费 retention",
    # 财务
    "毛利率": "毛利率 毛利 gross margin 毛利润",
    "食材率": "食材率 食材成本率 cost of goods 原料率",
    "人力成本": "人力成本 工资率 人工率 labor cost",
    "充卡": "充卡 储值 储值卡 预收 预付",
    "成本刚性": "成本刚性 cost rigidity 调整空间",
    "桑基图": "桑基图 sankey 资金流 成本流向",
    # 比率
    "周转率": "周转率 turnover 流转",
    "存货周转": "存货周转 库存周转 inventory turnover",
    "流动比率": "流动比率 short term liquidity 偿债能力",
    "资产负债率": "资产负债率 leverage 杠杆率",
    # 菜品
    "4 象限": "4 象限 四象限 Kasavana Smith 菜品工程",
    "Kasavana": "Kasavana Smith 菜品工程 4 象限",
    "菜品工程": "菜品工程 menu engineering Kasavana",
    "Star": "Star 招牌菜 明星菜 高利高销",
    "Cash Cow": "Cash Cow 走量 引流款 高销低利",
    "Puzzle": "Puzzle 高利无人点 低销高利",
    "Dog": "Dog 淘汰 低销低利",
    # 会员
    "RFM": "RFM Recency Frequency Monetary 会员分层",
    "Champions": "Champions 冠军客户 RFM 高 R 高 F 高 M",
    # 方法论
    "校准因子": "校准因子 calibration factor 基准修正",
    "可信度": "可信度 confidence score 数据完整度",
    "AI 洞察": "AI 洞察 insights 积极发现 风险关注 改进建议",
    "异常值": "异常值 anomaly outlier 2σ 离群",
    # 看板
    "PBI": "PBI 财务PBI 财务看板 financial dashboard",
    "看板": "看板 dashboard 仪表盘",
    "指数": "指数 指标 KPI 数据 metrics",
    "红线": "红线 警戒 阈值 threshold benchmark",
    "基准": "基准 benchmark 标准 行业平均",
    # 行业
    "正餐": "正餐 中餐 西餐 fine dining 堂食",
    "快餐": "快餐 fast food 茶饮 饮品",
    "火锅": "火锅 烧烤 自助",
}
```

---

## 总数统计 (audit-fix v2)

| 章节 | 主条目 | 与 v1 差异 | 备注 |
|---|---|---|---|
| 1 财务健康 | 35 | +9 (新增 §1.6 5 条 + §1.7 6 条 - 1 个 stub) | 含 1.1-1.7 |
| 2 客流门店 | 13 | 同 v1 | 部分推断 (12 个 [备] 推断) |
| 3 菜品产品 | 8 | 同 v1 | |
| 4 客户会员 | 4 | -1 (充卡依赖度迁出) | RFM 单条 6 子分群 |
| 5 跨门店 | 6 | 同 v1 | |
| 6 方法论 | 9 | +1 (数据可信度) | **4 字段简版** |
| **合计** | **75 主条目 + Top 10 FAQ + 6 RFM 分群 + 4 象限 = 95** | +10 vs v1 | |

---

## Phase 2 启动前剩余 user 决策 (压缩版)

1. **Gate 1 — 12 推断指标公式**: 你给业务公式 / 还是授权我用行业默认 + 标"白垩纪默认采用 XX 定义"?
2. **行业版本** (从 v1 沿用未决): 行业基准红线写哪个版本?
   - A. 正餐(中餐/西餐) - 客户主流
   - B. 快餐 / 茶饮
   - C. 火锅 / 烧烤
   - D. 多版本对照(每条红线列三标准,字数翻倍)
3. **逐条最终勾选**: 上面 75 条主条目默认全 `[x]`,你扫一遍把不要的改 `[ ]`

---

## Phase 2 内部 (不需 user 决策, 留 note)

- **M1 入口路径精简**: Phase 2 HTML 用 `智能分析→餐饮V2→#7` 短格式,不复制 §13.4 详细步骤
- **M3 staleness 检测**: Phase 2 加 `scripts/check-metrics-glossary-coverage.sh` — 比对 `cards/*.vue` 数量 vs 字典条目数,CI fail loud 防漂移
- **M4 writing-plans skill**: Phase 2 是 4-5 文件编辑跨 2 service,如确认跨 session 执行,启动前 invoke `superpowers:writing-plans` 生成正式 plan

---

## 修订历史

- **v1** (2026-04-28 first): brainstorming 4 决策完成 (B/C/C/A), 65 主条目
- **v2** (2026-04-28 audit-fix): 应用 superpowers:code-reviewer audit
  - **Critical**: C1 加 §1.6 财务比率 5 条 / C2 锁 HTML h-level 规范 / C3 加边界声明
  - **Important**: I1 加 §1.7 FinanceAnalysis 6 条 / I2 加 数据可信度 / I3 锁充卡依赖度 §1.4 唯一家 / I4 顶部加 Gate 1 / I5 6 章用户选 A 4 字段简版 / I6 枚举 _QUERY_EXPANSIONS 清单 / I7 写 design-notes 留档 (separate file)
  - **Minor**: M1/M3/M4 留 Phase 2 note / M2 Top 10 FAQ 默认 [x]
