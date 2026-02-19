"""
Finance Data Extraction API

Extracts structured finance records (REVENUE, COST, AR, AP, BUDGET)
from Excel row data using keyword matching on row labels and column names.

Called by Java after persistDynamic() to populate smart_bi_finance_data.
"""
import re
import logging
from typing import Any, Dict, List, Optional

import pandas as pd
import numpy as np
from fastapi import APIRouter
from pydantic import BaseModel

logger = logging.getLogger(__name__)

router = APIRouter()

# ── Keyword → RecordType mapping (mirrors insight_generator.py kw_map) ──

RECORD_TYPE_MAP: Dict[str, str] = {
    '营业收入': 'REVENUE',
    '主营业务收入': 'REVENUE',
    '毛利润': 'REVENUE',
    '毛利': 'REVENUE',
    '净利润': 'REVENUE',
    '利润总额': 'REVENUE',
    '营业利润': 'REVENUE',
    '营业成本': 'COST',
    '主营业务成本': 'COST',
    '销售费用': 'COST',
    '管理费用': 'COST',
    '财务费用': 'COST',
    '研发费用': 'COST',
    '制造费用': 'COST',
    '应收账款': 'AR',
    '应付账款': 'AP',
}

# Date-like column patterns
_DATE_PATTERNS = [
    re.compile(r'^\d{4}-\d{2}-\d{2}$'),           # 2025-01-01
    re.compile(r'^\d{4}-\d{2}$'),                   # 2025-01
    re.compile(r'^\d{4}年\d{1,2}月$'),              # 2025年1月
    re.compile(r'^\d{1,2}月$'),                     # 1月
    re.compile(r'^\d{4}/\d{1,2}/\d{1,2}$'),        # 2025/1/1
    re.compile(r'^\d{4}/\d{1,2}$'),                 # 2025/1
]

# Month name patterns for fallback year detection
_MONTH_ONLY = re.compile(r'^(\d{1,2})月$')


class ExtractRequest(BaseModel):
    data: List[Dict[str, Any]]
    columns: List[str]
    sheet_name: str = ""


class ExtractResponse(BaseModel):
    success: bool
    records: List[Dict[str, Any]] = []
    error: Optional[str] = None


def _detect_date_columns(columns: List[str]) -> List[str]:
    """Find columns whose names look like dates/months."""
    date_cols = []
    for col in columns:
        col_str = str(col).strip()
        if any(p.match(col_str) for p in _DATE_PATTERNS):
            date_cols.append(col)
    return date_cols


def _col_to_date_str(col_name: str, fallback_year: int = 2025) -> str:
    """Convert a column name to a YYYY-MM-DD date string."""
    col = str(col_name).strip()

    # YYYY-MM-DD already
    if re.match(r'^\d{4}-\d{2}-\d{2}$', col):
        return col

    # YYYY-MM
    m = re.match(r'^(\d{4})-(\d{2})$', col)
    if m:
        return f"{m.group(1)}-{m.group(2)}-01"

    # YYYY年M月
    m = re.match(r'^(\d{4})年(\d{1,2})月$', col)
    if m:
        return f"{m.group(1)}-{int(m.group(2)):02d}-01"

    # M月 (use fallback year)
    m = _MONTH_ONLY.match(col)
    if m:
        return f"{fallback_year}-{int(m.group(1)):02d}-01"

    # YYYY/M/D
    m = re.match(r'^(\d{4})/(\d{1,2})/(\d{1,2})$', col)
    if m:
        return f"{m.group(1)}-{int(m.group(2)):02d}-{int(m.group(3)):02d}"

    # YYYY/M
    m = re.match(r'^(\d{4})/(\d{1,2})$', col)
    if m:
        return f"{m.group(1)}-{int(m.group(2)):02d}-01"

    return f"{fallback_year}-01-01"


def _detect_fallback_year(columns: List[str]) -> int:
    """Try to infer year from date columns, default 2025."""
    for col in columns:
        col_str = str(col).strip()
        m = re.match(r'^(\d{4})', col_str)
        if m:
            y = int(m.group(1))
            if 2020 <= y <= 2030:
                return y
    return 2025


def _safe_float(val: Any) -> Optional[float]:
    """Convert value to float safely, return None for non-numeric."""
    if val is None:
        return None
    if isinstance(val, (int, float)):
        if pd.isna(val) or np.isinf(val):
            return None
        return float(val)
    try:
        f = float(val)
        if pd.isna(f) or np.isinf(f):
            return None
        return f
    except (ValueError, TypeError):
        return None


