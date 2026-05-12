# Canvas Dynamic RBAC priceSensitive — Playwright E2E results

**Date**: 2026-05-12
**Branch**: `qa/canvas-dynamic-rbac-e2e`
**Tested against**: test env `http://139.196.165.140:8097` (web-admin 8097, Java 10011 via nginx)
**PR under verification**: #447 (commit `5ee8720c29`) — Canvas Dynamic schema priceSensitive support (P1-D, PR #442 follow-up)
**Tester**: chat-canvas-dynamic-rbac-e2e (Claude Code, organizer-deferred)
**Tool**: Playwright 1.58.2 / chromium headless (Node.js script per `e2e-web-admin` skill — MCP browser tools avoided due to Chrome profile lock)

## Verdict

**FAIL — PR #447 defense does not fire end-to-end in test env.** 2 confirmed bugs + 1 partial-coverage observation.

| # | Role | Page | Canvas Dynamic active? | Render outcome | Verdict |
|---|------|------|---|---|---|
| 1 | `warehouse_mgr1` | `/sales/orders` | **DYNAMIC** ✅ | Price cells show **`-`** (hyphen-minus), no `.price-masked` class | ❌ **BUG-1** PR #447 broken |
| 2 | `warehouse_mgr1` | `/procurement/orders` | LEGACY | Price cells show **`—`** + `.price-masked` (10 cells) | ✅ — but via PR #423 legacy v-if path, NOT PR #447 path |
| 3 | `warehouse_mgr1` | `/production/bom` | LEGACY | Price cells show **real values** (`¥18.50` etc.) — no defense | ❌ **BUG-2** sister-site sweep gap |
| 4 | `factory_admin1` | `/sales/orders` | DYNAMIC | Real `¥1,500.00` etc. | ✅ correct (admin has procurement:price:view) |
| 5 | `factory_admin1` | `/procurement/orders` | LEGACY | Real values | ✅ correct |
| 6 | `factory_admin1` | `/production/bom` | LEGACY | Real values | ✅ correct (but vacuous — admin gets real values either way) |

**Net coverage of PR #447's claimed scope:**
- Vue SchemaTableRenderer `isPriceSensitiveNull` predicate path: **0/3 modules verified live** — predicate exists in source but never fires end-to-end because effective-config API response is missing the `priceSensitive` flag (Bug 1) and BOM lacks backend strip (Bug 2)
- Migration `V20260513_01` flag plumbing: **not observable** in `/effective` endpoint response for any of the 3 modules

---

## Test setup — account substitution

Task spec said `f001_warehouse_mgr / 123456`. That account returns **HTTP 403 `用户账号已被禁用`** on test env (account disabled in DB). Substituted seeded account `warehouse_mgr1` (F001, role=`warehouse_manager`, permissions=`["warehouse:*"]`) — verified via `data.sql` line 36. Confirm if task author intended a different account.

---

## BUG-1 — sales_order Canvas Dynamic defense doesn't fire (priceSensitive flag absent from effective config)

### Symptom

`warehouse_mgr1` viewing `/sales/orders`:
- Canvas Dynamic page renders (renderingMode=DYNAMIC for F001/sales_order) ✅
- Table shows 20 rows ✅
- 总金额 / 折扣金额 columns render as `"-"` (regular hyphen, no `.price-masked` class) ❌
- Expected per PR #447: `"—"` (em-dash) wrapped in `<span class="price-masked">`

**Evidence** (`retest-warehouse-sales.json`):
```
firstRowCells = ["1","SO-20260428-0002","批量客户1","2026-04-27","-","-","已取消"," 详情 "]
maskedCount   = 0
```

### Root cause analysis

The PR #447 commit (5ee8720c29) has 4 cooperating pieces:
1. **Migration** `V20260513_01__module_schemas_price_sensitive_flags.sql` — sets `priceSensitive=true` on `sales_order.totalAmount` in `module_schemas` table
2. **Backend** `FactoryConfigServiceImpl.java:1149` — `if (schemaDef.containsKey("priceSensitive")) extra.put("priceSensitive", schemaDef.get("priceSensitive"));` — plumbs flag into `EffectiveField.extra`
3. **Vue** `SchemaTableRenderer.vue` — new `isPriceSensitiveNull(row, field)` predicate reading `field.extra?.priceSensitive`
4. **Vue** template — new `<span v-else-if="isPriceSensitiveNull(row, field)" class="price-masked">—</span>` branch

Test env `/api/mobile/F001/config/modules/sales_order/effective` response for `totalAmount.extra`:

