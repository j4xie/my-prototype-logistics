# -*- coding: utf-8 -*-
"""
测试：高级表头识别方案

方案1: LLM 推断空列名
方案2: 智能推断（相邻列+数据值）

目标: 100% 成功率
"""
import pandas as pd
import json
import os
import sys
import re
from typing import List, Tuple, Dict, Optional

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


# ============================================================
# 工具函数
# ============================================================

def load_api_key() -> Optional[str]:
    """从环境变量或 .env 文件加载 API Key"""
    api_key = os.environ.get("DASHSCOPE_API_KEY") or os.environ.get("LLM_API_KEY")
    if api_key:
        return api_key

    env_paths = [
        os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env"),
        ".env"
    ]
    for env_path in env_paths:
        if os.path.exists(env_path):
            with open(env_path, 'r', encoding='utf-8') as f:
                for line in f:
                    line = line.strip()
                    if line.startswith('LLM_API_KEY=') or line.startswith('DASHSCOPE_API_KEY='):
                        return line.split('=', 1)[1].strip()
    return None


def call_llm(prompt: str, model: str = "qwen-turbo") -> Optional[str]:
    """调用 LLM"""
    try:
        from dashscope import Generation
        import dashscope

        api_key = load_api_key()
        if not api_key:
            return None

        dashscope.api_key = api_key

        response = Generation.call(
            model=model,
            prompt=prompt,
            result_format='message'
        )

        if response.status_code == 200:
            return response.output.choices[0].message.content
        return None
    except Exception as e:
        print(f"LLM error: {e}")
        return None


def parse_json_response(response: str) -> Optional[Dict]:
    """解析 JSON 响应"""
    if not response:
        return None
    try:
        text = response
        if "```json" in text:
            text = text.split("```json")[1].split("```")[0]
        elif "```" in text:
            text = text.split("```")[1].split("```")[0]
        text = text.strip()
        start = text.find('{')
        end = text.rfind('}') + 1
        if start >= 0 and end > start:
            text = text[start:end]
        return json.loads(text)
    except:
        return None


def detect_data_start(rows: List[List]) -> int:
    """检测数据起始行"""
    for i, row in enumerate(rows):
        non_empty = sum(1 for v in row if pd.notna(v))
        total = len(row)
        if total == 0:
            continue
        fill_rate = non_empty / total
        numeric_count = sum(1 for v in row if pd.notna(v) and isinstance(v, (int, float)) and not isinstance(v, bool))
        numeric_rate = numeric_count / non_empty if non_empty > 0 else 0
        if fill_rate > 0.5 and numeric_rate > 0.3:
            return i
    return 0


def merge_header_rows(rows: List[List], header_indices: List[int], num_cols: int) -> List[str]:
    """合并多行表头"""
    if not header_indices:
        return [f"Col_{i}" for i in range(num_cols)]

    merged = []
    for col_idx in range(num_cols):
        parts = []
        last_value = None
        for row_idx in header_indices:
            if row_idx >= len(rows):
                continue
            row = rows[row_idx]
            val = row[col_idx] if col_idx < len(row) else None
            if pd.notna(val):
                val_str = str(val).strip()
                # 清理日期格式
                if '00:00:00' in val_str:
                    try:
                        date_part = val_str.replace(' 00:00:00', '').strip()
                        if '-' in date_part:
                            month = int(date_part.split('-')[1])
                            val_str = f"{month}月"
                    except:
                        pass
                if val_str and val_str != last_value:
                    parts.append(val_str)
                    last_value = val_str

        if parts:
            merged_name = "_".join(parts)
            if len(merged_name) > 50:
                merged_name = merged_name[:50]
            merged.append(merged_name)
        else:
            merged.append(f"Col_{col_idx}")

    return merged


def evaluate_headers(headers: List[str]) -> Tuple[float, int, int]:
    """评估表头质量"""
    col_x_count = sum(1 for name in headers if name.startswith('Col_'))
    meaningful_count = len(headers) - col_x_count
    success_rate = meaningful_count / len(headers) if headers else 0
    return success_rate, meaningful_count, col_x_count


