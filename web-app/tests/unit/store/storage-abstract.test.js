/**
 * @file storage-abstract.test.js
 * @description 存储抽象层测试 - 食品溯源系统
 * @jest-environment jsdom
 */

'use strict';

// 导入存储抽象层
const StorageAbstract = require('../../../components/modules/store/storage-abstract');

// 模拟浏览器环境
const mockBrowserEnvironment = (features) => {
  // 保存原始值
  const originalIndexedDB = window.indexedDB;
  const originalLocalStorage = window.localStorage;
  
  // 清理模拟
  afterEach(() => {
    window.indexedDB = originalIndexedDB;
    Object.defineProperty(window, 'localStorage', {
      value: originalLocalStorage,
      configurable: true,
      writable: true
    });
    
    // 重置存储抽象层状态
    StorageAbstract._state.initialized = false;
    StorageAbstract._state.db = null;
    StorageAbstract._state.storageType = null;
    StorageAbstract._state.memoryStorage.clear();
    StorageAbstract._state.supported = {
      indexedDB: false,
      localStorage: false,
      memory: true
    };
  });

  // 模拟 IndexedDB
  if (!features.hasIndexedDB) {
    delete window.indexedDB;
  }
  
  // 模拟 localStorage
  if (!features.hasLocalStorage) {
    const mockLocalStorage = {
      getItem: jest.fn(() => {
        throw new Error('localStorage not available');
      }),
      setItem: jest.fn(() => {
        throw new Error('localStorage not available');
      }),
      removeItem: jest.fn(() => {
        throw new Error('localStorage not available');
      }),
      clear: jest.fn(() => {
        throw new Error('localStorage not available');
      })
    };
    Object.defineProperty(window, 'localStorage', {
      value: mockLocalStorage,
      configurable: true,
      writable: true
    });
  }
};

// 存储特性配置
const storageFeatures = {
  modern: {
    hasIndexedDB: true,
    hasLocalStorage: true
  },
  limited: {
    hasIndexedDB: false,
    hasLocalStorage: true
  },
  minimal: {
    hasIndexedDB: false,
    hasLocalStorage: false
  }
};

// 模拟IndexedDB成功响应
const mockIndexedDBSuccess = () => {
  const mockStore = {
    put: jest.fn().mockImplementation(() => {
      const request = {};
      setTimeout(() => {
        if (request.onsuccess) request.onsuccess();
      }, 0);
      return request;
    }),
    get: jest.fn().mockImplementation((key) => {
      const request = {};
      setTimeout(() => {
        request.result = `value-${key}`;
        if (request.onsuccess) request.onsuccess();
      }, 0);
      return request;
    }),
    delete: jest.fn().mockImplementation(() => {
      const request = {};
      setTimeout(() => {
        if (request.onsuccess) request.onsuccess();
      }, 0);
      return request;
    }),
    clear: jest.fn().mockImplementation(() => {
      const request = {};
      setTimeout(() => {
        if (request.onsuccess) request.onsuccess();
      }, 0);
      return request;
    }),
    openCursor: jest.fn().mockImplementation(() => {
      const request = {};
      setTimeout(() => {
        if (request.onsuccess) request.onsuccess({ target: { result: null } });
      }, 0);
      return request;
    })
  };
  
  const mockTransaction = {
    objectStore: jest.fn().mockReturnValue(mockStore)
  };
  
  const mockDB = {
    transaction: jest.fn().mockReturnValue(mockTransaction),
    objectStoreNames: {
      contains: jest.fn().mockReturnValue(true)
    },
    createObjectStore: jest.fn().mockReturnValue(mockStore)
  };
  
  const indexedDBOpenRequest = {};
  
  window.indexedDB = {
    open: jest.fn().mockImplementation(() => {
      setTimeout(() => {
        indexedDBOpenRequest.result = mockDB;
        if (indexedDBOpenRequest.onsuccess) {
          indexedDBOpenRequest.onsuccess({ target: indexedDBOpenRequest });
        }
      }, 0);
      return indexedDBOpenRequest;
    })
  };
  
  return { mockDB, mockStore, indexedDBOpenRequest };
};

