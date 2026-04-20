"""
B MVP (Apr 20 2026, task #323): Async Excel upload pipeline.

Provides 2 endpoints:
- POST /api/smartbi/excel/auto-parse-async → 202 + uploadId immediately
- GET  /api/smartbi/excel/auto-parse-status/{upload_id} → poll status

Key design choices:
- Reuses existing smart_bi_pg_excel_uploads table (no migration). Status
  values: PENDING / PROCESSING / COMPLETED / FAILED. Cleanup of tmp file
  happens in the finally block of the BG worker.
- BG worker uses FastAPI BackgroundTasks (same process); for multi-worker
  uvicorn deployments each POST still runs in the worker that received it,
  and DB is the coordination mechanism.
- Parsing itself delegates to the existing /api/smartbi/excel/auto-parse
  endpoint via localhost httpx call — zero refactor to the 700-line
  sync parser in excel.py.

Scope NOT included (future iterations):
- DB schema progress_percent / progress_stage columns (spec optional)
- Resume on process restart (BG tasks are lost; caller needs to re-POST)
- Webhooks or SSE notification (polling-only for now)
- FE integration (handoff doc covers this; skipped this session)
"""

from __future__ import annotations

import logging
import os
import tempfile
import time
import uuid
from typing import Optional

import httpx
from fastapi import APIRouter, BackgroundTasks, File, Form, HTTPException, UploadFile
from fastapi.responses import JSONResponse

from smartbi.database.connection import SessionLocal
from smartbi.database.models import SmartBiPgExcelUpload

router = APIRouter(prefix="/api/smartbi/excel", tags=["Excel Async"])
logger = logging.getLogger(__name__)

ASYNC_TMP_DIR = "/tmp/smartbi_async_uploads"
# Self-call target; the running Python service accepts localhost without auth
# for /api/smartbi/excel/auto-parse per config.
_SYNC_PARSE_URL = "http://127.0.0.1:{port}/api/excel/auto-parse"


@router.post("/auto-parse-async", status_code=202)
async def auto_parse_async(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    factory_id: Optional[str] = Form(None),
    factoryId: Optional[str] = Form(None),  # alias
    sheet_index: Optional[int] = Form(None),
    sheetIndex: Optional[int] = Form(None),
    max_rows: int = Form(500000),
    selected_region_start: Optional[int] = Form(None),
    selected_region_end: Optional[int] = Form(None),
):
    """
    Start async Excel parsing. Returns uploadId immediately (202).

    Call GET /api/smartbi/excel/auto-parse-status/{uploadId} to poll status.
    """
    # Normalize aliases
    factory_id = factory_id or factoryId
    sheet_index = sheet_index if sheet_index is not None else sheetIndex
    if not factory_id:
        raise HTTPException(status_code=400, detail="factory_id is required")

    if SessionLocal is None:
        raise HTTPException(status_code=503, detail="Database not available")

    os.makedirs(ASYNC_TMP_DIR, exist_ok=True)

    # 1. Save uploaded file to /tmp (stream to disk to avoid loading full
    #    content into memory for 500MB files).
    safe_suffix = os.path.basename(file.filename or "upload.xlsx")
    tmp_name = f"{uuid.uuid4().hex}_{safe_suffix}"
    tmp_path = os.path.join(ASYNC_TMP_DIR, tmp_name)
    total_bytes = 0
    try:
        with open(tmp_path, "wb") as tmp_f:
            while True:
                chunk = await file.read(1024 * 1024)  # 1 MB chunks
                if not chunk:
                    break
                tmp_f.write(chunk)
                total_bytes += len(chunk)
    except Exception as e:
        # Cleanup partial file on failure
        try:
            os.remove(tmp_path)
        except OSError:
            pass
        logger.exception("[async-upload] save failed")
        raise HTTPException(status_code=500, detail=f"File save failed: {e}")

    # 2. Create placeholder row (PENDING) to hand caller a trackable uploadId.
    db = SessionLocal()
    try:
        upload = SmartBiPgExcelUpload(
            factory_id=factory_id,
            file_name=safe_suffix,
            upload_status="PENDING",
        )
        db.add(upload)
        db.commit()
        db.refresh(upload)
        upload_id = upload.id
    except Exception as e:
        db.rollback()
        try:
            os.remove(tmp_path)
        except OSError:
            pass
        logger.exception("[async-upload] DB insert failed")
        raise HTTPException(status_code=500, detail=f"DB insert failed: {e}")
    finally:
        db.close()

    # 3. Schedule the BG task. httpx self-call runs in the worker's event loop.
    background_tasks.add_task(
        _async_worker,
        upload_id=upload_id,
        tmp_path=tmp_path,
        factory_id=factory_id,
        sheet_index=sheet_index,
        max_rows=max_rows,
        selected_region_start=selected_region_start,
        selected_region_end=selected_region_end,
    )

    return JSONResponse(
        status_code=202,
        content={
            "success": True,
            "uploadId": upload_id,
            "status": "PENDING",
            "bytesReceived": total_bytes,
            "pollUrl": f"/api/smartbi/excel/auto-parse-status/{upload_id}",
            "message": "文件已接收,后台处理中。请轮询状态。",
        },
    )


