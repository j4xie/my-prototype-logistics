# Cross-Page Consistency Audit Report (A6)
Date: 2026-02-11

## Executive Summary
- Pages analyzed: 20
- UI patterns identified: 10
- Consistency score: 4/10
- Cross-module sharing: ~10% (SmartBI shared components used by only 2 of 20 pages)
- Critical inconsistencies: 14

The data analysis module suffers from significant fragmentation. Three groups of pages (SmartBI views, Analytics views, Dashboard variants) were developed with different conventions and share almost no common components. KPI card implementations are duplicated at least 5 different ways. Date pickers, chart containers, loading states, and empty states all vary page-to-page. The Dashboard variants share the most consistent internal pattern (copy-paste consistency), while SmartBI views and Analytics views diverge from each other and from each other internally.

---

## Pattern Inventory

### Pattern 1: KPI Cards

**Implementation map:**

| File | Uses Shared `KPICard.vue`? | Card Layout | Interface Used | Styling |
|------|---------------------------|-------------|----------------|---------|
| `smart-bi/Dashboard.vue` | No | Inline computed from API `KPICard` interface | Local `KPICard` (lines 32-43) | Inline gradient text, `font-size: 36px`, `border-radius: 12px` |
| `smart-bi/SalesAnalysis.vue` | No | `el-row`/`el-col` with `el-card` | Local `KPICard` (lines 75-86) | `font-size: 28px`, centered, `border-radius: 8px` |
| `smart-bi/FinanceAnalysis.vue` | No | `el-row`/`el-col` with inline el-card | Local `FinanceKPI` interface (lines 122-149) | Module-specific layout per analysis type |
| `smart-bi/ProductionAnalysis.vue` | No | CSS grid `repeat(4, 1fr)` with gradient backgrounds | Local inline object array (lines 19, 81-86) | `border-radius: 12px`, white text on gradient, `font-size: 28px` |
| `smart-bi/ExcelUpload.vue` | **Yes** | Uses `<KPICard>` component | Imports `KPIData` from `@/api/smartbi` | Shared component styling |
| `smart-bi/DataCompletenessView.vue` | No | Custom module cards with progress bars | Local `CompletenessItem` (lines 18-23) | Custom score coloring, `font-size: 28px` |
| `analytics/index.vue` | No | `el-row`/`el-col` with `el-card`, `stat-card` class | Inline `overviewData` object | `border-top: 3px solid`, colored values, centered |
| `analytics/kpi/index.vue` | No | `el-progress` bars inside `el-card` | Local `kpiData` reactive object | Progress bar KPIs with targets, no card-style numbers |
| `analytics/AlertDashboard.vue` | No | Custom `.summary-card` divs | Local `AlertSummary` interface | Colored background cards, raw div layout |
| Dashboard variants (all 6) | No | `el-row`/`el-col` with data-driven `statCards` computed | `statCards` computed array: `{title, value, unit, icon, color, route}` | Consistent internally: `font-size: 28px`, icon in 48x48 box, `translateY(-2px)` hover |

**Inconsistencies:**

| Issue | File A | File B | Detail | Severity |
|-------|--------|--------|--------|----------|
| KPICard interface duplicated | `smart-bi/Dashboard.vue` (lines 32-43) | `smart-bi/SalesAnalysis.vue` (lines 75-86) | Same `KPICard` interface defined locally in both files; neither imports from `types/smartbi.ts` | HIGH |
| Shared KPICard component almost unused | `components/smartbi/KPICard.vue` | 19 other pages | Only `ExcelUpload.vue` imports the shared component; all others inline their own | HIGH |
| KPI value font size varies | `smart-bi/Dashboard.vue` | `analytics/index.vue` | 36px vs 28px vs variable | MEDIUM |
| KPI card border-radius | `ProductionAnalysis.vue` | `SalesAnalysis.vue` | 12px (gradient cards) vs 8px (el-card) | LOW |
| Layout system | `ProductionAnalysis.vue` | `SalesAnalysis.vue` | CSS grid `repeat(4,1fr)` vs `el-row`/`el-col` with responsive breakpoints | MEDIUM |

---

