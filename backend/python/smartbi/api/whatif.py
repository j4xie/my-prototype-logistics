"""What-If Pricing Simulator API.

POST /simulate — accepts upload_id or raw_data + scenario parameters,
returns revenue impact, gross profit impact, breakeven point, and sensitivity matrix.
"""
from __future__ import annotations

import logging
from typing import Optional, List, Dict, Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
import pandas as pd

from smartbi.services.whatif_simulator import WhatIfSimulator, ScenarioInput

logger = logging.getLogger(__name__)
router = APIRouter()

# Service singleton
simulator = WhatIfSimulator()


# ---------------------------------------------------------------------------
# Request / Response models
# ---------------------------------------------------------------------------

class ScenarioParam(BaseModel):
    """A single simulation scenario."""
    name: str = "custom"
    priceChangePct: float = Field(0, ge=-50, le=50, description="Price change percentage, e.g. 10 = +10%")
    costChangePct: float = Field(0, ge=-50, le=50, description="Cost change percentage")
    trafficChangePct: float = Field(0, ge=-100, le=200, description="Traffic change percentage")


class WhatIfRequest(BaseModel):
    """What-If simulation request."""
    uploadId: Optional[int] = Field(None, description="Upload ID to load data from PostgreSQL")
    rawData: Optional[List[Dict[str, Any]]] = Field(None, max_items=50000, description="Direct data input")
    factoryId: str = Field("F001", description="Factory ID for data isolation")
    scenarios: List[ScenarioParam] = Field(
        default_factory=lambda: [ScenarioParam()],
        max_items=10,
        description="Scenarios to simulate (max 10)"
    )
    elasticity: Optional[float] = Field(None, description="Custom price elasticity coefficient (default -1.2)")


class WhatIfResponse(BaseModel):
    """What-If simulation response."""
    success: bool
    costStructure: Optional[Dict[str, Any]] = None
    scenarios: Optional[List[Dict[str, Any]]] = None
    sensitivityMatrix: Optional[List[Dict[str, Any]]] = None
    comparisonChart: Optional[Dict[str, Any]] = None
    error: Optional[str] = None


# ---------------------------------------------------------------------------
# Data loading (same pattern as financial_dashboard.py)
# ---------------------------------------------------------------------------

async def _load_data(request: WhatIfRequest) -> pd.DataFrame:
    """Load data from uploadId or rawData."""
    if request.rawData:
        return pd.DataFrame(request.rawData)

    if request.uploadId:
        try:
            from smartbi.config import get_settings
            from sqlalchemy import create_engine, text
            settings = get_settings()
            engine = create_engine(settings.postgres_url)
            with engine.connect() as conn:
                rows = conn.execute(
                    text("SELECT row_data FROM smart_bi_dynamic_data WHERE upload_id = :id LIMIT 50000"),
                    {"id": request.uploadId}
                ).fetchall()
                if rows:
                    import json
                    data_list = []
                    for r in rows:
                        val = r[0]
                        if isinstance(val, str):
                            data_list.append(json.loads(val))
                        else:
                            data_list.append(val)
                    if data_list:
                        return pd.DataFrame(data_list)
        except Exception as e:
            logger.error(f"Failed to load upload {request.uploadId}: {e}")
            raise HTTPException(status_code=400, detail="数据加载失败，请确认上传ID正确")

    raise HTTPException(status_code=400, detail="需要提供 uploadId 或 rawData")


# ---------------------------------------------------------------------------
# API endpoint
# ---------------------------------------------------------------------------

@router.post("/simulate", response_model=WhatIfResponse)
async def simulate(request: WhatIfRequest):
    """Run What-If pricing simulation.

    Accepts either an upload_id (loads from PostgreSQL) or raw_data (direct).
    Returns projected revenue, cost, gross profit for each scenario,
    plus a sensitivity matrix and 3-scenario comparison chart data.
    """
    try:
        df = await _load_data(request)

        if df.empty:
            return WhatIfResponse(success=False, error="上传数据为空，无法进行模拟")

        # Convert request scenarios to internal ScenarioInput
        scenario_inputs = [
            ScenarioInput(
                name=s.name,
                priceChangePct=s.priceChangePct,
                costChangePct=s.costChangePct,
                trafficChangePct=s.trafficChangePct,
            )
            for s in request.scenarios
        ]

        # Use custom elasticity if provided
        sim = simulator
        if request.elasticity is not None:
            sim = WhatIfSimulator(elasticity=request.elasticity)

        result = sim.simulate(df, scenario_inputs)

        return WhatIfResponse(
            success=True,
            costStructure=result["costStructure"],
            scenarios=result["scenarios"],
            sensitivityMatrix=result["sensitivityMatrix"],
            comparisonChart=result["comparisonChart"],
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"What-If simulation error: {e}", exc_info=True)
        return WhatIfResponse(success=False, error="模拟计算失败，请稍后重试")
