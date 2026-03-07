/**
 * AI Chat Quick Audit — shorter timeouts, focused checks
 */
import { test, expect, Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const BASE_URL = 'http://139.196.165.140:8086';
const SCREENSHOT_DIR = path.resolve(__dirname, 'screenshots/ai-chat-quick');

if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

async function screenshot(page: Page, name: string) {
  try {
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, `${name}.png`) });
  } catch (e) {
    console.log('[SCREENSHOT FAIL]', name, e);
  }
}

async function login(page: Page) {
  await page.goto(`${BASE_URL}/login`, { timeout: 20000 });
  await page.waitForLoadState('domcontentloaded');
  await screenshot(page, '00-login-page');

  // Try multiple selector patterns
  const usernameSelectors = [
    'input[placeholder*="用户名"]',
    'input[placeholder*="username"]',
    'input[type="text"]',
    '.el-input input[type="text"]',
  ];

  let filled = false;
  for (const sel of usernameSelectors) {
    try {
      await page.fill(sel, 'factory_admin1', { timeout: 3000 });
      filled = true;
      console.log('[LOGIN] 用户名字段选择器:', sel);
      break;
    } catch { /* try next */ }
  }

  const pwSelectors = [
    'input[placeholder*="密码"]',
    'input[placeholder*="password"]',
    'input[type="password"]',
  ];
  for (const sel of pwSelectors) {
    try {
      await page.fill(sel, '123456', { timeout: 3000 });
      break;
    } catch { /* try next */ }
  }

  await screenshot(page, '00-login-filled');

  // Try submit
  const submitSelectors = [
    'button[type="submit"]',
    'button:has-text("登录")',
    '.login-btn',
    '.el-button--primary',
  ];
  for (const sel of submitSelectors) {
    try {
      await page.click(sel, { timeout: 3000 });
      console.log('[LOGIN] 提交按钮选择器:', sel);
      break;
    } catch { /* try next */ }
  }

  try {
    await page.waitForURL(url => !url.includes('/login'), { timeout: 15000 });
    console.log('[LOGIN] 登录成功, URL:', page.url());
  } catch {
    console.log('[LOGIN] 可能仍在登录页, URL:', page.url());
    await screenshot(page, '00-login-fail');
  }
}

