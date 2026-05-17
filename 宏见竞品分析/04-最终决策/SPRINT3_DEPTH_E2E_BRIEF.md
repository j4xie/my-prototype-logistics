# Sprint 3 Depth E2E — Brief for new chat

**Mission**: Customer-grade end-to-end coverage of all features shipped since smoke v2 (= Sprint 2 v3 fixes + Sprint 3 G/F/E/H/I/J/#695). Plus close the 4 Tier B coverage gaps that smoke v2 deferred (RowAction sweep, StickyFooter sweep, N48 sample chain, AI deep-link 18 site). Plus 5×5 multi-role RBAC negative regression.

**Mode**: VERIFY + FILE ISSUES. Do **not** fix bugs in-line. File each finding as GitHub issue in `j4xie/my-prototype-logistics` with reproduction, role, evidence (screenshot or curl output). Write running STATUS doc to `宏见竞品分析/04-最终决策/STATUS/SPRINT3_DEPTH_E2E_STATUS.md`.

**Env**: prod `https://admin.cretaceousfuture.com` (web-admin) + `https://api.cretaceousfuture.com/api/mobile/*` (backend). Already deployed: Sprint 1+2+3 全部 PRs merged + Java blue 10010 + green 10020 healthy + Flyway migrations applied + `SPRING_FLYWAY_OUT_OF_ORDER=true` set on prod.

**Tester**: organizer-dispatched depth E2E chat (Claude Opus 4.7), Playwright MCP + curl probes.

---

## §0. Pre-flight grep verifications (DO FIRST before any test)

Before running any test, **grep main** to confirm these names + paths exist. If any fails → file ❌ in §0 and ask organizer before continuing.

| Claim | Verify | Expected file:line |
|---|---|---|
| **SalesController @RequestMapping** | `grep -n "@RequestMapping" backend/java/cretas-api/src/main/java/com/cretas/aims/controller/inventory/SalesController.java` | `/api/mobile/{factoryId}/sales` line 32 |
| **SalesOrder.lockedQty / reservedQty / shortageQty @JsonProperty** (PR #690 G) | `grep -n "lockedQty\|reservedQty\|shortageQty" backend/java/cretas-api/src/main/java/com/cretas/aims/entity/inventory/SalesOrder.java` | lines 301 / 310 / 319 |
| **VoucherController** (PR #693 E) | `head -50 backend/java/cretas-api/src/main/java/com/cretas/aims/controller/finance/VoucherController.java` | `/api/mobile/{factoryId}/finance/vouchers` |
| **BomVersionController** (PR #694 H) | `head -50 backend/java/cretas-api/src/main/java/com/cretas/aims/controller/BomVersionController.java` | `/api/mobile/{factoryId}/bom/versions` |
| **EcnController** (PR #694 H) | `head -40 backend/java/cretas-api/src/main/java/com/cretas/aims/controller/EcnController.java` | `/api/mobile/{factoryId}/bom/ecns` |
| **ApprovalWorkflowController** (PR #703 I) | `head -50 backend/java/cretas-api/src/main/java/com/cretas/aims/controller/ApprovalWorkflowController.java` | `/api/mobile/{factoryId}/approval-workflows` |
| **FormTemplateController** (PR #701 J) | `head -50 backend/java/cretas-api/src/main/java/com/cretas/aims/controller/FormTemplateController.java` | `/api/mobile/{factoryId}/form-templates` |
| **PR #691 F is AI-Tool only, NOT REST endpoint** | `ls backend/java/cretas-api/src/main/java/com/cretas/aims/controller/*Link*` should return 0 | Verify via AI chat box, not direct curl |
| **N31 ShortageReport endpoint** | `grep -rn "shortage-report" backend/java/cretas-api/src/main/java/` | `/api/mobile/{factoryId}/sales/orders/{id}/shortage-report` |
| **Web-admin deploy fresh** | `curl -sI https://admin.cretaceousfuture.com/ \| grep Last-Modified` | Must be ≥ `Sat, 16 May 2026 16:42:00 GMT` (Sprint 3 final deploy) |

After all 10 verified → start Tier A. If any fails, file finding 0.X and HOLD.

---

## §1. 16 F006 prod accounts (factory_id=F006, password `123456` for all)

| # | Username | Role | Test target |
|---|---|---|---|
| 1 | `f006_admin` | factory_super_admin | Sprint 3 I 审批工作流 editor / J 打印模板 editor, all-features sanity |
| 2 | `f006_dept_admin` | department_admin | Cross-dept visibility |
| 3 | `f006_dispatcher` | dispatcher | Production schedule integration |
| 4 | `f006_equipment_admin` | equipment_admin | Equipment menu only |
| 5 | `f006_finance_mgr` | finance_manager | **Sprint 3 E 凭证 + Sprint 2 J 财审**, finance:read_write |
| 6 | `f006_hr_admin` | hr_admin | HR submenu only |
| 7 | `f006_procurement_mgr` | procurement_manager | Sprint 2 P-FIN-1 财审入口, 三价比较, PR auto from N31 |
| 8 | `f006_production_mgr` | production_manager | **Sprint 3 H BomVersion + ECN**, production schedule |
| 9 | `f006_quality_insp` | quality_inspector | Quality view, no price |
| 10 | `f006_quality_mgr` | quality_manager | Quality manager scope |
| 11 | `f006_sales_mgr` | sales_manager | **Sprint 3 G 锁/备/缺 chips + N31 trigger**, sales:read_write |
| 12 | `f006_viewer` | viewer | Read-only across modules |
| 13 | `f006_warehouse_mgr` | warehouse_manager | **REGRESSION**: `/sales/orders` 200 (PR #707/#708 Flyway fix), price columns masked |
| 14 | `f006_warehouse_worker` | warehouse_worker | Warehouse worker scope |
| 15 | `f006_worker1` | operator | Operator scope (likely most narrow) |
| 16 | `f006_workshop` | workshop_supervisor | Workshop scope |

Login endpoint: `POST /api/mobile/auth/unified-login` body `{"username":"f006_xxx","password":"123456"}`. Token stored as `localStorage['cretas_access_token']`. **Per-username 60s rate-limit** — pace logins.

---

## §2. Tier A — Sprint 3 new features (7 PRs)

### A.1 PR #690 G — Sales order 锁/备/缺 chips

**Role**: `f006_sales_mgr`

**Verify on UI** (sales orders list page):
1. Each row shows 3 chips: 锁 X / 备 Y / 缺 Z (only when non-zero)
2. Sum of chips matches detail page line items
3. `GET /api/mobile/F006/sales/orders` response includes top-level `lockedQty`, `reservedQty`, `shortageQty` (aggregated across items)
4. Each `salesOrderItems[*]` row has `lockedQty`, `reservedQty`, `shortfallQuantity` numeric (not null, ≥ 0)
5. **Edge**: if listener hasn't run for the order, all 3 should be 0 / not undefined-NaN

**Curl probe** (after login):
```bash
TOKEN="<paste token>"
curl -s -H "Authorization: Bearer $TOKEN" https://api.cretaceousfuture.com/api/mobile/F006/sales/orders | jq '.data[0] | {id,lockedQty,reservedQty,shortageQty}'
```

### A.2 PR #691 F — Business Links (AI Tool, NOT REST)

**Role**: `f006_admin` (or any role with AI chat access)

**This is AI-Tool only.** Test via AI chat box:
1. Open AI chat
2. Ask: "查一下销售单 SO-xxx 关联的所有业务单"
3. Expect: response lists linked purchase orders, production plans, etc. via `BusinessLinkQueryTool`
4. Ask: "F006 跟订单 SO-xxx 关联的 8 类业务是什么"
5. Expect: 8-link breakdown

**No UI page**. If AI returns "工具找不到", file finding F.X.

### A.3 PR #693 E — Voucher (凭证 hook)

**Role**: `f006_finance_mgr`

**Verify on UI** (财务 → 凭证管理 if menu added, else direct URL):
1. GET `/finance/vouchers` returns list (may be empty for F006 — verify endpoint reachable + envelope)
2. POST `/finance/vouchers/generate` with sample body (per OpenAPI / controller) — should create or return existing voucher (idempotent)
3. GET `/finance/vouchers/by-business/PURCHASE_ORDER/{poId}` for a real PO — should return generated voucher or 404 (not 500)
4. Check that 财务管理 sidebar has 凭证 entry (or note its absence)

**Cross-role**: `f006_viewer` should be able to GET (`finance:read` includes viewer), but NOT POST (write). Test 403 on POST.

### A.4 PR #694 H — BOM Version + ECN

**Role**: `f006_production_mgr` (BOM owner) + `f006_dev_mgr` if exists

**Verify**:
1. GET `/bom/versions/by-recipe/{bomRecipeId}/current` — returns BomVersion with `snapshot` JSONB
2. GET `/bom/versions/by-recipe/{bomRecipeId}/history` — returns array
3. POST `/bom/versions` create draft → POST `/bom/versions/{id}/submit` → 5-state machine progresses
4. GET `/bom/ecns/{ecnId}` for a real ECN — fields include `reason` (5-enum), `effectiveFrom`, `relatedVersions`
5. POST `/bom/ecns/calculate-impact` with sample materialChange — returns affected BOMs count
6. **Cross-role**: `f006_viewer` GETs OK, POSTs 403

### A.5 PR #695 — F006 seed data (Issue #538)

**Verify**:
1. Login `f006_admin` → 三价对比 page renders prices (was 0/zero before seed)
2. T4-B3 stock-insufficient four-tuple — pick a known low-stock material, attempt outbound, see proper insufficient warning
3. T4-D5 WH-LOG outbound — verify outbound log writes
4. T3-14 三价对比 refresh — refresh button doesn't 500

### A.6 PR #701 J — Print Template Visual Editor

**Role**: `f006_admin`

**Verify on UI** (form templates / print template editor):
1. GET `/form-templates` lists all entity types
2. GET `/form-templates/entity-types` returns valid list
3. Open visual editor (UI route — grep web-admin/src/router for entry, likely `/admin/print-templates`)
4. Drag 7 element types (text/field/table/qr/barcode/image/stamp) onto canvas
5. Bind field via `{{path}}` syntax
6. Click 预览 → PDF generates without 502 (regression check — PDF was Bug PDF in v2)
7. Save → POST `/form-templates` returns 200 with new version
8. GET `/form-templates/id/{id}/versions` shows newly saved version
9. POST `/form-templates/id/{id}/rollback` to previous version → version row updates

**6 seed templates check**: GET `/form-templates` should list 6 system templates already seeded (per PR description).

### A.7 PR #703 I — Approval Workflow Editor (graph-native)

**Role**: `f006_admin`

**Verify on UI** (审批工作流配置 page):
1. GET `/approval-workflows` lists all configured graphs
2. GET `/approval-workflows/decision-types` returns 10 manufacturing decision types
3. GET `/approval-workflows/by-type/PURCHASE_ORDER_APPROVAL` returns graph for PO approval
4. POST `/approval-workflows` create new graph (sequential 2-node simple flow)
5. POST `/approval-workflows/validate` with the new graph — returns valid/invalid + reasons
6. GET `/approval-workflows/statistics` — counts per state
7. UI canvas renders nodes + edges (Vue Flow or similar)

---

## §3. Tier B — Sprint 2 deferred gaps (smoke v2 §recommendations 6-7)

### B.1 RowActionMenu sweep — 8 lists × 1 role each

Per smoke v2: only `sales` was exercised. Verify the other 7 lists render the RowAction (inline + 更多 hybrid acceptable per Bug #13 spec drift):

| List | Role | URL |
|---|---|---|
| sales | sales_mgr | `/sales/orders` (already done v2) |
| **purchase** | procurement_mgr | `/procurement/orders` |
| **production** | production_mgr | `/production/plans/list` |
| **inventory** | warehouse_mgr | `/inventory/list` |
| **shipment** | sales_mgr | `/sales/deliveries` |
| **return** | sales_mgr or warehouse_mgr | `/sales/returns` (grep route) |
| **transfer** | warehouse_mgr | `/inventory/transfers` (grep route) |
| **wastage** | warehouse_mgr | `/inventory/wastage` (grep route) |

Per list: check RowAction renders, 编辑 / 删除 / 更多 buttons visible, NO 500/404. Screenshot each.

### B.2 StickyFooter sweep — 10 lists × 1 role each

Per smoke v2 Bug #14: StickyFooter renders "暂无数据" + AI button on sales list even when data exists. **PR #700 fixed sales — verify regression on sales + run remaining 9 lists**:

| List | Role |
|---|---|
| sales (regression after #700 fix) | sales_mgr |
| purchase | procurement_mgr |
| production | production_mgr |
| inventory | warehouse_mgr |
| finance-review | finance_mgr |
| shipment | sales_mgr |
| return | sales_mgr |
| transfer | warehouse_mgr |
| wastage | warehouse_mgr |
| **finance vouchers** (PR #693) | finance_mgr |

Verify StickyFooter shows real data summary, NOT "暂无数据".

### B.3 N48 R&D sample full chain (Sprint 2 F)

**Role**: `f006_dev_mgr` if exists, else `f006_production_mgr` or `f006_admin`

1. Create sample → submit approve → photo upload → final
2. GET `/rd/samples` — list shows new sample
3. GET `/rd/samples/{id}` — detail shows full data + photo
4. Lifecycle status progresses correctly

### B.4 AI deep-link sweep — 18 site (Sprint 2 K AI Chat integration)

Per smoke v2 deferred. Test 18 AI deep-link entry points across modules. **Grep web-admin/src for `aiQuery` or `deep-link` to find the 18 sites first.** For each, click → AI chat opens with prepopulated query → Java/Python returns valid response (not 502 / "找不到 tool"). 18 sites should be:
- 3 dashboard cards × 6 dashboards = 18, or
- Various module quick-actions

Verify Steve's expected list. If undocumented, file finding B.4.X with what you found vs expected.

---

## §4. Tier C — Cross-role RBAC 5×5 negative regression

Per smoke v2 §recommendations gap. The Sprint 1 K2/K5 RBAC was holding for `warehouse_mgr`. Now verify 5 narrow roles × 5 sensitive views = 25 cells.

**Roles** (narrow, no price/finance):
- `f006_warehouse_mgr`
- `f006_operator` (f006_worker1)
- `f006_quality_insp`
- `f006_dispatcher`
- `f006_viewer`

**Sensitive views**:
1. `/procurement/orders` — price columns must mask + 403 on direct PO detail if not warehouse_mgr|procurement_mgr
2. `/procurement/finance-review` — only `finance_mgr` + `f006_admin` + `f006_procurement_mgr` allowed; others 403
3. `/finance/*` — only finance roles allowed
4. `/sales/orders` price column — masked unless `sales:price` permission
5. `/bom/versions/{id}` — `@PriceSensitive snapshot` JSONB masked for non-price roles

Verify each combination either:
- ✅ Render OK with proper masking (price columns "***" or hidden), OR
- ✅ 403 page with proper error message, OR
- ❌ Bypass (file as P0)

**Output**: 25-cell matrix table in STATUS file.

---

## §5. Tier D — Smoke v3 regression (must re-verify)

Re-verify the 2 v3 bugs that were fixed but never re-tested in v3 (Steve closed v3 with verdict A based on smoke chat's claim, not 2nd smoke).

### D.1 P1 warehouse_mgr `/sales/orders` 500 → 200 (PR #707/#708 Flyway fix)

1. Login `f006_warehouse_mgr`
2. Navigate `/sales/orders`
3. Expect: 200 + list renders + price columns masked
4. Curl probe: `curl -s -H "Authorization: Bearer $TOKEN" https://api.cretaceousfuture.com/api/mobile/F006/sales/orders | jq '.success'` → `true`

### D.2 P2 finance-reject blank notes → 400 (PR #704/#705 validation)

1. Login `f006_finance_mgr` (or admin)
2. Find a PO in `PENDING_FINANCE_REVIEW` (may need seed if 0 records — file finding D.2.0 if empty)
3. Click 驳回 with empty notes textarea
4. Expect: error toast "驳回必须填写原因 (notes 不能为空)" + 400
5. Same with whitespace-only notes — should also 400

---

## §6. Tier E — Issue #709 N31 listener exercise

**CAREFUL**: This involves creating real data in F006 prod. Coordinate with Steve before running. Skip if not authorized.

1. Login `f006_sales_mgr`
2. Create new 销售单 with un-stocked materials
3. Submit + finance-approve
4. Wait 10s
5. GET `/sales/orders/{id}/shortage-report` → non-empty data
6. Login `f006_procurement_mgr` → check PENDING_FINANCE_REVIEW PO appears with 关联销售单 backlink
7. File outcome in Issue #709 comment + STATUS doc

---

## §7. Output format

Write `宏见竞品分析/04-最终决策/STATUS/SPRINT3_DEPTH_E2E_STATUS.md` with:

```markdown
# Sprint 3 Depth E2E STATUS

**Tester**: <name>
**Date**: <iso>
**Env**: <admin URL + version>

## Executive summary
| Tier | PASS | FAIL | INFO | N/A | Verdict |
|---|---|---|---|---|---|
| §2 Sprint 3 features | x/7 | x | x | x | A/B/C |
| §3 deferred gaps | x/4 | x | x | x | |
| §4 5×5 RBAC | x/25 | x | x | x | |
| §5 v3 regression | x/2 | x | x | x | |
| §6 N31 | x/1 | x | x | x | |
| **TOTAL** | x/39 | x | x | x | **A/B/C** |

## Findings (one row per filed issue)
| Issue # | Tier | Severity | One-line |
|---|---|---|---|

## Verdict
- **A** if 0 P0 + ≤2 P1: customer-demoable as-is
- **B** if 1-2 P0 OR 3-5 P1: fixable in ≤4h
- **C** if 3+ P0 OR major regression: HOLD demo
```

Issue title format: `[Sprint3 depth E2E] [P0/P1/P2] <one-line> (Tier X.Y, role Z)`

---

## §8. Rules for the tester

1. **Verify before claim** — every PASS must cite evidence (screenshot path, curl exit code, JSON snippet)
2. **Don't fix bugs** — file each as GitHub issue with reproduction
3. **Pace per-role logins** — 60s rate-limit per username
4. **Don't litter F006 prod** — for write operations (POST/PUT), use minimal test data, prefer existing records
5. **Tier E N31** — wait for Steve confirmation before running (real customer prod side effects)
6. **STATUS file** — update incrementally as you progress, don't wait to finalize
7. **If a §0 grep fails** — file finding 0.X and PAUSE for organizer

---

## §9. Suggested execution order

1. §0 grep (10 min)
2. §5 D.1 + D.2 regression (15 min — fastest sanity check)
3. §2 Sprint 3 features A.1-A.7 (90 min, depth varies)
4. §3 Tier B sweeps (60 min, mostly fast UI checks)
5. §4 5×5 RBAC (45 min)
6. §6 N31 — only if Steve confirms
7. Finalize STATUS + summarize to Steve

**Estimated total**: 3-4h focused.
