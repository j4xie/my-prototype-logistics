"""Abstract base class for all financial chart builders."""
import math
import logging
from abc import ABC, abstractmethod
from typing import Dict, List, Optional, Any
import pandas as pd
import numpy as np

logger = logging.getLogger(__name__)


# Import shared utilities from chart_builder
def _sanitize_for_json(obj):
    """Replace NaN/Infinity with JSON-safe values."""
    if isinstance(obj, float):
        if math.isnan(obj) or math.isinf(obj):
            return None
        return obj
    if isinstance(obj, dict):
        return {k: _sanitize_for_json(v) for k, v in obj.items()}
    if isinstance(obj, (list, tuple)):
        return [_sanitize_for_json(item) for item in obj]
    if isinstance(obj, pd.Series):
        return [_sanitize_for_json(item) for item in obj.tolist()]
    if isinstance(obj, np.ndarray):
        return [_sanitize_for_json(item) for item in obj.tolist()]
    if obj is pd.NaT:
        return None
    if isinstance(obj, pd.Timestamp):
        return obj.isoformat() if not pd.isna(obj) else None
    if isinstance(obj, (np.bool_,)):
        return bool(obj)
    if isinstance(obj, np.floating):
        val = float(obj)
        return None if (math.isnan(val) or math.isinf(val)) else val
    if isinstance(obj, np.integer):
        return int(obj)
    return obj


def _detect_value_scale(values: list) -> dict:
    """Return divisor and suffix based on max value."""
    try:
        abs_values = [abs(v) for v in values if isinstance(v, (int, float)) and not (isinstance(v, float) and math.isnan(v))]
        if not abs_values:
            return {"divisor": 1, "suffix": "", "name_suffix": ""}
        max_val = max(abs_values)
        if max_val >= 1e8:
            return {"divisor": 1e8, "suffix": "亿", "name_suffix": " (亿元)"}
        elif max_val >= 1e4:
            return {"divisor": 1e4, "suffix": "万", "name_suffix": " (万)"}
        return {"divisor": 1, "suffix": "", "name_suffix": ""}
    except Exception:
        return {"divisor": 1, "suffix": "", "name_suffix": ""}


# Theme colors matching THEME_PALETTES["business"]
COLORS = {
    "primary": "#1B65A8",
    "secondary": "#36B37E",
    "accent": "#FFAB00",
    "danger": "#FF5630",
    "muted": "#6B778C",
    "success": "#36B37E",
    "warning": "#FFAB00",
    # WCAG AA text-safe variants (contrast ≥ 4.5:1 on white)
    "text_accent": "#B37700",
    "text_success": "#1B7A4A",
    "text_warning": "#B37700",
    "charts": ["#1B65A8", "#36B37E", "#FFAB00", "#FF5630", "#6B778C",
               "#2B7EC1", "#57D9A3", "#FFC400", "#FF8B6A", "#4C9AFF"],
    # P&L waterfall colors
    "revenue": "#FF5630",    # red = income (positive)
    "cost": "#36B37E",       # green = cost (deduction)
    "expense": "#57D9A3",    # light green
    "profit": "#1B65A8",     # blue = summary
    "tax": "#6B778C",        # grey
    # Budget vs Actual
    "budget": "#1B65A8",
    "actual": "#36B37E",
    "target_line": "#FFAB00",
    "achievement": "#e6a23c",
    # YoY
    "current_year": "#1B65A8",
    "last_year": "#91cc75",
    "yoy_up": "#FF5630",
    "yoy_down": "#36B37E",
}

MONTH_LABELS = ['1月', '2月', '3月', '4月', '5月', '6月',
                '7月', '8月', '9月', '10月', '11月', '12月']

QUARTER_COLORS = ['rgba(27,101,168,0.03)', 'rgba(54,179,126,0.03)',
                  'rgba(255,171,0,0.03)', 'rgba(255,86,48,0.03)']


