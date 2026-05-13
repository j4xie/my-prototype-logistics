# T6.6.3c Full Cascade — Tenant Sample Matrix

**Apply timestamp**: `20260514_033550` (UTC 2026-05-13T19:35:50Z)
**Reload time**: 2026-05-13T19:36:45Z
**Active-E2E window MARK**: 2026-05-13T19:37:05Z
**Vhost files changed**: 2 (api.cretaceousfuture.com.conf + web-admin.conf)
**Cutover regex**: `^/api/mobile/(R_[^/]+|RES_[^/]+|R[0-9]+)/smart-bi/analysis/(production|quality)(/.*)?$` → Python

---

## Probe matrix — 14 restaurant tenant probes (7 tenants × 2 endpoints)

All probes via `curl -sk --resolve api.cretaceousfuture.com:443:127.0.0.1 ...` (loopback HTTPS).
Unauthenticated 401 is the routing fingerprint (Python emits **96 B** short envelope vs Java's **188 B** mirrored envelope; tracked in issue #530 P2).

| # | Tenant | DB id | Endpoint | HTTP | size | Verdict | New coverage? |
|---|---|---|---|---|---|---|---|
| 1 | IL TEATRO 西餐 | `R_ILTEATRO_REAL` | /production | 401 | 96 | PASS Python | (T6.6.3a, preserved) |
| 2 | IL TEATRO 西餐 | `R_ILTEATRO_REAL` | /quality | 401 | 96 | PASS Python | (T6.6.3a, preserved) |
| 3 | 青花椒 | `R_QINGHUAJIAO_REAL` | /production | 401 | 96 | PASS Python | (T6.6.3b, preserved) |
| 4 | 青花椒 | `R_QINGHUAJIAO_REAL` | /quality | 401 | 96 | PASS Python | (T6.6.3b, preserved) |
| 5 | 东门口 | `R_DONGMENKOU_REAL` | /production | 401 | 96 | **PASS Python** | **NEW (3c-only)** |
| 6 | 东门口 | `R_DONGMENKOU_REAL` | /quality | 401 | 96 | **PASS Python** | **NEW (3c-only)** |
| 7 | 桂满陇 江浙菜 | `R_GML_DEMO` | /production | 401 | 96 | **PASS Python** | **NEW (3c-only)** |
| 8 | 桂满陇 江浙菜 | `R_GML_DEMO` | /quality | 401 | 96 | **PASS Python** | **NEW (3c-only)** |
| 9 | QHJ_PROD | `RES_3101_009` | /production | 401 | 96 | **PASS Python** | **NEW (3c-only)** |
| 10 | QHJ_PROD | `RES_3101_009` | /quality | 401 | 96 | **PASS Python** | **NEW (3c-only)** |
| 11 | 白垩纪示范餐厅 | `R001` | /production | 401 | 96 | **PASS Python** | **NEW (3c-only, R\d+ pattern)** |
| 12 | 白垩纪示范餐厅 | `R001` | /quality | 401 | 96 | **PASS Python** | **NEW (3c-only, R\d+ pattern)** |
| 13 | (test) | `RES_GML_001` | /production | 401 | 96 | **PASS Python** | **NEW (3c-only, RES_* pattern)** |
| 14 | (test) | `RES_GML_001` | /quality | 401 | 96 | **PASS Python** | **NEW (3c-only, RES_* pattern)** |

All 14 confirmed via Python access log on 47 (`/www/wwwroot/cretas/python-prod.log`).

## Authenticated smoke — RES_3101_009 via qhj_prod (real user)

Logged in via `POST /api/mobile/auth/unified-login` (factory_super_admin role).

| Probe | HTTP | size | Body summary |
|---|---|---|---|
| `GET /api/mobile/RES_3101_009/smart-bi/analysis/production?...&analysisType=overview` | **200** | 902 | `{"code":200,"message":"操作成功","data":{"tenantType":"RESTAURANT","overview":{"summary":"Restaurant production analytics (RES_3101_009)",...}}}` |
| `GET /api/mobile/RES_3101_009/smart-bi/analysis/quality?...&analysisType=overview` | **200** | 888 | `{"code":200,"message":"操作成功","data":{"tenantType":"RESTAURANT","overview":{"summary":"Restaurant quality analytics (RES_3101_009)",...}}}` |

Both responses confirm:
- Python correctly routes to **restaurant** code path (`tenantType":"RESTAURANT"`)
- Response envelope mirrors Java's `{code, message, data}` shape for 200 OK
- Real data (or `dataAvailability` marker for missing data sources) is returned

Python access log confirms (excerpt):

```text
INFO:     139.196.165.140:44448 - "GET /api/mobile/RES_3101_009/smart-bi/analysis/production?...&analysisType=overview HTTP/1.1" 200 OK
INFO:     139.196.165.140:44448 - "GET /api/mobile/RES_3101_009/smart-bi/analysis/quality?...&analysisType=overview HTTP/1.1" 200 OK
```

This is **stronger evidence than the unauth 401 routing signature** — confirms the full Python production+quality dispatch + handler works end-to-end against a real prod-DB tenant.

## Web-admin UI smoke (deferred with rationale)

The web-admin SPA (Vue + Element Plus, served by web-admin.conf on 139:8086) was scanned for code paths that call `/api/mobile/{factoryId}/smart-bi/analysis/(production|quality)`:

```bash
$ grep -rlE "analysis/production|analysis/quality" web-admin/src/  # 0 hits
$ grep -rE "smart-bi.*production|smart-bi.*quality" web-admin/src/  # only ProductionAnalysis.vue, which calls /smart-bi/production-analysis/{dashboard,data} (different paths)
```

**The current web-admin SPA does NOT call the T6.6 cutover endpoints.** These are consumed by:
- The Cretas mobile app (RN, separate frontend)
- Future web-admin pages not yet built
- Direct API consumers

Therefore a UI smoke would only verify general login/render, not the specific T6.6.3c routing change. The authenticated curl smoke above is **direct evidence** of the cutover working end-to-end with a real user. Deferred without value loss.

## Phase 2A finance reference (unchanged)

| Probe | HTTP | size | Body | Verdict |
|---|---|---|---|---|
| `R_ILTEATRO_REAL/analysis/finance` | 401 | 188 | Java-mirror | PASS (existing Phase 2A route unaffected) |
| `F006/analysis/finance` | 401 | 96 | Python short shape (parity quirk on factory tenant path) | (informational, pre-existing, NOT a 3c regression) |

The F006 /finance 96 B response is the same Python parity gap identified in issue #530 — Python's `/analysis/finance` handler for **factory** tenants uses a different auth dependency than the **restaurant** path. This predates T6.6.3c and is not in scope.
