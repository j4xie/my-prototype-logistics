# Issue #567 — T2-4 RPF chain API verification

**Verdict**: **PARTIAL** (no transition to PASS). 2/3 chain links instance-verified; 1 link blocked by entity-schema gap; 1 link blocked by missing F006 prod data.

**Tested on**: F006 prod via `http://139.196.165.140:8086/api/mobile/F006/*` as `f006_admin`, 2026-05-14.

**Approach**: API-only probe (no Playwright). Per Issue #567 §"Required test design", followed the "API check fallback" path. Result is a per-link matrix with concrete evidence rows.

---

## Chain link matrix

| # | Link | Status | Evidence |
|---|---|---|---|
| L1 | R&D Sample exists | **EMPTY** | `GET /rd/samples?page=0&size=50` → `totalElements=0`. `GET /rd/requests` → 0. `GET /rd/quotations` → 0. F006 has no R&D activity in prod. |
| L1 → L2 | Sample → PO line referencing `sampleId` | **NOT SUPPORTED — entity gap** | `PurchaseOrder.java` (header) has no `sample_id` column. `PurchaseOrderItem.java` has only `purchase_order_id` + `material_type_id` — no `sample_id`. Issue body's design assumes a column that does not exist. Indirect link via `material_type_id` exists at the type level only (multiple samples can share the same material type). |
| L2 → L3 | Receive → PO via `purchaseOrderId` | **PASS** | 5/5 receives have `purchaseOrderId` populated. 3 distinct POs are referenced. The 3 unreferenced POs are 1 DRAFT (no receive yet) + 2 CANCELLED (correctly skipped). |
| L3 → L4 | Receive item → MaterialBatch via `materialBatchId` | **PASS** | 3 CONFIRMED receives → 3 distinct batches (1:1). 2 DRAFT receives have `materialBatchId=NULL` (expected — batch created on confirm). All 3 batchIds resolve to real rows in `/material-batches`. |
| L4 → L5 | ProductionPlan consumes batch via `MaterialConsumption` | **PASS-infra / EMPTY-data** | Entity `MaterialConsumption` has `production_plan_id` + `batch_id` FKs. Endpoint `/processing/material-consumptions/material-batch/{batchId}` exists. F006 prod has **0** consumption rows for all 3 batches and 0 total. (Known data gap, per memory `T4-D4 INFO` 2026-05-13.) |

---

## Three full instance traces (L2 → L3 → L4)

| Trace | PO orderNumber | PO id | Receive number | Receive id | Batch number | Batch id |
|---|---|---|---|---|---|---|
| A | PO-20260507-0003 (PARTIAL_RECEIVED) | `0ed28974` | RCV-20260507-4505 (CONFIRMED) | `4b8fe6ea` | MT-20260507-7640 | `45e22fda` |
| B | PO-20260507-0002 (COMPLETED) | `6705c5c8` | RCV-20260507-0023 (CONFIRMED) | `3dd9443a` | MT-20260507-2061 | `c0634171` |
| C | PO-20260502-0001 (COMPLETED) | `cd8d51eb` | RCV-20260502-4276 (CONFIRMED) | `97311d11` | MT-20260502-1365 | `eb2f15d6` |

All 3 trace fully end-to-end through the procurement chain. The product types are `冻猪蹄` (frozen pork hocks) and `牛肉前腱子` (beef shank), all from supplier `北京飞熊`.

---

## Real API path divergence from issue body

Issue #567 body lists these 5 routes:
- /rd/samples
- /procurement/orders
- /procurement/receives
- /inventory/batches
- /production/plans

Actual deployed API paths (verified via grep + 200 responses):

| Issue body path | Actual API path |
|---|---|
| `/rd/samples` | `/api/mobile/{factoryId}/rd/samples` ✓ |
| `/procurement/orders` | **`/api/mobile/{factoryId}/purchase/orders`** |
| `/procurement/receives` | **`/api/mobile/{factoryId}/purchase/receives`** |
| `/inventory/batches` | **`/api/mobile/{factoryId}/material-batches`** |
| `/production/plans` | **`/api/mobile/{factoryId}/production-plans`** |

Plus implicit dependency: **L4→L5 link goes via `/api/mobile/{factoryId}/processing/material-consumptions`** (not a path mentioned in the issue body).

---

## Pagination divergence found during probe

- `/rd/samples` uses Spring 0-indexed pagination (`page=0&size=N`).
- All other 4 chain endpoints use 1-indexed pagination (`page=1&size=N`) and reject `page=0` with HTTP 400.

This is a real API inconsistency. Not in #567 scope, but flagged for any future write-up.

---

## Recommended disposition for Issue #567

**Keep #567 as PARTIAL.** The runner `S-COV-T2-4-rpf-chain-list` should remain in PARTIAL state.

Reasoning:
1. **L1→L2 is a schema-gap, not a test-runner gap.** No assertion code can `PASS` the sample→PO link until `PurchaseOrder` / `PurchaseOrderItem` adds a `sample_id` FK column. This is an architectural decision — not a bug, but the issue body's spec asks for something the schema doesn't model. Either:
   - amend the schema (add `sample_id` to `PurchaseOrderItem`), OR
   - reframe the "chain" definition: link via `material_type_id` at the type level + via `BOM` (R&D BOM ↔ production plan BOM) for the recipe binding
2. **L4→L5 needs F006 prod consumption data.** Without it, the test cannot exercise the link end-to-end. Either backfill some consumption rows in F006 prod (low risk — append-only audit table) or wait for Issue #538 (F006 test env seed) and run there.

Both follow-ups are P3 / low priority — feature works end-to-end in production usage (per issue body's own caveat: "demo-OK; testing rigor gap").

---

## Run reproducible

```bash
# Login
TOKEN=$(curl -s -X POST http://139.196.165.140:8086/api/mobile/auth/unified-login \
  -H "Content-Type: application/json" \
  -d '{"username":"f006_admin","password":"123456","deviceId":"probe"}' \
  | python -c "import sys,json; print(json.load(sys.stdin)['data']['token'])")

# L1 (note 0-indexed)
curl -s -H "Authorization: Bearer $TOKEN" \
  "http://139.196.165.140:8086/api/mobile/F006/rd/samples?page=0&size=50" | jq '.data.totalElements'

# L2-L5 (1-indexed)
for path in purchase/orders purchase/receives material-batches production-plans; do
  curl -s -H "Authorization: Bearer $TOKEN" \
    "http://139.196.165.140:8086/api/mobile/F006/$path?page=1&size=20" | jq '.data.totalElements'
done

# L4→L5
curl -s -H "Authorization: Bearer $TOKEN" \
  "http://139.196.165.140:8086/api/mobile/F006/processing/material-consumptions?page=1&size=30" \
  | jq '.data.totalElements'
```

Output expected: `0, 6, 5, 3, 6, 0`.
