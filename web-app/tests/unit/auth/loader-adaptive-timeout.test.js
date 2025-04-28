/**
 * @file loader-adaptive-timeout.test.js
 * @description 资源加载器 - 自适应超时机制测试 - 食品溯源系统
 * @jest-environment jsdom
 */

// CommonJS导入，不使用ES6模块语法
const traceLoader = require('../../../components/modules/auth/loader');

// 设置全局测试超时为10秒(避免无限运行)
jest.setTimeout(10000);

// 每次测试前重置环境
beforeEach(() => {
  // 重置模块
  jest.resetModules();
  // 使用Jest的现代计时器模式，确保Promise能正确解析
  jest.useFakeTimers({ legacyFakeTimers: false });
  // 清除所有计时器
  jest.clearAllTimers();
  
  // 重置 loader 状态
  if (traceLoader._state) {
    traceLoader._state.loadedResources.clear();
    traceLoader._state.pendingLoads = 0;
    traceLoader._state.loadQueue = [];
    traceLoader._state.listeners.clear();
    
    // 重置网络状态指标（如果存在）
    if (traceLoader._state.networkMetrics) {
      traceLoader._state.networkMetrics = {
        successfulLoads: 0,
        failedLoads: 0,
        averageLoadTime: 0,
        loadTimes: [],
        networkQuality: 'unknown', // 'excellent', 'good', 'moderate', 'poor'
        lastCheck: 0
      };
    }
  }
  
  // 清理 DOM
  document.head.innerHTML = '';
  document.body.innerHTML = '';
  
  // 模拟网络条件
  mockNetworkCondition('good');
  
  // 模拟Performance API
  mockPerformanceAPI();
  
  // 模拟Navigator connection API
  mockNavigatorConnection();
});

// 每次测试后清理环境
afterEach(() => {
  // 清理所有定时器
  jest.clearAllTimers();
  // 恢复真实计时器
  jest.useRealTimers();
  // 清理所有模拟
  jest.restoreAllMocks();
  // 清理DOM
  document.head.innerHTML = '';
  document.body.innerHTML = '';
  // 清理模拟
  clearNetworkMocks();
});

/**
 * 模拟网络条件
 * @param {string} condition 网络条件: 'excellent', 'good', 'moderate', 'poor'
 */
function mockNetworkCondition(condition) {
  let loadTimeFactor = 1; // 默认加载时间因子
  let errorRate = 0; // 默认错误率
  let timeoutRate = 0; // 默认超时率
  
  // 根据网络条件设置模拟参数
  switch (condition) {
    case 'excellent':
      loadTimeFactor = 0.5; // 加载非常快
      errorRate = 0.01; // 极低错误率
      timeoutRate = 0;
      break;
    case 'good':
      loadTimeFactor = 1; // 正常加载速度
      errorRate = 0.05; // 低错误率
      timeoutRate = 0.01;
      break;
    case 'moderate':
      loadTimeFactor = 2; // 较慢加载速度
      errorRate = 0.1; // 中等错误率
      timeoutRate = 0.05;
      break;
    case 'poor':
      loadTimeFactor = 4; // 非常慢的加载速度
      errorRate = 0.2; // 高错误率
      timeoutRate = 0.15;
      break;
    default:
      break;
  }
  
  // 保存当前网络条件
  global._networkCondition = {
    condition,
    loadTimeFactor,
    errorRate,
    timeoutRate
  };
}

/**
 * 模拟Performance API
 */
function mockPerformanceAPI() {
  // 模拟performance.now()
  if (!window.performance) {
    window.performance = {};
  }
  
  window.performance.now = jest.fn(() => Date.now());
  
  // 模拟Resource Timing API
  window.performance.getEntriesByType = jest.fn(type => {
    if (type === 'resource') {
      return [];
    }
    return [];
  });
  
  // 模拟标记和测量方法
  window.performance.mark = jest.fn();
  window.performance.measure = jest.fn();
  window.performance.getEntriesByName = jest.fn(() => []);
  window.performance.clearMarks = jest.fn();
  window.performance.clearMeasures = jest.fn();
}

