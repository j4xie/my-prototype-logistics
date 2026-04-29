#!/usr/bin/env python3
"""CI lint: ensure §B synthesis anchor refs match actual section IDs."""
import re, sys
from pathlib import Path

MANUAL = Path("docs/plans/restaurant-product-manual.html")

def main():
    text = MANUAL.read_text(encoding="utf-8")
    # Collect all section IDs
    all_ids = set(re.findall(r'<section\s+id="([^"]+)"', text))
    # Find synthesis section content
    m = re.search(r'<section id="synthesis">(.*?)</section>', text, re.DOTALL)
    if not m:
        print("FAIL: <section id='synthesis'> not found")
        sys.exit(1)
    synthesis_html = m.group(1)
    # Find all anchor hrefs in synthesis
    hrefs = re.findall(r'href="#([^"]+)"', synthesis_html)
    bad = [h for h in hrefs if h not in all_ids]
    if bad:
        print(f"FAIL: §B synthesis has {len(bad)} broken anchor(s): {bad}")
        sys.exit(1)
    print(f"PASS: §B synthesis anchor consistency OK ({len(hrefs)} refs, all valid).")

if __name__ == "__main__":
    main()
