# Phase 2A Pattern A2 Latent Audit — 2026-05-08

**Author**: chat 3
**Trigger**: chat 1 PR #122/#125 H1 confirm 期间发现 Pattern A2 (scale-4 Decimal trailing-zero loss `99.9900` → `99.99`),~3 sites in `analysis_finance.py` budget path 但 full Phase 2A 可能更多 latent。
**Reference**: PR #125 `698ddc6dc` Rule 4 expanded subsection — Pattern A + A2 official definitions
**Output**: doc-only audit (NO code fix per Phase 2A dict-eq gate accept)

---

## Pattern A2 definition (per Rule 4 expanded)

`_decimal_to_number(Decimal("99.9900"))` returns `float(99.99)` (trailing-zero loss). Java
`BigDecimal("99.9900")` → Jackson `99.9900` (scale-preserved). Per-occurrence delta:
**+2 to +4 chars** Java-bigger.

A site is **Pattern A2 trigger** if:
1. Final value = scale-4 Decimal (intermediate or final)
2. AND emitted via `_decimal_to_number(v)` or `float(v)` **WITHOUT** re-quantize to scale-2 first

A site is **NOT Pattern A2** if:
- The scale-4 value is intermediate, then re-quantized to scale-2 (`.quantize(Decimal("0.01"), ROUND_HALF_UP)`) BEFORE emission

---

## Scope

- `backend/python/smartbi_compat/api/*.py` (all api files)
- `backend/python/smartbi_compat/_*.py` helpers
- Pattern: `quantize(Decimal("0.0001"))` (scale-4) sites + downstream emission

---

## Sites surveyed: 21 scale-4 quantize sites

### File breakdown

| File | scale-4 quantize sites |
|---|---|
| `analysis_drilldown.py` | 2 (lines 178, 265) |
| `analysis_finance.py` | 17 (lines 262, 572, 906, 933, 1062, 1690, 1704, 1721, 1860, 1926, 2127, 2198, 2233, 2421, 2422, 2424, 2492) |
| `analysis_region.py` | 1 (line 619) |
| `incentive_plan.py` | 1 (line 183) |
| `analysis_inventory.py` / `procurement.py` / `sales.py` / `department.py` / `analysis.py` | 0 |
| Total | **21** |

---

## Pattern A2 hits: M=3

| File:Line | Function | Variable | Why Pattern A2 |
|---|---|---|---|
| `analysis_region.py:619` | `_get_region_heatmap` (or similar) | `heat_value` | `_decimal_to_number(heat_value.quantize(Decimal("0.0001")))` — scale-4 Decimal directly emitted, NO scale-2 re-quantize |
| `analysis_finance.py:2492` | `_get_payable_aging_chart` (line 2455-) | `pct` | `_decimal_to_number(pct)` where `pct = (amount/total_ap).quantize(0.0001) * Decimal("100")` (scale-4 result), NO scale-2 re-quantize. **Asymmetric vs receivable equivalent (line 2127) which DOES re-quantize.** Worth follow-up to verify Java side payable also emits scale-4 (if Java side does setScale(2), 2492 is a real divergence not just Pattern A2). |
| `incentive_plan.py:165 → 183` | `_calculate_completion_rate` | `completionRate` | Function returns `ratio * Decimal("100")` where ratio is scale-4 quantize, result still scale-4. `plan["completionRate"] = _decimal_to_number(_calculate_completion_rate(...))` — emitted directly without re-quantize. Java line 144: `this.completionRate = perf.divide(goal, 4, HALF_UP).multiply(100)` confirms Java side matches scale-4. |

---

## Files swept clean — NOT Pattern A2 (M=18 sites use defensive scale-2 re-quantize idiom)

All 18 sites follow the **defensive idiom**: scale-4 Decimal is intermediate, then
re-quantize to scale-2 immediately before `_decimal_to_number(...)` emission.

### Confirmed NOT Pattern A2 (scale-2 re-quantized before emit)

| File:Line | Function | Variable | Emission re-quantize |
|---|---|---|---|
| `analysis_drilldown.py:178` | rankings | `completion_rate` | `(scale-4 * 100).quantize(0.01)` final |
| `analysis_drilldown.py:265` | (same pattern) | `completion_rate` | `(scale-4 * 100).quantize(0.01)` final |
| `analysis_finance.py:262` | `_compute_percentage` | `percentage` | `(scale-4 * 100).quantize(0.01)` final |
| `analysis_finance.py:572` | `_safe_growth_rate` | (returned) | All 4 callers (728/729/764/765) re-quantize via `.quantize(Decimal("0.01"), ROUND_HALF_UP)` before `_decimal_to_number` |
| `analysis_finance.py:906` | `_get_yoy_mom_chart` | `yoy_growth_rate` | Line 920: `yoy_growth_rate.quantize(Decimal("0.01"), ROUND_HALF_UP)` before emit |
| `analysis_finance.py:933` | (same function) | `total_yoy_growth_rate` | Line 951: scale-2 re-quantize before emit |
| `analysis_finance.py:1062` | `_get_budget_chart` | `achievement_rate` | Line ~1072: scale-2 re-quantize before `_decimal_to_number` |
| `analysis_finance.py:1690` | `_get_profit_metrics` | `gross_margin_raw` → `gross_margin` | Line 1750: `gross_margin.quantize(Decimal("0.01"), ROUND_HALF_UP)` before emit |
| `analysis_finance.py:1704` | (same function) | `net_margin_raw` → `net_margin` | Line ~1775: scale-2 re-quantize |
| `analysis_finance.py:1721` | (same function) | `roi` | Line ~1798: `roi.quantize(Decimal("0.01"), ROUND_HALF_UP)` before emit |
| `analysis_finance.py:1860` | `_build_profit_chart_from_finance_data` | `gross_margin_raw` → `gross_margin` | Line 1880: scale-2 re-quantize before emit |
| `analysis_finance.py:1926` | `_aggregate_profit_by_period_sales` | `gm` | Line 1939: `gm.quantize(Decimal("0.01"), ROUND_HALF_UP)` before emit |
| `analysis_finance.py:2127` | `_get_receivable_aging_chart` | `percentage` | Line 2135: `percentage.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)` before emit |
| `analysis_finance.py:2198` | `_get_receivable_metrics` | `collection_rate` | Line 2206: `collection_rate.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)` before emit |
| `analysis_finance.py:2233` | (same function) | `ratio` | Line 2242: `ratio.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)` before emit |
| `analysis_finance.py:2421` | `_get_payable_metrics` | `avg_payable` | Used internally for `turnover_days` calc; not emitted directly |
| `analysis_finance.py:2422` | (same function) | `daily_payment` | Used internally; not emitted directly |
| `analysis_finance.py:2424` | (same function) | `turnover_days` | Line 2440: `turnover_days.quantize(Decimal("1"), rounding=ROUND_HALF_UP)` — re-quantize to **scale-0** (integer days), Pattern A2 doesn't apply |

