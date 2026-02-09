from __future__ import annotations
"""
Insight Generator Service

Generates AI-powered business insights from data analysis.
"""
import asyncio
import logging
import json
from typing import Any, Optional, List, Dict
from enum import Enum

import httpx
import numpy as np
import pandas as pd

from config import get_settings
from common.utils.json_parser import robust_json_parse
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

        if abs(first_val) < 1e-6:
            return None

        growth_rate = ((last_val - first_val) / abs(first_val)) * 100
        # Cap extreme growth rates
        growth_rate = max(min(growth_rate, 10000), -10000)

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
            # Prepare enriched data summary for LLM
            data_summary = self._prepare_data_summary(df)
            financial_metrics = self._compute_financial_context(df)
            metrics_summary = self._prepare_metrics_summary(metrics) if metrics else ""

            # Prepare context from extracted Excel notes/explanations
            excel_context = ""
            if context_info and context_info.has_content():
                excel_context = f"""
## 报表上下文信息（来自原始Excel）
{context_info.to_prompt_text()}
"""

            prompt = f"""你是一位为管理层撰写月度经营分析报告的资深财务分析师。
请基于以下数据提供深度业务分析，而非简单的统计描述。

## 数据概览
{data_summary}

{financial_metrics}

{f'## 已计算指标{chr(10)}{metrics_summary}' if metrics_summary else ''}

{f'## 业务背景{chr(10)}{json.dumps(context, ensure_ascii=False)}' if context else ''}
{excel_context}

## 分析要求

请按以下结构输出JSON格式分析结果：

{{
    "executive_summary": "一句话管理摘要（含关键数字，不超过60字）",
    "insights": [
        {{
            "dimension": "what_happened|why_happened|forecast|recommendation",
            "type": "trend|anomaly|comparison|kpi|recommendation",
            "title": "洞察标题（简洁有力）",
            "text": "详细描述（必须包含：具体数字 + 业务含义 + 对比基准）",
            "metric": "相关指标名称",
            "sentiment": "positive/negative/neutral",
            "importance": 1-10,
            "confidence": 0.0-1.0,
            "action_items": ["建议行动1", "建议行动2"],
            "recommendation": "具体改进建议（必须可量化、可执行）"
        }}
    ],
    "risk_alerts": [
        {{
            "title": "风险标题",
            "description": "风险描述（含影响程度的具体数字）",
            "severity": "high|medium|low",
            "mitigation": "建议措施（含预期效果）"
        }}
    ],
    "opportunities": [
        {{
            "title": "机会标题",
            "description": "机会描述",
            "potential_impact": "预期影响（量化）",
            "action_required": "所需行动"
        }}
    ]
}}

## 写作规范（严格遵守）

1. **禁止空话**: 不要写"呈现上升/下降趋势"，改为"Q3毛利率28.4%，较Q1下降2.1个百分点，主因原料成本占比从58%升至61%"
2. **每条洞察必须有**: 具体数字 + 业务解读 + 对比基准（环比/同比/行业均值/目标值）
3. **因果分析**: 不止说"下降"，要分析可能的驱动因素
4. **建议可执行**: 每条建议需含优先级、预期效果、责任方向
5. **行业对标**: 食品加工行业参考基准 — 毛利率25-35%、净利率3-8%、费用率15-25%
6. **列名翻译**: 将"2025-01-01"类列名解读为"1月"，将英文字段名翻译为中文业务名
7. **risk_alerts至少1条**, severity取值high/medium/low
8. **opportunities至少1条**, 描述具体可行的改善方向
9. **insights至少4条**, 覆盖 what_happened/why_happened/forecast/recommendation 四个维度"""

            response = await self._call_llm(prompt)
            return self._parse_llm_insights(response, stat_insights)

        except Exception as e:
            logger.error(f"LLM insight generation failed: {e}")
            return stat_insights

    def _prepare_data_summary(self, df: pd.DataFrame) -> str:
        """Prepare enriched data summary for LLM"""
        summary_parts = [
            f"- 数据行数: {len(df)}",
            f"- 数据列 ({len(df.columns)}个): {', '.join(df.columns.tolist()[:15])}"
        ]

        # Detect label column (first text column)
        text_cols = df.select_dtypes(include=['object']).columns
        if len(text_cols) > 0:
            label_col = text_cols[0]
            labels = df[label_col].dropna().unique().tolist()
            if labels:
                summary_parts.append(f"- 数据项目({label_col}): {', '.join(str(l) for l in labels[:20])}")

        # Add numeric column stats with more detail
        numeric_cols = df.select_dtypes(include=[np.number]).columns
        for col in numeric_cols[:8]:
            values = df[col].dropna()
            if len(values) == 0:
                continue
            parts = [f"总计={values.sum():,.2f}", f"均值={values.mean():,.2f}",
                     f"中位数={values.median():,.2f}", f"最大={values.max():,.2f}",
                     f"最小={values.min():,.2f}"]
            # Add trend info if enough data points
            if len(values) >= 3:
                first, last = values.iloc[0], values.iloc[-1]
                if abs(first) > 1e-6:
                    change_pct = ((last - first) / abs(first)) * 100
                    parts.append(f"首尾变化={change_pct:+.1f}%")
            summary_parts.append(f"- {col}: {', '.join(parts)}")

        # Sample data rows for context
        if len(df) > 0:
            sample_rows = df.head(3).to_dict('records')
            sample_text = json.dumps(sample_rows, ensure_ascii=False, default=str)
            if len(sample_text) < 1500:
                summary_parts.append(f"\n样本数据(前3行):\n{sample_text}")

        return "\n".join(summary_parts)

    def _compute_financial_context(self, df: pd.DataFrame) -> str:
        """Pre-compute financial metrics to give LLM better 'ingredients'"""
        parts = []

        # Find label column
        text_cols = df.select_dtypes(include=['object']).columns
        if len(text_cols) == 0:
            return ""

        label_col = text_cols[0]
        numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()
        if not numeric_cols:
            return ""

        # Detect monthly columns (YYYY-MM-DD pattern)
        monthly_cols = [c for c in numeric_cols if pd.to_datetime(c, errors='coerce', format='%Y-%m-%d') is not pd.NaT]
        if not monthly_cols:
            # Try other patterns
            monthly_cols = [c for c in numeric_cols if any(p in c for p in ['月', '年'])]

        # Financial keyword matching
        kw_map = {
            '营业收入': ['营业收入', '主营业务收入'],
            '营业成本': ['营业成本', '主营业务成本'],
            '毛利': ['毛利润', '毛利'],
            '净利润': ['净利润', '利润总额'],
            '费用': ['销售费用', '管理费用', '财务费用', '研发费用'],
        }

        found_rows = {}
        for _, row in df.iterrows():
            label = str(row.get(label_col, '')).strip()
            if not label:
                continue
            for category, keywords in kw_map.items():
                for kw in keywords:
                    if kw in label:
                        row_values = {}
                        total = 0
                        for nc in numeric_cols:
                            val = row.get(nc)
                            if pd.notna(val) and isinstance(val, (int, float)):
                                row_values[nc] = val
                                total += val
                        if row_values:
                            found_rows[label] = {'values': row_values, 'total': total}
                        break

        if not found_rows:
            return ""

        parts.append("## 预计算财务指标")

        # Output found financial rows
        for label, info in found_rows.items():
            total = info['total']
            if abs(total) >= 1e8:
                display = f"{total/1e8:.2f}亿"
            elif abs(total) >= 1e4:
                display = f"{total/1e4:.2f}万"
            else:
                display = f"{total:,.2f}"
            parts.append(f"- {label}: 合计 {display}")

            # Monthly trend for this row
            if monthly_cols and len(info['values']) >= 3:
                vals = [info['values'].get(m) for m in monthly_cols if m in info['values']]
                if len(vals) >= 2:
                    non_zero = [v for v in vals if v and v != 0]
                    if non_zero:
                        first_nz, last_nz = non_zero[0], non_zero[-1]
                        if abs(first_nz) > 1e-6:
                            trend_pct = ((last_nz - first_nz) / abs(first_nz)) * 100
                            parts.append(f"  趋势: {trend_pct:+.1f}% (从{first_nz:,.0f}到{last_nz:,.0f})")

        # Compute ratio metrics if we found revenue and cost
        revenue_total = None
        cost_total = None
        net_profit_total = None
        for label, info in found_rows.items():
            if '营业收入' in label or '主营业务收入' in label:
                revenue_total = info['total']
            if '营业成本' in label or '主营业务成本' in label:
                cost_total = info['total']
            if '净利润' in label:
                net_profit_total = info['total']

        if revenue_total and abs(revenue_total) > 0:
            if cost_total is not None:
                gross_margin = (revenue_total - cost_total) / abs(revenue_total) * 100
                parts.append(f"- 毛利率: {gross_margin:.1f}% (行业参考: 25-35%)")
            if net_profit_total is not None:
                net_margin = net_profit_total / abs(revenue_total) * 100
                parts.append(f"- 净利率: {net_margin:.1f}% (行业参考: 3-8%)")
            # Expense ratios
            for label, info in found_rows.items():
                if '费用' in label and info['total']:
                    expense_ratio = info['total'] / abs(revenue_total) * 100
                    parts.append(f"- {label}率: {expense_ratio:.1f}%")

        return "\n".join(parts) if len(parts) > 1 else ""

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
        """Call LLM API with timeout and retry"""
        headers = {
            "Authorization": f"Bearer {self.settings.llm_api_key}",
            "Content-Type": "application/json"
        }

        payload = {
            "model": self.settings.llm_model,
            "messages": [
                {
                    "role": "system",
                    "content": "你是一位资深财务分析师，正在为食品加工企业管理层撰写经营分析报告。你的分析风格：数据驱动、因果明确、建议可执行。请严格用JSON格式回复。"
                },
                {
                    "role": "user",
                    "content": prompt
                }
            ],
            "temperature": 0.5,
            "max_tokens": 4000
        }

        max_attempts = 3
        for attempt in range(max_attempts):
            try:
                timeout_secs = 60.0 + attempt * 15.0  # 60s, 75s, 90s
                response = await self.client.post(
                    f"{self.settings.llm_base_url}/chat/completions",
                    headers=headers,
                    json=payload,
                    timeout=httpx.Timeout(timeout_secs)
                )
                response.raise_for_status()

                result = response.json()
                return result["choices"][0]["message"]["content"]
            except httpx.TimeoutException:
                logger.warning(f"LLM call timeout (attempt {attempt + 1}/{max_attempts}, timeout={timeout_secs}s)")
                if attempt < max_attempts - 1:
                    await asyncio.sleep(2 ** attempt * 2)
                else:
                    logger.error("LLM call failed after all retry attempts due to timeout")
                    return ""
            except httpx.HTTPStatusError as e:
                logger.warning(f"LLM call HTTP error {e.response.status_code} (attempt {attempt + 1}/{max_attempts})")
                if attempt < max_attempts - 1:
                    await asyncio.sleep(2 ** attempt * 2)
                else:
                    logger.error(f"LLM call failed after all retry attempts: {e}")
                    return ""
        return ""

    def _parse_llm_insights(
        self,
        response: str,
        fallback_insights: List[dict]
    ) -> List[dict]:
        """Parse LLM response into structured insights with _meta envelope"""
        try:
            # Parse JSON from response using robust parser
            logger.debug(f"LLM raw response (first 200 chars): {response[:200]}")
            result = robust_json_parse(response, fallback=None)
            if result is None:
                logger.warning(f"Failed to parse LLM response as JSON")
                return fallback_insights
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

            # Inject _meta insight with executive_summary, risk_alerts, opportunities
            executive_summary = result.get("executive_summary", "")
            risk_alerts = result.get("risk_alerts", [])
            opportunities = result.get("opportunities", [])

            if executive_summary or risk_alerts or opportunities:
                meta_insight = {
                    "type": "_meta",
                    "text": executive_summary,
                    "executive_summary": executive_summary,
                    "risk_alerts": risk_alerts,
                    "opportunities": opportunities,
                    "importance": 10,
                    "source": "llm"
                }
                valid_insights.insert(0, meta_insight)

            return valid_insights if valid_insights else fallback_insights

        except Exception as e:
            logger.error(f"Failed to parse LLM insights: {e}")
            return fallback_insights

    async def close(self):
        """Close HTTP client"""
        await self.client.aclose()