# ============================================================
# 方案1: LLM 推断空列名
# ============================================================

def scheme1_llm_infer_empty_columns(rows: List[List], num_cols: int, data_start: int) -> List[str]:
    """方案1: 让 LLM 推断空列的列名"""

    # 先用基础规则合并表头
    header_indices = []
    for i in range(max(0, data_start - 6), data_start):
        if i >= len(rows):
            continue
        row = rows[i]
        non_empty = sum(1 for v in row if pd.notna(v))
        fill_rate = non_empty / len(row) if len(row) > 0 else 0
        if fill_rate < 0.2:
            continue
        numeric_count = sum(1 for v in row if pd.notna(v) and isinstance(v, (int, float)) and not isinstance(v, bool))
        numeric_rate = numeric_count / non_empty if non_empty > 0 else 0
        if numeric_rate < 0.5:
            header_indices.append(i)

    headers = merge_header_rows(rows, header_indices, num_cols)

    # 找出空列（Col_X）
    empty_cols = [(i, h) for i, h in enumerate(headers) if h.startswith('Col_')]

    if not empty_cols:
        return headers  # 没有空列，直接返回

    # 构建 LLM prompt 来推断空列名
    # 准备上下文：空列的相邻列名和数据样本
    context_lines = []
    for col_idx, col_name in empty_cols:
        # 获取相邻列名
        left_name = headers[col_idx - 1] if col_idx > 0 else "(无)"
        right_name = headers[col_idx + 1] if col_idx < len(headers) - 1 else "(无)"

        # 获取该列的数据样本
        data_samples = []
        for row in rows[data_start:data_start + 5]:
            if col_idx < len(row):
                val = row[col_idx]
                if pd.notna(val):
                    data_samples.append(str(val)[:20])

        context_lines.append(f"  - {col_name}: 左边列={left_name}, 右边列={right_name}, 数据样本={data_samples[:3]}")

    prompt = f"""分析这个Excel表格中空列的含义，推断合适的列名。

空列信息：
{chr(10).join(context_lines)}

表头行数据：
{chr(10).join([f"Row {i}: {[str(v)[:15] if pd.notna(v) else '(空)' for v in rows[i][:min(15, num_cols)]]}" for i in header_indices[:2]])}

根据相邻列名和数据特征，推断每个空列的含义。

返回JSON格式（只返回JSON）：
{{
    "inferred_names": {{
        "Col_28": "推断的列名",
        ...
    }}
}}"""

    print("\n[Scheme1 LLM Prompt]:")
    print(prompt[:500] + "..." if len(prompt) > 500 else prompt)

    response = call_llm(prompt)
    if response:
        print(f"\n[Scheme1 LLM Response]: {response[:300]}...")
        result = parse_json_response(response)
        if result and "inferred_names" in result:
            inferred = result["inferred_names"]
            for col_name, new_name in inferred.items():
                # 找到对应的索引
                for i, h in enumerate(headers):
                    if h == col_name:
                        headers[i] = new_name
                        print(f"  {col_name} -> {new_name}")

    return headers


# ============================================================
# 方案2: 智能推断（相邻列+数据值）
# ============================================================

def scheme2_smart_infer_empty_columns(rows: List[List], num_cols: int, data_start: int) -> List[str]:
    """方案2: 智能推断空列名（基于相邻列和数据特征）"""

    # 先用基础规则合并表头
    header_indices = []
    for i in range(max(0, data_start - 6), data_start):
        if i >= len(rows):
            continue
        row = rows[i]
        non_empty = sum(1 for v in row if pd.notna(v))
        fill_rate = non_empty / len(row) if len(row) > 0 else 0
        if fill_rate < 0.2:
            continue
        numeric_count = sum(1 for v in row if pd.notna(v) and isinstance(v, (int, float)) and not isinstance(v, bool))
        numeric_rate = numeric_count / non_empty if non_empty > 0 else 0
        if numeric_rate < 0.5:
            header_indices.append(i)

    headers = merge_header_rows(rows, header_indices, num_cols)

    # 找出空列（Col_X）
    empty_cols = [(i, h) for i, h in enumerate(headers) if h.startswith('Col_')]

    if not empty_cols:
        return headers

    # 分析每个空列
    for col_idx, col_name in empty_cols:
        inferred_name = _infer_column_name(rows, headers, col_idx, data_start)
        if inferred_name:
            headers[col_idx] = inferred_name
            print(f"  [Scheme2] {col_name} -> {inferred_name}")

    return headers


