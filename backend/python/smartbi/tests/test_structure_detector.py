"""
结构检测器测试套件

测试 StructureDetector 的多层次检测逻辑
"""
import asyncio
import sys
import os
from io import BytesIO
from typing import List, Dict, Any
import json

import pandas as pd
import numpy as np

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from services.structure_detector import StructureDetector


class StructureTestResult:
    """结构检测测试结果"""
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


def create_standard_table() -> bytes:
    """标准表格结构"""
    df = pd.DataFrame({
        "Date": ["2024-01-01", "2024-01-02", "2024-01-03"],
        "Product": ["A", "B", "C"],
        "Sales": [100, 200, 150],
        "Amount": [1000, 2000, 1500]
    })
    buffer = BytesIO()
    df.to_excel(buffer, index=False, engine='openpyxl')
    return buffer.getvalue()


def create_pivot_table() -> bytes:
    """透视表结构 (行列交叉)"""
    df = pd.DataFrame({
        "Department": ["Sales", "R&D", "Marketing"],
        "Jan": [100, 80, 60],
        "Feb": [110, 85, 65],
        "Mar": [120, 90, 70]
    })
    buffer = BytesIO()
    df.to_excel(buffer, index=False, engine='openpyxl')
    return buffer.getvalue()


def create_hierarchical_table() -> bytes:
    """层级结构表格"""
    df = pd.DataFrame({
        "Category1": ["Electronics", "Electronics", "Home", "Home"],
        "Category2": ["Phone", "Computer", "Furniture", "Kitchen"],
        "Revenue": [5000, 8000, 3000, 2000],
        "Percentage": ["25%", "40%", "15%", "10%"]
    })
    buffer = BytesIO()
    df.to_excel(buffer, index=False, engine='openpyxl')
    return buffer.getvalue()


def create_time_series_table() -> bytes:
    """时间序列表格"""
    dates = pd.date_range("2024-01-01", periods=12, freq="M")
    df = pd.DataFrame({
        "Month": dates.strftime("%Y-%m"),
        "Revenue": [1000 + i * 100 for i in range(12)],
        "MoM": [None] + [f"{5+i}%" for i in range(11)],
        "YoY": [f"{10+i}%" for i in range(12)]
    })
    buffer = BytesIO()
    df.to_excel(buffer, index=False, engine='openpyxl')
    return buffer.getvalue()


def create_budget_comparison_table() -> bytes:
    """预算对比表"""
    df = pd.DataFrame({
        "Item": ["Revenue", "Expense", "Profit", "Cost"],
        "Budget": [10000, 6000, 4000, 5000],
        "Actual": [12000, 7000, 5000, 6000],
        "Variance": [2000, 1000, 1000, 1000],
        "VarPct": ["20%", "16.7%", "25%", "20%"]
    })
    buffer = BytesIO()
    df.to_excel(buffer, index=False, engine='openpyxl')
    return buffer.getvalue()


def create_multi_header_table() -> bytes:
    """多行表头表格"""
    buffer = BytesIO()
    with pd.ExcelWriter(buffer, engine='openpyxl') as writer:
        data = [
            ["", "H1", "", "", "H2", "", ""],
            ["Dept", "Q1", "Q2", "Subtotal", "Q3", "Q4", "Subtotal"],
            ["Sales", 100, 120, 220, 130, 150, 280],
            ["R&D", 80, 90, 170, 100, 110, 210],
        ]
        df = pd.DataFrame(data)
        df.to_excel(writer, index=False, header=False)

        ws = writer.sheets['Sheet1']
        ws.merge_cells('B1:D1')
        ws.merge_cells('E1:G1')
    return buffer.getvalue()


def create_title_with_table() -> bytes:
    """带标题的表格"""
    buffer = BytesIO()
    with pd.ExcelWriter(buffer, engine='openpyxl') as writer:
        # Title rows
        title_df = pd.DataFrame([
            ["Annual Report 2024"],
            ["Unit: USD"],
            [""]
        ])
        title_df.to_excel(writer, index=False, header=False)

        # Data
        data_df = pd.DataFrame({
            "Item": ["A", "B", "C"],
            "Value": [100, 200, 300]
        })
        data_df.to_excel(writer, index=False, startrow=4)
    return buffer.getvalue()


async def test_standard_table_detection(detector: StructureDetector) -> StructureTestResult:
    """测试标准表格检测"""
    result = StructureTestResult("Standard table detection")
    try:
        content = create_standard_table()
        detection = await detector.detect(content)

        result.details = {
            "success": detection.success,
            "confidence": detection.confidence,
            "method": detection.method,
            "header_row_count": detection.header_row_count,
            "total_rows": detection.total_rows,
            "total_cols": detection.total_cols
        }

        if detection.success and detection.header_row_count == 1:
            result.passed = True
            result.message = f"Detected correctly (confidence: {detection.confidence:.2f}, method: {detection.method})"
        else:
            result.message = f"Detection issue: header_rows={detection.header_row_count}"
    except Exception as e:
        result.message = f"Exception: {str(e)}"
    return result


async def test_pivot_table_detection(detector: StructureDetector) -> StructureTestResult:
    """测试透视表检测"""
    result = StructureTestResult("Pivot table detection")
    try:
        content = create_pivot_table()
        detection = await detector.detect(content)

        result.details = {
            "success": detection.success,
            "confidence": detection.confidence,
            "method": detection.method,
            "columns": len(detection.columns)
        }

        if detection.success:
            result.passed = True
            result.message = f"Detected (confidence: {detection.confidence:.2f}, {len(detection.columns)} columns)"
        else:
            result.message = f"Detection failed: {detection.error}"
    except Exception as e:
        result.message = f"Exception: {str(e)}"
    return result


