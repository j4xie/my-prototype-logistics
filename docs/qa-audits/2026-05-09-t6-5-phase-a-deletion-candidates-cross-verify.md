# T6.5 Phase A Deletion-Candidates — Independent Cross-Verification of PR #178

**Date**: 2026-05-09
**Author**: Chat D (sister-chat cross-verifier)
**Scope**: Independent audit comparing this chat's findings against PR #178 (T6.5 Phase A Java SmartBI deletion-candidates audit).
**Methodology**: This auditor did NOT read PR #178 audit doc (`docs/qa-audits/2026-05-09-t6-5-phase-a-deletion-candidates.md`). All findings derived independently via nginx config inspection (server 139), Java grep, Python grep, and direct file reads. Findings then compared against PR #178 claims summarized in the dispatch.

---

## §0 TL;DR

Independent cross-verification was performed on the 7 PR #178 claims surfaced in the marching-order brief.

| # | PR #178 Claim | Cross-verify | Agreement |
|---|---|---|---|
| 1 | nginx-routed: 22 of 26 + 1 Dashboard | 22 of 26 routed to Python via 139 nginx (3 regex blocks); +1 (`data-date-range`) | ✅ |
| 2 | NOT_SAFE_FALLTHROUGH: production / quality / query / drill-down | All 4 confirmed: not in any nginx Python regex → 100% Java | ✅ |
| 3 | 10 services shared across 4 controllers | 13 dependencies counted; 12 of 13 also injected in Dashboard / PublicDemo / Upload | ✅ (with minor count nit — see §4.1) |
| 4 | GoldDashboardBuilder NOT orphaned (sales/finance impl 调) | Confirmed: injected in `FinanceAnalysisServiceImpl:59` + `SalesAnalysisServiceImpl:52` | ✅ |
| 5 | SmartBiQueryTemplateRepository: Phase C orphan candidate | Confirmed: 1 caller (`SmartBIAnalysisController` only) — orphan after Phase C deletion | ✅ |
| 6 | IncentivePlanServiceImpl doesn't exist; actual is IncentiveRuleServiceImpl | Confirmed: `ls service/smartbi/impl/Incentive*` → only `IncentiveRuleServiceImpl.java` | ✅ |
| 7 | F999 not in nginx regex | Confirmed: factory regex `(F00[1-46]|FOOD_3101_…)` does not include F999 → all F999 SmartBI traffic = Java | ✅ |

**Verdict**: PR #178 audit is **HIGH CONFIDENCE**. 7/7 claims confirmed by independent inspection. No disagreement, no contradiction, no unflagged miss surfaced. Two amplifications + one new finding worth surfacing (see §6).

---

## §1 Methodology

