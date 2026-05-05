# Phase 2A SmartBI Python — DB Pool Wiring Fix

> **Status**: Spec, gated on user review. Pre-T6 blocker fix.
> **Writing date**: 2026-05-05
> **Discovery context**: T6.0 nginx infra prep (PR `dc8bafa9d`) surfaced this when smoke-testing Python service against real prod-like data with real JWT auth.
> **Doc lineage**: companion to `2026-05-02-phase2a-t6-nginx-cutover-design.md` (T6 blocked until this fix ships) and `2026-05-03-phase2a-retrospective.md` (which claimed 28/29 endpoints "shipped + audited" but did not catch this).

---

## 1. Background

### 1.1 What broke

Phase 2A SmartBI Python ports (28 endpoints under `backend/python/smartbi_compat/api/`) "shipped" in main with byte-shape parity tests passing in CI. But on prod env (Python service port 8083), `/www/wwwroot/cretas/python-prod.log` shows `1100+ "UndefinedTableError: relation X does not exist"` errors over the soak window.

Root cause: Python's primary sync engine `smartbi.database.connection.engine` is bound to `POSTGRES_DB=smartbi_prod_db` via env var. Several Phase 2A endpoints execute SQL that references tables which only exist in `cretas_prod_db` (a separate database on the same Postgres instance). Test suites mock the engine and never hit real DB → bug latent.

### 1.2 Why CI didn't catch it

`feedback_subagent_driven_audit_pattern.md` 4-cycle audit operates on spec + code layers (intent, algorithm, cross-spec, impl review). None of those cycles execute SQL against a real DB. CI tests use `monkeypatch.setattr(...sync_engine, fake)` which returns synthesized rows from in-memory dicts.

The gap: **integration testing layer is missing**. We need a smoke gate that (a) starts a Python worker with real prod-like env vars, (b) hits each endpoint with real JWT, (c) verifies HTTP 200 + non-empty response data shape. This existed for Java (Maestro E2E) but was never added for Phase 2A Python ports.

### 1.3 Empirical canonical-DB mapping (verified 2026-05-05)

Row-count probe across all 4 dbs (cretas_db / cretas_prod_db / smartbi_db / smartbi_prod_db):

| Table | Canonical DB | Rows in canonical | Notes |
|---|---|---|---|
| `smart_bi_sales_data` | cretas_prod_db | 345 | Not in smartbi at all |
| `smart_bi_finance_data` | cretas_prod_db | 3817 | smartbi mirror exists but empty |
| `smart_bi_department_data` | cretas_prod_db | 6 | Not in smartbi |
| `smart_bi_datasource` | cretas_prod_db | 5 | Not in smartbi |
| `smart_bi_dynamic_data` | **smartbi_prod_db** | 5,577,137 | Excel ingest — opposite direction |
| `smart_bi_pg_excel_uploads` | **smartbi_prod_db** | 1633 | Excel ingest |
| `smart_bi_query_templates` | divergent | cretas:41, smartbi:12 | **Schema drift bug, separate fix** |
| `ai_intent_configs` | cretas_prod_db | 536 | Already fixed for AI matcher (commit `8cfc13fc2`) |
| `intent_match_records` | cretas_prod_db | 150 | AI side, blocked elsewhere |
| `ai_training_samples` | cretas_prod_db | 34431 | AI learning, separate scope |

**Canonical mapping rule**: most SmartBI _domain_ data is in `cretas_prod_db`. `smartbi_prod_db` is mostly the LLM-conversation + Excel-ingest staging area.

### 1.4 Affected endpoints (Phase 2A in-scope)

7 endpoints execute SQL against `cretas_prod_db` tables via `smartbi_prod_db` engine/pool:

| Endpoint | File | Helper(s) | Tables (all in cretas_prod_db) | Wiring problem |
|---|---|---|---|---|
| `GET /api/mobile/{fid}/smart-bi/analysis/sales` | `analysis_sales.py` | `_query_sales_aggregates` (line 238), `_query_top_salespersons_aggregate` (295), `_query_daily_sales_trend_aggregate` (338), `_get_product_ranking` (377), `_get_sales_trend_chart` | smart_bi_sales_data | `_get_sync_engine()` → smartbi.database.connection.engine |
| `GET /api/mobile/{fid}/smart-bi/analysis/region` | `analysis_region.py` | `_query_region_full` (166-167) | smart_bi_sales_data | `_get_sync_engine()` |
| `POST /api/mobile/{fid}/smart-bi/drill-down` | `analysis_drilldown.py` | 5 dispatch helpers (`_drilldown_get_province_ranking` 108, `_drilldown_get_city_ranking` 140, `_drilldown_product_ranking` 207, `_drilldown_salesperson_ranking` 326, `_drilldown_get_department_detail` 207) | smart_bi_sales_data, smart_bi_department_data | `_get_sync_engine()` (5 sites) |
| `GET /api/mobile/{fid}/smart-bi/data-date-range` | `dashboard.py` | line 73 | smart_bi_sales_data | `get_db_context()` |
| `GET /api/mobile/{fid}/smart-bi/analysis/{sales\|department}` (detail fallback) | `analysis.py` | line 301 (sales detail), 353 (dept detail) | smart_bi_sales_data, smart_bi_department_data | `get_db_context()` |
| `GET /api/mobile/{fid}/smart-bi/incentive-plan/{targetType}/{targetId}` | `incentive_plan.py` | `_fetch_sales_data` (309), `_fetch_department_data` (341) | smart_bi_sales_data, smart_bi_department_data | `get_pg_pool()` (smartbi pool, wrong) |

Production traffic impact (web-admin.log Dec 27 → May 6, 4 months):
- analysis/sales: **17,362 requests** (76% of T6 in-scope traffic) — would all 5xx after T6.4
- drill-down: 0 prod traffic (low value)
- region: 0 prod traffic
- data-date-range: 0 prod traffic
- incentive-plan: 0 prod traffic

**Effective T6 blocker = analysis/sales endpoint**. Without this fix, T6.4 cutover would 5xx the dominant SmartBI traffic.

---

## 2. Fix design

### 2.1 Add `cretas_engine` (sync) to `smartbi.database.connection`

Mirror the existing pattern. Currently the module exports:

```python
# backend/python/smartbi/database/connection.py (current)
engine = create_engine(settings.postgres_url, poolclass=QueuePool, ...)  # → smartbi_prod_db
```

Add:

```python
# Add alongside the existing `engine`:
cretas_engine = create_engine(
    settings.food_kb_db_url,           # cretas_prod_db (FOOD_KB_POSTGRES_DB env)
    poolclass=QueuePool,
    pool_size=settings.postgres_pool_size,
    max_overflow=settings.postgres_max_overflow,
    pool_pre_ping=True,
    pool_recycle=3600,
    pool_timeout=10,
    echo=settings.debug,
) if settings.food_kb_postgres_password else None

CretasSessionLocal = sessionmaker(bind=cretas_engine) if cretas_engine else None

@contextmanager
def get_cretas_db_context():
    """Sync session for cretas_prod_db tables (sales, finance, department,
    datasource, alerts, etc.). Use this for any SQL that references tables
    listed in spec §1.3 cretas_prod_db column."""
    if CretasSessionLocal is None:
        raise RuntimeError("Cretas DB pool not configured")
    db = CretasSessionLocal()
    try:
        yield db
    finally:
        db.close()
```

### 2.2 Per-endpoint wiring fix (7 sites)

Pattern: replace `_get_sync_engine()` / `get_db_context()` / `get_pg_pool()` with the cretas equivalent at the call site.

#### 2.2.1 `analysis_sales.py` — replace `_get_sync_engine()` with cretas variant

```python
# Before (line ~50):
def _get_sync_engine():
    from smartbi.database.connection import engine
    return engine

# After:
def _get_sync_engine():
    """Note: smart_bi_sales_data lives in cretas_prod_db (per spec
    2026-05-05-phase2a-db-pool-wiring-fix §1.3). Return cretas_engine
    bound to FOOD_KB_POSTGRES_DB env (cretas_prod_db in prod)."""
    from smartbi.database.connection import cretas_engine
    if cretas_engine is None:
        raise RuntimeError("cretas_engine not configured (FOOD_KB_POSTGRES_PASSWORD missing)")
    return cretas_engine
```