### Pattern 2: Date Range Selector / Period Picker

**Implementation map:**

| File | Date Selection Mechanism | Shortcut Options | Default Range |
|------|--------------------------|------------------|---------------|
| `smart-bi/SalesAnalysis.vue` | `el-date-picker` type="daterange" + custom `shortcuts` array | 7d, 30d, This Month, This Quarter (4 items) | Last 30 days |
| `smart-bi/FinanceAnalysis.vue` | `el-date-picker` type="daterange" + custom `shortcuts` array | 7d, 30d, This Month, This Quarter, This Year (5 items) | Last 30 days |
| `smart-bi/Dashboard.vue` | None (hardcoded `period=month`) | N/A | This month |
| `smart-bi/ProductionAnalysis.vue` | `el-select` with period options (week/month/quarter/year) | N/A | "month" |
| `analytics/trends/index.vue` | `el-select` with `periodOptions` (7d/30d/90d) | N/A | "week" |
| `analytics/production-report/index.vue` | `el-select` with period + `el-date-picker` for custom | today/week/month/custom (4 items) | "today" |
| `analytics/AlertDashboard.vue` | None | N/A | None (loads all) |
| `analytics/kpi/index.vue` | None | N/A | None (loads latest) |
| `components/smartbi/PeriodSelector.vue` | Shared component: `el-radio-group` with emits | day/week/month/quarter/year | "month" |
| Dashboard variants (all 6) | None (all dashboards load "today" or fixed period) | N/A | Fixed |

**Inconsistencies:**

| Issue | File A | File B | Detail | Severity |
|-------|--------|--------|--------|----------|
| PeriodSelector component unused | `PeriodSelector.vue` (shared) | All 20 pages | None of the pages import the shared PeriodSelector; each builds its own | HIGH |
| Shortcut options differ | `SalesAnalysis.vue` (4 shortcuts) | `FinanceAnalysis.vue` (5 shortcuts) | Finance adds "This Year", Sales omits it. Copy-paste divergence. | MEDIUM |
| Period options inconsistent | `ProductionAnalysis.vue` (week/month/quarter/year) | `analytics/trends` (7d/30d/90d) | Different granularity labels for the same concept | MEDIUM |
| Date picker vs select | `SalesAnalysis.vue` (el-date-picker) | `ProductionAnalysis.vue` (el-select) | Two different UI paradigms for time range selection, no unified pattern | HIGH |

---

### Pattern 3: Chart Container

**Implementation map:**

| File | Chart Init Method | Container Height | Card Wrapper | Error/Empty in Chart |
|------|-------------------|-----------------|--------------|---------------------|
| `smart-bi/Dashboard.vue` | `document.getElementById()` | 300px (trend), 280px (pie) | `el-card` | ECharts title as empty state |
| `smart-bi/SalesAnalysis.vue` | `document.getElementById()` | 320px (trend), 350px (pie) | `el-card` with `#header` template | ECharts title + `el-empty` fallback |
| `smart-bi/FinanceAnalysis.vue` | `document.getElementById()` | Not fixed consistently | `el-card` | Varies |
| `smart-bi/ProductionAnalysis.vue` | Template `ref` callback | `style="height: 350px"` inline | Plain `div.chart-card` (no el-card) | None (chart just empty) |
| `analytics/trends/index.vue` | `document.getElementById()` | 350px (CSS class `.chart`) | `el-card class="chart-card"` | None |
| `analytics/production-report/index.vue` | `document.getElementById()` | Dynamic calculated height | `el-card` | Title in ECharts config |
| `DashboardProduction.vue` | Template `ref` | 200px (gauge), 260px (yield) | `el-card` | `el-empty` |
| `components/smartbi/DynamicChartRenderer.vue` | Template `ref` | `height: 100%` with `min-height: 300px` | Standalone div | Full loading/error/empty states |

**Inconsistencies:**

