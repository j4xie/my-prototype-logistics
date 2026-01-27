from __future__ import annotations
"""
Chat API for SmartBI

Provides endpoints for AI-powered conversational analysis:
- Drill-down analysis
- Industry benchmarking
- Root cause analysis
- General queries

These endpoints are called by the Java backend's SmartBIIntentService.

Part of SmartBI Phase 6: AI Chat Deep Integration.
"""
import logging
import time
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

# Services
from ..services.cross_analyzer import CrossAnalyzer, DrillDownResult
from ..services.industry_benchmark import (
    IndustryBenchmark,
    IndustryCategory,
    BenchmarkResult
)
from ..services.insight_dimensions import (
    InsightDimensionAnalyzer,
    InsightDimension,
    InsightReport
)
from ..services.insight_generator import InsightGenerator

logger = logging.getLogger(__name__)
router = APIRouter(tags=["Chat"])


# ============================================================================
# Request/Response Models
# ============================================================================

class DrillDownRequest(BaseModel):
    """Request for drill-down analysis"""
    sheet_id: str = Field(..., description="Sheet identifier")
    dimension: str = Field(..., description="Dimension to drill down on")
    filter_value: Optional[str] = Field(None, description="Value to filter on")
    measures: List[str] = Field(default=["amount", "revenue", "profit"], description="Measures to aggregate")
    aggregation: str = Field(default="sum", description="Aggregation method")
    data: Optional[List[Dict[str, Any]]] = Field(None, description="Data to analyze (if not from cache)")


class DrillDownResponse(BaseModel):
    """Response for drill-down analysis"""
    success: bool
    error: Optional[str] = None
    result: Optional[Dict[str, Any]] = None
    chart_config: Optional[Dict[str, Any]] = None
    processing_time_ms: int = 0


class BenchmarkRequest(BaseModel):
    """Request for industry benchmark comparison"""
    sheet_id: str = Field(..., description="Sheet identifier")
    industry: str = Field(..., description="Industry for comparison (food_processing, retail, etc.)")
    metrics: Dict[str, float] = Field(..., description="Company metrics to compare")
    metric_mapping: Optional[Dict[str, str]] = Field(None, description="Optional metric name mapping")


class BenchmarkResponse(BaseModel):
    """Response for benchmark comparison"""
    success: bool
    error: Optional[str] = None
    result: Optional[Dict[str, Any]] = None
    sources: List[str] = []
    processing_time_ms: int = 0


class RootCauseRequest(BaseModel):
    """Request for root cause analysis"""
    sheet_id: str = Field(..., description="Sheet identifier")
    kpi: str = Field(..., description="KPI to analyze")
    threshold: float = Field(default=0.1, description="Significance threshold")
    data: Optional[List[Dict[str, Any]]] = Field(None, description="Data to analyze")


class RootCauseResponse(BaseModel):
    """Response for root cause analysis"""
    success: bool
    error: Optional[str] = None
    kpi: str = ""
    root_causes: List[Dict[str, Any]] = []
    correlations: List[Dict[str, Any]] = []
    recommendations: List[str] = []
    processing_time_ms: int = 0


class GeneralAnalysisRequest(BaseModel):
    """Request for general analysis"""
    sheet_id: str = Field(..., description="Sheet identifier")
    query: str = Field(..., description="Analysis query/question")
    data: Optional[List[Dict[str, Any]]] = Field(None, description="Data to analyze")
    context: Optional[Dict[str, Any]] = Field(None, description="Additional context")


class GeneralAnalysisResponse(BaseModel):
    """Response for general analysis"""
    success: bool
    error: Optional[str] = None
    answer: str = ""
    insights: List[Dict[str, Any]] = []
    charts: List[Dict[str, Any]] = []
    processing_time_ms: int = 0


class MultiDimensionRequest(BaseModel):
    """Request for multi-dimensional insight analysis"""
    sheet_id: str = Field(..., description="Sheet identifier")
    data: List[Dict[str, Any]] = Field(..., description="Data to analyze")
    dimensions: Optional[List[str]] = Field(None, description="Insight dimensions to focus on")
    context: Optional[Dict[str, Any]] = Field(None, description="Analysis context")


class MultiDimensionResponse(BaseModel):
    """Response for multi-dimensional analysis"""
    success: bool
    error: Optional[str] = None
    executive_summary: str = ""
    insights: List[Dict[str, Any]] = []
    risk_alerts: List[Dict[str, Any]] = []
    opportunities: List[Dict[str, Any]] = []
    processing_time_ms: int = 0


# ============================================================================
# Data Store (In-memory cache for demo, replace with proper storage)
# ============================================================================

