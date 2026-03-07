/**
 * Web-Admin AI Chat (SmartBI AI问答) 深度 UI/UX 审计
 * 目标: http://139.196.165.140:8086/smart-bi/query
 * 登录账号: factory_admin1 / 123456
 */
import { test, expect, Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const BASE_URL = 'http://139.196.165.140:8086';
const SCREENSHOT_DIR = path.resolve(__dirname, 'screenshots/ai-chat-webadmin');

// 确保截图目录存在
if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

async function screenshot(page: Page, name: string) {
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, `${name}.png`) });
}

async function login(page: Page) {
  await page.goto(`${BASE_URL}/login`);
  await page.waitForLoadState('networkidle');

  // 使用快捷登录按钮填充表单 (factory_admin1 = 工厂总监)
  await page.click('button:has-text("工厂总监")');
  // quickLogin() only fills form, still need to click the main login button
  await page.click('.login-button');

  // 等待登录完成，跳转到dashboard (backend may be slow after restart)
  await page.waitForURL(/dashboard|home/, { timeout: 30000 });
  console.log('[LOGIN] 登录成功, 当前 URL:', page.url());
}

test.describe('Web-Admin SmartBI AI问答 深度审计', () => {

  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('01 - 登录后进入AI问答页初始状态', async ({ page }) => {
    await page.goto(`${BASE_URL}/smart-bi/query`);
    await page.waitForLoadState('networkidle');

    console.log('[T01] URL:', page.url());

    // 截图记录初始状态
    await screenshot(page, '01-initial-state');

    // 检查页面标题
    const pageTitle = await page.title();
    console.log('[T01] 页面标题:', pageTitle);

    // 检查H1标题
    const h1 = await page.locator('h1').first().textContent().catch(() => '未找到');
    console.log('[T01] H1标题:', h1);

    // 检查输入框是否存在
    const hasTextarea = await page.locator('textarea').count();
    const hasInput = await page.locator('input[type="text"]').count();
    console.log('[T01] 输入框数量: textarea=', hasTextarea, ', text input=', hasInput);

    // 检查欢迎消息
    const welcomeMsg = await page.locator('.chat-history, .chat-message, .message-body').first().textContent().catch(() => '未找到欢迎消息');
    console.log('[T01] 欢迎消息:', welcomeMsg?.substring(0, 100));

    // 检查快捷问题按钮
    const quickBtns = await page.locator('.quick-questions button, .questions-list button').count();
    console.log('[T01] 快捷问题按钮数量:', quickBtns);

    // 检查分析模板卡片
    const templateCards = await page.locator('.template-card').count();
    console.log('[T01] 分析模板卡片数量:', templateCards);

    // 检查数据源选择器
    const dataSourceSelect = await page.locator('.el-select').count();
    console.log('[T01] 下拉框数量:', dataSourceSelect);

    expect(hasTextarea + hasInput).toBeGreaterThan(0);
  });

  test('02 - 输入框与发送按钮交互', async ({ page }) => {
    await page.goto(`${BASE_URL}/smart-bi/query`);
    await page.waitForLoadState('networkidle');

    const textarea = page.locator('textarea').first();
    const sendBtn = page.locator('button:has-text("发送"), .el-button:has-text("发送")').first();

    // 检查发送按钮初始状态(应该是disabled)
    const isDisabledBefore = await sendBtn.isDisabled().catch(() => false);
    console.log('[T02] 发送按钮初始状态 disabled:', isDisabledBefore);

    await screenshot(page, '02a-empty-input-state');

    // 输入文字
    await textarea.click();
    await textarea.fill('今天的库存情况');

    // 截图 - 已输入状态
    await screenshot(page, '02b-input-filled');

    const isDisabledAfter = await sendBtn.isDisabled().catch(() => false);
    console.log('[T02] 输入后发送按钮 disabled:', isDisabledAfter);

    // 检查 Enter 键行为
    await textarea.press('Shift+Enter');
    const valueAfterNewline = await textarea.inputValue();
    console.log('[T02] Shift+Enter后文本:', JSON.stringify(valueAfterNewline));

    // 清空并测试空消息发送
    await textarea.fill('');
    const isDisabledEmpty = await sendBtn.isDisabled().catch(() => false);
    console.log('[T02] 清空后发送按钮 disabled:', isDisabledEmpty);

    await screenshot(page, '02c-empty-after-clear');
  });

  test('03 - 发送消息并观察加载状态', async ({ page }) => {
    await page.goto(`${BASE_URL}/smart-bi/query`);
    await page.waitForLoadState('networkidle');

    const textarea = page.locator('textarea').first();

    // 输入问题
    await textarea.fill('今天的库存情况');

    // 记录发送前消息数
    const beforeCount = await page.locator('.chat-message').count();
    console.log('[T03] 发送前消息数:', beforeCount);

    // 发送
    await page.keyboard.press('Enter');

    // 立即截图捕捉loading状态
    await page.waitForTimeout(200);
    await screenshot(page, '03a-loading-state');

    // 检查loading indicator
    const hasLoading = await page.locator('.loading-indicator, .is-loading, [class*="loading"]').count();
    console.log('[T03] Loading 指示器数量:', hasLoading);

    // 检查用户消息是否出现
    const userMsgCount = await page.locator('.chat-message.user').count();
    console.log('[T03] 用户消息数:', userMsgCount);

    // 等待响应 (最多60秒)
    try {
      await page.waitForFunction(
        () => !document.querySelector('.loading-indicator, .is-loading'),
        { timeout: 60000 }
      );
      console.log('[T03] 响应完成');
    } catch {
      console.log('[T03] 等待响应超时');
    }

    await screenshot(page, '03b-response-received');

    // 统计最终消息数
    const afterCount = await page.locator('.chat-message').count();
    console.log('[T03] 发送后消息数:', afterCount);

    // 获取AI回复内容
    const lastAiMsg = page.locator('.chat-message.assistant').last();
    const aiContent = await lastAiMsg.textContent().catch(() => '');
    console.log('[T03] AI回复内容(前150字):', aiContent?.substring(0, 150));
  });

  test('04 - 快捷问题按钮点击测试', async ({ page }) => {
    await page.goto(`${BASE_URL}/smart-bi/query`);
    await page.waitForLoadState('networkidle');

    // 找到快捷问题按钮
    const quickBtns = page.locator('.quick-questions button, .questions-list .el-button');
    const count = await quickBtns.count();
    console.log('[T04] 快捷问题按钮数:', count);

    if (count > 0) {
      const firstBtn = quickBtns.first();
      const btnText = await firstBtn.textContent();
      console.log('[T04] 第一个快捷按钮文字:', btnText?.trim());

      await screenshot(page, '04a-quick-questions-visible');

      // 点击第一个快捷问题
      await firstBtn.click();

      await page.waitForTimeout(500);
      await screenshot(page, '04b-after-quick-click');

      // 检查textarea是否被填入
      const textarea = page.locator('textarea').first();
      const inputValue = await textarea.inputValue().catch(() => '');
      console.log('[T04] 快捷问题填入输入框:', inputValue || '(直接发送了?)');
    }
  });

  test('05 - 分析模板卡片测试', async ({ page }) => {
    await page.goto(`${BASE_URL}/smart-bi/query`);
    await page.waitForLoadState('networkidle');

    // 找模板卡片
    const cards = page.locator('.template-card');
    const count = await cards.count();
    console.log('[T05] 模板卡片数:', count);

    if (count > 0) {
      await screenshot(page, '05a-templates-visible');

      // 获取所有卡片标题
      for (let i = 0; i < Math.min(count, 5); i++) {
        const cardTitle = await cards.nth(i).locator('.template-label, .template-card-header span').textContent().catch(() => '');
        console.log(`[T05] 模板卡片[${i}]:`, cardTitle?.trim());
      }

      // 测试分类筛选
      const catBtns = page.locator('.template-categories .el-button');
      const catCount = await catBtns.count();
      console.log('[T05] 分类按钮数:', catCount);

      if (catCount > 0) {
        await catBtns.first().click();
        await page.waitForTimeout(300);
        const filteredCount = await cards.count();
        console.log('[T05] 点击第一个分类后卡片数:', filteredCount);
        await screenshot(page, '05b-filtered-templates');
      }

      // 点击第一个卡片
      await cards.first().click();
      await page.waitForTimeout(300);
      await screenshot(page, '05c-after-template-click');
    }
  });

  test('06 - 消息气泡样式验证', async ({ page }) => {
    await page.goto(`${BASE_URL}/smart-bi/query`);
    await page.waitForLoadState('networkidle');

    // 发送一条消息
    const textarea = page.locator('textarea').first();
    await textarea.fill('什么是毛利率？');
    await page.keyboard.press('Enter');

    // 等待用户消息出现
    await page.waitForSelector('.chat-message.user', { timeout: 5000 });
    await screenshot(page, '06a-user-message-bubble');

    // 获取用户消息气泡样式
    const userBubble = page.locator('.chat-message.user .message-body').first();
    const userStyle = await userBubble.evaluate(el => {
      const style = window.getComputedStyle(el);
      return {
        background: style.backgroundColor,
        color: style.color,
        borderRadius: style.borderRadius,
      };
    }).catch(() => null);
    console.log('[T06] 用户消息气泡样式:', userStyle);

    // 检查头像
    const userAvatar = page.locator('.chat-message.user .message-avatar');
    const hasUserAvatar = await userAvatar.isVisible().catch(() => false);
    console.log('[T06] 用户头像可见:', hasUserAvatar);

    // 等待AI回复
    try {
      await page.waitForFunction(
        () => !document.querySelector('.loading-indicator'),
        { timeout: 30000 }
      );
    } catch {
      console.log('[T06] AI回复等待超时');
    }

    await screenshot(page, '06b-ai-message-bubble');

    // 获取AI消息气泡样式
    const aiBubble = page.locator('.chat-message.assistant .message-body').last();
    const aiStyle = await aiBubble.evaluate(el => {
      const style = window.getComputedStyle(el);
      return {
        background: style.backgroundColor,
        borderRadius: style.borderRadius,
      };
    }).catch(() => null);
    console.log('[T06] AI消息气泡样式:', aiStyle);

    // 检查是否有时间戳
    const timeStamps = await page.locator('.message-time').count();
    console.log('[T06] 时间戳数量:', timeStamps);
  });

  test('07 - 多轮对话测试', async ({ page }) => {
    await page.goto(`${BASE_URL}/smart-bi/query`);
    await page.waitForLoadState('networkidle');

    const queries = ['什么是食品添加剂？', '有哪些常用的防腐剂？'];

    for (let i = 0; i < queries.length; i++) {
      const textarea = page.locator('textarea').first();
      await textarea.fill(queries[i]);
      await page.keyboard.press('Enter');

      console.log(`[T07] 已发送第${i+1}个问题: ${queries[i]}`);

      // 等待AI回复
      try {
        await page.waitForFunction(
          () => !document.querySelector('.loading-indicator'),
          { timeout: 45000 }
        );
      } catch {
        console.log(`[T07] 第${i+1}个问题等待超时`);
      }

      await page.waitForTimeout(500);
    }

    await screenshot(page, '07-multi-turn');

    const totalMessages = await page.locator('.chat-message').count();
    const userMessages = await page.locator('.chat-message.user').count();
    const aiMessages = await page.locator('.chat-message.assistant').count();
    console.log(`[T07] 消息统计: 总数=${totalMessages}, 用户=${userMessages}, AI=${aiMessages}`);
  });

  test('08 - 清空对话功能', async ({ page }) => {
    await page.goto(`${BASE_URL}/smart-bi/query`);
    await page.waitForLoadState('networkidle');

    // 发送一条消息
    const textarea = page.locator('textarea').first();
    await textarea.fill('测试消息');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(1000);

    const beforeCount = await page.locator('.chat-message').count();
    console.log('[T08] 清空前消息数:', beforeCount);

    // 找清空按钮
    const clearBtn = page.locator('button:has-text("清空对话"), .el-button:has-text("清空")');
    const hasClearBtn = await clearBtn.count() > 0;
    console.log('[T08] 清空按钮存在:', hasClearBtn);

    if (hasClearBtn) {
      await clearBtn.first().click();
      await page.waitForTimeout(500);

      const afterCount = await page.locator('.chat-message').count();
      console.log('[T08] 清空后消息数:', afterCount);
      await screenshot(page, '08-after-clear');
    }
  });

  test('09 - 移动端适配测试 (375x812)', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto(`${BASE_URL}/smart-bi/query`);
    await page.waitForLoadState('networkidle');

    await screenshot(page, '09a-mobile-initial');

    // 检查侧边栏是否折叠
    const sidebar = page.locator('.app-sidebar, .el-aside, aside');
    const sidebarVisible = await sidebar.isVisible().catch(() => false);
    console.log('[T09] 移动端侧边栏可见:', sidebarVisible);

    // 检查输入框是否可操作
    const textarea = page.locator('textarea').first();
    const textareaVisible = await textarea.isVisible().catch(() => false);
    console.log('[T09] 移动端输入框可见:', textareaVisible);

    if (textareaVisible) {
      await textarea.fill('移动端测试');
      await screenshot(page, '09b-mobile-input');
    }

    // 检查快捷问题在移动端的显示
    const quickQuestions = page.locator('.quick-questions');
    const qqVisible = await quickQuestions.isVisible().catch(() => false);
    console.log('[T09] 移动端快捷问题可见:', qqVisible);

    // 获取快捷问题区域高度
    if (qqVisible) {
      const qqHeight = await quickQuestions.evaluate(el => el.getBoundingClientRect().height);
      console.log('[T09] 快捷问题区域高度:', qqHeight);
    }
  });

  test('10 - 控制台错误检查', async ({ page }) => {
    const errors: string[] = [];
    const warnings: string[] = [];

    page.on('console', msg => {
      if (msg.type() === 'error') errors.push(msg.text());
      if (msg.type() === 'warning') warnings.push(msg.text());
    });

    page.on('pageerror', err => {
      errors.push(`[PageError] ${err.message}`);
    });

    await page.goto(`${BASE_URL}/smart-bi/query`);
    await page.waitForLoadState('networkidle');

    // 发送一条消息触发API调用
    const textarea = page.locator('textarea').first();
    await textarea.fill('本月销售额');
    await page.keyboard.press('Enter');

    await page.waitForTimeout(3000);

    console.log('[T10] 控制台错误数:', errors.length);
    errors.forEach(e => console.log('[T10] ERROR:', e));

    console.log('[T10] 控制台警告数:', warnings.length);
    warnings.slice(0, 5).forEach(w => console.log('[T10] WARN:', w));
  });

  test('11 - 数据源选择器测试', async ({ page }) => {
    await page.goto(`${BASE_URL}/smart-bi/query`);
    await page.waitForLoadState('networkidle');

    // 找数据源选择器
    const selectEl = page.locator('.el-select').first();
    const selectVisible = await selectEl.isVisible().catch(() => false);
    console.log('[T11] 数据源选择器可见:', selectVisible);

    if (selectVisible) {
      await screenshot(page, '11a-data-source-selector');

      // 点击打开下拉
      await selectEl.click();
      await page.waitForTimeout(500);
      await screenshot(page, '11b-data-source-dropdown');

      // 获取选项数
      const options = page.locator('.el-select-dropdown__item');
      const optCount = await options.count();
      console.log('[T11] 数据源选项数:', optCount);

      for (let i = 0; i < Math.min(optCount, 5); i++) {
        const optText = await options.nth(i).textContent();
        console.log(`[T11] 数据源[${i}]:`, optText?.trim());
      }
    }
  });

  test('12 - 错误场景：无数据源时发送问题', async ({ page }) => {
    await page.goto(`${BASE_URL}/smart-bi/query`);
    await page.waitForLoadState('networkidle');

    await screenshot(page, '12a-no-datasource-initial');

    // 尝试发送
    const textarea = page.locator('textarea').first();
    await textarea.fill('测试无数据源场景');
    await page.keyboard.press('Enter');

    await page.waitForTimeout(3000);
    await screenshot(page, '12b-no-datasource-response');

    // 检查错误消息内容
    const lastAiMsg = page.locator('.chat-message.assistant').last();
    const errorContent = await lastAiMsg.textContent().catch(() => '');
    console.log('[T12] 无数据源错误消息:', errorContent?.substring(0, 200));
  });

  test('13 - 全页面视觉截图（桌面端）', async ({ page }) => {
    await page.goto(`${BASE_URL}/smart-bi/query`);
    await page.waitForLoadState('networkidle');

    await screenshot(page, '13-full-desktop-initial');

    // 发送几个问题
    const queries = ['销售趋势分析', '利润分析'];
    for (const q of queries) {
      const textarea = page.locator('textarea').first();
      await textarea.fill(q);
      await page.keyboard.press('Enter');

      try {
        await page.waitForFunction(
          () => !document.querySelector('.loading-indicator'),
          { timeout: 30000 }
        );
      } catch {
        console.log(`[T13] ${q} 等待超时`);
      }
      await page.waitForTimeout(500);
    }

    await screenshot(page, '13-full-desktop-with-messages');

    // 滚动到顶部截图
    await page.locator('.chat-history').evaluate(el => el.scrollTop = 0);
    await page.waitForTimeout(300);
    await screenshot(page, '13-full-desktop-top');

    // 滚动到底部截图
    await page.locator('.chat-history').evaluate(el => el.scrollTop = el.scrollHeight);
    await page.waitForTimeout(300);
    await screenshot(page, '13-full-desktop-bottom');
  });
});
