from __future__ import annotations
"""
Cross-Sheet Analysis API

Provides endpoints for cross-sheet comprehensive analysis:
- Aggregates KPIs from multiple sheets
- Generates comparison charts
- Produces AI-powered cross-sheet insights
"""
import logging
import time
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)
router = APIRouter(tags=["Cross-Sheet Analysis"])


# ============================================================================
# Request/Response Models
# ============================================================================

class CrossSheetRequest(BaseModel):
    """Request for cross-sheet analysis"""
    upload_ids: List[int] = Field(..., description="Upload IDs to include")
    sheet_names: List[str] = Field(default=[], description="Sheet display names")
    factory_id: str = Field(default="F001", description="Factory ID")


class SheetKPI(BaseModel):
    """KPI data for a single sheet"""
    sheetName: str
    kpis: Dict[str, float]


class CrossSheetChart(BaseModel):
    """Chart configuration for cross-sheet visualization"""
    chartType: str
    title: str
    config: Dict[str, Any]


class CrossSheetResponse(BaseModel):
    """Response for cross-sheet analysis"""
    success: bool
    kpiComparison: List[SheetKPI] = []
    charts: List[CrossSheetChart] = []
    aiSummary: Optional[str] = None
    error: Optional[str] = None
    processingTimeMs: int = 0


# ============================================================================
# Endpoint
# ============================================================================

@router.post("/cross-sheet-analysis", response_model=CrossSheetResponse)
async def cross_sheet_analysis(request: CrossSheetRequest) -> CrossSheetResponse:
    """
    Perform cross-sheet comprehensive analysis.

    1. Fetches data from all specified uploads
    2. Extracts key numeric KPIs per sheet
    3. Builds comparison charts
    4. Generates AI-powered cross-sheet insights

    Args:
        request: CrossSheetRequest with upload IDs and sheet names

    Returns:
        CrossSheetResponse with KPI comparison, charts, and AI summary
    """
    start_time = time.time()

    try:
        if not request.upload_ids:
            raise HTTPException(status_code=400, detail="upload_ids is required")

        from services.cross_sheet_aggregator import CrossSheetAggregator

        aggregator = CrossSheetAggregator()
        result = await aggregator.aggregate(
            upload_ids=request.upload_ids,
            sheet_names=request.sheet_names,
            factory_id=request.factory_id
        )

        elapsed = int((time.time() - start_time) * 1000)

        return CrossSheetResponse(
            success=result.get("success", False),
            kpiComparison=[SheetKPI(**k) for k in result.get("kpiComparison", [])],
            charts=[CrossSheetChart(**c) for c in result.get("charts", [])],
            aiSummary=result.get("aiSummary"),
            error=result.get("error"),
            processingTimeMs=elapsed
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Cross-sheet analysis failed: {e}", exc_info=True)
        return CrossSheetResponse(
            success=False,
            error=str(e),
            processingTimeMs=int((time.time() - start_time) * 1000)
        )
