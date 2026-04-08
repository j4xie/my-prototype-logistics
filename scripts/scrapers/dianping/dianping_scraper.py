"""Dianping Review Scraper — W5 (best-effort anti-bot bypass)

Strategy
--------
1. patchright (stealth Playwright fork) + Chromium with persistent context.
2. Search for store by name + city → get shopId from `/search/keyword/...`.
3. Navigate to /shop/{shopId}/review_all
4. Paginate reviews, handling:
   - CSS font obfuscation via `font_decoder.DianpingFontDecoder`
   - Rate limit 15-30s jitter between requests
   - Captcha / 滑块 detection (pause + screenshot for manual handling)
   - Empty page / login wall detection
5. Export rows matching the 青花椒 schema columns.

Ethical / Legal
---------------
This scraper is for **authorized business intelligence** on publicly visible
reviews of the user's own restaurant chains. Dianping ToS prohibits scraping;
use at own risk and respect rate limits. The script enforces a hard floor of
15s between requests and stops on captcha by default.

Usage
-----
    python dianping_scraper.py --store "上马火锅" --city "上海" --pages 5
    python dianping_scraper.py --store "上马火锅" --city "上海" --pages 1 --max-reviews 3
    python dianping_scraper.py --shop-id 12345678 --pages 3   # skip search
    python dianping_scraper.py --headed                       # non-headless

Recommended first run:
    python dianping_scraper.py --store "上马火锅" --city "上海" \
        --pages 1 --max-reviews 3 --headed
"""

from __future__ import annotations

import argparse
import json
import logging
import random
import re
import sys
import time
from dataclasses import asdict, dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Tuple
from urllib.parse import quote

# patchright is a drop-in replacement for playwright with anti-detect patches.
# Import is named the same so we can also fall back to playwright if needed.
try:
    from patchright.sync_api import sync_playwright, Page, BrowserContext, TimeoutError as PWTimeout
    _USING_PATCHRIGHT = True
except ImportError:  # pragma: no cover
    try:
        from playwright.sync_api import sync_playwright, Page, BrowserContext, TimeoutError as PWTimeout  # type: ignore
        _USING_PATCHRIGHT = False
    except ImportError as exc:
        raise ImportError(
            "Neither patchright nor playwright is installed. "
            "Install via: pip install patchright && patchright install chromium"
        ) from exc

# Local imports
sys.path.insert(0, str(Path(__file__).parent))
from font_decoder import DianpingFontDecoder  # noqa: E402

logger = logging.getLogger(__name__)

# ----------------------------------------------------------------------
# Constants
# ----------------------------------------------------------------------

DIANPING_BASE = "https://www.dianping.com"
SEARCH_URL = "https://www.dianping.com/search/keyword/{city_id}/0_{keyword}"
# Common city ids — these are dianping's internal ids, NOT geographic codes.
# Dianping uses sequential integer ids for cities. The full table is published
# in many scraper repos; we keep the most common 6 here for the user's chains.
CITY_IDS = {
    "上海": 1,
    "北京": 2,
    "广州": 4,
    "深圳": 7,
    "杭州": 3,
    "南京": 5,
    "苏州": 6,
    "成都": 8,
    "武汉": 16,
    "重庆": 9,
    "天津": 10,
    "西安": 17,
}

# Hard floor between any two http requests
MIN_REQUEST_INTERVAL_S = 15
MAX_REQUEST_INTERVAL_S = 30

# Default headless behaviour. Patchright still works headless but headed is more
# reliable against fingerprinting checks.
DEFAULT_HEADLESS = False

# Reference Excel column order from 青花椒 export — we mirror the leading subset
# (the columns we can plausibly populate from a public page).
REVIEW_COLUMNS = [
    "评价时间", "评价ID", "省份", "城市", "评价门店", "门店美团ID",
    "平台", "评价详情", "星级分", "口味分", "环境分", "服务分", "评价来源",
    "用户昵称", "用户等级", "采集时间",
]


# ----------------------------------------------------------------------
# Data classes
# ----------------------------------------------------------------------


