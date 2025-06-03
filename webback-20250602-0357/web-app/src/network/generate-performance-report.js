/**
 * @file 网络性能测试报告生成工具
 * @description 分析测试结果并生成性能报告
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

// 配置
const config = {
  // 测试文件
  testFiles: [
    'batch-size-optimization.test.js',
    'network-fast-switch.test.js',
    'memory-usage-analysis.test.js'
  ],
  // 输出目录
  outputDir: path.resolve(__dirname, '../../reports'),
  // 报告文件名
  reportFileName: 'loader-performance-report.json',
  // 测试超时（毫秒）
  testTimeout: 300000
};

// 确保输出目录存在
if (!fs.existsSync(config.outputDir)) {
  fs.mkdirSync(config.outputDir, { recursive: true });
}

// 报告对象结构
const report = {
  timestamp: new Date().toISOString(),
  summary: {
    totalTests: 0,
    passedTests: 0,
    failedTests: 0,
    skippedTests: 0,
    averageExecutionTime: 0
  },
  testResults: [],
  environment: {
    nodeVersion: process.version,
    platform: process.platform,
    arch: process.arch,
    cpuCores: require('os').cpus().length,
    totalMemory: Math.round(require('os').totalmem() / (1024 * 1024)) + 'MB'
  }
};

/**
 * 运行性能测试
 * @param {string} testFile - 测试文件名
 * @returns {Promise<Object>} 测试结果
 */
async function runPerformanceTest(testFile) {
  console.log(`\n执行测试: ${testFile}`);
  const startTime = Date.now();
  
  return new Promise((resolve) => {
    const args = [
      '--experimental-vm-modules',
      path.join(__dirname, testFile)
    ];
    
    const testProcess = spawn('node', args, {
      env: { ...process.env, NODE_ENV: 'test', PERFORMANCE_DATA: 'true' }
    });
    
    let output = '';
    let errorOutput = '';
    
    testProcess.stdout.on('data', (data) => {
      const chunk = data.toString();
      output += chunk;
      process.stdout.write(chunk);
    });
    
    testProcess.stderr.on('data', (data) => {
      const chunk = data.toString();
      errorOutput += chunk;
      process.stderr.write(chunk);
    });
    
    testProcess.on('close', (code) => {
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      console.log(`\n测试 ${testFile} 完成，耗时: ${(duration/1000).toFixed(2)}秒，退出代码: ${code}`);
      
      // 解析测试结果
      let performanceData = [];
      try {
        // 尝试从输出中提取性能数据（JSON格式）
        const jsonMatches = output.match(/PERFORMANCE_DATA_START([\s\S]*?)PERFORMANCE_DATA_END/g);
        if (jsonMatches && jsonMatches.length > 0) {
          performanceData = jsonMatches.map(match => {
            const jsonStr = match.replace('PERFORMANCE_DATA_START', '').replace('PERFORMANCE_DATA_END', '').trim();
            return JSON.parse(jsonStr);
          });
        }
      } catch (e) {
        console.error('解析性能数据失败:', e.message);
      }
      
      // 测试结果
      const result = {
        name: testFile,
        success: code === 0,
        duration,
        performanceData,
        warnings: [],
        errors: errorOutput ? errorOutput.split('\n').filter(Boolean) : []
      };
      
      // 是否有性能警告（例如比基准慢20%以上）
      if (performanceData.length > 0) {
        performanceData.forEach(data => {
          if (data.baseline && data.current && data.current.average > data.baseline.average * 1.2) {
            result.warnings.push(`性能下降: ${data.name} 比基准慢 ${((data.current.average - data.baseline.average) / data.baseline.average * 100).toFixed(1)}%`);
          }
        });
      }
      
      resolve(result);
    });
    
    // 如果超时，则强制结束
    setTimeout(() => {
      if (testProcess.exitCode === null) {
        testProcess.kill();
        const result = {
          name: testFile,
          success: false,
          duration: config.testTimeout,
          performanceData: [],
          warnings: ['测试超时'],
          errors: ['测试执行超时，已强制终止']
        };
        resolve(result);
      }
    }, config.testTimeout);
  });
}

/**
 * 运行所有测试并生成报告
 */
async function generateReport() {
  console.log('====================================');
  console.log('网络性能测试报告生成工具');
  console.log('====================================');
  console.log(`运行时间: ${report.timestamp}`);
  console.log('测试环境:');
  Object.entries(report.environment).forEach(([key, value]) => {
    console.log(`- ${key}: ${value}`);
  });
  console.log('====================================');
  
  const startTime = Date.now();
  
  // 运行所有测试
  for (const testFile of config.testFiles) {
    const result = await runPerformanceTest(testFile);
    report.testResults.push(result);
    
    // 更新摘要信息
    report.summary.totalTests++;
    if (result.success) {
      report.summary.passedTests++;
    } else {
      report.summary.failedTests++;
    }
  }
  
  // 计算平均执行时间
  const totalExecutionTime = report.testResults.reduce((sum, test) => sum + test.duration, 0);
  report.summary.averageExecutionTime = totalExecutionTime / report.testResults.length;
  
  // 添加总执行时间
  const endTime = Date.now();
  report.totalExecutionTime = endTime - startTime;
  
  // 生成报告
  const reportPath = path.join(config.outputDir, config.reportFileName);
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8');
  
  console.log('\n====================================');
  console.log('性能测试报告已生成');
  console.log(`报告文件: ${reportPath}`);
  console.log(`总测试数: ${report.summary.totalTests}`);
  console.log(`通过: ${report.summary.passedTests}`);
  console.log(`失败: ${report.summary.failedTests}`);
  console.log(`平均执行时间: ${(report.summary.averageExecutionTime / 1000).toFixed(2)}秒`);
  console.log(`总运行时间: ${(report.totalExecutionTime / 1000).toFixed(2)}秒`);
  
  // 输出警告
  const allWarnings = report.testResults.flatMap(r => r.warnings);
  if (allWarnings.length > 0) {
    console.log('\n⚠️ 性能警告:');
    allWarnings.forEach(warning => console.log(`- ${warning}`));
  }
  
  console.log('====================================');
  
  // 如果有测试失败，返回非零状态码
  if (report.summary.failedTests > 0) {
    process.exit(1);
  }
}

// 执行报告生成
generateReport().catch(err => {
  console.error('生成报告时发生错误:', err);
  process.exit(1);
}); 