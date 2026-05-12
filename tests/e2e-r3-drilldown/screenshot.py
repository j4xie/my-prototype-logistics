"""R3 drilldown evidence screenshot script.

Opens render-evidence.html in headless Chromium and captures 5 section
screenshots for the audit doc.
"""
import sys
from pathlib import Path
from playwright.sync_api import sync_playwright

HERE = Path(__file__).resolve().parent
HTML = HERE / "render-evidence-inlined.html"
OUT = HERE / "screenshots"
OUT.mkdir(exist_ok=True)

if not HTML.exists():
    print("ERROR: render-evidence-inlined.html missing — run inline-evidence.py first")
    sys.exit(1)

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1500, "height": 1100})
    page.goto(HTML.as_uri())
    page.wait_for_function("Array.from(document.querySelectorAll('pre[data-evidence]')).every(p => p.textContent && !p.textContent.startsWith('(missing') && !p.textContent.startsWith('(loading'))", timeout=10000)
    page.wait_for_timeout(500)  # let fonts settle

    targets = [
        ("01-rule12-boundary.png", "#rule12"),
        ("02-department-13field-shape.png", "#t02"),
        ("03-product-7field-chart-rule9.png", "#t03"),
        ("04-warehouse-403-rich-envelope.png", "#t06"),
        ("05-invalid-body-200-parity.png", "#t07"),
        ("06-cross-factory-denial.png", "#t09"),
    ]

    for filename, selector in targets:
        loc = page.locator(selector)
        loc.scroll_into_view_if_needed()
        page.wait_for_timeout(200)
        loc.screenshot(path=str(OUT / filename), animations="disabled")
        print(f"  captured {filename}")

    # Full-page summary
    page.evaluate("window.scrollTo(0, 0)")
    page.wait_for_timeout(200)
    page.screenshot(path=str(OUT / "00-summary-fullpage.png"), full_page=True, animations="disabled")
    print("  captured 00-summary-fullpage.png")

    browser.close()

print(f"\nScreenshots written to: {OUT}")
