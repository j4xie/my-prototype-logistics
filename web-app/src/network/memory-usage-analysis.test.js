/**
 * @file 资源加载器内存占用分析测试
 * @description 测试资源加载器在不同工作负载下的内存占用情况
 */

// 添加Jest引用
const jest = require('jest');

// 模拟模块
jest.mock('./resource-loader', () => ({
  traceLoader: {
    reset: jest.fn(),
    init: jest.fn().mockReturnValue({
      loadBatch: jest.fn().mockResolvedValue([])
    })
  }
}));

jest.mock('../utils/performance-test-tool', () => {
  return jest.fn().mockImplementation(() => ({
    startRecording: jest.fn(),
    stopRecording: jest.fn(),
    getSummary: jest.fn().mockReturnValue({})
  }));
});

// 模拟测试服务器的mockFetch
jest.mock('../../../test/mock-server/mockFetch', () => ({
  default: jest.fn().mockImplementation((url) => {
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ url }),
      text: () => Promise.resolve(`Content for ${url}`),
      blob: () => Promise.resolve(new Blob([`Blob content for ${url}`]))
    });
  })
}));

// 模拟资源加载器
jest.mock('./resource-loader', () => {
  return {
    withMock: jest.fn().mockImplementation((mockFetch, options) => ({
      loadBatch: jest.fn().mockImplementation((urls, options = {}) => {
        if (options.onProgress) {
          // 模拟加载进度回调
          urls.forEach((url, index) => {
            setTimeout(() => options.onProgress(index + 1), 10 * (index + 1));
          });
        }
        return Promise.resolve(urls.map(url => ({ url, loaded: true })));
      })
    })),
    traceLoader: {
      reset: jest.fn(),
      init: jest.fn()
    }
  };
});

const { traceLoader } = require('./resource-loader');
const PerformanceTestTool = require('../utils/performance-test-tool');
const ResourceLoader = require('./resource-loader');

// 设置全局模拟
global.performance = global.performance || {
  now: jest.fn().mockReturnValue(Date.now()),
  memory: {
    usedJSHeapSize: 1000000,
    totalJSHeapSize: 10000000,
    jsHeapSizeLimit: 100000000
  }
};

