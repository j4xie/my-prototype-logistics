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


def test_time_series_parses_string_dates_and_sums_daily():
    rows = [
        {"date": "2026-01-03", "amt": 30.0},
        {"date": "2026-01-01", "amt": 10.0},
        {"date": "2026-01-01", "amt": 20.0},
        {"date": "2026-01-02", "amt": 50.0},
    ]
    backend = PolarsBackend.from_rows(rows)
    result = backend.time_series("date", "amt", "D")
    assert len(result) == 3
    assert result[0] == {"period": "2026-01-01", "total": 30.0}
    assert result[1] == {"period": "2026-01-02", "total": 50.0}
    assert result[2] == {"period": "2026-01-03", "total": 30.0}


def test_time_series_rejects_invalid_freq():
    backend = PolarsBackend.from_rows([{"date": "2026-01-01", "amt": 10.0}])
    with pytest.raises(ValueError, match="unsupported freq"):
        backend.time_series("date", "amt", "Q")


def test_percentile_basic():
    rows = [{"amt": float(v)} for v in range(1, 11)]  # 1..10
    backend = PolarsBackend.from_rows(rows)
    pct = backend.percentile("amt", [0.5, 0.9])
    assert 5.0 <= pct[0.5] <= 6.0  # median 5 or 5.5 depending on method
    assert 9.0 <= pct[0.9] <= 10.0


def test_dtype_raises_for_missing_column(sample_backend):
    with pytest.raises(KeyError, match="not in DataFrame"):
        sample_backend.dtype("nonexistent_column")


def test_outliers_drops_internal_m_column():
    rows = [{"amt": float(v)} for v in [10, 11, 12, 10, 11, 12, 10, 1000]]
    backend = PolarsBackend.from_rows(rows)
    outliers = backend.outliers("amt", sigma=2.0)
    assert len(outliers) >= 1
    # Must NOT expose internal _m column
    for row in outliers:
        assert "_m" not in row
        assert "amt" in row
