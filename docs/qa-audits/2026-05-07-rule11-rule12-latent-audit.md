# Phase 2A Rule 11 + Rule 12 Latent Audit — 2026-05-07

**Scope**: All `backend/python/smartbi_compat/api/*.py` + `backend/python/smartbi_compat/*.py` (non-test, non-fixture).
**Rule 11**: Jackson `LocalDateTime` trailing-zero microsecond trim — `.isoformat()` must be wrapped in `_java_isoformat`.
**Rule 12**: Java `String.format("%.Nf", d)` HALF_UP vs Python `:.Nf` banker's rounding.
**Reference**: `.claude/rules/python-java-port.md`.

---

## Methodology

1. Grep `\.isoformat\(\)` excluding `_java_isoformat`/tests/fixtures (Rule 11).
2. Grep `:\.\d+f` (and `%.Nf` / `format(...,'.Nf')`) excluding tests/fixtures (Rule 12).
3. Each hit inspected for context:
   - Type of value (`date` vs `datetime` for Rule 11 — `date.isoformat()` has no microsecond divergence).
   - Pre-quantize at exact target scale (Rule 12 exception — safe pattern).
   - Log/debug print (false positive — out of scope).
   - Real prod emit into response dict / golden-compared field.

---

## Rule 11 latent sites (M11 = 0)

**No real Rule 11 violations.** Every unwrapped `.isoformat()` call falls on a `date` object (not `datetime`), so there is no trailing-zero microsecond divergence to fix.

| File:Line | Variable | Type | Status |
|---|---|---|---|
| `analysis_department.py:363-364` | `start_date`, `end_date` | `date` (function param) | Safe — `date.isoformat()` ≡ Java `LocalDate.toString()` |
| `analysis_finance.py:130, 133-134, 173-174, 2552, 2554, 2577, 2580, 2597, 2600, 2624-2625, 2935, 2938` | `start_date`, `end_date`, `range_.start_date`, `range_.end_date` | `date` (per `_new_date_range_dict` docstring + function signatures) | Safe |
| `analysis_inventory.py:746, 750, 1018, 1021, 1266, 1269, 1886-1887` | `start_date`, `end_date` | `date` | Safe |
| `analysis_procurement.py:650, 654, 1161-1162` | `week_start`, `rd` (receipt_date), `start_date`, `end_date` | `date` | Safe |
| `analysis_sales.py:470, 473-474, 513-514, 954, 1604` | `range_.start_date`, `start_date`, `end_date`, `d` (order_date) | `date` | Safe (line 954/1604 has explicit `hasattr(d, "isoformat")` guard mirroring SQLAlchemy Row date attr) |
| `dashboard.py:99-100, 102` | `start`, `end` (from `Tuple[date, date]`) | `date` | Safe |

All `datetime.now()` and `created_at`/`updated_at`/`deleted_at`/`last_schema_change` emissions are **already wrapped** in `_java_isoformat` (verified: `analysis.py:74-76, 170-172, 178, 420, 745`; `analysis_finance.py:1319`; `analysis_sales.py:1137`; `datasource.py:173-175, 199-201`; `incentive_plan.py:159`; `query_templates_write.py:38`; `schema_compat.py:93`).

**Conclusion**: Rule 11 is **swept clean**. No fixes required.

---

## Rule 12 latent sites (M12 = 16, all in `analysis.py`)

⚠️ **Single-file scope >15 — stop-and-ping trigger per marching order.**

All 16 sites are user-facing alert / recommendation `message` / `description` strings in
`backend/python/smartbi_compat/api/analysis.py`. Each mirrors a Java
`String.format("%.Nf", value)` HALF_UP pattern in
`backend/java/cretas-api/src/main/java/com/cretas/aims/service/smartbi/impl/RecommendationServiceImpl.java`.
Java callsites verified by grep (lines 184, 194, 216, 226, 265, 301, 312, 334, 344, 359, 369, 416, 426, 522, 599, 648).

