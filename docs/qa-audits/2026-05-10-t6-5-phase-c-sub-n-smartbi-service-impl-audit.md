# T6.5 Phase C Sub-N — SmartBIServiceImpl Method-Level Audit

**Date**: 2026-05-10
**Branch**: `ops-t6-5-phase-c-sub-n-smartbi-service-impl`
**Worktree base**: `origin/main` HEAD `4c27edefa6` (post Sub-L PR #262 merge)
**Author**: Chat 3 reuse (Sub-N dispatch per Phase C MO PR #227)
**Scope**: Method-level audit of remaining 14 public methods in `SmartBIServiceImpl.java` (+ 13 interface decls in `SmartBIService.java`) post Sub-L `getComprehensiveAnalysis` deletion
**Predecessors**:
- PR #236 (Sub-A: 23 controller methods + repo deleted)
- PR #243-#246, #248, #242 (Sub-B/C/D/E/F/G method-level deletes)
- PR #253 (Sub-T: test orphan sweep — NO-OP)
- PR #260 (Sub-H: InventoryHealthAnalysisServiceImpl 5 dead methods)
- PR #261 (Sub-M: SmartBIDashboardController 10 endpoints all KEEP_FOR_COMPOSITE)
- PR #262 (Sub-L: cross-Sub orphan sweep — `getComprehensiveAnalysis` + 3 Region orphans deleted; `getReceivableAgingChart` reclassified KEEP)

---

## §0 TL;DR

**2 deletions** (after v3 protocol mandatory external + internal-self-reference grep on all 14 methods):

| # | Method | File | LOC | Why |
|---|---|---|---:|---|
| 1 | `SmartBIServiceImpl.invalidateCache(factoryId, analysisType)` + interface decl | `SmartBIServiceImpl.java` + `SmartBIService.java` | 22 + 13 | 0 external callers, 0 internal self-refs |
| 2 | `SmartBIServiceImpl.getRemainingQuota(factoryId)` + interface decl | same | 34 + 7 | 0 external callers, 0 internal self-refs |

**Total**: 2 files changed, **76 deletions**, 0 insertions.

### KEEP classification (v3 mandatory internal-self-reference catches 6 latent KEEPs)

12 of the 14 audited methods stay. Of these, **6 would have been wrongly flagged orphan by external-only grep** (Sub-E lesson: external-only grep misses self-call chains). They are KEEP because alive public entry points self-call them:

| Method | Internal call sites (line, in alive parent) | Parent KEEP rationale |
|---|---|---|
| `getFromCache(fid, key)` | :269, :499, :507 | inside `getExecutiveDashboard` + `getDashboardLLMInsights` |
| `saveToCache(fid, key, data, ttl)` | :298, :408, :520 | inside same alive parents |
| `recordUsage(fid, uid, type, tokens, hit)` | :272, :304, :413, :1014 | inside `getExecutiveDashboard` + `processDrillDown` |
| `checkQuota(fid)` | :575, :1241, :1702 | inside `processQuery` + `generateAIInsights` (now ~line 1685+) |
| `generateAIInsights(fid, dashboard)` | :516 | inside `getDashboardLLMInsights` |
| `getDataDateRange(fid)` | :321, :490 | inside `getExecutiveDashboard` + `getDashboardLLMInsights` |

### Verification

- `mvnw clean compile -DskipTests` → **BUILD SUCCESS**
- `mvnw test -Dtest=FinanceAnalysisServiceImplTest,ForecastServiceImplTest,RecommendationServiceImplTest,SmartBIRestaurantRoutingTest` → **19/19 PASS**
- Post-edit identifier grep (smartbi scope for `invalidateCache` + entire src for `getRemainingQuota`): **0 SmartBI hits** (the 2 remaining `getRemainingQuota` matches are `AIQuotaUsage` entity getter + `AIEnterpriseService:558` consumer of that entity — different class, unrelated)

---

## §1 Audit methodology

### §1.1 Method enumeration

Post Sub-L state of `SmartBIServiceImpl.java` (2126 LOC) has 14 `public` non-constructor methods. The interface `SmartBIService.java` (230 LOC) declares 13 of them (`shutdownExecutor` is `@PreDestroy` lifecycle hook, not in interface).

| # | Method | Line | In interface? |
|---:|---|---:|:---:|
| 1 | `shutdownExecutor()` | 258 | No (`@PreDestroy`) |
| 2 | `getExecutiveDashboard(fid, period)` | 263 | Yes |
| 3 | `getDashboardLLMInsights(fid, period)` | 480 | Yes |
| 4 | `getDashboardLLMInsightsCustomRange(fid, start, end)` | 528 | Yes |
| 5 | `processQuery(fid, uid, request)` | 569 | Yes |
| 6 | `processDrillDown(fid, request)` | 968 | Yes |
| 7 | `invalidateCache(fid, type)` | 1023 | Yes |
| 8 | `getFromCache(fid, key)` | 1044 | Yes |
| 9 | `saveToCache(fid, key, data, ttl)` | 1080 | Yes |
| 10 | `recordUsage(fid, uid, type, tokens, hit)` | 1109 | Yes |
| 11 | `checkQuota(fid)` | 1154 | Yes |
| 12 | `getRemainingQuota(fid)` | 1191 | Yes |
| 13 | `generateAIInsights(fid, dashboard)` | 1227 | Yes |
| 14 | `getDataDateRange(fid)` | 2045 | Yes |

### §1.2 v3 protocol — external + internal-self-reference grep per method

For each method, two grep passes:

**Pass A (external)**: `grep -rn '<method>(' src/` excluding `SmartBIServiceImpl.java` self-file. Filtered out same-name-different-class hits (e.g. `PermissionServiceImpl.invalidateCache()` zero-arg, `LLMFieldMappingServiceImpl.getFromCache(columnName)` one-arg, `AIQuotaUsage.getRemainingQuota()` entity getter, `DialectNormalizationService.recordUsage(dialectExpr)` one-arg).

**Pass B (internal self-references)**: `grep -nE '(^|[^a-zA-Z])<method>\(' SmartBIServiceImpl.java`. Mandatory v3 — catches alive parent self-call chains that external grep misses (Sub-L lesson on `getReceivableAgingChart`).

#### Per-method results

| Method | External callers (filtered) | Internal self-refs | Verdict |
|---|---|---|---|
| `shutdownExecutor` | 0 | 0 | KEEP (`@PreDestroy` lifecycle hook — Spring auto-invokes) |
| `getExecutiveDashboard` | `SmartBIDashboardController:167, :355` | n/a | KEEP (controller — Sub-M PR #261 KEEP_FOR_COMPOSITE_DASHBOARD) |
| `getDashboardLLMInsights` | `SmartBIDashboardController:199` | n/a | KEEP |
| `getDashboardLLMInsightsCustomRange` | `SmartBIDashboardController:225` | n/a | KEEP |
| `processQuery` | `SmartBIAnalysisController:173` | n/a | KEEP |
| `processDrillDown` | `SmartBIAnalysisController:219` | n/a | KEEP |
| **`invalidateCache`** | **0** | **0** | **DELETE** |
| `getFromCache` | 0 | 3 (lines 269/499/507 inside alive parents) | KEEP (internal) |
| `saveToCache` | 0 | 3 (lines 298/408/520) | KEEP (internal) |
| `recordUsage` | 0 | 4 (lines 272/304/413/1014) | KEEP (internal) |
| `checkQuota` | 0 | 3 (lines 575/1241/1702) | KEEP (internal) |
| **`getRemainingQuota`** | **0** | **0** | **DELETE** |
| `generateAIInsights` | 0 | 1 (line 516 inside `getDashboardLLMInsights`) | KEEP (internal) |
| `getDataDateRange` | 0 | 2 (lines 321/490) | KEEP (internal) |

### §1.3 KEEP rationale notes

- **`shutdownExecutor`**: `@PreDestroy` annotated, Spring lifecycle invocation. Removing it leaves `DASHBOARD_EXECUTOR` thread pool to be GC'd without graceful shutdown — defensive lifecycle hook. KEEP.
- **6 cache/quota/usage helpers** (`getFromCache`, `saveToCache`, `recordUsage`, `checkQuota`, `generateAIInsights`, `getDataDateRange`) have zero external callers but multiple alive internal self-call sites. Sub-L's lesson on `getReceivableAgingChart` (PR #262 §1.2) applies identically: internal-self-reference grep is mandatory before classifying as orphan. External-only grep would have wrongly DELETED these 6, breaking `getExecutiveDashboard` / `getDashboardLLMInsights` / `processQuery` / `processDrillDown` chains.

### §1.4 DELETE rationale notes

- **`invalidateCache(factoryId, analysisType)`**: implementation deletes `smart_bi_analysis_cache` rows by analysis type. Interface docstring claims it's invoked "数据上传后清除对应分析类型的缓存 / 配置变更后清除全部缓存" — but the actual upload paths (in `SmartBIIngestionService` / Python ETL) and config-change paths do NOT call it. The cache fills via `saveToCache` and expires via `cache.isExpired()` TTL (read-time). No external invalidation path exists. Truly dead.
- **`getRemainingQuota(factoryId)`**: implementation queries today/month usage and computes remaining. 0 external callers. The unrelated `AIEnterpriseService.java:558 quota.getRemainingQuota()` is calling `AIQuotaUsage` entity's getter (different class, simple field accessor — see `AIQuotaUsage.java:82`). The SmartBI-specific facade method has no live caller.

### §1.5 Section header retention

- `// ==================== 缓存管理 ====================` — KEPT (still describes surviving `getFromCache` + `saveToCache` section)
- `// ==================== 配额检查 ====================` — KEPT (still describes surviving `checkQuota`)
- No section headers were removed by this Sub-N.

### §1.6 Private helper retention (defensive rule from Sub-E §2.7.4)

`invalidateCache` body uses `cacheRepository.findByFactoryIdAndAnalysisType` + `cacheRepository.deleteAll` — those are repo methods, not private helpers, untouched.

`getRemainingQuota` body uses `usageRepository.countTodayUsage` + `usageRepository.sumCostByPeriod` + `billingRepository.findByFactoryId` + `config.isUnlimitedMode` etc. — all repo/entity getter calls, no private helper to clean up.

The constants `DEFAULT_DAILY_QUOTA` + `CACHE_TYPE_*` are used by surviving `checkQuota` / cache code, kept.

---

## §2 Edits

### §2.1 `SmartBIService.java` (interface, -20 LOC)

**Edit 1 (lines 103-113)**: removed `invalidateCache` Javadoc + decl + trailing blank. Section header `// ==================== 缓存管理 ====================` kept (still describes `getFromCache` + `saveToCache`).

```java
// REMOVED
//     /**
//      * 使指定类型的缓存失效
//      * ...
//      * @param factoryId    工厂ID
//      * @param analysisType 分析类型：DASHBOARD, SALES, DEPARTMENT, REGION, FINANCE, ALL
//      */
//     void invalidateCache(String factoryId, String analysisType);
```

**Edit 2 (lines 167-173)**: removed `getRemainingQuota` Javadoc + decl + trailing blank. Section header `// ==================== 配额检查 ====================` kept (still describes `checkQuota`).

```java
// REMOVED
//     /**
//      * 获取剩余配额
//      * ...
//      */
//     int getRemainingQuota(String factoryId);
```

### §2.2 `SmartBIServiceImpl.java` (impl, -56 LOC)

**Edit 3 (lines 1021-1041)**: removed `invalidateCache` `@Override` + `@Transactional` + 18-line method body. Section header `// ==================== 缓存管理 ====================` kept.

**Edit 4 (lines 1189-1223)**: removed `getRemainingQuota` `@Override` + `@Transactional(readOnly = true)` + 32-line method body. Section header `// ==================== 配额检查 ====================` kept.

---

## §3 Verification

### §3.1 mvn compile gate

```
PS> .\mvnw.cmd clean compile -DskipTests
[INFO] BUILD SUCCESS
```

Build passes, confirms no orphan references to deleted symbols.

### §3.2 Targeted SmartBI tests

```
PS> .\mvnw.cmd test -Dtest=SmartBIRestaurantRoutingTest,FinanceAnalysisServiceImplTest,ForecastServiceImplTest,RecommendationServiceImplTest
[INFO] Tests run: 5,  ... FinanceAnalysisServiceImplTest
[INFO] Tests run: 6,  ... ForecastServiceImplTest
[INFO] Tests run: 2,  ... RecommendationServiceImplTest
[INFO] Tests run: 6,  ... SmartBIRestaurantRoutingTest
[INFO] Tests run: 19, Failures: 0, Errors: 0, Skipped: 0
[INFO] BUILD SUCCESS
```

### §3.3 Post-edit residual grep

```
PS> grep -rn 'invalidateCache' src/main/java/com/cretas/aims/service/smartbi/ src/main/java/com/cretas/aims/controller/SmartBI*
(no output — 0 hits in smartbi scope)

PS> grep -rn 'getRemainingQuota' src/
src/main/java/com/cretas/aims/entity/AIQuotaUsage.java:82:    public Integer getRemainingQuota() {
src/main/java/com/cretas/aims/service/AIEnterpriseService.java:558:                .remaining(quota.getRemainingQuota())
```

The 2 remaining `getRemainingQuota` hits are unrelated:
- `AIQuotaUsage.java:82` — entity getter for a different class (`AIQuotaUsage` quota record entity)
- `AIEnterpriseService.java:558` — calls that entity's getter on a `quota` instance

Neither references `SmartBIService.getRemainingQuota` or `SmartBIServiceImpl.getRemainingQuota`. Clean.

### §3.4 Diff stat

```
backend/java/cretas-api/src/main/java/com/cretas/aims/service/smartbi/SmartBIService.java         | -20 LOC
backend/java/cretas-api/src/main/java/com/cretas/aims/service/smartbi/impl/SmartBIServiceImpl.java | -56 LOC

Total: 2 files changed, 76 deletions(-), 0 insertions(+).
```

---

## §4 Notes for downstream Sub-* dispatches

### §4.1 v3 protocol catch — 6 KEEP latents

This Sub-N validates the Sub-L lesson empirically: internal-self-reference grep is **mandatory** before classifying as orphan. External-only grep would have wrongly DELETED 6 cache/quota/usage helpers. The pattern is now stable across:
- Sub-E (PR #248): 2 internal-self-references caught Profit/OverdueRanking
- Sub-L (PR #262): `getReceivableAgingChart` reclassified KEEP
- Sub-N (this audit): 6 helpers reclassified KEEP (`getFromCache`, `saveToCache`, `recordUsage`, `checkQuota`, `generateAIInsights`, `getDataDateRange`)

Future Sub-* dispatches in the SmartBI service layer should treat external-only grep as a NECESSARY-BUT-INSUFFICIENT signal.

### §4.2 No downstream Sub-* triggered

Sub-N deletes do not create new dead-chains:
- `invalidateCache` body called `cacheRepository` methods only — those are repo, alive elsewhere.
- `getRemainingQuota` body called `usageRepository.countTodayUsage` / `sumCostByPeriod` + `billingRepository.findByFactoryId` — all alive elsewhere (e.g. `checkQuota` uses `countTodayUsage`).

No cross-Sub orphan sweep follow-up needed.

### §4.3 No frontend / DB / config impact

Pure Java surface trim. No nginx route changes (these were not exposed via controller — `SmartBIDashboardController` Sub-M audit confirmed all 10 endpoints KEEP and none of those proxy `invalidateCache` / `getRemainingQuota`). No database query changes (cache TTL expiry still works via `getFromCache`'s `cache.isExpired()` check; quota check still works via `checkQuota`). No deploy required at this stage (prod jar update on next routine deploy).

### §4.4 What Sub-N did NOT touch

- 12 KEEP methods retained intact
- All section header comments retained (they still describe surviving methods in their sections)
- All private helpers + constants retained
- `shutdownExecutor()` `@PreDestroy` lifecycle hook retained
- `SmartBIServiceImpl` interface contract reduced from 13 → 11 method signatures

---

## §5 Outstanding items

| Item | Status | Owner |
|---|---|---|
| mvn clean compile | **PASS** | Logged in §3.1 |
| 4 SmartBI tests (19/19) | **PASS** | Logged in §3.2 |
| Residual grep (0 hits in smartbi scope) | **PASS** | Logged in §3.3 |
| safe-commit + push | **HOLDING** (per HARD rule pause-before-deploy-or-push) | Awaiting organizer GO |
| PR creation | **HOLDING** | Awaiting organizer GO |
| Ping organizer with PR # | **PENDING** | This chat → Steve |

---

## §6 References

- PR #150 (T6.5 spec, §C.1.3 worked example)
- PR #178 (Phase A audit v3.1)
- PR #213 (Phase B 23-endpoint stub)
- PR #227 (Phase C MO draft — dispatch source)
- PR #236 (Sub-A controller body delete)
- PR #243 / #244 / #245 / #246 / #248 / #242 (Sub-B through Sub-G method-level deletes)
- PR #260 (Sub-H InventoryHealth)
- PR #261 (Sub-M Dashboard controller — all KEEP_FOR_COMPOSITE)
- PR #262 (Sub-L cross-Sub orphan sweep — established v3 internal-self-reference rule)
- `.claude/rules/concurrent-edit-safety.md` Rule 5b (paths-only commit)
- `feedback_pause_before_deploy_or_push.md` (HOLD before push)

---

🤖 Generated with [Claude Code](https://claude.com/claude-code)
