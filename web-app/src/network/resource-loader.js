/**
 * @file 资源加载器
 * @description 负责加载图片、脚本、样式表等资源，支持批处理、缓存和离线功能
 * @version 1.5.3
 */

const EventEmitter = require('../utils/event-emitter');
const NetworkMonitor = require('./network-monitor');
const ResourceCache = require('../storage/resource-cache');
const PerformanceTracker = require('../utils/performance-tracker');
const { logError, logWarning, logInfo, logDebug } = require('../utils/logger');
const createResourceLoaderConfig = require('../config/resource-loader-config');

// 事件类型常量
const EVENTS = {
  LOAD_START: 'load:start',
  LOAD_COMPLETE: 'load:complete',
  LOAD_ERROR: 'load:error',
  QUEUE_COMPLETE: 'queue:complete',
  NETWORK_STATUS: 'network:status',
  CACHE_UPDATED: 'cache:updated',
  PERF_METRICS: 'perf:metrics'
};

/**
 * ResourceLoader 类
 * 负责资源的加载、缓存管理和批处理优化
 */
class ResourceLoader extends EventEmitter {
  /**
   * 使用模拟fetch创建一个资源加载器实例
   * @param {Function} fetchMock - 模拟fetch实现
   * @param {Object} options - 配置选项
   * @returns {ResourceLoader} 资源加载器实例
   * @static
   */
  static withMock(fetchMock, options = {}) {
    return new ResourceLoader({
      ...options,
      fetchImpl: fetchMock
    });
  }

  /**
   * 创建资源加载器实例
   * @param {Object} options - 配置选项
   * @param {Function} [options.fetchImpl=globalThis.fetch] - 自定义fetch实现
   */
  constructor(options = {}) {
    super();
    
    // 存储fetch实现
    this.fetchImpl = options.fetchImpl || globalThis.fetch;
    logInfo('ResourceLoader 使用的fetch实现类型:', this.fetchImpl === globalThis.fetch ? 'Real' : 'Mock');
    
    // 合并配置
    const env = process.env.NODE_ENV || 'production';
    this.config = createResourceLoaderConfig(env, options);
    
    // 初始化组件
    this._initializeComponents();
    
    // 状态管理
    this._state = {
      isReady: false,
      isLoading: false,
      networkStatus: 'unknown',
      activeRequests: new Map(),
      requestQueue: [],
      batchesInProgress: 0,
      totalLoaded: 0,
      totalFailed: 0,
      totalCached: 0
    };
    
    // 绑定方法上下文
    this._bindMethods();
    
    // 开始初始化
    this._initialize();
    
    logInfo('ResourceLoader initialized with config:', this.config);
  }
  
  /**
   * 初始化组件
   * @private
   */
  _initializeComponents() {
    // 缓存管理器
    this.cache = new ResourceCache({
      size: this.config.memoryCacheSize,
      ttl: this.config.cacheTTL,
      persistCache: this.config.persistCache,
      strategy: this.config.cacheStrategy
    });
    
    // 网络监视器
    this.networkMonitor = new NetworkMonitor({
      checkInterval: this.config.networkChangeInterval,
      enableOfflineDetection: this.config.offlineModeEnabled
    });
    
    // 性能跟踪器
    this.performanceTracker = new PerformanceTracker({
      enabled: this.config.enablePerformanceMonitoring,
      sampleRate: this.config.performanceSampleRate,
      analyticsEndpoint: this.config.analyticsEndpoint
    });
    
    // 批处理控制器
    this._batchController = {
      currentBatchSize: this.config.batchSize || this.config.defaultBatchSize,
      maxConcurrent: this.config.maxConcurrentRequests,
      activeCount: 0,
      queue: []
    };
  }
  
  /**
   * 绑定方法上下文
   * @private
   */
  _bindMethods() {
    this.load = this.load.bind(this);
    this.loadBatch = this.loadBatch.bind(this);
    this.preload = this.preload.bind(this);
    this.getFromCache = this.getFromCache.bind(this);
    this.clearCache = this.clearCache.bind(this);
    this._handleNetworkChange = this._handleNetworkChange.bind(this);
  }
  
