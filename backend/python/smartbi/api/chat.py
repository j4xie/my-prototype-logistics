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
from services.cross_analyzer import CrossAnalyzer, DrillDownResult, DimensionHierarchy
from services.industry_benchmark import (
    IndustryBenchmark,
    IndustryCategory,
    BenchmarkResult
)
from services.insight_dimensions import (
    InsightDimensionAnalyzer,
    InsightDimension,
    InsightReport
)
from services.insight_generator import InsightGenerator

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
    # P4: Multi-level drill-down fields
    hierarchy_type: Optional[str] = Field(None, description="Hierarchy type: time, geography, organization, product")
    current_level: Optional[int] = Field(None, description="Current level index in hierarchy")
    breadcrumb: Optional[List[Dict[str, str]]] = Field(default=None, description="Breadcrumb trail")


class DrillDownResponse(BaseModel):
    """Response for drill-down analysis"""
    success: bool
    error: Optional[str] = None
    result: Optional[Dict[str, Any]] = None
    chart_config: Optional[Dict[str, Any]] = None
    processing_time_ms: int = 0
    # P4: Multi-level drill-down fields
    available_dimensions: List[str] = []
    hierarchy: Optional[Dict[str, Any]] = None
    breadcrumb: List[Dict[str, str]] = []
    current_level: Optional[int] = None
    max_level: Optional[int] = None


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
    """Request for general analysis (accepts both Python and Java field names)"""
    sheet_id: Optional[str] = Field(None, description="Sheet identifier (optional for standalone queries)")
    query: Optional[str] = Field(None, description="Analysis query/question")
    message: Optional[str] = Field(None, description="Alias for query (Java compat)")
    data: Optional[List[Dict[str, Any]]] = Field(None, description="Data to analyze")
    context: Optional[Dict[str, Any]] = Field(None, description="Additional context")
    fields: Optional[List[Dict[str, str]]] = Field(None, description="Field mappings")
    table_type: Optional[str] = Field(None, description="Table type hint")
    user_id: Optional[str] = Field(None, description="User ID (Java compat)")
    session_id: Optional[str] = Field(None, description="Session ID (Java compat)")
    enable_thinking: Optional[bool] = Field(None, description="Enable thinking mode (Java compat)")
    thinking_budget: Optional[int] = Field(None, description="Thinking budget (Java compat)")

    @property
    def effective_query(self) -> str:
        return self.query or self.message or ""


