/**
 * @file tests/run-all-tests.js
 * @description 运行所有测试的脚本
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// 测试类型定义
const testTypes = [
  {
    name: '单元测试',
    command: 'npm',
    args: ['run', 'test:unit'],
    color: '\x1b[36m' // 青色
  },
  {
    name: '集成测试',
    command: 'npm',
    args: ['run', 'test:integration'],
    color: '\x1b[35m' // 紫色
  },
  {
    name: '端到端测试',
    command: 'npm',
    args: ['run', 'test:e2e'],
    color: '\x1b[33m' // 黄色
  }
];

// 创建测试报告目录
const reportsDir = path.join(__dirname, '../reports');
if (!fs.existsSync(reportsDir)) {
  fs.mkdirSync(reportsDir, { recursive: true });
}

// 控制台颜色
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
};

/**
 * 运行命令并返回Promise
 * @param {string} command - 要运行的命令
 * @param {string[]} args - 命令参数
 * @param {string} testName - 测试名称
 * @param {string} color - 日志颜色代码
 * @returns {Promise<{success: boolean, testName: string}>} 运行结果
 */
function runCommand(command, args, testName, color) {
  return new Promise((resolve) => {
    console.log(`${color}${colors.bright}开始运行: ${testName}${colors.reset}`);
    const startTime = Date.now();
    
    // 启动进程
    const childProcess = spawn(command, args, {
      stdio: 'inherit',
      shell: true
    });
    
    // 处理进程退出
    childProcess.on('close', (code) => {
      const endTime = Date.now();
      const duration = ((endTime - startTime) / 1000).toFixed(2);
      
      const success = code === 0;
      const statusColor = success ? colors.green : colors.red;
      const statusText = success ? '成功' : '失败';
      
      console.log(`${color}${testName} 运行${statusColor}${statusText}${color}，耗时: ${duration}秒${colors.reset}`);
      console.log(`${color}-----------------------------------${colors.reset}`);
      
      resolve({
        success,
        testName
      });
    });
  });
}

/**
 * 运行所有测试
 */
async function runAllTests() {
  console.log(`${colors.bright}开始运行所有测试...${colors.reset}`);
  console.log('-----------------------------------');
  
  const startTime = Date.now();
  const results = [];
  
  // 依次运行每种测试
  for (const test of testTypes) {
    const result = await runCommand(test.command, test.args, test.name, test.color);
    results.push(result);
    
    // 如果单元测试失败，不继续运行集成和端到端测试
    if (!result.success && test.name === '单元测试') {
      console.log(`${colors.red}${colors.bright}单元测试失败，跳过剩余测试${colors.reset}`);
      break;
    }
  }
  
  // 汇总结果
  const endTime = Date.now();
  const totalDuration = ((endTime - startTime) / 1000).toFixed(2);
  const successCount = results.filter(r => r.success).length;
  const failCount = results.length - successCount;
  
  console.log(`${colors.bright}测试运行完成${colors.reset}`);
  console.log(`总耗时: ${totalDuration}秒`);
  console.log(`${colors.green}成功: ${successCount}${colors.reset}`);
  console.log(`${colors.red}失败: ${failCount}${colors.reset}`);
  
  // 记录结果到文件
  const resultSummary = {
    timestamp: new Date().toISOString(),
    duration: totalDuration,
    success: failCount === 0,
    tests: results.map(r => ({
      name: r.testName,
      success: r.success
    }))
  };
  
  fs.writeFileSync(
    path.join(reportsDir, 'test-summary.json'),
    JSON.stringify(resultSummary, null, 2)
  );
  
  // 设置退出码
  process.exitCode = failCount > 0 ? 1 : 0;
}

// 运行测试
runAllTests().catch(err => {
  console.error(`${colors.red}运行测试时出错: ${err.message}${colors.reset}`);
  process.exitCode = 1;
}); 