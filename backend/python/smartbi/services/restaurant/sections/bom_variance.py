from __future__ import annotations

"""BOM cost variance dual attribution: supply chain (price) vs management (usage).


Methodology (standard cost accounting):
  price_variance  = (actual_price - std_price) * std_qty
  usage_variance  = std_price * (actual_qty - std_qty)
  total_variance  = actual_cost - std_cost
"""
import time
from typing import Any

from smartbi.services.restaurant.sections.base import (
    AbstractSectionHandler,
    SectionRequest,
    SectionResponse,
)


class BomVarianceHandler(AbstractSectionHandler):
    section_name = "bom_variance"

    def compute(self, request: SectionRequest, context: dict[str, Any]) -> SectionResponse:
        started = time.time()

        items_raw = (request.params or {}).get("items")
        if not items_raw or not isinstance(items_raw, list):
            return self.skipped(request, "未提供 items (需要 std_qty/std_price/actual_qty/actual_price)", started)

        result_items = []
        total_price_var = 0.0
        total_usage_var = 0.0
        total_interaction = 0.0

        for row in items_raw:
            sku = row.get("sku", "unknown")
            std_qty = float(row.get("std_qty", 0))
            std_price = float(row.get("std_price", 0))
            actual_qty = float(row.get("actual_qty", 0))
            actual_price = float(row.get("actual_price", 0))

            price_var = (actual_price - std_price) * std_qty
            usage_var = std_price * (actual_qty - std_qty)
            interaction = (actual_price - std_price) * (actual_qty - std_qty)
            # total_variance for the item = price + usage (two-component attribution);
            # the interaction term is tracked separately at the summary level.
            total_var = price_var + usage_var

            result_items.append({
                "sku": sku,
                "std_cost": round(std_price * std_qty, 2),
                "actual_cost": round(actual_price * actual_qty, 2),
                "price_variance": round(price_var, 2),
                "usage_variance": round(usage_var, 2),
                "interaction": round(interaction, 2),
                "total_variance": round(total_var, 2),
                "attribution": "supply_chain" if abs(price_var) > abs(usage_var) else "management",
            })

            total_price_var += price_var
            total_usage_var += usage_var
            total_interaction += interaction

        total_total = total_price_var + total_usage_var + total_interaction

        severity = "LOW"
        if abs(total_total) > 0:
            std_total = sum(float(r.get("std_price", 0)) * float(r.get("std_qty", 0)) for r in items_raw)
            if std_total > 0:
                pct = abs(total_total) / std_total
                if pct > 0.015:
                    severity = "HIGH"
                elif pct > 0.01:
                    severity = "MEDIUM"

        return self.ok(
            request,
            data={
                "items": result_items,
                "summary": {
                    "total_price_variance": round(total_price_var, 2),
                    "total_usage_variance": round(total_usage_var, 2),
                    "total_interaction": round(total_interaction, 2),
                    "total_variance": round(total_total, 2),
                    "severity": severity,
                    "dominant_factor": "supply_chain" if abs(total_price_var) > abs(total_usage_var) else "management",
                },
                "tolerance_pct": 1.5,
                "methodology": "standard_cost_dual_attribution",
            },
            started=started,
        )
