#!/usr/bin/env python3
"""scripts/phase2b/sample-tier1-goldens.py

Stratified sample N cases from the V9 test corpus into tier1-50.jsonl.

Stratification dimensions:
- intent_category (ANALYSIS / DATA_OP / FORM / SCHEDULE / SYSTEM / etc) — 5-8 each
- sensitivity_level (LOW / MEDIUM / HIGH / CRITICAL) — distributed where data allows
- expected MatchMethod — at least 5 per stage where data allows
- isMultiIntent True — at least 5 (cannot be enforced from corpus shape; best effort)

Reads:
- backend/java/cretas-api/src/test/java/com/cretas/aims/service/IntentResponseE2EV9Test.java
- TwoStageIntentClassifierV9*.java (4 variants)
- AIIntentServiceContextTest.java (impl/ subdirectory)

Output: tests/fixtures/java-intent-golden/intent-tier1-50.jsonl

Usage:
  python3 scripts/phase2b/sample-tier1-goldens.py [--seed 42] [--n 50]

Notes on @CsvSource format handling:
- Each row inside `@CsvSource({ ... })` is a quoted string like
  "考勤统计, ATTENDANCE_STATS" or "考勤统计, ATTENDANCE, ATTENDANCE_STATS".
- Some rows have 2 cols (query, intentCode), some 3 cols (query, domain,
  intent), some 4 cols (query, domain, action, intent).
- This parser uses a regex to extract each quoted row from the body, then
  splits each row by `,` to get cells. The intentCode is taken as the LAST
  cell since across all observed shapes the intent code is always last.
"""
from __future__ import annotations

import argparse
import json
import pathlib
import random
import re
import sys
from collections import defaultdict


REPO_ROOT = pathlib.Path(__file__).resolve().parents[2]
TEST_DIR = REPO_ROOT / "backend/java/cretas-api/src/test/java/com/cretas/aims/service"
OUTPUT = REPO_ROOT / "tests/fixtures/java-intent-golden/intent-tier1-50.jsonl"

# Match the body of @CsvSource({ ... }) — including newlines.
CSVSOURCE_PATTERN = re.compile(
    r'@CsvSource\s*\(\s*\{(.*?)\}\s*\)',
    re.DOTALL,
)

# Match each quoted row inside the body. Java CsvSource rows are simple
# double-quoted strings — no embedded escapes in the V9 corpus.
ROW_PATTERN = re.compile(r'"([^"]*)"')


def extract_csv_rows(java_file: pathlib.Path) -> list[str]:
    """Extract per-row strings from @CsvSource annotations in a Java test file.

    Returns one string per row (the unquoted CSV row content, e.g.
    "考勤统计, ATTENDANCE_STATS"). Multiple @CsvSource blocks in one file
    are aggregated.
    """
    text = java_file.read_text(encoding="utf-8")
    rows: list[str] = []
    for match in CSVSOURCE_PATTERN.finditer(text):
        body = match.group(1)
        for row_match in ROW_PATTERN.finditer(body):
            row = row_match.group(1).strip()
            if row:
                rows.append(row)
    return rows


def parse_csv_row(row: str) -> dict | None:
    """Parse one CSV row into {query, expectedIntentCode, category}.

    Observed shapes in V9 corpus:
    - 2 cols:  "query, intentCode"
    - 3 cols:  "query, domain, intentCode"
    - 4 cols:  "query, domain, action, intentCode"

    Strategy: query = parts[0], intentCode = parts[-1] (always last),
    category = parts[1] when 3+ cols, else 'UNKNOWN'.
    """
    parts = [p.strip() for p in row.split(",")]
    if len(parts) < 2:
        return None
    query = parts[0]
    intent_code = parts[-1]
    if not query or not intent_code:
        return None
    # Heuristic: 3+ cols means parts[1] is a domain/category label.
    category = parts[1] if len(parts) >= 3 else "UNKNOWN"
    return {
        "query": query,
        "expectedIntentCode": intent_code,
        "category": category,
        "sensitivity": "LOW",  # default; corpus does not annotate sensitivity
    }


def stratify_sample(cases: list[dict], n: int, seed: int) -> list[dict]:
    """Sample n cases with stratification by category."""
    random.seed(seed)
    by_category: dict[str, list[dict]] = defaultdict(list)
    # Dedupe by query — different files share rows
    seen_queries: set[str] = set()
    deduped: list[dict] = []
    for c in cases:
        if c["query"] in seen_queries:
            continue
        seen_queries.add(c["query"])
        deduped.append(c)
        by_category[c["category"]].append(c)

    target_per_category = max(n // max(len(by_category), 1), 1)
    selected: list[dict] = []
    selected_keys: set[str] = set()
    for _, group in by_category.items():
        random.shuffle(group)
        for c in group[:target_per_category]:
            selected.append(c)
            selected_keys.add(c["query"])

    # If under target n, pad from remaining
    if len(selected) < n:
        remaining = [c for c in deduped if c["query"] not in selected_keys]
        random.shuffle(remaining)
        for c in remaining:
            if len(selected) >= n:
                break
            selected.append(c)
            selected_keys.add(c["query"])

    return selected[:n]


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--n", type=int, default=50)
    args = parser.parse_args()

    sources = [
        TEST_DIR / "IntentResponseE2EV9Test.java",
        TEST_DIR / "TwoStageIntentClassifierV9Test.java",
        TEST_DIR / "TwoStageIntentClassifierV9ComprehensiveTest.java",
        TEST_DIR / "TwoStageIntentClassifierV9ComplexScenariosTest.java",
        TEST_DIR / "TwoStageIntentClassifierV9SimulatedTest.java",
        TEST_DIR / "impl/AIIntentServiceContextTest.java",
    ]

    all_cases: list[dict] = []
    for src in sources:
        if not src.exists():
            print(f"SKIP: {src} not found", file=sys.stderr)
            continue
        for row in extract_csv_rows(src):
            c = parse_csv_row(row)
            if c:
                all_cases.append(c)

    print(f"Collected {len(all_cases)} raw cases from {len(sources)} files",
          file=sys.stderr)

    if not all_cases:
        print(
            "ERROR: no cases parsed; check @CsvSource format and parse_csv_row",
            file=sys.stderr,
        )
        return 1

    selected = stratify_sample(all_cases, args.n, args.seed)
    print(f"Selected {len(selected)} cases", file=sys.stderr)

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    with OUTPUT.open("w", encoding="utf-8") as f:
        for i, c in enumerate(selected, 1):
            f.write(json.dumps({
                "id": f"tier1-{i:03d}",
                "query": c["query"],
                "factoryId": "F001",
                "userId": "test-user",
                "username": "test",
                "role": "factory_super_admin",
                "businessType": "FACTORY",
                "expectedIntentCode": c["expectedIntentCode"],
                "category": c.get("category"),
                "sensitivity": c.get("sensitivity"),
            }, ensure_ascii=False) + "\n")

    print(f"Wrote {OUTPUT}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
