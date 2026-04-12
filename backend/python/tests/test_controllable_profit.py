"""Controllable profit = revenue - controllable costs only.
Non-controllable: rent, tax, depreciation, insurance.
Controllable: COGS, labor, utilities, marketing, repairs.
"""
from smartbi.services.finance.controllable_profit import ControllableProfitCalculator


def test_basic_controllable_profit():
    calc = ControllableProfitCalculator()
    result = calc.compute(
        revenue=500000,
        cost_items={
            "food_cost": 175000,
            "labor": 100000,
            "utilities": 15000,
            "rent": 60000,
            "tax": 25000,
            "depreciation": 10000,
            "marketing": 8000,
            "repairs": 5000,
        },
        non_controllable_keys=["rent", "tax", "depreciation"],
    )
    assert result["revenue"] == 500000
    assert result["total_cost"] == 398000
    assert result["financial_profit"] == 102000
    assert result["controllable_cost"] == 303000
    assert result["controllable_profit"] == 197000
    assert result["controllable_margin_pct"] == 39.4


def test_non_controllable_defaults():
    calc = ControllableProfitCalculator()
    result = calc.compute(
        revenue=300000,
        cost_items={"food_cost": 100000, "labor": 80000, "rent": 40000},
    )
    assert result["controllable_profit"] == 120000


def test_custom_non_controllable_keys():
    calc = ControllableProfitCalculator()
    result = calc.compute(
        revenue=100000,
        cost_items={"food_cost": 30000, "labor": 20000, "investment": 15000},
        non_controllable_keys=["investment"],
    )
    assert result["controllable_cost"] == 50000
    assert result["controllable_profit"] == 50000
