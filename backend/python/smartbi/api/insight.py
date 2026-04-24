from __future__ import annotations
"""
Insight Generation API

Endpoints for AI-powered business insights.
"""
import logging
import json
from typing import Any, Optional, List, Dict

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from common.responses import ApiException, ErrorCode

from services.insight_generator import InsightGenerator
from smartbi.services.field_classifier import RATING_NAME_SUFFIXES

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
    upload_id: Optional[int] = None
    sheet_index: Optional[int] = None


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
    action_items: Optional[List[str]] = None
    title: Optional[str] = None
    dimension: Optional[str] = None
    confidence: Optional[float] = None
    source: Optional[str] = None
    # Structured fields from _meta type
    executive_summary: Optional[str] = None
    risk_alerts: Optional[List[dict]] = None
    opportunities: Optional[List[dict]] = None


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
            raise ApiException("Data is required", ErrorCode.VALIDATION_ERROR, 400)

        result = await insight_generator.generate_insights(
            data=request.data,
            metrics=request.metrics,
            analysis_context=request.analysisContext,
            insight_types=request.insightTypes,
            max_insights=request.maxInsights,
            upload_id=request.upload_id,
            sheet_index=request.sheet_index
        )

        # Convert insights to Pydantic models (skip malformed items)
        insights = []
        for i in result.get("insights", []):
            try:
                insights.append(Insight(**i))
            except Exception as e:
                logger.warning("Skipping malformed insight: %s — %s", i, e)

        return InsightResponse(
            success=result.get("success", False),
            insights=insights,
            totalGenerated=result.get("totalGenerated"),
            method=result.get("method"),
            message=result.get("message"),
            error=result.get("error")
        )

    except (HTTPException, ApiException):
        raise
    except Exception as e:
        logger.error(f"Insight generation error: {e}", exc_info=True)
        return InsightResponse(success=False, error="分析生成失败，请稍后重试", message="分析生成失败，请稍后重试")


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
            raise ApiException("Metrics are required", ErrorCode.VALIDATION_ERROR, 400)

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

    except (HTTPException, ApiException):
        raise
    except Exception as e:
        logger.error(f"Metrics analysis error: {e}", exc_info=True)
        return InsightResponse(success=False, error="分析生成失败，请稍后重试", message="分析生成失败，请稍后重试")


async def _load_upload_data(upload_id: int, limit: int = 50000) -> List[Dict[str, Any]]:
    """Load upload data from PostgreSQL by upload_id."""
    try:
        from smartbi.config import get_pg_pool
        import json as _json

        pool = await get_pg_pool()
        if not pool:
            return []
        async with pool.acquire() as conn:
            rows = await conn.fetch(
                "SELECT row_data FROM smart_bi_dynamic_data WHERE upload_id = $1 LIMIT $2",
                upload_id, limit
            )
            if rows:
                return [_json.loads(r['row_data']) if isinstance(r['row_data'], str) else r['row_data'] for r in rows]
    except Exception as e:
        logger.warning(f"_load_upload_data({upload_id}) failed: {e}")
    return []


async def _load_agg_strategy_map(upload_id: int) -> Dict[str, str]:
    """Load persisted agg_strategy map for an upload's columns.

    Apr 25 2026 — replaces inline regex+stats heuristic. Falls back to {} on
    any error (caller defaults each numeric col to 'sum').
    """
    out: Dict[str, str] = {}
    try:
        from smartbi.config import get_pg_pool
        pool = await get_pg_pool()
        if not pool:
            return out
        async with pool.acquire() as conn:
            rows = await conn.fetch(
                """SELECT original_name, agg_strategy
                   FROM smart_bi_pg_field_definitions
                   WHERE upload_id = $1""",
                int(upload_id),
            )
            for r in rows:
                out[r["original_name"]] = (r["agg_strategy"] or "sum")
    except Exception as _e:
        logger.warning(f"[_load_agg_strategy_map({upload_id})] failed: {_e}")
    return out


