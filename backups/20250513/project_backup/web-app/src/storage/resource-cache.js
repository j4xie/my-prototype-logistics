/**
 * 资源缓存管理类
 * 提供对各类资源（图片、脚本、样式表等）的缓存管理
 * 创建日期: 2025-07-17
 * 版本: 1.0.0
 */

const StorageAbstraction = require('./storage-abstraction');

/**
 * 资源类型枚举
 */
const RESOURCE_TYPES = {
  IMAGE: 'image',
  SCRIPT: 'script',
  STYLESHEET: 'stylesheet',
  JSON: 'json',
  TEXT: 'text',
  BLOB: 'blob',
  UNKNOWN: 'unknown'
};

/**
 * 资源缓存管理类
 * 负责对各类资源进行缓存管理，支持内存和持久化存储
 */
class ResourceCache {
  /**
   * 构造函数
   * @param {Object} options 配置选项
   * @param {number} [options.memoryLimit=50] 内存缓存资源数量限制
   * @param {number} [options.persistentLimit=200] 持久化存储资源数量限制
   * @param {number} [options.defaultExpiry=3600000] 默认过期时间（毫秒），默认为1小时
   * @param {boolean} [options.persistenceEnabled=true] 是否启用持久化存储
   * @param {number} [options.memorySizeLimit=50000000] 内存缓存大小限制（字节）
   * @param {StorageAbstraction} [options.storage] 存储抽象层实例，不提供则自动创建
   */
  constructor(options = {}) {
    this.options = {
      memoryLimit: options.memoryLimit || 50,
      persistentLimit: options.persistentLimit || 200,
      defaultExpiry: options.defaultExpiry || 3600000, // 1小时
      persistenceEnabled: options.persistenceEnabled !== false,
      memorySizeLimit: options.memorySizeLimit || 50000000, // 50MB
    };
    
    // 初始化存储抽象层
    this.storage = options.storage || new StorageAbstraction({
      prefix: 'resource-cache-',
      defaultExpiry: this.options.defaultExpiry
    });
    
    // 内存缓存
    this._memoryCache = new Map();
    this._memoryCacheSize = 0;
    
    // 缓存统计
    this._stats = {
      hits: 0,
      misses: 0,
      memoryHits: 0,
      persistentHits: 0,
      stored: 0,
      evicted: 0,
      expired: 0
    };
    
    // 清理过期资源的定时器
    this._cleanupInterval = setInterval(() => {
      this._cleanExpiredResources();
    }, 60000); // 每分钟清理一次
  }
  
  /**
   * 存储资源
   * @param {string} key 资源键
   * @param {*} resource 资源数据
   * @param {Object} [options] 选项
   * @param {string} [options.type] 资源类型，不提供则自动检测
   * @param {number} [options.expiry] 过期时间（毫秒）
   * @param {boolean} [options.persistenceOnly] 是否只存储到持久化存储
   * @param {boolean} [options.memoryOnly] 是否只存储到内存
   * @returns {Promise<boolean>} 操作是否成功
   */
  async store(key, resource, options = {}) {
    try {
      const resourceType = options.type || this._detectResourceType(resource);
      const expiry = options.expiry || this.options.defaultExpiry;
      const size = this._estimateSize(resource);
      
      // 准备资源记录
      const resourceRecord = {
        resource,
        type: resourceType,
        timestamp: Date.now(),
        size,
        accessCount: 0,
        lastAccessed: Date.now()
      };
      
      // 存储到内存（如果启用且不是只持久化）
      if (!options.persistenceOnly) {
        // 检查内存限制
        if (this._memoryCacheSize + size > this.options.memorySizeLimit) {
          this._evictFromMemory();
        }
        
        if (this._memoryCache.size >= this.options.memoryLimit) {
          this._evictLeastRecentlyUsed();
        }
        
        this._memoryCache.set(key, resourceRecord);
        this._memoryCacheSize += size;
      }
      
      // 存储到持久化存储（如果启用且不是只内存）
      if (this.options.persistenceEnabled && !options.memoryOnly) {
        // 清理持久化存储，如果接近限制
        const keys = await this.storage.keys();
        if (keys.length >= this.options.persistentLimit) {
          // 删除最旧的资源
          const oldestKeys = await this._getOldestPersistentKeys(10);
          for (const oldKey of oldestKeys) {
            await this.storage.remove(oldKey);
          }
        }
        
        // 存储资源
        await this.storage.set(key, {
          resource,
          type: resourceType,
          timestamp: Date.now(),
          size
        }, { expiry });
      }
      
      this._stats.stored++;
      return true;
    } catch (error) {
      console.error('资源缓存存储失败:', error);
      return false;
    }
  }
  
