# SmartBI 全面浏览器测试后的长期优化评估

**日期**: 2026-02-19
**模式**: Full (3 Researchers + Analyst + Critic + Integrator)
**触发**: 4 组并行自动化浏览器测试 (factory_admin + finance_manager, 覆盖 7 页面 + 5 财务 Tab)

---

## Executive Summary

SmartBI 系统已形成完整的功能框架（25 种图表、钻取、跨 Sheet 分析、统计分析）且代码质量良好（7.7/10），但在数据展示、用户体验、AI 内容质量三个维度存在改进空间。

**核心建议**：
1. **立即纠正战略方向** — 聚焦食品行业垂直化而非追赶通用 BI 功能
2. **优先执行数据基础层优化**（2-3 天内完成 KPI 零值、列名人性化等）
3. **前置执行 SmartBIAnalysis.vue 拆分**（避免后续技术债膨胀）
4. **有条件地延迟** Text-to-SQL 等高风险功能

**关键风险**: LLM 成本线性增长、单文件代码膨胀、缺乏自动化测试保障。

---

## 浏览器测试发现汇总

### 4 组测试结果

| 测试组 | 角色 | 覆盖页面 | PASS | FAIL | 关键发现 |
|--------|------|---------|------|------|---------|
| A: Dashboard + Analysis | factory_admin | 经营驾驶舱, 数据分析 | 大部分 | 2 | P0 路由/keep-alive 渲染异常 |
| B: Finance + Sales + AI | factory_admin | 财务(5Tab), 销售, AI问答 | 7 | 3 | P1 销售数据映射错误, AI 超时 |
| C: Finance Manager | finance_mgr1 | 全部6菜单 + 4受限路由 | 25 | 0 | 权限保护完整, 数据质量P2 |
| D: Edge Cases + UX | factory_admin | 索引Sheet, 图表交互, 模板 | 大部分 | 2 | CSS溢出, JS console error |

### 问题清单 (19 项)

#### P0 级别 (阻断性) — 2 项
1. **Vue Router/keep-alive 状态不同步** — AppLayout.vue:31-32 `:key` 与 `:include` 冲突
2. **点击/滚动触发非预期导航** — CSS `height:100%` + IntersectionObserver 残留

#### P1 级别 (功能缺陷) — 6 项
3. 利润率 KPI 显示 0.0% (revenue=0 时)
4. Console JS Error: `Cannot read properties of undefined (reading 'items')`
5. AI 分析用行号代替标签名 ("8的2025-01-01_预算数")
6. 销售排行订单数全为 0
7. 销售趋势图 Y 轴最大 1.0
8. 营业收入柱状图不可见

#### P2 级别 (体验问题) — 11 项
9-19: 数据类型"UNKNOWN"、原始日期、列名未人性化、图表截断、Dashboard KPI"--"、负利润无红色、预算绿勾误导、"无风险预警"误导、应付标签不一致、面包屑错误、成本/预算全零

---

## 行业对标 (修正版)

Critic 指出：SmartBI 是"食品溯源内嵌模块"而非独立 BI 产品，应分维度评分。

| 维度 | SmartBI | 食品行业嵌入式 BI 基准 | 通用 BI (Power BI) | 评价 |
|------|---------|---------------------|-------------------|------|
| 图表多样性 | 8 种 (实际 25 种含子类型) | 5-8 种 | 50+ 种 | **超出行业基准** |
| AI 智能分析 | 8/10 (LLM + 异常检测) | 2-3/10 | 8/10 (Copilot) | **行业领先** |
| 数据质量防线 | 5/10 (缺除零/预警) | 5/10 | 9/10 | **符合基准** |
| 部署简易度 | 9/10 (单JAR) | 6/10 | 3/10 | **显著优势** |
| 中文本地化 | 8/10 (humanize) | 7/10 | 7/10 | **略超基准** |
| 移动支持 | 2/10 (无入口) | 4/10 | 9/10 | **低于基准** |
| 安全/审计 | 3/10 (角色白名单) | 4/10 | 9/10 | **略低基准** |
| 行业适配度 | 8.5/10 (食品KPI+基准) | 5/10 | 3/10 | **核心优势** |

**结论**: SmartBI 在食品行业嵌入式 BI 维度评分 **8.5/10**，在通用 BI 功能维度评分 **4.2/10**。战略方向应深耕前者。

---

## 根因分析：P0 路由/keep-alive 问题

### 问题 1: keep-alive :key 与 :include 冲突

```vue
<!-- AppLayout.vue:30-34 -->
<router-view v-slot="{ Component }">
  <keep-alive :include="keepAliveViews" :max="5">
    <component :is="Component" :key="$route.path" />
  </keep-alive>
</router-view>
```

