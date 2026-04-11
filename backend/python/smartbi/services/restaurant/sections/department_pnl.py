"""Department P&L section — per-department labor + cost breakdown.

Part of P3.5D P1. Consumer of DepartmentTree (QW5).

Params:
  department_tree_id (str, optional): which YAML tree to load.
    Default "hotpot_default". Falls back to SKIPPED if invalid.
  labor_by_department (dict[str, float]): per-leaf dept labor cost.
    Required — missing → SKIPPED.
  head_count_by_department (dict[str, int], optional): per-leaf headcount
    for per-head productivity metrics.
  revenue (float, optional): total revenue for revenue-share calculation.

Returns:
  treeId, departments (list per leaf with nameZh/parent/category/laborCost/
  headCount/perHeadCost/laborShare/revenueShare), aggregated (map by tree
  node code), totalLaborCost, laborRevenueRatio.
"""
from __future__ import annotations

import time
from pathlib import Path
from typing import Any, Optional

from smartbi.services.reporting.department_tree import (
    DepartmentTree,
    load_dept_tree_from_yaml,
)
from smartbi.services.restaurant.sections.base import (
    AbstractSectionHandler,
    SectionRequest,
    SectionResponse,
)


class DepartmentPnlHandler(AbstractSectionHandler):
    """Per-department labor + cost breakdown."""

    section_name = "department_pnl"

    def __init__(self) -> None:
        self._tree_cache: dict[str, DepartmentTree] = {}

    def _get_tree(self, tree_id: str) -> Optional[DepartmentTree]:
        if tree_id not in self._tree_cache:
            yaml_path = (
                Path(__file__).parents[3]
                / "knowledge"
                / "restaurant"
                / "department_tree"
                / f"{tree_id}.yaml"
            )
            if not yaml_path.exists():
                return None
            self._tree_cache[tree_id] = load_dept_tree_from_yaml(yaml_path)
        return self._tree_cache[tree_id]

    def compute(self, request: SectionRequest, context: dict[str, Any]) -> SectionResponse:
        started = time.time()

        tree_id = request.params.get("department_tree_id", "hotpot_default")
        labor_data = request.params.get("labor_by_department") or {}
        head_count_data = request.params.get("head_count_by_department") or {}
        revenue = float(request.params.get("revenue") or 0)

        if not labor_data:
            return self.skipped(
                request,
                "未提供 labor_by_department 参数",
                started,
            )

        tree = self._get_tree(tree_id)
        if tree is None:
            return self.skipped(
                request,
                f"未找到 department_tree {tree_id!r}",
                started,
            )

        # Aggregate leaves to parents
        aggregated = tree.aggregate(labor_data)

        # Per-leaf-dept breakdown with productivity metrics
        total_labor = sum(labor_data.values())
        breakdown: list[dict[str, Any]] = []
        for code, labor in labor_data.items():
            if code not in tree.nodes:
                continue  # unknown dept — silently ignored (robust to data drift)
            node = tree.nodes[code]
            head_count = head_count_data.get(code)
            per_head_cost = (
                labor / head_count
                if head_count and head_count > 0
                else None
            )
            breakdown.append({
                "code": code,
                "nameZh": node.name_zh,
                "parent": node.parent_code,
                "category": node.category,
                "laborCost": labor,
                "headCount": head_count,
                "perHeadCost": per_head_cost,
                "laborShare": labor / total_labor if total_labor > 0 else 0,
                "revenueShare": labor / revenue if revenue > 0 else 0,
            })

        # Sort breakdown by labor cost descending
        breakdown.sort(key=lambda x: x["laborCost"], reverse=True)

        return self.ok(
            request,
            data={
                "treeId": tree_id,
                "departments": breakdown,
                "aggregated": aggregated,
                "totalLaborCost": total_labor,
                "laborRevenueRatio": total_labor / revenue if revenue > 0 else None,
            },
            started=started,
        )
