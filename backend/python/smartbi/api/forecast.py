from __future__ import annotations
"""
Forecast API

Endpoints for time series forecasting.
"""
import logging
from typing import Optional, List, Dict

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field, conlist

from services.forecast_service import ForecastService, ForecastAlgorithm

logger = logging.getLogger(__name__)
router = APIRouter()

# Initialize service
forecast_service = ForecastService()


class ForecastRequest(BaseModel):
    """Forecast request model"""
    data: List[float] = Field(..., min_items=3, description="Historical data values")
    algorithm: str = Field("auto", description="Forecasting algorithm")
    periods: int = Field(3, ge=1, le=24, description="Number of periods to forecast")
    confidenceLevel: float = Field(0.95, ge=0.5, le=0.99, description="Confidence level for intervals")
    seasonality: Optional[int] = Field(None, description="Seasonal period (e.g., 12 for monthly)")


class ForecastResponse(BaseModel):
    """Forecast response model"""
    success: bool
    algorithm: Optional[str] = None
    inputLength: Optional[int] = None
    forecastPeriods: Optional[int] = None
    predictions: List[float] = []
    lowerBound: List[float] = []
    upperBound: List[float] = []
    parameters: Optional[dict] = None
    selectedAlgorithm: Optional[str] = None
    validationError: Optional[float] = None
    error: Optional[str] = None


class AccuracyRequest(BaseModel):
    """Accuracy calculation request model"""
    actual: List[float]
    predicted: List[float]


class AccuracyResponse(BaseModel):
    """Accuracy calculation response model"""
    success: bool
    mae: Optional[float] = None
    mse: Optional[float] = None
    rmse: Optional[float] = None
    mape: Optional[float] = None
    error: Optional[str] = None


@router.post("/predict", response_model=ForecastResponse)
async def predict(request: ForecastRequest):
    """
    Generate time series forecast

    - **data**: Historical data values (minimum 3 data points)
    - **algorithm**: Forecasting algorithm to use:
        - `moving_average`: Simple moving average
        - `linear_trend`: Linear regression-based trend
        - `exponential_smoothing`: Holt's exponential smoothing
        - `seasonal_decomposition`: Seasonal decomposition (requires enough data)
        - `auto`: Automatically select best algorithm (default)
    - **periods**: Number of periods to forecast (1-24)
    - **confidenceLevel**: Confidence level for prediction intervals (0.5-0.99)
    - **seasonality**: Optional seasonal period for seasonal algorithms

    Returns predictions with confidence intervals.
    """
    try:
        # Validate algorithm
        valid_algorithms = [a.value for a in ForecastAlgorithm]
        if request.algorithm not in valid_algorithms:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid algorithm. Valid options: {valid_algorithms}"
            )

        result = forecast_service.forecast(
            data=request.data,
            algorithm=request.algorithm,
            periods=request.periods,
            confidence_level=request.confidenceLevel,
            seasonality=request.seasonality
        )

        return ForecastResponse(**result)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Forecast error: {e}", exc_info=True)
        return ForecastResponse(success=False, error="处理失败，请稍后重试")


@router.post("/accuracy", response_model=AccuracyResponse)
async def calculate_accuracy(request: AccuracyRequest):
    """
    Calculate forecast accuracy metrics

    - **actual**: Actual observed values
    - **predicted**: Predicted/forecasted values

    Returns accuracy metrics:
    - MAE: Mean Absolute Error
    - MSE: Mean Squared Error
    - RMSE: Root Mean Squared Error
    - MAPE: Mean Absolute Percentage Error
    """
    try:
        if len(request.actual) != len(request.predicted):
            raise HTTPException(
                status_code=400,
                detail="Actual and predicted arrays must have the same length"
            )

        metrics = forecast_service.calculate_accuracy_metrics(
            actual=request.actual,
            predicted=request.predicted
        )

        return AccuracyResponse(success=True, **metrics)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Accuracy calculation error: {e}", exc_info=True)
        return AccuracyResponse(success=False, error="处理失败，请稍后重试")


@router.get("/algorithms")
async def get_algorithms():
    """
    Get available forecasting algorithms with descriptions
    """
    return {
        "algorithms": [
            {
                "id": "moving_average",
                "name": "Moving Average",
                "description": "Simple moving average forecast. Best for stable data without clear trends.",
                "minDataPoints": 3,
                "supportsSeasonality": False
            },
            {
                "id": "linear_trend",
                "name": "Linear Trend",
                "description": "Linear regression-based forecast. Best for data with clear linear trends.",
                "minDataPoints": 3,
                "supportsSeasonality": False
            },
            {
                "id": "exponential_smoothing",
                "name": "Exponential Smoothing",
                "description": "Holt's exponential smoothing. Adapts to changing trends.",
                "minDataPoints": 5,
                "supportsSeasonality": False
            },
            {
                "id": "seasonal_decomposition",
                "name": "Seasonal Decomposition",
                "description": "Handles seasonal patterns. Requires at least 2 full seasonal cycles.",
                "minDataPoints": 24,
                "supportsSeasonality": True
            },
            {
                "id": "auto",
                "name": "Auto Select",
                "description": "Automatically selects the best algorithm based on data characteristics.",
                "minDataPoints": 3,
                "supportsSeasonality": True
            }
        ]
    }


@router.post("/batch")
async def batch_forecast(requests: List[ForecastRequest]):
    """
    Generate forecasts for multiple time series in batch

    Useful for forecasting multiple metrics or dimensions simultaneously.
    """
    try:
        results = []
        for req in requests:
            result = forecast_service.forecast(
                data=req.data,
                algorithm=req.algorithm,
                periods=req.periods,
                confidence_level=req.confidenceLevel,
                seasonality=req.seasonality
            )
            results.append(result)

        return {
            "success": True,
            "batchResults": results,
            "totalRequests": len(requests)
        }

    except Exception as e:
        logger.error(f"Batch forecast error: {e}", exc_info=True)
        return {
            "success": False,
            "error": "处理失败，请稍后重试"
        }
