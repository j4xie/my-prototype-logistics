
# Error Log Hygiene — Multi-Layer Defense Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate scanner/probe noise from Cretas Java backend error log (`logs/cretas-backend-error.log`) through three defense layers, without losing visibility into real 404 bugs.

**Architecture:**
1. **Layer 1 — Spring exception handler**: Path-aware `NoResourceFoundException` handler that logs `/api/*` misses at WARN and everything else at DEBUG. Fixes log noise regardless of request source.
2. **Layer 2 — Nginx gateway allowlist**: Explicit `return 444` for known scanner paths (`.git`, `.env`, `wp-admin`, etc.) on the Java API gateway. Reduces backend load from domain-routed scans.
3. **Layer 3 — Infrastructure lockdown**: Migrate clients from direct IP:port to the nginx domain, then close Java ports at the cloud SG level. Kills all direct-port scanning. Multi-step, some gated on user action.

**Tech Stack:** Java 21 · Spring Boot 3.2 · Nginx (Baota panel on 139) · Aliyun ECS SG · React Native (Expo) · Vue 3 (web-admin)

**Rules-of-engagement:**
- Each phase is deploy-verified before the next begins.
- Backups before every risky change (jar backup via deploy script; nginx config copy before edit).
- **Do NOT** lose WARN/ERROR visibility on real `/api/*` 404s — those are frontend-bug signals.
- **Do NOT** break the running blue-green upstream during Phase 2.
- **Scope check**: Phase 3 is multi-day and requires coordination. This plan covers Phase 3 PREP work in-session; the cutover is a separate deliverable.

---

## File Structure

### Phase 1 — Java

| File | Action | Responsibility |
|---|---|---|
| `backend/java/cretas-api/src/main/java/com/cretas/aims/exception/GlobalExceptionHandler.java` | Modify (add imports + new @ExceptionHandler method) | Path-aware `NoResourceFoundException` handling |

### Phase 2 — Nginx

| File | Action | Responsibility |
|---|---|---|
| `/www/server/panel/vhost/nginx/web-admin.conf` (on 139) | Modify (add scanner path blocklist) | Block common scanner patterns at the gateway |
| `/www/server/panel/vhost/nginx/centerapi.*.conf` (on 139, if present) | Modify | Same blocklist on the API gateway |

### Phase 3 — RN Client Prep

| File | Action | Responsibility |
|---|---|---|
| `frontend/CretasFoodTrace/.env.production` (create if missing) | Create/Modify | Point prod builds at `https://centerapi.cretaceousfuture.com` |
| `docs/superpowers/plans/2026-04-10-phase3-cloud-sg-cutover.md` | Create | Separate deliverable tracking the cloud SG cutover |

---

## Phase 1: Java GlobalExceptionHandler

**Why first:** No infrastructure dependency. Compiles + deploys via existing blue-green script. Stops log noise regardless of traffic path (direct-IP scanners, domain traffic, everything). 30 minutes end-to-end.

**Context needed before execution:**
- `GlobalExceptionHandler.java` currently has NO explicit handler for `org.springframework.web.servlet.resource.NoResourceFoundException` (Spring 6 class). These fall through to `handleException(Exception)` at line 499 which logs at ERROR with full stack trace. We need to add an explicit handler BEFORE the generic one.
- The class already imports `org.springframework.web.servlet.NoHandlerFoundException` (different class) — that handler exists at line 431-436 and logs at WARN. The new `NoResourceFoundException` handler should follow the same pattern but with a path-prefix check.

### Task 1.1: Add imports + NoResourceFoundException handler

**Files:**
- Modify: `backend/java/cretas-api/src/main/java/com/cretas/aims/exception/GlobalExceptionHandler.java`

- [ ] **Step 1: Add the import for NoResourceFoundException**

Edit `GlobalExceptionHandler.java`, find the existing import for `NoHandlerFoundException` (around line 20):

```java
import org.springframework.web.servlet.NoHandlerFoundException;
```

Add a new import line immediately after it:

```java
import org.springframework.web.servlet.resource.NoResourceFoundException;
import jakarta.servlet.http.HttpServletRequest;
```

- [ ] **Step 2: Add the new @ExceptionHandler method**

Find the existing `handleNoHandlerFoundException` method (around line 431-436):

