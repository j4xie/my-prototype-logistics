/**
 * 食品溯源系统 - 存储抽象层
 * 版本：1.0.0
 * 
 * 提供跨浏览器兼容的统一存储API，抽象化底层存储机制差异
 * 支持IndexedDB、localStorage和内存存储的自动降级
 */

'use strict';

/**
 * 存储抽象层 - 提供统一的存储API，自动处理浏览器兼容性问题
 */
const StorageAbstract = {
  // 存储类型枚举
  types: {
    INDEXED_DB: 'indexeddb',
    LOCAL_STORAGE: 'localstorage',
    MEMORY: 'memory'
  },
  
  // 配置选项
  config: {
    dbName: 'trace-storage',
    dbVersion: 1,
    storeName: 'trace-data',
    useIndexedDB: true,
    useLocalStorage: true,
    logErrors: true,
    autoCompression: false, // 大对象自动压缩（未实现）
    fallbackChain: ['indexeddb', 'localstorage', 'memory']
  },
  
  // 存储状态
  _state: {
    initialized: false,
    db: null,
    storageType: null,
    memoryStorage: new Map(),
    supported: {
      indexedDB: false,
      localStorage: false,
      memory: true
    },
    storeOpening: false,
    pendingOperations: []
  },
  
  /**
   * 初始化存储抽象层
   * @param {Object} options - 配置选项
   * @returns {Object} - 存储抽象层实例
   */
  init(options = {}) {
    if (this._state.initialized) {
      return this;
    }
    
    // 合并配置选项
    this.config = { ...this.config, ...options };
    
    // 检测浏览器支持
    this._detectSupport();
    
    // 初始化存储
    this._initStorage();
    
    // 标记为已初始化
    this._state.initialized = true;
    return this;
  },
  
  /**
   * 检测浏览器存储支持情况
   * @private
   */
  _detectSupport() {
    // 检测 IndexedDB 支持
    this._state.supported.indexedDB = Boolean(
      window.indexedDB || 
      window.mozIndexedDB || 
      window.webkitIndexedDB || 
      window.msIndexedDB
    );
    
    // 检测 localStorage 支持
    try {
      if (typeof window.localStorage !== 'undefined') {
        // 尝试测试写入/读取
        const testKey = '__storage_test__';
        window.localStorage.setItem(testKey, testKey);
        window.localStorage.removeItem(testKey);
        this._state.supported.localStorage = true;
      }
    } catch (e) {
      this._state.supported.localStorage = false;
      this._logError('localStorage不可用', e);
    }
    
    // 内存存储始终可用
    this._state.supported.memory = true;
    
    // 打印支持情况
    if (this.config.logErrors) {
      console.info('存储支持情况:', this._state.supported);
    }
  },
  
  /**
   * 初始化存储
   * @private
   */
  _initStorage() {
    // 根据支持情况和配置选择存储类型
    for (const type of this.config.fallbackChain) {
      if (type === this.types.INDEXED_DB && this._state.supported.indexedDB && this.config.useIndexedDB) {
        this._initIndexedDB();
        return;
      } else if (type === this.types.LOCAL_STORAGE && this._state.supported.localStorage && this.config.useLocalStorage) {
        this._state.storageType = this.types.LOCAL_STORAGE;
        return;
      } else if (type === this.types.MEMORY) {
        this._state.storageType = this.types.MEMORY;
        return;
      }
    }
    
    // 默认使用内存存储
    this._state.storageType = this.types.MEMORY;
  },
  
  /**
   * 初始化 IndexedDB
   * @private
   */
  _initIndexedDB() {
    this._state.storeOpening = true;
    
    const request = indexedDB.open(this.config.dbName, this.config.dbVersion);
    
    request.onerror = (event) => {
      this._logError('IndexedDB打开失败', event.target.error);
      this._state.storeOpening = false;
      
      // 降级到下一种存储类型
      if (this._state.supported.localStorage && this.config.useLocalStorage) {
        this._state.storageType = this.types.LOCAL_STORAGE;
      } else {
        this._state.storageType = this.types.MEMORY;
      }
      
      // 执行待处理的操作
      this._processPendingOperations();
    };
    
    request.onsuccess = (event) => {
      this._state.db = event.target.result;
      this._state.storageType = this.types.INDEXED_DB;
      this._state.storeOpening = false;
      
      // 执行待处理的操作
      this._processPendingOperations();
    };
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      
      // 创建对象存储空间
      if (!db.objectStoreNames.contains(this.config.storeName)) {
        db.createObjectStore(this.config.storeName);
      }
    };
  },
  
  /**
   * 执行待处理的操作
   * @private
   */
  _processPendingOperations() {
    const operations = [...this._state.pendingOperations];
    this._state.pendingOperations = [];
    
    operations.forEach(operation => {
      switch (operation.type) {
        case 'get':
          this.get(operation.key).then(operation.resolve, operation.reject);
          break;
        case 'set':
          this.set(operation.key, operation.value).then(operation.resolve, operation.reject);
          break;
        case 'remove':
          this.remove(operation.key).then(operation.resolve, operation.reject);
          break;
        case 'clear':
          this.clear().then(operation.resolve, operation.reject);
          break;
        case 'getAll':
          this.getAll().then(operation.resolve, operation.reject);
          break;
      }
    });
  },
  
  /**
   * 记录错误日志
   * @param {string} message - 错误消息
   * @param {Error} error - 错误对象
   * @private
   */
  _logError(message, error) {
    if (this.config.logErrors) {
      console.error(`存储抽象层错误: ${message}`, error);
    }
  },
  
  /**
   * 获取存储中的值
   * @param {string} key - 存储键
   * @returns {Promise<*>} - 存储的值
   */
  get(key) {
    if (!this._state.initialized) {
      this.init();
    }
    
    // 如果数据库正在打开，将操作添加到待处理队列
    if (this._state.storeOpening) {
      return new Promise((resolve, reject) => {
        this._state.pendingOperations.push({
          type: 'get',
          key,
          resolve,
          reject
        });
      });
    }
    
    return new Promise((resolve, reject) => {
      try {
        switch (this._state.storageType) {
          case this.types.INDEXED_DB:
            this._getFromIndexedDB(key).then(resolve, (error) => {
              this._logError(`从IndexedDB获取${key}失败`, error);
              
              // 尝试从localStorage获取
              if (this._state.supported.localStorage) {
                try {
                  resolve(this._getFromLocalStorage(key));
                } catch (lsError) {
                  this._logError(`从localStorage获取${key}失败`, lsError);
                  resolve(this._getFromMemory(key));
                }
              } else {
                resolve(this._getFromMemory(key));
              }
            });
            break;
          
          case this.types.LOCAL_STORAGE:
            try {
              resolve(this._getFromLocalStorage(key));
            } catch (error) {
              this._logError(`从localStorage获取${key}失败`, error);
              resolve(this._getFromMemory(key));
            }
            break;
          
          case this.types.MEMORY:
            resolve(this._getFromMemory(key));
            break;
            
          default:
            reject(new Error(`未知的存储类型: ${this._state.storageType}`));
        }
      } catch (error) {
        this._logError(`获取${key}失败`, error);
        reject(error);
      }
    });
  },
  
  /**
   * 从IndexedDB获取值
   * @param {string} key - 键
   * @returns {Promise<*>} - 值
   * @private
   */
  _getFromIndexedDB(key) {
    return new Promise((resolve, reject) => {
      if (!this._state.db) {
        return reject(new Error('IndexedDB未初始化'));
      }
      
      try {
        const transaction = this._state.db.transaction([this.config.storeName], 'readonly');
        const store = transaction.objectStore(this.config.storeName);
        const request = store.get(key);
        
        request.onsuccess = () => {
          resolve(request.result === undefined ? null : request.result);
        };
        
        request.onerror = (event) => {
          reject(event.target.error);
        };
      } catch (error) {
        reject(error);
      }
    });
  },
  
  /**
   * 从localStorage获取值
   * @param {string} key - 键
   * @returns {*} - 值
   * @private
   */
  _getFromLocalStorage(key) {
    const value = localStorage.getItem(key);
    if (value === null) {
      return null;
    }
    
    try {
      return JSON.parse(value);
    } catch (e) {
      return value;
    }
  },
  
  /**
   * 从内存存储获取值
   * @param {string} key - 键
   * @returns {*} - 值
   * @private
   */
  _getFromMemory(key) {
    return this._state.memoryStorage.has(key) ? 
      this._state.memoryStorage.get(key) : null;
  },
  
  /**
   * 设置存储中的值
   * @param {string} key - 存储键
   * @param {*} value - 要存储的值
   * @returns {Promise<boolean>} - 操作是否成功
   */
  set(key, value) {
    if (!this._state.initialized) {
      this.init();
    }
    
    // 如果数据库正在打开，将操作添加到待处理队列
    if (this._state.storeOpening) {
      return new Promise((resolve, reject) => {
        this._state.pendingOperations.push({
          type: 'set',
          key,
          value,
          resolve,
          reject
        });
      });
    }
    
    return new Promise((resolve, reject) => {
      try {
        // 始终保存到内存（作为备份）
        this._setInMemory(key, value);
        
        switch (this._state.storageType) {
          case this.types.INDEXED_DB:
            this._setInIndexedDB(key, value).then(resolve, (error) => {
              this._logError(`保存到IndexedDB失败: ${key}`, error);
              
              // 降级到localStorage
              if (this._state.supported.localStorage) {
                try {
                  const success = this._setInLocalStorage(key, value);
                  resolve(success);
                } catch (lsError) {
                  this._logError(`保存到localStorage失败: ${key}`, lsError);
                  resolve(true); // 内存存储已保存
                }
              } else {
                resolve(true); // 内存存储已保存
              }
            });
            break;
          
          case this.types.LOCAL_STORAGE:
            try {
              const success = this._setInLocalStorage(key, value);
              resolve(success);
            } catch (error) {
              this._logError(`保存到localStorage失败: ${key}`, error);
              resolve(true); // 内存存储已保存
            }
            break;
          
          case this.types.MEMORY:
            resolve(true); // 内存存储已保存
            break;
            
          default:
            reject(new Error(`未知的存储类型: ${this._state.storageType}`));
        }
      } catch (error) {
        this._logError(`设置${key}失败`, error);
        reject(error);
      }
    });
  },
  
  /**
   * 保存到IndexedDB
   * @param {string} key - 键
   * @param {*} value - 值
   * @returns {Promise<boolean>} - 是否成功
   * @private
   */
  _setInIndexedDB(key, value) {
    return new Promise((resolve, reject) => {
      if (!this._state.db) {
        return reject(new Error('IndexedDB未初始化'));
      }
      
      try {
        const transaction = this._state.db.transaction([this.config.storeName], 'readwrite');
        const store = transaction.objectStore(this.config.storeName);
        const request = store.put(value, key);
        
        request.onsuccess = () => {
          resolve(true);
        };
        
        request.onerror = (event) => {
          reject(event.target.error);
        };
      } catch (error) {
        reject(error);
      }
    });
  },
  
  /**
   * 保存到localStorage
   * @param {string} key - 键
   * @param {*} value - 值
   * @returns {boolean} - 是否成功
   * @private
   */
  _setInLocalStorage(key, value) {
    try {
      const serializedValue = typeof value === 'string' ? 
        value : JSON.stringify(value);
      localStorage.setItem(key, serializedValue);
      return true;
    } catch (e) {
      if (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED') {
        this._logError('localStorage存储空间已满', e);
        
        // 尝试清理部分数据
        this._tryCleanupStorage();
        
        // 重试保存
        try {
          const serializedValue = typeof value === 'string' ? 
            value : JSON.stringify(value);
          localStorage.setItem(key, serializedValue);
          return true;
        } catch (retryError) {
          throw retryError;
        }
      }
      throw e;
    }
  },
  
  /**
   * 尝试清理localStorage空间
   * @private
   */
  _tryCleanupStorage() {
    try {
      // 可能的临时数据键
      const tempKeys = ['temp_', 'cache_', 'tmp_'];
      
      // 遍历localStorage找到临时数据删除
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        for (const prefix of tempKeys) {
          if (key && key.startsWith(prefix)) {
            localStorage.removeItem(key);
            break;
          }
        }
      }
    } catch (e) {
      this._logError('清理localStorage失败', e);
    }
  },
  
  /**
   * 保存到内存
   * @param {string} key - 键
   * @param {*} value - 值
   * @private
   */
  _setInMemory(key, value) {
    this._state.memoryStorage.set(key, value);
  },
  
  /**
   * 从存储中移除值
   * @param {string} key - 存储键
   * @returns {Promise<boolean>} - 操作是否成功
   */
  remove(key) {
    if (!this._state.initialized) {
      this.init();
    }
    
    // 如果数据库正在打开，将操作添加到待处理队列
    if (this._state.storeOpening) {
      return new Promise((resolve, reject) => {
        this._state.pendingOperations.push({
          type: 'remove',
          key,
          resolve,
          reject
        });
      });
    }
    
    return new Promise((resolve, reject) => {
      try {
        // 从内存中移除
        this._removeFromMemory(key);
        
        switch (this._state.storageType) {
          case this.types.INDEXED_DB:
            this._removeFromIndexedDB(key).then(resolve, (error) => {
              this._logError(`从IndexedDB删除${key}失败`, error);
              
              // 尝试从localStorage移除
              if (this._state.supported.localStorage) {
                try {
                  this._removeFromLocalStorage(key);
                  resolve(true);
                } catch (lsError) {
                  this._logError(`从localStorage删除${key}失败`, lsError);
                  resolve(true); // 从内存已移除
                }
              } else {
                resolve(true); // 从内存已移除
              }
            });
            break;
          
          case this.types.LOCAL_STORAGE:
            try {
              this._removeFromLocalStorage(key);
              resolve(true);
            } catch (error) {
              this._logError(`从localStorage删除${key}失败`, error);
              resolve(true); // 从内存已移除
            }
            break;
          
          case this.types.MEMORY:
            resolve(true); // 从内存已移除
            break;
            
          default:
            reject(new Error(`未知的存储类型: ${this._state.storageType}`));
        }
      } catch (error) {
        this._logError(`删除${key}失败`, error);
        reject(error);
      }
    });
  },
  
  /**
   * 从IndexedDB移除值
   * @param {string} key - 键
   * @returns {Promise<boolean>} - 是否成功
   * @private
   */
  _removeFromIndexedDB(key) {
    return new Promise((resolve, reject) => {
      if (!this._state.db) {
        return reject(new Error('IndexedDB未初始化'));
      }
      
      try {
        const transaction = this._state.db.transaction([this.config.storeName], 'readwrite');
        const store = transaction.objectStore(this.config.storeName);
        const request = store.delete(key);
        
        request.onsuccess = () => {
          resolve(true);
        };
        
        request.onerror = (event) => {
          reject(event.target.error);
        };
      } catch (error) {
        reject(error);
      }
    });
  },
  
  /**
   * 从localStorage移除值
   * @param {string} key - 键
   * @private
   */
  _removeFromLocalStorage(key) {
    localStorage.removeItem(key);
  },
  
  /**
   * 从内存移除值
   * @param {string} key - 键
   * @private
   */
  _removeFromMemory(key) {
    this._state.memoryStorage.delete(key);
  },
  
  /**
   * 清空存储
   * @returns {Promise<boolean>} - 操作是否成功
   */
  clear() {
    if (!this._state.initialized) {
      this.init();
    }
    
    // 如果数据库正在打开，将操作添加到待处理队列
    if (this._state.storeOpening) {
      return new Promise((resolve, reject) => {
        this._state.pendingOperations.push({
          type: 'clear',
          resolve,
          reject
        });
      });
    }
    
    return new Promise((resolve, reject) => {
      try {
        // 清空内存存储
        this._clearMemory();
        
        switch (this._state.storageType) {
          case this.types.INDEXED_DB:
            this._clearIndexedDB().then(resolve, (error) => {
              this._logError('清空IndexedDB失败', error);
              
              // 尝试清空localStorage
              if (this._state.supported.localStorage) {
                try {
                  this._clearLocalStorage();
                  resolve(true);
                } catch (lsError) {
                  this._logError('清空localStorage失败', lsError);
                  resolve(true); // 内存已清空
                }
              } else {
                resolve(true); // 内存已清空
              }
            });
            break;
          
          case this.types.LOCAL_STORAGE:
            try {
              this._clearLocalStorage();
              resolve(true);
            } catch (error) {
              this._logError('清空localStorage失败', error);
              resolve(true); // 内存已清空
            }
            break;
          
          case this.types.MEMORY:
            resolve(true); // 内存已清空
            break;
            
          default:
            reject(new Error(`未知的存储类型: ${this._state.storageType}`));
        }
      } catch (error) {
        this._logError('清空存储失败', error);
        reject(error);
      }
    });
  },
  
  /**
   * 清空IndexedDB
   * @returns {Promise<boolean>} - 是否成功
   * @private
   */
  _clearIndexedDB() {
    return new Promise((resolve, reject) => {
      if (!this._state.db) {
        return reject(new Error('IndexedDB未初始化'));
      }
      
      try {
        const transaction = this._state.db.transaction([this.config.storeName], 'readwrite');
        const store = transaction.objectStore(this.config.storeName);
        const request = store.clear();
        
        request.onsuccess = () => {
          resolve(true);
        };
        
        request.onerror = (event) => {
          reject(event.target.error);
        };
      } catch (error) {
        reject(error);
      }
    });
  },
  
  /**
   * 清空localStorage
   * @private
   */
  _clearLocalStorage() {
    localStorage.clear();
  },
  
  /**
   * 清空内存存储
   * @private
   */
  _clearMemory() {
    this._state.memoryStorage.clear();
  },
  
  /**
   * 获取所有键值对
   * @returns {Promise<Object>} - 所有存储的键值对
   */
  getAll() {
    if (!this._state.initialized) {
      this.init();
    }
    
    // 如果数据库正在打开，将操作添加到待处理队列
    if (this._state.storeOpening) {
      return new Promise((resolve, reject) => {
        this._state.pendingOperations.push({
          type: 'getAll',
          resolve,
          reject
        });
      });
    }
    
    return new Promise((resolve, reject) => {
      try {
        switch (this._state.storageType) {
          case this.types.INDEXED_DB:
            this._getAllFromIndexedDB().then(resolve, (error) => {
              this._logError('从IndexedDB获取所有数据失败', error);
              
              // 降级到localStorage
              if (this._state.supported.localStorage) {
                try {
                  resolve(this._getAllFromLocalStorage());
                } catch (lsError) {
                  this._logError('从localStorage获取所有数据失败', lsError);
                  resolve(this._getAllFromMemory());
                }
              } else {
                resolve(this._getAllFromMemory());
              }
            });
            break;
          
          case this.types.LOCAL_STORAGE:
            try {
              resolve(this._getAllFromLocalStorage());
            } catch (error) {
              this._logError('从localStorage获取所有数据失败', error);
              resolve(this._getAllFromMemory());
            }
            break;
          
          case this.types.MEMORY:
            resolve(this._getAllFromMemory());
            break;
            
          default:
            reject(new Error(`未知的存储类型: ${this._state.storageType}`));
        }
      } catch (error) {
        this._logError('获取所有数据失败', error);
        reject(error);
      }
    });
  },
  
  /**
   * 从IndexedDB获取所有键值对
   * @returns {Promise<Object>} - 所有键值对
   * @private
   */
  _getAllFromIndexedDB() {
    return new Promise((resolve, reject) => {
      if (!this._state.db) {
        return reject(new Error('IndexedDB未初始化'));
      }
      
      try {
        const result = {};
        const transaction = this._state.db.transaction([this.config.storeName], 'readonly');
        const store = transaction.objectStore(this.config.storeName);
        const request = store.openCursor();
        
        request.onsuccess = (event) => {
          const cursor = event.target.result;
          if (cursor) {
            result[cursor.key] = cursor.value;
            cursor.continue();
          } else {
            resolve(result);
          }
        };
        
        request.onerror = (event) => {
          reject(event.target.error);
        };
      } catch (error) {
        reject(error);
      }
    });
  },
  
  /**
   * 从localStorage获取所有键值对
   * @returns {Object} - 所有键值对
   * @private
   */
  _getAllFromLocalStorage() {
    const result = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      try {
        const value = localStorage.getItem(key);
        result[key] = JSON.parse(value);
      } catch (e) {
        result[key] = localStorage.getItem(key);
      }
    }
    return result;
  },
  
  /**
   * 从内存获取所有键值对
   * @returns {Object} - 所有键值对
   * @private
   */
  _getAllFromMemory() {
    const result = {};
    this._state.memoryStorage.forEach((value, key) => {
      result[key] = value;
    });
    return result;
  },
  
  /**
   * 获取当前使用的存储类型
   * @returns {string} - 存储类型
   */
  getStorageType() {
    return this._state.storageType;
  },
  
  /**
   * 获取存储支持情况
   * @returns {Object} - 各种存储的支持情况
   */
  getSupportStatus() {
    return { ...this._state.supported };
  }
};

// 导出模块
module.exports = StorageAbstract; 