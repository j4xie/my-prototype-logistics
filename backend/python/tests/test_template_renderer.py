"""C-PRT-EDITOR-1 (Sprint 3 Track-J) — template_renderer + /preview-template tests.

Covers:
  - Binding resolver: plain, format helpers, missing fields, mixed, computed,
    array resolution, edge cases (None/nested-None)
  - Schema renderer: all 7 element types, empty data, regression (no exceptions)
  - FastAPI endpoint /api/printing/preview-template: happy path + 4 error paths

Run from backend/python:
  pytest tests/test_template_renderer.py -v
"""
from __future__ import annotations

import json
import sys
import pathlib

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

# Make 'printing.*' importable.
sys.path.insert(0, str(pathlib.Path(__file__).parent.parent))

from printing.services.template_renderer import (  # noqa: E402
    render_schema_to_pdf,
    unwrap_schema,
    _render_binding,
    _resolve_array,
)


# ============================================================
#  Binding resolver
# ============================================================


class TestBindingResolver:
    def test_plain_dotted_access(self):
        data = {"order": {"orderNumber": "SO-001"}}
        assert _render_binding("{{order.orderNumber}}", data) == "SO-001"

    def test_format_currency(self):
        data = {"order": {"totalAmount": 1234.5}}
        assert _render_binding("{{format.currency(order.totalAmount)}}", data) == "¥1,234.50"

    def test_format_currency_integer(self):
        data = {"order": {"amount": 100}}
        assert _render_binding("{{format.currency(order.amount)}}", data) == "¥100.00"

    def test_format_date_default(self):
        data = {"d": "2026-05-16"}
        assert _render_binding("{{format.date(d)}}", data) == "2026-05-16"

    def test_format_date_custom_pattern(self):
        data = {"d": "2026-05-16"}
        assert _render_binding('{{format.date(d, "YYYY-MM-DD")}}', data) == "2026-05-16"

    def test_format_qty_strips_trailing_zeros(self):
        assert _render_binding("{{format.qty(n)}}", {"n": 30}) == "30"
        assert _render_binding("{{format.qty(n)}}", {"n": 30.5}) == "30.50"

    def test_format_percent(self):
        assert _render_binding("{{format.percent(n)}}", {"n": 0.155}) == "15.50%"

    def test_missing_field_returns_dash(self):
        assert _render_binding("{{a.missing}}", {"a": {}}) == "-"

    def test_nested_none_returns_dash(self):
        assert _render_binding("{{a.b.c}}", {"a": None}) == "-"

    def test_mixed_template(self):
        data = {"order": {"orderNumber": "SO-001", "totalAmount": 1234.5}}
        out = _render_binding("订单 {{order.orderNumber}}: {{format.currency(order.totalAmount)}}", data)
        assert out == "订单 SO-001: ¥1,234.50"

    def test_computed_returns_placeholder(self):
        assert _render_binding("{{computed.totalAmount}}", {}) == "[computed.totalAmount]"

    def test_no_binding_returns_input_unchanged(self):
        assert _render_binding("plain text", {}) == "plain text"

    def test_empty_string_safe(self):
        assert _render_binding("", {}) == ""

    def test_resolve_array_empty(self):
        assert _resolve_array("{{order.items}}", {"order": {"items": []}}) == []

    def test_resolve_array_populated(self):
        rows = _resolve_array("{{order.items}}", {"order": {"items": [{"a": 1}, {"a": 2}]}})
        assert rows == [{"a": 1}, {"a": 2}]

    def test_resolve_array_non_list_returns_empty(self):
        # Defensive: binding points to a scalar → return [] rather than crash on iteration.
        assert _resolve_array("{{order.items}}", {"order": {"items": "not-a-list"}}) == []


# ============================================================
#  Schema renderer — 7 element types
# ============================================================


def _wrap_schema(elements: list[dict]) -> dict:
    """Build a minimal schema with the given elements at A4 portrait."""
    return {
        "version": 1,
        "canvas": {"width": 595, "height": 842, "orientation": "portrait"},
        "elements": elements,
    }


