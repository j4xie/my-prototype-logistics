from __future__ import annotations
"""
Table Classifier Service

Classifies table types to handle non-standard tables:
- Index/TOC tables
- Summary/aggregate tables
- Detail/transaction tables
- Pivot tables
- Metadata tables

Part of SmartBI Phase 2: Non-Standard Table Handling.
"""
import logging
import re
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Dict, List, Optional, Tuple

import pandas as pd
import numpy as np

logger = logging.getLogger(__name__)


class TableType(str, Enum):
    """Types of tables commonly found in business Excel files"""

    # Standard data tables
    DATA_TABLE = "data"           # Standard row-oriented data
    TIME_SERIES = "time_series"   # Time-indexed data

    # Non-standard tables
    INDEX_TABLE = "index"         # Table of contents, navigation
    SUMMARY_TABLE = "summary"     # Aggregated data, totals
    DETAIL_TABLE = "detail"       # Transaction-level detail
    PIVOT_TABLE = "pivot"         # Cross-tabulated data
    METADATA_TABLE = "metadata"   # Configuration, settings
    MATRIX_TABLE = "matrix"       # Two-dimensional cross-reference

    # Financial specific
    PROFIT_STATEMENT = "profit_statement"   # P&L format
    BALANCE_SHEET = "balance_sheet"         # Asset/liability format
    BUDGET_REPORT = "budget_report"         # Budget vs actual

    # Unknown
    UNKNOWN = "unknown"


@dataclass
class ClassificationResult:
    """Result of table classification"""
    table_type: TableType
    confidence: float

    # Classification evidence
    reasons: List[str] = field(default_factory=list)
    patterns_matched: List[str] = field(default_factory=list)

    # Recommended processing strategy
    recommended_strategy: Optional[str] = None
    skip_rows: int = 0
    header_rows: int = 1
    transpose: bool = False

    # For index tables
    linked_sheets: Optional[List[str]] = None

    # For summary tables
    total_rows: Optional[List[int]] = None
    subtotal_rows: Optional[List[int]] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "table_type": self.table_type.value,
            "confidence": self.confidence,
            "reasons": self.reasons,
            "patterns_matched": self.patterns_matched,
            "recommended_strategy": self.recommended_strategy,
            "processing_params": {
                "skip_rows": self.skip_rows,
                "header_rows": self.header_rows,
                "transpose": self.transpose
            },
            "linked_sheets": self.linked_sheets,
            "total_rows": self.total_rows,
            "subtotal_rows": self.subtotal_rows
        }


