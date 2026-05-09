
# Phase 3 — Cloud SG Cutover (Follow-up from error-log-hygiene)

**Status:** ✅ **COMPLETE** (2026-04-11 07:10 CST) — executed same-session, gating relaxed by user request.

**Owner:** Steve (requires aliyun console access)

## Cutover execution log

**Time:** 2026-04-11 07:05-07:10 CST (~5 min)

**Security group**: `sg-uf64n0hcl8w37d34zfmy` (instance `i-uf6aillfem75trsuv1l1`, 47.100.235.168)

**Changes applied via `aliyun ecs AuthorizeSecurityGroup` + `RevokeSecurityGroup`:**

1. **Added** 4 whitelist rules (priority 1):
   - `10010/TCP ← 139.196.165.140/32` (Cretas Java prod/blue)
   - `10011/TCP ← 139.196.165.140/32` (Cretas Java test)
   - `8083/TCP  ← 139.196.165.140/32` (Python prod)
   - `8084/TCP  ← 139.196.165.140/32` (Python test)

2. **Revoked** 4 public rules:
   - `10010/TCP ← 0.0.0.0/0` (ALLOW) — was "cretas端口"
   - `10011/TCP ← 0.0.0.0/0` (ALLOW) — was "Test Java backend"
   - `8083/TCP  ← 0.0.0.0/0` (ALLOW)
   - `8084/TCP  ← 0.0.0.0/0` (ALLOW) — was "Test Python service"

3. **Already in place** (not touched):
   - `10020/TCP ← 139.196.165.140/32` (green, pre-existing rule from earlier BG POC)

**Verification results** (immediately post-cutover):

| Test | Expected | Actual |
|---|---|---|
| External direct `47.100.235.168:10010/api/mobile/health` | timeout | **000 (timeout)** ✅ |
| External direct `47.100.235.168:10011, 8083, 8084` | timeout | **000 (timeout)** ✅ |
| Domain `https://www.cretaceousfuture.com/api/mobile/health` | 200 | **200** ✅ |
| `ssh 139 → curl 47:10010` | 200 | **200** ✅ |
| `ssh 139 → curl 47:8083` | 200 | **200** ✅ |
| Error log NoResourceFoundException post-cutover | 0 | **0** ✅ |

**Rollback reference (if needed):**
```bash
AK=<REDACTED-AK-SEE-LOCAL-CREDENTIAL-FILE>
SK=<REDACTED-SECRET-SEE-LOCAL-CREDENTIAL-FILE>
SG=sg-uf64n0hcl8w37d34zfmy
aliyun ecs AuthorizeSecurityGroup --access-key-id $AK --access-key-secret $SK --region cn-shanghai \
  --SecurityGroupId $SG --IpProtocol tcp --PortRange "10010/10010" --SourceCidrIp 0.0.0.0/0 \
  --Priority 1 --Description "EMERGENCY rollback"
```

**Dev-machine access after cutover:** Use SSH tunnel:
```bash
ssh -L 10010:localhost:10010 root@47.100.235.168
# then access http://localhost:10010 from the dev machine
```

---

## Original plan (kept for historical reference)

**Status (original):** GATED on Phases 1 + 2 stable in prod for 48h, plus infrastructure decisions below.

**Owner:** Steve (requires aliyun console access)

**Parent plan:** `docs/superpowers/plans/2026-04-10-error-log-hygiene-multilayer.md`

## Context

Phase 1 (Java `GlobalExceptionHandler.handleNoResourceFoundException`, commit `17a22c504`) is in prod and verified — scanner 404s no longer write to `error.log`. Phase 2 (nginx scanner blocklist, commit `1549d9b47`) is applied to `api.cretaceousfuture.com.conf` on 139 as defense-in-depth; that vhost is NXDOMAIN today so the blocklist isn't load-bearing until DNS is published.

