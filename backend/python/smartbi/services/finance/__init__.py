from __future__ import annotations

"""Finance module — margin spec, expense account tree, shrinkage engine.

Part of P3.5 general capabilities refactor. Modules added incrementally:
  - margin_spec (P3.5A QW3): boundary config
  - expense_account_tree (P3.5A QW4): chart of accounts
  - shrinkage_engine (P3.5C B3): standard vs actual variance
"""
from .margin_spec import MarginSpec, StoredValueTreatment, MarginCalcMode
from .expense_account_tree import (
    ExpenseAccountNode,
    ExpenseAccountTree,
    load_tree_from_yaml,
)
from .shrinkage_engine import (
    ActionItem,
    ShrinkageEngine,
    ShrinkageReport,
    ShrinkageRow,
)

__all__ = [
    "MarginSpec",
    "StoredValueTreatment",
    "MarginCalcMode",
    "ExpenseAccountNode",
    "ExpenseAccountTree",
    "load_tree_from_yaml",
    "ActionItem",
    "ShrinkageEngine",
    "ShrinkageReport",
    "ShrinkageRow",
]
