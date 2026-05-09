from __future__ import annotations
"""
Shared utilities for chart building strategies.

Contains sanitization, column detection, numeric coercion, palette definitions,
animation presets, and common ECharts option helpers.
"""
import logging
import math
from typing import Dict, Optional

import numpy as np
import pandas as pd

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# JSON sanitization
# ---------------------------------------------------------------------------

def sanitize_for_json(obj):
    """Replace NaN/Infinity/-Infinity and non-serializable types with JSON-safe values.

    NaN -> None (JSON null) so frontend can distinguish missing data from zero.
    Infinity -> None (not a valid chart value).
    """
    if isinstance(obj, float):
        if math.isnan(obj) or math.isinf(obj):
            return None
        return obj
    if isinstance(obj, dict):
        return {k: sanitize_for_json(v) for k, v in obj.items()}
    if isinstance(obj, pd.Series):
        return [sanitize_for_json(item) for item in obj.tolist()]
    if isinstance(obj, np.ndarray):
        return [sanitize_for_json(item) for item in obj.tolist()]
    if isinstance(obj, (list, tuple)):
        return [sanitize_for_json(item) for item in obj]
    if obj is pd.NaT:
        return None
    if isinstance(obj, pd.Timestamp):
        return obj.isoformat() if not pd.isna(obj) else None
    if isinstance(obj, np.bool_):
        return bool(obj)
    if isinstance(obj, np.floating):
        val = float(obj)
        if math.isnan(val) or math.isinf(val):
            return None
        return val
    if isinstance(obj, np.integer):
        return int(obj)
    return obj


# Backward-compat alias (used by callers that import _sanitize_for_json)
_sanitize_for_json = sanitize_for_json


# ---------------------------------------------------------------------------
# ID / index column detection
# ---------------------------------------------------------------------------

_ID_NAME_PATTERNS = {
    '行次', '序号', '编号', '行号', '项目编号',
    'index', 'no', 'no.', 'id', 'row_num', 'row_number', 'sn',
}

_ID_NAME_FRAGMENTS = [
    '订单号', '单号', '编码', '工号', '货号', '票号', '凭证号',
    'order_id', 'order_no', 'item_id', 'sku_id', 'batch_no',
]


def is_id_column(col_name: str, series) -> bool:
    """Detect if a column is an ID/index/sequence column (not useful for chart Y-axis)."""
    lower = col_name.lower().strip()
    if lower in _ID_NAME_PATTERNS:
        return True
    if any(frag in lower for frag in _ID_NAME_FRAGMENTS):
        return True
    try:
        vals = pd.to_numeric(series.dropna().head(20), errors='coerce').dropna()
        if len(vals) >= 3:
            diffs = vals.diff().dropna()
            if len(diffs) > 0 and all(abs(d - 1) < 0.001 for d in diffs):
                return True
            if (vals.nunique() == len(vals) and vals.min() > 10000
                    and all(v == int(v) for v in vals)
                    and series.nunique() / max(len(series.dropna()), 1) > 0.9):
                return True
    except Exception:
        pass
    return False


# Backward-compat alias
_is_id_column = is_id_column


# ---------------------------------------------------------------------------
# Numeric coercion
# ---------------------------------------------------------------------------

def coerce_numeric_columns(df: pd.DataFrame) -> pd.DataFrame:
    """Try to convert object columns that look numeric to actual numeric dtype.

    Fixes the issue where mixed-type columns (e.g., "123.4" as str) are
    invisible to select_dtypes(include=[np.number]).
    Only converts columns where >50% of non-null values are numeric.
    Skips ID/index columns to avoid polluting Y-axis candidates.
    """
    df = df.copy()
    for col in df.select_dtypes(include=['object']).columns:
        if is_id_column(col, df[col]):
            continue
        coerced = pd.to_numeric(df[col], errors='coerce')
        non_null = df[col].notna().sum()
        if non_null > 0 and coerced.notna().sum() / non_null > 0.5:
            df[col] = coerced
    return df


# Backward-compat alias
_coerce_numeric_columns = coerce_numeric_columns


# ---------------------------------------------------------------------------
# Theme palettes & constants
# ---------------------------------------------------------------------------

