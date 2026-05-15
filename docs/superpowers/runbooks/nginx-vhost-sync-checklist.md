# Nginx vhost sync — shared include architecture (post 2026-05-15)

## 现在 (post 2026-05-15)

3 vhost 都 `include /www/server/nginx/conf/snippets/smart-bi-routing.conf` — **single source of truth, drift impossible**.

修改 SmartBI Python 路由:
1. 编辑 `/www/server/nginx/conf/snippets/smart-bi-routing.conf` — 加/改/删 location block
2. `nginx -t && nginx -s reload`
3. 3-curl smoke 验证 (见下方 [验证 section](#verification))

**不要再编辑** 3 vhost 内的 routing — 它们只有 `include` 一行。如果未来加新 SmartBI 路由组 (e.g. /smart-bi/foo), 加到 snippet 文件即可。

**额外发现** (2026-05-15): `api.cretaceousfuture.com` DNS 实际**不存在** (NXDOMAIN). 这个 vhost 配置存在但无客户访问。include 仍配置, 未来 DNS 一旦添加立刻生效。当前实际生效的 2 vhost:
- `web-admin.conf` (`:8086` IP 直访, 内部测试)
- `admin.cretaceousfuture.com.conf` (`:443` HTTPS, **真实客户**)

## 历史 (pre 2026-05-15, kept for context)



**Last updated**: 2026-05-15
**Trigger**: 2026-05-15 incident — Phase IIa restaurant routing deployed to `web-admin.conf` + `api.cretaceousfuture.com.conf` (per PR #641 MO), but **missed `admin.cretaceousfuture.com.conf`** — the real customer-facing DNS vhost. Customers hitting `https://admin.cretaceousfuture.com/api/mobile/RES_3101_009/smart-bi/analysis/finance?...` saw 404 even though backend was healthy.

## The 3 vhost rule

When deploying ANY nginx routing change for smart-bi / api proxying / restaurant cutover etc., **ALL 3 of these must be updated together**:

| File | Hosts | Used by |
|---|---|---|
| `/www/server/panel/vhost/nginx/web-admin.conf` | `:8086` (HTTP, IP direct) | Internal dev/test access by IP |
| `/www/server/panel/vhost/nginx/admin.cretaceousfuture.com.conf` | `admin.cretaceousfuture.com:443` (HTTPS) | **Real customers** — restaurant chain owners / staff |
| `/www/server/panel/vhost/nginx/api.cretaceousfuture.com.conf` | `api.cretaceousfuture.com:443` (HTTPS) | API consumers — mobile app + external integrations |

All 3 must serve the same routing rules. If you change one, change all three.

Server-side root for all 3 admin/web vhosts: `/www/wwwroot/web-admin/`. Same web-admin Vue dist serves all 3. But **nginx routing rules are per-vhost**, not shared via include.

## Verification: count smart-bi block parity

```bash
ssh root@139.196.165.140 "
for f in web-admin.conf admin.cretaceousfuture.com.conf api.cretaceousfuture.com.conf; do
  N=\$(grep -c 'cretas_python' /www/server/panel/vhost/nginx/\$f)
  echo \"\$f: \$N cretas_python blocks\"
done
"
```

Expected output (post-2026-05-15):
```
web-admin.conf: 5 cretas_python blocks
admin.cretaceousfuture.com.conf: 5 cretas_python blocks
api.cretaceousfuture.com.conf: 5 cretas_python blocks
```

If any count differs → drift, needs sync.

## Why all 3 had drift before

History:
- **api.cretaceousfuture.com.conf** got the Phase 2A blocks first (back in PR #441 etc.) because that's where API consumers hit
- **web-admin.conf** caught up shortly after for internal testing
- **admin.cretaceousfuture.com.conf** was **never updated** — because no one explicitly identified it as a "customer-facing" vhost during marching orders

The cycle-3 audit of Phase IIa spec § 6.1 even said "2 nginx files" — only listed web-admin + api. **admin DNS was invisible to the spec author.**

## Sync procedure (when adding new routing rule)

```bash
# 1. Backup all 3
TS=$(date +%Y%m%d_%H%M%S)
ssh root@139.196.165.140 "
  cd /www/server/panel/vhost/nginx
  cp web-admin.conf web-admin.conf.bak.\$TS
  cp admin.cretaceousfuture.com.conf admin.cretaceousfuture.com.conf.bak.\$TS
  cp api.cretaceousfuture.com.conf api.cretaceousfuture.com.conf.bak.\$TS
"

# 2. Add SAME location block to all 3, BEFORE /api/mobile/ catchall
#    (Use Python script + sed marker — DO NOT manually edit 3 files separately,
#    bugs WILL slip through)

# 3. Test + reload (single nginx -t covers all 3)
ssh root@139.196.165.140 "nginx -t && nginx -s reload"

# 4. Smoke test all 3 entry points:
TOKEN=$(get_jwt qhj_prod 123456)
for url in \
  http://139.196.165.140:8086/api/mobile/RES_3101_009/smart-bi/analysis/finance?... \
  https://admin.cretaceousfuture.com/api/mobile/RES_3101_009/smart-bi/analysis/finance?... \
  https://api.cretaceousfuture.com/api/mobile/RES_3101_009/smart-bi/analysis/finance?... ; do
  curl -sS -o /dev/null -w "$url → HTTP %{http_code}\n" -H "Authorization: Bearer $TOKEN" "$url"
done
```

Expected: 3× HTTP 200.

## Audit Trail

2026-05-15: incident discovery via real customer screenshot showed 404 on
admin.cretaceousfuture.com — investigation revealed admin vhost was missing
**5 blocks** (Phase 2A factory analysis, Phase 2A alerts, Phase 2A
query-templates/datasource, T6.6.3c restaurant production/quality,
Phase IIa restaurant finance/sales).

After sync: 5 blocks added to admin vhost, total parity 5/5/5 across all
3 vhosts. Verified via 3-curl smoke (all 200 with rich RES_3101_009 data).

Backup file: `admin.cretaceousfuture.com.conf.bak.phase-iia-missed.20260515_015406`.

## Related

- `feedback_nginx_vhost_drift_admin_vs_web_admin.md` (memory)
- spec `docs/superpowers/specs/2026-05-14-restaurant-phase-ii-analytics-spec.md` §6.1 — original Phase IIa nginx MO (2 files only — gap)
- PR #641 (Phase IIa nginx ops PR — pre-fix scope)
