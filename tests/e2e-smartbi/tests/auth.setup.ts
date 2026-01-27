import { test as setup, expect } from '@playwright/test';
import path from 'path';

const authFile = path.join(__dirname, '../auth-state.json');

/**
 * 登录设置 - 保存认证状态供其他测试复用
 */
setup('登录 web-admin', async ({ page }) => {
  console.log('🔐 开始登录流程...');

  // 访问登录页
  await page.goto('/login');

  // 等待登录表单加载
  await page.waitForSelector('.login-container, .login-form, form', { timeout: 10000 });
  console.log('✅ 登录页面加载完成');

  // 测试账号
  const username = 'finance_mgr1';
  const password = '123456';

  // 方式1: 使用快捷登录按钮（开发环境）
  const quickLoginBtn = page.locator('.quick-buttons button').filter({ hasText: '财务经理' });
  if (await quickLoginBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    console.log('📌 使用快捷登录: 财务经理');
    await quickLoginBtn.click();
    await page.waitForTimeout(500);
    // 快捷登录只填充表单，还需点击登录按钮
    await page.click('.login-button');
  } else {
    // 方式2: 手动填写表单
    console.log(`📝 手动填写登录表单: ${username}`);
    await page.fill('input[placeholder="请输入用户名"]', username);
    await page.fill('input[placeholder="请输入密码"]', password);
    await page.click('.login-button');
  }

  // 等待登录成功 - 跳转到 /dashboard
  await page.waitForURL('**/dashboard**', { timeout: 20000 });

  console.log('✅ 登录成功!');

  // 验证登录状态
  const currentUrl = page.url();
  console.log(`📍 当前 URL: ${currentUrl}`);

  // 保存认证状态
  await page.context().storageState({ path: authFile });
  console.log(`💾 认证状态已保存到: ${authFile}`);
});
