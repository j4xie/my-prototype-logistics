# R5 — 边界 + Phase 2B parity + Rule 17 antipattern grep

**Date**: 2026-05-12
**Branch**: `qa/r5-boundary-parity-antipattern` (base `b6bb2b276`)
**Spec**: `docs/qa-specs/2026-05-12-smartbi-python-port-deep-e2e-spec.md` §5 Round 5
**Tooling**: 3 sister chats dispatched in parallel (boundary curl / parity-gate compare.py / static Grep) by organizer
**Constraints honoured**: read-only verification, no code changes, no `--env prod` deploys, no git ops by sisters

---

## §0 TL;DR

| Task | Acceptance bar | Outcome |
|---|---|---|
| **A — datasource upload boundary (5 cases)** | 5/5 specific error, sticky verified | ✅ 3/5 clean + ✅ sticky globally enforced; **🚨 2 P1 BUG** (B1 100MB hang, B2 unicode filename mojibake) |
| **B — Phase 2B Java↔Python parity (8 pairs)** | 0 REAL_BUG | ✅ **0 / 8 REAL_BUG** (4 `pattern_b_phase_2d_pending` + 2 `python_not_in_scope` + 2 `dict_eq_match` w/ Pattern A tolerated) — **2 spec-drift follow-ups** logged |
| **C — Rule 17 6-item antipattern grep (scope-expanded)** | 6 items grep'd + verdict | ✅ scope expanded 60 controllers + web-admin Vue (vs 2026-05-10 SmartBI-only); **🚨 2 P1 BUG + 22 RISK + ~85 SAFE** (27 new finds vs prior sweep) |

**Headline**: **4 P1 BUGs across 3 tasks + 22 RISK** filed below as tickets. No fixes applied in this PR (audit-only per `feedback_ui_smoke_scope_creep_default_ticket.md` HARD rule — STOP-and-ticket).

---

## §1 Task A — datasource upload boundary

**Endpoint**: `POST /api/mobile/{factoryId}/smart-bi/upload` (`SmartBIUploadController.java:110`)
**Env**: test gateway `139.196.165.140:8097` → nginx → Java test `47:10011` → Python test `47:8084`
**Account**: `factory_admin1` / `123456` (F001)
**Login route**: `/api/mobile/auth/unified-login` (spec said `/auth/login` — drift noted)
**Full detail**: `_staging/r5-task-a.md` (142 lines) + `_staging/evidence/*.json` (6 files)

### Boundary case matrix

| # | Case | HTTP | Specific error? | Time | Bug? |
|---|---|---|---|---|---|
| 1 | 100MB binary `.xlsx` | 100 (no final response) | ❌ no termination, 300s+ hang | 300s+ | **B1 P1** |
| 2 | 0-byte empty | 200/400 envelope | ✅ `"Excel parse failed: 文件不是有效的 xlsx 格式..."` | 0.49s | clean |
| 3 | Corrupt 8KB random | 200/400 | ✅ same Chinese text | 0.43s | clean |
| 4 | Unicode filename `销售数据_2026年5月.xlsx` | 200 (parse OK) | parse ✅; persist ❌ | 31.6s+1.2s | **B2 P1** |
| 5 | MZ exe content w/ `.xlsx` ext | 200/400 | ✅ same Chinese text (content-based detection) | 0.45s | clean |

### Sticky-toast enforcement (qa-prompt Rule 8) — global

FE bundle (`index-_iHIJmvd.js`) monkey-patches `ElMessage.error` at app bootstrap to `duration: 0, showClose: true`. Idempotency flag `__cretasErrorPatched` prevents double-wrap. Conclusion: **Rule 8 enforced globally** at FE entry — backend boundary errors (Cases 2/3/5) will render sticky on FE without per-call code. No per-call backslide possible unless explicit `duration: <ms>` override at the call site.

### 🚨 B1 — 100MB upload hangs 300s+ with no terminating error (P1)

