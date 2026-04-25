/**
 * S1-7: Upload 20 files across 3 tenants + capture phase timings.
 *
 * Tenants:
 *   - 青花椒 (qhj_prod / RES_3101_009)   — 8 files (~22M)
 *   - 桂满陇 (gml_prod / RES_GML_001)    — 9 files (~25M)
 *   - 唏嘛香 (xmx_fresh / R_XMX_FRESH)   — 3 files (~10M)
 *
 * Isolation: chromium.launch() with fresh ephemeral profile per tenant.
 * NOT MCP — parallel playwright session may exist elsewhere.
 *
 * Output: tests/e2e-comprehensive/results/depth-aiq-2026-04-26/upload-speed.json
 */

import { chromium } from 'playwright';
import { writeFileSync, mkdirSync, existsSync, statSync, readdirSync } from 'fs';
import path from 'path';

function firstFileIn(dir) {
  if (!existsSync(dir)) return null;
  const f = readdirSync(dir).find(n => /\.(csv|xlsx?|xls)$/i.test(n));
  return f ? `${dir}/${f}` : null;
}

const WEB_URL = 'http://139.196.165.140:8086';
const RESULTS_FILE = 'tests/e2e-comprehensive/results/depth-aiq-2026-04-26/upload-speed.json';
const SS_DIR = 'tests/e2e-comprehensive/results/depth-aiq-2026-04-26/screenshots-upload';
if (!existsSync(SS_DIR)) mkdirSync(SS_DIR, { recursive: true });

const QHJ_DIR = 'smartbi维度分析/大众点评/真实餐饮连锁数据/青花椒';
const QHJ_25_DIR = 'tests/e2e-comprehensive/results/depth-aiq-2026-04-26/unzipped/qhj-25';
const GML_DIR = 'smartbi维度分析/大众点评/真实餐饮连锁数据';
const XMX_DIR = 'smartbi维度分析/大众点评/真实餐饮连锁数据';

const TENANTS = [
  {
    name: 'qhj',
    factoryId: 'RES_3101_009',
    username: 'qhj_prod',
    password: '123456',
    files: [
      `${QHJ_DIR}/青花椒2约销量报表.csv`,
      `${QHJ_DIR}/收入管理报表.xlsx`,
      `${QHJ_DIR}/评价下载2025.07.01-2025.09.30_1328220_1773721054386.xlsx`,
      `${QHJ_DIR}/评价下载2025.10.01-2025.12.31_1328223_1773720937524.xlsx`,
      `${QHJ_25_DIR}/qhj_25_订单付款方式.csv`,
      `${QHJ_25_DIR}/qhj_25_堂食外卖占比.csv`,
      `${QHJ_25_DIR}/qhj_25_卡详情一览.csv`,
      `${QHJ_25_DIR}/qhj_25_营业概况月报.csv`,
    ],
  },
  {
    name: 'gml',
    factoryId: 'RES_GML_001',
    username: 'gml_prod',
    password: '123456',
    files: [
      firstFileIn(`${GML_DIR}/桂满陇1月_商品销量报表`),
      firstFileIn(`${GML_DIR}/桂满陇2月_商品销量报表`),
      firstFileIn(`${GML_DIR}/桂满陇3月_商品销量报表`),
      firstFileIn(`${GML_DIR}/桂满陇1月_桂满陇传菜统计报表`),
      firstFileIn(`${GML_DIR}/桂满陇2月_桂满陇传菜统计报表`),
      firstFileIn(`${GML_DIR}/桂满陇3月_桂满陇传菜统计报表`),
      firstFileIn(`${GML_DIR}/桂满陇1月_营业概况报表（兼容月报表）`),
      firstFileIn(`${GML_DIR}/桂满陇2月_营业概况报表（兼容月报表）`),
      firstFileIn(`${GML_DIR}/桂满陇3月_营业概况报表（兼容月报表）`),
    ].filter(Boolean),
  },
  {
    name: 'xmx',
    factoryId: 'R_XMX_FRESH',
    username: 'xmx_fresh',
    password: '123456',
    files: [
      `${XMX_DIR}/20260421100716739_c29cee7a081唏嘛香会员数据.xlsx`,
      `${XMX_DIR}/20260421100421唏嘛香4月付款报表.xls`,
      `${XMX_DIR}/唏嘛香（牛肉面）2月销量报表.xls`,
    ],
  },
];

