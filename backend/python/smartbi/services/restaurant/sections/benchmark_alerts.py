"""Benchmark alerts section — compares restaurant metrics against industry benchmarks."""
from __future__ import annotations

import time
from typing import Any

from smartbi.shared.benchmark_alert_engine import BenchmarkAlertEngine
from smartbi.services.restaurant.sections.base import (
    AbstractSectionHandler,
    SectionRequest,
    SectionResponse,
)


class BenchmarkAlertsHandler(AbstractSectionHandler):
    """Runs industry benchmark comparison engine.

    Produces alerts (severity: red/yellow/info) comparing the restaurant's
    actual metrics to sub-sector industry medians and ranges.

    BenchmarkAlertEngine requires a non-empty sub_sector at construction time,
    so we cache one engine per sub_sector (similar to DiagnosticsHandler).

    Metrics must be in PERCENTAGE form (e.g. 32.51 means 32.51%), NOT 0-1
    ratio form. See the docstring on
    ``BenchmarkAlertEngine._estimate_yearly_impact`` for the contract.
    """
    section_name = "benchmark_alerts"

    def __init__(self) -> None:
        # One engine per sub_sector; constructor requires sub_sector so
        # we cannot eagerly build a single engine here.
        self._engines_by_sector: dict[str, BenchmarkAlertEngine] = {}

    def compute(self, request: SectionRequest, context: dict[str, Any]) -> SectionResponse:
        started = time.time()
        financial_data = request.params.get("financial_data") or {}
        if not financial_data:
            return self.skipped(request, "未提供 financial_data", started)

        metrics = context.get("financial_metrics")
        if metrics is None:
            metrics = financial_data.get("current")
        if not metrics:
            return self.skipped(request, "financial metrics 不可用 (context 和 financial_data.current 均为空)", started)

        # Normalize to dict
        if not isinstance(metrics, dict):
            try:
                metrics = metrics.to_dict()
            except AttributeError:
                return self.skipped(
                    request, f"financial_metrics 不是 dict 也没有 to_dict(): {type(metrics).__name__}", started
                )

        # Monthly revenue for "yearly impact" estimation
        monthly_revenue = self._safe_float(
            financial_data.get("monthly_revenue")
            or metrics.get("revenue")
            or 0
        ) or 0.0

        store_name = request.store_name or request.store_id or "店铺"

        try:
            engine = self._engines_by_sector.get(request.sub_sector)
            if engine is None:
                engine = BenchmarkAlertEngine(domain="restaurant", sub_sector=request.sub_sector)
                self._engines_by_sector[request.sub_sector] = engine
        except ValueError as e:
            return self.skipped(request, f"无法构建 BenchmarkAlertEngine: {e}", started)

        try:
            alerts = engine.alert_for_store(
                store_name=store_name,
                metrics=metrics,
                monthly_revenue=monthly_revenue if monthly_revenue > 0 else None,
            )
        except Exception as e:
            return self.skipped(request, f"BenchmarkAlertEngine 运行失败: {e}", started)

        return self.ok(
            request,
            data={
                "alerts": [a.to_dict() for a in alerts],
                "redCount": sum(1 for a in alerts if getattr(a, "severity", None) == "red"),
                "yellowCount": sum(1 for a in alerts if getattr(a, "severity", None) == "yellow"),
                "totalCount": len(alerts),
            },
            started=started,
        )
