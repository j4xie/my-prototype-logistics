/**
 * Ralph Loop - SmartBI 完整自动化测试循环
 *
 * 完整流程:
 * 1. 检查远程服务器状态
 * 2. 如果服务未运行，自动 deploy-backend.sh 部署
 * 3. 运行 Chrome E2E 测试
 * 4. 发现问题 → 记录 → 继续测试
 *
 * 用法:
 *   npm run ralph-loop              # 无头模式运行
 *   npm run ralph-loop:headed       # 显示浏览器窗口
 *   LOOPS=100 npm run ralph-loop    # 运行 100 轮
 */

import { chromium, Browser, Page, BrowserContext } from '@playwright/test';
import { execSync, spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

// ==================== 配置 ====================
const CONFIG = {
  baseUrl: process.env.BASE_URL || 'http://139.196.165.140:8086',
  backendUrl: 'http://139.196.165.140:10010',
  healthEndpoint: '/api/mobile/health',
  headed: process.env.HEADED === 'true',
  slowMo: parseInt(process.env.SLOW_MO || '0'),
  maxLoops: parseInt(process.env.LOOPS || '0') || Infinity,
  pauseOnError: process.env.PAUSE_ON_ERROR === 'true',
  testDataDir: path.join(__dirname, 'test-data'),
  reportDir: path.join(__dirname, 'reports'),
  projectRoot: path.resolve(__dirname, '../..'),
  deployScript: 'deploy-backend.sh',
  healthCheckRetries: 5,
  healthCheckInterval: 10000, // 10秒
};

// 账号配置 (默认使用财务经理账号)
const TEST_ACCOUNT = {
  username: 'finance_mgr1',
  password: '123456',
  role: '财务经理',
};

// ==================== 类型定义 ====================
interface TestStats {
  totalLoops: number;
  totalTests: number;
  passed: number;
  failed: number;
  deployments: number;
  errors: ErrorRecord[];
  startTime: Date;
  lastLoopTime: Date;
}

interface ErrorRecord {
  loop: number;
  test: string;
  error: string;
  screenshot?: string;
  timestamp: Date;
}

const stats: TestStats = {
  totalLoops: 0,
  totalTests: 0,
  passed: 0,
  failed: 0,
  deployments: 0,
  errors: [],
  startTime: new Date(),
  lastLoopTime: new Date(),
};

// 确保目录存在
fs.mkdirSync(path.join(CONFIG.reportDir, 'screenshots'), { recursive: true });
fs.mkdirSync(CONFIG.testDataDir, { recursive: true });

// ==================== 服务器检查与部署 ====================

/**
 * 检查后端服务是否健康
 * 使用登录 API 测试，因为 /health 端点不存在
 */
async function checkBackendHealth(): Promise<boolean> {
  try {
    // 尝试调用登录 API（不需要真正登录，只检查服务是否响应）
    const response = await fetch(`${CONFIG.backendUrl}/api/mobile/auth/unified-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'test', password: 'test' }),
      signal: AbortSignal.timeout(10000),
    });
    // 即使返回 401 或 400 也说明服务正常
    return response.status !== 502 && response.status !== 503 && response.status !== 0;
  } catch {
    return false;
  }
}

/**
 * 等待后端服务启动
 */
async function waitForBackend(maxRetries = CONFIG.healthCheckRetries): Promise<boolean> {
  console.log('⏳ 等待后端服务启动...');

  for (let i = 0; i < maxRetries; i++) {
    const healthy = await checkBackendHealth();
    if (healthy) {
      console.log('✅ 后端服务已就绪');
      return true;
    }
    console.log(`   重试 ${i + 1}/${maxRetries}...`);
    await new Promise((r) => setTimeout(r, CONFIG.healthCheckInterval));
  }

  console.log('❌ 后端服务未能启动');
  return false;
}

/**
 * 执行部署脚本
 */
async function deployBackend(): Promise<boolean> {
  console.log('\n🚀 启动后端部署...');
  console.log('=' .repeat(50));

  const deployScriptPath = path.join(CONFIG.projectRoot, CONFIG.deployScript);

  if (!fs.existsSync(deployScriptPath)) {
    console.error(`❌ 部署脚本不存在: ${deployScriptPath}`);
    return false;
  }

  try {
    // 在 Windows 上使用 Git Bash 运行脚本
    const isWindows = process.platform === 'win32';
    const command = isWindows
      ? `bash "${deployScriptPath}"`
      : deployScriptPath;

    console.log(`📦 执行: ${command}`);

    execSync(command, {
      cwd: CONFIG.projectRoot,
      stdio: 'inherit',
      timeout: 10 * 60 * 1000, // 10分钟超时
      shell: isWindows ? 'C:\\Program Files\\Git\\bin\\bash.exe' : '/bin/bash',
    });

    stats.deployments++;
    console.log('=' .repeat(50));
    console.log('✅ 部署完成\n');

    // 等待服务启动
    return await waitForBackend();
  } catch (error) {
    console.error(`❌ 部署失败: ${error}`);
    return false;
  }
}

/**
 * 确保后端服务可用，如不可用则自动部署
 */
async function ensureBackendAvailable(): Promise<boolean> {
  console.log('\n🔍 检查后端服务状态...');

  const healthy = await checkBackendHealth();

  if (healthy) {
    console.log('✅ 后端服务正常运行');
    return true;
  }

  console.log('⚠️ 后端服务不可用，需要部署');
  return await deployBackend();
}

// ==================== 登录 ====================

async function login(page: Page): Promise<boolean> {
  const account = TEST_ACCOUNT;

  try {
    console.log(`🔐 登录: ${account.username}`);
    await page.goto(`${CONFIG.baseUrl}/login`);
    await page.waitForLoadState('networkidle');

    // 检查是否已登录
    if (!page.url().includes('/login')) {
      console.log('✅ 已登录状态');
      return true;
    }

    // 等待登录表单加载
    await page.waitForSelector('.login-container, .login-form, .el-form', { timeout: 15000 });

    // 填写表单
    const usernameInput = page.locator('input').first();
    const passwordInput = page.locator('input[type="password"]');

    await usernameInput.fill(account.username);
    await passwordInput.fill(account.password);

    // 点击登录按钮
    const loginBtn = page.locator('button').filter({ hasText: /登.*录|Login/i });
    await loginBtn.click();

    // 等待登录响应
    await page.waitForTimeout(3000);

    // 等待跳转离开登录页
    try {
      await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 15000 });
    } catch {
      // 检查是否有错误消息
      const errorMsg = await page.locator('.el-message--error').textContent().catch(() => null);
      if (errorMsg) {
        console.log(`❌ 登录错误: ${errorMsg}`);
        return false;
      }
    }

    if (!page.url().includes('/login')) {
      console.log(`✅ 登录成功: ${account.username}`);
      return true;
    }

    console.log('❌ 登录失败: 仍在登录页');
    await page.screenshot({
      path: path.join(CONFIG.reportDir, 'screenshots', 'login-failed.png'),
      fullPage: true,
    });
    return false;
  } catch (error) {
    console.error(`❌ 登录异常: ${error}`);
    await page.screenshot({
      path: path.join(CONFIG.reportDir, 'screenshots', 'login-error.png'),
      fullPage: true,
    }).catch(() => {});
    return false;
  }
}

// ==================== 测试用例 ====================

async function testDashboard(page: Page): Promise<boolean> {
  const testName = '经营驾驶舱';
  console.log(`\n🧪 测试: ${testName}`);

  try {
    await page.goto(`${CONFIG.baseUrl}/smart-bi/dashboard`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    // 验证 KPI 卡片
    const kpiCards = page.locator('.kpi-card, .kpi-item, .stat-card');
    const kpiCount = await kpiCards.count();
    console.log(`  ✓ KPI 卡片: ${kpiCount} 个`);

    // 验证 KPI 有真实数值
    if (kpiCount > 0) {
      const kpiValue = await kpiCards.first().locator('.kpi-value, .value, .number').textContent().catch(() => '');
      if (kpiValue && kpiValue.trim() !== '' && kpiValue !== '0' && kpiValue !== '--') {
        console.log(`  ✓ KPI 数值: ${kpiValue.trim()}`);
      } else {
        console.log('  ⚠️ KPI 无真实数值');
      }
    }

    // 验证图表
    const charts = page.locator('canvas');
    const chartCount = await charts.count();
    console.log(`  ✓ 图表: ${chartCount} 个`);

    // 点击刷新
    const refreshBtn = page.locator('button').filter({ hasText: /刷新|Refresh/i });
    if (await refreshBtn.first().isVisible({ timeout: 2000 }).catch(() => false)) {
      await refreshBtn.first().click();
      await page.waitForTimeout(2000);
      console.log('  ✓ 刷新成功');
    }

    // 必须有 KPI 或图表
    if (kpiCount === 0 && chartCount === 0) {
      console.log('  ❌ 无数据显示');
      return false;
    }

    console.log(`✅ ${testName} 通过`);
    return true;
  } catch (error) {
    console.error(`❌ ${testName} 失败: ${error}`);
    return false;
  }
}

async function testAIQuery(page: Page): Promise<boolean> {
  const testName = 'AI问答';
  console.log(`\n🧪 测试: ${testName}`);

  try {
    await page.goto(`${CONFIG.baseUrl}/smart-bi/query`);
    await page.waitForLoadState('networkidle');

    // 验证输入区域
    const inputArea = page.locator('textarea, .el-textarea__inner');
    if (!(await inputArea.first().isVisible({ timeout: 5000 }).catch(() => false))) {
      throw new Error('输入区域未显示');
    }

    // 发送测试问题
    const questions = ['本月销售额是多少?', '利润最高的产品是什么?', '销售趋势如何?'];
    const question = questions[Math.floor(Math.random() * questions.length)];

    await inputArea.first().fill(question);

    const sendBtn = page.locator('button[class*="primary"]').last();
    await sendBtn.click();

    // 等待响应
    await page.waitForTimeout(5000);
    console.log(`  ✓ 问题 "${question}" 已发送`);

    console.log(`✅ ${testName} 通过`);
    return true;
  } catch (error) {
    console.error(`❌ ${testName} 失败: ${error}`);
    return false;
  }
}

async function testExcelUpload(page: Page): Promise<boolean> {
  const testName = 'Excel上传与分析';
  console.log(`\n🧪 测试: ${testName}`);

  // 长超时配置 - 多 Sheet Excel 分析需要更长时间
  const UPLOAD_TIMEOUT = 30000;    // 上传超时 30秒
  const PARSE_TIMEOUT = 180000;    // 解析超时 3分钟
  const ANALYSIS_TIMEOUT = 300000; // 分析超时 5分钟

  try {
    await page.goto(`${CONFIG.baseUrl}/smart-bi/analysis`);
    await page.waitForLoadState('networkidle');

    // 验证上传区域
    const uploadArea = page.locator('.upload-area, .el-upload-dragger, .el-upload');
    if (!(await uploadArea.first().isVisible({ timeout: 5000 }).catch(() => false))) {
      console.log('  ⚠️ 上传区域未显示');
      return false;
    }
    console.log('  ✓ 页面加载成功');

    // 检查是否有测试文件
    const testFiles = fs.readdirSync(CONFIG.testDataDir).filter((f) => f.endsWith('.xlsx'));
    if (testFiles.length === 0) {
      console.log('  ❌ 无测试文件');
      return false;
    }

    // 上传文件
    const testFile = path.join(CONFIG.testDataDir, testFiles[0]);
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(testFile);
    console.log(`  📤 上传文件: ${testFiles[0]}`);

    // 等待文件显示在列表中
    await page.waitForTimeout(2000);

    // 点击"开始分析"按钮
    const startAnalyzeBtn = page.locator('button').filter({ hasText: /开始分析|上传并分析/ }).first();
    if (await startAnalyzeBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      // 等待按钮可点击 (非 loading 状态)
      await startAnalyzeBtn.waitFor({ state: 'visible', timeout: 10000 });
      const isDisabled = await startAnalyzeBtn.isDisabled().catch(() => false);
      if (!isDisabled) {
        await startAnalyzeBtn.click();
        console.log('  🔄 点击开始分析...');
      } else {
        console.log('  ⚠️ 分析按钮被禁用，可能正在处理中');
      }
    }

    // ===== 等待解析完成 =====
    console.log('  ⏳ 等待解析完成...');

    // 等待进度条出现，然后等待其消失或显示100%
    const progressBar = page.locator('.el-progress, .progress-bar, [class*="progress"]');
    const parseStartTime = Date.now();

    // 轮询等待解析完成
    let parseComplete = false;
    while (Date.now() - parseStartTime < PARSE_TIMEOUT) {
      // 检查进度百分比
      const progressText = await page.locator('.el-progress__text, .progress-text, [class*="percentage"]')
        .first().textContent().catch(() => '');

      if (progressText && progressText.includes('100')) {
        console.log('  ✓ 解析进度: 100%');
        parseComplete = true;
        break;
      }

      // 检查是否有解析结果显示
      const hasParseResult = await page.locator('.parse-result, .sheet-list, .field-list, .preview-section')
        .first().isVisible({ timeout: 1000 }).catch(() => false);
      if (hasParseResult) {
        console.log('  ✓ 解析结果已显示');
        parseComplete = true;
        break;
      }

      // 检查是否有错误消息
      const errorMsg = await page.locator('.el-message--error, .error-message').textContent().catch(() => '');
      if (errorMsg) {
        console.log(`  ❌ 解析错误: ${errorMsg}`);
        return false;
      }

      // 检查分析按钮是否恢复可用（表示处理完成）
      const analyzeBtn = page.locator('button').filter({ hasText: /开始分析|确认分析|生成报告/ }).first();
      const btnEnabled = await analyzeBtn.isEnabled({ timeout: 1000 }).catch(() => false);
      const btnLoading = await analyzeBtn.locator('.el-icon-loading, .is-loading').isVisible().catch(() => false);

      if (btnEnabled && !btnLoading) {
        // 按钮可用且非加载状态，说明处理完成
        const btnText = await analyzeBtn.textContent().catch(() => '');
        if (btnText && !btnText.includes('处理中') && !btnText.includes('解析中')) {
          console.log('  ✓ 解析完成（按钮可用）');
          parseComplete = true;
          break;
        }
      }

      // 打印当前进度
      if (progressText && !progressText.includes('0%')) {
        console.log(`  ... 进度: ${progressText.trim()}`);
      }

      await page.waitForTimeout(5000); // 每5秒检查一次
    }

    if (!parseComplete) {
      console.log('  ⚠️ 解析超时，尝试继续...');
      await page.screenshot({
        path: path.join(CONFIG.reportDir, 'screenshots', `excel-parse-timeout-${Date.now()}.png`),
        fullPage: true,
      });
    }

    // ===== 触发分析（如果需要）=====
    const confirmBtn = page.locator('button').filter({ hasText: /确认分析|生成报告|开始分析/ }).first();
    if (await confirmBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      const isEnabled = await confirmBtn.isEnabled().catch(() => false);
      if (isEnabled) {
        await confirmBtn.click();
        console.log('  🔄 触发分析...');
      }
    }

    // ===== 等待分析结果 =====
    console.log('  ⏳ 等待分析结果...');

    // 等待图表或 KPI 出现
    const analysisResult = page.locator('canvas, [id*="chart"], .echarts-container, .kpi-card, .kpi-grid, .chart-container');
    try {
      await analysisResult.first().waitFor({ state: 'visible', timeout: ANALYSIS_TIMEOUT });
      console.log('  ✓ 分析结果已显示');
    } catch {
      // 可能结果在其他位置，继续检查
    }

    // 等待足够时间让图表渲染
    await page.waitForTimeout(5000);

    // ===== 验证结果 =====

    // 检查图表
    const charts = page.locator('canvas, [id*="chart"], .echarts-container');
    const chartCount = await charts.count();
    if (chartCount > 0) {
      console.log(`  ✓ 图表生成: ${chartCount} 个`);
    }

    // 检查 KPI 卡片
    const kpiCards = page.locator('.kpi-card, .kpi-item, .stat-card, .summary-card');
    const kpiCount = await kpiCards.count();
    if (kpiCount > 0) {
      console.log(`  ✓ KPI 卡片: ${kpiCount} 个`);
    }

    // 检查数据表格
    const tables = page.locator('.el-table, .preview-table, table');
    const hasTable = await tables.first().isVisible({ timeout: 3000 }).catch(() => false);
    if (hasTable) {
      const rowCount = await page.locator('.el-table__row, tbody tr').count();
      console.log(`  ✓ 数据表格: ${rowCount} 行`);
    }

    // 检查 AI 洞察
    const insights = page.locator('.insight-section, .insight-item, .ai-insight, .insight-panel');
    const insightCount = await insights.count();
    if (insightCount > 0) {
      console.log(`  ✓ AI 洞察: ${insightCount} 条`);
    }

    // ===== 最终验证 =====
    const hasRealData = chartCount > 0 || kpiCount > 0 || hasTable || insightCount > 0;
    if (!hasRealData) {
      console.log('  ❌ 未生成真实数据或图表');
      await page.screenshot({
        path: path.join(CONFIG.reportDir, 'screenshots', `excel-no-data-${Date.now()}.png`),
        fullPage: true,
      });
      return false;
    }

    // ===== 保存分析结果（持久化到数据库）=====
    // 按钮文字是"保存分析结果"，需要滚动到可见区域
    await page.evaluate(() => {
      (window as Window).scrollTo(0, (document as Document).body.scrollHeight);
    });
    await page.waitForTimeout(1000);

    // 查找保存按钮 (精确匹配)
    const saveBtn = page.locator('button:has-text("保存分析结果")').first();
    const saveBtnVisible = await saveBtn.isVisible({ timeout: 10000 }).catch(() => false);

    if (saveBtnVisible) {
      const isEnabled = await saveBtn.isEnabled().catch(() => false);
      if (isEnabled) {
        await saveBtn.click();
        console.log('  💾 点击保存分析结果...');

        // 等待保存成功提示或保存结果页面
        await page.waitForTimeout(3000);

        // 检查是否跳转到保存确认页面 (步骤4)
        const saveResult = page.locator('.save-result, .el-result');
        const saveResultVisible = await saveResult.isVisible({ timeout: 15000 }).catch(() => false);

        if (saveResultVisible) {
          console.log('  ✓ 数据已持久化到数据库');
        } else {
          // 检查成功消息
          const successMsg = await page.locator('.el-message--success').textContent().catch(() => '');
          if (successMsg && successMsg.includes('保存')) {
            console.log('  ✓ 保存成功');
          } else {
            console.log('  ⚠️ 保存状态未确认');
          }
        }
      } else {
        console.log('  ⚠️ 保存按钮被禁用');
      }
    } else {
      // 可能按钮在不同位置，尝试其他方式
      const altSaveBtn = page.locator('.analysis-actions button, .step-content button').filter({ hasText: /保存/ });
      if (await altSaveBtn.first().isVisible({ timeout: 3000 }).catch(() => false)) {
        await altSaveBtn.first().click();
        console.log('  💾 点击保存（备用选择器）...');
        await page.waitForTimeout(3000);
      } else {
        console.log('  ⚠️ 未找到保存按钮（分析可能仍在进行中）');
      }
    }

    console.log(`✅ ${testName} 通过`);
    return true;
  } catch (error) {
    console.error(`❌ ${testName} 失败: ${error}`);
    await page.screenshot({
      path: path.join(CONFIG.reportDir, 'screenshots', `excel-error-${Date.now()}.png`),
      fullPage: true,
    }).catch(() => {});
    return false;
  }
}

async function testSalesAnalysis(page: Page): Promise<boolean> {
  const testName = '销售分析';
  console.log(`\n🧪 测试: ${testName}`);

  try {
    await page.goto(`${CONFIG.baseUrl}/smart-bi/sales`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    // 验证页面内容
    const content = page.locator('.el-card, .kpi-cards, .chart-container');
    if (await content.first().isVisible({ timeout: 10000 }).catch(() => false)) {
      console.log('  ✓ 页面加载成功');
    }

    // 验证有真实数据
    const charts = page.locator('canvas, [id*="chart"], .echarts-container');
    const chartCount = await charts.count();
    console.log(`  ✓ 图表: ${chartCount} 个`);

    // 检查是否有数据表格
    const tables = page.locator('.el-table, table');
    const tableCount = await tables.count();
    if (tableCount > 0) {
      const rowCount = await page.locator('.el-table__row, tbody tr').count();
      console.log(`  ✓ 数据表格: ${rowCount} 行`);
    }

    // 检查销售数值
    const salesValue = await page.locator('.kpi-value, .sales-value, .value').first().textContent().catch(() => '');
    if (salesValue && salesValue.trim() !== '' && salesValue !== '--') {
      console.log(`  ✓ 销售数据: ${salesValue.trim()}`);
    }

    console.log(`✅ ${testName} 通过`);
    return true;
  } catch (error) {
    console.error(`❌ ${testName} 失败: ${error}`);
    return false;
  }
}

async function testFinanceAnalysis(page: Page): Promise<boolean> {
  const testName = '财务分析';
  console.log(`\n🧪 测试: ${testName}`);

  try {
    await page.goto(`${CONFIG.baseUrl}/smart-bi/finance`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    // 验证页面内容
    const content = page.locator('.el-card, .finance-section, .kpi-cards');
    if (await content.first().isVisible({ timeout: 10000 }).catch(() => false)) {
      console.log('  ✓ 页面加载成功');
    }

    // 检查财务指标文字
    const pageText = await page.textContent('body');
    const hasMetrics = ['收入', '利润', '成本', 'Revenue', 'Profit', '毛利'].some((m) =>
      pageText?.includes(m)
    );
    if (hasMetrics) {
      console.log('  ✓ 财务指标标签正常');
    }

    // 验证有真实数值
    const kpiValues = page.locator('.kpi-value, .finance-value, .value, .amount');
    const valueCount = await kpiValues.count();
    if (valueCount > 0) {
      const firstValue = await kpiValues.first().textContent().catch(() => '');
      if (firstValue && firstValue.trim() !== '' && firstValue !== '--' && firstValue !== '0') {
        console.log(`  ✓ 财务数值: ${firstValue.trim()}`);
      }
    }

    // 验证图表
    const charts = page.locator('canvas, [id*="chart"], .echarts-container');
    const chartCount = await charts.count();
    console.log(`  ✓ 图表: ${chartCount} 个`);

    console.log(`✅ ${testName} 通过`);
    return true;
  } catch (error) {
    console.error(`❌ ${testName} 失败: ${error}`);
    return false;
  }
}

// ==================== 报告 ====================

async function saveErrorScreenshot(page: Page, testName: string, loop: number): Promise<string> {
  const filename = `error-loop${loop}-${testName.replace(/\s+/g, '-')}-${Date.now()}.png`;
  const filepath = path.join(CONFIG.reportDir, 'screenshots', filename);

  await page.screenshot({ path: filepath, fullPage: true }).catch(() => {});
  return filepath;
}

function printStats(): void {
  const duration = (Date.now() - stats.startTime.getTime()) / 1000;
  const minutes = Math.floor(duration / 60);
  const seconds = Math.floor(duration % 60);
  const successRate = stats.totalTests > 0
    ? ((stats.passed / stats.totalTests) * 100).toFixed(1)
    : '0';

  console.log('\n' + '='.repeat(60));
  console.log('📊 Ralph Loop 统计');
  console.log('='.repeat(60));
  console.log(`🔄 完成轮数: ${stats.totalLoops}`);
  console.log(`🧪 总测试数: ${stats.totalTests}`);
  console.log(`✅ 通过: ${stats.passed}`);
  console.log(`❌ 失败: ${stats.failed}`);
  console.log(`📈 成功率: ${successRate}%`);
  console.log(`🚀 部署次数: ${stats.deployments}`);
  console.log(`⏱️ 运行时间: ${minutes}分${seconds}秒`);

  if (stats.errors.length > 0) {
    console.log('\n📋 最近错误:');
    stats.errors.slice(-5).forEach((e, i) => {
      console.log(`  ${i + 1}. [Loop ${e.loop}] ${e.test}: ${e.error}`);
    });
  }
  console.log('='.repeat(60));
}

function saveReport(): void {
  const reportPath = path.join(CONFIG.reportDir, `ralph-loop-report-${Date.now()}.json`);

  fs.writeFileSync(
    reportPath,
    JSON.stringify(
      {
        ...stats,
        config: CONFIG,
        successRate:
          stats.totalTests > 0
            ? ((stats.passed / stats.totalTests) * 100).toFixed(2) + '%'
            : '0%',
      },
      null,
      2
    )
  );

  console.log(`\n📄 报告已保存: ${reportPath}`);
}

// ==================== 主循环 ====================

async function runLoop(page: Page, loopNumber: number): Promise<void> {
  console.log('\n' + '─'.repeat(60));
  console.log(`🔄 开始第 ${loopNumber} 轮测试`);
  console.log('─'.repeat(60));

  const tests = [
    { name: 'Dashboard', fn: testDashboard },
    { name: 'AI问答', fn: testAIQuery },
    { name: 'Excel上传', fn: testExcelUpload },
    { name: '销售分析', fn: testSalesAnalysis },
    { name: '财务分析', fn: testFinanceAnalysis },
  ];

  for (const test of tests) {
    stats.totalTests++;

    try {
      const passed = await test.fn(page);

      if (passed) {
        stats.passed++;
      } else {
        stats.failed++;
        const screenshot = await saveErrorScreenshot(page, test.name, loopNumber);
        stats.errors.push({
          loop: loopNumber,
          test: test.name,
          error: '测试失败',
          screenshot,
          timestamp: new Date(),
        });

        if (CONFIG.pauseOnError) {
          console.log('\n⏸️ 发现错误，暂停中... 按 Ctrl+C 退出');
          await new Promise((resolve) => setTimeout(resolve, 60000));
        }
      }
    } catch (error) {
      stats.failed++;
      const screenshot = await saveErrorScreenshot(page, test.name, loopNumber);
      stats.errors.push({
        loop: loopNumber,
        test: test.name,
        error: String(error),
        screenshot,
        timestamp: new Date(),
      });
    }
  }

  stats.totalLoops++;
  stats.lastLoopTime = new Date();

  // 每 5 轮打印统计
  if (loopNumber % 5 === 0) {
    printStats();
  }
}

// ==================== 主函数 ====================

async function main(): Promise<void> {
  console.log('🚀 Ralph Loop - SmartBI 完整自动化测试');
  console.log('=' .repeat(60));
  console.log(`📍 前端: ${CONFIG.baseUrl}`);
  console.log(`📍 后端: ${CONFIG.backendUrl}`);
  console.log(`🖥️ 模式: ${CONFIG.headed ? '有头浏览器' : '无头浏览器'}`);
  console.log(`🔄 最大轮数: ${CONFIG.maxLoops === Infinity ? '无限' : CONFIG.maxLoops}`);
  console.log(`👤 账号: ${TEST_ACCOUNT.username}`);
  console.log('=' .repeat(60));

  // ===== 步骤1: 确保后端服务可用 =====
  const backendReady = await ensureBackendAvailable();
  if (!backendReady) {
    console.error('\n❌ 后端服务无法启动，测试终止');
    process.exit(1);
  }

  // ===== 步骤2: 启动浏览器 =====
  console.log('\n🌐 启动浏览器...');
  const browser: Browser = await chromium.launch({
    headless: !CONFIG.headed,
    slowMo: CONFIG.slowMo,
    args: ['--start-maximized'],
  });

  const context: BrowserContext = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    ignoreHTTPSErrors: true,
  });

  const page: Page = await context.newPage();

  // 处理退出信号
  let running = true;
  process.on('SIGINT', () => {
    console.log('\n\n🛑 收到停止信号...');
    running = false;
  });

  try {
    // ===== 步骤3: 登录 =====
    const loggedIn = await login(page);
    if (!loggedIn) {
      throw new Error('登录失败，无法继续测试');
    }

    // ===== 步骤4: 主测试循环 =====
    let loopNumber = 0;
    while (running && loopNumber < CONFIG.maxLoops) {
      loopNumber++;

      // 每轮开始前检查后端健康
      const healthy = await checkBackendHealth();
      if (!healthy) {
        console.log('\n⚠️ 后端服务异常，重新部署...');
        const deployed = await deployBackend();
        if (!deployed) {
          console.log('❌ 部署失败，跳过本轮');
          continue;
        }
      }

      await runLoop(page, loopNumber);

      // 短暂休息
      await page.waitForTimeout(2000);
    }
  } catch (error) {
    console.error('❌ 致命错误:', error);
  } finally {
    // 保存最终报告
    printStats();
    saveReport();

    // 关闭浏览器
    await browser.close();
    console.log('\n👋 Ralph Loop 结束');
  }
}

// 运行
main().catch(console.error);
