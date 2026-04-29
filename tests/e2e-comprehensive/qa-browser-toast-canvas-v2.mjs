// Rule 8 四位一体 browser-level verification — simplified approach.
// Use page.evaluate to trigger axios-wrapped POST /users and observe the
// request.ts::showRichError pipeline rendering ElNotification.
import { chromium } from 'playwright';
import fs from 'fs';

const BASE = process.env.TARGET_URL || 'http://139.196.165.140:8097';
const OUT = 'tests/e2e-comprehensive/results/qa-browser-toast-canvas-v2';
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

await login(page, 'restaurant_admin1', '123456');

// Navigate to any app page so axios is loaded
await page.goto(`${BASE}/system/users`, { waitUntil: 'networkidle', timeout: 30000 });
await page.waitForTimeout(3000);

// Install MutationObserver BEFORE triggering the API
await page.evaluate(() => {
  window.__toastLog = [];
  window.__observer = new MutationObserver(muts => muts.forEach(m => m.addedNodes.forEach(n => {
    if (n.nodeType !== 1) return;
    const cls = typeof n.className === 'string' ? n.className : '';
    if (cls.includes('el-message') || cls.includes('el-notification')) {
      window.__toastLog.push({
        time: Date.now(),
        cls,
        text: (n.textContent || '').trim(),
        isClosable: cls.includes('is-closable'),
        hasCloseBtn: !!n.querySelector('.el-notification__closeBtn') || !!n.querySelector('.el-message__closeBtn'),
        fullHtml: (n.outerHTML || '').slice(0, 300),
      });
    }
  })));
  window.__observer.observe(document.body, { childList: true, subtree: true });
});

// Trigger the POST via the app's own axios instance so request.ts interceptor fires
// We use fetch with the same cretas_access_token, and simulate how the app code calls it
const triggerResult = await page.evaluate(async () => {
  const token = localStorage.getItem('cretas_access_token') || '';
  try {
    // Find factoryId from pinia store (best-effort — fallback to F002)
    let factoryId = 'F002';
    try {
      const authStore = JSON.parse(localStorage.getItem('cretas_auth_store') || '{}');
      if (authStore.factoryId) factoryId = authStore.factoryId;
    } catch {}

    const resp = await fetch(`/api/mobile/${factoryId}/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': token ? `Bearer ${token}` : '',
      },
      body: JSON.stringify({
        username: 'qa_canvas_v2_' + Date.now(),
        password: 'qa12345',
        realName: 'QA Canvas',
        phone: '13800099999',
        roleCode: 'viewer',
        email: 'qa@test.com',
      }),
    });
    const body = await resp.json().catch(() => ({}));
    return { status: resp.status, body, factoryId };
  } catch (e) {
    return { error: e.message };
  }
});

console.log('Direct API call:', triggerResult);

// Wait for any toasts to render
await page.waitForTimeout(4000);

let toastLog = await page.evaluate(() => window.__toastLog || []);
console.log(`Direct fetch toasts: ${toastLog.length}`);

// The fetch above bypasses axios interceptor, so no toast will render from our fetch.
// Let's properly invoke the app's axios instance. Look for the api/request.ts module.
// If exposed as window.__app_request (usually not), use it. Otherwise we have to
// trigger via UI click.
//
// Alternative: use the existing form in /system/users. Click 新增 button, fill, submit.

await page.evaluate(() => { window.__toastLog = []; });  // reset

const clickedCreate = await page.locator('button:has-text("新增用户"), button:has-text("新增"), button:has-text("添加用户")').first().click({ timeout: 5000 }).then(() => true).catch(() => false);
await page.waitForTimeout(2000);

if (clickedCreate) {
  const dialog = page.locator('.el-dialog').first();
  await dialog.locator('input').nth(0).fill('qa_canvas_v2_' + Date.now()).catch(() => {});
  // Fill sequential visible inputs
  const inputs = await dialog.locator('input:not([type="hidden"])').all();
  const dfaults = ['', 'qa12345', 'qa@test.com', 'QA', '13800099999'];
  let idx = 0;
  for (const inp of inputs) {
    const type = await inp.getAttribute('type').catch(() => 'text');
    const placeholder = (await inp.getAttribute('placeholder').catch(() => '')) || '';
    if (type === 'hidden' || placeholder.includes('搜索')) continue;
    if (idx === 0) { await inp.fill('qa_canvas_v2_' + Date.now()).catch(() => {}); }
    else if (idx < dfaults.length) { await inp.fill(dfaults[idx]).catch(() => {}); }
    idx++;
  }

  // Role dropdown
  try {
    await dialog.locator('.el-select').first().click({ timeout: 3000 });
    await page.waitForTimeout(800);
    const opts = await page.locator('.el-select-dropdown__item:visible').all();
    if (opts.length > 0) await opts[0].click({ timeout: 3000 });
    await page.waitForTimeout(500);
  } catch {}

  // Submit
  await dialog.locator('.el-dialog__footer button').last().click({ timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(6000);

  toastLog = await page.evaluate(() => window.__toastLog || []);
}

// Also check 5s later for sticky
await page.waitForTimeout(3000);
const toastsStillVisible = await page.evaluate(() => {
  const els = document.querySelectorAll('.el-message, .el-notification');
  return Array.from(els).map(e => ({
    text: (e.textContent || '').slice(0, 120),
    cls: e.className,
  }));
});

await page.screenshot({ path: `${OUT}/canvas-toast-v2.png`, fullPage: false });

const canvasToast = toastLog.find(t => t.text.includes('模块') && (t.text.includes('hr_employee') || t.text.includes('未启用')));

results.cases.push({
  case: 'F002 create user → Canvas block ElNotification',
  directApiCall: triggerResult,
  uiClickedCreate: clickedCreate,
  totalToasts: toastLog.length,
  canvasToastFound: !!canvasToast,
  canvasToastDetails: canvasToast,
  toastsStillVisibleAfter7s: toastsStillVisible.length,
  stickyCheck: toastsStillVisible,
  allToasts: toastLog.map(t => ({ text: t.text.slice(0, 120), cls: t.cls, closable: t.isClosable || t.hasCloseBtn })),
  pass: !!canvasToast && (canvasToast.isClosable || canvasToast.hasCloseBtn || canvasToast.fullHtml.includes('close')),
});

console.log('\n========== Rule 8 Browser Toast Verification ==========');
console.log(`Direct fetch 400: ${triggerResult.status} · message: ${triggerResult.body?.message}`);
console.log(`UI flow clicked create: ${clickedCreate}`);
console.log(`Total toasts captured: ${toastLog.length}`);
for (const t of toastLog) {
  console.log(`  - [${t.isClosable || t.hasCloseBtn ? 'closable' : 'auto'}] ${t.text.slice(0, 120)}`);
}
console.log(`After 7s, ${toastsStillVisible.length} toasts still in DOM`);

await browser.close();
fs.writeFileSync(`${OUT}/results.json`, JSON.stringify(results, null, 2));
const pass = results.cases.filter(c => c.pass).length;
console.log(`\n${pass}/${results.cases.length} passed`);
