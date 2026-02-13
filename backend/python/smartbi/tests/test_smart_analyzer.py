"""
测试智能分析器 - 使用导出的5个Sheet数据
"""
import asyncio
import json
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from services.data_exporter import DataExporter, BatchExporter
from services.smart_analyzer import (
    SmartAnalyzer,
    analyze_exported_data,
    detect_scenario,
    DataScenario
)


def print_section(title: str):
    """打印分隔线"""
    print("\n" + "=" * 70)
    print(f"  {title}")
    print("=" * 70)


async def test_scenario_detection():
    """测试场景检测"""
    print_section("测试1: 场景检测")

    with open("test_complex_5sheets.xlsx", "rb") as f:
        content = f.read()

    exporter = DataExporter()

    sheet_names = [
        "利润表",
        "销售明细",
        "部门预算对比",
        "产品成本分析",
        "待补充数据"
    ]

    for i in range(5):
        data = await exporter.from_excel(content, sheet_index=i)

        result = detect_scenario(
            metadata=data.metadata,
            columns=[c.to_dict() for c in data.columns],
            sample_rows=data.rows[:10]
        )

        print(f"\n[Sheet {i}] {sheet_names[i]}")
        print(f"  检测场景: {result.scenario.value}")
        print(f"  置信度: {result.confidence:.2f}")
        print(f"  检测依据: {result.evidence[:3]}")


async def test_field_mapping():
    """测试字段映射"""
    print_section("测试2: 字段映射")

    with open("test_complex_5sheets.xlsx", "rb") as f:
        content = f.read()

    exporter = DataExporter()

    # 测试利润表
    data = await exporter.from_excel(content, sheet_index=0)

    from services.smart_analyzer import FieldMapper, ScenarioDetector

    detector = ScenarioDetector()
    scenario = detector.detect(
        data.metadata,
        [c.to_dict() for c in data.columns],
        data.rows[:10]
    )

    mapper = FieldMapper()
    mappings = mapper.map_fields(
        [c.to_dict() for c in data.columns],
        scenario.scenario
    )

    print(f"\n利润表字段映射:")
    print(f"{'原始列名':<20} {'标准字段':<15} {'角色':<10} {'置信度':<8}")
    print("-" * 60)
    for m in mappings:
        print(f"{m.original_name:<20} {m.standard_name:<15} {m.role:<10} {m.confidence:.2f}")


async def test_analysis_recommendation():
    """测试分析推荐"""
    print_section("测试3: 分析推荐")

    with open("test_complex_5sheets.xlsx", "rb") as f:
        content = f.read()

    exporter = DataExporter()

    from services.smart_analyzer import AnalysisRecommender, FieldMapper, ScenarioDetector

    detector = ScenarioDetector()
    mapper = FieldMapper()
    recommender = AnalysisRecommender()

    sheet_names = ["利润表", "销售明细", "部门预算对比"]

    for i, name in enumerate(sheet_names):
        data = await exporter.from_excel(content, sheet_index=i)

        scenario = detector.detect(
            data.metadata,
            [c.to_dict() for c in data.columns],
            data.rows[:10]
        )

        mappings = mapper.map_fields(
            [c.to_dict() for c in data.columns],
            scenario.scenario
        )

        recommendations = recommender.recommend(scenario.scenario, mappings)

        print(f"\n[{name}] 场景: {scenario.scenario.value}")
        print(f"推荐分析:")
        for rec in recommendations:
            print(f"  [{rec.priority}] {rec.description}")
            print(f"      方法: {rec.method_name}, 图表: {rec.chart_type}")
            print(f"      需要字段: {rec.required_fields}")


async def test_full_analysis():
    """测试完整分析流程"""
    print_section("测试4: 完整智能分析")

    with open("test_complex_5sheets.xlsx", "rb") as f:
        content = f.read()

    exporter = DataExporter()
    analyzer = SmartAnalyzer()

    sheet_names = ["利润表", "销售明细", "部门预算对比"]

    for i, name in enumerate(sheet_names):
        print(f"\n{'='*50}")
        print(f"分析 [{name}]")
        print('='*50)

        # 导出数据
        data = await exporter.from_excel(content, sheet_index=i)

        exported = {
            "metadata": data.metadata,
            "columns": [c.to_dict() for c in data.columns],
            "rows": data.rows
        }

        # 执行智能分析
        result = await analyzer.analyze(exported, max_analyses=3)

        print(f"\n场景: {result.scenario.scenario.value}")
        print(f"置信度: {result.scenario.confidence:.2f}")

        print(f"\n字段映射 ({len(result.field_mappings)} 个):")
        for m in result.field_mappings:
            if m.confidence > 0.5:
                print(f"  {m.original_name} -> {m.standard_name} ({m.role})")

        print(f"\n推荐分析 ({len(result.recommendations)} 个):")
        for rec in result.recommendations:
            print(f"  - {rec.description} ({rec.chart_type})")

        print(f"\n执行分析结果 ({len(result.analyses)} 个):")
        for analysis in result.analyses:
            print(f"\n  [{analysis.analysis_type}] {analysis.title}")

            # 打印关键数据
            if "summary" in analysis.data:
                summary = analysis.data["summary"]
                print(f"    摘要: {json.dumps(summary, ensure_ascii=False)}")

            if "items" in analysis.data:
                items = analysis.data["items"][:3]
                print(f"    前3项: {json.dumps(items, ensure_ascii=False, indent=6)[:200]}...")

            if "rankings" in analysis.data:
                rankings = analysis.data["rankings"][:3]
                print(f"    排名: {json.dumps(rankings, ensure_ascii=False)}")

            # 打印洞察
            if analysis.insights:
                print(f"    洞察:")
                for insight in analysis.insights:
                    print(f"      - {insight}")

            if analysis.warnings:
                print(f"    警告:")
                for warning in analysis.warnings:
                    print(f"      - ⚠️ {warning}")

        print(f"\n处理记录: {result.processing_notes}")


async def test_exported_json_analysis():
    """测试从导出的JSON文件分析"""
    print_section("测试5: 从导出JSON分析")

    # 读取之前导出的JSON
    json_path = "exports/test_5sheets/all_sheets.json"

    if not os.path.exists(json_path):
        print(f"文件不存在: {json_path}")
        return

    with open(json_path, "r", encoding="utf-8") as f:
        all_data = json.load(f)

    print(f"源文件: {all_data.get('source_file')}")
    print(f"Sheet数: {all_data.get('sheet_count')}")

    analyzer = SmartAnalyzer()

    # 分析第一个Sheet（利润表）
    sheet_data = all_data["sheets"][0]

    exported = {
        "metadata": sheet_data["metadata"],
        "columns": sheet_data["columns"],
        "rows": sheet_data["rows"]
    }

    result = await analyzer.analyze(exported)

    print(f"\n分析 [{sheet_data['name']}]")
    print(f"\n{result.summary}")


async def main():
    """运行所有测试"""
    print("=" * 70)
    print("  SmartBI 智能分析器测试")
    print("  测试文件: test_complex_5sheets.xlsx")
    print("=" * 70)

    await test_scenario_detection()
    await test_field_mapping()
    await test_analysis_recommendation()
    await test_full_analysis()
    await test_exported_json_analysis()

    print("\n" + "=" * 70)
    print("  所有测试完成!")
    print("=" * 70)


if __name__ == "__main__":
    asyncio.run(main())
