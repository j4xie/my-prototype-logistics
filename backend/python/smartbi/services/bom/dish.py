"""Dish model with 2-layer BOM (菜品成本卡).

A dish references both raw materials (凤爪, 大葱) and intermediate
products (自制鸡爪酱, 自制高汤). The cost resolver recursively computes
cost through the intermediate layer:

  dish_cost = sum over ingredients:
    if source == "raw":
      amount × cost_per_calc_unit(raw_material)
    if source == "intermediate":
      amount × unit_cost(intermediate_product)

Data source: 附件七-1/2、菜品成本卡.xlsx — columns map to
DishIngredientLine fields (原料 / 毛料 / ...). The "source" field
distinguishes raw from intermediate: in the real spreadsheets, intermediate
product names start with "自制", but the source field is explicit here
to avoid prefix-matching fragility.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Literal

from smartbi.services.bom.intermediate_product import IntermediateProduct
from smartbi.services.bom.raw_material import RawMaterial, UnitConverter


@dataclass
class DishIngredientLine:
    """One ingredient line in a dish recipe.

    source="raw" → look up in raw_materials dict
    source="intermediate" → look up in intermediate_products dict
    """
    name: str                               # "凤爪" or "自制鸡爪酱"
    amount_calc: float                      # grams needed per portion
    source: Literal["raw", "intermediate"]  # which dict to look in


@dataclass
class Dish:
    """A menu dish with 2-layer BOM.

    calculate_cost() recursively computes cost through the intermediate
    layer — intermediate products call their own calculate_unit_cost()
    against the raw materials dict.
    """
    name: str
    department: str                         # 耗用部门 (明档 / 热菜 / ...)
    sell_price: float                       # 销售单价
    ingredients: list[DishIngredientLine] = field(default_factory=list)

    def calculate_cost(
        self,
        raw_materials: dict[str, RawMaterial],
        intermediate_products: dict[str, IntermediateProduct],
    ) -> float:
        """Total ingredient cost for one portion of this dish."""
        total = 0.0
        for ing in self.ingredients:
            if ing.source == "raw":
                if ing.name not in raw_materials:
                    raise KeyError(
                        f"Raw material {ing.name!r} missing from raw_materials"
                    )
                mat = raw_materials[ing.name]
                total += UnitConverter.cost_of_calc_quantity(mat, ing.amount_calc)
            elif ing.source == "intermediate":
                if ing.name not in intermediate_products:
                    raise KeyError(
                        f"Intermediate product {ing.name!r} missing from "
                        f"intermediate_products"
                    )
                ip = intermediate_products[ing.name]
                unit_cost = ip.calculate_unit_cost(raw_materials)
                total += ing.amount_calc * unit_cost
            else:
                raise ValueError(
                    f"Unknown source {ing.source!r} for ingredient {ing.name!r}. "
                    f"Must be 'raw' or 'intermediate'."
                )
        return total

    def gross_margin(
        self,
        raw_materials: dict[str, RawMaterial],
        intermediate_products: dict[str, IntermediateProduct],
    ) -> float:
        """Gross margin = (sell_price - cost) / sell_price."""
        if self.sell_price == 0:
            return 0
        cost = self.calculate_cost(raw_materials, intermediate_products)
        return (self.sell_price - cost) / self.sell_price

    def to_dict(
        self,
        raw_materials: dict[str, RawMaterial],
        intermediate_products: dict[str, IntermediateProduct],
    ) -> dict:
        cost = self.calculate_cost(raw_materials, intermediate_products)
        return {
            "name": self.name,
            "department": self.department,
            "sellPrice": self.sell_price,
            "cost": round(cost, 2),
            "grossMargin": round(
                self.gross_margin(raw_materials, intermediate_products), 4
            ),
            "ingredients": [
                {
                    "name": ing.name,
                    "amountCalc": ing.amount_calc,
                    "source": ing.source,
                }
                for ing in self.ingredients
            ],
        }