class TableClassifier:
    """
    Classifies table types based on structure and content analysis.

    Uses multiple heuristics:
    1. Sheet name patterns
    2. Header content analysis
    3. Data structure analysis
    4. Cell content patterns
    """

    # Pattern definitions for different table types
    PATTERNS = {
        TableType.INDEX_TABLE: {
            "name_patterns": [
                r"目录", r"索引", r"导航", r"内容",
                r"index", r"toc", r"contents", r"menu",
                r"sheet\s*list", r"navigation", r"cover"
            ],
            "header_keywords": [
                "序号", "sheet", "工作表", "页面", "链接",
                "number", "page", "link", "description"
            ],
            "content_patterns": [
                r"点击.*跳转",
                r"click.*to.*go",
                r"见.*表"
            ]
        },
        TableType.SUMMARY_TABLE: {
            "name_patterns": [
                r"汇总", r"合计", r"总计", r"概览", r"摘要",
                r"summary", r"total", r"overview", r"aggregate"
            ],
            "header_keywords": [
                "合计", "总计", "小计", "汇总", "累计",
                "total", "subtotal", "sum", "grand total"
            ],
            "row_indicators": [
                r"^合计$", r"^总计$", r"^小计",
                r"^total$", r"^subtotal$", r"^sum$"
            ]
        },
        TableType.DETAIL_TABLE: {
            "name_patterns": [
                r"明细", r"详情", r"清单", r"流水", r"记录",
                r"detail", r"transaction", r"record", r"log"
            ],
            "header_keywords": [
                "编号", "日期", "时间", "金额", "数量",
                "id", "date", "time", "amount", "quantity"
            ]
        },
        TableType.PIVOT_TABLE: {
            "name_patterns": [
                r"透视", r"交叉", r"矩阵",
                r"pivot", r"cross[-\s]?tab", r"matrix"
            ],
            "structure_indicators": [
                "row_headers_left",
                "column_headers_top",
                "values_in_center"
            ]
        },
        TableType.PROFIT_STATEMENT: {
            "name_patterns": [
                r"利润表", r"损益表", r"P&?L", r"收支",
                r"profit.*loss", r"income.*statement", r"P&L"
            ],
            "row_keywords": [
                "营业收入", "营业成本", "毛利", "营业利润", "净利润",
                "销售收入", "销售成本", "管理费用", "财务费用",
                "revenue", "cost of sales", "gross profit", "operating profit"
            ]
        },
        TableType.BALANCE_SHEET: {
            "name_patterns": [
                r"资产负债", r"balance.*sheet",
                r"财务状况", r"资产表"
            ],
            "row_keywords": [
                "资产", "负债", "所有者权益", "流动资产", "固定资产",
                "assets", "liabilities", "equity", "current assets"
            ]
        },
        TableType.BUDGET_REPORT: {
            "name_patterns": [
                r"预算", r"budget", r"计划.*实际",
                r"plan.*actual", r"预实"
            ],
            "header_keywords": [
                "预算", "实际", "差异", "完成率",
                "budget", "actual", "variance", "achievement"
            ]
        },
        TableType.METADATA_TABLE: {
            "name_patterns": [
                r"设置", r"配置", r"参数", r"说明",
                r"setting", r"config", r"parameter", r"description"
            ],
            "structure_indicators": [
                "key_value_pairs",
                "few_columns",
                "descriptive_content"
            ]
        }
    }

    def classify(
        self,
        sheet_name: str,
        df: pd.DataFrame,
        merged_cells: Optional[List[Dict]] = None
    ) -> ClassificationResult:
        """
        Classify a table based on its characteristics.

        Args:
            sheet_name: Name of the sheet
            df: DataFrame containing the data
            merged_cells: Optional list of merged cell info

        Returns:
            ClassificationResult with type and confidence
        """
        scores: Dict[TableType, float] = {t: 0.0 for t in TableType}
        reasons: Dict[TableType, List[str]] = {t: [] for t in TableType}
        patterns: Dict[TableType, List[str]] = {t: [] for t in TableType}

        # Step 1: Analyze sheet name
        name_scores = self._analyze_sheet_name(sheet_name)
        for table_type, score in name_scores.items():
            scores[table_type] += score * 0.3  # 30% weight for name
            if score > 0:
                reasons[table_type].append(f"Sheet name matches '{table_type.value}' pattern")
                patterns[table_type].append(f"name:{sheet_name}")

        # Step 2: Analyze structure
        structure_scores = self._analyze_structure(df, merged_cells)
        for table_type, score in structure_scores.items():
            scores[table_type] += score * 0.3  # 30% weight for structure
            if score > 0:
                reasons[table_type].append(f"Structure indicates '{table_type.value}' type")

        # Step 3: Analyze content
        content_scores = self._analyze_content(df)
        for table_type, score in content_scores.items():
            scores[table_type] += score * 0.4  # 40% weight for content
            if score > 0:
                reasons[table_type].append(f"Content matches '{table_type.value}' patterns")

        # Find best match
        best_type = max(scores, key=scores.get)
        best_score = scores[best_type]

        # If no clear match, default to DATA_TABLE
        if best_score < 0.3:
            best_type = TableType.DATA_TABLE
            best_score = 0.5
            reasons[best_type] = ["Default classification: standard data table"]

        # Create result
        result = ClassificationResult(
            table_type=best_type,
            confidence=min(best_score, 1.0),
            reasons=reasons[best_type],
            patterns_matched=patterns[best_type]
        )

        # Add processing recommendations
        self._add_processing_recommendations(result, df)

        # Special handling for index tables
        if best_type == TableType.INDEX_TABLE:
            result.linked_sheets = self._extract_linked_sheets(df)

        # Special handling for summary tables
        if best_type == TableType.SUMMARY_TABLE:
            result.total_rows, result.subtotal_rows = self._find_total_rows(df)

        logger.debug(
            f"Classified '{sheet_name}' as {best_type.value} "
            f"(confidence: {result.confidence:.2f})"
        )

        return result

    def _analyze_sheet_name(self, name: str) -> Dict[TableType, float]:
        """Analyze sheet name for patterns"""
        scores = {t: 0.0 for t in TableType}
        name_lower = name.lower()

        for table_type, config in self.PATTERNS.items():
            for pattern in config.get("name_patterns", []):
                if re.search(pattern, name_lower, re.IGNORECASE):
                    scores[table_type] = 1.0
                    break

        return scores

    def _analyze_structure(
        self,
        df: pd.DataFrame,
        merged_cells: Optional[List[Dict]] = None
    ) -> Dict[TableType, float]:
        """Analyze table structure"""
        scores = {t: 0.0 for t in TableType}

        if df.empty:
            return scores

        rows, cols = df.shape

        # Index table: few columns, low data density
        if cols <= 4 and rows <= 50:
            fill_rate = df.notna().sum().sum() / (rows * cols)
            if fill_rate < 0.5:
                scores[TableType.INDEX_TABLE] = 0.6

        # Summary table: many numeric columns, few rows
        numeric_cols = df.select_dtypes(include=[np.number]).columns
        if len(numeric_cols) > cols * 0.5 and rows < 30:
            scores[TableType.SUMMARY_TABLE] = 0.5

        # Detail table: many rows, ID-like first column
        if rows > 100:
            first_col = df.iloc[:, 0]
            if first_col.nunique() / len(first_col) > 0.9:
                scores[TableType.DETAIL_TABLE] = 0.5

        # Matrix/Pivot: many columns with similar headers
        if cols > 10:
            headers = [str(h) for h in df.columns]
            # Check for date-like column patterns
            date_pattern = re.compile(r'\d{4}[-/年]\d{1,2}|Q[1-4]|[一二三四]季度')
            date_headers = sum(1 for h in headers if date_pattern.search(h))
            if date_headers > cols * 0.5:
                scores[TableType.TIME_SERIES] = 0.7
                scores[TableType.MATRIX_TABLE] = 0.5

        # Metadata: few columns, key-value structure
        if cols == 2 and rows < 50:
            scores[TableType.METADATA_TABLE] = 0.6

        return scores

    def _analyze_content(self, df: pd.DataFrame) -> Dict[TableType, float]:
        """Analyze cell content for patterns"""
        scores = {t: 0.0 for t in TableType}

        if df.empty:
            return scores

        # Get all text content
        all_text = []
        for col in df.columns:
            all_text.extend(str(v).lower() for v in df[col].dropna().head(50))

        # Get first column content (often category/item names)
        first_col_text = [str(v).lower() for v in df.iloc[:, 0].dropna()]

        # Check patterns for each type
        for table_type, config in self.PATTERNS.items():
            # Check row keywords (for financial statements)
            row_keywords = config.get("row_keywords", [])
            if row_keywords:
                matches = sum(
                    1 for text in first_col_text
                    for kw in row_keywords
                    if kw.lower() in text
                )
                if matches > 3:
                    scores[table_type] = max(scores[table_type], 0.8)

            # Check header keywords
            header_keywords = config.get("header_keywords", [])
            if header_keywords:
                header_text = " ".join(str(h).lower() for h in df.columns)
                matches = sum(1 for kw in header_keywords if kw.lower() in header_text)
                if matches > 2:
                    scores[table_type] = max(scores[table_type], 0.6)

            # Check content patterns
            content_patterns = config.get("content_patterns", [])
            for pattern in content_patterns:
                if any(re.search(pattern, text, re.IGNORECASE) for text in all_text):
                    scores[table_type] = max(scores[table_type], 0.5)

        # Check for total/subtotal rows (indicator of summary)
        row_indicators = self.PATTERNS[TableType.SUMMARY_TABLE].get("row_indicators", [])
        for text in first_col_text:
            for pattern in row_indicators:
                if re.match(pattern, text, re.IGNORECASE):
                    scores[TableType.SUMMARY_TABLE] = max(
                        scores[TableType.SUMMARY_TABLE], 0.5
                    )
                    break

        return scores

    def _add_processing_recommendations(
        self,
        result: ClassificationResult,
        df: pd.DataFrame
    ):
        """Add processing recommendations based on classification"""

        if result.table_type == TableType.INDEX_TABLE:
            result.recommended_strategy = "extract_links"
            result.skip_rows = 1

        elif result.table_type == TableType.SUMMARY_TABLE:
            result.recommended_strategy = "extract_aggregates"
            result.skip_rows = 0

        elif result.table_type == TableType.DETAIL_TABLE:
            result.recommended_strategy = "standard_extraction"
            result.header_rows = 1

        elif result.table_type == TableType.PIVOT_TABLE:
            result.recommended_strategy = "unpivot"
            result.transpose = False

        elif result.table_type == TableType.TIME_SERIES:
            result.recommended_strategy = "time_series_extraction"
            result.transpose = True  # Often need to transpose

        elif result.table_type in (TableType.PROFIT_STATEMENT, TableType.BALANCE_SHEET):
            result.recommended_strategy = "financial_statement_extraction"
            result.header_rows = self._detect_header_rows(df)

        elif result.table_type == TableType.BUDGET_REPORT:
            result.recommended_strategy = "budget_extraction"
            result.header_rows = self._detect_header_rows(df)

        elif result.table_type == TableType.METADATA_TABLE:
            result.recommended_strategy = "key_value_extraction"

        else:
            result.recommended_strategy = "standard_extraction"
            result.header_rows = 1

    def _detect_header_rows(self, df: pd.DataFrame) -> int:
        """Detect number of header rows"""
        # Simple heuristic: count rows before first numeric data
        for i, row in df.iterrows():
            numeric_count = sum(
                1 for v in row
                if v is not None and self._is_numeric(str(v))
            )
            if numeric_count > len(row) * 0.3:
                return max(1, i)
        return 1

    def _is_numeric(self, value: str) -> bool:
        """Check if value is numeric"""
        try:
            cleaned = value.replace(',', '').replace('¥', '').replace('$', '').replace('%', '')
            float(cleaned)
            return True
        except (ValueError, TypeError):
            return False

    def _extract_linked_sheets(self, df: pd.DataFrame) -> List[str]:
        """Extract linked sheet names from index table"""
        linked = []

        for col in df.columns:
            for value in df[col].dropna():
                text = str(value)
                # Look for sheet references
                patterns = [
                    r"([\u4e00-\u9fa5]+表)",  # Chinese table names
                    r"Sheet\s*(\d+)",
                    r"见\s*['\"]?([^'\"]+)['\"]?",
                    r"→\s*(.+)$"
                ]
                for pattern in patterns:
                    match = re.search(pattern, text)
                    if match:
                        linked.append(match.group(1))

        return list(set(linked))

    def _find_total_rows(
        self,
        df: pd.DataFrame
    ) -> Tuple[List[int], List[int]]:
        """Find total and subtotal rows in summary table"""
        total_rows = []
        subtotal_rows = []

        total_patterns = [r"^合计$", r"^总计$", r"^总额$", r"^total$", r"^grand total$"]
        subtotal_patterns = [r"^小计", r"^subtotal$", r"^分计$"]

        first_col = df.iloc[:, 0]
        for idx, value in enumerate(first_col):
            if value is None:
                continue
            text = str(value).strip().lower()

            for pattern in total_patterns:
                if re.match(pattern, text, re.IGNORECASE):
                    total_rows.append(idx)
                    break

            for pattern in subtotal_patterns:
                if re.match(pattern, text, re.IGNORECASE):
                    subtotal_rows.append(idx)
                    break

        return total_rows, subtotal_rows

    def process_by_type(
        self,
        table_type: TableType,
        df: pd.DataFrame,
        classification: Optional[ClassificationResult] = None
    ) -> Dict[str, Any]:
        """
        Process table based on its type.

        Args:
            table_type: Classified table type
            df: DataFrame to process
            classification: Optional classification result with params

        Returns:
            Processed data appropriate for the table type
        """
        if table_type == TableType.INDEX_TABLE:
            return self._process_index_table(df, classification)
        elif table_type == TableType.SUMMARY_TABLE:
            return self._process_summary_table(df, classification)
        elif table_type == TableType.DETAIL_TABLE:
            return self._process_detail_table(df, classification)
        elif table_type == TableType.TIME_SERIES:
            return self._process_time_series(df, classification)
        elif table_type in (TableType.PROFIT_STATEMENT, TableType.BALANCE_SHEET):
            return self._process_financial_statement(df, classification)
        else:
            return self._process_standard_table(df, classification)

    def _process_index_table(
        self,
        df: pd.DataFrame,
        classification: Optional[ClassificationResult]
    ) -> Dict[str, Any]:
        """Process index/TOC table"""
        links = []

        for idx, row in df.iterrows():
            entry = {}
            for col in df.columns:
                value = row[col]
                if value is not None:
                    entry[str(col)] = str(value)

            if entry:
                links.append({
                    "row_index": idx,
                    "content": entry,
                    "target_sheet": self._extract_target_sheet(row)
                })

        return {
            "type": "index",
            "entries": links,
            "linked_sheets": classification.linked_sheets if classification else []
        }

    def _extract_target_sheet(self, row: pd.Series) -> Optional[str]:
        """Extract target sheet from row"""
        for value in row:
            if value is None:
                continue
            text = str(value)
            # Look for sheet references
            match = re.search(r"([\u4e00-\u9fa5]+表|Sheet\s*\d+)", text)
            if match:
                return match.group(1)
        return None

    def _process_summary_table(
        self,
        df: pd.DataFrame,
        classification: Optional[ClassificationResult]
    ) -> Dict[str, Any]:
        """Process summary/aggregate table"""
        result = {
            "type": "summary",
            "data": [],
            "totals": [],
            "subtotals": []
        }

        total_rows = classification.total_rows if classification else []
        subtotal_rows = classification.subtotal_rows if classification else []

        for idx, row in df.iterrows():
            row_data = {str(col): row[col] for col in df.columns}

            if idx in total_rows:
                result["totals"].append(row_data)
            elif idx in subtotal_rows:
                result["subtotals"].append(row_data)
            else:
                result["data"].append(row_data)

        return result

    def _process_detail_table(
        self,
        df: pd.DataFrame,
        classification: Optional[ClassificationResult]
    ) -> Dict[str, Any]:
        """Process detail/transaction table"""
        return {
            "type": "detail",
            "columns": df.columns.tolist(),
            "data": df.to_dict(orient="records"),
            "row_count": len(df)
        }

    def _process_time_series(
        self,
        df: pd.DataFrame,
        classification: Optional[ClassificationResult]
    ) -> Dict[str, Any]:
        """Process time series table"""
        # Optionally transpose to have time as rows
        if classification and classification.transpose:
            df = df.T

        return {
            "type": "time_series",
            "columns": df.columns.tolist(),
            "data": df.to_dict(orient="records"),
            "orientation": "transposed" if (classification and classification.transpose) else "original"
        }

    def _process_financial_statement(
        self,
        df: pd.DataFrame,
        classification: Optional[ClassificationResult]
    ) -> Dict[str, Any]:
        """Process P&L or balance sheet"""
        # Extract hierarchical structure
        items = []

        first_col = df.columns[0]
        for idx, row in df.iterrows():
            item_name = row[first_col]
            if item_name is None:
                continue

            # Detect hierarchy level based on indentation or prefixes
            level = self._detect_hierarchy_level(str(item_name))

            values = {}
            for col in df.columns[1:]:
                values[str(col)] = row[col]

            items.append({
                "name": str(item_name).strip(),
                "level": level,
                "values": values
            })

        return {
            "type": classification.table_type.value if classification else "financial_statement",
            "items": items,
            "period_columns": df.columns[1:].tolist()
        }

    def _detect_hierarchy_level(self, text: str) -> int:
        """Detect hierarchy level from item text"""
        # Chinese numeric prefixes indicate level
        if re.match(r"^[一二三四五六七八九十]+[、.]", text):
            return 1
        if re.match(r"^\d+[、.]", text):
            return 2
        if re.match(r"^[（(]\d+[)）]", text):
            return 3
        if re.match(r"^\s{2,}", text):
            return 2
        return 1

    def _process_standard_table(
        self,
        df: pd.DataFrame,
        classification: Optional[ClassificationResult]
    ) -> Dict[str, Any]:
        """Process standard data table"""
        return {
            "type": "data",
            "columns": df.columns.tolist(),
            "data": df.to_dict(orient="records"),
            "row_count": len(df),
            "column_count": len(df.columns)
        }
