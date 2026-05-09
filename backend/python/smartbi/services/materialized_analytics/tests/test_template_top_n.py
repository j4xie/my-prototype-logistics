"""test_template_top_n.py"""
import pytest
from smartbi.services.materialized_analytics.compute.polars_backend import PolarsBackend
from smartbi.services.materialized_analytics.schema import (
    DataSchema, Domain, Field, FieldRole,
)
from smartbi.services.materialized_analytics.templates.top_n_by_dim import TopNByDim


@pytest.fixture
def qhj_like_backend() -> PolarsBackend:
    rows = []
    for store, total in [("大丸百货店", 10691165), ("南方百联店", 7515520),
                         ("徐汇日月光店", 6913905), ("徐汇光启城店", 6496736),
                         ("南桥百联店", 2444902), ("边缘店1", 100000),
                         ("边缘店2", 50000)]:
        # simulate N orders per store
        for _ in range(5):
            rows.append({"门店名称": store, "品类": "主食", "销售金额": total / 5})
    return PolarsBackend.from_rows(rows)


@pytest.fixture
def qhj_schema() -> DataSchema:
    return DataSchema(
        upload_id=9999, factory_id="F001", domain=Domain.RESTAURANT,
        fields=tuple([
            Field("门店名称", FieldRole.DIMENSION, "string"),
            Field("品类", FieldRole.DIMENSION, "string"),
            Field("销售金额", FieldRole.MEASURE, "float"),
        ]),
        row_count=35,
        primary_measure="销售金额",
    )


def test_top_n_runs_on_restaurant_schema(qhj_like_backend, qhj_schema):
    template = TopNByDim()
    assert template.applies(qhj_schema)
    result = template.run(qhj_like_backend, qhj_schema)
    assert result.applies
    assert result.kpis["top_label"] == "大丸百货店"
    assert result.kpis["dim_count"] == 1  # only 门店名称 has >=2 labels (品类 has 1)
    assert result.chart_config["type"] == "bar"
    assert len(result.data["top_rows"]) == 7


def test_top_n_skip_when_no_measure(qhj_like_backend):
    schema = DataSchema(
        upload_id=1, factory_id="F001", domain=Domain.RESTAURANT,
        fields=tuple([Field("门店名称", FieldRole.DIMENSION, "string")]),
        row_count=10, primary_measure=None,
    )
    result = TopNByDim().run(qhj_like_backend, schema)
    assert not result.applies
    assert "match" in result.skip_reason.lower() or "no" in result.skip_reason.lower() or \
           "measure" in result.skip_reason.lower()
