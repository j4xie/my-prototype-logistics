/**
 * @file 性能测试主运行脚本
 * @description 集成所有性能测试，生成统一报告
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

// 配置
const config = {
  reportDir: path.resolve(__dirname, 'reports'),
  taskProgressFile: path.resolve(__dirname, 'performance-test-progress.md'),
  scriptTimeout: 5 * 60 * 1000, // 5分钟超时
  htmlReport: true
};

// 确保报告目录存在
if (!fs.existsSync(config.reportDir)) {
  fs.mkdirSync(config.reportDir, { recursive: true });
}

// 要运行的测试脚本列表
const testScripts = [
  {
    name: '批量大小优化测试',
    path: 'src/network/run-batch-size-test.js',
    description: '测试不同批量大小对资源加载性能的影响'
  },
  {
    name: '网络切换稳定性测试',
    path: 'src/network/run-network-switch-test.js',
    description: '测试网络状态变化时的资源加载稳定性'
  },
  {
    name: '内存使用分析测试',
    path: 'src/network/run-memory-usage-test.js',
    description: '分析不同场景下的内存占用情况'
  },
  {
    name: '移动设备性能测试',
    path: 'src/network/run-device-performance-test.js',
    description: '测试不同移动设备配置下的资源加载性能'
  }
];

// 运行单个测试脚本
function runTestScript(script) {
  return new Promise((resolve, reject) => {
    console.log(`\n开始运行 ${script.name}...`);
    
    const startTime = Date.now();
    let performanceData = null;
    let dataCollectionStarted = false;
    let collectedData = '';
    
    const childProcess = spawn('node', [script.path], {
      cwd: __dirname,
      stdio: ['ignore', 'pipe', 'pipe']
    });
    
    // 设置超时
    const timeout = setTimeout(() => {
      console.error(`${script.name} 运行超时，强制终止`);
      childProcess.kill();
      reject(new Error('脚本运行超时'));
    }, config.scriptTimeout);
    
    // 处理标准输出
    childProcess.stdout.on('data', (data) => {
      const output = data.toString();
      console.log(output);
      
      // 捕获性能数据
      if (output.includes('PERFORMANCE_DATA_START')) {
        dataCollectionStarted = true;
        return;
      }
      
      if (dataCollectionStarted && !output.includes('PERFORMANCE_DATA_END')) {
        collectedData += output;
      }
      
      if (output.includes('PERFORMANCE_DATA_END')) {
        dataCollectionStarted = false;
        try {
          performanceData = JSON.parse(collectedData.trim());
          collectedData = '';
        } catch (error) {
          console.error('解析性能数据失败:', error);
        }
      }
    });
    
    // 处理标准错误
    childProcess.stderr.on('data', (data) => {
      console.error(`${script.name} 错误: ${data.toString()}`);
    });
    
    // 处理进程结束
    childProcess.on('close', (code) => {
      clearTimeout(timeout);
      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      
      if (code === 0) {
        console.log(`${script.name} 成功完成 (耗时: ${duration}秒)`);
        resolve({
          success: true,
          name: script.name,
          duration,
          performanceData
        });
      } else {
        console.error(`${script.name} 运行失败，退出码: ${code} (耗时: ${duration}秒)`);
        resolve({
          success: false,
          name: script.name,
          duration,
          error: `退出码 ${code}`,
          performanceData
        });
      }
    });
    
    childProcess.on('error', (error) => {
      clearTimeout(timeout);
      console.error(`启动 ${script.name} 失败:`, error);
      reject(error);
    });
  });
}

// 更新任务进度文档
function updateTaskProgress(results) {
  const date = new Date().toISOString().split('T')[0];
  const time = new Date().toTimeString().split(' ')[0];
  
  let content = '';
  
  // 读取现有内容（如果存在）
  if (fs.existsSync(config.taskProgressFile)) {
    content = fs.readFileSync(config.taskProgressFile, 'utf8');
  }
  
  // 添加新的测试结果
  content += `\n## 性能测试运行 - ${date} ${time}\n\n`;
  
  // 计算总结
  const totalTests = results.length;
  const successTests = results.filter(r => r.success).length;
  const failedTests = totalTests - successTests;
  const totalDuration = results.reduce((sum, r) => sum + parseFloat(r.duration), 0).toFixed(2);
  
  content += `- **运行测试:** ${totalTests}\n`;
  content += `- **成功:** ${successTests}\n`;
  content += `- **失败:** ${failedTests}\n`;
  content += `- **总耗时:** ${totalDuration} 秒\n\n`;
  
  // 添加每个测试的结果
  content += `### 测试详情\n\n`;
  content += `| 测试名称 | 状态 | 耗时(秒) | 关键指标 |\n`;
  content += `|---------|------|---------|----------|\n`;
  
  results.forEach(result => {
    // 提取关键性能指标
    let metrics = '无数据';
    
    if (result.performanceData) {
      const data = result.performanceData;
      
      if (result.name === '批量大小优化测试' && data.summary) {
        metrics = `最佳批量大小: ${data.summary.optimalBatchSize}, ` +
                 `平均加载时间: ${data.summary.avgLoadTime?.toFixed(2) || 'N/A'}ms`;
      } 
      else if (result.name === '网络切换稳定性测试' && data.summary) {
        metrics = `切换成功率: ${data.summary.switchSuccessRate?.toFixed(2) || 'N/A'}%, ` +
                 `恢复时间: ${data.summary.avgRecoveryTime?.toFixed(2) || 'N/A'}ms`;
      }
      else if (result.name === '内存使用分析测试' && data.summary) {
        metrics = `峰值内存: ${data.summary.peakMemoryMB?.toFixed(2) || 'N/A'}MB, ` +
                 `内存增长率: ${data.summary.memoryGrowthRate?.toFixed(2) || 'N/A'}MB/min`;
      }
      else if (result.name === '移动设备性能测试' && data.summary) {
        // 获取低端设备的推荐
        const lowEndDevice = data.testResults?.lowEndDevice;
        if (lowEndDevice) {
          metrics = `低端设备最佳批量: ${lowEndDevice.optimalBatchSize || 'N/A'}, ` +
                   `高端设备最佳批量: ${data.testResults?.highEndDevice?.optimalBatchSize || 'N/A'}`;
        }
      }
    }
    
    content += `| ${result.name} | ${result.success ? '✅ 通过' : '❌ 失败'} | ${result.duration} | ${metrics} |\n`;
  });
  
  // 写入文件
  fs.writeFileSync(config.taskProgressFile, content);
  console.log(`进度信息已更新至: ${config.taskProgressFile}`);
}

// 生成HTML报告
function generateHtmlReport(results) {
  const reportPath = path.join(config.reportDir, 'performance-summary.html');
  
  let html = `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>性能测试总结报告</title>
  <style>
    body {
      font-family: 'PingFang SC', 'Microsoft YaHei', sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 1200px;
      margin: 0 auto;
      padding: 20px;
    }
    .header {
      background-color: #f5f5f5;
      padding: 20px;
      border-radius: 5px;
      margin-bottom: 30px;
    }
    .summary-box {
      display: flex;
      justify-content: space-between;
      margin-bottom: 30px;
    }
    .summary-item {
      flex: 1;
      background-color: #f9f9f9;
      padding: 15px;
      border-radius: 5px;
      margin: 0 10px;
      text-align: center;
    }
    .success { color: #4caf50; }
    .failure { color: #f44336; }
    .test-section {
      margin-bottom: 40px;
      border: 1px solid #eee;
      border-radius: 5px;
      padding: 20px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 20px;
    }
    th, td {
      padding: 12px 15px;
      border-bottom: 1px solid #ddd;
      text-align: left;
    }
    th {
      background-color: #f5f5f5;
    }
    .chart-container {
      height: 300px;
      margin: 30px 0;
    }
    .recommendation {
      background-color: #e8f5e9;
      padding: 15px;
      border-radius: 5px;
      margin-top: 20px;
    }
    h2 {
      border-bottom: 2px solid #eee;
      padding-bottom: 10px;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>性能测试总结报告</h1>
    <p>生成时间: ${new Date().toLocaleString('zh-CN')}</p>
  </div>
  
  <div class="summary-box">
    <div class="summary-item">
      <h3>测试总数</h3>
      <p>${results.length}</p>
    </div>
    <div class="summary-item">
      <h3>成功测试</h3>
      <p class="success">${results.filter(r => r.success).length}</p>
    </div>
    <div class="summary-item">
      <h3>失败测试</h3>
      <p class="failure">${results.filter(r => !r.success).length}</p>
    </div>
    <div class="summary-item">
      <h3>总耗时</h3>
      <p>${results.reduce((sum, r) => sum + parseFloat(r.duration), 0).toFixed(2)} 秒</p>
    </div>
  </div>
  `;
  
  // 为每个测试添加详细部分
  results.forEach(result => {
    html += `
  <div class="test-section">
    <h2>${result.name} ${result.success ? '<span class="success">✓</span>' : '<span class="failure">✗</span>'}</h2>
    <table>
      <tr><th>状态</th><td>${result.success ? '成功' : '失败'}</td></tr>
      <tr><th>耗时</th><td>${result.duration} 秒</td></tr>
    `;
    
    // 添加错误信息(如果有)
    if (!result.success && result.error) {
      html += `<tr><th>错误</th><td>${result.error}</td></tr>`;
    }
    
    // 添加性能数据
    if (result.performanceData) {
      const data = result.performanceData;
      
      if (result.name === '批量大小优化测试') {
        html += `
        <tr><th>最佳批量大小</th><td>${data.summary?.optimalBatchSize || 'N/A'}</td></tr>
        <tr><th>平均加载时间</th><td>${data.summary?.avgLoadTime?.toFixed(2) || 'N/A'} ms</td></tr>
        `;
        
        // 添加批量大小对比
        if (data.batchResults) {
          html += `
        </table>
        <h3>批量大小对比</h3>
        <table>
          <tr>
            <th>批量大小</th>
            <th>平均加载时间(ms)</th>
            <th>并发请求数</th>
            <th>资源成功率(%)</th>
          </tr>
          `;
          
          Object.entries(data.batchResults).forEach(([batchSize, metrics]) => {
            html += `
          <tr>
            <td>${batchSize}</td>
            <td>${metrics.avgLoadTime?.toFixed(2) || 'N/A'}</td>
            <td>${metrics.concurrency || 'N/A'}</td>
            <td>${(metrics.successRate || 0).toFixed(2)}</td>
          </tr>
            `;
          });
        }
      } 
      else if (result.name === '网络切换稳定性测试') {
        html += `
        <tr><th>网络切换成功率</th><td>${data.summary?.switchSuccessRate?.toFixed(2) || 'N/A'}%</td></tr>
        <tr><th>平均恢复时间</th><td>${data.summary?.avgRecoveryTime?.toFixed(2) || 'N/A'} ms</td></tr>
        <tr><th>最大恢复时间</th><td>${data.summary?.maxRecoveryTime?.toFixed(2) || 'N/A'} ms</td></tr>
        `;
        
        // 添加网络类型切换结果
        if (data.switchResults) {
          html += `
        </table>
        <h3>网络切换结果</h3>
        <table>
          <tr>
            <th>切换类型</th>
            <th>成功率(%)</th>
            <th>平均恢复时间(ms)</th>
            <th>资源中断率(%)</th>
          </tr>
          `;
          
          Object.entries(data.switchResults).forEach(([switchType, metrics]) => {
            html += `
          <tr>
            <td>${switchType}</td>
            <td>${(metrics.successRate || 0).toFixed(2)}</td>
            <td>${metrics.recoveryTime?.toFixed(2) || 'N/A'}</td>
            <td>${(metrics.interruptionRate || 0).toFixed(2)}</td>
          </tr>
            `;
          });
        }
      }
      else if (result.name === '内存使用分析测试') {
        html += `
        <tr><th>峰值内存使用</th><td>${data.summary?.peakMemoryMB?.toFixed(2) || 'N/A'} MB</td></tr>
        <tr><th>内存增长率</th><td>${data.summary?.memoryGrowthRate?.toFixed(2) || 'N/A'} MB/min</td></tr>
        <tr><th>内存回收效率</th><td>${data.summary?.garbageCollectionEfficiency?.toFixed(2) || 'N/A'}%</td></tr>
        `;
        
        // 添加不同场景的内存使用情况
        if (data.scenarioResults) {
          html += `
        </table>
        <h3>场景内存使用</h3>
        <table>
          <tr>
            <th>场景</th>
            <th>平均内存(MB)</th>
            <th>峰值内存(MB)</th>
            <th>内存增长(%)</th>
          </tr>
          `;
          
          Object.entries(data.scenarioResults).forEach(([scenario, metrics]) => {
            html += `
          <tr>
            <td>${scenario}</td>
            <td>${metrics.avgMemoryMB?.toFixed(2) || 'N/A'}</td>
            <td>${metrics.peakMemoryMB?.toFixed(2) || 'N/A'}</td>
            <td>${(metrics.growthPercent || 0).toFixed(2)}</td>
          </tr>
            `;
          });
        }
      }
      else if (result.name === '移动设备性能测试') {
        // 添加设备性能对比表格
        if (data.testResults) {
          html += `
        </table>
        <h3>设备性能对比</h3>
        <table>
          <tr>
            <th>设备类型</th>
            <th>最佳批量大小</th>
            <th>总加载时间(ms)</th>
            <th>首次资源时间(ms)</th>
            <th>P95加载时间(ms)</th>
            <th>平均吞吐量(KB/s)</th>
          </tr>
          `;
          
          Object.entries(data.testResults).forEach(([deviceType, metrics]) => {
            html += `
          <tr>
            <td>${metrics.name || deviceType}</td>
            <td>${metrics.optimalBatchSize || 'N/A'}</td>
            <td>${metrics.optimalLoadTime?.toFixed(2) || 'N/A'}</td>
            <td>${metrics.timeToFirstResource?.toFixed(2) || 'N/A'}</td>
            <td>${metrics.p95LoadTime?.toFixed(2) || 'N/A'}</td>
            <td>${Math.round((metrics.averageThroughput || 0) / 1024)}</td>
          </tr>
            `;
          });
          
          // 添加设备优化建议
          if (data.summary?.recommendations) {
            html += `
        </table>
        <div class="recommendation">
          <h3>设备优化建议</h3>
          <ul>
            `;
            
            Object.entries(data.summary.recommendations).forEach(([deviceType, recommendation]) => {
              const deviceName = data.testResults[deviceType]?.name || deviceType;
              html += `
            <li>
              <strong>${deviceName}:</strong> 
              建议批量大小 ${recommendation.recommendedBatchSize || 'N/A'}, 
              缓存大小 ${recommendation.recommendedCacheSize || 'N/A'}MB, 
              加载策略: ${recommendation.loadingStrategy || 'N/A'}
              ${recommendation.prioritizationNeeded ? '(需要资源优先级)' : ''}
            </li>
              `;
            });
            
            html += `
          </ul>
        </div>
            `;
          }
        }
      }
      
      // 确保表格正确关闭
      if (!html.includes('</table>')) {
        html += `</table>`;
      }
    } else {
      html += `</table>`;
    }
    
    html += `
  </div>
    `;
  });
  
  // 添加综合建议
  html += `
  <div class="test-section">
    <h2>综合建议</h2>
    <ul>
  `;
  
  // 批量大小建议
  const batchSizeTest = results.find(r => r.name === '批量大小优化测试' && r.success && r.performanceData);
  if (batchSizeTest) {
    const optimalBatchSize = batchSizeTest.performanceData.summary?.optimalBatchSize;
    if (optimalBatchSize) {
      html += `<li>建议将默认批量大小设置为 ${optimalBatchSize}</li>`;
    }
  }
  
  // 设备检测建议
  const deviceTest = results.find(r => r.name === '移动设备性能测试' && r.success && r.performanceData);
  if (deviceTest && deviceTest.performanceData.summary) {
    html += `
      <li>根据设备性能调整批量大小:
        <ul>
    `;
    
    const recommendations = deviceTest.performanceData.summary.recommendations || {};
    Object.entries(recommendations).forEach(([deviceType, rec]) => {
      const deviceName = deviceTest.performanceData.testResults[deviceType]?.name || deviceType;
      html += `<li>${deviceName}: 批量大小=${rec.recommendedBatchSize}, 加载策略=${rec.loadingStrategy}</li>`;
    });
    
    html += `
        </ul>
      </li>
    `;
  }
  
  // 内存优化建议
  const memoryTest = results.find(r => r.name === '内存使用分析测试' && r.success && r.performanceData);
  if (memoryTest && memoryTest.performanceData.summary) {
    const memoryData = memoryTest.performanceData.summary;
    if (memoryData.memoryGrowthRate > 5) {
      html += `<li>内存增长率较高 (${memoryData.memoryGrowthRate?.toFixed(2) || 'N/A'} MB/min)，建议增加自动清理缓存的频率</li>`;
    }
  }
  
  // 网络稳定性建议
  const networkTest = results.find(r => r.name === '网络切换稳定性测试' && r.success && r.performanceData);
  if (networkTest && networkTest.performanceData.summary) {
    const networkData = networkTest.performanceData.summary;
    if (networkData.avgRecoveryTime > 1000) {
      html += `<li>网络切换恢复时间较长 (${networkData.avgRecoveryTime?.toFixed(2) || 'N/A'} ms)，建议优化网络状态检测和重连逻辑</li>`;
    }
  }
  
  html += `
    </ul>
  </div>
  
</body>
</html>
  `;
  
  fs.writeFileSync(reportPath, html);
  console.log(`HTML报告已生成: ${reportPath}`);
}

// 主函数
async function main() {
  console.log('开始运行性能测试...');
  console.log(`配置: 报告目录=${config.reportDir}, 任务进度文件=${config.taskProgressFile}`);
  
  const results = [];
  let successCount = 0;
  let failureCount = 0;
  
  for (const script of testScripts) {
    try {
      const result = await runTestScript(script);
      results.push(result);
      
      if (result.success) {
        successCount++;
      } else {
        failureCount++;
      }
    } catch (error) {
      console.error(`运行 ${script.name} 出错:`, error);
      results.push({
        name: script.name,
        success: false,
        duration: 0,
        error: error.message
      });
      failureCount++;
    }
  }
  
  // 更新任务进度
  updateTaskProgress(results);
  
  // 生成HTML报告
  if (config.htmlReport) {
    generateHtmlReport(results);
  }
  
  // 输出总结
  console.log('\n===== 性能测试运行完成 =====');
  console.log(`成功: ${successCount}, 失败: ${failureCount}, 总测试: ${testScripts.length}`);
  
  return {
    success: failureCount === 0,
    successCount,
    failureCount,
    results
  };
}

// 直接运行或作为模块导出
if (require.main === module) {
  main().catch(error => {
    console.error('性能测试运行失败:', error);
    process.exit(1);
  });
} else {
  module.exports = { main, config }; 
} 