def compute_quick_summary(
    data: List[Dict[str, Any]],
    agg_by_name: Optional[Dict[str, str]] = None,
) -> Dict[str, Any]:
    """Pure-compute quick summary (no LLM, no DB I/O).

    Extracted Apr 25 2026 (Task C / PROD-1 fix) so the same logic can drive
    both the HTTP /quick-summary endpoint AND the Python ingest-time
    precompute-cache hook (which pre-warms enrichment_cache so 200K-row
    uploads avoid the 120s axios timeout on first visit).

    Returns the same shape as the legacy /quick-summary endpoint:
      {success, rowCount, columnCount, columns: [{name, type, min, max,
       mean, sum, semanticType, aggStrategy, sparkline, trend, trendPercent,
       nullCount, uniqueCount}, ...]}
    """
    if not data:
        return {"success": False, "rowCount": 0, "columnCount": 0, "columns": [], "message": "暂无数据"}

    import pandas as pd
    from smartbi.config import coerce_numeric_columns

    df = coerce_numeric_columns(pd.DataFrame(data))
    agg_by_name = agg_by_name or {}

    summary: Dict[str, Any] = {
        "success": True,
        "rowCount": len(df),
        "columnCount": len(df.columns),
        "columns": [],
    }

    for col in df.columns:
        col_info: Dict[str, Any] = {
            "name": col,
            "type": str(df[col].dtype),
            "nullCount": int(df[col].isna().sum()),
            "uniqueCount": int(df[col].nunique()),
        }

        if pd.api.types.is_numeric_dtype(df[col]):
            col_min = df[col].min()
            col_max = df[col].max()
            col_mean = df[col].mean()
            col_sum = df[col].sum()
            agg_strategy = agg_by_name.get(col, "sum")
            # Apr 25 2026 — defense-in-depth: this live rating detection is
            # now redundant for new uploads (the γ-2c precompute hook in
            # analysis_cache.py populates statistics + re-runs
            # infer_agg_strategy so 'mean' lands in DB before this code
            # ever sees the column). Kept for: (a) historical uploads that
            # haven't been backfilled yet, (b) safety net if the precompute
            # hook fails / hasn't fired yet (large uploads, network blip).
            # Plan: remove after 2 weeks of confirming backfill coverage.
            if agg_strategy == "sum" and pd.notna(col_mean):
                name_suggests_rating = any(
                    col.endswith(s) for s in RATING_NAME_SUFFIXES
                )
                if name_suggests_rating and 1.0 <= float(col_mean) <= 5.0:
                    agg_strategy = "mean"
            emit_sum = agg_strategy == "sum"
            semantic_type_hint = "rating" if agg_strategy == "mean" else None
            col_info.update({
                "min": float(col_min) if pd.notna(col_min) else None,
                "max": float(col_max) if pd.notna(col_max) else None,
                "mean": float(col_mean) if pd.notna(col_mean) else None,
                "sum": float(col_sum) if (emit_sum and pd.notna(col_sum)) else None,
                "semanticType": semantic_type_hint,
                "aggStrategy": agg_strategy,
            })

            values = df[col].dropna().tolist()
            if len(values) >= 3:
                step = max(1, len(values) // 12)
                sparkline = [round(float(v), 2) for v in values[::step]][:12]
                col_info["sparkline"] = sparkline

                if len(sparkline) >= 2:
                    meaningful = [v for v in sparkline if v != 0]
                    if len(meaningful) >= 2:
                        prev_val = meaningful[-2]
                        last_val = meaningful[-1]
                        pct = ((last_val - prev_val) / abs(prev_val)) * 100
                        if abs(pct) >= 95:
                            col_info["trend"] = "flat"
                            col_info["trendPercent"] = None
                        else:
                            col_info["trend"] = "up" if pct > 5 else ("down" if pct < -5 else "flat")
                            col_info["trendPercent"] = round(pct, 1)
                    else:
                        col_info["trend"] = "flat"
                        col_info["trendPercent"] = None
                else:
                    col_info["trend"] = "flat"
                    col_info["trendPercent"] = None

        summary["columns"].append(col_info)

    return summary


@router.post("/quick-summary")
async def quick_summary(request: Request):
    """
    Generate a quick summary of the data.

    Accepts EITHER:
    - A raw JSON array of rows (backward compat)
    - A JSON object with optional `upload_id` (loads from PG) and/or `data` array

    Returns basic statistical insights without LLM analysis.
    Faster than full insight generation.
    """
    try:
        body = await request.json()

        # Determine data source
        data: List[Dict[str, Any]] = []
        upload_id_for_agg: Optional[int] = None
        if isinstance(body, list):
            data = body
        elif isinstance(body, dict):
            data = body.get("data", [])
            upload_id = body.get("upload_id")
            if upload_id is not None:
                try:
                    upload_id_for_agg = int(upload_id)
                except (TypeError, ValueError):
                    raise ApiException(f"Invalid upload_id: {upload_id}", ErrorCode.VALIDATION_ERROR, 400)
            if not data and upload_id_for_agg is not None:
                data = await _load_upload_data(upload_id_for_agg)
        else:
            raise ApiException("Expected JSON array or object with upload_id", ErrorCode.VALIDATION_ERROR, 400)

        if not data:
            return {"success": False, "rowCount": 0, "columnCount": 0, "columns": [], "message": "暂无数据"}

        agg_by_name: Dict[str, str] = {}
        if upload_id_for_agg is not None:
            agg_by_name = await _load_agg_strategy_map(upload_id_for_agg)

        return compute_quick_summary(data, agg_by_name)

    except (HTTPException, ApiException):
        raise
    except Exception as e:
        logger.error(f"Quick summary error: {e}", exc_info=True)
        return {"success": False, "data": None, "message": "分析生成失败，请稍后重试"}


@router.post("/generate-stream")
async def generate_insights_stream(request: InsightRequest):
    """
    Stream AI insights via SSE (Server-Sent Events).

    Returns a text/event-stream with:
    - event: chunk — raw LLM text as it's generated
    - event: done  — final parsed JSON with structured insights

    This allows the frontend to show AI analysis text progressively
    instead of waiting 5-10s for the full response.
    """
    if not request.data:
        raise ApiException("Data is required", ErrorCode.VALIDATION_ERROR, 400)

    async def event_generator():
        async for event in insight_generator.generate_insights_stream(
            data=request.data,
            metrics=request.metrics,
            analysis_context=request.analysisContext,
            max_insights=request.maxInsights,
            upload_id=request.upload_id,
            sheet_index=request.sheet_index
        ):
            evt_type = event.get("event", "chunk")
            evt_data = event.get("data", "")
            # SSE format: escape newlines in data
            safe_data = evt_data.replace("\n", "\\n")
            yield f"event: {evt_type}\ndata: {safe_data}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        }
    )
