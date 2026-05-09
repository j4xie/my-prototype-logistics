from __future__ import annotations

"""Daily inventory reconciliation: opening + deliveries - BOM usage = expected closing vs actual."""

import time
from typing import Any
from smartbi.services.restaurant.sections.base import AbstractSectionHandler, SectionRequest, SectionResponse


class DailyReconciliationHandler(AbstractSectionHandler):
    section_name = "daily_reconciliation"

    def compute(self, request: SectionRequest, context: dict[str, Any]) -> SectionResponse:
        started = time.time()
        p = request.params or {}
        opening = p.get("opening_stock")
        if not opening:
            return self.skipped(request, "未提供 opening_stock", started)
        deliveries = p.get("deliveries", {})
        expected_usage = p.get("bom_expected_usage", {})
        closing = p.get("closing_stock", {})
        tolerance_pct = float(p.get("tolerance_pct", 5.0))
        date = p.get("date", "unknown")
        all_ing = set(opening.keys()) | set(deliveries.keys()) | set(closing.keys())
        reconciliation, alerts = [], []
        for ing in sorted(all_ing):
            op = float(opening.get(ing, 0))
            deliv = float(deliveries.get(ing, 0))
            usage = float(expected_usage.get(ing, 0))
            expected_close = round(op + deliv - usage, 2)
            actual_close = float(closing.get(ing, 0))
            variance = round(actual_close - expected_close, 2)
            variance_pct = round(abs(variance) / usage * 100, 1) if usage > 0 else 0.0
            within = variance_pct <= tolerance_pct
            severity = "OK" if within else "HIGH" if variance_pct > tolerance_pct * 3 else "MEDIUM"
            reconciliation.append({"ingredient": ing, "opening": op, "deliveries": deliv,
                                   "expected_usage": usage, "expected_closing": expected_close,
                                   "actual_closing": actual_close, "variance": variance,
                                   "variance_pct": variance_pct, "within_tolerance": within, "severity": severity})
            if not within:
                alerts.append(f"{ing}: 差异 {variance:+.2f} ({variance_pct}%), {'损耗' if variance < 0 else '结余偏多'}")
        return self.ok(request, data={"date": date, "reconciliation": reconciliation, "alerts": alerts,
                                      "tolerance_pct": tolerance_pct, "total_ingredients": len(reconciliation),
                                      "within_tolerance_count": sum(1 for r in reconciliation if r["within_tolerance"])}, started=started)  # noqa: E501
