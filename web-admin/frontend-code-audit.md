# Frontend Code Audit Report (A3)
Date: 2026-02-11

## Executive Summary
- **Total files audited**: 27
- **Total lines of code**: 20,074
- **Critical issues**: 6
- **High issues**: 14
- **Medium issues**: 18
- **Low issues**: 12
- **Total issues**: 50

The audited files span the SmartBI, Analytics, and Dashboard modules of the web-admin frontend. The most pressing issues are: (1) the 3,937-line god-component `SmartBIAnalysis.vue` that desperately needs decomposition, (2) pervasive `as any` usage (33 occurrences across 7 files in scope, 20 in SmartBIAnalysis.vue alone), (3) duplicated `KPICard` interface definitions across 5 files, (4) memory leaks from unremoved event listeners in `AIQuery.vue` and `ExcelUpload.vue`, (5) `DataCompletenessView.vue` bypassing the centralized API client with raw `fetch()`, and (6) extensive snake_case naming in API-facing code violating the project convention.

---

## Per-File Analysis

### SmartBI Views

#### 1. `src/views/smart-bi/SmartBIAnalysis.vue`
- **Lines**: 3,937
- **as any count**: 20
- **catch(error: any) count**: 2 (lines 1191, 1314)
- **Issues found**:
  - CRITICAL: God-component at 3,937 lines. Contains file upload, sheet management, chart rendering, drill-down analysis, cross-sheet analysis, YoY comparison, KPI generation, statistical analysis, and chart/dashboard building -- all in a single component.
  - HIGH: 20 `as any` casts (lines 1479-1484, 1495, 1536, 1550, 1582, 1619, 1742, 1767, 1784, 1794, 2197, 2200, 2207, 2221, 2509, 2511)
  - HIGH: Uses raw `fetch()` at line 1264 instead of centralized API client
  - MEDIUM: 38 `console.log/error/warn` statements (production logging)
  - MEDIUM: Multiple `setTimeout` calls (lines 1411, 1429, 1435, 2171, 2267, 2384, 2545, 2724, 2949) -- most are not cleared on unmount (only `renderDebounceTimer` is cleaned up at line 2551)
  - MEDIUM: `v-html` usage at lines 382, 480, 519 -- potential XSS if AI-generated content is not sanitized
  - LOW: Uses `onBeforeUnmount` which is correct and does cleanup (line 2550)

#### 2. `src/views/smart-bi/Dashboard.vue`
- **Lines**: 1,142
- **as any count**: 0
- **Issues found**:
  - MEDIUM: Redefines `KPICard` interface locally (line 32) instead of importing from `@/types/smartbi.ts`
  - MEDIUM: Redefines `RankingItem`, `AIInsightResponse`, `ChartConfig`, `DashboardResponse` interfaces locally (lines 46-90) that overlap with `@/api/smartbi.ts` and `@/types/smartbi.ts`
  - LOW: `import { onUnmounted } from 'vue'` appears late at line 497 (mid-file), not with other imports at top
  - LOW: Proper cleanup in `onUnmounted` (lines 498-502): removes resize listener and disposes charts

#### 3. `src/views/smart-bi/FinanceAnalysis.vue`
- **Lines**: 1,690
- **as any count**: 0
- **Issues found**:
  - HIGH: At 1,690 lines, exceeds 500-line threshold significantly. Contains profit, cost, receivable, payable, and budget analysis modes with chart rendering.
  - MEDIUM: Defines `DynamicKpiItem` (line 100) and `FinanceKPI` (line 122) interfaces locally, duplicating concept from `KPICard` type
  - MEDIUM: Date `shortcuts` array (lines 43-80) duplicated with `SalesAnalysis.vue` (identical pattern)
  - LOW: Proper cleanup in `onUnmounted` (line 972)

#### 4. `src/views/smart-bi/SalesAnalysis.vue`
- **Lines**: 923
- **as any count**: 0
- **Issues found**:
  - HIGH: Redefines `KPICard` interface locally (line 75) with slightly different shape than `@/types/smartbi.ts` and `@/api/smartbi.ts` versions
  - MEDIUM: Date `shortcuts` array (lines 36-72) duplicated verbatim from `FinanceAnalysis.vue`
  - MEDIUM: `handleExport()` at line 551 is a stub: `ElMessage.info('导出功能开发中...')` -- dead feature
  - LOW: Proper cleanup in `onUnmounted` (line 558)

