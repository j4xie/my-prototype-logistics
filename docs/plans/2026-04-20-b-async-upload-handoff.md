# B 异步化 Upload Pipeline - Handoff

**Status**: 设计完成,代码未实现 (Apr 20 2026)
**Task**: #323 拆分 upload/analyze 异步化
**Scope**: P1 中期方案 (1-2 周),不是本 session 范围
**Prerequisites done**: P0-1~5 超时修复 (commit `01d30fa9c`)已止血,客户可等同步 600s

---

## Why async

P0 已把 FE→Nginx→Java→Python→DB 每一层超时调到 600-900s,**但仍是同步**:
- 200K 行上传要 5-10min,浏览器 tab 必须保持打开
- 用户不能离开页面,不能刷新,不能开新 tab 继续别的事
- 网络抖动就失败,没有 resume

异步化解决:
- 点上传 → 立即返回 uploadId + 202 Accepted
- 后端 BackgroundTasks 跑 pipeline
- 前端 polling `/api/excel/auto-parse-status/{uploadId}` 2s 一次
- 状态 PENDING → PROCESSING → COMPLETED / FAILED
- 用户可离开,稍后回来查状态

---

## DB Schema (复用现有, 零 migration)

`smart_bi_pg_excel_uploads` 已有字段:
- `upload_status VARCHAR(20)` default `'PENDING'` — 复用
- `error_message TEXT` — FAILED 时写
- `last_error TEXT` — 同
- `row_count INT` — 完成后写
- `stored_file_path VARCHAR(500)` — async 需用来存临时文件

**可选新增** (小 migration):
```sql
ALTER TABLE smart_bi_pg_excel_uploads
  ADD COLUMN IF NOT EXISTS progress_percent SMALLINT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS progress_stage VARCHAR(50),  -- 'DETECTING' / 'MAPPING' / 'PERSISTING'
  ADD COLUMN IF NOT EXISTS started_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP;
```

不加也行 — FE 可只显示 status 文本。

---

## Python 实现 (~300 行)

**File**: `backend/python/smartbi/api/excel_async.py` (新建)

