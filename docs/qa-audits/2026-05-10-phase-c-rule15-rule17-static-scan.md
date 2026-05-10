# Phase C Rule 15 + Rule 17 Static Scan

**Audit type**: audit-only (no code edits, no prod deploy)
**Trigger**: Phase C cumulative >3 logic commits (18 sub-batches over 3 rounds, ~2000+ LOC delete in BASE..HEAD diff; 4000+ LOC across full Phase C lifecycle including pre-BASE rounds)
**Audit date**: 2026-05-10
**Author**: chat4 (organizer-dispatched independent reviewer)

**Range**:
- BASE SHA: `571a0b4ddf` (Sub-E close, pre-Round-2/3)
- HEAD SHA: `17c0525ef3` (Sub-S close, audit baseline)
- Note: `origin/main` has advanced one commit beyond HEAD (`1d356b3475` — llm-router, Phase-C-unrelated). Audit scope is `BASE..HEAD` only.

**Cumulative diff in scope** (Java backend src):
```
18 files changed, 31 insertions(+), 2064 deletions(-)
```

8 files entirely deleted in scope:
- `dto/smartbi/AnalysisRequest.java`
- `dto/smartbi/DrillDownResponse.java`
- `entity/smartbi/SmartBiAnalysisConfig.java`
- `entity/smartbi/SmartBiQueryTemplate.java`
- `entity/smartbi/SmartBiShareToken.java`
- `entity/smartbi/enums/AnalysisConfigType.java`
- `repository/smartbi/SmartBiAnalysisConfigRepository.java`
- `repository/smartbi/SmartBiShareTokenRepository.java`

---

## §0 — TL;DR

**Verdict: NO pre-prod blocker.** Phase C BASE..HEAD is internally consistent; all KEEP paths verified intact; 0 dangling refs to deleted symbols.

**Rule 15 (independent reviewer)**: **CLEAN — 0 Critical, 0 Important, 1 Minor (informational)**. The Minor finding is a known-deferred schema-orphan condition (DB tables `smart_bi_analysis_config` and `smart_bi_share_tokens` remain after Sub-Q entity delete; explicitly deferred per Sub-Q audit doc §141/§165). No FK orphan, no runtime side effect.

**Rule 17 (6-pattern grep sweep)**:

| # | Pattern | Hits in Phase C scope | Risk |
|---|---|---|---|
| 17.1 | `@RequestBody Entity` direct bind | 3 hits, all DTO (NLQueryRequest, DrillDownRequestDTO, DataSourceDTO) | **SAFE** |
| 17.2 | Mapper partial-field `updateEntity` | 5 hits, all out-of-scope (production/user/supplier/material/customer mappers, no SmartBI mapper) | **OUT OF SCOPE** |
| 17.3 | `@Transient` setter call risk | 14 entity hits, all derived getters (`isExpired`, `getProfit`, `calculateReward`, …), no setter binding | **SAFE** |
| 17.4 | FE `...form` spread phantom in SmartBI views | 0 hits in `web-admin/src/views/analytics/smart-bi/` | **SAFE** |
| 17.5 | Semantic delta vs absolute (`newQuantity`/`delta`/`adjustQuantity`) | 1 hit — SSE event-type comment string in `SmartBIDashboardController.java:241`, not a quantity adjust | **SAFE** |
| 17.6 | `@RequestBody Create*` PUT bind risk | 0 hits in SmartBI controllers | **SAFE** |

**Cross-pattern sweep (sibling-cause grep)**:
- 8 deleted files: 0 dangling references in Java main src
- All Sub-H/I/L deleted method names: 0 callers in Java main src
- `getReceivableAgingChart` (Sub-L Option A KEEP): preserved, alive caller chain verified
- Reflection / Spring proxy patterns (`@Scheduled`, `@EventListener`, `@Async`, `@Cacheable`, `Method.invoke`, `getDeclaredMethod`): 0 hits inside SmartBI service impl scope
- Compile-time clean: deleted entity classes have 0 remaining import refs

**Decision**: see §10. Pre-prod blocker status determined after §1 reviewer findings merged.

---

## §1 — Rule 15 Independent Reviewer Findings

