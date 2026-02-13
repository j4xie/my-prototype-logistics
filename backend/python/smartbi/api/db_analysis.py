"""
Database Analysis API

Provides endpoints for analyzing data directly from PostgreSQL.
These endpoints enable Java backend to delegate analysis to Python
while data is stored in PostgreSQL.
"""

import logging
from typing import List, Dict, Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from config import get_settings

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/smartbi/analysis/db", tags=["Database Analysis"])

settings = get_settings()


# ==================== Request/Response Models ====================

class AggregateRequest(BaseModel):
    factory_id: str
    upload_id: int
    group_field: str
    measure_field: str
    agg_func: str = "SUM"


class AnalyzeRequest(BaseModel):
    factory_id: str
    upload_id: int
    analysis_type: str = "auto"


class AggregateResponse(BaseModel):
    success: bool
    data: List[Dict[str, Any]]
    groupField: str
    measureField: str
    total: Optional[float] = None


class DashboardResponse(BaseModel):
    success: bool
    uploadId: int
    tableType: Optional[str] = None
    kpiCards: List[Dict[str, Any]] = []
    charts: List[Dict[str, Any]] = []
    insights: List[str] = []
    fieldDefinitions: List[Dict[str, Any]] = []


class FieldDefinition(BaseModel):
    originalName: str
    standardName: Optional[str] = None
    fieldType: Optional[str] = None
    semanticType: Optional[str] = None
    chartRole: Optional[str] = None
    isDimension: bool = False
    isMeasure: bool = False
    isTime: bool = False


# ==================== Database Dependency ====================

def get_db_session():
    """Get database session if PostgreSQL is enabled"""
    if not settings.postgres_enabled:
        raise HTTPException(
            status_code=503,
            detail="PostgreSQL is not enabled. Set POSTGRES_ENABLED=true in environment."
        )

    from database.connection import get_db_context, is_postgres_enabled

    if not is_postgres_enabled():
        raise HTTPException(
            status_code=503,
            detail="PostgreSQL connection not available"
        )

    with get_db_context() as db:
        yield db


# ==================== Endpoints ====================

