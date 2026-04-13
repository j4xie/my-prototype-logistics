# Cretas Nginx Vhost Reference

The nginx vhosts on `139.196.165.140` are managed by Baota and **NOT committed
to git**. This document records the **correct** upstream pattern all Cretas
vhosts MUST follow so blue-green deploys work.

## The rule

**All vhosts that proxy to the Cretas Java backend MUST use `http://cretas_backend/...`**
(the named upstream defined in `_upstream_cretas.conf`). NEVER hardcode
`http://47.100.235.168:10010/` or `:10020/` in a vhost — that breaks during
blue-green swaps.

Why: `deploy-backend.sh v5.0` blue-green orchestration rewrites the `server`
line inside `_upstream_cretas.conf` during cutovers. Any vhost that reads
from that upstream follows the swap automatically. Vhosts that hardcode the
port stay pointed at whichever port was "winning" when they were written, and
break the first time blue-green cuts over.

## Correct pattern

```nginx
# 1. _upstream_cretas.conf (auto-managed — DO NOT edit directly)
upstream cretas_backend {
    server 47.100.235.168:10010;  # or 10020; rewritten during BG swaps
    keepalive 32;
}

# 2. Any vhost proxying Cretas API:
location /api/mobile/ {
    proxy_pass http://cretas_backend/api/mobile/;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_http_version 1.1;
    proxy_set_header Connection "";
}

location /api/public/ {
    proxy_pass http://cretas_backend/api/public/;
    # (same headers)
}
```

## Anti-pattern (DO NOT do this)

```nginx
location /api/mobile/ {
    proxy_pass http://47.100.235.168:10010/api/mobile/;  # HARDCODED — breaks during BG swaps
}
```

## Current status (as of 2026-04-11)

| Vhost | Config file on 139 | Status |
|---|---|---|
| `api.cretaceousfuture.com` | `api.cretaceousfuture.com.conf` | ✅ Uses `http://cretas_backend/` |
| `www.cretaceousfuture.com` | `www.cretaceousfuture.com.conf` | ✅ Fixed 2026-04-11 (this doc) |
| `web-admin` | `web-admin.conf` | N/A — proxies to Python not Cretas Java |
| `centerapi.cretaceousfuture.com` | `java_logistics-admin.conf` | N/A — proxies to Mall admin not Cretas |

## Re-applying after a Baota regenerate

If Baota regenerates `www.cretaceousfuture.com.conf` or a server rebuild
restores an old version, the 2 `proxy_pass` lines will revert to hardcoded
port. Fix:

```bash
ssh root@139.196.165.140
# Backup first
cp /www/server/panel/vhost/nginx/www.cretaceousfuture.com.conf \
   /www/server/panel/vhost/nginx/www.cretaceousfuture.com.conf.bak.$(date +%Y%m%d_%H%M%S)

# Rewrite both hardcoded lines
sed -i \
  -e 's|proxy_pass http://47.100.235.168:10010/api/mobile/|proxy_pass http://cretas_backend/api/mobile/|' \
  -e 's|proxy_pass http://47.100.235.168:10010/api/public/|proxy_pass http://cretas_backend/api/public/|' \
  /www/server/panel/vhost/nginx/www.cretaceousfuture.com.conf

# Verify
nginx -t && nginx -s reload
curl -s -o /dev/null -w "%{http_code}\n" https://www.cretaceousfuture.com/api/mobile/health
# Expected: 200
```

## Related

- `scripts/deploy/nginx-scanner-blocklist.conf` — scanner blocklist snapshot (Phase 2 of error-log-hygiene)
- `scripts/deploy/deploy-backend.sh` — blue-green orchestration that manages `_upstream_cretas.conf`
- `docs/superpowers/plans/2026-04-11-nginx-upstream-migration-audit.md` — parent plan
