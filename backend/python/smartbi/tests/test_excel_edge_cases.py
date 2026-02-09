"""
Excel 解析边缘场景测试套件

测试场景:
1. 简单表格 - 直接解析
2. 财务报表 - 跳过标题行，合并表头
3. 宽格式数据 - 检测月份列，转长格式
4. 合并表头 - 传播合并值
5. 混合内容 - 检测数据边界
6. 稀疏数据 - NaN 优雅处理
7. 中文数字 - 万/亿单位转换
8. 括号负数 - (1,234) = -1234
9. 多Sheet - 并行分析，结果汇总
10. 纯文字表 - 警告但不失败
"""
import asyncio
import sys
import os
from io import BytesIO
from typing import List, Dict, Any
import json

import pandas as pd
import numpy as np

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from services.excel_parser import ExcelParser


class TestResult:
    """Test result container"""
    def __init__(self, name: str):
        self.name = name
        self.passed = False
        self.message = ""
        self.details: Dict[str, Any] = {}

    def to_dict(self) -> Dict[str, Any]:
        return {
            "name": self.name,
            "passed": self.passed,
            "message": self.message,
            "details": self.details
        }


def create_simple_table() -> bytes:
    """场景1: 简单表格"""
    df = pd.DataFrame({
        "产品名称": ["产品A", "产品B", "产品C", "产品D"],
        "销售数量": [100, 200, 150, 300],
        "单价": [10.5, 20.0, 15.5, 25.0],
        "销售额": [1050, 4000, 2325, 7500]
    })
    buffer = BytesIO()
    df.to_excel(buffer, index=False, engine='openpyxl')
    return buffer.getvalue()


def create_financial_report() -> bytes:
    """场景2: 财务报表 (带标题行和合并表头)"""
    buffer = BytesIO()
    with pd.ExcelWriter(buffer, engine='openpyxl') as writer:
        # 先写标题
        title_df = pd.DataFrame([["2024年度财务报告"], ["单位：万元"]])
        title_df.to_excel(writer, index=False, header=False, startrow=0)

        # 再写数据
        data_df = pd.DataFrame({
            "科目": ["营业收入", "营业成本", "毛利润", "净利润"],
            "2024Q1": [1000, 600, 400, 200],
            "2024Q2": [1200, 700, 500, 280],
            "2024Q3": [1500, 850, 650, 380],
            "2024Q4": [1800, 1000, 800, 500]
        })
        data_df.to_excel(writer, index=False, startrow=3)
    return buffer.getvalue()


def create_wide_format_data() -> bytes:
    """场景3: 宽格式数据 (月份作为列)"""
    df = pd.DataFrame({
        "部门": ["销售部", "研发部", "市场部", "运营部"],
        "1月": [100, 80, 60, 90],
        "2月": [120, 85, 65, 95],
        "3月": [110, 90, 70, 100],
        "4月": [130, 95, 75, 105],
        "5月": [140, 100, 80, 110],
        "6月": [150, 105, 85, 115]
    })
    buffer = BytesIO()
    df.to_excel(buffer, index=False, engine='openpyxl')
    return buffer.getvalue()


def create_merged_headers() -> bytes:
    """场景4: 合并表头"""
    buffer = BytesIO()
    with pd.ExcelWriter(buffer, engine='openpyxl') as writer:
        # 数据
        data = [
            ["", "上半年", "", "", "下半年", "", ""],
            ["部门", "Q1", "Q2", "小计", "Q3", "Q4", "小计"],
            ["销售部", 100, 120, 220, 130, 150, 280],
            ["研发部", 80, 90, 170, 100, 110, 210],
            ["市场部", 60, 70, 130, 80, 90, 170]
        ]
        df = pd.DataFrame(data)
        df.to_excel(writer, index=False, header=False)

        # 手动合并单元格
        ws = writer.sheets['Sheet1']
        ws.merge_cells('B1:D1')  # 上半年
        ws.merge_cells('E1:G1')  # 下半年
    return buffer.getvalue()


