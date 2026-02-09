from __future__ import annotations
"""
Fixed Executor Service

Deterministic data extraction engine that processes Excel files
based on JSON configuration from structure detection and semantic mapping.

Part of the Zero-Code SmartBI architecture.

Key principle: This engine does NOT generate code dynamically.
It uses pre-written, tested logic to process data based on configuration.
"""
import io
import logging
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Dict, List, Optional, Union

import openpyxl
import pandas as pd
import numpy as np

from services.structure_detector import StructureDetectionResult, ColumnInfo
from services.semantic_mapper import SemanticMappingResult, FieldMapping
from services.context_extractor import ContextExtractor, ContextInfo

logger = logging.getLogger(__name__)


@dataclass
class ExtractedData:
    """Result of data extraction"""
    success: bool = True
    error: Optional[str] = None

    # Extracted data
    headers: List[str] = field(default_factory=list)  # Standard field names
    original_headers: List[str] = field(default_factory=list)  # Original column names
    rows: List[Dict[str, Any]] = field(default_factory=list)  # Data rows as dicts
    row_count: int = 0
    column_count: int = 0

    # Metadata
    data_types: Dict[str, str] = field(default_factory=dict)  # column -> type
    statistics: Dict[str, Dict[str, Any]] = field(default_factory=dict)  # column -> stats

    # Context (Three-Layer Model - Layer 3)
    context: Optional[ContextInfo] = None

    # Processing info
    skipped_rows: int = 0
    processing_notes: List[str] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "success": self.success,
            "error": self.error,
            "headers": self.headers,
            "original_headers": self.original_headers,
            "rows": self.rows,
            "row_count": self.row_count,
            "column_count": self.column_count,
            "data_types": self.data_types,
            "statistics": self.statistics,
            "context": self.context.to_dict() if self.context else None,
            "skipped_rows": self.skipped_rows,
            "processing_notes": self.processing_notes
        }

    def to_dataframe(self) -> pd.DataFrame:
        """Convert to pandas DataFrame"""
        if not self.rows:
            return pd.DataFrame()
        return pd.DataFrame(self.rows)


