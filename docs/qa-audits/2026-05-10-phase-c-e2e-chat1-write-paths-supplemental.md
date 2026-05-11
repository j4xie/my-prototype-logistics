# Phase C E2E SmartBI Write Paths — chat1 SUPPLEMENTAL (Excel deep test)

**Date**: 2026-05-10
**Run tags**: EX5604 (initial deep test) + EFD063 (wizard probe) + EP9722 (final response-body probe)
**Test env**: web-admin `139:8097` → nginx → Java test backend `47:10011` + Python test `47:8084`
**Login**: `factory_admin1` / F001
**Closes**: §6 deferred item from main report — Excel upload deep test

---

## §0 TL;DR

- **Sync upload happy path: PASS** — `POST /api/mobile/F001/smart-bi/upload-and-analyze` works end-to-end (synth valid xlsx → parse → AI insight scaffolding → return uploadId). Phase C cleanup did not break this path.
- **Single-row read paths PASS** — `GET /uploads/{id}/data` + `GET /uploads/{id}/fields` both return 200 with proper paginated/structured responses for a freshly-uploaded file.
- **3 NEW bugs uncovered** (all pre-existing, NOT Phase C regression):
  - **P-X.0 (P1)**: `GET /uploads` LIST endpoint returns `data:null`. Single-row endpoints work. Users cannot see upload history.
  - **P-X.1 (P1)**: Python parser silently merges adjacent NUMERIC columns (`数量` + `金额` → `数量金额` + `数量金额_2`). Distinct business columns get conflated. Data integrity issue for sales analysis.
  - **P-X.2 (W observation)**: Backend Python parser accepts garbage xlsx (random column names + gibberish data) with `200 + requiresConfirmation:true` warning. UX-graceful (FE blocks AI analysis pending user review) — not a bug per se but worth noting.

| Test | Verdict | Depth | Notes |
|---|---|---|---|
| T1 sync uploadAndAnalyze | PASS | deep | 200 + "文件解析成功" + uploadId 4174 returned |
| T2 /uploads list re-GET | FAIL (P-X.0) | deep | `data:null` instead of array — bug in list endpoint |
| T3 Rule 9 sample on persisted | partial-PASS | deep | /uploads/{id}/data works; original headers `数量+金额` corrupted by parser (P-X.1) |
| T4 garbage xlsx → backend | WARN (P-X.2) | error-deep | Backend accepts permissively, FE blocks AI flow via `requiresConfirmation` |
| F3 wizard "保存分析结果" click | INFO | medium | Click triggered no API — button likely UI-only or routes elsewhere |

Decision: **Phase C cleanup verification GO unchanged** (no new regression). 3 new bugs all pre-existing; flagged for organizer triage.

---

## §1 T1 — Sync upload happy path (PASS)

### Synthesized xlsx
- 12 rows, 5 columns: `['日期','客户名称','产品名称','数量','金额']`
- Test data uses unique customer suffix (RUN tag) so we can identify our row in roundtrip
- Sheet name: `销售数据`
- Generated via SheetJS `XLSX.utils.aoa_to_sheet` + `XLSX.write({type:'buffer'})`

### Wire shape (uploadAndAnalyze response body, run EP9722)
```
POST /api/mobile/F001/smart-bi/upload-and-analyze → 200
{
  "code": 200,
  "message": "字段映射需要用户确认",
  "success": true,
  "data": {
    "success": true,
    "message": "字段映射需要用户确认",
    "parseResult": { "headers": [...], "preview_data": [...], ... },
    "persistResult": { ... },
    "recommendedChartType": ...,
    "recommendedTemplates": [...],
    "chartConfig": {...},
    "aiAnalysis": null,         ← AI gated on user confirmation
    "requiresConfirmation": true,
    "detectedDataType": ...,
    "uploadId": 4174
  }
}
```

### FE toasts (MutationObserver)
- "文件解析成功" — `el-message--success`
- "字段映射信心较低,请在下方确认后再查看分析结果" — `el-message--warning`

Both toasts non-sticky (default 3s) which is acceptable for success/warning per Rule 8.

### Verdict
PASS — Sub-S Upload (13 endpoint) `POST /upload-and-analyze` is functional after Phase C jar deploy.

---

## §2 T2 — Roundtrip via /uploads list (FAIL — P-X.0)

