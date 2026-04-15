/**
 * R19 action-level probes — reproduce 10 bugs from 2026-04-15 customer report
 *
 * Why R19?  R18 did page-LOAD smoke probes only — all 10 bugs below showed
 * NOT_REPRO because they trigger on button-click / form-submit, not on page load.
 * This round drives the specific user action for each bug and classifies
 * the observed outcome (REPRO / NOT_REPRO / WARN / TIMEOUT / FAIL).
 *
 * Target bugs (10):
 *   #5   /sales/shipments             → click "新建出货" → 无反应
 *   #6   /system/roles                → click "查看权限" on first row → 404
 *   #7   /system/workflow-designer    → drag/new/save → 404
 *   #8   /system/features             → click 初始化默认配置 (sync) → 同步失败
 *   #2   /smart-bi/financial-dashboard → wait for dashboard load → canceled
 *   #3   /smart-bi/upload             → upload fixture → 数据处理失败
 *   #12  /smart-bi/finance            → trigger 演示数据 button → 无法生成
 *   #14  /smart-bi/query              → submit AI query → 超时 (>30s)
 *   #15  /smart-bi/query-templates    → click 一键执行 → loading 无法显示
 *   #9   /analytics/alert-dashboard   → click 解决/确定 → 缺少必要参数
 *
 * Classification:
 *   REPRO     — observed the reported symptom (button no-op / 404 / toast-error /
 *                timeout / missing-param / canceled request)
 *   NOT_REPRO — performed the action, the feature worked (success toast / data shown)
 *   WARN      — ambiguous (partial response, could not find target button)
 *   TIMEOUT   — operation exceeded expected ceiling (mostly for bug #14)
 *   FAIL      — script-level error (navigation failure, auth expired, etc.)
 */
import { chromium } from 'playwright';
import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'fs';
import path from 'path';
import { BASE, PASSWORD } from './lib/helpers.mjs';
import { setupAuthOnce, newContextWithAuth } from './lib/auth-cache.mjs';

const SETUP_FILE = 'tests/e2e-comprehensive/results/R0-setup.json';
const setup = existsSync(SETUP_FILE) ? JSON.parse(readFileSync(SETUP_FILE, 'utf8')) : null;
const FACTORY_ID = setup?.factoryId || 'FOOD_3101_048';
const ROUND = 19;
const results = [];

function record(testId, probe, module, status, evidence = {}) {
  const r = { layer: 'L4', testId, probe, module, status, depth: 'action', evidence, ts: new Date().toISOString() };
  results.push(r);
  const icon = status === 'REPRO' ? '🐛' : status === 'NOT_REPRO' ? '✓' : status === 'WARN' ? '⚠' : status === 'TIMEOUT' ? '⏱' : '✗';
  console.log(`  [${icon}] ${module}/${probe}: ${status}`);
  for (const [k, v] of Object.entries(evidence)) {
    if (v !== undefined) {
      const s = typeof v === 'string' ? v : JSON.stringify(v);
      console.log(`      ${k}: ${s.substring(0, 300)}`);
    }
  }
}

/**
 * Helper: collect network 4xx/5xx + console errors + toast messages while a
 * user action runs. Returns a harness object with start() / stop() / snapshot().
 */
function attachObservers(page) {
  const networkErrors = [];
  const networkAll = []; // all responses during the action window
  const consoleErrors = [];
  const toasts = [];

  const onResponse = (r) => {
    const status = r.status();
    const urlShort = r.url().replace(BASE, '').replace('http://139.196.165.140:8086', '');
    networkAll.push({ url: urlShort, status, method: r.request().method() });
    if (status >= 400) {
      networkErrors.push({ url: urlShort, status, method: r.request().method() });
    }
  };
  const onPageError = (e) => consoleErrors.push(e.message.substring(0, 200));
  const onConsole = (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text().substring(0, 200)); };

  page.on('response', onResponse);
  page.on('pageerror', onPageError);
  page.on('console', onConsole);

  // Poll for Element Plus toasts every 500 ms. These disappear after ~3s so
  // we sample continuously into `toasts`.
  let pollHandle = null;
  const startPolling = () => {
    pollHandle = setInterval(async () => {
      try {
        const current = await page.evaluate(() => {
          const msgs = Array.from(document.querySelectorAll('.el-message, .el-notification'));
          return msgs.map(m => ({
            type: (m.className.match(/el-message--(\w+)/) || [])[1] ||
                  (m.className.match(/el-notification--(\w+)/) || [])[1] || 'info',
            text: m.innerText.substring(0, 200),
          }));
        });
        for (const t of current) {
          if (!toasts.find(x => x.text === t.text && x.type === t.type)) toasts.push(t);
        }
      } catch { /* page may be navigating, ignore */ }
    }, 500);
  };
  const stopPolling = () => { if (pollHandle) clearInterval(pollHandle); };

  return {
    startPolling,
    stopPolling,
    detach: () => {
      stopPolling();
      page.off('response', onResponse);
      page.off('pageerror', onPageError);
      page.off('console', onConsole);
    },
    snapshot: () => ({
      networkErrors: networkErrors.slice(),
      networkAll: networkAll.slice(),
      consoleErrors: consoleErrors.slice(),
      toasts: toasts.slice(),
    }),
  };
}

