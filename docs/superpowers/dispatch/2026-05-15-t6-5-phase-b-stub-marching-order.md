# 派工 — T6.5 Phase B: 23 endpoint stub 410 Gone (Decision 4B refined scope)

**Status**: ⚡ IMMEDIATE ON TRIGGER — organizer 触发后立即执行。Predecessor PRs **MUST be admin-merged before dispatch**: PR #178 (Phase A audit) + PR-X (PR #150 spec amend incorporating audit findings; TBD).
**Dispatch date**: TBD by organizer (placeholder filename `2026-05-15`; rename to actual trigger date when fired).
**Predecessor**: Phase 2A 100% close 2026-05-09 06:34 CST + PR #178 audit + PR-X spec amend.
**Author**: organizer T6.5 Phase B impl marching order draft (2026-05-09).
**Successor**: Phase B 14-day soak → Phase C method-level audit dispatch (~July 2026).

---

## 0. 必读 context (~15 min)

1. **PR #178 audit** (the source of scope truth — supersedes PR #150 spec where they conflict):
   - `docs/qa-audits/2026-05-09-t6-5-phase-a-deletion-candidates.md` §3.1.a (the exact 22 SAFE_NGINX_ROUTED endpoints), §3.1.b (the 23rd, `/data-date-range` on Dashboard controller), §6.1 (Phase B refined recommendation).
2. **PR #150 spec** §B.1 Implementation, §B.2 Spring Bean preservation, §B.3 Rollback, §B.4 GO → Phase C criteria:
   - `docs/superpowers/specs/2026-05-15-t6-5-java-smartbi-deprecation-spec.md`
3. **PR-X spec amend** (TBD before this dispatch fires): incorporates audit findings into spec §1.2 (corrects `IncentivePlanServiceImpl` → `IncentiveRuleServiceImpl`; flags `SmartBiQueryTemplateRepository` Phase C orphan candidate; refines Phase C from file-deletion to method-level audit).
4. **Java controllers** (read for line numbers + method signatures):
   - `backend/java/cretas-api/src/main/java/com/cretas/aims/controller/SmartBIAnalysisController.java` — 22 stub targets
   - `backend/java/cretas-api/src/main/java/com/cretas/aims/controller/SmartBIDashboardController.java:345` — 23rd stub
5. **Memory** (read before any push / deploy):
   - `feedback_pause_before_deploy_or_push.md` — STOP-and-ping organizer before deploy or push
   - `feedback_concurrent_edit_safety.md` — Rule 5b safe-commit `git commit -- F1 F2 ...`
   - `reference_blue_green_java_deploy.md` — Java prod default Blue-Green via 10010↔10020 nginx upstream switch
   - `feedback_active_e2e_replaces_passive_soak.md` — pre-customer-return state, no passive 7-day dead-time soak; active Playwright/curl probe is the verification
   - `feedback_dispatch_on_technical_readiness.md` — fire on technical readiness, not inherited timing anchors
6. **Sister-file impact note**: `SmartBIAnalysisControllerTest.java` does NOT exist in the repo (verified by `find backend/java/cretas-api/src/test -name 'SmartBI*Test*.java'`). No controller-level test scaffolding to amend; service-impl tests stay untouched per spec §B.2.

---

## ⛔ Pre-flight gates (organizer responsibility — verify BEFORE dispatching this MO)

- [ ] PR #178 audit: admin-merged into `main` (`gh pr view 178 --json state,mergeCommit`).
- [ ] PR-X spec amend: admin-merged into `main` (`gh pr list --state merged --search "spec amend t6-5"`).
- [ ] F999 internal team **T-72h notification sent** (per spec §3.3 + audit §6.1 pre-flight): notice that F999 SmartBI Analysis paths will return 410 Gone starting `<Phase B start date>`. Cretas internal Slack + email. Organizer-owned step.
- [ ] T6.4 5-stage cascade complete (already verified 2026-05-09 06:34 CST per memory `project_2026_05_09_phase_2a_complete.md`).
- [ ] No P1 customer reports open against SmartBI Analysis paths.

