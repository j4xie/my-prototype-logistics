from __future__ import annotations
"""
Analysis API

Endpoints for financial and sales analysis services.
"""
import logging
from typing import Any, Optional, List, Dict

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from services.analysis import FinanceAnalysisService, SalesAnalysisService

logger = logging.getLogger(__name__)
router = APIRouter()

# Initialize services
finance_service = FinanceAnalysisService()
sales_service = SalesAnalysisService()


# ============================================================================
# Request Models
# ============================================================================

class BaseAnalysisRequest(BaseModel):
    """Base request model for analysis endpoints"""
    data: List[Dict[str, Any]] = Field(..., description="Data to analyze")
    fieldMapping: Optional[Dict[str, str]] = Field(
        default=None,
        description="Optional mapping from standard field names to actual column names"
    )


class FinanceOverviewRequest(BaseAnalysisRequest):
    """Request model for finance overview"""
    periodType: Optional[str] = Field(
        default="month",
        description="Period type: day, week, month, quarter, year"
    )


class ProfitTrendRequest(BaseAnalysisRequest):
    """Request model for profit trend analysis"""
    periodType: Optional[str] = Field(
        default="month",
        description="Period type: day, week, month, quarter, year"
    )
    periods: Optional[int] = Field(
        default=12,
        description="Number of periods to analyze"
    )


class CostStructureRequest(BaseAnalysisRequest):
    """Request model for cost structure analysis"""
    groupBy: Optional[str] = Field(
        default=None,
        description="Optional field to group costs by"
    )


class BudgetWaterfallRequest(BaseAnalysisRequest):
    """Request model for budget waterfall analysis"""
    budgetField: Optional[str] = Field(
        default=None,
        description="Field name for budget values"
    )
    actualField: Optional[str] = Field(
        default=None,
        description="Field name for actual values"
    )


class BudgetVsActualRequest(BaseAnalysisRequest):
    """Request model for budget vs actual comparison"""
    periodType: Optional[str] = Field(
        default="month",
        description="Period type: day, week, month, quarter, year"
    )


class YoYMoMRequest(BaseAnalysisRequest):
    """Request model for Year-over-Year and Month-over-Month analysis"""
    year1: Optional[int] = Field(
        default=None,
        description="First year for comparison"
    )
    year2: Optional[int] = Field(
        default=None,
        description="Second year for comparison"
    )
    metric: Optional[str] = Field(
        default="sales_amount",
        description="Metric to compare"
    )


class CategoryComparisonRequest(BaseAnalysisRequest):
    """Request model for category structure comparison"""
    categoryField: Optional[str] = Field(
        default=None,
        description="Field name for category"
    )
    periodField: Optional[str] = Field(
        default=None,
        description="Field name for time period"
    )


class SalesKPIsRequest(BaseAnalysisRequest):
    """Request model for sales KPIs"""
    targetData: Optional[List[Dict[str, Any]]] = Field(
        default=None,
        description="Optional target data for completion rate calculation"
    )


class RankingRequest(BaseAnalysisRequest):
    """Request model for ranking analysis"""
    topN: Optional[int] = Field(
        default=10,
        description="Number of top items to return"
    )
    rankBy: Optional[str] = Field(
        default="sales_amount",
        description="Metric to rank by"
    )


class SalesTrendRequest(BaseAnalysisRequest):
    """Request model for sales trend analysis"""
    periodType: Optional[str] = Field(
        default="month",
        description="Period type: day, week, month, quarter, year"
    )
    periods: Optional[int] = Field(
        default=12,
        description="Number of periods to analyze"
    )


class RegionDistributionRequest(BaseAnalysisRequest):
    """Request model for region distribution analysis"""
    regionField: Optional[str] = Field(
        default=None,
        description="Field name for region"
    )


class CustomerAnalysisRequest(BaseAnalysisRequest):
    """Request model for customer analysis"""
    customerField: Optional[str] = Field(
        default=None,
        description="Field name for customer identifier"
    )
    topN: Optional[int] = Field(
        default=10,
        description="Number of top customers to return"
    )


# ============================================================================
# Response Models
# ============================================================================

class AnalysisResponse(BaseModel):
    """Standard analysis response model"""
    success: bool
    data: Optional[Dict[str, Any]] = None
    error: Optional[str] = None


# ============================================================================
# Finance Analysis Endpoints
# ============================================================================

