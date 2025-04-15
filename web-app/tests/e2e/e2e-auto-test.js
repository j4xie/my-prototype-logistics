/**
 * 食品溯源系统 - 端到端测试自动化流程脚本
 * 版本：1.0.0
 * 
 * 此脚本提供完整的端到端测试自动化流程，包括：
 * - 自动化测试流程
 * - 测试报告生成
 * - 测试失败时的重试机制
 * - CI/CD流程集成支持
 * - 并行测试执行
 * - 多浏览器测试支持
 * 
 * 使用方法：
 * node e2e-auto-test.js [参数]
 * 
 * 常用参数：
 * --ci                在CI环境中运行，优化输出和行为
 * --report=<格式>      生成指定格式的报告(html,json,junit)
 * --retry=<次数>       测试失败时重试的次数(默认为2)
 * --parallel=<数量>    并行运行的测试数量
 * --browsers=<列表>    指定运行的浏览器(chrome,firefox,webkit)
 * --suite=<名称>       运行特定的测试套件(login,trace,all)
 * --max-failures=<数量> 达到指定失败数后停止测试(默认无限制)
 * --timeout=<毫秒>     设置测试超时时间
 * 
 * 示例：
 * node e2e-auto-test.js --ci --report=html --retry=3     # CI环境运行，生成HTML报告，失败重试3次
 * node e2e-auto-test.js --browsers=chrome,firefox        # 在Chrome和Firefox中运行测试
 * node e2e-auto-test.js --suite=trace --parallel=4       # 并行运行溯源测试套件，使用4个工作进程
 */

const path = require('path');
const fs = require('fs');
const { spawnSync, spawn } = require('child_process');
const os = require('os');

// 项目路径配置
const PROJECT_PATHS = {
  get root() {
    return findProjectRoot();
  },
  get webApp() {
    return path.join(this.root, 'web-app');
  },
  get e2eTests() {
    return path.join(this.webApp, 'tests', 'e2e');
  },
  get testResults() {
    return path.join(this.webApp, 'tests', 'e2e', 'results');
  },
  get reportDir() {
    return path.join(this.webApp, 'tests', 'e2e', 'reports');
  }
};

// 测试套件配置
const TEST_SUITES = {
  all: '**/*.test.js',
  login: 'login.test.js',
  trace: 'trace*.test.js', // 匹配所有trace相关测试
  critical: ['login.test.js', 'trace.test.js'] // 关键路径测试
};

/**
 * 查找项目根目录
 * @returns {string} 项目根目录路径
 */
function findProjectRoot() {
  let currentDir = process.cwd();
  
  // 向上查找，直到找到package.json或达到根目录
  for (let i = 0; i < 10; i++) {
    if (fs.existsSync(path.join(currentDir, 'package.json'))) {
      const packageJson = require(path.join(currentDir, 'package.json'));
      // 检查是否是我们的项目package.json
      if (packageJson.name && packageJson.name.includes('food-trace')) {
        return currentDir;
      }
    }
    
    // 检查是否到达根目录
    const parentDir = path.dirname(currentDir);
    if (parentDir === currentDir) {
      break;
    }
    currentDir = parentDir;
  }
  
  // 没找到，返回当前目录
  console.warn('警告: 无法找到项目根目录，将使用当前目录');
  return process.cwd();
}

/**
 * 解析命令行参数
 * @returns {Object} 解析后的命令行参数
 */
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    ci: args.includes('--ci'),
    report: args.find(arg => arg.startsWith('--report=')) 
            ? args.find(arg => arg.startsWith('--report=')).replace('--report=', '') 
            : null,
    retry: args.find(arg => arg.startsWith('--retry='))
           ? parseInt(args.find(arg => arg.startsWith('--retry=')).replace('--retry=', ''), 10)
           : 2,
    parallel: args.find(arg => arg.startsWith('--parallel='))
              ? parseInt(args.find(arg => arg.startsWith('--parallel=')).replace('--parallel=', ''), 10)
              : Math.max(1, Math.floor(os.cpus().length / 2)), // 默认为CPU核心数的一半
    browsers: args.find(arg => arg.startsWith('--browsers='))
              ? args.find(arg => arg.startsWith('--browsers=')).replace('--browsers=', '').split(',')
              : ['chromium', 'firefox', 'webkit'],
    suite: args.find(arg => arg.startsWith('--suite='))
           ? args.find(arg => arg.startsWith('--suite=')).replace('--suite=', '')
           : 'all',
    maxFailures: args.find(arg => arg.startsWith('--max-failures='))
                ? parseInt(args.find(arg => arg.startsWith('--max-failures=')).replace('--max-failures=', ''), 10)
                : 0, // 0表示无限制
    timeout: args.find(arg => arg.startsWith('--timeout='))
             ? parseInt(args.find(arg => arg.startsWith('--timeout=')).replace('--timeout=', ''), 10)
             : 30000, // 默认30秒
    updateSnapshots: args.includes('--update-snapshots'),
    verbose: args.includes('--verbose')
  };
  
  return options;
}

