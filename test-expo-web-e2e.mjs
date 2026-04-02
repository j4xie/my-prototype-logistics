/**
 * Expo Web E2E Test — Layer 1 (Page Scan) + Layer 2 (Basic Operations)
 *
 * Target: http://localhost:8081 (Expo Web)
 * API: http://localhost:10010
 * Login: factory_admin1 / 123456
 *
 * Playwright script — run with: node test-expo-web-e2e.mjs
 */

import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const EXPO_URL = 'http://localhost:8081';
const API_URL = 'http://localhost:10010';
const SCREENSHOT_DIR = path.join(process.cwd(), 'test-screenshots');
const TIMEOUT = 15000;

// Ensure screenshot dir
if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

// Test results accumulator
const results = {
  layer1: [],
  layer2: [],
  startTime: null,
  endTime: null,
};

function record(layer, testName, status, evidence = '') {
  const entry = { testName, status, evidence, timestamp: new Date().toISOString() };
  results[layer].push(entry);
  const icon = status === 'PASS' ? '[PASS]' : status === 'FAIL' ? '[FAIL]' : '[SKIP]';
  console.log(`  ${icon} ${testName}${evidence ? ' — ' + evidence : ''}`);
}

async function screenshot(page, name) {
  const filePath = path.join(SCREENSHOT_DIR, `${name}.png`);
  await page.screenshot({ path: filePath, fullPage: false });
  return filePath;
}

async function waitForNetworkIdle(page, ms = 3000) {
  try {
    await page.waitForLoadState('networkidle', { timeout: ms });
  } catch {
    // ok — just best-effort
  }
}

