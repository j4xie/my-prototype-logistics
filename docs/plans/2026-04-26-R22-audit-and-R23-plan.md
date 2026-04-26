# R22 Audit + R23 Plan — Canvas DYNAMIC fix series

**Date**: 2026-04-26
**Branch**: `e2e/v1-framework`
**R21 commit**: `2bbc354ce`
**Auditor**: Reviewer #12 (independent superpowers:code-reviewer agent — Rule 9 compliance)
**Manager admission**: R17-R21 had NO real-window front-end testing — only `mvn test` + log inspection.

---

## R22 — Critical findings (4)

### C1. PaymentRecordServiceImpl.recordPayment — uncovered + cross-tenant
- **File**: `service/finance/impl/PaymentRecordServiceImpl.java:44-69`
- **Bug**: `salesOrderRepository.findById(salesOrderId)` with NO `factoryId.equals(...)` filter, NO status validation
- **Endpoint**: `POST /api/mobile/{factoryId}/finance/payments/record`
- **Impact**:
  - F001 user can POST with F002 salesOrderId → leaks F002 customer data into F001's payment_records → arApService.recordArPayment fans out to AR_PAYMENT in F001's books referencing F002 customer
  - Any user with `finance:read_write` can record payment against DRAFT/CANCELLED SO
- **R21 closed `recordReceivable` but the parallel `recordPayment` is wide open** — 11 prior reviewers missed this because narrative anchored on AR/AP transactions, not payment receipts.
- **Fix R23**:
  ```java
  // Add at line 49:
  if (!factoryId.equals(so.getFactoryId())) {
      throw new ResourceNotFoundException("销售订单不存在: " + salesOrderId);
  }
  validateReceivableStatus(salesOrderId, factoryId);  // mirror R21
  ```

### C2. recordAdjustment bypasses dual-control entirely
- **File**: `service/finance/impl/ArApServiceImpl.java:312-347` + `controller/finance/ArApController.java:106-119`
- **Endpoint**: `POST /finance/adjustment`
- **Bug**: Has NO SO/PO link → R21's `if (salesOrderId != null) validateReceivableStatus()` cannot fire here
- **Impact**: User with `finance:read_write` can write arbitrary AR_ADJUSTMENT/AP_ADJUSTMENT directly mutating customer.currentBalance / supplier.currentBalance with NO order link, NO approval gate, NO Canvas validation
- **Attack scenario**: Malicious salesperson zeros out customer outstanding balance via negative-amount adjustment, no paper trail beyond `remark` field
- **Fix R23**: require separate `finance:adjust` permission OR record APPROVAL_REQUIRED transaction needing 2nd approver before mutating balance

### C3. R21 commit message is FALSE — 5-of-9 inline whitelists still scattered
- **R21 commit claimed**: "5 copies … all callers refactored to use the centralized constants"
- **Reality** (grep proof):
  | File | Line | Inline whitelist | Status |
  |---|---|---|---|
  | `service/inventory/impl/SalesServiceImpl.java` | 556-559 | createDelivery: FINANCE_APPROVED \|\| CONFIRMED \|\| PROCESSING \|\| PARTIAL_DELIVERED | ❌ missed |
  | `service/inventory/impl/SalesServiceImpl.java` | 820-823 | getSalesStatistics: CONFIRMED \|\| PENDING_FINANCE_REVIEW \|\| FINANCE_APPROVED \|\| PROCESSING | ❌ missed |
  | `controller/ProductionPlanController.java` | 569-575 | selectableStatuses (= SO_PLANNABLE) | ❌ missed |
  | `service/inventory/impl/PurchaseServiceImpl.java` | 432-434 | createReceiveRecord: APPROVED \|\| FINANCE_APPROVED \|\| PARTIAL_RECEIVED | ❌ missed |
- **Impact**: The very anti-pattern R21 claimed to fix is alive in 4 more places. Reviewer #13 will TRUST "all centralized" and skip the grep — drift will recur silently.
- **Fix R23**:
  - Add new named sets to `OrderUsageWhitelists`: `SO_DELIVERABLE`, `SO_IN_FLIGHT`, `PO_RECEIVABLE_OPS_ONLY`
  - Refactor 4 sites to use them
  - Update R23 commit message with HONEST grep proof