  /**
   * 获取资源
   * @param {string} key 资源键
   * @param {Object} [options] 选项
   * @param {boolean} [options.noThrow=false] 资源不存在时是否不抛出错误
   * @param {boolean} [options.skipPersistent=false] 是否跳过持久化存储
   * @param {boolean} [options.skipMemory=false] 是否跳过内存缓存
   * @returns {Promise<*>} 资源数据
   */
  async get(key, options = {}) {
    try {
      // 1. 先从内存缓存中获取（如果不跳过内存）
      if (!options.skipMemory) {
        const memoryRecord = this._memoryCache.get(key);
        
        if (memoryRecord) {
          // 更新访问统计
          memoryRecord.accessCount++;
          memoryRecord.lastAccessed = Date.now();
          
          this._stats.hits++;
          this._stats.memoryHits++;
          
          return memoryRecord.resource;
        }
      }
      
      // 2. 从持久化存储中获取（如果启用且不跳过持久化）
      if (this.options.persistenceEnabled && !options.skipPersistent) {
        try {
          const storedRecord = await this.storage.get(key, { noThrow: true });
          
          if (storedRecord) {
            // 更新统计信息
            this._stats.hits++;
            this._stats.persistentHits++;
            
            // 放入内存缓存（如果不跳过内存）
            if (!options.skipMemory) {
              const size = this._estimateSize(storedRecord.resource);
              
              // 检查内存限制
              if (this._memoryCacheSize + size > this.options.memorySizeLimit) {
                this._evictFromMemory();
              }
              
              if (this._memoryCache.size >= this.options.memoryLimit) {
                this._evictLeastRecentlyUsed();
              }
              
              this._memoryCache.set(key, {
                resource: storedRecord.resource,
                type: storedRecord.type,
                timestamp: storedRecord.timestamp,
                size,
                accessCount: 1,
                lastAccessed: Date.now()
              });
              
              this._memoryCacheSize += size;
            }
            
            return storedRecord.resource;
          }
        } catch (error) {
          // 持久化存储读取失败，继续检查其他来源
          console.warn('持久化存储读取失败:', error);
        }
      }
      
      // 资源未找到
      this._stats.misses++;
      
      if (!options.noThrow) {
        throw new Error(`资源 "${key}" 未找到`);
      }
      
      return null;
    } catch (error) {
      if (!options.noThrow) {
        throw error;
      }
      return null;
    }
  }
  
  /**
   * 检查资源是否存在
   * @param {string} key 资源键
   * @param {Object} [options] 选项
   * @param {boolean} [options.checkMemoryOnly=false] 是否只检查内存缓存
   * @returns {Promise<boolean>} 资源是否存在
   */
  async has(key, options = {}) {
    // 检查内存缓存
    if (this._memoryCache.has(key)) {
      return true;
    }
    
    // 如果只检查内存，则到此结束
    if (options.checkMemoryOnly) {
      return false;
    }
    
    // 检查持久化存储
    if (this.options.persistenceEnabled) {
      try {
        return await this.storage.has(key);
      } catch (error) {
        console.warn('检查资源存在性失败:', error);
        return false;
      }
    }
    
    return false;
  }
  
  /**
   * 删除资源
   * @param {string} key 资源键
   * @returns {Promise<boolean>} 操作是否成功
   */
  async remove(key) {
    let success = true;
    
    // 从内存缓存中删除
    if (this._memoryCache.has(key)) {
      const record = this._memoryCache.get(key);
      this._memoryCacheSize -= record.size;
      this._memoryCache.delete(key);
    }
    
    // 从持久化存储中删除
    if (this.options.persistenceEnabled) {
      try {
        await this.storage.remove(key);
      } catch (error) {
        console.warn('从持久化存储删除资源失败:', error);
        success = false;
      }
    }
    
    return success;
  }
  
