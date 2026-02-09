from __future__ import annotations
"""
Chart Builder Service

Builds ECharts configuration from data and chart specifications.
"""
import logging
from typing import Any, Optional, List, Dict, Tuple
from enum import Enum

import pandas as pd
import numpy as np

logger = logging.getLogger(__name__)


class ChartType(str, Enum):
    """Supported chart types"""
    # Basic charts
    LINE = "line"
    BAR = "bar"
    PIE = "pie"
    AREA = "area"
    SCATTER = "scatter"
    HEATMAP = "heatmap"
    WATERFALL = "waterfall"
    RADAR = "radar"
    FUNNEL = "funnel"
    GAUGE = "gauge"
    TREEMAP = "treemap"
    SANKEY = "sankey"
    COMBINATION = "combination"

    # Advanced charts (Phase 5)
    SUNBURST = "sunburst"           # Hierarchical data (旭日图)
    PARETO = "pareto"               # 80/20 analysis (帕累托图)
    BULLET = "bullet"               # Target vs actual (子弹图)
    DUAL_AXIS = "dual_axis"         # Two Y-axes (双Y轴图)
    MATRIX_HEATMAP = "matrix_heatmap"  # Cross-tabulation heatmap
    BAR_HORIZONTAL = "bar_horizontal"  # Horizontal bar chart
    SLOPE = "slope"                 # Slope chart for comparison
    DONUT = "donut"                 # Donut chart (环形图)
    NESTED_DONUT = "nested_donut"   # Nested donut chart (嵌套环形图)


