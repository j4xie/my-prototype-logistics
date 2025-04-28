/**
 * @file loader-storage-compatibility.test.js
 * @description 资源加载器跨浏览器存储兼容性测试 - 食品溯源系统
 * @jest-environment jsdom
 */

'use strict';

// 导入加载器模块
const traceLoader = require('../../../components/modules/auth/loader');

// 设置测试超时时间，防止无限运行
jest.setTimeout(10000);

/**
 * 等待所有Promise完成的辅助函数
 * @returns {Promise<void>}
 */
async function flushPromises() {
  return new Promise(resolve => setTimeout(resolve, 0));
}

/**
 * 模拟不同的浏览器存储环境
 */
const storageFeatures = {
  // 现代浏览器，支持所有存储API
  modern: {
    localStorage: true,
    sessionStorage: true,
    indexedDB: true,
    cacheAPI: true,
    serviceWorker: true
  },
  // 有限支持的浏览器，只支持基本存储
  limited: {
    localStorage: true,
    sessionStorage: true,
    indexedDB: false,
    cacheAPI: false,
    serviceWorker: false
  }
};

/**
 * 模拟特定浏览器存储环境
 * @param {Object} features 需要模拟的存储特性配置
 */
function mockStorageEnvironment(features) {
  // 模拟 localStorage
  if (!features.localStorage) {
    Object.defineProperty(window, 'localStorage', {
      value: undefined,
      configurable: true
    });
  } else {
    const mockStorage = {
      length: 0,
      clear: jest.fn(),
      getItem: jest.fn(),
      key: jest.fn(),
      removeItem: jest.fn(),
      setItem: jest.fn()
    };
    Object.defineProperty(window, 'localStorage', {
      value: mockStorage,
      configurable: true
    });
  }

  // 模拟 sessionStorage
  if (!features.sessionStorage) {
    Object.defineProperty(window, 'sessionStorage', {
      value: undefined,
      configurable: true
    });
  }

  // 模拟 IndexedDB
  if (!features.indexedDB) {
    Object.defineProperty(window, 'indexedDB', {
      value: undefined,
      configurable: true
    });
  }

  // 模拟 CacheAPI
  if (!features.cacheAPI) {
    Object.defineProperty(window, 'caches', {
      value: undefined,
      configurable: true
    });
  }

  // 模拟 ServiceWorker
  if (!features.serviceWorker) {
    Object.defineProperty(navigator, 'serviceWorker', {
      value: undefined,
      configurable: true
    });
  }
}

// 在每个测试之前设置环境
beforeEach(() => {
  // 使用模拟计时器
  jest.useFakeTimers();
  
  // 重置加载器状态
  if (traceLoader._state) {
    traceLoader._state.loadedResources = new Map();
    traceLoader._state.pendingLoads = 0;
    traceLoader._state.loadQueue = [];
  }
  
  // 清理DOM
  document.head.innerHTML = '';
  document.body.innerHTML = '';
  
  // 确保恢复默认存储环境
  mockStorageEnvironment(storageFeatures.modern);
});

// 在每个测试后清理环境
afterEach(() => {
  // 清理所有计时器
  jest.clearAllTimers();
  
  // 恢复真实计时器
  jest.useRealTimers();
  
  // 清理所有模拟
  jest.restoreAllMocks();
});

// 测试套件1：基础功能与初始化
describe('资源加载器 - 基础功能', () => {
  test('应该正确初始化加载器', () => {
    // 初始化加载器
    const loader = traceLoader.init();
    
    // 验证初始化是否成功
    expect(loader).toBeDefined();
    expect(loader.config).toBeDefined();
    expect(loader._state).toBeDefined();
    expect(loader._state.loadedResources).toBeInstanceOf(Map);
  });
  
  test('应该允许自定义配置', () => {
    // 初始化加载器并自定义配置
    const customConfig = {
      timeout: 5000,
      maxConcurrent: 3,
      retryAttempts: 1
    };
    
    const loader = traceLoader.init(customConfig);
    
    // 验证配置是否合并
    expect(loader.config.timeout).toBe(customConfig.timeout);
    expect(loader.config.maxConcurrent).toBe(customConfig.maxConcurrent);
    expect(loader.config.retryAttempts).toBe(customConfig.retryAttempts);
  });
});

