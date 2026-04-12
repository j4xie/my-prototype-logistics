from __future__ import annotations

"""Cost rigidity section - computes elasticity of labor cost vs revenue change."""

import time
from typing import Any

from smartbi.services.restaurant.sections.base import (
    AbstractSectionHandler,
    SectionRequest,
    SectionResponse,
)


class CostRigidityHandler(AbstractSectionHandler):
    """Computes cost_rigidity = Δlabor_cost / Δrevenue.

    Only meaningful under revenue decline. Returns SKIPPED for growth, flat,
    or degenerate inputs. Under decline:
      - ≥ 0.85 healthy (labor scales with revenue)
      - < 0.85 warning (labor partially rigid)
      - < 0.60 critical (labor fully rigid, major over-staffing)
    """
    section_name = "cost_rigidity"

    HEALTHY_THRESHOLD = 0.85
    CRITICAL_THRESHOLD = 0.60
    # cost_rigidity is only meaningful when revenue declined by at least this
    # much. Mirrors analyzer.py legacy behavior (rev_change < -0.05).
    MIN_DECLINE_PCT = -0.05
    FORMULA_ZH = "cost_rigidity = Δlabor_cost_pct / Δrevenue_pct"

    def compute(self, request: SectionRequest, context: dict[str, Any]) -> SectionResponse:
        started = time.time()
        financial_data = request.params.get("financial_data") or {}
        current = financial_data.get("current")
        previous = financial_data.get("previous")

        if not current:
            return self.skipped(request, "未提供 financial_data.current", started)
        if not previous:
            return self.skipped(request, "未提供 financial_data.previous (需要环比数据)", started)

        rev_curr = self._safe_float(current.get("revenue"))
        rev_prev = self._safe_float(previous.get("revenue"))
        labor_curr = self._safe_float(current.get("labor_cost"))
        labor_prev = self._safe_float(previous.get("labor_cost"))

        if None in (rev_curr, rev_prev, labor_curr, labor_prev):
            return self.skipped(request, "revenue 或 labor_cost 字段缺失", started)
        if rev_prev == 0:
            return self.skipped(request, "previous.revenue 为 0, 无法计算环比", started)
        if labor_prev == 0:
            return self.skipped(request, "previous.labor_cost 为 0, 无法计算环比", started)

        rev_delta_pct = (rev_curr - rev_prev) / rev_prev
        labor_delta_pct = (labor_curr - labor_prev) / labor_prev

        # cost_rigidity only meaningful under meaningful revenue decline
        if rev_delta_pct > self.MIN_DECLINE_PCT:
            return self.skipped(
                request,
                f"营收变化 {rev_delta_pct*100:+.2f}% 不在衰退区间 "
                f"(需 < {self.MIN_DECLINE_PCT*100:.0f}%), cost_rigidity 无意义",
                started,
            )

        cost_rigidity = labor_delta_pct / rev_delta_pct
        severity = self._classify(cost_rigidity)
        annualized_impact = abs(rev_curr - rev_prev) * 12 * (1 - cost_rigidity)

        return self.ok(
            request,
            data={
                "costRigidity": round(cost_rigidity, 4),
                "revenueChangePct": round(rev_delta_pct * 100, 2),
                "laborChangePct": round(labor_delta_pct * 100, 2),
                "healthyThreshold": self.HEALTHY_THRESHOLD,
                "severity": severity,
                "formulaZh": self.FORMULA_ZH,
                "annualizedImpact": round(annualized_impact, 2),
                "descriptionZh": self._describe(cost_rigidity, rev_delta_pct, labor_delta_pct),
            },
            started=started,
        )

    def _classify(self, rigidity: float) -> str:
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
