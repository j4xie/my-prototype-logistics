# Industry Benchmark Report (A5)
Date: 2026-02-11

## Executive Summary

**Overall Score: 58/100**

Our SmartBI module is a competent mid-tier BI implementation with strong data-upload-and-analyze capabilities and respectable AI integration. However, it falls short of industry leaders (Tableau, Power BI, FineBI) in several critical UX dimensions: chart interactivity, filter sophistication, loading/empty/error state polish, responsive design, and color system consistency.

**Benchmark Position:** We sit roughly at the level of a *junior Metabase* -- functional self-service analytics with AI as a differentiator, but lacking the visual polish and interaction depth of commercial BI platforms. Our AI integration (NL query, auto-insights, structured positive/negative/suggestion panels) is notably ahead of open-source alternatives but behind Power BI Copilot's 2026 capabilities.

---

## Our Current Feature Inventory

### Views (11 SmartBI + 7 Analytics)
| File | Feature |
|------|---------|
| `src/views/smart-bi/Dashboard.vue` | Executive cockpit: 4 KPI cards, dept/region ranking, sales trend line, pie chart, AI insights |
| `src/views/smart-bi/SmartBIAnalysis.vue` (3,937 lines) | Core analysis: Excel upload + SSE progress, multi-sheet tabs, KPI cards, dynamic charts, drill-down drawer, cross-sheet analysis, YoY comparison, causal/statistical analysis, dashboard builder, cross-chart filtering, chart export (PNG/SVG) |
| `src/views/smart-bi/AIQuery.vue` | NL chat interface, quick questions, chart rendering in responses, context-aware follow-up |
| `src/views/smart-bi/FinanceAnalysis.vue` | Finance KPIs (profit/cost/receivable/payable/budget), data source selection, date shortcuts, warnings |
| `src/views/smart-bi/SalesAnalysis.vue` | Sales KPI cards, sales-person ranking, trend/pie charts, dimension toggle, category filter |
| `src/views/smart-bi/ProductionAnalysis.vue` | Production KPIs, daily output trend, yield trend, product/equipment/personnel charts, AI markdown analysis |
| `src/views/smart-bi/DataCompletenessView.vue` | Data quality: module completeness scores, field-level progress bars |
| `src/views/smart-bi/ExcelUpload.vue` | Step wizard: upload, parse, analyze, save-confirm; field mapping |
| `src/views/smart-bi/calibration/CalibrationDashboard.vue` | AI behavior calibration: metrics, trends, tool reliability, tool call records |
| `src/views/analytics/index.vue` | Analytics overview: 6 module cards (production, quality, warehouse, equipment, sales, finance) |
| `src/views/analytics/kpi/index.vue` | KPI dashboard: OEE, yield, FPY, defect/rework/scrap rates, delivery, cost |
| `src/views/analytics/trends/index.vue` | Trend charts: production, quality, cost; period/module selectors |
| `src/views/analytics/ai-reports/index.vue` | AI report list + anomaly detection sidebar |
| `src/views/analytics/smart-bi/AdvancedFinanceAnalysis.vue` | Phase 4 finance: period selector, budget achievement, YoY/MoM comparison, nested donut, category structure, waterfall, AI insight panel |
| `src/views/analytics/AlertDashboard.vue` | Alert monitoring |

### Components (22 SmartBI + 6 Dashboard)
| Component | Purpose |
|-----------|---------|
| `KPICard.vue` | Multi-mode card: default, sparkline, progressBar, waterWave; trend, changeRate, benchmark comparison |
| `DynamicChartRenderer.vue` | Universal chart renderer: auto-detects legacy/dynamic/dashboard config formats; supports line, bar, pie, area, map |
| `AIInsightPanel.vue` | Structured AI insights: positive/negative/suggestions, confidence badge, skeleton loading, error/empty states |
| `DashboardBuilder.vue` | Drag-and-drop 12-column grid layout builder with resize handles and card sidebar |
| `PeriodSelector.vue` | Year/month/quarter selector with compare toggle |
| `TrendChart.vue` | Line/area chart wrapper |
| `PieChart.vue` | Pie/donut chart |
| `RadarChart.vue` | Radar chart |
| `RankingChart.vue` | Horizontal bar ranking |
| `GaugeChart.vue` | Gauge/speedometer |
| `HeatmapChart.vue` | Heatmap matrix |
| `MapChart.vue` | China geographic map |
| `WaterfallChart.vue` | Waterfall decomposition |
| `NestedDonutChart.vue` | Multi-ring donut |
| `CombinedChart.vue` | Mixed line+bar |
| `BudgetAchievementChart.vue` | Budget vs actual |
| `YoYMoMComparisonChart.vue` | Year-over-year / month-over-month |
| `CategoryStructureComparisonChart.vue` | Category structure comparison |
| `DynamicChartsSection.vue` | Auto-layout chart grid |
| `DynamicKPIRow.vue` | Auto-layout KPI card row |
| `DynamicRankingsRow.vue` | Auto-layout ranking row |
| `DataConfidenceBadge.vue` | Data quality indicator |

