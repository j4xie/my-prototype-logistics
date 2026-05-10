# Phase C Rule 15 Independent Reviewer Findings

**Date**: 2026-05-10
**Reviewer**: Fresh independent reviewer (zero conversation context)
**Scope**: BASE `571a0b4ddf` (Sub-E close) → HEAD `17c0525ef3` (Sub-S close)
**Cumulative delta**: 16 in-scope files changed, **+1 / -2060 LOC** (smartbi controller / service / entity / repository / dto)

---

## TL;DR

**Result: CLEAN AUDIT — 0 Critical, 0 Important, 1 Minor (informational)**

Across 18 sub-batches in scope (Sub-H/I/K/L/M/N/O/P/Q/R/S/T plus prior Sub-A through Sub-G already reviewed), the cumulative delete is **internally consistent** and **does not silently break any KEEP path**.

I ran 14 sweeps targeting the 6 risk classes the dispatch prompt called out (reflection/proxy/SpEL hidden callers, URL-surface/body mismatch, FK orphan to deleted entity, cross-package callers, cross-Sub consistency, v3 KEEP-chain completeness). Every deleted symbol has zero residual call site in `src/main`, `src/test`, `web-admin/`, `frontend/CretasFoodTrace/`, `mall-admin/`, and Python services.

The only finding worth surfacing is a Minor schema-orphan note (Sub-Q tables intentionally deferred per audit doc), which the audit doc itself already acknowledges and defers to a separate task.

---

## Methodology

### Deleted-symbol inventory (extracted from `git diff 571a0b4ddf..17c0525ef3`)

**Methods deleted** (interface + impl, both layers):

| File | Methods |
|---|---|
| `SmartBIServiceImpl.java` | `getComprehensiveAnalysis`, `invalidateCache(String, String)`, `getRemainingQuota(String)` |
| `InventoryHealthAnalysisServiceImpl.java` | `getTurnoverTrendChart`, `getTurnoverByCategory`, `getLossReasonChart`, `getLossTrendChart`, `getHealthRadarChart` |
| `ProcurementAnalysisServiceImpl.java` | `getSupplierEvaluation`, `getSupplierDetailMetrics`, `getPurchaseCostAnalysis`, `getCostMetrics`, `getSupplierRanking`, `getMaterialCategoryRanking`, `getProcurementTrendChart`, `getSupplierTrendComparison` |
| `RegionAnalysisServiceImpl.java` | `getRegionTargetCompletion`, `getGeographicHeatmapData`, `getRegionOpportunityScores` |

**Files deleted**:
- `dto/smartbi/AnalysisRequest.java` (-211)
- `dto/smartbi/DrillDownResponse.java` (-169)
- `entity/smartbi/SmartBiAnalysisConfig.java` (-125)
- `entity/smartbi/SmartBiQueryTemplate.java` (-52)
- `entity/smartbi/SmartBiShareToken.java` (-58)
- `entity/smartbi/enums/AnalysisConfigType.java` (-35)
- `repository/smartbi/SmartBiAnalysisConfigRepository.java` (-142)
- `repository/smartbi/SmartBiShareTokenRepository.java` (-20)

### Sweeps performed

