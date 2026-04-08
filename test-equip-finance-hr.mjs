import { chromium } from 'playwright';
const BASE = 'http://139.196.165.140:8086';
const results = [];
function log(m, s, d) { const i = s==='PASS'?'✅':s==='WARN'?'⚠️':'❌'; results.push({m,s,d}); console.log(`${i} [${m}] ${d}`); }

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  // Login
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded', timeout: 15000 });
  await page.waitForTimeout(1000);
  await page.locator('input').first().fill('factory_admin1');
  await page.locator('input[type="password"]').fill('123456');
  await page.locator('button').first().click();
  await page.waitForTimeout(4000);
  if (page.url().includes('/login')) { console.log('LOGIN FAILED'); await browser.close(); return; }
  log('登录', 'PASS', '跳转到 ' + page.url().replace(BASE, ''));

  const tests = [
    ['设备列表', '/equipment/list'],
    ['设备维护', '/equipment/maintenance'],
    ['设备告警', '/equipment/alerts'],
    ['财务-成本分析', '/finance/costs'],
    ['财务-报表', '/finance/reports'],
    ['财务-应收应付', '/finance/ar-ap'],
    ['财务-发票', '/finance/invoices'],
    ['财务-收付款', '/finance/payments'],
    ['财务-SKU利润', '/finance/sku-margin'],
    ['员工管理', '/hr/employees'],
    ['考勤管理', '/hr/attendance'],
    ['部门管理', '/hr/departments'],
    ['白名单', '/hr/whitelist'],
    ['操作日志', '/system/logs'],
    ['工序管理', '/system/work-processes'],
    ['产品工序配置', '/system/product-processes'],
  ];

  for (const [name, path] of tests) {
    try {
      await page.goto(`${BASE}${path}`, { waitUntil: 'domcontentloaded', timeout: 10000 });
      await page.waitForTimeout(2000);
      const url = page.url();
      if (url.includes('/login')) { log(name, 'FAIL', '重定向到登录页'); continue; }
      const title = await page.title();
      if (title.includes('不存在') || title.includes('404')) { log(name, 'WARN', '页面不存在'); continue; }
      const errorCount = await page.locator('.el-message--error').count();
      if (errorCount > 0) {
        const t = await page.locator('.el-message--error').first().textContent().catch(()=>'');
        log(name, 'WARN', `error: ${t.trim().substring(0,80)}`);
        continue;
      }
      const hasTable = await page.locator('.el-table').count() > 0;
      if (hasTable) {
        const rows = await page.locator('.el-table__body-wrapper .el-table__row').count();
        log(name, 'PASS', `${path} — el-table, ${rows} rows`);
      } else {
        const hasCard = await page.locator('.el-card').count() > 0;
        log(name, 'PASS', `${path} — ${hasCard ? 'el-card content' : 'loaded'}`);
      }
    } catch (err) {
      log(name, 'FAIL', `${path} — ${err.message.slice(0,60)}`);
    }
  }

  // CRUD: Equipment create
  try {
    await page.goto(`${BASE}/equipment/list`, { waitUntil: 'domcontentloaded', timeout: 10000 });
    await page.waitForTimeout(2000);
    const addBtn = page.locator('button').filter({ hasText: /新增|添加|创建/ }).first();
    if (await addBtn.isVisible().catch(()=>false)) {
      await addBtn.click();
      await page.waitForTimeout(1500);
      const dialog = await page.locator('.el-dialog').isVisible().catch(()=>false);
      log('设备-创建弹窗', dialog ? 'PASS' : 'WARN', dialog ? '弹窗打开' : '无创建弹窗');
    } else {
      log('设备-创建按钮', 'WARN', '未找到创建按钮');
    }
  } catch(e) { log('设备-CRUD', 'WARN', e.message.slice(0,60)); }

  // CRUD: Employee create
  try {
    await page.goto(`${BASE}/hr/employees`, { waitUntil: 'domcontentloaded', timeout: 10000 });
    await page.waitForTimeout(2000);
    const addBtn = page.locator('button').filter({ hasText: /新增|添加|创建/ }).first();
    if (await addBtn.isVisible().catch(()=>false)) {
      await addBtn.click();
      await page.waitForTimeout(1500);
      const dialog = await page.locator('.el-dialog, .el-drawer').isVisible().catch(()=>false);
      log('员工-创建弹窗', dialog ? 'PASS' : 'WARN', dialog ? '弹窗打开' : '无创建弹窗');
    } else {
      log('员工-创建按钮', 'WARN', '未找到创建按钮');
    }
  } catch(e) { log('员工-CRUD', 'WARN', e.message.slice(0,60)); }

  console.log(`\n=== 总结: ${results.filter(r=>r.s==='PASS').length} PASS, ${results.filter(r=>r.s==='WARN').length} WARN, ${results.filter(r=>r.s==='FAIL').length} FAIL ===`);
  await browser.close();
})();