#### 5. `src/views/smart-bi/ProductionAnalysis.vue`
- **Lines**: 406
- **as any count**: 0
- **Issues found**:
  - MEDIUM: Hardcoded `factoryId || 'F001'` fallback (line 14)
  - MEDIUM: `v-html="renderedAnalysis"` at line 268 -- XSS risk from AI analysis content rendered via `marked()`
  - MEDIUM: `setInterval(loadData, 60000)` at line 210 for auto-refresh -- correctly cleaned up at line 215
  - LOW: Proper cleanup in `onUnmounted` (line 214)

#### 6. `src/views/smart-bi/DataCompletenessView.vue`
- **Lines**: 237
- **as any count**: 0
- **Issues found**:
  - CRITICAL: Uses raw `fetch()` at line 70 instead of centralized API client (`@/api/request` or `@/api/smartbi`). Bypasses interceptors, auth headers, error handling.
  - HIGH: Interface uses `snake_case` field names: `entity_type`, `overall_completeness`, `total_records`, `field_completeness` (lines 18-23). API request body also uses `factory_id` (line 73). This violates the project's camelCase convention.
  - MEDIUM: Hardcoded `factoryId || 'F001'` fallback (line 11)
  - MEDIUM: Error handling is bare `console.error` with no user feedback (line 83)

#### 7. `src/views/smart-bi/ExcelUpload.vue`
- **Lines**: 1,124
- **as any count**: 0
- **Issues found**:
  - CRITICAL: `window.addEventListener('resize', ...)` at line 324 uses anonymous arrow function -- **never removed**. The `onUnmounted` at line 318 only disposes chart instances, not the resize listener. This is a memory leak.
  - HIGH: At 1,124 lines, exceeds the 500-line threshold. Contains upload, parsing, analysis, chart rendering, and save confirmation steps.
  - LOW: Proper chart disposal in `onUnmounted` (line 318-321)

#### 8. `src/views/smart-bi/AIQuery.vue`
- **Lines**: 709
- **as any count**: 0 (but 3 `(s: any)` in callback params at lines 263, 283, 301)
- **Issues found**:
  - CRITICAL: `window.addEventListener('resize', ...)` at line 98 is added at module scope (not inside `onMounted`) and uses anonymous arrow function -- **never removed**. No `onUnmounted`/`onBeforeUnmount` lifecycle hook exists in this component at all. Both the resize listener and chart instances in `chartInstances` Map will leak.
  - HIGH: 3 untyped callback parameters `(s: any)` in chart rendering functions (lines 263, 283, 301)
  - MEDIUM: `chartInstances` is a plain `Map` that is never cleaned up when component unmounts (charts created for each message are never disposed)

#### 9. `src/views/smart-bi/Layout.vue`
- **Lines**: 19
- **Issues found**: None. Simple router-view wrapper.

---

### Analytics Views

#### 10. `src/views/analytics/index.vue`
- **Lines**: 396
- **as any count**: 0 (but 3 `[] as any[]` untyped refs at lines 27-29)
- **Issues found**:
  - MEDIUM: `trendData` uses `[] as any[]` for all three arrays (lines 27-29): `productionTrend`, `qualityTrend`, `costTrend`. Should define proper interfaces.
  - LOW: No ECharts usage, so no cleanup concerns.

#### 11. `src/views/analytics/trends/index.vue`
- **Lines**: 244
- **as any count**: 5 (lines 94, 101, 116, 123, 138, 144)
- **Issues found**:
  - CRITICAL: `window.addEventListener('resize', handleResize)` at line 44 is **never removed** -- no `onUnmounted`/`onBeforeUnmount` exists. Three ECharts instances (`productionChart`, `qualityChart`, `costChart`) are also **never disposed**. This is a memory leak.
  - HIGH: 5 `(d: any)` untyped callback parameters in `updateCharts()` function (lines 94, 101, 116, 123, 138, 144)
  - HIGH: `trendData` uses `[] as any[]` for all five arrays (lines 16-20): no proper interface defined for trend data points.
  - MEDIUM: Uses `document.getElementById()` instead of template refs (lines 70-72)

