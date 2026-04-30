# R76 — Dashboard Fakes Strip + Promise.allSettled Silent Failure Fix

**Date**: 2026-04-30
**Branch**: `e2e/v1-framework`
**Commits**: `448db1e5d` (initial fix) + `0eace5404` (R76-FIX-A reviewer feedback)
**Module focus** (per Rule 11 module-coverage): 经营驾驶舱 (`dashboard/`) + 系统管理 (partial via shared helpers) + 财务管理 (`finance/sku-margin`) + 行为校准 (`calibration/`).

---

## Why this round

Apr 15 customer report: 13 of 16 customer bugs landed in modules with `none` E2E coverage (SmartBI / 系统管理 / 日常管理 / 数据分析 / 经营驾驶舱). User explicitly excluded SmartBI and 数据分析 from R76, leaving **经营驾驶舱 (dashboard) as the highest-priority untouched module**.

Per `depth-first-e2e` Rule 11 (breadth — module coverage matrix), the previous 12 R-rounds went deep on sales / production / quality / finance core flows but never probed dashboard rendering. R76 starts that breadth coverage.

---

## Same-cause sweep (Rule 8)

### Pattern A: Fake business data via `Math.random()` in production frontend

`grep "Math\.random\(\)" web-admin/src` → 17 sites. Categorized:

**12 LEGITIMATE** (UUIDs, jitter, percentile, chart-color, etc):
- `DashboardBuilder.vue:152` — `card_${Math.random()}` UUID
- `DynamicChartRenderer.vue:1233` — pie-chart color picker
- `views/production/batches/list.vue:94` — random suffix in batch number
- `views/restaurant/components/AnalyticsStrip.vue:59` — uid
- `views/smart-bi/composables/useBookmarks.ts:40` — bookmark id
- `views/smart-bi/AIQuery.vue:132,143` — uuid
- `views/smart-bi/FinanceAnalysis.vue:531`, `SalesAnalysis.vue:549` — chart-type rotation on user refresh (UX feature, not data)
- `views/smart-bi/DataCompletenessView.vue:400` — rule_id
- `DynamicChartRenderer:1124-1126` / `SmartBIAnalysis:1953-1954` / etc — percentile calc using `Math.floor(arr.length * 0.X)` (NOT random, NOT fake)

**4 FAKE business data — fixed in R76**:
- `DashboardHR.vue:97-101` — `todayAttendance = activeEmployees * 0.92`
- `DashboardWarehouse.vue:88-91` — `lowStockItems / todayInbound / todayOutbound = Math.random() * X`
- `finance/sku-margin/index.vue:280-286` — material/labor cost + selling price + margin all random
- `calibration/CalibrationDetailView.vue:329` — 7-day trend `75 + Math.random() * 20`

### Pattern B: `Promise.allSettled` silent failure swallow

`grep "Promise\.allSettled" web-admin/src` → 16 files. Of these, dashboard-scope:
- `DashboardAdmin.vue` — 4 legs, all swallowed silently — **FIXED**
- `DashboardProduction.vue` — 2 legs — **FIXED**
- `DashboardHR.vue` — 2 legs — **FIXED**
- `DashboardWarehouse.vue` — 2 legs — **FIXED** (also wired real `/inventory/alerts`)

Out of R76 scope (per user exclusion or non-dashboard):
- `views/smart-bi/*` — SmartBI module excluded
- `views/analytics/*` — 数据分析 excluded
- `views/restaurant/admin/etl-status.vue`, `views/quality/standards/list.vue`, `views/production/batches/detail.vue`, `views/finance/costs/index.vue`, `api/request.ts` — different surfaces; documented for R77+ if same anti-pattern.

### Pattern C: `return ApiResponse.error(...)` from controller catch (HTTP 200 + success:false)

`grep "return ApiResponse\.error\(" backend/...controller` → **212 occurrences across 36 controllers**.

This is the **R23 BUG-17 / R29 BUG-26 / R67-R75 systemic anti-pattern**. R67-R75 fixed a subset (finance/material/shipment user-facing flows). R76 fixes the dashboard subset:

**Fixed in R76**:
- `ProductionProgressDashboardController:185` — B8 大屏 catch return → throw BusinessException
- `BehaviorCalibrationController.getDashboard:89` — calibration dashboard catch return → throw BusinessException (caught by reviewer in same-cause sweep, was missed in initial commit)

**Defer to R77+** (not in dashboard scope — large multi-round project):
- `AIRuleController` (12 sites)
- `BehaviorCalibrationController` other 9 sites (non-dashboard)
- `DahuaDeviceController` (30 sites)
- `DeviceController` (12 sites)
- `EquipmentController` (4 sites — validation paths, lower risk)
- `FileUploadController` (15 sites)
- `IsapiDeviceController` (18 sites)
- `RuleController` (15 sites)
- `TemplatePackageController` (23 sites)
- ...total 211 sites in 35 controllers

---

## Bugs fixed (Rule 1: depth label per fix)

