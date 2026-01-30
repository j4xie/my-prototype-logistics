# -*- coding: utf-8 -*-
"""
Real-time E2E Test with Phase Monitoring

Monitors:
- Phase 1: Data extraction time
- Phase 2: Field detection + scenario recognition (parallel)
- Phase 3: Metric calculation + chart recommendation + insight generation (parallel)
- Total time and error rate

Comprehensive analysis of charts, AI insights accuracy and depth.
"""
import asyncio
import json
import os
import sys
import time
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Any, Optional

# Fix Windows console encoding
if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    sys.stderr.reconfigure(encoding='utf-8', errors='replace')

sys.path.insert(0, str(Path(__file__).parent.parent))
os.chdir(Path(__file__).parent.parent)

from dotenv import load_dotenv
load_dotenv()

import pandas as pd
from services.unified_analyzer import UnifiedAnalyzer, AnalysisOptions, AnalysisDepth


class PhaseTimer:
    """Track timing for analysis phases."""

    def __init__(self):
        self.phases: Dict[str, Dict] = {}
        self.current_phase: Optional[str] = None
        self.phase_start: Optional[float] = None

    def start_phase(self, name: str):
        self.current_phase = name
        self.phase_start = time.time()
        print(f"  [...] Starting {name}...")

    def end_phase(self, success: bool = True, notes: str = ""):
        if self.current_phase and self.phase_start:
            elapsed = time.time() - self.phase_start
            self.phases[self.current_phase] = {
                "elapsed_ms": int(elapsed * 1000),
                "success": success,
                "notes": notes
            }
            status = "OK" if success else "FAIL"
            print(f"  [{status}] {self.current_phase}: {elapsed*1000:.0f}ms {notes}")
            self.current_phase = None
            self.phase_start = None

    def get_summary(self) -> Dict:
        total_ms = sum(p["elapsed_ms"] for p in self.phases.values())
        return {
            "phases": self.phases,
            "total_ms": total_ms,
            "success_count": sum(1 for p in self.phases.values() if p["success"]),
            "total_count": len(self.phases)
        }