#### 12. `src/views/analytics/ai-reports/index.vue`
- **Lines**: 344
- **as any count**: 0 (but 3 `ref<any>` and `ref<any[]>`)
- **Issues found**:
  - HIGH: `reports` is `ref<any[]>` (line 12), `selectedReport` is `ref<any>` (line 13), `anomalies` is `ref<any[]>` (line 17). All lack proper interfaces.
  - MEDIUM: `v-html="selectedReport.aiAnalysis.replace(/\n/g, '<br>')"` at line 215 -- XSS risk, no sanitization
  - MEDIUM: `viewReport(report: any)` parameter at line 60 is untyped

#### 13. `src/views/analytics/kpi/index.vue`
- **Lines**: 401
- **as any count**: 0
- **Issues found**:
  - LOW: Hardcoded target values (lines 40-46) should be configurable per factory
  - LOW: No ECharts, no cleanup concerns

#### 14. `src/views/analytics/production-report/index.vue`
- **Lines**: 391
- **as any count**: 0
- **Issues found**:
  - LOW: Properly typed with `ProductionData` interface (lines 7-12)
  - LOW: Proper cleanup in `onUnmounted` (lines 74-77): removes listener and disposes chart

#### 15. `src/views/analytics/AlertDashboard.vue`
- **Lines**: 450
- **as any count**: 0
- **Issues found**:
  - MEDIUM: Hardcoded `factoryId || 'F001'` fallback (line 14)
  - MEDIUM: `v-html="marked(selectedAlert.aiAnalysis)"` at line 324 -- XSS risk
  - LOW: Well-typed with `AlertSummary` and `AlertRecord` interfaces

---

### Dashboard Components

#### 16. `src/components/dashboard/DashboardAdmin.vue`
- **Lines**: 378
- **as any count**: 0
- **Issues found**: None significant. Well-typed with imported types.

#### 17. `src/components/dashboard/DashboardDefault.vue`
- **Lines**: 266
- **as any count**: 2 (lines 44, 74)
- **Issues found**:
  - MEDIUM: `permissionStore.canAccess(m.key as any)` at line 44 and `permissionStore.getPermission(module as any)` at line 74. The permission store types should accept these string keys.

#### 18. `src/components/dashboard/DashboardFinance.vue`
- **Lines**: 472
- **as any count**: 0
- **Issues found**: None significant.

#### 19. `src/components/dashboard/DashboardHR.vue`
- **Lines**: 395
- **as any count**: 0
- **Issues found**: None significant.

#### 20. `src/components/dashboard/DashboardProduction.vue`
- **Lines**: 555
- **as any count**: 0
- **Issues found**:
  - MEDIUM: Exceeds 500-line threshold at 555 lines. Contains OEE gauge + yield chart + stat cards + auto-refresh.
  - LOW: Proper cleanup in `onUnmounted` (line 97): clears interval, removes listener, disposes charts.

#### 21. `src/components/dashboard/DashboardWarehouse.vue`
- **Lines**: 382
- **as any count**: 0
- **Issues found**: None significant.

---

### Core Supporting Files

#### 22. `src/api/smartbi.ts`
- **Lines**: 3,263
- **as any count**: 1 (line 2467)
- **Issues found**:
  - HIGH: At 3,263 lines, this is a monolithic API module. Contains 17+ raw `fetch()` calls to the Python SmartBI service (lines 520, 551, 574, 625, 694, 740, 771, 798, 827, 1452, 1485, 1508, 2261, 2300, 2324, 3206, 3231) alongside regular API calls through the project's request utility. The `fetch()` calls bypass the project's interceptors and centralized error handling.
  - HIGH: Hardcoded `factoryId || 'F001'` fallback in `getFactoryId()` (line 19). This is the root cause -- every consumer inherits this hardcoded default.
  - HIGH: Duplicates `KPICard` interface (line 92) and `KPIData` interface (line 377) that also exist in `@/types/smartbi.ts`
  - MEDIUM: 37 occurrences of snake_case field names used in request/response objects (e.g., `factory_id`, `upload_id`, `table_type`, `current_upload_id`, `compare_upload_id`, `processing_time_ms`, etc.)
  - MEDIUM: `SmartKPI` interface (line 938) is yet another KPI-related type definition

