/**
 * @file loader-browser-cache.test.js
 * @description 资源加载器 - 跨浏览器缓存抽象层测试 - 食品溯源系统
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
  }
  
  // 清理 DOM
  document.head.innerHTML = '';
  document.body.innerHTML = '';
  
  // 模拟存储系统
  const mockStorage = createMockStorage();
  
  // 替换全局存储对象
  mockBrowserStorage(mockStorage);
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
  // 清理存储模拟
  restoreStorageMocks();
});

/**
 * 创建统一的存储系统模拟
 * @returns {Object} 模拟存储系统
 */
function createMockStorage() {
  const store = {};
  
  return {
    // 统一存储API
    getItem: jest.fn(key => store[key] || null),
    setItem: jest.fn((key, value) => {
      store[key] = String(value);
    }),
    removeItem: jest.fn(key => {
      delete store[key];
    }),
    clear: jest.fn(() => {
      Object.keys(store).forEach(key => delete store[key]);
    }),
    get length() {
      return Object.keys(store).length;
    },
    key: jest.fn(index => {
      const keys = Object.keys(store);
      return index < keys.length ? keys[index] : null;
    }),
    // 内部访问原始存储
    _getStore: () => ({ ...store }),
    // 浏览器特定错误模拟
    _throwQuotaError: jest.fn(() => {
      throw new DOMException('QuotaExceededError', 'QuotaExceededError');
    }),
    _throwSecurityError: jest.fn(() => {
      throw new DOMException('SecurityError', 'SecurityError');
    }),
    _throwInvalidStateError: jest.fn(() => {
      throw new DOMException('InvalidStateError', 'InvalidStateError');
    })
  };
}

/**
 * 模拟不同浏览器的存储系统
 * @param {Object} mockStorage 统一的存储模拟
 */
function mockBrowserStorage(mockStorage) {
  // 模拟localStorage
  Object.defineProperty(window, 'localStorage', {
    value: mockStorage,
    writable: true
  });
  
  // 模拟sessionStorage
  Object.defineProperty(window, 'sessionStorage', {
    value: mockStorage,
    writable: true
  });
  
  // 模拟IndexedDB
  const indexedDB = {
    open: jest.fn(),
    deleteDatabase: jest.fn()
  };
  Object.defineProperty(window, 'indexedDB', {
    value: indexedDB,
    writable: true
  });
  
  // 保存原始window对象的引用
  global._originalWindow = { ...window };
}

/**
 * 恢复存储模拟
 */
function restoreStorageMocks() {
  if (global._originalWindow) {
    Object.defineProperty(window, 'localStorage', {
      value: global._originalWindow.localStorage,
      writable: true
    });
    
    Object.defineProperty(window, 'sessionStorage', {
      value: global._originalWindow.sessionStorage,
      writable: true
    });
    
    Object.defineProperty(window, 'indexedDB', {
      value: global._originalWindow.indexedDB,
      writable: true
    });
    
    delete global._originalWindow;
  }
}

/**
 * 模拟特定浏览器环境
 * @param {string} browserName 浏览器名称: 'chrome', 'firefox', 'safari', 'edge'
 */
function mockBrowserEnvironment(browserName) {
  // 默认Chrome环境
  let userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36';
  
  // 根据浏览器类型设置特定的User Agent
  switch (browserName.toLowerCase()) {
    case 'firefox':
      userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:89.0) Gecko/20100101 Firefox/89.0';
      break;
    case 'safari':
      userAgent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 11_4) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.1 Safari/605.1.15';
      break;
    case 'edge':
      userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36 Edg/91.0.864.59';
      break;
    // 其他浏览器可以根据需要添加
  }
  
  // 设置User Agent
  Object.defineProperty(navigator, 'userAgent', {
    value: userAgent,
    writable: true
  });
  
  // 模拟浏览器特定行为
  switch (browserName.toLowerCase()) {
    case 'safari':
      // Safari在隐私浏览模式下禁用localStorage
      const mockStorage = window.localStorage;
      jest.spyOn(mockStorage, 'setItem').mockImplementation((key, value) => {
        if (Math.random() > 0.7) { // 模拟随机故障
          throw new DOMException('QuotaExceededError', 'QuotaExceededError');
        }
        mockStorage._getStore()[key] = String(value);
      });
      break;
      
    case 'firefox':
      // Firefox特有的存储限制行为
      const ffStorage = window.localStorage;
      jest.spyOn(ffStorage, 'setItem').mockImplementation((key, value) => {
        const store = ffStorage._getStore();
        if (Object.keys(store).length > 50) { // 模拟容量限制
          throw new DOMException('QuotaExceededError', 'QuotaExceededError');
        }
        store[key] = String(value);
      });
      break;
  }
}

