/**
 * Layer 2 Remote Production E2E Tests
 * SmartBI + AI Chat + Restaurant + Transfer + BOM Achievement + Process IO + Conversions
 *
 * Target: http://139.196.165.140:8086
 * Login: factory_admin1 / 123456
 */
import { chromium } from 'playwright';

const BASE = 'http://139.196.165.140:8086';
const USERNAME = 'factory_admin1';
const PASSWORD = '123456';

const results = [];
const evidence = {};
let screenshotCounter = 0;

function log(module, status, detail, extras = {}) {
  const icon = status === 'PASS' ? 'PASS' : status === 'WARN' ? 'WARN' : 'FAIL';
  results.push({ module, status, detail, ...extras });
  console.log(`[${icon}] ${module}: ${detail}`);
}

function collectEvidence(testName) {
  if (!evidence[testName]) evidence[testName] = { checks: [], networkErrors: [], screenshots: [] };
  return evidence[testName];
}

(async () => {
  console.log('='.repeat(70));
  console.log('Layer 2 Remote Production E2E Tests');
  console.log(`Target: ${BASE}`);
  console.log(`Time: ${new Date().toISOString()}`);
  console.log('='.repeat(70));

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    ignoreHTTPSErrors: true,
    viewport: { width: 1440, height: 900 },
  });
  const page = await context.newPage();

  // Global network error tracker
  let currentTestErrors = [];
  page.on('response', resp => {
    const s = resp.status();
    if (s >= 400 && s !== 404) {
      currentTestErrors.push(`${s} ${resp.url().replace(BASE, '').substring(0, 120)}`);
    }
  });

  // Helper: wait for page to stabilize
  async function waitForStable(ms = 2500) {
    await page.waitForTimeout(ms);
  }

  // Helper: count table rows
  async function countTableRows() {
    const rows = await page.locator('.el-table__body-wrapper .el-table__row').count();
    return rows;
  }

  // Helper: check for error toasts
  async function getErrorToasts() {
    const toasts = await page.locator('.el-message--error').all();
    const texts = [];
    for (const t of toasts) {
      const txt = await t.textContent().catch(() => '');
      if (txt) texts.push(txt.trim());
    }
    return texts;
  }

  // Helper: check for loading states resolved
  async function hasContent() {
    const table = await page.locator('.el-table').count() > 0;
    const cards = await page.locator('.el-card').count() > 0;
    const charts = await page.locator('canvas, .echarts, [class*="chart"], svg').count() > 0;
    const text = await page.locator('.el-empty').count() === 0;
    return { table, cards, charts, hasData: table || cards || charts };
  }

  // Helper: take screenshot
  async function takeScreenshot(name) {
    screenshotCounter++;
    const path = `C:/Users/Steve/my-prototype-logistics/test-screenshots/layer2-${screenshotCounter}-${name}.png`;
    try {
      await page.screenshot({ path, fullPage: false });
      return path;
    } catch (e) {
      return null;
    }
  }

  // Ensure screenshots directory
  const fs = await import('fs');
  const ssDir = 'C:/Users/Steve/my-prototype-logistics/test-screenshots';
  if (!fs.existsSync(ssDir)) fs.mkdirSync(ssDir, { recursive: true });

  // ============================================================
  // TEST 0: Login
  // ============================================================
  console.log('\n' + '='.repeat(50));
  console.log('TEST 0: LOGIN');
  console.log('='.repeat(50));

  currentTestErrors = [];
  try {
    await page.goto(`${BASE}/login`, { waitUntil: 'networkidle', timeout: 20000 });
    await waitForStable(1500);

    // Fill login form
    const inputs = await page.locator('input').all();
    if (inputs.length < 2) {
      log('LOGIN', 'FAIL', 'Login form not found - fewer than 2 inputs');
      await browser.close();
      process.exit(1);
    }

    await inputs[0].fill(USERNAME);
    await page.locator('input[type="password"]').fill(PASSWORD);
    await takeScreenshot('login-filled');

    // Click login button
    await page.locator('button').first().click();
    await waitForStable(4000);

    const url = page.url();
    if (url.includes('/login')) {
      log('LOGIN', 'FAIL', 'Still on login page after submit');
      await takeScreenshot('login-stuck');
      await browser.close();
      process.exit(1);
    }
    log('LOGIN', 'PASS', `Redirected to ${url.replace(BASE, '')}`);
    await takeScreenshot('login-success');
  } catch (err) {
    log('LOGIN', 'FAIL', err.message.slice(0, 150));
    await browser.close();
    process.exit(1);
  }

  // ============================================================
  // TEST 1: SmartBI Analysis (/smart-bi/analysis)
  // ============================================================
  console.log('\n' + '='.repeat(50));
  console.log('TEST 1: SmartBI Analysis');
  console.log('='.repeat(50));

  currentTestErrors = [];
  const ev1 = collectEvidence('SmartBI-Analysis');
  try {
    await page.goto(`${BASE}/smart-bi/analysis`, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await waitForStable(3000);

    const url = page.url();
    if (url.includes('/login')) {
      log('SmartBI-Analysis', 'FAIL', 'Redirected to login (auth lost)');
    } else {
      // Check page loaded
      const content = await hasContent();
      ev1.checks.push({ hasTable: content.table, hasCards: content.cards, hasCharts: content.charts });

      // Check for upload section or existing data
      const uploadBtn = await page.locator('text=上传').count();
      const uploadSection = await page.locator('.el-upload').count();
      const sheetTabs = await page.locator('.el-tabs__item, .sheet-tab, [class*="tab"]').count();
      const kpiCards = await page.locator('.kpi-card, [class*="kpi"], .stat-card, [class*="stat-value"]').count();
      const chartCount = await page.locator('canvas, [class*="echarts"], [class*="chart-container"]').count();

      ev1.checks.push({ uploadBtn, uploadSection, sheetTabs, kpiCards, chartCount });

      // Check for existing data (previously uploaded sheets)
      const batchSelector = await page.locator('.el-select').count();
      const existingSheets = await page.locator('.sheet-tab, .el-tabs__item').count();

      let detail = `Page loaded at ${url.replace(BASE, '')}`;
      if (chartCount > 0) detail += ` | ${chartCount} charts`;
      if (kpiCards > 0) detail += ` | ${kpiCards} KPI cards`;
      if (uploadSection > 0) detail += ` | upload available`;
      if (existingSheets > 0) detail += ` | ${existingSheets} sheet tabs`;
      if (batchSelector > 0) detail += ` | batch selector present`;

      // Check for Python unavailable warning
      const pythonWarning = await page.locator('text=AI 分析服务暂时不可用').count();
      if (pythonWarning > 0) detail += ' | PYTHON SERVICE UNAVAILABLE';

      log('SmartBI-Analysis', 'PASS', detail);
      await takeScreenshot('smartbi-analysis');

      // Check for AI query input area
      const aiInput = await page.locator('.ai-query-input, [class*="ai-input"], textarea[placeholder*="问"], input[placeholder*="问"], input[placeholder*="分析"]').count();
      const chatArea = await page.locator('.ai-chat, [class*="chat-panel"], [class*="ai-panel"]').count();
      if (aiInput > 0 || chatArea > 0) {
        ev1.checks.push({ aiQueryAvailable: true });
        log('SmartBI-Analysis-AIQuery', 'PASS', `AI query input found (inputs: ${aiInput}, chat: ${chatArea})`);
      } else {
        // Look for any text input or textarea that could be AI query
        const anyTextarea = await page.locator('textarea').count();
        ev1.checks.push({ aiQueryAvailable: false, textareas: anyTextarea });
        log('SmartBI-Analysis-AIQuery', 'WARN', `No dedicated AI query input found (textareas: ${anyTextarea})`);
      }
    }
    ev1.networkErrors = [...currentTestErrors];
    if (currentTestErrors.length > 0) {
      log('SmartBI-Analysis-Network', 'WARN', `${currentTestErrors.length} errors: ${currentTestErrors.slice(0, 3).join(' | ')}`);
    }
  } catch (err) {
    log('SmartBI-Analysis', 'FAIL', err.message.slice(0, 150));
  }

  // ============================================================
  // TEST 2: SmartBI Dashboard (/smart-bi/dashboard)
  // ============================================================
  console.log('\n' + '='.repeat(50));
  console.log('TEST 2: SmartBI Dashboard');
  console.log('='.repeat(50));

  currentTestErrors = [];
  const ev2 = collectEvidence('SmartBI-Dashboard');
  try {
    await page.goto(`${BASE}/smart-bi/dashboard`, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await waitForStable(3000);

    const url = page.url();
    if (url.includes('/login')) {
      log('SmartBI-Dashboard', 'FAIL', 'Redirected to login');
    } else if (url.includes('/404')) {
      log('SmartBI-Dashboard', 'WARN', 'Route /smart-bi/dashboard returned 404');
    } else {
      const content = await hasContent();
      const chartCount = await page.locator('canvas, [class*="echarts"], [class*="chart"]').count();
      const cardCount = await page.locator('.el-card').count();
      const kpiCount = await page.locator('.kpi-card, [class*="kpi"], [class*="stat"], [class*="metric"]').count();

      ev2.checks.push({ ...content, chartCount, cardCount, kpiCount });

      let detail = `Page at ${url.replace(BASE, '')}`;
      if (chartCount > 0) detail += ` | ${chartCount} charts`;
      if (cardCount > 0) detail += ` | ${cardCount} cards`;
      if (kpiCount > 0) detail += ` | ${kpiCount} KPIs`;
      if (!content.hasData) detail += ' | no visual data detected';

      log('SmartBI-Dashboard', content.hasData ? 'PASS' : 'WARN', detail);
      await takeScreenshot('smartbi-dashboard');
    }
    ev2.networkErrors = [...currentTestErrors];
    if (currentTestErrors.length > 0) {
      log('SmartBI-Dashboard-Network', 'WARN', `${currentTestErrors.length} errors: ${currentTestErrors.slice(0, 3).join(' | ')}`);
    }
  } catch (err) {
    log('SmartBI-Dashboard', 'FAIL', err.message.slice(0, 150));
  }

  // ============================================================
  // TEST 3: SmartBI AI Query (/smart-bi/query)
  // ============================================================
  console.log('\n' + '='.repeat(50));
  console.log('TEST 3: SmartBI AI Query');
  console.log('='.repeat(50));

  currentTestErrors = [];
  const ev3 = collectEvidence('SmartBI-AIQuery');
  try {
    await page.goto(`${BASE}/smart-bi/query`, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await waitForStable(3000);

    const url = page.url();
    if (url.includes('/login')) {
      log('SmartBI-AIQuery', 'FAIL', 'Redirected to login');
    } else {
      const content = await hasContent();

      // Look for input field to type question
      const inputField = await page.locator('textarea, input[type="text"]:not([type="password"])').all();
      let queryInputFound = false;
      let queryInput = null;

      for (const inp of inputField) {
        const placeholder = await inp.getAttribute('placeholder').catch(() => '');
        const visible = await inp.isVisible().catch(() => false);
        if (visible && placeholder) {
          queryInputFound = true;
          queryInput = inp;
          ev3.checks.push({ placeholder, visible: true });
          break;
        }
      }

      if (!queryInputFound) {
        // Try broader search
        const allInputs = await page.locator('input, textarea').all();
        for (const inp of allInputs) {
          const visible = await inp.isVisible().catch(() => false);
          const type = await inp.getAttribute('type').catch(() => '');
          if (visible && type !== 'password' && type !== 'hidden') {
            queryInput = inp;
            queryInputFound = true;
            break;
          }
        }
      }

      if (queryInputFound && queryInput) {
        log('SmartBI-AIQuery-PageLoad', 'PASS', `AI Query page loaded with input field`);
        await takeScreenshot('smartbi-aiquery-page');

        // Try typing a question
        try {
          await queryInput.fill('本月产量是多少');
          await takeScreenshot('smartbi-aiquery-typed');

          // Look for send/submit button
          const sendBtns = await page.locator('button').all();
          let sendBtn = null;
          for (const btn of sendBtns) {
            const text = await btn.textContent().catch(() => '');
            const visible = await btn.isVisible().catch(() => false);
            if (visible && (text.includes('发送') || text.includes('查询') || text.includes('提问') || text.includes('分析'))) {
              sendBtn = btn;
              break;
            }
          }

          // Also look for icon buttons (like send icon)
          if (!sendBtn) {
            const iconBtns = await page.locator('button .el-icon, button svg, button i').all();
            if (iconBtns.length > 0) {
              sendBtn = await page.locator('button').last();
            }
          }

          if (sendBtn) {
            await sendBtn.click();
            // Wait for AI response
            await waitForStable(8000);
            await takeScreenshot('smartbi-aiquery-response');

            // Check if any response appeared
            const msgBubbles = await page.locator('.message, [class*="message"], [class*="answer"], [class*="response"], [class*="reply"]').count();
            const charts = await page.locator('canvas, [class*="chart"]').count();
            const loading = await page.locator('.el-loading-mask, [class*="loading"]').count();
            const streamText = await page.locator('[class*="stream"], [class*="typing"]').count();

            ev3.checks.push({ msgBubbles, charts, loading, streamText });
            let detail = `Query sent`;
            if (msgBubbles > 0) detail += ` | ${msgBubbles} response messages`;
            if (charts > 0) detail += ` | ${charts} charts rendered`;
            if (loading > 0) detail += ` | still loading`;

            log('SmartBI-AIQuery-Query', msgBubbles > 0 || charts > 0 || loading > 0 ? 'PASS' : 'WARN', detail);
          } else {
            log('SmartBI-AIQuery-Query', 'WARN', 'Input found but no send button detected');
          }
        } catch (fillErr) {
          log('SmartBI-AIQuery-Query', 'WARN', `Could not interact with input: ${fillErr.message.slice(0, 100)}`);
        }
      } else {
        log('SmartBI-AIQuery', 'WARN', `AI Query page loaded but no input field found at ${url.replace(BASE, '')}`);
        await takeScreenshot('smartbi-aiquery-noinput');
      }
    }
    ev3.networkErrors = [...currentTestErrors];
    if (currentTestErrors.length > 0) {
      log('SmartBI-AIQuery-Network', 'WARN', `${currentTestErrors.length} errors: ${currentTestErrors.slice(0, 3).join(' | ')}`);
    }
  } catch (err) {
    log('SmartBI-AIQuery', 'FAIL', err.message.slice(0, 150));
  }

  // ============================================================
  // TEST 4: AI Intent Config (/system/ai-intents)
  // ============================================================
  console.log('\n' + '='.repeat(50));
  console.log('TEST 4: AI Intent Config');
  console.log('='.repeat(50));

  currentTestErrors = [];
  const ev4 = collectEvidence('AI-Intent-Config');
  try {
    await page.goto(`${BASE}/system/ai-intents`, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await waitForStable(3000);

    const url = page.url();
    if (url.includes('/login')) {
      log('AI-Intent-Config', 'FAIL', 'Redirected to login');
    } else {
      const content = await hasContent();
      const rows = await countTableRows();
      const searchInput = await page.locator('input[placeholder*="搜索"], input[placeholder*="查询"], .el-input input').count();
      const filterBtns = await page.locator('.el-select, .el-radio-group, .el-switch').count();

      ev4.checks.push({ ...content, rows, searchInput, filterBtns });

      let detail = `Page at ${url.replace(BASE, '')}`;
      if (rows > 0) detail += ` | ${rows} intent configs in table`;
      if (content.table) detail += ' | table present';
      if (searchInput > 0) detail += ` | ${searchInput} search inputs`;
      if (filterBtns > 0) detail += ` | ${filterBtns} filters`;

      log('AI-Intent-Config', content.table ? 'PASS' : 'WARN', detail);
      await takeScreenshot('ai-intent-config');
    }
    ev4.networkErrors = [...currentTestErrors];
    if (currentTestErrors.length > 0) {
      log('AI-Intent-Config-Network', 'WARN', `${currentTestErrors.length} errors: ${currentTestErrors.slice(0, 3).join(' | ')}`);
    }
  } catch (err) {
    log('AI-Intent-Config', 'FAIL', err.message.slice(0, 150));
  }

  // ============================================================
  // TEST 5: Transfer Management (/transfer/list)
  // ============================================================
  console.log('\n' + '='.repeat(50));
  console.log('TEST 5: Transfer Management');
  console.log('='.repeat(50));

  currentTestErrors = [];
  const ev5 = collectEvidence('Transfer-Management');
  try {
    await page.goto(`${BASE}/transfer/list`, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await waitForStable(3000);

    const url = page.url();
    if (url.includes('/login')) {
      log('Transfer-List', 'FAIL', 'Redirected to login');
    } else {
      const content = await hasContent();
      const rows = await countTableRows();
      const createBtn = await page.locator('button').all();
      let hasCreateBtn = false;
      let createBtnText = '';

      for (const btn of createBtn) {
        const text = await btn.textContent().catch(() => '');
        if (text.includes('新建') || text.includes('创建') || text.includes('新增') || text.includes('发起')) {
          hasCreateBtn = true;
          createBtnText = text.trim();
          break;
        }
      }

      ev5.checks.push({ ...content, rows, hasCreateBtn, createBtnText });

      let detail = `Page at ${url.replace(BASE, '')}`;
      if (rows > 0) detail += ` | ${rows} transfer records`;
      else if (content.table) detail += ' | table present, 0 rows';
      if (hasCreateBtn) detail += ` | create button: "${createBtnText}"`;

      // Check status tags
      const statusTags = await page.locator('.el-tag').count();
      if (statusTags > 0) detail += ` | ${statusTags} status tags`;

      log('Transfer-List', content.table ? 'PASS' : 'WARN', detail);
      await takeScreenshot('transfer-list');

      // Test Create Transfer flow
      if (hasCreateBtn) {
        console.log('  -> Testing Create Transfer dialog...');
        for (const btn of createBtn) {
          const text = await btn.textContent().catch(() => '');
          if (text.includes('新建') || text.includes('创建') || text.includes('新增') || text.includes('发起')) {
            await btn.click();
            await waitForStable(2000);
            break;
          }
        }

        // Check if dialog/drawer opened
        const dialog = await page.locator('.el-dialog, .el-drawer').count();
        const formItems = await page.locator('.el-form-item').count();

        ev5.checks.push({ dialogOpened: dialog > 0, formItems });

        if (dialog > 0 || formItems > 1) {
          log('Transfer-Create-Dialog', 'PASS', `Create dialog opened | ${formItems} form fields`);
          await takeScreenshot('transfer-create-dialog');

          // Close dialog
          const closeBtn = await page.locator('.el-dialog__headerbtn, .el-drawer__close-btn, button:has-text("取消")').first();
          if (closeBtn) {
            await closeBtn.click().catch(() => {});
            await waitForStable(1000);
          }
        } else {
          // Maybe navigated to a new page
          const newUrl = page.url();
          if (newUrl !== url) {
            log('Transfer-Create', 'PASS', `Navigated to create page: ${newUrl.replace(BASE, '')}`);
            await takeScreenshot('transfer-create-page');
            // Go back
            await page.goBack();
            await waitForStable(2000);
          } else {
            log('Transfer-Create-Dialog', 'WARN', 'Create button clicked but no dialog opened');
          }
        }
      }
    }
    ev5.networkErrors = [...currentTestErrors];
    if (currentTestErrors.length > 0) {
      log('Transfer-Network', 'WARN', `${currentTestErrors.length} errors: ${currentTestErrors.slice(0, 3).join(' | ')}`);
    }
  } catch (err) {
    log('Transfer-Management', 'FAIL', err.message.slice(0, 150));
  }

  // ============================================================
  // TEST 6: BOM Achievement Analysis (/production/bom-achievement)
  // ============================================================
  console.log('\n' + '='.repeat(50));
  console.log('TEST 6: BOM Achievement Analysis');
  console.log('='.repeat(50));

  currentTestErrors = [];
  const ev6 = collectEvidence('BOM-Achievement');
  try {
    await page.goto(`${BASE}/production/bom-achievement`, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await waitForStable(4000);

    const url = page.url();
    if (url.includes('/login')) {
      log('BOM-Achievement', 'FAIL', 'Redirected to login');
    } else {
      const content = await hasContent();
      const chartCount = await page.locator('canvas, [class*="echarts"], [class*="chart"]').count();
      const rows = await countTableRows();
      const kpiCards = await page.locator('.el-card, [class*="stat"], [class*="kpi"], [class*="summary"]').count();
      const dateRange = await page.locator('.el-date-editor, .el-range-editor').count();
      const emptyState = await page.locator('.el-empty').count();

      ev6.checks.push({ ...content, chartCount, rows, kpiCards, dateRange, emptyState });

      let detail = `Page at ${url.replace(BASE, '')}`;
      if (chartCount > 0) detail += ` | ${chartCount} charts`;
      if (rows > 0) detail += ` | ${rows} data rows`;
      if (kpiCards > 0) detail += ` | ${kpiCards} cards`;
      if (dateRange > 0) detail += ' | date range filter';
      if (emptyState > 0) detail += ' | empty state shown (no data)';

      const status = chartCount > 0 || rows > 0 ? 'PASS' : (emptyState > 0 ? 'WARN' : 'PASS');
      log('BOM-Achievement', status, detail);
      await takeScreenshot('bom-achievement');
    }
    ev6.networkErrors = [...currentTestErrors];
    if (currentTestErrors.length > 0) {
      log('BOM-Achievement-Network', 'WARN', `${currentTestErrors.length} errors: ${currentTestErrors.slice(0, 3).join(' | ')}`);
    }
  } catch (err) {
    log('BOM-Achievement', 'FAIL', err.message.slice(0, 150));
  }

  // ============================================================
  // TEST 7: Process IO Comparison (/production/process-io)
  // ============================================================
  console.log('\n' + '='.repeat(50));
  console.log('TEST 7: Process IO Comparison');
  console.log('='.repeat(50));

  currentTestErrors = [];
  const ev7 = collectEvidence('Process-IO');
  try {
    await page.goto(`${BASE}/production/process-io`, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await waitForStable(4000);

    const url = page.url();
    if (url.includes('/login')) {
      log('Process-IO', 'FAIL', 'Redirected to login');
    } else if (url.includes('/404')) {
      log('Process-IO', 'WARN', 'Route /production/process-io returned 404');
    } else {
      const content = await hasContent();
      const chartCount = await page.locator('canvas, [class*="echarts"], [class*="chart"]').count();
      const rows = await countTableRows();
      const selectFilters = await page.locator('.el-select').count();
      const emptyState = await page.locator('.el-empty').count();

      ev7.checks.push({ ...content, chartCount, rows, selectFilters, emptyState });

      let detail = `Page at ${url.replace(BASE, '')}`;
      if (chartCount > 0) detail += ` | ${chartCount} charts`;
      if (rows > 0) detail += ` | ${rows} data rows`;
      if (selectFilters > 0) detail += ` | ${selectFilters} filter selects`;
      if (emptyState > 0) detail += ' | empty state (no data)';

      log('Process-IO', 'PASS', detail);
      await takeScreenshot('process-io');
    }
    ev7.networkErrors = [...currentTestErrors];
    if (currentTestErrors.length > 0) {
      log('Process-IO-Network', 'WARN', `${currentTestErrors.length} errors: ${currentTestErrors.slice(0, 3).join(' | ')}`);
    }
  } catch (err) {
    log('Process-IO', 'FAIL', err.message.slice(0, 150));
  }

  // ============================================================
  // TEST 8: Conversion Rate Config (/production/bom?tab=conversion)
  // ============================================================
  console.log('\n' + '='.repeat(50));
  console.log('TEST 8: Conversion Rate Config');
  console.log('='.repeat(50));

  currentTestErrors = [];
  const ev8 = collectEvidence('Conversion-Config');
  try {
    // Route says /production/conversions redirects to /production/bom?tab=conversion
    await page.goto(`${BASE}/production/bom`, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await waitForStable(3000);

    const url = page.url();
    if (url.includes('/login')) {
      log('Conversion-Config', 'FAIL', 'Redirected to login');
    } else {
      const content = await hasContent();
      const tabs = await page.locator('.el-tabs__item').all();
      let conversionTabFound = false;
      let tabNames = [];

      for (const tab of tabs) {
        const text = await tab.textContent().catch(() => '');
        tabNames.push(text.trim());
        if (text.includes('转换') || text.includes('conversion') || text.includes('Conversion')) {
          conversionTabFound = true;
          // Click conversion tab
          await tab.click();
          await waitForStable(2000);
          break;
        }
      }

      ev8.checks.push({ tabNames, conversionTabFound });

      const rows = await countTableRows();
      let detail = `BOM page at ${url.replace(BASE, '')} | tabs: ${tabNames.join(', ')}`;
      if (conversionTabFound) {
        detail += ` | conversion tab found and clicked | ${rows} rows`;
        log('Conversion-Config', 'PASS', detail);
      } else {
        detail += ` | NO conversion tab found among ${tabNames.length} tabs`;
        log('Conversion-Config', 'WARN', detail);
      }
      await takeScreenshot('conversion-config');
    }
    ev8.networkErrors = [...currentTestErrors];
    if (currentTestErrors.length > 0) {
      log('Conversion-Config-Network', 'WARN', `${currentTestErrors.length} errors: ${currentTestErrors.slice(0, 3).join(' | ')}`);
    }
  } catch (err) {
    log('Conversion-Config', 'FAIL', err.message.slice(0, 150));
  }

  // ============================================================
  // TEST 9: SmartBI Finance Analysis (/smart-bi/finance)
  // ============================================================
  console.log('\n' + '='.repeat(50));
  console.log('TEST 9: SmartBI Finance Analysis');
  console.log('='.repeat(50));

  currentTestErrors = [];
  const ev9 = collectEvidence('SmartBI-Finance');
  try {
    await page.goto(`${BASE}/smart-bi/finance`, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await waitForStable(3000);

    const url = page.url();
    if (url.includes('/login')) {
      log('SmartBI-Finance', 'FAIL', 'Redirected to login');
    } else {
      const content = await hasContent();
      const chartCount = await page.locator('canvas, [class*="echarts"], [class*="chart"]').count();

      ev9.checks.push({ ...content, chartCount });

      let detail = `Page at ${url.replace(BASE, '')}`;
      if (chartCount > 0) detail += ` | ${chartCount} charts`;
      if (content.cards) detail += ' | cards present';

      log('SmartBI-Finance', 'PASS', detail);
      await takeScreenshot('smartbi-finance');
    }
    ev9.networkErrors = [...currentTestErrors];
    if (currentTestErrors.length > 0) {
      log('SmartBI-Finance-Network', 'WARN', `${currentTestErrors.length} errors: ${currentTestErrors.slice(0, 3).join(' | ')}`);
    }
  } catch (err) {
    log('SmartBI-Finance', 'FAIL', err.message.slice(0, 150));
  }

  // ============================================================
  // TEST 10: SmartBI Sales (/smart-bi/sales)
  // ============================================================
  console.log('\n' + '='.repeat(50));
  console.log('TEST 10: SmartBI Sales Analysis');
  console.log('='.repeat(50));

  currentTestErrors = [];
  const ev10 = collectEvidence('SmartBI-Sales');
  try {
    await page.goto(`${BASE}/smart-bi/sales`, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await waitForStable(3000);

    const url = page.url();
    if (url.includes('/login')) {
      log('SmartBI-Sales', 'FAIL', 'Redirected to login');
    } else {
      const content = await hasContent();
      const chartCount = await page.locator('canvas, [class*="echarts"], [class*="chart"]').count();

      ev10.checks.push({ ...content, chartCount });
      let detail = `Page at ${url.replace(BASE, '')}`;
      if (chartCount > 0) detail += ` | ${chartCount} charts`;
      if (content.cards) detail += ' | cards present';

      log('SmartBI-Sales', 'PASS', detail);
      await takeScreenshot('smartbi-sales');
    }
    ev10.networkErrors = [...currentTestErrors];
    if (currentTestErrors.length > 0) {
      log('SmartBI-Sales-Network', 'WARN', `${currentTestErrors.length} errors: ${currentTestErrors.slice(0, 3).join(' | ')}`);
    }
  } catch (err) {
    log('SmartBI-Sales', 'FAIL', err.message.slice(0, 150));
  }

  // ============================================================
  // TEST 11: Restaurant Requisitions (/restaurant/requisitions)
  // ============================================================
  console.log('\n' + '='.repeat(50));
  console.log('TEST 11: Restaurant Requisitions');
  console.log('='.repeat(50));

  currentTestErrors = [];
  const ev11 = collectEvidence('Restaurant-Requisitions');
  try {
    await page.goto(`${BASE}/restaurant/requisitions`, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await waitForStable(3000);

    const url = page.url();
    if (url.includes('/login')) {
      log('Restaurant-Requisitions', 'FAIL', 'Redirected to login');
    } else {
      const content = await hasContent();
      const rows = await countTableRows();

      ev11.checks.push({ ...content, rows });

      let detail = `Page at ${url.replace(BASE, '')}`;
      if (rows > 0) detail += ` | ${rows} records`;
      else if (content.table) detail += ' | table present, 0 records';

      log('Restaurant-Requisitions', content.table ? 'PASS' : 'WARN', detail);
      await takeScreenshot('restaurant-requisitions');
    }
    ev11.networkErrors = [...currentTestErrors];
  } catch (err) {
    log('Restaurant-Requisitions', 'FAIL', err.message.slice(0, 150));
  }

  // ============================================================
  // TEST 12: Restaurant Wastage (/restaurant/wastage)
  // ============================================================
  console.log('\n' + '='.repeat(50));
  console.log('TEST 12: Restaurant Wastage');
  console.log('='.repeat(50));

  currentTestErrors = [];
  const ev12 = collectEvidence('Restaurant-Wastage');
  try {
    await page.goto(`${BASE}/restaurant/wastage`, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await waitForStable(3000);

    const url = page.url();
    if (url.includes('/login')) {
      log('Restaurant-Wastage', 'FAIL', 'Redirected to login');
    } else {
      const content = await hasContent();
      const rows = await countTableRows();

      ev12.checks.push({ ...content, rows });

      let detail = `Page at ${url.replace(BASE, '')}`;
      if (rows > 0) detail += ` | ${rows} records`;
      else if (content.table) detail += ' | table present, 0 records';

      log('Restaurant-Wastage', content.table ? 'PASS' : 'WARN', detail);
      await takeScreenshot('restaurant-wastage');
    }
    ev12.networkErrors = [...currentTestErrors];
  } catch (err) {
    log('Restaurant-Wastage', 'FAIL', err.message.slice(0, 150));
  }

  // ============================================================
  // TEST 13: Restaurant Analytics (/restaurant/analytics)
  // ============================================================
  console.log('\n' + '='.repeat(50));
  console.log('TEST 13: Restaurant Analytics Overview');
  console.log('='.repeat(50));

  currentTestErrors = [];
  const ev13 = collectEvidence('Restaurant-Analytics');
  try {
    await page.goto(`${BASE}/restaurant/analytics`, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await waitForStable(3000);

    const url = page.url();
    if (url.includes('/login')) {
      log('Restaurant-Analytics', 'FAIL', 'Redirected to login');
    } else {
      const content = await hasContent();
      const chartCount = await page.locator('canvas, [class*="echarts"], [class*="chart"]').count();

      ev13.checks.push({ ...content, chartCount });

      let detail = `Page at ${url.replace(BASE, '')}`;
      if (chartCount > 0) detail += ` | ${chartCount} charts`;
      if (content.cards) detail += ' | cards present';

      log('Restaurant-Analytics', 'PASS', detail);
      await takeScreenshot('restaurant-analytics');
    }
    ev13.networkErrors = [...currentTestErrors];
  } catch (err) {
    log('Restaurant-Analytics', 'FAIL', err.message.slice(0, 150));
  }

  // ============================================================
  // TEST 14: Production Analytics (/production-analytics/production)
  // ============================================================
  console.log('\n' + '='.repeat(50));
  console.log('TEST 14: Production Data Analysis');
  console.log('='.repeat(50));

  currentTestErrors = [];
  const ev14 = collectEvidence('Production-Analytics');
  try {
    await page.goto(`${BASE}/production-analytics/production`, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await waitForStable(3000);

    const url = page.url();
    if (url.includes('/login')) {
      log('Production-Analytics', 'FAIL', 'Redirected to login');
    } else {
      const content = await hasContent();
      const chartCount = await page.locator('canvas, [class*="echarts"], [class*="chart"]').count();

      ev14.checks.push({ ...content, chartCount });

      let detail = `Page at ${url.replace(BASE, '')}`;
      if (chartCount > 0) detail += ` | ${chartCount} charts`;
      if (content.cards) detail += ' | cards present';

      log('Production-Analytics', 'PASS', detail);
      await takeScreenshot('production-analytics');
    }
    ev14.networkErrors = [...currentTestErrors];
  } catch (err) {
    log('Production-Analytics', 'FAIL', err.message.slice(0, 150));
  }

  // ============================================================
  // TEST 15: SmartBI What-If Simulator (/smart-bi/whatif)
  // ============================================================
  console.log('\n' + '='.repeat(50));
  console.log('TEST 15: SmartBI What-If Simulator');
  console.log('='.repeat(50));

  currentTestErrors = [];
  const ev15 = collectEvidence('SmartBI-WhatIf');
  try {
    await page.goto(`${BASE}/smart-bi/whatif`, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await waitForStable(3000);

    const url = page.url();
    if (url.includes('/login')) {
      log('SmartBI-WhatIf', 'FAIL', 'Redirected to login');
    } else {
      const content = await hasContent();
      const sliders = await page.locator('.el-slider').count();
      const inputs = await page.locator('.el-input-number, input[type="number"]').count();
      const chartCount = await page.locator('canvas, [class*="echarts"], [class*="chart"]').count();

      ev15.checks.push({ ...content, sliders, inputs, chartCount });

      let detail = `Page at ${url.replace(BASE, '')}`;
      if (sliders > 0) detail += ` | ${sliders} sliders`;
      if (inputs > 0) detail += ` | ${inputs} number inputs`;
      if (chartCount > 0) detail += ` | ${chartCount} charts`;

      log('SmartBI-WhatIf', 'PASS', detail);
      await takeScreenshot('smartbi-whatif');
    }
    ev15.networkErrors = [...currentTestErrors];
    if (currentTestErrors.length > 0) {
      log('SmartBI-WhatIf-Network', 'WARN', `${currentTestErrors.length} errors: ${currentTestErrors.slice(0, 3).join(' | ')}`);
    }
  } catch (err) {
    log('SmartBI-WhatIf', 'FAIL', err.message.slice(0, 150));
  }

  // ============================================================
  // FORCED EVIDENCE SUMMARY
  // ============================================================
  console.log('\n' + '='.repeat(70));
  console.log('FORCED EVIDENCE REPORT');
  console.log('='.repeat(70));

  const passes = results.filter(r => r.status === 'PASS');
  const warns = results.filter(r => r.status === 'WARN');
  const fails = results.filter(r => r.status === 'FAIL');

  console.log(`\nTOTAL: ${results.length} checks`);
  console.log(`  PASS: ${passes.length}`);
  console.log(`  WARN: ${warns.length}`);
  console.log(`  FAIL: ${fails.length}`);

  console.log('\n--- DETAILED RESULTS ---\n');

  // Group by test module (strip sub-test suffixes)
  const modules = {};
  for (const r of results) {
    const base = r.module.split('-Network')[0].split('-AIQuery')[0].split('-Create')[0].split('-PageLoad')[0].split('-Query')[0];
    if (!modules[base]) modules[base] = [];
    modules[base].push(r);
  }

  for (const [mod, items] of Object.entries(modules)) {
    const worst = items.some(i => i.status === 'FAIL') ? 'FAIL' : items.some(i => i.status === 'WARN') ? 'WARN' : 'PASS';
    console.log(`\n[${worst}] ${mod}:`);
    for (const item of items) {
      console.log(`  [${item.status}] ${item.module}: ${item.detail}`);
    }
    // Evidence
    const evKey = Object.keys(evidence).find(k => k.startsWith(mod) || mod.startsWith(k));
    if (evKey && evidence[evKey]) {
      const ev = evidence[evKey];
      if (ev.checks.length > 0) {
        console.log(`  Evidence: ${JSON.stringify(ev.checks).substring(0, 200)}`);
      }
      if (ev.networkErrors.length > 0) {
        console.log(`  Network Errors: ${ev.networkErrors.slice(0, 5).join(' | ')}`);
      }
    }
  }

  console.log('\n--- SCREENSHOTS ---');
  console.log(`Total screenshots: ${screenshotCounter}`);
  console.log(`Location: ${ssDir}/layer2-*.png`);

  if (fails.length > 0) {
    console.log('\n--- FAILURES ---');
    for (const f of fails) {
      console.log(`  [FAIL] ${f.module}: ${f.detail}`);
    }
  }

  if (warns.length > 0) {
    console.log('\n--- WARNINGS ---');
    for (const w of warns) {
      console.log(`  [WARN] ${w.module}: ${w.detail}`);
    }
  }

  console.log('\n' + '='.repeat(70));
  console.log(`Layer 2 E2E Complete: ${passes.length} PASS, ${warns.length} WARN, ${fails.length} FAIL`);
  console.log('='.repeat(70));

  await browser.close();
})();