class TestRenderer:
    def test_minimal_schema_renders(self):
        pdf = render_schema_to_pdf(
            _wrap_schema(
                [
                    {"id": "t1", "type": "text", "x": 50, "y": 50, "text": "Hello", "fontSize": 12},
                ]
            ),
            {},
        )
        assert pdf.startswith(b"%PDF-")
        assert len(pdf) > 1000

    def test_field_with_binding(self):
        pdf = render_schema_to_pdf(
            _wrap_schema(
                [
                    {"id": "f1", "type": "field", "x": 50, "y": 50, "binding": "{{name}}", "fontSize": 12},
                ]
            ),
            {"name": "示例"},
        )
        assert pdf.startswith(b"%PDF-")

    def test_table_with_empty_rows_renders_placeholder(self):
        # The renderer must not crash on empty rows; it draws a placeholder line.
        pdf = render_schema_to_pdf(
            _wrap_schema(
                [
                    {
                        "id": "tbl",
                        "type": "table",
                        "x": 50,
                        "y": 100,
                        "width": 495,
                        "rowHeight": 24,
                        "binding": "{{items}}",
                        "columns": [{"header": "Name", "binding": "{{item.name}}", "width": 200, "align": "left"}],
                    },
                ]
            ),
            {"items": []},
        )
        assert pdf.startswith(b"%PDF-")

    def test_table_with_rows_and_column_format(self):
        pdf = render_schema_to_pdf(
            _wrap_schema(
                [
                    {
                        "id": "tbl",
                        "type": "table",
                        "x": 50,
                        "y": 100,
                        "width": 200,
                        "rowHeight": 24,
                        "binding": "{{items}}",
                        "columns": [
                            {"header": "Name", "binding": "{{item.name}}", "width": 100, "align": "left"},
                            {
                                "header": "Price",
                                "binding": "{{item.price}}",
                                "width": 100,
                                "align": "right",
                                "format": "currency",
                            },
                        ],
                    },
                ]
            ),
            {"items": [{"name": "A", "price": 88}]},
        )
        assert pdf.startswith(b"%PDF-")

    def test_qr_static_content(self):
        pdf = render_schema_to_pdf(
            _wrap_schema(
                [
                    {"id": "q", "type": "qr", "x": 50, "y": 50, "size": 80, "content": "static"},
                ]
            ),
            {},
        )
        assert pdf.startswith(b"%PDF-")

    def test_qr_unresolved_binding_skipped(self):
        # If content remains unresolved (still has {{}}), QR is silently skipped
        # rather than rendering a bogus code.
        pdf = render_schema_to_pdf(
            _wrap_schema(
                [
                    {"id": "q", "type": "qr", "x": 50, "y": 50, "size": 80, "content": "{{missing}}"},
                ]
            ),
            {},
        )
        assert pdf.startswith(b"%PDF-")

    def test_barcode_renders(self):
        pdf = render_schema_to_pdf(
            _wrap_schema(
                [
                    {"id": "b", "type": "barcode", "x": 50, "y": 50, "width": 160, "height": 40, "content": "ABC123"},
                ]
            ),
            {},
        )
        assert pdf.startswith(b"%PDF-")

    def test_image_data_uri(self):
        # 1x1 transparent PNG data URI
        png_uri = (
            "data:image/png;base64,"
            "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII="
        )
        pdf = render_schema_to_pdf(
            _wrap_schema(
                [
                    {"id": "img", "type": "image", "x": 50, "y": 50, "width": 100, "height": 50, "src": png_uri},
                ]
            ),
            {},
        )
        assert pdf.startswith(b"%PDF-")

    def test_image_missing_src_falls_back_to_placeholder(self):
        pdf = render_schema_to_pdf(
            _wrap_schema(
                [
                    {"id": "img", "type": "image", "x": 50, "y": 50, "width": 100, "height": 50, "src": ""},
                ]
            ),
            {},
        )
        assert pdf.startswith(b"%PDF-")

    def test_stamp_renders(self):
        pdf = render_schema_to_pdf(
            _wrap_schema(
                [
                    {"id": "s", "type": "stamp", "x": 400, "y": 700, "size": 100, "stampId": "default", "opacity": 0.7},
                ]
            ),
            {},
        )
        assert pdf.startswith(b"%PDF-")

    def test_unknown_element_type_logged_and_skipped(self):
        # Defensive: a schema with an unknown element type should still render the rest.
        pdf = render_schema_to_pdf(
            _wrap_schema(
                [
                    {"id": "bad", "type": "future_widget", "x": 50, "y": 50},
                    {"id": "good", "type": "text", "x": 50, "y": 100, "text": "ok", "fontSize": 12},
                ]
            ),
            {},
        )
        assert pdf.startswith(b"%PDF-")


