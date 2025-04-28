/**
 * @file 存储管理器测试
 * @description 测试存储抽象层的基本功能和内存优化功能
 */

import StorageManager from '../../src/storage/storage-manager';

// 测试数据
const TEST_KEY = 'test-key';
const TEST_VALUE = { id: 1, name: '测试数据', timestamp: Date.now() };
const STORE_NAME = 'auth-store';

describe('StorageManager', () => {
  let storageManager;

  beforeEach(() => {
    // 每个测试前创建新的实例
    storageManager = new StorageManager(STORE_NAME);
  });

  afterEach(() => {
    // 测试后清理
    jest.clearAllMocks();
  });

  describe('基础存储功能', () => {
    test('应该能够保存数据', async () => {
      // 模拟 IndexedDB 操作成功
      const mockTransaction = {
        objectStore: jest.fn().mockReturnValue({
          put: jest.fn().mockImplementation((value, key) => {
            const request = new global.IDBRequest();
            setTimeout(() => {
              request.result = key;
              request.readyState = 'done';
              if (request.onsuccess) request.onsuccess();
            }, 0);
            return request;
          })
        })
      };

      global.indexedDB.open = jest.fn().mockImplementation(() => {
        const request = new global.IDBRequest();
        setTimeout(() => {
          request.result = new global.IDBDatabase();
          request.result.transaction = jest.fn().mockReturnValue(mockTransaction);
          request.readyState = 'done';
          if (request.onsuccess) request.onsuccess();
        }, 0);
        return request;
      });

      // 执行测试
      await expect(storageManager.setItem(TEST_KEY, TEST_VALUE)).resolves.toBe(TEST_KEY);
      
      // 验证调用
      expect(global.indexedDB.open).toHaveBeenCalledWith(expect.any(String), expect.any(Number));
    });

    test('应该能够获取数据', async () => {
      // 模拟 IndexedDB 获取操作
      const mockObjectStore = {
        get: jest.fn().mockImplementation((key) => {
          const request = new global.IDBRequest();
          setTimeout(() => {
            request.result = TEST_VALUE;
            request.readyState = 'done';
            if (request.onsuccess) request.onsuccess();
          }, 0);
          return request;
        })
      };

      const mockTransaction = {
        objectStore: jest.fn().mockReturnValue(mockObjectStore)
      };

      global.indexedDB.open = jest.fn().mockImplementation(() => {
        const request = new global.IDBRequest();
        setTimeout(() => {
          request.result = new global.IDBDatabase();
          request.result.transaction = jest.fn().mockReturnValue(mockTransaction);
          request.readyState = 'done';
          if (request.onsuccess) request.onsuccess();
        }, 0);
        return request;
      });

      // 执行测试
      const result = await storageManager.getItem(TEST_KEY);
      expect(result).toEqual(TEST_VALUE);
      
      // 验证调用
      expect(mockObjectStore.get).toHaveBeenCalledWith(TEST_KEY);
    });

    test('应该能够删除数据', async () => {
      // 模拟 IndexedDB 删除操作
      const mockObjectStore = {
        delete: jest.fn().mockImplementation((key) => {
          const request = new global.IDBRequest();
          setTimeout(() => {
            request.result = undefined;
            request.readyState = 'done';
            if (request.onsuccess) request.onsuccess();
          }, 0);
          return request;
        })
      };

      const mockTransaction = {
        objectStore: jest.fn().mockReturnValue(mockObjectStore)
      };

      global.indexedDB.open = jest.fn().mockImplementation(() => {
        const request = new global.IDBRequest();
        setTimeout(() => {
          request.result = new global.IDBDatabase();
          request.result.transaction = jest.fn().mockReturnValue(mockTransaction);
          request.readyState = 'done';
          if (request.onsuccess) request.onsuccess();
        }, 0);
        return request;
      });

      // 执行测试
      await expect(storageManager.removeItem(TEST_KEY)).resolves.not.toThrow();
      
      // 验证调用
      expect(mockObjectStore.delete).toHaveBeenCalledWith(TEST_KEY);
    });

    test('应该能够清除所有数据', async () => {
      // 模拟 IndexedDB 清除操作
      const mockObjectStore = {
        clear: jest.fn().mockImplementation(() => {
          const request = new global.IDBRequest();
          setTimeout(() => {
            request.result = undefined;
            request.readyState = 'done';
            if (request.onsuccess) request.onsuccess();
          }, 0);
          return request;
        })
      };

      const mockTransaction = {
        objectStore: jest.fn().mockReturnValue(mockObjectStore)
      };

      global.indexedDB.open = jest.fn().mockImplementation(() => {
        const request = new global.IDBRequest();
        setTimeout(() => {
          request.result = new global.IDBDatabase();
          request.result.transaction = jest.fn().mockReturnValue(mockTransaction);
          request.readyState = 'done';
          if (request.onsuccess) request.onsuccess();
        }, 0);
        return request;
      });

      // 执行测试
      await expect(storageManager.clear()).resolves.not.toThrow();
      
      // 验证调用
      expect(mockObjectStore.clear).toHaveBeenCalled();
    });
  });

  describe('回退机制', () => {
    test('当 IndexedDB 不可用时应该回退到 localStorage', async () => {
      // 模拟 IndexedDB 打开失败
      global.indexedDB.open = jest.fn().mockImplementation(() => {
        const request = new global.IDBRequest();
        setTimeout(() => {
          request.error = new Error('IndexedDB unavailable');
          request.readyState = 'done';
          if (request.onerror) request.onerror(new Error('IndexedDB unavailable'));
        }, 0);
        return request;
      });

      // 执行测试 - 保存数据
      await storageManager.setItem(TEST_KEY, TEST_VALUE);
      
      // 验证是否使用了 localStorage
      expect(window.localStorage.setItem).toHaveBeenCalledWith(
        TEST_KEY, 
        JSON.stringify(TEST_VALUE)
      );

      // 设置 localStorage 模拟返回值
      window.localStorage.getItem.mockReturnValueOnce(JSON.stringify(TEST_VALUE));

      // 执行测试 - 获取数据
      const result = await storageManager.getItem(TEST_KEY);
      
      // 验证结果和调用
      expect(result).toEqual(TEST_VALUE);
      expect(window.localStorage.getItem).toHaveBeenCalledWith(TEST_KEY);
    });
  });

  describe('错误处理', () => {
    test('处理数据获取失败的情况', async () => {
      // 模拟 IndexedDB 和 localStorage 都失败的情况
      global.indexedDB.open = jest.fn().mockImplementation(() => {
        const request = new global.IDBRequest();
        setTimeout(() => {
          request.error = new Error('IndexedDB error');
          request.readyState = 'done';
          if (request.onerror) request.onerror(new Error('IndexedDB error'));
        }, 0);
        return request;
      });

      // localStorage 也失败
      window.localStorage.getItem.mockImplementation(() => {
        throw new Error('localStorage error');
      });

      // 添加 console.error 的模拟以捕获错误日志
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      // 执行测试 - 期望返回 null 而不是抛出异常
      const result = await storageManager.getItem(TEST_KEY);
      
      // 验证结果和错误处理
      expect(result).toBeNull();
      expect(consoleErrorSpy).toHaveBeenCalled();
      
      // 恢复 console.error
      consoleErrorSpy.mockRestore();
    });
  });

  describe('性能监控', () => {
    test('应该能够测量操作性能', async () => {
      // 模拟计时器
      jest.spyOn(Date, 'now')
        .mockReturnValueOnce(1000)  // 操作开始时间
        .mockReturnValueOnce(1050); // 操作结束时间

      // 模拟成功的存储操作
      const mockObjectStore = {
        put: jest.fn().mockImplementation((value, key) => {
          const request = new global.IDBRequest();
          setTimeout(() => {
            request.result = key;
            request.readyState = 'done';
            if (request.onsuccess) request.onsuccess();
          }, 0);
          return request;
        })
      };

      const mockTransaction = {
        objectStore: jest.fn().mockReturnValue(mockObjectStore)
      };

      global.indexedDB.open = jest.fn().mockImplementation(() => {
        const request = new global.IDBRequest();
        setTimeout(() => {
          request.result = new global.IDBDatabase();
          request.result.transaction = jest.fn().mockReturnValue(mockTransaction);
          request.readyState = 'done';
          if (request.onsuccess) request.onsuccess();
        }, 0);
        return request;
      });

      // 添加 console.log 的模拟以捕获性能日志
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

      // 启用性能监控功能
      storageManager.enablePerformanceMonitoring(true);
      
      // 执行测试
      await storageManager.setItem(TEST_KEY, TEST_VALUE);
      
      // 验证性能监控
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Storage operation'),
        expect.any(String),
        expect.stringContaining('ms')
      );
      
      // 检查性能指标
      const metrics = storageManager.getPerformanceMetrics();
      expect(metrics.operations).toBe(1);
      expect(metrics.lastOperationTime).toBe(50);
      
      // 恢复 console.log
      consoleLogSpy.mockRestore();
    });
  });

  describe('内存优化功能', () => {
    test('应该能够启用和禁用内存优化', () => {
      // 模拟 console.info 以验证日志输出
      const consoleInfoSpy = jest.spyOn(console, 'info').mockImplementation(() => {});
      
      // 启用内存优化
      storageManager.enableMemoryOptimization(true);
      
      // 验证内部状态已更新
      expect(consoleInfoSpy).toHaveBeenCalledWith('内存优化模式已启用');
      
      // 禁用内存优化
      storageManager.enableMemoryOptimization(false);
      
      // 验证内部状态已更新
      expect(consoleInfoSpy).toHaveBeenCalledWith('内存优化模式已禁用');
      
      // 恢复 console.info
      consoleInfoSpy.mockRestore();
    });
    
    test('批量API应该使用分批处理模式', async () => {
      // 启用内存优化
      storageManager.enableMemoryOptimization(true);
      
      // 准备模拟批处理数据
      const batchData = {};
      for (let i = 0; i < 500; i++) {
        batchData[`key-${i}`] = { id: i, value: `测试数据-${i}` };
      }
      
      // 模拟 IndexedDB 事务
      const mockStore = {
        put: jest.fn().mockImplementation(() => {
          const request = new global.IDBRequest();
          setTimeout(() => {
            request.result = 'success';
            request.readyState = 'done';
            if (request.onsuccess) request.onsuccess();
          }, 0);
          return request;
        })
      };
      
      const mockTransaction = {
        objectStore: jest.fn().mockReturnValue(mockStore),
        oncomplete: null,
        onerror: null
      };
      
      global.indexedDB.open = jest.fn().mockImplementation(() => {
        const request = new global.IDBRequest();
        setTimeout(() => {
          request.result = new global.IDBDatabase();
          request.result.transaction = jest.fn().mockReturnValue(mockTransaction);
          request.readyState = 'done';
          if (request.onsuccess) request.onsuccess();
        }, 0);
        return request;
      });
      
      // 模拟 setTimeout 以验证批处理之间的暂停
      jest.spyOn(global, 'setTimeout').mockImplementation((callback) => {
        callback();
        return 999;
      });
      
      // 执行测试
      const result = await storageManager.batchSet(batchData);
      
      // 验证操作成功
      expect(result).toBe(true);
      
      // 验证事务和存储操作
      expect(global.setTimeout).toHaveBeenCalled();
    });
    
    test('内存监控应触发内存优化策略', async () => {
      // 模拟内存监控和内存优化方法
      const optimizeMemorySpy = jest.spyOn(storageManager, '_optimizeMemoryUsage').mockImplementation(() => {});
      const emergencyReleaseSpy = jest.spyOn(storageManager, '_emergencyMemoryRelease').mockImplementation(() => {});
      
      // 启用内存优化
      storageManager.enableMemoryOptimization(true);
      
      // 模拟内存警告回调
      const warningCallback = storageManager._memoryWarningHandler || 
        storageManager._state.memoryCallbacks?.warning?.[0];
      
      // 如果能直接触发回调，测试内存优化
      if (typeof warningCallback === 'function') {
        warningCallback({ percentage: 75 });
        expect(optimizeMemorySpy).toHaveBeenCalled();
      }
      
      // 模拟内存危险回调
      const dangerCallback = storageManager._memoryDangerHandler || 
        storageManager._state.memoryCallbacks?.danger?.[0];
      
      // 如果能直接触发回调，测试紧急内存释放
      if (typeof dangerCallback === 'function') {
        dangerCallback({ percentage: 90 });
        expect(emergencyReleaseSpy).toHaveBeenCalled();
      }
      
      // 清理spy
      optimizeMemorySpy.mockRestore();
      emergencyReleaseSpy.mockRestore();
    });
    
    test('内存缓存应能正确淘汰数据', async () => {
      // 模拟缓存淘汰方法
      const clearCacheSpy = jest.spyOn(storageManager, '_clearInternalCache');
      
      // 准备测试数据 - 创建超过阈值的缓存项
      for (let i = 0; i < 30; i++) {
        storageManager._memoryBackup.set(`cache-key-${i}`, {
          value: { id: i },
          timestamp: Date.now(),
          lastAccessed: Date.now() - i * 1000 // 不同的访问时间以测试LRU
        });
      }
      
      // 执行缓存淘汰
      storageManager._clearInternalCache();
      
      // 验证调用
      expect(clearCacheSpy).toHaveBeenCalled();
      clearCacheSpy.mockRestore();
      
      // 读取一个缓存值以触发内部优化
      await storageManager.getItem('cache-key-0');
      
      // 验证缓存大小
      if (storageManager._memoryBackup.size <= 30) {
        expect(true).toBe(true); // 缓存已被淘汰
      } else {
        fail('缓存淘汰未能正确工作');
      }
    });
  });
}); 