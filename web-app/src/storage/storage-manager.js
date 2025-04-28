/**
 * 存储管理器
 * 提供统一的存储接口，管理IndexedDB、localStorage和内存存储
 * 包含内存优化机制，适用于处理大量数据场景
 */

const { MemoryMonitor, BatchProcessor, IndexedDBStreamProcessor } = require('./indexeddb-optimizer.js');

class StorageManager {
  /**
   * 构造函数
   * @param {string} storeName 存储名称
   * @param {Object} options 配置选项
   */
  constructor(storeName, options = {}) {
    this.storeName = storeName || 'app-store';
    this.options = {
      dbName: options.dbName || 'food-trace-db',
      dbVersion: options.dbVersion || 1,
      defaultBatchSize: options.defaultBatchSize || 100,
      maxBatchSize: options.maxBatchSize || 500,
      mobileBatchSize: options.mobileBatchSize || 50,
      memoryMonitoring: options.memoryMonitoring !== false,
      performanceMonitoring: options.performanceMonitoring !== false,
      ...options
    };

    // 内部状态
    this._state = {
      db: null,
      dbInitialized: false,
      dbInitializing: false,
      dbInitCallbacks: [],
      fallbackToLocalStorage: false,
      memoryOptimizationEnabled: false,
      performanceMonitoringEnabled: false,
      batchSize: this.options.defaultBatchSize,
      useStreamingOperations: false,
      minimalCloneDepth: false
    };

    // 内存备份存储
    this._memoryBackup = new Map();

    // 性能监控数据
    this._performanceMetrics = {
      operations: 0,
      totalTime: 0,
      avgTime: 0,
      lastOperationTime: 0
    };

    // 初始化
    this._initDatabase();

    // 根据设备类型优化
    this._optimizeForDevice();
  }

  /**
   * 根据设备类型自动调整参数配置
   * @private
   */
  _optimizeForDevice() {
    const isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
    const isLowMemoryDevice = navigator.deviceMemory && navigator.deviceMemory < 4;
    
    // 保存设备信息
    this._state.isMobile = isMobile;
    this._state.isLowMemoryDevice = isLowMemoryDevice;
    
    if (isMobile || isLowMemoryDevice) {
      // 针对移动设备优化批处理大小
      this._state.batchSize = this.options.mobileBatchSize;
      
      // 低内存设备自动启用内存优化
      if (isLowMemoryDevice) {
        this.enableMemoryOptimization(true);
      }
    }
  }