### Key Capabilities Summary
- Excel upload with multi-sheet parsing and SSE real-time progress
- AI-generated KPIs, charts, and narrative analysis from uploaded data
- Natural language query with chat interface
- Multi-level drill-down with breadcrumb navigation
- Cross-sheet aggregation analysis
- YoY/MoM comparison
- Causal/statistical analysis (correlation heatmap, distribution, Pareto, outlier detection)
- Drag-and-drop dashboard builder (12-column CSS grid)
- Cross-chart filtering (click one chart to filter others)
- Chart export (PNG/SVG)
- Structured AI insight panels (positive/negative/suggestions with confidence score)
- Executive summary banner with inline KPIs and risk/opportunity tags
- Data completeness scoring

---

## 10-Dimension Scoring Matrix

| # | Dimension | Our Score | Industry Avg | Gap | Key Finding |
|---|-----------|-----------|-------------|-----|-------------|
| 1 | KPI Card Design | 7 | 8 | -1 | Solid KPICard component with sparklines, trends, benchmark; missing conditional background coloring and animation |
| 2 | Chart Interaction | 5 | 8 | -3 | Drill-down exists but single-path; no click-to-cross-filter on Dashboard, no tooltip detail cards |
| 3 | Filter/Slicer UX | 4 | 8 | -4 | Date shortcuts exist but no connected slicers, no global filter bar, no filter summary chips |
| 4 | Loading States | 5 | 7 | -2 | v-loading directives used broadly; skeleton only in AIInsightPanel; no per-chart skeleton |
| 5 | Empty States | 5 | 7 | -2 | el-empty used but generic; no illustrations, no guided action CTAs |
| 6 | Error States | 5 | 7 | -2 | Error alert at top level; no per-widget error boundary or retry per chart |
| 7 | Data Drill-down | 7 | 8 | -1 | Multi-level drill with breadcrumbs and AI insight; available dimensions shown; lacks drill-through to full detail page |
| 8 | AI Integration | 7 | 7 | 0 | NL query, structured insights, auto-charts, executive summary -- on par with industry for vertical BI |
| 9 | Responsive Design | 4 | 7 | -3 | el-col breakpoints on KPI cards; charts use fixed heights; no mobile-optimized layout; no touch gestures |
| 10 | Color Consistency | 4 | 8 | -4 | PIE_COLORS hardcoded; no design token system; Element Plus defaults mixed with ad-hoc hex codes |
|   | **TOTAL** | **53** | **75** | **-22** | |

*Note: Scores normalized to 10-point scale. Industry Avg reflects the median of Tableau, Power BI, FineBI, Lark Bitable, Metabase, and Superset.*

---

### Dimension 1: KPI Card Design (7/10)

**Our implementation:**
The `KPICard.vue` component (`src/components/smartbi/KPICard.vue`) is well-designed with multiple display modes (`default`, `sparkline`, `progressBar`, `waterWave`), trend arrows (up/down/flat), changeRate formatting, progress-to-target bars, sub-metrics, and even industry benchmark comparison (`benchmarkLabel`, `benchmarkGap`). The `Dashboard.vue` uses hardcoded KPI cards without the reusable component, duplicating the pattern.

**Industry standard (Tableau / Power BI / FineBI):**
- Power BI 2026 cards support multi-card layouts with images/icons, conditional formatting, background color changes based on thresholds, callout formatting, and sparklines natively built into the card visual.
- Tableau KPI cards use large hero numbers, trend arrows with sparklines, percentage-change badges with conditional coloring (green/red), and smaller secondary metrics below.
- FineBI provides template-based KPI cards with one-click application of industry-leading designs.

**Gap:**
- Dashboard.vue does not use the KPICard component -- it manually constructs cards, missing sparklines and benchmark features
- No animated count-up transitions on initial load
- No conditional background color (e.g., card turns red when metric falls below threshold)
- No click-to-drill from KPI card to detail view on Dashboard page

**Improvement plan:**
1. Refactor `Dashboard.vue` KPI section to use `KPICard.vue` component (S)
2. Add animated count-up with `vue-countup-v3` or CSS counter animation (S)
3. Add conditional card background/border based on status (S)
4. Make KPI cards clickable with router navigation to detail pages (S)

---

### Dimension 2: Chart Interaction (5/10)

**Our implementation:**
- `SmartBIAnalysis.vue` supports click-on-chart drill-down into a right-side drawer, with breadcrumb navigation and AI insight
- Cross-chart filtering (`activeFilter`) is implemented in SmartBIAnalysis with a filter bar
- Chart export (PNG/SVG) via dropdown menu
- `DynamicChartRenderer.vue` provides tooltips via ECharts defaults (axis pointer, cross)
- No chart interaction on `Dashboard.vue`, `SalesAnalysis.vue`, or `FinanceAnalysis.vue`