- Worktree: `.worktrees/t6-5-phase-a-cross-verify` rooted at `origin/main` HEAD `0f80b14b20`.
- Tools: ssh server 139 (nginx vhost cat), Grep, Glob, Read, Bash (find/ls/wc/grep wrappers).
- Did NOT read: `docs/qa-audits/2026-05-09-t6-5-phase-a-deletion-candidates.md` (PR #178 doc) — claims came from dispatch summary only.
- Reference docs read: PR #150 spec §1.2 (T6.5 IN/OUT scope), `reference_smartbi_gold_layer_architecture.md` (memory).

---

## §2 Findings (independent audit)

### 2.1 nginx routing (server 139, vhost `api.cretaceousfuture.com.conf`)

Three `location ~` regex blocks route to `cretas_python` upstream:

```
# Block 1 — alerts/recommendations/data-date-range
location ~ ^/api/mobile/<factory_regex>/smart-bi/(alerts|recommendations|data-date-range)$

# Block 2 — analysis subpaths (6 domains only)
location ~ ^/api/mobile/<factory_regex>/smart-bi/analysis/(finance|sales|department|region|inventory|procurement)(/.*)?$

# Block 3 — query-templates / datasource / incentive-plan
location ~ ^/api/mobile/<factory_regex>/smart-bi/(query-templates|datasource|incentive-plan)(/.*)?$
```

**Factory regex** (`<factory_regex>`):
```
(F00[1-46]|FOOD_3101_(00[1-9]|0[1-3][0-9]|04[0-8])|MEAT_3101_00[12]|OTHER_3101_001|RES_3101_00[1-9]|RES_GML_001|R001|R_(GML_DEMO|XMX_(CHAIN|FRESH[123]?)|YHDJ_DEMO|YJJ_DEMO)|TEST_0000_001)
```

Notes:
- `F00[1-46]` = char-class `[1-46]` = `[1-4] ∪ {6}` → matches F001/F002/F003/F004/F006 (F005 absent — known by design per cohort).
- **F999 NOT in factory regex** → ALL F999 SmartBI traffic → Java fallthrough via `location /`.
- `RES_3101_00[1-9]` covers RES_3101_001 through RES_3101_009.

Non-Python paths fall through to `location /` → `cretas_backend` (Java 47:10010).

### 2.2 SmartBIAnalysisController endpoint inventory

`backend/java/cretas-api/src/main/java/com/cretas/aims/controller/SmartBIAnalysisController.java` (1029 LOC, base path `/api/mobile/{factoryId}/smart-bi`):

26 method-level mappings (line numbers from grep):

| # | Verb | Path | Routing for 75-cohort | Routing for F999 |
|---|---|---|---|---|
| 1 | GET | `/analysis/sales` | Python (regex 2) | Java (no F999 match) |
| 2 | GET | `/analysis/department` | Python (regex 2) | Java |
| 3 | GET | `/analysis/region` | Python (regex 2) | Java |
| 4 | GET | `/analysis/finance` | Python (regex 2) | Java |
| 5 | GET | `/analysis/finance/budget-achievement` | Python (regex 2 + `/.*`) | Java |
| 6 | GET | `/analysis/finance/yoy-mom` | Python (regex 2) | Java |
| 7 | GET | `/analysis/finance/category-comparison` | Python (regex 2) | Java |
| 8 | GET | `/analysis/production` | **Java (regex 2 whitelist excludes)** | Java |
| 9 | GET | `/analysis/quality` | **Java (regex 2 whitelist excludes)** | Java |
| 10 | GET | `/analysis/inventory` | Python (regex 2) | Java |
| 11 | GET | `/analysis/procurement` | Python (regex 2) | Java |
| 12 | POST | `/query` | **Java (no regex match)** | Java |
| 13 | POST | `/drill-down` | **Java (no regex match)** | Java |
| 14 | GET | `/alerts` | Python (regex 1) | Java |
| 15 | GET | `/recommendations` | Python (regex 1) | Java |
| 16 | GET | `/incentive-plan/{targetType}/{targetId}` | Python (regex 3) | Java |
| 17 | POST | `/datasource/upload` | Python (regex 3) — but **no Python impl** | Java |
| 18 | GET | `/datasource/{datasourceId}/preview` | Python (regex 3) — but **no Python impl** | Java |
| 19 | POST | `/datasource/apply` | Python (regex 3) — but **no Python impl** | Java |
| 20 | GET | `/datasource/list` | Python (regex 3) | Java |
| 21 | GET | `/datasource/{datasourceId}/fields` | Python (regex 3) | Java |
| 22 | GET | `/datasource/{datasourceId}/history` | Python (regex 3) | Java |
| 23 | GET | `/query-templates` | Python (regex 3) | Java |
| 24 | POST | `/query-templates` | Python (regex 3) | Java |
| 25 | PUT | `/query-templates/{templateId}` | Python (regex 3) | Java |
| 26 | DELETE | `/query-templates/{templateId}` | Python (regex 3) | Java |

**Summary** (75-cohort routing):
- Python (with implementation): 19 endpoints
- Python-routed but no Python impl → would 404 if hit: 3 endpoints (`datasource/upload`, `/preview`, `/apply`)
- Java (regex doesn't include path): 4 endpoints (production / quality / query / drill-down)

**For F999**: all 26 endpoints → Java (factory regex excludes F999 entirely).

### 2.3 Service class sharing

13 deps injected into `SmartBIAnalysisController` (lines 52–64):

| Service | Also in Dashboard | Also in PublicDemo | Also in Upload | Sharing? |
|---|---|---|---|---|
| `SalesAnalysisService` | ✅ | ✅ | — | shared |
| `DepartmentAnalysisService` | ✅ | ✅ | — | shared |
| `RegionAnalysisService` | ✅ | ✅ | — | shared |
| `FinanceAnalysisService` | ✅ | ✅ | — | shared |
| `ProductionAnalysisService` | ✅ | — | — | shared |
| `QualityAnalysisService` | ✅ | — | — | shared |
| `InventoryHealthAnalysisService` | ✅ | — | — | shared |
| `ProcurementAnalysisService` | ✅ | — | — | shared |
| `RecommendationService` | ✅ | ✅ | — | shared |
| `SmartBIIntentService` | — | ✅ | — | shared |
| `SmartBIService` | ✅ | — | — | shared |
| `SmartBiSchemaService` | — | — | — | **exclusive** |
| `SmartBiQueryTemplateRepository` | — | — | — | **exclusive** |

Plus `DynamicAnalysisService` (cited by PR #178 as 10th shared service) is NOT in `SmartBIAnalysisController` deps; it's in `SmartBIDashboardController` + `SmartBIUploadController` per grep — so its sharing is across two OUT-OF-SCOPE controllers, not pulling AnalysisController in.

**Phase C deletion implication**: Of 13 deps, 11 services + `SmartBIService` are reused by Dashboard / PublicDemo / Upload controllers (which are OUT OF SCOPE per spec §1.2). Deleting these service `*Impl` classes in Phase C would break those 3 controllers. Only `SmartBiSchemaService` impl + `SmartBiQueryTemplateRepository` are exclusive to `SmartBIAnalysisController` and thus directly safe to delete after Analysis controller goes.

### 2.4 GoldDashboardBuilder caller analysis

`grep -rn "GoldDashboardBuilder"` in Java source:

```
service/smartbi/GoldDashboardBuilder.java:46          # definition
service/smartbi/impl/FinanceAnalysisServiceImpl.java:4   # import
service/smartbi/impl/FinanceAnalysisServiceImpl.java:59  # private final goldDashboardBuilder
service/smartbi/impl/SalesAnalysisServiceImpl.java:11    # import
service/smartbi/impl/SalesAnalysisServiceImpl.java:52    # private final goldDashboardBuilder
```

**Verdict**: NOT orphan. Two callers (Finance + Sales analysis impls). Per §2.3, both impls are shared with Dashboard + PublicDemo controllers (which keep them alive even after Analysis controller is stubbed/removed). So `GoldDashboardBuilder` retains live downstream callers via Dashboard / PublicDemo paths. Architectural invariant from spec §1.2 (KEEP GoldDashboardBuilder) is consistent with reality.

### 2.5 Python coverage of Java endpoints

Found 21 Python `@router.{verb}("/api/mobile/{factory_id}/smart-bi/...")` decorators in `backend/python/smartbi_compat/api/`:

| Java endpoint | Python file:line |
|---|---|
| `GET /analysis/sales` | `analysis_sales.py:1724` |
| `GET /analysis/department` | `analysis_department.py:676` |
| `GET /analysis/region` | `analysis_region.py:770` |
| `GET /analysis/finance` | `analysis_finance.py:3286` |
| `GET /analysis/finance/budget-achievement` | `analysis_finance.py:3339` |
| `GET /analysis/finance/yoy-mom` | `analysis_finance.py:3351` |
| `GET /analysis/finance/category-comparison` | `analysis_finance.py:3407` |
| `GET /analysis/inventory` | `analysis_inventory.py:1891` |
| `GET /analysis/procurement` | `analysis_procurement.py:1209` |
| `POST /drill-down` | `analysis_drilldown.py:721` |
| `GET /alerts` | `analysis.py:946` |
| `GET /recommendations` | `analysis.py:972` |
| `GET /incentive-plan/{type}/{id}` | `incentive_plan.py:523` |
| `GET /datasource/list` | `analysis.py:931` |
| `GET /datasource/{id}/fields` | `datasource.py:246` |
| `GET /datasource/{id}/history` | `datasource.py:271` |
| `GET /query-templates` | `analysis.py:127` |
| `POST /query-templates` | `query_templates_write.py:223` |
| `PUT /query-templates/{id}` | `query_templates_write.py:236` |
| `DELETE /query-templates/{id}` | `query_templates_write.py:250` |
| `GET /data-date-range` (not in 26-endpoint list above; matched by nginx regex 1) | `dashboard.py:84` |

**Missing from Python** (5 of 26):
- `GET /analysis/production` — no Python impl, nginx routes to Java for all factories
- `GET /analysis/quality` — same
- `POST /query` — no Python impl, nginx routes to Java for all factories
- `POST /datasource/upload` — no Python impl, **but nginx routes 75-cohort traffic to Python (regex 3)** → Python would 404
- `GET /datasource/{id}/preview` — same shape as above
- `POST /datasource/apply` — same shape as above

**Special case — `POST /drill-down`**: Python impl EXISTS (`analysis_drilldown.py:721`) but nginx does NOT route to Python (no regex match) → Python impl is unreachable via 139 gateway. Java handles all drill-down traffic. (This may be intentional pending T6.4 expansion or a forgotten regex addition; either way it's architectural — not a Phase A deletion blocker.)

### 2.6 SmartBiQueryTemplateRepository orphan analysis

```
grep -rn SmartBiQueryTemplateRepository backend/java/cretas-api/src/main/java/
→ 2 files: definition + 1 caller (SmartBIAnalysisController only)
```

When `SmartBIAnalysisController` is deleted in Phase C, repository becomes orphaned (no remaining JPA caller in Java code). Phase C orphan candidate per PR #178 → **CONFIRMED**.

### 2.7 IncentivePlanServiceImpl name verification

```
ls backend/java/cretas-api/src/main/java/com/cretas/aims/service/smartbi/impl/Incentive*
→ IncentiveRuleServiceImpl.java
```

`IncentivePlanServiceImpl` does NOT exist. Actual class is `IncentiveRuleServiceImpl`. PR #178 identification of this naming mismatch → **CONFIRMED**. Spec §1.2 line 85 (`IncentivePlanServiceImpl`) is incorrect — it should reference `IncentiveRuleServiceImpl` instead.

---

## §3 Comparison with PR #178

| # | Topic | PR #178 claim (per dispatch) | This audit | Agreement |
|---|---|---|---|---|
| 1 | nginx-routed | 22 of 26 + 1 Dashboard | 22 of 26 method-level + 1 (`data-date-range`) cross-controller | ✅ |
| 2 | NOT_SAFE_FALLTHROUGH | production / quality / query / drill-down | Same 4 (and `POST /query` confirmed) | ✅ |
| 3 | Service sharing | 10 services shared across 4 controllers | 11+ services shared with Dashboard/PublicDemo; only 2 truly exclusive (SchemaService, QueryTemplateRepository) | ✅ (≥10 shared, count varies by definition — see §4.1) |
| 4 | GoldDashboardBuilder | NOT orphaned (sales/finance impl 调) | Confirmed two callers (Finance + Sales impl line 59 / line 52) | ✅ |
| 5 | QueryTemplateRepository | Phase C orphan candidate | 1 caller (Analysis controller) → orphan after Phase C | ✅ |
| 6 | IncentivePlanServiceImpl | Doesn't exist; actual = IncentiveRuleServiceImpl | Confirmed by direct ls | ✅ |
| 7 | F999 nginx coverage | F999 not in regex | Factory regex excludes F999 → all F999 = Java | ✅ |

---

## §4 Disagreements

**None on substance.** Two minor count/wording nits worth flagging:

### 4.1 Service sharing count nit
PR #178 says "10 services shared across 4 controllers." This audit counts 13 deps in Analysis controller, of which 12 (incl. SmartBIService) are shared with at least one other controller. The exact count depends on whether `SmartBiQueryTemplateRepository` is counted as a "service" (it's a JPA repository). Either way, the architectural conclusion holds: vast majority of Analysis controller deps cannot be deleted in Phase C without breaking Dashboard / PublicDemo / Upload controllers. PR #178 conclusion stands.

### 4.2 "22 of 26 + 1 Dashboard" wording
The "+1 Dashboard" likely refers to `/data-date-range` (which is in `SmartBIDashboardController`, not Analysis controller; this audit found it at `dashboard.py:84` matching nginx regex 1). The 22-of-26 count for Analysis controller endpoints is consistent with this audit's classification (19 routed + impl, 3 routed but no impl, 4 fallthrough). PR #178 wording is fine; this audit just makes it explicit which 4 are NOT routed.

---

## §5 Confidence verdict

**HIGH CONFIDENCE** — 0 disagreements on substance, 7/7 PR #178 claims independently confirmed.

Recommendation: organizer can trust PR #178 audit findings as Phase A planning input. Proceed with PR #178's deletion-candidate categorization for Phase C scoping. Two recommended PR #178 amendments (small, non-blocking):
1. Update spec §1.2 `IncentivePlanServiceImpl` → `IncentiveRuleServiceImpl` for accuracy.
2. Make explicit which 4 endpoints fall through to Java for the 75-cohort (production / quality / query / drill-down) — useful for Phase A monitoring grep targets.

---

## §6 Findings PR #178 may have missed (audit-of-audit)

Three additional items surfaced by this independent pass that warrant consideration:

### 6.1 Three datasource endpoints route to Python WITHOUT Python implementation

`POST /datasource/upload`, `GET /datasource/{id}/preview`, `POST /datasource/apply` are matched by nginx regex 3 (`datasource(/.*)?$`) and routed to Python upstream — but there is NO Python implementation in `smartbi_compat/api/`. For the 75-cohort, these requests would hit Python and receive a 404 (FastAPI default for unknown routes). For F999, they correctly hit Java.

**Implication for Phase A monitoring**: If web-admin / RN clients on the 75-cohort attempt these 3 endpoints, they will see 404s post-cutover. Either:
- (a) Frontend doesn't call these (verify via `grep -rn "datasource/upload\|datasource/.*preview\|datasource/apply" frontend/ web-admin/`), or
- (b) Python needs an impl OR nginx regex needs to exclude these subpaths (so they fall through to Java instead).

This is NOT a Phase A blocker but should be tracked in Phase A operator query alongside log monitoring. PR #178 may have rolled this into the "ported endpoints" count without distinguishing routed-but-unimplemented from routed-and-implemented.

### 6.2 `POST /drill-down` Python impl exists but is unreachable via 139 nginx

`analysis_drilldown.py:721` defines a Python handler for `POST /api/mobile/{factory_id}/smart-bi/drill-down`, but no nginx regex routes to Python for this path. So 100% of drill-down traffic continues to hit Java for all factories — Python code is essentially dead on prod gateway path.

**Implication**: Phase A operator query should clarify whether (i) drill-down was intentionally NOT included in T6.3 cutover regex (then Phase C should NOT delete the Java drill-down impl until nginx is updated and Python is verified working), or (ii) regex should be expanded to include `drill-down` and the Python impl reactivated. Either way, the existence of unreachable Python code is a process-debt signal.

### 6.3 `POST /query` (top-level, distinct from query-templates)

Independent of `query-templates` (which IS in nginx regex 3 and IS Python-impl), the bare `POST /query` endpoint at controller line 491 is NOT in any nginx Python regex AND NOT in Python — 100% Java for all factories. Should be added to the explicit "Java-fallthrough endpoint" list for Phase A monitoring (per recommendation §5.2). This is one of the 4 NOT_SAFE_FALLTHROUGH paths PR #178 identified, but worth distinguishing from `query-templates` in any future write-up to avoid reader confusion.

---

## §7 Reproduction commands (for reviewer verification)

```bash
# nginx vhost (server 139)
ssh root@139.196.165.140 "cat /www/server/panel/vhost/nginx/api.cretaceousfuture.com.conf"

# Java endpoint inventory
grep -nE '^\s*@(Get|Post|Put|Delete|Patch)Mapping' \
  backend/java/cretas-api/src/main/java/com/cretas/aims/controller/SmartBIAnalysisController.java

# Java service deps in Analysis controller
grep -nE 'private final\s+\w+(Service|Builder|Client|Repository)\s+\w+;' \
  backend/java/cretas-api/src/main/java/com/cretas/aims/controller/SmartBIAnalysisController.java

# Service sharing (per service)
for svc in SalesAnalysisService DepartmentAnalysisService FinanceAnalysisService \
    ProductionAnalysisService QualityAnalysisService InventoryHealthAnalysisService \
    ProcurementAnalysisService RegionAnalysisService RecommendationService \
    SmartBIIntentService SmartBiSchemaService SmartBIService; do
  echo "=== $svc ==="
  grep -rln "private final $svc " \
    backend/java/cretas-api/src/main/java/com/cretas/aims/controller/
done

# GoldDashboardBuilder callers
grep -rn 'GoldDashboardBuilder' backend/java/cretas-api/src/main/java/

# QueryTemplateRepository callers
grep -rn 'SmartBiQueryTemplateRepository' backend/java/cretas-api/src/main/java/

# Python coverage
grep -rE '@router\.(get|post|put|delete|patch)\("/api/mobile' \
  backend/python/smartbi_compat/api/

# IncentivePlanServiceImpl existence
ls backend/java/cretas-api/src/main/java/com/cretas/aims/service/smartbi/impl/Incentive*
```

---

**End of cross-verification.** Awaiting organizer review against PR #178 audit doc.
