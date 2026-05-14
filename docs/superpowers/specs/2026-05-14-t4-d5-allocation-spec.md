# T4-D5 Allocation Logic Spec — filter FinishedGoodsBatch by sourceWarehouseCode

**Issue**: #572
**PR base**: post-#564 (`sourceWarehouseCode` now propagates SalesOrderItem → SalesDeliveryItem; V20260514_01 / V20260514_02 applied)
**Author**: Claude (session 2026-05-14)
**Related rules**: D1 双仓流转 (PR #309 A1=A) / D5 sales from WH-LOG (PR #316)

---

## Background

PR #564 added the **data-contract** half of T4-D5: `source_warehouse_code` columns now exist on both `sales_order_items` and `sales_delivery_items` (V20260514_01 + V20260514_02), and `SalesServiceImpl.createDeliveryRecord` propagates the field from the request DTO into the persisted delivery row. The column comment on `SalesDeliveryItem.sourceWarehouseCode` (entity line 64-74) and the field doc on `CreateDeliveryRequest$DeliveryItemDTO.sourceWarehouseCode` (DTO line 80-88) **both explicitly state** that the allocation logic does NOT yet read this column — that work is gated to this follow-up issue.

Today's allocation logic is hard-wired to `WarehouseResolver.resolveLogisticsId(factoryId)` (i.e. always WH-LOG) regardless of what the upstream sales-order line declared. For F001's current single-warehouse usage that's correct, but customers using both WH-LOG (总仓) and WH-WKS (线边仓) on a single sales order — the very reason `sourceWarehouseCode` was added to the order line — need allocation to honor the per-line choice. This spec describes the minimal change to make allocation read the new column, with fallback semantics that preserve legacy behavior.

---

## Current behavior (file:line citations)

### Allocation site 1 — FIFO auto-deduct on `shipDelivery`

`backend/java/cretas-api/src/main/java/com/cretas/aims/service/inventory/impl/SalesServiceImpl.java`

- **Caller** (line 703-705): on `SHIP` transition, iterates `record.getItems()` and calls `deductFinishedGoodsInventory(factoryId, item)` for each row.
- **Allocation method** (line 991-1025, `deductFinishedGoodsInventory`):
  - Line 993: `String warehouseId = warehouseResolver.resolveLogisticsId(factoryId);` — **hard-coded WH-LOG**.
  - Line 994-995: `finishedGoodsBatchRepository.findAvailableBatchesByWarehouse(factoryId, item.getProductTypeId(), warehouseId)` — FEFO order, filtered by `warehouse_id`.
  - Line 999-1017: walks batches, decrements `shippedQuantity`, records first batch id on item.
  - Line 1019-1024: throws `BusinessException` "成品库存不足" when remaining > 0.
  - **Bug surface**: ignores `item.getSourceWarehouseCode()`. A delivery line whose order line said `WH-WKS` still deducts from WH-LOG.

### Allocation site 2 — manual batch allocation API

`backend/java/cretas-api/src/main/java/com/cretas/aims/service/sales/impl/SalesDeliveryBatchAllocationServiceImpl.java`

- **`allocateBatches`** (line 36-118): user explicitly picks batch ids; validates batch belongs to factory (line 81-84) but **does not verify batch.warehouseId matches item.sourceWarehouseCode**. Caller could pass a WH-WKS batch into an item that should ship from WH-LOG.
- **`recommendFifo`** (line 132-176):
  - Line 147: `String warehouseId = warehouseResolver.resolveLogisticsId(factoryId);` — **hard-coded WH-LOG**.
  - Line 148-149: `findAvailableBatchesFifoByWarehouse(factoryId, productTypeId, warehouseId)`.
  - Method signature only takes `(factoryId, productTypeId, requiredQty)` — has no `sourceWarehouseCode` knob. Callers from the UI "推荐 FIFO" button currently get WH-LOG recommendations only.

### Allocation site 3 — public read path

`SalesServiceImpl.getAvailableBatches` (line 808-814): same WH-LOG hard-code. Used by frontend stock-check before order create. **Out of scope** for issue #572 — that path looks at order line, not delivery line; it stays unchanged.

### `WarehouseResolver` (reuse target)

`backend/java/cretas-api/src/main/java/com/cretas/aims/service/factory/WarehouseResolver.java`

- Line 37-45: `resolveId(factoryId, code)` — returns FK uuid for any code (WH-LOG / WH-WKS / future).
- Line 48-50: `resolveLogisticsId(factoryId)` — convenience for WH-LOG.
- Line 53-55: `resolveWorkshopId(factoryId)` — convenience for WH-WKS.
- Throws `BusinessException(500)` with hint "请联系运维检查 factory_warehouses 表是否有该工厂的双仓 seed" if a code is missing (defensive — should be impossible post-V20260411_03 seed).

Already used by the return-order DEFECTIVE inbound path per session memory (PR #583). Reuse here is direct.

### Repository methods available

`backend/java/cretas-api/src/main/java/com/cretas/aims/repository/inventory/FinishedGoodsBatchRepository.java`

- Line 37-46: `findAvailableBatchesByWarehouse(factoryId, productTypeId, warehouseId)` — FEFO + warehouse filter. Already exists.
- Line 60-69: `findAvailableBatchesFifoByWarehouse(...)` — FIFO + warehouse filter. Already exists.
- No new repository method needed.

---

## Proposed behavior (before/after pseudocode)

### Change 1 — `SalesServiceImpl.deductFinishedGoodsInventory`

**Before** (line 991-995):

```java
private void deductFinishedGoodsInventory(String factoryId, SalesDeliveryItem item) {
    // D1: warehouse strategy per PR #310 §5 — sales 发货 WH-LOG fixed (D5 销售只从 WH-LOG 出).
    String warehouseId = warehouseResolver.resolveLogisticsId(factoryId);
    List<FinishedGoodsBatch> batches = finishedGoodsBatchRepository
            .findAvailableBatchesByWarehouse(factoryId, item.getProductTypeId(), warehouseId);
    // ...
```

**After**:

```java
private void deductFinishedGoodsInventory(String factoryId, SalesDeliveryItem item) {
    // T4-D5 (#572): honor per-line sourceWarehouseCode when present.
    // Legacy rows (sourceWarehouseCode == null) fall back to WH-LOG to preserve
    // pre-PR-#564 behavior. Empty/blank treated as null.
    String code = (item.getSourceWarehouseCode() != null && !item.getSourceWarehouseCode().isBlank())
            ? item.getSourceWarehouseCode().trim()
            : WarehouseCodes.WH_LOG;
    String warehouseId = warehouseResolver.resolveId(factoryId, code);

    List<FinishedGoodsBatch> batches = finishedGoodsBatchRepository
            .findAvailableBatchesByWarehouse(factoryId, item.getProductTypeId(), warehouseId);
    // ... (rest unchanged)
    if (remaining.compareTo(BigDecimal.ZERO) > 0) {
        throw new BusinessException(String.format(
                "成品库存不足: 产品=%s, 来源仓库=%s, 缺少数量=%s",
                item.getProductTypeId(), code, remaining.toPlainString()))
            .withHint("请检查该仓库是否有该产品的成品批次, 或调整发货行的来源仓库")
            .withHintTarget("source_warehouse_code");
    }
}
```

### Change 2 — `SalesDeliveryBatchAllocationServiceImpl.allocateBatches` (cross-check)

Add a per-allocation check inside the validation loop (after line 84, the factory-id check):

```java
// T4-D5 (#572): if the delivery item declares a sourceWarehouseCode, the picked
// batch's warehouseId must match the resolved warehouse. Null code → skip check
// (legacy / unconstrained). This catches manual UI bypass of FIFO recommend.
String code = item.getSourceWarehouseCode();
if (code != null && !code.isBlank()) {
    String expectedWarehouseId = warehouseResolver.resolveId(factoryId, code.trim());
    if (!expectedWarehouseId.equals(batch.getWarehouseId())) {
        throw new BusinessException(409,
                "成品批次 " + batch.getBatchNumber()
                + " 不属于发货行的来源仓库 " + code
                + " (批次实际仓库 id=" + batch.getWarehouseId() + ")")
            .withHint("请选择来源仓库的批次, 或修改发货行的来源仓库")
            .withHintTarget("finishedGoodsBatchId");
    }
}
```

### Change 3 — `SalesDeliveryBatchAllocationServiceImpl.recommendFifo` (signature extension)

The recommend endpoint needs a new optional parameter so the UI "推荐 FIFO" button can pre-filter to the line's source warehouse. Keep the old 3-arg method for backward compat (delegate to new method with `code = null` → WH-LOG fallback).

**Before** (line 132-149):

```java
public List<Map<String, Object>> recommendFifo(String factoryId, String productTypeId, BigDecimal requiredQty) {
    // ... validation ...
    String warehouseId = warehouseResolver.resolveLogisticsId(factoryId);
    var batches = finishedGoodsBatchRepository
            .findAvailableBatchesFifoByWarehouse(factoryId, productTypeId, warehouseId);
```

**After**:

```java
public List<Map<String, Object>> recommendFifo(
        String factoryId, String productTypeId, BigDecimal requiredQty,
        /* T4-D5 (#572) */ String sourceWarehouseCode) {
    // ... validation ...
    String code = (sourceWarehouseCode != null && !sourceWarehouseCode.isBlank())
            ? sourceWarehouseCode.trim()
            : WarehouseCodes.WH_LOG;
    String warehouseId = warehouseResolver.resolveId(factoryId, code);
    var batches = finishedGoodsBatchRepository
            .findAvailableBatchesFifoByWarehouse(factoryId, productTypeId, warehouseId);
    // ... unchanged
}

// Back-compat shim (callers that haven't migrated yet).
public List<Map<String, Object>> recommendFifo(String factoryId, String productTypeId, BigDecimal requiredQty) {
    return recommendFifo(factoryId, productTypeId, requiredQty, null);
}
```

Update the interface `SalesDeliveryBatchAllocationService` correspondingly, and add a controller path param / query param. Controller diff is mechanical — out of scope of this spec to enumerate.

---

## Edge cases

| # | Scenario | Behavior |
|---|---|---|
| EC-1 | `sourceWarehouseCode == null` (legacy delivery item created pre-#564, or order line where field was never set) | Fall back to WH-LOG. Matches pre-PR-#564 behavior bit-for-bit. Existing rows on prod stay green. |
| EC-2 | `sourceWarehouseCode == ""` or whitespace-only | Treated identical to null (fall back to WH-LOG). Defensive — UI sometimes sends `""` for "not set". |
| EC-3 | `sourceWarehouseCode == "WH-LOG"` and WH-LOG has zero matching batches for the product | Standard insufficient-stock error. Error message now includes the warehouse code (`来源仓库=WH-LOG`) for clarity. Same outcome as today. |
| EC-4 | `sourceWarehouseCode == "WH-WKS"` and WH-WKS has zero matching batches | Insufficient-stock error citing `来源仓库=WH-WKS`. **New** failure mode (previously this would silently deduct from WH-LOG, hiding the cross-warehouse contract). Customer comms note: this is the intended T4-D5 enforcement. |
| EC-5 | `sourceWarehouseCode` is some unknown value (`WH-FOO`) | `WarehouseResolver.resolveId` throws `BusinessException(500)` with the "缺少 warehouse seed" message. This will propagate as a 500 — acceptable because (a) `DeliveryItemDTO.sourceWarehouseCode` is bounded by `@Size(max=20)` only, not enum, so technically possible; (b) frontend currently constrains to WH-LOG / WH-WKS via `warehouseDisplayLabel`. **Optional hardening**: pre-validate in `createDeliveryRecord` against a whitelist (`WarehouseCodes.WH_LOG`, `WarehouseCodes.WH_WKS`) and throw 400 instead of 500. Defer unless customer complains. |
| EC-6 | Manual `allocateBatches` call picks a batch whose `warehouseId` doesn't match the resolved warehouse (orphan / cross-warehouse pick via UI) | New 409 BusinessException per Change 2. Frontend FIFO recommend already filters to the line's warehouse, so this fires only on manual override. |
| EC-7 | Factory missing WH-LOG or WH-WKS seed (V20260411_03 not run) | Same 500 as today — `WarehouseResolver.resolveLogisticsId` already threw on this; we're just reusing the same resolver. No regression. |
| EC-8 | Race: two concurrent `shipDelivery` calls for delivery rows on same WH-LOG batch | Existing optimistic lock on `FinishedGoodsBatch.@Version` (entity line 131-133) handles this; behavior unchanged. |
| EC-9 | Sales order's `sourceWarehouseCode` is `WH-WKS` but customer pushes the delivery line override back to `WH-LOG` in the create-delivery DTO | Honored — we always trust the delivery-line value, never re-derive from order line at allocation time. This is intentional (mirrors PR #564's data flow: order → delivery copy at create time, allocation reads delivery only). |

---

## Test plan

All tests live in `backend/java/cretas-api/src/test/java/com/cretas/aims/service/inventory/SalesOrderFulfillmentWarehouseTest.java` (existing) — extend with the new cases. The fixture pattern (reflective ctor, `buildAvailableBatch`, `buildDeliveryItem`) is already established (file line 47-114).

### New unit tests in `SalesOrderFulfillmentWarehouseTest`

1. **`deduct_honorsWhLogSourceWarehouseCode`** — item has `sourceWarehouseCode="WH-LOG"`. Expect `resolveId(factoryId, "WH-LOG")` called (not `resolveLogisticsId`), repository queried with WH-LOG id, deduct succeeds.
2. **`deduct_honorsWhWksSourceWarehouseCode`** — item has `sourceWarehouseCode="WH-WKS"`. Expect `resolveId(factoryId, "WH-WKS")` called, repository queried with WH-WKS id, deduct succeeds from WH-WKS batch. Verify WH-LOG is **never** queried (`verify(warehouseResolver, never()).resolveLogisticsId(...)`).
3. **`deduct_nullSourceWarehouseCode_fallsBackToWhLog`** — item has `sourceWarehouseCode=null`. Verify resolver called with `"WH-LOG"`. Locks legacy fallback.
4. **`deduct_blankSourceWarehouseCode_fallsBackToWhLog`** — `sourceWarehouseCode=""` and `"  "`. Same as #3.
5. **`deduct_whWksDeclared_butNoStock_throwsInsufficientWithCode`** — `sourceWarehouseCode="WH-WKS"`, repository returns empty for WH-WKS id. Assert exception message contains `来源仓库=WH-WKS` (new behavior, EC-4) and **not** "WH-LOG".
6. **`deduct_unknownSourceWarehouseCode_propagatesResolverException`** — `sourceWarehouseCode="WH-FOO"`, `warehouseResolver.resolveId` throws `BusinessException(500)`. Verify the exception bubbles up unchanged (no swallow).

### New unit tests in a sister test class for `SalesDeliveryBatchAllocationServiceImpl`

Create `backend/java/cretas-api/src/test/java/com/cretas/aims/service/sales/impl/SalesDeliveryBatchAllocationServiceWarehouseTest.java`:

7. **`allocateBatches_batchWarehouseMatchesItemCode_succeeds`** — item `sourceWarehouseCode="WH-LOG"`, picked batch `warehouseId == resolveId(WH-LOG)`. Allocation persists normally.
8. **`allocateBatches_batchWarehouseMismatch_throws409`** — item `sourceWarehouseCode="WH-LOG"`, picked batch is on WH-WKS. Assert 409 with message mentioning both the batch number and the line's expected warehouse code.
9. **`allocateBatches_nullSourceCode_skipsCrossCheck`** — item `sourceWarehouseCode=null`. Allocation works regardless of batch.warehouseId (legacy). Verify `warehouseResolver` is never called in the cross-check.
10. **`recommendFifo_passesCodeToResolver`** — call new 4-arg signature with `"WH-WKS"`. Verify `resolveId(factoryId, "WH-WKS")` called and `findAvailableBatchesFifoByWarehouse` invoked with the WH-WKS id.
11. **`recommendFifo_legacy3ArgShim_defaultsToWhLog`** — call old 3-arg signature. Verify resolver called with `"WH-LOG"` (back-compat).

### Integration / E2E

12. **Web-admin Playwright**: extend the existing T4-D5 E2E (committed alongside PR #564) — create a SO with two lines (one WH-LOG, one WH-WKS), create a delivery, click "确认发货", assert (a) WH-LOG batch's `shippedQuantity` increased only on the WH-LOG line, (b) WH-WKS batch's `shippedQuantity` increased only on the WH-WKS line, (c) zero cross-contamination on either side.
13. **Manual allocation Playwright**: on the delivery detail page, manually pick a WH-WKS batch for a line that declares `sourceWarehouseCode="WH-LOG"`. Assert the 409 error toast surfaces with the new message.

### Regression check

14. Existing tests in `SalesOrderFulfillmentWarehouseTest` (`deduct_queriesWhLogOnly`, `deduct_consumesAcrossWhLogBatchesFifo`, `deduct_onlyWhWksAvailable_throwsInsufficient`, `getAvailableBatches_returnsWhLogOnly`, `warehouseCodeConstantIsStable`) must still pass — they exercise the null/legacy fallback path that now equals "no sourceWarehouseCode set → WH-LOG", semantically identical.

---

## Migration / rollout

### Backward compat for existing rows

- `sales_delivery_items.source_warehouse_code` is **nullable** by V20260514_02 (no NOT NULL constraint). Pre-existing rows from before PR #564 stay null forever, and EC-1 / EC-3 ensure their `shipDelivery` runs route to WH-LOG exactly as before. **No backfill migration needed.**
- New rows from `createDeliveryRecord` (post-#564) carry whatever code the request DTO had. UI today already populates the field from the upstream order line, so practical default is WH-LOG for single-warehouse customers.

### Feature-flag consideration

Not needed. The change is fail-safe: null-tolerant fallback + same data shape. Roll out as a single PR.

### Customer comms

One customer-visible change: deliveries whose lines have `sourceWarehouseCode="WH-WKS"` and where WH-WKS has insufficient stock will now fail with "成品库存不足: 来源仓库=WH-WKS" instead of silently deducting from WH-LOG. Brief note in the release changelog suffices; rare path in practice (F001 is single-warehouse today).

### Rollback plan

Revert the single PR. The data column stays (V20260514_02 forward-only), but the allocation reverts to hard-coded WH-LOG. No data corruption risk because the column is read-only on allocation today and writes are unchanged.

### Deploy order

1. PR merge → test env deploy (`--env test`) → run unit tests + Playwright E2E from test plan.
2. Smoke test on F001 (single-warehouse: should be no-op; null sourceWarehouseCode → WH-LOG fallback exercises legacy path).
3. Smoke test on a dual-warehouse seed factory if available (F006 / F011), confirm WH-WKS deduct path.
4. Prod deploy (`--env prod`) only after both above pass.

---

## Out of scope

- Changing `SalesServiceImpl.getAvailableBatches` (read path for order-create stock check) — that reads order context, not delivery context; separate ticket if customer wants per-warehouse pre-check.
- Adding a `sourceWarehouseCode` whitelist enum constraint in the DTO (EC-5 hardening) — defer until the 500-error path is actually observed in prod.
- Refactoring `WarehouseCodes` to a Java enum — orthogonal cleanup.
- Cross-factory (A5 feature flag) allocation — those paths use `findAvailableBatchesAllFactoriesByWarehouseCode` already; they're scope-correct.
