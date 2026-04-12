"""Single-store P&L one-pager section — composes prior section outputs into a P&L summary.

Wraps ``StorePnlOnePager.build()`` which is purely a composition layer over
existing data: it does **no new computation**, it just renders prior section
outputs (financial_metrics, diagnostics, benchmark_alerts, channel_margin,
temporal_comparison) into the boss-friendly one-pager structure.

This handler is designed to run **after** DiagnosticsHandler / BenchmarkAlertsHandler
/ ChannelMarginHandler / TemporalComparisonHandler in the orchestrator pipeline.
The orchestrator should stage their outputs in ``context`` before invoking
this handler.

Required input (one of):
  - ``context["financial_metrics"]`` (a FinancialMetrics.to_dict() dict), OR
  - ``request.params["financial_metrics"]`` (standalone mode)

Optional context keys (for richer output):
  - ``context["diagnostics"]`` — either the raw list[dict] or the full
    DiagnosticsHandler.data dict (we extract data["diagnoses"]).
  - ``context["benchmark_alerts"]`` — either the raw list[dict] or the
    full BenchmarkAlertsHandler.data dict (we extract data["alerts"]).
  - ``context["channel_margin"]`` — the ChannelMarginHandler.data dict.
  - ``context["temporal_comparison"]`` — the TemporalComparisonHandler.data dict.

Without financial_metrics this section is meaningless and returns SKIPPED.
"""
from __future__ import annotations

import time
from typing import Any, Optional

from smartbi.services.finance.controllable_profit import ControllableProfitCalculator
from smartbi.services.restaurant.sections.base import (
    AbstractSectionHandler,
    SectionRequest,
    SectionResponse,
)


def _coerce_dict(value: Any) -> Optional[dict]:
    """Best-effort: convert FinancialMetrics-like or dict-like to dict."""
    if value is None:
        return None
    if isinstance(value, dict):
        return value
    to_dict = getattr(value, "to_dict", None)
    if callable(to_dict):
        try:
            return to_dict()
        except Exception:
            return None
    return None


def _extract_list(value: Any, inner_key: str) -> Optional[list]:
    """Extract a list from either a raw list or a dict containing the inner_key.

    Handles both upstream conventions:
      1. ``context["diagnostics"] = [...]`` (orchestrator pre-extracted)
      2. ``context["diagnostics"] = {"diagnoses": [...], "criticalCount": ...}``
         (full DiagnosticsHandler.data passed through)
    """
    if value is None:
        return None
    if isinstance(value, list):
        return value
    if isinstance(value, dict):
        inner = value.get(inner_key)
        if isinstance(inner, list):
            return inner
    return None


class StorePnlOnePagerHandler(AbstractSectionHandler):
    """Composes upstream section outputs into a single-store P&L one-pager."""
    section_name = "store_pnl_one_pager"

    def __init__(self) -> None:
        self._builder = None

    def _get_builder(self):
        """Lazy-build the stateless one-pager builder."""
        if self._builder is None:
            from smartbi.services.restaurant.store_pnl_one_pager import StorePnlOnePager
            self._builder = StorePnlOnePager()
        return self._builder

    def compute(self, request: SectionRequest, context: dict[str, Any]) -> SectionResponse:
        started = time.time()

        # ── financial_metrics is mandatory (the P&L body) ──
        fm_raw = context.get("financial_metrics")
        if fm_raw is None:
            fm_raw = request.params.get("financial_metrics")
        financial_metrics = _coerce_dict(fm_raw)
        if not financial_metrics:
            return self.skipped(
                request,
                "未提供 financial_metrics (需 DiagnosticsHandler 先运行或直接传入)",
                started,
            )

        # ── Optional upstream section outputs ──
        # Each can be either a raw list/dict or the full SectionResponse.data
        # dict from upstream handlers; _extract_list / _coerce_dict normalize.
        diagnostics_raw = context.get("diagnostics") or request.params.get("diagnostics")
        diagnostics = _extract_list(diagnostics_raw, "diagnoses") or []

        benchmark_alerts_raw = (
            context.get("benchmark_alerts") or request.params.get("benchmark_alerts")
        )
        benchmark_alerts = _extract_list(benchmark_alerts_raw, "alerts") or []

        channel_margin = _coerce_dict(
            context.get("channel_margin") or request.params.get("channel_margin")
        )
        temporal_comparison = _coerce_dict(
            context.get("temporal_comparison") or request.params.get("temporal_comparison")
        )

        store_name = request.store_name or request.store_id or "本店"

        try:
            report = self._get_builder().build(
                financial_metrics=financial_metrics,
                diagnostics=diagnostics,
                benchmark_alerts=benchmark_alerts,
                channel_margin=channel_margin,
                temporal_comparison=temporal_comparison,
                store_name=store_name,
                period=request.period,
                sub_sector=request.sub_sector,
            )
        except Exception as e:
            return self.skipped(request, f"store_pnl 构建失败: {e}", started)

        if hasattr(report, "to_dict"):
            data = report.to_dict()
        elif isinstance(report, dict):
            data = report
        else:
            return self.skipped(
                request,
                f"store_pnl 返回非 dict 类型: {type(report).__name__}",
                started,
            )

        # ── Controllable profit overlay ──
        # Extracted from financial_metrics (camelCase keys) because data at this
        # point is the composed one-pager dict (pnlLines, topDiagnostics, …)
        # which no longer has flat numeric cost fields.
        if financial_metrics:
            controllable_calc = ControllableProfitCalculator()
            non_controllable_keys = (request.params or {}).get(
                "non_controllable_keys",
                ["rent", "tax", "depreciation", "insurance"],
            )
            # Map camelCase financial_metrics keys → snake_case cost_items dict
            cost_field_map = {
                "foodCost": "food_cost",
                "laborCost": "labor_cost",
                "rent": "rent",
                "utilities": "utilities",
                "marketing": "marketing",
                "tax": "tax",
                "depreciation": "depreciation",
                "insurance": "insurance",
                "repairs": "repairs",
                "otherCost": "other_cost",
            }
            cost_breakdown: dict = {}
            for fm_key, calc_key in cost_field_map.items():
                val = financial_metrics.get(fm_key)
                if val is not None and isinstance(val, (int, float)):
                    cost_breakdown[calc_key] = float(val)

            if cost_breakdown:
                revenue_val = (
                    financial_metrics.get("revenue")
                    or financial_metrics.get("totalRevenue")
                    or financial_metrics.get("netRevenue")
                    or 0
                )
                controllable = controllable_calc.compute(
                    revenue=float(revenue_val),
                    cost_items=cost_breakdown,
                    non_controllable_keys=non_controllable_keys,
                )
                data["controllable_profit"] = controllable

        return self.ok(request, data=data, started=started)
