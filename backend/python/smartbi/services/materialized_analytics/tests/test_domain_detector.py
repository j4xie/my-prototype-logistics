"""test_domain_detector.py"""
from smartbi.services.materialized_analytics.domain_detector import (
    RestaurantRuleDetector,
)
from smartbi.services.materialized_analytics.schema import (
    Domain, Field, FieldRole,
)


def test_detect_restaurant_from_dim_and_measure():
    detector = RestaurantRuleDetector()
    fields = [
        Field(name="门店名称", role=FieldRole.DIMENSION, dtype="string"),
        Field(name="菜品名称", role=FieldRole.DIMENSION, dtype="string"),
        Field(name="销售金额", role=FieldRole.MEASURE, dtype="float"),
    ]
    assert detector.detect(fields, []) == Domain.RESTAURANT


def test_detect_unknown_for_generic_data():
    detector = RestaurantRuleDetector()
    fields = [
        Field(name="column_a", role=FieldRole.DIMENSION, dtype="string"),
        Field(name="column_b", role=FieldRole.MEASURE, dtype="float"),
    ]
    assert detector.detect(fields, []) == Domain.UNKNOWN


def test_detect_unknown_when_only_dim_hits():
    detector = RestaurantRuleDetector()
    fields = [
        Field(name="门店名称", role=FieldRole.DIMENSION, dtype="string"),
        Field(name="菜品名称", role=FieldRole.DIMENSION, dtype="string"),
        Field(name="生产批号", role=FieldRole.MEASURE, dtype="string"),
    ]
    # 2 dim hits but 0 measure hits → not confident
    assert detector.detect(fields, []) == Domain.UNKNOWN


def test_detect_empty_fields_returns_unknown():
    detector = RestaurantRuleDetector()
    assert detector.detect([], []) == Domain.UNKNOWN
