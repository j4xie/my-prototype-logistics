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
    iconBasePath: '../../../assets/icons/',
    retryDelay: 1000
  },
  
  // 内部状态
  _state: {
    loadedResources: new Map(), // 已加载资源缓存
    pendingLoads: 0, // 当前正在加载的资源数
    loadQueue: [], // 等待加载的资源队列
    listeners: new Map(), // 事件监听器
    timers: [],
    currentId: 0
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
      QUEUE_COMPLETE: 'queueComplete',
      LOAD_RETRY: 'loadRetry'
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
   * 将资源添加到加载队列中
   * @private
   * @param {Object} resource - 资源配置对象
   * @returns {Boolean} - 资源是否被添加到队列
   */
  _queueResource(resource) {
    console.log(`[DEBUG] 队列资源: ${resource.id || resource.url}`);
    
    // 检查资源参数
    if (!resource || !resource.url) {
      console.warn('[WARNING] 无效资源: 缺少必需的URL', resource);
      return false;
    }
    
    // 使用默认值扩展资源对象
    const normalizedResource = {
      id: resource.id || resource.url,
      type: resource.type || this._getResourceTypeByExtension(resource.url),
      url: resource.url,
      priority: resource.priority !== undefined ? resource.priority : 1,
      timeout: resource.timeout || this.config.timeout,
      cacheable: resource.cacheable !== undefined ? resource.cacheable : true,
      retryAttempts: resource.retryAttempts || this.config.retryAttempts || 0,
      retryDelay: resource.retryDelay || this.config.retryDelay || 1000,
      currentRetry: 0,
      ...resource
    };
    
    // 设置资源标识符
    if (!normalizedResource.id) {
      normalizedResource.id = normalizedResource.url;
    }
    
    // 检查缓存中是否已存在该资源
    if (this.config.cacheEnabled && this._state.loadedResources.has(normalizedResource.id)) {
      console.log(`[DEBUG] 资源已缓存，跳过队列: ${normalizedResource.id}`);
      return false;
    }
    
    // 检查此资源是否已经在队列中
    if (this._state.loadQueue.some(item => item.id === normalizedResource.id)) {
      console.log(`[DEBUG] 资源已在队列中: ${normalizedResource.id}`);
      return false;
    }
    
    // 检查此资源是否正在加载中
    if (this._state.pendingLoads > 0 && this._state.loadQueue.some(item => item.id === normalizedResource.id)) {
      console.log(`[DEBUG] 资源正在加载中: ${normalizedResource.id}`);
      return false;
    }
    
    // 将资源添加到队列
    this._state.loadQueue.push(normalizedResource);
    
    // 按优先级排序队列（高优先级在前）
    this._state.loadQueue.sort((a, b) => b.priority - a.priority);
    
    // 尝试处理队列
    this._processQueue();
    
    return true;
  },
  
  /**
   * 根据URL扩展名确定资源类型
   * @private
   * @param {String} url - 资源URL
   * @returns {String} - 资源类型
   */
  _getResourceTypeByExtension(url) {
    const ext = url.split('?')[0].split('.').pop().toLowerCase();
    
    if (['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp'].includes(ext)) {
      return 'image';
    } else if (['js'].includes(ext)) {
      return 'script';
    } else if (['css'].includes(ext)) {
      return 'style';
    }
    
    // 默认为脚本
    return 'script';
  },

  /**
   * 处理加载队列
   * @private
   */
  _processQueue() {
    console.log(`[DEBUG] _processQueue START: Queue=${this._state.loadQueue.length}, Pending=${this._state.pendingLoads}, Max=${this.config.maxConcurrent}`);
    
    // 检查是否有等待的资源和可用的加载槽
    let processedInLoop = 0;
    let promises = [];
    
    // 预先处理队列中的资源，但不递归调用 _processQueue
    while (
      this._state.loadQueue.length > 0 && 
      this._state.pendingLoads < this.config.maxConcurrent
    ) {
      processedInLoop++;
      // 获取下一个要加载的资源
      const resource = this._state.loadQueue.shift();
      this._state.pendingLoads++;
      console.log(`[DEBUG] _processQueue LOOP: Took ${resource.id || resource.url}. Queue=${this._state.loadQueue.length}, Pending=${this._state.pendingLoads}`);
      
      // 加载资源，保存 Promise 但不在这里链式调用 then/catch
      const resourcePromise = this._loadResource(resource);
      
      // 包装 Promise 处理，避免在 then/catch 中递归调用 _processQueue
      const wrappedPromise = resourcePromise
        .then(element => {
          const previousPending = this._state.pendingLoads;
          this._state.pendingLoads--;
          console.log(`[DEBUG] _processQueue THEN: Success ${resource.id || resource.url}. Pending: ${previousPending} -> ${this._state.pendingLoads}`);
          
          // 触发资源加载完成事件
          this._trigger(this.events.LOAD_COMPLETE, { 
            resource, 
            element,
            remainingQueue: this._state.loadQueue.length 
          });
          
          // 检查队列是否已清空
          if (this._state.pendingLoads === 0 && this._state.loadQueue.length === 0) {
            console.log(`[DEBUG] _processQueue THEN: Queue complete trigger.`);
            this._trigger(this.events.QUEUE_COMPLETE, { 
              totalLoaded: this._state.loadedResources.size 
            });
          }
          
          return element;
        })
        .catch(error => {
          const previousPending = this._state.pendingLoads;
          this._state.pendingLoads--;
          console.log(`[DEBUG] _processQueue CATCH: Fail ${resource.id || resource.url}. Err: ${error.message}. Pending: ${previousPending} -> ${this._state.pendingLoads}. Retry: ${resource.retryCount}/${this.config.retryAttempts}`);
          
          // 处理重试逻辑
          if (resource.retryCount < this.config.retryAttempts) {
            resource.retryCount++;
            console.log(`[DEBUG] _processQueue CATCH: Re-queuing ${resource.id || resource.url}`);
            this._state.loadQueue.unshift(resource); // 将失败资源重新加入队列顶部
          } else {
            console.log(`[DEBUG] _processQueue CATCH: Max retries reached for ${resource.id || resource.url}. Triggering LOAD_ERROR.`);
            // 触发加载错误事件
            this._trigger(this.events.LOAD_ERROR, { resource, error });
          }
          
          throw error; // 继续抛出错误
        });
      
      promises.push(wrappedPromise);
    }
    
    console.log(`[DEBUG] _processQueue END: Exited while loop. Processed ${processedInLoop} items this call.`);
    
    // 添加一个处理器，在当前批次的资源完成后，再次调用 _processQueue
    if (promises.length > 0) {
      Promise.allSettled(promises).then(() => {
        if (this._state.loadQueue.length > 0 && this._state.pendingLoads < this.config.maxConcurrent) {
          console.log(`[DEBUG] _processQueue: Processing next batch of resources`);
          this._processQueue();
        }
      });
    }
  },

  /**
   * 加载单个资源
   * @private
   * @param {Object} resource - 资源配置
   * @returns {Promise} - 资源加载的Promise
   */
  _loadResource(resource) {
    console.log(`[DEBUG] 开始加载资源: ${resource.id || resource.url} (type: ${resource.type})`);
    
    // 触发加载开始事件
    this._trigger(this.events.LOAD_START, { resource });
    
    // 检查是否已缓存
    if (this.config.cacheEnabled && this._state.loadedResources.has(resource.url)) {
      console.log(`[DEBUG] 使用缓存资源: ${resource.id}`);
      const cachedResource = this._state.loadedResources.get(resource.url);
      
      // 触发加载完成事件
      this._trigger(this.events.LOAD_COMPLETE, { 
        resource, 
        element: cachedResource,
        fromCache: true 
      });
      
      return Promise.resolve(cachedResource);
    }
    
    // 设置超时处理
    let timeoutId;
    const timeoutPromise = new Promise((_, reject) => {
      if (resource.timeout || this.config.timeout) {
        timeoutId = setTimeout(() => {
          reject(new Error(`资源加载超时: ${resource.url}`));
        }, resource.timeout || this.config.timeout);
      }
    });
    
    // 根据资源类型选择加载方法
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
    
    // 竞争超时与加载
    return Promise.race([loadPromise, timeoutPromise])
      .then(element => {
        console.log(`[DEBUG] 资源加载成功: ${resource.id || resource.url}`);
        clearTimeout(timeoutId); // 确保清除超时
        
        // 如果启用缓存且资源可缓存，则进行缓存
        if (this.config.cacheEnabled && resource.cacheable !== false) {
          console.log(`[DEBUG] 缓存资源: ${resource.id || resource.url}`);
          this._state.loadedResources.set(resource.url, element);
        }
        
        // 触发加载完成事件
        this._trigger(this.events.LOAD_COMPLETE, { resource, element, fromCache: false });
        
        return element;
      })
      .catch(error => {
        console.log(`[DEBUG] _loadResource CATCH: ${error.message} - ${resource.id || resource.url}`);
        clearTimeout(timeoutId); // 确保清除超时
        // 处理资源加载错误
        this.handleResourceError(resource, error);
        throw error;
      });
  },

  /**
   * 处理资源加载错误
   * @param {Object} resource - 资源配置
   * @param {Error} error - 错误对象
   */
  handleResourceError(resource, error) {
    console.error(`资源加载失败: ${resource.id || resource.url}`, error);
    
    // 检查是否达到最大重试次数
    const currentRetries = resource.retries || 0;
    
    if (currentRetries < (resource.maxRetries || this.config.retryAttempts)) {
      console.log(`[DEBUG] 资源加载重试 (${currentRetries + 1}/${resource.maxRetries || this.config.retryAttempts}): ${resource.id || resource.url}`);
      
      // 增加重试计数
      resource.retries = currentRetries + 1;
      
      // 添加延迟，防止立即重试
      setTimeout(() => {
        // 重新加入队列，设置高优先级
        resource.priority = 1; // 最高优先级
        this._queueResource(resource);
        this._processQueue();
      }, 1000); // 1秒后重试
      
      // 触发重试事件
      this._trigger(this.events.LOAD_RETRY, { 
        resource, 
        error, 
        retryCount: resource.retries,
        maxRetries: resource.maxRetries || this.config.retryAttempts 
      });
    } else {
      // 达到最大重试次数，触发最终错误事件
      this._trigger(this.events.LOAD_ERROR, { 
        resource, 
        error, 
        retryCount: currentRetries,
        maxRetries: resource.maxRetries || this.config.retryAttempts,
        isFinal: true
      });
    }
  },
  
  /**
   * 加载图片资源
   * @private
   * @param {Object} resource - 资源配置
   * @returns {Promise<HTMLImageElement>} - 加载的图片元素
   */
  _loadImageResource(resource) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      
      img.onload = () => {
        console.log(`[DEBUG] 图片加载成功: ${resource.id || resource.url}`);
        resolve(img);
      };
      
      img.onerror = (event) => {
        console.log(`[DEBUG] 图片加载失败: ${resource.id || resource.url}`);
        reject(new Error(`图片加载失败: ${resource.url}`));
      };
      
      // 如果支持，添加加载进度事件
      if (img.addEventListener) {
        img.addEventListener('progress', event => {
          if (event.lengthComputable) {
            const percentage = Math.round((event.loaded / event.total) * 100);
            console.log(`[DEBUG] 图片加载进度: ${resource.id || resource.url} - ${percentage}%`);
            
            this._trigger(this.events.LOAD_PROGRESS, {
              resource,
              loaded: event.loaded,
              total: event.total,
              percentage: percentage
            });
          }
        });
      }
      
      // 设置跨域属性，如果指定
      if (resource.crossOrigin) {
        img.crossOrigin = resource.crossOrigin;
      }
      
      // 开始加载
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
      const script = document.createElement('script');
      script.type = 'text/javascript';
      script.src = resource.url;
      script.async = resource.async !== false;
      script.defer = resource.defer === true;
      
      // 设置其他属性
      if (resource.id) {
        script.id = resource.id;
      }
      
      if (resource.integrity) {
        script.integrity = resource.integrity;
        script.crossOrigin = resource.crossOrigin || 'anonymous';
      } else if (resource.crossOrigin) {
        script.crossOrigin = resource.crossOrigin;
      }
      
      script.onload = () => {
        console.log(`[DEBUG] 脚本加载成功: ${resource.id || resource.url}`);
        resolve(script);
      };
      
      script.onerror = () => {
        console.log(`[DEBUG] 脚本加载失败: ${resource.id || resource.url}`);
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
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.type = 'text/css';
      link.href = resource.url;
      
      // 设置其他属性
      if (resource.id) {
        link.id = resource.id;
      }
      
      if (resource.media) {
        link.media = resource.media;
      }
      
      if (resource.integrity) {
        link.integrity = resource.integrity;
        link.crossOrigin = resource.crossOrigin || 'anonymous';
      } else if (resource.crossOrigin) {
        link.crossOrigin = resource.crossOrigin;
      }
      
      link.onload = () => {
        console.log(`[DEBUG] 样式表加载成功: ${resource.id || resource.url}`);
        resolve(link);
      };
      
      link.onerror = () => {
        console.log(`[DEBUG] 样式表加载失败: ${resource.id || resource.url}`);
        reject(new Error(`样式表加载失败: ${resource.url}`));
      };
      
      document.head.appendChild(link);
    });
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
  },

  /**
   * 更新队列中资源的优先级
   * @param {String} resourceId - 资源ID
   * @param {Number} newPriority - 新的优先级级别
   * @returns {Boolean} - 是否成功更新
   */
  updateResourcePriority(resourceId, newPriority) {
    console.log(`[DEBUG] 更新资源优先级: ${resourceId} => ${newPriority}`);
    
    if (!resourceId || newPriority === undefined) {
      return false;
    }
    
    // 检查资源是否在队列中
    const resourceIndex = this._state.loadQueue.findIndex(resource => resource.id === resourceId);
    if (resourceIndex === -1) {
      console.log(`[DEBUG] 资源不在队列中: ${resourceId}`);
      return false;
    }
    
    // 更新优先级
    this._state.loadQueue[resourceIndex].priority = newPriority;
    console.log(`[DEBUG] 资源优先级已更新: ${resourceId}`);
    
    // 重新排序队列
    this._state.loadQueue.sort((a, b) => b.priority - a.priority);
    
    return true;
  },

  /**
   * 重置加载器状态（用于测试）
   * @returns {void}
   */
  reset() {
    console.log('[DEBUG] 重置加载器状态');
    
    // 重置内部状态
    this._state = {
      initialized: false,
      loadQueue: [],
      loadedResources: new Map(),
      pendingLoads: 0,
      listeners: new Map(),
      currentId: 0,
      timers: []
    };
    
    // 重置配置为默认值
    this.config = {
      cacheEnabled: true,
      maxConcurrent: 4,
      timeout: 30000,
      retryAttempts: 2,
      retryDelay: 1000,
      iconBasePath: '../../../assets/icons/'
    };
    
    // 清除所有定时器
    if (typeof window !== 'undefined') {
      const timers = this._state.timers || [];
      timers.forEach(timerId => clearTimeout(timerId));
    }
    
    console.log('[DEBUG] 加载器状态已重置');
  }
};

// 为了向后兼容，导出到全局对象
if (typeof window !== 'undefined') {
  window.traceLoader = traceLoader;
} 

// export default traceLoader; 
// CommonJS导出
module.exports = traceLoader;
