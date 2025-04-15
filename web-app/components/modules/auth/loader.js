/**
 * @file loader.js
 * @description 资源加载管理模块，优化版本 - 食品溯源系统
 * @version 1.1.0
 * @author 溯源系统开发团队
 * @copyright 保留所有权利
 */

const traceLoader = {
  // 配置项
  config: {
    cacheEnabled: true,
    timeout: 15000, // 资源加载超时时间(ms)
    maxConcurrent: 6, // 最大并发加载数
    retryAttempts: 2, // 加载失败重试次数
    iconBasePath: '../../../assets/icons/'
  },
  
  // 内部状态
  _state: {
    loadedResources: new Map(), // 已加载资源缓存
    pendingLoads: 0, // 当前正在加载的资源数
    loadQueue: [], // 等待加载的资源队列
    listeners: new Map(), // 事件监听器
  },

  /**
   * 初始化资源加载器
   * @param {Object} options - 配置选项
   * @returns {Object} - 资源加载器实例
   */
  init(options = {}) {
    // 合并配置选项
    this.config = { ...this.config, ...options };
    
    // 尝试自动计算图标路径
    if (options.autoDetectPaths !== false) {
      const scripts = document.getElementsByTagName('script');
      for (let i = 0; i < scripts.length; i++) {
        const src = scripts[i].src;
        if (src && src.includes('auth') && src.includes('loader.js')) {
          const pathParts = src.split('/');
          // 移除最后四部分: /auth/loader.js 和文件名
          pathParts.splice(-3);
          this.config.iconBasePath = `${pathParts.join('/')}/assets/icons/`;
          break;
        }
      }
    }
    
    // 初始化事件系统
    this._initEventSystem();
    
    return this;
  },

  /**
   * 初始化事件系统
   * @private
   */
  _initEventSystem() {
    // 事件类型
    this.events = {
      LOAD_START: 'loadStart',
      LOAD_PROGRESS: 'loadProgress',
      LOAD_COMPLETE: 'loadComplete',
      LOAD_ERROR: 'loadError',
      QUEUE_COMPLETE: 'queueComplete'
    };
  },

  /**
   * 添加事件监听器
   * @param {string} eventType - 事件类型
   * @param {Function} callback - 回调函数
   * @returns {Function} - 用于移除监听器的函数
   */
  on(eventType, callback) {
    if (!this._state.listeners.has(eventType)) {
      this._state.listeners.set(eventType, new Set());
    }
    this._state.listeners.get(eventType).add(callback);
    
    // 返回移除函数
    return () => this.off(eventType, callback);
  },

  /**
   * 移除事件监听器
   * @param {string} eventType - 事件类型
   * @param {Function} callback - 回调函数
   */
  off(eventType, callback) {
    if (this._state.listeners.has(eventType)) {
      this._state.listeners.get(eventType).delete(callback);
    }
  },

  /**
   * 触发事件
   * @private
   * @param {string} eventType - 事件类型
   * @param {*} data - 事件数据
   */
  _trigger(eventType, data) {
    if (this._state.listeners.has(eventType)) {
      this._state.listeners.get(eventType).forEach(callback => {
        try {
          callback(data);
        } catch (err) {
          console.error('事件处理函数执行错误:', err);
        }
      });
    }
  },

  /**
   * 预加载图标
   * @param {Array<string>} iconNames - 图标名称列表
   * @param {number} [priority=1] - 加载优先级(1-5，5最高)
   * @returns {Promise<Object>} - 包含所有加载图标的Promise
   */
  preloadIcons(iconNames, priority = 1) {
    if (!Array.isArray(iconNames)) {
      return Promise.reject(new Error('图标名称必须是数组'));
    }
    
    // 转换为资源对象并批量加载
    const iconResources = iconNames.map(name => ({
      type: 'image',
      url: `${this.config.iconBasePath}${name}.svg`,
      id: `icon_${name}`,
      priority
    }));
    
    return this.loadResources(iconResources);
  },

  /**
   * 预加载单个图片
   * @param {string} url - 图片URL
   * @param {string} [id] - 资源唯一标识符
   * @param {number} [priority=1] - 加载优先级
   * @returns {Promise<HTMLImageElement>} - 加载完成的图片元素
   */
  preloadImage(url, id, priority = 1) {
    return this._loadResource({
      type: 'image',
      url,
      id: id || url,
      priority
    });
  },

  /**
   * 加载JavaScript脚本
   * @param {string} url - 脚本URL
   * @param {Object} [options] - 加载选项
   * @param {boolean} [options.async=true] - 异步加载
   * @param {boolean} [options.defer=false] - 延迟执行
   * @param {number} [options.priority=3] - 加载优先级
   * @returns {Promise<HTMLScriptElement>} - 加载完成的脚本元素
   */
  loadScript(url, options = {}) {
    const { async = true, defer = false, priority = 3, id } = options;
    
    return this._loadResource({
      type: 'script',
      url,
      id: id || url,
      async,
      defer,
      priority
    });
  },

  /**
   * 加载CSS样式表
   * @param {string} url - 样式表URL
   * @param {Object} [options] - 加载选项
   * @param {number} [options.priority=2] - 加载优先级
   * @returns {Promise<HTMLLinkElement>} - 加载完成的链接元素
   */
  loadStylesheet(url, options = {}) {
    const { priority = 2, id } = options;
    
    return this._loadResource({
      type: 'style',
      url,
      id: id || url,
      priority
    });
  },

  /**
   * 批量加载资源
   * @param {Array<Object>} resources - 资源配置对象数组
   * @returns {Promise<Array>} - 所有资源加载的Promise
   */
  loadResources(resources) {
    if (!Array.isArray(resources) || resources.length === 0) {
      return Promise.resolve([]);
    }
    
    // 将所有资源添加到队列
    resources.forEach(resource => {
      this._queueResource(resource);
    });
    
    // 开始处理队列
    this._processQueue();
    
    // 返回包含所有资源加载结果的Promise
    return new Promise((resolve) => {
      const totalResources = resources.length;
      const results = new Array(totalResources);
      let completedCount = 0;
      
      // 创建一个一次性事件监听器
      const completeHandler = (data) => {
        const { resource, element, index } = data;
        // 查找资源在原始数组中的索引
        const originalIndex = resources.findIndex(r => 
          (r.id && r.id === resource.id) || 
          (!r.id && r.url === resource.url && r.type === resource.type)
        );
        
        if (originalIndex !== -1) {
          results[originalIndex] = element;
          completedCount++;
          
          // 当所有资源加载完成时，解析Promise
          if (completedCount === totalResources) {
            this.off(this.events.LOAD_COMPLETE, completeHandler);
            this.off(this.events.LOAD_ERROR, errorHandler);
            resolve(results);
          }
        }
      };
      
      const errorHandler = (data) => {
        const { resource, error } = data;
        // 查找资源在原始数组中的索引
        const originalIndex = resources.findIndex(r => 
          (r.id && r.id === resource.id) || 
          (!r.id && r.url === resource.url && r.type === resource.type)
        );
        
        if (originalIndex !== -1) {
          // 记录错误，但仍然计入完成数
          results[originalIndex] = error;
          completedCount++;
          
          // 当所有资源加载完成时，解析Promise
          if (completedCount === totalResources) {
            this.off(this.events.LOAD_COMPLETE, completeHandler);
            this.off(this.events.LOAD_ERROR, errorHandler);
            resolve(results);
          }
        }
      };
      
      // 添加事件监听器
      this.on(this.events.LOAD_COMPLETE, completeHandler);
      this.on(this.events.LOAD_ERROR, errorHandler);
    });
  },

  /**
   * 将资源添加到加载队列
   * @private
   * @param {Object} resource - 资源配置
   */
  _queueResource(resource) {
    // 为资源添加默认属性
    const enhancedResource = {
      priority: 1, // 默认优先级
      retryCount: 0,
      ...resource,
      id: resource.id || resource.url
    };
    
    // 检查资源是否已在缓存中
    if (this.config.cacheEnabled && this._state.loadedResources.has(enhancedResource.id)) {
      // 直接触发完成事件
      this._trigger(this.events.LOAD_COMPLETE, {
        resource: enhancedResource,
        element: this._state.loadedResources.get(enhancedResource.id),
        fromCache: true
      });
      return;
    }
    
    // 添加到加载队列，按优先级排序
    this._state.loadQueue.push(enhancedResource);
    this._state.loadQueue.sort((a, b) => b.priority - a.priority);
  },

  /**
   * 处理加载队列
   * @private
   */
  _processQueue() {
    console.log(`[loader.js] _processQueue: 开始处理队列. 队列长度: ${this._state.loadQueue.length}, 正在加载: ${this._state.pendingLoads}, 最大并发: ${this.config.maxConcurrent}`);
    // 检查是否有等待的资源和可用的加载槽
    while (
      this._state.loadQueue.length > 0 && 
      this._state.pendingLoads < this.config.maxConcurrent
    ) {
      // 获取下一个要加载的资源
      const resource = this._state.loadQueue.shift();
      this._state.pendingLoads++;
      console.log(`[loader.js] _processQueue: 取出资源加载 ${resource.id || resource.url}. 队列剩余: ${this._state.loadQueue.length}, 正在加载: ${this._state.pendingLoads}`);
      
      // 加载资源
      this._loadResource(resource)
        .then(element => {
          this._state.pendingLoads--;
          console.log(`[loader.js] _processQueue: 资源加载成功 ${resource.id || resource.url}. 队列剩余: ${this._state.loadQueue.length}, 正在加载: ${this._state.pendingLoads}`);
          
          // 触发资源加载完成事件
          this._trigger(this.events.LOAD_COMPLETE, { 
            resource, 
            element,
            remainingQueue: this._state.loadQueue.length 
          });
          
          // 继续处理队列
          this._processQueue();
          
          // 检查队列是否已清空
          if (this._state.pendingLoads === 0 && this._state.loadQueue.length === 0) {
            this._trigger(this.events.QUEUE_COMPLETE, { 
              totalLoaded: this._state.loadedResources.size 
            });
          }
        })
        .catch(error => {
          this._state.pendingLoads--;
          console.log(`[loader.js] _processQueue: 资源加载失败 ${resource.id || resource.url}. 错误: ${error.message}. 队列剩余: ${this._state.loadQueue.length}, 正在加载: ${this._state.pendingLoads}, 重试次数: ${resource.retryCount}`);
          
          // 处理重试逻辑
          if (resource.retryCount < this.config.retryAttempts) {
            resource.retryCount++;
            this._state.loadQueue.unshift(resource); // 将失败资源重新加入队列顶部
          } else {
            // 触发加载错误事件
            this._trigger(this.events.LOAD_ERROR, { resource, error });
          }
          
          // 继续处理队列
          this._processQueue();
        });
    }
  },

  /**
   * 加载单个资源
   * @private
   * @param {Object} resource - 资源配置
   * @returns {Promise<HTMLElement>} - 加载的元素
   */
  _loadResource(resource) {
    // 触发加载开始事件
    this._trigger(this.events.LOAD_START, { resource });
    console.log(`[loader.js] _loadResource: 开始加载 ${resource.id || resource.url}, 类型: ${resource.type}`);
    
    let loadPromise;
    
    switch (resource.type) {
      case 'image':
        loadPromise = this._loadImageResource(resource);
        break;
      case 'script':
        loadPromise = this._loadScriptResource(resource);
        break;
      case 'style':
        loadPromise = this._loadStyleResource(resource);
        break;
      default:
        return Promise.reject(new Error(`不支持的资源类型: ${resource.type}`));
    }
    
    // 添加超时处理
    const timeoutPromise = new Promise((_, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`资源加载超时: ${resource.url}`));
      }, this.config.timeout);
      
      // 当资源加载完成时清除超时
      loadPromise.then(() => clearTimeout(timeoutId)).catch(() => clearTimeout(timeoutId));
    });
    
    // 返回第一个完成的Promise (成功或超时)
    return Promise.race([loadPromise, timeoutPromise])
      .then(element => {
        // 缓存已加载的资源
        if (this.config.cacheEnabled) {
          console.log(`[loader.js] _loadResource: 资源加载成功并缓存 ${resource.id || resource.url}`);
          this._state.loadedResources.set(resource.id, element);
        } else {
          console.log(`[loader.js] _loadResource: 资源加载成功 (未缓存) ${resource.id || resource.url}`);
        }
        return element;
      })
      .catch(error => {
        console.log(`[loader.js] _loadResource: 资源加载最终失败 (包括超时) ${resource.id || resource.url}: ${error.message}`);
        this.handleResourceError(resource, error);
        throw error;
      });
  },

  /**
   * 加载图片资源
   * @private
   * @param {Object} resource - 资源配置
   * @returns {Promise<HTMLImageElement>} - 加载的图片元素
   */
  _loadImageResource(resource) {
    return new Promise((resolve, reject) => {
      console.log(`[loader.js] _loadImageResource: 正在加载图片 ${resource.url}`);
      const img = new Image();
      
      img.onload = () => {
        console.log(`[loader.js] _loadImageResource: 图片加载成功 ${resource.url}`);
        resolve(img);
      };
      img.onerror = () => {
        console.log(`[loader.js] _loadImageResource: 图片加载失败 ${resource.url}`);
        reject(new Error(`图片加载失败: ${resource.url}`));
      };
      
      // 如果支持，添加加载进度事件
      if (img.addEventListener) {
        img.addEventListener('progress', event => {
          if (event.lengthComputable) {
            this._trigger(this.events.LOAD_PROGRESS, {
              resource,
              loaded: event.loaded,
              total: event.total,
              percentage: Math.round((event.loaded / event.total) * 100)
            });
          }
        });
      }
      
      img.src = resource.url;
    });
  },

  /**
   * 加载脚本资源
   * @private
   * @param {Object} resource - 资源配置
   * @returns {Promise<HTMLScriptElement>} - 加载的脚本元素
   */
  _loadScriptResource(resource) {
    return new Promise((resolve, reject) => {
      console.log(`[loader.js] _loadScriptResource: 正在加载脚本 ${resource.url}`);
      const script = document.createElement('script');
      script.type = 'text/javascript';
      script.src = resource.url;
      script.async = resource.async !== false;
      script.defer = resource.defer === true;
      
      script.onload = () => {
        console.log(`[loader.js] _loadScriptResource: 脚本加载成功 ${resource.url}`);
        resolve(script);
      };
      script.onerror = () => {
        console.log(`[loader.js] _loadScriptResource: 脚本加载失败 ${resource.url}`);
        reject(new Error(`脚本加载失败: ${resource.url}`));
      };
      
      document.head.appendChild(script);
    });
  },

  /**
   * 加载样式资源
   * @private
   * @param {Object} resource - 资源配置
   * @returns {Promise<HTMLLinkElement>} - 加载的样式元素
   */
  _loadStyleResource(resource) {
    return new Promise((resolve, reject) => {
      console.log(`[loader.js] _loadStyleResource: 正在加载样式 ${resource.url}`);
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.type = 'text/css';
      link.href = resource.url;
      
      link.onload = () => {
        console.log(`[loader.js] _loadStyleResource: 样式加载成功 ${resource.url}`);
        resolve(link);
      };
      link.onerror = () => {
        console.log(`[loader.js] _loadStyleResource: 样式加载失败 ${resource.url}`);
        reject(new Error(`样式表加载失败: ${resource.url}`));
      };
      
      document.head.appendChild(link);
    });
  },

  /**
   * 处理资源加载错误
   * @param {Object} resource - 资源配置
   * @param {Error} error - 错误对象
   */
  handleResourceError(resource, error) {
    console.error('资源加载失败:', resource.url, error);
    // 触发错误事件
    this._trigger(this.events.LOAD_ERROR, { resource, error });
  },

  /**
   * 清除资源缓存
   * @param {string} [resourceId] - 特定资源ID，不提供则清除所有缓存
   */
  clearCache(resourceId) {
    if (resourceId) {
      this._state.loadedResources.delete(resourceId);
    } else {
      this._state.loadedResources.clear();
    }
  },

  /**
   * 获取缓存资源
   * @param {string} resourceId - 资源ID
   * @returns {HTMLElement|null} - 缓存的元素或null
   */
  getCachedResource(resourceId) {
    return this._state.loadedResources.get(resourceId) || null;
  },

  /**
   * 获取加载统计信息
   * @returns {Object} - 加载统计
   */
  getStats() {
    return {
      cached: this._state.loadedResources.size,
      pending: this._state.pendingLoads,
      queued: this._state.loadQueue.length
    };
  }
};

// 为了向后兼容，导出到全局对象
if (typeof window !== 'undefined') {
  window.traceLoader = traceLoader;
}

// export default traceLoader; 
// CommonJS导出
module.exports = traceLoader;
