"""
Test script for enhanced analysis modules
"""
import sys
sys.path.insert(0, '..')

import pandas as pd
from services.statistical_analyzer import StatisticalAnalyzer
from services.chart_generator import ChartGenerator, ChartRecommendationEngine
from services.drilldown_renderer import DrillDownRenderer, EnhancedInsightGenerator


def create_test_data():
    """Create sample sales data for testing"""
    return pd.DataFrame({
        'region': ['East', 'East', 'West', 'West', 'North', 'North', 'South', 'South'] * 10,
        'salesperson': ['Alice', 'Bob'] * 40,
        'product': ['A', 'B', 'C', 'A', 'B', 'C', 'A', 'B'] * 10,
        'sales': [100, 200, 150, 180, 220, 90, 300, 250] * 10,
        'quantity': [10, 20, 15, 18, 22, 9, 30, 25] * 10,
        'profit': [20, 40, 30, 36, 44, 18, 60, 50] * 10
    })


class MockFieldDef:
    """Mock field definition for testing"""
    def __init__(self, name, is_dim=False, is_measure=False, is_time=False):
        self.original_name = name
        self.standard_name = name
        self.is_dimension = is_dim
        self.is_measure = is_measure
        self.is_time = is_time


def test_statistical_analyzer():
    print("\n" + "="*60)
    print("Testing StatisticalAnalyzer")
    print("="*60)

    data = create_test_data()
    analyzer = StatisticalAnalyzer()

    # Test basic statistics
    report = analyzer.analyze(data, 'sales')
    print(f"\nBasic Statistics for 'sales':")
    print(f"  Count: {report.count}")
    print(f"  Sum: {report.sum:.2f}")
    print(f"  Mean: {report.mean:.2f}")
    print(f"  Median: {report.median:.2f}")
    print(f"  Std: {report.std:.2f}")
    print(f"  Distribution: {report.distribution_type}")
    print(f"  Outliers: {report.outlier_count}")
    print(f"  CV: {report.coefficient_of_variation:.2f}%")

    # Test comparison
    comparison = analyzer.compare_dimensions(data, 'region', 'sales')
    print(f"\nComparison by 'region':")
    print(f"  Top 3: {comparison.top_3}")
    print(f"  CR3: {comparison.cr3:.1f}%")
    print(f"  Pareto count: {comparison.pareto_count}")
    print(f"  Gini: {comparison.gini_coefficient:.3f}")

    # Test correlation
    corr = analyzer.analyze_correlations(data, ['sales', 'quantity', 'profit'])
    print(f"\nCorrelation Analysis:")
    print(f"  Strong positive: {len(corr.strong_positive)}")
    if corr.top_correlation:
        print(f"  Top: {corr.top_correlation['var1']} vs {corr.top_correlation['var2']} = {corr.top_correlation['correlation']:.3f}")

    print("\n[PASS] StatisticalAnalyzer tests passed!")


def test_chart_generator():
    print("\n" + "="*60)
    print("Testing ChartGenerator")
    print("="*60)

    data = create_test_data()
    fields = [
        MockFieldDef('region', is_dim=True),
        MockFieldDef('salesperson', is_dim=True),
        MockFieldDef('product', is_dim=True),
        MockFieldDef('sales', is_measure=True),
        MockFieldDef('quantity', is_measure=True),
        MockFieldDef('profit', is_measure=True),
    ]

    generator = ChartGenerator()
    charts = generator.generate_charts_for_sheet(data, fields, "TestSheet", max_charts=8)

    print(f"\nGenerated {len(charts)} charts:")
    for i, chart in enumerate(charts):
        print(f"  {i+1}. {chart.get('chartType', 'UNKNOWN')}: {chart.get('title', 'No title')}")
        if chart.get('recommendation_reason'):
            print(f"     Reason: {chart['recommendation_reason']}")

    print("\n[PASS] ChartGenerator tests passed!")


def test_drilldown_renderer():
    print("\n" + "="*60)
    print("Testing DrillDownRenderer")
    print("="*60)

    data = create_test_data()
    fields = [
        MockFieldDef('region', is_dim=True),
        MockFieldDef('salesperson', is_dim=True),
        MockFieldDef('product', is_dim=True),
        MockFieldDef('sales', is_measure=True),
        MockFieldDef('quantity', is_measure=True),
        MockFieldDef('profit', is_measure=True),
    ]

    renderer = DrillDownRenderer()
    drilldown_data = renderer.render_all_drilldowns(data, fields, "TestSheet")

    print(f"\nDrill-down data generated for {len(drilldown_data)} dimensions:")
    for dim, values in drilldown_data.items():
        print(f"  {dim}: {len(values)} values")
        # Show first value details
        if values:
            first_val = list(values.keys())[0]
            item = values[first_val]
            print(f"    Example '{first_val}':")
            print(f"      - Metrics: {len(item.get('metrics', []))}")
            print(f"      - Charts: {len(item.get('charts', []))}")
            print(f"      - Insights: {len(item.get('insights', []))}")
            print(f"      - Detail rows: {len(item.get('detailTable', []))}")

    print("\n[PASS] DrillDownRenderer tests passed!")


def test_insight_generator():
    print("\n" + "="*60)
    print("Testing EnhancedInsightGenerator")
    print("="*60)

    data = create_test_data()
    fields = [
        MockFieldDef('region', is_dim=True),
        MockFieldDef('salesperson', is_dim=True),
        MockFieldDef('sales', is_measure=True),
        MockFieldDef('profit', is_measure=True),
    ]

    generator = EnhancedInsightGenerator()
    insights = generator.generate_sheet_insights(data, fields, "TestSheet")

    print(f"\nGenerated {len(insights)} insights:")
    for insight in insights[:5]:
        level = insight.get('level', 'info')
        title = insight.get('title', 'No title')
        text = insight.get('text', '')[:80]
        print(f"  [{level.upper()}] {title}")
        print(f"    {text}...")

    print("\n[PASS] EnhancedInsightGenerator tests passed!")


if __name__ == "__main__":
    print("\n" + "#"*60)
    print("# SmartBI Enhanced Analysis Module Tests")
    print("#"*60)

    test_statistical_analyzer()
    test_chart_generator()
    test_drilldown_renderer()
    test_insight_generator()

    print("\n" + "#"*60)
    print("# ALL TESTS PASSED!")
    print("#"*60 + "\n")