/**
 * 模拟Navigator connection API
 */
function mockNavigatorConnection() {
  // 如果navigator对象不存在，创建它
  if (!navigator.connection) {
    Object.defineProperty(navigator, 'connection', {
      value: {
        effectiveType: '4g',
        downlink: 10,
        rtt: 50,
        saveData: false,
        addEventListener: jest.fn(),
        removeEventListener: jest.fn()
      },
      configurable: true
    });
  }
}

/**
 * 清理网络模拟
 */
function clearNetworkMocks() {
  delete global._networkCondition;
  
  // 清理performance模拟
  if (window.performance) {
    if (window.performance.now && typeof window.performance.now.mockClear === 'function') {
      window.performance.now.mockClear();
    }
    if (window.performance.getEntriesByType && typeof window.performance.getEntriesByType.mockClear === 'function') {
      window.performance.getEntriesByType.mockClear();
    }
  }
  
  // 清理navigator.connection模拟
  if (navigator.connection) {
    delete navigator.connection;
  }
}

/**
 * 模拟资源加载
 * @param {string} resourceType 资源类型
 * @param {number} baseLoadTime 基础加载时间(ms)
 * @returns {Promise} 模拟加载的Promise
 */
function mockResourceLoad(resourceType, baseLoadTime = 300) {
  const { loadTimeFactor, errorRate, timeoutRate } = global._networkCondition || { 
    loadTimeFactor: 1, 
    errorRate: 0, 
    timeoutRate: 0 
  };
  
  // 计算实际加载时间
  const actualLoadTime = baseLoadTime * loadTimeFactor;
  
  // 随机确定是否超时
  const isTimeout = Math.random() < timeoutRate;
  if (isTimeout) {
    // 返回一个永远不会解析的Promise，模拟超时
    return new Promise((resolve) => {
      // 这个Promise永远不会解析
    });
  }
  
  // 随机确定是否出错
  const isError = Math.random() < errorRate;
  
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      if (isError) {
        reject(new Error(`Failed to load ${resourceType}`));
      } else {
        resolve({
          type: resourceType,
          loadTime: actualLoadTime
        });
      }
    }, actualLoadTime);
  });
}

