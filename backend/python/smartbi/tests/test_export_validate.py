"""
测试导出验证功能 - 使用5个Sheet的复杂Excel
"""
import asyncio
import json
import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from services.data_exporter import DataExporter, BatchExporter
from services.export_validator import ExportValidator, ValidationResult


async def test_single_sheet_export():
    """测试单个Sheet导出"""
    print("\n" + "=" * 60)
    print("测试1: 单个Sheet导出 (利润表)")
    print("=" * 60)

    with open("test_complex_5sheets.xlsx", "rb") as f:
        content = f.read()

    exporter = DataExporter()
    data = await exporter.from_excel(content, sheet_index=0)

    print(f"\nSheet: {data.source_sheet}")
    print(f"元信息: {json.dumps(data.metadata, ensure_ascii=False, indent=2)}")
    print(f"列数: {data.column_count}")
    print(f"行数: {data.row_count}")
    print(f"\n列名:")
    for col in data.columns[:10]:
        print(f"  - {col.name} ({col.data_type})")

    print(f"\n前3行数据:")
    for i, row in enumerate(data.rows[:3]):
        print(f"  Row {i+1}: {list(row.values())[:5]}...")

    if data.rows:
        print(f"\n最后一行:")
        last_row = data.rows[-1]
        print(f"  {list(last_row.values())[:5]}...")


async def test_batch_export():
    """测试批量导出所有Sheets"""
    print("\n" + "=" * 60)
    print("测试2: 批量导出所有Sheets")
    print("=" * 60)

    with open("test_complex_5sheets.xlsx", "rb") as f:
        content = f.read()

    exporter = BatchExporter()
    result = await exporter.export_all_sheets(content, source_filename="test_complex_5sheets.xlsx")

    print(f"\n总Sheet数: {result.sheet_count}")
    print(f"\n各Sheet信息:")
    for sheet in result.sheets:
        print(f"\n  [{sheet.index}] {sheet.name}")
        print(f"      行数: {sheet.row_count}, 列数: {sheet.column_count}")
        print(f"      元信息: {sheet.data.metadata.get('title', 'N/A')}")
        if sheet.data.columns:
            cols_preview = [c.name for c in sheet.data.columns[:5]]
            print(f"      列预览: {cols_preview}")


async def test_validation():
    """测试导出验证"""
    print("\n" + "=" * 60)
    print("测试3: 导出数据验证")
    print("=" * 60)

    with open("test_complex_5sheets.xlsx", "rb") as f:
        content = f.read()

    exporter = DataExporter()
    validator = ExportValidator()  # 不使用LLM

    for sheet_idx in range(5):
        print(f"\n--- Sheet {sheet_idx} ---")
        try:
            data = await exporter.from_excel(content, sheet_index=sheet_idx)

            exported = {
                "metadata": data.metadata,
                "columns": [c.to_dict() for c in data.columns],
                "rows": data.rows,
                "row_count": data.row_count,
                "column_count": data.column_count
            }

            result = await validator.validate_export(
                content,
                exported,
                sheet_index=sheet_idx,
                use_llm=False
            )

            print(f"Sheet: {result.sheet_name}")
            print(f"验证通过: {result.success}")
            print(f"问题数: {len(result.issues)}")

            if result.issues:
                for issue in result.issues:
                    print(f"  [{issue.level}] {issue.category}: {issue.message}")

            print(f"摘要: Excel行={result.summary.get('excel_rows')}, 导出行={result.summary.get('export_rows')}")

        except Exception as e:
            print(f"错误: {e}")


async def test_export_formats():
    """测试多格式导出"""
    print("\n" + "=" * 60)
    print("测试4: 多格式导出 (JSON/Markdown/CSV)")
    print("=" * 60)

    with open("test_complex_5sheets.xlsx", "rb") as f:
        content = f.read()

    exporter = DataExporter()
    data = await exporter.from_excel(content, sheet_index=1)  # 销售明细

    # JSON
    json_output = exporter.to_json(data, include_metadata=True)
    json_data = json.loads(json_output)
    print(f"\nJSON格式:")
    print(f"  元信息keys: {list(json_data.get('metadata', {}).keys())}")
    print(f"  行数: {json_data.get('row_count')}")
    print(f"  列数: {json_data.get('column_count')}")

    # Markdown
    md_output = exporter.to_markdown(data, max_rows=5, include_metadata=True)
    print(f"\nMarkdown格式 (前5行):")
    print("-" * 40)
    for line in md_output.split('\n')[:15]:
        print(line)
    print("...")

    # CSV
    csv_output = exporter.to_csv(data, include_header_comments=True)
    print(f"\nCSV格式 (前10行):")
    print("-" * 40)
    for line in csv_output.split('\n')[:10]:
        print(line[:80] + "..." if len(line) > 80 else line)


async def test_save_to_directory():
    """测试保存到目录"""
    print("\n" + "=" * 60)
    print("测试5: 批量导出保存到目录")
    print("=" * 60)

    with open("test_complex_5sheets.xlsx", "rb") as f:
        content = f.read()

    output_dir = "exports/test_5sheets"
    exporter = BatchExporter()

    saved_files = await exporter.save_to_directory(
        content,
        output_dir=output_dir,
        source_filename="test_complex_5sheets.xlsx"
    )

    print(f"\n保存目录: {output_dir}")
    print(f"保存文件数: {len(saved_files)}")
    print("\n文件列表:")
    for filename in sorted(saved_files.keys()):
        print(f"  - {filename}")


async def main():
    """运行所有测试"""
    print("=" * 60)
    print("SmartBI 导出验证功能测试")
    print("测试文件: test_complex_5sheets.xlsx (5个Sheet)")
    print("=" * 60)

    await test_single_sheet_export()
    await test_batch_export()
    await test_validation()
    await test_export_formats()
    await test_save_to_directory()

    print("\n" + "=" * 60)
    print("所有测试完成!")
    print("=" * 60)


if __name__ == "__main__":
    asyncio.run(main())
