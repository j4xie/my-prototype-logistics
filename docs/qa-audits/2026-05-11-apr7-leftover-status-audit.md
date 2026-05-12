# Apr 7 customer meeting — leftover 5 items status audit

**Date**: 2026-05-11
**Auditor**: ops-apr7-leftover-audit chat
**Scope**: Re-verify 5 issues flagged in `docs/plans/customer-meeting-apr7-implementation-verification.md` (Apr 7 verification report, score 6.5/10) against current `origin/main`.
**Method**: Per-item grep + git log + source read. No code modifications.

---

## 0. Executive summary

| # | Item | Verdict | Closed by | Severity |
|---|---|---|---|---|
| 1 | 开票金额来源 (订单 vs 出库) | **Closed** | `4c03b9d4c8` (F1) | — |
| 2 | 财务审批闭环 + 附件回传 | **Closed** | `4c03b9d4c8` (F2) | — |
| 3 | TransferTool 7 状态机 factoryId 隔离 | **Closed** | `4c03b9d4c8` (F3) | — |
| 4 | v3 P0-10 出库后金额联动 | **Closed (architectural)** | `4c03b9d4c8` (pull-based vs event-based) | — |
| 5 | v3 P0-3 数据结构 doc drift | **Partial — doc drift remains** | partial cleanup in v3.1 reorg | 🟡 Low (PM cleanup) |

**Open count**: 1 (Item 5, doc-drift only — no code defect).

**Top 3 fix priority**:
1. Item 5 — 1 line doc fix (~5 min, P3 cleanup, optional)
2. None code-level — all customer-blocking items are closed.
3. Optional: write E2E covering invoice issuance with partial-shipment scenario (P2-2 verification doc §168-171 "未深度核对项" list 5 items still open).

**PR URL**: (to be filled after `gh pr create`)

---

## 1. Item-by-item verification

### Item 1 — 🔴 开票金额来源 (订单 vs 出库)  ✅ Closed

**Original finding** (verification doc §2.1, Apr 7):
- `InvoiceServiceImpl.java:139` used `item.getLineAmount()` (order quantity).
- Customer original at transcript 2906-2921s: "如果这个订单还没有出库, 那么只显示我们的订单金额, 一旦有出库了, 就要显示我们的那个出库金额, 不然的话我们金额会对不上".

**Current state** (file moved to `service/finance/impl/InvoiceServiceImpl.java`, commit `4c03b9d4c8`):
- New method `computeLineAmountForInvoice(SalesOrderItem item)` at `InvoiceServiceImpl.java:237-261`:
  - `deliveredQuantity > 0` → use `deliveredQuantity` (partial/full shipment).
  - `deliveredQuantity == 0 / null` → fallback to `quantity` (order amount).
  - Discount always applied.
- `aggregateByTaxRate` at line 208 now invokes `computeLineAmountForInvoice` instead of `item.getLineAmount()`.
- JavaDoc lines 180-198 explicitly cite customer transcript timestamps.

**Verification evidence**:
```
$ git log -1 --stat 4c03b9d4c8 -- backend/java/cretas-api/src/main/java/com/cretas/aims/service/finance/impl/InvoiceServiceImpl.java
 service/finance/impl/InvoiceServiceImpl.java | 77 +++++++--
```
- `deliveredQuantity` field exists at `SalesOrderItem.java:65-66`.
- `setDeliveredQuantity` populated at `SalesServiceImpl.java:1034` (shipment write path).

**Verdict**: **Closed**. Pull-based recompute (invoice queries `deliveredQuantity` at issue time) satisfies "金额对得上" requirement. No follow-up needed.

---

### Item 2 — 🔴 财务审批闭环 + 附件回传  ✅ Closed

**Original finding** (verification doc §2.2):
- `InvoiceRecord` lacked `invoice_file_url` / attachment fields.
- `attachInvoiceFile` / `uploadInvoicePdf` did not exist.
- Customer original 2585-2607s + 2675-2693s: "财务审批 → 财务回传发票附件 → 销售从订单页下载".

