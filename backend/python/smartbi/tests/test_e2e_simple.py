# -*- coding: utf-8 -*-
"""
Simple E2E Test - All sheets
"""
import asyncio
import json
import os
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))
os.chdir(Path(__file__).parent.parent)

from dotenv import load_dotenv
load_dotenv()

import pandas as pd
from services.unified_analyzer import UnifiedAnalyzer, AnalysisOptions, AnalysisDepth
from services.analysis_cache import get_cache_manager


async def main():
    # Use the full 11-sheet test file
    test_file = Path(__file__).parent.parent / "Test.xlsx"
    if not test_file.exists():
        test_file = Path(__file__).parent / "test_complex_5sheets.xlsx"
    with open(test_file, "rb") as f:
        file_bytes = f.read()

    xlsx = pd.ExcelFile(test_file)
    sheet_names = xlsx.sheet_names

    print("=" * 60)
    print("E2E TEST: Excel -> Analysis -> Charts -> Save")
    print("=" * 60)
    print(f"File: {test_file.name} ({test_file.stat().st_size/1024:.1f} KB)")
    print(f"Sheets: {len(sheet_names)}")

    analyzer = UnifiedAnalyzer()
    cache = get_cache_manager()

    # First run (fresh)
    print("\n" + "-" * 60)
    print("FIRST RUN (Fresh Analysis)")
    print("-" * 60)

    results = []
    total_start = time.time()

    for i, name in enumerate(sheet_names):
        start = time.time()
        try:
            result = await analyzer.analyze(
                file_bytes=file_bytes,
                sheet_index=i,
                options=AnalysisOptions(depth=AnalysisDepth.STANDARD, use_cache=True)
            )
            elapsed = time.time() - start

            if result.success:
                results.append({
                    "sheet": name,
                    "success": True,
                    "time": elapsed,
                    "from_cache": result.from_cache,
                    "fields": len(result.fields) if result.fields else 0,
                    "scenario": result.scenario.scenario_name if result.scenario else "N/A",
                    "metrics": len(result.metrics) if result.metrics else 0,
                    "charts": len(result.charts) if result.charts else 0,
                    "insights": len(result.insights) if result.insights else 0
                })
                print(f"  [{i+1}] {name}: OK ({elapsed:.1f}s)")
                print(f"      Fields={len(result.fields) if result.fields else 0}, "
                      f"Metrics={len(result.metrics) if result.metrics else 0}, "
                      f"Charts={len(result.charts) if result.charts else 0}, "
                      f"Insights={len(result.insights) if result.insights else 0}")
            else:
                results.append({"sheet": name, "success": False, "error": result.error, "time": elapsed})
                print(f"  [{i+1}] {name}: FAILED ({elapsed:.1f}s) - {result.error[:50]}...")
        except Exception as e:
            elapsed = time.time() - start
            results.append({"sheet": name, "success": False, "error": str(e), "time": elapsed})
            print(f"  [{i+1}] {name}: ERROR ({elapsed:.1f}s) - {str(e)[:50]}...")

    first_total = time.time() - total_start
    print(f"\nFirst run total: {first_total:.1f}s")

    # Second run (cache)
    print("\n" + "-" * 60)
    print("SECOND RUN (Cache Test)")
    print("-" * 60)

    second_start = time.time()
    for i, name in enumerate(sheet_names):
        start = time.time()
        try:
            result = await analyzer.analyze(
                file_bytes=file_bytes,
                sheet_index=i,
                options=AnalysisOptions(depth=AnalysisDepth.STANDARD, use_cache=True)
            )
            elapsed = time.time() - start
            cache_status = "CACHE HIT" if result.from_cache else "CACHE MISS"
            print(f"  [{i+1}] {name}: {cache_status} ({elapsed*1000:.1f}ms)")
        except Exception as e:
            elapsed = time.time() - start
            print(f"  [{i+1}] {name}: ERROR ({elapsed*1000:.1f}ms)")

    second_total = time.time() - second_start
    print(f"\nSecond run total: {second_total:.2f}s")
    print(f"Speedup from cache: {first_total/second_total:.0f}x")

    # Output files
    print("\n" + "-" * 60)
    print("OUTPUT FILES (Cache Directory)")
    print("-" * 60)

    cache_dir = Path("smartbi_cache")
    if cache_dir.exists():
        for entry in sorted(cache_dir.iterdir()):
            if entry.is_dir():
                files = list(entry.glob("*"))
                total_size = sum(f.stat().st_size for f in files)
                print(f"  {entry.name}/")
                for f in files:
                    print(f"    - {f.name}: {f.stat().st_size/1024:.1f}KB")

    # Summary
    print("\n" + "=" * 60)
    print("SUMMARY")
    print("=" * 60)
    success_count = sum(1 for r in results if r.get("success", False))
    print(f"Sheets processed: {len(results)}")
    print(f"Successful: {success_count}/{len(results)}")
    print(f"First run time: {first_total:.1f}s")
    print(f"Second run time: {second_total:.2f}s")
    print(f"Cache speedup: {first_total/second_total:.0f}x")

    # Cache stats
    stats = cache.get_stats()
    print(f"\nCache stats:")
    print(f"  Total entries: {stats['totalEntries']}")
    print(f"  With analysis: {stats['withAnalysis']}")
    print(f"  Total size: {stats['totalSizeMB']:.2f}MB")

    await analyzer.close()

    # Save results
    with open(Path(__file__).parent / "e2e_results.json", "w", encoding="utf-8") as f:
        json.dump(results, f, ensure_ascii=False, indent=2)

    return success_count == len(results)


if __name__ == "__main__":
    success = asyncio.run(main())
    sys.exit(0 if success else 1)
