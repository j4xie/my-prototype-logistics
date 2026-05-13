# T6.6.3b Canary — `R_QINGHUAJIAO_REAL` Routing Evidence

**Apply timestamp**: `20260514_031948` (UTC: 2026-05-13T19:19:48Z)
**Reload time**: 2026-05-13T19:21:48Z
**Vhost files changed**: 2 (`api.cretaceousfuture.com.conf` + `web-admin.conf`)
**Active-E2E gate**: response body shape + Python access-log presence

## Verification strategy

Same as 3a: Java (47:10020 ACTIVE) and Python (47:8083) both return 401 for unauth, but emit different envelopes for the NEW production/quality endpoints. Routing verified by **body size** + **Python access log presence**.

The 401 envelope shape divergence on `/analysis/production` + `/analysis/quality` is tracked separately in **issue #530** (P2, non-blocking). T6.6.3b's task is only to verify routing.

## Probe matrix (post-reload, 2026-05-13T19:21:48Z onward)

| # | Request | HTTP | size | Body fingerprint | Python log entry | Verdict |
|---|---|---|---|---|---|---|
| 1 | `R_QINGHUAJIAO_REAL/analysis/production` | 401 | 96 | `{"success": false, "message": "Missing or invalid Authorization header", "code": "UNAUTHORIZED"}` | ✓ logged | **PASS — Python** |
| 2 | `R_QINGHUAJIAO_REAL/analysis/quality` | 401 | 96 | (same Python shape) | ✓ logged | **PASS — Python** |
| 3 | `F006/analysis/production` (regression) | 401 | 188 | `{"success":false,"code":401,"message":"未授权，请先登录","severity":"error","actionHint":"...","timestamp":"..."}` | ✗ absent | **PASS — Java (no regression)** |
| 4 | `R_ILTEATRO_REAL/analysis/production` (3a sanity) | 401 | 96 | (Python shape) | ✓ logged | **PASS — 3a still LIVE** |

All 4 probes succeed:
- R_QINGHUAJIAO_REAL cut over to Python for production+quality ✓
- F006 factory tenant unaffected (still Java) ✓
- R_ILTEATRO_REAL (3a tenant) **still routing to Python** — 3b block did not regress 3a ✓

## Raw curl output

```text
=== nginx -s reload ===
nginx: [warn] "ssl_stapling" ignored, no OCSP responder URL in the certificate "/www/server/panel/vhost/cert/centerapi.cretaceousfuture.com.pem"
=== reload OK; T6.6.3b canary is LIVE (3a+3b both active) ===

MARK=2026-05-13T19:21:48 (Python access-log grep window start)

=== Probe 1: R_QINGHUAJIAO_REAL /analysis/production (expect Python) ===
HTTP=401 size=96 ttfb=0.019275s

=== Probe 2: R_QINGHUAJIAO_REAL /analysis/quality (expect Python) ===
HTTP=401 size=96 ttfb=0.014832s

=== Probe 3: F006 /analysis/production (factory regression — expect Java) ===
HTTP=401 size=188 ttfb=0.017452s

=== Probe 4: R_ILTEATRO_REAL /analysis/production (3a sanity — expect Python) ===
HTTP=401 size=96 ttfb=0.014300s
```

## Probe bodies (shape confirmation)

```text
--- Probe 1 (R_QINGHUAJIAO_REAL /production, Python shape) ---
{"success": false, "message": "Missing or invalid Authorization header", "code": "UNAUTHORIZED"}

--- Probe 3 (F006 /production, Java envelope) ---
{"success":false,"code":401,"message":"未授权，请先登录","severity":"error","actionHint":"会话已过期或未登录, 请重新登录","timestamp":"2026-05-14T03:21:48.920141028"}
```

## Raw Python log tail (post-reload window)

```text
INFO:     139.196.165.140:60490 - "GET /api/mobile/R_QINGHUAJIAO_REAL/smart-bi/analysis/production?...&analysisType=overview HTTP/1.1" 401 Unauthorized
INFO:     139.196.165.140:60490 - "GET /api/mobile/R_QINGHUAJIAO_REAL/smart-bi/analysis/quality?...&analysisType=overview HTTP/1.1" 401 Unauthorized
INFO:     139.196.165.140:60490 - "GET /api/mobile/R_ILTEATRO_REAL/smart-bi/analysis/production?...&analysisType=overview HTTP/1.1" 401 Unauthorized
INFO:     139.196.165.140:60490 - "GET /api/mobile/R_QINGHUAJIAO_REAL/smart-bi/analysis/production?...&analysisType=overview HTTP/1.1" 401 Unauthorized
```

## Unrelated pre-existing finding (informational)

The Python log also contains a pre-existing SmartBI gold-layer ETL error for R_QINGHUAJIAO_REAL:

```text
2026-05-14 03:20:08,225 - smartbi.gold.restaurant_ops_etl - ERROR - [-] - [etl] gold materialize failed for R_QINGHUAJIAO_REAL
2026-05-14 03:20:08,225 - main - WARNING - [-] - [restaurant-etl] R_QINGHUAJIAO_REAL errors=['gold: syntax error at or near ":"']
```

This predates the T6.6.3b cutover (timestamps 03:20 — before reload at 03:21:48Z) and concerns the periodic gold-layer materialization ETL, not the analysis endpoints. Out of scope for T6.6.3b; recommend a separate ticket for the SmartBI gold ETL syntax error.

## Web-admin smoke

**SKIPPED** — R_QINGHUAJIAO_REAL has 0 active users in `cretas_prod_db.users`. The MO assumed `qhj_prod / 123456` belongs to R_QINGHUAJIAO_REAL but DB verification shows `qhj_prod` is actually a RES_3101_009 user. Without an R_QINGHUAJIAO_REAL user, login is not possible.

```text
$ psql -d cretas_prod_db -c "SELECT username FROM users WHERE factory_id='R_QINGHUAJIAO_REAL'"
 (0 rows)

$ psql -d cretas_prod_db -c "SELECT factory_id FROM users WHERE username='qhj_prod'"
RES_3101_009
```

See `restaurant-tenants.txt` for the full reconciliation. Same situation as 3a; web smoke deferred for organizer follow-up.

## Rollback

See `rollback-procedure.md`. Backups:

- `/www/server/panel/vhost/nginx/api.cretaceousfuture.com.conf.bak.t6-6-3b.20260514_031948`
- `/www/server/panel/vhost/nginx/web-admin.conf.bak.t6-6-3b.20260514_031948`

Restoring these returns prod to **3a-only** state (R_ILTEATRO_REAL still on Python; R_QINGHUAJIAO_REAL back to Java).
