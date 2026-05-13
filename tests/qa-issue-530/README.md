# Issue #530 — 401 Envelope Parity Evidence

PR: `fix/issue-530-auth-envelope-parity` (close #530).

## Root cause

The 401 emitted on the 3 in-scope endpoints does NOT come from
`smartbi_compat/api/analysis_*.py` `Depends(require_analytics_read)` as the
issue body hypothesized — it comes from the global ASGI
`JWTAuthMiddleware` at `backend/python/auth_middleware.py:163-181`, which
short-circuits BEFORE the FastAPI dependency chain runs whenever the
`Authorization` header is missing or the Bearer token is invalid.

The middleware previously emitted a 96-byte 3-field shape with a string
`code` for every protected route. The fix branches the middleware on path
prefix so only the 3 endpoints chat2 verified during T6.6.3a/b/c (PR #526
+ #536 + #543) get the Java-mirrored 188-byte 6-field shape; sister
endpoints stay on the legacy shape until a separate sweep widens scope.

## Java reference

`backend/java/cretas-api/src/main/java/com/cretas/aims/config/JwtAuthInterceptor.java:259-273`
emits the canonical shape via a `LinkedHashMap`:

```
{"success":false,"code":401,"message":"未授权，请先登录","severity":"error","actionHint":"会话已过期或未登录, 请重新登录","timestamp":"..."}
```

Field order (success, code, message, severity, actionHint, timestamp),
int `code`, raw UTF-8 Chinese, ISO LocalDateTime timestamp without
timezone marker.

## Files

| File | Purpose |
|---|---|
| `capture_envelope_bytes.py` | TestClient harness that hits in-scope + out-of-scope paths and prints raw 401 bytes |
| `before-after-curl-diff.txt` | Captured output from a 2026-05-13 local run — 4 stanzas: 3 in-scope (AFTER) + 1 out-of-scope (BEFORE shape, intentionally unchanged) |

## Reproduce

```
cd backend/python
python ../../tests/qa-issue-530/capture_envelope_bytes.py
```

## Observed bytes

| Path | Bytes | Code field | Content-Type |
|---|---|---|---|
| `…/analysis/production` (in-scope, AFTER) | 185 | `401` (int) | `application/json; charset=utf-8` |
| `…/analysis/quality`    (in-scope, AFTER) | 185 | `401` (int) | `application/json; charset=utf-8` |
| `…/analysis/finance`    (in-scope, AFTER) | 185 | `401` (int) | `application/json; charset=utf-8` |
| `…/analysis/region`     (out-of-scope, unchanged) | 96 | `"UNAUTHORIZED"` (str) | `application/json` |

185 vs the issue-body claim of 188 is the timestamp-precision difference
between Python `datetime.now().isoformat()` (6-digit microseconds, no
trailing-zero suppression) and Java `LocalDateTime.now().toString()`
(up-to-9-digit nanoseconds with trailing-zero suppression). Both are ISO
LocalDateTime shapes, which is what the customer frontend axios
interceptor parses; the byte difference is non-semantic.

## Unit + integration coverage

`backend/python/tests/test_smartbi_401_envelope_parity.py` — 41 tests:
- 7 unit tests on `build_unauthorized_body()` (field order, int code,
  Chinese default, severity, actionHint, ISO timestamp shape, success=false)
- 16 unit tests on `is_smartbi_java_envelope_path()` (8 in-scope + 8
  out-of-scope including sister analysis routes, dashboard, health, OTA)
- 12 integration tests via TestClient (6 in-scope paths × 2 — missing
  Bearer and malformed Bearer)
- 1 byte-shape test (compact JSON, no `": "` / `", "` between tokens,
  raw UTF-8 Chinese rather than `\uXXXX` escapes)
- 5 regression tests asserting sister `/analysis/{region,sales,
  procurement,inventory,department}` keep the legacy 96-byte shape
