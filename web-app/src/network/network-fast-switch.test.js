/**
 * @file 网络状态快速切换测试
 * @description 测试系统在网络状态频繁变化时的稳定性和性能
 */

// 添加Jest引用
const jest = require('jest');

// 模拟模块
jest.mock('./resource-loader', () => ({
  traceLoader: {
    reset: jest.fn(),
    init: jest.fn().mockReturnValue({
      loadBatch: jest.fn().mockImplementation(resources => {
        return Promise.resolve(resources.map(r => ({...r, loaded: true})));
      }),
      configure: jest.fn()
    })
  }
}));

jest.mock('./network-monitor', () => ({
  NetworkMonitor: jest.fn().mockImplementation((options) => ({
    removeAllListeners: jest.fn(),
    on: jest.fn(),
    emit: jest.fn(),
    configure: jest.fn(),
    listeners: {},
    on: function(event, callback) {
      this.listeners[event] = callback;
      return this;
    },
    emit: function(event, data) {
      if (this.listeners[event]) {
        this.listeners[event](data);
      }
      return this;
    }
  }))
}));

jest.mock('../utils/performance-test-tool', () => {
  return jest.fn().mockImplementation(() => ({
    startRecording: jest.fn(),
    stopRecording: jest.fn(),
    getSummary: jest.fn().mockReturnValue({})
  }));
});

const { traceLoader } = require('./resource-loader');
const { NetworkMonitor } = require('./network-monitor');
const PerformanceTestTool = require('../utils/performance-test-tool');

// 设置全局模拟
global.navigator = global.navigator || {
  onLine: true
};

global.window = global.window || {
  dispatchEvent: jest.fn()
};

// 设置Event构造函数
global.Event = class Event {
  constructor(type) {
    this.type = type;
  }
};

