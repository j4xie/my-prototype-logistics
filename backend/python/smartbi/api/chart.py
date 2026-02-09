from __future__ import annotations
"""
Chart Building API

Endpoints for building ECharts configurations.
"""
import asyncio
import logging
from concurrent.futures import ThreadPoolExecutor
from typing import Any, Optional, List, Dict

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from services.chart_builder import ChartBuilder, _sanitize_for_json

logger = logging.getLogger(__name__)
router = APIRouter()

# Initialize service
chart_builder = ChartBuilder()
_chart_executor = ThreadPoolExecutor(max_workers=4)


class ChartBuildRequest(BaseModel):
    """Chart build request model"""
    chartType: str
    data: List[Dict[str, Any]]
    xField: Optional[str] = None
    yFields: Optional[List[str]] = None
    seriesField: Optional[str] = None
    title: Optional[str] = None
    subtitle: Optional[str] = None
    theme: str = "default"
    options: Optional[dict] = None


class ChartBuildResponse(BaseModel):
    """Chart build response model"""
    success: bool
    chartType: Optional[str] = None
    config: Optional[dict] = None
    anomalies: Optional[Dict[str, Any]] = None  # Phase 3.1: IQR anomaly detection
    error: Optional[str] = None


class ChartTypeInfo(BaseModel):
    """Chart type information"""
    id: str
    name: str
    description: str


