"""Raw material master + unit conversion.

Every restaurant inventory system has this pattern:
  - Inventory unit (库存单位): 斤, 包, kg, 块, 箱, ...
  - Calc unit (核算单位): 克, 包, 克, 块, 瓶, ...
  - Conversion spec (核算规格): how many calc_units = 1 inventory_unit
    Examples:
      1 斤 = 500 克 (spec=500)
      1 包 = 1 包 (spec=1)
      1 kg = 1000 克 (spec=1000)
      1 块 = 1 块 (spec=1)

Without this conversion, COGS calculation is wrong by factors of 10-1000.
A recipe saying "500 克 of 小青龙" is NOT the same as "500 斤".

Data source: `附件三、门店原材料.xlsx` — columns map directly:
  库存单位 → inventory_unit
  核算单位 → calc_unit
  核算规格 → calc_spec
  规格 → regulation (optional, packaging like "1*20")
  最近收料单价 → recent_price
  供应商 → supplier

Populated via API sync from Cretas Java `Material` table, or via YAML
upload for prototype factories. Part of P3.5B F4 foundation for
G3 (2-layer BOM) in Phase 3.5C.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Optional


@dataclass
class RawMaterial:
    """One raw material with unit conversion data.

    Immutable-ish — mutate only if refreshing from price feed or
    correcting a data entry error. BOM calculations read this data
    at request time.
    """
    name: str                           # e.g. "小青龙(冻-好)200-300g"
    category: str                       # e.g. "海鲜类"
    inventory_unit: str                 # e.g. "斤"
    calc_unit: str                      # e.g. "克"
    calc_spec: float                    # e.g. 500 (1 斤 = 500 克)
    recent_price: float                 # price per inventory_unit (e.g. 147.02 ¥/斤)
    supplier: str                       # e.g. "长沙四季商贸"
    regulation: Optional[str] = None    # e.g. "1*20" (packaging spec)


class UnitConverter:
    """Stateless helpers for unit conversion + cost per calc unit.

    All methods take a RawMaterial and convert quantities / costs between
    inventory and calc units using the material's calc_spec.
    """

    @staticmethod
    def _check_spec(mat: RawMaterial) -> None:
        if mat.calc_spec == 0:
            raise ValueError(
                f"RawMaterial {mat.name!r} has calc_spec=zero — would divide by zero. "
                f"Check 附件三 entry for correct 核算规格."
            )

    @staticmethod
    def inventory_to_calc(mat: RawMaterial, inventory_amount: float) -> float:
        """Convert inventory quantity to calc quantity.

        Example: 2.5 斤 of 小青龙 → 2.5 × 500 = 1250 g
        """
        UnitConverter._check_spec(mat)
        return inventory_amount * mat.calc_spec

    @staticmethod
    def calc_to_inventory(mat: RawMaterial, calc_amount: float) -> float:
        """Convert calc quantity back to inventory quantity.

        Example: 250 g of 小青龙 → 250 / 500 = 0.5 斤
        """
        UnitConverter._check_spec(mat)
        return calc_amount / mat.calc_spec

    @staticmethod
    def cost_per_calc_unit(mat: RawMaterial) -> float:
        """Price per calc unit.

        Example: ¥147.02 / 斤 ÷ 500 g / 斤 = ¥0.29404 / g
        """
        UnitConverter._check_spec(mat)
        return mat.recent_price / mat.calc_spec

    @staticmethod
    def cost_of_calc_quantity(mat: RawMaterial, calc_amount: float) -> float:
        """Total cost for a given calc quantity.

        Example: 800 g of 小青龙 at ¥0.294/g = ¥235.23
        """
        return calc_amount * UnitConverter.cost_per_calc_unit(mat)
