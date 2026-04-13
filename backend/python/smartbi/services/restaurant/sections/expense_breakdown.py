from __future__ import annotations

"""Expense breakdown section — aggregates leaf account values by tree.


Part of P3.5B F6. Consumer wiring of the ExpenseAccountTree (QW4) so
mobile can drill down from a high-level alert like "人力成本率高" to
specific leaf accounts like "工资 237660 + 奖金 0 + 福利费 5000".

Params:
  expense_account_tree_id (str, optional): which YAML tree to load.
    Default "hotpot_default". Falls back to SKIPPED if id is invalid.
  expense_leaf_values (dict[str, float]): per-leaf account values,
    typically from the P&L row parser.
"""

import time
from pathlib import Path
from typing import Any, Optional

from smartbi.services.finance.expense_account_tree import (
    ExpenseAccountTree,
    load_tree_from_yaml,
)
from smartbi.services.restaurant.sections.base import (
    AbstractSectionHandler,
    SectionRequest,
    SectionResponse,
)


class ExpenseBreakdownHandler(AbstractSectionHandler):
    """Aggregate per-leaf expense values to tree parents + rank top N."""

    section_name = "expense_breakdown"

    def __init__(self) -> None:
        self._tree_cache: dict[str, ExpenseAccountTree] = {}

    def _get_tree(self, tree_id: str) -> Optional[ExpenseAccountTree]:
        if tree_id not in self._tree_cache:
            yaml_path = (
                Path(__file__).parents[3]
                / "knowledge"
                / "restaurant"
                / "expense_account_tree"
                / f"{tree_id}.yaml"
            )
            if not yaml_path.exists():
                return None
            self._tree_cache[tree_id] = load_tree_from_yaml(yaml_path)
        return self._tree_cache[tree_id]

    def compute(self, request: SectionRequest, context: dict[str, Any]) -> SectionResponse:
        started = time.time()

        tree_id = request.params.get("expense_account_tree_id", "hotpot_default")
        leaf_values = request.params.get("expense_leaf_values") or {}

        tree = self._get_tree(tree_id)
        if tree is None:
            return self.skipped(
                request,
                f"未找到费用科目树 {tree_id!r}",
                started,
            )

        aggregated = tree.aggregate(leaf_values)

        # Top N leaf accounts by value (descending), exclude zero-value leaves
        top_accounts = sorted(
            [
                {
                    "code": code,
                    "nameZh": tree.nodes[code].name_zh,
                    "value": val,
                }
                for code, val in aggregated.items()
                if tree.is_leaf(code) and val > 0
            ],
            key=lambda x: x["value"],
            reverse=True,
        )

        return self.ok(
            request,
            data={
                "treeId": tree_id,
                "aggregated": aggregated,
                "topAccounts": top_accounts[:20],
                "leafCount": sum(1 for c in tree.nodes if tree.is_leaf(c)),
            },
            started=started,
        )
