"""Connect to user's Chrome via CDP, search 6 restaurants, extract reviews"""
import json
import time
import sys
from pathlib import Path
from playwright.sync_api import sync_playwright

OUTPUT_DIR = Path("scripts/scrapers/dianping/output")
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

STORES = [
    ("上马火锅", "上海"),
    ("IL TEATRO", "上海"),
    ("唏嘛香", "上海"),
    ("御九井", "上海"),
    ("永和豆浆", "上海"),
    ("馨厨香", "上海"),
]

JS_EXTRACT = """() => {
    const reviews = [];
    const selectors = [
        '.reviews-items .review-item',
        '.comment-list .comment-item',
        '.review-list-ul li',
        '[class*="reviewItem"]',
        '.main-review',
    ];
    let reviewEls = [];
    for (const sel of selectors) {
        reviewEls = document.querySelectorAll(sel);
        if (reviewEls.length > 0) break;
    }
    const shopName = (document.querySelector('.shop-name, h1, [class*="shopName"]') || {}).textContent || '';
    reviewEls.forEach((el, idx) => {
        try {
            const contentEl = el.querySelector('.review-words, .comment-txt, [class*="reviewContent"], [class*="content"]');
            const content = (contentEl || {}).textContent || '';
            const starEl = el.querySelector('[class*="star"], [class*="rank"]');
            let rating = 5;
            if (starEl) {
                const cls = starEl.className || '';
                const m = cls.match(/star(\\d+)/);
                if (m) rating = parseInt(m[1]) / 10;
            }
            const timeEl = el.querySelector('.time, [class*="time"], [class*="date"]');
            const timeText = (timeEl || {}).textContent || '';
            const userEl = el.querySelector('.name a, [class*="userName"]');
            const userName = (userEl || {}).textContent || '';
            if (content.trim().length > 5) {
                reviews.push({
                    rating: rating,
                    content: content.trim().substring(0, 500),
                    created_at: timeText.trim(),
                    store_name: shopName.trim(),
                    platform: 'dianping',
                    reviewer: userName.trim(),
                });
            }
        } catch(e) {}
    });
    return reviews;
}"""


def wait_for_captcha_clear(page, max_wait=120):
    """Wait for captcha to be solved by user"""
    for i in range(max_wait // 2):
        time.sleep(2)
        if "verify" not in page.url:
            print(f"  [OK] Captcha solved after {(i+1)*2}s")
            time.sleep(3)
            return True
        if (i * 2) % 30 == 0 and i > 0:
            print(f"  ... waiting ({i*2}s)")
    print(f"  [TIMEOUT] {max_wait}s")
    return False


def main():
    with sync_playwright() as p:
        browser = p.chromium.connect_over_cdp("http://localhost:9222")
        print(f"Connected to Chrome")

        ctx = browser.contexts[0]
        page = ctx.pages[0] if ctx.pages else ctx.new_page()

        all_results = {}

        for store_name, city in STORES:
            print(f"\n{'='*50}")
            print(f"[{store_name}] Searching...")

            search_url = f"https://www.dianping.com/search/keyword/1/0_{store_name}"
            try:
                page.goto(search_url, wait_until="domcontentloaded", timeout=30000)
            except Exception as e:
                print(f"  Nav error: {e}")
                continue

            time.sleep(5)

            if "verify" in page.url:
                print(f"  [CAPTCHA] Please solve in browser...")
                if not wait_for_captcha_clear(page):
                    continue

            # Find shop links
            try:
                shop_links = page.locator('a[href*="/shop/"]').all()
                print(f"  Found {len(shop_links)} shop links")

                best_href = None
                for link in shop_links[:10]:
                    href = link.get_attribute('href') or ''
                    text = (link.text_content() or '').strip()[:40]
                    if '/shop/' in href and text and len(text) > 2:
                        print(f"    -> {text} : {href[:60]}")
                        if best_href is None:
                            best_href = href

                if not best_href:
                    print(f"  No shop link found, skip")
                    continue

                shop_id = best_href.split('/shop/')[-1].split('/')[0].split('?')[0]
                review_url = f"https://www.dianping.com/shop/{shop_id}/review_all"
                print(f"  -> Reviews: /shop/{shop_id}/review_all")

                time.sleep(10)
                page.goto(review_url, wait_until="domcontentloaded", timeout=30000)
                time.sleep(5)

                if "verify" in page.url:
                    print(f"  [CAPTCHA on reviews] Solve in browser...")
                    if not wait_for_captcha_clear(page):
                        continue

                # Extract
                reviews = page.evaluate(JS_EXTRACT)
                print(f"  Page 1: {len(reviews)} reviews")

                # Page 2
                if reviews:
                    time.sleep(10)
                    try:
                        next_btn = page.locator('.next, a:has-text("下一页")').first
                        if next_btn.count() > 0:
                            next_btn.click()
                            time.sleep(5)
                            p2 = page.evaluate(JS_EXTRACT)
                            reviews.extend(p2)
                            print(f"  Page 2: +{len(p2)} = {len(reviews)} total")
                    except:
                        pass

                if reviews:
                    all_results[store_name] = reviews
                    out = OUTPUT_DIR / f"dianping_{store_name}_reviews.json"
                    with open(str(out), 'w', encoding='utf-8') as f:
                        json.dump(reviews, f, ensure_ascii=False, indent=2)
                    print(f"  Saved: {out}")
                else:
                    print(f"  No reviews (DOM selectors may need update)")

            except Exception as e:
                print(f"  Error: {e}")

            print(f"  Rate limit 15s...")
            time.sleep(15)

        # Summary
        print(f"\n{'='*50}")
        print("SUMMARY")
        total = 0
        for store, revs in all_results.items():
            print(f"  {store}: {len(revs)} reviews")
            total += len(revs)
        print(f"  Total: {total} from {len(all_results)}/{len(STORES)} stores")

        browser.close()


if __name__ == "__main__":
    main()
