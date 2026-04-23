# Week 6 Auto-Materialized Template Surfacing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Surface the 37 auto-materialized analysis templates that already land in `smart_bi_pg_analysis_results` on every Excel upload by: (a) extending `/api/smartbi/gold/analysis-results` to batch-resolve N templates with per-template "latest upload where code exists" lookup, and (b) rendering them via a shared `TemplateCard.vue` component on 4 Vue pages (Dashboard / Finance / Trend / RestaurantV2 KPI).

**Architecture:** Read-path-only. Zero new background jobs, zero new persistence, zero new Java. Python endpoint extension + Vue composable + Vue component + 4-page integration. Fall back to `missing_codes[]` and `never_materialized_codes[]` arrays in the response so UI shows useful empty states instead of 404s.

**Tech Stack:** Python 3.8 + FastAPI + asyncpg (backend); Vue 3 + TypeScript + ECharts (frontend). All primitives already in the project.

---

## Context the implementer needs

**Spec:** `docs/superpowers/specs/2026-04-23-week6-auto-materialized-template-surfacing-design.md`

**Related shipped work (both on `e2e/v1-framework`):**
- Week 5 Agent Layer: commits `72790521a`..`7bf12b7e2` (pushed)
- Week 6 A1+B1: commit `5626b8830` (local only, will be pushed in Task 8) — adds `invalidate_on_upload` hook and single-template version of `/analysis-results`

**Key files to read before touching:**
- `backend/python/smartbi/api/gold_reads.py` — existing `/analysis-results` endpoint (already has B1 single-template variant from `5626b8830`)
- `backend/python/smartbi/services/materialized_analytics/persistence.py` — how rows get written (unchanged)
- `web-admin/src/views/smart-bi/Dashboard.vue` — reference page structure
- `web-admin/src/views/smart-bi/FinanceAnalysis.vue` — one of the 4 target pages

**Test DB access:**
- `ssh root@47.100.235.168` → `sudo -u postgres psql -d smartbi_db` (test) or `smartbi_prod_db` (prod)
- `POSTGRES_DB=smartbi_db python -m pytest ...` on server runs async tests against test DB

**Deployment commands (hard rule — test first, prod only on explicit approval):**
```bash
# Python test
scp backend/python/smartbi/api/gold_reads.py root@47.100.235.168:/www/wwwroot/cretas/code/backend/python/smartbi/api/
ssh root@47.100.235.168 "bash /www/wwwroot/cretas/restart.sh test"
# Web-admin test
./scripts/deploy/deploy-web-admin.sh --env test
```

**Committing:** every commit ends with
```
Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
```
Always `git status --short` before `git commit` to verify staged scope is clean (concurrent sessions auto-stage via pre-commit hook).

---

## File Structure

### Backend (Python)

| File | Change | Responsibility |
|---|---|---|
| `backend/python/smartbi/api/gold_reads.py` | Modify (extend existing `/analysis-results` handler, add new batch response helper) | Batch read of materialized template rows with per-code `DISTINCT ON (template_code) ORDER BY created_at DESC` resolver. Return `items[] / missing_codes[] / never_materialized_codes[]`. |
| `backend/python/tests/test_gold_analysis_results_batch.py` | Create | Unit tests: batch resolution, missing vs never-materialized distinction, upload_id override, batch limit enforcement, tenant isolation. |

### Frontend (Vue 3 / TS)

| File | Change | Responsibility |
|---|---|---|
| `web-admin/src/api/smartbi/analysisResults.ts` | Create | Typed API client for `/analysis-results`. Exports `getAnalysisResults(codes, opts)` + TS types `AnalysisResultItem`, `AnalysisResultsResponse`. |
| `web-admin/src/views/smart-bi/composables/useTemplateMap.ts` | Create | Exports `PAGE_TEMPLATE_MAP` (page → code[] static mapping) + `TEMPLATE_TITLES` (code → 中文 display name) + `TEMPLATE_REQUIRED_FIELDS` (code → required Excel field hint). Hardcoded constants, versioned with the pages. |
| `web-admin/src/views/smart-bi/components/TemplateCard.vue` | Create | Single-responsibility component: props `{ code, item?, status: 'loaded'\|'missing'\|'never' }`. Renders title, upload badge, KPI strip (max 4), ECharts chart, insight markdown. Empty states per status. |
| `web-admin/src/views/smart-bi/components/TemplateGrid.vue` | Create | Orchestrator: takes `pageKey` prop, looks up codes from map, fetches in one HTTP call, renders N `<TemplateCard>`s in responsive grid. Centralizes loading/error state for the whole strip. |
| `web-admin/src/views/smart-bi/Dashboard.vue` | Modify (add 1 section) | Append `<TemplateGrid page-key="dashboard" />` below existing content. No existing behavior touched. |
| `web-admin/src/views/smart-bi/FinanceAnalysis.vue` | Modify (add 1 section) | Same pattern, `page-key="finance"`. |
| `web-admin/src/views/smart-bi/RestaurantV2Dashboard.vue` | Modify (add 1 section) | Same, `page-key="restaurantv2"`. |
| `web-admin/src/views/analytics/trends/index.vue` | Modify (add 1 section) | Same, `page-key="trend"`. |

**Why 2 FE components (not one):**
- `TemplateCard` is pure presentational: data in, DOM out. Easy to unit test and easy to reuse in later sprints (e.g., if "模板库" full-list view comes later).
- `TemplateGrid` owns the data fetch. Pages stay dumb — they just drop a `<TemplateGrid>` and move on.

---

## Task 1: Backend batch endpoint extension

**Files:**
- Modify: `backend/python/smartbi/api/gold_reads.py:172-265` (extend existing `get_analysis_results` handler)
- Test: `backend/python/tests/test_gold_analysis_results_batch.py` (create)

The current handler (shipped in `5626b8830`) supports `upload_id=X` + optional `template_code=Y` → single row or list-for-upload. We extend to accept `template_codes=a,b,c` (CSV, max 20) with `resolve_latest=true` default, adding per-code DISTINCT-ON resolution and the two distinction arrays.

### Step 1: Write the failing batch test

- [ ] **Step 1: Write the failing test**

Create `backend/python/tests/test_gold_analysis_results_batch.py`:

