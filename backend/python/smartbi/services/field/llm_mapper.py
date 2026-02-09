from __future__ import annotations
"""
LLM Field Mapper Service (Sheet Analysis & Chart Recommendation)

Specialized service for:
1. Analyzing Excel workbooks to identify analyzable sheets
2. Recommending chart types based on data structure

For field-to-field mapping, use:
- FieldMappingService (fast, dictionary-based) from field_mapping.py
- SemanticMapper (LLM-based with caching) from semantic_mapper.py

This service focuses on higher-level decisions about WHICH sheets to analyze
and WHAT charts to recommend, rather than individual field mapping.
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

    async def analyze_sheets(
        self,
        sheets_info: List[dict]
    ) -> Dict[str, Any]:
        """
        Use LLM to analyze which sheets contain valid analyzable data

        Args:
            sheets_info: List of sheet information with name, rowCount, columnCount, previewHeaders

        Returns:
            Analysis results with recommended sheets and data types
        """
        if not self.settings.llm_api_key:
            return self._rule_based_sheet_analysis(sheets_info)

        prompt = self._build_sheet_analysis_prompt(sheets_info)

        try:
            response = await self._call_llm(prompt)
            return self._parse_sheet_analysis_response(response, sheets_info)
        except Exception as e:
            logger.error(f"LLM sheet analysis failed, using rule-based: {e}")
            return self._rule_based_sheet_analysis(sheets_info)

    def _build_sheet_analysis_prompt(self, sheets_info: List[dict]) -> str:
        """Build prompt for sheet analysis"""
        sheets_desc = "\n".join([
            f"Sheet {s.get('index')}: {s.get('name')}\n"
            f"  - 行数: {s.get('rowCount')}, 列数: {s.get('columnCount')}\n"
            f"  - 表头预览: {s.get('previewHeaders', [])[:5]}"
            for s in sheets_info
        ])

        prompt = f"""请分析以下Excel工作表，理解每个Sheet的作用和数据内容。

重要原则：
1. **所有有数据的表都应该分析** - 只要有数据，就值得分析
2. **文字说明表同样重要** - 如果某个Sheet主要是文字说明（如"索引"、"说明"等），它通常是帮助理解其他数据表的重要上下文，应该提取其中的业务规则和计算说明
3. **数据表需要识别类型** - 对于包含数值数据的表，识别其数据类型（财务/销售/部门等）

工作表列表：
{sheets_desc}

请分析每个Sheet的用途：
1. **说明类** (documentation): 包含业务规则、计算方法、数据来源说明的文字表格 - 虽然不直接分析，但其内容对理解其他表格至关重要
2. **汇总类** (summary): 包含汇总数据、KPI、关键指标的表格 - 需要分析
3. **明细类** (detail): 包含详细业务数据的表格 - 需要分析
4. **配置类** (config): 包含配置信息、映射关系的表格 - 用于数据转换

请返回JSON格式：
{{
    "sheets": [
        {{
            "index": 0,
            "name": "Sheet名称",
            "category": "documentation/summary/detail/config",
            "dataType": "sales/finance/department/inventory/rebate/unknown",
            "analyzable": true,
            "hasNumericData": true/false,
            "isDocumentation": true/false,
            "priority": 1-5,
            "reason": "该Sheet的作用说明",
            "businessContext": "从该Sheet可以获得的业务上下文（如果是说明类）"
        }}
    ],
    "documentationSheets": [0],
    "dataSheets": [1, 2, 3],
    "summary": "整个Excel的结构说明和各Sheet关系"
}}"""
        return prompt

    def _parse_sheet_analysis_response(
        self,
        response: str,
        sheets_info: List[dict]
    ) -> Dict[str, Any]:
        """Parse LLM response for sheet analysis"""
        try:
            # Extract JSON from response
            json_start = response.find('{')
            json_end = response.rfind('}') + 1
            if json_start >= 0 and json_end > json_start:
                json_str = response[json_start:json_end]
                result = json.loads(json_str)
                result["success"] = True
                result["method"] = "llm"
                return result
        except Exception as e:
            logger.error(f"Failed to parse LLM sheet analysis response: {e}")

        return self._rule_based_sheet_analysis(sheets_info)

    def _rule_based_sheet_analysis(self, sheets_info: List[dict]) -> Dict[str, Any]:
        """Rule-based sheet analysis fallback - all sheets with data are analyzable"""
        results = []
        data_sheets = []
        documentation_sheets = []

        # Keywords for classification
        doc_keywords = ["索引", "目录", "说明", "index", "toc", "readme", "guide"]
        summary_keywords = ["汇总", "简表", "总表", "概览", "summary", "overview"]
        finance_keywords = ["利润", "成本", "费用", "预算", "财务", "应收", "应付", "税"]
        sales_keywords = ["销售", "订单", "客户", "产品", "收入", "revenue", "sales"]
        department_keywords = ["部门", "分部", "区域", "省区", "团队", "中心"]
        rebate_keywords = ["返利", "返点", "折扣", "rebate", "discount"]
        detail_keywords = ["明细", "详细", "detail", "list"]

        for sheet in sheets_info:
            name = sheet.get("name", "")
            name_lower = name.lower()
            row_count = sheet.get("rowCount", 0)
            col_count = sheet.get("columnCount", 0)
            headers = sheet.get("previewHeaders", [])
            all_text = name + " " + " ".join(str(h) for h in headers)

            # All sheets with data are analyzable
            has_data = row_count > 0 and col_count > 0
            has_numeric_data = row_count > 5 and col_count >= 3  # Likely has numeric data
            is_documentation = any(kw in name_lower for kw in doc_keywords) or (col_count <= 3 and row_count < 50)

            # Determine category
            if is_documentation and not has_numeric_data:
                category = "documentation"
                priority = 3
                business_context = "包含业务规则说明，帮助理解其他数据表"
            elif any(kw in name_lower for kw in summary_keywords):
                category = "summary"
                priority = 2
                business_context = "汇总数据表"
            elif any(kw in name_lower for kw in detail_keywords) or has_numeric_data:
                category = "detail"
                priority = 1
                business_context = "详细业务数据"
            else:
                category = "detail" if has_data else "other"
                priority = 2 if has_data else 5
                business_context = "业务数据表" if has_data else "空表或无效数据"

            # Detect data type
            if any(kw in all_text for kw in rebate_keywords):
                data_type = "rebate"
            elif any(kw in all_text for kw in finance_keywords):
                data_type = "finance"
            elif any(kw in all_text for kw in sales_keywords):
                data_type = "sales"
            elif any(kw in all_text for kw in department_keywords):
                data_type = "department"
            else:
                data_type = "unknown"

            result = {
                "index": sheet.get("index"),
                "name": name,
                "category": category,
                "dataType": data_type,
                "analyzable": has_data,  # All sheets with data are analyzable
                "hasNumericData": has_numeric_data,
                "isDocumentation": is_documentation,
                "priority": priority,
                "reason": f"行数={row_count}, 列数={col_count}",
                "businessContext": business_context
            }
            results.append(result)

            if is_documentation:
                documentation_sheets.append(sheet.get("index"))
            if has_numeric_data:
                data_sheets.append(sheet.get("index"))

        return {
            "success": True,
            "sheets": results,
            "documentationSheets": documentation_sheets,
            "dataSheets": data_sheets,
            "recommended": data_sheets,  # All data sheets are recommended
            "summary": f"共{len(sheets_info)}个Sheet: {len(documentation_sheets)}个说明表, {len(data_sheets)}个数据表",
            "method": "rule_based"
        }

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

        # Detect if this is wide-format data with time columns
        field_names = [f['fieldName'] for f in detected_fields]
        is_wide_format = self._detect_wide_format(field_names)

        wide_format_instruction = ""
        if is_wide_format:
            wide_format_instruction = """
