"""
Test sales detail sheet analysis
"""
import asyncio
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from services.data_exporter import DataExporter
from services.smart_analyzer import SmartAnalyzer


async def main():
    with open('test_complex_5sheets.xlsx', 'rb') as f:
        content = f.read()

    exporter = DataExporter()
    analyzer = SmartAnalyzer()

    # Test sheet 1 (sales detail)
    data = await exporter.from_excel(content, sheet_index=1)
    print('Sheet 1: Sales Detail')
    print('Columns:', [c.name for c in data.columns])
    print()

    # Run analysis
    exported = {
        'metadata': data.metadata,
        'columns': [c.to_dict() for c in data.columns],
        'rows': data.rows
    }
    result = await analyzer.analyze(exported, max_analyses=2)

    print('Scenario:', result.scenario.scenario.value, '(confidence:', result.scenario.confidence, ')')
    print()
    print('Field mappings:', len(result.field_mappings))
    for m in result.field_mappings[:8]:
        print('  ', m.original_name, '->', m.standard_name, '(', m.role, ')')
    print()
    print('Recommendations:', len(result.recommendations))
    for r in result.recommendations:
        print('  ', r.description, '-', r.chart_type)


if __name__ == "__main__":
    asyncio.run(main())