#### 23. `src/types/smartbi.ts`
- **Lines**: 156
- **as any count**: 0
- **Issues found**:
  - HIGH: `KPICard` interface (line 7) duplicated in `src/api/smartbi.ts` (line 92), `src/views/smart-bi/Dashboard.vue` (line 32), and `src/views/smart-bi/SalesAnalysis.vue` (line 75) -- each with slightly different shapes.
  - LOW: Well-structured type definitions with `chartHasData` utility function.

#### 24. `src/components/smartbi/DynamicChartRenderer.vue`
- **Lines**: 752
- **as any count**: 0
- **Issues found**:
  - MEDIUM: Exceeds 500-line threshold at 752 lines due to 13 chart type builders (bar, line, pie, waterfall, line_bar, radar, scatter, area, gauge, funnel, stacked_bar, doughnut, treemap, map). Consider extracting chart builders into a separate utility.
  - MEDIUM: Repetitive pattern of `(config as Record<string, unknown>).xaxisField as string` appears 11 times (lines 302-303, 327-328, 376-377, 410-411, etc.) to handle API naming inconsistency. Should be extracted to a helper function.
  - LOW: Proper cleanup in `onUnmounted` (lines 33-37): removes listener and disposes chart.

#### 25. `src/components/smartbi/KPICard.vue`
- **Lines**: 731
- **as any count**: 0
- **Issues found**:
  - MEDIUM: At 731 lines for a single card component, this is large due to supporting 4 display modes (default, sparkline, progressBar, waterWave). Consider splitting into sub-components per display mode.
  - LOW: Proper cleanup in `onBeforeUnmount` (line 221).

#### 26. `src/components/smartbi/index.ts`
- **Lines**: 141
- **as any count**: 0
- **Issues found**: None. Clean barrel export file with theme constants and utility functions.

#### 27. `src/style.css`
- **Lines**: 170
- **as any count**: N/A
- **Issues found**:
  - LOW: Defines CSS variables for theme colors (lines 7-13) but these are not consistently used across components. Most components use hardcoded hex values instead of `var(--primary-color)` etc.

---

## Issue Categories

### 1. TypeScript Safety (17 issues)

| # | File | Line(s) | Issue | Severity |
|---|------|---------|-------|----------|
| 1 | SmartBIAnalysis.vue | 1479-2511 | 20x `as any` casts on chart config objects | HIGH |
| 2 | SmartBIAnalysis.vue | 1191, 1314 | 2x `catch (error: any)` | MEDIUM |
| 3 | AIQuery.vue | 263, 283, 301 | 3x `(s: any)` untyped callback params | HIGH |
| 4 | trends/index.vue | 94-144 | 5x `(d: any)` untyped callback params | HIGH |
| 5 | trends/index.vue | 16-20 | 5x `[] as any[]` untyped trend arrays | HIGH |
| 6 | analytics/index.vue | 27-29 | 3x `[] as any[]` untyped trend arrays | MEDIUM |
| 7 | ai-reports/index.vue | 12-17 | 3x `ref<any>` / `ref<any[]>` untyped refs | HIGH |
| 8 | ai-reports/index.vue | 60 | `viewReport(report: any)` untyped param | MEDIUM |
| 9 | DashboardDefault.vue | 44, 74 | 2x `as any` for permission module keys | MEDIUM |
| 10 | smartbi.ts (api) | 2467 | 1x `as any` cast | LOW |
| 11 | SmartBIAnalysis.vue | 780+ | Well-typed `SheetResult` interface shows it is possible | INFO |

**Total `as any` across audited files**: 33 occurrences in 7 files.

### 2. Architecture (7 issues)