This single change covers 5 helper sites in analysis_sales.py PLUS analysis_region.py (which uses `_get_sync_engine` from sales) PLUS analysis_drilldown.py (5 sites that import `_get_sync_engine` from sales).

#### 2.2.2 `dashboard.py` — replace `get_db_context()` with `get_cretas_db_context()`

```python
# Line 73 (data-date-range endpoint):
# Before:
with get_db_context() as db:
    row = db.execute(text("SELECT MIN(order_date), MAX(order_date) FROM smart_bi_sales_data WHERE factory_id=:fid"), ...)

# After:
with get_cretas_db_context() as db:
    row = db.execute(...)
```

#### 2.2.3 `analysis.py` — 2 detail-fallback sites

Lines 301 (sales detail) and 353 (department detail). Same pattern: `get_db_context()` → `get_cretas_db_context()`.

#### 2.2.4 `incentive_plan.py` — switch from `get_pg_pool` to `get_cretas_pool`

Lines 280-284, 303, 335, 359, 383: replace `get_pg_pool()` (asyncpg, smartbi_prod_db) with `get_cretas_pool()` (asyncpg, cretas_prod_db).

### 2.3 Drilldown special case — `_drilldown_record_usage` (line 461-472)

The drill-down handler INSERTs to `smart_bi_usage_records`. Verify which DB this table lives in:

```bash
# As part of the fix verification (not in the fix code itself):
for db in cretas_db cretas_prod_db smartbi_db smartbi_prod_db; do
    sudo -u postgres psql -d $db -tAc "SELECT to_regclass('smart_bi_usage_records');"
done
```

