"""
多Sheet分析测试套件

测试场景:
1. 多Sheet并行解析
2. Sheet间数据关联检测
3. 结果汇总
4. 性能测试
"""
import asyncio
import sys
import os
import time
from io import BytesIO
from typing import List, Dict, Any
import json

import pandas as pd
import numpy as np

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from services.excel_parser import ExcelParser


class MultiSheetTestResult:
    """多Sheet测试结果"""
    def __init__(self, name: str):
        self.name = name
        self.passed = False
        self.message = ""
        self.details: Dict[str, Any] = {}
        self.duration_ms: float = 0

    def to_dict(self) -> Dict[str, Any]:
        return {
            "name": self.name,
            "passed": self.passed,
            "message": self.message,
            "details": self.details,
            "duration_ms": self.duration_ms
        }


def create_comprehensive_workbook() -> bytes:
    """创建包含多种数据类型的综合工作簿"""
    buffer = BytesIO()
    with pd.ExcelWriter(buffer, engine='openpyxl') as writer:
        # Sheet 1: 销售概览
        sales_overview = pd.DataFrame({
            "Region": ["East", "North", "South", "West", "Central"],
            "Q1_Sales": [1000, 800, 900, 600, 500],
            "Q2_Sales": [1200, 850, 950, 650, 550],
            "Q3_Sales": [1100, 900, 1000, 700, 600],
            "Q4_Sales": [1300, 950, 1100, 750, 650]
        })
        sales_overview.to_excel(writer, sheet_name='Sales', index=False)

        # Sheet 2: 产品明细
        products = pd.DataFrame({
            "ProductID": [f"P{i:03d}" for i in range(1, 21)],
            "ProductName": [f"Product{chr(65+i%26)}" for i in range(20)],
            "Category": ["Electronics", "Home", "Food", "Clothing", "Other"] * 4,
            "Price": np.random.randint(50, 500, 20),
            "Stock": np.random.randint(10, 200, 20)
        })
        products.to_excel(writer, sheet_name='Products', index=False)

        # Sheet 3: 客户分析
        customers = pd.DataFrame({
            "CustomerID": [f"C{i:04d}" for i in range(1, 11)],
            "CustomerName": [f"Customer{i}" for i in range(1, 11)],
            "Tier": ["VIP", "Premium", "Standard"] * 3 + ["VIP"],
            "TotalSpend": np.random.randint(10000, 100000, 10),
            "LastOrder": pd.date_range("2024-01-01", periods=10, freq="15D").strftime("%Y-%m-%d")
        })
        customers.to_excel(writer, sheet_name='Customers', index=False)

        # Sheet 4: 财务报表
        finance = pd.DataFrame({
            "Account": ["Revenue", "COGS", "Gross Profit", "SG&A", "Admin", "R&D", "Operating Profit", "Tax", "Net Profit"],
            "Current": [10000, 6000, 4000, 1000, 800, 500, 1700, 425, 1275],
            "Previous": [8000, 5000, 3000, 800, 700, 400, 1100, 275, 825],
            "YoY_Change": ["25%", "20%", "33%", "25%", "14%", "25%", "55%", "55%", "55%"]
        })
        finance.to_excel(writer, sheet_name='Finance', index=False)

        # Sheet 5: 时间趋势
        months = pd.date_range("2024-01-01", periods=12, freq="M").strftime("%Y-%m")
        trend = pd.DataFrame({
            "Month": months,
            "Orders": [100 + i * 10 + np.random.randint(-10, 10) for i in range(12)],
            "Revenue": [50000 + i * 5000 + np.random.randint(-2000, 2000) for i in range(12)],
            "AOV": [480 + i * 5 + np.random.randint(-20, 20) for i in range(12)]
        })
        trend.to_excel(writer, sheet_name='Trends', index=False)

    return buffer.getvalue()


