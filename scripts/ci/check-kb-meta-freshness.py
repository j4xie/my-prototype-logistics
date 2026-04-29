#!/usr/bin/env python3
"""CI lint: ensure manual chapters' last-verified meta is not older than 6 weeks.

Restaurant manual: §1, §2, §11 (Tier 1 chapters)
Factory manual: §0A, §0B, §6, §7, §10 (Tier 1 chapters)
"""
import re, sys
from datetime import datetime
from pathlib import Path

MANUALS = {
    "restaurant-product-manual.html": {
        "path": Path("docs/plans/restaurant-product-manual.html"),
        "chapters": ["ch1", "ch2", "ch11"],
    },
    "factory-operation-manual.html": {
        "path": Path("docs/plans/factory-operation-manual.html"),
        "chapters": ["ch0a", "ch0b", "ch6a", "ch7a", "ch10a"],
    },
}

MAX_AGE_DAYS = 42  # 6 weeks

def main():
    failures = []
    for manual_name, cfg in MANUALS.items():
        if not cfg["path"].exists():
            failures.append(f"  {manual_name}: file not found at {cfg['path']}")
            continue
        text = cfg["path"].read_text(encoding="utf-8")
        for ch in cfg["chapters"]:
            pattern = rf'id="{ch}".*?<!-- last-verified-against-product: (\d{{4}}-\d{{2}}-\d{{2}}) -->'
            m = re.search(pattern, text, re.DOTALL)
            if not m:
                failures.append(f"  {manual_name} {ch}: missing <!-- last-verified-against-product: YYYY-MM-DD --> meta")
                continue
            date_str = m.group(1)
            try:
                verified_date = datetime.strptime(date_str, "%Y-%m-%d")
            except ValueError:
                failures.append(f"  {manual_name} {ch}: invalid date format '{date_str}'")
                continue
            age = (datetime.now() - verified_date).days
            if age > MAX_AGE_DAYS:
                failures.append(
                    f"  {manual_name} {ch}: last verified {date_str} ({age} days ago) — exceeds {MAX_AGE_DAYS}-day limit. "
                    f"Check if chapter UI changed; update meta when confirmed current."
                )
    if failures:
        print("FAIL: KB meta freshness check failed:")
        for f in failures:
            print(f)
        sys.exit(1)
    total_chapters = sum(len(c["chapters"]) for c in MANUALS.values())
    print(f"PASS: {total_chapters} chapters across {len(MANUALS)} manuals all have fresh meta (within {MAX_AGE_DAYS} days).")

if __name__ == "__main__":
    main()