_sheet_data_cache: Dict[str, List[Dict[str, Any]]] = {}


def get_sheet_data(sheet_id: str) -> Optional[List[Dict[str, Any]]]:
    """Get cached sheet data"""
    return _sheet_data_cache.get(sheet_id)


def cache_sheet_data(sheet_id: str, data: List[Dict[str, Any]]):
    """Cache sheet data"""
    _sheet_data_cache[sheet_id] = data


# ============================================================================
# Endpoints
# ============================================================================

@router.post("/drill-down", response_model=DrillDownResponse)
async def drill_down(request: DrillDownRequest) -> DrillDownResponse:
    """
    Perform drill-down analysis on a dimension.

    Called by Java when user asks questions like:
    - "按区域拆分看看"
    - "华东区具体怎么样"
    - "深入分析产品类别"

    Args:
        request: DrillDownRequest with dimension and filter parameters

    Returns:
        DrillDownResponse with detailed breakdown and chart config
    """
    start_time = time.time()

    try:
        # Get data from request or cache
        data = request.data
        if not data:
            data = get_sheet_data(request.sheet_id)

        if not data:
            return DrillDownResponse(
                success=False,
                error=f"No data found for sheet {request.sheet_id}",
                processing_time_ms=int((time.time() - start_time) * 1000)
            )

        # Convert to DataFrame for analysis
        import pandas as pd
        df = pd.DataFrame(data)

        # Validate dimension exists
        if request.dimension not in df.columns:
            available = df.columns.tolist()
            return DrillDownResponse(
                success=False,
                error=f"Dimension '{request.dimension}' not found. Available: {available}",
                processing_time_ms=int((time.time() - start_time) * 1000)
            )

        # Find valid measures
        valid_measures = [m for m in request.measures if m in df.columns]
        if not valid_measures:
            # Use all numeric columns as measures
            valid_measures = df.select_dtypes(include=['number']).columns.tolist()

        if not valid_measures:
            return DrillDownResponse(
                success=False,
                error="No numeric measures found for analysis",
                processing_time_ms=int((time.time() - start_time) * 1000)
            )

        # Perform drill-down
        analyzer = CrossAnalyzer()

        if request.filter_value:
            # Filter on parent value and break down by dimension
            result = await analyzer.drill_down(
                df=df,
                parent_dimension=request.dimension,
                parent_value=request.filter_value,
                child_dimension=request.dimension,  # Same dimension, filtered
                measures=valid_measures,
                aggregation=request.aggregation
            )
        else:
            # Simple aggregation by dimension
            agg_funcs = {m: request.aggregation for m in valid_measures}
            grouped = df.groupby(request.dimension).agg(agg_funcs).reset_index()

            if valid_measures:
                grouped = grouped.sort_values(valid_measures[0], ascending=False)

            result = DrillDownResult(
                success=True,
                parent_dimension="all",
                parent_value="*",
                child_dimension=request.dimension,
                data=grouped.to_dict(orient="records"),
                summary={
                    "dimension": request.dimension,
                    "unique_values": len(grouped),
                    "total_records": len(df),
                    "measure_totals": {m: grouped[m].sum() for m in valid_measures}
                }
            )

            # Generate chart config
            result.chart_config = _generate_bar_chart_config(
                request.dimension, valid_measures, grouped
            )

        return DrillDownResponse(
            success=result.success,
            error=result.error,
            result=result.to_dict() if result.success else None,
            chart_config=result.chart_config,
            processing_time_ms=int((time.time() - start_time) * 1000)
        )

    except Exception as e:
        logger.error(f"Drill-down failed: {e}", exc_info=True)
        return DrillDownResponse(
            success=False,
            error=str(e),
            processing_time_ms=int((time.time() - start_time) * 1000)
        )


