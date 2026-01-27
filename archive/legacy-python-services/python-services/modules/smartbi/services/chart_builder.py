from __future__ import annotations
"""
Chart Builder Service

Builds ECharts configuration from data and chart specifications.
"""
import logging
from typing import Any, Optional, List, Dict
from enum import Enum

import pandas as pd
import numpy as np

logger = logging.getLogger(__name__)


class ChartType(str, Enum):
    """Supported chart types"""
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
        value_field = y_fields[0] if y_fields else df.select_dtypes(include=[np.number]).columns[0]

        data = [
            {"name": str(row[name_field]), "value": float(row[value_field])}
            for _, row in df.iterrows()
        ]

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
        y_col = y_fields[0] if y_fields else df.select_dtypes(include=[np.number]).columns[0]
        values = df[y_col].tolist()

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

        # Use y_fields as indicators
        if y_fields:
            for field in y_fields:
                if field in df.columns:
                    max_val = float(df[field].max())
                    indicators.append({"name": field, "max": max_val * 1.2})
                    data_values.append(float(df[field].iloc[0]) if len(df) > 0 else 0)
        else:
            # Use numeric columns
            for col in df.select_dtypes(include=[np.number]).columns[:6]:
                max_val = float(df[col].max())
                indicators.append({"name": col, "max": max_val * 1.2})
                data_values.append(float(df[col].iloc[0]) if len(df) > 0 else 0)

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
        value_col = y_fields[0] if y_fields else df.select_dtypes(include=[np.number]).columns[0]

        x_data = df[x_col].unique().tolist()
        y_data = df[y_col].unique().tolist()

        data = []
        for _, row in df.iterrows():
            x_idx = x_data.index(row[x_col])
            y_idx = y_data.index(row[y_col])
            data.append([x_idx, y_idx, float(row[value_col])])

        max_val = df[value_col].max()
        min_val = df[value_col].min()

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
            {"id": "combination", "name": "组合图", "description": "多指标对比"}
        ]