`SmartBIUploadController.java:57` sets `MAX_UPLOAD_BYTES = 300 MB` (sanity cap) but the sync `/upload` path has **no parse timeout** when the Python `parseExcel` blocks on binary-content "fake xlsx". cURL observed `HTTP_STATUS=100 (Continue)` + 104857820 bytes uploaded → 300s window expired → no final response. FE from user perspective: spinner ≥5min, then client-side timeout, no error toast.

**Suggested fix**: drop `MAX_UPLOAD_BYTES` on `/upload` to 50MB and auto-route 50-300MB to async `/upload-and-analyze`, OR add 60s timeout on `pythonClient.parseExcel` + return specific error `"Excel 解析超时，请检查文件或拆分后重试"`.

**Severity**: P1 — DoS surface (one client can hold a backend thread + Python parse worker for 5min with junk content).

### 🚨 B2 — Unicode filename mojibake at persist (P1, customer-facing silent corruption)

Excel cell content round-trips UTF-8 cleanly (parse response shows `销售额` correctly), but the **filename** field captured from `MultipartFile.getOriginalFilename()` and written to `smart_bi_pg_excel_upload.file_name` has **12× `U+FFFD` replacement chars** where 4 Chinese chars (销售数据 + 年 + 月) lived. Math: 4 Chinese chars × 3 mojibake bytes each ≈ 12 replacements (consistent with ISO-8859-1→UTF-8 double-decode pattern). ASCII `2026` and `5` survived intact.

**Root cause hypothesis**: Tomcat servlet container default `defaultEncoding=ISO-8859-1` for multipart filename param (RFC 7578 ambiguity in legacy multipart).

**Suggested fix**: set `server.tomcat.multipart.encoding=UTF-8` (or `spring.servlet.multipart.encoding=UTF-8`) in `application*.properties`, OR controller-side `new String(filename.getBytes("ISO-8859-1"), "UTF-8")`.

**Severity**: P1 customer-facing — any zh-CN customer uploading a Chinese-named Excel (extremely common, e.g. `销售-Q1.xlsx`, `叮咚_库存_2026年5月.xlsx`) sees mojibake in `/uploads` upload-history page; trace lineage broken in audit logs. **Silent** — no error toast, upload succeeds, only visual on history list.

---

## §2 Task B — Phase 2B Java vs Python parity

