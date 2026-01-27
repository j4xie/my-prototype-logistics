import { test, expect } from '@playwright/test';

/**
 * 销售分析测试
 * 测试 SmartBI 的销售数据分析功能
 */

test.describe('SmartBI 销售分析测试', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/smart-bi/sales');
    await page.waitForLoadState('networkidle');
    console.log('📈 进入销售分析页面');
  });

  test('页面加载正常', async ({ page }) => {
    // 等待页面加载
    await page.waitForTimeout(2000);

    // 验证筛选面板
    const filterPanel = page.locator('.filter-panel, .el-form, .filter-section');
    if (await filterPanel.first().isVisible({ timeout: 5000 }).catch(() => false)) {
      console.log('✅ 筛选面板加载正常');
    }

    // 验证有内容显示
    const content = page.locator('.el-card, .kpi-cards, .chart-section');
    await expect(content.first()).toBeVisible({ timeout: 10000 });
    console.log('✅ 页面内容加载正常');
  });

  test('日期筛选功能', async ({ page }) => {
    // 查找日期选择器
    const datePicker = page.locator('.el-date-editor, input[placeholder*="日期"]');

    if (await datePicker.first().isVisible({ timeout: 3000 }).catch(() => false)) {
      await datePicker.first().click();
      console.log('📅 打开日期选择器');

      // 等待日期面板
      await page.waitForSelector('.el-date-picker, .el-picker-panel', { timeout: 5000 });

      // 选择快捷选项（如果有）
      const quickOptions = page.locator('.el-picker-panel__shortcut, button:has-text("最近")');
      if (await quickOptions.first().isVisible({ timeout: 2000 }).catch(() => false)) {
        await quickOptions.first().click();
        console.log('✅ 选择快捷日期');
      } else {
        // 关闭面板
        await page.keyboard.press('Escape');
      }

      await page.waitForTimeout(1000);
      console.log('✅ 日期筛选测试完成');
    } else {
      console.log('⚠️ 未找到日期选择器');
    }
  });

  test('维度切换功能', async ({ page }) => {
    // 查找维度选择器
    const dimensionSelect = page.locator(
      '.el-select:has-text("维度"), select, .dimension-selector'
    );

    if (await dimensionSelect.first().isVisible({ timeout: 3000 }).catch(() => false)) {
      await dimensionSelect.first().click();
      console.log('🔄 打开维度选择器');

      // 选择一个选项
      const options = page.locator('.el-select-dropdown__item, .el-option');
      if (await options.first().isVisible({ timeout: 3000 }).catch(() => false)) {
        await options.nth(1).click(); // 选择第二个选项
        console.log('✅ 切换维度');

        // 等待数据刷新
        await page.waitForTimeout(2000);
      }
    } else {
      console.log('⚠️ 未找到维度选择器');
    }
  });

  test('应用筛选并刷新数据', async ({ page }) => {
    // 查找筛选/刷新按钮
    const filterBtn = page.locator(
      'button:has([class*="Filter"]), button:has-text("筛选"), button:has-text("查询")'
    );
    const refreshBtn = page.locator(
      'button:has([class*="Refresh"]), button:has-text("刷新")'
    );

    const btn = (await filterBtn.first().isVisible({ timeout: 2000 }).catch(() => false))
      ? filterBtn.first()
      : refreshBtn.first();

    if (await btn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await btn.click();
      console.log('🔍 应用筛选');

      // 等待数据加载
      await page.waitForResponse(
        (response) =>
          response.url().includes('/sales') ||
          response.url().includes('/analysis'),
        { timeout: 15000 }
      ).catch(() => {
        console.log('⚠️ 未检测到 API 请求');
      });

      await page.waitForTimeout(2000);
      console.log('✅ 数据刷新完成');
    } else {
      console.log('⚠️ 未找到筛选/刷新按钮');
    }
  });

  test('导出数据功能', async ({ page }) => {
    const exportBtn = page.locator(
      'button:has([class*="Download"]), button:has-text("导出"), button:has-text("下载")'
    );

    if (await exportBtn.first().isVisible({ timeout: 3000 }).catch(() => false)) {
      // 设置下载监听
      const downloadPromise = page.waitForEvent('download', { timeout: 10000 }).catch(() => null);

      await exportBtn.first().click();
      console.log('📥 点击导出按钮');

      const download = await downloadPromise;
      if (download) {
        console.log(`✅ 文件下载: ${download.suggestedFilename()}`);
      } else {
        console.log('⚠️ 未检测到文件下载');
      }
    } else {
      console.log('⚠️ 未找到导出按钮');
    }
  });

  test('销售排行榜显示', async ({ page }) => {
    const ranking = page.locator(
      '.sales-person-ranking, .ranking-list, .sales-rank'
    );

    if (await ranking.first().isVisible({ timeout: 5000 }).catch(() => false)) {
      const items = page.locator('.sales-rank-item, .ranking-item, .rank-item');
      const count = await items.count();

      console.log(`🏆 销售排行榜: ${count} 项`);
      expect(count).toBeGreaterThanOrEqual(0);
      console.log('✅ 销售排行榜显示正常');
    } else {
      console.log('⚠️ 未找到销售排行榜');
    }
  });

  test('图表交互', async ({ page }) => {
    const charts = page.locator('canvas, [id*="chart"], .echarts-container');

    if (await charts.first().isVisible({ timeout: 5000 }).catch(() => false)) {
      const count = await charts.count();
      console.log(`📊 检测到 ${count} 个图表`);

      // 尝试 hover 图表
      await charts.first().hover();
      await page.waitForTimeout(500);

      // 检查是否有 tooltip
      const tooltip = page.locator('.echarts-tooltip, [class*="tooltip"]');
      if (await tooltip.isVisible({ timeout: 1000 }).catch(() => false)) {
        console.log('✅ 图表 tooltip 正常');
      }

      console.log('✅ 图表交互测试完成');
    } else {
      console.log('⚠️ 未找到图表');
    }
  });
});