class ChartBuilder:
    """ECharts configuration builder"""

    # Color palettes
    DEFAULT_COLORS = [
        "#5470c6", "#91cc75", "#fac858", "#ee6666", "#73c0de",
        "#3ba272", "#fc8452", "#9a60b4", "#ea7ccc", "#48b8d0"
    ]

    GRADIENT_COLORS = [
        {"start": "#667eea", "end": "#764ba2"},
        {"start": "#f093fb", "end": "#f5576c"},
        {"start": "#4facfe", "end": "#00f2fe"},
        {"start": "#43e97b", "end": "#38f9d7"},
        {"start": "#fa709a", "end": "#fee140"}
    ]

    def __init__(self):
        pass

    def _validate_and_resolve_field(
        self,
        field: Optional[str],
        df: pd.DataFrame,
        field_type: str = "field"
    ) -> Optional[str]:
        """
        Validate that a field exists in the DataFrame.
        If not found, try fuzzy matching (case-insensitive, partial match).

        Args:
            field: Field name to validate
            df: DataFrame with actual columns
            field_type: Type of field for logging (x_axis, y_axis, etc.)

        Returns:
            Valid field name or None if not found
        """
        if field is None:
            return None

        actual_columns = set(df.columns)

        # 1. Exact match
        if field in actual_columns:
            return field

        # 2. Case-insensitive match
        field_lower = field.lower()
        for col in actual_columns:
            if col.lower() == field_lower:
                logger.debug(f"Resolved {field_type} '{field}' -> '{col}' (case-insensitive)")
                return col

        # 3. Partial match (field contained in column name or vice versa)
        for col in actual_columns:
            if field_lower in col.lower() or col.lower() in field_lower:
                logger.debug(f"Resolved {field_type} '{field}' -> '{col}' (partial match)")
                return col

        # 4. Not found
        logger.warning(
            f"{field_type} '{field}' not found in columns. "
            f"Available: {list(actual_columns)[:5]}..."
        )
        return None

    def _ensure_numeric_field(
        self,
        df: pd.DataFrame,
        field: Optional[str],
        fallback_to_first: bool = True
    ) -> Optional[str]:
        """
        确保字段是数值类型，如果不是则尝试找到合适的数值字段。

        Args:
            df: DataFrame
            field: 候选字段名
            fallback_to_first: 如果字段不是数值类型，是否回退到第一个数值字段

        Returns:
            有效的数值字段名，或 None
        """
        numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()

        if not numeric_cols:
            logger.warning("No numeric columns found in DataFrame")
            return None

        # 如果指定的字段是数值类型，直接返回
        if field and field in numeric_cols:
            return field

        # 如果字段存在但不是数值类型
        if field and field in df.columns:
            logger.warning(
                f"Field '{field}' is not numeric (type={df[field].dtype}), "
                f"falling back to numeric field"
            )

        # 回退到第一个数值字段
        if fallback_to_first and numeric_cols:
            fallback_field = numeric_cols[0]
            logger.debug(f"Using fallback numeric field: {fallback_field}")
            return fallback_field

        return None

    def _get_valid_numeric_fields(
        self,
        df: pd.DataFrame,
        y_fields: Optional[List[str]]
    ) -> List[str]:
        """
        从 y_fields 中筛选出有效的数值字段。

        Args:
            df: DataFrame
            y_fields: 候选 Y 轴字段列表

        Returns:
            有效的数值字段列表
        """
        numeric_cols = set(df.select_dtypes(include=[np.number]).columns.tolist())

        if not y_fields:
            return list(numeric_cols)[:3]  # 默认返回前3个数值字段

        valid_fields = []
        for field in y_fields:
            if field in numeric_cols:
                valid_fields.append(field)
            else:
                logger.warning(f"Y-axis field '{field}' is not numeric, skipping")

        # 如果所有字段都无效，回退到数值字段
        if not valid_fields and numeric_cols:
            valid_fields = list(numeric_cols)[:3]
            logger.debug(f"All y_fields invalid, using fallback: {valid_fields}")

        return valid_fields

    def _validate_fields(
        self,
        df: pd.DataFrame,
        x_field: Optional[str],
        y_fields: Optional[List[str]],
        series_field: Optional[str] = None
    ) -> Tuple[Optional[str], Optional[List[str]], Optional[str]]:
        """
        Validate and resolve all fields for chart building.

        Returns:
            Tuple of (resolved_x_field, resolved_y_fields, resolved_series_field)
        """
        # Resolve x_field
        resolved_x = self._validate_and_resolve_field(x_field, df, "x_axis")

        # Resolve y_fields
        resolved_y = None
        if y_fields:
            resolved_y = []
            for y_field in y_fields:
                resolved = self._validate_and_resolve_field(y_field, df, "y_axis")
                if resolved:
                    resolved_y.append(resolved)

            if not resolved_y:
                resolved_y = None

        # Resolve series_field
        resolved_series = self._validate_and_resolve_field(series_field, df, "series")

        return resolved_x, resolved_y, resolved_series

    def _get_fallback_fields(
        self,
        df: pd.DataFrame,
        chart_type: str
    ) -> Tuple[Optional[str], Optional[List[str]]]:
        """
        Get fallback x_field and y_fields from DataFrame columns.

        Returns:
            Tuple of (x_field, y_fields) based on data types
        """
        numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()
        non_numeric_cols = df.select_dtypes(exclude=[np.number]).columns.tolist()

        x_field = None
        y_fields = None

        # For most charts: first non-numeric as x, first numeric as y
        if non_numeric_cols:
            x_field = non_numeric_cols[0]
        elif len(df.columns) > 0:
            x_field = df.columns[0]

        if numeric_cols:
            y_fields = numeric_cols[:3]  # Limit to 3 y fields

        return x_field, y_fields

    def build(
        self,
        chart_type: str,
        data: List[dict],
        x_field: Optional[str] = None,
        y_fields: Optional[List[str]] = None,
        series_field: Optional[str] = None,
        title: Optional[str] = None,
        subtitle: Optional[str] = None,
        theme: str = "default",
        options: Optional[dict] = None
    ) -> Dict[str, Any]:
        """
        Build ECharts configuration

        Args:
            chart_type: Type of chart to build
            data: Data records
            x_field: X-axis field name
            y_fields: Y-axis field names
            series_field: Field for series grouping
            title: Chart title
            subtitle: Chart subtitle
            theme: Color theme
            options: Additional ECharts options

        Returns:
            ECharts configuration object
        """
        try:
            df = pd.DataFrame(data)

            if df.empty:
                return self._empty_chart_config(title)

            chart_type_enum = ChartType(chart_type.lower())

            # Validate and resolve field names
            x_field, y_fields, series_field = self._validate_fields(
                df, x_field, y_fields, series_field
            )

            # If no valid fields found, use fallback
            if x_field is None and y_fields is None:
                x_field, y_fields = self._get_fallback_fields(df, chart_type)
                logger.debug(f"Using fallback fields: x={x_field}, y={y_fields}")

            # Build chart based on type
            if chart_type_enum == ChartType.LINE:
                config = self._build_line_chart(df, x_field, y_fields, series_field)
            elif chart_type_enum == ChartType.BAR:
                config = self._build_bar_chart(df, x_field, y_fields, series_field)
            elif chart_type_enum == ChartType.PIE:
                config = self._build_pie_chart(df, x_field, y_fields)
            elif chart_type_enum == ChartType.AREA:
                config = self._build_area_chart(df, x_field, y_fields, series_field)
            elif chart_type_enum == ChartType.SCATTER:
                config = self._build_scatter_chart(df, x_field, y_fields, series_field)
            elif chart_type_enum == ChartType.WATERFALL:
                config = self._build_waterfall_chart(df, x_field, y_fields)
            elif chart_type_enum == ChartType.RADAR:
                config = self._build_radar_chart(df, x_field, y_fields)
            elif chart_type_enum == ChartType.FUNNEL:
                config = self._build_funnel_chart(df, x_field, y_fields)
            elif chart_type_enum == ChartType.GAUGE:
                config = self._build_gauge_chart(df, y_fields)
            elif chart_type_enum == ChartType.HEATMAP:
                config = self._build_heatmap_chart(df, x_field, y_fields, series_field)
            elif chart_type_enum == ChartType.COMBINATION:
                config = self._build_combination_chart(df, x_field, y_fields, series_field, options)
            elif chart_type_enum == ChartType.SUNBURST:
                config = self._build_sunburst_chart(df, x_field, y_fields, options)
            elif chart_type_enum == ChartType.PARETO:
                config = self._build_pareto_chart(df, x_field, y_fields)
            elif chart_type_enum == ChartType.BULLET:
                config = self._build_bullet_chart(df, x_field, y_fields, options)
            elif chart_type_enum == ChartType.DUAL_AXIS:
                config = self._build_dual_axis_chart(df, x_field, y_fields)
            elif chart_type_enum == ChartType.BAR_HORIZONTAL:
                config = self._build_horizontal_bar_chart(df, x_field, y_fields, series_field)
            elif chart_type_enum == ChartType.DONUT:
                config = self._build_donut_chart(df, x_field, y_fields)
            elif chart_type_enum == ChartType.NESTED_DONUT:
                config = self._build_nested_donut_chart(df, x_field, y_fields, series_field)
            else:
                config = self._build_line_chart(df, x_field, y_fields, series_field)

            # Add common options
            config = self._add_common_options(config, title, subtitle, theme, options)

            return {
                "success": True,
                "chartType": chart_type,
                "config": config
            }

        except Exception as e:
            logger.error(f"Chart build failed: {e}", exc_info=True)
            return {
                "success": False,
                "error": str(e),
                "config": self._empty_chart_config(title)
            }

    def _build_line_chart(
        self,
        df: pd.DataFrame,
        x_field: Optional[str],
        y_fields: Optional[List[str]],
        series_field: Optional[str]
    ) -> dict:
        """Build line chart configuration"""
        x_data = df[x_field].tolist() if x_field else df.index.tolist()

        series = []
        if series_field and series_field in df.columns:
            # Multiple series from grouping
            for i, (name, group) in enumerate(df.groupby(series_field)):
                for y_field in (y_fields or []):
                    if y_field in group.columns:
                        series.append({
                            "name": f"{name}",
                            "type": "line",
                            "data": group[y_field].tolist(),
                            "smooth": True,
                            "emphasis": {"focus": "series"}
                        })
        else:
            # Single or multiple y fields
            for y_field in (y_fields or []):
                if y_field in df.columns:
                    series.append({
                        "name": y_field,
                        "type": "line",
                        "data": df[y_field].tolist(),
                        "smooth": True,
                        "emphasis": {"focus": "series"}
                    })

        return {
            "xAxis": {
                "type": "category",
                "data": x_data,
                "boundaryGap": False
            },
            "yAxis": {
                "type": "value"
            },
            "series": series,
            "tooltip": {
                "trigger": "axis"
            },
            "legend": {
                "data": [s["name"] for s in series]
            }
        }

    def _build_bar_chart(
        self,
        df: pd.DataFrame,
        x_field: Optional[str],
        y_fields: Optional[List[str]],
        series_field: Optional[str]
    ) -> dict:
        """Build bar chart configuration"""
        x_data = df[x_field].tolist() if x_field else df.index.tolist()

        series = []
        if series_field and series_field in df.columns:
            for name, group in df.groupby(series_field):
                for y_field in (y_fields or []):
                    if y_field in group.columns:
                        series.append({
                            "name": str(name),
                            "type": "bar",
                            "data": group[y_field].tolist(),
                            "emphasis": {"focus": "series"}
                        })
        else:
            for y_field in (y_fields or []):
                if y_field in df.columns:
                    series.append({
                        "name": y_field,
                        "type": "bar",
                        "data": df[y_field].tolist(),
                        "emphasis": {"focus": "series"}
                    })

        return {
            "xAxis": {
                "type": "category",
                "data": x_data
            },
            "yAxis": {
                "type": "value"
            },
            "series": series,
            "tooltip": {
                "trigger": "axis",
                "axisPointer": {"type": "shadow"}
            },
            "legend": {
                "data": [s["name"] for s in series]
            }
        }

    def _build_pie_chart(
        self,
        df: pd.DataFrame,
        x_field: Optional[str],
        y_fields: Optional[List[str]]
    ) -> dict:
        """Build pie chart configuration"""
        name_field = x_field or df.columns[0]

        # 确保 value_field 是数值类型
        candidate_value = y_fields[0] if y_fields else None
        value_field = self._ensure_numeric_field(df, candidate_value, fallback_to_first=True)

        if value_field is None:
            raise ValueError("No valid numeric column found for pie chart")

        # 安全地构建数据，跳过无效值
        data = []
        for _, row in df.iterrows():
            val = pd.to_numeric(row[value_field], errors='coerce')
            if pd.notna(val) and val > 0:  # 饼图只接受正数
                data.append({"name": str(row[name_field]), "value": float(val)})

        if not data:
            raise ValueError("No valid data points for pie chart")

        return {
            "series": [{
                "name": value_field,
                "type": "pie",
                "radius": ["40%", "70%"],
                "avoidLabelOverlap": True,
                "itemStyle": {
                    "borderRadius": 10,
                    "borderColor": "#fff",
                    "borderWidth": 2
                },
                "label": {
                    "show": True,
                    "formatter": "{b}: {d}%"
                },
                "emphasis": {
                    "label": {
                        "show": True,
                        "fontSize": 16,
                        "fontWeight": "bold"
                    }
                },
                "data": data
            }],
            "tooltip": {
                "trigger": "item",
                "formatter": "{a} <br/>{b}: {c} ({d}%)"
            },
            "legend": {
                "orient": "vertical",
                "left": "left",
                "data": [d["name"] for d in data]
            }
        }

    def _build_area_chart(
        self,
        df: pd.DataFrame,
        x_field: Optional[str],
        y_fields: Optional[List[str]],
        series_field: Optional[str]
    ) -> dict:
        """Build area chart configuration"""
        config = self._build_line_chart(df, x_field, y_fields, series_field)

        # Add area style to series
        for i, s in enumerate(config["series"]):
            s["areaStyle"] = {
                "opacity": 0.3
            }
            s["stack"] = "total" if len(config["series"]) > 1 else None

        return config

    def _build_scatter_chart(
        self,
        df: pd.DataFrame,
        x_field: Optional[str],
        y_fields: Optional[List[str]],
        series_field: Optional[str]
    ) -> dict:
        """Build scatter chart configuration"""
        x_col = x_field or df.select_dtypes(include=[np.number]).columns[0]
        y_col = y_fields[0] if y_fields else df.select_dtypes(include=[np.number]).columns[1] if len(df.select_dtypes(include=[np.number]).columns) > 1 else x_col

        series = []
        if series_field and series_field in df.columns:
            for name, group in df.groupby(series_field):
                data = [[float(row[x_col]), float(row[y_col])] for _, row in group.iterrows()]
                series.append({
                    "name": str(name),
                    "type": "scatter",
                    "data": data,
                    "symbolSize": 10
                })
        else:
            data = [[float(row[x_col]), float(row[y_col])] for _, row in df.iterrows()]
            series.append({
                "name": f"{x_col} vs {y_col}",
                "type": "scatter",
                "data": data,
                "symbolSize": 10
            })

        return {
            "xAxis": {"type": "value", "name": x_col},
            "yAxis": {"type": "value", "name": y_col},
            "series": series,
            "tooltip": {
                "trigger": "item",
                "formatter": "{a}: ({c})"
            }
        }

    def _build_waterfall_chart(
        self,
        df: pd.DataFrame,
        x_field: Optional[str],
        y_fields: Optional[List[str]]
    ) -> dict:
        """Build waterfall chart configuration"""
        x_data = df[x_field].tolist() if x_field else df.index.tolist()

        # 确保 y_col 是数值类型
        candidate_y = y_fields[0] if y_fields else None
        y_col = self._ensure_numeric_field(df, candidate_y, fallback_to_first=True)

        if y_col is None:
            raise ValueError("No valid numeric column found for waterfall chart")

        # 安全地转换为数值，处理 None 和非数值
        values = pd.to_numeric(df[y_col], errors='coerce').fillna(0).tolist()

        # Calculate waterfall data
        placeholder_data = []
        positive_data = []
        negative_data = []

        cumulative = 0
        for i, val in enumerate(values):
            if i == 0:
                # First bar starts from 0
                positive_data.append(val if val > 0 else 0)
                negative_data.append(abs(val) if val < 0 else 0)
                placeholder_data.append(0)
            else:
                if val >= 0:
                    placeholder_data.append(cumulative)
                    positive_data.append(val)
                    negative_data.append(0)
                else:
                    placeholder_data.append(cumulative + val)
                    positive_data.append(0)
                    negative_data.append(abs(val))
            cumulative += val

        return {
            "xAxis": {
                "type": "category",
                "data": x_data
            },
            "yAxis": {
                "type": "value"
            },
            "series": [
                {
                    "name": "Placeholder",
                    "type": "bar",
                    "stack": "Total",
                    "itemStyle": {"color": "transparent"},
                    "data": placeholder_data
                },
                {
                    "name": "Increase",
                    "type": "bar",
                    "stack": "Total",
                    "itemStyle": {"color": "#91cc75"},
                    "data": positive_data
                },
                {
                    "name": "Decrease",
                    "type": "bar",
                    "stack": "Total",
                    "itemStyle": {"color": "#ee6666"},
                    "data": negative_data
                }
            ],
            "tooltip": {
                "trigger": "axis",
                "axisPointer": {"type": "shadow"}
            }
        }

    def _build_radar_chart(
        self,
        df: pd.DataFrame,
        x_field: Optional[str],
        y_fields: Optional[List[str]]
    ) -> dict:
        """Build radar chart configuration"""
        indicators = []
        data_values = []

        def safe_max(series):
            """Safely get max value from a series, handling non-numeric data."""
            try:
                numeric_vals = pd.to_numeric(series, errors='coerce')
                max_val = numeric_vals.max()
                return float(max_val) if pd.notna(max_val) else 100
            except Exception:
                return 100

        def safe_first(series):
            """Safely get first value from a series."""
            try:
                if len(series) > 0:
                    val = pd.to_numeric(series.iloc[0], errors='coerce')
                    return float(val) if pd.notna(val) else 0
                return 0
            except Exception:
                return 0

        # Use y_fields as indicators
        if y_fields:
            for field in y_fields:
                if field in df.columns:
                    max_val = safe_max(df[field])
                    indicators.append({"name": field, "max": max_val * 1.2})
                    data_values.append(safe_first(df[field]))
        else:
            # Use numeric columns
            for col in df.select_dtypes(include=[np.number]).columns[:6]:
                max_val = safe_max(df[col])
                indicators.append({"name": col, "max": max_val * 1.2})
                data_values.append(safe_first(df[col]))

        return {
            "radar": {
                "indicator": indicators
            },
            "series": [{
                "name": "Radar",
                "type": "radar",
                "data": [{
                    "value": data_values,
                    "name": "Value"
                }]
            }],
            "tooltip": {
                "trigger": "item"
            }
        }

    def _build_funnel_chart(
        self,
        df: pd.DataFrame,
        x_field: Optional[str],
        y_fields: Optional[List[str]]
    ) -> dict:
        """Build funnel chart configuration"""
        name_field = x_field or df.columns[0]
        value_field = y_fields[0] if y_fields else df.select_dtypes(include=[np.number]).columns[0]

        data = sorted([
            {"name": str(row[name_field]), "value": float(row[value_field])}
            for _, row in df.iterrows()
        ], key=lambda x: x["value"], reverse=True)

        return {
            "series": [{
                "name": "Funnel",
                "type": "funnel",
                "left": "10%",
                "width": "80%",
                "label": {
                    "show": True,
                    "position": "inside"
                },
                "gap": 2,
                "data": data
            }],
            "tooltip": {
                "trigger": "item",
                "formatter": "{a} <br/>{b}: {c}"
            }
        }

    def _build_gauge_chart(
        self,
        df: pd.DataFrame,
        y_fields: Optional[List[str]]
    ) -> dict:
        """Build gauge chart configuration"""
        value_field = y_fields[0] if y_fields else df.select_dtypes(include=[np.number]).columns[0]
        value = float(df[value_field].iloc[0]) if len(df) > 0 else 0

        return {
            "series": [{
                "name": value_field,
                "type": "gauge",
                "progress": {"show": True},
                "detail": {
                    "valueAnimation": True,
                    "formatter": "{value}%"
                },
                "data": [{"value": value, "name": value_field}]
            }],
            "tooltip": {
                "formatter": "{a} <br/>{b}: {c}%"
            }
        }

    def _build_heatmap_chart(
        self,
        df: pd.DataFrame,
        x_field: Optional[str],
        y_fields: Optional[List[str]],
        series_field: Optional[str]
    ) -> dict:
        """Build heatmap chart configuration"""
        x_col = x_field or df.columns[0]
        y_col = series_field or df.columns[1]

        # 确保 value_col 是数值类型
        candidate_value = y_fields[0] if y_fields else None
        value_col = self._ensure_numeric_field(df, candidate_value, fallback_to_first=True)

        if value_col is None:
            raise ValueError("No valid numeric column found for heatmap chart")

        # 过滤掉 x_col 或 y_col 中的 NaN 值
        df_clean = df.dropna(subset=[x_col, y_col])
        x_data = df_clean[x_col].unique().tolist()
        y_data = df_clean[y_col].unique().tolist()

        # 安全地转换数值
        data = []
        for _, row in df_clean.iterrows():
            try:
                x_idx = x_data.index(row[x_col])
                y_idx = y_data.index(row[y_col])
                val = pd.to_numeric(row[value_col], errors='coerce')
                if pd.notna(val):
                    data.append([x_idx, y_idx, float(val)])
            except (ValueError, KeyError):
                continue

        if not data:
            raise ValueError("No valid data points for heatmap chart")

        numeric_values = pd.to_numeric(df_clean[value_col], errors='coerce').dropna()
        max_val = numeric_values.max() if len(numeric_values) > 0 else 1
        min_val = numeric_values.min() if len(numeric_values) > 0 else 0

        return {
            "xAxis": {
                "type": "category",
                "data": x_data
            },
            "yAxis": {
                "type": "category",
                "data": y_data
            },
            "visualMap": {
                "min": float(min_val),
                "max": float(max_val),
                "calculable": True,
                "orient": "horizontal",
                "left": "center",
                "bottom": "0%"
            },
            "series": [{
                "name": value_col,
                "type": "heatmap",
                "data": data,
                "label": {"show": True}
            }],
            "tooltip": {
                "position": "top"
            }
        }

    def _build_combination_chart(
        self,
        df: pd.DataFrame,
        x_field: Optional[str],
        y_fields: Optional[List[str]],
        series_field: Optional[str],
        options: Optional[dict]
    ) -> dict:
        """Build combination chart (bar + line)"""
        x_data = df[x_field].tolist() if x_field else df.index.tolist()

        series = []
        y_axis_list = [{"type": "value", "position": "left"}]

        if y_fields and len(y_fields) >= 2:
            # First field as bar
            if y_fields[0] in df.columns:
                series.append({
                    "name": y_fields[0],
                    "type": "bar",
                    "data": df[y_fields[0]].tolist(),
                    "yAxisIndex": 0
                })

            # Second field as line with secondary axis
            if y_fields[1] in df.columns:
                y_axis_list.append({"type": "value", "position": "right"})
                series.append({
                    "name": y_fields[1],
                    "type": "line",
                    "data": df[y_fields[1]].tolist(),
                    "yAxisIndex": 1,
                    "smooth": True
                })

            # Additional fields as lines
            for y_field in y_fields[2:]:
                if y_field in df.columns:
                    series.append({
                        "name": y_field,
                        "type": "line",
                        "data": df[y_field].tolist(),
                        "yAxisIndex": 1,
                        "smooth": True
                    })

        return {
            "xAxis": {
                "type": "category",
                "data": x_data
            },
            "yAxis": y_axis_list,
            "series": series,
            "tooltip": {
                "trigger": "axis",
                "axisPointer": {"type": "cross"}
            },
            "legend": {
                "data": [s["name"] for s in series]
            }
        }

    def _add_common_options(
        self,
        config: dict,
        title: Optional[str],
        subtitle: Optional[str],
        theme: str,
        options: Optional[dict]
    ) -> dict:
        """Add common ECharts options"""
        # Add title
        if title:
            config["title"] = {
                "text": title,
                "subtext": subtitle or "",
                "left": "center"
            }

        # Add colors
        config["color"] = self.DEFAULT_COLORS

        # Add grid for proper spacing
        if "grid" not in config:
            config["grid"] = {
                "left": "3%",
                "right": "4%",
                "bottom": "3%",
                "containLabel": True
            }

        # Add toolbox
        config["toolbox"] = {
            "feature": {
                "saveAsImage": {},
                "dataZoom": {},
                "restore": {}
            }
        }

        # Merge custom options
        if options:
            for key, value in options.items():
                if isinstance(value, dict) and key in config:
                    config[key].update(value)
                else:
                    config[key] = value

        return config

    def _empty_chart_config(self, title: Optional[str] = None) -> dict:
        """Return empty chart configuration"""
        return {
            "title": {
                "text": title or "No Data",
                "subtext": "暂无数据",
                "left": "center",
                "top": "center"
            },
            "series": []
        }

    def _build_sunburst_chart(
        self,
        df: pd.DataFrame,
        x_field: Optional[str],
        y_fields: Optional[List[str]],
        options: Optional[dict]
    ) -> dict:
        """Build sunburst chart for hierarchical data"""
        # Extract hierarchy columns from options or use first 2-3 columns
        hierarchy_cols = options.get("hierarchy", []) if options else []
        if not hierarchy_cols:
            hierarchy_cols = df.columns[:2].tolist()

        value_field = y_fields[0] if y_fields else df.select_dtypes(include=[np.number]).columns[0]

        # Build hierarchical data
        def build_tree(df, level_cols, value_col):
            if not level_cols:
                return []

            current_col = level_cols[0]
            remaining_cols = level_cols[1:]

            children = []
            for name, group in df.groupby(current_col):
                node = {
                    "name": str(name),
                    "value": float(group[value_col].sum())
                }
                if remaining_cols:
                    node["children"] = build_tree(group, remaining_cols, value_col)
                children.append(node)
            return children

        data = build_tree(df, hierarchy_cols, value_field)

        return {
            "series": [{
                "type": "sunburst",
                "data": data,
                "radius": ["15%", "80%"],
                "label": {
                    "rotate": "radial"
                },
                "emphasis": {
                    "focus": "ancestor"
                }
            }],
            "tooltip": {
                "trigger": "item",
                "formatter": "{b}: {c}"
            }
        }

    def _build_pareto_chart(
        self,
        df: pd.DataFrame,
        x_field: Optional[str],
        y_fields: Optional[List[str]]
    ) -> dict:
        """Build Pareto chart (80/20 analysis)"""
        x_col = x_field or df.columns[0]

        # 确保 y_col 是数值类型
        candidate_y = y_fields[0] if y_fields else None
        y_col = self._ensure_numeric_field(df, candidate_y, fallback_to_first=True)

        if y_col is None:
            raise ValueError("No valid numeric column found for pareto chart")

        # 转换为数值并清理数据
        df_clean = df.copy()
        df_clean[y_col] = pd.to_numeric(df_clean[y_col], errors='coerce')
        df_clean = df_clean.dropna(subset=[y_col])

        if df_clean.empty:
            raise ValueError("No valid numeric data for pareto chart")

        # Sort by value descending
        sorted_df = df_clean.sort_values(y_col, ascending=False)
        x_data = sorted_df[x_col].tolist()
        y_data = sorted_df[y_col].tolist()

        # Calculate cumulative percentage
        total = sum(y_data) if y_data else 1
        cumulative = []
        cum_sum = 0
        for val in y_data:
            cum_sum += val
            cumulative.append(round(cum_sum / total * 100, 1))

        return {
            "xAxis": {
                "type": "category",
                "data": x_data
            },
            "yAxis": [
                {"type": "value", "name": y_col, "position": "left"},
                {"type": "value", "name": "累计百分比", "position": "right", "max": 100}
            ],
            "series": [
                {
                    "name": y_col,
                    "type": "bar",
                    "data": y_data,
                    "yAxisIndex": 0,
                    "itemStyle": {"color": "#5470c6"}
                },
                {
                    "name": "累计百分比",
                    "type": "line",
                    "data": cumulative,
                    "yAxisIndex": 1,
                    "smooth": True,
                    "itemStyle": {"color": "#ee6666"},
                    "markLine": {
                        "data": [{"yAxis": 80, "label": {"formatter": "80%"}}]
                    }
                }
            ],
            "tooltip": {
                "trigger": "axis",
                "axisPointer": {"type": "cross"}
            },
            "legend": {
                "data": [y_col, "累计百分比"]
            }
        }

    def _build_bullet_chart(
        self,
        df: pd.DataFrame,
        x_field: Optional[str],
        y_fields: Optional[List[str]],
        options: Optional[dict]
    ) -> dict:
        """Build bullet chart for target vs actual comparison"""
        x_col = x_field or df.columns[0]
        actual_col = y_fields[0] if y_fields else "actual"
        target_col = y_fields[1] if y_fields and len(y_fields) > 1 else "target"

        x_data = df[x_col].tolist()
        actual_data = df[actual_col].tolist() if actual_col in df.columns else [0] * len(x_data)
        target_data = df[target_col].tolist() if target_col in df.columns else [100] * len(x_data)

        # Filter None values and convert to numeric for max calculation
        actual_numeric = [v for v in actual_data if v is not None and isinstance(v, (int, float))]
        target_numeric = [v for v in target_data if v is not None and isinstance(v, (int, float))]

        # Calculate max for background ranges (with fallback)
        max_actual = max(actual_numeric) if actual_numeric else 100
        max_target = max(target_numeric) if target_numeric else 100
        max_val = max(max_actual, max_target) * 1.2

        # Replace None with 0 for display
        actual_data = [v if v is not None and isinstance(v, (int, float)) else 0 for v in actual_data]
        target_data = [v if v is not None and isinstance(v, (int, float)) else 0 for v in target_data]

        return {
            "xAxis": {
                "type": "value",
                "max": max_val
            },
            "yAxis": {
                "type": "category",
                "data": x_data
            },
            "series": [
                {
                    "name": "背景",
                    "type": "bar",
                    "data": [max_val] * len(x_data),
                    "barWidth": 30,
                    "itemStyle": {"color": "#eee"},
                    "z": 1
                },
                {
                    "name": actual_col,
                    "type": "bar",
                    "data": actual_data,
                    "barWidth": 15,
                    "itemStyle": {"color": "#5470c6"},
                    "z": 2
                },
                {
                    "name": target_col,
                    "type": "scatter",
                    "data": [[t, i] for i, t in enumerate(target_data)],
                    "symbol": "rect",
                    "symbolSize": [4, 20],
                    "itemStyle": {"color": "#ee6666"},
                    "z": 3
                }
            ],
            "tooltip": {
                "trigger": "axis",
                "axisPointer": {"type": "shadow"}
            },
            "legend": {
                "data": [actual_col, target_col]
            }
        }

    def _build_dual_axis_chart(
        self,
        df: pd.DataFrame,
        x_field: Optional[str],
        y_fields: Optional[List[str]]
    ) -> dict:
        """Build dual Y-axis chart"""
        x_data = df[x_field].tolist() if x_field else df.index.tolist()

        series = []
        y_axis_list = []

        if y_fields and len(y_fields) >= 2:
            # First field on left axis
            if y_fields[0] in df.columns:
                y_axis_list.append({
                    "type": "value",
                    "name": y_fields[0],
                    "position": "left"
                })
                series.append({
                    "name": y_fields[0],
                    "type": "bar",
                    "data": df[y_fields[0]].tolist(),
                    "yAxisIndex": 0
                })

            # Second field on right axis
            if y_fields[1] in df.columns:
                y_axis_list.append({
                    "type": "value",
                    "name": y_fields[1],
                    "position": "right"
                })
                series.append({
                    "name": y_fields[1],
                    "type": "line",
                    "data": df[y_fields[1]].tolist(),
                    "yAxisIndex": 1,
                    "smooth": True
                })

        return {
            "xAxis": {
                "type": "category",
                "data": x_data
            },
            "yAxis": y_axis_list,
            "series": series,
            "tooltip": {
                "trigger": "axis",
                "axisPointer": {"type": "cross"}
            },
            "legend": {
                "data": [s["name"] for s in series]
            }
        }

    def _build_horizontal_bar_chart(
        self,
        df: pd.DataFrame,
        x_field: Optional[str],
        y_fields: Optional[List[str]],
        series_field: Optional[str]
    ) -> dict:
        """Build horizontal bar chart"""
        y_data = df[x_field].tolist() if x_field else df.index.tolist()

        series = []
        for y_field in (y_fields or []):
            if y_field in df.columns:
                series.append({
                    "name": y_field,
                    "type": "bar",
                    "data": df[y_field].tolist(),
                    "emphasis": {"focus": "series"}
                })

        return {
            "xAxis": {
                "type": "value"
            },
            "yAxis": {
                "type": "category",
                "data": y_data
            },
            "series": series,
            "tooltip": {
                "trigger": "axis",
                "axisPointer": {"type": "shadow"}
            },
            "legend": {
                "data": [s["name"] for s in series]
            },
            "grid": {
                "left": "15%",
                "right": "4%",
                "bottom": "3%",
                "containLabel": True
            }
        }

    def _build_donut_chart(
        self,
        df: pd.DataFrame,
        x_field: Optional[str],
        y_fields: Optional[List[str]]
    ) -> dict:
        """Build donut chart"""
        config = self._build_pie_chart(df, x_field, y_fields)
        # Modify to donut style
        if config.get("series"):
            config["series"][0]["radius"] = ["50%", "70%"]
        return config

    def _build_nested_donut_chart(
        self,
        df: pd.DataFrame,
        x_field: Optional[str],
        y_fields: Optional[List[str]],
        series_field: Optional[str]
    ) -> dict:
        """Build nested donut chart for hierarchical comparison"""
        inner_field = x_field or df.columns[0]
        outer_field = series_field or (df.columns[1] if len(df.columns) > 1 else inner_field)
        value_field = y_fields[0] if y_fields else df.select_dtypes(include=[np.number]).columns[0]

        # Inner ring data (aggregated by inner_field)
        inner_data = df.groupby(inner_field)[value_field].sum().reset_index()
        inner_series_data = [
            {"name": str(row[inner_field]), "value": float(row[value_field])}
            for _, row in inner_data.iterrows()
        ]

        # Outer ring data (by outer_field)
        outer_data = df.groupby(outer_field)[value_field].sum().reset_index()
        outer_series_data = [
            {"name": str(row[outer_field]), "value": float(row[value_field])}
            for _, row in outer_data.iterrows()
        ]

        return {
            "series": [
                {
                    "name": inner_field,
                    "type": "pie",
                    "radius": ["0%", "35%"],
                    "label": {"position": "inner", "fontSize": 10},
                    "data": inner_series_data
                },
                {
                    "name": outer_field,
                    "type": "pie",
                    "radius": ["50%", "70%"],
                    "label": {"formatter": "{b}: {d}%"},
                    "data": outer_series_data
                }
            ],
            "tooltip": {
                "trigger": "item",
                "formatter": "{a} <br/>{b}: {c} ({d}%)"
            },
            "legend": {
                "orient": "vertical",
                "left": "left"
            }
        }

    def get_available_chart_types(self) -> List[dict]:
        """Get list of available chart types"""
        return [
            {"id": "line", "name": "折线图", "description": "展示趋势变化"},
            {"id": "bar", "name": "柱状图", "description": "对比分析"},
            {"id": "pie", "name": "饼图", "description": "占比分析"},
            {"id": "area", "name": "面积图", "description": "累计趋势"},
            {"id": "scatter", "name": "散点图", "description": "相关性分析"},
            {"id": "waterfall", "name": "瀑布图", "description": "增减分析"},
            {"id": "radar", "name": "雷达图", "description": "多维对比"},
            {"id": "funnel", "name": "漏斗图", "description": "转化分析"},
            {"id": "gauge", "name": "仪表盘", "description": "KPI展示"},
            {"id": "heatmap", "name": "热力图", "description": "分布分析"},
            {"id": "combination", "name": "组合图", "description": "多指标对比"},
            # Advanced charts (Phase 5)
            {"id": "sunburst", "name": "旭日图", "description": "层级结构展示"},
            {"id": "pareto", "name": "帕累托图", "description": "80/20分析"},
            {"id": "bullet", "name": "子弹图", "description": "目标对比"},
            {"id": "dual_axis", "name": "双Y轴图", "description": "不同量纲对比"},
            {"id": "bar_horizontal", "name": "水平柱图", "description": "长标签对比"},
            {"id": "donut", "name": "环形图", "description": "占比分析"},
            {"id": "nested_donut", "name": "嵌套环形图", "description": "多层级占比"}
        ]
