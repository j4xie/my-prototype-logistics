# Execution Plan: All 89 Issues — Agent Team Assignment

**Date**: 2026-02-11
**Source**: MASTER_AUDIT_REPORT.md (89 issues: 16 P0, 28 P1, 30 P2, 15 P3)
**Target**: Fix ALL issues, from P0 security to P3 polish

---

## Agent Team (6 Execution Agents)

| Agent | Name | Specialization | Primary Files |
|-------|------|---------------|---------------|
| **E1** | Security Agent | XSS, auth, mock data removal | SmartBI views, Dashboard*.vue, WebMvcConfig.java, Python main.py |
| **E2** | Frontend Arch Agent | Component decomposition, TypeScript safety, memory leaks | SmartBIAnalysis.vue (split), trends/, AIQuery.vue, types/ |
| **E3** | Backend Agent | Java/Python endpoint fixes, performance, error handling | SmartBIController.java, Python API, services |
| **E4** | Design System Agent | CSS tokens, color migration, typography, WCAG compliance | style.css, all `<style>` blocks |
| **E5** | API Layer Agent | api/smartbi.ts refactoring, pythonFetch, snake→camelCase | api/smartbi.ts → split into modules |
| **E6** | Polish Agent | Accessibility, responsive, consistency, shared components adoption | All views (after E2/E4 complete) |

---

## Phase Execution Schedule (8 Batches)

```
时间线    Slot-1 (Agent)       Slot-2 (Agent)       Slot-3 (Agent)
=======  ===================  ===================  ===================
Batch 1  E1 Security(前端)    E3 Backend(安全)     (空闲 - 等依赖)
Batch 2  E5 API Layer         E3 Backend(端点)     E2 Memory Leaks
Batch 3  E5 API Refactor      E3 Backend(性能)     E4 Design Tokens
Batch 4  E2 Architecture      E4 Color Migration   E6 Responsive
Batch 5  E2 Shared Components E4 Typography+WCAG   E6 Accessibility
Batch 6  E6 Final Polish      E2 TypeScript        E4 Chart Theme
```

---

## Batch 1: Security Hotfixes (P0)

**Agents**: E1 (Frontend) + E3 (Backend) 并行
**Dependency**: None — can start immediately

### E1 Security Agent — 前端安全修复 (7 tasks)

| # | Issue ID | Task | Files | Effort |
|---|----------|------|-------|--------|
| 1 | AUDIT-001 | Install DOMPurify; sanitize `formatAnalysis()` + 3 `v-html` in SmartBIAnalysis.vue | `SmartBIAnalysis.vue` | M |
| 2 | AUDIT-002 | Sanitize `v-html` in ai-reports with DOMPurify | `ai-reports/index.vue` | S |
| 3 | AUDIT-003 | Sanitize `v-html` with `marked()` in ProductionAnalysis | `ProductionAnalysis.vue` | S |
| 4 | AUDIT-004 | Sanitize `v-html` with `marked()` in AlertDashboard | `AlertDashboard.vue` | S |
| 5 | AUDIT-008 | Remove mock data fallback → show error state | `DashboardFinance.vue` | S |
| 6 | AUDIT-009 | Remove mock attendance data → show error state | `DashboardHR.vue` | S |
| 7 | AUDIT-010 | Remove mock stock/inbound data → show error state | `DashboardWarehouse.vue` | S |

### E3 Backend Agent — 后端安全修复 (5 tasks)

| # | Issue ID | Task | Files | Effort |
|---|----------|------|-------|--------|
| 1 | AUDIT-005 | Add `/api/admin/**` to JWT interceptor paths | `WebMvcConfig.java` | S |
| 2 | AUDIT-006 | Restrict port 8083 to localhost + add shared secret middleware | `main.py`, 阿里云安全组 | L |
| 3 | AUDIT-007 | Auth-gate `clear-all-cache` endpoint | `analysis_cache.py` | S |
| 4 | AUDIT-013 | Implement `GET /analysis/trend` or remove dead call | `SmartBIController.java`, `api/smartbi.ts` | M |
| 5 | AUDIT-014 | Implement `POST /analysis/comparison` or remove dead call | `SmartBIController.java`, `api/smartbi.ts` | M |

**Batch 1 交付物**: 所有 XSS 漏洞修复, mock data 移除, 后端认证加固

---

## Batch 2: Auth & API Integrity + Memory Leaks (P0 remaining + P1 start)

