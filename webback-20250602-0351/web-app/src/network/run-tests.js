/**
 * 性能测试执行脚本
 * 用于运行资源加载器优化相关的性能测试
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

// 测试文件列表
const TEST_FILES = [
  'batch-size-optimization.test.js',
  'network-fast-switch.test.js',
  'memory-usage-analysis.test.js'
];

// 结果存储路径
const REPORT_PATH = path.join(__dirname, '../../reports/performance-test-report.json');

/**
 * 运行Jest测试
 * @param {string} testFile - 测试文件路径
 * @returns {Promise<object>} - 测试结果
 */
async function runTest(testFile) {
  return new Promise((resolve, reject) => {
    console.log(`[性能测试] 运行测试: ${testFile}`);
    
    // 确定平台特定命令
    const cmd = os.platform() === 'win32' ? 'npx.cmd' : 'npx';
    
    // 启动Jest进程
    const jest = spawn(cmd, [
      'jest',
      '--config', path.join(__dirname, 'jest.config.js'),
      '--no-cache',
      testFile
    ], { 
      cwd: __dirname,
      stdio: 'pipe'
    });
    
    let output = '';
    let errorOutput = '';
    
    // 收集输出
    jest.stdout.on('data', data => {
      const chunk = data.toString();
      output += chunk;
      process.stdout.write(chunk);
    });
    
    jest.stderr.on('data', data => {
      const chunk = data.toString();
      errorOutput += chunk;
      process.stderr.write(chunk);
    });
    
    // 处理测试完成
    jest.on('close', code => {
      console.log(`[性能测试] 测试完成: ${testFile} (退出码: ${code})`);
      
      if (code !== 0) {
        console.error(`[性能测试] 测试失败: ${testFile}`);
        resolve({
          name: testFile,
          success: false,
          duration: 0,
          performanceData: [],
          warnings: [],
          errors: errorOutput.split('\n')
        });
        return;
      }
      
      // 尝试解析性能数据
      const performanceData = parsePerformanceData(output);
      
      resolve({
        name: testFile,
        success: true,
        duration: calculateDuration(output),
        performanceData,
        warnings: []
      });
    });
    
    // 处理进程错误
    jest.on('error', err => {
      console.error(`[性能测试] 执行错误: ${err.message}`);
      reject(err);
    });
  });
}

/**
 * 解析输出中的性能数据
 * @param {string} output - 测试输出
 * @returns {Array<Object>} - 性能数据
 */
function parsePerformanceData(output) {
  const performanceData = [];
  
  try {
    // 尝试查找JSON格式的性能数据
    const jsonMatches = output.match(/PERFORMANCE_DATA:(.*?)END_PERFORMANCE_DATA/gs);
    
    if (jsonMatches) {
      jsonMatches.forEach(match => {
        const jsonStr = match.replace('PERFORMANCE_DATA:', '').replace('END_PERFORMANCE_DATA', '').trim();
        try {
          const data = JSON.parse(jsonStr);
          performanceData.push(data);
        } catch (e) {
          console.warn(`[性能测试] 无法解析性能数据JSON: ${e.message}`);
        }
      });
    }
  } catch (e) {
    console.warn(`[性能测试] 解析性能数据时出错: ${e.message}`);
  }
  
  return performanceData;
}

/**
 * 估算测试持续时间
 * @param {string} output - 测试输出
 * @returns {number} - 估算的持续时间(毫秒)
 */
function calculateDuration(output) {
  try {
    // 查找Jest报告的时间信息
    const timeMatch = output.match(/Time:\s+(\d+(\.\d+)?)\s*s/);
    if (timeMatch && timeMatch[1]) {
      return parseFloat(timeMatch[1]) * 1000;
    }
  } catch (e) {
    console.warn(`[性能测试] 解析持续时间时出错: ${e.message}`);
  }
  
  return 0;
}

/**
 * 运行所有测试
 */
async function runAllTests() {
  console.log('[性能测试] 开始执行所有性能测试...');
  
  const startTime = Date.now();
  const results = [];
  
  for (const testFile of TEST_FILES) {
    try {
      const result = await runTest(testFile);
      results.push(result);
    } catch (err) {
      console.error(`[性能测试] 运行测试 ${testFile} 时出错: ${err.message}`);
      results.push({
        name: testFile,
        success: false,
        duration: 0,
        performanceData: [],
        warnings: [],
        errors: [err.message]
      });
    }
  }
  
  const endTime = Date.now();
  const totalExecutionTime = endTime - startTime;
  
  // 创建报告
  const report = {
    timestamp: new Date().toISOString(),
    summary: {
      totalTests: results.length,
      passedTests: results.filter(r => r.success).length,
      failedTests: results.filter(r => !r.success).length,
      skippedTests: 0,
      averageExecutionTime: results.reduce((sum, r) => sum + r.duration, 0) / results.length
    },
    testResults: results,
    environment: {
      nodeVersion: process.version,
      platform: os.platform(),
      arch: os.arch(),
      cpuCores: os.cpus().length,
      totalMemory: `${Math.round(os.totalmem() / (1024 * 1024))}MB`
    },
    totalExecutionTime
  };
  
  // 保存报告
  try {
    const reportDir = path.dirname(REPORT_PATH);
    if (!fs.existsSync(reportDir)) {
      fs.mkdirSync(reportDir, { recursive: true });
    }
    
    fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));
    console.log(`[性能测试] 报告已保存到: ${REPORT_PATH}`);
  } catch (err) {
    console.error(`[性能测试] 保存报告时出错: ${err.message}`);
  }
  
  console.log('[性能测试] 所有测试完成');
  console.log(`[性能测试] 总耗时: ${totalExecutionTime}ms`);
  console.log(`[性能测试] 通过: ${report.summary.passedTests}/${report.summary.totalTests}`);
  
  // 返回测试结果
  return report;
}

// 如果直接运行此脚本，执行所有测试
if (require.main === module) {
  runAllTests()
    .then(results => {
      // 根据测试结果设置退出码
      process.exit(results.summary.failedTests > 0 ? 1 : 0);
    })
    .catch(err => {
      console.error(`[性能测试] 执行测试时发生错误: ${err.message}`);
      process.exit(1);
    });
} else {
  // 导出函数以便其他模块使用
  module.exports = {
    runAllTests,
    runTest
  };
} 