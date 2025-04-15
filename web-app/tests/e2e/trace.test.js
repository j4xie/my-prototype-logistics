/**
 * 食品溯源系统 - 溯源查询流程端到端测试
 * @version 1.0.0
 */

const { test, expect } = require('@playwright/test');

// 溯源查询测试
test.describe('溯源查询流程测试', () => {
  // 登录状态下的测试
  test.describe('已登录用户', () => {
    // 每个测试前登录账号
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
    });
    
    // 测试导航到溯源查询页面
    test('从首页导航到溯源查询页面', async ({ page }) => {
      // 点击导航菜单中的溯源查询
      await page.click('nav .menu-item[data-page="trace"]');
      
      // 等待页面跳转
      await page.waitForURL('**/trace.html', { timeout: 5000 });
      
      // 验证页面标题
      await expect(page).toHaveTitle(/溯源查询 - 食品溯源系统/);
      
      // 验证溯源查询表单存在
      await expect(page.locator('#trace-search-form')).toBeVisible();
      await expect(page.locator('#trace-id-input')).toBeVisible();
      await expect(page.locator('#search-button')).toBeVisible();
    });
    
    // 测试有效的溯源ID查询
    test('有效的溯源ID应该显示溯源记录', async ({ page }) => {
      // 导航到溯源查询页面
      await page.goto('http://localhost:8080/trace.html');
      
      // 输入有效的溯源ID
      await page.fill('#trace-id-input', 'p001');
      
      // 点击搜索按钮
      await page.click('#search-button');
      
      // 等待结果加载
      await page.waitForSelector('.trace-result-container', { timeout: 5000 });
      
      // 验证产品信息显示
      await expect(page.locator('.product-name')).toContainText('有机大米');
      
      // 验证溯源记录列表显示
      await expect(page.locator('.trace-record-list')).toBeVisible();
      await expect(page.locator('.trace-record-item')).toHaveCount(2);
      
      // 验证溯源时间线显示
      await expect(page.locator('.trace-timeline')).toBeVisible();
    });
    
    // 测试无效的溯源ID查询
    test('无效的溯源ID应该显示错误消息', async ({ page }) => {
      // 导航到溯源查询页面
      await page.goto('http://localhost:8080/trace.html');
      
      // 输入无效的溯源ID
      await page.fill('#trace-id-input', 'invalid-id');
      
      // 点击搜索按钮
      await page.click('#search-button');
      
      // 等待错误消息显示
      await page.waitForSelector('.trace-toast-error', { timeout: 5000 });
      
      // 验证错误消息内容
      const toastContent = await page.textContent('.trace-toast-error');
      expect(toastContent).toContain('未找到相关溯源记录');
      
      // 验证结果区域不显示
      await expect(page.locator('.trace-result-container')).not.toBeVisible();
    });
    
    // 测试查看溯源记录详情
    test('点击溯源记录应该显示详情', async ({ page }) => {
      // 导航到溯源查询页面并搜索
      await page.goto('http://localhost:8080/trace.html');
      await page.fill('#trace-id-input', 'p001');
      await page.click('#search-button');
      
      // 等待结果加载
      await page.waitForSelector('.trace-record-list', { timeout: 5000 });
      
      // 点击第一条溯源记录
      await page.click('.trace-record-item:first-child');
      
      // 等待详情对话框显示
      await page.waitForSelector('.trace-modal', { timeout: 5000 });
      
      // 验证详情对话框内容
      await expect(page.locator('.trace-modal-title')).toContainText('溯源记录详情');
      await expect(page.locator('.record-operation')).toContainText('种植');
      await expect(page.locator('.record-location')).toContainText('湖南省长沙市');
      
      // 关闭详情对话框
      await page.click('.trace-modal-close');
      
      // 验证对话框已关闭
      await expect(page.locator('.trace-modal')).not.toBeVisible();
    });
  });
  
  // 未登录状态下的测试
  test.describe('未登录用户', () => {
    test.beforeEach(async ({ page }) => {
      // 导航到溯源查询页面
      await page.goto('http://localhost:8080/trace.html');
      
      // 等待页面加载完成
      await page.waitForLoadState('domcontentloaded');
    });
    
    // 测试未登录用户访问溯源查询
    test('未登录用户应该能进行有限的溯源查询', async ({ page }) => {
      // 验证页面标题
      await expect(page).toHaveTitle(/溯源查询 - 食品溯源系统/);
      
      // 验证溯源查询表单存在
      await expect(page.locator('#trace-search-form')).toBeVisible();
      
      // 验证登录提示显示
      await expect(page.locator('.login-prompt')).toBeVisible();
      await expect(page.locator('.login-prompt')).toContainText('登录获取更多信息');
      
      // 输入有效的溯源ID
      await page.fill('#trace-id-input', 'p001');
      
      // 点击搜索按钮
      await page.click('#search-button');
      
      // 等待结果加载
      await page.waitForSelector('.trace-result-container', { timeout: 5000 });
      
      // 验证产品基本信息显示
      await expect(page.locator('.product-name')).toContainText('有机大米');
      
      // 验证有限的溯源记录显示
      await expect(page.locator('.trace-record-list')).toBeVisible();
      
      // 验证详细信息被限制的提示
      await expect(page.locator('.restricted-info')).toBeVisible();
      await expect(page.locator('.restricted-info')).toContainText('登录查看完整记录');
    });
    
    // 测试点击登录按钮
    test('未登录用户点击登录按钮应跳转到登录页面', async ({ page }) => {
      // 点击登录按钮
      await page.click('.login-prompt a');
      
      // 等待跳转到登录页面
      await page.waitForURL('**/login.html', { timeout: 5000 });
      
      // 验证登录页面加载
      await expect(page.locator('#login-form')).toBeVisible();
    });
  });
}); 