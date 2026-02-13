# -*- coding: utf-8 -*-
"""
测试：规则 + LLM 选择器方案

目标：
1. 定义多种表头识别规则 (A-E)
2. 用最便宜的 LLM（dashscope qwen-turbo）选择合适的规则
3. 验证效果，目标 100% 成功率
"""
import pandas as pd
import json
import os
import sys
from typing import List, Tuple, Dict, Optional, Any

# 添加项目路径
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# ============================================================
# 规则定义
# ============================================================

def rule_A_single_row(rows: List[List], data_start: int, num_cols: int, **kwargs) -> List[str]:
    """
    规则A: 单行表头
    适用场景：简单表格，数据前一行就是表头
    """
    if data_start <= 0:
        return [f"Col_{i}" for i in range(num_cols)]

    header_row_idx = data_start - 1
    if header_row_idx < len(rows):
        row = rows[header_row_idx]
        return [str(v) if pd.notna(v) else f"Col_{i}" for i, v in enumerate(row[:num_cols])]
    return [f"Col_{i}" for i in range(num_cols)]


def rule_B_multirow_merge_30(rows: List[List], data_start: int, num_cols: int, **kwargs) -> List[str]:
    """
    规则B: 多行合并（填充率>=30%）
    适用场景：多行表头，每行都有较多内容
    """
    return _multirow_merge(rows, data_start, num_cols, min_fill_rate=0.3, max_check_rows=4)


def rule_C_skip_title_merge_20(rows: List[List], data_start: int, num_cols: int, **kwargs) -> List[str]:
    """
    规则C: 跳过标题后合并（填充率>=20%）
    适用场景：有标题行的利润表、财务报表
    """
    return _multirow_merge(rows, data_start, num_cols, min_fill_rate=0.2, max_check_rows=6)


def rule_D_explicit_rows(rows: List[List], data_start: int, num_cols: int,
                         header_rows_indices: List[int] = None, **kwargs) -> List[str]:
    """
    规则D: 显式指定表头行
    适用场景：LLM 明确指定哪些行是表头
    """
    if not header_rows_indices:
        return [f"Col_{i}" for i in range(num_cols)]

    header_rows = []
    for i in header_rows_indices:
        if i < len(rows):
            header_rows.append((i, rows[i]))

    return _merge_header_rows(header_rows, num_cols)


def rule_E_first_non_empty_row(rows: List[List], data_start: int, num_cols: int, **kwargs) -> List[str]:
    """
    规则E: 第一个非空行作为表头
    适用场景：没有标题行的简单表格
    """
    for i, row in enumerate(rows):
        non_empty = sum(1 for v in row if pd.notna(v))
        if non_empty > num_cols * 0.5:  # 超过一半列有值
            return [str(v) if pd.notna(v) else f"Col_{i}" for i, v in enumerate(row[:num_cols])]
    return [f"Col_{i}" for i in range(num_cols)]


def rule_F_skip_n_rows(rows: List[List], data_start: int, num_cols: int,
                       skip_rows: int = 0, **kwargs) -> List[str]:
    """
    规则F: 跳过指定行数后，取下一行作为表头
    适用场景：LLM 指定需要跳过的行数
    """
    header_row_idx = skip_rows
    if header_row_idx < len(rows):
        row = rows[header_row_idx]
        return [str(v) if pd.notna(v) else f"Col_{i}" for i, v in enumerate(row[:num_cols])]
    return [f"Col_{i}" for i in range(num_cols)]