/**
 * Classification predicates used across probes.
 */
const hasToastWith = (toasts, keyword) => toasts.some(t => t.text.includes(keyword));
const has404 = (netErrs) => netErrs.some(e => e.status === 404);
const has400 = (netErrs) => netErrs.some(e => e.status === 400);
const has5xx = (netErrs) => netErrs.some(e => e.status >= 500);
const firstErrBody = async (netEvents, page) => {
  // Cannot inspect response body from `networkAll` directly; caller should
  // request via page.on('response', async r => { if (bad) body = await r.text() })
  return null;
};

// ────────────────────────────────────────────────────────────────────────
// Bug #5: /sales/shipments → "新建出货" button → should be no-op
// ────────────────────────────────────────────────────────────────────────
async function probeBug5_ShipmentNew(browser) {
  const { context, page } = await newContextWithAuth(browser, 'e2e_factory_admin');
  const obs = attachObservers(page);
  try {
    await page.goto(`${BASE}/sales/shipments`, { waitUntil: 'networkidle', timeout: 45000 });
    await page.waitForTimeout(3000);
    obs.startPolling();

    const btnInfo = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button, .el-button'));
      const target = btns.find(b => b.textContent?.trim().includes('新建出货'));
      return {
        found: !!target,
        text: target?.textContent?.trim(),
        disabled: target?.disabled || target?.classList?.contains('is-disabled'),
      };
    });

    if (!btnInfo.found) {
      obs.detach();
      record('bug5', 'click_new_shipment', 'sales/shipments', 'WARN', { reason: 'button not found', btnInfo });
      return;
    }

    // Snapshot network activity BEFORE click, then click and sample again
    const beforeCount = obs.snapshot().networkAll.length;
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button, .el-button'));
      const target = btns.find(b => b.textContent?.trim().includes('新建出货'));
      target?.click();
    });
    await page.waitForTimeout(3000); // give any async handler time to fire
    const snap = obs.snapshot();
    const afterCount = snap.networkAll.length;

    // Check if dialog / drawer appeared
    const dialogState = await page.evaluate(() => {
      const dialog = document.querySelector('.el-dialog:not([style*="display: none"]), .el-drawer.is-open');
      return {
        dialogAppeared: !!dialog,
        dialogTitle: dialog?.querySelector('.el-dialog__title, .el-drawer__title')?.textContent?.trim(),
      };
    });

    obs.detach();

    const newRequests = afterCount - beforeCount;
    const noResponse = !dialogState.dialogAppeared && newRequests === 0 && snap.toasts.length === 0;

    record('bug5', 'click_new_shipment', 'sales/shipments',
      noResponse ? 'REPRO' : 'NOT_REPRO',
      {
        btnInfo,
        dialogState,
        newRequestsAfterClick: newRequests,
        toastCount: snap.toasts.length,
        toastSample: snap.toasts.slice(0, 2),
      });
  } catch (e) {
    obs.detach();
    record('bug5', 'click_new_shipment', 'sales/shipments', 'FAIL', { error: e.message.substring(0, 200) });
  } finally {
    await context.close();
  }
}

// ────────────────────────────────────────────────────────────────────────
// Bug #6: /system/roles → "查看权限" on first row → 404 toast
// ────────────────────────────────────────────────────────────────────────
async function probeBug6_RolePermissions(browser) {
  const { context, page } = await newContextWithAuth(browser, 'e2e_factory_admin');
  const obs = attachObservers(page);
  try {
    await page.goto(`${BASE}/system/roles`, { waitUntil: 'networkidle', timeout: 45000 });
    await page.waitForTimeout(3000);
    obs.startPolling();

    const clicked = await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('.el-table__row, tr'));
      for (const row of rows) {
        const btn = Array.from(row.querySelectorAll('button, .el-button'))
          .find(b => b.textContent?.trim().includes('查看权限'));
        if (btn) { btn.click(); return { clicked: true, rowText: row.textContent?.substring(0, 80) }; }
      }
      return { clicked: false };
    });

    if (!clicked.clicked) {
      obs.detach();
      record('bug6', 'view_permissions', 'system/roles', 'WARN', { reason: 'button not found' });
      return;
    }

    await page.waitForTimeout(4000);
    const snap = obs.snapshot();
    obs.detach();

    const got404 = has404(snap.networkErrors);
    const got404Toast = hasToastWith(snap.toasts, '请求资源不存在') ||
                        hasToastWith(snap.toasts, '404') ||
                        hasToastWith(snap.toasts, '不存在');
    const status = got404 || got404Toast ? 'REPRO' : 'NOT_REPRO';

    record('bug6', 'view_permissions', 'system/roles', status, {
      clickedRow: clicked.rowText,
      networkErrors: snap.networkErrors.slice(0, 5),
      toasts: snap.toasts.slice(0, 3),
    });
  } catch (e) {
    obs.detach();
    record('bug6', 'view_permissions', 'system/roles', 'FAIL', { error: e.message.substring(0, 200) });
  } finally {
    await context.close();
  }
}

