/**
 * SmartBI Excel 上传性能与渲染质量测试
 * 直接运行: npx ts-node run-perf-test.ts
 */
import { chromium, Page } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';

const BASE_URL = 'http://139.196.165.140:8086';
const TEST_DATA_ROOT = 'C:/Users/Steve/my-prototype-logistics/tests/test-data';
const SCREENSHOT_DIR = 'C:/Users/Steve/my-prototype-logistics/tests/e2e-smartbi/screenshots';

interface UploadResult {
  file: string;
  fileSizeBytes: number;
  fileSizeMB: string;
  elapsedMs: number;
  elapsedSec: string;
  chartCount: number;
  kpiCount: number;
  hasAiAnalysis: boolean;
  sheetNames: string[];
  pageTitle: string;
  successMessage: string;
  errors: string[];
  consoleErrors: string[];
  qualityNotes: string[];
  qualityRating: string;
}

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function login(page: Page) {
  console.log('[LOGIN] 导航到登录页...');
  await page.goto(BASE_URL + '/login', { waitUntil: 'networkidle', timeout: 30000 });
  await sleep(1500);

  // 填写用户名密码
  await page.fill('input[type="text"], input[placeholder*="用户名"], input[name="username"]', 'factory_admin1');
  await page.fill('input[type="password"], input[placeholder*="密码"]', '123456');
  await page.screenshot({ path: `${SCREENSHOT_DIR}/step-01-login-filled.png` });

  await page.click('button[type="submit"], .el-button--primary, button:has-text("登录")');
  await sleep(3000);

  const url = page.url();
  console.log('[LOGIN] 登录后URL:', url);
  await page.screenshot({ path: `${SCREENSHOT_DIR}/step-02-after-login.png` });
  return url.includes('/login') ? false : true;
}

async function navigateToSmartBI(page: Page) {
  console.log('[NAV] 导航到 SmartBI 智能数据分析...');

  // 先截图当前菜单
  await page.screenshot({ path: `${SCREENSHOT_DIR}/step-03-menu.png` });

  // 尝试点击侧边栏中的 SmartBI 相关菜单项
  const menuTexts = ['SmartBI', '智能数据', '数据分析', '智能分析', 'BI'];
  for (const text of menuTexts) {
    const el = page.locator(`text="${text}"`).first();
    const visible = await el.isVisible().catch(() => false);
    if (visible) {
      console.log(`[NAV] 找到菜单项: "${text}"`);
      await el.click();
      await sleep(2000);
      break;
    }
  }

  // 查找包含这些文字的所有可点击元素
  const allLinks = await page.$$('a, .el-menu-item, li[role="menuitem"], .menu-item');
  for (const link of allLinks) {
    const text = await link.textContent().catch(() => '');
    if (text && (text.includes('SmartBI') || text.includes('智能') || text.includes('BI'))) {
      console.log(`[NAV] 点击菜单: "${text.trim()}"`);
      await link.click().catch(() => {});
      await sleep(2000);
      break;
    }
  }

  const currentUrl = page.url();
  console.log('[NAV] 当前URL:', currentUrl);

  // 如果还没到目标页，尝试直接跳转
  if (!currentUrl.includes('smart') && !currentUrl.includes('bi') && !currentUrl.includes('analysis')) {
    const candidates = ['/smart-bi', '/smartbi', '/bi', '/data-analysis', '/AIQuery'];
    for (const p of candidates) {
      await page.goto(BASE_URL + '/#' + p, { waitUntil: 'domcontentloaded', timeout: 10000 }).catch(() => {});
      await sleep(1500);
      const body = await page.$('body');
      const text = await body?.textContent() || '';
      if (text.includes('上传') || text.includes('Excel') || text.includes('数据')) {
        console.log('[NAV] 成功跳转到:', page.url());
        break;
      }
    }
  }

  await page.screenshot({ path: `${SCREENSHOT_DIR}/step-04-smartbi-page.png`, fullPage: true });
}

