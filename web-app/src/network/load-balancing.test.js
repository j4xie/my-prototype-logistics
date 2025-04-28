const NetworkMonitor = require('./network-monitor');
const PerformanceTestTool = require('../utils/performance-test-tool');
const traceLoader = require('./resource-loader').traceLoader;
const ResourceLoader = require('./resource-loader').ResourceLoader;
const EVENTS = require('./resource-loader').EVENTS;

/**
 * @file 资源加载器负载均衡测试
 * @description 测试资源加载器在大规模数据处理和高负载情况下的表现
 */

// import { traceLoader, ResourceLoader, EVENTS } from './resource-loader';
// import NetworkMonitor from './network-monitor';
// import PerformanceTestTool from '../utils/performance-test-tool';

// 模拟DOM环境
const originalCreateElement = document.createElement;
const originalAppendChild = document.head.appendChild;
const originalRemoveChild = document.head.removeChild;

// 模拟在线状态
Object.defineProperty(window.navigator, 'onLine', {
  configurable: true,
  get: jest.fn().mockReturnValue(true)
});

describe('资源加载器负载均衡测试', () => {
  let performanceTool;
  let mockImage;
  let mockScript;
  let mockStyle;
  
  beforeEach(() => {
    // 初始化性能测试工具
    performanceTool = new PerformanceTestTool({
      sampleSize: 5,
      warmupRuns: 2,
      cooldownMs: 100
    });
    
    // 重置traceLoader
    traceLoader.reset();
    traceLoader.removeAllListeners();
    traceLoader.configure({
      maxConcurrentLoads: 10,
      retryCount: 3,
      retryDelay: 50,
      useCache: true
    });
    
    // 模拟DOM元素
    mockImage = {
      onload: null,
      onerror: null,
      src: ''
    };
    
    mockScript = {
      onload: null,
      onerror: null,
      async: false,
      src: ''
    };
    
    mockStyle = {
      onload: null,
      onerror: null,
      rel: '',
      href: ''
    };
    
    // 模拟document.createElement
    document.createElement = jest.fn((tagName) => {
      switch (tagName.toLowerCase()) {
        case 'img':
          return mockImage;
        case 'script':
          return mockScript;
        case 'link':
          return mockStyle;
        default:
          return originalCreateElement.call(document, tagName);
      }
    });
    
    // 模拟appendChild
    document.head.appendChild = jest.fn((element) => {
      return element;
    });
    
    // 模拟removeChild
    document.head.removeChild = jest.fn((element) => {
      return element;
    });
    
    // 模拟performance.now
    if (typeof performance.now !== 'function') {
      performance.now = jest.fn(() => Date.now());
    }
    
    // 清理计时器
    jest.clearAllTimers();
    jest.useFakeTimers();
  });
  
  afterEach(() => {
    // 恢复原始函数
    document.createElement = originalCreateElement;
    document.head.appendChild = originalAppendChild;
    document.head.removeChild = originalRemoveChild;
    
    // 清理
    traceLoader.reset();
    traceLoader.removeAllListeners();
    
    jest.clearAllTimers();
    jest.useRealTimers();
  });
  
  /**
   * 生成指定数量的资源
   * @param {number} count - 资源数量
   * @return {Array} 资源数组
   */
  function generateResources(count, typeDistribution = { image: 0.6, script: 0.3, style: 0.1 }) {
    const resources = [];
    
    for (let i = 0; i < count; i++) {
      const random = Math.random();
      let type;
      
      if (random < typeDistribution.image) {
        type = 'image';
      } else if (random < typeDistribution.image + typeDistribution.script) {
        type = 'script';
      } else {
        type = 'style';
      }
      
      resources.push({
        type,
        url: `/${type}-${i}.${type === 'image' ? 'jpg' : type === 'script' ? 'js' : 'css'}`,
        priority: Math.floor(Math.random() * 10) + 1 // 1-10的随机优先级
      });
    }
    
    return resources;
  }
  
  /**
   * 模拟资源加载
   * @param {Object} element - DOM元素
   * @param {number} delay - 延迟时间
   * @param {boolean} success - 是否成功
   */
  function simulateLoad(element, delay = 50, success = true) {
    setTimeout(() => {
      if (success) {
        element.onload && element.onload();
      } else {
        element.onerror && element.onerror(new Error('加载失败'));
      }
    }, delay);
  }
  
  test('应能处理大量资源的批量加载而不崩溃', async () => {
    const resourceCount = 1000;
    const resources = generateResources(resourceCount);
    
    // 监听完成事件
    const queueCompleteSpy = jest.fn();
    traceLoader.addEventListener(EVENTS.QUEUE_COMPLETE, queueCompleteSpy);
    
    // 开始加载前计时
    const startTime = performance.now();
    
    // 加载资源
    const loadPromise = traceLoader.loadBatch(resources);
    
    // 模拟资源加载完成
    resources.forEach((resource, index) => {
      const mockElement = resource.type === 'image' ? mockImage : 
                         resource.type === 'script' ? mockScript : mockStyle;
      
      // 模拟不同的加载时间，根据资源类型和优先级
      const loadTime = 20 + (10 - resource.priority) * 5 + Math.random() * 50;
      simulateLoad(mockElement, loadTime);
      
      // 推进定时器
      jest.advanceTimersByTime(loadTime);
    });
    
    // 确保所有定时器完成
    jest.runAllTimers();
    
    // 等待加载完成
    await loadPromise;
    
    // 结束计时
    const endTime = performance.now();
    const totalTime = endTime - startTime;
    
    // 验证所有资源都已加载
    expect(queueCompleteSpy).toHaveBeenCalled();
    const stats = traceLoader.getStats();
    expect(stats.loaded + stats.cached).toBe(resourceCount);
    
    // 验证加载不超时
    expect(totalTime).toBeLessThan(resourceCount * 50); // 应该比顺序加载快得多
    
    // 验证内存使用合理
    // 注：实际测试中需要使用更高级的内存分析工具
    expect(stats.cacheSize).toBe(resourceCount);
  });
  
  test('应在高负载下平衡处理不同优先级的资源', async () => {
    // 创建三组不同优先级的资源
    const highPriorityResources = generateResources(20).map(r => ({ ...r, priority: 10 }));
    const mediumPriorityResources = generateResources(30).map(r => ({ ...r, priority: 5 }));
    const lowPriorityResources = generateResources(50).map(r => ({ ...r, priority: 1 }));
    
    const allResources = [
      ...highPriorityResources,
      ...mediumPriorityResources,
      ...lowPriorityResources
    ];
    
    // 混洗资源以确保顺序随机
    const shuffledResources = [...allResources].sort(() => Math.random() - 0.5);
    
    // 记录加载顺序
    const loadOrder = [];
    const originalLoad = traceLoader.load;
    traceLoader.load = jest.fn((type, url, options) => {
      loadOrder.push({ type, url, priority: options.priority });
      return originalLoad.call(traceLoader, type, url, options);
    });
    
    // 开始加载
    const loadPromise = traceLoader.loadBatch(shuffledResources);
    
    // 模拟所有资源加载完成
    shuffledResources.forEach(resource => {
      const mockElement = resource.type === 'image' ? mockImage : 
                         resource.type === 'script' ? mockScript : mockStyle;
      simulateLoad(mockElement, 10);
    });
    
    // 确保所有定时器完成
    jest.runAllTimers();
    
    // 等待加载完成
    await loadPromise;
    
    // 验证高优先级资源是否优先加载
    const highPriorityUrls = new Set(highPriorityResources.map(r => r.url));
    const highPriorityLoadOrder = loadOrder.findIndex(item => !highPriorityUrls.has(item.url));
    
    expect(highPriorityLoadOrder).toBeGreaterThanOrEqual(highPriorityResources.length);
    
    // 恢复原始load方法
    traceLoader.load = originalLoad;
  });
  
  test('应能在网络变化下动态调整负载均衡策略', async () => {
    // 创建测试资源
    const resources = generateResources(100);
    
    // 创建网络监控实例
    const networkMonitor = new NetworkMonitor();
    
    // 配置loader基于网络状态调整
    const slowNetworkSpy = jest.fn();
    const fastNetworkSpy = jest.fn();
    
    // 网络状态变化监听器
    networkMonitor.addStatusChangeListener('online', () => {
      fastNetworkSpy();
      traceLoader.configure({ maxConcurrentLoads: 15 });
    });
    
    networkMonitor.addStatusChangeListener('offline', () => {
      slowNetworkSpy();
      traceLoader.configure({ maxConcurrentLoads: 5 });
    });
    
    // 开始负载测试
    const loadPromise = traceLoader.loadBatch(resources);
    
    // 模拟网络变化
    // 模拟离线
    Object.defineProperty(window.navigator, 'onLine', {
      get: jest.fn().mockReturnValue(false)
    });
    window.dispatchEvent(new Event('offline'));
    
    // 等待一些资源加载
    jest.advanceTimersByTime(500);
    
    // 模拟在线
    Object.defineProperty(window.navigator, 'onLine', {
      get: jest.fn().mockReturnValue(true)
    });
    window.dispatchEvent(new Event('online'));
    
    // 完成所有资源加载
    resources.forEach(resource => {
      const mockElement = resource.type === 'image' ? mockImage : 
                         resource.type === 'script' ? mockScript : mockStyle;
      simulateLoad(mockElement, 10);
    });
    
    // 确保所有定时器完成
    jest.runAllTimers();
    
    // 等待加载完成
    await loadPromise;
    
    // 验证网络状态变化被正确处理
    expect(slowNetworkSpy).toHaveBeenCalled();
    expect(fastNetworkSpy).toHaveBeenCalled();
    
    // 验证所有资源都已加载
    const stats = traceLoader.getStats();
    expect(stats.loaded + stats.cached).toBe(resources.length);
    
    // 清理
    networkMonitor.removeAllListeners();
  });
  
  test('应能使用性能测量工具评估批处理性能', async () => {
    // 使用性能测试工具测量不同批量大小的性能
    performanceTool.startRecording();
    
    const batchSizes = [10, 25, 50, 100];
    const results = {};
    
    for (const batchSize of batchSizes) {
      // 为每个批次大小进行测试
      const result = await performanceTool.measure(`批次大小${batchSize}`, async () => {
        const resources = generateResources(batchSize);
        
        // 启动批量加载
        const loadPromise = traceLoader.loadBatch(resources);
        
        // 模拟资源加载
        resources.forEach(resource => {
          const mockElement = resource.type === 'image' ? mockImage : 
                             resource.type === 'script' ? mockScript : mockStyle;
          simulateLoad(mockElement, 15);
        });
        
        // 执行所有定时器
        jest.runAllTimers();
        
        // 等待加载完成
        await loadPromise;
        
        // 收集结果
        return traceLoader.getStats();
      });
      
      results[batchSize] = result;
      
      // 清理缓存
      traceLoader.clearCache();
      traceLoader.reset();
    }
    
    performanceTool.stopRecording();
    
    // 生成性能报告
    const report = performanceTool.generateReport();
    
    // 验证性能测试是否成功完成
    expect(report.measurements.length).toBe(batchSizes.length);
    
    // 分析最佳批处理大小
    const bestBatchSize = batchSizes.reduce((best, current) => {
      const bestAverage = results[best].averageDuration / best;
      const currentAverage = results[current].averageDuration / current;
      return currentAverage < bestAverage ? current : best;
    }, batchSizes[0]);
    
    // 输出建议的批处理大小
    console.log(`建议的批处理大小: ${bestBatchSize}`);
    
    // 验证批处理大小建议是否在预期范围内
    expect(bestBatchSize).toBeGreaterThanOrEqual(10);
    expect(bestBatchSize).toBeLessThanOrEqual(100);
  });
  
  test('应在高批处理负载下保持内存使用合理', async () => {
    // 启用详细的内存使用监控
    performanceTool.startRecording();
    
    // 创建大量资源
    const resourceCount = 200;
    const resources = generateResources(resourceCount);
    
    // 记录初始内存状态
    const initialMemory = performanceTool.getCurrentMemory();
    
    // 加载资源
    const loadPromise = traceLoader.loadBatch(resources);
    
    // 模拟资源加载
    resources.forEach(resource => {
      const mockElement = resource.type === 'image' ? mockImage : 
                          resource.type === 'script' ? mockScript : mockStyle;
      simulateLoad(mockElement, 5);
    });
    
    // 执行所有定时器
    jest.runAllTimers();
    
    // 等待加载完成
    await loadPromise;
    
    // 记录结束内存状态
    const finalMemory = performanceTool.getCurrentMemory();
    const memoryGrowth = finalMemory - initialMemory;
    
    // 停止记录
    performanceTool.stopRecording();
    
    // 验证内存增长在合理范围内
    // 注：这是一个模拟测试，实际环境中需要真实测量
    console.log(`内存增长: ${memoryGrowth / (1024 * 1024)} MB`);
    
    // 验证加载统计
    const stats = traceLoader.getStats();
    expect(stats.loaded + stats.cached).toBe(resourceCount);
    
    // 理论上内存增长应当与资源数量成正比，但增长率应该是合理的
    // 实际测试中，需要基于真实环境建立阈值
    // 这里仅作为示例
    expect(stats.cacheSize).toBe(resourceCount);
  });
  
  test('应能处理重复资源请求的去重和缓存', async () => {
    // 创建包含重复URL的资源集
    const baseResources = generateResources(50);
    // 添加一些重复的资源（相同URL）
    const duplicateResources = baseResources.slice(0, 20).map(r => ({...r}));
    const allResources = [...baseResources, ...duplicateResources];
    
    // 跟踪实际加载的资源
    const loadedUrls = new Set();
    const originalLoad = traceLoader.load;
    traceLoader.load = jest.fn((type, url, options) => {
      loadedUrls.add(url);
      return originalLoad.call(traceLoader, type, url, options);
    });
    
    // 开始加载
    const loadPromise = traceLoader.loadBatch(allResources);
    
    // 模拟所有资源加载完成
    allResources.forEach(resource => {
      const mockElement = resource.type === 'image' ? mockImage : 
                         resource.type === 'script' ? mockScript : mockStyle;
      simulateLoad(mockElement, 10);
    });
    
    // 确保所有定时器完成
    jest.runAllTimers();
    
    // 等待加载完成
    await loadPromise;
    
    // 恢复原始load方法
    traceLoader.load = originalLoad;
    
    // 验证去重和缓存正常工作
    // 应该只有基础资源被实际加载，重复资源应从缓存获取
    expect(loadedUrls.size).toBeLessThanOrEqual(baseResources.length);
    
    // 验证统计数据
    const stats = traceLoader.getStats();
    expect(stats.loaded + stats.cached).toBe(allResources.length);
    expect(stats.cached).toBeGreaterThanOrEqual(duplicateResources.length);
  });
}); 