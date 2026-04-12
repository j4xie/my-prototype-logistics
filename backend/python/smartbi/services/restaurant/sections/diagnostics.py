from __future__ import annotations

"""Diagnostics section — runs DiagnosticsEngine on financial metrics."""

import time
from typing import Any

from smartbi.shared.diagnostics_engine import DiagnosticsEngine
from smartbi.services.restaurant.sections.base import (
    AbstractSectionHandler,
    SectionRequest,
    SectionResponse,
)


class DiagnosticsHandler(AbstractSectionHandler):
    """Runs the restaurant diagnostics engine against provided financial metrics.

    Requires `request.params["financial_data"]` with at least a `current` dict,
    OR a pre-extracted metrics dict in `context["financial_metrics"]` (batch
    mode, avoids re-parsing Excel).

    The underlying DiagnosticsEngine is cached per-sub_sector because loading
    benchmark YAMLs has non-trivial cost.
    """
    section_name = "diagnostics"

    def __init__(self) -> None:
        # One engine instance per sub_sector; cached lazily across compute() calls.
        self._engines_by_sector: dict[str, DiagnosticsEngine] = {}

    def compute(self, request: SectionRequest, context: dict[str, Any]) -> SectionResponse:
        started = time.time()
        financial_data = request.params.get("financial_data") or {}
        if not financial_data:
            return self.skipped(request, "未提供 financial_data", started)

        # Reuse pre-extracted metrics from context if available (batch mode)
        metrics = context.get("financial_metrics")
        if metrics is None:
            # Standalone mode: the 'current' dict IS the metrics input. The
            # caller is expected to pass a well-formed dict with keys the
            # diagnostics registry knows about (food_cost_ratio, etc).
            # The full analyzer.py does fancier extraction; the section handler
            # defers to the caller for clarity.
            metrics = financial_data.get("current") or {}
            if not metrics:
                return self.skipped(request, "financial_data.current 缺失", started)

        # Normalize to dict
        if not isinstance(metrics, dict):
            try:
                metrics = metrics.to_dict()
            except AttributeError:
                return self.skipped(
                    request, f"financial_metrics 不是 dict 也没有 to_dict(): {type(metrics).__name__}", started
                )

        engine = self._engines_by_sector.get(request.sub_sector)
        if engine is None:
            engine = DiagnosticsEngine(domain="restaurant", sub_sector=request.sub_sector)
            self._engines_by_sector[request.sub_sector] = engine

        try:
            diagnoses = engine.run(metrics)
        except Exception as e:
            return self.skipped(request, f"DiagnosticsEngine 运行失败: {e}", started)

        return self.ok(
            request,
            data={
                "diagnoses": [d.to_dict() for d in diagnoses],
                "criticalCount": sum(1 for d in diagnoses if d.severity == "critical"),
                "totalCount": len(diagnoses),
            },
            started=started,
        )
