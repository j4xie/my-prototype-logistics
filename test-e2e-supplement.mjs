/**
 * E2E Supplement: L2 Edit/Delete + L3 Cross-Module + L4 Workflows + Multi-Role
 * Fills all gaps from the main test
 */
import { chromium } from 'playwright';

const BASE = 'http://139.196.165.140:8086';
const API = 'http://47.100.235.168:10010/api/mobile';
const FACTORY = 'F001';
const TS = Date.now().toString().slice(-6);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

let TOKEN = '';
let pass = 0, fail = 0, warn = 0;
const results = [];

function log(layer, mod, test, status, ev = '') {
  const ic = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : '⚠️';
  results.push({ layer, module: mod, test, status, evidence: ev });
  if (status === 'PASS') pass++; else if (status === 'FAIL') fail++; else warn++;
  console.log(`${ic} [${layer}] ${mod} — ${test}${ev ? '\n   ' + ev.slice(0, 200) : ''}`);
}

async function getToken() {
  const r = await fetch(`${API}/auth/unified-login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'factory_admin1', password: '123456' })
  });
  TOKEN = (await r.json()).data?.accessToken || '';
}

async function api(path, opts = {}) {
  const r = await fetch(`${API}/${FACTORY}${path}`, {
    ...opts, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${TOKEN}`, ...(opts.headers || {}) }
  });
  return r.json();
}

