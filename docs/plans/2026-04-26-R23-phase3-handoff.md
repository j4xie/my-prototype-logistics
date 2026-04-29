# R23 Phase 3+4 Handoff — for next chat

**Branch**: `e2e/v1-framework`
**P1+P2 commit**: `ee78b0495` (NOT YET DEPLOYED — sitting on local branch)
**Original audit**: `docs/plans/2026-04-26-R22-audit-and-R23-plan.md`

---

## Why this handoff exists

R22 reviewer #12 forced acknowledgement that R17-R21 had ZERO real-window front-end testing — only `mvn test` + log inspection. User directive: do R22 audit, then in R23 補上 all real-window verification per R22's findings.

R23 P1+P2 (this chat) shipped:
- C1 PaymentRecordServiceImpl cross-tenant + status validation
- C2 PENDING_APPROVAL adjustment workflow (V20260426_01 migration + 2 new endpoints + ArApApprovalStatus enum)
- C3 4 more inline whitelists centralized + JPQL push-down for ProductionPlanController
- C4 @RequireModule fixes on ArApController (3 endpoints)
- I2 V20260426_02 unique partial indexes for AR_INVOICE/AP_INVOICE
- I3 OrderUsageWhitelistsTest (15 tests) + ReferenceDataControllerTest refactor to import constants
- BONUS: caught + fixed latent NPE in resolveSO/resolvePO when usage=null
- I4 EnumSet conversion throughout

**46/46 tests PASS**. Code on local branch, ready for test deploy.

---

## Phase 3 — 20 real-window deep tests (3-4h)

**CRITICAL**: Use isolated Playwright profile. Sibling chats are also using Playwright per CLAUDE.md context. Spawn chromium with `--user-data-dir=/tmp/r23-chrome-profile-isolated` or use the `mcp__playwright-test__browser_open` with a unique session.

### Pre-flight

1. `cd /c/Users/Steve/my-prototype-logistics/backend/java/cretas-api`
2. Deploy P1+P2 commit `ee78b0495` to test (10011):
   ```bash
   bash scripts/deploy/deploy-backend.sh --env test
   ```
3. Verify backend up: `ssh root@47.100.235.168 'curl -sS http://localhost:10011/api/mobile/health'` → expect `{"status":"UP"}`
4. Verify Flyway migrations applied:
   ```bash
   ssh root@47.100.235.168 'sudo -iu postgres psql -d cretas_db -c "SELECT version, description, success FROM flyway_schema_history WHERE version LIKE '"'"'20260426%'"'"' ORDER BY installed_on;"'
   ```
   Expect: V20260426_01 + V20260426_02 both `success=t`.
5. Verify schema additions:
   ```bash
   ssh root@47.100.235.168 'sudo -iu postgres psql -d cretas_db -c "\d ar_ap_transactions" | grep -E "approval_status|approved_by|approved_at"'
   ```

### Test credentials

Per CLAUDE.md, real credentials are in user's local `.env.test` (NOT committed). Format example in `.env.test.example`. F001 `super_admin` account works for all tests below. May also need:
- A user with `finance:read_write` only (not super_admin) — for C2 / E18 tests
- A user with `finance:approve_adjustment` (new permission) — for C2 approval flow

If `finance:approve_adjustment` permission isn't yet assigned to any role, that's acceptable for P3 — note it as a P4 follow-up to grant via 系统管理 / 角色权限.

### The 20 tests (organized by group)