| # | Sweep target | Result |
|---|---|---|
| 1 | Direct method-name callers in `src/main` (all 19 deleted methods) | Only false-positive name collisions (`PermissionServiceImpl.invalidateCache()` no-arg, `AIQuotaUsage.getRemainingQuota()` entity getter); zero true-positive call sites |
| 2 | Reflection — `getDeclaredMethod`/`Method.invoke`/`MethodHandles`/`ReflectionUtils.invokeMethod` against deleted method names | 12 reflection-using files swept; 0 hits on any deleted method name |
| 3 | SpEL strings — `application*.{properties,yml}` + `@Value` + `#{...}` | 0 hits on deleted method/class names |
| 4 | URL surface — controller @*Mapping paths in `src/main` | No controller layer changes in scope; Sub-A's stub-replacement (410 SMARTBI_MIGRATED) was pre-BASE; FE `_silent: true` tweaks accommodate 410 properly |
| 5 | Spring proxy — `@Async/@Cacheable/@Scheduled/@EventListener/@PostConstruct/@PreDestroy` callers | Only `@PreDestroy shutdownExecutor` survives in `SmartBIServiceImpl` (unrelated to deletes); 0 proxy callers reference deleted methods |
| 6 | AI Tool layer — `ai/tool/impl/**` referencing deleted SmartBI symbols | 0 hits |
| 7 | Cross-package callers — non-smartbi packages (mall, finance, restaurant, etc.) | 0 hits on deleted entities/services/methods |
| 8 | Frontend `web-admin/` + `frontend/CretasFoodTrace/` for deleted endpoint URLs | 0 hits on `comprehensive-analysis`, `turnover-trend`, `loss-reason`, `health-radar`, `supplier-evaluation`, `supplier-detail-metrics`, `purchase-cost-analysis`, `region-target-completion`, `geographic-heatmap`, `region-opportunity-scores` |
| 9 | DTO `AnalysisRequest`/`DrillDownResponse` references | All matches are namespaced different classes (`PythonAnalysisRequest`, `EfficiencyAnalysisRequest`, `MobileDTO.AICostAnalysisRequest`, `AIRequestDTO.*AnalysisRequest`, `ErrorAnalysisRequest`) — false positives |
| 10 | Entity `SmartBiAnalysisConfig`, `SmartBiQueryTemplate`, `SmartBiShareToken`, `AnalysisConfigType` | 0 references in `src/` |
| 11 | Repository `SmartBiAnalysisConfigRepository`, `SmartBiShareTokenRepository` | 0 references in `src/` |
| 12 | DB-table-level — does Python or any FK still reference orphan tables? | `smart_bi_analysis_config` / `smart_bi_share_tokens`: 0 references in Java + Python (true orphan tables, table-level cleanup deferred per Sub-Q audit doc); `smart_bi_query_templates`: actively read+written by Python `analysis.py` and `query_templates_write.py` (table NOT orphan, only Java entity is orphan — Sub-K correctly identified) |
| 13 | Cross-Sub v3 protocol KEEP chain — Sub-L's claim that `getReceivableAgingChart` is KEEP because called from `FinanceAnalysisServiceImpl.getFinanceOverview:159` | Verified `getFinanceOverview` (line 112), call site (line 159), method body (line 545) all alive; KEEP chain intact post Sub-L → Sub-N |
| 14 | Sub-N internal-self-reference KEEP claims (`getFromCache`, `saveToCache`, `recordUsage`, `checkQuota`, `generateAIInsights`, `getDataDateRange`) | 26 internal occurrences across `SmartBIServiceImpl.java` confirm KEEP chain |

---

## Findings

### F-1 (Minor / informational): Schema-orphan tables documented but deferred

**Severity**: Minor (informational — not a regression, audit doc acknowledges)

**Files**:
- `backend/java/cretas-api/src/main/resources/db/migration/V2026_01_18_10__smartbi_schema_metadata.sql:48` (creates `smart_bi_analysis_config`)
- `backend/java/cretas-api/src/main/resources/db/migration-pg/V0002__create_update_triggers.sql:556` (trigger on `smart_bi_analysis_config`)
- `database/create_smart_bi_share_tokens.sql:4` (creates `smart_bi_share_tokens`)
- `docs/qa-audits/2026-05-10-t6-5-phase-c-sub-q-entity-orphan-sweep-audit.md:141, 165` (acknowledges this state)

