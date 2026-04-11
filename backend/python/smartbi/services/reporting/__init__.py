"""Reporting module — department tree, monthly PPT exporter.

Part of P3.5 general capabilities refactor. Modules added incrementally:
  - department_tree (P3.5A QW5): dept hierarchy for multi-kitchen ops
  - monthly_ppt_exporter (P3.5D P2): 19-slide monthly analysis deck
"""
from .department_tree import (
    DepartmentNode,
    DepartmentTree,
    load_dept_tree_from_yaml,
)

__all__ = [
    "DepartmentNode",
    "DepartmentTree",
    "load_dept_tree_from_yaml",
]