// 测试套件2：资源缓存管理
describe('资源加载器 - 资源缓存管理', () => {
  test('应该能缓存已加载的资源', async () => {
    // 初始化加载器
    const loader = traceLoader.init();
    
    // 模拟资源加载和缓存
    const resourceUrl = 'test-image.jpg';
    const mockImg = new Image();
    mockImg.src = resourceUrl;
    
    // 手动添加到缓存中
    loader._state.loadedResources.set(resourceUrl, mockImg);
    
    // 验证缓存是否有效
    const cachedResource = loader.getCachedResource(resourceUrl);
    expect(cachedResource).toBe(mockImg);
  });
  
  test('加载统计应该能正确反映缓存状态', () => {
    // 初始化加载器
    const loader = traceLoader.init();
    
    // 模拟添加三个缓存资源
    loader._state.loadedResources.set('test1.jpg', new Image());
    loader._state.loadedResources.set('test2.jpg', new Image());
    loader._state.loadedResources.set('test3.jpg', new Image());
    
    // 模拟两个待处理资源
    loader._state.pendingLoads = 2;
    
    // 模拟队列中的资源
    loader._state.loadQueue = [
      { id: 'test4', url: 'test4.jpg', type: 'image' },
      { id: 'test5', url: 'test5.jpg', type: 'image' }
    ];
    
    // 获取加载统计
    const stats = loader.getStats();
    
    // 验证统计数据准确性
    expect(stats.cached).toBe(3);
    expect(stats.pending).toBe(2);
    expect(stats.queued).toBe(2);
  });
  
  test('应该能够清除缓存资源', () => {
    // 初始化加载器
    const loader = traceLoader.init();
    
    // 模拟添加缓存资源
    loader._state.loadedResources.set('test1.jpg', new Image());
    loader._state.loadedResources.set('test2.jpg', new Image());
    
    // 清除单个资源
    loader.clearCache('test1.jpg');
    expect(loader._state.loadedResources.has('test1.jpg')).toBe(false);
    expect(loader._state.loadedResources.has('test2.jpg')).toBe(true);
    
    // 清除所有资源
    loader.clearCache();
    expect(loader._state.loadedResources.size).toBe(0);
  });
});

// 测试套件3：跨浏览器兼容性
describe('资源加载器 - 跨浏览器兼容性', () => {
  test('应该在不同浏览器环境下能正确初始化', () => {
    // 模拟有限支持的浏览器环境
    mockStorageEnvironment(storageFeatures.limited);
    
    // 初始化加载器
    const loader = traceLoader.init();
    
    // 验证初始化成功
    expect(loader).toBeDefined();
    expect(loader.config).toBeDefined();
    expect(loader._state.loadedResources).toBeInstanceOf(Map);
  });
  
  test('事件系统应该在各环境下保持一致性', () => {
    // 初始化加载器
    const loader = traceLoader.init();
    
    // 模拟事件回调
    const mockCallback = jest.fn();
    
    // 订阅事件
    loader.on(loader.events.LOAD_COMPLETE, mockCallback);
    
    // 触发事件
    loader._trigger(loader.events.LOAD_COMPLETE, { resource: { id: 'test' }, element: new Image() });
    
    // 验证回调被调用
    expect(mockCallback).toHaveBeenCalled();
    expect(mockCallback).toHaveBeenCalledWith(expect.objectContaining({
      resource: expect.objectContaining({ id: 'test' })
    }));
  });
});

// 测试套件4：错误恢复能力
describe('资源加载器 - 错误恢复能力', () => {
  test('应该能够处理资源加载错误并触发相应事件', () => {
    // 初始化加载器
    const loader = traceLoader.init();
    
    // 监听错误事件
    const errorHandler = jest.fn();
    loader.on(loader.events.LOAD_ERROR, errorHandler);
    
    // 模拟资源和错误
    const resource = { id: 'test', url: 'test.jpg', type: 'image', retries: 2 };
    const error = new Error('测试错误');
    
    // 调用错误处理方法
    loader.handleResourceError(resource, error);
    
    // 如果已达到最大重试次数，应触发最终错误事件
    expect(errorHandler).toHaveBeenCalled();
  });
  
  test('应该支持资源加载重试机制', () => {
    // 初始化加载器，设置重试次数
    const loader = traceLoader.init({
      retryAttempts: 2
    });
    
    // 监听重试事件
    const retryHandler = jest.fn();
    loader.on(loader.events.LOAD_RETRY, retryHandler);
    
    // 模拟资源和错误
    const resource = { id: 'test', url: 'test.jpg', type: 'image', retries: 0 };
    const error = new Error('测试错误');
    
    // 模拟_queueResource函数，避免实际将资源加入队列
    loader._queueResource = jest.fn();
    
    // 调用错误处理方法
    loader.handleResourceError(resource, error);
    
    // 快进计时器
    jest.advanceTimersByTime(1000);
    
    // 验证重试计数增加
    expect(resource.retries).toBe(1);
    
    // 验证_queueResource被调用，表示重试逻辑执行
    expect(loader._queueResource).toHaveBeenCalled();
  });
}); 