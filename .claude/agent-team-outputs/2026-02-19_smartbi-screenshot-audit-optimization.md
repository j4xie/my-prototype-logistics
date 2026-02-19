# SmartBI 最新截图审计优化分析

**日期**: 2026-02-19
**模式**: Full (5 agents) | 语言: Chinese | Codebase Grounding: ENABLED

---

## Executive Summary

- **建议**: 分 3 批修复 SmartBI 截图审计发现的 8 个问题，优先处理纯前端缺陷（重复预警、mock 数据违规、应付映射遗漏），可在 2 小时内完成
- **置信度**: 高 -- 截图+源码双重验证，3 组研究员结论高度一致，Critic 纠正了 2 处关键误判
- **核心风险**: DashboardFinance 的 mock 数据降级直接违反项目"禁止降级处理"核心原则；销售趋势全零属数据层问题，非快速修复
- **时间影响**: 第 1 批修复（30 分钟）可立即提升财务分析页和 finance_mgr 仪表盘的演示质量
- **工作量**: 第 1 批 3 个纯前端改动（约 15 行代码），第 2 批需同时改前端+参数逻辑，第 3 批需后端数据路径调试

---

## Consensus & Disagreements

| 议题 | Researcher 发现 | Analyst 建议 | Critic 质疑 | 最终裁定 |
|------|----------------|-------------|------------|---------|
| #2 销售趋势 Y轴 0-1 | yAxis 已正确配置，数据全零 | 标记为"1-2行修复" | yAxis 已配置(L867-890)，0-1 是 ECharts 自动缩放 | **Critic 正确**：根因是趋势 API 返回全零数据，需调试后端数据路径 |
| #5 Dashboard 缺单位 | Dashboard.vue 未调用 formatNumber | 建议 import formatNumber | 未验证 | **误报**：代码已 import formatNumber，"--"是 null 空数据的正确展示 |
| #6 应付账龄映射 | 后端返回完整数据，纯前端 bug | 同意纯前端修复 | 确认纯前端，L946-956 只映射 receivable | **全员一致**：纯前端修复 |
| #1 startDate 错误 | DashboardFinance.vue L80 缺参数 | 标记中等难度 | 必须同时移除 mock 降级(L91-106) | **Critic 补充关键**：须同时删除两处 mock 数据降级代码 |
| #3 重复预警 | L1006 设置 + L1195 追加导致重复 | 最高 ROI 修复 | 未质疑 | **全员一致**：截图确认 4 条预警（2种×2重复） |
| 演示就绪度 | SmartBIAnalysis 9.0/10 | 估 70% | 质疑至 55-60% | **裁定 60%**：SmartBIAnalysis+AIQuery 优秀，但其余页面可信度不足 |

---

## Detailed Analysis

### 1. DashboardFinance mock 数据降级（#1，严重违规）

**证据**：截图 07-fm-dashboard.png 显示红色错误横幅"缺少必要参数: startDate"，但 KPI 卡片仍展示 125.0万/87.5万/37.5万/30.0%。源码 `DashboardFinance.vue` L80 调用 API 未传 startDate，L91-97 和 L101-106 两处回退到硬编码 mock 数据，直接违反 CLAUDE.md "禁止降级处理"原则。

**修复**：(a) 添加默认日期参数 (b) 删除两处 mock 降级，替换为错误状态展示

### 2. 重复预警（#3，最高 ROI）

**证据**：截图 07-fm-finance.png 右侧预警区域显示 4 条预警（"毛利润为负"×2、"净利润为负"×2）。代码路径：L1006 从后端设置 → L1073 generateSmartWarnings() → L1195 追加未去重。

**修复**：L1195 追加前按 title 去重，约 3-5 行代码。

### 3. 销售趋势 Y 轴 0-1（#2，数据层问题）

**证据**：KPI 有真实数据（31,969.17），但趋势图全零。yAxis 配置完整（L867-890 含 formatter）。问题在趋势 API 返回全零数据。

**修复**：需调试后端 sales trend API，非快速修复。

### 4. 应付账龄映射遗漏（#6，纯前端 bug）

**证据**：后端 `getPayableAgingChart()` 返回完整 bucket 数据，但前端 L946-956 仅映射 receivableAge* 字段，无 payable 分支。

**修复**：添加 analysisType 判断分支，约 10-15 行。

### 5. Dashboard KPI "---"（#4+#5，澄清）

**证据**：#5 是误报（formatNumber 已正确使用）。#4 的"--"是 null 空数据的正确处理，非 bug。

**处理**：从修复列表移除。

### 6. 高质量页面确认

SmartBIAnalysis（9.0/10）和 AIQuery（8.5/10）经截图验证确实功能完整、演示效果好，是系统亮点。

---

## Confidence Assessment

| 结论 | 置信度 | 依据 |
|------|--------|------|
| #3 重复预警是前端追加 bug | ★★★★★ | 截图+源码双重验证 |
| #1 DashboardFinance mock 降级违反核心原则 | ★★★★★ | 截图+源码双重验证 |
| #2 销售趋势全零是数据层问题 | ★★★★★ | Critic 纠正后全员同意 |
| #6 应付账龄映射仅前端修复 | ★★★★☆ | 源码确认 |
| #5 Dashboard 缺单位是误报 | ★★★★★ | 代码明确显示已使用 |
| SmartBIAnalysis+AIQuery 演示就绪 | ★★★★★ | 全员最高评价 |
| 整体演示就绪度约 60% | ★★★☆☆ | 主观评估折中 |

---

## Actionable Recommendations

### Batch 1：立即执行（30 分钟）
- **#3 重复预警**: `FinanceAnalysis.vue` L1194-1196 追加前按 title 去重
- **#6 应付账龄**: `FinanceAnalysis.vue` L946 添加 payable 映射分支

### Batch 2：短期执行（30 分钟）
- **#1 startDate + mock 移除**: `DashboardFinance.vue` L80 添加默认日期参数 + L91-106 删除 mock 降级

### Batch 3：有条件执行（60 分钟+）
- **#2 销售趋势全零**: 调试后端 sales trend API 数据路径
- **#4 KPI 空数据**: 可选添加种子数据改善演示

### 长期规划
- 统一 3 套 KPI 渲染架构
- 统一 7 种空状态展示为 2-3 种标准模式

---

## Open Questions

1. 销售趋势后端 `dimension=trend` 的查询逻辑在哪个 Service？是否按日聚合导致数据分散为零？
2. 应付 kpiData 中是否已定义 payableAge30/60/90Plus 字段？
3. 后端 agingChart 是否区分应收/应付 bucket label 格式？
4. Batch 2 移除 mock 后，finance_mgr 首页无数据时的用户体验引导？

---

## Process Note
- Mode: Full
- Researchers deployed: 3 (Bug root causes, UX quality, Fix ROI)
- Total sources: 21 screenshots + 6 core source files
- Key disagreements: 3 resolved (#2 yAxis误判, #5 formatNumber误报, Batch1重构), 1 unresolved (演示就绪度55-70%)
- Phases completed: Research → Analysis → Critique → Integration