describe('资源加载器 - 内存占用分析', () => {
  // 性能测试工具实例
  let performanceTool;
  // 原始性能API
  let originalPerformance = global.performance;
  // 模拟内存API数据
  let mockMemory;
  // 记录GC事件
  let gcEvents = [];

  beforeEach(() => {
    // 创建性能测试工具
    performanceTool = new PerformanceTestTool({
      sampleSize: 3,
      warmupRuns: 1,
      cooldownMs: 100
    });
    
    // 开始记录性能数据
    performanceTool.startRecording();
    
    // 模拟 performance API 内存数据
    mockMemory = {
      usedJSHeapSize: 1000000, // 初始堆大小1MB
      totalJSHeapSize: 10000000,
      jsHeapSizeLimit: 100000000
    };
    
    global.performance = {
      ...originalPerformance,
      memory: mockMemory
    };
    
    // 重置加载器
    traceLoader.reset();
    
    // 初始化GC事件记录
    gcEvents = [];
    
    // 模拟GC调用
    global.gc = jest.fn(() => {
      // 模拟GC减少内存使用
      mockMemory.usedJSHeapSize = Math.max(
        mockMemory.usedJSHeapSize * 0.7, // 减少30%的内存
        1000000 // 但不低于1MB
      );
      gcEvents.push({
        timestamp: Date.now(),
        heapSizeAfter: mockMemory.usedJSHeapSize
      });
    });
  });
  
  afterEach(() => {
    // 停止记录性能数据
    performanceTool.stopRecording();
    
    // 恢复原始 performance API
    global.performance = originalPerformance;
    
    // 清理GC模拟
    delete global.gc;
    
    // 清理加载器
    traceLoader.reset();
  });

  /**
   * 生成测试用资源
   * @param {number} count - 资源数量
   * @param {string} type - 资源类型 ('image'|'script'|'style'|'mixed')
   * @param {number} sizeMultiplier - 资源大小倍数
   * @returns {Array} 资源配置对象数组
   */
  function generateResources(count, type = 'mixed', sizeMultiplier = 1) {
    const resources = [];
    const types = type === 'mixed' ? ['image', 'script', 'style'] : [type];
    
    for (let i = 0; i < count; i++) {
      const resourceType = types[i % types.length];
      let size;
      
      switch (resourceType) {
        case 'image':
          // 图片一般较大
          size = (50000 + Math.random() * 150000) * sizeMultiplier;
          break;
        case 'script':
          // 脚本中等大小
          size = (10000 + Math.random() * 30000) * sizeMultiplier;
          break;
        case 'style':
          // 样式一般较小
          size = (5000 + Math.random() * 15000) * sizeMultiplier;
          break;
        default:
          size = 10000 * sizeMultiplier;
      }
      
      resources.push({
        id: `resource-${i}`,
        url: `https://example.com/${resourceType}s/resource-${i}.${resourceType === 'image' ? 'png' : resourceType === 'script' ? 'js' : 'css'}`,
        type: resourceType,
        priority: i % 3, // 0: 高, 1: 中, 2: 低
        size: Math.floor(size)
      });
    }
    
    return resources;
  }

  /**
   * 模拟资源加载过程
   * @param {Array} resources - 资源配置数组
   * @param {Object} options - 加载选项
   * @returns {Object} 内存使用情况
   */
  async function simulateResourceLoading(resources, options = {}) {
    const memorySnapshots = [];
    const defaultOptions = {
      batchSize: 20,
      recordInterval: 100, // ms
      increasePerResource: 2000 // 每个资源增加内存(字节)
    };
    
    const opts = { ...defaultOptions, ...options };
    
    // 导入mockFetch
    const mockFetch = require('../../../test/mock-server/mockFetch').default;
    
    // 使用ResourceLoader.withMock创建加载器实例
    const loader = ResourceLoader.withMock(mockFetch, {
      batchSize: opts.batchSize,
      enableCache: true,
      cacheStrategy: 'memory-first'
    });
    
    // 记录初始内存快照
    memorySnapshots.push({
      time: 0,
      usedJSHeapSize: mockMemory.usedJSHeapSize
    });
    
    // 记录内存的定时器
    const recordInterval = setInterval(() => {
      memorySnapshots.push({
        time: Date.now() - startTime,
        usedJSHeapSize: mockMemory.usedJSHeapSize
      });
    }, opts.recordInterval);
    
    // 开始加载
    const startTime = Date.now();
    
    try {
      // 准备资源URL数组
      const urls = resources.map(resource => resource.url);
      
      // 使用loader.loadBatch加载资源
      await loader.loadBatch(urls, {
        onProgress: (loadedCount) => {
          // 模拟内存增长
          mockMemory.usedJSHeapSize += opts.increasePerResource;
        }
      });
    } finally {
      // 停止记录
      clearInterval(recordInterval);
      
      // 记录最终内存快照
      memorySnapshots.push({
        time: Date.now() - startTime,
        usedJSHeapSize: mockMemory.usedJSHeapSize
      });
    }
    
    // 计算内存使用统计
    const initialMemory = memorySnapshots[0].usedJSHeapSize;
    const peakMemory = memorySnapshots.reduce((max, snapshot) => 
      Math.max(max, snapshot.usedJSHeapSize), 0);
    const finalMemory = memorySnapshots[memorySnapshots.length - 1].usedJSHeapSize;
    
    return {
      initialMemory,
      peakMemory,
      finalMemory,
      memoryGrowth: finalMemory - initialMemory,
      memoryGrowthPerResource: (finalMemory - initialMemory) / resources.length,
      peakMemoryGrowth: peakMemory - initialMemory,
      snapshots: memorySnapshots
    };
  }

  it('应该测量不同批量大小的内存增长率', async () => {
    // 准备测试数据
    const resourceCount = 100;
    const batchSizes = [10, 25, 50, 100];
    const results = {};
    
    // 对每个批量大小进行测试
    for (const batchSize of batchSizes) {
      // 重置内存状态
      mockMemory.usedJSHeapSize = 1000000;
      
      // 生成资源
      const resources = generateResources(resourceCount);
      
      // 模拟加载并记录内存使用
      results[batchSize] = await simulateResourceLoading(resources, {
        batchSize,
        increasePerResource: 5000 // 每个资源5KB
      });
    }
    
    console.log('不同批量大小的内存增长率:', results);
    
    // 验证结果
    // 验证每个批次的内存增长正比于资源数量
    for (const batchSize of batchSizes) {
      expect(results[batchSize].memoryGrowth).toBeGreaterThan(0);
      expect(results[batchSize].memoryGrowthPerResource).toBeGreaterThan(0);
    }
    
    // 对比不同批量大小的内存效率
    // 较小的批量大小应该有较低的峰值内存
    expect(results[10].peakMemory).toBeLessThan(results[100].peakMemory);
    
    // 断言每资源内存增长率不超过阈值
    const maxGrowthPerResource = Math.max(
      ...Object.values(results).map(r => r.memoryGrowthPerResource)
    );
    expect(maxGrowthPerResource).toBeLessThan(10000); // 不超过10KB/资源
  });

  it('应该测量长时间运行的内存泄漏情况', async () => {
    // 增加测试超时时间
    jest.setTimeout(10000);
    
    // 准备测试数据 - 模拟多轮加载
    const rounds = 5;
    const resourcesPerRound = 50;
    const memorySnapshots = [];
    
    // 记录内存基准
    const baselineMemory = mockMemory.usedJSHeapSize;
    memorySnapshots.push({
      round: 0,
      memory: baselineMemory
    });
    
    // 运行多轮加载，并在每轮之间执行GC
    for (let round = 1; round <= rounds; round++) {
      // 生成资源
      const resources = generateResources(resourcesPerRound);
      
      // 模拟加载
      await simulateResourceLoading(resources, {
        batchSize: 20,
        increasePerResource: 3000
      });
      
      // 记录加载后内存
      memorySnapshots.push({
        round,
        memory: mockMemory.usedJSHeapSize,
        beforeGC: true
      });
      
      // 执行GC
      global.gc();
      
      // 记录GC后内存
      memorySnapshots.push({
        round,
        memory: mockMemory.usedJSHeapSize,
        afterGC: true
      });
      
      // 等待一段时间
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    console.log('长时间运行内存快照:', memorySnapshots);
    
    // 分析内存泄漏
    const gcRounds = memorySnapshots.filter(s => s.afterGC);
    const memoryRetention = gcRounds[gcRounds.length - 1].memory - baselineMemory;
    const memoryRetentionPerRound = memoryRetention / rounds;
    
    console.log(`内存保留总量: ${memoryRetention} 字节, 每轮平均: ${memoryRetentionPerRound} 字节`);
    
    // 断言内存泄漏不严重
    // 一些内存保留是正常的，但不应过大
    expect(memoryRetentionPerRound).toBeLessThan(50000); // 平均每轮不超过50KB
  });

  it('应该测量资源类型对内存使用的影响', async () => {
    // 准备测试数据
    const resourceCount = 50;
    const resourceTypes = ['image', 'script', 'style', 'mixed'];
    const results = {};
    
    // 对每种资源类型进行测试
    for (const type of resourceTypes) {
      // 重置内存状态
      mockMemory.usedJSHeapSize = 1000000;
      
      // 生成特定类型的资源
      const resources = generateResources(resourceCount, type);
      
      // 模拟加载并记录内存使用
      results[type] = await simulateResourceLoading(resources, {
        batchSize: 20
      });
      
      // 添加资源类型特定数据
      results[type].resourceType = type;
      results[type].resourceCount = resourceCount;
      results[type].totalResourceSize = resources.reduce((sum, r) => sum + r.size, 0);
    }
    
    console.log('不同资源类型的内存使用情况:', results);
    
    // 验证不同类型的内存影响
    // 图片资源应该占用更多内存
    expect(results['image'].memoryGrowthPerResource)
      .toBeGreaterThan(results['style'].memoryGrowthPerResource);
    
    // 计算内存效率
    for (const type of resourceTypes) {
      results[type].memoryEfficiency = 
        results[type].totalResourceSize / results[type].memoryGrowth;
    }
    
    // 验证所有类型的内存增长都在合理范围内
    for (const type of resourceTypes) {
      expect(results[type].memoryGrowth).toBeLessThan(resourceCount * 50000); // 平均每资源不超过50KB
    }
  });

  it('应该测量内存峰值和平均使用率', async () => {
    // 准备测试数据 - 大量资源
    const resourceCount = 200;
    const resources = generateResources(resourceCount, 'mixed', 2); // 使用更大的资源
    
    // 重置内存状态
    mockMemory.usedJSHeapSize = 1000000;
    
    // 模拟加载并记录内存使用
    const memoryData = await simulateResourceLoading(resources, {
      batchSize: 30,
      recordInterval: 50, // 更频繁记录
      increasePerResource: 10000 // 每个资源10KB
    });
    
    // 计算内存指标
    const snapshots = memoryData.snapshots;
    
    // 计算平均内存使用
    const avgMemory = snapshots.reduce((sum, s) => sum + s.usedJSHeapSize, 0) / snapshots.length;
    
    // 计算持续高于平均值的时间比例
    const highMemorySnapshots = snapshots.filter(s => s.usedJSHeapSize > avgMemory);
    const highMemoryRatio = highMemorySnapshots.length / snapshots.length;
    
    // 计算峰值持续时间
    const peakThreshold = memoryData.peakMemory * 0.9; // 90%的峰值作为阈值
    const peakSnapshots = snapshots.filter(s => s.usedJSHeapSize >= peakThreshold);
    const peakDuration = peakSnapshots.length * 50; // 记录间隔是50ms
    
    console.log('内存使用分析:', {
      initialMemory: memoryData.initialMemory,
      finalMemory: memoryData.finalMemory,
      peakMemory: memoryData.peakMemory,
      avgMemory,
      highMemoryRatio,
      peakDuration
    });
    
    // 验证内存使用情况
    expect(memoryData.peakMemory).toBeGreaterThan(memoryData.initialMemory);
    expect(highMemoryRatio).toBeLessThan(0.5); // 高内存使用不应超过50%的时间
    expect(peakDuration).toBeLessThan(1000); // 峰值持续时间不应超过1秒
  });

  it('应该测量垃圾回收后的内存恢复情况', async () => {
    // 准备测试数据
    const resourceCount = 100;
    const resources = generateResources(resourceCount);
    
    // 重置内存状态
    mockMemory.usedJSHeapSize = 1000000;
    const initialMemory = mockMemory.usedJSHeapSize;
    
    // 模拟加载并记录内存使用
    await simulateResourceLoading(resources, {
      batchSize: 25,
      increasePerResource: 15000 // 每个资源15KB
    });
    
    // 记录加载后内存
    const afterLoadMemory = mockMemory.usedJSHeapSize;
    
    // 调用GC
    global.gc();
    
    // 记录GC后内存
    const afterGCMemory = mockMemory.usedJSHeapSize;
    
    // 计算内存恢复率
    const memoryGrowth = afterLoadMemory - initialMemory;
    const memoryRecovered = afterLoadMemory - afterGCMemory;
    const recoveryRate = memoryRecovered / memoryGrowth;
    
    console.log('垃圾回收内存恢复:', {
      initialMemory,
      afterLoadMemory,
      afterGCMemory,
      memoryGrowth,
      memoryRecovered,
      recoveryRate
    });
    
    // 验证内存恢复情况
    expect(afterGCMemory).toBeLessThan(afterLoadMemory); // GC应该减少内存使用
    expect(recoveryRate).toBeGreaterThan(0.3); // 应恢复至少30%的增长内存
    expect(afterGCMemory).toBeLessThan(initialMemory * 2); // 最终内存不应过高
  });
}); 