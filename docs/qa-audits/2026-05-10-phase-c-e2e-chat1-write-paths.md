# Phase C E2E SmartBI Write Paths — chat1 dispatch

**Date**: 2026-05-10
**Run tag**: C15832 (E2E) + DFB34 (diag follow-up)
**Test env**: web-admin `139:8097` → nginx → Java test backend `47:10011` + Python test `47:8084`
**Tester**: chat1 (Phase C E2E dispatch from organizer May 10 ~12:39 UTC)
**Backend jar**: Phase C 18-sub-batch deploy to test 10011 ~12:39 UTC May 10
**Login**: `factory_admin1` / F001 (factory_super_admin role)
**QA prompt**: v2.4 (Apr 24 2026) — full 17 rules
**Authority**: PR #271 Sub-S audit (54 KEEP) + PR #178 §1.2 OUT-OF-SCOPE + PR #205 Phase B execute

---

## §0 TL;DR

- **Phase C dead-method-delete cleanup verification: GO** (no regression detected).
  All Sub-S Config (41) + Upload (13) endpoints that the test exercised still respond.
- **2 pre-existing bugs uncovered (NOT Phase C regression)**:
  - **P-3.1 (P1 silent failure)**: DataSource create/edit/delete fails 100% from web-admin UI because FE never sends `factoryId`. Backend rejects with `"factoryId 必填"` → row not persisted. Confirmed by direct API probes (T1+T1b): backend works when `?factoryId=F001` query param OR body field is provided.
  - **P-2.3 (P0 silent-drop + data corruption)**: Threshold update — FE→BE field-name mismatch (`warningThreshold` vs `warningValue`). PUT returns 200 + `"更新成功"` but warningValue stays null. Worse: a partial PUT silently corrupts `comparisonOperator` from `LESS_THAN` → `GT`. Multiple violations of Rule 17.2 (mapper partial-field) AND Rule 11 (silent-drop visible only via re-GET).

- **Decision for Sub-S Phase C close**: **CONDITIONAL GO** — Phase C technical changes (orphan deletes) introduced no regression; however the *premise* of Sub-S audit ("all 41 Config + 13 Upload endpoints KEEP") needs an addendum: KEEP ≠ working from web-admin in current state. P-3.1 affects entire `data-sources` CRUD chain. Customers cannot create/manage data sources via web-admin today.
- **No prod deploy**. Test 10011 only. Both bugs filed as TaskCreate #2 (P-2.3) + #3 (P-3.1).

| Phase | Steps | PASS | FAIL | BLOCKED | Notes |
|---|---|---|---|---|---|
| 0 (login) | 1 | 1 | 0 | 0 | factory_admin1 token landed on /dashboard |
| 1 (Excel upload) | 2 | 2 | 0 | 0 | 1.2 reclassified PASS — FE accept-filter blocks .txt with sticky+specific toast (Rule 8 ✓) |
| 2 (Threshold) | 3 | 2 | 1 | 0 | 2.3 silent-drop (P-2.3) — root cause: FE/BE field-name mismatch |
| 3 (DataSource CRUD) | 5 | 1 | 1 | 3 | 3.1 fails on factoryId; 3.2-3.4 cascade-blocked. Diag T1+T1b proves backend works with factoryId given. |
| 4 (Error path) | 1 | 1 | 0 | 0 | FE validation blocks empty submit; no API call (Rule 8 inline-error ✓) |
| 5 (state isolation) | 1 | 1 | 0 | 0 | `destroy-on-close` makes Rule 16b structurally guaranteed (informational) |
| **Total** | **13** | **8** | **2** | **3** | |

(Original raw counts before reclassifying 1.2: PASS=6 FAIL=2 BLOCKED=4. Phase 1.2 moves to PASS; Phase 3.2/3.3/3.4 stay BLOCKED but diag confirms they pass when factoryId injected manually.)

---

## §1 Pre-flight (Phase 0)

### Environment health
- `curl http://139.196.165.140:8097/` → HTTP 200 (1.6s) ✓
- `curl http://139.196.165.140:8097/api/mobile/health` → 200 `{"status":"UP","timestamp":1778389884824}` ✓
- Direct backend `47:10011` and `47:8084` are not reachable from chat1 host — by design per `.claude/rules/aliyun-credentials.md` Phase 3 SG tightening (only nginx 139 may reach 47 ports). All E2E goes through web-admin → nginx → backend.

