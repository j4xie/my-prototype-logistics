# R3.1 Chat C — Cross-Module `@PriceSensitive` Recurse-Failure Sweep

**Date**: 2026-05-12
**Triggered by**: PR #470 R3.1 cascade dispatch recommendation — Chat C "Cross-module sweep for any other endpoint relying solely on `@PriceSensitive` without controller-level role check"
**Author**: Sister-sweep dispatch (Chat 5) off PR #470
**Branch**: `qa/r31-cross-module-sweep`
**Base commit**: `b2aeb69dd` (HEAD of origin/main after PR #473)
**Scope**: Audit ONLY. No code changes. Hand-off list to chat1 R3.1 Chat A / cross-domain follow-ups.

---

## TL;DR

| Question | Answer |
|---|---|
| Architectural pattern detected | `@PriceSensitive` recurse strips **fields on project entities** only; hand-built `Map<String, Object>` whose values are JDK types (BigDecimal/String/Double) are **invisible to recurse** because `isJdkType()` short-circuits. Controllers in this shape MUST add `@RequirePermission` / `@RequireRole` (mirror `/drill-down` template). |
| Controllers checked | **30+** (Tier 1 analytics/dashboard + Tier 2 money-domain CRUD) |
| 🔴 VULNERABLE controllers found | **6 (excluding chat1's 8 SmartBI analysis endpoints already in PR #470)** |
| 🔴 Vulnerable endpoint count | **30+** individual endpoint methods |
| 🟡 NEEDS-VERIFY | **4** controllers (5+ endpoints) — depend on service-layer return shape |
| ✅ SAFE | **15+** controllers (class- or method-level `@RequirePermission` / `@RequireRole` gates already present) |
| Relation to PR #470 | Chat1 covered SmartBI **analysis** layer. This sweep covers Java side **outside** that scope: report, dashboard, dashboard-sibling, factory-domain CRUD aggregations. |
| Relation to E5 valuation decision (2026-05-12) | Same architectural conclusion as `docs/qa-audits/2026-05-12-e5-valuation-rbac-decision.md`: strip-only cannot protect naked scalars or hand-built Maps; must layer `@RequirePermission`. |

---

## Pattern Definition (Recurse-Failure Class)

A controller method is **vulnerable** when ALL three hold:

1. **Return shape contains 金额/price values in a structure the recurse cannot reach**:
   - `Map<String, Object>` with `BigDecimal` / `Double` / `String` values built by hand (e.g. `result.put("totalCost", supplier.getCreditLimit())`)
   - `List<Map<String, Object>>` rankings / charts / aiInsights produced by raw SQL projections (`getResultList()` returning `List<Object[]>`)
   - Hand-constructed DTOs whose price fields lack `@PriceSensitive`
   - Raw `BigDecimal` at `$.data` (no field path to null out — see E5 valuation decision)

2. **Controller method (or class) lacks `@RequirePermission` / `@RequireRole`** gating `warehouse_manager`-like roles.

3. **The endpoint surfaces 金额/price information** that warehouse_manager / operator / quality_inspector should NOT see per the procurement:price:view permission model.

The reference correct pattern is `SmartBIAnalysisController.drillDown` (line 197-198):
```java
@RequirePermission({"analytics:read_write"})
@PostMapping("/drill-down")
```
…and `MaterialBatchController.getInventoryValuation` (post-fix per E5 valuation decision):
```java
@RequirePermission({"procurement:price:view"})
@GetMapping("/inventory/valuation")
```

**Why strip-only is fundamentally insufficient here**: `PriceFieldResponseAdvice.stripPriceFields()` checks `isJdkType(clazz)` (line 208) and returns immediately for `java.math.BigDecimal`. The recurse walks `Map.values()` (line 191-196) but cannot null out a value that is itself a BigDecimal — there is no `@PriceSensitive`-annotated *field* on a Map entry. Only fields on classes in `com.cretas.aims.*` can be stripped. So `{"creditLimit": 50000.0}` constructed from `supplier.getCreditLimit()` leaks even when `Supplier.creditLimit` IS `@PriceSensitive`.

---

## 🔴 VULNERABLE Controllers (Immediate P1 Fix Candidates)

### V1 — `RestaurantDashboardController.summary` (1 endpoint)

**File**: `backend/java/cretas-api/src/main/java/com/cretas/aims/controller/restaurant/RestaurantDashboardController.java`

| Endpoint | Line | Gate | Leak |
|---|---|---|---|
| `GET /api/mobile/{factoryId}/restaurant-dashboard/summary` | 30 | ❌ NONE | `thisMonthWastageCost` (BigDecimal, line 66 of service) put into hand-built `LinkedHashMap`. `WastageRecord.estimatedCost` IS `@PriceSensitive` but `wastageRepository.getTotalEstimatedCost(...)` returns aggregated `BigDecimal` that becomes a Map value (JDK leaf → recurse skips). |

**Service evidence** (`service/impl/RestaurantDashboardServiceImpl.java:56-66`):
```java
BigDecimal thisMonthWastageCost = wastageRepository.getTotalEstimatedCost(factoryId, monthStart, today);
...
result.put("thisMonthWastageCost", thisMonthWastageCost);
```

**Fix template**:
```java
@RequirePermission({"procurement:price:view", "finance:read", "finance:read_write"})
```

---

### V2 — `ReportController` (10+ endpoints, ZERO gates)

**File**: `backend/java/cretas-api/src/main/java/com/cretas/aims/controller/ReportController.java`

NO class-level `@RequirePermission`. Of 25 methods, **zero** non-export endpoints have a method-level role gate.

| Endpoint | Line | Leak likelihood |
|---|---|---|
| `GET /reports/dashboard/overview?period=today\|week\|month` | 49 | HIGH — Map<String, Object> from `reportService.getDashboardOverview` (commonly includes revenue/cost summary cards) |
| `GET /reports/dashboard/production?period=…` | 61 | MED — production stats; can include cost-per-unit |
| `GET /reports/dashboard/trends?metric=cost&days=30` | 107 | HIGH — `metric` param explicitly supports `cost` |
| `GET /reports/inventory` | 141 | HIGH — inventory report typically includes valuation |
| **`GET /reports/finance`** | 156 | HIGH 🔴 — explicit finance report |
| **`GET /reports/sales`** | 193 | HIGH 🔴 — explicit sales report |
| **`GET /reports/cost-variance`** | 417 | HIGH 🔴 — `CostVarianceReportDTO` — explicit cost report |
| `GET /reports/forecast` | 271 | HIGH — predictive cost/revenue |
| `GET /reports/custom` | 361 | UNKNOWN — user-defined |
| `GET /reports/realtime` | 374 | MED — operational; may include cost flow |
| `GET /reports/efficiency-analysis` | 215 | LOW — likely quantity-based |
| `GET /reports/kpi`, `/kpi-metrics`, `/oee`, `/anomalies`, `/period-comparison`, `/capacity-utilization`, `/on-time-delivery` | various | MED — KPI dashboards typically embed cost metrics |
| `GET /reports/production-by-product` | 125 | LOW — quantity-based DTO |

**Note**: Excel/PDF export endpoints (`/export/excel` line 308, `/export/pdf` line 333) DO use `PriceMaskResolver` defense-in-depth. Live JSON dashboard/report endpoints do NOT — this is the gap.

**Fix template**: Add class-level `@RequirePermission({"finance:read", "finance:read_write", "procurement:price:view"})` OR per-endpoint gates matching the data scope.

---

### V3 — `MaterialConsumptionController` (9 endpoints, ZERO gates)

**File**: `backend/java/cretas-api/src/main/java/com/cretas/aims/controller/MaterialConsumptionController.java`

NO class-level `@RequirePermission`. 9 methods; only `/batch/{id}/adjust` (line 322) has `@RequireModule("production_plan")` (module gate, NOT role). All read endpoints have ZERO gating.

| Endpoint | Line | Leak detail |
|---|---|---|
| `GET /processing/material-consumptions` (paged list) | 60 | `enrichConsumptionWithMaps` (line 414) hand-builds Map with `map.put("unitPrice", c.getUnitPrice())` (line 426) + `map.put("totalCost", c.getTotalCost())` (line 427). `MaterialConsumption.unitPrice` + `totalCost` ARE `@PriceSensitive` on the entity — but the controller bypasses entity-shape and emits raw BigDecimal Map values. |
| `GET /{id}` (single) | 103 | same enrich path |
| `GET /batch/{productionBatchId}` | 127 | same enrich path |
| `GET /material-batch/{batchId}` | 149 | same enrich path |
| `GET /time-range` | 166 | same enrich path |
| **`GET /stats`** | 191 | `stats.put("totalCost", totalCost)` (line 277) + `byMaterialType` list with `cost` key (line 269) |
| **`GET /batch/{productionBatchId}/cost`** | 287 | `result.put("totalCost", totalCost)` (line 312) — endpoint name explicitly says "cost" |
| `GET /batch/{productionBatchId}/summary` | 353 | `batchConsumptionService.getConsumptionSummary` returns Map<String, Object> — service-side aggregation likely includes cost (needs verify but high likelihood) |
| `POST /batch/{productionBatchId}/adjust` | 323 | write — adjust requires same gate to prevent unauthorized cost adjustment via crafted requests |

**Fix template**: Class-level `@RequirePermission({"procurement:price:view", "production:read_write", "production:read"})` per the procurement:price:view + production roles that warehouse_manager typically lacks.

---

### V4 — `SupplierAdmissionController` (3+ endpoints)

**File**: `backend/java/cretas-api/src/main/java/com/cretas/aims/controller/SupplierAdmissionController.java`

NO class-level `@RequirePermission`. Only write methods (`/evaluate/batch`, `/acceptance-strategy`, `/rules` PUT) have method-level gates.

| Endpoint | Line | Leak detail |
|---|---|---|
| **`GET /supplier-admission/report/{supplierId}`** | 343 | `buildSupplierSummary` (line 390) hand-builds Map with `summary.put("creditLimit", supplier.getCreditLimit())` (line 401) + `summary.put("currentBalance", supplier.getCurrentBalance())` (line 402). Both `Supplier.creditLimit` and `Supplier.currentBalance` ARE `@PriceSensitive` (entity lines 93-98) — but `buildSupplierSummary` extracts the raw BigDecimal into a hand-built Map → recurse cannot strip. |
| `GET /supplier-admission/evaluate/{supplierId}` | 49 | Returns `AdmissionEvaluationResult` — needs-verify to confirm credit-based scoring fields, but high suspicion |
| `GET /supplier-admission/permission/{supplierId}` | 165 | `SupplyPermissionResult` — needs-verify |
| `GET /supplier-admission/rules` | 272 | `SupplierRuleConfig` — needs-verify (admission thresholds may include credit numerics) |

**Fix template**: `@RequirePermission({"procurement:read_write", "procurement:read", "procurement:price:view"})`

---

### V5 — `PriceListController` (4 read endpoints, ZERO gates)

**File**: `backend/java/cretas-api/src/main/java/com/cretas/aims/controller/inventory/PriceListController.java`

Write methods (POST line 45, DELETE line 174) have `@RequirePermission({"sales:read_write", "finance:read_write"})`. ALL read methods have ZERO gating.

| Endpoint | Line | Leak detail |
|---|---|---|
| `GET /price-lists` (list) | 86 | Returns `PageResponse<PriceList>` — `PriceList`/`PriceListItem` are **NOT** in the `@PriceSensitive` annotated set. `standardPrice` / `minPrice` / `maxPrice` on `PriceListItem` are raw BigDecimal entity fields with no annotation → recurse leaves them untouched even on entity returns. |
| `GET /price-lists/effective` | 97 | same — returns full effective price tables |
| `GET /price-lists/{priceListId}` | 105 | same — single price-list detail |
| `GET /price-lists/lookup?customerId=…&productTypeId=…` | 119 | hand-built Map with `result.put("price", price)` (line 163) |

**Compounding problem**: `PriceList` / `PriceListItem` entities are missing `@PriceSensitive` annotations entirely. Two-track fix:
- **Track 1 (immediate)**: Add `@RequirePermission({"sales:read", "sales:read_write", "finance:read", "procurement:price:view"})` to the 4 GET endpoints.
- **Track 2 (architectural)**: Add `@PriceSensitive` to `PriceListItem.standardPrice` / `minPrice` / `maxPrice` for defense-in-depth (warehouse_manager wouldn't typically have sales:read anyway, but follow BUG-2 sweep pattern).

---

### V6 — `SmartBIDashboardController` sibling endpoints (4 endpoints, partial gates)

**File**: `backend/java/cretas-api/src/main/java/com/cretas/aims/controller/SmartBIDashboardController.java`

PR #470 listed `/dashboard/executive` (line 156) as one of the 8 already-flagged leaks. But `SmartBIDashboardController` has **4 sibling endpoints returning the same `DashboardResponse` / `UnifiedDashboardResponse` shape** that chat1's PR #470 did NOT explicitly enumerate.

| Endpoint | Line | Gate | Leak detail |
|---|---|---|---|
| `GET /smart-bi/dashboard/executive` | 156 | ❌ NONE | **Already in PR #470 list** (rankings.region 3 vals) |
| **`GET /smart-bi/dashboard/executive/custom` (start/end date)** | 315 | ❌ NONE | Same `DashboardResponse` from `salesAnalysisService.getSalesOverview` — same kpiCards/charts/rankings/aiInsights shape — same leak. NOT in PR #470 list. |
| **`GET /smart-bi/dashboard`** (unified) | 343 | ❌ NONE | `UnifiedDashboardResponse` aggregates sales+finance+inventory+production+quality+procurement+department+region+alerts+recommendations (lines 533-579) — every dimension is a separate `DashboardResponse`-shape. NOT in PR #470 list. |
| **`POST /smart-bi/analysis/dynamic`** (dynamic analysis) | 453 | ❌ NONE | `DynamicAnalysisService.DashboardResponse` — same KPI/charts/insights shape. NOT in PR #470 list. |
| **`GET /smart-bi/analysis/dynamic/kpis`** | 429 | ❌ NONE | `List<Map<String, Object>>` — hand-built KPI cards including revenue/cost. NOT in PR #470 list. |
| `GET /smart-bi/dashboard/executive/insights` | 188 | ❌ NONE | `List<AIInsight>` — AI text mostly, lower confidence but worth verifying for embedded numbers |
| `GET /smart-bi/dashboard/executive/insights/custom` | 209 | ❌ NONE | Same |
| `GET .../insights/custom/stream` (SSE) | 243 | ❌ NONE | Same (stream variant) |
| `POST /smart-bi/generate-adaptive-charts` | 93 | ✅ `analytics:read_write` | Chart generation (gated) |
| `POST /smart-bi/generate-chart` | 117 | ✅ `analytics:read_write` | Same |

**Conclusion**: When R3.1 Chat A adds `@RequirePermission` to the 8 endpoints PR #470 explicitly listed, it MUST also cover these 5 sibling endpoints with the same shape. Otherwise warehouse_mgr1 (or equivalent) can call `/smart-bi/dashboard` (unified) or `/smart-bi/dashboard/executive/custom` to get the same leak.

**Fix template**: Class-level `@RequirePermission({"analytics:read_write", "analytics:read"})` (recommended over per-method) OR mirror `/drill-down`'s `analytics:read_write` permission on each affected method.

---

## 🟡 NEEDS-VERIFY (Service-layer Confirmation Required)

### N1 — `MaterialBatchController` inventory aggregations

**File**: `backend/java/cretas-api/src/main/java/com/cretas/aims/controller/MaterialBatchController.java`

Most writes are gated (`warehouse:read_write`/`inventory:read_write`). `/inventory/valuation` is correctly gated post-E5 decision (`procurement:price:view`). BUT these reads lack gates:

| Endpoint | Line | Gate | Verify |
|---|---|---|---|
| `GET /material-batches/inventory/statistics` | 691 | ❌ NONE | Service `getInventoryStatistics(factoryId)` returns Map — verify it doesn't include valuation/totalValue/totalCost |
| `GET /material-batches/inventory/alerts` | 816 | ❌ NONE | Map alerts list — `lowStockWarnings` may include `unitPrice` or `lossValue` — verify |
| `GET /material-batches/inventory/expiry-warnings` | 902 | ❌ NONE | Items + summary Maps — likely contain `value`/`cost` for expiring inventory — verify |
| `GET /material-batches/low-stock` | 754 | ❌ NONE | `getLowStockWarnings` Map list — verify cost fields |
| `GET /material-batches/{batchId}/usage-history` | 998 | ❌ NONE | Usage history Map — likely contains `unitPrice` / `lineCost` — verify |
| `GET /material-batches/export` | 1013 | ❌ NONE | Excel export — needs `PriceMaskResolver` wire similar to ReportController exports |

**Verify command**: `grep -E "(totalValue|totalCost|unitPrice|valuation|amount)" backend/java/cretas-api/src/main/java/com/cretas/aims/service/impl/MaterialBatchServiceImpl.java`

---

### N2 — `DisposalController` stats

**File**: `backend/java/cretas-api/src/main/java/com/cretas/aims/controller/DisposalController.java`

| Endpoint | Line | Gate | Verify |
|---|---|---|---|
| `GET /disposal-records/stats` | 273 | ❌ NONE (only `@RequireModule`) | `disposalRecordService.getDisposalStats` returns Map — verify totalLossAmount/totalRecoveryValue inclusion. `DisposalRecord` has `@PriceSensitive` on `estimatedLoss`/`actualLoss`/`recoveryValue` but aggregations bypass entity-shape. |
| `GET /disposal-records/stats/by-type` | 297 | ❌ NONE | `List<Object[]>` from raw SQL — Object[] cells are JDK types → recurse leaves them untouched if contain BigDecimal |

List endpoints `GET /` (line 47) and `GET /{id}` (line 82) return `DisposalRecord` entities directly — `@PriceSensitive` recurse strips annotated fields ✅ SAFE.

---

### N3 — `BomController` change logs + cost summary

**File**: `backend/java/cretas-api/src/main/java/com/cretas/aims/controller/BomController.java`

| Endpoint | Line | Gate | Verify |
|---|---|---|---|
| `GET /bom/items/{productTypeId}/change-logs` | 68 | ❌ NONE | Audit log — verify whether old-vs-new unitPrice values are emitted as raw Map values |
| `GET /bom/cost-summary/{productTypeId}` | 231 | ❌ NONE | Returns `BomCostSummaryDTO` — BUG-2 sweep added `@PriceSensitive` to materialCostTotal/laborCostTotal/overheadCostTotal/totalCost on this DTO (and nested items) → ✅ likely SAFE post-BUG-2. Re-verify after BUG-2 merges. |

---

### N4 — `AlertController` reads

**File**: `backend/java/cretas-api/src/main/java/com/cretas/aims/controller/AlertController.java`

| Endpoint | Line | Gate | Verify |
|---|---|---|---|
| `GET /alerts` | 41 | ❌ NONE | Returns `Page<ProductionAlert>` — `ProductionAlert` is NOT in `@PriceSensitive` list. Verify if alert content contains cost/loss amounts (e.g., "scrap loss of ¥X" in message field) |
| `GET /alerts/summary` | 78 | ❌ NONE | `anomalyDetectionService.getAlertSummary` — Map — verify content |
| `GET /alerts/{alertId}` | 92 | ❌ NONE | Single alert |

Lower confidence than V1-V6 — production alerts are typically equipment/quality, not finance. But worth a 5-minute check.

---

## ✅ SAFE Controllers (Verified — Adequate Gating)

| Controller | Why safe |
|---|---|
| `WageController` | Class-level `@RequirePermission({"hr:read_write", "hr:read", "finance:read"})` (line 53) |
| `ArApController` | Class-level `@RequirePermission("finance:read_write")` (line 35); reads override to allow `finance:read` |
| `InvoiceController` | Class-level `@RequirePermission("finance:read_write")` (line 28); reads allow `finance:read`/`sales:read` |
| `PaymentRecordController` | Class-level `@RequirePermission("finance:read_write")` (line 27) |
| `SalesController` | Per-method `@RequirePermission({"sales:read_write", "sales:read"})` on every endpoint |
| `PurchaseController` | Per-method `@RequirePermission` with `procurement:*` (warehouse_manager lacks) |
| `RdController` | Per-method `@RequirePermission({"rd:read"|"rd:read_write"})` on every endpoint |
| `OperationalQuoteController` (writes) | All write methods gated with `sales:read_write`. Reads return `OperationalQuote` entity — `@PriceSensitive` recurse strips annotated fields |
| `ProductionAnalyticsController` | Returns only quantities/yield/efficiency — no 金额 (verified in `ProductionAnalyticsServiceImpl`) |
| `ProductionProgressDashboardController` | Returns only `plannedQuantity` / `reportedQuantity` / `progressPct` — no 金额 |
| `SchedulingMetricsController` | Returns scheduling efficiency/accuracy/diversity — no 金额 |
| `MaterialBatchController` (entity-returning endpoints) | `/expiring`, `/expired`, `/fefo`, `/fifo`, `/material-type`, `/status` return `MaterialBatch` entity → `@PriceSensitive` recurse strips `unitPrice` (post-PR #423) |
| `DisposalController` (entity endpoints) | `GET /` and `GET /{id}` return `DisposalRecord` entity → recurse strips annotated fields |
| `WastageRecordController` (entity endpoints) | List/detail return `WastageRecord` entity → recurse strips annotated `estimatedCost`/`actualCost` |
| `ShipmentController` (entity endpoints) | List/detail return `ShipmentRecord` entity → recurse strips annotated fields |

---

## Full Sweep Matrix (Quick Reference)

| Controller | Endpoints (total/gated) | Verdict | Notes |
|---|---|---|---|
| ArApController | 12 / 12 | ✅ safe | class-level finance:read_write |
| InvoiceController | 8 / 8 | ✅ safe | class-level finance:read_write |
| PaymentRecordController | 6 / 6 | ✅ safe | class-level finance:read_write |
| SalesController | 13 / 13 | ✅ safe | per-method sales:read[_write] |
| PurchaseController | many / mostly | ✅ safe | per-method procurement:read[_write] |
| WageController | 22 / 22 | ✅ safe | class-level hr+finance |
| RdController | many / all | ✅ safe | per-method rd:read[_write] |
| ProductionAnalyticsController | 10 / 0 | ✅ safe-by-content | no 金额 in service returns |
| ProductionProgressDashboardController | 1 / 0 | ✅ safe-by-content | only quantities |
| SchedulingMetricsController | 5 / 0 | ✅ safe-by-content | only scheduling metrics |
| OperationalQuoteController | 9 / 5 | ✅ safe | reads return entity with @PriceSensitive |
| MaterialBatchController | 28 / 14 | 🟡 partial | valuation gated, but 6 aggregation reads ungated (N1) |
| DisposalController | 11 / 4 | 🟡 partial | entity returns safe, /stats and /stats/by-type need verify (N2) |
| BomController | many / writes | 🟡 partial | change-logs + cost-summary need verify (N3) |
| AlertController | 6 / 3 | 🟡 partial | content-dependent (N4) |
| **RestaurantDashboardController** | **1 / 0** | **🔴 leak (V1)** | `thisMonthWastageCost` in hand-built Map |
| **ReportController** | **25 / 0 (reads)** | **🔴 leak (V2)** | 10+ Map<String,Object> endpoints leak |
| **MaterialConsumptionController** | **9 / 0** | **🔴 leak (V3)** | `unitPrice` + `totalCost` in hand-built Map |
| **SupplierAdmissionController** | **7 / 3** | **🔴 leak (V4)** | `creditLimit` + `currentBalance` in hand-built Map |
| **PriceListController** | **6 / 2** | **🔴 leak (V5)** | reads expose price tables; PriceList lacks @PriceSensitive |
| **SmartBIDashboardController** | **10 / 2** | **🔴 leak (V6)** | 4 siblings of PR #470's `/dashboard/executive` |

---

## Fix Schedule (P1 — Immediate)

### Mirror PR #470 Chat A pattern: add `@RequirePermission` to the recurse-gap endpoints.

**Recommended ticket structure (1 PR per controller for clean revert paths)**:

| Ticket | Controller | Endpoints | Gate to add | Effort |
|---|---|---|---|---|
| P1-V1 | RestaurantDashboardController | 1 | `@RequirePermission({"procurement:price:view","finance:read","finance:read_write"})` | XS |
| P1-V2 | ReportController | ~13 | Class-level `@RequirePermission({"finance:read","finance:read_write","procurement:price:view"})` | M |
| P1-V3 | MaterialConsumptionController | 9 | Class-level `@RequirePermission({"procurement:price:view","production:read","production:read_write"})` | S |
| P1-V4 | SupplierAdmissionController | 3+ (verify all reads) | `@RequirePermission({"procurement:read","procurement:read_write","procurement:price:view"})` | S |
| P1-V5 | PriceListController | 4 reads | `@RequirePermission({"sales:read","sales:read_write","finance:read","procurement:price:view"})` | S |
| P1-V6 | SmartBIDashboardController siblings | 5 (custom/unified/dynamic/dynamic-kpis/insights) | Mirror chat1 Chat A's gate for `/dashboard/executive` (likely `@RequirePermission({"analytics:read","analytics:read_write"})`) | S |

**Suggested merge order**: V6 first (combine with chat1 Chat A's fix to PR #470 endpoints — same domain, same gate). Then V1-V5 in any order.

### P2 — Verify (1-2h each):
- N1: `grep` `MaterialBatchServiceImpl` for cost/value emit
- N2: `grep` `DisposalRecordService.getDisposalStats`
- N3: re-test BomController after BUG-2 sweep merges
- N4: read 2-3 sample `ProductionAlert` rows from prod, check message field for 金额

### P3 — Architectural follow-up:
- Add `@PriceSensitive` to `PriceList.PriceListItem.standardPrice/minPrice/maxPrice` (defense-in-depth even after P1-V5 ships, per BUG-2 sweep pattern)
- Consider DEFENSE-IN-DEPTH library: a `MapPriceFilter` aspect that scans hand-built Maps for keys matching `(?i).*(price|cost|amount|value|balance|fee|wage|salary).*` and nulls them when `PriceSensitiveContext.shouldHide(...)`. Out-of-scope for this audit but recurring pattern justifies architectural lift.

---

## Reproducer Snippets (Optional Validation)

Once P1 fixes land, re-test as `warehouse_mgr1` against test env (8097) and prod (8086):

```bash
# V1 — restaurant dashboard
curl -s -H "Authorization: Bearer $WAREHOUSE_MGR_TOKEN" \
  "http://localhost:8086/api/mobile/F001/restaurant-dashboard/summary" \
  | jq '.data.thisMonthWastageCost'
# Pre-fix: returns BigDecimal value. Post-fix: 403 + rich error body.

# V3 — material consumption stats
curl -s -H "Authorization: Bearer $WAREHOUSE_MGR_TOKEN" \
  "http://localhost:8086/api/mobile/F001/processing/material-consumptions/stats" \
  | jq '.data.totalCost, .data.byMaterialType[].cost'
# Pre-fix: returns BigDecimal values. Post-fix: 403.

# V5 — price list lookup
curl -s -H "Authorization: Bearer $WAREHOUSE_MGR_TOKEN" \
  "http://localhost:8086/api/mobile/F001/price-lists/lookup?productTypeId=PT001" \
  | jq '.data.price'
# Pre-fix: returns BigDecimal. Post-fix: 403.

# V6 — unified dashboard (sibling of PR #470 /dashboard/executive)
curl -s -H "Authorization: Bearer $WAREHOUSE_MGR_TOKEN" \
  "http://localhost:8086/api/mobile/F001/smart-bi/dashboard?period=month" \
  | jq '.data.sales.kpiCards, .data.finance.kpiCards'
# Pre-fix: same leak as /dashboard/executive. Post-fix: 403.
```

---

## Method Notes

- **Search seed**: `grep -rln "@PriceSensitive" backend/java/cretas-api/src/main/java/com/cretas/aims/entity/ backend/java/cretas-api/src/main/java/com/cretas/aims/dto/` → 36 files / 17 entities + 4 DTOs.
- **Controller enumeration**: shell-loop classified 111 controllers by Map<String,Object> presence + `@RequirePermission`/`@RequireRole` count. 21 ZERO-GATE controllers; 70 PARTIAL. ZERO-GATE money-domain controllers triaged first.
- **Code paths inspected end-to-end** (controller → service for verification): RestaurantDashboardServiceImpl, ProductionAnalyticsServiceImpl, MaterialConsumptionController.enrichConsumption*, SupplierAdmissionController.buildSupplierSummary, PriceListController.lookupPrice.
- **Sources not consulted** (out-of-scope or pre-covered): SmartBIAnalysisController already PR #470. BomCostSummaryDTO already covered by BUG-2 sweep. Inventory valuation already covered by E5 decision.
- **False-negative risk**: Hand-built Maps inside services for the "needs-verify" rows (N1-N4) — recommended sister chat verifies via `git grep "result.put.*Cost\|result.put.*Price\|result.put.*Amount\|result.put.*Value"` in service/impl.

---

## Cross-References

- PR #470 — original P0 RBAC bypass detection on 8 SmartBI analysis endpoints (chat1 R3 finance L4 deep)
- `docs/qa-audits/2026-05-12-r3-finance-l4-deep-results.md` — chat1's audit doc
- `docs/qa-audits/2026-05-12-bug-6-price-sensitive-sister-sweep.md` — field-level `@PriceSensitive` gap audit (PR #455 sister)
- `docs/qa-audits/2026-05-12-bug2-bom-pricesensitive-sweep.md` — BOM-domain field annotation sweep
- `docs/qa-audits/2026-05-12-e5-valuation-rbac-decision.md` — `/inventory/valuation` `@RequirePermission` decision (same architectural conclusion as this sweep)