If any gate not green → **STOP, do not start Step 0**. Ping organizer.

---

## Step 0 — Sync main + new worktree

```bash
git fetch origin
git worktree add .worktrees/t6-5-phase-b -b ops-t6-5-phase-b origin/main
cd .worktrees/t6-5-phase-b
git log --oneline -1                  # confirm at origin/main HEAD
```

Verify base contains PR #178 + PR-X merge commits before proceeding (if either is missing, STOP — pre-flight gate failed).

---

## Step 1 — Edit `SmartBIAnalysisController.java` (22 method bodies)

**Pattern** (Option A unconditional 410, per spec §B.1 + audit §6.1):

```java
@GetMapping("/analysis/sales")
@Operation(summary = "Get sales analysis", description = "Get sales analysis data with multi-dimension support")
public ResponseEntity<ApiResponse<Map<String, Object>>> getSalesAnalysis(
        @PathVariable String factoryId, /* keep all original @PathVariable / @RequestParam */ ...) {
    log.info("[SMARTBI_MIGRATED] /analysis/sales factoryId={} returning 410 Gone", factoryId);
    return ResponseEntity.status(HttpStatus.GONE).body(
        ApiResponse.error(Map.of(
            "success", false,
            "code", "SMARTBI_MIGRATED",
            "message", "SmartBI Analysis endpoints moved to Python /api/smartbi/analysis/*",
            "since", "<Phase B start date>",                  // fill in actual deploy date
            "newPath", "/api/smartbi/analysis/sales"
        ))
    );
}
```

**Rules**:
- Keep `@RestController`, `@RequestMapping`, all field declarations + `@Autowired` constructor (Spring Bean preservation, spec §B.2).
- Keep `@PathVariable` / `@RequestParam` parameter list intact (signature compatibility for any cached client).
- Keep method-level `@Operation` Swagger annotation (greps for migrated endpoints stay clean).
- Replace **only** the method body. Do not delete imports — they may still be needed by the 4 NOT_SAFE_FALLTHROUGH methods + helpers.
- Use the **actual method names** below (the audit table uses path-based names; the Java code names differ in 4 cases).

### 22 stub targets — verified line numbers + actual method names (2026-05-09 against `main` HEAD `0f80b14b20`)