| # | File | Lines | Issue | Severity |
|---|------|-------|-------|----------|
| 1 | SmartBIAnalysis.vue | 3,937 | God-component: upload + sheet mgmt + charts + drill-down + cross-sheet + YoY + KPI + stats + dashboard builder. Should split into ~8 sub-components. | CRITICAL |
| 2 | api/smartbi.ts | 3,263 | Monolithic API module: mix of Java backend calls (via `get`/`post`) and Python service calls (via raw `fetch`). Should split by domain. | HIGH |
| 3 | FinanceAnalysis.vue | 1,690 | Large component with 5 analysis modes. Could extract each mode into sub-components. | HIGH |
| 4 | ExcelUpload.vue | 1,124 | Large 4-step wizard. Each step could be a sub-component. | MEDIUM |
| 5 | DynamicChartRenderer.vue | 752 | 13 chart type builders in one file. Extract builders to utility. | MEDIUM |
| 6 | KPICard.vue | 731 | 4 display modes in one component. Consider splitting. | MEDIUM |
| 7 | DashboardProduction.vue | 555 | Slightly exceeds threshold, manageable. | LOW |

**Recommended SmartBIAnalysis.vue decomposition:**
1. `SmartBIUploader.vue` -- file upload + progress (lines ~760-1300)
2. `SmartBISheetList.vue` -- sheet sidebar + selection (lines ~1300-1500)
3. `SmartBIChartPanel.vue` -- chart rendering + drill-down (lines ~1500-2000)
4. `SmartBIKPIPanel.vue` -- KPI cards + smart metrics (lines ~2000-2200)
5. `SmartBICrossSheet.vue` -- cross-sheet analysis (lines ~2560-2750)
6. `SmartBIYoYPanel.vue` -- year-over-year comparison (lines ~2750-2950)
7. `SmartBIStatsPanel.vue` -- statistical analysis (lines ~2950-3100)
8. `SmartBIAnalysis.vue` -- orchestrator, reduced to ~500 lines

### 3. Code Duplication (8 issues)

| # | Item | Locations | Issue | Severity |
|---|------|-----------|-------|----------|
| 1 | `KPICard` interface | `types/smartbi.ts:7`, `api/smartbi.ts:92`, `Dashboard.vue:32`, `SalesAnalysis.vue:75` | 4 separate definitions with different shapes | HIGH |
| 2 | `KPIData`/`FinanceKPI`/`SmartKPI` | `api/smartbi.ts:377`, `api/smartbi.ts:938`, `FinanceAnalysis.vue:122` | 3 additional KPI-related type defs | MEDIUM |
| 3 | Date shortcuts | `FinanceAnalysis.vue:43-80`, `SalesAnalysis.vue:36-72` | Identical date shortcut arrays (7 items each) | MEDIUM |
| 4 | `formatNumber()` utility | `analytics/index.vue:93-98`, `ProductionAnalysis.vue:89-91`, `smartbi/index.ts:89-117` | 3 implementations with different logic | MEDIUM |
| 5 | Chart color palette | `DynamicChartRenderer.vue:26`, `smartbi/index.ts:69-86`, multiple vue files | PIE_COLORS array and hardcoded colors repeated | LOW |
| 6 | Grid tooltip pattern | DynamicChartRenderer.vue, all chart builder functions | `{ trigger: 'axis', axisPointer: { type: 'shadow' } }` repeated 10+ times | LOW |
| 7 | `xField`/`yField` extraction | DynamicChartRenderer.vue:302-303 and 10 more locations | `config.xAxisField \|\| (config as Record<string, unknown>).xaxisField as string` repeated 11x | MEDIUM |
| 8 | Page header layout | Every view file | Identical `.page-header` CSS + HTML pattern repeated across all views | LOW |

### 4. API Integration (6 issues)

| # | File | Line(s) | Issue | Severity |
|---|------|---------|-------|----------|
| 1 | DataCompletenessView.vue | 70 | Uses raw `fetch()` to Python service, bypassing auth interceptors and centralized error handling | CRITICAL |
| 2 | api/smartbi.ts | 520-3231 | 17+ raw `fetch()` calls to Python SmartBI service. These bypass the project's axios interceptors (auth token injection, 401 refresh, error handling) | HIGH |
| 3 | SmartBIAnalysis.vue | 1264 | Raw `fetch()` call bypassing API client | HIGH |
| 4 | DataCompletenessView.vue | 82-83 | Bare `console.error` with no user-facing error feedback | MEDIUM |
| 5 | trends/index.vue | 63 | Bare `console.error` with no user-facing error feedback | MEDIUM |
| 6 | analytics/index.vue | 73, 89 | Bare `console.error` with no user-facing error feedback | MEDIUM |

