/**
 * 食品溯源系统 - 登录流程端到端测试
 * @version 1.0.0
 */

const { test, expect } = require('@playwright/test');

// 登录页面测试
test.describe('登录流程测试', () => {
  // 登录前的设置
  test.beforeEach(async ({ page }) => {
    // 导航到登录页面
    await page.goto('http://localhost:8080/login.html');
    
    // 等待页面加载完成
    await page.waitForLoadState('domcontentloaded');
  });
  
  // 测试登录页面加载
  test('登录页面应该正确加载', async ({ page }) => {
    // 验证页面标题
    await expect(page).toHaveTitle(/登录 - 食品溯源系统/);
    
    // 验证登录表单元素存在
    await expect(page.locator('#login-form')).toBeVisible();
    await expect(page.locator('#username')).toBeVisible();
    await expect(page.locator('#password')).toBeVisible();
    await expect(page.locator('#login-button')).toBeVisible();
  });
  
  // 测试无效登录
  test('无效登录应该显示错误消息', async ({ page }) => {
    // 输入无效的登录信息
    await page.fill('#username', '');
    await page.fill('#password', '123');
    
    // 点击登录按钮
    await page.click('#login-button');
    
    // 等待错误消息显示
    await page.waitForSelector('.trace-toast-error', { timeout: 5000 });
    
    // 验证错误消息内容
    const toastContent = await page.textContent('.trace-toast-error');
    expect(toastContent).toContain('用户名不能为空');
  });
  
  // 测试有效登录
  test('有效登录应该成功并重定向到首页', async ({ page }) => {
    // 输入有效的登录信息
    await page.fill('#username', 'testuser');
    await page.fill('#password', 'password123');
    
    // 点击登录按钮
    await page.click('#login-button');
    
    // 等待成功消息显示
    await page.waitForSelector('.trace-toast-success', { timeout: 5000 });
    
    // 验证成功消息内容
    const toastContent = await page.textContent('.trace-toast-success');
    expect(toastContent).toContain('登录成功');
    
    // 等待页面重定向到首页
    await page.waitForURL('**/index.html', { timeout: 10000 });
    
    // 验证导航到首页后，用户信息显示正确
    await expect(page.locator('.user-info')).toContainText('testuser');
  });
  
  // 测试退出登录
  test('退出登录应该清除登录状态并返回登录页面', async ({ page }) => {
    // 先登录
    await page.fill('#username', 'testuser');
    await page.fill('#password', 'password123');
    await page.click('#login-button');
    
    // 等待重定向到首页
    await page.waitForURL('**/index.html', { timeout: 10000 });
    
    // 点击退出登录按钮
    await page.click('#logout-button');
    
    // 等待确认对话框显示
    await page.waitForSelector('.trace-modal-confirm', { timeout: 5000 });
    
    // 点击确认按钮
    await page.click('.trace-modal-confirm');
    
    // 等待成功消息显示
    await page.waitForSelector('.trace-toast-info', { timeout: 5000 });
    
    // 验证成功消息内容
    const toastContent = await page.textContent('.trace-toast-info');
    expect(toastContent).toContain('退出登录');
    
    // 等待页面重定向到登录页面
    await page.waitForURL('**/login.html', { timeout: 10000 });
  });
}); 