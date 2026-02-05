"""
数据转换器 - 将RawExporter导出的数据转换为长表格式

流程:
1. 读取LLM结构分析结果（header_rows, data_start_row, columns）
2. 合并多行表头生成列名
3. 提取数据行，转换为长表格式
4. 提取metadata（标题、单位、备注）
"""
from __future__ import annotations

import re
import logging
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Tuple

from services.raw_exporter import RawSheetData

logger = logging.getLogger(__name__)


@dataclass
class ColumnDefinition:
    """列定义"""
    col_index: int              # 列索引 (0-based)
    col_letter: str             # 列字母 (A, B, C...)
    merged_name: str            # 合并后的列名
    original_headers: List[str] # 原始多行表头值
    role: str                   # dimension, measure, time, label
    data_type: str              # text, number, date, percentage


@dataclass
class Metadata:
    """元数据"""
    title: Optional[str] = None
    unit: Optional[str] = None
    period: Optional[str] = None
    notes: List[str] = field(default_factory=list)
    source_file: Optional[str] = None
    sheet_name: Optional[str] = None
    extra: Dict[str, Any] = field(default_factory=dict)


@dataclass
class LongTableRow:
    """长表行"""
    dimensions: Dict[str, Any]   # 维度字段 (项目, 行次等)
    period: str                  # 期间 (2025年1月, 2025年2月, 累计)
    value_type: str              # 值类型 (预算数, 实际数)
    value: Any                   # 值
    extra: Dict[str, Any] = field(default_factory=dict)


@dataclass
class TransformResult:
    """转换结果"""
    success: bool
    metadata: Metadata
    columns: List[ColumnDefinition]
    rows: List[LongTableRow]           # 长表数据
    wide_rows: List[Dict[str, Any]]    # 宽表数据（原始格式）
    row_count: int
    error: Optional[str] = None


