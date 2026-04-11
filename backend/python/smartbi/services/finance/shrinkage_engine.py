# -*- coding: utf-8 -*-
"""Shrinkage (损溢) engine — standard vs actual cost variance analysis.

Every kitchen has variance between:
  - Standard cost: what the BOM says dishes SHOULD have cost
  - Actual cost: what 月底盘点 (inventory count) shows was actually consumed

Formula: variance_amount = actual_cost - standard_cost
         variance_rate = variance_amount / standard_cost

Variance > 2% per department → offender, auto-generate action item with
severity-based suggestion text.

Data sources (for callers):
  - Standard cost: from 2-layer BOM (Dish.calculate_cost × sold_qty summed
    per department)
  - Actual cost: from 月度盘点 (月初盘存 + 本期采购 - 月末盘存 per dept)

References:
  - 4-1-xx店 - 月度经营分析-24.10.pptx Slide 9 (损溢指标分析 table)
  - Slide 10 (工作改进跟踪表 action items format)

Part of P3.5C B3. Section handler wrapping comes in B4.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Optional


@dataclass
class ShrinkageRow:
    """One department's standard vs actual cost comparison."""
    department: str
    standard_cost: float       # sum over dishes: BOM cost × sold_qty
    actual_cost: float         # from inventory count


@dataclass
class ActionItem:
    """Auto-generated action item from an offender row."""
    description: str
    responsible_department: str
    variance_amount: float
    variance_rate: float
    suggestion_zh: str


@dataclass
class ShrinkageReport:
    """Full shrinkage analysis output."""
    rows: list[ShrinkageRow]
    total_standard_cost: float
    total_actual_cost: float
    total_variance_amount: float           # actual - standard
    total_variance_rate: float             # variance / standard
    top_offenders: list[ShrinkageRow] = field(default_factory=list)
    action_items: list[ActionItem] = field(default_factory=list)

    def to_dict(self) -> dict:
        return {
            "rows": [
                {
                    "department": r.department,
                    "standardCost": round(r.standard_cost, 2),
                    "actualCost": round(r.actual_cost, 2),
                    "varianceAmount": round(r.actual_cost - r.standard_cost, 2),
                    "varianceRate": (
                        round((r.actual_cost - r.standard_cost) / r.standard_cost, 4)
                        if r.standard_cost > 0 else None
                    ),
                }
                for r in self.rows
            ],
            "totalStandardCost": round(self.total_standard_cost, 2),
            "totalActualCost": round(self.total_actual_cost, 2),
            "totalVarianceAmount": round(self.total_variance_amount, 2),
            "totalVarianceRate": round(self.total_variance_rate, 4),
            "topOffenders": [
                {
                    "department": r.department,
                    "varianceAmount": round(r.actual_cost - r.standard_cost, 2),
                    "varianceRate": round(
                        (r.actual_cost - r.standard_cost) / r.standard_cost, 4
                    ) if r.standard_cost > 0 else None,
                }
                for r in self.top_offenders
            ],
            "actionItems": [
                {
                    "description": a.description,
                    "responsibleDepartment": a.responsible_department,
                    "varianceAmount": round(a.variance_amount, 2),
                    "varianceRate": round(a.variance_rate, 4),
                    "suggestionZh": a.suggestion_zh,
                }
                for a in self.action_items
            ],
        }


class ShrinkageEngine:
    """Compute shrinkage variance + generate action items.

    Threshold: any row with positive variance rate > 2% becomes an offender
    with an auto-generated action item. Suggestions use 3 severity tiers:
      > 10% → 严重
      5-10% → 需关注
      2-5%  → 偏轻
    """

    OFFENDER_THRESHOLD = 0.02  # 2% variance triggers an action item

    def analyze(self, rows: list[ShrinkageRow]) -> ShrinkageReport:
        if not rows:
            return ShrinkageReport(
                rows=[],
                total_standard_cost=0,
                total_actual_cost=0,
                total_variance_amount=0,
                total_variance_rate=0,
            )

        total_std = sum(r.standard_cost for r in rows)
        total_actual = sum(r.actual_cost for r in rows)
        total_var_amt = total_actual - total_std
        total_var_rate = total_var_amt / total_std if total_std > 0 else 0

        # Find offenders: positive variance rate > threshold
        offenders: list[ShrinkageRow] = []
        for r in rows:
            if r.standard_cost <= 0:
                continue  # can't compute rate
            rate = (r.actual_cost - r.standard_cost) / r.standard_cost
            if rate > self.OFFENDER_THRESHOLD:
                offenders.append(r)

        # Rank by rate descending
        offenders.sort(
            key=lambda r: (r.actual_cost - r.standard_cost) / r.standard_cost,
            reverse=True,
        )

        # Generate action items for top offenders (cap at 10)
        action_items: list[ActionItem] = []
        for r in offenders[:10]:
            variance = r.actual_cost - r.standard_cost
            rate = variance / r.standard_cost
            action_items.append(ActionItem(
                description=(
                    f"{r.department} 档口损溢 {variance:,.0f} ({rate*100:.1f}%)"
                ),
                responsible_department=r.department,
                variance_amount=variance,
                variance_rate=rate,
                suggestion_zh=self._generate_suggestion(r.department, rate),
            ))

        return ShrinkageReport(
            rows=rows,
            total_standard_cost=total_std,
            total_actual_cost=total_actual,
            total_variance_amount=total_var_amt,
            total_variance_rate=total_var_rate,
            top_offenders=offenders,
            action_items=action_items,
        )

    def _generate_suggestion(self, department: str, rate: float) -> str:
        """Severity-based suggestion text."""
        if rate > 0.10:
            return (
                f"{department} 损溢严重超标 (>{rate*100:.0f}%). "
                f"建议立即复盘原料验收 + 切配流程 + 存储条件"
            )
        if rate > 0.05:
            return (
                f"{department} 损溢 {rate*100:.1f}% 需关注. "
                f"加强原料验收标准, 检查出成率是否偏离标准"
            )
        return (
            f"{department} 损溢 {rate*100:.1f}% 偏轻. "
            f"复核一次月度盘点准确性"
        )