// ────────────────────────────────────────────────────────────────────────
// Bug #7: /system/workflow-designer → interact → 404
// ────────────────────────────────────────────────────────────────────────
async function probeBug7_WorkflowDesigner(browser) {
  const { context, page } = await newContextWithAuth(browser, 'e2e_factory_admin');
  const obs = attachObservers(page);
  try {
    await page.goto(`${BASE}/system/workflow-designer`, { waitUntil: 'networkidle', timeout: 45000 });
    await page.waitForTimeout(3500);
    obs.startPolling();

    // Try clicking any "新建 / 新增 / 创建 / 保存 / 运行 / 测试" button on the page
    const clicked = await page.evaluate(() => {
      const candidates = ['新建', '新增', '创建', '保存', '运行', '测试', '添加'];
      const btns = Array.from(document.querySelectorAll('button, .el-button'));
      for (const kw of candidates) {
        const b = btns.find(x => !x.disabled && x.textContent?.trim().includes(kw));
        if (b) { b.click(); return { clicked: true, buttonText: b.textContent?.trim(), keyword: kw }; }
      }
      return { clicked: false, buttonsSeen: btns.slice(0, 10).map(b => b.textContent?.trim().substring(0, 20)) };
    });

    await page.waitForTimeout(3500);
    const snap = obs.snapshot();
    obs.detach();

    const got404 = has404(snap.networkErrors);
    const got404Toast = hasToastWith(snap.toasts, '请求资源不存在') ||
                        hasToastWith(snap.toasts, '404') ||
                        hasToastWith(snap.toasts, '不存在');
    const errToast = hasToastWith(snap.toasts, '失败') || hasToastWith(snap.toasts, '错误');

    let status = 'NOT_REPRO';
    if (got404 || got404Toast) status = 'REPRO';
    else if (!clicked.clicked) status = 'WARN';
    else if (errToast || has5xx(snap.networkErrors)) status = 'REPRO';

    record('bug7', 'interact_save', 'system/workflow-designer', status, {
      clicked,
      networkErrors: snap.networkErrors.slice(0, 5),
      toasts: snap.toasts.slice(0, 3),
    });
  } catch (e) {
    obs.detach();
    record('bug7', 'interact_save', 'system/workflow-designer', 'FAIL', { error: e.message.substring(0, 200) });
  } finally {
    await context.close();
  }
}

// ────────────────────────────────────────────────────────────────────────
// Bug #8: /system/features → 初始化默认配置 (closest to 手动同步) → 失败
// ────────────────────────────────────────────────────────────────────────
async function probeBug8_FeaturesSync(browser) {
  const { context, page } = await newContextWithAuth(browser, 'e2e_factory_admin');
  const obs = attachObservers(page);
  try {
    await page.goto(`${BASE}/system/features`, { waitUntil: 'networkidle', timeout: 45000 });
    await page.waitForTimeout(3000);
    obs.startPolling();

    // Look for sync / init buttons
    const btnInfo = await page.evaluate(() => {
      const keywords = ['手动同步', '同步', '初始化默认配置', '初始化', '刷新'];
      const btns = Array.from(document.querySelectorAll('button, .el-button'));
      for (const kw of keywords) {
        const b = btns.find(x => !x.disabled && x.textContent?.trim().includes(kw));
        if (b) { b.click(); return { clicked: true, buttonText: b.textContent?.trim(), keyword: kw }; }
      }
      return { clicked: false };
    });

    if (!btnInfo.clicked) {
      obs.detach();
      record('bug8', 'manual_sync', 'system/features', 'WARN', { reason: 'sync button not found' });
      return;
    }

    // If a confirm dialog opened, click "确定"
    await page.waitForTimeout(1500);
    const confirmed = await page.evaluate(() => {
      const dialog = document.querySelector('.el-message-box');
      if (!dialog) return { hadDialog: false };
      const okBtn = Array.from(dialog.querySelectorAll('button')).find(b => b.textContent?.trim().includes('确定'));
      if (okBtn) { okBtn.click(); return { hadDialog: true, confirmed: true }; }
      return { hadDialog: true, confirmed: false };
    });

    await page.waitForTimeout(4000);
    const snap = obs.snapshot();
    obs.detach();

    const errToast = hasToastWith(snap.toasts, '失败') || hasToastWith(snap.toasts, '错误');
    const hasErr = has4xx5xx(snap.networkErrors);
    const status = errToast || hasErr ? 'REPRO' : 'NOT_REPRO';

    record('bug8', 'manual_sync', 'system/features', status, {
      btnInfo,
      confirmed,
      networkErrors: snap.networkErrors.slice(0, 5),
      toasts: snap.toasts.slice(0, 3),
    });
  } catch (e) {
    obs.detach();
    record('bug8', 'manual_sync', 'system/features', 'FAIL', { error: e.message.substring(0, 200) });
  } finally {
    await context.close();
  }
}

