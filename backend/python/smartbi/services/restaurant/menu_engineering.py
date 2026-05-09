"""Kasavana-Smith Menu Engineering 4-quadrant analyzer.

Classifies menu items by popularity (sold quantity) x profitability
(contribution margin ratio). Split point: median of each axis.

Reference: Kasavana & Smith, "Menu Engineering: A Practical Guide to
Menu Analysis" (1990). https://en.wikipedia.org/wiki/Menu_engineering

The analyzer is stateless -- construct once, call analyze() for each
input DataFrame. Handles empty input gracefully (returns empty report).
"""
from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum

import pandas as pd


class MenuQuadrant(str, Enum):
    """4 Kasavana-Smith quadrants.

    Uses string values so JSON serialization works naturally.
    """
    STAR = "star"            # High volume x High margin -- 招牌菜
    CASH_COW = "cash_cow"    # High volume x Low margin -- 走量主力
    PUZZLE = "puzzle"        # Low volume x High margin -- 高利无人点
    DOG = "dog"              # Low volume x Low margin -- 淘汰候选


@dataclass
class MenuItemClassification:
    """One menu item's classification result."""
    name: str
    sold_qty: int
    revenue: float
    food_cost: float
    contribution_margin: float   # revenue - food_cost (absolute $)
    margin_ratio: float          # (revenue - food_cost) / revenue
    quadrant: MenuQuadrant

    def to_dict(self) -> dict:
        return {
            "name": self.name,
            "soldQty": self.sold_qty,
            "revenue": round(self.revenue, 2),
            "foodCost": round(self.food_cost, 2),
            "contributionMargin": round(self.contribution_margin, 2),
            "marginRatio": round(self.margin_ratio, 4),
            "quadrant": self.quadrant.value,
        }


@dataclass
class MenuEngineeringReport:
    """Complete analyzer output."""
    classifications: list[MenuItemClassification]
    popularity_median: float
    margin_median: float
    summary: dict[str, int]              # quadrant counts + totals
    recommendations: list[str] = field(default_factory=list)

    def to_dict(self) -> dict:
        return {
            "classifications": [c.to_dict() for c in self.classifications],
            "popularityMedian": self.popularity_median,
            "marginMedian": self.margin_median,
            "summary": self.summary,
            "recommendations": self.recommendations,
            "quadrants": self._grouped(),
        }

    def _grouped(self) -> dict[str, list[dict]]:
        """Items grouped by quadrant for frontend rendering convenience."""
        groups: dict[str, list[dict]] = {q.value: [] for q in MenuQuadrant}
        for c in self.classifications:
            groups[c.quadrant.value].append(c.to_dict())
        return groups


class MenuEngineeringAnalyzer:
    """Classify menu items into 4 quadrants by popularity x margin.

    Uses median split on both axes -- stable regardless of data size.
    The >= comparison ensures items exactly at the median are classified
    as 'high' rather than 'low', biasing toward more optimistic outcomes.
    """

    def analyze(
        self,
        df: pd.DataFrame,
        name_col: str = "name",
        qty_col: str = "sold_qty",
        revenue_col: str = "revenue",
        food_cost_col: str = "food_cost",
    ) -> MenuEngineeringReport:
        if df is None or df.empty:
            return MenuEngineeringReport(
                classifications=[],
                popularity_median=0.0,
                margin_median=0.0,
                summary={
                    "total_items": 0,
                    "star_count": 0,
                    "cow_count": 0,
                    "puzzle_count": 0,
                    "dog_count": 0,
                },
                recommendations=[],
            )

        required = [name_col, qty_col, revenue_col, food_cost_col]
        missing = [c for c in required if c not in df.columns]
        if missing:
            raise ValueError(f"Missing required columns: {missing}")

        df = df.copy()
        # Guard against division by zero in margin_ratio
        df["_margin_ratio"] = (df[revenue_col] - df[food_cost_col]) / df[revenue_col].replace(0, 1)

        popularity_median = float(df[qty_col].median())
        margin_median = float(df["_margin_ratio"].median())

        classifications: list[MenuItemClassification] = []
        for _, row in df.iterrows():
            qty = int(row[qty_col])
            revenue = float(row[revenue_col])
            food_cost = float(row[food_cost_col])
            margin_ratio = float(row["_margin_ratio"])

            high_volume = qty >= popularity_median
            high_margin = margin_ratio >= margin_median

            if high_volume and high_margin:
                q = MenuQuadrant.STAR
            elif high_volume and not high_margin:
                q = MenuQuadrant.CASH_COW
            elif not high_volume and high_margin:
                q = MenuQuadrant.PUZZLE
            else:
                q = MenuQuadrant.DOG

            classifications.append(MenuItemClassification(
                name=str(row[name_col]),
                sold_qty=qty,
                revenue=revenue,
                food_cost=food_cost,
                contribution_margin=revenue - food_cost,
                margin_ratio=margin_ratio,
                quadrant=q,
            ))

        counts = {q.value: 0 for q in MenuQuadrant}
        for c in classifications:
            counts[c.quadrant.value] += 1

        summary = {
            "total_items": len(classifications),
            "star_count": counts["star"],
            "cow_count": counts["cash_cow"],
            "puzzle_count": counts["puzzle"],
            "dog_count": counts["dog"],
        }

        return MenuEngineeringReport(
            classifications=classifications,
            popularity_median=popularity_median,
            margin_median=margin_median,
            summary=summary,
            recommendations=self._generate_recommendations(classifications, summary),
        )

    def _generate_recommendations(
        self,
        classifications: list[MenuItemClassification],
        summary: dict[str, int],
    ) -> list[str]:
        """Generate actionable Chinese recommendations per quadrant."""
        recs: list[str] = []
        dog_count = summary["dog_count"]
        puzzle_count = summary["puzzle_count"]
        star_count = summary["star_count"]
        total = summary["total_items"]

        if dog_count > 0:
            dogs = [c.name for c in classifications if c.quadrant == MenuQuadrant.DOG][:5]
            recs.append(
                f"淘汰 {dog_count} 道 Dog 菜 (低销 x 低利): {', '.join(dogs)} -- 释放菜单空间和备料 SKU"
            )

        if puzzle_count > 0:
            puzzles = [c.name for c in classifications if c.quadrant == MenuQuadrant.PUZZLE][:5]
            recs.append(
                f"{puzzle_count} 道 Puzzle 菜 (高利无人点): {', '.join(puzzles)} -- 考虑服务员话术推广或重新定位"
            )

        if star_count > 0:
            stars = [c.name for c in classifications if c.quadrant == MenuQuadrant.STAR][:5]
            recs.append(
                f"保护 {star_count} 道 Star 菜 (高销高利): {', '.join(stars)} -- 锁定 BOM, 固定 SOP, 不许私改配方"
            )

        if total >= 20 and dog_count / total > 0.25:
            recs.append(
                f"Dog 占比 {dog_count}/{total} 过高, 菜单结构性问题, 建议整体重设计"
            )

        return recs