def rule_G_merge_with_date_cleanup(rows: List[List], data_start: int, num_cols: int, **kwargs) -> List[str]:
    """
    规则G: 多行合并 + 日期格式清理
    适用场景：表头包含日期的财务报表
    """
    headers = _multirow_merge(rows, data_start, num_cols, min_fill_rate=0.2, max_check_rows=6)

    # 清理日期格式：2025-01-01 00:00:00 -> 1月 或 2025-01
    cleaned = []
    for h in headers:
        if h and '00:00:00' in str(h):
            # 提取月份
            try:
                parts = str(h).split('_')
                new_parts = []
                for p in parts:
                    if '00:00:00' in p:
                        # 2025-01-01 00:00:00 -> 1月
                        date_part = p.replace(' 00:00:00', '').strip()
                        if '-' in date_part:
                            month = int(date_part.split('-')[1])
                            p = f"{month}月"
                    new_parts.append(p)
                h = '_'.join(new_parts)
            except:
                pass
        cleaned.append(h)
    return cleaned


# ============================================================
# 辅助函数
# ============================================================

def _multirow_merge(rows: List[List], data_start: int, num_cols: int,
                    min_fill_rate: float = 0.2, max_check_rows: int = 6) -> List[str]:
    """多行表头合并的通用实现"""
    if data_start <= 0:
        return [f"Col_{i}" for i in range(num_cols)]

    header_rows = []
    for i in range(max(0, data_start - max_check_rows), data_start):
        if i >= len(rows):
            continue
        row = rows[i]

        # 计算填充率
        non_empty = sum(1 for v in row if pd.notna(v))
        fill_rate = non_empty / len(row) if len(row) > 0 else 0

        if fill_rate < min_fill_rate:
            continue

        # 计算数值率
        numeric_count = sum(1 for v in row if pd.notna(v) and isinstance(v, (int, float)) and not isinstance(v, bool))
        numeric_rate = numeric_count / non_empty if non_empty > 0 else 0

        if numeric_rate < 0.5:
            header_rows.append((i, row))

    return _merge_header_rows(header_rows, num_cols)


def _merge_header_rows(header_rows: List[Tuple[int, List]], num_cols: int) -> List[str]:
    """合并表头行"""
    if not header_rows:
        return [f"Col_{i}" for i in range(num_cols)]

    if len(header_rows) == 1:
        row = header_rows[0][1]
        return [str(v) if pd.notna(v) else f"Col_{i}" for i, v in enumerate(row[:num_cols])]

    # 多行合并
    merged = []
    for col_idx in range(num_cols):
        parts = []
        last_value = None
        for row_idx, row in header_rows:
            val = row[col_idx] if col_idx < len(row) else None
            if pd.notna(val):
                val_str = str(val).strip()
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


def detect_data_start_rule(rows: List[List]) -> int:
    """规则方法检测数据起始行"""
    for i, row in enumerate(rows):
        non_empty = sum(1 for v in row if pd.notna(v))
        total = len(row)
        fill_rate = non_empty / total if total > 0 else 0

        numeric_count = sum(1 for v in row if pd.notna(v) and isinstance(v, (int, float)) and not isinstance(v, bool))
        numeric_rate = numeric_count / non_empty if non_empty > 0 else 0

        if fill_rate > 0.5 and numeric_rate > 0.3:
            return i

    return 0


# ============================================================
# 规则注册表
# ============================================================

RULES = {
    "A": {
        "name": "单行表头",
        "desc": "取数据前一行作为列名，适用于简单表格",
        "func": rule_A_single_row
    },
    "B": {
        "name": "多行合并(30%)",
        "desc": "合并填充率>=30%的多行表头，适用于标准多行表头",
        "func": rule_B_multirow_merge_30
    },
    "C": {
        "name": "跳过标题后合并(20%)",
        "desc": "跳过只有少数列有值的标题行，合并剩余表头行，适用于有标题的财务报表",
        "func": rule_C_skip_title_merge_20
    },
    "D": {
        "name": "显式指定表头行",
        "desc": "由LLM明确指定哪些行是表头，适用于复杂结构",
        "func": rule_D_explicit_rows
    },
    "E": {
        "name": "第一个非空行",
        "desc": "取第一个超过50%列有值的行作为表头",
        "func": rule_E_first_non_empty_row
    },
    "F": {
        "name": "跳过N行后取表头",
        "desc": "跳过指定行数后取下一行作为表头",
        "func": rule_F_skip_n_rows
    },
    "G": {
        "name": "多行合并+日期清理",
        "desc": "合并多行表头并清理日期格式，适用于包含日期的财务报表",
        "func": rule_G_merge_with_date_cleanup
    }
}


