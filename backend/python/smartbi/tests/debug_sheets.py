"""
调试Sheet结构
"""
import asyncio
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from services.data_exporter import DataExporter


async def main():
    with open("test_complex_5sheets.xlsx", "rb") as f:
        content = f.read()

    exporter = DataExporter()

    for i in range(5):
        data = await exporter.from_excel(content, sheet_index=i)

        print(f"\n{'='*50}")
        print(f"Sheet {i}: {data.source_sheet}")
        print(f"行数: {data.row_count}, 列数: {data.column_count}")
        print(f"\n列名:")
        for col in data.columns:
            print(f"  - {col.name} ({col.data_type}, sub_type={col.sub_type})")

        if data.rows:
            print(f"\n首行数据:")
            for k, v in list(data.rows[0].items())[:5]:
                print(f"  {k}: {v}")


if __name__ == "__main__":
    asyncio.run(main())
