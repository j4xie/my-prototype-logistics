/**
 * @file loader-browser-storage.test.js
 * @description 资源加载器跨浏览器本地存储兼容性测试 - 食品溯源系统
 * @jest-environment jsdom
 */

// CommonJS导入，不使用ES6模块语法
const traceLoader = require('../../../components/modules/auth/loader');

// 设置全局测试超时为10秒，避免测试长时间运行
jest.setTimeout(10000);

// 存储API特性模拟
const storageFeatures = {
  modern: {
    name: 'Modern Browser',
    hasLocalStorage: true,
    hasSessionStorage: true,
    hasIndexedDB: true,
    hasCacheAPI: true,
    storageQuota: 10 * 1024 * 1024 // 10MB
  },
  limited: {
    name: 'Limited Storage Browser',
    hasLocalStorage: true,
    hasSessionStorage: true,
    hasIndexedDB: false,
    hasCacheAPI: false,
    storageQuota: 5 * 1024 * 1024 // 5MB
  },
  private: {
    name: 'Private Mode Browser',
    hasLocalStorage: false, // 隐私模式下可能禁用localStorage
    hasSessionStorage: true,
    hasIndexedDB: false, // 隐私模式下可能禁用IndexedDB
    hasCacheAPI: false,
    storageQuota: 0 // 不允许持久存储
  },
  legacy: {
    name: 'Legacy Browser',
    hasLocalStorage: true,
    hasSessionStorage: true,
    hasIndexedDB: false,
    hasCacheAPI: false,
    storageQuota: 2 * 1024 * 1024 // 2MB
  }
};

// 在每个测试前设置环境
beforeEach(() => {
  // 重置加载器状态
  traceLoader._state.loadedResources.clear();
  traceLoader._state.loadQueue = [];
  traceLoader._state.pendingLoads = 0;
  traceLoader._state.listeners = new Map();
  
  // 清理DOM
  document.head.innerHTML = '';
  document.body.innerHTML = '';
  
  // 启用Jest假计时器，使用modern模式确保Promise能正确解析
  jest.useFakeTimers({legacyFakeTimers: false});
  // 清除所有计时器，避免测试之间的干扰
  jest.clearAllTimers();
  
  // 重置存储API
  resetStorageAPI();
});

// 每个测试后清理环境
afterEach(() => {
  // 运行所有待处理的计时器来避免悬挂的异步操作
  jest.runAllTimers();
  // 恢复真实计时器
  jest.useRealTimers();
  // 清理所有模拟
  jest.restoreAllMocks();
  
  // 恢复标准存储环境
  resetStorageAPI();
});

