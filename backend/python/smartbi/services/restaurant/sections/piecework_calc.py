from __future__ import annotations

"""Piecework commission calculator: individual (hostess) and team-based (service/kitchen)."""

import time
from typing import Any
from smartbi.services.restaurant.sections.base import AbstractSectionHandler, SectionRequest, SectionResponse


class PieceworkCalcHandler(AbstractSectionHandler):
    section_name = "piecework_calc"

    def compute(self, request: SectionRequest, context: dict[str, Any]) -> SectionResponse:
        started = time.time()
        p = request.params or {}
        roles = p.get("roles")
        if not roles or not isinstance(roles, list):
            return self.skipped(request, "未提供 roles (岗位配置列表)", started)

        results = []
        total_payout = 0

        for r in roles:
            role = r.get("role", "")
            mode = r.get("calc_mode", "TEAM")
            threshold = int(r.get("base_threshold", 0))
            base_salary = float(r.get("base_salary", 0))
            per_unit = float(r.get("per_unit_bonus", 0))
            actual = int(r.get("actual_units", 0))
            team_size = int(r.get("team_size", 1))

            excess = max(0, actual - threshold)
            bonus = round(excess * per_unit)
            total_pool = round(base_salary + bonus)

            item = {"role": role, "calc_mode": mode, "actual_units": actual,
                    "threshold": threshold, "excess_units": excess,
                    "base_earned": round(base_salary), "bonus": bonus}

            if mode == "TEAM" and team_size > 0:
                per_person = round(total_pool / team_size)
                item["total_pool"] = total_pool
                item["team_size"] = team_size
                item["per_person"] = per_person
                item["total"] = total_pool
            else:
                item["total"] = total_pool

            results.append(item)
            total_payout += total_pool

        return self.ok(request, data={
            "role_results": results,
            "total_payout": total_payout,
            "roles_counted": len(results),
        }, started=started)
