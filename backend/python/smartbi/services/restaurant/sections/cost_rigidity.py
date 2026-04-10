"""Cost rigidity section - computes elasticity of labor cost vs revenue change."""
from __future__ import annotations

import time
from typing import Any, Optional

from smartbi.services.restaurant.sections.base import (
    AbstractSectionHandler, SectionRequest, SectionResponse, SectionStatus,
)


class CostRigidityHandler(AbstractSectionHandler):
    """Computes cost_rigidity = Δlabor_cost / Δrevenue.

    Interpretation:
      - 1.0  = labor scales perfectly with revenue (ideal)
      - 0.85 = healthy (industry benchmark for hotpot)
      - 0.5  = rigid (only half of revenue drop is offset by labor reduction)
      - 0.0  = fully rigid (labor unchanged despite revenue collapse)
    """
    section_name = "cost_rigidity"

    HEALTHY_THRESHOLD = 0.85
    CRITICAL_THRESHOLD = 0.6

    def compute(self, request: SectionRequest, context: dict[str, Any]) -> SectionResponse:
        started = time.time()
        financial_data = request.params.get("financial_data") or {}
        current = financial_data.get("current")
        previous = financial_data.get("previous")

        if not current:
            return self._skipped(request, started, "未提供 financial_data.current")
        if not previous:
            return self._skipped(request, started, "未提供 financial_data.previous (需要环比数据)")

        rev_curr = self._safe_float(current.get("revenue"))
        rev_prev = self._safe_float(previous.get("revenue"))
        labor_curr = self._safe_float(current.get("labor_cost"))
        labor_prev = self._safe_float(previous.get("labor_cost"))

        if None in (rev_curr, rev_prev, labor_curr, labor_prev):
            return self._skipped(request, started, "revenue 或 labor_cost 字段缺失")
        if rev_prev == 0:
            return self._skipped(request, started, "previous.revenue 为 0, 无法计算环比")

        rev_delta_pct = (rev_curr - rev_prev) / rev_prev
        labor_delta_pct = (labor_curr - labor_prev) / labor_prev if labor_prev else 0.0

        if rev_delta_pct == 0:
            cost_rigidity = 1.0  # degenerate case
        else:
            cost_rigidity = labor_delta_pct / rev_delta_pct

        severity = self._classify(cost_rigidity, rev_delta_pct)
        annualized_impact = abs(rev_curr - rev_prev) * 12 * (1 - cost_rigidity) if rev_delta_pct < 0 else 0

        return SectionResponse(
            section_name=self.section_name,
            status=SectionStatus.OK,
            data={
                "costRigidity": round(cost_rigidity, 4),
                "revenueChangePct": round(rev_delta_pct * 100, 2),
                "laborChangePct": round(labor_delta_pct * 100, 2),
                "healthyThreshold": self.HEALTHY_THRESHOLD,
                "severity": severity,
                "formulaZh": "cost_rigidity = Δlabor_cost_pct / Δrevenue_pct",
                "annualizedImpact": round(annualized_impact, 2),
                "descriptionZh": self._describe(cost_rigidity, rev_delta_pct, labor_delta_pct),
            },
            warnings=[],
            cache_key=self.cache_key(request),
            computed_at_ms=int((time.time() - started) * 1000),
        )

    def _classify(self, rigidity: float, rev_delta: float) -> str:
        if rev_delta >= 0:
            return "info"  # growth scenario, rigidity less concerning
        if rigidity < self.CRITICAL_THRESHOLD:
            return "critical"
        if rigidity < self.HEALTHY_THRESHOLD:
            return "warning"
        return "info"

    def _describe(self, rigidity: float, rev_delta: float, labor_delta: float) -> str:
        return (
            f"营收环比 {rev_delta*100:+.2f}%, 人工成本环比 {labor_delta*100:+.2f}%, "
            f"成本刚性 {rigidity:.3f} "
            f"(健康值 ≥{self.HEALTHY_THRESHOLD})"
        )

    def _skipped(self, request: SectionRequest, started: float, reason: str) -> SectionResponse:
        return SectionResponse(
            section_name=self.section_name,
            status=SectionStatus.SKIPPED,
            data={},
            warnings=[reason],
            cache_key=self.cache_key(request),
            computed_at_ms=int((time.time() - started) * 1000),
        )

    @staticmethod
    def _safe_float(v: Any) -> Optional[float]:
        if v is None:
            return None
        try:
            return float(v)
        except (TypeError, ValueError):
            return None