```python
"""Tests for batch /api/smartbi/gold/analysis-results endpoint (Week 6)."""
from __future__ import annotations

from datetime import datetime

import pytest
import pytest_asyncio


_TENANT_A = "TEST_BATCH_A"
_TENANT_B = "TEST_BATCH_B"


@pytest_asyncio.fixture
async def pool():
    import asyncpg
    from smartbi.config import get_settings
    from smartbi.tenant_ctx import set_pg_connection_tenant
    settings = get_settings()
    if not settings.postgres_url:
        pytest.skip("No Postgres configured")
    p = await asyncpg.create_pool(
        settings.postgres_url, min_size=1, max_size=3,
        setup=set_pg_connection_tenant,
    )
    try:
        yield p
    finally:
        await p.close()


async def _seed(pool, tenant: str, upload_id: int, template_code: str,
                created_at: datetime | None = None):
    """Insert a minimal row into smart_bi_pg_analysis_results."""
    from smartbi.tenant_ctx import set_factory_id
    set_factory_id(tenant)
    async with pool.acquire() as conn:
        # Ensure parent upload row exists (FK to smart_bi_pg_excel_uploads)
        await conn.execute(
            """
            INSERT INTO smart_bi_pg_excel_uploads (id, factory_id, file_name, upload_status)
            VALUES ($1, $2, $3, 'COMPLETED')
            ON CONFLICT (id) DO NOTHING
            """,
            upload_id, tenant, f"test_{upload_id}.csv",
        )
        await conn.execute(
            """
            INSERT INTO smart_bi_pg_analysis_results
                (upload_id, factory_id, template_code, domain, analysis_type,
                 analysis_result, chart_configs, kpi_values, insights, created_at)
            VALUES ($1, $2, $3, 'test_domain', 'materialized:' || $3,
                    '{"data": []}'::jsonb, '[]'::jsonb, '{}'::jsonb, '[]'::jsonb,
                    COALESCE($4, NOW()))
            ON CONFLICT (upload_id, template_code)
              WHERE template_code IS NOT NULL
              DO UPDATE SET created_at = EXCLUDED.created_at
            """,
            upload_id, tenant, template_code, created_at,
        )


async def _cleanup(pool, tenants: list[str]):
    from smartbi.tenant_ctx import set_factory_id
    for t in tenants:
        set_factory_id(t)
        async with pool.acquire() as conn:
            await conn.execute(
                "DELETE FROM smart_bi_pg_analysis_results WHERE factory_id=$1", t,
            )
            await conn.execute(
                "DELETE FROM smart_bi_pg_excel_uploads WHERE factory_id=$1", t,
            )


async def test_batch_resolve_latest_per_template(pool):
    """Different codes resolve to different latest uploads."""
    try:
        # code_A: latest upload = 90001, earlier = 90000
        await _seed(pool, _TENANT_A, 90000, "tpl_alpha",
                    created_at=datetime(2025, 1, 1))
        await _seed(pool, _TENANT_A, 90001, "tpl_alpha",
                    created_at=datetime(2025, 6, 1))
        # code_B: only one upload, older than code_A's latest
        await _seed(pool, _TENANT_A, 90000, "tpl_beta",
                    created_at=datetime(2025, 1, 1))

        from smartbi.api.gold_reads import _query_analysis_results_batch
        result = await _query_analysis_results_batch(
            pool, _TENANT_A,
            template_codes=["tpl_alpha", "tpl_beta", "tpl_never"],
            upload_id=None,
        )

        items = {i["template_code"]: i for i in result["items"]}
        assert set(items.keys()) == {"tpl_alpha", "tpl_beta"}
        assert items["tpl_alpha"]["upload_id"] == 90001  # newer wins
        assert items["tpl_beta"]["upload_id"] == 90000
        assert result["never_materialized_codes"] == ["tpl_never"]
        assert result["missing_codes"] == []
    finally:
        await _cleanup(pool, [_TENANT_A])


async def test_batch_with_upload_id_override(pool):
    """Pinning upload_id puts codes not in that upload into missing_codes."""
    try:
        await _seed(pool, _TENANT_A, 90010, "tpl_alpha")
        await _seed(pool, _TENANT_A, 90010, "tpl_beta")
        # tpl_gamma only in another upload
        await _seed(pool, _TENANT_A, 90011, "tpl_gamma")

        from smartbi.api.gold_reads import _query_analysis_results_batch
        result = await _query_analysis_results_batch(
            pool, _TENANT_A,
            template_codes=["tpl_alpha", "tpl_gamma", "tpl_never"],
            upload_id=90010,
        )

        codes_loaded = {i["template_code"] for i in result["items"]}
        assert codes_loaded == {"tpl_alpha"}
        assert result["missing_codes"] == ["tpl_gamma"]
        assert result["never_materialized_codes"] == ["tpl_never"]
    finally:
        await _cleanup(pool, [_TENANT_A])


async def test_tenant_isolation(pool):
    """Factory A's rows invisible to factory B via RLS."""
    try:
        await _seed(pool, _TENANT_A, 90020, "tpl_alpha")

        # Switch tenant context
        from smartbi.tenant_ctx import set_factory_id
        set_factory_id(_TENANT_B)

        from smartbi.api.gold_reads import _query_analysis_results_batch
        result = await _query_analysis_results_batch(
            pool, _TENANT_B,
            template_codes=["tpl_alpha"],
            upload_id=None,
        )
        assert result["items"] == []
        assert result["never_materialized_codes"] == ["tpl_alpha"]
    finally:
        await _cleanup(pool, [_TENANT_A, _TENANT_B])
```

