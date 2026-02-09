"""
Statistical Analyzer Service

Professional statistical analysis module for SmartBI.
Provides distribution analysis, time series analysis, comparison analysis, and correlation analysis.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Tuple
from enum import Enum

import numpy as np
import pandas as pd
from scipy import stats as scipy_stats

logger = logging.getLogger(__name__)


class DistributionType(str, Enum):
    """Distribution type classification"""
    NORMAL = "normal"
    SKEWED_RIGHT = "skewed_right"
    SKEWED_LEFT = "skewed_left"
    BIMODAL = "bimodal"
    UNIFORM = "uniform"
    HEAVY_TAILED = "heavy_tailed"
    UNKNOWN = "unknown"


@dataclass
class StatisticalReport:
    """Statistical analysis report for a numeric column"""
    # Basic statistics
    count: int = 0
    sum: float = 0.0
    mean: float = 0.0
    median: float = 0.0
    mode: Optional[float] = None
    std: float = 0.0
    variance: float = 0.0

    # Percentiles
    percentiles: Dict[str, float] = field(default_factory=dict)

    # Distribution characteristics
    skewness: float = 0.0
    kurtosis: float = 0.0
    distribution_type: str = "unknown"

    # Extreme values
    min_value: float = 0.0
    max_value: float = 0.0
    range_value: float = 0.0
    iqr: float = 0.0

    # Outliers
    outliers: List[float] = field(default_factory=list)
    outlier_count: int = 0
    outlier_indices: List[int] = field(default_factory=list)

    # Additional metrics
    coefficient_of_variation: float = 0.0
    normality_p_value: Optional[float] = None
    is_normal: bool = False


@dataclass
class TimeSeriesReport:
    """Time series analysis report"""
    # Period comparisons
    yoy_change: Optional[float] = None  # Year over Year
    mom_change: Optional[float] = None  # Month over Month
    wow_change: Optional[float] = None  # Week over Week

    # Trend analysis
    trend_direction: str = "stable"  # up, down, stable
    trend_slope: float = 0.0
    trend_r_squared: float = 0.0

    # Growth metrics
    cagr: Optional[float] = None  # Compound Annual Growth Rate
    growth_rate: float = 0.0

    # Moving averages
    ma_7: Optional[float] = None
    ma_30: Optional[float] = None
    ma_90: Optional[float] = None

    # Seasonality
    has_seasonality: bool = False
    seasonal_period: Optional[int] = None

    # Forecast (simple linear)
    forecast_next: Optional[float] = None
    forecast_trend: str = "stable"


@dataclass
class ComparisonReport:
    """Comparison analysis report for a dimension"""
    # Ranking
    ranking: Dict[str, float] = field(default_factory=dict)
    top_3: Dict[str, float] = field(default_factory=dict)
    bottom_3: Dict[str, float] = field(default_factory=dict)

    # Share analysis
    share: Dict[str, float] = field(default_factory=dict)

    # Concentration metrics
    cr3: float = 0.0  # Top 3 concentration ratio
    cr5: float = 0.0  # Top 5 concentration ratio
    hhi: float = 0.0  # Herfindahl-Hirschman Index

    # Pareto analysis
    pareto_count: int = 0  # Number of items contributing 80%
    pareto_ratio: float = 0.0

    # Gap analysis
    max_vs_min_ratio: Optional[float] = None
    coefficient_of_variation: float = 0.0
    gini_coefficient: float = 0.0

    # Statistics
    total_items: int = 0
    total_value: float = 0.0


@dataclass
class CorrelationReport:
    """Correlation analysis report"""
    # Correlation matrix
    correlation_matrix: Dict[str, Dict[str, float]] = field(default_factory=dict)

    # Strong correlations
    strong_positive: List[Dict[str, Any]] = field(default_factory=list)
    strong_negative: List[Dict[str, Any]] = field(default_factory=list)

    # Top correlation
    top_correlation: Optional[Dict[str, Any]] = None


class StatisticalAnalyzer:
    """Professional statistical analysis service"""

    def __init__(self):
        self.outlier_threshold = 1.5  # IQR multiplier for outlier detection

    def analyze(self, data: pd.DataFrame, measure: str) -> StatisticalReport:
        """
        Perform comprehensive statistical analysis on a numeric column.

        Args:
            data: DataFrame containing the data
            measure: Column name to analyze

        Returns:
            StatisticalReport with all statistics
        """
        if measure not in data.columns:
            logger.warning(f"Column {measure} not found in data")
            return StatisticalReport()

        # Convert to numeric, coercing errors to NaN (handles mixed-type columns)
        values = pd.to_numeric(data[measure], errors='coerce').dropna()

        if len(values) == 0:
            logger.warning(f"Column {measure} has no numeric values after conversion")
            return StatisticalReport(count=0)

        report = StatisticalReport()

        # Basic statistics
        report.count = len(values)
        report.sum = float(values.sum())
        report.mean = float(values.mean())
        report.median = float(values.median())
        report.std = float(values.std()) if len(values) > 1 else 0.0
        report.variance = float(values.var()) if len(values) > 1 else 0.0

        # Mode (most frequent value)
        try:
            mode_result = values.mode()
            report.mode = float(mode_result.iloc[0]) if len(mode_result) > 0 else None
        except Exception:
            report.mode = None

        # Percentiles
        report.percentiles = {
            'p10': float(values.quantile(0.10)),
            'p25': float(values.quantile(0.25)),
            'p50': float(values.quantile(0.50)),
            'p75': float(values.quantile(0.75)),
            'p90': float(values.quantile(0.90)),
            'p95': float(values.quantile(0.95)),
            'p99': float(values.quantile(0.99))
        }

        # Distribution characteristics
        if len(values) > 2:
            report.skewness = float(values.skew())
            report.kurtosis = float(values.kurtosis())
        report.distribution_type = self._identify_distribution(values)

        # Extreme values
        report.min_value = float(values.min())
        report.max_value = float(values.max())
        report.range_value = report.max_value - report.min_value
        report.iqr = report.percentiles['p75'] - report.percentiles['p25']

        # Outliers (IQR method)
        outliers_data = self._detect_outliers_iqr(values)
        report.outliers = outliers_data['values']
        report.outlier_count = len(report.outliers)
        report.outlier_indices = outliers_data['indices']

        # Coefficient of variation
        if report.mean != 0:
            report.coefficient_of_variation = (report.std / abs(report.mean)) * 100

        # Normality test (Shapiro-Wilk for small samples, D'Agostino for larger)
        if 3 <= len(values) <= 5000:
            try:
                if len(values) <= 50:
                    stat, p_value = scipy_stats.shapiro(values)
                else:
                    stat, p_value = scipy_stats.normaltest(values)
                report.normality_p_value = float(p_value)
                report.is_normal = p_value > 0.05
            except Exception:
                pass

        return report

    def analyze_time_series(
        self,
        data: pd.DataFrame,
        time_col: str,
        value_col: str
    ) -> TimeSeriesReport:
        """
        Perform time series analysis.

        Args:
            data: DataFrame with time and value columns
            time_col: Name of time column
            value_col: Name of value column

        Returns:
            TimeSeriesReport with time series metrics
        """
        report = TimeSeriesReport()

        if time_col not in data.columns or value_col not in data.columns:
            return report

        try:
            df = data[[time_col, value_col]].dropna().copy()
            if len(df) < 3:
                return report

            # Convert time column if needed
            if not pd.api.types.is_datetime64_any_dtype(df[time_col]):
                df[time_col] = pd.to_datetime(df[time_col], errors='coerce')

            df = df.dropna().sort_values(time_col)
            values = df[value_col]

            # Period comparisons
            report.yoy_change = self._calculate_yoy(df, time_col, value_col)
            report.mom_change = self._calculate_mom(df, time_col, value_col)
            report.wow_change = self._calculate_wow(df, time_col, value_col)

            # Trend analysis
            trend_info = self._analyze_trend(values)
            report.trend_direction = trend_info['direction']
            report.trend_slope = trend_info['slope']
            report.trend_r_squared = trend_info['r_squared']

            # Growth rate
            if len(values) >= 2 and values.iloc[0] != 0:
                report.growth_rate = ((values.iloc[-1] - values.iloc[0]) / abs(values.iloc[0])) * 100

            # CAGR (if time span > 1 year)
            report.cagr = self._calculate_cagr(df, time_col, value_col)

            # Moving averages
            if len(values) >= 7:
                report.ma_7 = float(values.rolling(7).mean().iloc[-1])
            if len(values) >= 30:
                report.ma_30 = float(values.rolling(30).mean().iloc[-1])
            if len(values) >= 90:
                report.ma_90 = float(values.rolling(90).mean().iloc[-1])

            # Simple forecast
            report.forecast_next = self._simple_forecast(values)
            if report.forecast_next is not None and len(values) > 0:
                last_val = values.iloc[-1]
                if last_val != 0:
                    change = ((report.forecast_next - last_val) / abs(last_val)) * 100
                    report.forecast_trend = "up" if change > 5 else ("down" if change < -5 else "stable")

        except Exception as e:
            logger.error(f"Time series analysis failed: {e}")

        return report

    def compare_dimensions(
        self,
        data: pd.DataFrame,
        dim: str,
        measure: str
    ) -> ComparisonReport:
        """
        Perform comparison analysis across dimension values.

        Args:
            data: DataFrame with dimension and measure columns
            dim: Dimension column name
            measure: Measure column name

        Returns:
            ComparisonReport with comparison metrics
        """
        report = ComparisonReport()

        if dim not in data.columns or measure not in data.columns:
            return report

        try:
            # Convert measure to numeric, coercing errors to NaN
            data_copy = data.copy()
            data_copy[measure] = pd.to_numeric(data_copy[measure], errors='coerce')
            grouped = data_copy.groupby(dim)[measure].sum().sort_values(ascending=False)
            if grouped.empty:
                return report

            total = grouped.sum()
            report.total_items = len(grouped)
            report.total_value = float(total)

            if total == 0:
                return report

            # Ranking
            report.ranking = grouped.to_dict()

            # Top 3 / Bottom 3
            report.top_3 = grouped.head(3).to_dict()
            report.bottom_3 = grouped.tail(3).to_dict()

            # Share (percentage)
            report.share = ((grouped / total) * 100).to_dict()

            # Concentration ratios
            if len(grouped) >= 3:
                report.cr3 = float((grouped.head(3).sum() / total) * 100)
            if len(grouped) >= 5:
                report.cr5 = float((grouped.head(5).sum() / total) * 100)

            # HHI (Herfindahl-Hirschman Index)
            shares = grouped / total
            report.hhi = float((shares ** 2).sum() * 10000)  # Scale to 0-10000

            # Pareto analysis (80/20 rule)
            cumsum = grouped.cumsum() / total
            pareto_mask = cumsum <= 0.8
            report.pareto_count = pareto_mask.sum() + 1  # +1 for the item that crosses 80%
            report.pareto_ratio = (report.pareto_count / len(grouped)) * 100

            # Gap analysis
            if grouped.min() > 0:
                report.max_vs_min_ratio = float(grouped.max() / grouped.min())

            if grouped.mean() != 0:
                report.coefficient_of_variation = float((grouped.std() / grouped.mean()) * 100)

            # Gini coefficient
            report.gini_coefficient = self._calculate_gini(grouped.values)

        except Exception as e:
            logger.error(f"Comparison analysis failed: {e}")

        return report

    def analyze_correlations(
        self,
        data: pd.DataFrame,
        measures: List[str]
    ) -> CorrelationReport:
        """
        Analyze correlations between multiple measures.

        Args:
            data: DataFrame containing measures
            measures: List of measure column names

        Returns:
            CorrelationReport with correlation analysis
        """
        report = CorrelationReport()

        # Filter to existing columns
        valid_measures = [m for m in measures if m in data.columns]
        if len(valid_measures) < 2:
            return report

        try:
            # Convert all measures to numeric, coercing errors to NaN
            numeric_data = data[valid_measures].apply(pd.to_numeric, errors='coerce').dropna()
            if len(numeric_data) < 3:
                return report

            # Calculate correlation matrix
            corr_matrix = numeric_data.corr()
            report.correlation_matrix = corr_matrix.to_dict()

            # Find strong correlations
            for i in range(len(corr_matrix.columns)):
                for j in range(i + 1, len(corr_matrix.columns)):
                    var1 = corr_matrix.columns[i]
                    var2 = corr_matrix.columns[j]
                    r = corr_matrix.iloc[i, j]

                    if abs(r) > 0.7:
                        corr_info = {
                            'var1': var1,
                            'var2': var2,
                            'correlation': float(r),
                            'strength': 'strong_positive' if r > 0 else 'strong_negative'
                        }

                        if r > 0:
                            report.strong_positive.append(corr_info)
                        else:
                            report.strong_negative.append(corr_info)

            # Find top correlation
            all_corrs = report.strong_positive + report.strong_negative
            if all_corrs:
                report.top_correlation = max(all_corrs, key=lambda x: abs(x['correlation']))

        except Exception as e:
            logger.error(f"Correlation analysis failed: {e}")

        return report

    def _identify_distribution(self, values: pd.Series) -> str:
        """Identify distribution type based on skewness and kurtosis"""
        if len(values) < 3:
            return DistributionType.UNKNOWN.value

        skew = values.skew()
        kurt = values.kurtosis()

        # Check for normality
        if abs(skew) < 0.5 and abs(kurt) < 1:
            return DistributionType.NORMAL.value

        # Check for heavy tails
        if kurt > 3:
            return DistributionType.HEAVY_TAILED.value

        # Check for skewness
        if skew > 1:
            return DistributionType.SKEWED_RIGHT.value
        elif skew < -1:
            return DistributionType.SKEWED_LEFT.value

        # Check for uniform distribution
        if abs(kurt) < 0.5 and abs(skew) < 0.5:
            # Additional check: compare std to range
            std_ratio = values.std() / (values.max() - values.min()) if (values.max() - values.min()) > 0 else 0
            if 0.25 < std_ratio < 0.35:
                return DistributionType.UNIFORM.value

        return DistributionType.UNKNOWN.value

    def _detect_outliers_iqr(self, values: pd.Series) -> Dict[str, List]:
        """Detect outliers using IQR method"""
        q1 = values.quantile(0.25)
        q3 = values.quantile(0.75)
        iqr = q3 - q1

        lower_bound = q1 - self.outlier_threshold * iqr
        upper_bound = q3 + self.outlier_threshold * iqr

        outlier_mask = (values < lower_bound) | (values > upper_bound)
        outlier_values = values[outlier_mask]

        return {
            'values': [float(v) for v in outlier_values.tolist()],
            'indices': [int(i) for i in outlier_values.index.tolist()]
        }

    def _calculate_yoy(self, df: pd.DataFrame, time_col: str, value_col: str) -> Optional[float]:
        """Calculate Year-over-Year change"""
        try:
            df = df.set_index(time_col).sort_index()
            current = df[value_col].iloc[-1]
            # Find value from ~12 months ago
            one_year_ago = df.index[-1] - pd.DateOffset(years=1)
            past_data = df[df.index <= one_year_ago]
            if len(past_data) > 0:
                past_val = past_data[value_col].iloc[-1]
                if past_val != 0:
                    return float(((current - past_val) / abs(past_val)) * 100)
        except Exception:
            pass
        return None

    def _calculate_mom(self, df: pd.DataFrame, time_col: str, value_col: str) -> Optional[float]:
        """Calculate Month-over-Month change"""
        try:
            if len(df) < 2:
                return None
            current = df[value_col].iloc[-1]
            previous = df[value_col].iloc[-2]
            if previous != 0:
                return float(((current - previous) / abs(previous)) * 100)
        except Exception:
            pass
        return None

    def _calculate_wow(self, df: pd.DataFrame, time_col: str, value_col: str) -> Optional[float]:
        """Calculate Week-over-Week change"""
        try:
            df = df.set_index(time_col).sort_index()
            current = df[value_col].iloc[-1]
            one_week_ago = df.index[-1] - pd.DateOffset(weeks=1)
            past_data = df[df.index <= one_week_ago]
            if len(past_data) > 0:
                past_val = past_data[value_col].iloc[-1]
                if past_val != 0:
                    return float(((current - past_val) / abs(past_val)) * 100)
        except Exception:
            pass
        return None

    def _analyze_trend(self, values: pd.Series) -> Dict[str, Any]:
        """Analyze trend using linear regression"""
        result = {'direction': 'stable', 'slope': 0.0, 'r_squared': 0.0}

        if len(values) < 3:
            return result

        try:
            x = np.arange(len(values))
            y = values.values

            # Linear regression
            slope, intercept, r_value, p_value, std_err = scipy_stats.linregress(x, y)

            result['slope'] = float(slope)
            result['r_squared'] = float(r_value ** 2)

            # Determine direction based on slope significance
            if r_value ** 2 > 0.3:  # Only if fit is reasonable
                if slope > 0 and abs(slope) > values.mean() * 0.01:
                    result['direction'] = 'up'
                elif slope < 0 and abs(slope) > values.mean() * 0.01:
                    result['direction'] = 'down'

        except Exception:
            pass

        return result

    def _calculate_cagr(self, df: pd.DataFrame, time_col: str, value_col: str) -> Optional[float]:
        """Calculate Compound Annual Growth Rate"""
        try:
            df = df.set_index(time_col).sort_index()
            first_val = df[value_col].iloc[0]
            last_val = df[value_col].iloc[-1]

            if first_val <= 0 or last_val <= 0:
                return None

            # Calculate years between first and last
            years = (df.index[-1] - df.index[0]).days / 365.25

            if years < 0.5:  # Need at least 6 months
                return None

            cagr = ((last_val / first_val) ** (1 / years) - 1) * 100
            return float(cagr)

        except Exception:
            pass
        return None

    def _simple_forecast(self, values: pd.Series) -> Optional[float]:
        """Simple linear forecast for next period"""
        if len(values) < 3:
            return None

        try:
            x = np.arange(len(values))
            y = values.values

            slope, intercept, _, _, _ = scipy_stats.linregress(x, y)
            forecast = intercept + slope * len(values)

            return float(forecast)

        except Exception:
            pass
        return None

    def _calculate_gini(self, values: np.ndarray) -> float:
        """Calculate Gini coefficient"""
        try:
            values = np.sort(values)
            n = len(values)
            if n == 0 or values.sum() == 0:
                return 0.0

            index = np.arange(1, n + 1)
            gini = ((2 * index - n - 1) * values).sum() / (n * values.sum())
            return float(gini)

        except Exception:
            return 0.0


# Convenience functions for quick analysis
def quick_stats(data: pd.DataFrame, measure: str) -> Dict[str, Any]:
    """Quick statistical summary"""
    analyzer = StatisticalAnalyzer()
    report = analyzer.analyze(data, measure)

    return {
        'count': report.count,
        'sum': report.sum,
        'mean': report.mean,
        'median': report.median,
        'std': report.std,
        'min': report.min_value,
        'max': report.max_value,
        'outlier_count': report.outlier_count,
        'distribution_type': report.distribution_type
    }


def quick_comparison(data: pd.DataFrame, dim: str, measure: str) -> Dict[str, Any]:
    """Quick comparison summary"""
    analyzer = StatisticalAnalyzer()
    report = analyzer.compare_dimensions(data, dim, measure)

    return {
        'top_3': report.top_3,
        'bottom_3': report.bottom_3,
        'cr3': report.cr3,
        'pareto_count': report.pareto_count,
        'gini': report.gini_coefficient
    }
