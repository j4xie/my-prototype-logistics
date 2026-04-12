"""Store KPI dashboard: 3-dimension health check (financial + operational + external)."""
import time
from typing import Any
from smartbi.services.restaurant.sections.base import AbstractSectionHandler, SectionRequest, SectionResponse


class StoreKpiDashboardHandler(AbstractSectionHandler):
    section_name = "store_kpi_dashboard"

    def compute(self, request: SectionRequest, context: dict[str, Any]) -> SectionResponse:
        started = time.time()
        p = request.params or {}
        fin = p.get("financial")
        ops = p.get("operational")
        ext = p.get("external")

        if not fin and not ops and not ext:
            return self.skipped(request, "未提供任何维度数据 (financial/operational/external)", started)

        dimensions = []
        alerts = []

        if fin:
            profit = float(fin.get("controllable_profit", 0))
            revenue = float(fin.get("revenue", 0))
            labor_pct = float(fin.get("labor_cost_pct", 0))
            margin = round(profit / revenue * 100, 1) if revenue > 0 else 0
            health = "GOOD" if margin >= 30 else "WARNING" if margin >= 20 else "CRITICAL"
            dimensions.append({"name": "财务", "health": health, "metrics": [
                {"label": "可控利润率", "value": f"{margin}%", "status": health},
                {"label": "人力成本占比", "value": f"{labor_pct}%",
                 "status": "GOOD" if labor_pct <= 22 else "WARNING" if labor_pct <= 28 else "CRITICAL"},
            ]})
            if margin < 20:
                alerts.append(f"可控利润率 {margin}% 低于警戒线 20%")

        if ops:
            prod = float(ops.get("labor_productivity", 0))
            turnover = float(ops.get("staff_turnover_pct", 0))
            compliance = float(ops.get("shift_compliance", 0))
            health = "GOOD" if 30000 <= prod <= 40000 else "WARNING"
            dimensions.append({"name": "营运", "health": health, "metrics": [
                {"label": "人效", "value": f"¥{prod:,.0f}/人", "status": health},
                {"label": "员工流失率", "value": f"{turnover}%",
                 "status": "GOOD" if turnover <= 10 else "WARNING" if turnover <= 20 else "CRITICAL"},
                {"label": "排班达标率", "value": f"{compliance}%",
                 "status": "GOOD" if compliance >= 90 else "WARNING"},
            ]})
            if prod < 30000:
                alerts.append(f"人效 ¥{prod:,.0f} 低于3万")
            if prod > 40000:
                alerts.append(f"人效 ¥{prod:,.0f} 超过4万, 服务跟不上风险")

        if ext:
            score = float(ext.get("review_score", 0))
            neg_pct = float(ext.get("negative_review_pct", 0))
            health = "GOOD" if score >= 4.5 else "WARNING" if score >= 4.0 else "CRITICAL"
            dimensions.append({"name": "外部评价", "health": health, "metrics": [
                {"label": "点评评分", "value": f"{score}", "status": health},
                {"label": "差评率", "value": f"{neg_pct}%",
                 "status": "GOOD" if neg_pct <= 1 else "WARNING" if neg_pct <= 3 else "CRITICAL"},
            ]})
            if score < 4.0:
                alerts.append(f"点评评分 {score} 低于4.0")

        healths = [d["health"] for d in dimensions]
        overall = "CRITICAL" if "CRITICAL" in healths else "WARNING" if "WARNING" in healths else "GOOD"

        return self.ok(request, data={
            "dimensions": dimensions, "overall_health": overall,
            "alerts": alerts, "dimension_count": len(dimensions),
        }, started=started)
