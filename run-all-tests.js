const path = require('path');
const fs = require('fs');
const testConfig = require('./config/test.config');

// 测试脚本列表
const testScripts = [
  // 基础测试
  { name: '资源加载测试', script: 'validation/scripts/check-resource.js' },
  { name: 'UI元素验证', script: 'validation/scripts/check-ui.js' },
  { name: 'HTML结构验证', script: 'validation/scripts/check-html-structure.js' },
  { name: '页面跳转测试', script: 'validation/scripts/check-page-transitions.js' },
  { name: '功能验证测试', script: 'validation/scripts/check-functionality.js' },
  
  // 按钮测试
  { name: '按钮基础测试', script: 'validation/scripts/run-button-test-with-screenshots.js' },
  { name: '按钮交互测试', script: 'validation/scripts/run-button-interaction-test.js' },
  { name: '按钮改进验证', script: 'validation/scripts/validate-button-improvements.js' }
];

async function runTests() {
  console.log('开始执行测试...');
  const startTime = Date.now();
  
  const results = {
    timestamp: new Date().toISOString(),
    tests: [],
    summary: {
      total: testScripts.length,
      passed: 0,
      failed: 0,
      duration: 0
    }
  };
  
  for (const test of testScripts) {
    console.log(`\n执行测试: ${test.name}`);
    const testStartTime = Date.now();
    
    try {
      const scriptPath = path.join(__dirname, test.script);
      if (!fs.existsSync(scriptPath)) {
        throw new Error(`测试脚本不存在: ${test.script}`);
      }

      const testModule = require(scriptPath);
      if (typeof testModule.run !== 'function') {
        throw new Error(`测试脚本必须导出 run 函数: ${test.script}`);
      }

      await testModule.run();
      
      results.tests.push({
        name: test.name,
        status: '通过',
        duration: Date.now() - testStartTime,
        script: test.script
      });
      
      results.summary.passed++;
      console.log(`✓ 测试通过: ${test.name}`);
    } catch (error) {
      results.tests.push({
        name: test.name,
        status: '失败',
        error: error.message,
        duration: Date.now() - testStartTime,
        script: test.script
      });
      
      results.summary.failed++;
      console.error(`✗ 测试失败: ${test.name}`, error);
    }
  }
  
  results.summary.duration = Date.now() - startTime;
  
  // 保存测试结果
  const reportPath = path.join(testConfig.paths.reports, 'test_summary_report.json');
  fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));
  
  // 生成HTML报告
  const htmlReport = generateHtmlReport(results);
  const htmlReportPath = path.join(testConfig.paths.reports, 'test_report.html');
  fs.writeFileSync(htmlReportPath, htmlReport);
  
  console.log('\n测试执行完成');
  console.log(`总测试数: ${results.summary.total}`);
  console.log(`通过: ${results.summary.passed}`);
  console.log(`失败: ${results.summary.failed}`);
  console.log(`总耗时: ${(results.summary.duration / 1000).toFixed(2)}秒`);
  
  if (results.summary.failed > 0) {
    process.exit(1);
  }
}

function generateHtmlReport(results) {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>测试报告</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 20px; }
    .summary { margin-bottom: 20px; }
    .test-case { margin-bottom: 10px; padding: 10px; border: 1px solid #ddd; }
    .pass { background-color: #dff0d8; }
    .fail { background-color: #f2dede; }
    .duration { color: #666; }
  </style>
</head>
<body>
  <h1>测试报告</h1>
  <div class="summary">
    <h2>测试摘要</h2>
    <p>执行时间: ${new Date(results.timestamp).toLocaleString()}</p>
    <p>总测试数: ${results.summary.total}</p>
    <p>通过: ${results.summary.passed}</p>
    <p>失败: ${results.summary.failed}</p>
    <p>总耗时: ${(results.summary.duration / 1000).toFixed(2)}秒</p>
  </div>
  
  <h2>测试详情</h2>
  ${results.tests.map(test => `
    <div class="test-case ${test.status === '通过' ? 'pass' : 'fail'}">
      <h3>${test.name}</h3>
      <p>状态: ${test.status}</p>
      <p>脚本: ${test.script}</p>
      <p class="duration">耗时: ${(test.duration / 1000).toFixed(2)}秒</p>
      ${test.error ? `<p>错误: ${test.error}</p>` : ''}
    </div>
  `).join('')}
</body>
</html>`;
}

// 执行测试
runTests().catch(error => {
  console.error('测试执行出错:', error);
  process.exit(1);
}); 