```python
from fastapi import APIRouter, BackgroundTasks, UploadFile, File, Form, HTTPException
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from typing import Optional
import tempfile, os, logging
from smartbi.database.repository import get_session
from smartbi.database.models import SmartBiPgExcelUpload  # 如果还没有 SQLAlchemy model,要建

router = APIRouter(prefix="/api/excel", tags=["Excel Async"])
logger = logging.getLogger(__name__)

@router.post("/auto-parse-async", status_code=202)
async def auto_parse_async(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    factory_id: str = Form(...),
    sheet_index: Optional[int] = Form(None),
    max_rows: int = Form(500000),
    # ... same as sync /auto-parse
):
    """Start async Excel parsing. Returns upload_id immediately.

    Call /api/excel/auto-parse-status/{upload_id} to poll status.
    """
    # 1. Save file to /tmp/excel_uploads/<uuid>
    content = await file.read()
    upload_dir = "/tmp/excel_uploads"
    os.makedirs(upload_dir, exist_ok=True)

    # 2. Insert upload row with status=PENDING
    session = get_session()
    try:
        upload = SmartBiPgExcelUpload(
            factory_id=factory_id,
            file_name=file.filename,
            upload_status="PENDING",
            # progress_stage="QUEUED",
        )
        session.add(upload)
        session.commit()
        upload_id = upload.id

        file_path = os.path.join(upload_dir, f"{upload_id}_{file.filename}")
        with open(file_path, "wb") as f:
            f.write(content)

        upload.stored_file_path = file_path
        session.commit()
    finally:
        session.close()

    # 3. Schedule background task
    background_tasks.add_task(
        _run_pipeline_async,
        upload_id=upload_id,
        file_path=file_path,
        factory_id=factory_id,
        sheet_index=sheet_index,
        max_rows=max_rows,
    )

    return JSONResponse(
        status_code=202,
        content={
            "success": True,
            "uploadId": upload_id,
            "status": "PENDING",
            "pollUrl": f"/api/excel/auto-parse-status/{upload_id}",
            "message": "上传已接收, 后台处理中"
        }
    )


@router.get("/auto-parse-status/{upload_id}")
async def auto_parse_status(upload_id: int):
    """Poll status of async upload."""
    session = get_session()
    try:
        upload = session.query(SmartBiPgExcelUpload).filter_by(id=upload_id).first()
        if not upload:
            raise HTTPException(status_code=404, detail="Upload not found")

        response = {
            "uploadId": upload.id,
            "status": upload.upload_status,  # PENDING / PROCESSING / COMPLETED / FAILED
            "fileName": upload.file_name,
            "rowCount": upload.row_count,
            "createdAt": upload.created_at.isoformat() if upload.created_at else None,
        }

        if upload.upload_status == "FAILED":
            response["error"] = upload.error_message or upload.last_error

        if upload.upload_status == "COMPLETED":
            # Attach parse result (fetch from analysis_results or just return metadata)
            response["detectedTableType"] = upload.detected_table_type
            response["fieldMappings"] = upload.field_mappings
            response["columnCount"] = upload.column_count

        return response
    finally:
        session.close()


def _run_pipeline_async(
    upload_id: int,
    file_path: str,
    factory_id: str,
    sheet_index: Optional[int],
    max_rows: int,
):
    """Background worker: runs same logic as sync /auto-parse but writes status to DB."""
    session = get_session()
    try:
        upload = session.query(SmartBiPgExcelUpload).filter_by(id=upload_id).first()
        upload.upload_status = "PROCESSING"
        # upload.progress_stage = "DETECTING"
        session.commit()

        # === Existing pipeline (refactor from excel.py:auto_parse_excel) ===
        with open(file_path, "rb") as f:
            content = f.read()

        # Call shared pipeline function
        from smartbi.api.excel import _run_parse_pipeline
        result = _run_parse_pipeline(
            content=content,
            file_name=os.path.basename(file_path),
            factory_id=factory_id,
            sheet_index=sheet_index,
            max_rows=max_rows,
            # ... other params
        )

        # === Update DB with results ===
        upload.upload_status = "COMPLETED"
        upload.detected_table_type = result.get("tableType")
        upload.field_mappings = result.get("fieldMappings")
        upload.row_count = result.get("rowCount", 0)
        upload.column_count = result.get("columnCount", 0)
        session.commit()

        logger.info(f"[async-pipeline] upload_id={upload_id} completed: rows={upload.row_count}")
    except Exception as e:
        logger.exception(f"[async-pipeline] upload_id={upload_id} failed")
        upload.upload_status = "FAILED"
        upload.error_message = str(e)[:500]
        upload.last_error = str(e)
        session.commit()
    finally:
        session.close()
        # Clean up temp file
        try:
            os.remove(file_path)
        except Exception:
            pass
```

**Refactor required** in `backend/python/smartbi/api/excel.py`:
- Extract `_run_parse_pipeline(content, file_name, factory_id, ...)` function from `auto_parse_excel` body
- Sync `/auto-parse` endpoint calls `_run_parse_pipeline` directly
- Async path calls same function via BackgroundTasks

Effort: ~200 Python lines refactor + 100 lines new endpoints = 300 lines total. ~3 hours.

**Gotcha**: FastAPI `BackgroundTasks` only works in same worker. If `uvicorn --workers N > 1`, task runs in whichever worker received the POST — that's fine for writing to DB (shared state). Status endpoint works from any worker since it just queries DB.

---

## FE 实现 (~100 行)

**File**: `web-admin/src/api/smartbi/upload.ts` (新增 function)