# ============================================================
# LLM 选择器
# ============================================================

def load_api_key() -> Optional[str]:
    """从环境变量或 .env 文件加载 API Key"""
    # 1. 先检查环境变量
    api_key = os.environ.get("DASHSCOPE_API_KEY") or os.environ.get("LLM_API_KEY")
    if api_key:
        return api_key

    # 2. 尝试从 .env 文件读取
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


def call_dashscope_llm(prompt: str, model: str = "qwen-turbo") -> Optional[str]:
    """调用阿里云 dashscope LLM"""
    try:
        from dashscope import Generation
        import dashscope

        api_key = load_api_key()
        if not api_key:
            print("Warning: No API key found (DASHSCOPE_API_KEY or LLM_API_KEY)")
            return None

        dashscope.api_key = api_key

        response = Generation.call(
            model=model,
            prompt=prompt,
            result_format='message'
        )

        if response.status_code == 200:
            return response.output.choices[0].message.content
        else:
            print(f"LLM 调用失败: {response.code} - {response.message}")
            return None

    except ImportError:
        print("警告: 未安装 dashscope，请运行: pip install dashscope")
        return None
    except Exception as e:
        print(f"LLM 调用异常: {e}")
        return None


def build_llm_prompt(rows: List[List], max_preview_rows: int = 12) -> str:
    """构建 LLM 选择器的 prompt"""
    preview_lines = []
    for i, row in enumerate(rows[:max_preview_rows]):
        row_preview = [str(v)[:20] if pd.notna(v) else "(空)" for v in row[:10]]
        preview_lines.append(f"Row {i}: {' | '.join(row_preview)}")

    preview_text = "\n".join(preview_lines)

    # 构建规则说明
    rules_desc = "\n".join([f"  {k}: {v['name']} - {v['desc']}" for k, v in RULES.items()])

    prompt = f"""分析这个Excel表格的结构，选择最合适的表头处理规则。

数据预览（前{max_preview_rows}行，前10列）：
{preview_text}

可选规则：
{rules_desc}

请分析：
1. 数据从第几行开始？（第一行主要是数值的行）
2. 表头有几行？具体是哪些行？
3. 是否有需要跳过的标题行？

返回JSON格式（只返回JSON，不要其他内容）：
{{
    "data_start_row": <数字，数据起始行号，0-indexed>,
    "header_rows": [<表头行号列表，0-indexed>],
    "rule": "<规则字母: A/B/C/D/E/F/G>",
    "skip_rows": <如果选择规则F，指定跳过的行数>,
    "reason": "<简短说明选择原因>"
}}"""

    return prompt


def parse_llm_response(response: str) -> Optional[Dict]:
    """解析 LLM 响应"""
    if not response:
        return None

    try:
        # 提取 JSON
        text = response
        if "```json" in text:
            text = text.split("```json")[1].split("```")[0]
        elif "```" in text:
            text = text.split("```")[1].split("```")[0]

        text = text.strip()

        # 尝试找到 JSON 对象
        start = text.find('{')
        end = text.rfind('}') + 1
        if start >= 0 and end > start:
            text = text[start:end]

        return json.loads(text)
    except json.JSONDecodeError as e:
        print(f"JSON 解析失败: {e}")
        print(f"原始响应: {response[:300]}...")
        return None


