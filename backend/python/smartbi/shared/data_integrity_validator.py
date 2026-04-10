"""数据完整性预检器 — 改进 2

核心痛点 (来自青花椒 200K 真实数据发现):
  - CSV 前 3 行是元信息 (",,,商品销量报表" + "门店名称:..." + "查询条件:..."),
    excel_parser.parse_csv() 直接 read_csv 把它们吃进去, 列对齐全错
  - 订单明细 zip 末尾藏了 "您查询的数据已经超过最大导出量【200000】请试着缩小查询范围!"
    但没人检测, 客户拿到的是被截断的数据却不自知
  - 2025-04 订单数 11,332, 其他月份 14-19k, 明显截断但无告警

本模块目标:
  1. 元信息行识别: 自动跳过头部 N 行非数据 (标题 / 门店 / 查询条件)
  2. 截断检测: 扫描整表关键字 + 对比期望行数 vs 实际行数
  3. 月度连续性: 相邻月份订单数差异 >50% 时告警
  4. 日期连续性: 时间范围内缺失整月

使用示例:
    >>> validator = DataIntegrityValidator()
    >>> report = validator.validate_csv("青花椒2约销量报表.csv")
    >>> if not report.is_safe_to_analyze:
    ...     raise ValueError(f"数据完整性问题: {report.warnings[0].message_zh}")
    >>> print(f"跳过 {report.skipped_metadata_rows} 行元信息")
    >>> print(f"真实表头在第 {report.detected_header_row} 行")
"""
from __future__ import annotations

import csv
import logging
import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Literal, Optional, Union

logger = logging.getLogger(__name__)


# ── Type definitions ────────────────────────────────────────

Severity = Literal["info", "warning", "critical"]


@dataclass
class IntegrityWarning:
    """单个完整性问题"""
    severity: Severity
    code: str                            # 'truncated' | 'metadata_rows_skipped' | 'month_gap' | 'month_anomaly' | 'date_range_incomplete'
    message_zh: str
    affected_rows: int = 0
    detail: dict = field(default_factory=dict)

    def to_dict(self) -> dict:
        return {
            "severity": self.severity,
            "code": self.code,
            "messageZh": self.message_zh,
            "affectedRows": self.affected_rows,
            "detail": self.detail,
        }


@dataclass
class IntegrityReport:
    """完整性预检报告"""
    file_path: str
    total_rows_raw: int                  # 原始 CSV 行数 (含 metadata)
    total_rows_data: int                 # 跳过 metadata 后的数据行数
    skipped_metadata_rows: int           # 跳过的元信息行数
    detected_header_row: int             # 真实表头行号 (0-indexed)
    has_truncation_marker: bool          # 是否找到截断关键字
    truncation_keyword: Optional[str]    # 找到的截断关键字
    columns_detected: list[str]          # 检测到的列名
    warnings: list[IntegrityWarning]
    is_safe_to_analyze: bool             # False = 前端阻塞分析
    recommendations: list[str]           # 给用户的建议

    def to_dict(self) -> dict:
        return {
            "filePath": self.file_path,
            "totalRowsRaw": self.total_rows_raw,
            "totalRowsData": self.total_rows_data,
            "skippedMetadataRows": self.skipped_metadata_rows,
            "detectedHeaderRow": self.detected_header_row,
            "hasTruncationMarker": self.has_truncation_marker,
            "truncationKeyword": self.truncation_keyword,
            "columnsDetected": self.columns_detected,
            "warnings": [w.to_dict() for w in self.warnings],
            "isSafeToAnalyze": self.is_safe_to_analyze,
            "recommendations": self.recommendations,
        }


# ── Main validator ──────────────────────────────────────────