| # | File:Line | Function | Pattern | Java mirror | Canonical fix |
|---|---|---|---|---|---|
| 1 | `analysis.py:444` | `_generate_sales_alerts` | `f"...{completion_rate:.1f}%..."` | `RecommendationServiceImpl.java:184` `"%.1f%%"` | `_format_decimal_half_up(completion_rate, 1)` |
| 2 | `analysis.py:455` | `_generate_sales_alerts` | `f"...{completion_rate:.1f}%..."` | `:194` | same |
| 3 | `analysis.py:475` | `_generate_sales_alerts` | `f"...{abs(growth_rate):.1f}%..."` | `:216` | `_format_decimal_half_up(abs(growth_rate), 1)` |
| 4 | `analysis.py:486` | `_generate_sales_alerts` | `f"...{abs(growth_rate):.1f}%..."` | `:226` | same |
| 5 | `analysis.py:517` | `_generate_sales_alerts` | `f"{name} ...{rate:.1f}%"` | `:265` | `_format_decimal_half_up(rate, 1)` |
| 6 | `analysis.py:554` | `_generate_finance_alerts` | `f"...{receivable:.2f}..."` | `:301` `"%.2f"` | `_format_decimal_half_up(receivable, 2)` |
| 7 | `analysis.py:565` | `_generate_finance_alerts` | `f"...{receivable:.2f}..."` | `:312` | same |
| 8 | `analysis.py:582` | `_generate_finance_alerts` | `f"...{variance:.1f}%..."` | `:334` | `_format_decimal_half_up(variance, 1)` |
| 9 | `analysis.py:593` | `_generate_finance_alerts` | `f"...{variance:.1f}%..."` | `:344` | same |
| 10 | `analysis.py:607` | `_generate_finance_alerts` | `f"...{total_receivable:.2f}..."` | `:359` | `_format_decimal_half_up(total_receivable, 2)` |
| 11 | `analysis.py:618` | `_generate_finance_alerts` | `f"...{total_receivable:.2f}..."` | `:369` | same |
| 12 | `analysis.py:663` | `_generate_department_alerts` | `f"{dept_name} ...{per_capita:.2f}..."` | `:416` | `_format_decimal_half_up(per_capita, 2)` |
| 13 | `analysis.py:674` | `_generate_department_alerts` | `f"{dept_name} ...{per_capita:.2f}..."` | `:426` | same |
| 14 | `analysis.py:776` | `_generate_sales_recommendations` | `f"...{concentration:.1f}%..."` | `:522` | `_format_decimal_half_up(concentration, 1)` |
| 15 | `analysis.py:841` | `_generate_cost_recommendations` | `f"...{material_ratio:.1f}%..."` | `:599` | `_format_decimal_half_up(material_ratio, 1)` |
| 16 | `analysis.py:880` | `_generate_customer_recommendations` | `f"...{top_ratio:.1f}%..."` | `:648` | `_format_decimal_half_up(top_ratio, 1)` |

