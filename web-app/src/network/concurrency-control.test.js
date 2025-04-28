const DevicePerformanceDetector = require('./concurrency-optimizer').DevicePerformanceDetector;
const NetworkBandwidthDetector = require('./concurrency-optimizer').NetworkBandwidthDetector;
const ConcurrencyController = require('./concurrency-optimizer').ConcurrencyController;
const PriorityFactorCalculator = require('./concurrency-optimizer').PriorityFactorCalculator;
const ConcurrencyABTest = require('./ab-test-framework').ConcurrencyABTest;
const PredefinedStrategies = require('./ab-test-framework').PredefinedStrategies;

/**
 * @file 并发控制优化测试
 * @description 测试并发控制优化模块的功能
 */

// import {
  DevicePerformanceDetector,
  NetworkBandwidthDetector,
  ConcurrencyController,
  PriorityFactorCalculator
} from './concurrency-optimizer';

// import { ConcurrencyABTest, PredefinedStrategies } from './ab-test-framework';

// 模拟全局对象
global.navigator = global.navigator || {};
global.performance = global.performance || {};
global.localStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn()
};

describe('并发控制优化', () => {
  describe('设备性能检测', () => {
    beforeEach(() => {
      // 模拟navigator对象
      global.navigator.userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36';
      global.navigator.hardwareConcurrency = 8;
      global.navigator.deviceMemory = 8;
      
      // 模拟performance.memory
      global.performance.memory = {
        jsHeapSizeLimit: 2147483648, // 2GB
        totalJSHeapSize: 1073741824, // 1GB
        usedJSHeapSize: 536870912    // 512MB
      };
      
      global.performance.now = jest.fn()
        .mockReturnValueOnce(1000)   // 开始时间
        .mockReturnValueOnce(1500);  // 结束时间
      
      // 模拟电池API
      global.navigator.getBattery = jest.fn().mockReturnValue(
        Promise.resolve({
          level:.7,
          charging: true,
          addEventListener: jest.fn()
        })
      );
    });
    
    test('应该能检测设备类型和性能', async () => {
      const detector = new DevicePerformanceDetector();
      
      // 等待异步操作完成
      await new Promise(resolve => setTimeout(resolve, 0));
      
      // 验证设备类型检测
      expect(detector.metrics.deviceType).toBe('desktop');
      
      // 验证性能评分
      expect(detector.metrics.cpuScore).toBeGreaterThan(0);
      expect(detector.metrics.memoryScore).toBeGreaterThan(0);
      
      // 验证推荐并发数
      const concurrency = detector.getRecommendedConcurrency();
      expect(concurrency).toBeGreaterThanOrEqual(2);
      expect(concurrency).toBeLessThanOrEqual(16);
    });
    
    test('应该根据设备类型调整并发数', async () => {
      // 桌面设备测试
      global.navigator.userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';
      let detector = new DevicePerformanceDetector();
      await new Promise(resolve => setTimeout(resolve, 0));
      const desktopConcurrency = detector.getRecommendedConcurrency();
      
      // 移动设备测试
      global.navigator.userAgent = 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_4 like Mac OS X) AppleWebKit/605.1.15';
      detector = new DevicePerformanceDetector();
      await new Promise(resolve => setTimeout(resolve, 0));
      const mobileConcurrency = detector.getRecommendedConcurrency();
      
      // 移动设备应该有更低的并发数
      expect(mobileConcurrency).toBeLessThan(desktopConcurrency);
    });
  });
  
  describe('网络带宽检测', () => {
    beforeEach(() => {
      // 模拟navigator.connection
      global.navigator.connection = {
        effectiveType: '4g',
        downlink: 10,
        rtt: 50,
        addEventListener: jest.fn()
      };
      
      // 模拟fetch API
      global.fetch = jest.fn().mockImplementation(() => 
        Promise.resolve({
          ok: true,
          arrayBuffer: () => Promise.resolve(new ArrayBuffer(1024 * 10))
        })
      );
      
      global.AbortSignal = {
        timeout: jest.fn().mockReturnValue({})
      };
      
      global.performance.now = jest.fn()
        .mockReturnValueOnce(1000)   // 第一次调用的返回值
        .mockReturnValueOnce(1200);  // 第二次调用的返回值
    });
    
    test('应该能获取网络指标', () => {
      const detector = new NetworkBandwidthDetector();
      const metrics = detector.getNetworkMetrics();
      
      expect(metrics.effectiveType).toBe('4g');
      expect(metrics.downlink).toBe(10);
      expect(metrics.rtt).toBe(50);
    });
    
    test('应该能推荐适当的并发数', () => {
      const detector = new NetworkBandwidthDetector();
      
      // 4G网络测试
      global.navigator.connection.effectiveType = '4g';
      global.navigator.connection.downlink = 10;
      let concurrency = detector.getRecommendedConcurrency();
      expect(concurrency).toBeGreaterThanOrEqual(8);
      
      // 3G网络测试
      global.navigator.connection.effectiveType = '3g';
      global.navigator.connection.downlink = 2;
      concurrency = detector.getRecommendedConcurrency();
      expect(concurrency).toBeLessThan(8);
      expect(concurrency).toBeGreaterThanOrEqual(3);
      
      // 2G网络测试
      global.navigator.connection.effectiveType = '2g';
      global.navigator.connection.downlink = 0.5;
      concurrency = detector.getRecommendedConcurrency();
      expect(concurrency).toBeLessThanOrEqual(3);
    });
    
    test('应该能测量带宽', async () => {
      const detector = new NetworkBandwidthDetector({
        probeURL: '/test-pixel.gif',
        probeSizes: [1]
      });
      
      const result = await detector.measureBandwidth();
      
      expect(result).not.toBeNull();
      expect(result.bandwidthMbps).toBeGreaterThan(0);
      expect(result.measurements.length).toBeGreaterThan(0);
    });
  });
  
  describe('并发控制器', () => {
    let controller;
    
    beforeEach(() => {
      // 模拟全局对象
      global.navigator.hardwareConcurrency = 8;
      global.navigator.deviceMemory = 8;
      global.navigator.userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';
      
      global.navigator.connection = {
        effectiveType: '4g',
        downlink: 10,
        rtt: 50,
        addEventListener: jest.fn()
      };
      
      global.performance.memory = {
        jsHeapSizeLimit: 2147483648,
        totalJSHeapSize: 1073741824,
        usedJSHeapSize: 536870912
      };
      
      global.navigator.getBattery = jest.fn().mockReturnValue(
        Promise.resolve({
          level: .7,
          charging: true,
          addEventListener: jest.fn()
        })
      );
      
      global.AbortSignal = {
        timeout: jest.fn().mockReturnValue({})
      };
      
      global.fetch = jest.fn().mockImplementation(() => 
        Promise.resolve({
          ok: true,
          arrayBuffer: () => Promise.resolve(new ArrayBuffer(1024 * 10))
        })
      );
      
      controller = new ConcurrencyController({
        updateInterval: 100,
        defaultConcurrency: 8
      });
    });
    
    afterEach(() => {
      controller.cleanup();
    });
    
    test('应该能获取并发设置', async () => {
      // 等待初始化完成
      await new Promise(resolve => setTimeout(resolve, 200));
      
      const concurrency = controller.getRecommendedConcurrency();
      expect(concurrency).toBeGreaterThanOrEqual(2);
      expect(concurrency).toBeLessThanOrEqual(16);
    });
    
    test('应该能记录性能结果', async () => {
      await new Promise(resolve => setTimeout(resolve, 200));
      
      controller.recordPerformanceResult({
        loadTime: 500,
        successRate: 0.95,
        resourceCount: 20
      });
      
      // 记录更多数据
      controller.recordPerformanceResult({
        loadTime: 450,
        successRate: 0.98,
        resourceCount: 20
      });
      
      // 验证性能历史记录
      expect(controller.metrics.performanceHistory.length).toBe(2);
    });
    
    test('应该根据性能历史调整并发数', async () => {
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // 记录良好的性能
      for (let i = 0; i < 5; i++) {
        controller.recordPerformanceResult({
          loadTime: 300,
          successRate: 0.99,
          resourceCount: 20
        });
      }
      
      const originalConcurrency = controller.metrics.currentConcurrency;
      
      // 触发更新
      controller.updateConcurrencySettings();
      
      // 由于性能良好，应该会尝试增加并发数
      expect(controller.metrics.currentConcurrency).toBeGreaterThanOrEqual(originalConcurrency);
      
      // 记录糟糕的性能
      for (let i = 0; i < 5; i++) {
        controller.recordPerformanceResult({
          loadTime: 1500,
          successRate: 0.7,
          resourceCount: 20
        });
      }
      
      const currentConcurrency = controller.metrics.currentConcurrency;
      
      // 触发更新
      controller.updateConcurrencySettings();
      
      // 由于性能不佳，应该会减少并发数
      expect(controller.metrics.currentConcurrency).toBeLessThanOrEqual(currentConcurrency);
    });
  });
  
  describe('优先级因子计算器', () => {
    let calculator;
    
    beforeEach(() => {
      calculator = new PriorityFactorCalculator();
    });
    
    test('应该能计算优先级因子', () => {
      // 测试不同类型资源的优先级
      const scriptPriority = calculator.calculatePriorityFactor({ 
        type: 'script', 
        url: 'https://example.com/script.js' 
      });
      
      const imagePriority = calculator.calculatePriorityFactor({ 
        type: 'image', 
        url: 'https://example.com/image.png' 
      });
      
      const stylePriority = calculator.calculatePriorityFactor({ 
        type: 'style', 
        url: 'https://example.com/style.css' 
      });
      
      // 脚本和样式应该比图片优先级高
      expect(scriptPriority).toBeGreaterThan(imagePriority);
      expect(stylePriority).toBeGreaterThan(imagePriority);
    });
    
    test('应该考虑可视区域因素', () => {
      const inViewportPriority = calculator.calculatePriorityFactor({ 
        type: 'image', 
        url: 'https://example.com/image1.png' 
      }, { inViewport: true });
      
      const outOfViewportPriority = calculator.calculatePriorityFactor({ 
        type: 'image', 
        url: 'https://example.com/image2.png' 
      }, { inViewport: false });
      
      // 视口内的资源应该优先级更高
      expect(inViewportPriority).toBeGreaterThan(outOfViewportPriority);
    });
    
    test('应该记录和使用资源使用历史', () => {
      // 记录资源使用
      calculator.recordResourceUsage(
        'https://example.com/frequently-used.js',
        'script',
        { loadTime: 100 }
      );
      
      // 多次记录同一资源
      for (let i = 0; i < 5; i++) {
        calculator.recordResourceUsage(
          'https://example.com/frequently-used.js',
          'script',
          { loadTime: 100 }
        );
      }
      
      // 记录一个新资源
      calculator.recordResourceUsage(
        'https://example.com/rarely-used.js',
        'script',
        { loadTime: 100 }
      );
      
      // 计算优先级
      const frequentlyUsedPriority = calculator.calculatePriorityFactor({ 
        type: 'script', 
        url: 'https://example.com/frequently-used.js' 
      });
      
      const rarelyUsedPriority = calculator.calculatePriorityFactor({ 
        type: 'script', 
        url: 'https://example.com/rarely-used.js' 
      });
      
      // 频繁使用的资源应该有更高的优先级
      expect(frequentlyUsedPriority).toBeGreaterThan(rarelyUsedPriority);
    });
    
    test('应该记录和使用导航模式', () => {
      const currentPage = 'https://example.com/page1';
      const nextPage = 'https://example.com/page2';
      const resource = 'https://example.com/page2-resource.js';
      
      // 记录导航模式
      calculator.recordNavigation(currentPage, nextPage);
      calculator.recordNavigation(currentPage, nextPage);
      calculator.recordNavigation(currentPage, 'https://example.com/other');
      
      // 记录资源使用
      calculator.recordResourceUsage(resource, 'script', { loadTime: 100 });
      
      // 将资源与页面关联
      calculator.recordResourceUsage(resource, 'script', { loadTime: 100 });
      
      // 优先级应该受到导航模式的影响
      const priority = calculator.calculatePriorityFactor(
        { type: 'script', url: resource },
        { pageUrl: currentPage }
      );
      
      // 检查优先级是否在合理范围内
      expect(priority).toBeGreaterThanOrEqual(0);
      expect(priority).toBeLessThanOrEqual(1);
    });
  });
  
  describe('A/B测试框架', () => {
    let abTest;
    
    beforeEach(() => {
      localStorage.getItem.mockReturnValue(null);
      
      abTest = new ConcurrencyABTest({
        testId: 'test-concurrency',
        persistResults: true
      });
      
      // 添加测试策略
      abTest.addStrategies([
        PredefinedStrategies.fixed(4),
        PredefinedStrategies.fixed(8),
        PredefinedStrategies.deviceAdaptive(),
        PredefinedStrategies.networkAdaptive()
      ]);
    });
    
    test('应该能初始化测试并选择策略', () => {
      const strategy = abTest.initTest();
      
      expect(strategy).not.toBeNull();
      expect(abTest.activeStrategyId).not.toBeNull();
      expect(abTest.activeStrategy).not.toBeNull();
    });
    
    test('应该能记录和分析测试结果', () => {
      abTest.initTest();
      
      // 记录测试结果
      for (let i = 0; i < 10; i++) {
        abTest.recordResult({
          concurrencyUsed: 4,
          totalTime: 500,
          resourceCount: 20,
          successCount: 19,
          failureCount: 1
        });
      }
      
      const results = abTest.getTestResults();
      
      expect(results.strategiesAnalyzed).toBe(1);
      expect(results.bestStrategyId).toBe(abTest.activeStrategyId);
      expect(results.bestStrategyScore).not.toBeNull();
    });
    
    test('应该能选择最佳策略', () => {
      abTest.initTest();
      
      // 为每个策略添加不同质量的结果
      
      // 为当前策略添加普通结果
      for (let i = 0; i < 10; i++) {
        abTest.recordResult({
          concurrencyUsed: 4,
          totalTime: 1000,
          resourceCount: 20,
          successCount: 18,
          failureCount: 2
        });
      }
      
      // 换成另一个策略并添加更好的结果
      const originalStrategyId = abTest.activeStrategyId;
      const betterStrategyId = 'fixed-8';
      
      // 手动设置策略ID
      abTest.activeStrategyId = betterStrategyId;
      
      // 记录更好的结果
      for (let i = 0; i < 10; i++) {
        abTest.recordResult({
          concurrencyUsed: 8,
          totalTime: 600,
          resourceCount: 20,
          successCount: 20,
          failureCount: 0
        });
      }
      
      // 恢复原始策略，然后尝试选择最佳策略
      abTest.activeStrategyId = originalStrategyId;
      const selectedId = abTest.selectBestStrategy();
      
      // 应该选择有更好结果的策略
      expect(selectedId).toBe(betterStrategyId);
      expect(abTest.activeStrategyId).toBe(betterStrategyId);
    });
    
    test('预定义策略应该提供合理的并发建议', () => {
      // 固定策略
      const fixedStrategy = PredefinedStrategies.fixed(6);
      expect(fixedStrategy.concurrencyProvider()).toBe(6);
      
      // 设备自适应策略
      const deviceStrategy = PredefinedStrategies.deviceAdaptive();
      expect(typeof deviceStrategy.concurrencyProvider()).toBe('number');
      
      // 网络自适应策略
      const networkStrategy = PredefinedStrategies.networkAdaptive();
      expect(typeof networkStrategy.concurrencyProvider()).toBe('number');
      
      // 综合自适应策略
      const comprehensiveStrategy = PredefinedStrategies.comprehensive();
      expect(typeof comprehensiveStrategy.concurrencyProvider()).toBe('number');
    });
  });
}); 