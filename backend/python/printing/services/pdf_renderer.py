"""PDF rendering helpers — Chinese-font registration, 5 单据生成函数.

reportlab + qrcode (用于采购单).

@author Cretas Team — Track C
@since 2026-05-15 (C-PRT-1)
"""
from __future__ import annotations

import io
import logging
from typing import Any, Optional

logger = logging.getLogger(__name__)


# ==================== Font 注册 (单次) ====================

_CHINESE_FONT: Optional[str] = None  # cached after first registration


def _register_chinese_font() -> str:
    """注册中文字体 — 与 smartbi/services/pdf_generator.py 模式一致.

    返回字体名 (如 'ChineseFont' 或 'Helvetica' fallback).
    """
    global _CHINESE_FONT
    if _CHINESE_FONT is not None:
        return _CHINESE_FONT

    from reportlab.pdfbase import pdfmetrics
    from reportlab.pdfbase.ttfonts import TTFont

    candidate_paths = [
        "/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc",
        "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc",
        "/usr/share/fonts/truetype/noto/NotoSansCJK-Regular.ttc",
        "/System/Library/Fonts/PingFang.ttc",
        "C:/Windows/Fonts/msyh.ttc",  # Windows MS YaHei (dev only)
        "C:/Windows/Fonts/simhei.ttf",
    ]
    for path in candidate_paths:
        try:
            pdfmetrics.registerFont(TTFont("ChineseFont", path))
            _CHINESE_FONT = "ChineseFont"
            logger.info("Registered Chinese font: %s", path)
            return _CHINESE_FONT
        except Exception:
            continue
    logger.warning("无中文字体可用, 中文将显示为 □ — 部署机器请安装 wqy-zenhei 或 Noto-CJK")
    _CHINESE_FONT = "Helvetica"
    return _CHINESE_FONT


# ==================== Shared styles ====================

def _get_styles() -> dict[str, Any]:
    from reportlab.lib.colors import HexColor
    from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet

    font = _register_chinese_font()
    base = getSampleStyleSheet()
    return {
        "font": font,
        "title": ParagraphStyle("Title", parent=base["Title"], fontName=font, fontSize=20,
                                textColor=HexColor("#1f2937"), spaceAfter=14, alignment=1),
        "h2": ParagraphStyle("H2", parent=base["Heading2"], fontName=font, fontSize=13,
                             textColor=HexColor("#1f2937"), spaceBefore=8, spaceAfter=6),
        "body": ParagraphStyle("Body", parent=base["Normal"], fontName=font, fontSize=10,
                               textColor=HexColor("#1f2937"), leading=14),
        "small": ParagraphStyle("Small", parent=base["Normal"], fontName=font, fontSize=8,
                                textColor=HexColor("#6b7280"), leading=11),
    }


# ==================== Common helpers ====================

def _fmt_money(v: Any) -> str:
    if v is None:
        return "-"
    try:
        return f"¥{float(v):,.2f}"
    except (TypeError, ValueError):
        return str(v)


def _fmt_qty(v: Any) -> str:
    if v is None:
        return "-"
    try:
        return f"{float(v):,.2f}"
    except (TypeError, ValueError):
        return str(v)


def _build_qr_image(content: str, size_cm: float = 2.5) -> Any:
    """生成二维码 reportlab Image — 用于采购单扫码入库.

    返回 reportlab Image 或 None (qrcode lib 缺失时).
    """
    try:
        import qrcode
        from reportlab.lib.units import cm
        from reportlab.platypus import Image as RLImage

        img = qrcode.make(content)
        bio = io.BytesIO()
        img.save(bio, format="PNG")
        bio.seek(0)
        return RLImage(bio, width=size_cm * cm, height=size_cm * cm)
    except ImportError:
        logger.warning("qrcode lib 未装, 采购单将无二维码")
        return None
    except Exception as e:
        logger.warning("二维码生成失败: %s", e)
        return None


