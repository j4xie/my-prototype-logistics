# -*- coding: utf-8 -*-
"""
测试多行表头识别和合并逻辑

目标：
1. 规则方法：尝试自动检测和合并多行表头
2. LLM方法：如果规则不行，用LLM识别
"""
import pandas as pd
import sys
import os

# 添加项目路径
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


def analyze_sheet_structure(excel_file: str, sheet_name: str, max_rows: int = 10):
    """分析单个sheet的表头结构"""
    print(f"\n{'='*60}")
    print(f"Sheet: {sheet_name}")
    print('='*60)

    # 读取原始数据（不指定header）
    df_raw = pd.read_excel(excel_file, sheet_name=sheet_name, header=None, nrows=max_rows)

    print(f"\n原始数据 (前{max_rows}行):")
    for i in range(min(max_rows, len(df_raw))):
        row = df_raw.iloc[i].tolist()
        # 显示前8列
        row_display = [str(v)[:20] if pd.notna(v) else 'NaN' for v in row[:8]]
        print(f"  Row {i}: {row_display}")

    return df_raw


def detect_data_start_row(df_raw: pd.DataFrame) -> int:
    """检测数据起始行（规则方法）"""
    for i in range(len(df_raw)):
        row = df_raw.iloc[i]
        non_empty = row.notna().sum()
        total = len(row)
        fill_rate = non_empty / total if total > 0 else 0

        # 数值占比
        numeric_count = sum(1 for v in row if pd.notna(v) and isinstance(v, (int, float)) and not isinstance(v, bool))
        numeric_rate = numeric_count / non_empty if non_empty > 0 else 0

        # 数据行条件：填充率>50% 且 数值率>30%
        if fill_rate > 0.5 and numeric_rate > 0.3:
            return i

    return 0


def merge_multirow_headers_rule(df_raw: pd.DataFrame, data_start: int) -> list:
    """规则方法：合并多行表头"""
    if data_start <= 0:
        return [f"Col_{i}" for i in range(len(df_raw.columns))]

    # 检查 data_start 前面的行，找出可能的表头行
    header_rows = []
    for i in range(max(0, data_start - 4), data_start):  # 最多检查4行
        row = df_raw.iloc[i]
        non_empty = row.notna().sum()

        # 数值占比低的行可能是表头
        numeric_count = sum(1 for v in row if pd.notna(v) and isinstance(v, (int, float)) and not isinstance(v, bool))
        numeric_rate = numeric_count / non_empty if non_empty > 0 else 0

        if numeric_rate < 0.5:  # 数值占比<50% 认为是表头行
            header_rows.append((i, row))

    print(f"\n检测到 {len(header_rows)} 个表头行: {[r[0] for r in header_rows]}")

    if not header_rows:
        return [f"Col_{i}" for i in range(len(df_raw.columns))]

    if len(header_rows) == 1:
        # 单行表头
        row = header_rows[0][1]
        return [str(v) if pd.notna(v) else f"Col_{i}" for i, v in enumerate(row)]

    # 多行表头合并
    merged = []
    num_cols = len(df_raw.columns)

    for col_idx in range(num_cols):
        parts = []
        last_value = None

        for row_idx, row in header_rows:
            val = row.iloc[col_idx] if col_idx < len(row) else None

            if pd.notna(val):
                val_str = str(val)
                # 避免重复
                if val_str != last_value:
                    parts.append(val_str)
                    last_value = val_str

        if parts:
            # 合并多行表头，用下划线连接
            merged_name = "_".join(parts)
            # 清理过长的名称
            if len(merged_name) > 50:
                merged_name = merged_name[:50]
            merged.append(merged_name)
        else:
            merged.append(f"Col_{col_idx}")

    return merged


def test_with_llm(df_raw: pd.DataFrame, data_start: int) -> list:
    """LLM方法：用LLM识别表头"""
    # 准备 prompt
    rows_text = []
    for i in range(min(data_start + 2, len(df_raw))):
        row = df_raw.iloc[i].tolist()[:15]  # 限制列数
        row_str = " | ".join([str(v)[:20] if pd.notna(v) else "" for v in row])
        rows_text.append(f"Row {i}: {row_str}")

    prompt = f"""分析这个Excel表格的表头结构：

{chr(10).join(rows_text)}

数据从 Row {data_start} 开始。

请识别表头行，并为每一列生成合并后的列名。
对于多行表头，将多行内容合并成一个有意义的列名。

返回JSON格式：
{{
    "header_rows": [行号列表],
    "merged_columns": ["列1名称", "列2名称", ...]
}}
"""
    print(f"\n[LLM Prompt]:\n{prompt[:500]}...")

    # 这里先不实际调用LLM，返回None表示需要LLM
    return None


def test_sheet(excel_file: str, sheet_name: str):
    """测试单个sheet"""
    df_raw = analyze_sheet_structure(excel_file, sheet_name)

    # 1. 检测数据起始行
    data_start = detect_data_start_row(df_raw)
    print(f"\n检测到数据起始行: Row {data_start}")

    # 2. 规则方法合并表头
    merged_headers = merge_multirow_headers_rule(df_raw, data_start)
    print(f"\n合并后的列名 (规则方法):")
    for i, name in enumerate(merged_headers[:10]):
        print(f"  Col {i}: {name}")
    if len(merged_headers) > 10:
        print(f"  ... 共 {len(merged_headers)} 列")

    # 3. 用合并后的列名创建DataFrame
    if data_start < len(df_raw):
        df_clean = df_raw.iloc[data_start:].copy()
        df_clean.columns = merged_headers[:len(df_clean.columns)]

        print(f"\n清洗后的数据预览:")
        print(df_clean.head(3).to_string())

    # 4. 评估结果
    col_x_count = sum(1 for name in merged_headers if name.startswith('Col_'))
    meaningful_count = len(merged_headers) - col_x_count

    print(f"\n评估结果:")
    print(f"  总列数: {len(merged_headers)}")
    print(f"  有意义列名: {meaningful_count}")
    print(f"  Col_X 列名: {col_x_count}")
    print(f"  成功率: {meaningful_count / len(merged_headers) * 100:.1f}%")

    return merged_headers, meaningful_count / len(merged_headers)


def main():
    excel_file = "Test.xlsx"

    if not os.path.exists(excel_file):
        print(f"文件不存在: {excel_file}")
        return

    # 获取所有sheet
    xl = pd.ExcelFile(excel_file)

    print("="*60)
    print("多行表头识别测试")
    print("="*60)

    results = []
    for sheet_name in xl.sheet_names[:5]:  # 测试前5个sheet
        try:
            headers, success_rate = test_sheet(excel_file, sheet_name)
            results.append({
                'sheet': sheet_name,
                'success_rate': success_rate,
                'col_count': len(headers)
            })
        except Exception as e:
            print(f"\n测试失败: {e}")
            results.append({
                'sheet': sheet_name,
                'success_rate': 0,
                'error': str(e)
            })

    # 汇总
    print("\n" + "="*60)
    print("测试汇总")
    print("="*60)
    for r in results:
        status = "OK" if r['success_rate'] > 0.7 else "NEED LLM"
        print(f"  {r['sheet'][:20]:<20} : {r['success_rate']*100:5.1f}% [{status}]")


if __name__ == "__main__":
    main()
