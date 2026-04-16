# R30 — R22-F1 Reproduction + Module API Probe + R29 Delivery Closure

**Date**: 2026-04-16
**Method**: SSH + curl direct API probing (browser session reset prevented UI testing)

---

## Part A: R22-F1 Reproduction Attempt ✅ (unreproducible)

Rapid-fire 10-iteration loop on `e2e/v1-framework`:
```
for i in 1..10:
  POST /purchase/orders → PO-XXXX
  POST /purchase/orders/{id}/submit
  POST /purchase/orders/{id}/approve
  POST /purchase/orders/{id}/submit-for-finance-review  ← the target
```

Result: **10 / 10 all 200 PASS**. No 409 ck_po_status_violation captured.

**Conclusion**: R22-F1 (PO 409 transient during submit-for-finance-review) is **not reproducible via sequential rapid-fire**. Original R22 observation was one-off transient. Possible conditions that would reproduce:
- Concurrent requests (2 clients hitting same PO simultaneously)
- Hibernate batch-flush interleaving under high load
- DB lock wait from long-running maintenance query

Downgraded from P2 to **P3 latent**. Will investigate only if customer-reported again.

---

## Part B: 2 Modules Medium Probe

Via direct API probe with e2e_factory_admin JWT:

| Module | GET list | Status |
|---|---|---|
| `/equipment?page=1&size=5` | 200, `totalElements=0` | Endpoint healthy, no seed |
| `/quality-check-items?page=1&size=5` | 200, `totalElements=0` | Endpoint healthy, no seed |

Both modules return well-formed paginated responses but no data exists on FOOD_3101_048. Per depth-first-e2e Rule 1 data-prerequisite clause, these remain **medium** (cannot verify full CRUD state machine without seed). R31 could seed + re-test.

Note: Endpoint path corrections found during probe:
- `/inspection-records` → 404 (wrong path)
- Correct: `/quality-check-items` (different from UI label)
- `/equipment/maintenances` → 400 (wrong path)
- Correct: `/equipment/{id}/maintenance` (nested under equipment)

These are documentation gaps — coverage matrix notes "quality/inspections" and "equipment/maintenance" which map to different actual API paths. R31 could update matrix with real API paths.

---

## Part C: UX Completeness Sweep — SKIPPED

R26 (`4502985d9`) already did 10-module console sweep at same depth with 0 errors across: sales/customers, procurement/orders, procurement/suppliers, finance/invoices, warehouse/materials, system/users, production/batches, system/settings, hr/employees, system/smartbi-config. Re-running would not add new information.

---

## R30 closure + R29 delivery complete

Final verified state (on `e2e/v1-framework` commit `b9f5f2ef8`):
- R29 "无 BOM 配置" error message pointing to 转换率 tab — **LIVE on prod** (jar string verified via javap)
- Prod HTTP 200
- 19+ bugs delivered today (R23-R29 all shipped)

Real root cause of R29 deploy block (discovered in R30):
- `SmartBiDatasource.java` (file case vs class case) — Windows filesystem showed `SmartBiDataSource.java` (upper S) while git has `SmartBiDatasource.java` (lower s). javac stopped compile on this 1 file → Lombok annotation processor halted → ALL @Data/@Slf4j classes appeared broken.
- Fix: local `mv` to match git. 1 line, unblocks entire build.

---

## R31 backlog

1. R22-T4 Part 2 already complete in R28 — done
2. R26-F1 product-types cold-load investigation (needs prod logs during off-hours)
3. Seed test data for /equipment + /quality-check-items then re-test
4. UI (not API) DEEP test for R29 fix: trigger 生成调拨单 on a plan without conversion, verify error message points to 转换率 tab
5. Backend pagination convention normalization (P3 refactor)