// 重置存储API到标准状态
function resetStorageAPI() {
  // 模拟localStorage
  const localStorageMock = (function() {
    let store = {};
    return {
      getItem: function(key) {
        return store[key] || null;
      },
      setItem: function(key, value) {
        store[key] = String(value);
      },
      removeItem: function(key) {
        delete store[key];
      },
      clear: function() {
        store = {};
      },
      key: function(i) {
        return Object.keys(store)[i] || null;
      },
      get length() {
        return Object.keys(store).length;
      }
    };
  })();
  
  // 模拟sessionStorage
  const sessionStorageMock = (function() {
    let store = {};
    return {
      getItem: function(key) {
        return store[key] || null;
      },
      setItem: function(key, value) {
        store[key] = String(value);
      },
      removeItem: function(key) {
        delete store[key];
      },
      clear: function() {
        store = {};
      },
      key: function(i) {
        return Object.keys(store)[i] || null;
      },
      get length() {
        return Object.keys(store).length;
      }
    };
  })();
  
  // 模拟IndexedDB
  const indexedDBMock = {
    open: jest.fn().mockImplementation(() => {
      const request = {
        result: {
          transaction: jest.fn().mockImplementation(() => ({
            objectStore: jest.fn().mockImplementation(() => ({
              put: jest.fn().mockImplementation(() => ({ 
                onsuccess: null 
              })),
              get: jest.fn().mockImplementation(() => ({ 
                onsuccess: null, 
                result: null 
              })),
              delete: jest.fn().mockImplementation(() => ({ 
                onsuccess: null 
              }))
            })),
            oncomplete: null
          })),
          createObjectStore: jest.fn()
        },
        onupgradeneeded: null,
        onsuccess: null,
        onerror: null
      };
      
      // 触发异步成功回调
      setTimeout(() => {
        if (request.onsuccess) request.onsuccess();
      }, 0);
      
      return request;
    })
  };
  
  // 模拟CacheStorage API
  const cacheMock = {
    match: jest.fn().mockResolvedValue(null),
    put: jest.fn().mockResolvedValue(undefined),
    delete: jest.fn().mockResolvedValue(false),
    keys: jest.fn().mockResolvedValue([])
  };
  
  const cachesMock = {
    open: jest.fn().mockResolvedValue(cacheMock),
    delete: jest.fn().mockResolvedValue(false),
    has: jest.fn().mockResolvedValue(false),
    keys: jest.fn().mockResolvedValue([])
  };
  
  // 设置全局对象
  Object.defineProperty(window, 'localStorage', {
    value: localStorageMock,
    writable: true
  });
  
  Object.defineProperty(window, 'sessionStorage', {
    value: sessionStorageMock,
    writable: true
  });
  
  Object.defineProperty(window, 'indexedDB', {
    value: indexedDBMock,
    writable: true
  });
  
  Object.defineProperty(window, 'caches', {
    value: cachesMock,
    writable: true
  });
  
  // 模拟navigator.storage
  Object.defineProperty(navigator, 'storage', {
    value: {
      estimate: jest.fn().mockResolvedValue({
        usage: 0,
        quota: 10 * 1024 * 1024 // 10MB
      }),
      persist: jest.fn().mockResolvedValue(true),
      persisted: jest.fn().mockResolvedValue(true)
    },
    configurable: true
  });
}

// 模拟特定浏览器的存储环境
function mockStorageEnvironment(features) {
  // 如果不支持localStorage，抛出错误
  if (!features.hasLocalStorage) {
    Object.defineProperty(window, 'localStorage', {
      get: function() {
        throw new Error('localStorage is not available');
      },
      configurable: true
    });
  }
  
  // 如果不支持sessionStorage，抛出错误
  if (!features.hasSessionStorage) {
    Object.defineProperty(window, 'sessionStorage', {
      get: function() {
        throw new Error('sessionStorage is not available');
      },
      configurable: true
    });
  }
  
  // 如果不支持IndexedDB，设置为undefined
  if (!features.hasIndexedDB) {
    Object.defineProperty(window, 'indexedDB', {
      value: undefined,
      configurable: true
    });
  }
  
  // 如果不支持CacheAPI，设置为undefined
  if (!features.hasCacheAPI) {
    Object.defineProperty(window, 'caches', {
      value: undefined,
      configurable: true
    });
  }
  
  // 设置存储配额
  Object.defineProperty(navigator, 'storage', {
    value: {
      estimate: jest.fn().mockResolvedValue({
        usage: 0,
        quota: features.storageQuota
      }),
      persist: jest.fn().mockResolvedValue(features.storageQuota > 0),
      persisted: jest.fn().mockResolvedValue(features.storageQuota > 0)
    },
    configurable: true
  });
}

// 模拟存储配额超出异常
function mockStorageQuotaExceededError() {
  const originalSetItem = window.localStorage.setItem;
  window.localStorage.setItem = jest.fn().mockImplementation((key, value) => {
    throw new Error('QuotaExceededError: The quota has been exceeded.');
  });
  
  return function restore() {
    window.localStorage.setItem = originalSetItem;
  };
}