test.describe('AI问答 快速审计', () => {

  test('A - 登录并截图登录页及初始状态', async ({ page }) => {
    page.setDefaultTimeout(20000);
    await login(page);

    await page.goto(`${BASE_URL}/smart-bi/query`, { timeout: 20000 });
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    await screenshot(page, 'A1-ai-query-initial');

    const url = page.url();
    const title = await page.title();
    console.log('[A] URL:', url, 'Title:', title);

    // DOM 结构检查
    const structure = await page.evaluate(() => {
      const checks = {
        hasPageHeader: !!document.querySelector('.page-header'),
        hasH1: document.querySelector('h1')?.textContent?.trim() || 'NO H1',
        hasChatContainer: !!document.querySelector('.chat-container'),
        hasChatHistory: !!document.querySelector('.chat-history'),
        hasInputArea: !!document.querySelector('.input-area'),
        hasTextarea: !!document.querySelector('textarea'),
        hasSendBtn: !!document.querySelector('button[class*="primary"]'),
        hasQuickQuestions: !!document.querySelector('.quick-questions'),
        hasTemplateSection: !!document.querySelector('.template-section'),
        hasTemplateCards: document.querySelectorAll('.template-card').length,
        hasDataSourceSelect: !!document.querySelector('.el-select'),
        chatMessageCount: document.querySelectorAll('.chat-message').length,
        welcomeMessageText: document.querySelector('.chat-message.assistant .message-text')?.textContent?.trim().substring(0, 100) || 'N/A',
      };
      return checks;
    });

    console.log('[A] DOM 结构:', JSON.stringify(structure, null, 2));
  });

  test('B - 输入框交互与发送按钮状态', async ({ page }) => {
    page.setDefaultTimeout(20000);
    await login(page);
    await page.goto(`${BASE_URL}/smart-bi/query`, { timeout: 20000 });
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1500);

    // 检查发送按钮初始状态
    const btnState = await page.evaluate(() => {
      const sendBtns = Array.from(document.querySelectorAll('button'));
      const sendBtn = sendBtns.find(b => b.textContent?.includes('发送'));
      if (!sendBtn) return { found: false };
      return {
        found: true,
        disabled: sendBtn.disabled || sendBtn.hasAttribute('disabled'),
        className: sendBtn.className,
        text: sendBtn.textContent?.trim(),
      };
    });
    console.log('[B] 发送按钮初始状态:', JSON.stringify(btnState));

    // 输入文字
    const textarea = page.locator('textarea').first();
    if (await textarea.isVisible({ timeout: 5000 }).catch(() => false)) {
      await textarea.fill('今天的库存情况');
      await screenshot(page, 'B1-input-filled');

      const btnStateAfter = await page.evaluate(() => {
        const sendBtns = Array.from(document.querySelectorAll('button'));
        const sendBtn = sendBtns.find(b => b.textContent?.includes('发送'));
        if (!sendBtn) return { found: false };
        return {
          disabled: sendBtn.disabled || sendBtn.hasAttribute('disabled'),
          classes: sendBtn.className,
        };
      });
      console.log('[B] 输入后发送按钮状态:', JSON.stringify(btnStateAfter));

      // 测试placeholder
      const placeholder = await textarea.getAttribute('placeholder');
      console.log('[B] 输入框 placeholder:', placeholder);

      // 测试Shift+Enter不发送
      await textarea.press('Shift+Enter');
      const valueAfter = await textarea.inputValue();
      const hasNewline = valueAfter.includes('\n');
      console.log('[B] Shift+Enter 后有换行:', hasNewline, '内容:', JSON.stringify(valueAfter));

      await screenshot(page, 'B2-shift-enter');
    } else {
      console.log('[B] textarea 不可见');
    }
  });

  test('C - 发送消息观察流式加载', async ({ page }) => {
    page.setDefaultTimeout(30000);
    const errors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') errors.push(msg.text().substring(0, 200));
    });

    await login(page);
    await page.goto(`${BASE_URL}/smart-bi/query`, { timeout: 20000 });
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    const textarea = page.locator('textarea').first();
    if (!await textarea.isVisible({ timeout: 5000 }).catch(() => false)) {
      console.log('[C] 无法找到textarea，跳过');
      return;
    }

    await textarea.fill('本月销售额是多少？');
    await screenshot(page, 'C1-before-send');

    // 发送
    await page.keyboard.press('Enter');
    await page.waitForTimeout(300);
    await screenshot(page, 'C2-just-sent');

    // 检查 loading 状态
    const loadingState = await page.evaluate(() => {
      return {
        hasLoadingIndicator: !!document.querySelector('.loading-indicator'),
        hasIsLoading: !!document.querySelector('.is-loading'),
        loadingText: document.querySelector('.loading-indicator')?.textContent?.trim() || null,
        isTypingValue: (window as any).__vue_app__ ? 'vue app found' : 'no vue',
      };
    });
    console.log('[C] 加载状态:', JSON.stringify(loadingState));
    await screenshot(page, 'C3-loading-state');

    // 等待响应 (最多30秒)
    let responded = false;
    for (let i = 0; i < 30; i++) {
      await page.waitForTimeout(1000);
      const stillLoading = await page.locator('.loading-indicator').isVisible().catch(() => false);
      if (!stillLoading) {
        responded = true;
        console.log(`[C] 在 ${i+1}s 时收到响应`);
        break;
      }
    }

    await screenshot(page, 'C4-after-response');

    const finalState = await page.evaluate(() => {
      const messages = document.querySelectorAll('.chat-message');
      const lastAI = document.querySelector('.chat-message.assistant:last-child');
      return {
        totalMessages: messages.length,
        lastAIContent: lastAI?.querySelector('.message-text')?.textContent?.substring(0, 200) || null,
        hasChart: !!document.querySelector('.chart-container, #chart-'),
        hasTable: !!document.querySelector('.message-table'),
        hasMarkdown: !!document.querySelector('.markdown-body'),
        hasInsights: !!document.querySelector('.message-insights'),
      };
    });
    console.log('[C] 最终状态:', JSON.stringify(finalState));
    console.log('[C] 控制台错误数:', errors.length);
    if (errors.length > 0) errors.forEach(e => console.log('[C] ERROR:', e));
  });

  test('D - 快捷问题和分析模板', async ({ page }) => {
    page.setDefaultTimeout(20000);
    await login(page);
    await page.goto(`${BASE_URL}/smart-bi/query`, { timeout: 20000 });
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    // 分析模板
    const templateInfo = await page.evaluate(() => {
      const cards = document.querySelectorAll('.template-card');
      const catBtns = document.querySelectorAll('.template-categories .el-button');
      return {
        templateCount: cards.length,
        templateLabels: Array.from(cards).slice(0, 6).map(c =>
          c.querySelector('.template-label, span')?.textContent?.trim() || ''
        ),
        catBtnCount: catBtns.length,
        catLabels: Array.from(catBtns).map(b => b.textContent?.trim() || ''),
      };
    });
    console.log('[D] 分析模板:', JSON.stringify(templateInfo, null, 2));
    await screenshot(page, 'D1-templates');

    // 快捷问题
    const quickInfo = await page.evaluate(() => {
      const qqSection = document.querySelector('.quick-questions');
      const btns = document.querySelectorAll('.quick-questions button, .questions-list .el-button');
      return {
        sectionVisible: !!qqSection,
        btnCount: btns.length,
        btnTexts: Array.from(btns).map(b => b.textContent?.trim() || ''),
      };
    });
    console.log('[D] 快捷问题:', JSON.stringify(quickInfo, null, 2));

    // 点击一个分类按钮
    const catBtns = page.locator('.template-categories .el-button');
    if (await catBtns.count() > 0) {
      await catBtns.first().click();
      await page.waitForTimeout(500);
      await screenshot(page, 'D2-filtered-templates');
      const filteredCount = await page.locator('.template-card').count();
      console.log('[D] 过滤后模板卡片数:', filteredCount);
    }
  });

  test('E - 消息气泡样式详细检查', async ({ page }) => {
    page.setDefaultTimeout(20000);
    await login(page);
    await page.goto(`${BASE_URL}/smart-bi/query`, { timeout: 20000 });
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    // 发送消息
    const textarea = page.locator('textarea').first();
    if (!await textarea.isVisible({ timeout: 5000 }).catch(() => false)) return;

    await textarea.fill('你好');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(1000);
    await screenshot(page, 'E1-user-message');

    // 获取用户消息样式
    const userMsgStyle = await page.evaluate(() => {
      const userMsg = document.querySelector('.chat-message.user .message-body');
      if (!userMsg) return null;
      const s = window.getComputedStyle(userMsg);
      return {
        background: s.backgroundColor,
        color: s.color,
        borderRadius: s.borderRadius,
        padding: s.padding,
      };
    });
    console.log('[E] 用户消息气泡样式:', JSON.stringify(userMsgStyle));

    // 获取欢迎消息样式（AI消息）
    const aiMsgStyle = await page.evaluate(() => {
      const aiMsg = document.querySelector('.chat-message.assistant .message-body');
      if (!aiMsg) return null;
      const s = window.getComputedStyle(aiMsg);
      return {
        background: s.backgroundColor,
        borderRadius: s.borderRadius,
        padding: s.padding,
      };
    });
    console.log('[E] AI消息气泡样式:', JSON.stringify(aiMsgStyle));

    // 检查头像
    const avatarInfo = await page.evaluate(() => {
      const userAvatar = document.querySelector('.chat-message.user .message-avatar');
      const aiAvatar = document.querySelector('.chat-message.assistant .message-avatar');
      return {
        userAvatarBg: userAvatar ? window.getComputedStyle(userAvatar).backgroundColor : null,
        aiAvatarBg: aiAvatar ? window.getComputedStyle(aiAvatar).backgroundColor : null,
        hasUserIcon: !!userAvatar?.querySelector('.el-icon'),
        hasAiIcon: !!aiAvatar?.querySelector('.el-icon'),
      };
    });
    console.log('[E] 头像信息:', JSON.stringify(avatarInfo));

    // 检查时间戳
    const tsInfo = await page.evaluate(() => {
      const timestamps = document.querySelectorAll('.message-time');
      return {
        count: timestamps.length,
        sample: timestamps[0]?.textContent?.trim() || null,
      };
    });
    console.log('[E] 时间戳:', JSON.stringify(tsInfo));

    // 检查消息宽度
    const widthInfo = await page.evaluate(() => {
      const msgContent = document.querySelector('.chat-message.assistant .message-content');
      if (!msgContent) return null;
      const s = window.getComputedStyle(msgContent);
      return { maxWidth: s.maxWidth };
    });
    console.log('[E] 消息宽度限制:', JSON.stringify(widthInfo));
  });

  test('F - 移动端适配测试 375x812', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    page.setDefaultTimeout(20000);
    await login(page);
    await page.goto(`${BASE_URL}/smart-bi/query`, { timeout: 20000 });
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    await screenshot(page, 'F1-mobile-initial');

    const mobileLayout = await page.evaluate(() => {
      const sidebar = document.querySelector('.app-sidebar, .el-aside, .sidebar');
      const mainContent = document.querySelector('.el-main, .app-main, main');
      const chatContainer = document.querySelector('.chat-container');
      const inputArea = document.querySelector('.input-area');
      const quickQuestions = document.querySelector('.quick-questions');

      return {
        sidebarWidth: sidebar ? window.getComputedStyle(sidebar).width : 'not found',
        mainContentWidth: mainContent ? window.getComputedStyle(mainContent).width : 'not found',
        chatContainerWidth: chatContainer ? chatContainer.getBoundingClientRect().width : 0,
        inputAreaHeight: inputArea ? inputArea.getBoundingClientRect().height : 0,
        quickQuestionsOverflows: quickQuestions ?
          quickQuestions.scrollWidth > quickQuestions.clientWidth : false,
        viewportWidth: window.innerWidth,
      };
    });
    console.log('[F] 移动端布局:', JSON.stringify(mobileLayout, null, 2));

    // 检查 mobile media query 生效
    const msgMaxWidth = await page.evaluate(() => {
      const msgContent = document.querySelector('.chat-message .message-content');
      return msgContent ? window.getComputedStyle(msgContent).maxWidth : null;
    });
    console.log('[F] 移动端消息最大宽度:', msgMaxWidth);

    await screenshot(page, 'F2-mobile-scroll-area');
  });

  test('G - 清空对话和历史管理', async ({ page }) => {
    page.setDefaultTimeout(20000);
    await login(page);
    await page.goto(`${BASE_URL}/smart-bi/query`, { timeout: 20000 });
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    // 检查清空按钮
    const clearBtnInfo = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const clearBtn = btns.find(b => b.textContent?.includes('清空'));
      return clearBtn ? {
        found: true,
        text: clearBtn.textContent?.trim(),
        hasIcon: !!clearBtn.querySelector('.el-icon'),
      } : { found: false };
    });
    console.log('[G] 清空按钮:', JSON.stringify(clearBtnInfo));

    // 检查是否有对话持久化（localStorage）
    const storageInfo = await page.evaluate(() => {
      const keys = Object.keys(localStorage).filter(k =>
        k.includes('chat') || k.includes('history') || k.includes('smartbi')
      );
      return { relevantKeys: keys };
    });
    console.log('[G] localStorage 相关键:', JSON.stringify(storageInfo));

    // 点击清空
    const clearBtn = page.locator('button:has-text("清空对话"), button:has-text("清空")').first();
    if (await clearBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await clearBtn.click();
      await page.waitForTimeout(500);
      await screenshot(page, 'G1-after-clear');

      const afterClearMsgCount = await page.locator('.chat-message').count();
      console.log('[G] 清空后消息数:', afterClearMsgCount);
    }
  });

  test('H - 完整UI截图存档', async ({ page }) => {
    page.setDefaultTimeout(20000);
    await login(page);
    await page.goto(`${BASE_URL}/smart-bi/query`, { timeout: 20000 });
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(3000);

    // 全屏截图
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, 'H1-full-page.png'),
      fullPage: true
    });

    // 头部区域
    const header = page.locator('.page-header');
    if (await header.isVisible({ timeout: 3000 }).catch(() => false)) {
      await header.screenshot({ path: path.join(SCREENSHOT_DIR, 'H2-header.png') });
    }

    // 输入区域
    const inputArea = page.locator('.input-area');
    if (await inputArea.isVisible({ timeout: 3000 }).catch(() => false)) {
      await inputArea.screenshot({ path: path.join(SCREENSHOT_DIR, 'H3-input-area.png') });
    }

    // 模板区域
    const templates = page.locator('.template-section');
    if (await templates.isVisible({ timeout: 3000 }).catch(() => false)) {
      await templates.screenshot({ path: path.join(SCREENSHOT_DIR, 'H4-templates.png') });
    }

    console.log('[H] 截图完成');

    // 收集最终汇总信息
    const summary = await page.evaluate(() => {
      return {
        pageTitle: document.title,
        h1Text: document.querySelector('h1')?.textContent?.trim(),
        sendBtnText: Array.from(document.querySelectorAll('button'))
          .find(b => b.textContent?.includes('发送'))?.textContent?.trim(),
        clearBtnText: Array.from(document.querySelectorAll('button'))
          .find(b => b.textContent?.includes('清空'))?.textContent?.trim(),
        templateCount: document.querySelectorAll('.template-card').length,
        quickQuestionCount: document.querySelectorAll('.quick-questions button, .questions-list .el-button').length,
        welcomeMessage: document.querySelector('.chat-message.assistant .message-text')?.textContent?.substring(0, 150),
        hasDataSourceSelector: !!document.querySelector('.el-select'),
        responsiveBreakpoint: window.innerWidth,
      };
    });
    console.log('[H] 汇总信息:', JSON.stringify(summary, null, 2));
  });
});
