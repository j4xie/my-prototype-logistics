# Dashboard (经营驾驶舱) Real-Window Audit

**Date:** 2026-04-24T18:01:41.223Z
**URL:** https://admin.cretaceousfuture.com/smart-bi/dashboard
**Factory:** RES_3101_009

## Observations

- Initial render: 5.503s. Screenshot: tests\e2e-comprehensive\results\page-audit\dashboard-initial.png
- '暂无数据' / '暂无' leaf occurrences: 2 (sample: 暂无图表 | 暂无图表)
- KPI/card titles found (25): 本月销售额 | 客单价 | 订单数量 | 门店数 | 暂无图表 | 暂无图表 | 时间趋势 | 峰值 | 峰值日期 | 期数 | troughValue | 维度 Top N | 维度数 | Top 项 | Top 值 | Top 占比(%) | 分类分布 | Top 项 | Top 占比(%) | 分类数 | 异常检测 | 最大值 | 最小值 | 标准差 | 均值
- KPI values found (23): 2064万 | 2064万 | 146.9 | 146.9 | 14.1万 | 14.1万 | 8 | 8 | ¥6,107.50 | 2025-07-07 | 14 | 911.50 | 4 | 上海市 | ¥5.80万 | 93.10 | 上海市 | 93.10 | 2 | 5 | 0.50 | 0.47 | 4.83
- Chart canvas/svg count: 3
- Has date-range picker.
- Date shortcuts: 本月 | 本年 | 近 12 个月 | 近 24 个月 | 2025 全年 | 2024 全年
- After-interaction screenshot: tests\e2e-comprehensive\results\page-audit\dashboard-after.png
- Main content text (first 4000 chars): 智能BI/经营驾驶舱/qhj_prod工厂总监经营驾驶舱智能数据分析 · 业务经营一站式洞察🌙刷新数据AI 问答Gold 预览 数据源 系统数据 时间范围 至本月无数据 · 显示 2025全年系统数据不完整 切换到上传数据 上传新数据 本月暂无销售数据,已自动显示 2025全年 的历史数据。如需查看其他区间,请使用上方时间范围选择器。 本月销售额2064万客单价146.9订单数量14.1万门店数8销售趋势暂无图表数据正在分析中，图表即将生成...产品类别占比暂无图表数据正在分析中，图表即将生成...AI 智能洞察 AI 分析首次运行需 5-10 秒 (大模型冷启动)...快捷问答 本月销售额如何? 哪个部门业绩最好? 利润率变化趋势如何? 客户增长情况怎样?📊模板分析AI 自动为本次上传生成的 4 项分析 刷新 时间趋势峰值¥6,107.50峰值日期2025-07-07期数14troughValue911.50星级分 累计 6.23万 元,峰值 2025-07-07 (6,108 元),谷值 2025-09-29 (912 元)。按周聚合,共 14 个周期。📎 2026/4/24维度 Top N维度数4Top 项上海市Top 值¥5.80万Top 占比(%)93.10省份 Top 2:上海市 独占 93.1%,其余门店之间差距不大。📎 2026/4/24分类分布Top 项上海市Top 占比(%)93.10分类数2按 省份 分类占比:Top 1 上海市 占 93.1%,共 2 个分类。📎 2026/4/24异常检测最大值5最小值0.50标准差0.47均值4.83星级分 均值 4.83,标准差 0.47;±2.0σ 外异常 50 条 (区间 0.50 ~ 5.00)。📎 2026/4/24
- Gold KPI keywords: [{"k":"销售额","found":true},{"k":"订单数量","found":true},{"k":"客单价","found":true},{"k":"门店数","found":true}]
- Date shortcut keywords: [{"k":"本月","found":true},{"k":"本年","found":true},{"k":"近12月","found":false},{"k":"近24月","found":false},{"k":"2025","found":true},{"k":"2024","found":true}]
- Console errors: 0
- Network 4xx/5xx on /api: 0

## Console errors (full)

```

```

## Network failures (full)

```

```

## Customer-perspective findings (analysis)

### Page identity clarification

**Important**: The task title said "Dashboard (经营驾驶舱)" but the prod URL `/dashboard` is the simple **首页 (Home)** with restaurant-simple KPIs (今日领料单/待审批/本月损耗/最近盘点). The actual **经营驾驶舱** is at `/smart-bi/dashboard` (router `SmartBIDashboard`). This audit covers `/smart-bi/dashboard`.

If the customer expects "经营驾驶舱" by clicking the sidebar item under 智能分析 → 经营驾驶舱, they DO land on the audited URL. The simple `/dashboard` 首页 is the post-login landing page (showed in earlier screenshot during URL discovery).

### What works ✅

