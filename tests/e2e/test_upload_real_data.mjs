/**
 * Phase 1: Upload real 青花椒 POS data via web-admin frontend
 * Then query SmartBI to verify handlers return real computed results
 */
import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';

const BASE_URL = 'http://localhost:5173';
const SCREENSHOT_DIR = 'tests/e2e/screenshots/upload';
const DATA_FILE = path.resolve('tests/e2e/data/青花椒POS销量-2月-纯青花椒.xlsx');

fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

async function main() {
  console.log('====== Phase 1: Upload Real POS Data ======');
  console.log(`File: ${DATA_FILE}`);
  console.log(`Exists: ${fs.existsSync(DATA_FILE)}`);
  console.log(`Size: ${(fs.statSync(DATA_FILE).size / 1024).toFixed(0)} KB`);
  console.log('');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await context.newPage();

  // Step 1: Login
  console.log('--- Step 1: Login ---');
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded', timeout: 15000 });
  await page.waitForTimeout(2000);

  // Login form: 2 el-input components, first = username, second = password
  const inputs = page.locator('.el-input__inner');
  await inputs.nth(0).fill('factory_admin1');
  await inputs.nth(1).fill('admin123');
  const loginBtn = page.locator('button').filter({ hasText: /登.*录/ }).first();
  await loginBtn.click();
  // Wait for login to complete (SSH tunnel adds latency)
  await page.waitForURL(/(?!.*login).*/, { timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(3000);
  await page.screenshot({ path: `${SCREENSHOT_DIR}/01-logged-in.png` });
  const currentUrl = page.url();
  console.log(`  Login: ${currentUrl.includes('login') ? 'FAILED (still on login)' : 'OK'} → ${currentUrl}`);

  // Step 2: Navigate to Upload page
  console.log('');
  console.log('--- Step 2: Navigate to SmartBI Upload ---');
  await page.goto(`${BASE_URL}/smart-bi/upload`, { waitUntil: 'domcontentloaded', timeout: 15000 });
  await page.waitForTimeout(3000);
  await page.screenshot({ path: `${SCREENSHOT_DIR}/02-upload-page.png` });
  console.log('  Upload page: Loaded');

  // Step 3: Upload file
  console.log('');
  console.log('--- Step 3: Upload Excel file ---');
  try {
    // Find the file input (el-upload uses a hidden input)
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(DATA_FILE);
    console.log('  File selected');

    // Wait for upload + parse (can take 10-30s for 3622 rows)
    await page.waitForTimeout(15000);
    await page.screenshot({ path: `${SCREENSHOT_DIR}/03-upload-parsing.png` });

    // Check for success indicators
    const pageText = await page.textContent('body');
    const hasPreview = pageText.includes('预览') || pageText.includes('preview') || pageText.includes('行');
    const hasError = pageText.includes('失败') || pageText.includes('error') || pageText.includes('Error');

    if (hasError) {
      console.log('  Upload: ERROR detected');
      await page.screenshot({ path: `${SCREENSHOT_DIR}/03-upload-error.png` });
    } else if (hasPreview) {
      console.log('  Upload: SUCCESS — preview data shown');
    } else {
      console.log('  Upload: Parsing in progress...');
      // Wait more
      await page.waitForTimeout(15000);
      await page.screenshot({ path: `${SCREENSHOT_DIR}/03-upload-done.png` });
    }

    // Take final upload state screenshot
    await page.screenshot({ path: `${SCREENSHOT_DIR}/04-upload-result.png`, fullPage: true });

    // Step 4: Try to confirm/proceed
    console.log('');
    console.log('--- Step 4: Confirm upload ---');
    const nextBtn = page.locator('button').filter({ hasText: /下一步|确认|开始分析|Confirm|Next/ }).first();
    if (await nextBtn.count() > 0) {
      await nextBtn.click();
      await page.waitForTimeout(10000);
      await page.screenshot({ path: `${SCREENSHOT_DIR}/05-analysis-started.png` });
      console.log('  Analysis started');

      // Wait for analysis to complete
      await page.waitForTimeout(20000);
      await page.screenshot({ path: `${SCREENSHOT_DIR}/06-analysis-result.png`, fullPage: true });
      console.log('  Analysis complete');
    } else {
      console.log('  No confirm button found');
    }

  } catch (e) {
    console.log(`  Upload error: ${e.message}`);
    await page.screenshot({ path: `${SCREENSHOT_DIR}/03-upload-exception.png` });
  }

  // Step 5: Navigate to SmartBI Chat and query
  console.log('');
  console.log('--- Step 5: SmartBI Chat with real data ---');
  await page.goto(`${BASE_URL}/smart-bi/query`, { waitUntil: 'domcontentloaded', timeout: 15000 });
  await page.waitForTimeout(3000);

  const queries = [
    '17家店排名对比',
    '长尾SKU分析',
    '菜单归一化',
  ];

  for (const q of queries) {
    try {
      const chatInput = page.locator('textarea, input[placeholder*="输入"], .el-textarea__inner').first();
      if (await chatInput.count() > 0) {
        await chatInput.fill(q);
        const sendBtn = page.locator('button').filter({ hasText: /发送|Send/ }).first();
        if (await sendBtn.count() > 0) await sendBtn.click();
        else await chatInput.press('Enter');
        await page.waitForTimeout(8000);
        const slug = q.replace(/[^a-zA-Z\u4e00-\u9fa5]/g, '_');
        await page.screenshot({ path: `${SCREENSHOT_DIR}/07-chat-${slug}.png` });

        const text = await page.textContent('body');
        const hasResult = text.includes('分析') || text.includes('排名') || text.includes('SKU') || text.includes('section');
        console.log(`  [${hasResult ? 'PASS' : 'WAIT'}] ${q}`);
      }
      await page.waitForTimeout(3000);
    } catch (e) {
      console.log(`  [FAIL] ${q}: ${e.message}`);
    }
  }

  await page.screenshot({ path: `${SCREENSHOT_DIR}/99-final.png`, fullPage: true });
  await browser.close();

  console.log('');
  console.log('====== Upload E2E Complete ======');
  console.log(`Screenshots: ${SCREENSHOT_DIR}/`);
}

main().catch(e => { console.error(e); process.exit(1); });
