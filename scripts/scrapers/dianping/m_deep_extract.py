"""Deep extraction from m.dianping.com — click 评价 tab + scroll + load more"""
import json, time, re, sys
from pathlib import Path
from playwright.sync_api import sync_playwright

OUTPUT = Path("scripts/scrapers/dianping/output")
OUTPUT.mkdir(parents=True, exist_ok=True)

# Stores to scrape (including retry for failed ones + IL TEATRO)
SHOPS = [
    ("上马火锅", "k5axZDj8Py6OYyHl"),
    ("唏嘛香", "l1WzPmgrtwJl6Pmy"),
    ("馨厨香", "ElYdFasvkuTzHQFN"),  # retry for more
    ("御九井", "iNoM2pyF0e9uTGas"),  # retry for more
    ("永和豆浆", "G4EnjqXBYrLcDUiP"),  # retry for more
]

INTERVAL_SECONDS = 300  # 5 min between stores


def extract_reviews_deep(page, store_name, max_scrolls=30):
    """Aggressive extraction: click tabs, scroll, load more, broad text matching"""

    # Step 1: Try clicking 评价/评论 tab
    for tab_text in ["评价", "评论", "全部评价", "点评"]:
        try:
            tab = page.locator(f'text="{tab_text}"').first
            if tab.count() > 0:
                tab.click()
                time.sleep(3)
                print(f"    Clicked tab: {tab_text}")
                break
        except:
            pass

    # Step 2: Aggressive scrolling to trigger lazy load
    prev_height = 0
    for i in range(max_scrolls):
        page.evaluate(f"window.scrollTo(0, document.body.scrollHeight)")
        time.sleep(1.5)

        # Check if page grew
        new_height = page.evaluate("document.body.scrollHeight")
        if new_height == prev_height and i > 5:
            # Try clicking "加载更多" / "查看更多"
            for more_text in ["加载更多", "查看更多", "更多评价", "展开", "查看全部"]:
                try:
                    more_btn = page.locator(f'text="{more_text}"').first
                    if more_btn.count() > 0 and more_btn.is_visible():
                        more_btn.click()
                        time.sleep(2)
                        print(f"    Clicked: {more_text}")
                        break
                except:
                    pass

            if page.evaluate("document.body.scrollHeight") == new_height:
                print(f"    Scroll stopped at iteration {i} (no more content)")
                break
        prev_height = new_height

    time.sleep(2)
    body_len = page.evaluate("document.body.textContent.length")
    print(f"    After scrolling: {body_len} chars")

    # Step 3: Broad extraction — get ALL text nodes > 30 chars
    all_texts = page.evaluate(r"""() => {
        const results = [];
        const seen = new Set();

        // Method 1: TreeWalker for text nodes
        const walker = document.createTreeWalker(
            document.body, NodeFilter.SHOW_TEXT, null, false
        );
        while (walker.nextNode()) {
            const t = walker.currentNode.textContent.trim();
            if (t.length > 25 && t.length < 800) {
                const key = t.substring(0, 40);
                if (!seen.has(key)) {
                    seen.add(key);
                    results.push({text: t, method: 'walker'});
                }
            }
        }

        // Method 2: div/p/span with substantial inner text (not children)
        const els = document.querySelectorAll('div, p, span, li, article');
        for (const el of els) {
            // Get direct text content (exclude children's text)
            let directText = '';
            for (const child of el.childNodes) {
                if (child.nodeType === Node.TEXT_NODE) {
                    directText += child.textContent;
                }
            }
            directText = directText.trim();
            if (directText.length > 25 && directText.length < 800) {
                const key = directText.substring(0, 40);
                if (!seen.has(key)) {
                    seen.add(key);
                    results.push({text: directText, method: 'direct'});
                }
            }
        }

        return results;
    }""")

    # Step 4: Filter to review-like content
    skip_patterns = [
        'javascript', 'Copyright', '下载APP', '客户端', '关于我们',
        'window.', 'function(', 'var ', 'const ', '扫码下载',
        '营业时间', '人均消费', '商户入驻', '违规举报', '隐私政策',
        '用户协议', '版权所有', '备案号', '京ICP', '点击查看',
        '加载中', 'loading', '暂无', '收藏', '分享到',
    ]

    review_signals = [
        '好吃', '味道', '服务', '环境', '推荐', '菜品', '上菜', '口味',
        '不错', '新鲜', '满意', '值得', '回购', '下次', '朋友', '家人',
        '点了', '吃了', '很棒', '失望', '一般', '等位', '排队',
        '性价比', '分量', '价格', '量大', '实惠', '贵', '划算',
        '辣', '甜', '酸', '咸', '鲜', '嫩', '脆', '烂',
        '牛肉', '鱼', '虾', '鸡', '鸭', '猪', '羊', '蛋',
        '米饭', '面条', '汤', '锅', '烤', '炒', '煮', '蒸',
        '套餐', '团购', '外卖', '堂食', '打包', '拍照',
    ]

    reviews = []
    for item in all_texts:
        text = item['text']

        # Skip non-review content
        if any(sp in text for sp in skip_patterns):
            continue

        # Must have at least 1 review signal word OR be > 60 chars of Chinese
        chinese_chars = len(re.findall(r'[\u4e00-\u9fff]', text))
        has_signal = any(sw in text for sw in review_signals)

        if has_signal or (chinese_chars > 40 and len(text) > 50):
            reviews.append({
                "content": text[:500],
                "rating": 5.0,
                "store_name": store_name,
                "platform": "dianping_mobile",
                "created_at": "",
            })

    return reviews