  /**
   * 初始化加载器
   * @private
   */
  _initialize() {
    // 注册网络状态变化事件监听
    this.networkMonitor.on('statusChange', this._handleNetworkChange);
    
    // 初始化网络监视器
    this.networkMonitor.initialize()
      .then(status => {
        this._state.networkStatus = status;
        this._state.isReady = true;
        this.emit('ready', { status });
        logDebug('ResourceLoader ready, network status:', status);
      })
      .catch(error => {
        logWarning('ResourceLoader initialization warning:', error);
        this._state.networkStatus = 'unknown';
        this._state.isReady = true;
        this.emit('ready', { status: 'unknown', error });
      });
    
    // 如果启用了缓存，恢复持久化缓存
    if (this.config.enableCache && this.config.persistCache) {
      this.cache.restore()
        .then(stats => {
          logDebug('Cache restored:', stats);
          this.emit('cacheRestored', stats);
        })
        .catch(error => {
          logWarning('Failed to restore cache:', error);
        });
    }
  }
  
  /**
   * 处理网络状态变化
   * @private
   * @param {Object} event - 网络状态变化事件
   */
  _handleNetworkChange(event) {
    const { status, previousStatus } = event;
    this._state.networkStatus = status;
    
    logInfo('Network status changed from', previousStatus, 'to', status);
    this.emit('networkStatusChange', { status, previousStatus });
    
    // 网络恢复时处理之前失败的请求
    if (previousStatus === 'offline' && status !== 'offline') {
      this._recoverFailedRequests();
    }
    
    // 网络变差时调整批处理大小
    if (this._shouldReduceBatchSize(previousStatus, status)) {
      this._adjustBatchSize(status);
    }
  }
  
  /**
   * 判断是否应该减小批处理大小
   * @private
   * @param {string} previousStatus - 先前的网络状态
   * @param {string} currentStatus - 当前的网络状态
   * @return {boolean} 是否应该减小批处理大小
   */
  _shouldReduceBatchSize(previousStatus, currentStatus) {
    const networkQuality = {
      'offline': 0,
      'poor': 1,
      'fair': 2,
      'good': 3,
      'excellent': 4,
      'unknown': 2
    };
    
    return networkQuality[currentStatus] < networkQuality[previousStatus];
  }
  
  /**
   * 调整批处理大小
   * @private
   * @param {string} networkStatus - 当前网络状态
   */
  _adjustBatchSize(networkStatus) {
    const deviceType = this.config.deviceType;
    const adjustedSize = this._getOptimalBatchSize(deviceType, networkStatus);
    
    if (adjustedSize !== this._batchController.currentBatchSize) {
      logDebug(`Adjusting batch size from ${this._batchController.currentBatchSize} to ${adjustedSize} based on network status`);
      this._batchController.currentBatchSize = adjustedSize;
      this.emit('batchSizeAdjusted', { newSize: adjustedSize, reason: 'networkChange' });
    }
  }
  
  /**
   * 获取最优批处理大小
   * @private
   * @param {string} deviceType - 设备类型
   * @param {string} networkStatus - 网络状态
   * @return {number} 最优批处理大小
   */
  _getOptimalBatchSize(deviceType, networkStatus) {
    // 批处理大小矩阵 - 可以根据性能测试结果进行调整
    const batchSizeMatrix = {
      'DESKTOP': {
        'offline': 0,
        'poor': 5,
        'fair': 15,
        'good': 30,
        'excellent': 50,
        'unknown': 20
      },
      'MOBILE': {
        'offline': 0,
        'poor': 3,
        'fair': 10,
        'good': 20,
        'excellent': 30,
        'unknown': 10
      },
      'LOW_END_DESKTOP': {
        'offline': 0,
        'poor': 3,
        'fair': 8,
        'good': 15,
        'excellent': 25,
        'unknown': 10
      },
      'LOW_END_MOBILE': {
        'offline': 0,
        'poor': 2,
        'fair': 5,
        'good': 10,
        'excellent': 15,
        'unknown': 5
      }
    };
    
    // 获取设备类型的批处理大小配置，如果不存在则使用DESKTOP配置
    const deviceConfig = batchSizeMatrix[deviceType] || batchSizeMatrix['DESKTOP'];
    
    // 获取网络状态的批处理大小，如果不存在则使用unknown配置
    return deviceConfig[networkStatus.toLowerCase()] || deviceConfig['unknown'];
  }
  