class DataTransformer:
    """
    数据转换器

    将Excel原始数据转换为长表格式，便于：
    1. 导入数据库
    2. 生成图表
    3. 做趋势分析
    """

    def __init__(self):
        # 常见的值类型关键词
        self.value_type_keywords = {
            "预算": "预算",
            "budget": "预算",
            "计划": "预算",
            "目标": "目标",
            "target": "目标",
            "实际": "实际",
            "actual": "实际",
            "完成": "实际",
        }

        # 单位关键词
        self.unit_patterns = [
            r"单位[：:]\s*(.+)",
            r"(万元|元|千元|百万)",
        ]

    def transform(
        self,
        raw_data: RawSheetData,
        structure: Dict[str, Any]
    ) -> TransformResult:
        """
        转换数据

        Args:
            raw_data: RawExporter导出的原始数据
            structure: LLM结构分析结果
                - title_rows: [0]
                - header_rows: [2, 3]
                - data_start_row: 4
                - columns: [{letter, name, role, data_type}, ...]

        Returns:
            TransformResult
        """
        try:
            # 1. 提取metadata
            metadata = self._extract_metadata(raw_data, structure)

            # 2. 合并多行表头
            columns = self._merge_headers(raw_data, structure)

            # 3. 识别维度列和度量列
            dimension_cols, measure_cols = self._classify_columns(columns, structure)

            # 4. 提取数据行
            data_start = structure.get("data_start_row", 0)
            data_end = structure.get("data_end_row") or len(raw_data.rows)

            # 5. 转换为宽表和长表
            wide_rows = []
            long_rows = []

            for row in raw_data.rows[data_start:data_end]:
                # 跳过空行或备注行
                if self._is_metadata_row(row, columns):
                    note = self._extract_row_text(row)
                    if note:
                        metadata.notes.append(note)
                    continue

                # 构建宽表行
                wide_row = {}
                for col in columns:
                    if col.col_index < len(row.cells):
                        wide_row[col.merged_name] = row.cells[col.col_index].value
                wide_rows.append(wide_row)

                # 构建长表行（只对度量列展开）
                dimensions = {}
                for col in dimension_cols:
                    if col.col_index < len(row.cells):
                        dimensions[col.merged_name] = row.cells[col.col_index].value

                for col in measure_cols:
                    if col.col_index < len(row.cells):
                        value = row.cells[col.col_index].value
                        if value is None:
                            continue

                        # 解析期间和值类型
                        period, value_type = self._parse_measure_column(col.merged_name)

                        long_rows.append(LongTableRow(
                            dimensions=dimensions.copy(),
                            period=period,
                            value_type=value_type,
                            value=value
                        ))

            return TransformResult(
                success=True,
                metadata=metadata,
                columns=columns,
                rows=long_rows,
                wide_rows=wide_rows,
                row_count=len(wide_rows)
            )

        except Exception as e:
            logger.error(f"Transform failed: {e}", exc_info=True)
            return TransformResult(
                success=False,
                metadata=Metadata(),
                columns=[],
                rows=[],
                wide_rows=[],
                row_count=0,
                error=str(e)
            )

    def _extract_metadata(
        self,
        raw_data: RawSheetData,
        structure: Dict[str, Any]
    ) -> Metadata:
        """提取元数据"""
        metadata = Metadata(
            sheet_name=raw_data.sheet_name
        )

        title_rows = structure.get("title_rows", [])
        header_rows = structure.get("header_rows", [])
        data_start = structure.get("data_start_row", 0)

        # 扫描标题行和表头行之前的行
        scan_rows = set(title_rows)
        for i in range(min(header_rows) if header_rows else data_start):
            scan_rows.add(i)

        for row_idx in sorted(scan_rows):
            if row_idx >= len(raw_data.rows):
                continue

            row = raw_data.rows[row_idx]
            row_text = self._extract_row_text(row)

            if not row_text:
                continue

            # 检测标题
            if row_idx == 0 or (row.non_empty_count <= 2 and len(row_text) > 5):
                if not metadata.title:
                    # 排除单位信息
                    if not any(u in row_text for u in ["单位", "元"]):
                        metadata.title = row_text

            # 检测单位
            for pattern in self.unit_patterns:
                match = re.search(pattern, row_text)
                if match:
                    metadata.unit = match.group(1) if match.lastindex else match.group(0)
                    break

            # 检测期间
            period_match = re.search(r"(\d{4}年\d{1,2}月|\d{4}[-/]\d{1,2})", row_text)
            if period_match:
                metadata.period = period_match.group(1)

        # 检查最后几行是否有备注
        for row in raw_data.rows[-3:]:
            if self._is_metadata_row(row, []):
                note = self._extract_row_text(row)
                if note and len(note) > 10:
                    metadata.notes.append(note)

        return metadata

    def _merge_headers(
        self,
        raw_data: RawSheetData,
        structure: Dict[str, Any]
    ) -> List[ColumnDefinition]:
        """合并多行表头"""
        header_rows = structure.get("header_rows", [0])
        llm_columns = structure.get("columns", [])

        columns = []

        # 确定列数
        col_count = raw_data.total_cols

        for col_idx in range(col_count):
            # 收集这一列在各表头行的值
            headers = []
            for row_idx in header_rows:
                if row_idx < len(raw_data.rows):
                    row = raw_data.rows[row_idx]
                    if col_idx < len(row.cells):
                        val = row.cells[col_idx].value
                        if val is not None:
                            headers.append(str(val).strip())

            # 处理合并单元格（向上填充）
            if not headers and col_idx > 0:
                # 检查是否在合并单元格范围内
                for merged in raw_data.merged_cells:
                    if merged.start_col <= col_idx <= merged.end_col:
                        for row_idx in header_rows:
                            if merged.start_row <= row_idx <= merged.end_row:
                                if merged.value:
                                    headers.append(str(merged.value).strip())
                                    break

            # 合并表头
            merged_name = "_".join(filter(None, headers)) if headers else f"列{col_idx+1}"

            # 获取LLM识别的角色和类型
            llm_col = next((c for c in llm_columns if c.get("col_index") == col_idx), None)
            if not llm_col:
                llm_col = next((c for c in llm_columns if c.get("letter") == self._idx_to_letter(col_idx)), None)

            role = llm_col.get("role", "dimension") if llm_col else "dimension"
            data_type = llm_col.get("data_type", "text") if llm_col else "text"

            # 如果LLM给了更好的列名，优先使用
            if llm_col and llm_col.get("name"):
                llm_name = llm_col.get("name")
                # 只有当LLM名字更完整时才使用
                if len(llm_name) > len(merged_name) or "_" in llm_name:
                    merged_name = llm_name

            columns.append(ColumnDefinition(
                col_index=col_idx,
                col_letter=self._idx_to_letter(col_idx),
                merged_name=merged_name,
                original_headers=headers,
                role=role,
                data_type=data_type
            ))

        return columns

    def _classify_columns(
        self,
        columns: List[ColumnDefinition],
        structure: Dict[str, Any]
    ) -> Tuple[List[ColumnDefinition], List[ColumnDefinition]]:
        """分类维度列和度量列"""
        dimension_cols = []
        measure_cols = []

        for col in columns:
            if col.role in ("dimension", "time", "label"):
                dimension_cols.append(col)
            elif col.role == "measure":
                measure_cols.append(col)
            else:
                # 根据数据类型推断
                if col.data_type in ("number", "currency", "percentage"):
                    measure_cols.append(col)
                else:
                    dimension_cols.append(col)

        return dimension_cols, measure_cols

    def _parse_measure_column(self, col_name: str) -> Tuple[str, str]:
        """
        解析度量列名，提取期间和值类型

        例如:
            "2025年1月_预算数" → ("2025年1月", "预算数")
            "累计_实际数" → ("累计", "实际数")
            "预算数" → ("", "预算数")
        """
        # 尝试按下划线分割
        if "_" in col_name:
            parts = col_name.rsplit("_", 1)
            period = parts[0]
            value_type = parts[1] if len(parts) > 1 else "值"
            return period, value_type

        # 检测值类型关键词
        for keyword, vtype in self.value_type_keywords.items():
            if keyword in col_name.lower():
                # 移除值类型关键词，剩下的是期间
                period = col_name
                for kw in self.value_type_keywords.keys():
                    period = period.replace(kw, "").strip()
                return period or "当期", vtype

        # 无法识别，返回原名
        return "", col_name

    def _is_metadata_row(
        self,
        row,
        columns: List[ColumnDefinition]
    ) -> bool:
        """判断是否是元数据行（备注、说明等）"""
        # 如果只有1-2个非空单元格
        if row.non_empty_count <= 2:
            return True

        # 如果数值列全为空
        numeric_values = 0
        for cell in row.cells:
            if cell.value_type == "number":
                numeric_values += 1

        if numeric_values == 0 and row.non_empty_count > 0:
            # 可能是文本说明行
            text = self._extract_row_text(row)
            if text and len(text) > 20:
                return True

        return False

    def _extract_row_text(self, row) -> str:
        """提取行的文本内容"""
        texts = []
        for cell in row.cells:
            if cell.value is not None and isinstance(cell.value, str):
                texts.append(cell.value.strip())
        return " ".join(filter(None, texts))

    def _idx_to_letter(self, idx: int) -> str:
        """列索引转字母"""
        result = ""
        while idx >= 0:
            result = chr(ord('A') + idx % 26) + result
            idx = idx // 26 - 1
        return result

    def to_dict(self, result: TransformResult) -> Dict[str, Any]:
        """转换结果为字典"""
        return {
            "success": result.success,
            "error": result.error,
            "metadata": {
                "title": result.metadata.title,
                "unit": result.metadata.unit,
                "period": result.metadata.period,
                "notes": result.metadata.notes,
                "sheet_name": result.metadata.sheet_name,
            },
            "columns": [
                {
                    "index": c.col_index,
                    "letter": c.col_letter,
                    "name": c.merged_name,
                    "original_headers": c.original_headers,
                    "role": c.role,
                    "data_type": c.data_type,
                }
                for c in result.columns
            ],
            "wide_table": {
                "row_count": result.row_count,
                "rows": result.wide_rows[:10],  # 只返回前10行预览
            },
            "long_table": {
                "row_count": len(result.rows),
                "sample": [
                    {
                        "dimensions": r.dimensions,
                        "period": r.period,
                        "value_type": r.value_type,
                        "value": r.value,
                    }
                    for r in result.rows[:20]  # 只返回前20行预览
                ],
            },
        }


# 便捷函数
def transform_to_long_table(
    raw_data: RawSheetData,
    structure: Dict[str, Any]
) -> TransformResult:
    """转换为长表"""
    transformer = DataTransformer()
    return transformer.transform(raw_data, structure)