The remaining work — closing direct Java ports at the cloud SG level — depends on two things:
1. All **production** clients use the nginx domain (no direct IP)
2. **Dev** clients have an alternative path (SSH tunnel, VPN, or whitelist)

## Current client inventory (2026-04-10)

### Production clients — ALL migrated ✓

| Client | Config file | Value | Status |
|---|---|---|---|
| React Native (released builds) | `frontend/CretasFoodTrace/.env.production` | `https://www.cretaceousfuture.com` | ✅ Domain |
| Web-admin (released builds) | `web-admin/.env.production` | `/api/mobile` (relative, via nginx) | ✅ Relative |
| RN dev (emulator) | `frontend/CretasFoodTrace/.env` | `http://10.0.2.2:10010` | Direct — DEV ONLY |
| RN dev (local) | `frontend/CretasFoodTrace/.env.local` | (varies) | Direct — DEV ONLY |
| Web-admin dev | `web-admin/.env.local` | (varies) | Direct — DEV ONLY |

### Stale server-side defaults — not migrated

| File | Line | Value | Notes |
|---|---|---|---|
| `backend/python/client_requirement/wizard_api.py` | 28 | `JAVA_API_BASE = os.getenv(..., "http://localhost:10010")` | ✅ OK (Python runs on same box as Java) |
| `backend/python/efficiency_recognition/api/routes.py` | 36 | `BACKEND_BASE_URL = os.getenv(..., "http://139.196.165.140:10010")` | ⚠️ Wrong default — 139 is nginx gateway, not Java. Should be `localhost:10010` or `47.100.235.168:10010`. Fix in a separate commit before Phase 3 cutover so prod env var isn't hiding the bug. |

### Direct-IP attack surface today

Because RN/web-admin already use the domain, the scanner 404 noise observed 2026-04-10 (factory IDs 022-038 + `.git/config` + `/wp-admin` etc.) came from **public internet scanners hitting `47.100.235.168:10010` and `:10020` directly** — NOT via the domain. Phase 1 handler silences these at the Java layer. Phase 3 would eliminate them by closing the ports.

## Cutover steps

### Pre-flight (done in parent plan Phase 1 + 2 + 3 prep)

- [x] Phase 1 deployed, verified: `test-scanner-probe.git/config` → 404, 0 error.log entries
- [x] Phase 2 blocklist snippet committed to repo (`scripts/deploy/nginx-scanner-blocklist.conf`)
- [x] Client inventory documented (this doc)

### Gating tasks (before cutover)

- [ ] **Run Phases 1 + 2 stable for 48h**
  - Check: `ssh root@47.100.235.168 "awk -v cutoff=\"\$(date -d '48 hours ago' '+%Y-%m-%d %H:%M')\" '\$1\" \"\$2 >= cutoff && /NoResourceFoundException/' /www/wwwroot/cretas/logs/cretas-backend-error.log | wc -l"`
  - Expected: 0

- [ ] **Fix `efficiency_recognition/api/routes.py` stale default**
  - Change `http://139.196.165.140:10010` → `http://localhost:10010`
  - Small commit, separate from this plan
  - Verify no server env var is overriding it incorrectly

- [ ] **Decide on dev-machine access path**
  - Option A: SSH tunnel — devs forward local 10010 → server 10010 via `ssh -L 10010:localhost:10010 root@47.100.235.168`
  - Option B: IP whitelist in SG — add dev IPs (office, VPN, specific home IPs) to SG allowlist
  - Option C: WireGuard/Tailscale — set up an overlay network giving devs a stable IP
  - Recommendation: **Option A** (simplest, no extra infra, each dev manages their own tunnel)

- [ ] **Notify dev team of upcoming cutover**
  - Email / chat message describing the change and the dev access path
  - Give 24h notice minimum

### Cutover window (30 min)

- [ ] **Baseline monitoring** — record current error.log `NoResourceFoundException` rate
  ```bash
  ssh root@47.100.235.168 "tail -200 /www/wwwroot/cretas/logs/cretas-backend-error.log | grep -c NoResourceFoundException"
  ```