def _infer_column_name(rows: List[List], headers: List[str], col_idx: int, data_start: int) -> Optional[str]:
    """根据数据特征推断列名"""

    # 获取该列的数据
    col_data = []
    for row in rows[data_start:data_start + 20]:
        if col_idx < len(row):
            val = row[col_idx]
            if pd.notna(val):
                col_data.append(val)

    if not col_data:
        return None

    # 分析数据特征
    # 1. 检查是否是比率/百分比（值在 0-2 之间或 0-200 之间）
    if all(isinstance(v, (int, float)) for v in col_data):
        values = [float(v) for v in col_data if pd.notna(v)]
        if values:
            avg = sum(values) / len(values)
            max_val = max(values)
            min_val = min(values)

            # 比率特征：值在 0.5-1.5 之间（完成率）
            if 0.5 <= avg <= 1.5 and max_val <= 2.0:
                # 检查相邻列是否有"预算"和"实际"
                left_name = headers[col_idx - 1] if col_idx > 0 else ""
                right_name = headers[col_idx + 1] if col_idx < len(headers) - 1 else ""

                if "实际" in left_name or "实际" in right_name:
                    return "完成率"
                if "预算" in left_name or "预算" in right_name:
                    return "完成率"
                return "比率"

            # 百分比特征：值在 50-150 之间
            if 50 <= avg <= 150 and max_val <= 200:
                return "完成率%"

    # 2. 检查相邻列的模式
    left_name = headers[col_idx - 1] if col_idx > 0 else ""
    right_name = headers[col_idx + 1] if col_idx < len(headers) - 1 else ""

    # 如果左右都是相同模式（如 "X月_预算数"），推断中间列
    if left_name and right_name:
        # 检查是否是序列中断
        left_match = re.match(r'(\d+)月', left_name)
        right_match = re.match(r'(\d+)月', right_name)
        if left_match and right_match:
            left_month = int(left_match.group(1))
            right_month = int(right_match.group(1))
            if right_month - left_month == 2:
                # 中间缺少一个月
                return f"{left_month + 1}月"

    # 3. 检查是否是汇总列
    if "合计" in left_name or "合计" in right_name:
        if all(isinstance(v, (int, float)) for v in col_data[:5]):
            return "小计"

    return None


# ============================================================
# 测试
# ============================================================

