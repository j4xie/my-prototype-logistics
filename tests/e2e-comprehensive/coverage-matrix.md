# E2E Coverage Matrix — Factory FOOD_3101_048

**Purpose**: Rule 11.1 — inventory of every major user-facing module with current E2E coverage depth.

**Last updated**: 2026-04-16 after R21 live devtools sweep (60 routes with real browser + network assertions).

---

## Coverage taxonomy

- `none` — no E2E test ever ran against this module
- `smoke` — page load + render check (happy-path only, no actions)
- `medium` — form submit + API 200 captured (but no detail page verification)
- `deep` — form submit + toast + list delta + detail field readback

---

## Current matrix

| Module | Path | Depth | Last touched | Notes |
|---|---|---|---|---|
| sales/customers | `/sales/customers` | deep | R8, R9, R14, R15, R16, R17 | CRUD + validation (R6 rating bug) |
| sales/orders | `/sales/orders` | deep | R8-R17 | Full state machine (DRAFT→CONFIRMED→FINANCE_APPROVED/REJECTED/CANCELLED) |
| sales/deliveries | `/sales/deliveries` | deep | R15, R16, R17 | 3-stage: create → ship → delivered. FG batch allocation. |
| sales/shipments | `/sales/shipments` | **smoke** (R18) | R18 | Page loads, menu+table rendered. Bug #5 (新建出货无反应) needs button click test. |
| purchase/orders | `/procurement/orders` | medium | R10 | Create flow, no detail readback |
| finance/invoices | `/finance/invoices` | medium | R11 | Via SO, no dedicated page test |
| finance/payments | `/finance/payments` | medium | R11 | Via SO, no dedicated page test |
| system/canvas-editor | `/canvas-editor` | **REPRO 403** | R18 | Bug #1 CONFIRMED: factory_super_admin redirects to `/403`. Router guard or backend RBAC gap. |
| system/roles | `/system/roles` | smoke (R18) | R18 | Page loads for admin. Bug #6 (查看权限 404) needs click test. |
| system/workflow-designer | `/system/workflow-designer` | smoke (R18) | R18 | Page loads for admin. Bug #7 (404) not reproduced via URL alone. |
| system/features | `/system/features` | smoke (R18) | R18 | Page loads. Bug #8 (手动同步失败) needs action test. |
| smart-bi/financial-dashboard | `/smart-bi/financial-dashboard` | smoke (R18) | R18 | Page loads for admin. Bug #2 (canceled) not reproduced at idle. |
| smart-bi/upload | `/smart-bi/upload` | smoke (R18) | R18 | Page loads. Bug #3 (经营驾驶舱-数据源上传失败) needs actual upload. |
| smart-bi/finance | `/smart-bi/finance` | smoke (R18) | R18 | Page loads. Bug #12 (演示数据) needs action. |
| smart-bi/analysis | `/smart-bi/analysis` | **TIMEOUT** | R18 | Page didn't reach networkidle in 45s — possible perf bug (#13 导出报表). |
| smart-bi/query | `/smart-bi/query` | smoke (R18) | R18 | AI问答 page loads. Bug #14 (超时) needs actual AI request. |
| smart-bi/query-templates | `/smart-bi/query-templates` | smoke (R18) | R18 | Page loads with table. Bug #15 (一键执行 loading) needs trigger. |
| analytics/alert-dashboard | `/analytics/alert-dashboard` | smoke (R18) | R18 | Page loads. Bug #9 (解决缺参数) needs click. |
| restaurant/recipes | `/restaurant/recipes` | **REPRO 403** | R18 | Bug #10 CONFIRMED partially: factory_super_admin → /403. Factory is FACTORY type, not RESTAURANT — likely route guard correctly blocks. User's error may indicate UX issue (menu should hide). |
| restaurant/stocktaking | `/restaurant/stocktaking` | **REPRO 403** | R18 | Same as recipes — factory type mismatch → 403. |
| sales/orders (role=sales_mgr) | `/sales/orders` | inconclusive | R18 | sales_mgr account loaded page but no 新建 button found. Either role missing write permission OR page failed to fully render. Bug #4 needs deeper investigation. |
| hr/employees | `/hr/employees` | smoke (R19) | R19 | Page loads, menu+table rendered, 0 network errors, title "员工管理". |
| hr/departments | `/hr/departments` | smoke (R19) | R19 | Page loads, menu+table rendered, 0 network errors, title "部门管理". |
| hr/attendance | `/hr/attendance` | smoke (R19) | R19 | Page loads, menu+table rendered, 0 network errors, title "考勤管理". |
| quality/inspections | `/quality/inspections` | smoke (R19) | R19 | Page loads, menu+table rendered, 0 network errors, title "质检记录". |
| quality/disposals | `/quality/disposals` | smoke (R19) | R19 | Page loads, menu+table rendered, 0 network errors, title "废弃处理". |
| quality/standards | `/quality/standards` | smoke (R19) | R19 | Page loads, menu+table rendered, 0 network errors, title "质检标准". |
| production/batches | `/production/batches` | **TIMEOUT** | R19 | Page didn't reach networkidle in 45s — matches R18 smart-bi/analysis symptom. Possible perf bug (long-polling request or slow API) OR legitimately heavy list. Needs `domcontentloaded` retry or deeper investigation. |
| production/plans | `/production/plans` | smoke (R19) | R19 | Page loads, menu+table rendered, 0 network errors, title "生产计划". |
| production/bom | `/production/bom` | smoke (R19) | R19 | Page loads, menu+table rendered, 0 network errors, title "BOM配方管理". |
| warehouse/materials | `/warehouse/materials` | smoke (R19) | R19 | Page loads, menu+table rendered, 0 network errors, title "原材料批次". (distinct from sales/deliveries which is FG shipment) |
| warehouse/inventory | `/warehouse/inventory` | smoke (R19) | R19 | Page loads, menu+table rendered, 0 network errors, title "盘点管理" (raw-mat stocktaking). |
| warehouse/shipments | `/warehouse/shipments` | smoke (R19) | R19 | Page loads, menu+table rendered, 0 network errors, title "出货管理". (NOT the same as sales/shipments — this is warehouse-side outbound record) |
| equipment/list | `/equipment/list` | smoke (R19) | R19 | Page loads, menu+table rendered, 0 network errors, title "设备列表". |
| equipment/maintenance | `/equipment/maintenance` | smoke (R19) | R19 | Page loads, menu+table rendered, 0 network errors, title "维护记录". |
| equipment/alerts | `/equipment/alerts` | smoke (R19) | R19 | Page loads, menu+table rendered, 0 network errors, title "告警管理". |