| Issue | File A | File B | Detail | Severity |
|-------|--------|--------|--------|----------|
| DynamicChartRenderer unused broadly | `DynamicChartRenderer.vue` | SmartBI views | The shared renderer has proper loading/error/empty states but is not used by the main analysis views | HIGH |
| Chart heights vary | `SalesAnalysis` (320px) | `ProductionAnalysis` (350px) | No standard chart height. Ranges from 200px to 350px | MEDIUM |
| getElementById vs template ref | `SalesAnalysis.vue`, `Dashboard.vue`, `trends/index.vue` | `ProductionAnalysis.vue`, `DashboardProduction.vue` | Mixing `document.getElementById()` (non-reactive, fragile) with Vue template refs (recommended) | HIGH |
| Card wrapper inconsistency | `ProductionAnalysis.vue` (plain div) | Others (el-card) | No el-card wrapper means different shadow/border | MEDIUM |

---

### Pattern 4: Page Header

**Implementation map:**

| File | Header Element | Breadcrumbs? | Title Tag | Action Buttons Position | Header Padding |
|------|---------------|-------------|-----------|------------------------|----------------|
| `smart-bi/SalesAnalysis.vue` | `div.page-header` with flexbox | Yes (Smart BI > ...) | `<h1>` font-size: 20px | Right-aligned (Export + Refresh) | margin-bottom: 24px |
| `smart-bi/ProductionAnalysis.vue` | `div.page-header` with flexbox | No | `<h2>` font-size: 20px | Right-aligned (Select + Refresh) | margin-bottom: 20px |
| `smart-bi/DataCompletenessView.vue` | `div.page-header` with flexbox | No | `<h2>` font-size: 20px | Right-aligned (Refresh) | margin-bottom: 20px |
| `analytics/index.vue` | `div.page-header` (no flex) | No | `<h1>` font-size: 24px + subtitle | None | margin-bottom: 24px |
| `analytics/trends/index.vue` | `div.page-header` with flexbox | Yes (Analytics > ...) | `<h1>` font-size: unspecified | Right-aligned (Select + Refresh) | Unspecified |
| `analytics/kpi/index.vue` | `div.page-header` with flexbox | Yes (Analytics > ...) | `<h1>` | Right-aligned (Refresh) | Unspecified |
| `analytics/AlertDashboard.vue` | `div.page-header` with flexbox | No | `<h2>` | Right-aligned (Detect + Refresh) | margin-bottom: 20px |
| Dashboard variants (all 6) | `div.welcome-section` | No | `<h1>` font-size: 24px | Varies (Admin has AI button, others none) | margin-bottom: 24px |

**Inconsistencies:**

| Issue | File A | File B | Detail | Severity |
|-------|--------|--------|--------|----------|
| h1 vs h2 title tag | `SalesAnalysis.vue` (h1, 20px) | `ProductionAnalysis.vue` (h2, 20px) | Same visual size but different semantic tags | LOW |
| Breadcrumbs inconsistent | `SalesAnalysis.vue` (has breadcrumb) | `ProductionAnalysis.vue` (no breadcrumb) | SmartBI sub-pages: some have breadcrumbs, some do not | MEDIUM |
| Title font-size varies | `analytics/index.vue` (24px) | SmartBI views (20px) | Different heading scales between modules | MEDIUM |
| Header bottom margin | Pages use either 20px or 24px | -- | No standard | LOW |

---

### Pattern 5: Loading States

**Implementation map:**

| File | Loading Mechanism | Granularity | Loading Text |
|------|-------------------|------------|--------------|
| `smart-bi/SalesAnalysis.vue` | `v-loading` on `el-row` and `el-card` | Per-section: `kpiLoading`, `rankingLoading`, `trendLoading`, `pieLoading` | `element-loading-text="..."` on charts |
| `smart-bi/ProductionAnalysis.vue` | `v-loading` on `div.charts-grid` | Single `loading` ref for entire page | None |
| `smart-bi/SmartBIAnalysis.vue` | Custom `el-icon.is-loading` + `el-progress` | Multi-stage SSE progress with per-sheet status | Detailed progress text |
| `smart-bi/DataCompletenessView.vue` | `v-loading` on `div.module-grid` | Single `loading` ref | None |
| `analytics/index.vue` | `v-loading` on `el-row.overview-cards` | Single `loading` ref | None |
| `analytics/trends/index.vue` | `v-loading` on `div.charts-container` | Single `loading` ref | None |
| `analytics/ai-reports/index.vue` | `v-loading` on `el-table` | Separate `loading` and `anomalyLoading` | None |
| `analytics/AlertDashboard.vue` | `v-loading` on summary row and separate `loadingAlerts` | Per-section: `loading`, `loadingAlerts`, `detecting`, `resolving` | None |
| Dashboard variants (all 6) | `v-loading` on root `div` | Single `loading` ref | None |