> **Source**: `pr-review-toolkit:code-reviewer` agent (zero conversation context, BASE..HEAD diff scope, sibling-sweep instruction).
> **Full evidence file**: `docs/qa-audits/2026-05-10-phase-c-rule15-reviewer-findings.md` (153 lines, written by the agent in parallel).

### Result: CLEAN AUDIT — 0 Critical, 0 Important, 1 Minor (informational)

Across 18 sub-batches in scope (Sub-H/I/K/L/M/N/O/P/Q/R/S/T plus prior Sub-A through Sub-G upstream of BASE), the cumulative delete is internally consistent and does NOT silently break any KEEP path. The reviewer ran 14 sweeps across all 6 risk classes the dispatch prompt called out. Every deleted symbol has zero residual call site in `src/main`, `src/test`, `web-admin/`, `frontend/CretasFoodTrace/`, `mall-admin/`, and Python services.

### Inventory checked

- **19 methods deleted** across `SmartBIServiceImpl`, `InventoryHealthAnalysisServiceImpl`, `ProcurementAnalysisServiceImpl`, `RegionAnalysisServiceImpl` (interface + impl, both layers).
- **8 files deleted**: 2 DTOs (`AnalysisRequest`, `DrillDownResponse`), 3 entities (`SmartBiAnalysisConfig`, `SmartBiQueryTemplate`, `SmartBiShareToken`), 1 enum (`AnalysisConfigType`), 2 repositories.

### Sweeps performed (high-signal results only)

