# Python SmartBI Migration — Unit Test Coverage Audit

**Date**: 2026-05-12
**Author**: chat4 (audit dispatch via Subagent A)
**Base SHA**: `070bd6c72c` (origin/main at audit time)
**Scope**: `backend/python/smartbi_compat/api/*.py` endpoints + helpers + their tests in `backend/python/tests/`
**Status**: 🔴 RED — **73% of migrated endpoints have zero direct unit tests**; backfill split into per-domain follow-up PRs.

---

## 0. TL;DR

Of **34 public HTTP endpoints** + ~349 internal service-layer helpers across 16 modules under `backend/python/smartbi_compat/api/`:

| Rating | Count | % | Notes |
|---|---|---|---|
| ✅ **Full** (happy + boundary + error) | 7 endpoints | 21% | Concentrated in `config_thresholds.py` (5) + helpers in `dashboard_composite.py` (1) + `analysis.py:_infer_granularity` (1 transitive) |
| ⚠️ **Partial** (transitive coverage only, no direct endpoint test) | 2 endpoints | 6% | `analysis_production` + `analysis_quality` — covered via restaurant-data integration tests, no API-contract tests |
| ❌ **None** (zero direct tests) | 25 endpoints | 73% | Including Tier 1 critical: `analysis_inventory`, `analysis_sales`, all of `analysis_finance` (foundation layer), procurement, region, department, drilldown |

**Of 119 test files in `backend/python/tests/`**, only **7 import from `smartbi_compat.api`** — the migrated SmartBI compat layer is the least-tested area of the Python codebase despite being customer-facing.

This doc is the **Phase 2B test-backfill marching order**. §3 has the prioritized backfill list; §8 has the per-domain dispatch plan.

⛔ **No CI coverage gate exists** (`pytest.ini` has no `--cov-fail-under`; CI workflow runs `pytest tests/ -v --timeout=30 -k "not e2e and not integration"` with no coverage threshold). §6 recommends adding endpoint-coverage gate.

---

## 1. Module summary

| Module | Endpoints | Helpers | ✅ | ⚠️ | ❌ | Test file(s) | Tier |
|---|---|---|---|---|---|---|---|
| `analysis.py` | 4 | 22 | 1 | 0 | 3 | `test_smartbi_api.py` (0 tests — empty smoke shell) | Mixed |
| `analysis_finance.py` | 4 | 79 | 0 | 0 | 4 | (none) | **Tier 2** |
| `analysis_inventory.py` | 1 | 39 | 0 | 0 | 1 | (none) | **Tier 1 critical** |
| `analysis_sales.py` | 1 | 55 | 0 | 0 | 1 | (none) | **Tier 1 critical** |
| `analysis_procurement.py` | 1 | 35 | 0 | 0 | 1 | (none) | **Tier 2** |
| `analysis_production.py` | 1 | 8 | 0 | 0 | 1 | `test_analysis_production_*.py` (37 tests, transitive) | Tier 1 |
| `analysis_quality.py` | 1 | 17 | 0 | 0 | 1 | `test_analysis_quality_*.py` (65 tests, transitive) | Tier 1 |
| `analysis_region.py` | 1 | 22 | 0 | 0 | 1 | (none) | **Tier 2** |
| `analysis_department.py` | 1 | 13 | 0 | 0 | 1 | (none) | **Tier 2** |
| `analysis_drilldown.py` | 1 | 21 | 0 | 0 | 1 | (none) | **Tier 2** |
| `config_thresholds.py` | 5 | 5 | 5 | 0 | 0 | `test_config_thresholds_pilot.py` (41 tests) | **Tier 3 — gold standard** ✅ |
| `dashboard.py` | 1 | 2 | 0 | 0 | 1 | (none) | Tier 3 |
| `dashboard_composite.py` | 3 | 11 | 1 | 0 | 2 | `test_dashboard_composite_pilot.py` (42 tests) | Tier 3 |
| `datasource.py` | 5 | 10 | 0 | 0 | 5 | (none) | **Tier 3 — write ops** |
| `incentive_plan.py` | 1 | 15 | 0 | 0 | 1 | (none) | Tier 3 |
| `query_templates_write.py` | 3 | 6 | 0 | 0 | 3 | (none) | **Tier 3 — write ops** |
| **TOTALS** | **34** | **349** | **7** | **0** | **25** | 7 of 119 test files | — |