### 5. Naming Conventions (3 issues)

| # | File | Line(s) | Issue | Severity |
|---|------|---------|-------|----------|
| 1 | DataCompletenessView.vue | 18-23 | Interfaces use `snake_case`: `entity_type`, `overall_completeness`, `total_records`, `field_completeness` | HIGH |
| 2 | api/smartbi.ts | throughout | 37+ occurrences of snake_case in request/response fields: `factory_id`, `upload_id`, `table_type`, `current_upload_id`, `processing_time_ms`, `yoy_growth`, etc. | MEDIUM |
| 3 | SmartBIAnalysis.vue | throughout | 19+ snake_case field references matching Python API responses: `__rowIndex`, `__rawIdx`, etc. | MEDIUM |

**Note**: The snake_case usage in `api/smartbi.ts` and consumers is driven by the Python SmartBI service API which returns snake_case fields. The recommended fix is to add a response transform layer in the API module that converts snake_case to camelCase.

### 6. Hardcoded Values (5 issues)

| # | File | Line | Issue | Severity |
|---|------|------|-------|----------|
| 1 | api/smartbi.ts | 19 | `user.factoryId \|\| 'F001'` -- hardcoded fallback factory ID | HIGH |
| 2 | AlertDashboard.vue | 14 | `authStore.factoryId \|\| 'F001'` | MEDIUM |
| 3 | DataCompletenessView.vue | 11 | `authStore.factoryId \|\| 'F001'` | MEDIUM |
| 4 | ProductionAnalysis.vue | 14 | `authStore.factoryId \|\| 'F001'` | MEDIUM |
| 5 | kpi/index.vue | 40-46 | Hardcoded KPI target values: `oee: 85, yield: 95, fpy: 90` etc. Should be configurable per factory. | LOW |

### 7. Memory Leaks & Cleanup (6 issues)

| # | File | Line(s) | Issue | Severity |
|---|------|---------|-------|----------|
| 1 | AIQuery.vue | 98 | `window.addEventListener('resize', ...)` with anonymous function at module scope -- **never removed**. No `onUnmounted` hook exists. Charts in `chartInstances` Map also never disposed. | CRITICAL |
| 2 | ExcelUpload.vue | 324 | `window.addEventListener('resize', ...)` with anonymous function -- **never removed** in `onUnmounted`. Only chart instances are cleaned up. | CRITICAL |
| 3 | trends/index.vue | 44 | `window.addEventListener('resize', handleResize)` -- **never removed**. 3 ECharts instances never disposed. No cleanup hook exists. | CRITICAL |
| 4 | SmartBIAnalysis.vue | 1411-2955 | Multiple `setTimeout` calls (9 total). Only `renderDebounceTimer` is cleaned up. Others could fire after unmount. | MEDIUM |
| 5 | Dashboard.vue | 497-502 | Properly cleaned up. | OK |
| 6 | FinanceAnalysis.vue | 972-975 | Properly cleaned up. | OK |
| 7 | SalesAnalysis.vue | 558-562 | Properly cleaned up. | OK |
| 8 | ProductionAnalysis.vue | 214-218 | Properly cleaned up (including setInterval). | OK |
| 9 | SmartBIAnalysis.vue | 2550-2561 | Properly cleaned up (resize, debounce, charts, observer). | OK |

**Files with proper cleanup**: Dashboard.vue, FinanceAnalysis.vue, SalesAnalysis.vue, ProductionAnalysis.vue, SmartBIAnalysis.vue, DynamicChartRenderer.vue, KPICard.vue, production-report/index.vue, DashboardProduction.vue.

**Files MISSING cleanup**: AIQuery.vue, ExcelUpload.vue, trends/index.vue.

### 8. Unused Code & Security (4 issues)

