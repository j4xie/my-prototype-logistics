from __future__ import annotations
"""
Cross Analyzer Service

Provides cross-dimensional analysis capabilities:
- Drill-down analysis
- Roll-up aggregation
- Matrix/pivot analysis
- Slice and dice operations

Part of SmartBI Phase 5: Cross-Analysis and Advanced Charts.
"""
import logging
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Tuple, Union

import pandas as pd
import numpy as np

logger = logging.getLogger(__name__)


@dataclass
class DrillDownResult:
    """Result of drill-down operation"""
    success: bool
    error: Optional[str] = None

    parent_dimension: str = ""
    parent_value: Any = None
    child_dimension: str = ""

    data: List[Dict[str, Any]] = field(default_factory=list)
    summary: Dict[str, Any] = field(default_factory=dict)
    chart_config: Optional[Dict[str, Any]] = None

    # Hierarchy info
    current_level: int = 0
    max_level: int = 1
    breadcrumb: List[Dict[str, Any]] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "success": self.success,
            "error": self.error,
            "drill_path": {
                "parent_dimension": self.parent_dimension,
                "parent_value": self.parent_value,
                "child_dimension": self.child_dimension
            },
            "data": self.data,
            "summary": self.summary,
            "chart_config": self.chart_config,
            "hierarchy": {
                "current_level": self.current_level,
                "max_level": self.max_level,
                "breadcrumb": self.breadcrumb
            }
        }


@dataclass
class RollUpResult:
    """Result of roll-up operation"""
    success: bool
    error: Optional[str] = None

    source_dimension: str = ""
    target_dimension: str = ""
    aggregation_method: str = "sum"

    data: List[Dict[str, Any]] = field(default_factory=list)
    summary: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "success": self.success,
            "error": self.error,
            "roll_up_path": {
                "source_dimension": self.source_dimension,
                "target_dimension": self.target_dimension,
                "aggregation_method": self.aggregation_method
            },
            "data": self.data,
            "summary": self.summary
        }


@dataclass
class CrossAnalysisResult:
    """Result of cross-dimensional analysis"""
    success: bool
    error: Optional[str] = None

    row_dimension: str = ""
    col_dimension: str = ""
    measure: str = ""
    aggregation: str = "sum"

    matrix: List[List[Any]] = field(default_factory=list)
    row_labels: List[str] = field(default_factory=list)
    col_labels: List[str] = field(default_factory=list)

    row_totals: List[float] = field(default_factory=list)
    col_totals: List[float] = field(default_factory=list)
    grand_total: float = 0.0

    chart_config: Optional[Dict[str, Any]] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "success": self.success,
            "error": self.error,
            "dimensions": {
                "row": self.row_dimension,
                "column": self.col_dimension,
                "measure": self.measure,
                "aggregation": self.aggregation
            },
            "matrix": self.matrix,
            "labels": {
                "rows": self.row_labels,
                "columns": self.col_labels
            },
            "totals": {
                "row_totals": self.row_totals,
                "col_totals": self.col_totals,
                "grand_total": self.grand_total
            },
            "chart_config": self.chart_config
        }


class DimensionHierarchy:
    """Defines dimension hierarchies for drill-down/roll-up"""

    # Common hierarchies
    HIERARCHIES = {
        "time": {
            "levels": ["year", "quarter", "month", "week", "day"],
            "mappings": {
                "year": {"format": "%Y"},
                "quarter": {"format": "Q%q %Y"},
                "month": {"format": "%Y-%m"},
                "week": {"format": "%Y-W%W"},
                "day": {"format": "%Y-%m-%d"}
            }
        },
        "geography": {
            "levels": ["country", "region", "province", "city", "district"],
            "mappings": {
                "country": {"column": "country"},
                "region": {"column": "region"},
                "province": {"column": "province"},
                "city": {"column": "city"},
                "district": {"column": "district"}
            }
        },
        "organization": {
            "levels": ["company", "division", "department", "team"],
            "mappings": {}
        },
        "product": {
            "levels": ["category", "subcategory", "product", "sku"],
            "mappings": {}
        }
    }

    @classmethod
    def get_child_level(cls, hierarchy: str, current_level: str) -> Optional[str]:
        """Get the next level down in a hierarchy"""
        if hierarchy not in cls.HIERARCHIES:
            return None

        levels = cls.HIERARCHIES[hierarchy]["levels"]
        try:
            idx = levels.index(current_level)
            if idx < len(levels) - 1:
                return levels[idx + 1]
        except ValueError:
            pass
        return None

    @classmethod
    def get_parent_level(cls, hierarchy: str, current_level: str) -> Optional[str]:
        """Get the next level up in a hierarchy"""
        if hierarchy not in cls.HIERARCHIES:
            return None

        levels = cls.HIERARCHIES[hierarchy]["levels"]
        try:
            idx = levels.index(current_level)
            if idx > 0:
                return levels[idx - 1]
        except ValueError:
            pass
        return None


