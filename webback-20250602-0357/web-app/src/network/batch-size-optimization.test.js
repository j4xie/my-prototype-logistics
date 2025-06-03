/**
 * @file 资源加载器批量大小优化性能测试
 * @description 测试不同批量大小对资源加载性能的影响，以确定最佳批处理大小
 */

// 添加Jest引用
const jest = require('jest');

// 模拟模块
jest.mock('./resource-loader', () => ({
  traceLoader: {
    reset: jest.fn(),
    configure: jest.fn(),
    loadBatch: jest.fn().mockResolvedValue([]),
    init: jest.fn().mockReturnValue({
      loadBatch: jest.fn().mockResolvedValue([])
    })
  }
}));

jest.mock('./network-monitor', () => ({
  NetworkMonitor: jest.fn().mockImplementation(() => ({
    removeAllListeners: jest.fn(),
    on: jest.fn(),
    emit: jest.fn()
  }))
}));

jest.mock('../utils/performance-test-tool', () => {
  return jest.fn().mockImplementation(() => ({
    startRecording: jest.fn(),
    stopRecording: jest.fn(),
    getSummary: jest.fn().mockReturnValue({}),
    measure: jest.fn().mockResolvedValue({
      average: 100,
      min: 80,
      max: 120,
      median: 100,
      stdDev: 10
    })
  }));
});

const { traceLoader } = require('./resource-loader');
const { NetworkMonitor } = require('./network-monitor');
const PerformanceTestTool = require('../utils/performance-test-tool');

// 设置全局模拟
global.performance = global.performance || {
  now: jest.fn().mockReturnValue(Date.now()),
  memory: {
    usedJSHeapSize: 1000000,
    totalJSHeapSize: 10000000,
    jsHeapSizeLimit: 100000000
  }
};

global.window = global.window || {
  dispatchEvent: jest.fn()
};

