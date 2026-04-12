"""Labor productivity (人效): revenue per employee with zone alerting.

Zones (configurable, defaults from customer call):
  < low_threshold (default 30000)  → OVERSTAFFED  "用人过多或收入太低"
  > high_threshold (default 40000) → UNDERSTAFFED  "服务跟不上, 差评风险"
  between → HEALTHY "健康区间"
"""
import time
from typing import Any

from smartbi.services.restaurant.sections.base import (
    AbstractSectionHandler, SectionRequest, SectionResponse,
)


class LaborProductivityHandler(AbstractSectionHandler):
    section_name = "labor_productivity"

    def compute(self, request: SectionRequest, context: dict[str, Any]) -> SectionResponse:
        started = time.time()
        p = request.params or {}

        headcount = p.get("headcount")
        if not headcount or int(headcount) <= 0:
            return self.skipped(request, "未提供 headcount (员工人数)", started)

        revenue = float(p.get("revenue", 0))
        hc = int(headcount)
        productivity = round(revenue / hc)

        low = float(p.get("low_threshold", 30000))
        high = float(p.get("high_threshold", 40000))

        if productivity < low:
            zone = "OVERSTAFFED"
            diagnosis = f"人效 ¥{productivity:,.0f} 低于 ¥{low:,.0f} — 用人过多或收入太低, 建议优化排班减少冗余工时"
        elif productivity > high:
            zone = "UNDERSTAFFED"
            diagnosis = f"人效 ¥{productivity:,.0f} 超过 ¥{high:,.0f} — 服务跟不上, 高峰期差评风险上升, 建议增加兼职人员"
        else:
            zone = "HEALTHY"
            diagnosis = f"人效 ¥{productivity:,.0f} 在健康区间 ¥{low:,.0f}-¥{high:,.0f} 内"

        return self.ok(request, data={
            "revenue": revenue,
            "headcount": hc,
            "productivity": productivity,
            "zone": zone,
            "diagnosis": diagnosis,
            "thresholds": {"low": low, "high": high},
            "benchmark_source": "中餐连锁行业 (肯德基/麦当劳参考值)",
        }, started=started)