**Inconsistencies:**

| Issue | File A | File B | Detail | Severity |
|-------|--------|--------|--------|----------|
| Per-section vs full-page loading | `SalesAnalysis.vue` (4 loading refs) | `ProductionAnalysis.vue` (1 loading ref) | SalesAnalysis gives fine-grained feedback; ProductionAnalysis blocks entire page | MEDIUM |
| No skeleton loading anywhere | All 20 pages | -- | None use skeleton screens (el-skeleton); all use spinner overlays | LOW |
| Loading text used inconsistently | `SalesAnalysis.vue` (has text) | All others (no text) | Only SalesAnalysis provides loading text on charts | LOW |

---

### Pattern 6: Empty States

**Implementation map:**

| File | Empty State Component | Empty State Message | Has Action Guidance? |
|------|----------------------|--------------------|--------------------|
| `smart-bi/SalesAnalysis.vue` | `el-empty` with description + ECharts title text | "No KPI data" / "No trend data" | No |
| `smart-bi/Dashboard.vue` | ECharts title text (grey centered text) | "No data" | No |
| `smart-bi/ProductionAnalysis.vue` | None (charts just render empty if no data) | N/A | No |
| `smart-bi/DataCompletenessView.vue` | `el-empty` | "No completeness data" | No |
| `smart-bi/SmartBIAnalysis.vue` | `el-empty` for read-only users | "Contact admin to upload" | Yes (for read-only) |
| `analytics/index.vue` | None | N/A | No |
| `analytics/ai-reports/index.vue` | `el-empty` for anomalies | "No anomalies" / service error message | Partial (shows error text) |
| `analytics/AlertDashboard.vue` | None shown in table empty slot | N/A | No |
| `DashboardProduction.vue` | `el-empty` for OEE and yield | "No OEE data" / "No yield data" | No |
| `DashboardHR.vue` | `el-empty` for employee distribution | "No employee data" | No |
| `DashboardWarehouse.vue` | `el-empty` for low stock | "No stock warnings" | No |

**Inconsistencies:**

| Issue | File A | File B | Detail | Severity |
|-------|--------|--------|--------|----------|
| No empty state at all | `ProductionAnalysis.vue`, `analytics/index.vue` | `SalesAnalysis.vue` (proper el-empty) | Some pages show nothing when data is absent | HIGH |
| Mixed empty strategies | `Dashboard.vue` (ECharts title) | `SalesAnalysis.vue` (el-empty + ECharts title) | Two parallel empty state systems in same codebase | MEDIUM |
| No action guidance | Most pages | `SmartBIAnalysis.vue` (contact admin) | Only 1 out of 20 pages suggests next steps | MEDIUM |

---

### Pattern 7: Error Handling UI

**Implementation map:**

| File | Error Display | Error Recovery | Error State Tracked? |
|------|--------------|----------------|---------------------|
| `smart-bi/Dashboard.vue` | `hasError` ref + `errorMessage` + `ElMessage.error` | Retry via refresh button | Yes (`hasError`, `errorMessage`) |
| `smart-bi/SalesAnalysis.vue` | `ElMessage.error` per section | Manual refresh button | No dedicated error state |
| `smart-bi/ProductionAnalysis.vue` | `console.error` only | Manual refresh button | No |
| `smart-bi/DataCompletenessView.vue` | `console.error` only | Manual refresh button | No |
| `analytics/index.vue` | `console.error` only | No retry button | No |
| `analytics/ai-reports/index.vue` | `ElMessage.error` + `anomalyError` ref | Refresh buttons on each section | Partial (`anomalyError` string) |
| `analytics/AlertDashboard.vue` | `ElMessage.error` / `ElMessage.success` | Refresh button | No dedicated error state |
| Dashboard variants | `console.error` only | No retry button | No |
| `DashboardFinance.vue` | `aiError` ref with fallback mock data + retry button | Retry button in UI | Yes (`aiError`) |

