# BUG-2 — BOM `@PriceSensitive` sweep matrix

**Date**: 2026-05-12
**Branch**: `fix/bug2-bom-pricesensitive`
**Parent finding**: PR #455 BUG-2 (`/production/bom` warehouse_mgr1 sees real `¥18.50` unitPrice — `BomItem.unitPrice` lacks `@PriceSensitive`).

## Sweep scope

Per dispatch: `grep -rE "(unitPrice|totalPrice|materialCost|laborCost|overheadCost|金额)" backend/java/cretas-api/src/main/java/com/cretas/aims/entity/`. Scope per MO: BOM / recipe / material_cost / production_cost.

## Matrix

| # | Class | Field | Domain | Pre-fix state | Post-fix |
|---|---|---|---|---|---|
| 1 | `entity/bom/BomItem` | `unitPrice` | BOM | ❌ no `@PriceSensitive` | ✅ annotated |
| 2 | `dto/bom/BomCostSummaryDTO` | `materialCostTotal` | BOM cost summary | ❌ | ✅ |
| 3 | `dto/bom/BomCostSummaryDTO` | `laborCostTotal` | BOM cost summary | ❌ | ✅ |
| 4 | `dto/bom/BomCostSummaryDTO` | `overheadCostTotal` | BOM cost summary | ❌ | ✅ |
| 5 | `dto/bom/BomCostSummaryDTO` | `totalCost` | BOM cost summary | ❌ | ✅ |
| 6 | `dto/bom/BomCostSummaryDTO.MaterialCostItem` | `unitPrice` | BOM cost summary (nested) | ❌ | ✅ |
| 7 | `dto/bom/BomCostSummaryDTO.MaterialCostItem` | `subtotal` | BOM cost summary (nested) | ❌ | ✅ |
| 8 | `dto/bom/BomCostSummaryDTO.LaborCostItem` | `unitPrice` | BOM cost summary (nested) | ❌ | ✅ |
| 9 | `dto/bom/BomCostSummaryDTO.LaborCostItem` | `subtotal` | BOM cost summary (nested) | ❌ | ✅ |
| 10 | `dto/bom/BomCostSummaryDTO.OverheadCostItem` | `unitPrice` | BOM cost summary (nested) | ❌ | ✅ |
| 11 | `dto/bom/BomCostSummaryDTO.OverheadCostItem` | `subtotal` | BOM cost summary (nested) | ❌ | ✅ |
| 12 | `entity/bom/LaborCostConfig` | `unitPrice` | BOM labor config (sister) | ❌ | ✅ |
| 13 | `entity/bom/OverheadCostConfig` | `unitPrice` | BOM overhead config (sister) | ❌ | ✅ |
| 14 | `entity/BatchWorkSession` | `laborCost` | Production work (sister) | ❌ | ✅ |
| 15 | `entity/EmployeeWorkSession` | `hourlyRate` | Production work (sister) | ❌ | ✅ |
| 16 | `entity/EmployeeWorkSession` | `laborCost` | Production work (sister) | ❌ | ✅ |
| 17 | `entity/RawMaterialType` | `unitPrice` | Raw-material master (sister) | ❌ | ✅ |

**17 fields annotated across 8 files.**

## Already protected (verified — no change needed)

| Class | Field | Source |
|---|---|---|
| `entity/MaterialConsumption` | `unitPrice`, `totalCost` | PR #443 (annotated upstream) |
| `entity/ProductionBatch` | `materialCost`, `laborCost`, `totalCost`, `unitCost` | PR #443 (annotated upstream) |
| `entity/ProductType` | `unitPrice` | PR #423/#443 (annotated upstream) |
| `entity/MaterialBatch` | `unitPrice`, `getTotalCost()` | PR #423/#458 (annotated, METHOD target on getter) |
| `entity/inventory/SalesOrder.*` | `totalAmount`, `unitPrice`, etc. | PR #423 |
| `entity/inventory/PurchaseOrder.*` | `totalAmount`, `unitPrice`, etc. | PR #423 |
| `entity/inventory/ReturnOrder.*` | `totalAmount`, `unitPrice`, `lineAmount` | PR #443/#457 |
| `entity/inventory/InternalTransfer.*` | `totalAmount`, `unitPrice` | PR #457 |

## Out-of-scope siblings — flagged for follow-up (NOT fixed in this PR)

These match the grep but fall outside BUG-2's stated scope (BOM/recipe/material_cost/production_cost). Each needs its own RBAC analysis to decide whether stripping is appropriate (some may have different permission gates — e.g. finance/ uses `finance:price:view` not `procurement:price:view`).

