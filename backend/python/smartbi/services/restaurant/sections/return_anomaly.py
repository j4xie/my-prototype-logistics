from __future__ import annotations

"""Return anomaly: flag stores with abnormal return rates vs peers on same batch."""

import time
from collections import defaultdict
from typing import Any
from smartbi.services.restaurant.sections.base import AbstractSectionHandler, SectionRequest, SectionResponse


class ReturnAnomalyHandler(AbstractSectionHandler):
    section_name = "return_anomaly"

    def compute(self, request: SectionRequest, context: dict[str, Any]) -> SectionResponse:
        started = time.time()
        p = request.params or {}
        deliveries = p.get("deliveries")
        if not deliveries or not isinstance(deliveries, list):
            return self.skipped(request, "未提供 deliveries", started)

        threshold_multiplier = float(p.get("threshold_multiplier", 3.0))
        groups = defaultdict(list)
        for d in deliveries:
            key = (d.get("supplier", ""), d.get("batch", ""))
            ordered = float(d.get("ordered", 0))
            returned = float(d.get("returned", 0))
            pct = round(returned / ordered * 100, 1) if ordered > 0 else 0.0
            groups[key].append({"store": d.get("store", ""), "ordered": ordered,
                                "returned": returned, "return_pct": pct})

        anomalies = []
        batch_summaries = []
        for (supplier, batch), records in groups.items():
            pcts = [r["return_pct"] for r in records]
            avg = sum(pcts) / len(pcts) if pcts else 0
            threshold = max(avg * threshold_multiplier, 10.0)
            batch_anomalies = [r for r in records if r["return_pct"] > threshold]
            for a in batch_anomalies:
                anomalies.append({"store": a["store"], "supplier": supplier, "batch": batch,
                                  "return_pct": a["return_pct"], "peer_avg_pct": round(avg, 1),
                                  "threshold": round(threshold, 1),
                                  "severity": "HIGH" if a["return_pct"] > threshold * 2 else "MEDIUM",
                                  "action": "总部介入调查"})
            batch_summaries.append({"supplier": supplier, "batch": batch,
                                    "store_count": len(records), "avg_return_pct": round(avg, 1),
                                    "anomaly_count": len(batch_anomalies)})

        return self.ok(request, data={"anomalies": anomalies, "batch_summaries": batch_summaries,
                                      "total_deliveries": len(deliveries), "total_anomalies": len(anomalies)}, started=started)  # noqa: E501
