"""
Unit tests for smartbi/services/charts/registry.py

Validates that all expected chart types are registered,
strategy lookup works correctly, and unknown types raise ValueError.
"""
import pytest

# Importing the package triggers all @register_chart decorators
from smartbi.services.charts import CHART_REGISTRY, get_strategy
from smartbi.services.charts.registry import list_registered
from smartbi.services.charts.base import BaseChartStrategy, ChartType


# ── All chart types registered ───────────────────────────────────


class TestChartRegistration:

    # Every ChartType enum value should have a corresponding registered strategy.
    EXPECTED_CHART_TYPES = {ct.value for ct in ChartType}

    def test_all_chart_type_enum_values_are_registered(self):
        """Every ChartType enum member should have a strategy in the registry."""
        registered = set(CHART_REGISTRY.keys())
        missing = self.EXPECTED_CHART_TYPES - registered
        assert not missing, (
            f"ChartType enum values missing from registry: {missing}. "
            f"Registered: {sorted(registered)}"
        )

    def test_registry_count_matches_enum(self):
        """Registry should have at least as many entries as ChartType enum."""
        assert len(CHART_REGISTRY) >= len(ChartType), (
            f"Registry has {len(CHART_REGISTRY)} types but ChartType enum has {len(ChartType)}"
        )

    def test_all_registered_types_are_strings(self):
        for key in CHART_REGISTRY:
            assert isinstance(key, str), f"Registry key {key!r} is not a string"

    def test_all_registered_strategies_subclass_base(self):
        """Every registered strategy class should be a BaseChartStrategy subclass."""
        for chart_type, strategy_cls in CHART_REGISTRY.items():
            assert issubclass(strategy_cls, BaseChartStrategy), (
                f"Strategy for '{chart_type}' ({strategy_cls.__name__}) "
                f"does not subclass BaseChartStrategy"
            )


# ── get_strategy lookup ──────────────────────────────────────────


class TestGetStrategy:

    @pytest.mark.parametrize("chart_type", [ct.value for ct in ChartType])
    def test_get_strategy_returns_correct_instance(self, chart_type: str):
        """get_strategy should return an instance of BaseChartStrategy for every known type."""
        strategy = get_strategy(chart_type)
        assert isinstance(strategy, BaseChartStrategy), (
            f"get_strategy('{chart_type}') returned {type(strategy).__name__}, "
            f"expected BaseChartStrategy subclass"
        )

    def test_get_strategy_returns_new_instance_each_call(self):
        """get_strategy instantiates a fresh strategy on each call (not singleton)."""
        s1 = get_strategy("bar")
        s2 = get_strategy("bar")
        assert s1 is not s2

    def test_unknown_chart_type_raises_value_error(self):
        with pytest.raises(ValueError, match="Unknown chart type"):
            get_strategy("nonexistent_chart_xyz")

    def test_empty_string_raises_value_error(self):
        with pytest.raises(ValueError):
            get_strategy("")

    def test_case_sensitive_lookup(self):
        """Registry keys are lowercase; uppercase should fail."""
        with pytest.raises(ValueError):
            get_strategy("BAR")


# ── list_registered ──────────────────────────────────────────────


class TestListRegistered:

    def test_returns_sorted_list(self):
        result = list_registered()
        assert result == sorted(result)

    def test_contains_core_chart_types(self):
        result = list_registered()
        for core_type in ["bar", "line", "pie", "scatter", "area"]:
            assert core_type in result, f"Core chart type '{core_type}' not in list_registered()"

    def test_returns_list_of_strings(self):
        result = list_registered()
        assert isinstance(result, list)
        assert all(isinstance(t, str) for t in result)


# ── Specific chart type spot checks ─────────────────────────────


class TestSpecificChartTypes:
    """Spot-check that key chart categories are all registered."""

    def test_basic_charts(self):
        for ct in ["line", "bar", "pie", "area", "scatter"]:
            assert ct in CHART_REGISTRY, f"Basic chart '{ct}' not registered"

    def test_financial_charts(self):
        for ct in ["waterfall", "sankey", "bullet", "dual_axis", "budget_comparison"]:
            assert ct in CHART_REGISTRY, f"Financial chart '{ct}' not registered"

    def test_statistical_charts(self):
        for ct in ["boxplot", "parallel", "correlation_matrix", "heatmap", "matrix_heatmap"]:
            assert ct in CHART_REGISTRY, f"Statistical chart '{ct}' not registered"

    def test_specialized_charts(self):
        for ct in ["sunburst", "treemap", "pareto", "gantt", "wordcloud",
                    "slope", "funnel", "gauge", "radar", "combination"]:
            assert ct in CHART_REGISTRY, f"Specialized chart '{ct}' not registered"

    def test_donut_variants(self):
        for ct in ["donut", "nested_donut"]:
            assert ct in CHART_REGISTRY, f"Donut variant '{ct}' not registered"

    def test_bar_horizontal(self):
        assert "bar_horizontal" in CHART_REGISTRY
