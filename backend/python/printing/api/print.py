"""C-PRT-1 — 单据打印 PDF FastAPI 端点.

5 endpoint 一一对应 5 单据. Java PrintController 通过 RestTemplate 调本端点
取 PDF bytes 流回客户端.

@author Cretas Team — Track C
@since 2026-05-15 (C-PRT-1)
"""
from __future__ import annotations

import logging
from typing import Any

from fastapi import APIRouter, Body, HTTPException
from fastapi.responses import Response

from printing.services.pdf_renderer import RENDERERS

logger = logging.getLogger(__name__)

router = APIRouter()


def _render_pdf(doc_type: str, data: dict[str, Any]) -> bytes:
    renderer = RENDERERS.get(doc_type)
    if renderer is None:
        raise HTTPException(status_code=400, detail=f"未知单据类型: {doc_type}")
    try:
        return renderer(data)
    except Exception as exc:  # noqa: BLE001 — 让上层看到具体错误
        logger.error("PDF 生成失败 doc_type=%s data=%s err=%s", doc_type, data, exc, exc_info=True)
        raise HTTPException(status_code=500, detail=f"PDF 生成失败: {exc}")


def _pdf_response(pdf_bytes: bytes, filename: str) -> Response:
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}.pdf"',
            "Content-Length": str(len(pdf_bytes)),
        },
    )


@router.post("/sales-order")
def print_sales_order(payload: dict[str, Any] = Body(...)) -> Response:
    pdf = _render_pdf("sales-order", payload)
    return _pdf_response(pdf, f"sales-order-{payload.get('orderNumber', 'na')}")


@router.post("/purchase-order")
def print_purchase_order(payload: dict[str, Any] = Body(...)) -> Response:
    pdf = _render_pdf("purchase-order", payload)
    return _pdf_response(pdf, f"purchase-order-{payload.get('orderNumber', 'na')}")


@router.post("/quotation")
def print_quotation(payload: dict[str, Any] = Body(...)) -> Response:
    pdf = _render_pdf("quotation", payload)
    return _pdf_response(pdf, f"quotation-{payload.get('quotationNumber', 'na')}")


@router.post("/production-task")
def print_production_task(payload: dict[str, Any] = Body(...)) -> Response:
    pdf = _render_pdf("production-task", payload)
    return _pdf_response(pdf, f"production-task-{payload.get('taskNumber', 'na')}")


@router.post("/material-requisition")
def print_material_requisition(payload: dict[str, Any] = Body(...)) -> Response:
    pdf = _render_pdf("material-requisition", payload)
    return _pdf_response(pdf, f"material-requisition-{payload.get('requisitionNumber', 'na')}")


@router.get("/health")
def health() -> dict[str, Any]:
    """Smoke-check: 字体可用 + 5 renderer 注册成功."""
    from printing.services.pdf_renderer import _register_chinese_font

    return {
        "ok": True,
        "font": _register_chinese_font(),
        "renderers": list(RENDERERS.keys()),
    }
