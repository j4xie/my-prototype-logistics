from __future__ import annotations
"""
Semantic Mapper Service

Maps Excel column names to standard business fields using:
1. Rule-based dictionary matching
2. LLM-based semantic understanding
3. Multi-model consensus for ambiguous cases

Part of the Zero-Code SmartBI architecture.
"""
import json
import logging
import re
from dataclasses import dataclass, field, asdict
from typing import Any, Dict, List, Optional, Set, Tuple

logger = logging.getLogger(__name__)


@dataclass
class FieldMapping:
    """A single field mapping result"""
    original: str  # Original column name
    standard: Optional[str]  # Mapped standard field name
    confidence: float  # Mapping confidence (0.0-1.0)
    method: str  # rule, llm, multi_model
    category: Optional[str] = None  # Field category (amount, rate, category, time, etc.)
    description: Optional[str] = None  # Human-readable description

    def to_dict(self) -> Dict[str, Any]:
        return {
            "original": self.original,
            "standard": self.standard,
            "confidence": self.confidence,
            "method": self.method,
            "category": self.category,
            "description": self.description
        }


@dataclass
class SemanticMappingResult:
    """Result of semantic mapping"""
    success: bool = True
    confidence: float = 0.0
    method: str = "unknown"
    table_type: Optional[str] = None  # profit_statement, sales_report, budget, etc.
    field_mappings: List[FieldMapping] = field(default_factory=list)
    time_dimension: Optional[Dict[str, Any]] = None  # Time-related columns
    unmapped_fields: List[str] = field(default_factory=list)
    error: Optional[str] = None
    note: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        result = {
            "success": self.success,
            "confidence": self.confidence,
            "method": self.method,
            "table_type": self.table_type,
            "field_mappings": [fm.to_dict() for fm in self.field_mappings],
            "unmapped_fields": self.unmapped_fields
        }
        if self.time_dimension:
            result["time_dimension"] = self.time_dimension
        if self.error:
            result["error"] = self.error
        if self.note:
            result["note"] = self.note
        return result


# Standard field dictionary for financial/business data
STANDARD_FIELDS = {
    # Amount fields
    "budget_amount": {
        "synonyms": ["预算数", "预算金额", "预算", "Budget", "budget_amount", "预算值"],
        "category": "amount",
        "description": "Budget amount"
    },
    "actual_amount": {
        "synonyms": ["本月实际", "实际数", "实际金额", "实际", "Actual", "actual_amount", "实际值", "当月实际"],
        "category": "amount",
        "description": "Actual amount"
    },
    "variance": {
        "synonyms": ["预实差异", "差异", "Variance", "variance", "差额", "预算差异"],
        "category": "amount",
        "description": "Variance between budget and actual"
    },
    "last_year_actual": {
        "synonyms": ["去年同期", "同期实际", "Last Year", "YoY", "去年实际", "上年同期"],
        "category": "amount",
        "description": "Last year's actual amount"
    },
    "ytd_actual": {
        "synonyms": ["累计实际", "YTD Actual", "累计", "本年累计", "年度累计"],
        "category": "amount",
        "description": "Year-to-date actual"
    },
    "ytd_budget": {
        "synonyms": ["累计预算", "YTD Budget", "本年累计预算", "年度累计预算"],
        "category": "amount",
        "description": "Year-to-date budget"
    },

    # Rate fields
    "achievement_rate": {
        "synonyms": ["达成率", "完成率", "Achievement Rate", "达成比例", "完成比例", "预算达成率"],
        "category": "rate",
        "description": "Achievement/completion rate"
    },
    "yoy_rate": {
        "synonyms": ["同比增长", "YoY Rate", "同比", "同比变化", "同比增幅"],
        "category": "rate",
        "description": "Year-over-year growth rate"
    },
    "mom_rate": {
        "synonyms": ["环比增长", "MoM Rate", "环比", "环比变化", "月环比"],
        "category": "rate",
        "description": "Month-over-month growth rate"
    },
    "gross_margin_rate": {
        "synonyms": ["毛利率", "Gross Margin", "销售毛利率"],
        "category": "rate",
        "description": "Gross margin rate"
    },
    "net_margin_rate": {
        "synonyms": ["净利率", "Net Margin", "销售净利率", "净利润率"],
        "category": "rate",
        "description": "Net margin rate"
    },

    # Category fields
    "category": {
        "synonyms": ["项目", "科目", "Category", "类别", "分类", "项目名称"],
        "category": "category",
        "description": "Category or line item name"
    },
    "department": {
        "synonyms": ["部门", "Department", "组织", "事业部", "中心"],
        "category": "category",
        "description": "Department or organization unit"
    },
    "product": {
        "synonyms": ["产品", "Product", "商品", "产品名称", "品类"],
        "category": "category",
        "description": "Product name"
    },
    "region": {
        "synonyms": ["区域", "Region", "地区", "区域名称", "销售区域"],
        "category": "category",
        "description": "Region name"
    },

    # Financial line items
    "revenue": {
        "synonyms": ["销售收入", "收入", "Revenue", "营业收入", "主营业务收入"],
        "category": "amount",
        "description": "Revenue/Sales income"
    },
    "cost": {
        "synonyms": ["成本", "Cost", "销售成本", "营业成本", "主营业务成本"],
        "category": "amount",
        "description": "Cost"
    },
    "gross_profit": {
        "synonyms": ["毛利", "毛利润", "Gross Profit", "销售毛利"],
        "category": "amount",
        "description": "Gross profit"
    },
    "expense": {
        "synonyms": ["费用", "Expense", "营业费用", "销售费用", "管理费用"],
        "category": "amount",
        "description": "Expense"
    },
    "net_profit": {
        "synonyms": ["净利润", "Net Profit", "利润", "净利", "本期利润"],
        "category": "amount",
        "description": "Net profit"
    },

    # Time fields
    "period": {
        "synonyms": ["期间", "Period", "月份", "日期", "时间"],
        "category": "time",
        "description": "Time period"
    }
}

