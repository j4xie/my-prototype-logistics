# Phase 2A `/analysis/sales` Handoff (next chat — plan-driven mode)

| Field | Value |
|---|---|
| **Status** | Ready for plan-driven session (NOT inline — too big) |
| **Branch** | `phase2a/t5-poc` (16 commits ahead of origin/main, NOT pushed) |
| **Worktree** | `C:\Users\Steve\my-prototype-logistics\.worktrees\phase2a-t5-poc` |
| **Last commit** | `49f0703b8` recommendations port |
| **Phase 2A counter** | 5/50 endpoints shipped (alerts + recommendations + 3 prior batch 2 thin Z) |

---

## Why a new chat (not inline continuation)

`/analysis/sales` is materially bigger than `/alerts` or `/recommendations`:

| Endpoint | Scope | Work estimate (post-calibration) |
|---|---|---|
| `/alerts` | 3 simple generators emitting `List<Alert>` (15-key dict) | 5.5h actual |
| `/recommendations` | 3 simple generators emitting `List<Recommendation>` (13-key dict) | ~30min actual (massive reuse of alerts foundation) |
| `/analysis/sales` | composite `Map<String,Object>` with **5 sub-services** + DashboardResponse (16 fields) + multiple chart shapes | **15-20h estimated** (no calibration data yet) |

The Java code path is `smartBIService.getComprehensiveAnalysis(factoryId, startDate, endDate, "sales")` which calls:
1. `salesService.getSalesOverview(...)` → returns `DashboardResponse` (16-field complex DTO)
2. `salesService.getSalespersonRanking(...)` → ranking list
3. `salesService.getProductRanking(...)` → ranking list
4. `salesService.getCustomerRanking(...)` → ranking list
5. `salesService.getSalesTrendChart(..., "DAY")` → chart structure

Each sub-service likely 200-500 LOC. Total port ~2000+ LOC including DashboardResponse class. Inline would take many hours and risk context overflow.

**Pattern that worked for alerts**: `superpowers:brainstorming` → `superpowers:writing-plans` → spec + plan committed first, THEN inline or subagent-driven execution. Calibration showed this is **7.3× faster than ad-hoc estimates**.

---

## How to start the new chat

Paste this into a fresh chat:

```
继续 Phase 2A — port /analysis/sales 端点。当前在 phase2a/t5-poc 分支
(C:\Users\Steve\my-prototype-logistics\.worktrees\phase2a-t5-poc),
HEAD=49f0703b8 (recommendations port).

5/50 endpoints 已 ship (alerts marathon + recommendations + 3 prior).
F999 测试工厂 + 56 calibration goldens + 13/15-key dict patterns 全部就绪。

**今晚目标**: 用 superpowers:brainstorming + superpowers:writing-plans 走 plan-driven
流程 (跟 alerts marathon chat 1 一样的模式) — 先出 spec + plan，不实施。

读这些做 context:
- 入手 handoff: docs/superpowers/handoff/2026-04-30-phase2a-analysis-sales-handoff.md
- alerts marathon close-out: docs/superpowers/handoff/2026-04-29-phase2a-alerts-handoff.md (lessons learned section)
- F999 ADR: docs/adr/2026-04-29-phase2a-synthetic-test-factory-f999.md
- 校准数据: docs/superpowers/plans/2026-04-29-phase2a-batch-deferred-endpoints.md §4

Java 代码先看:
- backend/java/cretas-api/src/main/java/com/cretas/aims/controller/SmartBIAnalysisController.java line 96-138 (路由)
- backend/java/cretas-api/src/main/java/com/cretas/aims/service/smartbi/impl/SmartBIServiceImpl.java line 568-616 (getComprehensiveAnalysis sales 分支)
- backend/java/cretas-api/src/main/java/com/cretas/aims/service/smartbi/SalesAnalysisService.java + impl (5 sub-service methods)
- backend/java/cretas-api/src/main/java/com/cretas/aims/dto/smartbi/DashboardResponse.java (16-field DTO)

F999 现有 goldens (内容已在磁盘, 用于 contract test):
- tests/fixtures/java-smartbi-golden/analysis-sales-F999.json
- tests/fixtures/java-smartbi-golden/analysis-sales-dimension-salesperson-F999.json

Q1: spec only 还是 spec + plan 都做? (推荐: 都做, 像 alerts marathon kickoff 一样,
然后下一 chat 实施)
```

---

## Pre-work for plan-driven session

### Codebase exploration checklist (Q1+ in brainstorming)

1. **`SalesAnalysisServiceImpl`** — read in full (~1000 LOC?). Identify each sub-service method's logic.
2. **`DashboardResponse`** — declared fields + any derived getters (Lombok `@Data`).
   - Spot-check via existing `analysis-finance-F999.json` etc — they all share DashboardResponse shape.
3. **Repository queries** — `SmartBiSalesData` repo has 9+ aggregate queries. Identify which feed into the 5 sub-services.
4. **F999 data shape** — what does each sub-service produce on F999 (= F001 clone)?
   - Already recorded in `analysis-sales-F999.json` — inspect: `cat ... | jq '.response.data.overview'` to see kpiCards / chartList / etc.