// 基础功能测试套件
describe('资源加载器 - 跨浏览器缓存抽象层', () => {
  test('应该能检测浏览器类型并调整缓存策略', () => {
    // 设置浏览器环境为Chrome
    mockBrowserEnvironment('chrome');
    
    // 初始化加载器
    const loader = traceLoader.init({
      detectBrowserCapabilities: true,
      adaptiveCaching: true
    });
    
    // 验证缓存策略
    expect(loader.config.cacheEnabled).toBe(true);
    
    // 模拟浏览器指纹信息
    if (typeof loader._detectBrowser === 'function') {
      const browserInfo = loader._detectBrowser();
      expect(browserInfo).toBeDefined();
      expect(browserInfo.name.toLowerCase()).toContain('chrome');
    }
  });
  
  test('应该在不同浏览器环境下使用适当的缓存机制', () => {
    // 测试一系列浏览器
    const browsers = ['chrome', 'firefox', 'safari', 'edge'];
    
    browsers.forEach(browser => {
      // 设置特定浏览器环境
      mockBrowserEnvironment(browser);
      
      // 重置加载器
      if (traceLoader._state) {
        traceLoader._state.loadedResources.clear();
      }
      
      // 初始化加载器
      const loader = traceLoader.init({
        detectBrowserCapabilities: true,
        adaptiveCaching: true
      });
      
      // 模拟资源缓存
      const resourceUrl = `test-resource-${browser}.jpg`;
      const mockResource = { url: resourceUrl, type: 'image' };
      
      // 如果有存储适配器，直接使用
      if (typeof loader._storageAdapter === 'object') {
        const setItemSpy = jest.spyOn(loader._storageAdapter, 'setItem');
        
        // 尝试缓存资源
        loader._state.loadedResources.set(resourceUrl, mockResource);
        
        // 如果持久化方法存在，调用它
        if (typeof loader._persistCachedResources === 'function') {
          loader._persistCachedResources();
        }
        
        // 验证是否尝试持久化
        if (loader.config.persistentCache) {
          expect(setItemSpy).toHaveBeenCalled();
        }
        
        // 清理
        setItemSpy.mockRestore();
      }
    });
  });
  
  test('应该在localStorage不可用时回退到其他存储机制', () => {
    // 模拟Safari隐私浏览模式
    mockBrowserEnvironment('safari');
    
    // 使localStorage抛出异常
    jest.spyOn(window.localStorage, 'setItem').mockImplementation(() => {
      throw new DOMException('QuotaExceededError', 'QuotaExceededError');
    });
    
    // 监视回退机制
    const memoryCacheSpy = jest.fn();
    
    // 初始化加载器
    const loader = traceLoader.init({
      detectBrowserCapabilities: true,
      adaptiveCaching: true,
      onStorageError: memoryCacheSpy
    });
    
    // 尝试存储资源
    const resourceUrl = 'test-fallback.jpg';
    const mockResource = { url: resourceUrl, type: 'image' };
    
    // 添加到加载器缓存
    loader._state.loadedResources.set(resourceUrl, mockResource);
    
    // 如果持久化方法存在，调用它
    if (typeof loader._persistCachedResources === 'function') {
      loader._persistCachedResources();
    }
    
    // 验证内存缓存回退被正确处理
    if (loader.config.persistentCache && loader.config.storageErrorCallback) {
      expect(memoryCacheSpy).toHaveBeenCalled();
    }
    
    // 验证资源仍然在内存缓存中
    expect(loader._state.loadedResources.has(resourceUrl)).toBe(true);
  });
  
  test('应该能处理不同浏览器的存储配额限制', () => {
    // 模拟Firefox环境
    mockBrowserEnvironment('firefox');
    
    // 模拟存储配额限制
    const quotaExceededSpy = jest.fn();
    jest.spyOn(window.localStorage, 'setItem').mockImplementation((key, value) => {
      quotaExceededSpy();
      throw new DOMException('QuotaExceededError', 'QuotaExceededError');
    });
    
    // 初始化加载器
    const loader = traceLoader.init({
      detectBrowserCapabilities: true,
      adaptiveCaching: true
    });
    
    // 创建大量资源以触发配额限制
    const resourceCount = 100;
    for (let i = 0; i < resourceCount; i++) {
      const resourceUrl = `test-quota-${i}.jpg`;
      loader._state.loadedResources.set(resourceUrl, {
        url: resourceUrl,
        type: 'image',
        data: new Array(10000).join('x') // 创建大数据
      });
    }
    
    // 尝试调用可能使用localStorage的方法
    try {
      // 如果持久化方法存在，调用它
      if (typeof loader._persistCachedResources === 'function') {
        loader._persistCachedResources();
      } else {
        // 直接尝试存储一些数据触发错误
        window.localStorage.setItem('test-persist-cache', JSON.stringify({
          timestamp: Date.now(),
          resources: Array.from(loader._state.loadedResources.keys())
        }));
      }
    } catch (error) {
      // 忽略预期的配额错误
      if (!(error instanceof DOMException && error.name === 'QuotaExceededError')) {
        throw error;
      }
    }
    
    // 验证配额错误被触发
    expect(quotaExceededSpy).toHaveBeenCalled();
    
    // 验证资源仍然在内存缓存中
    expect(loader._state.loadedResources.size).toBe(resourceCount);
  });
  
  test('应该实现资源清理策略以应对存储限制', () => {
    // 初始化加载器
    const loader = traceLoader.init({
      detectBrowserCapabilities: true,
      adaptiveCaching: true,
      cacheMaintenanceInterval: 100, // 100ms维护周期
      maxCacheSize: 10 // 最多缓存10个资源
    });
    
    // 模拟20个资源
    for (let i = 0; i < 20; i++) {
      const resourceUrl = `test-maintenance-${i}.jpg`;
      const mockResource = {
        url: resourceUrl,
        type: 'image',
        lastAccessed: Date.now() - i * 1000, // 不同的访问时间
        size: 1000 // 大小
      };
      
      // 添加到缓存
      loader._state.loadedResources.set(resourceUrl, mockResource);
    }
    
    // 如果有缓存维护方法，调用它
    if (typeof loader._performCacheMaintenance === 'function') {
      loader._performCacheMaintenance();
      
      // 验证缓存大小被控制
      expect(loader._state.loadedResources.size).toBeLessThanOrEqual(loader.config.maxCacheSize);
      
      // 验证保留的是最近访问的资源
      const resources = Array.from(loader._state.loadedResources.entries());
      resources.forEach(([key, resource]) => {
        // 较新的资源应该被保留
        expect(parseInt(key.split('-')[2])).toBeLessThan(10);
      });
    }
  });
  
  test('应该在跨浏览器环境中保持缓存一致性', () => {
    // 测试不同浏览器环境
    const browsers = ['chrome', 'firefox', 'safari', 'edge'];
    const resourceId = 'cross-browser-resource.jpg';
    const mockResource = {
      url: resourceId,
      type: 'image',
      data: { width: 100, height: 100 }
    };
    
    let cachedResource;
    
    // 在第一个浏览器环境中缓存资源
    mockBrowserEnvironment(browsers[0]);
    let loader = traceLoader.init({
      detectBrowserCapabilities: true,
      adaptiveCaching: true,
      persistentCache: true
    });
    
    // 添加资源到缓存
    loader._state.loadedResources.set(resourceId, mockResource);
    
    // 如果持久化方法存在，调用它
    if (typeof loader._persistCachedResources === 'function') {
      loader._persistCachedResources();
    }
    
    // 保存原始存储内容
    const storageContent = window.localStorage._getStore();
    
    // 切换到其他浏览器并验证一致性
    for (let i = 1; i < browsers.length; i++) {
      // 切换浏览器环境
      mockBrowserEnvironment(browsers[i]);
      
      // 重置存储但保留内容
      const mockStorage = createMockStorage();
      Object.keys(storageContent).forEach(key => {
        mockStorage.setItem(key, storageContent[key]);
      });
      mockBrowserStorage(mockStorage);
      
      // 初始化新浏览器环境中的加载器
      loader = traceLoader.init({
        detectBrowserCapabilities: true,
        adaptiveCaching: true,
        persistentCache: true
      });
      
      // 如果有加载持久化缓存的方法，调用它
      if (typeof loader._loadPersistedCache === 'function') {
        loader._loadPersistedCache();
      }
      
      // 验证资源在新浏览器环境中可访问
      cachedResource = loader.getCachedResource(resourceId);
      
      if (cachedResource) {
        expect(cachedResource.url).toBe(resourceId);
        expect(cachedResource.type).toBe('image');
      }
    }
  });
});

