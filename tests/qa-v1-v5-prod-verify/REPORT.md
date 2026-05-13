# R1 RBAC prod verify — F1 (PR #495) + V1-V5 (PR #489)

**Date**: 2026-05-13
**Branch**: `qa/v1-v5-prod-verify`
**Operator**: chat4 (organizer dispatch)
**Verdict**: **0 LEAKS. 11 PASS + 1 PASS-GATE-ONLY (data-limited). 0 FAIL.**

## Scope

Real prod verify (no mocks, no test env) of two RBAC fixes:

| PR | Scope | State |
|---|---|---|
| #495 | F1: `ProductionAnalyticsController.budget-vs-actual` cost-field gate | MERGED |
| #489 | V1-V5 + sibling: 5 controllers + WastageRecordController.statistics | MERGED |

## Method

- Endpoint: `http://139.196.165.140:8086/api/mobile/...` (nginx → 47 prod Java BG)
- Login via `POST /api/mobile/auth/unified-login`, `password=123456`
- F006 prod accounts (Steve directive — `reference_f006_liutengmen_prod_accounts.md`):
  - `f006_admin` (factory_super_admin, perms `*:*`)
  - `f006_warehouse_mgr` (warehouse_manager — has `warehouse:*`, `production:read`, `dashboard:read` per PERMISSION_MATRIX; **lacks** `finance:read`, `procurement:price:view`)
- F001 supplemental accounts for F1 strip observation (F006 has 0 production plans):
  - `factory_admin1` (factory_super_admin)
  - `warehouse_mgr1` (warehouse_manager)
- Per-username 60 s login rate-limit honored (login each user once, reuse token).

## Findings

### F1 budget-vs-actual (PR #495) — STRIP WORKING

**F001 (51 plans, full data):**

| Role | HTTP | Rows | Cost keys present | Non-null cost values |
|---|---|---|---|---|
| `factory_admin1` | 200 | 51 | 408/408 | 366/408 (89%) — real costs visible |
| `warehouse_mgr1` | 200 | 51 | 408/408 (stable contract) | **0/408** — all 8 cost values nulled |

Concrete sample (row 0):

| Field | admin | warehouse_mgr |
|---|---|---|
| `estimatedMaterialCost` | `1166.0` | `null` |
| `actualMaterialCost` | `5347.0` | `null` |
| `estimatedLaborCost` | `996.0` | `null` |
| `actualLaborCost` | `1764.0` | `null` |
| `estimatedEquipmentCost` | `617.0` | `null` |
| `actualEquipmentCost` | `389.0` | `null` |
| `estimatedOtherCost` | `null` | `null` |
| `actualOtherCost` | `null` | `null` |
| `planId` / `planNumber` / `productName` / `status` | present | present |

Verdict: **PASS — defense-in-depth `resolveCanViewCosts` correctly nulls all 8 cost values for warehouse_mgr while preserving the key contract.**

**F006 (0 plans, gate-only verify):**

| Role | HTTP | Rows |
|---|---|---|
| `f006_admin` | 200 | 0 |
| `f006_warehouse_mgr` | 200 | 0 |

Verdict: **PASS-GATE-ONLY — gate behavior matches design (both 200, annotation gate `{finance:read, production:read}` OR-passes warehouse_mgr via `production:read`); field-strip not observable due to empty plan list.**

### ⚠ Doc bug in PR #495 description

PR #495's effect matrix claims:

| Caller role | finance:read | production:read | Before | After |
|---|---|---|---|---|
| `warehouse_mgr1` | ❌ | ❌ | 200 + 8 cost cols leaked | **403** |

This is **wrong** about `warehouse_mgr1`:
- `warehouse_manager` role **has** `production:read` per `PERMISSION_MATRIX line 167` (referenced in `R6V3MaterialConsumptionRbacTest.java:29` test class comment) and per `frontend/CretasFoodTrace/src/types/auth.ts:498`.
- Therefore the `@RequirePermission({"finance:read", "production:read"})` (default `requireAll=false`, OR) annotation gate **passes** warehouse_mgr.
- The actual strip mechanism is the in-method `resolveCanViewCosts(authorization)` defense-in-depth, which gates on `finance:read` only. warehouse_mgr lacks `finance:read`, so cost values are nulled while keys stay (stable client contract — explicitly documented in the controller source, `ProductionAnalyticsController.java:194-201`).
- The PR description's `quality_inspector` row in the same table is similarly wrong (quality_inspector also has `production:read` — would also get 200 + nulled costs, not 403).

The **code design and behavior are CORRECT** (defense-in-depth nulling proven on F001 with real data); only the PR description prose / matrix table needs a follow-up amend per `feedback_organizer_verbal_signoff_must_amend_spec.md`. Recommend an amend-PR or comment on #495 correcting the after-state for `warehouse_mgr1` and `quality_inspector` rows.

### V1-V5 + Sibling (PR #489) — ALL GATES WORKING

| # | Endpoint | admin | warehouse_mgr | Verdict |
|---|---|---|---|---|
| V1 | `/restaurant-dashboard/summary` | 200 | **403** | PASS |
| V2 | `/reports/inventory` | 200 | **403** | PASS |
| V2 | `/reports/finance` | 200 | **403** | PASS |
| V2 | `/reports/dashboard/overview` | 200 | **403** | PASS |
| V3 | `/processing/material-consumptions/stats` | 200 | **403** | PASS |
| V3 | `/processing/material-consumptions` (list) | 200 | **403** | PASS |
| V4 | `/supplier-admission/report/{id}` | 400¹ | **403** | PASS |
| V5 | `/price-lists` (list) | 200 | **403** | PASS |
| V5 | `/price-lists/effective` | 200 | **403** | PASS |
| Sibling | `/restaurant/wastage/statistics` | 200 | **403** | PASS |

¹ Fake UUID `00000000-...` — admin gate passes, controller returns 400 (validation), not 403. Confirms `PermissionInterceptor.preHandle` runs **before** the body and the annotation gate is permissive for admin.

All 10 endpoints: `warehouse_manager` blocked at the annotation gate (`procurement:price:view, finance:read, finance:read_write` — none held). No bypass.

## Outputs

- `tests/qa-v1-v5-prod-verify/results.json` — machine-readable verdict per endpoint
- `tests/qa-v1-v5-prod-verify/verify.py` — re-runnable Python harness
- `tests/qa-v1-v5-prod-verify/login_*.json` — captured tokens / login responses
- `tests/qa-v1-v5-prod-verify/f1_*.json` — F1 raw response bodies (admin + warehouse_mgr, F006 + F001)
- `tests/qa-v1-v5-prod-verify/REPORT.md` — this file

## Conclusion

**0 LEAKS.** Both PR #495 (F1 defense-in-depth cost null-strip) and PR #489 (V1-V5 + sibling class/method-level gates) are live on prod and correctly enforcing intended RBAC for the `warehouse_manager` role on F001 + F006.

One **doc-only follow-up**: PR #495 description's effect matrix mislabels `warehouse_mgr1` and `quality_inspector` after-states (claims 403; actual = 200 + 8 cost keys nulled). Recommend amending the PR description / opening a docs follow-up — no code change needed.

## Re-run

```bash
cd C:/Users/Steve/cretas-r1-rbac-verify
python tests/qa-v1-v5-prod-verify/verify.py
```

Tokens in `login_*.json` expire after 24 h; re-login via the harness's prior steps if needed.