function has4xx5xx(errs) { return errs.some(e => e.status >= 400); }

// ────────────────────────────────────────────────────────────────────────
// Bug #2: /smart-bi/financial-dashboard → load → canceled / errors
// ────────────────────────────────────────────────────────────────────────
async function probeBug2_FinancialDashboard(browser) {
  const { context, page } = await newContextWithAuth(browser, 'e2e_factory_admin');
  const obs = attachObservers(page);
  const canceledRequests = [];
  page.on('requestfailed', req => {
    canceledRequests.push({
      url: req.url().replace(BASE, '').replace('http://139.196.165.140:8086', ''),
      failure: req.failure()?.errorText,
    });
  });

  try {
    await page.goto(`${BASE}/smart-bi/financial-dashboard`, { waitUntil: 'networkidle', timeout: 45000 });
    await page.waitForTimeout(6000); // dashboard has several sequential API calls
    obs.startPolling();

    // Wait longer to observe delayed cancellations
    await page.waitForTimeout(6000);
    const snap = obs.snapshot();
    obs.detach();

    const hasCanceled = canceledRequests.length > 0;
    const dashboardState = await page.evaluate(() => {
      const body = document.body.innerText;
      return {
        hasCanceledText: body.includes('canceled') || body.includes('已取消'),
        hasErrorCard: !!document.querySelector('.el-result__icon--error, .error-state'),
        bodyPreview: body.substring(0, 200),
      };
    });

    const hasErr = has4xx5xx(snap.networkErrors);
    const status = (hasCanceled || dashboardState.hasCanceledText || hasErr) ? 'REPRO' : 'NOT_REPRO';

    record('bug2', 'load_financial_dashboard', 'smart-bi/financial-dashboard', status, {
      canceledCount: canceledRequests.length,
      canceledSample: canceledRequests.slice(0, 3),
      networkErrors: snap.networkErrors.slice(0, 5),
      toasts: snap.toasts.slice(0, 2),
      dashboardState,
    });
  } catch (e) {
    obs.detach();
    record('bug2', 'load_financial_dashboard', 'smart-bi/financial-dashboard', 'FAIL', { error: e.message.substring(0, 200) });
  } finally {
    await context.close();
  }
}

// ────────────────────────────────────────────────────────────────────────
// Bug #3: /smart-bi/upload → upload csv fixture → 数据处理失败
// ────────────────────────────────────────────────────────────────────────
async function probeBug3_SmartBIUpload(browser) {
  const { context, page } = await newContextWithAuth(browser, 'e2e_factory_admin');
  const obs = attachObservers(page);
  try {
    await page.goto(`${BASE}/smart-bi/upload`, { waitUntil: 'networkidle', timeout: 45000 });
    await page.waitForTimeout(3000);
    obs.startPolling();

    // Create a minimal CSV payload in memory and set it on the file input
    const fileInput = await page.locator('input[type="file"]').first();
    const inputExists = await fileInput.count() > 0;
    if (!inputExists) {
      obs.detach();
      record('bug3', 'upload_file', 'smart-bi/upload', 'WARN', { reason: 'file input not found' });
      return;
    }

    // Write a tiny test CSV to a tmp path Playwright can set
    const tmpDir = 'tests/e2e-comprehensive/results';
    if (!existsSync(tmpDir)) mkdirSync(tmpDir, { recursive: true });
    const csvPath = path.resolve(tmpDir, 'r19-probe-bug3.csv');
    writeFileSync(csvPath, 'date,amount\n2026-04-01,100\n2026-04-02,200\n');

    await fileInput.setInputFiles(csvPath);
    await page.waitForTimeout(6000); // upload + server parse

    // Sometimes upload requires explicit "上传" / "确认上传" click
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button, .el-button'));
      const kws = ['上传', '开始上传', '确认上传', '开始解析', '解析'];
      for (const kw of kws) {
        const b = btns.find(x => !x.disabled && x.textContent?.trim().includes(kw));
        if (b) { b.click(); return; }
      }
    });
    await page.waitForTimeout(8000);

    const snap = obs.snapshot();
    obs.detach();

    const errToast = hasToastWith(snap.toasts, '失败') ||
                     hasToastWith(snap.toasts, '错误') ||
                     hasToastWith(snap.toasts, '数据处理');
    const hasErr = has4xx5xx(snap.networkErrors);
    const status = errToast || hasErr ? 'REPRO' : 'NOT_REPRO';

    record('bug3', 'upload_file', 'smart-bi/upload', status, {
      uploadedPath: csvPath,
      networkErrors: snap.networkErrors.slice(0, 5),
      toasts: snap.toasts.slice(0, 3),
    });
  } catch (e) {
    obs.detach();
    record('bug3', 'upload_file', 'smart-bi/upload', 'FAIL', { error: e.message.substring(0, 200) });
  } finally {
    await context.close();
  }
}

