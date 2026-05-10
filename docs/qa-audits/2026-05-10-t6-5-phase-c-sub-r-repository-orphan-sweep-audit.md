# T6.5 Phase C Sub-R — SmartBI Repository Layer Orphan Sweep (audit-only)

**Date**: 2026-05-10
**Branch**: `ops-t6-5-phase-c-sub-r-repository-orphan-sweep`
**Scope**: `backend/java/cretas-api/src/main/java/com/cretas/aims/repository/smartbi/`
**Trigger**: Phase C Round 1-2 deleted ~50+ Service methods across 8 sub-tasks (Sub-A..Sub-G shipped). Some `repository/smartbi/*Repository` interfaces are now `@Autowired`-orphaned. Single PR sweep.
**Method**: v3 audit protocol (external grep + consumer alive check + custom-method caller check + internal self-reference grep).

---

## §1.1 Status — superseded by Sub-Q (PR #256, merged before push)

⚠️ **Sub-R was originally scoped to delete 5 files** (2 Repository + 2 Entity + 1 Enum, −380 LOC). During rebase onto `origin/main` (post-Sub-Q merge), all 5 deletions resolved as no-ops because **Sub-Q PR #256 (`cf978da404`) already deleted the same 5 files** (plus 2 additional DTOs `AnalysisRequest.java` + `DrillDownResponse.java`).

This PR therefore ships as **audit-only documentation** — it independently confirms:
1. The 2 DELETE candidates Sub-Q removed are correct (re-verified by Sub-R).
2. The remaining **24 repositories** (22 top-level minus 2 deleted, + 4 in `postgres/`) are all live and must be retained.

No code change. Audit doc preserved for future Phase C reviewers.

---

## Summary

