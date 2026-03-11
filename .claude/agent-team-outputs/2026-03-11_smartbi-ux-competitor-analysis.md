# SmartBI UI/UX 竞品对比与优化分析

**日期**: 2026-03-11
**模式**: Full (3 Researchers + Analyst + Critic)
**研究范围**: SmartBI 11页面 vs Power BI / Tableau / Metabase / Superset

---

## Executive Summary

SmartBI 在食品溯源垂直场景中已建立扎实的 BI 功能基础（11 个页面、40+ 图表、Cross-filter、Skeleton shimmer、暗色模式），交互质量超越 Metabase/Superset 默认体验。与 Power BI/Tableau 的核心差距集中在 3 个维度：AI 对话流畅度、请求竞态控制、长操作反馈。

---

## 竞品对比矩阵

| 维度 | SmartBI | Power BI | Tableau | Metabase | Superset |
|------|---------|----------|---------|----------|----------|
| KPI 卡片 | sparkline+趋势+计数器动画 | base/target/threshold 三要素 | 条件格式 | 基础数字卡 | Big Number |
| Cross-filter | highlight/downplay+tooltip同步 | 双模式(highlight/filter) | Action-based | 双向级联 | Native Filters |
| AI 对话 | SSE流式+16ms批量flush | Copilot+脚注溯源 | Pulse双模式Q&A | 无 | 无 |
| 暗色模式 | 支持(dispose闪烁) | JSON主题系统 | 有限 | 不支持 | 有限 |
| 骨架屏 | shimmer 3种类型+懒加载 | 原生spinner | 原生loading | 基础 | 基础 |
| 导出 | PPT/PDF/Excel | Service原生 | Server调度 | 邮件+CSV | CSV/图片 |

### SmartBI 优势
- Cross-filter 实现质量（highlight/downplay + tooltip同步）
- ChartSkeleton shimmer 动画（3种类型，1.6s）
- IntersectionObserver 懒加载 + stagger 淡入
- KPI 计数器动画（ease-out cubic, 800ms, rAF）

### SmartBI 差距
- AI 交互流畅度（无打字机效果）
- 筛选器竞态控制（无 AbortController）
- 导出进度感知（仅 button loading）

---

## 优化路线图 (Critic 验证后)

| # | 优化项 | 优先级 | 工时 | 文件 | 预期效果 |
|---|--------|--------|------|------|----------|
| 1 | SSE 快速降级提示 | P0 | 2h | AIQuery.vue | 工厂WiFi不稳定下消除静默等待 |
| 2 | 筛选器 AbortController | P0 | 2h | SalesAnalysis.vue, FinanceAnalysis.vue | 快速切换不再数据错乱 |
| 3 | AI 对话打字机效果 | P1 | 3-4h | AIQuery.vue | AI聊天"正在书写"感知 |
| 4 | 导出进度反馈 | P1 | 4-6h | FinancialDashboardPBI.vue | 导出时有明确进度 |
| 5 | KPI sparkline hover tooltip | P1 | 2-3h | Dashboard.vue, SalesAnalysis.vue | sparkline可交互 |
| 6 | Cross-filter 推广到 Dashboard | P2 | 6-8h | Dashboard.vue | 图表联动分析 |
| 7 | AI 洞察时间戳+引用溯源 | P2 | 3h | Dashboard.vue, FinanceAnalysis.vue | 对标Copilot脚注 |
| 8 | Stagger 进入动画 composable | P2 | 3h | useStaggerReveal.ts | 统一"依次淡入" |

### Critic 降级项
- 暗色模式无闪烁 → P3 (用户白天使用为主)
- ECharts canvas 无障碍 → Backlog (中国B端无合规要求)
- tooltip XSS → 已验证不存在 (DOMPurify已防护)

---

## 关键竞品洞察

### Power BI Copilot 脚注引用
AI分析文字中的数字结论增加上标引用，点击滚动/高亮对应图表。投入低(纯前端)但显著提升可信度。

### Tableau Pulse 三层异常检测
1. 被动检测 → digest推送
2. 主动标注 → 图表高亮 + NL解释
3. 阈值告警 → 移动端推送

### Sigma Computing 透明度优先
每个AI回答附带完整逻辑/公式/过滤器。适合需要审计的食品安全场景。

### 竞品矛盾点
- 数据密度 vs 留白: KPI卡片不计入"视图数量"，图表严格3-4个
- Cross-filter: Power BI双模式 vs 简单单模式
- 深色模式: 社区需求高但实现复杂度高

---

## CSS Design Token 进展

本轮迭代将 143 个硬编码颜色减少到 48 个（66%减少），映射表：
- `#303133` → `var(--el-text-color-primary)`
- `#606266` → `var(--el-text-color-regular)`
- `#909399` → `var(--el-text-color-secondary)`
- `#1B65A8` → `var(--el-color-primary)`
- `#67C23A` → `var(--el-color-success)`
- `#F56C6C` → `var(--el-color-danger)`
- `#f5f7fa` → `var(--el-fill-color-light)`
- `#ebeef5` → `var(--el-border-color-light)`

---

## Process Note
- Mode: Full
- Researchers: 3 (BI设计模式 + 代码审计 + AI趋势)
- Sources: 20+
- Disagreements resolved: 2 (debounce→AbortController, 打字机P0→P1)