**Inconsistencies:**

| Issue | File A | File B | Detail | Severity |
|-------|--------|--------|--------|----------|
| Silent failures | `ProductionAnalysis.vue` (console.error only) | `SalesAnalysis.vue` (ElMessage.error) | User gets no feedback on failure in ProductionAnalysis | HIGH |
| Fallback to mock data | `DashboardFinance.vue` (falls back to fake data on error) | Project rule: "No fake data" | Violates `CLAUDE.md` rule: "Do not return fake data, show errors explicitly" | CRITICAL |
| No dedicated error state | 15 of 20 pages | `Dashboard.vue`, `DashboardFinance.vue` | Only 2 pages track error state in a ref; others cannot show persistent error UI | HIGH |
| No retry mechanism | `analytics/index.vue`, most dashboards | `DashboardFinance.vue` (retry button) | Most pages offer no way to retry after error without full page reload | MEDIUM |

---

### Pattern 8: Table/List Pattern

**Implementation map:**

| File | Uses el-table? | Stripe? | Pagination? | Table Height |
|------|---------------|---------|-------------|-------------|
| `smart-bi/SalesAnalysis.vue` | Yes (ranking table) | Yes | No | Auto |
| `smart-bi/ProductionAnalysis.vue` | Yes (data section) | Yes + border | No | max-height: 400px |
| `smart-bi/DataCompletenessView.vue` | Yes (field detail) | Yes | No | Auto |
| `analytics/ai-reports/index.vue` | Yes (report list) | Yes | No | Auto |
| `analytics/AlertDashboard.vue` | Yes (alert list) | Yes | Yes (el-pagination) | Auto |

**Inconsistencies:**

| Issue | File A | File B | Detail | Severity |
|-------|--------|--------|--------|----------|
| Pagination only in AlertDashboard | `AlertDashboard.vue` (has pagination) | All other tables | Other tables load all data with no pagination | MEDIUM |
| Table border inconsistency | `ProductionAnalysis.vue` (stripe + border) | `SalesAnalysis.vue` (stripe, no border) | Minor visual difference | LOW |
| Max-height constraint inconsistent | `ProductionAnalysis.vue` (max-height: 400px) | Others (no max-height) | Could cause scroll issues with large datasets | LOW |

---

### Pattern 9: AI Panel / Chat Interface

**Implementation map:**

| File | AI Feature | Implementation | Uses Shared Component? |
|------|-----------|----------------|----------------------|
| `smart-bi/AIQuery.vue` | Full chat interface | Custom chat bubbles, quick questions, chart rendering in messages | Imports `AIInsightPanel` from shared |
| `smart-bi/ExcelUpload.vue` | AI insights display | Uses `AIInsightPanel` component | Yes |
| `smart-bi/Dashboard.vue` | AI insights sidebar | Inline rendering of `aiInsights` computed from API | No (inline) |
| `smart-bi/ProductionAnalysis.vue` | AI analysis section | Inline markdown rendering via `marked()` | No |
| `analytics/ai-reports/index.vue` | AI report list + anomaly panel | `el-table` + dialog for report detail | No |
| `components/smartbi/AIInsightPanel.vue` | Shared insight display | Accepts `insights` prop, renders cards with severity coloring | Shared component |

**Inconsistencies:**

| Issue | File A | File B | Detail | Severity |
|-------|--------|--------|--------|----------|
| AIInsightPanel barely used | `AIInsightPanel.vue` (shared) | `Dashboard.vue`, `ProductionAnalysis.vue` | Only ExcelUpload and AIQuery use the shared component; Dashboard and ProductionAnalysis inline their own | MEDIUM |
| AI insight rendering differs | `ProductionAnalysis.vue` (v-html + marked) | `Dashboard.vue` (template loop) | Different rendering approaches for same concept | MEDIUM |
| Chat interface is standalone | `AIQuery.vue` | -- | No reusable chat component extracted; tightly coupled to page | LOW |

---

