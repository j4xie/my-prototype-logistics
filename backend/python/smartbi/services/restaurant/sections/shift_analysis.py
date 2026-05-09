from __future__ import annotations

"""Shift analysis: evaluate staffing efficiency and full-time/part-time mix.

Customer [T 29:28-31:00]: '分全职跟兼职, 全职保底160-180工时, 高峰多用兼职'.
"""
import time
from typing import Any
from smartbi.services.restaurant.sections.base import AbstractSectionHandler, SectionRequest, SectionResponse


class ShiftAnalysisHandler(AbstractSectionHandler):
    section_name = "shift_analysis"

    def compute(self, request: SectionRequest, context: dict[str, Any]) -> SectionResponse:
        started = time.time()
        p = request.params or {}
        summary = p.get("month_summary")
        if not summary:
            return self.skipped(request, "未提供 month_summary", started)

        ft = summary.get("full_time", {})
        pt = summary.get("part_time", {})
        ft_count = int(ft.get("count", 0))
        pt_count = int(pt.get("count", 0))
        ft_hours = float(ft.get("total_hours", 0))
        pt_hours = float(pt.get("total_hours", 0))
        ft_cost = float(ft.get("total_cost", 0))
        pt_cost = float(pt.get("total_cost", 0))

        total_hc = ft_count + pt_count
        total_hours = ft_hours + pt_hours  # noqa: F841
        total_cost = ft_cost + pt_cost
        revenue = float(p.get("revenue", 0))
        min_hours = int(p.get("min_guaranteed_hours", 168))

        ft_ratio = round(ft_count / total_hc * 100, 1) if total_hc > 0 else 0
        pt_hourly = round(pt_cost / pt_hours, 1) if pt_hours > 0 else 0
        ft_avg_hours = round(ft_hours / ft_count, 1) if ft_count > 0 else 0
        labor_pct = round(total_cost / revenue * 100, 1) if revenue > 0 else 0
        productivity = round(revenue / total_hc) if total_hc > 0 else 0

        recs = []
        if ft_ratio > 80 and total_hc >= 8:
            recs.append(f"全职占比 {ft_ratio}% 偏高, 建议增加兼职 (目标: 全职60-70% + 兼职30-40%)")
        if ft_avg_hours > 0 and ft_avg_hours < min_hours:
            recs.append(f"全职人均 {ft_avg_hours}h 低于保底 {min_hours}h, 需确认排班是否充足")
        if labor_pct > 25:
            recs.append(f"人力成本占比 {labor_pct}% 超过25%, 需优化用工结构")
        if pt_count == 0 and total_hc >= 6:
            recs.append("未使用兼职人员, 高峰期建议引入兼职降低固定成本")
        if not recs:
            recs.append("排班结构合理, 全职/兼职比例健康")

        return self.ok(request, data={
            "total_headcount": total_hc,
            "full_time_count": ft_count, "part_time_count": pt_count,
            "full_time_ratio": ft_ratio,
            "full_time_avg_hours": ft_avg_hours,
            "part_time_hourly_cost": pt_hourly,
            "total_labor_cost": total_cost,
            "labor_cost_pct": labor_pct,
            "productivity_per_person": productivity,
            "recommendations": recs,
            "benchmark": "肯德基模式: 1-2全职管理 + 大量兼职, 全职占比 <30%",
        }, started=started)
