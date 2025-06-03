/**
 * @file tests/e2e/basic-navigation.test.js
 * @description 基本导航端到端测试
 */

const { test, expect } = require('@playwright/test');

test.describe('基本页面导航', () => {
  test.beforeEach(async ({ page }) => {
    // 导航到首页
    await page.goto('http://localhost:8080');
  });

  test('首页应有正确的标题和导航元素', async ({ page }) => {
    // 检查页面标题
    await expect(page).toHaveTitle(/食品溯源系统/);
    
    // 检查导航元素存在
    const nav = page.locator('nav');
    await expect(nav).toBeVisible();
    
    // 检查页面标题
    const heading = page.locator('h1');
    await expect(heading).toContainText('食品溯源');
  });

  test('点击导航项应导航到正确页面', async ({ page }) => {
    // 点击"溯源"导航
    await page.locator('nav >> text=溯源').click();
    
    // 验证URL变化
    await expect(page).toHaveURL(/.*trace/);
    
    // 验证页面内容
    const heading = page.locator('h1');
    await expect(heading).toContainText('产品溯源');
  });

  test('溯源查询功能应工作正常', async ({ page }) => {
    // 导航到溯源页面
    await page.goto('http://localhost:8080/trace');
    
    // 输入溯源码
    await page.locator('input[placeholder*="溯源码"]').fill('P12345');
    
    // 点击查询按钮
    await page.locator('button >> text=查询').click();
    
    // 等待结果加载
    await page.waitForSelector('.trace-result', { timeout: 5000 });
    
    // 验证结果
    const resultCard = page.locator('.trace-result');
    await expect(resultCard).toBeVisible();
    
    // 检查是否显示了产品信息
    const productName = page.locator('.product-name');
    await expect(productName).toBeVisible();
  });

  test('登录表单应进行必填字段验证', async ({ page }) => {
    // 导航到登录页面
    await page.goto('http://localhost:8080/auth/login');
    
    // 尝试提交空表单
    await page.locator('button[type="submit"]').click();
    
    // 验证错误消息出现
    const errorMessage = page.locator('.error-message');
    await expect(errorMessage).toBeVisible();
    
    // 填写用户名但留空密码
    await page.locator('input[name="username"]').fill('testuser');
    await page.locator('button[type="submit"]').click();
    
    // 验证错误消息仍然存在
    await expect(errorMessage).toBeVisible();
  });
});