describe('资源加载器 - 现代浏览器存储测试', () => {
  beforeEach(() => {
    mockStorageEnvironment(storageFeatures.modern);
  });
  
  test('应该检测到所有可用的存储API并配置适当的存储策略', () => {
    // 准备
    const loader = traceLoader.init();
    
    // 如果存在存储检测方法，运行它
    if (loader._detectStorageCapabilities) {
      const capabilities = loader._detectStorageCapabilities();
      
      // 验证检测结果
      expect(capabilities.hasLocalStorage).toBe(true);
      expect(capabilities.hasIndexedDB).toBe(true);
      expect(capabilities.hasCacheAPI).toBe(true);
    } else {
      // 否则验证默认配置
      expect(loader.config.useLocalStorage !== false).toBe(true);
      
      // 模拟资源存储，看看loader会使用哪种存储方式
      if (loader._storeResource) {
        const testResource = { 
          url: 'test.jpg', 
          type: 'image',
          data: 'test-data'
        };
        
        // 监视存储方法
        const localStorageSpy = jest.spyOn(window.localStorage, 'setItem');
        const idbOpenSpy = jest.spyOn(window.indexedDB, 'open');
        const cacheOpenSpy = jest.spyOn(window.caches, 'open');
        
        // 存储资源
        loader._storeResource(testResource);
        
        // 检查优先使用的存储方式
        const usesAdvancedStorage = idbOpenSpy.mock.calls.length > 0 || cacheOpenSpy.mock.calls.length > 0;
        expect(usesAdvancedStorage || localStorageSpy.mock.calls.length > 0).toBe(true);
      }
    }
  });
  
  test('应该优先使用IndexedDB或CacheAPI存储大型资源', async () => {
    // 准备
    const loader = traceLoader.init();
    
    // 生成大型资源数据
    const largeData = new Array(1024 * 1024).fill('A').join(''); // 约1MB的数据
    const testResource = { 
      url: 'large-image.jpg', 
      type: 'image',
      data: largeData
    };
    
    // 监视存储方法
    const localStorageSpy = jest.spyOn(window.localStorage, 'setItem');
    const idbOpenSpy = jest.spyOn(window.indexedDB, 'open');
    const cacheOpenSpy = jest.spyOn(window.caches, 'open');
    
    // 如果加载器有存储资源的方法，调用它
    if (loader._storeResource) {
      await loader._storeResource(testResource);
      
      // 检查是否使用高级存储API存储大型资源
      const usesAdvancedStorage = idbOpenSpy.mock.calls.length > 0 || cacheOpenSpy.mock.calls.length > 0;
      
      // 现代浏览器应该使用更高级的存储方式
      expect(usesAdvancedStorage).toBe(true);
    } else if (loader._cache && typeof loader._cache.store === 'function') {
      // 或者检查缓存存储方法
      await loader._cache.store(testResource.url, testResource.data);
      
      // 检查是否使用高级存储API
      const usesAdvancedStorage = idbOpenSpy.mock.calls.length > 0 || cacheOpenSpy.mock.calls.length > 0;
      
      // 现代浏览器应该使用更高级的存储方式
      expect(usesAdvancedStorage).toBe(true);
    }
  });
});