**Industry standard (Tableau / Power BI):**
- Power BI: Click any visual to cross-filter/cross-highlight all other visuals on the page. Drill-through pages let users right-click a data point and navigate to a detail page with context. Tooltip pages show a miniature report on hover.
- Tableau: Multi-level drill-down with breadcrumbs. Click to filter actions. Highlight actions. URL actions for external navigation. Dashboard actions cascade across sheets.
- Metabase: "Automagic drill-through" lets anyone click into the "why" behind a chart automatically.

**Gap:**
- Dashboard.vue charts have zero interactivity (no click events, no drill-down)
- SalesAnalysis.vue and FinanceAnalysis.vue charts lack click-to-drill
- No hover tooltip detail cards (mini-report on hover)
- Cross-chart filtering only in SmartBIAnalysis, not propagated to domain-specific analysis pages
- No right-click context menu for chart actions

**Improvement plan:**
1. Add click events to Dashboard.vue charts for navigation to detail pages (M)
2. Implement cross-highlighting on SalesAnalysis and FinanceAnalysis pages (M)
3. Add rich tooltip cards showing additional context on hover (L)
4. Implement a shared `useChartInteraction` composable for consistent interaction across all pages (M)

---

### Dimension 3: Filter/Slicer UX (4/10)

**Our implementation:**
- `SalesAnalysis.vue`: Date range picker with shortcuts (7d/30d/month/quarter), dimension toggle (daily/weekly/monthly), category dropdown
- `FinanceAnalysis.vue`: Date range picker with shortcuts, analysis type tabs, data source selector
- `ProductionAnalysis.vue`: Period selector (month) and dimension selector (date)
- `Dashboard.vue`: No filters at all (hardcoded `period=month`)
- `AdvancedFinanceAnalysis.vue`: PeriodSelector component with year/month/quarter and compare toggle
- SmartBIAnalysis.vue: Cross-chart filter bar for uploaded data

**Industry standard (Tableau / Power BI / FineBI):**
- Power BI: Global filter pane on the side, slicer visuals on canvas, cross-filtering between visuals, filter summary showing active filters at a glance, "Clear all" button, recently applied filters.
- Tableau: Dashboard-level filters that cascade to all worksheets. Quick filters with search. Dependent/cascading filters. Filter actions between sheets.
- FineBI: Drag-and-drop filter configuration. Connected filters across dashboards. Filter presets.
- Lark Bitable: Role-based permission filters that show different data to different users automatically.

**Gap:**
- No global filter bar / filter pane across the SmartBI module
- No filter summary chips showing what is currently filtered
- No "Clear all filters" button
- No cascading/dependent filters
- No saved filter presets
- Dashboard.vue has zero filtering capability
- Filters are page-local, not shared across navigation within SmartBI

**Improvement plan:**
1. Add a global SmartBI filter bar component with date range, factory, and dimension selectors (L)
2. Add filter summary chip bar at the top of each analysis page (M)
3. Implement "Clear all" and "Save filter preset" functionality (M)
4. Add period selector to Dashboard.vue (S)
5. Share filter state across SmartBI pages via Pinia store or provide/inject (M)

---

### Dimension 4: Loading States (5/10)

**Our implementation:**
- `v-loading` (Element Plus spinning overlay) used on card containers throughout Dashboard, SalesAnalysis, FinanceAnalysis, ProductionAnalysis, Analytics pages
- `AIInsightPanel.vue` has proper skeleton loading with `el-skeleton` matching final layout
- `SmartBIAnalysis.vue` shows spinning icon + text for upload progress, chart generation, drill-down loading
- Individual loading states per section in SalesAnalysis (kpiLoading, rankingLoading, trendLoading, pieLoading)
- No skeleton screens for KPI cards, charts, or ranking lists

**Industry standard (FineBI / Power BI / Carbon Design System):**
- Skeleton states matching final component layout (card shape, chart rectangle, text lines)
- Staggered/batched loading: skeleton structure first, then data fills in progressively
- Skeleton-to-content transition animations
- Per-widget skeleton loading (not a single spinner covering everything)
- Research shows skeleton screens improve perceived performance and user satisfaction (Nielsen Norman Group)

**Gap:**
- `v-loading` covers entire sections with a spinner, hiding layout structure
- No skeleton screens for KPI cards, chart containers, or ranking lists
- No staggered loading pattern
- No transition animation from skeleton to real content
- Upload SSE progress is well done but is an exception, not the norm

**Improvement plan:**
1. Create `KPICardSkeleton.vue` and `ChartSkeleton.vue` components matching final layout shapes (M)
2. Replace `v-loading` on KPI/chart sections with skeleton screens (M)
3. Add fade-in transition when data arrives (S)
4. Implement batched/staggered loading: show skeleton structure immediately, then fill KPIs first, then charts (M)

