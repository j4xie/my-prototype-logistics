"""Stored value dependency section — analyzes 充卡 (gift card) reliance.

Wraps :class:`StoredValueAnalyzer` (see analyzer.py:332-348). Requires
``financial_data['current']['stored_value_giveaway'] > 0`` — without a
giveaway figure there is no dependency to analyze.

Note the engine signature uses ``previous_balance`` (not the longer
``previous_stored_value_balance``); the input dict still uses the long form
to match the upstream Excel/JSON convention.
"""
from __future__ import annotations

import time
from typing import Any

from smartbi.services.restaurant.sections.base import (
    AbstractSectionHandler,
    SectionRequest,
    SectionResponse,
)


class StoredValueHandler(AbstractSectionHandler):
    """Wraps :class:`StoredValueAnalyzer` for the section pipeline.

    Inputs (request.params):
      - ``financial_data.current.stored_value_giveaway`` (required, > 0)
      - ``financial_data.current.revenue`` (required for ratio)
      - ``financial_data.current.stored_value_charge`` (optional)
      - ``financial_data.current.previous_stored_value_balance`` (optional)
    """
    section_name = "stored_value"

    def __init__(self) -> None:
        self._analyzer = None

    def _get_analyzer(self):
        if self._analyzer is None:
            from smartbi.services.restaurant.stored_value_analyzer import StoredValueAnalyzer
            self._analyzer = StoredValueAnalyzer()
        return self._analyzer

    def compute(self, request: SectionRequest, context: dict[str, Any]) -> SectionResponse:
        started = time.time()

        financial_data = request.params.get("financial_data") or {}
        if not financial_data:
            return self.skipped(request, "未提供 financial_data", started)

        current = financial_data.get("current") or {}
        if not current:
            return self.skipped(request, "financial_data.current 缺失", started)

        giveaway = self._safe_float(current.get("stored_value_giveaway"))
        if giveaway is None or giveaway <= 0:
            return self.skipped(
                request,
                "未提供 stored_value_giveaway 或为 0, 无储值依赖可分析",
                started,
            )

        revenue = self._safe_float(current.get("revenue"))
        if revenue is None or revenue <= 0:
            return self.skipped(
                request,
                "未提供 revenue 或为 0, 无法计算依赖度",
                started,
            )

        charge = self._safe_float(current.get("stored_value_charge"))
        previous_balance = self._safe_float(current.get("previous_stored_value_balance"))

        # P3.5B F8: read mode from context (set by orchestrator from margin_spec)
        # Falls back to PREPAID (default) if not in context (backward compat)
        from smartbi.services.finance.margin_spec import StoredValueTreatment
        mode = context.get("stored_value_mode") or StoredValueTreatment.PREPAID

        try:
            report = self._get_analyzer().analyze(
                stored_value_giveaway=giveaway,
                revenue=revenue,
                stored_value_charge=charge,
                previous_balance=previous_balance,
                mode=mode,
            )
        except Exception as e:
            return self.skipped(request, f"stored_value_analyzer 运行失败: {e}", started)

        if hasattr(report, "to_dict"):
            data = report.to_dict()
        elif isinstance(report, dict):
            data = dict(report)
        else:
            return self.skipped(
                request,
                f"stored_value_analyzer 返回非 dict 类型: {type(report).__name__}",
                started,
            )

        return self.ok(request, data=data, started=started)
