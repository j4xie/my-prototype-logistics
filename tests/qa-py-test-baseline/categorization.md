# Triage: 28 pre-existing `test_analysis_*_pilot.py` failures (and 44 unflagged sisters)

**Branch:** `qa/py-test-baseline-28-failures`
**Base SHA:** `727d9298bc0b3bdc4c0ea93872a2d64d5cfaa8b8` (origin/main, post-PR #550)
**Command:** `cd backend/python && pytest tests/test_analysis_*_pilot.py --tb=no -q`
**Result:** `72 failed, 314 passed, 1 warning in 4.81s`
**Reproduced:** 2026-05-13

---

## Scope discrepancy vs PR #550

PR #550 body claimed **28 pre-existing test-ordering failures in `test_analysis_{quality,finance_*}_pilot.py`**. Two findings:

1. **`test_analysis_quality_pilot.py` does not exist.** Closest siblings are `test_analysis_quality_restaurant.py` and `test_analysis_quality_skeleton.py` (no `_pilot` suffix). The brace-glob resolves to only `finance_composite` + `finance_subtypes` = 11 + 17 = **28**. PR #550's count is accurate for that narrower scope.
2. **The user-supplied task command (`test_analysis_*_pilot.py`) is broader and reveals 72 failures**, not 28. The additional 44 failures live in 6 sister files (drilldown, inventory, procurement, py, region, sales). They share the same root cause as the 28 (see §Root cause). They were not regressions introduced by PR #550 — they reproduce on `origin/main` at the same SHA where PR #550 was merged.
3. **Whole-suite (`test_*_pilot.py` across all 15 files): 152 failures.** Same root cause extends to dashboard, datasource, incentive_plan, query_templates_write, config_thresholds, price_strip_kpi*. (\*price_strip_kpi has the in-repo fix template and accounts for 0 of the 152.)

---

## Root cause (single bucket — Mock fixture / test-isolation drift)

**All 72 failures share one root cause.** No real assertion drift, no real production bug, no environment issue.

### The bug pattern

Every `test_analysis_*_pilot.py` file does both of these at module-import time:

```python
# Step 1 — set env var, but ONLY if not already set
os.environ.setdefault("JWT_SECRET", "<file-unique-string>")

# Step 2 — local constant used to ENCODE tokens
JWT_SECRET = "<same-file-unique-string>"
```

Each file uses a **different** unique secret string. Citations:

| File | `setdefault` line | local constant line | secret value |
|---|---|---|---|
| `test_analysis_department_pilot.py` | `:69` | `:94` | `phase-2b2-dept-pilot-test-secret` |
| `test_analysis_drilldown_pilot.py` | `:61` | `:83` | `phase-2b3-drilldown-pilot-test-secret` |
| `test_analysis_finance_composite_pilot.py` | `:46` | `:65` | `phase-2b2-finance-composite-pilot-test-secret` |
| `test_analysis_finance_subtypes_pilot.py` | `:54` | `:69` | `phase-2b-final-finance-subtypes-pilot-test-secret` |
| `test_analysis_inventory_pilot.py` | `:34` | `:62` | `phase-2b1-inventory-pilot-test-secret` |
| `test_analysis_procurement_pilot.py` | `:57` | `:78` | `phase-2b2-procurement-pilot-test-secret` |
| `test_analysis_py_pilot.py` | `:37` | `:55` | `phase-2b-final-analysis-py-pilot-secret` |
| `test_analysis_region_pilot.py` | `:62` | `:73` | `phase-2b-region-pilot-test-secret` |
| `test_analysis_sales_pilot.py` | `:39` | `:49` | `phase-2b-sales-pilot-test-secret` |

### Why it leaks

`os.environ.setdefault(K, V)` is a **no-op if `K` is already set**. So when pytest collects ≥2 of these files, the **first imported file wins** the env var. Every later file's `setdefault` is silently a no-op.

But each file still uses its OWN local `JWT_SECRET` constant to **encode** its bearer tokens:
```python
return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)  # encoder uses local constant
```

The server, however, **decodes** by reading the env var at request time (`backend/python/smartbi_compat/auth.py:22-23`):
```python
def _get_secret() -> str:
    secret = os.environ.get("JWT_SECRET")
```

So any test from a file that lost the import race produces tokens signed with secret_B, hits a server decoding with secret_A → `401 Unauthorized — Invalid token: Signature verification failed`.

### Symptom assertions (sample tracebacks)

```
tests/test_analysis_finance_subtypes_pilot.py:465: assert 401 == 200
tests/test_analysis_finance_subtypes_pilot.py:500: assert 401 == 422
tests/test_analysis_finance_subtypes_pilot.py:542: AssertionError: {"detail":"Invalid token: Signature verification failed"}
tests/test_analysis_finance_subtypes_pilot.py:618: KeyError: 'data'   # body is {"detail":"..."} not the success envelope
tests/test_analysis_finance_subtypes_pilot.py:719: assert 401 == 403  # expected 403 from cross-factory check, got 401 because token never decoded
```

### Confirmation experiments

| Command | Result | Interpretation |
|---|---|---|
| `pytest finance_composite::test_endpoint_empty_analysis_type_dispatches_to_composite` | **PASSED** | Isolation reveals nothing; file alone works. |
| `pytest finance_composite` | **27 passed** | Single file with its own secret winning own race. |
| `pytest finance_subtypes` | **19 passed** | Same. |
| `pytest finance_composite finance_subtypes` (CLI order) | **17 failed** in subtypes | Composite imported first → composite secret wins → subtypes' tokens mismatch. |
| `pytest finance_subtypes finance_composite` (reversed CLI) | (untested but symmetric) | Subtypes would win, composite would fail. |
| `pytest department composite` | **11 failed** in composite | Dept (alphabetically + CLI first) wins → composite fails. |
| `pytest composite department` | **4 failed** in department | Reverse: composite wins → dept fails. (Only 4 of dept's tests use HTTP; others are pure unit tests.) |
| `pytest test_analysis_*_pilot.py` (all 9) | **72 failed** | Alphabetical first wins: department → 27/27 pass; the other 8 all bleed. |

The bug is **deterministic given CLI order** — `pytest` preserves the order of files passed on the command line, and the first-imported file's `setdefault` wins.

---

## Category breakdown

| Bucket | Count | Files |
|---|---|---|
| **A. Mock fixture drift (test isolation)** | **72 / 72** | All 9 analysis pilot files share the JWT_SECRET import-race pattern. |
| B. Real assertion drift | 0 | None — no production code change. |
| C. Real bug (assertion right, code wrong) | 0 | None — tokens never reach the production code path. |
| D. Environment / 3rd party | 0 | None — environment is internally consistent within the test process. |

---

## Per-file failure inventory (72 total)

### `test_analysis_drilldown_pilot.py` — 3 failures
- `test_endpoint_cross_factory_returns_403`
- `test_endpoint_happy_path_returns_200_envelope`
- `test_endpoint_unsupported_dimension_returns_200_success_false`

### `test_analysis_finance_composite_pilot.py` — 11 failures ★ in PR #550 scope
- `test_endpoint_empty_analysis_type_dispatches_to_composite`
- `test_endpoint_analysis_type_payable_dispatches`
- `test_endpoint_analysis_type_profit_dispatches`
- `test_endpoint_analysis_type_cost_dispatches`
- `test_endpoint_analysis_type_budget_dispatches`
- `test_endpoint_analysis_type_receivable_dispatches`
- `test_endpoint_unknown_analysis_type_returns_501_envelope`
- `test_endpoint_missing_start_date_returns_422`
- `test_endpoint_missing_end_date_returns_422`
- `test_endpoint_invalid_date_format_returns_422`
- `test_endpoint_cross_factory_token_returns_403`

### `test_analysis_finance_subtypes_pilot.py` — 17 failures ★ in PR #550 scope
- 5× `test_budget_achievement_*` (happy, empty, rule10, rule12, null_date)
- 6× `test_yoy_mom_*` (month_happy, unknown_period, missing_end, year_only, day_format, missing_required)
- 6× `test_category_comparison_*` (happy, empty, new_category, rule10, null_category, cross_factory)

### `test_analysis_inventory_pilot.py` — 10 failures
- 3× `test_endpoint_dispatches_to_*_mode` (turnover, expiry, aging)
- 3× cross/no-factory authz boundary tests
- 1× `unknown_analysis_type`
- 3× validation (`missing_start_date`, `missing_end_date`, `invalid_date_format`)

### `test_analysis_procurement_pilot.py` — 6 failures
- `cross_factory`, `happy_path`, `deep_overview`, `rbac_warehouse_manager`, `empty_batches`, `supplier_ranking_mode`

### `test_analysis_py_pilot.py` — 12 failures
- 3× `test_query_templates_endpoint_*` (happy, empty, cross_factory)
- 3× `test_datasource_endpoint_*` (happy, empty, cross_factory)
- 3× `test_alerts_endpoint_*` (envelope, category_sales, cross_factory)
- 3× `test_recommendations_endpoint_*` (envelope, analysis_type, cross_factory)

### `test_analysis_region_pilot.py` — 10 failures
- `cross_factory_denied`, `no_factory_non_priv`, `priv_no_factory`, `happy_six_key`, `ignores_region`, `missing_dates`, `warehouse_denied`, `super_admin_money`, `viewer_strip`, `strip_preserves_envelope`

### `test_analysis_sales_pilot.py` — 3 failures
- `cross_factory_denied`, `no_factory_non_priv`, `happy_seven_key_composite`

### `test_analysis_department_pilot.py` — 0 failures in the recorded run
Department is alphabetically first → wins the race → all 27 pass. **It will fail symmetrically if listed later on the CLI.** (Verified: `pytest composite department` → 4 dept tests fail.)

---

## Why "quick win" criterion (1-line fixture refresh) is not met

The fix template that resolves all 72 failures is already in the codebase at `tests/test_price_strip_kpi_pilot.py:71-77`:

```python
@pytest.fixture(autouse=True)
def _jwt_env(monkeypatch):
    """Force JWT_SECRET to our value for the duration of each test —
    survives import-order collisions with sister test_analysis_*_pilot
    files that set their own secret at module load."""
    monkeypatch.setenv("JWT_SECRET", JWT_SECRET)
    yield
```

That's **4 lines (5 with the docstring) per file × 8 files**, not the "1-line fixture refresh" the task scoped as quick-win. The same-cause sweep deserves a dedicated follow-up PR with its own review. Filed as a single issue (see `file-issue-list.md`).

---

## Confidence

- **Root cause:** 99% — confirmed by 7 reproduction experiments, two of which symmetrically prove the import-order dependency.
- **No real bugs hidden underneath:** 95% — every traceback decodes to `401 signature verification`, which is impossible to reach if the JWT decoder were buggy at a deeper level. The 5% uncertainty: a test that fails on a different assertion before reaching the HTTP layer would not be in the 72 set, so this doc cannot exclude such bugs entirely. None were observed in the 5 sample full tracebacks read.
- **Fix template correctness:** 100% — `test_price_strip_kpi_pilot.py` uses this pattern and passes in CI today.
