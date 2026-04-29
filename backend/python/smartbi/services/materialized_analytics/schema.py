"""Data schema types shared across materialized analytics.

DomainDetector produces a DataSchema instance; templates check
DataSchema.applies() to decide if they should run.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Dict, List, Literal, Optional, Tuple


class Domain(str, Enum):
    RESTAURANT = "restaurant"
    FINANCE = "finance"
    SALES = "sales"
    PRODUCTION = "production"
    INVENTORY = "inventory"
    UNKNOWN = "unknown"


class FieldRole(str, Enum):
    MEASURE = "measure"
    DIMENSION = "dimension"
    TIME = "time"
    ID = "id"
    UNKNOWN = "unknown"


@dataclass(frozen=True)
class Field:
    name: str
    role: FieldRole
    dtype: Literal["int", "float", "string", "datetime", "bool"]


@dataclass(frozen=True)
class DataSchema:
    upload_id: int
    factory_id: str
    domain: Domain
    fields: Tuple[Field, ...]
    row_count: int
    primary_measure: Optional[str] = None  # e.g., "销售金额"
    time_field: Optional[str] = None        # e.g., "订单日期"
    hints: Dict[str, Any] = field(default_factory=dict)

    @property
    def measures(self) -> List[str]:
        return [f.name for f in self.fields if f.role == FieldRole.MEASURE]

    @property
    def dimensions(self) -> List[str]:
        return [f.name for f in self.fields if f.role == FieldRole.DIMENSION]

    @property
    def time_fields(self) -> List[str]:
        return [f.name for f in self.fields if f.role == FieldRole.TIME]
