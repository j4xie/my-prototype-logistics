# Phase 2A `/analysis/procurement` PR-C Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to dispatch the 7 test-class tasks in parallel (one subagent per class group), or superpowers:executing-plans for sequential. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add 33 arithmetic-depth unit tests across 7 classes covering procurement per-type modes (PR-A) + default overview mode (PR-B). Final piece of Phase 2A Wave 3 Tier 2 procurement subdomain — completes the per-domain (PR-A) → default-mode (PR-B) → arithmetic-depth (PR-C) ship cadence.

**Architecture:** Tests-only PR. **NO changes** to `backend/python/smartbi_compat/api/analysis_procurement.py` (impl shipped in Chat 4 PR-A + Chat 5 PR-B). All new tests append to `tests/python/smartbi_compat/test_analysis_procurement_contract.py` (created by Chat 4 PR-A; if it doesn't exist yet, Chat 4 will create it for the 8 contract tests + we extend with 7 arithmetic depth classes).

**Tech Stack:** pytest, monkeypatch fixture, `asyncio.run()` for direct async helper calls, Decimal arithmetic.

**Reference spec:** `docs/superpowers/specs/2026-05-01-phase2a-analysis-procurement-design.md` §5.3 (33 tests across 7 classes — class-by-class coverage table).

**Templates:**
- `tests/python/smartbi_compat/test_analysis_finance_contract.py:319-579` — `TestProfitMetricsArithmetic` (10 tests, monkeypatch + try/finally restore pattern, async fake fn per test)
- `tests/python/smartbi_compat/test_analysis_finance_contract.py:1135-1305` — `TestCostTrendArithmetic` (5 tests, period aggregation + sort + `_get_period_key` direct unit)
- `tests/python/smartbi_compat/test_analysis_finance_factories.py` `TestPayableAgingBucketDepth` (parametrize boundary tests pattern)
- `tests/python/smartbi_compat/test_analysis_finance_contract.py:2106-...` `TestBudgetMetricsArithmetic` (KPI cards + alert thresholds + abs() defensive pattern)

**Concurrency note:** Chat 4 active on `analysis_procurement.py` (PR-A) and Chat 5 active on same file (PR-B). PR-C **DOES NOT TOUCH IMPL**, so safe to run in parallel — but the test file likely is created by Chat 4 PR-A. Block on PR-A merge before branching. Use `./scripts/safe-commit.sh` for every commit per Rule 5b.

---

## ⛔ Hard rules

1. **NO impl changes** to `backend/python/smartbi_compat/api/analysis_procurement.py` — PR-A and PR-B own that file. PR-C is tests-only.
2. **Block on Chat 4 PR-A merge** before branching from `origin/main` — PR-C imports symbols from PR-A.
3. **Block on Chat 5 PR-B merge** before writing `TestProcurementOverviewArithmetic` (6 tests) — that class needs `_get_procurement_overview`, `_build_empty_dashboard`, `_generate_ai_insights`, `_generate_suggestions`, KPI builder. Other 27 tests (6 classes) only need PR-A symbols.
4. **Test file location:** `tests/python/smartbi_compat/test_analysis_procurement_contract.py` (created by Chat 4 PR-A). Append the 7 arithmetic depth classes at end of file.
5. **Mock pattern:** monkeypatch `_query_material_batches_in_range` + `_query_active_suppliers` + `_query_supplier_by_id` (per spec §5.4). Use module-level monkey patch via `monkeypatch.setattr("smartbi_compat.api.analysis_procurement._query_X", fake_X)`.
6. **No fake-routing of inner helpers** — call helpers directly via `asyncio.run(analysis_procurement._calculate_X(...))` for sync-pure-arithmetic functions; use mock-then-call pattern for functions that touch SQL.
7. **All Decimal arithmetic via `Decimal(...)` literals** — NO `float()` casts in test fixtures (drift from Java `BigDecimal` parity). Use `_to_decimal` for type coercion when needed.
8. **Rule 1 compliance** — fixtures use `is not None` ternaries, never `x or default` for Decimal/int values that may be falsy.
9. **Concentration formula precision (R4 audit gap fix)** — `TestProcurementOverviewArithmetic` MUST include 1 byte-equality test for `max=Decimal("60"), total=Decimal("100") → concentration=60.0000` exactly (not 60.0 or 60). See spec §5.3 row 5.
10. **T9 MoM .abs() denom** — `TestProcurementMoMGrowthArithmetic` MUST include the `previous=Decimal("-50"), current=Decimal("10") → +120` (NOT -120) test per spec §3.5 ⚠️ T9 lock.
11. **T1 inverse boundaries** — `TestProcurementConcentrationAlertArithmetic` MUST cover all 5 boundary points: 39.99/40.0/40.01/60.0/60.01. Spec §3.7 line 506-509 explicitly enumerates these.

---

## Symbol dependency map

### From PR-A (Chat 4) — needed by 6 of 7 classes (27/33 tests)

| Symbol | Source §| Used by class |
|---|---|---|
| `_calculate_total_value(batches)` | §3.4 | TestProcurementCostMetricsArithmetic |
| `_calculate_average_unit_price(batches)` | §3.4 | TestProcurementCostMetricsArithmetic |
| `_calculate_mom_growth(current, previous)` | §3.5 | TestProcurementMoMGrowthArithmetic |
| `_calculate_supplier_concentration(batches)` | §3.6 | TestProcurementOverviewArithmetic (precision test) |
| `_PROCUREMENT_CONCENTRATION_RED/YELLOW` consts | §3.7 | TestProcurementConcentrationAlertArithmetic (verify thresholds) |
| `_determine_concentration_alert_level(value)` | §3.7 | TestProcurementConcentrationAlertArithmetic |
| `_format_currency(value)` | §3.7 | (verify trailing format in overview AI insights) |
| `_calculate_price_score(supplier, supplier_batches)` | §3.8 | TestProcurementSupplierEvaluationArithmetic |
| `_calculate_quality_score(supplier_batches)` | §3.8 | TestProcurementSupplierEvaluationArithmetic |
| `_calculate_delivery_score(supplier, supplier_batches)` | §3.8 | TestProcurementSupplierEvaluationArithmetic |
| `_calculate_service_score(supplier)` | §3.8 | TestProcurementSupplierEvaluationArithmetic |
| `_calculate_stability_score(supplier_batches)` | §3.8 | TestProcurementSupplierEvaluationArithmetic |
| `_get_supplier_evaluation(factory_id, start, end)` | §3.9 | TestProcurementSupplierEvaluationArithmetic (empty-batches case) |
| `_get_supplier_ranking(...)` + `_calculate_supplier_ranking_from_data(...)` | §3.10a | TestProcurementSupplierRankingArithmetic |
| `_get_cost_metrics(factory_id, start, end)` | §3.10b | TestProcurementCostMetricsArithmetic |
| `_get_material_category_ranking(...)` | §3.10c | (smoke through `_get_supplier_ranking` percentage path) |
| `_get_procurement_trend_chart(factory_id, start, end, period)` | §3.10d | TestProcurementTrendChartArithmetic |
| `_query_material_batches_in_range`, `_query_active_suppliers`, `_query_supplier_by_id` | §3.3 | All 7 classes (mock target) |

### From PR-B (Chat 5) — needed by 1 of 7 classes (6/33 tests)

| Symbol | Source §| Used by class |
|---|---|---|
| `_get_procurement_overview(factory_id, start, end)` | §3.11 | TestProcurementOverviewArithmetic |
| `_build_empty_dashboard()` | §3.11 (C2) | TestProcurementOverviewArithmetic (empty-data assertion) |
| `_generate_ai_insights(factory_id, batches, kpi_cards)` | §3.12 (I4 refactored sig) | TestProcurementOverviewArithmetic (RED+YELLOW concentration triggers) |
| `_generate_suggestions(...)` | §3.12 | TestProcurementOverviewArithmetic (suggestion trigger conditions) |
| `_calculate_kpi_cards` builder + `_convert_metric_results_to_kpi_cards` | §3.11 | TestProcurementOverviewArithmetic (KPI build assertion) |
| `_build_procurement_trend_chart_from_batches`, `_build_supplier_pie_chart`, `_build_material_category_chart` | §3.11 | TestProcurementOverviewArithmetic (charts key naming) |

---

## Test class breakdown (33 tests)

| Class | Tests | Coverage (per spec §5.3) |
|---|---|---|
| `TestProcurementSupplierRankingArithmetic` | 4 | sort by amount desc / tie-break / on-time-rate alert / negative-amount defensive |
| `TestProcurementSupplierEvaluationArithmetic` | 7 | 5 dimension scorers (1 each) + stability score `100 - cv*100` clamped boundary + empty-batches case |
| `TestProcurementCostMetricsArithmetic` | 5 | total / avg unit price (filter > 0) / max unit price / batch count / MoM growth |
| `TestProcurementTrendChartArithmetic` | 3 | MONTH period / multi-month aggregation / sorted period axis |
| `TestProcurementOverviewArithmetic` | 6 | KPI build / AI insights concentration RED+YELLOW / suggestions trigger conditions / empty dashboard exact strings (C2 verify) / charts key naming / **concentration formula precision byte-eq** (R4 gap fix: `max=60, total=100 → 60.0000`) |
| `TestProcurementMoMGrowthArithmetic` | 4 | T9 edge cases: prev=null / prev=0 / current=null / **negative previous .abs() denom** |
| `TestProcurementConcentrationAlertArithmetic` | 4 | T1 inverse: 39.99→GREEN / 40.0→GREEN (strict `>40`) / 40.01→YELLOW / 60.0→YELLOW / 60.01→RED |

Total: 4+7+5+3+6+4+4 = **33 tests**.

---

## File structure

| File | Change | Lines added |
|---|---|---|
| `tests/python/smartbi_compat/test_analysis_procurement_contract.py` | Append (file created by Chat 4 PR-A) | ~330 LOC (7 classes, 33 tests) |
| `backend/python/smartbi_compat/api/analysis_procurement.py` | **NOT MODIFIED** | 0 |
| `docs/superpowers/plans/2026-05-02-phase2a-procurement-pr-c-impl.md` | Created (this plan) | ~250 |

---

## Pre-flight checklist

- [ ] **PA-1: PR-A status** — Verify `gh pr list --search "phase2a/procurement-pr-a"` shows MERGED. Pull `origin/main` to ensure local `main` has PR-A's `analysis_procurement.py`.
- [ ] **PA-2: PR-B status** — Verify Chat 5 PR-B is MERGED. If still open: write only the 6 PR-A-dependent test classes (27 tests) and ship as PR-C; defer `TestProcurementOverviewArithmetic` to follow-up PR-D. If MERGED: include all 7 classes in single PR.
- [ ] **PA-3: Branch from main** — `git checkout main && git pull origin main && git checkout -b phase2a/procurement-pr-c origin/main`. Confirm starting commit is the merge commit of PR-B (or PR-A if PR-B deferred).
- [ ] **PA-4: Sanity check** — Open `backend/python/smartbi_compat/api/analysis_procurement.py` and `grep -E "_calculate_mom_growth|_determine_concentration_alert_level|_calculate_stability_score|_get_procurement_overview"` to confirm all symbols exist. If any missing → BLOCK and report which PR is incomplete.
- [ ] **PA-5: Existing test class snapshot** — `grep -n "^class Test" tests/python/smartbi_compat/test_analysis_procurement_contract.py` to record what PR-A/PR-B already added (e.g. `TestAnalysisProcurementSupplierMode`, `TestAnalysisProcurementCostMode`, `TestAnalysisProcurementTrendMode`, `TestAnalysisProcurementOverviewMode`). Append PR-C's 7 classes AFTER these.
- [ ] **PA-6: pytest baseline** — `cd backend/python && python -m pytest ../../tests/python/smartbi_compat/test_analysis_procurement_contract.py -v` to confirm baseline passing tests (PR-A 8 + PR-B 3 = 11 contract tests). If failing, BLOCK and report flake.

---

## Tasks (one per class — dispatch in parallel)

### Task 1: `TestProcurementSupplierRankingArithmetic` (4 tests)

**Goal:** Verify `_calculate_supplier_ranking_from_data` produces correct sort order, tie-break behavior, alert level mapping, and abs()-defensive on negative amounts.

**Mock target:** `monkeypatch.setattr("smartbi_compat.api.analysis_procurement._query_supplier_by_id", fake_supplier_lookup)` — to control supplier name fallback in T11 query.

**Tests:**
- [ ] **1.1** `test_sort_by_value_desc` — 3 suppliers with values [100, 300, 200] → ranking[0].value==300, ranking[1].value==200, ranking[2].value==100
- [ ] **1.2** `test_tie_break_stable_order_by_supplier_id` — 2 suppliers with equal values → Python `sorted()` stable, mirror Java Stream.sorted
- [ ] **1.3** `test_quality_alert_level_thresholds` — call `_calculate_quality_score` returning 89 → ranking entry's alertLevel="RED" (<90), 92→YELLOW (<95), 96→GREEN. Pin via mock `_calculate_quality_score`
- [ ] **1.4** `test_negative_value_defensive` — supplier with one batch unit_price=-50, qty=2 → totalValue contribution per `_to_decimal(up) * _to_decimal(rq) = -100`. Currently spec §3.6 calc does NOT abs() on totalValue (unlike cost), so verify rank picks -100 with rank entry value=-100. (Document: this is current behavior; if Java behaves differently, switch to xfail and file followup)

**Subagent dispatch prompt:**
> Implement `TestProcurementSupplierRankingArithmetic` (4 tests) at end of `tests/python/smartbi_compat/test_analysis_procurement_contract.py`. Use template from `TestProfitMetricsArithmetic` (line 319-580 of test_analysis_finance_contract.py): `_run` helper with try/finally monkeypatch restore, async fake fn per test. Mock `_query_material_batches_in_range`, `_query_active_suppliers`, `_query_supplier_by_id`. Mock `_calculate_quality_score` for test 1.3 to return controlled values. After writing, run `python -m pytest tests/python/smartbi_compat/test_analysis_procurement_contract.py::TestProcurementSupplierRankingArithmetic -v` and confirm 4/4 pass.

---

### Task 2: `TestProcurementSupplierEvaluationArithmetic` (7 tests)

**Goal:** Verify each of 5 dimension scorers + stability clamp boundary + empty-batches case.

**Mock target:** Direct calls to scorer functions (no SQL needed for 5 scorer tests). For empty-batches case, mock `_query_material_batches_in_range` to return [].

**Tests:**
- [ ] **2.1** `test_price_score_default` — supplier has rating=70 (Java default), 0 batches → score == Decimal("70")
- [ ] **2.2** `test_quality_score_pass_rate` — 10 batches with 9 quality_pass=true → score == Decimal("90") (90% pass rate)
- [ ] **2.3** `test_delivery_score_on_time_rate` — supplier expected_delivery_days=5; 10 batches with 8 received within 5 days → score == Decimal("80")
- [ ] **2.4** `test_service_score_default` — supplier rating=80 (Java default 80) → score == Decimal("80")
- [ ] **2.5** `test_stability_score_clamp_low` — batches with extreme variance → cv > 1.0 → `100 - cv*100 < 0` → clamp to Decimal("0")
- [ ] **2.6** `test_stability_score_clamp_high_uniform_batches` — batches all equal qty → cv == 0 → score == Decimal("100"), clamp to 100 (not >100)
- [ ] **2.7** `test_supplier_evaluation_empty_batches_returns_no_data_points` — `_query_material_batches_in_range` returns [] → `_get_supplier_evaluation` returns chart_data=[], options still emits 5-dim list

⚠️ **Defer-fix note:** `_calculate_*_score` functions in §3.8 are placeholder pseudo-code; PR-A Chat 4 fills exact Java line 596-678 impl. Tests 2.1-2.6 may need adjusting after PR-A merges to match exact algorithm. Re-read scorer function sources before writing assertions.

**Subagent dispatch prompt:**
> Implement `TestProcurementSupplierEvaluationArithmetic` (7 tests) at end of `tests/python/smartbi_compat/test_analysis_procurement_contract.py`. After PR-A merge, FIRST `Read` `backend/python/smartbi_compat/api/analysis_procurement.py` and locate the 5 dimension scorers (`_calculate_price_score`, `_calculate_quality_score`, `_calculate_delivery_score`, `_calculate_service_score`, `_calculate_stability_score`) — read their actual impl to determine exact input fields needed. Build batch fixtures matching those field requirements. Test stability_score boundaries: empty list → 0 (Java line 666-668 early return), uniform batches → 100, extreme variance → 0 (clamp). Run `python -m pytest tests/python/smartbi_compat/test_analysis_procurement_contract.py::TestProcurementSupplierEvaluationArithmetic -v` and confirm 7/7 pass.

---

### Task 3: `TestProcurementCostMetricsArithmetic` (5 tests)

**Goal:** Verify `_get_cost_metrics` returns 4 or 5 metrics with correct values, alert levels, and dimensionValue.

**Mock target:** monkeypatch `_query_material_batches_in_range` for current+previous periods (called twice per `_get_cost_metrics` invocation per spec §3.10b lines 829-830).

**Tests:**
- [ ] **3.1** `test_total_purchase_amount` — 3 batches with totalValue [10000, 20000, 30000] → metric PROCUREMENT_AMOUNT.value == 60000
- [ ] **3.2** `test_avg_unit_price_filters_zero_or_null` — batches with unit_price=[10, 0, None, 20] → avg = (10+20)/2 = 15 (filter > 0). Verify scale=4 quantize: returns 15.0000 → `_decimal_to_number` → 15
- [ ] **3.3** `test_max_unit_price_emits_when_present` — batches with unit_price=[5, 10, 7] → MAX_UNIT_PRICE.value=10, dimensionValue=material_type_id of batch with unit_price=10. Returns 5 metrics total (incl. MAX_UNIT_PRICE)
- [ ] **3.4** `test_max_unit_price_skipped_when_all_null` — batches with all unit_price=None → no MAX_UNIT_PRICE metric (4 metrics returned). Verify `if valid_priced` branch
- [ ] **3.5** `test_mom_growth_when_previous_period_nonempty` — current period batches sum=120000, previous period batches sum=100000 → momGrowth = (120000-100000)/abs(100000)*100 = 20%. Returns 5 metrics (or 4 if MAX_UNIT_PRICE skipped). Verify changeDirection="UP", value=20

**Subagent dispatch prompt:**
> Implement `TestProcurementCostMetricsArithmetic` (5 tests) at end of `tests/python/smartbi_compat/test_analysis_procurement_contract.py`. Mock `_query_material_batches_in_range` with a 2-call dispatch (returns different rows for `current` vs `previous` based on date params; test 3.5 needs 2 distinct returns). Use template from `TestBudgetMetricsArithmetic` (find via `grep -n "TestBudgetMetricsArithmetic" tests/python/smartbi_compat/test_analysis_finance_contract.py`). Verify 4-metric vs 5-metric scenarios (MAX_UNIT_PRICE conditional). Run `python -m pytest tests/python/smartbi_compat/test_analysis_procurement_contract.py::TestProcurementCostMetricsArithmetic -v` and confirm 5/5 pass.

---

### Task 4: `TestProcurementTrendChartArithmetic` (3 tests)

**Goal:** Verify `_get_procurement_trend_chart` aggregates by period correctly + sort + LINE chart shape.

**Mock target:** `_query_material_batches_in_range`.

**Tests:**
- [ ] **4.1** `test_month_period_aggregation` — 3 batches in different months → chart_data has 3 points keyed by "yyyy-MM"
- [ ] **4.2** `test_multi_month_sorted_ascending` — months [2025-06, 2025-01, 2025-03] → chart_data sorted ["2025-01", "2025-03", "2025-06"] (Java TreeMap → Python sorted())
- [ ] **4.3** `test_chart_shape_keys_match_java` — chart returns dict with keys [chartType=LINE, title="采购趋势", xAxisField="date", yAxisField="amount", seriesField=null, data, options]. Each point has [date, amount] keys (NOT period — different from cost trend). Options: [showDataLabels=False, smooth=True].

**Subagent dispatch prompt:**
> Implement `TestProcurementTrendChartArithmetic` (3 tests) at end of `tests/python/smartbi_compat/test_analysis_procurement_contract.py`. Reuse template from `TestCostTrendArithmetic._run_chart` (line 1144 of test_analysis_finance_contract.py). Mock `_query_material_batches_in_range`. Test 4.3 must verify ALL 7 top-level chart dict keys (chartType/title/xAxisField/yAxisField/seriesField/data/options) AND point dict keys [date, amount] — NOT [period, amount] (procurement uses "date" not "period" per spec §3.10d line 961-963). Run `python -m pytest tests/python/smartbi_compat/test_analysis_procurement_contract.py::TestProcurementTrendChartArithmetic -v` and confirm 3/3 pass.

---

### Task 5: `TestProcurementOverviewArithmetic` (6 tests) — REQUIRES PR-B MERGE

**Goal:** Verify default mode `_get_procurement_overview` builds correct DashboardResponse + AI insights triggers + suggestion triggers + empty-dashboard exact strings + charts key naming + **concentration formula precision byte-eq**.

**Mock target:** `_query_material_batches_in_range`, `_query_active_suppliers`, `_query_supplier_by_id` (PR-B may also call `_calculate_quality_score` etc internally — verify via Read after PR-B merges).

**Tests:**
- [ ] **5.1** `test_kpi_cards_built_5_metrics` — non-empty batches → kpiCards list has 5 entries (PROCUREMENT_AMOUNT / BATCH_COUNT / AVG_UNIT_PRICE / SUPPLIER_CONCENTRATION / MOM_GROWTH). Verify metricCode for each.
- [ ] **5.2** `test_ai_insights_concentration_red_yellow_triggers` — supplier values [80, 10, 10] → concentration=80% → AIInsight with level=RED. Then [50, 30, 20] → 50% → level=YELLOW. Verify "供应商风险" category, message format `供应商集中度高达 X.X%`.
- [ ] **5.3** `test_suggestions_trigger_conditions` — non-empty batches → suggestions list has rule-triggered entries. Verify at least one suggestion when concentration>RED. (Read PR-B `_generate_suggestions` impl for exact rules.)
- [ ] **5.4** `test_empty_dashboard_exact_strings` — empty batches → return matches `_build_empty_dashboard()` C2 strings exactly:
  - aiInsights[0].level=="YELLOW" (NOT "INFO")
  - aiInsights[0].category=="数据状态"
  - aiInsights[0].message=="当前时间范围内暂无采购数据" (NOT "暂无采购数据")
  - aiInsights[0].actionSuggestion=="请调整时间范围或录入采购数据" (NOT None)
  - suggestions[0]=="请先录入采购数据以开始分析" (NOT [])
- [ ] **5.5** `test_charts_key_naming_replaces_space_with_underscore` — chart titles "采购趋势", "供应商分布", "原材料分类" → charts dict keys are "采购趋势", "供应商分布", "原材料分类" (no spaces in Chinese, but verify the `.replace(" ", "_")` mechanism is exercised — find a chart title with English space if any exists; otherwise verify Chinese keys preserved)
- [ ] **5.6** `test_concentration_formula_precision_byte_eq` — 2 suppliers with totalValue=Decimal("60") and Decimal("40") → `_calculate_supplier_concentration` returns exactly Decimal("60.0000") (NOT 60 or 60.0). Verify `_decimal_to_number(60.0000)` serializes to integer 60 in dict. **Round 4 audit gap fix.**

**Subagent dispatch prompt:**
> Implement `TestProcurementOverviewArithmetic` (6 tests) at end of `tests/python/smartbi_compat/test_analysis_procurement_contract.py`. **PREREQ:** Verify Chat 5 PR-B is merged via `gh pr list --search "phase2a/procurement-pr-b" --state merged`. After merge, FIRST `Read` `backend/python/smartbi_compat/api/analysis_procurement.py` to locate `_get_procurement_overview` / `_build_empty_dashboard` / `_generate_ai_insights` / `_generate_suggestions` / KPI builder + chart builders. Note any signature changes vs spec (esp. PR-B I4 fix for `_generate_ai_insights(factory_id, ...)`). Test 5.4 (empty dashboard) MUST verify exact Chinese strings — copy from spec §3.11 lines 1100-1108 verbatim. Test 5.6 (concentration precision) MUST assert byte-equality on Decimal("60.0000") (not Decimal(60)). Run `python -m pytest tests/python/smartbi_compat/test_analysis_procurement_contract.py::TestProcurementOverviewArithmetic -v` and confirm 6/6 pass.

---

### Task 6: `TestProcurementMoMGrowthArithmetic` (4 tests)

**Goal:** Verify `_calculate_mom_growth(current, previous)` 3 edge cases + .abs() denom (T9 lock per spec §3.5).

**Mock target:** None — direct synchronous call to `_calculate_mom_growth`.

**Tests:**
- [ ] **6.1** `test_previous_none_returns_100_when_current_positive` — `_calculate_mom_growth(Decimal("50"), None)` → Decimal("100"). Same for previous=Decimal("0").
- [ ] **6.2** `test_previous_none_returns_zero_when_current_zero_or_none` — `_calculate_mom_growth(None, None)` → 0. `_calculate_mom_growth(Decimal("0"), None)` → 0. `_calculate_mom_growth(Decimal("0"), Decimal("0"))` → 0.
- [ ] **6.3** `test_current_none_returns_neg_100_with_nonzero_previous` — `_calculate_mom_growth(None, Decimal("50"))` → Decimal("-100").
- [ ] **6.4** `test_negative_previous_abs_denom` — **T9 lock** — `_calculate_mom_growth(Decimal("10"), Decimal("-50"))` → +120 (NOT -120). Algebra: change=10-(-50)=60; 60/abs(-50)=60/50=1.2; *100=120. Verify Python returns Decimal("120") or Decimal("120.00") (display scale=2).

**Subagent dispatch prompt:**
> Implement `TestProcurementMoMGrowthArithmetic` (4 tests) at end of `tests/python/smartbi_compat/test_analysis_procurement_contract.py`. Pure synchronous calls to `analysis_procurement._calculate_mom_growth(current, previous)` — no async, no monkeypatch. Test 6.4 is the T9 lock — the assertion `result == Decimal("120") or result == Decimal("120.00")` (depending on PR-A's scale handling). Verify `previous=-50, current=10 → +120`. Run `python -m pytest tests/python/smartbi_compat/test_analysis_procurement_contract.py::TestProcurementMoMGrowthArithmetic -v` and confirm 4/4 pass.

---

### Task 7: `TestProcurementConcentrationAlertArithmetic` (4 tests)

**Goal:** Verify `_determine_concentration_alert_level` T1 inverse threshold boundaries (5 boundary points).

**Mock target:** None — direct synchronous call.

**Tests:**
- [ ] **7.1** `test_below_yellow_threshold_returns_green` — `_determine_concentration_alert_level(Decimal("39.99"))` → "GREEN". Then `Decimal("40.0")` → "GREEN" (strict `>` 40, NOT `>=`).
- [ ] **7.2** `test_at_yellow_boundary_above_returns_yellow` — `_determine_concentration_alert_level(Decimal("40.01"))` → "YELLOW".
- [ ] **7.3** `test_below_red_threshold_returns_yellow` — `_determine_concentration_alert_level(Decimal("60.0"))` → "YELLOW" (strict `>` 60, NOT `>=`).
- [ ] **7.4** `test_above_red_threshold_returns_red` — `_determine_concentration_alert_level(Decimal("60.01"))` → "RED".

⚠️ Spec §3.7 line 506-509 explicitly enumerates these 5 boundary points (39.99/40.0/40.01/60.0/60.01). Combine into 4 tests as table above.

**Subagent dispatch prompt:**
> Implement `TestProcurementConcentrationAlertArithmetic` (4 tests) at end of `tests/python/smartbi_compat/test_analysis_procurement_contract.py`. Pure synchronous calls to `analysis_procurement._determine_concentration_alert_level(value)`. Use parametrize for boundary table. Verify ALL 5 boundary points (39.99/40.0/40.01/60.0/60.01) — Java line 1109-1116 uses strict `>` comparison (NOT `>=`). Run `python -m pytest tests/python/smartbi_compat/test_analysis_procurement_contract.py::TestProcurementConcentrationAlertArithmetic -v` and confirm 4/4 pass.

---

## Task 8: pytest gate + commit

- [ ] **8.1 Full procurement test suite gate**
  ```bash
  cd backend/python && python -m pytest ../../tests/python/smartbi_compat/test_analysis_procurement_contract.py -v --tb=short
  ```
  Expected: 11 (PR-A+B contract) + 33 (PR-C arithmetic) = **44 tests pass**.

- [ ] **8.2 Full backend python suite (no regression)**
  ```bash
  cd backend/python && python -m pytest ../../tests/python/smartbi_compat/ -v --tb=short
  ```
  Expected: all green; if any pre-existing flake, document and skip — do not fix in this PR.

- [ ] **8.3 Commit using safe-commit.sh**
  ```bash
  ./scripts/safe-commit.sh "Phase 2A procurement PR-C: 33 arithmetic depth tests (7 classes)" tests/python/smartbi_compat/test_analysis_procurement_contract.py
  ```
  Per `concurrent-edit-safety.md` Rule 5b — explicit path commit avoids husky/lint-staged scope creep from parallel sister chats.

- [ ] **8.4 Push branch + open PR**
  ```bash
  git push -u origin phase2a/procurement-pr-c
  gh pr create --title "Phase 2A: /analysis/procurement arithmetic depth tests (PR-C)" --body "$(cat docs/superpowers/plans/2026-05-02-phase2a-procurement-pr-c-impl.md | head -30)"
  ```
  PR body: paste plan summary + class breakdown table + test counts.

---

## Subagent dispatch strategy (recommended: parallel)

Per `superpowers:subagent-driven-development` — these 7 tasks have **no shared state** (each appends to a different test class in same file) and **no sequential dependency** (can run in parallel after PR-A merge gate). Dispatch 7 subagents in a single message:

| Subagent | Task | Estimated time |
|---|---|---|
| Subagent 1 | Task 1 (4 tests, ranking) | 30-40 min |
| Subagent 2 | Task 2 (7 tests, evaluation — needs Read of dim scorers first) | 60-80 min |
| Subagent 3 | Task 3 (5 tests, cost metrics) | 40-50 min |
| Subagent 4 | Task 4 (3 tests, trend chart) | 25-30 min |
| Subagent 5 | Task 5 (6 tests, overview — REQUIRES PR-B MERGE) | 60-80 min |
| Subagent 6 | Task 6 (4 tests, MoM growth) | 25-30 min |
| Subagent 7 | Task 7 (4 tests, concentration alert) | 20-25 min |

Wall-clock estimate (parallel): ~80 min worst-case (slowest subagent) + 30 min main session integration. **Total estimated ship time: 4-5h** including PR-A merge wait + PR-B merge wait + plan/dispatch/verify.

⚠️ **Caveat:** All 7 subagents append to the same file. Coordinate by:
1. Each subagent uses unique class name (no collision risk)
2. Each appends at end of file via Read (find last line) → Edit with exact tail context
3. After all 7 finish, main session does `git diff` to verify clean append (no overlapping edits)
4. Run `python -m pytest tests/python/smartbi_compat/test_analysis_procurement_contract.py -v` once all dispatches complete

Alternative: sequential dispatch (Tasks 6 → 7 → 4 → 1 → 3 → 2 → 5 in increasing complexity order) — slower wall-clock (~3h) but zero collision risk. Pick parallel if comfortable with monitor + git-diff sanity check; sequential if any subagent has shown flakiness recently.

---

## Risk register

| # | Risk | Mitigation |
|---|---|---|
| R1 | PR-A symbols renamed/refactored mid-flight by Chat 4 | Plan task subagents start with `Read` of `analysis_procurement.py` to confirm exact symbol names before assertions |
| R2 | PR-B `_generate_ai_insights` signature differs from spec I4 (factory_id first vs not) | Task 5 subagent re-Reads PR-B impl first; mock setup adjusts to actual signature |
| R3 | Test file collision when 7 subagents append in parallel | Dispatch with unique class names; main session post-dispatch `git diff` verify; if collision, sequential re-dispatch |
| R4 | Stability score `100 - cv * 100` clamp test fails because PR-A used different formula | Task 2 subagent reads PR-A impl first (per ⚠️ defer-fix note in Task 2); update test to match |
| R5 | Empty dashboard strings drift between spec §3.11 and PR-B impl (C2 was a Round 4 fix) | Task 5.4 reads PR-B `_build_empty_dashboard` source verbatim; copy strings from impl, not spec |
| R6 | Decimal precision asserts (test 5.6) fail because PR-A returns float not Decimal | Read `_calculate_supplier_concentration` return type after PR-A merge; if `_decimal_to_number` already converts, adjust assert to `result == 60` (int) instead of `Decimal("60.0000")` |
| R7 | Concurrent edit (Chat 4 PR-A WIP commits while Chat 5 PR-B and we are all editing same impl file) — but PR-C doesn't touch impl | We're tests-only; only test file is modified; no risk from concurrent impl chats |
| R8 | pytest baseline already failing on procurement contract test (PR-A or PR-B introduced flake) | PA-6 baseline check; if failing, BLOCK and report to user — do not bury under new PR-C tests |

---

## Notes

- **No goldens needed** — PR-C is arithmetic depth tests, not byte-shape contract. Goldens (4 modes) are recorded by PR-A (3 modes: supplier/cost/trend) and PR-B (1 mode: default/overview).
- **No spec changes** — PR-C consumes PR-A+PR-B impl as black box.
- **Plan file commit** — this plan file is committed in PR-C alongside the tests. Per Apr 11 incident (`feedback_concurrent_edit_safety.md` Rule 5b), explicit `safe-commit.sh` with both file paths.
- **CI gate after merge** — Phase 2A `/analysis/procurement` 4-mode dispatcher then has 44 total tests pinned; future Phase 2B+ refactors must keep all green.

---

## References

- Spec: `docs/superpowers/specs/2026-05-01-phase2a-analysis-procurement-design.md` §5 test strategy + §3 algorithm
- Sister test templates:
  - `tests/python/smartbi_compat/test_analysis_finance_contract.py:319-580` (TestProfitMetricsArithmetic — direct call + monkeypatch try/finally)
  - `tests/python/smartbi_compat/test_analysis_finance_contract.py:1135-1305` (TestCostTrendArithmetic — period aggregation)
  - `tests/python/smartbi_compat/test_analysis_finance_contract.py:2106-...` (TestBudgetMetricsArithmetic — KPI alert thresholds)
- Sister PR-Bs (template precedent):
  - PR #28 cost PR-B (TestCostTrendArithmetic, 5 tests)
  - PR #46 receivable PR-B (73 tests across 5 classes)
  - PR #51 payable PR-B (3 classes, ~30 tests)
  - PR #44 budget PR-B (4 classes, 22 tests)
- Hard rules: `.claude/rules/python-java-port.md` Rule 1-9
- Concurrent edit safety: `.claude/rules/concurrent-edit-safety.md` Rule 5b
- Backlog: `docs/superpowers/plans/2026-05-01-phase2a-remaining-endpoints-backlog.md`