@router.get("/auto-parse-status/{upload_id}")
async def auto_parse_status(upload_id: int):
    """
    Poll status of async upload. Returns:
    - status (PENDING / PROCESSING / COMPLETED / FAILED)
    - fileName, rowCount, columnCount, detectedTableType (when COMPLETED)
    - error (when FAILED)
    """
    if SessionLocal is None:
        raise HTTPException(status_code=503, detail="Database not available")
    db = SessionLocal()
    try:
        upload = (
            db.query(SmartBiPgExcelUpload).filter_by(id=upload_id).first()
        )
        if not upload:
            raise HTTPException(status_code=404, detail="Upload not found")

        result = {
            "success": True,
            "uploadId": upload.id,
            "status": upload.upload_status,
            "fileName": upload.file_name,
            "factoryId": upload.factory_id,
            "rowCount": upload.row_count,
            "columnCount": upload.column_count,
            "createdAt": upload.created_at.isoformat() if upload.created_at else None,
            "updatedAt": upload.updated_at.isoformat() if upload.updated_at else None,
        }
        if upload.upload_status == "COMPLETED":
            result["detectedTableType"] = upload.detected_table_type
            result["fieldMappings"] = upload.field_mappings
            result["contextInfo"] = upload.context_info
        elif upload.upload_status == "FAILED":
            result["error"] = upload.error_message
        return result
    finally:
        db.close()


def _async_worker(
    upload_id: int,
    tmp_path: str,
    factory_id: str,
    sheet_index: Optional[int],
    max_rows: int,
    selected_region_start: Optional[int],
    selected_region_end: Optional[int],
):
    """
    BG task: calls the sync /auto-parse endpoint on localhost and mirrors
    the result back into the placeholder upload row. Designed to survive
    long-running parses (up to 900s total timeout).
    """
    import asyncio

    # FastAPI BackgroundTasks runs sync callables in thread pool. To make
    # httpx async calls we need our own event loop here.
    asyncio.run(_async_worker_impl(
        upload_id=upload_id,
        tmp_path=tmp_path,
        factory_id=factory_id,
        sheet_index=sheet_index,
        max_rows=max_rows,
        selected_region_start=selected_region_start,
        selected_region_end=selected_region_end,
    ))


async def _async_worker_impl(
    upload_id: int,
    tmp_path: str,
    factory_id: str,
    sheet_index: Optional[int],
    max_rows: int,
    selected_region_start: Optional[int],
    selected_region_end: Optional[int],
):
    start = time.time()
    db = SessionLocal()
    upload = None
    try:
        upload = db.query(SmartBiPgExcelUpload).filter_by(id=upload_id).first()
        if not upload:
            logger.error(f"[async-worker] upload_id={upload_id} not found, bailing")
            return
        upload.upload_status = "PROCESSING"
        db.commit()
        logger.info(f"[async-worker] upload_id={upload_id} PROCESSING started")

        # Self-call the sync parser endpoint. Port 8083 (prod) or 8084 (test)
        # — read from env so the same code works in both environments.
        port = int(os.environ.get("SMARTBI_PORT", "8083"))
        url = _SYNC_PARSE_URL.format(port=port)

        form_data = {
            "factory_id": factory_id,
            "max_rows": str(max_rows),
            "use_cache": "true",
        }
        if sheet_index is not None:
            form_data["sheet_index"] = str(sheet_index)
        if selected_region_start is not None:
            form_data["selected_region_start"] = str(selected_region_start)
        if selected_region_end is not None:
            form_data["selected_region_end"] = str(selected_region_end)

        with open(tmp_path, "rb") as f:
            files = {"file": (os.path.basename(tmp_path), f, "application/octet-stream")}
            async with httpx.AsyncClient(timeout=900.0) as client:
                resp = await client.post(url, data=form_data, files=files)

        duration_ms = int((time.time() - start) * 1000)

        if resp.status_code == 200:
            result = resp.json()
            # Mirror the parsed result into the placeholder row. The sync
            # endpoint itself does NOT persist to excel_uploads table, so
            # no dup row — we own the only record.
            upload.upload_status = "COMPLETED"
            upload.row_count = result.get("rowCount") or result.get("row_count") or 0
            upload.column_count = (
                result.get("columnCount") or result.get("column_count") or 0
            )
            upload.detected_table_type = result.get("tableType") or result.get(
                "detectedTableType"
            )
            upload.field_mappings = result.get("fieldMappings") or result.get(
                "field_mappings"
            )
            upload.context_info = {
                "parsedInMs": duration_ms,
                "rawKeys": list(result.keys())[:20],
            }
            db.commit()
            logger.info(
                f"[async-worker] upload_id={upload_id} COMPLETED in {duration_ms}ms, "
                f"rows={upload.row_count}, cols={upload.column_count}"
            )
        else:
            upload.upload_status = "FAILED"
            upload.error_message = f"HTTP {resp.status_code}: {resp.text[:500]}"
            db.commit()
            logger.error(
                f"[async-worker] upload_id={upload_id} FAILED: "
                f"HTTP {resp.status_code} after {duration_ms}ms"
            )
    except Exception as e:
        logger.exception(f"[async-worker] upload_id={upload_id} crashed")
        try:
            if upload is None:
                upload = (
                    db.query(SmartBiPgExcelUpload).filter_by(id=upload_id).first()
                )
            if upload is not None:
                upload.upload_status = "FAILED"
                upload.error_message = str(e)[:500]
                db.commit()
        except Exception:
            db.rollback()
    finally:
        db.close()
        try:
            os.remove(tmp_path)
        except OSError:
            pass