| # | Path | Method (line) | newPath in 410 body |
|---|------|---------------|----------------------|
| 1 | `GET /analysis/sales` | `getSalesAnalysis` (98) | `/api/smartbi/analysis/sales` |
| 2 | `GET /analysis/department` | `getDepartmentAnalysis` (142) | `/api/smartbi/analysis/department` |
| 3 | `GET /analysis/region` | `getRegionAnalysis` (181) | `/api/smartbi/analysis/region` |
| 4 | `GET /analysis/finance` | `getFinanceAnalysis` (222) | `/api/smartbi/analysis/finance` |
| 5 | `GET /analysis/finance/budget-achievement` | **`getBudgetAchievementChart`** (276) | `/api/smartbi/analysis/finance/budget-achievement` |
| 6 | `GET /analysis/finance/yoy-mom` | **`getYoYMoMComparisonChart`** (294) | `/api/smartbi/analysis/finance/yoy-mom` |
| 7 | `GET /analysis/finance/category-comparison` | **`getCategoryStructureComparisonChart`** (314) | `/api/smartbi/analysis/finance/category-comparison` |
| 8 | `GET /analysis/inventory` | `getInventoryAnalysis` (411) | `/api/smartbi/analysis/inventory` |
| 9 | `GET /analysis/procurement` | `getProcurementAnalysis` (452) | `/api/smartbi/analysis/procurement` |
| 10 | `GET /alerts` | `getAlerts` (590) | `/api/smartbi/alerts` |
| 11 | `GET /recommendations` | `getRecommendations` (621) | `/api/smartbi/recommendations` |
| 12 | `GET /incentive-plan/{targetType}/{targetId}` | `getIncentivePlan` (641) | `/api/smartbi/incentive-plan/{targetType}/{targetId}` |
| 13 | `POST /datasource/upload` | **`uploadAndDetectSchema`** (678) | `/api/smartbi/datasource/upload` |
| 14 | `GET /datasource/{datasourceId}/preview` | **`previewSchemaChanges`** (696) | `/api/smartbi/datasource/{id}/preview` |
| 15 | `POST /datasource/apply` | **`applySchemaChanges`** (714) | `/api/smartbi/datasource/apply` |
| 16 | `GET /datasource/list` | **`listDatasources`** (731) | `/api/smartbi/datasource/list` |
| 17 | `GET /datasource/{datasourceId}/fields` | `getDatasourceFields` (747) | `/api/smartbi/datasource/{id}/fields` |
| 18 | `GET /datasource/{datasourceId}/history` | `getSchemaHistory` (764) | `/api/smartbi/datasource/{id}/history` |
| 19 | `GET /query-templates` | `getQueryTemplates` (956) | `/api/smartbi/query-templates` |
| 20 | `POST /query-templates` | `createQueryTemplate` (965) | `/api/smartbi/query-templates` |
| 21 | `PUT /query-templates/{templateId}` | `updateQueryTemplate` (976) | `/api/smartbi/query-templates/{id}` |
| 22 | `DELETE /query-templates/{templateId}` | `deleteQueryTemplate` (997) | `/api/smartbi/query-templates/{id}` |

### 4 methods that STAY UNTOUCHED (NOT_SAFE_FALLTHROUGH per audit §3.1.a)

⛔ **Do NOT stub these — they are alive paths serving 75 customer factories via Java fall-through**:

| Path | Method (line) |
|------|---------------|
| `GET /analysis/production` | `getProductionAnalysis` (334) |
| `GET /analysis/quality` | `getQualityAnalysis` (373) |
| `POST /query` | **`query`** (491) — note: actual method name is `query`, not `nlQuery` |
| `POST /drill-down` | `drillDown` (531) |

### Helpers + DTOs to leave alone

- Private helper methods in the controller (lines ~802 onwards: `executeQueryByIntent` + `generate*QueryResponse` × 7 + `generateFollowUpQuestions`) — keep, they're called from the 4 NOT_SAFE methods.
- `DrillDownRequestDTO` inner class (line 788) — keep.
- All `@Autowired` services — keep, NOT_SAFE methods still need `intentService`, `productionAnalysisService`, etc.

---

## Step 2 — Edit `SmartBIDashboardController.java:345` `getDataDateRange`

Same Option A 410 stub pattern. Path `/data-date-range`, `newPath` = `/api/smartbi/data-date-range`.

⛔ **Do NOT touch the other 10 methods on `SmartBIDashboardController`** (`/dashboard*`, `/dashboard/executive*`, `/generate-*`, `/analysis/dynamic*`) — they fall through to Java for all 75 factories per current nginx regex (audit §3.1 row 3).

---

## Step 3 — Imports + Spring Bean preservation sanity check

Per spec §B.2:
- Keep `@RestController` + `@RequestMapping("/api/mobile/{factoryId}/smart-bi")` on `SmartBIAnalysisController`.
- Keep all field declarations (lines 52-64) + `@Autowired` constructor (lines 66-94). Removing them → compile errors in the 4 NOT_SAFE methods + helpers.
- Add new import if not present: `import org.springframework.http.HttpStatus;` (verify before edit).
- Do NOT delete `SmartBiQueryTemplateRepository` import — even though templates endpoints stub out, it's still field-injected. Phase C will remove the field + import together.

---

## Step 4 — Tests

