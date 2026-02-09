"""
Statistical Analysis API

Exposes StatisticalAnalyzer capabilities:
- Comprehensive statistical analysis (distribution, outliers, normality)
- Correlation analysis (heatmap data, strong pairs)
- Comparison analysis (Pareto, concentration, Gini)
"""
from __future__ import annotations

import logging
import time
from typing import Any, Dict, List, Optional

import pandas as pd
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from services.statistical_analyzer import (
    StatisticalAnalyzer,
    StatisticalReport,
    CorrelationReport,
    ComparisonReport,
)

logger = logging.getLogger(__name__)
router = APIRouter(tags=["Statistical Analysis"])

analyzer = StatisticalAnalyzer()


# ============================================================================
# Request/Response Models
# ============================================================================

class StatisticalRequest(BaseModel):
    """Request for comprehensive statistical analysis"""
    data: List[Dict[str, Any]] = Field(..., description="Data rows")
    measures: Optional[List[str]] = Field(None, description="Numeric columns to analyze (auto-detect if empty)")
    dimensions: Optional[List[str]] = Field(None, description="Categorical columns for comparison")


class CorrelationRequest(BaseModel):
    """Request for correlation analysis"""
    data: List[Dict[str, Any]] = Field(..., description="Data rows")
    measures: Optional[List[str]] = Field(None, description="Numeric columns (auto-detect if empty)")


class StatisticalResponse(BaseModel):
    """Response for statistical analysis"""
    success: bool
    distributions: Dict[str, Any] = {}
    correlations: Dict[str, Any] = {}
    comparisons: Dict[str, Any] = {}
    outlier_summary: Dict[str, Any] = {}
    processing_time_ms: int = 0
    error: Optional[str] = None


class CorrelationResponse(BaseModel):
    """Response for correlation analysis"""
    success: bool
    correlation_matrix: Dict[str, Dict[str, float]] = {}
    strong_positive: List[Dict[str, Any]] = []
    strong_negative: List[Dict[str, Any]] = []
    top_correlation: Optional[Dict[str, Any]] = None
    chart_config: Optional[Dict[str, Any]] = None
    processing_time_ms: int = 0
    error: Optional[str] = None


# ============================================================================
# Endpoints
# ============================================================================