async function uploadAndMeasure(page: Page, filePath: string, label: string): Promise<UploadResult> {
  const fileName = path.basename(filePath);
  const consoleErrors: string[] = [];
  const errors: string[] = [];
  const qualityNotes: string[] = [];

  console.log(`\n${'='.repeat(60)}`);
  console.log(`[TEST] 开始测试: ${label}`);
  console.log(`[TEST] 文件路径: ${filePath}`);

  // 获取文件大小
  let fileSizeBytes = 0;
  try {
    fileSizeBytes = fs.statSync(filePath).size;
    console.log(`[TEST] 文件大小: ${(fileSizeBytes / 1024 / 1024).toFixed(2)} MB`);
  } catch (e) {
    errors.push(`无法获取文件大小: ${e}`);
  }

  // 监听控制台错误
  const consoleHandler = (msg: any) => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text().substring(0, 200));
    }
  };
  page.on('console', consoleHandler);

  // 记录上传开始时间
  const uploadStartTime = Date.now();
  console.log(`[TIMER] 开始时间: ${new Date(uploadStartTime).toISOString()}`);

  // 查找文件输入框
  let fileInputFound = false;
  try {
    // 等待文件输入框出现（可能在上传区域内）
    await page.waitForSelector('input[type="file"]', { timeout: 15000 });
    const fileInput = page.locator('input[type="file"]').first();
    await fileInput.setInputFiles(filePath);
    fileInputFound = true;
    console.log('[UPLOAD] 文件已加载到输入框');
    await sleep(1000);

    // 检查是否需要点击确认
    const confirmBtn = page.locator('button:has-text("确认上传"), button:has-text("开始分析"), button:has-text("上传"), .el-upload__input + button').first();
    const confirmVisible = await confirmBtn.isVisible().catch(() => false);
    if (confirmVisible) {
      console.log('[UPLOAD] 点击确认按钮');
      await confirmBtn.click();
    }
  } catch (e) {
    errors.push(`文件输入框未找到: ${e}`);
    console.log('[UPLOAD] 未找到文件输入框，尝试直接拖拽或其他方式');

    // 截图调试
    await page.screenshot({ path: `${SCREENSHOT_DIR}/debug-${label}-no-input.png` });
  }

  // 等待处理完成
  console.log('[TIMER] 等待 SSE 处理和渲染...');
  let uploadEndTime = uploadStartTime;

  if (fileInputFound) {
    try {
      // 等待图表出现 OR 成功消息
      await page.waitForFunction(
        () => {
          const text = document.body.innerText || '';
          const hasSuccess = text.includes('成功') || text.includes('完成') || text.includes('分析完成');
          const hasCharts = document.querySelectorAll('canvas').length > 0;
          const hasLoading = text.includes('处理中') || text.includes('上传中') || text.includes('分析中');
          // 如果有图表或成功消息且没有在加载，认为完成
          return (hasCharts || hasSuccess) && !hasLoading;
        },
        { timeout: 120000, polling: 2000 }
      );
      uploadEndTime = Date.now();
      console.log(`[TIMER] 检测到完成信号，耗时: ${uploadEndTime - uploadStartTime}ms`);
    } catch (e) {
      uploadEndTime = Date.now();
      errors.push(`等待完成超时 (120s): ${e}`);
      console.log('[TIMER] 超时，继续收集结果...');
    }

    // 额外等待 ECharts 渲染
    await sleep(5000);
    uploadEndTime = Date.now(); // 更新为包含渲染时间
  }

  // 截图当前状态
  await page.screenshot({
    path: `${SCREENSHOT_DIR}/result-${label}.png`,
    fullPage: true
  });
  console.log(`[SCREENSHOT] 已保存结果截图`);

  // 统计图表
  const chartCount = await page.evaluate(() => {
    // ECharts 通常在 canvas 元素上，或有特定属性
    const canvases = document.querySelectorAll('canvas').length;
    const echartsInstances = document.querySelectorAll('[_echarts_instance_]').length;
    const chartDivs = document.querySelectorAll('.echarts-for-react, .chart-wrapper, [class*="chart"]').length;
    return Math.max(canvases, echartsInstances, chartDivs);
  });

  // 统计 KPI 卡片
  const kpiCount = await page.evaluate(() => {
    const selectors = [
      '.el-statistic',
      '.kpi-card',
      '.metric-card',
      '[class*="kpi"]',
      '[class*="metric"]',
      '[class*="stat"]',
      '.data-card',
    ];
    let max = 0;
    for (const s of selectors) {
      max = Math.max(max, document.querySelectorAll(s).length);
    }
    return max;
  });

  // 检查 AI 分析文本
  const { hasAiAnalysis, aiText } = await page.evaluate(() => {
    const text = document.body.innerText || '';
    const hasAi =
      text.includes('AI洞察') ||
      text.includes('AI分析') ||
      text.includes('智能分析') ||
      text.includes('数据分析') ||
      text.includes('洞察') ||
      text.includes('建议') ||
      text.includes('趋势');
    // 提取 AI 分析文本片段
    const lines = text.split('\n').filter(l =>
      l.includes('分析') || l.includes('洞察') || l.includes('建议') || l.includes('趋势')
    );
    return { hasAiAnalysis: hasAi, aiText: lines.slice(0, 3).join(' | ') };
  });

  // 检查 Sheet 名称
  const sheetNames = await page.evaluate(() => {
    const options = Array.from(document.querySelectorAll(
      '.el-select-dropdown__item, .el-option, select option, [class*="tab"], .el-tabs__item'
    ));
    return options.map(o => (o as HTMLElement).textContent?.trim() || '').filter(t => t.length > 0 && t.length < 50);
  });

  // 获取页面标题区域
  const pageTitle = await page.evaluate(() => {
    const h1 = document.querySelector('h1, h2, .page-title, .el-page-header__title');
    return h1?.textContent?.trim() || '';
  });

  // 获取成功消息
  const successMessage = await page.evaluate(() => {
    const text = document.body.innerText || '';
    const lines = text.split('\n');
    return lines.find(l =>
      l.includes('成功') || l.includes('完成') || l.includes('上传') || l.includes('处理')
    ) || '';
  });

  // 质量评估
  if (chartCount > 5) qualityNotes.push(`图表数量丰富 (${chartCount}个)`);
  else if (chartCount > 0) qualityNotes.push(`图表数量一般 (${chartCount}个)`);
  else qualityNotes.push('未检测到图表');

  if (kpiCount > 0) qualityNotes.push(`KPI卡片 ${kpiCount}个`);
  if (hasAiAnalysis) qualityNotes.push('AI洞察分析存在');
  if (aiText) qualityNotes.push(`AI文本片段: "${aiText.substring(0, 80)}"`);
  if (sheetNames.length > 0) qualityNotes.push(`Sheet/Tab: ${sheetNames.slice(0, 5).join(', ')}`);
  if (errors.length > 0) qualityNotes.push(`错误: ${errors.length}个`);
  if (consoleErrors.length > 0) qualityNotes.push(`控制台错误: ${consoleErrors.length}个`);

  // 质量评级
  let qualityScore = 0;
  if (chartCount >= 5) qualityScore += 3;
  else if (chartCount >= 2) qualityScore += 2;
  else if (chartCount >= 1) qualityScore += 1;
  if (kpiCount >= 3) qualityScore += 2;
  else if (kpiCount >= 1) qualityScore += 1;
  if (hasAiAnalysis) qualityScore += 2;
  if (errors.length === 0) qualityScore += 1;
  if (consoleErrors.length === 0) qualityScore += 1;

  const qualityRating = qualityScore >= 8 ? '优秀(A)' :
    qualityScore >= 6 ? '良好(B)' :
    qualityScore >= 4 ? '一般(C)' :
    qualityScore >= 2 ? '较差(D)' : '无法渲染(F)';

  const elapsedMs = uploadEndTime - uploadStartTime;

  const result: UploadResult = {
    file: fileName,
    fileSizeBytes,
    fileSizeMB: (fileSizeBytes / 1024 / 1024).toFixed(2),
    elapsedMs,
    elapsedSec: (elapsedMs / 1000).toFixed(1),
    chartCount,
    kpiCount,
    hasAiAnalysis,
    sheetNames: sheetNames.slice(0, 10),
    pageTitle,
    successMessage: successMessage.substring(0, 100),
    errors,
    consoleErrors: consoleErrors.slice(0, 5),
    qualityNotes,
    qualityRating,
  };

  page.off('console', consoleHandler);

  console.log(`[RESULT] 耗时: ${result.elapsedSec}s | 图表: ${chartCount} | KPI: ${kpiCount} | AI: ${hasAiAnalysis} | 质量: ${qualityRating}`);

  return result;
}