```json
{
  "formatter": "currency",
  "computed": "SUM(items[].lineAmount)",
  "listOrder": 5,
  "listWidth": 120,
  "configurable": false,
  "listVisible": true
}
```

**`priceSensitive` key is absent.** Same result for `purchase_order.totalAmount` and `bom.unitPrice` effective configs. So `isPriceSensitiveNull` returns false (line `if (field.extra?.priceSensitive !== true) return false`), and cell falls through to `formatCell()` which returns the formatter's default `-` for null currency input.

Backend strip independently verified working: raw call to `/api/mobile/F001/sales/orders?page=1&size=5` as warehouse_mgr1 returns `"totalAmount": null` (and `discountAmount`, `taxAmount`, `paidAmount`, etc.). So the `@PriceSensitive` annotation on `SalesOrder.totalAmount` IS firing. Only the Vue defense path is broken.

Two non-exclusive hypotheses:
- **H-A: Deploy gap** — test env Java 10011 was built before commit `5ee8720c29` merged to main. The `buildEffectiveFields` allowlist update isn't in the running JAR.
- **H-B: Migration gap** — `V20260513_01` not applied to `cretas_db.module_schemas` row for F001 (or applied to a non-F001 row, e.g. factory-default while F001 has an unrefreshed override).

Cannot distinguish H-A vs H-B from outside (no `/actuator/info` exposed; no `flyway_schema_history` query path). **Need direct DB / server-side check before remediation**:
```sql
SELECT factory_id, module_code, jsonb_path_query_array(fields, '$[*] ? (@.code == "totalAmount").extra.priceSensitive')
FROM module_schemas WHERE module_code='sales_order' AND (factory_id IS NULL OR factory_id='F001');
SELECT installed_rank, version, script, success FROM flyway_schema_history WHERE script LIKE '%price_sensitive%';
```
And `gh pr view 447 --json mergeCommit` cross-checked against `git rev-parse HEAD` on the deployed Java tree at 47-server.

### Impact

PR #447 was explicitly the chat3 P1-D fix for "F001 sales_order Canvas Dynamic bypasses static-Vue v-if defense" (per PR #442 R1-C deep test). The defense is shipped to main but **not active in test env**. Without the flag plumbing, the new branch in `SchemaTableRenderer.vue` is dead code under any factory in DYNAMIC mode.

---

## BUG-2 — BOM `unitPrice` not stripped for non-procurement roles (sister-site sweep gap from PR #447)

### Symptom

`warehouse_mgr1` raw API call to `/api/mobile/F001/bom/items/PT-F001-001`:
```json
{"productName":"带鱼段","materialName":"带鱼原料","unitPrice":18.5000,"taxRate":13.00,...}
```
Warehouse role sees real `unitPrice` values. No backend strip.

### Root cause

`BomItem.unitPrice` (entity/bom/BomItem.java) has only `@Column(name = "unit_price", precision = 15, scale = 4)` — **no `@PriceSensitive` annotation**. Grep `@PriceSensitive` across all entities/DTOs:

```
SalesOrder.totalAmount     @PriceSensitive ✅
SalesOrderItem (price)     @PriceSensitive ✅
PurchaseOrder.totalAmount  @PriceSensitive ✅
PurchaseOrderItem          @PriceSensitive ✅
PurchaseReceiveItem        @PriceSensitive ✅
PurchaseReceiveRecord      @PriceSensitive ✅
MaterialBatchDTO           @PriceSensitive ✅
MaterialBatch              @PriceSensitive ✅
BomItem.unitPrice          ❌ MISSING
BomCostSummaryDTO.unitPrice ❌ MISSING (3 occurrences, also leaks via /bom/cost-summary)
```

`BomCostSummaryDTO` is the `/api/mobile/F001/bom/cost-summary/{productId}` response — also returns plaintext unitPrice + computes subtotal + materialCosts to warehouse role. Both endpoints leak.

### Cross-reference to PR #447 description

