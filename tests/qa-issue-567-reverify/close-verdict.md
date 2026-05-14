# Issue #567 — RPF chain walk-chain re-verify (post PR #621)

**Verdict**: **S3 PARTIAL → PASS**. Issue #567 ready to close.

**Re-run**: 2026-05-14 14:39 CST (UTC+8)
**Target**: F006 prod (139.196.165.140:8086)
**Account**: `f006_admin / 123456`
**Java jar**: `ac234e2bb` (blue active per dispatch; PR #621 = commit `a7b8dd4b1`, merged 2026-05-14 05:50 UTC)
**Script**: [`scripts/issue-567-rpf-ui-e2e/walk-chain.mjs`](../../scripts/issue-567-rpf-ui-e2e/walk-chain.mjs) (unchanged from PR #621)

## Summary

PR #621 added two Hibernate `@Formula` fields on `PurchaseReceiveRecord`:

```java
@Formula("(SELECT po.order_number FROM purchase_orders po WHERE po.id = purchase_order_id)")
private String purchaseOrderNumber;

@Formula("(SELECT s.name FROM suppliers s WHERE s.id = supplier_id)")
private String supplierName;
```

After deploy, `/api/mobile/F006/purchase/receives` LIST response populates both fields. L3 入库记录 列表的 采购订单 + 供应商 columns now render human-readable values instead of raw UUIDs.

## Layer 0: API-level evidence (single curl, per `feedback_verify_deploy_claim_via_api_evidence`)

```
GET /api/mobile/F006/purchase/receives?pageNum=1&pageSize=5
Authorization: Bearer <f006_admin token>

response.data.content (5 rows) — fields present + populated:

| receiveNumber       | purchaseOrderNumber  | supplierName |
|---------------------|----------------------|--------------|
| RCV-20260507-4505   | PO-20260507-0003     | 北京飞熊     |
| RCV-20260507-1394   | PO-20260507-0002     | 北京飞熊     |
| RCV-20260507-0023   | PO-20260507-0002     | 北京飞熊     |
| RCV-20260507-6322   | PO-20260507-0002     | 北京飞熊     |
| RCV-20260502-4276   | PO-20260502-0001     | 北京飞熊     |
```

Entity JSON keys include both `purchaseOrderNumber` and `supplierName`. Zero UUID leakage in either field.

## Layer 1: Vue source confirmation (per `feedback_grep_source_before_e2e_verdict` HARD)

`web-admin/src/views/procurement/receives/list.vue`:

| Line | Code |
|------|------|
| 311–313 | `<el-table-column label="采购订单"> ... {{ row.purchaseOrderNumber \|\| row.purchaseOrderId \|\| '— (无单入库)' }}` |
| 314–316 | `<el-table-column label="供应商"> ... {{ row.supplierName \|\| row.supplierId }}` |
| 439     | `<el-descriptions-item label="采购订单">{{ detailData.purchaseOrderNumber \|\| detailData.purchaseOrderId \|\| '— (无单)' }}` |
| 440     | `<el-descriptions-item label="供应商">{{ detailData.supplierName \|\| detailData.supplierId }}` |

Fallback chain still in place — but with backend now populating both fields, fallbacks become unreachable for normal records. No frontend change needed (and none shipped).

## Layer 2: UI walk-chain (Playwright re-run on 139:8086)

| Step | Description | Before PR #621 | After (this re-run) |
|------|-------------|----------------|---------------------|
| S0 | Login f006_admin | PASS | PASS |
| S1×5 | L1–L5 pages render | PASS | PASS |
| S2 (3 traces) | L2 PO detail embeds receive number | PASS | PASS |
| **S3** | **L3 采购订单 column renders PO number, not UUID** | **PARTIAL** (5 raw UUIDs) | **PASS** (5/5 PO numbers, 0 UUIDs) |
| S4 | L4 warehouse-inventory batches visible | PASS | PASS |
| S4b | L4 usage-history dialog | INFO (no consumption data) | INFO (unchanged) |
| S5 | Production batches list | PASS | PASS |
| S5b | Production batch detail consumption section | INFO (`v-if length>0` hides) | INFO (unchanged) |
| S6a/b/c | Cross-page state (direct URL / reload / back) | PASS | PASS |
| S7 | Bogus UUID handling | INFO (NotFoundEmpty) | INFO (unchanged) |

**Totals: 14 PASS / 0 PARTIAL / 3 INFO / 0 FAIL.** Console errors: 1 (S7 expected 404).

### S3 raw cell capture (`tbody td[col=采购订单]`)

```
['PO-20260507-0003', 'PO-20260507-0002', 'PO-20260507-0002', 'PO-20260507-0002', 'PO-20260502-0001']
```

`nameMatches=5, uuidMatches=0, fallbackMatches=0`. Compare to PR #621 baseline: `nameMatches=0, uuidMatches=5`.

(Screenshots gitignored per repo `*.png` policy; raw cell text in `walk-chain-reverify-results.json` is the canonical record.)

## Disposition for Issue #567

Per the disposition matrix in `scripts/issue-567-rpf-ui-e2e/README.md`:

| Link | Before PR #621 | After PR #621 deploy (this re-run) |
|------|----------------|-----------------------------------|
| L1 R&D sample | EMPTY (0 samples on F006) | unchanged |
| L1 → L2 (sample → PO) | NOT SUPPORTED (entity gap) | unchanged — P3 schema follow-up (separate ticket) |
| **L2 → L3 list (receive → PO label)** | **raw UUID** | **PO number rendered** ✅ |
| L2 → L3 detail (PO embeds receives) | PASS | PASS |
| L3 → L4 (receive item → batch) | PASS (FK + items) | PASS |
| L4 → L5 (batch → plan via consumption) | PASS-infra / EMPTY-data | unchanged — P3 data follow-up (separate ticket; depends on #538) |

**Recommend close #567**. Two remaining P3 follow-ups (L1→L2 entity gap, L4→L5 empty consumption data) are out of scope for the original cross-page-state-drift framing and were already called out in PR #613/#621 as separate tickets blocked on schema migration or Issue #538 — they were never the original target of #567.

## Artifacts in this dir

- `walk-chain-reverify-output.txt` — stdout from the 18-step re-run
- `walk-chain-reverify-results.json` — full per-step record incl. raw cell text for the 采购订单 column

Screenshots (`shots/00-post-login.png`, `shots/03-L3-PO-numbers.png`) are gitignored — they exist locally at `scripts/issue-567-rpf-ui-e2e/shots/` after running the script. The JSON `purchaseOrderColumnSummary.rawCells` array captures the exact rendered text for each row, which is more diff-friendly than a binary screenshot.
