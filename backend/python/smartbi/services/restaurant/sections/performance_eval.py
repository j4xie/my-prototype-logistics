from __future__ import annotations

"""Performance eval: weighted KPI scoring. Each KPI gets score = min(actual/target, 1.2) × weight."""

import time
from typing import Any
from smartbi.services.restaurant.sections.base import AbstractSectionHandler, SectionRequest, SectionResponse


class PerformanceEvalHandler(AbstractSectionHandler):
    section_name = "performance_eval"

    def compute(self, request: SectionRequest, context: dict[str, Any]) -> SectionResponse:
        started = time.time()
        p = request.params or {}
        kpis = p.get("kpi_weights")
        if not kpis or not isinstance(kpis, dict):
            return self.skipped(request, "未提供 kpi_weights", started)

        details = []
        total_score = 0.0
        total_weight = 0

        for name, cfg in kpis.items():
            weight = float(cfg.get("weight", 0))
            target = float(cfg.get("target", 0))
            actual = float(cfg.get("actual", 0))

            if target > 0:
                achievement = min(actual / target, 1.2)  # cap at 120%
            else:
                achievement = 1.0

            score = round(achievement * weight, 1)
            total_score += score
            total_weight += weight

            details.append({
                "kpi": name,
                "weight": weight,
                "target": target,
                "actual": actual,
                "achievement_pct": round(achievement * 100, 1),
                "weighted_score": score,
            })

        return self.ok(request, data={
            "kpi_details": details,
            "total_score": round(total_score, 1),
            "total_weight": total_weight,
            "grade": "A" if total_score >= 90 else "B" if total_score >= 75 else "C" if total_score >= 60 else "D",
        }, started=started)
