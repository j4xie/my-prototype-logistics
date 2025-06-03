/**
 * @file 内存使用分析测试运行器
 * @description 测试资源加载器在不同负载下的内存使用情况
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
  sampleSize: 3,  // 每个测试重复3次取平均值
  warmupRuns: 1,  // 1次预热运行
  cooldownMs: 100 // 测试间冷却时间100ms
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
 * @param {number} minSize - 最小资源大小（字节）
 * @param {number} maxSize - 最大资源大小（字节）
 * @returns {Array} 资源配置对象数组
 */
function generateResources(count, type = 'mixed', minSize = 5000, maxSize = 500000) {
  const resources = [];
  const types = type === 'mixed' ? ['image', 'script', 'style'] : [type];
  
  for (let i = 0; i < count; i++) {
    const resourceType = types[i % types.length];
    const priority = i % 3; // 0: 高, 1: 中, 2: 低
    const size = minSize + Math.random() * (maxSize - minSize);
    
    resources.push({
      id: `resource-${i}`,
      url: `https://example.com/${resourceType}s/resource-${i}.${resourceType === 'image' ? 'png' : resourceType === 'script' ? 'js' : 'css'}`,
      type: resourceType,
      priority: priority,
      size: size
    });
  }
  
  return resources;
}

/**
 * 测量内存增长率
 * @param {Array} memorySnapshots - 内存快照数组
 * @returns {Object} 内存增长率分析
 */
function analyzeMemoryGrowth(memorySnapshots) {
  if (memorySnapshots.length < 2) return null;
  
  // 提取内存使用数据
  const usedHeapSizes = memorySnapshots.map(snapshot => snapshot.memory.usedJSHeapSize);
  
  // 计算增长
  const initialHeapSize = usedHeapSizes[0];
  const finalHeapSize = usedHeapSizes[usedHeapSizes.length - 1];
  const absoluteGrowth = finalHeapSize - initialHeapSize;
  const relativeGrowth = (absoluteGrowth / initialHeapSize) * 100;
  
  // 计算平均增长率（每个快照间的平均增长）
  const growthRates = [];
  for (let i = 1; i < usedHeapSizes.length; i++) {
    const growth = usedHeapSizes[i] - usedHeapSizes[i-1];
    const rate = (growth / usedHeapSizes[i-1]) * 100;
    growthRates.push(rate);
  }
  
  const avgGrowthRate = growthRates.reduce((sum, rate) => sum + rate, 0) / growthRates.length;
  
  return {
    initialHeapSize,
    finalHeapSize,
    absoluteGrowth,
    relativeGrowth,
    avgGrowthRate,
    growthRates,
    snapshots: memorySnapshots.length
  };
}

/**
 * 测试加载大量资源时的内存使用
 * @param {number} resourceCount - 资源数量
 * @param {string} type - 资源类型
 * @param {number} batchSize - 批量大小
 * @returns {Promise<Object>} 测试结果
 */
async function testMemoryUsageWithLoad(resourceCount, type, batchSize) {
  // 重置加载器确保干净的初始状态
  traceLoader.clearCache();
  traceLoader.reset();
  
  // 捕获初始内存状态
  const initialMemory = performanceTool._captureMemorySnapshot(`${type}_initial`);
  
  console.log(`生成 ${resourceCount} 个 ${type} 类型资源...`);
  const resources = generateResources(resourceCount, type);
  
  console.log(`使用批量大小 ${batchSize} 加载资源...`);
  traceLoader.configure({ batchSize });
  
  // 捕获资源生成后的内存状态
  performanceTool._captureMemorySnapshot(`${type}_after_generation`);
  
  // 加载资源
  const loadStartTime = Date.now();
  try {
    const results = await traceLoader.loadBatch(resources);
    const loadDuration = Date.now() - loadStartTime;
    
    // 捕获加载后的内存状态
    performanceTool._captureMemorySnapshot(`${type}_after_load`);
    
    // 等待一段时间让GC有机会运行
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // 再次捕获内存状态（用于检测潜在的内存泄漏）
    performanceTool._captureMemorySnapshot(`${type}_after_gc`);
    
    return {
      type,
      resourceCount,
      batchSize,
      loadDuration,
      successCount: results.length,
      totalSize: resources.reduce((sum, r) => sum + r.size, 0),
      memoryAnalysis: analyzeMemoryGrowth(performanceTool.memorySnapshots)
    };
  } catch (error) {
    console.error(`加载资源失败:`, error);
    
    // 捕获错误后的内存状态
    performanceTool._captureMemorySnapshot(`${type}_after_error`);
    
    throw error;
  }
}