| Verdict | Count |
|---|---|
| KEEP | 24 |
| DELETE (already shipped via Sub-Q PR #256) | 2 |
| **Total audited** | **26** |

`mvn compile -DskipTests` (run before rebase, when 5 deletions were still local) → **BUILD SUCCESS** (2302 sources).

---

## Verdict Table

Files audited under `repository/smartbi/` (22 top-level + 4 in `postgres/` subdir).

| # | Repository | Verdict | External callers (top 2) | Notes |
|---|-----------|---------|-------------------------|-------|
| 1 | AiAgentRuleRepository | KEEP | AiAgentRuleController, SopAgentOrchestratorImpl | AI orchestration |
| 2 | AiIntentConfigRepository | KEEP | ConfidenceCalibrationServiceImpl, SmartBIConfigServiceImpl | Core AI intent system |
| 3 | SkuComplexityRepository | KEEP | SkuUpdateComplexityTool | AI tool consumer |
| 4 | SmartBiAlertThresholdRepository | KEEP | AlertThresholdServiceImpl | Active SmartBI config |
| 5 | SmartBiAnalysisCacheRepository | KEEP | SmartBIServiceImpl, SmartBIUploadFlowServiceImpl | Analysis cache pipeline |
| 6 | **SmartBiAnalysisConfigRepository** | **DELETE** (merged into Sub-Q PR #256) | (none) | 10 custom @Query methods, 0 callers |
| 7 | SmartBiBillingConfigRepository | KEEP | SmartBIServiceImpl | Billing quota |
| 8 | SmartBiChartTemplateRepository | KEEP | ChartTemplateServiceImpl, SmartBIConfigServiceImpl | Chart template service |
| 9 | SmartBiDatasourceRepository | KEEP | DataSourceRegistryService, SmartBiSchemaServiceImpl | Datasource registry |
| 10 | SmartBiDepartmentDataRepository | KEEP | DepartmentAnalysisServiceImpl, RecommendationServiceImpl | Core analytics |
| 11 | SmartBiDictionaryRepository | KEEP | DictionaryAddTool, FieldMappingDictionary, SmartBIConfigServiceImpl | Heavily used |
| 12 | SmartBiExcelUploadRepository | KEEP | ExcelDataPersistenceServiceImpl, SmartBIUploadController | Upload pipeline |
| 13 | SmartBiFieldDefinitionRepository | KEEP | SmartBiSchemaServiceImpl | Schema service |
| 14 | SmartBiFinanceDataRepository | KEEP | ExcelDataPersistenceServiceImpl, FinanceAnalysisServiceImpl | Finance pipeline |
| 15 | SmartBiIncentiveRuleRepository | KEEP | IncentiveRuleServiceImpl, SmartBIConfigServiceImpl | Incentive rules |
| 16 | SmartBiMetricFormulaRepository | KEEP | MetricFormulaServiceImpl, SmartBIConfigServiceImpl | Metric formulas |
| 17 | SmartBiQueryHistoryRepository | KEEP | SmartBIServiceImpl | Query audit |
| 18 | SmartBiSalesDataRepository | KEEP | SalesAnalysisServiceImpl, DepartmentAnalysisServiceImpl (7+ callers) | Heavily used |
| 19 | SmartBiSchemaHistoryRepository | KEEP | SmartBiSchemaServiceImpl | Schema version tracking |
| 20 | **SmartBiShareTokenRepository** | **DELETE** (merged into Sub-Q PR #256) | (none) | Never `@Autowired` anywhere |
| 21 | SmartBiSkillRepository | KEEP | SkillManagementController, SkillRegistryImpl | Skill management |
| 22 | SmartBiUsageRecordRepository | KEEP | SmartBIServiceImpl | Usage tracking |
| **postgres/** | | | | |
| 23 | SmartBiDynamicDataRepository | KEEP | DynamicAnalysisServiceImpl, ProductionReportSyncServiceImpl | Dynamic data |
| 24 | SmartBiPgAnalysisResultRepository | KEEP | SmartBIDashboardController | Dashboard results |
| 25 | SmartBiPgExcelUploadRepository | KEEP | SmartBIUploadController, DynamicDataPersistenceServiceImpl | PG Excel upload |
| 26 | SmartBiPgFieldDefinitionRepository | KEEP | ProductionReportSyncServiceImpl, DynamicAnalysisServiceImpl | Field definition sync |

---

## Verification — DELETE Candidates

Per v3 protocol, both candidates verified by main session (not just subagent):

### #6 SmartBiAnalysisConfigRepository

```
$ grep -rn "SmartBiAnalysisConfigRepository" backend/
SmartBiAnalysisConfigRepository.java:24:public interface SmartBiAnalysisConfigRepository extends JpaRepository<SmartBiAnalysisConfig, Long> {
```

Self-reference only (interface declaration). No `@Autowired`, no `@Inject`, no constructor inject anywhere in 2302-source tree.

Custom methods (10): `findByDatasourceIdAndIsActiveTrueOrderByDisplayOrderAsc`, `findByDatasourceIdOrderByDisplayOrderAsc`, `findByDatasourceIdAndConfigTypeAndIsActiveTrue`, `findByDatasourceIdAndConfigTypeAndConfigName`, `findKpiConfigs`, `findChartConfigs`, `findRankingConfigs`, `findInsightConfigs`, `findByDatasourceIdAndKey`, `bulkActivateByConfigType`. All 10 have **0 callers** outside the repo.

**Entity also orphan**: `SmartBiAnalysisConfig.java` referenced only by the repo + itself. Deleted.
**Enum also orphan**: `AnalysisConfigType.java` referenced only by the deleted Entity + Repo. Deleted.

### #20 SmartBiShareTokenRepository

```
$ grep -rn "SmartBiShareTokenRepository" backend/
SmartBiShareTokenRepository.java:13:public interface SmartBiShareTokenRepository extends JpaRepository<SmartBiShareToken, Long> {
```

Self-reference only. Never injected. Custom methods (`findByToken`, expiry-cleanup `@Modifying @Query`) have 0 callers.

**Entity also orphan**: `SmartBiShareToken.java` referenced only by deleted repo + itself. Deleted.

---

## Files Deleted (now upstream — see Sub-Q PR #256)

Originally Sub-R staged these 5 deletions; rebase onto `origin/main` resolved them as no-ops because Sub-Q already shipped them:

```
D backend/java/cretas-api/src/main/java/com/cretas/aims/repository/smartbi/SmartBiAnalysisConfigRepository.java   (-142)  ← Sub-Q
D backend/java/cretas-api/src/main/java/com/cretas/aims/entity/smartbi/SmartBiAnalysisConfig.java                 (-125)  ← Sub-Q
D backend/java/cretas-api/src/main/java/com/cretas/aims/entity/smartbi/enums/AnalysisConfigType.java              (-35)   ← Sub-Q
D backend/java/cretas-api/src/main/java/com/cretas/aims/repository/smartbi/SmartBiShareTokenRepository.java       (-20)   ← Sub-Q
D backend/java/cretas-api/src/main/java/com/cretas/aims/entity/smartbi/SmartBiShareToken.java                     (-58)   ← Sub-Q
```

Sub-Q (PR #256) additionally removed 2 DTOs (`AnalysisRequest.java`, `DrillDownResponse.java`) outside Sub-R's scope.

DB migrations creating the underlying tables are **retained** (history preservation; orphan tables are harmless DDL). If desired, a follow-up migration may `DROP TABLE` after schema review.

---

## Compile

```
$ ./mvnw compile -DskipTests
[INFO] Compiling 2302 source files with javac [debug release 21] to target/classes
[INFO] BUILD SUCCESS
[INFO] Total time:  01:27 min
```

Warnings are pre-existing (`ProductSampleTrackingRecord.java` field, `PythonSmartBIClient.java` deprecation, `SmartBIServiceImpl.java` unchecked) — not caused by this sweep.

---

## Sub-I (Procurement) Scope Overlap Check

Sub-I (procurement chat) was in flight at audit start. None of the 26 repos audited are procurement-specific (`Purchase*Repository`, `ProcurementBudget*Repository` etc. live elsewhere). No scope conflict.

---

## Out of Scope

- `repository/` non-smartbi subdirs (CRM, finance, hr, material, etc.) — covered by sister sub-tasks if applicable.
- DAO layer — `dao/smartbi/` does not exist; no audit needed.
- `service/smartbi/skill/` orphan service classes — covered by Sub-K (skill orchestration sweep) per overall MO.