PR #447 commit body:
> Migration verified on test cretas_db: 3 UPDATE 1, idempotent on re-run. Sweep verdicts for 14 other Canvas Dynamic modules documented inline (deferred for finance_ar/ap because warehouse can't reach those endpoints today; no other modules have listVisible price columns).

The migration tagged `bom.unitPrice` as `priceSensitive=true` in `module_schemas`, but the corresponding backend annotation was not added. The "sweep" PR #447 claims is incomplete: it covered the schema-flag layer but skipped the `@PriceSensitive` annotation layer on `BomItem` / `BomCostSummaryDTO`. This violates the HARD rule `narrow_scope_fix_sister_site_sweep` (fix one site → sweep all sisters within scope).

### Impact

`/bom/items/{productId}` and `/bom/cost-summary/{productId}` leak supplier unit pricing to any role with BOM read permission — including warehouse_manager, operator, quality_inspector. The Vue defense in SchemaTableRenderer can't catch this because (a) BOM page is in LEGACY mode for F001 so SchemaTableRenderer never renders, and (b) even if it did, the value is non-null so `isPriceSensitiveNull` would return false.

---

## Observation — procurement/orders defense (case 2) works, but not via PR #447

`warehouse_mgr1 → /procurement/orders` correctly shows 10 `<span class="price-masked">—</span>` cells in 总金额 column. Screenshot: `warehouse-mgr-procurement-orders.png`. Defense IS firing.

However: F001's `/api/mobile/F001/config/modules/purchase_order/effective` returns `renderingMode: "LEGACY"`. The page therefore renders the legacy hardcoded `procurement/orders/list.vue` template, whose existing `v-if="row.totalAmount != null"` defense (added in PR #423) handles the stripped null. **PR #447's SchemaTableRenderer code path is never exercised here.** Result: this case validates PR #423/#443 defenses, not PR #447.

This is a coverage gap, not a regression — but it means PR #447's net contribution in the current test env state is zero across all 3 verified pages.

---

## Network + console hygiene (all 6 cases + retest)

- 0 console errors (`page.on('console', msg => msg.type() === 'error')` returned empty array for every case)
- 0 5xx network responses (all `/api/mobile/*` returned 2xx or expected 4xx)
- 0 redirect to `/403` or `/login` (warehouse role reached all 3 pages without being rejected)

## Side-finding (out of scope, flagged for future audit)

The sales/orders page top KPI cards (`POS 交易概览`) show `¥20,639,884.52` aggregate revenue + `¥146,86` average to **warehouse_mgr1** (visible in `warehouse-mgr-sales-orders-v2.png` top banner). These come from a separate gold finance summary endpoint (`/api/smartbi/gold/finance` per `sales/orders/list.vue:17`) which appears to bypass `@PriceSensitive`. Not in scope for PR #447 verification — but worth a follow-up audit ticket.

---

## Evidence files

```
docs/qa-audits/2026-05-12-canvas-dynamic-rbac-e2e-evidence/
├── results.json                              (initial 6-case run dump)
├── retest-warehouse-sales.json               (extended-wait re-run for case 1)
├── warehouse-mgr-sales-orders.png            (case 1 — still-loading screen, timing issue, superseded by v2)
├── warehouse-mgr-sales-orders-v2.png         (case 1 — actual render, shows "-" hyphens)
├── warehouse-mgr-procurement-orders.png      (case 2 — em-dashes via legacy path)
├── warehouse-mgr-bom.png                     (case 3 — real prices, no defense)
├── admin-sales-orders.png                    (case 4 — real values, control)
├── admin-procurement-orders.png              (case 5 — real values, control)
├── admin-bom.png                             (case 6 — real values, control)
└── scripts/
    ├── test-canvas-dynamic-rbac.mjs          (initial 6-case sweep)
    └── retest-warehouse-sales.mjs            (extended-wait re-run for case 1)
```

Test scripts: `scripts/test-canvas-dynamic-rbac.mjs` (initial 6-case sweep) + `scripts/retest-warehouse-sales.mjs` (extended-wait re-run for case 1). Both are self-contained Playwright/chromium scripts; resolve `playwright` via main-worktree `node_modules` junction (`mklink /J node_modules C:\Users\Steve\my-prototype-logistics\web-admin\node_modules`).

---

## Recommended next steps (NOT taken — pending Steve direction per Rule 8/9 STOP)

1. **Diagnose BUG-1 deploy-vs-migration gap**: on 47-server (test env Java host), check the running JAR's `FactoryConfigServiceImpl#buildEffectiveFields` for the `priceSensitive` allowlist line, AND check `flyway_schema_history` for `V20260513_01`. Pick remediation path based on which is missing.
2. **Fix BUG-2 (BOM @PriceSensitive)**: add `@PriceSensitive` to `BomItem.unitPrice` and all 3 occurrences in `BomCostSummaryDTO`. New PR, follow-up to #447. Add a sweep test (`grep @PriceSensitive` reconciled against `module_schemas` rows where `priceSensitive=true`) to catch this class of drift.
3. **Re-run this E2E** once both fixes are deployed — cases 1, 3 should flip to ✅. Case 2 stays ✅ via existing path.
4. **Consider sister-site sweep audit** on the other 14 Canvas Dynamic modules documented as "no listVisible price columns" — verify by direct schema dump rather than trusting PR #447's inline sweep notes.