def create_related_sheets_workbook() -> bytes:
    """创建有关联关系的多Sheet工作簿"""
    buffer = BytesIO()
    with pd.ExcelWriter(buffer, engine='openpyxl') as writer:
        # Sheet 1: 订单主表
        orders = pd.DataFrame({
            "OrderID": [f"ORD{i:04d}" for i in range(1, 11)],
            "CustomerID": [f"C{i%5+1:04d}" for i in range(1, 11)],
            "OrderDate": pd.date_range("2024-01-01", periods=10, freq="3D").strftime("%Y-%m-%d"),
            "TotalAmount": np.random.randint(1000, 10000, 10)
        })
        orders.to_excel(writer, sheet_name='Orders', index=False)

        # Sheet 2: 订单明细
        order_details = []
        for order_id in range(1, 11):
            for item in range(1, np.random.randint(2, 5)):
                order_details.append({
                    "OrderID": f"ORD{order_id:04d}",
                    "ProductID": f"P{np.random.randint(1, 20):03d}",
                    "Quantity": np.random.randint(1, 10),
                    "UnitPrice": np.random.randint(50, 500)
                })
        details_df = pd.DataFrame(order_details)
        details_df.to_excel(writer, sheet_name='OrderDetails', index=False)

        # Sheet 3: 客户表
        customers = pd.DataFrame({
            "CustomerID": [f"C{i:04d}" for i in range(1, 6)],
            "CustomerName": [f"Customer{i}" for i in range(1, 6)],
            "Phone": [f"138{i:08d}" for i in range(1, 6)]
        })
        customers.to_excel(writer, sheet_name='Customers', index=False)

    return buffer.getvalue()


async def test_parallel_parsing(parser: ExcelParser) -> MultiSheetTestResult:
    """测试多Sheet并行解析"""
    result = MultiSheetTestResult("Multi-sheet parallel parsing")
    try:
        content = create_comprehensive_workbook()

        start_time = time.time()
        sheets = parser.list_sheets_detailed(content)

        # 解析所有Sheet
        parsed_results = []
        for sheet in sheets:
            sheet_data = parser.parse(content, sheet_name=sheet.index)
            parsed_results.append((sheet.name, sheet_data))

        end_time = time.time()
        result.duration_ms = (end_time - start_time) * 1000

        sheet_summaries = []
        for name, data in parsed_results:
            sheet_summaries.append({
                "name": name,
                "columns": len(data.get('headers', [])),
                "rows": len(data.get('rows', []))
            })

        result.details = {
            "sheet_count": len(sheets),
            "sheets": sheet_summaries,
            "duration_ms": result.duration_ms
        }

        if len(sheets) == 5:
            result.passed = True
            result.message = f"5 sheets parsed in {result.duration_ms:.2f}ms"
        else:
            result.message = f"Sheet count mismatch: {len(sheets)}"
    except Exception as e:
        result.message = f"Exception: {str(e)}"
    return result


async def test_sheet_relation_detection(parser: ExcelParser) -> MultiSheetTestResult:
    """测试Sheet间关联检测"""
    result = MultiSheetTestResult("Sheet relation detection")
    try:
        content = create_related_sheets_workbook()
        sheets = parser.list_sheets_detailed(content)

        # 解析所有Sheet
        sheet_data = {}
        for sheet in sheets:
            data = parser.parse(content, sheet_name=sheet.index)
            sheet_data[sheet.name] = {
                "headers": data.get('headers', []),
                "rows": data.get('rows', [])
            }

        # 检测可能的关联字段
        relations = []

        # 查找相同的列名
        for name1, data1 in sheet_data.items():
            for name2, data2 in sheet_data.items():
                if name1 >= name2:
                    continue
                common_cols = set(data1['headers']) & set(data2['headers'])
                if common_cols:
                    relations.append({
                        "sheet1": name1,
                        "sheet2": name2,
                        "common_columns": list(common_cols)
                    })

        result.details = {
            "sheet_count": len(sheets),
            "relations_found": len(relations),
            "relations": relations
        }

        # 预期检测到 OrderID 和 CustomerID 的关联
        if len(relations) > 0:
            result.passed = True
            result.message = f"Found {len(relations)} relations"
        else:
            result.message = "No relations found"
    except Exception as e:
        result.message = f"Exception: {str(e)}"
    return result


async def test_aggregated_summary(parser: ExcelParser) -> MultiSheetTestResult:
    """测试汇总统计"""
    result = MultiSheetTestResult("Multi-sheet aggregated summary")
    try:
        content = create_comprehensive_workbook()
        sheets = parser.list_sheets_detailed(content)

        # 汇总各Sheet的统计信息
        total_rows = 0
        total_columns = 0
        numeric_columns = 0
        text_columns = 0

        for sheet in sheets:
            data = parser.parse(content, sheet_name=sheet.index)
            rows = data.get('rows', [])
            headers = data.get('headers', [])

            total_rows += len(rows)
            total_columns += len(headers)

            # 统计数值列和文本列
            if rows:
                for idx, header in enumerate(headers):
                    first_val = rows[0][idx] if idx < len(rows[0]) else None
                    if isinstance(first_val, (int, float)) and not pd.isna(first_val):
                        numeric_columns += 1
                    else:
                        text_columns += 1

        result.details = {
            "sheet_count": len(sheets),
            "total_rows": total_rows,
            "total_columns": total_columns,
            "numeric_columns": numeric_columns,
            "text_columns": text_columns
        }

        if total_rows > 0 and total_columns > 0:
            result.passed = True
            result.message = f"Summary: {len(sheets)} sheets, {total_rows} rows, {total_columns} columns"
        else:
            result.message = "Summary data abnormal"
    except Exception as e:
        result.message = f"Exception: {str(e)}"
    return result