| ID | File:line | Pattern | Fix | Depth |
|----|-----------|---------|-----|-------|
| BUG-31 (P0) | DashboardHR.vue:97-101 | `* 0.92` 写死出勤 | null + `<el-tag>数据待接入</el-tag>` + 后端 `/timeclock/admin/statistics` 待 wire | deep |
| BUG-32 (P0) | DashboardWarehouse.vue:88-91 | `Math.random()` KPI | wire `/material-batches/inventory/alerts` (LOW_STOCK+EXPIRING+EXPIRED 3 类) → `inventoryAlerts` 重命名; inbound/outbound null + tag | deep |
| BUG-33 (P0) | finance/sku-margin/index.vue:280-286 | random 假成本/售价/毛利率 | strip + `noCostDataNotice` banner; KPI Row + chart + table 在 banner 显示时隐藏 (R76-FIX-A) | deep |
| BUG-34 (P1) | calibration/CalibrationDetailView.vue:319-393 | random 7-day 趋势 | empty state "趋势数据待接入" | medium |
| BUG-35 (P1) | DashboardAdmin.vue:107-130 | Promise.allSettled 静默吞 4 leg | `failed[]` array + ElMessage.warning/error + console.error | medium |
| BUG-36 (P1) | DashboardProduction.vue:75-90 | 同上 (2 leg) | 同上模式 | medium |
| BUG-37 (P1) | DashboardHR.vue:loadHRData | 同上 (2 leg) | 同上模式 | medium |
| BUG-38 (P1) | DashboardAdmin.vue:76-78 | `as any` 3-level fallback chain | 升级 `DashboardOverview` 类型加 optional `summary?.activeAlerts` + `alerts?.active` | medium |
| BUG-39 (P1) | ProductionProgressDashboardController.java:185-188 | catch return ApiResponse.error → 200 + success:false | throw BusinessException(500, ..., e) | deep |
| BUG-40 (P1) | BehaviorCalibrationController.java:84-90 | 同 BUG-39 (R76-FIX-A reviewer caught) | throw BusinessException | deep |

**10 bugs fixed total** (4 P0 + 6 P1).

---

## Reviewer findings (Rule 9 — independent agent `af3b24a35a5a95000`)

Verdict: **FIX BEFORE PROD** → all 4 issues addressed in `0eace5404` (R76-FIX-A):

1. ✅ DashboardHR template arithmetic null-safety: `activeEmployees - (todayAttendance ?? 0)` for tsc strict mode.
2. ✅ DashboardAdmin typed fallback chain — verified compiles + matches runtime.
3. ✅ sku-margin KPI Row 0% red badge would have defeated the fix purpose — wrapped KPI Row + chart + table in `v-if="!noCostDataNotice.show"`.
4. ✅ FinanceAnalysis/SalesAnalysis randomType — confirmed legitimate (chart UX rotation), not fake data.
5. ✅ BehaviorCalibrationController.getDashboard same-cause miss — fixed.
6. ✅ Warehouse `lowStockItems` semantic mislabel — renamed to `inventoryAlerts` (3 alert types are legit "库存预警" per backend description).
7. ✅ Most damaging surviving same-pattern bug: BehaviorCalibrationController.getDashboard — covered by #5.

---

## Module coverage matrix (Rule 11)

| Module | Pre-R76 | Post-R76 | Notes |
|--------|---------|----------|-------|
| dashboard (经营驾驶舱) | none | **deep** | 4/7 components touched (Admin/Production/Warehouse/HR); Default/Restaurant/B8-progress already clean (verified). |
| finance/sku-margin | none | **deep** | Math.random fake stripped + banner |
| calibration | none | **medium** | Trend chart fake stripped (single fix, no E2E flow) |
| system/* | none | none | Defer next round (R77 — 19 pages including ai-quota / approval-chains / users / roles / logs / pos / etc) |
| equipment / quality / procurement / transfer / scheduling | partial (R67-R75) | partial | No new R76 work |
| restaurant | partial (Apr 28) | partial | No new R76 work |
| smart-bi / analytics | excluded | excluded | Per user request |

---

## R77+ backlog

**Scoped follow-up (estimated 1-2 chats each)**:
1. R77 — System management (`system/*` 19 pages): users / roles / logs / encoding-rules / approval-chains / ai-quota / pos / work-processes / product-processes / workflow-designer / data-fabric / ai-intents / skill-tools / llm-usage / settings / role-permissions / features / smartbi-config / badge-generator. Likely many `as any` + Promise.allSettled + ApiResponse.error misses given untouched status.
2. R78 — Daily management (calibration full / scheduling / alerts queues — touched in R67-R75 but not full E2E coverage).

**Systemic backlog (multi-round)**:
3. **211-site `ApiResponse.error` sweep** across 35 controllers — biggest known anti-pattern remaining. Should be split across 5-6 rounds by controller bundle (e.g. R77 takes Equipment + Device + Isapi cluster, R78 takes Rule + AIRule + FormAssistant cluster, etc).

---

## Prod ship plan (Rule 10)

1. ✅ Test deploy: `./scripts/deploy/deploy-backend.sh --env test` + `./scripts/deploy/deploy-web-admin.sh --env test`
2. ⏳ Real-window verify on 8097 (6 dashboard role combinations + sku-margin + calibration trend)
3. ⏳ Prod deploy: backend Blue-Green + web-admin atomic swap
4. ⏳ Push origin/e2e/v1-framework + memory update + audit doc commit

---

## Files touched

### Backend (2 controllers)
- `backend/java/cretas-api/src/main/java/com/cretas/aims/controller/ProductionProgressDashboardController.java`
- `backend/java/cretas-api/src/main/java/com/cretas/aims/controller/BehaviorCalibrationController.java`

### Frontend (6 files)
- `web-admin/src/components/dashboard/DashboardAdmin.vue`
- `web-admin/src/components/dashboard/DashboardHR.vue`
- `web-admin/src/components/dashboard/DashboardProduction.vue`
- `web-admin/src/components/dashboard/DashboardWarehouse.vue`
- `web-admin/src/types/api.ts`
- `web-admin/src/views/calibration/CalibrationDetailView.vue`
- `web-admin/src/views/finance/sku-margin/index.vue`

### LOC: 8 files / +302 / -190 (across 2 commits)
