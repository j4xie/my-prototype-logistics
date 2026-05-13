# T6.6.3a Canary Cutover — Rollback Runbook

**Date applied**: 2026-05-14
**Branch / PR**: `ops/t6-6-3a-r-ilteatro-canary` / TBD
**Spec**: [`docs/superpowers/specs/2026-05-11-t6-6-cutover-spec.md`](../superpowers/specs/2026-05-11-t6-6-cutover-spec.md) §3.3 + §4.2
**Operator**: chat2 (organizer-dispatched)

---

## What changed

Single tenant `R_ILTEATRO_REAL` was added to the nginx routing whitelist for two endpoints:

- `/api/mobile/R_ILTEATRO_REAL/smart-bi/analysis/production(/...)` → cretas_python (47:8083)
- `/api/mobile/R_ILTEATRO_REAL/smart-bi/analysis/quality(/...)` → cretas_python (47:8083)

Applied to **both** vhosts:

- `/www/server/panel/vhost/nginx/api.cretaceousfuture.com.conf` (customer mobile, 443)
- `/www/server/panel/vhost/nginx/web-admin.conf` (internal port 8086)

All other tenants and other endpoints are **unchanged**. No code, no DB, no Java/Python restart.

---

## Rollback trigger conditions

Roll back immediately on any one of:

| Metric | Threshold | Window | How to detect |
|---|---|---|---|
| `R_ILTEATRO_REAL` 5xx rate on the two new endpoints | > 2% | 5 min | grep `/api/mobile/R_ILTEATRO_REAL/smart-bi/analysis/(production|quality)` in `/www/wwwlogs/api.cretaceousfuture.com.log` for ` 5\d\d ` status |
| Python `NotImplementedError` for R_ILTEATRO_REAL | any | any | `grep NotImplementedError /www/wwwroot/cretas/python-prod.log` |
| Latency P99 > 3000ms on the two endpoints | sustained | 5 min | nginx upstream timing (would need temporary log_format with upstream_response_time) |
| User-reported critical bug from IL TEATRO | severity ≥ P1 | any | bug tracker / direct ping |

Java fallback rate is NOT a rollback trigger — by design only R_ILTEATRO_REAL is routed to Python; everything else hits Java as before.

---

## Rollback procedure (~35-45s recovery)

```bash
ssh root@139.196.165.140

# 1. Find the timestamped backups (one per vhost, both produced by the apply script)
TS=$(ls -1t /www/server/panel/vhost/nginx/api.cretaceousfuture.com.conf.bak.t6-6-3a.* | head -1 | awk -F.bak.t6-6-3a. '{print $2}')
echo "Restoring from timestamp: $TS"

# 2. Restore both vhosts from backup
cp /www/server/panel/vhost/nginx/api.cretaceousfuture.com.conf.bak.t6-6-3a.$TS \
   /www/server/panel/vhost/nginx/api.cretaceousfuture.com.conf
cp /www/server/panel/vhost/nginx/web-admin.conf.bak.t6-6-3a.$TS \
   /www/server/panel/vhost/nginx/web-admin.conf

# 3. Test + reload
nginx -t && nginx -s reload

# 4. Verify rollback — R_ILTEATRO_REAL traffic should be back on Java
curl -sk --resolve api.cretaceousfuture.com:443:127.0.0.1 \
  "https://api.cretaceousfuture.com/api/mobile/R_ILTEATRO_REAL/smart-bi/analysis/production?startDate=2026-01-01&endDate=2026-01-31&analysisType=overview" \
  -o /dev/null -w "HTTP=%{http_code}\n"

# Pre-rollback baseline (Java) returned `HTTP=401` with the standard envelope
# `{"success":false,"code":401,"message":"未授权，请先登录",...}`. After rollback,
# this should still return 401 BUT — verify on the Python access log that no
# new entries appear post-rollback:
ssh root@47.100.235.168 \
  "tail -5 /www/wwwroot/cretas/python-prod.log | grep R_ILTEATRO_REAL || echo 'no recent Python hits — rollback OK'"
```

Estimated recovery: ~35-45s from rollback decision to running on Java again.

---

## Why rollback is safe

- Backups are taken as filename suffixes on the same volume — no network round-trip needed.
- `nginx -s reload` is hot — master process keeps serving prior workers' requests while new workers spawn with restored config. No connection drops.
- Pre-cutover Java path is still healthy (nothing was deployed/restarted on the Java side).
- Python service itself remains running and healthy independent of routing.

---

## What rollback does NOT undo

- The repo PR (if merged) still reflects the canary block in `ops/nginx-vhosts-139/*.conf`. After rollback, either:
  - (a) Revert the PR on `main` and re-deploy fresh
  - (b) Leave the repo state and apply rollback only on prod, document in this runbook + tracker

---

## Audit trail

| When | Who | Action | Evidence |
|---|---|---|---|
| 2026-05-14 \<TBD\> | chat2 | Apply T6.6.3a to api + web-admin | `tests/qa-t6-6-3a/before-after-curl-matrix.md` |
| 2026-05-14 \<TBD\> | chat2 | Active-E2E verify R_ILTEATRO_REAL Python + F006 Java + finance still Python | `tests/qa-t6-6-3a/r-ilteatro-evidence.md`, `factory-no-regression.txt` |
| 2026-05-14 \<TBD\> | chat2 | Web smoke (deferred — no R_ILTEATRO_REAL user) | (skipped) |