@router.post("/analyze", response_model=StatisticalResponse)
async def analyze(request: StatisticalRequest) -> StatisticalResponse:
    """
    Perform comprehensive statistical analysis on data.
    Returns distributions, correlations, comparisons, and outlier info.
    """
    start_time = time.time()

    try:
        df = pd.DataFrame(request.data)
        if df.empty:
            return StatisticalResponse(
                success=False,
                error="No data provided",
                processing_time_ms=int((time.time() - start_time) * 1000)
            )

        # Auto-detect numeric columns if not specified
        measures = request.measures
        if not measures:
            numeric_df = df.apply(pd.to_numeric, errors='coerce')
            measures = [c for c in numeric_df.columns if numeric_df[c].notna().sum() > df.shape[0] * 0.3]

        if not measures:
            return StatisticalResponse(
                success=False,
                error="No numeric columns found for analysis",
                processing_time_ms=int((time.time() - start_time) * 1000)
            )

        # Distribution analysis for each measure
        distributions = {}
        outlier_summary = {}
        for m in measures[:10]:  # Limit to 10 columns
            report = analyzer.analyze(df, m)
            distributions[m] = {
                "count": report.count,
                "mean": _safe_float(report.mean),
                "median": _safe_float(report.median),
                "std": _safe_float(report.std),
                "min": _safe_float(report.min_value),
                "max": _safe_float(report.max_value),
                "skewness": _safe_float(report.skewness),
                "kurtosis": _safe_float(report.kurtosis),
                "distribution_type": report.distribution_type,
                "is_normal": bool(report.is_normal),
                "normality_p_value": _safe_float(report.normality_p_value),
                "coefficient_of_variation": _safe_float(report.coefficient_of_variation),
                "percentiles": {k: _safe_float(v) for k, v in report.percentiles.items()},
                "cv": f"{_safe_float(report.coefficient_of_variation):.1f}%",
            }
            if report.outlier_count > 0:
                outlier_summary[m] = {
                    "count": int(report.outlier_count),
                    "values": [float(v) for v in report.outliers[:10]],
                }

        # Correlation analysis
        correlations = {}
        if len(measures) >= 2:
            corr_report = analyzer.analyze_correlations(df, measures)
            correlations = {
                "matrix": _sanitize_correlation_matrix(corr_report.correlation_matrix),
                "strong_positive": _sanitize_corr_pairs(corr_report.strong_positive),
                "strong_negative": _sanitize_corr_pairs(corr_report.strong_negative),
                "top_correlation": _sanitize_corr_pair(corr_report.top_correlation),
            }

        # Comparison analysis for first dimension
        comparisons = {}
        dimensions = request.dimensions
        if not dimensions:
            # Auto-detect: non-numeric columns with <= 50 unique values
            dimensions = [
                c for c in df.columns
                if c not in measures
                and df[c].nunique() <= 50
                and df[c].nunique() >= 2
            ]

        if dimensions and measures:
            dim = dimensions[0]
            measure = measures[0]
            comp_report = analyzer.compare_dimensions(df, dim, measure)
            comparisons[dim] = {
                "measure": measure,
                "top_3": _sanitize_dict_values(comp_report.top_3),
                "bottom_3": _sanitize_dict_values(comp_report.bottom_3),
                "cr3": _safe_float(comp_report.cr3),
                "cr5": _safe_float(comp_report.cr5),
                "gini_coefficient": _safe_float(comp_report.gini_coefficient),
                "pareto_count": int(comp_report.pareto_count),
                "pareto_ratio": _safe_float(comp_report.pareto_ratio),
                "total_items": int(comp_report.total_items),
            }

        return StatisticalResponse(
            success=True,
            distributions=distributions,
            correlations=correlations,
            comparisons=comparisons,
            outlier_summary=outlier_summary,
            processing_time_ms=int((time.time() - start_time) * 1000)
        )

    except Exception as e:
        logger.error(f"Statistical analysis failed: {e}", exc_info=True)
        return StatisticalResponse(
            success=False,
            error=str(e),
            processing_time_ms=int((time.time() - start_time) * 1000)
        )


@router.post("/correlations", response_model=CorrelationResponse)
async def correlations(request: CorrelationRequest) -> CorrelationResponse:
    """
    Analyze correlations between numeric columns.
    Returns correlation matrix + ECharts heatmap config.
    """
    start_time = time.time()

    try:
        df = pd.DataFrame(request.data)
        if df.empty:
            return CorrelationResponse(
                success=False,
                error="No data provided",
                processing_time_ms=int((time.time() - start_time) * 1000)
            )

        # Auto-detect numeric columns
        measures = request.measures
        if not measures:
            numeric_df = df.apply(pd.to_numeric, errors='coerce')
            measures = [c for c in numeric_df.columns if numeric_df[c].notna().sum() > df.shape[0] * 0.3]

        if len(measures) < 2:
            return CorrelationResponse(
                success=False,
                error="Need at least 2 numeric columns for correlation analysis",
                processing_time_ms=int((time.time() - start_time) * 1000)
            )

        # Limit to 15 columns for readable heatmap
        measures = measures[:15]

        corr_report = analyzer.analyze_correlations(df, measures)
        matrix = _sanitize_correlation_matrix(corr_report.correlation_matrix)

        # Build ECharts heatmap config
        chart_config = _build_heatmap_config(measures, matrix)

        return CorrelationResponse(
            success=True,
            correlation_matrix=matrix,
            strong_positive=_sanitize_corr_pairs(corr_report.strong_positive),
            strong_negative=_sanitize_corr_pairs(corr_report.strong_negative),
            top_correlation=_sanitize_corr_pair(corr_report.top_correlation),
            chart_config=chart_config,
            processing_time_ms=int((time.time() - start_time) * 1000)
        )

    except Exception as e:
        logger.error(f"Correlation analysis failed: {e}", exc_info=True)
        return CorrelationResponse(
            success=False,
            error=str(e),
            processing_time_ms=int((time.time() - start_time) * 1000)
        )