- **Apr 23 commit `b1cf06fd8` Gold KPI flip is LIVE**: Top strip shows 本月销售额 2064万 / 客单价 146.9 / 订单数量 14.1万 / 门店数 8 — matches Gold-backed numbers from `/api/smartbi/gold/finance-summary` (consistent with MEMORY: ¥20.64M / 140,541 bills / ¥146.84 / 8 stores for qhj_prod 2025).
- **Date-range picker shortcuts present**: 本月 | 本年 | 近 12 个月 | 近 24 个月 | 2025 全年 | 2024 全年 — all 6 shortcuts from commit `b1cf06fd8` rendered correctly.
- **Fallback chain banner working** (Apr 24 commit `fe4639a66` / P0-5 from `a37f57c78`): orange info banner reads "本月暂无销售数据,已自动显示 2025全年 的历史数据。如需查看其他区间,请使用上方时间范围选择器。" — graceful, transparent, actionable. No more silent test-data swap.
- **Week 6 TemplateGrid (4 templates) rendering Gold data**: 时间趋势 (¥6,107.50 peak / 14 periods) | 维度 Top N (上海市 93.10%) | 分类分布 (Top 1 上海市) | 异常检测 (50 anomalies, mean 4.83). Templates are real Gold-backed analytics with date attribution (📎 2026/4/24).
- **Console errors: 0**, **Network 4xx/5xx on /api: 0**. Page is technically clean.
- **Initial render: 5.5s** (acceptable for prod first paint of a complex dashboard with multiple Gold queries + LLM async).
- **AI fallback message clear**: "AI 分析首次运行需 5-10 秒 (大模型冷启动)..." (Apr 24 P7 from `5088ed7de`). Sets expectations.
- **Sidebar Gold flip badge (Gold 预览) exists**: "Gold 预览" button in top right (changed to `type=info` per Apr 24 commit `88583da0a` P2-15). Visual coherence with refresh / AI 问答 button group.

### What's broken ❌ (P0/P1)

- **P1: 销售趋势 chart shows "暂无图表 — 数据正在分析中,图表即将生成..." even with 2064万 销售 in Gold strip**. The Gold KPI strip has data but the dual-axis 营收/订单数 trend chart is empty. This is a **glaring visual contradiction** — "本月销售额 2064万" right above an empty 销售趋势 chart with placeholder. Customer-facing logic break.
- **P1: 产品类别占比 chart also "暂无图表 — 数据正在分析中,图表即将生成..."**. Same problem — Gold has product/store data (top product list works in templates below), but the dedicated category pie is empty.
  - Both charts show identical placeholder text → suggests a shared upstream call (likely the legacy Python `GET /api/smartbi/excel/.../analysis` or similar) that has not yet completed, OR has returned empty for the current period (本月). Since the page has already auto-fallen-back to 2025全年 for KPIs, the **chart fallback chain is missing** — fallback is only applied to KPI strip, not to chart calls.

### What's confusing 🟡 (P2)

- **AI 智能洞察 area is empty / minimal** (only sees the cold-start hint: "AI 分析首次运行需 5-10 秒"). After 5+ seconds of waiting, no insight content appeared in the captured screenshot. Either the LLM call hasn't completed, OR it stalled. For a dashboard called "经营驾驶舱" the AI insights are the headline value; an empty zone after page load reduces perceived value.
- **快捷问答 chips render but list is generic placeholder** ("本月销售额如何? / 哪个部门业绩最好? / 利润率变化趋势如何? / 客户增长情况怎样?") — note "哪个部门" and "客户增长" are **manufacturing/HR vocabulary** for a restaurant tenant. Should be replaced with restaurant-specific prompts (per Apr 24 RAG polish session — mentioned in MEMORY for AIQuery, may not have been ported to Dashboard快捷问答).
- **"系统数据不完整 切换到上传数据" link visible** in info banner. For a customer who already uploaded data and just wants to see KPIs, this CTA can be confusing (they might think "I did upload, why does it say incomplete?"). Consider rewording to "查看数据完整度" or hiding when KPI strip already shows non-zero values.
- **Template card 时间趋势 sub-stat shows `troughValue: 911.50`** (raw English key, not localized like 峰值/峰值日期/期数 above). Visual inconsistency — that label leaked from JSON without translation.
- **Date-range "时间范围 至本月" wording slightly off**: the period selector shows "至本月" without a clear "from" anchor. Users may need a visible "since 2025-01-01" or similar.

### Apr 24 finding "暂无数据 5 次" — reproduces?

- **No (different form)**. Strict "暂无" leaf occurrences = **2** (both = "暂无图表" placeholder text in the empty 销售趋势 and 产品类别占比 charts).
- The Apr 24 finding referenced in MEMORY noted "暂无数据 5 次" was the qhj 当月-no-data correct empty state. Today's run shows the **fallback banner now correctly hides 暂无 wording** for KPI cards (replaced with 2025 全年 fallback values), so the count dropped from 5 to 2. The remaining 2 are the chart placeholders (P1 above) — those are still unresolved.

### Performance & UX summary

| Metric | Value | Note |
|---|---|---|
| Initial render | 5.5s | Acceptable but on the upper end |
| Console errors | 0 | Clean |
| /api 4xx/5xx | 0 | Clean |
| Empty states (legitimate) | 2 (2 charts) | Should fall back to 2025 全年 like KPI strip |
| Gold KPI cards rendered | 4/4 | Live with real numbers |
| TemplateGrid cards | 4/4 | Live with real Gold data |
| AI 智能洞察 | Empty/cold-start hint only | Either still loading or stalled |
| Sidebar / route to here | Works (智能分析 → 经营驾驶舱) | Confirmed |

