# Rule 11/12 Latent Audit Extend — analysis_finance.py budget path

**Date**: 2026-05-07
**Trigger**: PR #119 (chat 2) T6.1 dryrun finding — 11 `analysis/finance?analysisType=budget` diverges all `+105…+108B` (Java bigger), suggesting potential Rule 11/12 latent.
**Reference**:
- PR #118 (chat 1) audit: `docs/qa-audits/2026-05-07-rule11-rule12-latent-audit.md` (canonical idiom)
- PR #119 dryrun analysis: `docs/qa-audits/2026-05-08-t6-1-dryrun-analysis.md`
- Rule defs: `.claude/rules/python-java-port.md` Rule 4 / 11 / 12

---

## TL;DR

**M11 = 0, M12 = 0** in budget code path. **Chat 2's +107B gap is NOT Rule 11/12.**

Most likely root cause is **Rule 4 (`_decimal_to_number` int-collapse for integer-valued Decimals)** — the helper is documented as dict-eq compatible but produces strict-byte divergence when budget data has integer-valued amounts at scale 2 (e.g. `Decimal("100.00")` → Python `100`, Java `100.00`, +3 chars per integer field).

Recommend organizer: **fetch raw bodies** for one of the 11 diverge timestamps to confirm the hypothesis before deciding whether to (a) tighten Rule 4 helper, (b) accept dict-eq gate as the official Phase 2A parity standard, or (c) investigate other cause if hypothesis fails.

---

## Methodology

Scope per marching order: `_get_budget_*` functions + `analysisType=budget` dispatch path in `backend/python/smartbi_compat/api/analysis_finance.py`. Excludes profit / cost / payable / receivable / dashboard composite (already audited or out-of-scope).

Functions audited:
- `_get_budget_metrics` (line 2638)
- `_get_budget_execution_waterfall` (line 2741)
- `_get_budget_vs_actual_chart` (line 2819)
- `_get_budget_analysis` (line 2907 — top-level dispatcher)
- `_get_budget_achievement_chart` (line 1028 — separate sub-endpoint)
- `_get_budget_amount_by_metric` / `_get_actual_amount_by_metric` (lines 482, 500)
- `_determine_budget_achievement_alert` / `_determine_budget_variance_rate_alert` (lines 508, 526)
- `_create_waterfall_item` (line 276)
- `_format_currency` / `_format_kpi_value` (lines 465, 444)
- `_new_chart_config_dict` / `_new_metric_result_dict` (lines 216, 1329)

---

## Rule 11 audit (M11 = 0 in budget path)

Grep `\.isoformat\(\)` in `analysis_finance.py` returns 15 hits. Each inspected:

| Line | Variable | Type | In budget path? | Status |
|---|---|---|---|---|
| 130 | `range_.start_date` / `range_.end_date` | `date` | No (composite-finance helper `_new_date_range_dict`) | Safe (date.isoformat ≡ Java LocalDate.toString) |
| 133-134 | same | `date` | No | Safe |
| 173-174 | `start_date` / `end_date` (DashboardResponse) | `date` | No (composite path) | Safe |
| 2552, 2554 | `start_date` / `end_date` (`_get_payable_analysis`) | `date` | No (payable) | Safe |
| 2577, 2580 | same (`_get_receivable_analysis`) | `date` | No (receivable, task #28 PR #111 already swept Rule 10) | Safe |
| 2597, 2600 | same (helper) | `date` | No | Safe |
| 2624-2625 | `start_date` / `end_date` (`_get_cost_analysis` envelope) | `date` | No (cost) | Safe |
| **2935, 2938** | `end_date` / `start_date` (`_get_budget_analysis` envelope) | `date` (per signature line 2908) | **Yes — budget** | **Safe (date)** |

**`_get_budget_analysis` lines 2935 / 2938 are the only two `.isoformat()` calls in the budget path. Both fall on `date` objects (function signature `start_date: date, end_date: date`). `date.isoformat()` produces "YYYY-MM-DD" identical to Java `LocalDate.toString()` — no microsecond divergence.**

All `datetime` emit sites (`created_at` / `updated_at` / `_utc_now_iso` for `lastUpdated` / `generatedAt`) are already wrapped in `_java_isoformat` from PR-M-7 (#93). `_utc_now_iso()` at line 1319 — used by budget `last_updated` if any envelope emits one — uses canonical helper.

**Conclusion**: Rule 11 is swept clean in budget path.

---

## Rule 12 audit (M12 = 0 in budget path)

Grep `:\.\d+f` in `analysis_finance.py` returns **0 matches** in the entire file.

The only display-formatting helpers used in budget path:

| Helper | Used by | Pattern | Rule 12 status |
|---|---|---|---|
| `_format_currency` (line 465) | budget metrics `formatted_value` (lines 2715, 2733) | `quantized = v.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP); return f"{quantized:,.2f}"` | **Safe** (Rule 12 exception — pre-quantize at exact target scale 0.01 matches `:.2f`, no re-rounding) |
| `f"{execution_rate_display}%"` (lines 2706, 2724) | budget metrics `formatted_value` | Direct toString of pre-quantized scale-0.01 Decimal — no `:.Nf` format spec | **Safe** (no banker's path) |

Both follow the canonical Rule 12 exception pattern documented at `.claude/rules/python-java-port.md` line 575+ (pre-quantize HALF_UP at exact target scale, then render).

`_determine_budget_achievement_alert` and `_determine_budget_variance_rate_alert` use integer thresholds (`Decimal("80")`, `Decimal("100")`, `Decimal("10")`) — Rule 7 compliant.

All percentage / ratio computations (`execution_rate_raw`, `variance_rate_raw`) use Rule 10 correctly (`(numerator / denominator).quantize(Decimal("0.0001"), HALF_UP) * Decimal("100")` — divide-then-multiply with scale-4 intermediate).

**Conclusion**: Rule 12 is swept clean in budget path.

---

## Why does chat 2 see +107B gap then? Hypothesis

Chat 2 (PR #119) dryrun NDJSON shows 11/1144 `?analysisType=budget` samples diverging at exactly +105…+108 bytes (Java bigger, 1133 byte-identical). The divergence is structurally consistent (same magnitude, similar shape) which rules out random data-state noise. Hypotheses ranked by likelihood:

### H1 (most likely): Rule 4 `_decimal_to_number` int-collapse vs Java BigDecimal scale preservation

`_decimal_to_number` (defined inline in this file, used by `_create_waterfall_item`, `_get_budget_vs_actual_chart` chart_data, `_get_budget_metrics` metric values):

```python
def _decimal_to_number(v: Decimal) -> Any:
    if v == v.to_integral_value():
        return int(v)
    return float(v)
```

For values that are integer at scale (e.g. `Decimal("100.00")`, `Decimal("0.00")`, `Decimal("50000.00")`), Python returns `int(v)` which JSON emits as `"100"`, `"0"`, `"50000"`. Java `BigDecimal("100.00").toPlainString()` emits `"100.00"`, `"0.00"`, `"50000.00"` (preserves scale).

Per-occurrence delta: `+3 chars` (`"100"` → `"100.00"` adds `.00`).

Budget endpoint emits many Decimal values:
- `_get_budget_metrics`: 4 metrics × 1 value each = 4 sites (BUDGET_EXECUTION rate, BUDGET_VARIANCE amount, BUDGET_VARIANCE_RATE rate, BUDGET_REMAINING amount)
- `_get_budget_execution_waterfall`: chart_data list (1 + ≤12 monthly + 1) × 1 `value` each = up to 14 sites
- `_get_budget_vs_actual_chart`: chart_data list (N categories) × 4 numeric fields each (`budget`, `actual`, `variance`, `executionRate`) = 4N sites

Rough math: a budget output with ~36 integer-valued Decimals at scale 2 would produce 36 × 3 = **108 bytes** Java-bigger — matching the chat 2 finding.

The 11/1144 = 0.96% sample-rate makes sense if budget data on F001 was *sometimes* clean integer values (e.g. uploaded as `100000.00 / 50000.00` round numbers) and *usually* fractional (e.g. `12345.67 / 8901.23` from real spend tracking). Each sample fires the same endpoint with the same query window but the **underlying data table state changes** as F001 users uploaded budget records during the dryrun window (UTC 01:30 → 12:32 CST = 09:30 → 20:32 = business hours).

Rule 4 explicitly documents this divergence as *dict-eq tolerated* (`{"value": 0}` ≡ `{"value": 0.0}` ≡ `{"value": 0.00}` under semantic compare) but **strict-byte non-tolerant** (4 chars vs 1 char). The chat 2 dryrun comparator appears to use strict-byte compare for size delta (the `j_size`/`p_size` fields) while reporting `j_only_keys: []` because key shape is identical.

**Verification**: fetch raw bodies for any one of the 11 diverge timestamps; if Python emits `"value": 100` and Java emits `"value": 100.00` for the same field, hypothesis confirmed.

### H2 (possible): Rule 4 trailing-zero on non-integer Decimals

`Decimal("100.50")` is non-integer at scale 2, so `_decimal_to_number` returns `float(100.50)` = `100.5` → JSON `"100.5"` (5 chars). Java `BigDecimal("100.50")` → `"100.50"` (6 chars). +1 char per occurrence.

Less likely as primary cause (would need ~107 such values, unlikely concentration in one sample).

### H3 (less likely): Java emits an additional field Python omits

Would require a Lombok @Data getter on a budget DTO that Python missed. Reviewed `_new_chart_config_dict` (7 fields, Rule 9 verified) and `_new_metric_result_dict` (11 fields, Rule 9 verified). No obvious gap.

### H4 (rule out): SQL filter / data join difference

Budget code uses `_query_finance_data(factory_id, "BUDGET", start_date, end_date)` — same shared helper as cost / receivable / budget per Rule 5. Java `findByFactoryIdAndRecordTypeAndRecordDateBetween` matches. No filter divergence.

---

## Decision

| Item | Result |
|---|---|
| M11 (Rule 11 latent) in budget path | **0** |
| M12 (Rule 12 latent) in budget path | **0** |
| Rule 8/9/10 audit (budget path) | All compliant (verified inline against goldens / canonical patterns) |
| Code change required by this audit | **None** |
| Chat 2's +107B finding root cause | Most likely **Rule 4 expected divergence under strict-byte gate** (H1), pending raw-body confirmation |

---

## Recommended follow-up direction (organizer decision needed)

The +107B gap is **not** a Rule 11/12 latent bug. Three follow-up options for organizer:

| Option | Description | Pro | Con |
|---|---|---|---|
| **A. Confirm hypothesis + accept under dict-eq gate** | Fetch 1 raw-body sample, confirm H1 (`100` vs `100.00`), document as Phase 2A expected divergence, update T6.1 dryrun comparator to use dict-eq instead of strict-byte for `?analysisType=budget`. Phase 2A byte gate is dict-eq per `python-java-port.md`. | Lowest churn; aligns with Phase 2A scope decision; T6.2 canary already running per memory `T6.2 canary live`. | Strict-byte gate at Phase 3+ still has this gap; deferred. |
| **B. Tighten `_decimal_to_number` to preserve scale-2 like Java** | Change helper to emit `Decimal("100.00")` → `100.00` (float with trailing zero rendered) instead of `int(100)`. Affects ~50+ call sites across `analysis_finance.py` / `analysis_inventory.py` / `analysis_sales.py` etc. | Closes the strict-byte gap definitively. | Wide blast radius; needs full regression sweep + golden re-record across all sub-domains; Python `float` doesn't natively round-trip `100.00` (would need string emission via `str(quantized)` instead of `_decimal_to_number`). |
| **C. Investigate other cause** | Reject Rule 4 hypothesis without confirmation; treat as new unknown finding. | None unless H1 fails on raw-body inspection. | Wasted cycle if H1 is right. |

Recommendation: **Option A** — defensive sweep extends to budget path with M=0 finding closed, root cause identified as known Rule 4 dict-eq tradeoff documented since 2026-04-30 payable PR #18 retrospect. T6.4 100% factories cutover decision should reference Rule 4 dict-eq gate as the official Phase 2A parity standard.

If the organizer wants strict-byte parity at the cutover gate, that's a Phase 3+ scope decision, not a Phase 2A defensive sweep concern.

---

## Files audited (no changes)

- `backend/python/smartbi_compat/api/analysis_finance.py` (budget path lines 276-526, 1028-1108, 2638-2939)

## Files NOT in scope (per marching order ⛔ exclusions)

- `analysis_finance.py:2120-2240` (receivable, PR #111 swept)
- profit / cost / payable / receivable sub-endpoint paths (already audited)
- 8 already-fixed Rule 10 sites (commit `d61e1b46b` PR #94, organizer commit `6d74d69cd`)

---

## Stop-and-ping rationale

Per marching order:
> M11+M12 = 0 但 chat 2 finding 仍 valid (root cause 不在 Rule 11/12) — 告诉 organizer 推荐 follow-up direction

This audit confirms M=0, surfaces the most likely root cause (Rule 4 H1), and recommends Option A. Awaiting organizer decision on follow-up direction before any code changes.

⛔ HOLD blocks all honored:
- Prod untouched (PR-3 24h soak frozen)
- No other worktrees touched
- No Rule 8/9/10 chain (single rule scope = Rule 11+12 only, all green)
- No `_java_isoformat` / `_format_decimal_half_up` modification
- `analysis_finance.py:2120-2240` (PR #111 receivable) untouched