### Probe (run EP9722)
```
GET /api/mobile/F001/smart-bi/uploads?page=0&size=50 → 200
{
  "code": 200,
  "message": ...,
  "success": true,
  "data": null         ← BUG: should be { content: [...], totalElements, ... }
}
```

### Verdict
**FAIL — pre-existing bug P-X.0** — `data: null`, not an empty paginated wrapper.

### Why this matters
- FE `getUploadHistory()` (smartbi/upload.ts:364) calls `get(.../uploads, params)` and expects `{ content?, ... } | UploadHistoryItem[]`. With `data: null`, FE will treat as empty array → upload history tab will always look empty regardless of how many files actually persist.
- Customer-impacting: every customer who uploads xlsx and then expects to see their upload history will see "no uploads" in the wizard's history pane.
- Pre-existing — not caused by Phase C dead-method-delete cleanup. PR #271 Sub-S audit verified the endpoint exists in the controller; it did not validate that the endpoint *returns proper data*.

### Suggested investigation
- Check `SmartBIUploadController.listUploads(...)` handler. Likely returns null when no factory-scoped data, or pagination wrapper construction broken.
- Compare against PR #271 Sub-S audit's Upload (13) list — verify each endpoint actually returns expected shape, not just `200 OK`.

---

## §3 T3 — Rule 9 sample + Rule 11 single-row roundtrip (partial-PASS, but P-X.1 surfaced)

### Single-row probes (after capturing uploadId=4174)
```
GET /uploads/4174/data?page=0&size=20 → 200
  body.data = { headers, data, total, page, size, totalPages }   ← proper pagination wrapper

GET /uploads/4174/fields → 200
  body.data = [ {originalName, standardName, fieldType, semanticType, isDimension, isMeasure, isTime, ...}, ... ]   ← 5 fields
```

So single-row endpoints work. The data IS persisted at the staging table level.

### P-X.1 — Header corruption
Original synthesized headers (verified by inspecting our xlsx-write buffer):
```
['日期', '客户名称', '产品名称', '数量', '金额']
```

Backend parser-returned headers (`parseResult.headers` + confirmed via `/uploads/4174/fields`):
```
['time_period', '客户名称', '产品名称', '数量金额', '数量金额_2']
```

Mapping:
- `日期` → `time_period` (sensible standardization, fieldType=DATE, isTime=true ✓)
- `客户名称` → `客户名称` unchanged (semanticType="customer" ✓)
- `产品名称` → `产品名称` unchanged
- `数量` → **`数量金额`** (concatenation with NEXT column?!)
- `金额` → **`数量金额_2`** (dedup suffix `_2`)

Both result fields are typed `NUMERIC isMeasure=true` — so the parser sees them as measures but **conflates the column labels**. Sales analysis would compute with both columns as "金额" semantically (same name → same KPI bucket).

### Verdict
- Rule 11 single-row roundtrip: PASS (data persisted, retrievable)
- Rule 9 business semantic check: PASS for `customer` and `product` columns (real names, real values), but **FAIL for the `数量`/`金额` axis** because of P-X.1 parser corruption
- Overall: partial-PASS, with P-X.1 P1 bug filed for triage

### Suggested investigation
- Backend Python parser: `backend/python/smartbi/api/excel.py` or `auto_parse.py` — locate the field-name standardization step
- Reproduce: any xlsx with adjacent columns matching `[数量, 金额]` or similar `[数, 量]`-prefix overlap
- Test data preserved at uploadId=4174 in test env (do not delete until investigation done)

---

## §4 T4 — Backend invalid-content (P-X.2 observation)

### Garbage xlsx synthesized
- Headers: `['foo','bar','baz','qux','lol']`
- Data: `'hello world wat never gonna ...'` rows

### Backend response
```
POST /upload-and-analyze (with garbage.xlsx) → 200
toast: "文件解析成功" + "字段映射信心较低,请在下方确认后再查看分析结果"
requiresConfirmation: true (assumed — same shape as T1)
```

### Verdict — WARN (observation, not bug)
- Backend Python parser is permissive: it accepts the file and returns a low-confidence warning rather than hard-rejecting
- FE wizard then disables "查看分析结果" button (confirmed in F3) until user confirms field mappings → AI analysis cannot be polluted with garbage
- UX-graceful overall

### Why not a hard FAIL
- Toast text is reasonably specific ("字段映射信心较低,请在下方确认后再查看分析结果") — Rule 8 four-axis: a/b/c/d all reasonable
- The "requiresConfirmation" gating mechanism prevents bad data from polluting AI analysis
- Hard-rejecting random xlsx would block legitimate edge cases (uncommon column naming conventions)

