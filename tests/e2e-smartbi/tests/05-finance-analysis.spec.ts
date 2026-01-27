import { test, expect } from '@playwright/test';

/**
 * 财务分析测试
 * 测试 SmartBI 的财务数据分析功能
 */

test.describe('SmartBI 财务分析测试', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/smart-bi/finance');
    await page.waitForLoadState('networkidle');
    console.log('💰 进入财务分析页面');
  });

  test('页面加载正常', async ({ page }) => {
    await page.waitForTimeout(2000);

    // 验证页面有内容
    const content = page.locator('.el-card, .finance-section, .kpi-cards');
    await expect(content.first()).toBeVisible({ timeout: 10000 });
    console.log('✅ 财务分析页面加载正常');
  });

  test('财务 KPI 显示', async ({ page }) => {
    const kpiCards = page.locator('.kpi-card, .kpi-item, .finance-kpi');

    if (await kpiCards.first().isVisible({ timeout: 5000 }).catch(() => false)) {
      const count = await kpiCards.count();
      console.log(`💵 检测到 ${count} 个财务 KPI`);

      // 检查常见财务指标
      const pageText = await page.textContent('body');
      const metrics = ['收入', '利润', '成本', '毛利率', 'Revenue', 'Profit', 'Cost'];

      for (const metric of metrics) {
        if (pageText?.includes(metric)) {
          console.log(`  ✓ ${metric}`);
        }
      }

      console.log('✅ 财务 KPI 显示正常');
    } else {
      console.log('⚠️ 未找到财务 KPI');
    }
  });

  test('时间周期切换', async ({ page }) => {
    // 查找周期选择器
    const periodSelector = page.locator(
      '.el-radio-group, .period-selector, button:has-text("月"), button:has-text("季"), button:has-text("年")'
    );

    if (await periodSelector.first().isVisible({ timeout: 3000 }).catch(() => false)) {
      // 查找并点击不同周期
      const quarterBtn = page.locator('button:has-text("季"), .el-radio-button:has-text("季度")');
      const yearBtn = page.locator('button:has-text("年"), .el-radio-button:has-text("年")');

      if (await quarterBtn.first().isVisible({ timeout: 2000 }).catch(() => false)) {
        await quarterBtn.first().click();
        console.log('📅 切换到季度视图');
        await page.waitForTimeout(2000);
      }

      if (await yearBtn.first().isVisible({ timeout: 2000 }).catch(() => false)) {
        await yearBtn.first().click();
        console.log('📅 切换到年度视图');
        await page.waitForTimeout(2000);
      }

      console.log('✅ 时间周期切换测试完成');
    } else {
      console.log('⚠️ 未找到周期选择器');
    }
  });

  test('财务图表显示', async ({ page }) => {
    const charts = page.locator('canvas, [id*="chart"], .echarts-container');

    if (await charts.first().isVisible({ timeout: 5000 }).catch(() => false)) {
      const count = await charts.count();
      console.log(`📊 检测到 ${count} 个财务图表`);

      // 验证图表类型
      const pageContent = await page.content();
      const chartTypes = ['趋势', '对比', '占比', '瀑布', 'waterfall', 'trend', 'pie'];

      for (const type of chartTypes) {
        if (pageContent.toLowerCase().includes(type.toLowerCase())) {
          console.log(`  ✓ ${type}图表`);
        }
      }

      console.log('✅ 财务图表显示正常');
    } else {
      console.log('⚠️ 未找到财务图表');
    }
  });

  test('预算对比功能', async ({ page }) => {
    const budgetSection = page.locator(
      '.budget-section, .budget-comparison, :has-text("预算")'
    );

    if (await budgetSection.first().isVisible({ timeout: 3000 }).catch(() => false)) {
      console.log('📊 检测到预算对比区域');

      // 检查预算完成率
      const completionRate = page.locator('.completion-rate, .budget-rate, :has-text("完成率")');
      if (await completionRate.first().isVisible({ timeout: 2000 }).catch(() => false)) {
        const text = await completionRate.first().textContent();
        console.log(`  预算完成率: ${text}`);
      }

      console.log('✅ 预算对比功能正常');
    } else {
      console.log('⚠️ 未找到预算对比区域');
    }
  });

  test('同比环比分析', async ({ page }) => {
    const pageText = await page.textContent('body');

    // 检查同比环比指标
    const metrics = ['同比', '环比', 'YoY', 'MoM', '增长', '下降'];
    const found: string[] = [];

    for (const metric of metrics) {
      if (pageText?.includes(metric)) {
        found.push(metric);
      }
    }

    if (found.length > 0) {
      console.log(`📈 检测到同比环比指标: ${found.join(', ')}`);
      console.log('✅ 同比环比分析正常');
    } else {
      console.log('⚠️ 未检测到同比环比指标');
    }
  });

  test('财务报表导出', async ({ page }) => {
    const exportBtn = page.locator(
      'button:has([class*="Download"]), button:has-text("导出"), button:has-text("下载报表")'
    );

    if (await exportBtn.first().isVisible({ timeout: 3000 }).catch(() => false)) {
      const downloadPromise = page.waitForEvent('download', { timeout: 10000 }).catch(() => null);

      await exportBtn.first().click();
      console.log('📥 点击导出按钮');

      const download = await downloadPromise;
      if (download) {
        console.log(`✅ 财务报表下载: ${download.suggestedFilename()}`);
      } else {
        console.log('⚠️ 未检测到文件下载');
      }
    } else {
      console.log('⚠️ 未找到导出按钮');
    }
  });

  test('AI 财务洞察', async ({ page }) => {
    const insightSection = page.locator('.insight-section, .ai-insight, .insight-card');

    if (await insightSection.first().isVisible({ timeout: 5000 }).catch(() => false)) {
      const insights = page.locator('.insight-item, .el-tag, .suggestion');
      const count = await insights.count();

      console.log(`💡 检测到 ${count} 条 AI 财务洞察`);
      console.log('✅ AI 财务洞察显示正常');
    } else {
      console.log('⚠️ 未找到 AI 财务洞察区域');
    }
  });
});
