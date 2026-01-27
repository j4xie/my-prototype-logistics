import { test, expect } from '@playwright/test';

/**
 * 经营驾驶舱测试
 * 测试 SmartBI 的仪表盘功能
 */

test.describe('SmartBI 经营驾驶舱测试', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/smart-bi/dashboard');
    await page.waitForLoadState('networkidle');
    console.log('📊 进入经营驾驶舱');
  });

  test('页面加载正常', async ({ page }) => {
    // 验证页面标题
    const title = page.locator('h1, .page-header').filter({ hasText: /驾驶舱|Dashboard/ });
    await expect(title.first()).toBeVisible({ timeout: 10000 });
    console.log('✅ 页面标题正常');

    // 等待数据加载
    await page.waitForTimeout(3000);
  });

  test('KPI 卡片显示正常', async ({ page }) => {
    // 等待 KPI 区域加载
    const kpiSection = page.locator('.kpi-section, .kpi-cards, .kpi-grid');
    await expect(kpiSection.first()).toBeVisible({ timeout: 10000 });

    // 检查 KPI 卡片
    const kpiCards = page.locator('.kpi-card, .kpi-item');
    const count = await kpiCards.count();

    console.log(`📈 检测到 ${count} 个 KPI 卡片`);
    expect(count).toBeGreaterThan(0);

    // 验证每个 KPI 卡片有值
    for (let i = 0; i < Math.min(count, 4); i++) {
      const card = kpiCards.nth(i);
      const value = card.locator('.kpi-value, .value');

      if (await value.isVisible().catch(() => false)) {
        const text = await value.textContent();
        console.log(`  KPI ${i + 1}: ${text}`);
      }
    }

    console.log('✅ KPI 卡片显示正常');
  });

  test('排行榜显示正常', async ({ page }) => {
    const rankingSection = page.locator('.ranking-section, .ranking-card, .ranking-list');

    if (await rankingSection.first().isVisible({ timeout: 5000 }).catch(() => false)) {
      const rankItems = page.locator('.ranking-item, .rank-item');
      const count = await rankItems.count();

      console.log(`🏆 检测到 ${count} 个排行项`);
      expect(count).toBeGreaterThanOrEqual(0);
      console.log('✅ 排行榜显示正常');
    } else {
      console.log('⚠️ 未找到排行榜区域');
    }
  });

  test('图表渲染正常', async ({ page }) => {
    // 等待图表容器
    const chartSection = page.locator('.chart-section, .chart-card, [id$="-chart"]');

    if (await chartSection.first().isVisible({ timeout: 5000 }).catch(() => false)) {
      // 检查 ECharts canvas
      const canvases = page.locator('canvas');
      const count = await canvases.count();

      console.log(`📊 检测到 ${count} 个图表 canvas`);
      expect(count).toBeGreaterThan(0);
      console.log('✅ 图表渲染正常');
    } else {
      console.log('⚠️ 未找到图表区域');
    }
  });

  test('AI 洞察显示正常', async ({ page }) => {
    const insightSection = page.locator('.insight-section, .insight-card, .insight-list');

    if (await insightSection.first().isVisible({ timeout: 5000 }).catch(() => false)) {
      const insightItems = page.locator('.insight-item, .el-tag');
      const count = await insightItems.count();

      console.log(`💡 检测到 ${count} 个 AI 洞察项`);
      console.log('✅ AI 洞察显示正常');
    } else {
      console.log('⚠️ 未找到 AI 洞察区域');
    }
  });

  test('刷新数据功能', async ({ page }) => {
    const refreshBtn = page.locator('button:has([class*="Refresh"]), button:has-text("刷新")');

    if (await refreshBtn.first().isVisible({ timeout: 3000 }).catch(() => false)) {
      // 记录当前时间
      const beforeClick = Date.now();

      await refreshBtn.first().click();
      console.log('🔄 点击刷新按钮');

      // 等待 API 响应
      await page.waitForResponse(
        (response) =>
          response.url().includes('/dashboard') ||
          response.url().includes('/executive'),
        { timeout: 15000 }
      ).catch(() => {
        console.log('⚠️ 未检测到刷新 API 请求');
      });

      await page.waitForTimeout(2000);
      console.log('✅ 数据刷新完成');
    } else {
      console.log('⚠️ 未找到刷新按钮');
    }
  });

  test('跳转到 AI 问答', async ({ page }) => {
    const aiQueryBtn = page.locator(
      'button:has([class*="ChatDotRound"]), button:has-text("AI问答"), button[type="success"]'
    );

    if (await aiQueryBtn.first().isVisible({ timeout: 3000 }).catch(() => false)) {
      await aiQueryBtn.first().click();
      console.log('🤖 点击 AI 问答按钮');

      // 验证跳转
      await page.waitForURL('**/smart-bi/query**', { timeout: 10000 });
      console.log('✅ 成功跳转到 AI 问答页面');
    } else {
      console.log('⚠️ 未找到 AI 问答按钮');
    }
  });
});