  /**
   * 清除所有缓存
   * @param {Object} [options] 选项
   * @param {boolean} [options.clearMemoryOnly=false] 是否只清除内存缓存
   * @param {boolean} [options.clearPersistentOnly=false] 是否只清除持久化存储
   * @returns {Promise<boolean>} 操作是否成功
   */
  async clear(options = {}) {
    let success = true;
    
    // 清除内存缓存
    if (!options.clearPersistentOnly) {
      this._memoryCache.clear();
      this._memoryCacheSize = 0;
    }
    
    // 清除持久化存储
    if (this.options.persistenceEnabled && !options.clearMemoryOnly) {
      try {
        await this.storage.clear();
      } catch (error) {
        console.warn('清除持久化存储失败:', error);
        success = false;
      }
    }
    
    return success;
  }
  
  /**
   * 获取缓存统计信息
   * @returns {Object} 统计信息
   */
  getStats() {
    // 计算命中率
    const hitRate = this._stats.hits > 0 ? 
      this._stats.hits / (this._stats.hits + this._stats.misses) : 0;
    
    return {
      ...this._stats,
      hitRate: hitRate.toFixed(2),
      memorySize: this._memoryCacheSize,
      memoryItemCount: this._memoryCache.size,
      memoryLimit: this.options.memoryLimit,
      memorySizeLimit: this.options.memorySizeLimit,
      persistenceEnabled: this.options.persistenceEnabled
    };
  }
  
  /**
   * 清理过期资源
   * @private
   */
  async _cleanExpiredResources() {
    const now = Date.now();
    let expiredCount = 0;
    
    // 清理内存缓存
    for (const [key, record] of this._memoryCache.entries()) {
      if (now - record.timestamp > this.options.defaultExpiry) {
        this._memoryCache.delete(key);
        this._memoryCacheSize -= record.size;
        expiredCount++;
      }
    }
    
    // 持久化存储的过期资源会在访问时自动清理
    
    this._stats.expired += expiredCount;
    
    return expiredCount;
  }
  
  /**
   * 从内存中驱逐资源，释放空间
   * @private
   */
  _evictFromMemory() {
    // 释放大约25%的空间
    const targetSize = this.options.memorySizeLimit * 0.75;
    const sortedEntries = Array.from(this._memoryCache.entries())
      .sort((a, b) => a[1].lastAccessed - b[1].lastAccessed);
    
    let freedSize = 0;
    let evictedCount = 0;
    
    while (freedSize < this._memoryCacheSize - targetSize && sortedEntries.length > 0) {
      const [key, record] = sortedEntries.shift();
      this._memoryCache.delete(key);
      freedSize += record.size;
      evictedCount++;
    }
    
    this._memoryCacheSize -= freedSize;
    this._stats.evicted += evictedCount;
    
    return evictedCount;
  }
  
  /**
   * 驱逐最近最少使用的资源
   * @private
   */
  _evictLeastRecentlyUsed() {
    // 找出最近最少访问的资源
    let lruKey = null;
    let lruTime = Infinity;
    
    for (const [key, record] of this._memoryCache.entries()) {
      if (record.lastAccessed < lruTime) {
        lruTime = record.lastAccessed;
        lruKey = key;
      }
    }
    
    if (lruKey) {
      const record = this._memoryCache.get(lruKey);
      this._memoryCacheSize -= record.size;
      this._memoryCache.delete(lruKey);
      this._stats.evicted++;
    }
  }
  
  /**
   * 获取持久化存储中最旧的键
   * @param {number} count 获取数量
   * @returns {Promise<string[]>} 键列表
   * @private
   */
  async _getOldestPersistentKeys(count) {
    try {
      const keys = await this.storage.keys();
      const keyTimestamps = [];
      
      // 获取所有键的时间戳
      for (const key of keys) {
        try {
          const data = await this.storage.get(key, { noThrow: true });
          if (data && data.timestamp) {
            keyTimestamps.push({
              key,
              timestamp: data.timestamp
            });
          }
        } catch (error) {
          // 忽略错误
        }
      }
      
      // 按时间戳排序
      keyTimestamps.sort((a, b) => a.timestamp - b.timestamp);
      
      // 返回最旧的几个键
      return keyTimestamps.slice(0, count).map(item => item.key);
    } catch (error) {
      console.warn('获取最旧持久化键失败:', error);
      return [];
    }
  }
  
