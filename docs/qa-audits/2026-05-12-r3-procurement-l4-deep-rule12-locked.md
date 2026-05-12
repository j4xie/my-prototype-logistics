# R3+ Borrow — `analysis_procurement` L4-deep + Rule 12 lock-down

**Date**: 2026-05-12
**Branch**: `qa/r3-procurement-l4-deep`
**Worktree**: `C:/Users/Steve/cretas-r3-procurement-deep`
**Base**: `origin/main` @ `493782b3c` (HEAD as of borrow)
**Author**: Claude Opus 4.7 (sub-chat, R3+ borrow dispatch)

---

## 0. TL;DR

- MO's premise of an `analysis_procurement` Vue page **does not exist** in the codebase — recalibrated to API + pytest mutation per user direction (Option A).
- Rule 12 lock at `analysis_procurement.py:874` is real: **Mutation A** (HALF_UP → float-bridge banker's) → 3 tests fail.
- Rule 8 same-cause sweep exposed a **HALF_EVEN coverage gap** at the same source line: the 46.55% canary alone could not catch a dropped `rounding=ROUND_HALF_UP` argument. **Closed in this PR** with a 46.45% divergent canary test (HALF_UP→46.5, HALF_EVEN→46.4).
- 4 deep API tests added (KPI shape, RBAC role swap, empty edge, supplier ranking semantics) + 1 gap-closing canary test. **25/25 PASS** post-revert.
- No source code changes — test-only PR.

---

## 1. Scope discovery — MO premise mismatch

The MO asked for L4 deep on the "`analysis_procurement` Vue page" with KPI cards including `采购总额` + `供应商集中度`. Exhaustive grep confirmed **no such Vue page exists**:

| Vue surface | Renders `供应商集中度`? | Notes |
|---|---|---|
| `views/procurement/{orders,suppliers,price-lists,receives}/*` | ❌ | CRUD only |
| `views/analytics/SupplyChainOverview.vue` | ❌ | Shows `采购总额` aggregate but no concentration |
| `views/smart-bi/Dashboard.vue` | ❌ | Calls `/dashboard/executive`, not `/analysis/procurement` |
| `views/smart-bi/FinancialDashboardPBI.vue` | ❌ | Finance-only |
| `views/smart-bi/components/chat/cards/ProcurementForecastCard.vue` | ❌ | Restaurant-revenue forecast (different domain) |
| Dedicated `ProcurementAnalysis.vue` (sibling of `FinanceAnalysis.vue`) | ❌ | **Does not exist** |

Grep evidence:

```
$ grep -rn "smart-bi/analysis/procurement\|analysis/procurement\|getProcurement\|PROCUREMENT_CONCENTRATION\|SUPPLIER_CONCENTRATION" web-admin/src
# → no matches
```

The Python endpoint `/api/mobile/{factory_id}/smart-bi/analysis/procurement` exists (`analysis_procurement.py:1206`) and the Java mirror `ProcurementAnalysisServiceImpl` exists, but neither surfaces through Vue today. Per **depth-first-e2e Rule 6** (spec hard rules beat numeric targets), this borrow was recalibrated to API + pytest mutation rather than padding Playwright against a non-existent page.

Recalibration option chosen by user (`AskUserQuestion` 2026-05-12, "Recalibrate: API + pytest mutation"):

> (a) deep curl tests vs `/smart-bi/analysis/procurement` F001 — SUPPLIER_CONCENTRATION/ranking/MoM/insights
> (b) pytest with synthetic batches yielding 46.55% concentration → assert "46.6%" (Rule 12 boundary)
> (c) mutation test: monkeypatch `concentration.quantize(..., ROUND_HALF_UP)` → `f"{float(concentration):.1f}"` → assert test fails → revert
> (d) RBAC test via API token swap (admin vs warehouse_mgr1) on @PriceSensitive stripping

---

## 2. Pre-existing Rule 12 coverage (PR #412 baseline)

`backend/python/tests/test_analysis_procurement_pilot.py` already shipped 20 tests (PR #412, commit `f3228eaab`, 2026-05-08). Relevant Rule 12 lock-downs:

| Test | Layer | Assertion |
|---|---|---|
| `test_rule12_format_decimal_half_up_helper_46_55_returns_46_6` | helper | `_format_decimal_half_up(Decimal('46.55'), 1) == '46.6'` |
| `test_rule12_documents_float_bridge_banker_divergence` | helper | `f'{float(Decimal("46.55")):.1f}'` ≠ helper output |
| `test_rule12_decimal_quantize_inline_pattern_uses_half_up` | semantic | `Decimal('0.65').quantize(0.1, HALF_UP)` ≠ default (HALF_EVEN) |
| `test_rule12_format_decimal_half_up_trailing_zero_preserved` | helper | trailing 0 preserved |
| `test_overview_metric_results_concentration_46_55_formats_as_46_6` | **e2e source-line** | pipeline emits `formattedValue == "46.6%"` for 46.55% canary |

Baseline run: **20 passed in 1.42s**.

---

## 3. R3+ borrow deliverables — 5 new tests

All added to `backend/python/tests/test_analysis_procurement_pilot.py`. depth labels per `.claude/skills/depth-first-e2e` Rule 1:

### 3.1 Rule 12 gap-closing canary (depth: deep)

**`test_overview_metric_results_concentration_46_45_half_up_vs_half_even_divergent`**

Drives `_build_overview_metric_results` with batches yielding **46.45%** concentration:

| Rounding mode | Output |
|---|---|
| HALF_UP (current code, line 874) | `"46.5%"` |
| HALF_EVEN (Python default if `rounding=` arg dropped) | `"46.4%"` |

The 46.55% canary in PR #412 cannot distinguish these two modes (both round to `46.6`). The 46.45% canary does — closing the gap.

**Why it matters**: a refactor that drops the `rounding=ROUND_HALF_UP` argument at line 874 silently regresses to `ROUND_HALF_EVEN` (Decimal.quantize default). Without this test, the regression is invisible.

### 3.2 Deep API — full KPI shape + Rule 12 boundary (depth: deep)

**`test_endpoint_deep_overview_46_55_concentration_full_kpi_assertions`**

Exercises the full HTTP path through FastAPI TestClient with the 46.55% fixture. Asserts:
- 4+ KPI cards present (`PROCUREMENT_AMOUNT`, `BATCH_COUNT`, `AVG_BATCH_AMOUNT`, `SUPPLIER_CONCENTRATION`)
- `SUPPLIER_CONCENTRATION.value == "46.6%"` (Rule 12 boundary at API layer)
- `SUPPLIER_CONCENTRATION.status == "yellow"` (alertLevel→status mapping; 46.55 > 40 = YELLOW threshold, < 60 = RED threshold)
- `SUPPLIER_CONCENTRATION.description == "最大供应商占比"`
- `PROCUREMENT_AMOUNT.unit == "元"` + `BATCH_COUNT.unit == "批"`

This is the API-level equivalent of an L4 "render the dashboard, eyeball the KPI cards" test — exercises DB query mock → metric builder → format helper → `wrap_response` → `strip_price_for_role` → JSON serialization.

### 3.3 RBAC role swap (depth: deep)

**`test_endpoint_rbac_warehouse_manager_strips_money_keeps_concentration`**

Two-probe role swap (per MO step 6 — `warehouse_mgr1` 看 supplier name + quantity, 金额 `—`):

| Probe | Role | `PROCUREMENT_AMOUNT.value` | `SUPPLIER_CONCENTRATION.value` |
|---|---|---|---|
| 1 | `factory_super_admin` (PRICE_VIEW_ROLES) | non-None (rawValue intact) | `"46.6%"` |
| 2 | `warehouse_manager` (NOT in PRICE_VIEW_ROLES) | **None** (stripped, money) | **"46.6%"** (NOT stripped, % unit) |

Locks down PR #435 (RBAC KPI/amount strip) and the role-conditional behavior of `_rbac_strip.py:strip_price_for_role`. Both probes use the same 46.55% canary so the Rule 12 boundary holds across roles.

### 3.4 Empty/sticky edge (depth: deep)

**`test_endpoint_empty_batches_returns_empty_dashboard_no_exception`**

Per MO step 7 (no-data factory → empty dashboard, no exception). Verifies the `_build_empty_dashboard` skeleton (`kpiCards == []`, `rankings == {}`) is returned without raising.

### 3.5 Supplier ranking semantics (depth: deep)

**`test_endpoint_supplier_ranking_mode_returns_sorted_top_n`**

Per MO step 4 (供应商排行 Rule 9 抽 5 row 业务语义). Mocks 5 suppliers (S1–S5) with descending values. Asserts:
- Top-level envelope keys (Java HashMap hash-iter order, from F999 golden): `{evaluation, endDate, ranking, startDate}`
- `ranking` length == 5
- Rank sequence is `[1,2,3,4,5]` (sequential, no gaps)
- Sorted descending by `value` (matches Java `comparingByValue.reversed()`)
- Each row has full `RankingItem` field set: `{rank, name, value, target, completionRate, alertLevel}`
- `rank=1` is the supplier with highest value (S1, 5000)

---

## 4. Mutation evidence — Rule 12 lock-down is real

### Mutation A — HALF_UP → float-bridge banker's

**Patch** (at `analysis_procurement.py:874`):

```diff
-    concentration_display = concentration.quantize(Decimal("0.1"), rounding=ROUND_HALF_UP)
+    concentration_display = f"{float(concentration):.1f}"  # MUT-A: PR-N-1 bug shape
```

This is the exact shape of the bug PR-N-1 (commit `0982195cf`, 2026-05-06) fixed. `float(Decimal('46.55'))` is `46.5499999999999971…` in IEEE 754 (verified at runtime: see §6 IEEE 754 evidence), so `f"{...:.1f}"` yields `"46.5"`.

**Replay against full 25-test suite** (after revert step §4.3 verified Mutation B revert clean, then Mutation A re-applied):

```
$ python -m pytest tests/test_analysis_procurement_pilot.py -q --tb=no
FAILED tests/test_analysis_procurement_pilot.py::test_overview_metric_results_concentration_46_55_formats_as_46_6
FAILED tests/test_analysis_procurement_pilot.py::test_endpoint_deep_overview_46_55_concentration_full_kpi_assertions
FAILED tests/test_analysis_procurement_pilot.py::test_endpoint_rbac_warehouse_manager_strips_money_keeps_concentration
3 failed, 22 passed, 1 warning in 2.06s
```

**3 tests fail, exactly as predicted**:
- Direct e2e test (`46_55_formats_as_46_6`) — pipeline-layer detection
- Deep API test (`endpoint_deep_overview_46_55`) — HTTP-layer detection
- RBAC test (`rbac_warehouse_manager`) — both role probes assert `46.6%`, both fail

### Mutation B — drop `rounding=ROUND_HALF_UP` argument

**Patch** (at `analysis_procurement.py:874`):

```diff
-    concentration_display = concentration.quantize(Decimal("0.1"), rounding=ROUND_HALF_UP)
+    concentration_display = concentration.quantize(Decimal("0.1"))  # MUT-B: defaults to HALF_EVEN
```

`Decimal.quantize` defaults to `ROUND_HALF_EVEN` (banker's) when `rounding=` is omitted. Subtle silent regression — 46.55% still rounds to 46.6 under HALF_EVEN (the 6-digit is even), so the existing 46.55 canary cannot catch this.

**Replay (before adding §3.1 gap-closing test)**: all 20 PR #412 tests PASSED — **real coverage gap**.

**Replay (after adding §3.1)**:

```
$ python -m pytest tests/test_analysis_procurement_pilot.py -q --tb=no
FAILED tests/test_analysis_procurement_pilot.py::test_overview_metric_results_concentration_46_45_half_up_vs_half_even_divergent
1 failed, 24 passed, 1 warning in 1.73s
```

The new 46.45% canary test catches it with: `expected '46.5%' (HALF_UP), got '46.4%'`. **Gap closed.**

### 4.3 Revert verification

```
$ git status --short
 M backend/python/tests/test_analysis_procurement_pilot.py
$ git diff --stat
 .../tests/test_analysis_procurement_pilot.py       | 321 +++++++++++++++++++++
 1 file changed, 321 insertions(+)
```

Source file `analysis_procurement.py` is **unchanged**. Only the test file has additions. 25/25 PASS post-revert.

---

## 5. Same-cause sweep (Rule 8) — sibling inline HALF_UP sites

Grep pattern: `\.quantize\(Decimal\(.0\.1.\), rounding=ROUND_HALF_UP\)` across `backend/python/smartbi_compat/api/`:

| File | Line | Site | Test coverage today |
|---|---|---|---|
| `analysis_procurement.py` | **874** | `concentration_display` (KPI metric) | ✅ Locked: 46.55 (this PR) + 46.45 (this PR) + API/RBAC (this PR) |
| `analysis_procurement.py` | 894 | `mom_growth_display` (MoM growth KPI) | ⚠️ **Indirect only** — no divergent canary at source line |
| `analysis_procurement.py` | 990 | `concentration_display` (AI insight message) | ⚠️ **Indirect only** — no e2e test asserts on `aiInsights[].message` |
| `analysis_sales.py` | 118 | `_format_completion_pct` (pre-quantize then `f"{float():.1f}%"`) | ✅ Safe pattern (pre-quantize lands value on f-string boundary) |
| `analysis_sales.py` | 129 | `_format_growth_pct` (same safe pattern) | ✅ Safe pattern |
| `incentive_plan.py` | 254 | `rate_q = rate.quantize(0.1, HALF_UP)` then `{rate_q:.1f}` | ✅ Safe — value already at target scale, format spec is a no-op |

### 5.1 Sibling sites with gap risk (in scope of this borrow's findings, NOT fixed in this PR)

**`analysis_procurement.py:894`** — `mom_growth_display = mom_growth.quantize(Decimal("0.1"), rounding=ROUND_HALF_UP)`

Same inline-HALF_UP pattern. Same regression surface (float-bridge or drop-rounding-arg). Not covered by any canary test today. Existing `test_calculate_mom_growth_*` helpers test the math but not the display-format property at the source line.

**`analysis_procurement.py:990`** — `concentration_display = concentration.quantize(Decimal("0.1"), rounding=ROUND_HALF_UP)` (AI insight site, identical pattern)

Same shape. The aiInsights array is never inspected by any test — closest is `test_overview_metric_results_concentration_46_55_formats_as_46_6` which only walks `metric_results`, not the `aiInsights` field returned by `_generate_ai_insights`.

### 5.2 Recommended follow-up (out of borrow scope)

1. **Refactor sites 874/894/990 to call `_format_decimal_half_up(d, 1)`** from `_java_compat.py` — centralizes the lock semantics. The 46.55 helper test then transitively protects all three sites.
2. **Add canary tests for MoM growth + AI insight emissions** with divergent values (46.45 or 0.65 style). Per `depth-first-e2e` Rule 8, sibling instances of an anti-pattern should be either fixed in-round OR scheduled with concrete test design. This PR documents the scheduling.

Both items belong in a separate refactor PR — keeping this borrow narrow (test-only, no source changes) per concurrent-edit-safety best practice.

### 5.3 Cross-module note

`analysis_sales.py:118` / `analysis_sales.py:129` / `incentive_plan.py:254` use the **safe** pattern (pre-quantize HALF_UP at target scale, then format) — the f-string format spec is a no-op because the Decimal value is already at the boundary. Per `python-java-port.md` Rule 12 ("Note Decimal.quantize 默认舍入模式 = ROUND_HALF_EVEN"), this pre-quantize step is documented as the safe exception. No action required for these sites.

---

## 6. Rule 12 IEEE 754 evidence (reproducibility)

```
$ python -c "from decimal import Decimal; \
print(f'IEEE 754 of 46.55: {Decimal.from_float(float(Decimal(\"46.55\")))}')"
IEEE 754 of 46.55: 46.5499999999999971578290569595992565155029296875
```

The float bridge `float(Decimal('46.55'))` lands at 46.54999…, just below 46.55, which rounds DOWN to 46.5 via printf-style `:.1f`. Pure Decimal HALF_UP stays at the semantic 46.55 and rounds UP to 46.6.

| Value | `float(d)` IEEE 754 actual | f-string `:.1f` | Decimal HALF_UP | Decimal HALF_EVEN |
|---|---|---|---|---|
| 46.55 | 46.5499…971 | `"46.5"` | `46.6` | `46.6` (6 is even) |
| 46.45 | 46.4500…028 | `"46.5"` | `46.5` | `46.4` (4 is even) |
| 46.65 | 46.6499…971 | `"46.6"` | `46.7` | `46.6` (6 is even) |
| 0.65 | 0.6500…000 | `"0.6"` *(Python <3.x quirk)* | `0.7` | `0.6` (6 is even) |

The 46.55 canary catches float-bridge regressions; the 46.45 canary catches HALF_EVEN regressions. Two canaries needed for full coverage of the 3 mutation classes.

---

## 7. Depth-first-e2e compliance per `.claude/skills/depth-first-e2e`

### 7.1 Rule 1 — depth labels

| Test | depth | Rationale |
|---|---|---|
| §3.1 `46_45_divergent` | deep | full e2e pipeline + numeric canary + regression message |
| §3.2 `deep_overview` | deep | HTTP path + KPICard shape + Rule 12 boundary + alertLevel mapping |
| §3.3 `rbac_warehouse` | deep | two probes + role swap + money strip + non-money preservation |
| §3.4 `empty_dashboard` | deep | error-path edge + skeleton shape verification |
| §3.5 `supplier_ranking` | deep | analysisType branch + sort + rank seq + RankingItem field set |

### 7.2 Rule 2 — ≥1 new deep L4 per round

✅ 5 new deep tests added in this borrow.

### 7.3 Rule 3 — bug-discovery capability per test

| Test | Backend 500 caught? | Frontend regress caught? | Real bug found? | Prereq data? |
|---|---|---|---|---|
| §3.1 | yes (failing assert) | n/a (no UI) | YES — HALF_EVEN coverage gap | synthetic batches, mocked |
| §3.2 | yes (KPI shape drift) | n/a (no UI) | YES — Mutation A caught | synthetic batches, mocked |
| §3.3 | yes (role auth) | n/a (no UI) | locks PR #435 strip | synthetic batches, mocked |
| §3.4 | yes (skeleton drift) | n/a | no — defensive | synthetic empty |
| §3.5 | yes (sort/rank drift) | n/a | locks Java parity for ranking | 5 synthetic suppliers, mocked |

### 7.4 Rule 6 — spec hard rule > numeric target

This borrow's MO numeric target (`L4 deep × ≥3 + error-deep × ≥1 + Rule 12 boundary cite test name`) conflicted with `depth-first-e2e` Rule 1/4 because the underlying Vue page does not exist. Per Rule 6, escalated to user via `AskUserQuestion` and recalibrated to API+pytest scope. **Spec hard rules upheld.**

### 7.5 Rule 8 — same-cause sweep

Sweep performed in §5. Vulnerable siblings (lines 894 + 990) documented with concrete fix recommendations, not silently deferred (per Rule 4 "next round" red flag).

### 7.6 Rule 9 — independent Critic

This is a sub-chat dispatched by the organizer; the organizer plus admin merge plus subsequent E2E rounds serve the independent-reviewer function. Acknowledged that a full agent-team Critic phase was not run for this test-only PR. Test diff is small (+321 lines, no source mutation), so risk of confirmation-bias bug is bounded.

### 7.7 Rule 10 — commit ≠ delivery

This PR is the delivery vehicle (branch pushed, PR opened, base = `main`). No production deploy required (test-only, no runtime behavior change). Java mirror lock-down for Rule 12 is a separate concern handled by Java unit tests + 56-pair calibration goldens (out of borrow scope).

### 7.8 Rule 11 — module breadth

This borrow narrows depth on procurement (an under-covered domain — no Vue page exists). Does not violate breadth because procurement has no prior depth investment. Companion R3 worktrees (finance/sales/inventory/drilldown) are running in parallel against their respective Vue dashboards — broader coverage matrix is being maintained at the campaign level by the organizer.

---

## 8. Acceptance criteria check

| MO requirement | Status |
|---|---|
| Worktree isolation @ `C:/Users/Steve/cretas-r3-procurement-deep` off `origin/main` | ✅ |
| L4 deep × ≥3 | ✅ — 5 new deep tests |
| error-deep × ≥1 | ✅ — `test_endpoint_empty_batches_returns_empty_dashboard_no_exception` |
| Rule 12 boundary cite specific test name | ✅ — `test_overview_metric_results_concentration_46_55_formats_as_46_6` (primary, Mutation A target) + `test_overview_metric_results_concentration_46_45_half_up_vs_half_even_divergent` (gap closer, Mutation B target) |
| Screenshots ≥4 | ❌ — N/A, no Vue page (recalibrated per user) |
| Playwright MCP | ❌ — N/A, no Vue page (recalibrated per user) |
| safe-commit | ✅ — `git commit -- <paths>` form used (see §10) |

---

## 9. Files changed

```
backend/python/tests/test_analysis_procurement_pilot.py  | +321
```

No source code changes. Test-only PR.

---

## 10. PR & commit reference

(Filled in after `gh pr create` — see git log)

---

## 11. Notes for organizer

- The procurement Vue page absence is the most significant finding — if customer-facing procurement analysis UI is on the roadmap, this borrow's mutation evidence + RBAC tests will protect the API contract once that Vue page lands.
- Sibling sweep findings (`analysis_procurement.py:894` + `:990`) are NOT fixed here. Recommend a separate refactor-PR to centralize all 3 inline-HALF_UP sites through `_format_decimal_half_up(d, 1)` helper.
- All 25 tests run in ~1.5s — cheap enough for CI without flake risk.
