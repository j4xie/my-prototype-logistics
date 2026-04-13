from __future__ import annotations

"""Combo split: decompose set menu sales into constituent dish-level statistics."""

import time
from collections import defaultdict
from typing import Any
from smartbi.services.restaurant.sections.base import AbstractSectionHandler, SectionRequest, SectionResponse

class ComboSplitHandler(AbstractSectionHandler):
    section_name = "combo_split"

    def compute(self, request: SectionRequest, context: dict[str, Any]) -> SectionResponse:
        started = time.time()
        p = request.params or {}
        combos = p.get("combos")
        if not combos or not isinstance(combos, list):
            return self.skipped(request, "未提供 combos (套餐列表)", started)

        single_sales = p.get("single_sales", {})
        combo_qty = defaultdict(int)
        combo_detail = []
        for combo in combos:
            name = combo.get("combo_name", "未命名")
            sales = int(combo.get("combo_sales", 0))
            dishes = combo.get("dishes", [])
            for d in dishes:
                combo_qty[d.get("dish", "")] += sales * int(d.get("qty_per_combo", 1))
            combo_detail.append({"combo_name": name, "combo_sales": sales, "dish_count": len(dishes)})

        all_dishes = set(combo_qty.keys()) | set(single_sales.keys())
        dish_breakdown = []
        for dish in sorted(all_dishes):
            single = int(single_sales.get(dish, 0))
            combo = combo_qty.get(dish, 0)
            total = single + combo
            dish_breakdown.append({"dish": dish, "single_sales": single, "combo_sales": combo,
                                    "total_sales": total, "combo_pct": round(combo/total*100, 1) if total else 0.0})
        dish_breakdown.sort(key=lambda x: x["total_sales"], reverse=True)

        return self.ok(request, data={
            "dish_breakdown": dish_breakdown, "combo_summary": combo_detail,
            "total_dishes_tracked": len(dish_breakdown),
            "avg_combo_pct": round(sum(d["combo_pct"] for d in dish_breakdown)/len(dish_breakdown), 1) if dish_breakdown else 0.0,
        }, started=started)
