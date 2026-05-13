# Follow-up issue to file

## Issue 1 — Test isolation: `os.environ.setdefault("JWT_SECRET", …)` import-race causes 72 order-dependent failures across 8 analysis pilot files

**Type:** test infrastructure / flakiness
**Priority:** P2 (pre-existing, not blocking deploys; but masks coverage signal)
**Scope:** 8 of 9 `test_analysis_*_pilot.py` files (and a broader sweep target of 14 `test_*_pilot.py` files if scope is widened)
**Root cause analysis:** `tests/qa-py-test-baseline/categorization.md`

### Summary

When `pytest` collects ≥2 of the `test_analysis_*_pilot.py` files in one run, every file except the alphabetically-first one (`test_analysis_department_pilot.py`) produces test failures with traceback `401 — Invalid token: Signature verification failed`. The failures are deterministic given CLI/collection order, not flaky in the usual sense — they reproduce every run.

`pytest tests/test_analysis_*_pilot.py` on `origin/main` (SHA `727d9298b`): **72 failed, 314 passed.** No production code is at fault — all 72 are token-encoding-vs-decoding-secret mismatches caused by `os.environ.setdefault` being a no-op for every file after the first to import.

### Reproduction

```bash
cd backend/python
python -m pytest tests/test_analysis_*_pilot.py --tb=no -q
# 72 failed, 314 passed
```

Single-file isolation: every failing test PASSES.

### Root cause (one-paragraph)

Each pilot file sets `os.environ.setdefault("JWT_SECRET", "<file-unique>")` at module-import time and stores the same value in a module-local `JWT_SECRET` constant used to encode bearer tokens via `jwt.encode(payload, JWT_SECRET, …)`. `setdefault` is a no-op after the first file sets the env var, so the env var locks to the first-imported file's value. Other files keep using their own local constant for encoding, but the server reads `os.environ.get("JWT_SECRET")` at request time (`smartbi_compat/auth.py:22-23`) — so any token encoded by a "lost the race" file fails signature verification.

### Fix (paste-ready)

Add this autouse fixture to each of the 8 target files (template lifted verbatim from the in-repo working pattern at `backend/python/tests/test_price_strip_kpi_pilot.py:71-77`):

```python
@pytest.fixture(autouse=True)
def _jwt_env(monkeypatch):
    """Force JWT_SECRET to our value for the duration of each test —
    survives import-order collisions with sister test_analysis_*_pilot
    files that set their own secret at module load."""
    monkeypatch.setenv("JWT_SECRET", JWT_SECRET)
    yield
```

Place it immediately after the existing module-level `JWT_SECRET = "<file-unique-string>"` constant. No other changes required.

**Optional belt-and-suspenders (matches price_strip_kpi pattern):**

```python
def _active_secret() -> str:
    """Read JWT_SECRET from env at call time — matches whichever value
    won the import race (the autouse fixture above pins it to ours per test)."""
    return os.environ.get("JWT_SECRET", JWT_SECRET)
```

…and change `jwt.encode(payload, JWT_SECRET, …)` → `jwt.encode(payload, _active_secret(), …)`. Only useful for tests that run helpers before the autouse fixture takes effect. Skip unless you hit such a case.

### Target files (8) — analysis pilot scope (matches user task command)

| File | Failing tests | `JWT_SECRET =` line | Add fixture after line |
|---|---|---|---|
| `tests/test_analysis_drilldown_pilot.py` | 3 | `:83` | `:83` |
| `tests/test_analysis_finance_composite_pilot.py` | 11 ★ | `:65` | `:65` |
| `tests/test_analysis_finance_subtypes_pilot.py` | 17 ★ | `:69` | `:69` |
| `tests/test_analysis_inventory_pilot.py` | 10 | `:62` | `:62` |
| `tests/test_analysis_procurement_pilot.py` | 6 | `:78` | `:78` |
| `tests/test_analysis_py_pilot.py` | 12 | `:55` | `:55` |
| `tests/test_analysis_region_pilot.py` | 10 | `:73` | `:73` |
| `tests/test_analysis_sales_pilot.py` | 3 | `:49` | `:49` |
| (`tests/test_analysis_department_pilot.py` — 0 today, but should also get the fixture for defensive isolation; otherwise it fails when not listed first) | 0 (or 4) | `:94` | `:94` |

★ in PR #550 scope.

### Broader optional scope (6 more files — `test_*_pilot.py` whole-suite)

Whole-pilot-suite run (`pytest tests/test_*_pilot.py`): **152 failed, 461 passed.** The remaining 80 failures (152 − 72) are in 6 more files that follow the same `setdefault + module-local constant` pattern. If the fix is extended to these as well, the whole pilot suite should go green:

- `tests/test_config_thresholds_pilot.py` (`:60`)
- `tests/test_dashboard_composite_pilot.py` (`:682`, note `_os` import alias)
- `tests/test_dashboard_data_date_range_pilot.py` (this file uses the same secret string as `dashboard_composite`; verify before fixing)
- `tests/test_datasource_pilot.py` (`:71`)
- `tests/test_incentive_plan_pilot.py` (`:99`)
- `tests/test_query_templates_write_pilot.py` (`:61`)

Plus 3 non-pilot files that already have the fix and are unaffected (no action needed): `test_price_strip_kpi_pilot.py`, `test_r6_rbac_strip_sister_sweep.py`, `test_analysis_production_skeleton.py`.

### Verification plan

```bash
# Before
cd backend/python && python -m pytest tests/test_analysis_*_pilot.py --tb=no -q
# expect: 72 failed, 314 passed

# After applying fixture to all 9 analysis files
python -m pytest tests/test_analysis_*_pilot.py --tb=no -q
# expect: 0 failed, 386 passed

# Whole pilot suite (broader scope)
python -m pytest tests/test_*_pilot.py --tb=no -q
# expect: <8 failed (only the 6 non-analysis files would still fail until they get the fix too)
```

### Risk

- **Production code:** none (test-only change).
- **Test-only change blast radius:** each fixture is autouse + per-test scope + uses `monkeypatch` (auto-revert). Cannot leak.
- **Behavioural difference:** tests now use each file's own JWT_SECRET deterministically instead of accidentally inheriting the first-imported file's secret. Either way the encoded-token-decoded-token match is what's being verified — production code path is identical.

### Why this wasn't filed as separate issues per file

Same root cause, same fix template, same review burden. One issue → one PR → one CI run is cheaper than 8. Title the PR `test(isolation): fix JWT_SECRET import-race in 8 analysis pilot files`.

### Suggested issue title

> test isolation: `os.environ.setdefault("JWT_SECRET")` import-race causes 72+ order-dependent failures across analysis pilot files

### Labels

`area:tests`, `kind:flakiness`, `priority:P2`, `phase-2b-debt`
