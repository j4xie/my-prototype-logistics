from __future__ import annotations
"""
Insight Dimensions Framework

Multi-dimensional insight generation following BI best practices:
- Descriptive: What happened
- Diagnostic: Why it happened
- Predictive: What will happen
- Prescriptive: What to do

Part of SmartBI Phase 4: Enhanced AI Insights.
"""
import logging
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Dict, List, Optional, Tuple

import pandas as pd
import numpy as np
from scipy import stats

logger = logging.getLogger(__name__)


class InsightDimension(str, Enum):
    """Classification of insight dimensions"""

    # Descriptive Analysis
    WHAT_HAPPENED = "what_happened"      # Core metrics, changes
    KEY_METRICS = "key_metrics"          # KPI summary

    # Diagnostic Analysis
    WHY_HAPPENED = "why_happened"        # Drivers of change
    ROOT_CAUSE = "root_cause"            # Root cause analysis
    CORRELATION = "correlation"          # Correlated factors

    # Predictive Analysis
    FORECAST = "forecast"                # Future predictions
    TREND = "trend"                      # Trend analysis
    RISK = "risk"                        # Risk identification

    # Prescriptive Analysis
    RECOMMENDATION = "recommendation"    # Action suggestions
    OPPORTUNITY = "opportunity"          # Growth opportunities

    # Comparative Analysis
    BENCHMARK = "benchmark"              # vs benchmarks
    PEER_COMPARISON = "peer_comparison"  # vs peers
    TIME_COMPARISON = "time_comparison"  # YoY, MoM

    # Anomaly Detection
    ANOMALY = "anomaly"                  # Unusual patterns
    OUTLIER = "outlier"                  # Statistical outliers


class InsightType(str, Enum):
    """Types of insights"""
    TREND = "trend"                 # Direction over time
    ANOMALY = "anomaly"             # Unexpected value
    COMPARISON = "comparison"       # A vs B
    KPI = "kpi"                     # Key metric
    RECOMMENDATION = "recommendation"  # Action item
    CORRELATION = "correlation"     # Relationship
    DISTRIBUTION = "distribution"   # Data spread
    RANKING = "ranking"             # Top/bottom items


class ImpactLevel(str, Enum):
    """Impact level of insight"""
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"


@dataclass
class Insight:
    """Single insight from analysis"""
    dimension: InsightDimension
    type: InsightType
    title: str
    description: str

    impact: ImpactLevel = ImpactLevel.MEDIUM
    confidence: float = 0.8

    # Supporting data
    metric_name: Optional[str] = None
    metric_value: Optional[float] = None
    comparison_value: Optional[float] = None
    change_percentage: Optional[float] = None

    # Related items
    action_items: List[str] = field(default_factory=list)
    related_kpis: List[str] = field(default_factory=list)
    evidence: List[str] = field(default_factory=list)

    # Visualization suggestion
    suggested_chart: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "dimension": self.dimension.value,
            "type": self.type.value,
            "title": self.title,
            "description": self.description,
            "impact": self.impact.value,
            "confidence": self.confidence,
            "metric_name": self.metric_name,
            "metric_value": self.metric_value,
            "comparison_value": self.comparison_value,
            "change_percentage": self.change_percentage,
            "action_items": self.action_items,
            "related_kpis": self.related_kpis,
            "evidence": self.evidence,
            "suggested_chart": self.suggested_chart
        }


@dataclass
class InsightReport:
    """Complete insight report"""
    executive_summary: str
    insights: List[Insight]
    risk_alerts: List[Insight] = field(default_factory=list)
    opportunities: List[Insight] = field(default_factory=list)

    # Metadata
    data_period: Optional[str] = None
    analysis_scope: Optional[str] = None
    confidence_score: float = 0.8

    def to_dict(self) -> Dict[str, Any]:
        return {
            "executive_summary": self.executive_summary,
            "insights": [i.to_dict() for i in self.insights],
            "risk_alerts": [i.to_dict() for i in self.risk_alerts],
            "opportunities": [i.to_dict() for i in self.opportunities],
            "metadata": {
                "data_period": self.data_period,
                "analysis_scope": self.analysis_scope,
                "confidence_score": self.confidence_score,
                "total_insights": len(self.insights),
                "high_impact_count": sum(1 for i in self.insights if i.impact == ImpactLevel.HIGH)
            }
        }