const RESULTS = {
  timestamp: new Date().toISOString(),
  webUrl: WEB_URL,
  tenants: [],
};

async function uploadOneFile(page, filePath, tenant) {
  const fileName = path.basename(filePath);
  const sizeKB = Math.round(statSync(filePath).size / 1024);
  const result = {
    file: fileName,
    size_kb: sizeKB,
    timings: {},
    success: false,
    upload_id: null,
    row_count: null,
    error: null,
  };

  const t0 = Date.now();
  try {
    // Navigate to upload page (within smart-bi/analysis sheet upload card)
    if (!page.url().includes('smart-bi/analysis')) {
      await page.goto(`${WEB_URL}/smart-bi/analysis`, { waitUntil: 'networkidle', timeout: 30000 });
      await page.waitForTimeout(3000);
    }
    result.timings.nav_ms = Date.now() - t0;

    // Find file input — el-upload renders hidden input[type=file]
    const fileInput = await page.$('input[type="file"]');
    if (!fileInput) {
      result.error = 'no_file_input';
      return result;
    }

    // Set file (triggers el-upload's on-change → handleFileChange)
    const tUpload = Date.now();
    await fileInput.setInputFiles(filePath);
    await page.waitForTimeout(500);

    // Click "开始分析" button (UploadArea button)
    const startBtn = await page.locator('button:has-text("开始分析")').first();
    if (await startBtn.count() > 0) {
      await startBtn.click({ timeout: 5000 });
    }

    // Wait for SSE pipeline to finish — poll uploads_remaining via element OR wait for "成功"
    // We poll page for "数据预览" / "AI 智能分析" or KPI render
    const deadline = Date.now() + 180_000; // 3min per file
    let lastStep = '';
    while (Date.now() < deadline) {
      await page.waitForTimeout(2000);
      const state = await page.evaluate(() => {
        const text = document.body.innerText || '';
        return {
          hasSuccess: text.includes('成功') || text.includes('已成功') || text.includes('解析成功'),
          hasFail: text.includes('失败') || text.includes('错误'),
          hasKPI: !!document.querySelector('.kpi-grid, .kpi-card'),
          hasChart: !!document.querySelector('.chart-container, canvas'),
          hasAnalysis: text.includes('AI 智能分析') || text.includes('数据预览'),
          progress: (text.match(/(\d+)%/) || [])[1],
          stepText: text.substring(0, 200),
        };
      });

      if (state.stepText !== lastStep) {
        lastStep = state.stepText;
      }

      // Done when KPI + chart rendered OR explicit fail
      if ((state.hasKPI || state.hasChart) && state.hasAnalysis) {
        result.timings.full_ms = Date.now() - tUpload;
        result.success = true;
        break;
      }
      if (state.hasFail && !state.hasSuccess) {
        result.error = 'upload_or_parse_failed';
        break;
      }
    }

    if (!result.success && !result.error) {
      result.error = 'timeout_180s';
      result.timings.full_ms = Date.now() - tUpload;
    }

    // Try extract upload_id + row_count from network or DOM
    const meta = await page.evaluate(() => {
      const m = (document.body.innerText.match(/(\d+)\s*行/) || [])[1];
      return { rowCount: m ? parseInt(m) : null };
    });
    result.row_count = meta.rowCount;
  } catch (e) {
    result.error = `exception: ${e.message}`;
  }

  return result;
}

