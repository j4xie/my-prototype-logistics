# Issue #567 — T2-4 RPF chain UI E2E (chat2 follow-up to PR #613)

**Verdict** (this script's run): **12 PASS / 1 PARTIAL / 3 INFO** on F006 prod 139:8086.

**One real UX bug found** — fix is included in this branch (`PurchaseReceiveRecord` entity).

## Why this script exists

PR #613 (chat3) verified the RPF chain at the **API layer only** and verdict-stamped PARTIAL due to two P3 gaps (sample_id schema, MaterialConsumption data) — both explicitly out of the original dispatch scope.

The cross-page-state-drift framing in the dispatch did **not** match PR #613's actual findings: chat3 ran no Playwright, found no drift, and the two real gaps need either a multi-day schema migration or wait on Issue #538.

This script fills the missing layer: a Playwright walk through the 5 RPF UI surfaces on F006 prod, using chat3's 3 confirmed L2→L3→L4 traces as anchors.

## Cross-layer surfaces in the UI

Source grep of `web-admin/src/views/{rd,procurement,production,inventory,warehouse}` (commit `804c8533e`):

| Surface | File:line | What it does |
|---|---|---|
| (no inter-page hyperlinks between the 5 RPF pages) | — | Customer side-menu-navigates between pages. |
| L2 PO detail embeds receives list | `procurement/orders/detail.vue:91-97` | GET `/purchase/receives/by-order/{orderId}` rendered in-page. |
| L3 receive list 采购订单 column | `procurement/receives/list.vue:311-313` | `purchaseOrderNumber \|\| purchaseOrderId \|\| '— (无单入库)'` |
| L4 (warehouse inventory) usage-history dialog | `warehouse/inventory/index.vue:190` | GET `/material-batches/{id}/usage-history` shown in detail dialog. |
| Production batch detail 原料消耗记录 | `production/batches/detail.vue:301-329` | GET `/processing/material-consumptions/batch/{batchId}`, `v-if length>0` guard. |

## Findings on F006 prod

| Step | Verdict | What it proves |
|---|---|---|
| S0 login | PASS | f006_admin auth + token at `localStorage['cretas_access_token']` |
| S1×5 pages render | PASS | All 5 RPF pages load without 401/500/404 on F006 prod. |
| S2 L2→L3 traces A/B/C | PASS | PO detail click-through renders the linked receive number for all 3 chat3 traces. |
| **S3 L3 PO column** | **PARTIAL** | **All 5 rows render raw UUIDs (e.g. `0ed28974-b428-4122-a376-fd0219073c12`) instead of human-readable PO numbers. Backend gap: LIST response omits `purchaseOrderNumber`.** |
| S4 L4 batches list | PASS | 3 material batches render per chat3 row tally. |
| S4b usage-history dialog | INFO | Section absent — expected: F006 prod has 0 consumption rows per chat3. Dialog opens cleanly, no error. |
| S5 production batches list | PASS | List renders. |
| S5b consumption section | INFO | `v-if length>0` guard correctly hides empty section. |
| S6a direct-URL nav | PASS | Token + factory context survive direct PO detail URL load. |
| S6b reload mid-detail | PASS | F5 re-hydrates from URL param + auth store, token preserved. |
| S6c list → detail → back | PASS | Browser-back returns to list with rows re-populated. |
| S7 bogus UUID handling | INFO | NotFoundEmpty rendered (no crash). |

**Console errors observed**: 1× 404 from the bogus-UUID test (S7) — expected. No spurious 401s.

## The real bug + fix

`/api/mobile/{factoryId}/purchase/receives` LIST returns the raw `PurchaseReceiveRecord` entity. The entity stores `purchase_order_id` + `supplier_id` as bare FK columns (no `purchaseOrderNumber` / `supplierName` populated). The frontend declares the column with a fallback chain (`row.purchaseOrderNumber || row.purchaseOrderId || '— (无单入库)'`) — when the backend doesn't supply the human-readable name, users see raw UUIDs.

**Fix** (in this branch): Add Hibernate `@Formula` fields to `PurchaseReceiveRecord` mirroring `PurchaseOrder.supplierName` (file `PurchaseOrder.java:75-76`):

```java
@Formula("(SELECT po.order_number FROM purchase_orders po WHERE po.id = purchase_order_id)")
private String purchaseOrderNumber;

@Formula("(SELECT s.name FROM suppliers s WHERE s.id = supplier_id)")
private String supplierName;
```

No frontend change required — the existing fallback chain becomes a no-op once the backend populates the human-readable fields. No service-layer hydration code needed (Hibernate resolves on entity load).

**Performance note**: `@Formula` runs a subquery per row. For F006's 5-row list this is fine; for a 1000-row factory it would be 2000 extra queries on the list endpoint. Matches the precedent set by `PurchaseOrder.supplierName` (same pattern, same risk profile). If a scaling issue surfaces, switch to a service-layer bulk-load.

## Run

```bash
npm install
TARGET=http://139.196.165.140:8086 node walk-chain.mjs
# → results.json + shots/*.png
```

Headless Chromium. ~60s runtime. F006 prod is read-only here — script never POSTs.

## Account constraint

Hardcoded `f006_admin / 123456` (mirrors PR #613 and `scripts/customer-audit-e2e-2026-05-14-qhj/`). RBAC-strip behaviors not tested — that's #599's coverage; we don't reverify here.

## Disposition for Issue #567

After this fix lands, the per-link UI status matrix becomes:

| Link | Before | After this fix |
|---|---|---|
| L1 R&D sample | EMPTY (0 samples on F006 prod) | unchanged |
| L1 → L2 (sample → PO) | NOT SUPPORTED (entity gap) | unchanged — P3 schema follow-up |
| **L2 → L3 list (receives → PO label)** | **raw UUID** | **PO number rendered** |
| L2 → L3 detail (PO embeds receives) | PASS | PASS |
| L3 → L4 (receive item → batch) | PASS (FK + items) | PASS |
| L4 → L5 (batch → plan via consumption) | PASS-infra / EMPTY-data | unchanged — P3 data follow-up |

Recommend: close #567 once this PR merges + post-deploy re-run shows S3 PARTIAL → PASS. Keep the two P3 follow-ups (schema sample_id, F006 consumption seed) as separate issues.
