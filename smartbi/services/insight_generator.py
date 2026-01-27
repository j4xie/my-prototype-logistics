from __future__ import annotations
"""
Insight Generator Service

Generates AI-powered business insights from data analysis.
"""
import logging
import json
from typing import Any, Optional, List, Dict
from enum import Enum

import httpx
import numpy as np
import pandas as pd

from config import get_settings
from services.context_extractor import ContextInfo

logger = logging.getLogger(__name__)


class InsightType(str, Enum):
    """Types of business insights"""
    TREND = "trend"  # Trend analysis
    ANOMALY = "anomaly"  # Anomaly detection
    COMPARISON = "comparison"  # Comparison insights
    FORECAST = "forecast"  # Forecast-based insights
    RECOMMENDATION = "recommendation"  # Actionable recommendations
    SUMMARY = "summary"  # Summary statistics


class InsightGenerator:
    """AI-powered insight generation service"""

    # Insight templates for rule-based fallback
    INSIGHT_TEMPLATES = {
        "growth_positive": "在分析期间，{metric}呈现上升趋势，增长率为{rate:.1f}%。",
        "growth_negative": "在分析期间，{metric}呈现下降趋势，降幅为{rate:.1f}%。",
        "high_performer": "{dimension}表现突出，{metric}达到{value}，占总体的{ratio:.1f}%。",
        "low_performer": "{dimension}表现较弱，{metric}仅为{value}，需要关注和改进。",
        "anomaly_high": "检测到异常高值：{date}的{metric}达到{value}，较平均值高{deviation:.1f}%。",
        "anomaly_low": "检测到异常低值：{date}的{metric}为{value}，较平均值低{deviation:.1f}%。",
        "target_achieved": "目标完成情况良好，{metric}完成率达到{rate:.1f}%。",
        "target_missed": "目标未达成，{metric}完成率仅为{rate:.1f}%，差距为{gap}。",
        "forecast_growth": "根据趋势预测，未来{period}期的{metric}预计将增长{rate:.1f}%。",
        "forecast_decline": "根据趋势预测，未来{period}期的{metric}预计将下降{rate:.1f}%。"
    }

    def __init__(self):
        self.settings = get_settings()
        self.client = httpx.AsyncClient(timeout=60.0)

    async def generate_insights(
        self,
        data: List[dict],
        metrics: Optional[List[dict]] = None,
        analysis_context: Optional[str] = None,
        insight_types: Optional[List[str]] = None,
        max_insights: int = 5,
        context_info: Optional[ContextInfo] = None
    ) -> Dict[str, Any]:
        """
        Generate business insights from data

        Args:
            data: Data records
            metrics: Pre-calculated metrics
            analysis_context: Business context description
            insight_types: Types of insights to generate
            max_insights: Maximum number of insights to return
            context_info: Extracted context from Excel (notes, explanations, definitions)

        Returns:
            Generated insights
        """
        try:
            df = pd.DataFrame(data)

            if df.empty:
                return {
                    "success": True,
                    "insights": [],
                    "message": "No data available for analysis"
                }

            # Generate statistical insights first
            stat_insights = self._generate_statistical_insights(df, metrics)

            # If LLM is available, enhance with AI insights
            if self.settings.llm_api_key:
                ai_insights = await self._generate_llm_insights(
                    df, metrics, stat_insights, analysis_context, context_info
                )
                insights = ai_insights
            else:
                insights = stat_insights

            # Filter by requested types
            if insight_types:
                insights = [i for i in insights if i.get("type") in insight_types]

            # Limit results
            insights = insights[:max_insights]

            return {
                "success": True,
                "insights": insights,
                "totalGenerated": len(insights),
                "method": "llm" if self.settings.llm_api_key else "statistical"
            }

        except Exception as e:
            logger.error(f"Insight generation failed: {e}", exc_info=True)
            return {
                "success": False,
                "error": str(e),
                "insights": []
            }

    def _generate_statistical_insights(
        self,
        df: pd.DataFrame,
        metrics: Optional[List[dict]]
    ) -> List[dict]:
        """Generate rule-based statistical insights"""
        insights = []

        # Analyze each numeric column
        numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()

        for col in numeric_cols:
            values = df[col].dropna()
            if len(values) < 2:
                continue

            # Trend analysis
            trend_insight = self._analyze_trend(col, values)
            if trend_insight:
                insights.append(trend_insight)

            # Anomaly detection
            anomaly_insights = self._detect_anomalies(df, col, values)
            insights.extend(anomaly_insights)

        # Comparison insights for categorical dimensions
        cat_cols = df.select_dtypes(include=['object', 'category']).columns.tolist()
        for cat_col in cat_cols:
            for num_col in numeric_cols[:2]:  # Limit to avoid too many
                comparison = self._generate_comparison(df, cat_col, num_col)
                if comparison:
                    insights.append(comparison)

        # Add metric-based insights if provided
        if metrics:
            metric_insights = self._analyze_metrics(metrics)
            insights.extend(metric_insights)

        # Sort by importance
        insights.sort(key=lambda x: x.get("importance", 0), reverse=True)

        return insights

    def _analyze_trend(self, column: str, values: pd.Series) -> Optional[dict]:
        """Analyze trend for a numeric column"""
        if len(values) < 3:
            return None

        # Calculate growth rate (first to last)
        first_val = values.iloc[0]
        last_val = values.iloc[-1]

        if first_val == 0:
            return None

        growth_rate = ((last_val - first_val) / abs(first_val)) * 100

        if abs(growth_rate) < 5:  # Ignore small changes
            return None

        if growth_rate > 0:
            text = self.INSIGHT_TEMPLATES["growth_positive"].format(
                metric=column,
                rate=growth_rate
            )
            sentiment = "positive"
        else:
            text = self.INSIGHT_TEMPLATES["growth_negative"].format(
                metric=column,
                rate=abs(growth_rate)
            )
            sentiment = "negative"

        return {
            "type": InsightType.TREND.value,
            "text": text,
            "metric": column,
            "value": float(last_val),
            "changeRate": float(growth_rate),
            "sentiment": sentiment,
            "importance": min(abs(growth_rate) / 10, 10)
        }

    def _detect_anomalies(self, df: pd.DataFrame, column: str, values: pd.Series) -> List[dict]:
        """Detect anomalies using statistical methods"""
        insights = []

        if len(values) < 5:
            return insights

        mean = values.mean()
        std = values.std()

        if std == 0:
            return insights

        # Find values more than 2 standard deviations from mean
        z_scores = (values - mean) / std
        anomaly_mask = abs(z_scores) > 2

        for idx in values[anomaly_mask].index:
            value = values[idx]
            deviation = ((value - mean) / mean) * 100 if mean != 0 else 0

            # Try to get date/index for context
            date_str = str(idx)
            if 'date' in df.columns:
                date_str = str(df.loc[idx, 'date'])

            if value > mean:
                text = self.INSIGHT_TEMPLATES["anomaly_high"].format(
                    date=date_str,
                    metric=column,
                    value=f"{value:,.2f}",
                    deviation=abs(deviation)
                )
                sentiment = "warning"
            else:
                text = self.INSIGHT_TEMPLATES["anomaly_low"].format(
                    date=date_str,
                    metric=column,
                    value=f"{value:,.2f}",
                    deviation=abs(deviation)
                )
                sentiment = "negative"

            insights.append({
                "type": InsightType.ANOMALY.value,
                "text": text,
                "metric": column,
                "value": float(value),
                "deviation": float(deviation),
                "sentiment": sentiment,
                "importance": min(abs(z_scores[idx]) * 2, 10)
            })

        return insights[:3]  # Limit anomalies

    def _generate_comparison(
        self,
        df: pd.DataFrame,
        cat_column: str,
        num_column: str
    ) -> Optional[dict]:
        """Generate comparison insight for categorical dimension"""
        if cat_column not in df.columns or num_column not in df.columns:
            return None

        grouped = df.groupby(cat_column)[num_column].sum()
        if grouped.empty:
            return None

        total = grouped.sum()
        if total == 0:
            return None

        # Find top performer
        top = grouped.idxmax()
        top_value = grouped[top]
        top_ratio = (top_value / total) * 100

        text = self.INSIGHT_TEMPLATES["high_performer"].format(
            dimension=f"{cat_column}={top}",
            metric=num_column,
            value=f"{top_value:,.2f}",
            ratio=top_ratio
        )

        return {
            "type": InsightType.COMPARISON.value,
            "text": text,
            "dimension": cat_column,
            "topValue": str(top),
            "metric": num_column,
            "value": float(top_value),
            "ratio": float(top_ratio),
            "sentiment": "positive",
            "importance": 5
        }

    def _analyze_metrics(self, metrics: List[dict]) -> List[dict]:
        """Generate insights from pre-calculated metrics"""
        insights = []

        for metric in metrics:
            if not metric.get("success"):
                continue

            name = metric.get("name", metric.get("metric", ""))
            value = metric.get("value")
            unit = metric.get("unit", "")

            if value is None:
                continue

            # Target completion insights
            if "完成率" in name or "completion" in metric.get("metric", "").lower():
                if value >= 100:
                    text = self.INSIGHT_TEMPLATES["target_achieved"].format(
                        metric=name,
                        rate=value
                    )
                    sentiment = "positive"
                else:
                    gap = 100 - value
                    text = self.INSIGHT_TEMPLATES["target_missed"].format(
                        metric=name,
                        rate=value,
                        gap=f"{gap:.1f}%"
                    )
                    sentiment = "negative"

                insights.append({
                    "type": InsightType.SUMMARY.value,
                    "text": text,
                    "metric": name,
                    "value": float(value),
                    "unit": unit,
                    "sentiment": sentiment,
                    "importance": 8
                })

        return insights

    async def _generate_llm_insights(
        self,
        df: pd.DataFrame,
        metrics: Optional[List[dict]],
        stat_insights: List[dict],
        context: Optional[str],
        context_info: Optional[ContextInfo] = None
    ) -> List[dict]:
        """Generate AI-powered insights using LLM"""
        try:
            # Prepare data summary for LLM
            data_summary = self._prepare_data_summary(df)
            metrics_summary = self._prepare_metrics_summary(metrics) if metrics else ""
            existing_insights = "\n".join([i["text"] for i in stat_insights[:3]])

            # Prepare context from extracted Excel notes/explanations
            excel_context = ""
            if context_info and context_info.has_content():
                excel_context = f"""
## 报表上下文信息（来自原始Excel）
{context_info.to_prompt_text()}
"""

            prompt = f"""作为资深商业数据分析师，请对以下数据进行深度分析。

## 分析框架 (MECE原则)

### 1. 描述性分析 (What Happened)
- 核心数据概览和关键指标表现
- 时间维度的变化情况

### 2. 诊断性分析 (Why)
- 变化的驱动因素
- 结构性分析（构成、占比）
- 相关性分析

### 3. 预测性分析 (What Next)
- 趋势预测
- 风险预警
- 机会识别

### 4. 规范性分析 (So What)
- 可执行的建议
- 优先级排序
- 预期影响

## 数据概览
{data_summary}

{f'## 已计算指标{chr(10)}{metrics_summary}' if metrics_summary else ''}

{f'## 业务背景{chr(10)}{context}' if context else ''}
{excel_context}
## 已识别的统计发现
{existing_insights}

请输出JSON格式的深度分析结果：
{{
    "executive_summary": "一句话核心结论",
    "insights": [
        {{
            "dimension": "what_happened|why_happened|forecast|recommendation",
            "type": "trend|anomaly|comparison|kpi|recommendation",
            "title": "洞察标题（简洁有力）",
            "text": "详细描述（包含具体数据和百分比）",
            "metric": "相关指标名称",
            "sentiment": "positive/negative/neutral",
            "importance": 1-10的重要性评分,
            "confidence": 0.0-1.0的置信度,
            "action_items": ["建议行动1", "建议行动2"],
            "related_kpis": ["相关KPI1", "相关KPI2"],
            "recommendation": "具体改进建议"
        }}
    ],
    "risk_alerts": [
        {{
            "title": "风险标题",
            "description": "风险描述",
            "severity": "high|medium|low",
            "mitigation": "建议措施"
        }}
    ],
    "opportunities": [
        {{
            "title": "机会标题",
            "description": "机会描述",
            "potential_impact": "预期影响",
            "action_required": "所需行动"
        }}
    ]
}}

要求：
1. 遵循MECE原则，洞察不重叠、不遗漏
2. 每条洞察必须包含具体数字和百分比
3. 洞察要可操作、可追踪
4. 使用中文
5. 如果有备注或编制说明，请在分析时充分考虑
6. 识别至少1个风险和1个机会
7. 建议按优先级排序"""

            response = await self._call_llm(prompt)
            return self._parse_llm_insights(response, stat_insights)

        except Exception as e:
            logger.error(f"LLM insight generation failed: {e}")
            return stat_insights

    def _prepare_data_summary(self, df: pd.DataFrame) -> str:
        """Prepare data summary for LLM"""
        summary_parts = [
            f"- 数据行数: {len(df)}",
            f"- 数据列: {', '.join(df.columns.tolist()[:10])}"
        ]

        # Add numeric column stats
        for col in df.select_dtypes(include=[np.number]).columns[:5]:
            summary_parts.append(
                f"- {col}: 总计={df[col].sum():,.2f}, 均值={df[col].mean():,.2f}, "
                f"最大={df[col].max():,.2f}, 最小={df[col].min():,.2f}"
            )

        return "\n".join(summary_parts)

    def _prepare_metrics_summary(self, metrics: List[dict]) -> str:
        """Prepare metrics summary for LLM"""
        summary_parts = []
        for m in metrics:
            if m.get("success") and m.get("value") is not None:
                summary_parts.append(
                    f"- {m.get('name', m.get('metric'))}: {m.get('value'):,.2f}{m.get('unit', '')}"
                )
        return "\n".join(summary_parts)

    async def _call_llm(self, prompt: str) -> str:
        """Call LLM API"""
        headers = {
            "Authorization": f"Bearer {self.settings.llm_api_key}",
            "Content-Type": "application/json"
        }

        payload = {
            "model": self.settings.llm_model,
            "messages": [
                {
                    "role": "system",
                    "content": "你是一个专业的商业数据分析师，擅长从数据中发现业务洞察和改进建议。请用JSON格式回复。"
                },
                {
                    "role": "user",
                    "content": prompt
                }
            ],
            "temperature": 0.5,
            "max_tokens": 2000
        }

        response = await self.client.post(
            f"{self.settings.llm_base_url}/chat/completions",
            headers=headers,
            json=payload
        )
        response.raise_for_status()

        result = response.json()
        return result["choices"][0]["message"]["content"]

    def _parse_llm_insights(
        self,
        response: str,
        fallback_insights: List[dict]
    ) -> List[dict]:
        """Parse LLM response into structured insights"""
        try:
            # Extract JSON from response
            json_match = response
            if "```json" in response:
                json_match = response.split("```json")[1].split("```")[0]
            elif "```" in response:
                json_match = response.split("```")[1].split("```")[0]

            result = json.loads(json_match)
            insights = result.get("insights", [])

            # Validate and clean insights
            valid_insights = []
            for insight in insights:
                if isinstance(insight, dict) and insight.get("text"):
                    valid_insights.append({
                        "type": insight.get("type", "summary"),
                        "text": insight.get("text"),
                        "metric": insight.get("metric"),
                        "sentiment": insight.get("sentiment", "neutral"),
                        "importance": insight.get("importance", 5),
                        "recommendation": insight.get("recommendation"),
                        "source": "llm"
                    })

            return valid_insights if valid_insights else fallback_insights

        except Exception as e:
            logger.error(f"Failed to parse LLM insights: {e}")
            return fallback_insights

    async def close(self):
        """Close HTTP client"""
        await self.client.aclose()