| Class | Field(s) | Domain | Note |
|---|---|---|---|
| `entity/finance/ArApTransaction` | `amount` | Finance AR/AP | Different permission gate (finance:*) — needs separate audit |
| `entity/finance/InvoiceRecord` | `amount`, `totalAmount` | Finance invoice | Same |
| `entity/finance/PaymentRecord` | `amount` | Finance payment | Same |
| `entity/inventory/FinishedGoodsBatch` | `unitPrice` | Inventory | Sister to `MaterialBatch` — likely needs annotation |
| `entity/inventory/SalesDeliveryItem` | `unitPrice` | Sales delivery | Sister to `SalesOrderItem` — likely needs |
| `entity/inventory/SalesDeliveryRecord` | `totalAmount` | Sales delivery | Sister to `SalesOrder` |
| `entity/inventory/SalesOrderItem` | `costUnitPrice` | Sales (internal cost-side) | Sister to `unitPrice` which IS protected — likely missed in PR #423 |
| `entity/ShipmentRecord` | `unitPrice`, `totalAmount` | Shipment | Likely needs |
| `entity/rd/QuotationTask` | `materialCost`, `laborCost`, `overheadCost`, `totalCost` | RD quotation | Likely needs |
| `entity/sales/OperationalQuote` | `unitPrice`, `costPrice` | Sales quote | Likely needs |
| `entity/smartbi/SmartBiDepartmentData` | `costAmount` | SmartBI aggregates | Already gated by SmartBI RLS — verify before annotating |
| `entity/smartbi/SmartBiFinanceData` | `materialCost`, `laborCost`, `overheadCost`, `totalCost` | SmartBI | Same |
| `entity/smartbi/SmartBiSalesData` | `amount`, others | SmartBI | Same |

## Out-of-scope BomChangeLog JSONB snapshot leak — architectural follow-up

`entity/bom/BomChangeLog.oldValue` and `newValue` are `Map<String, Object>` JSONB columns storing snapshots of `BomItem` fields at change time (including `unitPrice`). Exposed via `BomController.@GetMapping("/items/{productTypeId}/change-logs")`.

`PriceFieldResponseAdvice` walks `@PriceSensitive` fields reflectively but cannot strip values inside `Map<String, Object>` because (a) the values are JSON primitives (BigDecimal / String) without owner-class metadata, and (b) the field names are dynamic keys, not annotated fields. A warehouse_manager fetching change-logs sees historical `oldValue.unitPrice` / `newValue.unitPrice` as plain numbers.

**Not fixing in this PR** — requires a new mechanism (e.g. a `@PriceSensitiveMap` annotation with a key-name allowlist, or a custom Jackson serializer that filters Map entries by key against a registry). Filed as out-of-scope follow-up; impact is bounded (only the change-log read endpoint, warehouse-role only, historical values only).

## Verification

- **Annotation tests** (3 test files, 18 cases):
  - `BomItemPriceSensitiveTest` — 1 case
  - `BomCostSummaryDTOPriceSensitiveTest` — 10 parameterized cases
  - `BomDomainSisterSitePriceSensitiveTest` — 6 parameterized cases
  - All assert `@PriceSensitive` presence via `Class.getDeclaredField(...).getAnnotation(PriceSensitive.class)`
- **Behavioral advice tests** (1 test file, 6 cases): `BomDomainPriceFieldAdviceTest` — exercises `PriceFieldResponseAdvice.beforeBodyWrite()` on BomItem / BomCostSummaryDTO / 5 sister entities with mocked warehouse_mgr1 + admin permissions, asserts stripping vs preservation per role.
- **Pre-existing unblocker**: `chore: close brace at PriceFieldResponseAdviceTest:755 (PR #458 follow-up)` — PR #458 shipped a missing closing brace that blocked all new tests in the package from compiling. Fixed in a separate commit at the head of this branch.
- **Full `mvn test` pass**: see commit log + CI.

## E2E re-verify

Deferred until test env Java 10011 is redeployed with this branch's main-jar — the `@PriceSensitive` annotations are pure backend-jar changes; no migration, no Vue changes, no front-end deploy needed. Re-run script: `docs/qa-audits/2026-05-12-canvas-dynamic-rbac-e2e-evidence/scripts/test-canvas-dynamic-rbac.mjs` from PR #455's evidence dir (already targets `/production/bom` for warehouse_mgr1) — expected post-deploy: `unitPrice: null` in `/api/mobile/F001/bom/items/{productId}` response.