---

## Exemptions (Rule 11.3)

- **Mobile-only modules**: `field-worker/*`, `mobile-auth/*` — these are for the RN app, not web-admin.
- **Restaurant module for FACTORY-type factory**: `/restaurant/*` routes are intentionally blocked for FACTORY factories (FOOD_3101_048 is FACTORY). The REPRO on recipes/stocktaking is a UX issue (menu shouldn't show those), not a functional bug. Scope: move these to exempted, but file a UX ticket.

---

## Never-touched (still at `none` after R19)

R19 cleared 5 module groups (hr, quality, production, warehouse/inventory, equipment). Remaining `none` candidates that may deserve an R20+ smoke pass:
- `procurement/*` subpages not yet on matrix (only /procurement/orders at medium via R10)
- `analytics/*` beyond alert-dashboard (overview, trends, ai-reports, kpi, production-report, supply-chain)
- `scheduling/*` (overview, plans, realtime, workers, alerts) — entire module at none
- `finance/*` beyond invoices/payments (costs, reports, ar-ap, sku-margin)
- `system/*` beyond R18 trio (users, logs, settings, ai-intents, skill-tools, products, pos, work-processes, product-processes, smartbi-config, badge-generator)
- `rd/*` (samples, converted)
- `calibration/*`
- `transfer/*`
- `production-analytics/*`

**Rule 11.4 status**: R19 covered the 5 modules Rule 11.4 explicitly called out (hr/quality/production/inventory/equipment). The above buckets have not yet hit the 3-consecutive-rounds-at-none threshold to force another breadth round, but are candidates for future planning.

---

## R18 verdict

**3 bugs REPRODUCED** (all route-permission issues):
1. Bug #1: canvas-editor 403 for factory_super_admin — **real bug, admin should access**
2. Bug #10: recipes 403 — **UX issue** (menu visibility for non-restaurant factory)
3. Bug #11: stocktaking 403 — same as #10

**10 bugs NOT REPRODUCED at smoke level** — need button-click level testing (R19 or later). Pages load, bug triggers on user action.

**2 bugs TIMEOUT** — smart-bi/analysis didn't reach networkidle. Either real perf bug or data-dependent (factory has no data → chart components spin forever).

**1 bug inconclusive** — #4 role permission with sales_mgr. Need deeper role-testing.

---

## R19 verdict

**Route option chosen**: #3 (cover 5 never-touched modules per Rule 11.4) — completed.

**Script**: `tests/e2e-comprehensive/e2e-R19-breadth-5modules.mjs`
**Result**: `tests/e2e-comprehensive/results/e2e-R19-breadth-5modules.json`

**15 probes across 5 modules (hr/quality/production/warehouse/equipment)**:
- **14 PASS** ✓ — pages render cleanly, menu+table present, zero network errors, zero console errors
- **1 FAIL** ✗ — `/production/batches` timed out on `networkidle` after 45s (same symptom class as R18 smart-bi/analysis; candidate for perf investigation — either slow API, pending request, or long-polling keeps connection open forever)
- **0 REPRO** 🐛 — no 403/404 redirects and no forbidden banners on any route
- **0 WARN** ⚠ — no partial renders

**No surprise bugs found at smoke level.** All 14 rendering routes returned 0 HTTP errors and 0 console errors under factory_super_admin, which is consistent with their permission matrix having `rw` across every module for this role.

**Confirmed negative findings (not bugs, but useful)**:
- `/hr/*` renders without issue for factory_super_admin — no 403 gate surprise, unlike `/canvas-editor` which was platform_admin-only
- `/warehouse/*` renders for factory_super_admin (warehouse module is `rw` for this role)
- `/equipment/*` renders for factory_super_admin (equipment module is `rw`)

**Production/batches timeout — action for R20**: retry with `waitUntil: 'domcontentloaded'` + manual poll for menu, OR investigate backend `/api/mobile/FOOD_3101_048/production/batches` API response time. Matches pattern of R18 bug 2/13 (smart-bi perf timeouts).

---

## R21 DEEP extension (2026-04-16, after user requested smoke→deep upgrade)

T3 upgraded from smoke-level to **deep** (Rule 1 full criteria: fill + submit + toast + list delta + detail readback):

- **15 FULL DEEP PASS** — including 3 cross-module dropdown-consume verifications (customer→SO, product→SO, supplier→materials inbound)
- **R21-F5 NEW P1 BUG FOUND**: `POST /api/mobile/{factoryId}/whitelist` returns **405 Method Not Allowed**. Backend WhitelistController missing @PostMapping. Entire 白名单 create flow broken. Only caught because T3 upgrade actually submits the form.
- **Bug #5 E2E verified**: T3-DEEP #10 shipments fill+submit+toast+list+1, NOT just dialog-opens. SH-FOOD_3101_048-20260416-003A4A created with T3 DEEP customer + product.
- 1 BLOCKED-DEP (QI needs 待检批次 seed), 3 DEFERRED (invoices/PO/standards — time budget).

**Coverage matrix deltas**: 14 modules upgraded to `deep` (sales/customers/suppliers/departments/users/products/work-processes/plans/sales-orders/sales-shipments/employees/pos/rd-samples/materials).

---

## R21 verdict (live devtools sweep, 2026-04-16)

**Full results**: [`results/e2e-R21-devtools-sweep.md`](results/e2e-R21-devtools-sweep.md)

## R22 + R23 verdict (deep live testing + 7 bugs, 2026-04-16)

**Full results**: [`results/e2e-R22-p0-gaps-closed.md`](results/e2e-R22-p0-gaps-closed.md) + [`results/e2e-R23-deep-live.md`](results/e2e-R23-deep-live.md)

**Business flows E2E verified for first time**:
- G1 税率分组开票 (killer demo from Apr 7 meeting) — INV-20260416-0006 ¥1,110 two-rate split
- PO full 6-stage — create→submit→approve→finance→receive→auto-batch (MT-20260416-3073)
- Plan → 转为批次 — PB-PLAN-...-38821 created, plan 进行中
- Shipment full 3-stage — pending→shipped→delivered via UI
- SO 驳回→重新提交 loop — SO-20260415-0008 循环通过
- RBAC 4-role spot check — factory_admin / sales_mgr / viewer / warehouse_mgr

**Bugs caught & fixed in-round**:
- R21-F3/F4/F5 (R22 closed): settings 404 / smartbi HTML-as-JSON / whitelist 405
- R23-F1: /warehouse/shipments pagination 0-vs-1-indexed mismatch
- R23-F2: SO resubmit URL typo (/submit-for-review, not /submit-for-finance-review)
- R23-F3: DB validation rule FINANCE_CONFIRM_ONLY too strict
- R23-F4: Shipment status case mismatch (DELIVERED vs delivered)
- R23-F5: F1 over-correction (2 files defaulted page:0 not page:1, -1 broke them)

**Coverage matrix deltas (R22 + R23)**:
| Module | Before R22 | After R23 |
|---|---|---|
| /sales/orders + 税率分组开票 | deep create-only | **deep full loop + G1 killer demo** |
| /sales/orders 驳回重提 loop | N/A | **deep** (F2+F3 fix verified) |
| /procurement/orders 6-stage | deep create smoke | **deep 6-stage chain** |
| /warehouse/materials | deep | **deep + auto-gen from PO receive** |
| /warehouse/shipments | smoke + broken | **deep + F1/F4 fixed** |
| /production/plans 转批次 | medium | **deep (plan → batch chain)** |
| /production/batches | smoke | **deep (list delta from plan)** |
| /system/settings | smoke-issue | **smoke-OK** (F3 fixed) |
| /system/smartbi-config | smoke-issue | **smoke-OK** (F4 fixed) |
| /hr/whitelist | BLOCKED | **medium+ POST** (F5 fixed) |
| /finance/invoices | medium | medium (F5 revert verified) |
| RBAC 4 roles | R19 implicit | **explicit spot check** (menu/button/403 guard/price hiding) |
| Error paths (7 types) | N/A | **comprehensive — 6 PASS + 1 latent** |

**R23 completion status**: all planned deep L4 tests (T4/T5/T6/T7) executed and passed. Zero "next round" deferrals for core business flows. Latent items scheduled to R24 with concrete test design.

---



**60 routes visited** via MCP playwright-test real Chromium + console/network monitoring under `e2e_factory_admin`:

- **58 PASS** — 0 console errors, 0 4xx/5xx, page content rendered
- **2 issue routes** (new R21 findings):
  - **R21-F3**: `/system/settings` — `GET /api/mobile/FOOD_3101_048/settings` + `/settings/full` both 404. Page renders default values silently (silent degradation). P2.
  - **R21-F4**: `/system/smartbi-config` — 阈值配置加载失败, `GET /api/admin/smartbi-config/thresholds` returns HTML (Vite SPA fallback). R20-F2 defensive axios correctly rejects. Same root as R20-F2: nginx at 139 only proxies `/api/mobile/*`, not `/api/admin/*`. P2.

**R20 fixes confirmed live in prod**:
- R20-F1 canvas-editor 4 real templates load (no F001 hardcode) ✅
- R20-F2 workflow-designer 10 real state-machine nodes render (not 766 empty 📦 tiles) ✅
- R20-F2 axios HTML guard is actively doing its job — caught R21-F4 at the interceptor layer

**Coverage deltas**:
- 32 modules still at smoke — but now with devtools-level assertion (not just page-load + title). This is above script-automation smoke.
- `/system/settings` and `/system/smartbi-config`: moved from `smoke` to `smoke-issue`.

## Next round recommendations

**R22 candidates**:
1. Fix R21-F3 (`/system/settings` missing backend controller or 404-mapped URL)
2. Fix R21-F4 (same fix pattern as R20-F2: backend move OR nginx `/api/admin/*` location)
3. T3-T5 from R21-PLAN (L2 CRUD smoke / L3 cross-module / L4 SO full 3-stage on real browser)
4. T4.5 from R21-PLAN (16 customer bug live re-verify with actual action clicks)

**R20 options** (historical):

1. Switch R18's 10 NOT_REPRO bugs and R19's 14 PASS routes to **medium** coverage (click primary action button, capture response). This gets us real form-submit evidence across 24 modules.
2. Investigate the `/production/batches` timeout (R19 FAIL) + `/smart-bi/analysis` timeout (R18 TIMEOUT) — same symptom class, likely same root cause (backend slow/hung API or long-polling).
3. Fix the 3 REPROs from R18 (canvas-editor RBAC + restaurant menu UX).
4. Role-coverage sweep: repeat R19's 15 routes with 3-5 other roles (hr_admin, quality_mgr, warehouse_mgr, equipment_admin, viewer) to verify permission matrix rows enforce correctly.

Priority: #3 (fix real bugs) > #2 (diagnose perf timeouts — these may be the same root) > #1 or #4 (coverage deepening).