### Pattern 10: Navigation / Tab Pattern

**Implementation map:**

| File | Tab/Nav Mechanism | Tab Position | Active Styling |
|------|-------------------|-------------|----------------|
| `smart-bi/SalesAnalysis.vue` | `el-radio-group` for dimension (daily/weekly/monthly) | Inline in filter bar | Default Element Plus |
| `smart-bi/FinanceAnalysis.vue` | `el-tabs` for analysis type (profit/cost/receivable/payable/budget) | Top of content area | Default Element Plus |
| `smart-bi/SmartBIAnalysis.vue` | `el-tabs` for sheet navigation | Top of result section | Custom `.is-index` class highlighting |
| `smart-bi/Dashboard.vue` | No tabs | N/A | N/A |
| `analytics/trends/index.vue` | `el-select` for period + module filter | In header-right area | Default Element Plus |
| `analytics/AlertDashboard.vue` | `el-select` for status + level filter | Below header in filter-bar | Default Element Plus |

**Inconsistencies:**

| Issue | File A | File B | Detail | Severity |
|-------|--------|--------|--------|----------|
| Filter placement varies | `SalesAnalysis.vue` (dedicated filter card) | `AlertDashboard.vue` (bare div.filter-bar) | Different visual containers for filter controls | MEDIUM |
| Radio group vs select vs tabs | `SalesAnalysis.vue` (radio for dimension) | `trends/index.vue` (select for period) | Similar concepts implemented with different widgets | LOW |

---

## Dashboard Variant Comparison Matrix

| Aspect | Admin | HR | Production | Warehouse | Finance | Default |
|--------|-------|----|-----------|-----------|---------|---------|
| **Root Class** | `.dashboard-admin` | `.dashboard-hr` | `.dashboard-production` | `.dashboard-warehouse` | `.dashboard-finance` | `.dashboard-default` |
| **Grid Layout** | `el-row :gutter="20"` | `el-row :gutter="20"` | `el-row :gutter="20"` | `el-row :gutter="20"` | `el-row :gutter="20"` | `el-row :gutter="20"` |
| **Stat Card Count** | 4 | 4 | 4 | 4 | 4 | Dynamic (by permission) |
| **Color Theme** | Blue/Green/Yellow/Red | Blue/Green/Yellow/Grey | Blue/Green/Yellow/Grey | Blue/Red/Green/Yellow | Blue/Yellow/Green/Grey | Per-module distinct colors |
| **Has ECharts?** | No | No | Yes (OEE gauge + yield chart) | No | No | No |
| **API Calls** | 4 parallel (overview, production, quality, equipment) | 2 parallel (users, departments) + mock | 4 parallel (overview, production, OEE, yield-trend) | 2 parallel (materials, shipments) + mock | 1 (smart-bi finance) | 1 (overview) |
| **Loading State** | `v-loading` on root div | `v-loading` on root div | `v-loading` on root div | `v-loading` on root div | `v-loading` on root div | `v-loading` on root div |
| **Empty State** | None | `el-empty` for employee dist. | `el-empty` for OEE/yield | `el-empty` for low stock | None | None |
| **Auto-Refresh** | No | No | Yes (30s interval) | No | No | No |
| **Welcome Section** | Yes (with AI button) | Yes | Yes | Yes | Yes (with AI button + "Web" tag) | Yes |
| **Quick Actions** | 5 items | 4 items | 3 items | 3 items | 2 items | Dynamic by permission |
| **Mock Data Used** | No | Yes (attendance) | No | Yes (lowStock, inbound, outbound) | Yes (fallback on error) | No |
| **Stat Value Font** | 28px / 600 weight | 28px / 600 weight | 28px / 600 weight | 28px / 600 weight | 28px / 600 weight | 28px / 700 weight |
| **Stat Icon Size** | 48x48, border-radius: 8px | 48x48, border-radius: 8px | 48x48, border-radius: 8px | 48x48, border-radius: 8px | 48x48, border-radius: 8px | N/A (module grid) |
| **Icon BG Color** | `card.color + '20'` | `card.color + '20'` | `card.color + '20'` | `card.color + '20'` | `hexToRgba(card.color, 0.12)` | N/A |
| **Hover Effect** | `translateY(-2px)` | `translateY(-2px)` | `translateY(-2px)` | `translateY(-2px)` | `translateY(-2px)` | `translateY(-4px)` |
| **Card Margin Bottom** | 20px | 20px | 20px | 20px | 16px (stat) / 24px (el-card) | 16px |
| **min-height** | `calc(100vh - 144px)` | `calc(100vh - 144px)` | `calc(100vh - 144px)` | `calc(100vh - 144px)` | `calc(100vh - 144px)` | None |

