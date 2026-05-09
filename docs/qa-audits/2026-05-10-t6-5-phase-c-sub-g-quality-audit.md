# T6.5 Phase C Sub-G — `QualityAnalysisServiceImpl` Method-Level Audit

**Date**: 2026-05-10
**Author**: Chat 8 (organizer dispatch — Sub-G reuse after Sub-G template)
**Branch**: `ops-t6-5-phase-c-sub-g-quality`
**Worktree base**: `origin/main` HEAD = `99772213aa` (post Sub-A merge `c8d509b8d1`, post Phase B PR #213 stub-out, post `aeec4f93e8` Phase B audit)
**Scope**: `backend/java/cretas-api/src/main/java/com/cretas/aims/service/smartbi/impl/QualityAnalysisServiceImpl.java` (1201 LOC)
**Per Phase C MO**: `docs/superpowers/dispatch/2026-05-15-t6-5-phase-c-method-level-audit-marching-order.md` §1 + §2.3 + §2.4

⚠️ **NOT_SAFE_FALLTHROUGH context**: `/analysis/quality` (POST `SmartBIAnalysisController.getQualityAnalysis`) was NOT stubbed in Phase B PR #213 — it remains an alive Java endpoint serving all 75 factories. Per Steve's MO note: "多数 method 应该 KEEP."

---

## 0. TL;DR

| Outcome | Count | Detail |
|---|---|---|
| Public methods enumerated | **10** | `getQualitySummary` + 9 supporting methods |
| KEEP (alive callers) | **7** | All called by alive endpoints (`/analysis/quality` `getQualityAnalysis` + `/query` NL helper + composite Dashboard) |
| DELETE candidates | **3** | `getQualityByProductLine`, `getProductLineQualityRanking`, `getProductLineQualityComparisonChart` — 0 controller / 0 external main-source callers |
| Private helpers exclusive to dead methods | **0** | Both `calculateProductLineQualityRankingFromData` + `buildProductLineQualityComparisonFromData` are SHARED with KEEP path `getQualitySummary` (lines 97/102) — must stay |
| Test methods to delete | **0** | `find backend/java/cretas-api/src/test -name "QualityAnalysis*Test.java"` returns empty — no test file exists |
| Interface declarations to delete | **3** | `QualityAnalysisService.java` lines 244 / 257 / 269 (the 3 dead method signatures) |

**Estimated source-delete diff**: ~80 LOC removed (3 `@Override @Transactional public ...` methods × ~20 LOC each in impl + 3 interface decls + javadoc).

**Per spec §C.1.3 pattern**: this is a "tiny removable surface" Sub-G as the umbrella MO predicted (~0.5d effort).

---

## 1. Method Inventory + Caller Classification

Per MO §2.3 protocol — `grep -nE "^\s*(public|@Override\s+public)"` against impl file, then per-method caller grep across all controllers + main source (excluding interface + impl self).

### 1.1 KEEP (7 methods, ≥1 alive caller each)

| # | Method | Impl line | Total external callers | Caller sites |
|---|---|---|---|---|
| 1 | `getQualitySummary(String, LocalDate, LocalDate) → DashboardResponse` | 77 | **3** | `SmartBIAnalysisController:144` (alive `getQualityAnalysis` overview path) + `SmartBIAnalysisController:390` (alive `/query` NL `generateQualityQueryResponse` private helper) + `SmartBIDashboardController:550` (composite `setQuality`, KEEP_FOR_COMPOSITE_DASHBOARD per spec §C.1.2) |
| 2 | `getDefectAnalysis(...) → List<MetricResult>` | 128 | **1** | `SmartBIAnalysisController:135` (alive `getQualityAnalysis` `analysisType="fpy"` branch) |
| 3 | `getDefectTypeRanking(...) → List<RankingItem>` | 195 | **1** | `SmartBIAnalysisController:138` (alive `analysisType="defect"` branch) |
| 4 | `getDefectParetoChart(...) → ChartConfig` | 204 | **1** | `SmartBIAnalysisController:139` (alive `analysisType="defect"` branch) |
| 5 | `getReworkCost(...) → List<MetricResult>` | 215 | **1** | `SmartBIAnalysisController:141` (alive `analysisType="rework"` branch) |
| 6 | `getQualityCostDistributionChart(...) → ChartConfig` | 311 | **1** | `SmartBIAnalysisController:142` (alive `analysisType="rework"` branch) |
| 7 | `getQualityTrendChart(String, LocalDate, LocalDate, String) → ChartConfig` | 322 | **1** | `SmartBIAnalysisController:136` (alive `analysisType="fpy"` branch, hard-coded period `"DAY"`) |

### 1.2 DELETE (3 methods, 0 external callers)

| # | Method | Impl line | Total external callers | Notes |
|---|---|---|---|---|
| 8 | `getQualityByProductLine(...) → List<MetricResult>` | 334 | **0** | Only interface decl ref at `QualityAnalysisService.java:244`; no controller / no internal-impl / no test caller |
| 9 | `getProductLineQualityRanking(...) → List<RankingItem>` | 381 | **0** | Only interface decl ref at `QualityAnalysisService.java:257`; thin wrapper around `calculateProductLineQualityRankingFromData(qualityData)` private helper which is ALSO called by KEEP path `getQualitySummary:102` — so the helper stays |
| 10 | `getProductLineQualityComparisonChart(...) → ChartConfig` | 390 | **0** | Only interface decl ref at `QualityAnalysisService.java:269`; thin wrapper around `buildProductLineQualityComparisonFromData(qualityData)` private helper which is ALSO called by KEEP path `getQualitySummary:97` — so the helper stays |

### 1.3 Verification grep commands (reproducible)

```bash
WT=.worktrees/t6-5-phase-c-sub-g-quality

# 1. Public method enumeration
grep -nE "^\s*(public|@Override\s+public)" \
    $WT/backend/java/cretas-api/src/main/java/com/cretas/aims/service/smartbi/impl/QualityAnalysisServiceImpl.java

# 2. Per-method external caller grep (excludes interface decl + impl self)
for m in getQualitySummary getDefectAnalysis getDefectTypeRanking getDefectParetoChart \
         getReworkCost getQualityCostDistributionChart getQualityTrendChart \
         getQualityByProductLine getProductLineQualityRanking getProductLineQualityComparisonChart; do
  hits=$(grep -rnE "\.${m}\(" $WT/backend/java/cretas-api/src/main/java/ \
         | grep -v "QualityAnalysisServiceImpl.java:" \
         | grep -v "QualityAnalysisService.java:")
  echo "$m: $(echo "$hits" | grep -c .) external caller(s)"
done

# 3. Test file presence (returns empty — no test file exists)
find $WT/backend/java/cretas-api/src/test -name "QualityAnalysis*Test.java"
```

Expected output verbatim: 7 methods report `1+ external caller(s)`, 3 methods report `0 external caller(s)`, find returns no path.

---

## 2. Private Helper Chase-Down

Per MO §2.5: "Delete each method classified 'removable', plus its private helpers (chase down `private` methods called only by the now-deleted public method — grep within same file)."

### 2.1 Helpers used by 3 dead methods

The 3 dead method bodies call:

```java
// Line 337 (in getQualityByProductLine):
List<Map<String, Object>> qualityData = generateMockQualityData(factoryId, startDate, endDate);

// Line 384-385 (in getProductLineQualityRanking):
List<Map<String, Object>> qualityData = generateMockQualityData(factoryId, startDate, endDate);
return calculateProductLineQualityRankingFromData(qualityData);

// Line 393-394 (in getProductLineQualityComparisonChart):
List<Map<String, Object>> qualityData = generateMockQualityData(factoryId, startDate, endDate);
return buildProductLineQualityComparisonFromData(qualityData);
```

3 private helpers referenced. Caller-count check within file:

| Helper | Line | Total refs in file | KEEP path callers (other than dead methods) |
|---|---|---|---|
| `generateMockQualityData` | 403 | **11** (1 decl + 10 callers) | All 7 KEEP public methods + 3 dead methods + private chain | 
| `calculateProductLineQualityRankingFromData` | 670 | **4** (1 decl + 3 callers) | `getQualitySummary:102` (KEEP) + `generateQualitySuggestions:1053` (private chain from KEEP) + `getProductLineQualityRanking:385` (dead) |
| `buildProductLineQualityComparisonFromData` | 869 | **3** (1 decl + 2 callers) | `getQualitySummary:97` (KEEP) + `getProductLineQualityComparisonChart:394` (dead) |

**All 3 helpers MUST STAY** — each is called by at least one KEEP path. Removing them would break compile in `getQualitySummary` and downstream.

### 2.2 Result: zero helper deletions in this Sub-G

Source-side removal scope is limited to:
- **3 public method bodies** in `QualityAnalysisServiceImpl.java` (lines 334-377, 381-386, 390-395) including `@Override` + `@Transactional(readOnly = true)` + javadoc/comment block above each
- **3 interface declarations** in `QualityAnalysisService.java` (lines 244, 257, 269) including their javadoc
- **0 private helpers**
- **0 test methods** (no test file exists for this Impl)
- **0 imports** (Impl uses many shared imports; `Collections.emptyList()` in line 340 is dead-method-only but `Collections` is also used elsewhere — no import becomes unused)

---

## 3. Pre-flight Build Gate Status

Per MO §2.2 — **NOT YET RUN** in this audit-only commit (audit doc commit is documentation-only, not source edit).

**Required BEFORE source-delete commit** (Step 2.5 of MO):

```bash
cd backend/java/cretas-api
mvn clean compile -DskipTests          # MUST pass — pre-edit baseline
mvn clean test -DskipTests=false       # MUST pass — record green test count
```

Steve / next-step chat must run + record baseline test count + log it in source-delete PR description.

---

## 4. Proposed Source-Delete Plan (FOR ORGANIZER GO ONLY — DO NOT EXECUTE FROM THIS PR)

Per MO §2.4 ⛔ STOP-and-ping — this audit-only PR is the gate; source delete happens in a separate commit on this same branch AFTER organizer GO.

### 4.1 Files modified

```
backend/java/cretas-api/src/main/java/com/cretas/aims/service/smartbi/QualityAnalysisService.java
backend/java/cretas-api/src/main/java/com/cretas/aims/service/smartbi/impl/QualityAnalysisServiceImpl.java
```

### 4.2 Diff shape (~80 LOC removed)

**Interface (`QualityAnalysisService.java`)** — remove 3 method declarations + their javadoc:
- Lines around 240-247 (`getQualityByProductLine` decl + javadoc)
- Lines around 253-260 (`getProductLineQualityRanking` decl + javadoc)
- Lines around 265-272 (`getProductLineQualityComparisonChart` decl + javadoc)

**Impl (`QualityAnalysisServiceImpl.java`)** — remove 3 public method bodies + `@Override @Transactional` annotations + section comment:
- Line 330 section comment `// ==================== 产线质量分析 ====================` (KEEP — section delimiter useful for any future re-introduction; or remove if 100% empty after deletes — at organizer discretion)
- Lines 332-377 (`getQualityByProductLine` full body, ~46 LOC)
- Lines 379-386 (`getProductLineQualityRanking` full body, ~8 LOC)
- Lines 388-395 (`getProductLineQualityComparisonChart` full body, ~8 LOC)

KEEP all private helpers (`generateMockQualityData`, `calculateProductLineQualityRankingFromData`, `buildProductLineQualityComparisonFromData`) — shared with KEEP path `getQualitySummary`.

### 4.3 Post-edit verification gate (MO §2.6)

```bash
# Compile
cd backend/java/cretas-api && mvn clean compile -DskipTests   # MUST pass

# Tests
mvn clean test -DskipTests=false                              # MUST pass; count unchanged (no test file deleted)

# Package
mvn clean package -DskipTests                                 # MUST produce aims-0.0.1-SNAPSHOT.jar

# Method-level orphan grep — sanity re-verify post-removal
for m in getQualityByProductLine getProductLineQualityRanking getProductLineQualityComparisonChart; do
  hits=$(grep -rnE "\.${m}\(|\b${m}\(" backend/java/cretas-api/src/main/java/ | wc -l)
  [ "$hits" -eq 0 ] || { echo "FAIL: $m still has $hits caller(s)"; exit 1; }
done
```

### 4.4 Safe-commit pattern (MO §2.7 + concurrent-edit-safety Rule 5b)

```bash
./scripts/safe-commit.sh "feat(t6-5-phase-c-sub-g): QualityAnalysisServiceImpl 3 dead method delete (interface + impl)" \
    backend/java/cretas-api/src/main/java/com/cretas/aims/service/smartbi/QualityAnalysisService.java \
    backend/java/cretas-api/src/main/java/com/cretas/aims/service/smartbi/impl/QualityAnalysisServiceImpl.java
```

---

## 5. ⛔ STOP-and-Ping Gate (MO §2.4)

This audit-only commit is the FIRST commit on branch `ops-t6-5-phase-c-sub-g-quality`. Per Phase C MO §2.4:

> After Sub-B-I audit doc is committed — **STOP**. Do NOT delete any methods yet. Push the audit-only commit, open a draft PR with title `audit(t6-5-phase-c-sub-<X>): <ServiceImpl> method-level inventory`, and ping organizer in the dispatch thread. Wait for explicit GO before proceeding to Step 2.5.

Steve's MO PR title `feat(t6-5-phase-c-sub-g): QualityAnalysisServiceImpl dead method delete (Sub-G)` implies bundled audit + delete in one PR. **Following template literally** — opening this PR as `audit(...)` first per §2.4, awaiting GO before commit-2 source-delete. Steve can confirm preference (single bundled vs split commits).

---

## 6. Open Questions for Organizer

1. **PR style**: per MO template §2.4, audit-only PR + ping-and-wait. Per Steve's terse MO this round, single bundled `feat(...)` PR. Which? (Recommend: split — keeps audit reviewable independent of source delete; aligns with Sub-A precedent if applicable.)
2. **Section comment** at line 330 (`// ==================== 产线质量分析 ====================`) — keep as a delimiter for any future re-introduction, or remove entirely since the entire section becomes empty? (Recommend: remove for cleanliness; can recreate if needed.)
3. **Pre-flight build gate** — run before source-delete commit per MO §2.2. Should I run it from this audit PR, or defer to post-GO source-delete PR? (Recommend: defer — audit PR doesn't touch Java; source-delete PR will run + log baseline.)
4. **Sub-D / Sub-F precedent** — has Production (Sub-F) shipped yet? Quality (Sub-G) is parallel pattern (both NOT_SAFE_FALLTHROUGH, mostly KEEP). Should defer to Production's PR shape if already merged.

---

## Cross-References

- **Phase C umbrella MO**: `docs/superpowers/dispatch/2026-05-15-t6-5-phase-c-method-level-audit-marching-order.md` §1 + §2.3 + §2.4 + §2.5 + §2.6 + §2.7 + §2.8
- **PR #178 audit v3.1** §3.1.a: `/analysis/quality` classified `NOT_SAFE_FALLTHROUGH` — Java alive for all 75 factories
- **PR #205** (`be5959c504`): Phase B 23-endpoint stub-out (excludes `/analysis/quality`)
- **PR #213**: Phase B prod cutover live + chat4 active E2E 12/12 PASS
- **PR #236** (`c8d509b8d1`): Sub-A controller method-body delete (445 LOC controller post-Sub-A)
- **Spec**: `docs/superpowers/specs/2026-05-15-t6-5-java-smartbi-deprecation-spec.md` §C.1.1 + §C.1.2 + §C.1.3 (FinanceAnalysisServiceImpl worked example)
- **Java**:
  - `backend/java/cretas-api/src/main/java/com/cretas/aims/service/smartbi/impl/QualityAnalysisServiceImpl.java` (1201 LOC, this Sub-G scope)
  - `backend/java/cretas-api/src/main/java/com/cretas/aims/service/smartbi/QualityAnalysisService.java` (interface, 3 decls to remove)
  - `backend/java/cretas-api/src/main/java/com/cretas/aims/controller/SmartBIAnalysisController.java:135-144,390` (alive `getQualityAnalysis` + `generateQualityQueryResponse` callers)
  - `backend/java/cretas-api/src/main/java/com/cretas/aims/controller/SmartBIDashboardController.java:550` (composite `setQuality` caller)
- **Rules**:
  - `concurrent-edit-safety.md` Rule 5b — safe-commit `--only` paths-only mode for source-delete commit
  - `feedback_pause_before_deploy_or_push.md` — STOP-and-ping organizer before push (this PR)
  - `feedback_marching_order_method_name_grep.md` — every method name in this audit grep-verified against actual source (no paraphrased names)
  - `feedback_audit_endpoint_impl_not_router.md` — caller classification verified across controller + main + test (not just one file)

