"""Extract reviews from m.dianping.com via CDP (user's Chrome)"""
import json, time, sys
from pathlib import Path
from playwright.sync_api import sync_playwright

SHOPS = {
    "馨厨香": "ElYdFasvkuTzHQFN",
    "上马火锅": "k5axZDj8Py6OYyHl",
    "唏嘛香": "l1WzPmgrtwJl6Pmy",
    "御九井": "iNoM2pyF0e9uTGas",
    "永和豆浆": "G4EnjqXBYrLcDUiP",
}

OUTPUT = Path("scripts/scrapers/dianping/output")
OUTPUT.mkdir(parents=True, exist_ok=True)

JS_EXTRACT = r"""() => {
    const reviews = [];
    const shopEl = document.querySelector('h1, [class*="shopName"], [class*="shop-name"]');
    const shopText = shopEl ? shopEl.textContent.trim() : '';

    const allEls = document.querySelectorAll('[class*="review"], [class*="comment"], [class*="Review"], [class*="Comment"]');
    const candidates = [...allEls].filter(el => {
        const t = el.textContent || '';
        return t.length > 30 && t.length < 2000 && el.children.length < 20;
    });

    candidates.forEach((el, idx) => {
        const text = (el.textContent || '').trim();
        let rating = 5;
        const rm = text.match(/(\d\.\d)\s*分/);
        if (rm) rating = parseFloat(rm[1]);
        let dateStr = '';
        const dm = text.match(/(\d{4}[-\/]\d{2}[-\/]\d{2}|\d+天前|\d+月前)/);
        if (dm) dateStr = dm[1];
        const parts = text.split(/\n/).map(s => s.trim()).filter(s => s.length > 0);
        let content = '';
        for (const part of parts) {
            if (part.length > content.length && part.length > 10) content = part;
        }
        if (content.length > 15) {
            reviews.push({
                id: idx, rating, content: content.substring(0, 500),
                created_at: dateStr, store_name: shopText, platform: 'dianping_mobile',
            });
        }
    });
    return {reviews, shopText, candidateCount: candidates.length, totalEls: allEls.length};
}"""


def main():
    with sync_playwright() as p:
        browser = p.chromium.connect_over_cdp("http://localhost:9222")
        ctx = browser.contexts[0]
        page = ctx.pages[0]
        all_results = {}

        for store_name, shop_id in SHOPS.items():
            print(f"\n{'='*50}")
            print(f"[{store_name}] m.dianping.com/shop/{shop_id}")
            time.sleep(15)
            try:
                page.goto(f"https://m.dianping.com/shop/{shop_id}", wait_until="domcontentloaded", timeout=30000)
            except Exception as e:
                print(f"  Nav error: {e}")
                continue
            time.sleep(5)

            if "verify" in page.url:
                print("  [CAPTCHA] Solve in browser (120s)...")
                for i in range(60):
                    time.sleep(2)
                    if "verify" not in page.url:
                        print(f"  OK after {(i+1)*2}s")
                        time.sleep(3)
                        break
                else:
                    print("  [TIMEOUT]")
                    continue

            try:
                result = page.evaluate(JS_EXTRACT)
            except Exception as e:
                print(f"  Evaluate error: {e}")
                continue

            extracted = result.get("reviews", [])
            print(f"  Shop: {result.get('shopText', '')[:40]}")
            print(f"  Elements: {result['totalEls']}, candidates: {result['candidateCount']}")
            print(f"  Extracted: {len(extracted)} reviews")

            if extracted:
                for r in extracted[:3]:
                    print(f"    -> [{r['rating']}] {r['content'][:60]}...")
                all_results[store_name] = extracted
                out = OUTPUT / f"dianping_m_{store_name}_reviews.json"
                with open(str(out), "w", encoding="utf-8") as f:
                    json.dump(extracted, f, ensure_ascii=False, indent=2)
                print(f"  Saved: {out}")

        print(f"\n{'='*50}")
        print("SUMMARY")
        total = 0
        for store, revs in all_results.items():
            print(f"  {store}: {len(revs)} reviews")
            total += len(revs)
        print(f"  Total: {total} from {len(all_results)}/{len(SHOPS)} stores")
        browser.close()


if __name__ == "__main__":
    main()