  /**
   * 恢复失败的请求
   * @private
   */
  _recoverFailedRequests() {
    // 实现将在后续方法中完成
    logDebug('Network recovered, trying to recover failed requests');
  }

  /**
   * 获取当前内存使用情况
   * @private
   * @return {number} 内存使用率 (0-1)
   */
  _getMemoryUsage() {
    if (performance && performance.memory) {
      return performance.memory.usedJSHeapSize / performance.memory.jsHeapSizeLimit;
    }
    return 0.5; // 默认值
  }
  
  /**
   * 初始化性能监控
   * @private
   */
  _initPerformanceMonitoring() {
    // 周期性检查网络状态
    setInterval(() => {
      this._detectNetworkCondition();
      
      // 监控内存使用
      if (this.config.memoryMonitoring) {
        const memoryUsage = this._getMemoryUsage();
        this._state.memoryUsage = memoryUsage;
        
        // 内存使用过高时调整加载参数
        if (memoryUsage > this.config.lowMemoryThreshold) {
          this._adjustLoadParametersForMemory();
        }
      }
    }, 10000); // 每10秒检查一次
  }
  
  /**
   * 检测网络状态
   * @private
   */
  _detectNetworkCondition() {
    // 使用navigator.connection API检测网络类型和速度
    if (navigator.connection) {
      const connection = navigator.connection;
      
      // 根据网络类型调整网络状态
      if (connection.effectiveType === '4g') {
        this._state.networkCondition = 'fast';
      } else if (connection.effectiveType === '3g') {
        this._state.networkCondition = 'medium';
      } else if (connection.effectiveType === '2g' || connection.effectiveType === 'slow-2g') {
        this._state.networkCondition = 'slow';
      } else {
        this._state.networkCondition = 'normal';
      }
      
      // 根据网络状态调整加载参数
      this._adjustLoadParametersForNetwork();
    }
  }
  
  /**
   * 根据网络状态调整加载参数
   * @private
   */
  _adjustLoadParametersForNetwork() {
    // 在不同网络状态下调整并发数和批量大小
    switch (this._state.networkCondition) {
      case 'fast':
        this.config.maxConcurrentLoads = this.config.isMobile ? 8 : 15;
        break;
      case 'medium':
        this.config.maxConcurrentLoads = this.config.isMobile ? 5 : 10;
        break;
      case 'slow':
        this.config.maxConcurrentLoads = this.config.isMobile ? 3 : 6;
        break;
      default:
        this.config.maxConcurrentLoads = this.config.isMobile ? 5 : 10;
    }
  }
  
  /**
   * 内存使用过高时调整加载参数
   * @private
   */
  _adjustLoadParametersForMemory() {
    // 内存压力大时减少并发数和批量大小
    const memoryPressureRatio = (this._state.memoryUsage - this.config.lowMemoryThreshold) / 
                               (1 - this.config.lowMemoryThreshold);
    
    if (memoryPressureRatio > 0) {
      // 根据内存压力程度调整参数
      const reductionFactor = 1 - Math.min(0.6, memoryPressureRatio);
      
      // 减少并发加载数
      const originalConcurrent = this.config.isMobile ? 5 : 10;
      this.config.maxConcurrentLoads = Math.max(2, Math.floor(originalConcurrent * reductionFactor));
      
      // 减少批量大小
      const originalBatchSize = this.config.isMobile ? 10 : 20;
      this.config.defaultBatchSize = Math.max(5, Math.floor(originalBatchSize * reductionFactor));
      this.config.mobileBatchSize = Math.max(3, Math.floor(10 * reductionFactor));
      
      // 增加缓存清理频率
      this.cleanupCompletedResources();
    }
  }

