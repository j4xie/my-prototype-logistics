
# Nginx Upstream Unify + Migration Replay Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate two recurring infrastructure fragility sources: (P1) `www.cretaceousfuture.com.conf` nginx vhost hardcoding the Java backend port, breaking every time blue-green switches to green; (P2) DB migrations under `db/migration/` not being auto-applied to prod, causing "column/table does not exist" outages when fresh code ships without operators manually running the SQL.

**Architecture:**
1. **Phase A — Nginx upstream unification**: Change 2 `proxy_pass` directives in `www.cretaceousfuture.com.conf` from hardcoded `http://47.100.235.168:10010/...` to `http://cretas_backend/...` so the vhost follows the same upstream swap that `api.cretaceousfuture.com.conf` already uses. Verify, reload, snapshot to repo.
2. **Phase B — Migration replay**: Copy the entire `V20260409_*` + `V20260410_*` migration batch to the prod server and run each through `psql -f` in sequence. Every migration in this batch uses `IF NOT EXISTS` / `ON CONFLICT DO NOTHING`, so replaying already-applied migrations is a no-op. Audit results + commit a tracking doc.

**Tech Stack:** Nginx (Baota) · PostgreSQL 17 · psql · Cretas server 47.100.235.168 · Nginx gateway 139.196.165.140

**Rules-of-engagement:**
- Both phases are executable same-session, but **Phase A must land first** (nginx stability > schema cleanup).
- Both phases are independently reversible: Phase A via `.bak` restore + reload; Phase B via migration idempotency (no-ops on re-run).
- **Do NOT** modify `_upstream_cretas.conf` — it's auto-managed by `deploy-backend.sh v5.0` blue-green orchestration.
- **Do NOT** run migrations older than V20260409_* — those pre-date the Canvas V3 batch and are already applied; replaying them wastes time and risks non-idempotent SQL.
- **Do NOT** restart Java as part of this plan. If Phase B finds missing columns that require a JDBC cache flush, do it as a separate subsequent task, not inline.
- Branch check: `git branch --show-current` must return `main` in the SAME bash command as any `git commit`. Concurrent-session branch flipping has bitten this session twice already.

---

## Pre-flight research (context, already verified)

Facts collected before writing this plan:

1. **Current `www.cretaceousfuture.com.conf` hardcoded lines** (on 139):
   ```nginx
   # around line 68:
   location /api/mobile/ {
       proxy_pass http://47.100.235.168:10010/api/mobile/;
       ...
   }
   # around line 85:
   location /api/public/ {
       proxy_pass http://47.100.235.168:10010/api/public/;
       ...
   }
   ```

2. **Upstream definition** (in `/www/server/panel/vhost/nginx/_upstream_cretas.conf` on 139):
   ```nginx
   upstream cretas_backend {
       server 47.100.235.168:10020;  # comment says "ACTIVE=10010" but actual value is 10020 today
       keepalive 32;
   }
   ```
   This file is auto-loaded by Baota nginx configuration (sibling to vhost files under the same include directory). The `cretas_backend` name is available to ALL vhosts, confirmed working by `api.cretaceousfuture.com.conf` which already uses `proxy_pass http://cretas_backend`.

3. **Migration batch to replay** — 20 files total under `backend/java/cretas-api/src/main/resources/db/migration/`:
   ```
   V20260409_01__canvas_config_tables.sql
   V20260409_02__seed_sales_order_bom_schema.sql
   V20260409_03__seed_data_spec_alignment.sql
   V20260409_04__canvas_config_grants.sql
   V20260409_05__fix_rejected_resubmit_transition.sql
   V20260410_01__factory_tool_skill_trigger_tables.sql
   V20260410_02__seed_default_trigger_chains.sql
   V20260410_03__factory_validation_default_formula_scheduler_tables.sql
   V20260410_04__seed_core_validation_rules.sql
   V20260410_05__seed_bulk_validation_rules.sql
   V20260410_06__seed_default_values.sql
   V20260410_07__seed_scheduler_configs.sql
   V20260410_08__module_schemas_batch1_core.sql
   V20260410_09__module_schemas_batch2_operations.sql
   V20260410_10__module_schemas_batch3_support.sql
   V20260410_11__industry_templates.sql
   V20260410_12__config_review_publish_window.sql      (known missed, already manually applied)
   V20260410_13__canvas_dynamic_field_table.sql
   V20260410_14__canvas_ddl_log_table.sql
   V20260410_15__canvas_dynamic_field_version_tracking.sql  (already applied by another session)
   ```
   These are all part of the Canvas V3 rollout. Older files (V20260402_* through V20260408_*) pre-date Canvas V3 and are out of scope — not in the problem zone.

