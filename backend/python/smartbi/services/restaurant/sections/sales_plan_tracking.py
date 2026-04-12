"""Sales plan tracking — completion dashboard with daily needed calculation."""
import time
from typing import Any

from smartbi.services.restaurant.sections.base import (
    AbstractSectionHandler, SectionRequest, SectionResponse,
)


class SalesPlanTrackingHandler(AbstractSectionHandler):
    section_name = "sales_plan_tracking"

    def compute(self, request: SectionRequest, context: dict[str, Any]) -> SectionResponse:
        started = time.time()
        p = request.params or {}

        target = p.get("target_revenue")
        if not target:
            return self.skipped(request, "未提供 target_revenue", started)

        target = float(target)
        actual = float(p.get("actual_revenue", 0))
        day = int(p.get("day_of_month", 1))
        total_days = int(p.get("total_days", 30))

        completion_pct = round(actual / target * 100, 1) if target > 0 else 0.0
        expected_pct = round(day / total_days * 100, 1) if total_days > 0 else 0.0

        if completion_pct >= expected_pct:
            status = "ON_TRACK"
        elif completion_pct >= expected_pct * 0.85:
            status = "SLIGHT_BEHIND"
        else:
            status = "BEHIND"

        gap = max(target - actual, 0)
        remaining = total_days - day
        daily_needed = round(gap / remaining) if remaining > 0 else 0

        return self.ok(request, data={
            "target_revenue": target,
            "actual_revenue": actual,
            "completion_pct": completion_pct,
            "expected_pct": expected_pct,
            "status": status,
            "gap": gap,
            "remaining_days": remaining,
            "daily_needed": daily_needed,
            "day_of_month": day,
            "total_days": total_days,
        }, started=started)
