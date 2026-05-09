from __future__ import annotations

"""Smart reorder: forecast-driven purchase order generation.

Algorithm: daily_need = daily_sales × qty_per_dish, aggregate by ingredient,
total_need = daily_need × lead_days × safety_factor, order = max(0, total_need - stock).
"""
import time
from collections import defaultdict
from typing import Any
from smartbi.services.restaurant.sections.base import AbstractSectionHandler, SectionRequest, SectionResponse


class SmartReorderHandler(AbstractSectionHandler):
    section_name = "smart_reorder"

    def compute(self, request: SectionRequest, context: dict[str, Any]) -> SectionResponse:
        started = time.time()
        p = request.params or {}
        bom = p.get("bom_recipes")
        if not bom or not isinstance(bom, list):
            return self.skipped(request, "未提供 bom_recipes", started)

        stock = p.get("current_stock", {})
        lead = max(int(p.get("lead_days", 1)), 1)
        safety = float(p.get("safety_factor", 1.2))

        needs = defaultdict(lambda: {"daily_need": 0.0, "unit": "", "dishes": []})
        for line in bom:
            ing = line.get("ingredient", "")
            qty = float(line.get("qty_per_dish", 0))
            daily_sales = float(line.get("daily_sales_estimate", 0))
            daily_need = qty * daily_sales
            entry = needs[ing]
            entry["daily_need"] += daily_need
            entry["unit"] = line.get("unit", "")
            entry["dishes"].append({"dish": line.get("dish", ""), "qty_per_dish": qty,
                                    "daily_sales": daily_sales, "contribution": round(daily_need, 2)})

        suggested = []
        for ing, info in needs.items():
            daily = round(info["daily_need"], 2)
            total = round(daily * lead * safety, 2)
            cur = float(stock.get(ing, 0))
            order = round(max(0, total - cur), 2)
            suggested.append({"ingredient": ing, "unit": info["unit"], "daily_need": daily,
                              "lead_days": lead, "safety_factor": safety, "total_need": total,
                              "current_stock": cur, "order_qty": order,
                              "priority": "HIGH" if order > daily * 2 else "MEDIUM" if order > 0 else "LOW",
                              "contributing_dishes": info["dishes"]})
        suggested.sort(key=lambda x: x["order_qty"], reverse=True)

        return self.ok(request, data={
            "suggested_orders": suggested, "total_ingredients": len(suggested),
            "ingredients_to_order": sum(1 for s in suggested if s["order_qty"] > 0),
            "lead_days": lead, "safety_factor": safety,
            "note": "特殊活动或爆单情况请手动补单"}, started=started)
