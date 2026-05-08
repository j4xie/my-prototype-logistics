# Rule 10/11/12 Latent Sweep — `analysis_finance.py` (M=0 baseline)

**Date**: 2026-05-08
**Trigger**: Long-term right path post Pattern B chain closure (PR #119/#124/#127/#131/#135/#137). File-wide audit before T6.4 real-customer-factories surface latent rules at different data shapes.
**Scope**: `backend/python/smartbi_compat/api/analysis_finance.py` (3416 LOC).
**Outcome**: **M=0 latent across Rule 10/11/12.** No fix code applied; regression tests + audit doc only.

---

## TL;DR

`analysis_finance.py` is **fully compliant** with Phase 2A Rules 10/11/12 as of HEAD `6310f0027`. Comprehensive grep + line-by-line verification surfaced zero violations across:

| Rule | Pattern | Sites scanned | Violations |
|---|---|---:|---:|
| Rule 10 (BigDecimal divide-multiply) | `(n/d) * Decimal("K")` requiring intermediate `quantize(Decimal("0.0001"))` | 21 sites with `* Decimal("100")` + 1 standalone (`gross * 0.70`, N/A) | **0** |
| Rule 11 (LocalDateTime microsecond) | `datetime.<expr>.isoformat()` requiring `_java_isoformat` wrap | 1 datetime site + 15 `date.isoformat()` (no risk) | **0** |
| Rule 12 (HALF_UP vs banker's) | f-string `:.Nf` / printf `"%.Nf"` / `format(d, '.Nf')` / Python `round()` / `Decimal.quantize` without explicit rounding | 0 f-string + 0 printf + 0 round() builtin + 93 quantize calls (all with `rounding=ROUND_HALF_UP`) | **0** |

**Rationale for M=0**: this file has been heavily audited and swept since chat 4 PR-M-2 (PR #94 2026-05-06). Subsequent defensive sweeps in commits `e4a7cf6f3`, `8decb4e61`, `5f078bb35`, `5111bc2e4`, `81dd21728` closed all originally noted latent sites. Pattern B chain (#131/#135) added fresh code that was Rule-compliant by design.

---

## 1. Methodology

### 1.1 Static analysis approach

All audits are **pure source-text scans** — no runtime, no DB. Grep + paren-walking AST scans for each rule's anti-pattern.

| Tool | Use |
|---|---|
| `grep` | Locate candidate sites |
| `python -c` paren-walker | Capture full `.quantize(...)` calls (multi-line) |
| `_strip_strings_and_comments` | Filter false positives in docstrings/comments |
| Line-by-line context window (±5 lines) | Verify intermediate quantize before multiply |

### 1.2 Rule 10 audit (BigDecimal divide-then-multiply)

**Anti-pattern** (per `.claude/rules/python-java-port.md` Rule 10):

```python
# ❌ BAD: compounded rounding error
return (actual / target * Decimal("100")).quantize(Decimal("0.01"), ROUND_HALF_UP)
```

**Compliant pattern**:

```python
# ✅ GOOD: intermediate quantize at scale 4 BEFORE multiply
intermediate = (actual / target).quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP)
result = intermediate * Decimal("100")
return result.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
```

**Scan**: `grep '\* Decimal("[0-9.]+")'` then verify each site has `.quantize(Decimal("0.0001")` within preceding 5 lines.

**Sites verified compliant** (current line numbers):

```
264, 587, 632, 906, 912, 920, 947, 1077, 2030, 2044, 2061, 2200, 2266,
2467, 2538, 2573, 2831, 3014, 3029, 3208 (* Decimal("100"))
2261 (gross * Decimal("0.70")) — standalone, Rule 10 N/A
```

**Chat 4 historically noted latent sites** (May 6 line numbering) — all closed:

| Old line | Function | Current location | Fix commit |
|---|---|---|---|
| 1666/1679/1695 | `_get_profit_metrics` gross_margin / net_margin / ROI | 2030/2044/2061 | `8decb4e61` (profitMetrics defensive sweep) |
| 1832/1896 | `_get_profit_trend_chart` / chart-from-finance-data | 2200/2266 | `e4a7cf6f3` (5 Rule 10 latent sites in analysis_finance.py) |
| 2095 | cost trend chart | (within 2200 area) | `e4a7cf6f3` |
| 2163/2195 | receivable aging chart / metrics | 2467/2538/2573 | `5111bc2e4` (receivable defensive sweep) |
| 2636/2651/2830 | budget execution / variance | 2831/3014/3029 | `81dd21728` (budget yoy-mom Rule 10) |
| `_safe_growth_rate` | growth rate formula | line 563 | inline comment cites "2026-05-07 proactive fix" |
| `_calculate_metric_from_sales` | gross_margin from sales fallback | line 592 | inline comment cites "Rule 10: divide quantize FIRST" |

### 1.3 Rule 11 audit (LocalDateTime microsecond)

**Anti-pattern**:

```python
# ❌ BAD: 6-digit microsecond, Java drops trailing zeros
datetime.now(timezone.utc).isoformat()
```

**Compliant pattern**:

```python
# ✅ GOOD: _java_isoformat wraps to mirror Jackson trailing-zero truncation
_java_isoformat(datetime.now(timezone.utc).replace(tzinfo=None))
```

**Scan**: `grep '\.isoformat('` — separate `datetime` callers from `date` callers.

**Sites found**:
- 1 `datetime.now(...)` site at line 1333 in `_utc_now_iso()` — wrapped in `_java_isoformat()` ✓
- 15 `date.isoformat()` sites (start_date / end_date / range_.start_date / range_.end_date) — `date.isoformat()` produces `YYYY-MM-DD` (no microsecond), matches Java `LocalDate.toString()` exactly. **No microsecond risk.**

### 1.4 Rule 12 audit (HALF_UP vs banker's rounding)

**Anti-patterns**:

```python
# ❌ BAD: Python f-string :.Nf uses banker's (round half to even)
f"{value:.1f}%"
# ❌ BAD: printf-style same
"%.1f" % value
# ❌ BAD: format() with .Nf same
format(value, ".1f")
# ❌ BAD: Python builtin round() also banker's by default
round(value, 1)
# ❌ BAD: Decimal.quantize without rounding kwarg defaults to ROUND_HALF_EVEN (banker's)
value.quantize(Decimal("0.01"))
```

**Compliant pattern**:

```python
# ✅ GOOD: Decimal.quantize with explicit ROUND_HALF_UP
value.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
```

**Sites scanned**:
- 0 f-string `:.Nf` patterns (regex `\{[^{}]+:\.\d+f[^{}]*\}`)
- 0 printf-style `"%.Nf"` patterns (regex `"%\.\d+f"|'%\.\d+f'`)
- 0 `format(d, '.Nf')` patterns
- 0 Python `round(...)` builtin calls (regex `(?<![_.\w])round\(`)
- **93 `.quantize(...)` calls — all with explicit `rounding=ROUND_HALF_UP`** (paren-walking AST scan; 2 false positives in docstrings filtered out)

---

## 2. Why M=0?

Pattern B chain (#119/#124/#127/#131/#135/#137) plus chat 4 / sister-chat defensive sweeps (PR #94 / `e4a7cf6f3` / `8decb4e61` / `5f078bb35` / `5111bc2e4` / `81dd21728` / `69b46f4d5`) progressively closed every originally noted latent site. New code added in Pattern B PRs (#131/#135) was Rule-compliant by design (PR #135 specifically uses `_decimal_to_number` per Rule 4 + reuses existing `_format_kpi_value` per Rule 12 + `_utc_now_iso` per Rule 11).

The file has graduated to **fully compliant baseline**. T6.4 readiness gate verified at the source-code level.

---

## 3. Regression tests (this PR)

**File**: `tests/python/smartbi_compat/test_analysis_finance_rules_audit.py`

10 regression tests lock in the M=0 baseline. Each test scans `analysis_finance.py` source text for the corresponding anti-pattern and asserts zero violations. Future devs adding a violating pattern will trigger CI failure with line-number-pointed error message.

| Test | Asserts |
|---|---|
| `test_rule_10_all_multiply_100_have_intermediate_quantize` | Every `(n/d) * Decimal("100")` has `.quantize(Decimal("0.0001"), ...)` within preceding 5 lines |
| `test_rule_10_safe_growth_rate_intermediate_quantize` | `_safe_growth_rate` body contains `Decimal("0.0001")` quantize |
| `test_rule_10_calculate_metric_from_sales_intermediate_quantize` | `_calculate_metric_from_sales` body contains `Decimal("0.0001")` quantize |
| `test_rule_11_no_unwrapped_datetime_isoformat` | No `datetime.<expr>.isoformat()` without `_java_isoformat()` wrap |
| `test_rule_11_utc_now_iso_uses_java_isoformat` | `_utc_now_iso()` body contains `_java_isoformat(` and `datetime.now(` |
| `test_rule_12_no_fstring_decimal_format` | No `{x:.Nf}` patterns |
| `test_rule_12_no_percent_decimal_format` | No `"%.Nf"` patterns |
| `test_rule_12_no_python_round_builtin` | No Python builtin `round(` (allowed: `_round(`, `.round(`) |
| `test_rule_12_all_quantize_have_explicit_rounding` | Every `.quantize(...)` has `rounding=` or `ROUND_HALF_*` |
| `test_audit_baseline_m_zero` | Cross-rule canary: total violations across all 4 patterns = 0 |

Pure-text-scan tests run in <1s, no runtime/DB dependency. CI-safe.

---

## 4. Out of scope

This sweep is **single-file** per directive: `analysis_finance.py` only. **NOT** swept here:

- `analysis_sales.py` / `analysis_department.py` / `analysis_region.py` / `analysis_inventory.py` / `analysis_procurement.py` / `analysis_drilldown.py` — separate sweeps may be needed
- Other Python primitives (`gold/queries.py`, `gold/shadow_compare.py`)
- Java side (Java is the reference, not the audit target)
- Test files themselves (regression tests don't audit themselves)

T6.4 readiness check: extending this sweep methodology to sister files (`analysis_*.py`) before real customer factories cutover is recommended. Filed as follow-up consideration.

---

## 5. Cross-reference

- **Rule definitions**: `.claude/rules/python-java-port.md` Rules 10/11/12
- **Pattern B chain**: project memory `project_2026_05_07_t6_1_dryrun_in_flight.md` — full PR list
- **Chat 4 PR-M-2 origin**: PR #94 (`d61e1b46b`) graduated Rule 10
- **Phase 2A dict-eq gate**: `python-java-port.md` Rule 4 official entry — Pattern A/A2 expected divergence vs Rule 10/11/12 strict-byte fixable
- **Test env config restore**: handled in PR #137 (PR-C tests) — N/A for this audit since no Java-side recording needed