**Key dashboard variant findings:**
1. The 5 role-specific dashboards (Admin, HR, Production, Warehouse, Finance) share a nearly identical copy-paste structure for stat cards, welcome section, and quick actions. The CSS is duplicated across all files (approximately 60-80 lines of identical `.stat-cards`, `.quick-actions-card` styling in each).
2. Finance dashboard uses `hexToRgba()` for icon background while all others use string concatenation `card.color + '20'`. This produces slightly different opacity values.
3. Default dashboard has a completely different design (no stat-card pattern, uses module navigation grid instead).
4. Only Production dashboard has auto-refresh (30s). Others require manual refresh.
5. HR and Warehouse dashboards use mock/random data for some statistics, violating the project's "no fake data" rule.

---

## Module Boundary Analysis

### SmartBI <-> Analytics Overlap

| Shared Pattern | SmartBI Implementation | Analytics Implementation | Should Merge? |
|----------------|----------------------|------------------------|---------------|
| **KPI display** | Custom per-page (5 different implementations), plus shared `KPICard.vue` (barely used) | Custom per-page (`stat-card`, `summary-card`, progress bars) | Yes - extract unified KPI component |
| **Date range selection** | `el-date-picker` with shortcuts OR `el-select` with period | `el-select` with period options | Yes - use shared `PeriodSelector.vue` |
| **ECharts usage** | Direct `echarts.init()` + `getElementById` or template ref | Direct `echarts.init()` + `getElementById` | Yes - use shared `DynamicChartRenderer.vue` |
| **Loading state** | `v-loading` directive | `v-loading` directive | Already consistent |
| **Error handling** | Mix of ElMessage + console.error | Mostly console.error only | Needs unification |
| **API client** | Uses `@/api/smartbi` functions OR `get()` from `@/api/request` | Uses only `get()` from `@/api/request` | SmartBI module has its own API layer; Analytics does not |
| **AI insights** | `AIInsightPanel.vue` shared component | Inline rendering or `el-table` for reports | Partially mergeable |
| **Type definitions** | `@/types/smartbi.ts` has shared types, but pages define local duplicates | No shared types | SmartBI types should be used by Analytics too |

### Cross-Module Component Usage

| Component | Used In SmartBI Views? | Used In Analytics Views? | Used In Dashboard Variants? |
|-----------|----------------------|------------------------|---------------------------|
| `KPICard.vue` | 1/8 (ExcelUpload only) | 0/6 | 0/6 |
| `DynamicChartRenderer.vue` | 0/8 | 0/6 | 0/6 |
| `AIInsightPanel.vue` | 2/8 (ExcelUpload, AIQuery) | 0/6 | 0/6 |
| `PeriodSelector.vue` | 0/8 | 0/6 | 0/6 |

**Conclusion:** The shared components in `components/smartbi/` are almost entirely unused. They represent dead or aspirational code. Out of 4 shared components, the total usage across 20 pages is only 3 imports.

### Should SmartBI and Analytics Merge?

**No, but they should share infrastructure.** SmartBI focuses on uploaded Excel data analysis (Python service at port 8083), while Analytics focuses on operational data from the Java backend (port 10010). Their data sources and business purposes differ. However, they should:
1. Share the same UI component library for KPIs, charts, periods, and empty states
2. Share type definitions
3. Follow the same page layout structure

---

## Consistency Score by Category

