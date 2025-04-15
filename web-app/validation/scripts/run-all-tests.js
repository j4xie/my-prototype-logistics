const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// 创建验证目录
const validationDir = path.join(__dirname, '..');
if (!fs.existsSync(validationDir)) {
  fs.mkdirSync(validationDir, { recursive: true });
}

const reportsDir = path.join(validationDir, 'reports');
if (!fs.existsSync(reportsDir)) {
  fs.mkdirSync(reportsDir, { recursive: true });
}

// 测试报告
const testResults = {
  unit_tests: null,
  ui_validation: null,
  functionality: null,
  html_structure: null,
  button_tests: null
};

// 记录详细测试结果信息
const testResultDetails = {
  unit_tests: { passed: 0, failed: 0, message: '' },
  ui_validation: { passed: 0, failed: 0, message: '' },
  functionality: { passed: 0, failed: 0, message: '' },
  html_structure: { passed: 0, failed: 0, message: '' },
  button_tests: { passed: 0, failed: 0, message: '' }
};

// 颜色代码
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

// 获取当前时间
const startTime = new Date();
console.log(`${colors.bright}${colors.blue}开始执行所有测试: ${startTime.toLocaleString()}${colors.reset}\n`);

// 测试脚本列表
const testScripts = [
  // 基础测试
  { name: '资源加载测试', script: 'check-resource.js', id: 'resource_validation' },
  { name: 'UI元素验证', script: 'check-ui.js', id: 'ui_validation' },
  { name: 'HTML结构验证', script: 'check-html-structure.js', id: 'html_structure' },
  { name: '页面跳转测试', script: 'check-page-transitions.js', id: 'navigation_validation' },
  { name: '功能验证测试', script: 'check-functionality.js', id: 'functionality' },
  
  // 按钮测试
  { name: '按钮基础测试', script: 'run-button-test-with-screenshots.js', id: 'button_basic' },
  { name: '按钮交互测试', script: 'run-button-interaction-test.js', id: 'button_interaction' },
  { name: '按钮改进验证', script: 'validate-button-improvements.js', id: 'button_improvements', description: '验证所有21个页面的按钮实现，包括主页、追溯和管理员界面' }
];

// 执行单个测试脚本
async function runTestScript(script) {
  const scriptId = script.id;
  console.log(`${colors.bright}${colors.blue}开始执行 ${script.name} (${script.script})${colors.reset}`);
  const startScriptTime = new Date();
  
  try {
    // 导入测试模块
    const testModule = require(path.join(__dirname, script.script));
    if (typeof testModule.run === 'function') {
      // 执行测试
      const result = await testModule.run();
      
      // 记录测试结果
      testResults[scriptId] = true;
      testResultDetails[scriptId] = { 
        message: `${script.name}通过`,
        result: result
      };
      
      console.log(`${colors.green}✓ ${script.name}通过${colors.reset}`);
    } else {
      throw new Error(`测试脚本 ${script.script} 没有导出 run 函数`);
    }
  } catch (error) {
    testResults[scriptId] = false;
    testResultDetails[scriptId] = { 
      message: `${script.name}失败: ${error.message}`,
      error: error.stack || error.message
    };
    console.error(`${colors.red}✗ ${script.name}失败${colors.reset}`);
    console.error(`${colors.yellow}错误详情: ${error.message}${colors.reset}`);
  }
  
  const endScriptTime = new Date();
  const scriptDuration = (endScriptTime - startScriptTime) / 1000;
  console.log(`${script.name} ${testResults[scriptId] ? `${colors.green}通过` : `${colors.red}失败`}${colors.reset}, 耗时: ${scriptDuration.toFixed(2)}秒\n`);
  
  return { 
    id: scriptId, 
    success: testResults[scriptId], 
    duration: scriptDuration.toFixed(2) 
  };
}