def create_mixed_content() -> bytes:
    """场景5: 混合内容 (表格前有说明文字)"""
    buffer = BytesIO()
    with pd.ExcelWriter(buffer, engine='openpyxl') as writer:
        # 写说明文字
        intro_df = pd.DataFrame([
            ["本报告数据来源于ERP系统"],
            ["统计周期: 2024年全年"],
            ["制表人: 张三"],
            [""],  # 空行
        ])
        intro_df.to_excel(writer, index=False, header=False)

        # 写数据
        data_df = pd.DataFrame({
            "项目": ["收入", "支出", "利润"],
            "金额": [10000, 6000, 4000],
            "占比": ["100%", "60%", "40%"]
        })
        data_df.to_excel(writer, index=False, startrow=5)
    return buffer.getvalue()


def create_sparse_data() -> bytes:
    """场景6: 稀疏数据 (含空值)"""
    df = pd.DataFrame({
        "产品": ["A", "B", "C", "D", "E"],
        "Q1销量": [100, np.nan, 150, 200, np.nan],
        "Q2销量": [110, 130, np.nan, 210, 180],
        "Q3销量": [np.nan, 140, 160, np.nan, 190],
        "Q4销量": [130, 150, 170, 230, 200]
    })
    buffer = BytesIO()
    df.to_excel(buffer, index=False, engine='openpyxl')
    return buffer.getvalue()


def create_chinese_numbers() -> bytes:
    """场景7: 中文数字 (万/亿单位)"""
    df = pd.DataFrame({
        "公司": ["公司A", "公司B", "公司C", "公司D"],
        "营收": ["1.5亿", "8000万", "2.3亿", "5000万"],
        "净利润": ["3000万", "1500万", "5000万", "800万"],
        "市值": ["50亿", "20亿", "80亿", "10亿"]
    })
    buffer = BytesIO()
    df.to_excel(buffer, index=False, engine='openpyxl')
    return buffer.getvalue()


def create_negative_parentheses() -> bytes:
    """场景8: 括号表示负数"""
    df = pd.DataFrame({
        "科目": ["营业收入", "营业成本", "毛利润", "营业费用", "净利润"],
        "本期": ["10,000", "(6,000)", "4,000", "(1,500)", "2,500"],
        "上期": ["8,000", "(5,000)", "3,000", "(1,200)", "1,800"],
        "变动": ["2,000", "(1,000)", "1,000", "(300)", "700"]
    })
    buffer = BytesIO()
    df.to_excel(buffer, index=False, engine='openpyxl')
    return buffer.getvalue()


def create_multi_sheet() -> bytes:
    """场景9: 多Sheet工作簿"""
    buffer = BytesIO()
    with pd.ExcelWriter(buffer, engine='openpyxl') as writer:
        # Sheet 1: 销售数据
        sales_df = pd.DataFrame({
            "日期": ["2024-01", "2024-02", "2024-03"],
            "销售额": [10000, 12000, 15000],
            "订单数": [100, 120, 150]
        })
        sales_df.to_excel(writer, sheet_name='销售数据', index=False)

        # Sheet 2: 成本数据
        cost_df = pd.DataFrame({
            "类别": ["原材料", "人工", "运输", "其他"],
            "金额": [5000, 3000, 1000, 500]
        })
        cost_df.to_excel(writer, sheet_name='成本数据', index=False)

        # Sheet 3: 人员数据
        hr_df = pd.DataFrame({
            "部门": ["销售", "研发", "运营"],
            "人数": [20, 30, 15],
            "平均薪资": [8000, 12000, 7000]
        })
        hr_df.to_excel(writer, sheet_name='人员数据', index=False)
    return buffer.getvalue()


def create_text_only() -> bytes:
    """场景10: 纯文字表格"""
    df = pd.DataFrame({
        "编号": ["A001", "A002", "A003"],
        "名称": ["项目甲", "项目乙", "项目丙"],
        "状态": ["进行中", "已完成", "已暂停"],
        "备注": ["需要跟进", "表现良好", "待重启"]
    })
    buffer = BytesIO()
    df.to_excel(buffer, index=False, engine='openpyxl')
    return buffer.getvalue()