**Scope**: 4 endpoints × {F001, F006} = 8 curl pairs
**Env**: Java prod 10020 (green active; blue 10010 not listening — confirmed via `ss -tlnp`), Python prod 8083; reached via SSH tunnel (prod ports SG-locked to nginx)
**Tool**: `scripts/parity-gate/compare.py` (BG-aware + Phase-C routing-aware per PR #432 hardening) — run in fixture-mode against captured raw bodies (eliminates tunnel/keepalive artifacts)
**Full detail**: `_staging/r5-task-b.md` (132 lines) + `C:/tmp/r5b/cmp-{factory}-{endpoint}.{json,html}`

### Parity matrix

| Factory | Endpoint | HTTP J/P | Verdict |
|---|---|---|---|
| F001 | `GET /smart-bi/analysis/production` | 200 / 200 | `pattern_b_phase_2d_pending` (intentional Phase 2D placeholder) |
| F001 | `GET /smart-bi/analysis/quality` | 200 / 200 | `pattern_b_phase_2d_pending` |
| F001 | `POST /smart-bi/query` | 400 / 404 | `python_not_in_scope` (spec-declared CUT) |
| F001 | `POST /smart-bi/drill-down` | 200 / 200 | `dict_eq_match` (2 Pattern A int-collapse tolerated) |
| F006 | `GET /smart-bi/analysis/production` | 200 / 200 | `pattern_b_phase_2d_pending` |
| F006 | `GET /smart-bi/analysis/quality` | 200 / 200 | `pattern_b_phase_2d_pending` |
| F006 | `POST /smart-bi/query` | 400 / 404 | `python_not_in_scope` |
| F006 | `POST /smart-bi/drill-down` | 200 / 200 | `dict_eq_match` |

**REAL_BUG count**: **0 / 8** — Phase 2A dict-eq gate clean ✅

### Verdict distribution

- **4 `pattern_b_phase_2d_pending`** — `/analysis/production` + `/analysis/quality` × 2 factories: Python returns deliberate empty envelope `{kpiCards:[], rankings:{}, charts:{}, dataAvailability:"FACTORY_SILVER_PHASE_2D_PENDING"}` per `backend/python/smartbi_compat/api/analysis_production.py:75-90` (chat-A1 dispatch 2026-05-12 Option B). Java returns full computed analytics. Pattern B structural divergence is NOT in dict-eq scope per `.claude/rules/python-java-port.md` Rule 4 Phase 2A entry. Phase 2D Silver-layer migration is the gate.
- **2 `python_not_in_scope`** — `/smart-bi/query` × 2 factories: Java 400 (body-parse rejection by `NLQueryRequest`), Python 404 (NOT_FOUND, spec §2.4 declares CUT).
- **2 `dict_eq_match`** — `/smart-bi/drill-down` × 2 factories: clean parity, F001 has 2 Pattern A int-collapse tolerations (`2264346.0` Java vs `2264346` Python).

### Follow-up items (filed as tickets — not bugs)

1. **Spec drift §2.4 line 135** — `/smart-bi/drill-down` is listed as Python-CUT/Java-only, but Python serves it at 8083 with full dict-eq parity. Either spec is stale, or it's intentionally still in scope post-Phase-2C. Spec author should reconcile.
2. **`/smart-bi/query` Java 400 on documented body** — `NLQueryRequest` JSON contract may have drifted since spec was authored. Out of this task's scope but worth a follow-up grep.

### Methodology gotchas (logged for sister chats)

- Login route is `/api/mobile/auth/unified-login`, NOT `/auth/login` — `/auth/login` literal appears only in `JwtAuthInterceptor.java:216` whitelist.
- Windows Git Bash `cat token.txt | tr -d '\n'` does NOT strip trailing `\r` — caused malformed `Authorization: Bearer …\r` header → Tomcat HTML 400 cascade. Fix: `tr -d '\r\n'`. (Mid-run mass-400 incident, all 8 captured responses are post-fix.)

---

## §3 Task C — Rule 17 antipattern grep (6 items, scope-expanded)

**Scope vs 2026-05-10 sweep**: ALL backend controllers (60 files, 170 `@RequestBody` sites) + FE web-admin Vue (61 form-spread occurrences) — NOT SmartBI-only.
**Reference template**: `docs/qa-audits/2026-05-10-phase-c-rule15-rule17-static-scan.md`
**Full detail**: `_staging/r5-task-c.md` (269 lines)

### Jackson config baseline (CRITICAL CONTEXT)

`spring.jackson.deserialization.fail-on-unknown-properties` is **NOT enabled** anywhere in `application*.properties`. Spring Boot default is `false` → Jackson silently drops unknown JSON fields on `@RequestBody` binds. Only `CacheConfig.java:56` disables it explicitly (for Redis). This means W-01 phantom-field ingestion of *recognized* entity fields (`createdAt`/`updatedAt`/`deletedAt`/`factoryId`/`id`) is possible whenever `@RequestBody Entity` binds directly AND service does a blind `repo.save(body)`.

**BaseEntity audit** (`entity/BaseEntity.java`):
- `@PrePersist` only sets `createdAt`/`updatedAt` if NULL → **client-supplied non-null values persist**.
- `@PreUpdate` unconditionally overwrites `updatedAt` (safe).
- `deletedAt` is **never guarded** → client can `deletedAt: null` to undelete OR `deletedAt: <future>` to soft-delete via PUT, IF the path does blind save.

### 6-item verdict summary

| Rule | Sister lineage | Hits this sweep | New vs 2026-05-10 | Key sites |
|---|---|---|---|---|
| **17.1** @RequestBody Entity bind | W-01 | **12 entity types / 19 sites: 8 RISK + 1 BUG + 4 latent + 6 SAFE** | +12 entity-bound sites + 1 BUG | `BomController.updateOverheadCost` 🚨, `BusinessRuleController.setDefaultValue`, `AIIntentConfigController` PUT/POST, `SystemConfigController`, `LabelRecognitionController`, `TriggerChainController`, `SchedulingOptimizationController`, `ReusableContainerController` |
| **17.2** Mapper partial updateEntity | W-04 | 5 mapper hits all SAFE (sampled Customer/User/ProductionPlan, null-guarded); 2 service helpers need verify | +2 service helpers | `DecorationServiceImpl.updateLayoutFromRequest`, `FactorySettingsServiceImpl.updateEntityFromDTO` |
| **17.3** @Transient setter risk | n/a | 14 @Transient hits, 11 derived-getter SAFE, **3 latent setter** | +3 latent | `AIQuotaRule.setRoleMultipliersMap`, `AIReportPromptConfig.setAnalysisDirectionsList`, `ProductionProcessPromptConfig.setExpectedCompletionActionsList` (SAFE today — entities not directly @RequestBody-bound, but attack surface if refactored) |
| **17.4** FE form spread phantom fields | W-05 | 61 form-spreads, **4 RISK** | +4 (1 reconfirmed from 2026-05-10) | `system/work-processes`, `restaurant/recipes/list:624`, `smartbi-config/DataSourceConfigView` (reconfirmed), `smartbi-config/ChartTemplateView` |
| **17.5** Semantic delta vs absolute | W-03 | 1 BUG | +1 BUG | `MaterialBatchServiceImpl.adjustBatchQuantity` 🚨 (4-arg delta vs 5-arg absolute overload, AI Tool callers inconsistent) |
| **17.6** Shared Create*Request for PUT | BR-13 | 5 sites: 2 mitigated (mapper null-guarded), 3 needs-verify | +5 BR-13 | `ProductionPlanController`, `UserController`, `EquipmentController`, `FactoryBlueprintController`, `SchedulingController` |

### 🚨 BUG #1 — `BomController.updateOverheadCost:211` blind save (17.1)

PUT handler does NOT load existing record:
```java
config.setId(id); config.setFactoryId(factoryId);  // Controller-side path-var override
repository.save(config);                            // Service-side blind save
```
Any DB-only field (e.g. `version`, `createdAt`, anything not in client payload) is dropped to NULL. Finance domain. **HIGH severity** if FE phantom fields flow in.

**Fix template** (mirror `BusinessRuleController.setSchedulerConfig:159-164`): select-then-merge with null-guards per field.

### 🚨 BUG #2 — `MaterialBatchServiceImpl.adjustBatchQuantity` overload confusion (17.5)

Two overloads with opposite math:
- 4-arg `adjustBatchQuantity(factoryId, batchId, quantity, reason)` — **DELTA**: `current + param`
- 5-arg `adjustBatchQuantity(factoryId, batchId, quantity, reason, operatorId)` — **ABSOLUTE**: `param = newQuantity`

Two AI Tool callers pass param named `quantity` with opposite intent:
- `BatchUpdateTool.java:183` → 4-arg overload (interprets as delta)
- `MaterialAdjustQuantityTool.java:100` → 5-arg overload (interprets as absolute)

**Silent data corruption risk** when LLM picks the wrong tool. **Fix**: rename 4-arg → `applyBatchQuantityDelta` (explicit semantic), keep 5-arg `adjustBatchQuantity` for absolute. Update `BatchUpdateTool:183` caller with explicit `delta` param.

### Risk amplification — BomController + BusinessRuleController.setDefaultValue

Both do **TRUE blind save** (no select-then-merge); others either select-then-merge in service (SAFE) or have controller-side defensive `setX()` overrides for path-vars only (still RISK because body audit fields slip through Jackson lenient default).

---

## §4 Recommended ticket triage

| # | Severity | Title | Source | Suggested fix |
|---|---|---|---|---|
| T-R5-1 | **P1 BUG** | 100MB upload hangs 300s+ no error | A B1 | Add 60s Python parse timeout + drop `/upload` MAX_UPLOAD_BYTES to 50MB |
| T-R5-2 | **P1 BUG** | Unicode filename mojibake at persist | A B2 | `spring.servlet.multipart.encoding=UTF-8` in application*.properties |
| T-R5-3 | **P1 BUG** | `BomController.updateOverheadCost` blind save | C 17.1 | Select-then-merge with null guards (mirror `BusinessRuleController.setSchedulerConfig`) |
| T-R5-4 | **P1 BUG** | `MaterialBatchServiceImpl.adjustBatchQuantity` overload delta/absolute confusion | C 17.5 | Rename 4-arg → `applyBatchQuantityDelta`; fix `BatchUpdateTool:183` caller |
| T-R5-5 | P2 RISK sweep | 4 latent W-01 entity-binds (LabelRecognitionConfig×2, FactoryTriggerChain, ReusableContainer, FactorySchedulingConfig) | C 17.1 | Audit downstream service for select-then-merge; OR convert to UpdateXRequest DTO |
| T-R5-6 | P2 RISK sweep | 2 service helpers null-guard verify | C 17.2 | Sample `DecorationServiceImpl.updateLayoutFromRequest` + `FactorySettingsServiceImpl.updateEntityFromDTO` |
| T-R5-7 | P3 RISK | 3 BR-13 mapper null-guard verify | C 17.6 | Sample `EquipmentService.updateEquipment` / `blueprintService.updateBlueprint` / `schedulingService.updatePlan` |
| T-R5-8 | P3 RISK | FE form-spread phantom field cleanup | C 17.4 | `delete row.createdAt/updatedAt/deletedAt` before PUT in 4 Vue files |
| T-R5-9 | P3 RISK | 3 latent @Transient setter audit | C 17.3 | Verify `AIQuotaRule`/`AIReportPromptConfig`/`ProductionProcessPromptConfig` not regression-bound to `@RequestBody` |
| T-R5-10 | P3 INFO | Spec §2.4 drift on `/smart-bi/drill-down` Python status | B follow-up 1 | Spec author reconcile |
| T-R5-11 | P3 INFO | `NLQueryRequest` body contract drift (Java 400) | B follow-up 2 | Grep documented examples vs current DTO schema |
| T-R5-12 | P4 INFO | Enable `fail-on-unknown-properties=true` in test env | C Jackson context | Behind feature flag, BREAKING — exposes latent FE phantom fields |

---

## §5 Constraints & methodology

- **No code changes / no commits by sisters** — audit-only sweep per `feedback_ui_smoke_scope_creep_default_ticket.md` HARD rule
- **No `--env prod` deploys** per `feedback_default_test_only_deploy` HARD rule
- **Task A test env only** (`47:10011` Java test, `47:8084` Python test)
- **Task B prod read-only** (parity verification is the explicit purpose of `scripts/parity-gate/compare.py`)
- **Task C static read-only Grep** — no live system hit
- **Worktree isolation**: `C:/Users/Steve/cretas-r5-boundary` on `qa/r5-boundary-parity-antipattern` from `origin/main b6bb2b276`. Main worktree untouched.

---

## §6 Evidence index

| File | Source |
|---|---|
| `_staging/r5-task-a.md` (142 lines) | Task A — full curl logs, sticky FE bundle analysis, root-cause hypotheses |
| `_staging/r5-task-b.md` (132 lines) | Task B — 8 pair-by-pair verdict, compare.py outputs, methodology gotchas |
| `_staging/r5-task-c.md` (269 lines) | Task C — full 6-item grep tables, line-by-line entity-bind matrix, fix templates |
| `_staging/evidence/case*_response.json` (6 files) | Task A — raw HTTP responses for each boundary case |
| `C:/tmp/r5b/cmp-{factory}-{endpoint}.{json,html}` (16 files) | Task B — compare.py outputs (not committed; reproducible via re-run) |
