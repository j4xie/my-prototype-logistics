from __future__ import annotations
"""
Field Detection API

Endpoints for field type detection and mapping.
"""
import logging
from typing import Any, Optional, List, Dict

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from services.field_detector import FieldDetector
from services.llm_mapper import LLMMapper

logger = logging.getLogger(__name__)
router = APIRouter()

# Initialize services
field_detector = FieldDetector()
llm_mapper = LLMMapper()


class FieldDetectionRequest(BaseModel):
    """Field detection request model"""
    headers: List[str]
    rows: List[List[Any]]


class FieldInfo(BaseModel):
    """Single field information"""
    fieldName: str
    dataType: str
    semanticType: str
    chartRole: str
    nullable: bool
    nullCount: int
    uniqueCount: int
    sampleValues: List[Any] = []
    statistics: Optional[dict] = None
    uniqueValues: Optional[List[Any]] = None


class FieldDetectionResponse(BaseModel):
    """Field detection response model"""
    success: bool
    fields: List[FieldInfo] = []
    error: Optional[str] = None


class FieldMappingRequest(BaseModel):
    """Field mapping request model"""
    detectedFields: List[dict]
    context: Optional[str] = None


class FieldMappingResponse(BaseModel):
    """Field mapping response model"""
    success: bool
    mappings: List[dict] = []
    unmapped: List[str] = []
    method: Optional[str] = None
    error: Optional[str] = None


class ChartConfigRequest(BaseModel):
    """Chart configuration request model"""
    detectedFields: List[dict]
    analysisGoal: Optional[str] = None


class ChartConfigResponse(BaseModel):
    """Chart configuration response model"""
    success: bool
    recommendations: List[dict] = []
    method: Optional[str] = None
    error: Optional[str] = None


@router.post("/detect", response_model=FieldDetectionResponse)
async def detect_fields(request: FieldDetectionRequest):
    """
    Detect field types from sample data

    - **headers**: Column headers
    - **rows**: Data rows (sample of data)

    Returns detected field types including data type, semantic type, and recommended chart role.
    """
    try:
        if not request.headers:
            raise HTTPException(status_code=400, detail="Headers are required")

        if not request.rows:
            raise HTTPException(status_code=400, detail="At least one row of data is required")

        fields = field_detector.detect_fields(request.headers, request.rows)

        return FieldDetectionResponse(
            success=True,
            fields=[FieldInfo(**f) for f in fields]
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Field detection error: {e}", exc_info=True)
        return FieldDetectionResponse(success=False, error="处理失败，请稍后重试")


@router.post("/map", response_model=FieldMappingResponse)
async def map_fields(request: FieldMappingRequest):
    """
    Map detected fields to standard business fields using LLM

    - **detectedFields**: List of detected field information from /detect endpoint
    - **context**: Optional business context for better mapping

    Returns mapping from source fields to standard business fields.
    """
    try:
        if not request.detectedFields:
            raise HTTPException(status_code=400, detail="Detected fields are required")

        result = await llm_mapper.map_fields(
            request.detectedFields,
            request.context
        )

        return FieldMappingResponse(**result)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Field mapping error: {e}", exc_info=True)
        return FieldMappingResponse(success=False, error="处理失败，请稍后重试")


@router.post("/chart-config", response_model=ChartConfigResponse)
async def recommend_chart_config(request: ChartConfigRequest):
    """
    Recommend chart configuration based on detected fields

    - **detectedFields**: List of detected field information
    - **analysisGoal**: Optional description of analysis goal

    Returns recommended chart types and configurations.
    """
    try:
        if not request.detectedFields:
            raise HTTPException(status_code=400, detail="Detected fields are required")

        result = await llm_mapper.recommend_chart_config(
            request.detectedFields,
            request.analysisGoal
        )

        return ChartConfigResponse(**result)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Chart config recommendation error: {e}", exc_info=True)
        return ChartConfigResponse(success=False, error="处理失败，请稍后重试")


@router.get("/types")
async def get_field_types():
    """
    Get available field types and their descriptions
    """
    return {
        "dataTypes": [
            {"id": "string", "name": "String", "description": "Text values"},
            {"id": "integer", "name": "Integer", "description": "Whole numbers"},
            {"id": "float", "name": "Float", "description": "Decimal numbers"},
            {"id": "date", "name": "Date", "description": "Date values"},
            {"id": "datetime", "name": "DateTime", "description": "Date and time values"},
            {"id": "boolean", "name": "Boolean", "description": "True/False values"}
        ],
        "semanticTypes": [
            {"id": "amount", "name": "Amount", "description": "Currency/monetary values"},
            {"id": "quantity", "name": "Quantity", "description": "Count/quantity values"},
            {"id": "percentage", "name": "Percentage", "description": "Percentage values"},
            {"id": "date", "name": "Date", "description": "Date dimension"},
            {"id": "category", "name": "Category", "description": "Categorical dimension"},
            {"id": "geography", "name": "Geography", "description": "Geographic dimension"},
            {"id": "product", "name": "Product", "description": "Product dimension"},
            {"id": "id", "name": "ID", "description": "Identifier fields"},
            {"id": "name", "name": "Name", "description": "Name/label fields"}
        ],
        "chartRoles": [
            {"id": "dimension", "name": "Dimension", "description": "X-axis, grouping field"},
            {"id": "measure", "name": "Measure", "description": "Y-axis, numeric values"},
            {"id": "time", "name": "Time", "description": "Time axis"},
            {"id": "series", "name": "Series", "description": "Series grouping"},
            {"id": "tooltip", "name": "Tooltip", "description": "Additional info for tooltips"}
        ]
    }