  /**
   * 根据设备类型自动调整参数配置
   * @private
   */
  _optimizeForDevice() {
    const isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
    const isLowMemoryDevice = navigator.deviceMemory && navigator.deviceMemory < 4;
    
    // 保存设备信息
    this.config.isMobile = isMobile;
    this.config.isLowMemoryDevice = isLowMemoryDevice;
    
    if (isMobile || isLowMemoryDevice) {
      // 根据测试结果优化移动设备参数
      this.config.maxConcurrentLoads = Math.min(this.config.maxConcurrentLoads, 5);
      this.config.maxBatchSize = this.config.mobileBatchSize;
      this.config.lowPowerMode = true;
      
      // 移动设备特定优化
      if (isMobile) {
        // 减少内存使用
        this.config.priorityAdjustThreshold = 30; // 更频繁地重排序
      }
      
      // 低内存设备特定优化
      if (isLowMemoryDevice) {
        this.config.memoryMonitoring = true;
        this.config.lowMemoryThreshold = 0.7; // 更早触发内存优化
      }
    } else {
      // 桌面设备优化
      this.config.maxBatchSize = this.config.defaultBatchSize;
    }
  }

  /**
   * 配置加载器
   * @param {Object} config - 新的配置选项
   * @return {ResourceLoader} 链式调用支持
   */
  configure(config) {
    this.config = { ...this.config, ...config };
    return this;
  }
  
  /**
   * 添加事件监听器
   * @param {string} eventName - 事件名称
   * @param {Function} callback - 回调函数
   * @return {ResourceLoader} 链式调用支持
   */
  addEventListener(eventName, callback) {
    if (!this._listeners[eventName]) {
      this._listeners[eventName] = [];
    }
    
    this._listeners[eventName].push(callback);
    return this;
  }
  
  /**
   * 移除事件监听器
   * @param {string} eventName - 事件名称
   * @param {Function} callback - 要移除的回调函数
   * @return {ResourceLoader} 链式调用支持
   */
  removeEventListener(eventName, callback) {
    if (!this._listeners[eventName]) return this;
    
    this._listeners[eventName] = this._listeners[eventName]
      .filter(listener => listener !== callback);
      
    return this;
  }
  
  /**
   * 移除所有事件监听器
   * @return {ResourceLoader} 链式调用支持
   */
  removeAllListeners() {
    this._listeners = {};
    return this;
  }
  
  /**
   * 触发事件
   * @param {string} eventName - 事件名称
   * @param {Object} data - 事件数据
   * @private
   */
  _trigger(eventName, data) {
    if (!this._listeners[eventName]) return;
    
    this._listeners[eventName].forEach(callback => {
      try {
        callback(data);
      } catch (error) {
        console.error(`Error in event listener for ${eventName}:`, error);
      }
    });
  }
  
