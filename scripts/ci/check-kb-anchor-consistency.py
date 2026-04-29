#!/usr/bin/env python3
"""CI lint: ensure synthesis section anchor refs match actual section IDs across manuals."""
import re, sys
from pathlib import Path

MANUALS = [
    Path("docs/plans/restaurant-product-manual.html"),
    Path("docs/plans/factory-operation-manual.html"),
]


def extract_synthesis(text: str) -> str | None:
    """Extract <section id="synthesis">...</section> with balanced nested <section> tags.

    The restaurant manual has flat <h3 id="syn-N"> inside one <section id="synthesis">.
    The factory manual has nested <section> for each scenario, so a non-greedy regex
    would stop at the first inner </section>. This walker counts opens/closes.
    """
    m = re.search(r'<section\s+id="synthesis">', text)
    if not m:
        return None
    start = m.end()
    depth = 1
    pos = start
    tag_re = re.compile(r'<(/?)section\b[^>]*>', re.IGNORECASE)
    while depth > 0:
        tm = tag_re.search(text, pos)
        if not tm:
            return None
        if tm.group(1) == "/":
            depth -= 1
        else:
            depth += 1
        pos = tm.end()
        if depth == 0:
            return text[start:tm.start()]
    return None


def collect_ids(text: str) -> set[str]:
    """Collect all id="..." values from common targetable elements."""
    ids: set[str] = set()
    ids |= set(re.findall(r'<section\b[^>]*\sid="([^"]+)"', text))
    ids |= set(re.findall(r'<h\d\b[^>]*\sid="([^"]+)"', text))
    ids |= set(re.findall(r'<div\b[^>]*\sid="([^"]+)"', text))
    ids |= set(re.findall(r'<a\b[^>]*\sid="([^"]+)"', text))
    return ids


def check_manual(manual_path: Path) -> list[str]:
    """Return list of error messages (empty = pass)."""
    if not manual_path.exists():
        return [f"{manual_path}: file not found"]
    text = manual_path.read_text(encoding="utf-8")
    errors: list[str] = []

    all_ids = collect_ids(text)

    synthesis_html = extract_synthesis(text)
    if synthesis_html is None:
        # Synthesis section optional — skip without failure if absent.
        return []

    hrefs = re.findall(r'href="#([^"]+)"', synthesis_html)
    bad = [h for h in hrefs if h not in all_ids]
    if bad:
        errors.append(
            f"{manual_path}: synthesis has {len(bad)} broken anchor(s) (showing up to 10): {bad[:10]}"
        )
    return errors


def main():
    all_errors: list[str] = []
    for manual in MANUALS:
        all_errors.extend(check_manual(manual))
    if all_errors:
        print("FAIL: synthesis anchor consistency check failed:")
        for err in all_errors:
            print(f"  {err}")
        sys.exit(1)
    print(f"PASS: synthesis anchor consistency OK across {len(MANUALS)} manuals.")


if __name__ == "__main__":
    main()
