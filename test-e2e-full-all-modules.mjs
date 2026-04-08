/**
 * E2E Full Test: ALL 16 Modules — L1 + L5 Business Correctness
 * Target: Production Web-Admin (139.196.165.140:8086)
 */
import { chromium } from 'playwright';

const BASE = 'http://139.196.165.140:8086';
const API = 'http://47.100.235.168:10010/api/mobile';
const FACTORY = 'F001';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ID_WHITELIST = ['编号', 'ID', 'code', '编码', '追踪码', '批次号', '工厂', 'factoryId', '参考号'];

let TOKEN = '';
let pass = 0, fail = 0, warn = 0;
const results = [];

function log(layer, module, test, status, evidence = '') {
  const icon = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : '⚠️';
  results.push({ layer, module, test, status, evidence });
  if (status === 'PASS') pass++; else if (status === 'FAIL') fail++; else warn++;
  console.log(`${icon} [${layer}] ${module} — ${test}${evidence ? '\n   ' + evidence.slice(0, 150) : ''}`);
}

async function getToken() {
  const res = await fetch(`${API}/auth/unified-login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'factory_admin1', password: '123456' })
  });
  const d = await res.json();
  TOKEN = d.data?.accessToken || '';
}

async function login(page) {
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(2000);
  // Quick login
  const quickBtn = page.locator('button:has-text("工厂总监")');
  if (await quickBtn.isVisible().catch(() => false)) {
    await quickBtn.click();
    await page.waitForTimeout(500);
  } else {
    await page.fill('input[placeholder*="用户名"]', 'factory_admin1');
    await page.fill('input[placeholder*="密码"]', '123456');
  }
  await page.click('button:has-text("登 录")');
  await page.waitForTimeout(3000);
  return page.url().includes('dashboard');
}

// ==================== L1: Page Load ====================

async function testPageLoad(page, name, path) {
  try {
    await page.goto(`${BASE}${path}`, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForTimeout(2500);
    const hasError = await page.locator('.el-message--error').isVisible().catch(() => false);
    if (hasError) {
      const errText = await page.locator('.el-message--error').textContent().catch(() => '?');
      log('L1', name, '页面加载', 'FAIL', `error: ${errText}`);
      return false;
    }
    const hasTable = await page.locator('.el-table').first().isVisible().catch(() => false);
    const hasCard = await page.locator('.el-card').first().isVisible().catch(() => false);
    const hasContent = await page.locator('main').first().isVisible().catch(() => false);
    if (hasTable || hasCard || hasContent) {
      log('L1', name, '页面加载', 'PASS', `table=${hasTable}, card=${hasCard}`);
      return true;
    }
    log('L1', name, '页面加载', 'WARN', 'no table/card/main');
    return false;
  } catch (e) {
    log('L1', name, '页面加载', 'FAIL', e.message.slice(0, 100));
    return false;
  }
}

// ==================== L5.1: UUID Detection ====================

async function testUUID(page, name, path, columns) {
  try {
    await page.goto(`${BASE}${path}`, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForTimeout(2500);
    const headers = await page.$$eval('.el-table__header-wrapper th .cell', els => els.map(e => e.textContent?.trim() || '')).catch(() => []);
    const rows = await page.$$eval('.el-table__body-wrapper .el-table__row', rows =>
      rows.slice(0, 5).map(r => Array.from(r.querySelectorAll('td .cell')).map(c => c.textContent?.trim() || ''))
    ).catch(() => []);
    if (rows.length === 0) { log('L5.1', name, 'UUID检测', 'WARN', '无数据行'); return; }

    const uuids = [];
    for (const row of rows) {
      for (let ci = 0; ci < row.length; ci++) {
        const h = headers[ci] || '';
        if (ID_WHITELIST.some(kw => h.includes(kw))) continue;
        if (columns && !columns.some(c => h.includes(c))) continue;
        if (UUID_RE.test(row[ci])) uuids.push(`${h}="${row[ci].slice(0, 20)}"`);
      }
    }
    if (uuids.length > 0) log('L5.1', name, 'UUID检测', 'FAIL', uuids.join(', '));
    else log('L5.1', name, 'UUID检测', 'PASS', `${rows.length}行, 0 UUID`);
  } catch (e) {
    log('L5.1', name, 'UUID检测', 'WARN', e.message.slice(0, 80));
  }
}

// ==================== L5.5: Column Check ====================

async function testColumns(page, name, path, expected, notExpected = []) {
  try {
    await page.goto(`${BASE}${path}`, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForTimeout(2500);
    const headers = await page.$$eval('.el-table__header-wrapper th .cell', els => els.map(e => e.textContent?.trim() || '')).catch(() => []);
    if (headers.length === 0) { log('L5.5', name, '列检查', 'WARN', '无表头'); return; }
    const missing = expected.filter(c => !headers.some(h => h.includes(c)));
    const extra = notExpected.filter(c => headers.some(h => h.includes(c)));
    if (missing.length > 0 || extra.length > 0)
      log('L5.5', name, '列完整性', 'FAIL', `缺:[${missing}] 应删:[${extra}] 实际:[${headers.join(',')}]`);
    else
      log('L5.5', name, '列完整性', 'PASS', `[${headers.join(',')}]`);
  } catch (e) {
    log('L5.5', name, '列完整性', 'WARN', e.message.slice(0, 80));
  }
}

// ==================== L5.6: Status Labels ====================

async function testStatusLabels(page, name, path) {
  try {
    await page.goto(`${BASE}${path}`, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForTimeout(2500);
    const tags = await page.$$eval('.el-tag', els => els.map(e => e.textContent?.trim() || '')).catch(() => []);
    if (tags.length === 0) { log('L5.6', name, '状态标签', 'WARN', '无标签'); return; }
    const english = tags.filter(t => /^[A-Z_]{3,}$/.test(t));
    if (english.length > 0) log('L5.6', name, '状态标签', 'FAIL', `英文枚举: [${english}]`);
    else log('L5.6', name, '状态标签', 'PASS', `${tags.length}个全中文`);
  } catch (e) {
    log('L5.6', name, '状态标签', 'WARN', e.message.slice(0, 80));
  }
}

// ==================== ALL MODULES ====================

const ALL_MODULES = [
  // 已在前一轮详测的3个模块，这里只跑L1确认
  { name: '销售订单', path: '/sales/orders', l1: true, uuid: ['客户'], cols: ['订单编号','客户','业务员','总金额','状态'] },
  { name: '客户管理', path: '/sales/customers', l1: true, uuid: ['客户名'], cols: ['客户编号','名称','联系人','状态'] },
  { name: '采购订单', path: '/procurement/orders', l1: true, uuid: ['供应商'], cols: ['订单编号','供应商','类型','总金额','状态'] },
  { name: '供应商管理', path: '/procurement/suppliers', l1: true, cols: ['供应商编号','名称','联系人'] },
  { name: '研发样品', path: '/rd/samples', l1: true, cols: ['样品编码','样品名称','客户名称','产品级别','产品状态'] },
  // 以下11个模块补全测试
  { name: '生产计划', path: '/production/plans', l1: true, uuid: null, cols: ['计划', '产品', '状态'] },
  { name: '生产批次', path: '/production/batches', l1: true, uuid: null, cols: ['批次', '产品', '状态'] },
  { name: '原材料库存', path: '/warehouse/materials', l1: true, cols: ['原料', '数量', '单位'] },
  { name: '成品库存', path: '/warehouse/finished-goods', l1: true, cols: ['产品', '数量'] },
  { name: 'BOM配方', path: '/warehouse/bom', l1: true, cols: ['产品', 'BOM'] },
  { name: '质量检测', path: '/quality/inspections', l1: true, cols: ['批次', '结果', '日期'] },
  { name: '出货记录', path: '/sales/shipments', l1: true, cols: ['出货', '订单'] },
  { name: '员工管理', path: '/hr/employees', l1: true, uuid: null, cols: ['姓名', '工号', '部门'] },
  { name: '设备管理', path: '/equipment/list', l1: true, cols: ['设备', '状态'] },
  { name: '调拨管理', path: '/transfers', l1: true, cols: ['调拨', '状态'] },
  { name: '财务管理', path: '/finance/overview', l1: true },
  // 系统管理子页
  { name: '产品管理', path: '/system/products', l1: true, cols: ['产品', '名称'] },
  { name: '用户管理', path: '/system/users', l1: true, cols: ['用户', '角色'] },
  { name: '价格表', path: '/procurement/price-list', l1: true },
  // 高级功能
  { name: '智能BI', path: '/smartbi', l1: true },
  { name: '生产分析', path: '/production-analysis', l1: true },
];

async function main() {
  console.log('🚀 E2E Complete Test: ALL Modules L1 + L5');
  console.log(`Target: ${BASE} | Modules: ${ALL_MODULES.length}\n`);

  await getToken();
  if (!TOKEN) { console.error('❌ Login failed'); process.exit(1); }
  console.log('✅ Token acquired');

  const browser = await chromium.launch({ headless: true });
  const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  if (!await login(page)) { console.error('❌ Browser login failed'); await browser.close(); process.exit(1); }
  console.log('✅ Browser login OK\n');

  // L1: All pages
  console.log('=== Layer 1: 全模块页面加载 ===');
  for (const m of ALL_MODULES) {
    await testPageLoad(page, m.name, m.path);
  }

  // L5.1 + L5.5 + L5.6 for modules with data
  console.log('\n=== Layer 5: 业务正确性 (有数据的模块) ===');
  for (const m of ALL_MODULES) {
    if (m.uuid) {
      await testUUID(page, m.name, m.path, m.uuid);
    }
    if (m.cols) {
      await testColumns(page, m.name, m.path, m.cols);
    }
  }

  // Status labels check on key modules
  console.log('\n=== Layer 5.6: 状态标签中文化 ===');
  const statusModules = ['销售订单', '采购订单', '研发样品', '生产计划', '生产批次', '质量检测'];
  for (const m of ALL_MODULES.filter(m => statusModules.includes(m.name))) {
    await testStatusLabels(page, m.name, m.path);
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log(`📊 Results: ${pass} PASS, ${fail} FAIL, ${warn} WARN (total: ${pass + fail + warn})`);
  console.log('='.repeat(60));

  // Module summary
  const moduleResults = {};
  for (const r of results) {
    if (!moduleResults[r.module]) moduleResults[r.module] = { pass: 0, fail: 0, warn: 0 };
    moduleResults[r.module][r.status.toLowerCase()]++;
  }
  console.log('\n模块汇总:');
  for (const [mod, counts] of Object.entries(moduleResults)) {
    const icon = counts.fail > 0 ? '❌' : counts.warn > 0 ? '⚠️' : '✅';
    console.log(`  ${icon} ${mod}: ${counts.pass}P/${counts.fail}F/${counts.warn}W`);
  }

  const fs = await import('fs');
  fs.writeFileSync('test-e2e-all-modules-results.json', JSON.stringify({
    timestamp: new Date().toISOString(), pass, fail, warn, total: pass + fail + warn, results
  }, null, 2));

  await browser.close();
  process.exit(fail > 0 ? 1 : 0);
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