**Agents**: E5 (API Layer) + E3 (Backend endpoints) + E2 (Memory) 三并行

### E5 API Layer Agent — API 认证与整合 (4 tasks)

| # | Issue ID | Task | Files | Effort |
|---|----------|------|-------|--------|
| 1 | AUDIT-011 | Fix `getFactoryId()` — throw error instead of fallback to 'F001' | `api/smartbi.ts` | M |
| 2 | AUDIT-012 | Migrate auth data from localStorage to Pinia store | `api/smartbi.ts` | M |
| 3 | AUDIT-015 | Create `pythonFetch()` utility wrapping all 17 fetch() with auth + timeout + response.ok | `api/smartbi.ts` | L |
| 4 | AUDIT-016 | Add factory_id ownership check on Python cache save (coordinate with E3) | `analysis_cache.py` | M |

### E3 Backend Agent — 端点补全与上传安全 (4 tasks)

| # | Issue ID | Task | Files | Effort |
|---|----------|------|-------|--------|
| 1 | AUDIT-022 | Add file size limit (50MB) to upload endpoints | `SmartBIController.java` | S |
| 2 | AUDIT-023 | Add MIME type validation (.xlsx/.xls) | `SmartBIController.java` | S |
| 3 | AUDIT-031 | Implement `POST /export` or remove dead call | `SmartBIController.java` | L |
| 4 | AUDIT-032 | Fix double-wrapped response in Java→Python facade | `SmartBIController.java` | M |

### E2 Frontend Arch Agent — 内存泄漏与关键 UX (8 tasks)

| # | Issue ID | Task | Files | Effort |
|---|----------|------|-------|--------|
| 1 | AUDIT-017 | Add `onBeforeUnmount` cleanup to AIQuery.vue | `AIQuery.vue` | S |
| 2 | AUDIT-018 | Add cleanup to trends/index.vue (3 charts + resize) | `trends/index.vue` | S |
| 3 | AUDIT-019 | Fix anonymous resize listener in ExcelUpload.vue | `ExcelUpload.vue` | S |
| 4 | AUDIT-033 | Consolidate KPICard interface to `types/smartbi.ts` | `types/smartbi.ts` + 3 files | S |
| 5 | AUDIT-038 | Hide/disable "in development" stub buttons | Multiple files | M |
| 6 | AUDIT-039 | Add `:disabled="loading"` to all action buttons | All SmartBI views | M |
| 7 | AUDIT-067 | Store setTimeout IDs, clear in onBeforeUnmount | `SmartBIAnalysis.vue` | M |
| 8 | AUDIT-068 | Remove 38 console.log/error/warn from production | `SmartBIAnalysis.vue` | S |

**Batch 2 交付物**: 全部 P0 完成, 内存泄漏修复, API 层认证统一

---

## Batch 3: API Refactoring + Backend Performance + Design Token Foundation

**Agents**: E5 (API split) + E3 (Java performance) + E4 (Design tokens) 三并行

### E5 API Layer Agent — API 文件拆分 (5 tasks)

| # | Issue ID | Task | Files | Effort |
|---|----------|------|-------|--------|
| 1 | AUDIT-020 | Add AbortController timeout (30s) via pythonFetch | `api/smartbi.ts` | M |
| 2 | AUDIT-021 | Add `response.ok` check via pythonFetch | `api/smartbi.ts` | M |
| 3 | AUDIT-040 | Replace raw fetch in DataCompletenessView | `DataCompletenessView.vue` | S |
| 4 | AUDIT-041 | Replace raw fetch in SmartBIAnalysis.vue | `SmartBIAnalysis.vue` | S |
| 5 | AUDIT-027 | Split api/smartbi.ts → 4 domain modules | `api/smartbi.ts` → `smartbi-upload.ts`, `smartbi-analysis.ts`, `smartbi-python.ts`, `smartbi-dashboard.ts` | XL |

### E3 Backend Agent — Java 性能与错误处理 (7 tasks)

