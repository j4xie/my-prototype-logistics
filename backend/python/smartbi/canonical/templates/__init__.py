"""B-stage Silver-layer MVP analysis templates."""
from .base import TemplateResult
from .finance_monthly_balance import compute_finance_monthly_balance
from .inventory_alert import compute_inventory_alert
from .product_top10 import compute_product_top10
from .review_rating_trend import compute_review_rating_trend

__all__ = [
    "TemplateResult",
    "compute_product_top10",
    "compute_review_rating_trend",
    "compute_finance_monthly_balance",
    "compute_inventory_alert",
]