/**
 * 准备测试环境
 * @param {Object} options 配置选项
 */
function prepareTestEnvironment(options) {
  console.log('准备测试环境...');
  
  // 确保测试结果目录存在
  [PROJECT_PATHS.testResults, PROJECT_PATHS.reportDir].forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });
  
  // 设置环境变量
  process.env.NODE_ENV = 'test';
  process.env.TEST_AUTOMATION = 'true';
  
  if (options.ci) {
    process.env.CI = 'true';
  }
  
  // 加载setup-env.js如果存在
  const setupEnvPath = path.join(PROJECT_PATHS.e2eTests, 'setup-env.js');
  if (fs.existsSync(setupEnvPath)) {
    try {
      require(setupEnvPath);
      console.log('已加载测试环境设置');
    } catch (error) {
      console.error('加载测试环境设置失败:', error.message);
      throw error;
    }
  } else {
    console.warn('警告: 找不到setup-env.js文件');
  }
}

/**
 * 构建测试命令参数
 * @param {Object} options 配置选项
 * @returns {Array} 命令行参数数组
 */
function buildTestCommandArgs(options) {
  const args = ['playwright', 'test'];
  
  // 添加测试套件
  const testPattern = TEST_SUITES[options.suite] || options.suite;
  if (Array.isArray(testPattern)) {
    testPattern.forEach(pattern => args.push(pattern));
  } else {
    args.push(testPattern);
  }
  
  // 重试次数
  if (options.retry > 0) {
    args.push('--retries', options.retry.toString());
  }
  
  // 并行运行
  if (options.parallel > 1) {
    args.push('--workers', options.parallel.toString());
  }
  
  // 指定浏览器
  if (options.browsers && options.browsers.length > 0) {
    args.push('--project', ...options.browsers);
  }
  
  // 测试报告
  if (options.report) {
    const reportFormats = options.report.split(',');
    reportFormats.forEach(format => {
      const reportPath = path.join(PROJECT_PATHS.reportDir, `report.${format}`);
      args.push(`--reporter=${format}`, `--output=${reportPath}`);
    });
  }
  
  // 最大失败数
  if (options.maxFailures > 0) {
    args.push('--max-failures', options.maxFailures.toString());
  }
  
  // 测试超时
  if (options.timeout) {
    args.push('--timeout', options.timeout.toString());
  }
  
  // 更新快照
  if (options.updateSnapshots) {
    args.push('--update-snapshots');
  }
  
  // 详细输出
  if (options.verbose) {
    args.push('--verbose');
  }
  
  return args;
}

/**
 * 运行测试命令
 * @param {Array} cmdArgs 命令行参数
 * @returns {Object} 测试结果
 */
function runTestCommand(cmdArgs) {
  console.log(`运行命令: npx ${cmdArgs.join(' ')}`);
  
  const cmd = process.platform === 'win32' ? 'npx.cmd' : 'npx';
  const startTime = Date.now();
  
  const result = spawnSync(cmd, cmdArgs, {
    stdio: 'inherit',
    shell: true,
    cwd: PROJECT_PATHS.webApp
  });
  
  const endTime = Date.now();
  const duration = ((endTime - startTime) / 1000).toFixed(2);
  
  return {
    exitCode: result.status,
    error: result.error,
    duration
  };
}

/**
 * 生成测试摘要
 * @param {Object} result 测试结果
 * @param {Object} options 配置选项
 */
