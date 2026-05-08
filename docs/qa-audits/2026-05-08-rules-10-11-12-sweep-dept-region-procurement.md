# Cross-File Rule 10+11+12 Sweep — analysis_department.py / analysis_region.py / analysis_procurement.py

**Date**: 2026-05-08
**Branch**: `ops-rules-sweep-dept-region-procurement` off origin/main `6310f0027`
**Scope**: 3 un-swept Phase 2A analysis files (per organizer review of Rules audit history) — comprehensive scan for Rule 10 (BigDecimal divide-then-multiply), Rule 11 (Jackson LocalDateTime trailing-zero microsecond), Rule 12 (String.format HALF_UP vs Python f-string banker's).

**Result**: **M=1** total across 3 files (1 Rule 12 active fix in `analysis_procurement.py:899`; Rules 10 and 11 both clean M=0).

After this PR, `analysis_finance.py` (chat 2 PR #134), `analysis_inventory.py` / `analysis_drilldown.py` (commit `69b46f4d5`), `analysis_sales.py` (PR #93), and now department+region+procurement → all 7 analysis files have completed Rule 10+11+12 sweep. Phase 2A 12-rule sweep coverage closed.

---

## Audit summary table

| File | LOC | Rule 10 hits | Rule 11 hits | Rule 12 hits | Action |
|---|---|---|---|---|---|
| `analysis_department.py` | 695 | M=0 (compliant) | M=0 (date-only) | M=0 | None |
| `analysis_region.py` | 788 | M=0 (compliant + R-T13 LOCK) | M=0 (no isoformat) | M=0 | None |
| `analysis_procurement.py` | 1215 | M=0 (compliant) | M=0 (date-only) | **M=1 (line 899)** | Fix + regression test |

---

## Rule 10 detail (BigDecimal divide-then-multiply intermediate scale-4)

### Pattern definition (recap)

```python
# ❌ BAD — Decimal precision overflow at last digit
(actual / target * 100).quantize(Decimal("0.01"), ROUND_HALF_UP)

# ✅ GOOD — divide-quantize4-then-multiply (mirror Java BigDecimal.divide(scale=4, HALF_UP).multiply(K))
(actual / target).quantize(Decimal("0.0001"), ROUND_HALF_UP) * Decimal("100")
```

### `analysis_department.py` Rule 10 sites — all compliant

| Line | Function | Pattern | Status |
|---|---|---|---|
| 218 | `_calculate_completion_rate` | `((actual * 100) / target).quantize(SCALE=4, HALF_UP)` | ✓ Java mirrors `actual.multiply(100).divide(target, SCALE=4, HALF_UP)` per docstring lines 199-220 — multiply-first-then-divide-then-quantize is **correct** mirror of Java |
| 277/280/286/289 | `_determine_quadrant` averages | Single divide-quantize-4, no multiply | ✓ Not Rule 10 territory (no `* 100` chain) |
| 489/492/525/528 | `_get_per_capita_chart` averages | Single divide-quantize-4, no multiply | ✓ Same |

Notable: department uses `actual.multiply(100).divide(target, SCALE=4, HALF_UP)` Java pattern (multiply-first-then-divide), differing from sales/region's `actual.divide(target, SCALE=4, HALF_UP).multiply(100)` (divide-first-then-multiply). Docstring lines 209-213 explicitly lock this and note `(actual * 100).quantize(SCALE) / target` as the BUG variant. ✓ Correctly mirrored.

### `analysis_region.py` Rule 10 sites — all compliant with R-T13 LOCK

| Line | Function | Pattern | Status |
|---|---|---|---|
| 119-128 | `RegionAggregation.calculate_gross_margin` | `(gross_profit / total).quantize(SCALE=4, HALF_UP) * Decimal("100")` | ✓ Compliant divide-quantize-multiply |
| 246-257 | `_calculate_base_score` | `ratio = (region/total).quantize(SCALE=4) * 100` | ✓ Compliant |
| 369-390 | `_calculate_completion_rate` | `(actual / target).quantize(SCALE=4) * 100` | ✓ R-T13 LOCK: docstring 374-383 explicitly differentiates from sales/department order — DO NOT import `analysis_sales._calculate_completion_rate` |
| 124, 254, 388, 606 | All other quantize sites | Single divide-quantize, no multiply | ✓ Not Rule 10 territory |

R-T13 LOCK precedent: helpers with same name across sub-domain files can have different arithmetic order; trying to deduplicate via cross-file import would byte-shape break.

### `analysis_procurement.py` Rule 10 sites — all compliant

| Line | Function | Pattern | Status |
|---|---|---|---|
| 155 | `_calculate_average_unit_price` | `(total / Decimal(len)).quantize(SCALE=4, HALF_UP)` | ✓ Single divide, no multiply — not Rule 10 |
| 177-178 | `_calculate_supplier_concentration` | `(max / total).quantize(SCALE=4) * Decimal("100")` | ✓ Compliant |
| 199-200 | `_calculate_mom_growth` | `(diff / abs(previous)).quantize(SCALE=4) * Decimal("100")).quantize(DISPLAY_SCALE=2, HALF_UP)` | ✓ Full Rule 10 正 pattern (per PR-M-2 fix history) |
| 277-279 | `_calculate_quality_score` | `(available / total).quantize(SCALE=4) * Decimal("100")` | ✓ Compliant |
| 311-316 | `_calculate_stability_score` (avg/variance) | Single divide-quantize, no chain multiply | ✓ Not Rule 10 |
| 319 | `_calculate_stability_score` (cv) | Single divide-quantize | ✓ Not Rule 10 (cv * 100 happens line 321 but on already-scale-4 value, mirroring Java line 675 sqrt-divide pattern) |
| 418-419 | `_get_supplier_ranking` percentage | `(value / total).quantize(SCALE=4) * Decimal("100")` | ✓ Compliant |
| 607-608 | `_get_material_category_ranking` percentage | Same pattern | ✓ Compliant |
| 861 | `_build_overview_metric_results` AVG_BATCH_AMOUNT | `(total / Decimal(count)).quantize(SCALE=4, HALF_UP)` | ✓ Single divide, not Rule 10 |

All chained divide-multiply sites use the Rule 10-compliant order. PR-M-2 (commit `d61e1b46b` per Rule 10 audit history) was the original procurement Rule 10 fix; this sweep confirms no regression and all chained-multiply sites remain compliant.

---

## Rule 11 detail (Jackson LocalDateTime trailing-zero microsecond)

### Pattern definition (recap)

`datetime.isoformat()` pads microsecond to 6 digits; Java Jackson trims trailing zeros (`.150710` → `.15071`). Use `_java_isoformat()` helper for any `LocalDateTime` mirror.

**Critical distinction**: `date.isoformat()` returns just `YYYY-MM-DD` — no microsecond, **no Rule 11 risk**. Rule 11 only applies to `datetime` (LocalDateTime) values.

### Audit per file

| Site | Type | Status |
|---|---|---|
| `analysis_department.py:363,364` | `start_date.isoformat()`, `end_date.isoformat()` — function param `start_date: date, end_date: date` | ✓ Date-only, safe |
| `analysis_region.py` | grep `.isoformat()` returned no matches | ✓ Clean |
| `analysis_procurement.py:650,654` | `week_start.isoformat()`, `rd.isoformat()` — `rd = b.get("receipt_date")` is DB date column | ✓ Date-only, safe |
| `analysis_procurement.py:1161,1162` | `start_date.isoformat()`, `end_date.isoformat()` — function param `start_date: date, end_date: date` | ✓ Date-only, safe |

**Rule 11 M=0** across all 3 files. No `datetime.isoformat()` calls (LocalDateTime mirror) present in the analyzed scope.

---

## Rule 12 detail (String.format HALF_UP vs f-string banker's)

### Pattern definition (recap)

Python `f"{float(d):.Nf}"` uses banker's rounding at `.5` boundary (e.g. `46.55` → `46.5`); Java `String.format("%.Nf", d)` uses HALF_UP (`46.55` → `46.6`). Fix: pre-quantize HALF_UP at exact target scale, then f-string render is safe (boundary already resolved).

### `analysis_department.py` Rule 12 sites — clean

Grep `:[+\-]?[#]?\.[0-9]+f` returned 0 matches. ✓

### `analysis_region.py` Rule 12 sites — clean

Same. ✓

### `analysis_procurement.py` Rule 12 sites

| Line | Site | Status |
|---|---|---|
| 877 | `concentration_display = concentration.quantize(Decimal("0.1"), HALF_UP)` then `f"{concentration_display}%"` | ✓ Already safe (PR-N-1 closer commit `0982195cf` 2026-05-06) |
| 989 | `concentration_display = concentration.quantize(Decimal("0.1"), HALF_UP)` then `f"{concentration_display}%"` (in AI insight message) | ✓ Already safe |
| **899** | **`f"{float(mom_growth):+.1f}%"` — `formattedValue` of PROCUREMENT_MOM_GROWTH KPICard in overview path** | **❌ Rule 12 violation — fixed in this PR** |

### Rule 12 fix: `analysis_procurement.py:899`

**Before**:
```python
metric_results.append({
    ...
    "formattedValue":  f"{float(mom_growth):+.1f}%",
    ...
})
```

**After** (per Rule 12 safe pattern — pre-quantize HALF_UP then float-bridge f-string):
```python
# Rule 12: pre-quantize HALF_UP to scale-1 before f-string render to
# mirror Java String.format("%+.1f", ...). Plain f-string :+.1f via
# float() bridge uses banker's rounding (e.g. 46.55 → 46.5 vs Java 46.6).
mom_growth_display = mom_growth.quantize(Decimal("0.1"), rounding=ROUND_HALF_UP)
metric_results.append({
    ...
    "formattedValue":  f"{float(mom_growth_display):+.1f}%",
    ...
})
```

### Why this is a real prod-relevant fix (not just defensive)

1. **Real path**: `_build_overview_metric_results` is the **default/overview** dispatch (no `analysisType` param) — primary path most factories hit.
2. **Trigger condition**: `mom_growth` from `_calculate_mom_growth` returns scale-2 HALF_UP Decimal. Values landing exactly at `.X5` boundary (e.g. `46.55`, `23.45`) trigger banker's rounding divergence at the 1-decimal display.
3. **Detected by reasoning**: Procurement supplier_concentration (line 877) was the **first** Rule 12 hit (PR-N-1 closer fix). `mom_growth` line 899 is the **same pattern**, missed in PR-N-1's scope (which only fixed `concentration` site).
4. **byte-shape divergence**: Java `String.format("%+.1f", 46.55)` HALF_UP → `"+46.6%"`; Python pre-fix → `"+46.5%"`. 1-byte diff per occurrence under Phase 2A strict-byte gate (currently dict-eq accepts but Phase 3+ strict gate fails).

### Regression test added

`tests/python/smartbi_compat/test_analysis_procurement_contract.py` — `TestProcurementOverviewMomFormattedValueRule12::test_mom_growth_formatted_value_half_boundary`:

- Mocks current period total = `Decimal("146.55")`, previous = `Decimal("100")`
- → `_calculate_mom_growth(146.55, 100)` = `Decimal("46.55")` (scale-2 HALF_UP)
- → Pre-fix f-string: `"+46.5%"` (banker's at `.5` boundary)
- → Post-fix HALF_UP pre-quantize: `"+46.6%"` (mirror Java)
- Asserts `kpiCards[PROCUREMENT_MOM_GROWTH].value == "+46.6%"`

Test uses TestClient + monkeypatch for `_query_material_batches_in_range` / `_query_active_suppliers` / `_query_supplier_by_id`. **Verified PASS post-fix**.

---

## Test results

```
$ pytest tests/python/smartbi_compat/test_analysis_procurement_contract.py
====================== 48 passed, 16 warnings in 10.81s =======================

$ pytest tests/python/smartbi_compat/test_analysis_department_contract.py \
         tests/python/smartbi_compat/test_analysis_region_contract.py
================= 14 passed, 1 skipped, 16 warnings in 10.94s =================
```

All existing tests + 1 new Rule 12 regression test = 62 passed. **0 regression**.

---

## Decision summary

| Rule | Department | Region | Procurement | Action |
|---|---|---|---|---|
| Rule 10 | M=0 | M=0 | M=0 | None — all chained divide-multiply sites mirror Java SCALE=4 intermediate |
| Rule 11 | M=0 | M=0 | M=0 | None — all `.isoformat()` calls are on `date`, not `datetime` |
| Rule 12 | M=0 | M=0 | **M=1** | **Fixed line 899** + regression test |

**Total: M=1 active fix + 6 latent rule sweeps clean**. Phase 2A 7-file 12-rule audit thread closed (chat 2 PR #134 finance + chat history finance/inventory/drilldown/sales fixes + this PR's department/region/procurement).

---

## Phase 2A dict-eq gate consideration

Per Rule 4 official rule (PR #125): Phase 2A locks dict-eq gate, NOT strict-byte. Pattern A/A2 byte deltas are accepted. **Rule 12 is byte-strict scoped** (Pattern A acceptance does NOT extend to Rule 12 per Rule 4 §"Acceptance criteria" table — Rule 12 fix IS expected even under dict-eq gate because the formattedValue string is consumed by frontend display, not numeric dict equality).

Concretely: `f"{val:+.1f}%"` outputs **string** `"+46.5%"` vs `"+46.6%"`. Frontend renders this string verbatim — dict-eq compares string identity, NOT numeric tolerance. **Rule 12 violations DO break dict-eq gate.** Hence this fix is gate-required, not optional defensive.

---

## Coordination notes

- **Independence**: This PR touches `backend/python/smartbi_compat/api/analysis_procurement.py` (1 line + 3-line guard comment) and `tests/python/smartbi_compat/test_analysis_procurement_contract.py` (1 new test class, 80 LOC). Zero overlap with other in-flight chats.
- **Rule audit history update**: Rule 12 audit log in `.claude/rules/python-java-port.md` should be appended with this finding (1 more confirmed site beyond commit `0982195cf` + commit `69b46f4d5`). NOT updating rule file in this PR — defer to standard rule-doc update process.
- **Pattern**: Latent Rule 12 site missed by PR-N-1's narrow scope (only fixed line 877 supplier concentration, not line 899 mom_growth). Sister-chat audit pattern: when a rule fix lands one site, sweep all sister files for the same pattern in same dispatch path.
