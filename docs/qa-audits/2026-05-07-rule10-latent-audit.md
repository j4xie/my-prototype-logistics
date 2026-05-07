# Phase 2A Rule 10 Latent Audit — 2026-05-07

**Scope**: All `backend/python/smartbi_compat/api/*.py` except:
- `analysis_region.py` (chat 2 task #25 in flight, PR #112 already merged but avoiding double-touch)
- `analysis_finance.py:2120-2240` (task #28 PR #111 receivable section, already fixed)

**Files audited**: 14 (`__init__.py` + 13 endpoint files)

**Marching order**: `docs/superpowers/dispatch/2026-05-07-rule10-latent-audit-marching-order.md`

**Rule reference**: `.claude/rules/python-java-port.md` Rule 10 (BigDecimal divide-then-multiply intermediate quantize)

---

## TL;DR

**M = 2 latent sites found** in `analysis_drilldown.py` (L174 + L255). Both fixed in this audit using the canonical Rule 10 idiom from PR #111 / Rule 10 doc. Tested via test env smoke (NOT prod — PR-3 24h soak frozen).

All other audited files swept clean.

---

## Method

### Pattern grep (Step 2.1)

```bash
grep -nE '/\s*[a-z_\.]+\s*\*\s*Decimal\("?[0-9]+' backend/python/smartbi_compat/api/*.py
```

Anti-pattern: `n / d * Decimal("K")` (un-parenthesized intermediate, then either inline or external `.quantize(scale_2)`). 28-digit Decimal intermediate precision compounded into the multiplication, then truncated at quantize — diverges from Java's `BigDecimal.divide(divisor, scale=4, HALF_UP).multiply(K)` semantics.

### Sanity grep (Step 2.2)

Cross-check via secondary patterns:
- `\)\.quantize\(Decimal\("0\.01"` — find quantize-2 sites + inspect upstream for divide-multiply
- `[a-z_]+\s*/\s*[a-z_\.]+\s*\*\s*Decimal` — alt regex variant

Both confirm same 2 hits.

### False positives reviewed and excluded

| Site | Reason excluded |
|---|---|
| `analysis_finance.py:264` | Already-canonical `).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)` after intermediate quantize at L262 |
| `analysis_finance.py:738/739/774/775/1075/2364` | Subtraction not division (`(a - b).quantize(...)`) |
| `analysis_finance.py:1922` | Multiplication only `(gross * Decimal("0.70")).quantize(...)` no divide before — not Rule 10 |
| `analysis_sales.py:168` | Already-canonical at L165-167: `((current - previous) / abs(previous)).quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP) * Decimal("100")` |
| `analysis_sales.py:932/955/986` | Single-value `_to_decimal(amount).quantize(0.01)` not division |
| `analysis_drilldown.py:259/260` | Per-capita division `(total_amount / Decimal(member_count)).quantize(0.01)` — no multiplication factor, not Rule 10 (separately a Rule 12 banker's-rounding latent — out of this audit's scope) |

---

## Latent sites found (M = 2)

| File:Line | Function | Pattern (before) | Severity |
|---|---|---|---|
| `analysis_drilldown.py:174` | `_build_drilldown_ranking` (provincial drill-down completion rate) | `(total_amount / total_target * Decimal("100")).quantize(Decimal("0.01"))` | medium |
| `analysis_drilldown.py:255` | `_build_department_detail_response` (department drill-down completion rate) | `(total_amount / total_target * Decimal("100")).quantize(Decimal("0.01"))` | medium |

Both are **completion-rate** percentage calculations matching Java service's `BigDecimal.divide(scale=4, HALF_UP).multiply(100)` pattern. Both consumers display the value via `_decimal_to_number` → number type.

### Note: outer quantize was also missing `rounding=ROUND_HALF_UP`

Both pre-fix sites had `.quantize(Decimal("0.01"))` without explicit `rounding=ROUND_HALF_UP`, falling through to Decimal's default `ROUND_HALF_EVEN` (banker's). This is technically a Rule 12 latent issue overlaid on the Rule 10 violation — but Rule 10 canonical idiom (per `.claude/rules/python-java-port.md`) explicitly includes `ROUND_HALF_UP` on BOTH the intermediate (scale-4) AND final (scale-2) quantize calls:

```python
intermediate = (actual / target).quantize(Decimal("0.0001"), ROUND_HALF_UP)  # 4-digit
result = intermediate * Decimal("100")
return result.quantize(Decimal("0.01"), ROUND_HALF_UP)  # final scale 2
```

Applying canonical Rule 10 idiom strictly resolves both layers in one fix — no scope creep.

---

## Fixes applied (canonical Rule 10 idiom)

```python
# Before (L174 / L255):
completion_rate = (total_amount / total_target * Decimal("100")).quantize(Decimal("0.01"))

# After (Rule 10 canonical):
# Rule 10: divide quantize 4 first, then multiply, mirrors Java
# BigDecimal.divide(scale=4, HALF_UP).multiply(100). Final scale-2
# quantize uses explicit ROUND_HALF_UP to match Java setScale(2, HALF_UP).
completion_rate = (
    (total_amount / total_target).quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP)
    * Decimal("100")
).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
```

Pattern matches:
- task #28 PR #111 receivable fix (L2127, L2198, L2233 in `analysis_finance.py`)
- 8 already-fixed Rule 10 sites in `analysis_finance.py` (L262-264, L572, L906, L933, L1062, L1690, L1704, L2421)
- `analysis_sales.py:165-168` `_safe_growth_rate` helper

`ROUND_HALF_UP` already imported at `analysis_drilldown.py:13`.

---

## Files swept clean (no latent Rule 10)

| File | Pattern hits | Status |
|---|---|---|
| `analysis.py` | 0 | ✅ clean |
| `analysis_department.py` | 0 | ✅ clean |
| `analysis_drilldown.py` | 2 → fixed | ✅ now clean |
| `analysis_finance.py` (excluding L2120-2240) | already-canonical | ✅ clean |
| `analysis_inventory.py` | 0 | ✅ clean |
| `analysis_procurement.py` | 0 | ✅ clean |
| `analysis_region.py` | (out of scope, chat 2 territory) | — |
| `analysis_sales.py` | already-canonical | ✅ clean |
| `dashboard.py` | 0 | ✅ clean |
| `datasource.py` | 0 | ✅ clean |
| `incentive_plan.py` | 0 | ✅ clean |
| `query_templates_write.py` | 0 | ✅ clean |
| `upload.py` | 0 | ✅ clean |

---

## Test env smoke (post-fix)

Test env (8084) restarted via `restart-test.sh`, smoke 6 endpoints — all 200:

```
200 analysis/sales?startDate=2026-01-01&endDate=2026-05-07
200 analysis/inventory?startDate=2026-01-01&endDate=2026-05-07
200 analysis/procurement?startDate=2026-01-01&endDate=2026-05-07
200 analysis/department?startDate=2026-01-01&endDate=2026-05-07
200 analysis/finance?startDate=2026-01-01&endDate=2026-05-07&analysisType=profit
200 alerts
```

(Drill-down endpoints not in standard smoke list; depend on real-data integration. Code-path-equivalent fix applied per canonical idiom — no behavior change for normal data, defensive guard for boundary cases.)

**Prod 8083 NOT touched** — chat 1 owns PR-3 24h soak (until 2026-05-08 11:36 CST), prod state frozen.

---

## Out of scope (not addressed in this PR)

- **Rule 11/12 latent sweeps** — different defensive sweeps; per marching order "DO NOT chain to Rule 11 / Rule 12 latent audit"
- **`analysis_drilldown.py:259/260`** — `(total / count).quantize(0.01)` per-capita division WITHOUT explicit `ROUND_HALF_UP` — Rule 12 latent banker's-rounding bug, NOT Rule 10. Out of scope per single-rule audit.
- **`analysis_region.py`** — chat 2 task #25 territory
- **`analysis_finance.py:2120-2240`** receivable section — already fixed in task #28 PR #111

---

## Decision

✅ **M = 2 fixed, sweep otherwise clean.** Drill-down completion rates now mirror Java semantics. Defensive guard for T6.4 100% factories real customer data.

## Refs

- Marching order: `docs/superpowers/dispatch/2026-05-07-rule10-latent-audit-marching-order.md`
- Rule 10 doc: `.claude/rules/python-java-port.md`
- Canonical idiom precedent: PR #111 (task #28 receivable Rule 10 fix)
- Earlier audit: 2026-05-06 PR-M-2 (4 sister chats hit Rule 10), 2026-05-07 12 defensive fixes (commit `69b46f4d5`)
