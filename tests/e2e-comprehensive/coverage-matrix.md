# E2E Coverage Matrix — Factory FOOD_3101_048

**Purpose**: Rule 11.1 — inventory of every major user-facing module with current E2E coverage depth.

**Last updated**: 2026-04-15 after R18 breadth round.

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

---

## Exemptions (Rule 11.3)

- **Mobile-only modules**: `field-worker/*`, `mobile-auth/*` — these are for the RN app, not web-admin.
- **Restaurant module for FACTORY-type factory**: `/restaurant/*` routes are intentionally blocked for FACTORY factories (FOOD_3101_048 is FACTORY). The REPRO on recipes/stocktaking is a UX issue (menu shouldn't show those), not a functional bug. Scope: move these to exempted, but file a UX ticket.

---

## Never-touched (still at `none` after R18)

Spot-check inventory — find other app modules not yet listed:
- `hr/*` (员工/角色/部门 besides /system/roles)
- `quality/*` (质检/异常)
- `production/*` (生产计划/工单/报工)
- `inventory/*` (库存管理/批次)
- `equipment/*` (设备/维护)

**Rule 11.4 consequence**: these modules at `none` for 12+ rounds. R19 MUST cover them at smoke minimum unless each gets an exemption.

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

## Next round recommendations

**R19 options**:
1. **Action-level repro** for the 10 NOT_REPRO bugs — click each action button, capture result. Convert smoke to medium for each.
2. **Fix the 3 REPROs** — canvas-editor route guard (real bug), + UX menu hiding for restaurant modules.
3. **Cover never-touched modules** (hr, quality, production, inventory, equipment) at smoke minimum per Rule 11.4.

Priority: #2 (real bug fixes) + #3 (breadth completeness) > #1 (deeper investigation can happen after).