@router.post("/overview", response_model=DashboardResponse)
async def analyze_from_db(request: AnalyzeRequest):
    """
    Analyze data from PostgreSQL and return dashboard response.

    Reads dynamic data from PostgreSQL, auto-detects analysis type,
    and returns KPIs, charts, and insights.
    """
    if not settings.postgres_enabled:
        raise HTTPException(
            status_code=503,
            detail="PostgreSQL is not enabled"
        )

    from database.connection import get_db_context, is_postgres_enabled
    from database.repository import DynamicDataRepository, FieldDefinitionRepository, UploadRepository

    if not is_postgres_enabled():
        raise HTTPException(
            status_code=503,
            detail="PostgreSQL connection not available"
        )

    try:
        with get_db_context() as db:
            upload_repo = UploadRepository(db)
            data_repo = DynamicDataRepository(db)
            field_repo = FieldDefinitionRepository(db)

            # Get upload metadata
            upload = upload_repo.get_by_id(request.upload_id)
            if not upload:
                return DashboardResponse(
                    success=False,
                    uploadId=request.upload_id,
                    insights=["Upload not found"]
                )

            # Get field definitions
            fields = field_repo.get_by_upload_id(request.upload_id)
            measures = [f for f in fields if f.is_measure]
            dimensions = [f for f in fields if f.is_dimension]

            # Get data
            data = data_repo.get_by_upload_id(request.factory_id, request.upload_id)
            if not data:
                return DashboardResponse(
                    success=False,
                    uploadId=request.upload_id,
                    tableType=upload.detected_table_type,
                    insights=["No data found"]
                )

            # Generate KPIs
            kpis = []
            for measure in measures:
                total = data_repo.sum_field(
                    request.factory_id, request.upload_id, measure.original_name
                )
                if total is not None:
                    kpis.append({
                        "title": measure.standard_name or measure.original_name,
                        "value": format_number(total),
                        "rawValue": total,
                        "type": measure.semantic_type
                    })

            # Generate charts
            charts = []
            if measures and dimensions:
                primary_measure = measures[0]
                for dim in dimensions[:3]:  # Limit to 3 dimension charts
                    agg_data = data_repo.aggregate(
                        request.factory_id, request.upload_id,
                        dim.original_name, primary_measure.original_name
                    )
                    if agg_data:
                        chart_type = "line" if dim.is_time else "bar"
                        if len(agg_data) <= 6 and not dim.is_time:
                            chart_type = "pie"

                        charts.append({
                            "type": chart_type,
                            "title": f"{primary_measure.standard_name or primary_measure.original_name} by {dim.standard_name or dim.original_name}",
                            "xAxisLabel": dim.standard_name or dim.original_name,
                            "yAxisLabel": primary_measure.standard_name or primary_measure.original_name,
                            "data": {
                                "labels": [d["group"] for d in agg_data],
                                "datasets": [{
                                    "label": primary_measure.standard_name or primary_measure.original_name,
                                    "data": [d["value"] for d in agg_data]
                                }]
                            }
                        })

            # Generate insights
            insights = [f"Data contains {len(data)} records"]
            if dimensions and measures:
                top_data = data_repo.aggregate(
                    request.factory_id, request.upload_id,
                    dimensions[0].original_name, measures[0].original_name
                )
                if top_data:
                    top = top_data[0]
                    insights.append(
                        f"Top {dimensions[0].standard_name or dimensions[0].original_name}: "
                        f"{top['group']} ({format_number(top['value'])})"
                    )

            return DashboardResponse(
                success=True,
                uploadId=request.upload_id,
                tableType=upload.detected_table_type,
                kpiCards=kpis,
                charts=charts,
                insights=insights,
                fieldDefinitions=[f.to_dict() for f in fields]
            )

    except Exception as e:
        logger.error(f"Analysis failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="处理失败，请稍后重试")


@router.post("/aggregate", response_model=AggregateResponse)
async def aggregate_from_db(request: AggregateRequest):
    """
    Dynamic aggregation query on PostgreSQL JSONB data.

    Uses PostgreSQL native JSONB operators with GIN index support
    for efficient aggregation.
    """
    if not settings.postgres_enabled:
        raise HTTPException(status_code=503, detail="PostgreSQL is not enabled")

    from database.connection import get_db_context, is_postgres_enabled
    from database.repository import DynamicDataRepository

    if not is_postgres_enabled():
        raise HTTPException(status_code=503, detail="PostgreSQL connection not available")

    try:
        with get_db_context() as db:
            data_repo = DynamicDataRepository(db)

            results = data_repo.aggregate(
                request.factory_id,
                request.upload_id,
                request.group_field,
                request.measure_field,
                request.agg_func
            )

            total = sum(r["value"] for r in results) if results else 0

            return AggregateResponse(
                success=True,
                data=results,
                groupField=request.group_field,
                measureField=request.measure_field,
                total=total
            )

    except Exception as e:
        logger.error(f"Aggregation failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="处理失败，请稍后重试")


@router.get("/fields/{upload_id}")
async def get_field_definitions(upload_id: int):
    """
    Get field definitions for an upload.

    Returns metadata about each field including type, semantic type,
    and chart role for frontend rendering.
    """
    if not settings.postgres_enabled:
        raise HTTPException(status_code=503, detail="PostgreSQL is not enabled")

    from database.connection import get_db_context, is_postgres_enabled
    from database.repository import FieldDefinitionRepository

    if not is_postgres_enabled():
        raise HTTPException(status_code=503, detail="PostgreSQL connection not available")

    try:
        with get_db_context() as db:
            field_repo = FieldDefinitionRepository(db)
            fields = field_repo.get_by_upload_id(upload_id)

            return {
                "success": True,
                "data": [f.to_dict() for f in fields]
            }

    except Exception as e:
        logger.error(f"Failed to get fields: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="处理失败，请稍后重试")


@router.get("/distinct/{upload_id}")
async def get_distinct_values(
    upload_id: int,
    factory_id: str = Query(...),
    field_name: str = Query(...)
):
    """
    Get distinct values for a field (for filter dropdowns).
    """
    if not settings.postgres_enabled:
        raise HTTPException(status_code=503, detail="PostgreSQL is not enabled")

    from database.connection import get_db_context, is_postgres_enabled
    from database.repository import DynamicDataRepository

    if not is_postgres_enabled():
        raise HTTPException(status_code=503, detail="PostgreSQL connection not available")

    try:
        with get_db_context() as db:
            data_repo = DynamicDataRepository(db)
            values = data_repo.get_distinct_values(factory_id, upload_id, field_name)

            return {
                "success": True,
                "data": values,
                "fieldName": field_name,
                "count": len(values)
            }

    except Exception as e:
        logger.error(f"Failed to get distinct values: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="处理失败，请稍后重试")


@router.get("/health")
async def db_health_check():
    """Check PostgreSQL connection health"""
    if not settings.postgres_enabled:
        return {
            "status": "disabled",
            "message": "PostgreSQL is not enabled"
        }

    from database.connection import test_connection

    if test_connection():
        return {
            "status": "healthy",
            "message": "PostgreSQL connection is working"
        }
    else:
        return {
            "status": "unhealthy",
            "message": "PostgreSQL connection failed"
        }


# ==================== Helper Functions ====================

def format_number(value: float) -> str:
    """Format number for display"""
    if value is None:
        return "0"

    if abs(value) >= 1_000_000:
        return f"{value / 1_000_000:.2f}M"
    elif abs(value) >= 1_000:
        return f"{value / 1_000:.2f}K"
    else:
        return f"{value:.2f}"