THEME_PALETTES = {
    "business": {
        "primary": ["#2D8B57", "#2B7EC1", "#4C9AFF", "#93c5fd", "#bfdbfe"],
        "secondary": ["#36B37E", "#57D9A3", "#34d399", "#6ee7b7", "#a7f3d0"],
        "accent": ["#FFAB00", "#FFC400", "#fbbf24", "#fcd34d", "#fde68a"],
        "danger": ["#FF5630", "#FF8B6A", "#f87171", "#fca5a5"],
        "charts": [
            "#2D8B57", "#36B37E", "#FFAB00", "#FF5630", "#6B778C",
            "#2B7EC1", "#57D9A3", "#FFC400", "#FF8B6A", "#4C9AFF",
        ],
        "gradients": [
            {"start": "#2D8B57", "end": "#4C9AFF"},
            {"start": "#36B37E", "end": "#57D9A3"},
            {"start": "#FFAB00", "end": "#FFC400"},
            {"start": "#FF5630", "end": "#FF8B6A"},
            {"start": "#6B778C", "end": "#4C9AFF"},
        ],
        "semantic": {
            "success": "#36B37E",
            "warning": "#FFAB00",
            "danger": "#FF5630",
            "info": "#2D8B57",
            "muted": "#6B778C",
        },
    }
}

ACTIVE_THEME = "business"


def get_palette() -> dict:
    return THEME_PALETTES[ACTIVE_THEME]


# Legacy aliases
DEFAULT_COLORS = THEME_PALETTES["business"]["charts"]
GRADIENT_COLORS = THEME_PALETTES["business"]["gradients"]

# DataZoom auto-show threshold
DATAZOOM_THRESHOLD = 15


# ---------------------------------------------------------------------------
# Animation presets (Tableau + Power BI Fluent Motion)
# ---------------------------------------------------------------------------

ANIMATION_PRESETS: Dict[str, dict] = {
    "bar": {
        "animationDuration": 800,
        "animationEasing": "elasticOut",
        "animationDelay": "__ANIM__stagger_80",
    },
    "line": {
        "animationDuration": 1200,
        "animationEasing": "cubicOut",
    },
    "pie": {
        "animationDuration": 1000,
        "animationEasing": "cubicOut",
        "animationType": "expansion",
    },
    "scatter": {
        "animationDuration": 600,
        "animationEasing": "elasticOut",
        "animationDelayUpdate": "__ANIM__stagger_5",
    },
    "area": {
        "animationDuration": 1200,
        "animationEasing": "cubicOut",
    },
    "waterfall": {
        "animationDuration": 800,
        "animationEasing": "cubicOut",
        "animationDelay": "__ANIM__stagger_60",
    },
    "heatmap": {
        "animationDuration": 1000,
        "animationEasing": "cubicOut",
    },
    "radar": {
        "animationDuration": 800,
        "animationEasing": "cubicOut",
    },
    "funnel": {
        "animationDuration": 800,
        "animationEasing": "cubicOut",
        "animationDelay": "__ANIM__stagger_80",
    },
    "gauge": {
        "animationDuration": 1500,
        "animationEasing": "elasticOut",
    },
    "treemap": {
        "animationDuration": 800,
        "animationEasing": "cubicOut",
    },
    "sankey": {
        "animationDuration": 1000,
        "animationEasing": "elasticOut",
    },
    "gantt": {
        "animationDuration": 800,
        "animationEasing": "cubicOut",
        "animationDelay": "__ANIM__stagger_60",
    },
    "sunburst": {
        "animationDuration": 1000,
        "animationEasing": "cubicOut",
    },
    "boxplot": {
        "animationDuration": 600,
        "animationEasing": "cubicOut",
        "animationDelay": "__ANIM__stagger_60",
    },
    "combination": {
        "animationDuration": 800,
        "animationEasing": "cubicOut",
        "animationDelay": "__ANIM__stagger_60",
    },
    "pareto": {
        "animationDuration": 800,
        "animationEasing": "cubicOut",
        "animationDelay": "__ANIM__stagger_60",
    },
    "slope": {
        "animationDuration": 1000,
        "animationEasing": "cubicOut",
    },
    "matrix_heatmap": {
        "animationDuration": 800,
        "animationEasing": "cubicOut",
    },
    "wordcloud": {
        "animationDuration": 600,
        "animationEasing": "cubicOut",
    },
}