4. **Current session's recent fixes on these two issues**:
   - `V20260410_12` — manually applied at ~07:30 CST (5 ALTER TABLE + 1 INSERT)
   - Green JVM restarted at ~07:32 CST to flush JDBC prepared statement cache
   - Blue JVM started at ~07:36 CST to restore `www.cretaceousfuture.com` traffic (which pointed at dead hardcoded 10010)
   - All of prod is currently healthy; this plan is preventative, not emergency

---

## File Structure

| File | Action | Owner |
|---|---|---|
| `/www/server/panel/vhost/nginx/www.cretaceousfuture.com.conf` (on 139) | Modify — 2 `proxy_pass` lines | Phase A |
| `/www/server/panel/vhost/nginx/www.cretaceousfuture.com.conf.bak.<ts>` (on 139) | Create (backup) | Phase A |
| `C:\Users\Steve\my-prototype-logistics\scripts\deploy\nginx-cretas-vhost-reference.md` | Create — snapshot of the recommended upstream pattern | Phase A |
| `/tmp/cretas-migration-replay/` (on 47) | Create (tmp) | Phase B |
| `C:\Users\Steve\my-prototype-logistics\docs\superpowers\plans\2026-04-11-migration-replay-results.md` | Create — replay log | Phase B |

---

## Phase A: Nginx upstream unification

**Why first:** Nginx stability protects against the NEXT blue-green deploy. If we ship a deploy before this lands, `www.cretaceousfuture.com` users get 502s again. Phase B is important but doesn't have this kind of time pressure.

### Task A1: Verify upstream is globally visible to the www vhost

**Files:** (read-only)

- [ ] **Step 1: Confirm `_upstream_cretas.conf` is loaded by the same nginx context as `www.cretaceousfuture.com.conf`**

```bash
ssh root@139.196.165.140 "grep -rn '_upstream_cretas\|include.*vhost/nginx' /www/server/nginx/conf/nginx.conf /www/server/panel/vhost/nginx/*.conf 2>/dev/null | grep -v 'api.cretaceousfuture' | head -10"
```

Expected: see an `include /www/server/panel/vhost/nginx/*.conf` line in the main nginx.conf http block, OR an explicit `include _upstream_cretas.conf`. This confirms the upstream is available globally.

If NOT found: STOP and investigate. Do not proceed to A2.

- [ ] **Step 2: Confirm the upstream name resolves in nginx's current loaded config**

```bash
ssh root@139.196.165.140 "nginx -T 2>/dev/null | grep -A2 'upstream cretas_backend' | head -5"
```

Expected:
```
upstream cretas_backend {
    server 47.100.235.168:10020;  # (or whatever port is active)
```

If the block is missing from `nginx -T` output, the upstream isn't actually loaded and Phase A cannot proceed. STOP and ask.

### Task A2: Backup + rewrite the 2 proxy_pass lines

**Files:**
- Modify: `/www/server/panel/vhost/nginx/www.cretaceousfuture.com.conf` (on 139)

- [ ] **Step 1: Back up the current config**

```bash
ssh root@139.196.165.140 "cp /www/server/panel/vhost/nginx/www.cretaceousfuture.com.conf /www/server/panel/vhost/nginx/www.cretaceousfuture.com.conf.bak.$(date +%Y%m%d_%H%M%S) && ls -lh /www/server/panel/vhost/nginx/www.cretaceousfuture.com.conf*"
```

Expected: original file and one new `.bak.YYYYMMDD_HHMMSS` file, both with the same size.

- [ ] **Step 2: Apply the 2 in-place rewrites via sed**

```bash
ssh root@139.196.165.140 "sed -i \
  -e 's|proxy_pass http://47.100.235.168:10010/api/mobile/|proxy_pass http://cretas_backend/api/mobile/|' \
  -e 's|proxy_pass http://47.100.235.168:10010/api/public/|proxy_pass http://cretas_backend/api/public/|' \
  /www/server/panel/vhost/nginx/www.cretaceousfuture.com.conf"
```

