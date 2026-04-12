from __future__ import annotations

"""Shrinkage analysis section — wraps ShrinkageEngine (P3.5C B4).


Params:
  shrinkage_rows (list[dict]): per-department cost comparison rows.
    Each row: {"department": str, "standardCost": float, "actualCost": float}
    Accepts both camelCase (standardCost/actualCost) and snake_case
    (standard_cost/actual_cost) for flexibility.

Returns:
  rows, totalStandardCost, totalActualCost, totalVarianceAmount,
  totalVarianceRate, topOffenders, actionItems — all from
  ShrinkageReport.to_dict().
"""

import time
from typing import Any

from smartbi.services.finance.shrinkage_engine import ShrinkageEngine, ShrinkageRow
from smartbi.services.restaurant.sections.base import (
    AbstractSectionHandler,
    SectionRequest,
    SectionResponse,
)


class ShrinkageAnalysisHandler(AbstractSectionHandler):
    """Wraps ShrinkageEngine as a FastAPI section endpoint."""

    section_name = "shrinkage_analysis"

    def __init__(self) -> None:
        self._engine = ShrinkageEngine()

    def compute(self, request: SectionRequest, context: dict[str, Any]) -> SectionResponse:
        started = time.time()

        rows_data = request.params.get("shrinkage_rows")
        if not rows_data:
            return self.skipped(
                request,
                "未提供 shrinkage_rows 参数 (需要各档口的 standard_cost 和 actual_cost)",
                started,
            )

        try:
            rows = [
                ShrinkageRow(
                    department=str(r["department"]),
                    standard_cost=float(
                        r.get("standardCost")
                        if r.get("standardCost") is not None
                        else r.get("standard_cost") or 0
                    ),
                    actual_cost=float(
                        r.get("actualCost")
                        if r.get("actualCost") is not None
                        else r.get("actual_cost") or 0
                    ),
                )
                for r in rows_data
            ]
        except (KeyError, TypeError, ValueError) as e:
            return self.skipped(
                request,
                f"shrinkage_rows 格式错误: {e}",
                started,
            )

        report = self._engine.analyze(rows)
        return self.ok(request, data=report.to_dict(), started=started)