// 模拟IndexedDB失败响应
const mockIndexedDBFailure = () => {
  const indexedDBOpenRequest = {};
  
  window.indexedDB = {
    open: jest.fn().mockImplementation(() => {
      setTimeout(() => {
        indexedDBOpenRequest.error = new Error('IndexedDB失败');
        if (indexedDBOpenRequest.onerror) {
          indexedDBOpenRequest.onerror({ target: indexedDBOpenRequest });
        }
      }, 0);
      return indexedDBOpenRequest;
    })
  };
  
  return { indexedDBOpenRequest };
};

// 测试套件
describe('存储抽象层 - 基本功能测试', () => {
  beforeEach(() => {
    // 使用现代浏览器环境
    mockBrowserEnvironment(storageFeatures.modern);
    
    // 配置存储抽象层
    StorageAbstract.config.logErrors = false; // 禁用错误日志，避免污染测试输出
  });
  
  test('应该能够正确初始化', () => {
    const storage = StorageAbstract.init();
    
    expect(storage).toBe(StorageAbstract);
    expect(storage._state.initialized).toBe(true);
    expect(storage._state.memoryStorage).toBeInstanceOf(Map);
  });
  
  test('应该能够检测浏览器支持', () => {
    // 现代浏览器环境
    mockBrowserEnvironment(storageFeatures.modern);
    const modernStorage = StorageAbstract.init();
    expect(modernStorage._state.supported.localStorage).toBe(true);
    
    // 有限支持环境
    mockBrowserEnvironment(storageFeatures.limited);
    const limitedStorage = StorageAbstract.init();
    expect(limitedStorage._state.supported.indexedDB).toBe(false);
    expect(limitedStorage._state.supported.localStorage).toBe(true);
    
    // 最小支持环境
    mockBrowserEnvironment(storageFeatures.minimal);
    const minimalStorage = StorageAbstract.init();
    expect(minimalStorage._state.supported.indexedDB).toBe(false);
    expect(minimalStorage._state.supported.localStorage).toBe(false);
    expect(minimalStorage._state.supported.memory).toBe(true);
  });
  
  test('应该根据支持情况选择合适的存储类型', async () => {
    // 在现代浏览器中，应该使用IndexedDB
    mockBrowserEnvironment(storageFeatures.modern);
    const { mockDB } = mockIndexedDBSuccess();
    const modernStorage = StorageAbstract.init();
    
    // 等待异步初始化完成
    await new Promise(resolve => setTimeout(resolve, 10));
    expect(modernStorage._state.db).toBe(mockDB);
    expect(modernStorage._state.storageType).toBe(StorageAbstract.types.INDEXED_DB);
    
    // 在有限支持环境中，应该使用localStorage
    mockBrowserEnvironment(storageFeatures.limited);
    const limitedStorage = StorageAbstract.init();
    expect(limitedStorage._state.storageType).toBe(StorageAbstract.types.LOCAL_STORAGE);
    
    // 在最小支持环境中，应该使用内存存储
    mockBrowserEnvironment(storageFeatures.minimal);
    const minimalStorage = StorageAbstract.init();
    expect(minimalStorage._state.storageType).toBe(StorageAbstract.types.MEMORY);
  });
});

