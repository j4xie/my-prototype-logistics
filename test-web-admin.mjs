import { chromium } from 'playwright';

// 自动切换: --local 用本地, --remote 用服务器, 默认自动检测
const args = process.argv.slice(2);
const forceLocal = args.includes('--local');
const forceRemote = args.includes('--remote');

const LOCAL_URL = 'http://localhost:5173';
const REMOTE_URL = 'http://139.196.165.140:8086';

let BASE;
if (forceLocal) {
  BASE = LOCAL_URL;
} else if (forceRemote) {
  BASE = REMOTE_URL;
} else {
  // 自动检测: 先试本地，不通再用远程
  try {
    const resp = await fetch(LOCAL_URL, { signal: AbortSignal.timeout(2000) });
    BASE = LOCAL_URL;
  } catch {
    BASE = REMOTE_URL;
  }
}
console.log(`目标: ${BASE} ${forceLocal ? '(--local)' : forceRemote ? '(--remote)' : '(自动检测)'}\n`);

const results = [];

function log(module, status, detail) {
  const icon = status === 'OK' ? '✅' : status === 'WARN' ? '⚠️' : '❌';
  results.push({ module, status, detail });
  console.log(`${icon} [${module}] ${detail}`);
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ ignoreHTTPSErrors: true });
  const page = await context.newPage();

  // Collect network errors per module
  let networkErrors = [];
  page.on('response', resp => {
    if (resp.status() === 401 || resp.status() === 403 || resp.status() === 500) {
      networkErrors.push(`${resp.status()} ${resp.url().replace(BASE, '').substring(0, 80)}`);
    }
  });

  // === Step 1: Login ===
  console.log('\n=== 1. 登录测试 ===');
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle', timeout: 15000 });
  await page.waitForTimeout(1000);

  try {
    await page.locator('input').first().fill('factory_admin1');
    await page.locator('input[type="password"]').fill('123456');
    await page.locator('button').first().click();
    await page.waitForTimeout(4000);

    if (page.url().includes('/login')) {
      log('登录', 'FAIL', 'Still on login page');
      await browser.close();
      return;
    }
    log('登录', 'OK', `跳转到 ${page.url().replace(BASE, '')}`);
  } catch (err) {
    log('登录', 'FAIL', err.message.slice(0, 100));
    await browser.close();
    return;
  }

  if (networkErrors.length > 0) {
    log('登录后网络', 'WARN', `${networkErrors.length}个错误: ${networkErrors.slice(0, 3).join(' | ')}`);
    networkErrors = [];
  } else {
    log('登录后网络', 'OK', '无错误请求');
  }

  // === Step 2: Page scan via direct goto (NOT sidebar clicks) ===
  console.log('\n=== 2. 页面扫描 (page.goto 直接导航) ===');

  const modules = [
    ['首页', '/dashboard'],
    ['生产批次', '/production/batches'],
    ['生产计划', '/production/plans'],
    ['BOM配方管理', '/production/bom'],
    ['报工审批', '/production/approval'],
    ['BOM达成率', '/production/bom-achievement'],
    ['原材料批次', '/warehouse/materials'],
    ['出货管理', '/warehouse/shipments'],
    ['盘点管理', '/warehouse/inventory'],
    ['质检记录', '/quality/inspections'],
    ['废弃处理', '/quality/disposals'],
    ['质检标准', '/quality/standards'],
    ['采购订单', '/procurement/orders'],
    ['供应商管理', '/procurement/suppliers'],
    ['价格表管理', '/procurement/price-lists'],
    ['销售订单', '/sales/orders'],
    ['成品库存', '/sales/finished-goods'],
    ['客户管理', '/sales/customers'],
    ['出货记录', '/sales/shipments'],
    ['员工管理', '/hr/employees'],
    ['考勤管理', '/hr/attendance'],
    ['设备列表', '/equipment/list'],
    ['财务-应收应付', '/finance/ar-ap'],
    ['财务-发票', '/finance/invoices'],
    ['研发样品', '/rd/samples'],
    ['用户管理', '/system/users'],
    ['角色管理', '/system/roles'],
    ['产品信息', '/system/products'],
    ['SmartBI', '/smart-bi/analysis'],
    ['调拨管理', '/transfer/list'],
  ];

  for (const [name, path] of modules) {
    networkErrors = [];
    try {
      await page.goto(`${BASE}${path}`, { waitUntil: 'domcontentloaded', timeout: 10000 });
      await page.waitForTimeout(2000);

      const url = page.url();
      const title = await page.title();

      // Check redirect to login
      if (url.includes('/login')) {
        log(name, 'FAIL', `重定向到登录页 (${path})`);
        // Re-login
        await page.locator('input').first().fill('factory_admin1');
        await page.locator('input[type="password"]').fill('123456');
        await page.locator('button').first().click();
        await page.waitForTimeout(3000);
        continue;
      }

      // Check 404
      if (title.includes('不存在') || title.includes('404')) {
        log(name, 'FAIL', `路由不存在: ${path}`);
        continue;
      }

      // Check error toasts
      const errorToasts = await page.locator('.el-message--error').all();
      if (errorToasts.length > 0) {
        const texts = [];
        for (const e of errorToasts) {
          const t = await e.textContent().catch(() => '');
          if (t) texts.push(t.trim());
        }
        log(name, 'WARN', `error toast: ${texts.join(', ').substring(0, 100)}`);
        continue;
      }

      // Check content
      const hasTable = await page.locator('.el-table').count() > 0;
      if (hasTable) {
        const rows = await page.locator('.el-table__body-wrapper .el-table__row').count();
        log(name, 'OK', `${path} — el-table, ${rows} rows`);
      } else {
        log(name, 'OK', `${path} — loaded`);
      }

      // Network errors
      if (networkErrors.length > 0) {
        log(`${name}-网络`, 'WARN', `${networkErrors.length}个: ${networkErrors.slice(0, 2).join(' | ')}`);
      }
    } catch (err) {
      log(name, 'FAIL', `${path} — ${err.message.slice(0, 80)}`);
    }
  }

  // === Summary ===
  console.log('\n=== 测试总结 ===');
  const fails = results.filter(r => r.status === 'FAIL');
  const warns = results.filter(r => r.status === 'WARN');
  const ok = results.filter(r => r.status === 'OK');
  console.log(`总计: ${results.length} 项, ✅ ${ok.length} 通过, ⚠️ ${warns.length} 警告, ❌ ${fails.length} 失败`);

  if (fails.length > 0) {
    console.log('\n❌ 失败项:');
    fails.forEach(f => console.log(`  ${f.module}: ${f.detail}`));
  }
  if (warns.length > 0) {
    console.log('\n⚠️ 警告项:');
    warns.forEach(w => console.log(`  ${w.module}: ${w.detail}`));
  }

  await browser.close();
})();