@router.post("/finance/overview", response_model=AnalysisResponse)
async def get_finance_overview(request: FinanceOverviewRequest):
    """
    Get financial overview with key metrics

    Returns aggregated financial metrics including:
    - Total revenue
    - Total cost
    - Gross profit and margin
    - Net profit and margin
    - Period-over-period changes

    - **data**: List of financial data records
    - **periodType**: Period type for aggregation (day, week, month, quarter, year)
    - **fieldMapping**: Optional mapping from standard field names to actual column names
    """
    try:
        if not request.data:
            raise HTTPException(status_code=400, detail="Data is required")

        result = finance_service.get_finance_overview(
            data=request.data
        )

        return AnalysisResponse(**result)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Finance overview error: {e}", exc_info=True)
        return AnalysisResponse(success=False, error=str(e))


@router.post("/finance/profit-trend", response_model=AnalysisResponse)
async def get_profit_trend(request: ProfitTrendRequest):
    """
    Analyze profit trends over time

    Returns time series data showing:
    - Revenue trend
    - Cost trend
    - Profit trend
    - Margin changes

    - **data**: List of financial data records
    - **periodType**: Period type for trend analysis
    - **periods**: Number of periods to include
    - **fieldMapping**: Optional field mapping
    """
    try:
        if not request.data:
            raise HTTPException(status_code=400, detail="Data is required")

        result = finance_service.get_profit_trend(
            data=request.data,
            period_type=request.periodType
        )

        return AnalysisResponse(**result)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Profit trend error: {e}", exc_info=True)
        return AnalysisResponse(success=False, error=str(e))


@router.post("/finance/cost-structure", response_model=AnalysisResponse)
async def get_cost_structure(request: CostStructureRequest):
    """
    Analyze cost structure breakdown

    Returns cost breakdown by category:
    - Material costs
    - Labor costs
    - Overhead costs
    - Other costs
    - Percentage of each category

    - **data**: List of cost data records
    - **groupBy**: Optional field to group costs by
    - **fieldMapping**: Optional field mapping
    """
    try:
        if not request.data:
            raise HTTPException(status_code=400, detail="Data is required")

        result = finance_service.get_cost_structure(
            data=request.data
        )

        return AnalysisResponse(**result)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Cost structure error: {e}", exc_info=True)
        return AnalysisResponse(success=False, error=str(e))


@router.post("/finance/budget-waterfall", response_model=AnalysisResponse)
async def get_budget_waterfall(request: BudgetWaterfallRequest):
    """
    Generate budget waterfall chart data

    Returns waterfall data showing:
    - Starting budget
    - Incremental changes by category
    - Final actual value
    - Variance explanations

    - **data**: List of budget/actual data records
    - **budgetField**: Field name for budget values
    - **actualField**: Field name for actual values
    - **fieldMapping**: Optional field mapping
    """
    try:
        if not request.data:
            raise HTTPException(status_code=400, detail="Data is required")

        result = finance_service.get_budget_waterfall(
            data=request.data
        )

        return AnalysisResponse(**result)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Budget waterfall error: {e}", exc_info=True)
        return AnalysisResponse(success=False, error=str(e))


@router.post("/finance/budget-vs-actual", response_model=AnalysisResponse)
async def get_budget_vs_actual(request: BudgetVsActualRequest):
    """
    Compare budget vs actual values

    Returns comparison data:
    - Budget values by period/category
    - Actual values by period/category
    - Variance amount and percentage
    - Achievement rate

    - **data**: List of budget/actual data records
    - **periodType**: Period type for comparison
    - **fieldMapping**: Optional field mapping
    """
    try:
        if not request.data:
            raise HTTPException(status_code=400, detail="Data is required")

        result = finance_service.get_budget_vs_actual(
            data=request.data
        )

        return AnalysisResponse(**result)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Budget vs actual error: {e}", exc_info=True)
        return AnalysisResponse(success=False, error=str(e))


@router.post("/finance/yoy-mom", response_model=AnalysisResponse)
async def get_yoy_mom_comparison(request: YoYMoMRequest):
    """
    Year-over-Year and Month-over-Month comparison

    Returns comparison data:
    - YoY growth rates
    - MoM growth rates
    - Period-by-period comparison
    - Trend indicators

    - **data**: List of time series data records
    - **year1**: First year for comparison
    - **year2**: Second year for comparison
    - **metric**: Metric to compare
    - **fieldMapping**: Optional field mapping
    """
    try:
        if not request.data:
            raise HTTPException(status_code=400, detail="Data is required")

        result = finance_service.get_yoy_mom_comparison(
            data=request.data,
            period_type=request.metric or "monthly"
        )

        return AnalysisResponse(**result)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"YoY/MoM comparison error: {e}", exc_info=True)
        return AnalysisResponse(success=False, error=str(e))