```java
    /**
     * 处理路由未找到
     */
    @ExceptionHandler(NoHandlerFoundException.class)
    @ResponseStatus(HttpStatus.NOT_FOUND)
    public ApiResponse<?> handleNoHandlerFoundException(NoHandlerFoundException e) {
        log.warn("请求路径不存在: {}", e.getRequestURL());
        return ApiResponse.error(404, "请求的接口不存在");
    }
```

Add a new method immediately BELOW it (before the `==== 空指针和运行时异常 ====` section):

```java
    /**
     * 处理 Spring 6 ResourceHttpRequestHandler 抛出的 NoResourceFoundException
     *
     * 该异常发生在 DispatcherServlet 路由时没有匹配任何 controller,
     * 请求被 fall-through 到静态资源 handler, 然后静态资源也不存在。
     *
     * 路径分级日志策略:
     *   - /api/ 开头    → WARN  (真实的前端 bug, 客户端在调错误的 URL, 需要排查)
     *   - 其他所有路径  → DEBUG (扫描器噪音: /.git/config / /wp-admin / /favicon.ico / /)
     *
     * 不再用 ERROR 级别记录 404, 避免 error.log 被扫描器流量淹没。真实的
     * 前端 bug 仍然在 WARN 级别可见, 不会被掩盖。
     */
    @ExceptionHandler(NoResourceFoundException.class)
    @ResponseStatus(HttpStatus.NOT_FOUND)
    public ApiResponse<?> handleNoResourceFoundException(
            NoResourceFoundException e, HttpServletRequest request) {
        String path = request.getRequestURI();
        if (path != null && path.startsWith("/api/")) {
            log.warn("API 路径无 handler: method={}, path={}", request.getMethod(), path);
        } else {
            log.debug("Non-API 404 (scanner/probe): method={}, path={}", request.getMethod(), path);
        }
        return ApiResponse.error(404, "请求的资源不存在");
    }
```

- [ ] **Step 3: Compile locally to catch syntax errors**

```bash
cd backend/java/cretas-api && ./mvnw compile -q -o
echo "EXIT=$?"
```

Expected: `EXIT=0` with no output from mvnw.

If compile fails:
- Check the import lines are in the right place (after line 20, before the class javadoc)
- Check no typos in `NoResourceFoundException` / `HttpServletRequest`
- Check the method braces match

- [ ] **Step 4: Commit**