@dataclass
class Review:
    review_id: str = ""
    review_time: str = ""
    province: str = ""
    city: str = ""
    shop_name: str = ""
    shop_id: str = ""
    platform: str = "点评"
    content: str = ""
    star_score: Optional[float] = None
    taste_score: Optional[float] = None
    environment_score: Optional[float] = None
    service_score: Optional[float] = None
    source: str = "点评-爬取"
    user_nickname: str = ""
    user_level: str = ""
    captured_at: str = ""

    def to_row(self) -> Dict[str, object]:
        return {
            "评价时间": self.review_time,
            "评价ID": self.review_id,
            "省份": self.province,
            "城市": self.city,
            "评价门店": self.shop_name,
            "门店美团ID": self.shop_id,
            "平台": self.platform,
            "评价详情": self.content,
            "星级分": self.star_score,
            "口味分": self.taste_score,
            "环境分": self.environment_score,
            "服务分": self.service_score,
            "评价来源": self.source,
            "用户昵称": self.user_nickname,
            "用户等级": self.user_level,
            "采集时间": self.captured_at,
        }


# ----------------------------------------------------------------------
# Scraper
# ----------------------------------------------------------------------


class DianpingScraper:
    """Best-effort dianping review scraper.

    The scraper is **stop-on-failure** by default — when it sees a captcha or
    login wall it pauses and waits for the operator to solve manually (in
    headed mode). In headless mode it screenshots and aborts the page.
    """

    def __init__(
        self,
        headless: bool = DEFAULT_HEADLESS,
        user_data_dir: Optional[Path] = None,
        min_interval: float = MIN_REQUEST_INTERVAL_S,
        max_interval: float = MAX_REQUEST_INTERVAL_S,
        screenshot_dir: Optional[Path] = None,
        debug_dump_html: bool = False,
    ) -> None:
        self.headless = headless
        self.user_data_dir = user_data_dir or (Path(__file__).parent / ".profile")
        self.user_data_dir.mkdir(parents=True, exist_ok=True)
        self.min_interval = min_interval
        self.max_interval = max_interval
        self.screenshot_dir = screenshot_dir or (Path(__file__).parent / "screenshots")
        self.screenshot_dir.mkdir(parents=True, exist_ok=True)
        self.debug_dump_html = debug_dump_html

        self._pw = None
        self._context: Optional[BrowserContext] = None
        self._last_request_at: float = 0.0
        self._font_decoder: Optional[DianpingFontDecoder] = None
        self._font_url_cache: Dict[str, DianpingFontDecoder] = {}

    # ------------------------------------------------------------------
    # Lifecycle
    # ------------------------------------------------------------------

    def __enter__(self) -> "DianpingScraper":
        self._pw = sync_playwright().start()
        logger.info(
            "Launching %s Chromium (headless=%s, profile=%s)",
            "patchright" if _USING_PATCHRIGHT else "playwright",
            self.headless,
            self.user_data_dir,
        )
        self._context = self._pw.chromium.launch_persistent_context(
            user_data_dir=str(self.user_data_dir),
            headless=self.headless,
            channel="chrome" if _USING_PATCHRIGHT else None,
            no_viewport=True,
            args=[
                "--disable-blink-features=AutomationControlled",
                "--disable-dev-shm-usage",
            ],
            locale="zh-CN",
            timezone_id="Asia/Shanghai",
            user_agent=(
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
            ),
        )
        # Hook font request capture
        self._context.on("response", self._on_response)
        return self

    def __exit__(self, exc_type, exc, tb) -> None:
        if self._context is not None:
            try:
                self._context.close()
            except Exception:
                pass
        if self._pw is not None:
            try:
                self._pw.stop()
            except Exception:
                pass

    # ------------------------------------------------------------------
    # Rate limiting
    # ------------------------------------------------------------------

    def _wait_for_rate_limit(self) -> None:
        if self._last_request_at == 0:
            self._last_request_at = time.time()
            return
        elapsed = time.time() - self._last_request_at
        target = random.uniform(self.min_interval, self.max_interval)
        if elapsed < target:
            sleep_for = target - elapsed
            logger.info("Rate limit: sleeping %.1fs", sleep_for)
            time.sleep(sleep_for)
        self._last_request_at = time.time()

    # ------------------------------------------------------------------
    # Font response interception
    # ------------------------------------------------------------------

    def _on_response(self, response) -> None:
        """Capture font files as they're loaded so we can decode the page."""
        try:
            url = response.url
        except Exception:
            return
        if not any(ext in url for ext in (".woff", ".woff2", ".ttf")):
            return
        if "dianping" not in url and "meituan" not in url and "s3plus" not in url:
            return
        if url in self._font_url_cache:
            return
        try:
            data = response.body()
        except Exception as exc:
            logger.debug("Failed to read font body for %s: %s", url, exc)
            return
        try:
            decoder = DianpingFontDecoder.from_bytes(data)
            self._font_url_cache[url] = decoder
            logger.info(
                "Captured font %s — %d glyphs, baseline coverage %.0f%%",
                url.split("/")[-1],
                len(decoder._signatures),
                decoder.coverage() * 100,
            )
        except Exception as exc:
            logger.warning("Font parse failed for %s: %s", url, exc)

    # ------------------------------------------------------------------
    # Captcha / wall detection
    # ------------------------------------------------------------------

    def _detect_block(self, page: Page) -> Optional[str]:
        """Return reason string if blocked, else None.

        Detects:
            - 滑块验证 (slider captcha)
            - 登录强制墙 (login required)
            - 403 / 验证 page
            - empty body
        """
        try:
            url = page.url
        except Exception:
            return "page-closed"
        if "verify" in url or "captcha" in url:
            return f"captcha-redirect: {url}"
        if "login" in url and "shop" not in url:
            return f"login-wall: {url}"
        try:
            title = page.title() or ""
        except Exception:
            title = ""
        if any(k in title for k in ("验证", "登录", "captcha", "Verify")):
            return f"blocked-title: {title}"
        # Check body for slider markers
        try:
            html = page.content()
        except Exception:
            return "no-content"
        if not html or len(html) < 1000:
            return f"empty-body: {len(html)} bytes"
        if "yodaBoxWrapper" in html or "captcha-container" in html or "_yoda_v" in html:
            return "slider-captcha-detected"
        if "您的访问出现了问题" in html or "访问验证" in html:
            return "verification-page"
        return None

    def _handle_captcha(self, page: Page, reason: str) -> bool:
        """Pause for manual captcha solve in headed mode, abort in headless.

        Returns True if the operator solved it (page no longer blocked).
        """
        ts = datetime.now().strftime("%Y%m%d_%H%M%S")
        shot = self.screenshot_dir / f"block_{ts}.png"
        try:
            page.screenshot(path=str(shot), full_page=True)
            logger.warning("Block detected (%s) — screenshot saved to %s", reason, shot)
        except Exception as exc:
            logger.warning("Block detected (%s) — screenshot failed: %s", reason, exc)

        if self.headless:
            logger.error("Headless mode — cannot solve captcha. Aborting.")
            return False

        print()
        print("=" * 60)
        print(f"  CAPTCHA / BLOCK DETECTED: {reason}")
        print(f"  Screenshot: {shot}")
        print()
        print("  >>> 请在弹出的浏览器窗口中手动解决验证码 <<<")
        print("  >>> 解完后脚本会自动检测并继续 (最长等 180 秒) <<<")
        print("=" * 60)

        # Poll for URL change instead of blocking on input()
        # After user solves captcha, browser redirects back to dianping.com
        import time as _time
        max_wait = 180  # 3 minutes
        poll_interval = 3
        waited = 0
        while waited < max_wait:
            _time.sleep(poll_interval)
            waited += poll_interval
            try:
                current_url = page.url
                new_reason = self._detect_block(page)
                if new_reason is None:
                    logger.info("Captcha cleared after %ds, continuing", waited)
                    print(f"  [OK] 验证通过! (等了 {waited}s)")
                    return True
                if waited % 30 == 0:
                    print(f"  ... 仍在等待验证 ({waited}s / {max_wait}s)")
            except Exception:
                pass

        logger.warning("Captcha wait timed out after %ds", max_wait)
        print(f"  [FAIL] 等了 {max_wait}s 仍未通过, 放弃")
        return False

    # ------------------------------------------------------------------
    # Decoding
    # ------------------------------------------------------------------

    def _decode_text(self, text: str) -> str:
        """Apply ALL captured font decoders to the text.

        We try each decoder in turn — whichever produces the cleanest output
        (most replacements made) wins.
        """
        if not text or not self._font_url_cache:
            return text
        best = text
        best_score = sum(1 for c in text if 0xE000 <= ord(c) <= 0xF8FF)
        if best_score == 0:
            return text  # nothing to decode
        for decoder in self._font_url_cache.values():
            decoded = decoder.decode(text)
            remaining = sum(1 for c in decoded if 0xE000 <= ord(c) <= 0xF8FF)
            if remaining < best_score:
                best = decoded
                best_score = remaining
        return best

    # ------------------------------------------------------------------
    # Search
    # ------------------------------------------------------------------

    def search_store(self, name: str, city: str) -> Optional[str]:
        """Resolve a store name + city → shopId via dianping search.

        Returns the first matching shopId from search results, or None.
        """
        city_id = CITY_IDS.get(city)
        if city_id is None:
            logger.error("Unknown city %r — add to CITY_IDS or supply --shop-id", city)
            return None

        url = SEARCH_URL.format(city_id=city_id, keyword=quote(name))
        logger.info("Searching: %s", url)

        page = self._context.new_page()
        try:
            self._wait_for_rate_limit()
            try:
                page.goto(url, wait_until="domcontentloaded", timeout=30000)
            except PWTimeout:
                logger.warning("Search page timeout")
                return None

            block = self._detect_block(page)
            if block:
                if not self._handle_captcha(page, block):
                    return None

            # Try common selectors for shop links
            shop_id = self._extract_shop_id(page)
            if shop_id:
                logger.info("Found shopId=%s for %r", shop_id, name)
                return shop_id

            if self.debug_dump_html:
                dump = self.screenshot_dir / f"search_{name}_{int(time.time())}.html"
                dump.write_text(page.content(), encoding="utf-8")
                logger.info("Dumped search HTML → %s", dump)

            logger.warning("No shop link found in search results for %r", name)
            return None
        finally:
            page.close()

    def _extract_shop_id(self, page: Page) -> Optional[str]:
        """Pull the first /shop/<id> href from the search results page."""
        # Try a few selectors in order of specificity
        selectors = [
            "a[href*='/shop/']",
            "li.shop-list a[href*='/shop/']",
            "div.shop-list a[href*='/shop/']",
            ".searchInfo a[href*='/shop/']",
        ]
        for sel in selectors:
            try:
                handles = page.query_selector_all(sel)
            except Exception:
                continue
            for h in handles:
                try:
                    href = h.get_attribute("href") or ""
                except Exception:
                    continue
                m = re.search(r"/shop/([A-Za-z0-9]+)", href)
                if m:
                    return m.group(1)
        # Fallback: regex on full HTML
        try:
            html = page.content()
        except Exception:
            return None
        m = re.search(r"/shop/([A-Za-z0-9]+)", html)
        return m.group(1) if m else None

    # ------------------------------------------------------------------
    # Reviews
    # ------------------------------------------------------------------

    def fetch_reviews(
        self,
        shop_id: str,
        page_limit: int = 1,
        max_reviews: Optional[int] = None,
        shop_name_hint: str = "",
        city_hint: str = "",
    ) -> List[Review]:
        """Iterate through review_all pages and extract reviews."""
        all_reviews: List[Review] = []
        page = self._context.new_page()
        try:
            for page_num in range(1, page_limit + 1):
                if max_reviews is not None and len(all_reviews) >= max_reviews:
                    break
                url = f"{DIANPING_BASE}/shop/{shop_id}/review_all"
                if page_num > 1:
                    url += f"/p{page_num}"
                logger.info("Fetching reviews page %d: %s", page_num, url)

                self._wait_for_rate_limit()
                try:
                    page.goto(url, wait_until="domcontentloaded", timeout=30000)
                except PWTimeout:
                    logger.warning("Review page timeout, skipping page %d", page_num)
                    continue

                block = self._detect_block(page)
                if block:
                    solved = self._handle_captcha(page, block)
                    if not solved:
                        logger.error("Aborting review fetch on page %d", page_num)
                        break

                # Wait for review list to render. Different selectors over time.
                try:
                    page.wait_for_selector(
                        ".reviews-items, .review-list-main, .reviews-wrapper",
                        timeout=8000,
                    )
                except PWTimeout:
                    logger.warning("Review list selector not found on page %d", page_num)

                # Give fonts time to load
                time.sleep(2)

                if self.debug_dump_html:
                    dump = self.screenshot_dir / f"reviews_{shop_id}_p{page_num}.html"
                    dump.write_text(page.content(), encoding="utf-8")
                    logger.info("Dumped reviews HTML → %s", dump)

                page_reviews = self._extract_reviews_from_page(
                    page, shop_id=shop_id, shop_name_hint=shop_name_hint, city_hint=city_hint
                )
                logger.info("Page %d → %d reviews extracted", page_num, len(page_reviews))
                all_reviews.extend(page_reviews)

                if max_reviews is not None and len(all_reviews) >= max_reviews:
                    return all_reviews[:max_reviews]
        finally:
            page.close()
        return all_reviews

    def _extract_reviews_from_page(
        self,
        page: Page,
        shop_id: str,
        shop_name_hint: str = "",
        city_hint: str = "",
    ) -> List[Review]:
        """Parse review cards from the current page DOM.

        We use evaluate() to run a JS function inside the page so the font
        deobfuscation happens AFTER the browser renders glyphs (the DOM still
        contains the obfuscated chars; we apply the captured font decoder).
        """
        captured_at = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

        # Generic JS extractor — tries multiple known card layouts
        js = """
        () => {
            const cards = document.querySelectorAll(
              'ul.reviews-items > li, .review-list-main .item, .reviews-wrapper .review-item'
            );
            const out = [];
            cards.forEach(card => {
                const get = (sel) => {
                    const el = card.querySelector(sel);
                    return el ? (el.innerText || el.textContent || '').trim() : '';
                };
                const getAttr = (sel, attr) => {
                    const el = card.querySelector(sel);
                    return el ? (el.getAttribute(attr) || '') : '';
                };
                // Star rating: dianping uses class names like sml-rank-stars sml-str45
                let star = '';
                const starEl = card.querySelector('[class*="sml-str"], [class*="rank-stars"]');
                if (starEl) {
                    const m = (starEl.className || '').match(/sml-str(\\d+)/);
                    if (m) star = (parseInt(m[1]) / 10).toFixed(1);
                }
                out.push({
                    review_id: card.getAttribute('data-id') || getAttr('a[href*="reviewId"]', 'href') || '',
                    user_nickname: get('.dper-info .name, .name, .user-info .name'),
                    user_level: get('.user-rank-rst, .user-info .level'),
                    review_time: get('.time, .review-time, .date'),
                    content: get('.review-words, .desc, .content, .review-truncated-words'),
                    star_score_raw: star,
                });
            });
            return out;
        }
        """
        try:
            raw_items = page.evaluate(js)
        except Exception as exc:
            logger.warning("JS extractor failed: %s", exc)
            raw_items = []

        reviews: List[Review] = []
        for item in raw_items:
            content = self._decode_text(item.get("content", "") or "")
            time_text = self._decode_text(item.get("review_time", "") or "")
            star_raw = item.get("star_score_raw") or ""
            try:
                star = float(star_raw) if star_raw else None
            except ValueError:
                star = None
            review_id = (item.get("review_id") or "").strip()
            if not review_id:
                # Synthesize from content hash if absent
                import hashlib
                review_id = "syn_" + hashlib.md5(content.encode("utf-8")).hexdigest()[:12]

            reviews.append(
                Review(
                    review_id=review_id,
                    review_time=time_text,
                    province="",  # not exposed on page
                    city=city_hint,
                    shop_name=shop_name_hint,
                    shop_id=shop_id,
                    platform="点评",
                    content=content,
                    star_score=star,
                    taste_score=None,
                    environment_score=None,
                    service_score=None,
                    source="点评-爬取",
                    user_nickname=self._decode_text(item.get("user_nickname", "") or ""),
                    user_level=item.get("user_level", "") or "",
                    captured_at=captured_at,
                )
            )
        return reviews

    # ------------------------------------------------------------------
    # Export
    # ------------------------------------------------------------------

    @staticmethod
    def export_to_excel(reviews: List[Review], output_path: str | Path) -> None:
        try:
            import pandas as pd
        except ImportError as exc:
            raise ImportError("pandas required for export. pip install pandas openpyxl") from exc

        rows = [r.to_row() for r in reviews]
        df = pd.DataFrame(rows, columns=REVIEW_COLUMNS)
        output_path = Path(output_path)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        df.to_excel(output_path, index=False)
        logger.info("Exported %d reviews → %s", len(rows), output_path)

    @staticmethod
    def export_to_jsonl(reviews: List[Review], output_path: str | Path) -> None:
        output_path = Path(output_path)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        with output_path.open("w", encoding="utf-8") as f:
            for r in reviews:
                f.write(json.dumps(asdict(r), ensure_ascii=False) + "\n")
        logger.info("Exported %d reviews → %s", len(reviews), output_path)