class CrossAnalyzer:
    """
    Multi-dimensional cross-analysis engine.

    Supports:
    - Drill-down: Navigate from summary to detail
    - Roll-up: Aggregate from detail to summary
    - Cross-tabulation: Create pivot-style matrices
    - Slice/Dice: Filter and subset data
    """

    def __init__(self):
        self.hierarchies = DimensionHierarchy()

    async def drill_down(
        self,
        df: pd.DataFrame,
        parent_dimension: str,
        parent_value: Any,
        child_dimension: str,
        measures: List[str],
        aggregation: str = "sum",
        filters: Optional[Dict[str, Any]] = None
    ) -> DrillDownResult:
        """
        Drill down from a parent dimension value to child dimension.

        Args:
            df: Source DataFrame
            parent_dimension: Column to filter on (e.g., "region")
            parent_value: Value to filter (e.g., "华东区")
            child_dimension: Column to break down by (e.g., "city")
            measures: Columns to aggregate (e.g., ["revenue", "profit"])
            aggregation: Aggregation method (sum, mean, count)
            filters: Additional filters to apply

        Returns:
            DrillDownResult with child-level data
        """
        result = DrillDownResult(
            success=False,
            parent_dimension=parent_dimension,
            parent_value=parent_value,
            child_dimension=child_dimension
        )

        try:
            # Validate columns exist
            required_cols = [parent_dimension, child_dimension] + measures
            missing = [c for c in required_cols if c not in df.columns]
            if missing:
                result.error = f"Missing columns: {missing}"
                return result

            # Filter to parent value
            filtered = df[df[parent_dimension] == parent_value].copy()

            # Apply additional filters
            if filters:
                for col, val in filters.items():
                    if col in filtered.columns:
                        filtered = filtered[filtered[col] == val]

            if filtered.empty:
                result.error = f"No data found for {parent_dimension}={parent_value}"
                return result

            # Aggregate by child dimension
            agg_funcs = {m: aggregation for m in measures}
            grouped = filtered.groupby(child_dimension).agg(agg_funcs).reset_index()

            # Sort by first measure descending
            if measures:
                grouped = grouped.sort_values(measures[0], ascending=False)

            # Convert to records
            result.data = grouped.to_dict(orient="records")

            # Calculate summary
            result.summary = {
                "total_records": len(filtered),
                "unique_children": len(grouped),
                "measure_totals": {m: grouped[m].sum() for m in measures}
            }

            # Generate chart config
            result.chart_config = self._generate_drill_chart_config(
                child_dimension, measures, grouped
            )

            # Build breadcrumb
            result.breadcrumb = [
                {"dimension": parent_dimension, "value": parent_value}
            ]

            result.success = True
            return result

        except Exception as e:
            logger.error(f"Drill-down failed: {e}", exc_info=True)
            result.error = str(e)
            return result

    async def roll_up(
        self,
        df: pd.DataFrame,
        source_dimension: str,
        target_dimension: str,
        measures: List[str],
        aggregation: str = "sum",
        dimension_mapping: Optional[Dict[str, str]] = None
    ) -> RollUpResult:
        """
        Roll up from detail dimension to summary dimension.

        Args:
            df: Source DataFrame
            source_dimension: Detail column (e.g., "city")
            target_dimension: Summary column (e.g., "region")
            measures: Columns to aggregate
            aggregation: Aggregation method
            dimension_mapping: Optional mapping of source to target values

        Returns:
            RollUpResult with aggregated data
        """
        result = RollUpResult(
            success=False,
            source_dimension=source_dimension,
            target_dimension=target_dimension,
            aggregation_method=aggregation
        )

        try:
            # Check if target dimension exists
            if target_dimension not in df.columns:
                # Try to derive from mapping
                if dimension_mapping:
                    df = df.copy()
                    df[target_dimension] = df[source_dimension].map(dimension_mapping)
                else:
                    result.error = f"Target dimension '{target_dimension}' not found"
                    return result

            # Aggregate by target dimension
            agg_funcs = {m: aggregation for m in measures if m in df.columns}

            if not agg_funcs:
                result.error = f"No valid measures found"
                return result

            grouped = df.groupby(target_dimension).agg(agg_funcs).reset_index()

            # Sort by first measure
            if measures:
                valid_measure = next((m for m in measures if m in grouped.columns), None)
                if valid_measure:
                    grouped = grouped.sort_values(valid_measure, ascending=False)

            result.data = grouped.to_dict(orient="records")

            # Summary stats
            result.summary = {
                "source_count": df[source_dimension].nunique(),
                "target_count": len(grouped),
                "compression_ratio": df[source_dimension].nunique() / len(grouped) if len(grouped) > 0 else 0
            }

            result.success = True
            return result

        except Exception as e:
            logger.error(f"Roll-up failed: {e}", exc_info=True)
            result.error = str(e)
            return result

    async def cross_analyze(
        self,
        df: pd.DataFrame,
        row_dimension: str,
        col_dimension: str,
        measure: str,
        aggregation: str = "sum",
        include_totals: bool = True,
        filters: Optional[Dict[str, Any]] = None
    ) -> CrossAnalysisResult:
        """
        Create cross-tabulation (pivot) analysis.

        Args:
            df: Source DataFrame
            row_dimension: Column for row labels (e.g., "product_category")
            col_dimension: Column for column labels (e.g., "region")
            measure: Column to aggregate (e.g., "revenue")
            aggregation: Aggregation method
            include_totals: Include row/column totals
            filters: Additional filters

        Returns:
            CrossAnalysisResult with matrix data
        """
        result = CrossAnalysisResult(
            success=False,
            row_dimension=row_dimension,
            col_dimension=col_dimension,
            measure=measure,
            aggregation=aggregation
        )

        try:
            # Validate columns
            required = [row_dimension, col_dimension, measure]
            missing = [c for c in required if c not in df.columns]
            if missing:
                result.error = f"Missing columns: {missing}"
                return result

            # Apply filters
            filtered = df.copy()
            if filters:
                for col, val in filters.items():
                    if col in filtered.columns:
                        if isinstance(val, list):
                            filtered = filtered[filtered[col].isin(val)]
                        else:
                            filtered = filtered[filtered[col] == val]

            # Create pivot table
            agg_func = aggregation if aggregation in ['sum', 'mean', 'count', 'min', 'max'] else 'sum'
            pivot = pd.pivot_table(
                filtered,
                values=measure,
                index=row_dimension,
                columns=col_dimension,
                aggfunc=agg_func,
                fill_value=0
            )

            # Extract labels
            result.row_labels = pivot.index.tolist()
            result.col_labels = pivot.columns.tolist()

            # Convert to matrix
            result.matrix = pivot.values.tolist()

            # Calculate totals
            if include_totals:
                result.row_totals = pivot.sum(axis=1).tolist()
                result.col_totals = pivot.sum(axis=0).tolist()
                result.grand_total = pivot.values.sum()

            # Generate chart config (heatmap)
            result.chart_config = self._generate_matrix_chart_config(
                row_dimension, col_dimension, measure, pivot
            )

            result.success = True
            return result

        except Exception as e:
            logger.error(f"Cross-analysis failed: {e}", exc_info=True)
            result.error = str(e)
            return result

    async def slice(
        self,
        df: pd.DataFrame,
        dimension: str,
        value: Any,
        measures: List[str]
    ) -> Dict[str, Any]:
        """
        Slice data on a single dimension value.

        Args:
            df: Source DataFrame
            dimension: Column to filter on
            value: Value to filter
            measures: Columns to include in result

        Returns:
            Sliced data
        """
        try:
            if dimension not in df.columns:
                return {"success": False, "error": f"Dimension '{dimension}' not found"}

            sliced = df[df[dimension] == value]

            # Get relevant columns
            cols = [c for c in measures if c in df.columns]
            if cols:
                sliced = sliced[cols + [dimension]]

            return {
                "success": True,
                "dimension": dimension,
                "value": value,
                "data": sliced.to_dict(orient="records"),
                "count": len(sliced)
            }

        except Exception as e:
            return {"success": False, "error": str(e)}

    async def dice(
        self,
        df: pd.DataFrame,
        filters: Dict[str, Union[Any, List[Any]]],
        measures: List[str]
    ) -> Dict[str, Any]:
        """
        Dice data on multiple dimensions.

        Args:
            df: Source DataFrame
            filters: Dict of {dimension: value or [values]}
            measures: Columns to include

        Returns:
            Diced data
        """
        try:
            result = df.copy()

            for dim, vals in filters.items():
                if dim not in result.columns:
                    continue

                if isinstance(vals, list):
                    result = result[result[dim].isin(vals)]
                else:
                    result = result[result[dim] == vals]

            # Get relevant columns
            all_cols = list(filters.keys()) + [c for c in measures if c in result.columns]
            all_cols = list(dict.fromkeys(all_cols))  # Remove duplicates, preserve order
            result = result[[c for c in all_cols if c in result.columns]]

            return {
                "success": True,
                "filters": filters,
                "data": result.to_dict(orient="records"),
                "count": len(result)
            }

        except Exception as e:
            return {"success": False, "error": str(e)}

    def _generate_drill_chart_config(
        self,
        dimension: str,
        measures: List[str],
        data: pd.DataFrame
    ) -> Dict[str, Any]:
        """Generate chart configuration for drill-down result"""

        if len(data) > 10:
            chart_type = "bar_horizontal"
        else:
            chart_type = "bar"

        # Determine if we should use multiple series
        if len(measures) == 1:
            series = [{
                "name": measures[0],
                "data": data[measures[0]].tolist()
            }]
        else:
            series = [
                {"name": m, "data": data[m].tolist()}
                for m in measures if m in data.columns
            ]

        return {
            "type": chart_type,
            "title": f"按{dimension}分析",
            "xAxis": {
                "type": "category",
                "data": data[dimension].tolist()
            },
            "yAxis": {
                "type": "value"
            },
            "series": series
        }

    def _generate_matrix_chart_config(
        self,
        row_dim: str,
        col_dim: str,
        measure: str,
        pivot: pd.DataFrame
    ) -> Dict[str, Any]:
        """Generate chart configuration for cross-analysis (heatmap)"""

        # Prepare data for heatmap
        heatmap_data = []
        for i, row in enumerate(pivot.index):
            for j, col in enumerate(pivot.columns):
                heatmap_data.append([j, i, pivot.loc[row, col]])

        # Calculate min/max for color scale
        values = pivot.values.flatten()
        min_val = float(values.min())
        max_val = float(values.max())

        return {
            "type": "heatmap",
            "title": f"{row_dim} × {col_dim} - {measure}",
            "xAxis": {
                "type": "category",
                "data": pivot.columns.tolist(),
                "name": col_dim
            },
            "yAxis": {
                "type": "category",
                "data": pivot.index.tolist(),
                "name": row_dim
            },
            "visualMap": {
                "min": min_val,
                "max": max_val,
                "calculable": True
            },
            "series": [{
                "name": measure,
                "type": "heatmap",
                "data": heatmap_data
            }]
        }