### C4. 4 endpoints incorrectly @RequireModule("finance_ar") for AP operations
- **File**: `controller/finance/ArApController.java`
  - Line 74: `POST /payable` → should be `finance_ap`
  - Line 88: `POST /payable/payment` → should be `finance_ap`
  - Line 106: `POST /adjustment` (handles both AR and AP via counterpartyType) → needs branch logic
- **Impact**: Factory with only `finance_ar` enabled can write AP transactions; factory with only `finance_ap` enabled cannot
- **R21 touched this exact file's `recordReceivable` but didn't sweep the @RequireModule annotations** — same-cause sweep failure
- **Fix R23**: change line 74/88 to `@RequireModule("finance_ap")`. For line 106, split into `/ar/adjustment` + `/ap/adjustment` OR conditional service-layer check

---

## R22 — Important (7)

### I1. validateReceivableStatus + validatePayableStatus duplicated
- File: `ArApServiceImpl.java:48-75` — two methods with identical structure (find → filter → orElseThrow → if not in whitelist → BusinessException)
- Same drift R21 fixed at module level, reborn at method level
- Fix R23: extract generic `OrderInvariantValidator` or single parameterized method

### I2. Race window between duplicate-check and SO status validation
- File: `ArApServiceImpl.java:119-130`
- No UNIQUE INDEX on `(factory_id, sales_order_id, transaction_type=AR_INVOICE)` — concurrent POSTs both pass dup check + validation, both insert
- Fix R23: add Flyway migration with partial unique constraint:
  ```sql
  CREATE UNIQUE INDEX uk_arap_ar_invoice_per_so
    ON ar_ap_transaction (factory_id, sales_order_id)
    WHERE transaction_type = 'AR_INVOICE' AND deleted_at IS NULL;
  ```

### I3. Tests pin own copy of whitelist — "31/31 PASS" is a tautology
- File: `ReferenceDataControllerTest.java:187-189` and 221-223 — hard-coded `Set.of(FINANCE_APPROVED, PROCESSING, PARTIAL_DELIVERED, COMPLETED)` instead of importing `OrderUsageWhitelists.SO_INVOICEABLE`
- Test passes mean controller agrees with TEST PIN, not with centralized constant
- Fix R23: add `OrderUsageWhitelistsTest.java`; refactor 31 tests to import the constant

### I4. EnumSet vs Set.of() inconsistency
- `OrderUsageWhitelists.java:54,78` use `EnumSet.complementOf(EnumSet.of(...))` for SO_ALL/PO_ALL
- Other constants use `Set.of(...)` (HashSet-backed) — wasteful for enum keys
- Fix R23: convert all to `EnumSet.of(...)` (~10× faster `contains` for enums)

### I5. Stringly-typed Map.of contracts
- `Map.of("invoiceable", ...)` — typo in client passes through to S1 fail-secure default, masking bugs
- Frontend ships `?usage=plannble` (typo) → returns invoiceable set silently → production planning dropdown breaks
- Fix R23: introduce `enum SoUsage { INVOICEABLE, SHIPPABLE, PLANNABLE, ALL }`; controller uses `valueOf` (rejects typo with 400)

### I6. ProductionPlanController.findAll() — full table scan + multi-tenant data leak
- File: `controller/ProductionPlanController.java:577-585`
- `salesOrderRepository.findAll().stream().filter(...)` loads ALL factories' SOs into JVM heap before filtering
- Invisible at 4 rows; OOM + leak at 10k
- Fix R23: replace with `findByFactoryIdAndStatusIn(factoryId, OrderUsageWhitelists.SO_PLANNABLE, pageable)`

### I7. R21 itself never tested on test env
- Manager admission. R21 changed `ReferenceDataController` static field load order — Spring class-init edge case OR `Map.of` immutable map throwing on null param somewhere it didn't before → silent dropdown EMPTY
- Invisible to mvn test (`@InjectMocks` ≠ Spring class-init order in prod)