  /**
   * 加载单个资源
   * @param {string} url - 资源URL
   * @param {Object} options - 加载选项
   * @param {boolean} options.bypass - 绕过缓存直接加载
   * @param {boolean} options.priority - 优先级（1-10，默认5）
   * @param {boolean} options.timeout - 自定义超时时间（毫秒）
   * @param {string} options.responseType - 响应类型 ('json', 'text', 'blob', 'arraybuffer')
   * @return {Promise<any>} 包含加载资源的Promise
   */
  async load(url, options = {}) {
    if (!url) {
      throw new Error('Resource URL is required');
    }

    // 合并选项
    const loadOptions = {
      bypass: false,
      priority: 5,
      timeout: this.config.timeout,
      responseType: 'json',
      ...options
    };

    // 性能跟踪
    const perfTrackingId = this.performanceTracker.startTracking(`load:${url}`);

    try {
      // 检查网络状态
      if (this._state.networkStatus === 'offline' && !loadOptions.bypass) {
        logInfo(`Network is offline, attempting to load ${url} from cache`);
        // 离线模式尝试从缓存加载
        const cachedResource = await this.getFromCache(url);
        if (cachedResource) {
          this.performanceTracker.endTracking(perfTrackingId, { source: 'cache', success: true });
          return cachedResource;
        }
        throw new Error(`Cannot load ${url}, network is offline and resource not in cache`);
      }

      // 如果未绕过缓存且缓存启用，检查缓存
      if (!loadOptions.bypass && this.config.enableCache) {
        const cachedResource = await this.getFromCache(url);
        if (cachedResource) {
          this._state.totalCached++;
          this.performanceTracker.endTracking(perfTrackingId, { source: 'cache', success: true });
          return cachedResource;
        }
      }

      // 缓存未命中，执行网络请求
      const resource = await this._fetchResource(url, loadOptions);
      
      // 如果启用了缓存，将资源存入缓存
      if (this.config.enableCache && resource) {
        this.cache.store(url, resource);
      }
      
      this._state.totalLoaded++;
      this.performanceTracker.endTracking(perfTrackingId, { source: 'network', success: true });
      this.emit('resourceLoaded', { url, source: 'network' });
      
      return resource;
    } catch (error) {
      this._state.totalFailed++;
      this.performanceTracker.endTracking(perfTrackingId, { source: 'error', success: false });
      this.emit('resourceError', { url, error });
      throw error;
    }
  }

  /**
   * 从网络获取资源
   * @private
   * @param {string} url - 资源URL
   * @param {Object} options - 加载选项
   * @return {Promise<any>} 包含资源的Promise
   */
  async _fetchResource(url, options) {
    // 创建请求ID
    const requestId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // 创建请求配置
    const fetchOptions = {
      method: 'GET',
      credentials: 'same-origin',
      headers: this._getRequestHeaders(),
      mode: 'cors',
      cache: 'default',
      signal: options.abortController ? options.abortController.signal : null
    };

    // 设置超时控制器
    const timeoutId = setTimeout(() => {
      if (options.abortController) {
        options.abortController.abort();
      }
    }, options.timeout);

    try {
      // 跟踪活跃请求
      this._state.activeRequests.set(requestId, { url, options, startTime: Date.now() });
      this.emit('requestStarted', { url, requestId });
      
      // 执行网络请求
      const response = await this.fetchImpl(url, fetchOptions);
      
      // 处理响应
      if (!response.ok) {
        throw new Error(`HTTP error ${response.status}: ${response.statusText}`);
      }
      
      // 根据响应类型处理数据
      let data;
      switch (options.responseType) {
        case 'json':
          data = await response.json();
          break;
        case 'text':
          data = await response.text();
          break;
        case 'blob':
          data = await response.blob();
          break;
        case 'arraybuffer':
          data = await response.arrayBuffer();
          break;
        default:
          data = await response.json();
      }
      
      // 请求完成，从活跃请求中移除
      this._state.activeRequests.delete(requestId);
      this.emit('requestCompleted', { 
        url, 
        requestId, 
        duration: Date.now() - this._state.activeRequests.get(requestId).startTime 
      });
      
      return data;
    } catch (error) {
      // 处理错误
      this._state.activeRequests.delete(requestId);
      this.emit('requestFailed', { url, requestId, error });
      
      // 重试逻辑
      if (this._shouldRetry(error, options)) {
        return this._retryFetchResource(url, options);
      }
      
      throw error;
    } finally {
      // 清除超时计时器
      clearTimeout(timeoutId);
    }
  }

  /**
   * 确定是否应该重试请求
   * @private
   * @param {Error} error - 发生的错误
   * @param {Object} options - 请求选项
   * @return {boolean} 是否应该重试
   */
  _shouldRetry(error, options) {
    // 如果已达最大重试次数，不再重试
    if (options.retryCount >= this.config.retryStrategy.count) {
      return false;
    }
    
    // 如果是超时或网络错误，尝试重试
    return error.name === 'AbortError' || 
           error.message.includes('network') || 
           error.message.includes('timeout');
  }