describe('网络监控 - 网络状态快速切换测试', () => {
  // 性能测试工具实例
  let performanceTool;
  // 网络监控实例
  let networkMonitor;
  // 加载器实例
  let loader;
  // 模拟网络状态变化事件
  let onlineEvent, offlineEvent;
  // 网络状态检测回调
  let networkCallbacks = [];
  // 状态变化次数统计
  let stateChangeCount = 0;

  beforeEach(() => {
    // 创建性能测试工具
    performanceTool = new PerformanceTestTool({
      sampleSize: 3,
      warmupRuns: 1,
      cooldownMs: 100
    });
    
    // 初始化网络监控
    networkMonitor = new NetworkMonitor({
      triggerInitialState: false,
      stateChangeDebounceMs: 100, // 设置状态变化去抖动时间
      checkIntervalMs: 50         // 设置检测间隔
    });
    
    // 清空网络状态回调函数
    networkCallbacks = [];
    stateChangeCount = 0;
    
    // 初始化加载器
    loader = traceLoader.init({
      retryLimit: 3,              // 失败重试次数
      retryDelayMs: 300,          // 重试延迟时间
      networkChangeBufferMs: 500  // 网络变化后等待时间
    });
    
    // 创建模拟事件
    onlineEvent = new Event('online');
    offlineEvent = new Event('offline');

    // 模拟 navigator.onLine
    Object.defineProperty(navigator, 'onLine', {
      configurable: true,
      get: jest.fn(() => true),
      set: jest.fn()
    });
    
    // 监听网络状态变化
    networkMonitor.on('stateChange', (newState) => {
      stateChangeCount++;
      networkCallbacks.forEach(callback => callback(newState));
    });
  });
  
  afterEach(() => {
    // 清理测试环境
    networkMonitor.removeAllListeners();
    traceLoader.reset();
    
    // 重置测试数据
    networkCallbacks = [];
    stateChangeCount = 0;
  });

  /**
   * 模拟网络状态变化
   * @param {string} state - 网络状态 ('online'|'offline'|'slow')
   */
  function simulateNetworkChange(state) {
    if (state === 'online') {
      Object.defineProperty(navigator, 'onLine', {
        configurable: true,
        get: jest.fn(() => true)
      });
      window.dispatchEvent(onlineEvent);
    } else if (state === 'offline') {
      Object.defineProperty(navigator, 'onLine', {
        configurable: true,
        get: jest.fn(() => false)
      });
      window.dispatchEvent(offlineEvent);
    } else if (state === 'slow') {
      Object.defineProperty(navigator, 'onLine', {
        configurable: true,
        get: jest.fn(() => true)
      });
      networkMonitor.emit('connectionQualityChange', 'poor');
    }
  }

  /**
   * 模拟网络状态快速切换
   * @param {number} count - 切换次数
   * @param {number} intervalMs - 切换间隔(毫秒)
   * @returns {Promise<number>} 触发的状态变化次数
   */
  async function simulateRapidNetworkChanges(count, intervalMs) {
    const states = ['online', 'offline', 'slow'];
    stateChangeCount = 0;
    
    for (let i = 0; i < count; i++) {
      const state = states[i % states.length];
      simulateNetworkChange(state);
      await new Promise(resolve => setTimeout(resolve, intervalMs));
    }
    
    // 等待去抖动完成
    await new Promise(resolve => setTimeout(resolve, 300));
    
    return stateChangeCount;
  }

  /**
   * 加载测试资源并返回结果
   * @param {number} count - 资源数量
   * @returns {Promise<Object>} 加载结果
   */
  async function loadTestResources(count) {
    const resources = [];
    
    for (let i = 0; i < count; i++) {
      resources.push({
        id: `resource-${i}`,
        url: `https://example.com/resources/resource-${i}.js`,
        type: 'script',
        priority: i % 3
      });
    }
    
    return await loader.loadBatch(resources);
  }

  it('应该能够处理频繁的网络状态变化(每秒多次)', async () => {
    // 记录系统状态变化
    const detectedStates = [];
    
    networkCallbacks.push((state) => {
      detectedStates.push(state);
    });
    
    // 触发频繁网络状态变化 (10次, 每次间隔100ms)
    const changesTriggered = await simulateRapidNetworkChanges(10, 100);
    
    // 验证状态变化
    console.log(`检测到 ${detectedStates.length} 次状态变化，状态序列:`, detectedStates);
    
    // 由于去抖动机制，应该检测到的状态变化次数少于触发次数
    expect(detectedStates.length).toBeLessThan(10);
    
    // 但应该至少检测到一些状态变化
    expect(detectedStates.length).toBeGreaterThan(0);
    
    // 确认最终状态正确
    const finalExpectedState = navigator.onLine ? 'online' : 'offline';
    expect(detectedStates[detectedStates.length - 1]).toBe(finalExpectedState);
  });

  it('应该在快速切换时避免状态检测误报', async () => {
    // 记录误报情况
    let falsePositives = 0;
    let lastState = null;
    
    networkCallbacks.push((state) => {
      if (lastState === state) {
        falsePositives++;
      }
      lastState = state;
    });
    
    // 触发20次极快的网络状态变化 (每次间隔50ms)
    await simulateRapidNetworkChanges(20, 50);
    
    // 验证检测结果
    console.log(`状态变化误报次数: ${falsePositives}`);
    
    // 验证没有连续两次报告相同状态的误报
    // 注意：若状态真的在短时间内多次切换到同一状态，这个断言可能不准确，但在测试场景中应该可以接受
    expect(falsePositives).toBe(0);
  });

  it('应该在网络快速切换时有效进行去抖动', async () => {
    // 设置不同的去抖动时间进行测试
    const debounceTimes = [0, 100, 200, 300];
    const results = {};
    
    for (const debounceTime of debounceTimes) {
      // 重新配置网络监控
      networkMonitor.configure({
        stateChangeDebounceMs: debounceTime
      });
      
      // 重置状态计数
      stateChangeCount = 0;
      
      // 触发10次快速的网络状态变化 (每次间隔50ms)
      await simulateRapidNetworkChanges(10, 50);
      
      // 记录结果
      results[debounceTime] = stateChangeCount;
    }
    
    console.log('去抖动效果测试结果:', results);
    
    // 验证去抖动效果
    // 没有去抖动时应该触发更多状态变化
    expect(results[0]).toBeGreaterThanOrEqual(results[100]);
    
    // 去抖动时间越长，触发的状态变化应该越少
    expect(results[100]).toBeGreaterThanOrEqual(results[300]);
  });

  it('应该在快速网络变化中正确维护资源加载队列', async () => {
    jest.setTimeout(10000); // 设置更长的超时时间
    
    // 设置资源加载完成标志
    let loadingComplete = false;
    let loadingError = null;
    let loadingResult = null;
    
    // 开始加载资源
    const loadPromise = loadTestResources(5)
      .then(result => {
        loadingComplete = true;
        loadingResult = result;
        return result;
      })
      .catch(error => {
        loadingError = error;
        throw error;
      });
    
    // 同时触发网络状态快速变化
    await simulateRapidNetworkChanges(10, 100);
    
    // 等待资源加载完成
    const result = await loadPromise;
    
    // 验证资源最终加载成功
    expect(loadingComplete).toBe(true);
    expect(loadingError).toBeNull();
    expect(result.success).toBe(true);
    expect(result.failed.length).toBe(0);
    expect(result.loaded.length).toBe(5);
  });

  it('应该测量状态变化检测和通知的延迟', async () => {
    // 设置性能测量
    let detectionTime = null;
    
    // 记录检测开始时间
    const startTime = Date.now();
    
    // 监听网络状态变化
    const detectionPromise = new Promise(resolve => {
      networkCallbacks.push(() => {
        detectionTime = Date.now() - startTime;
        resolve();
      });
    });
    
    // 触发网络状态变化
    simulateNetworkChange('offline');
    
    // 等待检测完成
    await detectionPromise;
    
    console.log(`网络状态变化检测延迟: ${detectionTime}ms`);
    
    // 验证检测延迟在合理范围内
    // 注意：由于去抖动，延迟应该至少为设置的去抖动时间
    expect(detectionTime).toBeGreaterThanOrEqual(networkMonitor.config.stateChangeDebounceMs);
    
    // 但不应该过长
    expect(detectionTime).toBeLessThan(500);
  });
}); 