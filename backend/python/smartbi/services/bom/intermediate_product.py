"""Intermediate product (semi-finished) model with yield rate.

Restaurant kitchens make semi-finished products (prep) that dishes then
reference. Example: 自制鸡爪酱 uses 南乳汁 + 色拉油 + 姜, produces 45 斤
per batch. Dishes like 金汤凤爪 use 800g of this sauce per portion.

Supports yield rate (出成率): when 1 kg of raw 大葱 only yields 0.5 kg
of usable 净料 after trimming, the recipe needs to buy 2× the net amount
to produce the required quantity. Formula: gross_amount = net_amount / yield_rate.

Data source: 附件六-1/2、自制半成品成本卡.xlsx — columns map directly:
  原料名称 → raw_material_name
  批次净料 → raw_amount_calc (net, in calc_unit)
  出成率 → yield_rate
  批次毛料 → gross_amount_calc() (computed)
  制作部门 → IntermediateProduct.department
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Optional

from smartbi.services.bom.raw_material import RawMaterial, UnitConverter


@dataclass
class IngredientLine:
    """One line in an intermediate product's recipe.

    raw_amount_calc is the NET amount needed (in calc_unit, e.g. 克).
    yield_rate adjusts: gross_amount = net / yield_rate.
    Example: 500g net 大葱 with 50% yield → 1000g gross to buy.
    """
    raw_material_name: str
    raw_amount_calc: float          # net amount needed (in calc_unit)
    yield_rate: float = 1.0         # 出成率 (1.0 = no loss, 0.5 = 50% loss)
    raw_material_alias: Optional[str] = None  # optional display alias

    def gross_amount_calc(self) -> float:
        """Gross amount to buy (before trimming / prep loss).

        Formula: gross = net / yield_rate.
        Raises ValueError when yield_rate is 0 (division by zero).
        """
        if self.yield_rate == 0:
            raise ValueError(
                f"yield_rate=0 for ingredient {self.raw_material_name!r} — "
                f"would divide by zero. Check 附件六 entry for correct 出成率."
            )
        return self.raw_amount_calc / self.yield_rate

    def calculate_cost(self, raw_materials: dict[str, RawMaterial]) -> float:
        """Cost of the gross amount (considers yield loss)."""
        if self.raw_material_name not in raw_materials:
            raise KeyError(
                f"Raw material {self.raw_material_name!r} not in raw_materials dict"
            )
        mat = raw_materials[self.raw_material_name]
        return UnitConverter.cost_of_calc_quantity(mat, self.gross_amount_calc())


@dataclass
class IntermediateProduct:
    """A semi-finished product made from raw materials.

    One batch produces batch_yield_qty (in batch_yield_unit).
    calculate_unit_cost returns cost per 1 batch_yield_unit.

    Typically created per-department: 自制鸡爪酱 in 明档, 自制高汤 in 热菜, etc.
    """
    name: str
    department: str                 # 耗用部门 (明档 / 热菜 / 烘焙间 / ...)
    batch_yield_qty: float          # e.g. 45 (batch output quantity)
    batch_yield_unit: str           # e.g. "斤" (batch output unit)
    ingredients: list[IngredientLine] = field(default_factory=list)

    def calculate_batch_cost(self, raw_materials: dict[str, RawMaterial]) -> float:
        """Total cost for one batch (sum of all ingredient costs).

        Each ingredient's gross amount (considering yield loss) × cost per calc unit.
        """
        return sum(line.calculate_cost(raw_materials) for line in self.ingredients)

    def calculate_unit_cost(self, raw_materials: dict[str, RawMaterial]) -> float:
        """Cost per unit of output.

        Raises ValueError when batch_yield_qty is 0 (division by zero).
        """
        if self.batch_yield_qty == 0:
            raise ValueError(
                f"IntermediateProduct {self.name!r} has batch_yield_qty=0"
            )
        return self.calculate_batch_cost(raw_materials) / self.batch_yield_qty

    def to_dict(self) -> dict:
        return {
            "name": self.name,
            "department": self.department,
            "batchYieldQty": self.batch_yield_qty,
            "batchYieldUnit": self.batch_yield_unit,
            "ingredients": [
                {
                    "rawMaterial": line.raw_material_name,
                    "netAmountCalc": line.raw_amount_calc,
                    "yieldRate": line.yield_rate,
                    "grossAmountCalc": line.gross_amount_calc() if line.yield_rate != 0 else None,
                }
                for line in self.ingredients
            ],
        }