  /**
   * 重试获取资源
   * @private
   * @param {string} url - 资源URL
   * @param {Object} options - 加载选项
   * @return {Promise<any>} 包含资源的Promise
   */
  async _retryFetchResource(url, options) {
    const retryCount = (options.retryCount || 0) + 1;
    const backoffFactor = this.config.retryStrategy.backoffFactor;
    const baseDelay = this.config.retryStrategy.delay;
    
    // 计算退避延迟（带随机抖动）
    let delay = baseDelay * Math.pow(backoffFactor, retryCount - 1);
    if (this.config.retryStrategy.jitter) {
      // 添加0-30%的随机抖动
      delay = delay * (1 + Math.random() * 0.3);
    }
    
    // 限制最大延迟
    delay = Math.min(delay, this.config.retryStrategy.maxDelay);
    
    logInfo(`Retrying ${url} (attempt ${retryCount}) after ${Math.round(delay)}ms`);
    
    // 等待退避时间
    await new Promise(resolve => setTimeout(resolve, delay));
    
    // 创建新的终止控制器
    const abortController = new AbortController();
    
    // 重试请求
    return this._fetchResource(url, {
      ...options,
      retryCount,
      abortController
    });
  }

  /**
   * 获取请求头
   * @private
   * @return {Object} 请求头对象
   */
  _getRequestHeaders() {
    const headers = {
      'Accept': 'application/json, text/plain, */*',
      'X-Requested-With': 'XMLHttpRequest'
    };
    
    // 添加企业环境认证头
    if (this.config.enterpriseMode && this.config.authTokenHeader) {
      const authToken = this._getAuthToken();
      if (authToken) {
        headers[this.config.authTokenHeader] = authToken;
      }
    }
    
    // 添加压缩支持
    if (this.config.compression) {
      headers['Accept-Encoding'] = 'gzip, deflate, br';
    }
    
    return headers;
  }

  /**
   * 获取认证令牌
   * @private
   * @return {string|null} 认证令牌
   */
  _getAuthToken() {
    // 从localStorage获取令牌
    return localStorage.getItem('auth_token');
  }

  /**
   * 批量加载资源
   * @param {Array<string>} urls - 资源URL数组
   * @param {Object} options - 加载选项
   * @return {Promise<Array<any>>} 包含所有资源的Promise
   */
  async loadBatch(urls, options = {}) {
    if (!Array.isArray(urls) || urls.length === 0) {
      return [];
    }
    
    // 合并选项
    const batchOptions = {
      bypass: false,
      priority: 5,
      timeout: this.config.timeout,
      responseType: 'json',
      ...options
    };
    
    // 性能跟踪
    const perfTrackingId = this.performanceTracker.startTracking(`loadBatch:${urls.length}`);
    
    try {
      // 批量大小（使用自适应大小或默认大小）
      const batchSize = this._batchController.currentBatchSize;
      
      // 根据优先级排序
      const sortedUrls = this._sortByPriority(urls, batchOptions.priority);
      
      // 分批处理
    const results = [];
      const batches = [];
      
      // 将资源分成多个批次
      for (let i = 0; i < sortedUrls.length; i += batchSize) {
        batches.push(sortedUrls.slice(i, i + batchSize));
      }
      
      // 跟踪批处理状态
      this._state.batchesInProgress++;
      this.emit('batchStarted', { 
        batchCount: batches.length,
        urlCount: urls.length,
        batchSize 
      });
      
      // 顺序处理批次
      for (const batch of batches) {
        // 并行加载每个批次中的资源
        const batchResults = await Promise.all(
          batch.map(url => this.load(url, batchOptions)
            .catch(error => {
              // 捕获单个资源加载错误，但继续加载其他资源
              logError(`Error loading ${url} in batch:`, error);
              return null;
            })
          )
        );
        
        // 合并结果
        results.push(...batchResults);
      }
      
      // 批处理完成
      this._state.batchesInProgress--;
      this.performanceTracker.endTracking(perfTrackingId, { success: true });
      this.emit('batchCompleted', { 
        urlCount: urls.length, 
        successCount: results.filter(res => res !== null).length 
      });
      
      return results;
    } catch (error) {
      this._state.batchesInProgress--;
      this.performanceTracker.endTracking(perfTrackingId, { success: false });
      this.emit('batchError', { error });
      throw error;
    }
  }
  
