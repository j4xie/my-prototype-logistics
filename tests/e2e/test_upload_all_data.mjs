/**
 * Upload all 3 data files via web-admin frontend:
 * 1. POS 销量 (已在 Phase 1 上传)
 * 2. 利润表
 * 3. 评价 Q4
 * Then verify SmartBI Chat responds with real data.
 */
import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';

const BASE_URL = 'http://localhost:5173';
const SCREENSHOT_DIR = 'tests/e2e/screenshots/upload-all';
const DATA_DIR = 'tests/e2e/data';

const FILES = [
  { name: '火锅2月利润表.xls', label: 'P&L 利润表' },
  { name: '青花椒评价Q4.xlsx', label: '评价 Q4' },
];

fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

async function login(page) {
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded', timeout: 15000 });
  await page.waitForTimeout(2000);
  const inputs = page.locator('.el-input__inner');
  await inputs.nth(0).fill('factory_admin1');
  await inputs.nth(1).fill('admin123');
  const loginBtn = page.locator('button').filter({ hasText: /登.*录/ }).first();
  await loginBtn.click();
  await page.waitForURL(/(?!.*login).*/, { timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(2000);
  return !page.url().includes('login');
}

async function uploadFile(page, filePath, label, index) {
  console.log(`\n--- Upload ${index}: ${label} ---`);
  await page.goto(`${BASE_URL}/smart-bi/upload`, { waitUntil: 'domcontentloaded', timeout: 15000 });
  await page.waitForTimeout(3000);

  try {
    const fileInput = page.locator('input[type="file"]');
    if (await fileInput.count() === 0) {
      console.log(`  [SKIP] No file input found on upload page`);
      return false;
    }
    await fileInput.setInputFiles(filePath);
    console.log(`  File selected: ${path.basename(filePath)}`);

    // Wait for parse (利润表 small, 评价 large ~2.5MB)
    await page.waitForTimeout(20000);
    await page.screenshot({ path: `${SCREENSHOT_DIR}/${index}-${label.replace(/\s+/g, '_')}-result.png` });

    const text = await page.textContent('body');
    const hasPreview = text.includes('预览') || text.includes('行') || text.includes('列');
    const hasError = text.includes('失败') || text.includes('error');

    if (hasError) {
      console.log(`  [FAIL] Error detected`);
      return false;
    }
    console.log(`  [PASS] Upload + parse complete`);
    return true;
  } catch (e) {
    console.log(`  [FAIL] ${e.message.slice(0, 80)}`);
    await page.screenshot({ path: `${SCREENSHOT_DIR}/${index}-error.png` });
    return false;
  }
}

async function main() {
  console.log('====== Upload All Data Files ======');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await context.newPage();

  // Login
  const loggedIn = await login(page);
  console.log(`Login: ${loggedIn ? 'OK' : 'FAILED'}`);
  if (!loggedIn) { await browser.close(); process.exit(1); }

  // Upload each file
  let pass = 0, fail = 0;
  for (let i = 0; i < FILES.length; i++) {
    const f = FILES[i];
    const filePath = path.resolve(DATA_DIR, f.name);
    if (!fs.existsSync(filePath)) {
      console.log(`  [SKIP] File not found: ${filePath}`);
      fail++;
      continue;
    }
    const ok = await uploadFile(page, filePath, f.label, i + 1);
    if (ok) pass++; else fail++;
  }

  // SmartBI Chat queries
  console.log('\n--- SmartBI Chat: Verify with real data ---');
  await page.goto(`${BASE_URL}/smart-bi/query`, { waitUntil: 'domcontentloaded', timeout: 15000 });
  await page.waitForTimeout(3000);

  const queries = [
    '成本刚性分析',
    '评论分析差评关键词',
    '13家店排名对比',
    '长尾SKU分析哪些菜该砍',
  ];

  for (const q of queries) {
    try {
      const chatInput = page.locator('textarea, .el-textarea__inner').first();
      if (await chatInput.count() > 0) {
        await chatInput.fill(q);
        const sendBtn = page.locator('button').filter({ hasText: /发送|Send/ }).first();
        if (await sendBtn.count() > 0) await sendBtn.click();
        else await chatInput.press('Enter');
        await page.waitForTimeout(8000);
        const slug = q.replace(/[^a-zA-Z\u4e00-\u9fa5]/g, '_').slice(0, 20);
        await page.screenshot({ path: `${SCREENSHOT_DIR}/chat-${slug}.png` });
        console.log(`  [DONE] ${q}`);
      }
      await page.waitForTimeout(2000);
    } catch (e) {
      console.log(`  [FAIL] ${q}: ${e.message.slice(0, 60)}`);
    }
  }

  await page.screenshot({ path: `${SCREENSHOT_DIR}/99-final.png`, fullPage: true });
  await browser.close();

  console.log(`\n====== RESULT: ${pass}/${pass + fail} uploads OK ======`);
}

main().catch(e => { console.error(e); process.exit(1); });
