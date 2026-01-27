"""
Excel 解析服务

智能处理各种 Excel 格式：
- 单层表头
- 多层表头（自动检测和合并）
- 宽表转长表（melt）
- 数据类型自动推断
- 字段映射到标准字段
"""

import pandas as pd
import numpy as np
from io import BytesIO
from typing import Dict, List, Any, Optional, Tuple
import re
from datetime import datetime
import logging

logger = logging.getLogger(__name__)


class ExcelParserService:
    """Excel 解析服务"""

    # 字段映射字典（同义词 -> 标准字段）
    FIELD_SYNONYMS = {
        # 区域/地区
        "region": ["区域", "大区", "销售区域", "地区", "片区", "分部", "area", "region"],
        # 日期/期间
        "period": ["期间", "月份", "日期", "时间", "月", "year_month", "period", "date"],
        # 预算
        "budget_amount": ["预算", "预算金额", "预算额", "预算数", "budget", "budget_amount"],
        # 实际
        "actual_amount": ["实际", "实际金额", "实际额", "实际数", "actual", "actual_amount", "实际金额"],
        # 同期
        "yoy_amount": ["同期", "去年同期", "上年同期", "24年同期实际", "yoy", "prior_year"],
        # 销售额
        "sales_amount": ["销售额", "销售金额", "营收", "收入", "金额", "sales", "amount", "revenue"],
        # 成本
        "cost": ["成本", "成本金额", "总成本", "cost", "total_cost"],
        # 数量
        "quantity": ["数量", "销量", "件数", "qty", "quantity", "count"],
        # 产品
        "product_name": ["产品", "商品", "品名", "product", "item"],
        # 客户
        "customer_name": ["客户", "客户名称", "customer", "client"],
        # 部门
        "department": ["部门", "团队", "dept", "department", "team"],
        # 销售员
        "salesperson_name": ["销售员", "业务员", "姓名", "salesperson", "sales_rep"],
    }

    # 数据类型检测关键词
    FINANCE_KEYWORDS = ["预算", "实际", "成本", "费用", "应收", "应付", "利润", "budget", "actual", "cost"]
    SALES_KEYWORDS = ["销售", "订单", "客户", "产品", "数量", "金额", "sales", "order", "customer", "product"]

    def __init__(self):
        # 构建反向索引：同义词 -> 标准字段
        self.synonym_index = {}
        for std_field, synonyms in self.FIELD_SYNONYMS.items():
            for syn in synonyms:
                self.synonym_index[syn.lower()] = std_field

    def parse(
        self,
        file_content: bytes,
        filename: str,
        sheet_index: int = 0,
        data_type: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        解析 Excel 文件

        Args:
            file_content: 文件内容
            filename: 文件名
            sheet_index: 工作表索引
            data_type: 数据类型 (FINANCE/SALES/AUTO)

        Returns:
            标准化的解析结果
        """
        try:
            # 1. 读取 Excel，检测表头结构
            df, header_info = self._read_excel_smart(file_content, sheet_index)

            logger.info(f"读取完成: {len(df)} 行, {len(df.columns)} 列, 多层表头: {header_info['is_multi_header']}")

            # 2. 如果是多层表头的宽表，转换为长表
            if header_info['is_multi_header'] and header_info['needs_melt']:
                df = self._melt_wide_to_long(df, header_info)
                logger.info(f"宽表转长表完成: {len(df)} 行")

            # 3. 自动检测数据类型
            if data_type is None or data_type == "AUTO":
                data_type = self._detect_data_type(df)
                logger.info(f"自动检测数据类型: {data_type}")

            # 4. 字段映射
            field_mappings = self._map_fields(df.columns.tolist())

            # 5. 转换为标准化行数据
            rows = self._convert_to_rows(df, field_mappings)

            # 6. 提取唯一值（用于前端筛选）
            unique_values = self._extract_unique_values(df, field_mappings)

            return {
                "dataType": data_type,
                "headers": df.columns.tolist(),
                "rows": rows,
                "rowCount": len(rows),
                "columnCount": len(df.columns),
                "fieldMappings": field_mappings,
                "uniqueValues": unique_values,
                "metadata": {
                    "filename": filename,
                    "sheetIndex": sheet_index,
                    "isMultiHeader": header_info['is_multi_header'],
                    "headerRowCount": header_info.get('header_row_count', 1),
                    "parsedAt": datetime.now().isoformat()
                }
            }

        except Exception as e:
            logger.error(f"解析 Excel 失败: {str(e)}", exc_info=True)
            raise

    def preview(
        self,
        file_content: bytes,
        filename: str,
        sheet_index: int = 0,
        max_rows: int = 10
    ) -> Dict[str, Any]:
        """预览 Excel（返回前 N 行）"""
        result = self.parse(file_content, filename, sheet_index)
        result['rows'] = result['rows'][:max_rows]
        result['isPreview'] = True
        return result

    def get_sheet_names(self, file_content: bytes) -> List[Dict[str, Any]]:
        """获取所有工作表名称"""
        xls = pd.ExcelFile(BytesIO(file_content))
        sheets = []
        for i, name in enumerate(xls.sheet_names):
            df = pd.read_excel(xls, sheet_name=i, nrows=5)
            sheets.append({
                "index": i,
                "name": name,
                "rowCount": len(df),
                "columnCount": len(df.columns)
            })
        return sheets

    def _read_excel_smart(
        self,
        file_content: bytes,
        sheet_index: int
    ) -> Tuple[pd.DataFrame, Dict[str, Any]]:
        """
        智能读取 Excel，自动检测多层表头

        Returns:
            (DataFrame, 表头信息)
        """
        file_io = BytesIO(file_content)

        # 先尝试读取前几行来检测表头结构
        preview_df = pd.read_excel(file_io, sheet_name=sheet_index, header=None, nrows=5)

        # 检测是否是多层表头
        is_multi_header, header_row_count = self._detect_multi_header(preview_df)

        file_io.seek(0)  # 重置文件指针

        if is_multi_header and header_row_count > 1:
            # 多层表头：使用多行作为 header
            header_rows = list(range(header_row_count))
            df = pd.read_excel(file_io, sheet_name=sheet_index, header=header_rows)

            # 合并多层列名
            df.columns = self._merge_multi_header(df.columns)

            return df, {
                "is_multi_header": True,
                "header_row_count": header_row_count,
                "needs_melt": self._check_needs_melt(df)
            }
        else:
            # 单层表头
            df = pd.read_excel(file_io, sheet_name=sheet_index)
            return df, {
                "is_multi_header": False,
                "header_row_count": 1,
                "needs_melt": False
            }

    def _detect_multi_header(self, preview_df: pd.DataFrame) -> Tuple[bool, int]:
        """
        检测是否是多层表头

        判断逻辑：
        1. 第一行有合并单元格（大量 NaN 后跟相同值）
        2. 第一行包含时间模式（1月, 2月, Q1 等）
        3. 第二行包含重复的子类别（预算, 实际 等）

        Returns:
            (是否多层表头, 表头行数)
        """
        if len(preview_df) < 2:
            return False, 1

        row0 = preview_df.iloc[0].astype(str)
        row1 = preview_df.iloc[1].astype(str) if len(preview_df) > 1 else None

        # 检测时间模式（月份、季度等）
        time_patterns = [
            r'\d+月',  # 1月, 2月
            r'[一二三四五六七八九十]+月',  # 一月, 二月
            r'Q[1-4]',  # Q1, Q2
            r'\d{4}[-/]\d{2}',  # 2025-01, 2025/01
            r'第[一二三四]季度',  # 第一季度
        ]

        # 检查第一行是否有时间模式
        has_time_pattern = False
        for val in row0:
            for pattern in time_patterns:
                if re.search(pattern, str(val)):
                    has_time_pattern = True
                    break

        # 检查第一行是否有大量重复值或 NaN
        non_nan_values = [v for v in row0 if str(v) != 'nan' and str(v) != 'None']
        unique_ratio = len(set(non_nan_values)) / max(len(non_nan_values), 1)

        # 检查第二行是否有重复的子类别
        has_repeated_subcategory = False
        if row1 is not None:
            non_nan_row1 = [v for v in row1 if str(v) != 'nan' and str(v) != 'None']
            if len(non_nan_row1) > len(set(non_nan_row1)):
                has_repeated_subcategory = True

        # 综合判断
        if has_time_pattern and has_repeated_subcategory:
            return True, 2
        if unique_ratio < 0.3 and has_repeated_subcategory:  # 第一行很多合并单元格
            return True, 2

        return False, 1

    def _merge_multi_header(self, multi_columns: pd.MultiIndex) -> List[str]:
        """
        合并多层表头为单层

        例如：
        ('1月', '预算金额') -> '1月_预算金额'
        ('Unnamed: 0', '区域') -> '区域'
        """
        merged = []
        for col in multi_columns:
            if isinstance(col, tuple):
                # 过滤掉 Unnamed 和 nan
                parts = []
                for part in col:
                    part_str = str(part)
                    if not part_str.startswith('Unnamed') and part_str != 'nan':
                        parts.append(part_str)
                merged.append('_'.join(parts) if parts else f"col_{len(merged)}")
            else:
                merged.append(str(col))
        return merged

    def _check_needs_melt(self, df: pd.DataFrame) -> bool:
        """
        检查是否需要将宽表转换为长表

        判断逻辑：
        - 列名包含时间模式
        - 多个列名有相同的后缀（预算, 实际等）
        """
        cols = df.columns.tolist()

        # 检查是否有重复的后缀模式
        suffixes = []
        for col in cols:
            if '_' in col:
                suffix = col.split('_')[-1]
                suffixes.append(suffix)

        if len(suffixes) > 3:
            # 如果有重复的后缀（如多个_预算金额, _实际金额）
            suffix_counts = pd.Series(suffixes).value_counts()
            if suffix_counts.max() > 2:
                return True

        return False

    def _melt_wide_to_long(
        self,
        df: pd.DataFrame,
        header_info: Dict[str, Any]
    ) -> pd.DataFrame:
        """
        将宽表转换为长表

        例如：
        | 区域 | 1月_预算 | 1月_实际 | 2月_预算 | 2月_实际 |
        转换为：
        | 区域 | 期间 | 预算 | 实际 |
        """
        # 找出维度列（不包含时间模式的列）
        id_cols = []
        value_cols = []

        for col in df.columns:
            col_str = str(col)
            # 检测是否包含时间模式
            if re.search(r'\d+月|Q[1-4]|\d{4}[-/]\d{2}', col_str):
                value_cols.append(col)
            elif '_' in col_str and any(kw in col_str for kw in ['预算', '实际', '同期', 'budget', 'actual']):
                value_cols.append(col)
            else:
                id_cols.append(col)

        if not id_cols:
            # 第一列作为 ID 列
            id_cols = [df.columns[0]]
            value_cols = df.columns[1:].tolist()

        logger.info(f"维度列: {id_cols}, 值列数: {len(value_cols)}")

        # melt 转换
        melted = df.melt(id_vars=id_cols, var_name='period_metric', value_name='value')

        # 解析 period 和 metric
        def parse_period_metric(pm):
            """解析 '1月_预算金额' 为 ('2025-01', '预算金额')"""
            parts = str(pm).split('_')
            if len(parts) >= 2:
                period_part = parts[0]
                metric_part = '_'.join(parts[1:])

                # 转换月份为标准格式
                month_match = re.search(r'(\d+)月', period_part)
                if month_match:
                    month = int(month_match.group(1))
                    period_part = f"2025-{month:02d}"

                return pd.Series([period_part, metric_part])
            return pd.Series([pm, 'value'])

        melted[['period', 'metric']] = melted['period_metric'].apply(parse_period_metric)

        # pivot 将 metric 展开为列
        try:
            result = melted.pivot_table(
                index=id_cols + ['period'],
                columns='metric',
                values='value',
                aggfunc='first'
            ).reset_index()

            # 清理列名
            result.columns.name = None
            return result
        except Exception as e:
            logger.warning(f"Pivot 失败，返回 melt 结果: {e}")
            return melted

    def _detect_data_type(self, df: pd.DataFrame) -> str:
        """自动检测数据类型"""
        cols_str = ' '.join(df.columns.astype(str)).lower()

        finance_score = sum(1 for kw in self.FINANCE_KEYWORDS if kw.lower() in cols_str)
        sales_score = sum(1 for kw in self.SALES_KEYWORDS if kw.lower() in cols_str)

        if finance_score > sales_score:
            return "FINANCE"
        elif sales_score > finance_score:
            return "SALES"
        else:
            return "GENERAL"

    def _map_fields(self, columns: List[str]) -> List[Dict[str, Any]]:
        """将列名映射到标准字段"""
        mappings = []

        for i, col in enumerate(columns):
            col_lower = str(col).lower()
            std_field = None
            confidence = 0

            # 精确匹配
            if col_lower in self.synonym_index:
                std_field = self.synonym_index[col_lower]
                confidence = 100
            else:
                # 部分匹配
                for syn, field in self.synonym_index.items():
                    if syn in col_lower or col_lower in syn:
                        std_field = field
                        confidence = 70
                        break

            mappings.append({
                "columnIndex": i,
                "originalColumn": col,
                "standardField": std_field,
                "confidence": confidence,
                "dataType": self._infer_data_type(col)
            })

        return mappings

    def _infer_data_type(self, column_name: str) -> str:
        """推断列的数据类型"""
        col = str(column_name).lower()

        if any(kw in col for kw in ['日期', '时间', 'date', 'time', '期间', 'period']):
            return "DATE"
        elif any(kw in col for kw in ['金额', '成本', '预算', '实际', '收入', '利润', 'amount', 'cost', 'budget']):
            return "AMOUNT"
        elif any(kw in col for kw in ['数量', '件数', '个数', 'qty', 'quantity', 'count']):
            return "QUANTITY"
        elif any(kw in col for kw in ['率', '比例', 'rate', 'ratio', '%']):
            return "PERCENTAGE"
        elif any(kw in col for kw in ['区域', '部门', '类别', '分类', 'region', 'department', 'category']):
            return "CATEGORICAL"
        else:
            return "STRING"

    def _convert_to_rows(
        self,
        df: pd.DataFrame,
        field_mappings: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """将 DataFrame 转换为行字典列表"""
        # 构建列名到标准字段的映射
        col_to_std = {}
        for mapping in field_mappings:
            if mapping['standardField']:
                col_to_std[mapping['originalColumn']] = mapping['standardField']

        rows = []
        for _, row in df.iterrows():
            row_dict = {}
            for col in df.columns:
                value = row[col]

                # 处理 NaN
                if pd.isna(value):
                    value = None
                elif isinstance(value, (np.integer, np.floating)):
                    value = float(value)

                # 使用标准字段名（如果有映射）
                key = col_to_std.get(col, col)
                row_dict[key] = value

            rows.append(row_dict)

        return rows

    def _extract_unique_values(
        self,
        df: pd.DataFrame,
        field_mappings: List[Dict[str, Any]]
    ) -> Dict[str, List[Any]]:
        """提取分类字段的唯一值"""
        unique_values = {}

        for mapping in field_mappings:
            if mapping['dataType'] == 'CATEGORICAL':
                col = mapping['originalColumn']
                if col in df.columns:
                    values = df[col].dropna().unique().tolist()
                    if len(values) <= 100:  # 只提取数量合理的唯一值
                        unique_values[mapping['standardField'] or col] = values

        return unique_values