describe('存储抽象层 - 存储操作测试', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockBrowserEnvironment(storageFeatures.modern);
    StorageAbstract.config.logErrors = false;
  });
  
  afterEach(() => {
    jest.useRealTimers();
  });
  
  test('能够存取值 - IndexedDB', async () => {
    // 模拟IndexedDB
    const { mockStore } = mockIndexedDBSuccess();
    
    // 初始化
    const storage = StorageAbstract.init();
    
    // 等待异步初始化完成
    jest.runAllTimers();
    
    // 存储值
    const setPromise = storage.set('testKey', 'testValue');
    jest.runAllTimers();
    await setPromise;
    
    // 验证调用
    expect(mockStore.put).toHaveBeenCalledWith('testValue', 'testKey');
    
    // 获取值
    const getPromise = storage.get('testKey');
    jest.runAllTimers();
    const value = await getPromise;
    
    // 验证返回值
    expect(value).toBe('value-testKey');
  });
  
  test('能够存取值 - localStorage', async () => {
    // 模拟有限环境
    mockBrowserEnvironment(storageFeatures.limited);
    
    // 初始化
    const storage = StorageAbstract.init();
    
    // 保存原始方法
    const originalSetItem = localStorage.setItem;
    const originalGetItem = localStorage.getItem;
    
    // 模拟方法
    localStorage.setItem = jest.fn();
    localStorage.getItem = jest.fn().mockReturnValue(JSON.stringify('localStorageValue'));
    
    // 存储值
    await storage.set('testKey', 'testValue');
    
    // 验证调用
    expect(localStorage.setItem).toHaveBeenCalledWith('testKey', JSON.stringify('testValue'));
    
    // 获取值
    const value = await storage.get('testKey');
    
    // 验证返回值
    expect(localStorage.getItem).toHaveBeenCalledWith('testKey');
    expect(value).toBe('localStorageValue');
    
    // 恢复原始方法
    localStorage.setItem = originalSetItem;
    localStorage.getItem = originalGetItem;
  });
  
  test('能够存取值 - 内存存储', async () => {
    // 模拟最小环境
    mockBrowserEnvironment(storageFeatures.minimal);
    
    // 初始化
    const storage = StorageAbstract.init();
    
    // 存储值
    await storage.set('testKey', 'testValue');
    
    // 获取值
    const value = await storage.get('testKey');
    
    // 验证返回值
    expect(value).toBe('testValue');
  });
  
  test('应该能够删除值', async () => {
    // 初始化
    const storage = StorageAbstract.init();
    
    // 等待异步初始化完成
    jest.runAllTimers();
    
    // 模拟数据存储
    await storage.set('testKey', 'testValue');
    
    // 删除值
    await storage.remove('testKey');
    
    // 尝试获取已删除的值
    const value = await storage.get('testKey');
    
    // 验证值已被删除
    expect(value).toBeNull();
  });
  
  test('应该能够清空存储', async () => {
    // 初始化
    const storage = StorageAbstract.init();
    
    // 等待异步初始化完成
    jest.runAllTimers();
    
    // 模拟数据存储
    await storage.set('testKey1', 'testValue1');
    await storage.set('testKey2', 'testValue2');
    
    // 清空存储
    await storage.clear();
    
    // 尝试获取已清空的值
    const value1 = await storage.get('testKey1');
    const value2 = await storage.get('testKey2');
    
    // 验证值已被清空
    expect(value1).toBeNull();
    expect(value2).toBeNull();
  });
});

