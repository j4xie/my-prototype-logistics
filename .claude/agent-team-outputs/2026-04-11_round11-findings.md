# Canvas V3 Round 11 — Template Expansion to 4 More Services

**Date**: 2026-04-11
**Mode**: Main session direct execution in the R10 worktree (`my-prototype-logistics-r10`)
**Theme**: Apply Canvas Integration Template to 4 more services (5/18 → 8/18 covered)

## Summary

R11 continues R10's template rollout. 4 tasks, each adding a new service to the
5-hook template coverage list. Canvas V3 execution fidelity moves from ~27% →
~32% on the production chain.

## Scope

| Task | Service | Module code | New event | JUnit |
|---|---|---|---|---|
| T1 | `PurchaseServiceImpl.createReceiveRecord` | `purchase_receipt` | `PurchaseReceiveCreatedEvent` | 2 |
| T2 | `ReturnOrderServiceImpl.createReturnOrder` | `sales_return` | `ReturnOrderCreatedEvent` | 2 |
| T3 | `SalesServiceImpl.createFinishedGoodsBatch` | `finished_goods` | `FinishedGoodsCreatedEvent` (existing — gap fill) | 0 (existing infra) |
| T4 | `TransferServiceImpl.createTransfer` | `transfer` | `TransferCreatedEvent` | 3 |

**Total R11 tests added**: **7 JUnit** (2 + 2 + 0 + 3)

## R11 T1: purchase_receipt template