@router.post("/benchmark", response_model=BenchmarkResponse)
async def benchmark(request: BenchmarkRequest) -> BenchmarkResponse:
    """
    Compare metrics with industry benchmarks.

    Called by Java when user asks questions like:
    - "跟行业比怎么样"
    - "我们的毛利率在行业什么水平"
    - "对标同行业"

    Args:
        request: BenchmarkRequest with industry and metrics

    Returns:
        BenchmarkResponse with comparison results and recommendations
    """
    start_time = time.time()

    try:
        # Map industry string to enum
        industry_map = {
            "food_processing": IndustryCategory.FOOD_PROCESSING,
            "food": IndustryCategory.FOOD_PROCESSING,
            "食品加工": IndustryCategory.FOOD_PROCESSING,
            "食品": IndustryCategory.FOOD_PROCESSING,
            "retail": IndustryCategory.RETAIL,
            "零售": IndustryCategory.RETAIL,
            "manufacturing": IndustryCategory.MANUFACTURING,
            "制造": IndustryCategory.MANUFACTURING
        }

        industry_enum = industry_map.get(
            request.industry.lower(),
            IndustryCategory.FOOD_PROCESSING
        )

        # Perform benchmark comparison
        benchmark_service = IndustryBenchmark()
        result = await benchmark_service.compare_with_industry(
            company_metrics=request.metrics,
            industry=industry_enum,
            metric_mapping=request.metric_mapping
        )

        return BenchmarkResponse(
            success=result.success,
            error=result.error,
            result=result.to_dict() if result.success else None,
            sources=result.data_sources,
            processing_time_ms=int((time.time() - start_time) * 1000)
        )

    except Exception as e:
        logger.error(f"Benchmark failed: {e}", exc_info=True)
        return BenchmarkResponse(
            success=False,
            error=str(e),
            processing_time_ms=int((time.time() - start_time) * 1000)
        )


@router.post("/root-cause", response_model=RootCauseResponse)
async def root_cause(request: RootCauseRequest) -> RootCauseResponse:
    """
    Analyze root causes for a KPI change.

    Called by Java when user asks questions like:
    - "为什么利润下降"
    - "分析销售额下滑原因"
    - "利润率降低的原因是什么"

    Args:
        request: RootCauseRequest with KPI and threshold

    Returns:
        RootCauseResponse with identified causes and recommendations
    """
    start_time = time.time()

    try:
        # Get data
        data = request.data
        if not data:
            data = get_sheet_data(request.sheet_id)

        if not data:
            return RootCauseResponse(
                success=False,
                error=f"No data found for sheet {request.sheet_id}",
                kpi=request.kpi,
                processing_time_ms=int((time.time() - start_time) * 1000)
            )

        import pandas as pd
        df = pd.DataFrame(data)

        # Validate KPI exists
        if request.kpi not in df.columns:
            return RootCauseResponse(
                success=False,
                error=f"KPI '{request.kpi}' not found in data",
                kpi=request.kpi,
                processing_time_ms=int((time.time() - start_time) * 1000)
            )

        # Perform correlation analysis
        numeric_cols = df.select_dtypes(include=['number']).columns.tolist()
        other_cols = [c for c in numeric_cols if c != request.kpi]

        correlations = []
        root_causes = []

        if other_cols:
            # Calculate correlations with KPI
            kpi_values = df[request.kpi]

            for col in other_cols:
                try:
                    corr = kpi_values.corr(df[col])
                    if abs(corr) > request.threshold:
                        correlations.append({
                            "factor": col,
                            "correlation": round(corr, 3),
                            "relationship": "正相关" if corr > 0 else "负相关",
                            "strength": "强" if abs(corr) > 0.7 else "中等" if abs(corr) > 0.4 else "弱"
                        })
                except Exception:
                    continue

            # Sort by correlation strength
            correlations.sort(key=lambda x: abs(x["correlation"]), reverse=True)

            # Convert top correlations to root causes
            for i, corr in enumerate(correlations[:3]):
                direction = "同向变化" if corr["correlation"] > 0 else "反向变化"
                root_causes.append({
                    "rank": i + 1,
                    "factor": corr["factor"],
                    "description": f"{corr['factor']}与{request.kpi}{direction}，相关系数{corr['correlation']:.2f}",
                    "impact": corr["strength"],
                    "correlation": corr["correlation"]
                })

        # Generate recommendations
        recommendations = []
        if root_causes:
            for cause in root_causes[:2]:
                if cause["correlation"] < 0:
                    recommendations.append(f"关注{cause['factor']}的变化，其与{request.kpi}呈负相关")
                else:
                    recommendations.append(f"提升{cause['factor']}可能带动{request.kpi}增长")

        if not recommendations:
            recommendations.append(f"建议进一步收集数据分析{request.kpi}变化原因")

        return RootCauseResponse(
            success=True,
            kpi=request.kpi,
            root_causes=root_causes,
            correlations=correlations,
            recommendations=recommendations,
            processing_time_ms=int((time.time() - start_time) * 1000)
        )

    except Exception as e:
        logger.error(f"Root cause analysis failed: {e}", exc_info=True)
        return RootCauseResponse(
            success=False,
            error=str(e),
            kpi=request.kpi,
            processing_time_ms=int((time.time() - start_time) * 1000)
        )


