from __future__ import annotations

"""Seat occupancy: match party sizes to table layout for optimal seating."""

import time
from typing import Any
from smartbi.services.restaurant.sections.base import AbstractSectionHandler, SectionRequest, SectionResponse


class SeatOccupancyHandler(AbstractSectionHandler):
    section_name = "seat_occupancy"

    def compute(self, request: SectionRequest, context: dict[str, Any]) -> SectionResponse:
        started = time.time()
        p = request.params or {}
        seat_layout = p.get("seat_layout")
        party_dist = p.get("party_distribution")
        if not seat_layout:
            return self.skipped(request, "未提供 seat_layout", started)
        if not party_dist:
            return self.skipped(request, "未提供 party_distribution", started)

        total_tables = sum(int(v) for v in seat_layout.values())
        total_parties = sum(int(v) for v in party_dist.values())
        if total_tables == 0 or total_parties == 0:
            return self.skipped(request, "桌位或客群数据为零", started)

        seat_sizes = sorted(set(int(k.replace("人位", "")) for k in seat_layout.keys()))

        def best_fit(party_size):
            for s in seat_sizes:
                if s >= party_size:
                    return s
            return seat_sizes[-1]

        demand = {s: 0 for s in seat_sizes}
        for pk, count in party_dist.items():
            demand[best_fit(int(pk.replace("人", "")))] += int(count)

        seat_analysis = []
        recommendations = []
        for seat_key, tc in seat_layout.items():
            size = int(seat_key.replace("人位", ""))
            tc = int(tc)
            table_pct = round(tc / total_tables * 100, 1)
            demand_count = demand.get(size, 0)
            demand_pct = round(demand_count / total_parties * 100, 1)
            gap = round(demand_pct - table_pct, 1)
            status = "SHORTAGE" if gap > 10 else "SURPLUS" if gap < -10 else "BALANCED"
            seat_analysis.append({"seat_type": seat_key, "seat_count": size, "table_count": tc,
                                  "table_pct": table_pct, "demand_count": demand_count,
                                  "demand_pct": demand_pct, "gap": gap, "status": status})
            if gap > 10:
                recommendations.append(f"{seat_key} 供不应求 (需求 {demand_pct}% vs 供给 {table_pct}%), 建议增加")
            elif gap < -10:
                recommendations.append(f"{seat_key} 供过于求, 可考虑拆分为更小桌位")

        if not recommendations:
            recommendations.append("当前桌位配置基本匹配客群分布, 无需调整")

        return self.ok(request, data={"seat_analysis": seat_analysis, "recommendations": recommendations,
                                      "total_tables": total_tables, "total_parties": total_parties}, started=started)
