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
            # Try to load data from database — prefer specific sheet_id, fallback to latest upload
            try:
                from smartbi.config import get_settings
                import asyncpg

                pg_url = get_settings().postgres_url
                if pg_url:
                    conn = await asyncpg.connect(pg_url)
                    try:
                        upload_id = None
                        # Use specific upload ID if provided via sheet_id
                        if request.sheet_id:
                            try:
                                upload_id = int(request.sheet_id)
                            except (ValueError, TypeError):
                                pass
                        # Fallback: get the most recent upload
                        if not upload_id:
                            row = await conn.fetchrow(
                                "SELECT id FROM smart_bi_pg_excel_uploads ORDER BY created_at DESC LIMIT 1"
                            )
                            if row:
                                upload_id = row['id']
                        if upload_id:
                            rows = await conn.fetch(
                                "SELECT row_data FROM smart_bi_dynamic_data WHERE upload_id = $1 LIMIT 200",
                                upload_id
                            )
                            if rows:
                                import json
                                data = [json.loads(r['row_data']) if isinstance(r['row_data'], str) else r['row_data'] for r in rows]
                                logger.info(f"[general_analysis] Loaded {len(data)} rows from upload {upload_id}")
                    finally:
                        await conn.close()
            except Exception as e:
                logger.warning(f"Failed to load upload data: {e}")

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
        import re as _re_early
        df = pd.DataFrame(data)

        # Filter out index/sequence columns before ANY analysis (affects both insight text and charts)
        _idx_patterns = {'行次', '序号', '编号', '行号', '项目编号', 'index', 'no', 'no.', 'id', 'row_num', 'row_number', 'sn'}
        cols_to_drop = []
        for col in df.columns:
            lower = col.lower().strip()
            if lower in _idx_patterns:
                cols_to_drop.append(col)
            else:
                # Also detect sequential integer columns (1,2,3,...)
                try:
                    vals = pd.to_numeric(df[col].dropna().head(20), errors='coerce').dropna()
                    if len(vals) >= 3:
                        diffs = vals.diff().dropna()
                        if len(diffs) > 0 and all(d == 1 for d in diffs):
                            cols_to_drop.append(col)
                except Exception:
                    pass
        if cols_to_drop:
            logger.info(f"[general_analysis] Dropping index columns: {cols_to_drop}")
            df = df.drop(columns=cols_to_drop, errors='ignore')
            # Also clean the data list for InsightGenerator
            data = [{k: v for k, v in row.items() if k not in cols_to_drop} for row in data]

        # Use insight generator for analysis
        query = request.effective_query
        insight_gen = InsightGenerator()
        # Build analysis context from query + any extra context
        analysis_ctx = query
        if request.context:
            analysis_ctx = f"{query}\n补充信息: {request.context}"
        insights_result = await insight_gen.generate_insights(
            data,
            analysis_context=analysis_ctx,
        )

        # Format response — prefer executive_summary from first insight over generic "summary"
        answer = insights_result.get("summary", "数据分析完成。")
        insights = insights_result.get("insights", [])
        if answer == "数据分析完成。" and insights:
            for ins in insights:
                if isinstance(ins, dict):
                    better = ins.get("executive_summary") or ins.get("text")
                    if better and len(better) > 10:
                        answer = better
                        break

        # Generate charts using ChartBuilder for proper ECharts options
        charts = []
        try:
            from services.chart_builder import ChartBuilder
            import re as _re
            builder = ChartBuilder()

            # --- Column name humanization (P1-3 fix) ---
            _COLUMN_NAME_MAP = {
                'actual_amount': '实际金额', 'budget_amount': '预算金额',
                'total_amount': '总金额', 'net_profit': '净利润',
                'gross_profit': '毛利润', 'revenue': '营收',
                'cost': '成本', 'expense': '费用', 'sales': '销售额',
                'quantity': '数量', 'price': '单价', 'margin': '利润率',
                'growth_rate': '增长率', 'total': '合计',
            }

            def _humanize_col(name: str) -> str:
                """Translate raw/English column names to readable Chinese labels."""
                if not name:
                    return name
                # Column_XX pattern → remove prefix
                if _re.match(r'^[Cc]olumn[_\s]?\d+$', name):
                    return f"指标{name.split('_')[-1] if '_' in name else name[-1]}"
                # Date pattern YYYY-MM-DD → M月
                m = _re.match(r'^(\d{4})-(\d{1,2})-\d{1,2}$', name)
                if m:
                    return f"{int(m.group(2))}月"
                # Compound date pattern: YYYY-MM-DD_suffix → M月suffix
                m = _re.match(r'^(\d{4})-(\d{1,2})-\d{1,2}[_\s](.+)$', name)
                if m:
                    suffix = m.group(3)
                    return f"{int(m.group(2))}月{suffix}"
                # English snake_case → Chinese lookup
                lower = name.lower().replace(' ', '_')
                if lower in _COLUMN_NAME_MAP:
                    return _COLUMN_NAME_MAP[lower]
                # underscores → spaces for readability (only pure ASCII)
                if '_' in name and all(c.isascii() for c in name):
                    return name.replace('_', ' ').title()
                return name

            # --- Filter out index/sequence columns (P1-2 fix) ---
            _INDEX_COL_PATTERNS = {'行次', '序号', '编号', '行号', '项目编号', 'index', 'no', 'no.', 'id', 'row_num', 'row_number', 'sn'}

            def _is_index_column(col_name: str, series) -> bool:
                """Detect if a column is an index/sequence column (not meaningful for analysis)."""
                lower = col_name.lower().strip()
                if lower in _INDEX_COL_PATTERNS:
                    return True
                # Check if values are sequential integers (1,2,3,...)
                try:
                    import pandas as pd
                    vals = pd.to_numeric(series.dropna().head(20), errors='coerce').dropna()
                    if len(vals) >= 3:
                        diffs = vals.diff().dropna()
                        if len(diffs) > 0 and all(d == 1 for d in diffs):
                            return True
                except Exception:
                    pass
                return False

            numeric_cols = df.select_dtypes(include=['number']).columns.tolist()
            non_numeric_cols = [c for c in df.columns if c not in numeric_cols]

            # Remove index/sequence columns from both lists
            numeric_cols = [c for c in numeric_cols if not _is_index_column(c, df[c])]
            non_numeric_cols = [c for c in non_numeric_cols if not _is_index_column(c, df[c])]

            # Deprioritize auto-generated Column_XX columns (from merged cells / missing headers)
            # Move them to end so meaningful columns are preferred for chart series
            _column_xx_pat = _re.compile(r'^[Cc]olumn[_\s]?\d+$')
            named_numeric = [c for c in numeric_cols if not _column_xx_pat.match(c)]
            unnamed_numeric = [c for c in numeric_cols if _column_xx_pat.match(c)]
            numeric_cols = named_numeric + unnamed_numeric  # named first, Column_XX as fallback

            # Pick a label field: prefer columns with non-numeric text values
            label_field = None
            for col in non_numeric_cols:
                sample = df[col].dropna().head(10).astype(str)
                has_text = any(len(v) > 1 and not v.replace('.','').replace('-','').isdigit() for v in sample)
                if has_text:
                    label_field = col
                    break
            if not label_field and non_numeric_cols:
                label_field = non_numeric_cols[0]

            def _humanize_echart_option(echart_option: dict) -> dict:
                """Humanize column names in ECharts option (legend, series names, axis labels)."""
                if not echart_option:
                    return echart_option
                opt = dict(echart_option)
                # Humanize legend data
                if 'legend' in opt and isinstance(opt['legend'], dict):
                    leg_data = opt['legend'].get('data', [])
                    if isinstance(leg_data, list):
                        opt['legend'] = {**opt['legend'], 'data': [_humanize_col(str(d)) for d in leg_data]}
                # Humanize series names
                if 'series' in opt and isinstance(opt['series'], list):
                    new_series = []
                    for s in opt['series']:
                        if isinstance(s, dict) and 'name' in s:
                            new_series.append({**s, 'name': _humanize_col(str(s['name']))})
                        else:
                            new_series.append(s)
                    opt['series'] = new_series
                # Humanize title text
                if 'title' in opt and isinstance(opt['title'], dict):
                    t = opt['title'].get('text', '')
                    if t:
                        # Replace raw column patterns in title
                        for raw_col in list(df.columns):
                            h = _humanize_col(raw_col)
                            if h != raw_col and raw_col in t:
                                t = t.replace(raw_col, h)
                        opt['title'] = {**opt['title'], 'text': t}
                return opt

            def _extract_echart_option(chart_result: dict, chart_type: str, title: str):
                """Extract ECharts option from ChartBuilder result and wrap for frontend"""
                if not chart_result or not chart_result.get("success"):
                    return None
                echart_option = chart_result.get("config", {})
                if not echart_option:
                    return None
                # Humanize column names in the ECharts config
                echart_option = _humanize_echart_option(echart_option)
                return {
                    "type": chart_type,
                    "title": title,
                    "option": _sanitize_for_json(echart_option)
                }

            # Limit data to first 50 rows for chart building (avoid oversized charts)
            chart_data = data[:50] if len(data) > 50 else data

            if "趋势" in query or "变化" in query:
                if numeric_cols:
                    y_cols = numeric_cols[:3]
                    h_names = '、'.join(_humanize_col(c) for c in y_cols[:2])
                    chart_result = builder.build(
                        "line", chart_data, x_field=label_field, y_fields=y_cols,
                        title=f"{h_names}趋势分析"
                    )
                    chart_entry = _extract_echart_option(chart_result, "line", f"{h_names}趋势")
                    if chart_entry:
                        charts.append(chart_entry)

            elif "对比" in query or "比较" in query or "排名" in query:
                if numeric_cols and label_field:
                    y_cols = numeric_cols[:2]
                    h_names = '、'.join(_humanize_col(c) for c in y_cols[:2])
                    chart_result = builder.build(
                        "bar", chart_data, x_field=label_field, y_fields=y_cols,
                        title=f"{h_names}对比分析"
                    )
                    chart_entry = _extract_echart_option(chart_result, "bar", f"{h_names}对比")
                    if chart_entry:
                        charts.append(chart_entry)

            elif "占比" in query or "构成" in query or "分布" in query:
                if numeric_cols and label_field:
                    h_name = _humanize_col(numeric_cols[0])
                    chart_result = builder.build(
                        "pie", chart_data, x_field=label_field, y_fields=[numeric_cols[0]],
                        title=f"{h_name}占比分析"
                    )
                    chart_entry = _extract_echart_option(chart_result, "pie", f"{h_name}占比")
                    if chart_entry:
                        charts.append(chart_entry)

            # Default: if no specific chart type matched, auto-recommend a bar chart
            if not charts and numeric_cols and label_field:
                y_cols = numeric_cols[:3]
                chart_result = builder.build(
                    "bar", chart_data, x_field=label_field, y_fields=y_cols,
                    title="数据概览"
                )
                chart_entry = _extract_echart_option(chart_result, "bar", "数据概览")
                if chart_entry:
                    charts.append(chart_entry)
        except Exception as chart_err:
            logger.warning(f"Chart generation failed in general_analysis: {chart_err}")

        # Sanitize insights to remove NaN/Infinity before JSON serialization
        insights = _sanitize_for_json(insights)

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

import math

def _sanitize_for_json(obj):
    """Recursively replace NaN/Infinity with None to prevent JSON serialization errors."""
    if isinstance(obj, float):
        if math.isnan(obj) or math.isinf(obj):
            return None
        return obj
    if isinstance(obj, dict):
        return {k: _sanitize_for_json(v) for k, v in obj.items()}
    if isinstance(obj, (list, tuple)):
        return [_sanitize_for_json(v) for v in obj]
    return obj

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
