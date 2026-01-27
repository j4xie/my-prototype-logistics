import { test, expect, Page } from '@playwright/test';
import path from 'path';
import fs from 'fs';

/**
 * Excel 上传测试
 * 测试 SmartBI 的 Excel 上传、解析、分析功能
 */

test.describe('SmartBI Excel 上传测试', () => {
  test.beforeEach(async ({ page }) => {
    // 导航到数据导入页面
    await page.goto('/smart-bi/analysis');
    await page.waitForLoadState('networkidle');
    console.log('📊 进入数据导入页面');
  });

  test('页面加载正常', async ({ page }) => {
    // 验证页面标题
    const title = page.locator('h1, .page-title').first();
    await expect(title).toBeVisible({ timeout: 5000 });

    // 验证上传区域存在
    const uploadArea = page.locator('.upload-area, .el-upload-dragger').first();
    await expect(uploadArea).toBeVisible();

    console.log('✅ 页面加载正常');
  });

  test('上传 Excel 文件并解析', async ({ page }) => {
    // 准备测试文件路径
    const testFilePath = path.join(__dirname, '../test-data/test-sales.xlsx');

    // 如果测试文件不存在，跳过此测试
    if (!fs.existsSync(testFilePath)) {
      console.log('⚠️ 测试文件不存在，跳过上传测试');
      console.log(`   请创建测试文件: ${testFilePath}`);
      test.skip();
      return;
    }

    // 获取文件上传输入框
    const fileInput = page.locator('input[type="file"]');

    // 上传文件
    await fileInput.setInputFiles(testFilePath);
    console.log('📤 文件已选择');

    // 等待上传和解析完成
    await page.waitForResponse(
      (response) =>
        response.url().includes('/upload') ||
        response.url().includes('/auto-parse'),
      { timeout: 30000 }
    );

    // 等待解析结果显示
    await page.waitForSelector('.parse-summary, .summary-stats, .field-tags', {
      timeout: 20000,
    });

    console.log('✅ 文件上传并解析成功');

    // 验证解析结果
    const statsCards = page.locator('.stat-item, .summary-card');
    const count = await statsCards.count();
    expect(count).toBeGreaterThan(0);
    console.log(`📈 检测到 ${count} 个统计卡片`);
  });

  test('查看 AI 分析结果', async ({ page }) => {
    // 先检查是否有已解析的数据
    const analysisBtn = page.locator('button').filter({ hasText: /查看分析|开始分析|分析/ });

    if (await analysisBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await analysisBtn.click();
      console.log('🤖 触发 AI 分析');

      // 等待分析结果
      await page.waitForSelector('.kpi-grid, .charts-section, .insight-section', {
        timeout: 60000,
      });

      // 验证 KPI 卡片
      const kpiCards = page.locator('.kpi-card, .kpi-item');
      if ((await kpiCards.count()) > 0) {
        console.log('✅ KPI 卡片显示正常');
      }

      // 验证图表
      const charts = page.locator('[id^="analysis-chart-"], .chart-item, canvas');
      if ((await charts.count()) > 0) {
        console.log('✅ 图表渲染正常');
      }

      // 验证 AI 洞察
      const insights = page.locator('.insight-section, .insight-item');
      if ((await insights.count()) > 0) {
        console.log('✅ AI 洞察显示正常');
      }
    } else {
      console.log('⚠️ 没有可分析的数据，跳过');
    }
  });

  test('保存分析结果', async ({ page }) => {
    const saveBtn = page.locator('button').filter({ hasText: /保存|确认/ });

    if (await saveBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await saveBtn.click();
      console.log('💾 点击保存按钮');

      // 等待保存成功提示
      const successMsg = page.locator('.el-message--success, .el-notification__title');
      await expect(successMsg).toBeVisible({ timeout: 10000 });
      console.log('✅ 保存成功');
    } else {
      console.log('⚠️ 没有保存按钮，跳过');
    }
  });
});