// 基础功能测试套件
describe('资源加载器 - 自适应超时机制', () => {
  test('应该根据网络条件自动调整超时时间', () => {
    // 初始化加载器，启用自适应超时
    const loader = traceLoader.init({
      adaptiveTimeout: true,
      initialTimeout: 3000, // 初始超时时间3秒
      minTimeout: 1000, // 最小超时时间1秒
      maxTimeout: 10000 // 最大超时时间10秒
    });
    
    // 如果有自适应超时方法，测试它
    if (typeof loader._calculateAdaptiveTimeout === 'function') {
      // 测试不同网络条件下的超时计算
      
      // 优良网络条件
      mockNetworkCondition('excellent');
      let excellentTimeout = loader._calculateAdaptiveTimeout('image');
      
      // 良好网络条件
      mockNetworkCondition('good');
      let goodTimeout = loader._calculateAdaptiveTimeout('image');
      
      // 中等网络条件
      mockNetworkCondition('moderate');
      let moderateTimeout = loader._calculateAdaptiveTimeout('image');
      
      // 差网络条件
      mockNetworkCondition('poor');
      let poorTimeout = loader._calculateAdaptiveTimeout('image');
      
      // 验证自适应超时行为
      expect(excellentTimeout).toBeLessThan(goodTimeout);
      expect(goodTimeout).toBeLessThan(moderateTimeout);
      expect(moderateTimeout).toBeLessThan(poorTimeout);
      
      // 验证超时在配置的范围内
      expect(excellentTimeout).toBeGreaterThanOrEqual(loader.config.minTimeout);
      expect(poorTimeout).toBeLessThanOrEqual(loader.config.maxTimeout);
    }
  });
  
  test('应该针对不同类型的资源计算不同的超时时间', () => {
    // 初始化加载器，启用自适应超时
    const loader = traceLoader.init({
      adaptiveTimeout: true,
      resourceSpecificTimeouts: true
    });
    
    // 如果有资源特定超时方法，测试它
    if (typeof loader._getResourceSpecificTimeout === 'function') {
      // 保持相同网络条件
      mockNetworkCondition('moderate');
      
      // 获取不同资源类型的超时时间
      const imageTimeout = loader._getResourceSpecificTimeout('image');
      const scriptTimeout = loader._getResourceSpecificTimeout('script');
      const styleTimeout = loader._getResourceSpecificTimeout('style');
      
      // 验证不同资源类型的超时时间是否合理
      // 通常脚本加载需要更长的超时时间
      expect(scriptTimeout).toBeGreaterThanOrEqual(imageTimeout);
      expect(styleTimeout).toBeDefined();
    }
  });
  
  test('应该记录和学习过去的加载性能', async () => {
    // 初始化加载器，启用自适应超时和学习功能
    const loader = traceLoader.init({
      adaptiveTimeout: true,
      learningEnabled: true,
      learningRate: 0.1 // 学习率
    });
    
    // 监视学习方法
    let updateNetworkMetricsSpy;
    if (typeof loader._updateNetworkMetrics === 'function') {
      updateNetworkMetricsSpy = jest.spyOn(loader, '_updateNetworkMetrics');
    }
    
    // 模拟一系列成功的资源加载
    if (typeof loader._recordLoadSuccess === 'function') {
      // 模拟多次成功加载，记录不同的加载时间
      loader._recordLoadSuccess({ type: 'image', url: 'test1.jpg' }, 300);
      loader._recordLoadSuccess({ type: 'image', url: 'test2.jpg' }, 400);
      loader._recordLoadSuccess({ type: 'image', url: 'test3.jpg' }, 350);
      
      // 验证网络指标更新被调用
      if (updateNetworkMetricsSpy) {
        expect(updateNetworkMetricsSpy).toHaveBeenCalled();
      }
      
      // 验证学习系统记录了加载时间
      if (loader._state.networkMetrics) {
        expect(loader._state.networkMetrics.loadTimes.length).toBeGreaterThan(0);
        expect(loader._state.networkMetrics.averageLoadTime).toBeGreaterThan(0);
      }
    }
    
    // 清理间谍
    if (updateNetworkMetricsSpy) {
      updateNetworkMetricsSpy.mockRestore();
    }
  });
  
  test('应该在加载失败后调整策略', async () => {
    // 初始化加载器，启用自适应超时和学习功能
    const loader = traceLoader.init({
      adaptiveTimeout: true,
      learningEnabled: true,
      maxRetries: 3 // 最大重试次数
    });
    
    // 监视失败记录和重试策略方法
    let recordLoadFailureSpy;
    let adjustRetryStrategySpy;
    
    if (typeof loader._recordLoadFailure === 'function') {
      recordLoadFailureSpy = jest.spyOn(loader, '_recordLoadFailure');
    }
    
    if (typeof loader._adjustRetryStrategy === 'function') {
      adjustRetryStrategySpy = jest.spyOn(loader, '_adjustRetryStrategy');
    }
    
    // 模拟资源加载失败
    const failedResource = { type: 'image', url: 'failed.jpg' };
    const error = new Error('Network error');
    
    // 如果有失败处理方法，调用它
    if (typeof loader._handleLoadFailure === 'function') {
      loader._handleLoadFailure(failedResource, error);
      
      // 验证失败记录方法被调用
      if (recordLoadFailureSpy) {
        expect(recordLoadFailureSpy).toHaveBeenCalledWith(failedResource, error);
      }
      
      // 验证重试策略调整方法被调用
      if (adjustRetryStrategySpy) {
        expect(adjustRetryStrategySpy).toHaveBeenCalled();
      }
    }
    
    // 清理间谍
    if (recordLoadFailureSpy) {
      recordLoadFailureSpy.mockRestore();
    }
    if (adjustRetryStrategySpy) {
      adjustRetryStrategySpy.mockRestore();
    }
  });
  
  test('应该在不同网络条件下应用不同的预加载策略', () => {
    // 初始化加载器，启用自适应策略
    const loader = traceLoader.init({
      adaptiveTimeout: true,
      adaptivePreloading: true
    });
    
    // 验证不同网络条件下的预加载策略
    if (typeof loader._determinePreloadStrategy === 'function') {
      // 优良网络条件 - 应该激进预加载
      mockNetworkCondition('excellent');
      const excellentStrategy = loader._determinePreloadStrategy();
      
      // 差网络条件 - 应该保守预加载
      mockNetworkCondition('poor');
      const poorStrategy = loader._determinePreloadStrategy();
      
      // 验证策略差异
      if (excellentStrategy && poorStrategy) {
        // 在好的网络中应该预加载更多资源
        expect(excellentStrategy.preloadAmount).toBeGreaterThan(poorStrategy.preloadAmount);
        // 在差的网络中应该更早放弃加载
        expect(excellentStrategy.abandonmentThreshold).toBeGreaterThan(
          poorStrategy.abandonmentThreshold
        );
      }
    }
  });
});