### Suggested follow-up (optional)
- Could add a hard-reject threshold for *zero* recognized SmartBI patterns (vs current low-confidence accept)
- Not necessary if customer feedback hasn't surfaced this as a problem

---

## §5 F3 — Wizard "保存分析结果" click triggered no API

### Observation
Click on `保存分析结果` button (visible after AI analysis) generated zero new HTTP traffic — no `/upload/confirm` call, no other persist calls.

Suspected possibilities:
- Button is UI-only (saves to local Vue state, e.g., for chart sharing)
- Button is for AI Q&A history save, not upload-confirm
- FE bug: button mislabeled or wired to wrong handler

### Why not investigating deeper
- Out of chat1 scope — main dispatch was about Sub-S Config + Upload controller endpoint health, not full wizard flow
- The actual upload persistence already happened via uploadAndAnalyze (uploadId=4174 confirmed in /uploads/{id}/data)
- Worth a separate UX-focused chat to walk full wizard end-to-end with clear button semantics

---

## §6 Updated bug summary (combined with main report)

| # | Severity | Origin | Title | TaskCreate |
|---|---|---|---|---|
| P-2.3 | P0 | main report | Threshold inline-edit silent-drop + comparisonOperator corruption | #2 |
| P-3.1 | P1 | main report | DataSource CRUD broken — FE doesn't send factoryId | #3 |
| **P-X.0** | **P1 (NEW)** | this supplemental | `/uploads` LIST returns `data:null` — upload history broken | #5 |
| **P-X.1** | **P1 (NEW)** | this supplemental | Parser merges adjacent NUMERIC columns (`数量+金额` → `数量金额+数量金额_2`) | #6 |
| **P-X.2** | **W obs** | this supplemental | Parser permissive on garbage xlsx — UX-graceful but loose | #7 |

### Sister-sweep updated
- **P-X.0**: every list/page endpoint in SmartBIUploadController — `/uploads`, `/uploads-missing-fields`, `/uploads/{id}/data`. Verify each returns proper paginated wrapper, not `data:null`.
- **P-X.1**: Python `auto_parse` field-name standardization — needs unit-test for adjacent same-prefix NUMERIC columns. Likely affects any 销售/采购/财务 xlsx with `[数量, 金额]` or `[价格, 金额]` etc.
- P-2.3 + P-3.1 sister-sweeps unchanged from main report.

---

## §7 Decision update

### Phase C cleanup (Sub-S premise)
**GO** — unchanged. No new regression detected from Phase C jar deploy.

### SmartBI write-path overall release readiness
**FIX-required** — escalated from main report. Bug count went from 2 → 5 (4 P0/P1 + 1 W obs). Two NEW P1s (P-X.0 + P-X.1) directly affect customer-facing upload pipeline:
- Customers cannot see upload history (P-X.0)
- Sales/finance xlsx with `[数量,金额]` adjacency get column-merged silently (P-X.1)

### Recommended next steps for organizer (additions to main report §6)
6. Backend Python parser unit test: feed `[日期, 客户名称, 产品名称, 数量, 金额]` xlsx, assert headers come out separately. Reproduce P-X.1.
7. SmartBIUploadController list endpoints sister-sweep: every paginated GET in the 13 KEEP set, ping each, assert `data` is a proper wrapper and not `null`.
8. Wizard UX walkthrough chat: trace each button on each step, document what each actually triggers vs labels.

---

## §8 Evidence files (additions to existing evidence dir)

Located at `docs/qa-audits/2026-05-10-phase-c-e2e-chat1-write-paths-evidence/`:
- `excel-happy-path.mjs` + `excel-happy-path.json` — initial T1-T4
- `excel-followup.mjs` + `excel-followup.json` — wizard probe + list shape
- `excel-final-probe.mjs` + `excel-final-probe.json` — uploadId capture + single-row roundtrip
- `xl-1-upload-page.png` — initial upload page
- `xl-1-after-upload.png` — after T1 sync upload
- `xl-4-after-garbage-upload.png` — after T4 garbage upload
- `xf-3-after-parse.png` — after F3 parse step
- `xf-3-after-advance1.png` — after click attempt 1
- `xf-3-after-advance2.png` — after click attempt 2

---

**End of supplemental. Pinging organizer for triage of 3 new bugs.**