function generateTestSummary(result, options) {
  console.log('\n============================================');
  console.log('             测试执行摘要                   ');
  console.log('============================================');
  console.log(`测试套件: ${options.suite}`);
  console.log(`浏览器: ${options.browsers.join(', ')}`);
  console.log(`并行度: ${options.parallel}`);
  console.log(`重试次数: ${options.retry}`);
  console.log(`运行时间: ${result.duration}秒`);
  console.log(`结果: ${result.exitCode === 0 ? '成功 ✅' : '失败 ❌'}`);
  
  if (options.report) {
    console.log('\n测试报告已生成:');
    options.report.split(',').forEach(format => {
      const reportPath = path.join(PROJECT_PATHS.reportDir, `report.${format}`);
      console.log(`- ${format}: ${reportPath}`);
    });
  }
  
  console.log('============================================');
}

/**
 * 构建命令行测试报告
 * 根据测试结果JSON文件生成简单的控制台报告
 */
function buildConsoleReport() {
  const jsonReportPath = path.join(PROJECT_PATHS.reportDir, 'report.json');
  if (!fs.existsSync(jsonReportPath)) {
    console.warn('警告: 无法生成控制台报告，找不到JSON报告文件');
    return;
  }
  
  try {
    const reportData = JSON.parse(fs.readFileSync(jsonReportPath, 'utf8'));
    const suites = reportData.suites || [];
    const specs = reportData.specs || [];
    
    let totalTests = 0;
    let passedTests = 0;
    let failedTests = 0;
    let skippedTests = 0;
    
    // 统计数据
    specs.forEach(spec => {
      totalTests++;
      if (spec.ok) passedTests++;
      else if (spec.skipped) skippedTests++;
      else failedTests++;
    });
    
    console.log('\n📊 测试统计:');
    console.log(`总测试数: ${totalTests}`);
    console.log(`通过: ${passedTests} (${Math.round(passedTests/totalTests*100)}%)`);
    console.log(`失败: ${failedTests}`);
    console.log(`跳过: ${skippedTests}`);
    
    // 显示失败的测试
    if (failedTests > 0) {
      console.log('\n❌ 失败的测试:');
      specs.filter(spec => !spec.ok && !spec.skipped).forEach(spec => {
        console.log(`- ${spec.title} (${spec.file})`);
        if (spec.error) {
          console.log(`  错误: ${spec.error.message}`);
        }
      });
    }
  } catch (error) {
    console.error('生成控制台报告失败:', error.message);
  }
}

/**
 * 设置CI特定配置
 * @param {Object} options 配置选项
 */
function setupCIEnvironment(options) {
  if (!options.ci) return;
  
  console.log('配置CI环境...');
  
  // 在CI环境中默认禁用交互式UI
  process.env.CI = 'true';
  
  // 在CI环境中运行无头浏览器
  process.env.PLAYWRIGHT_HEADLESS = 'true';
  
  // 设置更长的超时，CI环境可能较慢
  if (!options.timeout) {
    options.timeout = 60000; // 1分钟
  }
  
  // 默认生成多格式报告
  if (!options.report) {
    options.report = 'html,junit,json';
  }
  
  // 设置CI友好的日志格式
  process.env.TEST_LOGGER_MODE = 'ci';
}

/**
 * 运行端到端测试自动化流程
 */
async function runE2EAutomation() {
  try {
    console.log('============================================');
    console.log('   食品溯源系统 - 端到端测试自动化流程     ');
    console.log('============================================');
    
    // 解析命令行参数
    const options = parseArgs();
    
    // 如果是CI环境，应用CI特定设置
    if (options.ci) {
      setupCIEnvironment(options);
    }
    
    // 打印配置信息
    console.log('运行配置:');
    Object.entries(options).forEach(([key, value]) => {
      console.log(`- ${key}: ${Array.isArray(value) ? value.join(', ') : value}`);
    });
    
    // 准备测试环境
    prepareTestEnvironment(options);
    
    // 构建测试命令参数
    const cmdArgs = buildTestCommandArgs(options);
    
    // 运行测试
    console.log('\n开始运行端到端测试...');
    const result = runTestCommand(cmdArgs);
    
    // 生成测试摘要
    generateTestSummary(result, options);
    
    // 如果有JSON报告，生成控制台摘要
    if (options.report && options.report.includes('json')) {
      buildConsoleReport();
    }
    
    // 退出码
    process.exit(result.exitCode);
    
  } catch (error) {
    console.error('端到端测试自动化流程错误:', error);
    process.exit(1);
  }
}

// 运行自动化流程
runE2EAutomation(); 