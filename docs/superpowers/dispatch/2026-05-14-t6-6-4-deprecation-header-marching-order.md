# ⏳ QUEUED — T6.6.4 Java deprecation header — wait for T6.6.3c + 24h soak GO

**From**: organizer chat (Phase 2A T6.6 cutover cascade)
**Date drafted**: 2026-05-14
**Target execution**: 2026-05-15 03:45 CST (earliest) to 2026-05-17 03:45 CST (latest) — see HOLD §1
**Phase**: T6.6 cleanup — modifies prod nginx vhost on 139 + Java `@Deprecated` annotation. **No traffic re-routing.** Restaurant cutover already complete via T6.6.3c (PR #543).
**Spec reference**: `docs/superpowers/specs/2026-05-11-t6-6-cutover-spec.md` §3.4 + §4.1 + §6.2

---

## 你的任务

执行 T6.6.4 "cleanup + Java deprecation header" — T6.6 cutover cascade 的最后一步。

🎯 **目标 (2 件事)**:

1. **nginx 端**: 在 `api.cretaceousfuture.com.conf` factory-tenant Java location block (T6.6.3c 已加的, line: `~ ^/api/mobile/(F[^/]+|HQ_[^/]+|CK_[^/]+)/smart-bi/analysis/(production|quality)$`) 加 `add_header X-SmartBI-Deprecated "..."`. 这告诉下游 consumer (frontend / monitoring) 这条 Java 路径在 deprecated-fallback 模式 (餐厅租户已搬 Python; 工厂租户暂留 Java 等 Phase 2D).
2. **Java 端**: `SmartBIAnalysisController.getProductionAnalysis` + `getQualityAnalysis` 加 `@Deprecated` Javadoc 注解, point 到 Python 模块.

**NOT 改**: nginx routing rules / Python code / factory-tenant traffic routing / `/query` / `/drill-down` (这俩仍属 Java 全租户, 不在 T6.6.4 scope, 留 T6.6.bis 或 T7 决).

---

## ⛔ HOLD until trigger

- [ ] **T6.6.3c (PR #543) merged**: ✅ verified 2026-05-13T19:45:11Z UTC = **2026-05-14 03:45 CST** (mergeCommit per `gh pr view 543 --json mergedAt,mergeCommit,state`). Confirmed pre-dispatch.
- [ ] **24h post-T6.6.3c observation window passed**: earliest start = **2026-05-15 03:45 CST**. Latest start (per spec §3.4 "24-72h"): **2026-05-17 03:45 CST**.
  - ⚠️ Steve's MO had a shorthand `→ soak ends 2026-05-14T19:45 CST`. That reads the PR's UTC timestamp as if it were CST. **Correct CST trigger is 2026-05-15 03:45 CST** (UTC+8 conversion of 2026-05-14T19:45:11Z). Either gate is acceptable per spec — confirm with organizer if uncertain.
- [ ] **No outstanding P1/P2 from T6.6.3a/b/c**: query bug tracker / Steve direct. None as of 2026-05-14 06:00 CST per chat3 #544+#548 verification (issue #539 closed, gold ETL working all 19 affected tenants).
- [ ] **No active prod incident on Java backend / Python service**: `systemctl status cretas-backend cretas-python` both `active (running)`.
- [ ] **No active T6.6.3c rollback in flight**: nginx vhost on 139 should be at the T6.6.3c regex shape (per PR #543 commit body).

---

## Step 0 — Worktree

```bash
cd C:/Users/Steve/my-prototype-logistics
git fetch origin main
git worktree add C:/Users/Steve/cretas-t6-6-4-deprecation -b ops/t6-6-4-deprecation-header origin/main
cd C:/Users/Steve/cretas-t6-6-4-deprecation
```

---

## Step 1 — Read spec sections (no skipping)

```bash
# Full spec — focus on T6.6.4 + nginx + comms sections:
sed -n '231,243p' docs/superpowers/specs/2026-05-11-t6-6-cutover-spec.md   # §3.4 T6.6.4 spec
sed -n '249,284p' docs/superpowers/specs/2026-05-11-t6-6-cutover-spec.md   # §4.1 nginx vhost diff
sed -n '378,403p' docs/superpowers/specs/2026-05-11-t6-6-cutover-spec.md   # §6.2 stage-to-customer mapping (T6.6.4 = 0 comms)
```

**Spec authoritative header text** (per §4.1 line 276 of cutover spec):

```
X-SmartBI-Deprecated: T6.6 — restaurant tenants on Python; factory tenants stay on Java pending Phase 2D
```

⚠️ **Open question — Sunset header?** Spec does NOT include an RFC 8594 `Sunset: <date>` directive. Steve's MO mentioned `sunset=...` as possible syntax. Recommendation:

- **Phase 2D ship date is currently TBD** (deferred indefinitely per `project_2026_05_11_aggressive_revised_state.md`).
- Without a concrete date, omit `Sunset:` header per RFC 8594 best practice (avoids false advertising a sunset that won't happen).
- If organizer DOES want a placeholder sunset date (e.g., "2027-01-01"), add separate `add_header Sunset "Sat, 01 Jan 2027 00:00:00 GMT";`. Confirm before adding.

**Default action**: header text exactly as in spec §4.1, NO `Sunset:` directive.

---

## Step 2 — nginx vhost edit (server 139, baota-managed)

### 2.1 SSH + backup

```bash
ssh root@139.196.165.140 "
  cd /www/server/panel/vhost/nginx
  TS=\$(date +%Y%m%d_%H%M%S)
  cp api.cretaceousfuture.com.conf api.cretaceousfuture.com.conf.bak.t6_6_4_pre.\$TS
  ls -lt api.cretaceousfuture.com.conf.bak.t6_6_4_pre.* | head -1
  echo 'T6.6.4 pre-deprecation backup created.'
"
```

### 2.2 Locate factory-tenant Java location block

```bash
ssh root@139.196.165.140 "
  cd /www/server/panel/vhost/nginx
  grep -nE 'F\[\\^/\\]\\+|HQ_\\[|CK_\\[' api.cretaceousfuture.com.conf | head -5
"
```

Expected: 1-line match showing the factory-tenant location block added by T6.6.3c (PR #543) or earlier T6.6.3a/b. The line should be something like:

```
location ~ ^/api/mobile/(F[^/]+|HQ_[^/]+|CK_[^/]+)/smart-bi/analysis/(production|quality)$ {
```

If the existing nginx config uses a DIFFERENT factory-tenant shape (e.g., explicit factory_id whitelist), match the existing pattern — DON'T introduce a new regex shape.

### 2.3 Add `add_header` inside the factory-tenant block

Edit the vhost to insert exactly **1 line** inside the factory Java `location { ... }` block (after the existing `proxy_pass` + `include` lines):

```diff
 location ~ ^/api/mobile/(F[^/]+|HQ_[^/]+|CK_[^/]+)/smart-bi/analysis/(production|quality)$ {
     proxy_pass http://cretas_backend;
     include cretas-java-proxy-defaults.conf;
+    # T6.6.4 deprecation header: signals to downstream consumers that this Java
+    # path is in deprecated-fallback mode. Restaurant tenants are on Python via
+    # the sibling restaurant location block (per T6.6.3c). Factory-tenant Java
+    # path stays until Phase 2D ships factory Silver migration.
+    add_header X-SmartBI-Deprecated "T6.6 — restaurant tenants on Python; factory tenants stay on Java pending Phase 2D" always;
 }
```

⚠️ **`always` modifier required**: by default, nginx `add_header` only fires on 200/204/206/301/302/303/304/307/308 responses. `always` makes it fire on ALL status codes including 4xx/5xx — necessary because deprecation context applies regardless of response status.

### 2.4 nginx syntax check + reload

```bash
ssh root@139.196.165.140 "
  nginx -t
  if [ \$? -eq 0 ]; then
    nginx -s reload
    echo 'nginx reloaded — T6.6.4 header active'
  else
    echo 'nginx syntax check FAILED — rolling back'
    cp api.cretaceousfuture.com.conf.bak.t6_6_4_pre.\$TS api.cretaceousfuture.com.conf
    nginx -t && nginx -s reload
    exit 1
  fi
"
```

### 2.5 Verify header live via curl -I (per spec §3.4 GO criteria)

```bash
# Test factory-tenant path → expects X-SmartBI-Deprecated header
curl -I -H "Authorization: Bearer $F001_TOKEN" \
  "http://api.cretaceousfuture.com/api/mobile/F001/smart-bi/analysis/production?type=daily"
# Look for: X-SmartBI-Deprecated: T6.6 — ...

# Test restaurant-tenant path → expects NO header (Python upstream, doesn't add the header)
curl -I -H "Authorization: Bearer $R_QHJ_TOKEN" \
  "http://api.cretaceousfuture.com/api/mobile/R_QINGHUAJIAO_REAL/smart-bi/analysis/production?type=daily"
# Expect: NO X-SmartBI-Deprecated header (Python path is the post-cutover canonical, not deprecated)
```

✅ **GO**: factory path has header, restaurant path does not.

---

## Step 3 — Java `@Deprecated` annotation

### 3.1 File location

```
backend/java/cretas-api/src/main/java/com/cretas/aims/controller/SmartBIAnalysisController.java
  - line 81: @GetMapping("/analysis/production") + line 83: public ResponseEntity<...> getProductionAnalysis(...)
  - line 121: @GetMapping("/analysis/quality") + line 123: public ResponseEntity<...> getQualityAnalysis(...)
```

⚠️ **NOT touching**: lines 160 (`@PostMapping("/query")`) and 200 (`@PostMapping("/drill-down")`) — these stay Java for ALL tenants per spec §2.2 (out-of-scope), not deprecated in T6.6.4 scope.

### 3.2 Patch — add `@Deprecated` + Javadoc

For each of the 2 methods, replace the method signature region (above the existing `@GetMapping` annotation) with:

```java
    /**
     * @deprecated As of T6.6.4 (2026-05-14): restaurant tenants are served by the Python
     * implementation in {@code smartbi_compat.api.analysis_production}
     * (mirror: {@code analysis_quality} for the quality variant). Factory-tenant traffic
     * continues to use this Java handler until Phase 2D ships the factory Silver migration.
     * nginx routing (server 139 vhost) routes restaurant tenants directly to Python;
     * Java is only invoked for factory tenants and as a fallback.
     */
    @Deprecated
    @GetMapping("/analysis/production")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getProductionAnalysis(
        ...existing signature unchanged...
    )
```

Repeat for `getQualityAnalysis` (line 123) — change Python mirror reference to `smartbi_compat.api.analysis_quality`.

### 3.3 Verify PythonSmartBIClient forwarding pair already exists (per spec §3.4 action 3)

```bash
grep -nE 'callAnalysisProduction|callAnalysisQuality' \
  backend/java/cretas-api/src/main/java/com/cretas/aims/client/PythonSmartBIClient.java
```

Expected: ≥2 matches (one per method). These were added by PR #360 (chat1 router wiring). If missing, **STOP — pre-req gap**, ping organizer.

---

## Step 4 — Local validation (per spec §3.4 GO criteria)

```bash
# Java compile
cd backend/java/cretas-api
mvn compile -DskipTests   # expect BUILD SUCCESS

# Java unit tests (existing — confirm no regression)
mvn test -Dtest=SmartBIAnalysisControllerTest 2>&1 | tail -20   # or whatever existing test class covers it
mvn test 2>&1 | grep -E 'Tests run|BUILD'                       # full suite summary

# Vue tsc (catches any frontend SDK that imports the deprecated endpoint)
cd ../../../web-admin
npm run type-check 2>&1 | tail -10                              # expect 0 errors
```

✅ **GO**: `mvn compile` BUILD SUCCESS + Vue tsc 0 errors + unit tests pass.

---

## Step 5 — Commit nginx config snapshot to repo (per spec §4.5)

The applied nginx vhost MUST be snapshotted to the repo for version control:

```bash
ssh root@139.196.165.140 "cat /www/server/panel/vhost/nginx/api.cretaceousfuture.com.conf" \
  > scripts/deploy/nginx/api.cretaceousfuture.com.conf.t6-6-4

# OR if there's an existing canonical path, overwrite it:
ssh root@139.196.165.140 "cat /www/server/panel/vhost/nginx/api.cretaceousfuture.com.conf" \
  > scripts/deploy/nginx/api.cretaceousfuture.com.conf

# Diff against previous to confirm only the add_header line was added:
git diff scripts/deploy/nginx/api.cretaceousfuture.com.conf
```

---

## Step 6 — Deploy Java code (organizer's call — does NOT auto-deploy)

This marching order does NOT include Java prod deploy. After commit + PR + admin-merge, organizer decides deploy timing:

- Java `@Deprecated` annotation is doc-only — no runtime behavior change
- Can be deferred or batched with other Java changes
- Recommended: deploy at next normal release window via `./scripts/deploy/deploy-backend.sh --env prod` (per `.claude/rules/server-operations.md`)

The nginx header change (Step 2) IS already live by this point — that's the user-visible part.

---

## Step 7 — Customer communications

**ZERO customer comms per spec §6.2 T6.6.4 row**:

> | **T6.6.4** | Day 4-5 | any window | (no customer comms — internal deprecation header only) | 0 |

The header is for INTERNAL downstream consumers (monitoring, devops, future migration audits). Not customer-visible. Sales does NOT send any notice.

---

## Step 8 — Active-E2E verify (post-Step 6 if Java deployed; otherwise post-Step 2)

Per `feedback_active_e2e_replaces_passive_soak.md` HARD — no passive soak.

```bash
# Time-bound ~15 min:

# 1. Factory tenant /analysis/production gets header
curl -I -H "Authorization: Bearer $F001_ADMIN_TOKEN" \
  "http://api.cretaceousfuture.com/api/mobile/F001/smart-bi/analysis/production?type=daily" \
  | grep -i x-smartbi-deprecated
# Expect: X-SmartBI-Deprecated: T6.6 — ...

# 2. Factory tenant /analysis/quality gets header
curl -I -H "Authorization: Bearer $F001_ADMIN_TOKEN" \
  "http://api.cretaceousfuture.com/api/mobile/F001/smart-bi/analysis/quality?type=daily" \
  | grep -i x-smartbi-deprecated
# Expect: same header

# 3. Restaurant tenant /analysis/production does NOT get header (Python)
curl -I -H "Authorization: Bearer $R_QHJ_ADMIN_TOKEN" \
  "http://api.cretaceousfuture.com/api/mobile/R_QINGHUAJIAO_REAL/smart-bi/analysis/production?type=daily" \
  | grep -i x-smartbi-deprecated
# Expect: empty (no header — Python path is canonical post-cutover)

# 4. Out-of-scope endpoints stay clean
curl -I -H "Authorization: Bearer $F001_ADMIN_TOKEN" -X POST \
  "http://api.cretaceousfuture.com/api/mobile/F001/smart-bi/query" \
  | grep -i x-smartbi-deprecated
# Expect: empty — /query is NOT deprecated; only /analysis/(production|quality) are

# 5. Java side @Deprecated annotation visible in source (post-deploy)
ssh root@47.100.235.168 "grep -B1 'getProductionAnalysis\\|getQualityAnalysis' \
  /www/wwwroot/cretas/code/backend/java/cretas-api/src/main/java/com/cretas/aims/controller/SmartBIAnalysisController.java \
  | head -20"
# Expect: '@Deprecated' annotation visible (post-Java-deploy; before deploy, only repo has it)
```

✅ **GO**: 5/5 checks PASS.

---

## Step 9 — Rollback procedure

### 9.1 Rollback nginx (header revert) — ~30 sec

```bash
ssh root@139.196.165.140 "
  cd /www/server/panel/vhost/nginx
  # Find most recent T6.6.4 pre-backup
  BACKUP=\$(ls -t api.cretaceousfuture.com.conf.bak.t6_6_4_pre.* | head -1)
  cp \$BACKUP api.cretaceousfuture.com.conf
  nginx -t && nginx -s reload
  echo \"Reverted to \$BACKUP\"
"
```

### 9.2 Rollback Java (revert @Deprecated annotation) — only if deployed

`git revert <PR-merge-commit>` then `./scripts/deploy/deploy-backend.sh --env prod`. Or just leave the @Deprecated annotation in place — it's doc-only and has no runtime effect; the only reason to revert is if someone explicitly objects to the deprecation signal.

### 9.3 Rollback triggers (per spec §5.1, adapted for T6.6.4)

| Metric | Threshold | Window | Source |
|---|---|---|---|
| nginx config syntax error (`nginx -t` FAIL) | any | immediate | nginx reload output |
| Java compile failure on PR build | any | immediate | CI / local `mvn compile` |
| User-reported issue: missing header on factory path | any | post-deploy | downstream consumer / monitoring |
| User-reported issue: header on restaurant path (should NOT have it) | any | post-deploy | downstream consumer / monitoring |

⚠️ **No traffic-routing rollback needed**: T6.6.4 does not change routing. If something goes wrong, only the header revert (9.1) is needed.

---

## Estimated effort

| Step | Time |
|---|---|
| Worktree + spec re-read (Steps 0-1) | 10 min |
| nginx edit + backup + verify (Step 2) | 20 min |
| Java `@Deprecated` annotation (Step 3) | 15 min |
| Local validation (Step 4) | 15 min |
| nginx snapshot commit (Step 5) | 5 min |
| Active-E2E (Step 8) | 15 min |
| Commit + PR + admin-merge | 10 min |
| **TOTAL** | **~1.5 hours** |

Deploy (Step 6) is separate, organizer's call, ~10 min when scheduled.

---

## PR title / body template

```
PR title:
ops(t6-6-4): Java deprecation header — restaurant on Python, factory stays Java

PR body:
## Summary
T6.6.4 cleanup phase per spec `docs/superpowers/specs/2026-05-11-t6-6-cutover-spec.md` §3.4.
Adds X-SmartBI-Deprecated nginx response header on factory-tenant /analysis/(production|quality) Java path.
Adds @Deprecated Javadoc on SmartBIAnalysisController.getProductionAnalysis + getQualityAnalysis.
Restaurant tenants are already on Python (T6.6.3c, PR #543). No traffic re-routing.

## Verification (curl -I from chat3 marching order Step 8):
- [x] F001 /analysis/production: X-SmartBI-Deprecated: T6.6 — ... ✅
- [x] F001 /analysis/quality: same header ✅
- [x] R_QINGHUAJIAO_REAL /analysis/production: no header ✅ (Python upstream)
- [x] F001 /query: no header ✅ (out-of-scope endpoint)
- [x] mvn compile BUILD SUCCESS ✅
- [x] Vue tsc 0 errors ✅
- [x] nginx -t syntax OK ✅
- [x] Backup committed: scripts/deploy/nginx/api.cretaceousfuture.com.conf.t6_6_4_pre.*

## Customer comms
ZERO per spec §6.2 T6.6.4 row.

## Rollback
nginx: ~30 sec via backup restore (Step 9.1). Java: no rollback needed (doc-only annotation).

Closes T6.6.4 phase of T6.6 cutover.
```

---

## ⚠️ Risks & gotchas

1. **nginx vhost on 139 may have drifted since T6.6.3c.** Step 2.2 grep is mandatory — match the EXISTING factory-tenant block shape, don't introduce a new regex.
2. **`always` modifier on `add_header`**: required (Step 2.3 note). Without `always`, header won't fire on 4xx/5xx responses, leaving gaps.
3. **Restaurant tenant must NOT get the header.** If §4.1 factory regex incorrectly matches a restaurant tenant, header would mis-signal. Active-E2E Step 8 check #3 catches this.
4. **`/query` + `/drill-down` are NOT in scope.** Tempting to add the header there too "for consistency" — DON'T. Spec §2.2 says these stay Java for all tenants, NOT deprecated.
5. **PythonSmartBIClient forwarding pair must exist** (Step 3.3 verification). If missing, dispatch is blocked — PR #360 should have shipped it.
6. **`Sunset:` header is intentionally omitted.** RFC 8594 says only advertise a sunset date if you'll honor it. Phase 2D is TBD. If organizer wants a placeholder date, see Step 1 ⚠️ block.

---

## Sign-off

- [ ] Spec §3.4 + §4.1 + §6.2 re-read by executing chat
- [ ] HOLD checklist confirmed pre-dispatch
- [ ] nginx backup created + verified (`ls -lt` shows new backup file)
- [ ] nginx -t syntax check PASS before reload
- [ ] Active-E2E 5/5 checks PASS (Step 8)
- [ ] PR opened with verification checklist in body
- [ ] Organizer admin-merge GO

---

## After T6.6.4 completion

T6.6.4 completes the T6.6 cutover cascade. Next deferred work (NOT this dispatch):

- **T6.6.bis or T7**: `/query` + `/drill-down` cutover — depends on Phase 2C Python port progress (currently Java-only per spec §0.1 line 25-26)
- **Phase 2D**: factory Silver migration → eventually retire Java `getProductionAnalysis` / `getQualityAnalysis` entirely (indefinite per `project_2026_05_11_aggressive_revised_state.md`)
- **`scripts/deploy/nginx/api.cretaceousfuture.com.conf`** repo snapshot becomes the source-of-truth for future nginx edits per spec §4.5

Save closeout note to `project_2026_05_15_t6_6_complete.md` memory (if memory hygiene applies that day).