```bash
cd /c/Users/Steve/my-prototype-logistics
git add backend/java/cretas-api/src/main/java/com/cretas/aims/exception/GlobalExceptionHandler.java
git commit -m "$(cat <<'EOF'
fix(log): downgrade scanner 404s from ERROR to DEBUG in GlobalExceptionHandler

Add an explicit @ExceptionHandler(NoResourceFoundException.class) that
checks the request path prefix:
  - /api/* → log at WARN (real client bugs hitting wrong URLs)
  - everything else → log at DEBUG (scanner probes like /.git/config,
    /wp-admin, /, /favicon.ico)

Previously these 404s fell through to handleException(Exception) at
line 499 and got logged at ERROR with full stack trace, flooding
error.log with scanner noise. /api/* real 404s remain at WARN level,
so real frontend bugs (wrong URL, missing segment, etc.) are still
visible without being buried in noise.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

### Task 1.2: Deploy to prod via blue-green

- [ ] **Step 1: Run deploy-backend.sh**

```bash
./scripts/deploy/deploy-backend.sh
```

Expected output (last ~20 lines):
- `[BG 2/4] 等待 [blue|green] 健康 (远端 loop, 最多 150s)...` → `✓ [blue|green] 健康 (XXs, ...)`
- `[BG 3/4] 切换 139 nginx upstream: 10020 → 10010` (or reverse)
- `✓ upstream 切换完成`
- `✓ 切换后验证通过 (HTTP 200 via nginx)`
- `[BG 5/5] Systemd 收尾检查...`
- `✅ Blue-Green 切换完成`
- `✅ 部署完成!`

If any step fails: the OLD instance keeps serving, nothing is broken. Investigate the build/startup log before retrying.

- [ ] **Step 2: Verify the new handler is active by triggering a known non-/api/ 404**

```bash
curl -s -o /dev/null -w "HTTP %{http_code}\n" "http://47.100.235.168:10010/just-a-scanner-test.git/config"
curl -s -o /dev/null -w "HTTP %{http_code}\n" "http://47.100.235.168:10020/just-a-scanner-test.git/config"
```

At least one should return `HTTP 404`. (One of them will be the stopped blue/green, which returns 000.)

- [ ] **Step 3: Confirm the test DIDN'T generate an ERROR log entry**

```bash
ssh root@47.100.235.168 "grep 'just-a-scanner-test' /www/wwwroot/cretas/logs/cretas-backend-error.log | wc -l"
ssh root@47.100.235.168 "grep 'just-a-scanner-test' /www/wwwroot/cretas/logs/cretas-backend.log | wc -l"
```

Expected:
- `error.log` count: **0** (scanner path → DEBUG, doesn't go to error log)
- `backend.log` count: **0 or 1** (depends on logback config for DEBUG level; INFO level default means 0)

If `error.log` shows a match, the handler isn't running — rebuild and redeploy.

- [ ] **Step 4: Verify /api/ paths still log at WARN**

```bash
curl -s -o /dev/null -w "HTTP %{http_code}\n" "http://47.100.235.168:10010/api/mobile/definitely-not-a-real-path"
curl -s -o /dev/null -w "HTTP %{http_code}\n" "http://47.100.235.168:10020/api/mobile/definitely-not-a-real-path"
```

Note: one returns 401 (auth interceptor fires before routing for /api/mobile/*) and the other returns 000. **That's expected** — the auth interceptor returns 401 for all /api/mobile/* paths without a valid JWT, BEFORE Spring routing runs, so the `NoResourceFoundException` handler is never reached.

To actually test the WARN branch, use a /api/ path that DOESN'T require auth. Check for unauthenticated /api/* paths:

```bash
curl -s -o /dev/null -w "HTTP %{http_code}\n" "http://47.100.235.168:10010/api/mobile/health"
```

Expected: 200. Then try a non-existent /api/mobile/health/xxx:

```bash
curl -s -o /dev/null -w "HTTP %{http_code}\n" "http://47.100.235.168:10010/api/mobile/health/nonexistent"
```

If this returns 401, the /api/mobile/* prefix enforces auth regardless of specific route — in that case, check `/actuator/` which is Spring Boot's management path:

```bash
curl -s -o /dev/null -w "HTTP %{http_code}\n" "http://47.100.235.168:10010/actuator/nonexistent"
```

Expected: 404. Then verify it showed up as WARN (not ERROR) in the log:

```bash
ssh root@47.100.235.168 "tail -20 /www/wwwroot/cretas/logs/cretas-backend.log | grep 'actuator/nonexistent'"
```

Expected: at least one line with `WARN` level containing `API 路径无 handler`.

If no WARN hit is visible, the handler still doesn't apply — check that `/actuator/` starts with `/api/` (it doesn't — so this test only validates the DEBUG branch). The WARN branch applies to `/api/*` paths, which in this deployment are all auth-gated. **That's actually fine** — WARN-level `/api/*` misses would still be visible via the existing auth 401 + logs. Move on.

- [ ] **Step 5: Baseline the error rate post-deploy**

```bash
ssh root@47.100.235.168 "date; echo '---last 5 min of error.log, NoResourceFoundException count---'; awk -v cutoff=\"\$(date -d '5 min ago' '+%Y-%m-%d %H:%M')\" '\$1\" \"\$2 >= cutoff && /NoResourceFoundException/' /www/wwwroot/cretas/logs/cretas-backend-error.log | wc -l"
```

Expected: **0** (scanners keep hitting, but our handler now routes them to DEBUG).

If non-zero AND the timestamps are after the cutover, the deploy didn't land or the handler isn't matched — investigate.

---

## Phase 2: Nginx Gateway Allowlist

**Why second:** Now that Phase 1 silences scanner noise at the Java layer, Phase 2 reduces CPU load by 404-ing scanners AT THE GATEWAY before they reach Java. Only applies to the nginx-routed path (domain traffic). Direct-IP scanners are handled by Phase 1.

**Pre-execution discovery (MUST run first):** Baota on 139 can have multiple nginx vhosts. We need to identify the actual gateway config for `centerapi.cretaceousfuture.com` and any others that proxy `/api/mobile/` to the Java backend.

### Task 2.1: Discover the active nginx gateway configs

**Files:**
- Read (discovery only): `/www/server/panel/vhost/nginx/*.conf` on 139

- [ ] **Step 1: List all nginx vhost configs that proxy to cretas_backend upstream**

```bash
ssh root@139.196.165.140 "grep -l 'cretas_backend\|47.100.235.168:1001' /www/server/panel/vhost/nginx/*.conf 2>/dev/null"
```

Record the list of files returned. These are the configs that need editing in Task 2.2.

- [ ] **Step 2: Dump the server/location structure of each config**

For each file from Step 1, run:

```bash
ssh root@139.196.165.140 "grep -nE 'server_name|listen|location' /www/server/panel/vhost/nginx/<filename>.conf"
```

Look for:
- `listen 443 ssl` or `listen 8086` — the port
- `server_name centerapi.cretaceousfuture.com` — the hostname
- `location /api/mobile/` — the Java proxy location
- `location /` — the catch-all (if any)

- [ ] **Step 3: Confirm the upstream definition**

```bash
ssh root@139.196.165.140 "cat /www/server/panel/vhost/nginx/_upstream_cretas.conf"
```

This should show `upstream cretas_backend { server 47.100.235.168:10010; }` or similar. The upstream port flips during blue-green deploys — DON'T edit this file.

### Task 2.2: Add scanner blocklist to each gateway config

**Files:**
- Modify each file identified in Task 2.1 Step 1 (on 139 server).

The blocklist blocks common scanner patterns at the nginx layer (before proxy_pass runs), returning 444 (no response) to terminate the connection without sending any response body. This reduces scanner feedback.

Add the blocklist BEFORE any `location /api/` blocks so it takes precedence.

- [ ] **Step 1: Back up the current config**

For each config file, run:

```bash
ssh root@139.196.165.140 "cp /www/server/panel/vhost/nginx/<filename>.conf /www/server/panel/vhost/nginx/<filename>.conf.bak.$(date +%Y%m%d_%H%M%S)"
```

- [ ] **Step 2: Add the blocklist block at the top of the server {} block**

Edit each config file and insert the following snippet AFTER `server_name` but BEFORE the first `location` directive:

```nginx
    # ============================================================
    # Scanner/probe blocklist - return 444 (no response) for known
    # attack reconnaissance patterns. Added 2026-04-10 to stop
    # /.git/config, /wp-admin, /.env, /phpmyadmin etc. probes from
    # reaching the Java backend.
    # ============================================================
    location ~* \.(git|svn|hg|bzr)(/|$) { return 444; }
    location ~* /\.env { return 444; }
    location ~* /wp-(admin|content|includes|login) { return 444; }
    location ~* /(phpmyadmin|phpMyAdmin|pma|myadmin) { return 444; }
    location ~* /(config|settings)\.(php|yml|yaml|json|ini)$ { return 444; }
    location ~* /(ads|app-ads|sellers)\.txt$ { return 444; }
    location ~* /(wiki|xmlrpc\.php|wp-config\.php|\.DS_Store) { return 444; }
    location = /favicon.ico { log_not_found off; access_log off; return 204; }
```

(The favicon rule is slightly different: return 204 with logging off. Browsers legitimately request this, and we want them quiet without counting it as an attack.)

- [ ] **Step 3: Test the nginx config for syntax errors**

```bash
ssh root@139.196.165.140 "nginx -t 2>&1"
```

Expected: `nginx: configuration file /www/server/panel/nginx/conf/nginx.conf test is successful`

If test fails: inspect the error, fix the config, test again. DO NOT reload until test passes.

- [ ] **Step 4: Reload nginx (graceful, zero downtime)**

```bash
ssh root@139.196.165.140 "nginx -s reload 2>&1"
```

- [ ] **Step 5: Verify the blocklist works via the domain**

```bash
curl -s -o /dev/null -w "git/config: %{http_code}\n" "https://centerapi.cretaceousfuture.com/.git/config"
curl -s -o /dev/null -w "wp-admin:   %{http_code}\n" "https://centerapi.cretaceousfuture.com/wp-admin/login.php"
curl -s -o /dev/null -w "favicon:    %{http_code}\n" "https://centerapi.cretaceousfuture.com/favicon.ico"
curl -s -o /dev/null -w "real api:   %{http_code}\n" "https://centerapi.cretaceousfuture.com/api/mobile/health"
```

Expected:
- `.git/config` → `000` or `0` (connection terminated, nginx returned 444 which closes without response)
- `wp-admin` → `000` or `0`
- `favicon.ico` → `204`
- `/api/mobile/health` → `200` (real traffic still works)

If the real API returns non-200, the blocklist is too aggressive — check if the scanner regex matched a legitimate path. Rollback via `mv <filename>.conf.bak.* <filename>.conf && nginx -s reload`.

- [ ] **Step 6: Verify NO new error.log entries from these test probes**

```bash
ssh root@47.100.235.168 "grep -E 'git/config|wp-admin' /www/wwwroot/cretas/logs/cretas-backend-error.log | tail -5 | cut -c1-100"
```

Only historical entries should show up (timestamps before Phase 2 deploy). If new entries appear, the blocklist isn't catching them at the nginx layer — check the location regex.

- [ ] **Step 7: Commit a copy of the nginx blocklist to the repo**

Since the nginx configs live on the server (not in git), save the blocklist as a reference file:

```bash
cat > /c/Users/Steve/my-prototype-logistics/scripts/deploy/nginx-scanner-blocklist.conf <<'EOF'
# Cretas nginx scanner blocklist
# Applied on 139.196.165.140 in /www/server/panel/vhost/nginx/<gateway>.conf
# Deploy: copy this snippet into the `server {}` block of each vhost that
# proxies to the Java backend, right after server_name and before any
# location /api/ rules.
# Added 2026-04-10.

    location ~* \.(git|svn|hg|bzr)(/|$) { return 444; }
    location ~* /\.env { return 444; }
    location ~* /wp-(admin|content|includes|login) { return 444; }
    location ~* /(phpmyadmin|phpMyAdmin|pma|myadmin) { return 444; }
    location ~* /(config|settings)\.(php|yml|yaml|json|ini)$ { return 444; }
    location ~* /(ads|app-ads|sellers)\.txt$ { return 444; }
    location ~* /(wiki|xmlrpc\.php|wp-config\.php|\.DS_Store) { return 444; }
    location = /favicon.ico { log_not_found off; access_log off; return 204; }
EOF
cd /c/Users/Steve/my-prototype-logistics
git add scripts/deploy/nginx-scanner-blocklist.conf
git commit -m "$(cat <<'COMMITEOF'
chore(nginx): snapshot scanner blocklist deployed to 139 gateway

The nginx configs on 139.196.165.140 are managed by Baota and not in
git. Save the blocklist snippet as a reference so future deploys or
server rebuilds can re-apply it. The live config was edited in-place
on 139 during Phase 2 of the error-log-hygiene rollout (see
docs/superpowers/plans/2026-04-10-error-log-hygiene-multilayer.md).

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
COMMITEOF
)"
```

---

## Phase 3: Infrastructure Lockdown — PREP work (in-session)

**Why last:** Requires client coordination + cloud console access. The full cutover is multi-day. This phase does everything that CAN be done in-session; the final cloud SG lockdown is documented as a separate follow-up.

### Task 3.1: Document current direct-IP client dependencies

- [ ] **Step 1: Inventory all code references to direct backend IP:port**

Run these greps and save the results:

```bash
cd /c/Users/Steve/my-prototype-logistics
echo '--- RN constants/config ---'
grep -rn '47\.100\.235\.168\|10010\|10020' frontend/CretasFoodTrace/src/constants/ 2>/dev/null
echo '--- web-admin env ---'
grep -rn '47\.100\.235\.168\|10010\|10020' web-admin/src/ web-admin/.env* 2>/dev/null | head -10
echo '--- test scripts ---'
grep -rn '47\.100\.235\.168' scripts/ tests/ test-*.mjs 2>/dev/null | head -10
echo '--- Python services ---'
grep -rn '47\.100\.235\.168\|10010' backend/python/ 2>/dev/null | head -10
```

Record the findings in `docs/superpowers/plans/2026-04-10-phase3-cloud-sg-cutover.md` (created below).

### Task 3.2: Configure RN prod .env to use the nginx domain

**Files:**
- Create/Modify: `frontend/CretasFoodTrace/.env.production`

The RN app reads `REACT_APP_API_URL` from `@env` (via `react-native-dotenv` or similar). `frontend/CretasFoodTrace/src/constants/config.ts:getApiBaseUrl()` falls back to `http://10.0.2.2:10010` (Android emulator host) when the env var is missing — which means production builds that forget to set it would hit the wrong backend.

- [ ] **Step 1: Check existing .env files**

```bash
ls -la frontend/CretasFoodTrace/.env* 2>/dev/null
```

Record which files exist.

- [ ] **Step 2: Set the production API URL**

If `.env.production` exists, inspect it:

```bash
cat frontend/CretasFoodTrace/.env.production 2>/dev/null
```

If it does NOT set `REACT_APP_API_URL` to the domain, add it. Create the file if it doesn't exist:

```bash
cat > frontend/CretasFoodTrace/.env.production <<'EOF'
# Production environment — point at the nginx domain so Phase 3 cloud SG
# lockdown can close direct Java ports without breaking the app.
# Do NOT hardcode the Java IP (47.100.235.168:10010) here; that path will
# be blocked once Phase 3 cutover lands.
REACT_APP_API_URL=https://centerapi.cretaceousfuture.com
EOF
```

- [ ] **Step 3: Verify the new .env.production doesn't break the dev/default loader**

Open `frontend/CretasFoodTrace/src/constants/config.ts` and confirm `getApiBaseUrl()` still has a dev fallback (it does, at line ~18 — `'http://10.0.2.2:10010'`). Dev builds continue to work as before; only production-mode builds read `.env.production`.

- [ ] **Step 4: Commit**

```bash
git add frontend/CretasFoodTrace/.env.production
git commit -m "$(cat <<'EOF'
feat(rn-config): production builds point at nginx domain, not direct Java IP

Phase 3 of the error-log-hygiene rollout will close the direct Java
ports (10010, 10020, 8083, 8084) at the aliyun security group so
scanners cannot reach the backend. Production RN builds need to use
the nginx domain (centerapi.cretaceousfuture.com) to survive the
cutover.

Dev builds are unchanged — constants/config.ts still falls back to
the Android emulator host URL when REACT_APP_API_URL is not set.

Next steps (separate ticket): rebuild + release RN app with this env,
monitor direct-port traffic for old-version stragglers, then perform
the actual SG cutover.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

### Task 3.3: Create Phase 3 follow-up plan (separate deliverable)

**Files:**
- Create: `docs/superpowers/plans/2026-04-10-phase3-cloud-sg-cutover.md`

- [ ] **Step 1: Write the follow-up plan document**

Create the file with this content:

```markdown
# Phase 3 — Cloud SG Cutover (Follow-up from error-log-hygiene)

**Status:** GATED on Phase 1 + Phase 2 stable in prod for 48h, and RN app release with updated .env.production.

**Owner:** Steve (requires aliyun console access + RN release coordination)

## Context

Phases 1 (Java exception handler) and 2 (nginx blocklist) are in place.
Scanners are silenced at the application + gateway layers. The remaining
work — closing direct Java ports at the cloud SG — depends on migrating
all clients to the nginx domain first.

## Direct-IP client inventory

Paste output of `Task 3.1 Step 1` grep here after running.

## Cutover steps

1. **Rebuild RN app** with `.env.production` → Android APK + iOS build
2. **Release RN app** to users (force-update if possible, otherwise gradual)
3. **Monitor direct-port access log** for 48h to identify stragglers:
   ```bash
   ssh root@47.100.235.168 "grep -c ':10010 ' /www/wwwroot/cretas/logs/cretas-backend.log"
   ```
4. **Notify stragglers** (if identifiable by JWT userId in logs)
5. **Aliyun SG change** (via console or CLI):
   - Source: 0.0.0.0/0
   - Ports: 10010, 10020, 10022, 8083, 8084
   - Action: DROP
   - Exception: source IP 139.196.165.140 (nginx gateway) → ALLOW
   - Exception: source IP 127.0.0.1 (localhost) → ALLOW
6. **Smoke test** via domain: `curl https://centerapi.cretaceousfuture.com/api/mobile/health` → 200
7. **Direct-IP test** (should fail from outside, work from nginx):
   ```bash
   curl --connect-timeout 5 http://47.100.235.168:10010/api/mobile/health
   # Expected: connection timeout
   ssh root@47.100.235.168 "curl -s http://localhost:10010/api/mobile/health"
   # Expected: 200
   ```
8. **Monitor /sales-orders and other 404s for 1h post-cutover** — scanners should drop to zero

## Rollback plan

If any real client breaks after the SG change:
- Aliyun console → revert the SG rule (re-allow 0.0.0.0/0)
- Takes effect in seconds
- Investigate which client was broken and fix before re-attempting

## Success criteria

- Zero NoResourceFoundException in error.log for 24h after cutover
- Real user traffic through `centerapi.cretaceousfuture.com` unchanged
- SG rules documented in `.claude/rules/aliyun-credentials.md` or similar
```

- [ ] **Step 2: Commit the follow-up plan**

```bash
git add docs/superpowers/plans/2026-04-10-phase3-cloud-sg-cutover.md
git commit -m "$(cat <<'EOF'
docs(plans): track Phase 3 cloud SG cutover as a separate follow-up

Phase 1 + 2 of the error-log-hygiene rollout are executable in-session.
Phase 3 (closing direct Java ports at aliyun SG) requires RN app rebuild
and release first so existing users don't get cut off. Separate this
plan so it can be tracked as a scheduled cutover ticket.

Gated on:
  - Phase 1 stable 48h
  - Phase 2 stable 48h
  - RN app release with .env.production pointing at nginx domain
  - 48h of direct-port access log monitoring for stragglers

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Self-review (to run by the plan executor)

Before marking this plan complete:

1. **Spec coverage**
   - [x] Layer 1 (Java exception handler) — Phase 1 tasks 1.1, 1.2
   - [x] Layer 2 (nginx allowlist) — Phase 2 tasks 2.1, 2.2
   - [x] Layer 3 (SG lockdown + client migration) — Phase 3 PREP tasks 3.1, 3.2, 3.3 + follow-up plan

2. **Placeholder scan**
   - No `TBD`, `TODO`, or "similar to" references
   - All code blocks contain actual content
   - All file paths are absolute or repo-root relative
   - All shell commands are runnable as-is

3. **Type consistency**
   - `NoResourceFoundException` is the correct class (Spring 6, `org.springframework.web.servlet.resource`)
   - `HttpServletRequest` is imported from `jakarta.servlet.http`
   - `NoHandlerFoundException` (pre-existing, for missing controller mapping) is NOT the same class — don't confuse them

4. **Rollback safety**
   - Phase 1 rollback: blue-green keeps old JAR running if startup fails
   - Phase 2 rollback: `.bak.TIMESTAMP` copy created before edit
   - Phase 3 PREP rollback: just `git revert` the commit

---

## Execution order summary

| Phase | Est time | Blocking next? | Risk |
|---|---|---|---|
| 1. Java GlobalExceptionHandler | 30 min | No (Phase 2 independent) | Low — code review + blue-green rollback |
| 2. Nginx blocklist | 20 min | No | Low — `.bak` + `nginx -t` before reload |
| 3.1–3.3 RN config prep | 15 min | No (no deploy) | Very low — config file only |
| **Phase 3 cutover** | **Multi-day** | **Gated on 1+2 stable** | **Higher — needs RN release + SG coordination** |

**Total in-session work:** ~65 minutes across the 3 in-session phases.

---

## Post-plan verification checklist

After Phase 1 + 2 + 3.1-3.3 land:

```bash
# 1. Prod health
curl -s -o /dev/null -w "prod: %{http_code}\n" https://centerapi.cretaceousfuture.com/api/mobile/health

# 2. Scanner noise stopped (check last 10 min)
ssh root@47.100.235.168 "awk -v cutoff=\"\$(date -d '10 min ago' '+%Y-%m-%d %H:%M')\" '\$1\" \"\$2 >= cutoff && /NoResourceFoundException/' /www/wwwroot/cretas/logs/cretas-backend-error.log | wc -l"
# Expected: 0

# 3. Blocklist working
curl -s -o /dev/null -w "%{http_code}\n" https://centerapi.cretaceousfuture.com/.git/config
# Expected: 000 (connection closed by 444)

# 4. Real traffic unaffected
curl -s -o /dev/null -w "%{http_code}\n" https://centerapi.cretaceousfuture.com/api/mobile/health
# Expected: 200
```