class FixedExecutor:
    """
    Fixed data extraction engine.

    This class uses deterministic, pre-written logic to:
    1. Read data from Excel based on structure config
    2. Apply field mappings to standardize column names
    3. Clean and validate data
    4. Calculate basic statistics

    NO dynamic code generation - all logic is pre-defined and tested.
    """

    def __init__(self):
        self._value_cleaners = {
            "numeric": self._clean_numeric,
            "percentage": self._clean_percentage,
            "currency": self._clean_currency,
            "text": self._clean_text,
            "date": self._clean_date
        }
        self._context_extractor = ContextExtractor()

    def execute(
        self,
        file_bytes: bytes,
        structure_config: StructureDetectionResult,
        mapping_config: SemanticMappingResult,
        options: Optional[Dict[str, Any]] = None
    ) -> ExtractedData:
        """
        Execute data extraction based on configurations.

        Args:
            file_bytes: Raw Excel file bytes
            structure_config: Structure detection result
            mapping_config: Semantic mapping result
            options: Optional extraction options

        Returns:
            ExtractedData with standardized data
        """
        options = options or {}
        result = ExtractedData()

        try:
            # Load workbook
            wb = openpyxl.load_workbook(io.BytesIO(file_bytes), data_only=True)

            # Get target sheet
            sheet_name = structure_config.sheet_name
            if sheet_name and sheet_name in wb.sheetnames:
                ws = wb[sheet_name]
            else:
                ws = wb.active

            # Build column mapping
            column_map = self._build_column_map(structure_config, mapping_config)

            # Extract data starting from data_start_row
            data_start_row = structure_config.data_start_row + 1  # openpyxl is 1-indexed
            max_rows = options.get("max_rows", 10000)

            # Get original headers from the last header row
            header_row_num = structure_config.data_start_row  # 0-indexed, so this is the header row
            original_headers = []
            for col_idx in range(1, ws.max_column + 1):
                cell = ws.cell(row=header_row_num + 1, column=col_idx)  # +1 for openpyxl indexing
                header = str(cell.value) if cell.value else f"Column_{col_idx}"
                original_headers.append(header)

            result.original_headers = original_headers

            # Map to standard headers
            standard_headers = []
            for orig in original_headers:
                standard = column_map.get(orig, orig)
                standard_headers.append(standard)
            result.headers = standard_headers

            # Build data type map
            data_type_map = self._build_data_type_map(structure_config, mapping_config, original_headers)
            result.data_types = data_type_map

            # Extract data rows
            rows = []
            skipped = 0

            for row_idx in range(data_start_row + 1, min(data_start_row + max_rows + 1, ws.max_row + 1)):
                row_data = {}
                has_data = False

                for col_idx, (orig_header, std_header) in enumerate(zip(original_headers, standard_headers), start=1):
                    cell = ws.cell(row=row_idx, column=col_idx)
                    value = cell.value

                    if value is not None:
                        has_data = True

                    # Clean value based on data type
                    data_type = data_type_map.get(std_header, "text")
                    cleaned_value = self._clean_value(value, data_type)

                    row_data[std_header] = cleaned_value

                # Skip empty rows if configured
                if not has_data and options.get("skip_empty_rows", True):
                    skipped += 1
                    continue

                rows.append(row_data)

            result.rows = rows
            result.row_count = len(rows)
            result.column_count = len(standard_headers)
            result.skipped_rows = skipped

            # Calculate statistics
            if options.get("calculate_stats", True) and rows:
                result.statistics = self._calculate_statistics(rows, standard_headers, data_type_map)

            # Extract context (Three-Layer Model - Layer 3)
            if options.get("extract_context", True):
                data_end_row = data_start_row + len(rows)
                result.context = self._context_extractor.extract(
                    ws=ws,
                    data_end_row=data_end_row,
                    total_rows=ws.max_row or data_end_row,
                    header_rows=structure_config.header_row_count
                )

            wb.close()

            # Add processing notes
            if mapping_config.unmapped_fields:
                result.processing_notes.append(
                    f"Unmapped fields: {', '.join(mapping_config.unmapped_fields)}"
                )

            if structure_config.note:
                result.processing_notes.append(structure_config.note)

            return result

        except Exception as e:
            logger.error(f"Data extraction failed: {e}", exc_info=True)
            return ExtractedData(success=False, error=str(e))

    def execute_with_pandas(
        self,
        file_bytes: bytes,
        structure_config: StructureDetectionResult,
        mapping_config: SemanticMappingResult,
        options: Optional[Dict[str, Any]] = None
    ) -> ExtractedData:
        """
        Execute data extraction using pandas for better performance.

        Args:
            file_bytes: Raw Excel file bytes
            structure_config: Structure detection result
            mapping_config: Semantic mapping result
            options: Optional extraction options

        Returns:
            ExtractedData with standardized data
        """
        options = options or {}
        result = ExtractedData()

        try:
            header_rows = structure_config.header_row_count
            data_start_row = structure_config.data_start_row

            # 对于复杂多层表头 (>2行)，使用智能合并而不是 pandas 默认拼接
            if header_rows > 2 or structure_config.merged_cells:
                return self._execute_with_smart_header_merge(
                    file_bytes, structure_config, mapping_config, options
                )

            # 简单表头情况，使用 pandas 默认处理
            if header_rows == 2:
                header = [0, 1]
            elif header_rows == 1:
                header = 0
            else:
                header = data_start_row - 1 if data_start_row > 0 else 0

            # Read with pandas
            df = pd.read_excel(
                io.BytesIO(file_bytes),
                sheet_name=structure_config.sheet_name or 0,
                header=header,
                skiprows=options.get("skip_rows", 0)
            )

            # Flatten multi-level columns if needed
            if isinstance(df.columns, pd.MultiIndex):
                df.columns = [
                    '_'.join(str(c) for c in col if str(c) != 'nan' and str(c) != '')
                    for col in df.columns.values
                ]

            # Store original headers
            result.original_headers = df.columns.tolist()

            # Build column mapping and rename
            column_map = self._build_column_map(structure_config, mapping_config)
            renamed_columns = {orig: column_map.get(orig, orig) for orig in df.columns}
            df = df.rename(columns=renamed_columns)

            result.headers = df.columns.tolist()

            # Clean data
            data_type_map = self._build_data_type_map(structure_config, mapping_config, result.original_headers)
            result.data_types = data_type_map

            for col in df.columns:
                data_type = data_type_map.get(col, "text")
                df[col] = df[col].apply(lambda x: self._clean_value(x, data_type))

            # Remove empty rows if configured
            if options.get("skip_empty_rows", True):
                original_count = len(df)
                df = df.dropna(how='all')
                result.skipped_rows = original_count - len(df)

            # Convert to records
            df = df.replace({np.nan: None})
            result.rows = df.to_dict(orient='records')
            result.row_count = len(result.rows)
            result.column_count = len(result.headers)

            # Calculate statistics
            if options.get("calculate_stats", True) and result.rows:
                result.statistics = self._calculate_statistics(
                    result.rows, result.headers, data_type_map
                )

            # Extract context (Three-Layer Model - Layer 3)
            if options.get("extract_context", True):
                result.context = self._context_extractor.extract_from_bytes(
                    file_bytes=file_bytes,
                    sheet_index=0 if not structure_config.sheet_name else
                        self._get_sheet_index(file_bytes, structure_config.sheet_name),
                    data_end_row=structure_config.data_start_row + result.row_count
                )

            return result

        except Exception as e:
            logger.error(f"Pandas extraction failed: {e}", exc_info=True)
            return ExtractedData(success=False, error=str(e))

    def _execute_with_smart_header_merge(
        self,
        file_bytes: bytes,
        structure_config: StructureDetectionResult,
        mapping_config: SemanticMappingResult,
        options: Optional[Dict[str, Any]] = None
    ) -> ExtractedData:
        """
        使用智能表头合并处理复杂多层表头。

        处理逻辑:
        1. 用 openpyxl 读取原始数据
        2. 分析合并单元格，构建表头层级关系
        3. 智能合并表头：只保留有意义的层级（如 "1月_预算数"）
        4. 跳过标题行、单位行等非数据列名行
        """
        options = options or {}
        result = ExtractedData()

        try:
            wb = openpyxl.load_workbook(io.BytesIO(file_bytes), data_only=True)

            # 获取目标 sheet
            if structure_config.sheet_name and structure_config.sheet_name in wb.sheetnames:
                ws = wb[structure_config.sheet_name]
            else:
                ws = wb.active

            data_start_row = structure_config.data_start_row
            header_row_count = structure_config.header_row_count
            merged_cells = structure_config.merged_cells

            # 构建合并单元格映射 (用于获取合并区域的值)
            merge_map = self._build_merge_map(ws, merged_cells, header_row_count)

            # 智能合并表头（返回表头和实际数据开始行）
            merged_headers, actual_data_start = self._smart_merge_headers(
                ws, header_row_count, data_start_row, merge_map
            )

            result.original_headers = merged_headers
            logger.info(f"智能合并后的表头: {merged_headers[:5]}...")
            logger.info(f"数据从第 {actual_data_start} 行开始 (1-indexed)")

            # 读取数据行 (actual_data_start 已经是 1-indexed)
            max_rows = options.get("max_rows", 10000)
            rows = []
            skipped = 0

            for row_idx in range(actual_data_start, min(actual_data_start + max_rows, ws.max_row + 1)):
                row_data = {}
                has_data = False

                for col_idx, header in enumerate(merged_headers, start=1):
                    cell = ws.cell(row=row_idx, column=col_idx)
                    value = cell.value

                    if value is not None:
                        has_data = True

                    row_data[header] = value

                if not has_data and options.get("skip_empty_rows", True):
                    skipped += 1
                    continue

                rows.append(row_data)

            wb.close()

            # 应用字段映射
            column_map = self._build_column_map(structure_config, mapping_config)
            mapped_rows = []
            mapped_headers = []

            for orig_header in merged_headers:
                mapped = column_map.get(orig_header, orig_header)
                mapped_headers.append(mapped)

            for row in rows:
                mapped_row = {}
                for orig_header in merged_headers:
                    mapped_header = column_map.get(orig_header, orig_header)
                    value = row.get(orig_header)
                    # 清理数据
                    data_type = "numeric" if self._looks_numeric(value) else "text"
                    mapped_row[mapped_header] = self._clean_value(value, data_type)
                mapped_rows.append(mapped_row)

            result.headers = mapped_headers
            result.rows = mapped_rows
            result.row_count = len(mapped_rows)
            result.column_count = len(mapped_headers)
            result.skipped_rows = skipped
            result.processing_notes.append(
                f"智能表头合并: 原始表头行数={header_row_count}, 实际数据起始行={actual_data_start}"
            )

            # 计算统计
            if options.get("calculate_stats", True) and result.rows:
                data_type_map = {h: "numeric" for h in mapped_headers}
                result.statistics = self._calculate_statistics(
                    result.rows, result.headers, data_type_map
                )

            # Extract context (Three-Layer Model - Layer 3)
            if options.get("extract_context", True):
                data_end_row = actual_data_start + len(mapped_rows) - 1
                result.context = self._context_extractor.extract(
                    ws=ws,
                    data_end_row=data_end_row,
                    total_rows=ws.max_row or data_end_row,
                    header_rows=header_row_count
                )

            return result

        except Exception as e:
            logger.error(f"Smart header merge extraction failed: {e}", exc_info=True)
            return ExtractedData(success=False, error=str(e))

    def _build_merge_map(
        self,
        ws,
        merged_cells: List,
        max_row: int
    ) -> Dict[tuple, str]:
        """
        构建合并单元格映射。

        返回: {(row, col): merged_value} 的字典
        """
        merge_map = {}

        for merge_info in merged_cells:
            # 获取合并区域的值（左上角单元格的值）
            min_row = merge_info.min_row
            max_row_merge = merge_info.max_row
            min_col = merge_info.min_col
            max_col = merge_info.max_col

            cell_value = ws.cell(row=min_row, column=min_col).value
            value_str = str(cell_value) if cell_value else ""

            # 将合并区域内所有单元格都映射到这个值
            for r in range(min_row, max_row_merge + 1):
                for c in range(min_col, max_col + 1):
                    merge_map[(r, c)] = value_str

        return merge_map

    def _smart_merge_headers(
        self,
        ws,
        header_row_count: int,
        data_start_row: int,
        merge_map: Dict[tuple, str]
    ) -> tuple:
        """
        智能合并多层表头。

        策略:
        1. 跳过标题行（通常是第1行，跨全宽的合并单元格）
        2. 跳过单位行（包含"单位"字样）
        3. 跳过数据行（数字占比 > 30%，且有足够数据）
        4. 合并有意义的层级（如 "1月" + "预算数" -> "1月_预算数"）
        5. 避免重复（如果子列名已经包含父列名的信息）

        返回:
            tuple: (merged_headers, actual_data_start_row)
        """
        max_col = ws.max_column or 1
        merged_headers = []

        # 识别哪些行是"有意义的表头行"（排除标题行、单位行、数据行）
        meaningful_rows = []
        actual_data_start = None  # 跟踪实际数据开始行（1-indexed）

        # 检查结构检测器给的表头范围内
        for row_idx in range(1, header_row_count + 1):
            row_values = []
            numeric_count = 0
            total_count = 0

            for col_idx in range(1, max_col + 1):
                # 优先使用合并单元格的值
                if (row_idx, col_idx) in merge_map:
                    val = merge_map[(row_idx, col_idx)]
                else:
                    cell = ws.cell(row=row_idx, column=col_idx)
                    val = str(cell.value) if cell.value else ""

                row_values.append(val)

                # 统计数字比例
                if val and val.strip():
                    total_count += 1
                    try:
                        float(val.replace(',', '').replace('¥', '').replace('%', ''))
                        numeric_count += 1
                    except ValueError:
                        pass

            # 判断是否是标题行
            non_empty = [v for v in row_values if v and v.strip()]
            unique_values = set(non_empty)

            # 标题行特征：
            # 1. 唯一值很少 (<=2) - 表示可能是合并单元格
            # 2. 或者非空值很少 (<=3) 且包含关键词
            # 3. 包含中文报表关键词
            TITLE_KEYWORDS = ["利润表", "资产负债表", "现金流量表", "报表", "汇总表", "明细表", "统计表"]
            has_title_keyword = any(kw in v for v in non_empty for kw in TITLE_KEYWORDS)
            # 如果只有1-2个唯一值，很可能是标题行（合并单元格）
            # Title row if: few unique values AND (contains keyword OR very few non-empty)
            is_title_row = len(unique_values) <= 2 and (has_title_keyword or len(non_empty) <= 3)

            # Debug logging (temporary, use INFO to see in logs)
            if row_idx <= 5:
                logger.info(f"Row {row_idx} CHECK: unique={len(unique_values)}, has_keyword={has_title_keyword}, non_empty={len(non_empty)}, is_title={is_title_row}, first='{non_empty[0][:30] if non_empty else ''}'...")

            is_unit_row = any("单位" in v or "编制" in v or "Unit" in v.lower() for v in non_empty)
            # Date row: few non-empty values with datetime pattern
            is_date_row = len(unique_values) <= 3 and any("00:00:00" in v or (len(v) == 10 and "-" in v) for v in non_empty)

            # 判断是否是数据行（数字占比 > 30%，且有足够多的非空值）
            numeric_ratio = numeric_count / total_count if total_count > 0 else 0
            # 数据行特征：数字比例高，且第一列通常是文本（项目名）
            first_cell = row_values[0] if row_values else ""
            first_is_category = first_cell and not self._looks_numeric(first_cell) and len(first_cell) > 1
            is_data_row = numeric_ratio > 0.3 and total_count > 5 and first_is_category

            if is_data_row:
                # 这是数据行，不是表头！更新实际数据开始行
                if actual_data_start is None:
                    actual_data_start = row_idx
                logger.info(f"Row {row_idx} detected as DATA row (numeric_ratio={numeric_ratio:.2f}, first_cell='{first_cell[:20]}...')")
                continue

            if is_title_row:
                logger.info(f"Row {row_idx} is TITLE row (non_empty={len(non_empty)}, unique={len(unique_values)}), skipping: '{non_empty[0][:30] if non_empty else ''}'")
                continue

            if is_unit_row:
                logger.info(f"Row {row_idx} is UNIT row, skipping")
                continue

            if is_date_row:
                logger.info(f"Row {row_idx} is DATE row (non_empty={len(non_empty)}), skipping")
                continue

            meaningful_rows.append((row_idx, row_values))
            logger.info(f"Row {row_idx} is MEANINGFUL header row (non_empty={len(non_empty)}, unique={len(unique_values)})")

        # 如果检测到数据行在表头范围内，使用检测到的实际数据开始行
        # 否则使用结构检测器提供的 data_start_row
        if actual_data_start is None:
            actual_data_start = data_start_row + 1  # 转为 1-indexed

        logger.info(f"Actual data start row (1-indexed): {actual_data_start}")

        # 如果没有有意义的行，使用实际数据行之前的最后一行
        if not meaningful_rows:
            row_idx = actual_data_start - 1
            if row_idx < 1:
                row_idx = 1
            row_values = []
            for col_idx in range(1, max_col + 1):
                if (row_idx, col_idx) in merge_map:
                    row_values.append(merge_map[(row_idx, col_idx)])
                else:
                    cell = ws.cell(row=row_idx, column=col_idx)
                    row_values.append(str(cell.value) if cell.value else "")
            meaningful_rows = [(row_idx, row_values)]
            logger.info(f"No meaningful header rows found, using row {row_idx} as header")

        # 合并有意义的行
        for col_idx in range(max_col):
            parts = []
            seen_parts = set()

            for row_idx, row_values in meaningful_rows:
                if col_idx < len(row_values):
                    value = row_values[col_idx].strip()
                    if value and value not in seen_parts:
                        # 避免添加纯数字（可能是数据值泄漏）
                        try:
                            float(value.replace(',', ''))
                            # 是数字，跳过
                            continue
                        except ValueError:
                            pass

                        # 避免添加日期时间戳
                        if "00:00:00" in value:
                            # 提取日期部分
                            value = value.split(" ")[0] if " " in value else value

                        parts.append(value)
                        seen_parts.add(value)

            # 生成最终列名
            if parts:
                # 如果最后一部分已经包含前面部分的信息，只用最后一部分
                final_name = "_".join(parts) if len(parts) <= 2 else parts[-1]
            else:
                final_name = f"Column_{col_idx + 1}"

            merged_headers.append(final_name)

        return merged_headers, actual_data_start

    def _looks_numeric(self, value: Any) -> bool:
        """判断值是否看起来像数字"""
        if value is None:
            return False
        if isinstance(value, (int, float)):
            return True
        try:
            float(str(value).replace(',', '').replace('¥', '').replace('%', ''))
            return True
        except (ValueError, TypeError):
            return False

    def _build_column_map(
        self,
        structure_config: StructureDetectionResult,
        mapping_config: SemanticMappingResult
    ) -> Dict[str, str]:
        """Build original -> standard column name mapping"""
        column_map = {}

        for fm in mapping_config.field_mappings:
            if fm.standard:
                column_map[fm.original] = fm.standard
            else:
                # Keep original name if no mapping
                column_map[fm.original] = fm.original

        return column_map

    def _build_data_type_map(
        self,
        structure_config: StructureDetectionResult,
        mapping_config: SemanticMappingResult,
        original_headers: List[str]
    ) -> Dict[str, str]:
        """Build column -> data type mapping"""
        type_map = {}

        # From structure detection
        for col_info in structure_config.columns:
            standard_name = None
            for fm in mapping_config.field_mappings:
                if fm.original == col_info.name:
                    standard_name = fm.standard or fm.original
                    break
            if standard_name:
                type_map[standard_name] = col_info.data_type

        # From semantic mapping (field categories)
        for fm in mapping_config.field_mappings:
            name = fm.standard or fm.original
            if name not in type_map and fm.category:
                # Map category to data type
                category_to_type = {
                    "amount": "numeric",
                    "rate": "percentage",
                    "category": "text",
                    "time": "date"
                }
                type_map[name] = category_to_type.get(fm.category, "text")

        return type_map

    def _clean_value(self, value: Any, data_type: str) -> Any:
        """Clean value based on data type"""
        if value is None:
            return None

        cleaner = self._value_cleaners.get(data_type, self._clean_text)
        try:
            return cleaner(value)
        except Exception:
            return value

    def _clean_numeric(self, value: Any) -> Optional[float]:
        """Clean numeric value"""
        if value is None:
            return None

        if isinstance(value, (int, float)):
            return float(value)

        # String cleaning
        s = str(value).strip()
        if not s or s.lower() in ('nan', 'none', '-', '—', 'n/a'):
            return None

        # Remove formatting
        s = s.replace(',', '').replace(' ', '')
        s = s.replace('¥', '').replace('$', '').replace('€', '').replace('£', '')

        # Handle parentheses for negative
        if s.startswith('(') and s.endswith(')'):
            s = '-' + s[1:-1]

        try:
            return float(s)
        except ValueError:
            return None

    def _clean_percentage(self, value: Any) -> Optional[float]:
        """Clean percentage value (returns decimal, e.g., 0.5 for 50%)"""
        if value is None:
            return None

        if isinstance(value, (int, float)):
            # Already decimal
            if -1 <= value <= 1:
                return float(value)
            # Likely already percentage (e.g., 50 for 50%)
            return float(value) / 100

        s = str(value).strip()
        if not s or s.lower() in ('nan', 'none', '-', '—', 'n/a'):
            return None

        # Remove % sign
        s = s.replace('%', '').replace(',', '').strip()

        try:
            num = float(s)
            # If value > 1 or < -1, assume it's percentage points
            if num > 1 or num < -1:
                return num / 100
            return num
        except ValueError:
            return None

    def _clean_currency(self, value: Any) -> Optional[float]:
        """Clean currency value"""
        # Same as numeric but preserves sign
        return self._clean_numeric(value)

    def _clean_text(self, value: Any) -> Optional[str]:
        """Clean text value"""
        if value is None:
            return None

        s = str(value).strip()
        if not s or s.lower() in ('nan', 'none'):
            return None

        return s

    def _clean_date(self, value: Any) -> Optional[str]:
        """Clean date value (returns ISO format string)"""
        if value is None:
            return None

        if isinstance(value, datetime):
            return value.isoformat()

        if isinstance(value, (int, float)):
            # Excel serial date
            try:
                from openpyxl.utils.datetime import from_excel
                return from_excel(value).isoformat()
            except Exception:
                pass

        s = str(value).strip()
        if not s or s.lower() in ('nan', 'none', '-', '—'):
            return None

        # Try common date formats
        formats = [
            '%Y-%m-%d', '%Y/%m/%d', '%Y.%m.%d',
            '%d-%m-%Y', '%d/%m/%Y',
            '%Y年%m月%d日', '%Y年%m月',
            '%m/%d/%Y', '%m-%d-%Y'
        ]

        for fmt in formats:
            try:
                return datetime.strptime(s, fmt).isoformat()
            except ValueError:
                continue

        return s

    def _calculate_statistics(
        self,
        rows: List[Dict[str, Any]],
        headers: List[str],
        data_type_map: Dict[str, str]
    ) -> Dict[str, Dict[str, Any]]:
        """Calculate statistics for each column"""
        stats = {}

        for header in headers:
            values = [row.get(header) for row in rows]
            non_null = [v for v in values if v is not None]

            col_stats = {
                "count": len(non_null),
                "null_count": len(values) - len(non_null),
                "null_ratio": (len(values) - len(non_null)) / len(values) if values else 0
            }

            data_type = data_type_map.get(header, "text")

            if data_type in ("numeric", "percentage", "currency"):
                numeric_values = [v for v in non_null if isinstance(v, (int, float))]
                if numeric_values:
                    col_stats.update({
                        "min": min(numeric_values),
                        "max": max(numeric_values),
                        "sum": sum(numeric_values),
                        "mean": sum(numeric_values) / len(numeric_values),
                        "numeric_count": len(numeric_values)
                    })

            elif data_type == "text":
                if non_null:
                    unique_values = set(str(v) for v in non_null)
                    col_stats.update({
                        "unique_count": len(unique_values),
                        "unique_ratio": len(unique_values) / len(non_null)
                    })

            stats[header] = col_stats

        return stats

    def _get_sheet_index(self, file_bytes: bytes, sheet_name: str) -> int:
        """Get sheet index by name"""
        try:
            wb = openpyxl.load_workbook(io.BytesIO(file_bytes), read_only=True)
            if sheet_name in wb.sheetnames:
                return wb.sheetnames.index(sheet_name)
            wb.close()
        except Exception:
            pass
        return 0


