from __future__ import annotations
"""
Field Mapping Service

Maps Excel column headers to standard fields using:
1. Exact match
2. Synonym dictionary matching
3. Data feature inference

Equivalent to Java's FieldMappingDictionary and mapFields() functionality.
"""
import logging
from typing import List, Optional, Dict, Any, Set
from enum import Enum
from dataclasses import dataclass, field

from .data_feature_analyzer import DataFeatureResult, DataType, NumericSubType

logger = logging.getLogger(__name__)


class MappingSource(str, Enum):
    """Source of the field mapping"""
    EXACT_MATCH = "EXACT_MATCH"       # Direct name match
    SYNONYM_MATCH = "SYNONYM_MATCH"   # Matched via synonym
    FEATURE_INFER = "FEATURE_INFER"   # Inferred from data features
    AI_SEMANTIC = "AI_SEMANTIC"       # AI-based semantic matching


@dataclass
class CandidateField:
    """A suggested candidate field for mapping"""
    field_name: str
    label: str
    score: float
    reason: str

    def to_dict(self) -> Dict[str, Any]:
        return {
            "fieldName": self.field_name,
            "label": self.label,
            "score": self.score,
            "reason": self.reason
        }


@dataclass
class FieldMappingResult:
    """Result of field mapping"""
    original_column: str
    column_index: int
    standard_field: Optional[str] = None
    standard_field_label: Optional[str] = None
    confidence: float = 0.0
    mapping_source: MappingSource = MappingSource.FEATURE_INFER
    data_type: Optional[str] = None
    sub_type: Optional[str] = None
    is_required: bool = False
    requires_confirmation: bool = True
    data_feature: Optional[DataFeatureResult] = None
    unique_values: Optional[List[str]] = None
    candidate_fields: List[CandidateField] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "originalColumn": self.original_column,
            "columnIndex": self.column_index,
            "standardField": self.standard_field,
            "standardFieldLabel": self.standard_field_label,
            "confidence": self.confidence,
            "mappingSource": self.mapping_source.value,
            "dataType": self.data_type,
            "subType": self.sub_type,
            "isRequired": self.is_required,
            "requiresConfirmation": self.requires_confirmation,
            "dataFeature": self.data_feature.to_dict() if self.data_feature else None,
            "uniqueValues": self.unique_values,
            "candidateFields": [c.to_dict() for c in self.candidate_fields]
        }


