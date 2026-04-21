"""test_polars_backend.py"""
import pytest
from smartbi.services.materialized_analytics.compute.polars_backend import PolarsBackend


@pytest.fixture
def sample_backend() -> PolarsBackend:
    rows = [
        {"store": "A", "category": "main", "date": "2026-01-01", "amount": 100.0},
        {"store": "A", "category": "main", "date": "2026-01-02", "amount": 150.0},
        {"store": "B", "category": "drink", "date": "2026-01-01", "amount": 50.0},
        {"store": "B", "category": "main", "date": "2026-01-03", "amount": 300.0},
        {"store": "C", "category": "drink", "date": "2026-01-02", "amount": 80.0},
    ]
    return PolarsBackend.from_rows(rows)


def test_row_count(sample_backend):
    assert sample_backend.row_count() == 5


def test_group_sum_stores_by_amount(sample_backend):
    result = sample_backend.group_sum("store", "amount")
    assert result[0] == {"label": "B", "total": 350.0}
    assert result[1] == {"label": "A", "total": 250.0}
    assert result[2] == {"label": "C", "total": 80.0}


def test_top_n(sample_backend):
    result = sample_backend.top_n("store", "amount", 2)
    assert len(result) == 2
    assert result[0]["label"] == "B"


def test_mean_std(sample_backend):
    stats = sample_backend.mean_std("amount")
    assert stats["min"] == 50.0
    assert stats["max"] == 300.0
    assert 135.0 < stats["mean"] < 137.0  # 136.0


def test_outliers_none_for_small_sample(sample_backend):
    # With 5 rows and 2σ, no outliers expected
    assert sample_backend.outliers("amount", sigma=2.0) == []


def test_outliers_catches_extreme_values():
    rows = [{"amount": v} for v in [10, 12, 11, 13, 10, 12, 1000]]
    backend = PolarsBackend.from_rows(rows)
    outliers = backend.outliers("amount", sigma=2.0)
    assert len(outliers) == 1
    assert outliers[0]["amount"] == 1000.0