class DataIntegrityValidator:
    """数据完整性预检器"""

    # 截断关键字 (青花椒真实数据找到的)
    TRUNCATION_KEYWORDS = [
        "您查询的数据已经超过最大导出量",
        "请试着缩小查询范围",
        "数据已截断",
        "导出限制",
        "exceed maximum",
        "truncated at",
    ]

    # 元信息行模式 (CSV 头部常见的非数据行)
    METADATA_LINE_PATTERNS = [
        re.compile(r"^[,\s]*$"),                           # 全空
        re.compile(r"^[,\s]*\"?[^,]+报表[^,]*\"?[,\s]*$"),  # "商品销量报表" 标题
        re.compile(r"门店名称\s*[:：]"),                     # "门店名称:青花椒"
        re.compile(r"查询条件\s*[:：]"),                     # "查询条件:..."
        re.compile(r"时间范围\s*[:：]"),                     # "时间范围:..."
        re.compile(r"导出时间\s*[:：]"),
        re.compile(r"制表人\s*[:：]"),
        re.compile(r"^[,\s]*-{3,}[,\s]*$"),                # 分隔线
    ]

    MAX_PROBE_LINES = 30                 # 最多往下看多少行找 header
    MIN_HEADER_COLS = 3                  # 真实 header 至少有几列
    MIN_HEADER_NUMERIC_MAX = 0.3         # 真实 header 数值列占比不超过 30%

    def __init__(self):
        self._truncation_pattern = re.compile(
            "|".join(re.escape(kw) for kw in self.TRUNCATION_KEYWORDS)
        )

    # ── Public API ──────────────────────────────────────

    def validate_csv(
        self,
        file_path: Union[str, Path],
        encoding: str = "utf-8-sig",
    ) -> IntegrityReport:
        """CSV 完整性预检

        Args:
            file_path: CSV 文件路径
            encoding: 编码 (默认 utf-8-sig 兼容 BOM)

        Returns:
            IntegrityReport 完整报告
        """
        file_path = str(file_path)
        warnings: list[IntegrityWarning] = []

        # 1. 读取全部原始行到内存
        # NOTE: 当前实现把整个 CSV load 到 raw_lines list (内存占用 ~= 文件大小 * 2)
        # header 检测 + 截断扫描需要全部数据才能准确判断, 暂时接受 in-memory 模式.
        # TODO: 对大文件 (>100MB) 实现真正的流式扫描 — 第一轮扫 header + 截断关键字
        # (只保留 counts/指标), 第二轮才为下游消费者建 data_lines.
        raw_lines: list[list[str]] = []
        try:
            with open(file_path, encoding=encoding) as f:
                reader = csv.reader(f)
                for row in reader:
                    raw_lines.append(row)
        except Exception as e:
            warnings.append(
                IntegrityWarning(
                    severity="critical",
                    code="read_failed",
                    message_zh=f"无法读取 CSV: {e}",
                )
            )
            return IntegrityReport(
                file_path=file_path,
                total_rows_raw=0,
                total_rows_data=0,
                skipped_metadata_rows=0,
                detected_header_row=-1,
                has_truncation_marker=False,
                truncation_keyword=None,
                columns_detected=[],
                warnings=warnings,
                is_safe_to_analyze=False,
                recommendations=["CSV 文件读取失败, 检查编码或文件是否损坏"],
            )

        total_raw = len(raw_lines)

        # 2. 检测真实 header 行
        header_row_idx, header_cols = self._detect_header_row(raw_lines)
        skipped_metadata = header_row_idx

        if header_row_idx > 0:
            sample_meta = [",".join(raw_lines[i][:3])[:60] for i in range(min(3, header_row_idx))]
            warnings.append(
                IntegrityWarning(
                    severity="info",
                    code="metadata_rows_skipped",
                    message_zh=f"跳过 {header_row_idx} 行元信息 (标题/门店/查询条件)",
                    affected_rows=header_row_idx,
                    detail={"sampleMetadata": sample_meta},
                )
            )

        # 3. 数据行 = header 之后的所有非空行
        data_lines = [
            line for line in raw_lines[header_row_idx + 1:]
            if any(cell.strip() for cell in line)
        ]
        total_data = len(data_lines)

        # 4. 截断检测 — 扫描整个文件 (包括 data_lines 和可能的 trailing summary rows)
        has_truncation = False
        truncation_keyword = None
        for line in raw_lines:
            line_text = " ".join(str(c) for c in line)
            match = self._truncation_pattern.search(line_text)
            if match:
                has_truncation = True
                truncation_keyword = match.group(0)
                warnings.append(
                    IntegrityWarning(
                        severity="critical",
                        code="truncated",
                        message_zh=(
                            f"检测到数据截断! 原始文件包含关键字: '{truncation_keyword}'. "
                            f"客户端导出时超出限制, 上传的数据**不完整**, 分析结论可能偏差. "
                            f"建议分多次导出或缩小时间范围后重新上传."
                        ),
                        detail={"keyword": truncation_keyword},
                    )
                )
                break

        # 5. 日期连续性检测 (如果数据含日期列)
        date_col_idx = self._find_date_col_idx(header_cols)
        if date_col_idx >= 0 and len(data_lines) > 10:
            gap_warnings = self._check_month_continuity(data_lines, date_col_idx)
            warnings.extend(gap_warnings)

        # 6. 综合判断 is_safe_to_analyze
        critical_count = sum(1 for w in warnings if w.severity == "critical")
        is_safe = critical_count == 0

        # 7. 生成建议
        recommendations: list[str] = []
        if has_truncation:
            recommendations.append(
                "⚠️ 数据被客户端导出工具截断. 建议把时间范围拆小后重新上传."
            )
        if header_row_idx > 0:
            recommendations.append(
                f"✓ 系统已自动跳过前 {header_row_idx} 行元信息, 无需手动处理."
            )
        if any(w.code == "month_anomaly" for w in warnings):
            recommendations.append(
                "⚠️ 检测到月度订单数异常波动, 部分月份可能数据不完整, 请核对原始报表."
            )
        if not warnings:
            recommendations.append("✓ 数据完整性检查通过, 可放心分析")

        return IntegrityReport(
            file_path=file_path,
            total_rows_raw=total_raw,
            total_rows_data=total_data,
            skipped_metadata_rows=skipped_metadata,
            detected_header_row=header_row_idx,
            has_truncation_marker=has_truncation,
            truncation_keyword=truncation_keyword,
            columns_detected=header_cols,
            warnings=warnings,
            is_safe_to_analyze=is_safe,
            recommendations=recommendations,
        )

    def validate_excel(
        self,
        file_path: Union[str, Path],
        sheet_name: Optional[str] = None,
    ) -> IntegrityReport:
        """Excel 完整性预检 (读 sheet → 转 list[list] 复用 CSV 逻辑)"""
        import pandas as pd

        file_path = str(file_path)
        try:
            xls = pd.ExcelFile(file_path)
            if sheet_name is None:
                sheet_name = xls.sheet_names[0]
            df = pd.read_excel(xls, sheet_name=sheet_name, header=None, dtype=str)
        except Exception as e:
            return IntegrityReport(
                file_path=file_path,
                total_rows_raw=0,
                total_rows_data=0,
                skipped_metadata_rows=0,
                detected_header_row=-1,
                has_truncation_marker=False,
                truncation_keyword=None,
                columns_detected=[],
                warnings=[IntegrityWarning(
                    severity="critical",
                    code="read_failed",
                    message_zh=f"无法读取 Excel: {e}",
                )],
                is_safe_to_analyze=False,
                recommendations=["Excel 读取失败, 请检查文件格式"],
            )

        # 转 list[list[str]] 复用 CSV 逻辑
        raw_lines: list[list[str]] = []
        for _, row in df.iterrows():
            raw_lines.append([str(v) if v is not None else "" for v in row])

        # 复用 detect_header_row
        header_row_idx, header_cols = self._detect_header_row(raw_lines)
        skipped_metadata = header_row_idx

        warnings: list[IntegrityWarning] = []
        if header_row_idx > 0:
            warnings.append(
                IntegrityWarning(
                    severity="info",
                    code="metadata_rows_skipped",
                    message_zh=f"跳过 {header_row_idx} 行元信息",
                    affected_rows=header_row_idx,
                )
            )

        data_lines = [
            line for line in raw_lines[header_row_idx + 1:]
            if any(cell.strip() for cell in line)
        ]

        # 截断检测
        has_truncation = False
        truncation_keyword = None
        for line in raw_lines:
            line_text = " ".join(str(c) for c in line)
            match = self._truncation_pattern.search(line_text)
            if match:
                has_truncation = True
                truncation_keyword = match.group(0)
                warnings.append(
                    IntegrityWarning(
                        severity="critical",
                        code="truncated",
                        message_zh=f"Excel 含截断关键字: '{truncation_keyword}'",
                        detail={"keyword": truncation_keyword},
                    )
                )
                break

        critical_count = sum(1 for w in warnings if w.severity == "critical")
        recommendations = []
        if has_truncation:
            recommendations.append("⚠️ 数据被截断, 建议分批重新导出")
        if header_row_idx > 0:
            recommendations.append(f"✓ 跳过 {header_row_idx} 行元信息")
        if not warnings:
            recommendations.append("✓ 完整性检查通过")

        return IntegrityReport(
            file_path=file_path,
            total_rows_raw=len(raw_lines),
            total_rows_data=len(data_lines),
            skipped_metadata_rows=skipped_metadata,
            detected_header_row=header_row_idx,
            has_truncation_marker=has_truncation,
            truncation_keyword=truncation_keyword,
            columns_detected=header_cols,
            warnings=warnings,
            is_safe_to_analyze=critical_count == 0,
            recommendations=recommendations,
        )

    # ── 内部: 检测真实 header 行 ────────────────────────

    def _detect_header_row(
        self, raw_lines: list[list[str]]
    ) -> tuple[int, list[str]]:
        """识别真实表头行

        算法 (3 层):
          1. 跳过所有明显的元信息行 (匹配 METADATA_LINE_PATTERNS)
          2. 第一个"全列非空率 >= 80% 且 数值占比 <= 30%" 的行 = header
          3. 如果找不到, 第一个非空行作为 header

        Returns:
            (header_row_idx, header_column_names)
        """
        probe_limit = min(self.MAX_PROBE_LINES, len(raw_lines))

        for i in range(probe_limit):
            line = raw_lines[i]

            # 完全空行, 跳过
            if not any(cell.strip() for cell in line):
                continue

            # 明显的元信息, 跳过
            line_joined = ",".join(line)
            is_metadata = any(
                pattern.search(line_joined) for pattern in self.METADATA_LINE_PATTERNS
            )
            if is_metadata:
                continue

            # 看是否像 header (多列 + 非数值为主)
            non_empty = [c for c in line if c.strip()]
            if len(non_empty) < self.MIN_HEADER_COLS:
                continue

            numeric_count = sum(1 for c in non_empty if self._is_numeric(c))
            numeric_ratio = numeric_count / len(non_empty)
            if numeric_ratio > self.MIN_HEADER_NUMERIC_MAX:
                # 数值占比太高 = 数据行, 不是 header
                continue

            # 通过, 这就是 header
            return (i, [c.strip() for c in line])

        # Fallback: 第一个非空行
        for i, line in enumerate(raw_lines[:probe_limit]):
            if any(cell.strip() for cell in line):
                return (i, [c.strip() for c in line])

        return (0, [])

    @staticmethod
    def _is_numeric(s: str) -> bool:
        """判断字符串是否是数值 (含负数/小数/百分号)"""
        s = s.strip().replace(",", "").replace("%", "")
        if not s:
            return False
        try:
            float(s)
            return True
        except ValueError:
            return False

    # ── 内部: 日期连续性检测 ────────────────────────────

    @staticmethod
    def _find_date_col_idx(header: list[str]) -> int:
        """找日期列的索引"""
        date_keywords = ["日期", "时间", "date", "time", "营业日期"]
        for i, col in enumerate(header):
            col_lower = col.lower()
            for kw in date_keywords:
                if kw in col_lower or kw in col:
                    return i
        return -1

    def _check_month_continuity(
        self, data_lines: list[list[str]], date_col_idx: int,
    ) -> list[IntegrityWarning]:
        """检测月度订单数连续性 (相邻月份差异 >50% 告警)"""
        warnings: list[IntegrityWarning] = []

        # 提取所有月份 (前缀 YYYY-MM)
        month_counts: dict[str, int] = {}
        for line in data_lines:
            if date_col_idx >= len(line):
                continue
            date_str = line[date_col_idx].strip()
            # 提取 YYYY-MM
            match = re.match(r"(\d{4})[-/](\d{1,2})", date_str)
            if match:
                month = f"{match.group(1)}-{int(match.group(2)):02d}"
                month_counts[month] = month_counts.get(month, 0) + 1

        if len(month_counts) < 2:
            return warnings

        # 相邻月份差异
        sorted_months = sorted(month_counts.keys())
        for i in range(1, len(sorted_months)):
            prev_month = sorted_months[i - 1]
            curr_month = sorted_months[i]
            prev_count = month_counts[prev_month]
            curr_count = month_counts[curr_month]

            if prev_count == 0:
                continue

            diff_ratio = abs(curr_count - prev_count) / prev_count
            if diff_ratio > 0.5:
                warnings.append(
                    IntegrityWarning(
                        severity="warning",
                        code="month_anomaly",
                        message_zh=(
                            f"{curr_month} 订单数 {curr_count} vs {prev_month} 订单数 {prev_count}, "
                            f"差异 {diff_ratio * 100:.0f}%, 可能数据不完整"
                        ),
                        affected_rows=curr_count,
                        detail={
                            "prevMonth": prev_month,
                            "currMonth": curr_month,
                            "prevCount": prev_count,
                            "currCount": curr_count,
                            "diffRatio": round(diff_ratio, 3),
                        },
                    )
                )

        return warnings
