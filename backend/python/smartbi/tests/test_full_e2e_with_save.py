"""
Full End-to-End Test: Excel → Analysis → Charts → Save

Tests the complete flow:
1. Load Excel file (all sheets)
2. Raw export (JSON, CSV, MD)
3. Field detection (LLM + cache)
4. Scenario detection (LLM + cache)
5. Metric calculation (LLM + rule learning)
6. Chart recommendation (LLM + cache)
7. Insight generation
8. Save all results (cached + output files)

Measures:
- Per-sheet processing time
- Total processing time
- Cache hit/miss rates
- Output file verification
"""

import asyncio
import json
import os
import sys
import time
from datetime import datetime
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))
os.chdir(Path(__file__).parent.parent)

# Load environment
from dotenv import load_dotenv
load_dotenv()

import pandas as pd
from services.unified_analyzer import UnifiedAnalyzer, AnalysisOptions, AnalysisDepth
from services.analysis_cache import get_cache_manager


async def test_full_e2e():
    """Run full end-to-end test on all sheets."""

    print("=" * 70)
    print("FULL END-TO-END TEST: Excel → Analysis → Charts → Save")
    print("=" * 70)

    # Test file
    test_file = Path(__file__).parent / "test_complex_5sheets.xlsx"
    if not test_file.exists():
        print(f"ERROR: Test file not found: {test_file}")
        return False

    print(f"\nTest file: {test_file}")
    print(f"File size: {test_file.stat().st_size / 1024:.1f} KB")

    # Read file bytes
    with open(test_file, "rb") as f:
        file_bytes = f.read()

    # Get sheet names
    xlsx = pd.ExcelFile(test_file)
    sheet_names = xlsx.sheet_names
    print(f"Sheets found: {len(sheet_names)}")
    for i, name in enumerate(sheet_names):
        df = pd.read_excel(xlsx, sheet_name=name)
        print(f"  [{i}] {name}: {len(df)} rows × {len(df.columns)} cols")

    # Initialize analyzer
    analyzer = UnifiedAnalyzer()
    cache_manager = get_cache_manager()

    # Clear cache for fresh test
    print("\n" + "-" * 70)
    print("Clearing cache for fresh test...")
    cache_manager.clear_all()

    # Results tracking
    results = {
        "sheets": [],
        "total_time": 0,
        "cache_stats": {},
        "output_files": []
    }

    total_start = time.time()

    # Process each sheet
    print("\n" + "=" * 70)
    print("PROCESSING ALL SHEETS")
    print("=" * 70)

    for sheet_index, sheet_name in enumerate(sheet_names):
        print(f"\n{'─' * 70}")
        print(f"Sheet {sheet_index + 1}/{len(sheet_names)}: {sheet_name}")
        print("─" * 70)

        sheet_start = time.time()

        try:
            # Run analysis
            options = AnalysisOptions(
                depth=AnalysisDepth.STANDARD,
                include_predictions=False,  # Skip predictions for speed
                use_cache=True,
                force_refresh=False,
                max_charts=5
            )

            result = await analyzer.analyze(
                file_bytes=file_bytes,
                sheet_index=sheet_index,
                options=options
            )

            sheet_time = time.time() - sheet_start

            # Extract result info
            sheet_result = {
                "sheet_name": sheet_name,
                "sheet_index": sheet_index,
                "success": result.success,
                "time_seconds": sheet_time,
                "from_cache": result.from_cache,
                "error": result.error if not result.success else None
            }

            if result.success:
                # Field detection results
                fields_count = len(result.fields) if result.fields else 0
                sheet_result["fields_count"] = fields_count

                # Scenario
                if result.scenario:
                    sheet_result["scenario"] = result.scenario.scenario
                    sheet_result["scenario_name"] = result.scenario.scenario_name
                    sheet_result["scenario_confidence"] = result.scenario.confidence

                # Metrics
                metrics_count = len(result.metrics) if result.metrics else 0
                sheet_result["metrics_count"] = metrics_count

                # Charts
                charts_count = len(result.charts) if result.charts else 0
                sheet_result["charts_count"] = charts_count
                if result.charts:
                    sheet_result["chart_types"] = [c.chart_type for c in result.charts]

                # Insights
                insights_count = len(result.insights) if result.insights else 0
                sheet_result["insights_count"] = insights_count

                # Cache info
                if result.cache_key:
                    sheet_result["cache_key"] = result.cache_key

                print(f"  [OK] Success (from_cache: {result.from_cache})")
                print(f"    - Fields: {fields_count}")
                if result.scenario:
                    print(f"    - Scenario: {result.scenario.scenario_name} "
                          f"(confidence: {result.scenario.confidence:.2f})")
                print(f"    - Metrics: {metrics_count}")
                print(f"    - Charts: {charts_count}")
                if result.charts:
                    print(f"      Types: {[c.chart_type for c in result.charts]}")
                print(f"    - Insights: {insights_count}")
                print(f"    - Time: {sheet_time:.2f}s")
            else:
                print(f"  [FAIL] Failed: {result.error}")

            results["sheets"].append(sheet_result)

        except Exception as e:
            sheet_time = time.time() - sheet_start
            print(f"  [FAIL] Exception: {e}")
            import traceback
            traceback.print_exc()
            results["sheets"].append({
                "sheet_name": sheet_name,
                "sheet_index": sheet_index,
                "success": False,
                "time_seconds": sheet_time,
                "error": str(e)
            })

    total_time = time.time() - total_start
    results["total_time"] = total_time

    # Check cached output files
    print("\n" + "=" * 70)
    print("CHECKING OUTPUT FILES")
    print("=" * 70)

    cache_dir = Path(__file__).parent.parent / "cache"
    if cache_dir.exists():
        for cache_subdir in sorted(cache_dir.iterdir()):
            if cache_subdir.is_dir():
                files = list(cache_subdir.glob("*"))
                file_info = {
                    "cache_key": cache_subdir.name,
                    "files": []
                }
                print(f"\n  Cache: {cache_subdir.name}/")
                for f in files:
                    size_kb = f.stat().st_size / 1024
                    file_info["files"].append({
                        "name": f.name,
                        "size_kb": size_kb
                    })
                    print(f"    • {f.name}: {size_kb:.1f} KB")
                results["output_files"].append(file_info)
    else:
        print("  No cache directory found")

    # Summary
    print("\n" + "=" * 70)
    print("SUMMARY")
    print("=" * 70)

    successful = sum(1 for s in results["sheets"] if s["success"])
    failed = len(results["sheets"]) - successful
    from_cache = sum(1 for s in results["sheets"] if s.get("from_cache", False))

    print(f"\nTotal sheets: {len(results['sheets'])}")
    print(f"Successful: {successful}")
    print(f"Failed: {failed}")
    print(f"From cache: {from_cache}")
    print(f"\nTotal time: {total_time:.2f}s")
    print(f"Average per sheet: {total_time / len(results['sheets']):.2f}s")

    # Per-sheet breakdown
    print("\nPer-sheet breakdown:")
    for s in results["sheets"]:
        status = "[OK]" if s["success"] else "[FAIL]"
        cache = "(cache)" if s.get("from_cache", False) else "(fresh)"
        print(f"  {status} {s['sheet_name']}: {s['time_seconds']:.2f}s {cache}")
        if s.get("charts_count"):
            print(f"      Charts: {s.get('chart_types', [])}")

    # Save test results
    results_file = Path(__file__).parent / "e2e_test_results.json"
    with open(results_file, "w", encoding="utf-8") as f:
        json.dump(results, f, ensure_ascii=False, indent=2, default=str)
    print(f"\nTest results saved to: {results_file}")

    # Run again to test cache
    print("\n" + "=" * 70)
    print("SECOND RUN (Testing Cache)")
    print("=" * 70)

    second_start = time.time()
    cache_results = []

    for sheet_index, sheet_name in enumerate(sheet_names):
        sheet_start = time.time()
        try:
            result = await analyzer.analyze(
                file_bytes=file_bytes,
                sheet_index=sheet_index,
                options=AnalysisOptions(
                    depth=AnalysisDepth.STANDARD,
                    use_cache=True
                )
            )
            sheet_time = time.time() - sheet_start
            cache_results.append({
                "sheet": sheet_name,
                "from_cache": result.from_cache,
                "time": sheet_time,
                "success": result.success
            })
            print(f"  {sheet_name}: {sheet_time*1000:.1f}ms (cache: {result.from_cache})")
        except Exception as e:
            print(f"  {sheet_name}: ERROR - {e}")

    second_time = time.time() - second_start
    print(f"\nSecond run total: {second_time:.2f}s")
    print(f"Speedup from cache: {total_time / second_time:.1f}x")

    # Close analyzer
    await analyzer.close()

    return successful == len(results["sheets"])


async def main():
    """Main entry point."""
    success = await test_full_e2e()
    print("\n" + "=" * 70)
    if success:
        print("TEST PASSED: All sheets processed successfully")
    else:
        print("TEST FAILED: Some sheets had errors")
    print("=" * 70)
    return 0 if success else 1


if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)