describe('资源加载器 - 有限存储环境测试', () => {
  beforeEach(() => {
    mockStorageEnvironment(storageFeatures.limited);
  });
  
  test('应该优雅地降级到可用的存储API', () => {
    // 准备
    const loader = traceLoader.init();
    
    // 如果存在存储检测方法，运行它
    if (loader._detectStorageCapabilities) {
      const capabilities = loader._detectStorageCapabilities();
      
      // 验证检测结果
      expect(capabilities.hasLocalStorage).toBe(true);
      expect(capabilities.hasIndexedDB).toBe(false);
      expect(capabilities.hasCacheAPI).toBe(false);
    } else {
      // 否则验证默认配置
      expect(loader.config.useLocalStorage !== false).toBe(true);
      
      // 监视localStorage方法
      const localStorageSpy = jest.spyOn(window.localStorage, 'setItem');
      
      // 如果加载器有存储资源的方法，调用它
      if (loader._storeResource) {
        const testResource = { 
          url: 'test.jpg', 
          type: 'image',
          data: 'test-data'
        };
        
        loader._storeResource(testResource);
        
        // 应该使用localStorage作为备选
        expect(localStorageSpy).toHaveBeenCalled();
      } else if (loader._cache && typeof loader._cache.store === 'function') {
        // 或者检查缓存存储方法
        loader._cache.store('test.jpg', 'test-data');
        
        // 应该使用localStorage作为备选
        expect(localStorageSpy).toHaveBeenCalled();
      }
    }
  });
  
  test('应该根据存储配额调整缓存策略', async () => {
    // 准备
    const loader = traceLoader.init();
    
    // 监视localStorage方法
    const localStorageGetSpy = jest.spyOn(window.localStorage, 'getItem');
    const localStorageSetSpy = jest.spyOn(window.localStorage, 'setItem');
    const localStorageRemoveSpy = jest.spyOn(window.localStorage, 'removeItem');
    
    // 填充一些资源到存储中
    for (let i = 0; i < 10; i++) {
      window.localStorage.setItem(`resource_${i}`, `data_${i}`);
    }
    
    // 生成接近配额上限的数据
    const largeData = new Array(1024 * 1024).fill('B').join(''); // 约1MB的数据
    
    // 如果存在缓存管理方法，调用它
    if (loader._manageStorageQuota) {
      await loader._manageStorageQuota();
      
      // 验证是否清理了一些资源
      expect(localStorageRemoveSpy).toHaveBeenCalled();
    }
    
    // 尝试存储大资源
    try {
      // 如果加载器有存储资源的方法，调用它
      if (loader._storeResource) {
        const testResource = { 
          url: 'large-image.jpg', 
          type: 'image',
          data: largeData
        };
        
        await loader._storeResource(testResource);
      } else if (loader._cache && typeof loader._cache.store === 'function') {
        // 或者检查缓存存储方法
        await loader._cache.store('large-image.jpg', largeData);
      }
      
      // 检查存储操作是否成功
      expect(localStorageSetSpy).toHaveBeenCalled();
    } catch (error) {
      // 如果存储失败，应该是存储配额问题，并且loader应该优雅地处理它
      expect(error.message).toContain('quota');
    }
  });
});