Coverage cliff: **73% of endpoints ❌** + **transitive coverage on production/quality** treated as ❌ for API-contract purposes (data-layer tests don't validate envelope shape, auth boundaries, or error responses).

---

## 2. Per-endpoint detail (sorted by tier + risk)

### 2.1 Tier 1 critical — customer-facing KPI (❌, 0/4 covered)

| Module:line | Function | LOC | Rating | Gap |
|---|---|---|---|---|
| `analysis_inventory.py:1889` | `GET /analysis/inventory` endpoint | ~200 | ❌ | Tier 1 KPI dashboard; calls 5 real sub-services (turnover/expiry-risk/aging/health/mode). Customer-facing for food safety + financial impact. |
| `analysis_inventory.py:763` | `_get_expiry_risk_analysis` | 100 | ❌ | **Food safety critical** — batch expiry logic; zero test. |
| `analysis_inventory.py:559` | `_get_turnover_analysis` | 80 | ❌ | Inventory KPI denominator; zero test. |
| `analysis_inventory.py:1029` | `_get_aging_metrics` | 75 | ❌ | Inventory aging; Rule 1 risk on `Decimal("0")` falsy guard. |
| `analysis_inventory.py:448` | `_determine_turnover_alert_level` | 10 | ❌ | Alert thresholds 3.0/1.5 — Rule 7 risk if thresholds become float (banker's rounding boundary). |
| `analysis_sales.py:1724` | `GET /analysis/sales` endpoint | ~180 | ❌ | Tier 1 sales KPI dashboard; 5 sub-services (summary/trend/ranking/category/growth). |
| `analysis_sales.py:743` | `_build_kpi_cards_from_aggregates` | 80 | ❌ | Real KPI aggregation; zero test. |
| `analysis_sales.py:255` | `_query_sales_aggregates` | 30 | ❌ | Rule 6 risk — None-check on date params. |
| `analysis_sales.py:727` | `_determine_growth_alert_level` | 9 | ❌ | Alert thresholds -5/5/10; Rule 12 risk in display formatting. |

### 2.2 Tier 1 critical — already transitively covered, needs direct API tests (⚠️ → ✅ upgrade)

| Module | Status | Transitive coverage | Needed |
|---|---|---|---|
| `analysis_production.py` | ⚠️ | 37 tests in `test_analysis_production_{skeleton,restaurant}.py` exercise the data layer via factory fixtures | 2-3 direct HTTP endpoint tests: (a) GET with valid factory → 200 + envelope shape (b) GET without JWT → 401 (c) GET with mismatched factory_id → 403 |
| `analysis_quality.py` | ⚠️ | 65 tests in `test_analysis_quality_{skeleton,restaurant}.py` | Same 3-test pattern |

Effort to graduate to ✅: **~30 min per module** (mirror existing 401/403 tests from `test_config_thresholds_pilot.py`).

### 2.3 Tier 2 — domain critical (❌, 0/8 covered)

| Module:line | Function | LOC | Rating | Gap |
|---|---|---|---|---|
| `analysis_finance.py:3282` | `GET /analysis/finance` endpoint | ~250 | ❌ | Foundation layer; composite map + 4 sub-type paths (profit/cost/receivable/payable currently stubs). |
| `analysis_finance.py:559` | `_safe_growth_rate` | 29 | ❌ | **Rule 10 risk** — divide precision (Java `divide(divisor, 4, HALF_UP).multiply(100)` vs Python). Division-by-zero guard untested. |
| `analysis_finance.py:721` | `_calculate_month_yoy_mom` | 32 | ❌ | YoY/MoM growth calc; Rule 2 (calendar year vs ISO week) + Rule 10 risks. |
| `analysis_procurement.py:1205` | `GET /analysis/procurement` endpoint | ~150 | ❌ | Supplier/forecast KPI; zero test. |
| `analysis_procurement.py:156` | `_query_supplier_concentration` | 30 | ❌ | **Known Rule 12 bug fixed in PR-N-1 (46.55 → "46.5" banker's vs Java "46.6" HALF_UP)** — no regression test. |
| `analysis_region.py:770` | `GET /analysis/region` endpoint | ~150 | ❌ | Region sales/profit analysis. |
| `analysis_department.py:674` | `GET /analysis/department` endpoint | ~150 | ❌ | Department KPI analysis. |
| `analysis_drilldown.py:722` | `POST /drill-down` endpoint | ~100 | ❌ | Interactive drill-down; complex request/response. **Rule 12 HALF_UP fix in commit `69b46f4d5` 2026-05-07 — unverified by test.** |

### 2.4 Tier 3 — config / data ops (❌ 10, ✅ 6)

| Module:line | Function | Rating | Gap |
|---|---|---|---|
| `config_thresholds.py:247-413` | 5 endpoints (GET/POST/PUT/DELETE/reload) | ✅✅✅✅✅ | **Gold standard** — 41 tests in `test_config_thresholds_pilot.py` cover CRUD + auth + boundary + role + 404. |
| `dashboard_composite.py:155-245` | `_resolve_period_*` helpers (5 period types) | ✅ | 42 tests cover today/week/month/quarter/year + leap year + DST. |
| `dashboard_composite.py:445-505` | 3 endpoints (`/executive`, `/executive/custom`, `/dashboard`) | ❌❌❌ | Helpers tested, endpoints untested. Auth boundary, empty factory, composite shape unverified. |
| `dashboard.py:84` | `GET /data-date-range` | ❌ | Zero test. |
| `datasource.py:272-602` | 5 endpoints incl. POST upload (70 LOC, file I/O) | ❌×5 | **Upload endpoint** has high blast radius; zero test for 100MB / invalid sheet / parser errors. |
| `query_templates_write.py:223-250` | POST/PUT/DELETE (3 endpoints) | ❌×3 | Write ops untested for 404 / validation / cascade. |
| `incentive_plan.py:523` | `GET /incentive-plan/{type}/{id}` | ❌ | Path-param boundary untested. |

### 2.5 `analysis.py` mixed (1 ✅ helper, 3 ❌ endpoints)

| Function | Rating | Notes |
|---|---|---|
| `_infer_granularity` (line 82, 28 LOC) | ✅ | Transitively tested by `test_dashboard_composite_pilot.py` period suite. |
| `GET /query-templates` (line 127, 50 LOC) | ❌ | List endpoint; zero direct test. |
| `GET /datasource/list` (line 931) | ❌ | List endpoint; zero test. |
| `GET /alerts` (line 946) | ❌ | Alert query; zero test. |
| `GET /recommendations` (line 972) | ❌ | Zero test. |

---

## 3. Top-20 backfill priorities (sorted by tier + LOC × blast radius)

| # | Endpoint | Module | LOC | Tier | Recommended phase |
|---|---|---|---|---|---|
| 1 | `_get_expiry_risk_analysis` | inventory | 100 | Tier 1 (food safety) | Phase 2B-1 inventory |
| 2 | `_get_turnover_analysis` | inventory | 80 | Tier 1 | Phase 2B-1 inventory |
| 3 | `GET /analysis/inventory` endpoint | inventory | 200 | Tier 1 | Phase 2B-1 inventory |
| 4 | `_build_kpi_cards_from_aggregates` | sales | 80 | Tier 1 | Phase 2B-1 sales |
| 5 | `GET /analysis/sales` endpoint | sales | 180 | Tier 1 | Phase 2B-1 sales |
| 6 | `_safe_growth_rate` | finance | 29 | Tier 2 (Rule 10 risk) | Phase 2B-2 finance |
| 7 | `_calculate_month_yoy_mom` | finance | 32 | Tier 2 (Rule 2/10 risk) | Phase 2B-2 finance |
| 8 | `GET /analysis/finance` endpoint | finance | 250 | Tier 2 | Phase 2B-2 finance |
| 9 | `_query_supplier_concentration` | procurement | 30 | Tier 2 (Rule 12 regression) | Phase 2B-2 procurement |
| 10 | `GET /analysis/procurement` endpoint | procurement | 150 | Tier 2 | Phase 2B-2 procurement |
| 11 | `POST /datasource/upload` | datasource | 70 | Tier 3 (file I/O) | Phase 2B-3 datasource |
| 12 | `POST /datasource/apply` | datasource | 50 | Tier 3 | Phase 2B-3 datasource |
| 13 | `query_templates_write.py` (POST+PUT+DELETE × 3 endpoints) | query | 38 | Tier 3 | Phase 2B-3 datasource |
| 14 | `analysis_quality.py` upgrade ⚠️ → ✅ | quality | — | Tier 1 | Phase 2B-1 quality direct-endpoint |
| 15 | `analysis_production.py` upgrade ⚠️ → ✅ | production | — | Tier 1 | Phase 2B-1 production direct-endpoint |
| 16 | `GET /analysis/region` | region | 150 | Tier 2 | Phase 2B-2 region |
| 17 | `GET /analysis/department` | department | 150 | Tier 2 | Phase 2B-2 department |
| 18 | 3 endpoints in `dashboard_composite.py` | dashboard | 250 | Tier 3 | Phase 2B-3 dashboard endpoints |
| 19 | `POST /drill-down` | drilldown | 100 | Tier 2 (Rule 12 regression) | Phase 2C drilldown |
| 20 | `GET /incentive-plan/{type}/{id}` | incentive | 80 | Tier 3 | Phase 2C incentive |

---

## 4. ⚠️ Partial → ✅ upgrade plan

Two modules already have transitive coverage but no direct API-contract tests:

### 4.1 `analysis_production.py` (currently 37 transitive tests)

Add to `test_analysis_production_skeleton.py` OR new `test_analysis_production_endpoint.py`:

```python
# 1. Happy path — full envelope shape
@pytest.mark.asyncio
async def test_production_endpoint_returns_full_envelope(client):
    headers = {"Authorization": f"Bearer {valid_factory_jwt('F001')}"}
    resp = await client.get("/api/mobile/F001/smart-bi/analysis/production", headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert "success" in data and data["success"] is True
    assert "data" in data
    # 21-key envelope (per chat3 Subagent A research)
    assert set(data["data"].keys()) >= {"period", "startDate", "endDate", "kpiCards", ...}

# 2. Auth boundary
async def test_production_endpoint_requires_jwt(client):
    resp = await client.get("/api/mobile/F001/smart-bi/analysis/production")
    assert resp.status_code == 401

# 3. Cross-factory denial
async def test_production_endpoint_cross_factory_denied(client):
    headers = {"Authorization": f"Bearer {valid_factory_jwt('F001')}"}
    resp = await client.get("/api/mobile/F002/smart-bi/analysis/production", headers=headers)
    assert resp.status_code == 403
```

### 4.2 `analysis_quality.py` (currently 65 transitive tests)

Same 3-test pattern. **Estimated effort: 30 min per module.**

---

## 5. Backfill template (mirror `config_thresholds.py` ✅ pattern)

For each ❌ endpoint, write **at least 3 tests** following Phase 2A patterns:

```python
# tests/test_<module>_pilot.py
import pytest
from datetime import date
from unittest.mock import AsyncMock

from smartbi_compat.api import <module> as mod


# (1) Happy path — monkeypatch DB layer, verify response shape + values
@pytest.mark.asyncio
async def test_<endpoint>_happy_path(monkeypatch):
    async def fake_query(*args, **kwargs):
        return [{"factory_id": "F001", "value": "100"}]
    monkeypatch.setattr(mod, "_query_<helper>", fake_query)

    result = await mod._get_<endpoint>("F001", date(2026, 5, 1), date(2026, 5, 31))
    assert result["kpiCards"][0]["value"] == 100  # Rule 4 dict-eq: int vs Decimal


# (2) Boundary — empty rows / zero values / Rule 1 falsy Decimal
@pytest.mark.asyncio
async def test_<endpoint>_empty_data(monkeypatch):
    async def fake_query(*args, **kwargs):
        return []
    monkeypatch.setattr(mod, "_query_<helper>", fake_query)

    result = await mod._get_<endpoint>("F001", date(2026, 5, 1), date(2026, 5, 31))
    assert result == _empty_dashboard_response_or_equiv


# (3) Error — Rule 6 None-check / DB unavailable / NotImplementedError
@pytest.mark.asyncio
async def test_<endpoint>_rejects_none_date(monkeypatch):
    with pytest.raises(ValueError, match="start_date/end_date required"):
        await mod._query_<helper>("F001", None, date(2026, 5, 31), AsyncMock())
```

**Rule-compliance checklist** for each test (per `.claude/rules/python-java-port.md`):

- [ ] **Rule 1**: assert `is not None` semantics — `Decimal("0")` should NOT be treated as falsy
- [ ] **Rule 4**: assert `_decimal_to_number` output — `int 0` vs `float 3.45` vs `str "3.45"` byte parity
- [ ] **Rule 6**: assert `ValueError` raised on `None` date params (not silent `BETWEEN NULL AND NULL`)
- [ ] **Rule 10**: assert intermediate-quantize parity for `divide(scale, HALF_UP).multiply(K)` chains — write at least one test with denominator that triggers 4-digit rounding (e.g., 1/3, 46.55%)
- [ ] **Rule 12**: assert `Decimal.quantize(ROUND_HALF_UP)` not banker's — test boundary like `0.55 → 0.6` (HALF_UP) vs `0.5` (banker's)

---

## 6. CI gate recommendation

### Current state

`backend/python/pytest.ini`:
```ini
[pytest]
asyncio_mode = auto
timeout = 60
# No --cov-fail-under
# No coverage report
```

`.github/workflows/ci.yml`:
```yaml
run: pytest tests/ -v --timeout=30 -k "not e2e and not integration"
# Frontend (RN) DOES use --coverage; backend Python does NOT.
```

### Recommendation: endpoint-coverage gate (not line-coverage, less fragile)

**Phase 2B exit target**: 30/34 endpoints (88%) ✅ — backfill chats add tests, this gate enforces.

Two implementation options:

**Option A — pytest-cov line gate (simple but fragile)**:
```ini
[pytest]
addopts = --cov=smartbi_compat.api --cov-fail-under=60 --cov-report=term-missing
```
Phase 2B target: 60% line coverage. Fragile because branch coverage isn't enforced and helpers without tests can drag baseline.

**Option B — pytest marker gate (semantic)**:
```python
# conftest.py
def pytest_collection_modifyitems(config, items):
    endpoints_covered = collections.Counter()
    for item in items:
        for marker in item.iter_markers(name="api_endpoint"):
            endpoints_covered[marker.args[0]] += 1
    # Enforce: every endpoint marker has ≥ 3 tests (happy + boundary + error)
    KNOWN_ENDPOINTS = {"analysis_finance", "analysis_inventory", ...}  # 34 names
    missing = [e for e in KNOWN_ENDPOINTS if endpoints_covered.get(e, 0) < 3]
    if missing:
        pytest.exit(f"Coverage gate: {len(missing)} endpoints have <3 tests: {missing}")
```

Test files mark their endpoint:
```python
@pytest.mark.api_endpoint("analysis_finance")
async def test_finance_happy_path(client):
    ...
```

**Recommendation**: **Option B** — semantic, encourages happy+boundary+error pattern, less fragile to refactors. **Defer activation to Phase 2B-end** so backfill chats can land before the gate flips green.

---

## 7. Stats summary

- **Total endpoints**: 34
- **Total internal helpers**: ~349
- **Coverage by endpoint**: ✅ 7 (21%) / ⚠️ 2 (6%) / ❌ 25 (73%)
- **Coverage by helper**: ✅ ~10 (3%) / ❌ ~339 (97%)
- **Total test files in `tests/`**: 119
- **Test files importing `smartbi_compat.api`**: 7 (5.9%)
- **Total tests covering `smartbi_compat.api`**: ~175 (config_thresholds 41 + dashboard_composite 42 + production_{skel/rest} 37 + quality_{skel/rest} 65 — but mostly data-layer transitive)

---

## 8. Phase 2B execution plan (per-domain dispatch)

Backfill is too large for a single PR. Splitting into 3 sub-phases of parallel-dispatchable per-domain chats:

### Phase 2B-1 — Tier 1 critical (target: 8 endpoints to ✅)

| Chat | Scope | Effort | Output |
|---|---|---|---|
| chat-2B-inv | `analysis_inventory` endpoint + 5 helpers (turnover/expiry/aging/health/mode) | ~6h, ~25 tests | `test_analysis_inventory_pilot.py` |
| chat-2B-sales | `analysis_sales` endpoint + 5 helpers (summary/trend/ranking/category/growth) | ~6h, ~25 tests | `test_analysis_sales_pilot.py` |
| chat-2B-prod-upgrade | `analysis_production` endpoint direct-test (⚠️→✅) | ~30 min, 3 tests | append to `test_analysis_production_skeleton.py` |
| chat-2B-qual-upgrade | `analysis_quality` endpoint direct-test (⚠️→✅) | ~30 min, 3 tests | append to `test_analysis_quality_skeleton.py` |

### Phase 2B-2 — Tier 2 domain critical (target: 6 endpoints to ✅)

| Chat | Scope | Effort | Output |
|---|---|---|---|
| chat-2B-finance | `analysis_finance` composite endpoint + `_safe_growth_rate` + `_calculate_month_yoy_mom` | ~5h, ~20 tests (focus Rule 10) | `test_analysis_finance_composite_pilot.py` |
| chat-2B-procurement | `analysis_procurement` endpoint + `_query_supplier_concentration` (Rule 12 regression) | ~4h, ~15 tests | `test_analysis_procurement_pilot.py` |
| chat-2B-region | `analysis_region` endpoint + helpers | ~4h, ~15 tests | `test_analysis_region_pilot.py` |
| chat-2B-dept | `analysis_department` endpoint + helpers | ~4h, ~15 tests | `test_analysis_department_pilot.py` |

### Phase 2B-3 — Tier 3 + Tier 2 drilldown (target: 11 endpoints to ✅)

| Chat | Scope | Effort | Output |
|---|---|---|---|
| chat-2B-datasource | 5 datasource endpoints (incl. POST upload) | ~5h, ~20 tests | `test_datasource_pilot.py` |
| chat-2B-write-ops | 3 query_templates_write endpoints | ~2h, ~10 tests | `test_query_templates_write_pilot.py` |
| chat-2B-dashboard | 3 dashboard_composite endpoints + 1 dashboard | ~3h, ~12 tests | extend `test_dashboard_composite_pilot.py` |
| chat-2B-drilldown | drill-down POST + Rule 12 regression for `_build_kpi_card` | ~3h, ~10 tests | `test_analysis_drilldown_pilot.py` |
| chat-2B-incentive | incentive_plan endpoint + path-param boundary | ~2h, ~8 tests | `test_incentive_plan_pilot.py` |

### Final — Phase 2B exit gate

- chat-2B-gate: activate Option B CI marker gate per §6; update `conftest.py`; ship CI workflow PR

**Estimated total backfill effort**: ~50 hours across 13 chats. Parallelizable to ~10-15 wall-clock days with 3-4 chats in flight.

---

## 9. Cross-references

| Ref | Purpose |
|---|---|
| `.claude/rules/python-java-port.md` | Rules 1-12 for all backfill tests |
| `feedback_subagent_driven_audit_pattern.md` | 4-cycle audit pattern for PR-A architectural / 2-cycle for PR-B mechanical |
| [PR #385](https://github.com/j4xie/my-prototype-logistics/pull/385) | dashboard_composite_pilot — recent ✅ example with 42 tests + cycle 1/2 audit |
| `test_config_thresholds_pilot.py` (41 tests) | **Gold standard** ✅ to copy pattern from |
| `tests/fixtures/java-smartbi-golden/` | Java response goldens for dict-eq parity tests |
| `scripts/record-java-golden.sh` | CLI to record new goldens for backfill tests |

---

## 10. Caveats

- **Audit done by static grep** of test files importing/referencing `smartbi_compat.api`. Some tests may use string-based monkeypatch (`monkeypatch.setattr("smartbi_compat.api.foo._query_bar", ...)`) which grep-import-search misses. Manual spot-check confirmed 7/7 grepped files are the actual import sites; no false negatives observed.
- **Tier 1 / 2 / 3 classification** is opinionated based on (a) customer blast radius (Tier 1 = direct user-facing dashboards) and (b) financial / safety impact (food safety expiry / financial precision). Steve can re-tier per business priority before dispatch.
- **LOC counts approximate** — measured by grep + visual inspection of function start/end, not AST-precise.
- **Backfill effort estimates** assume Phase 2A test patterns are reused and goldens already exist. New endpoints without prior parity work (e.g., `datasource upload` file I/O) may take 2-3× longer.

---

*End of audit. Phase 2B chat dispatches reference §8 by name (chat-2B-inv / chat-2B-sales / chat-2B-finance / etc.). Each dispatch quotes its sub-section + §5 template + relevant §3 priority row.*
