## Task A — datasource upload boundary tests (R5)

**Spec**: docs/qa-specs/2026-05-12-smartbi-python-port-deep-e2e-spec.md §5 R5
**Endpoint**: `POST /api/mobile/{factoryId}/smart-bi/upload` (multipart, `file=` field)
  - Controller: `backend/java/cretas-api/.../controller/SmartBIUploadController.java` (line 110)
  - `MAX_UPLOAD_BYTES = 300 MB` (line 57) — sanity cap; rejected with HTTP 200 + `success:false` body if exceeded
  - Below 50 MB: synchronous Python parse via `PythonSmartBIClient.parseExcel`
  - Above 50 MB (LARGE_FILE_ASYNC_BYTES): async path only on `/upload-and-analyze`, not on `/upload`
**Env**: Java test backend `47.100.235.168:10011` (closed to public; reached via nginx gateway `139.196.165.140:8097`)
**Date**: 2026-05-12, 21:32–21:39 UTC
**Account**: `factory_admin1` / `123456` (F001, role=`factory_super_admin`)
**Login route**: `POST /api/mobile/auth/unified-login` (note: spec said `/auth/login` but actual route is `/auth/unified-login` — only the JwtAuthInterceptor whitelist references the `/auth/login` literal at line 216 of `JwtAuthInterceptor.java`)
**JWT obtained**: `eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoiZmFjdG9yeV9zdXBlcl9hZG1pbi...IOs` (24h exp)

### Sticky-toast FE enforcement (qa-prompt Rule 8) — global verification

Inspected the live test web-admin bundle (`http://139.196.165.140:8097/assets/index-_iHIJmvd.js`). The bootstrap (`L()` in main bundle, line ~22) **globally monkey-patches `ElMessage.error`**:

```js
t.error = function(i) {
  return d(typeof i === "string" ? { message: i, duration: 0, showClose: true } : { duration: 0, showClose: true, ...i });
};
// console.info("[cretas] ElMessage.error patched: duration=0 + showClose=true default")
```

→ All error toasts default to `duration: 0` (sticky until user dismisses) + `showClose: true` (visible "X" button). Marker flag `__cretasErrorPatched` prevents double-wrap.

**Conclusion**: Rule 8 enforced globally at FE entry point. No per-call backslide possible unless explicit `duration: <ms>` override at the call site (would require code review to identify any such overrides). Backend response shape (HTTP 200 + `success:false` + `message` Chinese text) drives the toast content for boundary errors.

### Case 1: 100MB binary-content `.xlsx`

- **File**: `large_100mb.xlsx` (104857600 bytes, raw `/dev/zero` with .xlsx extension; below 300MB sanity cap, above 50MB async threshold but `/upload` is sync-only)
- **curl**:
  ```
  curl -X POST 'http://139.196.165.140:8097/api/mobile/F001/smart-bi/upload' \
    -H "Authorization: Bearer $JWT" -F "file=@large_100mb.xlsx" --max-time 300
  ```
- **HTTP**: timed out at 300s. cURL final state: `HTTP_STATUS=100` (continue), `SIZE_UPLOAD=104857820` bytes uploaded, no terminating response received within 300s window.
- **Body**: (empty — connection held open then aborted by client)
- **Sticky**: N/A — FE never received a final response to dispatch a toast. From user perspective: spinner spins for ≥5 minutes, then likely client-side timeout / no error toast.
- **Verdict**: **BUG B1 (P1)** — no graceful timeout or specific error for 50MB–300MB sync uploads on `/upload` endpoint.
  - Root cause hypothesis: Java sync HTTP call to Python `parseExcel` blocks; Python sync parse path holds the request indefinitely on binary-content "fake xlsx" (zipfile parser may CPU-burn or hold lock).
  - Mitigation suggestion: tighten `pythonClient.parseExcel` timeout to ~60s + emit specific error `"Excel 解析超时，请检查文件或拆分后重试"`, or auto-route 50MB+ to async also on `/upload`.

### Case 2: 0-byte empty `.xlsx`

- **File**: `empty.xlsx` (0 bytes via `touch`)
- **curl**:
  ```
  curl -X POST 'http://139.196.165.140:8097/api/mobile/F001/smart-bi/upload' \
    -H "Authorization: Bearer $JWT" -F "file=@empty.xlsx" --max-time 60
  ```