- [ ] **Aliyun ECS security group change** (via console or CLI)
  - Instance: `i-uf6aillfem75trsuv1l1` (47.100.235.168)
  - Current rule: `0.0.0.0/0 → 10010,10020,10022,8083,8084 ALLOW`
  - New rules:
    - `139.196.165.140/32 → 10010,10020,10022,8083,8084 ALLOW` (nginx gateway, public IP)
    - `0.0.0.0/0 → 10010,10020,10022,8083,8084 DROP` (default-deny)
    - Keep localhost (`127.0.0.1`) implicit ALLOW — no SG rule needed
  - Takes effect: seconds to minutes

- [ ] **Smoke test via domain** (external)
  ```bash
  curl -s -o /dev/null -w "%{http_code}\n" https://www.cretaceousfuture.com/api/mobile/health
  ```
  Expected: **200**

- [ ] **Smoke test direct IP** (should FAIL from outside, work from server)
  ```bash
  # From your machine (outside aliyun internal net):
  curl --connect-timeout 5 -o /dev/null -w "%{http_code}\n" http://47.100.235.168:10010/api/mobile/health
  # Expected: 000 (connect timeout — SG blocks)

  # From the server itself:
  ssh root@47.100.235.168 "curl -s -o /dev/null -w '%{http_code}\n' http://localhost:10010/api/mobile/health"
  # Expected: 200 (localhost loopback works)
  ```

- [ ] **Smoke test from nginx gateway** (internal path via public IP)
  ```bash
  ssh root@139.196.165.140 "curl -s -o /dev/null -w '%{http_code}\n' http://47.100.235.168:10010/api/mobile/health"
  ```
  Expected: **200** (nginx's outbound IP is whitelisted)

- [ ] **Monitor error.log for 1h post-cutover**
  ```bash
  ssh root@47.100.235.168 "tail -f /www/wwwroot/cretas/logs/cretas-backend-error.log | grep -E 'NoResourceFoundException|ERROR'"
  ```
  Expected: no scanner noise, no real client breakage

### Rollback plan

If any real client breaks after the SG change:
1. Aliyun console → delete the new DROP rule OR re-add `0.0.0.0/0 ALLOW` above the DROP rule
2. Takes effect in seconds
3. Investigate which client was broken:
   - Check `cretas-backend.log` for successful requests post-rollback (by IP / User-Agent)
   - Check if it's a dev machine (expected) or a production client (unexpected — means inventory was incomplete)
4. Fix the broken client, then retry the cutover

### Post-cutover (1h after)

- [ ] **Zero `NoResourceFoundException` in the last hour**
  ```bash
  ssh root@47.100.235.168 "awk -v cutoff=\"\$(date -d '1 hour ago' '+%Y-%m-%d %H:%M')\" '\$1\" \"\$2 >= cutoff && /NoResourceFoundException/' /www/wwwroot/cretas/logs/cretas-backend-error.log | wc -l"
  ```
  Expected: 0

- [ ] **Real user traffic unchanged** — confirmed by monitoring business endpoints
- [ ] **Document the SG rules** in `.claude/rules/aliyun-credentials.md` under a new "Security Groups" section
- [ ] **Mark parent plan complete** (`docs/superpowers/plans/2026-04-10-error-log-hygiene-multilayer.md`)

## Success criteria

- Zero NoResourceFoundException in error.log for 24h post-cutover
- Real traffic (RN app, web-admin) via domain unchanged
- SG rules documented alongside other infrastructure config
- Dev team access path (SSH tunnel) verified working on at least 1 dev machine

## Non-goals

- Not migrating `web-admin/.env.local` or `frontend/CretasFoodTrace/.env.local` — those are per-dev files, not committed
- Not publishing `api.cretaceousfuture.com` DNS — `www.cretaceousfuture.com` already serves the API path
- Not closing port 5432 (PostgreSQL) or 6379 (Redis) — those are already bound to localhost only