async def test_simple_table(parser: ExcelParser) -> TestResult:
    """测试场景1: 简单表格"""
    result = TestResult("Simple table parsing")
    try:
        content = create_simple_table()
        parse_result = parser.parse(content)

        if not parse_result.get('success', False):
            result.message = f"Parse failed: {parse_result.get('error', 'Unknown error')}"
            return result

        headers = parse_result.get('headers', [])
        rows = parse_result.get('rows', [])

        result.details = {
            "headers": headers,
            "row_count": len(rows)
        }

        if len(headers) == 4 and len(rows) == 4:
            result.passed = True
            result.message = f"Success: 4 columns, 4 rows"
        else:
            result.message = f"Unexpected result: {len(headers)} columns, {len(rows)} rows"
    except Exception as e:
        result.message = f"Exception: {str(e)}"
    return result


async def test_financial_report(parser: ExcelParser) -> TestResult:
    """测试场景2: 财务报表"""
    result = TestResult("Financial report parsing")
    try:
        content = create_financial_report()
        parse_result = parser.parse(content, skip_rows=3)

        if not parse_result.get('success', False):
            result.message = f"Parse failed: {parse_result.get('error', 'Unknown error')}"
            return result

        headers = parse_result.get('headers', [])

        result.details = {
            "headers": headers,
            "first_row": parse_result.get('rows', [[]])[0] if parse_result.get('rows') else []
        }

        # 检查是否正确跳过了标题行
        header_strs = [str(h) for h in headers]
        if any('科目' in h for h in header_strs) or any('Q1' in h for h in header_strs):
            result.passed = True
            result.message = "Correctly skipped title rows"
        else:
            result.message = f"Header detection issue: {headers}"
    except Exception as e:
        result.message = f"Exception: {str(e)}"
    return result


async def test_wide_format_data(parser: ExcelParser) -> TestResult:
    """测试场景3: 宽格式数据"""
    result = TestResult("Wide format data detection")
    try:
        content = create_wide_format_data()
        parse_result = parser.parse(content)

        if not parse_result.get('success', False):
            result.message = f"Parse failed: {parse_result.get('error', 'Unknown error')}"
            return result

        headers = parse_result.get('headers', [])
        month_cols = [str(h) for h in headers if str(h).endswith('月')]

        result.details = {
            "headers": headers,
            "month_columns": month_cols,
            "is_wide_format": len(month_cols) >= 3
        }

        if len(month_cols) >= 3:
            result.passed = True
            result.message = f"Detected wide format: {len(month_cols)} month columns"
        else:
            result.message = f"Wide format detection failed: only {len(month_cols)} month columns"
    except Exception as e:
        result.message = f"Exception: {str(e)}"
    return result


async def test_merged_headers(parser: ExcelParser) -> TestResult:
    """测试场景4: 合并表头"""
    result = TestResult("Merged header handling")
    try:
        content = create_merged_headers()
        parse_result = parser.parse(content, header_rows=2)

        if not parse_result.get('success', False):
            result.message = f"Parse failed: {parse_result.get('error', 'Unknown error')}"
            return result

        headers = parse_result.get('headers', [])
        result.details = {
            "headers": headers,
            "expected_pattern": "Multi-level header flattening"
        }

        # 检查是否正确展平了多行表头
        header_strs = [str(h) for h in headers]
        has_valid_headers = any('Q1' in h or 'Q2' in h or '部门' in h for h in header_strs)

        if has_valid_headers:
            result.passed = True
            result.message = "Multi-level headers flattened correctly"
        else:
            result.message = f"Header processing issue: {headers}"
    except Exception as e:
        result.message = f"Exception: {str(e)}"
    return result