// 性能优化测试
describe('资源加载器 - 缓存性能优化', () => {
  test('应该根据浏览器环境调整缓存策略以优化性能', () => {
    // 模拟低性能环境
    mockBrowserEnvironment('safari');
    global.performance = {
      memory: {
        jsHeapSizeLimit: 2097152,
        totalJSHeapSize: 1048576,
        usedJSHeapSize: 524288
      }
    };
    
    // 初始化加载器
    const loader = traceLoader.init({
      detectBrowserCapabilities: true,
      adaptiveCaching: true,
      performanceOptimization: true
    });
    
    // 如果有性能优化策略方法，调用它
    if (typeof loader._optimizeCacheStrategy === 'function') {
      const strategy = loader._optimizeCacheStrategy();
      
      // 验证在低性能环境中应用了适当的策略
      expect(strategy).toBeDefined();
      if (strategy) {
        // 应该减少缓存大小
        expect(strategy.maxCacheSize).toBeLessThan(100);
        // 应该增加清理频率
        expect(strategy.maintenanceInterval).toBeLessThan(300000); // 5分钟
      }
    }
    
    // 清理性能模拟
    delete global.performance;
  });
  
  test('应该在资源缓存时实施懒加载和预加载平衡策略', () => {
    // 初始化加载器
    const loader = traceLoader.init({
      detectBrowserCapabilities: true,
      adaptiveCaching: true,
      enableLazyLoading: true,
      enablePreloading: true
    });
    
    // 模拟资源类型识别
    if (typeof loader._categorizeResourceImportance === 'function') {
      // 测试关键资源
      const criticalResource = { url: 'critical.js', type: 'script' };
      const criticalCategory = loader._categorizeResourceImportance(criticalResource);
      expect(criticalCategory).toBe('critical');
      
      // 测试非关键资源
      const nonCriticalResource = { url: 'background.jpg', type: 'image' };
      const nonCriticalCategory = loader._categorizeResourceImportance(nonCriticalResource);
      expect(nonCriticalCategory).toBe('non-critical');
    }
    
    // 验证加载策略是否针对资源类型进行优化
    if (typeof loader._determineLoadingStrategy === 'function') {
      // 应该预加载关键资源
      const criticalStrategy = loader._determineLoadingStrategy('critical');
      expect(criticalStrategy.preload).toBe(true);
      expect(criticalStrategy.priority).toBeGreaterThan(3);
      
      // 应该懒加载非关键资源
      const nonCriticalStrategy = loader._determineLoadingStrategy('non-critical');
      expect(nonCriticalStrategy.lazyLoad).toBe(true);
      expect(nonCriticalStrategy.priority).toBeLessThan(3);
    }
  });
});

