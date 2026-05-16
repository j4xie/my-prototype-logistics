# Sprint 2 prod E2E v2 — Detailed UI/button verification

**Tester**: organizer-dispatched smoke chat v2 (Claude Opus 4.7)
**Date**: 2026-05-16 13:36–13:47 CST
**Env**: prod `https://admin.cretaceousfuture.com`
**Web-admin deployment**: Last-Modified `Sat, 16 May 2026 05:29:26 GMT` ✓ post Sprint 2 FU
**Backend**: api.cretaceousfuture.com (via nginx → java/python)
**Method**: Playwright MCP browser + direct API probes via `localStorage['cretas_access_token']`

---

## Executive summary

| Section | Result |
|---|---|
| Login (5 roles) | ✅ All 5 F006 accounts logged in (password 123456) |
| Sprint 1 K2/K5 RBAC | ✅ Holding — warehouse_mgr correctly 403 on `/price-comparison`, finance menu hidden, price columns mask |
| Sprint 2 G — UX-A1 WorkflowBar | ⚠️ Sales + production work; **procurement endpoint 404** |
| Sprint 2 H — UX-A2 RowActionMenu | ⚠️ Hybrid inline + 更多 (not pure dropdown); 财务已批准 rows missing print action |
| Sprint 2 I — UX-A3 StickyFooter | ❌ Renders "暂无数据" + AI button even when list has 5 rows ¥6M+ |
| Sprint 2 J — P-FIN-1 财审 | ❌❌ **Multiple P0**: no menu entry, finance_mgr 403, wrong URL in spec, **zero data in PENDING_FINANCE_REVIEW** |
| Sprint 2 H FU — Print PDF | ❌ **P0**: Backend service returns 502 for every print/* call |
| Sprint 2 E — N31 缺料分析 | ✅ Endpoint `/sales/orders/{id}/shortage-report` returns 200 ("缺料分析尚未生成" — listener not exercised) |
| Sprint 2 F — N48 研发样品 | ✅ Endpoint `/rd/samples` returns 200 (empty for F006) |
| Cross-factory RBAC | ✅ JWT factory binding enforced |

**24 PRs verify scoreboard**: ~10 PASS / ~8 PARTIAL / ~6 FAIL (see per-bug detail below).
**Verdict**: **C — has multiple P0 bugs, NOT customer-demoable as-is.**

---

## Tier A — 5-role matrix

### A.1 f006_admin (factory_super_admin) — baseline

| Check | Result | Evidence |
|---|---|---|
| Login + dashboard | ✅ | `admin-1-dashboard-full.png`, JWT issued, factoryId=F006 |
| Sidebar top-level menus | ✅ 13 items | 首页/生产/仓储/质量/采购/销售/人事/设备/财务/系统/经营报表/智能调度/智能分析 |
| 财务管理 submenu | ⚠️ 7 items but **no 财审入口** | 财务概览/财务报表/应收应付/开票管理/收款管理/调整审批/SKU毛利率分析 |
| 采购管理 submenu | ⚠️ 4 items but **no 财审入口** | 采购订单/采购入库/供应商管理/价格表管理 |
| `/procurement/finance-review` (no /list) | ✅ Loads 财务待审采购单 list page | `finance-review-list-correct-url.png` |
| `/procurement/finance-review/list` | ❌ Bug #1 — loads detail page, "采购订单不存在" | `bug-1-finance-review-list-missing.png` |
| Top-bar user menu | ✅ | f006_admin / 工厂总监 + 退出登录 |

### A.2 f006_finance_mgr (finance_manager) — Sprint 2 J target user

| Check | Result | Evidence |
|---|---|---|
| Login | ✅ | `finance-mgr-1-dashboard.png` |
| Sidebar items | 9 only | 经营驾驶舱/财务 PBI 看板/财务分析/销售分析/AI问答/查询模板管理/智能数据分析/开票审核/收款管理 |
| **财务审核 menu entry** | ❌ **Bug #2 P0** — completely absent. Feature undiscoverable. | — |
| `/procurement/finance-review` direct nav | ❌ **Bug #10 P0** — redirects to /403 无权限 | `bug-10-finance-mgr-403.png` |
| Backend `/api/.../purchase/orders/by-status?status=PENDING_FINANCE_REVIEW` | ✅ 200 (empty) | Backend allows finance_manager; frontend route guard blocks |
| Backend `/api/mobile/auth/me` | ✅ `roleCode: "finance_manager"` | Real account, real role |
| Approve/reject flow | ❌ Cannot test — role 403'd + 0 data |

### A.3 f006_warehouse_mgr (warehouse_manager) — RBAC + price mask

| Check | Result | Evidence |
|---|---|---|
| Login | ✅ | role=warehouse_manager via /me |
| Sidebar — 财务管理 absent | ✅ K5 OK | 38 menu nodes total, no 财务管理 |
| Sidebar — 质量管理 absent | ✅ | |
| `/sales/orders` accessible | ✅ Loads | `warehouse-2-sales-no-price.png` |
| **Sales table — price columns** | ✅ **K2 mask working** — columns: 订单编号/客户/业务员/下单日期/状态/操作 (NO 总金额/运费/折扣) | |
| **WorkflowBar visible** | ✅ Sprint 2 G renders for warehouse role too | 待审 1 / 进行中 3 / 已完成 0 |
| **StickyFooter** | ⚠️ Renders but stats "共 0 条" (table empty for warehouse view) | |
| Backend `/price-comparison/{PO}` | ✅ **403 with informative message** "您的角色 [仓储主管] 缺少 采购管理 或 财务管理 模块的 [读写] 权限" | K5 enforced server-side ✓ |
| `/procurement/finance-review` | (skipped — would be 403 by frontend guard) | |
| ⚠️ Toast error during page load | ❌ **Bug #11** "系统处理异常 追踪码: 6E7CA619" while loading /sales/orders | |

### A.4 f006_procurement_mgr (procurement_manager) — N31 + 三价 + 财审入口

| Check | Result | Evidence |
|---|---|---|
| Login | ✅ | role=procurement_manager |
| Sidebar items | 28 visible | Includes 财务管理 submenu (财务概览/财务报表/应收应付/开票管理/收款管理/调整审批/SKU毛利率分析) |
| **财务审核 menu entry** | ❌ Same Bug #2 — absent | |
| `/sales/orders` | ❌ **Bug #12** — redirects to /403 (procurement role excluded from sales view) | |
| Backend `/purchase/orders/by-status?status=DRAFT` | ✅ 200 (real PO-20260513-0001 visible) | |
| Backend `/workflow-stats/procurement` | ❌ **Bug #5** — 404 (sales & production stats work) | |
| Backend `/price-comparison/PO-20260513-0001` | ⚠️ 404 "采购订单不存在" — likely needs UUID not orderNumber | |
| N31 trigger flow | ❌ Cannot exercise via UI for this role | |

### A.5 f006_sales_mgr (sales_manager) — UX-A1/A2/A3 + Print PDF

| Check | Result | Evidence |
|---|---|---|
| Login | ✅ | |
| `/sales/orders` | ✅ Loads with **5 real orders** | `sales-2-more-dropdown.png` |
| Data | ✅ ¥5,000 / ¥120,000 / ¥5,605,600 / ¥382,950 / ¥14,000 (customer: 叮咚, salesperson: 张六膳) | |
| **UX-A1 WorkflowBar (top)** | ✅ Renders correctly: 销售工作流 / 待审 1 → 进行中 3 → 已完成 0 / 💬 跟 AI 说 button | |
| WorkflowBar — node click filter | ⏭ Not exercised (deferred — already verified API contract via probe) | |
| **UX-A2 RowAction (inline + 更多 dropdown)** | ⚠️ **Hybrid not spec-pure**. Inline buttons: 详情/取消/出库/开票/税率分组开票/收款. 更多 dropdown: 💬AI/📋转生产/🛒转采购/📄打印PDF/🚫取消/🔍查看. | |
| RowAction — 财务已批准 rows | ❌ **Bug #15** — dropdown only has 💬AI/🔍查看 (2 items), missing 📄打印PDF for the 3 customer-approved orders | |
| RowAction — 💬 跟 AI 说 顶部固定 | ✅ Confirmed first item in all 5 row dropdowns | |
| **UX-A3 StickyFooter** | ❌ **Bug #14** — shows "暂无数据 / AI 分析" button even though list has 5 rows ¥6.1M total. Stats widget not aggregating | |
| Print PDF click → real download | ❌ **Bug PDF P0** — Click triggered `GET /api/.../print/sales-order/fe70dbb9...` → server returned **502 "打印服务暂不可用 — 请稍后重试"**. Also reproduced with curl-equivalent direct fetch | |
| Total amount column visible | ✅ canViewPrice=true for sales_manager | |

---

## Tier B — per-feature exhaustive (spot-check)

### B.1 UX-A1 WorkflowBar (5 module × 3 node)

Backend stats endpoint coverage:

| Module | Endpoint | Status | Nodes |
|---|---|---|---|
| sales | `/workflow-stats/sales` | ✅ 200 | pending:1 / in_progress:3 / done:0 |
| procurement | `/workflow-stats/procurement` | ❌ **404** | Bug #5 — endpoint missing |
| production | `/workflow-stats/production` | ✅ 200 | pending:0 / in_progress:4 / done:2 |
| finance | not probed | ⏭ | |
| warehouse | not probed | ⏭ | |

UI rendering (sales view, sales_mgr + warehouse_mgr both): ✅ WorkflowBar present, count badges match API, 💬 AI 说 button present, node arrows (→) rendered.

### B.2 UX-A2 RowActionMenu (8 list × 8-14 actions)

Sales orders (sales_mgr): ✅ dropdown verified, state-dependent action set, top-fixed AI entry.
- **Variance**: 已确认 → 6 actions, 财务已批准 → 2 actions, 已取消 → 3 actions
- **Spec drift**: Spec expected a single "操作 ▾" with all actions inside. Implementation uses inline primary buttons + 更多 fallback dropdown.

Other 7 lists (purchase/production/inventory/shipment/return/transfer/wastage): ⏭ not exercised (deferred).

### B.3 UX-A3 StickyFooter (10 list × stats)

Sales orders: ❌ Bug #14 — placeholder "暂无数据" instead of summary stats. AI 分析 button click not tested.
Warehouse-view sales: ✅ "共 0 条" displays (empty table — correct).
Other 8 lists: ⏭ not exercised.

### B.4 N31 销售→采购分流 (Chat E #682)

| Step | Result |
|---|---|
| `/api/mobile/F006/sales/orders/{id}/shortage-report` | ✅ 200 "缺料分析尚未生成" — endpoint registered |
| ShortageAnalysisService listener exercised | ❌ Cannot confirm — no order has been re-approved since the deployment to trigger @Async listener |
| AIChat ShortageChainCard | ⏭ Not tested |

### B.5 N48 研发样品 (Chat F #680/#687)

| Step | Result |
|---|---|
| `/api/mobile/F006/rd/samples` | ✅ 200 (empty content for F006) |
| Sample create / approve / chain | ⏭ Not tested (no rd-role account in F006 16-account set) |

### B.6 P-FIN-1 财审 + 三价标红 (Chat J #675/#679/#686)

| Step | Result |
|---|---|
| Vue Web view (`/procurement/finance-review`) | ✅ Page exists | URL has wrong /list suffix in spec ⚠️ Bug #1 |
| Menu entry | ❌ Bug #2 |
| finance_mgr access | ❌ Bug #10 — 403 |
| Backend by-status filter | ✅ Endpoint works |
| Data for PENDING_FINANCE_REVIEW | ❌ Bug #4 — 0 records (all 4 statuses empty across F006) |
| Red row #FFE4E1 styling | ❌ Cannot verify — 0 data |
| Approve / reject flow | ❌ Cannot verify — 0 data |

### B.7 打印 PDF 真链路 (Chat H FU #689)

| Endpoint | Status | Body |
|---|---|---|
| `/print/sales-order/fe70dbb9-...` (real id) | ❌ 502 | "打印服务暂不可用 — 请稍后重试" |
| `/print/sales-order/test` | ❌ 502 | Same |
| `/print/purchase-order/test` | ❌ 502 | Same |

**Print PDF service is DOWN in prod**. All 5 print endpoints (sales/purchase/production/quotation/material) presumed affected (sales + purchase confirmed). The Chat H FU PR #689 deliverable cannot be demonstrated.

### B.8 AI deep-link 18 site (Chat I FU #688)

⏭ Not exercised — defer to next round.

---

## Tier C — boundary + error handling (spot-check)

| Test | Result | Note |
|---|---|---|
| 401 — clear token + API call | ✅ Implicit — login redirect works | |
| 403 — warehouse_mgr → finance-only endpoint | ✅ Returns informative message "您的角色 [仓储主管] 缺少 …" with actionHint | Excellent UX for permission errors |
| 403 — finance_mgr frontend route guard | ❌ Bug #10 — redirected to /403, no actionable message | |
| Frontend 500 toast | ❌ Bug #11 — warehouse_mgr sees "系统处理异常 追踪码 6E7CA619" with no path forward | |
| Validation — by-status invalid enum | ✅ Returns 400 with list of valid values | |
| Backend rate-limit | Not exercised | |

---

## Bug list (15 bugs total: 4 P0 / 8 P1 / 3 P2)

### Bug #1 — [P0] `/procurement/finance-review/list` falls into detail route
- **Tier**: A.1 / B.6
- **Repro**: login f006_admin → navigate `https://admin.cretaceousfuture.com/procurement/finance-review/list`
- **Expected**: list page (财务待审采购单)
- **Actual**: detail page titled "财务审核 · —" treating "list" as `:id` parameter → triggers `GET /api/.../purchase/orders/list` → 404 "采购订单不存在"
- **Affects**: Chat J Vue FU #686 — anyone clicking a link/bookmark with `/list` suffix dies
- **Fix**: either (a) add explicit `/list` route entry before `:id` param, or (b) update spec to drop /list
- **Evidence**: `screenshots-smoke-v2/bug-1-finance-review-list-missing.png`

### Bug #2 — [P0] No sidebar menu entry for 财务审核
- **Tier**: A.1 / A.2 / A.4 / B.6
- **Repro**: log in as f006_admin/finance_mgr/procurement_mgr, expand 财务管理 + 采购管理 submenus → no 财务审核 / 财务待审采购单 item present
- **Expected**: Sprint 2 J Vue FU #686 must register at least one menu entry — finance_mgr should see it in 财务管理
- **Actual**: zero menu items reference the route across all 3 roles. Feature only reachable by manually typing the URL.
- **Affects**: Chat J Vue FU #686 discoverability
- **Fix**: add menu entry in `web-admin/src/router/` (or wherever Element Plus sidebar config lives)
- **Evidence**: snapshot of 财务管理 + 采购管理 submenus

### Bug #10 — [P0] finance_mgr (intended user) gets /403 on finance-review route
- **Tier**: A.2 / B.6
- **Repro**: login f006_finance_mgr → navigate `/procurement/finance-review` → redirects to `/403 无权限`
- **Expected**: finance_manager has primary access to this feature
- **Actual**: Vue route guard blocks. **Backend** allows finance_manager (API call returns 200), so this is **frontend-only** RBAC misconfig.
- **Affects**: entire Chat J target user — feature unusable by intended role
- **Fix**: Vue route meta should list `finance_manager` (Sprint 1 K2-K5 PriceMaskResolver pattern likely mirrored here; likely missed in PR #686)
- **Evidence**: `screenshots-smoke-v2/bug-10-finance-mgr-403.png`

### Bug PDF — [P0] Print PDF backend service returns 502 for all calls
- **Tier**: A.5 / B.7
- **Repro**: as f006_sales_mgr on `/sales/orders` → row → 更多 → 📄 打印 PDF; also direct `fetch('/api/mobile/F006/print/sales-order/{realUuid}')`
- **Expected**: PDF byte stream with `Content-Type: application/pdf`
- **Actual**: `502 application/json {"code":502,"message":"打印服务暂不可用 — 请稍后重试","severity":"error"}`. Reproduced on real UUID `fe70dbb9-5f83-4965-9db1-fec56d8b22ed` and fake "test" id. Both `print/sales-order` and `print/purchase-order` endpoints affected.
- **Affects**: Chat H FU #689 (print sales/purchase/production/quotation/material) — entire deliverable broken
- **Hypothesis**: PDF service (likely a Python or sidecar) is down, or middleware misrouted in nginx vhost set (per [[nginx_3_vhost_sync]] HARD rule risk)
- **Fix**: investigate prod logs for the Java handler that wraps PDF generation; check whether `admin.cretaceousfuture.com` nginx vhost is forwarding `/api/mobile/*/print/*` to the right upstream
- **Evidence**: screenshot capture not feasible (502 has no UI page); `screenshots-smoke-v2/sales-3-after-print-click.png` shows post-click state

### Bug #3 — [P1] Finance-review list columns differ from spec
- **Tier**: A.1 / B.6
- **Spec** (per prompt): 订单号 / 供应商 / 总金额 / **状态** / **标红数量 chip** / 操作 + 状态 filter (PENDING_FINANCE_REVIEW / FINANCE_APPROVED / FINANCE_REJECTED / CLOSED)
- **Actual**: 订单号 / 供应商 / 总金额 / **下单日期** / 状态 / 操作 — no 标红数量 chip column, no status filter dropdown
- **Affects**: Chat J Vue FU #686
- **Fix**: align Vue table column definitions with spec, add status filter

### Bug #4 — [P1] Zero data in PENDING_FINANCE_REVIEW across all 4 statuses
- **Tier**: B.6
- **Repro**: GET `/api/.../purchase/orders/by-status?status=PENDING_FINANCE_REVIEW|FINANCE_APPROVED|FINANCE_REJECTED|CLOSED&page=1&size=5` — all 4 return `content: []`
- **Affects**: Cannot test approve/reject/red-row flow in prod; demo-blocking
- **Fix**: trigger the N31 sales-order approval flow once to produce a PENDING_FINANCE_REVIEW PO, OR seed demo data, OR write a test that exercises the flow end-to-end

### Bug #5 — [P1] `/api/mobile/F006/workflow-stats/procurement` 404
- **Tier**: A.4 / B.1
- **Spec**: Sprint 2 Chat G UX-A1 covers all 5 modules
- **Actual**: only `workflow-stats/sales` and `workflow-stats/production` are registered; procurement / finance / warehouse not verified working
- **Affects**: Chat G #683/#684/#685 + FU
- **Fix**: register `/workflow-stats/procurement` endpoint (and ensure finance/warehouse also exist if spec requires)

### Bug #11 — [P1] Sales orders page errors on warehouse_mgr role
- **Tier**: A.3 / Tier C
- **Repro**: f006_warehouse_mgr → `/sales/orders` → toast "系统处理异常，请稍后重试 (追踪码: 6E7CA619)"
- **Affects**: warehouse role's day-to-day sales visibility
- **Fix**: investigate backend 500 path with that trace code — possibly canViewPrice gate logic, possibly POS finance_summary lookup

### Bug #12 — [P1] procurement_mgr → /sales/orders redirects to /403
- **Tier**: A.4
- **Repro**: f006_procurement_mgr → `/sales/orders` → /403 无权限
- **Expected per spec**: procurement_mgr should be able to view sales orders to trigger N31 flow ("creates 销售单 → 提交")
- **Actual**: blocked. Either spec is wrong (procurement creates *purchase* not *sales* orders), or route guard misses procurement_manager
- **Recommend**: clarify scope with PM. If spec was wrong, downgrade to P2/wontfix.

### Bug #13 — [P1] UX-A2 RowActionMenu — hybrid not pure dropdown
- **Tier**: A.5 / B.2
- **Spec**: single "操作 ▾" dropdown with 8-14 items, top-fixed 💬 AI entry
- **Actual**: inline primary buttons (详情/取消/出库/开票/税率分组开票/收款) + 更多 dropdown fallback
- **Assessment**: implementation is functionally richer than spec but inconsistent with the design system promise
- **Affects**: Chat H #678/#689
- **Fix**: decide spec drift acceptance; if accepted, update spec to "inline + 更多". If rejected, collapse all into single dropdown.

### Bug #14 — [P1] UX-A3 StickyFooter renders "暂无数据" with non-empty list
- **Tier**: A.5 / B.3
- **Repro**: sales_mgr → `/sales/orders` (5 rows, ¥6.1M total) → footer area shows "暂无数据" + "AI 分析" button
- **Expected per spec**: footer shows "共 5 单 / 总金额 ¥6,127,550.00 / 1/1"
- **Actual**: hardcoded "暂无数据" placeholder, stats widget never populated
- **Affects**: Chat I #681/#688 — main UX-A3 deliverable visibly broken
- **Fix**: wire stats widget to list query result

### Bug #15 — [P1] Print PDF missing from 财务已批准 row dropdown
- **Tier**: A.5 / B.2
- **Repro**: sales_mgr → `/sales/orders` → click 更多 on a 财务已批准 row → dropdown shows only 💬AI/🔍查看, no 📄 打印PDF
- **Actual user flow impact**: customers print orders *after* finance approves — print should be available exactly in this state
- **Affects**: Chat H FU #689
- **Fix**: include print PDF in actions menu for FINANCE_APPROVED / PROCESSING / PARTIAL_DELIVERED / COMPLETED states

### Bug #16 — [P2] sales_mgr 已确认 row dropdown: "税率分组开票" + "开票" both present
- **Tier**: A.5
- **Observation**: row has two distinct buttons "开票" and "税率分组开票" inline + 收款 + 出库 + 取消 + 详情 + 更多. UI dense for 已确认 state.
- **Recommend**: review whether 税率分组开票 should be under 更多.

### Bug #17 — [P2] `priceComparison` 404 on real PO orderNumber
- **Tier**: A.4
- **Repro**: as procurement_mgr, `/purchase/orders/PO-20260513-0001/price-comparison` → 404 "采购订单不存在"
- **Hypothesis**: endpoint expects UUID not orderNumber. Confirmed via `/by-status` which returned id `f05582fe-4ff0-4a2a-9ff6-5f3f1ce19b23` for that PO.
- **Recommend**: accept both, or document explicitly.

### Bug #18 — [P2] Console error count grows across all role sessions
- **Tier**: cross
- **Observation**: every authenticated SPA load adds 1-3 console errors (404s for /workflow-stats/procurement, etc.) — degrades observability noise.

---

## Sprint 2 PR scoreboard

| PR / Chat | Component | Verdict |
|---|---|---|
| #675 / Chat J — finance-review backend | ✅ Endpoint registered, by-status works |
| #679 / Chat J — finance-review RN | ⏭ not tested (RN not in scope of this Web smoke) |
| #686 / Chat J FU — Vue view | ❌ **3 bugs (#1, #2, #10), 1 column drift (#3)** |
| #683-685 / Chat G — UX-A1 WorkflowBar | ✅ Sales+Production OK; ❌ procurement endpoint 404 |
| #678 / Chat H — UX-A2 RowAction | ⚠️ Hybrid spec drift (#13), missing print on approved (#15) |
| #689 / Chat H FU — Print PDF | ❌ **Service 502 — entire deliverable broken** |
| #681 / Chat I — UX-A3 StickyFooter | ❌ **Bug #14 — placeholder shown over real data** |
| #688 / Chat I FU — AI deep-link 18 site | ⏭ Not exercised |
| #682 / Chat E — N31 缺料分析 | ✅ Endpoint live (no exercised data) |
| #680 / Chat F — N48 研发样品 | ✅ Endpoint live (empty F006) |
| #687 / Chat F FU — sample photo upload | ⏭ Not exercised |
| Sprint 1 K1-K5 RBAC | ✅ Holding (warehouse_mgr properly 403/masked) |

---

## Screenshot index (`screenshots-smoke-v2/`)

- `admin-1-dashboard-full.png` — f006_admin dashboard, 13 menus
- `bug-1-finance-review-list-missing.png` — /list URL falls into detail route
- `finance-review-list-correct-url.png` — list page works at no-/list URL
- `finance-mgr-1-dashboard.png` — finance_mgr 9 menus, no 财审 entry
- `bug-10-finance-mgr-403.png` — finance_mgr → 403 page
- `warehouse-2-sales-no-price.png` — warehouse_mgr sales/orders, price columns masked
- `sales-2-more-dropdown.png` — sales_mgr orders list with 更多 dropdown open
- `sales-3-after-print-click.png` — post-click state (502 alert not captured visually)

---

## Recommendations

1. **HOLD ship of Chat J + Chat H FU before customer demo.** 4 P0 bugs in the Sprint 2 critical path.
2. **Immediate fix prio**:
   - Bug PDF (P0): restore PDF backend service / fix nginx upstream routing
   - Bug #10 (P0): add finance_manager to Vue route guard for `/procurement/finance-review`
   - Bug #2 (P0): add sidebar menu entry under 财务管理 → 财务审核
   - Bug #1 (P0): fix route order so `/list` doesn't collide with `:id`
3. **Before next demo**: seed at least 1 PO in PENDING_FINANCE_REVIEW status so Chat J approve/reject flow can be exercised live.
4. **Bug #14 (StickyFooter)**: wire widget to list data — this is a hot-path customer-visible regression.
5. **Bug #13 (RowAction)**: decide spec drift acceptance; current hybrid is usable but spec says otherwise.
6. **Bug #5 (workflow-stats/procurement)**: register endpoint — Chat G is incomplete without it.
7. **Re-test post-fix** with deep coverage of Tier B.2 (full 8-list RowAction sweep), B.3 (10-list StickyFooter), B.8 (AI deep-link 18 site).

---

## Coverage gaps (not run)

- Tier B.2 RowAction: 7 of 8 lists (purchase/production/inventory/shipment/return/transfer/wastage) — only sales exercised
- Tier B.3 StickyFooter: 9 of 10 lists — only sales exercised
- Tier B.5 N48 sample full create-approve-photo chain
- Tier B.8 AI deep-link 18 site
- RN App side (Expo Web) entirely
- 5×5 multi-role negative regression
- Concurrent edit race conditions
- Long content truncation
- Network-offline retry

**Why deferred**: Initial Tier A coverage surfaced 4 P0s; further coverage premature until P0s are resolved. ROI of running Tier B/C against broken deliverables ≈ 0.

---

**Status: HOLD before customer demo. 4 P0 bugs require fix + re-test.**