/**
 * 测试内存泄漏
 * @param {number} iterations - 迭代次数
 * @param {number} resourcesPerIteration - 每次迭代的资源数量
 * @returns {Promise<Object>} 测试结果
 */
async function testMemoryLeaks(iterations, resourcesPerIteration) {
  // 重置加载器
  traceLoader.clearCache();
  traceLoader.reset();
  
  const memorySnapshots = [];
  const iterationResults = [];
  
  console.log(`开始内存泄漏测试，${iterations} 次迭代，每次 ${resourcesPerIteration} 个资源...`);
  
  // 捕获初始内存状态
  memorySnapshots.push({
    iteration: 0,
    memory: {
      usedJSHeapSize: performance.memory.usedJSHeapSize,
      totalJSHeapSize: performance.memory.totalJSHeapSize
    }
  });
  
  for (let i = 1; i <= iterations; i++) {
    console.log(`迭代 ${i}/${iterations}...`);
    
    // 生成资源
    const resources = generateResources(resourcesPerIteration, 'mixed');
    
    // 加载资源
    const startTime = Date.now();
    try {
      await traceLoader.loadBatch(resources);
      
      // 强制清除加载器缓存，让我们可以检测到缓存清理后是否仍有内存泄漏
      traceLoader.clearCache();
      
      // 等待一小段时间让GC有机会运行
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // 捕获这次迭代后的内存状态
      memorySnapshots.push({
        iteration: i,
        memory: {
          usedJSHeapSize: performance.memory.usedJSHeapSize,
          totalJSHeapSize: performance.memory.totalJSHeapSize
        }
      });
      
      iterationResults.push({
        iteration: i,
        duration: Date.now() - startTime,
        resourceCount: resources.length,
        success: true
      });
    } catch (error) {
      console.error(`迭代 ${i} 失败:`, error);
      
      iterationResults.push({
        iteration: i,
        duration: Date.now() - startTime,
        resourceCount: resources.length,
        success: false,
        error: error.message
      });
    }
  }
  
  // 分析内存泄漏
  const memoryUsages = memorySnapshots.map(snapshot => snapshot.memory.usedJSHeapSize);
  const initialMemory = memoryUsages[0];
  const finalMemory = memoryUsages[memoryUsages.length - 1];
  const absoluteGrowth = finalMemory - initialMemory;
  const growthPerIteration = absoluteGrowth / iterations;
  
  // 计算线性增长趋势
  const growthTrend = memoryUsages.map((usage, index) => {
    if (index === 0) return 0;
    return usage - memoryUsages[index - 1];
  }).slice(1); // 移除第一个0值
  
  // 线性拟合趋势(简化版)
  let trendIsLinear = false;
  let trendSlope = 0;
  
  if (growthTrend.length > 3) {
    // 简单检测线性增长：计算后半部分与前半部分的平均增长差异
    const halfIndex = Math.floor(growthTrend.length / 2);
    const firstHalfAvg = growthTrend.slice(0, halfIndex).reduce((sum, v) => sum + v, 0) / halfIndex;
    const secondHalfAvg = growthTrend.slice(halfIndex).reduce((sum, v) => sum + v, 0) / (growthTrend.length - halfIndex);
    
    // 如果两部分平均增长差异小于20%，则认为是线性趋势
    const difference = Math.abs(secondHalfAvg - firstHalfAvg) / firstHalfAvg;
    trendIsLinear = difference < 0.2;
    trendSlope = (finalMemory - initialMemory) / iterations;
  }
  
  return {
    iterations,
    resourcesPerIteration,
    initialMemory,
    finalMemory,
    absoluteGrowth,
    growthPerIteration,
    memorySnapshots,
    iterationResults,
    leakAnalysis: {
      hasLeak: absoluteGrowth > 0 && trendIsLinear,
      leakRate: trendIsLinear ? trendSlope : 0,
      trendIsLinear,
      growthTrend
    }
  };
}