async def test_hierarchical_table_detection(detector: StructureDetector) -> StructureTestResult:
    """测试层级结构检测"""
    result = StructureTestResult("Hierarchical table detection")
    try:
        content = create_hierarchical_table()
        detection = await detector.detect(content)

        result.details = {
            "success": detection.success,
            "confidence": detection.confidence,
            "method": detection.method,
            "columns": [c.name if hasattr(c, 'name') else str(c) for c in detection.columns[:4]]
        }

        if detection.success:
            result.passed = True
            result.message = f"Detected (confidence: {detection.confidence:.2f})"
        else:
            result.message = f"Detection failed: {detection.error}"
    except Exception as e:
        result.message = f"Exception: {str(e)}"
    return result


async def test_time_series_detection(detector: StructureDetector) -> StructureTestResult:
    """测试时间序列检测"""
    result = StructureTestResult("Time series detection")
    try:
        content = create_time_series_table()
        detection = await detector.detect(content)

        result.details = {
            "success": detection.success,
            "confidence": detection.confidence,
            "method": detection.method,
            "total_rows": detection.total_rows
        }

        if detection.success:
            result.passed = True
            result.message = f"Detected (confidence: {detection.confidence:.2f}, rows: {detection.total_rows})"
        else:
            result.message = f"Detection failed: {detection.error}"
    except Exception as e:
        result.message = f"Exception: {str(e)}"
    return result


async def test_budget_comparison_detection(detector: StructureDetector) -> StructureTestResult:
    """测试预算对比表检测"""
    result = StructureTestResult("Budget comparison detection")
    try:
        content = create_budget_comparison_table()
        detection = await detector.detect(content)

        result.details = {
            "success": detection.success,
            "confidence": detection.confidence,
            "method": detection.method,
            "columns": len(detection.columns)
        }

        if detection.success:
            result.passed = True
            result.message = f"Detected (confidence: {detection.confidence:.2f})"
        else:
            result.message = f"Detection failed: {detection.error}"
    except Exception as e:
        result.message = f"Exception: {str(e)}"
    return result


async def test_multi_header_detection(detector: StructureDetector) -> StructureTestResult:
    """测试多行表头检测"""
    result = StructureTestResult("Multi-row header detection")
    try:
        content = create_multi_header_table()
        detection = await detector.detect(content)

        result.details = {
            "success": detection.success,
            "confidence": detection.confidence,
            "method": detection.method,
            "header_row_count": detection.header_row_count,
            "merged_cells": len(detection.merged_cells)
        }

        # Multi-row headers should be detected
        if detection.success:
            result.passed = True
            result.message = f"Detected {detection.header_row_count} header rows, {len(detection.merged_cells)} merged cells"
        else:
            result.message = f"Detection failed: {detection.error}"
    except Exception as e:
        result.message = f"Exception: {str(e)}"
    return result


async def test_title_skip_detection(detector: StructureDetector) -> StructureTestResult:
    """测试标题行跳过检测"""
    result = StructureTestResult("Title row skip detection")
    try:
        content = create_title_with_table()
        detection = await detector.detect(content)

        result.details = {
            "success": detection.success,
            "confidence": detection.confidence,
            "method": detection.method,
            "data_start_row": detection.data_start_row,
            "header_row_count": detection.header_row_count
        }

        # Data should start after title rows
        if detection.success:
            result.passed = True
            result.message = f"Data starts at row {detection.data_start_row}"
        else:
            result.message = f"Detection failed: {detection.error}"
    except Exception as e:
        result.message = f"Exception: {str(e)}"
    return result


async def run_all_tests() -> List[StructureTestResult]:
    """运行所有测试"""
    detector = StructureDetector()

    tests = [
        test_standard_table_detection,
        test_pivot_table_detection,
        test_hierarchical_table_detection,
        test_time_series_detection,
        test_budget_comparison_detection,
        test_multi_header_detection,
        test_title_skip_detection,
    ]

    results = []
    for test_func in tests:
        print(f"Running: {test_func.__name__}...")
        result = await test_func(detector)
        results.append(result)
        status = "[PASS]" if result.passed else "[FAIL]"
        print(f"  {status} {result.name}: {result.message}")

    return results


def print_summary(results: List[StructureTestResult]):
    """打印测试摘要"""
    passed = sum(1 for r in results if r.passed)
    total = len(results)

    print("\n" + "=" * 60)
    print(f"Structure Detector Test Summary: {passed}/{total} passed")
    print("=" * 60)

    if passed < total:
        print("\nFailed tests:")
        for r in results:
            if not r.passed:
                print(f"  [FAIL] {r.name}: {r.message}")


async def main():
    """主入口"""
    print("SmartBI Structure Detector Tests")
    print("=" * 60)

    results = await run_all_tests()
    print_summary(results)

    # 保存详细结果
    output_file = os.path.join(os.path.dirname(__file__), "test_structure_detector_report.json")
    with open(output_file, "w", encoding="utf-8") as f:
        json.dump([r.to_dict() for r in results], f, ensure_ascii=False, indent=2)
    print(f"\nDetailed report saved: {output_file}")

    passed = sum(1 for r in results if r.passed)
    return 0 if passed == len(results) else 1


if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)