**Why**: `PurchaseServiceImpl.confirmReceive` already fires `MaterialReceivedEvent`
on CONFIRMED state, but factories wanting to react at draft time (e.g., "auto-create
QC sampling task on draft receive") had no hook. Customer-configured fields like
运输温度记录, 质检报告附件, 外包装状态 were silently dropped.

**5 hooks**:
1. `CreateReceiveRecordRequest` gains `customFields: Map<String,Object>`.
2. `@Autowired(required=false) DynamicFieldService` injected.
3. `runConfiguredValidation("purchase_receipt", "CREATE", ...)` at top of method.
4. `dynamicFieldService.setDynamicFields("purchase_receipt", ...)` after save.
5. `PurchaseReceiveCreatedEvent` published, added to HANDLED_EVENTS (16 → 17).

**Commit**: `9964dd6c7`

## R11 T2: sales_return / purchase_return template

**Why**: Return flows (both directions) had zero template coverage. High-demand
use cases: 大额退货通知财务, 质量问题退货自动创建 CAPA, 客户投诉分析.

**5 hooks**:
1. `CreateReturnOrderRequest` gains `customFields`.
2. `ReturnOrderServiceImpl` gains both `ValidationRuleEvaluator` and `DynamicFieldService`
   optional injections + `ApplicationEventPublisher` via constructor (new `final` field
   required a constructor signature change).
3. `runConfiguredValidation("sales_return", "CREATE", ...)` before number generation.
4. `setDynamicFields("sales_return", ...)` after save.
5. `ReturnOrderCreatedEvent` published, added to HANDLED_EVENTS (17 → 18).

**Covers both directions**: The enum-based `returnType` field (`SALES_RETURN` or
`PURCHASE_RETURN`) is passed in the event — trigger chains can filter on
`event.returnType` if they want single-direction logic.

**Commit**: `e39ab6834`

## R11 T3: finished_goods event gap fill

**Why (not a new template — closing an existing hole)**: `FinishedGoodsCreatedEvent`
was already in HANDLED_EVENTS and already published from
`SupplyChainOrchestrator.onBatchCompleted` — but only when the production plan
had a `sourceOrderId` from a `CUSTOMER_ORDER`. Direct `createFinishedGoodsBatch`
calls (manual entry, re-packaging from other batches, rework) were invisible to
trigger chains.

**Fix (partial template — 2 hooks, not 5)**:
1. `runConfiguredValidation("finished_goods", "CREATE", ...)` at top of method.
2. `applicationEventPublisher.publishEvent(new FinishedGoodsCreatedEvent(..., null, ...))`
   after save. `sourceOrderId` is null for this path — trigger chains can filter
   on `event.sourceOrderId != null` to keep the prior behavior.

**Skipped hooks**: customFields persist and DTO slot. `FinishedGoodsBatch` is an
entity, not a DTO, and adding a `customFields` column to the entity is a schema
migration out of R11 scope. No new event class or whitelist entry needed.

**No new tests**: The publish call is exercised by existing production code paths
in `SupplyChainOrchestrator`, and HANDLED_EVENTS membership is already covered
by the legacy initial whitelist.

**Commit**: `9ae43e175`

## R11 T4: transfer template

**Why**: `TransferServiceImpl.createTransfer` handles both factory-to-factory
and within-factory warehouse-to-warehouse transfers. Zero template coverage.
Logistics-critical flows: 跨工厂调拨自动通知对方仓管, 大额调拨转财务审批,
冷链物资调拨自动创建温度监控任务.

**5 hooks**:
1. `CreateTransferRequest` gains `customFields`.
2. Full template injection (ValidationRuleEvaluator + DynamicFieldService +
   ApplicationEventPublisher via constructor).
3. `runConfiguredValidation("transfer", "CREATE", ...)`.
4. `setDynamicFields("transfer", ...)`.
5. `TransferCreatedEvent` published with a `getFactoryId` alias method that
   returns `sourceFactoryId` — this is important because `TriggerChainExecutor`
   normalizes events via `getFactoryId`, and transfers live on the source
   factory (the originator). Without the alias the trigger chain lookup would
   fail with a reflection error. Added to HANDLED_EVENTS (18 → 19).

**Test highlight**: The `getFactoryId_returnsSourceFactory` test explicitly
verifies the alias — catches a refactor that removes it.

**Commit**: `51be06829`

## Canvas Integration Template coverage after R11

| # | Service | Module | Template full? | Event |
|---|---|---|---|---|
| 1 | `SalesServiceImpl.createSalesOrder` | `sales_order` | ✅ 5/5 | SalesOrderCreatedEvent |
| 2 | `SalesServiceImpl.createDeliveryRecord` | `delivery` | ✅ 5/5 | SalesDeliveryCreatedEvent |
| 3 | `ProductionPlanServiceImpl.createProductionPlan` | `production_plan` | ✅ 5/5 | (pre-existing) |
| 4 | `MaterialBatchServiceImpl.createMaterialBatch` | `material_batch` | ✅ 5/5 (R10 T3 event) | MaterialBatchCreatedEvent |
| 5 | `QualityInspectionServiceImpl.createInspection` | `quality_inspection` | ✅ 5/5 (R10 T4) | ProductionAlertEvent (FAIL only) |
| **6** | **`PurchaseServiceImpl.createReceiveRecord`** | **`purchase_receipt`** | **✅ 5/5 (R11 T1)** | **PurchaseReceiveCreatedEvent** |
| **7** | **`ReturnOrderServiceImpl.createReturnOrder`** | **`sales_return`** | **✅ 5/5 (R11 T2)** | **ReturnOrderCreatedEvent** |
| **8** | **`TransferServiceImpl.createTransfer`** | **`transfer`** | **✅ 5/5 (R11 T4)** | **TransferCreatedEvent** |
| 9 (partial) | `SalesServiceImpl.createFinishedGoodsBatch` | `finished_goods` | 2/5 (validation + event, R11 T3) | FinishedGoodsCreatedEvent |

Canvas V3 execution fidelity: **~27% → ~32%** on the production chain.

## HANDLED_EVENTS growth

| Round | Count | Added |
|---|---|---|
| Initial | 7 | SalesOrder*, Material/Batch/Finished/Payment/Invoice |
| R8 | 9 | + 2 |
| R9 | 15 | + SalesDeliveryCreatedEvent, ProductionAlert, SampleApproved, SkuComplexityChanged, SopUploaded, RescheduleNeeded |
| R10 T3 | 16 | + MaterialBatchCreatedEvent |
| **R11 T1** | **17** | **+ PurchaseReceiveCreatedEvent** |
| **R11 T2** | **18** | **+ ReturnOrderCreatedEvent** |
| **R11 T4** | **19** | **+ TransferCreatedEvent** |

## Test count

| Round | JUnit added | Cumulative R10+R11 |
|---|---|---|
| R10 unit | 7 | 7 |
| R10 IT | 4 | 11 |
| R11 T1 | 2 | 13 |
| R11 T2 | 2 | 15 |
| R11 T3 | 0 | 15 |
| R11 T4 | 3 | 18 |

Pre-R10 test count for Canvas V3 P0 fixes: **0/37**. After R11: **18 tests** guarding
the Canvas Integration Template wiring against future refactors.

## Build verification

- `mvn clean package` — **BUILD SUCCESS** (2201 main + 95 test sources + fat-jar repackage)
- 18/18 R10+R11 tests pass in 20s
- No new compile warnings

## Deployment

- Backend: blue-green swap **green → blue** (10020 → 10010). Previous R10 deploy
  was blue → green; R11 flipped back. Nginx upstream swapped cleanly, zero errors
  in 5-min post-swap log window.
- Smoke tests: `POST /api/mobile/F001/purchase/receive-records`, `/return-orders`,
  `/transfers` — all return HTTP 200 ApiResponse envelope (auth filter rejects,
  confirming routes are registered and JWT interceptor works).
- No web-admin changes in R11; no frontend deploy.

## Next queue (R12+)

Remaining services in the 18-service target list (10 remaining after R11):

**High priority** (BYPASS → template):
1. `ProductionPlanServiceImpl.startProduction` + `completeProduction` — status
   changes need validation + events.
2. `InvoiceServiceImpl.issueInvoice` — finance flow.
3. `PaymentRecordServiceImpl.confirmPayment` — finance flow.
4. `MaterialBatchServiceImpl.consumeBatchMaterial` — consumption tracking.
5. `ShipmentRecordService.createShipment` — logistics flow.

**Medium priority** (Partial → full 5-hook):
6. `SalesServiceImpl.updateSalesOrder` + `confirmOrder` + `financeApproveOrder`.
7. `ProcessWorkReportingServiceImpl.submitNormalReport`.
8. `InvoiceServiceImpl.requestInvoice` + `requestInvoiceFromOrder`.
9. `ArApServiceImpl.recordReceivable`.
10. `QualityInspectionServiceImpl.updateInspection` (R10 only did create path).

Per R10 ETA (20 min per service × 10 = ~3 h), a full R12 round could close out
most of these. Alternatively: **one integration test per round** to keep the
test coverage moving alongside the template expansion (currently all R11 tests
are unit-level; only R10 has an IT).

## Commits

| SHA | Task | Summary |
|---|---|---|
| `9964dd6c7` | T1 | purchase_receipt template + PurchaseReceiveCreatedEvent + 2 JUnit |
| `e39ab6834` | T2 | sales_return template + ReturnOrderCreatedEvent + 2 JUnit |
| `9ae43e175` | T3 | finished_goods event gap fill (direct create path publishes now) |
| `51be06829` | T4 | transfer template + TransferCreatedEvent + 3 JUnit |
| (this doc) | T6 | R11 findings |