/**
 * 主测试函数
 */
async function runTests() {
  console.log('====================================');
  console.log('内存使用分析测试');
  console.log('====================================');
  console.log(`运行时间: ${new Date().toISOString()}`);
  
  try {
    // 测试1：测试不同类型资源的内存占用
    console.log('\n测试1：不同类型资源的内存占用...');
    
    const imageResult = await performanceTool.measure(async () => {
      return await testMemoryUsageWithLoad(100, 'image', 20);
    }, '图片资源内存使用');
    
    const scriptResult = await performanceTool.measure(async () => {
      return await testMemoryUsageWithLoad(100, 'script', 20);
    }, '脚本资源内存使用');
    
    const styleResult = await performanceTool.measure(async () => {
      return await testMemoryUsageWithLoad(100, 'style', 20);
    }, '样式资源内存使用');
    
    const mixedResult = await performanceTool.measure(async () => {
      return await testMemoryUsageWithLoad(100, 'mixed', 20);
    }, '混合资源内存使用');
    
    // 测试2：不同批量大小的内存效率
    console.log('\n测试2：不同批量大小的内存效率...');
    
    const smallBatchResult = await performanceTool.measure(async () => {
      return await testMemoryUsageWithLoad(50, 'mixed', 5);
    }, '小批量内存效率');
    
    const mediumBatchResult = await performanceTool.measure(async () => {
      return await testMemoryUsageWithLoad(50, 'mixed', 25);
    }, '中批量内存效率');
    
    const largeBatchResult = await performanceTool.measure(async () => {
      return await testMemoryUsageWithLoad(50, 'mixed', 50);
    }, '大批量内存效率');
    
    // 测试3：内存泄漏检测
    console.log('\n测试3：内存泄漏检测...');
    
    const leakTestResult = await performanceTool.measure(async () => {
      return await testMemoryLeaks(10, 20);
    }, '内存泄漏检测');
    
    // 处理泄漏检测结果
    const hasLeak = leakTestResult.result.leakAnalysis.hasLeak;
    console.log(`内存泄漏检测结果: ${hasLeak ? '⚠️ 可能存在泄漏' : '✅ 未检测到泄漏'}`);
    if (hasLeak) {
      console.log(`泄漏率: 每次迭代增加约 ${Math.round(leakTestResult.result.leakAnalysis.leakRate / 1024)} KB`);
    }
    
    // 将结果保存到报告文件
    const reportData = {
      timestamp: new Date().toISOString(),
      testResults: {
        resourceTypeMemoryUsage: {
          image: imageResult.result,
          script: scriptResult.result,
          style: styleResult.result,
          mixed: mixedResult.result
        },
        batchSizeMemoryEfficiency: {
          small: smallBatchResult.result,
          medium: mediumBatchResult.result,
          large: largeBatchResult.result
        },
        memoryLeakTest: leakTestResult.result
      },
      summary: {
        hasMemoryLeak: leakTestResult.result.leakAnalysis.hasLeak,
        mostMemoryEfficientType: [imageResult, scriptResult, styleResult, mixedResult]
          .sort((a, b) => a.result.memoryAnalysis.relativeGrowth - b.result.memoryAnalysis.relativeGrowth)[0].result.type,
        mostMemoryEfficientBatchSize: [smallBatchResult, mediumBatchResult, largeBatchResult]
          .sort((a, b) => (a.result.memoryAnalysis.absoluteGrowth / a.result.resourceCount) - 
                        (b.result.memoryAnalysis.absoluteGrowth / b.result.resourceCount))[0].result.batchSize
      },
      performanceData: performanceTool.getSummary(false)
    };
    
    // 确保目录存在
    const reportsDir = path.resolve(__dirname, '../../reports');
    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true });
    }
    
    // 写入报告文件
    const reportPath = path.join(reportsDir, 'run-memory-usage-test-report.json');
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