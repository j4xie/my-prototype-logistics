from __future__ import annotations
"""
Chart Building API

Endpoints for building ECharts configurations and LLM-based chart recommendations.
"""
import logging
from typing import Any, Optional, List, Dict

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from services.chart_builder import ChartBuilder
from services.chart_recommender import (
    ChartRecommender,
    ChartRecommendation,
    DataSummary,
    get_chart_recommender
)
from services.analysis_persistence import get_persistence_service

logger = logging.getLogger(__name__)
router = APIRouter()

# Initialize services
chart_builder = ChartBuilder()
chart_recommender = get_chart_recommender()


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

        return ChartBuildResponse(**result)

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
        results = []
        for req in requests:
            result = chart_builder.build(
                chart_type=req.chartType,
                data=req.data,
                x_field=req.xField,
                y_fields=req.yFields,
                series_field=req.seriesField,
                title=req.title,
                subtitle=req.subtitle,
                theme=req.theme,
                options=req.options
            )
            results.append(result)

        return {
            "success": True,
            "charts": results,
            "totalCharts": len(results)
        }

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
                "id": "default",
                "name": "Default",
                "description": "Standard light theme",
                "colors": ["#5470c6", "#91cc75", "#fac858", "#ee6666", "#73c0de"]
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


# ============================================
# LLM-based Chart Recommender Endpoints
# ============================================

class ColumnFeature(BaseModel):
    """Column feature for recommendation"""
    columnName: str = Field(..., description="Column name")
    dataType: str = Field(..., description="Data type: DATE, NUMERIC, CATEGORICAL, ID, TEXT")
    numericSubType: Optional[str] = Field(None, description="For NUMERIC: AMOUNT, PERCENTAGE, QUANTITY, GENERAL")
    sampleValues: Optional[List[Any]] = Field(default=[], description="Sample values from column")
    uniqueCount: Optional[int] = Field(None, description="Number of unique values")
    minValue: Optional[float] = Field(None, description="Minimum value for numeric columns")
    maxValue: Optional[float] = Field(None, description="Maximum value for numeric columns")


class LLMRecommendRequest(BaseModel):
    """Request model for LLM-based chart recommendation"""
    columns: List[ColumnFeature] = Field(..., description="List of column features")
    rowCount: int = Field(0, description="Number of data rows")
    dimensions: Optional[List[str]] = Field(default=[], description="Dimension field names")
    measures: Optional[List[str]] = Field(default=[], description="Measure field names")
    timeColumns: Optional[List[str]] = Field(default=[], description="Time dimension field names")
    categoryColumns: Optional[List[str]] = Field(default=[], description="Category dimension field names")
    scenario: str = Field("general", description="Business scenario: sales, finance, marketing, operations, hr, general")
    userIntent: Optional[str] = Field(None, description="User's analysis intent or question")
    maxRecommendations: int = Field(5, description="Maximum number of recommendations")
    # Persistence parameters
    factoryId: Optional[str] = Field(None, description="Factory ID for persisting results")
    uploadId: Optional[int] = Field(None, description="Upload ID for persisting results")
    sheetName: Optional[str] = Field(None, description="Sheet name for context")


class LLMRecommendResponse(BaseModel):
    """Response model for LLM-based chart recommendation"""
    success: bool
    recommendations: List[Dict[str, Any]]
    method: str = Field(..., description="Recommendation method: llm or fallback")
    message: Optional[str] = None


class DashboardRecommendRequest(BaseModel):
    """Request model for dashboard chart combination recommendation"""
    columns: List[ColumnFeature]
    rowCount: int = 0
    dimensions: Optional[List[str]] = []
    measures: Optional[List[str]] = []
    timeColumns: Optional[List[str]] = []
    categoryColumns: Optional[List[str]] = []
    scenario: str = "general"
    layout: str = Field("2x2", description="Dashboard layout: 2x2, 1+3, 3x2")


class QuestionRecommendRequest(BaseModel):
    """Request model for question-based chart recommendation"""
    question: str = Field(..., description="Natural language analysis question")
    columns: List[ColumnFeature]
    rowCount: int = 0
    dimensions: Optional[List[str]] = []
    measures: Optional[List[str]] = []
    timeColumns: Optional[List[str]] = []
    categoryColumns: Optional[List[str]] = []
    scenario: str = "general"