def test_sheet(excel_file: str, sheet_name: str):
    """测试单个 sheet"""
    print(f"\n{'='*70}")
    print(f"Sheet: {sheet_name}")
    print('='*70)

    df_raw = pd.read_excel(excel_file, sheet_name=sheet_name, header=None, nrows=30)
    rows = df_raw.values.tolist()
    num_cols = len(df_raw.columns)

    data_start = detect_data_start(rows)
    print(f"Data start: Row {data_start}")
    print(f"Total columns: {num_cols}")

    # 基础合并（不处理空列）
    header_indices = []
    for i in range(max(0, data_start - 6), data_start):
        if i >= len(rows):
            continue
        row = rows[i]
        non_empty = sum(1 for v in row if pd.notna(v))
        fill_rate = non_empty / len(row) if len(row) > 0 else 0
        if fill_rate < 0.2:
            continue
        numeric_count = sum(1 for v in row if pd.notna(v) and isinstance(v, (int, float)) and not isinstance(v, bool))
        numeric_rate = numeric_count / non_empty if non_empty > 0 else 0
        if numeric_rate < 0.5:
            header_indices.append(i)

    base_headers = merge_header_rows(rows, header_indices, num_cols)
    base_rate, base_meaningful, base_colx = evaluate_headers(base_headers)
    print(f"\nBaseline: {base_rate*100:.1f}% ({base_meaningful}/{num_cols} meaningful, {base_colx} Col_X)")

    if base_colx == 0:
        print("No empty columns, skipping advanced schemes.")
        return {
            'sheet': sheet_name,
            'baseline': base_rate,
            'scheme1': base_rate,
            'scheme2': base_rate,
            'best': 'baseline'
        }

    # 方案1: LLM 推断
    print("\n--- Scheme 1: LLM Inference ---")
    headers1 = scheme1_llm_infer_empty_columns(rows, num_cols, data_start)
    rate1, meaningful1, colx1 = evaluate_headers(headers1)
    print(f"Result: {rate1*100:.1f}% ({meaningful1}/{num_cols} meaningful, {colx1} Col_X)")

    # 方案2: 智能推断
    print("\n--- Scheme 2: Smart Inference ---")
    headers2 = scheme2_smart_infer_empty_columns(rows, num_cols, data_start)
    rate2, meaningful2, colx2 = evaluate_headers(headers2)
    print(f"Result: {rate2*100:.1f}% ({meaningful2}/{num_cols} meaningful, {colx2} Col_X)")

    # 比较
    best = 'baseline'
    best_rate = base_rate
    if rate1 > best_rate:
        best = 'scheme1'
        best_rate = rate1
    if rate2 > best_rate:
        best = 'scheme2'
        best_rate = rate2

    print(f"\n--- Summary ---")
    print(f"Baseline:  {base_rate*100:.1f}%")
    print(f"Scheme 1:  {rate1*100:.1f}% (LLM)")
    print(f"Scheme 2:  {rate2*100:.1f}% (Smart)")
    print(f"Best:      {best} ({best_rate*100:.1f}%)")

    return {
        'sheet': sheet_name,
        'baseline': base_rate,
        'scheme1': rate1,
        'scheme2': rate2,
        'best': best
    }


def main():
    excel_file = "Test.xlsx"
    if not os.path.exists(excel_file):
        print(f"File not found: {excel_file}")
        return

    api_key = load_api_key()
    print(f"API Key: {'Found' if api_key else 'Not found'}")

    xl = pd.ExcelFile(excel_file)

    print("="*70)
    print("Advanced Header Detection Test")
    print("="*70)

    results = []
    # 测试所有利润表 sheets（索引 2-9 是利润表）
    for sheet_name in xl.sheet_names[2:10]:
        try:
            result = test_sheet(excel_file, sheet_name)
            results.append(result)
        except Exception as e:
            print(f"Error testing {sheet_name}: {e}")
            import traceback
            traceback.print_exc()

    # 汇总
    print("\n" + "="*70)
    print("Summary")
    print("="*70)
    print(f"{'Sheet':<30} {'Base':>8} {'LLM':>8} {'Smart':>8} {'Best':>10}")
    print("-"*70)

    for r in results:
        print(f"{r['sheet'][:30]:<30} {r['baseline']*100:>7.1f}% {r['scheme1']*100:>7.1f}% {r['scheme2']*100:>7.1f}% {r['best']:>10}")

    # 平均
    if results:
        avg_base = sum(r['baseline'] for r in results) / len(results)
        avg_s1 = sum(r['scheme1'] for r in results) / len(results)
        avg_s2 = sum(r['scheme2'] for r in results) / len(results)
        print("-"*70)
        print(f"{'Average':<30} {avg_base*100:>7.1f}% {avg_s1*100:>7.1f}% {avg_s2*100:>7.1f}%")

        best_avg = max(avg_base, avg_s1, avg_s2)
        if best_avg >= 1.0:
            print("\n[SUCCESS] 100% achieved!")
        else:
            print(f"\nBest average: {best_avg*100:.1f}%")


if __name__ == "__main__":
    main()