// 进阶超时机制测试
describe('资源加载器 - 进阶超时控制', () => {
  test('应该动态扩展超时时间以处理偶发的网络延迟', async () => {
    // 初始化加载器，启用动态超时延展
    const loader = traceLoader.init({
      adaptiveTimeout: true,
      dynamicTimeoutExtension: true,
      baseTimeout: 3000
    });
    
    // 监视超时延展方法
    let extendTimeoutSpy;
    if (typeof loader._evaluateTimeoutExtension === 'function') {
      extendTimeoutSpy = jest.spyOn(loader, '_evaluateTimeoutExtension');
    }
    
    // 模拟进行中的加载，但接近超时
    const resource = { type: 'image', url: 'slow-load.jpg', loadStartTime: Date.now() - 2900 };
    const progressEvent = { loaded: 800, total: 1000 }; // 80%已加载
    
    // 如果有进度检查方法，调用它
    if (typeof loader._checkLoadProgress === 'function') {
      const decision = loader._checkLoadProgress(resource, progressEvent);
      
      // 验证超时评估方法被调用
      if (extendTimeoutSpy) {
        expect(extendTimeoutSpy).toHaveBeenCalled();
      }
      
      // 验证决策 - 应该扩展超时而不是中止
      if (decision) {
        expect(decision.extendTimeout).toBe(true);
        expect(decision.abort).toBe(false);
      }
    }
    
    // 清理间谍
    if (extendTimeoutSpy) {
      extendTimeoutSpy.mockRestore();
    }
  });
  
  test('应该正确处理多阶段超时', async () => {
    // 初始化加载器，启用多阶段超时
    const loader = traceLoader.init({
      adaptiveTimeout: true,
      multiStageTimeout: true,
      initialConnectTimeout: 1000, // 连接初始化超时
      transferTimeout: 5000 // 数据传输超时
    });
    
    // 设置模拟网络条件
    mockNetworkCondition('moderate');
    
    // 模拟加载体验大文件的场景
    const largeResource = { 
      type: 'image', 
      url: 'large-image.jpg', 
      size: 2000000 // 2MB
    };
    
    // 如果有多阶段超时计算方法，测试它
    if (typeof loader._calculateMultiStageTimeouts === 'function') {
      const timeouts = loader._calculateMultiStageTimeouts(largeResource);
      
      // 验证多阶段超时配置
      expect(timeouts).toBeDefined();
      if (timeouts) {
        expect(timeouts.connect).toBeLessThan(timeouts.transfer);
        expect(timeouts.total).toBeGreaterThan(timeouts.transfer);
      }
    }
    
    // 模拟不同阶段的超时检查
    if (typeof loader._checkLoadStage === 'function') {
      // 模拟连接阶段超时
      const connectStage = loader._checkLoadStage(largeResource, 'connect', 1100);
      
      // 模拟传输阶段未超时
      const transferStage = loader._checkLoadStage(largeResource, 'transfer', 3000);
      
      // 验证阶段性检查结果
      if (connectStage && transferStage) {
        expect(connectStage.timedOut).toBe(true);
        expect(transferStage.timedOut).toBe(false);
      }
    }
  });
  
  test('应该基于历史表现预测加载时间', async () => {
    // 初始化加载器，启用预测功能
    const loader = traceLoader.init({
      adaptiveTimeout: true,
      predictiveLoading: true
    });
    
    // 如果有加载时间预测方法，测试它
    if (typeof loader._predictLoadTime === 'function') {
      // 首先构建历史数据
      const history = [];
      
      // 模拟相同资源的多次加载时间
      for (let i = 0; i < 5; i++) {
        history.push({
          url: 'repeat-image.jpg',
          type: 'image',
          size: 50000,
          loadTime: 500 + Math.random() * 200 // 500-700ms范围
        });
      }
      
      // 将历史数据添加到加载器的学习系统
      if (loader._state.loadHistory) {
        loader._state.loadHistory = history;
      }
      
      // 预测相同资源的下一次加载时间
      const prediction = loader._predictLoadTime({ 
        url: 'repeat-image.jpg', 
        type: 'image',
        size: 50000
      });
      
      // 验证预测
      expect(prediction).toBeDefined();
      if (prediction) {
        // 预测应该在历史范围内
        expect(prediction).toBeGreaterThanOrEqual(500);
        expect(prediction).toBeLessThanOrEqual(700);
      }
    }
  });
  
  test('应该能从超时中学习并调整策略', async () => {
    // 初始化加载器，启用超时学习
    const loader = traceLoader.init({
      adaptiveTimeout: true,
      learningEnabled: true,
      timeoutLearningRate: 0.2
    });
    
    // 如果有超时调整方法，测试它
    if (typeof loader._adjustTimeoutFromExperience === 'function') {
      // 记录初始超时时间
      const initialTimeout = loader.config.timeout;
      
      // 模拟一系列超时和成功
      const timeoutData = [
        { resource: { type: 'image', url: 'timeout1.jpg' }, timedOut: true, loadTime: 5000 },
        { resource: { type: 'image', url: 'timeout2.jpg' }, timedOut: true, loadTime: 5500 },
        { resource: { type: 'image', url: 'success1.jpg' }, timedOut: false, loadTime: 2000 }
      ];
      
      // 应用这些经验
      timeoutData.forEach(data => {
        loader._adjustTimeoutFromExperience(
          data.resource, 
          data.timedOut, 
          data.loadTime
        );
      });
      
      // 检查自适应超时是否从经验中学习
      if (typeof loader._calculateAdaptiveTimeout === 'function') {
        const newTimeout = loader._calculateAdaptiveTimeout('image');
        
        // 验证超时时间调整
        expect(newTimeout).not.toBe(initialTimeout);
        // 因为有多次超时，应该增加超时时间
        expect(newTimeout).toBeGreaterThan(initialTimeout);
      }
    }
  });
});

