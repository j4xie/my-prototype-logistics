"""
测试智能分析器 - 输出结果到文件
"""
import asyncio
import json
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from services.data_exporter import DataExporter
from services.smart_analyzer import SmartAnalyzer


async def main():
    """执行分析并输出结果"""

    with open("test_complex_5sheets.xlsx", "rb") as f:
        content = f.read()

    exporter = DataExporter()
    analyzer = SmartAnalyzer()

    results = []

    sheet_names = ["利润表", "销售明细", "部门预算对比", "产品成本分析", "待补充数据"]

    for i, name in enumerate(sheet_names):
        data = await exporter.from_excel(content, sheet_index=i)

        exported = {
            "metadata": data.metadata,
            "columns": [c.to_dict() for c in data.columns],
            "rows": data.rows
        }

        result = await analyzer.analyze(exported, max_analyses=3)

        sheet_result = {
            "sheet_index": i,
            "sheet_name": name,
            "scenario": {
                "type": result.scenario.scenario.value,
                "confidence": result.scenario.confidence,
                "evidence": result.scenario.evidence
            },
            "field_mappings": [
                {
                    "original": m.original_name,
                    "standard": m.standard_name,
                    "role": m.role,
                    "confidence": m.confidence
                }
                for m in result.field_mappings
                if m.confidence > 0.5
            ],
            "recommendations": [
                {
                    "type": r.analysis_type,
                    "description": r.description,
                    "chart": r.chart_type,
                    "priority": r.priority
                }
                for r in result.recommendations
            ],
            "analyses": [
                {
                    "type": a.analysis_type,
                    "title": a.title,
                    "data_summary": {
                        k: v for k, v in a.data.items()
                        if k in ["summary", "rankings", "total"]
                    } if a.data else {},
                    "insights": a.insights,
                    "warnings": a.warnings,
                    "chart_type": a.chart_config.get("type") if a.chart_config else None
                }
                for a in result.analyses
            ],
            "processing_notes": result.processing_notes
        }

        results.append(sheet_result)

    # 写入JSON文件
    output_path = "exports/analysis_results.json"
    os.makedirs(os.path.dirname(output_path), exist_ok=True)

    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(results, f, ensure_ascii=False, indent=2)

    print(f"分析结果已保存到: {output_path}")

    # 同时生成Markdown报告
    md_path = "exports/analysis_report.md"

    with open(md_path, "w", encoding="utf-8") as f:
        f.write("# SmartBI 智能分析报告\n\n")
        f.write("测试文件: test_complex_5sheets.xlsx\n\n")

        for r in results:
            f.write(f"## {r['sheet_index']}. {r['sheet_name']}\n\n")

            f.write("### 场景检测\n")
            f.write(f"- 场景: **{r['scenario']['type']}**\n")
            f.write(f"- 置信度: {r['scenario']['confidence']:.2f}\n")
            f.write(f"- 检测依据: {', '.join(r['scenario']['evidence'][:3])}\n\n")

            if r['field_mappings']:
                f.write("### 字段映射\n")
                f.write("| 原始列名 | 标准字段 | 角色 | 置信度 |\n")
                f.write("|----------|----------|------|--------|\n")
                for m in r['field_mappings']:
                    f.write(f"| {m['original']} | {m['standard']} | {m['role']} | {m['confidence']:.2f} |\n")
                f.write("\n")

            if r['recommendations']:
                f.write("### 推荐分析\n")
                for rec in r['recommendations']:
                    f.write(f"- [{rec['priority']}] **{rec['description']}** ({rec['chart']})\n")
                f.write("\n")

            if r['analyses']:
                f.write("### 分析结果\n")
                for a in r['analyses']:
                    f.write(f"\n#### {a['title']}\n")

                    if a.get('data_summary'):
                        if 'summary' in a['data_summary']:
                            f.write("**摘要:**\n```json\n")
                            f.write(json.dumps(a['data_summary']['summary'], ensure_ascii=False, indent=2))
                            f.write("\n```\n")

                        if 'rankings' in a['data_summary']:
                            f.write("**排名:**\n```json\n")
                            f.write(json.dumps(a['data_summary']['rankings'][:5], ensure_ascii=False, indent=2))
                            f.write("\n```\n")

                    if a['insights']:
                        f.write("**洞察:**\n")
                        for insight in a['insights']:
                            f.write(f"- {insight}\n")

                    if a['warnings']:
                        f.write("**警告:**\n")
                        for warning in a['warnings']:
                            f.write(f"- ⚠️ {warning}\n")

                    f.write(f"\n推荐图表: {a['chart_type']}\n")

            f.write("\n---\n\n")

    print(f"Markdown报告已保存到: {md_path}")


if __name__ == "__main__":
    asyncio.run(main())
