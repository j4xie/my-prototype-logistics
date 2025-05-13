const ResourceLoader = require('./resource-loader');
const NetworkMonitor = require('./network-monitor');
const PerformanceTestTool = require('../utils/performance-test-tool');

/**
 * @file 资源加载器优化测试
 * @description 测试资源加载器优化功能，包括内存管理优化、批处理大小自适应调整和优先级排序优化
 */

// import ResourceLoader from './resource-loader';
// import NetworkMonitor from './network-monitor';
// import PerformanceTestTool from '../utils/performance-test-tool';

jest.mock('./network-monitor');

describe('资源加载器优化', () => {
  let resourceLoader;
  let networkMonitor;
  let performanceTestTool;
  
  beforeEach(() => {
    // 重置所有模拟
    jest.clearAllMocks();
    
    // 初始化网络监视器模拟
    networkMonitor = new NetworkMonitor();
    networkMonitor.getNetworkStatus.mockReturnValue({
      type: '4g',
      downlink: 10,
      rtt: 50,
      effectiveBandwidth: 5000
    });
    
    // 初始化资源加载器
    resourceLoader = new ResourceLoader({
      networkMonitor,
      maxConcurrent: 10,
      defaultBatchSize: 20,
      retryAttempts: 3,
      cacheEnabled: true
    });
    
    // 初始化性能测试工具
    performanceTestTool = new PerformanceTestTool();
  });
  
  afterEach(() => {
    resourceLoader = null;
    networkMonitor = null;
    performanceTestTool = null;
  });
  
  // 生成测试资源
  const generateResources = (count, priority = 1) => {
    return Array.from({ length: count }, (_, i) => ({
      id: `resource-${i}`,
      url: `https://example.com/resource/${i}.json`,
      type: 'json',
      priority: priority,
      size: 1024 * (i % 10 + 1) // 1KB 到 10KB 的随机大小
    }));
  };
  
  /**
   * 内存管理测试
   */
  describe('内存管理优化', () => {
    test('大量资源加载时内存使用应控制在合理范围内', async () => {
      // 安排
      const resources = generateResources(500);
      const memoryBefore = performanceTestTool.getMemoryUsage();
      
      // 执行
      await resourceLoader.loadBatch(resources);
      
      // 断言
      const memoryAfter = performanceTestTool.getMemoryUsage();
      const memoryGrowth = memoryAfter - memoryBefore;
      
      // 内存增长应该低于50MB
      expect(memoryGrowth).toBeLessThan(50 * 1024 * 1024);
    });
    
    test('资源加载完成后应释放临时内存', async () => {
      // 安排
      const resources = generateResources(100);
      
      // 执行
      await resourceLoader.loadBatch(resources);
      
      // 手动触发垃圾回收以确保准确测量
      if (global.gc) {
        global.gc();
      }
      
      const memoryBefore = performanceTestTool.getMemoryUsage();
      
      // 触发资源加载器内部清理
      resourceLoader.cleanupCache();
      
      // 再次触发垃圾回收
      if (global.gc) {
        global.gc();
      }
      
      // 断言
      const memoryAfter = performanceTestTool.getMemoryUsage();
      expect(memoryAfter).toBeLessThanOrEqual(memoryBefore);
    });
    
    test('重复加载相同资源应当复用内存', async () => {
      // 安排
      const resources = generateResources(50);
      
      // 第一次加载
      await resourceLoader.loadBatch(resources);
      const memoryAfterFirstLoad = performanceTestTool.getMemoryUsage();
      
      // 第二次加载相同资源
      await resourceLoader.loadBatch(resources);
      const memoryAfterSecondLoad = performanceTestTool.getMemoryUsage();
      
      // 断言 - 第二次加载不应显著增加内存使用
      const memoryDiff = memoryAfterSecondLoad - memoryAfterFirstLoad;
      expect(memoryDiff).toBeLessThan(5 * 1024 * 1024); // 不超过5MB
    });
  });
  
  /**
   * 自适应批处理测试
   */
  describe('自适应批处理优化', () => {
    test('网络状况良好时应增加批处理大小', async () => {
      // 安排 - 设置良好网络条件
      networkMonitor.getNetworkStatus.mockReturnValue({
        type: '4g',
        downlink: 20,
        rtt: 30,
        effectiveBandwidth: 10000
      });
      
      const resources = generateResources(100);
      const initialBatchSize = resourceLoader.getBatchSize();
      
      // 执行
      await resourceLoader.loadBatchWithAdaptiveSize(resources);
      
      // 断言
      const newBatchSize = resourceLoader.getBatchSize();
      expect(newBatchSize).toBeGreaterThan(initialBatchSize);
    });
    
    test('网络状况较差时应减少批处理大小', async () => {
      // 安排 - 设置较差网络条件
      networkMonitor.getNetworkStatus.mockReturnValue({
        type: '2g',
        downlink: 0.5,
        rtt: 500,
        effectiveBandwidth: 250
      });
      
      const resources = generateResources(100);
      const initialBatchSize = resourceLoader.getBatchSize();
      
      // 执行
      await resourceLoader.loadBatchWithAdaptiveSize(resources);
      
      // 断言
      const newBatchSize = resourceLoader.getBatchSize();
      expect(newBatchSize).toBeLessThan(initialBatchSize);
    });
    
    test('应基于资源大小调整批处理大小', async () => {
      // 安排 - 创建大小各异的资源
      const smallResources = Array.from({ length: 50 }, (_, i) => ({
        id: `small-${i}`,
        url: `https://example.com/small/${i}.json`,
        type: 'json',
        priority: 1,
        size: 512 // 0.5KB
      }));
      
      const largeResources = Array.from({ length: 50 }, (_, i) => ({
        id: `large-${i}`,
        url: `https://example.com/large/${i}.json`,
        type: 'json',
        priority: 1,
        size: 1024 * 100 // 100KB
      }));
      
      // 获取初始批处理大小
      const initialBatchSize = resourceLoader.getBatchSize();
      
      // 执行 - 加载小资源
      await resourceLoader.loadBatchWithAdaptiveSize(smallResources);
      const batchSizeAfterSmall = resourceLoader.getBatchSize();
      
      // 重置
      resourceLoader.resetBatchSize();
      
      // 执行 - 加载大资源
      await resourceLoader.loadBatchWithAdaptiveSize(largeResources);
      const batchSizeAfterLarge = resourceLoader.getBatchSize();
      
      // 断言
      expect(batchSizeAfterSmall).toBeGreaterThan(initialBatchSize);
      expect(batchSizeAfterLarge).toBeLessThan(initialBatchSize);
      expect(batchSizeAfterSmall).toBeGreaterThan(batchSizeAfterLarge);
    });
  });
  
  /**
   * 优先级排序优化测试
   */
  describe('优先级排序优化', () => {
    test('高优先级资源应优先加载', async () => {
      // 安排 - 创建混合优先级资源
      const lowPriorityResources = generateResources(20, 1);
      const mediumPriorityResources = generateResources(20, 5);
      const highPriorityResources = generateResources(20, 10);
      
      // 合并并打乱顺序
      const allResources = [
        ...lowPriorityResources,
        ...mediumPriorityResources,
        ...highPriorityResources
      ].sort(() => Math.random() - 0.5);
      
      // 模拟加载顺序追踪
      const loadOrder = [];
      resourceLoader.loadResource = jest.fn().mockImplementation(async (resource) => {
        loadOrder.push(resource.priority);
        return { success: true, resource };
      });
      
      // 执行
      await resourceLoader.loadBatchWithPriority(allResources);
      
      // 断言 - 检查前20个加载的资源应该都是高优先级的
      const first20Loaded = loadOrder.slice(0, 20);
      expect(first20Loaded.every(priority => priority === 10)).toBeTruthy();
      
      // 接下来的20个应该是中优先级的
      const next20Loaded = loadOrder.slice(20, 40);
      expect(next20Loaded.every(priority => priority === 5)).toBeTruthy();
    });
    
    test('相同优先级的资源应按资源大小从小到大加载', async () => {
      // 安排 - 创建相同优先级但不同大小的资源
      const resources = Array.from({ length: 50 }, (_, i) => ({
        id: `resource-${i}`,
        url: `https://example.com/resource/${i}.json`,
        type: 'json',
        priority: 5, // 所有资源相同优先级
        size: 1024 * (50 - i) // 大小从大到小排列
      }));
      
      // 模拟加载顺序追踪
      const loadOrder = [];
      resourceLoader.loadResource = jest.fn().mockImplementation(async (resource) => {
        loadOrder.push(resource.size);
        return { success: true, resource };
      });
      
      // 执行
      await resourceLoader.loadBatchWithSmartPriority(resources);
      
      // 断言 - 加载顺序应该是按大小从小到大
      for (let i = 0; i < loadOrder.length - 1; i++) {
        expect(loadOrder[i]).toBeLessThanOrEqual(loadOrder[i+1]);
      }
    });
    
    test('优先级排序应该考虑资源类型和页面可见性', async () => {
      // 安排 - 模拟不同类型的资源
      const visibleResources = Array.from({ length: 20 }, (_, i) => ({
        id: `visible-${i}`,
        url: `https://example.com/visible/${i}.json`,
        type: 'json',
        priority: 5,
        size: 1024,
        isVisible: true // 在视口内可见
      }));
      
      const hiddenResources = Array.from({ length: 20 }, (_, i) => ({
        id: `hidden-${i}`,
        url: `https://example.com/hidden/${i}.json`,
        type: 'json',
        priority: 5,
        size: 1024,
        isVisible: false // 在视口外不可见
      }));
      
      // 合并并打乱顺序
      const allResources = [
        ...visibleResources,
        ...hiddenResources
      ].sort(() => Math.random() - 0.5);
      
      // 模拟加载顺序追踪
      const loadOrder = [];
      resourceLoader.loadResource = jest.fn().mockImplementation(async (resource) => {
        loadOrder.push(resource.isVisible);
        return { success: true, resource };
      });
      
      // 执行
      await resourceLoader.loadBatchWithVisibilityPriority(allResources);
      
      // 断言 - 可见资源应该优先加载
      const first20Loaded = loadOrder.slice(0, 20);
      expect(first20Loaded.every(isVisible => isVisible === true)).toBeTruthy();
    });
  });
}); 