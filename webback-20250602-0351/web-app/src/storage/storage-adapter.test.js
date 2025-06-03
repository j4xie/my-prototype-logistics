/**
 * 存储抽象层单元测试
 * 创建日期: 2025-07-17
 * 版本: 1.0.0
 */

import StorageAbstraction from './storage-abstraction';

// 模拟浏览器存储API
const mockLocalStorage = (() => {
  let store = {};
  return {
    getItem: jest.fn(key => store[key] || null),
    setItem: jest.fn((key, value) => {
      store[key] = value.toString();
    }),
    removeItem: jest.fn(key => {
      delete store[key];
    }),
    clear: jest.fn(() => {
      store = {};
    }),
    key: jest.fn(index => Object.keys(store)[index] || null),
    get length() {
      return Object.keys(store).length;
    }
  };
})();

// 模拟IndexedDB
const mockIndexedDB = (() => {
  let db = null;
  const store = new Map();
  
  const mockRequest = {
    result: null,
    error: null,
    transaction: {
      oncomplete: null
    },
    onsuccess: null,
    onerror: null
  };
  
  const mockObjectStore = {
    put: jest.fn((item) => {
      const req = {...mockRequest};
      setTimeout(() => {
        store.set(item.key, item);
        if (req.onsuccess) req.onsuccess({target: {result: undefined}});
        if (req.transaction.oncomplete) req.transaction.oncomplete();
      }, 0);
      return req;
    }),
    get: jest.fn((key) => {
      const req = {...mockRequest};
      setTimeout(() => {
        req.result = store.get(key);
        if (req.onsuccess) req.onsuccess({target: {result: store.get(key)}});
      }, 0);
      return req;
    }),
    delete: jest.fn((key) => {
      const req = {...mockRequest};
      setTimeout(() => {
        store.delete(key);
        if (req.onsuccess) req.onsuccess({target: {result: undefined}});
      }, 0);
      return req;
    }),
    clear: jest.fn(() => {
      const req = {...mockRequest};
      setTimeout(() => {
        store.clear();
        if (req.onsuccess) req.onsuccess({target: {result: undefined}});
      }, 0);
      return req;
    }),
    openCursor: jest.fn(() => {
      const req = {...mockRequest};
      let index = 0;
      const keys = Array.from(store.keys());
      
      setTimeout(() => {
        if (index < keys.length) {
          req.onsuccess({
            target: {
              result: {
                value: store.get(keys[index]),
                continue: () => {
                  index++;
                  if (index < keys.length) {
                    req.onsuccess({
                      target: {
                        result: {
                          value: store.get(keys[index]),
                          continue: Function.prototype
                        }
                      }
                    });
                  } else {
                    req.onsuccess({target: {result: null}});
                  }
                }
              }
            }
          });
        } else {
          req.onsuccess({target: {result: null}});
        }
      }, 0);
      
      return req;
    })
  };
  
  const mockTransaction = {
    objectStore: jest.fn(() => mockObjectStore)
  };
  
  const mockDB = {
    transaction: jest.fn(() => mockTransaction),
    objectStoreNames: {
      contains: jest.fn(() => true)
    },
    createObjectStore: jest.fn(() => mockObjectStore)
  };
  
  return {
    open: jest.fn(() => {
      const request = {...mockRequest};
      
      setTimeout(() => {
        db = mockDB;
        request.result = db;
        if (request.onupgradeneeded) request.onupgradeneeded({target: {result: db}});
        if (request.onsuccess) request.onsuccess({target: {result: db}});
      }, 0);
      
      return request;
    })
  };
})();

// 测试开始前的设置
beforeEach(() => {
  // 清除所有模拟
  jest.clearAllMocks();
  
  // 模拟window对象
  Object.defineProperty(window, 'localStorage', {
    value: mockLocalStorage,
    writable: true
  });
  
  Object.defineProperty(window, 'indexedDB', {
    value: mockIndexedDB,
    writable: true
  });
  
  // 重置Date.now以便测试过期逻辑
  jest.spyOn(Date, 'now').mockImplementation(() => 1000);
});

