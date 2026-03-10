"""Financial Data Normalizer — Smart column role detection and data standardization."""
import re
import logging
from typing import Dict, List, Optional, Any, Tuple
from dataclasses import dataclass, field
import pandas as pd
import numpy as np

logger = logging.getLogger(__name__)

@dataclass
class ColumnMapping:
    """Detected column role mapping."""
    period_cols: List[str] = field(default_factory=list)      # Month/Quarter columns
    budget_cols: List[str] = field(default_factory=list)       # Budget/Target
    actual_cols: List[str] = field(default_factory=list)       # Actual/Achieved
    last_year_cols: List[str] = field(default_factory=list)    # Previous year
    last_year_budget_cols: List[str] = field(default_factory=list)
    category_col: Optional[str] = None                         # Category/Product line
    item_col: Optional[str] = None                             # P&L item name
    label_col: Optional[str] = None                            # First text column (row label)
    year: int = 2026
    data_layout: str = "wide"  # "wide" (months as columns) or "long" (month as row values)

class FinancialDataNormalizer:
    """Detect column roles and normalize raw Excel data for financial charts."""

    # Period detection patterns
    MONTH_PATTERNS = [
        re.compile(r'^(\d{1,2})月$'),           # 1月-12月
        re.compile(r'^(\d{4})年(\d{1,2})月$'),   # 2026年1月
        re.compile(r'^(\d{4})-(\d{1,2})$'),      # 2026-1
        re.compile(r'^(\d{4})/(\d{1,2})$'),      # 2026/1
        re.compile(r'^M(\d{1,2})$', re.I),       # M1-M12
        re.compile(r'^Month\s*(\d{1,2})$', re.I),
    ]
    QUARTER_PATTERNS = [
        re.compile(r'^Q([1-4])$', re.I),
        re.compile(r'^第([一二三四])季度$'),
        re.compile(r'^(\d{4})Q([1-4])$', re.I),
    ]

    # Column NAME keywords for period columns (not value patterns — these match the header itself)
    PERIOD_COL_KEYWORDS = ['月份', '月', 'month', '期间', '时间', 'period', '日期', 'date']

    # Column role keywords
    BUDGET_KEYWORDS = ['预算', '目标', 'budget', 'target', 'plan', '计划', '指标']
    ACTUAL_KEYWORDS = ['实际', '完成', 'actual', 'achieved', '达成', '本年', '本期']
    LAST_YEAR_KEYWORDS = ['上年', '去年', '同期', '上期', 'last year', 'prior', 'ly', 'previous']
    CATEGORY_KEYWORDS = ['品类', '类别', '产品线', 'category', '分类', '品种', '系列']
    ITEM_KEYWORDS = ['项目', '科目', 'item', '名称', '摘要', '费用项']

    # P&L classification (reuse from finance_extract.py)
    PNL_REVENUE = ['营业收入', '主营业务收入', '其他业务收入', '收入合计', '销售收入']
    PNL_COST = ['营业成本', '主营业务成本', '制造费用', '直接材料', '直接人工']
    PNL_EXPENSE = ['销售费用', '管理费用', '财务费用', '研发费用', '营业费用']
    PNL_PROFIT = ['毛利润', '毛利', '营业利润', '利润总额', '净利润', '税后利润']
    PNL_TAX = ['所得税', '税金', '附加税']

    QUARTER_CN = {1: 'Q1', 2: 'Q2', 3: 'Q3', 4: 'Q4'}

    def detect_columns(self, columns: List[str], sample_data: Optional[pd.DataFrame] = None) -> ColumnMapping:
        """Auto-detect column roles from column names and sample data."""
        mapping = ColumnMapping()
        cols_lower = {c: str(c).lower().strip() for c in columns}

        for col in columns:
            cl = cols_lower[col]
            # Check period columns — first by value pattern (e.g. "1月", "2026-1")
            if self._is_month_col(cl):
                mapping.period_cols.append(col)
                continue
            if self._is_quarter_col(cl):
                mapping.period_cols.append(col)
                continue
            # Then by column NAME keyword (e.g. "月份", "月", "month", "期间")
            # This column contains period values in its cells, not in the header
            if any(kw in cl for kw in self.PERIOD_COL_KEYWORDS):
                mapping.period_cols.append(col)
                continue

            # Check role keywords — check last_year FIRST to avoid "去年实际" matching actual
            is_last_year = any(kw in cl for kw in self.LAST_YEAR_KEYWORDS)
            is_budget = any(kw in cl for kw in self.BUDGET_KEYWORDS)
            is_actual = any(kw in cl for kw in self.ACTUAL_KEYWORDS)

            if is_last_year and is_budget:
                mapping.last_year_budget_cols.append(col)
            elif is_last_year:
                mapping.last_year_cols.append(col)
            elif is_budget:
                mapping.budget_cols.append(col)
            elif is_actual:
                mapping.actual_cols.append(col)
            elif any(kw in cl for kw in self.CATEGORY_KEYWORDS):
                mapping.category_col = col
            elif any(kw in cl for kw in self.ITEM_KEYWORDS):
                mapping.item_col = col

        # Auto-detect label column (first non-numeric, non-period text column)
        if sample_data is not None:
            for col in columns:
                if col in mapping.period_cols:
                    continue
                if col == mapping.category_col or col == mapping.item_col:
                    mapping.label_col = col
                    break
                if sample_data[col].dtype == 'object':
                    mapping.label_col = col
                    break

        # Detect data layout (>=2 period columns = wide, e.g. "1月", "2月")
        if len(mapping.period_cols) >= 2:
            mapping.data_layout = "wide"  # months as columns
        else:
            mapping.data_layout = "long"  # month values in rows

        # Detect year from column names
        for col in columns:
            m = re.search(r'(20\d{2})', str(col))
            if m:
                mapping.year = int(m.group(1))
                break

        logger.info(f"Column mapping detected: periods={len(mapping.period_cols)}, "
                    f"budget={len(mapping.budget_cols)}, actual={len(mapping.actual_cols)}, "
                    f"lastYear={len(mapping.last_year_cols)}, layout={mapping.data_layout}")
        return mapping

    def normalize(self, raw_data: pd.DataFrame, column_mapping: ColumnMapping,
                  period_filter: Optional[Dict] = None) -> pd.DataFrame:
        """Normalize raw data to standard format based on column mapping.

        Output columns: month, quarter, category, item, budget, actual, last_year, last_year_budget
        """
        if column_mapping.data_layout == "wide":
            df = self._normalize_wide(raw_data, column_mapping)
        else:
            df = self._normalize_long(raw_data, column_mapping)

        # Apply period filter
        if period_filter:
            df = self._apply_period_filter(df, period_filter)

        return df

    def _normalize_wide(self, raw_data: pd.DataFrame, mapping: ColumnMapping) -> pd.DataFrame:
        """Normalize wide-format data (months as columns)."""
        rows = []
        label_col = mapping.label_col or mapping.item_col or mapping.category_col

        # First pass: detect row roles from labels (budget/actual/last_year)
        row_roles = {}  # index -> 'budget'|'actual'|'last_year'|'item'
        for idx, row in raw_data.iterrows():
            label = str(row.get(label_col, '')) if label_col else ''
            label_lower = label.lower()
            if any(kw in label_lower for kw in ['预算', '目标', 'budget', 'target', '计划']):
                row_roles[idx] = 'budget'
            elif any(kw in label_lower for kw in ['上年', '去年', '同期', 'last year', '上期']):
                row_roles[idx] = 'last_year'
            elif any(kw in label_lower for kw in ['实际', '完成', 'actual', '达成', '本年']):
                row_roles[idx] = 'actual'
            else:
                row_roles[idx] = 'item'

        has_role_rows = any(r in ('budget', 'actual', 'last_year') for r in row_roles.values())

        if has_role_rows:
            # Group by category, merge budget/actual/last_year per period
            for period_col in mapping.period_cols:
                month_num = self._extract_month(str(period_col))
                if month_num is None:
                    continue
                quarter = f"Q{(month_num - 1) // 3 + 1}"

                budget_val = None
                actual_val = None
                last_year_val = None

                for idx, row in raw_data.iterrows():
                    val = self._safe_float(row.get(period_col))
                    role = row_roles.get(idx, 'item')
                    if role == 'budget':
                        budget_val = val
                    elif role == 'actual':
                        actual_val = val
                    elif role == 'last_year':
                        last_year_val = val

                rows.append({
                    'month': month_num,
                    'quarter': quarter,
                    'category': '',
                    'item': '',
                    'budget': budget_val,
                    'actual': actual_val,
                    'last_year': last_year_val,
                    'last_year_budget': None,
                })
        else:
            # Original behavior: each row is an item, period columns are actual values
            for _, row in raw_data.iterrows():
                label = str(row.get(label_col, '')) if label_col else ''
                category = str(row.get(mapping.category_col, '')) if mapping.category_col else label
                item = str(row.get(mapping.item_col, '')) if mapping.item_col else label

                for period_col in mapping.period_cols:
                    month_num = self._extract_month(str(period_col))
                    if month_num is None:
                        continue
                    quarter = f"Q{(month_num - 1) // 3 + 1}"

                    val = self._safe_float(row.get(period_col))
                    rows.append({
                        'month': month_num,
                        'quarter': quarter,
                        'category': category,
                        'item': item,
                        'budget': None,
                        'actual': val,
                        'last_year': None,
                        'last_year_budget': None,
                    })

        return pd.DataFrame(rows)

    def _normalize_long(self, raw_data: pd.DataFrame, mapping: ColumnMapping) -> pd.DataFrame:
        """Normalize long-format data (separate budget/actual/last_year columns)."""
        rows = []
        label_col = mapping.label_col or mapping.item_col or mapping.category_col

        for _, row in raw_data.iterrows():
            label = str(row.get(label_col, '')) if label_col else ''
            category = str(row.get(mapping.category_col, '')) if mapping.category_col else label
            item = str(row.get(mapping.item_col, '')) if mapping.item_col else label

            # Extract month from period column if exists
            month_num = None
            if mapping.period_cols:
                period_val = str(row.get(mapping.period_cols[0], ''))
                month_num = self._extract_month(period_val)

            budget = self._safe_float(row.get(mapping.budget_cols[0])) if mapping.budget_cols else None
            actual = self._safe_float(row.get(mapping.actual_cols[0])) if mapping.actual_cols else None
            last_year = self._safe_float(row.get(mapping.last_year_cols[0])) if mapping.last_year_cols else None
            ly_budget = self._safe_float(row.get(mapping.last_year_budget_cols[0])) if mapping.last_year_budget_cols else None

            rows.append({
                'month': month_num or 0,
                'quarter': f"Q{(month_num - 1) // 3 + 1}" if month_num else '',
                'category': category,
                'item': item,
                'budget': budget,
                'actual': actual,
                'last_year': last_year,
                'last_year_budget': ly_budget,
            })

        return pd.DataFrame(rows)

    def _apply_period_filter(self, df: pd.DataFrame, period_filter: Dict) -> pd.DataFrame:
        """Filter by period: {type: month|quarter|year|month_range, start_month, end_month}"""
        ptype = period_filter.get('period_type', 'year')
        if ptype == 'year':
            return df
        elif ptype == 'month':
            m = period_filter.get('start_month', 1)
            return df[df['month'] == m]
        elif ptype == 'quarter':
            q = period_filter.get('quarter', 'Q1')
            return df[df['quarter'] == q]
        elif ptype == 'month_range':
            s = period_filter.get('start_month', 1)
            e = period_filter.get('end_month', 12)
            return df[(df['month'] >= s) & (df['month'] <= e)]
        return df

    def _is_month_col(self, col_lower: str) -> bool:
        return any(p.match(col_lower) for p in self.MONTH_PATTERNS)

    def _is_quarter_col(self, col_lower: str) -> bool:
        return any(p.match(col_lower) for p in self.QUARTER_PATTERNS)

    def _extract_month(self, text: str) -> Optional[int]:
        text = text.strip()
        for p in self.MONTH_PATTERNS:
            m = p.match(text)
            if m:
                groups = m.groups()
                month = int(groups[-1])  # Last group is always month
                if 1 <= month <= 12:
                    return month
        return None

    @staticmethod
    def _safe_float(val) -> Optional[float]:
        if val is None or (isinstance(val, float) and np.isnan(val)):
            return None
        try:
            v = float(str(val).replace(',', '').replace('，', ''))
            return v if not np.isnan(v) else None
        except (ValueError, TypeError):
            return None

    def classify_pnl_item(self, item_name: str) -> str:
        """Classify a P&L item into: revenue, cost, expense, profit, tax, other."""
        name = item_name.strip()
        if any(kw in name for kw in self.PNL_REVENUE):
            return 'revenue'
        if any(kw in name for kw in self.PNL_COST):
            return 'cost'
        if any(kw in name for kw in self.PNL_EXPENSE):
            return 'expense'
        if any(kw in name for kw in self.PNL_PROFIT):
            return 'profit'
        if any(kw in name for kw in self.PNL_TAX):
            return 'tax'
        return 'other'

    def get_months_label(self, start_month: int, end_month: int, year: int) -> str:
        """Generate human-readable period label."""
        if start_month == 1 and end_month == 12:
            return f"{year}年全年"
        elif start_month == end_month:
            return f"{year}年{start_month}月"
        else:
            return f"{year}年{start_month}-{end_month}月"
