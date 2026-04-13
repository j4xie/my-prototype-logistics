from __future__ import annotations

"""Margin spec contract — configurable boundary decisions for P&L computation.


Every mature restaurant finance team has to answer 4 ambiguous binary
questions before computing "net margin":
  1. Is 员工餐 (staff meal) cost included in 营业成本 (COGS)?
  2. Is 燃气 (gas) cost included in 营业成本?
  3. How are 充卡赠送 (stored value giveaways) treated on the revenue side?
  4. Are 投资费用 (renovation/expansion) included in 经营费用?

Plus: 毛利率 is computed 折前 (before discount) AND 折后 (after discount),
both matter for different audiences (owner wants pre-discount, finance
wants post-discount).

This module makes every option explicit as a config field with a sensible
default. Customers who disagree can override via `FactoryConfig.marginSpec`.
No pre-launch questionnaire required — ship with defaults, iterate later.
"""

from dataclasses import dataclass
from enum import Enum
from typing import Any


class StoredValueTreatment(str, Enum):
    """How to treat stored value card amounts on revenue side.

    PREPAID  — 充卡时计入预收款负债, 消费时才结转收入 (most common, default)
    REVENUE  — 充卡时直接计入收入, "赠送"部分作为费用支出 (aggressive recognition)
    EXCLUDED — 充卡完全不纳入收入, 只追踪兑付余额 (conservative)
    """
    PREPAID = "PREPAID"
    REVENUE = "REVENUE"
    EXCLUDED = "EXCLUDED"


class MarginCalcMode(str, Enum):
    """Which margin variant(s) to compute.

    FOLDED   — only (折后收入 - 成本) / 折后收入 (post-discount)
    UNFOLDED — only (折前收入 - 成本) / 折前收入 (pre-discount)
    BOTH     — compute both, UI picks primary via primary_margin_display
    """
    FOLDED = "FOLDED"
    UNFOLDED = "UNFOLDED"
    BOTH = "BOTH"


@dataclass
class MarginSpec:
    """Configurable P&L boundary spec.

    All fields have sensible defaults that match common restaurant practice.
    Customers who want different treatment can override via factory config.

    Example:
        spec = MarginSpec()  # all defaults
        spec = MarginSpec.from_dict(factory_config.get("marginSpec", {}))
        if spec.include_staff_meal_in_cogs:
            cogs += staff_meal_cost
    """
    include_staff_meal_in_cogs: bool = True
    include_gas_in_cogs: bool = True
    stored_value_treatment: StoredValueTreatment = StoredValueTreatment.PREPAID
    include_investment_in_opex: bool = False
    margin_calc_mode: MarginCalcMode = MarginCalcMode.BOTH
    primary_margin_display: str = "UNFOLDED"  # "FOLDED" or "UNFOLDED"

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "MarginSpec":
        """Parse from camelCase JSON config. Missing keys use defaults."""
        if not isinstance(data, dict):
            raise ValueError(f"Expected dict, got {type(data).__name__}")

        treatment_str = data.get("storedValueTreatment", "PREPAID")
        try:
            treatment = StoredValueTreatment(treatment_str)
        except ValueError:
            raise ValueError(
                f"Unknown stored value treatment: {treatment_str!r}. "
                f"Must be one of {[t.value for t in StoredValueTreatment]}"
            )

        mode_str = data.get("marginCalcMode", "BOTH")
        try:
            mode = MarginCalcMode(mode_str)
        except ValueError:
            raise ValueError(
                f"Unknown margin calc mode: {mode_str!r}. "
                f"Must be one of {[m.value for m in MarginCalcMode]}"
            )

        return cls(
            include_staff_meal_in_cogs=data.get("includeStaffMealInCogs", True),
            include_gas_in_cogs=data.get("includeGasInCogs", True),
            stored_value_treatment=treatment,
            include_investment_in_opex=data.get("includeInvestmentInOpex", False),
            margin_calc_mode=mode,
            primary_margin_display=data.get("primaryMarginDisplay", "UNFOLDED"),
        )

    def to_dict(self) -> dict[str, Any]:
        """Serialize to camelCase JSON for factory config storage."""
        return {
            "includeStaffMealInCogs": self.include_staff_meal_in_cogs,
            "includeGasInCogs": self.include_gas_in_cogs,
            "storedValueTreatment": self.stored_value_treatment.value,
            "includeInvestmentInOpex": self.include_investment_in_opex,
            "marginCalcMode": self.margin_calc_mode.value,
            "primaryMarginDisplay": self.primary_margin_display,
        }
