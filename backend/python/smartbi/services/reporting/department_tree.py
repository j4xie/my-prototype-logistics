"""Department hierarchy tree for multi-kitchen restaurant operations.

Universal pattern: any multi-team restaurant organizes labor and costs by
department (前厅 / 后厨) → sub-department (明档 / 热菜 / 冷菜 / 烤鸭) →
potentially further (个人).

Required for:
  - Per-department P&L (Slide 8 of monthly PPT template)
  - 30-row 人均产出比 table (Slide 14)
  - Budget-vs-actual per dept for diagnostics drill-down

Default trees in `knowledge/restaurant/department_tree/` for common
verticals. Factory-specific overrides via `FactoryConfig.departmentTreeId`.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional

import yaml


@dataclass
class DepartmentNode:
    """One node in the department tree.

    parent_code=None marks the root. category groups nodes for reporting
    (e.g. "后厨" / "前厅" / "管理") across different parent paths.
    head_count_target is the budgeted headcount (None for aggregation nodes).
    """
    code: str                                # unique identifier (e.g. "热菜")
    name_zh: str                             # display name (e.g. "热菜档")
    parent_code: Optional[str] = None
    head_count_target: Optional[int] = None
    category: Optional[str] = None           # "后厨" / "前厅" / "管理" / "其他"


@dataclass
class DepartmentTree:
    """Hierarchical department tree with labor/cost aggregation.

    Usage:
        tree = load_dept_tree_from_yaml(Path("hotpot_default.yaml"))
        labor_by_dept = {"热菜": 80000, "冷菜": 40000, "服务员": 50000}
        aggregated = tree.aggregate(labor_by_dept)
        # aggregated["后厨"] = sum of all 后厨 leaves
    """
    nodes: dict[str, DepartmentNode] = field(default_factory=dict)

    def add(self, node: DepartmentNode) -> None:
        if node.code in self.nodes:
            raise ValueError(f"Duplicate department code: {node.code!r}")
        self.nodes[node.code] = node

    def is_leaf(self, code: str) -> bool:
        """A node is a leaf if no other node has it as a parent."""
        return not any(n.parent_code == code for n in self.nodes.values())

    def get_children(self, code: str) -> list[DepartmentNode]:
        return [n for n in self.nodes.values() if n.parent_code == code]

    def aggregate(self, leaf_values: dict[str, float]) -> dict[str, float]:
        """Given leaf department values, compute all parent department sums.

        Unknown leaves in leaf_values are silently ignored (robust to data
        drift). Missing leaves default to 0.
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


def load_dept_tree_from_yaml(yaml_path: Path) -> DepartmentTree:
    """Load a DepartmentTree from a YAML file.

    Expected format:
        nodes:
          - code: 酒店
            name_zh: 酒店总部
            category: 管理
          - code: 后厨
            name_zh: 后厨
            parent: 酒店
            category: 后厨
          - code: 热菜
            name_zh: 热菜档
            parent: 后厨
            head_count_target: 8
            category: 后厨
    """
    with open(yaml_path, "r", encoding="utf-8") as f:
        data = yaml.safe_load(f)

    if not isinstance(data, dict) or "nodes" not in data:
        raise ValueError(
            f"Invalid YAML: expected 'nodes' key at top level, got {type(data).__name__}"
        )

    tree = DepartmentTree()
    for raw in data["nodes"]:
        tree.add(DepartmentNode(
            code=raw["code"],
            name_zh=raw.get("name_zh", raw["code"]),
            parent_code=raw.get("parent"),
            head_count_target=raw.get("head_count_target"),
            category=raw.get("category"),
        ))
    return tree