def _make_doc(buffer: io.BytesIO) -> Any:
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.units import cm
    from reportlab.platypus import SimpleDocTemplate

    return SimpleDocTemplate(
        buffer, pagesize=A4,
        leftMargin=1.5 * cm, rightMargin=1.5 * cm,
        topMargin=1.5 * cm, bottomMargin=1.5 * cm,
    )


def _render_items_table(items: list[dict], columns: list[tuple[str, str, str]], font: str) -> Any:
    """通用明细表渲染.

    columns: list of (header_label, key, align) e.g. [("产品", "name", "LEFT"), ("数量", "qty", "RIGHT")]
    """
    from reportlab.lib import colors
    from reportlab.lib.units import cm
    from reportlab.platypus import Table, TableStyle

    headers = [c[0] for c in columns]
    keys = [c[1] for c in columns]
    aligns = [c[2] for c in columns]

    rows: list[list[str]] = [headers]
    for item in items or []:
        rows.append([str(item.get(k, "-") or "-") for k in keys])

    table = Table(rows, repeatRows=1)
    style_cmds: list[tuple] = [
        ("FONT", (0, 0), (-1, -1), font, 9),
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#f3f4f6")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.HexColor("#1f2937")),
        ("LINEBELOW", (0, 0), (-1, 0), 0.5, colors.HexColor("#9ca3af")),
        ("GRID", (0, 1), (-1, -1), 0.25, colors.HexColor("#e5e7eb")),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]
    for col_idx, align in enumerate(aligns):
        style_cmds.append(("ALIGN", (col_idx, 0), (col_idx, -1), align))
    table.setStyle(TableStyle(style_cmds))
    return table


# ==================== 5 单据 generator ====================

def render_sales_order(data: dict) -> bytes:
    """销售订单 PDF.

    expected data: { orderNumber, orderDate, customerName, salesperson, totalAmount, remark, items: [{name, qty, unit, unitPrice, subtotal}], factory }
    """
    from reportlab.lib.units import cm
    from reportlab.platypus import Paragraph, Spacer

    s = _get_styles()
    buffer = io.BytesIO()
    doc = _make_doc(buffer)
    story: list[Any] = [
        Paragraph(data.get("factoryName") or "白垩纪食品", s["small"]),
        Paragraph("销售订单 · Sales Order", s["title"]),
        _kv_table([
            ("订单号", data.get("orderNumber", "-")),
            ("下单日期", data.get("orderDate", "-")),
            ("客户", data.get("customerName", "-")),
            ("销售员", data.get("salesperson", "-")),
            ("总金额", _fmt_money(data.get("totalAmount"))),
        ], s["font"]),
        Spacer(1, 0.5 * cm),
        Paragraph("订单明细", s["h2"]),
        _render_items_table(
            data.get("items") or [],
            [("产品", "name", "LEFT"), ("规格", "spec", "LEFT"),
             ("数量", "qty", "RIGHT"), ("单位", "unit", "CENTER"),
             ("单价", "unitPriceFormatted", "RIGHT"), ("小计", "subtotalFormatted", "RIGHT")],
            s["font"],
        ),
    ]
    if data.get("remark"):
        story.extend([Spacer(1, 0.5 * cm), Paragraph("备注", s["h2"]), Paragraph(str(data["remark"]), s["body"])])
    doc.build(story)
    return buffer.getvalue()


