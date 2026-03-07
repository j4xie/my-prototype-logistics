/**
 * SmartBI Excel 上传性能与质量测试
 * 测量三个测试文件的渲染时间和图表质量
 */
import { test, expect, Page } from '@playwright/test';
import path from 'path';

const BASE_URL = process.env.BASE_URL || 'http://139.196.165.140:8086';
const TEST_DATA_ROOT = 'C:/Users/Steve/my-prototype-logistics/tests/test-data';

interface UploadResult {
  file: string;
  fileSize: number;
  uploadStartTime: number;
  uploadEndTime: number;
  elapsedMs: number;
  chartCount: number;
  kpiCount: number;
  hasAiAnalysis: boolean;
  sheetCount: number;
  errors: string[];
  consoleErrors: string[];
  qualityNotes: string[];
}

const results: UploadResult[] = [];

async function loginIfNeeded(page: Page) {
  const url = page.url();
  if (url.includes('/login') || url === BASE_URL + '/' || url === BASE_URL) {
    console.log('登录中...');
    await page.fill('input[placeholder*="用户名"], input[type="text"]', 'factory_admin1');
    await page.fill('input[placeholder*="密码"], input[type="password"]', '123456');
    await page.click('button[type="submit"], .el-button--primary');
    await page.waitForTimeout(3000);
    console.log('登录完成，当前URL:', page.url());
  }
}