- [ ] **Step 3: Verify both lines were rewritten**

```bash
ssh root@139.196.165.140 "grep -n 'proxy_pass http://' /www/server/panel/vhost/nginx/www.cretaceousfuture.com.conf"
```

Expected output includes:
```
    proxy_pass http://127.0.0.1:8083/api/public/client-requirement/;  (unchanged, Python)
    proxy_pass http://cretas_backend/api/mobile/;
    proxy_pass http://cretas_backend/api/public/;
```

If either `/api/mobile/` or `/api/public/` still shows `47.100.235.168:10010`, sed didn't match — investigate the exact line text in the config (maybe extra whitespace) and fix.

### Task A3: nginx syntax check + reload

**Files:** none (server state change)

- [ ] **Step 1: Run `nginx -t` to check syntax**

```bash
ssh root@139.196.165.140 "nginx -t 2>&1 | grep -v 'ssl_stapling'"
```

Expected:
```
nginx: the configuration file /www/server/nginx/conf/nginx.conf syntax is ok
nginx: configuration file /www/server/nginx/conf/nginx.conf test is successful
```

If `nginx -t` fails: **immediately** rollback with `cp /www/server/panel/vhost/nginx/www.cretaceousfuture.com.conf.bak.* /www/server/panel/vhost/nginx/www.cretaceousfuture.com.conf` and investigate what the error says.

- [ ] **Step 2: Graceful reload**

```bash
ssh root@139.196.165.140 "nginx -s reload 2>&1 | grep -v ssl_stapling"
```

Expected: no output (success) OR just the benign ssl_stapling warning.

### Task A4: Functional verification + blue-green survivability test

**Files:** none (test only)

- [ ] **Step 1: Confirm the current traffic path still works**

```bash
curl -s -o /dev/null -w "domain /api/mobile/health: %{http_code}\n" https://www.cretaceousfuture.com/api/mobile/health
curl -s -o /dev/null -w "domain /api/public/trace/code/TEST: %{http_code}\n" https://www.cretaceousfuture.com/api/public/trace/code/TEST
```

Expected:
- `/api/mobile/health` → `200` (real health endpoint)
- `/api/public/trace/code/TEST` → `404` or similar (path exists, no such trace code — proves routing works)

If either returns `502` or `504`, nginx can't reach the upstream. Check which backend port the upstream currently points at:
```bash
ssh root@139.196.165.140 "grep 'server 47' /www/server/panel/vhost/nginx/_upstream_cretas.conf"
```
and verify that port is listening on 47:
```bash
ssh root@47.100.235.168 "ss -tlnp | grep -E ':(10010|10020)\b'"
```
If the upstream port is down, start the corresponding systemd service (`cretas-backend` for 10010, `cretas-backend-green` for 10020).

- [ ] **Step 2: Simulate a blue-green swap to verify www vhost follows it**

DO NOT actually run the full deploy. Instead, simulate by **temporarily toggling which backend is active** (since the other color is already running):
```bash
# Current state check: which ports are listening
ssh root@47.100.235.168 "ss -tlnp 2>/dev/null | grep -E ':(10010|10020)\b' | awk '{print \$4}'"
```

Expected: both `*:10010` and `*:10020` listening (blue + green both up from earlier in the session).

If BOTH are up, do the swap simulation:
```bash
# Read current upstream port
ssh root@139.196.165.140 "grep -oE 'server 47\.100\.235\.168:[0-9]+' /www/server/panel/vhost/nginx/_upstream_cretas.conf"
```

If it's currently `10020`, swap to `10010`:
```bash
ssh root@139.196.165.140 "sed -i 's|server 47\.100\.235\.168:10020|server 47.100.235.168:10010|' /www/server/panel/vhost/nginx/_upstream_cretas.conf && nginx -s reload 2>&1 | grep -v ssl_stapling"
```

