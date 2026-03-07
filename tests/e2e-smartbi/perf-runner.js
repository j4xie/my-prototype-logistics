/**
 * SmartBI Excel 上传性能与渲染质量测试
 * 运行: node perf-runner.js
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://139.196.165.140:8086';
const TEST_DATA_ROOT = 'C:/Users/Steve/my-prototype-logistics/tests/test-data';
const SCREENSHOT_DIR = './screenshots';

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function login(page) {
  console.log('[LOGIN] 访问登录页...');
  await page.goto(BASE_URL + '/login', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await sleep(2000);
  await page.screenshot({ path: SCREENSHOT_DIR + '/01-login-page.png' });

  // 检查页面
  const bodyText = await page.evaluate(() => document.body.innerText);
  console.log('[LOGIN] 页面内容片段:', bodyText.substring(0, 100));

  // 找输入框
  const inputs = await page.locator('input').all();
  console.log('[LOGIN] 找到输入框:', inputs.length);

  // 填写凭证
  try {
    await page.locator('input[type="text"], input:not([type="password"])').first().fill('factory_admin1');
    await page.locator('input[type="password"]').first().fill('123456');
    await page.screenshot({ path: SCREENSHOT_DIR + '/02-login-filled.png' });

    // 点击登录按钮
    const loginBtn = page.locator('button[type="submit"], .el-button--primary, button:has-text("登录"), button:has-text("Login")').first();
    await loginBtn.click();
    await sleep(4000);

    const currentUrl = page.url();
    console.log('[LOGIN] 登录后URL:', currentUrl);
    await page.screenshot({ path: SCREENSHOT_DIR + '/03-after-login.png' });
    return !currentUrl.includes('/login');
  } catch (e) {
    console.error('[LOGIN] 登录失败:', e.message);
    await page.screenshot({ path: SCREENSHOT_DIR + '/login-error.png' });
    return false;
  }
}

async function findAndNavigateToSmartBI(page) {
  console.log('[NAV] 寻找 SmartBI 菜单...');

  // 先截图当前页面
  await page.screenshot({ path: SCREENSHOT_DIR + '/04-dashboard.png', fullPage: true });

  // 读取当前页面所有菜单项文本
  const menuItems = await page.locator('.el-menu-item, .el-submenu__title, aside li, nav li, .sidebar li').all();
  console.log('[NAV] 找到菜单项数量:', menuItems.length);

  for (const item of menuItems) {
    const text = await item.textContent();
    console.log('[NAV] 菜单项:', text && text.trim().substring(0, 30));
  }

  // 尝试寻找 SmartBI 相关菜单
  const smartbiMenu = page.locator('text=/SmartBI|智能数据|数据分析|BI分析|智能BI/i').first();
  const visible = await smartbiMenu.isVisible().catch(() => false);

  if (visible) {
    console.log('[NAV] 找到 SmartBI 菜单，点击...');
    await smartbiMenu.click();
    await sleep(2000);
  } else {
    // 尝试直接导航到可能的路径
    const routes = [
      '/#/smart-bi',
      '/#/smartbi',
      '/#/AIQuery',
      '/#/ai-query',
      '/#/analysis',
      '/#/data-analysis',
    ];

    for (const route of routes) {
      console.log('[NAV] 尝试路由:', route);
      await page.goto(BASE_URL + route, { waitUntil: 'domcontentloaded', timeout: 10000 }).catch(() => {});
      await sleep(1500);
      const content = await page.evaluate(() => document.body.innerText);
      if (content.includes('上传') || content.includes('Excel') || content.includes('智能分析')) {
        console.log('[NAV] 找到 SmartBI 页面:', page.url());
        break;
      }
    }
  }

  await page.screenshot({ path: SCREENSHOT_DIR + '/05-smartbi-page.png', fullPage: true });
  const currentUrl = page.url();
  const bodyText = await page.evaluate(() => document.body.innerText.substring(0, 300));
  console.log('[NAV] 当前页面URL:', currentUrl);
  console.log('[NAV] 页面内容:', bodyText);
  return currentUrl;
}

async function uploadAndMeasure(page, filePath, label) {
  const fileName = path.basename(filePath);
  const errors = [];
  const consoleErrors = [];
  const qualityNotes = [];

  console.log('\n' + '='.repeat(60));
  console.log('[TEST] 文件:', fileName);
  console.log('[TEST] 路径:', filePath);

  // 文件大小
  let fileSizeBytes = 0;
  try {
    fileSizeBytes = fs.statSync(filePath).size;
    console.log('[TEST] 文件大小:', (fileSizeBytes / 1024 / 1024).toFixed(2), 'MB');
  } catch (e) {
    errors.push('无法获取文件大小: ' + e.message);
  }

  // 监听控制台错误
  const consoleHandler = (msg) => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text().substring(0, 200));
    }
  };
  page.on('console', consoleHandler);

  // ===== 记录开始时间 =====
  const uploadStartTime = Date.now();
  console.log('[TIMER] 上传开始:', new Date(uploadStartTime).toLocaleTimeString());

  // 查找文件输入框
  let uploadSuccess = false;
  try {
    // 等待文件上传输入框
    const fileInput = page.locator('input[type="file"]').first();
    await fileInput.waitFor({ state: 'attached', timeout: 15000 });
    await fileInput.setInputFiles(filePath);
    uploadSuccess = true;
    console.log('[UPLOAD] 文件已设置，等待上传...');
    await sleep(500);

    // 检查是否需要点击确认按钮
    const confirmBtns = [
      'button:has-text("确认")',
      'button:has-text("上传")',
      'button:has-text("开始分析")',
      'button:has-text("分析")',
      '.el-button--primary',
    ];
    for (const btnSel of confirmBtns) {
      const btn = page.locator(btnSel).first();
      const btnVis = await btn.isVisible().catch(() => false);
      if (btnVis) {
        const btnText = await btn.textContent();
        console.log('[UPLOAD] 点击按钮:', btnText && btnText.trim());
        await btn.click();
        break;
      }
    }
  } catch (e) {
    errors.push('文件上传失败: ' + e.message);
    console.log('[UPLOAD] 错误:', e.message);
    await page.screenshot({ path: SCREENSHOT_DIR + '/debug-' + label + '-upload-fail.png' });
  }

  // ===== 等待处理完成 =====
  let uploadEndTime = Date.now();
  if (uploadSuccess) {
    console.log('[TIMER] 等待处理完成...');
    try {
      await page.waitForFunction(
        () => {
          const text = document.body.innerText || '';
          const canvasCount = document.querySelectorAll('canvas').length;
          const hasProgressMsg = text.includes('处理中') || text.includes('上传中') || text.includes('分析中') || text.includes('loading');
          const hasResult = canvasCount > 0 || text.includes('成功') || text.includes('分析完成') || text.includes('洞察');
          return hasResult && !hasProgressMsg;
        },
        { timeout: 120000, polling: 2000 }
      );
      uploadEndTime = Date.now();
      console.log('[TIMER] 检测到完成信号');
    } catch (e) {
      uploadEndTime = Date.now();
      errors.push('等待超时 (120s)');
      console.log('[TIMER] 超时，强制继续');
    }

    // 额外等待 ECharts 完全渲染
    await sleep(4000);
    uploadEndTime = Date.now();
  }

  // ===== 截图 =====
  await page.screenshot({ path: SCREENSHOT_DIR + '/result-' + label + '.png', fullPage: true });
  console.log('[SCREENSHOT] 截图已保存: result-' + label + '.png');

  // ===== 统计指标 =====

  // 图表数量（canvas 或 echarts 实例）
  const chartCount = await page.evaluate(() => {
    const canvases = document.querySelectorAll('canvas').length;
    const echartsInstances = document.querySelectorAll('[_echarts_instance_]').length;
    return Math.max(canvases, echartsInstances);
  });

  // KPI 卡片
  const kpiCount = await page.evaluate(() => {
    const selectors = ['.el-statistic', '.kpi-card', '.metric-card', '[class*="kpi"]', '[class*="statistic"]'];
    return selectors.reduce((sum, s) => sum + document.querySelectorAll(s).length, 0);
  });

  // AI 分析文本
  const aiAnalysisInfo = await page.evaluate(() => {
    const text = document.body.innerText || '';
    const aiKeywords = ['AI洞察', 'AI分析', '智能分析', '洞察', '趋势分析', '数据显示'];
    const hasAi = aiKeywords.some(k => text.includes(k));
    // 提取 AI 分析相关行
    const lines = text.split('\n').filter(l =>
      l.length > 10 && (l.includes('分析') || l.includes('洞察') || l.includes('趋势') || l.includes('建议'))
    );
    return { hasAi, sample: lines.slice(0, 2).join(' | ').substring(0, 150) };
  });

  // Sheet/Tab 名称
  const tabNames = await page.evaluate(() => {
    const items = Array.from(document.querySelectorAll('.el-tabs__item, .el-option, [role="tab"]'));
    return items.map(el => el.textContent && el.textContent.trim()).filter(t => t && t.length > 0 && t.length < 50);
  });

  // 成功/错误消息
  const pageMessages = await page.evaluate(() => {
    const text = document.body.innerText || '';
    const lines = text.split('\n').filter(l =>
      l.includes('成功') || l.includes('完成') || l.includes('失败') || l.includes('错误') || l.includes('上传')
    );
    return lines.slice(0, 5).join(' | ').substring(0, 200);
  });

  // 页面是否有错误提示
  const hasErrorInPage = await page.evaluate(() => {
    const text = document.body.innerText || '';
    return text.includes('失败') || text.includes('错误') || text.includes('Error') || text.includes('exception');
  });
  if (hasErrorInPage) errors.push('页面显示错误信息');

  // ===== 质量评分 =====
  let qualityScore = 0;
  if (chartCount >= 5) qualityScore += 3;
  else if (chartCount >= 3) qualityScore += 2;
  else if (chartCount >= 1) qualityScore += 1;
  if (kpiCount >= 3) qualityScore += 2;
  else if (kpiCount >= 1) qualityScore += 1;
  if (aiAnalysisInfo.hasAi) qualityScore += 2;
  if (errors.length === 0) qualityScore += 1;
  if (consoleErrors.length === 0) qualityScore += 1;

  const qualityRating = qualityScore >= 8 ? '优秀(A)' :
    qualityScore >= 6 ? '良好(B)' :
    qualityScore >= 4 ? '一般(C)' :
    qualityScore >= 2 ? '较差(D)' : '无法渲染(F)';

  // 质量备注
  qualityNotes.push('图表数: ' + chartCount);
  qualityNotes.push('KPI卡片: ' + kpiCount);
  qualityNotes.push('AI分析: ' + (aiAnalysisInfo.hasAi ? '是' : '否'));
  if (aiAnalysisInfo.sample) qualityNotes.push('AI文本: ' + aiAnalysisInfo.sample);
  if (tabNames.length > 0) qualityNotes.push('Tab/Sheet: ' + tabNames.slice(0, 5).join(', '));
  if (pageMessages) qualityNotes.push('页面消息: ' + pageMessages);
  if (errors.length > 0) qualityNotes.push('错误数: ' + errors.length);
  if (consoleErrors.length > 0) qualityNotes.push('JS控制台错误: ' + consoleErrors.length);

  const elapsedMs = uploadEndTime - uploadStartTime;
  const result = {
    file: fileName,
    label,
    fileSizeMB: (fileSizeBytes / 1024 / 1024).toFixed(2),
    elapsedMs,
    elapsedSec: (elapsedMs / 1000).toFixed(1),
    chartCount,
    kpiCount,
    hasAiAnalysis: aiAnalysisInfo.hasAi,
    aiSample: aiAnalysisInfo.sample,
    tabNames: tabNames.slice(0, 8),
    pageMessages,
    errors,
    consoleErrors: consoleErrors.slice(0, 5),
    qualityNotes,
    qualityRating,
    uploadSuccess,
  };

  page.off('console', consoleHandler);

  console.log('[RESULT]', label, '| 耗时:', result.elapsedSec + 's', '| 图表:', chartCount, '| KPI:', kpiCount, '| AI:', aiAnalysisInfo.hasAi, '| 质量:', qualityRating);

  return result;
}

async function testMobileViewport(page) {
  console.log('\n[MOBILE] 切换移动端视口 375x812...');
  await page.setViewportSize({ width: 375, height: 812 });
  await sleep(2000);
  await page.screenshot({ path: SCREENSHOT_DIR + '/mobile-375x812.png', fullPage: true });

  const mobileInfo = await page.evaluate(() => {
    const canvases = document.querySelectorAll('canvas');
    let visible = 0, hidden = 0;
    canvases.forEach(c => {
      const rect = c.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) visible++;
      else hidden++;
    });
    return { total: canvases.length, visible, hidden };
  });

  console.log('[MOBILE] canvas总数:', mobileInfo.total, '可见:', mobileInfo.visible, '隐藏:', mobileInfo.hidden);

  // 滚动测试
  await page.evaluate(() => window.scrollBy(0, 500));
  await sleep(1000);
  await page.screenshot({ path: SCREENSHOT_DIR + '/mobile-scrolled.png' });

  // 恢复桌面视口
  await page.setViewportSize({ width: 1920, height: 1080 });
  return mobileInfo;
}

async function testDropdownSwitch(page) {
  console.log('\n[DROPDOWN] 测试文件切换下拉框...');
  const t1 = Date.now();

  const dropdown = page.locator('.el-select, select').first();
  const visible = await dropdown.isVisible().catch(() => false);

  if (visible) {
    await dropdown.click();
    await sleep(500);
    const options = page.locator('.el-select-dropdown__item, option').all();
    const opts = await options;
    console.log('[DROPDOWN] 下拉选项数量:', opts.length);
    if (opts.length > 1) {
      await opts[1].click().catch(() => {});
      await sleep(1500);
    }
    const t2 = Date.now();
    console.log('[DROPDOWN] 切换响应时间:', (t2 - t1), 'ms');
    await page.screenshot({ path: SCREENSHOT_DIR + '/dropdown-switch.png' });
    return t2 - t1;
  }
  console.log('[DROPDOWN] 未找到下拉框');
  return null;
}

async function main() {
  console.log('\nSmartBI Excel 上传性能与渲染质量测试');
  console.log('='.repeat(60));
  console.log('目标:', BASE_URL);
  console.log('时间:', new Date().toISOString());
  console.log('');

  if (!fs.existsSync(SCREENSHOT_DIR)) {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  }

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });

  const allResults = [];
  let mobileInfo = null;
  let dropdownSwitchMs = null;

  try {
    // ===== 第一个文件: 工厂制造数据 =====
    {
      const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
      const page = await context.newPage();

      const loginOk = await login(page);
      console.log('[LOGIN] 成功:', loginOk);
      await findAndNavigateToSmartBI(page);

      const result1 = await uploadAndMeasure(
        page,
        TEST_DATA_ROOT + '/Test-mock-mfg-normal-s42.xlsx',
        'mfg-normal'
      );
      allResults.push(result1);

      await context.close();
    }

    // ===== 第二个文件: 火锅餐饮数据 =====
    {
      const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
      const page = await context.newPage();

      await login(page);
      await findAndNavigateToSmartBI(page);

      const result2 = await uploadAndMeasure(
        page,
        TEST_DATA_ROOT + '/restaurant/Restaurant-hotpot-normal-s42.xlsx',
        'hotpot-normal'
      );
      allResults.push(result2);

      // 在此页面测试移动端视口
      mobileInfo = await testMobileViewport(page);

      await context.close();
    }

    // ===== 第三个文件: 边缘案例混合类型 =====
    {
      const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
      const page = await context.newPage();

      await login(page);
      await findAndNavigateToSmartBI(page);

      const result3 = await uploadAndMeasure(
        page,
        TEST_DATA_ROOT + '/edge-cases/Edge-mixed-types.xlsx',
        'edge-mixed'
      );
      allResults.push(result3);

      // 测试下拉框切换
      dropdownSwitchMs = await testDropdownSwitch(page);

      await context.close();
    }

  } catch (e) {
    console.error('[FATAL] 测试异常:', e);
  } finally {
    await browser.close();
    console.log('\n[DONE] 浏览器已关闭');
  }

  // ===== 生成报告 =====
  console.log('\n' + '='.repeat(80));
  console.log('SmartBI Excel 渲染速度和生成质量测试报告');
  console.log('='.repeat(80));
  console.log('测试时间:', new Date().toISOString());
  console.log('');
  console.log('| 文件名 | 大小(MB) | 渲染耗时(s) | 图表数 | KPI数 | AI分析 | 质量评级 |');
  console.log('|--------|----------|------------|--------|-------|--------|---------|');

  for (const r of allResults) {
    const row = `| ${r.file.padEnd(45)} | ${r.fileSizeMB.padStart(8)} | ${r.elapsedSec.padStart(10)} | ${String(r.chartCount).padStart(6)} | ${String(r.kpiCount).padStart(5)} | ${(r.hasAiAnalysis ? '是' : '否').padStart(6)} | ${r.qualityRating} |`;
    console.log(row);
  }

  console.log('');
  if (mobileInfo) {
    console.log('移动端视口 (375x812):');
    console.log('  总图表数:', mobileInfo.total);
    console.log('  可见图表:', mobileInfo.visible);
    console.log('  隐藏图表:', mobileInfo.hidden);
    console.log('  渲染状态:', mobileInfo.visible > 0 ? '正常' : '图表未显示');
  }

  if (dropdownSwitchMs !== null) {
    console.log('文件切换响应时间:', dropdownSwitchMs, 'ms', dropdownSwitchMs < 1000 ? '(快速)' : dropdownSwitchMs < 3000 ? '(一般)' : '(较慢)');
  }

  console.log('\n--- 详细质量分析 ---');
  for (const r of allResults) {
    console.log('\n文件:', r.file);
    console.log('  大小:', r.fileSizeMB, 'MB');
    console.log('  耗时:', r.elapsedSec, 's');
    console.log('  图表数:', r.chartCount);
    console.log('  KPI卡片:', r.kpiCount);
    console.log('  AI分析:', r.hasAiAnalysis ? '是' : '否');
    if (r.aiSample) console.log('  AI样本:', r.aiSample.substring(0, 100));
    console.log('  Sheet/Tab:', r.tabNames.join(', ') || '未检测到');
    console.log('  页面消息:', r.pageMessages || '无');
    console.log('  质量评级:', r.qualityRating);
    if (r.errors.length > 0) {
      console.log('  错误:');
      r.errors.forEach(e => console.log('    -', e));
    }
    if (r.consoleErrors.length > 0) {
      console.log('  JS控制台错误:');
      r.consoleErrors.forEach(e => console.log('    [JS]', e.substring(0, 100)));
    }
    console.log('  质量备注:');
    r.qualityNotes.forEach(n => console.log('    *', n));
  }

  // 保存 JSON 报告
  const reportData = {
    testTime: new Date().toISOString(),
    baseUrl: BASE_URL,
    results: allResults,
    mobileViewport: mobileInfo,
    dropdownSwitchMs,
  };
  const reportPath = SCREENSHOT_DIR + '/perf-report.json';
  fs.writeFileSync(reportPath, JSON.stringify(reportData, null, 2));
  console.log('\n完整报告已保存:', reportPath);

  return reportData;
}

main().catch(e => {
  console.error('程序异常:', e);
  process.exit(1);
});