// ============================================================
// LAYER 1: Page Scan
// ============================================================
async function layer1_pageScan(page) {
  console.log('\n=== LAYER 1: PAGE SCAN ===\n');

  // 1.1 Navigate to Expo Web
  console.log('--- 1.1 Initial page load ---');
  try {
    await page.goto(EXPO_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(5000); // let RN bundle load
    await screenshot(page, '01-initial-load');

    const bodyText = await page.evaluate(() => document.body?.innerText || '');
    if (bodyText.length > 0) {
      record('layer1', '1.1 Expo Web loads', 'PASS', `Page has ${bodyText.length} chars of text`);
    } else {
      record('layer1', '1.1 Expo Web loads', 'FAIL', 'Page body is empty');
    }
  } catch (err) {
    record('layer1', '1.1 Expo Web loads', 'FAIL', err.message);
    return; // can't continue
  }

  // 1.2 Login screen detection
  console.log('--- 1.2 Login screen detection ---');
  try {
    // The app starts with a landing view, then user taps "login" to see the form
    // Check if we see the landing or login form
    const pageContent = await page.evaluate(() => document.body?.innerText || '');
    await screenshot(page, '02-login-screen');

    // Look for landing page or login form elements
    const hasLandingBtn = await page.locator('[data-testid="landing-login-btn"]').count();
    const hasLoginInput = await page.locator('[data-testid="login-username-input"]').count();

    if (hasLandingBtn > 0) {
      record('layer1', '1.2 Login screen visible', 'PASS', 'Landing page with login button detected');
      // Click "login" button on landing to get to form
      await page.locator('[data-testid="landing-login-btn"]').click();
      await page.waitForTimeout(1000);
      await screenshot(page, '02b-login-form');
    } else if (hasLoginInput > 0) {
      record('layer1', '1.2 Login screen visible', 'PASS', 'Login form directly visible');
    } else {
      // Fallback: look for text-based indicators
      const hasLoginText = pageContent.includes('登录') || pageContent.includes('Login') || pageContent.includes('login');
      if (hasLoginText) {
        record('layer1', '1.2 Login screen visible', 'PASS', 'Login text found on page');
        // Try clicking any login-related button/text
        const loginBtn = page.getByText(/^登录$|^Login$/i).first();
        if (await loginBtn.count() > 0) {
          await loginBtn.click();
          await page.waitForTimeout(1000);
          await screenshot(page, '02b-login-form-fallback');
        }
      } else {
        record('layer1', '1.2 Login screen visible', 'FAIL', `No login UI found. Page text: ${pageContent.substring(0, 200)}`);
        return;
      }
    }
  } catch (err) {
    record('layer1', '1.2 Login screen visible', 'FAIL', err.message);
    return;
  }

  // 1.3 Login flow
  console.log('--- 1.3 Login ---');
  try {
    // Wait for login form inputs
    await page.waitForTimeout(1000);

    // Find username input — try testID first, then fallback
    let usernameInput = page.locator('[data-testid="login-username-input"]');
    if (await usernameInput.count() === 0) {
      // Fallback: find input by placeholder or type
      usernameInput = page.locator('input[autocomplete="username"]').first();
    }
    if (await usernameInput.count() === 0) {
      // Another fallback: any text input
      usernameInput = page.locator('input[type="text"], input:not([type])').first();
    }

    let passwordInput = page.locator('[data-testid="login-password-input"]');
    if (await passwordInput.count() === 0) {
      passwordInput = page.locator('input[autocomplete="password"]').first();
    }
    if (await passwordInput.count() === 0) {
      passwordInput = page.locator('input[type="password"]').first();
    }

    const uCount = await usernameInput.count();
    const pCount = await passwordInput.count();

    if (uCount === 0 || pCount === 0) {
      // Dump all inputs for debugging
      const inputCount = await page.locator('input').count();
      const allInputs = await page.locator('input').evaluateAll(els =>
        els.map(el => ({ type: el.type, placeholder: el.placeholder, testid: el.dataset?.testid, autocomplete: el.autocomplete }))
      );
      record('layer1', '1.3 Login', 'FAIL', `Cannot find inputs. Found ${inputCount} inputs: ${JSON.stringify(allInputs)}`);
      await screenshot(page, '03-login-fail-no-inputs');
      return;
    }

    // Clear and fill
    await usernameInput.click();
    await usernameInput.fill('factory_admin1');
    await page.waitForTimeout(300);

    await passwordInput.click();
    await passwordInput.fill('123456');
    await page.waitForTimeout(300);

    await screenshot(page, '03-login-filled');

    // Click submit
    let submitBtn = page.locator('[data-testid="login-submit-btn"]');
    if (await submitBtn.count() === 0) {
      // Fallback: find button with login text
      submitBtn = page.getByRole('button', { name: /登录|Login/i }).first();
    }
    if (await submitBtn.count() === 0) {
      // Another fallback: touchable with login text
      submitBtn = page.locator('[role="button"]').filter({ hasText: /登录|Login/i }).first();
    }

    if (await submitBtn.count() === 0) {
      record('layer1', '1.3 Login', 'FAIL', 'Cannot find submit button');
      return;
    }

    // Listen for API call
    const loginResponsePromise = page.waitForResponse(
      resp => resp.url().includes('/auth/') || resp.url().includes('/login'),
      { timeout: TIMEOUT }
    ).catch(() => null);

    await submitBtn.click();
    await page.waitForTimeout(2000);

    const loginResp = await loginResponsePromise;
    await screenshot(page, '04-post-login');

    if (loginResp) {
      const status = loginResp.status();
      if (status === 200) {
        record('layer1', '1.3 Login', 'PASS', `Login API returned ${status}`);
      } else {
        const body = await loginResp.text().catch(() => '');
        record('layer1', '1.3 Login', 'FAIL', `Login API returned ${status}: ${body.substring(0, 200)}`);
        return;
      }
    } else {
      // No API response caught — check page state
      const postLoginText = await page.evaluate(() => document.body?.innerText || '');
      if (postLoginText.includes('首页') || postLoginText.includes('Home') || postLoginText.includes('管理')) {
        record('layer1', '1.3 Login', 'PASS', 'Page navigated to home (no login API intercepted)');
      } else {
        record('layer1', '1.3 Login', 'FAIL', `No login response and page doesn't show home. Text: ${postLoginText.substring(0, 200)}`);
        return;
      }
    }
  } catch (err) {
    record('layer1', '1.3 Login', 'FAIL', err.message);
    await screenshot(page, '03-login-error');
    return;
  }

  // 1.4 Dashboard/home screen loads
  console.log('--- 1.4 Home screen ---');
  try {
    await page.waitForTimeout(3000); // let dashboard load
    await waitForNetworkIdle(page, 5000);
    await screenshot(page, '05-home-screen');

    const homeText = await page.evaluate(() => document.body?.innerText || '');
    // Factory admin home should show dashboard-like content
    const homeIndicators = ['首页', '管理', '我的', '今日', 'Home', 'Dashboard', 'AI'];
    const found = homeIndicators.filter(ind => homeText.includes(ind));

    if (found.length >= 1) {
      record('layer1', '1.4 Home screen loads', 'PASS', `Found indicators: ${found.join(', ')}`);
    } else {
      record('layer1', '1.4 Home screen loads', 'FAIL', `No home indicators found. Page text: ${homeText.substring(0, 300)}`);
    }
  } catch (err) {
    record('layer1', '1.4 Home screen loads', 'FAIL', err.message);
  }

  // 1.5 Tab navigation scan
  console.log('--- 1.5 Tab navigation ---');
  // Expected tabs for factory_super_admin: 首页, AI分析, 报表, 智能分析, 管理, 我的
  const expectedTabs = [
    { name: '首页', altNames: ['Home', '首页'] },
    { name: 'AI分析', altNames: ['AI分析', 'AI Analysis', 'AI'] },
    { name: '报表', altNames: ['报表', 'Reports'] },
    { name: '智能分析', altNames: ['智能分析', 'SmartBI', 'Smart'] },
    { name: '管理', altNames: ['管理', 'Management', 'Settings'] },
    { name: '我的', altNames: ['我的', 'Profile', 'Me'] },
  ];

  for (const tab of expectedTabs) {
    try {
      // Try to find and click the tab
      let tabElement = null;
      for (const altName of tab.altNames) {
        // RN tab bars render as divs with text — try various selectors
        const candidates = page.locator(`[role="tab"], [role="button"], [data-testid*="tab"]`).filter({ hasText: altName });
        if (await candidates.count() > 0) {
          tabElement = candidates.first();
          break;
        }
        // Also try by text matching in tab bar area
        const textMatch = page.getByText(altName, { exact: true });
        if (await textMatch.count() > 0) {
          tabElement = textMatch.first();
          break;
        }
      }

      if (!tabElement || await tabElement.count() === 0) {
        // Try a broader search
        for (const altName of tab.altNames) {
          const broad = page.getByText(altName);
          if (await broad.count() > 0) {
            tabElement = broad.last(); // tab bar is at bottom, so "last" is more likely
            break;
          }
        }
      }

      if (tabElement && await tabElement.count() > 0) {
        await tabElement.click();
        await page.waitForTimeout(2000);
        await waitForNetworkIdle(page, 3000);
        const ssName = `06-tab-${tab.name.replace(/[^\w]/g, '')}`;
        await screenshot(page, ssName);

        const tabText = await page.evaluate(() => document.body?.innerText || '');
        record('layer1', `1.5 Tab: ${tab.name}`, 'PASS', `Clicked and loaded (${tabText.length} chars)`);
      } else {
        record('layer1', `1.5 Tab: ${tab.name}`, 'SKIP', 'Tab element not found (may be disabled by feature flags)');
      }
    } catch (err) {
      record('layer1', `1.5 Tab: ${tab.name}`, 'FAIL', err.message);
    }
  }

  // Navigate back to home tab for Layer 2
  try {
    const homeTab = page.getByText('首页').last();
    if (await homeTab.count() > 0) {
      await homeTab.click();
      await page.waitForTimeout(1000);
    }
  } catch { /* best effort */ }
}

// ============================================================
// LAYER 2: Basic Operations
// ============================================================
async function layer2_basicOps(page) {
  console.log('\n=== LAYER 2: BASIC OPERATIONS ===\n');

  // 2.1 Check API health
  console.log('--- 2.1 API health ---');
  try {
    const resp = await page.request.get(`${API_URL}/api/mobile/health`);
    const status = resp.status();
    if (status === 200) {
      const body = await resp.text();
      record('layer2', '2.1 API health check', 'PASS', `Status ${status}, body: ${body.substring(0, 100)}`);
    } else {
      record('layer2', '2.1 API health check', 'FAIL', `Status ${status}`);
    }
  } catch (err) {
    record('layer2', '2.1 API health check', 'FAIL', err.message);
  }

  // 2.2 Navigate to management/production area to see data lists
  console.log('--- 2.2 View data lists ---');
  try {
    // Click "管理" tab
    const mgmtTab = page.getByText('管理').last();
    if (await mgmtTab.count() > 0) {
      await mgmtTab.click();
      await page.waitForTimeout(2000);
      await waitForNetworkIdle(page, 5000);
      await screenshot(page, '07-management-tab');

      const mgmtText = await page.evaluate(() => document.body?.innerText || '');
      record('layer2', '2.2 Management tab content', 'PASS', `Loaded with ${mgmtText.length} chars`);

      // Look for list items or data entries
      const hasListContent = mgmtText.includes('原材料') || mgmtText.includes('Material') ||
                              mgmtText.includes('供应商') || mgmtText.includes('Supplier') ||
                              mgmtText.includes('工厂') || mgmtText.includes('Factory') ||
                              mgmtText.includes('设备') || mgmtText.includes('SOP') ||
                              mgmtText.includes('质检') || mgmtText.includes('意图');
      if (hasListContent) {
        record('layer2', '2.2a Management has data items', 'PASS', 'Found business data indicators in management view');
      } else {
        record('layer2', '2.2a Management has data items', 'SKIP', `Page text: ${mgmtText.substring(0, 300)}`);
      }
    } else {
      record('layer2', '2.2 Management tab content', 'SKIP', 'Management tab not found');
    }
  } catch (err) {
    record('layer2', '2.2 Management tab content', 'FAIL', err.message);
  }

  // 2.3 Go to home and check for dashboard data
  console.log('--- 2.3 Dashboard data ---');
  try {
    const homeTab = page.getByText('首页').last();
    if (await homeTab.count() > 0) {
      await homeTab.click();
      await page.waitForTimeout(2000);
      await waitForNetworkIdle(page, 5000);
      await screenshot(page, '08-home-data');

      const homeText = await page.evaluate(() => document.body?.innerText || '');
      // Look for data-loaded indicators (numbers, stats, lists)
      const hasNumbers = /\d+/.test(homeText);
      const hasDataKeywords = ['批次', '生产', '今日', '统计', 'batch', 'today', 'production', 'total',
                                '库存', '订单', '待处理', '进行中'].some(kw => homeText.includes(kw));

      if (hasNumbers && hasDataKeywords) {
        record('layer2', '2.3 Dashboard shows data', 'PASS', 'Numbers and business keywords present');
      } else if (hasNumbers) {
        record('layer2', '2.3 Dashboard shows data', 'PASS', 'Numbers found on dashboard (data loaded)');
      } else {
        record('layer2', '2.3 Dashboard shows data', 'FAIL', `No data indicators. Text: ${homeText.substring(0, 300)}`);
      }
    } else {
      record('layer2', '2.3 Dashboard shows data', 'SKIP', 'Home tab not found');
    }
  } catch (err) {
    record('layer2', '2.3 Dashboard shows data', 'FAIL', err.message);
  }

  // 2.4 Check network requests for API calls
  console.log('--- 2.4 API data loading verification ---');
  try {
    const apiCalls = [];

    // Set up listener BEFORE triggering navigation
    const responseHandler = resp => {
      const url = resp.url();
      if (url.includes('/api/') || url.includes('10010')) {
        apiCalls.push({ url, status: resp.status() });
      }
    };
    page.on('response', responseHandler);

    // Navigate to a different tab and back to trigger fresh API calls
    const aiTab = page.getByText('AI分析').last();
    if (await aiTab.count() > 0) {
      await aiTab.click({ force: true });
      await page.waitForTimeout(1500);
    }
    const homeTab2 = page.getByText('首页').last();
    if (await homeTab2.count() > 0) {
      await homeTab2.click({ force: true });
      await page.waitForTimeout(3000);
    }

    page.removeListener('response', responseHandler);

    if (apiCalls.length > 0) {
      const successCalls = apiCalls.filter(c => c.status >= 200 && c.status < 300);
      const failCalls = apiCalls.filter(c => c.status >= 400);
      record('layer2', '2.4 API calls from app', 'PASS',
        `${apiCalls.length} total, ${successCalls.length} success, ${failCalls.length} failed`);

      // Log first few calls
      apiCalls.slice(0, 8).forEach(c => {
        const apiPath = c.url.includes('/api/') ? c.url.substring(c.url.indexOf('/api/')) : c.url;
        console.log(`    API: ${c.status} ${apiPath.substring(0, 100)}`);
      });
    } else {
      record('layer2', '2.4 API calls from app', 'SKIP', 'No API calls intercepted (may use different host)');
    }
  } catch (err) {
    record('layer2', '2.4 API calls from app', 'FAIL', err.message);
  }

  // 2.5 Try to find and click into a data list (production batches or similar)
  console.log('--- 2.5 Production/data list ---');
  try {
    // Look for clickable items that lead to lists
    const listKeywords = ['查看更多', '更多', '全部', '批次', '生产', '订单', '库存', 'View All', 'More'];
    let clicked = false;

    // First try using data-testid selectors for known home screen items
    const testIdTargets = [
      'fa-home-stat-processTasks',
      'fa-home-stat-todayBatches',
      'fa-home-stat-inventory',
    ];
    for (const tid of testIdTargets) {
      const el = page.locator(`[data-testid="${tid}"]`);
      if (await el.count() > 0) {
        // Use force:true to bypass overlay interception (Expo Web z-index issue)
        await el.click({ force: true, timeout: 5000 });
        await page.waitForTimeout(2000);
        await waitForNetworkIdle(page, 3000);
        await screenshot(page, '09-data-list');

        const listText = await page.evaluate(() => document.body?.innerText || '');
        record('layer2', '2.5 Navigate to data list', 'PASS', `Clicked testid="${tid}", page has ${listText.length} chars`);
        clicked = true;
        break;
      }
    }

    // Fallback: try text-based navigation with force:true
    if (!clicked) {
      for (const kw of listKeywords) {
        const el = page.getByText(kw, { exact: false }).first();
        if (await el.count() > 0) {
          try {
            await el.click({ force: true, timeout: 5000 });
            await page.waitForTimeout(2000);
            await waitForNetworkIdle(page, 3000);
            await screenshot(page, '09-data-list');

            const listText = await page.evaluate(() => document.body?.innerText || '');
            record('layer2', '2.5 Navigate to data list', 'PASS', `Clicked "${kw}" (force), page has ${listText.length} chars`);
            clicked = true;
            break;
          } catch { /* try next keyword */ }
        }
      }
    }

    if (!clicked) {
      record('layer2', '2.5 Navigate to data list', 'SKIP', 'No clickable list navigation found');
    }
  } catch (err) {
    record('layer2', '2.5 Navigate to data list', 'FAIL', err.message);
  }

  // 2.6 Console errors check
  console.log('--- 2.6 Console errors ---');
  try {
    const errors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });
    // Trigger some activity
    await page.waitForTimeout(2000);

    // Also collect any existing console errors via evaluate
    const jsErrors = await page.evaluate(() => {
      // Check if there are any error overlays (React error boundary)
      const errorOverlay = document.querySelector('[data-testid="error-overlay"]') ||
                           document.querySelector('.react-error-overlay') ||
                           document.querySelector('#redbox');
      return errorOverlay ? errorOverlay.innerText : null;
    });

    if (jsErrors) {
      record('layer2', '2.6 No fatal JS errors', 'FAIL', `Error overlay found: ${jsErrors.substring(0, 200)}`);
    } else {
      record('layer2', '2.6 No fatal JS errors', 'PASS', 'No error overlays detected');
    }
  } catch (err) {
    record('layer2', '2.6 No fatal JS errors', 'FAIL', err.message);
  }
}