describe('存储抽象层 - 错误处理和降级', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockBrowserEnvironment(storageFeatures.modern);
    StorageAbstract.config.logErrors = false;
  });
  
  afterEach(() => {
    jest.useRealTimers();
  });
  
  test('IndexedDB失败时应该降级到localStorage', async () => {
    // 模拟IndexedDB失败
    mockIndexedDBFailure();
    
    // 初始化
    const storage = StorageAbstract.init();
    
    // 等待异步初始化完成
    jest.runAllTimers();
    
    // 验证降级到localStorage
    expect(storage._state.storageType).toBe(StorageAbstract.types.LOCAL_STORAGE);
  });
  
  test('localStorage失败时应该降级到内存存储', async () => {
    // 模拟有限环境
    mockBrowserEnvironment(storageFeatures.limited);
    
    // 模拟localStorage设置错误
    const originalSetItem = localStorage.setItem;
    localStorage.setItem = jest.fn().mockImplementation(() => {
      throw new Error('localStorage失败');
    });
    
    // 初始化
    const storage = StorageAbstract.init();
    
    // 尝试设置值，应该捕获错误并降级到内存存储
    const result = await storage.set('testKey', 'testValue');
    
    // 验证内存存储中有数据
    expect(result).toBe(true);
    expect(storage._state.memoryStorage.get('testKey')).toBe('testValue');
    
    // 恢复原始方法
    localStorage.setItem = originalSetItem;
  });
  
  test('存储配额溢出时应该尝试清理空间', async () => {
    // 模拟有限环境
    mockBrowserEnvironment(storageFeatures.limited);
    
    // 模拟localStorage配额溢出
    const originalSetItem = localStorage.setItem;
    let quotaExceeded = true;
    localStorage.setItem = jest.fn().mockImplementation((key, value) => {
      if (quotaExceeded) {
        const error = new Error('QuotaExceededError');
        error.name = 'QuotaExceededError';
        quotaExceeded = false; // 第二次尝试成功
        throw error;
      }
    });
    
    // 保存原始清理方法并模拟
    const originalTryCleanup = StorageAbstract._tryCleanupStorage;
    StorageAbstract._tryCleanupStorage = jest.fn();
    
    // 初始化
    const storage = StorageAbstract.init();
    
    // 尝试设置值
    const result = await storage.set('testKey', 'testValue');
    
    // 验证清理方法被调用
    expect(StorageAbstract._tryCleanupStorage).toHaveBeenCalled();
    expect(result).toBe(true);
    
    // 恢复原始方法
    localStorage.setItem = originalSetItem;
    StorageAbstract._tryCleanupStorage = originalTryCleanup;
  });
});

describe('存储抽象层 - 高级功能测试', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockBrowserEnvironment(storageFeatures.modern);
    StorageAbstract.config.logErrors = false;
  });
  
  afterEach(() => {
    jest.useRealTimers();
  });
  
  test('应该能够处理复杂对象', async () => {
    // 初始化
    const storage = StorageAbstract.init();
    
    // 等待异步初始化完成
    jest.runAllTimers();
    
    // 创建复杂对象
    const complexObject = {
      string: 'test',
      number: 123,
      boolean: true,
      array: [1, 2, 3],
      nestedObject: {
        a: 'a',
        b: 'b'
      },
      date: new Date()
    };
    
    // 存储复杂对象
    await storage.set('complexObject', complexObject);
    
    // 获取值
    const value = await storage.get('complexObject');
    
    // 验证返回的是对象（而不是字符串）
    expect(typeof value).toBe('object');
    expect(value.string).toBe('test');
    expect(value.number).toBe(123);
    expect(value.boolean).toBe(true);
    expect(Array.isArray(value.array)).toBe(true);
    expect(value.nestedObject.a).toBe('a');
  });
  
  test('应该能够获取所有存储的键值对', async () => {
    // 初始化
    const storage = StorageAbstract.init();
    storage._state.storageType = StorageAbstract.types.MEMORY; // 使用内存存储简化测试
    
    // 存储多个值
    await storage.set('key1', 'value1');
    await storage.set('key2', 'value2');
    await storage.set('key3', 'value3');
    
    // 获取所有值
    const allValues = await storage.getAll();
    
    // 验证返回所有键值对
    expect(allValues).toEqual({
      key1: 'value1',
      key2: 'value2',
      key3: 'value3'
    });
  });
  
  test('应该能够查询存储类型和支持状态', async () => {
    // 初始化
    mockIndexedDBSuccess();
    const storage = StorageAbstract.init();
    
    // 等待异步初始化完成
    jest.runAllTimers();
    
    // 获取存储类型
    const storageType = storage.getStorageType();
    expect(storageType).toBe(StorageAbstract.types.INDEXED_DB);
    
    // 获取支持状态
    const supportStatus = storage.getSupportStatus();
    expect(supportStatus.indexedDB).toBe(true);
    expect(supportStatus.memory).toBe(true);
  });
}); 