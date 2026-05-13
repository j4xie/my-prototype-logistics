# T6.6.3b Canary — Rollback Procedure (≤45s)

Mirror of `tests/qa-t6-6-3a/rollback-procedure.md`. Backup suffix `t6-6-3b` keeps this PR's rollback **independent** of 3a's — restoring 3b does NOT touch the 3a R_ILTEATRO_REAL routing.

## When to roll back

- 5xx rate > 2% on `R_QINGHUAJIAO_REAL/analysis/(production|quality)` for 5 min
- Python `NotImplementedError` for R_QINGHUAJIAO_REAL on either endpoint
- P1 customer report from 青花椒 (川菜)
- Steve direct command

## Rollback (copy/paste from a 139 SSH session)

```bash
# Backup suffix `t6-6-3b` so this stays isolated from `t6-6-3a` backups.
TS=$(ls -1t /www/server/panel/vhost/nginx/api.cretaceousfuture.com.conf.bak.t6-6-3b.* | head -1 | sed 's/.*\.t6-6-3b\.//')
echo "Restoring T6.6.3b backups from $TS"

cp /www/server/panel/vhost/nginx/api.cretaceousfuture.com.conf.bak.t6-6-3b.$TS  /www/server/panel/vhost/nginx/api.cretaceousfuture.com.conf
cp /www/server/panel/vhost/nginx/web-admin.conf.bak.t6-6-3b.$TS                  /www/server/panel/vhost/nginx/web-admin.conf

nginx -t && nginx -s reload
echo "rollback complete — R_QINGHUAJIAO_REAL back to Java; R_ILTEATRO_REAL (3a) still on Python"
```

After restoration:
- R_QINGHUAJIAO_REAL/analysis/(production|quality) → Java (pre-3b state)
- R_ILTEATRO_REAL/analysis/(production|quality) → Python (3a unchanged)
- F006/* → Java (unchanged)
- Other Phase 2A routes → unchanged

## Verify rollback

From 139 (curl loopback resolve):

```bash
curl -sk --resolve api.cretaceousfuture.com:443:127.0.0.1 -o /dev/null -w "HTTP=%{http_code} size=%{size_download}\n" \
  "https://api.cretaceousfuture.com/api/mobile/R_QINGHUAJIAO_REAL/smart-bi/analysis/production?startDate=2026-01-01&endDate=2026-01-31&analysisType=overview"
# Expect: HTTP=401 size=188 (Java envelope shape — back to pre-3b state)
```

Then on 47, confirm no NEW python access-log entry for R_QINGHUAJIAO_REAL/production in the last 30s after rollback:

```bash
tail -10 /www/wwwroot/cretas/python-prod.log | grep R_QINGHUAJIAO_REAL || echo 'NO post-rollback Python hits — rollback OK'
```

## Why rollback is safe

- Same volume as the originals — instant `cp`.
- `nginx -s reload` is hot — no connection drops, graceful worker handoff.
- Pre-3b path (Java) was fully healthy throughout 3b; nothing to "restart".
- Python service stays running independent of routing.

## Sequence of recoverable states

| State | api 3a | api 3b | web 3a | web 3b | Description |
|---|---|---|---|---|---|
| pre-3a | absent | absent | absent | absent | original prod, pre-PR #526 |
| after-3a-rollback | absent | absent | absent | absent | restore 3a backup if 3a too is bad |
| after-3b-rollback | present | absent | present | absent | current 3a state, this PR rolled back |
| current (post-3b-reload) | present | present | present | present | 3a+3b both LIVE |
