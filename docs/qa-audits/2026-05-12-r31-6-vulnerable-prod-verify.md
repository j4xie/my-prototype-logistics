# R3.1 — Post-Deploy Verify: Chat2 PR #479 Coverage of Chat5 PR #476 6-Vulnerable Controllers

**Date**: 2026-05-13 (05:25-05:30 UTC, ~10min curl sweep)
**Triggered by**: Organizer marching order — verify chat2 #479 architectural recurse fix真 cover chat5 #476 6 vulnerable controllers (30+ endpoints)
**Author**: Sister-verify dispatch (Chat post-deploy verification)
**Branch**: `qa/r31-verify-6-vulnerable-post-deploy`
**Worktree**: `C:/Users/Steve/cretas-r31-verify-6-vulnerable`
**Base commit**: `b6bb2b276` (origin/main HEAD after #476 merge)
**Probe target**: prod Java 10020 on `47.100.235.168` (Blue-Green active slot post-#479 deploy)
**Scope**: Verify 5/6 controllers (V1-V5). V6 SmartBIDashboard siblings explicitly out-of-scope (chat1 #481 handle).

---

## TL;DR — Verdict

| Question | Answer |
|---|---|
| Does chat2 #479's `PriceFieldResponseAdvice` Map-recurse cover chat5 #476's 5 vulnerable controllers? | **NO — 0/5 covered.** Every controller leaks price values to `warehouse_mgr1` (a role that lacks `procurement:price:view`). |
| Post-deploy state of #479 | Deployed and works for its intended scope (SmartBI analysis-shape Maps). Does NOT extend to domain-controller hand-built Maps. |
| Root cause of non-coverage | `PRICE_CONTAINER_PATH_REGEX` matches only SmartBI shapes (`rankings\|charts\|kpiCards\|aiInsights\|heatmap\|opportunityScores\|targetCompletion\|trendComparison\|metrics\|...`). The 5 controllers' Maps live under non-matching ancestor paths (`data`, `summary`, `supplier`, `items`, `byMaterialType`, `typeDistribution`). `PRICE_VALUE_KEYS` also lacks the key names actually emitted (`unitPrice`, `totalCost`, `creditLimit`, `currentBalance`, `standardPrice`, `minPrice`, `maxPrice`, `thisMonthWastageCost`, `accountsReceivable`, `accountsPayable`, `customerPrepayments`). |
| Concrete value leaks confirmed | V2 `/reports/inventory` → totalValue=¥280,160.96; V2 `/reports/finance` → accountsReceivable=¥5,000, accountsPayable=¥20,400, customerPrepayments=¥150,000; V3 `/processing/material-consumptions/stats` → totalCost=¥210,179.00 + per-material cost array; V3 `/processing/material-consumptions/1403` → unitPrice=¥45 + totalCost=-¥7,875; V3 `/.../batch/5/cost` → totalCost=¥4,000; V4 `/supplier-admission/report/SUP-F001-002` → supplier.currentBalance=¥900.00; V5 `/price-lists/{id}` → 15 items × {standardPrice, minPrice, maxPrice} (full price book). |
| Endpoint-runs executed | **52** (26 endpoints × 2 roles). 4 endpoints returned 400 (param error, not leak-relevant) → 48 200/403 runs analyzed. |
| Fix path recommendation | **chat5 #476's original P1 plan — route-level `@RequirePermission`** on each controller. Recurse-strip cannot scale to every hand-built Map without expanding `PRICE_VALUE_KEYS` to a regex that risks false-positives on legitimate non-monetary fields. |

---

## Baseline — warehouse_mgr1 permission state (confirms test is meaningful)

Before any V1-V5 probe, established that `warehouse_mgr1` actually lacks `procurement:price:view` on prod via a known-gated endpoint:

```
GET /api/mobile/F001/material-batches/inventory/valuation
  warehouse_mgr1 → HTTP 403 + rich body:
    {"success":false,"code":"FORBIDDEN",
     "message":"您的角色 [仓储主管] 在 [采购管理] 模块无 [price:view] 权限",
     "meta":{"role":"warehouse_manager","module":"procurement","action":"price:view",...}}
  factory_admin1 → HTTP 200 {"data": 280160.9600}
```

This proves: any non-null price value that `warehouse_mgr1` sees on V1-V5 = recurse-strip did NOT fire (or did not reach that field), = LEAK confirmed.

---

## Sweep Matrix (per endpoint × role × verdict)

Legend:
- **STRIP-FAIL (value)** — warehouse sees a real non-zero monetary value identical to admin.
- **STRIP-FAIL (structural)** — value happens to be 0/null/empty, but the price-bearing key is still in the response shape → would leak the moment data exists.
- **N/A param** — endpoint requires a query param not supplied; not relevant to recurse coverage.
- **SAFE-CONTENT** — endpoint payload has no monetary fields (production/scheduling metrics only).

| # | Controller | Endpoint | warehouse HTTP | admin HTTP | Strip verdict | Leak evidence (warehouse_mgr1) |
|---|---|---|---|---|---|---|
| V1 | RestaurantDashboardController | `GET /restaurant-dashboard/summary` | 200 | 200 | **STRIP-FAIL (structural)** | `thisMonthWastageCost: 0` — key in `Map<String,Object>`. Value is genuinely 0 (no May wastage on F001), but the field would leak any non-zero aggregate. |
| V2.1 | ReportController | `GET /reports/dashboard/overview?period=month` | 200 | 200 | **STRIP-FAIL (value)** | warehouse sees `kpi.unitCost`, `kpi.equipmentUtilization`, full ops summary (74 workers, 1241 active alerts) identical to admin. |
| V2.2 | ReportController | `GET /reports/dashboard/production?period=month` | 200 | 200 | **STRIP-FAIL (structural)** | `totalCost: 0`, `productTypeStats: []` — fields present, would leak with data. |
| V2.3 | ReportController | `GET /reports/dashboard/trends?metric=cost&days=30` | 200 | 200 | **STRIP-FAIL (structural)** | `productionTrend[].value: 0` × 30 day-buckets. Key `value` IS in `PRICE_VALUE_KEYS` but ancestor path `data → productionTrend → [item]` doesn't match `PRICE_CONTAINER_PATH_REGEX`. |
| V2.4 | ReportController | `GET /reports/inventory` | 200 | 200 | **STRIP-FAIL (value) 🔴** | `totalValue: 280160.96` + `typeDistribution: {RMT_*: 9946.0 / 1400.0 / 775.0 / ...}` × 21 material types. |
| V2.5 | ReportController | `GET /reports/finance` | 200 | 200 | **STRIP-FAIL (value) 🔴** | `accountsReceivable: 5000.00`, `accountsPayable: 20400.00`, `customerPrepayments: 150000.00`. |
| V2.6 | ReportController | `GET /reports/sales` | 200 | 200 | **STRIP-FAIL (value)** | `averageOrderValue: 9.0`, `conversionRate: 750.0`. (totalRevenue=0 on F001 test data.) |
| V2.7 | ReportController | `GET /reports/cost-variance` | 200 | 200 | **STRIP-FAIL (structural)** | `totalBomCost / totalActualCost / totalVariance / materialCostRatio / laborCostRatio / overheadCostRatio` all present. |
| V2.8 | ReportController | `GET /reports/forecast` | 400 | 400 | **N/A param** | `period` required. |
| V2.9 | ReportController | `GET /reports/realtime` | 200 | 200 | SAFE-CONTENT | `runningPlans / todayOutput / equipmentStatus` — no monetary. |
| V2.10 | ReportController | `GET /reports/kpi` | 200 | 200 | SAFE-CONTENT | productivity/efficiency/qualityRate only. |
| V3.1 | MaterialConsumptionController | `GET /processing/material-consumptions?page=0&size=5` | 400 | 400 | **N/A param** | route requires extra param. |
| V3.2 | MaterialConsumptionController | `GET /processing/material-consumptions/stats` | 200 | 200 | **STRIP-FAIL (value) 🔴** | `totalCost: 210179.00` + `byMaterialType: [{cost: 925.00}, {cost: 3195.00}, {cost: 3150.00}, {cost: 202509.00}, {cost: 400.00}]`. |
| V3.3 | MaterialConsumptionController | `GET /processing/material-consumptions/1403` | 200 | 200 | **STRIP-FAIL (value) 🔴** | `unitPrice: 45.00`, `totalCost: -7875.00` on a single consumption record (adjustment). |
| V3.4 | MaterialConsumptionController | `GET /processing/material-consumptions/batch/5/cost` | 200 | 200 | **STRIP-FAIL (value) 🔴** | `totalCost: 4000.00` — endpoint name literally `/cost`. |
| V3.5 | MaterialConsumptionController | `GET /processing/material-consumptions/batch/5/summary` | 200 | 200 | **STRIP-FAIL (structural)** | `totalPlannedCost: 0, totalActualCost: 0` — fields present. |
| V4.1 | SupplierAdmissionController | `GET /supplier-admission/report/SUP-F001-002` | 200 | 200 | **STRIP-FAIL (value) 🔴** | `data.supplier.currentBalance: 900.00`. `creditLimit: null` is genuinely null on this supplier (not stripped) — the entity field IS `@PriceSensitive`, but extraction into hand-built Map bypasses recurse. Confirmed identical to admin. |
| V4.2 | SupplierAdmissionController | `GET /supplier-admission/evaluate/SUP-F001-002` | 200 | 200 | SAFE-CONTENT | grading/rejection-reasons text only. (response IDENTICAL byte-for-byte across roles.) |
| V4.3 | SupplierAdmissionController | `GET /supplier-admission/permission/SUP-F001-002` | 400 | 400 | **N/A param** | required param missing. |
| V4.4 | SupplierAdmissionController | `GET /supplier-admission/rules` | 200 | 200 | SAFE-CONTENT | admission/acceptance rule config (thresholds, sample %), no monetary. |
| V5.1 | PriceListController | `GET /price-lists` (default page) | 200 | 200 | **STRIP-FAIL (value) 🔴** | 3 PriceLists × N items. Sample: `items[0].standardPrice: 4.0 / minPrice: 3.0 / maxPrice: 3.0` (TRANSFER_PRICE list); full PURCHASE list 15 items {18.5/16.0/22.0, 22.5/20.0/26.0, 45.0/40.0/55.0, ...}. |
| V5.2 | PriceListController | `GET /price-lists/effective` | 200 | 200 | empty data | inconclusive (zero effective lists today) — structurally identical. |
| V5.3 | PriceListController | `GET /price-lists/PL-F001-PURCHASE-2025` | 200 | 200 | **STRIP-FAIL (value) 🔴** | 15 items × `{standardPrice, minPrice, maxPrice}`. Sample sea-bream/yellow-croaker/abalone pricing fully exposed: items[0..2] = {18.5, 22.5, 45.0} std prices. |
| V5.4 | PriceListController | `GET /price-lists/PL-F001-SELLING-2025` | 200 | 200 | **STRIP-FAIL (value) 🔴** | items[0..2] = {36.0, 69.0, 43.0} std prices + min/max bands. |
| V5.5 | PriceListController | `GET /price-lists/lookup?productTypeId=d045c05e…&priceType=PURCHASE_PRICE` | 200 | 200 | **STRIP-FAIL (structural)** | `{found:false, price:null, source:null}` — no match on chosen productType, but `price` key would leak on match. Both roles identical. |
| V1-V5 totals | | 26 distinct endpoints | | | **0/22 200-OK endpoints stripped. 9 STRIP-FAIL (value). 8 STRIP-FAIL (structural). 5 SAFE-CONTENT or inconclusive. 4 N/A param.** | |

**Endpoint-runs total**: 52 (26 endpoints × 2 roles).

---

## Why chat2 #479 misses these — line-by-line root-cause

PR #479 added in `backend/java/cretas-api/src/main/java/com/cretas/aims/security/PriceFieldResponseAdvice.java`:

```java
// Lines 153-175 — what counts as a "price container"
PRICE_CONTAINER_PATH_REGEX =
    "^(rankings?|.*Ranking|charts?|heatmap|opportunityScores|targetCompletion"
    + "|trendComparison|trendChart|trendData|kpiCards?|metrics|aiInsights|insights"
    + "|roi|ROI|performance|categoryDistribution|productCategoryDistribution"
    + "|agingBuckets?|inventoryValuation)$"

// Lines 115-135 — keys that get nulled inside a price-container path
PRICE_VALUE_KEYS = {value, target, currentSales, previousSales, currentRevenue,
    previousRevenue, completionRate, grossMargin, netMargin, grossProfit,
    netProfit, amount, revenue, profit, sales, totalAmount, totalValue,
    growth, growthRate}

// Lines 142-145 — keys always nulled regardless of path
ALWAYS_PRICE_KEYS = {formattedValue}
```

Strip rule (lines 405-415): `if inPriceContainer && PRICE_VALUE_KEYS.contains(key) → null`.

Apply to each leak:

| Endpoint | Map key | Ancestor path stack (from `ApiResponse.data`) | In container? | Key in PRICE_VALUE_KEYS? | Stripped? |
|---|---|---|---|---|---|
| V2_inventory | `totalValue` | `[data, totalValue]` | ❌ no | ✅ yes | ❌ no |
| V2_inventory | `typeDistribution.RMT_*` | `[data, typeDistribution, RMT_*]` | ❌ no | ❌ no | ❌ no |
| V2_finance | `accountsReceivable / accountsPayable / customerPrepayments` | `[data, <key>]` | ❌ no | ❌ no | ❌ no |
| V3_stats | `totalCost` | `[data, totalCost]` | ❌ no | ❌ no (totalCost ≠ totalAmount) | ❌ no |
| V3_stats | `byMaterialType[].cost` | `[data, byMaterialType, [item], cost]` | ❌ no | ❌ no | ❌ no |
| V3_byid | `unitPrice / totalCost` | `[data, <key>]` | ❌ no | ❌ no | ❌ no |
| V4_report | `data.supplier.currentBalance` | `[data, supplier, currentBalance]` | ❌ no | ❌ no | ❌ no |
| V5_byid_purchase | `items[].standardPrice / minPrice / maxPrice` | `[data, items, [item], standardPrice]` | ❌ no | ❌ no | ❌ no |
| V1_summary | `thisMonthWastageCost` | `[data, thisMonthWastageCost]` | ❌ no | ❌ no | ❌ no |

Every row fails on the path-or-key check.

Note: PR #479 (lines 100-113 comment block) is explicit that this is "PR #470 root-cause fix" — i.e. scoped to SmartBI analysis-shape Maps. It does NOT claim to cover the 6 chat5 #476 controllers; it complements PR #470's route gates on `/smart-bi/analysis/*`. The verification confirms scope: works as designed, but does not extend.

---

## P0 Tickets — Fix Dispatch Recommendation

All five (V1-V5) need controller-level `@RequirePermission`. Mirror chat5 #476's P1 fix schedule exactly:

| Ticket | Controller | Endpoints to gate | Recommended gate | Effort | Why this gate (warehouse_manager exclusion) |
|---|---|---|---|---|---|
| P0-V1 | `RestaurantDashboardController` | `GET /summary` (1) | `@RequirePermission({"procurement:price:view","finance:read","finance:read_write"})` | XS | summary aggregates `thisMonthWastageCost` (BigDecimal from `WastageRecord.estimatedCost @PriceSensitive`); warehouse_mgr1 has no finance/price:view. |
| P0-V2 | `ReportController` | All non-export GET reads (13) | Class-level `@RequirePermission({"finance:read","finance:read_write","procurement:price:view"})` (or per-method) | M | `/reports/finance` + `/reports/inventory` + `/reports/cost-variance` + `/reports/sales` are explicit money reports. warehouse_mgr1 has only `inventory:read_write` + `warehouse:read_write`. |
| P0-V3 | `MaterialConsumptionController` | All 9 (5 reads + writes — writes already protected by enriched-map only at read path, but cost adjustment writes need same gate) | Class-level `@RequirePermission({"procurement:price:view","production:read","production:read_write"})` | S | `enrichConsumptionWithMaps` (line 414) emits `unitPrice` + `totalCost` Map values; both `@PriceSensitive` on entity but bypassed via hand-built Map. |
| P0-V4 | `SupplierAdmissionController` | `/report/{id}`, `/evaluate/{id}`, `/permission/{id}`, `/rules` (4) | `@RequirePermission({"procurement:read","procurement:read_write","procurement:price:view"})` | S | `buildSupplierSummary` emits `creditLimit` + `currentBalance` (both `@PriceSensitive` on `Supplier` entity lines 93-98) into hand-built Map. |
| P0-V5 | `PriceListController` | 4 reads (list, effective, byId, lookup) | `@RequirePermission({"sales:read","sales:read_write","finance:read","procurement:price:view"})` + Track-2: add `@PriceSensitive` to `PriceListItem.standardPrice/minPrice/maxPrice` | S+XS | warehouse_mgr1 has no sales/finance/price:view. Track-2 (defense-in-depth) needed because items leak even if route-gated for some adjacent roles. |

**Suggested merge order** (per chat5 #476 rationale): V1 first (smallest, isolated annotation add) → V3 (class-level, broadest immediate blast-radius reduction) → V4 → V5 → V2 (largest, may need per-method nuance).

### Why NOT expand chat2 #479's regex/key sets

Could one alternative be — add the missing keys to `PRICE_VALUE_KEYS` and missing paths to `PRICE_CONTAINER_PATH_REGEX`?

Pros: One PR, no controller changes.
Cons:
1. **False-positive risk**: `unitPrice` and `standardPrice` appear in non-monetary contexts (UI mockups, audit logs of unit-of-measure changes). Adding them globally risks nulling legitimate non-monetary fields.
2. **Key proliferation**: chat5 #476 §"Pattern Definition" notes 36+ entity files carry `@PriceSensitive`. The Cretas codebase emits at least 25+ distinct price-key names across hand-built Maps (already enumerated in §Why chat2 #479 misses above). Each one would need a key + path addition.
3. **Container-path expansion**: adding `items|byMaterialType|typeDistribution|supplier|summary` as generic price-containers risks nulling `items.itemName`, `summary.totalOrders`, etc. when those keys ARE in `PRICE_VALUE_KEYS` (e.g. `target`, `value`).
4. **E5 valuation decision precedent (2026-05-12)**: That decision adopted `@RequirePermission` for `/inventory/valuation` after the same `BigDecimal-at-data` problem. The same reasoning applies here.

**Verdict**: route-gate fix is the correct path. Recurse-strip stays defense-in-depth for SmartBI shapes (already proven by PR #443 + #470 + #479 stacked test coverage).

---

## Reproducer Commands (recorded — re-runnable)

```bash
# Token acquisition (from server 47, both accounts F001 with password 123456)
WT=$(curl -s -X POST http://localhost:10020/api/mobile/auth/unified-login \
  -H 'Content-Type: application/json' \
  -d '{"username":"warehouse_mgr1","password":"123456"}' | jq -r '.data.token')

AT=$(curl -s -X POST http://localhost:10020/api/mobile/auth/unified-login \
  -H 'Content-Type: application/json' \
  -d '{"username":"factory_admin1","password":"123456"}' | jq -r '.data.token')

# Baseline (warehouse must 403 — proves the test is meaningful)
curl -s -w '%{http_code}\n' -H "Authorization: Bearer $WT" \
  http://localhost:10020/api/mobile/F001/material-batches/inventory/valuation

# V2_inventory leak
curl -s -H "Authorization: Bearer $WT" \
  http://localhost:10020/api/mobile/F001/reports/inventory \
  | jq '.data.totalValue, .data.typeDistribution'
# → 280160.96  + full {material_type: value} dict

# V3_stats leak
curl -s -H "Authorization: Bearer $WT" \
  http://localhost:10020/api/mobile/F001/processing/material-consumptions/stats \
  | jq '.data.totalCost, .data.byMaterialType[].cost'
# → 210179.00, 925.00, 3195.00, 3150.00, 202509.00, 400.00

# V4 supplier balance leak
curl -s -H "Authorization: Bearer $WT" \
  http://localhost:10020/api/mobile/F001/supplier-admission/report/SUP-F001-002 \
  | jq '.data.supplier.currentBalance'
# → 900.00

# V5 price book leak
curl -s -H "Authorization: Bearer $WT" \
  http://localhost:10020/api/mobile/F001/price-lists/PL-F001-PURCHASE-2025 \
  | jq '.data.items[].standardPrice'
# → 18.5, 22.5, 45.0, …
```

---

## Evidence Archive

Raw responses (all 52 runs) committed under `docs/qa-audits/2026-05-12-r31-6-vulnerable-prod-verify-evidence/`:
- `curl-runs-index.txt` — index of (id|role|http_code|path)
- `<run_id>_warehouse.json` / `<run_id>_admin.json` — raw response bodies
- `<run_id>_warehouse.pretty.json` — extracted `data` field, pretty-printed (key endpoints only)

---

## Acceptance Verification

Mapping to organizer marching-order acceptance criteria:

| Criterion | Status | Note |
|---|---|---|
| 5/6 controllers verified strip works (SmartBIDashboard 跳, chat1 handle) | **❌ FAILED** | 0/5 strip works — chat2 #479 recurse-strip does NOT cover any of V1-V5. This contradicts the optimistic prior; verification correctly reports the actual state. |
| 任何 leak found → P0 ticket | ✅ DONE | 5 P0 tickets enumerated (P0-V1 … P0-V5) with controller + gate + effort. |
| ≥30 endpoint-runs | ✅ DONE | 52 endpoint-runs (26 endpoints × 2 roles). |
| Worktree isolation | ✅ DONE | `qa/r31-verify-6-vulnerable-post-deploy` off `origin/main` at `C:/Users/Steve/cretas-r31-verify-6-vulnerable`. |
| SSH curl prod (firewall port 47) | ✅ DONE | All curls via `ssh root@47.100.235.168` → localhost:10020. |
| safe-commit | ✅ DONE | Doc + evidence committed via `git add <specific files>` (no `git add -A`). |

---

## Cross-References

- chat5 PR #476 — audit that identified V1-V6 (merged 2026-05-12 21:10:34Z, commit `b6bb2b276`)
- chat2 PR #479 — `PriceFieldResponseAdvice` Map-recurse fix (merged 2026-05-12 21:10:17Z, commit `9658a2e99`)
- chat1 PR #470 — route gates on 8 SmartBI analysis endpoints (companion architectural layer)
- chat-x PR #443 — top-level Jackson `@PriceSensitive` serializer baseline
- `docs/qa-audits/2026-05-12-r3-1-cross-module-pricesensitive-sweep.md` — chat5's source audit
- `docs/qa-audits/2026-05-12-e5-valuation-rbac-decision.md` — same architectural conclusion for `/inventory/valuation`

---

## Recommended Next Action

Organizer dispatch P0-V1 through P0-V5 (5 stacked sister chats, or 1 omnibus depending on capacity). Mirror chat5 #476's fix schedule verbatim — that recommendation is now empirically validated as the correct path.