class AbstractFinancialChartBuilder(ABC):
    """Base class for all financial chart builders."""

    chart_type: str = ""           # Unique identifier
    display_name: str = ""         # Display name
    description: str = ""          # Description for AI/UI
    required_columns: List[str] = []  # Required column roles: budget, actual, last_year, category, item
    display_order: int = 0         # Order in dashboard

    def can_build(self, column_mapping) -> bool:
        """Check if this chart can be built with available columns."""
        available = set()
        if column_mapping.budget_cols:
            available.add('budget')
        if column_mapping.actual_cols:
            available.add('actual')
        if column_mapping.last_year_cols:
            available.add('last_year')
        if column_mapping.category_col:
            available.add('category')
        if column_mapping.item_col or column_mapping.label_col:
            available.add('item')
        if column_mapping.period_cols:
            available.add('period')
        return all(r in available for r in self.required_columns)

    @abstractmethod
    def build(self, df: pd.DataFrame, column_mapping, period: Dict, year: int = 2026) -> Dict[str, Any]:
        """Build chart result with ECharts option and metadata.

        Returns:
            {
                "chartType": str,
                "title": str,
                "kpis": [{"label", "value", "unit", "trend"}],
                "echartsOption": dict,
                "tableData": dict or None,
                "analysisContext": str,
                "metadata": {"period", "dataQuality"}
            }
        """
        pass

    def get_analysis_context(self, result: Dict) -> str:
        """Generate analysis context string from build result for AI analysis."""
        kpis = result.get('kpis', [])
        parts = [f"{result.get('title', self.display_name)}:"]
        for kpi in kpis:
            parts.append(f"{kpi['label']}: {kpi['value']}{kpi.get('unit', '')}")
        return " ".join(parts)

    # --- Helper methods for subclasses ---

    def _month_labels(self, start: int = 1, end: int = 12) -> List[str]:
        return MONTH_LABELS[start-1:end]

    def _quarter_mark_areas(self, start_month: int = 1, end_month: int = 12) -> List[Dict]:
        """Generate quarter background markArea data."""
        areas = []
        for q in range(4):
            q_start = q * 3  # 0-indexed month position
            q_end = q * 3 + 2
            # Adjust for period filter
            if q_start > end_month - 1 or q_end < start_month - 1:
                continue
            actual_start = max(q_start, start_month - 1) - (start_month - 1)
            actual_end = min(q_end, end_month - 1) - (start_month - 1)
            areas.append([
                {"xAxis": actual_start - 0.5, "itemStyle": {"color": QUARTER_COLORS[q]}},
                {"xAxis": actual_end + 0.5}
            ])
        return areas

    def _format_value(self, val, scale: dict, precision: int = 2) -> str:
        """Format value with scale suffix."""
        if val is None:
            return '-'
        scaled = val / scale['divisor']
        if scale['suffix']:
            return f"{scaled:,.{precision}f}{scale['suffix']}"
        return f"{val:,.{precision}f}"

    def _calc_growth_rate(self, current, previous) -> Optional[float]:
        """Calculate YoY/MoM growth rate as percentage."""
        if previous is None or previous == 0 or current is None:
            return None
        return round((current - previous) / abs(previous) * 100, 2)

    def _calc_achievement_rate(self, actual, budget) -> Optional[float]:
        """Calculate budget achievement rate as percentage."""
        if budget is None or budget == 0 or actual is None:
            return None
        return round(actual / budget * 100, 2)

    def _trend_from_value(self, val) -> str:
        if val is None:
            return 'flat'
        return 'up' if val > 0 else ('down' if val < 0 else 'flat')

    def _gradient_color(self, hex_color: str, direction: str = 'vertical') -> Dict:
        """Convert flat color to ECharts linear gradient (top=lighter, bottom=full).

        Args:
            hex_color: CSS hex color like '#1B65A8'
            direction: 'vertical' (top→bottom) or 'horizontal' (left→right)
        """
        hex_color = hex_color.lstrip('#')
        r, g, b = int(hex_color[0:2], 16), int(hex_color[2:4], 16), int(hex_color[4:6], 16)
        lighter = f"rgba({min(r + 40, 255)},{min(g + 40, 255)},{min(b + 40, 255)},0.85)"
        full = f"#{hex_color}"
        x2 = 1 if direction == 'horizontal' else 0
        y2 = 0 if direction == 'horizontal' else 1
        return {
            "type": "linear", "x": 0, "y": 0, "x2": x2, "y2": y2,
            "colorStops": [
                {"offset": 0, "color": lighter},
                {"offset": 1, "color": full},
            ],
        }

    def _apply_datazoom(self, option: Dict) -> None:
        """Add dataZoom to a time-series chart option. Opt-in only.

        Note: toolbox.feature.dataZoom is intentionally NOT added — the slider
        dataZoom already provides zoom functionality, and the toolbox feature
        causes 'grid.master' TypeError on some chart configurations.
        """
        option["dataZoom"] = self._datazoom_config()

    def _datazoom_config(self) -> list:
        """Return standard dataZoom config for time-series charts. Opt-in only."""
        return [
            {
                "type": "slider",
                "show": True,
                "xAxisIndex": [0],
                "start": 0,
                "end": 100,
                "height": 18,
                "bottom": 0,
                "borderColor": "transparent",
                "backgroundColor": "rgba(27,101,168,0.05)",
                "fillerColor": "rgba(27,101,168,0.12)",
                "handleStyle": {"color": "#1B65A8", "borderColor": "#1B65A8"},
                "textStyle": {"fontSize": 10, "color": "#909399"},
                "brushSelect": False,
            },
            {
                "type": "inside",
                "xAxisIndex": [0],
                "start": 0,
                "end": 100,
                "zoomOnMouseWheel": "shift",
            },
        ]

    def _base_echarts_option(self) -> Dict:
        """Return base ECharts option with common settings."""
        return {
            "animation": True,
            "animationDuration": 600,
            "animationEasing": "cubicOut",
            "animationDelay": "__ANIM__stagger_80",
            "tooltip": {
                "trigger": "axis",
                "confine": True,
                "backgroundColor": "rgba(255,255,255,0.96)",
                "borderColor": "#e8e8e8",
                "extraCssText": "box-shadow:0 4px 20px rgba(0,0,0,0.12);border-radius:8px;padding:12px 16px;",
                "textStyle": {"fontSize": 12, "color": "#333"},
                "formatter": "__FMT__financial_rich_tooltip",
            },
            "grid": {"left": "3%", "right": "4%", "bottom": "12%", "top": "15%", "containLabel": True},
            "toolbox": {
                "show": True,
                "right": "3%",
                "top": "0%",
                "feature": {
                    "restore": {"title": "还原"},
                    "saveAsImage": {"title": "保存图片", "pixelRatio": 2},
                },
                "iconStyle": {"borderColor": "#909399"},
                "emphasis": {"iconStyle": {"borderColor": "#1B65A8"}},
            },
            # A4: Default emphasis style — builders merge this into per-series emphasis
            # Note: ECharts ignores top-level emphasis; this serves as a template
            # that _base_echarts_option callers can extract via option.pop("_emphasis_template")
            "_emphasis_template": {
                "itemStyle": {
                    "shadowBlur": 12,
                    "shadowColor": "rgba(0,0,0,0.15)",
                    "shadowOffsetY": 4,
                    "borderWidth": 1,
                    "borderColor": "rgba(255,255,255,0.8)",
                },
            },
        }

    def sanitize(self, obj):
        return _sanitize_for_json(obj)