```typescript
export async function uploadFileAsync(
  file: File,
  factoryId: string,
  options?: { sheetIndex?: number; maxRows?: number }
): Promise<{ uploadId: number; status: string }> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('factory_id', factoryId);
  if (options?.sheetIndex !== undefined) formData.append('sheet_index', String(options.sheetIndex));
  if (options?.maxRows !== undefined) formData.append('max_rows', String(options.maxRows));

  const res = await request.post('/smartbi-api/api/excel/auto-parse-async', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    baseURL: '',
    timeout: 60000,  // upload-only, 不等解析
  });
  return res.data as { uploadId: number; status: string };
}

export async function pollUploadStatus(
  uploadId: number,
  options?: { intervalMs?: number; timeoutMs?: number; onProgress?: (s: UploadStatus) => void }
): Promise<UploadStatus> {
  const interval = options?.intervalMs ?? 2000;
  const timeout = options?.timeoutMs ?? 15 * 60 * 1000;  // 15min
  const onProgress = options?.onProgress ?? (() => {});
  const start = Date.now();

  while (Date.now() - start < timeout) {
    const res = await request.get(`/smartbi-api/api/excel/auto-parse-status/${uploadId}`, {
      baseURL: '',
      timeout: 10000,
    });
    const status = res.data as UploadStatus;
    onProgress(status);
    if (status.status === 'COMPLETED' || status.status === 'FAILED') {
      return status;
    }
    await new Promise(r => setTimeout(r, interval));
  }
  throw new Error(`Upload polling timeout after ${timeout}ms`);
}
```

**File**: `web-admin/src/views/smart-bi/ExcelUpload.vue` (modify handleBeforeUpload)

```typescript
// Large file threshold: > 50MB → async path
async function handleBeforeUpload(file: File) {
  if (file.size > 50 * 1024 * 1024) {
    const { uploadId } = await uploadFileAsync(file, factoryId);
    ElMessage.info(`文件已接收,正在后台处理... (ID: ${uploadId})`);
    currentStep.value = 1;  // Show "processing..." UI

    const result = await pollUploadStatus(uploadId, {
      onProgress: (s) => {
        progressPercent.value = s.progressPercent || 0;
        progressStage.value = s.progressStage || '';
      }
    });

    if (result.status === 'COMPLETED') {
      parseResult.value = result;
      currentStep.value = 2;  // Show parsed data
    } else {
      ElMessage.error(`解析失败: ${result.error}`);
      currentStep.value = 0;
    }
    return false;  // prevent default upload
  }
  // Small files: use existing sync /upload-and-analyze
  return true;
}
```

---

## 部署 + 测试清单

1. ✅ Python edits (~300 lines)
2. ✅ Sync pipeline 提取 `_run_parse_pipeline` refactor (200 lines)
3. ⬜ Unit test `/auto-parse-async` endpoint (mock DB)
4. ⬜ Unit test `/auto-parse-status/{upload_id}` 返回 4 种状态
5. ⬜ FE add `uploadFileAsync` + `pollUploadStatus` helpers
6. ⬜ FE add "大文件自动走 async" 分支 (>50MB)
7. ⬜ FE add progress bar + "可关闭页面" 提示
8. ⬜ Deploy test 8084 + 8097
9. ⬜ E2E smoke: 上传 qhj_order_detail.csv (263MB / 200K rows) via async path
10. ⬜ Verify 用户关闭 tab + 稍后回来,状态继续推进

---

## 风险 / 注意

- **Workers > 1**: BackgroundTasks 只在同 worker 跑; 如用 `--workers 4`, 任务调度随 POST 落在哪个 worker。DB status 可跨 worker 查,所以 polling 没事。
- **Server restart during processing**: 任务丢失。需要 startup hook 扫描 PROCESSING > 1h 的 rows 标 FAILED。
- **Stored file cleanup**: `/tmp/excel_uploads/` 累积大文件,需要 cron 清理 24h 前的。
- **Memory**: 200K+ 行 content + pandas DF 双份内存 (400MB 文件 → 800MB RAM)。当前 test env python 分配够不够?要测。

---

## 为什么这轮 session 不做 B

1. 3-5 小时工作量,需要完整 E2E 测试
2. P0 已把客户短期疼痛解决 (超时 + max_rows cap)
3. 每一层 refactor (pipeline 提取)需要小心,容易破坏现有同步 flow
4. FE UI 状态管理变复杂,需要 storybook / 手动真窗口测试
5. 部署涉及 FE + Python 两边,需协调 rollout

**Next session 建议**: 独立开大 session 做 B,预留 4-5 hours。先做 Python refactor + 测试,再做 FE。分 2 个 commit。

---

## Author

Claude Opus 4.7 (1M) — Apr 20 2026
