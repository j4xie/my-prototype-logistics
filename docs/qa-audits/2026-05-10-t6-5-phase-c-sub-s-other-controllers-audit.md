# T6.5 Phase C Sub-S — Other SmartBI Controllers Method-Level Audit

**Phase**: T6.5 Phase C Sub-S (Round 3 supplement to PR #227 8-chat parallel MO)
**Status**: **AUDIT-ONLY NO-OP** — premise drift caught, 0 source changes recommended
**Author**: Sub-S audit chat
**Date**: 2026-05-10
**Predecessor**: PR #227 (Phase C MO master), PR #178 (Phase A audit v3.1), PR #261 (Sub-M precedent), PR #205 (Phase B execute)
**Successor**: None — Phase C Sub-S closes the Java SmartBI controller surface for T6.5

---

## 0. TL;DR

> **Premise drift caught — 2nd occurrence in Phase C** (after Sub-M PR #261).
>
> Round 3 marching order named four non-existent controllers — `SmartBIChartController`, `SmartBIExcelController`, `SmartBIYoYController`, `SmartBICrossSheetController`. Those names map to **Python module files** (`backend/python/smartbi/api/chart.py`, `excel.py`, `yoy.py`, `cross_sheet.py`) per `.claude/rules/python-services-architecture.md`, **not** to Java controller files.
>
> Actual remaining Java SmartBI controllers (post Sub-A #236 Analysis cleanup + post Sub-M #261 Dashboard audit + post PR #222 PublicDemo sunset) are exactly two:
>
> - `SmartBIConfigController.java` — 41 endpoints under `/api/mobile/smartbi-config/*`
> - `SmartBIUploadController.java` — 13 endpoints under `/api/mobile/{factoryId}/smart-bi/*` (upload paths)
>
> **Both are explicitly HARD KEEP per PR #178 audit §1.2 OUT-OF-SCOPE list.** No nginx-routing to Python exists for either controller's paths. No Python `@router` equivalents exist for any of the 54 endpoints. Frontend (web-admin Vue + RN) actively calls every meaningful endpoint group. PR #201 (Phase 2C Tier 3) is **spec only, no code**, with "T6.5 Phase C complete" listed as Hard Prerequisite #1 — meaning Phase C is **upstream** of any Upload migration, never downstream.
>
> **Conclusion**: 54 of 54 endpoints → **KEEP**. 0 STUB-410. 0 DELETE-METHOD. 0 DELETE-CLASS. Audit-only no-op PR (mirrors Sub-M #261 outcome).

---

## 1. Background

### 1.1 Round 3 marching order text (verbatim trigger)

> chat5 reuse: Round 3 Sub-S — 其他 SmartBI controller method audit (⏳ QUEUED)
>
> 派工 — chat5 reuse: Round 3 Sub-S SmartBI 非 Dashboard / 非 Analysis controllers method audit + stub-or-delete
> SmartBIDashboardController (chat2 Sub-M) + SmartBIAnalysisController (Sub-A 已 处理) 之外, 还有
> **SmartBIChartController / SmartBIExcelController / SmartBIYoYController / SmartBICrossSheetController etc**。都 method-level audit + stub-or-delete。

### 1.2 Predecessor T6.5 state at Sub-S kickoff

- Phase A audit v3.1 (PR #178) **MERGED** — defines OUT-OF-SCOPE HARD KEEP list (§1.2)
- Phase B 23-endpoint stub (PR #205) **MERGED** — touched only `SmartBIAnalysisController` (22 methods) + `SmartBIDashboardController.getDataDateRange` (1 method)
- Phase C Sub-A (PR #236) **MERGED** — deleted 23 stubbed method declarations on `SmartBIAnalysisController` + `SmartBiQueryTemplateRepository` + dead deps
- Phase C Sub-B/C/D/E/F/G (PRs #243/#244/#245/#248/#246/#242) **MERGED** — `*AnalysisServiceImpl` method-level deletes
- Phase C Sub-H (PR #260) **MERGED** — `InventoryHealthAnalysisServiceImpl` 5 methods
- Phase C Sub-K (PR #259) **MERGED** — `SmartBiQueryTemplate` entity orphan delete
- Phase C Sub-L (PR #262) **MERGED** — cross-Sub orphan sweep, 4 dead-chain methods
- Phase C Sub-M (PR #261) **MERGED** — `SmartBIDashboardController` 10 endpoints all KEEP_FOR_COMPOSITE_DASHBOARD (audit-only no-op, **premise drift precedent**)
- Phase 2C Tier 4 (PR #222) **MERGED** — `SmartBIPublicDemoController` sunset (controller file deleted)

origin/main HEAD: `4c27edefa6` (Sub-L #262)

### 1.3 Marching order premise vs ground truth

| MO premise | Ground truth |
|---|---|
| `SmartBIChartController` exists in Java | **No file** at `backend/java/cretas-api/src/main/java/com/cretas/aims/controller/SmartBIChart*.java`. The name maps to `backend/python/smartbi/api/chart.py` Python module. |
| `SmartBIExcelController` exists in Java | **No file**. Maps to `backend/python/smartbi/api/excel.py`. |
| `SmartBIYoYController` exists in Java | **No file**. Maps to `backend/python/smartbi/api/yoy.py`. |
| `SmartBICrossSheetController` exists in Java | **No file**. Maps to `backend/python/smartbi/api/cross_sheet.py`. |
| "其他 SmartBI controller" (residual scope after Analysis + Dashboard) = Chart/Excel/YoY/CrossSheet | **Actual residual** = `SmartBIConfigController` + `SmartBIUploadController` only. |

This is the same root pattern as Sub-M premise drift (PR #261): the marching order was framed against an idealized model rather than the actual repo state.

---

## 2. Methodology

### 2.1 Java SmartBI controller inventory (verified)

```bash
ls .worktrees/t6-5-phase-c-sub-s-other-controllers/backend/java/cretas-api/src/main/java/com/cretas/aims/controller/SmartBI*.java
```

Result: 4 files exist on origin/main `4c27edefa6`:

| File | LOC | T6.5 status |
|---|---:|---|
| `SmartBIAnalysisController.java` | (post-Sub-A) | **OUT** — Sub-A #236 done |
| `SmartBIDashboardController.java` | (unchanged) | **OUT** — Sub-M #261 audit-only no-op |
| `SmartBIConfigController.java` | **834** | **IN — Sub-S audit target #1** |
| `SmartBIUploadController.java` | **656** | **IN — Sub-S audit target #2** |

### 2.2 Per-endpoint classification axes (4-axis matrix per Sub-M precedent)

For each endpoint:
1. **nginx-routed to Python?** — check 139 nginx regex per PR #184 cross-check
2. **Python `@router` equivalent exists?** — grep `backend/python/smartbi_compat/` + `backend/python/smartbi/`
3. **Active production frontend caller?** — grep `frontend/CretasFoodTrace/` + `web-admin/src/`
4. **Phase A audit §1.2 verdict?** — out-of-scope HARD KEEP list

Methodology mirrors PR #261 §"Why all 10 stay KEEP".

### 2.3 v3 protocol — external + internal grep

Per Sub-E lesson (commit `571a0b4ddf`, mvn FAIL caught 2 internal self-references): every classification must verify **both** external grep (controllers / other modules) **and** internal grep (within the same controller file, helper / private callers). Sub-S applies this protocol.

---

## 3. SmartBIConfigController — 41 endpoints

### 3.1 Endpoint inventory

Path prefix: `/api/mobile/smartbi-config/*`
File: `backend/java/cretas-api/src/main/java/com/cretas/aims/controller/SmartBIConfigController.java`
Total: 41 `@(Get|Post|Put|Delete|Patch)Mapping` declarations (verified `grep -cE '@(Get|Post|Put|Delete|Patch)Mapping'`).

| Group | Endpoints | Method names |
|---|---:|---|
| **intents** | 5 | listIntents, createIntent, updateIntent, deleteIntent, reloadIntents |
| **thresholds** | 5 | listThresholds, createThreshold, updateThreshold, deleteThreshold, reloadThresholds |
| **incentive-rules** | 5 | listIncentiveRules, createIncentiveRule, updateIncentiveRule, deleteIncentiveRule, reloadIncentiveRules |
| **field-mappings** | 5 | listFieldMappings, createFieldMapping, updateFieldMapping, deleteFieldMapping, reloadFieldMappings |
| **metric-formulas** | 5 | listMetricFormulas, createMetricFormula, updateMetricFormula, deleteMetricFormula, reloadMetricFormulas |
| **chart-templates** | 10 | listChartTemplates, getChartTemplate, createChartTemplate, updateChartTemplate, deleteChartTemplate, reloadChartTemplates, recommendChart, getChartTemplatesForMetric, buildChartWithAnalysis, (one more reload variant) |
| **reload-all / status** | 2 | reloadAll, getConfigStatus |
| **data-sources** | 5 (visible up to file truncation at line 816) | listDataSources, getDataSource, createDataSource, updateDataSource, deleteDataSource |
| **(remaining data-sources / extra)** | (file 834 LOC; see source for tail) | (test, etc.) |

### 3.2 Classification — all 41 endpoints

| Axis | Result |
|---|---|
| nginx routing to Python | **0 of 41** — `/smartbi-config/*` not in any T6.4 nginx regex (PR #184 cross-check covers `/api/mobile/{factoryId}/smart-bi/*` only; `/api/mobile/smartbi-config/*` is different prefix) |
| Python `@router` equivalent | **0 of 41** — grep `backend/python/{smartbi_compat,smartbi}/` for `smartbi-config` returns 0 hits. (One unrelated hit `field.py:139:@router.post("/chart-config")` is a different module under `/api/smartbi/...` prefix, not `/smartbi-config/*`.) |
| Active production frontend caller | **≥30 of 41** confirmed live via `web-admin/src/api/smartbi-config.ts` (data-sources / charts / formulas / intents / thresholds / incentive-rules / field-mappings CRUD wrappers all present) |
| Phase A audit §1.2 verdict | **All 41 = OUT-OF-SCOPE / HARD KEEP** — `SmartBIConfigController` listed verbatim in PR #178 §1.2 OUT-OF-SCOPE enumeration line 50 |

**Verdict**: 41 of 41 → **KEEP**. 0 STUB. 0 DELETE.

### 3.3 Per-method internal grep (v3 protocol Step 4)

For each method name, grep within the same file for self-references:
```bash
grep -nE 'this\.(listIntents|createIntent|updateIntent|...)' SmartBIConfigController.java
```
Result: 0 self-references — methods are independently invoked from external HTTP routes. (Configuration controllers are not composite by design; each endpoint is one HTTP route → one service call.)

### 3.4 Service-layer dependencies (out-of-scope for Sub-S, kept for traceability)

`SmartBIConfigController` injects services from these packages:
- `service/smartbi/AiIntentConfigService` — KEEP (drives entire Tool-Skill architecture per `.claude/rules/ai-intent-tool-skill-architecture.md`)
- `service/smartbi/SmartBiAlertThresholdService`, `SmartBiIncentiveRuleService`, `SmartBiDictionaryService`, `SmartBiMetricFormulaService`, `SmartBiChartTemplateService` — all listed HARD KEEP per PR #150 spec §C.1.2 + PR #178 §1.2
- `service/smartbi/datasource/DataSourceService` — KEEP (admin UI dependency)

No service-layer cleanup is in Sub-S scope.

---

## 4. SmartBIUploadController — 13 endpoints

### 4.1 Endpoint inventory

Path prefix: `/api/mobile/{factoryId}/smart-bi/*` (upload-related sub-paths only — non-overlap with `SmartBIAnalysisController` paths under same prefix)
File: `backend/java/cretas-api/src/main/java/com/cretas/aims/controller/SmartBIUploadController.java`
Total: 13 `@(Get|Post|Put|Delete|Patch)Mapping` declarations.

| Line | Method | Path |
|---:|---|---|
| 110 | `uploadExcel` | `POST /upload` |
| 171 | `uploadAndAnalyze` | `POST /upload-and-analyze` |
| 239 | `confirmMappingsAndSave` | `POST /upload/confirm` |
| 283 | `listSheets` | `POST /sheets` |
| 311 | `uploadBatch` | `POST /upload-batch` |
| 367 | `uploadBatchStream` | `POST /upload-batch-stream` (SSE) |
| 435 | `retrySheet` | `POST /retry-sheet/{uploadId}` |
| 470 | `getUploadHistory` | `GET /uploads` |
| 496 | `getUploadFields` | `GET /uploads/{uploadId}/fields` |
| 518 | `getUploadData` | `GET /uploads/{uploadId}/data` |
| 564 | `getUploadsMissingFields` | `GET /uploads-missing-fields` |
| 602 | `backfillFieldDefinitions` | `POST /backfill/fields/{uploadId}` |
| 624 | `batchBackfill` | `POST /backfill/batch` |

### 4.2 Classification — all 13 endpoints

| Axis | Result |
|---|---|
| nginx routing to Python | **0 of 13** — per PR #184 audit "Real Excel upload pipeline goes through SmartBIUploadController (不在 T6.4 nginx regex 范围), 不受影响". Upload paths fall through nginx `location /` to `cretas_backend` (47 Java) for all 75 customer factories + F999 + F001. |
| Python `@router` equivalent | **0 of 13 (with caveat)** — `backend/python/smartbi_compat/api/upload.py` is a 4-line stub (per PR #201 spec §"Critical findings"). Real Python upload-adjacent routes live in `backend/python/smartbi/api/excel.py` (3921 LOC, 27 endpoints) but at **different path prefix** `/api/excel/*` and `/api/smartbi/excel/*` — not the `/api/mobile/{factoryId}/smart-bi/*` paths owned by `SmartBIUploadController`. Frontend would need a path migration to consume them. |
| Active production frontend caller | **≥4 of 13** confirmed live: `frontend/CretasFoodTrace/src/services/api/smartbi.ts:70` (`/upload`), `:110` (`/upload-and-analyze`), `frontend/.../SmartBIDataAnalysisScreen.tsx:119` (`/sheets`), `:157` (`/upload-batch`); `web-admin/public/factory-operation-manual.html:6450` documents `/smart-bi/upload` as the customer-facing 智能分析 → 数据上传 entry point |
| Phase A audit §1.2 verdict | **All 13 = OUT-OF-SCOPE / HARD KEEP** — `SmartBIUploadController` listed verbatim in PR #178 §1.2 OUT-OF-SCOPE enumeration line 50 |

**Verdict**: 13 of 13 → **KEEP**. 0 STUB. 0 DELETE.

### 4.3 PR #201 Phase 2C Tier 3 dependency chain

PR #201 `spec(phase-2c-tier-3): SmartBIUploadController 13 endpoints port design` is **SPEC ONLY — NO CODE** (763 LOC across 13 sections, ship 2026-05-09). PR #201 §"Hard prerequisites" enumerates:

1. **T6.5 Phase C complete** ← (Sub-S is part of Phase C)
2. **Tier 1 (Config) cutover GO** — graduates conventions used in Tier 3
3. **Tier 2 (Dashboard) cutover GO** — builds SSE infra reused for `/upload-batch-stream`
4. Phase 2A retrospective sign-off
5. Frontend code-path map snapshot

PR #201 sequencing total: ~12-15 weeks elapsed.

**Implication**: Sub-S exists **upstream** of any Upload migration — Phase C Sub-S MUST close as KEEP for the Tier 3 prereq chain to even start. Stubbing Upload now would invalidate the prereq for the very port plan that would later legitimize stubbing. The MO premise (stub-or-delete Upload) directly contradicts the Phase 2C dependency graph.

### 4.4 Per-method internal grep (v3 protocol Step 4)

```bash
grep -nE 'this\.(uploadExcel|uploadAndAnalyze|confirmMappingsAndSave|listSheets|uploadBatch|uploadBatchStream|retrySheet|getUploadHistory|getUploadFields|getUploadData|getUploadsMissingFields|backfillFieldDefinitions|batchBackfill)\(' SmartBIUploadController.java
```
Result: 0 internal self-references. Each endpoint is independently invoked from HTTP route.

### 4.5 Service-layer dependencies (out-of-scope for Sub-S)

Per PR #201 §"True port surface": the controller delegates to 7 service Impls totaling 8418 LOC + `PythonSmartBIClient` 1909 LOC. Largest is `SmartBIUploadFlowServiceImpl` (2513 LOC). All listed HARD KEEP through Phase 2C Tier 3 cutover. Service-layer cleanup is out-of-scope for Sub-S.

---

## 5. Three independent canonical sources confirming HARD KEEP

Per Sub-M precedent (PR #261), premise-drift findings are corroborated against three independent canonical predecessor sources to guard against single-source error. Sub-S sources:

### 5.1 Source A — PR #178 audit v3.1 §1.2 line 50 (OUT-OF-SCOPE enumeration)

> "OUT OF SCOPE (KEEP): GoldDashboardBuilder, GoldFinanceClient, **SmartBIConfigController**, SmartBIDashboardController, **SmartBIUploadController**, SmartBIPublicDemoController, all DTOs, entities, repos"

(SmartBIPublicDemoController later sunsetted via PR #222 — KEEP list of 4 SmartBI controllers reduced to 3, with Dashboard further audited audit-only no-op via Sub-M PR #261.)

### 5.2 Source B — PR #205 commit message (Phase B execute scope)

> "T6.5 Phase B execute per PR #181 marching order. **22 SmartBIAnalysisController + 1 SmartBIDashboardController.getDataDateRange = 23 method bodies stubbed.** 4 NOT_SAFE methods preserved."

Phase B touched **zero** endpoints on `SmartBIConfigController` or `SmartBIUploadController`. The Phase C cleanup (Sub-A through Sub-L + Sub-M) is the inverse of Phase B stubs only — no Sub-S precursor stub exists to be inverted.

### 5.3 Source C — PR #201 spec §"Hard prerequisites" (Phase 2C Tier 3 dependency)

PR #201 §1 lists "T6.5 Phase C complete" as Hard Prerequisite #1 for any Upload Python port. This positions Phase C **upstream** of Tier 3 — Sub-S cannot stub Upload without breaking the prereq chain Tier 3 was authored against.

### 5.4 Source D (bonus) — PR #184 nginx coverage cross-check

> "Real Excel upload pipeline goes through SmartBIUploadController (不在 T6.4 nginx regex 范围), 不受影响"

Nginx-routing axis confirmed independent of Phase A audit assumption.

**4 independent sources unanimously**: 54 endpoints stay KEEP.

---

## 6. Premise drift root cause analysis

Two MO premise drift events in T6.5 Phase C (Sub-M and Sub-S) share a common root: **organizer dispatch did not cross-reference the prior-Sub canonical KEEP list** before authoring downstream Sub MOs. Per HARD rule `feedback_organizer_dispatch_must_read_prior_sub_keep_list.md` (graduated post Sub-M, per PR #261 §"Lesson"):

> Organizer dispatching downstream Sub-batches must verify the Sub MO premise against the prior Sub's KEEP list (PR #178 §1.2 + PR #205 commit message + PR #184 nginx coverage) before sending. Otherwise downstream Sub costs ~2-3h of audit work to surface the premise drift only to ship audit-only no-op.

### 6.1 Sub-M drift root: assumed Dashboard's 11 endpoints were `nginx-migratable` like Analysis's 22 — **wrong**. PR #178 explicitly listed Dashboard out-of-regex (only `/data-date-range` was structurally migratable, captured in PR #205 as the 23rd Phase B stub). Caught by Sub-M chat audit, audit-only no-op shipped.

### 6.2 Sub-S drift root: assumed Java had separate `SmartBIChart/Excel/YoY/CrossSheet` controllers paralleling the Python module structure under `backend/python/smartbi/api/{chart,excel,yoy,cross_sheet}.py` — **wrong**. Java's analysis-domain functionality was consolidated into a single `SmartBIAnalysisController` (already handled by Sub-A #236). The literal `Chart/Excel/YoY/CrossSheet` Java controllers do not and have never existed. The actual Java residual after Analysis + Dashboard cleanup is a different pair of controllers (Config + Upload), both of which serve admin/data-management concerns out of scope for the SmartBI analysis deprecation.

### 6.3 Lesson reinforcement (already graduated to HARD rule via Sub-M)

Sub-S confirms Sub-M's lesson — the rule is **load-bearing**. Phase C dispatcher's next downstream Sub MOs (if any) must verify premise against:
1. Repo `ls controller/SmartBI*.java` ground truth (file system inventory)
2. PR #178 §1.2 OUT-OF-SCOPE list
3. PR #205 commit message Phase B touched-list
4. PR #184 nginx routing list
5. Phase 2C tier specs (PR #199/#201/#206/#222) for downstream port commitments

If these 5 do not unanimously support the dispatch premise, organizer **STOP, re-audit before sending**.

---

## 7. Verification — 0 source changes

```bash
# Sub-S worktree state at audit completion
git -C .worktrees/t6-5-phase-c-sub-s-other-controllers status --short
# Expected: only this audit doc in dirty/staged

git -C .worktrees/t6-5-phase-c-sub-s-other-controllers diff --stat origin/main..HEAD -- backend/
# Expected: 0 files changed

git -C .worktrees/t6-5-phase-c-sub-s-other-controllers diff --stat origin/main..HEAD -- docs/qa-audits/
# Expected: 1 file added (this doc)
```

Pre-edit baseline mvn (Step 0): inherited green from origin/main `4c27edefa6` per CI on Sub-L PR #262.
Post-audit mvn (Step 6.6, optional since 0 source changes): no-op, identical to baseline.

---

## 8. Cost of executing flawed premise (had this audit not caught it)

Had Sub-S blindly executed the MO `stub-or-delete` instruction without v3 protocol audit:

### 8.1 Customer-visible regressions

- **Config CRUD** UI in `web-admin` would 410 across the board for **every** factory admin (intent management, threshold tuning, incentive-rule config, field-mapping config, metric-formula config, chart-template management, data-source CRUD). The entire SmartBI admin console becomes nonfunctional.
- **Upload pipeline** (`/upload`, `/upload-and-analyze`, `/upload-batch`, `/upload-batch-stream` SSE, `/sheets`, `/uploads`, `/uploads/{id}/fields`, `/uploads/{id}/data`, `/backfill/*`) would 410 for **every** factory's Excel data ingestion. Customers cannot upload reports. Smart BI analysis upstream (Phase 2A Python ports) loses its data source entirely.
- **F999 internal team** loses both admin console + upload — same as customer factories.

### 8.2 Phase 2C downstream blocking

- PR #201 Phase 2C Tier 3 prereq chain breaks: "T6.5 Phase C complete" no longer means "Java surface preserved for incremental migration" — it would mean "Java surface destroyed prematurely". Tier 3 spec must be re-authored from cutover-without-Java baseline (a much harder migration model).
- PR #199 Tier 1 (Config) port — same issue. If Config endpoints 410'd in Phase C, Tier 1 cutover has no Java fallback for partial-port windows.
- PR #206 Tier 2 (Dashboard) — already audit-only no-op (Sub-M); no impact, but if Sub-S wrongly stubbed Config's `chart-templates` reload, Tier 2's chart rendering pipeline loses its config source.

### 8.3 Risk profile match

This is the same risk-profile row PR #178 §5.1 warned against: "NOT_SAFE_FALLTHROUGH endpoints accidentally stubbed (likelihood LOW, impact HIGH = 75 factories regression)." Sub-M was an instance of this same risk row materializing at Dashboard scope; Sub-S is the third instance materializing at Config + Upload scope. The Phase A audit §5.1 risk row's "likelihood LOW" estimate was based on rigorous v3 protocol enforcement — without rigorous enforcement, the likelihood at Sub-batch level approaches HIGH per the Sub-M + Sub-S empirical 2-of-2 hit rate.

---

## 9. Recommendation

### 9.1 For this PR (Sub-S)

- **Ship as audit-only no-op** — this audit doc only, 0 source changes.
- PR title: `audit(t6-5-phase-c-sub-s): Config + Upload 54 endpoints all KEEP — premise drift caught (audit-only no-op)`
- Mirror Sub-M PR #261 structure for body / verification / predecessors.

### 9.2 For Phase C overall

- Phase C's Java SmartBI controller surface cleanup is **complete** with Sub-S close. No further Sub-batch dispatches are needed at the controller-file level.
- Remaining Phase C work (Sub-I Procurement service Impl audit if not yet shipped — verify against origin/main) is service-Impl scope, unrelated to this controller-level audit.
- Service-Impl scope cleanup (Sub-B/C/D/E/F/G/H/I/L) sweep is independent of Sub-S; Sub-S does not block any sister Sub-batch.

### 9.3 For organizer dispatch protocol

- **Reinforce HARD rule** `feedback_organizer_dispatch_must_read_prior_sub_keep_list.md` — Sub-M graduated it; Sub-S empirically confirms its load-bearing necessity.
- Before any future Phase C / Phase 2C dispatch, organizer runs the 5-source cross-check (§6.3) against the Sub MO premise.
- If the dispatch names specific source files / class names, organizer must `ls` / `glob` to verify file existence, **not** rely on Python module names or paraphrased class names.

### 9.4 For T6.5 closure

After Sub-S merges (audit-only no-op), the Java SmartBI controller surface layer is **closed for T6.5**:
- Analysis: 23 endpoints stubbed (PR #205) → 23 method declarations deleted (Sub-A #236)
- Dashboard: 0 stubs / 0 deletes (Sub-M #261 audit-only no-op, all KEEP for composite)
- Config: 0 changes (Sub-S audit-only no-op, all KEEP)
- Upload: 0 changes (Sub-S audit-only no-op, all KEEP, Phase 2C Tier 3 will pick up via PR #201)
- PublicDemo: file deleted (PR #222 Tier 4 sunset)

Service-Impl layer cleanup (Sub-B through Sub-L) continues as per master MO PR #227 — independent of controller layer.

---

## 10. Predecessors + sister chats

### 10.1 Direct predecessors (verified merged on origin/main `4c27edefa6`)

- **PR #178** — Phase A audit v3.1 (§1.2 OUT-OF-SCOPE enumeration is the source of truth for Sub-S HARD KEEP classification)
- **PR #184** — nginx ↔ Python coverage cross-check (confirms Upload not in T6.4 nginx regex)
- **PR #205** — Phase B execute (Phase C Sub-A inverse-of source; Sub-S has no precursor in Phase B)
- **PR #222** — Phase 2C Tier 4 PublicDemo sunset
- **PR #227** — Phase C 8-chat parallel master MO (Sub-S is Round 3 supplement)
- **PR #236** — Phase C Sub-A SmartBIAnalysisController body delete + repo delete
- **PR #261** — Phase C Sub-M Dashboard audit-only no-op (premise drift precedent — STRUCTURAL TEMPLATE for this PR)
- **PR #259** — Phase C Sub-K SmartBiQueryTemplate entity orphan delete
- **PR #262** — Phase C Sub-L cross-Sub orphan sweep

### 10.2 Forward-looking dependencies (NOT prerequisites, but downstream)

- **PR #199** Phase 2C Tier 1 Config port — depends on Sub-S close (Config surface preserved)
- **PR #201** Phase 2C Tier 3 Upload port — depends on Sub-S close (Upload surface preserved)
- **PR #206** Phase 2C Tier 2 Dashboard port — depends on Sub-M + Sub-S close (Dashboard surface preserved by Sub-M; Config surface preserved by Sub-S)

### 10.3 Sister Sub-batches (parallel, no dependency on Sub-S)

Sub-B/C/D/E/F/G/H/I/L all cleanup `*AnalysisServiceImpl.java` method bodies — service-layer scope independent of controller-layer Sub-S.

---

## 11. Test plan

- [x] origin/main HEAD verified at `4c27edefa6` (Sub-L #262)
- [x] Worktree `.worktrees/t6-5-phase-c-sub-s-other-controllers` created off origin/main with branch `ops-t6-5-phase-c-sub-s-other-controllers`
- [x] `ls controller/SmartBI*.java` verified — 4 files (Analysis / Dashboard / Config / Upload)
- [x] Config endpoint count = 41 (verified `grep -cE '@(Get|Post|Put|Delete|Patch)Mapping'`)
- [x] Upload endpoint count = 13 (verified same grep)
- [x] Python `@router` grep returns 0 hits for `/smartbi-config/*` paths
- [x] Python `@router` grep returns 0 hits for the 13 Upload paths under `/api/mobile/{factoryId}/smart-bi/*` (excel.py / datasource.py routes are different prefixes, not in scope)
- [x] Frontend caller grep returns ≥30 active sites for Config and ≥4 active sites for Upload
- [x] PR #178 §1.2 OUT-OF-SCOPE list cited for both Config + Upload
- [x] PR #184 cross-check cited for Upload nginx-not-routed
- [x] PR #201 §"Hard prerequisites" cited — confirms spec only, no code, T6.5 Phase C is upstream
- [x] PR #205 commit message cited for Phase B touched-list (zero overlap with Sub-S targets)
- [x] 0 source changes committed
- [ ] Reviewer confirms 4 canonical sources unanimously support HARD KEEP verdict (§5)
- [ ] Reviewer confirms premise drift root cause analysis (§6) matches Sub-M precedent
- [ ] Reviewer confirms cost-of-flawed-premise risk row (§8) matches PR #178 §5.1 risk profile
- [ ] Steve admin merge

---

## 12. Conclusion

T6.5 Phase C Sub-S is an **audit-only no-op PR**, mirroring Sub-M PR #261 outcome.

- **54 of 54 endpoints** (41 Config + 13 Upload) → **KEEP**
- **0 STUB-410**
- **0 DELETE-METHOD**
- **0 DELETE-CLASS**
- **0 source changes**

Phase C's Java SmartBI controller surface cleanup is hereby **closed**. Service-layer Sub-batches continue per master MO PR #227 independently.

**Premise drift caught — 2nd of 2 Phase C drift events** confirms the load-bearing necessity of HARD rule `feedback_organizer_dispatch_must_read_prior_sub_keep_list.md`.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