def llm_select_and_apply_rule(rows: List[List], num_cols: int, verbose: bool = True) -> Tuple[str, int, List[str]]:
    """
    使用 LLM 选择最合适的规则并返回结果

    Returns:
        (rule_name, data_start_row, merged_headers)
    """
    prompt = build_llm_prompt(rows)

    if verbose:
        print("\n[LLM Prompt]:")
        print(prompt[:600] + "..." if len(prompt) > 600 else prompt)

    response = call_dashscope_llm(prompt)

    if not response:
        print("\n[LLM 调用失败，使用默认规则 G]")
        data_start = detect_data_start_rule(rows)
        headers = RULES["G"]["func"](rows, data_start, num_cols)
        return "G (fallback)", data_start, headers

    if verbose:
        print(f"\n[LLM Response]:\n{response}")

    result = parse_llm_response(response)

    if not result:
        print("\n[LLM 响应解析失败，使用默认规则 G]")
        data_start = detect_data_start_rule(rows)
        headers = RULES["G"]["func"](rows, data_start, num_cols)
        return "G (fallback)", data_start, headers

    rule = result.get("rule", "G")
    data_start = result.get("data_start_row", detect_data_start_rule(rows))
    header_rows_indices = result.get("header_rows", [])
    skip_rows = result.get("skip_rows", 0)
    reason = result.get("reason", "")

    if verbose:
        print(f"\n[LLM 选择]: 规则 {rule} ({RULES.get(rule, {}).get('name', 'unknown')})")
        print(f"[数据起始行]: Row {data_start}")
        print(f"[表头行]: {header_rows_indices}")
        print(f"[原因]: {reason}")

    # 执行选中的规则
    if rule in RULES:
        headers = RULES[rule]["func"](
            rows, data_start, num_cols,
            header_rows_indices=header_rows_indices,
            skip_rows=skip_rows
        )
    else:
        headers = RULES["G"]["func"](rows, data_start, num_cols)

    return rule, data_start, headers


# ============================================================
# 测试函数
# ============================================================

def evaluate_headers(headers: List[str]) -> Tuple[float, int, int]:
    """评估表头质量"""
    col_x_count = sum(1 for name in headers if name.startswith('Col_'))
    meaningful_count = len(headers) - col_x_count
    success_rate = meaningful_count / len(headers) if headers else 0
    return success_rate, meaningful_count, col_x_count


def test_all_rules(rows: List[List], num_cols: int) -> Dict[str, Dict]:
    """测试所有规则，返回每个规则的结果"""
    data_start = detect_data_start_rule(rows)
    results = {}

    for rule_key, rule_info in RULES.items():
        try:
            headers = rule_info["func"](rows, data_start, num_cols)
            success_rate, meaningful, col_x = evaluate_headers(headers)
            results[rule_key] = {
                "name": rule_info["name"],
                "headers": headers[:10],
                "success_rate": success_rate,
                "meaningful": meaningful,
                "col_x": col_x
            }
        except Exception as e:
            results[rule_key] = {
                "name": rule_info["name"],
                "error": str(e),
                "success_rate": 0
            }

    return results