【重要】这是宽格式数据（多个时间列），请遵循以下规则：

1. **保留时间维度**: 当列名包含月份信息（如"1月_预算收入"、"2月_实际金额"）时，必须在targetField中保留时间信息
   - 格式: {metric_type}_{YYYYMM}
   - 例如: "1月_预算收入" → "budget_202501"
   - 例如: "2月_实际收入" → "actual_202502"
   - 例如: "12月_利润" → "profit_202512"

2. **识别年份**:
   - 如果列名中有年份（如"2025年"、"25年"），使用该年份
   - 如果没有明确年份，默认使用2025年

3. **metric_type映射**:
   - 预算、计划、目标 → budget
   - 实际、完成、执行 → actual
   - 同期、去年、24年 → yoy_prior
   - 利润、净利 → profit
   - 收入、营收 → revenue
   - 成本 → cost

4. **年度汇总列**: 如果列名是"年度汇总"、"全年"、"累计"，映射为 annual_total_2025
"""

        prompt = f"""请分析以下数据字段，并将它们映射到标准业务字段。

检测到的字段：
{fields_desc}

标准业务字段：
{standard_fields_desc}

{f'业务背景：{context}' if context else ''}
{wide_format_instruction}

请返回JSON格式的映射结果：
{{
    "mappings": [
        {{
            "sourceField": "原始字段名",
            "targetField": "标准字段id（宽格式数据请带时间后缀如budget_202501）",
            "targetCategory": "time_dimensions/category_dimensions/measures",
            "confidence": 0.9,
            "reason": "映射原因"
        }}
    ],
    "unmapped": ["无法映射的字段列表"]
}}"""
        return prompt

    def _detect_wide_format(self, field_names: List[str]) -> bool:
        """
        Detect if the data is wide-format (multiple time-period columns).

        Wide-format indicators:
        - Multiple columns containing month patterns (1月, 2月, ..., 12月)
        - Multiple columns containing value_YYYYMM patterns
        - Multiple columns containing year-month patterns
        """
        import re

        # Pattern 1: Chinese month format (1月, 2月, ... 12月)
        chinese_month_pattern = re.compile(r'[_]?(1[0-2]|[1-9])月[_]?')

        # Pattern 2: English/numeric month format (value_202501, amount_202502)
        numeric_month_pattern = re.compile(r'(value|amount|profit|budget|actual|revenue|cost)_\d{6}')

        # Pattern 3: Year-month pattern (2025-01, 2025/01)
        year_month_pattern = re.compile(r'\d{4}[-/]\d{2}')

        chinese_month_count = sum(1 for name in field_names if chinese_month_pattern.search(name))
        numeric_month_count = sum(1 for name in field_names if numeric_month_pattern.search(name))
        year_month_count = sum(1 for name in field_names if year_month_pattern.search(name))

        # If 3+ columns match any pattern, it's wide-format
        return chinese_month_count >= 3 or numeric_month_count >= 3 or year_month_count >= 3

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