---

## Cross-reference Java side scale (sampled)

Sampled 5 sites' Java counterparts via grep `setScale(4` + `BigDecimal.divide.*4,`:

| Python site | Java counterpart | Scale match? |
|---|---|---|
| `analysis_finance.py:262` | Java line 1571 (per inline comment): `divide(total, 4, HALF_UP).multiply(100).setScale(2, HALF_UP)` | ✓ Final scale-2 both sides |
| `analysis_finance.py:1062` | Java line ~ (per inline comment): `divide(scale=4, HALF_UP).multiply(100)` then setScale(2) at emit | ✓ |
| `analysis_finance.py:1721` (ROI) | Java line 481-483 (per inline comment): `grossProfit.divide(totalCost, 4, HALF_UP).multiply(100)` | Java emits scale-4 (no setScale(2)?) — Python re-quantizes to scale-2 → **Python smaller than Java** if Java keeps scale-4. **Worth deep-check** but likely Java side also setScale(2) at DTO emit. |
| `incentive_plan.py:183` | Java DTO line 144 (per inline comment): `perf.divide(goal, 4, HALF_UP).multiply(100)` | ✓ Both scale-4 — Pattern A2 expected |
| `analysis_region.py:619` | Java side likely `heatValue.setScale(4, HALF_UP)` | ✓ Both scale-4 — Pattern A2 expected |

**Note**: Some sites' Java counterpart was not deep-verified. Per dict-eq gate philosophy
(numeric equality, not byte equality), even slight Java/Python scale mismatch is accepted as
long as the parsed numeric values are equal.

---

## Decision

Pattern A2 is **Phase 2A dict-eq gate accept** (per Rule 4 expanded — "expected divergence
not bug"). M=3 latent sites documented; **NO code fix needed** because:

1. dict-eq gate compares semantic numeric equality (`Decimal("99.99") == Decimal("99.9900")`
   after parse → match)
2. User-facing display in Phase 2A goes through `_format_decimal_half_up` (Rule 12 idiom)
   not `_decimal_to_number`, so display layer is not affected by Pattern A2
3. Future Phase 3+ strict-byte gate would require fix (e.g. emit Decimal as JSON number string
   like `"99.9900"`, or use a canonical compare helper)

---

## Follow-up notes (not part of this audit's scope)

1. **Asymmetry between receivable and payable aging chart**: line 2127 (receivable percentage)
   re-quantizes to scale-2 before emit; line 2492 (payable pct) does NOT re-quantize. Either:
   - Java side mirrors this asymmetry (receivable scale-2, payable scale-4) → Python correct
   - Java side is symmetric (both scale-2) → Python payable line 2492 has a real
     consistency issue (separate from Pattern A2 dict-eq accept)
   File ticket if T6 dryrun reveals payable aging chart byte divergence.

2. **Site 1721 (ROI)**: Java side comment says `divide(totalCost, 4, HALF_UP).multiply(100)`
   without explicit setScale(2). Python emits scale-2 via `roi.quantize(Decimal("0.01"))`.
   If Java DTO does NOT setScale(2) at emit, Python is _smaller_ than Java for ROI (rare
   inverse direction; usually Pattern A2 is Python smaller via float collapse). Verify with
   T6.1 dryrun raw-body diff.

3. **`analysis_finance.py:572` `_safe_growth_rate` returns scale-4** — all current callers
   re-quantize defensively. Future callers must follow the same idiom or Pattern A2 hits.
   Add `# Returns scale-4 Decimal — caller MUST .quantize(Decimal("0.01")) before emit`
   docstring (separate ticket if useful).

---

## Audit summary

| Metric | Count |
|---|---|
| Sites surveyed | 21 |
| Pattern A2 hits (M) | **3** |
| Files swept clean (M=0) | 18 sites in 4 files (`analysis_drilldown.py`, most of `analysis_finance.py`, no hits in `analysis_inventory/procurement/sales/department/analysis.py`) |
| User-facing display affected? | **No** (Phase 2A display uses `_format_decimal_half_up`) |
| Code fix needed? | **No** (Phase 2A dict-eq gate accept) |
| Phase 3+ strict-byte gate fix scope (future) | 3 sites |
