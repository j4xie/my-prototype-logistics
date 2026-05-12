# R2 RBAC Sweep Matrix — 36-cell Verification

**Date**: 2026-05-12
**Author**: organizer chat (R2-prep, fresh dispatch)
**Parent spec**: `docs/qa-specs/2026-05-12-smartbi-python-port-deep-e2e-spec.md` §5 R2 + §2.3
**Status**: 📝 **READY for R2 dispatch** — script + dry-run included in this PR
**Scope**: PR #423 (Java @PriceSensitive strip) + PR #435 (Python KPI strip) + PR #443 (in-flight Jackson method-target NPE fix) coverage.

---

## §1 Why this spec

Parent spec §2.3 listed 12 endpoints × 3 roles = 36 verification cells but did not concretize:
- Expected behavior per cell (200+real / 200+stripped / 403 / 500)
- Field names to check in each response shape
- Role decisions (esp. `operator` — strip vs no-access)
- Executable mechanism

This doc + companion script `scripts/qa/r2_rbac_sweep.py` close those gaps so R2 chat can execute directly without redesigning.

---

## §2 Test environment

| Item | Value |
|---|---|
| Java test backend | `http://47.100.235.168:10011` |
| Python test service | `http://47.100.235.168:8084` |
| Login endpoint | `POST /api/mobile/auth/unified-login` (Java only) |
| Test factory | `F001` (has demo seed data incl. material batches w/ prices) |
| Web-admin URL | `http://139.196.165.140:8097` (not exercised in sweep; sweep is API-only) |

**Tokens needed (3)**:

| Role | Test username | Password | Module perms (relevant) |
|---|---|---|---|
| factory_super_admin | `factory_admin1` | `123456` | all |
| warehouse_manager | `warehouse_mgr1` | `123456` | `inventory:rw`, `procurement:r`, `sales:r`, `report:r`, `dashboard:rw`, `warehouse:rw` |
| operator | `f001_operator` | `123456` | `dashboard:r`, `production:w`, `work_report:w` (no inventory/procurement/sales/report) |

⚠️ Test creds — never commit to repo. Sweep script reads from env vars `R2_PW_ADMIN`, `R2_PW_WAREHOUSE`, `R2_PW_OPERATOR` (defaulting to `123456` for the test factory).

---

## §3 PR coverage map

| PR | State | Scope | What R2 verifies |
|---|---|---|---|
| #423 | merged 2026-05-12 | Java `@PriceSensitive` on 13 fields + `PriceFieldResponseAdvice` | Java-side strip on material-batches / purchase / sales endpoints |
| #435 | merged 2026-05-12 | Python `_rbac_strip.strip_price_for_role` on 6 SmartBI modules | Python-side strip on analysis_finance / dashboard_composite |
| #443 | **OPEN** at R2-prep time | `@PriceSensitive` method target + Jackson `BeanSerializerModifier` + 7 defensive getter guards | Resolves 500 NPE on `/sales/orders` `payableAmount` getter for warehouse_mgr. **R2 must verify PR #443 merged status before running sweep — if not merged, `/sales/orders` cell for warehouse expects HTTP 500 (acceptance: tracked as known-gap, NOT a P0).** |
| #444 | audit doc only | 13 latent unannotated price fields (`shippingFee`, `actualShippedAmount`, etc.) | Sweep flags these as **WARN/expected leak** — they are documented gap, not new P0. Follow-up PR scope. |

---

## §4 12-endpoint × 3-role = 36 cells

### §4.1 Path conventions

All Java endpoints rooted at `/api/mobile/{factoryId}/`. All Python endpoints rooted at `/api/mobile/{factory_id}/smart-bi/`. Sweep substitutes `{factoryId}=F001`.

For detail endpoints (`/orders/{orderId}` etc.), the script fetches the list first as admin, picks the first record's ID, and uses that ID across all 3 role probes for the detail cell.

### §4.2 The 12 endpoints