@router.post("/recommend/llm", response_model=LLMRecommendResponse)
async def llm_recommend_chart(request: LLMRecommendRequest):
    """
    LLM-based intelligent chart recommendation.

    Uses LLM to analyze data features and business context to recommend
    the most suitable chart types. Does not use hardcoded rule mappings.

    - **columns**: List of column features with data types and statistics
    - **rowCount**: Number of data rows
    - **dimensions**: Identified dimension field names
    - **measures**: Identified measure field names
    - **timeColumns**: Time-related field names
    - **categoryColumns**: Categorical field names
    - **scenario**: Business scenario for context
    - **userIntent**: Optional user intent or analysis question
    - **maxRecommendations**: Maximum recommendations to return
    - **factoryId**: Factory ID for persisting results (optional)
    - **uploadId**: Upload ID for persisting results (optional)
    - **sheetName**: Sheet name for context (optional)

    Returns prioritized list of chart recommendations with reasons.
    Results are automatically persisted to database when factoryId and uploadId are provided.
    """
    try:
        # Convert to internal DataSummary format
        data_summary = DataSummary(
            columns=[col.dict() for col in request.columns],
            row_count=request.rowCount,
            dimensions=request.dimensions or [],
            measures=request.measures or [],
            time_columns=request.timeColumns or [],
            category_columns=request.categoryColumns or []
        )

        recommendations = await chart_recommender.recommend(
            data_summary=data_summary,
            scenario=request.scenario,
            user_intent=request.userIntent,
            max_recommendations=request.maxRecommendations
        )

        # Convert to dict format
        recommendation_dicts = [r.to_dict() for r in recommendations]

        # Persist to database if factory_id and upload_id are provided
        if request.factoryId and request.uploadId and recommendation_dicts:
            persistence_service = get_persistence_service()
            persistence_service.save_chart_configs(
                factory_id=request.factoryId,
                upload_id=request.uploadId,
                sheet_name=request.sheetName,
                chart_configs=recommendation_dicts,
                request_params={
                    "scenario": request.scenario,
                    "userIntent": request.userIntent,
                    "rowCount": request.rowCount,
                    "columnCount": len(request.columns)
                }
            )
            logger.info(f"Persisted {len(recommendation_dicts)} chart configs for factory={request.factoryId}, upload={request.uploadId}")

        return LLMRecommendResponse(
            success=True,
            recommendations=recommendation_dicts,
            method="llm" if recommendations else "fallback"
        )

    except Exception as e:
        logger.error(f"LLM chart recommendation error: {e}", exc_info=True)
        return LLMRecommendResponse(
            success=False,
            recommendations=[],
            method="error",
            message=str(e)
        )


@router.post("/recommend/question")
async def recommend_by_question(request: QuestionRecommendRequest):
    """
    Recommend charts based on a natural language question.

    - **question**: User's analysis question (e.g., "Show me sales trends by region")
    - **columns**: Available data columns
    - **scenario**: Business context

    Returns chart recommendations tailored to answer the question.
    """
    try:
        data_summary = DataSummary(
            columns=[col.dict() for col in request.columns],
            row_count=request.rowCount,
            dimensions=request.dimensions or [],
            measures=request.measures or [],
            time_columns=request.timeColumns or [],
            category_columns=request.categoryColumns or []
        )

        recommendations = await chart_recommender.recommend_for_question(
            question=request.question,
            data_summary=data_summary,
            scenario=request.scenario
        )

        return {
            "success": True,
            "question": request.question,
            "recommendations": [r.to_dict() for r in recommendations],
            "method": "llm"
        }

    except Exception as e:
        logger.error(f"Question-based recommendation error: {e}", exc_info=True)
        return {"success": False, "error": str(e)}


@router.post("/recommend/dashboard")
async def recommend_dashboard(request: DashboardRecommendRequest):
    """
    Recommend a combination of charts for a dashboard layout.

    - **columns**: Available data columns
    - **layout**: Dashboard layout type:
        - `2x2`: 2x2 grid (4 charts)
        - `1+3`: 1 large + 3 small
        - `3x2`: 3x2 grid (6 charts)
    - **scenario**: Business context

    Returns complementary chart combination optimized for the layout.
    """
    try:
        data_summary = DataSummary(
            columns=[col.dict() for col in request.columns],
            row_count=request.rowCount,
            dimensions=request.dimensions or [],
            measures=request.measures or [],
            time_columns=request.timeColumns or [],
            category_columns=request.categoryColumns or []
        )

        result = await chart_recommender.recommend_combination(
            data_summary=data_summary,
            scenario=request.scenario,
            dashboard_layout=request.layout
        )

        return result

    except Exception as e:
        logger.error(f"Dashboard recommendation error: {e}", exc_info=True)
        return {"success": False, "error": str(e)}


@router.get("/recommend/chart-types")
async def get_llm_chart_types():
    """
    Get all chart types with detailed descriptions for LLM recommendations.

    Returns comprehensive information about each chart type including:
    - Name and description
    - Best use cases
    - Required fields
    - Constraints
    """
    return {
        "success": True,
        "chartTypes": chart_recommender.list_chart_types()
    }


@router.get("/recommend/scenarios")
async def get_recommendation_scenarios():
    """
    Get available business scenarios for chart recommendation context.
    """
    return {
        "success": True,
        "scenarios": [
            {"id": "sales", "name": "Sales Analysis", "description": "Revenue, orders, customers, products, regions"},
            {"id": "finance", "name": "Finance Analysis", "description": "Profit, cost, budget, cash flow"},
            {"id": "marketing", "name": "Marketing Analysis", "description": "Conversion, acquisition, ROI, channels"},
            {"id": "operations", "name": "Operations Analysis", "description": "Efficiency, capacity, inventory, turnover"},
            {"id": "hr", "name": "HR Analysis", "description": "Personnel, performance, cost, turnover"},
            {"id": "general", "name": "General Analysis", "description": "Data exploration and trend analysis"}
        ]
    }