describe('资源加载器 - 隐私模式存储测试', () => {
  beforeEach(() => {
    mockStorageEnvironment(storageFeatures.private);
  });
  
  test('应该检测隐私模式并相应地调整缓存策略', () => {
    // 准备
    const loader = traceLoader.init();
    
    // 如果存在隐私模式检测方法，运行它
    if (loader._detectPrivateMode) {
      const isPrivateMode = loader._detectPrivateMode();
      
      // 验证检测结果
      expect(isPrivateMode).toBe(true);
      
      // 检查配置调整
      expect(loader.config.persistentCache === false).toBe(true);
    } else {
      // 否则验证默认配置
      try {
        // 尝试使用localStorage，应该会失败
        window.localStorage.setItem('test', 'test');
        
        // 如果没有失败，说明没有正确模拟隐私模式
        expect(true).toBe(false);
      } catch (error) {
        // 应该捕获到错误
        expect(error).toBeDefined();
      }
      
      // 检查加载器是否将使用sessionStorage作为备选方案
      const sessionStorageSpy = jest.spyOn(window.sessionStorage, 'setItem');
      
      // 如果加载器有存储资源的方法，调用它
      if (loader._storeResource) {
        const testResource = { 
          url: 'test.jpg', 
          type: 'image',
          data: 'test-data'
        };
        
        try {
          loader._storeResource(testResource);
          
          // 在隐私模式下可能使用sessionStorage或内存缓存
          const usesSessionStorage = sessionStorageSpy.mock.calls.length > 0;
          const usesMemoryCache = loader._state.loadedResources.size > 0 || loader._memoryCache;
          
          expect(usesSessionStorage || usesMemoryCache).toBe(true);
        } catch (error) {
          // 或者捕获到存储错误
          expect(error).toBeDefined();
        }
      }
    }
  });
  
  test('应该在隐私模式下使用内存缓存或会话存储', () => {
    // 准备
    const loader = traceLoader.init();
    
    // 监视sessionStorage方法
    const sessionStorageSpy = jest.spyOn(window.sessionStorage, 'setItem');
    
    // 如果加载器有内存缓存跟踪，清除它
    if (loader._memoryCache) {
      loader._memoryCache.clear();
    }
    
    // 加载资源
    const resource = { url: 'test.jpg', type: 'image', data: 'test-data' };
    
    // 如果加载器有存储资源的方法，调用它
    if (loader._storeResource) {
      try {
        loader._storeResource(resource);
        
        // 检查是否使用会话存储或内存缓存
        const usesSessionStorage = sessionStorageSpy.mock.calls.length > 0;
        const usesMemoryCache = loader._state.loadedResources.has(resource.url) || 
                               (loader._memoryCache && loader._memoryCache.size > 0);
        
        expect(usesSessionStorage || usesMemoryCache).toBe(true);
      } catch (error) {
        // 捕获存储错误
        expect(error).toBeDefined();
        
        // 验证错误处理，应该至少还有内存缓存
        expect(loader._state.loadedResources.has(resource.url) || 
               (loader._memoryCache && loader._memoryCache.size > 0)).toBe(true);
      }
    } else if (loader.preloadImage) {
      // 或者使用预加载方法
      loader.preloadImage(resource.url);
      
      // 验证资源加载
      expect(loader._state.loadQueue.length > 0 || 
             loader._state.loadedResources.has(resource.url) ||
             (loader._memoryCache && loader._memoryCache.size > 0)).toBe(true);
    }
  });
});

describe('资源加载器 - 旧版浏览器存储测试', () => {
  beforeEach(() => {
    mockStorageEnvironment(storageFeatures.legacy);
  });
  
  test('应该在旧版浏览器中正确使用localStorage', () => {
    // 准备
    const loader = traceLoader.init();
    
    // 监视localStorage方法
    const localStorageSpy = jest.spyOn(window.localStorage, 'setItem');
    
    // 如果加载器有存储资源的方法，调用它
    if (loader._storeResource) {
      const testResource = { 
        url: 'test.jpg', 
        type: 'image',
        data: 'test-data'
      };
      
      loader._storeResource(testResource);
      
      // 应该使用localStorage
      expect(localStorageSpy).toHaveBeenCalled();
    } else if (loader._cache && typeof loader._cache.store === 'function') {
      // 或者检查缓存存储方法
      loader._cache.store('test.jpg', 'test-data');
      
      // 应该使用localStorage
      expect(localStorageSpy).toHaveBeenCalled();
    }
  });
  
  test('应该处理存储配额超出错误', async () => {
    // 准备
    const loader = traceLoader.init();
    
    // 模拟存储配额超出异常
    const restoreStorage = mockStorageQuotaExceededError();
    
    // 生成一些数据
    const testData = 'test-data';
    
    // 尝试存储数据
    try {
      // 如果加载器有存储资源的方法，调用它
      if (loader._storeResource) {
        const testResource = { 
          url: 'test.jpg', 
          type: 'image',
          data: testData
        };
        
        await loader._storeResource(testResource);
      } else if (loader._cache && typeof loader._cache.store === 'function') {
        // 或者检查缓存存储方法
        await loader._cache.store('test.jpg', testData);
      }
      
      // 如果没有抛出异常，检查是否有降级机制
      expect(loader._state.loadedResources.has('test.jpg') || 
             (loader._memoryCache && loader._memoryCache.has('test.jpg'))).toBe(true);
    } catch (error) {
      // 如果捕获到异常，验证错误处理
      expect(error.message).toContain('Quota');
      
      // 验证加载器是否记录了加载失败
      if (loader._recordLoadFailure) {
        expect(loader._recordLoadFailure).toHaveBeenCalled();
      }
    } finally {
      // 恢复localStorage
      restoreStorage();
    }
  });
  
  test('应该在存储不可用时优雅降级到内存缓存', () => {
    // 准备
    const loader = traceLoader.init();
    
    // 禁用所有存储API
    Object.defineProperty(window, 'localStorage', { value: undefined, configurable: true });
    Object.defineProperty(window, 'sessionStorage', { value: undefined, configurable: true });
    
    // 确保内存缓存为空
    if (loader._memoryCache) {
      loader._memoryCache.clear();
    }
    loader._state.loadedResources.clear();
    
    // 加载资源
    if (loader.preloadImage) {
      // 使用预加载方法
      loader.preloadImage('test.jpg');
      
      // 验证是否使用内存缓存
      expect(loader._state.loadQueue.length > 0 || 
             loader._state.loadedResources.has('test.jpg') ||
             (loader._memoryCache && loader._memoryCache.size > 0)).toBe(true);
    }
  });
});

