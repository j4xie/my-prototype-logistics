# T6.6.3a Canary — Rollback Procedure (≤45s)

Mirrors `docs/runbooks/2026-05-14-t6-6-3a-cutover-rollback.md`. This file is the operator quick-card.

## When to roll back

- 5xx rate > 2% on R_ILTEATRO_REAL `/analysis/(production|quality)` for 5 min
- Python `NotImplementedError` for R_ILTEATRO_REAL on either endpoint
- P1 customer report
- Steve direct command

## Rollback (copy/paste from a 139 SSH session)

```bash
# Each apply produces ONE shared timestamp; both vhost backups carry the same suffix.
TS=$(ls -1t /www/server/panel/vhost/nginx/api.cretaceousfuture.com.conf.bak.t6-6-3a.* | head -1 | sed 's/.*\.t6-6-3a\.//')

echo "Restoring T6.6.3a backups from $TS"
cp /www/server/panel/vhost/nginx/api.cretaceousfuture.com.conf.bak.t6-6-3a.$TS  /www/server/panel/vhost/nginx/api.cretaceousfuture.com.conf
cp /www/server/panel/vhost/nginx/web-admin.conf.bak.t6-6-3a.$TS                  /www/server/panel/vhost/nginx/web-admin.conf

nginx -t && nginx -s reload
echo "rollback complete — Java restored as upstream for R_ILTEATRO_REAL/(production|quality)"
```

## Verify rollback

From 139 (curl loopback resolve):

```bash
curl -sk --resolve api.cretaceousfuture.com:443:127.0.0.1 -o /dev/null -w "HTTP=%{http_code}\n" \
  "https://api.cretaceousfuture.com/api/mobile/R_ILTEATRO_REAL/smart-bi/analysis/production?startDate=2026-01-01&endDate=2026-01-31&analysisType=overview"
```

Then on 47, confirm no NEW python access-log entry for R_ILTEATRO_REAL/production in the last 30s:

```bash
date -d '30 seconds ago' '+%Y-%m-%d %H:%M:%S'   # window start reference
tail -10 /www/wwwroot/cretas/python-prod.log | grep R_ILTEATRO_REAL || echo 'NO post-rollback Python hits — rollback OK'
```