// ────────────────────────────────────────────────────────────────────────
// Bug #12: /smart-bi/finance → 演示数据 button → 无法生成
// Note: 演示数据 button lives on FinancialDashboardPBI (/smart-bi/financial-dashboard),
// not /smart-bi/finance (FinanceAnalysis). We try both — the task URL first,
// then fallback to where the button actually lives.
// ────────────────────────────────────────────────────────────────────────
async function probeBug12_DemoData(browser) {
  const { context, page } = await newContextWithAuth(browser, 'e2e_factory_admin');
  const obs = attachObservers(page);
  try {
    // Try /smart-bi/finance first
    await page.goto(`${BASE}/smart-bi/finance`, { waitUntil: 'networkidle', timeout: 45000 });
    await page.waitForTimeout(3000);
    obs.startPolling();

    let clickResult = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button, .el-button'));
      const kws = ['演示数据', '生成演示', '示例数据', '加载演示'];
      for (const kw of kws) {
        const b = btns.find(x => !x.disabled && x.textContent?.trim().includes(kw));
        if (b) { b.click(); return { clicked: true, via: 'finance', buttonText: b.textContent?.trim() }; }
      }
      return { clicked: false, via: 'finance' };
    });

    // Fallback: jump to financial-dashboard
    if (!clickResult.clicked) {
      await page.goto(`${BASE}/smart-bi/financial-dashboard`, { waitUntil: 'networkidle', timeout: 45000 });
      await page.waitForTimeout(3500);
      clickResult = await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll('button, .el-button'));
        const kws = ['演示数据', '生成演示', '示例数据', '加载演示'];
        for (const kw of kws) {
          const b = btns.find(x => !x.disabled && x.textContent?.trim().includes(kw));
          if (b) { b.click(); return { clicked: true, via: 'financial-dashboard', buttonText: b.textContent?.trim() }; }
        }
        return { clicked: false, via: 'financial-dashboard' };
      });
    }

    if (!clickResult.clicked) {
      obs.detach();
      record('bug12', 'demo_data_click', 'smart-bi/finance', 'WARN', { reason: 'demo button not found on either page' });
      return;
    }

    // Handle possible confirm dialog
    await page.waitForTimeout(1500);
    await page.evaluate(() => {
      const dialog = document.querySelector('.el-message-box');
      if (!dialog) return;
      const okBtn = Array.from(dialog.querySelectorAll('button')).find(b => b.textContent?.trim().includes('确定'));
      okBtn?.click();
    });

    await page.waitForTimeout(6000);
    const snap = obs.snapshot();
    obs.detach();

    const errToast = hasToastWith(snap.toasts, '失败') ||
                     hasToastWith(snap.toasts, '无法') ||
                     hasToastWith(snap.toasts, '错误');
    const hasErr = has4xx5xx(snap.networkErrors);
    const status = errToast || hasErr ? 'REPRO' : 'NOT_REPRO';

    record('bug12', 'demo_data_click', `smart-bi/${clickResult.via}`, status, {
      clickResult,
      networkErrors: snap.networkErrors.slice(0, 5),
      toasts: snap.toasts.slice(0, 3),
    });
  } catch (e) {
    obs.detach();
    record('bug12', 'demo_data_click', 'smart-bi/finance', 'FAIL', { error: e.message.substring(0, 200) });
  } finally {
    await context.close();
  }
}