# Table type patterns
TABLE_TYPE_PATTERNS = {
    "profit_statement": {
        "keywords": ["利润表", "损益表", "Profit", "Income Statement", "P&L"],
        "required_fields": ["revenue", "cost", "gross_profit"]
    },
    "sales_report": {
        "keywords": ["销售报表", "Sales Report", "销售分析", "销售统计"],
        "required_fields": ["revenue", "category"]
    },
    "budget_report": {
        "keywords": ["预算", "Budget", "预算执行", "预算分析"],
        "required_fields": ["budget_amount", "actual_amount"]
    },
    "expense_report": {
        "keywords": ["费用报表", "Expense Report", "费用分析"],
        "required_fields": ["expense", "category"]
    }
}


class SemanticMapper:
    """
    Maps column names to standard fields using layered approach:

    Layer 1: Rule-based dictionary matching (fast, accurate for known terms)
    Layer 2: LLM-based semantic matching (for unknown terms)
    Layer 3: Multi-model consensus (for ambiguous cases)
    """

    def __init__(self):
        self._settings = None
        self._custom_mappings: Dict[str, Dict[str, str]] = {}  # factory_id -> {original: standard}

    @property
    def settings(self):
        if self._settings is None:
            from config import get_settings
            self._settings = get_settings()
        return self._settings

    def add_custom_mapping(self, factory_id: str, original: str, standard: str):
        """Add a custom mapping for a specific factory"""
        if factory_id not in self._custom_mappings:
            self._custom_mappings[factory_id] = {}
        self._custom_mappings[factory_id][original] = standard

    async def map_fields(
        self,
        columns: List[str],
        sample_data: Optional[List[List[Any]]] = None,
        factory_id: Optional[str] = None,
        table_context: Optional[str] = None
    ) -> SemanticMappingResult:
        """
        Map column names to standard fields.

        Args:
            columns: List of column names to map
            sample_data: Optional sample data for context
            factory_id: Optional factory ID for custom mappings
            table_context: Optional context about the table (e.g., sheet name)

        Returns:
            SemanticMappingResult with all mappings
        """
        result = SemanticMappingResult()
        mappings: List[FieldMapping] = []
        unmapped: List[str] = []

        # Detect table type from context
        if table_context:
            result.table_type = self._detect_table_type(table_context, columns)

        # Detect time dimension columns
        time_columns = self._detect_time_columns(columns)
        if time_columns:
            result.time_dimension = {
                "type": time_columns["type"],
                "columns": time_columns["columns"]
            }

        # Layer 1: Rule-based mapping
        rule_mappings, rule_unmapped = self._map_with_rules(columns, factory_id)
        mappings.extend(rule_mappings)

        # If all mapped with high confidence, return
        if not rule_unmapped or all(m.confidence >= self.settings.semantic_mapping_confidence_threshold for m in mappings):
            result.field_mappings = mappings
            result.unmapped_fields = rule_unmapped
            result.confidence = sum(m.confidence for m in mappings) / len(mappings) if mappings else 0.5
            result.method = "rule"
            return result

        # Layer 2: LLM mapping for unmapped fields
        if rule_unmapped:
            llm_mappings = await self._map_with_llm(rule_unmapped, columns, sample_data, table_context)
            mappings.extend(llm_mappings)

            # Update unmapped list
            llm_mapped = {m.original for m in llm_mappings if m.standard}
            unmapped = [c for c in rule_unmapped if c not in llm_mapped]

        # Check overall confidence
        avg_confidence = sum(m.confidence for m in mappings) / len(mappings) if mappings else 0.0

        if avg_confidence < self.settings.semantic_mapping_confidence_threshold and unmapped:
            # Layer 3: Multi-model enhancement
            enhanced_mappings = await self._map_with_multi_model(
                unmapped, columns, sample_data, table_context
            )
            mappings.extend(enhanced_mappings)
            unmapped = [c for c in unmapped if c not in {m.original for m in enhanced_mappings if m.standard}]

        result.field_mappings = mappings
        result.unmapped_fields = unmapped
        result.confidence = sum(m.confidence for m in mappings) / len(mappings) if mappings else 0.5
        result.method = "combined"

        return result

    def _map_with_rules(
        self, columns: List[str], factory_id: Optional[str] = None
    ) -> Tuple[List[FieldMapping], List[str]]:
        """
        Rule-based field mapping (Layer 1).
        """
        mappings = []
        unmapped = []

        # Check custom mappings first
        custom_map = self._custom_mappings.get(factory_id, {}) if factory_id else {}

        for col in columns:
            col_lower = col.lower().strip()
            col_cleaned = self._clean_column_name(col)

            # Check custom mapping
            if col in custom_map:
                mappings.append(FieldMapping(
                    original=col,
                    standard=custom_map[col],
                    confidence=0.95,
                    method="custom",
                    description="Custom factory mapping"
                ))
                continue

            # Check standard field dictionary
            matched = False
            for standard_name, field_info in STANDARD_FIELDS.items():
                for synonym in field_info["synonyms"]:
                    if self._match_synonym(col_cleaned, synonym):
                        mappings.append(FieldMapping(
                            original=col,
                            standard=standard_name,
                            confidence=0.9,
                            method="rule",
                            category=field_info.get("category"),
                            description=field_info.get("description")
                        ))
                        matched = True
                        break
                if matched:
                    break

            if not matched:
                unmapped.append(col)

        return mappings, unmapped

    def _match_synonym(self, column: str, synonym: str) -> bool:
        """Check if column matches a synonym"""
        col_lower = column.lower()
        syn_lower = synonym.lower()

        # Exact match
        if col_lower == syn_lower:
            return True

        # Contains match (for composite columns)
        if syn_lower in col_lower or col_lower in syn_lower:
            return True

        # Partial match after cleaning
        col_cleaned = re.sub(r'[_\-\s]+', '', col_lower)
        syn_cleaned = re.sub(r'[_\-\s]+', '', syn_lower)
        if col_cleaned == syn_cleaned:
            return True

        return False

    def _clean_column_name(self, name: str) -> str:
        """Clean column name for matching"""
        # Remove common prefixes/suffixes
        cleaned = name.strip()
        # Remove merged header artifacts
        cleaned = re.sub(r'^[\d\s月年Q]+[_\-\s]*', '', cleaned)
        # Remove trailing numbers
        cleaned = re.sub(r'[_\-\s]*\d+$', '', cleaned)
        return cleaned

    async def _map_with_llm(
        self,
        unmapped_columns: List[str],
        all_columns: List[str],
        sample_data: Optional[List[List[Any]]],
        table_context: Optional[str]
    ) -> List[FieldMapping]:
        """
        LLM-based field mapping (Layer 2).
        """
        if not unmapped_columns:
            return []

        try:
            # Prepare context
            available_standards = list(STANDARD_FIELDS.keys())

            # Sample data context
            sample_text = ""
            if sample_data and len(sample_data) > 0:
                sample_text = "\nSample data:\n"
                for i, row in enumerate(sample_data[:3]):
                    row_vals = [str(v) if v else "" for v in row[:10]]
                    sample_text += f"  Row {i}: {' | '.join(row_vals)}\n"

            # Detect wide-format data
            wide_format_instruction = self._build_wide_format_instruction(all_columns)

            prompt = f"""Map these column names to standard business field names.

Columns to map: {unmapped_columns}
All columns in table: {all_columns[:20]}
Available standard fields: {available_standards}
Table context: {table_context or 'Unknown'}
{sample_text}
{wide_format_instruction}

For each column, determine the most appropriate standard field.
If no match, return null for standard.

Return JSON only:
{{
  "mappings": [
    {{"original": "column_name", "standard": "standard_field_or_null", "confidence": 0.0-1.0, "reasoning": "brief reason"}}
  ]
}}"""

            response = await self._call_llm(prompt)
            if response:
                parsed = self._parse_json_response(response)
                if parsed and "mappings" in parsed:
                    result = []
                    for m in parsed["mappings"]:
                        std = m.get("standard")
                        if std and std != "null" and std in STANDARD_FIELDS:
                            field_info = STANDARD_FIELDS[std]
                            result.append(FieldMapping(
                                original=m["original"],
                                standard=std,
                                confidence=m.get("confidence", 0.7),
                                method="llm",
                                category=field_info.get("category"),
                                description=m.get("reasoning")
                            ))
                        else:
                            result.append(FieldMapping(
                                original=m["original"],
                                standard=None,
                                confidence=m.get("confidence", 0.5),
                                method="llm",
                                description="No matching standard field"
                            ))
                    return result

        except Exception as e:
            logger.warning(f"LLM mapping failed: {e}")

        # Return low-confidence unmapped results
        return [
            FieldMapping(
                original=col,
                standard=None,
                confidence=0.3,
                method="llm_failed",
                description="LLM mapping failed"
            )
            for col in unmapped_columns
        ]

    async def _map_with_multi_model(
        self,
        unmapped_columns: List[str],
        all_columns: List[str],
        sample_data: Optional[List[List[Any]]],
        table_context: Optional[str]
    ) -> List[FieldMapping]:
        """
        Multi-model consensus mapping (Layer 3).
        """
        if not unmapped_columns:
            return []

        try:
            # Get multiple LLM opinions
            results = []

            # Call with different prompting strategies
            prompt1 = self._create_mapping_prompt(unmapped_columns, all_columns, "semantic")
            prompt2 = self._create_mapping_prompt(unmapped_columns, all_columns, "contextual")

            response1 = await self._call_llm(prompt1)
            response2 = await self._call_llm(prompt2, model="fast")

            if response1:
                parsed1 = self._parse_json_response(response1)
                if parsed1:
                    results.append(parsed1.get("mappings", []))

            if response2:
                parsed2 = self._parse_json_response(response2)
                if parsed2:
                    results.append(parsed2.get("mappings", []))

            # Vote on mappings
            if results:
                return self._vote_on_mappings(unmapped_columns, results)

        except Exception as e:
            logger.warning(f"Multi-model mapping failed: {e}")

        # Fallback
        return [
            FieldMapping(
                original=col,
                standard=None,
                confidence=0.4,
                method="multi_model_failed",
                description="Could not determine mapping"
            )
            for col in unmapped_columns
        ]

    def _create_mapping_prompt(
        self, columns: List[str], all_columns: List[str], strategy: str
    ) -> str:
        """Create mapping prompt based on strategy"""
        available_standards = list(STANDARD_FIELDS.keys())

        if strategy == "semantic":
            return f"""Analyze the semantic meaning of these column names and map to standard fields.

Columns: {columns}
Context columns: {all_columns[:15]}
Standard fields: {available_standards}

Focus on the meaning of each column name.
Return JSON: {{"mappings": [{{"original": "col", "standard": "field_or_null", "confidence": 0.0-1.0}}]}}"""

        else:  # contextual
            return f"""Given the context of a business data table, map these columns.

Columns to map: {columns}
All columns (for context): {all_columns[:15]}
Available standard fields: {available_standards}

Consider how these columns relate to each other.
Return JSON: {{"mappings": [{{"original": "col", "standard": "field_or_null", "confidence": 0.0-1.0}}]}}"""

    def _vote_on_mappings(
        self, columns: List[str], all_results: List[List[Dict]]
    ) -> List[FieldMapping]:
        """Vote on mappings from multiple model results"""
        mappings = []

        for col in columns:
            # Collect all mappings for this column
            col_mappings = []
            for result in all_results:
                for m in result:
                    if m.get("original") == col:
                        col_mappings.append(m)

            if not col_mappings:
                mappings.append(FieldMapping(
                    original=col,
                    standard=None,
                    confidence=0.3,
                    method="multi_model"
                ))
                continue

            # Vote on standard field
            standards = [m.get("standard") for m in col_mappings if m.get("standard")]
            if standards:
                # Most common standard
                voted_standard = max(set(standards), key=standards.count)
                agreement = standards.count(voted_standard) / len(col_mappings)

                field_info = STANDARD_FIELDS.get(voted_standard, {})
                mappings.append(FieldMapping(
                    original=col,
                    standard=voted_standard if voted_standard in STANDARD_FIELDS else None,
                    confidence=min(0.85, 0.6 + agreement * 0.25),
                    method="multi_model",
                    category=field_info.get("category"),
                    description=field_info.get("description")
                ))
            else:
                mappings.append(FieldMapping(
                    original=col,
                    standard=None,
                    confidence=0.4,
                    method="multi_model"
                ))

        return mappings

    def _detect_table_type(self, context: str, columns: List[str]) -> Optional[str]:
        """Detect table type from context and columns"""
        context_lower = context.lower()
        columns_lower = [c.lower() for c in columns]

        for table_type, info in TABLE_TYPE_PATTERNS.items():
            # Check keywords in context
            for keyword in info["keywords"]:
                if keyword.lower() in context_lower:
                    return table_type

        return None

    def _detect_time_columns(self, columns: List[str]) -> Optional[Dict[str, Any]]:
        """Detect time-related columns"""
        time_patterns = {
            "monthly": [r'\d{1,2}月', r'[Jj]an|[Ff]eb|[Mm]ar|[Aa]pr|[Mm]ay|[Jj]un|[Jj]ul|[Aa]ug|[Ss]ep|[Oo]ct|[Nn]ov|[Dd]ec'],
            "quarterly": [r'Q[1-4]', r'第[一二三四]季度'],
            "yearly": [r'\d{4}年', r'20\d{2}']
        }

        for time_type, patterns in time_patterns.items():
            matched_columns = []
            for col in columns:
                for pattern in patterns:
                    if re.search(pattern, col):
                        matched_columns.append(col)
                        break

            if len(matched_columns) >= 2:
                return {
                    "type": time_type,
                    "columns": matched_columns
                }

        return None

    def _is_wide_format(self, columns: List[str]) -> bool:
        """
        Detect if data is wide-format (multiple time-period columns).
        """
        # Chinese month pattern (1月, 2月, ... 12月)
        chinese_month_pattern = re.compile(r'[_]?(1[0-2]|[1-9])月[_]?')
        # English/numeric month pattern (202501, 2025-01)
        numeric_month_pattern = re.compile(r'\d{4}[-_]?\d{2}')

        chinese_month_count = sum(1 for col in columns if chinese_month_pattern.search(col))
        numeric_month_count = sum(1 for col in columns if numeric_month_pattern.search(col))

        return chinese_month_count >= 3 or numeric_month_count >= 3

    def _build_wide_format_instruction(self, columns: List[str]) -> str:
        """
        Build instruction for LLM to handle wide-format data with time dimensions.
        """
        if not self._is_wide_format(columns):
            return ""

        return """
【重要】这是宽格式数据（多个时间列），请遵循以下映射规则：

1. **保留时间维度**: 列名包含月份时，standard字段必须带时间后缀
   - 格式: {metric_type}_{YYYYMM}
   - 例: "1月_预算收入" → "budget_amount_202501"
   - 例: "2月_实际金额" → "actual_amount_202502"
   - 例: "12月_利润" → "net_profit_202512"

2. **年份识别**:
   - 列名有年份（2025年、25年）则使用该年份
   - 无年份信息默认使用2025

3. **metric_type对照**:
   - 预算/计划/目标 → budget_amount
   - 实际/完成/执行 → actual_amount
   - 同期/去年/24年 → last_year_actual
   - 利润/净利 → net_profit
   - 收入/营收 → revenue
   - 成本 → cost

4. **年度汇总列**: "年度汇总"/"全年"/"累计" → ytd_actual 或 ytd_budget
"""

    async def _call_llm(self, prompt: str, model: str = "default") -> Optional[str]:
        """Call LLM API"""
        try:
            from openai import AsyncOpenAI

            model_name = {
                "default": self.settings.llm_model,
                "fast": self.settings.llm_fast_model
            }.get(model, self.settings.llm_model)

            client = AsyncOpenAI(
                api_key=self.settings.llm_api_key,
                base_url=self.settings.llm_base_url
            )

            response = await client.chat.completions.create(
                model=model_name,
                messages=[{"role": "user", "content": prompt}],
                temperature=0.1,
                max_tokens=1000
            )

            return response.choices[0].message.content

        except Exception as e:
            logger.error(f"LLM call failed: {e}")
            return None

    def _parse_json_response(self, response: str) -> Optional[Dict]:
        """Parse JSON from LLM response"""
        try:
            # Try to extract JSON from response
            json_match = re.search(r'\{[\s\S]*\}', response)
            if json_match:
                return json.loads(json_match.group())
            return None
        except json.JSONDecodeError as e:
            logger.warning(f"Failed to parse LLM response as JSON: {e}")
            return None