class DataTransformer:
    """
    Additional data transformation utilities.

    Pre-defined transformations that can be applied to extracted data.
    """

    @staticmethod
    def pivot_time_series(
        data: ExtractedData,
        category_column: str,
        time_columns: List[str],
        value_type: str = "actual"
    ) -> pd.DataFrame:
        """
        Pivot time series data from wide to long format.

        Args:
            data: Extracted data
            category_column: Column containing category names
            time_columns: Columns containing time-series values
            value_type: Name for the value column

        Returns:
            Long-format DataFrame
        """
        df = data.to_dataframe()

        if category_column not in df.columns:
            raise ValueError(f"Category column '{category_column}' not found")

        # Melt the dataframe
        id_vars = [col for col in df.columns if col not in time_columns]
        melted = df.melt(
            id_vars=id_vars,
            value_vars=time_columns,
            var_name='period',
            value_name=value_type
        )

        return melted

    @staticmethod
    def aggregate_by_category(
        data: ExtractedData,
        category_column: str,
        value_columns: List[str],
        agg_func: str = "sum"
    ) -> pd.DataFrame:
        """
        Aggregate data by category.

        Args:
            data: Extracted data
            category_column: Column to group by
            value_columns: Columns to aggregate
            agg_func: Aggregation function (sum, mean, count, etc.)

        Returns:
            Aggregated DataFrame
        """
        df = data.to_dataframe()

        if category_column not in df.columns:
            raise ValueError(f"Category column '{category_column}' not found")

        agg_dict = {col: agg_func for col in value_columns if col in df.columns}
        return df.groupby(category_column).agg(agg_dict).reset_index()

    @staticmethod
    def calculate_derived_columns(
        data: ExtractedData,
        calculations: List[Dict[str, Any]]
    ) -> ExtractedData:
        """
        Calculate derived columns based on predefined formulas.

        Args:
            data: Extracted data
            calculations: List of calculation specs:
                [{"name": "variance", "formula": "budget_amount - actual_amount"}]

        Returns:
            ExtractedData with new columns
        """
        df = data.to_dataframe()

        for calc in calculations:
            name = calc.get("name")
            formula = calc.get("formula")

            if not name or not formula:
                continue

            # Supported operations: +, -, *, /, ()
            try:
                # Safe evaluation with only numeric operations
                df[name] = df.eval(formula)
            except Exception as e:
                logger.warning(f"Failed to calculate '{name}': {e}")

        # Update result
        data.rows = df.to_dict(orient='records')
        data.headers = df.columns.tolist()
        data.column_count = len(data.headers)

        return data