class FieldMappingDictionary:
    """
    Dictionary for mapping column names to standard fields.

    Contains:
    - Standard field definitions
    - Synonym mappings
    - Data type specifications
    - Required field indicators
    """

    # Standard field definitions with synonyms
    FIELD_DEFINITIONS = {
        # Financial fields
        "revenue": {
            "label": "收入",
            "synonyms": ["收入", "营业收入", "销售收入", "营收", "income", "sales", "revenue"],
            "data_type": "NUMERIC",
            "sub_type": "AMOUNT",
            "required": False
        },
        "cost": {
            "label": "成本",
            "synonyms": ["成本", "营业成本", "销售成本", "cost", "cogs"],
            "data_type": "NUMERIC",
            "sub_type": "AMOUNT",
            "required": False
        },
        "profit": {
            "label": "利润",
            "synonyms": ["利润", "净利润", "毛利润", "毛利", "净利", "profit", "net_profit", "gross_profit"],
            "data_type": "NUMERIC",
            "sub_type": "AMOUNT",
            "required": False
        },
        "budget": {
            "label": "预算",
            "synonyms": ["预算", "预算数", "budget", "budgeted", "计划", "预算收入", "预算金额"],
            "data_type": "NUMERIC",
            "sub_type": "AMOUNT",
            "required": False
        },
        "actual": {
            "label": "实际",
            "synonyms": ["实际", "实际数", "actual", "实际收入", "实际金额", "完成"],
            "data_type": "NUMERIC",
            "sub_type": "AMOUNT",
            "required": False
        },
        "yoy_prior": {
            "label": "同期数",
            "synonyms": ["同期", "同期数", "去年同期", "24年同期", "23年同期", "prior_year", "yoy"],
            "data_type": "NUMERIC",
            "sub_type": "AMOUNT",
            "required": False
        },

        # Dimension fields
        "period": {
            "label": "期间",
            "synonyms": ["期间", "时间", "月份", "季度", "年份", "period", "month", "quarter", "year", "date"],
            "data_type": "DATE",
            "required": False
        },
        "department": {
            "label": "部门",
            "synonyms": ["部门", "分部", "区域", "department", "division", "region"],
            "data_type": "CATEGORICAL",
            "required": False
        },
        "product": {
            "label": "产品",
            "synonyms": ["产品", "产品名称", "商品", "品类", "product", "item", "sku"],
            "data_type": "CATEGORICAL",
            "required": False
        },
        "category": {
            "label": "类别",
            "synonyms": ["类别", "分类", "类型", "category", "type"],
            "data_type": "CATEGORICAL",
            "required": False
        },
        "item": {
            "label": "项目",
            "synonyms": ["项目", "科目", "明细", "item", "line_item", "account"],
            "data_type": "TEXT",
            "required": False
        },

        # Sales fields
        "salesperson": {
            "label": "销售员",
            "synonyms": ["销售员", "销售人员", "业务员", "销售", "salesperson", "sales_rep"],
            "data_type": "TEXT",
            "required": False
        },
        "quantity": {
            "label": "数量",
            "synonyms": ["数量", "件数", "销量", "quantity", "qty", "count"],
            "data_type": "NUMERIC",
            "sub_type": "QUANTITY",
            "required": False
        },
        "amount": {
            "label": "金额",
            "synonyms": ["金额", "销售额", "总额", "amount", "total"],
            "data_type": "NUMERIC",
            "sub_type": "AMOUNT",
            "required": False
        },

        # Rate fields
        "growth_rate": {
            "label": "增长率",
            "synonyms": ["增长率", "同比增长", "环比增长", "growth_rate", "growth", "yoy_growth"],
            "data_type": "NUMERIC",
            "sub_type": "PERCENTAGE",
            "required": False
        },
        "achievement_rate": {
            "label": "达成率",
            "synonyms": ["达成率", "完成率", "achievement_rate", "completion_rate"],
            "data_type": "NUMERIC",
            "sub_type": "PERCENTAGE",
            "required": False
        },
        "margin": {
            "label": "毛利率",
            "synonyms": ["毛利率", "利润率", "净利率", "margin", "profit_margin", "gross_margin"],
            "data_type": "NUMERIC",
            "sub_type": "PERCENTAGE",
            "required": False
        }
    }

    def __init__(self):
        # Build reverse lookup: synonym -> standard_field
        self._synonym_map: Dict[str, str] = {}
        for field_name, definition in self.FIELD_DEFINITIONS.items():
            for synonym in definition["synonyms"]:
                self._synonym_map[synonym.lower()] = field_name

    def find_standard_field(self, column_name: str) -> Optional[str]:
        """
        Find the standard field for a column name.

        Args:
            column_name: The original column name

        Returns:
            Standard field name if found, None otherwise
        """
        if not column_name:
            return None

        lower_name = column_name.lower().strip()

        # Exact match in synonym map
        if lower_name in self._synonym_map:
            return self._synonym_map[lower_name]

        # Partial match
        for synonym, field_name in self._synonym_map.items():
            if synonym in lower_name or lower_name in synonym:
                return field_name

        return None

    def get_match_confidence(self, column_name: str, standard_field: str) -> int:
        """
        Calculate match confidence percentage.

        Args:
            column_name: Original column name
            standard_field: Matched standard field

        Returns:
            Confidence percentage (0-100)
        """
        if not column_name or not standard_field:
            return 0

        lower_name = column_name.lower().strip()
        definition = self.FIELD_DEFINITIONS.get(standard_field)

        if not definition:
            return 0

        synonyms = [s.lower() for s in definition["synonyms"]]

        # Exact match
        if lower_name in synonyms:
            return 100

        # Partial match
        for synonym in synonyms:
            if synonym in lower_name or lower_name in synonym:
                # Calculate similarity
                overlap = len(set(synonym) & set(lower_name))
                max_len = max(len(synonym), len(lower_name))
                return int(60 + (overlap / max_len) * 30)

        return 50

    def get_data_type(self, standard_field: str) -> Optional[str]:
        """Get the expected data type for a standard field"""
        definition = self.FIELD_DEFINITIONS.get(standard_field)
        return definition.get("data_type") if definition else None

    def get_sub_type(self, standard_field: str) -> Optional[str]:
        """Get the expected sub-type for a standard field"""
        definition = self.FIELD_DEFINITIONS.get(standard_field)
        return definition.get("sub_type") if definition else None

    def is_required(self, standard_field: str) -> bool:
        """Check if a field is required"""
        definition = self.FIELD_DEFINITIONS.get(standard_field)
        return definition.get("required", False) if definition else False

    def get_field_label(self, standard_field: str) -> str:
        """Get the display label for a standard field"""
        definition = self.FIELD_DEFINITIONS.get(standard_field)
        return definition.get("label", standard_field) if definition else standard_field

    def get_all_synonyms(self, standard_field: str) -> List[str]:
        """Get all synonyms for a standard field"""
        definition = self.FIELD_DEFINITIONS.get(standard_field)
        return definition.get("synonyms", []) if definition else []

    def get_missing_recommended_fields(self, mapped_fields: Set[str]) -> List[str]:
        """Get list of recommended fields that are not yet mapped"""
        recommended = {"period", "department", "revenue", "profit"}
        return list(recommended - mapped_fields)