# ============================================================================
# Helper Functions
# ============================================================================

def _safe_float(val) -> float:
    """Convert to float, handling None/NaN/Inf"""
    if val is None:
        return 0.0
    try:
        f = float(val)
        if pd.isna(f) or f == float('inf') or f == float('-inf'):
            return 0.0
        return round(f, 4)
    except (ValueError, TypeError):
        return 0.0


def _sanitize_correlation_matrix(matrix: Dict[str, Dict[str, float]]) -> Dict[str, Dict[str, float]]:
    """Replace NaN/Inf in correlation matrix"""
    clean = {}
    for k1, row in matrix.items():
        clean[k1] = {}
        for k2, val in row.items():
            clean[k1][k2] = _safe_float(val)
    return clean


def _sanitize_dict_values(d: Dict[str, Any]) -> Dict[str, Any]:
    """Convert all numpy values in a dict to native Python types"""
    clean = {}
    for k, v in d.items():
        k = str(k)
        if isinstance(v, (int, float, str, bool)):
            clean[k] = v
        elif v is None:
            clean[k] = v
        else:
            try:
                f = float(v)
                clean[k] = 0.0 if (pd.isna(f) or f == float('inf') or f == float('-inf')) else round(f, 4)
            except (ValueError, TypeError):
                clean[k] = str(v)
    return clean


def _sanitize_corr_pair(pair: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    """Sanitize a single correlation pair dict, converting numpy types to native Python"""
    if pair is None:
        return None
    return {
        "var1": str(pair.get("var1", "")),
        "var2": str(pair.get("var2", "")),
        "correlation": _safe_float(pair.get("correlation")),
        "strength": str(pair.get("strength", "")),
    }


def _sanitize_corr_pairs(pairs: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Sanitize a list of correlation pair dicts"""
    return [_sanitize_corr_pair(p) for p in pairs if p is not None]


def _build_heatmap_config(measures: List[str], matrix: Dict[str, Dict[str, float]]) -> Dict[str, Any]:
    """Build ECharts heatmap configuration for correlation matrix"""
    # Build data array: [x_index, y_index, value]
    data = []
    for i, m1 in enumerate(measures):
        for j, m2 in enumerate(measures):
            val = matrix.get(m1, {}).get(m2, 0.0)
            data.append([i, j, round(val, 2)])

    return {
        "tooltip": {
            "position": "top",
            "formatter": None,  # Frontend will handle
        },
        "grid": {
            "left": "15%",
            "right": "10%",
            "bottom": "15%",
            "top": "5%",
            "containLabel": True,
        },
        "xAxis": {
            "type": "category",
            "data": measures,
            "splitArea": {"show": True},
            "axisLabel": {"rotate": 45, "fontSize": 10},
        },
        "yAxis": {
            "type": "category",
            "data": measures,
            "splitArea": {"show": True},
            "axisLabel": {"fontSize": 10},
        },
        "visualMap": {
            "min": -1,
            "max": 1,
            "calculable": True,
            "orient": "horizontal",
            "left": "center",
            "bottom": "0%",
            "inRange": {
                "color": ["#313695", "#4575b4", "#74add1", "#abd9e9",
                          "#e0f3f8", "#ffffbf", "#fee090", "#fdae61",
                          "#f46d43", "#d73027", "#a50026"]
            },
        },
        "series": [{
            "name": "相关系数",
            "type": "heatmap",
            "data": data,
            "label": {"show": True, "fontSize": 10},
            "emphasis": {
                "itemStyle": {"shadowBlur": 10, "shadowColor": "rgba(0, 0, 0, 0.5)"}
            },
        }],
    }