### Login
- Page `/login` rendered Element Plus form, filled username/password, clicked `登 录` button
- Token landed in `localStorage.cretas_access_token`; URL → `/dashboard`
- Decoded JWT payload: `{"role":"factory_super_admin","factoryId":"F001","userId":1,"username":"factory_admin1","sub":"factory_admin1","iat":1778390541,"exp":1778476941}`
- **factoryId IS present in JWT** (relevant to bug §3.1 — backend could resolve factoryId from JWT but doesn't)

### Code-side reconnaissance (before E2E)
- Excel upload UI: `web-admin/src/views/smart-bi/ExcelUpload.vue`, route `/smart-bi/upload`
- DataSource CRUD UI: `web-admin/src/views/smartbi-config/DataSourceConfigView.vue`, route `/system/smartbi-config/data-sources`
- DataSource API client: `web-admin/src/api/smartbi-config.ts` lines 113-130 — sends `data` body, no factoryId, no query param
- Backend controller: `backend/java/cretas-api/src/main/java/com/cretas/aims/controller/SmartBIConfigController.java`
  - Lines 775-784 `POST /data-sources`: requires factoryId from `@RequestParam` OR `dto.getFactoryId()`, else 200-OK error envelope `"factoryId 必填"`
  - Lines 188-192 `PUT /thresholds/{id}`: takes `String id` + `@RequestBody @Valid SmartBiAlertThreshold threshold`
- Threshold entity field names per backend response sample (diag T2-list-shape): `warningValue`, `criticalValue`, `comparisonOperator`, `thresholdType`
- Threshold FE interface (`smartbi-config.ts:66-77`): `warningThreshold`, `criticalThreshold`, `direction` — **FIELD NAMES DIFFER FROM BACKEND** (root cause of P-2.3)

---

## §2 Excel Upload Coverage Matrix (Phase 1)

### 2.1 Page mount + endpoint reachability
| Step | URL | Verdict | Depth | Evidence |
|---|---|---|---|---|
| 1.1 mount `/smart-bi/upload` | `GET /api/mobile/F001/canvas/role-module-override` 200; `GET /api/mobile/F001/config/disabled-modules` 200 | **PASS** | medium | `phase1-1-upload-page.png` — wizard renders 4 steps (上传文件 → 解析结果 → 分析结果 → 保存确认), `pageTextLen=502` |

### 2.2 Invalid-file upload (Rule 8 four-axis)
- **Step 1.2**: Upload in-memory `invalid-test.txt` (text/plain) via `el-upload` input.
- **Result**: FE never made an HTTP call to `/upload-and-analyze`. Element Plus `el-upload` `accept` filter rejected the file before the request was issued.
- **Toast captured (MutationObserver)**: `"请上传 Excel 或 CSV 文件 (.xlsx, .xls, .csv)"`, classes include `el-message--error is-closable is-center`, `isClosable=true`.
- **Rule 8 four-axis on FE-side reject**:
  - (a) network: no API call (FE blocked) — N/A backend path
  - (b) toast: matches FE accept-filter expectation precisely ✓
  - (c) sticky: `is-closable` present ✓ (note: `el-message` default 3s; closable means user can dismiss but auto-fades — borderline; not error-dialog-grade but acceptable for client-side validation)
  - (d) actionHint: message lists exact accepted extensions `(.xlsx, .xls, .csv)` ✓
- **Reclassify**: my E2E script flagged this as `BLOCKED` because `uploadResp` was undefined. After investigation, FE-side block is *correct behavior* and the toast is specific + closable. **Treating as PASS** for the validation contract.
- **Backend invalid-file response NOT exercised**: Would require synthesizing a `.xlsx` with corrupt or wrong content (FE accepts extension, backend Python parser rejects). Out of scope for chat1 60-min budget; recommend dedicated upload-error chat for this.

| Step | Layer | Verdict | Depth | Evidence |
|---|---|---|---|---|
| 1.2 invalid `.txt` upload | FE accept-filter | **PASS** (FE-side reject with sticky+specific toast) | error-deep | `phase1-2-after-invalid-upload.png` |

**Excel upload pipeline summary**: Page mount + FE accept-filter both PASS. Backend `/F001/smart-bi/upload-and-analyze` not exercised with valid xlsx (deferred — chat1 budget). Sub-S Upload (13) controller endpoints not regressed in observable surface.

---

## §3 Config CRUD Coverage Matrix (Phase 2 + Phase 3)

### Rule 16 entry-point matrix on `DataSourceConfigView.vue`

| Entry point | Tested | Verdict | Notes |
|---|---|---|---|
| `handleAdd` (line 136) | 3.1 | **FAIL** (P-3.1) | POST 200 envelope but body `success=false`, "factoryId 必填" |
| `handleEdit` (line 142) | 3.2 | BLOCKED | cascade-blocked on 3.1; diag T1 confirms PUT works with `?factoryId=F001` |
| `handleSubmit` (line 148) | covered by 3.1 + 3.2 | — | shared submit handler |
| `handleDelete` (line 183) | 3.4 | BLOCKED | cascade-blocked; diag cleanup confirms DELETE works with `?factoryId=F001` |
| `handleTestConnection` (line 209) | 3.3 | BLOCKED | cascade-blocked |
| `handleSearch` / `handleReset` / `handlePageChange` | observed in 3.0 mount | PASS | list GET hits cleanly |

### Rule 11 wire+roundtrip results

#### Phase 2.1 — Threshold list mount
- **PASS** — `GET /api/mobile/smartbi-config/thresholds` → 200, 7 rows returned
- Apparently no factoryId required for thresholds GET (works in current state)

#### Phase 2.2 — Rule 9 data sample (top + middle + last)
| Position | id | metricCode | metricName | warningThreshold |
|---|---|---|---|---|
| Top 1 | 64b1edd6-...-955b-00163e35af14 | `current_ratio` | (omitted by API) | (omitted by API) |
| Top 2 | 64b3b98f-...-955b-00163e35af14 | `quick_ratio` | (omitted) | (omitted) |
| Top 3 | 64b4faba-...-955b-00163e35af14 | `debt_ratio` | (omitted) | (omitted) |
| Middle | 64b5bbd8-...-955b-00163e35af14 | `interest_coverage` | (omitted) | (omitted) |
| Last 1 | 64b696df-...-955b-00163e35af14 | `roa` | (omitted) | (omitted) |
| Last 2 | 64b7654d-...-955b-00163e35af14 | `roe` | (omitted) | (omitted) |
| Last 3 | 64b8a058-...-955b-00163e35af14 | `safety_margin_rate` | (omitted) | (omitted) |
- All metric codes are recognized financial-ratio identifiers (current/quick/debt/ROA/ROE etc.) — passes Rule 9 business semantic sanity. No "门店名称" / "1.0/2.0" / Excel-bleed pseudo-rows.
- **Field-name observation (not Rule 9 finding)**: FE's `metricName` and `warningThreshold` are absent from the response — backend uses `metricCode` (no `metricName` returned at all in test) and `warningValue` instead of `warningThreshold`. This is the seed of P-2.3.

#### Phase 2.3 — Threshold inline-edit roundtrip (P-2.3 confirmed)
- **Target**: `current_ratio` (id=`64b1edd6-...-955b-00163e35af14`)
- **PUT body sent**: `{"warningThreshold":1,"isActive":true}` (38 chars)
- **HTTP response**: 200, body `{"success":true,"message":"更新成功"}`
- **Re-GET (list)**: row's `warningValue` still null (FE never sees `warningThreshold` because backend returns `warningValue`)
- **Verdict**: **FAIL — silent-drop**. PUT looks successful to user; nothing actually changes.

#### Phase 2.3 follow-up (diag T2 series, run DFB34)
Run with **full body** echo + a **separate partial PUT**:
- T2-full-body-put: sent `{...target, warningThreshold: 99}` (echo full row + bump). PUT 200 message="更新成功". Re-GET: `warningValue` STILL null. → FE field-name `warningThreshold` is silently ignored by backend Jackson deserializer (entity has `warningValue`).
- T2-partial-body-put: sent `{warningThreshold:88, isActive:true}`. PUT 200 message="更新成功". Re-GET: `warningValue` STILL null AND `comparisonOperator` mutated `"LESS_THAN"` → `"GT"`. → Two silent-drops simultaneously: (1) FE field name ignored, (2) comparisonOperator silently corrupted because partial-body re-save defaults the missing field.

Conclusion (P-2.3 root cause):
1. **FE-BE field-name contract violation**: `ThresholdConfig` interface in `web-admin/src/api/smartbi-config.ts:66-77` uses `warningThreshold` / `criticalThreshold` / `direction`; backend entity `SmartBiAlertThreshold` (per response sample) uses `warningValue` / `criticalValue` / `comparisonOperator`. **Rule 17.2 partial-field updateEntity bug at the deserialization layer**.
2. **Partial-body silent re-default**: backend appears to do `repo.save(threshold)` directly with the deserialized partial entity, causing fields not in the request to overwrite stored values with defaults. This corrupts data integrity (LESS_THAN → GT).

Severity: **P0**. Inline-edit threshold from web-admin UI never works; users see "更新成功" but nothing persists; worse, comparisonOperator silently corrupts on every partial update.

#### Phase 3.0 — DataSource list mount
- **PASS** — `GET /api/mobile/smartbi-config/data-sources?page=0&size=10` → 200

#### Phase 3.1 — handleAdd: open dialog → fill → submit (P-3.1 confirmed)
- Form filled: name=`chat1-phaseC-C15832-name`, code=`CHAT1_PHASEC_C15832`, type=DATABASE, description=`Phase C E2E test — C15832`
- Click "确定" → POST `/api/mobile/smartbi-config/data-sources`
- **Wire body shape audit (Rule 11.②)**:
  - Sent keys: `["name","code","type","description","connectionConfig","refreshInterval","isActive"]` — 7 keys, 183 chars
  - Phantom fields: 0 (FE uses `editForm.value` reset, doesn't spread row)
  - Required fields: all present per FE interface
  - **MISSING from FE perspective: `factoryId`** — FE sends nothing related to factory
- **HTTP response**: status 200, but body `{"success":false,"message":"factoryId 必填"}`
- **Console error**: `保存失败: ApiError: factoryId 必填` (caught by interceptor, surfaced in toast — interceptor working as intended)
- **Re-GET**: `?keyword=CHAT1_PHASEC_C15832` returns 0 rows — row never persisted
- **Verdict**: **FAIL — silent failure to user perspective**. UI shows error toast (not silent), but data never reaches DB despite "successful" POST request.

#### Phase 3.1 follow-up (diag T1 + T1b, run DFB34)
- **T1**: POST `?factoryId=F001` query param → **200** + `success=true` + row persisted (`id=33`, factoryId="F001", code="DIAG_DFB34"). ✓
- **T1b**: POST body includes `factoryId: 'F001'` field → **200** + `success=true` + row persisted (`id=34`). ✓
- **Cleanup test**: `DELETE /data-sources/33?factoryId=F001` → 200 + `success=true`. ✓

Conclusion (P-3.1 root cause):
- Backend `SmartBIConfigController.create()` (lines 775-784) requires `factoryId` from query param OR body field.
- FE `createDataSource()` in `smartbi-config.ts:115-117` sends body only, no factoryId in either location.
- JWT contains `factoryId="F001"` — backend could trivially auto-fill from JWT context but does NOT (Rule 17.1 anti-pattern: requires explicit factoryId not auto-resolved from auth context).
- Affects: POST /data-sources (lines 775-784), PUT /data-sources/{id} (lines 794-815), DELETE /data-sources/{id} (lines 816-835). The PUT/DELETE handlers have the same `factoryId 必填` guard.

Severity: **P1**. Affects 100% of DataSource CRUD via web-admin. Latent (not Phase C regression — has been broken for any user trying to use the UI).

#### Phase 3.2/3.3/3.4 — cascade-blocked on 3.1
Cannot exercise via UI without first creating a row through UI. Diag T1/T1b/cleanup confirm backend CRUD works when factoryId is provided.

#### Phase 4.1 — Error path: empty form submit (FE validation)
- Click "新建数据源" → blank form → "确定"
- FE `el-form` triggered `formRules` validation:
  - `请输入数据源名称` (required name)
  - `请输入数据源代码` (required code)
- No API call made (apiHits contains only the original list GET) → **PASS**
- Per Rule 10 (minimum-body API testing): backend was NOT exercised with empty body because FE blocked first. Recommend separate test: bypass FE validation and send `POST /data-sources?factoryId=F001 {}` to confirm backend `@Valid DataSourceDTO` rejects with proper 400 + Rule 8 four-axis. Out of scope chat1.

#### Phase 5.1 — Cross-entry state isolation (Rule 16b smoke)
- DataSourceConfigView dialog has `destroy-on-close` (line 378), per Rule 16 prereq state-leak is structurally impossible.
- Smoke verified anyway: open Add → fill `STALE_DRAFT_NAME` → cancel → re-open Add. Re-opened name input value = `""` (empty). ✓ PASS.
- Note: `handleEdit` does `editForm.value = { ...row }` which spreads the DataSource list-row fields including `createdAt`/`updatedAt`. **Latent risk per Rule 17.4** (FE form spread with phantom fields): if backend opens `FAIL_ON_UNKNOWN_PROPERTIES`, edit submission would 400 due to Jackson reading `createdAt`/`updatedAt` it can't write. Currently masked by lenient Jackson config. Not exercised by this run; flag for sister-chat sweep.

---

## §4 Bug List (6 categories per QA prompt v2.4)

| # | Severity | Category | Title | Status |
|---|---|---|---|---|
| 1 | **P0** | silent-drop bug | SmartBI Threshold inline-edit silently drops `warningThreshold` value AND corrupts `comparisonOperator` (Phase 2.3) | TaskCreate #2 |
| 2 | **P1** | UX bug + business-logic bug | DataSource CRUD 100% broken from web-admin: FE never sends factoryId, BE rejects (Phase 3.1) | TaskCreate #3 |

### Bug detail #1 — P0 P-2.3
- **Category**: silent-drop (v2.4 dedicated category — backend HTTP 2xx + success=true but partial fields not persisted)
- **Reproduction**:
  ```bash
  # See diag-followup.json T2-partial-body-put
  curl -X PUT 'http://139.196.165.140:8097/api/mobile/smartbi-config/thresholds/64b3b98f-f6e5-11f0-955b-00163e35af14' \
       -H "Authorization: Bearer <factory_admin1 token>" \
       -H "Content-Type: application/json" \
       -d '{"warningThreshold":88,"isActive":true}'
  # → 200 {"success":true,"message":"更新成功"}
  curl 'http://139.196.165.140:8097/api/mobile/smartbi-config/thresholds' \
       -H "Authorization: Bearer <token>"
  # → row.warningValue = null (NOT 88)
  # → row.comparisonOperator = "GT"  (was "LESS_THAN" pre-PUT)  ⚠ data corruption
  ```
- **Root cause** (suspected, needs Java service-layer confirmation):
  1. FE `ThresholdConfig` interface field names `warningThreshold` / `criticalThreshold` / `direction` do not match backend `SmartBiAlertThreshold` entity field names `warningValue` / `criticalValue` / `comparisonOperator`. Spring Jackson deserialization silently drops unknown fields.
  2. `SmartBIConfigController.updateThreshold` likely calls `repo.save(threshold)` with the partial deserialized entity; missing fields default-overwrite stored values.
- **Recommended fixes (pick 1 to start, ideally both)**:
  - (A) Rename FE interface field names to match backend (`warningThreshold` → `warningValue`, etc.). Audit all FE callers of `ThresholdConfig`. **Smaller blast radius, but FE-DB direct coupling.**
  - (B) Backend mapper layer: introduce a partial-update mapper that null-guards each field before writing (Rule 17.2 fix template). Plus accept either name via `@JsonAlias({"warningValue","warningThreshold"})` on the entity. **Larger effort but properly isolates wire contract from DB schema.**
- **Sister-sweep**: every config endpoint with a similarly-named entity field. Likely candidates per controller grep:
  - `SmartBiIncentiveRule` (POST/PUT `/incentive-rules`)
  - `SmartBiDictionary` (POST/PUT `/field-mappings`)
  - `SmartBiMetricFormula` (POST/PUT `/metric-formulas`)
  - `SmartBiChartTemplate` (POST/PUT `/chart-templates`)
  - `AiIntentConfig` (POST/PUT `/intents`)

### Bug detail #2 — P1 P-3.1
- **Category**: UX bug (interceptor surfaces error toast, no silent failure to user) + business-logic bug (FE-BE contract gap)
- **Reproduction**:
  ```bash
  curl -X POST 'http://139.196.165.140:8097/api/mobile/smartbi-config/data-sources' \
       -H "Authorization: Bearer <token>" -H "Content-Type: application/json" \
       -d '{"name":"x","code":"X_TEST","type":"DATABASE","isActive":true}'
  # → 200 {"success":false,"message":"factoryId 必填"}
  # Workaround:
  curl -X POST 'http://139.196.165.140:8097/api/mobile/smartbi-config/data-sources?factoryId=F001' \
       -H "Authorization: Bearer <token>" -H "Content-Type: application/json" \
       -d '{"name":"x","code":"X_TEST","type":"DATABASE","isActive":true}'
  # → 200 {"success":true,"data":{...}}
  ```
- **Root cause**: `SmartBIConfigController.java` lines 775-784 (POST), 794-815 (PUT), 816-835 (DELETE) require `factoryId` from `@RequestParam` OR `dto.getFactoryId()`. FE `createDataSource()` / `updateDataSource()` / `deleteDataSource()` in `web-admin/src/api/smartbi-config.ts:115-130` send neither.
- **Recommended fix (pick 1)**:
  - (A) FE: append `?factoryId=${authStore.factoryId}` to all `/smartbi-config/data-sources*` calls. Tiny change, immediate fix. Risk: FE-BE coupling (every config endpoint may need similar treatment).
  - (B) Backend: auto-resolve factoryId from `JwtAuthenticationToken` context when neither query nor body provides it (Rule 17.1 anti-pattern fix). Affects entire SmartBIConfigController surface uniformly. Larger PR but correct.
- **Sister-sweep**: same controller, same `factoryId 必填` pattern in PUT/DELETE handlers (3.2/3.4 cascade-blocked). Test once factoryId fix deployed.
- **Why not caught earlier**: Sub-S audit (PR #271) verified endpoint CODE EXISTS and is referenced. It did not run E2E "FE submits with default body, BE accepts" verification. Premise of "all 41 KEEP" is correct from audit perspective; P-3.1 is a separate FE-BE wiring gap that pre-existed Phase C.

---

## §5 Depth tag honesty (per QA prompt Rule §3 Depth章)

| Step | Depth tag | Justification |
|---|---|---|
| 1.1 mount /smart-bi/upload | medium | observation-level: page renders, no 5xx, API 200. Not deep (no roundtrip on read). |
| 1.2 invalid file upload | error-deep (FE-side) | Rule 8 four-axis verified on FE accept-filter (a/b/c/d ✓). No backend reach to validate four-axis; out of scope. |
| 2.1 threshold list mount | medium | API 200 + render |
| 2.2 list sample | deep | Rule 9 top + middle + last all sampled, business semantics validated |
| 2.3 inline-edit roundtrip | deep | Rule 11 ① (capture body) + ② (shape audit) + ③ (re-GET diff) all performed. Caught silent-drop. |
| 3.0 list mount | medium | API 200 |
| 3.1 handleAdd | deep | Rule 11 ①+②+③. Caught factoryId failure via re-GET diff. |
| 3.2 handleEdit | BLOCKED | cascade. Diag T1 separately confirms backend layer works. |
| 3.3 handleTestConnection | BLOCKED | cascade. |
| 3.4 handleDelete | BLOCKED | cascade. Diag cleanup confirms DELETE works with factoryId. |
| 4.1 empty submit | error-deep | FE form validation tested without backend (correct by design). |
| 5.1 state isolation | medium | Rule 16b smoke — destroy-on-close prereq makes the test informational, not load-bearing. |

**Honest count**: 4 deep + 4 medium + 1 error-deep + 1 PASS-with-caveat (1.2) + 3 BLOCKED. Meets QA prompt `≥ 1 deep + ≥ 1 error-deep` for write-path testing.

---

## §6 Decision: SmartBI write paths verdict

### Phase C dead-method-delete cleanup (Sub-S premise)
**GO** — no observable regression in tested write-path surface. 18-sub-batch jar deployed test 10011 ~12:39 UTC May 10 did not break any endpoint exercised here. The Phase C cleanup correctly limited itself to dead-code orphans without touching Config/Upload controller signatures or behaviors.

### SmartBI write-path overall release readiness
**FIX-required** — 2 pre-existing bugs (P-2.3 P0 + P-3.1 P1) prevent normal customer use of:
- Threshold inline-edit (data silently doesn't save AND corrupts existing data)
- DataSource CRUD (100% broken from UI)

### Recommended next steps for organizer
1. **Open issues** for both bugs (TaskCreate #2 + #3 already filed). Hand off to a fix chat with this report + diag-followup.json + Java controller line refs.
2. **Sister-sweep on Threshold pattern** (Rule 17.2 derivation): grep all `@RequestBody @Valid SmartBi<X>Config` PUT handlers + diff against FE interface field names. P-2.3 root cause (FE/BE field-name divergence) likely affects 4+ other endpoint families.
3. **Sister-sweep on factoryId pattern** (Rule 17.1 derivation): grep all `factoryId` guards in SmartBIConfigController + verify FE callers pass it. Likely affects every CRUD pair in the controller.
4. **Phase C close-out** (Sub-S premise): mark as CLOSED on the cleanup axis (no regression), but add an addendum note: "KEEP audit verifies code existence, NOT FE→BE wiring health. P-2.3 + P-3.1 found via this E2E are pre-existing wiring gaps unrelated to Phase C scope but exposed by it."
5. **Excel upload deep test** still owed: this run only verified page mount + FE accept-filter. A dedicated chat should synthesize a valid SmartBI xlsx, exercise `/F001/smart-bi/upload-and-analyze`, verify 200 + roundtrip, plus the async `/upload` + `pollUploadStatus` + `confirmUploadAndPersist` flow. Out of chat1 budget.

### NOT in scope (per dispatch + QA prompt)
- ⛔ NO prod deploy (test 10011 only)
- ⛔ NO unilateral fix in this chat (report-only)
- ⛔ NO Sub-S re-audit (premise stands; bugs are FE-BE wiring gaps, separate from KEEP/DELETE/STUB axis)

---

## §7 Evidence files

Located at `docs/qa-audits/2026-05-10-phase-c-e2e-chat1-write-paths-evidence/`:
- `run-e2e.mjs` — Phase 0-5 main script (Playwright + MutationObserver + page.on('request'))
- `diag-followup.mjs` — diagnostic script for P-2.3 + P-3.1 root-causing
- `summary.json` — Phase 0-5 raw results
- `diag-followup.json` — diag T1/T1b/T2 raw results
- `phase1-1-upload-page.png`
- `phase1-2-after-invalid-upload.png`
- `phase2-1-config-overview.png`
- `phase3-0-data-sources-list.png`
- `phase3-1-add-dialog-filled.png`
- `phase3-1-add-after-submit.png`
- `phase4-1-empty-submit.png`
- `phase5-reopen-add.png`

---

## §8 QA prompt v2.4 self-audit

Per the 8-condition first-step self-check:
1. **数据来源**: new test rows (RUN_TAG=C15832 + DIAG_DFB34) — true E2E, not seed.
2. **跨模块联动**: scope is single-module (SmartBI Config) — no cross-module assertion attempted (out of dispatch scope).
3. **跨模块回写校验**: N/A (single-module scope).
4. **操作方式**: Playwright Locator API throughout (`fileInput.setInputFiles`, `el-button` text-selector clicks, `.fill()` on inputs). No `evaluate(() => ...click())` shortcuts.
5. **Console 监控**: `page.on('console')` collected 1 error (`保存失败: ApiError: factoryId 必填`) — root-caused as P-3.1.
6. **Network 监控**: `page.on('response')` collected per-phase API hits with method/status/URL. Verified no `/api/mobile/api/mobile/` double-prefix anywhere.
7. **UI 文案核对**: MutationObserver installed once, captured all el-message + el-notification toasts with timestamps + isClosable. Used to validate Rule 8 four-axis on Phase 1.2 + 3.1 + 4.1.
8. **流程依赖错误 UX 检查**: Phase 4.1 covered FE-side validation. Backend-side error UX (P-3.1 surfaces "factoryId 必填" via interceptor — sticky? not measured this run) deferred to fix chat.

**Honest gaps**:
- Phase 1.2 backend-error path NOT exercised (FE accept-filter blocked .txt before backend; need .xlsx with bad SmartBI schema to trigger 400).
- Phase 3.2/3.3/3.4 cascade-blocked at UI level; diag confirms backend works with workaround. UI flow for these entries can only be properly tested AFTER P-3.1 fixed.
- Excel upload happy path NOT exercised (no valid xlsx synth).
- No multi-account / multi-role coverage (factory_admin1 only).

---

**End of chat1 report. Pinging organizer for triage.**