---

## R22 — Minor (4)

- **M1**: `validateReceivableStatus` error message echoes input ID → low-impact info disclosure
- **M2**: `SO_SHIPPABLE` excludes COMPLETED but `createDelivery:556` accepts more permissive states — naming clarity
- **M3**: `@Autowired` consistency — fields at lines 78, 82 still `required=false` (silently disguised NPEs as validations passing)
- **M4**: "31/31 PASS" near-tautology (Mockito returns what test sets up) — see I3

---

## R22 Same-cause sweep (Rule 8) — R21 closed 1 of 9 sites

| File | Line | Verdict |
|---|---|---|
| `ArApServiceImpl.java` | 49,64,119,162 | ✅ R21 covered |
| `InvoiceServiceImpl.java` | 72,111 | ✅ R18+R21 covered |
| `PaymentRecordServiceImpl.java` | **48,144** | ❌ **C1** |
| `SalesServiceImpl.java` | **556-559, 820-823** | ❌ **C3** |
| `PurchaseServiceImpl.java` | **432-434** | ❌ **C3** |
| `ProductionPlanController.java` | **569-585** | ❌ **C3+I6** |
| `ArApController.java` | **74,88,106** | ❌ **C4** |
| `PaymentRecordController.java` | **32,65,75** | ❌ wrong module gate |
| `InvoiceController.java` | 33,71,88,101,113 | ✅ correct |
| `ai/tool/impl/sales/SalesCreateInvoiceTool.java` | 93 | ✅ delegates |
| `ai/tool/impl/sales/SalesRecordPaymentTool.java` | (unverified) | ⚠️ R23 must verify |
| `ai/tool/impl/finance/PaymentRecordTool.java` | 50 | ❌ inherits C1 |
| `ai/tool/impl/finance/InvoiceRequestFromOrderTool.java` | (unverified) | ⚠️ R23 must verify |
| `scheduler/*.java` | none | ✅ no scheduled jobs |
| `db/flyway/*.sql` | (3 invoice files) | ✅ no backfill |

**8 unaddressed write paths / inline copies / wrong RBAC tags. R21 closed 1 of 9 same-cause sites.**

---

## R23 — Real-window verification plan (20 deep tests)

R17-R21 have NEVER been front-end tested. R23 is the first window. Ordered by risk:

### A. Dropdown regression sweep (verifies R20→R21 didn't break front-end)
1. Login F001 super_admin → Canvas DYNAMIC SO create form → verify customerId/productTypeId/salesperson dropdowns return ≥1
2. AR invoice request form → verify salesOrderId dropdown returns ONLY post-finance-approved SOs (compare count to SQL)
3. DevTools: `GET /reference-data/sales-orders?usage=plannble` (typo) → expect S1 fail-secure to invoiceable
4. `?usage=plannable` → CONFIRMED + PENDING_FINANCE_REVIEW present
5. `?usage=all` → everything except DRAFT/CANCELLED/FINANCE_REJECTED
6. Repeat 1-5 for purchase orders

### B. Write-path invariant tests (verifies R18+R20+R21 actually fires)
7. Create DRAFT SO via UI, POST `/finance/receivable` with that ID → expect 409 hint "先完成财务审核流程"
8. CANCELLED SO → 409
9. PENDING_FINANCE_REVIEW SO → 409
10. Promote to FINANCE_APPROVED → 200 with AR_INVOICE
11. Repeat 7-10 for `/finance/payable` (APPROVED PO should reject — only post-finance allowed)
12. Repeat 7-10 for `/finance/invoice/request` (R18 path, never real-window verified)

### C. C1 PaymentRecordServiceImpl gap (NEW finding)
13. POST `/finance/payments/record` with DRAFT SO → currently 200, post-fix 409
14. **Cross-tenant**: F001 user POSTs with F002's salesOrderId → currently 200 with leaked F002 data, post-fix 404

### D. C4 module gate corrections
15. Disable `finance_ap`, keep `finance_ar` → POST `/finance/payable` → currently 200 (wrong), post-fix 400
16. Disable `finance_ar`, keep `finance_ap` → POST `/finance/payable` → currently 400 (wrong reason), post-fix 200