class ResultAnalyzer:
    """Analyze quality of analysis results."""

    @staticmethod
    def analyze_data_quality(result) -> Dict:
        """Analyze data extraction quality."""
        score = 0
        issues = []

        # Check field detection
        if result.fields:
            score += 25
            # Check for proper type detection
            type_variety = len(set(f.data_type for f in result.fields))
            if type_variety >= 2:
                score += 10
            # Check semantic types
            semantic_variety = len(set(f.semantic_type for f in result.fields))
            if semantic_variety >= 2:
                score += 10
        else:
            issues.append("No fields detected")

        # Check scenario detection
        if result.scenario:
            score += 25
            if result.scenario.confidence > 0.7:
                score += 10
            if result.scenario.dimensions:
                score += 5
            if result.scenario.measures:
                score += 5
        else:
            issues.append("No scenario detected")

        return {
            "score": min(score, 100),
            "issues": issues,
            "field_count": len(result.fields) if result.fields else 0,
            "scenario": result.scenario.scenario_name if result.scenario else "None",
            "scenario_confidence": result.scenario.confidence if result.scenario else 0
        }

    @staticmethod
    def analyze_chart_quality(result) -> Dict:
        """Analyze chart recommendation quality."""
        score = 0
        issues = []
        charts = result.charts or []

        if not charts:
            issues.append("No charts generated")
            return {"score": 0, "issues": issues, "chart_count": 0, "chart_types": []}

        # Base score for having charts
        score += 20

        # Chart variety
        chart_types = [c.chart_type for c in charts]
        unique_types = set(chart_types)
        if len(unique_types) >= 2:
            score += 15
        if len(unique_types) >= 3:
            score += 10

        # Check chart configuration completeness
        valid_configs = 0
        for chart in charts:
            config = chart.config
            if config and isinstance(config, dict):
                has_series = "series" in config
                has_x_or_y = "xAxis" in config or "yAxis" in config
                if has_series or has_x_or_y:
                    valid_configs += 1

        if valid_configs > 0:
            score += 20 * (valid_configs / len(charts))

        # Check for titles and reasons
        titled_charts = sum(1 for c in charts if c.title and len(c.title) > 3)
        reasoned_charts = sum(1 for c in charts if c.reason and len(c.reason) > 5)

        score += 15 * (titled_charts / len(charts))
        score += 10 * (reasoned_charts / len(charts))

        # X/Y axis field selection
        with_axes = sum(1 for c in charts if c.x_axis or c.y_axis)
        score += 10 * (with_axes / len(charts))

        return {
            "score": min(int(score), 100),
            "issues": issues,
            "chart_count": len(charts),
            "chart_types": list(unique_types),
            "valid_configs": valid_configs,
            "titled_charts": titled_charts,
            "reasoned_charts": reasoned_charts
        }

    @staticmethod
    def analyze_insight_quality(result) -> Dict:
        """Analyze AI insight quality."""
        score = 0
        issues = []
        insights = result.insights or []

        if not insights:
            issues.append("No insights generated")
            return {"score": 0, "issues": issues, "insight_count": 0, "types": []}

        # Base score
        score += 20

        # Insight variety
        insight_types = [i.type for i in insights]
        unique_types = set(insight_types)
        if len(unique_types) >= 2:
            score += 15

        # Check text quality (length and content)
        quality_insights = 0
        for insight in insights:
            text_len = len(insight.text) if insight.text else 0
            has_numbers = any(c.isdigit() for c in (insight.text or ""))
            has_recommendation = bool(insight.recommendation)

            if text_len > 30 and has_numbers:
                quality_insights += 1

        if quality_insights > 0:
            score += 30 * (quality_insights / len(insights))

        # Sentiment variety
        sentiments = set(i.sentiment for i in insights)
        if len(sentiments) >= 2:
            score += 10

        # Importance scoring
        high_importance = sum(1 for i in insights if i.importance >= 7)
        if high_importance > 0:
            score += 15

        # Actionable recommendations
        with_recs = sum(1 for i in insights if i.recommendation)
        score += 10 * (with_recs / len(insights))

        return {
            "score": min(int(score), 100),
            "issues": issues,
            "insight_count": len(insights),
            "types": list(unique_types),
            "quality_insights": quality_insights,
            "with_recommendations": with_recs
        }

    @staticmethod
    def compute_overall_score(data_quality: Dict, chart_quality: Dict, insight_quality: Dict) -> Dict:
        """Compute weighted overall score."""
        weights = {
            "data": 0.30,
            "chart": 0.35,
            "insight": 0.35
        }

        overall = (
            data_quality["score"] * weights["data"] +
            chart_quality["score"] * weights["chart"] +
            insight_quality["score"] * weights["insight"]
        )

        return {
            "overall_score": round(overall, 1),
            "data_score": data_quality["score"],
            "chart_score": chart_quality["score"],
            "insight_score": insight_quality["score"],
            "grade": "A" if overall >= 85 else "B" if overall >= 70 else "C" if overall >= 55 else "D" if overall >= 40 else "F"
        }