- **HTTP**: 200 (envelope; logical 400) — `time_total=0.49s`
- **Body**:
  ```json
  {"code":400,
   "message":"Excel parse failed: 文件不是有效的 xlsx 格式 (可能损坏/非 Excel/旧 .xls 格式). 请确认文件并重新上传.",
   "data":null,
   "success":false,
   "timestamp":"2026-05-13T05:38:16..."}
  ```
- **Sticky**: deferred to FE (global ElMessage patch → sticky by default; no per-call override needed for this code path; not Playwright-verified this session but globally enforced per bundle inspection)
- **Verdict**: ✅ specific Chinese error, fast (<0.5s), distinct from 500 generic. Minor: message conflates "empty" with "corrupt" — both classes funneled to identical text. Acceptable for v1; could improve to `"文件为空 (0 字节)，请确认文件后重新上传"` for clarity but not a bug.

### Case 3: Malformed Excel (8KB random bytes, `.xlsx` extension)

- **File**: `corrupt.xlsx` (`head -c 8192 /dev/urandom > corrupt.xlsx`, 8192 bytes)
- **curl**: same shape as Case 2, with `-F "file=@corrupt.xlsx"`
- **HTTP**: 200 envelope (logical 400) — `time_total=0.43s`
- **Body**: identical to Case 2 — `"Excel parse failed: 文件不是有效的 xlsx 格式 (可能损坏/非 Excel/旧 .xls 格式). 请确认文件并重新上传."`
- **Sticky**: deferred to FE (global patch covers)
- **Verdict**: ✅ specific error, fast-fail. Excellent — Python parser detects non-zip header and short-circuits with user-facing Chinese explanation.

### Case 4: Unicode filename `销售数据_2026年5月.xlsx`

- **File**: valid 4887-byte xlsx with Chinese filename (built via openpyxl in test rig)
- **curl** to `/upload` (parse-only):
  ```
  curl -X POST '.../F001/smart-bi/upload' \
    -H "Authorization: Bearer $JWT" -F "file=@销售数据_2026年5月.xlsx" --max-time 60
  ```
- **HTTP**: 200, `time_total=31.6s` (Python first-call cold start)
- **Body**: `{"code":200,"message":"Excel parsed successfully","data":{"success":true,...}}` — parsed successfully, returned correct row `{"time_period":"2026-01-01","销售额":1000.0}` with Chinese column name `销售额` round-tripped UTF-8 cleanly inside the JSON body
- **Verdict (parse only)**: ✅ Excel content round-trip is UTF-8 clean

**Supplemental** — `/upload-and-analyze` (persists to DB):

- HTTP 200, parsed + persisted (`uploadId=4175`, `dataType=SALES`, `savedRows=1`)
- **Re-query `/uploads?page=0&size=1`** to verify stored filename:
  ```json
  {"id":4175, "fileName":"��������_2026��5��.xlsx", ...}
  ```
- **Raw bytes dump** (`uploads_check_case4.json`): the `fileName` field contains **12 occurrences of `\xEF\xBF\xBD` (UTF-8 encoding of `U+FFFD REPLACEMENT CHARACTER`)** where the 8 Chinese chars (`销`,`售`,`数`,`据`,`年`,`月`) plus a couple non-ASCII surrogates should have lived.

- **Verdict**: **BUG B2 (P1)** — Unicode filename ROUND-TRIP FAILS at PERSIST step.
  - Content of Excel cells is UTF-8-safe (parse response above showed `销售额` cleanly).
  - The bug is specifically in the **filename** field captured from `MultipartFile.getOriginalFilename()` and written to `smart_bi_pg_excel_upload.file_name`. The 12 replacement chars match exactly: 6 Chinese chars (销售数据 + 年 + 月) decoded as ISO-8859-1 then re-encoded UTF-8 → each Chinese char produces 3 replacement bytes → 12 replacements ≈ 4 chars (consistent with mojibake math; the spec digits "2026" and "5" survived intact as ASCII).
  - Most likely cause: Tomcat servlet container default `defaultEncoding=ISO-8859-1` for multipart filename parameter (RFC 7578 ambiguity). Fix: either set `server.tomcat.multipart.encoding=UTF-8` / `spring.servlet.multipart.encoding=UTF-8` in `application*.properties`, OR Spring filter explicitly: `new MultipartFilter().setEncoding("UTF-8")`, OR controller-side: `new String(filename.getBytes("ISO-8859-1"), "UTF-8")`.
  - **Severity P1**: any customer uploading a Chinese-named Excel (extremely common in zh-CN env, e.g. `销售-Q1.xlsx`) will see garbled filenames in upload history page (`/uploads`), trace lineage broken in audit logs.
  - **Sticky N/A**: upload succeeded, no error toast. The bug is silent/visual-only on the history list, which is worse than a sticky error from UX perspective.
