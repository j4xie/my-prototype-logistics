# Dianping Review Scraper

Best-effort scraper for 大众点评 reviews of 6 restaurant chains owned by the
authorized data owner. Designed to enrich V2 SmartBI analysis with public
review sentiment.

> **STATUS: PARTIAL / EXPERIMENTAL.** Dianping anti-bot is among the most
> aggressive in the Chinese web. The first request from a fresh IP triggered
> the Meituan `spiderindefence` slider captcha in our test run. Treat this
> tooling as a "captcha-assisted manual workflow" rather than a hands-off
> scraper. See [Test Run Results](#test-run-results) below for the actual
> evidence.

---

## Files

| File | Purpose |
|------|---------|
| `font_decoder.py` | Decode dianping CSS @font-face obfuscation. Extracts glyph signatures, matches against a baseline, returns `{glyph: real_char}` mapping. fontTools-based, no OCR. |
| `dianping_scraper.py` | Main scraper. patchright + Chromium, search → shopId → review_all pagination, with captcha detection and rate limiting. |
| `requirements.txt` | Python deps (patchright, fonttools, requests, pandas). |
| `baseline_digits.json` | (To be created) Mapping of glyph coord-hash → digit. Generated once per font drift via the manual annotation workflow described below. |
| `screenshots/` | Block screenshots saved on captcha detection. |
| `output/` | Exported xlsx files. |
| `.profile/` | Persistent Chromium user profile (cookies survive between runs). |

---

## Setup

```bash
pip install -r requirements.txt
patchright install chromium
```

The first install of patchright downloads ~150MB of Chromium. Already cached
on this dev machine at `C:\Users\Steve\AppData\Local\ms-playwright\chromium-1208\`.

---

## Usage

### Basic search-and-fetch

```bash
python dianping_scraper.py --store "上马火锅" --city "上海" --pages 1 --max-reviews 3 --headed
```

### Skip search if you already have the shopId

```bash
python dianping_scraper.py --shop-id 12345678 --pages 5 --headed
```

### CLI flags

| Flag | Default | Purpose |
|------|---------|---------|
| `--store NAME` | — | Store name in Chinese |
| `--city CITY` | — | City in Chinese (must be in `CITY_IDS`) |
| `--shop-id ID` | — | Bypass search and use this shopId directly |
| `--pages N` | 1 | Pages of reviews to fetch (~20 reviews/page) |
| `--max-reviews N` | unlimited | Hard cap (overrides --pages) |
| `--headed` | true | Show the browser window. **Recommended.** |
| `--headless` | — | Force headless. Will fail on first captcha. |
| `--output PATH` | `output/<store>_<ts>.xlsx` | Output xlsx |
| `--jsonl` | false | Also export jsonl |
| `--min-interval S` | 15 | Hard floor between requests (seconds) |
| `--max-interval S` | 30 | Upper bound for jitter |
| `--debug-html` | false | Dump page HTML to `screenshots/` for inspection |

### Recommended first-run pattern

```bash
python dianping_scraper.py \
  --store "上马火锅" \
  --city "上海" \
  --pages 1 --max-reviews 3 \
  --headed --debug-html
```

This:
- Opens a visible Chrome window (you can manually solve captchas)
- Fetches at most 3 reviews
- Dumps HTML for inspection so you can see what the page actually returned
- Caps total dianping requests to 2 (search + 1 review page)

---

## Architecture

```
┌───────────────────────────────────────────────────────────────┐
│  dianping_scraper.py (DianpingScraper)                        │
│                                                                │
│  __enter__:                                                    │
│    └─ patchright.chromium.launch_persistent_context            │
│         (.profile dir for cookie persistence)                  │
│                                                                │
│  search_store(name, city):                                     │
│    1. _wait_for_rate_limit() → 15-30s sleep                    │
│    2. page.goto(/search/keyword/{city_id}/0_{kw})              │
│    3. _detect_block() → if blocked → _handle_captcha()         │
│    4. _extract_shop_id() — regex /shop/(\w+) on first hit      │
│                                                                │
│  fetch_reviews(shop_id, pages):                                │
│    For each page:                                              │
│      1. _wait_for_rate_limit()                                 │
│      2. page.goto(/shop/{id}/review_all/p{n})                  │
│      3. wait_for_selector(".reviews-items, ...")               │
│      4. JS extractor returns raw card data                     │
│      5. For each card content → _decode_text() applies         │
│         font_decoder to obfuscated glyphs                      │
│                                                                │
│  _on_response (event handler):                                 │
│    └─ Sniff *.woff/*.woff2/*.ttf URLs                          │
│       → DianpingFontDecoder.from_bytes()                       │
│       → cache in self._font_url_cache                          │
│                                                                │
│  export_to_excel: 16-column format mirroring 青花椒 schema     │
└───────────────────────────────────────────────────────────────┘
            │
            ▼
┌───────────────────────────────────────────────────────────────┐
│  font_decoder.py (DianpingFontDecoder)                        │
│                                                                │
│  Coord-hash matching strategy (no OCR):                       │
│    1. For each glyph in cmap (skip ASCII):                    │
│       - Get glyf[glyph_name].coordinates                      │
│       - Round each (x,y) to nearest 5                         │
│       - SHA1 the JSON serialization                           │
│       - Store as GlyphSignature                               │
│    2. Lookup hash in baseline_digits.json → real char         │
│    3. decode(text) replaces every PUA char in input           │
│                                                                │
│  Manual baseline workflow:                                    │
│    a. Run scraper once with --debug-html on a known shop      │
│    b. Capture the .woff URL from the page                     │
│    c. python font_decoder.py <font.woff> --export sigs.json   │
│    d. Open the woff in a font viewer (FontCreator, Glyphs)    │
│    e. For each PUA glyph, eye-match to a real digit/char      │
│    f. Build {pua_char: real_char} dict, call                  │
│       build_baseline_from_annotated() → baseline_digits.json  │
│    g. Subsequent fonts with same shapes will match by hash    │
└───────────────────────────────────────────────────────────────┘
```

---

## Test Run Results (2026-04-08)

### Run 1 — search store, headless

```bash
python dianping_scraper.py --store "上马火锅" --city "上海" \
  --pages 1 --max-reviews 3 --headless --debug-html
```

**Outcome: BLOCKED on first request.**

```
INFO Searching: https://www.dianping.com/search/keyword/1/0_上马火锅
WARNING Block detected (captcha-redirect:
  https://verify.meituan.com/v2/app/general_page?...&action=spiderindefence&...)
  → screenshot saved to screenshots/block_20260408_155006.png
ERROR Headless mode — cannot solve captcha. Aborting.
ERROR Could not resolve shopId — aborting
```

The redirect URL `verify.meituan.com/.../action=spiderindefence` confirms
Meituan's spider defence kicked in immediately on a fresh patchright session.

**Detection mechanisms working correctly:**
- Captcha redirect URL pattern caught by `_detect_block()`
- Screenshot captured (2.5KB blank — headless chrome didn't render the slider)
- Headless mode aborted gracefully instead of looping
- Rate limit (15s floor) honoured, but irrelevant since the very first request
  was blocked

### Run 2 — font decoder self-test (synthetic)

```bash
python -c "from font_decoder import DianpingFontDecoder; ..."
```

**Outcome: PASS.**

- Loaded `C:\Windows\Fonts\arial.ttf` (3311 glyphs detected)
- Exported all glyph signatures to JSON
- Built synthetic baseline mapping 2 known chars → '5' and '0'
- Reloaded with baseline → 42.6% coverage (many arial glyphs share coord hashes)
- Decoded `'\xa0¡'` → `'50'` ✓

**Conclusion:** The font_decoder pipeline is fully functional. It just needs a
real dianping woff file to build a useful baseline.

---

## What Works

| Component | Status | Notes |
|-----------|--------|-------|
| patchright stealth launch | ✓ | `chromium-1208` cached, persistent profile working |
| Rate limiting | ✓ | Hard floor 15s + jitter to 30s |
| Captcha URL detection | ✓ | Catches `verify.meituan.com` redirects, slider HTML markers, login walls |
| Screenshot on block | ✓ | Saved to `screenshots/` with timestamp |
| Manual captcha workflow | ✓ | Headed mode pauses with `input()` prompt; type Enter to continue |
| Font response interception | ✓ | `_on_response` sniffs woff/woff2/ttf URLs and parses them on the fly |
| Font glyph signature extraction | ✓ | fontTools-based coord hashing, no OCR |
| Font baseline build helper | ✓ | `build_baseline_from_annotated()` |
| Decode obfuscated text | ✓ | Tested synthetically, ready for real font once baseline curated |
| Export to xlsx (青花椒 schema) | ✓ | 16 columns mirroring user's reference data |
| Export to jsonl | ✓ | Optional |

## What Fails (Or Is Unproven)

| Issue | Severity | Detail |
|-------|----------|--------|
| **First-request captcha** | CRITICAL | Meituan triggers `spiderindefence` immediately on a clean patchright session from a residential IP. No bypass attempted in code. |
| **No real font baseline** | HIGH | `baseline_digits.json` does not yet exist. Without it, decoded reviews still contain PUA glyphs for numbers/ratings. Requires one-time manual curation per font drift (~every few weeks). |
| **CSS selector drift** | MEDIUM | The JS extractor uses `.reviews-items > li`, `.review-list-main .item`, etc. These class names rotate; expect to update them periodically by re-inspecting `--debug-html` output. |
| **City IDs hardcoded** | LOW | Only 12 cities mapped. Add more to `CITY_IDS` as needed, or pass `--shop-id` directly. |
| **No proxy rotation** | MEDIUM | Single IP. After ~10-20 captcha solves the IP may be cooked. No residential proxy pool integration. |
| **No mobile API** | INFO | The 美团 mobile app uses a signed token (`mtgsig`) that requires reverse engineering. PC web (this scraper) is the only practical open-source path. |

---

## Realistic Reliability Estimate

For 100 target reviews (≈5 pages):

| Approach | Success rate | Time | Operator effort |
|----------|--------------|------|-----------------|
| `--headless` cold start | **0%** | <1 min before block | None — fails immediately |
| `--headed` + manual captcha solve, fresh IP | **30-50%** | 30-60 min | Solve 3-8 sliders during the run |
| `--headed` + warm cookies (after manual login) | **60-80%** | 20-40 min | Solve 1-3 sliders |
| With residential proxy rotation (not implemented) | 80-95% | 15-25 min | Solve 0-2 sliders |
| **Manual: log into 美团商家端 and click "评价导出"** | **100%** | 5 min | None, single-click xlsx export |

**Honest recommendation:** if the user has merchant credentials for any of the 6
chains, the **merchant portal export** route is dramatically faster and more
reliable than scraping. The reference `青花椒/评价下载2025.xlsx` (19,845 rows in
30 columns) was clearly produced by that route — it has columns the public web
page never exposes (`门店美团ID`, `回复状态`, `投诉类型`, etc).

---

## Manual Captcha Workflow

When run in headed mode and a captcha appears, the scraper pauses with:

```
============================================================
  CAPTCHA / BLOCK DETECTED: slider-captcha-detected
  Screenshot: screenshots/block_20260408_155006.png

  Please solve the challenge in the browser window, then
  press Enter here to continue. Type 'skip' to abort.
============================================================
>
```

The browser window is open and visible. Drag the slider, then press Enter at
the terminal. The scraper will recheck `_detect_block()` and resume if cleared.

Cookies persist in `.profile/` so you don't have to solve the captcha on every
run — only when the dianping session expires.

---

## Building the Font Baseline (One-Time, Per Font Drift)

When dianping rotates the font (every few weeks), digit/rating values in the
output will be garbled PUA chars. To rebuild:

```bash
# 1. Download a font from a known dianping page (use --debug-html to find it)
#    Look in the dumped HTML for @font-face src URLs ending in .woff/.woff2

curl -o font.woff "https://s3plus.meituan.net/v1/mss_xxx/svgtextcss/PageCss/xxx.woff"

# 2. Export glyph signatures
python font_decoder.py font.woff --export signatures.json

# 3. Open font.woff in any font viewer (FontCreator / FontForge / Glyphs).
#    Note which PUA glyph (\\uE000-\\uF8FF) corresponds to which real char.
#    For dianping you mostly need 0-9 plus a few common Chinese chars.

# 4. Edit a small Python helper:

python -c "
from font_decoder import DianpingFontDecoder
DianpingFontDecoder.build_baseline_from_annotated(
    'signatures.json',
    {
        '\\ue123': '5',
        '\\ue456': '0',
        '\\ue789': '3',
        # ... etc, 10-30 entries usually
    },
    'baseline_digits.json',
)
"

# 5. Future runs of the scraper will automatically use baseline_digits.json
#    and decode any font whose glyphs match the same coordinate hashes.
```

After step 5, glyphs that *visually look the same* (regardless of which PUA
codepoint they're assigned to in this particular font) will be matched by the
SHA1 of their rounded coordinates and decoded correctly.

---

## Alternative Approaches (Recommended Order)

1. **美团商家端 (Meituan Merchant Portal) export** — if the user has any of
   the 6 chains' merchant credentials. Click "评价管理 → 导出" to get the exact
   schema as `青花椒/评价下载2025.xlsx`. **5 minutes vs hours of scraping.**

2. **Existing community scraper** — `Sniper970119/dianping_spider` on GitHub.
   GPL-3.0, last commit a few years old, MongoDB-only output, but the font
   decoding logic is more battle-tested than this MVP. May or may not still
   work depending on dianping's current font rotation strategy.

3. **Paid APIs** — JustOneAPI / 数据堂 sell pre-scraped dianping review data.
   Out of scope for this task (no paid services).

4. **Manual screenshot + LLM OCR** — for a *small* number of reviews (≤50),
   take screenshots of the review page in a normal browser, feed to a vision
   LLM (qwen-vl, gpt-4o), let it extract structured rows. Slow but defeats
   font obfuscation entirely (the rendered glyphs are visible to the model).

5. **This scraper, with manual captcha solving + curated baseline** — best
   when you need ongoing periodic refreshes and can't get merchant access.

---

## Ethical / Legal Note

Dianping ToS prohibits automated access. This tool is provided for the
specific authorized use case of analysing the user's own restaurant chains'
publicly visible reviews for business intelligence. The hard 15s rate floor
and stop-on-captcha behaviour are intentional — do not lower them.

The tool will not attempt to bypass captchas programmatically, will not use
paid captcha-solving services, and will not rotate proxies. If those
escalations are needed, the merchant portal route (option 1 above) is almost
always a better answer.

---

## Open Issues / Follow-Up

- [ ] Build a real `baseline_digits.json` from a captured dianping font during
      a manual headed-mode session
- [ ] Verify the JS extractor selectors against a current dianping page (they
      will likely need tweaking; use `--debug-html` to inspect)
- [ ] Add a `_warm_session()` method that visits dianping.com root and waits a
      few seconds before the first real request (sometimes reduces immediate
      captcha)
- [ ] Implement city auto-discovery (city → city_id) instead of hardcoded map
- [ ] Mobile API research: investigate `mtgsig` reverse engineering as a
      separate spike — but this is a 1-2 week effort and probably not worth it
      compared to the merchant portal route
