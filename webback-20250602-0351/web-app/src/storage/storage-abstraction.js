/**
 * 存储抽象层类
 * 提供跨浏览器兼容的统一存储接口
 * 创建日期: 2025-07-17
 * 版本: 1.0.0
 */

/**
 * 存储类型枚举
 */
const STORAGE_TYPES = {
  LOCAL: 'local',    // localStorage
  SESSION: 'session', // sessionStorage  
  INDEXED_DB: 'indexeddb', // IndexedDB
  MEMORY: 'memory'   // 内存存储（无持久化）
};

/**
 * 检查是否在浏览器环境中
 * @private
 * @returns {boolean} 是否在浏览器环境中
 */
function _isBrowser() {
  return typeof window !== 'undefined';
}

/**
 * 检查localStorage是否可用
 * @private
 * @returns {boolean} localStorage是否可用
 */
function _isLocalStorageAvailable() {
  if (!_isBrowser()) return false;
  
  try {
    const testKey = '__storage_test__';
    localStorage.setItem(testKey, testKey);
    localStorage.removeItem(testKey);
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * 检查sessionStorage是否可用
 * @private
 * @returns {boolean} sessionStorage是否可用
 */
function _isSessionStorageAvailable() {
  if (!_isBrowser()) return false;
  
  try {
    const testKey = '__storage_test__';
    sessionStorage.setItem(testKey, testKey);
    sessionStorage.removeItem(testKey);
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * 存储抽象层类 - 简化版，仅使用内存存储
 */
class StorageAbstraction {
  /**
   * 构造函数
   * @param {Object} options 配置选项
   */
  constructor(options = {}) {
    this.options = {
      prefix: options.prefix || 'app-storage-',
      defaultExpiry: options.defaultExpiry || 86400000, // 1天
      onError: options.onError || ((err) => console.error('存储错误:', err))
    };
    
    // 内部内存存储
    this._memoryStorage = new Map();
    this._storage = this._createMemoryStorageInterface();
  }

  /**
   * 创建内存存储接口
   * @returns {Object} 内存存储接口
   * @private
   */
  _createMemoryStorageInterface() {
    const self = this;
    return {
      type: STORAGE_TYPES.MEMORY,
      
      async set(key, value, options = {}) {
        try {
          const dataToStore = {
            value,
            timestamp: Date.now(),
            expiry: options.expiry || self.options.defaultExpiry
          };
          
          self._memoryStorage.set(key, dataToStore);
          return true;
        } catch (error) {
          self.options.onError(error);
          return false;
        }
      },
      
      async get(key) {
        try {
          const data = self._memoryStorage.get(key);
          
          if (!data) {
            return null;
          }
          
          // 检查是否过期
          if (self._isExpired(data)) {
            self._memoryStorage.delete(key);
            return null;
          }
          
          return data.value;
        } catch (error) {
          self.options.onError(error);
          return null;
        }
      },
      
      async remove(key) {
        try {
          self._memoryStorage.delete(key);
          return true;
        } catch (error) {
          self.options.onError(error);
          return false;
        }
      },
      
      async clear() {
        try {
          self._memoryStorage.clear();
          return true;
        } catch (error) {
          self.options.onError(error);
          return false;
        }
      },
      
      async keys() {
        try {
          return Array.from(self._memoryStorage.keys());
        } catch (error) {
          self.options.onError(error);
          return [];
        }
      }
    };
  }
  
  /**
   * 检查数据项是否过期
   * @param {Object} data 数据项
   * @returns {boolean} 是否过期
   * @private
   */
  _isExpired(data) {
    if (!data || !data.timestamp || !data.expiry) {
      return false;
    }
    
    return Date.now() > data.timestamp + data.expiry;
  }
  
  /**
   * 设置值
   * @param {string} key 键
   * @param {*} value 值
   * @param {Object} options 选项
   * @returns {Promise<boolean>} 是否成功
   */
  async set(key, value, options = {}) {
    return this._storage.set(key, value, options);
  }
  
  /**
   * 获取值
   * @param {string} key 键
   * @param {Object} options 选项
   * @returns {Promise<*>} 值或null
   */
  async get(key, options = {}) {
    return this._storage.get(key, options);
  }
  
  /**
   * 移除键
   * @param {string} key 键
   * @returns {Promise<boolean>} 是否成功
   */
  async remove(key) {
    return this._storage.remove(key);
  }
  
  /**
   * 清空存储
   * @returns {Promise<boolean>} 是否成功
   */
  async clear() {
    return this._storage.clear();
  }
  
  /**
   * 获取所有键
   * @returns {Promise<Array<string>>} 键数组
   */
  async keys() {
    return this._storage.keys();
  }
  
  /**
   * 获取存储类型
   * @returns {string} 当前使用的存储类型
   */
  getType() {
    return this._storage.type;
  }
}

module.exports = StorageAbstraction;
module.exports.STORAGE_TYPES = STORAGE_TYPES; 