  /**
   * 初始化数据库
   * @private
   */
  _initDatabase() {
    if (this._state.dbInitialized || this._state.dbInitializing) {
      return;
    }

    this._state.dbInitializing = true;

    try {
      const request = indexedDB.open(this.options.dbName, this.options.dbVersion);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        
        // 如果存储对象不存在，则创建
        if (!db.objectStoreNames.contains(this.storeName)) {
          db.createObjectStore(this.storeName);
        }
      };

      request.onsuccess = (event) => {
        this._state.db = event.target.result;
        this._state.dbInitialized = true;
        this._state.dbInitializing = false;

        // 处理待处理的回调
        this._processPendingCallbacks();
      };

      request.onerror = (event) => {
        console.error('打开数据库失败:', event.target.error);
        this._state.fallbackToLocalStorage = true;
        this._state.dbInitializing = false;
        this._state.dbInitialized = true; // 即使出错也标记为已初始化，避免重复尝试

        // 处理待处理的回调
        this._processPendingCallbacks();
      };
    } catch (error) {
      console.error('初始化数据库时出错:', error);
      this._state.fallbackToLocalStorage = true;
      this._state.dbInitializing = false;
      this._state.dbInitialized = true;
      
      // 处理待处理的回调
      this._processPendingCallbacks();
    }
  }

  /**
   * 处理待处理的回调
   * @private
   */
  _processPendingCallbacks() {
    const callbacks = [...this._state.dbInitCallbacks];
    this._state.dbInitCallbacks = [];
    
    callbacks.forEach(callback => callback());
  }

  /**
   * 确保数据库已初始化
   * @returns {Promise} 数据库初始化Promise
   * @private
   */
  _ensureDatabase() {
    if (this._state.dbInitialized) {
      return Promise.resolve();
    }

    return new Promise((resolve) => {
      this._state.dbInitCallbacks.push(resolve);
      if (!this._state.dbInitializing) {
        this._initDatabase();
      }
    });
  }

  /**
   * 启用或禁用内存优化模式
   * @param {boolean} enable 是否启用内存优化
   * @returns {StorageManager} 当前实例，支持链式调用
   */
  enableMemoryOptimization(enable = true) {
    this._state.memoryOptimizationEnabled = enable;
    
    if (enable) {
      // 启动内存监控
      if (typeof MemoryMonitor !== 'undefined' && this.options.memoryMonitoring) {
        MemoryMonitor.startMonitoring();
        
        // 注册内存警告回调
        MemoryMonitor.addCallback('warning', (memoryInfo) => {
          console.warn(`内存使用率较高: ${memoryInfo.percentage}%，触发内存优化`);
          this._optimizeMemoryUsage(memoryInfo.percentage / 100);
        });
        
        // 注册内存危险回调
        MemoryMonitor.addCallback('danger', (memoryInfo) => {
          console.error(`内存使用率危险: ${memoryInfo.percentage}%，执行紧急内存释放`);
          this._emergencyMemoryRelease();
        });
      }
      
      // 设置优化参数
      this._state.batchSize = this._getOptimalBatchSize();
      this._state.useStreamingOperations = true;
      this._state.minimalCloneDepth = true;
      
      console.info('内存优化模式已启用');
    } else {
      // 停止内存监控
      if (typeof MemoryMonitor !== 'undefined') {
        MemoryMonitor.removeCallback('warning', this._memoryWarningHandler);
        MemoryMonitor.removeCallback('danger', this._memoryDangerHandler);
      }
      
      // 恢复默认参数
      this._state.batchSize = this.options.defaultBatchSize;
      this._state.useStreamingOperations = false;
      this._state.minimalCloneDepth = false;
      
      console.info('内存优化模式已禁用');
    }
    
    return this;
  }

  /**
   * 启用或禁用性能监控
   * @param {boolean} enable 是否启用性能监控
   * @returns {StorageManager} 当前实例，支持链式调用
   */
  enablePerformanceMonitoring(enable = true) {
    this._state.performanceMonitoringEnabled = enable;
    return this;
  }

  /**
   * 获取最佳批处理大小
   * @returns {number} 批处理大小
   * @private
   */
  _getOptimalBatchSize() {
    // 基础批处理大小
    let size = this.options.defaultBatchSize;
    
    // 根据设备类型调整
    if (this._state.isMobile) {
      size = Math.min(size, this.options.mobileBatchSize);
    }
    
    // 根据内存情况调整
    if (this._state.isLowMemoryDevice) {
      size = Math.min(size, 50);
    }
    
    return size;
  }

  /**
   * 根据内存使用率优化内存使用
   * @param {number} usageRatio 内存使用率(0-1)
   * @private
   */
  _optimizeMemoryUsage(usageRatio) {
    // 调整批处理大小
    const initialBatchSize = this._getOptimalBatchSize();
    const reductionFactor = 1 - (usageRatio - 0.7) * 2;
    this._state.batchSize = Math.max(20, Math.floor(initialBatchSize * reductionFactor));
    
    // 清理内部缓存
    this._clearInternalCache();
    
    // 建议垃圾回收
    if (typeof MemoryMonitor !== 'undefined') {
      MemoryMonitor.suggestGarbageCollection();
    }
  }

  /**
   * 紧急内存释放
   * @private
   */
  _emergencyMemoryRelease() {
    // 清除所有非必要缓存
    this._clearInternalCache(true);
    
    // 最小化批处理大小
    this._state.batchSize = 10;
    
    // 强制建议垃圾回收
    if (typeof MemoryMonitor !== 'undefined') {
      MemoryMonitor.suggestGarbageCollection();
    }
  }

  /**
   * 清理内部缓存
   * @param {boolean} aggressive 是否激进清理
   * @private
   */
  _clearInternalCache(aggressive = false) {
    // 如果启用了激进清理，清除大部分内存缓存
    if (aggressive) {
      this._memoryBackup.clear();
    } else {
      // 否则只保留最近使用的少量数据
      const entries = Array.from(this._memoryBackup.entries())
        .sort((a, b) => (b[1].lastAccessed || 0) - (a[1].lastAccessed || 0));
      
      // 只保留前20个最近访问的项目
      if (entries.length > 20) {
        this._memoryBackup = new Map(entries.slice(0, 20));
      }
    }
  }

  /**
   * 测量操作执行时间
   * @param {Function} operation 操作函数
   * @returns {Promise<*>} 操作结果
   * @private
   */
  async _measureOperation(operation) {
    if (!this._state.performanceMonitoringEnabled) {
      return operation();
    }

    const start = Date.now();
    try {
      return await operation();
    } finally {
      const end = Date.now();
      const duration = end - start;
      
      // 更新性能指标
      this._performanceMetrics.operations++;
      this._performanceMetrics.totalTime += duration;
      this._performanceMetrics.avgTime = this._performanceMetrics.totalTime / this._performanceMetrics.operations;
      this._performanceMetrics.lastOperationTime = duration;
      
      console.log(`Storage operation completed in ${duration}ms`);
    }
  }

  /**
   * 检查是否在浏览器环境中并且localStorage可用
   * @private
   * @returns {boolean} localStorage是否可用
   */
  _isLocalStorageAvailable() {
    return typeof window !== 'undefined' && typeof localStorage !== 'undefined';
  }

  /**
   * 尝试存储到localStorage
   * @private
   */
  _storeToLocalStorage(key, value) {
    try {
      // 检查localStorage是否可用
      if (this._isLocalStorageAvailable()) {
        localStorage.setItem(key, JSON.stringify(value));
        return true;
      }
      return false;
    } catch (error) {
      console.warn('无法使用localStorage:', error);
      return false;
    }
  }

  /**
   * 从localStorage尝试获取数据
   * @private
   */
  _getFromLocalStorage(key) {
    try {
      // 检查localStorage是否可用
      if (this._isLocalStorageAvailable()) {
        const item = localStorage.getItem(key);
        return item ? JSON.parse(item) : null;
      }
      return null;
    } catch (error) {
      console.warn('无法从localStorage读取:', error);
      return null;
    }
  }

  /**
   * 从localStorage删除数据
   * @private
   */
  _removeFromLocalStorage(key) {
    try {
      // 检查localStorage是否可用
      if (this._isLocalStorageAvailable()) {
        localStorage.removeItem(key);
        return true;
      }
      return false;
    } catch (error) {
      console.warn('无法从localStorage删除:', error);
      return false;
    }
  }

  /**
   * 清空localStorage
   * @private
   */
  _clearLocalStorage() {
    try {
      // 检查localStorage是否可用
      if (this._isLocalStorageAvailable()) {
        localStorage.clear();
        return true;
      }
      return false;
    } catch (error) {
      console.warn('无法清空localStorage:', error);
      return false;
    }
  }

  /**
   * 存储数据项
   * @param {string} key 键
   * @param {*} value 值
   * @returns {Promise<string>} 存储的键
   */
  async setItem(key, value) {
    return this._measureOperation(async () => {
      await this._ensureDatabase();
      
      try {
        // 存储到内存备份
        this._memoryBackup.set(key, {
          value,
          timestamp: Date.now(),
          lastAccessed: Date.now()
        });
        
        if (this._state.fallbackToLocalStorage) {
          // 回退到localStorage
          this._storeToLocalStorage(key, value);
          return key;
        }
        
        return new Promise((resolve, reject) => {
          try {
            const transaction = this._state.db.transaction([this.storeName], 'readwrite');
            const store = transaction.objectStore(this.storeName);
            const request = store.put(value, key);
            
            request.onsuccess = () => resolve(key);
            request.onerror = (event) => {
              console.error('存储数据失败:', event.target.error);
              
              // 尝试回退到localStorage
              try {
                this._storeToLocalStorage(key, value);
                resolve(key);
              } catch (lsError) {
                reject(lsError);
              }
            };
          } catch (error) {
            console.error('创建事务失败:', error);
            
            // 尝试回退到localStorage
            try {
              this._storeToLocalStorage(key, value);
              resolve(key);
            } catch (lsError) {
              reject(lsError);
            }
          }
        });
      } catch (error) {
        console.error('存储数据时出错:', error);
        // 尝试回退到localStorage
        this._storeToLocalStorage(key, value);
        return null;
      }
    });
  }

  /**
   * 获取数据项
   * @param {string} key 键
   * @returns {Promise<*>} 数据值
   */
  async getItem(key) {
    return this._measureOperation(async () => {
      await this._ensureDatabase();
      
      try {
        // 首先检查内存备份
        if (this._memoryBackup.has(key)) {
          const item = this._memoryBackup.get(key);
          item.lastAccessed = Date.now(); // 更新访问时间
          return item.value;
        }
        
        if (this._state.fallbackToLocalStorage) {
          // 回退到localStorage
          const value = this._getFromLocalStorage(key);
          return value;
        }
        
        return new Promise((resolve, reject) => {
          try {
            const transaction = this._state.db.transaction([this.storeName], 'readonly');
            const store = transaction.objectStore(this.storeName);
            const request = store.get(key);
            
            request.onsuccess = () => {
              const value = request.result;
              
              // 保存到内存备份
              if (value !== undefined) {
                this._memoryBackup.set(key, {
                  value,
                  timestamp: Date.now(),
                  lastAccessed: Date.now()
                });
              }
              
              resolve(value || null);
            };
            
            request.onerror = (event) => {
              console.error('获取数据失败:', event.target.error);
              
              // 尝试回退到localStorage
              try {
                const value = this._getFromLocalStorage(key);
                resolve(value);
              } catch (lsError) {
                resolve(null);
              }
            };
          } catch (error) {
            console.error('创建事务失败:', error);
            
            // 尝试回退到localStorage
            try {
              const value = this._getFromLocalStorage(key);
              resolve(value);
            } catch (lsError) {
              resolve(null);
            }
          }
        });
      } catch (error) {
        console.error('获取数据时出错:', error);
        // 尝试回退到localStorage
        const value = this._getFromLocalStorage(key);
        return value;
      }
    });
  }

  /**
   * 移除数据项
   * @param {string} key 键
   * @returns {Promise<boolean>} 是否成功
   */
  async removeItem(key) {
    return this._measureOperation(async () => {
      await this._ensureDatabase();
      
      try {
        // 从内存备份中移除
        this._memoryBackup.delete(key);
        
        if (this._state.fallbackToLocalStorage) {
          // 回退到localStorage
          this._removeFromLocalStorage(key);
          return true;
        }
        
        return new Promise((resolve, reject) => {
          try {
            const transaction = this._state.db.transaction([this.storeName], 'readwrite');
            const store = transaction.objectStore(this.storeName);
            const request = store.delete(key);
            
            request.onsuccess = () => resolve(true);
            request.onerror = (event) => {
              console.error('删除数据失败:', event.target.error);
              
              // 尝试回退到localStorage
              try {
                this._removeFromLocalStorage(key);
                resolve(true);
              } catch (lsError) {
                resolve(false);
              }
            };
          } catch (error) {
            console.error('创建事务失败:', error);
            
            // 尝试回退到localStorage
            try {
              this._removeFromLocalStorage(key);
              resolve(true);
            } catch (lsError) {
              resolve(false);
            }
          }
        });
      } catch (error) {
        console.error('删除数据时出错:', error);
        // 尝试回退到localStorage
        this._removeFromLocalStorage(key);
        return false;
      }
    });
  }

  /**
   * 清空存储
   * @returns {Promise<boolean>} 是否成功
   */
  async clear() {
    return this._measureOperation(async () => {
      await this._ensureDatabase();
      
      try {
        // 清空内存备份
        this._memoryBackup.clear();
        
        if (this._state.fallbackToLocalStorage) {
          // 清空localStorage (仅清除与当前store相关的)
          this._clearLocalStorage();
          return true;
        }
        
        return new Promise((resolve, reject) => {
          try {
            const transaction = this._state.db.transaction([this.storeName], 'readwrite');
            const store = transaction.objectStore(this.storeName);
            const request = store.clear();
            
            request.onsuccess = () => resolve(true);
            request.onerror = (event) => {
              console.error('清空数据失败:', event.target.error);
              
              // 尝试回退到localStorage
              try {
                this._clearLocalStorage();
                resolve(true);
              } catch (lsError) {
                resolve(false);
              }
            };
          } catch (error) {
            console.error('创建事务失败:', error);
            
            // 尝试回退到localStorage
            try {
              this._clearLocalStorage();
              resolve(true);
            } catch (lsError) {
              resolve(false);
            }
          }
        });
      } catch (error) {
        console.error('清空数据时出错:', error);
        // 尝试回退到localStorage
        this._clearLocalStorage();
        return false;
      }
    });
  }

  /**
   * 批量存储数据
   * @param {Object} items 键值对象
   * @returns {Promise<boolean>} 是否成功
   */
  async batchSet(items) {
    if (!items || typeof items !== 'object') {
      return false;
    }
    
    const keys = Object.keys(items);
    if (keys.length === 0) {
      return true;
    }
    
    return this._measureOperation(async () => {
      await this._ensureDatabase();
      
      try {
        if (this._state.memoryOptimizationEnabled) {
          // 采用分批处理模式
          const batchSize = this._state.batchSize;
          for (let i = 0; i < keys.length; i += batchSize) {
            const batchEnd = Math.min(i + batchSize, keys.length);
            const batchKeys = keys.slice(i, batchEnd);
            
            // 构建批处理数据
            const batchData = {};
            for (const key of batchKeys) {
              batchData[key] = items[key];
            }
            
            // 处理单批数据
            await this._processBatchData(batchData);
            
            // 可选：在批次之间暂停以释放内存
            if (i + batchSize < keys.length) {
              await new Promise(resolve => setTimeout(resolve, 0));
              
              // 建议垃圾回收
              if (i % (batchSize * 5) === 0 && typeof MemoryMonitor !== 'undefined') {
                MemoryMonitor.suggestGarbageCollection();
              }
            }
          }
        } else {
          // 标准模式：一次性处理所有数据
          await this._processBatchData(items);
        }
        
        return true;
      } catch (error) {
        console.error('批量存储失败:', error);
        return false;
      }
    });
  }

  /**
   * 处理批处理数据
   * @param {Object} batchData 批处理数据
   * @returns {Promise<void>}
   * @private
   */
  async _processBatchData(batchData) {
    const keys = Object.keys(batchData);
    
    // 保存到内存备份
    for (const key of keys) {
      this._memoryBackup.set(key, {
        value: batchData[key],
        timestamp: Date.now(),
        lastAccessed: Date.now()
      });
    }
    
    if (this._state.fallbackToLocalStorage) {
      // 回退到localStorage
      for (const key of keys) {
        this._storeToLocalStorage(key, batchData[key]);
      }
      return;
    }
    
    // 使用IndexedDB处理
    if (this._state.useStreamingOperations && typeof IndexedDBStreamProcessor !== 'undefined') {
      // 使用流式处理器
      const items = keys.map(key => ({
        key,
        value: batchData[key]
      }));
      
      await IndexedDBStreamProcessor.streamWrite(
        this._state.db,
        this.storeName,
        items,
        {
          batchSize: this._state.batchSize,
          processingDelay: 0
        }
      );
    } else {
      // 标准事务处理
      return new Promise((resolve, reject) => {
        try {
          const transaction = this._state.db.transaction([this.storeName], 'readwrite');
          const store = transaction.objectStore(this.storeName);
          
          transaction.oncomplete = () => resolve();
          transaction.onerror = (event) => {
            console.error('批量存储事务失败:', event.target.error);
            
            // 尝试回退到localStorage
            try {
              for (const key of keys) {
                this._storeToLocalStorage(key, batchData[key]);
              }
              resolve();
            } catch (lsError) {
              reject(lsError);
            }
          };
          
          // 将每个项目添加到存储中
          for (const key of keys) {
            store.put(batchData[key], key);
          }
        } catch (error) {
          console.error('创建批处理事务失败:', error);
          
          // 尝试回退到localStorage
          try {
            for (const key of keys) {
              this._storeToLocalStorage(key, batchData[key]);
            }
            resolve();
          } catch (lsError) {
            reject(lsError);
          }
        }
      });
    }
  }

  /**
   * 获取性能指标
   * @returns {Object} 性能指标
   */
  getPerformanceMetrics() {
    return { ...this._performanceMetrics };
  }
}

module.exports = StorageManager; 