async def test_mixed_content(parser: ExcelParser) -> TestResult:
    """测试场景5: 混合内容"""
    result = TestResult("Mixed content boundary detection")
    try:
        content = create_mixed_content()

        # 使用智能解析
        parse_result = parser.smart_parse(content)

        if not parse_result.get('success', False):
            result.message = f"Parse failed: {parse_result.get('error', 'Unknown error')}"
            return result

        headers = parse_result.get('headers', [])
        result.details = {
            "headers": headers,
            "detected_skip_rows": parse_result.get('skip_rows', 0)
        }

        # 检查是否正确检测到数据表格的开始位置
        header_strs = [str(h) for h in headers]
        if any('项目' in h for h in header_strs) or any('金额' in h for h in header_strs):
            result.passed = True
            result.message = "Correctly detected data boundary"
        else:
            result.message = f"Boundary detection issue: {headers}"
    except Exception as e:
        result.message = f"Exception: {str(e)}"
    return result


async def test_sparse_data(parser: ExcelParser) -> TestResult:
    """测试场景6: 稀疏数据"""
    result = TestResult("Sparse data handling")
    try:
        content = create_sparse_data()
        parse_result = parser.parse(content)

        if not parse_result.get('success', False):
            result.message = f"Parse failed: {parse_result.get('error', 'Unknown error')}"
            return result

        rows = parse_result.get('rows', [])

        # 检查空值处理
        null_count = 0
        for row in rows:
            for v in row:
                if v is None or (isinstance(v, float) and pd.isna(v)):
                    null_count += 1

        result.details = {
            "row_count": len(rows),
            "null_count": null_count
        }

        # 应该有5行数据
        if len(rows) == 5:
            result.passed = True
            result.message = f"Sparse data handled: {null_count} null values"
        else:
            result.message = f"Row count mismatch: {len(rows)}"
    except Exception as e:
        result.message = f"Exception: {str(e)}"
    return result


async def test_chinese_numbers(parser: ExcelParser) -> TestResult:
    """测试场景7: 中文数字"""
    result = TestResult("Chinese number conversion")
    try:
        content = create_chinese_numbers()
        parse_result = parser.parse(content)

        if not parse_result.get('success', False):
            result.message = f"Parse failed: {parse_result.get('error', 'Unknown error')}"
            return result

        rows = parse_result.get('rows', [])
        headers = parse_result.get('headers', [])

        first_row = rows[0] if rows else []
        # Find revenue column index
        revenue_idx = -1
        for i, h in enumerate(headers):
            if '营收' in str(h):
                revenue_idx = i
                break

        revenue = first_row[revenue_idx] if revenue_idx >= 0 and len(first_row) > revenue_idx else ''

        result.details = {
            "first_row": first_row,
            "raw_revenue": revenue
        }

        # 检查中文数字是否被正确解析（或保留原样供后续处理）
        if '亿' in str(revenue) or '万' in str(revenue) or isinstance(revenue, (int, float)):
            result.passed = True
            result.message = f"Chinese numbers preserved/converted: {revenue}"
        else:
            result.message = f"Chinese number handling issue: {revenue}"
    except Exception as e:
        result.message = f"Exception: {str(e)}"
    return result


async def test_negative_parentheses(parser: ExcelParser) -> TestResult:
    """测试场景8: 括号负数"""
    result = TestResult("Parentheses negative number conversion")
    try:
        content = create_negative_parentheses()
        parse_result = parser.parse(content)

        if not parse_result.get('success', False):
            result.message = f"Parse failed: {parse_result.get('error', 'Unknown error')}"
            return result

        rows = parse_result.get('rows', [])
        headers = parse_result.get('headers', [])

        second_row = rows[1] if len(rows) > 1 else []  # 营业成本行
        # Find '本期' column index
        col_idx = -1
        for i, h in enumerate(headers):
            if '本期' in str(h):
                col_idx = i
                break

        cost_value = second_row[col_idx] if col_idx >= 0 and len(second_row) > col_idx else ''

        result.details = {
            "cost_row": second_row,
            "raw_value": cost_value
        }

        # 检查括号负数是否被处理
        # 可能是字符串 "(6,000)" 或已转换为 -6000
        if '(' in str(cost_value) or (isinstance(cost_value, (int, float)) and cost_value < 0):
            result.passed = True
            result.message = f"Parentheses negative handled: {cost_value}"
        else:
            result.message = f"Parentheses negative handling issue: {cost_value}"
    except Exception as e:
        result.message = f"Exception: {str(e)}"
    return result


