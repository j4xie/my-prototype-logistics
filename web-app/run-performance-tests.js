/**
 * @file 性能测试执行脚本
 * @description 执行网络加载器性能测试并生成HTML和JSON报告
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// 确保报告目录存在
const REPORTS_DIR = path.join(__dirname, 'reports');
if (!fs.existsSync(REPORTS_DIR)) {
  fs.mkdirSync(REPORTS_DIR, { recursive: true });
}

// 测试文件列表
const TEST_FILES = [
  'src/network/batch-size-optimization.test.js',
  'src/network/network-fast-switch.test.js',
  'src/network/memory-usage-analysis.test.js'
];

// 测试结果数据
const testResults = [];

console.log('开始执行加载器性能测试...');

// 运行每个测试文件并收集结果
TEST_FILES.forEach(testFile => {
  const testName = path.basename(testFile, '.test.js');
  console.log(`\n执行测试: ${testName}...`);
  
  try {
    // 执行Jest测试并获取输出
    const startTime = Date.now();
    const output = execSync(`npx jest ${testFile} --json`, { 
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe']
    });
    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);
    
    // 解析Jest JSON输出
    const jestResult = JSON.parse(output);
    const testFile = jestResult.testResults[0];
    const passed = testFile.numPassingTests;
    const failed = testFile.numFailingTests;
    const total = passed + failed;
    const passRate = total > 0 ? Math.round((passed / total) * 100) : 0;
    
    // 收集测试数据
    testResults.push({
      name: testName,
      passRate: `${passRate}%`,
      duration: `${duration}秒`,
      passed,
      failed,
      total,
      assertions: testFile.assertionResults.length
    });
    
    console.log(`测试完成: 通过率 ${passRate}%, 耗时 ${duration}秒`);
  } catch (error) {
    console.error(`测试 ${testName} 失败: ${error.message}`);
    
    // 即使测试失败仍添加结果
    testResults.push({
      name: testName,
      passRate: '0%',
      duration: 'N/A',
      passed: 0,
      failed: 1,
      total: 1,
      assertions: 0,
      error: error.message
    });
  }
});

// 生成JSON报告
const jsonReport = {
  timestamp: new Date().toISOString(),
  summary: {
    totalTests: TEST_FILES.length,
    passedTests: testResults.filter(r => r.failed === 0).length,
    averagePassRate: testResults.reduce((sum, r) => sum + parseInt(r.passRate, 10), 0) / testResults.length
  },
  testResults
};

// 保存JSON报告
const jsonReportPath = path.join(REPORTS_DIR, 'loader-performance-report.json');
fs.writeFileSync(jsonReportPath, JSON.stringify(jsonReport, null, 2));
console.log(`\nJSON报告已保存到: ${jsonReportPath}`);

// 生成HTML报告
const htmlReport = `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>加载器性能测试报告</title>
  <style>
    body { font-family: 'Arial', sans-serif; margin: 0; padding: 20px; color: #333; }
    .container { max-width: 1000px; margin: 0 auto; }
    h1 { color: #2c3e50; border-bottom: 2px solid #ecf0f1; padding-bottom: 10px; }
    .summary { background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0; }
    table { width: 100%; border-collapse: collapse; margin: 20px 0; }
    th, td { padding: 12px 15px; text-align: left; border-bottom: 1px solid #ddd; }
    th { background-color: #4CAF50; color: white; }
    tr:hover { background-color: #f5f5f5; }
    .pass-rate { font-weight: bold; }
    .timestamp { color: #7f8c8d; font-size: 0.9em; margin-top: 30px; }
    .good { color: #27ae60; }
    .bad { color: #e74c3c; }
  </style>
</head>
<body>
  <div class="container">
    <h1>加载器性能测试报告</h1>
    
    <div class="summary">
      <h2>测试摘要</h2>
      <p>总测试数: <strong>${jsonReport.summary.totalTests}</strong></p>
      <p>通过测试数: <strong>${jsonReport.summary.passedTests}</strong></p>
      <p>平均通过率: <strong>${jsonReport.summary.averagePassRate.toFixed(2)}%</strong></p>
    </div>
    
    <h2>详细测试结果</h2>
    <table>
      <thead>
        <tr>
          <th>测试名称</th>
          <th>通过率</th>
          <th>执行时间</th>
          <th>通过/总数</th>
          <th>断言数</th>
        </tr>
      </thead>
      <tbody>
        ${testResults.map(result => `
          <tr>
            <td>${result.name}</td>
            <td class="pass-rate ${parseInt(result.passRate, 10) >= 80 ? 'good' : 'bad'}">${result.passRate}</td>
            <td>${result.duration}</td>
            <td>${result.passed}/${result.total}</td>
            <td>${result.assertions}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
    
    <p class="timestamp">生成时间: ${new Date().toLocaleString()}</p>
  </div>
</body>
</html>
`;

// 保存HTML报告
const htmlReportPath = path.join(REPORTS_DIR, 'loader-performance-report.html');
fs.writeFileSync(htmlReportPath, htmlReport);
console.log(`HTML报告已保存到: ${htmlReportPath}`);

// 更新测试进度文档
try {
  const progressFilePath = path.join(__dirname, 'docs', 'task-test-progress.md');
  let progressContent = '';
  
  // 读取现有内容
  if (fs.existsSync(progressFilePath)) {
    progressContent = fs.readFileSync(progressFilePath, 'utf8');
  } else {
    // 如果文件不存在，创建基本结构
    progressContent = `# 测试任务进度跟踪\n\n## 加载器性能测试\n\n| 测试文件 | 状态 | 通过率 | 平均耗时 | 断言数 |\n| --- | --- | --- | --- | --- |\n`;
  }
  
  // 更新进度文档
  TEST_FILES.forEach(testFile => {
    const fileName = path.basename(testFile);
    const result = testResults.find(r => r.name === path.basename(testFile, '.test.js'));
    
    // 检查文件是否已在文档中
    if (progressContent.includes(fileName)) {
      // 替换现有行
      const regex = new RegExp(`\\|\\s*${fileName.replace(/\./g, '\\.')}\\s*\\|[^\\|]*\\|[^\\|]*\\|[^\\|]*\\|[^\\|]*\\|`);
      progressContent = progressContent.replace(
        regex,
        `| ${fileName} | 已执行 | ${result.passRate} | ${result.duration} | ${result.assertions} |`
      );
    } else {
      // 添加新行
      progressContent += `| ${fileName} | 已执行 | ${result.passRate} | ${result.duration} | ${result.assertions} |\n`;
    }
  });
  
  // 保存更新后的文档
  fs.writeFileSync(progressFilePath, progressContent);
  console.log(`测试进度已更新到: ${progressFilePath}`);
} catch (error) {
  console.error(`更新测试进度文档失败: ${error.message}`);
}

// 打印总结信息
console.log('\n========== 测试执行总结 ==========');
console.log(`总测试数: ${jsonReport.summary.totalTests}`);
console.log(`通过测试数: ${jsonReport.summary.passedTests}`);
console.log(`平均通过率: ${jsonReport.summary.averagePassRate.toFixed(2)}%`);
console.log('=================================='); 