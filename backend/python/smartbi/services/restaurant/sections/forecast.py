"""Restaurant forecast section — wraps ForecastService for revenue prediction.

Part of P3 Task 3.5-3.6. The underlying ForecastService already exists
(supports multi-algorithm time-series forecasting) but was only exposed
as the generic /api/smartbi/forecast endpoint. This handler wraps it as
a restaurant-specific section so mobile users can ask '下个月会怎样'
and route through the restaurant flow.

ForecastService location: smartbi/services/forecast_service.py
Main method: forecast(data, algorithm="auto", periods=3,
                      confidence_level=0.95, seasonality=None)
Return type: dict with keys: success, algorithm, inputLength,
             forecastPeriods, predictions, lowerBound, upperBound, parameters

Inputs:
  history_values (list[float], optional): pre-computed monthly revenue
    series. If provided, skips the POS aggregation.
  pos_df (DataFrame, optional via context): POS sales data — used to
    aggregate monthly revenue when history_values is absent.
  datetime_col, revenue_col (optional param overrides for POS parsing)
  periods (int, default 3): how many months to forecast
  algorithm (str, default "auto"): forecast algorithm name
  confidence_level (float, default 0.80): prediction interval level

Returns:
  algorithm, history, predictions, lowerBound, upperBound, periods,
  confidenceLevel, interpretationZh (Chinese narrative about the trend)
"""
from __future__ import annotations

import time
from typing import Any

from smartbi.services.restaurant.sections.base import (
    AbstractSectionHandler,
    SectionRequest,
    SectionResponse,
)


class RestaurantForecastHandler(AbstractSectionHandler):
    section_name = "restaurant_forecast"

    def __init__(self) -> None:
        self._forecast = None  # lazy

    def _get_forecast(self):
        if self._forecast is None:
            from smartbi.services.forecast_service import ForecastService
            self._forecast = ForecastService()
        return self._forecast

    def compute(self, request: SectionRequest, context: dict[str, Any]) -> SectionResponse:
        started = time.time()

        history = request.params.get("history_values")

        # Fallback: aggregate from POS
        if not history:
            pos_df = context.get("pos_df")
            if pos_df is None:
                pos_df = request.params.get("pos_df")
            datetime_col = request.params.get("datetime_col", "开单时间")
            revenue_col = request.params.get("revenue_col", "实收额")

            if pos_df is None or not hasattr(pos_df, "columns") or datetime_col not in pos_df.columns:
                return self.skipped(
                    request,
                    "未提供 history_values 且 POS 缺少时间列, 无法预测",
                    started,
                )

            try:
                import pandas as pd
                pos_df = pos_df.copy()
                pos_df[datetime_col] = pd.to_datetime(pos_df[datetime_col], errors="coerce")
                monthly = (
                    pos_df.dropna(subset=[datetime_col])
                    .set_index(datetime_col)
                    .resample("M")[revenue_col]
                    .sum()
                )
                history = monthly.tolist()
            except Exception as e:
                return self.skipped(
                    request,
                    f"POS 聚合为月度序列失败: {e}",
                    started,
                )

        if len(history) < 3:
            return self.skipped(
                request,
                f"history 长度 {len(history)} < 3, 无法做预测",
                started,
            )

        periods = int(request.params.get("periods", 3))
        algorithm = request.params.get("algorithm", "auto")
        confidence_level = float(request.params.get("confidence_level", 0.80))

        try:
            forecast = self._get_forecast()
            result = forecast.forecast(
                data=history,
                algorithm=algorithm,
                periods=periods,
                confidence_level=confidence_level,
            )
        except Exception as e:
            return self.skipped(
                request,
                f"预测失败: {e}",
                started,
            )

        # ForecastService returns a dict. Check success flag.
        if not result.get("success", True):
            return self.skipped(
                request,
                f"预测服务返回失败: {result.get('error', '未知错误')}",
                started,
            )

        # Extract fields — ForecastService uses camelCase for bounds
        predictions = result.get("predictions", [])
        lower = result.get("lowerBound", [])
        upper = result.get("upperBound", [])
        alg_used = result.get("algorithm", algorithm)

        # Defensive defaults
        if predictions is None:
            predictions = []
        if lower is None:
            lower = []
        if upper is None:
            upper = []

        data = {
            "algorithm": alg_used,
            "history": [round(float(v), 2) for v in history],
            "predictions": [round(float(v), 2) for v in predictions],
            "lowerBound": [round(float(v), 2) for v in lower],
            "upperBound": [round(float(v), 2) for v in upper],
            "periods": periods,
            "confidenceLevel": confidence_level,
            "interpretationZh": self._interpret(history, predictions),
        }

        return self.ok(request, data=data, started=started)

    def _interpret(self, history: list[float], predictions: list[float]) -> str:
        if not history or not predictions:
            return ""
        last_actual = float(history[-1])
        last_forecast = float(predictions[-1])
        if last_actual == 0:
            return ""
        delta_pct = (last_forecast - last_actual) / last_actual * 100
        if delta_pct < -20:
            return f"按当前趋势, 预测期末营收将再降 {abs(delta_pct):.1f}%. 需要立即干预."
        if delta_pct < 0:
            return f"趋势略降 {abs(delta_pct):.1f}%, 在正常波动范围内."
        if delta_pct < 5:
            return "趋势稳定, 预测与当前水平接近."
        return f"预测期末营收将上升 {delta_pct:.1f}%, 保持当前策略."
