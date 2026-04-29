"""Silver writer adapters: BaseWriter ABC + concrete writer implementations."""
from __future__ import annotations

from .base import BaseWriter, ResolveResult, WriteSummary
from .bill_flow_writer import BillFlowWriter
from .finance_writer import FinanceWriter
from .inventory_writer import InventoryWriter
from .product_summary_writer import ProductSummaryWriter
from .review_writer import ReviewWriter

__all__ = [
    "BaseWriter",
    "WriteSummary",
    "ResolveResult",
    "BillFlowWriter",
    "ProductSummaryWriter",
    "ReviewWriter",
    "FinanceWriter",
    "InventoryWriter",
]