  /**
   * 根据优先级排序URL
   * @private
   * @param {Array<string>} urls - URL数组
   * @param {number} defaultPriority - 默认优先级
   * @return {Array<string>} 排序后的URL数组
   */
  _sortByPriority(urls, defaultPriority) {
    if (!this.config.prioritizeCriticalResources) {
      return urls;
    }
    
    // 获取URL优先级函数
    const getUrlPriority = (url) => {
      // 实现URL优先级确定逻辑
      // 示例：关键JS和CSS具有较高优先级
      if (url.includes('critical') || url.includes('main')) return 10;
      if (url.endsWith('.css')) return 8;
      if (url.endsWith('.js')) return 7;
      if (url.endsWith('.json')) return 5;
      if (url.includes('image') || url.endsWith('.png') || url.endsWith('.jpg')) return 3;
      return defaultPriority;
    };
    
    // 创建URL和优先级对象
    const urlsWithPriority = urls.map(url => ({
      url,
      priority: getUrlPriority(url)
    }));
    
    // 按优先级排序（从高到低）
    urlsWithPriority.sort((a, b) => b.priority - a.priority);
    
    // 返回排序后的URL数组
    return urlsWithPriority.map(item => item.url);
  }

  /**
   * 预加载资源
   * @param {Array<string>} urls - 资源URL数组
   * @param {Object} options - 加载选项
   * @return {Promise<void>} 预加载完成的Promise
   */
  async preload(urls, options = {}) {
    if (!Array.isArray(urls) || urls.length === 0) {
      return;
    }
    
    // 合并选项（预加载使用较低优先级）
    const preloadOptions = {
      bypass: false,
      priority: 2,
      responseType: 'json',
      ...options
    };
    
    try {
      // 标记为预加载，避免阻塞关键资源加载
      this.emit('preloadStarted', { urlCount: urls.length });
      
      // 在后台加载资源
      this.loadBatch(urls, preloadOptions)
        .then(() => {
          this.emit('preloadCompleted', { urlCount: urls.length });
        })
        .catch(error => {
          logWarning('Preload error:', error);
          this.emit('preloadError', { error });
        });
    } catch (error) {
      logWarning('Preload initiation error:', error);
    }
  }

  /**
   * 从缓存获取资源
   * @param {string} url - 资源URL
   * @return {Promise<any>} 包含资源的Promise或null（如果未找到）
   */
  async getFromCache(url) {
    if (!this.config.enableCache) {
      return null;
    }
    
    try {
      const resource = await this.cache.get(url);
      if (resource) {
        this.emit('cacheHit', { url });
        return resource;
    } else {
        this.emit('cacheMiss', { url });
        return null;
      }
    } catch (error) {
      logWarning(`Error retrieving ${url} from cache:`, error);
      this.emit('cacheError', { url, error });
      return null;
    }
  }
  
  /**
   * 清除缓存
   * @param {boolean} preserveEssential - 是否保留必要资源
   * @return {Promise<void>} 清除完成的Promise
   */
  async clearCache(preserveEssential = false) {
    if (!this.config.enableCache) {
      return;
    }
    
    try {
      const result = await this.cache.clear(preserveEssential);
      this.emit('cacheCleared', { preserveEssential, ...result });
      logInfo('Cache cleared:', result);
    } catch (error) {
      logError('Error clearing cache:', error);
      this.emit('cacheError', { operation: 'clear', error });
      throw error;
    }
  }
}

module.exports = ResourceLoader; 