**Finding**: no `SmartBIAnalysisControllerTest.java` exists in `backend/java/cretas-api/src/test/` (verified 2026-05-09 against `main`). The only SmartBI-related controller test is `SmartBIRestaurantRoutingTest.java` which targets a different controller.

**Action**:
- Do **not** create a new controller test for the stubs in this PR — Phase C method-level audit will revisit testing scope.
- Service-impl tests stay untouched (spec §B.2 — services keep their behavior; only controller bodies are stubbed).
- Smoke verification of the 410 emission is handled in Steps 7-8 below (env-level smoke, not unit test).

---

## Step 5 — Local build verification

```bash
cd .worktrees/t6-5-phase-b/backend/java/cretas-api
mvn clean compile -DskipTests           # must succeed (Spring Bean preservation)
mvn clean test -DskipTests=false        # must pass (existing service tests untouched)
mvn clean package -DskipTests           # produces aims-0.0.1-SNAPSHOT.jar
```

If `mvn compile` fails → most likely missed import or accidentally deleted field/constructor injection. Re-read spec §B.2.

---

## Step 6 — Test env deploy

⛔ **STOP-and-ping organizer before this step** — per `feedback_pause_before_deploy_or_push.md`. Steve uses multi-worktree workflows; he may need `git stash` / worktree merge before deploy proceeds.

After organizer GO:
```bash
cd <main worktree>
./scripts/deploy/deploy-backend.sh --env test          # deploys to 47:10011
ssh root@47.100.235.168 "curl -s http://localhost:10011/api/mobile/F002/smart-bi/analysis/sales | jq ."
# Expected: HTTP 410 + body {"success": false, "code": "SMARTBI_MIGRATED", ...}
```

Spot-check 3-5 endpoints from the 23 list (sales, finance, query-templates, alerts, /data-date-range). Confirm 410 + `code=SMARTBI_MIGRATED` + correct `newPath`.

---

## Step 7 — Test env smoke (76 factories × 23 endpoints = 1748 checks)

Write `scripts/t6-5-phase-b-smoke.py` (copy `scripts/t6-3-smoke.py` template — same auth + parallel pattern; differs in expected response):

- Iterate 75 customer factories + F999 = 76 factories.
- For each factory: hit all 23 stub paths.
- Assert HTTP 410 + JSON body has `code == "SMARTBI_MIGRATED"`.
- Also assert the 4 NOT_SAFE_FALLTHROUGH paths still return 200 (or business response) for at least F001 + F002 (regression check).
- Print pass/fail summary; non-zero exit on any mismatch.

GO criteria for Step 7: 1748/1748 = 100% return 410, 4 NOT_SAFE paths still 200/business for spot-check factories.

---

## Step 8 — Active E2E (per `feedback_active_e2e_replaces_passive_soak.md`)

- Web-admin (139:8086): hit dashboard pages for F002 + F003 with Playwright MCP or `agent-browser`. Verify:
  - `/dashboard/executive` (NOT_SAFE Dashboard composite) renders normally — proves Java→Python round-trip via Java Dashboard service still works.
  - Any page that calls a stubbed path either no longer calls it (frontend already migrated) OR shows a graceful error (no infinite spinner, no white screen).
- App (RN 3010 against test backend 47:10011): smoke open analysis screens for F002, expect Python-served data (frontend hits Python directly via apiClient).

If web-admin shows white screen on a stubbed path → frontend has stale code path that hits Java directly. **Stop**, file ticket per `feedback_ui_smoke_scope_creep_default_ticket.md`. Do not unilaterally fix frontend in this PR.

---

## Step 9 — Prod deploy (Blue-Green per `reference_blue_green_java_deploy.md`)

⛔ **STOP-and-ping organizer before this step**. Prod cutover is organizer-gated.

After organizer GO:

1. **Pre-deploy backup**: `ssh root@47.100.235.168 "cp /www/wwwroot/cretas/aims-0.0.1-SNAPSHOT.jar /www/wwwroot/cretas/aims-0.0.1-SNAPSHOT.jar.bak.t6_5_phase_b_pre.$(date +%Y%m%d_%H%M%S)"` — keeps last-3-of-bak rolling.
2. **Blue-Green flip**: nginx upstream `cretas_backend` switch from :10010 → :10020 (green idle). Verify `curl https://api.cretaceousfuture.com/api/mobile/health` continues 200.
3. **Deploy**: `./scripts/deploy/deploy-backend.sh --env prod` — replaces :10010 (blue) jar + restarts `cretas-backend.service`.
4. **Health check**: `curl http://localhost:10010/api/mobile/health` (after Spring Boot ~80s warmup).
5. **Switch back**: nginx upstream :10020 → :10010 (new jar live).
6. **Verify 410 emission**: `curl https://api.cretaceousfuture.com/api/mobile/F999/smart-bi/analysis/sales` → expect 410 (F999 hits Java directly, no nginx route to Python). For 75 customer factories → still get Python response (nginx routes to :8083 before reaching Java).
7. **Monitor 24h**: `journalctl -u cretas-backend -f | grep SMARTBI_MIGRATED` — expect minimal hits (only F999 internal team + any direct-IP-bypass clients).

Customer factories continue to see Python responses unchanged. F999 internal team sees 410 (per pre-flight T-72h notification).

---

## Step 10 — ⛔ HOLD blocks summary

| Block | Where | Who lifts | Trigger |
|-------|-------|-----------|---------|
| F999 T-72h notification | Pre-flight gate | Organizer | 72h before Step 9 prod deploy |
| Test env deploy | Before Step 6 | Organizer | After local build + diff review |
| Prod deploy | Before Step 9 | Organizer | After test env smoke 1748/1748 + active E2E pass |

---

## Step 11 — Rollback procedure

Per spec §B.3 — Phase B rollback constraint: **prefer Python forward-fix over Java rollback**, because Phase B couples Java state with nginx routing.

If 410 hits unexpectedly (>0 hits from non-F999 factories within 24h):
1. **Investigate first** (non-destructive): `journalctl -u cretas-backend --since '1h ago' | grep SMARTBI_MIGRATED` — capture which factory + path is hitting Java. Most likely: nginx miss-route OR direct-IP-bypass client OR new factory not yet in nginx regex.
2. **If nginx miss-route**: fix nginx vhost regex on 139, `nginx -s reload`. No Java rollback needed.
3. **If genuine regression**: Java rollback via Blue-Green:
   - nginx upstream :10010 → :10020 (idle blue from previous deploy).
   - `ssh root@47.100.235.168 "cp /www/wwwroot/cretas/aims-0.0.1-SNAPSHOT.jar.bak.t6_5_phase_b_pre.<ts> /www/wwwroot/cretas/aims-0.0.1-SNAPSHOT.jar && systemctl restart cretas-backend"` (restores pre-Phase-B jar to :10010).
   - nginx upstream :10020 → :10010 once health check 200.
   - Total wall-clock: <5 min.

⛔ Do NOT use `git revert` + redeploy as the primary rollback path during the 24h window — the bak jar is faster + safer.

---

## Step 12 — GO criteria → Phase C

Per spec §B.4 (refined by audit §6.2):
- [ ] 30 days continuous: 0 410 Gone hits in Java prod log (excluding expected F999 internal team).
- [ ] Phase B 14 days complete + 16 days additional dead-time monitoring (or compressed via active E2E if 0-customer-traffic state — see `feedback_active_e2e_replaces_passive_soak.md`).
- [ ] No P1 customer reports of "missing endpoint" / "service moved" errors.
- [ ] No scheduled jobs / CI / automation hits 410 paths (operator confirmation).
- [ ] Test environment Phase C dry-run successful (per spec §B.4 + audit §6.2 method-level audit kickoff plan).