class KPIDefinitions:
    """Standard KPI definitions for different domains"""

    # Financial KPIs
    FINANCIAL_KPIS = {
        "gross_margin": {
            "name": "毛利率",
            "formula": "(revenue - cogs) / revenue",
            "benchmark_low": 0.20,
            "benchmark_high": 0.40,
            "industry_avg": 0.28
        },
        "operating_margin": {
            "name": "营业利润率",
            "formula": "operating_profit / revenue",
            "benchmark_low": 0.05,
            "benchmark_high": 0.15,
            "industry_avg": 0.10
        },
        "net_margin": {
            "name": "净利率",
            "formula": "net_profit / revenue",
            "benchmark_low": 0.03,
            "benchmark_high": 0.10,
            "industry_avg": 0.06
        },
        "roa": {
            "name": "资产回报率",
            "formula": "net_profit / total_assets",
            "benchmark_low": 0.03,
            "benchmark_high": 0.12,
            "industry_avg": 0.06
        },
        "roe": {
            "name": "净资产收益率",
            "formula": "net_profit / equity",
            "benchmark_low": 0.08,
            "benchmark_high": 0.20,
            "industry_avg": 0.12
        },
        "current_ratio": {
            "name": "流动比率",
            "formula": "current_assets / current_liabilities",
            "benchmark_low": 1.2,
            "benchmark_high": 2.0,
            "industry_avg": 1.5
        },
        "debt_ratio": {
            "name": "资产负债率",
            "formula": "total_liabilities / total_assets",
            "benchmark_low": 0.30,
            "benchmark_high": 0.60,
            "industry_avg": 0.45
        }
    }

    # Sales KPIs
    SALES_KPIS = {
        "conversion_rate": {
            "name": "转化率",
            "formula": "orders / visits",
            "benchmark_low": 0.01,
            "benchmark_high": 0.05,
            "industry_avg": 0.025
        },
        "average_order_value": {
            "name": "客单价",
            "formula": "revenue / orders",
            "benchmark_low": 100,
            "benchmark_high": 500,
            "industry_avg": 250
        },
        "customer_acquisition_cost": {
            "name": "获客成本",
            "formula": "marketing_cost / new_customers",
            "benchmark_low": 50,
            "benchmark_high": 200,
            "industry_avg": 100
        },
        "repeat_purchase_rate": {
            "name": "复购率",
            "formula": "repeat_customers / total_customers",
            "benchmark_low": 0.20,
            "benchmark_high": 0.50,
            "industry_avg": 0.30
        },
        "revenue_growth_rate": {
            "name": "收入增长率",
            "formula": "(current_revenue - previous_revenue) / previous_revenue",
            "benchmark_low": 0.05,
            "benchmark_high": 0.30,
            "industry_avg": 0.15
        }
    }

    # Operations KPIs
    OPERATIONS_KPIS = {
        "inventory_turnover": {
            "name": "存货周转率",
            "formula": "cogs / average_inventory",
            "benchmark_low": 4,
            "benchmark_high": 12,
            "industry_avg": 6
        },
        "receivables_turnover": {
            "name": "应收账款周转率",
            "formula": "revenue / average_receivables",
            "benchmark_low": 6,
            "benchmark_high": 12,
            "industry_avg": 8
        },
        "days_sales_outstanding": {
            "name": "应收账款周转天数",
            "formula": "365 / receivables_turnover",
            "benchmark_low": 30,
            "benchmark_high": 60,
            "industry_avg": 45
        }
    }


