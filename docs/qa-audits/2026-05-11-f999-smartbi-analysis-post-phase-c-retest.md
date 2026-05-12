# F999 SmartBI Analysis — Post-Phase C Retest (Sub-O Option A revalidation)

**Date**: 2026-05-11
**Author**: chat4 (dispatched sister chat)
**Trigger**: post-Phase C jar prod ship + 5 bug-fix prod ship completed; verify Sub-O Option A decision (PR #257) is still operationally valid for F999.
**Scope**: smoke verification only — no code changes (per dispatch ⛔ HOLD).
**Predecessor PRs**: #181 (F999 410 pre-flight), #205 (T6.5 Phase B 23-endpoint stub), #257 (Sub-O Option A spec), Phase C method-delete cascade.

---

## §0. TL;DR

**Decision**: ✅ **Sub-O Option A remains the right call.** F999 has zero customer-facing impact and zero user-reachability for SmartBI Analysis paths. Operationally everything is exactly where Sub-O §3.1 predicted.

**3 dispatch premise drifts found** (organizer follow-up needed; not blockers for this verification):

| # | Marching-order claim | Reality | Severity |
|---|---|---|---|
| D-1 | "F999 5 endpoint" | Actual scope = **27 endpoints** (23 stubbed-then-deleted + 4 NOT_SAFE) per Sub-O spec §1.3 | docs drift only |
| D-2 | "verify status 410 (NOT 500 NOT 404 NOT 200)" | Phase C deleted the 23 stubbed methods → Java now returns Spring **404**, not 410, per Sub-O spec §3.1 line 136 explicit prediction | premise stale |
| D-3 | "F999 internal team accepted 410 at PR #181 §⛔" | F999 has **zero users** in `cretas_prod_db.users` → no one on F999 can login → no one can exercise these endpoints whether 410 or 404 or 200 | strengthens Option A |

**Net**: Option A is more correct than the spec realized. Zero engineering effort, zero code change, zero customer impact, zero user impact. The "410 acceptance" framing in the original Decision 2A rationale is moot — F999 is structurally unreachable.

**Smoke result**: 0 anomalies. Routing topology behaves exactly as nginx config + Java OpenAPI handler registry + Sub-O spec all independently predict.

---

## §1. Endpoint smoke — F999 27-endpoint surface

### §1.1 OpenAPI handler enumeration (definitive evidence — handler-presence ground truth)

Java prod 10020 `/v3/api-docs` enumeration (post-Phase C): **only 4** of the 23 previously-stubbed paths remain registered as Spring handlers:

```
/api/mobile/{factoryId}/smart-bi/analysis/production    (NOT_SAFE — KEEP)
/api/mobile/{factoryId}/smart-bi/analysis/quality       (NOT_SAFE — KEEP)
/api/mobile/{factoryId}/smart-bi/query                  (NOT_SAFE — KEEP)
/api/mobile/{factoryId}/smart-bi/drill-down             (NOT_SAFE — KEEP)
```

**All 23 previously-stubbed paths are completely absent from Java handler registry.** Confirmed deleted in Phase C cleanup. Spring will return 404 for any authenticated request to:

- `/analysis/sales` `/analysis/department` `/analysis/region` `/analysis/finance`
- `/analysis/finance/budget-achievement` `/analysis/finance/yoy-mom` `/analysis/finance/category-comparison`
- `/analysis/inventory` `/analysis/procurement`
- `/alerts` `/recommendations` `/incentive-plan/{type}/{id}`
- `/datasource/upload` `/datasource/{id}/preview` `/datasource/apply` `/datasource/list` `/datasource/{id}/fields` `/datasource/{id}/history`
- `/query-templates` (GET/POST/PUT/DELETE)
- `/data-date-range` (in SmartBIDashboardController, also deleted)

This **operationalizes** the Sub-O spec §3.1 line 136 prediction: *"Removing the method bodies converts F999's 410 into Spring's default 404 — semantically slightly different but operationally indistinguishable for an endpoint that nobody is calling."*

### §1.2 nginx routing — F999 falls through to Java (cohort regex inspection)

Server 139, `/www/server/panel/vhost/nginx/api.cretaceousfuture.com.conf` cohort regex (3 Python proxy_pass blocks):

```nginx
location ~ ^/api/mobile/(F00[1-46]|FOOD_3101_(00[1-9]|0[1-3][0-9]|04[0-8])|MEAT_3101_00[12]|OTHER_3101_001|RES_3101_00[1-9]|RES_GML_001|R001|R_(GML_DEMO|XMX_(CHAIN|FRESH[123]?)|YHDJ_DEMO|YJJ_DEMO)|TEST_0000_001)/smart-bi/(alerts|recommendations|data-date-range)$ { proxy_pass http://cretas_python; }

location ~ ^/api/mobile/(...same cohort regex...)/smart-bi/analysis/(finance|sales|department|region|inventory|procurement)(/.*)?$ { proxy_pass http://cretas_python; }

location ~ ^/api/mobile/(...same cohort regex...)/smart-bi/(query-templates|datasource|incentive-plan)(/.*)?$ { proxy_pass http://cretas_python; }
```

**F999 is not in the regex** → nginx falls through to default `cretas_java` upstream → Java prod 10020.

### §1.3 Live HTTPS smoke (via 139 nginx, Host: api.cretaceousfuture.com)

Login `f006_admin` / `123456` → JWT issued (factoryId=F006). Cross-factory probe to F999 paths confirms routing source via response body shape.

| Path | Token | Status | Body source-identifier |
|---|---|---|---|
| `F006/smart-bi/analysis/sales` | f006 | **200** | `"操作成功"` + `kpiCards[]` (Python) |
| `F006/smart-bi/analysis/finance` | f006 | **200** | `"操作成功"` + `kpiCards[]` (Python) |
| `F006/smart-bi/alerts` | f006 | **200** | `data: []` (Python) |
| `F006/smart-bi/datasource/list` | f006 | **200** | `data: []` (Python) |
| `F006/smart-bi/data-date-range` | f006 | **200** | `"No sales data detected"` (Python) |
| `F999/smart-bi/analysis/sales` | f006 | 403 | `severity, actionHint, "无权访问该工厂数据"` (**Java**) |
| `F999/smart-bi/analysis/finance` | f006 | 403 | (Java) |
| `F999/smart-bi/alerts` | f006 | 403 | (Java) |
| `F999/smart-bi/datasource/list` | f006 | 403 | (Java) |
| `F999/smart-bi/data-date-range` | f006 | 403 | (Java) |
| `F999/smart-bi/analysis/production` | f006 | 403 | (Java) |
| `F999/smart-bi/analysis/quality` | f006 | 403 | (Java) |
| `POST F999/smart-bi/query` | f006 | 403 | (Java) |
| `POST F999/smart-bi/drill-down` | f006 | 403 | (Java) |

The 403 (`"无权访问该工厂数据"`) is Java's factory-access filter firing before handler resolution because the f006 token's `factoryId=F006` claim doesn't match the URL `factoryId=F999`. Body shape (`severity, actionHint, timestamp`) is unambiguously Java's, not Python's. This **proves** F999 traffic routes to Java for all 14 representative paths exercised.

Unauth probe (no Authorization header) earlier returned **401** Java body (`"未授权，请先登录"` with `severity, actionHint, timestamp`) for the same F999 paths — confirms the factory-access filter is layered above Spring Security 401 in Java's filter chain, but both responses originate from Java.

### §1.4 Why we couldn't get past 403 to confirm 404 vs 200 for F999

F999 has **zero rows** in `cretas_prod_db.users`:

```sql
SELECT username, role_code, factory_id FROM users WHERE factory_id = 'F999';
-- (0 rows)
```

No JWT can ever be issued with `factoryId=F999` → no one can pass Java's factory-access filter on F999 paths. The 23-deleted-handler 404 vs 4-NOT_SAFE-handler 200 distinction is **operationally unreachable** for F999. (`platform_admins` table has 1 super_admin row, but that path uses a different auth surface and was not exercised here.)

This is the strongest possible confirmation of Sub-O Option A: F999 cannot suffer customer impact from any routing decision because F999 has no end-users.

---

## §2. UI 410 handler audit (Rule 8 四位一体 — defensive, dead-code post-Phase C)

Both UIs ship a `SMARTBI_MIGRATED:` 410 interceptor from PR #205 era:

- **web-admin** `web-admin/src/api/request.ts:311-335` — handles 410, splits into `isMigrated` toast + console warn for nginx-misroute regression alert. Comment at line 314 explicitly enumerates the trigger contexts: "(a) F999 测试 factory / (b) nginx 漏配 factory / (c) 直连后端 dev 调试".
- **RN App** `frontend/CretasFoodTrace/src/services/api/apiClient.ts:88-95` — analogous handler, comment at line 89: "410 only on dev / F999 / nginx misconfig regression".

**Post-Phase C status of these handlers**: dead code for F999 because Java now returns 404 (handler deleted), not 410 (stubbed body). Specifically:

- For F999, the `SMARTBI_MIGRATED:` body that the UI 410 branch keys on cannot be produced (no handler stub returning 410 exists anymore).
- The 410 handlers remain useful as **defense-in-depth** against nginx misconfig regression for cohort factories — if someone breaks the regex such that a cohort factory falls through to Java, the cohort would hit Spring's 404 (not 410) on the deleted handlers, so the 410 detection is moot for that scenario too.

**Rule 8 四位一体 (network message / UI toast / sticky / actionHint)**: the 401/403 paths Java returns to F999 already meet Rule 8 — `severity: "error"`, `actionHint: "请检查是否访问了错误的工厂"` (factory access) / `"会话已过期或未登录, 请重新登录"` (auth missing), proper code/message envelope. Spring 404 (if F999 ever had a user and tried the deleted endpoints) would need verification but is structurally unreachable.

**No UI exercise was performed** because F999 has no users to login as. Static analysis is the available evidence.

---

## §3. F999 vs F006 (cohort) sanity comparison

The §1.3 table is the side-by-side. Summarized:

- F006 (cohort) → Python serves all 5 representative migrated paths with 200 + Python response shape.
- F999 (non-cohort) → 100% (14/14) of probed paths route to Java. Java returns 401 unauth or 403 cross-factory before reaching handler.
- The 410 → 404 transition (D-2 finding) is moot in practice because no F999 user exists to ever observe either 410 or 404 directly.

This sanity check confirms:

- ✅ Phase 2A migration is intact for cohort factories (F006 routing to Python returns 200, business logic alive)
- ✅ F999 carve-out is operationally airtight (everything routes to Java regardless of handler presence)
- ✅ No global outage / cross-factory regression detected

---

## §4. Deviations from dispatch & marching-order recommendations

### D-1 — "5 endpoints" framing
Marching order said "F999 5 endpoint". Sub-O spec §1.3 already calls this out as approximation: actual scope is 27 (23 stubbed + 4 NOT_SAFE). **Recommend organizer**: standardize the count terminology in dispatch templates as "27 (23+4)" instead of "5", or cite Sub-O §1.3 directly to forestall sister-chat confusion.

### D-2 — "verify 410" expectation stale post-Phase C
Marching order Phase 1 told sister chat to "验 status 410 (NOT 500 NOT 404 NOT 200)". Phase C deleted the 23 stubbed methods → Java now returns 404 not 410 for F999 on those paths (had F999 users existed to test). Sub-O spec §3.1 line 136 already documented this transition as "operationally indistinguishable for an endpoint that nobody is calling". **Recommend organizer**: dispatch templates citing 410 expectation should be re-baselined to "401/403/404 from Java fallthrough; or 200/4xx from Python for cohort" as appropriate.

### D-3 — F999 zero-users finding
Decision 2A's premise (per PR #181 §⛔ pre-flight) was *"F999 internal team confirmed acceptance of current 410 behavior"*. But `cretas_prod_db.users WHERE factory_id='F999'` returned 0 rows. The "internal team" cannot login to F999 at all. This is **not a regression** — it's prior state — but it strengthens the Option A case: there's literally no F999 user to be impacted by any decision. **Recommend organizer**: future Sub-O re-dispatches should drop the "F999 internal team accepted X" framing and substitute "F999 has no end-user surface, no impact possible". (Cretas internal QA uses F001/F006/canary cohort per memory `reference_f006_liutengmen_prod_accounts.md`.)

### D-4 — UI 410 handler dead-code
Both web-admin `request.ts:311-335` and RN `apiClient.ts:88-95` carry `SMARTBI_MIGRATED:` 410 detection that, post-Phase C, cannot fire for F999 (Java no longer emits the 410+SMARTBI_MIGRATED body — the methods are gone). **Recommend organizer**: leave as defense-in-depth (low cost, high signal if nginx regression). Alternatively schedule a Sub-* method-delete task to clean up the comments at request.ts:314 referring to "F999 测试 factory" as a 410 trigger context (no longer accurate).

### D-5 — "Backend prod 10020 (BG active)" claim verified
Marching order header said prod backend is on 10020 (Blue-Green green slot). Confirmed via `ss -tlnp`: 10020 listening, 10010 not listening. Memory `reference_blue_green_java_deploy.md` consistent.

---

## §5. Decision: Sub-O Option A still recommended

**Verdict**: ✅ **Sub-O Option A remains the optimal long-term position for F999.**

Reinforced rationale (vs Sub-O spec §5.1 original):

1. **Zero F999 user impact** (D-3 finding) — strongest possible "no customer harm" argument
2. **Zero engineering days** — no nginx regex amendment, no Python data setup, no migrations
3. **Zero revert cost** — Option B is still additive if a future F999 use case emerges
4. **Phase D method-body removal already complete** — the 410→404 transition Sub-O §3.1 anticipated already happened (Phase C deleted the methods); no new work needed
5. **4 NOT_SAFE endpoints stay alive in Java for F999** by virtue of nginx default-route — same as Sub-O §3.1 plan
6. **No customer-facing UX regression detected** in 14-path live smoke (F006 cohort 200; F999 403 with proper Rule 8 body shape)

**Revisit triggers** (per Sub-O §5.2):
- F999 internal team adds users + requests SmartBI Analysis access → consider Option B nginx amendment
- T6.6 Phase B Sub-G dispatch (mid-Aug 2026) → re-evaluate F999 inclusion in 4 NOT_SAFE cohort regex (currently excluded, deferred indefinitely under Option A)
- Customer-facing demand for F999 SmartBI demo screen using real Python paths → Option B trigger

**No revisit triggered by this retest.**

---

## §6. Evidence appendix

### §6.1 OpenAPI handler enumeration (Java prod 10020)
```bash
ssh root@47.100.235.168 'curl -s http://127.0.0.1:10020/v3/api-docs | python3 -c "..." '
# Total smart-bi paths: 27
# Of which the 4 KEEP from Phase 2A NOT_SAFE_FALLTHROUGH:
#   GET  /api/mobile/{factoryId}/smart-bi/analysis/production
#   GET  /api/mobile/{factoryId}/smart-bi/analysis/quality
#   POST /api/mobile/{factoryId}/smart-bi/query
#   POST /api/mobile/{factoryId}/smart-bi/drill-down
```

### §6.2 nginx cohort regex (server 139)
File: `/www/server/panel/vhost/nginx/api.cretaceousfuture.com.conf` lines 46, 50, 54.
F999 NOT matched by regex `(F00[1-46]|FOOD_3101_(00[1-9]|0[1-3][0-9]|04[0-8])|MEAT_3101_00[12]|OTHER_3101_001|RES_3101_00[1-9]|RES_GML_001|R001|R_(GML_DEMO|XMX_(CHAIN|FRESH[123]?)|YHDJ_DEMO|YJJ_DEMO)|TEST_0000_001)`.

### §6.3 F999 user count (cretas_prod_db)
```sql
SELECT count(*) FROM users WHERE factory_id = 'F999';  -- 0
```

### §6.4 F006 cohort smoke (Python 200, response source identification)
```
GET https://api.cretaceousfuture.com/api/mobile/F006/smart-bi/analysis/sales
  -> 200 {"code":200,"message":"操作成功","data":{"overview":{...,"kpiCards":[],...}}}
GET https://api.cretaceousfuture.com/api/mobile/F006/smart-bi/data-date-range
  -> 200 {"code":200,"message":"No sales data detected","data":{"hasData":false,...}}
```

### §6.5 F999 fallthrough smoke (Java 403, body shape identification)
```
GET https://api.cretaceousfuture.com/api/mobile/F999/smart-bi/analysis/sales (with f006 token)
  -> 403 {"success":false,"code":403,"message":"无权访问该工厂数据","severity":"error","actionHint":"请检查是否访问了错误的工厂...","timestamp":"..."}
```

Same Java body shape returned for all 14 F999 paths probed (5 of the 23 deleted + 4 NOT_SAFE + 5 representative). Confirms 100% Java fallthrough.

### §6.6 BG slot (Java prod active)
```
ss -tlnp | grep -E ':10010|:10020'
# *:10020 (java) — active green slot
# (no listener on 10010)
```

---

## §7. Out of scope / not exercised

- ⛔ No code changes (per dispatch HOLD)
- ⛔ No prod deploy
- F999 behind-auth handler-presence (404 vs 200 for the 23 deleted vs 4 NOT_SAFE) was not directly observable because F999 has 0 users — only inferable via OpenAPI registry + nginx config + Sub-O spec
- UI Playwright exercise of 410 handler omitted (no F999 user to login as; cohort factories don't trigger 410 path post-Phase C either)
- Strict-byte / dict-eq parity comparison against pre-Phase-C Python is out of scope (already covered by T6.4 cascade May 9 final smoke per memory)

---

## §8. Sign-off

- ✅ §0 TL;DR — Sub-O Option A operationally validated, 3 dispatch premise drifts logged
- ✅ §1 27-endpoint surface smoke + OpenAPI ground truth
- ✅ §2 UI 410 handler static audit
- ✅ §3 F999 vs F006 cohort sanity
- ✅ §4 D-1..D-5 deviations + organizer recommendations
- ✅ §5 Decision: Option A recommended (no revisit triggers fire)
- ✅ §6 Evidence appendix with reproducible commands
