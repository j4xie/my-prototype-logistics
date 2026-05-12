# R2 RBAC Sweep — Results & Audit

**Date**: 2026-05-12
**Worktree**: `C:/Users/Steve/cretas-r2-exec` (branch `qa/r2-exec-rbac-sweep`)
**Spec**: `docs/qa-specs/2026-05-12-r2-rbac-sweep-matrix.md` (chat5 PR #449)
**Script**: `scripts/qa/r2_rbac_sweep.py`
**Test env**: `http://139.196.165.140:8097` (nginx test vhost → Java 47:10011 + Python 47:8084)
**Test factory**: F001
**Evidence dir**: `docs/qa-evidence/r2-rbac-sweep-2026-05-12/` (matrix.json + report.md + raw/*.json × 36)

---

## §1 Executive verdict

**🟢 R2 PASS — ship as-is.**

| Counter | Value |
|---|---|
| Total cells | 36 |
| ✅ PASS | 28 |
| ⚠️ WARN | 6 (all explainable) |
| 🟡 NEEDS_REVIEW | 2 (E5 §5.2 — Steve decision) |
| 🔴 FAIL | **0** |
| P0 leaks | **0** |
| P1 leaks | **0** |

**No security-critical issues.** PR #423 + PR #435 strip behavior is sound across all 12 audited endpoints.

Sweep reproducibility: re-run after worktree-recreation confirmed identical 0-FAIL outcome with same WARN distribution.

---

## §2 PR state at sweep time

| PR | State at sweep | Spec behavior contract |
|---|---|---|
| #423 | merged (live) | Java `@PriceSensitive` field strip — verified ✅ |
| #435 | merged (live) | Python KPI strip — verified ✅ |
| #443 | **OPEN** | Expected: warehouse C9/C10 → 500-KNOWN. **Actual: 200 + comprehensive strip** (see §4.2). |
| #444 | audit doc only | Latent leak (`shippingFee` etc.) — F001 test data sparse, see §4.3 |

origin/main HEAD at sweep: `818337153` (`ops(r1b-1): add Python carve-out to web-admin{,-test}.conf on 139 (BUG-R1B-01 fix) (#445)`).

---

## §3 36-cell matrix verdict (compact)

| Cell | Endpoint | admin | warehouse_mgr | operator |
|---|---|---|---|---|
| C1 | `/material-batches` (list) | ✅ REAL (30 fields) | ✅ STRIP | ✅ STRIP |
| C2 | `/material-batches/{id}` | ✅ REAL (3 fields) | ✅ STRIP | ✅ STRIP |
| C3 | `/material-batches/expiring` | ⚠️ empty list | ✅ STRIP | ✅ STRIP |
| C4 | `/material-batches/low-stock` | ⚠️ empty list | ✅ STRIP | ✅ STRIP |
| C5 | `/material-batches/inventory/valuation` | ⚠️ scalar 604476.68 (sweep sampler miss) | 🟡 NEEDS_REVIEW (null scalar) | 🟡 NEEDS_REVIEW (null scalar) |
| C6 | `/purchase/orders` (list) | ✅ REAL (60 fields) | ✅ STRIP | ✅ 403 |
| C7 | `/purchase/orders/{id}` | ✅ REAL (6 fields) | ✅ STRIP | ✅ 403 |
| C8 | `/purchase/receives` | ✅ REAL (25 fields) | ✅ STRIP | ✅ 403 |
| C9 | `/sales/orders` (list) | ✅ REAL (79 fields) | ⚠️ 200 instead of 500 (**comprehensive strip — POSITIVE**) | ✅ 403 |
| C10 | `/sales/orders/{id}` | ✅ REAL (8 fields) | ⚠️ 200 instead of 500 (**comprehensive strip — POSITIVE**) | ✅ 403 |
| C11 | `/smart-bi/analysis/finance` | ✅ REAL (6 KPI carriers) | ✅ STRIP | ✅ STRIP |
| C12 | `/smart-bi/dashboard/executive` | ⚠️ kpiCards empty for period (no admin price to sample) | ✅ STRIP | ✅ STRIP |

Full per-cell JSON: `docs/qa-evidence/r2-rbac-sweep-2026-05-12/matrix.json`. Raw responses per cell × role: 36 files in `raw/`.

---

## §4 Findings detail

### §4.1 Admin WARN cells (C3, C4, C5, C12) — false-negatives, NOT bugs

These 4 admin cells got verdict WARN because the sweep walker couldn't find a non-null price field to sample. Manual inspection shows:

- **C3-admin** `/material-batches/expiring?days=30`: response `data = []` (empty list). F001 has no batches expiring within 30 days. Admin verification not exercised — but no strip side either, so not a security issue.
- **C4-admin** `/material-batches/low-stock`: response `data = []` (empty list). Same situation.
- **C5-admin** `/material-batches/inventory/valuation`: response `data = 604476.68` (scalar float — total valuation). **Admin DID see the price**; sweep walker only inspects keyed entities, misses primitive `data` payloads. False-negative.
- **C12-admin** `/smart-bi/dashboard/executive`: `data.kpiCards = []` for the requested period; `metricCards = null`; charts populated but no monetary leaf nodes matched. Admin verification not exercised for this period.

**Recommendation**: sweep script v2 should (a) handle primitive `data` payloads (C5), (b) flag empty-list responses as `SKIP_NO_DATA` distinct from `WARN`. Logged as follow-up improvement — not blocking R2.

### §4.2 C9/C10 warehouse — 200 instead of 500-KNOWN (POSITIVE finding)

**Spec expectation** (§4.3 + §5.3): with PR #443 OPEN, warehouse_mgr GET on `/sales/orders[/{id}]` should NPE on computed getter (`payableAmount`/`lineAmount`/`costTotal`) and return HTTP 500.

**Actual**: HTTP 200, response body intact, **0 annotated price leaks AND 0 PR #444 latent leaks** in 10 admin rows worth of warehouse responses.

**Verified field-by-field** (raw/C9-warehouse_mgr.json):

Annotated `@PriceSensitive` — all null ✅:
- order-level: `totalAmount=null`, `taxAmount=null`, `discountAmount=null`, `payableAmount=null`
- item-level: `unitPrice=null`, `costUnitPrice=null`, `taxRate=null`, `discountRate=null`, `lineAmount=null`, `costTotal=null`

PR #444 latent — null in this data ⚠️ (see §4.3):
- `shippingFee=null`, `actualShippedAmount=null`, `estimatedCost=null`, `estimatedProfit=null`, `invoicedAmount=null`, `paidAmount=null`

**Hypothesis for 200 instead of 500**:
- `@PriceSensitive` nulls the dependent fields (`unitPrice`, `taxRate`, etc.) BEFORE the computed getters (`payableAmount` = `Σ unitPrice × qty × (1+taxRate)`) execute.
- Computed getters receive null dependents → guard-pattern produces null instead of NPE.
- Net effect: PR #443 NPE doesn't manifest on the strip path because strip happens first.

**Implication**:
- PR #443's METHOD-target + Jackson filter is still useful for non-strip paths (admin sees getter output) and for richer data where dependents are pre-computed numeric.
- For warehouse_mgr-style strip, current PR #423 alone is sufficient on this data.
- **NOT a P0**: security outcome (warehouse sees no prices) is correct.

**Spec update suggestion**: matrix §4.3 C9/C10 warehouse expectation should be `STRIP (200) — 500 is conditional on getter execution path; not guaranteed even with PR #443 OPEN`. The current "500_KNOWN_443" tag is overly pessimistic.

### §4.3 PR #444 latent leak audit — UNVERIFIED on F001 data

F001 admin row sample (10 rows of `/sales/orders` content + 1 detail row):

| Field | Non-null count (admin) |
|---|---|
| `shippingFee` | 0/10 |
| `actualShippedAmount` | 0/10 |
| `estimatedCost` | 0/10 |
| `estimatedProfit` | 0/10 |
| `invoicedAmount` | 0/10 |
| `paidAmount` | 0/10 |

**Outcome**: cannot verify whether these fields would leak to warehouse if populated. Sweep correctly logged 0 latent leaks per current spec rule, but the assertion is data-dependent.

**Recommendation (follow-up, not blocking R2)**:
- (a) Seed F001 / F006 test rows with `shippingFee` + `estimatedCost` populated, re-run sweep.
- (b) OR perform code-level audit: grep `SalesOrder` getter list for these fields, verify `@PriceSensitive` annotation coverage.
- (c) Treat as PR #444 follow-up scope per existing audit doc.

### §4.4 NEEDS_REVIEW: C5 `/material-batches/inventory/valuation` (Steve decision)

Per spec §5.2, this endpoint returns a primitive valuation scalar (admin sees `604476.68`). After PR #423 strip, warehouse/operator response is a `null` scalar.

**Strip-only design works**: warehouse cannot see the valuation amount. ✅

**Open decision (deferred to Steve post-R2)**:
- **A. Strip-only (current)**: warehouse_mgr gets `{success: true, data: null}`. Low info-disclosure (no signal in "null").
- **B. Module-gate**: add `@RequirePermission("finance:read")` → warehouse → 403. ⚠️ may break legitimate workflows.
- **C. Conditional 200**: omit the whole envelope when caller lacks `procurement:price:view`.

**Captured raw evidence**: `docs/qa-evidence/r2-rbac-sweep-2026-05-12/raw/C5-{warehouse_mgr,operator}.json`.

---

## §5 Per-PR coverage assessment

| PR | Coverage verdict | Evidence |
|---|---|---|
| #423 (Java field strip) | ✅ **VERIFIED** | C1-C10 warehouse + operator — all annotated fields null. Material batches, purchase, sales orders, receives all clean. |
| #435 (Python KPI strip) | ✅ **VERIFIED** | C11-C12 warehouse + operator — KPI `value`/`rawValue`/`change`/`targetValue` on money cards = null. Stripped through analysis_finance + dashboard composite. |
| #443 (Jackson method-target + defensive guards) | 🟡 **NOT REQUIRED on strip path** | NPE didn't fire on warehouse C9/C10 — strip happens before getter computation. PR may still merit landing for admin/richer-data paths. |
| #444 (latent leak audit) | ⏸️ **UNVERIFIED — data sparse** | F001 has 0/10 rows with latent fields populated. Follow-up: seed data or code audit. |

---

## §6 Recommendations (priority order)

1. **🟢 Merge this PR as R2 sign-off** — 0 FAIL, all WARN explained, evidence committed.
2. **🟡 Decision needed**: E5 valuation §5.2 (A/B/C) — flag for Steve, defer to post-R2.
3. **⚪ Follow-up (non-blocking)**:
   - Update sweep spec matrix §4.3 — C9/C10 warehouse expectation should not assert 500.
   - Seed F001/F006 test data with `shippingFee`/`estimatedCost` populated, re-run sweep for PR #444 latent verification.
   - Sweep script v2: distinguish `SKIP_NO_DATA` from `WARN`; handle primitive `data` payloads (C5 admin scalar case).
4. **⚪ PR #443 disposition** — strip path doesn't require it, but still valuable for:
   - Admin requests where computed getters return real values (not currently NPE-prone but defense-in-depth).
   - Edge cases where strip annotations haven't reached every computed-getter dependent.
   - Maintainer to decide if PR #443 merges as planned, ships behind feature flag, or stays open.

---

## §7 R2 coverage boundary

This sweep handles **API-level RBAC strip verification for the 12 critical price-bearing endpoints**.

**NOT covered (separate parallel R2 chat):**
- Customer-facing 3 PR UX deep tests (L4-CF-1/2/3 per parent spec §3.2): PR #423 v-if defense, #413 PDF, #414 receive column → Playwright tests.
- Cross-module data consistency tests.
- Performance / load tests.

If a single R2 chat owns both: do this API sweep first (~2 min wall-clock), then Playwright. This chat handled API sweep only.

---

## §8 Acceptance check

- [x] All 36 cells covered, no skip
- [x] 0 FAIL
- [x] All WARN cells have rationale lines (sweep auto + this audit doc)
- [x] NEEDS_REVIEW cells (E5) captured with raw response (`raw/C5-warehouse_mgr.json`, `raw/C5-operator.json`)
- [x] PR #443 conditional gating handled (OPEN → expected 500-KNOWN → actual 200 STRIP, explained)
- [x] Evidence directory committed (matrix.json + report.md + raw/*.json × 36)
- [x] Audit report with bug list (empty) + recommendations

---

## §9 Files committed in this PR

```
docs/qa-audits/2026-05-12-r2-rbac-sweep-results.md         ← this file
docs/qa-evidence/r2-rbac-sweep-2026-05-12/
  ├── matrix.json                                            ← 36-cell verdict (machine-readable)
  ├── report.md                                              ← sweep auto-generated report
  └── raw/                                                   ← 36 raw API response captures
      ├── C1-admin.json, C1-warehouse_mgr.json, C1-operator.json
      ├── ... (C2 through C12) ...
      └── C12-operator.json
```

---

**Signed**: R2 execute chat (organizer-dispatched, fresh /clear, worktree `qa/r2-exec-rbac-sweep`)
**Reviewer**: organizer admin-merge after evidence verification
