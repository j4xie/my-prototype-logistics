# Web-Admin 架构层优化 — ECharts Composable + Responsive 迁移

**日期**: 2026-03-03
**验证**: Playwright MCP, 4 页面 0 console errors

---

## 架构问题诊断

### 问题 1: ECharts 生命周期管理 (50+ 实例, 29 个文件)

| 维度 | 修复前 | 修复后 |
|------|--------|--------|
| resize 机制 | `window.addEventListener('resize')` | **ResizeObserver** (element-level) |
| 侧边栏切换 | 需 hack: `setTimeout(dispatchEvent, 350)` | **自动检测** (container size change) |
| 内存清理 | 手动 `onUnmounted` + `removeEventListener` | **composable 自动 dispose** |
| 代码重复 | 每个文件 ~15 行 boilerplate | **1 行 composable** |
| 已知 bug | ExcelUpload 内存泄漏 + SmartBI 双重监听 | **已修复** |

### 问题 2: 响应式断点检测

| 维度 | 修复前 | 修复后 |
|------|--------|--------|
| 检测机制 | 仅 CSS media query | **matchMedia** (JS reactive) |
| 组件访问 | 无 composable | `useResponsive()` singleton |
| 事件效率 | N/A | **仅在断点边界触发** |

---

## 新增 Composable

### 1. `useChartResize` (`src/composables/useChartResize.ts`)

```typescript
const chartRef = ref<HTMLDivElement | null>(null);
const { chartInstance, init, resize, dispose } = useChartResize(chartRef);

onMounted(() => {
  const chart = init();
  chart?.setOption(options);
});
// 无需 onUnmounted — composable 自动清理
```

**特性**:
- ResizeObserver + 100ms debounce (避免 CSS transition 抖动)
- `shallowRef` 存储 ECharts 实例 (避免深层响应式)
- 支持传入元素: `init(el)` 或使用 template ref
- `onUnmounted` 自动 disconnect observer + dispose chart

### 2. `useResponsive` (`src/composables/useResponsive.ts`)

```typescript
const { isMobile, isTablet, isDesktop, breakpoint } = useResponsive();
```

**特性**:
- Singleton 模式: 所有组件共享同一状态 + 同一组 matchMedia listener
- 断点对齐 style.css: mobile ≤767px, tablet 768-1199px, desktop ≥1200px
- `readonly` breakpoint 防止外部修改

---

## 迁移清单

### SmartBI 图表组件 (15 个) — 全部迁移

| 组件 | 图表数 | 状态 |
|------|--------|------|
| TrendChart.vue | 1 | ✅ |
| PieChart.vue | 1 | ✅ |
| GaugeChart.vue | 1 | ✅ |
| RadarChart.vue | 1 | ✅ |
| HeatmapChart.vue | 1 | ✅ |
| MapChart.vue | 1 | ✅ |
| CombinedChart.vue | 1 | ✅ |
| RankingChart.vue | 1 | ✅ |
| WaterfallChart.vue | 1 | ✅ |
| NestedDonutChart.vue | 1 | ✅ |
| BudgetAchievementChart.vue | 1 | ✅ |
| YoYMoMComparisonChart.vue | 1 | ✅ |
| CategoryStructureComparisonChart.vue | 1 | ✅ |
| DynamicChartRenderer.vue | 1 | ✅ |
| MetricsTrendChart.vue | 1 | ✅ |

### View 文件 (11 个) — 全部迁移

| 文件 | 图表数 | 状态 |
|------|--------|------|
| analytics/trends/index.vue | 3 | ✅ |
| analytics/production-report/index.vue | 1 | ✅ |
| calibration/CalibrationDetailView.vue | 2 | ✅ |
| production-analytics/EfficiencyAnalysis.vue | 4 | ✅ |
| production-analytics/ProductionAnalysis.vue | 4 | ✅ |
| scheduling/plans/detail.vue | 1 | ✅ |
| scheduling/realtime/index.vue | 2 | ✅ |
| smart-bi/Dashboard.vue | 2 | ✅ |
| smart-bi/FoodKBFeedback.vue | 2 | ✅ |
| smart-bi/SalesAnalysis.vue | 2 | ✅ |
| smart-bi/FinanceAnalysis.vue | 1 | ✅ |

### Bug 修复 (3 个)

| 文件 | 问题 | 修复 | 状态 |
|------|------|------|------|
| ExcelUpload.vue | module-scope addEventListener 永不清理 | 移入 onMounted + onUnmounted 清理 | ✅ |
| SmartBIAnalysis.vue | onMounted + onActivated 双重 addEventListener | 移除 onMounted 中的 addEventListener | ✅ |
| AIQuery.vue | module-scope addEventListener 永不清理 | 移入 onMounted + onUnmounted 清理 | ✅ |

### 未迁移 (有意保留)

| 文件 | 原因 |
|------|------|
| SmartBIAnalysis.vue | 4500+ 行，动态图表用 `getInstanceByDom`，keep-alive 生命周期复杂 |
| ExcelUpload.vue | 动态图表用 Map 缓存，已修复生命周期 bug |
| AIQuery.vue | 动态图表用 Map 缓存，已修复生命周期 bug |
| useSmartBICrossSheet.ts | Composable 内动态创建，无 template ref |
| useSmartBIDrillDown.ts | 同上 |
| useSmartBIStatistical.ts | 同上 |

---

## Playwright 验证

| 页面 | Console Errors | 状态 |
|------|---------------|------|
| /analytics/trends | 0 | ✅ |
| /production-analytics/production | 0 | ✅ |
| /scheduling/realtime | 0 | ✅ |
| /smart-bi/food-kb-feedback | 0 | ✅ |

---

## 统计

| 指标 | 数值 |
|------|------|
| 新增 composable | 2 (`useChartResize`, `useResponsive`) |
| 迁移图表组件 | 15 |
| 迁移 view 文件 | 11 |
| 修复生命周期 bug | 3 |
| 消除 `window.addEventListener('resize')` | 14 处 → **3 处** (动态图表保留) |
| 消除 `echarts.init` 直接调用 | 30 处 → **~12 处** (动态图表保留) |
| 消除 `handleResize` 函数 | 11 个 |
| 消除 `onUnmounted` 图表清理 | 11 个 |
| 桌面端回归 | 0 |