// ────────────────────────────────────────────────────────────────────────
// Bug #14: /smart-bi/query → submit AI query → 超时 (may exceed 30s)
// ────────────────────────────────────────────────────────────────────────
async function probeBug14_AIQueryTimeout(browser) {
  const { context, page } = await newContextWithAuth(browser, 'e2e_factory_admin');
  const obs = attachObservers(page);
  try {
    await page.goto(`${BASE}/smart-bi/query`, { waitUntil: 'networkidle', timeout: 45000 });
    await page.waitForTimeout(3000);
    obs.startPolling();

    // Fill the textarea via Playwright's .fill() so v-model reactivity triggers.
    // The "发送" button is :disabled="!inputQuery.trim()", so if we bypass
    // v-model, the button stays disabled and we can't click it.
    let filled = { filled: false };
    try {
      const textareaLocator = page.locator('textarea').first();
      await textareaLocator.waitFor({ state: 'visible', timeout: 5000 });
      await textareaLocator.fill('最近三个月的销售额总和是多少？');
      filled = { filled: true, value: await textareaLocator.inputValue() };
    } catch (err) {
      obs.detach();
      record('bug14', 'ai_query_submit', 'smart-bi/query', 'WARN', { reason: 'textarea fill failed', error: err.message.substring(0, 100) });
      return;
    }

    // Wait one tick so Vue's reactivity updates :disabled on the button
    await page.waitForTimeout(500);

    const clickResult = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button, .el-button'));
      const kws = ['发送', '提问', '查询', '提交', '问一下'];
      for (const kw of kws) {
        const b = btns.find(x => !x.disabled && x.textContent?.trim().includes(kw));
        if (b) { b.click(); return { clicked: true, buttonText: b.textContent?.trim() }; }
      }
      // Fallback — Enter key on the textarea if no plain button found
      return { clicked: false, triedKeys: ['发送', '提问', '查询', '提交', '问一下'] };
    });

    if (!clickResult.clicked) {
      // Try Enter key as submit
      try { await page.locator('textarea').first().press('Enter'); clickResult.clicked = true; clickResult.via = 'enter_key'; } catch { /* noop */ }
    }

    if (!clickResult.clicked) {
      obs.detach();
      record('bug14', 'ai_query_submit', 'smart-bi/query', 'WARN', { reason: 'no submit button found', filled });
      return;
    }

    // Wait up to 35s for any /query response to land.  Track whether a
    // response ever arrived and its latency.
    const startedAt = Date.now();
    const timeoutMs = 35000;
    let queryResp = null;
    try {
      queryResp = await page.waitForResponse(
        r => /\/(smart-?bi|analytics|query|ai)/.test(r.url()) && r.request().method() === 'POST',
        { timeout: timeoutMs }
      );
    } catch { /* timed out, expected */ }

    const elapsed = Date.now() - startedAt;
    await page.waitForTimeout(1500);
    const snap = obs.snapshot();
    obs.detach();

    const timeoutToast = hasToastWith(snap.toasts, '超时') ||
                         hasToastWith(snap.toasts, 'timeout') ||
                         hasToastWith(snap.toasts, '请重试');
    const hasErr = has4xx5xx(snap.networkErrors);
    const hitTimeoutWindow = elapsed >= timeoutMs - 500;

    let status = 'NOT_REPRO';
    if (hitTimeoutWindow || timeoutToast) status = 'TIMEOUT';
    else if (hasErr) status = 'REPRO';

    record('bug14', 'ai_query_submit', 'smart-bi/query', status, {
      filled,
      clickResult,
      elapsedMs: elapsed,
      respStatus: queryResp?.status(),
      networkErrors: snap.networkErrors.slice(0, 5),
      toasts: snap.toasts.slice(0, 3),
    });
  } catch (e) {
    obs.detach();
    record('bug14', 'ai_query_submit', 'smart-bi/query', 'FAIL', { error: e.message.substring(0, 200) });
  } finally {
    await context.close();
  }
}