@router.post("/finance/category-comparison", response_model=AnalysisResponse)
async def get_category_comparison(request: CategoryComparisonRequest):
    """
    Compare category structure across periods

    Returns comparison data:
    - Category distribution for each period
    - Changes in category proportions
    - Growth/decline by category

    - **data**: List of categorized data records
    - **categoryField**: Field name for category
    - **periodField**: Field name for time period
    - **fieldMapping**: Optional field mapping
    """
    try:
        if not request.data:
            raise HTTPException(status_code=400, detail="Data is required")

        result = finance_service.get_category_comparison(
            data=request.data,
            year1=2024,
            year2=2025
        )

        return AnalysisResponse(**result)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Category comparison error: {e}", exc_info=True)
        return AnalysisResponse(success=False, error=str(e))


# ============================================================================
# Sales Analysis Endpoints
# ============================================================================

@router.post("/sales/kpis", response_model=AnalysisResponse)
async def get_sales_kpis(request: SalesKPIsRequest):
    """
    Get key sales KPIs

    Returns sales KPI metrics:
    - Total sales amount
    - Order count
    - Average order value
    - Target completion rate (if target data provided)
    - Growth indicators

    - **data**: List of sales data records
    - **targetData**: Optional target data for completion rate
    - **fieldMapping**: Optional field mapping
    """
    try:
        if not request.data:
            raise HTTPException(status_code=400, detail="Data is required")

        result = sales_service.get_sales_kpis(
            data=request.data
        )

        return AnalysisResponse(**result)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Sales KPIs error: {e}", exc_info=True)
        return AnalysisResponse(success=False, error=str(e))


@router.post("/sales/ranking/salesperson", response_model=AnalysisResponse)
async def get_salesperson_ranking(request: RankingRequest):
    """
    Get salesperson performance ranking

    Returns ranked list of salespeople:
    - Salesperson name/ID
    - Total sales amount
    - Order count
    - Average order value
    - Rank and percentage of total

    - **data**: List of sales data records
    - **topN**: Number of top salespeople to return
    - **rankBy**: Metric to rank by (sales_amount, order_count, etc.)
    - **fieldMapping**: Optional field mapping
    """
    try:
        if not request.data:
            raise HTTPException(status_code=400, detail="Data is required")

        result = sales_service.get_salesperson_ranking(
            data=request.data,
            top_n=request.topN or 10
        )

        return AnalysisResponse(**result)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Salesperson ranking error: {e}", exc_info=True)
        return AnalysisResponse(success=False, error=str(e))


@router.post("/sales/ranking/product", response_model=AnalysisResponse)
async def get_product_ranking(request: RankingRequest):
    """
    Get product sales ranking

    Returns ranked list of products:
    - Product name/ID
    - Total sales amount
    - Units sold
    - Average unit price
    - Rank and percentage of total

    - **data**: List of sales data records
    - **topN**: Number of top products to return
    - **rankBy**: Metric to rank by (sales_amount, quantity, etc.)
    - **fieldMapping**: Optional field mapping
    """
    try:
        if not request.data:
            raise HTTPException(status_code=400, detail="Data is required")

        result = sales_service.get_product_ranking(
            data=request.data,
            top_n=request.topN or 10
        )

        return AnalysisResponse(**result)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Product ranking error: {e}", exc_info=True)
        return AnalysisResponse(success=False, error=str(e))


@router.post("/sales/trend", response_model=AnalysisResponse)
async def get_sales_trend(request: SalesTrendRequest):
    """
    Analyze sales trends over time

    Returns time series data:
    - Sales amount by period
    - Order count by period
    - Growth rate by period
    - Moving averages

    - **data**: List of sales data records
    - **periodType**: Period type for trend analysis
    - **periods**: Number of periods to include
    - **fieldMapping**: Optional field mapping
    """
    try:
        if not request.data:
            raise HTTPException(status_code=400, detail="Data is required")

        result = sales_service.get_sales_trend(
            data=request.data,
            period_type=request.periodType or "daily"
        )

        return AnalysisResponse(**result)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Sales trend error: {e}", exc_info=True)
        return AnalysisResponse(success=False, error=str(e))


