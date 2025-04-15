const path = require('path');
const fs = require('fs');
const testConfig = require('./config/test.config');

// 测试脚本列表
const testScripts = [
  // 基础测试
  { 
    name: '资源加载测试', 
    script: 'validation/scripts/check-resource.js',
    requiresServer: false,
    description: '检查页面资源加载情况，包括脚本、样式、图片等资源'
  },
  { 
    name: 'UI元素验证', 
    script: 'validation/scripts/check-ui.js',
    requiresServer: false,
    description: '验证页面中的UI元素，如导航、按钮、表单等'
  },
  { 
    name: 'HTML结构验证', 
    script: 'validation/scripts/check-html-structure.js',
    requiresServer: false,
    description: '检查HTML文档结构，确保标记格式正确'
  },
  { 
    name: '页面跳转测试', 
    script: 'validation/scripts/check-page-transitions.js',
    requiresServer: false,
    description: '验证页面间的导航跳转是否正常工作'
  },
  
  // 按钮测试
  { 
    name: '按钮基础测试', 
    script: 'validation/scripts/run-button-test-with-screenshots.js',
    requiresServer: false,
    description: '检查按钮的基本属性和外观'
  },
  { 
    name: '按钮改进验证', 
    script: 'validation/scripts/validate-button-improvements.js',
    requiresServer: false,
    description: '验证按钮的改进情况，包括可访问性和用户体验属性'
  }
];

// 需要服务器的测试脚本
const serverTests = [
  { 
    name: '功能验证测试', 
    script: 'validation/scripts/check-functionality.js',
    requiresServer: true,
    description: '验证页面功能，如表单提交、数据处理等'
  },
  { 
    name: '按钮交互测试', 
    script: 'validation/scripts/run-button-interaction-test.js',
    requiresServer: true,
    description: '测试按钮的交互功能，如点击响应和事件处理'
  }
];

// 根据命令行参数检查是否需要运行服务器测试
const runServerTests = !process.argv.includes('--skip-server-tests');

// 合并测试列表
const allTests = [...testScripts];
if (runServerTests) {
  allTests.push(...serverTests);
}

async function runTests() {
  console.log('开始执行测试...');
  
  if (!runServerTests) {
    console.log('⚠️ 警告: 跳过需要服务器的测试');
    console.log(`跳过的测试: ${serverTests.map(t => t.name).join(', ')}`);
  }
  
  const startTime = Date.now();
  
  const results = {
    timestamp: new Date().toISOString(),
    tests: [],
    summary: {
      total: allTests.length,
      passed: 0,
      failed: 0,
      skipped: 0,
      duration: 0
    }
  };
  
  for (const test of allTests) {
    console.log(`\n执行测试: ${test.name}`);
    console.log(`描述: ${test.description || '无描述'}`);
    
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

      const testResult = await testModule.run();
      
      results.tests.push({
        name: test.name,
        description: test.description,
        status: '通过',
        duration: Date.now() - testStartTime,
        script: test.script,
        details: testResult
      });
      
      results.summary.passed++;
      console.log(`✓ 测试通过: ${test.name}`);
    } catch (error) {
      results.tests.push({
        name: test.name,
        description: test.description,
        status: '失败',
        error: error.message,
        stack: error.stack,
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
  console.log(`跳过: ${results.summary.skipped}`);
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
    .test-case { margin-bottom: 10px; padding: 15px; border: 1px solid #ddd; border-radius: 8px; }
    .pass { border-left: 5px solid #4CAF50; }
    .fail { border-left: 5px solid #F44336; }
    .skip { border-left: 5px solid #FFC107; }
    .duration { color: #666; }
    .error { color: #721c24; background-color: #f8d7da; padding: 10px; border-radius: 5px; font-family: monospace; white-space: pre-wrap; }
    .header { background-color: #f8f9fa; padding: 20px; border-radius: 5px; margin-bottom: 20px; }
    h1, h2 { color: #333; }
    .stats { display: flex; margin-top: 15px; }
    .stat-box { flex: 1; padding: 15px; margin: 0 10px; border-radius: 5px; text-align: center; }
    .total { background-color: #e3f2fd; }
    .pass-box { background-color: #e8f5e9; }
    .fail-box { background-color: #ffebee; }
    .skip-box { background-color: #fff8e1; }
    .test-details { display: none; padding: 10px; background-color: #f5f5f5; border-radius: 5px; margin-top: 10px; }
    .show-details { cursor: pointer; color: #0066cc; margin-top: 10px; }
    .collapse-all, .expand-all { cursor: pointer; margin: 0 10px; color: #0066cc; }
  </style>
</head>
<body>
  <div class="header">
    <h1>测试报告</h1>
    <p>执行时间: ${new Date(results.timestamp).toLocaleString()}</p>
    
    <div class="stats">
      <div class="stat-box total">
        <h3>总测试数</h3>
        <div style="font-size: 2em;">${results.summary.total}</div>
      </div>
      <div class="stat-box pass-box">
        <h3>通过</h3>
        <div style="font-size: 2em;">${results.summary.passed}</div>
      </div>
      <div class="stat-box fail-box">
        <h3>失败</h3>
        <div style="font-size: 2em;">${results.summary.failed}</div>
      </div>
      <div class="stat-box skip-box">
        <h3>跳过</h3>
        <div style="font-size: 2em;">${results.summary.skipped}</div>
      </div>
    </div>
    <p>总耗时: ${(results.summary.duration / 1000).toFixed(2)}秒</p>
    <div>
      <span class="expand-all" onclick="expandAll()">展开所有</span>
      <span class="collapse-all" onclick="collapseAll()">收起所有</span>
    </div>
  </div>
  
  <h2>测试详情</h2>
  ${results.tests.map((test, index) => {
    let statusClass = 'pass';
    if (test.status === '失败') statusClass = 'fail';
    if (test.status === '跳过') statusClass = 'skip';
    
    return `
    <div class="test-case ${statusClass}">
      <h3>${test.name}</h3>
      ${test.description ? `<p>${test.description}</p>` : ''}
      <p><strong>状态:</strong> ${test.status}</p>
      <p><strong>脚本:</strong> ${test.script}</p>
      ${test.duration ? `<p class="duration"><strong>耗时:</strong> ${(test.duration / 1000).toFixed(2)}秒</p>` : ''}
      ${test.error ? `<div class="error"><strong>错误:</strong>\n${test.error}</div>` : ''}
      
      ${(test.details || test.stack) ? `
        <div class="show-details" onclick="toggleDetails(${index})">显示/隐藏详细信息</div>
        <div id="details-${index}" class="test-details">
          ${test.stack ? `<pre>${test.stack}</pre>` : ''}
          ${test.details ? `<pre>${JSON.stringify(test.details, null, 2)}</pre>` : ''}
        </div>
      ` : ''}
    </div>
  `}).join('')}

  <script>
    function toggleDetails(index) {
      const details = document.getElementById('details-' + index);
      details.style.display = details.style.display === 'block' ? 'none' : 'block';
    }
    
    function expandAll() {
      document.querySelectorAll('.test-details').forEach(el => {
        el.style.display = 'block';
      });
    }
    
    function collapseAll() {
      document.querySelectorAll('.test-details').forEach(el => {
        el.style.display = 'none';
      });
    }
  </script>
</body>
</html>`;
}

// 执行测试
runTests().catch(error => {
  console.error('测试执行出错:', error);
  process.exit(1);
}); 