**Group A — Dropdown regression sweep (verifies R20→R23 didn't break front-end)**

1. F001 super_admin → Canvas DYNAMIC SO create form → verify customerId / productTypeId / salesperson dropdowns each return ≥1
2. AR invoice request form → verify salesOrderId dropdown returns ONLY post-finance-approved SOs. Compare:
   ```sql
   SELECT COUNT(*) FROM sales_orders WHERE factory_id='F001' AND status IN ('FINANCE_APPROVED','PROCESSING','PARTIAL_DELIVERED','COMPLETED') AND deleted_at IS NULL;
   ```
   to dropdown count.
3. DevTools fetch `GET /api/mobile/F001/reference-data/sales-orders?usage=plannble` (typo) → expect S1 fail-secure to invoiceable set (count matches SO_INVOICEABLE)
4. `?usage=plannable` → CONFIRMED + PENDING_FINANCE_REVIEW SOs present
5. `?usage=all` → everything except DRAFT/CANCELLED/FINANCE_REJECTED
6. Repeat 1-5 for purchase orders (`/reference-data/purchase-orders?usage=...`)

**Group B — Write-path invariant tests (verifies R18+R20+R21+R23 actually fires)**

7. Create DRAFT SO via UI, note ID. POST `/api/mobile/F001/finance/receivable` with that ID → expect 409 hint "先完成财务审核流程"
8. Same with CANCELLED SO → 409
9. PENDING_FINANCE_REVIEW SO → 409
10. Promote to FINANCE_APPROVED → POST → 200 with AR_INVOICE created
11. Repeat 7-10 for `/finance/payable` (APPROVED PO should reject — only post-finance-approved allowed)
12. Repeat 7-10 for `/finance/invoice/request` (R18 path, never real-window verified)

**Group C — C1 PaymentRecordServiceImpl gap (NEW R22 finding)**

13. POST `/api/mobile/F001/finance/payments/record` with DRAFT SO → expect 409 (post-R23) — pre-R23 was 200 with PaymentRecord stored
14. **Cross-tenant**: F001 user POSTs with F002's salesOrderId (need to seed F002 SO first if not present) → expect 404 "销售订单不存在" — pre-R23 was 200 with leaked F002 customer name in payment_records

**Group D — C4 module gate corrections**

15. Disable `finance_ap` for F001 (keep `finance_ar`) via 系统管理 / 模块开关 → POST `/finance/payable` → expect 400 "模块 finance_ap 未启用" — pre-R23 was 200 (wrong module checked)
16. Disable `finance_ar` (keep `finance_ap`) → POST `/finance/payable` → expect 200 — pre-R23 was 400 (wrong reason)
   (Restore both modules after this group)

**Group E — C2 recordAdjustment PENDING_APPROVAL flow (NEW R23 design)**

17. salesperson with only `sales:read_write` → POST `/finance/adjustment` → expect 403 (no `finance:read_write`)
18. user with `finance:read_write` (e.g., factory_super_admin) → POST `/finance/adjustment` with `{counterpartyType:CUSTOMER, counterpartyId:X, amount:-10000, remark:"test"}`:
    - Expect 200 with `approvalStatus=PENDING`, `approvedBy=null`, `approvedAt=null`
    - Verify customer.currentBalance UNCHANGED in DB (pre-R23 it would have decreased by 10000)
19. SAME user POSTs `/finance/adjustment/{id}/approve` → expect 403 with "审批人不能与提交人相同 (4 眼原则)"
20. Different user (with `finance:approve_adjustment`) POSTs approve → expect 200 with `approvalStatus=APPROVED`. Verify customer.currentBalance NOW decreased by 10000.

**Group F — Concurrent insert race (I2 unique constraint)** — bonus, optional

- Open 2 browser sessions same user, both submit AR invoice request for same FINANCE_APPROVED SO simultaneously → expect ONE returns 200, OTHER returns 409 with PSQLException unique violation translated to 409.

**Group G — Soft-delete race (M1)** — bonus, optional

- Open AR form, select SO from dropdown → in DB console: `UPDATE sales_orders SET deleted_at=NOW() WHERE id='X'` → submit form → expect 404 "销售订单不存在"

### Evidence capture

For each test, capture:
- Network tab screenshot (URL + request body + response status + response body)
- DB state before/after (relevant rows from sales_orders / customer / ar_ap_transactions)
- Console errors (if any)

Save to `tests/e2e-comprehensive/results/r23-realwindow/test-{N}-{name}.{png,json}`.

### Decision criteria

- **All A1-A6 PASS** → R20→R23 didn't break dropdowns ✅
- **All B7-B12 PASS** → R18+R20+R21 invariants actually fire ✅
- **C13-C14 PASS** → R22 C1 fix lands properly ✅ (pre-R23 these would FAIL)
- **D15-D16 PASS** → R22 C4 fix lands ✅
- **E17-E20 PASS** → R22 C2 PENDING_APPROVAL workflow works end-to-end ✅
- **F+G** are stretch goals, OK to defer

If ANY A-E test fails, loop back to fix → redeploy → retest. Do NOT proceed to Phase 4.

---

## Phase 4 — Prod ship + push origin (30min)

After Phase 3 green:

1. **Deploy prod**: `bash scripts/deploy/deploy-backend.sh --env prod`
2. **Verify prod health**: `ssh root@47.100.235.168 'systemctl status cretas-backend --no-pager'`
3. **Re-run quick A-group smoke on prod** (5 tests) to confirm dropdowns still work post-deploy
4. **Push origin**: `git push origin e2e/v1-framework`
5. **Update memory** — add new entry to `MEMORY.md`:
   ```
   ## Apr 26 2026 — R22 audit + R23 4-phase complete (canvas dynamic close-out)
   - [R22+R23 close-out](project_apr26_r22_r23_closeout.md) — R22 reviewer #12 found 4 critical bugs 11 prior reviewers missed. R23 fixed all + first-ever real-window deep verification of R17-R23 arc.
   ```
   And create `project_apr26_r22_r23_closeout.md` with:
   - C1 PaymentRecordServiceImpl cross-tenant fix
   - C2 PENDING_APPROVAL workflow
   - C3 4 more whitelists centralized
   - C4 RBAC module gate corrections
   - 20 deep tests results (A1-A6, B7-B12, C13-C14, D15-D16, E17-E20)
   - Latent bug caught: resolveSO null NPE
   - 46/46 unit tests + 20/20 deep tests PASS

---

## Things to be careful about

- **Concurrent edit risk**: P1+P2 commit `ee78b0495` is on `e2e/v1-framework` not pushed. If a parallel session also commits to this branch, fast-forward can fail. Pull --rebase before push.
- **Frontend changes for C2 PENDING approval**: NOT YET DONE. Backend is ready (POST /adjustment now returns PENDING transaction). Frontend admin UI for approval queue is OUT OF SCOPE for R23 — file as P5 follow-up (admin页 to list PENDING adjustments + approve/reject buttons).
- **Permission `finance:approve_adjustment`**: NOT YET assigned to any role. R23 backend defines it. Frontend role management UI assigns it. Either:
  - (a) Assign manually to factory_super_admin via SQL during P3 setup
  - (b) Add a new R23 migration that auto-grants to factory_super_admin role
  - (c) Defer to P5 (admin manually grants)
  Test E20 needs SOMEONE with this permission — choose (a) for P3 expediency.

---

## Files changed in P1+P2 commit ee78b0495

```
backend/java/cretas-api/src/main/java/com/cretas/aims/controller/ProductionPlanController.java          | 13 +--
backend/java/cretas-api/src/main/java/com/cretas/aims/controller/finance/ArApController.java            | 56 +++++++++--
backend/java/cretas-api/src/main/java/com/cretas/aims/domain/OrderUsageWhitelists.java                  | 92 +++++++++++++-----
backend/java/cretas-api/src/main/java/com/cretas/aims/entity/enums/ArApApprovalStatus.java              | 25 +++++
backend/java/cretas-api/src/main/java/com/cretas/aims/entity/finance/ArApTransaction.java               | 17 +++-
backend/java/cretas-api/src/main/java/com/cretas/aims/repository/inventory/SalesOrderRepository.java    | 11 ++-
backend/java/cretas-api/src/main/java/com/cretas/aims/service/finance/ArApService.java                  | 22 ++++-
backend/java/cretas-api/src/main/java/com/cretas/aims/service/finance/impl/ArApServiceImpl.java         | ~150 +++
backend/java/cretas-api/src/main/java/com/cretas/aims/service/finance/impl/PaymentRecordServiceImpl.java | 19 +++-
backend/java/cretas-api/src/main/java/com/cretas/aims/service/inventory/impl/PurchaseServiceImpl.java   | 11 ++-
backend/java/cretas-api/src/main/java/com/cretas/aims/service/inventory/impl/SalesServiceImpl.java      | 18 +-
backend/java/cretas-api/src/main/resources/db/flyway/V20260426_01__arap_adjustment_approval_workflow.sql | NEW
backend/java/cretas-api/src/main/resources/db/flyway/V20260426_02__arap_unique_invoice_per_order.sql     | NEW
backend/java/cretas-api/src/test/java/com/cretas/aims/controller/ReferenceDataControllerTest.java       | 12 +-
backend/java/cretas-api/src/test/java/com/cretas/aims/domain/OrderUsageWhitelistsTest.java              | NEW
docs/plans/2026-04-26-R22-audit-and-R23-plan.md                                                          | NEW
```