async def test_sheet_preview(parser: ExcelParser) -> MultiSheetTestResult:
    """测试Sheet预览功能"""
    result = MultiSheetTestResult("Sheet preview")
    try:
        content = create_comprehensive_workbook()
        sheets = parser.list_sheets_detailed(content)

        preview_info = []
        for sheet in sheets:
            preview_info.append({
                "index": sheet.index,
                "name": sheet.name,
                "row_count": sheet.row_count,
                "column_count": sheet.column_count,
                "is_empty": sheet.is_empty,
                "preview_headers": sheet.preview_headers[:5] if sheet.preview_headers else []
            })

        result.details = {
            "sheet_count": len(sheets),
            "previews": preview_info
        }

        # 验证预览信息完整
        non_empty = [p for p in preview_info if not p['is_empty']]
        if len(non_empty) == 5:
            result.passed = True
            result.message = f"All 5 sheets have preview info"
        else:
            result.message = f"Only {len(non_empty)}/5 sheets have preview"
    except Exception as e:
        result.message = f"Exception: {str(e)}"
    return result


async def test_performance_benchmark(parser: ExcelParser) -> MultiSheetTestResult:
    """性能基准测试"""
    result = MultiSheetTestResult("Performance benchmark")
    try:
        content = create_comprehensive_workbook()

        # 多次解析取平均时间
        iterations = 5
        times = []

        for _ in range(iterations):
            start = time.time()
            sheets = parser.list_sheets_detailed(content)
            for sheet in sheets:
                parser.parse(content, sheet_name=sheet.index)
            end = time.time()
            times.append((end - start) * 1000)

        avg_time = sum(times) / len(times)
        min_time = min(times)
        max_time = max(times)

        result.details = {
            "iterations": iterations,
            "avg_ms": avg_time,
            "min_ms": min_time,
            "max_ms": max_time,
            "all_times": times
        }

        # 性能基准: 5个Sheet应该在2秒内完成
        if avg_time < 2000:
            result.passed = True
            result.message = f"Avg: {avg_time:.2f}ms (range: {min_time:.2f}-{max_time:.2f}ms)"
        else:
            result.message = f"Performance issue: avg {avg_time:.2f}ms > 2000ms"

        result.duration_ms = avg_time
    except Exception as e:
        result.message = f"Exception: {str(e)}"
    return result


async def run_all_tests() -> List[MultiSheetTestResult]:
    """运行所有测试"""
    parser = ExcelParser()

    tests = [
        test_parallel_parsing,
        test_sheet_relation_detection,
        test_aggregated_summary,
        test_sheet_preview,
        test_performance_benchmark,
    ]

    results = []
    for test_func in tests:
        print(f"Running: {test_func.__name__}...")
        result = await test_func(parser)
        results.append(result)
        status = "[PASS]" if result.passed else "[FAIL]"
        print(f"  {status} {result.name}: {result.message}")

    return results


def print_summary(results: List[MultiSheetTestResult]):
    """打印测试摘要"""
    passed = sum(1 for r in results if r.passed)
    total = len(results)

    print("\n" + "=" * 60)
    print(f"Multi-Sheet Test Summary: {passed}/{total} passed")
    print("=" * 60)

    total_duration = sum(r.duration_ms for r in results if r.duration_ms > 0)
    print(f"Total duration: {total_duration:.2f}ms")

    if passed < total:
        print("\nFailed tests:")
        for r in results:
            if not r.passed:
                print(f"  [FAIL] {r.name}: {r.message}")


async def main():
    """主入口"""
    print("SmartBI Multi-Sheet Analysis Tests")
    print("=" * 60)

    results = await run_all_tests()
    print_summary(results)

    # 保存详细结果
    output_file = os.path.join(os.path.dirname(__file__), "test_multi_sheet_analysis_report.json")
    with open(output_file, "w", encoding="utf-8") as f:
        json.dump([r.to_dict() for r in results], f, ensure_ascii=False, indent=2)
    print(f"\nDetailed report saved: {output_file}")

    passed = sum(1 for r in results if r.passed)
    return 0 if passed == len(results) else 1


if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)