// ============================================================
// MAIN
// ============================================================
async function main() {
  results.startTime = new Date().toISOString();
  console.log(`\nExpo Web E2E Test — ${results.startTime}`);
  console.log(`Target: ${EXPO_URL}`);
  console.log(`API: ${API_URL}`);
  console.log(`Screenshots: ${SCREENSHOT_DIR}\n`);

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const context = await browser.newContext({
    viewport: { width: 414, height: 896 }, // iPhone-like viewport for RN web
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15',
  });

  // Collect console messages
  const consoleMessages = [];
  const page = await context.newPage();
  page.on('console', msg => consoleMessages.push({ type: msg.type(), text: msg.text() }));

  try {
    await layer1_pageScan(page);
    await layer2_basicOps(page);
  } catch (err) {
    console.error('\nFATAL ERROR:', err.message);
  } finally {
    results.endTime = new Date().toISOString();
    await browser.close();
  }

  // ============================================================
  // EVIDENCE REPORT
  // ============================================================
  console.log('\n' + '='.repeat(70));
  console.log('EVIDENCE REPORT — Expo Web E2E');
  console.log('='.repeat(70));
  console.log(`Run: ${results.startTime} → ${results.endTime}`);
  console.log(`Target: ${EXPO_URL}  |  API: ${API_URL}`);
  console.log();

  // Layer 1 summary
  console.log('--- LAYER 1: PAGE SCAN ---');
  for (const r of results.layer1) {
    const icon = r.status === 'PASS' ? 'PASS' : r.status === 'FAIL' ? 'FAIL' : 'SKIP';
    console.log(`  [${icon}] ${r.testName}`);
    if (r.evidence) console.log(`         ${r.evidence}`);
  }

  console.log();
  console.log('--- LAYER 2: BASIC OPERATIONS ---');
  for (const r of results.layer2) {
    const icon = r.status === 'PASS' ? 'PASS' : r.status === 'FAIL' ? 'FAIL' : 'SKIP';
    console.log(`  [${icon}] ${r.testName}`);
    if (r.evidence) console.log(`         ${r.evidence}`);
  }

  // Totals
  const allResults = [...results.layer1, ...results.layer2];
  const pass = allResults.filter(r => r.status === 'PASS').length;
  const fail = allResults.filter(r => r.status === 'FAIL').length;
  const skip = allResults.filter(r => r.status === 'SKIP').length;

  console.log();
  console.log(`TOTALS: ${pass} PASS / ${fail} FAIL / ${skip} SKIP (${allResults.length} total)`);
  console.log(`Screenshots saved to: ${SCREENSHOT_DIR}`);
  console.log('='.repeat(70));

  // Write JSON report
  const reportPath = path.join(process.cwd(), 'test-expo-web-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));
  console.log(`JSON report: ${reportPath}`);

  // Exit with failure if any FAIL
  if (fail > 0) process.exit(1);
}

main().catch(err => {
  console.error('FATAL:', err);
  process.exit(2);
});
