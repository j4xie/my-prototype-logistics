"""test_template_pareto.py"""
from smartbi.services.materialized_analytics.compute.polars_backend import PolarsBackend
from smartbi.services.materialized_analytics.schema import (
    DataSchema, Domain, Field, FieldRole,
)
from smartbi.services.materialized_analytics.templates.pareto_analysis import (
    ParetoAnalysis,
)


def test_pareto_classic_80_20():
    # 2 stores make 80%, 8 make 20%
    rows = [
        {"store": "big1", "amt": 400.0},
        {"store": "big2", "amt": 400.0},
        {"store": "s1", "amt": 25.0},
        {"store": "s2", "amt": 25.0},
        {"store": "s3", "amt": 25.0},
        {"store": "s4", "amt": 25.0},
        {"store": "s5", "amt": 25.0},
        {"store": "s6", "amt": 25.0},
        {"store": "s7", "amt": 25.0},
        {"store": "s8", "amt": 25.0},
    ]
    schema = DataSchema(
        upload_id=1, factory_id="F001", domain=Domain.RESTAURANT,
        fields=tuple([Field("store", FieldRole.DIMENSION, "string"),
                      Field("amt", FieldRole.MEASURE, "float")]),
        row_count=10, primary_measure="amt",
    )
    result = ParetoAnalysis().run(PolarsBackend.from_rows(rows), schema)
    assert result.applies
    assert result.kpis["labels_for_80pct"] == 2
    assert result.kpis["total_labels"] == 10


def test_pareto_skip_few_labels():
    rows = [{"store": "a", "amt": 100.0}, {"store": "b", "amt": 50.0}]
    schema = DataSchema(
        upload_id=1, factory_id="F001", domain=Domain.RESTAURANT,
        fields=tuple([Field("store", FieldRole.DIMENSION, "string"),
                      Field("amt", FieldRole.MEASURE, "float")]),
        row_count=2, primary_measure="amt",
    )
    result = ParetoAnalysis().run(PolarsBackend.from_rows(rows), schema)
    assert not result.applies