---

### Dimension 5: Empty States (5/10)

**Our implementation:**
- `el-empty` with text descriptions used in Dashboard.vue rankings, SmartBIAnalysis sheets, FinanceAnalysis, drill-down results
- SmartBIAnalysis.vue has role-aware empty state (admin sees upload zone, read-only users see "contact admin" message)
- DataCompletenessView has simple `el-empty` for no data
- DynamicChartRenderer shows "暂无数据" centered text when chart has no data
- No illustrations, no guided action CTAs, no contextual help

**Industry standard (Lark / Carbon Design System / NN/g):**
- Lark Bitable: Custom illustrations + explanatory text + primary action button (e.g., "Upload your first dataset" or "Connect a data source")
- Carbon Design System: Specific guidance on what will appear, action-oriented messaging, optional links to documentation
- NN/g: Three types of empty states -- first-use, user-cleared, error-based, each with different messaging patterns
- Power BI: Contextual empty states with links to sample datasets and learning resources

**Gap:**
- Empty states are text-only, no custom illustrations
- No action buttons guiding users to the next step (except SmartBIAnalysis upload)
- DynamicChartRenderer empty state is just centered text in the chart area
- No distinction between "no data yet" (first use) vs "no data found" (filtered to nothing)
- No links to help documentation or getting-started guides

**Improvement plan:**
1. Create custom empty state illustrations (SVG) for key scenarios: no data, no results, first-time setup (M)
2. Add primary action CTA buttons to empty states (e.g., "Upload Excel", "Adjust Filters", "View Sample Data") (S)
3. Differentiate first-use empty state from no-results empty state (S)
4. Add tooltip or help link on chart empty states explaining what data is needed (S)

---

### Dimension 6: Error States (5/10)

**Our implementation:**
- `Dashboard.vue`: Top-level `el-alert` with error message, closable; catches API errors and shows message
- `SalesAnalysis.vue`: `ElMessage.error()` toast for API failures; console.error for debugging
- `FinanceAnalysis.vue`: Similar toast pattern
- `AIInsightPanel.vue`: Error state with icon + message + "重新生成" retry button -- this is the best error handling in the module
- `SmartBIAnalysis.vue`: SSE upload errors shown as progress failure; drill-down has empty/error states; failed sheets show `el-result` with retry button
- `DataCompletenessView.vue`: try/catch with console.error, no user-visible error state

**Industry standard (Power BI / Carbon Design System):**
- Power BI: Per-visual error messages with retry, partial data display when some sources fail, graceful degradation
- Carbon: Error states include clear error messaging, retry actions, and alternative content
- Best practice: Each widget/card should have its own error boundary; one failed API call should not break the entire page

**Gap:**
- Most pages use toast notifications (`ElMessage.error`) which disappear after a few seconds -- users may miss them
- No per-chart/per-card error boundary with inline retry
- DataCompletenessView silently fails (console.error only)
- No partial data display pattern (if one of four API calls fails, all content may be missing)
- No "something went wrong" fallback for unexpected rendering errors

**Improvement plan:**
1. Create a reusable `ErrorBoundary.vue` / `ErrorCard.vue` component with retry button (M)
2. Replace `ElMessage.error` with inline error states for critical data sections (M)
3. Implement partial data display: show available data even if one API fails (S)
4. Add `errorCaptured` lifecycle hook or Vue error boundary for rendering crashes (S)
5. Add persistent error banners for critical failures (not auto-dismissing toasts) (S)

---

### Dimension 7: Data Drill-down (7/10)

**Our implementation:**
`SmartBIAnalysis.vue` has a well-implemented drill-down system:
- Click chart data point -> opens right-side drawer (55% width)
- Multi-level drill with breadcrumb navigation (drillStack)
- Available dimensions shown as button group for choosing next drill direction
- Drill chart rendered in drawer (clicking bars continues drill-down)
- Data summary with `el-descriptions`
- AI insight generated for drill context
- Data table preview (top 20 rows)
- Error and empty states for drill results
- Cross-chart filter bar in standard mode

**Industry standard (Tableau / Power BI / Metabase):**
- Tableau: Multi-level drill with set hierarchy (country -> state -> city). Breadcrumb navigation. Drill actions to separate pages. Filter context preserved across navigations.
- Power BI: Drill-through pages that open with full context. Back button. Drill-up/drill-down buttons. Cross-report drill-through.
- Metabase: "Automagic drill-through" with automatic smart questions about data points.

**Gap:**
- Drill-down only available in SmartBIAnalysis, not in Dashboard, SalesAnalysis, FinanceAnalysis, or ProductionAnalysis
- No predefined dimension hierarchies (e.g., year -> quarter -> month -> week -> day)
- No drill-through to a full separate detail page (only drawer)
- No keyboard navigation for drill-down (Escape to go back)
- Drill chart in drawer uses hardcoded chart type, not dynamic selection