| Category | Score (1-10) | Key Issues |
|----------|-------------|------------|
| Component Reuse | 2 | 4 shared components exist but are used by only 3 out of 20 pages total |
| Visual Consistency | 4 | Dashboard variants are internally consistent (copy-paste), but SmartBI and Analytics pages differ significantly in card styling, colors, and spacing |
| Interaction Patterns | 3 | Date selection uses 4 different mechanisms (date-picker, select, radio, hardcoded). No standard filter bar pattern |
| Code Patterns | 3 | Some pages use `getElementById` (fragile), others use template refs. Local interface duplication across pages. Mix of `any` and proper typing |
| Error Handling | 2 | Most pages silently fail with `console.error`. Only 2/20 track error state. 3 pages use mock fallback data (violates rules). No standard error recovery pattern |
| Loading States | 5 | All use `v-loading` consistently, but granularity varies (full-page vs per-section). No skeleton loading anywhere |
| Empty States | 3 | Inconsistent use of `el-empty` vs ECharts-title-as-empty vs nothing. No action guidance in empty states |
| Type Safety | 4 | `@/types/smartbi.ts` exists with shared types, but pages define local duplicates. `analytics` pages use `any` extensively |

**Overall: 4/10**

---

## Prioritized Consistency Fixes

| # | Issue | Files Affected | Severity | Effort | Fix Type |
|---|-------|---------------|----------|--------|----------|
| 1 | **DashboardFinance/HR/Warehouse use mock data** | `DashboardFinance.vue`, `DashboardHR.vue`, `DashboardWarehouse.vue` | CRITICAL | Small | Remove mock fallbacks; show error state or "no data" instead |
| 2 | **Shared KPICard component unused by 19/20 pages** | All 20 pages | HIGH | Large | Refactor all KPI displays to use `KPICard.vue` or a new unified component |
| 3 | **Shared PeriodSelector unused everywhere** | All pages with date selection | HIGH | Medium | Replace inline date pickers/selects with `PeriodSelector.vue` (extend if needed) |
| 4 | **Shared DynamicChartRenderer unused everywhere** | All 12 pages with ECharts | HIGH | Large | Migrate chart rendering to use shared renderer with loading/error/empty states |
| 5 | **getElementById for chart init (fragile)** | `SalesAnalysis.vue`, `Dashboard.vue`, `FinanceAnalysis.vue`, `trends/index.vue`, `production-report/index.vue` | HIGH | Medium | Convert all to Vue template refs |
| 6 | **Silent error handling (console.error only)** | `ProductionAnalysis.vue`, `DataCompletenessView.vue`, `analytics/index.vue`, all Dashboard variants except Finance | HIGH | Small | Add `ElMessage.error` at minimum; track error state for persistent UI |
| 7 | **KPICard interface duplicated locally** | `Dashboard.vue`, `SalesAnalysis.vue` | HIGH | Small | Import from `@/types/smartbi.ts` instead of re-declaring |
| 8 | **Dashboard variant CSS duplication** | All 6 Dashboard*.vue files | MEDIUM | Medium | Extract shared `.stat-cards`, `.quick-actions-card`, `.welcome-section` styles into a mixin or shared SCSS partial |
| 9 | **Icon background color method differs** | `DashboardFinance.vue` (`hexToRgba`) vs others (`+ '20'`) | MEDIUM | Small | Standardize on one approach |
| 10 | **Breadcrumbs inconsistent in SmartBI pages** | `SalesAnalysis.vue` (has) vs `ProductionAnalysis.vue` (missing) | MEDIUM | Small | Add breadcrumbs to all sub-pages or none |
| 11 | **No empty state in several pages** | `ProductionAnalysis.vue`, `analytics/index.vue` | MEDIUM | Small | Add `el-empty` when data arrays are empty |
| 12 | **Date shortcut options differ** | `SalesAnalysis.vue` (4 items), `FinanceAnalysis.vue` (5 items) | MEDIUM | Small | Standardize shortcut list in a shared constant |
| 13 | **analytics pages use `any` extensively** | `trends/index.vue`, `ai-reports/index.vue` | MEDIUM | Medium | Replace `any` with proper interfaces from `@/types/` |
| 14 | **Auto-refresh only in DashboardProduction** | `DashboardProduction.vue` (30s), `ProductionAnalysis.vue` (60s) | LOW | Small | Decide on auto-refresh policy; apply consistently or remove |
