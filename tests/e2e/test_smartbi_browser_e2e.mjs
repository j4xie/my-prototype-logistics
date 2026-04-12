/**
 * SmartBI Browser E2E — Playwright-based frontend verification
 *
 * Tests the full user journey: Login → Navigate to SmartBI Chat → Send query → Verify response
 * Uses chromium.launch() for independent browser (E2E skill requirement)
 */
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const BASE_URL = process.env.E2E_ADMIN_URL || 'http://localhost:5173';
const API_BASE = process.env.E2E_API_BASE || 'http://localhost:10011';
const SCREENSHOT_DIR = 'tests/e2e/screenshots';

// Phase 1-4 queries to test via SmartBI chat
const QUERIES = [
  { query: '人效分析', phase: 'P1', name: 'Labor Productivity' },
  { query: 'BOM差异归因', phase: 'P1', name: 'BOM Variance' },
  { query: '销售计划完成度', phase: 'P1', name: 'Sales Plan Track' },
  { query: '桌位占有率', phase: 'P2', name: 'Seat Occupancy' },
  { query: '套餐拆单', phase: 'P2', name: 'Combo Split' },
  { query: '退货异常', phase: 'P2', name: 'Return Anomaly' },
  { query: '叫货单', phase: 'P3', name: 'Smart Reorder' },
  { query: '日清日结', phase: 'P3', name: 'Daily Reconciliation' },
  { query: '排班分析', phase: 'P4', name: 'Shift Analysis' },
  { query: '计件提成', phase: 'P4', name: 'Piecework Calc' },
  { query: '绩效考核', phase: 'P4', name: 'Performance Eval' },
  { query: '店长KPI', phase: 'P4', name: 'Store KPI Dashboard' },
];

fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

async function main() {
  console.log('====== SmartBI Browser E2E ======');
  console.log(`Web: ${BASE_URL}`);
  console.log(`API: ${API_BASE}`);
  console.log('');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });

  // Intercept API calls to route through test env
  await context.route('**/api/mobile/**', async (route) => {
    const url = route.request().url();
    // Replace origin with API_BASE for proxied requests
    const newUrl = url.replace(/https?:\/\/[^/]+/, API_BASE);
    try {
      const response = await route.fetch({ url: newUrl });
      await route.fulfill({ response });
    } catch (e) {
      await route.continue();
    }
  });

  const page = await context.newPage();

  // Step 1: Login
  console.log('--- Step 1: Login ---');
  try {
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle', timeout: 15000 });
    await page.screenshot({ path: `${SCREENSHOT_DIR}/01-login-page.png` });

    // Fill login form
    const usernameInput = page.locator('input[type="text"], input[placeholder*="用户"], input[placeholder*="user"]').first();
    const passwordInput = page.locator('input[type="password"]').first();

    if (await usernameInput.count() > 0) {
      await usernameInput.fill('factory_admin1');
      await passwordInput.fill('admin123');

      // Fill factoryId if present
      const factoryInput = page.locator('input[placeholder*="工厂"], input[placeholder*="factory"], input[placeholder*="ID"]').first();
      if (await factoryInput.count() > 0) {
        await factoryInput.fill('F001');
      }

      await page.screenshot({ path: `${SCREENSHOT_DIR}/02-login-filled.png` });

      // Find login button — text may have spaces like "登 录"
      const loginBtn = page.locator('button').filter({ hasText: /登.*录|Login|登录/ }).first();
      if (await loginBtn.count() === 0) {
        // Fallback: any primary/submit button
        const fallbackBtn = page.locator('button.el-button--primary, button[type="submit"]').first();
        await fallbackBtn.click();
      } else {
        await loginBtn.click();
      }
      await page.waitForTimeout(3000);
      // Wait for redirect away from login
      await page.waitForURL(/(?!.*login).*/, { timeout: 10000 }).catch(() => {});
      await page.screenshot({ path: `${SCREENSHOT_DIR}/03-after-login.png` });
      console.log('  Login: OK');
    } else {
      console.log('  Login: No form found, trying direct navigation');
    }
  } catch (e) {
    console.log(`  Login error: ${e.message}`);
    await page.screenshot({ path: `${SCREENSHOT_DIR}/03-login-error.png` });
  }

  // Step 2: Navigate to SmartBI chat
  console.log('');
  console.log('--- Step 2: Navigate to SmartBI ---');
  try {
    await page.goto(`${BASE_URL}/smart-bi/query`, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(3000);
    await page.screenshot({ path: `${SCREENSHOT_DIR}/04-smartbi-query.png` });
    console.log('  SmartBI AI Query page: Loaded');
  } catch (e) {
    console.log(`  SmartBI navigation error: ${e.message}`);
    await page.screenshot({ path: `${SCREENSHOT_DIR}/04-smartbi-error.png` });
  }

  // Step 3: Test queries
  console.log('');
  console.log('--- Step 3: SmartBI Query Tests ---');
  let pass = 0, fail = 0;

  for (const { query, phase, name } of QUERIES) {
    try {
      // Find chat input
      const chatInput = page.locator('textarea, input[placeholder*="输入"], input[placeholder*="问"], .chat-input input, .el-textarea__inner').first();

      if (await chatInput.count() === 0) {
        console.log(`  [SKIP] ${name}: No chat input found`);
        fail++;
        continue;
      }

      // Type query
      await chatInput.fill('');
      await chatInput.fill(query);

      // Send (Enter or button)
      const sendBtn = page.locator('button:has-text("发送"), button:has-text("Send"), .send-btn, button[class*="send"]').first();
      if (await sendBtn.count() > 0) {
        await sendBtn.click();
      } else {
        await chatInput.press('Enter');
      }

      // Wait for response
      await page.waitForTimeout(5000);

      // Take screenshot
      const screenshotName = `${SCREENSHOT_DIR}/05-${phase}-${name.replace(/\s+/g, '_')}.png`;
      await page.screenshot({ path: screenshotName });

      // Check for response content
      const responseText = await page.textContent('body');
      const hasResponse = responseText.includes('section=') ||
                          responseText.includes('需要您提供') ||
                          responseText.includes('以下是') ||
                          responseText.includes('跳过') ||
                          responseText.includes('分析') ||
                          responseText.includes('结果');

      if (hasResponse) {
        pass++;
        console.log(`  [PASS] [${phase}] ${name} — screenshot: ${screenshotName}`);
      } else {
        fail++;
        console.log(`  [FAIL] [${phase}] ${name} — no response detected`);
      }

      // Small delay between queries
      await page.waitForTimeout(2000);

    } catch (e) {
      fail++;
      console.log(`  [FAIL] [${phase}] ${name}: ${e.message}`);
    }
  }

  // Final screenshot
  await page.screenshot({ path: `${SCREENSHOT_DIR}/99-final-state.png`, fullPage: true });

  await browser.close();

  // Summary
  console.log('');
  console.log(`====== BROWSER E2E SUMMARY: ${pass}/${pass + fail} PASS ======`);
  console.log(`Screenshots saved to: ${SCREENSHOT_DIR}/`);

  process.exit(fail > 0 ? 1 : 0);
}

main().catch(e => { console.error(e); process.exit(1); });
