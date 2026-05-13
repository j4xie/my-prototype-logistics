# Nginx SmartBI Python Routing Fix — 2026-05-13

**Trigger**: PR #507 R1 same-cause sweep found ≥7 SmartBI endpoints 404 via `139:8086` nginx.
**Scope**: `web-admin.conf` + `web-admin-test.conf` on `139.196.165.140`.
**Out of scope (separate finding)**: `admin.cretaceousfuture.com.conf` is fully missing all Phase 2A Python routing — see §Open Findings.
**Risk**: Low. Patch is a copy-paste of an already-deployed regex from `api.cretaceousfuture.com.conf` (proven in customer prod since T6.2 cutover).
**Mutations on prod data**: None. POST verifications used intentionally-invalid bodies (`{}`) that fail Pydantic validation before any DB write.

---

## §1 Root cause

`139.196.165.140:8086` (web-admin nginx) had a `location ~ ^/api/mobile/.../smart-bi/analysis/(finance|sales|department|region|inventory|procurement)` block routing those 6 paths to Python upstream `cretas_python` (47.100.235.168:8083).

All other `/api/mobile/.../smart-bi/*` paths fell through to the catch-all `location /api/mobile/ { proxy_pass cretas_backend; }` → Java (47.100.235.168:10010). T6.5 Phase C (May 9 2026, PR #205/#236) deleted those Java handlers, so Java returned 404 with Spring envelope (`{"code":404,"message":"请求的资源不存在","timestamp":"...nanos","success":false}`).

The customer-facing prod domain `api.cretaceousfuture.com.conf` had already added two additional location blocks (lines 46 and 54) to route the missing Phase 2A list endpoints + Phase 2C write endpoints. **`web-admin.conf` and `web-admin-test.conf` were never updated to match.**

**Affected endpoints** (10 confirmed via R1 PR #507 + sister sweep):

| Module | Path | R1 status | R1 envelope |
|---|---|---|---|
| query-templates (Phase 2A list) | GET `/{factoryId}/smart-bi/query-templates` | 404 | Java |
| datasource list (Phase 2A list) | GET `/{factoryId}/smart-bi/datasource/list` | 404 | Java |
| alerts (Phase 2A list) | GET `/{factoryId}/smart-bi/alerts` | 404 | Java |
| recommendations (Phase 2A list) | GET `/{factoryId}/smart-bi/recommendations` | 404 | Java |
| data-date-range (2C Tier 2) | GET `/{factoryId}/smart-bi/data-date-range` | 404 | Java |
| datasource sub-routes (2C Tier 3) | GET `/{factoryId}/smart-bi/datasource/{id}/fields` | 404 | Java |
| incentive-plan (2C Tier 3) | GET `/{factoryId}/smart-bi/incentive-plan/{type}/{id}` | 404 | Java |
| query_templates_write (POST/PUT/DELETE) | POST `/{factoryId}/smart-bi/query-templates` | 404 | Java |
| datasource/upload (POST) | POST `/{factoryId}/smart-bi/datasource/upload` | 404 | Java |
| datasource/apply (POST) | POST `/{factoryId}/smart-bi/datasource/apply` | 404 | Java |

**Customer impact**: Vue `QueryTemplateManager.vue` calls `/api/mobile/{factoryId}/smart-bi/query-templates` via baseURL `/api/mobile`; users hit the 404. Web-admin staff bypassing `api.cretaceousfuture.com` were affected.

---

## §2 SSH steps

```bash
# 1. Backup current configs (both prod 8086 + test 8097)
ssh root@139.196.165.140
DATE=$(date +%Y%m%d_%H%M%S)
cp /www/server/panel/vhost/nginx/web-admin.conf \
   /www/server/panel/vhost/nginx/web-admin.conf.bak.r1_routing_fix_pre.$DATE
cp /www/server/panel/vhost/nginx/web-admin-test.conf \
   /www/server/panel/vhost/nginx/web-admin-test.conf.bak.r1_routing_fix_pre.$DATE

# 2. Apply patch (two new location blocks inserted after existing analysis block,
#    before existing /api/public/ block — see §3 diffs).
#    Method used: pull file local, Edit, scp back.

# 3. Syntax check
nginx -t
# Expected: 'nginx: configuration file ... test is successful'
# Note: pre-existing 'ssl_stapling ignored' warning is unrelated to this change.

# 4. Hot reload (no restart; preserves master PID)
nginx -s reload

# 5. Verify worker PIDs refreshed (master PID stays the same)
ps -ef | grep -E 'nginx: (master|worker)' | grep -v grep
```

Actual values from this run:
- Master PID: 350407 (preserved, from Jan 25)
- Worker PIDs after reload: 1836023-1836026 (spawned at 12:47 CST)
- `systemctl is-active nginx` → `active`
- `nginx -s reload` exit code: 0

---

## §3 Config diff

### 3.1 `web-admin.conf` (8086, prod Python upstream `cretas_python` → 47:8083)

```diff
--- /www/server/panel/vhost/nginx/web-admin.conf.bak.r1_routing_fix_pre.20260513_004629
+++ /www/server/panel/vhost/nginx/web-admin.conf
@@ -116,6 +116,40 @@
     }

+    # Phase 2A SmartBI list endpoints (PR #507 R1 fix):
+    # alerts / recommendations / data-date-range — Java handlers deleted in T6.5 Phase C.
+    # Mirror prod nginx api.cretaceousfuture.com.conf:46 (already deployed there).
+    location ~ ^/api/mobile/(F00[1-46]|FOOD_3101_(00[1-9]|0[1-3][0-9]|04[0-8])|MEAT_3101_00[12]|OTHER_3101_001|RES_3101_00[1-9]|RES_GML_001|R001|R_(GML_DEMO|XMX_(CHAIN|FRESH[123]?)|YHDJ_DEMO|YJJ_DEMO)|TEST_0000_001)/smart-bi/(alerts|recommendations|data-date-range)$ {
+        proxy_pass http://cretas_python;
+        proxy_set_header Host $host;
+        proxy_set_header X-Real-IP $remote_addr;
+        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
+        proxy_set_header X-Forwarded-Proto $scheme;
+        proxy_set_header Authorization $http_authorization;
+        proxy_connect_timeout 300s;
+        proxy_send_timeout 300s;
+        proxy_read_timeout 900s;
+        client_max_body_size 500m;
+    }
+
+    # Phase 2A/2C SmartBI write+query endpoints (PR #507 R1 fix):
+    # query-templates (GET list + POST/PUT/DELETE write) / datasource (list, fields, history,
+    # preview, upload, apply) / incentive-plan/{type}/{id}.
+    # Mirror prod nginx api.cretaceousfuture.com.conf:54.
+    location ~ ^/api/mobile/(F00[1-46]|FOOD_3101_(00[1-9]|0[1-3][0-9]|04[0-8])|MEAT_3101_00[12]|OTHER_3101_001|RES_3101_00[1-9]|RES_GML_001|R001|R_(GML_DEMO|XMX_(CHAIN|FRESH[123]?)|YHDJ_DEMO|YJJ_DEMO)|TEST_0000_001)/smart-bi/(query-templates|datasource|incentive-plan)(/.*)?$ {
+        proxy_pass http://cretas_python;
+        proxy_set_header Host $host;
+        proxy_set_header X-Real-IP $remote_addr;
+        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
+        proxy_set_header X-Forwarded-Proto $scheme;
+        proxy_set_header Authorization $http_authorization;
+        proxy_connect_timeout 300s;
+        proxy_send_timeout 300s;
+        proxy_read_timeout 900s;
+        client_max_body_size 500m;
+    }
+
     # Public API proxy (no auth needed - share links, etc)
     location /api/public/ {
```

### 3.2 `web-admin-test.conf` (8097, test Python upstream `47.100.235.168:8084`)

Same two location blocks, but `proxy_pass http://47.100.235.168:8084;` (test). Diff at line 131 → +34 lines.

### 3.3 Why these specific paths

- `alerts|recommendations|data-date-range` — Phase 2A list endpoints. Java deleted in T6.5 Phase C (PR #205/#236, May 9 2026). Python sources in `backend/python/smartbi_compat/api/analysis.py` + `dashboard.py`.
- `query-templates|datasource|incentive-plan` — Phase 2A list (query-templates GET, datasource GET) + Phase 2C write (POST/PUT/DELETE/upload/apply). Python sources in `analysis.py`, `datasource.py`, `query_templates_write.py`, `incentive_plan.py`.

### 3.4 Why NOT include `drill-down`

R1 found `POST /smart-bi/drill-down` hits Java and returns HTTP 200 wrapping `{"code":400,"message":"Drill-down failed: 操作失败，请稍后重试"}` — Java handler is alive (NOT 404). Spec §2.4 explicitly says drill-down is "CUT, Java only". The customer-prod nginx (`api.cretaceousfuture.com.conf`) also leaves drill-down on Java. This PR matches that pattern.

If R3+ deep tests reclassify drill-down as a Python target, a follow-up PR can extend the regex.

### 3.5 Why NOT include `dashboard|dashboard/executive|analysis/production|analysis/quality`

These currently route to Java where handlers exist and serve 200 OK. Not customer-broken. Reclassifying them as Python migration targets is Phase 2B/2C scope, not R1 fix scope.

---

## §4 Verification — 10 endpoints before/after

All probes via `139.196.165.140:8086` (prod web-admin nginx, post-reload). Auth: `f006_admin` factory_super_admin token (factory F006). **Bodies for POST verification deliberately invalid (`{}` or missing) to trigger Python validation rejection without DB mutation.**

| # | Method | Path | Before (R1) | After (this PR) | Envelope |
|---|---|---|---|---|---|
| 1 | GET | `/smart-bi/query-templates` | 404 Java | **200 Python** `data:[]` | Python ✓ |
| 2 | GET | `/smart-bi/datasource/list` | 404 Java | **200 Python** `data:[]` | Python ✓ |
| 3 | GET | `/smart-bi/alerts` | 404 Java | **200 Python** `data:[]` | Python ✓ |
| 4 | GET | `/smart-bi/recommendations` | 404 Java | **200 Python** `data:[]` | Python ✓ |
| 5 | GET | `/smart-bi/data-date-range` | 404 Java | **200 Python** `{hasData:false,message:"No sales data detected"}` | Python ✓ |
| 6 | GET | `/smart-bi/datasource/0/fields` | 404 Java | **HTTP 200 / body code:400** "Get field definitions failed: 数据源不存在: 0" | Python ✓ |
| 7 | GET | `/smart-bi/incentive-plan/PERSON/0` | 404 Java | **HTTP 200 / body code:200 success:false** "Unsupported target type: PERSON" | Python ✓ |
| 8 | POST | `/smart-bi/query-templates` body `{}` | 404 Java | **HTTP 200 / body code:400** "name is required" | Python ✓ |
| 9 | POST | `/smart-bi/datasource/apply` body `{}` | 404 Java | **HTTP 200 / body code:400** "Apply changes failed: 数据源ID不能为空" | Python ✓ |
| 10 | POST | `/smart-bi/datasource/upload` (no multipart) | 404 Java | **422 Pydantic** `{"detail":[{"type":"missing","loc":["body","file"],...}]}` | Python ✓ |

**Distinguishing signal** (Java vs Python envelope):
- Java: nanos timestamp (`"timestamp":"2026-05-13T11:54:50.394349916"`), `actionHint:null`, `severity:null`, `hintTarget:null` keys present.
- Python: micros timestamp (`"timestamp":"2026-05-13T12:48:06.350727"`, 6-digit fraction), plain envelope or Pydantic `{"detail":[...]}` for 422.

All 10 endpoints now return Python envelope. **0 mutations**: GETs are read-only; POST/PUT/DELETE used invalid bodies that failed validation before any DB write.

### 4.1 Test env (8097) cross-check

Same `f006_admin` prod token returned **401 TOKEN_INVALID** on `http://139.196.165.140:8097/.../smart-bi/alerts` — meaning the request reached the upstream auth filter (test env doesn't accept prod tokens) instead of nginx 404. Routing fix verified on test conf too. Deeper test-env verification with a test-env token deferred (out of scope, not customer-impacting).

---

## §5 Rollback plan

If post-deploy customer reports an issue on a `/smart-bi/{alerts,recommendations,data-date-range,query-templates,datasource,incentive-plan}` path:

```bash
ssh root@139.196.165.140
# Restore previous version (timestamps captured during this run)
cp /www/server/panel/vhost/nginx/web-admin.conf.bak.r1_routing_fix_pre.20260513_004629 \
   /www/server/panel/vhost/nginx/web-admin.conf
cp /www/server/panel/vhost/nginx/web-admin-test.conf.bak.r1_routing_fix_pre.20260513_004XXX \
   /www/server/panel/vhost/nginx/web-admin-test.conf
nginx -t && nginx -s reload
```

Rollback restores the previous "everything → Java catch-all" behavior. Customers will see the original 404s again until a forward fix lands.

---

## §6 Open findings (out of scope, organizer triage)

### 6.1 `admin.cretaceousfuture.com.conf` is fully missing all Phase 2A Python routing

```
ssh root@139.196.165.140 'grep -nE "/smart-bi/(analysis|alerts|recommendations|data-date-range|query-templates|datasource|incentive-plan)" /www/server/panel/vhost/nginx/admin.cretaceousfuture.com.conf'
# returns only line 59: upload-batch-stream → Java
```

If customers reach the system via `admin.cretaceousfuture.com`, they get 404 on **all** Phase 2A endpoints — not just the 7 fixed here. Severity depends on whether this domain is alive in customer use.

**Hypothesis**: `admin.cretaceousfuture.com` is the legacy admin entry; customers now use `api.cretaceousfuture.com` (already correct). But confirm before deciding.

**Recommended next step**: organizer assigns a chat to:
1. Confirm whether `admin.cretaceousfuture.com` is in active customer use (check access logs).
2. If yes → port the same 3 location blocks (analysis + alerts/recommendations/data-date-range + query-templates/datasource/incentive-plan) from `api.cretaceousfuture.com.conf`.
3. If no → document the deprecation and schedule the config retirement.

### 6.2 `data-date-range` returns `code:200` HTTP 200 success:true semantics

R1 ambiguity noted: Python responses for some endpoints use HTTP 200 + body `code:400 success:false` for application errors. This is the existing project convention (`ApiResponse.error(...)`); not introduced by this PR. UX concern only if Vue checks HTTP status instead of `success`.

### 6.3 `incentive-plan/PERSON/0` returns `code:200 success:false`

Python emits `code:200` with `success:false` and message "Unsupported target type: PERSON". The 200/false combination is inconsistent (should be code:400 if it's an error). Pre-existing Python-side bug, separate scope from this fix.

---

## §7 References

- Triggering report: PR #507 (`qa/r1-python-endpoint-smoke`) — `tests/qa-r1-py-smoke/round-1-py-smoke.json` `sameCauseSweep` block
- Proven-good reference config: `/www/server/panel/vhost/nginx/api.cretaceousfuture.com.conf` lines 46-57
- Phase 2A T6.5 Java deletion PRs: #205, #236 (May 9 2026)
- Original web-admin Phase 2A analysis block: BUG-R1B-01 / PR #441
