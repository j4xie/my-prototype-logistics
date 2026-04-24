// Browser-level Rule 8 四位一体 verify — use DELETE user flow which has
// no client-side form validation to block the API call.
// Expected: click 删除 → confirm → DELETE /users/{id} → 400 "模块 hr_employee 未启用"
// → ElNotification sticky with actionHint.
import { chromium } from 'playwright';
import fs from 'fs';

const BASE = process.env.TARGET_URL || 'http://139.196.165.140:8097';
const OUT = 'tests/e2e-comprehensive/results/qa-browser-toast-delete';
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

await login(page, 'restaurant_admin1', '123456');

// Capture network responses
const responses = [];
page.on('response', async (resp) => {
  if (resp.url().includes('/users/') && resp.request().method() === 'DELETE') {
    const body = await resp.text().catch(() => '');
    responses.push({ url: resp.url(), status: resp.status(), body: body.slice(0, 300) });
  }
});

// Install MutationObserver
await page.goto(`${BASE}/system/users`, { waitUntil: 'networkidle', timeout: 30000 });
await page.waitForTimeout(3000);

await page.evaluate(() => {
  window.__toastLog = [];
  window.__observer = new MutationObserver(muts => muts.forEach(m => m.addedNodes.forEach(n => {
    if (n.nodeType !== 1) return;
    const cls = typeof n.className === 'string' ? n.className : '';
    if (cls.includes('el-message') || cls.includes('el-notification')) {
      window.__toastLog.push({
        time: Date.now(), cls,
        text: (n.textContent || '').trim(),
        isClosable: cls.includes('is-closable'),
        hasCloseBtn: !!n.querySelector('.el-notification__closeBtn') || !!n.querySelector('.el-message__closeBtn'),
      });
    }
  })));
  window.__observer.observe(document.body, { childList: true, subtree: true });
});

// Click delete on any visible user row's 删除 button
const deleteBtn = page.locator('.el-table__row button:has-text("删除")').first();
const hasDelete = await deleteBtn.count() > 0;
if (hasDelete) {
  await deleteBtn.click({ timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(1500);

  // Confirm dialog — ElMessageBox has 确定 button
  await page.locator('.el-message-box button:has-text("确定"), .el-popconfirm button:has-text("确定")').first().click({ timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(5000);
}

// Read toasts
const toastLog = await page.evaluate(() => window.__toastLog || []);
const canvasToast = toastLog.find(t => t.text.includes('模块') && t.text.includes('hr_employee'));

// Wait 5s more, check if still visible (sticky)
await page.waitForTimeout(5000);
const stillVisible = await page.evaluate(() => {
  const els = document.querySelectorAll('.el-message, .el-notification');
  for (const el of els) {
    if ((el.textContent || '').includes('hr_employee')) return true;
  }
  return false;
});

await page.screenshot({ path: `${OUT}/delete-canvas-block.png`, fullPage: false });

const result = {
  hasDeleteButton: hasDelete,
  networkResponses: responses,
  toasts: toastLog.map(t => ({ text: t.text.slice(0, 150), closable: t.isClosable || t.hasCloseBtn })),
  canvasToast: canvasToast ? {
    text: canvasToast.text.slice(0, 200),
    isClosable: canvasToast.isClosable,
    hasCloseBtn: canvasToast.hasCloseBtn,
  } : null,
  stickyAfter5s: stillVisible,
  pass: !!canvasToast && (canvasToast.isClosable || canvasToast.hasCloseBtn) && stillVisible,
};

console.log('\n========== Rule 8 四位一体 via DELETE flow ==========');
console.log('has delete button:', hasDelete);
console.log('network DELETE /users responses:', responses.length);
for (const r of responses) console.log(`  ${r.status} ${r.url.split('/').slice(-3).join('/')}`);
console.log('total toasts:', toastLog.length);
for (const t of toastLog) console.log(`  - [${t.isClosable || t.hasCloseBtn ? 'sticky' : 'auto'}] ${t.text.slice(0, 120)}`);
console.log('Canvas toast found:', !!canvasToast);
if (canvasToast) console.log('  sticky after 5s:', stillVisible);

await browser.close();
fs.writeFileSync(`${OUT}/results.json`, JSON.stringify(result, null, 2));
console.log(`\n${result.pass ? '✅ PASS' : '❌ FAIL'}`);
