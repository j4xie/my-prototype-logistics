# T6.5 Phase B: SmartBI Analysis Endpoints Deprecation Notice

**Date**: 2026-05-09
**Status**: ACTIVE (PR #205 merged + deployed to prod 2026-05-09 15:07 UTC)
**Affected**: F999 internal team + any direct consumers of the 23 deprecated Java endpoints
**Soak period**: 30 days starting 2026-05-09, target Phase C kickoff ~2026-06-09
**Type**: DRAFT — Steve to edit + send via internal channels (Slack `#cretas-eng` / email)
**Decision reference**: T6.5 Phase B Decision 2A (Option A unconditional 410, Steve-locked 2026-05-09)

---

## TL;DR (中文版)

- **23 个 Java SmartBI Analysis 旧接口从今天起返回 HTTP 410 Gone** — 所有 factory 包括 F999 内部测试
- **替代方案**: 用 Python 后端的对应 endpoint (Phase 2A 已 100% port 完成, 75/75 customer factories 已经走 Python)
- **30 天观察期** (~2026-05-09 → ~2026-06-09), 期间如有 script / dashboard / automation 报错请反馈给 Steve
- **30 天后进 Phase C**: Java 端控制器方法体物理删除 + `SmartBiQueryTemplateRepository` orphan 清理
- **F999 内部团队**: 之前用 F999 调 SmartBI Analysis 的测试流程现在会拿到 410, Decision 2A 已接受这个 cost (F999 后续可以单独迁 Python, T6.6 候选)
- **客户面操作**: web-admin / RN App 已经走 Python 路径, 无需任何动作

---

## Affected endpoints (23 total)

### 22 endpoints on `SmartBIAnalysisController`

Old Java path (now returns 410) → Python alternative:

| # | Old Java path (410 Gone) | Python alternative |
|---|---|---|
| 1 | `GET /api/mobile/{factoryId}/smart-bi/analysis/sales` | `GET /api/smartbi/analysis/sales` |
| 2 | `GET /api/mobile/{factoryId}/smart-bi/analysis/department` | `GET /api/smartbi/analysis/department` |
| 3 | `GET /api/mobile/{factoryId}/smart-bi/analysis/region` | `GET /api/smartbi/analysis/region` |
| 4 | `GET /api/mobile/{factoryId}/smart-bi/analysis/finance` | `GET /api/smartbi/analysis/finance` |
| 5 | `GET /api/mobile/{factoryId}/smart-bi/analysis/finance/budget-achievement` | `GET /api/smartbi/analysis/finance/budget-achievement` |
| 6 | `GET /api/mobile/{factoryId}/smart-bi/analysis/finance/yoy-mom` | `GET /api/smartbi/analysis/finance/yoy-mom` |
| 7 | `GET /api/mobile/{factoryId}/smart-bi/analysis/finance/category-comparison` | `GET /api/smartbi/analysis/finance/category-comparison` |
| 8 | `GET /api/mobile/{factoryId}/smart-bi/analysis/inventory` | `GET /api/smartbi/analysis/inventory` |
| 9 | `GET /api/mobile/{factoryId}/smart-bi/analysis/procurement` | `GET /api/smartbi/analysis/procurement` |
| 10 | `GET /api/mobile/{factoryId}/smart-bi/alerts` | `GET /api/smartbi/alerts` |
| 11 | `GET /api/mobile/{factoryId}/smart-bi/recommendations` | `GET /api/smartbi/recommendations` |
| 12 | `GET /api/mobile/{factoryId}/smart-bi/incentive-plan/{type}/{id}` | `GET /api/smartbi/incentive-plan/{type}/{id}` |
| 13 | `POST /api/mobile/{factoryId}/smart-bi/datasource/upload` | `POST /api/smartbi/datasource/upload` (see Note A) |
| 14 | `GET /api/mobile/{factoryId}/smart-bi/datasource/{id}/preview` | `GET /api/smartbi/datasource/{id}/preview` (see Note A) |
| 15 | `POST /api/mobile/{factoryId}/smart-bi/datasource/apply` | `POST /api/smartbi/datasource/apply` (see Note A) |
| 16 | `GET /api/mobile/{factoryId}/smart-bi/datasource/list` | `GET /api/smartbi/datasource/list` |
| 17 | `GET /api/mobile/{factoryId}/smart-bi/datasource/{id}/fields` | `GET /api/smartbi/datasource/{id}/fields` |
| 18 | `GET /api/mobile/{factoryId}/smart-bi/datasource/{id}/history` | `GET /api/smartbi/datasource/{id}/history` |
| 19 | `GET /api/mobile/{factoryId}/smart-bi/query-templates` | `GET /api/smartbi/query-templates` |
| 20 | `POST /api/mobile/{factoryId}/smart-bi/query-templates` | `POST /api/smartbi/query-templates` |
| 21 | `PUT /api/mobile/{factoryId}/smart-bi/query-templates/{id}` | `PUT /api/smartbi/query-templates/{id}` |
| 22 | `DELETE /api/mobile/{factoryId}/smart-bi/query-templates/{id}` | `DELETE /api/smartbi/query-templates/{id}` |

### 1 endpoint on `SmartBIDashboardController`

| # | Old Java path (410 Gone) | Python alternative |
|---|---|---|
| 23 | `GET /api/mobile/{factoryId}/smart-bi/data-date-range` | `GET /api/smartbi/data-date-range` |

### Note A — datasource upload/preview/apply (3 endpoints)

The 3 datasource POST/preview/apply endpoints (#13-15) are **deferred Phase 3 backlog** (per PR #45 / #49 / #50). Java side has been a TODO stub since inception (always returns `hasChanges:false` envelope), and **0 frontend callers + 0 prod log hits** confirmed by Phase A audit (PR #178) + Chat 5 nginx-Python coverage cross-check (PR #184). The Python contract-completeness stub is being implemented separately (PR #185). If you have a script that hits these 3 paths, ping Steve — likely you're the only consumer.

---

## What stays alive (NOT deprecated)

Per Phase A audit (PR #178 / docs/qa-audits/2026-05-09-t6-5-phase-a-deletion-candidates.md §3.1.a + §4.2), the following 4 endpoints on `SmartBIAnalysisController` **remain alive on Java** for all 75 factories:

| Path | Reason |
|---|---|
| `GET /api/mobile/{factoryId}/smart-bi/analysis/production` | NOT_SAFE_FALLTHROUGH — nginx does NOT route to Python; deferred to T6.6 |
| `GET /api/mobile/{factoryId}/smart-bi/analysis/quality` | NOT_SAFE_FALLTHROUGH — same as above |
| `POST /api/mobile/{factoryId}/smart-bi/query` | NOT_SAFE_FALLTHROUGH — NL query path; Python lacks intent service equivalent |
| `POST /api/mobile/{factoryId}/smart-bi/drill-down` | NOT_SAFE_FALLTHROUGH — Python has `analysis_drilldown.py` but nginx doesn't route |

The other 10 endpoints on `SmartBIDashboardController` (`/dashboard*`, `/dashboard/executive*`, `/generate-*`, `/analysis/dynamic*`) also stay alive — they fall through to Java for all 75 factories per current nginx regex.

`SmartBIConfigController` (41 endpoints `/api/mobile/smartbi-config/*`), `SmartBIUploadController` (13 endpoints), `SmartBIPublicDemoController` (10 endpoints) are entirely untouched by Phase B.

---

## What you need to do

### If you call these endpoints from a script / dashboard / automation

1. Check your code for any of the 23 old paths listed above
2. Replace base URL: `http://47.100.235.168:10010/api/mobile/{factoryId}/smart-bi/*` → `http://47.100.235.168:8083/api/smartbi/*`
3. Note: the Python equivalent does NOT have `{factoryId}` in the path — `factoryId` is now a query param (`?factoryId=F002`)
4. Smoke-test against test env first (`47.100.235.168:8084` for Python test, `47.100.235.168:10011` for Java test)

### If you're a customer-facing operator / support engineer

Nothing to do — web-admin (`139.196.165.140:8086`) and RN App (`apiClient`) already hit Python directly via the 139 nginx regex. No customer-visible change.

### If you're on the F999 internal test team

F999 (`/api/mobile/F999/smart-bi/analysis/*`) was previously falling through to Java because it's NOT in the nginx regex routing. Per Decision 2A (Option A unconditional 410), F999 will now also receive 410 for these 23 paths. If you have a test workflow that depends on F999 SmartBI Analysis behavior:

- **Short-term**: switch your test factory to `F002` or any of the 75 customer factories that route to Python
- **Long-term**: F999 migration to Python is tracked as T6.6 candidate (separate ticket, ETA ~July 2026)
- If your workflow can't migrate easily, ping Steve to discuss

### If unsure whether you're affected

Ping Steve directly. Likely answer: if you don't recognize any of the 23 paths, you're not affected.

---

## What we deployed

### PR #205 (merged + deployed 2026-05-09)

- 22 method bodies on `SmartBIAnalysisController.java` stubbed
- 1 method body on `SmartBIDashboardController.java` (`getDataDateRange` line 345) stubbed
- 4 NOT_SAFE_FALLTHROUGH methods preserved (production / quality / query / drill-down)
- All `@RestController`, `@RequestMapping`, `@Autowired` constructor injections, and field declarations preserved (Spring Bean structure intact for safe rollback)
- `mvn build SUCCESS`, smoke 6/6 PASS confirmed before merge

### 410 Gone response shape

Each stubbed endpoint now returns:

```json
HTTP/1.1 410 Gone
Content-Type: application/json

{
  "success": false,
  "code": "SMARTBI_MIGRATED",
  "message": "SmartBI Analysis endpoints moved to Python /api/smartbi/analysis/*",
  "since": "2026-05-09",
  "newPath": "/api/smartbi/analysis/<path>"
}
```

Use the `newPath` field as a programmatic redirect hint if your client supports it. Note: HTTP 410 is intentional (vs 301/302) — clients should NOT auto-retry; instead, the operator/code should be updated.

### What was NOT touched

- Java code is **still on disk** (only method bodies replaced with 410 stub) — physical deletion is Phase C scope, ~30 days from now
- Service classes (`SalesAnalysisServiceImpl`, `FinanceAnalysisServiceImpl`, etc.) untouched — they're shared with KEEP'd controllers (Dashboard / PublicDemo / Upload)
- DTOs / entities / repositories untouched — Phase D scope
- `SmartBiQueryTemplateRepository` flagged Phase C orphan candidate (Phase A audit §3.5)

---

## Rollback plan

If 30-day soak surfaces a critical regression (e.g., F999 internal workflow blocked, unforeseen direct-IP-bypass client breakage):

1. **Investigate first** (non-destructive): grep `journalctl -u cretas-backend --since '1h ago' | grep SMARTBI_MIGRATED` to identify which factory + path is hitting Java unexpectedly
2. **If nginx miss-route**: fix nginx vhost regex on 139, `nginx -s reload`. No Java rollback needed.
3. **If genuine regression**: Java rollback via Blue-Green (per `reference_blue_green_java_deploy.md`):
   - nginx upstream `:10010 → :10020` (idle blue)
   - `cp aims-0.0.1-SNAPSHOT.jar.bak.t6_5_phase_b_pre.<ts> aims-0.0.1-SNAPSHOT.jar && systemctl restart cretas-backend`
   - nginx upstream `:10020 → :10010` once health check 200
   - Total wall-clock: <5 min

---

## Timeline

| Date (CST) | Milestone |
|---|---|
| **2026-05-09 (today)** | PR #205 merged + deployed to prod. Phase B trigger. 30-day soak begins. |
| ~2026-05-23 | Phase B 14-day mark — initial monitoring checkpoint |
| **~2026-06-09 (T+30d)** | Phase B soak window closes. Phase C kickoff dispatch. |
| ~2026-07-09 (T+60d) | Phase C complete. Java method bodies physically deleted. `SmartBiQueryTemplateRepository` + companion entity removed. |
| ~2026-07-09 → ~2026-08-15 | Phase D (DB-write audit confirming Python is canonical SmartBI writer) + T6.6 (F999 migration + 4 NOT_SAFE_FALLTHROUGH endpoints port) |

Phase A → Phase B → Phase C → Phase D → T6.6 chain documented in `docs/superpowers/specs/2026-05-15-t6-5-java-smartbi-deprecation-spec.md`.

---

## Contact

- **Issue / question**: GitHub issue against `j4xie/my-prototype-logistics` or Slack `#cretas-eng`
- **Urgent**: Steve direct
- **PR reference**: [#205](https://github.com/j4xie/my-prototype-logistics/pull/205)
- **Audit reference**: PR #178 (`docs/qa-audits/2026-05-09-t6-5-phase-a-deletion-candidates.md`)
- **Spec reference**: PR #150 + PR-X amendment (`docs/superpowers/specs/2026-05-15-t6-5-java-smartbi-deprecation-spec.md`)

---

# English version

## TL;DR

- **23 Java SmartBI Analysis endpoints now return HTTP 410 Gone** for ALL factories (including F999 internal)
- **Replacement**: use the Python backend equivalent (Phase 2A port complete; 75/75 customer factories already on Python)
- **30-day soak period** (~2026-05-09 → ~2026-06-09). Report any script / dashboard / automation regressions to Steve.
- **After 30 days**: Phase C kickoff — Java controller method bodies physically deleted + `SmartBiQueryTemplateRepository` orphan cleanup
- **F999 internal team**: F999 SmartBI Analysis paths now return 410. Decision 2A (Steve-locked) accepts this cost. F999 → Python migration tracked as T6.6 candidate.
- **Customer-facing operators**: nothing to do. web-admin and RN App already hit Python via 139 nginx regex.

## What you need to do

**If you call these endpoints from scripts / dashboards / automation**:

1. Check your code for any of the 23 old paths (see Chinese section above for full list)
2. Replace base URL: `http://47.100.235.168:10010/api/mobile/{factoryId}/smart-bi/*` → `http://47.100.235.168:8083/api/smartbi/*`
3. Note the Python equivalent uses `factoryId` as a query parameter (not in path)
4. Smoke-test against test env first (Python test: `47.100.235.168:8084`)

**If you're a customer-facing operator**: no action needed.

**If you're on F999 internal test team**: switch test workflows to F002 or any customer factory that routes to Python. F999 Python migration is T6.6 candidate (~July 2026).

**If unsure**: ping Steve directly.

## What was deployed

PR #205 (merged 2026-05-09 15:07 UTC) stubs 23 endpoint method bodies to return 410 Gone with `code=SMARTBI_MIGRATED` + `newPath` hint. Spring Bean structure preserved (`@RestController`, `@Autowired`, field declarations all intact) for safe rollback. Java code physically deletion is Phase C scope (~30 days from now).

## What stays alive (NOT deprecated)

4 NOT_SAFE_FALLTHROUGH endpoints on `SmartBIAnalysisController` continue serving 75 customer factories via Java fall-through:
- `GET /analysis/production`
- `GET /analysis/quality`
- `POST /query` (NL query — Python lacks intent service)
- `POST /drill-down`

These are deferred to T6.6 spec.

10 other endpoints on `SmartBIDashboardController` (`/dashboard*`, `/dashboard/executive*`, etc.) stay alive Java path. `SmartBIConfigController` (41 endpoints), `SmartBIUploadController` (13 endpoints), `SmartBIPublicDemoController` (10 endpoints) untouched.

## Rollback

Blue-Green rollback path documented above (Chinese section). Total wall-clock <5 min if needed. Investigate before rolling back — most "unexpected 410" cases will be nginx miss-route or direct-IP-bypass clients.

## Timeline

- **2026-05-09 (today)**: Phase B trigger, 30-day soak begins
- **~2026-06-09**: Soak window closes, Phase C kickoff
- **~2026-07-09**: Phase C complete (Java code physically deleted)
- **~2026-07-09 → ~2026-08-15**: Phase D (DB-write audit) + T6.6 (F999 + 4 NOT_SAFE_FALLTHROUGH endpoints port)

## Contact

- GitHub issue against `j4xie/my-prototype-logistics` or Slack `#cretas-eng`
- Urgent: Steve direct
- References: [PR #205](https://github.com/j4xie/my-prototype-logistics/pull/205), PR #178 (audit), PR #150 (spec)

---

**End of T6.5 Phase B SmartBI Analysis Deprecation Notice — DRAFT for Steve to edit + send.**