  /**
   * 估算资源大小
   * @param {*} resource 资源
   * @returns {number} 估算大小（字节）
   * @private
   */
  _estimateSize(resource) {
    if (!resource) {
      return 0;
    }
    
    // 如果是字符串
    if (typeof resource === 'string') {
      return resource.length * 2; // 每个字符约2字节
    }
    
    // 如果是Blob或File对象
    if (resource instanceof Blob || resource instanceof File) {
      return resource.size;
    }
    
    // 如果是ArrayBuffer或TypedArray
    if (resource instanceof ArrayBuffer) {
      return resource.byteLength;
    }
    
    if (ArrayBuffer.isView(resource)) {
      return resource.byteLength;
    }
    
    // 如果是图像元素
    if (resource instanceof HTMLImageElement) {
      if (resource.naturalWidth && resource.naturalHeight) {
        // 估算图像大小（假设每像素4字节RGBA）
        return resource.naturalWidth * resource.naturalHeight * 4;
      }
      return 10000; // 默认估算值
    }
    
    // 如果是JSON对象
    if (typeof resource === 'object') {
      try {
        const json = JSON.stringify(resource);
        return json.length * 2;
      } catch (e) {
        // 回退到默认大小
      }
    }
    
    // 默认估算值
    return 1000;
  }
  
  /**
   * 检测资源类型
   * @param {*} resource 资源
   * @returns {string} 资源类型
   * @private
   */
  _detectResourceType(resource) {
    if (!resource) {
      return RESOURCE_TYPES.UNKNOWN;
    }
    
    // 如果是字符串
    if (typeof resource === 'string') {
      // 尝试检测是否为JSON
      if ((resource.startsWith('{') && resource.endsWith('}')) || 
          (resource.startsWith('[') && resource.endsWith(']'))) {
        try {
          JSON.parse(resource);
          return RESOURCE_TYPES.JSON;
        } catch (e) {
          // 不是有效的JSON
        }
      }
      
      // 检测是否为脚本或样式表
      if (resource.includes('<script') || resource.includes('function')) {
        return RESOURCE_TYPES.SCRIPT;
      }
      
      if (resource.includes('<style') || resource.includes('{') && resource.includes('}')) {
        return RESOURCE_TYPES.STYLESHEET;
      }
      
      return RESOURCE_TYPES.TEXT;
    }
    
    // 如果是Blob或File对象
    if (resource instanceof Blob || resource instanceof File) {
      if (resource.type) {
        if (resource.type.startsWith('image/')) {
          return RESOURCE_TYPES.IMAGE;
        }
        if (resource.type.includes('javascript') || resource.type.includes('text/js')) {
          return RESOURCE_TYPES.SCRIPT;
        }
        if (resource.type.includes('css')) {
          return RESOURCE_TYPES.STYLESHEET;
        }
        if (resource.type.includes('json')) {
          return RESOURCE_TYPES.JSON;
        }
        if (resource.type.startsWith('text/')) {
          return RESOURCE_TYPES.TEXT;
        }
      }
      return RESOURCE_TYPES.BLOB;
    }
    
    // 如果是图像元素
    if (resource instanceof HTMLImageElement) {
      return RESOURCE_TYPES.IMAGE;
    }
    
    // 如果是JSON对象
    if (typeof resource === 'object') {
      return RESOURCE_TYPES.JSON;
    }
    
    return RESOURCE_TYPES.UNKNOWN;
  }
  
  /**
   * 销毁缓存管理器
   * 清理所有资源和定时器
   */
  destroy() {
    clearInterval(this._cleanupInterval);
    this._memoryCache.clear();
    this._memoryCacheSize = 0;
  }
}

module.exports = ResourceCache;
module.exports.RESOURCE_TYPES = RESOURCE_TYPES; 