describe('资源加载器 - 批量大小优化测试', () => {
  // 性能测试工具实例
  let performanceTool;
  // 网络监控实例
  let networkMonitor;
  // 原始性能API
  let originalPerformance = global.performance;

  beforeEach(() => {
    // 创建性能测试工具
    performanceTool = new PerformanceTestTool({
      sampleSize: 3,      // 每个测试重复3次取平均值
      warmupRuns: 1,      // 1次预热运行
      cooldownMs: 100     // 测试间冷却时间100ms
    });
    
    // 初始化网络监控和加载器
    networkMonitor = new NetworkMonitor();
    traceLoader.reset();
    
    // 开始记录性能数据
    performanceTool.startRecording();
  });
  
  afterEach(() => {
    // 停止记录性能数据
    performanceTool.stopRecording();
    
    // 清理资源
    networkMonitor.removeAllListeners();
    traceLoader.reset();
    
    // 输出测试结果摘要
    console.log(performanceTool.getSummary());
  });

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

  it('应该找到处理小批量资源的最佳批量大小(5-30)', async () => {
    // 测试小批量资源的不同批量大小
    const resourceCount = 30;
    const results = await testBatchSizes(5, 30, 5, resourceCount);
    
    // 找出平均加载时间最短的批量大小
    let bestBatchSize = 0;
    let bestAverageTime = Infinity;
    
    Object.entries(results).forEach(([batchSize, result]) => {
      if (result.averageTime < bestAverageTime) {
        bestAverageTime = result.averageTime;
        bestBatchSize = parseInt(batchSize);
      }
    });
    
    console.log(`小批量资源最佳批量大小: ${bestBatchSize}, 平均加载时间: ${bestAverageTime}ms`);
    
    // 断言最佳批量大小在合理范围内
    expect(bestBatchSize).toBeGreaterThanOrEqual(5);
    expect(bestBatchSize).toBeLessThanOrEqual(30);
    
    // 验证平均加载时间低于阈值
    expect(bestAverageTime).toBeLessThan(1000); // 1秒
  });

  it('应该找到处理中批量资源的最佳批量大小(35-70)', async () => {
    // 测试中批量资源的不同批量大小
    const resourceCount = 70;
    const results = await testBatchSizes(35, 70, 5, resourceCount);
    
    // 找出平均加载时间最短的批量大小
    let bestBatchSize = 0;
    let bestAverageTime = Infinity;
    
    Object.entries(results).forEach(([batchSize, result]) => {
      if (result.averageTime < bestAverageTime) {
        bestAverageTime = result.averageTime;
        bestBatchSize = parseInt(batchSize);
      }
    });
    
    console.log(`中批量资源最佳批量大小: ${bestBatchSize}, 平均加载时间: ${bestAverageTime}ms`);
    
    // 断言最佳批量大小在合理范围内
    expect(bestBatchSize).toBeGreaterThanOrEqual(35);
    expect(bestBatchSize).toBeLessThanOrEqual(70);
    
    // 验证平均加载时间低于阈值
    expect(bestAverageTime).toBeLessThan(2000); // 2秒
  });

  it('应该找到处理大批量资源的最佳批量大小(75-100)', async () => {
    // 测试大批量资源的不同批量大小
    const resourceCount = 100;
    const results = await testBatchSizes(75, 100, 5, resourceCount);
    
    // 找出平均加载时间最短的批量大小
    let bestBatchSize = 0;
    let bestAverageTime = Infinity;
    
    Object.entries(results).forEach(([batchSize, result]) => {
      if (result.averageTime < bestAverageTime) {
        bestAverageTime = result.averageTime;
        bestBatchSize = parseInt(batchSize);
      }
    });
    
    console.log(`大批量资源最佳批量大小: ${bestBatchSize}, 平均加载时间: ${bestAverageTime}ms`);
    
    // 断言最佳批量大小在合理范围内
    expect(bestBatchSize).toBeGreaterThanOrEqual(75);
    expect(bestBatchSize).toBeLessThanOrEqual(100);
    
    // 验证平均加载时间低于阈值
    expect(bestAverageTime).toBeLessThan(3000); // 3秒
  });

  it('应该测量不同批量大小的内存占用情况', async () => {
    // 准备测试数据
    const resourceCount = 100;
    const batchSizesToTest = [10, 25, 50, 75, 100];
    const memoryResults = {};
    
    // 模拟内存API
    const mockMemory = {
      usedJSHeapSize: 1000000, // 初始堆大小1MB
      totalJSHeapSize: 10000000,
      jsHeapSizeLimit: 100000000
    };
    
    Object.defineProperty(global.performance, 'memory', {
      get: () => mockMemory,
      configurable: true
    });
    
    // 测试不同批量大小的内存占用
    for (const batchSize of batchSizesToTest) {
      // 重置内存数据
      mockMemory.usedJSHeapSize = 1000000;
      
      const resources = generateResources(resourceCount);
      
      // 配置批量大小
      traceLoader.configure({ batchSize });
      
      // 记录加载前内存
      const beforeMemory = global.performance.memory.usedJSHeapSize;
      
      // 加载资源
      await traceLoader.loadBatch(resources);
      
      // 记录加载后内存
      const afterMemory = global.performance.memory.usedJSHeapSize;
      
      // 计算内存增长
      const memoryGrowth = afterMemory - beforeMemory;
      
      memoryResults[batchSize] = {
        beforeMemory,
        afterMemory,
        memoryGrowth,
        memoryGrowthPerResource: memoryGrowth / resourceCount
      };
    }
    
    console.log('内存占用测试结果:', memoryResults);
    
    // 断言内存增长率随批量大小增加不会显著增长
    const memoryGrowthRates = Object.values(memoryResults).map(r => r.memoryGrowthPerResource);
    
    // 验证最大内存增长率不超过阈值
    expect(Math.max(...memoryGrowthRates)).toBeLessThan(50000); // 每个资源50KB
    
    // 恢复原始performance对象
    global.performance = originalPerformance;
  });

  it('应该测量批量大小对资源加载并发度的影响', async () => {
    // 准备测试数据
    const resourceCount = 50;
    const batchSizesToTest = [5, 10, 20, 30, 40, 50];
    const concurrencyResults = {};
    
    // 创建模拟请求计数器
    let activeRequests = 0;
    let maxActiveRequests = 0;
    
    // 监听资源请求和完成事件
    traceLoader.on('resourceRequestStart', () => {
      activeRequests++;
      maxActiveRequests = Math.max(maxActiveRequests, activeRequests);
    });
    
    traceLoader.on('resourceRequestComplete', () => {
      activeRequests--;
    });
    
    // 测试不同批量大小的并发度
    for (const batchSize of batchSizesToTest) {
      // 重置计数器
      activeRequests = 0;
      maxActiveRequests = 0;
      
      const resources = generateResources(resourceCount);
      
      // 配置批量大小和并发限制
      traceLoader.configure({ 
        batchSize,
        maxConcurrentRequests: 20 // 设置最大并发为20
      });
      
      // 加载资源
      await traceLoader.loadBatch(resources);
      
      concurrencyResults[batchSize] = {
        maxConcurrency: maxActiveRequests
      };
    }
    
    console.log('并发度测试结果:', concurrencyResults);
    
    // 验证并发度不超过设置的上限
    Object.values(concurrencyResults).forEach(result => {
      expect(result.maxConcurrency).toBeLessThanOrEqual(20);
    });
    
    // 验证较大批量大小能更好地利用并发能力
    expect(concurrencyResults[5].maxConcurrency).toBeLessThan(concurrencyResults[50].maxConcurrency);
  });
}); 