@router.post("/sales/region-distribution", response_model=AnalysisResponse)
async def get_region_distribution(request: RegionDistributionRequest):
    """
    Analyze sales distribution by region

    Returns regional breakdown:
    - Sales amount by region
    - Percentage of total by region
    - Order count by region
    - Regional growth rates

    - **data**: List of sales data records with region information
    - **regionField**: Field name for region
    - **fieldMapping**: Optional field mapping
    """
    try:
        if not request.data:
            raise HTTPException(status_code=400, detail="Data is required")

        result = sales_service.get_region_distribution(
            data=request.data
        )

        return AnalysisResponse(**result)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Region distribution error: {e}", exc_info=True)
        return AnalysisResponse(success=False, error=str(e))


@router.post("/sales/customer-analysis", response_model=AnalysisResponse)
async def get_customer_analysis(request: CustomerAnalysisRequest):
    """
    Analyze customer purchasing behavior

    Returns customer analysis:
    - Top customers by sales
    - Customer count
    - Average customer value
    - Repeat purchase rate
    - Customer segmentation

    - **data**: List of sales data records with customer information
    - **customerField**: Field name for customer identifier
    - **topN**: Number of top customers to return
    - **fieldMapping**: Optional field mapping
    """
    try:
        if not request.data:
            raise HTTPException(status_code=400, detail="Data is required")

        result = sales_service.get_customer_analysis(
            data=request.data
        )

        return AnalysisResponse(**result)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Customer analysis error: {e}", exc_info=True)
        return AnalysisResponse(success=False, error=str(e))


# ============================================================================
# Utility Endpoints
# ============================================================================

@router.get("/available")
async def get_available_analyses():
    """
    Get list of all available analysis types
    """
    return {
        "success": True,
        "data": {
            "finance": {
                "name": "Financial Analysis",
                "name_zh": "财务分析",
                "endpoints": [
                    {
                        "path": "/finance/overview",
                        "name": "Finance Overview",
                        "name_zh": "财务概览",
                        "description": "Key financial metrics overview"
                    },
                    {
                        "path": "/finance/profit-trend",
                        "name": "Profit Trend",
                        "name_zh": "利润趋势",
                        "description": "Profit trends over time"
                    },
                    {
                        "path": "/finance/cost-structure",
                        "name": "Cost Structure",
                        "name_zh": "成本结构",
                        "description": "Cost breakdown analysis"
                    },
                    {
                        "path": "/finance/budget-waterfall",
                        "name": "Budget Waterfall",
                        "name_zh": "预算瀑布图",
                        "description": "Budget variance waterfall"
                    },
                    {
                        "path": "/finance/budget-vs-actual",
                        "name": "Budget vs Actual",
                        "name_zh": "预算对比实际",
                        "description": "Budget vs actual comparison"
                    },
                    {
                        "path": "/finance/yoy-mom",
                        "name": "YoY/MoM Comparison",
                        "name_zh": "同比环比分析",
                        "description": "Year-over-year and month-over-month analysis"
                    },
                    {
                        "path": "/finance/category-comparison",
                        "name": "Category Comparison",
                        "name_zh": "品类对比",
                        "description": "Category structure comparison"
                    }
                ]
            },
            "sales": {
                "name": "Sales Analysis",
                "name_zh": "销售分析",
                "endpoints": [
                    {
                        "path": "/sales/kpis",
                        "name": "Sales KPIs",
                        "name_zh": "销售KPI",
                        "description": "Key sales performance indicators"
                    },
                    {
                        "path": "/sales/ranking/salesperson",
                        "name": "Salesperson Ranking",
                        "name_zh": "销售员排名",
                        "description": "Salesperson performance ranking"
                    },
                    {
                        "path": "/sales/ranking/product",
                        "name": "Product Ranking",
                        "name_zh": "产品排名",
                        "description": "Product sales ranking"
                    },
                    {
                        "path": "/sales/trend",
                        "name": "Sales Trend",
                        "name_zh": "销售趋势",
                        "description": "Sales trends over time"
                    },
                    {
                        "path": "/sales/region-distribution",
                        "name": "Region Distribution",
                        "name_zh": "区域分布",
                        "description": "Sales distribution by region"
                    },
                    {
                        "path": "/sales/customer-analysis",
                        "name": "Customer Analysis",
                        "name_zh": "客户分析",
                        "description": "Customer purchasing behavior analysis"
                    }
                ]
            }
        }
    }
