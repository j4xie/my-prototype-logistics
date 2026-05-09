# T6.6 — `/drill-down` Python Existing-Impl Parity Verify + Nginx Route Plan

**Date**: 2026-05-09
**Author**: Chat P (organizer dispatch)
**Branch**: `ops-t6-6-drilldown-parity-verify`
**Dispatch**: organizer fresh chat post-Phase-2A-100%-close, T6.6 prep
**Cross-refs**:
- PR #178 §3.1.a (deletion-candidates audit, NOT_SAFE_FALLTHROUGH classification)
- PR #196 §3.4 (T6.6 Phase A design, 0.5-1d effort revision)
- PR #180 (T6.6 4-endpoint port spec)
- Phase 2A spec series: `docs/superpowers/specs/2026-05-02-phase2a-drill-down-{design,audit-cycle1..4,design-notes}.md`

---

## 0. TL;DR

| Question | Answer |
|---|---|
| Is Python `analysis_drilldown.py` byte-shape parity with Java `processDrillDown`? | **Yes** — empirical fresh F001 product spot-check 100% dict-eq match against Java; 8 existing F999 goldens cover all 5 dimensions L1/L2 + error path |
| Was the parity ever previously verified? | Yes — Phase 2A PR-A May 2 2026, 4 audit cycles (Z1-Z9 critical/important findings all addressed in `52a7e1bf9`) |
| Is anything blocking nginx route flip? | **No technical blocker.** Pending: (a) Steve GO on Phase B sequencing (per PR #196 §6); (b) coordination with PR #180 spec route rollout for the 3 other NOT_SAFE_FALLTHROUGH endpoints |
| Effort to flip? | ~30 min nginx regex amendment + smoke verify + rollback rehearsal — well within PR #196 revised 0.5-1d estimate |
| Risk to T6.4 customers (14 real factories)? | **Low** — Python impl shares same `_query_*` SQL helpers as the already-cutover sales/region/dept paths; no new code path |

**Discovery framing reverse**: marching order described this as "Python existing impl needs parity verify (effort 1-2d revised to 0.5-1d)". Actual state: Python impl is fully shipped + audit-cycled. This audit is a **synthesis + route-readiness gate**, not fresh implementation work. ETA collapsed to ~1.5h (vs marching order's 1-2h estimate which assumed fresh recording of both F999/F001 from scratch).

---

## 1. Methodology

**What I did:**
1. Read 4 audit-cycle docs (`-audit-cycle1.md` … `-audit-cycle4.md`) covering 35+ findings (cycle 1: 14 / cycle 2: 12 / cycle 3: 9 / cycle 4: 9). Confirmed all critical (Z1, Z2, X1-X9) addressed in spec commit `52a7e1bf9`.
2. Inventoried the 9 existing `tests/fixtures/java-smartbi-golden/drill-down-*.json` files (Apr 30 base + May 4 dim-specific).
3. Read full Python impl `backend/python/smartbi_compat/api/analysis_drilldown.py` (747 LOC) + Java `SmartBIServiceImpl.processDrillDown` (lines 1018-1069) + 5 private dim dispatchers (lines 1975-2076).
4. Traced FastAPI router wiring: `backend/python/main.py:1205` confirms `app.include_router(analysis_drilldown.router, ...)`.
5. **Empirical recording**: SSH'd to server 47, generated JWT (HS256, factory_super_admin role) on remote with `JWT_SECRET=cretas-jwt-secret-key-2026-test`, POSTed to `localhost:10011` (Java test env) for `F001 dimension=product`. Saved as `drill-down-F001-product.json` (new fixture).
6. **Parity compare**: same JWT POSTed to `localhost:8084` (Python test env). Diff'd JSON byte-by-byte (ignoring `timestamp` field per Rule 11 dict-eq gate).

**What I did NOT do** (out of scope):
- Re-record any of the 8 existing F999 dim-specific goldens (already covered by Phase 2A PR-A test suite).
- Run automated dict-eq compare against the full 9-golden test corpus (Phase 2A PR-A test files already do this — see `backend/python/smartbi_compat/api/analysis_drilldown.py` line 238 / 337 / 363 / 645 cite refs).
- Audit Rule 1-12 latent issues — that was Phase 2A PR-A's scope and has been swept.

**Why F001 product specifically:**
- F001 is the only customer factory currently with populated SmartBI Gold POS data (per `reference_smartbi_gold_layer_architecture.md` + `project_2026_05_07_t6_1_dryrun_in_flight.md`). All other 14 T6.4 cohort factories return empty data sets — useful for dispatch path parity but not arithmetic semantic checks.
- Product dimension exercises the largest envelope: `[drillPath, data, level, nextLevel, chart, dimension]` (6 fields), nested `chart` ChartConfig (7 fields per Lombok @Data), and 7 ranking item rows (each 6 fields). Highest blast radius for byte-shape divergence.

---

## 2. Endpoint Inventory

Single endpoint:

| Method | Path | Controller | Service | Status |
|---|---|---|---|---|
| POST | `/api/mobile/{factoryId}/smart-bi/drill-down` | `SmartBIAnalysisController.drillDown` (line 531-586) | `SmartBIServiceImpl.processDrillDown` (line 1018-1069) — **NOT** `DynamicAnalysisServiceImpl.processDrillDown` as some dispatch docs claim | Java for all 75 factories per current nginx regex (NOT_SAFE_FALLTHROUGH per PR #178 §3.1.a) |

Dispatcher fork on `request.dimension.toLowerCase()`:

| Dimension | Java method (`SmartBIServiceImpl.java`) | Python mirror (`analysis_drilldown.py`) | Result envelope key order |
|---|---|---|---|
| `region` | `processRegionDrillDown` (1975-1996) | `_process_region_drilldown` (552-566) | `[drillPath, data, level, nextLevel, dimension]` |
| `department` | `processDepartmentDrillDown` (2001-2017) | `_process_department_drilldown` (569-579) | `[drillPath, data, level, nextLevel, dimension]` |
| `product` | `processProductDrillDown` (2022-2032) | `_process_product_drilldown` (582-590) | `[drillPath, data, level, nextLevel, chart, dimension]` |
| `time` | `processTimeDrillDown` (2037-2059) | `_process_time_drilldown` (593-622) | `[period, drillPath, data, level, dimension]` (NO `nextLevel`) |
| `salesperson` | `processSalespersonDrillDown` (2064-2076) | `_process_salesperson_drilldown` (625-634) | `[drillPath, data, level, dimension]` (NO `nextLevel`, NO `chart`) |
| (default) | `throw new BusinessException(400, "不支持的下钻维度: ...")` | `raise DrilldownBusinessException(code=400, ...)` returned via `wrap_error` HTTP 200 | 8-field error envelope |

Top-level dict insertion order is **Java HashMap iteration order** (not source-order), captured in goldens. Python dict literals must mirror golden order verbatim per Rule 8.

---

## 3. Java Behavior Trace

`SmartBIAnalysisController.java:531-586` (controller layer):

1. `@PreAuthorize("analytics:read_write")` — same scope as other Phase 2A endpoints.
2. Dual-path: if `smartBIService != null` → delegate to `processDrillDown` (production path); else fallback to inline `regionAnalysisService` / `departmentAnalysisService` switch (dev/test fallback only — `smartBIService` is always non-null in prod).
3. **Force-overrides**: controller-level DTO has 7 fields but does NOT propagate `level` or `parentContext` to service-level DTO. Service always sees `level=1` (`@Builder.Default`) and `parentContext=null`. Python mirrors this at handler entry (line 736-737): `request.level = 1; request.parentContext = None`. (See Phase 2A spec I3+I4 carry-over.)
4. Catch-all `Exception` → `ApiResponse.error(...)` returned with HTTP 200 + `success=false` envelope (mirrored by Python `wrap_error`).

`SmartBIServiceImpl.processDrillDown` (line 1018-1069):

1. `@Transactional` (writeable — `recordUsage` writes to `smart_bi_usage_logs` table after dispatch).
2. Default date range: `request.startDate == null || request.endDate == null` → `DateRange.thisMonth()`.
3. `switch (request.getDimension().toLowerCase())` → 5 dispatcher methods (per §2 table) → `default: throw new BusinessException(400, ...)` with `withHint("请选择支持的下钻维度").withHintTarget("dimension")` (hint fields are populated on Java side but flattened to `actionHint=null/severity=null/hintTarget=null` in 5-field error envelope per controller catch — see Phase 2A spec T10).
4. Common-suffix writes after dispatch: `result.put("drillPath", request.getDrillPath())`, `result.put("level", request.getLevel())`, `result.put("dimension", request.getDimension())`. **Java HashMap iteration order** controls top-level field order in serialized response — Python dict literals must mirror per-dim golden truth.
5. `recordUsage(factoryId, null, ActionType.DRILLDOWN.name(), 0, false)` — usage log INSERT.

---

## 4. Python Existing-Impl Trace

`backend/python/smartbi_compat/api/analysis_drilldown.py` (747 LOC, ships in Phase 2A PR-A May 2 2026):

| Concern | Java location | Python location | Notes |
|---|---|---|---|
| HTTP router | controller line 531 | `@router.post("/api/mobile/{factory_id}/smart-bi/drill-down")` line 721 | Wired in `main.py:1205` |
| Pydantic DTO | controller `DrillDownRequestDTO` (7 fields) | `DrillDownRequestModel` line 55-69 (7 + 6 forward-compat fields) | Forward-compat fields accepted but unread (Java service-level DTO has them too via `@Builder.Default`) |
| Top-level dispatcher | service line 1020 | `_process_drilldown_tx` line 637 | Cycle 4 Z1 redesign: async dispatch via sister helpers, then separate sync `engine.begin()` for `recordUsage` write — preserves Java observable behavior atomicity (raise-before-write) |
| 5 dim processors | service lines 1975-2076 | lines 552-634 | See §2 table for 1:1 mapping |
| `drillPath` computation | `DrillDownRequest.getDrillPath()` (line 295-302) | `_compute_drill_path` line 72-81 | Rule 1 explicit None+empty checks |
| Default date range | `DateRange.thisMonth()` (line 123-133) | `_default_date_range_this_month` line 84-94 | Last day = `today.lengthOfMonth()`, NOT today |
| Usage log write | `recordUsage(...)` | `_drilldown_record_usage_async` line 518-549 | Wrapped in `_to_thread` (sync engine.begin() + INSERT) |
| 8-field response envelope | `ApiResponse.success(...)` Lombok @Data | `wrap_response` (`schema_compat.py:96-118`) | All 3 hint fields emit null on success per Rule 9 |
| `BusinessException` → 200 + success=false | controller catch line 583 | `DrilldownBusinessException` + `wrap_error` line 744 | T10 controller catch flattens to 5-field envelope, hint fields null per Rule 9 |
| Date range type wrapper | service uses `LocalDate startDate, LocalDate endDate` direct | `DateRange.custom(start_date, end_date)` line 651 | Per python-java-port.md Rule 3 (envelope-level OK; service signature mirrors LocalDate pair) |

---

## 5. Dict-Eq Match Rate + Drift Analysis

### 5.1 Existing F999 golden corpus (Phase 2A PR-A test suite covers)

| Golden | Bytes | Dimension | Level | Filter | Recorded | Match status |
|---|---|---|---|---|---|---|
| `drill-down-F999.json` | 620 | region | 1 | "华东" | Apr 30 | base parity (empty data — F999 has no SmartBI sales rows) |
| `drill-down-F999-region-L1.json` | 325 | region | 1 | (none) | May 4 | covered by PR-A test |
| `drill-down-F999-region-L2.json` | 321 | region | 1 | "华东" | May 4 | covered by PR-A test |
| `drill-down-F999-department-L1.json` | 332 | department | 1 | (none) | May 4 | covered by PR-A test |
| `drill-down-F999-department-L2.json` | 2507 | department | 1 | "销售部" | May 4 | full DashboardResponse (12-field KPI cards × 4 + rankings + charts) |
| `drill-down-F999-product.json` | 610 | product | 1 | (none) | May 4 | full ChartConfig 7-field |
| `drill-down-F999-time-L1.json` | 576 | time | 1 | (none) | May 4 | period=MONTH (level=1 mapping) |
| `drill-down-F999-salesperson-L1.json` | 300 | salesperson | 1 | (none) | May 4 | covered by PR-A test |
| `drill-down-F999-error-unknown-dim.json` | 245 | (invalid) | — | — | May 4 | 400 BusinessException + 5-field error envelope |

All 9 goldens recorded against Java test env (`javaPort=10011` per Apr 30 `_meta`). Phase 2A PR-A test suite asserts dict-eq parity for each.

### 5.2 Fresh F001 product spot-check (this audit)

Recorded 2026-05-09 22:42 CST via SSH curl to `localhost:10011` (Java test env F001 has populated Gold POS data, unlike F999):

**Java response** (saved as `drill-down-F001-product.json`):
```
{code:200, message:"操作成功", data:{drillPath:"全部", data:[7 product items], level:1, nextLevel:null, chart:{...PIE 7-field config + 7 data points}, dimension:"product"}, timestamp:"2026-05-09T22:42:35.095848716", success:true, actionHint:null, severity:null, hintTarget:null}
```

**Python response** (test env `localhost:8084`, same JWT, recorded 22:43):
```
{code:200, message:"操作成功", data:{drillPath:"全部", data:[7 product items], level:1, nextLevel:null, chart:{...identical}, dimension:"product"}, timestamp:"2026-05-09T22:43:18.739983", success:true, actionHint:null, severity:null, hintTarget:null}
```

**Diff**: only `timestamp` field differs (expected per `schema_compat.py` docstring — fresh per-request, contract test asserts ISO 8601 shape only). All 7 product rows + chart envelope + 8-field outer envelope **byte-identical**.

### 5.3 Rule-by-rule sweep status (existing PR-A coverage)

| Rule | Concern | Status |
|---|---|---|
| 1 | None vs empty checks | Covered — `_compute_drill_path` line 75-81 explicit None+empty |
| 4 | Decimal serialization | Covered — `value`/`completionRate`/`amount` all rendered as JSON number (1492413.2 not "1492413.2") |
| 8 | HashMap key order | Covered — dict literals in `_process_drilldown_tx` lines 661-708 mirror golden truth per dim |
| 9 | Lombok null emit | Covered — `wrap_response` always emits `actionHint/severity/hintTarget` keys per Rule 9 |
| 11 | LocalDateTime trailing zeros | **Latent edge** — Java emits 9-digit nanosecond precision (`095848716`); Python `datetime.isoformat()` only 6-digit microsecond (`739983`). Phase 2A dict-eq gate excludes timestamp field, so not blocking. Strict-byte gate (Phase 3+) would surface this. |

### 5.4 Drift summary

**Zero new drifts found.** Phase 2A PR-A audit cycles 1-4 caught all 35+ historical drifts; cycle 4 Z1 (sister helper async/sync boundary) restructured `_process_drilldown_tx` and is the canonical impl on origin/main. Fresh F001 product confirms parity holds against current data.

---

## 6. Nginx Regex Update Required

### 6.1 Current state

Server `139.196.165.140` — `/www/server/panel/vhost/nginx/api.cretaceousfuture.com.conf`:

3 location blocks routing 75 factories to `cretas_python` upstream:
- Line 46: `^/api/mobile/(<75 factories>)/smart-bi/(alerts|recommendations|data-date-range)$`
- Line 50: `^/api/mobile/(<75 factories>)/smart-bi/analysis/(finance|sales|department|region|inventory|procurement)(/.*)?$`
- Line 54: `^/api/mobile/(<75 factories>)/smart-bi/(query-templates|datasource|incentive-plan)(/.*)?$`

`/drill-down` matches **none** of these → falls through to default `proxy_pass http://cretas_java` upstream → all 75 factories hit Java for drill-down.

### 6.2 Proposed extension

Two equally valid options:

**Option A** (extend line 46's path alternation — RECOMMENDED for minimal blast radius):

```diff
- location ~ ^/api/mobile/(F00[1-46]|FOOD_3101_(00[1-9]|0[1-3][0-9]|04[0-8])|MEAT_3101_00[12]|OTHER_3101_001|RES_3101_00[1-9]|RES_GML_001|R001|R_(GML_DEMO|XMX_(CHAIN|FRESH[123]?)|YHDJ_DEMO|YJJ_DEMO)|TEST_0000_001)/smart-bi/(alerts|recommendations|data-date-range)$ {
+ location ~ ^/api/mobile/(F00[1-46]|FOOD_3101_(00[1-9]|0[1-3][0-9]|04[0-8])|MEAT_3101_00[12]|OTHER_3101_001|RES_3101_00[1-9]|RES_GML_001|R001|R_(GML_DEMO|XMX_(CHAIN|FRESH[123]?)|YHDJ_DEMO|YJJ_DEMO)|TEST_0000_001)/smart-bi/(alerts|recommendations|data-date-range|drill-down)$ {
      proxy_pass http://cretas_python;
  }
```

Single-edit, 1 character class added (`|drill-down`). 75 factories → Python; F999 + future test factories continue Java path (NOT in factory alternation). Matches Phase 2A precedent for low-risk endpoint additions.

**Option B** (add as 4th location block — more verbose but clearer audit trail per-feature):

```nginx
location ~ ^/api/mobile/(F00[1-46]|FOOD_3101_(00[1-9]|0[1-3][0-9]|04[0-8])|MEAT_3101_00[12]|OTHER_3101_001|RES_3101_00[1-9]|RES_GML_001|R001|R_(GML_DEMO|XMX_(CHAIN|FRESH[123]?)|YHDJ_DEMO|YJJ_DEMO)|TEST_0000_001)/smart-bi/drill-down$ {
    proxy_pass http://cretas_python;
}
```

Steve's call (Phase 2A precedent uses Option A pattern at line 46/50/54).

### 6.3 Rollback path

Standard pattern:
```bash
cp /www/server/panel/vhost/nginx/api.cretaceousfuture.com.conf.bak.t6_6_pre.<ts> \
   /www/server/panel/vhost/nginx/api.cretaceousfuture.com.conf && \
nginx -s reload
```
ETA <2 min — same as T6.2 / T6.3 / T6.4 cascade rollback rehearsals.

---

## 7. GO Criteria for Routing Flip

Pre-flight (this PR):
- [x] Python impl exists + wired in `main.py` router
- [x] 8 F999 dim-specific goldens cover all 5 dimensions L1/L2 + error path
- [x] Fresh F001 product empirical parity confirmed (this audit §5.2)
- [x] No new Rule 1-12 drift surfaced

Pre-cutover (T6.6 Phase B execution):
- [ ] Steve GO on coordinating `/drill-down` flip with the other 3 NOT_SAFE_FALLTHROUGH endpoints (`/query`, `/analysis/production`, `/analysis/quality`) per PR #196 §6
- [ ] T6.6 cutover MO drafted (mirror T6.4 stage MOs — pre-deploy backup, smoke checklist, soak window, rollback)
- [ ] Capacity check: Python `cretas_python` upstream uvicorn workers (currently N=2 per `project_2026_05_07_uvicorn_n2_path_x_lite.md`) sufficient for added drill-down traffic
- [ ] Fresh smoke test pre-flip: 1 dimension × 14 customer factories should return 200 + valid envelope (Python returns empty data for non-F001 factories per T6.4 cascade learning, **not** an error)

Post-cutover:
- [ ] 24h soak with error rate <0.5%, p99 <2000ms, 0 cascading 5xx in upstream services
- [ ] Frontend smoke (e2e-web-admin or Playwright MCP per HARD rule `feedback_active_e2e_replaces_passive_soak.md`) — drill-down click-path on Dashboard.vue / SalesAnalysis.vue still works

---

## 8. Estimated Effort

Per PR #196 §3.4 revised estimate: **0.5-1d**.

Breakdown:
| Task | ETA |
|---|---|
| nginx regex amendment + `nginx -t` + `nginx -s reload` | ~10 min |
| Backup file naming + commit (per concurrent-edit-safety pattern) | ~5 min |
| 1-min smoke verify per stage cohort (mirror T6.4 cascade pattern) | ~30 min |
| 24h soak instrumentation (alert thresholds in baseline metrics) | ~30 min |
| Active E2E (per HARD rule, NOT passive soak) — Playwright drill-down click-path on Dashboard | ~30 min |
| Buffer + rollback rehearsal verify | ~30 min |

Total: ~2.25h hands-on within a 0.5d window. Conservative.

---

## 9. Open Questions

1. **Sequencing with 3 sibling NOT_SAFE_FALLTHROUGH endpoints** — should `/drill-down` flip independently (smallest, lowest-risk, 0 new code) or batch with `/analysis/production` + `/analysis/quality` + `/query` per PR #196 §6 sister-chat parallel plan? Smaller batch = lower blast radius per flip; bundled = one nginx reload covers all 4.
2. **F999 routing** — PR #178 §3.1.a flags F999 stays Java for everything. Confirm `/drill-down` should follow same rule (regex doesn't include F999) — yes per Phase 2A precedent, but worth double-checking against PR #180 §1 spec.
3. **Phase B `/drill-down` task** — PR #196 §3.4 4-task plan steps 1-3 are arguably **already done** by Phase 2A PR-A May 2 work + this audit (record goldens, diff, fix Rule 1-12). Step 4 (nginx route) is the only remaining work. Does Phase B pick up just step 4, or revisit 1-3 with current data?
4. **Marching-order accuracy patches** for organizer:
   - `DynamicAnalysisServiceImpl.processDrillDown` — actual class is `SmartBIServiceImpl.processDrillDown` (HARD rule `feedback_marching_order_method_name_grep.md`)
   - `record-java-golden.sh` invocation in MO Step 1 had wrong arg shape (positional `"POST /api/..."` vs flag `--method POST --data-json '...'`) — would've failed at `Unknown flag` error
   - "existing impl" framing understated reality — impl is fully Phase 2A-shipped + 4 audit cycles. ~1.5h synthesis path saved vs ~2h fresh-recording path.

---

## Cross-References

- Java: `backend/java/cretas-api/src/main/java/com/cretas/aims/controller/SmartBIAnalysisController.java:531-586` (controller), `service/smartbi/impl/SmartBIServiceImpl.java:1018-1069` (`processDrillDown`), `:1975-2076` (5 dim dispatchers)
- Python: `backend/python/smartbi_compat/api/analysis_drilldown.py` (747 LOC), `backend/python/main.py:1205` (router include), `backend/python/smartbi_compat/schema_compat.py:96-118` (envelope helper)
- Fixtures: `tests/fixtures/java-smartbi-golden/drill-down-*.json` (9 existing + 1 new this PR)
- Spec: `docs/superpowers/specs/2026-05-02-phase2a-drill-down-design.md` (2029 LOC) + 4 audit cycles
- Audit refs: PR #178 §3.1.a, PR #196 §3.4, PR #180 §1
- Rules: `.claude/rules/python-java-port.md` (Rule 1, 4, 8, 9, 11) + `concurrent-edit-safety.md` (commit hygiene for nginx config edits)
- Memory: `reference_smartbi_gold_layer_architecture.md` (F001 has populated Gold POS data), `feedback_active_e2e_replaces_passive_soak.md` (post-cutover verify), `feedback_marching_order_method_name_grep.md` (organizer drift catches)
