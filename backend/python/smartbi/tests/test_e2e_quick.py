# -*- coding: utf-8 -*-
"""
Quick E2E Test - Only tests first 2 sheets of each file with caching enabled.
Optimized for fast verification of core functionality.
"""
import asyncio
import json
import os
import sys
import time
from datetime import datetime
from pathlib import Path
from typing import Dict, Any

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


async def quick_test_file(
    analyzer: UnifiedAnalyzer,
    file_path: Path,
    file_name: str,
    max_sheets: int = 2
) -> Dict[str, Any]:
    """Quick test with limited sheets."""

    print(f"\n{'='*50}")
    print(f"Quick Test: {file_name}")
    print(f"{'='*50}")

    with open(file_path, "rb") as f:
        file_bytes = f.read()

    xlsx = pd.ExcelFile(file_path)
    sheet_names = xlsx.sheet_names[:max_sheets]  # Limit sheets

    print(f"Testing {len(sheet_names)}/{len(xlsx.sheet_names)} sheets")

    results = {"file": file_name, "sheets": [], "success": 0, "failed": 0}

    for i, sheet_name in enumerate(sheet_names):
        print(f"\n  [{i+1}/{len(sheet_names)}] {sheet_name}...", end=" ", flush=True)
        start = time.time()

        try:
            result = await analyzer.analyze(
                file_bytes=file_bytes,
                sheet_index=i,
                options=AnalysisOptions(
                    depth=AnalysisDepth.QUICK,  # Use QUICK mode
                    use_cache=True,  # Enable cache
                    save_to_cache=True,
                    max_charts=3,
                    max_insights=3
                )
            )

            elapsed = time.time() - start

            if result.success:
                chart_count = len(result.charts) if result.charts else 0
                insight_count = len(result.insights) if result.insights else 0
                print(f"OK ({elapsed:.1f}s, {chart_count} charts, {insight_count} insights)")
                results["success"] += 1
                results["sheets"].append({
                    "name": sheet_name,
                    "success": True,
                    "time_s": round(elapsed, 1),
                    "charts": chart_count,
                    "insights": insight_count
                })
            else:
                print(f"FAIL ({result.error[:40]}...)")
                results["failed"] += 1
                results["sheets"].append({
                    "name": sheet_name,
                    "success": False,
                    "error": result.error[:100]
                })

        except Exception as e:
            print(f"ERROR ({str(e)[:40]}...)")
            results["failed"] += 1
            results["sheets"].append({
                "name": sheet_name,
                "success": False,
                "error": str(e)[:100]
            })

    return results


async def main():
    print("="*50)
    print("SmartBI Quick E2E Test")
    print("="*50)

    test_files = [
        ("Test.xlsx", Path(__file__).parent.parent / "Test.xlsx"),
        ("test_complex_5sheets.xlsx", Path(__file__).parent.parent / "test_complex_5sheets.xlsx"),
    ]

    existing_files = [(name, path) for name, path in test_files if path.exists()]

    if not existing_files:
        print("ERROR: No test files found!")
        return False

    print(f"Testing {len(existing_files)} files (max 2 sheets each)")

    analyzer = UnifiedAnalyzer()
    all_results = []
    total_start = time.time()

    for file_name, file_path in existing_files:
        result = await quick_test_file(analyzer, file_path, file_name)
        all_results.append(result)

    await analyzer.close()

    total_time = time.time() - total_start
    total_success = sum(r["success"] for r in all_results)
    total_failed = sum(r["failed"] for r in all_results)

    print("\n" + "="*50)
    print("QUICK TEST SUMMARY")
    print("="*50)
    print(f"Total time: {total_time:.1f}s")
    print(f"Success: {total_success}")
    print(f"Failed: {total_failed}")
    print(f"Result: {'PASS' if total_failed == 0 else 'FAIL'}")

    return total_failed == 0


if __name__ == "__main__":
    success = asyncio.run(main())
    sys.exit(0 if success else 1)
