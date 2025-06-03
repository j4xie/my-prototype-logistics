/**
 * @file 批量大小优化测试运行器
 * @description 不依赖Jest框架的独立批量大小优化性能测试
 */

// 首先加载测试环境配置
require('../utils/test-environment');

const { traceLoader } = require('./resource-loader');
const { NetworkMonitor } = require('./network-monitor');
const PerformanceTestTool = require('../utils/performance-test-tool');
const fs = require('fs');
const path = require('path');

// 创建性能测试工具
const performanceTool = new PerformanceTestTool({
  sampleSize: 3,      // 每个测试重复3次取平均值
  warmupRuns: 1,      // 1次预热运行
  cooldownMs: 100     // 测试间冷却时间100ms
});

// 初始化网络监控和加载器
const networkMonitor = new NetworkMonitor();
traceLoader.reset();

// 开始记录性能数据
performanceTool.startRecording();

/**
 * 生成测试用资源
 * @param {number} count - 资源数量
 * @param {string} type - 资源类型 ('image'|'script'|'style'|'mixed')
 * @returns {Array} 资源配置对象数组
 */
function generateResources(count, type = 'mixed') {
  const resources = [];
  const types = type === 'mixed' ? ['image', 'script', 'style'] : [type];
  
  for (let i = 0; i < count; i++) {
    const resourceType = types[i % types.length];
    const priority = i % 3; // 0: 高, 1: 中, 2: 低
    
    resources.push({
      id: `resource-${i}`,
      url: `https://example.com/${resourceType}s/resource-${i}.${resourceType === 'image' ? 'png' : resourceType === 'script' ? 'js' : 'css'}`,
      type: resourceType,
      priority: priority,
      size: resourceType === 'image' ? 50000 + Math.random() * 100000 : 
            resourceType === 'script' ? 10000 + Math.random() * 20000 : 
            5000 + Math.random() * 10000
    });
  }
  
  return resources;
}

/**
 * 测试不同批量大小的性能
 * @param {number} minSize - 最小批量大小
 * @param {number} maxSize - 最大批量大小
 * @param {number} step - 步长
 * @param {number} resourceCount - 资源总数
 * @returns {Object} 测试结果
 */
async function testBatchSizes(minSize, maxSize, step, resourceCount) {
  const results = {};
  const resources = generateResources(resourceCount);
  
  // 测试不同批量大小
  for (let batchSize = minSize; batchSize <= maxSize; batchSize += step) {
    const testName = `批量大小-${batchSize}`;
    
    // 使用性能测试工具测量性能
    const result = await performanceTool.measure(async () => {
      // 配置批量大小
      traceLoader.configure({ batchSize });
      
      // 加载资源
      return await traceLoader.loadBatch(resources);
    }, testName);
    
    results[batchSize] = {
      averageTime: result.average,
      minTime: result.min,
      maxTime: result.max,
      medianTime: result.median,
      standardDeviation: result.stdDev,
      totalBytes: resources.reduce((sum, r) => sum + r.size, 0)
    };
  }
  
  return results;
}

/**
 * 主测试函数
 */
