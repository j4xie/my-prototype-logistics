"""
测试表头检测修复
"""
import asyncio
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from services.data_exporter import DataExporter


async def main():
    """测试销售明细表的表头检测"""

    # 先确保测试文件存在
    test_file = "test_complex_5sheets.xlsx"
    if not os.path.exists(test_file):
        print(f"测试文件不存在: {test_file}")
        print("请先运行 create_test_excel.py 生成测试文件")
        return

    with open(test_file, "rb") as f:
        content = f.read()

    exporter = DataExporter()

    # 测试每个Sheet
    sheet_names = ["利润表", "销售明细", "部门预算对比", "产品成本分析", "待补充数据"]

    for i in range(5):
        data = await exporter.from_excel(content, sheet_index=i)

        print(f"\n{'='*60}")
        print(f"Sheet {i}: {data.source_sheet}")
        print(f"数据: {data.row_count} 行, {data.column_count} 列")

        print(f"\n列名:")
        for col in data.columns[:10]:  # 只显示前10列
            print(f"  - {col.name} (type={col.data_type}, sub_type={col.sub_type})")

        if data.rows:
            print(f"\n首行数据 (前5个字段):")
            for k, v in list(data.rows[0].items())[:5]:
                print(f"  {k}: {v}")

        # 特别检查销售明细表
        if i == 1:
            print(f"\n*** 销售明细表检测结果分析 ***")
            expected_cols = ["序号", "日期", "客户名称", "产品名称", "规格"]
            actual_cols = [c.name for c in data.columns[:5]]
            print(f"期望列名: {expected_cols}")
            print(f"实际列名: {actual_cols}")

            if actual_cols == expected_cols:
                print("✅ 列名检测正确!")
            else:
                print("❌ 列名检测有问题")

                # 检查首行数据是否是列名
                first_row_vals = list(data.rows[0].values())[:5] if data.rows else []
                if first_row_vals == expected_cols:
                    print("   问题: 实际列名出现在首行数据中，表头检测行数不对")


if __name__ == "__main__":
    asyncio.run(main())
