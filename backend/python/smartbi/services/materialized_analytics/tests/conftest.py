"""Shared test fixtures for materialized_analytics."""
from __future__ import annotations

import pytest

from smartbi.services.materialized_analytics.schema import (
    DataSchema, Domain, Field, FieldRole,
)


@pytest.fixture
def restaurant_schema() -> DataSchema:
    """qhj-style restaurant order detail schema."""
    return DataSchema(
        upload_id=9999,
        factory_id="F001",
        domain=Domain.RESTAURANT,
        fields=tuple([
            Field(name="门店名称", role=FieldRole.DIMENSION, dtype="string"),
            Field(name="菜品名称", role=FieldRole.DIMENSION, dtype="string"),
            Field(name="品类", role=FieldRole.DIMENSION, dtype="string"),
            Field(name="订单日期", role=FieldRole.TIME, dtype="datetime"),
            Field(name="销售金额", role=FieldRole.MEASURE, dtype="float"),
            Field(name="数量", role=FieldRole.MEASURE, dtype="int"),
        ]),
        row_count=200003,
        primary_measure="销售金额",
        time_field="订单日期",
    )


@pytest.fixture
def restaurant_sample_rows() -> list:
    return [
        {"门店名称": "大丸百货店", "菜品名称": "招牌毛肚", "品类": "招牌",
         "订单日期": "2026-01-15", "销售金额": 58.0, "数量": 1},
        {"门店名称": "南方百联店", "菜品名称": "清汤锅底", "品类": "锅底",
         "订单日期": "2026-01-15", "销售金额": 28.0, "数量": 1},
    ]