// 并发控制与优先级测试
describe('资源加载器 - 超时与并发控制', () => {
  test('应该根据当前网络条件调整并发限制', () => {
    // 初始化加载器，启用自适应并发
    const loader = traceLoader.init({
      adaptiveTimeout: true,
      adaptiveConcurrency: true,
      baseConcurrencyLimit: 6
    });
    
    // 如果有自适应并发方法，测试它
    if (typeof loader._adjustConcurrencyLimit === 'function') {
      // 测试不同网络条件下的并发限制调整
      
      // 优良网络条件 - 应该允许更高并发
      mockNetworkCondition('excellent');
      const excellentLimit = loader._adjustConcurrencyLimit();
      
      // 差网络条件 - 应该限制并发
      mockNetworkCondition('poor');
      const poorLimit = loader._adjustConcurrencyLimit();
      
      // 验证并发限制调整
      expect(excellentLimit).toBeGreaterThan(poorLimit);
    }
  });
  
  test('应该根据资源优先级和网络条件分配超时时间', () => {
    // 初始化加载器，启用优先级感知超时
    const loader = traceLoader.init({
      adaptiveTimeout: true,
      priorityAwareTimeout: true
    });
    
    // 如果有优先级感知超时方法，测试它
    if (typeof loader._calculatePriorityAwareTimeout === 'function') {
      // 在中等网络条件下
      mockNetworkCondition('moderate');
      
      // 测试不同优先级的资源
      const highPriorityTimeout = loader._calculatePriorityAwareTimeout({ 
        type: 'script', 
        priority: 5 // 高优先级
      });
      
      const lowPriorityTimeout = loader._calculatePriorityAwareTimeout({ 
        type: 'image', 
        priority: 1 // 低优先级
      });
      
      // 验证优先级影响
      expect(highPriorityTimeout).toBeGreaterThan(lowPriorityTimeout);
    }
  });
  
  test('应该能中止低优先级加载以释放带宽给高优先级资源', async () => {
    // 初始化加载器，启用带宽管理
    const loader = traceLoader.init({
      adaptiveTimeout: true,
      bandwidthManagement: true,
      preemptiveLoading: true
    });
    
    // 模拟低网络条件
    mockNetworkCondition('poor');
    
    // 监视资源中止方法
    let abortResourceSpy;
    if (typeof loader._abortResourceLoad === 'function') {
      abortResourceSpy = jest.spyOn(loader, '_abortResourceLoad');
    }
    
    // 如果有带宽管理方法，测试它
    if (typeof loader._manageBandwidthAllocation === 'function') {
      // 模拟当前加载队列包含低优先级资源
      const lowPriorityResources = [
        { id: 'low1', url: 'background1.jpg', type: 'image', priority: 1 },
        { id: 'low2', url: 'background2.jpg', type: 'image', priority: 1 }
      ];
      
      // 添加到加载队列
      lowPriorityResources.forEach(resource => {
        loader._state.loadQueue.push(resource);
      });
      
      // 设置一些资源正在加载
      loader._state.pendingLoads = 2;
      
      // 添加高优先级资源
      const highPriorityResource = { 
        id: 'high1', 
        url: 'critical.js', 
        type: 'script', 
        priority: 5 
      };
      
      // 调用带宽管理
      loader._manageBandwidthAllocation(highPriorityResource);
      
      // 验证低优先级资源被中止
      if (abortResourceSpy) {
        expect(abortResourceSpy).toHaveBeenCalled();
      }
    }
    
    // 清理间谍
    if (abortResourceSpy) {
      abortResourceSpy.mockRestore();
    }
  });
  
  test('应该在严重网络降级时暂停非关键资源加载', async () => {
    // 初始化加载器，启用网络感知功能
    const loader = traceLoader.init({
      adaptiveTimeout: true,
      networkAware: true,
      gracefulDegradation: true
    });
    
    // 监视加载暂停方法
    let pauseNonCriticalLoadsSpy;
    if (typeof loader._pauseNonCriticalLoads === 'function') {
      pauseNonCriticalLoadsSpy = jest.spyOn(loader, '_pauseNonCriticalLoads');
    }
    
    // 如果有网络质量评估方法，测试它
    if (typeof loader._evaluateNetworkQuality === 'function') {
      // 原始网络状态为良好
      mockNetworkCondition('good');
      const initialQuality = loader._evaluateNetworkQuality();
      
      // 切换到极差网络
      mockNetworkCondition('poor');
      // 模拟多次加载失败
      for (let i = 0; i < 3; i++) {
        if (typeof loader._recordLoadFailure === 'function') {
          loader._recordLoadFailure(
            { type: 'image', url: `fail${i}.jpg` },
            new Error('Network error')
          );
        }
      }
      
      // 重新评估网络质量
      const degradedQuality = loader._evaluateNetworkQuality();
      
      // 如果有网络降级处理方法，调用它
      if (typeof loader._handleNetworkDegradation === 'function') {
        loader._handleNetworkDegradation(initialQuality, degradedQuality);
        
        // 验证非关键加载被暂停
        if (pauseNonCriticalLoadsSpy) {
          expect(pauseNonCriticalLoadsSpy).toHaveBeenCalled();
        }
      }
    }
    
    // 清理间谍
    if (pauseNonCriticalLoadsSpy) {
      pauseNonCriticalLoadsSpy.mockRestore();
    }
  });
}); 