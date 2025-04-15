/**
 * 运行安全测试脚本
 * @version 1.0.0
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const commander = require('commander');

// 颜色输出函数
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

console.log(`${colors.bright}${colors.blue}=======================================`);
console.log(`${colors.bright}${colors.blue}  食品溯源系统 - 安全测试执行脚本`);
console.log(`${colors.bright}${colors.blue}=======================================\n${colors.reset}`);

// 创建命令行程序
const program = new commander.Command();
program
  .version('1.0.0', '-v, --version', '显示版本号')
  .description('食品溯源系统安全测试执行工具')
  .option('-t, --test <type>', '指定要运行的测试类型 (xss, csrf, permissions, sql, input, session, all)', 'all')
  .option('-r, --report', '生成安全测试报告', false)
  .option('-v, --verbose', '显示详细测试结果', false)
  .parse(process.argv);

const options = program.opts();

// 获取测试目录
const securityTestDir = path.join(__dirname, 'security');

try {
  // 检查测试目录是否存在
  if (!fs.existsSync(securityTestDir)) {
    console.error(`${colors.bright}${colors.red}错误：安全测试目录不存在: ${securityTestDir}${colors.reset}`);
    process.exit(1);
  }

  // 检查主测试文件是否存在
  const securityTestFile = path.join(securityTestDir, 'security-tests.js');
  if (!fs.existsSync(securityTestFile)) {
    console.error(`${colors.bright}${colors.red}错误：安全测试文件不存在: ${securityTestFile}${colors.reset}`);
    process.exit(1);
  }

  // 检查reports目录是否存在，不存在则创建
  const reportsDir = path.join(securityTestDir, 'reports');
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
    console.log(`${colors.cyan}创建报告目录: ${reportsDir}${colors.reset}`);
  }

  // 检查screenshots目录是否存在，不存在则创建
  const screenshotsDir = path.join(securityTestDir, 'screenshots');
  if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir, { recursive: true });
    console.log(`${colors.cyan}创建截图目录: ${screenshotsDir}${colors.reset}`);
  }

  // 设置命令行参数
  let cmdArgs = [];
  
  if (options.test !== 'all') {
    cmdArgs.push(`--test=${options.test}`);
  }
  
  if (options.report) {
    cmdArgs.push('--report');
  }
  
  if (options.verbose) {
    cmdArgs.push('--verbose');
  }

  // 运行安全测试
  console.log(`${colors.bright}开始执行安全测试...${colors.reset}\n`);
  
  try {
    const cmd = `node ${securityTestFile} ${cmdArgs.join(' ')}`;
    console.log(`${colors.cyan}执行命令: ${cmd}${colors.reset}\n`);
    
    execSync(cmd, { stdio: 'inherit' });
    
    console.log(`\n${colors.green}${colors.bright}✓ 安全测试完成！${colors.reset}`);
    
    // 显示报告位置
    console.log(`\n${colors.cyan}测试报告已生成在: ${reportsDir}${colors.reset}`);
    const htmlReport = path.join(reportsDir, 'security-report.html');
    if (fs.existsSync(htmlReport)) {
      console.log(`${colors.cyan}HTML报告: ${htmlReport}${colors.reset}`);
    }
    const jsonReport = path.join(reportsDir, 'security-report.json');
    if (fs.existsSync(jsonReport)) {
      console.log(`${colors.cyan}JSON报告: ${jsonReport}${colors.reset}`);
    }
  } catch (err) {
    console.error(`\n${colors.red}${colors.bright}✗ 安全测试失败！${colors.reset}`);
    process.exit(1);
  }
} catch (err) {
  console.error(`${colors.red}${colors.bright}执行过程出错: ${err.message}${colors.reset}`);
  process.exit(1);
} 