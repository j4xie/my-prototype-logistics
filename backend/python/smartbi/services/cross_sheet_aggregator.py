from __future__ import annotations
"""
Cross-Sheet Aggregator Service

Aggregates data across multiple uploaded sheets for comprehensive analysis:
1. Fetches data from PostgreSQL for each upload
2. Extracts key numeric KPIs per sheet
3. Builds comparison charts (bar chart of KPIs across sheets)
4. Calls LLM for cross-sheet AI insights
"""
import logging
from typing import Any, Dict, List, Optional

import httpx
import numpy as np
import pandas as pd

from config import get_settings

logger = logging.getLogger(__name__)


class CrossSheetAggregator:
    """Aggregates and analyzes data across multiple sheets"""

    def __init__(self):
        self.settings = get_settings()
        self.client = httpx.AsyncClient(timeout=60.0)

    async def aggregate(
        self,
        upload_ids: List[int],
        sheet_names: List[str],
        factory_id: str = "F001"
    ) -> Dict[str, Any]:
        """
        Main aggregation entry point.

        Args:
            upload_ids: List of upload IDs to analyze
            sheet_names: Display names for each sheet
            factory_id: Factory ID for database queries

        Returns:
            Dict with kpiComparison, charts, aiSummary
        """
        try:
            # 1. Fetch data for each upload
            all_sheet_data: List[Dict[str, Any]] = []
            for i, upload_id in enumerate(upload_ids):
                name = sheet_names[i] if i < len(sheet_names) else f"Sheet {i + 1}"
                sheet_data = await self._fetch_sheet_data(upload_id, factory_id)
                if sheet_data is not None and len(sheet_data) > 0:
                    all_sheet_data.append({
                        "uploadId": upload_id,
                        "sheetName": name,
                        "data": sheet_data
                    })

            if not all_sheet_data:
                return {"success": False, "error": "无法获取任何 Sheet 数据"}

            # 2. Extract KPIs per sheet
            kpi_comparison = self._extract_kpis(all_sheet_data)

            # 3. Build comparison charts
            charts = self._build_comparison_charts(kpi_comparison, all_sheet_data)

            # 4. Generate AI summary
            ai_summary = await self._generate_ai_summary(kpi_comparison, all_sheet_data)

            return {
                "success": True,
                "kpiComparison": kpi_comparison,
                "charts": charts,
                "aiSummary": ai_summary
            }

        except Exception as e:
            logger.error(f"Cross-sheet aggregation failed: {e}", exc_info=True)
            return {"success": False, "error": str(e)}

    async def _fetch_sheet_data(
        self,
        upload_id: int,
        factory_id: str
    ) -> Optional[List[Dict[str, Any]]]:
        """Fetch data for a single upload from PostgreSQL"""
        try:
            from database.connection import is_postgres_enabled, get_db_context
            from database.repository import DynamicDataRepository

            if not is_postgres_enabled():
                logger.warning("PostgreSQL not enabled, cannot fetch sheet data")
                return None

            with get_db_context() as db:
                repo = DynamicDataRepository(db)
                rows = repo.get_by_upload_id(factory_id, upload_id)
                return rows if rows else None

        except Exception as e:
            logger.error(f"Failed to fetch data for upload {upload_id}: {e}")
            return None

    def _extract_kpis(
        self,
        all_sheet_data: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """Extract key numeric KPIs from each sheet"""
        kpi_comparison = []

        # KPI keywords by priority
        kpi_keywords = [
            ("营业收入", "revenue"),
            ("净利润", "net_profit"),
            ("毛利", "gross_profit"),
            ("毛利率", "gross_margin"),
            ("成本", "cost"),
            ("费用", "expense"),
            ("合计", "total"),
            ("收入", "income"),
            ("利润", "profit"),
        ]

        for sheet_info in all_sheet_data:
            df = pd.DataFrame(sheet_info["data"])
            if df.empty:
                continue

            kpis: Dict[str, float] = {}

            # Try to find KPI rows by first column label matching
            first_col = df.columns[0] if len(df.columns) > 0 else None
            numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()

            if first_col and first_col not in numeric_cols:
                # Financial report style: first column is labels, others are values
                for _, row in df.iterrows():
                    label = str(row.get(first_col, "")).strip()
                    if not label:
                        continue

                    for keyword, _ in kpi_keywords:
                        if keyword in label:
                            # Sum all numeric values for this row
                            row_sum = 0
                            for nc in numeric_cols:
                                val = row.get(nc)
                                if pd.notna(val) and isinstance(val, (int, float)):
                                    row_sum += val
                            if row_sum != 0:
                                kpis[label] = round(row_sum, 2)
                            break

            # Fallback: use column sums for numeric columns
            if not kpis and numeric_cols:
                for col in numeric_cols[:6]:
                    col_sum = df[col].sum()
                    if pd.notna(col_sum) and col_sum != 0:
                        kpis[col] = round(float(col_sum), 2)

            kpi_comparison.append({
                "sheetName": sheet_info["sheetName"],
                "kpis": kpis
            })

        return kpi_comparison

    def _build_comparison_charts(
        self,
        kpi_comparison: List[Dict[str, Any]],
        all_sheet_data: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """Build ECharts configurations for cross-sheet comparison"""
        charts = []

        if not kpi_comparison:
            return charts

        # Collect all KPI keys across sheets
        all_kpi_keys: Dict[str, int] = {}
        for item in kpi_comparison:
            for key in item.get("kpis", {}):
                all_kpi_keys[key] = all_kpi_keys.get(key, 0) + 1

        # Find common KPIs (present in >= 2 sheets)
        common_keys = [k for k, count in all_kpi_keys.items() if count >= 2]
        if not common_keys:
            common_keys = list(all_kpi_keys.keys())[:5]

        sheet_names = [item["sheetName"] for item in kpi_comparison]
        # Truncate long names
        display_names = [n[:12] + "..." if len(n) > 15 else n for n in sheet_names]

        # Chart 1: Bar chart comparing top KPIs across sheets
        if common_keys:
            top_keys = common_keys[:4]
            series = []
            for key in top_keys:
                data_values = []
                for item in kpi_comparison:
                    val = item.get("kpis", {}).get(key, 0)
                    data_values.append(round(float(val), 2) if val else 0)
                series.append({
                    "name": key,
                    "type": "bar",
                    "data": data_values,
                    "emphasis": {"focus": "series"}
                })

            charts.append({
                "chartType": "bar",
                "title": "各报表核心指标对比",
                "config": {
                    "tooltip": {"trigger": "axis", "axisPointer": {"type": "shadow"}},
                    "legend": {"data": top_keys, "top": 30},
                    "grid": {"left": "3%", "right": "4%", "bottom": "3%", "top": 70, "containLabel": True},
                    "xAxis": {"type": "category", "data": display_names, "axisLabel": {"rotate": 20}},
                    "yAxis": {"type": "value"},
                    "series": series
                }
            })

        # Chart 2: If we have a common "营业收入" or "收入" field, make a pie chart
        revenue_key = None
        for key in common_keys:
            if "收入" in key or "revenue" in key.lower():
                revenue_key = key
                break

        if revenue_key:
            pie_data = []
            for item in kpi_comparison:
                val = item.get("kpis", {}).get(revenue_key, 0)
                if val and float(val) > 0:
                    pie_data.append({
                        "name": item["sheetName"][:12],
                        "value": round(abs(float(val)), 2)
                    })

            if len(pie_data) >= 2:
                charts.append({
                    "chartType": "pie",
                    "title": f"{revenue_key} 各报表占比",
                    "config": {
                        "tooltip": {"trigger": "item", "formatter": "{b}: {c} ({d}%)"},
                        "legend": {"orient": "vertical", "left": "left", "top": 30},
                        "series": [{
                            "name": revenue_key,
                            "type": "pie",
                            "radius": ["35%", "65%"],
                            "center": ["55%", "55%"],
                            "avoidLabelOverlap": True,
                            "itemStyle": {"borderRadius": 6, "borderColor": "#fff", "borderWidth": 2},
                            "label": {"show": True, "formatter": "{b}\n{d}%"},
                            "data": pie_data
                        }]
                    }
                })

        # Chart 3: Contribution waterfall chart (how each sheet contributes to total)
        if revenue_key or common_keys:
            contribution_key = revenue_key or common_keys[0]
            contrib_data = []
            for item in kpi_comparison:
                val = item.get("kpis", {}).get(contribution_key, 0)
                if val:
                    contrib_data.append({
                        "name": item["sheetName"][:12],
                        "value": round(float(val), 2)
                    })

            if len(contrib_data) >= 2:
                # Sort by value descending
                contrib_data.sort(key=lambda d: abs(d["value"]), reverse=True)
                total_val = sum(d["value"] for d in contrib_data)

                # Build waterfall: cumulative offset
                wf_placeholder = []
                wf_positive = []
                wf_negative = []
                cumulative = 0
                wf_categories = []

                for d in contrib_data:
                    wf_categories.append(d["name"])
                    val = d["value"]
                    if val >= 0:
                        wf_placeholder.append(round(cumulative, 2))
                        wf_positive.append(round(val, 2))
                        wf_negative.append(0)
                    else:
                        wf_placeholder.append(round(cumulative + val, 2))
                        wf_positive.append(0)
                        wf_negative.append(round(abs(val), 2))
                    cumulative += val

                # Add total bar
                wf_categories.append("合计")
                wf_placeholder.append(0)
                wf_positive.append(round(total_val, 2) if total_val >= 0 else 0)
                wf_negative.append(round(abs(total_val), 2) if total_val < 0 else 0)

                charts.append({
                    "chartType": "waterfall",
                    "title": f"{contribution_key} 各报表贡献分解",
                    "config": {
                        "tooltip": {"trigger": "axis", "axisPointer": {"type": "shadow"}},
                        "grid": {"left": "3%", "right": "4%", "bottom": "3%", "top": 50, "containLabel": True},
                        "xAxis": {"type": "category", "data": wf_categories, "axisLabel": {"rotate": 20}},
                        "yAxis": {"type": "value"},
                        "series": [
                            {
                                "name": "Placeholder",
                                "type": "bar",
                                "stack": "Total",
                                "itemStyle": {"color": "transparent"},
                                "data": wf_placeholder
                            },
                            {
                                "name": "正向贡献",
                                "type": "bar",
                                "stack": "Total",
                                "itemStyle": {"color": "#91cc75", "borderRadius": [4, 4, 0, 0]},
                                "label": {"show": True, "position": "top", "fontSize": 10},
                                "data": wf_positive
                            },
                            {
                                "name": "负向贡献",
                                "type": "bar",
                                "stack": "Total",
                                "itemStyle": {"color": "#ee6666", "borderRadius": [4, 4, 0, 0]},
                                "label": {"show": True, "position": "top", "fontSize": 10},
                                "data": wf_negative
                            }
                        ]
                    }
                })

        # Chart 4: Quadrant scatter (Revenue x Margin) if both metrics found
        if len(kpi_comparison) >= 2:
            revenue_vals = []
            margin_vals = []
            scatter_names = []

            # Try to find revenue and profit for each sheet to compute margin
            for item in kpi_comparison:
                kpis = item.get("kpis", {})
                rev = None
                profit = None
                for k, v in kpis.items():
                    if "收入" in k and rev is None:
                        rev = float(v)
                    if "净利润" in k or "利润" in k:
                        profit = float(v)
                if rev and profit and abs(rev) > 0:
                    margin = profit / abs(rev) * 100
                    revenue_vals.append(rev)
                    margin_vals.append(round(margin, 1))
                    scatter_names.append(item["sheetName"][:12])

            if len(revenue_vals) >= 2:
                scatter_data = [[revenue_vals[i], margin_vals[i]] for i in range(len(revenue_vals))]
                avg_rev = sum(revenue_vals) / len(revenue_vals)
                avg_margin = sum(margin_vals) / len(margin_vals)

                charts.append({
                    "chartType": "scatter",
                    "title": "收入-利润率四象限分析",
                    "config": {
                        "tooltip": {
                            "trigger": "item",
                            "formatter": "__FUNC__function(p){return p.data[2]+'<br/>收入: '+p.data[0].toLocaleString()+'<br/>利润率: '+p.data[1]+'%'}"
                        },
                        "grid": {"left": "3%", "right": "4%", "bottom": "3%", "top": 50, "containLabel": True},
                        "xAxis": {"type": "value", "name": "收入",
                                  "splitLine": {"lineStyle": {"type": "dashed"}}},
                        "yAxis": {"type": "value", "name": "利润率(%)",
                                  "splitLine": {"lineStyle": {"type": "dashed"}}},
                        "series": [{
                            "type": "scatter",
                            "symbolSize": 20,
                            "data": [[scatter_data[i][0], scatter_data[i][1], scatter_names[i]]
                                     for i in range(len(scatter_data))],
                            "label": {"show": True, "formatter": "__FUNC__function(p){return p.data[2]}",
                                      "position": "top", "fontSize": 11},
                            "markLine": {
                                "silent": True,
                                "lineStyle": {"type": "dashed", "color": "#9ca3af"},
                                "data": [
                                    {"xAxis": round(avg_rev, 2), "label": {"formatter": "平均收入"}},
                                    {"yAxis": round(avg_margin, 1), "label": {"formatter": "平均利润率"}}
                                ]
                            }
                        }]
                    }
                })

        # Chart 5: Radar chart for multi-dimensional comparison (if enough common KPIs)
        if len(common_keys) >= 3:
            radar_keys = common_keys[:6]

            # Normalize values to 0-100 for radar
            max_values = {}
            for key in radar_keys:
                vals = [abs(float(item.get("kpis", {}).get(key, 0) or 0)) for item in kpi_comparison]
                max_values[key] = max(vals) if vals else 1

            indicator = [
                {"name": k[:8], "max": round(max_values[k] * 1.2, 2) if max_values[k] > 0 else 100}
                for k in radar_keys
            ]

            radar_series_data = []
            for item in kpi_comparison:
                values = [
                    round(abs(float(item.get("kpis", {}).get(k, 0) or 0)), 2)
                    for k in radar_keys
                ]
                radar_series_data.append({
                    "name": item["sheetName"][:12],
                    "value": values
                })

            # Only show top 5 sheets in radar
            radar_series_data = radar_series_data[:5]

            charts.append({
                "chartType": "radar",
                "title": "多维度综合对比",
                "config": {
                    "tooltip": {"trigger": "item"},
                    "legend": {
                        "data": [d["name"] for d in radar_series_data],
                        "top": 30
                    },
                    "radar": {
                        "indicator": indicator,
                        "center": ["50%", "55%"],
                        "radius": "60%"
                    },
                    "series": [{
                        "type": "radar",
                        "data": radar_series_data,
                        "areaStyle": {"opacity": 0.15}
                    }]
                }
            })

        return charts

    async def _generate_ai_summary(
        self,
        kpi_comparison: List[Dict[str, Any]],
        all_sheet_data: List[Dict[str, Any]]
    ) -> Optional[str]:
        """Generate AI-powered cross-sheet summary using LLM"""
        if not self.settings.llm_api_key:
            return self._generate_statistical_summary(kpi_comparison)

        try:
            # Build KPI summary for LLM
            kpi_text_parts = []
            for item in kpi_comparison:
                kpi_lines = [f"  {k}: {v:,.2f}" for k, v in item.get("kpis", {}).items()]
                kpi_text_parts.append(
                    f"**{item['sheetName']}**:\n" + "\n".join(kpi_lines) if kpi_lines
                    else f"**{item['sheetName']}**: 无数据"
                )

            kpi_overview = "\n\n".join(kpi_text_parts)

            # Compute cross-sheet derived metrics for LLM
            derived_metrics = []
            for item in kpi_comparison:
                kpis = item.get("kpis", {})
                rev = next((v for k, v in kpis.items() if "收入" in k), None)
                profit = next((v for k, v in kpis.items() if "净利润" in k or "利润" in k), None)
                if rev and abs(rev) > 0 and profit is not None:
                    margin = profit / abs(rev) * 100
                    derived_metrics.append(
                        f"  {item['sheetName']}: 利润率={margin:.1f}%"
                    )

            derived_text = ""
            if derived_metrics:
                derived_text = "\n## 派生指标\n" + "\n".join(derived_metrics)

            prompt = f"""你是一位食品加工企业的CFO级分析师，正在为管理层撰写各分部/区域的横向对比分析报告。

## 各报表核心 KPI

{kpi_overview}
{derived_text}

## 行业参考基准（食品加工）
- 毛利率: 25-35%
- 净利率: 3-8%
- 费用率: 15-25%

## 分析要求（严格遵守）

1. **高管摘要**（1-2句，含关键数字）
2. **分部排名与对标**:
   - 按收入和利润率排序各分部
   - 标注表现最好和最差的分部，差距是多少
   - 与行业基准对比
3. **关键发现**（每条含具体数字）:
   - 亏损分部：哪些分部净利润为负？亏损金额是多少？
   - 费用结构：各分部费用率是否合理？
   - 贡献度：各分部对总收入/利润的贡献百分比
4. **风险预警**:
   - 按严重程度排序（红/黄/绿）
   - 每条含影响金额估算
5. **改进建议**（按优先级排序）:
   - 每条建议含预期效果和量化目标
   - 可从表现好的分部借鉴什么

请用中文回答，每个观点必须有具体数字支撑。控制在 800 字以内。"""

            headers = {
                "Authorization": f"Bearer {self.settings.llm_api_key}",
                "Content-Type": "application/json"
            }

            payload = {
                "model": self.settings.llm_model,
                "messages": [
                    {
                        "role": "system",
                        "content": "你是一个资深财务分析师，擅长跨报表综合分析和横向对比。回答要简洁、结构清晰、有数据支撑。"
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

        except Exception as e:
            logger.error(f"LLM cross-sheet summary failed: {e}")
            return self._generate_statistical_summary(kpi_comparison)

    def _generate_statistical_summary(
        self,
        kpi_comparison: List[Dict[str, Any]]
    ) -> str:
        """Fallback: generate statistical summary without LLM"""
        if not kpi_comparison:
            return "无可用数据进行综合分析"

        parts = [f"跨 {len(kpi_comparison)} 个报表的综合分析：\n"]

        # Find common KPI keys
        all_keys: Dict[str, List[float]] = {}
        for item in kpi_comparison:
            for key, val in item.get("kpis", {}).items():
                if key not in all_keys:
                    all_keys[key] = []
                all_keys[key].append(float(val))

        for key, values in list(all_keys.items())[:5]:
            total = sum(values)
            avg = total / len(values) if values else 0
            max_val = max(values) if values else 0
            min_val = min(values) if values else 0

            parts.append(
                f"**{key}**: 总计 {total:,.2f}, "
                f"平均 {avg:,.2f}, "
                f"最高 {max_val:,.2f}, "
                f"最低 {min_val:,.2f}"
            )

        return "\n".join(parts)

    async def close(self):
        """Close HTTP client"""
        await self.client.aclose()
