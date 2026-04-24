import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';

const PROD_URL = 'https://admin.cretaceousfuture.com';
const FACTORY = 'RES_3101_009';
const RESULTS_DIR = 'tests/e2e-comprehensive/results/page-audit';
mkdirSync(RESULTS_DIR, { recursive: true });

const observations = [];
const consoleErrors = [];
const networkFails = [];
const apiCalls = [];

const QUERIES = [
  { q: '客户评价怎么样', expectsBucket: 'review' },
  { q: '哪个店服务最好', expectsBucket: 'review' },
  { q: '差评率多少', expectsBucket: 'review' },
  { q: '畅销品 Top 5', expectsBucket: 'pos' },
  { q: '本月营业额', expectsBucket: 'pos' },
];

async function login(page) {
  await page.goto(`${PROD_URL}/login`, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForSelector('input', { timeout: 15000 });
  const inputs = await page.locator('input').all();
  let userInput, passInput;
  for (const i of inputs) {
    const t = await i.getAttribute('type');
    if (t === 'password' && !passInput) passInput = i;
    else if (!userInput && (t === 'text' || !t)) userInput = i;
  }
  if (!userInput || !passInput) {
    await page.screenshot({ path: join(RESULTS_DIR, 'aiquery-login-no-inputs.png') });
    throw new Error('Could not find username/password inputs');
  }
  await userInput.fill('qhj_prod');
  await passInput.fill('123456');
  await passInput.press('Enter');
  try {
    await page.waitForURL((u) => !String(u).includes('/login'), { timeout: 25000 });
  } catch (e) {
    await page.screenshot({ path: join(RESULTS_DIR, 'aiquery-login-timeout.png') });
    throw new Error(`Login did not redirect within 25s: ${e.message}`);
  }
  await page.waitForTimeout(2000);
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 }, locale: 'zh-CN' });
  const page = await ctx.newPage();

  page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
  page.on('response', (r) => {
    const url = r.url();
    if (url.includes('/api/smartbi/') || url.includes('/api/chat')) {
      apiCalls.push(`${r.status()} ${r.request().method()} ${url.substring(url.indexOf('/api/'))}`);
    }
    if (r.status() >= 400 && r.url().includes('/api/')) networkFails.push(`${r.status()} ${r.url()}`);
  });

  try {
    await login(page);
    observations.push('Login OK');

    // Navigate to AIQuery — router uses createWebHistory (no hash), confirmed route: /smart-bi/query
    const targetUrl = `${PROD_URL}/smart-bi/query`;
    console.log(`Navigating to ${targetUrl}`);
    await page.goto(targetUrl, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(6000);

    const finalUrl = page.url();
    observations.push(`Final URL after nav: ${finalUrl}`);

    // Capture initial state
    const initialScreenshot = join(RESULTS_DIR, 'aiquery-initial.png');
    await page.screenshot({ path: initialScreenshot, fullPage: true });
    observations.push(`Saved initial screenshot to aiquery-initial.png`);

    // Check page title — should be "AI 智能问答"
    const pageTitle = await page.$eval('h1.page-title, .header-left h1', (e) => e.textContent.trim()).catch(() => 'NOT FOUND');
    observations.push(`Page title: ${pageTitle}`);

    // === Capture default upload selection (Mini-C feature) ===
    // The selector: el-select with placeholder "选择数据源", style width 280px
    // Default-selected upload should prefer review xlsx
    const dataSourceText = await page.$eval('.header-right .el-input__inner, .header-right .el-select__placeholder, .header-right input', (el) => el.value || el.textContent || '').catch(() => null);
    if (dataSourceText) {
      observations.push(`Default upload selected (header dropdown): ${dataSourceText}`);
    } else {
      observations.push('Default upload dropdown text NOT readable via .header-right selectors');
    }

    // Try a more explicit el-select inspection
    const allSelectInputs = await page.$$eval('.el-select .el-input__inner', (els) => els.map(e => e.value || e.placeholder || ''));
    observations.push(`All el-select inputs (${allSelectInputs.length}): ${allSelectInputs.join(' | ')}`);

    // === Capture the 8 quickQuestions (餐饮预设) ===
    const quickQuestions = await page.$$eval('.quick-questions .questions-list .el-button', (els) => els.map(e => e.textContent.trim()));
    observations.push(`快捷问题 visible (${quickQuestions.length}): ${quickQuestions.join(' | ')}`);

    // === Find the autocomplete input ===
    const queryInput = await page.$('.query-autocomplete input, .input-area input[type="text"]');
    if (!queryInput) {
      observations.push('FAIL: query autocomplete input not found');
      const allInputs = await page.$$eval('input', (els) => els.map(e => ({ type: e.type, placeholder: e.placeholder, className: e.className.substring(0, 80) })));
      observations.push(`All inputs found (${allInputs.length}): ${JSON.stringify(allInputs).substring(0, 800)}`);
      throw new Error('No query input');
    }
    observations.push('Query autocomplete input found');

    // === Check autocomplete dropdown on focus ===
    await queryInput.click();
    await page.waitForTimeout(2500);
    const acScreenshot = join(RESULTS_DIR, 'aiquery-autocomplete.png');
    await page.screenshot({ path: acScreenshot, fullPage: false });

    // Capture autocomplete suggestions
    const acSuggestions = await page.$$eval('.el-autocomplete-suggestion__list li, .query-autocomplete-popper li', (els) => els.map(e => e.textContent.trim().replace(/⚡\s*秒回/g, '').trim()).slice(0, 50)).catch(() => []);
    observations.push(`Autocomplete suggestions on focus (${acSuggestions.length}): ${acSuggestions.slice(0, 20).join(' | ')}`);
    observations.push(`Autocomplete shows ⚡ 秒回 tag: ${await page.$('.suggestion-tag') ? 'YES' : 'NO'}`);

    // Press escape to close autocomplete
    await page.keyboard.press('Escape');
    await page.waitForTimeout(800);

    // === Run 5 queries ===
    for (let i = 0; i < QUERIES.length; i++) {
      const { q, expectsBucket } = QUERIES[i];
      observations.push(`\n--- Query ${i+1}: "${q}" (expects ${expectsBucket}) ---`);

      await queryInput.click();
      await page.waitForTimeout(300);
      // Clear any existing text
      await queryInput.fill('');
      await page.waitForTimeout(200);
      await queryInput.fill(q);
      await page.waitForTimeout(700);
      await page.keyboard.press('Escape');  // close autocomplete dropdown
      await page.waitForTimeout(300);

      // Find send button — '发送' text
      const submitBtn = await page.$('.input-area button:has-text("发送"), button:has-text("发送")');
      if (!submitBtn) {
        observations.push(`No submit button found for query ${i+1}`);
        continue;
      }

      // Snapshot bot-message count before send to detect new response.
      // Use [class*="message-bot"] specifically (NOT generic [class*="message"])
      // so we count only assistant replies, not user echo or system events.
      const beforeMsgCount = await page.$$eval('[class*="message-bot"], .message.bot, .ai-message', (els) => els.length).catch(() => 0);

      const startTime = Date.now();
      const apiCallsBefore = apiCalls.length;
      await submitBtn.click();

      // Wait for response — direct signal: a NEW bot message element appeared
      // with non-empty content. Avoid relying on loading-spinner disappearance,
      // which is unreliable for fast template/cache hits that never show a
      // spinner (audit was reporting 60s for sub-300ms cache responses).
      let responded = false;
      let responseTime = 0;
      try {
        await page.waitForFunction(
          (before) => {
            const msgs = document.querySelectorAll('[class*="message-bot"], .message.bot, .ai-message');
            if (msgs.length <= before) return false;
            // Confirm the new bot message has non-empty content (avoid catching
            // empty placeholder div before the first SSE chunk arrives).
            const last = msgs[msgs.length - 1];
            return last && (last.textContent || '').trim().length > 0;
          },
          beforeMsgCount,
          { timeout: 60000, polling: 250 }
        );
        responded = true;
        responseTime = Date.now() - startTime;
      } catch (e) {
        responseTime = Date.now() - startTime;
      }

      observations.push(`Response time: ${(responseTime / 1000).toFixed(1)}s, responded: ${responded}`);

      // Wait extra for streaming to truly settle
      await page.waitForTimeout(4000);

      // Capture API calls during this query
      const queryApiCalls = apiCalls.slice(apiCallsBefore);
      const interestingCalls = queryApiCalls.filter(c => /chat|nl2sql|analysis|insight|template|materialize/.test(c)).slice(0, 5);
      observations.push(`API calls during query (${queryApiCalls.length} total): ${interestingCalls.join(' || ')}`);

      // Capture response text
      const lastResponse = await page.$$eval('[class*="message-bot"], .message.bot, .ai-message, [class*="response"]', (els) => {
        if (els.length === 0) return null;
        const last = els[els.length - 1];
        return (last.textContent || '').substring(0, 1200);
      }).catch(() => null);

      if (lastResponse) {
        observations.push(`Response text (truncated 500 chars): ${lastResponse.substring(0, 500)}`);
      } else {
        // Try alternate selectors
        const altResponse = await page.$$eval('.chat-history > div:last-child, .message-list > div:last-child', (els) => {
          if (els.length === 0) return null;
          return (els[els.length - 1].textContent || '').substring(0, 1200);
        }).catch(() => null);
        if (altResponse) observations.push(`Response (alt sel, 500 chars): ${altResponse.substring(0, 500)}`);
        else observations.push('No response text captured');
      }

      // Check for warning toast (P2 LLM guardrail)
      const warningEl = await page.$('.el-alert--warning, .el-message--warning');
      if (warningEl) {
        const warnText = await warningEl.textContent().catch(() => '');
        if (warnText && warnText.length > 0) observations.push(`⚠ Warning visible: ${warnText.substring(0, 200)}`);
      }

      // Check for error toast
      const errorIndicator = await page.$('.el-message--error, .el-alert--error');
      if (errorIndicator) {
        const errText = await errorIndicator.textContent().catch(() => '');
        observations.push(`❌ Error indicator visible: ${errText.substring(0, 200)}`);
      }

      const screenshot = join(RESULTS_DIR, `aiquery-q${i+1}.png`);
      await page.screenshot({ path: screenshot, fullPage: false });
    }

    observations.push(`\nTotal console errors: ${consoleErrors.length}`);
    if (consoleErrors.length > 0) observations.push(`First 3 console errors: ${consoleErrors.slice(0, 3).map(e => e.substring(0, 200)).join(' | ')}`);
    observations.push(`Network 4xx/5xx on /api: ${networkFails.length}`);
    if (networkFails.length > 0) observations.push(`Network fails: ${networkFails.slice(0, 8).join(' | ')}`);
    observations.push(`Total /api/smartbi or /api/chat calls: ${apiCalls.length}`);

  } catch (e) {
    observations.push(`FATAL ERROR: ${e.message}`);
    try { await page.screenshot({ path: join(RESULTS_DIR, 'aiquery-fatal.png'), fullPage: true }); } catch {}
  } finally {
    await browser.close();
  }

  const md = `# AIQuery 智能问答 Real-Window Audit\n\n**Date:** ${new Date().toISOString()}\n**Factory:** ${FACTORY}\n**URL:** PROD admin.cretaceousfuture.com /#/smart-bi/query\n\n## Observations\n\n${observations.map(o => `- ${o}`).join('\n')}\n\n## All API calls\n\n\`\`\`\n${apiCalls.slice(0, 60).join('\n')}\n\`\`\`\n\n## Console errors\n\n\`\`\`\n${consoleErrors.slice(0, 20).join('\n')}\n\`\`\`\n\n## Network failures\n\n\`\`\`\n${networkFails.slice(0, 30).join('\n')}\n\`\`\`\n`;
  writeFileSync(join(RESULTS_DIR, 'aiquery-OBSERVATIONS.md'), md);
  console.log(`\nSaved to ${join(RESULTS_DIR, 'aiquery-OBSERVATIONS.md')}`);
})();
