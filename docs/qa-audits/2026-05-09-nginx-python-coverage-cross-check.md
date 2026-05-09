# nginx ↔ Python coverage cross-check (post-T6.4 latent gap audit)

**Date**: 2026-05-09
**Author**: organizer-dispatched chat (Phase A latent finding follow-up)
**Trigger**: PR #178 audit `docs/qa-audits/2026-05-09-t6-5-phase-a-deletion-candidates.md` §3.1.a flagged datasource 6-endpoint cluster as `SAFE_NGINX_ROUTED` + Python ✓, but did not actually verify Python implementation. Chat 4 cross-verify (PR-W) suspected POST `/datasource/upload`, GET `/datasource/{id}/preview`, POST `/datasource/apply` are routed to Python by nginx but missing in Python → 404 for 75 customer factories since T6.4 cutover (2026-05-09 06:34 CST).

---

## §0 TL;DR

| Stat | Value |
|---|---|
| nginx-routed path-prefix groups (T6.4 merged regex) | 3 location blocks, 7 path-prefix groups |
| Java SmartBIAnalysisController endpoints under prefix groups | 14 endpoints (datasource 6 + query-templates 4 + incentive-plan 1 + alerts/recommendations/data-date-range 3 standalone) |
| **Mismatches found (nginx routes but Python missing)** | **3 endpoints** |
| Severity verdict | **3 × P3 (dead path)** — 0 frontend callers, 0 prod log hits in 24h+, Java-side TODO stubs |
| Recommended action | **Defer Python impl. Either keep current 404 (acceptable) or add nginx exclude to fall back to Java stubs — see §7.** |