def _detect_label_column(columns: List[str], data: List[Dict[str, Any]]) -> Optional[str]:
    """Find the first column that contains mostly text (label column)."""
    for col in columns:
        text_count = 0
        total = 0
        for row in data[:20]:  # sample first 20 rows
            val = row.get(col)
            if val is None:
                continue
            total += 1
            if isinstance(val, str) and not _safe_float(val):
                text_count += 1
        if total > 0 and text_count / total > 0.5:
            return col
    return None


def extract_finance_records(
    data: List[Dict[str, Any]],
    columns: List[str],
    sheet_name: str = "",
) -> List[Dict[str, Any]]:
    """
    Core extraction logic.

    For each row, check if the label matches a financial keyword.
    For each date column, emit a record with the matched RecordType.
    """
    if not data or not columns:
        return []

    # Detect label column (first text column)
    label_col = _detect_label_column(columns, data)
    if not label_col:
        logger.info("No label column detected in sheet '%s'", sheet_name)
        return []

    # Detect date/month columns
    non_label_cols = [c for c in columns if c != label_col]
    date_cols = _detect_date_columns(non_label_cols)

    if not date_cols:
        # If no date columns, try treating all numeric columns as a single summary
        logger.info("No date columns detected in sheet '%s', trying summary mode", sheet_name)
        return _extract_summary_mode(data, columns, label_col, sheet_name)

    fallback_year = _detect_fallback_year(date_cols)
    records = []

    for row in data:
        label = str(row.get(label_col, '')).strip()
        if not label:
            continue

        # Match against keywords
        matched_type = None
        matched_category = label
        for keyword, record_type in RECORD_TYPE_MAP.items():
            if keyword in label:
                matched_type = record_type
                matched_category = label
                break

        if not matched_type:
            continue

        # Emit one record per date column
        for date_col in date_cols:
            val = _safe_float(row.get(date_col))
            if val is None:
                continue

            record_date = _col_to_date_str(date_col, fallback_year)
            record = {
                'recordType': matched_type,
                'recordDate': record_date,
                'category': matched_category,
                'department': sheet_name,
            }

            # Map value to the right field based on record type
            if matched_type == 'REVENUE':
                record['actualAmount'] = val
            elif matched_type == 'COST':
                record['totalCost'] = val
                record['actualAmount'] = val
            elif matched_type == 'AR':
                record['receivableAmount'] = val
            elif matched_type == 'AP':
                record['payableAmount'] = val
            elif matched_type == 'BUDGET':
                record['budgetAmount'] = val

            records.append(record)

    logger.info("Extracted %d finance records from sheet '%s'", len(records), sheet_name)
    return records


def _extract_summary_mode(
    data: List[Dict[str, Any]],
    columns: List[str],
    label_col: str,
    sheet_name: str,
) -> List[Dict[str, Any]]:
    """
    Fallback: no date columns detected. Treat numeric columns as values
    and emit a single record per matched row with today's date.
    """
    from datetime import date
    today = date.today().isoformat()
    records = []

    # Find first numeric column
    numeric_col = None
    for col in columns:
        if col == label_col:
            continue
        for row in data[:5]:
            if _safe_float(row.get(col)) is not None:
                numeric_col = col
                break
        if numeric_col:
            break

    if not numeric_col:
        return []

    for row in data:
        label = str(row.get(label_col, '')).strip()
        if not label:
            continue

        matched_type = None
        for keyword, record_type in RECORD_TYPE_MAP.items():
            if keyword in label:
                matched_type = record_type
                break

        if not matched_type:
            continue

        val = _safe_float(row.get(numeric_col))
        if val is None:
            continue

        record = {
            'recordType': matched_type,
            'recordDate': today,
            'category': label,
            'department': sheet_name,
        }

        if matched_type == 'REVENUE':
            record['actualAmount'] = val
        elif matched_type == 'COST':
            record['totalCost'] = val
            record['actualAmount'] = val
        elif matched_type == 'AR':
            record['receivableAmount'] = val
        elif matched_type == 'AP':
            record['payableAmount'] = val

        records.append(record)

    logger.info("Extracted %d finance records (summary mode) from sheet '%s'", len(records), sheet_name)
    return records


@router.post("/extract", response_model=ExtractResponse)
async def extract_finance_data(req: ExtractRequest):
    """
    Extract structured finance records from Excel row data.

    Called by Java backend after persistDynamic() to populate smart_bi_finance_data.
    """
    try:
        records = extract_finance_records(req.data, req.columns, req.sheet_name)
        return ExtractResponse(success=True, records=records)
    except Exception as e:
        logger.exception("Finance extraction failed for sheet '%s'", req.sheet_name)
        return ExtractResponse(success=False, records=[], error=str(e))