// 执行所有测试脚本
async function runAllTests() {
  // 执行单元测试
  console.log(`${colors.bright}${colors.magenta}开始执行单元测试...${colors.reset}`);
  try {
    // 检查单元测试脚本是否存在
    const unitTestScriptPath = path.join(process.cwd(), 'tests', 'run-unit-tests.js');
    if (fs.existsSync(unitTestScriptPath)) {
      execSync('node ' + unitTestScriptPath, { stdio: 'inherit' });
      testResults.unit_tests = true;
      testResultDetails.unit_tests.message = '所有单元测试通过';
      console.log(`${colors.green}✓ 所有单元测试通过！${colors.reset}`);
    } else {
      // 如果脚本不存在，直接运行Jest
      execSync('npx jest tests/unit', { stdio: 'inherit' });
      testResults.unit_tests = true;
      testResultDetails.unit_tests.message = '所有单元测试通过';
      console.log(`${colors.green}✓ 所有单元测试通过！${colors.reset}`);
    }
  } catch (error) {
    testResults.unit_tests = false;
    testResultDetails.unit_tests.message = `测试失败: ${error.message}`;
    console.error(`${colors.red}✗ 单元测试失败${colors.reset}`);
    console.error(`${colors.yellow}错误详情: ${error.message}${colors.reset}`);
  }

  const unitTestEndTime = new Date();
  const unitTestDuration = (unitTestEndTime - startTime) / 1000;
  console.log(`单元测试${testResults.unit_tests ? `${colors.green}通过` : `${colors.red}失败`}${colors.reset}, 耗时: ${unitTestDuration.toFixed(2)}秒\n`);
  
  // 存储测试持续时间
  const durations = {
    unit_tests: unitTestDuration.toFixed(2)
  };
  
  // 依次执行每个测试脚本
  for (const testScript of testScripts) {
    const result = await runTestScript(testScript);
    durations[result.id] = result.duration;
  }
  
  // 生成摘要报告
  console.log(`${colors.bright}${colors.green}所有测试完成!${colors.reset}`);
  const totalTests = Object.keys(testResults).length;
  const passedTests = Object.values(testResults).filter(result => result === true).length;
  const failedTests = totalTests - passedTests;

  console.log(`总计: ${totalTests} 测试`);
  console.log(`通过: ${colors.green}${passedTests} 测试${colors.reset}`);
  console.log(`失败: ${failedTests > 0 ? colors.red : colors.green}${failedTests} 测试${colors.reset}`);

  const endTime = new Date();
  const totalDuration = (endTime - startTime) / 1000;
  console.log(`总耗时: ${totalDuration.toFixed(2)}秒\n`);

  // 保存摘要报告
  const summaryReport = {
    timestamp: new Date().toISOString(),
    results: testResults,
    details: testResultDetails,
    duration: {
      total: totalDuration.toFixed(2),
      ...durations
    },
    overall_status: failedTests === 0 ? "通过" : "失败"
  };

  fs.writeFileSync(
    path.join(reportsDir, 'summary_report.json'),
    JSON.stringify(summaryReport, null, 2)
  );

  // 生成HTML摘要报告
  const htmlReport = `
  <!DOCTYPE html>
  <html lang="zh-CN">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>测试摘要报告</title>
    <style>
      body {
        font-family: Arial, sans-serif;
        line-height: 1.6;
        margin: 0;
        padding: 20px;
        color: #333;
      }
      .container {
        max-width: 800px;
        margin: 0 auto;
      }
      h1 {
        color: #2c3e50;
        border-bottom: 2px solid #3498db;
        padding-bottom: 10px;
      }
      .summary {
        background-color: #f8f9fa;
        border-left: 4px solid #3498db;
        padding: 15px;
        margin: 20px 0;
      }
      .status {
        font-weight: bold;
        padding: 5px 10px;
        border-radius: 4px;
        display: inline-block;
      }
      .pass {
        background-color: #d4edda;
        color: #155724;
      }
      .fail {
        background-color: #f8d7da;
        color: #721c24;
      }
      .warn {
        background-color: #fff3cd;
        color: #856404;
      }
      .test-item {
        margin: 10px 0;
        padding: 10px;
        border: 1px solid #ddd;
        border-radius: 4px;
      }
      .timestamp {
        color: #6c757d;
        font-size: 0.9em;
      }
      .duration {
        font-size: 0.9em;
        color: #6c757d;
        margin-left: 10px;
      }
      .report-links {
        margin-top: 20px;
      }
      .report-link {
        display: block;
        margin: 5px 0;
        padding: 10px;
        background-color: #e9ecef;
        border-radius: 4px;
        text-decoration: none;
        color: #495057;
      }
      .report-link:hover {
        background-color: #dee2e6;
      }
      .details {
        margin-top: 5px;
        font-size: 0.9em;
        color: #495057;
      }
    </style>
  </head>
  <body>
    <div class="container">
      <h1>测试摘要报告</h1>
      
      <div class="summary">
        <p>测试时间: <span class="timestamp">${new Date().toLocaleString()}</span></p>
        <p>整体状态: <span class="status ${summaryReport.overall_status === '通过' ? 'pass' : 'fail'}">${summaryReport.overall_status}</span></p>
        <p>总耗时: ${totalDuration.toFixed(2)}秒</p>
        <p>通过测试: ${passedTests}/${totalTests}</p>
      </div>
      
      <h2>测试结果</h2>
      
      <div class="test-item">
        <h3>单元测试 <span class="duration">${unitTestDuration.toFixed(2)}秒</span></h3>
        <p>状态: <span class="status ${testResults.unit_tests ? 'pass' : 'fail'}">${testResults.unit_tests ? '通过' : '失败'}</span></p>
        <p class="details">${testResultDetails.unit_tests.message}</p>
      </div>
      
      <div class="test-item">
        <h3>UI验证 <span class="duration">${durations.ui_validation}秒</span></h3>
        <p>状态: <span class="status ${testResults.ui_validation ? 'pass' : 'fail'}">${testResults.ui_validation ? '通过' : '失败'}</span></p>
        <p class="details">${testResultDetails.ui_validation.message}</p>
      </div>
      
      <div class="test-item">
        <h3>功能测试 <span class="duration">${durations.functionality}秒</span></h3>
        <p>状态: <span class="status ${testResults.functionality ? 'pass' : 'fail'}">${testResults.functionality ? '通过' : '失败'}</span></p>
        <p class="details">${testResultDetails.functionality.message}</p>
      </div>
      
      <div class="test-item">
        <h3>按钮功能测试 <span class="duration">${durations.button_improvements}秒</span></h3>
        <p>状态: <span class="status ${testResultDetails.button_improvements.failed > 0 ? 'warn' : 'pass'}">${testResultDetails.button_improvements.failed > 0 ? '部分通过' : '全部通过'}</span></p>
        <p class="details">${testResultDetails.button_improvements.message || '按钮测试完成'}</p>
      </div>
      
      <div class="report-links">
        <h2>详细报告</h2>
        <a href="functionality_test_report.json" class="report-link">功能测试详细报告</a>
        <a href="ui_validation_report.json" class="report-link">UI验证详细报告</a>
        <a href="button-tests/button_test_report.html" class="report-link">按钮功能测试详细报告</a>
      </div>
    </div>
  </body>
  </html>
  `;

  fs.writeFileSync(
    path.join(reportsDir, 'summary_report.html'),
    htmlReport
  );

  console.log(`详细报告保存在: ${path.join(reportsDir, 'summary_report.html')}`);
}

// 执行所有测试
runAllTests();

// 根据整体测试结果设置退出码