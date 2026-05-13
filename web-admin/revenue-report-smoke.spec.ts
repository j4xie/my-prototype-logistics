/**
 * QHJ revenue report — minimal active E2E smoke (Phase I post-deploy).
 *
 * Lighter than revenue-report.spec.ts: just verify the page loads cleanly,
 * stores API is hit (200), and audit-log API is hit (200). Skips deeper UI
 * interactions to avoid Element Plus toast-intercept flake.
 */
import { test, expect } from '@playwright/test';
import { fetchLoginToken, injectAuthCookie } from './e2e-auth-helper';
import * as path from 'node:path';
import * as fs from 'node:fs';

const BASE_URL = process.env.E2E_BASE_URL || 'http://139.196.165.140:8097';
const API_BASE = process.env.E2E_API_BASE || `${BASE_URL}/api/mobile`;
const FACTORY_ID = process.env.E2E_FACTORY_ID || 'R_QINGHUAJIAO_REAL';
const USER = process.env.E2E_USER || 'qhj_admin';
const PASS = process.env.E2E_PASS || 'QhjAdmin@2026';
const SD = 'test-results/screenshots/revenue-report-smoke';

// Real QHJ POS zips from the 二维火 export folder. Two files exercise different
// writers:
//   - 堂食外卖占比表 (4KB) → meal_split_writer (stub in Phase C — verifies
//     dispatch + registry match only)
//   - 订单付款方式汇总 (31KB) → bill_flow_writer (real writer — populates
//     fact_pos_transaction and fact_pos_item Silver tables)
const QHJ_POS_DIR = process.env.QHJ_POS_DIR ||
  'C:/Users/Steve/my-prototype-logistics/smartbi维度分析/大众点评/真实餐饮连锁数据/青花椒25年/青花椒25年';
const POS_FILE_STUB = path.join(
  QHJ_POS_DIR,
  '20260422102057548_8ebf92a0d41_堂食外卖占比表.zip',
);
const POS_FILE_REAL = path.join(
  QHJ_POS_DIR,
  '20260422101723690_f353de28931_订单付款方式汇总统计.zip',
);

// Login once for the whole spec (Java enforces a 60s rate-limit per username;
// we share the token across all tests).
let sharedToken = '';
let sharedLoginData: Record<string, unknown> = {};

test.beforeAll(async () => {
  const auth = await fetchLoginToken(USER, PASS, API_BASE);
  expect(auth.token, 'login token').toBeTruthy();
  sharedToken = auth.token;
  sharedLoginData = auth.loginData;
});

test('page mounts + API calls succeed', async ({ page, context }) => {
  // Inject cookie + localStorage token using the shared login result.
  // The request interceptor reads cretas_access_token from localStorage —
  // see reference_web_admin_token_key memory.
  expect(sharedToken).toBeTruthy();
  await injectAuthCookie(context, page, sharedToken, sharedLoginData, BASE_URL);
  await page.evaluate((tok) => {
    localStorage.setItem('cretas_access_token', tok);
  }, sharedToken);

  // 2. Track API calls to revenue-report endpoints
  const apiCalls: Array<{ url: string; status: number }> = [];
  page.on('response', (r) => {
    const u = r.url();
    if (u.includes('/revenue-report/')) {
      apiCalls.push({ url: u, status: r.status() });
    }
  });

  // 3. Navigate; wait for networkidle (Vue + permission API + 2 onMounted calls)
  await page.goto(`${BASE_URL}/smart-bi/revenue-report`, {
    waitUntil: 'networkidle',
    timeout: 30_000,
  });

  // 4. Title should be present after app hydrates
  await expect(page.locator('h1, .page-title, [class*="page-title"]').first())
    .toContainText('收入管理报表', { timeout: 15_000 });

  // 5. Both onMounted API calls must have hit + returned 200
  const stores = apiCalls.find((c) => c.url.includes('/stores'));
  const auditLog = apiCalls.find((c) => c.url.includes('/audit-log'));

  console.log('[smoke] API calls observed:', apiCalls);

  expect(stores, '/stores call should fire on mount').toBeDefined();
  expect(stores?.status, '/stores should return 200').toBe(200);

  expect(auditLog, '/audit-log call should fire on mount').toBeDefined();
  expect(auditLog?.status, '/audit-log should return 200').toBe(200);

  // 6. No error toast should be visible (would indicate API mismatch)
  const errorToast = page.locator('.el-message--error');
  await expect(errorToast).toHaveCount(0, { timeout: 2_000 }).catch(() => {
    // Capture error toast text for diagnostics if any appears
    return errorToast.allInnerTexts().then((txt) => {
      throw new Error(`Unexpected error toast(s): ${JSON.stringify(txt)}`);
    });
  });

  await page.screenshot({ path: `${SD}/01-page-loaded.png`, fullPage: true });
});

async function uploadPosFile(
  request: any, // eslint-disable-line @typescript-eslint/no-explicit-any
  filePath: string,
): Promise<{ status: number; envelope: any /* eslint-disable-line @typescript-eslint/no-explicit-any */ }> {
  expect(fs.existsSync(filePath), `POS file not found: ${filePath}`).toBe(true);
  const fileBuf = fs.readFileSync(filePath);
  const res = await request.post(
    `${BASE_URL}/api/smartbi/${FACTORY_ID}/revenue-report/upload`,
    {
      headers: { Authorization: `Bearer ${sharedToken}` },
      multipart: {
        files: {
          name: path.basename(filePath),
          mimeType: 'application/zip',
          buffer: fileBuf,
        },
      },
      timeout: 120_000,
    },
  );
  const body = await res.text();
  // eslint-disable-next-line no-console
  console.log(`[upload] ${path.basename(filePath)} → status=${res.status()}, body[0..200]=${body.substring(0, 200)}`);
  return { status: res.status(), envelope: JSON.parse(body) };
}

test('upload — stub writer (堂食外卖占比表 → meal_split)', async ({ request }) => {
  expect(sharedToken, 'shared token from beforeAll').toBeTruthy();
  const { status, envelope } = await uploadPosFile(request, POS_FILE_STUB);

  expect(status).toBe(200);
  expect(envelope.success).toBe(true);
  const data = envelope.data;
  expect(data.batch_id).toBeTruthy();
  expect(Array.isArray(data.files)).toBe(true);
  expect(data.files.length).toBeGreaterThan(0);
  expect(['ok', 'duplicate']).toContain(data.files[0].status);
  expect(data.files[0].report_types).toContain('meal_split');
});

test('upload — real writer (订单付款方式汇总 → bill_flow populates Silver)', async ({ request }) => {
  expect(sharedToken, 'shared token from beforeAll').toBeTruthy();
  const { status, envelope } = await uploadPosFile(request, POS_FILE_REAL);

  expect(status).toBe(200);
  expect(envelope.success).toBe(true);
  const data = envelope.data;
  expect(data.batch_id).toBeTruthy();
  expect(data.files.length).toBeGreaterThan(0);
  expect(['ok', 'duplicate']).toContain(data.files[0].status);
  // bill_flow_writer is the real Silver-populating writer for 订单付款方式汇总
  expect(data.files[0].report_types).toContain('bill_flow');
});