async function runTests() {
  console.log('====================================');
  console.log('资源加载器 - 批量大小优化测试');
  console.log('====================================');
  console.log(`运行时间: ${new Date().toISOString()}`);
  
  try {
    // 测试小批量资源
    console.log('\n测试小批量资源的最佳批量大小(5-30)...');
    const smallResults = await testBatchSizes(5, 30, 5, 30);
    
    // 找出平均加载时间最短的批量大小
    let bestSmallBatchSize = 0;
    let bestSmallAverageTime = Infinity;
    
    Object.entries(smallResults).forEach(([batchSize, result]) => {
      if (result.averageTime < bestSmallAverageTime) {
        bestSmallAverageTime = result.averageTime;
        bestSmallBatchSize = parseInt(batchSize);
      }
    });
    
    console.log(`小批量资源最佳批量大小: ${bestSmallBatchSize}, 平均加载时间: ${bestSmallAverageTime}ms`);
    
    // 测试中批量资源
    console.log('\n测试中批量资源的最佳批量大小(35-70)...');
    const mediumResults = await testBatchSizes(35, 70, 5, 70);
    
    // 找出平均加载时间最短的批量大小
    let bestMediumBatchSize = 0;
    let bestMediumAverageTime = Infinity;
    
    Object.entries(mediumResults).forEach(([batchSize, result]) => {
      if (result.averageTime < bestMediumAverageTime) {
        bestMediumAverageTime = result.averageTime;
        bestMediumBatchSize = parseInt(batchSize);
      }
    });
    
    console.log(`中批量资源最佳批量大小: ${bestMediumBatchSize}, 平均加载时间: ${bestMediumAverageTime}ms`);
    
    // 测试大批量资源
    console.log('\n测试大批量资源的最佳批量大小(75-100)...');
    const largeResults = await testBatchSizes(75, 100, 5, 100);
    
    // 找出平均加载时间最短的批量大小
    let bestLargeBatchSize = 0;
    let bestLargeAverageTime = Infinity;
    
    Object.entries(largeResults).forEach(([batchSize, result]) => {
      if (result.averageTime < bestLargeAverageTime) {
        bestLargeAverageTime = result.averageTime;
        bestLargeBatchSize = parseInt(batchSize);
      }
    });
    
    console.log(`大批量资源最佳批量大小: ${bestLargeBatchSize}, 平均加载时间: ${bestLargeAverageTime}ms`);
    
    // 测试内存占用
    console.log('\n测试不同批量大小的内存占用情况...');
    const batchSizesToTest = [10, 25, 50, 75, 100];
    
    // 将结果保存到报告文件
    const reportData = {
      timestamp: new Date().toISOString(),
      testResults: {
        smallBatch: {
          bestBatchSize: bestSmallBatchSize,
          bestAverageTime: bestSmallAverageTime,
          allResults: smallResults
        },
        mediumBatch: {
          bestBatchSize: bestMediumBatchSize,
          bestAverageTime: bestMediumAverageTime,
          allResults: mediumResults
        },
        largeBatch: {
          bestBatchSize: bestLargeBatchSize,
          bestAverageTime: bestLargeAverageTime,
          allResults: largeResults
        }
      },
      summary: {
        overallBestBatchSize: bestSmallAverageTime < bestMediumAverageTime && bestSmallAverageTime < bestLargeAverageTime ? bestSmallBatchSize :
                             bestMediumAverageTime < bestLargeAverageTime ? bestMediumBatchSize : bestLargeBatchSize,
        recommendedBatchSizes: {
          small: bestSmallBatchSize,
          medium: bestMediumBatchSize,
          large: bestLargeBatchSize
        }
      },
      performanceData: performanceTool.getSummary(false)
    };
    
    // 确保目录存在
    const reportsDir = path.resolve(__dirname, '../../reports');
    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true });
    }
    
    // 写入报告文件
    const reportPath = path.join(reportsDir, 'batch-size-optimization-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(reportData, null, 2), 'utf8');
    
    console.log(`\n报告已生成: ${reportPath}`);
    
    // 输出格式化性能数据（用于生成报告解析）
    console.log('\nPERFORMANCE_DATA_START');
    console.log(JSON.stringify(reportData));
    console.log('PERFORMANCE_DATA_END');
    
    console.log('\n====================================');
    console.log('测试完成');
    console.log('====================================');
    
    return { success: true, data: reportData };
  } catch (error) {
    console.error('测试过程中发生错误:', error);
    
    // 停止记录性能数据
    performanceTool.stopRecording();
    
    // 清理资源
    networkMonitor.removeAllListeners();
    traceLoader.reset();
    
    return { success: false, error: error.message };
  } finally {
    // 停止记录性能数据
    performanceTool.stopRecording();
    
    // 清理资源
    networkMonitor.removeAllListeners();
    traceLoader.reset();
  }
}

// 运行测试
runTests()
  .then(result => {
    if (!result.success) {
      process.exit(1);
    }
  })
  .catch(error => {
    console.error('运行测试时发生错误:', error);
    process.exit(1);
  }); 