async def test_single_file(
    analyzer: UnifiedAnalyzer,
    file_path: Path,
    file_name: str
) -> Dict[str, Any]:
    """Test a single Excel file with real-time monitoring."""

    print(f"\n{'='*60}")
    print(f"Testing: {file_name}")
    print(f"{'='*60}")

    with open(file_path, "rb") as f:
        file_bytes = f.read()

    xlsx = pd.ExcelFile(file_path)
    sheet_names = xlsx.sheet_names

    print(f"File size: {file_path.stat().st_size/1024:.1f} KB")
    print(f"Sheets: {len(sheet_names)} ({', '.join(sheet_names[:5])}{'...' if len(sheet_names) > 5 else ''})")

    file_results = {
        "file": file_name,
        "sheet_count": len(sheet_names),
        "sheets": [],
        "errors": [],
        "start_time": datetime.now().isoformat()
    }

    total_start = time.time()

    for i, sheet_name in enumerate(sheet_names):
        print(f"\n--- Sheet [{i+1}/{len(sheet_names)}]: {sheet_name} ---")
        timer = PhaseTimer()

        sheet_result = {
            "sheet_name": sheet_name,
            "sheet_index": i,
            "success": False,
            "error": None,
            "phases": {},
            "quality": {}
        }

        try:
            # Run analysis with timing
            timer.start_phase("Full Analysis")
            result = await analyzer.analyze(
                file_bytes=file_bytes,
                sheet_index=i,
                options=AnalysisOptions(
                    depth=AnalysisDepth.STANDARD,
                    use_cache=False,  # Fresh analysis for testing
                    save_to_cache=True,
                    max_charts=5,
                    max_insights=5
                )
            )
            timer.end_phase(result.success, f"cache={result.from_cache}")

            if result.success:
                sheet_result["success"] = True
                sheet_result["phases"] = timer.get_summary()

                # Analyze quality
                data_quality = ResultAnalyzer.analyze_data_quality(result)
                chart_quality = ResultAnalyzer.analyze_chart_quality(result)
                insight_quality = ResultAnalyzer.analyze_insight_quality(result)
                overall = ResultAnalyzer.compute_overall_score(
                    data_quality, chart_quality, insight_quality
                )

                sheet_result["quality"] = {
                    "overall": overall,
                    "data": data_quality,
                    "chart": chart_quality,
                    "insight": insight_quality
                }

                # Print quality summary
                print(f"\n  Quality Assessment:")
                print(f"    Data:    {data_quality['score']:3d}/100 ({data_quality['field_count']} fields, scenario={data_quality['scenario']})")
                print(f"    Charts:  {chart_quality['score']:3d}/100 ({chart_quality['chart_count']} charts: {chart_quality['chart_types']})")
                print(f"    Insights:{insight_quality['score']:3d}/100 ({insight_quality['insight_count']} insights)")
                print(f"    Overall: {overall['overall_score']:.1f}/100 (Grade: {overall['grade']})")

                # Store counts
                sheet_result["metrics_count"] = len(result.metrics) if result.metrics else 0
                sheet_result["charts_count"] = len(result.charts) if result.charts else 0
                sheet_result["insights_count"] = len(result.insights) if result.insights else 0
                sheet_result["processing_time_ms"] = result.processing_time_ms

            else:
                sheet_result["error"] = result.error
                file_results["errors"].append({
                    "sheet": sheet_name,
                    "error": result.error
                })
                print(f"  [ERROR] {result.error[:100]}...")

        except Exception as e:
            sheet_result["error"] = str(e)
            file_results["errors"].append({
                "sheet": sheet_name,
                "error": str(e)
            })
            print(f"  [EXCEPTION] {str(e)[:100]}...")

        file_results["sheets"].append(sheet_result)

    total_time = time.time() - total_start
    file_results["total_time_s"] = round(total_time, 2)
    file_results["end_time"] = datetime.now().isoformat()

    # Summary
    success_count = sum(1 for s in file_results["sheets"] if s["success"])
    error_count = len(file_results["errors"])

    file_results["summary"] = {
        "total_sheets": len(sheet_names),
        "success": success_count,
        "errors": error_count,
        "success_rate": round(success_count / len(sheet_names) * 100, 1) if sheet_names else 0,
        "total_time_s": round(total_time, 2),
        "avg_time_per_sheet_s": round(total_time / len(sheet_names), 2) if sheet_names else 0
    }

    # Quality averages
    quality_scores = [s["quality"]["overall"]["overall_score"]
                     for s in file_results["sheets"]
                     if s["success"] and "quality" in s]
    if quality_scores:
        file_results["summary"]["avg_quality_score"] = round(sum(quality_scores) / len(quality_scores), 1)

    print(f"\n{'='*60}")
    print(f"FILE SUMMARY: {file_name}")
    print(f"{'='*60}")
    print(f"  Success: {success_count}/{len(sheet_names)} ({file_results['summary']['success_rate']}%)")
    print(f"  Errors: {error_count}")
    print(f"  Total time: {total_time:.1f}s ({file_results['summary']['avg_time_per_sheet_s']:.1f}s/sheet)")
    if quality_scores:
        print(f"  Avg quality: {file_results['summary']['avg_quality_score']:.1f}/100")

    return file_results