class FieldMappingService:
    """
    Service for mapping Excel headers to standard fields.

    Equivalent to Java's mapFields() method in ExcelDynamicParserServiceImpl.
    """

    CONFIDENCE_THRESHOLD = 70.0

    def __init__(self):
        self.dictionary = FieldMappingDictionary()

    def map_fields(
        self,
        headers: List[str],
        features: List[DataFeatureResult],
        factory_id: Optional[str] = None
    ) -> List[FieldMappingResult]:
        """
        Map Excel headers to standard fields.

        Two-stage process:
        1. Dictionary matching (fast)
        2. Feature-based inference (for unmatched)

        Args:
            headers: List of column headers
            features: List of data feature analysis results
            factory_id: Optional factory ID for factory-specific mappings

        Returns:
            List of FieldMappingResult
        """
        logger.info(f"Mapping fields: header_count={len(headers)}, factory_id={factory_id}")
        results: List[FieldMappingResult] = []

        for i, header in enumerate(headers):
            feature = features[i] if i < len(features) else None

            # Try dictionary match first
            result = self._try_dictionary_match(header, i, feature)

            if result is None:
                # Fall back to feature-based inference
                result = self._build_feature_infer_mapping(header, i, feature)

            results.append(result)

        # Log summary
        dict_matches = sum(
            1 for r in results
            if r.mapping_source in (MappingSource.EXACT_MATCH, MappingSource.SYNONYM_MATCH)
        )
        logger.info(f"Field mapping complete: dictionary_matches={dict_matches}, inferred={len(results) - dict_matches}")

        return results

    def _try_dictionary_match(
        self,
        header: str,
        column_index: int,
        feature: Optional[DataFeatureResult]
    ) -> Optional[FieldMappingResult]:
        """Try to match header using dictionary"""
        standard_field = self.dictionary.find_standard_field(header)

        if not standard_field:
            return None

        confidence = self.dictionary.get_match_confidence(header, standard_field)
        data_type = self.dictionary.get_data_type(standard_field)
        sub_type = self.dictionary.get_sub_type(standard_field)
        is_required = self.dictionary.is_required(standard_field)
        label = self.dictionary.get_field_label(standard_field)

        source = MappingSource.EXACT_MATCH if confidence == 100 else MappingSource.SYNONYM_MATCH

        # Get sub_type from feature if not defined in dictionary
        if not sub_type and feature and feature.numeric_sub_type:
            sub_type = feature.numeric_sub_type.value

        return FieldMappingResult(
            original_column=header,
            column_index=column_index,
            standard_field=standard_field,
            standard_field_label=label,
            confidence=float(confidence),
            mapping_source=source,
            data_type=data_type,
            sub_type=sub_type,
            is_required=is_required,
            requires_confirmation=confidence < self.CONFIDENCE_THRESHOLD,
            data_feature=feature,
            unique_values=feature.unique_values if feature and feature.data_type == DataType.CATEGORICAL else None
        )

    def _build_feature_infer_mapping(
        self,
        header: str,
        column_index: int,
        feature: Optional[DataFeatureResult]
    ) -> FieldMappingResult:
        """Build a mapping based on data feature inference"""
        candidates = self._suggest_candidates(header, feature)

        data_type = feature.data_type.value if feature else "TEXT"
        sub_type = feature.numeric_sub_type.value if feature and feature.numeric_sub_type else None

        return FieldMappingResult(
            original_column=header,
            column_index=column_index,
            standard_field=None,
            standard_field_label=None,
            confidence=0.0,
            mapping_source=MappingSource.FEATURE_INFER,
            data_type=data_type,
            sub_type=sub_type,
            is_required=False,
            requires_confirmation=True,
            data_feature=feature,
            unique_values=feature.unique_values if feature and feature.data_type == DataType.CATEGORICAL else None,
            candidate_fields=candidates
        )

    def _suggest_candidates(
        self,
        header: str,
        feature: Optional[DataFeatureResult]
    ) -> List[CandidateField]:
        """Suggest candidate fields based on data type"""
        candidates: List[CandidateField] = []

        if not feature:
            return candidates

        if feature.data_type == DataType.DATE:
            candidates.extend([
                CandidateField("period", "期间", 60.0, "日期类型匹配"),
            ])
        elif feature.data_type == DataType.NUMERIC:
            if feature.numeric_sub_type == NumericSubType.AMOUNT:
                candidates.extend([
                    CandidateField("amount", "金额", 60.0, "金额类型匹配"),
                    CandidateField("revenue", "收入", 50.0, "金额类型匹配"),
                    CandidateField("cost", "成本", 50.0, "金额类型匹配"),
                ])
            elif feature.numeric_sub_type == NumericSubType.QUANTITY:
                candidates.extend([
                    CandidateField("quantity", "数量", 60.0, "数量类型匹配"),
                ])
            elif feature.numeric_sub_type == NumericSubType.PERCENTAGE:
                candidates.extend([
                    CandidateField("margin", "毛利率", 60.0, "百分比类型匹配"),
                    CandidateField("growth_rate", "增长率", 50.0, "百分比类型匹配"),
                ])
        elif feature.data_type == DataType.CATEGORICAL:
            candidates.extend([
                CandidateField("department", "部门", 60.0, "分类类型匹配"),
                CandidateField("category", "类别", 50.0, "分类类型匹配"),
            ])
        elif feature.data_type == DataType.ID:
            candidates.extend([
                CandidateField("salesperson", "销售员", 60.0, "ID类型匹配"),
                CandidateField("product", "产品", 50.0, "ID类型匹配"),
            ])

        return candidates[:5]  # Limit to 5 candidates