def render_purchase_order(data: dict) -> bytes:
    """采购订单 PDF — 含二维码 (供仓管员扫码入库).

    expected data: { orderNumber, orderDate, supplierName, expectedDeliveryDate, totalAmount, remark, items, qrPayload }
    """
    from reportlab.lib.units import cm
    from reportlab.platypus import Paragraph, Spacer, Table

    s = _get_styles()
    buffer = io.BytesIO()
    doc = _make_doc(buffer)

    qr_payload = data.get("qrPayload") or f"PO:{data.get('orderNumber', '-')}"
    qr_img = _build_qr_image(qr_payload, size_cm=2.5)

    header_kv = _kv_table([
        ("采购单号", data.get("orderNumber", "-")),
        ("下单日期", data.get("orderDate", "-")),
        ("供应商", data.get("supplierName", "-")),
        ("期望交货", data.get("expectedDeliveryDate", "-")),
        ("总金额", _fmt_money(data.get("totalAmount"))),
    ], s["font"], col_widths=(3.0 * cm, 9.0 * cm))

    if qr_img is not None:
        header_with_qr = Table(
            [[header_kv, qr_img]],
            colWidths=(12.0 * cm, 4.5 * cm),
        )
        header_with_qr.setStyle([("VALIGN", (0, 0), (-1, -1), "TOP")])
        story_header: list[Any] = [header_with_qr]
    else:
        story_header = [header_kv]

    story: list[Any] = [
        Paragraph(data.get("factoryName") or "白垩纪食品", s["small"]),
        Paragraph("采购订单 · Purchase Order", s["title"]),
        *story_header,
        Spacer(1, 0.5 * cm),
        Paragraph("采购明细", s["h2"]),
        _render_items_table(
            data.get("items") or [],
            [("原料", "name", "LEFT"), ("规格", "spec", "LEFT"),
             ("数量", "qty", "RIGHT"), ("单位", "unit", "CENTER"),
             ("单价", "unitPriceFormatted", "RIGHT"), ("小计", "subtotalFormatted", "RIGHT")],
            s["font"],
        ),
    ]
    if data.get("remark"):
        story.extend([Spacer(1, 0.5 * cm), Paragraph("备注", s["h2"]), Paragraph(str(data["remark"]), s["body"])])
    story.extend([
        Spacer(1, 1.0 * cm),
        Paragraph("仓管员收货确认: ____________________________", s["body"]),
        Paragraph("送货员签名: ________________________________", s["body"]),
    ])
    doc.build(story)
    return buffer.getvalue()


def render_quotation(data: dict) -> bytes:
    """报价单 PDF.

    expected data: { quotationNumber, quotationDate, customerName, salesperson, validUntil, totalAmount, items, remark }
    """
    from reportlab.lib.units import cm
    from reportlab.platypus import Paragraph, Spacer

    s = _get_styles()
    buffer = io.BytesIO()
    doc = _make_doc(buffer)
    story: list[Any] = [
        Paragraph(data.get("factoryName") or "白垩纪食品", s["small"]),
        Paragraph("报价单 · Quotation", s["title"]),
        _kv_table([
            ("报价编号", data.get("quotationNumber", "-")),
            ("报价日期", data.get("quotationDate", "-")),
            ("客户", data.get("customerName", "-")),
            ("有效期至", data.get("validUntil", "-")),
            ("销售员", data.get("salesperson", "-")),
            ("报价合计", _fmt_money(data.get("totalAmount"))),
        ], s["font"]),
        Spacer(1, 0.5 * cm),
        Paragraph("报价明细", s["h2"]),
        _render_items_table(
            data.get("items") or [],
            [("产品", "name", "LEFT"), ("规格", "spec", "LEFT"),
             ("数量", "qty", "RIGHT"), ("单位", "unit", "CENTER"),
             ("单价", "unitPriceFormatted", "RIGHT"), ("小计", "subtotalFormatted", "RIGHT")],
            s["font"],
        ),
    ]
    if data.get("remark"):
        story.extend([Spacer(1, 0.5 * cm), Paragraph("条款 / 备注", s["h2"]), Paragraph(str(data["remark"]), s["body"])])
    doc.build(story)
    return buffer.getvalue()