| # | Issue ID | Task | Files | Effort |
|---|----------|------|-------|--------|
| 1 | AUDIT-029 | Parallelize 9 dashboard service calls with CompletableFuture | `SmartBIController.java` | M |
| 2 | AUDIT-030 | Fix N+1 query: single JOIN for uploads-missing-fields | `SmartBIController.java` | M |
| 3 | AUDIT-045 | Use proper HTTP status codes (400/500) for errors | `SmartBIController.java` | L |
| 4 | AUDIT-046 | Return generic error messages, log full details server-side | `SmartBIController.java` | M |
| 5 | AUDIT-048 | Replace generic `catch(Exception)` with specific types | `SmartBIController.java` | M |
| 6 | AUDIT-049 | Add Pageable to `getUploadHistory` | `SmartBIController.java` | S |
| 7 | AUDIT-051 | Replace ConcurrentHashMap with Spring @Cacheable + TTL | `SmartBIConfigServiceImpl.java` | M |

### E4 Design System Agent — 设计令牌体系建立 (5 tasks)

| # | Issue ID | Task | Files | Effort |
|---|----------|------|-------|--------|
| 1 | AUDIT-054 | Define complete CSS variable token system in `:root` | `style.css` | L |
| 2 | AUDIT-024 | Replace `#909399` → `#86909c` (WCAG AA) across 35+ files | 35+ files | L |
| 3 | AUDIT-053 | Standardize to Element Plus colors, remove Tailwind duplicates | 35+ files | L |
| 4 | AUDIT-055 | Adopt 8-step typography scale with CSS tokens | All files with font-size | L |
| 5 | AUDIT-056 | Standardize KPI value font-size to `--font-size-2xl: 32px` | Dashboard*.vue, analytics/ | M |

**Batch 3 交付物**: API 拆分完成, Java 性能优化, 设计令牌体系建立

---

## Batch 4: Component Architecture + Color Migration + Responsive

**Agents**: E2 (Architecture) + E4 (Colors) + E6 (Responsive) 三并行

### E2 Frontend Arch Agent — 组件拆分 (5 tasks)

| # | Issue ID | Task | Files | Effort |
|---|----------|------|-------|--------|
| 1 | AUDIT-026 | Decompose SmartBIAnalysis.vue → 8 sub-components | `SmartBIAnalysis.vue` → `SmartBIUploader.vue`, `SheetList.vue`, `ChartPanel.vue`, `KPIPanel.vue`, `CrossSheetAnalysis.vue`, `YoYComparison.vue`, `StatisticsPanel.vue`, `SmartBIOrchestrator.vue` | XL |
| 2 | AUDIT-028 | Replace 20× `as any` with proper types (easier after split) | Split files | M |
| 3 | AUDIT-037 | Convert `document.getElementById()` to template refs in 5 files | `SalesAnalysis.vue`, `Dashboard.vue`, `FinanceAnalysis.vue`, `trends/index.vue`, `production-report/index.vue` | M |
| 4 | AUDIT-042 | Replace `ref<any>` in ai-reports with proper interfaces | `ai-reports/index.vue` | M |
| 5 | AUDIT-043 | Replace `(d: any)` and `[] as any[]` in trends with types | `trends/index.vue` | M |

### E4 Design System Agent — 颜色迁移与视觉修复 (6 tasks)

| # | Issue ID | Task | Files | Effort |
|---|----------|------|-------|--------|
| 1 | AUDIT-059 | Reduce box-shadows to 4 elevation tokens | 20+ files | M |
| 2 | AUDIT-060 | Standardize card border-radius to 12px via `--radius-lg` | 20+ files | M |
| 3 | AUDIT-061 | Standardize page padding to 20px via `--page-padding` | AppLayout, all views | S |
| 4 | AUDIT-062 | Create unified 10-color chart palette token | Chart components | M |
| 5 | AUDIT-057 | Darken status badge backgrounds for WCAG AA | Status badges | M |
| 6 | AUDIT-070 | Standardize icon background to hexToRgba() across dashboards | Dashboard*.vue | S |

### E6 Polish Agent — 响应式与基础修复 (5 tasks)

| # | Issue ID | Task | Files | Effort |
|---|----------|------|-------|--------|
| 1 | AUDIT-044 | Add responsive breakpoints to ProductionAnalysis | `ProductionAnalysis.vue` | M |
| 2 | AUDIT-063 | Extract shared `dateShortcuts` constant | `FinanceAnalysis.vue`, `SalesAnalysis.vue` | S |
| 3 | AUDIT-064 | Consolidate `formatNumber()` to single utility | 3 files | S |
| 4 | AUDIT-066 | Remove hardcoded `factoryId || 'F001'` in 4 view files | 4 files | S |
| 5 | AUDIT-071 | Add consistent breadcrumbs to all SmartBI sub-pages | SmartBI sub-pages | S |

