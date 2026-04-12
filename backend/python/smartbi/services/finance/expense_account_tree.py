from __future__ import annotations

"""Expense account tree — hierarchical chart of accounts.


Every mature finance team organizes expenses as a tree (1-3 levels):
  总费用
    ├── 营业费用
    │     ├── 人力成本
    │     │     ├── 工资
    │     │     ├── 奖金
    │     │     └── 福利费
    │     └── 场地费用
    │           ├── 房租费
    │           └── 物业管理费
    └── 财务费用
          ├── 支付宝手续费
          └── 微信手续费

Our previous flat 5-bucket model (food/labor/rent/other/net_profit) lost
40+ subaccounts of information. This module restores the tree, enabling:
  - Per-leaf diagnostic rules ("后厨临时工超预算 4500" vs generic "人工率高")
  - Budget-vs-actual variance at any tree level
  - Drill-down from total to leaf

Default trees for common verticals in
`knowledge/restaurant/expense_account_tree/`. Per-factory customization
via `FactoryConfig.expenseAccountTreeId` (loader picks the YAML file).

Part of P3.5A QW4. Consumer wiring (analyzer.py._extract_financial_metrics)
comes in Phase 3.5B F5-F6.
"""

from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional

import yaml


@dataclass
class ExpenseAccountNode:
    """One node in the expense account tree.

    parent_code=None marks a root. Leaf vs parent distinction is computed
    by the containing Tree (via is_leaf(code)), not stored on the node.
    """
    code: str                                # unique identifier (e.g. "工资")
    name_zh: str                             # display name
    parent_code: Optional[str] = None
    description: Optional[str] = None
    attribute: Optional[str] = None          # 可控比例 / 可控金额 / 固定金额 / 激励
    responsible: Optional[str] = None        # 责任人


@dataclass
class ExpenseAccountTree:
    """Hierarchical expense account tree with aggregation.

    Usage:
        tree = load_tree_from_yaml(Path("hotpot_default.yaml"))
        values = {"工资": 237660, "奖金": 15000, ...}  # leaf values from P&L
        aggregated = tree.aggregate(values)
        # aggregated["人力成本"] = sum of all leaves under 人力成本
    """
    nodes: dict[str, ExpenseAccountNode] = field(default_factory=dict)

    def add(self, node: ExpenseAccountNode) -> None:
        if node.code in self.nodes:
            raise ValueError(f"Duplicate node code: {node.code!r}")
        self.nodes[node.code] = node

    def is_leaf(self, code: str) -> bool:
        """A node is a leaf if no other node has it as a parent."""
        return not any(n.parent_code == code for n in self.nodes.values())

    def get_children(self, code: str) -> list[ExpenseAccountNode]:
        return [n for n in self.nodes.values() if n.parent_code == code]

    def aggregate(self, leaf_values: dict[str, float]) -> dict[str, float]:
        """Given leaf account values, compute all parent account sums.

        Unknown leaves in leaf_values are silently ignored (robust to
        data drift). Missing leaves default to 0.
        """
        result: dict[str, float] = {}

        # Seed leaves with their values
        for code in self.nodes:
            if self.is_leaf(code):
                result[code] = float(leaf_values.get(code, 0))

        # Propagate up the tree until stable
        changed = True
        while changed:
            changed = False
            for code in self.nodes:
                if code in result:
                    continue
                children = self.get_children(code)
                if all(c.code in result for c in children):
                    result[code] = sum(result[c.code] for c in children)
                    changed = True

        return result


def load_tree_from_yaml(yaml_path: Path) -> ExpenseAccountTree:
    """Load an ExpenseAccountTree from YAML.

    Expected format:
        nodes:
          - code: 总费用
            name_zh: 总费用
          - code: 营业费用
            name_zh: 营业费用
            parent: 总费用
          - ...
    """
    with open(yaml_path, "r", encoding="utf-8") as f:
        data = yaml.safe_load(f)

    if not isinstance(data, dict) or "nodes" not in data:
        raise ValueError(
            f"Invalid YAML: expected 'nodes' key at top level, got {type(data).__name__}"
        )

    tree = ExpenseAccountTree()
    for raw in data["nodes"]:
        tree.add(ExpenseAccountNode(
            code=raw["code"],
            name_zh=raw.get("name_zh", raw["code"]),
            parent_code=raw.get("parent"),
            description=raw.get("description"),
            attribute=raw.get("attribute"),
            responsible=raw.get("responsible"),
        ))
    return tree
