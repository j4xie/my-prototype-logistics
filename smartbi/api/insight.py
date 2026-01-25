from __future__ import annotations
"""
Insight Generation API

Endpoints for AI-powered business insights.
"""
import logging
from typing import Any, Optional, List, Dict

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from services.insight_generator import InsightGenerator

logger = logging.getLogger(__name__)
router = APIRouter()

# Initialize service
insight_generator = InsightGenerator()


class InsightRequest(BaseModel):
    """Insight generation request model"""
    data: List[Dict[str, Any]]
    metrics: Optional[List[dict]] = None
    analysisContext: Optional[str] = None
    insightTypes: Optional[List[str]] = None
    maxInsights: int = 5


class Insight(BaseModel):
    """Single insight model"""
    type: str
    text: str
    metric: Optional[str] = None
    value: Optional[float] = None
    changeRate: Optional[float] = None
    sentiment: Optional[str] = None
    importance: Optional[float] = None
    recommendation: Optional[str] = None
    source: Optional[str] = None


class InsightResponse(BaseModel):
    """Insight generation response model"""
    success: bool
    insights: List[Insight] = []
    totalGenerated: Optional[int] = None
    method: Optional[str] = None
    message: Optional[str] = None
    error: Optional[str] = None


@router.post("/generate", response_model=InsightResponse)
async def generate_insights(request: InsightRequest):
    """
    Generate AI-powered business insights from data

    - **data**: Data records to analyze
    - **metrics**: Optional pre-calculated metrics (from /metrics/calculate)
    - **analysisContext**: Optional business context for better insights
    - **insightTypes**: Optional filter for insight types:
        - `trend`: Trend analysis insights
        - `anomaly`: Anomaly detection insights
        - `comparison`: Comparison insights
        - `forecast`: Forecast-based insights
        - `recommendation`: Actionable recommendations
        - `summary`: Summary statistics
    - **maxInsights**: Maximum number of insights to return (default: 5)

    Returns AI-generated business insights with importance scores.
    """
    try:
        if not request.data:
            raise HTTPException(status_code=400, detail="Data is required")

        result = await insight_generator.generate_insights(
            data=request.data,
            metrics=request.metrics,
            analysis_context=request.analysisContext,
            insight_types=request.insightTypes,
            max_insights=request.maxInsights
        )

        # Convert insights to Pydantic models
        insights = [Insight(**i) for i in result.get("insights", [])]

        return InsightResponse(
            success=result.get("success", False),
            insights=insights,
            totalGenerated=result.get("totalGenerated"),
            method=result.get("method"),
            message=result.get("message"),
            error=result.get("error")
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Insight generation error: {e}", exc_info=True)
        return InsightResponse(success=False, error=str(e))


@router.get("/types")
async def get_insight_types():
    """
    Get available insight types with descriptions
    """
    return {
        "insightTypes": [
            {
                "id": "trend",
                "name": "Trend Analysis",
                "description": "Identifies upward/downward trends in metrics",
                "icon": "trending_up"
            },
            {
                "id": "anomaly",
                "name": "Anomaly Detection",
                "description": "Detects unusual values or patterns",
                "icon": "warning"
            },
            {
                "id": "comparison",
                "name": "Comparison",
                "description": "Compares performance across dimensions",
                "icon": "compare"
            },
            {
                "id": "forecast",
                "name": "Forecast",
                "description": "Predictions based on historical data",
                "icon": "timeline"
            },
            {
                "id": "recommendation",
                "name": "Recommendation",
                "description": "Actionable suggestions for improvement",
                "icon": "lightbulb"
            },
            {
                "id": "summary",
                "name": "Summary",
                "description": "Key statistics and overview",
                "icon": "summarize"
            }
        ]
    }


@router.post("/analyze-metrics")
async def analyze_metrics(metrics: List[dict]):
    """
    Generate insights specifically from pre-calculated metrics

    - **metrics**: List of metric calculation results from /metrics/calculate

    This is a convenience endpoint when you only have metrics without raw data.
    """
    try:
        if not metrics:
            raise HTTPException(status_code=400, detail="Metrics are required")

        # Create minimal data structure for insight generation
        result = await insight_generator.generate_insights(
            data=[{}],  # Empty data placeholder
            metrics=metrics,
            analysis_context="Metrics-based analysis",
            max_insights=5
        )

        return InsightResponse(
            success=result.get("success", False),
            insights=[Insight(**i) for i in result.get("insights", [])],
            totalGenerated=result.get("totalGenerated"),
            method=result.get("method")
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Metrics analysis error: {e}", exc_info=True)
        return InsightResponse(success=False, error=str(e))


@router.post("/quick-summary")
async def quick_summary(data: List[Dict[str, Any]]):
    """
    Generate a quick summary of the data

    Returns basic statistical insights without LLM analysis.
    Faster than full insight generation.
    """
    try:
        if not data:
            raise HTTPException(status_code=400, detail="Data is required")

        import pandas as pd
        import numpy as np

        df = pd.DataFrame(data)

        summary = {
            "success": True,
            "rowCount": len(df),
            "columnCount": len(df.columns),
            "columns": []
        }

        for col in df.columns:
            col_info = {
                "name": col,
                "type": str(df[col].dtype),
                "nullCount": int(df[col].isna().sum()),
                "uniqueCount": int(df[col].nunique())
            }

            if pd.api.types.is_numeric_dtype(df[col]):
                col_info.update({
                    "min": float(df[col].min()) if pd.notna(df[col].min()) else None,
                    "max": float(df[col].max()) if pd.notna(df[col].max()) else None,
                    "mean": float(df[col].mean()) if pd.notna(df[col].mean()) else None,
                    "sum": float(df[col].sum()) if pd.notna(df[col].sum()) else None
                })

            summary["columns"].append(col_info)

        return summary

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Quick summary error: {e}", exc_info=True)
        return {"success": False, "error": str(e)}
