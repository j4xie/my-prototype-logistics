"""ComputeBackend interface — wraps the in-memory table abstraction.

Templates operate on a ComputeBackend instance, not raw pandas/polars.
This lets us swap to DuckDB/Parquet for 10M+ row uploads without
rewriting template code.
"""
from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any, Dict, List


class ComputeBackend(ABC):
    """Abstract compute backend — in-memory OLAP over one upload's rows."""

    @abstractmethod
    def row_count(self) -> int: ...

    @abstractmethod
    def columns(self) -> List[str]: ...

    @abstractmethod
    def dtype(self, column: str) -> str:
        """Returns normalized dtype name: int|float|string|datetime|bool."""

    @abstractmethod
    def group_sum(self, group_col: str, measure: str) -> List[Dict[str, Any]]:
        """Returns [{label, total}, ...] sorted by total DESC."""

    @abstractmethod
    def top_n(self, group_col: str, measure: str, n: int) -> List[Dict[str, Any]]:
        """Top N rows from group_sum."""

    @abstractmethod
    def time_series(self, time_col: str, measure: str, freq: str) -> List[Dict[str, Any]]:
        """Returns [{period, total}, ...] resampled by freq ('D'|'W'|'M')."""

    @abstractmethod
    def percentile(self, measure: str, percentiles: List[float]) -> Dict[float, float]:
        """Returns {p: value, ...} for given percentiles (0-1 range)."""

    @abstractmethod
    def mean_std(self, measure: str) -> Dict[str, float]:
        """Returns {mean, std, min, max}."""

    @abstractmethod
    def outliers(self, measure: str, sigma: float = 2.0) -> List[Dict[str, Any]]:
        """Returns rows where |(value - mean)| > sigma * std."""
