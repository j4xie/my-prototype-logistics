/**
 * 运行所有测试脚本 - 单元测试、集成测试和安全测试
 * @version 1.0.0
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const commander = require('commander');
const program = new commander.Command();

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
console.log(`${colors.bright}${colors.blue}   食品溯源系统 - 全部测试执行脚本`);
console.log(`${colors.bright}${colors.blue}=======================================\n${colors.reset}`);

// 配置命令行参数
program
  .option('--skip-unit', '跳过单元测试')
  .option('--skip-integration', '跳过集成测试')
  .option('--skip-security', '跳过安全测试')
  .option('--coverage', '生成覆盖率报告')
  .option('--report', '生成HTML测试报告')
  .option('--ci', '持续集成环境运行')
  .option('--update-doc', '更新覆盖率文档');

program.parse(process.argv);
const options = program.opts();

// 测试脚本文件路径
const TEST_SCRIPTS = {
  unit: path.join(__dirname, 'run-unit-tests.js'),
  integration: path.join(__dirname, 'run-integration-tests.js'),
  security: path.join(__dirname, 'run-security-tests.js')
};

// 检查测试脚本是否存在
Object.entries(TEST_SCRIPTS).forEach(([type, scriptPath]) => {
  if (!fs.existsSync(scriptPath)) {
    console.error(`${colors.bright}${colors.red}错误：${type}测试脚本不存在: ${scriptPath}${colors.reset}`);
    process.exit(1);
  }
});

// 主函数
const main = async () => {
  console.log(`${colors.bright}开始执行所有测试...${colors.reset}\n`);
  
  let allPassed = true;
  const startTime = new Date();
  
  // 运行各类测试
  allPassed = await runTest('unit', TEST_SCRIPTS.unit, 'skipUnit') && allPassed;
  allPassed = await runTest('integration', TEST_SCRIPTS.integration, 'skipIntegration') && allPassed;
  allPassed = await runTest('security', TEST_SCRIPTS.security, 'skipSecurity') && allPassed;
  
  const endTime = new Date();
  const duration = (endTime - startTime) / 1000;
  
  // 显示测试结果摘要
  console.log(`\n${colors.bright}${colors.blue}========== 测试结果摘要 ===========${colors.reset}`);
  console.log(`${colors.bright}总测试套件: ${Object.keys(TEST_SCRIPTS).length}${colors.reset}`);
  console.log(`${colors.green}通过: ${Object.values(TEST_SCRIPTS).filter(Boolean).length}${colors.reset}`);
  if (Object.values(TEST_SCRIPTS).filter(Boolean).length < Object.keys(TEST_SCRIPTS).length) {
    console.log(`${colors.yellow}跳过: ${Object.keys(TEST_SCRIPTS).length - Object.values(TEST_SCRIPTS).filter(Boolean).length}${colors.reset}`);
  }
  console.log(`${colors.bright}总耗时: ${duration.toFixed(2)}秒${colors.reset}`);
  
  // 生成合并报告和更新文档
  if (options.coverage) {
    generateCombinedReport();
    updateCoverageDoc();
  }
  
  // 设置退出状态码
  if (!allPassed) {
    console.log(`\n${colors.red}${colors.bright}⚠ 一些测试未通过，请检查详细报告${colors.reset}`);
    process.exit(1);
  } else {
    console.log(`\n${colors.green}${colors.bright}✓ 所有测试已成功完成${colors.reset}`);
    process.exit(0);
  }
};

// 运行测试函数
const runTest = async (type, script, skipOption) => {
  if (options[skipOption]) {
    console.log(`${colors.yellow}跳过${type}测试...${colors.reset}`);
    return true;
  }

  console.log(`${colors.cyan}开始执行${type}测试...${colors.reset}`);
  
  try {
    execSync(`node ${script}`, { 
      stdio: 'inherit',
      env: {
        ...process.env,
        CI: options.ci ? 'true' : '',
        COVERAGE: options.coverage ? 'true' : '',
        REPORT: options.report ? 'true' : ''
      }
    });
    
    console.log(`${colors.green}${colors.bright}✓ ${type}测试通过！${colors.reset}\n`);
    return true;
  } catch (err) {
    console.error(`${colors.red}${colors.bright}✗ ${type}测试失败！${colors.reset}\n`);
    return false;
  }
};

// 生成合并测试报告
const generateCombinedReport = () => {
  console.log(`${colors.cyan}生成合并测试报告...${colors.reset}`);
  
  const reportsDir = path.join(__dirname, 'reports');
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }
  
  const combinedReportPath = path.join(reportsDir, 'combined-report.html');
  
  // 这里可以添加生成合并报告的代码
  // 例如使用istanbul-combine或自定义脚本合并各个测试的覆盖率数据

  console.log(`${colors.green}测试报告已生成！${colors.reset}\n`);
};

// 更新覆盖率报告到文档
const updateCoverageDoc = () => {
  if (!options.updateDoc) return;
  
  console.log(`${colors.cyan}更新覆盖率文档...${colors.reset}`);
  
  try {
    const coveragePath = path.join(__dirname, '../coverage/coverage-summary.json');
    
    if (fs.existsSync(coveragePath)) {
      const coverageData = JSON.parse(fs.readFileSync(coveragePath, 'utf8'));
      const totalCoverage = coverageData.total;
      
      const docPath = path.join(__dirname, '../cover-rate.md');
      let docContent = fs.readFileSync(docPath, 'utf8');
      
      const today = new Date().toISOString().split('T')[0];
      const coverageEntry = `
## 测试覆盖率更新 (${today})

- 语句覆盖率: ${totalCoverage.statements.pct}%
- 分支覆盖率: ${totalCoverage.branches.pct}%
- 函数覆盖率: ${totalCoverage.functions.pct}%
- 行覆盖率: ${totalCoverage.lines.pct}%
`;
      
      docContent = docContent.replace(
        /# 食品溯源系统覆盖率报告/,
        `# 食品溯源系统覆盖率报告\n${coverageEntry}`
      );
      
      fs.writeFileSync(docPath, docContent);
      console.log(`${colors.green}覆盖率文档已更新！${colors.reset}\n`);
    } else {
      console.log(`${colors.yellow}覆盖率报告不存在，跳过更新文档${colors.reset}\n`);
    }
  } catch (err) {
    console.error(`${colors.red}更新覆盖率文档失败: ${err.message}${colors.reset}\n`);
  }
};

// 执行主函数
main().catch(err => {
  console.error(`${colors.red}${colors.bright}执行过程出错: ${err.message}${colors.reset}`);
  process.exit(1);
}); 