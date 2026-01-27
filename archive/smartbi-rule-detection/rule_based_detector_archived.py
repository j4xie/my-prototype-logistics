"""
ARCHIVED: Rule-based Structure Detection Code
==============================================
Date: 2026-01-27
Reason: Switched to LLM-first detection mode for better accuracy

This file contains the rule-based detection methods that were previously used
in structure_detector.py. The LLM-based detection is now the default.

These methods are preserved for reference and as potential fallback.
"""

# ================================================================
# CHINESE TITLE PATTERNS - Used for rule-based title row detection
# ================================================================
CHINESE_TITLE_PATTERNS = [
    "利润表", "资产负债表", "现金流量表", "报表", "汇总表", "明细表", "统计表"
]

CHINESE_HEADER_PATTERNS = [
    "项目", "行次", "科目", "摘要", "借方", "贷方", "本期", "累计"
]


# ================================================================
# RULE-BASED DETECTION METHODS (ARCHIVED)
# ================================================================

def _detect_with_rules_archived(
    raw_rows,
    merged_cells,
    sheet_name,
    total_rows,
    total_cols
):
    """
    ARCHIVED: Rule-based structure detection (Layer 1).

    Rules:
    1. Title row: Single merged cell spanning most columns
    2. Subtitle row: Contains units like "单位:", "Unit:"
    3. Period row: Contains date patterns like "2025年", "1月-12月"
    4. Category row: Merged cells creating column groups
    5. Column names row: Many unique values, no merges spanning columns

    This method was replaced by LLM-based detection because:
    - Complex multi-row headers are hard to detect with rules
    - Merged cell detection requires >50% column span, which doesn't work for all cases
    - Chinese accounting reports have variable formats
    """
    # [Original rule-based detection code was here]
    # See structure_detector.py git history for full implementation
    pass


def _is_complex_header_archived(
    raw_rows,
    merged_cells,
    total_cols
) -> bool:
    """
    ARCHIVED: Detect if the header structure is complex and needs LLM analysis.

    Complex patterns:
    1. Multiple merged cell regions in header area
    2. Date values appearing as column groupings (e.g., "2025-01-01", "2025-02-01")
    3. More than 3 potential header rows before numeric data
    4. Merged cells spanning multiple rows

    This method is no longer needed since LLM-first detection handles all cases.
    """
    if not raw_rows:
        return False

    # Check 1: Multiple merged cells with row span
    row_spanning_merges = [m for m in merged_cells if m.max_row > m.min_row]
    col_spanning_merges = [m for m in merged_cells if m.max_col - m.min_col >= 2]

    if len(row_spanning_merges) >= 2 or len(col_spanning_merges) >= 3:
        return True

    # Check 2: Date values appearing in header rows (monthly grouping pattern)
    import re
    date_pattern = re.compile(r'\d{4}-\d{2}-\d{2}|\d{4}/\d{2}/\d{2}|\d{4}年\d{1,2}月')
    date_header_rows = 0

    for row_idx, row in enumerate(raw_rows[:8]):
        if row_idx == 0:
            continue  # Skip title row
        date_count = sum(1 for v in row if v and date_pattern.search(str(v)))
        if date_count >= 3:  # Multiple dates in one row = monthly grouping
            date_header_rows += 1

    if date_header_rows >= 1:
        return True

    # Check 3: Many potential header rows before data
    first_data_row = -1
    for row_idx, row in enumerate(raw_rows[:10]):
        numeric_count = sum(1 for v in row if v and _is_numeric(str(v)))
        if numeric_count >= len(row) * 0.4 and numeric_count >= 5:
            first_data_row = row_idx
            break

    if first_data_row >= 5:
        return True

    return False


def _is_numeric(value: str) -> bool:
    """Check if value is numeric"""
    try:
        float(value.replace(',', '').replace('¥', '').replace('$', '').replace('%', ''))
        return True
    except (ValueError, TypeError):
        return False


# ================================================================
# SMART MERGE HEADERS - From fixed_executor.py
# ================================================================

def _smart_merge_headers_archived(rows, num_header_rows: int, total_cols: int):
    """
    ARCHIVED: Smart merge multiple header rows into column names.

    This method attempted to:
    1. Skip title rows (detected by few unique values or Chinese keywords)
    2. Merge category/sub-header rows

    Issues:
    - Title row detection by checking len(non_empty) <= 3 failed for merged cells
    - Merged cells get expanded, so non_empty count can be high even for title rows
    - Fixed by checking len(unique_values) <= 2 instead

    The fix is still in fixed_executor.py, but the method's complexity showed
    why LLM-based detection is better for structure detection.
    """
    TITLE_KEYWORDS = ["利润表", "资产负债表", "现金流量表", "报表", "汇总表", "明细表", "统计表"]

    # [Original smart merge code was here]
    # See fixed_executor.py for the current implementation
    pass


# ================================================================
# NOTES ON WHY LLM-FIRST IS BETTER
# ================================================================
"""
Rule-based detection problems:

1. MERGED CELL HANDLING
   - Merged cells get expanded when reading with openpyxl (data_only=True)
   - A title row like "江苏分部利润表" merged across 28 columns
     appears as 28 cells with the same value
   - Original rule: len(non_empty) <= 3 → FAILED (28 > 3)
   - Fix: len(unique_values) <= 2 → Better but still fragile

2. DATE PATTERN DETECTION
   - Monthly columns like "2025-01-01", "2025-02-01" need special handling
   - Sub-headers like "预算数", "本月实际" under each month
   - Rules would need complex regex and position tracking

3. CHINESE ACCOUNTING FORMATS
   - Various title formats: "利润表", "XXX分部利润表", "2025年XXX利润表"
   - Header patterns: "项目|行次|日期..." vs "科目|摘要|借方|贷方"
   - Each company may have different formats

4. LLM ADVANTAGES
   - Understands semantic meaning of headers
   - Can recognize patterns even with variations
   - High confidence (0.95) in test results
   - No need to maintain complex rules
"""