describe('StorageAbstraction', () => {
  // 测试初始化和存储类型检测
  describe('初始化', () => {
    test('应该默认使用IndexedDB', async () => {
      const storage = new StorageAbstraction();
      await storage.readyPromise;
      
      expect(mockIndexedDB.open).toHaveBeenCalledWith('foodTraceabilityStorage', 1);
      expect(storage.storageType).toBe('indexeddb');
    });
    
    test('如果IndexedDB不可用，应该降级使用localStorage', async () => {
      Object.defineProperty(window, 'indexedDB', { value: undefined });
      
      const storage = new StorageAbstraction();
      await storage.readyPromise;
      
      expect(storage.storageType).toBe('localstorage');
    });
    
    test('如果localStorage不可用，应该降级使用内存存储', async () => {
      Object.defineProperty(window, 'indexedDB', { value: undefined });
      
      // 模拟localStorage抛出错误
      mockLocalStorage.setItem.mockImplementationOnce(() => {
        throw new Error('QuotaExceededError');
      });
      
      const storage = new StorageAbstraction();
      await storage.readyPromise;
      
      expect(storage.storageType).toBe('memory');
    });
    
    test('应该接受自定义选项', async () => {
      const options = {
        prefix: 'custom-prefix-',
        defaultExpiry: 60000 // 1分钟
      };
      
      const storage = new StorageAbstraction(options);
      await storage.readyPromise;
      
      expect(storage.prefix).toBe(options.prefix);
      expect(storage.defaultExpiry).toBe(options.defaultExpiry);
    });
  });
  
  // 测试存储和检索功能
  describe('存储和检索', () => {
    let storage;
    
    beforeEach(async () => {
      storage = new StorageAbstraction();
      await storage.readyPromise;
    });
    
    test('应该能够存储和检索值', async () => {
      const key = 'testKey';
      const value = { data: 'testValue' };
      
      await storage.set(key, value);
      const retrieved = await storage.get(key);
      
      expect(retrieved).toEqual(value);
    });
    
    test('不存在的键应该返回null', async () => {
      const result = await storage.get('nonExistentKey');
      expect(result).toBeNull();
    });
    
    test('过期的值应该返回null并被移除', async () => {
      const key = 'expiringKey';
      const value = 'willExpireSoon';
      
      // 设置一个短期过期的值
      await storage.set(key, value, { expiry: 500 }); // 500毫秒
      
      // 验证值存在
      let result = await storage.get(key);
      expect(result).toBe(value);
      
      // 模拟时间经过
      Date.now.mockImplementationOnce(() => 2000);
      
      // 现在值应该过期了
      result = await storage.get(key);
      expect(result).toBeNull();
    });
    
    test('应该能够自定义过期时间', async () => {
      const key = 'longLivingKey';
      const value = 'willLiveLong';
      
      // 设置一个长期的过期时间
      await storage.set(key, value, { expiry: 10000000 }); // 约115天
      
      // 模拟一些时间经过，但不足以过期
      Date.now.mockImplementationOnce(() => 1000000);
      
      // 值应该仍然有效
      const result = await storage.get(key);
      expect(result).toBe(value);
    });
  });
  
  // 测试删除功能
  describe('删除', () => {
    let storage;
    
    beforeEach(async () => {
      storage = new StorageAbstraction();
      await storage.readyPromise;
    });
    
    test('应该能够删除单个键', async () => {
      const key = 'keyToDelete';
      const value = 'valueToDelete';
      
      await storage.set(key, value);
      await storage.remove(key);
      
      const result = await storage.get(key);
      expect(result).toBeNull();
    });
    
    test('应该能够清除所有键', async () => {
      // 添加多个键
      await storage.set('key1', 'value1');
      await storage.set('key2', 'value2');
      await storage.set('key3', 'value3');
      
      // 清除所有键
      await storage.clear();
      
      // 验证所有键都已被删除
      expect(await storage.get('key1')).toBeNull();
      expect(await storage.get('key2')).toBeNull();
      expect(await storage.get('key3')).toBeNull();
    });
  });
  
  // 测试键列表功能
  describe('获取键列表', () => {
    let storage;
    
    beforeEach(async () => {
      storage = new StorageAbstraction();
      await storage.readyPromise;
    });
    
    test('应该能够列出所有存储的键', async () => {
      // 添加多个键
      await storage.set('key1', 'value1');
      await storage.set('key2', 'value2');
      await storage.set('key3', 'value3');
      
      const keys = await storage.keys();
      
      // 应该有3个键
      expect(keys.length).toBe(3);
      
      // 键应该不包含前缀
      expect(keys).toContain('key1');
      expect(keys).toContain('key2');
      expect(keys).toContain('key3');
    });
    
    test('空存储应该返回空键列表', async () => {
      const keys = await storage.keys();
      expect(keys.length).toBe(0);
    });
  });
  
  // 测试错误处理
  describe('错误处理', () => {
    let storage;
    let consoleSpy;
    
    beforeEach(async () => {
      consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      storage = new StorageAbstraction();
      await storage.readyPromise;
    });
    
    afterEach(() => {
      consoleSpy.mockRestore();
    });
    
    test('localStorage读取错误应该返回null', async () => {
      // 强制让storageType为localStorage
      storage.storageType = 'localstorage';
      
      // 模拟localStorage.getItem抛出错误
      mockLocalStorage.getItem.mockImplementationOnce(() => {
        throw new Error('读取错误');
      });
      
      const result = await storage.get('errorKey');
      expect(result).toBeNull();
      expect(consoleSpy).toHaveBeenCalled();
    });
    
    test('内存存储应该正常工作', async () => {
      // 强制让storageType为memory
      storage.storageType = 'memory';
      storage.memoryStorage = new Map();
      
      await storage.set('memoryKey', 'memoryValue');
      const result = await storage.get('memoryKey');
      
      expect(result).toBe('memoryValue');
    });
  });
}); 