**Conclusion**: No P0/P1/P2 mismatches. The three missing endpoints (`POST /datasource/upload`, `GET /datasource/{id}/preview`, `POST /datasource/apply`) are intentional Phase 2A deferrals (PR #45 / #49 / #50) targeting Java stubs that no client actually uses. The latent 404 is benign because the Java reference implementation is itself a TODO stub returning empty `noChanges` envelope. Real Excel upload pipeline (`/upload`, `/upload/confirm`, `/uploads/...`, etc.) lives in `SmartBIUploadController.java` and is **not** affected by T6.4 nginx regex (does not match `/datasource/...`).

---

## §1 Methodology

1. **nginx config dump** — `ssh root@139.196.165.140 "cat /www/server/panel/vhost/nginx/api.cretaceousfuture.com.conf"`
2. **Python @router enumeration** — `Grep '@router\.(get|post|put|delete|patch)\('` across `backend/python/smartbi_compat/api/`
3. **Java endpoint enumeration** — `Grep '@(Get|Post|Put|Delete)Mapping|@RequestMapping'` across `SmartBIAnalysisController.java` + cross-check sister controllers (`SmartBIDashboardController.java`, `SmartBIUploadController.java`)
4. **Frontend caller search** — `Grep` web-admin/src and frontend/CretasFoodTrace/src and platform/ for `datasource/(upload|apply)`, `datasource/[^/]+/preview`, `previewSchema`, `applySchema`
5. **Prod log signal** — Python prod log (`/www/wwwroot/cretas/python-prod.log`, 6.2 MB, 24 h+ since rotate) + Java prod log (current + 8 historical gz archives covering Apr 30 → May 9) for any path matches
6. **Java stub verification** — read `SmartBiSchemaServiceImpl.java` line 57-147 + recorded F999/F001 goldens (`tests/fixtures/java-smartbi-golden/datasource-{upload-schema,preview,apply}-{F999,F001}.json`)

---

## §2 Full nginx vs Python coverage table

### nginx T6.4 merged regex (server 139, vhost `api.cretaceousfuture.com.conf`)

3 location blocks route to `cretas_python` upstream for the customer-factory regex `(F00[1-46]|FOOD_3101_(00[1-9]|0[1-3][0-9]|04[0-8])|MEAT_3101_00[12]|OTHER_3101_001|RES_3101_00[1-9]|RES_GML_001|R001|R_(GML_DEMO|XMX_(CHAIN|FRESH[123]?)|YHDJ_DEMO|YJJ_DEMO)|TEST_0000_001)` (75 factories total):

| Block | Path suffix anchor | Route to |
|---|---|---|
| 1 | `/smart-bi/(alerts\|recommendations\|data-date-range)$` | Python |
| 2 | `/smart-bi/analysis/(finance\|sales\|department\|region\|inventory\|procurement)(/.*)?$` | Python |
| 3 | `/smart-bi/(query-templates\|datasource\|incentive-plan)(/.*)?$` | Python |
| (default) | everything else under `/api/mobile/...` | Java (`location /`) |

### Endpoint-level coverage table

| # | Method | Java path (under `/api/mobile/{factoryId}/smart-bi`) | nginx routes? | Python @router? | Note |
|---|---|---|---|---|---|
| 1 | GET | `/alerts` | ✓ Block 1 | ✓ analysis.py:946 | full parity |
| 2 | GET | `/recommendations` | ✓ Block 1 | ✓ analysis.py:972 | full parity |
| 3 | GET | `/data-date-range` | ✓ Block 1 | ✓ dashboard.py:84 | full parity |
| 4 | GET | `/analysis/sales` | ✓ Block 2 | ✓ analysis_sales.py:1724 | full parity |
| 5 | GET | `/analysis/department` | ✓ Block 2 | ✓ analysis_department.py:676 | full parity |
| 6 | GET | `/analysis/region` | ✓ Block 2 | ✓ analysis_region.py:770 | full parity |
| 7 | GET | `/analysis/finance` | ✓ Block 2 | ✓ analysis_finance.py:3286 | full parity |
| 8 | GET | `/analysis/finance/budget-achievement` | ✓ Block 2 | ✓ analysis_finance.py:3339 | full parity |
| 9 | GET | `/analysis/finance/yoy-mom` | ✓ Block 2 | ✓ analysis_finance.py:3351 | full parity |
| 10 | GET | `/analysis/finance/category-comparison` | ✓ Block 2 | ✓ analysis_finance.py:3407 | full parity |
| 11 | GET | `/analysis/inventory` | ✓ Block 2 | ✓ analysis_inventory.py:1891 | full parity |
| 12 | GET | `/analysis/procurement` | ✓ Block 2 | ✓ analysis_procurement.py:1209 | full parity |
| 13 | GET | `/query-templates` | ✓ Block 3 | ✓ analysis.py:127 | full parity |
| 14 | POST | `/query-templates` | ✓ Block 3 | ✓ query_templates_write.py:223 | full parity |
| 15 | PUT | `/query-templates/{templateId}` | ✓ Block 3 | ✓ query_templates_write.py:236 | full parity |
| 16 | DELETE | `/query-templates/{templateId}` | ✓ Block 3 | ✓ query_templates_write.py:250 | full parity |
| 17 | GET | `/incentive-plan/{targetType}/{targetId}` | ✓ Block 3 | ✓ incentive_plan.py:523 | full parity |
| 18 | GET | `/datasource/list` | ✓ Block 3 | ✓ analysis.py:931 | full parity |
| 19 | GET | `/datasource/{datasourceId}/fields` | ✓ Block 3 | ✓ datasource.py:246 | full parity |
| 20 | GET | `/datasource/{datasourceId}/history` | ✓ Block 3 | ✓ datasource.py:271 | full parity |
| **M-1** | **POST** | **`/datasource/upload`** (multipart) | **✓ Block 3** | **✗ MISSING** | Java: `SmartBIAnalysisController.java:678`, Python: nothing — **404 for 75 customer factories** |
| **M-2** | **GET** | **`/datasource/{datasourceId}/preview`** | **✓ Block 3** | **✗ MISSING** | Java: `SmartBIAnalysisController.java:696`, Python: nothing — **404 for 75 customer factories** |
| **M-3** | **POST** | **`/datasource/apply`** | **✓ Block 3** | **✗ MISSING** | Java: `SmartBIAnalysisController.java:714`, Python: nothing — **404 for 75 customer factories** |

### Out-of-regex (still hit Java post-cutover)

These paths are NOT matched by any T6.4 regex and continue to land on Java (correct behavior for Phase 2A — these were never in scope for Python port):

- All `SmartBIDashboardController` endpoints (`/dashboard/executive`, `/dashboard/executive/insights{,/custom{,/stream}}`, `/dashboard`, `/analysis/dynamic{,/kpis}`, `/generate-adaptive-charts`, `/generate-chart`, …)
- All `SmartBIUploadController` endpoints — **the real Excel upload pipeline**: `/upload` (multipart), `/upload-and-analyze`, `/upload/confirm`, `/sheets`, `/upload-batch`, `/upload-batch-stream` (SSE), `/retry-sheet/{uploadId}`, `/uploads`, `/uploads/{uploadId}/fields`, `/uploads/{uploadId}/data`, `/uploads-missing-fields`, `/backfill/fields/{uploadId}`, `/backfill/batch`
- All `SmartBIPublicDemoController` and `SmartBIConfigController` endpoints
- `/query`, `/drill-down`, `/analysis/production`, `/analysis/quality` — Java only (Phase 2A deferred)

---

## §3 Mismatches detail

### M-1 · `POST /api/mobile/{factoryId}/smart-bi/datasource/upload`

- **Java handler**: `SmartBIAnalysisController.uploadAndDetectSchema()` at line 678. Calls `schemaService.uploadAndDetectSchema(file, datasourceName, factoryId)`.
- **Java service body** (`SmartBiSchemaServiceImpl.java:57-93`): three explicit `// TODO` markers — no Excel parsing, no schema-diff, no LLM. Returns `SchemaChangePreview.noChanges(name, version)` for existing datasource, `SchemaChangePreview.autoApplicable(emptyReport, [])` for new datasource.
- **Python handler**: none. `backend/python/smartbi_compat/api/datasource.py` only ports the two `GET` endpoints (`/fields`, `/history`).
- **PR history**: PR #49 (deferral) per `docs/superpowers/plans/2026-05-01-phase2a-remaining-endpoints-backlog.md` §2.4 — explicitly moved to Phase 3 backlog because Java side has no real implementation.

### M-2 · `GET /api/mobile/{factoryId}/smart-bi/datasource/{datasourceId}/preview`

- **Java handler**: `SmartBIAnalysisController.previewSchemaChanges()` at line 696. Calls `schemaService.previewSchemaChanges(datasourceId)`.
- **Java service body** (`SmartBiSchemaServiceImpl.java:96-105`): `// TODO: 实现从临时存储获取待应用的变更` — always returns `SchemaChangePreview.noChanges(name, version)`.
- **Recorded golden** (`tests/fixtures/java-smartbi-golden/datasource-preview-F999.json`): confirms stub output — `hasChanges: false`, all field arrays empty, `suggestedMappings: []`, `affectedReportsCount: 0`.
- **Python handler**: none.
- **PR history**: PR #45 (deferral) per same backlog §2.4.

### M-3 · `POST /api/mobile/{factoryId}/smart-bi/datasource/apply`

- **Java handler**: `SmartBIAnalysisController.applySchemaChanges()` at line 714. Calls `schemaService.applySchemaChanges(request)`.
- **Java service body** (`SmartBiSchemaServiceImpl.java:107-147`): TODO core (lines 120-123): "执行实际的 Schema 变更 / 验证确认的映射 / 更新字段定义 / 执行 DDL". Actual behavior: only bumps `schema_version` and writes a `smart_bi_schema_history` row whose `oldSchema`/`newSchema` columns get `serializeCurrentSchema(...)` which is itself a stub returning literal `"{}"`.
- **Python handler**: none.
- **PR history**: PR #50 (deferral) per same backlog §2.4.

---

## §4 Frontend usage signal per mismatch

Searched: `web-admin/src/`, `web-admin/src/api/smartbi/`, `frontend/CretasFoodTrace/src/`, `platform/`.

| Mismatch | Search pattern (multiple) | Hits |
|---|---|---|
| M-1 `/datasource/upload` | `datasource/upload`, `datasource.*upload`, `uploadAndDetect`, `previewSchema`, `applySchema`, `schema/preview`, `schema/apply`, `/datasource/` | **0 callers**. Only hit is `web-admin/src/api/smartbi/upload.ts:408` which calls `/datasource/list` (different endpoint, not in mismatch set). |
| M-2 `/datasource/{id}/preview` | `datasource/[^/]+/preview`, `previewSchema` | **0 callers** |
| M-3 `/datasource/apply` | `datasource/apply`, `applySchema` | **0 callers** |

Documentation-only references (audit/spec/plan files) found in `web-admin/backend-api-audit.md`, `docs/superpowers/...` — these are inventories, not live callers.

The real upload UI in `web-admin` calls `POST /upload` and `POST /upload/confirm` (web-admin/src/api/smartbi/upload.ts:354), which are handled by `SmartBIUploadController.java` and continue to land on Java post-cutover (out of T6.4 regex scope).

---

## §5 Prod log signal per mismatch

### Python prod log

- File: `/www/wwwroot/cretas/python-prod.log` (6.2 MB, last write 2026-05-09 09:25 CST, covers full post-T6.4-cutover window since 06:34 CST = ~3 h plus Phase 2A T6.3 traffic from May 8 cutover)
- Total `datasource` hits in window: **1367**, all `GET /datasource/list` (10 sample lines verified — F001, FOOD_3101_001..009 etc.)
- `grep -E '/(upload|apply)' python-prod.log | grep smart-bi` → **0 hits**
- `grep -E 'smart-bi/datasource' | grep -vE 'datasource/list|datasource/[0-9]+/(fields|history)'` → **0 hits**

### Java prod log

- File: `/www/wwwroot/cretas/cretas-prod.log` (current, 631 MB) + 8 rotated archives (`cretas-prod.log-{20260430,01,02,05,06,07,09}.gz` and `archived.20260428.gz`) covering Apr 28 → May 9
- Searched all archives with `zgrep -E '/datasource/(upload|apply)|/datasource/[0-9]+/preview'` → **0 hits across all 9 log files**

### Conclusion

No client has called any of M-1 / M-2 / M-3 in the entire available log window (back to Apr 28 2026). These endpoints have been dead since well before T6.4 cutover.

---

## §6 Severity verdict per mismatch

Severity rubric (per marching order):
- **P0**: frontend calls + prod log shows hits → currently breaking customers
- **P1**: frontend calls but prod log has no hit yet → ticking time bomb
- **P2**: no frontend caller but nginx routes the path → contract risk if a future client expects it
- **P3**: no frontend caller AND no log hit AND likely dead path → low priority

| Mismatch | Frontend | Prod log | Java side actually does work? | **Verdict** |
|---|---|---|---|---|
| M-1 `POST /datasource/upload` | 0 callers | 0 hits (24 h Python + 9 days Java) | No — TODO stub returning empty preview | **P3** |
| M-2 `GET /datasource/{id}/preview` | 0 callers | 0 hits (same) | No — returns `noChanges` envelope | **P3** |
| M-3 `POST /datasource/apply` | 0 callers | 0 hits (same) | No — bookkeeping stub, doesn't execute DDL | **P3** |

These are **dead-stub paths**. The Java reference implementation has `// TODO` markers for every meaningful operation; none of these endpoints have ever produced real schema mutations. The 404 introduced by T6.4 cutover is a no-op behavior change (404 vs empty stub) for clients that don't exist.

---

## §7 Recommendation per mismatch

| Mismatch | Option A — Implement Python (mirror Java stub) | Option B — Add nginx exclude (fall back to Java stub) | Option C — Defer (keep 404) | **Recommended** |
|---|---|---|---|---|
| M-1 `POST /datasource/upload` | ~6-8 h: but mirroring a 3-TODO stub yields useless code; multipart parsing infra burden | ~5 min: extend Block 3 regex to exclude `datasource/(upload\|apply)\|datasource/[^/]+/preview` | 0 effort: 404 stays | **C → eventually B if a real client surfaces** |
| M-2 `GET /datasource/{id}/preview` | ~3-4 h: full mirror including DB datasource lookup and `noChanges` envelope shape, plus golden parity tests | (same nginx tweak) | 0 effort | **C → eventually B** |
| M-3 `POST /datasource/apply` | ~4-6 h: schema_version bump + history row write; dangerous to implement a stub that mutates DB | (same nginx tweak) | 0 effort | **C** (Option A is risky — would silently mutate prod DB without real DDL backing) |

### Recommended bundled action (single PR or skip entirely)

**Skip both A and B for now.** Rationale:

1. The three endpoints have **zero callers** anywhere in the codebase or production traffic.
2. The Java reference implementation is itself a stub — Phase 2A explicitly deferred these in PR #45 / #49 / #50 because there is no real schema-management feature behind them yet.
3. A 404 from Python is **arguably better** than a misleading "success" stub from Java for a feature that doesn't exist — clients who eventually call these will hit a clear error and surface the gap, instead of getting a fake `noChanges` and proceeding.
4. T6.5 Java SmartBI deprecation spec (`docs/superpowers/specs/2026-05-15-t6-5-java-smartbi-deprecation-spec.md`) lists these three endpoints as "ported" — that label is incorrect (they were deferred, not ported); update T6.5 spec when it becomes active.

If a future ticket reintroduces real schema management:
- Re-implement on Python first (`backend/python/smartbi_compat/api/datasource.py`) following Phase 2A `python-java-port.md` Rule set
- Use the existing F999 / F001 goldens (`tests/fixtures/java-smartbi-golden/datasource-{upload-schema,preview,apply}-{F999,F001}.json`) as starting parity references — but note the upload + apply goldens are `_skipped: true` placeholders, so new live recordings against an updated Java service are required.

### Alternative if leadership wants a "no 404" guarantee

Add this exclusion to nginx Block 3 to fall back to Java's harmless stub:

```nginx
# Before (current):
location ~ ^/api/mobile/(...)/smart-bi/(query-templates|datasource|incentive-plan)(/.*)?$ {
    proxy_pass http://cretas_python;
    ...
}

# After (proposed):
location ~ ^/api/mobile/(...)/smart-bi/(query-templates|datasource|incentive-plan)(/.*)?$ {
    # Exclude the three deferred datasource POST/preview endpoints — Python doesn't
    # implement them and Java side is a TODO stub returning noChanges/empty.
    if ($request_uri ~ "/smart-bi/datasource/(upload|apply)(/|\?|$)") { rewrite ^ /__java_fallback last; }
    if ($request_uri ~ "/smart-bi/datasource/[0-9]+/preview(/|\?|$)") { rewrite ^ /__java_fallback last; }
    proxy_pass http://cretas_python;
    include /www/server/panel/vhost/nginx/include/cretas-python-proxy-defaults.conf;
}
location = /__java_fallback {
    proxy_pass http://cretas_backend;
    # ... standard Java proxy headers ...
}
```

But again — this is only worth doing if a client surfaces. Currently no client exists.

---

## Open questions for organizer

1. **Update T6.5 Java SmartBI deprecation spec**? The spec at `docs/superpowers/specs/2026-05-15-t6-5-java-smartbi-deprecation-spec.md` line 63-65 marks these three as `// ported`; this is inaccurate. Recommend correcting to `// deferred per PR #45/#49/#50` to avoid future Java cleanup confusion.
2. **PR #178 audit follow-up**? `docs/qa-audits/2026-05-09-t6-5-phase-a-deletion-candidates.md` §3.1.a should add a "verify Python implementation actually exists" step to its rubric — current `Python ✓` mark is based on the same router file existing, not endpoint-by-endpoint coverage.
3. **Action on the audit**: do nothing, add nginx exclude, or implement Python stubs? My recommendation is "do nothing" — see §7 — but happy to follow either of the other paths if leadership weighs the audit-risk vs feature-deferral trade-off differently.

---

## Sources

- nginx config: `ssh root@139.196.165.140` → `/www/server/panel/vhost/nginx/api.cretaceousfuture.com.conf`
- Java controllers: `backend/java/cretas-api/src/main/java/com/cretas/aims/controller/SmartBI{Analysis,Dashboard,Upload}Controller.java`
- Java service stubs: `backend/java/cretas-api/src/main/java/com/cretas/aims/service/smartbi/impl/SmartBiSchemaServiceImpl.java:57-147`
- Python @router enumeration: `backend/python/smartbi_compat/api/{datasource,analysis,query_templates_write,incentive_plan,dashboard,analysis_*}.py`
- Frontend search: `web-admin/src/`, `frontend/CretasFoodTrace/src/`, `platform/`
- Prod logs: `47.100.235.168:/www/wwwroot/cretas/{python,cretas}-prod.log{,-*.gz}`
- Goldens: `tests/fixtures/java-smartbi-golden/datasource-*.json`
- PR / spec / plan history: `docs/superpowers/plans/2026-05-01-phase2a-remaining-endpoints-backlog.md` §2.4, `docs/superpowers/specs/2026-05-02-phase2a-t6-nginx-cutover-design.md` §O3-O5, `docs/superpowers/specs/2026-05-15-t6-5-java-smartbi-deprecation-spec.md` line 63-65
