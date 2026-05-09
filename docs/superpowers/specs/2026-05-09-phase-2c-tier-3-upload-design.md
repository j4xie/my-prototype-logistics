# Phase 2C Tier 3 — `SmartBIUploadController` 13 Endpoints Port Design

**Phase**: 2C Tier 3 (Upload — Excel parse + multipart + SSE batch streaming + history + backfill)
**Status**: Design / planning doc only — kickoff blocked on Phase 2C trigger gates (T6.5 Phase C complete + Tier 1/Tier 2 cutover GO)
**Date**: 2026-05-09
**Predecessor**: PR #152 scoping spec (`docs/superpowers/specs/2026-05-15-phase2b-port-pipeline-scoping-spec.md`)
**Sister docs**:
- `docs/superpowers/specs/2026-05-09-phase-2c-tier-1-config-design.md` (Tier 1 — Config CRUD)
- *Tier 2 — Dashboard design doc — in flight (Chat J)*
- `.claude/rules/python-java-port.md` (Rules 1–12 from Phase 2A)
- `docs/superpowers/specs/2026-05-15-t6-5-java-smartbi-deprecation-spec.md` (KEEP list source)
- `docs/superpowers/specs/2026-05-07-smartbi-migration-runner-spec.md` (schema-change protocol)

> ⚠️ **Naming clarification**: PR #152 file is named `phase2b-port-pipeline-scoping-spec.md`
> but per canonical project naming the **non-analysis** SmartBI port pipeline is **Phase 2C**
> (Phase 2B is reserved for the BGE / classifier / chat-side enablement work that
> already shipped end-Apr/early-May 2026). This doc uses the canonical Phase 2C name
> consistently. Filename references to the predecessor doc retain its original `phase2b`
> prefix to match what is actually checked into the repo. Same convention as Tier 1 spec.

---

## 0. TL;DR

**Scope**: Port the 13 endpoints currently served by `SmartBIUploadController.java`
(`/api/mobile/{factoryId}/smart-bi/*` — note the **hyphen**) to Python
(`backend/python/smartbi_compat/api/upload.py`, currently a 4-line stub),
preserving JSON byte-shape parity (dict-eq gate per Rule 4 Phase 2A standard),
existing frontend contracts, multipart upload semantics, and the SSE progress
streaming protocol. After cutover, Java controller + 7 Java service classes
(8418 LOC combined) deleted (Phase 2C-Tier-3-D cleanup).