**Current state**:
- `InvoiceRecord.java:137-146`:
  - `issuedAt LocalDateTime` (issued timestamp)
  - `invoicePdfUrl String(500)` (OSS URL)
  - `invoiceFileName String(255)` (original filename for download)
- `InvoiceServiceImpl.java:293`: `issueInvoice(factoryId, invoiceId, MultipartFile pdfFile, Long issuedBy)`
- `InvoiceController.java:113-123`: `POST /{factoryId}/invoices/{invoiceId}/issue` accepts `MultipartFile`.
- Frontend `web-admin/src/views/sales/orders/detail.vue` — upload + download UI added per commit `4c03b9d4c8` summary.
- DB migration `V20260407_01__invoice_tax_breakdown.sql` shipped.

**4-step closed loop**:
1. ✅ `requestInvoiceFromOrder` (sales) → status `REQUESTED`
2. ✅ `approveInvoice` / `rejectInvoice` (finance)
3. ✅ `issueInvoice(MultipartFile)` (finance uploads PDF) → status `ISSUED`
4. ✅ `GET /{factoryId}/invoices/{invoiceId}` returns `invoicePdfUrl` + `invoiceFileName` for sales download.

**Verdict**: **Closed**.

---

### Item 3 — 🟡 TransferTool 7 状态机 factoryId 隔离 TODO  ✅ Closed

**Original finding** (verification doc §2.3):
- Commit `7526a254` self-annotated `TODO(W1 D3)` deferring 7 state-machine methods.
- 7 methods (request/approve/reject/ship/receive/confirm/cancel) bypassed factoryId via `getTransferByIdInternal`.

**Current state** (`TransferServiceImpl.java`):
- `getTransferByIdInternal` **deleted** (per commit `4c03b9d4c8` description).
- Replaced by `loadForStateChange(String factoryId, String transferId)` at line 235 (factory-scoped).
- All 7 state-machine methods now call `loadForStateChange`:
  - `requestTransfer` (line 252), `approveTransfer` (266), `rejectTransfer` (279), `shipTransfer` (293), `receiveTransfer` (313), `confirmTransfer` (326), `cancelTransfer` (346).
  - Also 2 additional callsites (lines 579, 634).
- JavaDoc line 232: "Replaces the previous getTransferByIdInternal which was a TODO leftover".
- New `assertSourceFactory` / `assertTargetFactory` for source/target validation.
- `TransferController` 7 endpoints pass `factoryId` (per commit description).
- `TransferApproveTool` (AI Tool) 7 case branches pass `factoryId`.

**Verdict**: **Closed**.

---

### Item 4 — 🟡 v3 P0-10 出库后金额联动 EventListener  ✅ Closed (architectural)

**Original finding** (verification doc §6.1):
- v3 doc separated "金额联动" (P0-10) from "税率分组" (P0-3), customer spoke about them in same continuous segment.
- Search for `DeliveryCompletedEvent` / `@EventListener` on shipment.

**Current state**:
- **No** `DeliveryCompletedEvent` listener exists (`grep -rn "DeliveryCompletedEvent" backend/java/cretas-api/src/main/java` → 0 hits).
- **Pull-based architecture instead**: `computeLineAmountForInvoice` reads `deliveredQuantity` at invoice issuance time. `deliveredQuantity` is set on shipment via `SalesServiceImpl.java:1034` / `SalesCreateDeliveryTool.java:106`.
- v3 doc `customer-meeting-apr7-requirements-v3.md:200` marks P0-10 as struck-through: `~~P0-10~~ ... → **已合并到 P0-3b**`.

**Why pull-based satisfies the requirement**:
- Customer wants invoice amount to match shipment when shipped, order quantity when not shipped.
- Pull-based (recompute on invoice issuance) accomplishes this without event-listener complexity.
- Avoids race conditions where event listener and invoice issuance interleave.
- Avoids stale invoice records that need re-computation across multiple delivery events.