// ────────────────────────────────────────────────────────────────────────
// Bug #15: /smart-bi/query-templates → 一键执行 → loading 无法显示
// ────────────────────────────────────────────────────────────────────────
async function probeBug15_TemplateOneClick(browser) {
  const { context, page } = await newContextWithAuth(browser, 'e2e_factory_admin');
  const obs = attachObservers(page);
  try {
    await page.goto(`${BASE}/smart-bi/query-templates`, { waitUntil: 'networkidle', timeout: 45000 });
    await page.waitForTimeout(3500);
    obs.startPolling();

    const clickResult = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button, .el-button'));
      const b = btns.find(x => !x.disabled && x.textContent?.trim().includes('一键执行'));
      if (b) { b.click(); return { clicked: true, buttonText: b.textContent?.trim() }; }
      return { clicked: false, buttonsSeen: btns.slice(0, 10).map(x => x.textContent?.trim().substring(0, 20)) };
    });

    if (!clickResult.clicked) {
      obs.detach();
      record('bug15', 'one_click_execute', 'smart-bi/query-templates', 'WARN', { reason: 'button not found', clickResult });
      return;
    }

    // Within ~1s check whether loading indicator became visible, then wait for resolution
    await page.waitForTimeout(1000);
    const loadingState = await page.evaluate(() => {
      const globalLoading = document.querySelector('.el-loading-mask, .is-loading');
      const btnLoading = document.querySelector('button.is-loading, .el-button.is-loading');
      const anyProgress = document.querySelector('.el-progress, .loading-indicator');
      return {
        globalLoadingVisible: !!globalLoading && globalLoading.offsetParent !== null,
        btnLoadingVisible: !!btnLoading,
        anyProgress: !!anyProgress,
      };
    });

    await page.waitForTimeout(6000);
    const snap = obs.snapshot();
    obs.detach();

    // REPRO if: button clicked but NO loading indicator ever showed AND no error came back
    const noLoading = !loadingState.globalLoadingVisible && !loadingState.btnLoadingVisible && !loadingState.anyProgress;
    const errToast = hasToastWith(snap.toasts, '失败') || hasToastWith(snap.toasts, '错误');
    const hasErr = has4xx5xx(snap.networkErrors);

    let status = 'NOT_REPRO';
    if (noLoading && !errToast && snap.toasts.length === 0) status = 'REPRO';
    else if (hasErr || errToast) status = 'REPRO';

    record('bug15', 'one_click_execute', 'smart-bi/query-templates', status, {
      clickResult,
      loadingState,
      toastCount: snap.toasts.length,
      toastSample: snap.toasts.slice(0, 2),
      networkErrors: snap.networkErrors.slice(0, 3),
    });
  } catch (e) {
    obs.detach();
    record('bug15', 'one_click_execute', 'smart-bi/query-templates', 'FAIL', { error: e.message.substring(0, 200) });
  } finally {
    await context.close();
  }
}

// ────────────────────────────────────────────────────────────────────────
// Bug #9: /analytics/alert-dashboard → 解决 → 确认解决 → 缺少必要参数
// ────────────────────────────────────────────────────────────────────────
async function probeBug9_AlertResolve(browser) {
  const { context, page } = await newContextWithAuth(browser, 'e2e_factory_admin');
  const obs = attachObservers(page);
  // Capture error response bodies so we can confirm "缺少必要参数"
  const errBodies = [];
  page.on('response', async (r) => {
    if (r.status() >= 400 && r.request().url().includes('/alerts/')) {
      try { errBodies.push({ url: r.url().replace(BASE, '').substring(0, 120), status: r.status(), body: (await r.text()).substring(0, 400) }); } catch { /* body read may fail */ }
    }
  });
  try {
    await page.goto(`${BASE}/analytics/alert-dashboard`, { waitUntil: 'networkidle', timeout: 45000 });
    await page.waitForTimeout(3500);
    obs.startPolling();

    // Step 1: click "解决" on first ACTIVE/ACKNOWLEDGED row
    const step1 = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button, .el-button'));
      const b = btns.find(x => !x.disabled && x.textContent?.trim() === '解决');
      if (b) { b.click(); return { clicked: true }; }
      return { clicked: false, buttonsSeen: btns.slice(0, 15).map(x => x.textContent?.trim().substring(0, 15)) };
    });

    if (!step1.clicked) {
      obs.detach();
      record('bug9', 'resolve_alert', 'analytics/alert-dashboard', 'WARN', { reason: 'no 解决 button — no active alerts?', step1 });
      return;
    }

    await page.waitForTimeout(1500);
    // Step 2: in the opened dialog, skip the textarea (bug triggers on empty notes)
    // and immediately click "确认解决"
    const step2 = await page.evaluate(() => {
      const dialog = document.querySelector('.el-dialog:not([style*="display: none"])');
      if (!dialog) return { dialogOpened: false };
      const okBtn = Array.from(dialog.querySelectorAll('button')).find(b => b.textContent?.trim().includes('确认解决'));
      if (okBtn) { okBtn.click(); return { dialogOpened: true, confirmed: true }; }
      return { dialogOpened: true, confirmed: false };
    });

    await page.waitForTimeout(4000);
    const snap = obs.snapshot();
    obs.detach();

    const paramToast = hasToastWith(snap.toasts, '缺少必要参数') ||
                       hasToastWith(snap.toasts, '缺少参数') ||
                       hasToastWith(snap.toasts, '参数错误') ||
                       hasToastWith(snap.toasts, '操作失败');
    const paramBody = errBodies.some(e => e.body.includes('缺少必要参数') || e.body.includes('缺少参数'));
    const has400Err = has400(snap.networkErrors);
    const has5xxErr = has5xx(snap.networkErrors);

    let status = 'NOT_REPRO';
    if (paramToast || paramBody || has400Err) status = 'REPRO';
    else if (has5xxErr) status = 'REPRO';

    record('bug9', 'resolve_alert', 'analytics/alert-dashboard', status, {
      step1,
      step2,
      paramToast,
      paramBody,
      networkErrors: snap.networkErrors.slice(0, 5),
      errBodies: errBodies.slice(0, 2),
      toasts: snap.toasts.slice(0, 3),
    });
  } catch (e) {
    obs.detach();
    record('bug9', 'resolve_alert', 'analytics/alert-dashboard', 'FAIL', { error: e.message.substring(0, 200) });
  } finally {
    await context.close();
  }
}