**Why all 16 are real violations**: each value is a `Decimal` (typically pre-quantized at scale 4 by `_calculate_rate` / `_calculate_growth_rate`, or raw money sum by `_sum_field`). Format spec `:.1f` / `:.2f` then re-rounds with banker's (ROUND_HALF_EVEN). Java's `String.format("%.Nf")` uses HALF_UP. Boundary-case divergence:
- `Decimal("15.2500")` `:.1f` → `"15.2"` (banker's), Java → `"15.3"`.
- `Decimal("46.5500")` `:.1f` → `"46.5"`, Java → `"46.6"` (the exact procurement bug from PR-N-1 closer commit `0982195cf`).
- `Decimal("100.555")` `:.2f` → `"100.55"`, Java → `"100.56"`.

These messages are emitted into the `/alerts` and `/recommendations` endpoints (see `analysis.py:945, 971` route registration → `_generate_all_alerts` / `_generate_all_recommendations`), both in T6.x cutover scope.

---

## Rule 12 sites confirmed safe (Rule 12 exception)

| File:Line | Why safe |
|---|---|
| `analysis_sales.py:111` (`_format_currency`) | `quantized = value.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP); return f"{quantized:,.2f}"` — pre-quantized at exact scale 0.01 matches `:.2f`, no re-rounding |
| `analysis_sales.py:117` (`_format_completion_pct`) | `quantized = value.quantize(Decimal("0.1"), rounding=ROUND_HALF_UP); return f"{float(quantized):.1f}%"` — pre-quantized at exact scale 0.1 matches `:.1f` |
| `analysis_sales.py:128` (`_format_growth_pct`) | same pattern as line 117 |
| `incentive_plan.py:259, 263, 267, 271` | Each preceded by `rate_q = rate.quantize(Decimal("0.1"), rounding=ROUND_HALF_UP)` / `gap_q = gap.quantize(Decimal("1"), rounding=ROUND_HALF_UP)`; format spec scale matches quantize scale exactly. Comment at line 238-240 already documents the pattern explicitly. |
| `analysis_procurement.py:881` (`_get_supplier_evaluation`) | Uses `f"{concentration_display}%"` direct toString (no `:.Nf` format spec), where `concentration_display` is `concentration.quantize(Decimal("0.1"), rounding=ROUND_HALF_UP)` — already locked in. |

---

## Files swept clean (no Rule 11 / Rule 12 issues)

- `analysis_drilldown.py` (Rule 12 already fixed in commit `69b46f4d5`; no `.isoformat()` outside Rule 11 scope)
- `analysis_inventory.py` (Rule 12 already fixed in commit `69b46f4d5`)
- `analysis_alerts.py` (none — file does not exist; all alerts are in `analysis.py`)
- `analysis_region.py`, `analysis_department.py`, `analysis_finance.py`, `analysis_procurement.py`, `analysis_sales.py`, `dashboard.py`, `datasource.py`, `incentive_plan.py`, `query_templates_write.py`, `schema_compat.py` — Rule 11 swept (PR-M-7 #93) + Rule 12 either swept or pre-quantized

---

## Decision

| Rule | Findings | Action taken |
|---|---|---|
| Rule 11 | M11 = 0 | No fixes — swept clean |
| Rule 12 | M12 = 16, all in `analysis.py` | Stop-and-ping triggered (>15 sites in one file). User GO on Option A 2026-05-07 → all 16 fixed in single PR (this audit). |

### Fix summary

- 1 import added at top of `analysis.py`: `from smartbi_compat._java_compat import _format_decimal_half_up`
- 16 message/description f-strings updated: `{var:.Nf}` → `{_format_decimal_half_up(var, N)}` with inline `# Rule 12` comment.
- Diff: +17 / -16 in `analysis.py` (1 line for import).
- Pattern mirrors `analysis_inventory.py` 12-site sweep in commit `69b46f4d5` (graph imports `_format_decimal_half_up` at line 42 of that file).

### Scoping options for Rule 12 fix

| Option | Description | Pro | Con |
|---|---|---|---|
| **A. Single PR all 16** | Fix all 16 in one PR (mechanical: each line replaced with `_format_decimal_half_up(...)`; add `from smartbi_compat._java_compat import _format_decimal_half_up` at top of file) | Right-sized given mechanical nature; mirrors PR-N-1 closer + commit `69b46f4d5` precedent (12-site sweep in one commit) | Slightly above the 15 threshold |
| **B. Split 2 PRs** | Split by alert vs recommendation: PR-1 = alerts (lines 444-674, 11 sites in `_generate_sales_alerts` + `_generate_finance_alerts` + `_generate_department_alerts`); PR-2 = recommendations (lines 776, 841, 880, 3 sites) | Each PR <15 | Doubled review/CI; arbitrary split (same rule fix) |
| **C. Defer recommendations** | Only fix the 13 alert sites now; recommendations TODO (3 sites) | Smallest blast radius for T6.4 (alerts more visible) | Still leaves 3 latent sites |

Recommendation: **Option A** — the 16 fixes are mechanical, semantically identical, and mirror the same precedent (`analysis_inventory.py` 12-site sweep landed in one commit). The "scope 炸" trigger is a soft heuristic; 16 single-line replacements + 1 import line is well-contained.

---

## References

- Marching order: `docs/superpowers/dispatch/2026-05-07-rule11-rule12-latent-audit-marching-order.md`
- Rule definitions: `.claude/rules/python-java-port.md` Rule 11 + Rule 12
- Canonical helpers:
  - Rule 11 → `_java_isoformat` in `backend/python/smartbi_compat/schema_compat.py:33`
  - Rule 12 → `_format_decimal_half_up` in `backend/python/smartbi_compat/_java_compat.py`
- Prior sweeps:
  - PR-M-7 (#93, commit `e2a527326`): 8-file Rule 11 sweep
  - PR-N-1 closer (commit `0982195cf`): procurement supplier concentration Rule 12
  - 12-site defensive (commit `69b46f4d5`): `analysis_inventory.py` + `analysis_drilldown.py` Rule 12
  - PR #115 (commit `df81b5232`): Rule 10 latent sweep precedent for this audit pattern
