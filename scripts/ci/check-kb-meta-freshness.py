#!/usr/bin/env python3
"""CI lint: ensure §1/§2/§11 last-verified meta is not older than 6 weeks."""
import re, sys
from datetime import datetime, timedelta
from pathlib import Path

MANUAL = Path("docs/plans/restaurant-product-manual.html")
CHAPTERS = ["ch1", "ch2", "ch11"]
MAX_AGE_DAYS = 42  # 6 weeks

def main():
    text = MANUAL.read_text(encoding="utf-8")
    failures = []
    for ch in CHAPTERS:
        # Find section and look for meta comment within 3 lines of h1
        pattern = rf'id="{ch}".*?<!-- last-verified-against-product: (\d{{4}}-\d{{2}}-\d{{2}}) -->'
        m = re.search(pattern, text, re.DOTALL)
        if not m:
            failures.append(f"  {ch}: missing <!-- last-verified-against-product: YYYY-MM-DD --> meta")
            continue
        date_str = m.group(1)
        try:
            verified_date = datetime.strptime(date_str, "%Y-%m-%d")
        except ValueError:
            failures.append(f"  {ch}: invalid date format '{date_str}'")
            continue
        age = (datetime.now() - verified_date).days
        if age > MAX_AGE_DAYS:
            failures.append(
                f"  {ch}: last verified {date_str} ({age} days ago) — exceeds {MAX_AGE_DAYS}-day limit. "
                f"Check if §{ch[2:]} UI changed; update meta when confirmed current."
            )
    if failures:
        print("FAIL: KB meta freshness check failed:")
        for f in failures:
            print(f)
        sys.exit(1)
    print(f"PASS: §1/§2/§11 last-verified meta all within {MAX_AGE_DAYS} days.")

if __name__ == "__main__":
    main()