# Convenience functions for common operations
async def drill_down_by_time(
    df: pd.DataFrame,
    date_column: str,
    from_level: str,
    to_level: str,
    measures: List[str],
    filter_value: Optional[str] = None
) -> DrillDownResult:
    """
    Drill down on time dimension.

    Args:
        df: Source DataFrame with date column
        date_column: Name of date column
        from_level: Source time level (year, quarter, month)
        to_level: Target time level
        measures: Columns to aggregate
        filter_value: Optional filter value for source level

    Returns:
        DrillDownResult
    """
    analyzer = CrossAnalyzer()

    # Ensure date column is datetime
    df = df.copy()
    df[date_column] = pd.to_datetime(df[date_column])

    # Create derived columns based on levels
    if from_level == "year":
        df["_year"] = df[date_column].dt.year
    if to_level == "quarter":
        df["_quarter"] = df[date_column].dt.to_period("Q").astype(str)
    elif to_level == "month":
        df["_month"] = df[date_column].dt.to_period("M").astype(str)

    parent_col = f"_{from_level}"
    child_col = f"_{to_level}"

    return await analyzer.drill_down(
        df,
        parent_dimension=parent_col,
        parent_value=filter_value,
        child_dimension=child_col,
        measures=measures
    )


async def compare_dimensions(
    df: pd.DataFrame,
    dimension1: str,
    dimension2: str,
    measure: str,
    top_n: int = 10
) -> Dict[str, Any]:
    """
    Compare two dimensions across a measure.

    Returns top N combinations.
    """
    analyzer = CrossAnalyzer()

    result = await analyzer.cross_analyze(
        df,
        row_dimension=dimension1,
        col_dimension=dimension2,
        measure=measure,
        include_totals=True
    )

    if not result.success:
        return {"success": False, "error": result.error}

    # Find top combinations
    combinations = []
    for i, row_label in enumerate(result.row_labels):
        for j, col_label in enumerate(result.col_labels):
            value = result.matrix[i][j]
            combinations.append({
                dimension1: row_label,
                dimension2: col_label,
                measure: value
            })

    # Sort and get top N
    combinations.sort(key=lambda x: x[measure], reverse=True)
    top_combinations = combinations[:top_n]

    return {
        "success": True,
        "top_combinations": top_combinations,
        "matrix_result": result.to_dict()
    }