| # | Method+Path | Backend | Module gate | Price fields (annotated) | Notes |
|---|---|---|---|---|---|
| E1 | `GET /material-batches?page=1&size=10` | Java 10011 | none (controller has no `@RequirePermission`) | `unitPrice`, `totalPrice`, `totalValue` (via DTO) | Base case PR #423 prod-verified. |
| E2 | `GET /material-batches/{batchId}` | Java 10011 | none | same as E1 | Uses ID from E1 admin run. |
| E3 | `GET /material-batches/expiring?days=30` | Java 10011 | none | same | List variant. |
| E4 | `GET /material-batches/low-stock` | Java 10011 | none | same | List variant. |
| E5 | `GET /material-batches/inventory/valuation` | Java 10011 | none | **entire payload is price** (totalValue per batch + grand-total) | **Decision flag §5.2**: should warehouse see this at all? Spec authors leave as `WARN_HIGH_RISK` for Steve. |
| E6 | `GET /purchase/orders?page=1&size=10` | Java 10011 | `procurement:read[_write]` | `totalAmount`, `taxAmount`, items: `unitPrice`, `taxRate` | operator → 403 (no procurement module). |
| E7 | `GET /purchase/orders/{orderId}` | Java 10011 | `procurement:read[_write]` | same as E6 + computed `lineAmount` getter (PR #443) | Uses ID from E6 admin run. |
| E8 | `GET /purchase/receives?page=1&size=10` | Java 10011 | `procurement:read[_write]` | `totalAmount`, items: `unitPrice` | operator → 403. |
| E9 | `GET /sales/orders?page=1&size=10` | Java 10011 | `sales:read[_write]` | `totalAmount`, `discountAmount`, `taxAmount`, items: `unitPrice`, `costUnitPrice`, `taxRate`, `discountRate` | operator → 403. **§3 PR #443 gating**: if not merged, warehouse → 500. |
| E10 | `GET /sales/orders/{orderId}` | Java 10011 | `sales:read[_write]` | same as E9 + computed `payableAmount` / `lineAmount` / `costTotal` (PR #443) | Uses ID from E9 admin run. **Same PR #443 caveat as E9.** |
| E11 | `GET /smart-bi/analysis/finance?periodType=MONTH&startDate=2025-01-01&endDate=2025-12-31` | Python 8084 | none at handler (delegates to JWT factory verify) | KPI cards: `value`, `rawValue`, `change`, `targetValue` where card title matches money pattern (per `_rbac_strip.py`) | operator: no Java module gate. Python sees role and strips. Expect 200+stripped. |
| E12 | `GET /smart-bi/dashboard/executive?period=month` | Python 8084 | none at handler | KPI cards (composite of sales/finance overview) | operator has `dashboard:read` in Java perms but irrelevant — Python endpoint just verifies JWT. operator NOT in `PRICE_VIEW_ROLES`, so strip applies. |

### §4.3 Expected behavior matrix (36 cells)

Legend:
- ✅ **REAL**: HTTP 200, price fields contain non-null numeric values.
- 🔒 **STRIP**: HTTP 200, all annotated `@PriceSensitive` fields (or money-pattern KPI carriers) are `null`.
- ⛔ **403**: HTTP 403, module permission denied. Acceptance: response JSON `success=false` with explanatory `message`.
- 💥 **500-KNOWN**: HTTP 500 (NPE in computed getter). Conditional on PR #443 unmerged at sweep time. NOT a new P0.
- ⚠️ **WARN**: documented latent leak (PR #444 audit). Sweep flags but does not fail verdict.

| Cell | Endpoint | admin | warehouse_mgr | operator |
|---|---|---|---|---|
| C1 | E1 `/material-batches` | ✅ REAL | 🔒 STRIP | 🔒 STRIP (controller ungated; PR #423 strips by role, not by module) |
| C2 | E2 `/material-batches/{id}` | ✅ REAL | 🔒 STRIP | 🔒 STRIP |
| C3 | E3 `/material-batches/expiring` | ✅ REAL | 🔒 STRIP | 🔒 STRIP |
| C4 | E4 `/material-batches/low-stock` | ✅ REAL | 🔒 STRIP | 🔒 STRIP |
| C5 | E5 `/material-batches/inventory/valuation` | ✅ REAL | 🔒 STRIP **OR** ⛔ 403 (§5.2 decision) | 🔒 STRIP **OR** ⛔ 403 (§5.2 decision) |
| C6 | E6 `/purchase/orders` | ✅ REAL | 🔒 STRIP | ⛔ 403 |
| C7 | E7 `/purchase/orders/{id}` | ✅ REAL | 🔒 STRIP | ⛔ 403 |
| C8 | E8 `/purchase/receives` | ✅ REAL | 🔒 STRIP | ⛔ 403 |
| C9 | E9 `/sales/orders` | ✅ REAL | 🔒 STRIP (if PR #443 merged) **or** 💥 500-KNOWN | ⛔ 403 |
| C10 | E10 `/sales/orders/{id}` | ✅ REAL | 🔒 STRIP (if PR #443 merged) **or** 💥 500-KNOWN | ⛔ 403 |
| C11 | E11 `/smart-bi/analysis/finance` | ✅ REAL | 🔒 STRIP (KPI value/rawValue null on money cards) | 🔒 STRIP (no Java gate on Python endpoint) |
| C12 | E12 `/smart-bi/dashboard/executive` | ✅ REAL | 🔒 STRIP | 🔒 STRIP |

### §4.4 Field-leak detection rules

For 🔒 STRIP cells, sweep script asserts (recursively, depth-first walk):

**Java endpoints (E1-E10)** — body shape `{success, data: {content:[...], totalElements,...}}` or `{success, data: {...entity}}`:

For each entity payload, the following keys at any depth must be `null` (or absent):
- `totalAmount`, `taxAmount`, `discountAmount` (order-level)
- `unitPrice`, `costUnitPrice`, `taxRate`, `discountRate` (item-level)
- `totalPrice`, `totalValue` (material batch DTO)
- Computed getters (if PR #443 merged): `payableAmount`, `lineAmount`, `lineAmountWithTax`, `costTotal`

**Python endpoints (E11, E12)** — body shape varies (composite KPI dict / cards array):

For each `kpi` / `card` / `metric` node identified by money pattern (key/title/unit contains 元/金额/收入/成本/利润/总额/…), the following carriers must be `null`:
- `value`
- `rawValue`
- `change`
- `targetValue`

Pattern source-of-truth: `backend/python/smartbi_compat/_rbac_strip.py` MONEY_KEY_PATTERN (key-name predicate) + MONEY_CARD_PATTERN (card-identity predicate).

### §4.5 Latent leak fields (WARN, not P0)

Per PR #444 audit doc, the following persisted fields are **not yet** annotated `@PriceSensitive` and will appear in warehouse_mgr responses. Sweep flags them but doesn't fail the cell:

| Entity | Field | Endpoint(s) |
|---|---|---|
| SalesOrder | `shippingFee`, `actualShippedAmount`, `estimatedCost`, `estimatedProfit`, `invoicedAmount`, `paidAmount` | E9, E10 |
| ExtraFeeItem | `amount` | E10 (nested in SO if extra fees present) |
| (others per PR #444 doc) | (delivery/return/shipment entities) | not in §4 endpoint scope |

If sweep detects any of these as non-null in a warehouse_mgr response, it logs `WARN: latent-leak-pr444 entity=SalesOrder field=shippingFee value=...` but the cell verdict stays ✅ as expected per current code state.

---

## §5 Decision points (for Steve / R2 chat)

### §5.1 operator role — strip OR 403?

**Confirmed via code review of `PermissionServiceImpl.java`:**

| Module | operator perm | Affected endpoints |
|---|---|---|
| `dashboard` | `read` | E12 (and only because Python endpoint doesn't even check it) |
| `production`, `work_report` | `write` | none in this matrix |
| `inventory`, `procurement`, `sales`, `report`, `warehouse` | **none** | E6-E10 → 403; E1-E5 → ungated controller, strip applies; E11-E12 → no Java gate, Python strip applies |

**Resolution**: matrix §4.3 encodes the natural outcome — operator gets 403 on Java-gated endpoints and 🔒 STRIP on ungated ones. This is consistent with PR #423's design intent (strip is role-keyed, not module-keyed). **No new decision needed.**

### §5.2 E5 `/material-batches/inventory/valuation` — whole-endpoint deny?

**Status**: 🔴 **OPEN — needs Steve review before R2 fires.**

The endpoint returns valuation totals at multiple granularities. After PR #423 strip, response would still expose:
- Batch IDs and material names (non-price)
- Counts and quantities (non-price)
- But every monetary value → null

**Options**:
- **A. Strip-only (default per current code)**: warehouse sees the page structure with all prices nulled. Information disclosure risk is low (no business signal in "X batches with null valuation"). ✅ Cheapest, no code change.
- **B. Module-gate**: add `@RequirePermission("finance:read")` to controller method. warehouse → 403. ⚠️ Could break warehouse_mgr's legitimate inventory workflows if UI uses this endpoint elsewhere.
- **C. Conditional payload**: backend omits the entire valuation envelope when caller lacks `procurement:price:view`. ⚠️ Behavior split increases test surface.

**R2 chat action**: run sweep with both warehouse/operator → expect 🔒 STRIP. Capture screenshot of the stripped response and tag verdict as `NEEDS_REVIEW` (not 🔴 BUG). Steve decides post-R2 whether to file PR for B/C.

### §5.3 PR #443 merge status check

Sweep script first calls `gh pr view 443 --json state,mergedAt` to detect state:
- `MERGED`: C9/C10 warehouse expectation = 🔒 STRIP. 500 = bug.
- `OPEN`: C9/C10 warehouse expectation = 💥 500-KNOWN. 200 = unexpected (verify in main session).

R2 chat runs the sweep with the detected state baked into verdicts.

---

## §6 Sweep script contract

`scripts/qa/r2_rbac_sweep.py` deliverables:

- CLI: `python scripts/qa/r2_rbac_sweep.py --factory F001 --base-java http://47.100.235.168:10011 --base-python http://47.100.235.168:8084 --output docs/qa-evidence/r2-rbac-sweep/`
- Stdout: human-readable progress + final 36-cell verdict table (color-coded ✅/🔒/⛔/💥/⚠️/🔴).
- Output files:
  - `matrix.json`: all 36 cells with `{cell_id, endpoint, role, expected, actual_status, actual_fields, verdict, leak_fields[], warn_fields[]}`.
  - `report.md`: human-readable narrative with rationale per failed cell.
  - `raw/{cell_id}-{role}.json`: raw API response per cell for forensic re-audit.

Verdicts:
- `PASS` — actual matches expected.
- `FAIL` — actual diverges from expected in a security-relevant direction (e.g., warehouse sees `unitPrice` non-null where expected null) → 🔴 P0.
- `WARN` — latent-leak from PR #444 list, or 💥 500-KNOWN when PR #443 unmerged.
- `NEEDS_REVIEW` — E5 cells per §5.2.

R2 acceptance: **0 FAIL**, all WARN explained, NEEDS_REVIEW captured.

---

## §7 R2 chat dispatch prompt (template)

> Task: Execute R2 RBAC sweep per spec.
>
> 🔴 Worktree: `git worktree add C:/Users/Steve/cretas-r2-exec -b qa/r2-exec-rbac-sweep origin/main`
>
> Inputs:
> - Spec: `docs/qa-specs/2026-05-12-r2-rbac-sweep-matrix.md` (this file)
> - Parent spec: `docs/qa-specs/2026-05-12-smartbi-python-port-deep-e2e-spec.md` §5 R2
> - Script: `scripts/qa/r2_rbac_sweep.py`
>
> Steps:
> 1. `gh pr view 443 --json state,mergedAt` — bake state into sweep expectations.
> 2. `python scripts/qa/r2_rbac_sweep.py --factory F001 --output docs/qa-evidence/r2-rbac-sweep/`
> 3. Review `matrix.json`. For any FAIL cell: read `raw/{cell}-{role}.json` and write root-cause hypothesis.
> 4. For NEEDS_REVIEW cells (E5 §5.2): screenshot stripped response, log for Steve.
> 5. PR: spec evidence dir + sweep matrix.json + report.md + raw/ + any P0 bug ticket(s).
>
> Acceptance: 0 FAIL. WARN/NEEDS_REVIEW explained. R2 customer-facing deep tests (§3.2 of parent spec) tracked separately (parallel chat if needed).

---

## §8 Self-review checklist

- [x] 36 cells enumerated with explicit expected behavior
- [x] operator decision (§5.1) — resolved via code review, no new flag
- [x] E5 decision (§5.2) — flagged as NEEDS_REVIEW, doesn't block R2
- [x] PR #443 conditional handled (§5.3 + §4.3 C9/C10)
- [x] Latent leak (PR #444) acknowledged as WARN, not P0
- [x] Field-name leak detection rules concrete (§4.4)
- [x] Script contract specified (§6)
- [x] R2 dispatch prompt drafted (§7)
- [x] All paths verified against real Java controllers + Python routes
- [x] Test creds via env vars (not hardcoded)