def render_production_task(data: dict) -> bytes:
    """生产任务单 PDF.

    expected data: { taskNumber, productName, plannedQuantity, unit, startDate, endDate, workshopName, supervisor, processes: [{seq, name, duration}] }
    """
    from reportlab.lib.units import cm
    from reportlab.platypus import Paragraph, Spacer

    s = _get_styles()
    buffer = io.BytesIO()
    doc = _make_doc(buffer)
    story: list[Any] = [
        Paragraph(data.get("factoryName") or "白垩纪食品", s["small"]),
        Paragraph("生产任务单 · Production Task", s["title"]),
        _kv_table([
            ("任务单号", data.get("taskNumber", "-")),
            ("产品", data.get("productName", "-")),
            ("计划数量", f'{_fmt_qty(data.get("plannedQuantity"))} {data.get("unit", "")}'),
            ("生产车间", data.get("workshopName", "-")),
            ("开始时间", data.get("startDate", "-")),
            ("计划完成", data.get("endDate", "-")),
            ("责任人", data.get("supervisor", "-")),
        ], s["font"]),
        Spacer(1, 0.5 * cm),
        Paragraph("工序流水", s["h2"]),
        _render_items_table(
            data.get("processes") or [],
            [("序号", "seq", "CENTER"), ("工序", "name", "LEFT"),
             ("预计耗时", "duration", "RIGHT"), ("操作人", "operator", "LEFT")],
            s["font"],
        ),
    ]
    doc.build(story)
    return buffer.getvalue()


def render_material_requisition(data: dict) -> bytes:
    """领料单 PDF.

    expected data: { requisitionNumber, productName, plannedQuantity, requestDate, workshop, requester, items: [{name, plannedQty, actualQty, unit, batch}] }
    """
    from reportlab.lib.units import cm
    from reportlab.platypus import Paragraph, Spacer

    s = _get_styles()
    buffer = io.BytesIO()
    doc = _make_doc(buffer)
    story: list[Any] = [
        Paragraph(data.get("factoryName") or "白垩纪食品", s["small"]),
        Paragraph("领料单 · Material Requisition", s["title"]),
        _kv_table([
            ("领料单号", data.get("requisitionNumber", "-")),
            ("生产产品", data.get("productName", "-")),
            ("计划生产", f'{_fmt_qty(data.get("plannedQuantity"))} {data.get("unit", "")}'),
            ("领料日期", data.get("requestDate", "-")),
            ("领料车间", data.get("workshop", "-")),
            ("领料人", data.get("requester", "-")),
        ], s["font"]),
        Spacer(1, 0.5 * cm),
        Paragraph("领料明细", s["h2"]),
        _render_items_table(
            data.get("items") or [],
            [("原料", "name", "LEFT"), ("批次", "batch", "LEFT"),
             ("应领", "plannedQty", "RIGHT"), ("实领", "actualQty", "RIGHT"),
             ("单位", "unit", "CENTER")],
            s["font"],
        ),
        Spacer(1, 1.0 * cm),
        Paragraph("仓管员发料签名: ____________________________", s["body"]),
        Paragraph("领料人签名: ________________________________", s["body"]),
    ]
    doc.build(story)
    return buffer.getvalue()


# ==================== Internal helper: KV table ====================

def _kv_table(pairs: list[tuple[str, str]], font: str, col_widths: tuple = None) -> Any:
    from reportlab.lib import colors
    from reportlab.lib.units import cm
    from reportlab.platypus import Table, TableStyle

    rows = [[label, value] for label, value in pairs]
    widths = col_widths or (3.0 * cm, 13.5 * cm)
    table = Table(rows, colWidths=widths)
    table.setStyle(TableStyle([
        ("FONT", (0, 0), (-1, -1), font, 10),
        ("TEXTCOLOR", (0, 0), (0, -1), colors.HexColor("#6b7280")),
        ("TEXTCOLOR", (1, 0), (1, -1), colors.HexColor("#1f2937")),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LINEBELOW", (0, 0), (-1, -1), 0.25, colors.HexColor("#e5e7eb")),
        ("LEFTPADDING", (0, 0), (-1, -1), 4),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
    ]))
    return table


RENDERERS: dict[str, Any] = {
    "sales-order": render_sales_order,
    "purchase-order": render_purchase_order,
    "quotation": render_quotation,
    "production-task": render_production_task,
    "material-requisition": render_material_requisition,
}
