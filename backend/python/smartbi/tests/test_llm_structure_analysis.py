"""
测试LLM结构分析功能

验证：
1. 原始导出的保真度
2. LLM结构分析的准确性
3. 与原始Excel的差距
"""
import sys
import os
import json
import asyncio

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from services.raw_exporter import RawExporter
from services.llm_structure_analyzer import LLMStructureAnalyzer


async def test_structure_analysis():
    """测试结构分析"""
    test_file = "test_complex_5sheets.xlsx"
    if not os.path.exists(test_file):
        print("测试文件不存在，先创建...")
        import create_test_excel
        create_test_excel.create_test_excel(test_file)

    with open(test_file, "rb") as f:
        content = f.read()

    raw_exporter = RawExporter()
    llm_analyzer = LLMStructureAnalyzer()

    print("=" * 80)
    print("SmartBI Excel 结构分析测试")
    print("=" * 80)

    # 测试每个sheet
    all_sheets = raw_exporter.export_all_sheets(content)

    for sheet_data in all_sheets:
        print(f"\n{'='*70}")
        print(f"Sheet {sheet_data.sheet_index}: {sheet_data.sheet_name}")
        print("=" * 70)

        # 1. 原始数据统计
        print("\n[1] 原始数据 (RawExporter保真导出)")
        print(f"    总行数: {sheet_data.total_rows}")
        print(f"    总列数: {sheet_data.total_cols}")
        print(f"    合并单元格: {len(sheet_data.merged_cells)} 个")

        # 显示前5行原始数据
        print("\n    前5行原始数据:")
        for i, row in enumerate(sheet_data.rows[:5]):
            values = [str(c.value)[:15] if c.value else "" for c in row.cells[:6]]
            print(f"    Row {row.row_number}: {values}")

        # 2. LLM结构分析
        print("\n[2] LLM结构分析")
        try:
            result = await llm_analyzer.analyze(sheet_data, include_recommendations=True)
            structure = result.structure

            print(f"    分析方法: {structure.method}")
            print(f"    表格类型: {structure.table_type} (置信度: {structure.table_type_confidence:.2f})")
            print(f"    标题行: {structure.title_rows}")
            print(f"    表头行: {structure.header_rows}")
            print(f"    数据起始行: {structure.data_start_row}")

            # 列信息
            print(f"\n    列信息 ({len(structure.columns)} 列):")
            for col in structure.columns[:8]:  # 最多显示8列
                print(f"      {col.col_letter}: {col.name[:20]:<20} | {col.data_type:<10} | {col.role:<10}")

            # 推荐分析
            if result.recommendations:
                print(f"\n    推荐分析 ({len(result.recommendations)} 个):")
                for rec in result.recommendations[:3]:
                    print(f"      - {rec.analysis_type}: {rec.description}")
                    print(f"        图表: {rec.chart_types}")

            # LLM洞察
            if result.insights:
                print(f"\n    LLM洞察:")
                for insight in result.insights[:3]:
                    print(f"      - {insight}")

            if result.warnings:
                print(f"\n    数据警告:")
                for warning in result.warnings[:3]:
                    print(f"      - {warning}")

        except Exception as e:
            print(f"    分析失败: {e}")

        # 3. 数据保真度验证
        print("\n[3] 数据保真度验证")

        # 验证Markdown格式
        md_content = raw_exporter.to_markdown(sheet_data, max_rows=10, truncate=False)
        md_lines = md_content.split('\n')

        # 找到数据表格部分
        table_start = None
        for i, line in enumerate(md_lines):
            if line.startswith('| 行号'):
                table_start = i
                break

        if table_start:
            # 检查第一行数据
            first_data_line = md_lines[table_start + 2] if table_start + 2 < len(md_lines) else None
            if first_data_line:
                # 提取MD中的值
                md_values = [v.strip() for v in first_data_line.split('|')[2:-1]]  # 跳过行号列

                # 对比原始值
                original_values = [str(c.value) if c.value else "" for c in sheet_data.rows[0].cells]

                matches = 0
                for i, (md_v, orig_v) in enumerate(zip(md_values, original_values)):
                    if md_v == orig_v or (not md_v and not orig_v):
                        matches += 1
                    else:
                        # 检查是否是截断
                        if orig_v.startswith(md_v.rstrip('.')):
                            matches += 1

                accuracy = matches / len(md_values) * 100 if md_values else 0
                print(f"    Markdown保真度: {matches}/{len(md_values)} 列 ({accuracy:.1f}%)")

        # 验证JSON格式
        json_str = raw_exporter.to_json(sheet_data, simple=True)
        json_data = json.loads(json_str)

        # 对比行数
        json_rows = len(json_data['rows'])
        print(f"    JSON行数: {json_rows} (原始: {sheet_data.total_rows})")

        if json_rows == sheet_data.total_rows:
            print("    [OK] 行数一致")
        else:
            print("    [WARN] 行数不一致!")

        # 对比列数
        if json_data['rows']:
            json_cols = len(json_data['rows'][0]['values'])
            print(f"    JSON列数: {json_cols} (原始: {sheet_data.total_cols})")

            if json_cols == sheet_data.total_cols:
                print("    [OK] 列数一致")
            else:
                print("    [WARN] 列数不一致!")

    await llm_analyzer.close()

    print("\n" + "=" * 80)
    print("测试完成")
    print("=" * 80)


async def test_single_sheet_detailed():
    """对单个sheet进行详细测试"""
    test_file = "test_complex_5sheets.xlsx"
    if not os.path.exists(test_file):
        import create_test_excel
        create_test_excel.create_test_excel(test_file)

    with open(test_file, "rb") as f:
        content = f.read()

    raw_exporter = RawExporter()
    llm_analyzer = LLMStructureAnalyzer()

    # 测试第一个sheet（利润表）
    sheet_data = raw_exporter.export_sheet(content, sheet_index=0)

    print("=" * 80)
    print(f"详细测试: {sheet_data.sheet_name}")
    print("=" * 80)

    # 输出完整的Markdown
    print("\n[Markdown格式 - 完整输出]")
    md_content = raw_exporter.to_markdown(sheet_data, max_rows=20, truncate=False)
    print(md_content)

    # 输出JSON结构
    print("\n[JSON格式 - 前3行]")
    json_str = raw_exporter.to_json(sheet_data, simple=True)
    json_data = json.loads(json_str)

    for i, row in enumerate(json_data['rows'][:3]):
        print(f"Row {row['row']}: {row['values']}")

    # LLM分析
    print("\n[LLM结构分析结果]")
    result = await llm_analyzer.analyze(sheet_data)

    print(json.dumps({
        "table_type": result.structure.table_type,
        "title_rows": result.structure.title_rows,
        "header_rows": result.structure.header_rows,
        "data_start_row": result.structure.data_start_row,
        "columns": [
            {
                "letter": c.col_letter,
                "name": c.name,
                "type": c.data_type,
                "role": c.role
            }
            for c in result.structure.columns
        ],
        "method": result.structure.method
    }, ensure_ascii=False, indent=2))

    await llm_analyzer.close()


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--detailed", action="store_true", help="详细测试单个sheet")
    args = parser.parse_args()

    if args.detailed:
        asyncio.run(test_single_sheet_detailed())
    else:
        asyncio.run(test_structure_analysis())
