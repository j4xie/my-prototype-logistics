/**
 * E2E Full Test: L1-L5 + Business Journeys
 * Modules: Sales, Procurement, R&D Samples
 * Target: Production Web-Admin (139.196.165.140:8086)
 */
import { chromium } from 'playwright';

const BASE = 'http://139.196.165.140:8086';
const API = 'http://47.100.235.168:10010/api/mobile';
const FACTORY = 'F001';
const USERNAME = 'factory_admin1';
const PASSWORD = '123456';
const TS = Date.now().toString().slice(-6);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ID_WHITELIST = ['编号', 'ID', 'code', '编码', '追踪码', '批次号', '工厂', 'factoryId', '参考号'];

let TOKEN = '';
const results = [];
let pass = 0, fail = 0, warn = 0;

function log(layer, module, test, status, evidence = '') {
  const icon = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : '⚠️';
  results.push({ layer, module, test, status, evidence });
  if (status === 'PASS') pass++; else if (status === 'FAIL') fail++; else warn++;
  console.log(`${icon} [${layer}] ${module} — ${test}${evidence ? '\n   ' + evidence : ''}`);
}

async function login(page) {
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(2000);
  await page.fill('input[placeholder*="用户名"]', USERNAME);
  await page.fill('input[placeholder*="密码"]', PASSWORD);
  await page.click('button:has-text("登 录")');
  await page.waitForTimeout(3000);
  if (page.url().includes('dashboard')) return true;
  // Try quick login button
  try {
    await page.click('button:has-text("工厂总监")', { timeout: 3000 });
    await page.waitForTimeout(500);
    await page.click('button:has-text("登 录")');
    await page.waitForTimeout(3000);
  } catch {}
  return page.url().includes('dashboard');
}

async function getToken() {
  const res = await fetch(`${API}/auth/unified-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: USERNAME, password: PASSWORD })
  });
  const data = await res.json();
  TOKEN = data.data?.accessToken || data.data?.token || '';
  return TOKEN;
}

async function api(path, opts = {}) {
  const res = await fetch(`${API}/${FACTORY}${path}`, {
    ...opts,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${TOKEN}`, ...(opts.headers || {}) },
  });
  return res.json();
}

// ==================== L1: Page Load ====================

async function testL1(page) {
  console.log('\n=== Layer 1: Page Load ===');
  const pages = [
    { path: '/sales/orders', name: '销售订单' },
    { path: '/sales/customers', name: '客户管理' },
    { path: '/procurement/orders', name: '采购订单' },
    { path: '/procurement/suppliers', name: '供应商管理' },
    { path: '/rd/samples', name: '研发样品' },
  ];
  for (const p of pages) {
    try {
      await page.goto(`${BASE}${p.path}`, { waitUntil: 'domcontentloaded', timeout: 20000 });
      await page.waitForTimeout(2000);
      const hasError = await page.locator('.el-message--error').isVisible().catch(() => false);
      const hasTable = await page.locator('.el-table').first().isVisible().catch(() => false);
      const hasCard = await page.locator('.el-card').first().isVisible().catch(() => false);
      if (hasError) {
        const errText = await page.locator('.el-message--error').textContent().catch(() => 'unknown');
        log('L1', p.name, '页面加载', 'FAIL', `error toast: ${errText}`);
      } else if (hasTable || hasCard) {
        log('L1', p.name, '页面加载', 'PASS', `table=${hasTable}, card=${hasCard}`);
      } else {
        log('L1', p.name, '页面加载', 'WARN', 'no table/card visible');
      }
    } catch (e) {
      log('L1', p.name, '页面加载', 'FAIL', e.message.slice(0, 100));
    }
  }
}

// ==================== L5.1: UUID Detection ====================