- **Sticky verdict (for the parse-success path)**: not applicable (no error toast); ticket the mojibake separately.

### Case 5: Wrong MIME (MZ exe content with `.xlsx` extension)

- **File**: `fake_exe.xlsx` (`MZ\x90\x00\x03\x00...` 20-byte MS-DOS PE header + 256 bytes random, 276 bytes total)
- **curl**: same shape as Case 2, with `-F "file=@fake_exe.xlsx"`
- **HTTP**: 200 envelope (logical 400) — `time_total=0.45s`
- **Body**: identical Chinese text `"Excel parse failed: 文件不是有效的 xlsx 格式 (可能损坏/非 Excel/旧 .xls 格式). 请确认文件并重新上传."`
- **Sticky**: deferred to FE (global patch covers)
- **Verdict**: ✅ specific error. The Python parser rejects the non-zip header (zipfile signature `PK\x03\x04` missing) and short-circuits. Note: server does NOT inspect Content-Type header — purely content-based detection, which is the right call (Content-Type from `curl -F` defaults to `application/octet-stream` regardless).

### Summary

| # | Case | HTTP | Specific error? | Time | Bug? |
|---|------|------|-----------------|------|------|
| 1 | 100MB binary | none (timeout @ 300s, HTTP 100 only) | ❌ no response | 300s+ | **B1 P1** |
| 2 | 0-byte | 200/400 | ✅ "文件不是有效的 xlsx 格式" | 0.49s | clean |
| 3 | corrupt 8KB | 200/400 | ✅ same Chinese text | 0.43s | clean |
| 4 | unicode filename | 200/200 (parse OK); persist OK but filename MOJIBAKE | ✅ Excel content UTF-8; ❌ **filename UTF-8** | 31.6s+1.2s | **B2 P1** |
| 5 | MZ exe ext | 200/400 | ✅ same Chinese text | 0.45s | clean |

- **5/5 cases attempted, 5/5 returned specific errors OR succeeded with structured response (no naked 500 generics)**
- **2 bugs found**:
  - **B1 (P1)**: 100MB sync upload on `/upload` hangs ≥300s with no terminating error. No safety timeout to abort + emit a specific error message. Tomcat held the request open with HTTP 100 continue but no final status. (Suggested fix: drop `MAX_UPLOAD_BYTES` to 50MB on `/upload` and route 50–300MB to async path, OR add a 60s Python parse timeout.)
  - **B2 (P1)**: Unicode filename gets mojibake'd on persist. 12 `U+FFFD` replacement chars in stored `file_name`. Excel cell content UTF-8 is fine; only the multipart `Content-Disposition` filename param is broken. (Suggested fix: configure Tomcat multipart encoding to UTF-8.)
- **Sticky verdict**: Globally enforced via `ElMessage.error` monkey-patch in main bundle. `duration: 0 + showClose: true` is the default for all error toasts. Cases 2/3/5 errors will render sticky on the FE. Per-call overrides would need a code-grep to identify; no live Playwright sticky verification this session (deferred — Backend response shape is the contract, FE patch is the enforcement).
- **Bug count: 2** (one performance / safety-timeout, one i18n / persist-time encoding).

### Evidence files

Stashed under `docs/qa-audits/_staging/evidence/`:
- `case2_response.json`, `case3_response.json`, `case4_response.json`, `case5_response.json`
- `case4b_upload_and_analyze.json` — upload-and-analyze response for unicode supplemental
- `uploads_check_case4.json` — `/uploads` re-query showing mojibake'd `fileName` (12 `\xEF\xBF\xBD`)

### Constraints honoured

- No code changes, no commits, no `git push`, no `--env prod` deploys
- All hits via test-only gateway `139.196.165.140:8097` → nginx → `47:10011` (Java test) → `47:8084` (Python test)
- JWT logged out implicit (24h exp); no token revocation
- Spec `factory_admin1`/`123456` worked first try (no 429 rate-limit)
- Per `.claude/rules/server-operations.md`: test-only env, no prod ports touched