@router.post("/build", response_model=ChartBuildResponse)
async def build_chart(request: ChartBuildRequest):
    """
    Build ECharts configuration from data

    - **chartType**: Type of chart to build:
        - `line`: Line chart for trends
        - `bar`: Bar chart for comparisons
        - `pie`: Pie chart for proportions
        - `area`: Area chart for cumulative trends
        - `scatter`: Scatter chart for correlations
        - `waterfall`: Waterfall chart for incremental changes
        - `radar`: Radar chart for multi-dimensional comparison
        - `funnel`: Funnel chart for conversion analysis
        - `gauge`: Gauge chart for KPI display
        - `heatmap`: Heatmap for distribution
        - `combination`: Combined bar and line chart
    - **data**: Data records
    - **xField**: Field name for X-axis
    - **yFields**: Field names for Y-axis values
    - **seriesField**: Field name for series grouping
    - **title**: Chart title
    - **subtitle**: Chart subtitle
    - **theme**: Color theme (default, dark)
    - **options**: Additional ECharts options to merge

    Returns complete ECharts configuration object.
    """
    try:
        if not request.data:
            raise HTTPException(status_code=400, detail="Data is required")

        result = chart_builder.build(
            chart_type=request.chartType,
            data=request.data,
            x_field=request.xField,
            y_fields=request.yFields,
            series_field=request.seriesField,
            title=request.title,
            subtitle=request.subtitle,
            theme=request.theme,
            options=request.options
        )

        sanitized = _sanitize_for_json(result)
        return ChartBuildResponse(
            success=sanitized.get("success", False),
            chartType=sanitized.get("chartType"),
            config=sanitized.get("config"),
            anomalies=sanitized.get("anomalies"),
            error=sanitized.get("error")
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Chart build error: {e}", exc_info=True)
        return ChartBuildResponse(success=False, error=str(e))


@router.get("/types", response_model=List[ChartTypeInfo])
async def get_chart_types():
    """
    Get available chart types with descriptions
    """
    types = chart_builder.get_available_chart_types()
    return [ChartTypeInfo(**t) for t in types]


@router.post("/preview")
async def preview_chart(request: ChartBuildRequest):
    """
    Build chart configuration with sample data for preview

    Same as /build but includes additional preview information.
    """
    try:
        result = chart_builder.build(
            chart_type=request.chartType,
            data=request.data,
            x_field=request.xField,
            y_fields=request.yFields,
            series_field=request.seriesField,
            title=request.title,
            subtitle=request.subtitle,
            theme=request.theme,
            options=request.options
        )

        if result.get("success"):
            # Add preview metadata
            result["preview"] = {
                "dataPoints": len(request.data),
                "xField": request.xField,
                "yFields": request.yFields,
                "seriesField": request.seriesField
            }

        return result

    except Exception as e:
        logger.error(f"Chart preview error: {e}", exc_info=True)
        return {"success": False, "error": str(e)}


@router.post("/batch")
async def batch_build(requests: List[ChartBuildRequest]):
    """
    Build multiple chart configurations in batch

    Useful for dashboard generation with multiple charts.
    """
    try:
        loop = asyncio.get_event_loop()
        tasks = [
            loop.run_in_executor(_chart_executor, lambda req=req: chart_builder.build(
                chart_type=req.chartType,
                data=req.data,
                x_field=req.xField,
                y_fields=req.yFields,
                series_field=req.seriesField,
                title=req.title,
                subtitle=req.subtitle,
                theme=req.theme,
                options=req.options
            ))
            for req in requests
        ]
        results = await asyncio.gather(*tasks)
        results = list(results)

        return _sanitize_for_json({
            "success": True,
            "charts": results,
            "totalCharts": len(results)
        })

    except Exception as e:
        logger.error(f"Batch chart build error: {e}", exc_info=True)
        return {"success": False, "error": str(e)}


@router.get("/themes")
async def get_themes():
    """
    Get available chart themes
    """
    return {
        "themes": [
            {
                "id": "business",
                "name": "Business Blue",
                "description": "Professional business theme (Tableau + Power BI inspired)",
                "colors": ChartBuilder.THEME_PALETTES["business"]["charts"]
            },
            {
                "id": "dark",
                "name": "Dark",
                "description": "Dark mode theme",
                "colors": ["#4992ff", "#7cffb2", "#fddd60", "#ff6e76", "#58d9f9"]
            },
            {
                "id": "vintage",
                "name": "Vintage",
                "description": "Vintage color palette",
                "colors": ["#d87c7c", "#919e8b", "#d7ab82", "#6e7074", "#61a0a8"]
            }
        ]
    }


@router.post("/recommend")
async def recommend_chart(data: List[Dict[str, Any]], fields: Optional[List[dict]] = None):
    """
    Recommend best chart type based on data characteristics

    - **data**: Data records
    - **fields**: Optional field detection results from /field/detect

    Returns recommended chart types with reasons.
    """
    try:
        import pandas as pd

        df = pd.DataFrame(data)
        recommendations = []

        # Analyze data characteristics
        numeric_cols = df.select_dtypes(include=['number']).columns.tolist()
        categorical_cols = df.select_dtypes(include=['object', 'category']).columns.tolist()
        date_cols = []

        # Try to detect date columns
        for col in df.columns:
            try:
                pd.to_datetime(df[col])
                date_cols.append(col)
            except:
                pass

        # Recommend based on data structure
        if date_cols and numeric_cols:
            recommendations.append({
                "chartType": "line",
                "reason": "Time series data detected - line chart shows trends over time",
                "xField": date_cols[0],
                "yFields": numeric_cols[:3],
                "priority": 1
            })

        if categorical_cols and numeric_cols:
            recommendations.append({
                "chartType": "bar",
                "reason": "Categorical data detected - bar chart compares values across categories",
                "xField": categorical_cols[0],
                "yFields": [numeric_cols[0]],
                "priority": 2
            })

            if len(df[categorical_cols[0]].unique()) <= 8:
                recommendations.append({
                    "chartType": "pie",
                    "reason": "Low cardinality categorical data - pie chart shows proportions",
                    "xField": categorical_cols[0],
                    "yFields": [numeric_cols[0]],
                    "priority": 3
                })

        if len(numeric_cols) >= 2:
            recommendations.append({
                "chartType": "scatter",
                "reason": "Multiple numeric columns - scatter chart shows correlations",
                "xField": numeric_cols[0],
                "yFields": [numeric_cols[1]],
                "priority": 4
            })

        if len(numeric_cols) >= 3:
            recommendations.append({
                "chartType": "radar",
                "reason": "Multiple metrics - radar chart compares across dimensions",
                "yFields": numeric_cols[:6],
                "priority": 5
            })

        return {
            "success": True,
            "recommendations": sorted(recommendations, key=lambda x: x["priority"]),
            "dataInfo": {
                "rowCount": len(df),
                "numericColumns": numeric_cols,
                "categoricalColumns": categorical_cols,
                "dateColumns": date_cols
            }
        }

    except Exception as e:
        logger.error(f"Chart recommendation error: {e}", exc_info=True)
        return {"success": False, "error": str(e)}