@router.post("/general-analysis", response_model=GeneralAnalysisResponse)
async def general_analysis(request: GeneralAnalysisRequest) -> GeneralAnalysisResponse:
    """
    Perform general analysis based on query.

    Called by Java for general questions about the data.

    Args:
        request: GeneralAnalysisRequest with query and data

    Returns:
        GeneralAnalysisResponse with analysis results
    """
    start_time = time.time()

    try:
        # Get data
        data = request.data
        if not data:
            data = get_sheet_data(request.sheet_id)

        if not data:
            return GeneralAnalysisResponse(
                success=False,
                error=f"No data found for sheet {request.sheet_id}",
                processing_time_ms=int((time.time() - start_time) * 1000)
            )

        import pandas as pd
        df = pd.DataFrame(data)

        # Use insight generator for analysis
        insight_gen = InsightGenerator()
        insights_result = await insight_gen.generate_insights(
            df,
            context=request.context,
            query=request.query
        )

        # Format response
        answer = insights_result.get("summary", "数据分析完成。")
        insights = insights_result.get("insights", [])

        # Generate charts based on query type
        charts = []
        if "趋势" in request.query or "变化" in request.query:
            # Suggest trend chart
            numeric_cols = df.select_dtypes(include=['number']).columns.tolist()
            if numeric_cols:
                charts.append({
                    "type": "line",
                    "title": f"{numeric_cols[0]}趋势",
                    "data": df[numeric_cols[0]].tolist()
                })

        if "对比" in request.query or "比较" in request.query:
            # Suggest comparison chart
            charts.append({"type": "bar", "title": "对比分析"})

        return GeneralAnalysisResponse(
            success=True,
            answer=answer,
            insights=insights,
            charts=charts,
            processing_time_ms=int((time.time() - start_time) * 1000)
        )

    except Exception as e:
        logger.error(f"General analysis failed: {e}", exc_info=True)
        return GeneralAnalysisResponse(
            success=False,
            error=str(e),
            processing_time_ms=int((time.time() - start_time) * 1000)
        )


@router.post("/multi-dimension", response_model=MultiDimensionResponse)
async def multi_dimension_analysis(
    request: MultiDimensionRequest
) -> MultiDimensionResponse:
    """
    Perform multi-dimensional insight analysis.

    Generates insights across multiple dimensions:
    - What happened (descriptive)
    - Why it happened (diagnostic)
    - What will happen (predictive)
    - What to do (prescriptive)

    Args:
        request: MultiDimensionRequest with data and optional dimensions

    Returns:
        MultiDimensionResponse with comprehensive insights
    """
    start_time = time.time()

    try:
        import pandas as pd
        df = pd.DataFrame(request.data)

        # Parse dimensions
        focus_dims = None
        if request.dimensions:
            focus_dims = []
            dim_map = {
                "what_happened": InsightDimension.WHAT_HAPPENED,
                "why_happened": InsightDimension.WHY_HAPPENED,
                "forecast": InsightDimension.FORECAST,
                "recommendation": InsightDimension.RECOMMENDATION,
                "anomaly": InsightDimension.ANOMALY
            }
            for d in request.dimensions:
                if d in dim_map:
                    focus_dims.append(dim_map[d])

        # Perform analysis
        analyzer = InsightDimensionAnalyzer()
        report: InsightReport = analyzer.analyze(
            df,
            context=request.context,
            focus_dimensions=focus_dims
        )

        return MultiDimensionResponse(
            success=True,
            executive_summary=report.executive_summary,
            insights=[i.to_dict() for i in report.insights],
            risk_alerts=[i.to_dict() for i in report.risk_alerts],
            opportunities=[i.to_dict() for i in report.opportunities],
            processing_time_ms=int((time.time() - start_time) * 1000)
        )

    except Exception as e:
        logger.error(f"Multi-dimension analysis failed: {e}", exc_info=True)
        return MultiDimensionResponse(
            success=False,
            error=str(e),
            processing_time_ms=int((time.time() - start_time) * 1000)
        )


@router.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "service": "smartbi-chat"}


# ============================================================================
# Helper Functions
# ============================================================================

def _generate_bar_chart_config(
    dimension: str,
    measures: List[str],
    data: 'pd.DataFrame'
) -> Dict[str, Any]:
    """Generate bar chart configuration for drill-down results"""

    # Determine chart orientation based on data size
    chart_type = "bar" if len(data) <= 10 else "bar_horizontal"

    series = []
    for measure in measures:
        if measure in data.columns:
            series.append({
                "name": measure,
                "type": "bar",
                "data": data[measure].tolist()
            })

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
        "series": series,
        "tooltip": {
            "trigger": "axis"
        }
    }