- [ ] **Step 2: Run tests to verify they fail (function doesn't exist yet)**

```bash
ssh root@47.100.235.168 "cd /www/wwwroot/cretas/code/backend/python && source venv38/bin/activate; POSTGRES_DB=smartbi_db python -m pytest tests/test_gold_analysis_results_batch.py -v 2>&1 | tail -20"
```

Expected: `ImportError: cannot import name '_query_analysis_results_batch'` (3 failures).

Before running, `scp` the new test file:
```bash
scp backend/python/tests/test_gold_analysis_results_batch.py root@47.100.235.168:/www/wwwroot/cretas/code/backend/python/tests/
```

- [ ] **Step 3: Implement `_query_analysis_results_batch()` helper**

Edit `backend/python/smartbi/api/gold_reads.py`. Add this function **before** `_row_to_result()`:

```python
async def _query_analysis_results_batch(
    pool,
    factory_id: str,
    template_codes: list[str],
    upload_id: Optional[int],
) -> dict:
    """Core batch resolver used by the /analysis-results endpoint.

    Split out as a module-level helper so unit tests can exercise the
    query shape directly (FastAPI request/response handling is separate).

    Returns dict with:
      - items: list of template rows (one per code that resolved)
      - missing_codes: codes not found in the pinned upload_id (only
        populated when upload_id is given)
      - never_materialized_codes: codes with zero rows in the entire
        smart_bi_pg_analysis_results for this factory
    """
    if not template_codes:
        return {"items": [], "missing_codes": [], "never_materialized_codes": []}

    async with pool.acquire() as conn:
        if upload_id is not None:
            # Strict: only this upload. Codes not in upload → missing_codes.
            rows = await conn.fetch(
                """
                SELECT upload_id, template_code, domain, analysis_type,
                       analysis_result, chart_configs, kpi_values,
                       insights, created_at
                  FROM smart_bi_pg_analysis_results
                 WHERE factory_id    = $1
                   AND upload_id     = $2
                   AND template_code = ANY($3)
                """,
                factory_id, upload_id, template_codes,
            )
            items = [_row_to_result(r) for r in rows]
            found = {i["template_code"] for i in items}
            # Among requested codes: found-in-upload vs not-found-in-upload vs never-seen.
            ever_seen_rows = await conn.fetch(
                """
                SELECT DISTINCT template_code
                  FROM smart_bi_pg_analysis_results
                 WHERE factory_id    = $1
                   AND template_code = ANY($2)
                """,
                factory_id, template_codes,
            )
            ever_seen = {r["template_code"] for r in ever_seen_rows}
            missing = sorted(ever_seen - found)
            never = sorted(set(template_codes) - ever_seen)
            return {
                "items": items,
                "missing_codes": missing,
                "never_materialized_codes": never,
            }

        # resolve_latest: DISTINCT ON per code, ordered by created_at DESC.
        rows = await conn.fetch(
            """
            SELECT DISTINCT ON (template_code)
                   upload_id, template_code, domain, analysis_type,
                   analysis_result, chart_configs, kpi_values,
                   insights, created_at
              FROM smart_bi_pg_analysis_results
             WHERE factory_id    = $1
               AND template_code = ANY($2)
             ORDER BY template_code, created_at DESC
            """,
            factory_id, template_codes,
        )
        items = [_row_to_result(r) for r in rows]
        found = {i["template_code"] for i in items}
        never = sorted(set(template_codes) - found)
        return {
            "items": items,
            "missing_codes": [],
            "never_materialized_codes": never,
        }
```

Also, attach upload label information by modifying `_row_to_result()` — add a second query in the helper to fetch `file_name` + `created_at` from `smart_bi_pg_excel_uploads`. To avoid 2N queries, do one JOIN instead. Update the SELECT in both branches above to include the join:

```sql
SELECT DISTINCT ON (r.template_code)
       r.upload_id, r.template_code, r.domain, r.analysis_type,
       r.analysis_result, r.chart_configs, r.kpi_values,
       r.insights, r.created_at,
       u.file_name        AS upload_label,
       u.created_at       AS upload_created_at
  FROM smart_bi_pg_analysis_results r
  JOIN smart_bi_pg_excel_uploads u ON u.id = r.upload_id
 WHERE r.factory_id    = $1
   AND r.template_code = ANY($2)
 ORDER BY r.template_code, r.created_at DESC
```

And update `_row_to_result()` to include these two new fields:

```python
def _row_to_result(row) -> dict:
    """Parse JSONB fields (asyncpg returns them as strings) + date isoformat."""
    import json as _json
    def _j(v):
        if v is None:
            return None
        if isinstance(v, str):
            try:
                return _json.loads(v)
            except ValueError:
                return v
        return v

    def _iso(dt):
        return dt.isoformat() if dt is not None else None

    return {
        "upload_id": int(row["upload_id"]),
        "template_code": row["template_code"],
        "domain": row["domain"],
        "analysis_type": row["analysis_type"],
        "analysis_result": _j(row["analysis_result"]),
        "chart_configs": _j(row["chart_configs"]),
        "kpi_values": _j(row["kpi_values"]),
        "insights": _j(row["insights"]),
        "created_at": _iso(row["created_at"]),
        # upload_label + upload_created_at may not exist for the old
        # single-template caller path. Use row.get()-style access via try.
        "upload_label": row["upload_label"] if "upload_label" in row.keys() else None,
        "upload_created_at": _iso(row["upload_created_at"]) if "upload_created_at" in row.keys() else None,
    }
```

Apply the same JOIN to the existing `upload_id+template_code` and `upload_id` variants of the endpoint (lines in the current handler) so `upload_label` is always populated.

- [ ] **Step 4: Run tests to verify they pass**

```bash
scp backend/python/smartbi/api/gold_reads.py root@47.100.235.168:/www/wwwroot/cretas/code/backend/python/smartbi/api/
scp backend/python/tests/test_gold_analysis_results_batch.py root@47.100.235.168:/www/wwwroot/cretas/code/backend/python/tests/
ssh root@47.100.235.168 "cd /www/wwwroot/cretas/code/backend/python && source venv38/bin/activate; POSTGRES_DB=smartbi_db python -m pytest tests/test_gold_analysis_results_batch.py -v 2>&1 | tail -15"
```

Expected: **3 passed**.

- [ ] **Step 5: Run full agent test suite to check for regressions**

```bash
ssh root@47.100.235.168 "cd /www/wwwroot/cretas/code/backend/python && source venv38/bin/activate; POSTGRES_DB=smartbi_db python -m pytest tests/test_gold_analysis_results_batch.py tests/test_agent_budget_tracker.py tests/test_agent_narrative_cache.py tests/test_agent_orchestrator.py tests/test_agent_invalidate_on_upload_hook.py -v 2>&1 | tail -25"
```

Expected: **23 passed** (3 new + 20 Week 5/6 existing).

---

## Task 2: Wire batch params into the `/analysis-results` route handler

**Files:**
- Modify: `backend/python/smartbi/api/gold_reads.py` (route handler `get_analysis_results`)

- [ ] **Step 1: Update route signature to accept batch params**

Replace the existing `@router.get("/analysis-results")` handler (the one shipped in `5626b8830`) with this enhanced version:

```python
@router.get("/analysis-results")
async def get_analysis_results(
    upload_id: Optional[int] = Query(None, description="Pin to one upload; omit to resolve latest per code"),
    template_code: Optional[str] = Query(None, description="Single template; alias for template_codes=<code>"),
    template_codes: Optional[str] = Query(None, description="CSV of template codes (1..20)"),
    factory_id: Optional[str] = Query(None, description="belt-and-suspenders; defaults to JWT tenant"),
):
    """Read materialized template results from smart_bi_pg_analysis_results.

    Query modes:
    - template_codes=<csv> : batch. Resolves per-code "latest upload where
      this code exists" unless upload_id is also given.
    - template_code=<single> : legacy single-result variant. Alias for
      template_codes=<single>.
    - upload_id=<id> without codes : list all templates for that upload
      (legacy; still supported).

    Response shape (batch):
      { items: [...], missing_codes: [...], never_materialized_codes: [...] }
    Response shape (legacy single-template, found):
      { upload_id, template_code, domain, ..., upload_label }
    Response shape (legacy single-template, not found):
      404
    """
    fid = _resolve_tenant(factory_id)
    pool = await get_pg_pool()

    # Normalize: template_code → template_codes
    codes_list: list[str] = []
    if template_codes:
        codes_list = [c.strip() for c in template_codes.split(",") if c.strip()]
    elif template_code:
        codes_list = [template_code.strip()]

    if codes_list:
        if len(codes_list) > 20:
            raise HTTPException(
                status_code=400,
                detail=f"template_codes max 20 per call, got {len(codes_list)}",
            )
        try:
            return await _query_analysis_results_batch(
                pool, fid, codes_list, upload_id,
            )
        except Exception as e:
            logger.exception("analysis-results batch failed: %s", e)
            raise HTTPException(status_code=500, detail=f"Analysis read failed: {e}")

    # Legacy: upload_id without codes → list all templates for the upload.
    if upload_id is None:
        raise HTTPException(
            status_code=400,
            detail="Provide template_codes= or upload_id=",
        )
    try:
        async with pool.acquire() as conn:
            rows = await conn.fetch(
                """
                SELECT DISTINCT ON (r.template_code)
                       r.upload_id, r.template_code, r.domain, r.analysis_type,
                       r.analysis_result, r.chart_configs, r.kpi_values,
                       r.insights, r.created_at,
                       u.file_name AS upload_label, u.created_at AS upload_created_at
                  FROM smart_bi_pg_analysis_results r
                  JOIN smart_bi_pg_excel_uploads u ON u.id = r.upload_id
                 WHERE r.factory_id = $1
                   AND r.upload_id  = $2
                   AND r.template_code IS NOT NULL
                 ORDER BY r.template_code, r.created_at DESC
                """,
                fid, upload_id,
            )
            return {"items": [_row_to_result(r) for r in rows]}
    except Exception as e:
        logger.exception("analysis-results by-upload failed: %s", e)
        raise HTTPException(status_code=500, detail=f"Analysis read failed: {e}")
```

- [ ] **Step 2: Add integration test for the route**

Append to `backend/python/tests/test_gold_analysis_results_batch.py`:

```python
async def test_route_batch_limit_rejected(pool, httpx_client=None):
    """Route returns 400 when >20 codes requested."""
    import httpx
    # 21 codes
    codes = ",".join(f"tpl_{i}" for i in range(21))
    # Use internal-secret + X-Factory-Id shortcut on localhost
    async with httpx.AsyncClient(base_url="http://localhost:8084") as c:
        resp = await c.get(
            "/api/smartbi/gold/analysis-results",
            params={"template_codes": codes},
            headers={
                "X-Internal-Secret": "cretas-internal-sec-87a9caca9f57b1f2",
                "X-Factory-Id": _TENANT_A,
            },
        )
    assert resp.status_code == 400
    assert "max 20" in resp.text


async def test_route_batch_happy_path_via_http(pool):
    """Seed, call HTTP, expect items shape."""
    try:
        await _seed(pool, _TENANT_A, 90050, "tpl_alpha")
        import httpx
        async with httpx.AsyncClient(base_url="http://localhost:8084") as c:
            resp = await c.get(
                "/api/smartbi/gold/analysis-results",
                params={"template_codes": "tpl_alpha,tpl_never"},
                headers={
                    "X-Internal-Secret": "cretas-internal-sec-87a9caca9f57b1f2",
                    "X-Factory-Id": _TENANT_A,
                },
            )
        assert resp.status_code == 200
        body = resp.json()
        assert len(body["items"]) == 1
        assert body["items"][0]["template_code"] == "tpl_alpha"
        assert body["never_materialized_codes"] == ["tpl_never"]
    finally:
        await _cleanup(pool, [_TENANT_A])
```

- [ ] **Step 3: Restart test Python + run full tests**

```bash
scp backend/python/smartbi/api/gold_reads.py root@47.100.235.168:/www/wwwroot/cretas/code/backend/python/smartbi/api/
scp backend/python/tests/test_gold_analysis_results_batch.py root@47.100.235.168:/www/wwwroot/cretas/code/backend/python/tests/
ssh root@47.100.235.168 "bash /www/wwwroot/cretas/restart.sh test" && sleep 15
ssh root@47.100.235.168 "cd /www/wwwroot/cretas/code/backend/python && source venv38/bin/activate; POSTGRES_DB=smartbi_db python -m pytest tests/test_gold_analysis_results_batch.py -v 2>&1 | tail -15"
```

Expected: **5 passed** (3 helper + 2 HTTP).

- [ ] **Step 4: Smoke test against real prod data via test endpoint**

```bash
ssh root@47.100.235.168 "curl -s -H 'X-Internal-Secret: cretas-internal-sec-87a9caca9f57b1f2' -H 'X-Factory-Id: F001' 'http://localhost:8084/api/smartbi/gold/analysis-results?template_codes=monthly_trend,profit_loss_statement,dish_sales_top_n' | python3 -m json.tool | head -30"
```

Expected: items array contains 2-3 real template rows from test DB (F001 has real qhj data), `never_materialized_codes` may list one.

- [ ] **Step 5: Commit Task 1+2**

```bash
git status --short
# Verify only gold_reads.py + the new test file are staged
git add backend/python/smartbi/api/gold_reads.py backend/python/tests/test_gold_analysis_results_batch.py
git commit -m "$(cat <<'EOF'
feat(smartbi): week6 batch analysis-results endpoint + per-code latest-upload resolver

Extends /api/smartbi/gold/analysis-results (shipped in 5626b8830) with:
- template_codes=<csv> batch param (max 20 per call)
- resolve_latest=true (default): each code resolves independently to
  the most recent upload that produced it, so one page can mix cards
  from different uploads (and upload_label badges each card)
- upload_id override: pin to one upload; codes not present go to
  missing_codes[] (distinct from never_materialized_codes[])
- JOIN onto smart_bi_pg_excel_uploads to get upload_label + date in
  one query

Legacy single-template variant (template_code=<one>) still works as
an alias. Existing /analysis/dynamic callers unaffected.

Tests (5 new, 25 total agent suite): batch latest-resolution across
uploads, upload_id strict mode, tenant isolation, HTTP 400 batch
limit, HTTP 200 happy path.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: FE API client

**Files:**
- Create: `web-admin/src/api/smartbi/analysisResults.ts`

- [ ] **Step 1: Check existing API client patterns**

```bash
head -30 web-admin/src/api/smartbi/upload.ts
```

Expected output shows `import { get } from '@/utils/request'` pattern. Use the same.

- [ ] **Step 2: Write the API client**

Create `web-admin/src/api/smartbi/analysisResults.ts`:

```typescript
/**
 * Week 6 — batch read of materialized template results.
 * Backend: GET /api/mobile/{factoryId}/smart-bi/gold/analysis-results
 *          (Python proxied via Java gateway; auth via JWT)
 * Or direct: GET /api/smartbi/gold/analysis-results (Python direct; needs X-Factory-Id)
 */
import { get } from '@/utils/request';

export interface AnalysisResultItem {
  upload_id: number;
  template_code: string;
  domain: string | null;
  analysis_type: string;
  analysis_result: unknown;
  chart_configs: unknown[] | null;
  kpi_values: Record<string, unknown> | null;
  insights: unknown[] | null;
  created_at: string | null;
  upload_label: string | null;
  upload_created_at: string | null;
}

export interface AnalysisResultsResponse {
  items: AnalysisResultItem[];
  missing_codes: string[];           // code was present in some upload but not THIS upload (upload_id pinned)
  never_materialized_codes: string[]; // code has never been successfully generated for this factory
}

export function getAnalysisResults(
  factoryId: string,
  codes: string[],
  opts: { uploadId?: number } = {},
) {
  const params: Record<string, string | number> = {
    template_codes: codes.join(','),
  };
  if (opts.uploadId !== undefined) {
    params.upload_id = opts.uploadId;
  }
  // factoryId-scoped path mirrors existing /api/mobile/{factoryId}/smart-bi/...
  return get<AnalysisResultsResponse>(
    `/${factoryId}/smart-bi/gold/analysis-results`,
    { params },
  );
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd web-admin && npx vue-tsc --noEmit 2>&1 | grep -E "analysisResults|TemplateCard|TemplateGrid" | head -10
```

Expected: no errors on the new file.

- [ ] **Step 4: Commit**

```bash
git status --short
git add web-admin/src/api/smartbi/analysisResults.ts
git commit -m "feat(smartbi): week6 FE typed client for /analysis-results batch endpoint

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Hardcoded page-template map + title/required-fields dictionaries

**Files:**
- Create: `web-admin/src/views/smart-bi/composables/useTemplateMap.ts`

- [ ] **Step 1: Write the composable**

Create `web-admin/src/views/smart-bi/composables/useTemplateMap.ts`:

```typescript
/**
 * Week 6 — static mapping: which templates show on which page + their display labels.
 *
 * Why hardcoded instead of backend-driven:
 * - Page layout is a UI concern; backend shouldn't own UX decisions.
 * - Template codes evolve via PR; FE changes in lockstep.
 * - CI would catch a rename when all requested codes return as
 *   never_materialized_codes (100% miss rate).
 */

/** Pages → template_code[] (order matters, renders top-to-bottom left-to-right) */
export const PAGE_TEMPLATE_MAP: Record<string, readonly string[]> = {
  dashboard: [
    'monthly_trend',
    'top_n_by_dim',
    'category_distribution',
    'anomaly_detection',
  ],
  finance: [
    'profit_loss_statement',
    'revenue_management_report',
    'stored_value_card_consumption',
    'groupon_channel_breakdown',
  ],
  trend: [
    'monthly_trend',
    'period_comparison_trend',
    'weekday_weekend_pattern',
    'monthly_anomaly',
  ],
  restaurantv2: [
    'dish_sales_top_n',
    'dish_slow_movers',
    'dish_category_breakdown',
    'combo_usage_rate',
    'time_slot_revenue',
  ],
} as const;

export type TemplatePageKey = keyof typeof PAGE_TEMPLATE_MAP;

/** Stable 中文 display titles — do NOT use AI-generated titles, they drift. */
export const TEMPLATE_TITLES: Record<string, string> = {
  // generic
  monthly_trend: '时间趋势',
  top_n_by_dim: '维度 Top N',
  category_distribution: '分类分布',
  anomaly_detection: '异常检测',
  pareto_analysis: '帕累托分析',
  // finance
  profit_loss_statement: '利润表',
  revenue_management_report: '营收管理报表',
  stored_value_card_consumption: '储值卡消费分析',
  groupon_channel_breakdown: '团购渠道明细',
  // trend
  period_comparison_trend: '同比环比趋势',
  weekday_weekend_pattern: '工作日/周末规律',
  monthly_anomaly: '月度异常',
  // restaurant
  dish_sales_top_n: '热销菜品 Top N',
  dish_slow_movers: '滞销菜品',
  dish_category_breakdown: '菜品分类明细',
  combo_usage_rate: '套餐使用率',
  time_slot_revenue: '时段营业额',
  dish_by_table_type: '桌位类型消费',
  dish_time_slot_matrix: '菜品 × 时段矩阵',
};

/** What fields must be present in the source Excel for this template to match.
 * Used in empty-state copy only — no runtime enforcement. */
export const TEMPLATE_REQUIRED_FIELDS: Record<string, string> = {
  profit_loss_statement: '营业收入 / 成本 / 毛利',
  revenue_management_report: '营业额 / 渠道 / 门店',
  stored_value_card_consumption: '储值卡消费金额 / 会员ID',
  groupon_channel_breakdown: '渠道 / 代金券类型 / 消费金额',
  dish_sales_top_n: '菜品名称 / 销量 / 金额',
  dish_slow_movers: '菜品名称 / 销量',
  dish_category_breakdown: '菜品分类 / 销售数据',
  combo_usage_rate: '套餐使用记录',
  time_slot_revenue: '时间 / 营业额',
  monthly_trend: '时间字段 + 数值指标',
  period_comparison_trend: '时间字段 + 数值指标 (≥2 月)',
  weekday_weekend_pattern: '每日营业数据',
  monthly_anomaly: '月度数值序列 (≥3 月)',
  top_n_by_dim: '类别维度 + 数值指标',
  category_distribution: '分类维度 + 数值指标',
  anomaly_detection: '数值序列',
};

export function getPageCodes(pageKey: string): readonly string[] {
  return PAGE_TEMPLATE_MAP[pageKey] || [];
}

export function getTemplateTitle(code: string): string {
  return TEMPLATE_TITLES[code] || code;
}

export function getRequiredFields(code: string): string {
  return TEMPLATE_REQUIRED_FIELDS[code] || '对应业务数据';
}
```

- [ ] **Step 2: Commit**

```bash
git status --short
git add web-admin/src/views/smart-bi/composables/useTemplateMap.ts
git commit -m "feat(smartbi): week6 page-template mapping + stable 中文 titles

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: `TemplateCard.vue` presentational component

**Files:**
- Create: `web-admin/src/views/smart-bi/components/TemplateCard.vue`

- [ ] **Step 1: Check existing ECharts wrapper**

```bash
grep -rn "ChartRenderer\|echarts.*init" web-admin/src/views/smart-bi/components/ | head -5
```

Look for reusable chart components. Typical pattern: import `echarts` directly + a `<div ref>`.

- [ ] **Step 2: Write the component**

Create `web-admin/src/views/smart-bi/components/TemplateCard.vue`:

```vue
<template>
  <el-card class="tpl-card" shadow="hover">
    <template #header>
      <div class="tpl-header">
        <span class="tpl-title">{{ title }}</span>
        <span v-if="uploadLabel" class="tpl-badge">
          数据截至: {{ formattedDate }}
        </span>
      </div>
    </template>

    <!-- Loading -->
    <div v-if="status === 'loading'" class="tpl-loading">
      <el-skeleton :rows="4" animated />
    </div>

    <!-- Loaded: real chart + KPI + insight -->
    <template v-else-if="status === 'loaded' && item">
      <div v-if="kpis.length > 0" class="tpl-kpis">
        <div v-for="kpi in kpis" :key="kpi.label" class="tpl-kpi">
          <div class="tpl-kpi-label">{{ kpi.label }}</div>
          <div class="tpl-kpi-value">{{ kpi.value }}</div>
        </div>
      </div>
      <div ref="chartRef" class="tpl-chart" v-if="chartOption"></div>
      <div v-if="insightText" class="tpl-insight">
        {{ insightText }}
      </div>
    </template>

    <!-- Empty: code was in some upload but not this one -->
    <div v-else-if="status === 'missing'" class="tpl-empty">
      <div class="tpl-empty-icon">📭</div>
      <div class="tpl-empty-title">该数据集不包含 [{{ title }}] 所需字段</div>
      <div class="tpl-empty-hint">上传含 {{ requiredFields }} 的文件后将自动生成</div>
    </div>

    <!-- Empty: code never materialized for this factory -->
    <div v-else-if="status === 'never'" class="tpl-empty">
      <div class="tpl-empty-icon">📄</div>
      <div class="tpl-empty-title">尚未为该工厂生成过 [{{ title }}]</div>
      <div class="tpl-empty-hint">上传含 {{ requiredFields }} 的数据文件</div>
    </div>
  </el-card>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch, nextTick } from 'vue';
import * as echarts from 'echarts';
import type { ECharts } from 'echarts';
import type { AnalysisResultItem } from '@/api/smartbi/analysisResults';
import {
  getTemplateTitle,
  getRequiredFields,
} from '../composables/useTemplateMap';

type CardStatus = 'loading' | 'loaded' | 'missing' | 'never';

const props = defineProps<{
  code: string;
  item?: AnalysisResultItem;
  status: CardStatus;
}>();

const chartRef = ref<HTMLElement>();
let chartInstance: ECharts | null = null;

const title = computed(() => getTemplateTitle(props.code));
const requiredFields = computed(() => getRequiredFields(props.code));

const uploadLabel = computed(() => props.item?.upload_label);
const formattedDate = computed(() => {
  const d = props.item?.upload_created_at;
  if (!d) return '';
  try {
    return new Date(d).toLocaleDateString('zh-CN');
  } catch {
    return d.slice(0, 10);
  }
});

const kpis = computed(() => {
  const kv = props.item?.kpi_values;
  if (!kv || typeof kv !== 'object') return [];
  return Object.entries(kv)
    .slice(0, 4)
    .map(([label, value]) => ({
      label,
      value: typeof value === 'number'
        ? value.toLocaleString('zh-CN', { maximumFractionDigits: 2 })
        : String(value ?? '—'),
    }));
});

const chartOption = computed(() => {
  const configs = props.item?.chart_configs;
  if (!Array.isArray(configs) || configs.length === 0) return null;
  return configs[0]; // render first chart; library view can show others later
});

const insightText = computed(() => {
  const insights = props.item?.insights;
  if (!Array.isArray(insights) || insights.length === 0) return '';
  return insights
    .map((i) => (typeof i === 'string' ? i : (i as { text?: string }).text || ''))
    .filter(Boolean)
    .join('\n');
});

function renderChart() {
  if (!chartRef.value || !chartOption.value) {
    chartInstance?.dispose();
    chartInstance = null;
    return;
  }
  if (!chartInstance) {
    chartInstance = echarts.init(chartRef.value);
  }
  chartInstance.setOption(chartOption.value as echarts.EChartsOption, true);
}

onMounted(() => {
  nextTick(renderChart);
});

watch(
  () => [props.status, props.item],
  () => nextTick(renderChart),
  { deep: true },
);
</script>

<style scoped>
.tpl-card {
  margin-bottom: 16px;
}
.tpl-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.tpl-title {
  font-weight: 600;
  font-size: 14px;
}
.tpl-badge {
  font-size: 12px;
  color: #909399;
}
.tpl-kpis {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
  margin-bottom: 12px;
}
.tpl-kpi {
  padding: 8px 12px;
  background: #f5f7fa;
  border-radius: 4px;
  min-width: 80px;
}
.tpl-kpi-label {
  font-size: 12px;
  color: #606266;
}
.tpl-kpi-value {
  font-size: 18px;
  font-weight: 600;
  color: #303133;
}
.tpl-chart {
  height: 260px;
  width: 100%;
}
.tpl-insight {
  margin-top: 12px;
  padding: 10px;
  background: #f0f9ff;
  border-left: 3px solid #409eff;
  font-size: 13px;
  white-space: pre-wrap;
}
.tpl-empty {
  text-align: center;
  padding: 32px 16px;
  color: #909399;
}
.tpl-empty-icon {
  font-size: 32px;
  margin-bottom: 8px;
}
.tpl-empty-title {
  font-size: 14px;
  color: #606266;
  margin-bottom: 4px;
}
.tpl-empty-hint {
  font-size: 12px;
}
.tpl-loading {
  padding: 16px;
}
</style>
```

- [ ] **Step 3: Verify TS + component renders in isolation**

```bash
cd web-admin && npx vue-tsc --noEmit 2>&1 | grep -E "TemplateCard" | head
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git status --short
git add web-admin/src/views/smart-bi/components/TemplateCard.vue
git commit -m "feat(smartbi): week6 TemplateCard.vue presentational component

3 states (loaded/missing/never) + upload source badge + ECharts chart
+ KPI strip + insight block. Pure presentational — data fetching
lives in TemplateGrid.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: `TemplateGrid.vue` data fetcher + orchestrator

**Files:**
- Create: `web-admin/src/views/smart-bi/components/TemplateGrid.vue`

- [ ] **Step 1: Write the grid orchestrator**

Create `web-admin/src/views/smart-bi/components/TemplateGrid.vue`:

```vue
<template>
  <div class="tpl-grid-section">
    <div class="tpl-grid-header">
      <h3>📊 模板分析</h3>
      <el-button
        v-if="!loading && hasAnyData"
        size="small"
        type="text"
        @click="refresh"
      >
        刷新
      </el-button>
    </div>
    <div v-if="loadError" class="tpl-grid-error">
      加载模板分析失败: {{ loadError }}
    </div>
    <div class="tpl-grid" v-else>
      <TemplateCard
        v-for="code in codes"
        :key="code"
        :code="code"
        :item="itemsMap[code]"
        :status="statusFor(code)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import TemplateCard from './TemplateCard.vue';
import {
  getAnalysisResults,
  type AnalysisResultItem,
} from '@/api/smartbi/analysisResults';
import { getPageCodes } from '../composables/useTemplateMap';

const props = defineProps<{
  /** Page key (dashboard|finance|trend|restaurantv2) */
  pageKey: string;
  /** Factory id — usually from useFactoryStore in parent */
  factoryId: string;
  /** Optional: pin to one upload; omit for latest-per-code resolution */
  uploadId?: number;
}>();

const loading = ref(true);
const loadError = ref('');
const items = ref<AnalysisResultItem[]>([]);
const missingCodes = ref<string[]>([]);
const neverCodes = ref<string[]>([]);

const codes = computed(() => getPageCodes(props.pageKey));

const itemsMap = computed(() => {
  const m: Record<string, AnalysisResultItem> = {};
  for (const i of items.value) m[i.template_code] = i;
  return m;
});

const hasAnyData = computed(() => items.value.length > 0);

function statusFor(code: string): 'loading' | 'loaded' | 'missing' | 'never' {
  if (loading.value) return 'loading';
  if (itemsMap.value[code]) return 'loaded';
  if (missingCodes.value.includes(code)) return 'missing';
  if (neverCodes.value.includes(code)) return 'never';
  return 'never'; // safe fallback
}

async function load() {
  if (!props.factoryId || codes.value.length === 0) return;
  loading.value = true;
  loadError.value = '';
  try {
    const resp = await getAnalysisResults(
      props.factoryId,
      [...codes.value],
      props.uploadId !== undefined ? { uploadId: props.uploadId } : {},
    );
    if (resp.success && resp.data) {
      items.value = resp.data.items || [];
      missingCodes.value = resp.data.missing_codes || [];
      neverCodes.value = resp.data.never_materialized_codes || [];
    } else {
      loadError.value = resp.message || '接口返回空';
    }
  } catch (e) {
    loadError.value = e instanceof Error ? e.message : String(e);
    console.error('[TemplateGrid] load failed', e);
  } finally {
    loading.value = false;
  }
}

function refresh() {
  load();
}

onMounted(load);
watch(() => [props.factoryId, props.pageKey, props.uploadId], load);
</script>

<style scoped>
.tpl-grid-section {
  margin-top: 24px;
}
.tpl-grid-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}
.tpl-grid-header h3 {
  margin: 0;
  font-size: 16px;
}
.tpl-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(380px, 1fr));
  gap: 16px;
}
.tpl-grid-error {
  padding: 16px;
  background: #fef0f0;
  color: #f56c6c;
  border-radius: 4px;
}
</style>
```

- [ ] **Step 2: TS check + commit**

```bash
cd web-admin && npx vue-tsc --noEmit 2>&1 | grep -E "TemplateGrid" | head
```

Expected: no errors.

```bash
git status --short
git add web-admin/src/views/smart-bi/components/TemplateGrid.vue
git commit -m "feat(smartbi): week6 TemplateGrid orchestrator

Single HTTP batch call, renders N TemplateCards. Handles 3 response
arrays (items / missing_codes / never_materialized_codes) into per-card
status. Pages use it as <TemplateGrid page-key='finance' :factory-id>.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: Wire 4 pages

**Files:**
- Modify: `web-admin/src/views/smart-bi/Dashboard.vue`
- Modify: `web-admin/src/views/smart-bi/FinanceAnalysis.vue`
- Modify: `web-admin/src/views/smart-bi/RestaurantV2Dashboard.vue`
- Modify: `web-admin/src/views/analytics/trends/index.vue`

- [ ] **Step 1: Dashboard.vue — add TemplateGrid at bottom**

Open `web-admin/src/views/smart-bi/Dashboard.vue`. Find the closing `</el-main>` or the last major section in `<template>`. Insert **before** it:

```vue
<TemplateGrid page-key="dashboard" :factory-id="factoryId" />
```

Add import in `<script setup>`:

```typescript
import TemplateGrid from './components/TemplateGrid.vue';
```

Verify `factoryId` is already defined in this component (it is — used by Week 5 code at line ~497).

- [ ] **Step 2: FinanceAnalysis.vue — same**

Open `web-admin/src/views/smart-bi/FinanceAnalysis.vue`. Find the closing of the main content section. Insert:

```vue
<TemplateGrid page-key="finance" :factory-id="factoryId" />
```

Import:
```typescript
import TemplateGrid from './components/TemplateGrid.vue';
```

- [ ] **Step 3: RestaurantV2Dashboard.vue — same**

Open `web-admin/src/views/smart-bi/RestaurantV2Dashboard.vue`. Insert at the end of `<template>`:

```vue
<TemplateGrid page-key="restaurantv2" :factory-id="factoryId" />
```

Import:
```typescript
import TemplateGrid from './components/TemplateGrid.vue';
```

If `factoryId` is not already a ref in this file, import it:
```bash
grep -n "factoryId\|useFactoryStore\|factory_id" web-admin/src/views/smart-bi/RestaurantV2Dashboard.vue | head -5
```

If missing, use:
```typescript
import { useAuthStore } from '@/stores/auth';
const auth = useAuthStore();
const factoryId = computed(() => auth.factoryId || '');
```

- [ ] **Step 4: trends/index.vue — same**

Open `web-admin/src/views/analytics/trends/index.vue`. Insert:

```vue
<TemplateGrid page-key="trend" :factory-id="factoryId" />
```

With the same import pattern. Check this file's existing imports first — it may be under `web-admin/src/views/analytics/` not `smart-bi/`, so use absolute path:

```typescript
import TemplateGrid from '@/views/smart-bi/components/TemplateGrid.vue';
```

- [ ] **Step 5: TS compile check**

```bash
cd web-admin && npx vue-tsc --noEmit 2>&1 | tail -20
```

Expected: no new errors (pre-existing warnings ok).

- [ ] **Step 6: Build test**

```bash
cd web-admin && npm run build 2>&1 | tail -5
```

Expected: build succeeds, total size change minimal.

- [ ] **Step 7: Commit**

```bash
git status --short
git add web-admin/src/views/smart-bi/Dashboard.vue \
        web-admin/src/views/smart-bi/FinanceAnalysis.vue \
        web-admin/src/views/smart-bi/RestaurantV2Dashboard.vue \
        web-admin/src/views/analytics/trends/index.vue
git commit -m "feat(smartbi): week6 wire TemplateGrid into 4 pages

Dashboard / Finance / RestaurantV2 / Trend each append a
<TemplateGrid page-key='...' :factory-id /> section below existing
content. Zero changes to existing page logic — purely additive.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 8: Deploy test + verify

**Files:**
- None (deploy only)

- [ ] **Step 1: Deploy web-admin to test vhost 8097**

```bash
./scripts/deploy/deploy-web-admin.sh --env test 2>&1 | tail -10
```

Expected: `HTTP 200` verification + new bundle hash printed.

- [ ] **Step 2: Verify Python test endpoint still works**

```bash
ssh root@47.100.235.168 "curl -s -H 'X-Internal-Secret: cretas-internal-sec-87a9caca9f57b1f2' -H 'X-Factory-Id: F001' 'http://localhost:8084/api/smartbi/gold/analysis-results?template_codes=monthly_trend,profit_loss_statement' | python3 -m json.tool | head -40"
```

Expected: items array + missing_codes + never_materialized_codes. `upload_label` populated.

- [ ] **Step 3: Browser smoke (manual)**

Open `http://139.196.165.140:8097/` in browser, log in as a test user for factory F001, navigate to:
- 经营驾驶舱 (Dashboard) — scroll to bottom, verify "📊 模板分析" section shows 4 cards (at least 1 loaded)
- 财务分析 (FinanceAnalysis) — scroll, verify finance codes show loaded or useful empty state
- RestaurantV2Dashboard — verify 5 restaurant cards
- Trend page — verify 4 trend cards

Expect: no console errors. Upload badges visible. Empty-state copy readable.

If accessible via a real account: log what you see. Otherwise document as "manual QA pending" in memory and continue.

- [ ] **Step 4: Push all Week 6 commits to origin**

```bash
git log --oneline origin/e2e/v1-framework..HEAD
git push origin e2e/v1-framework
```

Verify post-push: `git log origin/e2e/v1-framework -5`.

- [ ] **Step 5: Request prod deploy approval**

Do NOT deploy prod. Ask the user: "Week 6 test verified. Deploy to prod? (Python + web-admin; no DB changes, no Java changes.)"

**Wait for explicit "部 prod" before proceeding to Task 9.**

---

## Task 9: Prod deploy (only after explicit approval)

**Files:**
- None (deploy only)

- [ ] **Step 1: Deploy Python prod**

```bash
./scripts/deploy/deploy-smartbi-python.sh --env prod 2>&1 | tail -10
```

- [ ] **Step 2: Verify Python prod**

```bash
sleep 15 && ssh root@47.100.235.168 "curl -s -o /dev/null -w 'HTTP %{http_code}\n' http://localhost:8083/health && curl -s -H 'X-Internal-Secret: cretas-internal-sec-87a9caca9f57b1f2' -H 'X-Factory-Id: RES_3101_009' 'http://localhost:8083/api/smartbi/gold/analysis-results?template_codes=monthly_trend' | python3 -m json.tool | head -20"
```

Expected: HTTP 200 + real qhj items.

- [ ] **Step 3: Deploy web-admin prod**

```bash
echo "YES-PROD" | ./scripts/deploy/deploy-web-admin.sh --env prod 2>&1 | tail -10
```

- [ ] **Step 4: Browser verify admin.cretaceousfuture.com**

Open `https://admin.cretaceousfuture.com/`, log in as qhj user, navigate through 4 pages. Same checks as Task 8 Step 3 but on prod data.

- [ ] **Step 5: Write memory + final push**

Create `C:\Users\Steve\.claude\projects\C--Users-Steve-my-prototype-logistics\memory\project_week6_template_surfacing_complete.md` with:
- What shipped (endpoint extension + 4 pages + TemplateCard)
- Deploy state (prod Python + prod web-admin bundle hash)
- Known gaps (6 empty pages deferred, no user pinning)
- Rollback: `git revert <commit>` + redeploy web-admin prod

Update `MEMORY.md` top entry. Push any remaining commits.

---

## Plan self-review

**Spec coverage:**
- ✅ §3.1 batch endpoint with template_codes + resolve_latest → Task 1-2
- ✅ §3.2 TemplateCard component with 3 states → Task 5
- ✅ §3.3 hardcoded page mapping → Task 4
- ✅ §3.4 data flow (additive, no pipeline change) → Task 7
- ✅ §5 testing (3 backend unit tests + 2 HTTP tests + browser smoke) → Task 1, 2, 8
- ✅ §6 deployment (test first, prod on approval) → Task 8, 9
- ✅ §7 risks (upload_label badge, batch limit, localStorage pin affordance NOT implemented — correctly out of scope)

**Placeholder scan:** None. Every step has concrete code or commands.

**Type consistency:**
- `AnalysisResultItem` defined in `analysisResults.ts` (Task 3), used in `TemplateCard.vue` (Task 5) and `TemplateGrid.vue` (Task 6) — consistent.
- `PAGE_TEMPLATE_MAP` keys (`dashboard`/`finance`/`trend`/`restaurantv2`) match `page-key` props in Task 7 — consistent.
- Backend `items` / `missing_codes` / `never_materialized_codes` shape matches FE `AnalysisResultsResponse` — consistent.

Plan complete.