async function testUUIDDetection(page, module, path, checkColumns) {
  await page.goto(`${BASE}${path}`, { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForTimeout(2500);

  // Get all table cells
  const cells = await page.$$eval('.el-table__body-wrapper .el-table__row', (rows) => {
    return rows.slice(0, 5).map(row => {
      const cells = row.querySelectorAll('td .cell');
      return Array.from(cells).map(c => c.textContent?.trim() || '');
    });
  }).catch(() => []);

  // Get column headers
  const headers = await page.$$eval('.el-table__header-wrapper th .cell', els =>
    els.map(e => e.textContent?.trim() || '')
  ).catch(() => []);

  let uuidFound = [];
  for (let ri = 0; ri < cells.length; ri++) {
    for (let ci = 0; ci < cells[ri].length; ci++) {
      const header = headers[ci] || `col${ci}`;
      if (ID_WHITELIST.some(kw => header.includes(kw))) continue;
      if (checkColumns && !checkColumns.some(c => header.includes(c))) continue;
      if (UUID_RE.test(cells[ri][ci])) {
        uuidFound.push(`row${ri}/${header}="${cells[ri][ci].slice(0, 20)}..."`);
      }
    }
  }

  if (uuidFound.length > 0) {
    log('L5.1', module, 'UUID检测', 'FAIL', `发现UUID: ${uuidFound.join(', ')}`);
  } else {
    const checked = checkColumns ? checkColumns.join(',') : 'all';
    log('L5.1', module, 'UUID检测', 'PASS', `${cells.length}行×[${checked}]列, 0 UUID`);
  }
  return uuidFound.length === 0;
}

// ==================== L5.2: Non-Empty Field Check ====================

// Only check REQUIRED fields per module (not optional ones)
const REQUIRED_FIELDS = {
  '销售订单': ['客户', '订单编号', '下单日期', '总金额'],
  '采购订单': ['供应商', '订单编号', '下单日期'],
};

async function testNonEmpty(page, module, path) {
  await page.goto(`${BASE}${path}`, { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForTimeout(2500);

  const detailBtn = page.locator('button:has-text("详情")').first();
  const hasDetail = await detailBtn.isVisible().catch(() => false);
  if (!hasDetail) {
    log('L5.2', module, '非空检测', 'WARN', '无详情按钮可点击');
    return;
  }
  await detailBtn.click();
  await page.waitForTimeout(2000);

  // Get all description label-value pairs
  const items = await page.$$eval('.el-descriptions__body tr', rows => {
    const pairs = [];
    for (const row of rows) {
      const labels = row.querySelectorAll('.el-descriptions__label');
      const contents = row.querySelectorAll('.el-descriptions__content');
      for (let i = 0; i < labels.length; i++) {
        if (labels[i] && contents[i]) {
          pairs.push({ label: labels[i].textContent?.trim(), value: contents[i].textContent?.trim() });
        }
      }
    }
    return pairs;
  }).catch(() => []);

  // Only check required fields for this module
  const requiredList = REQUIRED_FIELDS[module] || [];
  const emptyRequired = [];
  for (const reqField of requiredList) {
    const found = items.find(i => i.label?.includes(reqField));
    if (found && (!found.value || found.value === '-' || found.value === '')) {
      emptyRequired.push(`${reqField}=空`);
    }
    // UUID check on required fields too
    if (found && UUID_RE.test(found.value || '')) {
      emptyRequired.push(`${reqField}=UUID!`);
    }
  }

  // Check first-column cells in item table for empty product/material names
  const nameColumn = await page.$$eval('.el-table__body-wrapper .el-table__row td:first-child .cell',
    els => els.map(e => e.textContent?.trim() || '')
  ).catch(() => []);
  const emptyNames = nameColumn.filter(v => !v || v === '-');

  if (emptyRequired.length > 0 || emptyNames.length > 0) {
    log('L5.2', module, '非空检测', 'FAIL',
      `必填空: [${emptyRequired.join(',')}]; 行项名空: ${emptyNames.length}个`);
  } else {
    const checkedValues = requiredList.map(f => {
      const it = items.find(i => i.label?.includes(f));
      return `${f}="${it?.value?.slice(0, 15) || '?'}"`;
    }).join(', ');
    log('L5.2', module, '非空检测', 'PASS', `${checkedValues}; ${nameColumn.length}行名称非空`);
  }

  await page.goBack();
  await page.waitForTimeout(1500);
}

// ==================== L5.5: Column Completeness ====================

async function testColumns(page, module, path, expectedColumns, notExpected = []) {
  await page.goto(`${BASE}${path}`, { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForTimeout(2500);

  const headers = await page.$$eval('.el-table__header-wrapper th .cell',
    els => els.map(e => e.textContent?.trim() || '')
  ).catch(() => []);

  const missing = expectedColumns.filter(col => !headers.some(h => h.includes(col)));
  const shouldNotExist = notExpected.filter(col => headers.some(h => h.includes(col)));

  if (missing.length > 0 || shouldNotExist.length > 0) {
    log('L5.5', module, '列完整性', 'FAIL',
      `缺: [${missing.join(',')}]; 应删: [${shouldNotExist.join(',')}]; 实际: [${headers.join(',')}]`);
  } else {
    log('L5.5', module, '列完整性', 'PASS', `期望${expectedColumns.length}列全在, 实际: [${headers.join(',')}]`);
  }
}

// ==================== L5.6: Status Label Check ====================

async function testStatusLabels(page, module, path) {
  await page.goto(`${BASE}${path}`, { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForTimeout(2500);

  const statuses = await page.$$eval('.el-tag',
    els => els.map(e => e.textContent?.trim() || '')
  ).catch(() => []);

  const englishEnums = statuses.filter(s => /^[A-Z_]{3,}$/.test(s));

  if (englishEnums.length > 0) {
    log('L5.6', module, '状态标签中文', 'FAIL', `英文枚举: [${englishEnums.join(',')}]`);
  } else {
    log('L5.6', module, '状态标签中文', 'PASS', `${statuses.length}个标签全中文: [${statuses.slice(0, 5).join(',')}...]`);
  }
}

// ==================== Preload test data ====================

let testCustomerId = '', testProductId = '', testSupplierId = '', testMaterialId = '', testMaterialName = '';

async function preloadTestData() {
  console.log('\n=== 前置数据准备 ===');
  try {
    // Use /active endpoints which don't have validation issues
    const custRes = await api('/customers/active');
    const customers = custRes.data || [];
    if (customers.length > 0) {
      testCustomerId = customers[0].id;
      console.log(`  客户: ${customers[0].name} (${testCustomerId.slice(0, 8)})`);
    } else {
      // Fallback: try paginated
      const custPage = await api('/customers?page=0&size=5&sort=createdAt,desc');
      const content = custPage.data?.content || [];
      if (content.length > 0) { testCustomerId = content[0].id; console.log(`  客户: ${content[0].name}`); }
      else console.log('  客户: NONE');
    }

    const prodRes = await api('/product-types/active');
    const products = prodRes.data || [];
    if (products.length > 0) {
      testProductId = products[0].id;
      console.log(`  产品: ${products[0].name} (${testProductId.slice(0, 8)})`);
    } else {
      console.log('  产品: NONE');
    }

    const suppRes = await api('/suppliers/active');
    const suppliers = suppRes.data || [];
    if (suppliers.length > 0) {
      testSupplierId = suppliers[0].id;
      console.log(`  供应商: ${suppliers[0].name} (${testSupplierId.slice(0, 8)})`);
    } else {
      console.log('  供应商: NONE');
    }

    const matRes = await api('/raw-material-types/active');
    const materials = matRes.data || [];
    if (materials.length > 0) {
      testMaterialId = materials[0].id;
      testMaterialName = materials[0].name;
      console.log(`  原料: ${testMaterialName} (${testMaterialId.slice(0, 8)})`);
    } else {
      console.log('  原料: NONE');
    }
  } catch (e) {
    console.log(`  ⚠️ 部分数据加载失败: ${e.message}`);
  }
}

// ==================== L2+L5: Sales Order CRUD + Journey A ====================

async function testSalesJourney(page) {
  console.log('\n=== Journey A: 销售订单全链路 ===');

  // L5.1 UUID check on list
  await testUUIDDetection(page, '销售订单', '/sales/orders', ['客户']);

  // L5.5 Column check
  await testColumns(page, '销售订单列表', '/sales/orders',
    ['订单编号', '客户', '业务员', '下单日期', '总金额', '状态']);

  // L5.6 Status labels
  await testStatusLabels(page, '销售订单', '/sales/orders');

  // L5.2 Non-empty check on detail (only required fields)
  await testNonEmpty(page, '销售订单', '/sales/orders');

  // L2 CRUD: Create via API + verify on UI
  console.log('\n--- L2: 销售订单创建 ---');
  try {
    if (!testCustomerId || !testProductId) throw new Error('缺前置数据: customer或product');

    const createRes = await api('/sales/orders', {
      method: 'POST',
      body: JSON.stringify({
        customerId: testCustomerId,
        salesperson: `E2E测试员${TS}`,
        items: [{ productTypeId: testProductId, quantity: 10, unit: 'kg', unitPrice: 50 }]
      })
    });

    if (createRes.success) {
      const soNum = createRes.data?.orderNumber;
      log('L2', '销售订单', '创建(API)', 'PASS', `订单号=${soNum}, 金额=${createRes.data?.totalAmount}`);

      // Verify on UI: refresh list → find order → check customer name not UUID
      await page.goto(`${BASE}/sales/orders`, { waitUntil: 'domcontentloaded', timeout: 20000 });
      await page.waitForTimeout(2500);
      const firstRow = await page.$eval('.el-table__body-wrapper .el-table__row:first-child',
        row => Array.from(row.querySelectorAll('td .cell')).map(c => c.textContent?.trim())
      ).catch(() => []);
      const customerCol = firstRow[1] || '';
      if (UUID_RE.test(customerCol)) {
        log('L5.1', '销售订单', '创建后客户名', 'FAIL', `UUID: ${customerCol}`);
      } else {
        log('L5.1', '销售订单', '创建后客户名', 'PASS', `客户="${customerCol}"`);
      }

      // Click detail → verify spec/box columns exist
      await page.click('button:has-text("详情")', { timeout: 5000 });
      await page.waitForTimeout(2000);
      const itemHeaders = await page.$$eval('.el-table__header-wrapper th .cell',
        els => els.map(e => e.textContent?.trim() || '')
      ).catch(() => []);
      const hasSpec = itemHeaders.some(h => h.includes('规格'));
      const hasBox = itemHeaders.some(h => h.includes('箱数'));
      log('L5.5', '销售行项目', '规格+箱数列', hasSpec && hasBox ? 'PASS' : 'FAIL',
        `规格=${hasSpec}, 箱数=${hasBox}`);
      await page.goBack().catch(() => {});
      await page.waitForTimeout(1000);
    } else {
      log('L2', '销售订单', '创建(API)', 'FAIL', `error: ${createRes.message}`);
    }
  } catch (e) {
    log('L2', '销售订单', '创建', 'FAIL', e.message.slice(0, 120));
  }

  // L5.3A: SKU duplicate test — same productTypeId twice in one order
  console.log('\n--- L5.3A: SKU去重 ---');
  try {
    if (!testCustomerId || !testProductId) throw new Error('缺前置数据');
    const dupRes = await api('/sales/orders', {
      method: 'POST',
      body: JSON.stringify({
        customerId: testCustomerId,
        items: [
          { productTypeId: testProductId, quantity: 1, unit: 'kg', unitPrice: 10 },
          { productTypeId: testProductId, quantity: 2, unit: 'kg', unitPrice: 20 }
        ]
      })
    });
    if (!dupRes.success && dupRes.message?.includes('重复')) {
      log('L5.3A', '销售订单', 'SKU去重', 'PASS', `被拒: ${dupRes.message}`);
    } else if (dupRes.success) {
      log('L5.3A', '销售订单', 'SKU去重', 'FAIL', 'DUPLICATE_BUG: 重复SKU创建成功!');
    } else {
      log('L5.3A', '销售订单', 'SKU去重', 'WARN', `非预期错误: ${dupRes.message?.slice(0, 80)}`);
    }
  } catch (e) {
    log('L5.3A', '销售订单', 'SKU去重', 'WARN', e.message.slice(0, 100));
  }
}

// ==================== L2+L5: Purchase Order CRUD + Journey B ====================

async function testPurchaseJourney(page) {
  console.log('\n=== Journey B: 采购订单全链路 ===');

  // L5.1 UUID check
  await testUUIDDetection(page, '采购订单', '/procurement/orders', ['供应商']);

  // L5.5 Column check
  await testColumns(page, '采购订单列表', '/procurement/orders',
    ['订单编号', '供应商', '类型', '下单日期', '总金额', '状态']);

  // L5.6 Status labels
  await testStatusLabels(page, '采购订单', '/procurement/orders');

  // L5.2 Non-empty on detail (check material names)
  await testNonEmpty(page, '采购订单', '/procurement/orders');

  // L5.3B + L5.9: Create two POs consecutively, verify both succeed with incrementing numbers
  console.log('\n--- L5.3B+5.9: 连续创建+订单号递增 ---');
  try {
    if (!testSupplierId || !testMaterialId) {
      log('L5.3B', '采购订单', '连续创建', 'WARN', `缺前置数据: supplier=${!!testSupplierId}, material=${!!testMaterialId}`);
    } else {
      const supplierId = testSupplierId;
      const materialId = testMaterialId;
      const materialName = testMaterialName;
      const po1 = await api('/purchase/orders', {
        method: 'POST',
        body: JSON.stringify({
          supplierId, purchaseType: 'DIRECT', orderDate: new Date().toISOString().slice(0, 10),
          items: [{ materialTypeId: materialId, materialName, quantity: 5, unit: 'kg', unitPrice: 10 }]
        })
      });

      const po2 = await api('/purchase/orders', {
        method: 'POST',
        body: JSON.stringify({
          supplierId, purchaseType: 'DIRECT', orderDate: new Date().toISOString().slice(0, 10),
          items: [{ materialTypeId: materialId, materialName, quantity: 3, unit: 'kg', unitPrice: 8 }]
        })
      });

      if (po1.success && po2.success) {
        const num1 = po1.data?.orderNumber;
        const num2 = po2.data?.orderNumber;
        log('L5.3B', '采购订单', '连续创建', 'PASS', `PO#1=${num1}, PO#2=${num2}`);

        // L5.9: Order number monotonicity
        if (num1 && num2) {
          const seq1 = parseInt(num1.split('-').pop());
          const seq2 = parseInt(num2.split('-').pop());
          if (seq2 > seq1) {
            log('L5.9', '采购订单', '订单号递增', 'PASS', `${seq1} → ${seq2}`);
          } else {
            log('L5.9', '采购订单', '订单号递增', 'FAIL', `ORDER_NUMBER_BUG: ${seq1} → ${seq2}`);
          }
        }
      } else {
        const err = !po1.success ? po1.message : po2.message;
        log('L5.3B', '采购订单', '连续创建', 'FAIL', `RACE_CONDITION_BUG: ${err}`);
      }
    }
  } catch (e) {
    log('L5.3B', '采购订单', '连续创建', 'FAIL', e.message.slice(0, 120));
  }

  // Check detail page for spec+box columns
  await page.goto(`${BASE}/procurement/orders`, { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForTimeout(2000);
  try {
    await page.click('button:has-text("详情")', { timeout: 5000 });
    await page.waitForTimeout(2000);
    const detailHeaders = await page.$$eval('.el-table__header-wrapper th .cell',
      els => els.map(e => e.textContent?.trim() || '')
    ).catch(() => []);
    const hasSpec = detailHeaders.some(h => h.includes('规格'));
    const hasBox = detailHeaders.some(h => h.includes('箱数'));
    log('L5.5', '采购行项目', '规格+箱数列', hasSpec && hasBox ? 'PASS' : 'FAIL',
      `规格=${hasSpec}, 箱数=${hasBox}, 实际: [${detailHeaders.join(',')}]`);
    await page.goBack();
    await page.waitForTimeout(1500);
  } catch (e) {
    log('L5.5', '采购行项目', '规格+箱数列', 'WARN', e.message.slice(0, 80));
  }
}

// ==================== L2+L5: R&D Sample + Journey C ====================

async function testRdJourney(page) {
  console.log('\n=== Journey C: 研发样品全链路 ===');

  // L5.5 Column check — expect new columns, no old ones
  await testColumns(page, '研发样品列表', '/rd/samples',
    ['样品编码', '样品名称', '客户名称', '产品级别', '业务员', '储存方式', '产品状态'],
    ['主原料', '等级']  // should NOT exist
  );

  // L5.6 Status labels
  await testStatusLabels(page, '研发样品', '/rd/samples');

  // L5.10: Search/filter
  console.log('\n--- L5.10: 搜索筛选 ---');
  await page.goto(`${BASE}/rd/samples`, { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForTimeout(2500);
  try {
    // Check search bar exists
    const hasNameSearch = await page.locator('input[placeholder*="样品名称"]').isVisible().catch(() => false);
    const hasCustomerSearch = await page.locator('input[placeholder*="客户"]').isVisible().catch(() => false);
    const hasStatusFilter = await page.locator('.el-select').first().isVisible().catch(() => false);

    if (hasNameSearch && hasCustomerSearch && hasStatusFilter) {
      log('L5.10', '研发样品', '搜索栏存在', 'PASS', `名称=${hasNameSearch}, 客户=${hasCustomerSearch}, 状态=${hasStatusFilter}`);
    } else {
      log('L5.10', '研发样品', '搜索栏存在', 'FAIL', `名称=${hasNameSearch}, 客户=${hasCustomerSearch}, 状态=${hasStatusFilter}`);
    }
  } catch (e) {
    log('L5.10', '研发样品', '搜索栏', 'FAIL', e.message.slice(0, 80));
  }

  // L5.4: Field type validation — check new sample form
  console.log('\n--- L5.4: 字段类型校验 ---');
  try {
    await page.click('button:has-text("新建样品")', { timeout: 5000 });
    await page.waitForTimeout(1500);

    // Check that 产品级别 is a select (el-select), not text input
    const formHTML = await page.locator('.el-dialog').innerHTML().catch(() => '');
    const hasProductLevelSelect = formHTML.includes('产品级别') && formHTML.includes('el-select');
    const hasStorageSelect = formHTML.includes('储存方式') && formHTML.includes('el-select');

    if (hasProductLevelSelect) {
      log('L5.4', '研发样品', '产品级别=下拉', 'PASS', 'el-select found');
    } else {
      log('L5.4', '研发样品', '产品级别=下拉', 'FAIL', 'WRONG_FIELD_TYPE: not el-select');
    }
    if (hasStorageSelect) {
      log('L5.4', '研发样品', '储存方式=下拉', 'PASS', 'el-select found');
    } else {
      log('L5.4', '研发样品', '储存方式=下拉', 'FAIL', 'WRONG_FIELD_TYPE: not el-select');
    }

    // L2: Create sample via API (reliable) then verify on UI
    await page.keyboard.press('Escape'); // close dialog
    await page.waitForTimeout(500);

    const sampleRes = await api('/rd/samples', {
      method: 'POST',
      body: JSON.stringify({
        name: `E2E样品${TS}`,
        customerName: `测试客户${TS}`,
        specification: '200g/盒',
        productLevel: 'A',
        storageMethod: '冷冻',
        salesperson: `E2E测试员`,
      })
    });

    if (sampleRes.success) {
      log('L2', '研发样品', '创建(API)', 'PASS',
        `名称=E2E样品${TS}, 客户=测试客户${TS}, 级别=A, 储存=冷冻`);

      // Verify on UI
      await page.goto(`${BASE}/rd/samples`, { waitUntil: 'domcontentloaded', timeout: 20000 });
      await page.waitForTimeout(2500);
      const firstRowText = await page.$eval('.el-table__body-wrapper .el-table__row:first-child',
        row => row.textContent?.trim() || ''
      ).catch(() => '');
      if (firstRowText.includes(`E2E样品${TS}`)) {
        log('L2', '研发样品', 'UI列表验证', 'PASS', `列表首行包含 E2E样品${TS}`);
      } else {
        log('L2', '研发样品', 'UI列表验证', 'WARN', `首行不含新样品(可能排序不同)`);
      }
    } else {
      log('L2', '研发样品', '创建(API)', 'FAIL', `error: ${sampleRes.message}`);
    }
  } catch (e) {
    log('L2', '研发样品', '创建/字段检查', 'FAIL', e.message.slice(0, 120));
  }

  // L5.11: Conditional button check
  console.log('\n--- L5.11: 条件按钮显隐 ---');
  await page.goto(`${BASE}/rd/samples`, { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForTimeout(2500);
  try {
    const rows = await page.$$('.el-table__body-wrapper .el-table__row');
    let checkedInProgress = false, checkedApproved = false;

    for (const row of rows.slice(0, 8)) {
      const status = await row.$eval('.el-tag', el => el.textContent?.trim()).catch(() => '');
      const buttons = await row.$$eval('button', els => els.map(e => e.textContent?.trim())).catch(() => []);

      if (status === '研发中' && !checkedInProgress) {
        const hasQuote = buttons.some(b => b?.includes('报价'));
        if (!hasQuote) {
          log('L5.11', '研发样品', '研发中→无报价按钮', 'PASS', `buttons: [${buttons.join(',')}]`);
        } else {
          log('L5.11', '研发样品', '研发中→无报价按钮', 'FAIL', `BUTTON_VISIBILITY_BUG: 不应有报价`);
        }
        checkedInProgress = true;
      }
      if ((status === '样品通过' || status === '已通过') && !checkedApproved) {
        const hasQuote = buttons.some(b => b?.includes('报价'));
        if (hasQuote) {
          log('L5.11', '研发样品', '样品通过→有报价按钮', 'PASS', `buttons: [${buttons.join(',')}]`);
        } else {
          log('L5.11', '研发样品', '样品通过→有报价按钮', 'FAIL', `MISSING_ACTION_BUTTON`);
        }
        checkedApproved = true;
      }
    }
    if (!checkedInProgress) log('L5.11', '研发样品', '研发中按钮', 'WARN', '未找到研发中状态的行');
    if (!checkedApproved) log('L5.11', '研发样品', '样品通过按钮', 'WARN', '未找到样品通过状态的行');
  } catch (e) {
    log('L5.11', '研发样品', '条件按钮', 'FAIL', e.message.slice(0, 100));
  }
}

// ==================== Main ====================

async function main() {
  console.log('🚀 E2E Full Test: L1-L5 + Journeys A/B/C');
  console.log(`Target: ${BASE} | API: ${API} | Factory: ${FACTORY}\n`);

  await getToken();
  if (!TOKEN) { console.error('❌ Login failed - no token'); process.exit(1); }
  console.log('✅ API token acquired');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  const loggedIn = await login(page);
  if (!loggedIn) { console.error('❌ Browser login failed'); await browser.close(); process.exit(1); }
  console.log('✅ Browser login OK');

  // Preload test data
  await preloadTestData();

  // L1: Page loads
  await testL1(page);

  // Journey A: Sales
  await testSalesJourney(page);

  // Journey B: Procurement
  await testPurchaseJourney(page);

  // Journey C: R&D Samples
  await testRdJourney(page);

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log(`📊 Results: ${pass} PASS, ${fail} FAIL, ${warn} WARN (total: ${pass + fail + warn})`);
  console.log('='.repeat(60));

  // Write results
  const fs = await import('fs');
  fs.writeFileSync('test-e2e-l5-results.json', JSON.stringify({
    timestamp: new Date().toISOString(), pass, fail, warn, total: pass + fail + warn, results
  }, null, 2));

  await browser.close();
  process.exit(fail > 0 ? 1 : 0);
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