### E. C2 recordAdjustment gap
17. salesperson with `sales:read_write` only → POST `/finance/adjustment` → 403
18. user with `finance:read_write` → POST adjustment with negative amount → currently 200 silently zeros customer balance, post-fix requires elevated permission OR pending-approval

### F. Concurrent insert race (I2)
19. 2 browser sessions same user → both submit AR invoice for same SO simultaneously → currently both 200 (duplicate AR_INVOICE), post-fix one returns 409

### G. Soft-delete race (M1)
20. Open AR form, select SO from dropdown → soft-delete SO in DB console → submit → expect 404 (UX could improve)

---

## R22 meta-observations: why 11 reviewers missed these

**C1 missed because**: Audit narrative anchored on "AR/AP transaction write paths" via ArApService. PaymentRecord is *upstream* of an AR write (verifyPayment → arApService.recordArPayment) — every reviewer pattern-matched recordReceivable/recordPayable/requestInvoice and stopped grep'ing. Cross-tenant findById bug at line 48 has been there since 2026-03-30 (V20260330).

**C3 missed because**: R21 framed as cleanup round, not discovery. Reviewers validated "the 5 callers in the diff are refactored." Nobody re-grep'd MAIN to find OTHERS. Commit message "5 copies" anchored — every reviewer counted to 5 and stopped.

**C4 missed because**: Class-level `@RequireModule` invisible during method-body diff review. Reading line-by-line you see "finance_ar" once and assume it matches the class.

**I3 missed because**: "31/31 PASS" is the ultimate dismissal. Reviewer would need to read the test internals to spot that the assertion pins its own copy of the constant.

**Bias pattern**: Each round narrowed coverage to its own commit. R21 was a refactor round → reviewers checked refactor correctness, not the broader "are inline whitelists all gone" sweep. Manager admission about no real-window testing compounds — whole thread runs on `mvn test` confidence which has been shown to mean little.

---

## R23 execution order (recommended)

Per user directive "先跑完r22把，然后再去23的时候按照22的结果去全部补上":

**Phase 1 — Backend C-fixes** (~2-3h):
1. C1 PaymentRecordServiceImpl.recordPayment fix (factoryId filter + validateReceivableStatus mirror)
2. C3 OrderUsageWhitelists expansion (SO_DELIVERABLE / SO_IN_FLIGHT / PO_RECEIVABLE_OPS_ONLY) + refactor 4 callers
3. C4 ArApController @RequireModule corrections + split adjustment endpoint
4. C2 recordAdjustment elevated permission OR approval-required (decision point — needs user input)

**Phase 2 — Test coverage** (~1h):
5. I1 extract OrderInvariantValidator (or accept one-time duplication, document why)
6. I3 OrderUsageWhitelistsTest + refactor ReferenceDataControllerTest to import constants
7. I2 Flyway migration for unique constraint

**Phase 3 — Real-window verification** (~3-4h):
8. Deploy R23 to test (10011)
9. Run 20 deep tests via Playwright (isolated chromium, profile separate from sibling chats)
10. Capture screenshots + curl outputs as evidence
11. If any test fails → loop back to fix → redeploy → retest

**Phase 4 — Prod ship** (~30min):
12. Test green → deploy prod (10010)
13. Re-verify dropdown subset (5 quick smoke from group A) on prod
14. Push origin
15. Update memory with R22+R23 results

**Estimated total**: 6-8h continuous work. Could split across 2 chats — Phase 1+2 in this chat, Phase 3+4 in next chat after fresh context.

---

## What R23 should NOT do

- Do NOT trust commit messages (R21 lied about 5 copies). Always grep MAIN.
- Do NOT count "tests pass" as evidence unless test imports the actual constant under test.
- Do NOT skip the 20 real-window tests because "backend tests pass". The whole arc has been backend-test confidence with zero front-end verification.
- Do NOT add new validation/abstraction without first surveying ALL existing call sites (R21's "5 copies" failure).
