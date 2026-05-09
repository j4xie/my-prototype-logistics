"""test_template_category_distribution.py"""
from smartbi.services.materialized_analytics.compute.polars_backend import PolarsBackend
from smartbi.services.materialized_analytics.schema import (
    DataSchema, Domain, Field, FieldRole,
)
from smartbi.services.materialized_analytics.templates.category_distribution import (
    CategoryDistribution,
)


def test_category_distribution_basic():
    rows = [
        {"品类": "主食", "销售金额": 600.0},
        {"品类": "饮品", "销售金额": 300.0},
        {"品类": "小吃", "销售金额": 100.0},
    ]
    schema = DataSchema(
        upload_id=1, factory_id="F001", domain=Domain.RESTAURANT,
        fields=tuple([Field("品类", FieldRole.DIMENSION, "string"),
                      Field("销售金额", FieldRole.MEASURE, "float")]),
        row_count=3, primary_measure="销售金额",
    )
    result = CategoryDistribution().run(PolarsBackend.from_rows(rows), schema)
    assert result.applies
    assert result.kpis["top_label"] == "主食"
    assert result.kpis["top_share_pct"] == 60.0
    assert result.kpis["category_count"] == 3


def test_skip_when_too_many_categories():
    rows = [{"id": f"x_{i}", "amt": i} for i in range(20)]
    schema = DataSchema(
        upload_id=1, factory_id="F001", domain=Domain.RESTAURANT,
        fields=tuple([Field("id", FieldRole.DIMENSION, "string"),
                      Field("amt", FieldRole.MEASURE, "float")]),
        row_count=20, primary_measure="amt",
    )
    result = CategoryDistribution().run(PolarsBackend.from_rows(rows), schema)
    assert not result.applies  # 20 categories > 15 ⇒ not a distribution story
