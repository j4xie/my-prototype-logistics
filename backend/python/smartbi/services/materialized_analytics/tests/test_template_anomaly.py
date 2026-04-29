"""test_template_anomaly.py"""
from smartbi.services.materialized_analytics.compute.polars_backend import PolarsBackend
from smartbi.services.materialized_analytics.schema import (
    DataSchema, Domain, Field, FieldRole,
)
from smartbi.services.materialized_analytics.templates.anomaly_detection import (
    AnomalyDetection,
)


def test_anomaly_finds_outlier_in_large_sample():
    rows = [{"amt": 100.0 + (i % 10)} for i in range(40)]
    rows.append({"amt": 10000.0})  # clear outlier
    schema = DataSchema(
        upload_id=1, factory_id="F001", domain=Domain.RESTAURANT,
        fields=tuple([Field("amt", FieldRole.MEASURE, "float")]),
        row_count=41, primary_measure="amt",
    )
    result = AnomalyDetection().run(PolarsBackend.from_rows(rows), schema)
    assert result.applies
    assert result.kpis["outlier_count"] >= 1


def test_anomaly_skip_small_sample():
    schema = DataSchema(
        upload_id=1, factory_id="F001", domain=Domain.RESTAURANT,
        fields=tuple([Field("amt", FieldRole.MEASURE, "float")]),
        row_count=10, primary_measure="amt",
    )
    backend = PolarsBackend.from_rows([{"amt": 100.0}])
    result = AnomalyDetection().run(backend, schema)
    assert not result.applies