| # | File | Line | Issue | Severity |
|---|------|------|-------|----------|
| 1 | package.json | 14 | `@playwright/test: ^1.58.2` in dependencies but no test files found. Dead dependency. | LOW |
| 2 | SalesAnalysis.vue | 551 | `handleExport()` is a stub: `ElMessage.info('导出功能开发中...')` -- dead feature | LOW |
| 3 | ai-reports/index.vue | 215 | `v-html` with unsanitized AI content: `v-html="selectedReport.aiAnalysis.replace(/\n/g, '<br>')"` -- XSS risk | HIGH |
| 4 | SmartBIAnalysis.vue | 382,480,519 | `v-html="formatAnalysis(...)"` with AI-generated markdown -- XSS risk if not properly sanitized | HIGH |
| 5 | ProductionAnalysis.vue | 268 | `v-html="renderedAnalysis"` using `marked()` on AI content -- XSS risk | MEDIUM |
| 6 | AlertDashboard.vue | 324 | `v-html="marked(selectedAlert.aiAnalysis)"` -- XSS risk | MEDIUM |

---

## Top 10 Priority Fixes

| Priority | File | Issue | Effort | Impact |
|----------|------|-------|--------|--------|
| 1 | AIQuery.vue | Memory leak: no cleanup hook. Add `onBeforeUnmount` to remove resize listener and dispose all chart instances. | Low (15 min) | CRITICAL -- affects every user who visits AI Query page |
| 2 | trends/index.vue | Memory leak: no cleanup hook. Add `onUnmounted` to remove resize listener and dispose 3 ECharts instances. | Low (15 min) | CRITICAL -- affects every user who visits Trends page |
| 3 | ExcelUpload.vue | Memory leak: anonymous resize listener never removed. Convert to named function and remove in `onUnmounted`. | Low (15 min) | CRITICAL -- affects every user who visits Excel Upload page |
| 4 | DataCompletenessView.vue | Replace raw `fetch()` with centralized API client. Add proper error feedback to user. | Medium (30 min) | HIGH -- bypasses auth and error handling |
| 5 | SmartBIAnalysis.vue | Decompose 3,937-line god-component into ~8 sub-components. | High (4-8 hrs) | HIGH -- maintainability, testability |
| 6 | types/smartbi.ts + consumers | Consolidate all `KPICard` interface definitions to a single source in `@/types/smartbi.ts`. Remove duplicates from `api/smartbi.ts`, `Dashboard.vue`, `SalesAnalysis.vue`. | Medium (1 hr) | HIGH -- consistency, single source of truth |
| 7 | api/smartbi.ts | Add a response transform layer to convert Python snake_case responses to camelCase. Wrap raw `fetch()` calls in a utility that adds auth headers. | Medium (2 hrs) | HIGH -- type safety, auth consistency |
| 8 | Multiple files | Sanitize all `v-html` content using DOMPurify before rendering AI-generated markdown/HTML. | Medium (1 hr) | HIGH -- XSS prevention |
| 9 | FinanceAnalysis.vue + SalesAnalysis.vue | Extract shared `dateShortcuts` into a reusable utility function in a shared module. | Low (20 min) | MEDIUM -- DRY principle |
| 10 | Multiple files | Remove hardcoded `factoryId \|\| 'F001'` fallbacks. Either enforce factoryId at auth level (redirect to login if missing) or use a centralized fallback utility with proper logging. | Medium (1 hr) | MEDIUM -- data integrity in multi-factory setup |

---

## Summary Statistics

| Metric | Count |
|--------|-------|
| Total lines audited | 20,074 |
| Files > 1,000 lines | 4 (SmartBIAnalysis, api/smartbi, FinanceAnalysis, Dashboard) |
| Files > 500 lines | 8 |
| Total `as any` casts | 33 across 7 files |
| Total `ref<any>` / `[] as any[]` | ~48 across all audited files |
| `catch (error: any)` violations | 9 (7 in AdvancedFinanceAnalysis, 2 in SmartBIAnalysis) |
| Memory leak locations | 3 components missing cleanup |
| Hardcoded `F001` fallbacks | 4 locations |
| Raw `fetch()` bypassing API client | 20 locations (17 in api/smartbi.ts, 1 each in DataCompletenessView, SmartBIAnalysis, MapChart) |
| `v-html` XSS risk locations | 6 |
| Duplicated `KPICard` interface | 4 separate definitions |
| Duplicated date shortcuts | 2 identical arrays |
| Hardcoded color values | 656 occurrences across 83 files (project-wide) |
| Console.log/error/warn in smart-bi views | 61 occurrences |
| Unused `@playwright/test` dependency | 1 |