# ============================================================
#  unwrap_schema
# ============================================================


class TestUnwrap:
    def test_unwrap_valid(self):
        wrapped = json.dumps(
            {
                "type": "object",
                "properties": {"_printSchema": {"version": 1, "canvas": {}, "elements": []}},
            }
        )
        out = unwrap_schema(wrapped)
        assert out["version"] == 1

    def test_unwrap_missing_printschema_400(self):
        from fastapi import HTTPException

        wrapped = json.dumps({"type": "object", "properties": {"name": {}}})
        with pytest.raises(HTTPException) as exc:
            unwrap_schema(wrapped)
        assert exc.value.status_code == 400

    def test_unwrap_invalid_json_400(self):
        from fastapi import HTTPException

        with pytest.raises(HTTPException) as exc:
            unwrap_schema("{not-json")
        assert exc.value.status_code == 400

    def test_unwrap_empty_400(self):
        from fastapi import HTTPException

        with pytest.raises(HTTPException) as exc:
            unwrap_schema("")
        assert exc.value.status_code == 400


# ============================================================
#  Endpoint — POST /api/printing/preview-template
# ============================================================


@pytest.fixture
def client():
    app = FastAPI()
    from printing.api import print as printing_api

    app.include_router(printing_api.router, prefix="/api/printing")
    return TestClient(app)


_VALID_SCHEMA_JSON = json.dumps(
    {
        "type": "object",
        "properties": {
            "_printSchema": {
                "version": 1,
                "canvas": {"width": 595, "height": 842, "orientation": "portrait"},
                "elements": [
                    {"id": "t", "type": "text", "x": 50, "y": 50, "text": "Hello", "fontSize": 12},
                    {"id": "f", "type": "field", "x": 50, "y": 80, "binding": "{{name}}", "fontSize": 12},
                ],
            },
        },
    }
)


class TestEndpoint:
    def test_inline_schema_happy_path(self, client):
        resp = client.post(
            "/api/printing/preview-template",
            json={
                "factoryId": "F001",
                "inlineSchemaJson": _VALID_SCHEMA_JSON,
                "entityType": "PRINT_SALES_ORDER",
                "entityData": {"name": "示例"},
            },
        )
        assert resp.status_code == 200
        assert resp.headers["content-type"].startswith("application/pdf")
        assert resp.content.startswith(b"%PDF-")
        assert len(resp.content) > 1000

    def test_missing_schema_returns_400(self, client):
        resp = client.post(
            "/api/printing/preview-template",
            json={
                "factoryId": "F001",
                "entityType": "PRINT_SALES_ORDER",
            },
        )
        assert resp.status_code == 400

    def test_missing_factory_id_returns_400(self, client):
        resp = client.post(
            "/api/printing/preview-template",
            json={
                "inlineSchemaJson": _VALID_SCHEMA_JSON,
                "entityType": "PRINT_SALES_ORDER",
            },
        )
        assert resp.status_code == 400

    def test_malformed_schema_returns_400(self, client):
        resp = client.post(
            "/api/printing/preview-template",
            json={
                "factoryId": "F001",
                "inlineSchemaJson": json.dumps({"foo": "bar"}),  # no _printSchema
                "entityType": "PRINT_SALES_ORDER",
            },
        )
        assert resp.status_code == 400

    def test_empty_entity_data_still_renders(self, client):
        # When the editor preview runs before any field binding, the PDF
        # should still render with all '-' placeholders rather than 500.
        resp = client.post(
            "/api/printing/preview-template",
            json={
                "factoryId": "F001",
                "inlineSchemaJson": _VALID_SCHEMA_JSON,
                "entityType": "PRINT_SALES_ORDER",
                # no entityData key
            },
        )
        assert resp.status_code == 200
        assert resp.content.startswith(b"%PDF-")
