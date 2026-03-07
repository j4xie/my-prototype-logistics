import { test, expect, Page } from '@playwright/test';
import * as fs from 'fs';

const BASE_URL = 'http://139.196.165.140:8086';
const USERNAME = 'factory_admin1';
const PASSWORD = '123456';

// 结果收集
const results: any = {
  pages: [],
  charts: [],
  workflows: [],
  stubs: [],
  buttons: [],
  consoleErrors: []
};

async function login(page: Page) {
  await page.goto(`${BASE_URL}/login`);
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});

  // 截图登录页
  await page.screenshot({ path: 'screenshots/00-login.png', fullPage: false });

  // 填写用户名
  const usernameInput = page.locator('input[placeholder*="用户名"], input[name="username"], input[type="text"]').first();
  await usernameInput.fill(USERNAME);

  // 填写密码
  const passwordInput = page.locator('input[type="password"]').first();
  await passwordInput.fill(PASSWORD);

  // 点击登录
  const loginBtn = page.locator('button[type="submit"], button:has-text("登录"), .login-btn').first();
  await loginBtn.click();

  await page.waitForTimeout(3000);
  await page.screenshot({ path: 'screenshots/01-after-login.png', fullPage: false });

  return page.url();
}

async function capturePageInfo(page: Page, name: string, url: string) {
  const errors: string[] = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      errors.push(msg.text());
    }
  });

  await page.goto(`${BASE_URL}${url}`);
  await page.waitForTimeout(3000);
  await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});

  const screenshot = `screenshots/${name.replace(/\//g, '-')}.png`;
  await page.screenshot({ path: screenshot, fullPage: false });

  // 检查图表容器
  const chartContainers = await page.locator('canvas, .echarts, [data-ec-element], .chart-container').count();
  const spinners = await page.locator('.el-loading-spinner, .loading, [class*="spin"]').count();
  const errorMsgs = await page.locator('.el-empty, .error-page, [class*="error"]:visible').count();

  const pageTitle = await page.title();
  const bodyText = await page.locator('body').textContent().catch(() => '');

  return {
    name,
    url,
    chartContainers,
    spinners,
    errorMsgs,
    pageTitle,
    screenshot,
    bodyText: bodyText?.substring(0, 500),
    consoleErrors: errors
  };
}