async function loginTenant(page, tenant) {
  await page.goto(`${WEB_URL}/login`, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForSelector('input', { timeout: 15000 });
  const inputs = await page.locator('input').all();
  let userInput, passInput;
  for (const i of inputs) {
    const t = await i.getAttribute('type');
    if (t === 'password' && !passInput) passInput = i;
    else if (!userInput && (t === 'text' || !t)) userInput = i;
  }
  if (!userInput || !passInput) return false;
  await userInput.fill(tenant.username);
  await passInput.fill(tenant.password);
  await passInput.press('Enter');
  try {
    await page.waitForURL((u) => !String(u).includes('/login'), { timeout: 25000 });
  } catch {
    return false;
  }
  await page.waitForTimeout(2000);
  return true;
}

(async () => {
  console.log('='.repeat(70));
  console.log('S1-7: Upload 20 files across 3 tenants + timing');
  console.log('='.repeat(70));

  for (const tenant of TENANTS) {
    console.log(`\n=== Tenant: ${tenant.name} (${tenant.factoryId}) — ${tenant.files.length} files ===`);
    const tenantResult = {
      name: tenant.name,
      factoryId: tenant.factoryId,
      uploads: [],
    };

    // Fresh chromium per tenant — ephemeral, headless
    const browser = await chromium.launch({ headless: true });
    const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
    const page = await ctx.newPage();
    page.on('pageerror', e => console.log(`  [pageerror] ${e.message}`));
    page.on('console', m => {
      if (m.type() === 'error') console.log(`  [console.error] ${m.text().substring(0, 200)}`);
    });

    // Login
    const loginOk = await loginTenant(page, tenant);
    if (!loginOk) {
      console.log(`  ❌ Login failed for ${tenant.username}`);
      tenantResult.login_failed = true;
      RESULTS.tenants.push(tenantResult);
      await browser.close();
      continue;
    }
    console.log(`  ✓ Logged in as ${tenant.username}`);
    await page.screenshot({ path: `${SS_DIR}/${tenant.name}-after-login.png`, fullPage: false }).catch(() => {});

    // Upload each file sequentially
    for (let i = 0; i < tenant.files.length; i++) {
      const fp = tenant.files[i];
      if (!existsSync(fp)) {
        console.log(`  ❌ [${i + 1}/${tenant.files.length}] ${path.basename(fp)} — FILE NOT FOUND`);
        tenantResult.uploads.push({ file: path.basename(fp), error: 'file_not_found' });
        continue;
      }
      console.log(`  → [${i + 1}/${tenant.files.length}] ${path.basename(fp)} (${Math.round(statSync(fp).size / 1024)} KB)`);
      const r = await uploadOneFile(page, fp, tenant);
      const ms = r.timings.full_ms || 0;
      const status = r.success ? '✓' : '✗';
      console.log(`    ${status} ${(ms / 1000).toFixed(1)}s ${r.error ? `(${r.error})` : ''} rows=${r.row_count}`);
      await page.screenshot({ path: `${SS_DIR}/${tenant.name}-${i + 1}-${r.success ? 'ok' : 'fail'}.png`, fullPage: false }).catch(() => {});
      tenantResult.uploads.push(r);
    }

    RESULTS.tenants.push(tenantResult);
    await browser.close();
    // Save incremental in case next tenant fails
    writeFileSync(RESULTS_FILE, JSON.stringify(RESULTS, null, 2));
  }

  // Final summary
  console.log('\n' + '='.repeat(70));
  console.log('SUMMARY');
  console.log('='.repeat(70));
  for (const t of RESULTS.tenants) {
    const succ = t.uploads.filter(u => u.success).length;
    const totalMs = t.uploads.reduce((s, u) => s + (u.timings?.full_ms || 0), 0);
    console.log(`  ${t.name}: ${succ}/${t.uploads.length} 成功, total ${(totalMs / 1000).toFixed(1)}s`);
  }

  writeFileSync(RESULTS_FILE, JSON.stringify(RESULTS, null, 2));
  console.log(`\nResults: ${RESULTS_FILE}`);
})();
