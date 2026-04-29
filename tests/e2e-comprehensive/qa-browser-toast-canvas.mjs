// Rule 8 四位一体 browser-level verification for Canvas module block.
// Per qa-prompt v2.4: must use MutationObserver (not querySelectorAll) because
// 3s fade causes race conditions. Verifies: toast text matches backend message,
// sticky (not fading), has close button, showClose applied.
import { chromium } from 'playwright';
import fs from 'fs';

const BASE = process.env.TARGET_URL || 'http://139.196.165.140:8097';
const OUT = 'tests/e2e-comprehensive/results/qa-browser-toast-canvas';
fs.mkdirSync(OUT, { recursive: true });

async function login(page, username, password) {
  for (let i = 0; i < 5; i++) {
    try {
      await page.goto(`${BASE}/login`, { waitUntil: 'networkidle', timeout: 30000 });
      await page.waitForSelector('input', { timeout: 10000 });
      const inputs = await page.locator('input').all();
      let u, p;
      for (const inp of inputs) {
        const t = await inp.getAttribute('type');
        if (t === 'password' && !p) p = inp;
        else if (!u && (t === 'text' || !t)) u = inp;
      }
      await u.fill(username); await p.fill(password); await p.press('Enter');
      await page.waitForTimeout(7000);
      if (!page.url().includes('/login')) return;
    } catch {}
    if (i < 4) await page.waitForTimeout(5000);
  }
  throw new Error(`login failed: ${username}`);
}

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 }, ignoreHTTPSErrors: true });
const page = await ctx.newPage();

const results = { base: BASE, ts: new Date().toISOString(), cases: [] };

// Login as restaurant_admin1 (F002, has hr_employee disabled).
// Then navigate to /system/users and try to create a user.
// Expected: sticky red toast "模块 hr_employee 未启用" with close button.

await login(page, 'restaurant_admin1', '123456');

// Install MutationObserver BEFORE any action (qa-prompt Rule 7)
await page.evaluate(() => {
  window.__toastLog = [];
  const observer = new MutationObserver(muts => muts.forEach(m => m.addedNodes.forEach(n => {
    if (n.nodeType !== 1) return;
    const cls = typeof n.className === 'string' ? n.className : '';
    if (cls.includes('el-message') || cls.includes('el-notification')) {
      window.__toastLog.push({
        time: Date.now(),
        cls,
        text: (n.textContent || '').trim(),
        isClosable: cls.includes('is-closable'),
        hasCloseBtn: !!n.querySelector('.el-notification__closeBtn') ||
                     !!n.querySelector('.el-message__closeBtn'),
      });
    }
  })));
  observer.observe(document.body, { childList: true, subtree: true });
  window.__observer = observer;
});

// Navigate to /system/users
await page.goto(`${BASE}/system/users`, { waitUntil: 'networkidle', timeout: 30000 });
await page.waitForTimeout(3000);

// Capture current URL - if redirected to 403/login, that's the result
const urlAfterNav = page.url();
const hasUsers = urlAfterNav.includes('/system/users');

// Try to click "新增" button (create user) — this triggers a dialog
const createBtnCount = await page.locator('button:has-text("新增"), button:has-text("新建"), button:has-text("添加")').count();
let toastsSeen = 0;

if (createBtnCount > 0 && hasUsers) {
  await page.locator('button:has-text("新增"), button:has-text("新建"), button:has-text("添加")').first().click({ timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(2000);

  // Fill form fields — scope to DIALOG only (not the filter at top of page)
  const uname = 'qa_canvas_' + Date.now();
  const dialog = page.locator('.el-dialog').first();
  await dialog.locator('input[placeholder*="请输入用户名"]').fill(uname).catch(() => {});
  await dialog.locator('input[type="password"], input[placeholder*="请输入密码"]').first().fill('qa12345').catch(() => {});
  await dialog.locator('input[placeholder*="邮箱"]').fill(uname + '@test.com').catch(() => {});
  await dialog.locator('input[placeholder*="真实姓名"]').fill('QATest').catch(() => {});
  await dialog.locator('input[placeholder*="手机号"]').fill('13800099999').catch(() => {});

  // Role dropdown in dialog
  try {
    await dialog.locator('.el-select').first().click({ timeout: 3000 });
    await page.waitForTimeout(1000);
    await page.locator('.el-select-dropdown__item').first().click({ timeout: 3000 });
    await page.waitForTimeout(500);
  } catch { /* role field may not exist or be different */ }

  // Click submit in dialog
  await dialog.locator('button:has-text("确认创建"), button:has-text("确定"), button:has-text("保存")').first().click({ timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(5000);

  toastsSeen = await page.evaluate(() => window.__toastLog?.length || 0);
}

const toastLog = await page.evaluate(() => window.__toastLog || []);
const canvasToast = toastLog.find(t => t.text.includes('模块') && t.text.includes('hr_employee'));

// Also capture full toast log for diagnostic
const allToasts = toastLog.map(t => ({
  text: t.text.slice(0, 100),
  isClosable: t.isClosable,
  hasCloseBtn: t.hasCloseBtn,
  cls: t.cls.slice(0, 80),
}));

// Wait 5s and check if toast is still in DOM (sticky check)
await page.waitForTimeout(5000);
const stillVisible = canvasToast ? await page.evaluate((text) => {
  const els = document.querySelectorAll('.el-message, .el-notification');
  for (const el of els) {
    if ((el.textContent || '').includes(text.slice(0, 30))) return true;
  }
  return false;
}, canvasToast.text) : false;

await page.screenshot({ path: `${OUT}/canvas-block-toast.png`, fullPage: false });

results.cases.push({
  case: 'F002 restaurant_admin1 create user → Canvas block sticky toast',
  urlAfterNav,
  createBtnFound: createBtnCount > 0,
  toastsSeen,
  canvasToastFound: !!canvasToast,
  canvasToastText: canvasToast?.text?.slice(0, 120),
  isClosable: canvasToast?.isClosable,
  hasCloseBtn: canvasToast?.hasCloseBtn,
  stillVisibleAfter5s: stillVisible,
  allToasts,
  pass: !!canvasToast && (canvasToast.isClosable || canvasToast.hasCloseBtn) && stillVisible,
});

console.log('\n========== Rule 8 四位一体 ==========');
console.log(`  navigation: ${urlAfterNav}`);
console.log(`  create button found: ${createBtnCount > 0}`);
console.log(`  toasts seen: ${toastsSeen}`);
console.log(`  Canvas block toast: ${canvasToast ? '✅' : '❌'}`);
if (canvasToast) {
  console.log(`    text: ${canvasToast.text.slice(0, 100)}`);
  console.log(`    closable: ${canvasToast.isClosable || canvasToast.hasCloseBtn}`);
  console.log(`    sticky (5s+): ${stillVisible ? '✅' : '❌'}`);
}
console.log(`  all toasts: ${allToasts.length}`);
for (const t of allToasts) console.log(`    - [${t.isClosable ? 'closable' : 'auto'}] ${t.text.slice(0, 80)}`);

await browser.close();
fs.writeFileSync(`${OUT}/results.json`, JSON.stringify(results, null, 2));
const pass = results.cases.filter(c => c.pass).length;
console.log(`\n${pass}/${results.cases.length} passed`);