**Why**: Sub-Q (PR #256) deleted JPA entities `SmartBiAnalysisConfig` and `SmartBiShareToken` plus their repositories, but explicitly **left the underlying DB tables in place**. Post-merge, these tables exist in PG (`smart_bi_analysis_config`, `smart_bi_share_tokens`) with a still-active timestamp trigger on `smart_bi_analysis_config`, and zero Java/Python read/write paths. Any data already stored is now unreachable from application code.

**Sibling sweep**: Confirmed `smart_bi_share_tokens` and `smart_bi_analysis_config` have **zero references** across Java `src/`, Python `backend/python/`, FE `web-admin/`, FE `frontend/CretasFoodTrace/`, and mall-admin. Distinct from `smart_bi_query_templates` which IS still alive (Python owns it now — Sub-K correctly classified).

**Why it's NOT a Critical or Important finding**:
1. It does not break any KEEP path — there's no FK from any other table referencing these orphans (verified by grep — no `REFERENCES smart_bi_analysis_config` or `REFERENCES smart_bi_share_tokens`).
2. The Sub-Q audit document (lines 141 and 165) explicitly calls this out as out-of-scope and defers DB table DROP to a separate migration task, which is the correct conservative posture for production PG.
3. The trigger on a table with no writers is idle — no runtime side effect.

**Suggested follow-up** (post-audit, separate ticket): At a future quarter-boundary maintenance window, file a Flyway migration to `DROP TRIGGER smart_bi_analysis_config_update_timestamp` then `DROP TABLE IF EXISTS smart_bi_analysis_config, smart_bi_share_tokens CASCADE` after a final data export-to-archive step. No urgency.

---

## Specific cross-Sub consistency checks (the prompt's CRITICAL #5/#6)

### Sub-L deleted `getComprehensiveAnalysis` — did Sub-N's KEEP list silently break it?

**Result**: NO regression. Sub-L deleted `getComprehensiveAnalysis` in `SmartBIServiceImpl.java`. Sub-N audited the remaining 14 public methods of the same file and deleted only `invalidateCache(String, String)` and `getRemainingQuota(String)`. The `getFinanceOverview` (in `FinanceAnalysisServiceImpl`, NOT `SmartBIServiceImpl`) referenced by Sub-L's KEEP rationale for `getReceivableAgingChart` is in a different class — Sub-N never touched `FinanceAnalysisServiceImpl`. KEEP chain confirmed intact.

### Verification of Sub-L's `getReceivableAgingChart` KEEP rationale

**Result**: Verified.
- `FinanceAnalysisServiceImpl.java:112` — `getFinanceOverview` method body (alive, KEEP)
- `FinanceAnalysisServiceImpl.java:159` — `chartList.add(getReceivableAgingChart(factoryId, endDate))` (live call site)
- `FinanceAnalysisServiceImpl.java:545` — `getReceivableAgingChart` method body (alive, KEEP)
- `FinanceAnalysisService.java:148` — interface declaration (alive)
- `SmartBIDashboardController.java:538` — also calls `financeAnalysisService.getFinanceOverview` from composite dashboard enrichment (additional KEEP backstop)

### Verification of Sub-N's 6 internal-self-reference KEEPs (`getFromCache`, `saveToCache`, `recordUsage`, `checkQuota`, `generateAIInsights`, `getDataDateRange`)

**Result**: Verified. 26 internal call sites within `SmartBIServiceImpl.java` (raw count `grep -cE`). Sub-N's v3-protocol catch (these would have been wrongly flagged orphan by external-only grep) is well-applied.

---

## Conclusion

**Phase C Java SmartBI dead-code-delete refactor is internally consistent and safe to land as-is.** No silent KEEP-path breakage detected across reflection, Spring proxy, SpEL, URL surface, FK, cross-package, or cross-Sub v3-protocol risk classes.

The single Minor finding (F-1: schema-orphan tables) is acknowledged by the Sub-Q audit doc as deferred-out-of-scope and does not impact runtime behavior.

**No code changes recommended for this audit cycle.** A separate maintenance ticket can pick up the schema-orphan DROP TABLE follow-up at a quarter boundary.

---

## Sweep evidence

```
# All deleted method names — call-site search across src/main
$ grep -rE "getComprehensiveAnalysis|getTurnoverTrendChart|getTurnoverByCategory|getLossReasonChart|getLossTrendChart|getHealthRadarChart|getSupplierEvaluation|getSupplierDetailMetrics|getPurchaseCostAnalysis|getCostMetrics|getSupplierRanking|getMaterialCategoryRanking|getProcurementTrendChart|getSupplierTrendComparison|getRegionTargetCompletion|getGeographicHeatmapData|getRegionOpportunityScores" backend/java/cretas-api/src/main
0 true-positive hits

# All deleted entity/repo/DTO/enum class names
$ grep -rE "SmartBiAnalysisConfig|SmartBiQueryTemplate|SmartBiShareToken|SmartBiAnalysisConfigRepository|SmartBiShareTokenRepository|AnalysisConfigType" backend/java/cretas-api/src
0 hits

# Reflection callers
$ grep -rE 'getDeclaredMethod\("(getComprehensiveAnalysis|...)' backend/java/cretas-api/src/main
0 hits across 12 reflection-using files

# Frontend dependency check
$ grep -rE "comprehensive-analysis|turnover-trend|loss-reason|health-radar|supplier-evaluation|supplier-detail-metrics|purchase-cost-analysis|region-target-completion|geographic-heatmap|region-opportunity-scores" web-admin/ frontend/CretasFoodTrace/
0 hits

# Schema orphan tables — Python / Java / migrations
$ grep -rE "smart_bi_analysis_config|smart_bi_share_token" backend/python backend/java/cretas-api/src/main/java
0 hits in Java code (only DDL in migration .sql files)
0 hits in Python code

# smart_bi_query_templates ALIVE in Python (correctly classified by Sub-K)
$ grep -rE "smart_bi_query_templates" backend/python
6 hits — analysis.py + query_templates_write.py (4 INSERT/UPDATE/DELETE/SELECT)
```

---

**End of report.**