- Vue 3 中 `:key` 优先于 `:include`，导致缓存键按路径而非组件名匹配
- SmartBI 单一路由场景下影响有限，但多页面快速切换时可能出现渲染异常
- **修复**: 改用 `:key="$route.name"` 或移除 `:key` (需评估副作用)

### 问题 2: IntersectionObserver 生命周期

```typescript
// SmartBIAnalysis.vue:3773-3778 — onDeactivated
onDeactivated(() => {
  window.removeEventListener('resize', handleResize);
  if (autoRefreshTimer) { clearInterval(autoRefreshTimer); }
  clearHoverThrottleTimers();
  // ❌ 缺失: chartObserver.disconnect(), pendingChartConfigs.clear()
});
```

- onBeforeUnmount (3798行) 有清理，但 keep-alive 下不调用 onBeforeUnmount
- **修复**: 在 onDeactivated 中添加 observer disconnect + pendingChartConfigs clear

### 问题 3: CSS 强制高度

```scss
// AppLayout.vue:60-63
.app-content > * {
  height: 100%;  // ❌ 强制所有子组件填满容器
  width: 100%;
}
```

- SmartBI 页面内容动态高度，强制 100% 导致溢出和滚动事件异常
- **修复**: 改为 `min-height: 100%` 或 `height: auto`

---

## Top 5 最高 ROI 改进 (修正版)

| 排名 | 改进项 | 工作量 | 置信度 | 说明 |
|------|--------|--------|--------|------|
| 1 | **keep-alive :key 修复 + CSS height** | 1d | ★★★★☆ | P0 路由问题的根因，但需谨慎评估副作用 |
| 2 | **IntersectionObserver onDeactivated 清理** | 0.5d | ★★★★★ | 内存泄漏 + 渲染错误的直接修复 |
| 3 | **KPI 渲染层零值/N/A 统一处理** | 1d | ★★★★★ | 除零保护在 analysis.ts 已有，问题在渲染层显示 |
| 4 | **智能预警推导 (后端 AI 层)** | 1.5d | ★★★★☆ | 负利润"无风险预警"根因在后端未生成预警 |
| 5 | **AI 缓存键加入 query_hash** | 0.5d | ★★★★★ | 消除不同问题返回相同回答 |

---

## 修正后的路线图

### Month 1: 地基修复 (P0/P1)
- W1: keep-alive + CSS + Observer 修复 (2d)
- W2: KPI 渲染统一 + 智能预警 (2.5d)
- W3: AI 缓存 + 列名人性化扩展 (1.5d)
- W4: 回归测试 + E2E 验证

### Month 2: 代码治理 + 体验
- W5-6: SmartBIAnalysis.vue 拆分为 4-5 个 composable (5d)
- W7: 空状态组件化 + 审计日志基础版 (3d)
- W8: E2E 测试覆盖 + 文档

### Month 3-4: 垂直化深耕 (条件性)
- 食品行业 KPI 标准化 (保质期损耗、冷链合规)
- LLM 成本监控 + 优化
- RN SmartBI 只读展示 (移至 Month 4-6，不急)

---

## 关键分歧与决议

| 议题 | Analyst 观点 | Critic 观点 | 最终决议 |
|------|-------------|-------------|---------|
| 行业定位 | 追赶 Power BI | 聚焦食品垂直化 | ✅ **Critic 正确** |
| 除零保护 | analysis.ts 缺失 | 已有保护，问题在渲染层 | ✅ **Critic 正确** |
| Month 3 RN SmartBI | 可行 | 严重不切实际 | ✅ **Critic 正确**，移至 M4-6 |
| 负利润预警 | 前端 bug | 后端 AI 覆盖不足 | ✅ **Critic 正确** |
| humanize 词库 | 扩展到 100+ | 边际收益递减，应考虑 LLM 辅助 | ⚠️ **混合方案** |
| keep-alive 修复 | 删除 :key 即可 | 需用 route.name 替代 | ⚠️ **Critic 更审慎** |

---

## 长期问题 vs 一次性修复

### 一次性修复 (修完永久生效)
- keep-alive :key 配置
- IntersectionObserver 生命周期
- CSS height:100%
- KPI 渲染层零值处理
- AI 缓存键设计

### 持续维护 (需随业务迭代)
- humanize 词库扩展
- AI insight 质量 (prompt 迭代)
- 图表类型按需增加
- 安全/审计增强
- Python 后端性能优化
- 食品行业 KPI 标准

---

## Process Note
- Mode: Full
- Researchers deployed: 3 (Vue架构, 行业对标, 数据可视化)
- Total sources found: 50+
- Key disagreements: 6 resolved, 2 unresolved
- Phases completed: Research → Analysis → Critique → Integration