# ---------------------------------------------------------------------------
# Shared visual-enhancement helpers
# ---------------------------------------------------------------------------

def detect_value_scale(values: list) -> dict:
    """Detect numeric magnitude; return divisor, suffix, and name_suffix."""
    try:
        abs_values = [abs(v) for v in values if isinstance(v, (int, float)) and not np.isnan(v)]
        if not abs_values:
            return {"divisor": 1, "suffix": "", "name_suffix": ""}
        max_val = max(abs_values)
        if max_val >= 1e8:
            return {"divisor": 1e8, "suffix": "亿", "name_suffix": " (亿元)"}
        elif max_val >= 1e4:
            return {"divisor": 1e4, "suffix": "万", "name_suffix": " (万)"}
        return {"divisor": 1, "suffix": "", "name_suffix": ""}
    except Exception as e:
        logger.debug(f"detect_value_scale failed for {len(values)} items: {e}")
        return {"divisor": 1, "suffix": "", "name_suffix": ""}


def scale_series_data(data: list, divisor: float) -> list:
    """Scale a data series by *divisor*."""
    if divisor == 1:
        return data
    scaled = []
    for v in data:
        if isinstance(v, (int, float)) and not np.isnan(v):
            scaled.append(round(v / divisor, 2))
        else:
            scaled.append(v)
    return scaled


def apply_gradient_to_series(series: list) -> list:
    """Apply gradient colour + border-radius to bar series."""
    gradients = get_palette()["gradients"]
    for i, s in enumerate(series):
        if s.get("type") != "bar":
            continue
        gc = gradients[i % len(gradients)]
        s["itemStyle"] = {
            "color": {
                "type": "linear",
                "x": 0, "y": 0, "x2": 0, "y2": 1,
                "colorStops": [
                    {"offset": 0, "color": gc["start"]},
                    {"offset": 1, "color": gc["end"]},
                ],
            },
            "borderRadius": [4, 4, 0, 0],
        }
    return series


def make_bar_label(suffix: str = "") -> dict:
    """Bar-chart top data label."""
    label = {
        "show": True,
        "position": "top",
        "fontSize": 11,
        "color": "#606266",
    }
    if suffix:
        label["formatter"] = "{c}" + suffix
    return label


def make_enhanced_tooltip(trigger: str = "axis") -> dict:
    """Structured tooltip (Tableau multi-row + ThoughtSpot minimal + FineBI comparison)."""
    return {
        "trigger": trigger,
        "backgroundColor": "rgba(255,255,255,0.96)",
        "borderColor": "#e5e7eb",
        "borderWidth": 1,
        "borderRadius": 8,
        "padding": [12, 16],
        "textStyle": {"color": "#374151", "fontSize": 13},
        "extraCssText": "box-shadow: 0 4px 20px rgba(0,0,0,0.12);",
        "confine": True,
        "valueFormatter": "__FMT__thousands_sep",
        **({"axisPointer": {"type": "shadow", "shadowStyle": {"color": "rgba(37,99,235,0.06)"}}} if trigger == "axis" else {}),
    }


def aggregate_pie_top_n(data: list, n: int = 5) -> list:
    """Merge pie data beyond top *n* into an 'Other' slice."""
    if len(data) <= n + 1:
        return data
    sorted_data = sorted(data, key=lambda d: abs(d.get("value", 0)), reverse=True)
    top = sorted_data[:n]
    others_val = sum(d.get("value", 0) for d in sorted_data[n:])
    if others_val != 0:
        top.append({"name": "其他", "value": round(others_val, 2)})
    return top


def empty_chart_config(title: Optional[str] = None) -> dict:
    """Return an empty chart configuration placeholder."""
    return {
        "title": {
            "text": title or "No Data",
            "subtext": "暂无数据",
            "left": "center",
            "top": "center",
        },
        "series": [],
    }
