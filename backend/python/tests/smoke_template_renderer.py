"""Day 5 smoke test — drives render_schema_to_pdf with realistic schemas + mock data.

Writes one PDF per entityType under /tmp/cretas-print-smoke/. Run from
backend/python with the python that has reportlab + qrcode installed:
    python tests/smoke_template_renderer.py

Verifies the schema-driven renderer produces non-empty PDFs for all 6 PRINT_*
entityTypes that Day 4 added to FormTemplateServiceImpl.SUPPORTED_ENTITY_TYPES.

This is NOT a pytest — it's a one-shot binary verifier. Pytest fixtures for the
template renderer come in Day 8 acceptance.
"""
from __future__ import annotations

import os
import sys
import pathlib

# Make 'printing.*' importable when run from backend/python/.
sys.path.insert(0, str(pathlib.Path(__file__).parent.parent))

from printing.services.template_renderer import render_schema_to_pdf  # noqa: E402


# ── Sample schemas (1 per entityType) ──────────────────────────────────────

_SALES_ORDER_SCHEMA = {
    "version": 1,
    "canvas": {"width": 595, "height": 842, "orientation": "portrait",
               "marginTop": 40, "marginBottom": 40, "marginLeft": 50, "marginRight": 50},
    "elements": [
        {"id": "logo",       "type": "image", "x": 50,  "y": 50,  "width": 80, "height": 40, "src": ""},
        {"id": "title",      "type": "text",  "x": 200, "y": 60,  "text": "销售订单",
         "fontSize": 20, "bold": True, "color": "#1f2937", "align": "center", "width": 200},
        {"id": "factoryName","type": "field", "x": 50,  "y": 110, "binding": "{{factoryName}}", "fontSize": 10, "color": "#6b7280"},
        {"id": "orderNumber","type": "field", "x": 50,  "y": 150, "binding": "{{order.orderNumber}}", "fontSize": 14, "bold": True},
        {"id": "orderDate",  "type": "field", "x": 50,  "y": 175, "binding": "{{format.date(order.orderDate, 'YYYY-MM-DD')}}", "fontSize": 12},
        {"id": "customer",   "type": "field", "x": 50,  "y": 200, "binding": "{{order.customerName}}", "fontSize": 12},
        {"id": "total",      "type": "field", "x": 50,  "y": 225, "binding": "{{format.currency(order.totalAmount)}}", "fontSize": 14, "bold": True, "color": "#dc2626"},
        {"id": "qr",         "type": "qr",    "x": 450, "y": 60,  "size": 80, "content": "SO:{{order.orderNumber}}"},
        {"id": "items",      "type": "table", "x": 50,  "y": 280, "width": 495, "binding": "{{order.items}}",
         "rowHeight": 24, "headerBg": "#f3f4f6", "headerFontSize": 11, "bodyFontSize": 10,
         "columns": [
             {"header": "物料",   "binding": "{{item.materialName}}", "width": 200, "align": "left"},
             {"header": "数量",   "binding": "{{item.quantity}}",      "width": 80,  "align": "right", "format": "qty"},
             {"header": "单位",   "binding": "{{item.unit}}",          "width": 60,  "align": "center"},
             {"header": "单价",   "binding": "{{item.unitPrice}}",     "width": 80,  "align": "right", "format": "currency"},
             {"header": "小计",   "binding": "{{item.subtotal}}",      "width": 75,  "align": "right", "format": "currency"},
         ]},
        {"id": "stamp",      "type": "stamp", "x": 420, "y": 700, "size": 100, "stampId": "default", "opacity": 0.7},
    ],
}

_SALES_ORDER_DATA = {
    "factoryName": "白垩纪食品 — F001",
    "factoryId": "F001",
    "order": {
        "id": "SO-001",
        "orderNumber": "SO-20260516-001",
        "orderDate": "2026-05-16",
        "customerName": "示例餐饮连锁",
        "salesperson": "张三",
        "totalAmount": 5565.0,
        "items": [
            {"materialName": "酱牛肉", "quantity": 30, "unit": "kg", "unitPrice": 88, "subtotal": 2640},
            {"materialName": "盐水鸭", "quantity": 25, "unit": "只", "unitPrice": 45, "subtotal": 1125},
            {"materialName": "卤豆干", "quantity": 100, "unit": "kg", "unitPrice": 18, "subtotal": 1800},
        ],
    },
}


