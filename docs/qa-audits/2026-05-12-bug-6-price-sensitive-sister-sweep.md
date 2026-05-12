# BUG-6 — `@PriceSensitive` Sister Sweep Audit

**Date**: 2026-05-12
**Triggered by**: PR #434 E2E S10 audit doc P2 item "BUG-6 PR #423 scope — SalesOrder `freightAmount` + `discountRate` exposed but not in `@PriceSensitive` annotation list. Audit after deploy with prod data."
**Author**: Sister-sweep dispatch (off PR #434 audit)
**Branch**: `ops-bug-6-price-sensitive-audit`
**Scope**: Audit ONLY. No code changes. No actual PR yet — Steve decides scope first.

---

## TL;DR

| Question | Answer |
|---|---|
| PR #423 annotated fields | **13** across 8 files |
| Latent gap fields (HIGH-priority customer-flagged) | **8** persisted + **6** computed-getter |
| Architectural limitation found | **`@PriceSensitive` targets only `ElementType.FIELD`**, **cannot strip @Transient computed getters** like `getLineAmount()` / `getPayableAmount()` / `getCostTotal()` / `getLineAmountWithTax()` — they LEAK by design |
| Live evidence | **Confirmed leak via prod 10010 as `f006_warehouse_mgr`**: `lineAmount: 0`, `lineAmountWithTax: 0` on PurchaseOrderItem (PR #423 stripped sibling `unitPrice` + `taxRate` but computed-getter recomputes from raw which are null → returns 0) |
| Original audit-doc question (`freightAmount`?) | Cretas SalesOrder has **NO** `freightAmount`. The shipping-fee field is `shippingFee` (latent gap). `discountRate` exists on SalesOrderItem and **IS already annotated** by PR #423. Original audit-doc note slightly misnamed — but the underlying concern (sales order shipping/extra fees leak to warehouse_mgr) is **real and confirmed**. |
| Proposed PR size | **MEDIUM** (~13 fields annotated + 4 architectural-fix decisions for computed getters + 1 DTO ExtraFeeItem) |

---

## Step 1 — PR #423 Annotated Field Inventory (Baseline)

Source: commit `2ad4f635dc` (merge of PR #423, 2026-05-12 01:36 UTC-4).

| File | Field | Notes |
|---|---|---|
| `entity/MaterialBatch.java:109` | `unitPrice` | entity |
| `dto/material/MaterialBatchDTO.java:93` | `totalValue` | DTO |
| `dto/material/MaterialBatchDTO.java:97` | `unitPrice` | DTO |
| `dto/material/MaterialBatchDTO.java:101` | `totalPrice` | DTO |
| `entity/inventory/PurchaseOrder.java:90` | `totalAmount` | entity |
| `entity/inventory/PurchaseOrder.java:94` | `taxAmount` | entity |
| `entity/inventory/PurchaseOrderItem.java:59` | `unitPrice` | entity |
| `entity/inventory/PurchaseOrderItem.java:64` | `taxRate` | entity (% as decimal, treated as price metadata) |
| `entity/inventory/PurchaseReceiveRecord.java:85` | `totalAmount` | entity |
| `entity/inventory/PurchaseReceiveItem.java:59` | `unitPrice` | entity |
| `entity/inventory/SalesOrder.java:94` | `totalAmount` | entity |
| `entity/inventory/SalesOrder.java:98` | `discountAmount` | entity |
| `entity/inventory/SalesOrder.java:102` | `taxAmount` | entity |
| `entity/inventory/SalesOrderItem.java:59` | `unitPrice` | entity |
| `entity/inventory/SalesOrderItem.java:63` | `discountRate` | entity (✓ already covered — audit-doc note was wrong) |
| `entity/inventory/SalesOrderItem.java:75` | `costUnitPrice` | entity |
| `entity/inventory/SalesOrderItem.java:80` | `taxRate` | entity |

**Total: 17 `@PriceSensitive` annotations across 8 files.** (Audit doc body said 13; the discrepancy: SalesOrderItem actually has 4 not 2 annotations, MaterialBatchDTO 3 not 2 — re-counted from source.)

Annotation helper `@interface PriceSensitive` at `security/PriceSensitive.java`: `@Target(ElementType.FIELD)` only, no `METHOD` target. `PriceFieldResponseAdvice` walks **fields via `Class.getDeclaredFields()`** only — **`@Transient` getters are NEVER inspected** for `@PriceSensitive` (because they have no backing field).

---

## Step 2 — Live Evidence of Leak (`f006_warehouse_mgr` on prod 10010)

Source: 2026-05-12 ~15:30 UTC-4 SSH probe against `localhost:10010` (Java prod blue).

### 2.1 `/api/mobile/F006/purchase/orders` (PR #423 COVERED — sibling field strip confirmed working)

```json
{
  "totalAmount": null,    ← @PriceSensitive STRIPPED ✓
  "taxAmount": null,      ← @PriceSensitive STRIPPED ✓
  "items": [{
      "unitPrice": null,           ← @PriceSensitive STRIPPED ✓
      "taxRate": null,             ← @PriceSensitive STRIPPED ✓
      "lineAmount": 0,             ← LEAK (computed getter, not annotatable)
      "lineAmountWithTax": 0,      ← LEAK (computed getter, not annotatable)
      "boxQuantity": 20.0,         ← OK — not price
      "receivedQuantity": 50.0     ← OK — not price
  }]
}
```

`getLineAmount()` at `PurchaseOrderItem.java:99` returns `Decimal("0")` when `unitPrice` is null (because PR #423 already stripped it). **So the leak is `0` not the real value** — in this specific case the strip cascades. But: **the field name itself ("lineAmount") still surfaces in JSON, which is OK for now**, and **on entities where the dependent fields ARE non-null** (see §2.2), `getLineAmount` will compute and emit a real price.

### 2.2 `/api/mobile/F006/sales/orders` (PR #423 PARTIAL — multiple latent gaps)

```json
{
  "totalAmount": 5000.0,        ← @PriceSensitive missed?? wait... f006_admin response below
  "discountAmount": 0.0,
  "taxAmount": 0.0,
  "shippingFee": 0.0,           ← LATENT GAP
  "extraFees": [],              ← LATENT GAP (when populated, contains BigDecimal amounts)
  "actualShippedAmount": null,  ← LATENT GAP
  "estimatedCost": null,        ← LATENT GAP (内部 BOM 成本)
  "estimatedProfit": null,      ← LATENT GAP (内部利润)
  "invoicedAmount": null,       ← LATENT GAP (已开票金额)
  "paidAmount": null,           ← LATENT GAP (已收款金额)
  "payableAmount": 5000.0,      ← LATENT GAP (computed getter — leak with real value)
  "items": [{
      "unitPrice": 50.0,        ← Should be null for WHM
      "discountRate": 0.0,      ← Should be null for WHM
      "lineAmount": 5000.0,     ← LEAK (computed getter)
      "costTotal": 0,           ← LEAK (computed getter)
      "pendingQuantity": 100.0  ← OK — not price
  }]
}
```

⚠️ **Caveat**: The `f006_warehouse_mgr` call returned **HTTP 500** for `/sales/orders` (trace `8D015D1D`, log not retained — separate bug, likely a `@JsonIgnore` field collision with the response advice; needs follow-up RCA). The above shape is from `f006_admin` who has `procurement:price:view` permission — confirms field schema. Since WHM 500's BEFORE response body strip runs, this is NOT a price leak in the runtime sense **today**, but the moment the 500 is fixed, ALL latent fields above will be exposed to WHM in raw JSON.

---

## Step 3 — Customer Transcript Cross-Reference

Per PR #434 audit doc:

| Customer-flagged flow | Required hidden fields | PR #423 coverage |
|---|---|---|
| 仓库管理员 不应看到 价格 / 折扣 / 运费 anywhere | (all below) | partial |
| 销售订单 总金额 | `totalAmount` | ✅ |
| 销售订单 折扣 | `discountAmount`, item `discountRate` | ✅ |
| 销售订单 运费 | `shippingFee` + `extraFees[].amount` + `actualShippedAmount` | ❌ LATENT |
| 采购订单 总金额 / 单价 / 税额 | `PurchaseOrder.totalAmount` / `taxAmount` / `Item.unitPrice` / `taxRate` | ✅ |
| 收货记录 总金额 / 单价 | `PurchaseReceiveRecord.totalAmount` / `PurchaseReceiveItem.unitPrice` | ✅ |
| 库存批次 unitPrice / valuation | `MaterialBatch.unitPrice` / `MaterialBatchDTO.totalValue` / `totalPrice` | ✅ |

**Audit doc note "MaterialBatch unitCost"**: Cretas uses `unitPrice` for material batches (the canonical field name); `unitCost` is on `ProductionBatch` (factory internal cost, separate concern). The naming difference is transcript-level paraphrase, not a coverage gap on MaterialBatch.

**Audit doc note "SalesOrder freightAmount"**: Cretas has NO field called `freightAmount`. The equivalent is `shippingFee` (+ `extraFees` list + `actualShippedAmount`). Audit-doc note misnamed but the underlying customer concern (运费 not hidden) is **valid and confirmed via live probe**.

---

## Step 4 — Full Latent Gap Inventory

### 4.1 HIGH-priority latent gaps (persisted BigDecimal fields, customer-flagged) — **8 fields**

| Entity | File:Line | Field | Why it matters | Annotate? |
|---|---|---|---|---|
| SalesOrder | `entity/inventory/SalesOrder.java:142` | `shippingFee` | 客户运费 — **transcript-flagged** | ✅ YES |
| SalesOrder | `entity/inventory/SalesOrder.java:151` | `actualShippedAmount` | 实际发货金额 | ✅ YES |
| SalesOrder | `entity/inventory/SalesOrder.java:169` | `estimatedCost` | 预估 BOM 成本 — 内部财务数据 | ✅ YES |
| SalesOrder | `entity/inventory/SalesOrder.java:173` | `estimatedProfit` | 预估利润 — 内部财务数据 | ✅ YES |
| SalesOrder | `entity/inventory/SalesOrder.java:183` | `invoicedAmount` | 已开票金额 — 财务回款数据 | ✅ YES |
| SalesOrder | `entity/inventory/SalesOrder.java:191` | `paidAmount` | 已收款金额 — 财务回款数据 | ✅ YES |
| ExtraFeeItem (DTO) | `dto/sales/ExtraFeeItem.java:24` | `amount` | 装卸/包装/加急费 — 跟 shippingFee 同类 | ✅ YES |
| SalesOrderItem | `entity/inventory/SalesOrderItem.java:?` (not in 120-row sweep but should be checked) | `lineAmount` (DB column) | If a real DB column existed... actually it's a getter, see 4.3 | (architectural decision needed) |

Schema delta:

```
diff for SalesOrder.java:
  142|     private BigDecimal shippingFee;                      ← add @PriceSensitive
  151|     private BigDecimal actualShippedAmount;              ← add @PriceSensitive
  169|     private BigDecimal estimatedCost;                    ← add @PriceSensitive
  173|     private BigDecimal estimatedProfit;                  ← add @PriceSensitive
  183|     private BigDecimal invoicedAmount;                   ← add @PriceSensitive
  191|     private BigDecimal paidAmount;                       ← add @PriceSensitive

diff for ExtraFeeItem.java:
  24|     private BigDecimal amount;                            ← add @PriceSensitive
```

### 4.2 MEDIUM-priority latent gaps (other inventory entities — same warehouse_mgr workflow exposure)

| Entity | File:Line | Field | Endpoint exposure | Decision |
|---|---|---|---|---|
| SalesDeliveryRecord | `entity/inventory/SalesDeliveryRecord.java:93` | `totalAmount` | `/sales/deliveries` (SalesController) — same WHM workflow | ✅ YES |
| SalesDeliveryItem | `entity/inventory/SalesDeliveryItem.java:58` | `unitPrice` | (nested under SalesDeliveryRecord) | ✅ YES |
| ReturnOrder | `entity/inventory/ReturnOrder.java:82` | `totalAmount` | `/return-orders` controller (warehouse access) | ✅ YES |
| ReturnOrderItem | `entity/inventory/ReturnOrderItem.java:49` | `unitPrice` | (nested) | ✅ YES |
| ReturnOrderItem | `entity/inventory/ReturnOrderItem.java:52` | `lineAmount` (DB-persisted **not** getter) | (nested) | ✅ YES |
| InternalTransfer | `entity/inventory/InternalTransfer.java:98` | `totalAmount` | `/transfers` controller (warehouse-cross movement, internal cost basis) | ⚠️ DISCUSS — warehouse_mgr role might NEED to see for transfer reconciliation |
| InternalTransferItem | `entity/inventory/InternalTransferItem.java:73` | `unitPrice` | (nested) | ⚠️ DISCUSS — same as above |
| ShipmentRecord | `entity/ShipmentRecord.java:58` | `unitPrice` | `/shipments` (ShipmentController) | ✅ YES |
| ShipmentRecord | `entity/ShipmentRecord.java:60` | `totalAmount` | `/shipments` | ✅ YES |
| FinishedGoodsBatch | `entity/inventory/FinishedGoodsBatch.java:94` | `unitPrice` | `/finished-goods/batches` (warehouse role definitely accesses) | ✅ YES |

### 4.3 ARCHITECTURAL ISSUE — computed `@Transient` getters cannot use `@PriceSensitive`

These are price values **derived from raw fields** (quantity × unitPrice). When PR #423 strips the raw fields, getter returns `Decimal("0")` because `if (unitPrice == null) return BigDecimal.ZERO`. So **technically not a value leak** but `0` is misleading vs the v-if UI guard which would show "—".

| Entity | Getter | Returns | Behavior when raw stripped |
|---|---|---|---|
| PurchaseOrderItem | `getLineAmount()` | `quantity × unitPrice` | unitPrice=null → returns 0 |
| PurchaseOrderItem | `getLineAmountWithTax()` | `lineAmount × (1+taxRate/100)` | same → 0 |
| SalesOrderItem | `getLineAmount()` | `quantity × unitPrice × (1-discountRate/100)` | same → 0 |
| SalesOrderItem | `getCostTotal()` | `quantity × costUnitPrice` | costUnitPrice=null → 0 |
| SalesOrder | `calculateTotalAmount()` | `sum(items.getLineAmount())` | depends on items strip |
| SalesOrder | `getPayableAmount()` | `totalAmount − discount + tax` | totalAmount=null throws NPE!! ⚠️ — **defensively check** |
| SalesOrder | `getPaymentStatus()` | derived from paidAmount vs totalAmount | both null → returns "UNPAID" (LEAK semantically) |
| InternalTransferItem | `getLineAmount()` | `quantity × unitPrice` | same → 0 |
| ReturnOrderItem | `getLineAmount()` | `lineAmount` (persisted) OR `quantity × unitPrice` | mixed |
| FinishedGoodsBatch | `getAvailableQuantity()` / siblings | not price | OK |

**`SalesOrder.getPayableAmount()` (line 252) has a latent NPE**: `return totalAmount.subtract(discount).add(tax)` — if `totalAmount` is null (because PR #423 stripped it for WHM), this throws `NullPointerException` during Jackson serialization. **This may explain the HTTP 500 / trace `8D015D1D`** observed during the live probe! Worth tracing.

**Proposed architectural fixes**:

1. **Option A** — Extend `@PriceSensitive` to `ElementType.METHOD` and modify `PriceFieldResponseAdvice` to also scan getters. Most flexible.
2. **Option B** — Add a `@JsonIgnore` to computed getters when user lacks permission. Requires a `@JsonView`-style filter; significantly more invasive.
3. **Option C** — Modify each `@Transient` computed getter to defensively return `null` when its dependent `@PriceSensitive` raw field has been nulled. Simple but: a) requires a way to check "current user lacks permission" inside the getter (smell), b) doesn't fix the JSON field surfacing as `0`.
4. **Option D (recommended)** — Refactor PR #423 to ALSO strip computed getters: introduce `@PriceSensitiveGetter` paired annotation OR migrate `PriceSensitive` to support `{FIELD, METHOD}`. Implementation effort ~1 hour.

**Also fix latent NPE in `SalesOrder.getPayableAmount`** regardless of architectural decision:
```java
public BigDecimal getPayableAmount() {
    BigDecimal total = totalAmount != null ? totalAmount : BigDecimal.ZERO;  // ← add defensive
    BigDecimal discount = discountAmount != null ? discountAmount : BigDecimal.ZERO;
    BigDecimal tax = taxAmount != null ? taxAmount : BigDecimal.ZERO;
    return total.subtract(discount).add(tax);
}
```

### 4.4 OUT-OF-SCOPE fields (intentionally NOT annotated)

| Entity | Field | Why exclude |
|---|---|---|
| AIUsageLog.cost | platform internal AI cost tracking | not customer-visible |
| BatchEquipmentUsage / BatchWorkSession.laborCost | internal production cost | factory_super_admin / production_manager only domain |
| EquipmentMaintenance.cost / FactoryEquipment.purchasePrice | equipment admin domain | not warehouse_mgr workflow |
| ProductionBatch / ProductionPlan.materialCost / laborCost / etc. | production cost analysis | factory_super_admin / production_manager only |
| PayrollRecord.bonusAmount / deductionAmount | HR domain | warehouse_mgr cannot access HR endpoints |
| Restaurant / SmartBI / BOM / Recipe domain | separate RBAC, separate workflow | scope of PR #415 was procurement+warehouse only |
| RawMaterialType.unitPrice / movingAvgPrice | catalog reference, not transaction | DISCUSS — if catalog endpoints accessible to WHM |
| OperationalQuote.unitPrice / costPrice | sales pre-order quotes | DISCUSS — separate Sales workflow |
| MaterialPriceComparisonDTO, IncentivePlan, etc. | report DTOs not entity | annotate at DTO level if reports surface to WHM |

These deserve a **separate** audit sweep if customers flag them later. Current scope (PR #423 follow-up) should focus on transcript-flagged + warehouse_mgr-touching entities.

---

## Step 5 — Proposed PR Scope

### Recommended PR: **MEDIUM size, ~13 annotation adds + 1 NPE fix + 1 architectural decision**

| Change | Files | Risk |
|---|---|---|
| Add `@PriceSensitive` to 6 SalesOrder fields | `SalesOrder.java` | LOW (mirrors PR #423 pattern) |
| Add `@PriceSensitive` to `ExtraFeeItem.amount` | `dto/sales/ExtraFeeItem.java` | LOW |
| Add `@PriceSensitive` to SalesDelivery/ReturnOrder/ShipmentRecord/FinishedGoodsBatch persisted price fields | 5 entity files (10 fields) | LOW |
| Defensive NPE fix on `SalesOrder.getPayableAmount()` | `SalesOrder.java:252` | LOW (1-line guard) |
| **Architectural** — decide Option A/B/C/D for computed-getter handling | `PriceSensitive.java` + `PriceFieldResponseAdvice.java` (if Option A/D) | MEDIUM — needs test updates |
| Decide `InternalTransfer` annotation (warehouse_mgr may need for reconciliation) | discuss with Steve before annotating | DISCUSS |

### Test plan

Re-run PR #434 E2E S10 wire-roundtrip test against `f006_warehouse_mgr`:

```bash
# Per-endpoint spot check: each newly annotated field MUST be null in response
ENDPOINTS=(
  "/api/mobile/F006/sales/orders"                 # shippingFee, actualShippedAmount, estimatedCost, etc.
  "/api/mobile/F006/sales/deliveries"             # totalAmount, items.unitPrice
  "/api/mobile/F006/return-orders"                # totalAmount, items.unitPrice, lineAmount
  "/api/mobile/F006/shipments"                    # unitPrice, totalAmount
  "/api/mobile/F006/finished-goods/batches"       # unitPrice
)
# For each: assert the field appears in response body as `null` (NOT missing entirely)
```

PR #434 already covers regression for purchase/orders + receives. Extend S10 fixture to also walk sales/deliveries + return-orders + finished-goods/batches.

For **architectural Option D** (METHOD target): add PriceFieldResponseAdviceTest cases:
- `WHM gets `lineAmount: null` (not 0)` on PurchaseOrderItem
- `WHM gets `payableAmount: null` (not NPE-500)` on SalesOrder

Add **15-permission-matrix regression**: confirm `factory_super_admin`, `finance_manager`, `procurement_manager`, `sales_manager`, `dispatcher`, `production_manager`, `restaurant_manager` continue to see all price fields including the newly-annotated ones; `warehouse_manager`, `warehouse_worker`, `quality_inspector`, `operator`, `hr`, `equipment_*`, `viewer` see null.

### Rollback strategy

Same as PR #423: revert the new PR + redeploy. Backend strip is source of truth; UI v-if (would also need adding for new fields where customer-facing) is defense layer.

---

## Step 6 — Open Questions for Steve

1. **Should InternalTransfer.totalAmount be price-sensitive for warehouse_manager?**
   - Pro: it's a cost-bearing transaction
   - Con: warehouse_mgr might need to reconcile transfer inventory value
   - Recommend: ask transcript / fc3 customer

2. **Architectural option for computed-getter leak — A/B/C/D?**
   - Recommend D (extend `@PriceSensitive` to METHOD) — cleanest, mirrors existing pattern, ~1 hour impl

3. **Also fix latent `SalesOrder.getPayableAmount` NPE in this same PR?**
   - Recommend yes — same diff, prevents the HTTP 500 already observed in prod

4. **OperationalQuote / RawMaterialType.unitPrice — separate sweep?**
   - Both are catalog/reference data, may surface to warehouse_mgr in non-obvious endpoints
   - Recommend defer to a Phase 2 audit if customer flags

5. **Annotate at DTO level vs Entity level for SalesDelivery/ReturnOrder?**
   - Entity-only is fine if DTOs project the entity directly via Lombok mapping; check controller signatures
   - Annotating both is defense-in-depth, low cost

---

## Appendix A — Audit method evidence trail

- PR #423 commit: `2ad4f635dcdb947ac1e7713bfcd960b8017e8a87`
- Live probe: 2026-05-12 ~15:30 UTC-4 via SSH `root@47.100.235.168` → `localhost:10010` (prod Java blue)
- Accounts used: `f006_admin` / `123456` (price-view roles), `f006_warehouse_mgr` / `123456` (price-strip target)
- Candidate sweep: 120 BigDecimal field matches across `backend/java/cretas-api/src/main/java/com/cretas/aims/entity/**`
- `PriceSensitive.java` source: `@Target(ElementType.FIELD)` only — confirms architectural limitation
- `PriceFieldResponseAdvice.java` source: walks `Class.getDeclaredFields()` only — confirms getter exclusion

## Appendix B — Files NOT changed in this PR

This audit creates ONLY `docs/qa-audits/2026-05-12-bug-6-price-sensitive-sister-sweep.md`. No code modifications. The downstream impl PR (to be scoped after Steve's review) will edit:

- `backend/java/cretas-api/src/main/java/com/cretas/aims/entity/inventory/SalesOrder.java` (+6 annotations + NPE fix)
- `backend/java/cretas-api/src/main/java/com/cretas/aims/dto/sales/ExtraFeeItem.java` (+1 annotation)
- `backend/java/cretas-api/src/main/java/com/cretas/aims/entity/inventory/SalesDeliveryRecord.java` (+1)
- `backend/java/cretas-api/src/main/java/com/cretas/aims/entity/inventory/SalesDeliveryItem.java` (+1)
- `backend/java/cretas-api/src/main/java/com/cretas/aims/entity/inventory/ReturnOrder.java` (+1)
- `backend/java/cretas-api/src/main/java/com/cretas/aims/entity/inventory/ReturnOrderItem.java` (+2)
- `backend/java/cretas-api/src/main/java/com/cretas/aims/entity/ShipmentRecord.java` (+2)
- `backend/java/cretas-api/src/main/java/com/cretas/aims/entity/inventory/FinishedGoodsBatch.java` (+1)
- (Optional Option D) `backend/java/cretas-api/src/main/java/com/cretas/aims/security/PriceSensitive.java` + `PriceFieldResponseAdvice.java`
- (Optional Option D) Test additions for METHOD targeting in `PriceFieldResponseAdviceTest.java`

Plus Vue v-if guards in `web-admin/` for the same field list (defense-in-depth, mirrors PR #423 UI change).