def test_sheet(excel_file: str, sheet_name: str, use_llm: bool = True, verbose: bool = True):
    """测试单个 sheet"""
    print(f"\n{'='*70}")
    print(f"Sheet: {sheet_name}")
    print('='*70)

    # 读取原始数据
    df_raw = pd.read_excel(excel_file, sheet_name=sheet_name, header=None, nrows=30)
    rows = df_raw.values.tolist()
    num_cols = len(df_raw.columns)

    # 显示原始数据预览
    if verbose:
        print(f"\n原始数据预览 (前10行):")
        for i in range(min(10, len(rows))):
            row_preview = [str(v)[:18] if pd.notna(v) else "(空)" for v in rows[i][:8]]
            print(f"  Row {i}: {row_preview}")

    # 测试所有规则
    print(f"\n--- 所有规则测试结果 ---")
    all_rules_results = test_all_rules(rows, num_cols)
    best_rule = None
    best_rate = 0

    for rule_key, result in all_rules_results.items():
        rate = result.get("success_rate", 0)
        status = "[*]" if rate >= 0.95 else ("[o]" if rate >= 0.7 else "[x]")
        print(f"  Rule {rule_key} ({result['name'][:12]:<12}): {rate*100:5.1f}% {status}")
        if rate > best_rate:
            best_rate = rate
            best_rule = rule_key

    print(f"\n  最佳规则: {best_rule} ({best_rate*100:.1f}%)")

    # 使用 LLM 选择
    if use_llm:
        print(f"\n--- LLM 选择器 ---")
        rule, data_start, headers = llm_select_and_apply_rule(rows, num_cols, verbose=verbose)
        success_rate, meaningful, col_x = evaluate_headers(headers)
    else:
        # 使用最佳规则
        rule = best_rule
        data_start = detect_data_start_rule(rows)
        headers = RULES[best_rule]["func"](rows, data_start, num_cols)
        success_rate, meaningful, col_x = evaluate_headers(headers)

    print(f"\n--- 最终结果 ---")
    print(f"使用规则: {rule}")
    print(f"数据起始行: Row {data_start}")
    print(f"\n合并后的列名 (前10列):")
    for i, name in enumerate(headers[:10]):
        print(f"  Col {i}: {name}")

    print(f"\n评估:")
    print(f"  总列数: {len(headers)}")
    print(f"  有意义列名: {meaningful}")
    print(f"  Col_X 列名: {col_x}")
    print(f"  成功率: {success_rate*100:.1f}%")

    return {
        'sheet': sheet_name,
        'rule': rule,
        'data_start': data_start,
        'success_rate': success_rate,
        'headers': headers[:10],
        'best_rule_without_llm': best_rule,
        'best_rate_without_llm': best_rate
    }


def main():
    excel_file = "Test.xlsx"

    if not os.path.exists(excel_file):
        print(f"文件不存在: {excel_file}")
        return

    # 检查 API Key
    api_key = load_api_key()
    has_api_key = bool(api_key)
    print(f"API Key: {'Found' if has_api_key else 'Not found'}")

    xl = pd.ExcelFile(excel_file)

    print("="*70)
    print("表头识别测试：规则 + LLM 选择器")
    print("="*70)
    print(f"\n可用规则:")
    for k, v in RULES.items():
        print(f"  {k}: {v['name']} - {v['desc']}")

    # 测试模式
    use_llm = has_api_key
    if not use_llm:
        print("\n[!] 未设置 DASHSCOPE_API_KEY，将只测试规则（不使用 LLM）")
        print("    设置方法: export DASHSCOPE_API_KEY=your_key")

    results = []
    for sheet_name in xl.sheet_names[:5]:  # 测试前5个 sheet
        try:
            result = test_sheet(excel_file, sheet_name, use_llm=use_llm, verbose=True)
            results.append(result)
        except Exception as e:
            print(f"\n测试失败: {e}")
            import traceback
            traceback.print_exc()
            results.append({
                'sheet': sheet_name,
                'success_rate': 0,
                'error': str(e)
            })

    # 汇总
    print("\n" + "="*70)
    print("测试汇总")
    print("="*70)
    print(f"{'Sheet':<30} {'成功率':>8} {'状态':>8} {'使用规则':>10}")
    print("-"*70)

    for r in results:
        rate = r.get('success_rate', 0)
        status = "OK" if rate >= 0.95 else ("GOOD" if rate >= 0.7 else "FAIL")
        rule = r.get('rule', 'N/A')
        print(f"{r['sheet'][:30]:<30} {rate*100:>7.1f}% {status:>8} {rule:>10}")

    avg_success = sum(r.get('success_rate', 0) for r in results) / len(results) if results else 0
    print("-"*70)
    print(f"{'平均成功率':<30} {avg_success*100:>7.1f}%")

    # 目标检查
    if avg_success >= 1.0:
        print("\n[SUCCESS] 100% success rate achieved!")
    elif avg_success >= 0.95:
        print(f"\n[GOOD] Close to target: {avg_success*100:.1f}% (target 100%)")
    else:
        print(f"\n[NEED IMPROVEMENT] {avg_success*100:.1f}% (target 100%)")


if __name__ == "__main__":
    main()
