from __future__ import annotations
"""
LLM Field Mapper Service

Uses LLM to intelligently map detected fields to business metrics
and recommend chart configurations.
"""
import logging
import json
from typing import Any, Optional, List, Dict

import httpx

from config import get_settings

logger = logging.getLogger(__name__)


class LLMMapper:
    """LLM-based field mapping and chart recommendation service"""

    # Standard business fields for mapping
    STANDARD_FIELDS = {
        "time_dimensions": [
            {"id": "date", "name": "日期", "description": "日期维度"},
            {"id": "month", "name": "月份", "description": "月份维度"},
            {"id": "quarter", "name": "季度", "description": "季度维度"},
            {"id": "year", "name": "年份", "description": "年份维度"}
        ],
        "category_dimensions": [
            {"id": "product", "name": "产品", "description": "产品维度"},
            {"id": "category", "name": "品类", "description": "产品品类"},
            {"id": "region", "name": "区域", "description": "地区维度"},
            {"id": "channel", "name": "渠道", "description": "销售渠道"},
            {"id": "customer", "name": "客户", "description": "客户维度"},
            {"id": "department", "name": "部门", "description": "部门维度"}
        ],
        "measures": [
            {"id": "sales_amount", "name": "销售额", "description": "销售金额"},
            {"id": "order_count", "name": "订单数", "description": "订单数量"},
            {"id": "quantity", "name": "销量", "description": "销售数量"},
            {"id": "cost", "name": "成本", "description": "成本金额"},
            {"id": "profit", "name": "利润", "description": "利润金额"},
            {"id": "target", "name": "目标", "description": "目标值"},
            {"id": "budget", "name": "预算", "description": "预算金额"},
            {"id": "actual", "name": "实际", "description": "实际值"}
        ]
    }

    CHART_TYPES = [
        {"id": "line", "name": "折线图", "use_case": "趋势分析、时间序列"},
        {"id": "bar", "name": "柱状图", "use_case": "对比分析、排名"},
        {"id": "pie", "name": "饼图", "use_case": "占比分析"},
        {"id": "area", "name": "面积图", "use_case": "累计趋势"},
        {"id": "scatter", "name": "散点图", "use_case": "相关性分析"},
        {"id": "heatmap", "name": "热力图", "use_case": "分布分析"},
        {"id": "waterfall", "name": "瀑布图", "use_case": "增减分析"},
        {"id": "radar", "name": "雷达图", "use_case": "多维对比"},
        {"id": "funnel", "name": "漏斗图", "use_case": "转化分析"},
        {"id": "gauge", "name": "仪表盘", "use_case": "KPI展示"}
    ]

    def __init__(self):
        self.settings = get_settings()
        self.client = httpx.AsyncClient(timeout=60.0)

    async def map_fields(
        self,
        detected_fields: List[dict],
        context: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Use LLM to map detected fields to standard business fields

        Args:
            detected_fields: List of detected field information
            context: Optional business context

        Returns:
            Field mapping results
        """
        if not self.settings.llm_api_key:
            # Fallback to rule-based mapping
            return self._rule_based_mapping(detected_fields)

        prompt = self._build_mapping_prompt(detected_fields, context)

        try:
            response = await self._call_llm(prompt)
            return self._parse_mapping_response(response, detected_fields)
        except Exception as e:
            logger.error(f"LLM mapping failed, using rule-based: {e}")
            return self._rule_based_mapping(detected_fields)

    async def recommend_chart_config(
        self,
        detected_fields: List[dict],
        analysis_goal: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Use LLM to recommend chart configuration

        Args:
            detected_fields: List of detected field information
            analysis_goal: Optional analysis goal description

        Returns:
            Chart configuration recommendation
        """
        if not self.settings.llm_api_key:
            return self._rule_based_chart_recommendation(detected_fields)

        prompt = self._build_chart_prompt(detected_fields, analysis_goal)

        try:
            response = await self._call_llm(prompt)
            return self._parse_chart_response(response, detected_fields)
        except Exception as e:
            logger.error(f"LLM chart recommendation failed: {e}")
            return self._rule_based_chart_recommendation(detected_fields)

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
                    "content": "你是一个专业的数据分析师，擅长识别数据字段的业务含义并推荐可视化方案。请用JSON格式回复。"
                },
                {
                    "role": "user",
                    "content": prompt
                }
            ],
            "temperature": 0.3,
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

    def _build_mapping_prompt(self, detected_fields: List[dict], context: Optional[str]) -> str:
        """Build prompt for field mapping"""
        fields_desc = "\n".join([
            f"- {f['fieldName']}: 类型={f['dataType']}, 语义={f['semanticType']}, 样本值={f.get('sampleValues', [])[:3]}"
            for f in detected_fields
        ])

        standard_fields_desc = json.dumps(self.STANDARD_FIELDS, ensure_ascii=False, indent=2)

        prompt = f"""请分析以下数据字段，并将它们映射到标准业务字段。

检测到的字段：
{fields_desc}

标准业务字段：
{standard_fields_desc}

{f'业务背景：{context}' if context else ''}

请返回JSON格式的映射结果：
{{
    "mappings": [
        {{
            "sourceField": "原始字段名",
            "targetField": "标准字段id",
            "targetCategory": "time_dimensions/category_dimensions/measures",
            "confidence": 0.9,
            "reason": "映射原因"
        }}
    ],
    "unmapped": ["无法映射的字段列表"]
}}"""
        return prompt

    def _build_chart_prompt(self, detected_fields: List[dict], analysis_goal: Optional[str]) -> str:
        """Build prompt for chart recommendation"""
        fields_desc = "\n".join([
            f"- {f['fieldName']}: 角色={f['chartRole']}, 类型={f['dataType']}"
            for f in detected_fields
        ])

        chart_types_desc = json.dumps(self.CHART_TYPES, ensure_ascii=False, indent=2)

        prompt = f"""请根据以下数据字段推荐最佳的图表配置。

数据字段：
{fields_desc}

可用图表类型：
{chart_types_desc}

{f'分析目标：{analysis_goal}' if analysis_goal else ''}

请返回JSON格式的推荐结果：
{{
    "recommendations": [
        {{
            "chartType": "图表类型id",
            "title": "推荐标题",
            "xAxis": "X轴字段名",
            "yAxis": ["Y轴字段名列表"],
            "series": "系列分组字段（可选）",
            "reason": "推荐原因",
            "priority": 1
        }}
    ]
}}"""
        return prompt

    def _parse_mapping_response(self, response: str, detected_fields: List[dict]) -> dict:
        """Parse LLM mapping response"""
        try:
            # Extract JSON from response
            json_match = response
            if "```json" in response:
                json_match = response.split("```json")[1].split("```")[0]
            elif "```" in response:
                json_match = response.split("```")[1].split("```")[0]

            result = json.loads(json_match)
            return {
                "success": True,
                "mappings": result.get("mappings", []),
                "unmapped": result.get("unmapped", []),
                "method": "llm"
            }
        except Exception as e:
            logger.error(f"Failed to parse LLM response: {e}")
            return self._rule_based_mapping(detected_fields)

    def _parse_chart_response(self, response: str, detected_fields: List[dict]) -> dict:
        """Parse LLM chart recommendation response"""
        try:
            json_match = response
            if "```json" in response:
                json_match = response.split("```json")[1].split("```")[0]
            elif "```" in response:
                json_match = response.split("```")[1].split("```")[0]

            result = json.loads(json_match)
            return {
                "success": True,
                "recommendations": result.get("recommendations", []),
                "method": "llm"
            }
        except Exception as e:
            logger.error(f"Failed to parse chart response: {e}")
            return self._rule_based_chart_recommendation(detected_fields)

    def _rule_based_mapping(self, detected_fields: List[dict]) -> dict:
        """Fallback rule-based field mapping"""
        mappings = []
        unmapped = []

        for field in detected_fields:
            mapped = False
            field_name = field["fieldName"].lower()
            semantic_type = field.get("semanticType", "unknown")

            # Map based on semantic type
            if semantic_type == "date":
                mappings.append({
                    "sourceField": field["fieldName"],
                    "targetField": "date",
                    "targetCategory": "time_dimensions",
                    "confidence": 0.8,
                    "reason": "Detected as date field"
                })
                mapped = True
            elif semantic_type == "amount":
                target = "sales_amount"
                if "cost" in field_name or "成本" in field_name:
                    target = "cost"
                elif "profit" in field_name or "利润" in field_name:
                    target = "profit"
                elif "target" in field_name or "目标" in field_name:
                    target = "target"
                elif "budget" in field_name or "预算" in field_name:
                    target = "budget"

                mappings.append({
                    "sourceField": field["fieldName"],
                    "targetField": target,
                    "targetCategory": "measures",
                    "confidence": 0.7,
                    "reason": f"Detected as amount field, mapped to {target}"
                })
                mapped = True
            elif semantic_type == "quantity":
                mappings.append({
                    "sourceField": field["fieldName"],
                    "targetField": "quantity",
                    "targetCategory": "measures",
                    "confidence": 0.7,
                    "reason": "Detected as quantity field"
                })
                mapped = True
            elif semantic_type in ["category", "product", "geography"]:
                target = "category"
                if semantic_type == "product":
                    target = "product"
                elif semantic_type == "geography":
                    target = "region"

                mappings.append({
                    "sourceField": field["fieldName"],
                    "targetField": target,
                    "targetCategory": "category_dimensions",
                    "confidence": 0.7,
                    "reason": f"Detected as {semantic_type} field"
                })
                mapped = True

            if not mapped:
                unmapped.append(field["fieldName"])

        return {
            "success": True,
            "mappings": mappings,
            "unmapped": unmapped,
            "method": "rule_based"
        }

    def _rule_based_chart_recommendation(self, detected_fields: List[dict]) -> dict:
        """Fallback rule-based chart recommendation"""
        recommendations = []

        # Find time, dimension, and measure fields
        time_fields = [f for f in detected_fields if f.get("chartRole") == "time"]
        dimension_fields = [f for f in detected_fields if f.get("chartRole") == "dimension"]
        measure_fields = [f for f in detected_fields if f.get("chartRole") == "measure"]

        # Trend analysis with time dimension
        if time_fields and measure_fields:
            recommendations.append({
                "chartType": "line",
                "title": "趋势分析",
                "xAxis": time_fields[0]["fieldName"],
                "yAxis": [f["fieldName"] for f in measure_fields[:3]],
                "series": dimension_fields[0]["fieldName"] if dimension_fields else None,
                "reason": "有时间维度，适合趋势分析",
                "priority": 1
            })

        # Comparison with category dimension
        if dimension_fields and measure_fields:
            recommendations.append({
                "chartType": "bar",
                "title": "对比分析",
                "xAxis": dimension_fields[0]["fieldName"],
                "yAxis": [measure_fields[0]["fieldName"]] if measure_fields else [],
                "series": None,
                "reason": "有分类维度，适合对比分析",
                "priority": 2
            })

        # Proportion analysis
        if dimension_fields and measure_fields:
            recommendations.append({
                "chartType": "pie",
                "title": "占比分析",
                "xAxis": dimension_fields[0]["fieldName"],
                "yAxis": [measure_fields[0]["fieldName"]] if measure_fields else [],
                "series": None,
                "reason": "适合查看各分类占比",
                "priority": 3
            })

        return {
            "success": True,
            "recommendations": recommendations,
            "method": "rule_based"
        }

    async def close(self):
        """Close HTTP client"""
        await self.client.aclose()
