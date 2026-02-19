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

    # LLM call timeout configuration
    LLM_TIMEOUT_BASE = 60.0       # Base timeout in seconds
    LLM_TIMEOUT_INCREMENT = 15.0  # Added per retry attempt
    LLM_TIMEOUT_MAX = 120.0       # Hard cap
    LLM_MAX_RETRIES = 3

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
        # Humanize column names so insight text uses friendly names
        df = self._humanize_df_columns(df)
        insights = []

        # Analyze each numeric column, skip unnamed/meaningless columns
        numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()
        import re as _re
        numeric_cols = [c for c in numeric_cols if not _re.match(r'^(Column_\d+|指标\d+|Unnamed|Unnamed:\s*\d+)$', str(c), _re.IGNORECASE)]

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

            # Try to get a meaningful label for the anomaly row
            date_str = None
            # 1. Try date column
            if 'date' in df.columns:
                date_str = str(df.loc[idx, 'date'])
            # 2. Try first text/object column as label (e.g. row name like "营业收入")
            if not date_str or date_str == str(idx):
                text_cols = df.select_dtypes(include=['object']).columns
                for tc in text_cols:
                    try:
                        label = df.loc[idx, tc]
                        if label and str(label).strip():
                            date_str = self._humanize_col(str(label).strip())
                            break
                    except Exception:
                        pass
            if not date_str:
                date_str = self._humanize_col(str(idx))

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

    def _detect_analysis_scenario(self, df: pd.DataFrame) -> str:
        """
        Detect the analysis scenario from column names and data.
        Returns one of: 'financial', 'sales', 'production', 'supply_chain', 'general'
        """
        col_text = '|'.join(df.columns.tolist()).lower()
        # Add sample data labels for better detection (sample 50 rows for wider coverage)
        text_cols = df.select_dtypes(include=['object']).columns
        if len(text_cols) > 0:
            labels = df[text_cols[0]].dropna().astype(str).tolist()[:50]
            col_text += '|' + '|'.join(labels).lower()

        scores = {
            'financial': 0,
            'sales': 0,
            'production': 0,
            'supply_chain': 0,
        }

        financial_kw = ['收入', '利润', '费用', '成本', '毛利', '净利', '营业', '资产', '负债',
                        '税', '折旧', '摊销', '预算', '金额', '合计', '应收', '应付', '现金',
                        '分红', '利润表', '资产负债', '损益',
                        'revenue', 'profit', 'cost', 'expense', 'margin', 'budget', 'actual']
        sales_kw = ['订单', '客户', '销量', '销售额', '退货', '客单价', '转化率', '渠道',
                     '区域', '经销商', '返利', '分部', '销售',
                     'order', 'customer', 'sales', 'channel', 'return']
        production_kw = ['产量', '良品', '废品', '设备', '利用率', '产能', 'oee', '能耗',
                          '用电', '水耗', '工时', '产线', 'yield', 'production', 'equipment']
        supply_chain_kw = ['库存', '到货', '供应商', '采购', '周转', '仓储', '物流', '缺货',
                            'inventory', 'supplier', 'procurement', 'warehouse', 'logistics']

        for kw in financial_kw:
            if kw in col_text:
                scores['financial'] += 1
        for kw in sales_kw:
            if kw in col_text:
                scores['sales'] += 1
        for kw in production_kw:
            if kw in col_text:
                scores['production'] += 1
        for kw in supply_chain_kw:
            if kw in col_text:
                scores['supply_chain'] += 1

        max_score = max(scores.values())
        if max_score == 0:
            return 'general'

        return max(scores, key=scores.get)

    def _get_scenario_system_role(self, scenario: str) -> str:
        """Get the LLM system role prompt based on detected scenario."""
        roles = {
            'financial': (
                "你是一位服务于食品加工企业CFO的资深财务分析师。"
                "你的职责是从经营数据中挖掘可执行的财务洞察。"
                "写作风格：数据驱动（每条结论必须引用具体数字）、因果明确（不仅说是什么更要说为什么）、"
                "建议可落地（含量化目标和时间节点）。"
                "行业参考范围（食品加工业通用，各子行业差异大）：毛利率15-35%、净利率3-8%、管理费用率5-10%、销售费用率8-15%。"
                "注意：禽类加工毛利约6-10%，乳制品10-15%，预制菜15-25%，调味品35-43%。请结合数据实际判断，勿机械对标。"
            ),
            'sales': (
                "你是一位服务于食品加工企业CMO的资深销售分析师。"
                "你的职责是从销售数据中发现增长机会和客户洞察。"
                "分析侧重：渠道效率、客户结构、区域表现、产品组合贡献度、退货异常。"
                "行业参考：食品行业平均客户保留率70-85%，渠道返利率3-8%，经销商集中度前5占比30-50%。"
            ),
            'production': (
                "你是一位服务于食品加工企业COO的资深生产运营分析师。"
                "你的职责是从生产数据中找出效率瓶颈和改进方向。"
                "分析侧重：OEE拆解(可用率×性能率×良品率)、能耗效率、产能利用率、废品率趋势。"
                "行业参考：食品加工OEE 60-85%、良品率95-99.5%、能耗成本占比5-15%。"
            ),
            'supply_chain': (
                "你是一位服务于食品加工企业供应链总监的资深供应链分析师。"
                "你的职责是从供应链数据中优化库存和采购效率。"
                "分析侧重：库存周转天数、供应商集中度、采购成本波动、缺货风险、物流时效。"
                "行业参考：食品行业存货周转30-90天、应收账款15-60天、原料成本占比50-70%。"
            ),
            'general': (
                "你是一位服务于食品加工企业管理层的资深数据分析师。"
                "你的职责是从数据中挖掘可执行的业务洞察。"
                "写作风格：数据驱动、因果明确、建议可落地。"
            ),
        }
        return roles.get(scenario, roles['general'])

    def _get_scenario_benchmarks(self, scenario: str) -> str:
        """Get scenario-specific benchmark text for the prompt."""
        if scenario == 'production':
            return (
                "生产对标基准：OEE 60-85%（食品加工业）、良品率 95-99.5%、废品率 1-5%、"
                "设备可用率 85-95%、能耗成本占总成本 5-15%、人均产出 行业中位数参考。"
            )
        if scenario == 'sales':
            return (
                "销售对标基准：客户保留率 70-85%、渠道返利率 3-8%、前5大客户占比 30-50%、"
                "客单价增长率 3-8%/年、退货率 <3%。"
            )
        if scenario == 'supply_chain':
            return (
                "供应链对标基准：存货周转 30-90天、应收周转 15-60天、采购集中度前3供应商 <40%、"
                "缺货率 <2%、物流准时率 >95%。"
            )
        # financial / general — ranges, not single values
        return (
            "财务参考范围（食品加工通用，子行业差异大）：毛利率15-35%、净利率3-8%、管理费用率5-10%、销售费用率8-15%。"
            "请根据数据实际判断所属子行业特征，避免机械对标。"
        )

    def _compute_production_context(self, df: pd.DataFrame) -> str:
        """Pre-compute production/OEE metrics for LLM context (analogous to _compute_financial_context)."""
        parts = []
        text_cols = df.select_dtypes(include=['object']).columns
        if len(text_cols) == 0:
            return ""
        label_col = text_cols[0]
        numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()
        if not numeric_cols:
            return ""

        prod_kw_map = {
            '产量': ['产量', '产出', '总产量', 'output', 'production'],
            '良品率': ['良品率', '合格率', '良率', 'yield', 'yield_rate'],
            '废品率': ['废品率', '不良率', '次品率', 'waste_rate', 'defect_rate'],
            '设备利用率': ['设备利用率', '利用率', '开机率', 'oee', 'utilization'],
            '能耗': ['能耗', '用电', '水耗', '电耗', 'energy', 'power'],
            '工时': ['工时', '人工时', '人时', 'labor_hours', 'man_hours'],
        }

        found_rows = {}
        for _, row in df.iterrows():
            label = str(row.get(label_col, '')).strip()
            if not label:
                continue
            for category, keywords in prod_kw_map.items():
                for kw in keywords:
                    if kw in label.lower():
                        row_values = {}
                        for nc in numeric_cols:
                            val = row.get(nc)
                            if pd.notna(val) and isinstance(val, (int, float)):
                                row_values[nc] = val
                        if row_values:
                            found_rows[label] = {'values': row_values, 'category': category}
                        break

        # Also check column names for production metrics
        col_metrics = {}
        for col in numeric_cols:
            col_lower = col.lower()
            for category, keywords in prod_kw_map.items():
                if any(kw in col_lower for kw in keywords):
                    values = df[col].dropna()
                    if len(values) > 0:
                        col_metrics[col] = {
                            'category': category,
                            'mean': float(values.mean()),
                            'min': float(values.min()),
                            'max': float(values.max()),
                        }
                    break

        if not found_rows and not col_metrics:
            return ""

        parts.append("## 预计算生产运营指标")

        for label, info in found_rows.items():
            vals = info['values']
            total = sum(vals.values())
            if abs(total) >= 1e4:
                display = f"{total/1e4:.2f}万"
            else:
                display = f"{total:,.2f}"
            parts.append(f"- {label} ({info['category']}): 合计 {display}")

        for col, info in col_metrics.items():
            parts.append(
                f"- 列 [{col}] ({info['category']}): 均值={info['mean']:.2f}, "
                f"范围=[{info['min']:.2f}, {info['max']:.2f}]"
            )

        # OEE benchmark context
        parts.append("### 生产行业基准")
        parts.append("  - OEE: 食品加工行业60-85%")
        parts.append("  - 良品率: 95-99.5%")
        parts.append("  - 废品率: 1-5%")
        parts.append("  - 能耗成本占比: 5-15%")

        return "\n".join(parts)

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
            production_metrics = self._compute_production_context(df)
            metrics_summary = self._prepare_metrics_summary(metrics) if metrics else ""

            # Detect analysis scenario for adaptive prompting
            scenario = self._detect_analysis_scenario(df)
            logger.info(f"Detected analysis scenario: {scenario}")

            # 新增：预计算关键统计摘要，减少 LLM 自行推算的不确定性
            stat_digest = self._compute_statistical_digest(df)

            # KB integration: detect food industry and inject domain knowledge
            kb_context = await self._get_food_kb_context(df)

            # Prepare context from extracted Excel notes/explanations
            excel_context = ""
            if context_info and context_info.has_content():
                excel_context = f"""
## 报表上下文信息（来自原始Excel）
{context_info.to_prompt_text()}
"""

            # Get scenario-specific benchmark text
            benchmark_text = self._get_scenario_benchmarks(scenario)

            # Build query-focus block at the top if user asked a question
            query_block = ""
            if context:
                query_block = f"""
## 核心任务（最高优先级）
用户提出了具体问题：「{context}」
你的所有分析必须围绕这个问题展开。executive_summary 必须直接回答这个问题，insights 的每一条都必须与用户问题主题相关。
禁止忽略用户问题而给出泛泛的财务综述。
"""

            prompt = f"""你是一位为食品加工企业管理层撰写经营分析报告的资深分析师。
分析场景：{scenario}
{benchmark_text}
你的角色是管理层的智囊——用数据说话，给出CEO能直接采纳的建议。
{query_block}
## 数据概览
{data_summary}

{financial_metrics}

{production_metrics}

{stat_digest}

{f'## 已计算指标{chr(10)}{metrics_summary}' if metrics_summary else ''}
{excel_context}
{kb_context}

## 输出格式（严格JSON）

{{
    "executive_summary": "直接回答用户问题的一句话摘要（不超过80字），必须包含具体数字",
    "insights": [
        {{
            "dimension": "what_happened|why_happened|forecast|recommendation",
            "type": "trend|anomaly|comparison|kpi|recommendation",
            "title": "洞察标题（不超过15字）",
            "text": "详细分析（80-150字，必须包含：1个以上具体数字 + 业务归因 + 行业对标或环比变化）",
            "metric": "相关指标名称",
            "sentiment": "positive|negative|neutral",
            "importance": 1-10,
            "confidence": 0.5-1.0,
            "action_items": ["可执行建议1（含预期效果）", "可执行建议2"],
            "recommendation": "最优先的改进建议（含量化目标和时间框架）"
        }}
    ],
    "risk_alerts": [
        {{
            "title": "风险名称",
            "description": "风险描述（含影响金额或百分比）",
            "severity": "high|medium|low",
            "mitigation": "缓解措施（含预期效果）"
        }}
    ],
    "opportunities": [
        {{
            "title": "机会名称",
            "description": "机会描述",
            "potential_impact": "量化预期收益",
            "action_required": "落地步骤"
        }}
    ],
    "sensitivity_analysis": [
        {{
            "factor": "关键驱动因素名称",
            "current_value": "当前值（含单位）",
            "impact_description": "若该因素变动±10%，对整体的影响描述（含量化估算）"
        }}
    ]
}}

## 写作铁律（违反任何一条即为不合格）

1. **数字驱动**: 每条 insight 至少引用 1 个来自上方数据的具体数字。禁止"较高""较低""有所增长"等模糊表述。
   - 反面："毛利率较高" / 正面："毛利率32.5%，高于行业均值28%达4.5个百分点"
2. **对比基准**: 每条分析必须有参照系 — 环比（上月/上期）、同比（去年同期）、行业基准、或目标值。
3. **因果归因**: 不仅描述"是什么"，更要分析"为什么"。例：净利下降 → 因原料采购成本上涨 + 产能利用率不足。
4. **建议落地**: 每条 recommendation 需含：做什么 + 预期效果 + 时间节点。例："Q3前将散装原料集采比例从40%提升至60%，预计降本120万/年"。
5. **覆盖完整**: insights 至少4条，分别覆盖 what_happened / why_happened / forecast / recommendation。
6. **risk_alerts** 至少1条（severity=high/medium/low），**opportunities** 至少1条。
7. **列名翻译**: 将 "2025-01-01" 解读为 "1月"，英文字段名翻译为中文。
8. **精炼**: 每条 insight 的 text 控制在 80-150 字，executive_summary 不超过 80 字。
9. **敏感性分析**: 识别2-3个关键驱动因素，输出sensitivity_analysis数组。每项含factor/current_value/impact_description。例：原料成本每上升5%，净利率预计下降约1.2个百分点。"""

            system_role = self._get_scenario_system_role(scenario)
            response = await self._call_llm(prompt, system_role)
            return self._parse_llm_insights(response, stat_insights)

        except Exception as e:
            logger.error(f"LLM insight generation failed: {e}")
            return stat_insights

    def _compute_statistical_digest(self, df: pd.DataFrame) -> str:
        """
        预计算关键统计摘要，作为 prompt 的辅助 'ingredients'。
        包含：环比变化率、占比排序、异常值检测。
        """
        # Humanize column names for LLM-facing output
        df = self._humanize_df_columns(df)
        parts = []
        import re as _re
        numeric_cols = [c for c in df.select_dtypes(include=[np.number]).columns.tolist()
                        if not _re.match(r'^(Column_\d+|指标\d+|Unnamed|Unnamed:\s*\d+)$', str(c), _re.IGNORECASE)]
        text_cols = df.select_dtypes(include=['object']).columns

        if not numeric_cols:
            return ""

        parts.append("## 预计算统计摘要")

        # 1. 环比变化率（相邻数值列之间的变化）
        # 检测月度列
        monthly_cols = [c for c in numeric_cols
                        if pd.to_datetime(c, errors='coerce', format='%Y-%m-%d') is not pd.NaT
                        or any(p in str(c) for p in ['月', '年', 'Q', 'q'])]

        if len(monthly_cols) >= 2 and len(text_cols) > 0:
            label_col = text_cols[0]
            mom_parts = []
            for _, row in df.head(10).iterrows():
                label = str(row.get(label_col, '')).strip()
                if not label:
                    continue
                vals = []
                for mc in monthly_cols:
                    v = row.get(mc)
                    if pd.notna(v) and isinstance(v, (int, float)):
                        vals.append((str(mc), float(v)))
                if len(vals) >= 2:
                    # 最近两期的环比
                    prev_name, prev_val = vals[-2]
                    curr_name, curr_val = vals[-1]
                    if abs(prev_val) > 1e-6:
                        mom_pct = ((curr_val - prev_val) / abs(prev_val)) * 100
                        mom_parts.append(f"  {label}: {curr_name}环比{mom_pct:+.1f}% ({prev_val:,.0f} -> {curr_val:,.0f})")
            if mom_parts:
                parts.append("### 环比变化（最近两期）")
                parts.extend(mom_parts[:8])

        # 2. 占比排序（对第一个数值列按行排序）
        if len(numeric_cols) >= 1 and len(text_cols) > 0:
            label_col = text_cols[0]
            first_num_col = numeric_cols[0]
            valid_rows = df[[label_col, first_num_col]].dropna()
            valid_rows = valid_rows[valid_rows[first_num_col].apply(lambda x: isinstance(x, (int, float)) and x != 0)]
            if len(valid_rows) >= 3:
                total = valid_rows[first_num_col].sum()
                if abs(total) > 1e-6:
                    sorted_rows = valid_rows.sort_values(first_num_col, ascending=False).head(5)
                    rank_parts = []
                    for _, row in sorted_rows.iterrows():
                        val = row[first_num_col]
                        pct = (val / abs(total)) * 100
                        rank_parts.append(f"  {row[label_col]}: {val:,.0f} (占{pct:.1f}%)")
                    if rank_parts:
                        parts.append(f"### 占比排序（按{first_num_col}降序，前5）")
                        parts.extend(rank_parts)

        # 3. 异常值检测（偏离均值 2 倍标准差）
        anomaly_parts = []
        for col in numeric_cols[:6]:
            values = df[col].dropna()
            values = values[values.apply(lambda x: isinstance(x, (int, float)))]
            if len(values) < 5:
                continue
            mean_val = values.mean()
            std_val = values.std()
            if std_val == 0 or abs(mean_val) < 1e-6:
                continue
            outliers = values[abs(values - mean_val) > 2 * std_val]
            for idx in outliers.index[:2]:
                val = outliers[idx]
                dev = ((val - mean_val) / abs(mean_val)) * 100
                direction = "高于" if val > mean_val else "低于"
                # 尝试获取行标签
                row_label = ""
                if len(text_cols) > 0:
                    try:
                        row_label = f" ({df.loc[idx, text_cols[0]]})"
                    except Exception:
                        pass
                anomaly_parts.append(f"  {col}{row_label}: {val:,.0f}, {direction}均值{abs(dev):.0f}%")

        if anomaly_parts:
            parts.append("### 异常值（偏离均值>2倍标准差）")
            parts.extend(anomaly_parts[:6])

        return "\n".join(parts) if len(parts) > 1 else ""

    @staticmethod
    def _humanize_col(name: str) -> str:
        """Humanize a single column name for LLM prompts.

        Transforms:
          'Column_34' -> '指标34'
          '2025-01-01' -> '1月'
          '2025-01-01_预算数' -> '1月预算数'
          '2025-02-01_实际数' -> '2月实际数'
        """
        import re
        if not name or not isinstance(name, str):
            return str(name)
        # Column_N -> 指标N
        m = re.match(r'^Column_(\d+)$', name, re.IGNORECASE)
        if m:
            return f"指标{m.group(1)}"
        # YYYY-MM-DD_suffix -> M月suffix
        m = re.match(r'^(\d{4})-(\d{2})-\d{2}_(.+)$', name)
        if m:
            month = int(m.group(2))
            return f"{month}月{m.group(3)}"
        # Bare YYYY-MM-DD -> M月
        m = re.match(r'^(\d{4})-(\d{2})-\d{2}$', name)
        if m:
            month = int(m.group(2))
            return f"{month}月"
        return name

    def _humanize_df_columns(self, df: pd.DataFrame) -> pd.DataFrame:
        """Return a copy of df with humanized column names (for LLM prompts only)."""
        new_cols = {c: self._humanize_col(c) for c in df.columns}
        return df.rename(columns=new_cols)

    def _prepare_data_summary(self, df: pd.DataFrame) -> str:
        """Prepare enriched data summary for LLM"""
        # Humanize column names so LLM output uses friendly names
        df = self._humanize_df_columns(df)
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
        # Humanize column names for LLM-facing output
        df = self._humanize_df_columns(df)
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
                # Use range reference — sub-sectors vary widely (6-43%)
                parts.append(f"- 毛利率: {gross_margin:.1f}% (食品加工参考范围15-35%，子行业差异大)")
            if net_profit_total is not None:
                net_margin = net_profit_total / abs(revenue_total) * 100
                parts.append(f"- 净利率: {net_margin:.1f}% (食品加工参考范围3-8%)")

            # Expense ratios with industry benchmark
            expense_benchmarks = {
                '销售费用': (8, 15), '管理费用': (5, 10), '财务费用': (1, 5), '研发费用': (2, 8)
            }
            total_expense = 0
            expense_items = []
            for label, info in found_rows.items():
                if '费用' in label and info['total']:
                    expense_ratio = info['total'] / abs(revenue_total) * 100
                    total_expense += info['total']
                    # Find matching benchmark
                    bench = None
                    for bk, bv in expense_benchmarks.items():
                        if bk in label:
                            bench = bv
                            break
                    bench_text = ""
                    if bench:
                        bench_text = f" (参考范围{bench[0]}-{bench[1]}%)"
                    expense_items.append((label, expense_ratio, bench_text))
                    parts.append(f"- {label}率: {expense_ratio:.1f}%{bench_text}")

            # Total expense ratio
            if total_expense > 0:
                total_expense_ratio = total_expense / abs(revenue_total) * 100
                parts.append(f"- 总费用率: {total_expense_ratio:.1f}% (参考范围15-25%)")

            # Expense composition ranking
            if len(expense_items) >= 2:
                sorted_expenses = sorted(expense_items, key=lambda x: x[1], reverse=True)
                parts.append(f"- 费用占比排序: " + " > ".join(
                    f"{item[0]}({item[1]:.1f}%)" for item in sorted_expenses))

        # Monthly trend summary for key financial rows
        if monthly_cols and found_rows:
            trend_parts = []
            for label, info in list(found_rows.items())[:4]:
                vals = [info['values'].get(m) for m in monthly_cols if m in info['values']]
                non_zero = [v for v in vals if v and v != 0]
                if len(non_zero) >= 3:
                    # Calculate volatility (coefficient of variation)
                    arr = np.array(non_zero)
                    cv = (arr.std() / abs(arr.mean())) * 100 if abs(arr.mean()) > 1e-6 else 0
                    max_val, min_val = arr.max(), arr.min()
                    trend_parts.append(
                        f"  {label}: 波动率{cv:.1f}%, 最高{max_val:,.0f}, 最低{min_val:,.0f}")
            if trend_parts:
                parts.append("### 波动性分析")
                parts.extend(trend_parts)

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

    async def generate_text_analysis(self, text: str) -> str:
        """Analyze free-form text (e.g. cost data from Java) using LLM directly.
        Returns the analysis as plain text (not JSON)."""
        headers = {
            "Authorization": f"Bearer {self.settings.llm_api_key}",
            "Content-Type": "application/json"
        }
        payload = {
            "model": self.settings.llm_model,
            "messages": [
                {
                    "role": "system",
                    "content": (
                        "你是一位服务于食品加工企业的资深分析师。"
                        "请根据提供的数据进行深入分析，给出关键发现和可执行建议。"
                        "要求：引用具体数字，分析因果关系，给出量化建议。"
                        "用中文回复，使用Markdown格式。"
                    )
                },
                {"role": "user", "content": text}
            ],
            "temperature": 0.4,
            "max_tokens": 2000
        }
        try:
            response = await self.client.post(
                f"{self.settings.llm_base_url}/chat/completions",
                headers=headers,
                json=payload,
                timeout=httpx.Timeout(self.LLM_TIMEOUT_BASE)
            )
            response.raise_for_status()
            return response.json()["choices"][0]["message"]["content"]
        except Exception as e:
            logger.error(f"Text analysis LLM call failed: {e}")
            return ""

    async def _call_llm_stream(self, prompt: str, system_role: Optional[str] = None):
        """Call LLM API with SSE streaming — yields text chunks as they arrive"""
        headers = {
            "Authorization": f"Bearer {self.settings.llm_api_key}",
            "Content-Type": "application/json"
        }
        if not system_role:
            system_role = self._get_scenario_system_role('general')
        payload = {
            "model": self.settings.llm_model,
            "messages": [
                {
                    "role": "system",
                    "content": system_role + " 严格以JSON格式回复，不要附加任何Markdown标记或解释文字。"
                },
                {"role": "user", "content": prompt}
            ],
            "temperature": 0.4,
            "max_tokens": 2500,
            "stream": True
        }
        try:
            async with self.client.stream(
                "POST",
                f"{self.settings.llm_base_url}/chat/completions",
                headers=headers,
                json=payload,
                timeout=httpx.Timeout(self.LLM_TIMEOUT_MAX)
            ) as response:
                response.raise_for_status()
                async for line in response.aiter_lines():
                    if not line.startswith("data: "):
                        continue
                    data_str = line[6:]
                    if data_str.strip() == "[DONE]":
                        break
                    try:
                        chunk = json.loads(data_str)
                        delta = chunk.get("choices", [{}])[0].get("delta", {})
                        content = delta.get("content", "")
                        if content:
                            yield content
                    except (json.JSONDecodeError, IndexError, KeyError):
                        continue
        except Exception as e:
            logger.error(f"LLM streaming call failed: {e}")

    async def generate_insights_stream(
        self,
        data: List[dict],
        metrics: Optional[List[dict]] = None,
        analysis_context: Optional[str] = None,
        max_insights: int = 5,
        context_info: Optional[ContextInfo] = None
    ):
        """
        Stream AI insights as SSE events.
        Yields: 'chunk' events with raw LLM text, then a final 'done' event with parsed JSON.
        """
        if not self.settings.llm_api_key:
            yield {"event": "done", "data": json.dumps({"success": False, "error": "No LLM API key"})}
            return

        try:
            df = pd.DataFrame(data)
            if df.empty:
                yield {"event": "done", "data": json.dumps({"success": True, "insights": []})}
                return

            # Build the same prompt as non-streaming path
            data_summary = self._prepare_data_summary(df)
            financial_metrics = self._compute_financial_context(df)
            production_metrics = self._compute_production_context(df)
            stat_digest = self._compute_statistical_digest(df)
            kb_context = await self._get_food_kb_context(df)
            metrics_summary = self._prepare_metrics_summary(metrics) if metrics else ""

            # Detect scenario for adaptive prompting
            scenario = self._detect_analysis_scenario(df)
            benchmark_text = self._get_scenario_benchmarks(scenario)

            excel_context = ""
            if context_info and context_info.has_content():
                excel_context = f"\n## 报表上下文信息（来自原始Excel）\n{context_info.to_prompt_text()}"

            prompt = f"""你是一位为食品加工企业管理层撰写经营分析报告的资深分析师。
分析场景：{scenario}
{benchmark_text}
你的角色是管理层的智囊——用数据说话，给出CEO能直接采纳的建议。

## 数据概览
{data_summary}

{financial_metrics}

{production_metrics}

{stat_digest}

{f'## 已计算指标{chr(10)}{metrics_summary}' if metrics_summary else ''}

{f'## 业务背景{chr(10)}{json.dumps(analysis_context, ensure_ascii=False)}' if analysis_context else ''}
{excel_context}
{kb_context}

## 输出格式（严格JSON）

{{
    "executive_summary": "一句话管理摘要",
    "insights": [
        {{
            "dimension": "what_happened|why_happened|forecast|recommendation",
            "type": "trend|anomaly|comparison|kpi|recommendation",
            "title": "洞察标题（不超过15字）",
            "text": "详细分析（80-150字）",
            "metric": "相关指标名称",
            "sentiment": "positive|negative|neutral",
            "importance": 1-10,
            "confidence": 0.5-1.0,
            "action_items": ["建议1", "建议2"],
            "recommendation": "最优先的改进建议"
        }}
    ],
    "risk_alerts": [{{ "title": "风险", "description": "描述", "severity": "high|medium|low", "mitigation": "措施" }}],
    "opportunities": [{{ "title": "机会", "description": "描述", "potential_impact": "收益", "action_required": "步骤" }}],
    "sensitivity_analysis": [{{ "factor": "驱动因素", "current_value": "当前值", "impact_description": "变动影响" }}]
}}

## 写作铁律
1. 数字驱动 2. 对比基准 3. 因果归因 4. 建议落地 5. 覆盖完整(4+条) 6. risk_alerts+opportunities各至少1条 7. 列名翻译 8. 精炼(80-150字) 9. 敏感性分析(2-3个关键驱动因素)"""

            # Stream LLM response chunk by chunk
            system_role = self._get_scenario_system_role(scenario)
            full_response = ""
            async for chunk in self._call_llm_stream(prompt, system_role):
                full_response += chunk
                yield {"event": "chunk", "data": chunk}

            # Parse the complete response
            stat_insights = self._generate_statistical_insights(df, metrics)
            parsed = self._parse_llm_insights(full_response, stat_insights)
            yield {"event": "done", "data": json.dumps({
                "success": True,
                "insights": parsed,
                "totalGenerated": len(parsed),
                "method": "llm"
            }, ensure_ascii=False, default=str)}

        except Exception as e:
            logger.error(f"Streaming insight generation failed: {e}", exc_info=True)
            yield {"event": "done", "data": json.dumps({"success": False, "error": str(e)})}

    async def _call_llm(self, prompt: str, system_role: Optional[str] = None) -> str:
        """Call LLM API with timeout and retry"""
        headers = {
            "Authorization": f"Bearer {self.settings.llm_api_key}",
            "Content-Type": "application/json"
        }

        if not system_role:
            system_role = self._get_scenario_system_role('general')

        payload = {
            "model": self.settings.llm_model,
            "messages": [
                {
                    "role": "system",
                    "content": system_role + " 严格以JSON格式回复，不要附加任何Markdown标记或解释文字。"
                },
                {
                    "role": "user",
                    "content": prompt
                }
            ],
            "temperature": 0.4,
            "max_tokens": 2500
        }

        for attempt in range(self.LLM_MAX_RETRIES):
            try:
                timeout_secs = min(
                    self.LLM_TIMEOUT_BASE + attempt * self.LLM_TIMEOUT_INCREMENT,
                    self.LLM_TIMEOUT_MAX
                )
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
                logger.warning(f"LLM call timeout (attempt {attempt + 1}/{self.LLM_MAX_RETRIES}, timeout={timeout_secs}s)")
                if attempt < self.LLM_MAX_RETRIES - 1:
                    await asyncio.sleep(2 ** attempt * 2)
                else:
                    logger.error("LLM call failed after all retry attempts due to timeout")
                    return ""
            except httpx.HTTPStatusError as e:
                logger.warning(f"LLM call HTTP error {e.response.status_code} (attempt {attempt + 1}/{self.LLM_MAX_RETRIES})")
                if attempt < self.LLM_MAX_RETRIES - 1:
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

            # Inject _meta insight with executive_summary, risk_alerts, opportunities, sensitivity_analysis
            executive_summary = result.get("executive_summary", "")
            risk_alerts = result.get("risk_alerts", [])
            opportunities = result.get("opportunities", [])
            sensitivity_analysis = result.get("sensitivity_analysis", [])

            if executive_summary or risk_alerts or opportunities:
                meta_insight = {
                    "type": "_meta",
                    "text": executive_summary,
                    "executive_summary": executive_summary,
                    "risk_alerts": risk_alerts,
                    "opportunities": opportunities,
                    "sensitivity_analysis": sensitivity_analysis,
                    "importance": 10,
                    "source": "llm"
                }
                valid_insights.insert(0, meta_insight)

            return valid_insights if valid_insights else fallback_insights

        except Exception as e:
            logger.error(f"Failed to parse LLM insights: {e}")
            return fallback_insights

    async def _get_food_kb_context(self, df: pd.DataFrame) -> str:
        """
        Query food knowledge base for industry context.
        Returns formatted context string for LLM prompt injection,
        or empty string if data is not food-industry related.
        """
        try:
            from services.food_context_bridge import get_food_context_bridge
            bridge = get_food_context_bridge()

            column_names = df.columns.tolist()
            sample_data = df.head(5).to_dict('records') if len(df) > 0 else None

            # Step 1: Basic food industry detection + benchmarks
            ctx = await bridge.get_food_context(column_names, sample_data)

            if not ctx.get("is_food_industry"):
                return ""

            parts = []
            kb_text = ctx.get("kb_context", "")
            if kb_text:
                parts.append(kb_text)

            # Step 2: Deep entity enrichment — NER + KB knowledge retrieval
            try:
                enriched = await bridge.get_entity_enriched_context(column_names, sample_data)
                entity_text = enriched.get("context_text", "")
                if entity_text:
                    parts.append(entity_text)
            except Exception as e:
                logger.debug(f"Entity enrichment skipped: {e}")

            if parts:
                return "\n## 食品行业知识库参考\n" + "\n".join(parts)
            return ""
        except Exception as e:
            logger.debug(f"Food KB context unavailable: {e}")
            return ""

    async def close(self):
        """Close HTTP client"""
        await self.client.aclose()