(If it's already `10010`, swap to `10020` instead.)

- [ ] **Step 3: Verify www domain still works after the upstream swap**

```bash
curl -s -o /dev/null -w "after swap: %{http_code}\n" https://www.cretaceousfuture.com/api/mobile/health
```

Expected: `200`. If `502`: Phase A fix is incomplete, investigate.

- [ ] **Step 4: Restore the upstream to its previous state**

```bash
# Swap back to whatever port it was on before Step 2
ssh root@139.196.165.140 "grep -oE 'server 47\.100\.235\.168:[0-9]+' /www/server/panel/vhost/nginx/_upstream_cretas.conf"
```

If you swapped `10020→10010` in Step 2, swap it back now:
```bash
ssh root@139.196.165.140 "sed -i 's|server 47\.100\.235\.168:10010|server 47.100.235.168:10020|' /www/server/panel/vhost/nginx/_upstream_cretas.conf && nginx -s reload 2>&1 | grep -v ssl_stapling"
```

- [ ] **Step 5: Final sanity check**

```bash
curl -s -o /dev/null -w "final: %{http_code}\n" https://www.cretaceousfuture.com/api/mobile/health
```

Expected: `200`.

### Task A5: Snapshot the fixed config to the repo

**Files:**
- Create: `scripts/deploy/nginx-cretas-vhost-reference.md`

Since the nginx vhosts on 139 aren't in git, save a reference of the FIX pattern so future Baota regenerates or server rebuilds can re-apply it.

- [ ] **Step 1: Write the reference doc**

```bash
cat > scripts/deploy/nginx-cretas-vhost-reference.md <<'EOF'
# Cretas Nginx Vhost Reference

The nginx vhosts on `139.196.165.140` are managed by Baota and NOT committed
to git. This document records the **correct** upstream pattern all Cretas
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
| `www.cretaceousfuture.com` | `www.cretaceousfuture.com.conf` | ✅ Fixed 2026-04-11 (this plan) |
| `web-admin` | `web-admin.conf` | N/A — proxies to Python not Cretas Java |
| `centerapi.cretaceousfuture.com` | `java_logistics-admin.conf` | N/A — proxies to Mall admin not Cretas |

## Re-applying after a Baota regenerate

If Baota regenerates `www.cretaceousfuture.com.conf` or a server rebuild
restores an old version, the 2 `proxy_pass` lines will revert to hardcoded
port. Fix:

```bash
ssh root@139.196.165.140
sed -i \
  -e 's|proxy_pass http://47.100.235.168:10010/api/mobile/|proxy_pass http://cretas_backend/api/mobile/|' \
  -e 's|proxy_pass http://47.100.235.168:10010/api/public/|proxy_pass http://cretas_backend/api/public/|' \
  /www/server/panel/vhost/nginx/www.cretaceousfuture.com.conf
nginx -t && nginx -s reload
```
EOF
```

- [ ] **Step 2: Commit the reference doc (atomic branch-check + commit)**

```bash
git checkout main && git branch --show-current && git add scripts/deploy/nginx-cretas-vhost-reference.md && git commit -m "$(cat <<'COMMITEOF'
docs(nginx): cretas vhost upstream reference + fix www.cretaceousfuture

Record the rule that ALL Cretas vhosts on 139 must use the
http://cretas_backend upstream (defined in _upstream_cretas.conf and
rewritten by deploy-backend.sh v5.0 during blue-green swaps) rather
than hardcoding 47.100.235.168:10010.

Today's 502 outage on www.cretaceousfuture.com during an in-session
blue-green swap was caused by www.cretaceousfuture.com.conf having
hardcoded port 10010 in two proxy_pass lines. Fixed on 139 in the
live config (not in git). This doc is the reference for re-applying
the fix after future Baota regenerates or server rebuilds.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
COMMITEOF
)"
```

Expected: commit lands on `main`, not a feature branch. If `git branch --show-current` outputs anything other than `main`, STOP and switch first before committing (concurrent sessions have been flipping branches).

---

## Phase B: Migration replay (V20260409_* + V20260410_*)

**Why after Phase A:** Phase A protects against the NEXT blue-green swap outage. Phase B is a preventative cleanup — the current fire (`review_notes does not exist`) is already out, but there may be other un-applied migrations silently waiting to explode.

**Idempotency note:** Every migration in this batch uses `CREATE TABLE IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`, `INSERT ... ON CONFLICT DO NOTHING`, `CREATE INDEX IF NOT EXISTS`, etc. Re-running an already-applied migration is a no-op that outputs `NOTICE: ... already exists, skipping`. This is safe.

### Task B1: Copy migration files to the server

**Files:**
- Transfer: 20 `.sql` files from local to `/tmp/cretas-migration-replay/` on 47

- [ ] **Step 1: Create tmp dir on server + tar the migration batch locally**

```bash
ssh root@47.100.235.168 "mkdir -p /tmp/cretas-migration-replay && rm -f /tmp/cretas-migration-replay/*.sql"
tar czf /tmp/cretas-migrations.tar.gz -C backend/java/cretas-api/src/main/resources/db/migration/ V20260409_01__canvas_config_tables.sql V20260409_02__seed_sales_order_bom_schema.sql V20260409_03__seed_data_spec_alignment.sql V20260409_04__canvas_config_grants.sql V20260409_05__fix_rejected_resubmit_transition.sql V20260410_01__factory_tool_skill_trigger_tables.sql V20260410_02__seed_default_trigger_chains.sql V20260410_03__factory_validation_default_formula_scheduler_tables.sql V20260410_04__seed_core_validation_rules.sql V20260410_05__seed_bulk_validation_rules.sql V20260410_06__seed_default_values.sql V20260410_07__seed_scheduler_configs.sql V20260410_08__module_schemas_batch1_core.sql V20260410_09__module_schemas_batch2_operations.sql V20260410_10__module_schemas_batch3_support.sql V20260410_11__industry_templates.sql V20260410_12__config_review_publish_window.sql V20260410_13__canvas_dynamic_field_table.sql V20260410_14__canvas_ddl_log_table.sql V20260410_15__canvas_dynamic_field_version_tracking.sql
ls -lh /tmp/cretas-migrations.tar.gz
```

Expected: a tar.gz file ~10-50 KB.

- [ ] **Step 2: Upload + extract on server**

```bash
scp /tmp/cretas-migrations.tar.gz root@47.100.235.168:/tmp/cretas-migration-replay/
ssh root@47.100.235.168 "cd /tmp/cretas-migration-replay && tar xzf cretas-migrations.tar.gz && ls *.sql | wc -l"
```

Expected: `20` (number of SQL files). If not 20, one or more failed to transfer.

- [ ] **Step 3: Clean up local tar**

```bash
rm /tmp/cretas-migrations.tar.gz
```

### Task B2: Replay each migration in order, capturing output

**Files:**
- Execute (read + write DB): each `.sql` via `psql -f`
- Capture: output to `/tmp/cretas-migration-replay/replay.log`

- [ ] **Step 1: Run all 20 migrations in lexicographic order**

```bash
ssh root@47.100.235.168 'cd /tmp/cretas-migration-replay
: > replay.log
for f in $(ls V2026*.sql | sort); do
    echo "=== $f ===" | tee -a replay.log
    sudo -u postgres psql cretas_prod_db -f "$f" 2>&1 | tee -a replay.log
done
echo "=== SUMMARY ===" | tee -a replay.log
grep -cE "^(CREATE TABLE|ALTER TABLE|CREATE INDEX|INSERT|CREATE FUNCTION|CREATE TRIGGER|GRANT|NOTICE|ERROR)" replay.log | tee -a replay.log'
```

Expected: each `===` section produces a mix of `NOTICE: ... already exists, skipping` (for idempotent re-applies) and `CREATE TABLE` / `ALTER TABLE` / `INSERT 0 N` (for new applies). **NO `ERROR:` lines that don't contain `already exists`**.

- [ ] **Step 2: Audit the log for real errors (not "already exists")**

```bash
ssh root@47.100.235.168 "grep -E '^ERROR:' /tmp/cretas-migration-replay/replay.log | grep -v 'already exists' | head -20"
```

Expected: **empty output**. Any non-empty output is a real error that needs investigation before proceeding.

If non-empty: STOP, inspect the error, find which migration caused it. Common causes:
- Foreign key to a table that doesn't yet exist (order dependency — unlikely since the files are numbered)
- Permission denied (run as `postgres` user, already handled above)
- Syntax error (unlikely since migrations were tested on another env)

- [ ] **Step 3: Count real vs no-op applies**

```bash
ssh root@47.100.235.168 "echo '--- migrations with actual ADD COLUMN / CREATE statements (new applies): ---'
grep -B1 -E '^(CREATE TABLE|ALTER TABLE|CREATE INDEX)' /tmp/cretas-migration-replay/replay.log | grep '=== V' | sort -u
echo
echo '--- migrations that were fully no-op (all skipped): ---'
for f in /tmp/cretas-migration-replay/V2026*.sql; do
  name=\$(basename \$f)
  section=\$(awk '/=== '\"\$name\"' ===/,/=== V|=== SUMMARY/' /tmp/cretas-migration-replay/replay.log | head -200)
  if ! echo \"\$section\" | grep -qE '^(CREATE TABLE|ALTER TABLE|CREATE INDEX)'; then
    echo \"  \$name\"
  fi
done"
```

Expected: a list of migrations that actually changed the schema (new applies) and a list that were pure no-ops. The numbers help verify Phase B actually did work.

### Task B3: Functional verification

**Files:** none

- [ ] **Step 1: Confirm the tables that caused today's outages now exist with correct schema**

```bash
ssh root@47.100.235.168 "sudo -u postgres psql cretas_prod_db -c \"
SELECT table_name, column_name FROM information_schema.columns 
WHERE (table_name = 'factory_configurations' AND column_name IN ('review_notes','reviewed_by','reviewed_at','submitted_by','submitted_at'))
   OR (table_name = 'canvas_dynamic_field' AND column_name = 'active_from_version')
   OR (table_name = 'factory_scheduler_configs' AND column_name = 'cron_expression')
ORDER BY table_name, column_name\""
```

Expected: at least 7 rows covering all three tables/columns:
- `canvas_dynamic_field.active_from_version`
- `factory_configurations.review_notes, reviewed_at, reviewed_by, submitted_at, submitted_by`
- `factory_scheduler_configs.cron_expression`

- [ ] **Step 2: Spot-check that the current prod traffic is still clean**

```bash
curl -s -o /dev/null -w "prod: %{http_code}\n" https://www.cretaceousfuture.com/api/mobile/health
ssh root@47.100.235.168 "awk -v cutoff=\"\$(date -d '10 min ago' '+%Y-%m-%d %H:%M')\" '\$1\" \"\$2 >= cutoff' /www/wwwroot/cretas/logs/cretas-backend-error.log | grep -cE '^2026-04-11.*GlobalExceptionHandler'"
```

Expected:
- prod: `200`
- error count in last 10 min: `0`

- [ ] **Step 3: Clean up the tmp replay dir on server**

```bash
ssh root@47.100.235.168 "rm -rf /tmp/cretas-migration-replay"
```

### Task B4: Write a replay results doc + commit

**Files:**
- Create: `docs/superpowers/plans/2026-04-11-migration-replay-results.md`

- [ ] **Step 1: Write the results doc**

```bash
cat > docs/superpowers/plans/2026-04-11-migration-replay-results.md <<'EOF'
# Migration Replay Results — 2026-04-11

**Parent plan:** `2026-04-11-nginx-upstream-migration-audit.md`

**Scope:** V20260409_01 through V20260410_15 (20 migration files).

## Execution

Ran on prod server (`47.100.235.168`) via `sudo -u postgres psql cretas_prod_db -f <file>` in lexicographic order. All migrations in this batch are idempotent (`IF NOT EXISTS`, `ON CONFLICT DO NOTHING`), so replaying already-applied migrations is a no-op.

## Results

**REPLACE WITH ACTUAL RESULTS FROM TASK B2 Step 3 OUTPUT**

Example format:
- **New applies** (migrations that actually changed schema):
  - V20260410_12 — already applied in-session before the replay; confirmed 5 ALTER TABLE + 1 INSERT
  - (list any others)
- **No-ops** (migrations that were fully skipped — already applied in prior deploys):
  - V20260409_01, V20260409_02, ... (list)

## Follow-up

The fact that V20260410_12 wasn't applied until manual intervention means the project's migration pipeline is broken — migration files are committed with code but no process applies them to prod. Future work:

1. Enable Spring Boot Flyway (`spring-boot-starter-data-jpa` ships with it) — adds ~5s to startup but auto-applies on boot
2. OR add a `scripts/deploy/apply-migrations.sh` step to `deploy-backend.sh` that does `psql -f` for every file that's not in `flyway_schema_history`
3. OR document a manual pre-deploy checklist

See `docs/superpowers/plans/2026-04-11-nginx-upstream-migration-audit.md` Phase B for the replay history.
EOF
```

- [ ] **Step 2: Manually paste the actual results from Task B2 Step 3 into the doc**

Replace the "REPLACE WITH ACTUAL RESULTS FROM TASK B2 Step 3 OUTPUT" placeholder with the real output from `Task B2 Step 3`. Use the output verbatim; don't editorialize.

- [ ] **Step 3: Commit the results doc**

```bash
git checkout main && git branch --show-current && git add docs/superpowers/plans/2026-04-11-migration-replay-results.md && git commit -m "$(cat <<'COMMITEOF'
docs(plans): migration replay results 2026-04-11 (V20260409-V20260410 batch)

Record which Canvas V3 migrations (V20260409_01 through V20260410_15)
were actually applied vs no-op'd during the 2026-04-11 replay session.
Follow-up to the in-session emergency fix for V20260410_12 review_notes
columns missing from prod DB.

Includes a short follow-up section proposing 3 ways to prevent this
class of outage (enable Spring Boot Flyway; add apply-migrations.sh
to deploy-backend.sh; or document a manual pre-deploy checklist).

Parent plan: docs/superpowers/plans/2026-04-11-nginx-upstream-migration-audit.md

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
COMMITEOF
)"
```

---

## Self-review (to run by the plan executor)

Before marking this plan complete:

1. **Spec coverage**
   - [x] P1 (www.cretaceousfuture.com hardcoded port) — Phase A tasks A1-A5
   - [x] P2 (migration replay) — Phase B tasks B1-B4

2. **Placeholder scan**
   - [ ] NOTE: Task B4 Step 1 contains a "REPLACE WITH ACTUAL RESULTS" placeholder. This is intentional (the actual results come from executing Task B2) but the EXECUTOR must fill it in during Step 2 before committing. Do not leave the placeholder in the final commit.
   - All other steps have concrete commands and expected output.

3. **Type / name consistency**
   - `cretas_backend` (upstream name) used consistently throughout Phase A
   - Migration filenames match the actual files in `backend/java/cretas-api/src/main/resources/db/migration/`

4. **Rollback safety**
   - Phase A: `.bak.TIMESTAMP` file created in Task A2 Step 1
   - Phase B: all migrations are idempotent; no rollback needed beyond normal DB restore if something goes catastrophically wrong

---

## Execution order summary

| Phase / Task | Est time | Blocking? | Risk |
|---|---|---|---|
| A1. Verify upstream global | 2 min | Blocks A2+ | None (read-only) |
| A2. Edit 2 proxy_pass lines | 3 min | Blocks A3+ | Low — `.bak` created |
| A3. nginx -t + reload | 2 min | Blocks A4+ | Low — syntax check before reload |
| A4. Functional + BG swap test | 10 min | Blocks A5 | Medium — touches live upstream |
| A5. Commit snapshot doc | 3 min | — | None |
| B1. Copy migrations to server | 3 min | Blocks B2+ | None (tmp dir) |
| B2. Replay all 20 migrations | 5 min | Blocks B3+ | Low — idempotent |
| B3. Verify schema + prod health | 3 min | Blocks B4 | None |
| B4. Write results doc + commit | 5 min | — | None |

**Total: ~35 minutes**

## Post-plan verification checklist

```bash
# 1. www.cretaceousfuture.com survives blue-green
curl -s -o /dev/null -w "%{http_code}\n" https://www.cretaceousfuture.com/api/mobile/health
# Expected: 200

# 2. Phase B schema state
ssh root@47.100.235.168 "sudo -u postgres psql cretas_prod_db -tAc \"
SELECT COUNT(*) FROM information_schema.columns
WHERE table_name = 'factory_configurations'
  AND column_name IN ('review_notes','reviewed_at','reviewed_by','submitted_at','submitted_by')\""
# Expected: 5

# 3. No new errors
ssh root@47.100.235.168 "awk -v cutoff=\"\$(date -d '30 min ago' '+%Y-%m-%d %H:%M')\" '\$1\" \"\$2 >= cutoff' /www/wwwroot/cretas/logs/cretas-backend-error.log | grep -cE 'ERROR.*GlobalExceptionHandler'"
# Expected: 0

# 4. Reference doc committed
git log --oneline -5 | grep -cE 'nginx|migration-replay'
# Expected: 2 (Phase A and Phase B commits)
```
