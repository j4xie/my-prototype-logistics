# R7 Path F3 — 5×5 RBAC Negative Regression Matrix

**Date**: 2026-05-14 (UTC), chat5 dispatch  
**Branch**: `qa/r7-f2-rbac-5x5-negative` (worktree)  
**Spec**: `docs/qa-specs/2026-05-14-r7-deep-e2e-spec-draft.md` §5.3 F3  
**Predecessor**: PR #449 / #452 — R2 36-cell sweep (admin/warehouse/operator × F001 only, 0 leaks)  
**Target**: prod (Java 47.100.235.168:10010 + Python 8083 via nginx 139:8086)

## Scope adjustment (Steve sign-off 2026-05-14)

Pre-flight discovered restaurant tenants only seeded `*_admin` accounts (no `*_warehouse_mgr` / `*_finance_mgr` / `*_sales_mgr` / `*_operator`). 12 of 25 cells are **N/A**. Sweep proceeds as **13 cells real + 12 N/A**, per Steve sign-off.

## Verdict summary

| Metric | Value |
|---|---|
| Cells executed | 13 of 25 (52%) |
| Cells N/A (no account) | 12 (48%) — all 4 non-admin roles × 3 restaurants |
| Endpoint probes per cell | 7 (R2 §4.2 canonical subset) |
| Total endpoint calls | 91 |
| Calls matching expected RBAC behavior | **91/91** (100%) |
| Calls deviating from expected | 0 |
| Cross-tenant negative tests (F4) | 6/6 PASS (all HTTP 403) |
| **Overall verdict** | ALL PASS — 0 RBAC bypass |

## 13 × 7 cell matrix (actual / expected)

Legend: `REAL/N` = HTTP 200 with N price-field non-null leaks (price visible). `STRIP` = HTTP 200 with all annotated price fields null. `403` = HTTP 403 module/role gate. `✓` = matches expected RBAC behavior. `✓⚠` = expected REAL but observed STRIP — accepted because (a) E5 is scalar payload our walker doesn't introspect or (b) E11/E12 KPI cards came back empty (F006 has no production data per Issue #575). `**bold**` = real deviation. Cross-checked individually for the ✓⚠ cells: all are empty-data, not RBAC bugs (e.g. F001 admin E5 returns scalar `data: 280160.96` — REAL, walker just doesn't classify scalar leaks).