def main():
    with sync_playwright() as p:
        browser = p.chromium.connect_over_cdp("http://localhost:9222")
        ctx = browser.contexts[0]
        page = ctx.pages[0]

        all_results = {}

        for i, (store_name, shop_id) in enumerate(SHOPS):
            print(f"\n{'='*60}")
            print(f"[{i+1}/{len(SHOPS)}] {store_name} (shop_id={shop_id})")

            if i > 0:
                print(f"  Rate limit: {INTERVAL_SECONDS}s...")
                time.sleep(INTERVAL_SECONDS)

            url = f"https://m.dianping.com/shop/{shop_id}"
            try:
                page.goto(url, wait_until="domcontentloaded", timeout=30000)
            except Exception as e:
                print(f"  Nav error: {e}")
                continue
            time.sleep(8)

            # Captcha check
            if "verify" in page.url:
                print(f"  [CAPTCHA] Solve in browser (180s)...")
                for j in range(90):
                    time.sleep(2)
                    if "verify" not in page.url:
                        print(f"  Solved after {(j+1)*2}s")
                        time.sleep(5)
                        break
                else:
                    print(f"  [TIMEOUT] Skip")
                    continue

            print(f"  Page: {page.url[:60]}")
            print(f"  Title: {page.title()[:50]}")

            # Deep extraction
            reviews = extract_reviews_deep(page, store_name, max_scrolls=25)
            print(f"  Extracted: {len(reviews)} reviews")

            if reviews:
                for r in reviews[:5]:
                    print(f"    -> {r['content'][:70]}...")

                all_results[store_name] = reviews
                out = OUTPUT / f"dianping_{store_name}_deep.json"
                with open(str(out), "w", encoding="utf-8") as f:
                    json.dump(reviews, f, ensure_ascii=False, indent=2)
                print(f"  Saved: {out}")

        print(f"\n{'='*60}")
        print("SUMMARY")
        total = 0
        for store, revs in all_results.items():
            print(f"  {store}: {len(revs)} reviews")
            total += len(revs)
        print(f"  Total: {total} from {len(all_results)}/{len(SHOPS)} stores")

        browser.close()


if __name__ == "__main__":
    main()