async def main():
    print("="*60)
    print("SmartBI E2E Real-time Test")
    print("="*60)
    print(f"Start time: {datetime.now().isoformat()}")

    # Test files
    test_files = [
        ("Test.xlsx", Path(__file__).parent.parent / "Test.xlsx"),
        ("test_complex_5sheets.xlsx", Path(__file__).parent.parent / "test_complex_5sheets.xlsx"),
        ("test_complex_scenarios.xlsx", Path(__file__).parent / "test_complex_scenarios.xlsx"),
    ]

    # Filter to existing files
    existing_files = [(name, path) for name, path in test_files if path.exists()]

    if not existing_files:
        print("ERROR: No test files found!")
        return False

    print(f"Found {len(existing_files)} test files:")
    for name, path in existing_files:
        print(f"  - {name} ({path.stat().st_size/1024:.1f} KB)")

    # Initialize analyzer
    analyzer = UnifiedAnalyzer()

    all_results = {
        "test_run": {
            "start_time": datetime.now().isoformat(),
            "python_version": sys.version,
            "test_files": len(existing_files)
        },
        "files": [],
        "summary": {}
    }

    # Test each file
    for file_name, file_path in existing_files:
        file_result = await test_single_file(analyzer, file_path, file_name)
        all_results["files"].append(file_result)

    await analyzer.close()

    # Overall summary
    all_results["test_run"]["end_time"] = datetime.now().isoformat()

    total_sheets = sum(f["summary"]["total_sheets"] for f in all_results["files"])
    total_success = sum(f["summary"]["success"] for f in all_results["files"])
    total_errors = sum(f["summary"]["errors"] for f in all_results["files"])

    all_quality = []
    for f in all_results["files"]:
        if "avg_quality_score" in f["summary"]:
            all_quality.append(f["summary"]["avg_quality_score"])

    all_results["summary"] = {
        "total_files": len(existing_files),
        "total_sheets": total_sheets,
        "total_success": total_success,
        "total_errors": total_errors,
        "success_rate": round(total_success / total_sheets * 100, 1) if total_sheets > 0 else 0,
        "avg_quality_score": round(sum(all_quality) / len(all_quality), 1) if all_quality else None
    }

    # Print final summary
    print("\n" + "="*60)
    print("FINAL SUMMARY")
    print("="*60)
    print(f"Files tested: {len(existing_files)}")
    print(f"Total sheets: {total_sheets}")
    print(f"Successful: {total_success} ({all_results['summary']['success_rate']}%)")
    print(f"Errors: {total_errors}")
    if all_quality:
        print(f"Average quality: {all_results['summary']['avg_quality_score']}/100")

    # Error details
    if total_errors > 0:
        print("\nError Details:")
        for f in all_results["files"]:
            for err in f.get("errors", []):
                print(f"  [{f['file']}:{err['sheet']}] {err['error'][:80]}...")

    # Save results
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    result_file = Path(__file__).parent / f"e2e_realtime_results_{timestamp}.json"

    with open(result_file, "w", encoding="utf-8") as f:
        json.dump(all_results, f, ensure_ascii=False, indent=2)

    print(f"\nResults saved to: {result_file.name}")

    # Verification checklist
    print("\n" + "="*60)
    print("VERIFICATION CHECKLIST")
    print("="*60)
    print(f"[{'OK' if total_errors == 0 else 'FAIL'}] No errors during analysis")
    print(f"[{'OK' if total_success == total_sheets else 'FAIL'}] All sheets analyzed successfully")
    print(f"[{'OK' if all_quality and min(all_quality) >= 50 else 'FAIL'}] Quality score >= 50 for all files")

    success = total_errors == 0 and total_success == total_sheets

    return success


if __name__ == "__main__":
    success = asyncio.run(main())
    sys.exit(0 if success else 1)