_WEIGHING_SLIP_SCHEMA = {
    "version": 1,
    "canvas": {"width": 595, "height": 842, "orientation": "portrait"},
    "elements": [
        {"id": "title",      "type": "text",  "x": 200, "y": 50,  "text": "称重单",
         "fontSize": 22, "bold": True, "align": "center", "width": 200},
        {"id": "slipNum",    "type": "field", "x": 50,  "y": 100, "binding": "称重单号: {{slip.slipNumber}}", "fontSize": 12, "bold": True},
        {"id": "product",    "type": "field", "x": 50,  "y": 125, "binding": "产品: {{slip.productName}}",  "fontSize": 11},
        {"id": "partner",    "type": "field", "x": 50,  "y": 145, "binding": "客户/供应商: {{slip.partnerName}}", "fontSize": 11},
        {"id": "weighDate",  "type": "field", "x": 50,  "y": 165, "binding": "过磅日期: {{format.date(slip.weighDate)}}", "fontSize": 11},
        {"id": "operator",   "type": "field", "x": 50,  "y": 185, "binding": "操作员: {{slip.operator}}", "fontSize": 11},
        {"id": "totals",     "type": "field", "x": 50,  "y": 220, "binding": "总毛重: {{format.qty(slip.grossWeight)}} kg  |  总皮重: {{format.qty(slip.tareWeight)}} kg  |  总净重: {{format.qty(slip.netWeight)}} kg",
         "fontSize": 12, "bold": True, "color": "#dc2626"},
        {"id": "table",      "type": "table", "x": 50, "y": 270, "width": 495, "binding": "{{slip.items}}",
         "rowHeight": 22, "headerBg": "#f3f4f6", "headerFontSize": 10, "bodyFontSize": 9,
         "columns": [
             {"header": "箱号", "binding": "{{item.boxNo}}",       "width": 80,  "align": "center"},
             {"header": "毛重(kg)", "binding": "{{item.grossWeight}}", "width": 130, "align": "right", "format": "qty"},
             {"header": "皮重(kg)", "binding": "{{item.tareWeight}}",  "width": 130, "align": "right", "format": "qty"},
             {"header": "净重(kg)", "binding": "{{item.netWeight}}",   "width": 155, "align": "right", "format": "qty"},
         ]},
        {"id": "barcode",    "type": "barcode", "x": 50, "y": 700, "width": 200, "height": 50, "content": "{{slip.slipNumber}}", "format": "CODE128"},
        {"id": "stamp",      "type": "stamp",   "x": 420, "y": 700, "size": 90, "stampId": "default", "opacity": 0.7},
    ],
}

_WEIGHING_SLIP_DATA = {
    "factoryName": "白垩纪食品 — F001",
    "slip": {
        "slipNumber": "WS-20260516-001",
        "productName": "卤鸭货",
        "partnerName": "示例配送站",
        "weighDate": "2026-05-16",
        "operator": "钱七",
        "grossWeight": 158.6,
        "tareWeight": 23.4,
        "netWeight": 135.2,
        "items": [
            {"boxNo": "B001", "grossWeight": 26.5, "tareWeight": 3.9, "netWeight": 22.6},
            {"boxNo": "B002", "grossWeight": 27.1, "tareWeight": 3.9, "netWeight": 23.2},
            {"boxNo": "B003", "grossWeight": 25.8, "tareWeight": 3.9, "netWeight": 21.9},
            {"boxNo": "B004", "grossWeight": 26.3, "tareWeight": 3.9, "netWeight": 22.4},
            {"boxNo": "B005", "grossWeight": 26.4, "tareWeight": 3.9, "netWeight": 22.5},
            {"boxNo": "B006", "grossWeight": 26.5, "tareWeight": 3.9, "netWeight": 22.6},
        ],
    },
}


def _minimal_test_schema(entity_type: str, title: str) -> dict:
    """Tiny one-element schema for entityTypes that don't get a full sample."""
    return {
        "version": 1,
        "canvas": {"width": 595, "height": 842, "orientation": "portrait"},
        "elements": [
            {"id": "title", "type": "text", "x": 200, "y": 80, "text": title,
             "fontSize": 22, "bold": True, "align": "center", "width": 200},
            {"id": "entityTag", "type": "text", "x": 50, "y": 130,
             "text": f"entityType: {entity_type}", "fontSize": 11, "color": "#6b7280"},
            {"id": "note", "type": "text", "x": 50, "y": 160,
             "text": "(Day 5 smoke — minimal schema)", "fontSize": 10, "color": "#9ca3af"},
        ],
    }


CASES = [
    ("PRINT_SALES_ORDER",          _SALES_ORDER_SCHEMA,          _SALES_ORDER_DATA),
    ("PRINT_PURCHASE_ORDER",       _minimal_test_schema("PRINT_PURCHASE_ORDER", "采购单"),       {}),
    ("PRINT_QUOTATION",            _minimal_test_schema("PRINT_QUOTATION", "报价单"),            {}),
    ("PRINT_PRODUCTION_TASK",      _minimal_test_schema("PRINT_PRODUCTION_TASK", "生产任务单"), {}),
    ("PRINT_MATERIAL_REQUISITION", _minimal_test_schema("PRINT_MATERIAL_REQUISITION", "领料单"),{}),
    ("PRINT_WEIGHING_SLIP",        _WEIGHING_SLIP_SCHEMA,        _WEIGHING_SLIP_DATA),
]


def main() -> int:
    out_dir = pathlib.Path(os.environ.get("CRETAS_SMOKE_OUT", "/tmp/cretas-print-smoke"))
    out_dir.mkdir(parents=True, exist_ok=True)

    failures = 0
    for entity_type, schema, data in CASES:
        pdf = render_schema_to_pdf(schema, data)
        path = out_dir / f"{entity_type}.pdf"
        if not pdf or len(pdf) < 1000:
            print(f"FAIL: {entity_type} — empty or suspiciously small ({len(pdf) if pdf else 0} bytes)")
            failures += 1
            continue
        if not pdf.startswith(b"%PDF-"):
            print(f"FAIL: {entity_type} — missing %PDF- magic")
            failures += 1
            continue
        path.write_bytes(pdf)
        print(f"OK:   {entity_type}  →  {path}  ({len(pdf):,} bytes)")

    print()
    print(f"Output dir: {out_dir}")
    print(f"Summary: {len(CASES) - failures}/{len(CASES)} passed")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