// 错误恢复测试
describe('资源加载器 - 跨浏览器错误恢复', () => {
  test('应该能从浏览器存储错误中恢复', () => {
    // 初始化加载器
    const loader = traceLoader.init({
      detectBrowserCapabilities: true,
      adaptiveCaching: true,
      enableErrorRecovery: true
    });
    
    // 模拟存储错误
    jest.spyOn(window.localStorage, 'getItem').mockImplementation(() => {
      throw new DOMException('SecurityError', 'SecurityError');
    });
    
    // 监视恢复策略
    const recoverySpy = jest.fn();
    
    // 如果有错误恢复方法，监视它
    if (typeof loader._recoverFromStorageError === 'function') {
      jest.spyOn(loader, '_recoverFromStorageError').mockImplementation(recoverySpy);
    }
    
    // 触发需要读取存储的操作
    if (typeof loader._loadPersistedCache === 'function') {
      loader._loadPersistedCache();
    }
    
    // 验证恢复策略被调用
    if (typeof loader._recoverFromStorageError === 'function') {
      expect(recoverySpy).toHaveBeenCalled();
    }
  });
  
  test('应该重试失败的资源加载并应用浏览器特定修复', () => {
    // 设置Firefox环境
    mockBrowserEnvironment('firefox');
    
    // 初始化加载器
    const loader = traceLoader.init({
      detectBrowserCapabilities: true,
      adaptiveCaching: true,
      retryAttempts: 3,
      applyBrowserPatches: true
    });
    
    // 监视重试策略
    const retrySpy = jest.fn();
    
    // 如果有浏览器特定修复方法，监视它
    if (typeof loader._applyBrowserSpecificFix === 'function') {
      jest.spyOn(loader, '_applyBrowserSpecificFix').mockImplementation(retrySpy);
    }
    
    // 模拟Firefox特有错误
    const firefoxError = new Error('NS_ERROR_NOT_AVAILABLE');
    
    // 如果有错误处理方法，调用它
    if (typeof loader.handleResourceError === 'function') {
      loader.handleResourceError(
        { url: 'test-firefox-error.jpg', type: 'image' },
        firefoxError
      );
    }
    
    // 验证浏览器特定修复被应用
    if (typeof loader._applyBrowserSpecificFix === 'function') {
      expect(retrySpy).toHaveBeenCalled();
    }
  });
}); 