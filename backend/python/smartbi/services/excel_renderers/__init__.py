"""Renderer registry.

Each customer/template combo registers a render(report_data, labels) → BytesIO
function here. Multi-tenant by registry lookup; spec §7.1.
"""
from smartbi.services.excel_renderers.qhj_revenue_v1 import render as _qhj_v1

RENDERERS = {
    "qhj_revenue_v1": _qhj_v1,
}
