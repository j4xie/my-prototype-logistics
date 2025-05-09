/**
 * 运行单元测试脚本
 * @version 1.0.0
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

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
console.log(`${colors.bright}${colors.blue}  食品溯源系统 - 单元测试执行脚本`);
console.log(`${colors.bright}${colors.blue}=======================================\n${colors.reset}`);

// 获取测试目录
const unitTestDir = path.join(__dirname, 'unit');

try {
  // 检查测试目录是否存在
  if (!fs.existsSync(unitTestDir)) {
    console.error(`${colors.bright}${colors.red}错误：单元测试目录不存在: ${unitTestDir}${colors.reset}`);
    process.exit(1);
  }

  // 获取所有测试文件
  const testFiles = fs.readdirSync(unitTestDir)
    .filter(file => file.endsWith('.test.js'));

  if (testFiles.length === 0) {
    console.log(`${colors.yellow}警告：未找到测试文件。请确保测试文件以 .test.js 结尾。${colors.reset}`);
    process.exit(0);
  }

  console.log(`${colors.cyan}发现 ${testFiles.length} 个测试文件...${colors.reset}\n`);

  // 运行单元测试
  console.log(`${colors.bright}开始执行单元测试...${colors.reset}\n`);
  
  try {
    // 使用Jest运行测试
    execSync('npx jest tests/unit', { stdio: 'inherit' });
    
    console.log(`\n${colors.green}${colors.bright}✓ 所有单元测试通过！${colors.reset}`);
  } catch (err) {
    console.error(`\n${colors.red}${colors.bright}✗ 单元测试失败！${colors.reset}`);
    process.exit(1);
  }
} catch (err) {
  console.error(`${colors.red}${colors.bright}执行过程出错: ${err.message}${colors.reset}`);
  process.exit(1);
} 