class InsightDimensionAnalyzer:
    """
    Multi-dimensional insight generator.

    Analyzes data from multiple perspectives:
    1. Descriptive - What happened
    2. Diagnostic - Why it happened
    3. Predictive - What will happen
    4. Prescriptive - What to do
    """

    def __init__(self):
        self.kpi_definitions = KPIDefinitions()

    def analyze(
        self,
        df: pd.DataFrame,
        context: Optional[Dict[str, Any]] = None,
        focus_dimensions: Optional[List[InsightDimension]] = None
    ) -> InsightReport:
        """
        Generate multi-dimensional insights from data.

        Args:
            df: Data to analyze
            context: Optional context (table type, period, etc.)
            focus_dimensions: Optional list of dimensions to focus on

        Returns:
            InsightReport with comprehensive analysis
        """
        insights = []
        risk_alerts = []
        opportunities = []

        # Default to all dimensions if not specified
        if focus_dimensions is None:
            focus_dimensions = [
                InsightDimension.WHAT_HAPPENED,
                InsightDimension.WHY_HAPPENED,
                InsightDimension.FORECAST,
                InsightDimension.RECOMMENDATION
            ]

        # 1. Descriptive Analysis (What happened)
        if InsightDimension.WHAT_HAPPENED in focus_dimensions:
            descriptive = self._analyze_what_happened(df, context)
            insights.extend(descriptive)

        # 2. Diagnostic Analysis (Why)
        if InsightDimension.WHY_HAPPENED in focus_dimensions:
            diagnostic = self._analyze_why_happened(df, context)
            insights.extend(diagnostic)

        # 3. Predictive Analysis (Forecast)
        if InsightDimension.FORECAST in focus_dimensions:
            predictive = self._analyze_forecast(df, context)
            insights.extend(predictive)

        # 4. Prescriptive Analysis (Recommendations)
        if InsightDimension.RECOMMENDATION in focus_dimensions:
            prescriptive = self._generate_recommendations(df, insights, context)
            insights.extend(prescriptive)

        # 5. Anomaly Detection
        if InsightDimension.ANOMALY in focus_dimensions:
            anomalies = self._detect_anomalies(df, context)
            insights.extend(anomalies)

        # Separate risks and opportunities
        for insight in insights:
            if insight.impact == ImpactLevel.HIGH:
                if insight.dimension == InsightDimension.RISK:
                    risk_alerts.append(insight)
                elif insight.dimension == InsightDimension.OPPORTUNITY:
                    opportunities.append(insight)

        # Generate executive summary
        executive_summary = self._generate_executive_summary(
            insights, risk_alerts, opportunities, context
        )

        # Calculate overall confidence
        confidence = np.mean([i.confidence for i in insights]) if insights else 0.5

        return InsightReport(
            executive_summary=executive_summary,
            insights=insights,
            risk_alerts=risk_alerts,
            opportunities=opportunities,
            data_period=context.get("period") if context else None,
            analysis_scope=context.get("scope") if context else None,
            confidence_score=confidence
        )

    def _analyze_what_happened(
        self,
        df: pd.DataFrame,
        context: Optional[Dict[str, Any]]
    ) -> List[Insight]:
        """Descriptive analysis: What happened"""
        insights = []

        # Get numeric columns for analysis
        numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()

        for col in numeric_cols[:5]:  # Limit to top 5 metrics
            values = df[col].dropna()
            if len(values) < 2:
                continue

            # Calculate basic stats
            current = values.iloc[-1] if len(values) > 0 else 0
            previous = values.iloc[-2] if len(values) > 1 else current
            mean_val = values.mean()

            # Calculate change
            if previous != 0:
                change_pct = (current - previous) / abs(previous) * 100
            else:
                change_pct = 0

            # Determine trend direction
            if len(values) >= 3:
                slope = self._calculate_trend_slope(values)
                trend = "增长" if slope > 0.05 else "下降" if slope < -0.05 else "稳定"
            else:
                trend = "增长" if change_pct > 0 else "下降" if change_pct < 0 else "持平"

            # Create insight
            insight = Insight(
                dimension=InsightDimension.WHAT_HAPPENED,
                type=InsightType.TREND,
                title=f"{col}呈{trend}趋势",
                description=f"{col}当前值为{current:,.2f}，较前期变化{change_pct:+.1f}%",
                metric_name=col,
                metric_value=current,
                comparison_value=previous,
                change_percentage=change_pct,
                impact=ImpactLevel.HIGH if abs(change_pct) > 20 else ImpactLevel.MEDIUM if abs(change_pct) > 5 else ImpactLevel.LOW,
                confidence=0.9,
                suggested_chart="line" if len(values) > 3 else "bar"
            )
            insights.append(insight)

        return insights

    def _analyze_why_happened(
        self,
        df: pd.DataFrame,
        context: Optional[Dict[str, Any]]
    ) -> List[Insight]:
        """Diagnostic analysis: Why it happened"""
        insights = []

        numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()

        if len(numeric_cols) < 2:
            return insights

        # Find correlations between metrics
        try:
            corr_matrix = df[numeric_cols].corr()

            for i, col1 in enumerate(numeric_cols):
                for col2 in numeric_cols[i+1:]:
                    corr = corr_matrix.loc[col1, col2]

                    if abs(corr) > 0.7:
                        relationship = "正相关" if corr > 0 else "负相关"
                        insight = Insight(
                            dimension=InsightDimension.WHY_HAPPENED,
                            type=InsightType.CORRELATION,
                            title=f"{col1}与{col2}高度{relationship}",
                            description=f"相关系数为{corr:.2f}，{col1}的变化可能影响{col2}",
                            metric_name=col1,
                            confidence=abs(corr),
                            related_kpis=[col1, col2],
                            suggested_chart="scatter"
                        )
                        insights.append(insight)
        except Exception as e:
            logger.warning(f"Correlation analysis failed: {e}")

        # Contribution analysis (if we have a total column)
        total_cols = [c for c in numeric_cols if "合计" in str(c) or "total" in str(c).lower()]
        if total_cols:
            for total_col in total_cols:
                contribution = self._analyze_contribution(df, total_col, numeric_cols)
                insights.extend(contribution)

        return insights

    def _analyze_contribution(
        self,
        df: pd.DataFrame,
        total_col: str,
        all_cols: List[str]
    ) -> List[Insight]:
        """Analyze contribution to total"""
        insights = []

        try:
            total = df[total_col].iloc[-1]
            if total == 0:
                return insights

            component_cols = [c for c in all_cols if c != total_col]
            contributions = []

            for col in component_cols:
                value = df[col].iloc[-1]
                contrib_pct = value / total * 100 if total != 0 else 0
                contributions.append((col, value, contrib_pct))

            # Sort by contribution
            contributions.sort(key=lambda x: abs(x[2]), reverse=True)

            # Top contributor insight
            if contributions:
                top = contributions[0]
                insight = Insight(
                    dimension=InsightDimension.WHY_HAPPENED,
                    type=InsightType.DISTRIBUTION,
                    title=f"{top[0]}是主要贡献因素",
                    description=f"{top[0]}占{total_col}的{top[2]:.1f}%，是最大的构成部分",
                    metric_name=top[0],
                    metric_value=top[1],
                    change_percentage=top[2],
                    impact=ImpactLevel.HIGH if top[2] > 50 else ImpactLevel.MEDIUM,
                    confidence=0.9,
                    suggested_chart="pie"
                )
                insights.append(insight)

        except Exception as e:
            logger.warning(f"Contribution analysis failed: {e}")

        return insights

    def _analyze_forecast(
        self,
        df: pd.DataFrame,
        context: Optional[Dict[str, Any]]
    ) -> List[Insight]:
        """Predictive analysis: What will happen"""
        insights = []

        numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()

        for col in numeric_cols[:3]:  # Limit to top 3
            values = df[col].dropna()
            if len(values) < 5:
                continue

            try:
                # Simple linear trend projection
                x = np.arange(len(values))
                slope, intercept, r_value, _, _ = stats.linregress(x, values)

                # Project next period
                next_value = slope * len(values) + intercept
                current = values.iloc[-1]

                if current != 0:
                    projected_change = (next_value - current) / abs(current) * 100
                else:
                    projected_change = 0

                trend_direction = "增长" if projected_change > 0 else "下降"

                insight = Insight(
                    dimension=InsightDimension.FORECAST,
                    type=InsightType.TREND,
                    title=f"{col}预计将{trend_direction}",
                    description=f"基于历史趋势，{col}下期预计为{next_value:,.2f}，较当前{projected_change:+.1f}%",
                    metric_name=col,
                    metric_value=current,
                    comparison_value=next_value,
                    change_percentage=projected_change,
                    impact=ImpactLevel.MEDIUM,
                    confidence=max(0.3, abs(r_value)),  # Use R-squared as confidence
                    suggested_chart="line_forecast"
                )
                insights.append(insight)

            except Exception as e:
                logger.debug(f"Forecast for {col} failed: {e}")

        return insights

    def _generate_recommendations(
        self,
        df: pd.DataFrame,
        existing_insights: List[Insight],
        context: Optional[Dict[str, Any]]
    ) -> List[Insight]:
        """Prescriptive analysis: What to do"""
        insights = []

        # Generate recommendations based on existing insights
        for insight in existing_insights:
            if insight.dimension == InsightDimension.WHAT_HAPPENED:
                if insight.change_percentage and insight.change_percentage < -10:
                    # Declining metric - suggest investigation
                    rec = Insight(
                        dimension=InsightDimension.RECOMMENDATION,
                        type=InsightType.RECOMMENDATION,
                        title=f"建议关注{insight.metric_name}下降问题",
                        description=f"{insight.metric_name}下降{abs(insight.change_percentage):.1f}%，建议分析原因并采取措施",
                        impact=ImpactLevel.HIGH,
                        confidence=0.8,
                        action_items=[
                            f"分析{insight.metric_name}下降的主要原因",
                            "制定改进计划",
                            "设置监控指标"
                        ],
                        related_kpis=[insight.metric_name] if insight.metric_name else []
                    )
                    insights.append(rec)

            elif insight.dimension == InsightDimension.ANOMALY:
                # Anomaly detected - suggest review
                rec = Insight(
                    dimension=InsightDimension.RECOMMENDATION,
                    type=InsightType.RECOMMENDATION,
                    title=f"建议核查{insight.metric_name}异常值",
                    description="检测到异常数据，建议进行数据核查",
                    impact=ImpactLevel.MEDIUM,
                    confidence=0.7,
                    action_items=[
                        "核实数据准确性",
                        "排查异常原因"
                    ],
                    related_kpis=[insight.metric_name] if insight.metric_name else []
                )
                insights.append(rec)

        return insights

    def _detect_anomalies(
        self,
        df: pd.DataFrame,
        context: Optional[Dict[str, Any]]
    ) -> List[Insight]:
        """Detect statistical anomalies"""
        insights = []

        numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()

        for col in numeric_cols:
            values = df[col].dropna()
            if len(values) < 5:
                continue

            try:
                # Z-score based anomaly detection
                mean = values.mean()
                std = values.std()

                if std == 0:
                    continue

                z_scores = (values - mean) / std

                for idx, (z, val) in enumerate(zip(z_scores, values)):
                    if abs(z) > 2.5:  # Anomaly threshold
                        direction = "异常高" if z > 0 else "异常低"
                        insight = Insight(
                            dimension=InsightDimension.ANOMALY,
                            type=InsightType.ANOMALY,
                            title=f"{col}存在{direction}的数据点",
                            description=f"第{idx+1}行数据{val:,.2f}偏离均值{abs(z):.1f}个标准差",
                            metric_name=col,
                            metric_value=val,
                            comparison_value=mean,
                            impact=ImpactLevel.HIGH if abs(z) > 3 else ImpactLevel.MEDIUM,
                            confidence=min(0.95, abs(z) / 4),
                            evidence=[f"Z-score: {z:.2f}", f"均值: {mean:.2f}", f"标准差: {std:.2f}"],
                            suggested_chart="box"
                        )
                        insights.append(insight)

            except Exception as e:
                logger.debug(f"Anomaly detection for {col} failed: {e}")

        return insights

    def _calculate_trend_slope(self, values: pd.Series) -> float:
        """Calculate normalized trend slope"""
        try:
            x = np.arange(len(values))
            slope, _, _, _, _ = stats.linregress(x, values)

            # Normalize by mean
            mean = values.mean()
            if mean != 0:
                return slope / abs(mean)
            return 0
        except Exception:
            return 0

    def _generate_executive_summary(
        self,
        insights: List[Insight],
        risk_alerts: List[Insight],
        opportunities: List[Insight],
        context: Optional[Dict[str, Any]]
    ) -> str:
        """Generate executive summary from insights"""

        if not insights:
            return "数据量不足，无法生成有效分析。"

        # Count by impact
        high_impact = [i for i in insights if i.impact == ImpactLevel.HIGH]

        # Find key trends
        trends = [i for i in insights if i.dimension == InsightDimension.WHAT_HAPPENED]
        positive_trends = [t for t in trends if t.change_percentage and t.change_percentage > 0]
        negative_trends = [t for t in trends if t.change_percentage and t.change_percentage < 0]

        summary_parts = []

        # Overall assessment
        if len(positive_trends) > len(negative_trends):
            summary_parts.append("整体表现向好")
        elif len(negative_trends) > len(positive_trends):
            summary_parts.append("整体表现承压")
        else:
            summary_parts.append("整体表现平稳")

        # Key highlights
        if positive_trends:
            top_positive = max(positive_trends, key=lambda x: x.change_percentage or 0)
            summary_parts.append(f"，{top_positive.metric_name}增长{top_positive.change_percentage:.1f}%")

        if negative_trends:
            top_negative = min(negative_trends, key=lambda x: x.change_percentage or 0)
            summary_parts.append(f"，但{top_negative.metric_name}下降{abs(top_negative.change_percentage):.1f}%需关注")

        # Risks and opportunities
        if risk_alerts:
            summary_parts.append(f"。识别到{len(risk_alerts)}项风险")

        if opportunities:
            summary_parts.append(f"，{len(opportunities)}项增长机会")

        summary_parts.append("。")

        return "".join(summary_parts)