async function loginAs(page, username) {
  try {
    // If already on a non-login page and same user requested, skip
    if (page.url().startsWith(BASE) && !page.url().includes('/login')) {
      const currentUser = await page.evaluate(() => {
        const u = localStorage.getItem('cretas_user');
        return u ? JSON.parse(u).username : null;
      }).catch(() => null);
      if (currentUser === username) { return true; } // already logged in as this user
      // Different user: clear and re-login
      await page.evaluate(() => {
        localStorage.removeItem('cretas_access_token');
        localStorage.removeItem('cretas_user');
      });
    }
    await page.goto(`${BASE}/login`, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(3000);

    // Verify login form is actually rendered
    const hasForm = await page.locator('input[placeholder*="用户名"]').isVisible({ timeout: 8000 }).catch(() => false);
    if (!hasForm) {
      // Page might have auto-redirected to dashboard (still has valid session)
      if (!page.url().includes('/login')) return true;
      console.log(`  ⚠ login form not rendered for ${username}`);
      return false;
    }

    // Quick button mapping
    const quickMap = {
      'factory_admin1': '工厂总监', 'hr_admin1': '人事经理',
      'finance_mgr1': '财务经理', 'warehouse_mgr1': '仓储经理',
      'dispatcher1': '调度', 'visitor1': '访客'
    };

    // Click quick button (sets username + password automatically)
    const qb = quickMap[username];
    if (qb) {
      const btn = page.locator(`button:has-text("${qb}")`);
      const vis = await btn.isVisible({ timeout: 3000 }).catch(() => false);
      if (vis) {
        await btn.click();
        await page.waitForTimeout(800);
      }
      console.log(`  quick btn "${qb}": visible=${vis}`);
    }

    // Check what's in the input fields now
    const uVal = await page.locator('input[placeholder*="用户名"]').inputValue().catch(() => '?');
    const pVal = await page.locator('input[placeholder*="密码"]').inputValue().catch(() => '?');
    console.log(`  fields: user="${uVal}", pass="${pVal ? '***' : 'empty'}"`);

    // For users not in quick buttons or if quick didn't fill, manually fill
    if (!qb || !uVal) {
      await page.locator('input[placeholder*="用户名"]').fill(username);
      await page.locator('input[placeholder*="密码"]').fill('123456');
    }

    // Click login button and monitor response
    const [response] = await Promise.all([
      page.waitForResponse(r => r.url().includes('login') || r.url().includes('auth'), { timeout: 10000 }).catch(() => null),
      page.locator('button:has-text("登 录")').click(),
    ]);
    if (response) {
      const body = await response.json().catch(() => ({}));
      console.log(`  API response: ${response.status()} success=${body.success} msg=${(body.message || '').slice(0, 40)}`);
    } else {
      console.log(`  no API response captured`);
    }

    await page.waitForURL(u => !u.includes('/login'), { timeout: 8000 }).catch(() => {});
    await page.waitForTimeout(2000);

    return !page.url().includes('/login');
  } catch (e) {
    console.log(`  login error ${username}: ${e.message.slice(0, 60)}`);
    return false;
  }
}

async function go(page, path) {
  await page.goto(`${BASE}${path}`, { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForTimeout(2500);
}

// ==================== L2: Edit Operations ====================

async function testEditOperations(page) {
  console.log('\n=== L2: 编辑操作 ===');

  // Sales Order Edit — find a DRAFT order and edit it
  await go(page, '/sales/orders');
  const editBtn = page.locator('.el-table__body-wrapper .el-table__row').filter({ hasText: '草稿' }).first().locator('button:has-text("编辑")');
  if (await editBtn.isVisible().catch(() => false)) {
    await editBtn.click();
    await page.waitForTimeout(1500);
    // Check dialog opened
    const dialog = page.locator('.el-dialog:visible, .el-drawer:visible');
    if (await dialog.isVisible().catch(() => false)) {
      // Modify remark
      const remarkInput = dialog.locator('textarea, input[placeholder*="备注"]').first();
      if (await remarkInput.isVisible().catch(() => false)) {
        await remarkInput.fill(`E2E编辑测试${TS}`);
      }
      // Save
      const saveBtn = dialog.locator('button:has-text("保存"), button:has-text("确定")').last();
      if (await saveBtn.isVisible().catch(() => false)) { await saveBtn.click(); await page.waitForTimeout(2500); }
      const ok = await page.locator('.el-message--success').isVisible().catch(() => false);
      const gone = !await dialog.isVisible().catch(() => true);
      log('L2', '销售订单', '编辑', ok || gone ? 'PASS' : 'FAIL', ok ? '保存成功' : (gone ? 'dialog关闭' : 'dialog仍开'));
    } else { log('L2', '销售订单', '编辑', 'FAIL', '编辑弹窗未打开'); }
  } else { log('L2', '销售订单', '编辑', 'WARN', '无草稿状态订单可编辑'); }

  // Customer Edit — click first "编辑" button
  await go(page, '/sales/customers');
  const custEditBtn = page.locator('button:has-text("编辑")').first();
  if (await custEditBtn.isVisible().catch(() => false)) {
    await custEditBtn.click();
    await page.waitForTimeout(1500);
    const dialog = page.locator('.el-dialog:visible');
    const hasForm = await dialog.locator('input, textarea').count().catch(() => 0);
    log('L2', '客户管理', '编辑弹窗', hasForm > 0 ? 'PASS' : 'FAIL', `${hasForm}个表单字段`);
    await page.keyboard.press('Escape'); await page.waitForTimeout(500);
  } else { log('L2', '客户管理', '编辑', 'WARN', '无编辑按钮'); }

  // Employee Edit
  await go(page, '/hr/employees');
  const empEditBtn = page.locator('button:has-text("编辑")').first();
  if (await empEditBtn.isVisible().catch(() => false)) {
    await empEditBtn.click(); await page.waitForTimeout(1500);
    const hasForm = await page.locator('.el-dialog:visible input').count().catch(() => 0);
    log('L2', '员工管理', '编辑弹窗', hasForm > 0 ? 'PASS' : 'FAIL', `${hasForm}个字段`);
    await page.keyboard.press('Escape'); await page.waitForTimeout(500);
  } else { log('L2', '员工管理', '编辑', 'WARN', '无编辑按钮'); }

  // Product Edit
  await go(page, '/system/products');
  const prodEditBtn = page.locator('button:has-text("编辑")').first();
  if (await prodEditBtn.isVisible().catch(() => false)) {
    await prodEditBtn.click(); await page.waitForTimeout(1500);
    const hasForm = await page.locator('.el-dialog:visible input, .el-drawer:visible input').count().catch(() => 0);
    log('L2', '产品管理', '编辑弹窗', hasForm > 0 ? 'PASS' : 'FAIL', `${hasForm}个字段`);
    await page.keyboard.press('Escape'); await page.waitForTimeout(500);
  } else { log('L2', '产品管理', '编辑', 'WARN', '无编辑按钮'); }
}

// ==================== L2: Cancel/Delete Operations ====================

async function testCancelDelete(page) {
  console.log('\n=== L2: 取消/删除操作 ===');

  // Create a draft SO, then cancel it
  const custs = await api('/customers/active');
  const prods = await api('/product-types/active');
  const cid = custs.data?.[0]?.id, pid = prods.data?.[0]?.id;

  if (cid && pid) {
    const so = await api('/sales/orders', { method: 'POST', body: JSON.stringify({
      customerId: cid, items: [{ productTypeId: pid, quantity: 1, unit: 'kg', unitPrice: 1 }]
    })});
    if (so.success) {
      const soId = so.data?.id;
      // Cancel via API
      const cancel = await api(`/sales/orders/${soId}/cancel`, { method: 'POST' });
      log('L2', '销售订单', '取消', cancel.success ? 'PASS' : 'FAIL',
        cancel.success ? `${so.data.orderNumber} 已取消` : cancel.message);

      // Verify on UI — status should show 已取消
      await go(page, '/sales/orders');
      const bodyText = await page.locator('.el-table__body-wrapper').textContent().catch(() => '');
      log('L2', '销售订单', '取消后UI验证', bodyText.includes('已取消') ? 'PASS' : 'WARN', '列表含"已取消"');
    }
  } else { log('L2', '销售订单', '取消', 'WARN', '缺前置数据'); }

  // Customer: try toggle status (停用/启用)
  await go(page, '/sales/customers');
  const toggleBtn = page.locator('button:has-text("停用"), button:has-text("启用")').first();
  if (await toggleBtn.isVisible().catch(() => false)) {
    const btnText = await toggleBtn.textContent();
    log('L2', '客户管理', '停用/启用按钮', 'PASS', `可操作: "${btnText?.trim()}"`);
  } else { log('L2', '客户管理', '停用/启用', 'WARN', '无状态切换按钮'); }
}

// ==================== L3: Cross-Module Data Consistency ====================

async function testCrossModule(page) {
  console.log('\n=== L3: 跨模块数据一致性 ===');

  // Test 1: Customer created → appears in Sales Order dropdown
  const custName = `L3测试客户${TS}`;
  const custR = await api('/customers', { method: 'POST', body: JSON.stringify({
    name: custName, contactPerson: 'L3联系人', phone: '13900000001', shippingAddress: 'L3地址'
  })});

  if (custR.success) {
    await go(page, '/sales/orders');
    const newBtn = page.locator('button:has-text("新建销售订单")');
    if (await newBtn.isVisible().catch(() => false)) {
      await newBtn.click(); await page.waitForTimeout(1500);
      // Open customer dropdown
      const selects = page.locator('.el-dialog:visible .el-select');
      const custSelect = selects.first();
      await custSelect.click(); await page.waitForTimeout(800);
      // Search for the new customer
      const input = page.locator('.el-select-dropdown:visible input, .el-dialog:visible .el-select .el-input__inner').first();
      if (await input.isVisible().catch(() => false)) {
        await input.fill(custName.slice(0, 6)); await page.waitForTimeout(800);
      }
      const dropdownText = await page.locator('.el-select-dropdown:visible').textContent().catch(() => '');
      const found = dropdownText.includes(custName);
      log('L3', '客户→销售订单', '下拉可选', found ? 'PASS' : 'WARN',
        found ? `"${custName}" 在下拉中` : `下拉内容: ${dropdownText.slice(0, 60)}`);
      await page.keyboard.press('Escape'); await page.waitForTimeout(500);
      await page.keyboard.press('Escape'); await page.waitForTimeout(500);
    }
  } else { log('L3', '客户→销售订单', '创建客户', 'FAIL', custR.message); }

  // Test 2: Supplier → Purchase Order dropdown
  await go(page, '/procurement/orders');
  const poNewBtn = page.locator('button:has-text("新建采购订单")');
  if (await poNewBtn.isVisible().catch(() => false)) {
    await poNewBtn.click(); await page.waitForTimeout(1500);
    const suppSelect = page.locator('.el-dialog:visible .el-select').first();
    await suppSelect.click(); await page.waitForTimeout(800);
    const options = await page.$$eval('.el-select-dropdown:visible .el-select-dropdown__item',
      els => els.map(e => e.textContent?.trim())).catch(() => []);
    const hasSupplier = options.length > 0 && !options.some(o => UUID_RE.test(o));
    log('L3', '供应商→采购订单', '下拉列表', hasSupplier ? 'PASS' : 'FAIL',
      `${options.length}个选项: [${options.slice(0, 3).join(',')}]${options.some(o => UUID_RE.test(o)) ? ' ⚠️有UUID' : ''}`);
    await page.keyboard.press('Escape'); await page.waitForTimeout(500);
    await page.keyboard.press('Escape'); await page.waitForTimeout(500);
  }

  // Test 3: Product → Sales Order item dropdown
  await go(page, '/sales/orders');
  if (await page.locator('button:has-text("新建销售订单")').isVisible().catch(() => false)) {
    await page.click('button:has-text("新建销售订单")'); await page.waitForTimeout(1500);
    // Find product select in items area (usually 3rd select)
    const selects = page.locator('.el-dialog:visible .el-select');
    const count = await selects.count();
    if (count >= 3) {
      await selects.nth(2).click(); await page.waitForTimeout(800);
      const prodOptions = await page.$$eval('.el-select-dropdown:visible .el-select-dropdown__item',
        els => els.map(e => e.textContent?.trim())).catch(() => []);
      log('L3', '产品→销售订单', '商品下拉', prodOptions.length > 0 ? 'PASS' : 'FAIL',
        `${prodOptions.length}个: [${prodOptions.slice(0, 3).join(',')}]`);
    }
    await page.keyboard.press('Escape'); await page.waitForTimeout(500);
    await page.keyboard.press('Escape'); await page.waitForTimeout(500);
  }

  // Test 4: Material → Purchase Order item dropdown
  await go(page, '/procurement/orders');
  if (await page.locator('button:has-text("新建采购订单")').isVisible().catch(() => false)) {
    await page.click('button:has-text("新建采购订单")'); await page.waitForTimeout(1500);
    // Material select is usually in the items section
    const matSelect = page.locator('.el-dialog:visible .el-select').last();
    await matSelect.click(); await page.waitForTimeout(800);
    const matOptions = await page.$$eval('.el-select-dropdown:visible .el-select-dropdown__item',
      els => els.map(e => e.textContent?.trim())).catch(() => []);
    log('L3', '原料→采购订单', '原料下拉', matOptions.length > 0 ? 'PASS' : 'FAIL',
      `${matOptions.length}个: [${matOptions.slice(0, 3).join(',')}]`);
    await page.keyboard.press('Escape'); await page.waitForTimeout(500);
    await page.keyboard.press('Escape'); await page.waitForTimeout(500);
  }
}

// ==================== L4: Business Workflow Chains ====================

async function testWorkflows(page) {
  console.log('\n=== L4: 业务链路 ===');

  // Workflow A: Sales Order → Confirm → status changes
  console.log('\n--- 链路A: 销售订单确认 ---');
  const custs = await api('/customers/active');
  const prods = await api('/product-types/active');
  const cid = custs.data?.[0]?.id, pid = prods.data?.[0]?.id;

  if (cid && pid) {
    // Create
    const so = await api('/sales/orders', { method: 'POST', body: JSON.stringify({
      customerId: cid, salesperson: `L4${TS}`,
      items: [{ productTypeId: pid, quantity: 5, unit: 'kg', unitPrice: 100 }]
    })});
    if (so.success) {
      log('L4', '销售链路', '1.创建订单', 'PASS', `${so.data.orderNumber} 状态=${so.data.status}`);

      // Confirm
      const confirm = await api(`/sales/orders/${so.data.id}/confirm`, { method: 'POST' });
      log('L4', '销售链路', '2.确认订单', confirm.success ? 'PASS' : 'FAIL',
        confirm.success ? `状态→${confirm.data?.status}` : confirm.message);

      // Verify on UI
      await go(page, '/sales/orders');
      const row = await page.$$eval('.el-table__body-wrapper .el-table__row', (rows, num) => {
        for (const r of rows) {
          if (r.textContent?.includes(num)) {
            return { text: r.textContent?.trim().slice(0, 100), found: true };
          }
        }
        return { found: false };
      }, so.data.orderNumber).catch(() => ({ found: false }));

      if (row.found) {
        const hasConfirmed = row.text?.includes('已确认') || row.text?.includes('财务');
        log('L4', '销售链路', '3.UI状态验证', hasConfirmed ? 'PASS' : 'WARN', row.text?.slice(0, 80));
      } else {
        log('L4', '销售链路', '3.UI验证', 'WARN', '未找到订单行');
      }
    }
  } else { log('L4', '销售链路', '创建', 'WARN', '缺前置数据'); }

  // Workflow B: Purchase Order → Approve → status changes
  console.log('\n--- 链路B: 采购订单审批 ---');
  const supps = await api('/suppliers/active');
  const mats = await api('/raw-material-types/active');
  const sid = supps.data?.[0]?.id, mid = mats.data?.[0]?.id, mn = mats.data?.[0]?.name;

  if (sid && mid) {
    const po = await api('/purchase/orders', { method: 'POST', body: JSON.stringify({
      supplierId: sid, purchaseType: 'DIRECT', orderDate: new Date().toISOString().slice(0, 10),
      items: [{ materialTypeId: mid, materialName: mn, quantity: 10, unit: 'kg', unitPrice: 20 }]
    })});
    if (po.success) {
      log('L4', '采购链路', '1.创建订单', 'PASS', `${po.data.orderNumber} 状态=${po.data.status}`);

      // Submit for approval
      const submit = await api(`/purchase/orders/${po.data.id}/submit`, { method: 'POST' });
      log('L4', '采购链路', '2.提交审批', submit.success ? 'PASS' : 'FAIL',
        submit.success ? `状态→${submit.data?.status}` : submit.message);

      // Approve
      if (submit.success) {
        const approve = await api(`/purchase/orders/${po.data.id}/approve`, { method: 'POST' });
        log('L4', '采购链路', '3.审批通过', approve.success ? 'PASS' : 'FAIL',
          approve.success ? `状态→${approve.data?.status}` : approve.message);
      }

      // Verify on UI
      await go(page, '/procurement/orders');
      const poRow = await page.$$eval('.el-table__body-wrapper .el-table__row', (rows, num) => {
        for (const r of rows) {
          if (r.textContent?.includes(num)) return r.textContent?.trim().slice(0, 80);
        }
        return '';
      }, po.data.orderNumber).catch(() => '');
      log('L4', '采购链路', '4.UI验证', poRow ? 'PASS' : 'WARN', poRow || '未找到');
    }
  } else { log('L4', '采购链路', '创建', 'WARN', '缺前置数据'); }

  // Workflow C: R&D Sample → Submit → Approve
  console.log('\n--- 链路C: 研发样品审批 ---');
  const sample = await api('/rd/samples', { method: 'POST', body: JSON.stringify({
    name: `L4样品${TS}`, specification: '500g', productLevel: 'A', storageMethod: '冷冻'
  })});
  if (sample.success) {
    log('L4', '研发链路', '1.创建样品', 'PASS', `${sample.data.sampleCode} 状态=${sample.data.status}`);

    const submit = await api(`/rd/samples/${sample.data.id}/submit`, { method: 'POST' });
    log('L4', '研发链路', '2.提交审核', submit.success ? 'PASS' : 'FAIL',
      submit.success ? `状态→${submit.data?.status}` : submit.message);

    if (submit.success) {
      const approve = await api(`/rd/samples/${sample.data.id}/approve`, { method: 'POST', body: JSON.stringify({ notes: 'E2E审核通过' }) });
      log('L4', '研发链路', '3.审核通过', approve.success ? 'PASS' : 'FAIL',
        approve.success ? `状态→${approve.data?.status}` : approve.message);

      // Verify: approved sample should have "提交报价申请" button
      await go(page, '/rd/samples');
      const approvedRow = page.locator('.el-table__row').filter({ hasText: '样品通过' }).first();
      if (await approvedRow.isVisible().catch(() => false)) {
        const btns = await approvedRow.locator('button').allTextContents().catch(() => []);
        log('L4', '研发链路', '4.报价按钮', btns.some(b => b?.includes('报价')) ? 'PASS' : 'FAIL', `[${btns}]`);
      } else { log('L4', '研发链路', '4.报价按钮', 'WARN', '无样品通过行'); }
    }
  } else { log('L4', '研发链路', '创建', 'FAIL', sample.message); }
}

// ==================== Multi-Role Login ====================

async function testMultiRole(page) {
  console.log('\n=== 多角色登录 ===');

  const roles = [
    { user: 'hr_admin1', name: '人事经理', expectMenu: '人事管理', path: '/hr/employees' },
    { user: 'finance_mgr1', name: '财务经理', expectMenu: '财务管理', path: '/finance/invoices' },
    { user: 'warehouse_mgr1', name: '仓储经理', expectMenu: '仓储管理', path: '/warehouse/materials' },
    { user: 'dispatcher1', name: '调度', expectMenu: '智能调度', path: '/dashboard' },
  ];

  for (let ri = 0; ri < roles.length; ri++) {
    const role = roles[ri];
    if (ri > 0) await page.waitForTimeout(2000); // avoid rate limit
    const ok = await loginAs(page, role.user);
    if (!ok) { log('多角色', role.name, '登录', 'FAIL', `${role.user} 登录失败`); continue; }

    // Verify actually logged in by checking dashboard content
    await go(page, '/dashboard');
    const dashText = await page.locator('.app-main, main').first().textContent().catch(() => '');
    const loggedIn = dashText.length > 50;
    log('多角色', role.name, '登录', loggedIn ? 'PASS' : 'FAIL', `${role.user}, 内容${dashText.length}字`);
    if (!loggedIn) continue;

    // Check menu visibility
    const menuText = await page.locator('.el-menu').first().textContent().catch(() => '');
    const hasExpectedMenu = menuText.includes(role.expectMenu);
    log('多角色', role.name, '菜单可见', hasExpectedMenu ? 'PASS' : 'WARN',
      `期望"${role.expectMenu}" ${hasExpectedMenu ? '✓' : '✗'}, 菜单: ${menuText.slice(0, 80)}`);

    // Navigate to role-specific page
    await go(page, role.path);
    const hasTable = await page.locator('.el-table').first().isVisible().catch(() => false);
    const hasCard = await page.locator('.el-card').first().isVisible().catch(() => false);
    log('多角色', role.name, '角色页面', hasTable || hasCard ? 'PASS' : 'WARN', `${role.path} table=${hasTable} card=${hasCard}`);
  }

  // Re-login as admin for cleanup
  await loginAs(page, 'factory_admin1');
  await go(page, '/dashboard'); // ensure we're back
}

// ==================== Detail Page Deep Check ====================

async function testDetailPages(page) {
  console.log('\n=== 详情页深查 ===');

  const detailPages = [
    { name: '客户详情', listPath: '/sales/customers', btnText: '查看' },
    { name: '供应商详情', listPath: '/procurement/suppliers', btnText: '查看' },
    { name: '员工详情', listPath: '/hr/employees', btnText: '查看' },
  ];

  for (const dp of detailPages) {
    await go(page, dp.listPath);
    const btn = page.locator(`button:has-text("${dp.btnText}"), button:has-text("详情")`).first();
    if (!await btn.isVisible().catch(() => false)) {
      log('L5.2', dp.name, '详情入口', 'WARN', `无"${dp.btnText}"按钮`);
      continue;
    }
    await btn.click(); await page.waitForTimeout(2000);

    // Check if we navigated or opened dialog
    const isDialog = await page.locator('.el-dialog:visible, .el-drawer:visible').isVisible().catch(() => false);
    const pageChanged = !page.url().includes(dp.listPath.split('/').pop());

    if (isDialog) {
      const fields = await page.locator('.el-dialog:visible input, .el-dialog:visible .el-descriptions').count().catch(() => 0);
      log('L5.2', dp.name, '详情内容', fields > 0 ? 'PASS' : 'WARN', `弹窗模式, ${fields}个元素`);
      await page.keyboard.press('Escape'); await page.waitForTimeout(500);
    } else if (pageChanged) {
      const content = await page.locator('main, .app-main').first().textContent().catch(() => '');
      log('L5.2', dp.name, '详情内容', content.length > 50 ? 'PASS' : 'WARN', `页面模式, ${content.length}字`);
      await page.goBack(); await page.waitForTimeout(1500);
    } else {
      // Might have expanded inline
      const expanded = await page.locator('.el-table__expanded-cell, .el-collapse-item').isVisible().catch(() => false);
      log('L5.2', dp.name, '详情内容', expanded ? 'PASS' : 'WARN', `内联展开=${expanded}`);
    }
  }
}

// ==================== Special Pages Deep Check ====================

async function testSpecialPages(page) {
  console.log('\n=== 特殊页面深查 ===');

  const specials = [
    { name: '成品库存', path: '/sales/finished-goods' },
    { name: 'BOM配方', path: '/production/bom' },
    { name: '调拨管理', path: '/transfer/list' },
    { name: '财务成本', path: '/finance/costs' },
  ];

  for (const sp of specials) {
    await go(page, sp.path);
    const url = page.url();
    const isRedirect = !url.includes(sp.path.split('/').pop());
    const bodyLen = (await page.locator('.app-main, main').first().textContent().catch(() => '')).replace(/\s/g, '').length;
    const btns = await page.locator('button').allTextContents().catch(() => []);
    const tabs = await page.locator('.el-tabs__item').allTextContents().catch(() => []);

    if (isRedirect) {
      log('L1', sp.name, '页面检查', 'WARN', `被重定向到: ${url}`);
    } else if (bodyLen > 50 || btns.length > 2 || tabs.length > 0) {
      log('L1', sp.name, '页面检查', 'PASS', `${bodyLen}字, ${btns.length}按钮, ${tabs.length}tab`);
    } else {
      log('L1', sp.name, '页面检查', 'WARN', `内容少: ${bodyLen}字`);
    }
  }
}

// ==================== MAIN ====================

async function main() {
  console.log('🚀 E2E Supplement: Edit/Delete + L3 + L4 + Multi-Role');
  console.log(`Target: ${BASE} | ${new Date().toISOString()}\n`);

  await getToken();
  if (!TOKEN) { console.error('❌ No token'); process.exit(1); }

  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  // Console error monitoring
  const consoleErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error' && !msg.text().includes('favicon') && !msg.text().includes('net::ERR'))
      consoleErrors.push(msg.text().slice(0, 120));
  });

  const loginOk = await loginAs(page, 'factory_admin1');
  console.log(`Login URL: ${page.url()}`);
  if (!loginOk) {
    // Debug: take screenshot + dump page content
    await page.screenshot({ path: 'login-fail-debug.png' }).catch(() => {});
    const html = await page.content().catch(() => '');
    console.log(`  Page has ${html.length} chars, includes "登 录": ${html.includes('登 录')}`);
    console.log(`  Includes "用户名": ${html.includes('用户名')}, "密码": ${html.includes('密码')}`);
    const inputs = await page.locator('input').count().catch(() => 0);
    const buttons = await page.locator('button').count().catch(() => 0);
    console.log(`  Inputs: ${inputs}, Buttons: ${buttons}`);
    console.error('❌ Login failed');
    await browser.close(); process.exit(1);
  }
  console.log('✅ Login OK\n');

  await testEditOperations(page);
  await testCancelDelete(page);
  await testCrossModule(page);
  await testWorkflows(page);
  await testDetailPages(page);
  await testSpecialPages(page);
  await testMultiRole(page);

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log(`📊 SUPPLEMENT: ${pass} PASS, ${fail} FAIL, ${warn} WARN (total: ${pass+fail+warn})`);
  console.log('='.repeat(60));

  if (consoleErrors.length > 0) {
    console.log(`\n🔴 Console Errors (${consoleErrors.length}):`);
    [...new Set(consoleErrors)].slice(0, 10).forEach(e => console.log(`  - ${e}`));
  } else { console.log('\n✅ Console: 0 errors'); }

  const mods = {};
  for (const r of results) {
    if (!mods[r.module]) mods[r.module] = { p: 0, f: 0, w: 0 };
    mods[r.module][r.status === 'PASS' ? 'p' : r.status === 'FAIL' ? 'f' : 'w']++;
  }
  console.log('\n模块汇总:');
  for (const [m, c] of Object.entries(mods)) {
    console.log(`  ${c.f > 0 ? '❌' : c.w > 0 ? '⚠️' : '✅'} ${m}: ${c.p}P/${c.f}F/${c.w}W`);
  }

  const fs = await import('fs');
  fs.writeFileSync('test-e2e-supplement-results.json', JSON.stringify({
    timestamp: new Date().toISOString(), pass, fail, warn, total: pass+fail+warn,
    consoleErrors: [...new Set(consoleErrors)], results
  }, null, 2));

  await browser.close();
  process.exit(fail > 0 ? 1 : 0);
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