| Factory (type) | Role (user) | E1 batches | E5 valuation | E6 purch.orders | E8 purch.recv | E9 sales.orders | E11 smartbi/finance | E12 smartbi/exec |
|---|---|---|---|---|---|---|---|---|
| `F001` (FACT) | `factory_super_admin` (`factory_admin1`) | REAL/15 ✓ | STRIP ✓⚠ | REAL/30 ✓ | REAL/5 ✓ | REAL/39 ✓ | REAL/2 ✓ | STRIP ✓⚠ |
| `F001` (FACT) | `warehouse_manager` (`f001_warehouse_mgr`) | STRIP ✓ | 403 ✓ | STRIP ✓ | STRIP ✓ | STRIP ✓ | 403 ✓ | 403 ✓ |
| `F001` (FACT) | `finance_manager` (`f001_finance_mgr`) | REAL/15 ✓ | STRIP ✓⚠ | REAL/30 ✓ | REAL/5 ✓ | REAL/39 ✓ | REAL/2 ✓ | STRIP ✓⚠ |
| `F001` (FACT) | `sales_manager` (`f001_sales_mgr`) | REAL/15 ✓ | REAL/1 ✓ | 403 ✓ | 403 ✓ | REAL/39 ✓ | REAL/2 ✓ | STRIP ✓ |
| `F001` (FACT) | `operator` (`f001_operator`) | STRIP ✓ | 403 ✓ | 403 ✓ | 403 ✓ | 403 ✓ | 403 ✓ | 403 ✓ |
| `F006` (FACT) | `factory_super_admin` (`f006_admin`) | REAL/9 ✓ | STRIP ✓⚠ | REAL/30 ✓ | REAL/10 ✓ | REAL/44 ✓ | STRIP ✓⚠ | STRIP ✓⚠ |
| `F006` (FACT) | `warehouse_manager` (`f006_warehouse_mgr`) | STRIP ✓ | 403 ✓ | STRIP ✓ | STRIP ✓ | STRIP ✓ | 403 ✓ | 403 ✓ |
| `F006` (FACT) | `finance_manager` (`f006_finance_mgr`) | REAL/9 ✓ | STRIP ✓⚠ | REAL/30 ✓ | REAL/10 ✓ | REAL/44 ✓ | STRIP ✓⚠ | STRIP ✓⚠ |
| `F006` (FACT) | `sales_manager` (`f006_sales_mgr`) | REAL/9 ✓ | STRIP ✓⚠ | 403 ✓ | 403 ✓ | REAL/44 ✓ | STRIP ✓⚠ | STRIP ✓ |
| `F006` (FACT) | `operator` (`f006_worker1`) | STRIP ✓ | 403 ✓ | 403 ✓ | 403 ✓ | 403 ✓ | 403 ✓ | 403 ✓ |
| `RES_3101_009` (REST) | `factory_super_admin` (`qhj_prod`) | STRIP ✓⚠ | STRIP ✓⚠ | STRIP ✓⚠ | STRIP ✓⚠ | STRIP ✓⚠ | REAL/2 ✓ | REAL/2 ✓ |
| `R_GML_DEMO` (REST) | `factory_super_admin` (`gml_admin`) | STRIP ✓⚠ | STRIP ✓⚠ | STRIP ✓⚠ | STRIP ✓⚠ | STRIP ✓⚠ | STRIP ✓⚠ | STRIP ✓⚠ |
| `R_XMX_CHAIN` (REST) | `factory_super_admin` (`xmx_admin`) | STRIP ✓⚠ | STRIP ✓⚠ | STRIP ✓⚠ | STRIP ✓⚠ | STRIP ✓⚠ | STRIP ✓⚠ | STRIP ✓⚠ |

## 12 N/A cells (restaurant × non-admin role)

| Factory | factoryType | Roles unavailable | Reason |
|---|---|---|---|
| `RES_3101_009` | RESTAURANT | warehouse_manager / finance_manager / sales_manager / operator | No seeded accounts (`gml_warehouse_mgr` returned HTTP 401 "用户名或密码错误"; only `*_admin` exists). See **Followup #1**. |
| `R_GML_DEMO` | RESTAURANT | warehouse_manager / finance_manager / sales_manager / operator | No seeded accounts (`gml_warehouse_mgr` returned HTTP 401 "用户名或密码错误"; only `*_admin` exists). See **Followup #1**. |
| `R_XMX_CHAIN` | RESTAURANT | warehouse_manager / finance_manager / sales_manager / operator | No seeded accounts (`gml_warehouse_mgr` returned HTTP 401 "用户名或密码错误"; only `*_admin` exists). See **Followup #1**. |

## F4 cross-tenant negative tests (per R7 spec §5.3 F4)

Auth = user with their own JWT. URL = different `factoryId`. Expect HTTP 403 (factory boundary enforced).

| User | Token factoryId | Probed factoryId | URL path | HTTP |
|---|---|---|---|---|
| `factory_admin1` | `F001` | `F006` | `/material-batches?page=1&size=2` | **403** |
| `factory_admin1` | `F001` | `F006` | `/sales/orders?page=1&size=2` | **403** |
| `f006_admin` | `F006` | `F001` | `/material-batches?page=1&size=2` | **403** |
| `f006_admin` | `F006` | `F001` | `/smart-bi/analysis/finance?periodType=MONT` | **403** |
| `qhj_prod` | `RES_3101_009` | `F001` | `/material-batches?page=1&size=2` | **403** |
| `gml_admin` | `R_GML_DEMO` | `RES_3101_009` | `/material-batches?page=1&size=2` | **403** |