Phase C scope per audit §6.2: **method-level audit** of analysis service impls (NOT file deletion); remove the 22 stubbed controller method bodies entirely; delete `SmartBiQueryTemplateRepository` + companion entity per audit §3.5.

---

## Step 13 — Ping protocol

After each major step, ping organizer in the format below:

- After Step 5: `Chat <id> T6.5 Phase B local build green. mvn package OK. Ready for test deploy.`
- After Step 7: `Chat <id> T6.5 Phase B test smoke 1748/1748. NOT_SAFE 4 endpoints regression-clean. Ready for active E2E.`
- After Step 8: `Chat <id> T6.5 Phase B active E2E pass. Awaiting prod deploy GO.`
- After Step 9: `Chat <id> T6.5 Phase B prod deploy live <timestamp> CST. 23 endpoints 410 Gone confirmed for F999. 24h monitoring started.`
- After 30-day soak window: `Chat <id> T6.5 Phase B soak complete. 0 unexpected 410 hits. Ready for Phase C dispatch.`

---

## ⛔ Concurrency safety reminders

- Use safe-commit pattern per `feedback_concurrent_edit_safety.md` Rule 5b: `git commit -- <file1> <file2> ...` — locks scope to listed paths, ignores any files staged by parallel sessions.
- Verify with `git status --short` before each commit. Any unrelated file in staged area → STOP, `git restore --staged <file>`.
- Verify with `git show --name-only HEAD` after commit. If husky/lint-staged auto-staged anything unexpected → consider `git reset --soft HEAD~1` if not pushed, or follow-up commit if pushed.

---

## ⛔ Forbidden in this PR (scope discipline)

- Do NOT touch service classes (`SalesAnalysisServiceImpl` etc.) — Phase C scope per audit §3.2.a.
- Do NOT touch DTOs / entities / repositories — Phase D scope.
- Do NOT touch the 4 NOT_SAFE_FALLTHROUGH methods — they serve alive Java traffic.
- Do NOT touch SmartBIDashboardController methods other than `getDataDateRange` — they serve alive composite dashboard traffic.
- Do NOT delete imports / fields / constructor params — Spring Bean preservation per spec §B.2.
- Do NOT amend PR #150 spec / PR #178 audit / T6.6 spec — those are owned by their respective chats.

If a finding outside this scope surfaces during impl (e.g., a bug in an alive path) → STOP, file a ticket per `feedback_ui_smoke_scope_creep_default_ticket.md`. Do not unilaterally fix.

---

## Reference index

| Resource | Section |
|----------|---------|
| Audit doc | `docs/qa-audits/2026-05-09-t6-5-phase-a-deletion-candidates.md` §3.1.a, §3.1.b, §6.1, §6.2 |
| Spec | `docs/superpowers/specs/2026-05-15-t6-5-java-smartbi-deprecation-spec.md` §B.1, §B.2, §B.3, §B.4 |
| Memory: pause-before-deploy | `~/.claude/projects/.../memory/feedback_pause_before_deploy_or_push.md` |
| Memory: concurrent-edit Rule 5b | `~/.claude/projects/.../memory/feedback_concurrent_edit_safety.md` |
| Memory: Blue-Green Java deploy | `~/.claude/projects/.../memory/reference_blue_green_java_deploy.md` |
| Memory: active E2E replaces soak | `~/.claude/projects/.../memory/feedback_active_e2e_replaces_passive_soak.md` |
| Memory: dispatch on technical readiness | `~/.claude/projects/.../memory/feedback_dispatch_on_technical_readiness.md` |
| Project rules | `.claude/rules/server-operations.md` (deploy / Blue-Green / systemd) |

---

**ETA**: ~4-6 hours wall-clock for impl chat (Step 0-7) once dispatched. Step 8 active E2E ~30-60 min. Step 9 prod deploy ~30 min. Step 10-12 monitoring spans 30 days but no chat-time burn.

**End of T6.5 Phase B marching order draft.**
