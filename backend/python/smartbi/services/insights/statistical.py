from __future__ import annotations
"""
Rule-based statistical insights: trend analysis, anomaly detection,
comparison generation, and metric analysis.

No LLM calls -- pure math / pandas.
"""
import logging
import re
from enum import Enum
from typing import Optional, List

import numpy as np
import pandas as pd

from .data_summarizer import humanize_col, humanize_df_columns

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Enums & constants
# ---------------------------------------------------------------------------

class InsightType(str, Enum):
    """Types of business insights"""
    TREND = "trend"
    ANOMALY = "anomaly"
    COMPARISON = "comparison"
    FORECAST = "forecast"
    RECOMMENDATION = "recommendation"
    SUMMARY = "summary"


INSIGHT_TEMPLATES = {
    "growth_positive": "在分析期间，{metric}呈现上升趋势，增长率为{rate:.1f}%。",
    "growth_negative": "在分析期间，{metric}呈现下降趋势，降幅为{rate:.1f}%。",
    "high_performer": "{dimension}表现突出，{metric}达到{value}，占总体的{ratio:.1f}%。",
    "low_performer": "{dimension}表现较弱，{metric}仅为{value}，需要关注和改进。",
    "anomaly_high": "检测到异常高值：{date}的{metric}达到{value}，较平均值高{deviation:.1f}%。",
    "anomaly_low": "检测到异常低值：{date}的{metric}为{value}，较平均值低{deviation:.1f}%。",
    "target_achieved": "目标完成情况良好，{metric}完成率达到{rate:.1f}%。",
    "target_missed": "目标未达成，{metric}完成率仅为{rate:.1f}%，差距为{gap}。",
    "forecast_growth": "根据趋势预测，未来{period}期的{metric}预计将增长{rate:.1f}%。",
    "forecast_decline": "根据趋势预测，未来{period}期的{metric}预计将下降{rate:.1f}%。",
}


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def generate_statistical_insights(
    df: pd.DataFrame,
    metrics: Optional[List[dict]],
) -> List[dict]:
    """Generate rule-based statistical insights from *df* and optional *metrics*."""
    # Humanize column names so insight text uses friendly names
    df = humanize_df_columns(df)
    insights: List[dict] = []

    # Analyze each numeric column, skip unnamed/meaningless columns
    numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()
    numeric_cols = [
        c for c in numeric_cols
        if not re.match(
            r'^(Column_\d+|指标\d+|Unnamed|Unnamed:\s*\d+)$', str(c), re.IGNORECASE
        )
    ]

    # Determine if data has time-series ordering (needed for trend analysis)
    has_time_order = _has_time_column(df)

    for col in numeric_cols:
        values = df[col].dropna()
        if len(values) < 2:
            continue

        # Trend analysis -- only meaningful when rows are ordered by time
        if has_time_order:
            trend_insight = _analyze_trend(col, values)
            if trend_insight:
                insights.append(trend_insight)

        # Anomaly detection
        anomaly_insights = _detect_anomalies(df, col, values)
        insights.extend(anomaly_insights)

    # Comparison insights for categorical dimensions
    cat_cols = df.select_dtypes(include=['object', 'category']).columns.tolist()
    for cat_col in cat_cols:
        for num_col in numeric_cols[:2]:  # Limit to avoid too many
            comparison = _generate_comparison(df, cat_col, num_col)
            if comparison:
                insights.append(comparison)

    # Add metric-based insights if provided
    if metrics:
        metric_insights = _analyze_metrics(metrics)
        insights.extend(metric_insights)

    # Sort by importance
    insights.sort(key=lambda x: x.get("importance", 0), reverse=True)
    return insights


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _has_time_column(df: pd.DataFrame) -> bool:
    """Check if the DataFrame has a time-like column indicating row order is temporal."""
    time_patterns = re.compile(
        r'(日期|时间|月份|年份|季度|date|time|month|year|quarter|period|week)',
        re.IGNORECASE,
    )
    for col in df.columns:
        if time_patterns.search(str(col)):
            return True
        if df[col].dtype in ('datetime64[ns]', 'datetime64'):
            return True
        sample = df[col].dropna().head(1)
        if len(sample) > 0:
            val = str(sample.iloc[0])
            if re.match(r'^\d{4}[-/]\d{1,2}([-/]\d{1,2})?$', val):
                return True
            if re.match(r'^\d{4}年\d{1,2}月', val):
                return True
    return False


