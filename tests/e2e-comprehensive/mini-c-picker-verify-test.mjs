/**
 * Mini-C Picker Verification on F001 (test env)
 *
 * Goal: verify that AIQuery.vue's Apr 24 review-aware default upload picker
 * works when review xlsx is present.
 *
 * Setup:
 *   - Test env: http://139.196.165.140:8097
 *   - User: qhj_prod / 123456
 *   - Factory: F001 (test env)
 *   - F001 has 4 review-keyword English files: id=3964/3966/3967 qhj_reviews_q3.xlsx,
 *     id=3965 qhj_reviews_q4.xlsx
 *   - Largest non-review POS: id=3970 qhj_order_detail.csv (200K rows)
 *
 * Expected:
 *   - WITH Mini-C picker: id=3967 qhj_reviews_q3.xlsx is auto-selected
 *   - WITHOUT Mini-C picker (legacy): id=3970 qhj_order_detail.csv is auto-selected
 *
 * Note: Chinese-named review files (e.g. 评价下载...xlsx) are stored mojibake-corrupted
 *   in DB (bytes mis-decoded as GBK). Mini-C English-keyword path still triggers
 *   correctly because qhj_reviews_q3.xlsx contains "review" substring.
 */
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';

const TEST_URL = 'http://139.196.165.140:8097';
const FACTORY = 'F001';
const USERNAME = 'qhj_prod';
const PASSWORD = '123456';
const RESULTS_DIR = 'tests/e2e-comprehensive/results/page-audit';
mkdirSync(RESULTS_DIR, { recursive: true });

const observations = [];
const consoleErrors = [];
const apiCalls = [];