test.describe('Web-Admin 全站审计', () => {
  test.setTimeout(300000);

  let consoleErrors: { text: string, url: string }[] = [];

  test('完整审计', async ({ page }) => {
    // 收集所有console错误
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push({ text: msg.text(), url: page.url() });
      }
    });

    // ============ 步骤1: 登录 ============
    await page.goto(`${BASE_URL}/login`);
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
    await page.screenshot({ path: 'screenshots/00-login.png' });

    const usernameInput = page.locator('input').first();
    await usernameInput.fill(USERNAME);

    const passwordInput = page.locator('input[type="password"]').first();
    await passwordInput.fill(PASSWORD);

    await page.screenshot({ path: 'screenshots/00b-filled.png' });

    const loginBtn = page.locator('button[type="submit"]').first();
    await loginBtn.click();
    await page.waitForTimeout(4000);

    const afterLoginUrl = page.url();
    await page.screenshot({ path: 'screenshots/01-after-login.png' });
    console.log('登录后URL:', afterLoginUrl);
    results.pages.push({ step: '登录', url: afterLoginUrl, status: afterLoginUrl.includes('login') ? '失败' : '成功' });

    // ============ 步骤2: 图表页面 ============

    // 2a. Dashboard
    await page.goto(`${BASE_URL}/`);
    await page.waitForTimeout(4000);
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
    await page.screenshot({ path: 'screenshots/02-dashboard.png', fullPage: true });
    const dashCharts = await page.locator('canvas').count();
    const dashKpi = await page.locator('[class*="kpi"], [class*="stat"], .el-card').count();
    const dashEmpty = await page.locator('.el-empty').count();
    const dashText = await page.locator('body').innerText().catch(() => '');
    results.charts.push({
      name: 'Dashboard (/)',
      url: '/',
      canvasCount: dashCharts,
      kpiCards: dashKpi,
      emptyCount: dashEmpty,
      hasError: dashText.includes('错误') || dashText.includes('失败'),
      screenshot: 'screenshots/02-dashboard.png'
    });
    console.log(`Dashboard: canvas=${dashCharts}, kpi=${dashKpi}, empty=${dashEmpty}`);

    // 2b. SmartBI Dashboard
    await page.goto(`${BASE_URL}/smart-bi/dashboard`);
    await page.waitForTimeout(5000);
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
    await page.screenshot({ path: 'screenshots/03-smartbi-dashboard.png', fullPage: true });
    const sbiCharts = await page.locator('canvas').count();
    const sbiEmpty = await page.locator('.el-empty').count();
    const sbiText = await page.locator('body').innerText().catch(() => '');
    results.charts.push({
      name: 'SmartBI Dashboard',
      url: '/smart-bi/dashboard',
      canvasCount: sbiCharts,
      emptyCount: sbiEmpty,
      hasError: sbiText.includes('加载失败') || sbiText.includes('错误'),
      screenshot: 'screenshots/03-smartbi-dashboard.png'
    });
    console.log(`SmartBI Dashboard: canvas=${sbiCharts}, empty=${sbiEmpty}`);

    // 2c. Analytics Trends
    await page.goto(`${BASE_URL}/analytics/trends`);
    await page.waitForTimeout(4000);
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
    await page.screenshot({ path: 'screenshots/04-analytics-trends.png', fullPage: true });
    const trendsCharts = await page.locator('canvas').count();
    const trendsText = await page.locator('body').innerText().catch(() => '');
    results.charts.push({
      name: 'Analytics Trends',
      url: '/analytics/trends',
      canvasCount: trendsCharts,
      hasStub: trendsText.includes('开发中') || trendsText.includes('敬请期待') || trendsText.includes('暂无'),
      screenshot: 'screenshots/04-analytics-trends.png'
    });
    console.log(`Analytics Trends: canvas=${trendsCharts}`);

    // 2d. Production Analytics
    await page.goto(`${BASE_URL}/analytics/production`);
    await page.waitForTimeout(4000);
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
    await page.screenshot({ path: 'screenshots/05-analytics-production.png', fullPage: true });
    const prodCharts = await page.locator('canvas').count();
    const prodText = await page.locator('body').innerText().catch(() => '');
    results.charts.push({
      name: 'Production Analytics',
      url: '/analytics/production',
      canvasCount: prodCharts,
      hasStub: prodText.includes('开发中') || prodText.includes('敬请期待'),
      screenshot: 'screenshots/05-analytics-production.png'
    });
    console.log(`Production Analytics: canvas=${prodCharts}`);

    // 2e. Scheduling Plans
    await page.goto(`${BASE_URL}/scheduling/plans`);
    await page.waitForTimeout(4000);
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
    await page.screenshot({ path: 'screenshots/06-scheduling-plans.png', fullPage: true });
    const schedCharts = await page.locator('canvas').count();
    const schedRows = await page.locator('tr.el-table__row, .el-table__body tr').count();
    const schedText = await page.locator('body').innerText().catch(() => '');
    results.charts.push({
      name: 'Scheduling Plans',
      url: '/scheduling/plans',
      canvasCount: schedCharts,
      tableRows: schedRows,
      hasData: schedRows > 0,
      screenshot: 'screenshots/06-scheduling-plans.png'
    });

    // 2f. Calibration
    await page.goto(`${BASE_URL}/calibration`);
    await page.waitForTimeout(3000);
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
    await page.screenshot({ path: 'screenshots/07-calibration.png', fullPage: true });
    const calCharts = await page.locator('canvas').count();
    const calText = await page.locator('body').innerText().catch(() => '');
    results.charts.push({
      name: 'Calibration',
      url: '/calibration',
      canvasCount: calCharts,
      hasStub: calText.includes('开发中') || calText.includes('敬请期待'),
      screenshot: 'screenshots/07-calibration.png'
    });

    // ============ 步骤3: 工作流页面 ============

    // 3a. Transfer
    await page.goto(`${BASE_URL}/transfer`);
    await page.waitForTimeout(4000);
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
    await page.screenshot({ path: 'screenshots/08-transfer.png', fullPage: true });
    const transferRows = await page.locator('tr.el-table__row, .el-table__body tr').count();
    const transferText = await page.locator('body').innerText().catch(() => '');
    const transferStatuses = await page.locator('.el-tag').allTextContents().catch(() => []);
    results.workflows.push({
      name: 'Transfer (/transfer)',
      url: '/transfer',
      hasData: transferRows > 0,
      rowCount: transferRows,
      statusTags: transferStatuses.slice(0, 5).join(', '),
      screenshot: 'screenshots/08-transfer.png'
    });
    console.log(`Transfer: rows=${transferRows}, statuses=${transferStatuses.slice(0,3)}`);

    // 3b. Procurement Orders
    await page.goto(`${BASE_URL}/procurement/orders`);
    await page.waitForTimeout(4000);
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
    await page.screenshot({ path: 'screenshots/09-procurement.png', fullPage: true });
    const procRows = await page.locator('tr.el-table__row, .el-table__body tr').count();
    const procStatuses = await page.locator('.el-tag').allTextContents().catch(() => []);
    results.workflows.push({
      name: 'Procurement Orders',
      url: '/procurement/orders',
      hasData: procRows > 0,
      rowCount: procRows,
      statusTags: procStatuses.slice(0, 5).join(', '),
      screenshot: 'screenshots/09-procurement.png'
    });
    console.log(`Procurement: rows=${procRows}`);

    // 3c. Sales Orders
    await page.goto(`${BASE_URL}/sales/orders`);
    await page.waitForTimeout(4000);
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
    await page.screenshot({ path: 'screenshots/10-sales.png', fullPage: true });
    const salesRows = await page.locator('tr.el-table__row, .el-table__body tr').count();
    const salesStatuses = await page.locator('.el-tag').allTextContents().catch(() => []);
    const salesBtns = await page.locator('button').allTextContents().catch(() => []);
    results.workflows.push({
      name: 'Sales Orders',
      url: '/sales/orders',
      hasData: salesRows > 0,
      rowCount: salesRows,
      statusTags: salesStatuses.slice(0, 5).join(', '),
      availableButtons: salesBtns.slice(0, 5).join(', '),
      screenshot: 'screenshots/10-sales.png'
    });
    console.log(`Sales: rows=${salesRows}`);

    // 3d. Scheduling Plans status check (already visited)
    const schedStatuses = await page.locator('.el-tag').allTextContents().catch(() => []);
    results.workflows.push({
      name: 'Scheduling Plans',
      url: '/scheduling/plans',
      hasData: schedRows > 0,
      rowCount: schedRows,
      statusTags: schedStatuses.slice(0, 5).join(', '),
      screenshot: 'screenshots/06-scheduling-plans.png'
    });

    // ============ 步骤4: Stub页面 ============

    // 4a. Finance Costs
    await page.goto(`${BASE_URL}/finance/costs`);
    await page.waitForTimeout(3000);
    await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
    await page.screenshot({ path: 'screenshots/11-finance-costs.png', fullPage: true });
    const finText = await page.locator('body').innerText().catch(() => '');
    const finHas404 = finText.includes('404') || finText.includes('找不到');
    const finHasStub = finText.includes('开发中') || finText.includes('敬请期待') || finText.includes('建设中');
    const finHasContent = await page.locator('.el-card, .el-table, table').count();
    results.stubs.push({
      name: '/finance/costs',
      url: '/finance/costs',
      is404: finHas404,
      isStub: finHasStub,
      hasRealContent: finHasContent > 0,
      displayText: finText.substring(0, 200),
      screenshot: 'screenshots/11-finance-costs.png'
    });
    console.log(`Finance Costs: 404=${finHas404}, stub=${finHasStub}, content=${finHasContent}`);

    // 4b. System Roles
    await page.goto(`${BASE_URL}/system/roles`);
    await page.waitForTimeout(3000);
    await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
    await page.screenshot({ path: 'screenshots/12-system-roles.png', fullPage: true });
    const rolesText = await page.locator('body').innerText().catch(() => '');
    const rolesHas404 = rolesText.includes('404') || rolesText.includes('找不到');
    const rolesHasStub = rolesText.includes('开发中') || rolesText.includes('敬请期待');
    const rolesHasContent = await page.locator('.el-card, .el-table, table, tr').count();
    results.stubs.push({
      name: '/system/roles',
      url: '/system/roles',
      is404: rolesHas404,
      isStub: rolesHasStub,
      hasRealContent: rolesHasContent > 0,
      displayText: rolesText.substring(0, 200),
      screenshot: 'screenshots/12-system-roles.png'
    });
    console.log(`System Roles: 404=${rolesHas404}, stub=${rolesHasStub}, content=${rolesHasContent}`);

    // 4c. Equipment Maintenance
    await page.goto(`${BASE_URL}/equipment/maintenance`);
    await page.waitForTimeout(3000);
    await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
    await page.screenshot({ path: 'screenshots/13-equipment-maintenance.png', fullPage: true });
    const eqmText = await page.locator('body').innerText().catch(() => '');
    const eqmHas404 = eqmText.includes('404') || eqmText.includes('找不到');
    const eqmHasStub = eqmText.includes('开发中') || eqmText.includes('敬请期待');
    const eqmHasContent = await page.locator('.el-card, .el-table, table').count();
    results.stubs.push({
      name: '/equipment/maintenance',
      url: '/equipment/maintenance',
      is404: eqmHas404,
      isStub: eqmHasStub,
      hasRealContent: eqmHasContent > 0,
      displayText: eqmText.substring(0, 200),
      screenshot: 'screenshots/13-equipment-maintenance.png'
    });
    console.log(`Equipment Maintenance: 404=${eqmHas404}, stub=${eqmHasStub}, content=${eqmHasContent}`);

    // ============ 步骤5: 未接线按钮 ============

    // 5a. Procurement Suppliers
    await page.goto(`${BASE_URL}/procurement/suppliers`);
    await page.waitForTimeout(3000);
    await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
    await page.screenshot({ path: 'screenshots/14-suppliers.png', fullPage: true });
    const suppBtns = await page.locator('button').allTextContents().catch(() => []);
    const suppAddBtn = page.locator('button:has-text("新增供应商"), button:has-text("新增"), button:has-text("添加")').first();
    const suppAddExists = await suppAddBtn.isVisible().catch(() => false);
    let suppClickResult = '未找到按钮';
    if (suppAddExists) {
      await suppAddBtn.click();
      await page.waitForTimeout(2000);
      await page.screenshot({ path: 'screenshots/14b-suppliers-click.png' });
      const dialogVisible = await page.locator('.el-dialog, .el-drawer').isVisible().catch(() => false);
      const alertVisible = await page.locator('.el-message-box').isVisible().catch(() => false);
      suppClickResult = dialogVisible ? '弹出对话框' : (alertVisible ? '弹出提示框' : '无反应/其他');
    }
    results.buttons.push({
      page: '/procurement/suppliers',
      button: '新增供应商',
      exists: suppAddExists,
      clickResult: suppClickResult,
      allButtons: suppBtns.slice(0, 5).join(', '),
      screenshot: 'screenshots/14-suppliers.png'
    });
    console.log(`Suppliers: add=${suppAddExists}, result=${suppClickResult}`);

    // 5b. Sales Customers
    await page.goto(`${BASE_URL}/sales/customers`);
    await page.waitForTimeout(3000);
    await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
    await page.screenshot({ path: 'screenshots/15-customers.png', fullPage: true });
    const custAddBtn = page.locator('button:has-text("新增客户"), button:has-text("新增"), button:has-text("添加")').first();
    const custAddExists = await custAddBtn.isVisible().catch(() => false);
    let custClickResult = '未找到按钮';
    if (custAddExists) {
      await custAddBtn.click();
      await page.waitForTimeout(2000);
      await page.screenshot({ path: 'screenshots/15b-customers-click.png' });
      const dialogVisible = await page.locator('.el-dialog, .el-drawer').isVisible().catch(() => false);
      custClickResult = dialogVisible ? '弹出对话框' : '无反应/其他';
    }
    results.buttons.push({
      page: '/sales/customers',
      button: '新增客户',
      exists: custAddExists,
      clickResult: custClickResult,
      screenshot: 'screenshots/15-customers.png'
    });
    console.log(`Customers: add=${custAddExists}, result=${custClickResult}`);

    // 5c. HR Employees
    await page.goto(`${BASE_URL}/hr/employees`);
    await page.waitForTimeout(3000);
    await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
    await page.screenshot({ path: 'screenshots/16-employees.png', fullPage: true });
    const hrBtns = await page.locator('button').allTextContents().catch(() => []);
    const hrAddBtn = page.locator('button:has-text("新增员工"), button:has-text("新增"), button:has-text("添加")').first();
    const hrAddExists = await hrAddBtn.isVisible().catch(() => false);
    let hrClickResult = '未找到按钮';
    if (hrAddExists) {
      await hrAddBtn.click();
      await page.waitForTimeout(2000);
      await page.screenshot({ path: 'screenshots/16b-employees-click.png' });
      const dialogVisible = await page.locator('.el-dialog, .el-drawer').isVisible().catch(() => false);
      hrClickResult = dialogVisible ? '弹出对话框' : '无反应/其他';
    }
    results.buttons.push({
      page: '/hr/employees',
      button: '新增员工',
      exists: hrAddExists,
      clickResult: hrClickResult,
      allButtons: hrBtns.slice(0, 5).join(', '),
      screenshot: 'screenshots/16-employees.png'
    });
    console.log(`HR Employees: add=${hrAddExists}, result=${hrClickResult}`);

    // 5d. Equipment
    await page.goto(`${BASE_URL}/equipment`);
    await page.waitForTimeout(3000);
    await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
    await page.screenshot({ path: 'screenshots/17-equipment.png', fullPage: true });
    const eqBtns = await page.locator('button').allTextContents().catch(() => []);
    const eqAddBtn = page.locator('button:has-text("新增设备"), button:has-text("新增"), button:has-text("添加")').first();
    const eqAddExists = await eqAddBtn.isVisible().catch(() => false);
    let eqClickResult = '未找到按钮';
    if (eqAddExists) {
      await eqAddBtn.click();
      await page.waitForTimeout(2000);
      await page.screenshot({ path: 'screenshots/17b-equipment-click.png' });
      const dialogVisible = await page.locator('.el-dialog, .el-drawer').isVisible().catch(() => false);
      eqClickResult = dialogVisible ? '弹出对话框' : '无反应/其他';
    }
    results.buttons.push({
      page: '/equipment',
      button: '新增设备',
      exists: eqAddExists,
      clickResult: eqClickResult,
      allButtons: eqBtns.slice(0, 5).join(', '),
      screenshot: 'screenshots/17-equipment.png'
    });
    console.log(`Equipment: add=${eqAddExists}, result=${eqClickResult}`);

    // ============ 步骤6: Console错误汇总 ============
    results.consoleErrors = consoleErrors;

    // 保存结果
    fs.writeFileSync('audit-results.json', JSON.stringify(results, null, 2));
    console.log('\n========== 审计完成 ==========');
    console.log('图表页面:', results.charts.length);
    console.log('工作流页面:', results.workflows.length);
    console.log('Stub页面:', results.stubs.length);
    console.log('按钮测试:', results.buttons.length);
    console.log('Console错误:', results.consoleErrors.length);
    console.log('结果已保存到 audit-results.json');
  });
});