5. **Test pattern** — current `test_alerts_contract.py` uses monkey-patch + `_strip_volatile`. Likely reusable.
6. **DashboardResponse @Data getters** — important: like Alert had levelName/urgent, this might have derived getters too. javap the class.

### Risk register (for risks section)

| Risk | Mitigation |
|---|---|
| DashboardResponse has nested types (KpiCard, ChartConfig, AiInsight) | Each needs its own dict builder. Plan should enumerate. |
| Repository queries use JPA `@Query` with custom projection types | Port via raw SQL with same column projection. |
| Time-trend chart calculations involve date bucketing | DateRange already has `by_period("month")` — extend with day-level bucketing. |
| AI insights / recommendations sub-fields invoke other services | May need to mock or stub for chat 2A; full integration in chat 2B. |
| Existing F001/F999 goldens may contain Java-only formatting (e.g. number formatting per locale) | Strip-volatile pattern + numeric coercion already established. |

### Likely chat structure (post-plan)

- **Chat A** (this prep): brainstorm + spec + plan. NO code. ~1.5h.
- **Chat B** (next): foundation — DashboardResponse dict builder + 5 sub-service stubs returning empty + 1 sub-service ported (probably overview). Contract test scaffolding. ~3-4h.
- **Chat C**: remaining 4 sub-services + composite + final golden compare. ~3-4h.
- **Chat D**: review + push. ~1h.

Total: ~10-12h vs T0 ~5h estimate (T0 was wrong). Calibration: ~3× faster than naive 1-week estimate (40h).

---

## Marathon-2 commits to date (16 on phase2a/t5-poc)

```
49f0703b8 feat(phase2a): port /recommendations endpoint with 3 generators + 4-way analysisType
4682ab2e3 docs(phase2a): /alerts marathon close-out + Phase 2A calibration data
e01c2f4c7 chore(phase2a): re-record 56 F999 goldens after Java TreeMap sort fix actually deployed
788d83e08 test(phase2a): finance + department + aggregator contract tests with stripped-volatile golden compare
8aa9e953b feat(phase2a): port finance + department generators + aggregator + 4-way route
e6fcc1839 chore(phase2a): re-record 56 F999 goldens after V20260430_02 trip-rows
b169fb0f0 feat(phase2a): F999 alert trip-rows migration + 15-key Alert dict fix + golden re-record
9c733c05e docs(phase2a): F999 synthetic test factory ADR
f84101d53 feat(phase2a): bonus F999 calibration goldens (54 endpoints)
58af128e0 feat(phase2a): sales alerts route + F999 contract test + golden
4a86d05f6 feat(phase2a): port sales alert generator (3 alert types + helpers)
517f4692a feat(phase2a): DateRange.by_period(month) + tests
40e079d65 feat(phase2a): Python alert_thresholds loader + dataclasses + tests
fb1fcafb2 fix(smartbi): TreeMap-supplied groupingBy for stable alert sort order
6ca93ff51 feat(phase2a): bundle alert_thresholds.json to Python + CI parity guard
90208d24c feat(phase2a): synthetic F999 test factory + smart_bi seed copy from F001
```

Test counts:
- **Python smartbi_compat**: 74 tests pass (was 18 baseline)
- **Java RecommendationServiceImplTest**: 2/2 pass

---

## Decision: push origin or wait?

Either approach works:

- **Push now** (16 commits as 1 PR for review) — clean review unit, marathon foundations + recommendations together. Recommended if planning to take a break.
- **Hold for /analysis/sales** — bundle the next port into same PR. Larger review but more cohesive Phase 2A increment.

User preference: **hold for now**, continue on phase2a/t5-poc next chat.

---

## Lessons from this session (chat 2+3+recommendations) for next chat

1. **`pwd` check before deploy** — Bash cwd resets between commands; one deploy ran from wrong worktree (main repo on `e2e/v1-framework`) and silently uploaded stale jar.
2. **`unzip -p .jar X.class | sha256sum` ground truth** — verify class hash matches local `target/classes/X.class` after deploy.
3. **Deploy lock leaks** — `/tmp/cretas-backend-deploy.lock` from killed background processes; need `kill <PID> && rm` before retry.
4. **Spring `${VAR:DEFAULT}` + `$`-containing values** — bcrypt env vars don't substitute correctly; use manual UPDATE post-deploy.
5. **15-key Alert / 13-key Recommendation gotchas** — Java derived getters (`getLevelName`/`isUrgent` for Alert; `getTypeName`/`isHighPriority` for Recommendation) appear in JSON. **For DashboardResponse, javap the class FIRST to enumerate all getters before writing the Python builder.**
6. **F999 = F001 clone produces ~90% completion** — for `/alerts` sales, no thresholds tripped. For `/analysis/sales`, F999's data shape directly drives the goldens — should be useful as-is.
7. **Plan-driven > ad-hoc** — 7.3× faster on alerts marathon. Use it.
