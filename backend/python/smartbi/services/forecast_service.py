from __future__ import annotations
"""
Forecast Service

Time series forecasting with multiple algorithms:
- Moving Average
- Linear Trend
- Exponential Smoothing
- Auto (best algorithm selection)
"""
import logging
from typing import Any, Optional, List, Dict
from enum import Enum

import numpy as np
import pandas as pd
from scipy import stats

logger = logging.getLogger(__name__)


class ForecastAlgorithm(str, Enum):
    """Available forecasting algorithms"""
    MOVING_AVERAGE = "moving_average"
    LINEAR_TREND = "linear_trend"
    EXPONENTIAL_SMOOTHING = "exponential_smoothing"
    SEASONAL_DECOMPOSITION = "seasonal_decomposition"
    AUTO = "auto"


class ForecastService:
    """Time series forecasting service"""

    def __init__(self):
        self.min_data_points = 3  # Minimum data points required

    def forecast(
        self,
        data: List[float],
        algorithm: str = "auto",
        periods: int = 3,
        confidence_level: float = 0.95,
        seasonality: Optional[int] = None
    ) -> Dict[str, Any]:
        """
        Generate time series forecast

        Args:
            data: Historical data values
            algorithm: Forecasting algorithm to use
            periods: Number of periods to forecast
            confidence_level: Confidence level for intervals
            seasonality: Seasonal period (e.g., 12 for monthly data)

        Returns:
            Forecast results with predictions and confidence intervals
        """
        try:
            # Validate input
            if len(data) < self.min_data_points:
                return {
                    "success": False,
                    "error": f"Insufficient data points. Minimum {self.min_data_points} required, got {len(data)}"
                }

            # Clean data
            clean_data = self._clean_data(data)
            if len(clean_data) < self.min_data_points:
                return {
                    "success": False,
                    "error": "Too many missing values in data"
                }

            # Select algorithm
            algo = ForecastAlgorithm(algorithm) if algorithm != "auto" else self._select_best_algorithm(clean_data)

            # Generate forecast
            if algo == ForecastAlgorithm.MOVING_AVERAGE:
                result = self._moving_average_forecast(clean_data, periods, confidence_level)
            elif algo == ForecastAlgorithm.LINEAR_TREND:
                result = self._linear_trend_forecast(clean_data, periods, confidence_level)
            elif algo == ForecastAlgorithm.EXPONENTIAL_SMOOTHING:
                result = self._exponential_smoothing_forecast(clean_data, periods, confidence_level)
            elif algo == ForecastAlgorithm.SEASONAL_DECOMPOSITION:
                result = self._seasonal_forecast(clean_data, periods, seasonality, confidence_level)
            else:
                # Auto - try multiple and pick best
                result = self._auto_forecast(clean_data, periods, confidence_level)

            return {
                "success": True,
                "algorithm": algo.value,
                "inputLength": len(clean_data),
                "forecastPeriods": periods,
                **result
            }

        except Exception as e:
            logger.error(f"Forecast failed: {e}", exc_info=True)
            return {
                "success": False,
                "error": str(e)
            }

    def _clean_data(self, data: list) -> np.ndarray:
        """Clean and validate input data"""
        arr = np.array(data, dtype=float)
        # Replace inf with nan, then interpolate
        arr[np.isinf(arr)] = np.nan

        # Simple linear interpolation for missing values
        if np.isnan(arr).any():
            mask = np.isnan(arr)
            arr[mask] = np.interp(
                np.flatnonzero(mask),
                np.flatnonzero(~mask),
                arr[~mask]
            )

        return arr

    def _select_best_algorithm(self, data: np.ndarray) -> ForecastAlgorithm:
        """Select best algorithm based on data characteristics"""
        n = len(data)

        # Check for trend
        x = np.arange(n)
        slope, _, r_value, _, _ = stats.linregress(x, data)
        has_strong_trend = abs(r_value) > 0.7

        # Check for seasonality (simple autocorrelation check)
        has_seasonality = self._detect_seasonality(data)

        if has_seasonality and n >= 24:
            return ForecastAlgorithm.SEASONAL_DECOMPOSITION
        elif has_strong_trend:
            return ForecastAlgorithm.LINEAR_TREND
        elif n >= 10:
            return ForecastAlgorithm.EXPONENTIAL_SMOOTHING
        else:
            return ForecastAlgorithm.MOVING_AVERAGE

    def _detect_seasonality(self, data: np.ndarray, max_lag: int = 12) -> bool:
        """Detect seasonality using autocorrelation"""
        if len(data) < max_lag * 2:
            return False

        # Calculate autocorrelation
        mean = np.mean(data)
        var = np.var(data)
        if var == 0:
            return False

        normalized = data - mean
        acf = np.correlate(normalized, normalized, mode='full')
        acf = acf[len(acf)//2:]  # Take positive lags only
        acf = acf / (var * len(data))

        # Check for significant peaks at seasonal lags
        for lag in [4, 7, 12]:  # Common seasonal periods
            if lag < len(acf) and acf[lag] > 0.3:
                return True

        return False

    def _moving_average_forecast(
        self,
        data: np.ndarray,
        periods: int,
        confidence_level: float
    ) -> dict:
        """Simple Moving Average forecast"""
        window = min(3, len(data))
        ma = np.mean(data[-window:])

        # Standard error for confidence interval
        std_err = np.std(data) / np.sqrt(window)
        z_score = stats.norm.ppf((1 + confidence_level) / 2)

        predictions = [float(ma)] * periods
        lower_bound = [float(ma - z_score * std_err * np.sqrt(i + 1)) for i in range(periods)]
        upper_bound = [float(ma + z_score * std_err * np.sqrt(i + 1)) for i in range(periods)]

        return {
            "predictions": predictions,
            "lowerBound": lower_bound,
            "upperBound": upper_bound,
            "parameters": {"window": window}
        }

    def _linear_trend_forecast(
        self,
        data: np.ndarray,
        periods: int,
        confidence_level: float
    ) -> dict:
        """Linear Trend forecast using regression"""
        n = len(data)
        x = np.arange(n)

        # Linear regression
        slope, intercept, r_value, _, std_err = stats.linregress(x, data)

        # Generate predictions
        future_x = np.arange(n, n + periods)
        predictions = [float(intercept + slope * x) for x in future_x]

        # Confidence intervals
        z_score = stats.norm.ppf((1 + confidence_level) / 2)
        residuals = data - (intercept + slope * x)
        residual_std = np.std(residuals)

        # Prediction intervals widen with distance
        lower_bound = [float(p - z_score * residual_std * np.sqrt(1 + 1/n + (fx - np.mean(x))**2 / np.sum((x - np.mean(x))**2)))
                       for p, fx in zip(predictions, future_x)]
        upper_bound = [float(p + z_score * residual_std * np.sqrt(1 + 1/n + (fx - np.mean(x))**2 / np.sum((x - np.mean(x))**2)))
                       for p, fx in zip(predictions, future_x)]

        return {
            "predictions": predictions,
            "lowerBound": lower_bound,
            "upperBound": upper_bound,
            "parameters": {
                "slope": float(slope),
                "intercept": float(intercept),
                "r_squared": float(r_value ** 2)
            }
        }

    def _exponential_smoothing_forecast(
        self,
        data: np.ndarray,
        periods: int,
        confidence_level: float
    ) -> dict:
        """Exponential Smoothing forecast (Holt's method)"""
        try:
            from statsmodels.tsa.holtwinters import ExponentialSmoothing

            # Fit model
            model = ExponentialSmoothing(
                data,
                trend='add',
                seasonal=None,
                initialization_method='estimated'
            )
            fitted = model.fit(optimized=True)

            # Generate forecast
            forecast = fitted.forecast(periods)
            predictions = [float(x) for x in forecast]

            # Confidence intervals from residuals
            residuals = data - fitted.fittedvalues
            residual_std = np.std(residuals)
            z_score = stats.norm.ppf((1 + confidence_level) / 2)

            lower_bound = [float(p - z_score * residual_std * np.sqrt(i + 1)) for i, p in enumerate(predictions)]
            upper_bound = [float(p + z_score * residual_std * np.sqrt(i + 1)) for i, p in enumerate(predictions)]

            return {
                "predictions": predictions,
                "lowerBound": lower_bound,
                "upperBound": upper_bound,
                "parameters": {
                    "alpha": float(fitted.params.get('smoothing_level', 0)),
                    "beta": float(fitted.params.get('smoothing_trend', 0))
                }
            }

        except ImportError:
            logger.warning("statsmodels not available, falling back to simple exponential smoothing")
            return self._simple_exponential_smoothing(data, periods, confidence_level)

    def _simple_exponential_smoothing(
        self,
        data: np.ndarray,
        periods: int,
        confidence_level: float,
        alpha: float = 0.3
    ) -> dict:
        """Simple exponential smoothing without statsmodels"""
        n = len(data)

        # Calculate smoothed values
        smoothed = np.zeros(n)
        smoothed[0] = data[0]
        for i in range(1, n):
            smoothed[i] = alpha * data[i] + (1 - alpha) * smoothed[i - 1]

        # Forecast is last smoothed value
        last_smoothed = smoothed[-1]
        predictions = [float(last_smoothed)] * periods

        # Confidence intervals
        residuals = data - smoothed
        residual_std = np.std(residuals)
        z_score = stats.norm.ppf((1 + confidence_level) / 2)

        lower_bound = [float(last_smoothed - z_score * residual_std * np.sqrt(i + 1)) for i in range(periods)]
        upper_bound = [float(last_smoothed + z_score * residual_std * np.sqrt(i + 1)) for i in range(periods)]

        return {
            "predictions": predictions,
            "lowerBound": lower_bound,
            "upperBound": upper_bound,
            "parameters": {"alpha": alpha}
        }

    def _seasonal_forecast(
        self,
        data: np.ndarray,
        periods: int,
        seasonality: Optional[int],
        confidence_level: float
    ) -> dict:
        """Seasonal decomposition forecast"""
        try:
            from statsmodels.tsa.holtwinters import ExponentialSmoothing

            # Auto-detect seasonality if not provided
            if seasonality is None:
                seasonality = self._detect_seasonal_period(data)

            if seasonality and len(data) >= seasonality * 2:
                model = ExponentialSmoothing(
                    data,
                    trend='add',
                    seasonal='add',
                    seasonal_periods=seasonality,
                    initialization_method='estimated'
                )
                fitted = model.fit(optimized=True)
                forecast = fitted.forecast(periods)
                predictions = [float(x) for x in forecast]

                residuals = data - fitted.fittedvalues
                residual_std = np.std(residuals)
                z_score = stats.norm.ppf((1 + confidence_level) / 2)

                lower_bound = [float(p - z_score * residual_std) for p in predictions]
                upper_bound = [float(p + z_score * residual_std) for p in predictions]

                return {
                    "predictions": predictions,
                    "lowerBound": lower_bound,
                    "upperBound": upper_bound,
                    "parameters": {"seasonality": seasonality}
                }

        except Exception as e:
            logger.warning(f"Seasonal forecast failed: {e}")

        # Fallback to exponential smoothing
        return self._exponential_smoothing_forecast(data, periods, confidence_level)

    def _detect_seasonal_period(self, data: np.ndarray) -> Optional[int]:
        """Detect seasonal period from data"""
        if len(data) < 24:
            return None

        # Try common seasonal periods
        for period in [12, 7, 4]:
            if len(data) >= period * 2:
                # Check if autocorrelation at this lag is significant
                mean = np.mean(data)
                var = np.var(data)
                if var == 0:
                    continue

                normalized = data - mean
                if len(normalized) > period:
                    acf = np.sum(normalized[:-period] * normalized[period:]) / (var * (len(data) - period))
                    if acf > 0.3:
                        return period

        return None

    def _auto_forecast(
        self,
        data: np.ndarray,
        periods: int,
        confidence_level: float
    ) -> dict:
        """Auto-select best forecast method based on cross-validation"""
        algorithms = [
            (ForecastAlgorithm.MOVING_AVERAGE, self._moving_average_forecast),
            (ForecastAlgorithm.LINEAR_TREND, self._linear_trend_forecast),
            (ForecastAlgorithm.EXPONENTIAL_SMOOTHING, self._exponential_smoothing_forecast)
        ]

        best_algo = None
        best_error = float('inf')
        best_result = None

        # Simple holdout validation
        if len(data) > 5:
            train_size = len(data) - min(3, periods)
            train_data = data[:train_size]
            test_data = data[train_size:]

            for algo, func in algorithms:
                try:
                    result = func(train_data, len(test_data), confidence_level)
                    predictions = result.get("predictions", [])

                    if len(predictions) == len(test_data):
                        mse = np.mean((np.array(predictions) - test_data) ** 2)
                        if mse < best_error:
                            best_error = mse
                            best_algo = algo
                except Exception as e:
                    logger.debug(f"Algorithm {algo} failed in cross-validation: {e}")
                    continue

        # Generate final forecast with best algorithm (or default)
        if best_algo == ForecastAlgorithm.MOVING_AVERAGE:
            best_result = self._moving_average_forecast(data, periods, confidence_level)
        elif best_algo == ForecastAlgorithm.LINEAR_TREND:
            best_result = self._linear_trend_forecast(data, periods, confidence_level)
        else:
            best_result = self._exponential_smoothing_forecast(data, periods, confidence_level)

        best_result["selectedAlgorithm"] = best_algo.value if best_algo else "exponential_smoothing"
        best_result["validationError"] = float(best_error) if best_error != float('inf') else None

        return best_result

    def calculate_accuracy_metrics(
        self,
        actual: List[float],
        predicted: List[float]
    ) -> Dict[str, float]:
        """Calculate forecast accuracy metrics"""
        actual_arr = np.array(actual)
        predicted_arr = np.array(predicted)

        # Handle length mismatch
        min_len = min(len(actual_arr), len(predicted_arr))
        actual_arr = actual_arr[:min_len]
        predicted_arr = predicted_arr[:min_len]

        errors = actual_arr - predicted_arr
        abs_errors = np.abs(errors)
        squared_errors = errors ** 2

        # Mean Absolute Error
        mae = float(np.mean(abs_errors))

        # Mean Squared Error
        mse = float(np.mean(squared_errors))

        # Root Mean Squared Error
        rmse = float(np.sqrt(mse))

        # Mean Absolute Percentage Error (handle zeros)
        non_zero_mask = actual_arr != 0
        if non_zero_mask.any():
            mape = float(np.mean(np.abs(errors[non_zero_mask] / actual_arr[non_zero_mask])) * 100)
        else:
            mape = None

        return {
            "mae": mae,
            "mse": mse,
            "rmse": rmse,
            "mape": mape
        }
