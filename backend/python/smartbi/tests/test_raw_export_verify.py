"""
全面验证原始导出的三种格式：JSON、MD、CSV
"""
import sys
import os
import json
import csv
import io

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from services.raw_exporter import RawExporter


def verify_completeness():
    """验证数据完整性"""
    test_file = "test_complex_5sheets.xlsx"
    if not os.path.exists(test_file):
        print("测试文件不存在，先创建...")
        import create_test_excel
        create_test_excel.create_test_excel(test_file)

    with open(test_file, "rb") as f:
        content = f.read()

    exporter = RawExporter()

    print("=" * 70)
    print("三种格式导出验证")
    print("=" * 70)

    # 测试每个sheet
    all_sheets = exporter.export_all_sheets(content)

    for sheet_data in all_sheets:
        print(f"\n{'='*60}")
        print(f"Sheet {sheet_data.sheet_index}: {sheet_data.sheet_name}")
        print(f"原始尺寸: {sheet_data.total_rows} 行 x {sheet_data.total_cols} 列")
        print("=" * 60)

        # 1. 验证JSON格式
        print("\n[1] JSON格式验证:")
        json_str = exporter.to_json(sheet_data, simple=True)
        json_data = json.loads(json_str)

        json_rows = len(json_data['rows'])
        json_cols = len(json_data['rows'][0]['values']) if json_data['rows'] else 0

        print(f"    导出行数: {json_rows}")
        print(f"    每行列数: {json_cols}")
        print(f"    前3行首值: {[r['values'][0] for r in json_data['rows'][:3]]}")

        # 2. 验证MD格式
        print("\n[2] Markdown格式验证:")
        md_str = exporter.to_markdown(sheet_data, max_rows=100)

        # 统计MD中的数据行数（排除表头和分隔符）
        md_lines = md_str.split('\n')
        md_table_rows = [l for l in md_lines if l.startswith('|') and '---' not in l]
        # 减去表头行
        md_data_rows = len([l for l in md_table_rows if not l.startswith('| 行号')]) - 1  # 减去列名行

        print(f"    MD总行数: {len(md_lines)}")
        print(f"    表格数据行: {md_data_rows}")

        # 3. 验证CSV格式
        print("\n[3] CSV格式验证:")
        csv_str = exporter.to_csv(sheet_data, include_row_number=True)

        csv_reader = csv.reader(io.StringIO(csv_str))
        csv_rows = list(csv_reader)

        print(f"    CSV行数: {len(csv_rows)}")
        print(f"    每行列数: {len(csv_rows[0]) if csv_rows else 0} (含行号列)")
        print(f"    前3行首值: {[r[1] if len(r) > 1 else '' for r in csv_rows[:3]]}")

        # 4. 数据一致性检查
        print("\n[4] 数据一致性检查:")

        # 检查特定单元格的值是否一致
        if sheet_data.rows:
            # 取第一行第一个非空值
            test_row = 0
            test_col = 0
            for i, cell in enumerate(sheet_data.rows[test_row].cells):
                if cell.value is not None:
                    test_col = i
                    break

            original_value = sheet_data.rows[test_row].cells[test_col].value
            json_value = json_data['rows'][test_row]['values'][test_col]
            csv_value = csv_rows[test_row][test_col + 1]  # +1 因为有行号列

            print(f"    测试单元格 [Row {test_row}, Col {test_col}]:")
            print(f"      原始值: {repr(original_value)}")
            print(f"      JSON值: {repr(json_value)}")
            print(f"      CSV值:  {repr(csv_value)}")

            # 比较（注意类型转换）
            json_match = str(original_value) == str(json_value) if original_value is not None else json_value is None
            csv_match = str(original_value) == str(csv_value) if original_value is not None else csv_value == ''

            if json_match and csv_match:
                print("      [OK] 数据一致")
            else:
                print("      [FAIL] 数据不一致!")

        # 5. 特殊情况检查
        print("\n[5] 特殊情况检查:")

        # 检查合并单元格
        print(f"    合并单元格数量: {len(sheet_data.merged_cells)}")
        if sheet_data.merged_cells:
            for m in sheet_data.merged_cells[:3]:
                print(f"      {m.range_str}: {repr(m.value)[:30]}")

        # 检查空值处理
        empty_cells = sum(1 for r in sheet_data.rows for c in r.cells if c.value is None)
        total_cells = len(sheet_data.rows) * sheet_data.total_cols if sheet_data.rows else 0
        print(f"    空单元格: {empty_cells} / {total_cells}")

    # 保存CSV文件用于人工检查
    print("\n" + "=" * 70)
    print("保存CSV文件供人工检查")
    print("=" * 70)

    os.makedirs("exports", exist_ok=True)
    for sheet_data in all_sheets:
        csv_path = f"exports/raw_{sheet_data.sheet_index}_{sheet_data.sheet_name}.csv"
        csv_content = exporter.to_csv(sheet_data)
        with open(csv_path, "w", encoding="utf-8-sig") as f:
            f.write(csv_content)
        print(f"  已保存: {csv_path}")


if __name__ == "__main__":
    verify_completeness()
