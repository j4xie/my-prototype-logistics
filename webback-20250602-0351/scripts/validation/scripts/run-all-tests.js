/**
 * 运行所有验证测试的脚本
 * 
 * 此脚本会运行validation/scripts目录下的所有验证脚本，
 * 并生成汇总报告�?
 */

const fs = require('fs');
const path = require('path');
const util = require('util');

// 使用Promise版本的文件系统操�?
const readdir = util.promisify(fs.readdir);
const writeFile = util.promisify(fs.writeFile);
const mkdir = util.promisify(fs.mkdir);

// 定义配置
const config = {
  scriptsDir: path.join(__dirname),
  reportsDir: path.join(__dirname, '../reports'),
  summaryReportPath: path.join(__dirname, '../reports/summary_report.html'),
  pattern: /^check-.*\.js$/
};

// 确保报告目录存在
async function ensureDirectoryExists(dir) {
  try {
    await mkdir(dir, { recursive: true });
  } catch (err) {
    if (err.code !== 'EEXIST') {
      throw err;
    }
  }
}

// 运行所有测�?
async function runAllTests() {
  console.log('开始运行所有验证测�?..');
  
  try {
    // 确保报告目录存在
    await ensureDirectoryExists(config.reportsDir);
    
    // 获取所有验证脚�?
    const files = await readdir(config.scriptsDir);
    const testScripts = files.filter(file => config.pattern.test(file));
    
    console.log(`找到 ${testScripts.length} 个验证脚本`);
    
    // 记录开始时�?
    const startTime = Date.now();
    
    // 保存每个测试的结�?
    const results = [];
    let passCount = 0;
    let failCount = 0;
    
    // 逐个运行测试
    for (const scriptFile of testScripts) {
      const scriptPath = path.join(config.scriptsDir, scriptFile);
      console.log(`运行: ${scriptFile}`);
      
      try {
        // 导入测试模块
        const testModule = require(scriptPath);
        
        if (typeof testModule.run !== 'function') {
          throw new Error(`${scriptFile} 不包�?run() 函数`);
        }
        
        // 运行测试
        const scriptStartTime = Date.now();
        const testResult = await testModule.run();
        const scriptDuration = (Date.now() - scriptStartTime) / 1000;
        
        // 处理测试结果
        const status = testResult.status === 'success' ? 'pass' : 'fail';
        
        // 更新计数
        if (status === 'pass') {
          passCount++;
        } else {
          failCount++;
        }
        
        // 保存结果
        results.push({
          name: scriptFile.replace(/\.js$/, ''),
          status,
          duration: scriptDuration.toFixed(2),
          details: testResult
        });
        
        console.log(`完成: ${scriptFile} - ${status} (${scriptDuration.toFixed(2)}s)`);
        
      } catch (error) {
        // 测试执行出错
        failCount++;
        results.push({
          name: scriptFile.replace(/\.js$/, ''),
          status: 'fail',
          duration: '0.00',
          error: error.message,
          stack: error.stack
        });
        
        console.error(`错误: ${scriptFile} - ${error.message}`);
      }
    }
    
    // 计算总耗时
    const totalDuration = (Date.now() - startTime) / 1000;
    
    // 创建汇总报�?
    const summaryReport = {
      timestamp: new Date().toISOString(),
      totalTests: testScripts.length,
      passCount,
      failCount,
      duration: totalDuration.toFixed(2),
      results
    };
    
    // 生成汇总报�?
    await generateSummaryReport(summaryReport);
    
    console.log(`测试完成! 总耗时: ${totalDuration.toFixed(2)}s`);
    console.log(`通过: ${passCount}, 失败: ${failCount}`);
    console.log(`汇总报告已保存�? ${config.summaryReportPath}`);
    
    return summaryReport;
    
  } catch (error) {
    console.error('运行测试时出�?', error);
    throw error;
  }
}

// 生成HTML格式的汇总报�?
async function generateSummaryReport(summary) {
  // 创建HTML报告
  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>验证测试汇总报�?/title>
  <style>
    body {
      font-family: Arial, sans-serif;
      line-height: 1.6;
      max-width: 1200px;
      margin: 0 auto;
      padding: 20px;
      color: #333;
    }
    h1, h2 {
      color: #2c3e50;
    }
    .summary {
      background-color: #f8f9fa;
      border-radius: 5px;
      padding: 15px;
      margin-bottom: 20px;
      display: flex;
      flex-wrap: wrap;
      justify-content: space-between;
    }
    .summary-item {
      flex: 1;
      min-width: 200px;
      margin: 5px;
    }
    .status {
      display: inline-block;
      padding: 3px 8px;
      border-radius: 3px;
      font-weight: bold;
    }
    .pass {
      background-color: #d4edda;
      color: #155724;
    }
    .fail {
      background-color: #f8d7da;
      color: #721c24;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 20px;
    }
    th, td {
      padding: 12px 15px;
      text-align: left;
      border-bottom: 1px solid #ddd;
    }
    th {
      background-color: #f2f2f2;
      font-weight: bold;
    }
    tr:hover {
      background-color: #f5f5f5;
    }
    .timestamp {
      color: #6c757d;
      font-style: italic;
    }
  </style>
</head>
<body>
  <h1>验证测试汇总报�?/h1>
  
  <div class="timestamp">
    生成时间: ${new Date(summary.timestamp).toLocaleString()}
  </div>
  
  <div class="summary">
    <div class="summary-item">
      <h3>测试状�?/h3>
      <p>总测�? <strong>${summary.totalTests}</strong></p>
      <p>通过: <strong class="status pass">${summary.passCount}</strong></p>
      <p>失败: <strong class="status ${summary.failCount > 0 ? 'fail' : 'pass'}">${summary.failCount}</strong></p>
    </div>
    
    <div class="summary-item">
      <h3>执行信息</h3>
      <p>总耗时: <strong>${summary.duration} �?/strong></p>
      <p>通过�? <strong>${Math.round(summary.passCount / summary.totalTests * 100)}%</strong></p>
    </div>
  </div>
  
  <h2>测试详情</h2>
  
  <table>
    <thead>
      <tr>
        <th>#</th>
        <th>测试名称</th>
        <th>状�?/th>
        <th>耗时</th>
        <th>详情</th>
      </tr>
    </thead>
    <tbody>
      ${summary.results.map((result, index) => `
        <tr>
          <td>${index + 1}</td>
          <td>${result.name}</td>
          <td><span class="status ${result.status}">${result.status === 'pass' ? '通过' : '失败'}</span></td>
          <td>${result.duration} �?/td>
          <td>${result.error ? `错误: ${result.error}` : ''}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>
</body>
</html>`;

  // 保存HTML报告
  await writeFile(config.summaryReportPath, html);
}

// 如果直接运行此脚�?
if (require.main === module) {
  runAllTests().catch(err => {
    console.error('运行测试失败:', err);
    process.exit(1);
  });
}

// 导出主函�?
module.exports = { runAllTests };
