from __future__ import annotations

"""Controllable profit calculator for store manager KPIs.


Splits P&L into controllable vs non-controllable items.
Non-controllable defaults: rent, tax, depreciation, insurance, interest, investment.
"""

from dataclasses import dataclass, field
from typing import Optional


DEFAULT_NON_CONTROLLABLE = frozenset([
    "rent", "tax", "depreciation", "insurance", "interest", "investment",
    "租金", "税收", "折旧", "保险", "利息", "投资",
])


@dataclass
class ControllableProfitCalculator:
    default_non_controllable: frozenset = field(default_factory=lambda: DEFAULT_NON_CONTROLLABLE)

    def compute(
        self,
        revenue: float,
        cost_items: dict[str, float],
        non_controllable_keys: Optional[list[str]] = None,
    ) -> dict:
        nc_keys = set(non_controllable_keys) if non_controllable_keys else self.default_non_controllable

        controllable_cost = 0.0
        non_controllable_cost = 0.0
        breakdown = []

        for key, amount in cost_items.items():
            is_nc = key in nc_keys
            if is_nc:
                non_controllable_cost += amount
            else:
                controllable_cost += amount
            breakdown.append({
                "item": key,
                "amount": amount,
                "controllable": not is_nc,
            })

        total_cost = controllable_cost + non_controllable_cost
        financial_profit = revenue - total_cost
        controllable_profit = revenue - controllable_cost
        margin_pct = round(controllable_profit / revenue * 100, 1) if revenue > 0 else 0.0

        return {
            "revenue": revenue,
            "total_cost": total_cost,
            "financial_profit": financial_profit,
            "controllable_cost": controllable_cost,
            "non_controllable_cost": non_controllable_cost,
            "controllable_profit": controllable_profit,
            "controllable_margin_pct": margin_pct,
            "breakdown": breakdown,
        }
