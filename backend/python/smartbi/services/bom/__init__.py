"""BOM module — raw materials, intermediate products, dish recipes.

Part of P3.5 general capabilities refactor. Modules added incrementally:
  - raw_material (P3.5B F4): unit conversion + cost per calc unit
  - intermediate_product (P3.5C B1): semi-finished products with yield rate [pending]
  - dish (P3.5C B2): 2-layer BOM with dish recipes [pending]
"""
from .raw_material import RawMaterial, UnitConverter
from .intermediate_product import IntermediateProduct, IngredientLine

__all__ = [
    "RawMaterial",
    "UnitConverter",
    "IntermediateProduct",
    "IngredientLine",
]