// ────────────────────────────────────────────────────────────────────────
// Main
// ────────────────────────────────────────────────────────────────────────
(async () => {
  console.log('═══════════════════════════════════════');
  console.log('  R19 action-level probes — 10 customer bugs');
  console.log('  (R18 smoke showed NOT_REPRO for most; these reproduce on click)');
  console.log('═══════════════════════════════════════');

  const browser = await chromium.launch({ headless: true });
  try {
    await setupAuthOnce(browser, 'e2e_factory_admin');
    console.log('✓ Auth cache ready\n');

    const probes = [
      ['bug5',  'sales/shipments',             probeBug5_ShipmentNew],
      ['bug6',  'system/roles',                probeBug6_RolePermissions],
      ['bug7',  'system/workflow-designer',    probeBug7_WorkflowDesigner],
      ['bug8',  'system/features',             probeBug8_FeaturesSync],
      ['bug2',  'smart-bi/financial-dashboard', probeBug2_FinancialDashboard],
      ['bug3',  'smart-bi/upload',             probeBug3_SmartBIUpload],
      ['bug12', 'smart-bi/finance',            probeBug12_DemoData],
      ['bug14', 'smart-bi/query',              probeBug14_AIQueryTimeout],
      ['bug15', 'smart-bi/query-templates',    probeBug15_TemplateOneClick],
      ['bug9',  'analytics/alert-dashboard',   probeBug9_AlertResolve],
    ];

    for (const [id, label, fn] of probes) {
      console.log(`\n--- ${id} (${label}) ---`);
      try {
        // Per-probe hard timeout so one stuck test does not block the whole round
        await Promise.race([
          fn(browser),
          new Promise((_, reject) => setTimeout(() => reject(new Error('probe-level timeout 90s')), 90000)),
        ]);
      } catch (e) {
        record(id, 'orchestrator', label, 'FAIL', { error: e.message.substring(0, 200) });
      }
    }
  } catch (e) {
    console.error(`FATAL: ${e.message}`);
    results.push({ layer: 'L4', testId: 'fatal', probe: 'error', module: 'runner', status: 'FAIL', evidence: { message: e.message }, ts: new Date().toISOString() });
  } finally {
    await browser.close();
  }

  // Summary
  const repro = results.filter(r => r.status === 'REPRO').length;
  const notRepro = results.filter(r => r.status === 'NOT_REPRO').length;
  const warn = results.filter(r => r.status === 'WARN').length;
  const fail = results.filter(r => r.status === 'FAIL').length;
  const timeout = results.filter(r => r.status === 'TIMEOUT').length;

  const summary = {
    round: ROUND,
    timestamp: new Date().toISOString(),
    factoryId: FACTORY_ID,
    notes: 'R19 action-level probes — driving the specific user action for each of 10 bugs (R18 smoke = page-load only).',
    probeType: 'action',
    bugsCovered: ['bug5','bug6','bug7','bug8','bug2','bug3','bug12','bug14','bug15','bug9'],
    results,
    summary: { repro, notRepro, warn, timeout, fail, total: results.length },
  };
  const outFile = `tests/e2e-comprehensive/results/e2e-R19-action-probes.json`;
  writeFileSync(outFile, JSON.stringify(summary, null, 2));
  console.log(`\n✓ Saved → ${outFile}`);
  console.log(`  结果: ${repro} REPRO 🐛 / ${notRepro} NOT_REPRO ✓ / ${warn} WARN ⚠ / ${timeout} TIMEOUT ⏱ / ${fail} FAIL ✗  (total ${results.length})`);

  // Per-bug verdict line
  console.log('\n  Per-bug verdict:');
  for (const r of results) {
    if (r.testId !== 'fatal') console.log(`    ${r.testId.padEnd(6)} ${r.module.padEnd(40)} → ${r.status}`);
  }

  process.exit(fail > 0 ? 1 : 0);
})();