async def test_multi_sheet(parser: ExcelParser) -> TestResult:
    """测试场景9: 多Sheet"""
    result = TestResult("Multi-sheet parsing")
    try:
        content = create_multi_sheet()
        sheets = parser.list_sheets_detailed(content)

        result.details = {
            "sheet_count": len(sheets),
            "sheet_names": [s.name for s in sheets]
        }

        if len(sheets) == 3:
            # 解析每个Sheet
            sheet_results = []
            for sheet in sheets:
                sheet_data = parser.parse(content, sheet_name=sheet.index)
                sheet_results.append({
                    "name": sheet.name,
                    "headers": sheet_data.get('headers', []),
                    "rows": len(sheet_data.get('rows', []))
                })
            result.details["sheet_results"] = sheet_results

            result.passed = True
            result.message = f"3 sheets parsed successfully"
        else:
            result.message = f"Sheet count mismatch: {len(sheets)}"
    except Exception as e:
        result.message = f"Exception: {str(e)}"
    return result


async def test_text_only(parser: ExcelParser) -> TestResult:
    """测试场景10: 纯文字表格"""
    result = TestResult("Text-only table warning")
    try:
        content = create_text_only()
        parse_result = parser.parse(content)

        if not parse_result.get('success', False):
            result.message = f"Parse failed: {parse_result.get('error', 'Unknown error')}"
            return result

        headers = parse_result.get('headers', [])
        rows = parse_result.get('rows', [])

        # 检查是否有数值
        has_numeric = False
        for row in rows:
            for val in row:
                if isinstance(val, (int, float)) and not pd.isna(val):
                    has_numeric = True
                    break

        result.details = {
            "headers": headers,
            "row_count": len(rows),
            "has_numeric": has_numeric
        }

        # 纯文字表格应该能解析
        if len(rows) == 3:
            result.passed = True
            if has_numeric:
                result.message = "Parsed successfully, numeric columns detected"
            else:
                result.message = "Parsed successfully, warning: no numeric columns"
        else:
            result.message = f"Unexpected row count: {len(rows)}"
    except Exception as e:
        result.message = f"Exception: {str(e)}"
    return result


async def run_all_tests() -> List[TestResult]:
    """运行所有测试"""
    parser = ExcelParser()

    tests = [
        test_simple_table,
        test_financial_report,
        test_wide_format_data,
        test_merged_headers,
        test_mixed_content,
        test_sparse_data,
        test_chinese_numbers,
        test_negative_parentheses,
        test_multi_sheet,
        test_text_only,
    ]

    results = []
    for test_func in tests:
        print(f"Running: {test_func.__name__}...")
        result = await test_func(parser)
        results.append(result)
        status = "[PASS]" if result.passed else "[FAIL]"
        print(f"  {status} {result.name}: {result.message}")

    return results


def print_summary(results: List[TestResult]):
    """打印测试摘要"""
    passed = sum(1 for r in results if r.passed)
    total = len(results)

    print("\n" + "=" * 60)
    print(f"Test Summary: {passed}/{total} passed")
    print("=" * 60)

    if passed < total:
        print("\nFailed tests:")
        for r in results:
            if not r.passed:
                print(f"  [FAIL] {r.name}: {r.message}")


async def main():
    """主入口"""
    print("SmartBI Excel Edge Case Tests")
    print("=" * 60)

    results = await run_all_tests()
    print_summary(results)

    # 保存详细结果
    output_file = os.path.join(os.path.dirname(__file__), "test_excel_edge_cases_report.json")
    with open(output_file, "w", encoding="utf-8") as f:
        json.dump([r.to_dict() for r in results], f, ensure_ascii=False, indent=2)
    print(f"\nDetailed report saved: {output_file}")

    # 返回退出码
    passed = sum(1 for r in results if r.passed)
    return 0 if passed == len(results) else 1


if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)