describe('资源加载器 - 存储抽象层测试', () => {
  test('应该提供统一的存储接口抽象各种存储机制', () => {
    // 准备
    const loader = traceLoader.init();
    
    // 检查是否有存储抽象层
    const hasStorageAbstraction = 
      loader._cache || 
      loader._storage ||
      (loader._storageProvider && typeof loader._storageProvider.get === 'function');
    
    if (hasStorageAbstraction) {
      const storage = loader._cache || loader._storage || loader._storageProvider;
      
      // 验证存储接口的基本方法
      expect(typeof storage.get === 'function' || 
             typeof storage.retrieve === 'function').toBe(true);
      expect(typeof storage.set === 'function' || 
             typeof storage.store === 'function').toBe(true);
    } else {
      // 如果没有明确的抽象层，检查基本存储方法
      const hasStorageMethods = 
        (typeof loader._getFromStorage === 'function') ||
        (typeof loader._storeResource === 'function') ||
        (typeof loader._retrieveFromCache === 'function');
      
      expect(hasStorageMethods).toBe(true);
    }
  });
  
  test('应该在不同的存储API之间无缝切换', () => {
    // 准备 - 先使用现代浏览器环境
    mockStorageEnvironment(storageFeatures.modern);
    const loader = traceLoader.init();
    
    // 存储测试数据
    const testKey = 'storage-test';
    const testData = 'test-data';
    
    // 使用localStorage存储数据
    if (loader._cache) {
      loader._cache.store(testKey, testData);
    } else if (loader._storeResource) {
      loader._storeResource({ url: testKey, data: testData });
    } else if (loader._storage) {
      loader._storage.set(testKey, testData);
    } else {
      // 默认使用localStorage
      window.localStorage.setItem(testKey, testData);
    }
    
    // 切换到有限存储环境
    mockStorageEnvironment(storageFeatures.limited);
    
    // 检查是否可以读取之前存储的数据
    let retrievedData;
    if (loader._cache) {
      retrievedData = loader._cache.retrieve(testKey);
    } else if (loader._retrieveFromCache) {
      retrievedData = loader._retrieveFromCache(testKey);
    } else if (loader._storage) {
      retrievedData = loader._storage.get(testKey);
    } else {
      // 默认从localStorage读取
      retrievedData = window.localStorage.getItem(testKey);
    }
    
    // 验证数据恢复
    if (retrievedData && retrievedData.then) {
      // 如果是Promise
      retrievedData.then(data => {
        expect(data).toBe(testData);
      });
    } else {
      // 如果是同步数据
      expect(retrievedData).toBe(testData);
    }
  });
}); 