**Batch 4 交付物**: SmartBIAnalysis.vue 拆分完成, 颜色系统统一, 响应式基础修复

---

## Batch 5: Shared Components + Typography/WCAG + Accessibility

**Agents**: E2 (Components) + E4 (Typography) + E6 (Accessibility) 三并行

### E2 Frontend Arch Agent — 共享组件推广 (4 tasks)

| # | Issue ID | Task | Files | Effort |
|---|----------|------|-------|--------|
| 1 | AUDIT-034 | Migrate pages to use shared KPICard.vue | 15+ pages | XL |
| 2 | AUDIT-035 | Extend PeriodSelector.vue, adopt across pages | Pages with date selection | L |
| 3 | AUDIT-036 | Migrate chart rendering to DynamicChartRenderer.vue | Pages with ECharts | XL |
| 4 | AUDIT-069 | Extract shared Dashboard CSS into SCSS mixin | 6 Dashboard*.vue | M |

### E4 Design System Agent — 排版与无障碍 (4 tasks)

| # | Issue ID | Task | Files | Effort |
|---|----------|------|-------|--------|
| 1 | AUDIT-058 | Add `:focus-visible` styles to interactive components | All interactive components | M |
| 2 | AUDIT-072 | Replace console.error with user-facing ElMessage + error state | 8+ files | M |
| 3 | AUDIT-075 | Migrate SmartBIAnalysis Tailwind grays to Element tokens | Split SmartBI files | M |
| 4 | AUDIT-081 | Replace shorthand grays (#333, #666) with tokens | Multiple files | S |

### E6 Polish Agent — 无障碍与交互完整性 (5 tasks)

| # | Issue ID | Task | Files | Effort |
|---|----------|------|-------|--------|
| 1 | AUDIT-025 | Add ARIA attributes (aria-label, role, tabindex) to SmartBI views | All SmartBI views | XL |
| 2 | AUDIT-078 | Add keyboard accessibility to KPICard (tabindex, role=button, keydown.enter) | `KPICard.vue` | S |
| 3 | AUDIT-073 | Convert Dashboard.vue getElementById to template ref | `Dashboard.vue` | S |
| 4 | AUDIT-074 | Remove hardcoded '万' unit in chart tooltips | `DynamicChartRenderer.vue` | S |
| 5 | AUDIT-077 | Add null/NaN guard in KPICard formattedValue | `KPICard.vue` | S |

**Batch 5 交付物**: 共享组件全面推广, 无障碍支持, 排版统一

---

## Batch 6: Final Polish + Backend Cleanup + Remaining P3

**Agents**: E6 (Final polish) + E2 (TypeScript) + E4 (Chart theme) + E3 (Backend P3) 交替

### E6 Polish Agent — 最终一致性 (5 tasks)

| # | Issue ID | Task | Files | Effort |
|---|----------|------|-------|--------|
| 1 | AUDIT-076 | Standardize terminology ("数据分析" vs "智能分析") | Multiple files | S |
| 2 | AUDIT-079 | Add responsive chart heights based on viewport | 10+ chart files | M |
| 3 | AUDIT-080 | Add `font-variant-numeric: tabular-nums` to KPI values | KPICard, Dashboard*.vue | S |
| 4 | AUDIT-083 | Unify hover elevation to single pattern | Various | S |
| 5 | AUDIT-084 | Standardize transition timing | Various | S |

### E2 Frontend Arch Agent — TypeScript 与代码清理 (3 tasks)

| # | Issue ID | Task | Files | Effort |
|---|----------|------|-------|--------|
| 1 | AUDIT-065 | Add snake_case → camelCase transform for Python responses | `api/smartbi.ts` modules | M |
| 2 | AUDIT-088 | Replace emoji injection with styled HTML badges | SmartBI split files | S |
| 3 | AUDIT-089 | Fix English "of target" → Chinese or i18n | `KPICard.vue` | S |

### E4 Design System Agent — 图表主题 (1 task)

| # | Issue ID | Task | Files | Effort |
|---|----------|------|-------|--------|
| 1 | AUDIT-082 | Create shared ECharts theme, register globally | All chart components | M |

### E3 Backend Agent — 后端 P3 清理 (5 tasks)

| # | Issue ID | Task | Files | Effort |
|---|----------|------|-------|--------|
| 1 | AUDIT-047 | Standardize Python response format to `{success, data, message}` | Python API modules | L |
| 2 | AUDIT-050 | Use SQL aggregation instead of full table load | `DynamicAnalysisServiceImpl.java` | L |
| 3 | AUDIT-052 | Create lightweight KPI query methods | `SmartBIController.java` | M |
| 4 | AUDIT-085 | Split SmartBIController.java → sub-controllers | `SmartBIController.java` | XL |
| 5 | AUDIT-086 | Move inner DTO classes to dedicated files | `SmartBIController.java` | M |
| 6 | AUDIT-087 | Replace static thread pool with Spring @Async | `SmartBIUploadFlowServiceImpl.java` | M |

**Batch 6 交付物**: 全部 89 个问题修复完成

---

## Agent Workload Summary

| Agent | Batch 1 | Batch 2 | Batch 3 | Batch 4 | Batch 5 | Batch 6 | Total Tasks |
|-------|---------|---------|---------|---------|---------|---------|-------------|
| **E1 Security** | 7 tasks | — | — | — | — | — | **7** |
| **E2 Frontend Arch** | — | 8 tasks | — | 5 tasks | 4 tasks | 3 tasks | **20** |
| **E3 Backend** | 5 tasks | 4 tasks | 7 tasks | — | — | 6 tasks | **22** |
| **E4 Design System** | — | — | 5 tasks | 6 tasks | 4 tasks | 1 task | **16** |
| **E5 API Layer** | — | 4 tasks | 5 tasks | — | — | — | **9** |
| **E6 Polish** | — | — | — | 5 tasks | 5 tasks | 5 tasks | **15** |

---

## File Conflict Avoidance Matrix

每个 Batch 内的 Agent 不修改相同文件:

| Batch | E1/E2/E5 (前端) | E3 (后端) | E4 (CSS) | E6 (增强) |
|-------|----------------|-----------|----------|-----------|
| 1 | SmartBI views, Dashboard*.vue | Java, Python | — | — |
| 2 | AIQuery, trends, ExcelUpload | SmartBIController | — | — |
| 3 | api/smartbi.ts | SmartBIController, Services | style.css, `<style>` blocks | — |
| 4 | SmartBIAnalysis split | — | box-shadow, radius, colors | Production, Finance, Sales |
| 5 | KPICard, PeriodSelector, Charts | — | :focus-visible, console→ElMessage | ARIA, Dashboard refs |
| 6 | api modules, emoji | Python API, Controller split | ECharts theme | terminology, responsive |

**冲突风险**:
- `SmartBIAnalysis.vue` — 仅在 Batch 4 由 E2 独占修改 (拆分)
- `api/smartbi.ts` — Batch 2 (E5), Batch 3 (E5 split), 之后用 split 后的子模块
- `SmartBIController.java` — Batch 1+2 (E3), Batch 3 (E3), Batch 6 (E3 独占)
- `style.css` — 仅 E4 修改

---

## Verification Checkpoints

每个 Batch 完成后执行验证:

| Batch | 验证方式 |
|-------|---------|
| 1 | `npm run build` + 浏览器访问所有 SmartBI 页面确认无 mock data + Python 端口验证 |
| 2 | API 调用全部正常 (auth header 验证) + 页面切换无内存泄漏 (DevTools Memory) |
| 3 | api/smartbi.ts 拆分后 import 全部正确 + Java 端点性能测试 |
| 4 | SmartBIAnalysis 拆分后功能完整 + 颜色系统统一检查 |
| 5 | 共享组件工作正常 + 键盘导航测试 + 屏幕阅读器测试 |
| 6 | 全量回归测试 + 截图对比 (agent-browser 重新截图 vs Phase 0) |

---

## Expected Outcome

| Metric | Before | After (Target) |
|--------|--------|----------------|
| Overall Module Score | 42/100 | 75+/100 |
| Design System Score | 4/10 | 8/10 |
| Consistency Score | 4/10 | 8/10 |
| P0 Issues | 16 | 0 |
| P1 Issues | 28 | 0 |
| P2 Issues | 30 | 0 |
| P3 Issues | 15 | 0 |
| XSS Vulnerabilities | 6 | 0 |
| Unauthenticated Endpoints | 42+ | 0 |
| Memory Leaks | 3 | 0 |
| Unique Colors | 68 | <25 |
| `as any` Casts | 33 | 0 |