class GeneralAnalysisResponse(BaseModel):
    """Response for general analysis (includes Java-compat fields)"""
    success: bool
    error: Optional[str] = None
    answer: str = ""
    aiAnalysis: Optional[str] = None
    reasoningContent: Optional[str] = None
    thinkingEnabled: Optional[bool] = None
    sessionId: Optional[str] = None
    messageCount: Optional[int] = None
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

        # P4: Determine child dimension via hierarchy or auto-detection
        detected_hierarchy = auto_detect_hierarchy(df.columns.tolist())
        child_dimension = None
        hierarchy_info = None
        new_breadcrumb = list(request.breadcrumb or [])

        if request.hierarchy_type and request.hierarchy_type in DimensionHierarchy.HIERARCHIES:
            # Explicit hierarchy provided
            levels = DimensionHierarchy.HIERARCHIES[request.hierarchy_type]["levels"]
            current_lvl = request.current_level or 0
            # Map level names to actual column names in data
            level_columns = _map_hierarchy_to_columns(levels, df.columns.tolist())
            if current_lvl + 1 < len(level_columns):
                child_dimension = level_columns[current_lvl + 1]
            hierarchy_info = {
                "type": request.hierarchy_type,
                "levels": level_columns,
                "current_level": current_lvl + 1,
                "max_level": len(level_columns) - 1
            }
        elif detected_hierarchy and request.filter_value:
            # Auto-detected hierarchy
            h_type, h_levels = detected_hierarchy
            current_dim_idx = -1
            for i, lvl in enumerate(h_levels):
                if lvl == request.dimension:
                    current_dim_idx = i
                    break
            if current_dim_idx >= 0 and current_dim_idx + 1 < len(h_levels):
                child_dimension = h_levels[current_dim_idx + 1]
                hierarchy_info = {
                    "type": h_type,
                    "levels": h_levels,
                    "current_level": current_dim_idx + 1,
                    "max_level": len(h_levels) - 1
                }

        # Perform drill-down
        analyzer = CrossAnalyzer()

        if request.filter_value:
            # Determine the target dimension for breakdown
            drill_child = child_dimension or request.dimension
            if child_dimension and child_dimension != request.dimension:
                # True hierarchical drill-down: filter parent, break down by child
                result = await analyzer.drill_down(
                    df=df,
                    parent_dimension=request.dimension,
                    parent_value=request.filter_value,
                    child_dimension=child_dimension,
                    measures=valid_measures,
                    aggregation=request.aggregation
                )
            else:
                # Same dimension filter (original behavior)
                result = await analyzer.drill_down(
                    df=df,
                    parent_dimension=request.dimension,
                    parent_value=request.filter_value,
                    child_dimension=request.dimension,
                    measures=valid_measures,
                    aggregation=request.aggregation
                )

            # Update breadcrumb
            new_breadcrumb.append({
                "dimension": request.dimension,
                "value": request.filter_value
            })
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
                    "measure_totals": {m: float(grouped[m].sum()) for m in valid_measures}
                }
            )

            # Generate chart config
            result.chart_config = _generate_bar_chart_config(
                request.dimension, valid_measures, grouped
            )

        # P4: Detect available dimensions for further drill-down
        available_dims = _find_available_dimensions(df, request.dimension, valid_measures)

        return DrillDownResponse(
            success=result.success,
            error=result.error,
            result=result.to_dict() if result.success else None,
            chart_config=result.chart_config,
            processing_time_ms=int((time.time() - start_time) * 1000),
            available_dimensions=available_dims,
            hierarchy=hierarchy_info,
            breadcrumb=new_breadcrumb,
            current_level=hierarchy_info["current_level"] if hierarchy_info else None,
            max_level=hierarchy_info["max_level"] if hierarchy_info else None
        )

    except Exception as e:
        logger.error(f"Drill-down failed: {e}", exc_info=True)
        return DrillDownResponse(
            success=False,
            error="AI对话处理失败，请稍后重试",
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
            error="AI对话处理失败，请稍后重试",
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
            error="AI对话处理失败，请稍后重试",
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
        # Get data from request, cache, or latest upload
        data = request.data
        if not data and request.sheet_id:
            data = get_sheet_data(request.sheet_id)

        if not data:
            # Try to get latest uploaded data from database
            try:
                from smartbi.config import get_postgres_url
                import asyncpg
                import asyncio

                pg_url = get_postgres_url()
                if pg_url:
                    conn = await asyncpg.connect(pg_url)
                    try:
                        # Get the most recent upload
                        row = await conn.fetchrow(
                            "SELECT id FROM smart_bi_pg_excel_uploads ORDER BY created_at DESC LIMIT 1"
                        )
                        if row:
                            upload_id = row['id']
                            rows = await conn.fetch(
                                "SELECT row_data FROM smart_bi_pg_dynamic_data WHERE upload_id = $1 LIMIT 200",
                                upload_id
                            )
                            if rows:
                                import json
                                data = [json.loads(r['row_data']) if isinstance(r['row_data'], str) else r['row_data'] for r in rows]
                                logger.info(f"[general_analysis] Loaded {len(data)} rows from latest upload {upload_id}")
                    finally:
                        await conn.close()
            except Exception as e:
                logger.warning(f"Failed to load latest upload data: {e}")

        if not data:
            # No SmartBI data — but if there's a message/query, use LLM to analyze it directly
            # (Java cost analysis sends formatted cost data as the message text)
            query = request.effective_query
            if query and len(query) > 20:
                # Use LLM to analyze the text directly
                try:
                    insight_gen = InsightGenerator()
                    llm_result = await insight_gen.generate_text_analysis(query)
                    answer = llm_result if llm_result else "分析完成，暂无更多见解。"
                    return GeneralAnalysisResponse(
                        success=True,
                        answer=answer,
                        aiAnalysis=answer,
                        sessionId=request.session_id,
                        thinkingEnabled=request.enable_thinking,
                        insights=[],
                        charts=[],
                        processing_time_ms=int((time.time() - start_time) * 1000)
                    )
                except Exception as e:
                    logger.warning(f"Direct LLM analysis failed: {e}")
                    # Fall through to no-data response

            return GeneralAnalysisResponse(
                success=True,
                answer="暂无可分析的数据。请先上传 Excel 文件或在「智能数据分析」页面选择数据源后，再使用 AI 问答功能。",
                insights=[],
                charts=[],
                processing_time_ms=int((time.time() - start_time) * 1000)
            )

        import pandas as pd
        df = pd.DataFrame(data)

        # Use insight generator for analysis
        query = request.effective_query
        insight_gen = InsightGenerator()
        insights_result = await insight_gen.generate_insights(
            df,
            context=request.context,
            query=query
        )

        # Format response
        answer = insights_result.get("summary", "数据分析完成。")
        insights = insights_result.get("insights", [])

        # Generate charts based on query type
        charts = []
        if "趋势" in query or "变化" in query:
            # Suggest trend chart
            numeric_cols = df.select_dtypes(include=['number']).columns.tolist()
            if numeric_cols:
                charts.append({
                    "type": "line",
                    "title": f"{numeric_cols[0]}趋势",
                    "data": df[numeric_cols[0]].tolist()
                })

        if "对比" in query or "比较" in query:
            # Suggest comparison chart
            charts.append({"type": "bar", "title": "对比分析"})

        return GeneralAnalysisResponse(
            success=True,
            answer=answer,
            aiAnalysis=answer,
            sessionId=request.session_id,
            thinkingEnabled=request.enable_thinking,
            insights=insights,
            charts=charts,
            processing_time_ms=int((time.time() - start_time) * 1000)
        )

    except Exception as e:
        logger.error(f"General analysis failed: {e}", exc_info=True)
        return GeneralAnalysisResponse(
            success=False,
            error="AI对话处理失败，请稍后重试",
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
            error="AI对话处理失败，请稍后重试",
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


# P4: Hierarchy keyword mappings for auto-detection
_HIERARCHY_KEYWORDS = {
    "time": {
        "年": 0, "年度": 0, "year": 0,
        "季": 1, "季度": 1, "quarter": 1,
        "月": 2, "月份": 2, "month": 2,
        "周": 3, "week": 3,
        "日": 4, "日期": 4, "天": 4, "day": 4, "date": 4,
    },
    "geography": {
        "国家": 0, "country": 0,
        "区域": 1, "大区": 1, "region": 1,
        "省": 2, "省份": 2, "province": 2,
        "市": 3, "城市": 3, "city": 3,
        "区": 4, "区县": 4, "district": 4,
    },
    "organization": {
        "公司": 0, "company": 0,
        "事业部": 1, "division": 1,
        "部门": 2, "department": 2, "dept": 2,
        "团队": 3, "team": 3, "组": 3,
    },
    "product": {
        "大类": 0, "品类": 0, "category": 0,
        "小类": 1, "子类": 1, "subcategory": 1,
        "产品": 2, "product": 2, "商品": 2,
        "SKU": 3, "sku": 3, "规格": 3,
    },
    "financial": {
        "项目": 0, "会计科目": 0, "科目": 0,
        "明细": 1, "子项目": 1, "子科目": 1,
        "行次": 2,
    },
}


def auto_detect_hierarchy(columns: List[str]) -> Optional[tuple]:
    """
    Scan column names to detect which hierarchy they belong to.
    Returns (hierarchy_type, matched_columns_sorted_by_level) or None.
    """
    best_match = None
    best_count = 0

    for h_type, keyword_map in _HIERARCHY_KEYWORDS.items():
        matched = []
        # Sort by keyword length descending to avoid ambiguous substring matches
        sorted_keywords = sorted(keyword_map.items(), key=lambda x: len(x[0]), reverse=True)
        for col in columns:
            col_lower = col.lower().strip()
            for keyword, level in sorted_keywords:
                if keyword in col_lower or col_lower == keyword:
                    matched.append((level, col))
                    break

        if len(matched) >= 2 and len(matched) > best_count:
            best_count = len(matched)
            # Sort by level, extract column names
            matched.sort(key=lambda x: x[0])
            best_match = (h_type, [m[1] for m in matched])

    return best_match


def _map_hierarchy_to_columns(levels: List[str], columns: List[str]) -> List[str]:
    """Map hierarchy level names to actual DataFrame column names"""
    result = []
    col_lower_map = {c.lower(): c for c in columns}
    for level in levels:
        if level in columns:
            result.append(level)
        elif level.lower() in col_lower_map:
            result.append(col_lower_map[level.lower()])
        else:
            # Try keyword matching
            for col in columns:
                if level.lower() in col.lower():
                    result.append(col)
                    break
    return result


def _find_available_dimensions(
    df: 'pd.DataFrame',
    current_dimension: str,
    current_measures: List[str]
) -> List[str]:
    """
    Find other categorical columns that could be drilled into.
    Excludes current dimension and numeric measures.
    """
    available = []
    for col in df.columns:
        if col == current_dimension or col in current_measures:
            continue
        # Check if column is categorical (non-numeric with reasonable cardinality)
        if df[col].dtype == 'object' or str(df[col].dtype) == 'category':
            nunique = df[col].nunique()
            if 2 <= nunique <= 50:
                available.append(col)
    return available[:8]  # Limit to 8 suggestions