async function login(page) {
  await page.goto(`${TEST_URL}/login`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  // Wait for inputs to actually appear (app has a loading spinner)
  await page.waitForSelector('input[type="password"]', { timeout: 30000 });
  await page.waitForTimeout(1000);

  // Find username/password inputs
  const inputs = await page.locator('input').all();
  let userInput, passInput;
  for (const i of inputs) {
    const t = await i.getAttribute('type');
    if (t === 'password' && !passInput) passInput = i;
    else if (!userInput && (t === 'text' || !t)) userInput = i;
  }
  if (!userInput || !passInput) {
    await page.screenshot({ path: join(RESULTS_DIR, 'mini-c-login-no-inputs.png') });
    throw new Error('Could not find username/password inputs');
  }
  await userInput.fill(USERNAME);
  await passInput.fill(PASSWORD);

  // Try to set factory if there's a factory dropdown/input
  const factoryInput = await page.$('input[placeholder*="工厂"], input[placeholder*="factory"]');
  if (factoryInput) {
    await factoryInput.click();
    await page.waitForTimeout(500);
    const opt = await page.$(`text=${FACTORY}`);
    if (opt) await opt.click();
  }

  // Submit
  await passInput.press('Enter');
  // App uses cretas_access_token + cretas_user_info localStorage keys
  try {
    await page.waitForFunction(() => {
      const t = localStorage.getItem('cretas_access_token');
      const u = localStorage.getItem('cretas_user_info');
      return !!(t || u);
    }, { timeout: 25000 });
  } catch (e) {
    await page.screenshot({ path: join(RESULTS_DIR, 'mini-c-login-timeout.png') });
    throw new Error(`Login did not produce token: ${e.message}`);
  }
  await page.waitForTimeout(2000);
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 }, locale: 'zh-CN' });
  const page = await ctx.newPage();

  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('response', (r) => {
    const url = r.url();
    if (url.includes('/api/smartbi/') || url.includes('/uploads')) {
      apiCalls.push(`${r.status()} ${r.request().method()} ${url.substring(url.indexOf('/api/'))}`);
    }
  });

  try {
    await login(page);
    observations.push(`Login OK on ${TEST_URL}`);

    // Verify factoryId in localStorage (cretas_user_info)
    const factoryId = await page.evaluate(() => {
      try {
        const userInfo = localStorage.getItem('cretas_user_info');
        if (userInfo) return JSON.parse(userInfo).factoryId;
        return localStorage.getItem('factoryId');
      } catch { return null; }
    });
    observations.push(`Logged-in factoryId: ${factoryId}`);

    if (factoryId !== FACTORY) {
      observations.push(`WARNING: Expected factoryId=${FACTORY} but got ${factoryId}`);
    }

    // Navigate to AIQuery (web-admin uses createWebHistory, no hash)
    const targetUrl = `${TEST_URL}/smart-bi/query`;
    console.log(`Navigating to ${targetUrl}`);
    await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(8000); // wait for upload list to load + auto-select

    const initialScreenshot = join(RESULTS_DIR, 'mini-c-aiquery-initial.png');
    await page.screenshot({ path: initialScreenshot, fullPage: true });
    observations.push(`Initial screenshot saved`);

    // Try to extract the selected upload from the dropdown / select
    // Common Element Plus selectors for el-select:
    //   - .el-select__tags-text (multi-select)
    //   - .el-select__placeholder
    //   - .el-input__inner  (single-select displays text in input)
    //   - .el-select-v2__placeholder
    //   - .el-select-trigger .el-select__selected-item
    const selectedTextLocators = [
      '.el-select-v2__placeholder',
      '.el-select__placeholder',
      '.el-select__tags-text',
      '.el-select__selected-item',
      '.el-input__inner',
      'input[role="combobox"]',
    ];

    let selectedDropdownText = null;
    for (const sel of selectedTextLocators) {
      const elements = await page.$$(sel);
      for (const el of elements) {
        const txt = await el.evaluate((e) => e.textContent || e.value || '').catch(() => '');
        const visible = await el.isVisible().catch(() => false);
        if (visible && txt && txt.trim().length > 2 && !txt.includes('请选择') && !txt.includes('placeholder')) {
          selectedDropdownText = `${sel} -> ${txt.trim()}`;
          break;
        }
      }
      if (selectedDropdownText) break;
    }
    observations.push(`First non-empty visible dropdown text: ${selectedDropdownText || 'NOT FOUND'}`);

    // Also dump ALL visible select-like elements for diagnosis
    const allSelectInfo = await page.evaluate(() => {
      const selectors = ['.el-select', '.el-select-v2', '.el-input__inner', '[role="combobox"]'];
      const out = [];
      for (const sel of selectors) {
        document.querySelectorAll(sel).forEach((node, i) => {
          const txt = (node.textContent || '').trim().substring(0, 200);
          const val = node.value || '';
          const rect = node.getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0) {
            out.push({ selector: `${sel}[${i}]`, textContent: txt, value: val, top: Math.round(rect.top) });
          }
        });
      }
      return out.slice(0, 20);
    });
    observations.push(`All select-like elements (top 20):`);
    for (const info of allSelectInfo) {
      observations.push(`  ${info.selector} top=${info.top} text=${JSON.stringify(info.textContent)} value=${JSON.stringify(info.value)}`);
    }

    // Best signal: read selectedUploadId from Vue component state via window.__VUE_DEVTOOLS_HOOK__ or via observable proxy.
    // Alternative: parse from /api/.../analyze?uploadId=XXX subsequent calls
    // Or: check the welcome message in the chat — it says "当前数据源: <fileName>"
    const welcomeMessageTexts = await page.evaluate(() => {
      // Find chat messages
      const msgs = Array.from(document.querySelectorAll('.message-content, .chat-message, [class*="message"]')).map(n => (n.textContent || '').trim());
      return msgs.filter(t => t.length > 30).slice(0, 3);
    });
    observations.push(`Chat welcome message snippets:`);
    for (const m of welcomeMessageTexts) {
      observations.push(`  ${m.substring(0, 250)}`);
    }

    // Use a more direct path: query the element holding selectedUploadId via querySelector for el-select trigger
    // Element Plus el-select: the visible text is in `.el-select__placeholder span` (newer) or the input value
    const fileNameInTrigger = await page.evaluate(() => {
      const triggers = document.querySelectorAll('.el-select');
      const out = [];
      triggers.forEach((sel, i) => {
        const text = (sel.textContent || '').trim();
        const rect = sel.getBoundingClientRect();
        if (rect.width > 0) {
          out.push(`select[${i}] (top=${Math.round(rect.top)}, w=${Math.round(rect.width)}): ${text.substring(0, 200)}`);
        }
      });
      return out;
    });
    observations.push(`All visible el-select triggers:`);
    for (const t of fileNameInTrigger) observations.push(`  ${t}`);

    // Open the data-source dropdown to inspect both selected option AND list
    // Find the data-source label text and click adjacent select
    const dataSourceClicked = await page.evaluate(() => {
      // Look for label '数据源'
      const labels = Array.from(document.querySelectorAll('label, span, div')).filter(n => (n.textContent || '').includes('数据源'));
      for (const lbl of labels) {
        const parent = lbl.closest('.el-form-item, [class*="data-source"]');
        if (parent) {
          const select = parent.querySelector('.el-select, .el-select__wrapper, [role="combobox"]');
          if (select) {
            select.click();
            return true;
          }
        }
      }
      return false;
    });
    if (dataSourceClicked) {
      await page.waitForTimeout(1500);
      const dropdownScreenshot = join(RESULTS_DIR, 'mini-c-dropdown-open.png');
      await page.screenshot({ path: dropdownScreenshot, fullPage: false });
      observations.push(`Dropdown open screenshot saved`);

      // Read first few options
      const options = await page.evaluate(() => {
        const opts = document.querySelectorAll('.el-select-dropdown__item, .el-option');
        return Array.from(opts).slice(0, 10).map(o => (o.textContent || '').trim().substring(0, 200));
      });
      observations.push(`First 10 dropdown options:`);
      for (const o of options) observations.push(`  ${o}`);
    }

    // Also try fetching the upload list via the API directly to verify
    const apiResult = await page.evaluate(async (factory) => {
      try {
        const token = localStorage.getItem('cretas_access_token') || '';
        const r = await fetch(`/api/mobile/${factory}/smart-bi/uploads?status=COMPLETED&page=0&size=200`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (!r.ok) return { error: `${r.status} ${r.statusText}` };
        const data = await r.json();
        const items = data.data?.content || data.data || [];
        return { count: items.length, top5: items.slice(0, 5).map(i => ({ id: i.id, fileName: i.fileName, rowCount: i.rowCount })) };
      } catch (e) {
        return { error: String(e) };
      }
    }, FACTORY);
    observations.push(`API direct check: ${JSON.stringify(apiResult, null, 2)}`);

    // Now run Mini-C picker logic IN THE BROWSER to see what JS actually picks
    const browserPick = await page.evaluate(async (factory) => {
      const REVIEW_KEYWORDS = ['评价', '评论', '大众点评', '美团评价', '评分', 'review', 'comment'];
      try {
        const token = localStorage.getItem('cretas_access_token') || '';
        const r = await fetch(`/api/mobile/${factory}/smart-bi/uploads?status=COMPLETED&page=0&size=200`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await r.json();
        const items = data.data?.content || data.data || [];

        // Replicate exact logic from AIQuery.vue lines 326-349
        // (skip dedup for now)
        const nonAutoSync = items.filter(d => {
          const name = d.fileName || d.originalFileName || '';
          return !name.startsWith('[自动同步]');
        });
        const candidates = nonAutoSync.length > 0 ? nonAutoSync : items;
        const isReviewFile = (d) => {
          const name = (d.fileName || d.originalFileName || '').toLowerCase();
          return REVIEW_KEYWORDS.some(kw => name.includes(kw.toLowerCase()));
        };
        const reviewCands = candidates.filter(isReviewFile);
        const sortByRows = (a, b) => (b.rowCount || 0) - (a.rowCount || 0);
        const sorted = reviewCands.length > 0
          ? [...reviewCands].sort(sortByRows)
          : [...candidates].sort(sortByRows);

        const winner = sorted[0];

        // Also test each individual keyword on the chosen file's name
        const winnerName = (winner.fileName || winner.originalFileName || '').toLowerCase();
        const matches = REVIEW_KEYWORDS.map(kw => ({ kw, hit: winnerName.includes(kw.toLowerCase()) }));

        return {
          totalItems: items.length,
          nonAutoSync: nonAutoSync.length,
          reviewCands: reviewCands.length,
          reviewCandsSample: reviewCands.slice(0, 5).map(d => ({ id: d.id, fileName: d.fileName, rowCount: d.rowCount })),
          winner: { id: winner.id, fileName: winner.fileName, rowCount: winner.rowCount },
          winnerKeywordMatches: matches,
          chosenGroup: reviewCands.length > 0 ? 'REVIEW' : 'LEGACY-BIGGEST',
        };
      } catch (e) {
        return { error: String(e) };
      }
    }, FACTORY);
    observations.push(`Browser-side Mini-C simulation: ${JSON.stringify(browserPick, null, 2)}`);

  } catch (err) {
    observations.push(`FATAL: ${err.message}`);
    await page.screenshot({ path: join(RESULTS_DIR, 'mini-c-fatal.png') });
  } finally {
    await browser.close();
  }

  observations.push('---');
  observations.push(`Console errors (${consoleErrors.length}):`);
  for (const e of consoleErrors.slice(0, 20)) observations.push(`  ${e}`);
  observations.push(`API calls (${apiCalls.length}):`);
  for (const c of apiCalls.slice(0, 20)) observations.push(`  ${c}`);

  const reportPath = join(RESULTS_DIR, 'mini-c-picker-verify-result.txt');
  writeFileSync(reportPath, observations.join('\n'));
  console.log(observations.join('\n'));
  console.log(`\nReport: ${reportPath}`);
})();