1. **Direct method-name grep** against `src/main` — only false-positive name collisions (`PermissionServiceImpl.invalidateCache()` no-arg, `AIQuotaUsage.getRemainingQuota()` entity getter on a different class). No real orphan callers.
2. **Reflection** — 12 reflection-using files swept; 0 hits on any deleted method name.
3. **SpEL strings** in `application*.{properties,yml}` — 0 hits.
4. **Spring proxy** — `@Async / @Cacheable / @Scheduled / @EventListener / @PostConstruct / @PreDestroy` — only `@PreDestroy shutdownExecutor` survives in `SmartBIServiceImpl` (unrelated to deletes).
5. **AI Tool layer** (`ai/tool/impl/**`) — 0 hits on deleted SmartBI symbols.
6. **FE dependency** — 0 hits in `web-admin/` and `frontend/CretasFoodTrace/` for any deleted endpoint URL.
7. **Cross-Sub v3 KEEP chain** (Sub-L `getReceivableAgingChart` ↔ Sub-N's deletes) — `getFinanceOverview` (FAS:112), call site (FAS:159), method body (FAS:545) all alive. Sub-N never touched `FinanceAnalysisServiceImpl`.
8. **Sub-N's 6 internal-self-reference KEEPs** — verified 26 internal occurrences in `SmartBIServiceImpl.java`.
9. **DB-table-level orphan check** — `smart_bi_query_templates` is correctly NOT-orphan (Python actively reads/writes via `analysis.py` + `query_templates_write.py`); `smart_bi_analysis_config` and `smart_bi_share_tokens` are true schema orphans (zero references in any code) — see F-1 below.

### F-1 (Minor / informational): Schema-orphan tables documented but deferred

| Anchor | Detail |
|---|---|
| **Symptom file** | `backend/java/cretas-api/src/main/resources/db/migration/V2026_01_18_10__smartbi_schema_metadata.sql:48` (creates `smart_bi_analysis_config`); `backend/java/cretas-api/src/main/resources/db/migration-pg/V0002__create_update_triggers.sql:556` (still-active timestamp trigger on `smart_bi_analysis_config`) |
| **Why** | Sub-Q (PR #256) deleted JPA entities `SmartBiAnalysisConfig` + `SmartBiShareToken` and their repositories, but left the underlying DB tables in place. Post-merge: tables exist in PG with zero application read/write paths. Any data already stored is unreachable from application code. |
| **Sibling sweep** | Zero `REFERENCES smart_bi_analysis_config` or `REFERENCES smart_bi_share_tokens` FKs anywhere in DDL — no FK orphan risk. Distinct from `smart_bi_query_templates` which Python owns now (Sub-K correctly classified, see §8.5 of this report). |
| **Why NOT Critical/Important** | Sub-Q audit doc itself acknowledges this state at lines 141 and 165 and explicitly defers DB-table DROP to a separate migration task — the conservative posture for production PG. No runtime side effect. |
| **Suggested follow-up** | Separate ticket, no urgency: future maintenance-window Flyway migration to drop the trigger, then `DROP TABLE IF EXISTS smart_bi_analysis_config, smart_bi_share_tokens CASCADE` after data archive. |

### Cross-Sub consistency verification (per prompt items #5 / #6)

- **Sub-L deleted `getComprehensiveAnalysis` — did Sub-N's KEEP list silently break it?** No regression. Sub-N only deleted `invalidateCache(String, String)` and `getRemainingQuota(String)` from the same file. `getFinanceOverview` lives in `FinanceAnalysisServiceImpl` (different class). Sub-N never touched it. KEEP chain intact.
- **Sub-L `getReceivableAgingChart` KEEP rationale**: Verified — `FinanceAnalysisServiceImpl.java:112/159/545` and `FinanceAnalysisService.java:148` all alive; `SmartBIDashboardController.java:538` is an additional KEEP backstop.
- **Sub-N's 6 internal-self-reference KEEPs** (`getFromCache`, `saveToCache`, `recordUsage`, `checkQuota`, `generateAIInsights`, `getDataDateRange`): Verified — 26 internal references in `SmartBIServiceImpl.java`.

### Reviewer conclusion

> Phase C Java SmartBI dead-code-delete refactor is internally consistent and safe to land. No silent KEEP-path breakage detected across reflection, Spring proxy, SpEL, URL surface, FK, cross-package, or cross-Sub v3-protocol risk classes. No code changes recommended for this audit cycle.

---

## §2 — Rule 17.1 `@RequestBody Entity` Direct Bind

**Pattern**: `grep '@RequestBody [A-Z][a-zA-Z]+ [a-z]'` in `controller/SmartBI*.java`.

### Hits (3)

| File:line | Bound type | Verdict |
|---|---|---|
| `SmartBIAnalysisController.java:162` | `NLQueryRequest` | DTO — safe |
| `SmartBIAnalysisController.java:202` | `DrillDownRequestDTO` | DTO — safe |
| `SmartBIConfigController.java:798` | `DataSourceDTO` | DTO — safe |

### Risk assessment

All three are DTOs with `Request` / `DTO` suffix. None bind to a JPA `@Entity` class directly, so:
- No phantom-field ingestion of unintended persisted columns (`createdAt`, `updatedAt`, `factoryId`)
- No JPA cascade pollution
- No DBA-only fields exposed to API surface

Rule 17.1 spec compliant.

---

## §3 — Rule 17.2 Mapper Partial-Field `updateEntity`

**Pattern**: `grep 'public void update[A-Z]\|public.*updateEntity'` in `mapper/`.

### Hits (5, all out of Phase C scope)

| File:line | Type |
|---|---|
| `mapper/ProductionPlanMapper.java:218` | `updateEntity(ProductionPlan, CreateProductionPlanRequest)` |
| `mapper/UserMapper.java:104` | `updateEntity(User, CreateUserRequest)` |
| `mapper/SupplierMapper.java:102` | `updateEntity(Supplier, UpdateSupplierRequest)` |
| `mapper/MaterialBatchMapper.java:200` | `updateEntity(MaterialBatch, UpdateMaterialBatchRequest)` |
| `mapper/CustomerMapper.java:106` | `updateEntity(Customer, UpdateCustomerRequest)` |

### Risk assessment for Phase C

**No SmartBI mapper exists with `updateEntity`** — SmartBI persistence flows through JPA repository `save()` with explicit field setters, not partial-field mapper updates. None of the 5 hits are touched by Phase C deletes (BASE..HEAD diff did not change any file in `mapper/`).

The 5 hits remain a *standing* Rule 17.2 audit item for non-SmartBI domains (PR `Create*Request` reused for both POST and PUT could phantom-overwrite preserved fields), but **out of Phase C audit scope**.

---

## §4 — Rule 17.3 `@Transient` Setter Call Risk

**Pattern**: `grep -B 1 -A 2 '@Transient'` in `entity/smartbi/`.

### Hits (14 derived getters + 1 transient ObjectMapper)

| File:line | Method | Kind |
|---|---|---|
| `SmartBiBillingConfig.java:93,101,109,117` | `isQuotaMode`, `isPayAsYouGoMode`, `isUnlimitedMode`, `estimateMonthlyCost` | derived getter |
| `SmartBiAnalysisCache.java:112` | `isExpired` | derived getter |
| `SmartBiDepartmentData.java:124,135,143` | `getTargetAchievementRate`, `getProfit`, `getPerCapitaProfit` | derived getter |
| `SmartBiFieldDefinition.java:140` | `getDisplayName` | derived getter |
| `SmartBiFinanceData.java:188,196` | `isOverdue`, `getBudgetVarianceRate` | derived getter |
| `SmartBiIncentiveRule.java:120,137,154,171` | `matches`, `calculateReward`, `getRewardDisplay`, `getRangeDisplay` | derived getter |
| `SmartBiQueryHistory.java:114` | `hasPositiveFeedback` | derived getter |
| `SmartBiSalesData.java:183` | `getTargetAchievementRate` | derived getter |
| `postgres/SmartBiPgExcelUpload.java:100` | `FIELD_MAPPINGS_PARSER` (static `ObjectMapper`) | transient field |

### Risk assessment

All `@Transient` annotations protect either:
1. **Derived getter methods** (`is*()`, `get*()`, `calculateXxx()`, `matches()`) — annotation tells Hibernate "don't try to map this getter to a persisted column." None of these are setters; there is no setter equivalent that could be called from a mapper.
2. **Static `ObjectMapper`** (`SmartBiPgExcelUpload`) — pure utility, also annotated `@JsonIgnore`. Not a writable property.

**No risk of mapper inadvertently invoking a setter for a `@Transient` virtual property** because none of the listed names have setter pairs. Phase C deletes did not introduce any `@Transient` field with a writable setter.

Rule 17.3 spec compliant.

---

## §5 — Rule 17.4 FE `...form` Spread Phantom Payload

**Pattern**: `grep '\.\.\.form'` in `web-admin/src/views/analytics/smart-bi/`.

### Hits

**0 hits.**

### Risk assessment

SmartBI vue views in `analytics/smart-bi/` do not use object-spread `{ ...form }` payload construction in API calls within Phase C diff scope. No phantom field injection (e.g., implicit `factoryId`, `id`, `createdAt`) from FE form models.

(Out-of-scope sweep across `web-admin/src/views/`: not performed — Phase C is Java-only.)

Rule 17.4 spec compliant.

---

## §6 — Rule 17.5 Semantic Delta vs Absolute

**Pattern**: `grep 'newQuantity\|delta\|adjustQuantity'` in `controller/SmartBI*.java`.

### Hits (1, false positive)

| File:line | Match | Context |
|---|---|---|
| `SmartBIDashboardController.java:241` | `delta` | Comment string referring to SSE event type names: `meta / delta / done / error` (in Server-Sent-Events stream from `AgentOrchestrator.stream_insight`). Not a quantity-adjust API parameter. |

### Risk assessment

SmartBI is read-only analytics — no quantity adjustment endpoints. Single match is a comment artifact. No semantic-delta-vs-absolute API ambiguity in Phase C scope.

Rule 17.5 spec compliant.

---

## §7 — Rule 17.6 Shared `Create*` DTO Across Create + Update

**Pattern**: `grep '@RequestBody Create[A-Z]'` in `controller/SmartBI*.java`.

### Hits

**0 hits.**

### Risk assessment

SmartBI controllers do not bind any `Create*Request` DTO to a `@PutMapping` (which would risk phantom-field overwrite of preserved fields when reusing a creation DTO for partial update). Spec compliant.

---

## §8 — Cross-Pattern Sibling Sweep

**Goal**: per Rule 15 instruction *"sweep siblings for same-cause bugs"* — verify each potential risk class doesn't have other latent occurrences in Phase C scope.

### 8.1 Deleted-symbol orphan grep (compile-clean check)

| Deleted symbol | Refs in Java main src | Verdict |
|---|---|---|
| `SmartBiAnalysisConfig` | 0 | clean |
| `SmartBiQueryTemplate` | 0 | clean |
| `SmartBiShareToken` | 0 | clean |
| `AnalysisConfigType` | 0 | clean |
| `SmartBiAnalysisConfigRepository` | 0 | clean |
| `SmartBiShareTokenRepository` | 0 | clean |
| `dto.smartbi.AnalysisRequest` (deleted) | 0 (other `*AnalysisRequest` classes are unrelated: `PythonAnalysisRequest`, `EfficiencyAnalysisRequest`, `BatchCostAnalysisRequest`, etc.) | clean |
| `dto.smartbi.DrillDownResponse` | 0 | clean |
| Sub-H deleted methods (`getTurnoverTrendChart`, `getTurnoverByCategory`, `getLossReasonChart`, `getLossTrendChart`, `getHealthRadarChart`) | 0 | clean |
| Sub-I deleted methods (`getSupplierEvaluation`, `getSupplierDetailMetrics`, `getPurchaseCostAnalysis`, `getCostMetrics`, `getSupplierRanking`, `getMaterialCategoryRanking`, `getProcurementTrendChart`, `getSupplierTrendComparison`) | 0 | clean |
| Sub-L deleted methods (`getComprehensiveAnalysis`, `getRegionTargetCompletion`, `getGeographicHeatmapData`, `getRegionOpportunityScores`) | 0 | clean |

### 8.2 v3 protocol KEEP-path verification

**`getReceivableAgingChart` (Sub-L Option A reclassification — moved from DELETE to KEEP):**

| Site | Status |
|---|---|
| `service/smartbi/FinanceAnalysisService.java:148` (interface decl) | preserved |
| `service/smartbi/impl/FinanceAnalysisServiceImpl.java:545` (impl) | preserved |
| `service/smartbi/impl/FinanceAnalysisServiceImpl.java:159` (caller — inside `getFinanceOverview()` chartList build) | preserved |

`getFinanceOverview` (the upstream caller of `getReceivableAgingChart`) is also preserved across all 5 sites:
- `FinanceAnalysisService.java:80` (interface)
- `FinanceAnalysisServiceImpl.java:112` (impl)
- `SmartBIServiceImpl.java:1471` (cross-service caller)
- `SmartBIDashboardController.java:538` (composite controller caller)
- `client/PythonSmartBIClient.java:1167` (Python proxy)

✓ Sub-N did **not** accidentally delete `getFinanceOverview`. Sub-L Option A KEEP for `getReceivableAgingChart` is structurally sound.

### 8.3 Sub-N deleted-method name collision check

Sub-N deleted `invalidateCache` and `getRemainingQuota` from `SmartBIServiceImpl`. Sibling sweep:

| Method | Other classes that still define it | Phase C risk |
|---|---|---|
| `invalidateCache` | `service/impl/PermissionServiceImpl.java:47` (different class, different concern: permission cache) | None — different bean, callers explicitly cast `(PermissionServiceImpl) permissionService` (`FactoryRoleModuleOverrideController.java:121`, `PlatformRolePermissionController.java:102`). |
| `getRemainingQuota` | `entity/AIQuotaUsage.java:82` (entity getter, different class) | None — `AIEnterpriseService.java:558` calls `quota.getRemainingQuota()` on `AIQuotaUsage` instance, not on `SmartBIService`. |

No method-name collision risk. Sub-N delete was bean-scoped.

### 8.4 Reflection / Spring proxy hidden-caller sweep

Patterns checked across `backend/java/cretas-api/src/main/java`:

| Pattern | Hits in scope | Touches SmartBI? |
|---|---|---|
| `Method.invoke`, `getDeclaredMethod`, `ReflectionUtils.invoke`, `MethodHandle`, `invokeMethod` | 15 hits — all in `engine/SpelConditionEvaluator.java` and `service/impl/StateMachineServiceImpl.java` | **No** — both are state-machine / SpEL workflow engines registering their own static methods (`now`, `addHours`, `daysBetween`, `hasPermission`, `isQualityPassed`, …). None reference any SmartBI symbol. |
| `@Scheduled`, `@EventListener`, `@Async`, `@Cacheable`, `@PostConstruct` (SmartBI service impl only) | 0 hits in `service/impl/SmartBI*.java` | None — no scheduled or async-proxy entry point that could call a Sub-N–deleted method. |

✓ No reflection-call-site risk for any deleted SmartBI method.

### 8.5 DB schema vs Java entity drift (informational, not Phase C bug)

Python migrations under `backend/python/smartbi/database/migrations/` still contain RLS policies for `smart_bi_query_templates` (V20260502_04, V20260502_05). The corresponding Java entity `SmartBiQueryTemplate` is deleted in Sub-K.

**Interpretation**: per Phase 2A migration, query template ownership shifted to Python side (Python writes `smart_bi_query_templates` directly; Java side no longer reads it). Java entity removal is the correct outcome — the table is "dead from Java's perspective, alive from Python's." Not a compile risk, not a runtime regression in the Java path. Out of Phase C scope to act on; flagged for awareness only.

---

## §9 — Per-Finding Vulnerable / Safe / Needs-Verify

| Finding | Status | Notes |
|---|---|---|
| Rule 17.1 `@RequestBody` direct entity bind | **Safe** | All hits are DTOs |
| Rule 17.2 mapper `updateEntity` | **Safe (out of scope)** | No SmartBI mapper hits |
| Rule 17.3 `@Transient` setter call | **Safe** | All hits are derived getters |
| Rule 17.4 FE `...form` spread | **Safe** | 0 hits in SmartBI views |
| Rule 17.5 semantic delta | **Safe** | 1 hit is comment string (SSE event name) |
| Rule 17.6 `Create*` DTO PUT bind | **Safe** | 0 hits |
| 8.1 deleted-symbol orphan refs | **Safe** | All 0 |
| 8.2 v3 protocol `getReceivableAgingChart` KEEP | **Safe** | Caller chain alive |
| 8.3 Sub-N name-collision risk | **Safe** | Different classes, different beans |
| 8.4 reflection / proxy hidden caller | **Safe** | 0 SmartBI references in reflection sites |
| 8.5 DB-vs-entity drift (`smart_bi_query_templates`) | **Informational** | Expected per Phase 2A Python ownership shift |
| §1 reviewer F-1 schema-orphan tables (`smart_bi_analysis_config`, `smart_bi_share_tokens`) | **Informational (Minor)** | Acknowledged-deferred per Sub-Q audit doc §141/§165; no FK orphan, no runtime side effect; future maintenance ticket |

---

## §10 — Decision: Pre-Prod Blocker?

**Final answer: NO blocker.**

| Layer | Verdict |
|---|---|
| Rule 15 (independent reviewer, 14 sweeps) | CLEAN — 0 Critical, 0 Important, 1 Minor (informational) |
| Rule 17.1–17.6 (6-pattern grep) | All 6 patterns spec-compliant |
| §8 sibling sweep (deleted-symbol orphan, v3 KEEP chain, name-collision, reflection / Spring proxy) | All clear |
| Cumulative diff scope | 18 files / +31 / -2064 LOC, internally consistent |

**Pre-existing Phase C confidence + this static scan together**: Phase C BASE..HEAD is safe to remain on `main`. Phase D (per `2026-05-15-t6-5-phase-d-readiness-and-plan-audit.md`) can proceed without rolling back Phase C.

### Informational deferrals (NOT blockers, future maintenance tickets)

1. **§1 F-1 / §8.5** — three schema-orphan-or-foreign-owned tables:
   - `smart_bi_analysis_config` and `smart_bi_share_tokens` — true schema orphans (no Java entity, no Python writer). Sub-Q audit doc §141/§165 explicitly defers DROP. Future Flyway migration: drop trigger on `smart_bi_analysis_config` (in `db/migration-pg/V0002__create_update_triggers.sql:556`), then `DROP TABLE IF EXISTS smart_bi_analysis_config, smart_bi_share_tokens CASCADE` after data archive.
   - `smart_bi_query_templates` — Java entity deleted, Python owns the table now (per Phase 2A architecture). Confirm Python `query_templates_write.py` stays the sole writer; if any Java service needs to read this table later, route through Python `/api/smartbi/query-templates/*` HTTP surface, not a re-instantiated `SmartBiQueryTemplate` entity.

2. **§3 Rule 17.2 standing audit** — five non-SmartBI mappers (`ProductionPlanMapper`, `UserMapper`, `SupplierMapper`, `MaterialBatchMapper`, `CustomerMapper`) each have a `updateEntity(...)` method that takes a `Create*Request` or `Update*Request`. Out of Phase C scope. A separate audit pass should verify each one null-guards every field (or accepts that the partial-update semantics are intentional).

---

## Method (for reproducibility)

### Rule 15 reviewer dispatch

Marching-order specified `superpowers:code-reviewer`. The closest available subagent in this harness is `pr-review-toolkit:code-reviewer`, which was used. Identical methodology — independent reviewer, zero conversation context, BASE..HEAD scope, sibling-sweep instruction.

```
Agent.subagent_type = pr-review-toolkit:code-reviewer
Inputs: BASE 571a0b4ddf, HEAD 17c0525ef3
Scope: backend/java/cretas-api/src/main/java/com/cretas/aims/{controller,service,entity,repository}/smartbi/**
       + impacted ai/tool/impl/**, dto/smartbi/**
Mission: verify NO KEEP path silently broken (6 sub-checks: reflection, URL surface, FK orphan, cross-pkg callers, cross-PR consistency, v3 protocol getReceivableAgingChart)
Output: 3-5 Important findings + sibling sweep
Result: 0 Critical, 0 Important, 1 Minor (informational)
```

### Rule 17 grep commands run

```
17.1: grep -rn '@RequestBody [A-Z][a-zA-Z]+ [a-z]' backend/java/cretas-api/src/main/java/com/cretas/aims/controller/SmartBI*.java
17.2: grep -rn 'public void update[A-Z]\|public.*updateEntity' backend/java/cretas-api/src/main/java/com/cretas/aims/mapper/
17.3: grep -B 1 -A 2 '@Transient' backend/java/cretas-api/src/main/java/com/cretas/aims/entity/smartbi/
17.4: grep -rn '\.\.\.form' web-admin/src/views/analytics/smart-bi/
17.5: grep -rn 'newQuantity\|delta\|adjustQuantity' backend/java/cretas-api/src/main/java/com/cretas/aims/controller/SmartBI*.java
17.6: grep -rn '@RequestBody Create[A-Z]' backend/java/cretas-api/src/main/java/com/cretas/aims/controller/SmartBI*.java
```

### §8 sibling sweep commands

```
8.1: grep -rn '<deleted_symbol>' backend/java/cretas-api/src/main/java
8.2: grep -rn 'getReceivableAgingChart\|getFinanceOverview' backend/java/cretas-api/src/main/java
8.3: grep -rn 'invalidateCache\|getRemainingQuota' backend/java/cretas-api/src/main/java
8.4: grep -rn 'Method\.invoke\|getDeclaredMethod\|ReflectionUtils\.invoke\|MethodHandle\|invokeMethod' (and: '@Scheduled\|@EventListener\|@Async\|@Cacheable')
8.5: grep -rn 'smart_bi_analysis_configs\|smart_bi_query_templates\|smart_bi_share_tokens' backend/python/smartbi/database/migrations/
```

---

## Cross-references

- Phase C MO: PR #205 execute, PR #178 Phase A audit
- Sub-batch audits in scope (BASE..HEAD):
  - Sub-H — `2026-05-10-t6-5-phase-c-sub-h-inventory-audit.md`
  - Sub-I — `2026-05-10-t6-5-phase-c-sub-i-procurement-audit.md`
  - Sub-K — entity-only delete (no audit doc)
  - Sub-L — `2026-05-10-t6-5-phase-c-sub-l-orphan-sweep-audit.md`
  - Sub-M — `2026-05-10-t6-5-phase-c-sub-m-dashboard-controller-audit.md` (audit-only KEEP)
  - Sub-N — `2026-05-10-t6-5-phase-c-sub-n-smartbi-service-impl-audit.md`
  - Sub-Q — `2026-05-10-t6-5-phase-c-sub-q-entity-orphan-sweep-audit.md`
  - Sub-R — `2026-05-10-t6-5-phase-c-sub-r-repository-orphan-sweep-audit.md` (audit-only)
  - Sub-S — `2026-05-10-t6-5-phase-c-sub-s-other-controllers-audit.md` (audit-only KEEP)
  - Sub-T — `2026-05-10-t6-5-phase-c-sub-t-test-orphan-sweep-audit.md` (audit-only NO-OP)
- Reviewer parallel artifact: `2026-05-10-phase-c-rule15-reviewer-findings.md` (written by `pr-review-toolkit:code-reviewer` subagent)
