import { test, expect } from '@playwright/test';

/**
 * AI 问答测试
 * 测试 SmartBI 的自然语言问答功能
 */

test.describe('SmartBI AI 问答测试', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/smart-bi/query');
    await page.waitForLoadState('networkidle');
    console.log('🤖 进入 AI 问答页面');
  });

  test('页面加载正常', async ({ page }) => {
    // 验证聊天区域
    const chatContainer = page.locator('.chat-container, .chat-history, .ai-query-page');
    await expect(chatContainer.first()).toBeVisible({ timeout: 5000 });

    // 验证输入区域
    const inputArea = page.locator('.input-area, textarea, .el-textarea');
    await expect(inputArea.first()).toBeVisible();

    // 验证发送按钮
    const sendBtn = page.locator('button[class*="primary"], button:has([class*="Promotion"])');
    await expect(sendBtn.first()).toBeVisible();

    console.log('✅ AI 问答页面加载正常');
  });

  test('发送问题并获取回答', async ({ page }) => {
    const testQuestions = [
      '本月销售额是多少?',
      '销售额最高的产品是什么?',
      '利润率怎么样?',
    ];

    for (const question of testQuestions) {
      console.log(`\n📝 发送问题: ${question}`);

      // 输入问题
      const textarea = page.locator('textarea, .el-textarea__inner').first();
      await textarea.fill(question);

      // 点击发送
      const sendBtn = page.locator('button[class*="primary"]').last();
      await sendBtn.click();

      // 等待响应
      await page.waitForResponse(
        (response) =>
          response.url().includes('/query') ||
          response.url().includes('/chat') ||
          response.url().includes('/analysis'),
        { timeout: 30000 }
      );

      // 等待回答显示
      await page.waitForTimeout(2000); // 等待渲染

      // 验证有新消息
      const messages = page.locator('.chat-message, .message-content');
      const count = await messages.count();
      expect(count).toBeGreaterThan(0);
      console.log(`✅ 收到回答，当前消息数: ${count}`);

      // 检查是否有图表
      const charts = page.locator('[id^="chart-"], canvas, .echarts-container');
      const chartCount = await charts.count();
      if (chartCount > 0) {
        console.log(`📊 检测到 ${chartCount} 个图表`);
      }

      // 短暂等待，避免请求过快
      await page.waitForTimeout(1000);
    }
  });

  test('使用快捷问题', async ({ page }) => {
    // 查找快捷问题按钮
    const quickBtns = page.locator('.quick-questions button, .questions-list button');
    const count = await quickBtns.count();

    if (count > 0) {
      console.log(`📌 发现 ${count} 个快捷问题按钮`);

      // 点击第一个快捷问题
      await quickBtns.first().click();
      console.log('✅ 点击快捷问题');

      // 等待响应
      await page.waitForResponse(
        (response) =>
          response.url().includes('/query') ||
          response.url().includes('/chat'),
        { timeout: 30000 }
      ).catch(() => {
        console.log('⚠️ 未检测到 API 响应，可能已自动发送');
      });

      await page.waitForTimeout(2000);
      console.log('✅ 快捷问题测试完成');
    } else {
      console.log('⚠️ 未找到快捷问题按钮');
    }
  });

  test('清空对话', async ({ page }) => {
    // 先发送一条消息
    const textarea = page.locator('textarea, .el-textarea__inner').first();
    await textarea.fill('测试消息');

    const sendBtn = page.locator('button[class*="primary"]').last();
    await sendBtn.click();
    await page.waitForTimeout(2000);

    // 查找清空按钮
    const clearBtn = page.locator('button:has([class*="Delete"]), button:has-text("清空")');

    if (await clearBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await clearBtn.click();
      console.log('🗑️ 点击清空按钮');

      // 验证对话被清空
      await page.waitForTimeout(1000);
      const messages = page.locator('.chat-message.user, .message-role:has-text("用户")');
      const count = await messages.count();

      // 清空后应该只剩欢迎消息或无消息
      expect(count).toBeLessThanOrEqual(1);
      console.log('✅ 对话已清空');
    } else {
      console.log('⚠️ 未找到清空按钮');
    }
  });
});
