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
from printing.services.template_renderer import (
    load_template_from_db,
    render_schema_to_pdf,
    unwrap_schema,
)

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


@router.post("/preview-template")
async def preview_template(payload: dict[str, Any] = Body(...)) -> Response:
    """C-PRT-EDITOR-1 — schema-driven print template preview.

    Called by Java PrintController.printPreviewTemplate via the
    pythonAiRestTemplate. Body shape:
      {
        "factoryId":        "F001",                  # required for RLS scope
        "templateId":       "uuid" | null,           # load saved schema by id
        "inlineSchemaJson": "..." | null,            # editor-side live preview
        "entityType":       "PRINT_SALES_ORDER",
        "entityData":       {...} | null,            # resolved against {{}} bindings
      }

    One of `templateId` or `inlineSchemaJson` must be supplied. `entityData`
    is optional — if absent, all {{}} bindings render as their literal text
    (useful for "what would this look like with no data" diagnostic).

    Java applies canViewPrice masking on `entityData` BEFORE calling this
    endpoint (per existing PrintController.applyPriceMask pattern).
    """
    factory_id = payload.get("factoryId")
    if not factory_id or not isinstance(factory_id, str):
        raise HTTPException(status_code=400, detail="factoryId required")

    template_id = payload.get("templateId")
    inline_schema_json = payload.get("inlineSchemaJson")
    entity_data = payload.get("entityData") or {}
    entity_type = payload.get("entityType", "")

    if template_id:
        schema = await load_template_from_db(factory_id, template_id)
    elif inline_schema_json:
        schema = unwrap_schema(inline_schema_json)
    else:
        raise HTTPException(status_code=400, detail="templateId or inlineSchemaJson required")

    try:
        pdf_bytes = render_schema_to_pdf(schema, entity_data)
    except Exception as exc:  # noqa: BLE001
        logger.error("preview-template render failed: factory=%s template=%s entity_type=%s err=%s",
                     factory_id, template_id, entity_type, exc, exc_info=True)
        raise HTTPException(status_code=500, detail=f"PDF 生成失败: {exc}")

    if not pdf_bytes:
        raise HTTPException(status_code=500, detail="PDF 生成失败 — empty output")

    filename = f"preview-{entity_type or 'template'}"
    return _pdf_response(pdf_bytes, filename)


@router.get("/health")
def health() -> dict[str, Any]:
    """Smoke-check: 字体可用 + 5 renderer 注册成功."""
    from printing.services.pdf_renderer import _register_chinese_font

    return {
        "ok": True,
        "font": _register_chinese_font(),
        "renderers": list(RENDERERS.keys()),
        "templateRenderer": "ready",
    }