**Improvement plan:**
1. Add click-to-drill from Dashboard.vue KPI cards and ranking items (M)
2. Implement predefined time hierarchies for date-based drill-down (M)
3. Add Escape key to close drawer / navigate back in drill stack (S)
4. Extend drill-down to SalesAnalysis and FinanceAnalysis pages (L)

---

### Dimension 8: AI Integration (7/10)

**Our implementation:**
This is one of our strongest areas:
- `AIQuery.vue`: Full chat interface with NL query, quick question buttons, context-aware follow-up, chart rendering in responses, typing indicator
- `AIInsightPanel.vue`: Structured insights with positive/negative/suggestions sections, confidence badge, collapsible, skeleton loading
- `Dashboard.vue`: AI insights with severity-colored cards (success/warning/danger/info) and action suggestions
- `SmartBIAnalysis.vue`: Executive summary banner with inline KPIs and risk/opportunity tags; AI analysis for each sheet; AI-generated charts
- `ProductionAnalysis.vue`: AI analysis rendered as markdown
- AI reports list with anomaly detection sidebar (`analytics/ai-reports/index.vue`)
- Calibration dashboard for monitoring AI behavior

**Industry standard (Power BI Copilot / Lark / FineBI):**
- Power BI Copilot 2026: Chat interface integrated into every report page. Grounded references (attach a report/model). Auto-generated narratives. Suggest DAX measures. Mobile Copilot.
- Lark Bitable: Dashboard AI explains charts, discovers anomalies, reveals business insights. AI workflows.
- FineBI: Smart question-answer BI plugin, natural language querying, AI-generated smart charts.