**Endpoint inventory** (`/api/mobile/{factoryId}/smart-bi/*` — base path includes `{factoryId}`
PathVariable, distinct from Tier 1's no-factoryId `/api/mobile/smartbi-config/*`):

| Sub-domain | # endpoints | Verb | Java service backing | Python module (proposed) |
|---|---:|:---:|---|---|
| Excel upload | 3 | 3P | `SmartBIUploadFlowService` + `PythonSmartBIClient` (pure proxy) | `upload_excel.py` |
| Sheet listing + batch | 3 | 3P (1 SSE) | `ExcelDynamicParserService.listSheets` + `SmartBIUploadFlowService.executeBatchUpload[WithProgress]` | `upload_sheets.py` |
| Sheet retry | 1 | 1P | `SmartBIUploadFlowService.retrySheetUpload` | `upload_retry.py` |
| Upload history + data preview | 3 | 3G | `SmartBiPgExcelUploadRepository.findUploadHistoryLightweight` + `DynamicAnalysisService.{getFieldDefinitions, getDataPage, getFieldCount}` | `upload_history.py` |
| Field-definition backfill | 3 | 1G + 2P | `DynamicAnalysisService.{backfillFieldDefinitions, batchBackfillFieldDefinitions}` | `upload_backfill.py` |
| **TOTAL** | **13** | **4G / 9P** | 7 distinct Java services + 1 repository | 5 sub-modules |

Endpoint-counts source: `SmartBIUploadController.java` (656 LOC, all 13 endpoints inline).
Service LOC source (porting surface):

| Java service | LOC | Pure-proxy share (see §2) | True port surface |
|---|---:|:---:|:---:|
| `SmartBIUploadFlowServiceImpl` | 2513 | ~30% | ~1750 LOC |
| `ExcelDynamicParserServiceImpl` | 2152 | ~80% (delegates POI to Python) | ~430 LOC |
| `LLMFieldMappingServiceImpl` | 1001 | ~20% | ~800 LOC |
| `DynamicDataPersistenceServiceImpl` | 821 | 0% | 821 LOC |
| `DynamicAnalysisServiceImpl` | 699 | 0% | 699 LOC |
| `SmartBiSchemaServiceImpl` | 342 | 0% | 342 LOC |
| `SmartBiPgExcelUploadRepository` | 117 | 0% | 117 LOC |
| **TOTAL** | **7645** | | **~4960 LOC** |

(Plus `PythonSmartBIClient.java` 1909 LOC — already a Java→Python proxy, becomes obsolete at cutover.)

**Estimated effort**: ~7–10 weeks impl + ~3 weeks dryrun + ~1 week cutover. Detailed in §7.
This is the **highest risk** tier per PR #152 — driven by multipart semantics, SSE
chunk timing, Excel parser fidelity, and the largest Java→Python surface in Phase 2C.

**Hard prerequisites** (will not start before):
1. T6.5 Phase C complete (Java analysis controller files removed, `smartbi_compat/`
   layout settled, no test-vs-prod schema drift).
2. **Tier 1 (Config) cutover GO** — Tier 1 graduates `smartbi_compat/` mid-tier
   conventions used here (e.g. JWT factoryId derivation, asyncpg pool pattern).
3. **Tier 2 (Dashboard) cutover GO** — Tier 2 builds the SSE infra (FastAPI
   `StreamingResponse` with `text/event-stream`, heartbeat, client-disconnect
   handling) reused here for `/upload-batch-stream`.
4. Phase 2A retrospective (PR #151) sign-off.
5. Frontend code-path map snapshot — Web-Admin Vue + RN — operator deliverable.
   Especially: confirm whether any client uses raw multipart-form body byte hash
   (almost certainly not, but blocks strict-byte hybrid decision).

---

## 1. Endpoint inventory (group by sub-domain)

Source of truth: `backend/java/cretas-api/src/main/java/com/cretas/aims/controller/SmartBIUploadController.java`
(unchanged in `origin/main` as of 2026-05-09).

All endpoints share: `BASE = /api/mobile/{factoryId}/smart-bi`. **`{factoryId}` is a
PathVariable**, NOT JWT-derived. (Distinct from Tier 1's JWT-derived factory context.)
Frontend currently passes the same factoryId into both URL and JWT — Python alias
must validate they agree (security-relevant — see §5.1).

### 1.1 Excel upload (3 endpoints) — `BASE/upload*`

| # | Method | Path | Java line | Service / proxy target | Body / params |
|---:|:---:|---|---:|---|---|
| 1 | POST | `/upload` | 110 | `pythonClient.parseExcel()` (pure proxy → Python `/api/smartbi/excel/parse-excel` via `PythonSmartBIClient`) | multipart `file`, query `dataType` `sheetIndex` `headerRow` `transpose` `rowLabelColumn` `headerRowCount` |
| 2 | POST | `/upload-and-analyze` | 171 | `uploadFlowService.executeUploadFlow()` (orchestrator: parse → infer → persist → chart). Large file (>50MB) routes to `pythonClient.parseExcelViaAsync()`. | multipart `file`, query `dataType` `sheetIndex` `headerRow` `auto_confirm` `transpose` `rowLabelColumn` `headerRowCount` `selectedRegionStart` `selectedRegionEnd` (Bug #25b) |
| 3 | POST | `/upload/confirm` | 239 | `uploadFlowService.confirmAndPersist()` (post-mapping confirmation flow) | JSON body: `ConfirmMappingRequest` (`uploadId`, `parseResponse`, `confirmedMappings: Map<String,String>`, `dataType`) |

All 3 carry `@RequirePermission({"analytics:read_write"})` — Python alias must enforce
the same permission gate (see §5.2).

Pre-flight checks shared by all 3:
- `rejectIfTooLarge(file)` — 300MB sanity cap (`MAX_UPLOAD_BYTES`).
- `pythonConfig.isEnabled()` + `pythonClient.isAvailable()` — circuit-breaker check.
  After cutover, the circuit-breaker disappears (Python is the destination, not a
  downstream — the check becomes degenerate `True`).

### 1.2 Sheet listing + batch processing (3 endpoints) — `BASE/sheets`, `BASE/upload-batch*`

| # | Method | Path | Java line | Service backing | Notes |
|---:|:---:|---|---:|---|---|
| 4 | POST | `/sheets` | 283 | `excelParserService.listSheets(InputStream)` — Apache POI scan | Returns `List<SheetInfo>` (sheetIndex, name, rowCount, columnCount, hasContent) |
| 5 | POST | `/upload-batch` | 311 | `uploadFlowService.executeBatchUpload(factory, stream, fileName, configs)` | `sheetConfigs` is JSON-encoded `List<SheetConfig>` in form field; returns `BatchUploadResult` |
| 6 | POST | `/upload-batch-stream` | 367 | `uploadFlowService.executeBatchUploadWithProgress(...)` w/ SSE callback | **SSE — emits `UploadProgressEvent` chunks**; 600s timeout |

`/upload-batch-stream` is the **only SSE endpoint in Tier 3**. SSE chunk
character-identity is required (see §4 + Tier 2's SSE infra reuse).

### 1.3 Sheet retry (1 endpoint) — `BASE/retry-sheet/{uploadId}`

| # | Method | Path | Java line | Service backing |
|---:|:---:|---|---:|---|
| 7 | POST | `/retry-sheet/{uploadId}` | 435 | `uploadFlowService.retrySheetUpload(factoryId, uploadId)` |

Returns `Map<String, Object>` with `uploadId`, `message`, optional `rowCount` + `headers`.
(Inline `HashMap` build — Rule 8 applies: see §4.1.)

### 1.4 Upload history + data preview (3 endpoints) — `BASE/uploads*`

| # | Method | Path | Java line | Service / repo backing | Notes |
|---:|:---:|---|---:|---|---|
| 8 | GET | `/uploads?status=&page=&size=` | 470 | `pgUploadRepository.findUploadHistoryLightweight(factoryId, pageable)` (JPQL projection) | Returns Spring `Page<UploadHistoryDTO>` — page envelope shape parity is **non-trivial** (see §4.4). `status` filter is parsed but ignored in the lightweight path (Java line 480-489 confirms). Default size=50, hard cap=200. |
| 9 | GET | `/uploads/{uploadId}/fields` | 496 | `dynamicAnalysisService.getFieldDefinitions(uploadId)` | `List<FieldDefinitionDTO>` (id, originalName, standardField, dataType, role, ...). |
| 10 | GET | `/uploads/{uploadId}/data?page=&size=` | 518 | `dynamicAnalysisService.getDataPage(factoryId, uploadId, page, size)` + `getFieldDefinitions(uploadId)` | Returns `TableDataResponse` (headers, data rows from `SmartBiDynamicData.rowData` JSONB, total, page, size, totalPages). |

These 3 are **read-only** — no `@RequirePermission` annotation. Permission still
enforced by JWT factoryId match (see §5.1).

### 1.5 Field-definition backfill (3 endpoints) — `BASE/uploads-missing-fields`, `BASE/backfill/*`

| # | Method | Path | Java line | Service backing |
|---:|:---:|---|---:|---|
| 11 | GET | `/uploads-missing-fields` | 564 | Loops `findByFactoryIdOrderByCreatedAtDesc(factoryId)` + `dynamicAnalysisService.getFieldCount(uploadId)` per upload — N+1 query pattern preserved verbatim (see §6 risk R-T3-N+1) |
| 12 | POST | `/backfill/fields/{uploadId}` | 602 | `dynamicAnalysisService.backfillFieldDefinitions(factoryId, uploadId)` |
| 13 | POST | `/backfill/batch?limit=` | 624 | `dynamicAnalysisService.batchBackfillFieldDefinitions(factoryId, limit)`, default limit=100 |

Returns `BackfillResult` / `BatchBackfillResult` — Lombok `@Data` DTOs, Rule 9 applies
(see §4.2).

---

## 2. Existing Python `excel.py` overlap analysis

This is the **single most important section** for sequencing decisions, and the place
where Tier 3 differs most from Tiers 1 & 2.

### 2.1 What's already in Python (NOT a port — already shipped)

| Python file | LOC | Prefix | Purpose | Java equivalent |
|---|---:|---|---|---|
| `backend/python/smartbi/api/excel.py` | 3921 | `/api/excel/*` | 27 endpoints: `/list-sheets`, `/sheets`, `/detect-header`, `/detect-regions`, `/preview`, `/auto-parse`, `/extract-context`, `/export*` (8), `/smart-parse*`, `/raw-export*`, `/analyze-structure`, `/smart-analyze`, `/analyze-workbook`, `/analyze-workbook-stream`, `/uploads` | Ultimate destination of `pythonClient.parseExcel()` (downstream of Java thin proxy) |
| `backend/python/smartbi/api/excel_async.py` | 752 | `/api/smartbi/excel` | 2 endpoints: `/auto-parse-async` (POST 202), `/auto-parse-status/{upload_id}` (GET) | Ultimate destination of `pythonClient.parseExcelViaAsync()` |
| `backend/python/smartbi_compat/api/upload.py` | 4 (stub) | (none yet — will mount at `/api/mobile/{factory_id}/smart-bi`) | Empty placeholder for Tier 3 alias routes | This Tier 3 spec |

**Implication**: Java `/upload`, `/upload-and-analyze`, `/upload-batch`,
`/upload-batch-stream`, `/sheets` (the 5 multipart parse endpoints) are **already**
served by Python — Java is a redundant middleman. The Python implementations have
been production-load-tested for months (Phase B / B MVP work, task #323).

**The "port" task for these 5 endpoints is mostly:**
1. Wire a thin alias router in `smartbi_compat/api/upload.py` mounted at the Java
   path `/api/mobile/{factory_id}/smart-bi/*`.
2. Translate the multipart envelope: Java `MultipartFile file` + form fields →
   FastAPI `UploadFile = File(...)` + `Form(...)`.
3. Replicate Java-side pre-flight checks: 300MB sanity cap, JWT factoryId match,
   `@RequirePermission` gate.
4. **Delegate to existing Python excel.py / excel_async.py functions**, not call
   them via HTTP (in-process function call — saves a network hop).
5. Wrap response in the Java `ApiResponse` envelope (`{success, data, message,
   code}`). Existing `excel.py` mostly already returns this shape — verify each.

This dramatically reduces effort vs. the Tier 1/Tier 2 model where every endpoint
was a fresh port.

### 2.2 What is NOT in Python (real port surface)

The following **8 endpoints** have no Python equivalent — these are the genuine
Java→Python port work:

| # | Java endpoint | Reason no Python equiv | Port destination |
|---:|---|---|---|
| 3 | `/upload/confirm` | Field-mapping confirmation persists via Java `SmartBIUploadFlowService.confirmAndPersist` (calls `DynamicDataPersistenceService` for bulk insert + `LLMFieldMappingService` for adjustment) | `upload_excel.py::confirm_mappings_and_save` — port `confirmAndPersist` (~250 LOC of orchestration + persistence) |
| 7 | `/retry-sheet/{uploadId}` | Java `retrySheetUpload` reads upload row, re-parses original file from `SmartBIFileStorageService`, re-persists | `upload_retry.py` — full port (~150 LOC) |
| 8 | `/uploads` (history) | JPQL projection (`UploadHistoryDTO`) + Spring Page envelope | `upload_history.py::get_upload_history` — asyncpg query + manual Page envelope (see §4.4) |
| 9 | `/uploads/{id}/fields` | `getFieldDefinitions` queries `smart_bi_field_definitions` table | `upload_history.py::get_upload_fields` |
| 10 | `/uploads/{id}/data` | `getDataPage` queries `smart_bi_dynamic_data` JSONB | `upload_history.py::get_upload_data` |
| 11 | `/uploads-missing-fields` | N+1 loop over uploads + per-upload field count | `upload_backfill.py::diagnose_missing_fields` (port verbatim — N+1 preserved per Rule 3 + dict-eq parity. **DO NOT optimize** to single query unless byte-shape allows.) |
| 12 | `/backfill/fields/{id}` | Reads `field_mappings` JSONB on upload row, rebuilds `smart_bi_field_definitions` rows | `upload_backfill.py::backfill_field_definitions` |
| 13 | `/backfill/batch` | Loops uploads with field count = 0, calls backfill per | `upload_backfill.py::batch_backfill` |

These 8 require the bulk of the porting effort. The **DB table set** they touch:
- `smart_bi_pg_excel_uploads` (uploads metadata + JSONB columns)
- `smart_bi_field_definitions` (field schema per upload)
- `smart_bi_dynamic_data` (row data, JSONB)
- `smart_bi_field_mappings` (LLM-suggested mappings cache)

Existing Python `excel.py:3888` `/uploads` lists from the same table but with a
**simpler** projection (no `detectedTableType`, different field aliases) — needs to
extend / fork for parity, NOT replace.

### 2.3 Decision matrix per endpoint

| Endpoint | Strategy |
|---|---|
| `/upload`, `/upload-and-analyze` (sync), `/sheets`, `/upload-batch`, `/upload-batch-stream` | **Alias + delegate** — wire alias, delegate to existing `excel.py` function in-process, wrap envelope |
| `/upload-and-analyze` (large file path) | **Alias + delegate** to `excel_async.py::auto_parse_async`, return `ExcelParseResponse` with async upload_id |
| `/upload/confirm`, `/retry-sheet/{id}`, `/uploads*`, `/uploads-missing-fields`, `/backfill/*` | **Full port** — write new module(s) under `smartbi_compat/api/` per §1 module mapping |

---

## 3. Service dependency map — Java → Python equivalents

| Java service | Method(s) used by Tier 3 | Python equivalent | Port status |
|---|---|---|---|
| `SmartBIUploadFlowService` | `executeUploadFlow`, `confirmAndPersist`, `executeBatchUpload`, `executeBatchUploadWithProgress`, `retrySheetUpload` | (none — to be written) | **Port** ~1750 LOC of true logic. Orchestrator pattern survives, Python uses `async def` instead of `Thread()`. |
| `ExcelDynamicParserService` | `listSheets(InputStream)` | `smartbi.api.excel:list_sheets()` (already at `/api/excel/list-sheets` and `/api/excel/sheets`) — uses `openpyxl` instead of POI | **Already exists**. Verify byte-shape of `SheetInfo` list matches `excel.py` output — likely close, may need field rename / alias in `smartbi_compat/api/upload.py`. |
| `SmartBIUploadFlowService` (large file path) | (calls `pythonClient.parseExcelViaAsync`) | `smartbi.api.excel_async:auto_parse_async` | **Already exists**. |
| `DynamicAnalysisService` | `getFieldDefinitions(uploadId)`, `getDataPage(factoryId, uploadId, page, size)`, `getFieldCount(uploadId)`, `backfillFieldDefinitions(factoryId, uploadId)`, `batchBackfillFieldDefinitions(factoryId, limit)` | (none) | **Full port** — 699 LOC. asyncpg queries on `smart_bi_field_definitions` + `smart_bi_dynamic_data`. |
| `DynamicDataPersistenceService` | called transitively by `confirmAndPersist`, `executeUploadFlow`, `executeBatchUpload` | (none) | **Full port** — 821 LOC. Bulk insert into `smart_bi_dynamic_data` (JSONB row_data column). |
| `LLMFieldMappingService` | called transitively by `executeUploadFlow` (auto-mapping) | (none — partial overlap with `smartbi.services.field` but different prompts) | **Full port** — 1001 LOC. LLM call (DashScope qwen-* via `dashscope_client.py`) + cache write to `smart_bi_field_mappings`. |
| `SmartBiSchemaService` | called transitively (table type recognition for incentive-rules / metric-formulas) | (none) | **Full port** — 342 LOC. Mostly schema constant tables + lookup. |
| `SmartBiPgExcelUploadRepository` | `findUploadHistoryLightweight(factoryId, pageable)`, `findByFactoryIdOrderByCreatedAtDesc(factoryId)`, `getById(id)`, `updateStatus`, `findByFactoryIdAndDetectedTableTypeAndSheetName` | asyncpg `pool.fetch(...)` queries on `smart_bi_pg_excel_uploads` | **Port** — 117 LOC repository spec → ~200 LOC of query helpers in `smartbi_compat/db/uploads.py` (new). |
| `SmartBIFileStorageService` | called by `retrySheetUpload` to fetch original file blob | (none) | **Port** — file blob storage (likely OSS or filesystem) — must stay backward-compatible with files written by Java. **Open Q-T3-1**: confirm storage backend. |

**ChartConfig / FieldMapping / etc. DTOs**: byte-shape parity per Rule 9 (Lombok +
Jackson). Must record golden for each unique DTO emitted by Tier 3 endpoints.

---

## 4. Multipart + SSE handling

### 4.1 Multipart upload (8 of 13 endpoints)

Java side:
```java
@PostMapping(value = "/upload", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
public ResponseEntity<ApiResponse<ExcelParseResponse>> uploadExcel(
        @PathVariable String factoryId,
        @RequestParam("file") MultipartFile file,
        @RequestParam(required = false) String dataType,
        @RequestParam(required = false, defaultValue = "0") Integer sheetIndex,
        ...) { ... }
```

Python equivalent:
```python
from fastapi import APIRouter, File, UploadFile, Form, Path, Depends
from typing import Optional

@router.post("/api/mobile/{factory_id}/smart-bi/upload")
async def upload_excel(
    factory_id: str = Path(...),
    file: UploadFile = File(...),
    data_type: Optional[str] = Form(None),
    sheet_index: int = Form(0),
    header_row: int = Form(0),
    transpose: bool = Form(False),
    row_label_column: int = Form(0),
    header_row_count: int = Form(1),
    _user: dict = Depends(verify_jwt_factory_match),  # see §5.1
    _perm: None = Depends(require_permission("analytics:read_write")),  # see §5.2
) -> dict:
    # 1) Pre-flight: 300MB cap (see §5.3)
    if file.size and file.size > MAX_UPLOAD_BYTES:
        return _too_large_response(file.size)
    # 2) Delegate to existing excel.py
    from smartbi.api.excel import _parse_excel_internal
    result = await _parse_excel_internal(file, factory_id, data_type, sheet_index, header_row + 1)
    if not result.success:
        return {"success": False, "data": None, "message": f"Excel parse failed: {result.error_message}"}
    return {"success": True, "data": result.dict(), "message": "Excel parsed successfully"}
```

**Critical multipart parity points** (graduate to Tier 3 spec, not Phase 2A rule yet):

- **Form-field naming**: Java `@RequestParam("auto_confirm")` (snake_case) — Python
  must use `auto_confirm: bool = Form(...)`, NOT `autoConfirm`. Existing client
  contract is snake_case for form fields and camelCase for JSON body fields. Verify
  per endpoint via grep on Java `@RequestParam(name = "...")`.
- **Default values**: Java `defaultValue = "0"` for `Integer` → Python `Form(0)`. For
  `Boolean` `defaultValue = "false"` → `Form(False)`. Type coercion via FastAPI is
  identical to Spring's behavior in all observed cases.
- **`headerRow` off-by-one**: Java line 142-148 — if `headerRow == null || < 0`,
  `headerRows = 0` (Python auto-detect); else `headerRows = headerRow + 1`. **Mirror
  this verbatim** — frontend may rely on this convention.
- **`Map<String,Object>` HashMap inline returns** (e.g. `/retry-sheet/{uploadId}`
  line 451-457): Java uses `new HashMap<>()` then `.put(...)` calls — Jackson emits
  HashMap iteration order which is **insertion-stable in Java 8+ for `LinkedHashMap`
  but `HashMap` is hash-bucket order.** Java line 451 uses raw `HashMap` — Rule 8
  applies. Record golden for retry-sheet response, mirror order in Python dict
  literal.

**Streaming large files**: Java loads `file.getInputStream()` and passes it to
`uploadFlowService`. Python `UploadFile.file` exposes a `SpooledTemporaryFile` —
spool-to-disk threshold default 1MB. For files >50MB the existing Python async path
(`excel_async.py::auto_parse_async`) already handles streaming chunked write — reuse
that for the large-file branch.

### 4.2 SSE — `/upload-batch-stream` (1 endpoint)

Java side (line 367-430):
```java
@PostMapping(value = "/upload-batch-stream",
             produces = MediaType.TEXT_EVENT_STREAM_VALUE)
public SseEmitter uploadBatchStream(...) {
    SseEmitter emitter = new SseEmitter(600000L);  // 10 min timeout
    new Thread(() -> {
        try {
            ...
            uploadFlowService.executeBatchUploadWithProgress(
                factoryId, file.getInputStream(), file.getOriginalFilename(), configs,
                event -> sendEvent(emitter, event));  // callback per progress event
            sendEvent(emitter, UploadProgressEvent.complete(result));
            emitter.complete();
        } catch (Exception e) {
            sendEvent(emitter, UploadProgressEvent.error(...));
        }
    }, "upload-stream-...").start();
    return emitter;
}

private void sendEvent(SseEmitter emitter, UploadProgressEvent event) {
    emitter.send(SseEmitter.event()
        .name(event.getType().name().toLowerCase())   // e.g. "progress" / "complete" / "error"
        .data(event, MediaType.APPLICATION_JSON));     // JSON body
}
```

Wire format Spring emits:
```
event: progress
data: {"type":"PROGRESS","sheetIndex":0,"sheetName":"Sheet1","progress":45,...}

event: complete
data: {"type":"COMPLETE","result":{...}}
```

Python equivalent (FastAPI `StreamingResponse` — pattern reused from existing
`smartbi/api/excel.py::analyze_workbook_stream` line 3817):
```python
from fastapi.responses import StreamingResponse
import json

@router.post("/api/mobile/{factory_id}/smart-bi/upload-batch-stream")
async def upload_batch_stream(
    factory_id: str = Path(...),
    file: UploadFile = File(...),
    sheet_configs: str = Form(..., alias="sheetConfigs"),
    _user: dict = Depends(verify_jwt_factory_match),
    _perm: None = Depends(require_permission("analytics:read_write")),
):
    async def event_generator():
        # 1) Pre-flight: size + service availability (mirror Java line 381-396)
        # 2) Parse sheetConfigs JSON
        # 3) Iterate batch, yield events per progress callback
        async for event in _execute_batch_with_progress(factory_id, file, configs):
            event_type = event["type"].lower()  # "progress" / "complete" / "error"
            payload = json.dumps(event, ensure_ascii=False, default=str)
            yield f"event: {event_type}\ndata: {payload}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",  # critical: defeat nginx buffering
        }
    )
```

**SSE byte-shape parity points** (strict-byte recommended per PR #152 §3, Tier 2's
SSE infra inherits these):

- **Event name lowercase**: Java `.name(event.getType().name().toLowerCase())` —
  enum `PROGRESS` → wire `progress`. Python: `event["type"].lower()`.
- **Wire framing**: `event: <name>\ndata: <json>\n\n` — exactly two `\n` after
  `data:`, exactly one between `event:` and `data:`. **NO `id:` line, NO `retry:`
  line** — Java's `SseEmitter` doesn't emit them.
- **JSON body**: emitted via `Map<String,Object>` Jackson serialize — Rule 8 + Rule
  9 apply per event payload class (`UploadProgressEvent` is a Lombok DTO).
- **Heartbeat**: Java `SseEmitter` does NOT emit heartbeat by default — Python
  `StreamingResponse` should match (no comment-line `: keepalive\n\n` injection
  unless behind nginx with default 60s timeout, in which case verify nginx config
  matches Java path's existing setup).
- **Disconnect handling**: Java `emitter.onError(...)`, `emitter.onCompletion(...)`,
  `emitter.onTimeout(...)` — Python uses `request.is_disconnected()` polling inside
  generator OR rely on FastAPI's auto-cancellation when client drops. **Open Q-T3-2**:
  Tier 2's SSE infra spec needs to nail this contract first.
- **Threading model differs**: Java spawns a `new Thread(...)`, runs sync
  `uploadFlowService.executeBatchUploadWithProgress` (callback-based). Python uses
  `async def event_generator()` with `await` per progress yield. The progress
  callback must adapt: Java synchronous callback → Python `asyncio.Queue` + `await
  queue.get()` consumer pattern. Reference: `excel.py:analyze_workbook_stream` line
  3817-3886.

### 4.3 `ApiResponse` envelope wrapping

Java endpoints return `ResponseEntity<ApiResponse<T>>`. Python alias must wrap every
response in:
```python
{"success": bool, "data": Any, "message": str, "code": Optional[str]}
```

Existing `excel.py` endpoints mostly DO return this shape (verified at line 3888-3921
for `/uploads`). For endpoints that return raw model instances (e.g.
`SheetNamesResponse` at `excel.py:300`), the Python alias wrapper extracts the model
and re-wraps:
```python
result = await _list_sheets_internal(file)
return {"success": True, "data": result.dict(), "message": "Success"}
```

Error path mirroring (Java line 152-167):
```python
try:
    result = ...
except PythonServiceUnavailableException:  # Java circuit-breaker exception
    # No Python equivalent post-cutover — circuit-breaker disappears
    pass
except IOError as e:
    return {"success": False, "data": None, "message": f"File read failed: {_sanitize(e)}"}
except Exception as e:
    log.error(f"Excel parse error: {e}", exc_info=True)
    return {"success": False, "data": None, "message": f"Parse failed: {_sanitize(e)}"}
```

`ErrorSanitizer.sanitize(e)` Java side strips stack traces, secrets, file paths.
Python equivalent helper (~30 LOC) needed in `smartbi_compat/_java_compat.py` —
mirror the Java logic verbatim because error message strings are user-visible.

### 4.4 Spring `Page<T>` envelope parity

Java `/uploads` returns `org.springframework.data.domain.Page<UploadHistoryDTO>` —
Jackson serializes Spring's `PageImpl` with this shape:
```json
{
  "content": [...],
  "pageable": {
    "pageNumber": 0, "pageSize": 50, "sort": {"empty": true, "sorted": false, "unsorted": true},
    "offset": 0, "paged": true, "unpaged": false
  },
  "last": true, "totalElements": 12, "totalPages": 1,
  "size": 50, "number": 0,
  "sort": {"empty": true, "sorted": false, "unsorted": true},
  "first": true, "numberOfElements": 12, "empty": false
}
```

Python must emit this **exact** envelope (Rule 8/9 don't cover Spring-specific
serialization quirks — graduate to Tier 3 spec). Helper:
```python
def spring_page_envelope(content: list, page: int, size: int, total: int) -> dict:
    total_pages = (total + size - 1) // size if size > 0 else 0
    return {
        "content": content,
        "pageable": {
            "pageNumber": page, "pageSize": size,
            "sort": {"empty": True, "sorted": False, "unsorted": True},
            "offset": page * size, "paged": True, "unpaged": False,
        },
        "last": page >= total_pages - 1,
        "totalElements": total,
        "totalPages": total_pages,
        "size": size,
        "number": page,
        "sort": {"empty": True, "sorted": False, "unsorted": True},
        "first": page == 0,
        "numberOfElements": len(content),
        "empty": len(content) == 0,
    }
```

**Open Q-T3-3**: Frontend likely accesses only `.content`, `.totalElements`,
`.totalPages` — but verify before relaxing strict envelope. Tier 1 Config endpoints
do NOT return Page envelopes (they return plain lists), so this is a Tier 3-novel
requirement.

---

## 5. Cross-cutting concerns

### 5.1 Multi-factory routing — `{factoryId}` PathVariable + JWT

**This is the security-critical difference vs. Tier 1.** Tier 1's
`/api/mobile/smartbi-config/*` derives factoryId from JWT only. Tier 3's
`/api/mobile/{factoryId}/smart-bi/*` has factoryId in BOTH the URL path AND the JWT.
Currently the Java controller TRUSTS the URL value (no cross-check).

Python alias must **enforce JWT factoryId === URL factoryId** to prevent a tenant-A
user from uploading to tenant-B namespace via crafted URL. Open Q-T3-4 below.

```python
async def verify_jwt_factory_match(
    factory_id: str = Path(..., alias="factory_id"),
    auth_header: str = Header(..., alias="Authorization"),
) -> dict:
    user = decode_jwt(auth_header)  # existing helper
    if user["factoryId"] != factory_id:
        raise HTTPException(403, "Factory ID mismatch between URL and JWT")
    return user
```

### 5.2 `@RequirePermission` → Python permission gate

Java `@RequirePermission({"analytics:read_write"})` is enforced by an aspect that
checks the JWT user's `permissions` claim. 9 of 13 endpoints carry this annotation
(all writes). Python alias must implement the same gate as a FastAPI dependency:
```python
def require_permission(permission: str):
    async def _check(user: dict = Depends(verify_jwt_factory_match)) -> None:
        if permission not in user.get("permissions", []):
            raise HTTPException(403, f"Missing permission: {permission}")
    return _check
```

Existing Tier 1 implementation builds this helper — reuse in Tier 3.

### 5.3 300MB upload sanity cap

Java `MAX_UPLOAD_BYTES = 300L * 1024 * 1024`. Python:
```python
MAX_UPLOAD_BYTES = 300 * 1024 * 1024

def _too_large_response(size: int) -> dict:
    mb = size / 1024 / 1024
    limit_mb = MAX_UPLOAD_BYTES // 1024 // 1024
    return {
        "success": False, "data": None,
        "message": f"文件过大 ({mb:.2f} MB)，AI 分析仅支持 {limit_mb} MB 以内的文件。建议按月/按门店拆分后上传。",
    }
```

Note: error string includes Chinese characters, includes `.2f` formatting via Java
`String.format("%.2f MB", mb)` — Rule 12 applies (HALF_UP vs banker's). Python
`f"{mb:.2f}"` is banker's. Use:
```python
from decimal import Decimal, ROUND_HALF_UP
mb_dec = Decimal(str(size)) / Decimal("1048576")
mb_str = mb_dec.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
return f"{mb_str} MB"  # or use _format_decimal_half_up helper
```
For values that won't round at the .005 boundary in practice this is moot, but
follow the rule defensively.

### 5.4 `pythonConfig.isEnabled()` + `pythonClient.isAvailable()` — degenerate post-cutover

Java pre-flight checks 4 endpoints — these become degenerate `True` after cutover
(Python is the destination, no longer downstream). Remove the check from Python alias
entirely; document in Phase 2C-Tier-3-D cleanup that Java also drops it.

### 5.5 Deferred: `SmartBIFileStorageService` (file blob storage)

Java `retrySheetUpload` reads the original Excel blob from `SmartBIFileStorageService`.
Storage backend (OSS / filesystem) and key naming convention NOT YET CONFIRMED — see
Q-T3-1 below.

---

## 6. Phase 2C Tier 3 phases A–D

Following the established Phase 2A T-pattern (T6.0 design → T6.1 dryrun → T6.2 canary
→ T6.3 wider → T6.4 full cutover), adapted for Phase 2C:

| Phase | Goal | Duration (est.) | Gate to next |
|---|---|---:|---|
| **A. Spec design** (this doc) | Endpoint inventory, per-endpoint port strategy, risk register, open questions answered | 1 wk | Reviewer sign-off + open Q answers |
| **B. Impl** | 5 sub-modules + DB query helpers + permission + JWT helpers; reuses Tier 1/Tier 2 infra (JWT, permission gate, SSE infra) | 7–10 wks | All endpoints respond, mock-driven test suite green per `python-java-port.md` Rule 8/9 golden mirror |
| **C. Dryrun** | Sidecar mode — both Java + Python receive every request, compare bodies; multipart + SSE chunk parity must hit ≥99% (dict-eq) and 100% (strict-byte SSE chunks per Tier 2 hybrid recommendation) | 3 wks | Match rate gate + 24h soak |
| **D. Cutover + cleanup** | Stage 1: nginx routes 1 factory to Python; Stage 2: 3 factories; Stage 3: all factories. Then delete Java controller + 7 service classes + `PythonSmartBIClient` (1909 LOC) | 1 wk | Full traffic on Python, Java sunset complete |

**Total Phase 2C Tier 3**: ~12–15 weeks elapsed.

### 6.1 Per-phase risks (deferred to §8)

### 6.2 Coordination model

Tier 3 is heavier than Tiers 1 & 2 — recommend **3-chat parallel coordination**
(per Phase 2A learnings + memory `feedback_organizer_dispatch_not_handson.md`):
- Chat A: orchestrator-side ports (`SmartBIUploadFlowService` + `confirm` + retry)
- Chat B: data layer (`DynamicAnalysisService` + `DynamicDataPersistenceService` +
  `SmartBiPgExcelUploadRepository` queries)
- Chat C: SSE / multipart / envelope helpers + 5 alias-and-delegate endpoints

Organizer dispatches per-PR marching orders, admin-merges. Chats stay in worktrees
per `concurrent-edit-safety.md`.

---

## 7. Estimated effort (granular)

| Item | LOC est. | Effort (1 dev) | Notes |
|---|---:|---:|---|
| `SmartBIUploadFlowService` port (orchestrator + executeUploadFlow + executeBatchUpload + executeBatchUploadWithProgress + confirmAndPersist + retrySheetUpload) | 1500 | 4 wks | Largest single port, async/await rewrite of sync orchestrator |
| `DynamicAnalysisService` port | 600 | 2 wks | Straightforward asyncpg queries + JPQL→raw SQL translation |
| `DynamicDataPersistenceService` port | 700 | 2 wks | Bulk insert into JSONB; benchmark vs Java Hibernate batch insert (target: ≤2× wall time) |
| `LLMFieldMappingService` port | 800 | 2 wks | LLM call + cache; reuses `dashscope_client.py` |
| `SmartBiSchemaService` port | 250 | 0.5 wks | Mostly schema constants |
| `SmartBiPgExcelUploadRepository` queries → asyncpg helpers | 200 | 0.5 wks | 13 query methods |
| `SmartBIFileStorageService` port | 100 | 0.5 wks | Pending Q-T3-1 backend confirmation |
| 5 alias-and-delegate endpoints (`/upload`, `/upload-and-analyze` sync+async, `/sheets`, `/upload-batch`, `/upload-batch-stream`) | 600 | 2 wks | Thin wrappers; SSE adaptation is the hardest |
| 8 fully ported endpoints | 800 | 2 wks | Wires `confirm`, `retry`, history (3), backfill (3) |
| `_java_compat.py` helpers (envelope, ErrorSanitizer, Page envelope, decimal HALF_UP) | 200 | 0.5 wks | Shared across Tiers 1/2/3 |
| Mock-driven test suite (~80 tests) | 1500 | 2.5 wks | Per Rule 8/9 golden recording |
| F999/F001 dryrun + diff harness | — | 3 wks | Tier 1/2 harness reused, multipart + SSE adapters added |
| Cutover + cleanup | — | 1 wk | nginx config + Java deletion |
| **TOTAL impl + dryrun + cutover** | **~7250** | **~22 wks** | Wall-time with 3-chat parallelism: ~12–15 wks |

(Java→Python port LOC ratio observed in Phase 2A: ~0.85× — Python typically
shorter due to async syntax + dict literals replacing DTO classes.)

---

## 8. Risk register

| ID | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| **R-T3-multipart** | Multipart form-field naming / type-coercion divergence between Spring and FastAPI causes silent client breakage | Med | High | Per-endpoint grep on Java `@RequestParam(name=...)` + per-endpoint integration test exercising real multipart payload from frontend code paths (operator deliverable) |
| **R-T3-sse-chunk** | SSE chunk byte-shape diverges (event name case, `data:` framing, JSON Map.of order) breaking client SSE parser | Med | High | Strict-byte gate per PR #152; record raw SSE byte stream in dryrun; reuse Tier 2 infra after Tier 2 ships |
| **R-T3-large-file** | 50MB+ files: existing `excel_async.py` shipped, but Java's >50MB branch routes to `parseExcelViaAsync` w/ different shape than sync path. Frontend code path may differ. | Med | High | Frontend code-path map (operator deliverable) + dryrun exercises both branches at boundary (49.9MB / 50.1MB / 251MB) |
| **R-T3-N+1** | `/uploads-missing-fields` does N+1 queries (one per upload). Python port preserves verbatim — slow at scale (factory with 1000 uploads = 1001 queries) | High | Med | Preserve Java behavior for parity; file Phase 3 follow-up `single CTE` optimization. Parity > performance during Phase 2C. Document in cleanup notes. |
| **R-T3-page-envelope** | Spring `PageImpl` envelope shape (16 fields incl. nested `pageable.sort`) — easy to miss `numberOfElements`, `empty`, `first`, `last` | High | Med | Helper `spring_page_envelope()` + golden record from Java per endpoint emitting Page |
| **R-T3-storage-blob** | `SmartBIFileStorageService` backend (OSS or filesystem) not confirmed — `retrySheetUpload` cannot port until decided | Low | High | Resolve via Q-T3-1 pre-impl |
| **R-T3-jwt-mismatch** | Java does NOT verify URL factoryId matches JWT factoryId → cross-tenant exposure latent. Python introduces verification — may break clients that send wrong factoryId in URL but correct in JWT (or vice versa) | Med | Med | Frontend code-path audit; if any client relies on mismatch, propose deprecation period before enforcement |
| **R-T3-permission-gate** | 9 of 13 endpoints have `@RequirePermission({"analytics:read_write"})` — Python implementation must match Java aspect's permission resolution exactly (role + permissions claim path) | Low | High | Reuse Tier 1's `require_permission` helper (proven). Audit Tier 1 impl for resolution path. |
| **R-T3-decimal-format** | `_too_large_response()` formats MB with `.2f` → Rule 12 banker's vs HALF_UP. Likely benign but not always. | Low | Low | Use `_format_decimal_half_up` helper from Phase 2A |
| **R-T3-bug25b** | `selectedRegionStart`/`selectedRegionEnd` (Bug #25b multi-stacked-table bounds) — Java line 184-185 — Python `excel.py` may not yet honor these | Med | Med | Verify `excel.py` accepts + applies these params; if not, add support before Tier 3 cutover |
| **R-T3-circuit-breaker** | Java `PythonServiceUnavailableException` handling shows users a localized "AI 分析服务正在自动恢复中" message — disappears post-cutover. Frontend may show generic 500 instead. | Low | Low | Document removal; frontend can keep showing the localized text on connection-refused |
| **R-T3-shared-state** | Tier 3 ports `LLMFieldMappingService` cache table `smart_bi_field_mappings` — must validate read-after-write parity if Java + Python both touch table during dryrun (sidecar) | Med | Med | Disable Python writes during sidecar dryrun; switch to writes only at cutover Stage 1 |
| **R-T3-async-thread-model** | Java uses `new Thread(...)` for SSE; Python `async def` generator. Backpressure / cancellation semantics differ. | Med | Med | Match Tier 2's SSE infra contract; 24h soak load test reveals leaks |

---

## 9. Open questions (Q-T3-N — for reviewer to resolve before Tier 3 kickoff)

1. **Q-T3-1 — Storage backend for original Excel blob**: `SmartBIFileStorageService`
   backend is OSS or filesystem? Where does Java currently write? Confirm key naming
   convention so Python can read Java-written blobs during sidecar dryrun and post-
   cutover. **Owner**: ops/backend lead. **Blocks**: `/retry-sheet/{uploadId}` port.

2. **Q-T3-2 — SSE chunk strict-byte enforcement**: PR #152 §3 recommends strict-byte
   for SSE chunks. Is the existing client (Web-Admin Vue + RN) tolerant of trailing-
   whitespace / event-name case / `Cache-Control` header differences, or does it
   parse char-strict? **Owner**: frontend lead. **Blocks**: SSE parity gate
   threshold in dryrun (99% dict-eq vs 100% strict-byte).

3. **Q-T3-3 — Spring `Page<T>` envelope strictness**: Does the frontend access
   beyond `.content`, `.totalElements`, `.totalPages`? If not, can Python emit a
   reduced envelope without `pageable.sort.empty` / `numberOfElements` / `empty`?
   **Owner**: frontend lead. **Blocks**: ~30 LOC helper complexity.

4. **Q-T3-4 — JWT factoryId vs URL factoryId enforcement**: Currently Java trusts
   URL value. Python should enforce match (security improvement). Will any client
   break? Acceptable to deprecate URL-vs-JWT-mismatch with a 2-week warning log
   before enforcement? **Owner**: security + frontend leads. **Blocks**: nothing
   (default: enforce immediately).

5. **Q-T3-5 — `excel.py` `/uploads` endpoint vs Tier 3 `/uploads`**: Existing
   `excel.py:3888` `/uploads` is at `/api/excel/uploads` with simpler shape. Should
   Tier 3 alias replace it (then both paths serve the Tier 3 envelope), or fork
   them? **Owner**: ops/PM. **Blocks**: client migration cleanup.

6. **Q-T3-6 — Bulk insert backend choice**: `DynamicDataPersistenceService` writes
   thousands of rows per upload. Use asyncpg `copy_records_to_table` (fastest,
   binary protocol), `executemany` (slower but more portable), or batched
   `INSERT ... VALUES (...)` SQL string? **Owner**: backend tech lead. **Default
   recommendation**: `copy_records_to_table` for ≥100 rows.

7. **Q-T3-7 — Phase 2C Tier 4 (PublicDemo) sequencing relative to Tier 3**: If
   Tier 4 sunsets per PR #152 recommendation, can Tier 3 cutover proceed without
   waiting? **Owner**: PM. **Likely answer**: yes, independent.

8. **Q-T3-8 — Java service deletion blast radius**: 7 service Impls + interfaces +
   PythonSmartBIClient (1909 LOC) + DTOs (~30 classes) = ~10000 LOC removal in
   Phase 2C-Tier-3-D. Verify no Phase 2A-residual or Tier 1/Tier 2 dependencies
   remain. **Owner**: this Tier 3 spec doc reviewer + T6.5 cleanup spec author.

---

## 10. Phase 2A learnings applied (12 codified rules)

| Rule | Tier 3 applicability |
|---|---|
| Rule 1 (Null fallback `is not None`) | High — multipart form fields with optional defaults; JSONB row_data dict.get patterns in `getDataPage`. |
| Rule 2 (WEEK calendar year) | Low — no week-grouping in Tier 3. |
| Rule 3 (function signature 1:1 mirror) | High — service ports must mirror Java method signatures. |
| Rule 4 (`_decimal_to_number` serialization) | Med — `BackfillResult` may emit numeric stats. |
| Rule 5 (`SELECT *` for shared helpers) | Med — `_query_uploads(...)` shared between history + diagnose. |
| Rule 6 (None-check rejecting silent zero) | High — pagination `(page, size)` validation; `factoryId is not None`. |
| Rule 7 (Decimal threshold) | Low — no float thresholds in Tier 3. |
| Rule 8 (Map.of key order) | High — `/retry-sheet` HashMap inline return + SSE event payload. |
| Rule 9 (Lombok + Jackson quirks) | High — `BackfillResult`, `BatchBackfillResult`, `UploadHistoryDTO`, `TableDataResponse`, `UploadProgressEvent`, `SheetInfo`, `FieldDefinitionDTO` all Lombok DTOs. |
| Rule 10 (BigDecimal divide-multiply intermediate round) | Low — no percentage calc in Tier 3. |
| Rule 11 (LocalDateTime trailing-zero microsecond) | High — `createdAt` / `updatedAt` in 5+ DTOs; use `_java_isoformat` helper from `schema_compat.py`. |
| Rule 12 (`String.format` HALF_UP vs banker's) | Med — `_too_large_response()` MB format; defensive use of `_format_decimal_half_up`. |

---

## 11. Out of scope (for Tier 3 — deferred or sunset)

- **N+1 query optimization on `/uploads-missing-fields`** — preserve Java behavior
  for parity; Phase 3 follow-up.
- **`PythonSmartBIClient` (Java) cleanup** — happens in Phase 2C-Tier-3-D once all
  Tiers 1/2/3 cut over.
- **`SmartBIFileStorageService` rearchitect to S3-compatible** — keep current
  backend for Phase 2C; Phase 3+ improvement.
- **Frontend migration to `/api/smartbi/excel/*` direct paths** — frontend keeps
  calling `/api/mobile/{factoryId}/smart-bi/*`; nginx routes the alias to Python.
  Frontend zero-change cutover is the explicit Tier 3 goal.
- **Excel parser engine swap** — keep `openpyxl`-based Python implementation;
  performance benchmarking is Tier 3 Phase B exit criterion not a port goal.
- **Tier 4 (PublicDemo) sunset/port decision** — separate spec.

---

## 12. GO criteria — Tier 3 readiness summary

- **Tier 3 kickoff**: Tier 1 + Tier 2 cutover GO + open Q-T3-1 through Q-T3-8
  answered + frontend code-path map snapshot.
- **Tier 3 Phase B exit**: All 13 endpoints respond with `ApiResponse` envelope +
  permission gate enforced + SSE chunk passes Tier 2's framing test + bulk insert
  benchmark ≤ 2× Java wall time.
- **Tier 3 Phase C exit (dryrun GO)**: ≥99% dict-eq match rate (per Phase 2A
  standard) + 100% strict-byte match on SSE chunks (per Tier 2 hybrid) + 24h soak
  with 0 5xx + multipart upload latency p95 ≤ 1.5× Java baseline.
- **Tier 3 Phase D exit (cutover complete)**: All factories on Python + 24h
  post-cutover soak clean + Java controller + 7 service Impls + `PythonSmartBIClient`
  deleted + nginx config simplified.
- **Phase 2C Tier 3 retrospective**: Document any new rules graduated (likely
  candidates: SSE chunk parity rule, Spring `Page<T>` envelope rule, multipart
  form-field naming rule).

---

## 13. References

- PR #152 scoping spec — Tier 3 row in §0 endpoint table; §3 strict-byte hybrid
  recommendation for SSE chunks.
- `docs/superpowers/specs/2026-05-09-phase-2c-tier-1-config-design.md` — sister Tier
  1 spec; convention reuse (naming clarification block, §0 TL;DR table format,
  Phase A-D sequencing).
- `docs/superpowers/specs/2026-05-15-t6-5-java-smartbi-deprecation-spec.md` — KEEP
  list source.
- `.claude/rules/python-java-port.md` — 12 codified Phase 2A learnings.
- Memory `reference_smartbi_gold_layer_architecture.md` — task #24 KEEP rationale.
- Memory `feedback_narrow_scope_fix_sister_site_sweep.md` — sister-site audit
  pattern for the 3-chat coordination model in §6.2.
- `backend/python/smartbi/api/excel.py` (3921 LOC) — existing implementation that
  Tier 3 alias delegates to for 5 of 13 endpoints.
- `backend/python/smartbi/api/excel_async.py` (752 LOC) — large-file async path.
- `backend/java/cretas-api/src/main/java/com/cretas/aims/controller/SmartBIUploadController.java`
  (656 LOC) — single source of truth for endpoint inventory.
- `backend/java/cretas-api/src/main/java/com/cretas/aims/service/smartbi/impl/`
  (8418 LOC across 7 Impls) — porting surface.
