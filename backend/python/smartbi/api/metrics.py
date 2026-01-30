from __future__ import annotations
"""
Metrics Calculation API

Endpoints for calculating business metrics.
"""
import logging
from typing import Any, Optional, List, Dict

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from services.metric_calculator import MetricCalculator, MetricType

logger = logging.getLogger(__name__)
router = APIRouter()

# Initialize service
metric_calculator = MetricCalculator()


class MetricCalculationRequest(BaseModel):
    """Metric calculation request model"""
    data: List[Dict[str, Any]]
    metrics: List[str]
    groupBy: Optional[List[str]] = None
    timeField: Optional[str] = None
    fieldMapping: Optional[Dict[str, str]] = None


class MetricResult(BaseModel):
    """Single metric result"""
    success: bool
    metric: str
    name: Optional[str] = None
    value: Optional[float] = None
    unit: Optional[str] = None
    breakdown: Optional[dict] = None
    error: Optional[str] = None


class MetricCalculationResponse(BaseModel):
    """Metric calculation response model"""
    success: bool
    results: List[MetricResult] = []
    summary: Optional[Dict[str, float]] = None
    groupBy: Optional[List[str]] = None
    timeField: Optional[str] = None
    error: Optional[str] = None


class MetricInfo(BaseModel):
    """Metric information"""
    id: str
    name: str
    unit: str
    formula: str
    required_fields: List[str]


@router.post("/calculate", response_model=MetricCalculationResponse)
async def calculate_metrics(request: MetricCalculationRequest):
    """
    Calculate specified metrics from data

    - **data**: List of data records
    - **metrics**: List of metric types to calculate (e.g., ["sales_amount", "gross_margin"])
    - **groupBy**: Optional fields to group by
    - **timeField**: Optional time dimension field
    - **fieldMapping**: Optional mapping from standard field names to actual column names

    Supported metrics:
    - Sales: sales_amount, order_count, avg_order_value, daily_avg_sales
    - Profitability: gross_profit, gross_margin, net_profit, net_margin, roi
    - Cost: material_cost_ratio, labor_cost_ratio, unit_cost
    - Target: target_completion, target_variance
    - Budget: budget_execution_rate, budget_variance
    - Growth: sales_yoy, sales_mom
    """
    try:
        if not request.data:
            raise HTTPException(status_code=400, detail="Data is required")

        if not request.metrics:
            raise HTTPException(status_code=400, detail="At least one metric is required")

        # Validate metric types
        valid_metrics = [m.value for m in MetricType]
        invalid_metrics = [m for m in request.metrics if m not in valid_metrics]
        if invalid_metrics:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid metric types: {invalid_metrics}. Valid types: {valid_metrics}"
            )

        result = metric_calculator.calculate(
            data=request.data,
            metrics=request.metrics,
            group_by=request.groupBy,
            time_field=request.timeField,
            field_mapping=request.fieldMapping
        )

        return MetricCalculationResponse(**result)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Metric calculation error: {e}", exc_info=True)
        return MetricCalculationResponse(success=False, error=str(e))


@router.get("/available", response_model=List[MetricInfo])
async def get_available_metrics():
    """
    Get list of all available metrics with their definitions
    """
    metrics = metric_calculator.get_available_metrics()
    return [MetricInfo(**m) for m in metrics]


@router.get("/categories")
async def get_metric_categories():
    """
    Get metrics organized by category
    """
    return {
        "sales": {
            "name": "销售指标",
            "metrics": [
                {"id": "sales_amount", "name": "销售额"},
                {"id": "order_count", "name": "订单数"},
                {"id": "avg_order_value", "name": "客单价"},
                {"id": "daily_avg_sales", "name": "日均销售"},
                {"id": "monthly_sales", "name": "月销售额"},
                {"id": "sales_growth_rate", "name": "销售增长率"},
                {"id": "sales_yoy", "name": "同比增长"},
                {"id": "sales_mom", "name": "环比增长"}
            ]
        },
        "target": {
            "name": "目标指标",
            "metrics": [
                {"id": "target_completion", "name": "目标完成率"},
                {"id": "target_variance", "name": "目标差异"},
                {"id": "target_gap", "name": "目标缺口"}
            ]
        },
        "profitability": {
            "name": "盈利指标",
            "metrics": [
                {"id": "gross_profit", "name": "毛利"},
                {"id": "gross_margin", "name": "毛利率"},
                {"id": "net_profit", "name": "净利润"},
                {"id": "net_margin", "name": "净利率"},
                {"id": "roi", "name": "投资回报率"},
                {"id": "contribution_margin", "name": "贡献边际"}
            ]
        },
        "cost": {
            "name": "成本指标",
            "metrics": [
                {"id": "material_cost_ratio", "name": "材料成本占比"},
                {"id": "labor_cost_ratio", "name": "人工成本占比"},
                {"id": "overhead_cost_ratio", "name": "间接成本占比"},
                {"id": "unit_cost", "name": "单位成本"},
                {"id": "cost_variance", "name": "成本差异"}
            ]
        },
        "financial": {
            "name": "财务指标",
            "metrics": [
                {"id": "ar_balance", "name": "应收账款余额"},
                {"id": "collection_rate", "name": "回款率"},
                {"id": "overdue_ratio", "name": "逾期率"},
                {"id": "dso", "name": "应收账款周转天数"}
            ]
        },
        "budget": {
            "name": "预算指标",
            "metrics": [
                {"id": "budget_execution_rate", "name": "预算执行率"},
                {"id": "budget_variance", "name": "预算差异"},
                {"id": "budget_utilization", "name": "预算利用率"}
            ]
        },
        "inventory": {
            "name": "库存指标",
            "metrics": [
                {"id": "inventory_turnover", "name": "库存周转率"},
                {"id": "stock_days", "name": "库存天数"}
            ]
        },
        "customer": {
            "name": "客户指标",
            "metrics": [
                {"id": "customer_count", "name": "客户数"},
                {"id": "new_customer_count", "name": "新客户数"},
                {"id": "repeat_purchase_rate", "name": "复购率"},
                {"id": "customer_retention_rate", "name": "客户留存率"}
            ]
        }
    }


@router.post("/batch")
async def calculate_batch(requests: List[MetricCalculationRequest]):
    """
    Calculate metrics for multiple datasets in batch

    Useful for calculating same metrics across different time periods or dimensions.
    """
    try:
        results = []
        for req in requests:
            result = metric_calculator.calculate(
                data=req.data,
                metrics=req.metrics,
                group_by=req.groupBy,
                time_field=req.timeField,
                field_mapping=req.fieldMapping
            )
            results.append(result)

        return {
            "success": True,
            "batchResults": results,
            "totalRequests": len(requests)
        }

    except Exception as e:
        logger.error(f"Batch metric calculation error: {e}", exc_info=True)
        return {
            "success": False,
            "error": str(e)
        }
