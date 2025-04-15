/**
 * 食品溯源系统 - 溯源记录详情页面端到端测试
 * @version 1.0.0
 */

const { test, expect } = require('@playwright/test');

// 溯源记录详情测试
test.describe('溯源记录详情页面测试', () => {
  // 登录状态下的测试
  test.describe('已登录用户', () => {
    // 每个测试前登录账号并导航到溯源查询页面
    test.beforeEach(async ({ page }) => {
      // 导航到登录页面
      await page.goto('http://localhost:8080/login.html');
      
      // 等待页面加载完成
      await page.waitForLoadState('domcontentloaded');
      
      // 登录
      await page.fill('#username', 'testuser');
      await page.fill('#password', 'password123');
      await page.click('#login-button');
      
      // 等待重定向到首页
      await page.waitForURL('**/index.html', { timeout: 10000 });
      
      // 导航到溯源查询页面
      await page.click('nav .menu-item[data-page="trace"]');
      
      // 等待页面跳转
      await page.waitForURL('**/trace.html', { timeout: 5000 });
      
      // 输入有效的溯源ID
      await page.fill('#trace-id-input', 'p001');
      
      // 点击搜索按钮
      await page.click('#search-button');
      
      // 等待结果加载
      await page.waitForSelector('.trace-result-container', { timeout: 5000 });
    });
    
    // 测试从列表进入详情页面
    test('从溯源记录列表进入详情页面', async ({ page }) => {
      // 点击"查看详情"按钮
      await page.click('.view-details-button');
      
      // 等待页面跳转到详情页面
      await page.waitForURL('**/trace-detail.html?id=**', { timeout: 5000 });
      
      // 验证页面标题
      await expect(page).toHaveTitle(/记录详情 - 食品溯源系统/);
      
      // 验证详情页面元素存在
      await expect(page.locator('.trace-detail-container')).toBeVisible();
      await expect(page.locator('.product-info')).toBeVisible();
      await expect(page.locator('.trace-timeline')).toBeVisible();
    });
    
    // 测试详情页面包含完整信息
    test('详情页面应包含完整的产品和溯源信息', async ({ page }) => {
      // 点击"查看详情"按钮
      await page.click('.view-details-button');
      
      // 等待页面跳转到详情页面
      await page.waitForURL('**/trace-detail.html?id=**', { timeout: 5000 });
      
      // 验证产品基本信息
      await expect(page.locator('.product-name')).toContainText('有机大米');
      await expect(page.locator('.product-producer')).toContainText('湖南农场');
      await expect(page.locator('.product-category')).toContainText('粮食');
      
      // 验证溯源记录信息
      await expect(page.locator('.trace-record-list')).toBeVisible();
      await expect(page.locator('.trace-record-item')).toHaveCount(2);
      
      // 验证第一条记录内容
      const firstRecord = page.locator('.trace-record-item').first();
      await expect(firstRecord.locator('.record-operation')).toContainText('种植');
      await expect(firstRecord.locator('.record-location')).toContainText('湖南省长沙市');
      await expect(firstRecord.locator('.record-operator')).toContainText('张农民');
      
      // 验证时间线存在
      await expect(page.locator('.trace-timeline')).toBeVisible();
      await expect(page.locator('.timeline-node')).toHaveCount(2);
    });
    
    // 测试地图显示功能
    test('详情页面应显示地理位置地图', async ({ page }) => {
      // 点击"查看详情"按钮
      await page.click('.view-details-button');
      
      // 等待页面跳转到详情页面
      await page.waitForURL('**/trace-detail.html?id=**', { timeout: 5000 });
      
      // 验证地图容器存在
      await expect(page.locator('.location-map-container')).toBeVisible();
      
      // 点击"显示地图"按钮
      await page.click('.show-map-button');
      
      // 等待地图加载
      await page.waitForSelector('.map-loaded', { timeout: 10000 });
      
      // 验证地图标记点存在
      await expect(page.locator('.map-marker')).toBeVisible();
    });
    
    // 测试分享功能
    test('详情页面的分享功能应正常工作', async ({ page }) => {
      // 点击"查看详情"按钮
      await page.click('.view-details-button');
      
      // 等待页面跳转到详情页面
      await page.waitForURL('**/trace-detail.html?id=**', { timeout: 5000 });
      
      // 点击分享按钮
      await page.click('.share-button');
      
      // 等待分享对话框显示
      await page.waitForSelector('.share-modal', { timeout: 5000 });
      
      // 验证分享链接存在
      await expect(page.locator('.share-link')).toBeVisible();
      const shareLink = await page.inputValue('.share-link');
      expect(shareLink).toContain('trace-detail.html?id=p001');
      
      // 点击复制按钮
      await page.click('.copy-link-button');
      
      // 验证复制成功提示显示
      await page.waitForSelector('.trace-toast-success', { timeout: 5000 });
      const toastContent = await page.textContent('.trace-toast-success');
      expect(toastContent).toContain('链接已复制');
    });
    
    // 测试查看证书功能
    test('详情页面应支持查看认证证书', async ({ page }) => {
      // 点击"查看详情"按钮
      await page.click('.view-details-button');
      
      // 等待页面跳转到详情页面
      await page.waitForURL('**/trace-detail.html?id=**', { timeout: 5000 });
      
      // 点击"查看证书"按钮
      await page.click('.view-certificate-button');
      
      // 等待证书对话框显示
      await page.waitForSelector('.certificate-modal', { timeout: 5000 });
      
      // 验证证书内容
      await expect(page.locator('.certificate-title')).toContainText('有机认证证书');
      await expect(page.locator('.certificate-issuer')).toBeVisible();
      await expect(page.locator('.certificate-date')).toBeVisible();
      
      // 验证证书图片加载
      await expect(page.locator('.certificate-image')).toBeVisible();
    });
    
    // 测试返回按钮功能
    test('点击返回按钮应返回溯源查询页面', async ({ page }) => {
      // 点击"查看详情"按钮
      await page.click('.view-details-button');
      
      // 等待页面跳转到详情页面
      await page.waitForURL('**/trace-detail.html?id=**', { timeout: 5000 });
      
      // 点击返回按钮
      await page.click('.back-button');
      
      // 等待页面跳转回溯源查询页面
      await page.waitForURL('**/trace.html', { timeout: 5000 });
      
      // 验证溯源查询页面元素存在
      await expect(page.locator('#trace-search-form')).toBeVisible();
    });
  });
  
  // 未登录状态下的测试
  test.describe('未登录用户', () => {
    test.beforeEach(async ({ page }) => {
      // 直接导航到溯源详情页面
      await page.goto('http://localhost:8080/trace-detail.html?id=p001');
      
      // 等待页面加载完成
      await page.waitForLoadState('domcontentloaded');
    });
    
    // 测试未登录用户的有限访问
    test('未登录用户应该能查看有限的溯源详情', async ({ page }) => {
      // 验证页面标题
      await expect(page).toHaveTitle(/记录详情 - 食品溯源系统/);
      
      // 验证产品基本信息可见
      await expect(page.locator('.product-name')).toContainText('有机大米');
      await expect(page.locator('.product-category')).toContainText('粮食');
      
      // 验证溯源记录部分信息受限
      await expect(page.locator('.restricted-info')).toBeVisible();
      await expect(page.locator('.restricted-info')).toContainText('登录查看完整记录');
      
      // 验证登录提示显示
      await expect(page.locator('.login-prompt')).toBeVisible();
    });
    
    // 测试登录提示功能
    test('点击登录提示应跳转到登录页面', async ({ page }) => {
      // 点击登录提示中的按钮
      await page.click('.login-prompt .login-button');
      
      // 等待页面跳转到登录页面
      await page.waitForURL('**/login.html?redirect=trace-detail.html%3Fid%3Dp001', { timeout: 5000 });
      
      // 验证登录页面加载
      await expect(page.locator('#login-form')).toBeVisible();
    });
  });
}); 