async function testMobileViewport(page: Page) {
  console.log('\n[MOBILE] 测试移动端视口 (375x812)...');
  await page.setViewportSize({ width: 375, height: 812 });
  await sleep(2000);
  await page.screenshot({ path: `${SCREENSHOT_DIR}/mobile-viewport.png`, fullPage: true });

  const chartsVisible = await page.evaluate(() => {
    const canvases = document.querySelectorAll('canvas');
    let visibleCount = 0;
    canvases.forEach(c => {
      const rect = c.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) visibleCount++;
    });
    return visibleCount;
  });

  console.log(`[MOBILE] 移动端可见图表数: ${chartsVisible}`);

  // 恢复桌面视口
  await page.setViewportSize({ width: 1920, height: 1080 });
  return chartsVisible;
}

async function main() {
  console.log('SmartBI Excel 上传性能与质量测试');
  console.log('='.repeat(60));
  console.log(`目标URL: ${BASE_URL}`);
  console.log(`测试数据目录: ${TEST_DATA_ROOT}`);
  console.log('');

  // 确保截图目录存在
  if (!fs.existsSync(SCREENSHOT_DIR)) {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  }

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
  });

  const page = await context.newPage();

  const allResults: UploadResult[] = [];
  let mobileChartCount = 0;

  try {
    // 1. 登录
    const loginSuccess = await login(page);
    if (!loginSuccess) {
      console.error('[ERROR] 登录失败！');
    }

    // 2. 导航到 SmartBI
    await navigateToSmartBI(page);

    // 3. 测试文件1: 工厂制造数据
    await navigateToSmartBI(page); // 确保在正确页面
    const result1 = await uploadAndMeasure(
      page,
      `${TEST_DATA_ROOT}/Test-mock-mfg-normal-s42.xlsx`,
      'mfg-normal'
    );
    allResults.push(result1);
    await sleep(3000);

    // 清空/刷新页面准备下一次上传
    await page.reload({ waitUntil: 'domcontentloaded' });
    await sleep(2000);
    await navigateToSmartBI(page);

    // 4. 测试文件2: 餐饮火锅数据
    const result2 = await uploadAndMeasure(
      page,
      `${TEST_DATA_ROOT}/restaurant/Restaurant-hotpot-normal-s42.xlsx`,
      'hotpot-normal'
    );
    allResults.push(result2);
    await sleep(3000);

    // 5. 移动端测试 (在最后一个成功上传的页面上测试)
    mobileChartCount = await testMobileViewport(page);

    // 刷新页面准备下一次上传
    await page.reload({ waitUntil: 'domcontentloaded' });
    await sleep(2000);
    await navigateToSmartBI(page);

    // 6. 测试文件3: 边缘案例混合类型
    const result3 = await uploadAndMeasure(
      page,
      `${TEST_DATA_ROOT}/edge-cases/Edge-mixed-types.xlsx`,
      'edge-mixed'
    );
    allResults.push(result3);

    // 7. 测试 Sheet 切换速度
    console.log('\n[DROPDOWN] 测试下拉框切换速度...');
    const dropdowns = await page.$$('select, .el-select, [class*="select"]');
    let dropdownSwitchTime = 0;
    if (dropdowns.length > 0) {
      const t1 = Date.now();
      await dropdowns[0].click().catch(() => {});
      await sleep(1000);
      dropdownSwitchTime = Date.now() - t1;
      console.log(`[DROPDOWN] 下拉框响应时间: ${dropdownSwitchTime}ms`);
    }
    await page.screenshot({ path: `${SCREENSHOT_DIR}/step-final-dropdown.png` });

  } catch (e) {
    console.error('[FATAL] 测试过程中发生错误:', e);
  } finally {
    await browser.close();
  }

  // 生成汇总报告
  console.log('\n\n' + '='.repeat(80));
  console.log('SmartBI Excel 渲染速度和生成质量测试报告');
  console.log('='.repeat(80));
  console.log('');
  console.log('| 文件名 | 大小(MB) | 渲染耗时(s) | 图表数 | KPI数 | AI分析 | 质量评级 |');
  console.log('|--------|----------|------------|--------|-------|--------|---------|');
  for (const r of allResults) {
    console.log(`| ${r.file} | ${r.fileSizeMB} | ${r.elapsedSec} | ${r.chartCount} | ${r.kpiCount} | ${r.hasAiAnalysis ? '是' : '否'} | ${r.qualityRating} |`);
  }

  console.log('');
  console.log(`移动端视口(375x812)可见图表数: ${mobileChartCount}`);

  console.log('\n--- 详细质量分析 ---');
  for (const r of allResults) {
    console.log(`\n文件: ${r.file}`);
    console.log(`  大小: ${r.fileSizeMB} MB`);
    console.log(`  耗时: ${r.elapsedSec}s (${r.elapsedMs}ms)`);
    console.log(`  图表: ${r.chartCount}`);
    console.log(`  KPI卡片: ${r.kpiCount}`);
    console.log(`  AI分析: ${r.hasAiAnalysis}`);
    console.log(`  Sheet: ${r.sheetNames.join(', ') || '未检测到'}`);
    console.log(`  质量: ${r.qualityRating}`);
    console.log(`  质量备注:`);
    for (const note of r.qualityNotes) {
      console.log(`    - ${note}`);
    }
    if (r.errors.length > 0) {
      console.log(`  错误:`);
      for (const e of r.errors) {
        console.log(`    ! ${e}`);
      }
    }
    if (r.consoleErrors.length > 0) {
      console.log(`  控制台错误:`);
      for (const e of r.consoleErrors.slice(0, 3)) {
        console.log(`    [JS] ${e.substring(0, 120)}`);
      }
    }
  }

  // 保存 JSON 结果
  const reportPath = `${SCREENSHOT_DIR}/perf-report.json`;
  fs.writeFileSync(reportPath, JSON.stringify({
    testTime: new Date().toISOString(),
    baseUrl: BASE_URL,
    results: allResults,
    mobileViewportCharts: mobileChartCount,
  }, null, 2));
  console.log(`\n完整结果已保存到: ${reportPath}`);

  return allResults;
}

main().catch(console.error);
