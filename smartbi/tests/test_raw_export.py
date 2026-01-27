"""
测试原始导出（保真模式）
"""
import sys
import os
import json

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from services.raw_exporter import RawExporter


def main():
    # 检查测试文件
    test_file = "test_complex_5sheets.xlsx"
    if not os.path.exists(test_file):
        print(f"测试文件不存在: {test_file}")
        print("请先运行 create_test_excel.py")
        return

    with open(test_file, "rb") as f:
        content = f.read()

    exporter = RawExporter()

    # 导出所有Sheet
    all_sheets = exporter.export_all_sheets(content, max_rows_per_sheet=20)

    print("=" * 70)
    print("原始导出测试 - 保真模式")
    print("=" * 70)

    for sheet_data in all_sheets:
        print(f"\n{'='*60}")
        print(f"Sheet {sheet_data.sheet_index}: {sheet_data.sheet_name}")
        print(f"尺寸: {sheet_data.total_rows} 行 x {sheet_data.total_cols} 列")
        print(f"合并单元格: {len(sheet_data.merged_cells)} 个")

        # 显示合并单元格
        if sheet_data.merged_cells:
            print("\n合并单元格:")
            for m in sheet_data.merged_cells[:5]:
                print(f"  {m.range_str}: {m.value}")

        # 显示统计信息
        print(f"\n统计信息:")
        print(f"  非空行数: {sheet_data.stats.get('non_empty_row_count', 0)}")
        print(f"  平均填充率: {sheet_data.stats.get('avg_fill_rate', 0):.2%}")
        print(f"  预估数据起始行: {sheet_data.stats.get('potential_data_start_row', 'N/A')}")

        # 显示前10行的概要
        print(f"\n前10行概要:")
        print(f"  {'行号':>4} | {'非空':>4} | {'数值':>4} | {'填充率':>6} | 前3个值")
        print(f"  {'-'*4}-+-{'-'*4}-+-{'-'*4}-+-{'-'*6}-+-{'-'*30}")

        for row in sheet_data.rows[:10]:
            values = [c.value for c in row.cells[:3]]
            values_str = str(values)[:30]
            fill_rate = row.non_empty_count / sheet_data.total_cols if sheet_data.total_cols > 0 else 0
            print(f"  {row.row_number:>4} | {row.non_empty_count:>4} | {row.numeric_count:>4} | {fill_rate:>6.0%} | {values_str}")

    # 保存JSON输出
    os.makedirs("exports", exist_ok=True)

    # 保存完整JSON
    full_json_path = "exports/raw_export_full.json"
    with open(full_json_path, "w", encoding="utf-8") as f:
        all_data = [s.to_dict() for s in all_sheets]
        json.dump(all_data, f, ensure_ascii=False, indent=2)
    print(f"\n\n完整JSON已保存: {full_json_path}")

    # 保存简化JSON
    simple_json_path = "exports/raw_export_simple.json"
    with open(simple_json_path, "w", encoding="utf-8") as f:
        all_data = [s.to_simple_dict() for s in all_sheets]
        json.dump(all_data, f, ensure_ascii=False, indent=2)
    print(f"简化JSON已保存: {simple_json_path}")

    # 保存Markdown
    for sheet_data in all_sheets:
        md_path = f"exports/raw_{sheet_data.sheet_index}_{sheet_data.sheet_name}.md"
        md_content = exporter.to_markdown(sheet_data, max_rows=30)
        with open(md_path, "w", encoding="utf-8") as f:
            f.write(md_content)
        print(f"Markdown已保存: {md_path}")

    # 验证数据完整性
    print("\n" + "=" * 70)
    print("数据完整性验证")
    print("=" * 70)

    for sheet_data in all_sheets:
        print(f"\nSheet: {sheet_data.sheet_name}")

        # 检查是否所有行都有数据
        exported_rows = len(sheet_data.rows)
        print(f"  导出行数: {exported_rows} / {sheet_data.total_rows}")

        # 检查是否有数据丢失
        if exported_rows < sheet_data.total_rows:
            print(f"  [!] 注意: 由于max_rows限制，只导出了前{exported_rows}行")

        # 检查每行的列数
        col_counts = set(len(r.cells) for r in sheet_data.rows)
        if len(col_counts) == 1:
            print(f"  列数一致: 每行 {col_counts.pop()} 列")
        else:
            print(f"  [!] 列数不一致: {col_counts}")

        # 验证合并单元格信息
        print(f"  合并单元格: {len(sheet_data.merged_cells)} 个")


if __name__ == "__main__":
    main()