If only in cretas_prod_db: use `cretas_engine` (covered by §2.2.1 fix already since `_get_sync_engine` returns cretas_engine).
If only in smartbi_prod_db: keep `engine` reference but pass it explicitly (don't go through `_get_sync_engine`).
If in BOTH: write to BOTH if data needs to be visible from both DBs (audit logging may need cross-DB visibility).

---

## 3. Test strategy — close the integration gap

### 3.1 New: real-DB smoke gate per endpoint

Add `tests/python/smartbi_compat/test_smoke_real_db.py`:

```python
"""Smoke test that requires real DB. Run before T6.4 cutover to catch wiring bugs.

Skipped by default in CI; enable via SMOKE_REAL_DB=1.
"""
import os
import pytest
import httpx

pytestmark = pytest.mark.skipif(
    not os.environ.get("SMOKE_REAL_DB"),
    reason="set SMOKE_REAL_DB=1 to run (needs cretas-python service + real factory data)"
)

ENDPOINTS_FILE = "scripts/phase2a/t6-in-scope-endpoints.txt"  # already exists


@pytest.fixture(scope="session")
def auth_token():
    """Get a real JWT via login flow on test env."""
    base = os.environ.get("PYTHON_BASE", "http://localhost:8084")
    java_base = os.environ.get("JAVA_BASE", "http://localhost:10011")
    # Login on Java test env to get real JWT
    resp = httpx.post(f"{java_base}/api/mobile/auth/unified-login", json={
        "username": "phase2a_test_user",
        "password": os.environ["PHASE2A_TEST_USER_PASSWORD"],
        "deviceInfo": {"deviceId": "smoke-test"},
    })
    return resp.json()["data"]["token"]


@pytest.mark.parametrize("path", _load_endpoints())
def test_endpoint_returns_2xx(path, auth_token):
    """Verify endpoint returns HTTP 200 with non-empty data — catches DB wiring bugs."""
    base = os.environ.get("PYTHON_BASE", "http://localhost:8084")
    full_path = path.replace("{factoryId}", "F999")
    resp = httpx.get(
        f"{base}{full_path}",
        headers={"Authorization": f"Bearer {auth_token}"},
        timeout=30,
    )
    assert resp.status_code == 200, f"{path}: HTTP {resp.status_code} body={resp.text[:300]}"
    # Body sanity — must be valid JSON with non-null data
    body = resp.json()
    assert body.get("success") is True or body.get("data") is not None, f"{path}: data missing"
```

Run before T6.4: `SMOKE_REAL_DB=1 PYTHON_BASE=http://localhost:8083 JAVA_BASE=http://localhost:10010 PHASE2A_TEST_USER_PASSWORD=<pwd> pytest tests/python/smartbi_compat/test_smoke_real_db.py`

### 3.2 Required: phase2a_test_user in prod DB

Currently `phase2a_test_user` exists only in `cretas_db` (test). For T6.4 prod smoke + monitoring, add same user (with same hash) to `cretas_prod_db`. Migration:

```sql
-- V20260506_01__phase2a_test_user_in_prod.sql (idempotent)
INSERT INTO users (
    username, password_hash, factory_id, ...other required cols...
) VALUES (
    'phase2a_test_user',
    '$2b$12$WED93VdznpVH4d/w.gglOe6JE.QxEYG0hYdOz4nH8RCKfiSC8zP3O',  -- from .env.test
    'F999',
    ...
)
ON CONFLICT (username) DO NOTHING;
```

Coupled with V20260430_01 phase2a_test_factory_F999 which creates the F999 factory — verify that ran in prod too (per `\df` flyway_schema_history).

---

## 4. Rollout sequence

| Stage | Action | Trigger | Effort | Risk |
|---|---|---|---|---|
| 4.0 | Land §2.1 cretas_engine addition (PR-A) | now | 0.5h | low |
| 4.1 | Fix analysis_sales.py + downstream (region, drilldown) (PR-B) | 4.0 ✓ | 1h | low (single-line `_get_sync_engine` change cascades) |
| 4.2 | Fix dashboard.py + analysis.py (PR-C) | 4.0 ✓, parallel with 4.1 | 0.5h | low |
| 4.3 | Fix incentive_plan.py (PR-D) | 4.0 ✓, parallel | 0.5h | low |
| 4.4 | Add real-DB smoke test (PR-E) | parallel | 1h | low |
| 4.5 | Deploy to test env, smoke pass | 4.1+4.2+4.3+4.4 ✓ | 0.5h | low |
| 4.6 | Add phase2a_test_user to prod DB (V20260506_01) | 4.5 ✓ | 0.5h | low |
| 4.7 | Deploy to prod env, smoke pass | 4.6 ✓ | 0.5h | medium (prod deploy) |
| 4.8 | T6 dryrun unblocks | 4.7 ✓ + Python 48h soak | — | — |

Total est: ~5h coding + 24h prod soak before T6.1 dryrun resumes.

### 4.1 Out of scope (handled separately)

- `smart_bi_query_templates` schema drift (cretas:41 / smartbi:12) — needs reconciliation, separate spec
- `intent_match_records` / `ai_training_samples` errors in prod log — AI orchestration scope, blocked by Phase 2B
- `agg_restaurant_daily_*` / `dim_ingredient` errors — Restaurant analytics scope, not T6
- `field_provenance` errors — Trust UI / Sub-Project C scope, not T6

---

## 5. Open questions

1. **Should `_get_sync_engine()` rename to `_get_cretas_sync_engine()`** to clarify intent? Or keep name and add docstring? (Vote: keep name, add comprehensive docstring + spec link.)
2. **Should the `cretas_engine` addition be conditional** (gracefully degrade if FOOD_KB_POSTGRES_PASSWORD missing) or fail loud at startup? (Vote: fail loud — this is now infra-required, not optional.)
3. **Does query_templates schema drift block T6**? Currently `analysis.py` reads from smartbi (12 rows) but `query_templates_write.py` writes to smartbi too — internally consistent, just diverged from cretas. Real prod traffic shows 420 query-template requests Dec 27 → May 6, all served by Java (which presumably reads from cretas). Mobile/web clients see 41 templates via Java but 12 via Python after cutover — UX regression. **Recommendation**: do not include query_templates in T6 cutover scope until reconciliation ships.
4. **Should we run a one-shot data-comparison job** post-fix to verify Python sales response equals Java sales response on the same date range / factory? Builds confidence before T6.1 dryrun.

---

## 6. Audit history

- 2026-05-05 22:00 CST: discovery during T6.0 nginx prep smoke test
- 2026-05-05 23:00 CST: agent audit identified 11 broken endpoints (over-counted: included finance per-type wrongly + classified analysis_inventory/procurement as broken without verifying material_batches table location)
- 2026-05-05 23:15 CST: empirical row-count probe corrected mapping (this doc reflects corrections)
