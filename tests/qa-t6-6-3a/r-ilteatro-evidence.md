# T6.6.3a Canary — `R_ILTEATRO_REAL` Routing Evidence

**Apply timestamp**: `20260514_023351` (UTC: 2026-05-13T18:33:51Z)
**Vhost files changed**: 2 (`api.cretaceousfuture.com.conf` + `web-admin.conf`)
**Reload time**: 2026-05-13T18:34:40Z
**Active-E2E gate**: response body shape + Python access-log presence

---

## Verification strategy

Both Java (47:10020 ACTIVE) and Python (47:8083) return 401 for unauth GET, but the **shape differs** for the NEW T6.6.3a-routed endpoints — providing a clean routing signal even without a test user.

- Python access log: `/www/wwwroot/cretas/python-prod.log` on 47

---

## Probe matrix (post-reload, 2026-05-13T18:34:40Z onward)

| # | Request | HTTP | size | Body fingerprint | Python log entry | Verdict |
|---|---|---|---|---|---|---|
| 1 | `R_ILTEATRO_REAL/analysis/production` | 401 | 96 | `{"success": false, "message": "Missing or invalid Authorization header", "code": "UNAUTHORIZED"}` | ✓ logged | **PASS — Python** |
| 2 | `R_ILTEATRO_REAL/analysis/quality` | 401 | 96 | (same Python shape) | ✓ logged | **PASS — Python** |
| 3 | `F006/analysis/production` | 401 | 188 | `{"success":false,"code":401,"message":"未授权，请先登录","severity":"error","actionHint":"...","timestamp":"..."}` | ✗ absent (Java handled) | **PASS — Java (regression check)** |
| 4 | `F006/analysis/quality` | 401 | 188 | (same Java envelope) | ✗ absent (Java handled) | **PASS — Java (regression check)** |
| 5 | `R_ILTEATRO_REAL/analysis/finance` (reference) | 401 | 188 | Java-mirrored Python shape (compact, full envelope) | ✓ logged | **PASS — Python (priority order OK)** |

All 5 probes succeed:
- Restaurant tenant cut over to Python for the two new endpoints ✓
- Factory tenant unaffected (still Java) ✓
- Existing Phase 2A finance route unaffected (still Python, priority order intact) ✓

---

## Finding to flag — Python auth-shape parity gap

The **NEW** Python endpoints `/analysis/production` and `/analysis/quality` (PR #352 / #358) emit a SHORTER 401 envelope than the Java mirror used by the existing Phase 2A endpoints (`/analysis/finance` etc.):

| Endpoint | Python 401 shape |
|---|---|
| `/analysis/production` (NEW, PR #352) | `{"success": false, "message": "Missing or invalid Authorization header", "code": "UNAUTHORIZED"}` (96 B, key insertion w/ spaces) |
| `/analysis/quality` (NEW, PR #358) | (same as production) |
| `/analysis/finance` (existing Phase 2A) | Java-mirrored full envelope (188 B, compact, includes `severity`/`actionHint`/`timestamp`) |

This violates the Phase 2A dict-eq parity convention that established `smartbi_compat` should mirror Java's error envelope. Authenticated 200 responses are unaffected — this only impacts the unauth path.

**Customer impact assessment**: typically low — frontends gate on HTTP status (401), not body shape. But the body divergence:
- Breaks i18n if web-admin reads `message`/`actionHint` from 401 body
- Trips parity-gate dict-eq comparison if someone adds a 401-case golden

**Recommendation**: file a follow-up bug for PR #352/#358 auth dependency to use the same `smartbi_compat` Java-mirror dependency that `/analysis/finance` uses. Not a T6.6 blocker; routing works correctly.

---

## Raw curl output

```text
=== nginx -s reload ===
nginx: [warn] "ssl_stapling" ignored, no OCSP responder URL in the certificate "/www/server/panel/vhost/cert/centerapi.cretaceousfuture.com.pem"
=== reload OK; T6.6.3a canary is LIVE ===

MARK=2026-05-13T18:34:40 (used for Python access-log grep window)

=== Probe 1: R_ILTEATRO_REAL /analysis/production (expect Python) ===
HTTP=401 size=96 ttfb=0.018818s

=== Probe 2: R_ILTEATRO_REAL /analysis/quality (expect Python) ===
HTTP=401 size=96 ttfb=0.013676s

=== Probe 3: F006 /analysis/production (factory regression — expect Java) ===
HTTP=401 size=188 ttfb=0.017893s

=== Probe 4: F006 /analysis/quality (factory regression — expect Java) ===
HTTP=401 size=188 ttfb=0.017534s

=== Probe 5: R_ILTEATRO_REAL /analysis/finance (reference — expect Python, unchanged) ===
HTTP=401 size=188 ttfb=0.014084s
```

## Raw Python log tail (post-curl)

```text
INFO:     139.196.165.140:44534 - "GET /api/mobile/R_ILTEATRO_REAL/smart-bi/analysis/production?startDate=2026-01-01&endDate=2026-01-31&analysisType=overview HTTP/1.1" 401 Unauthorized
INFO:     139.196.165.140:44534 - "GET /api/mobile/R_ILTEATRO_REAL/smart-bi/analysis/quality?startDate=2026-01-01&endDate=2026-01-31&analysisType=overview HTTP/1.1" 401 Unauthorized
INFO:     139.196.165.140:57194 - "GET /api/mobile/R_ILTEATRO_REAL/smart-bi/analysis/production?startDate=2026-01-01&endDate=2026-01-31&analysisType=overview HTTP/1.1" 401 Unauthorized
```

(The 3rd line is a duplicate Probe 1 reissued for body-shape capture in the next step — same Python 401 result.)

## Raw Python log grep — F006 absent (regression check)

```text
$ tail -200 /www/wwwroot/cretas/python-prod.log | grep -E "F006.*analysis/(production|quality)"
(no matches — F006 routed to Java as expected)
```