**Verdict**: **Closed (architectural change)**. Original "EventListener on DeliveryCompleted" recommendation was one of several valid designs; the chosen pull-based pattern is simpler and equally correct.

---

### Item 5 — 🟡 v3 P0-3 数据结构 doc drift  ⚠️ Partial — doc drift remains

**Original finding** (verification doc §3.1):
- v3 doc line 182 (original): "P0-3 ... `SalesOrder.taxBreakdown` JSON + `InvoiceService`"
- Implementation actually used `InvoiceRecord.tax_breakdown` (correct architectural choice).
- Original verification recommended fixing **doc**, not code.

**Current state**:
- ✅ `customer-meeting-apr7-requirements-v3.md:184` updated: "InvoiceRecord.taxBreakdown JSON + InvoiceService.requestInvoiceFromOrder ..."
- ⚠️ `customer-meeting-apr7-requirements-v3.md:461` still says: "`entity/sales/SalesOrder.java` (加 taxBreakdown + 3 status + sales_order_id 关联)"
  - In §10.1 关键文件路径清单 — appears in a "files to modify" list, not on the canonical P0-3 row.
  - This is stale guidance: the implementation chose `InvoiceRecord.taxBreakdown` (snapshot-on-invoice) for historical immutability, so SalesOrder should NOT have `taxBreakdown` added.
- Confirmed in code: `InvoiceRecord.java:90-91` has `taxBreakdown List<TaxBreakdownEntry>`; `SalesOrder.java` does **not** have `taxBreakdown`.

**Severity**: 🟡 Low — PM doc cleanup, no code defect. Could mislead future contributor to add a duplicate `SalesOrder.taxBreakdown` field.

**Fix sketch** (~5 minutes):
```diff
- backend/java/cretas-api/src/main/java/com/cretas/aims/entity/sales/SalesOrder.java (加 taxBreakdown + 3 status + sales_order_id 关联)
+ backend/java/cretas-api/src/main/java/com/cretas/aims/entity/sales/SalesOrder.java (加 3 status + sales_order_id 关联;
+   taxBreakdown 落在 InvoiceRecord, 见 §4.1 P0-3a)
```

**Verdict**: **Partial — doc drift remains in §10.1 only**.

---

## 2. Other items in verification doc — quick summary

§3.2 (税率聚合按数值不区分原料/加工费), §3.3 (InvoiceRequestFromOrderTool 无 preview), §6.3 (定金尾款多次付款), §6.4 (订单详情顶部 KPI 卡) — **not in scope of this audit**. Re-audit recommended in a follow-up round; verification doc §168-171 lists 5 "未深度核对项" that the original Apr 7 agent flagged for follow-up.

---

## 3. Recommendation

| Priority | Action | Effort | Owner |
|---|---|---|---|
| P3 | Fix `v3-md:461` `SalesOrder.taxBreakdown` stale reference | 5 min | PM |
| P3 (optional) | Re-audit `customer-meeting-apr7-implementation-verification.md §168-171` (5 未深度核对项) | 30-45 min | next QA round |
| n/a | All customer-blocking items closed; no code action required. | — | — |

---

## 4. References

- Verification doc: `docs/plans/customer-meeting-apr7-implementation-verification.md`
- Requirements v3 (post-reorg): `docs/plans/customer-meeting-apr7-requirements-v3.md`
- Closing commit: `4c03b9d4c85416a09c03a3609f63cb4c2648e406` "fix(invoice,transfer): 闭合 verification 报告 3 个 Must-Fix + v3 文档重排"
- Subsequent invoice-related commits:
  - `48a6c9abb9` (R2 P1: prevent duplicate invoice requests)
  - `15cb5a1891` (R18: backend invoice status invariant)
  - `2bbc354ceb` (R21: centralize SO/PO whitelist + AR gap)
