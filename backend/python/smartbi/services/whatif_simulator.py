"""What-If Pricing Simulator Service.

Calculates revenue, gross profit, and breakeven impacts when price, cost,
or traffic parameters are adjusted.  Uses a simplified linear price-elasticity
model tuned for restaurant / food-processing businesses.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Any

import pandas as pd

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Restaurant price-elasticity coefficient (simplified linear model)
# A 1% price increase leads to ~1.2% traffic decrease for mid-range restaurants.
# ---------------------------------------------------------------------------
DEFAULT_ELASTICITY = -1.2


@dataclass
class ScenarioInput:
    """A single scenario to simulate."""
    name: str = "baseline"
    priceChangePct: float = 0.0       # e.g. 10 means +10%
    costChangePct: float = 0.0
    trafficChangePct: float = 0.0


@dataclass
class ScenarioResult:
    """Simulation output for one scenario."""
    name: str
    priceChangePct: float
    costChangePct: float
    trafficChangePct: float
    # Current (baseline) metrics
    currentRevenue: float = 0.0
    currentCost: float = 0.0
    currentGrossProfit: float = 0.0
    currentGrossMargin: float = 0.0
    # Projected metrics
    projectedRevenue: float = 0.0
    projectedCost: float = 0.0
    projectedGrossProfit: float = 0.0
    projectedGrossMargin: float = 0.0
    # Impact deltas
    revenueImpact: float = 0.0
    revenueImpactPct: float = 0.0
    grossProfitImpact: float = 0.0
    grossProfitImpactPct: float = 0.0
    # Breakeven
    breakevenPriceChangePct: Optional[float] = None


@dataclass
class SensitivityCell:
    """One cell in the sensitivity matrix."""
    priceChangePct: float
    costChangePct: float
    grossProfit: float
    grossMargin: float


@dataclass
class CostStructure:
    """Extracted cost structure from uploaded data."""
    totalRevenue: float = 0.0
    totalCost: float = 0.0
    ingredientRatio: float = 0.35     # default: 35% of revenue
    laborRatio: float = 0.25          # default: 25%
    rentRatio: float = 0.10           # default: 10%
    otherRatio: float = 0.05          # default: 5%
    grossMargin: float = 0.25


class WhatIfSimulator:
    """Core calculation engine for What-If simulations."""

    def __init__(self, elasticity: float = DEFAULT_ELASTICITY):
        self.elasticity = elasticity

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def simulate(
        self,
        data: pd.DataFrame,
        scenarios: List[ScenarioInput],
    ) -> Dict[str, Any]:
        """Run simulation for one or more scenarios against the uploaded data.

        Returns a dict with:
          - costStructure: extracted cost breakdown
          - scenarios: list of ScenarioResult dicts
          - sensitivityMatrix: 2-D grid of price x cost combinations
        """
        cost_structure = self._extract_cost_structure(data)

        results: List[Dict[str, Any]] = []
        for sc in scenarios:
            result = self._run_scenario(cost_structure, sc)
            results.append(self._scenario_result_to_dict(result))

        # Build sensitivity matrix (price -30..+30 step 10, cost -20..+20 step 10)
        sensitivity = self._build_sensitivity_matrix(cost_structure)

        # Multi-scenario comparison chart data (optimistic / baseline / pessimistic)
        comparison_chart = self._build_comparison_chart(cost_structure)

        return {
            "costStructure": {
                "totalRevenue": round(cost_structure.totalRevenue, 2),
                "totalCost": round(cost_structure.totalCost, 2),
                "ingredientRatio": round(cost_structure.ingredientRatio, 4),
                "laborRatio": round(cost_structure.laborRatio, 4),
                "rentRatio": round(cost_structure.rentRatio, 4),
                "otherRatio": round(cost_structure.otherRatio, 4),
                "grossMargin": round(cost_structure.grossMargin, 4),
            },
            "scenarios": results,
            "sensitivityMatrix": sensitivity,
            "comparisonChart": comparison_chart,
        }

    # ------------------------------------------------------------------
    # Cost structure extraction
    # ------------------------------------------------------------------

    def _extract_cost_structure(self, df: pd.DataFrame) -> CostStructure:
        """Attempt to extract cost structure from uploaded data.

        Heuristic: look for columns whose names match revenue/cost/ingredient
        keywords.  If not found, use industry-average defaults.
        """
        cs = CostStructure()

        cols_lower = {c: c.lower() for c in df.columns}

        # --- Revenue detection ---
        revenue_col = self._find_column(cols_lower, [
            '营业收入', '收入', '销售额', '销售收入', 'revenue', 'sales',
            '总收入', '营收',
        ])
        if revenue_col:
            cs.totalRevenue = pd.to_numeric(df[revenue_col], errors='coerce').sum()

        # --- Cost detection ---
        cost_col = self._find_column(cols_lower, [
            '营业成本', '成本', '总成本', 'cost', 'cogs',
            '销售成本', '直接成本',
        ])
        if cost_col:
            cs.totalCost = pd.to_numeric(df[cost_col], errors='coerce').sum()

        # --- If no explicit columns, try to infer from totals / summary rows ---
        if cs.totalRevenue == 0:
            # Try summing all numeric columns whose header contains 金额/amount
            amount_col = self._find_column(cols_lower, ['金额', 'amount', '合计'])
            if amount_col:
                cs.totalRevenue = pd.to_numeric(df[amount_col], errors='coerce').sum()

        # Ingredient / labor / rent ratios
        ingredient_col = self._find_column(cols_lower, [
            '原料成本', '食材成本', '原材料', 'ingredient', '食材',
        ])
        labor_col = self._find_column(cols_lower, [
            '人工成本', '人力成本', '工资', 'labor', '人工',
        ])
        rent_col = self._find_column(cols_lower, [
            '租金', '房租', 'rent', '租赁',
        ])

        if cs.totalRevenue > 0:
            if ingredient_col:
                val = pd.to_numeric(df[ingredient_col], errors='coerce').sum()
                cs.ingredientRatio = val / cs.totalRevenue if cs.totalRevenue else 0.35
            if labor_col:
                val = pd.to_numeric(df[labor_col], errors='coerce').sum()
                cs.laborRatio = val / cs.totalRevenue if cs.totalRevenue else 0.25
            if rent_col:
                val = pd.to_numeric(df[rent_col], errors='coerce').sum()
                cs.rentRatio = val / cs.totalRevenue if cs.totalRevenue else 0.10

            if cs.totalCost == 0:
                cs.totalCost = cs.totalRevenue * (cs.ingredientRatio + cs.laborRatio + cs.rentRatio + cs.otherRatio)

            cs.grossMargin = (cs.totalRevenue - cs.totalCost) / cs.totalRevenue if cs.totalRevenue else 0.25
        else:
            # Fallback: use industry defaults with a synthetic revenue figure
            cs.totalRevenue = 1_000_000
            cs.totalCost = cs.totalRevenue * 0.65
            cs.grossMargin = 0.35
            logger.info("No revenue column found — using default cost structure")

        # Clamp gross margin to reasonable range
        cs.grossMargin = max(-1.0, min(1.0, cs.grossMargin))

        return cs

    # ------------------------------------------------------------------
    # Scenario calculation
    # ------------------------------------------------------------------

    def _run_scenario(self, cs: CostStructure, sc: ScenarioInput) -> ScenarioResult:
        """Compute projected metrics for a single scenario."""
        price_mult = 1 + sc.priceChangePct / 100
        cost_mult = 1 + sc.costChangePct / 100

        # Traffic change = explicit change + elasticity-driven change from price
        elasticity_traffic_change = self.elasticity * sc.priceChangePct  # pct
        total_traffic_change_pct = sc.trafficChangePct + elasticity_traffic_change
        traffic_mult = 1 + total_traffic_change_pct / 100

        projected_revenue = cs.totalRevenue * price_mult * traffic_mult
        projected_cost = cs.totalCost * cost_mult * traffic_mult  # costs scale with traffic
        projected_gp = projected_revenue - projected_cost
        projected_gm = projected_gp / projected_revenue if projected_revenue != 0 else 0

        current_gp = cs.totalRevenue - cs.totalCost

        # Breakeven: find price change % where projected GP = current GP
        # GP(p) = Rev * (1+p/100) * traffic(p) - Cost * costMult * traffic(p)
        # Setting GP(p) = current_gp and solving is complex with elasticity;
        # use simple iterative search.
        breakeven_pct = self._find_breakeven(cs, sc)

        return ScenarioResult(
            name=sc.name,
            priceChangePct=sc.priceChangePct,
            costChangePct=sc.costChangePct,
            trafficChangePct=sc.trafficChangePct,
            currentRevenue=round(cs.totalRevenue, 2),
            currentCost=round(cs.totalCost, 2),
            currentGrossProfit=round(current_gp, 2),
            currentGrossMargin=round(cs.grossMargin, 4),
            projectedRevenue=round(projected_revenue, 2),
            projectedCost=round(projected_cost, 2),
            projectedGrossProfit=round(projected_gp, 2),
            projectedGrossMargin=round(projected_gm, 4),
            revenueImpact=round(projected_revenue - cs.totalRevenue, 2),
            revenueImpactPct=round((projected_revenue / cs.totalRevenue - 1) * 100, 2) if cs.totalRevenue else 0,
            grossProfitImpact=round(projected_gp - current_gp, 2),
            grossProfitImpactPct=round((projected_gp / current_gp - 1) * 100, 2) if current_gp else 0,
            breakevenPriceChangePct=breakeven_pct,
        )

    def _find_breakeven(self, cs: CostStructure, sc: ScenarioInput) -> Optional[float]:
        """Find the price change % that keeps gross profit equal to current level.

        Uses binary search over [-50, +50] range.
        """
        current_gp = cs.totalRevenue - cs.totalCost
        if current_gp <= 0:
            return None

        cost_mult = 1 + sc.costChangePct / 100

        def gp_at_price(p_pct: float) -> float:
            price_m = 1 + p_pct / 100
            traffic_change = sc.trafficChangePct + self.elasticity * p_pct
            traffic_m = 1 + traffic_change / 100
            rev = cs.totalRevenue * price_m * traffic_m
            cost = cs.totalCost * cost_mult * traffic_m
            return rev - cost

        # Binary search
        lo, hi = -50.0, 50.0
        for _ in range(50):
            mid = (lo + hi) / 2
            if gp_at_price(mid) < current_gp:
                lo = mid
            else:
                hi = mid

        result = round((lo + hi) / 2, 2)
        # Only return if the breakeven point is within a reasonable range
        if -50 <= result <= 50:
            return result
        return None

    # ------------------------------------------------------------------
    # Sensitivity matrix
    # ------------------------------------------------------------------

    def _build_sensitivity_matrix(self, cs: CostStructure) -> List[Dict[str, Any]]:
        """Build a 2-D sensitivity grid: price changes vs cost changes."""
        price_steps = list(range(-30, 31, 10))   # -30, -20, -10, 0, 10, 20, 30
        cost_steps = list(range(-20, 21, 10))     # -20, -10, 0, 10, 20

        cells: List[Dict[str, Any]] = []
        for p in price_steps:
            for c in cost_steps:
                price_m = 1 + p / 100
                cost_m = 1 + c / 100
                traffic_change = self.elasticity * p
                traffic_m = 1 + traffic_change / 100

                rev = cs.totalRevenue * price_m * traffic_m
                cost_val = cs.totalCost * cost_m * traffic_m
                gp = rev - cost_val
                gm = gp / rev if rev != 0 else 0

                cells.append({
                    "priceChangePct": p,
                    "costChangePct": c,
                    "grossProfit": round(gp, 2),
                    "grossMargin": round(gm, 4),
                })

        return cells

    # ------------------------------------------------------------------
    # Comparison chart (optimistic / baseline / pessimistic)
    # ------------------------------------------------------------------

    def _build_comparison_chart(self, cs: CostStructure) -> Dict[str, Any]:
        """Pre-built 3-scenario comparison for the frontend chart."""
        presets = [
            ScenarioInput(name="pessimistic", priceChangePct=-10, costChangePct=10, trafficChangePct=-15),
            ScenarioInput(name="baseline", priceChangePct=0, costChangePct=0, trafficChangePct=0),
            ScenarioInput(name="optimistic", priceChangePct=5, costChangePct=-5, trafficChangePct=10),
        ]
        labels = ["悲观", "基准", "乐观"]
        revenues = []
        costs = []
        profits = []

        for sc in presets:
            r = self._run_scenario(cs, sc)
            revenues.append(round(r.projectedRevenue, 2))
            costs.append(round(r.projectedCost, 2))
            profits.append(round(r.projectedGrossProfit, 2))

        return {
            "labels": labels,
            "revenues": revenues,
            "costs": costs,
            "profits": profits,
        }

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _find_column(cols_lower: Dict[str, str], keywords: List[str]) -> Optional[str]:
        """Find first column whose lowercased name contains any keyword."""
        for kw in keywords:
            kw_lower = kw.lower()
            for orig, low in cols_lower.items():
                if kw_lower in low or low in kw_lower:
                    return orig
        return None

    @staticmethod
    def _scenario_result_to_dict(r: ScenarioResult) -> Dict[str, Any]:
        return {
            "name": r.name,
            "priceChangePct": r.priceChangePct,
            "costChangePct": r.costChangePct,
            "trafficChangePct": r.trafficChangePct,
            "currentRevenue": r.currentRevenue,
            "currentCost": r.currentCost,
            "currentGrossProfit": r.currentGrossProfit,
            "currentGrossMargin": r.currentGrossMargin,
            "projectedRevenue": r.projectedRevenue,
            "projectedCost": r.projectedCost,
            "projectedGrossProfit": r.projectedGrossProfit,
            "projectedGrossMargin": r.projectedGrossMargin,
            "revenueImpact": r.revenueImpact,
            "revenueImpactPct": r.revenueImpactPct,
            "grossProfitImpact": r.grossProfitImpact,
            "grossProfitImpactPct": r.grossProfitImpactPct,
            "breakevenPriceChangePct": r.breakevenPriceChangePct,
        }
