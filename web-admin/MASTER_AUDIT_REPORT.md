# Master Audit Report: Data Analysis Module

**Date**: 2026-02-11
**Auditors**: A2 (Style), A3 (Frontend), A4 (Backend), A5 (Research), A6 (Consistency), A7 (Devil's Advocate)
**Coordinator**: A8 (Plan Manager)

---

## Executive Summary

| Metric | Value |
|--------|-------|
| Pages Audited | 21 |
| Total Unique Issues | 89 |
| P0 (Immediate) | 16 |
| P1 (High) | 28 |
| P2 (Medium) | 30 |
| P3 (Backlog) | 15 |
| Overall Module Score | 42/100 |
| Benchmark vs Industry | 58/100 (A5) |
| Design System Score | 4/10 (A2) |
| Consistency Score | 4/10 (A6) |
| Devil's Advocate Score | 35/100 (A7) |

### Critical Findings (Top 5)

1. **XSS via AI-generated content (6 locations)**: `v-html` renders unsanitized AI/LLM output across SmartBIAnalysis.vue, ai-reports/index.vue, ProductionAnalysis.vue, and AlertDashboard.vue. The `formatAnalysis()` function actively injects capture groups into HTML tags, guaranteeing XSS if the LLM returns HTML. No DOMPurify or any sanitization exists in the entire codebase. (A3, A7)

2. **Unauthenticated Python service on public IP**: All 17 `fetch()` calls in `api/smartbi.ts` hit the Python service at port 8083 on public IP 47.100.235.168 with zero authentication. The Python FastAPI service has no auth middleware. Additionally, `/api/admin/smartbi-config/**` bypasses JWT entirely. The `clear-all-cache` endpoint can wipe all factories' data without auth. (A4, A7)

3. **Fake financial data shown to users**: `DashboardFinance.vue` displays hardcoded fabricated numbers (`totalRevenue: 125`, `totalCost: 87.5`, `profitMargin: 30`) when the API fails, with no visual indicator. This violates the project's explicit "no fake data" rule and is a compliance risk in food traceability. DashboardHR and DashboardWarehouse also use mock data. (A6, A7)

4. **Multi-tenant data isolation breach**: `getFactoryId()` in `api/smartbi.ts` silently falls back to `'F001'` on any error (localStorage corruption, cleared storage, JSON parse failure). Combined with the unauthenticated Python service, any user can query any factory's data. (A3, A4, A7)

5. **Memory leaks in 3 components**: AIQuery.vue, ExcelUpload.vue, and trends/index.vue have `window.addEventListener('resize', ...)` that are never removed. AIQuery.vue has no cleanup lifecycle hook at all. Chart instances leak on every mount/unmount cycle during SPA navigation. (A3, A7)

---

## Per-Page Scorecards

### Page 1: SmartBI Dashboard (Dashboard.vue)

| Dimension | Score | Weight | Weighted |
|-----------|-------|--------|----------|
| Visual Quality | 55/100 | 25% | 13.75 |
| Code Quality | 50/100 | 25% | 12.50 |
| API Integration | 60/100 | 15% | 9.00 |
| Usability/UX | 45/100 | 15% | 6.75 |
| Performance | 55/100 | 10% | 5.50 |
| Consistency | 35/100 | 10% | 3.50 |
| **Total** | | | **51/100** |

**Key Issues**: Redefines KPICard interface locally instead of importing shared type (A3, A6). Does not use shared KPICard.vue component (A6). Uses `document.getElementById()` for chart init (A6). No filter/period selector -- hardcoded `period=month` (A5, A6). Dashboard charts have zero interactivity (A5). Console.log in production (A7). Ranking items not keyboard accessible (A7). No disabled state on refresh button during loading (A7).

---

### Page 2: Finance Analysis (FinanceAnalysis.vue)

| Dimension | Score | Weight | Weighted |
|-----------|-------|--------|----------|
| Visual Quality | 55/100 | 25% | 13.75 |
| Code Quality | 40/100 | 25% | 10.00 |
| API Integration | 60/100 | 15% | 9.00 |
| Usability/UX | 50/100 | 15% | 7.50 |
| Performance | 55/100 | 10% | 5.50 |
| Consistency | 40/100 | 10% | 4.00 |
| **Total** | | | **50/100** |

**Key Issues**: At 1,690 lines, exceeds 500-line threshold (A3). Date shortcuts duplicated with SalesAnalysis.vue (A3, A6). Defines local `FinanceKPI` interface duplicating shared types (A3). Card padding differs from other pages (16px vs 20px) (A7).

---

### Page 3: Sales Analysis (SalesAnalysis.vue)

| Dimension | Score | Weight | Weighted |
|-----------|-------|--------|----------|
| Visual Quality | 55/100 | 25% | 13.75 |
| Code Quality | 50/100 | 25% | 12.50 |
| API Integration | 55/100 | 15% | 8.25 |
| Usability/UX | 50/100 | 15% | 7.50 |
| Performance | 60/100 | 10% | 6.00 |
| Consistency | 40/100 | 10% | 4.00 |
| **Total** | | | **52/100** |

**Key Issues**: `handleExport()` is a stub showing "in development" to users (A3, A7). Redefines KPICard interface locally (A3, A6). Date shortcuts duplicated with FinanceAnalysis.vue (A3). No disabled state on buttons during loading (A7).

---

### Page 4: SmartBI Analysis (SmartBIAnalysis.vue)

| Dimension | Score | Weight | Weighted |
|-----------|-------|--------|----------|
| Visual Quality | 45/100 | 25% | 11.25 |
| Code Quality | 15/100 | 25% | 3.75 |
| API Integration | 30/100 | 15% | 4.50 |
| Usability/UX | 50/100 | 15% | 7.50 |
| Performance | 25/100 | 10% | 2.50 |
| Consistency | 20/100 | 10% | 2.00 |
| **Total** | | | **32/100** |

**Key Issues**: God-component at 3,937 lines (A3). 20x `as any` casts (A3). Active XSS via `formatAnalysis()` + `v-html` at 3 locations (A3, A7). 38 console.log statements in production (A7). 9 uncleaned setTimeout calls (A3, A7). Uses THREE color palettes (Element Plus + Tailwind + Tableau) in same file (A2, A7). 25 Tailwind grays used only in this file (A7). Only 2 responsive breakpoints (A7). Emojis injected into analysis text (A7). Raw `fetch()` call at line 1264 (A3).

---

### Page 5: Production Analysis (ProductionAnalysis.vue)

| Dimension | Score | Weight | Weighted |
|-----------|-------|--------|----------|
| Visual Quality | 50/100 | 25% | 12.50 |
| Code Quality | 50/100 | 25% | 12.50 |
| API Integration | 50/100 | 15% | 7.50 |
| Usability/UX | 30/100 | 15% | 4.50 |
| Performance | 55/100 | 10% | 5.50 |
| Consistency | 30/100 | 10% | 3.00 |
| **Total** | | | **46/100** |

**Key Issues**: Hardcoded `factoryId || 'F001'` (A3). `v-html` with `marked()` for AI content -- XSS risk (A3). Error handling is `console.error` only -- no user feedback (A6). No empty state (A6, A7). No `@media` queries at all (A7). KPI cards not keyboard accessible (A7). No `el-card` wrapper unlike other pages (A6).

---

### Page 6: Data Completeness (DataCompletenessView.vue)

| Dimension | Score | Weight | Weighted |
|-----------|-------|--------|----------|
| Visual Quality | 45/100 | 25% | 11.25 |
| Code Quality | 25/100 | 25% | 6.25 |
| API Integration | 15/100 | 15% | 2.25 |
| Usability/UX | 35/100 | 15% | 5.25 |
| Performance | 50/100 | 10% | 5.00 |
| Consistency | 25/100 | 10% | 2.50 |
| **Total** | | | **33/100** |

**Key Issues**: Uses raw `fetch()` bypassing auth interceptors and error handling (A3). Snake_case field names violating project convention (A3). `console.error` only error handling (A3). Hardcoded `factoryId || 'F001'` (A3). No responsive breakpoints (A7).

---

### Page 7: Excel Upload (ExcelUpload.vue)

| Dimension | Score | Weight | Weighted |
|-----------|-------|--------|----------|
| Visual Quality | 55/100 | 25% | 13.75 |
| Code Quality | 35/100 | 25% | 8.75 |
| API Integration | 55/100 | 15% | 8.25 |
| Usability/UX | 55/100 | 15% | 8.25 |
| Performance | 30/100 | 10% | 3.00 |
| Consistency | 50/100 | 10% | 5.00 |
| **Total** | | | **47/100** |

**Key Issues**: Memory leak -- anonymous resize listener never removed (A3). At 1,124 lines, exceeds threshold (A3). "Template download" stub exposed to users (A7). Uses shared KPICard component (only page that does) (A6). Upload area padding inconsistent (60px vs 20px elsewhere) (A7).

---

### Page 8: AI Query (AIQuery.vue)

| Dimension | Score | Weight | Weighted |
|-----------|-------|--------|----------|
| Visual Quality | 50/100 | 25% | 12.50 |
| Code Quality | 20/100 | 25% | 5.00 |
| API Integration | 45/100 | 15% | 6.75 |
| Usability/UX | 50/100 | 15% | 7.50 |
| Performance | 10/100 | 10% | 1.00 |
| Consistency | 35/100 | 10% | 3.50 |
| **Total** | | | **36/100** |

**Key Issues**: Complete absence of cleanup lifecycle hook -- no `onUnmounted` at all (A3). Resize listener at module scope never removed (A3). Chart instances in Map never disposed (A3). 3 `(s: any)` untyped params (A3). No keyboard accessibility for chat (A7).

---

### Page 9: SmartBI Layout (Layout.vue)

| Dimension | Score | Weight | Weighted |
|-----------|-------|--------|----------|
| Visual Quality | 90/100 | 25% | 22.50 |
| Code Quality | 95/100 | 25% | 23.75 |
| API Integration | N/A | 15% | 15.00 |
| Usability/UX | 90/100 | 15% | 13.50 |
| Performance | 95/100 | 10% | 9.50 |
| Consistency | 90/100 | 10% | 9.00 |
| **Total** | | | **93/100** |

**Key Issues**: None significant. Simple 19-line router-view wrapper. Exemplary simplicity.

---

### Page 10: Analytics Overview (analytics/index.vue)

| Dimension | Score | Weight | Weighted |
|-----------|-------|--------|----------|
| Visual Quality | 50/100 | 25% | 12.50 |
| Code Quality | 40/100 | 25% | 10.00 |
| API Integration | 45/100 | 15% | 6.75 |
| Usability/UX | 40/100 | 15% | 6.00 |
| Performance | 55/100 | 10% | 5.50 |
| Consistency | 30/100 | 10% | 3.00 |
| **Total** | | | **44/100** |

**Key Issues**: 3x `[] as any[]` untyped refs (A3). `console.error` only error handling (A3, A6). No retry mechanism after error (A7). Non-standard Flat UI colors (#E74C3C, #9B59B6) (A2). Quick-nav 3-column layout not responsive (A2). No empty state (A6).

---

### Page 11: Trends (analytics/trends/index.vue)

| Dimension | Score | Weight | Weighted |
|-----------|-------|--------|----------|
| Visual Quality | 45/100 | 25% | 11.25 |
| Code Quality | 20/100 | 25% | 5.00 |
| API Integration | 40/100 | 15% | 6.00 |
| Usability/UX | 35/100 | 15% | 5.25 |
| Performance | 10/100 | 10% | 1.00 |
| Consistency | 25/100 | 10% | 2.50 |
| **Total** | | | **31/100** |

**Key Issues**: Complete memory leak -- no cleanup hook exists (A3). 3 ECharts instances never disposed (A3). Resize listener never removed (A3). 5x `(d: any)` and 5x `[] as any[]` (A3). Uses `document.getElementById()` (A6). No @media queries (A2). `console.error` only error handling (A3).

---

### Page 12: AI Reports (analytics/ai-reports/index.vue)

| Dimension | Score | Weight | Weighted |
|-----------|-------|--------|----------|
| Visual Quality | 50/100 | 25% | 12.50 |
| Code Quality | 30/100 | 25% | 7.50 |
| API Integration | 50/100 | 15% | 7.50 |
| Usability/UX | 45/100 | 15% | 6.75 |
| Performance | 50/100 | 10% | 5.00 |
| Consistency | 35/100 | 10% | 3.50 |
| **Total** | | | **43/100** |

**Key Issues**: 3x `ref<any>` / `ref<any[]>` zero type safety (A3, A7). `v-html` with unsanitized AI content -- XSS risk (A3, A7). `viewReport(report: any)` untyped param (A3). No @media queries (A2).

---

### Page 13: KPI Dashboard (analytics/kpi/index.vue)

| Dimension | Score | Weight | Weighted |
|-----------|-------|--------|----------|
| Visual Quality | 55/100 | 25% | 13.75 |
| Code Quality | 65/100 | 25% | 16.25 |
| API Integration | 60/100 | 15% | 9.00 |
| Usability/UX | 55/100 | 15% | 8.25 |
| Performance | 60/100 | 10% | 6.00 |
| Consistency | 50/100 | 10% | 5.00 |
| **Total** | | | **58/100** |

**Key Issues**: Hardcoded KPI target values (A3). No period selector or date filtering (A6). Well-typed overall.

---

### Page 14: Production Report (analytics/production-report/index.vue)

| Dimension | Score | Weight | Weighted |
|-----------|-------|--------|----------|
| Visual Quality | 55/100 | 25% | 13.75 |
| Code Quality | 70/100 | 25% | 17.50 |
| API Integration | 60/100 | 15% | 9.00 |
| Usability/UX | 55/100 | 15% | 8.25 |
| Performance | 60/100 | 10% | 6.00 |
| Consistency | 50/100 | 10% | 5.00 |
| **Total** | | | **60/100** |

**Key Issues**: Properly typed with ProductionData interface (A3). Proper cleanup in onUnmounted (A3). Uses unique olive green (#6B8E23) (A2). No @media queries (A2).

---

### Page 15: Alert Dashboard (analytics/AlertDashboard.vue)

| Dimension | Score | Weight | Weighted |
|-----------|-------|--------|----------|
| Visual Quality | 50/100 | 25% | 12.50 |
| Code Quality | 50/100 | 25% | 12.50 |
| API Integration | 55/100 | 15% | 8.25 |
| Usability/UX | 50/100 | 15% | 7.50 |
| Performance | 50/100 | 10% | 5.00 |
| Consistency | 40/100 | 10% | 4.00 |
| **Total** | | | **50/100** |

**Key Issues**: `v-html` with `marked()` for AI analysis -- XSS risk (A3). Hardcoded `factoryId || 'F001'` (A3). Mixes Tailwind and Element Plus colors (A2). No @media queries (A2). Well-typed with AlertSummary and AlertRecord interfaces (A3).

---

### Page 16: Dashboard Admin (DashboardAdmin.vue)

| Dimension | Score | Weight | Weighted |
|-----------|-------|--------|----------|
| Visual Quality | 60/100 | 25% | 15.00 |
| Code Quality | 65/100 | 25% | 16.25 |
| API Integration | 60/100 | 15% | 9.00 |
| Usability/UX | 50/100 | 15% | 7.50 |
| Performance | 60/100 | 10% | 6.00 |
| Consistency | 55/100 | 10% | 5.50 |
| **Total** | | | **59/100** |

**Key Issues**: No significant code issues. Well-typed. CSS duplicated with other dashboard variants (~80 lines identical styling) (A6). No empty state (A6). No @media queries (A2).

---

### Page 17: Dashboard HR (DashboardHR.vue)

| Dimension | Score | Weight | Weighted |
|-----------|-------|--------|----------|
| Visual Quality | 55/100 | 25% | 13.75 |
| Code Quality | 40/100 | 25% | 10.00 |
| API Integration | 40/100 | 15% | 6.00 |
| Usability/UX | 45/100 | 15% | 6.75 |
| Performance | 55/100 | 10% | 5.50 |
| Consistency | 50/100 | 10% | 5.00 |
| **Total** | | | **47/100** |

**Key Issues**: Uses mock/random attendance data (A6). Violates "no fake data" rule (A6, A7). CSS duplicated with other dashboard variants (A6). `console.error` only error handling (A6).

---

### Page 18: Dashboard Production (DashboardProduction.vue)

| Dimension | Score | Weight | Weighted |
|-----------|-------|--------|----------|
| Visual Quality | 60/100 | 25% | 15.00 |
| Code Quality | 65/100 | 25% | 16.25 |
| API Integration | 60/100 | 15% | 9.00 |
| Usability/UX | 55/100 | 15% | 8.25 |
| Performance | 55/100 | 10% | 5.50 |
| Consistency | 55/100 | 10% | 5.50 |
| **Total** | | | **60/100** |

**Key Issues**: Proper cleanup including interval, listener, and chart disposal (A3). Has auto-refresh (30s) -- only dashboard that does (A6). Slightly over 500-line threshold (555 lines) but well-structured (A7 downgraded to INFO).

---

### Page 19: Dashboard Warehouse (DashboardWarehouse.vue)

| Dimension | Score | Weight | Weighted |
|-----------|-------|--------|----------|
| Visual Quality | 55/100 | 25% | 13.75 |
| Code Quality | 40/100 | 25% | 10.00 |
| API Integration | 40/100 | 15% | 6.00 |
| Usability/UX | 45/100 | 15% | 6.75 |
| Performance | 55/100 | 10% | 5.50 |
| Consistency | 50/100 | 10% | 5.00 |
| **Total** | | | **47/100** |

**Key Issues**: Uses mock data for lowStock, inbound, outbound (A6). Violates "no fake data" rule (A6, A7). CSS duplicated with other dashboard variants (A6). `console.error` only error handling (A6).

---

### Page 20: Dashboard Finance (DashboardFinance.vue)

| Dimension | Score | Weight | Weighted |
|-----------|-------|--------|----------|
| Visual Quality | 55/100 | 25% | 13.75 |
| Code Quality | 20/100 | 25% | 5.00 |
| API Integration | 30/100 | 15% | 4.50 |
| Usability/UX | 30/100 | 15% | 4.50 |
| Performance | 50/100 | 10% | 5.00 |
| Consistency | 40/100 | 10% | 4.00 |
| **Total** | | | **37/100** |

**Key Issues**: Ships fabricated financial data on API failure (A6, A7). Hardcoded `totalRevenue: 125`, `totalCost: 87.5`, `profitMargin: 30` with no visual indicator (A7). Uses `hexToRgba()` while all other dashboards use string concatenation (A6). Compliance risk in financial context (A7). Violates "no fake data" rule explicitly (A7).

---

### Page 21: Dashboard Default (DashboardDefault.vue)

| Dimension | Score | Weight | Weighted |
|-----------|-------|--------|----------|
| Visual Quality | 55/100 | 25% | 13.75 |
| Code Quality | 50/100 | 25% | 12.50 |
| API Integration | 55/100 | 15% | 8.25 |
| Usability/UX | 50/100 | 15% | 7.50 |
| Performance | 55/100 | 10% | 5.50 |
| Consistency | 40/100 | 10% | 4.00 |
| **Total** | | | **52/100** |

**Key Issues**: 2x `as any` for permission module keys (A3). Different design from role-specific dashboards -- uses module grid instead of stat cards (A6). Hover effect uses `-4px` while other dashboards use `-2px` (A6). font-weight: 700 while others use 600 (A6).

---

## Score Summary Table

| # | Page | Score |
|---|------|-------|
| 1 | SmartBI Dashboard (Dashboard.vue) | 51 |
| 2 | Finance Analysis (FinanceAnalysis.vue) | 50 |
| 3 | Sales Analysis (SalesAnalysis.vue) | 52 |
| 4 | SmartBI Analysis (SmartBIAnalysis.vue) | 32 |
| 5 | Production Analysis (ProductionAnalysis.vue) | 46 |
| 6 | Data Completeness (DataCompletenessView.vue) | 33 |
| 7 | Excel Upload (ExcelUpload.vue) | 47 |
| 8 | AI Query (AIQuery.vue) | 36 |
| 9 | SmartBI Layout (Layout.vue) | 93 |
| 10 | Analytics Overview (analytics/index.vue) | 44 |
| 11 | Trends (analytics/trends/index.vue) | 31 |
| 12 | AI Reports (analytics/ai-reports/index.vue) | 43 |
| 13 | KPI Dashboard (analytics/kpi/index.vue) | 58 |
| 14 | Production Report (analytics/production-report/index.vue) | 60 |
| 15 | Alert Dashboard (analytics/AlertDashboard.vue) | 50 |
| 16 | Dashboard Admin (DashboardAdmin.vue) | 59 |
| 17 | Dashboard HR (DashboardHR.vue) | 47 |
| 18 | Dashboard Production (DashboardProduction.vue) | 60 |
| 19 | Dashboard Warehouse (DashboardWarehouse.vue) | 47 |
| 20 | Dashboard Finance (DashboardFinance.vue) | 37 |
| 21 | Dashboard Default (DashboardDefault.vue) | 52 |
| | **Module Average (excluding Layout.vue)** | **47/100** |

---

## Unified Issue Registry

### Legend

- **Severity**: CRITICAL / HIGH / MEDIUM / LOW / INFO
- **Effort**: S (<1h) / M (1-4h) / L (4-8h) / XL (>8h)
- **Priority**: P0 (Immediate) / P1 (High) / P2 (Medium) / P3 (Backlog)

| ID | Description | Severity | Source Agents | Files | Effort | Priority |
|----|-------------|----------|---------------|-------|--------|----------|
| AUDIT-001 | XSS: `formatAnalysis()` injects AI content into HTML via v-html with zero sanitization (3 render paths) | CRITICAL | A3, A7 | `SmartBIAnalysis.vue` | M | P0 |
| AUDIT-002 | XSS: `v-html="selectedReport.aiAnalysis.replace(/\n/g, '<br>')"` -- raw AI content | CRITICAL | A3, A7 | `ai-reports/index.vue` | S | P0 |
| AUDIT-003 | XSS: `v-html="renderedAnalysis"` using `marked()` on AI content | CRITICAL | A3 | `ProductionAnalysis.vue` | S | P0 |
| AUDIT-004 | XSS: `v-html="marked(selectedAlert.aiAnalysis)"` | CRITICAL | A3 | `AlertDashboard.vue` | S | P0 |
| AUDIT-005 | SmartBIConfigController (`/api/admin/**`) bypasses JWT auth entirely | CRITICAL | A4 | `WebMvcConfig.java` L41 | S | P0 |
| AUDIT-006 | All Python endpoints (port 8083) have zero authentication on public IP | CRITICAL | A4, A7 | `main.py`, all Python API files | L | P0 |
| AUDIT-007 | `clear-all-cache` endpoint deletes ALL factories' caches, no auth | CRITICAL | A4 | `analysis_cache.py` L163 | S | P0 |
| AUDIT-008 | DashboardFinance.vue shows fabricated financial data on API failure | CRITICAL | A6, A7 | `DashboardFinance.vue` L100-116 | S | P0 |
| AUDIT-009 | DashboardHR.vue uses mock attendance data | CRITICAL | A6, A7 | `DashboardHR.vue` | S | P0 |
| AUDIT-010 | DashboardWarehouse.vue uses mock data for stock/inbound/outbound | CRITICAL | A6, A7 | `DashboardWarehouse.vue` | S | P0 |
| AUDIT-011 | `getFactoryId()` silently falls back to 'F001' on any error -- multi-tenant data breach | CRITICAL | A3, A7 | `api/smartbi.ts` L14-25 | M | P0 |
| AUDIT-012 | `localStorage` used for auth data -- violates SecureStore rule | CRITICAL | A7 | `api/smartbi.ts` L16 | M | P0 |
| AUDIT-013 | Frontend calls `GET /analysis/trend` -- no backend handler exists | CRITICAL | A4 | `api/smartbi.ts`, `SmartBIController.java` | M | P0 |
| AUDIT-014 | Frontend calls `POST /analysis/comparison` -- no backend handler exists | CRITICAL | A4 | `api/smartbi.ts`, `SmartBIController.java` | M | P0 |
| AUDIT-015 | 17 `fetch()` calls in api/smartbi.ts send no auth headers to Python service | CRITICAL | A3, A4, A7 | `api/smartbi.ts` L520-3231 | L | P0 |
| AUDIT-016 | No factory ownership check on Python cache save -- any user can overwrite any factory's cache | HIGH | A4 | `analysis_cache.py` L82 | M | P0 |
| AUDIT-017 | Memory leak: AIQuery.vue has no cleanup hook at all | HIGH | A3, A7 | `AIQuery.vue` | S | P1 |
| AUDIT-018 | Memory leak: trends/index.vue -- no cleanup, 3 charts + resize listener leak | HIGH | A3, A7 | `analytics/trends/index.vue` | S | P1 |
| AUDIT-019 | Memory leak: ExcelUpload.vue -- anonymous resize listener never removed | HIGH | A3 | `ExcelUpload.vue` L324 | S | P1 |
| AUDIT-020 | 17 `fetch()` calls have no timeout -- hang indefinitely if Python service unresponsive | HIGH | A7 | `api/smartbi.ts` | M | P1 |
| AUDIT-021 | 17 `fetch()` calls do not check `response.ok` -- JSON parse error on HTML error pages | HIGH | A7 | `api/smartbi.ts` | M | P1 |
| AUDIT-022 | File upload: no file size limit enforcement at controller level | HIGH | A4 | `SmartBIController.java` L154 | S | P1 |
| AUDIT-023 | File upload: content type (MIME) not validated, only extension checked | HIGH | A4 | `SmartBIController.java` L146 | S | P1 |
| AUDIT-024 | `#909399` secondary text fails WCAG AA contrast (3.5:1 on white, needs 4.5:1) -- used in 35+ files | HIGH | A2 | 35+ files | L | P1 |
| AUDIT-025 | Zero ARIA attributes in entire SmartBI module -- invisible to screen readers | HIGH | A7 | All SmartBI views | XL | P1 |
| AUDIT-026 | God-component: SmartBIAnalysis.vue at 3,937 lines -- needs decomposition into ~8 sub-components | HIGH | A3, A7 | `SmartBIAnalysis.vue` | XL | P1 |
| AUDIT-027 | Monolithic API file: api/smartbi.ts at 3,263 lines serving two backends with two auth models | HIGH | A3, A7 | `api/smartbi.ts` | XL | P1 |
| AUDIT-028 | 20x `as any` in SmartBIAnalysis.vue | HIGH | A3 | `SmartBIAnalysis.vue` | M | P1 |
| AUDIT-029 | Sequential dashboard aggregation: 9 service calls executed sequentially | HIGH | A4 | `SmartBIController.java` L804-865 | M | P1 |
| AUDIT-030 | N+1 query: getUploadsMissingFields loops uploads calling getFieldCount per upload | HIGH | A4 | `SmartBIController.java` L2116-2127 | M | P1 |
| AUDIT-031 | Frontend calls `POST /export` -- no backend handler exists | HIGH | A4 | `api/smartbi.ts`, `SmartBIController.java` | L | P1 |
| AUDIT-032 | Double-wrapped response when Java facade calls Python service | HIGH | A4 | `SmartBIController.java` L919 | M | P1 |
| AUDIT-033 | KPICard interface duplicated in 4 files with different shapes | HIGH | A3, A6 | `types/smartbi.ts`, `api/smartbi.ts`, `Dashboard.vue`, `SalesAnalysis.vue` | S | P1 |
| AUDIT-034 | Shared KPICard.vue used by only 1/20 pages -- 40hrs of engineering effort wasted | HIGH | A6, A7 | All 20 pages | XL | P1 |
| AUDIT-035 | Shared PeriodSelector.vue used by 0/20 pages | HIGH | A6, A7 | All pages with date selection | L | P1 |
| AUDIT-036 | Shared DynamicChartRenderer.vue used by 0/20 analysis pages | HIGH | A6 | All pages with ECharts | XL | P1 |
| AUDIT-037 | `document.getElementById()` used for chart init in 5 files -- fragile, non-Vue-idiomatic | HIGH | A6, A7 | `SalesAnalysis.vue`, `Dashboard.vue`, `FinanceAnalysis.vue`, `trends/index.vue`, `production-report/index.vue` | M | P1 |
| AUDIT-038 | 15 "feature in development" stubs exposed to production users | HIGH | A7 | Multiple files across SmartBI, warehouse, HR modules | M | P1 |
| AUDIT-039 | No disabled state on any button during async operations -- double-click triggers duplicate API calls | HIGH | A7 | All SmartBI views | M | P1 |
| AUDIT-040 | DataCompletenessView.vue uses raw `fetch()` bypassing auth and error handling | HIGH | A3 | `DataCompletenessView.vue` L70 | S | P1 |
| AUDIT-041 | SmartBIAnalysis.vue uses raw `fetch()` bypassing API client at L1264 | HIGH | A3 | `SmartBIAnalysis.vue` L1264 | S | P1 |
| AUDIT-042 | 3 `ref<any>` with zero type safety in ai-reports/index.vue | HIGH | A3, A7 | `ai-reports/index.vue` L12-17 | M | P1 |
| AUDIT-043 | 5x `(d: any)` + 5x `[] as any[]` in trends/index.vue | HIGH | A3 | `analytics/trends/index.vue` | M | P1 |
| AUDIT-044 | No responsive breakpoints at all in ProductionAnalysis.vue | HIGH | A7 | `ProductionAnalysis.vue` | M | P1 |
| AUDIT-045 | All 69 error responses in SmartBIController use HTTP 200 status | MEDIUM | A4 | `SmartBIController.java` | L | P2 |
| AUDIT-046 | Error messages leak Java exception details to client | MEDIUM | A4 | `SmartBIController.java` | M | P2 |
| AUDIT-047 | Inconsistent response format across Python endpoints | MEDIUM | A4 | Python API modules | L | P2 |
| AUDIT-048 | All catch blocks catch generic Exception -- masks programming errors | MEDIUM | A4 | `SmartBIController.java` | M | P2 |
| AUDIT-049 | `getUploadHistory` returns unbounded list with no pagination | MEDIUM | A4 | `SmartBIController.java` L1973 | S | P2 |
| AUDIT-050 | Full table load: all data rows loaded into memory for analysis | MEDIUM | A4 | `DynamicAnalysisServiceImpl.java` L70 | L | P2 |
| AUDIT-051 | 7 in-memory caches with no eviction or TTL | MEDIUM | A4 | `SmartBIConfigServiceImpl.java` L59-66 | M | P2 |
| AUDIT-052 | NL query response calls full analysis service for one KPI value | MEDIUM | A4 | `SmartBIController.java` L1625-1777 | M | P2 |
| AUDIT-053 | Dual color system: Element Plus coexists with Tailwind CSS colors | MEDIUM | A2, A7 | 35+ files | L | P2 |
| AUDIT-054 | CSS variables defined in style.css but rarely referenced -- hardcoded hex everywhere | MEDIUM | A2 | All 42+ files | XL | P2 |
| AUDIT-055 | 20 unique font-size values with no design token system | MEDIUM | A2 | All files | L | P2 |
| AUDIT-056 | KPI value font-size inconsistent: 22px, 24px, 26px, 28px, 32px, 36px across dashboards | MEDIUM | A2, A6 | Dashboard*.vue, analytics/ | M | P2 |
| AUDIT-057 | White text on colored status badges fails WCAG AA | MEDIUM | A2 | Status badges, KPI icons | M | P2 |
| AUDIT-058 | No keyboard focus indicators -- no custom :focus-visible styles | MEDIUM | A2, A7 | All interactive components | M | P2 |
| AUDIT-059 | 14 unique box-shadow variants -- should be 3-4 elevation tokens | MEDIUM | A2 | 20+ files | M | P2 |
| AUDIT-060 | 10 unique border-radius values for cards (4px, 6px, 8px, 10px, 12px, 16px) | MEDIUM | A2, A7 | 20+ files | M | P2 |
| AUDIT-061 | Page padding mismatch: AppLayout 16px vs views 20px vs SmartBI 24px | MEDIUM | A2 | AppLayout, views | S | P2 |
| AUDIT-062 | Three different chart color palettes (DynamicChartRenderer, index.ts warm/cool, Tableau) | MEDIUM | A2 | `DynamicChartRenderer.vue`, `index.ts`, `SmartBIAnalysis.vue` | M | P2 |
| AUDIT-063 | Date shortcuts array duplicated verbatim between FinanceAnalysis and SalesAnalysis | MEDIUM | A3, A6 | `FinanceAnalysis.vue`, `SalesAnalysis.vue` | S | P2 |
| AUDIT-064 | `formatNumber()` utility implemented 3 different ways in 3 files | MEDIUM | A3 | `analytics/index.vue`, `ProductionAnalysis.vue`, `smartbi/index.ts` | S | P2 |
| AUDIT-065 | 37+ snake_case field names in api/smartbi.ts violating camelCase convention | MEDIUM | A3 | `api/smartbi.ts` | M | P2 |
| AUDIT-066 | Hardcoded `factoryId || 'F001'` in 4 view files (separate from root cause in smartbi.ts) | MEDIUM | A3 | `AlertDashboard.vue`, `DataCompletenessView.vue`, `ProductionAnalysis.vue`, `kpi/index.vue` | S | P2 |
| AUDIT-067 | 9 setTimeout calls in SmartBIAnalysis.vue -- only 1 cleaned up on unmount | MEDIUM | A3, A7 | `SmartBIAnalysis.vue` | M | P2 |
| AUDIT-068 | 38 console.log/error/warn statements in SmartBIAnalysis.vue (production) | MEDIUM | A3, A7 | `SmartBIAnalysis.vue` | S | P2 |
| AUDIT-069 | Dashboard variant CSS duplication: ~80 lines identical styling in 6 files | MEDIUM | A6 | All 6 Dashboard*.vue files | M | P2 |
| AUDIT-070 | Icon background color method differs: hexToRgba() vs string concatenation '+ 20' | MEDIUM | A6 | `DashboardFinance.vue` vs others | S | P2 |
| AUDIT-071 | Breadcrumbs inconsistent: some SmartBI sub-pages have them, some do not | MEDIUM | A6 | SmartBI sub-pages | S | P2 |
| AUDIT-072 | Silent error handling (console.error only) in ProductionAnalysis, DataCompleteness, analytics/index, Dashboard variants | MEDIUM | A6 | 8+ files | M | P2 |
| AUDIT-073 | `document.getElementById('trend-chart')` fragile -- breaks with keep-alive or multiple instances | MEDIUM | A7 | `Dashboard.vue` L277 | S | P2 |
| AUDIT-074 | Hardcoded unit '万' in DynamicChartRenderer pie tooltip | MEDIUM | A7 | `DynamicChartRenderer.vue` L154 | S | P2 |
| AUDIT-075 | SmartBIAnalysis.vue uses Tailwind gray palette (25 occurrences) used nowhere else | MEDIUM | A7 | `SmartBIAnalysis.vue` | M | P2 |
| AUDIT-076 | Terminology inconsistency: "数据分析" / "智能分析" / "AI分析" for same concept | MEDIUM | A7 | Multiple files | S | P2 |
| AUDIT-077 | KPI value = null causes NaN display in KPICard.vue | MEDIUM | A7 | `KPICard.vue` | S | P2 |
| AUDIT-078 | Clickable KPI cards lack keyboard accessibility (no tabindex, no role="button") | MEDIUM | A7 | `KPICard.vue` L241-251 | S | P2 |
| AUDIT-079 | Fixed chart heights (200-500px) not responsive to viewport | LOW | A2, A5 | 10+ chart files | M | P3 |
| AUDIT-080 | No monospace/tabular-nums for KPI numeric values | LOW | A2 | KPICard, Dashboard*.vue | S | P3 |
| AUDIT-081 | Shorthand grays (#333, #666, #999) used instead of Element tokens | LOW | A2 | DashboardFinance, AlertDashboard | S | P3 |
| AUDIT-082 | No shared ECharts theme registration -- each chart builds inline theme | LOW | A2 | All chart components | M | P3 |
| AUDIT-083 | Three different hover elevation patterns (-2px, -4px, shadow-only) | LOW | A2 | Various | S | P3 |
| AUDIT-084 | Mixed transition timing functions (0.3s, 0.25s cubic-bezier, 0.2s ease) | LOW | A2 | Various | S | P3 |
| AUDIT-085 | God controller: SmartBIController.java at 2400+ lines, 37 endpoints | LOW | A4 | `SmartBIController.java` | XL | P3 |
| AUDIT-086 | 6 inner DTO classes defined inside SmartBIController | LOW | A4 | `SmartBIController.java` L2264-2398 | M | P3 |
| AUDIT-087 | Static thread pool not managed by Spring | LOW | A4 | `SmartBIUploadFlowServiceImpl.java` L106 | M | P3 |
| AUDIT-088 | Emojis injected into analysis text via regex -- unprofessional for BI tool | LOW | A7 | `SmartBIAnalysis.vue` L2035-2038 | S | P3 |
| AUDIT-089 | English text in Chinese UI: "of target" in KPICard.vue | LOW | A7 | `KPICard.vue` L386 | S | P3 |

---

## Priority Fix Plan

### P0 -- IMMEDIATE (16 items)

These must be fixed before any other work. They represent live security vulnerabilities, data integrity breaches, and broken features.

| # | ID | Fix Description | Files | Effort | Dependencies | Parallel? |
|---|----|-----------------|-------|--------|-------------|-----------|
| 1 | AUDIT-001 | Install DOMPurify, sanitize all `v-html` content in SmartBIAnalysis.vue (3 locations). Replace `formatAnalysis()` regex with DOMPurify-safe markup. | `SmartBIAnalysis.vue` | M | None | Yes (with #2-4) |
| 2 | AUDIT-002 | Sanitize `v-html` in ai-reports/index.vue with DOMPurify | `ai-reports/index.vue` | S | Install DOMPurify (same as #1) | Yes (with #1) |
| 3 | AUDIT-003 | Sanitize `v-html` in ProductionAnalysis.vue with DOMPurify | `ProductionAnalysis.vue` | S | Install DOMPurify (same as #1) | Yes (with #1) |
| 4 | AUDIT-004 | Sanitize `v-html` in AlertDashboard.vue with DOMPurify | `AlertDashboard.vue` | S | Install DOMPurify (same as #1) | Yes (with #1) |
| 5 | AUDIT-005 | Add `/api/admin/**` to JWT interceptor path patterns in WebMvcConfig.java | `WebMvcConfig.java` | S | None | Yes |
| 6 | AUDIT-006 | Restrict Python service port 8083 to localhost via Alibaba Cloud security group. Add shared secret header validation to FastAPI middleware. | `main.py`, security group | L | None | Yes (with #5) |
| 7 | AUDIT-007 | Remove or auth-gate the `clear-all-cache` endpoint | `analysis_cache.py` | S | None | Yes (with #6) |
| 8 | AUDIT-008 | Remove mock data fallback in DashboardFinance.vue; show error state instead | `DashboardFinance.vue` | S | None | Yes (with #9-10) |
| 9 | AUDIT-009 | Remove mock attendance data in DashboardHR.vue; show error state | `DashboardHR.vue` | S | None | Yes (with #8) |
| 10 | AUDIT-010 | Remove mock data in DashboardWarehouse.vue; show error state | `DashboardWarehouse.vue` | S | None | Yes (with #8) |
| 11 | AUDIT-011 | Fix `getFactoryId()` to throw error instead of silently falling back to 'F001'. Redirect to login if no factoryId available. | `api/smartbi.ts` | M | None | Yes |
| 12 | AUDIT-012 | Migrate auth data from localStorage to Pinia store backed by httpOnly cookie or secure session. At minimum, remove direct localStorage reads for user credentials. | `api/smartbi.ts` | M | AUDIT-011 | After #11 |
| 13 | AUDIT-013 | Either implement `GET /analysis/trend` in SmartBIController or remove the dead frontend call | `SmartBIController.java`, `api/smartbi.ts` | M | None | Yes (with #14) |
| 14 | AUDIT-014 | Either implement `POST /analysis/comparison` in SmartBIController or remove the dead frontend call | `SmartBIController.java`, `api/smartbi.ts` | M | None | Yes (with #13) |
| 15 | AUDIT-015 | Wrap all 17 `fetch()` calls in a `pythonFetch()` utility that adds auth headers, timeout, and `response.ok` check | `api/smartbi.ts` | L | AUDIT-006 (coordinate auth method) | After #6 |
| 16 | AUDIT-016 | Add factory_id ownership validation on Python cache save endpoint | `analysis_cache.py` | M | AUDIT-006 | After #6 |

---

### P1 -- HIGH (28 items)

Core quality issues that significantly degrade the user experience or violate project standards.

| # | ID | Fix Description | Files | Effort | Dependencies | Parallel? |
|---|----|-----------------|-------|--------|-------------|-----------|
| 1 | AUDIT-017 | Add `onBeforeUnmount` to AIQuery.vue: remove resize listener, dispose all chart instances in Map | `AIQuery.vue` | S | None | Yes (with #2-3) |
| 2 | AUDIT-018 | Add `onUnmounted` to trends/index.vue: remove resize listener, dispose 3 ECharts instances | `analytics/trends/index.vue` | S | None | Yes (with #1) |
| 3 | AUDIT-019 | Convert anonymous resize function to named function in ExcelUpload.vue; remove in onUnmounted | `ExcelUpload.vue` | S | None | Yes (with #1) |
| 4 | AUDIT-020 | Add AbortController timeout (30s) to all `fetch()` calls via the pythonFetch utility | `api/smartbi.ts` | M | AUDIT-015 | After P0 #15 |
| 5 | AUDIT-021 | Add `response.ok` check to all `fetch()` calls via the pythonFetch utility | `api/smartbi.ts` | M | AUDIT-015 | After P0 #15 |
| 6 | AUDIT-022 | Add explicit file size check (max 50MB) in SmartBIController upload endpoints | `SmartBIController.java` | S | None | Yes |
| 7 | AUDIT-023 | Add MIME type validation for .xlsx/.xls content types | `SmartBIController.java` | S | None | Yes (with #6) |
| 8 | AUDIT-024 | Replace `#909399` with `#86909c` (WCAG AA compliant) for secondary text across all files | 35+ files | L | AUDIT-054 (better with token system) | Can start independently |
| 9 | AUDIT-025 | Add ARIA attributes to SmartBI views: `aria-label` on buttons, `role="region"` on sections, `tabindex` on custom clickable elements | All SmartBI views | XL | None | Yes |
| 10 | AUDIT-026 | Decompose SmartBIAnalysis.vue into ~8 sub-components (Uploader, SheetList, ChartPanel, KPIPanel, CrossSheet, YoY, Stats, orchestrator) | `SmartBIAnalysis.vue` -> 8 new files | XL | None | Yes (dedicated task) |
| 11 | AUDIT-027 | Split api/smartbi.ts into domain modules: smartbi-upload.ts, smartbi-analysis.ts, smartbi-python.ts, smartbi-dashboard.ts | `api/smartbi.ts` -> 4+ new files | XL | AUDIT-015 | After P0 #15 |
| 12 | AUDIT-028 | Replace 20x `as any` in SmartBIAnalysis.vue with proper type definitions | `SmartBIAnalysis.vue` | M | AUDIT-026 (easier after decomposition) | After P1 #10 |
| 13 | AUDIT-029 | Parallelize dashboard aggregation with `CompletableFuture.allOf()` for the 9 independent service calls | `SmartBIController.java` | M | None | Yes |
| 14 | AUDIT-030 | Replace N+1 loop with single JOIN query for uploads-missing-fields | `SmartBIController.java` | M | None | Yes |
| 15 | AUDIT-031 | Implement `POST /export` endpoint or remove dead frontend export call | `SmartBIController.java`, `api/smartbi.ts` | L | None | Yes |
| 16 | AUDIT-032 | Fix double-wrapped response: unwrap Python responses before re-wrapping in ApiResponse | `SmartBIController.java` | M | None | Yes |
| 17 | AUDIT-033 | Consolidate all KPICard interface definitions to single source in `@/types/smartbi.ts` | `types/smartbi.ts`, `api/smartbi.ts`, `Dashboard.vue`, `SalesAnalysis.vue` | S | None | Yes |
| 18 | AUDIT-034 | Migrate KPI displays in analysis pages to use shared KPICard.vue component | All 20 pages | XL | AUDIT-033 | After P1 #17 |
| 19 | AUDIT-035 | Extend PeriodSelector.vue to support all needed modes; adopt across pages | All pages with date selection | L | None | Yes |
| 20 | AUDIT-036 | Migrate chart rendering in analysis pages to use DynamicChartRenderer.vue | All pages with ECharts | XL | AUDIT-037 | After P1 #21 |
| 21 | AUDIT-037 | Convert all `document.getElementById()` chart inits to Vue template refs | 5 files | M | None | Yes |
| 22 | AUDIT-038 | Hide or disable all "in development" stub buttons in production | Multiple files | M | None | Yes |
| 23 | AUDIT-039 | Add `:disabled="loading"` or `:loading="loading"` to all action buttons | All SmartBI views | M | None | Yes |
| 24 | AUDIT-040 | Replace raw `fetch()` in DataCompletenessView.vue with centralized API client | `DataCompletenessView.vue` | S | AUDIT-015 | After P0 #15 |
| 25 | AUDIT-041 | Replace raw `fetch()` in SmartBIAnalysis.vue L1264 with centralized API client | `SmartBIAnalysis.vue` | S | AUDIT-015 | After P0 #15 |
| 26 | AUDIT-042 | Replace 3 `ref<any>` in ai-reports/index.vue with proper interfaces | `ai-reports/index.vue` | M | None | Yes |
| 27 | AUDIT-043 | Replace `(d: any)` and `[] as any[]` in trends/index.vue with typed interfaces | `analytics/trends/index.vue` | M | None | Yes |
| 28 | AUDIT-044 | Add responsive breakpoints (768px, 1024px) to ProductionAnalysis.vue | `ProductionAnalysis.vue` | M | None | Yes |

---

### P2 -- MEDIUM (30 items)

Issues that affect professionalism and consistency but do not break functionality.

| # | ID | Fix Description | Files | Effort | Dependencies | Parallel? |
|---|----|-----------------|-------|--------|-------------|-----------|
| 1 | AUDIT-045 | Use proper HTTP status codes (400/500/503) instead of 200 for all errors | `SmartBIController.java` | L | None | Yes |
| 2 | AUDIT-046 | Log full error server-side; return generic user-facing messages | `SmartBIController.java` | M | None | Yes (with #1) |
| 3 | AUDIT-047 | Standardize Python endpoint response format to `{success, data, message}` | Python API modules | L | None | Yes |
| 4 | AUDIT-048 | Replace generic `catch(Exception)` with specific exception types | `SmartBIController.java` | M | None | Yes |
| 5 | AUDIT-049 | Add Pageable parameter to `getUploadHistory` | `SmartBIController.java` | S | None | Yes |
| 6 | AUDIT-050 | Use streaming/SQL aggregation instead of loading all rows | `DynamicAnalysisServiceImpl.java` | L | None | Yes |
| 7 | AUDIT-051 | Replace ConcurrentHashMap caches with Spring @Cacheable + TTL | `SmartBIConfigServiceImpl.java` | M | None | Yes |
| 8 | AUDIT-052 | Create lightweight KPI query methods instead of full analysis calls | `SmartBIController.java` | M | None | Yes |
| 9 | AUDIT-053 | Standardize on Element Plus color palette; remove Tailwind colors | 35+ files | L | AUDIT-054 | After P2 #10 |
| 10 | AUDIT-054 | Create design token system (CSS variables) and migrate hardcoded hex values | `style.css`, all files | XL | None | Start with token definition |
| 11 | AUDIT-055 | Adopt 8-step type scale with CSS variable tokens | All files | L | AUDIT-054 | After P2 #10 |
| 12 | AUDIT-056 | Standardize KPI value font-size to `--font-size-2xl: 32px` across all dashboards | Dashboard*.vue, analytics/ | M | AUDIT-054 | After P2 #10 |
| 13 | AUDIT-057 | Darken status badge background colors for WCAG AA compliance | Status badges, KPI icons | M | None | Yes |
| 14 | AUDIT-058 | Add `:focus-visible` styles to all interactive custom components | All interactive components | M | None | Yes |
| 15 | AUDIT-059 | Reduce box-shadows to 4 elevation tokens: sm/md/lg/xl | 20+ files | M | AUDIT-054 | After P2 #10 |
| 16 | AUDIT-060 | Standardize card border-radius to 12px; use token `--radius-lg` | 20+ files | M | AUDIT-054 | After P2 #10 |
| 17 | AUDIT-061 | Standardize page padding to 20px using `--page-padding` token | AppLayout, all views | S | AUDIT-054 | After P2 #10 |
| 18 | AUDIT-062 | Unify chart color palette: create single 10-color array from token system | Chart components | M | AUDIT-054 | After P2 #10 |
| 19 | AUDIT-063 | Extract shared `dateShortcuts` into reusable utility constant | `FinanceAnalysis.vue`, `SalesAnalysis.vue` | S | None | Yes |
| 20 | AUDIT-064 | Consolidate `formatNumber()` to single utility in shared module | 3 files | S | None | Yes |
| 21 | AUDIT-065 | Add response transform layer to convert Python snake_case to camelCase | `api/smartbi.ts` | M | AUDIT-015 | After P0 #15 |
| 22 | AUDIT-066 | Remove all hardcoded `factoryId || 'F001'` fallbacks in view files | 4 view files | S | AUDIT-011 | After P0 #11 |
| 23 | AUDIT-067 | Store all setTimeout IDs and clear them in onBeforeUnmount | `SmartBIAnalysis.vue` | M | None | Yes |
| 24 | AUDIT-068 | Remove all 38 console.log/error/warn from SmartBIAnalysis.vue production code | `SmartBIAnalysis.vue` | S | None | Yes |
| 25 | AUDIT-069 | Extract shared dashboard styling into SCSS mixin or shared partial | All 6 Dashboard*.vue | M | None | Yes |
| 26 | AUDIT-070 | Standardize icon background color to hexToRgba() approach across all dashboards | Dashboard*.vue | S | None | Yes |
| 27 | AUDIT-071 | Add breadcrumbs consistently to all SmartBI sub-pages | SmartBI sub-pages | S | None | Yes |
| 28 | AUDIT-072 | Replace `console.error` with user-facing error state + ElMessage.error | 8+ files | M | None | Yes |
| 29 | AUDIT-073 | Convert `document.getElementById('trend-chart')` to template ref in Dashboard.vue | `Dashboard.vue` | S | None | Yes |
| 30 | AUDIT-074 | Remove hardcoded '万' unit; derive from data or make configurable | `DynamicChartRenderer.vue` | S | None | Yes |

---

### P3 -- BACKLOG (15 items)

Nice-to-have improvements for long-term maintainability.

| # | ID | Fix Description | Files | Effort | Dependencies | Parallel? |
|---|----|-----------------|-------|--------|-------------|-----------|
| 1 | AUDIT-075 | Migrate SmartBIAnalysis.vue Tailwind grays to Element Plus tokens | `SmartBIAnalysis.vue` | M | AUDIT-054 | After P2 #10 |
| 2 | AUDIT-076 | Standardize terminology: pick one term each for "analysis", "dashboard", action buttons | Multiple files | S | None | Yes |
| 3 | AUDIT-077 | Add null/NaN guard in KPICard formattedValue computed | `KPICard.vue` | S | None | Yes |
| 4 | AUDIT-078 | Add tabindex, role="button", @keydown.enter to clickable KPI cards | `KPICard.vue` | S | AUDIT-025 | After P1 #9 |
| 5 | AUDIT-079 | Add responsive chart heights based on viewport | 10+ chart files | M | None | Yes |
| 6 | AUDIT-080 | Add `font-variant-numeric: tabular-nums` to KPI value classes | KPICard, Dashboard*.vue | S | None | Yes |
| 7 | AUDIT-081 | Replace shorthand grays (#333, #666, #999) with Element tokens | DashboardFinance, AlertDashboard | S | AUDIT-054 | After P2 #10 |
| 8 | AUDIT-082 | Create shared ECharts theme and register globally | All chart components | M | AUDIT-062 | After P2 #18 |
| 9 | AUDIT-083 | Unify hover elevation to single pattern (translateY(-2px) + shadow) | Various | S | AUDIT-059 | After P2 #15 |
| 10 | AUDIT-084 | Standardize transition timing to `0.25s cubic-bezier(0.4, 0, 0.2, 1)` | Various | S | None | Yes |
| 11 | AUDIT-085 | Split SmartBIController.java into sub-controllers (Upload, Analysis, Dashboard) | `SmartBIController.java` | XL | None | Yes |
| 12 | AUDIT-086 | Move 6 inner DTO classes to dedicated DTO files | `SmartBIController.java` | M | None | Yes |
| 13 | AUDIT-087 | Replace static thread pool with Spring-managed @Async TaskExecutor | `SmartBIUploadFlowServiceImpl.java` | M | None | Yes |
| 14 | AUDIT-088 | Replace emoji injection in formatAnalysis() with styled HTML badges | `SmartBIAnalysis.vue` | S | AUDIT-001 | After P0 #1 |
| 15 | AUDIT-089 | Fix English text "of target" to Chinese or use i18n | `KPICard.vue` | S | None | Yes |

---

## Execution Order

### Batch 1: Security Hotfixes (can all run in parallel)
**Estimated time**: 1 day
**No dependencies between these items.**

- **AUDIT-005**: Add `/api/admin/**` to JWT path patterns (5 min)
- **AUDIT-007**: Remove or auth-gate `clear-all-cache` endpoint (30 min)
- **AUDIT-008**: Remove mock data from DashboardFinance.vue (30 min)
- **AUDIT-009**: Remove mock data from DashboardHR.vue (30 min)
- **AUDIT-010**: Remove mock data from DashboardWarehouse.vue (30 min)
- **AUDIT-001 + 002 + 003 + 004**: Install DOMPurify; sanitize all 6 v-html locations (2 hrs total)
- **AUDIT-011**: Fix getFactoryId() to throw instead of fallback to 'F001' (1 hr)
- **AUDIT-006**: Restrict Python service port 8083 in security group + add shared secret middleware (4 hrs)

### Batch 2: Auth & API Integrity (after Batch 1)
**Estimated time**: 1.5 days
**Depends on**: Batch 1 (AUDIT-006 for auth method, AUDIT-011 for factoryId fix)

- **AUDIT-012**: Migrate auth data from localStorage (1 hr, depends on AUDIT-011)
- **AUDIT-015**: Create `pythonFetch()` utility wrapping all 17 fetch() calls with auth headers, timeout, response.ok check (4 hrs, depends on AUDIT-006)
- **AUDIT-016**: Add factory_id ownership validation on Python cache save (1 hr, depends on AUDIT-006)
- **AUDIT-013 + 014**: Implement or remove dead trend/comparison endpoints (2 hrs each)
- **AUDIT-022 + 023**: Add file size + MIME validation to uploads (30 min total)

### Batch 3: Memory Leaks & Critical UX (can run in parallel with Batch 2)
**Estimated time**: 0.5 day

- **AUDIT-017**: Add cleanup to AIQuery.vue (15 min)
- **AUDIT-018**: Add cleanup to trends/index.vue (15 min)
- **AUDIT-019**: Fix resize listener in ExcelUpload.vue (15 min)
- **AUDIT-033**: Consolidate KPICard interface to single source (30 min)
- **AUDIT-038**: Hide/disable "in development" stubs (1 hr)
- **AUDIT-039**: Add disabled state to buttons during loading (1 hr)

### Batch 4: API Layer Refactoring (after Batch 2)
**Estimated time**: 2 days
**Depends on**: AUDIT-015 (pythonFetch utility)

- **AUDIT-020 + 021**: Timeout + response.ok check via pythonFetch (included in AUDIT-015)
- **AUDIT-040**: Replace raw fetch in DataCompletenessView.vue (30 min)
- **AUDIT-041**: Replace raw fetch in SmartBIAnalysis.vue (30 min)
- **AUDIT-027**: Split api/smartbi.ts into domain modules (8+ hrs)
- **AUDIT-065**: Add snake_case to camelCase transform layer (2 hrs)
- **AUDIT-032**: Fix double-wrapped response (2 hrs)

### Batch 5: Backend Fixes (can run in parallel with Batch 4)
**Estimated time**: 2 days

- **AUDIT-029**: Parallelize dashboard aggregation (2 hrs)
- **AUDIT-030**: Fix N+1 query (1 hr)
- **AUDIT-045**: Proper HTTP status codes for errors (4 hrs)
- **AUDIT-046**: Sanitize error messages (2 hrs)
- **AUDIT-049**: Add pagination to getUploadHistory (30 min)
- **AUDIT-051**: Replace ConcurrentHashMap with Spring Cache (2 hrs)

### Batch 6: Design Token Foundation (can start independently)
**Estimated time**: 2 days

- **AUDIT-054**: Define complete CSS variable token system in style.css (colors, typography, spacing, elevation, radius)
- **AUDIT-053**: Begin migrating hardcoded colors to tokens (start with high-visibility pages)
- **AUDIT-024**: Replace #909399 with WCAG-compliant alternative across all files
- **AUDIT-055**: Adopt type scale tokens
- **AUDIT-056**: Standardize KPI value font-sizes

### Batch 7: Component Architecture (after Batches 3-4)
**Estimated time**: 5+ days

- **AUDIT-026**: Decompose SmartBIAnalysis.vue into sub-components (8+ hrs)
- **AUDIT-034**: Migrate pages to use shared KPICard.vue (8+ hrs, after AUDIT-033)
- **AUDIT-035**: Adopt PeriodSelector.vue across pages (4 hrs)
- **AUDIT-036**: Migrate to DynamicChartRenderer.vue (8+ hrs, after AUDIT-037)
- **AUDIT-037**: Convert getElementById to template refs (2 hrs)

### Batch 8: Polish & Consistency (after Batches 6-7)
**Estimated time**: 3 days

- **AUDIT-057 + 058**: WCAG contrast fixes + focus indicators (2 hrs)
- **AUDIT-059 + 060**: Elevation + border-radius token migration (2 hrs)
- **AUDIT-062**: Unified chart color palette (2 hrs)
- **AUDIT-069**: Dashboard CSS deduplication (2 hrs)
- **AUDIT-072**: Error state improvements (2 hrs)
- **AUDIT-025**: ARIA attributes (8+ hrs)
- **AUDIT-044**: Responsive breakpoints for ProductionAnalysis (1 hr)

---

## Design Token Migration Plan

Based on A2's proposed token system, the migration should proceed in phases:

### Phase 1: Token Definition (Day 1 of Batch 6)
Add to `src/style.css` `:root`:

**Color tokens**: `--color-primary`, `--color-success`, `--color-warning`, `--color-danger`, `--color-info`, `--color-text-primary` (#303133), `--color-text-regular` (#606266), `--color-text-secondary` (#86909c -- upgraded from #909399 for WCAG AA), `--color-positive` (#059669), `--color-negative` (#dc2626), 10 chart colors.

**Typography tokens**: `--font-size-xs` (10px), `--font-size-sm` (12px), `--font-size-base` (14px), `--font-size-md` (16px), `--font-size-lg` (20px), `--font-size-xl` (24px), `--font-size-2xl` (32px), `--font-size-3xl` (48px). Font weights: normal (400), medium (500), semibold (600), bold (700). Monospace font family for numeric values.

**Spacing tokens**: `--space-1` (4px) through `--space-12` (48px). `--page-padding` (20px), `--card-padding` (20px), `--section-gap` (24px), `--element-gap` (16px).

**Elevation tokens**: `--shadow-sm`, `--shadow-md`, `--shadow-lg`, `--shadow-xl`. Radius: `--radius-sm` (4px), `--radius-md` (8px), `--radius-lg` (12px), `--radius-full` (9999px).

### Phase 2: High-Impact Migration (Days 2-3)
Replace `#909399` with `var(--color-text-secondary)` in all 35+ files. Replace shorthand grays. Standardize card border-radius to `var(--radius-lg)`.

### Phase 3: Chart Unification (Day 4)
Create shared ECharts theme using unified chart palette. Register globally. Remove per-component inline palettes (PIE_COLORS, warm/cool arrays, Tableau colors).

### Phase 4: Full Migration (Days 5-8)
Migrate all remaining hardcoded hex values to `var()` references, file by file, starting with highest-traffic pages.

---

## Appendix

### A. Complete Color Inventory (from A2)

**68 unique hex colors** across the module, broken into:
- 5 blues (Element #409eff, Tailwind #3b82f6, Tableau #4E79A7, Ant #1890ff, Tailwind-600 #2563eb)
- 7 greens (Element #67c23a, Tailwind #10b981, #059669, #22c55e, ECharts #91cc75, Olive #6B8E23, Ant #52c41a)
- 8 reds (Element #f56c6c, Tailwind #ef4444, #dc2626, Tableau #E15759, Flat UI #E74C3C, Custom #ff6b6b, Ant #f5222d, #ff4d4f)
- 4 yellows (Element #e6a23c, Tailwind #f59e0b, #d97706, Custom #ffd93d)
- 14 grays (Element #303133, #606266, #909399, #c0c4cc + Tailwind #1f2937, #4b5563, #6b7280, #9ca3af + shorthand #333, #666, #999)
- 7 purples (#9B59B6, #8b5cf6, #764ba2, #8A2BE2, #c084fc, #d946ef, #B07AA1)
- 23 additional accent/background/border colors

**Critical inconsistencies**: C1-C8 as documented by A2, with the most severe being the triple primary blue (#409eff / #3b82f6 / #4E79A7) appearing within the same page (SmartBIAnalysis.vue).

### B. Complete TypeScript Issue List (from A3)

| Category | Count |
|----------|-------|
| `as any` casts | 33 across 7 files |
| `ref<any>` / `[] as any[]` | ~14 across 5 files |
| `catch(error: any)` | 2 in SmartBIAnalysis.vue |
| Untyped callback `(x: any)` | 11 across 3 files |
| Duplicated interface definitions | 7 (KPICard x4, KPIData, FinanceKPI, SmartKPI) |
| Missing type definitions | 8 files with locally-defined interfaces that should be shared |

**Total TypeScript safety violations**: ~68 occurrences across 12 files.

### C. Endpoint Coverage Matrix (from A4)

| Category | Count |
|----------|-------|
| Frontend-to-Java endpoints (working) | 10 |
| Frontend-to-Python endpoints (working) | 16 |
| Frontend calls with NO backend handler | 3 (trend, comparison, export) |
| Java endpoints with no frontend caller | 35+ (many used by mobile app) |
| Python endpoints with no auth | ALL (25+) |
| Java admin endpoints with no auth | ALL SmartBIConfigController endpoints |

**Security coverage**: 0% of Python endpoints authenticated. 0% of admin endpoints authenticated. 100% of mobile API endpoints authenticated via JWT interceptor.

### D. Benchmark Scoring (from A5)

| Dimension | Our Score | Industry Avg | Gap |
|-----------|-----------|-------------|-----|
| KPI Card Design | 7/10 | 8/10 | -1 |
| Chart Interaction | 5/10 | 8/10 | -3 |
| Filter/Slicer UX | 4/10 | 8/10 | -4 |
| Loading States | 5/10 | 7/10 | -2 |
| Empty States | 5/10 | 7/10 | -2 |
| Error States | 5/10 | 7/10 | -2 |
| Data Drill-down | 7/10 | 8/10 | -1 |
| AI Integration | 7/10 | 7/10 | 0 |
| Responsive Design | 4/10 | 7/10 | -3 |
| Color Consistency | 4/10 | 8/10 | -4 |
| **TOTAL** | **53/100** | **75/100** | **-22** |

**Strongest area**: AI Integration (on par with industry -- NL query, structured insights, auto-charts are genuinely innovative).

**Largest gaps**: Filter/Slicer UX (-4), Color Consistency (-4), Chart Interaction (-3), Responsive Design (-3).

**Top 3 quick wins by priority score** (Impact/Effort):
1. Dashboard KPI Click-to-Detail Navigation (score: 8.0)
2. Animated KPI Count-Up Transitions (score: 5.0)
3. Per-Widget Skeleton Loading (score: 4.0)

### E. Consistency Matrix (from A6)

| Pattern | Consistency Score | Key Problem |
|---------|------------------|-------------|
| Component Reuse | 2/10 | 4 shared components, 3 total imports across 20 pages |
| Visual Consistency | 4/10 | Dashboard variants internally consistent; SmartBI vs Analytics diverge |
| Interaction Patterns | 3/10 | 4 different date selection mechanisms |
| Code Patterns | 3/10 | getElementById vs template refs; local vs shared types |
| Error Handling | 2/10 | 15/20 pages silently fail; 3 use mock fallback data |
| Loading States | 5/10 | All use v-loading but granularity varies; 0 skeleton loading |
| Empty States | 3/10 | el-empty vs ECharts-title vs nothing |
| Type Safety | 4/10 | Shared types exist but pages define local duplicates |
| **Overall** | **4/10** | |

### F. Devil's Advocate Severity Changes (from A7)

**Escalated to CRITICAL** (3 items):
- 17 raw `fetch()` calls bypassing auth (was HIGH -> CRITICAL)
- Hardcoded `factoryId || 'F001'` root cause (was HIGH -> CRITICAL)
- Shared KPICard used by 1/20 pages representing wasted engineering effort (was HIGH -> CRITICAL)

**Escalated to HIGH** (11 items):
- v-html XSS in SmartBIAnalysis.vue (was tagged MEDIUM in per-file, escalated to CRITICAL)
- 38 console.log statements in production file (was MEDIUM)
- 9 uncleaned setTimeout calls (was MEDIUM)
- 15 "feature in development" stubs (new finding)
- No disabled state on buttons during loading (new finding)
- No responsive breakpoints in ProductionAnalysis (new finding)
- Zero ARIA attributes in SmartBI module (new finding)
- KPICard lacks keyboard accessibility (new finding)
- 17 fetch calls have no timeout (new finding)
- fetch calls do not check response.ok (new finding)
- localStorage stores user object in plain text (new finding)

**Downgraded** (4 items):
- DashboardProduction 555 lines (LOW -> INFO -- well-structured)
- @playwright/test unused dependency (LOW -> INFO -- zero runtime impact)
- Table border inconsistency (LOW -> INFO -- deliberate UX choice)
- Line-height inconsistency (Minor -> INFO -- correct typographic practice)

---

*This report is the single source of truth for Phase 5 (Execution). All issue IDs, severities, effort estimates, and dependency chains are final. The execution agent should process Batches 1-8 in order, parallelizing within each batch as indicated.*