**Gap:**
- AI chat is a separate page, not inline on every analysis view (Power BI Copilot is integrated into every page)
- No auto-generated narrative summary that updates when filters change
- No "Why did this KPI change?" one-click insight button on dashboard metrics
- No AI-suggested follow-up questions based on current data context
- No report/model grounding for chat (Power BI's grounded references feature)

**Improvement plan:**
1. Add inline AI insight button (lightbulb icon) next to each KPI card on Dashboard (M)
2. Implement "Why did this change?" quick action on KPI trend indicators (M)
3. Add AI-suggested follow-up questions after each chat response in AIQuery (S)
4. Create a floating AI assistant sidebar accessible from all SmartBI pages (L)

---

### Dimension 9: Responsive Design (4/10)

**Our implementation:**
- `Dashboard.vue`: Uses `el-col` with breakpoints (`:xs="24" :sm="12" :md="6"`) for KPI cards; ranking and chart sections use `:xs="24" :md="12"` and `:xs="24" :lg="14/10"`
- `SalesAnalysis.vue`: No responsive breakpoints visible in filters or chart areas
- `SmartBIAnalysis.vue`: Desktop-first layout; no mobile considerations
- Chart containers use fixed heights (typically 300-400px)
- No touch gesture support
- No mobile-specific layout alternatives
- `DataCompletenessView.vue`: Grid uses `repeat(auto-fill, minmax(220px, 1fr))` -- correctly responsive

**Industry standard (Lark / Power BI / Responsive BI 2025-2026):**
- Over 60% of dashboards now accessed on mobile/tablet devices
- Mobile-first, adaptive design with fully responsive grids
- Touch-friendly controls (larger tap targets, swipe gestures)
- Charts that auto-resize and simplify for smaller screens (e.g., hide axis labels, simplify legend)
- Power BI mobile layout: separate mobile view that reorders visuals for portrait
- Lark: fully responsive grid, mobile-first cards

**Gap:**
- Chart containers have fixed heights and do not adapt to viewport
- No mobile-specific layout or portrait-optimized view
- Filter controls (date pickers, dropdowns) may be cramped on small screens
- No touch gesture support (swipe between tabs, pinch-to-zoom on charts)
- DashboardBuilder uses 12-column grid but no responsive column count reduction
- SmartBIAnalysis tabs may overflow on mobile

**Improvement plan:**
1. Add responsive height calculations for chart containers based on viewport (M)
2. Implement mobile breakpoints in SmartBIAnalysis: stack chart grid items to single-column below 768px (M)
3. Add touch-friendly tab navigation with horizontal scroll for SmartBIAnalysis tabs (S)
4. Make DashboardBuilder reduce to 6 or 4 columns on tablet/mobile (M)
5. Create a mobile-optimized dashboard view (separate layout) for key pages (XL)

---

### Dimension 10: Color Consistency (4/10)

**Our implementation:**
- `DynamicChartRenderer.vue`: Hardcoded `PIE_COLORS = ['#409EFF', '#67C23A', '#E6A23C', '#F56C6C', '#909399', '#00d4ff', '#ff6b6b', '#ffd93d', '#8A2BE2', '#00CED1']` -- 10 colors
- `KPICard.vue`: Status colors defined as local constant object; trend colors defined locally
- `Dashboard.vue`: Ad-hoc colors like `#409EFF`, `#67C23A` in chart options; `getPieColor()` function with a different color list
- `ProductionAnalysis.vue`: Gradient arrays hardcoded for KPI cards
- `SalesAnalysis.vue`: No explicit color system
- `DataCompletenessView.vue`: Uses `#10b981`, `#f59e0b`, `#ef4444` (Tailwind-like tokens)
- Element Plus theme colors used inconsistently (`#409eff` vs `#409EFF`; `#67c23a` vs `#67C23A`)

**Industry standard (Carbon Design System / Tableau / Power BI):**
- Carbon: Defined categorical and sequential palettes, tested for 3:1 contrast ratio (WCAG 2.1), colorblind-safe alternatives
- Tableau: 10-color branded categorical palette, consistent across all visualizations, accessible by default
- Power BI: Theme system with JSON theme files defining all colors; consistent palette application
- Best practice: Max 7 categorical colors for human recognition; warm/cool balance; teal/red instead of green/red for colorblind accessibility
- Design tokens in CSS variables for centralized color management

**Gap:**
- Multiple different color arrays across files (PIE_COLORS, getPieColor, gradient arrays, status colors)
- No centralized color token system (CSS variables or design tokens)
- No colorblind-safe palette testing
- No WCAG 2.1 contrast ratio verification
- Inconsistent color case (`#409eff` vs `#409EFF`)
- No light/dark theme support
- Chart colors differ between Dashboard.vue and DynamicChartRenderer.vue

**Improvement plan:**
1. Create a centralized `smartbi-colors.ts` design token file with categorical, sequential, status, and semantic palettes (M)
2. Define CSS custom properties for all SmartBI colors in a shared SCSS file (M)
3. Audit all hardcoded color values and replace with token references (L)
4. Test palette for WCAG 2.1 compliance and colorblind accessibility using Leonardo (M)
5. Unify PIE_COLORS and getPieColor into single token source (S)

---

## Top 10 Missing Features

| # | Feature | Impact (1-10) | Effort | Priority Score | Reference Product |
|---|---------|---------------|--------|----------------|-------------------|
| 1 | Global Filter Pane with Summary Chips | 9 | L | 9/3=3.0 | Power BI, Tableau |
| 2 | Per-Widget Skeleton Loading | 8 | M | 8/2=4.0 | FineBI, Carbon Design |
| 3 | Centralized Color Design Token System | 8 | M | 8/2=4.0 | Tableau, Carbon |
| 4 | Dashboard KPI Click-to-Detail Navigation | 8 | S | 8/1=8.0 | All BI tools |
| 5 | Inline "Why Changed?" AI Insight on KPIs | 8 | M | 8/2=4.0 | Power BI Copilot |
| 6 | Cross-Visual Filtering on Dashboard Page | 7 | L | 7/3=2.3 | Power BI, Tableau |
| 7 | Mobile-Responsive Chart Layouts | 7 | L | 7/3=2.3 | Lark, Power BI Mobile |
| 8 | Per-Card Error Boundary with Inline Retry | 7 | M | 7/2=3.5 | Power BI, FineBI |
| 9 | Custom Empty State Illustrations + CTAs | 6 | M | 6/2=3.0 | Lark, Carbon |
| 10 | Animated KPI Count-Up Transitions | 5 | S | 5/1=5.0 | FineBI, Tableau |

**Ranked by Priority Score (Impact / Effort):**

| Rank | Feature | Priority Score |
|------|---------|----------------|
| 1 | Dashboard KPI Click-to-Detail Navigation | 8.0 |
| 2 | Animated KPI Count-Up Transitions | 5.0 |
| 3 | Per-Widget Skeleton Loading | 4.0 |
| 4 | Centralized Color Design Token System | 4.0 |
| 5 | Inline "Why Changed?" AI Insight on KPIs | 4.0 |
| 6 | Per-Card Error Boundary with Inline Retry | 3.5 |
| 7 | Global Filter Pane with Summary Chips | 3.0 |
| 8 | Custom Empty State Illustrations + CTAs | 3.0 |
| 9 | Cross-Visual Filtering on Dashboard Page | 2.3 |
| 10 | Mobile-Responsive Chart Layouts | 2.3 |

---

## Detailed Gap Analysis

### vs Tableau

| Area | Tableau | Our SmartBI | Gap |
|------|---------|-------------|-----|
| KPI Cards | Clean cards with sparklines, conditional coloring, click-to-filter | KPICard component with sparklines but not used everywhere; no conditional background | Medium |
| Chart Interactions | Multi-level drill, dashboard actions (filter/highlight/URL), context menus | Drill-down in SmartBIAnalysis only; no dashboard actions on other pages | Large |
| Connected Filters | Dashboard-level filters cascade to all worksheets; dependent filters | Page-local filters only; no cascade | Large |
| Color System | 10-color branded categorical palette, consistent theming | Multiple ad-hoc color arrays, inconsistent | Large |
| Calculated Fields | Runtime calculated fields with drag-and-drop | Server-side only; no client-side calculations | Large |
| Story/Narrative | Story points for guided narrative | Executive summary banner (basic) | Medium |

### vs Power BI

| Area | Power BI | Our SmartBI | Gap |
|------|----------|-------------|-----|
| Copilot AI | Chat on every page, grounded references, auto-narratives, DAX suggestions | Separate AIQuery page, structured insights, auto-charts | Medium |
| Cross-filtering | Click any visual to cross-filter/highlight all others automatically | Cross-filter only in SmartBIAnalysis mode | Large |
| Drill-through | Right-click drill-through to detail pages with full context | Drawer-based drill-down, no separate detail pages | Medium |
| Tooltip Pages | Mini-reports shown on hover | Standard ECharts tooltips only | Large |
| Mobile Layout | Separate mobile layout editor, auto-resize | Basic el-col breakpoints, no mobile layout | Large |
| Theme System | JSON theme files, consistent palette | No theme system, hardcoded colors | Large |
| Filter Pane | Global side pane, filter summary, saved views | No global filter pane | Large |

### vs FineBI

| Area | FineBI | Our SmartBI | Gap |
|------|--------|-------------|-----|
| Self-service | Drag-and-drop analysis builder for business users | Upload Excel then AI analyzes; less interactive building | Medium |
| Templates | Template marketplace with one-click industry templates | No templates | Large |
| Smart Charts | AI automatically selects optimal chart type | AI recommends chart type during upload analysis | Small |
| Data Preparation | Built-in ETL, multi-source connection, real-time + extracted | Excel upload and API-based; no visual ETL | Large |
| Loading UX | Skeleton screens matching layout, smooth transitions | v-loading spinners mostly | Medium |
| Indicator Center | Enterprise-defined index/KPI system with unified management | KPIs computed per-page, no central indicator registry | Large |

### vs 飞书多维表格 (Lark Bitable)

| Area | Lark Bitable | Our SmartBI | Gap |
|------|-------------|-------------|-----|
| Dashboard AI | AI explains charts, discovers anomalies, suggests insights inline | AI insights in panels, not inline per-chart | Medium |
| Role-based Views | Permission-based dashboard views showing different data per role | Factory-level isolation via factoryId, but same dashboard for all roles | Medium |
| Application Mode | Zero-code business system builder from data tables | DashboardBuilder for layout only, no business logic building | Large |
| Responsive Design | Fully responsive, mobile-first | Desktop-first, limited responsive | Large |
| Performance | 10M rows, millisecond query | Depends on backend; no client-side performance optimizations | Unknown |
| Empty States | Custom illustrations, guided onboarding | Generic el-empty components | Medium |

---

## Recommendations

### Quick Wins (< 1 day each)

| # | Task | File(s) to Modify | Expected Impact |
|---|------|-------------------|-----------------|
| 1 | Make Dashboard KPI cards clickable (router.push to detail pages) | `src/views/smart-bi/Dashboard.vue` | High -- users expect clickable KPIs |
| 2 | Refactor Dashboard KPI section to use `KPICard.vue` component | `src/views/smart-bi/Dashboard.vue` | Medium -- leverages existing sparkline/trend features |
| 3 | Add Escape key handler to close drill-down drawer | `src/views/smart-bi/SmartBIAnalysis.vue` | Low -- keyboard accessibility |
| 4 | Add period selector dropdown to Dashboard.vue header | `src/views/smart-bi/Dashboard.vue` | Medium -- filter flexibility |
| 5 | Unify PIE_COLORS and getPieColor into single constant file | Create `src/constants/smartbi-colors.ts`, update `DynamicChartRenderer.vue`, `Dashboard.vue` | Medium -- consistency |
| 6 | Add animated count-up to KPI values using CSS `@property` counter | `src/components/smartbi/KPICard.vue` | Medium -- perceived quality |
| 7 | Add fade-in CSS transition when chart data arrives | `src/components/smartbi/DynamicChartRenderer.vue` | Low -- polish |
| 8 | Differentiate "no data yet" vs "no results" empty states with different text | `src/views/smart-bi/Dashboard.vue`, `SmartBIAnalysis.vue` | Low -- UX clarity |

### Medium Term (1-3 days each)

| # | Task | File(s) to Modify | Expected Impact |
|---|------|-------------------|-----------------|
| 1 | Create centralized SmartBI color design tokens (CSS variables + TS constants) | Create `src/styles/smartbi-tokens.scss`, `src/constants/smartbi-colors.ts`; update all chart components | High -- consistency foundation |
| 2 | Build per-widget skeleton components (KPICardSkeleton, ChartSkeleton) | Create `src/components/smartbi/KPICardSkeleton.vue`, `ChartSkeleton.vue`; update Dashboard, SalesAnalysis, FinanceAnalysis | High -- perceived performance |
| 3 | Implement per-card error boundary with inline retry | Create `src/components/smartbi/ErrorCard.vue`; wrap API calls in Dashboard, SalesAnalysis | High -- resilience |
| 4 | Add "Why did this change?" AI quick action on KPI cards | `src/components/smartbi/KPICard.vue`, create insight popover, connect to AIQuery API | High -- AI differentiation |
| 5 | Build global SmartBI filter bar component | Create `src/components/smartbi/GlobalFilterBar.vue`; integrate into SmartBI Layout.vue | High -- usability |
| 6 | Add cross-highlighting to SalesAnalysis charts | `src/views/smart-bi/SalesAnalysis.vue` | Medium -- interactivity |
| 7 | Create custom empty state SVG illustrations | Create `src/assets/empty-states/`; update el-empty usages | Medium -- polish |
| 8 | Test and fix WCAG 2.1 color contrast for all chart palettes | `src/constants/smartbi-colors.ts` | Medium -- accessibility |

### Strategic (> 3 days each)

| # | Task | File(s) to Modify | Expected Impact |
|---|------|-------------------|-----------------|
| 1 | Floating AI assistant sidebar accessible from all SmartBI pages | Create `src/components/smartbi/AIAssistantSidebar.vue`; integrate into Layout.vue | Very High -- Power BI Copilot parity |
| 2 | Full mobile-responsive SmartBI layouts with separate mobile view | All SmartBI views and components | High -- mobile audience |
| 3 | Cross-visual filtering on Dashboard (click chart to filter KPIs and other charts) | `src/views/smart-bi/Dashboard.vue`, create `useChartInteraction.ts` composable | High -- Tableau/Power BI parity |
| 4 | Dashboard template marketplace with pre-built industry templates | Create `src/views/smart-bi/templates/`; backend API for template storage | Medium -- FineBI parity |
| 5 | Centralized KPI/indicator registry with unified definitions | Backend API + new admin screen for KPI management | Medium -- enterprise feature |

---

## Sources

- [KPIs and Cards in Power BI - Data Goblins](https://data-goblins.com/power-bi/kpi-templates)
- [How to Create a KPI Card - Flerlage Twins](https://www.flerlagetwins.com/2025/09/how-to-create-kpi-card-with-two-tricks.html)
- [How to Master New Power BI Card Formatting 2026](https://galaxy.ai/youtube-summarizer/how-to-master-the-new-power-bi-card-formatting-for-modern-kpi-cards-in-2026-suMiPGw-cb4)
- [Power BI Trends to Watch in 2026: AI, Copilot, and Beyond](https://aqltech.com/power-bi-trends-to-watch-in-2026-ai-copilot-and-beyond/)
- [Power BI January 2026 Feature Summary](https://powerbi.microsoft.com/en-us/blog/power-bi-january-2026-feature-summary/)
- [Power BI Copilot Best Practices 2026](https://powerbiconsulting.com/blog/power-bi-copilot-best-practices-2026)
- [FineBI Official Site](https://www.finebi.com/)
- [Lark Bitable Official - AI Table and Business System Platform](https://www.feishu.cn/product/base)
- [Apache Superset vs Metabase 2026 Guide](https://bix-tech.com/apache-superset-vs-metabase-the-nononsense-guide-to-choosing-the-right-opensource-bi-platform-in-2026/)
- [Empty States - Carbon Design System](https://carbondesignsystem.com/patterns/empty-states-pattern/)
- [Loading Patterns - Carbon Design System](https://carbondesignsystem.com/patterns/loading-pattern/)
- [Designing Empty States: 3 Guidelines - NN/g](https://www.nngroup.com/articles/empty-state-interface-design/)
- [Data Visualization Color Palettes - Carbon Design System](https://carbondesignsystem.com/data-visualization/color-palettes/)
- [Color Palettes and Accessibility for Data Visualization](https://medium.com/carbondesign/color-palettes-and-accessibility-features-for-data-visualization-7869f4874fca)
- [Leonardo - Accessible Color Systems](https://leonardocolor.io/)
- [Effective Dashboard Design Tutorial - DataCamp](https://www.datacamp.com/tutorial/dashboard-design-tutorial)
- [Dashboard Design Principles 2026 - DesignRush](https://www.designrush.com/agency/ui-ux-design/dashboard/trends/dashboard-design-principles)
- [Top Dashboard Design Trends 2025 - Fuselab Creative](https://fuselabcreative.com/top-dashboard-design-trends-2025/)