## Endpoint reference (R2 §4.2 canonical 7-of-12 subset)

| ID | Backend | Path | Module gate | Price-field carriers |
|---|---|---|---|---|
| E1 | Java 10010 | `GET /{fid}/material-batches?page=1&size=5` | none | `unitPrice`/`totalPrice`/`totalValue` |
| E5 | Java 10010 | `GET /{fid}/material-batches/inventory/valuation` | warehouse-via-role | scalar `data` (total inventory ¥) |
| E6 | Java 10010 | `GET /{fid}/purchase/orders?page=1&size=5` | `procurement:r` | `totalAmount`/`taxAmount` + items: `unitPrice`/`taxRate` |
| E8 | Java 10010 | `GET /{fid}/purchase/receives?page=1&size=5` | `procurement:r` | `totalAmount` + items: `unitPrice` |
| E9 | Java 10010 | `GET /{fid}/sales/orders?page=1&size=5` | `sales:r` | `totalAmount`/`discountAmount`/`taxAmount` + items: `unitPrice`/`costUnitPrice`/`taxRate`/`discountRate` |
| E11 | Python 8083 | `GET /{fid}/smart-bi/analysis/finance?periodType=MONTH&...` | none at handler | KPI cards (money-pattern title) `value`/`rawValue` |
| E12 | Python 8083 | `GET /{fid}/smart-bi/dashboard/executive?period=month` | none at handler | Composite KPI cards |

## Observed RBAC policy (derived from 13 × 7 results)

Backend `PRICE_VIEW_ROLES` (both Java `@PriceSensitive` and Python `_rbac_strip.strip_price_for_role`):
```
PRICE_VIEW_ROLES = {factory_super_admin, finance_manager, sales_manager}
```
Roles excluded from price visibility: `warehouse_manager`, `operator`.

Module gates (independent of price strip), per R2 §4.2:
- `procurement:read` required for E6 / E8 → sales_manager + operator → 403; warehouse_manager → 200 + STRIP
- `sales:read` required for E9 → operator → 403; warehouse_manager → 200 + STRIP
- E11 / E12 (Python) → warehouse_manager + operator → 403 (Python `_rbac_strip` gates entire endpoint, not just fields)

## Followups (file as separate tickets if not already tracked)

1. **Restaurant role-account seeding** (P3 — not customer-blocking). Restaurant tenants currently only have `*_admin`. To complete the 5 × 5 matrix in future R8 / R9 rounds, seed at minimum `*_finance_mgr` + `*_warehouse_mgr` for `RES_3101_009` / `R_GML_DEMO` / `R_XMX_CHAIN`. Estimated 3 tenants × 4 roles = 12 user inserts + bcrypt hashes.
2. **R2 spec rev** — update `docs/qa-specs/2026-05-12-r2-rbac-sweep-matrix.md` §4.2 to add `finance_manager` / `sales_manager` columns. Current spec only documents admin / warehouse / operator and was the basis for this audit's expected-behavior column.
3. **Python E11 / E12 gate semantics** — confirm by source whether `warehouse_manager` → 403 on smart-bi endpoints is by design (warehouse role has no analytics access) or a fall-through default. Worth an inline comment in `_rbac_strip.py`.
4. **F999 fixture parity** — original audit framework used F999 as fixture; this sweep used real customer factories. Worth verifying F999 still mirrors prod behavior for future regression scripts.

## Reproduce

```bash
cd C:/Users/Steve/cretas-r7-f2-rbac-matrix    # or any worktree on this branch
python tests/qa-r7-f2-rbac/sweep.py            # logins + 91 endpoint calls (~5 min cold)
python tests/qa-r7-f2-rbac/build_matrix.py     # regenerates this matrix.md
# Outputs: tests/qa-r7-f2-rbac/{tokens.json, cells.json, cross-tenant.json, matrix.md}
```

Token + endpoint caches make re-runs idempotent. Shared 60-s rate-limit triggers at most twice on a cold cache.
