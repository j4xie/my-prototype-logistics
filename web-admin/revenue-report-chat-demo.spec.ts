/**
 * Playwright AI Chat UX demo — type natural language into AI 问答 page
 * (/smart-bi/query). With AIQuery.vue unification, this routes through
 * Java AIIntentService → Tool → returns download_url; bubble renders a
 * blue "下载 Excel" button the user clicks.
 */
import { test, expect } from '@playwright/test';
import { fetchLoginToken, injectAuthCookie } from './e2e-auth-helper';

const BASE_URL = process.env.E2E_BASE_URL || 'http://139.196.165.140:8097';
const API_BASE = process.env.E2E_API_BASE || `${BASE_URL}/api/mobile`;
const USER = process.env.E2E_USER || 'qhj_admin';
const PASS = process.env.E2E_PASS || 'QhjAdmin@2026';

const SD = 'test-results/qhj-chat-demo';
const STEP_PAUSE = 6_000;
const FINAL_HOLD = 240_000;

test.setTimeout(420_000);

test('AI 问答 — natural language → 下载 Excel button', async ({ page, context }) => {
  const fs = await import('node:fs');
  fs.mkdirSync(SD, { recursive: true });

  const banner = async (msg: string) => {
    console.log(`\n>>> ${msg}`);
    await page.evaluate((text) => {
      const id = 'demo-banner';
      let el = document.getElementById(id);
      if (!el) {
        el = document.createElement('div');
        el.id = id;
        el.style.cssText =
          'position:fixed;top:0;left:0;right:0;z-index:99999;background:#2563eb;color:white;' +
          'padding:14px 24px;font-size:18px;font-weight:600;text-align:center;box-shadow:0 2px 8px rgba(0,0,0,0.3);';
        document.body.appendChild(el);
      }
      el.textContent = text;
    }, msg).catch(() => undefined);
  };

  const auth = await fetchLoginToken(USER, PASS, API_BASE);
  expect(auth.token).toBeTruthy();
  await injectAuthCookie(context, page, auth.token, auth.loginData, BASE_URL);
  await page.evaluate((tok) => localStorage.setItem('cretas_access_token', tok), auth.token);

  await page.goto(`${BASE_URL}/smart-bi/query`, {
    waitUntil: 'networkidle',
    timeout: 30_000,
  });
  await banner('Step 1/4 — AI 问答 加载. 看 6 秒...');
  await page.screenshot({ path: `${SD}/01-page.png`, fullPage: true });
  await page.waitForTimeout(STEP_PAUSE);

  const chatInput = page.locator('.el-input__inner, textarea.el-textarea__inner')
    .filter({ hasNot: page.locator('[disabled]') })
    .last();
  const sendBtn = page.locator('button:has-text("发送"), button:has-text("发 送")').first();

  // Test 1: bare "收入管理报表"
  await banner('Step 2/4 — "收入管理报表" — 看下面气泡里 出 "下载 Excel" 按钮');
  await page.waitForTimeout(2000);
  await chatInput.click();
  await chatInput.fill('收入管理报表');
  await page.waitForTimeout(500);
  await (await sendBtn.count() > 0 ? sendBtn.click() : chatInput.press('Enter'));
  await page.waitForTimeout(15_000);
  await page.screenshot({ path: `${SD}/02-response-1.png`, fullPage: true });
  await page.waitForTimeout(STEP_PAUSE);

  // Test 2: "生成 2025-03 收入管理报表"
  await banner('Step 3/4 — "生成 2025-03 收入管理报表" — 检查是否仍出按钮');
  await page.waitForTimeout(2000);
  await chatInput.click();
  await chatInput.fill('生成 2025-03 收入管理报表');
  await page.waitForTimeout(500);
  await (await sendBtn.count() > 0 ? sendBtn.click() : chatInput.press('Enter'));
  await page.waitForTimeout(15_000);
  await page.screenshot({ path: `${SD}/03-response-2.png`, fullPage: true });
  await page.waitForTimeout(STEP_PAUSE);

  // Test 3: "上月收入管理报表"
  await banner('Step 4/4 — "上月收入管理报表"');
  await page.waitForTimeout(2000);
  await chatInput.click();
  await chatInput.fill('上月收入管理报表');
  await page.waitForTimeout(500);
  await (await sendBtn.count() > 0 ? sendBtn.click() : chatInput.press('Enter'));
  await page.waitForTimeout(15_000);
  await page.screenshot({ path: `${SD}/04-response-3.png`, fullPage: true });
  await page.waitForTimeout(STEP_PAUSE);

  await banner('✅ Demo 完成 — 自由探索 4 分钟. 点 "下载 Excel" 按钮试一下下载. ');
  await page.waitForTimeout(FINAL_HOLD).catch(() => undefined);
});