def _analyze_trend(column: str, values: pd.Series) -> Optional[dict]:
    """Analyze trend for a numeric column."""
    if len(values) < 3:
        return None

    first_val = values.iloc[0]
    last_val = values.iloc[-1]

    if abs(first_val) < 1e-6:
        return None

    growth_rate = ((last_val - first_val) / abs(first_val)) * 100
    growth_rate = max(min(growth_rate, 10000), -10000)

    if abs(growth_rate) < 5:
        return None

    if growth_rate > 0:
        text = INSIGHT_TEMPLATES["growth_positive"].format(metric=column, rate=growth_rate)
        sentiment = "positive"
    else:
        text = INSIGHT_TEMPLATES["growth_negative"].format(metric=column, rate=abs(growth_rate))
        sentiment = "negative"

    return {
        "type": InsightType.TREND.value,
        "text": text,
        "metric": column,
        "value": float(last_val),
        "changeRate": float(growth_rate),
        "sentiment": sentiment,
        "importance": min(abs(growth_rate) / 10, 10),
    }


def _detect_anomalies(
    df: pd.DataFrame, column: str, values: pd.Series
) -> List[dict]:
    """Detect anomalies using statistical methods (z-score)."""
    insights: List[dict] = []
    if len(values) < 5:
        return insights

    mean = values.mean()
    std = values.std()
    if std == 0:
        return insights

    z_scores = (values - mean) / std
    anomaly_mask = abs(z_scores) > 2

    for idx in values[anomaly_mask].index:
        value = values[idx]
        deviation = ((value - mean) / mean) * 100 if mean != 0 else 0

        # Try to get a meaningful label for the anomaly row
        date_str = None
        if 'date' in df.columns:
            date_str = str(df.loc[idx, 'date'])
        if not date_str or date_str == str(idx):
            text_cols = df.select_dtypes(include=['object']).columns
            for tc in text_cols:
                try:
                    label = df.loc[idx, tc]
                    if label and str(label).strip():
                        date_str = humanize_col(str(label).strip())
                        break
                except Exception as e:
                    logger.debug(
                        "anomaly label lookup failed for idx=%s col=%s: %s", idx, tc, e
                    )
        if not date_str:
            date_str = humanize_col(str(idx))

        if value > mean:
            text = INSIGHT_TEMPLATES["anomaly_high"].format(
                date=date_str, metric=column,
                value=f"{value:,.2f}", deviation=abs(deviation),
            )
            sentiment = "warning"
        else:
            text = INSIGHT_TEMPLATES["anomaly_low"].format(
                date=date_str, metric=column,
                value=f"{value:,.2f}", deviation=abs(deviation),
            )
            sentiment = "negative"

        insights.append({
            "type": InsightType.ANOMALY.value,
            "text": text,
            "metric": column,
            "value": float(value),
            "deviation": float(deviation),
            "sentiment": sentiment,
            "importance": min(abs(z_scores[idx]) * 2, 10),
        })

    return insights[:3]


def _generate_comparison(
    df: pd.DataFrame, cat_column: str, num_column: str
) -> Optional[dict]:
    """Generate comparison insight for a categorical dimension."""
    if cat_column not in df.columns or num_column not in df.columns:
        return None

    grouped = df.groupby(cat_column)[num_column].sum()
    if grouped.empty:
        return None

    total = grouped.sum()
    if total == 0:
        return None

    top = grouped.idxmax()
    top_value = grouped[top]
    top_ratio = (top_value / total) * 100

    text = INSIGHT_TEMPLATES["high_performer"].format(
        dimension=f"{cat_column}={top}",
        metric=num_column,
        value=f"{top_value:,.2f}",
        ratio=top_ratio,
    )

    return {
        "type": InsightType.COMPARISON.value,
        "text": text,
        "dimension": cat_column,
        "topValue": str(top),
        "metric": num_column,
        "value": float(top_value),
        "ratio": float(top_ratio),
        "sentiment": "positive",
        "importance": 5,
    }


def _analyze_metrics(metrics: List[dict]) -> List[dict]:
    """Generate insights from pre-calculated metrics."""
    insights: List[dict] = []

    for metric in metrics:
        if not metric.get("success"):
            continue

        name = metric.get("name", metric.get("metric", ""))
        value = metric.get("value")
        unit = metric.get("unit", "")

        if value is None:
            continue

        if "完成率" in name or "completion" in metric.get("metric", "").lower():
            if value >= 100:
                text = INSIGHT_TEMPLATES["target_achieved"].format(metric=name, rate=value)
                sentiment = "positive"
            else:
                gap = 100 - value
                text = INSIGHT_TEMPLATES["target_missed"].format(
                    metric=name, rate=value, gap=f"{gap:.1f}%",
                )
                sentiment = "negative"

            insights.append({
                "type": InsightType.SUMMARY.value,
                "text": text,
                "metric": name,
                "value": float(value),
                "unit": unit,
                "sentiment": sentiment,
                "importance": 8,
            })

    return insights