async function navigateToSmartBI(page: Page) {
  // 查找智能数据分析菜单
  console.log('导航到 SmartBI 页面...');

  // 先尝试直接URL
  await page.goto(BASE_URL + '/#/smart-bi', { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(2000);

  const pageContent = await page.content();
  if (!pageContent.includes('上传') && !pageContent.includes('智能')) {
    // 尝试点击侧边菜单
    const menuItems = await page.$$('li, .el-menu-item, a');
    for (const item of menuItems) {
      const text = await item.textContent().catch(() => '');
      if (text && (text.includes('SmartBI') || text.includes('智能') || text.includes('数据分析'))) {
        await item.click().catch(() => {});
        await page.waitForTimeout(2000);
        break;
      }
    }
  }
}

async function uploadFile(page: Page, filePath: string): Promise<UploadResult> {
  const fileName = path.basename(filePath);
  const consoleErrors: string[] = [];
  const errors: string[] = [];
  const qualityNotes: string[] = [];

  // 监听 console 错误
  page.on('console', msg => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
  });

  console.log(`\n=== 测试文件: ${fileName} ===`);

  // 获取文件大小
  const fs = require('fs');
  let fileSize = 0;
  try {
    fileSize = fs.statSync(filePath).size;
  } catch (e) {
    errors.push(`无法读取文件大小: ${e}`);
  }

  // 记录开始时间
  const uploadStartTime = Date.now();
  console.log(`开始上传时间: ${new Date(uploadStartTime).toISOString()}`);

  // 查找文件上传输入框
  try {
    // 等待上传区域出现
    await page.waitForSelector('input[type="file"], .el-upload input, [class*="upload"] input', { timeout: 10000 });

    const fileInput = page.locator('input[type="file"]').first();
    await fileInput.setInputFiles(filePath);
    console.log('文件已设置到输入框');

    // 等待可能的上传按钮确认
    await page.waitForTimeout(500);

    // 查找并点击上传/确认按钮
    const uploadBtn = page.locator('button:has-text("上传"), button:has-text("确认"), button:has-text("开始")').first();
    const btnVisible = await uploadBtn.isVisible().catch(() => false);
    if (btnVisible) {
      await uploadBtn.click();
      console.log('点击了上传按钮');
    }
  } catch (e) {
    errors.push(`上传操作失败: ${e}`);
    console.log('上传操作失败:', e);
  }

  // 等待 SSE 处理完成 - 监测成功消息
  console.log('等待处理完成...');
  let uploadEndTime = Date.now();

  try {
    // 等待图表或成功消息出现
    await page.waitForFunction(() => {
      const text = document.body.innerText;
      return text.includes('成功') ||
             text.includes('完成') ||
             text.includes('处理') ||
             document.querySelectorAll('canvas, .echarts-for-react, [_echarts_instance_]').length > 0;
    }, { timeout: 120000 });

    uploadEndTime = Date.now();
    console.log(`处理完成时间: ${new Date(uploadEndTime).toISOString()}`);
  } catch (e) {
    uploadEndTime = Date.now();
    errors.push(`等待处理超时: ${e}`);
    console.log('等待超时，继续...');
  }

  // 额外等待渲染
  await page.waitForTimeout(5000);

  // 计算图表数量
  const chartCount = await page.evaluate(() => {
    return document.querySelectorAll('canvas, [_echarts_instance_], .echarts-container, .chart-container').length;
  });

  // 计算 KPI 卡片数量
  const kpiCount = await page.evaluate(() => {
    const kpiSelectors = ['.kpi', '.metric', '.stat-card', '[class*="kpi"]', '[class*="metric"]', '.el-statistic', '.data-card'];
    return kpiSelectors.reduce((sum, sel) => sum + document.querySelectorAll(sel).length, 0);
  });

  // 检查 AI 分析
  const hasAiAnalysis = await page.evaluate(() => {
    const text = document.body.innerText;
    return text.includes('AI') || text.includes('分析') || text.includes('洞察') || text.includes('建议');
  });

  // 检查 Sheet 切换下拉框
  const sheetCount = await page.evaluate(() => {
    const options = document.querySelectorAll('select option, .el-select-dropdown__item, .el-option');
    return options.length;
  });

  // 检查页面质量
  const pageText = await page.evaluate(() => document.body.innerText);

  if (chartCount === 0) {
    qualityNotes.push('未检测到图表');
  } else {
    qualityNotes.push(`检测到 ${chartCount} 个图表元素`);
  }

  if (pageText.includes('错误') || pageText.includes('失败')) {
    qualityNotes.push('页面包含错误信息');
    errors.push('页面显示错误信息');
  }

  if (pageText.includes('上传成功') || pageText.includes('处理成功') || pageText.includes('成功处理')) {
    qualityNotes.push('上传成功确认消息存在');
  }

  const elapsedMs = uploadEndTime - uploadStartTime;
  console.log(`总耗时: ${elapsedMs}ms (${(elapsedMs/1000).toFixed(1)}s)`);
  console.log(`图表数: ${chartCount}, KPI数: ${kpiCount}, AI分析: ${hasAiAnalysis}`);

  return {
    file: fileName,
    fileSize,
    uploadStartTime,
    uploadEndTime,
    elapsedMs,
    chartCount,
    kpiCount,
    hasAiAnalysis,
    sheetCount,
    errors,
    consoleErrors,
    qualityNotes,
  };
}

test.describe('SmartBI Excel 上传性能测试', () => {
  test.setTimeout(300000); // 5 分钟

  test('初始化 - 登录并导航到 SmartBI', async ({ page }) => {
    await page.goto(BASE_URL + '/login', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2000);

    // 截图登录页
    await page.screenshot({ path: 'screenshots/perf-01-login.png', fullPage: false });

    await loginIfNeeded(page);
    await page.waitForTimeout(2000);

    // 截图登录后
    await page.screenshot({ path: 'screenshots/perf-02-after-login.png', fullPage: false });
    console.log('登录后URL:', page.url());
  });

  test('文件1 - 工厂制造数据 (Test-mock-mfg-normal-s42.xlsx)', async ({ page }) => {
    // 登录
    await page.goto(BASE_URL + '/login', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2000);
    await loginIfNeeded(page);
    await page.waitForTimeout(2000);

    // 导航到 SmartBI
    await navigateToSmartBI(page);
    await page.waitForTimeout(3000);

    // 截图当前状态
    await page.screenshot({ path: 'screenshots/perf-03-smartbi-page.png', fullPage: true });

    // 记录页面快照用于调试
    const snapshot = await page.content();
    const hasUpload = snapshot.includes('上传') || snapshot.includes('upload') || snapshot.includes('Upload');
    console.log('页面包含上传功能:', hasUpload);
    console.log('当前URL:', page.url());

    const filePath = `${TEST_DATA_ROOT}/Test-mock-mfg-normal-s42.xlsx`;
    const result = await uploadFile(page, filePath);
    results.push(result);

    // 截图结果
    await page.screenshot({ path: 'screenshots/perf-04-mfg-result.png', fullPage: true });

    console.log('文件1结果:', JSON.stringify(result, null, 2));
  });

  test('文件2 - 餐饮火锅数据 (Restaurant-hotpot-normal-s42.xlsx)', async ({ page }) => {
    await page.goto(BASE_URL + '/login', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2000);
    await loginIfNeeded(page);
    await page.waitForTimeout(2000);

    await navigateToSmartBI(page);
    await page.waitForTimeout(3000);

    const filePath = `${TEST_DATA_ROOT}/restaurant/Restaurant-hotpot-normal-s42.xlsx`;
    const result = await uploadFile(page, filePath);
    results.push(result);

    await page.screenshot({ path: 'screenshots/perf-05-hotpot-result.png', fullPage: true });
    console.log('文件2结果:', JSON.stringify(result, null, 2));
  });

  test('文件3 - 边缘案例混合类型 (Edge-mixed-types.xlsx)', async ({ page }) => {
    await page.goto(BASE_URL + '/login', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2000);
    await loginIfNeeded(page);
    await page.waitForTimeout(2000);

    await navigateToSmartBI(page);
    await page.waitForTimeout(3000);

    const filePath = `${TEST_DATA_ROOT}/edge-cases/Edge-mixed-types.xlsx`;
    const result = await uploadFile(page, filePath);
    results.push(result);

    await page.screenshot({ path: 'screenshots/perf-06-mixed-result.png', fullPage: true });
    console.log('文件3结果:', JSON.stringify(result, null, 2));
  });

  test('汇总报告', async ({ page }) => {
    console.log('\n\n=== 性能测试汇总 ===\n');
    console.log('文件 | 大小 | 耗时 | 图表数 | KPI数 | AI分析');
    console.log('-----|------|------|--------|-------|-------');

    for (const r of results) {
      const sizeMB = (r.fileSize / 1024 / 1024).toFixed(2);
      const elapsedS = (r.elapsedMs / 1000).toFixed(1);
      console.log(`${r.file} | ${sizeMB}MB | ${elapsedS}s | ${r.chartCount} | ${r.kpiCount} | ${r.hasAiAnalysis ? '是' : '否'}`);
    }

    // 将结果写入文件
    const fs = require('fs');
    fs.writeFileSync(
      'screenshots/perf-results.json',
      JSON.stringify(results, null, 2)
    );
    console.log('\n结果已写入 screenshots/perf-results.json');
  });
});
