# RN App QA Findings — Iterations 25-29

## Iteration 25 — Quality Inspector (quality_insp1)
**Dimension**: Quality inspection workflow + profile data integrity

| # | Severity | Screen | Issue |
|---|----------|--------|-------|
| 221 | P1 | QIAnalysisScreen:91-100 | `isValidAnalysisData()` fails — API `/reports/dashboard/quality` returns unexpected shape, shows "数据格式异常" |
| 222 | P2 | QIProfileScreen:52-56 | Today stats entirely hardcoded (inspected:12, passed:11, workHours:7.5), no API call or useEffect |
| 223 | P3 | QIProfileScreen:89 | Notification badge hardcoded to 3, not synced with actual unread count |

## Iteration 26 — Warehouse (warehouse_mgr1)
**Dimension**: Cross-tab data consistency + inventory alerts

| # | Severity | Screen | Issue |
|---|----------|--------|-------|
| 224 | P1 | WHHomeScreen:225 | `pendingOutbound` maps from `activeBatches` (wrong field!) — Home shows "待出货 5 单" but Outbound shows "待打包(8)" |
| 225 | P1 | WHHomeScreen:226 | `alertCount` uses system-wide `activeAlerts` (1241) vs inventory-specific `expiringBatchesCount` (0) — massive discrepancy |
| 226 | P2 | WHInventoryListScreen:242 | Inventory warningCount uses different data source than Home alertCount — no single source of truth |

## Iteration 27 — HR (hr_admin1)
**Dimension**: Employee data consistency across tabs

| # | Severity | Screen | Issue |
|---|----------|--------|-------|
| 227 | P2 | HRHomeScreen vs HRProfileScreen | Employee count mismatch: Home "总员工 31" vs Profile "在职员工 45" — different API endpoints return different counts |

## Iteration 28 — Dispatcher (dispatcher1)
**Dimension**: Tab navigation + data source audit + hardcoded data detection

| # | Severity | Screen | Issue |
|---|----------|--------|-------|
| 228 | P1 | DispatcherTabNavigator | **Tab navigator completely broken on web**: all tab clicks stuck on PlanTab (`[active] [selected]`), AI调度/智能分析/人员/我的 tabs don't navigate. All tab content rendered simultaneously in DOM. React Navigation bottom tabs issue on web platform. |
| 229 | P1 | DSProfileScreen:243-245 | **Entire profile screen hardcoded**: `profile` (赵调度/099), `todayStats` (8/5/3/12), `performanceMetrics` (87%/94%/90%/15min) — NO API calls, no useEffect. Even `onRefresh` is `setTimeout(1000)` with TODO comment. Profile name "赵调度" doesn't match logged-in user "dispatcher1". |
| 230 | P2 | DSHomeScreen:221 | "优化空间 +12%" hardcoded string, not from API `dashboard.aiInsights` |
| 231 | P2 | DSHomeScreen:78,81 | Workshop utilization (0.8) and efficiency (0.85) hardcoded for active lines, not from real production data |
| 232 | P2 | DSHomeScreen:217,243 | `delayedPlans` field reused for both "待排产批次" and "低于70%概率批次" — different semantic meanings, same data source |
| 233 | P2 | PersonnelListScreen:228-229 | Initial state uses `fallbackStats` (30 total, 24 working) and `fallbackPersonnel` (7 hardcoded records) before API loads; if API fails, hardcoded data persists silently |

## Iteration 29 — Factory Admin (factory_admin1)
**Dimension**: Data source audit + cross-screen comparison with other roles

| # | Severity | Screen | Issue |
|---|----------|--------|-------|
| 234 | P2 | EnhancedLoginScreen:337,101 | **Landing view "登录" button unresponsive via Playwright**: TouchableOpacity `onPress` handler not triggered by any click method (standard click, force click, pointer events, mouse click). React Native Web Pressability event system incompatible with automated testing. Affects all RN Web button interactions. |
| 235 | P1 | DispatcherTabNavigator (updated) | **Tab nav bug reproduced after fresh page reload**: NOT state corruption — tabs are permanently broken for dispatcher role on web. Even 首页→计划 doesn't work after clean reload. Upgraded from P2 to P1. |

**Positive findings (no issues)**:
- `TodayProductionScreen.tsx`: Real API (`dashboardAPI.getProductionStatistics`), proper error handling, i18n — CLEAN
- `AIAlertsScreen.tsx`: Real API (`dashboardAPI.getAlertsDashboard`), severity/type mapping, i18n — CLEAN
- `PersonalInfoScreen.tsx`: Real API (`userApiClient.getUserById`) with auth store fallback, edit+save — CLEAN
- `SchemaConfigScreen.tsx`: Real API (`formTemplateApiClient`, `formAssistantApiClient`), AI-powered schema gen — CLEAN
- `QuickStatsPanel.tsx`: Real API, supports multiple response formats, `setStatsData(null)` on error (no fake data), retry UI — EXEMPLARY

**Cross-role comparison**:
| Screen Type | Factory Admin | Warehouse | HR | QI | Dispatcher |
|-------------|--------------|-----------|-----|-----|------------|
| Home stats | Real API | Real API | Real API | Real API | Real API (partial hardcode) |
| Profile stats | Real API | Real API | Mixed | Hardcoded (P2) | **Hardcoded (P1)** |
| Detail screens | Real API | Real API | Real API | Mixed | Real API |
| Tab navigation | Works | Works | Works | Works | **Broken (P1)** |

## Summary
- **Iterations**: 25-29 (QI → Warehouse → HR → Dispatcher → Factory Admin)
- **New issues**: 15 (4xP1, 9xP2, 2xP3)
- **Cumulative**: 235 issues (3xP0, 61xP1, 125xP2, 46xP3)
- **Critical patterns**:
  1. DSProfileScreen is the 3rd role profile screen found with fully hardcoded data (QI, Dispatcher confirmed; Warehouse+FA use real API)
  2. Dispatcher tab navigator completely broken on web — unique to this role
  3. React Native Web TouchableOpacity event handling incompatible with Playwright automated testing (affects all roles' button clicks)
  4. Factory admin screens are exemplary — proper API integration, error handling, no fake data