# ----------------------------------------------------------------------
# CLI
# ----------------------------------------------------------------------


def _cli() -> int:
    parser = argparse.ArgumentParser(description="Dianping review scraper (W5 best-effort)")
    parser.add_argument("--store", help="Store name (Chinese)")
    parser.add_argument("--city", help="City name (Chinese, see CITY_IDS)")
    parser.add_argument("--shop-id", help="Skip search; use this dianping shopId directly")
    parser.add_argument("--pages", type=int, default=1, help="Pages of reviews to fetch (default 1)")
    parser.add_argument("--max-reviews", type=int, default=None, help="Hard cap on reviews")
    parser.add_argument("--headed", action="store_true", help="Run browser in headed mode")
    parser.add_argument("--headless", action="store_true", help="Run browser in headless mode (override default)")
    parser.add_argument(
        "--output",
        default=None,
        help="Output xlsx path (default: ./output/<store>_<ts>.xlsx)",
    )
    parser.add_argument(
        "--jsonl",
        action="store_true",
        help="Also export jsonl alongside xlsx",
    )
    parser.add_argument("--min-interval", type=float, default=MIN_REQUEST_INTERVAL_S)
    parser.add_argument("--max-interval", type=float, default=MAX_REQUEST_INTERVAL_S)
    parser.add_argument("--debug-html", action="store_true", help="Dump page HTML for inspection")
    args = parser.parse_args()

    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    )

    if not args.shop_id and not (args.store and args.city):
        parser.error("Must provide either --shop-id or both --store and --city")

    headless = DEFAULT_HEADLESS
    if args.headed:
        headless = False
    if args.headless:
        headless = True

    output = args.output
    if output is None:
        ts = datetime.now().strftime("%Y%m%d_%H%M%S")
        slug = args.shop_id or args.store
        output = Path(__file__).parent / "output" / f"{slug}_{ts}.xlsx"

    with DianpingScraper(
        headless=headless,
        min_interval=args.min_interval,
        max_interval=args.max_interval,
        debug_dump_html=args.debug_html,
    ) as scraper:
        if args.shop_id:
            shop_id = args.shop_id
            shop_name_hint = args.store or ""
            city_hint = args.city or ""
        else:
            shop_id = scraper.search_store(args.store, args.city)
            shop_name_hint = args.store
            city_hint = args.city
            if not shop_id:
                logger.error("Could not resolve shopId — aborting")
                return 2

        reviews = scraper.fetch_reviews(
            shop_id=shop_id,
            page_limit=args.pages,
            max_reviews=args.max_reviews,
            shop_name_hint=shop_name_hint,
            city_hint=city_hint,
        )
        logger.info("Total reviews scraped: %d", len(reviews))

        if reviews:
            scraper.export_to_excel(reviews, output)
            if args.jsonl:
                jsonl_path = Path(str(output).replace(".xlsx", ".jsonl"))
                scraper.export_to_jsonl(reviews, jsonl_path)
        else:
            logger.warning("No reviews extracted — nothing to export")

    return 0 if reviews else 3


if __name__ == "__main__":
    sys.exit(_cli())
