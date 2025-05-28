/**
 * @file 资源加载器
 * @description 负责加载图片、脚本、样式表等资源，支持批处理、缓存和离线功能
 * @version 1.5.5
 */

const EventEmitter = require('../utils/common/event-emitter');
const NetworkMonitor = require('./network-monitor');
const ResourceCache = require('../storage/resource-cache');
const PerformanceTracker = require('../utils/performance/performance-tracker');
const { logError, logWarning, logInfo, logDebug } = require('../utils/common/logger');
const createResourceLoaderConfig = require('../config/resource-loader-config');

// 事件类型常量
const EVENTS = {
  LOAD_START: 'load:start',
  LOAD_COMPLETE: 'load:complete',
  LOAD_ERROR: 'load:error',
  QUEUE_COMPLETE: 'queue:complete',
  NETWORK_STATUS: 'network:status',
  CACHE_UPDATED: 'cache:updated',
  PERF_METRICS: 'perf:metrics',
  REQUEST_MERGED: 'request:merged',  // 合并请求事件
  BATCH_SIZE_ADJUSTED: 'batch:size:adjusted' // 批量大小调整事件
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
      pendingPromises: new Map(), // 跟踪相同URL的进行中请求
      requestQueue: [],
      batchesInProgress: 0,
      totalLoaded: 0,
      totalFailed: 0,
      totalCached: 0,
      totalMerged: 0,  // 记录合并的请求数
      memoryUsage: 0,   // 当前内存使用率
      networkChanges: [], // 记录网络变化历史
      memoryDetails: null,
      memoryStatus: null
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
      queue: [],
      lastAdjustTime: Date.now() // 记录最后批量大小调整时间
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
    
    // 记录网络状态变化历史
    this._state.networkChanges.push({
      from: previousStatus,
      to: status,
      time: Date.now()
    });
    
    // 只保留最近10分钟的网络变化记录
    const tenMinutesAgo = Date.now() - 600000;
    this._state.networkChanges = this._state.networkChanges.filter(
      change => change.time >= tenMinutesAgo
    );
    
    // 检测短时间内的频繁变化
    const recentChanges = this._state.networkChanges.filter(
      change => Date.now() - change.time < 10000
    );
    
    // 应用去抖动策略：如果10秒内状态变化超过3次
    if (recentChanges.length >= 3) {
      // 使用一个保守的网络状态
      const conservativeStatus = this._getConservativeNetworkStatus(recentChanges);
      
      if (conservativeStatus !== this._state.networkStatus) {
        logInfo(`检测到网络状态快速切换，使用保守状态: ${conservativeStatus}`);
        this._state.networkStatus = conservativeStatus;
        this.emit(EVENTS.NETWORK_STATUS, { status: conservativeStatus, isDebounced: true });
      } else {
        // 忽略此次变化
        return;
      }
    } else {
      // 正常更新网络状态
      this._state.networkStatus = status;
    }
    
    logInfo('网络状态从', previousStatus, '变为', status);
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
   * 获取保守的网络状态（网络频繁变化时使用）
   * @private
   * @param {Array} changes - 最近的网络变化记录
   * @return {string} 保守的网络状态
   */
  _getConservativeNetworkStatus(changes) {
    // 提取所有状态
    const allStatuses = changes.map(c => c.to);
    
    // 按保守程度排序网络状态
    const statusPriority = {
      'offline': 0,
      'poor': 1,
      'fair': 2,
      'good': 3,
      'excellent': 4,
      'unknown': 2
    };
    
    // 统计状态出现次数
    const statusCount = {};
    allStatuses.forEach(s => {
      statusCount[s] = (statusCount[s] || 0) + 1;
    });
    
    // 首先选择出现次数最多的状态
    let mostFrequent = allStatuses[0];
    Object.keys(statusCount).forEach(s => {
      if (statusCount[s] > statusCount[mostFrequent]) {
        mostFrequent = s;
      }
    });
    
    // 如果最频繁的状态出现次数>=2，则使用它
    if (statusCount[mostFrequent] >= 2) {
      return mostFrequent;
    }
    
    // 否则选择最保守的状态
    return allStatuses.reduce((conservative, current) => {
      return statusPriority[current] < statusPriority[conservative] ? 
             current : conservative;
    }, allStatuses[0]);
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
      this.emit(EVENTS.BATCH_SIZE_ADJUSTED, { newSize: adjustedSize, reason: 'networkChange' });
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
    // 批处理大小矩阵 - 根据性能测试结果进行优化调整
    const batchSizeMatrix = {
      'DESKTOP': {
        'offline': 0,
        'poor': 5,
        'fair': 20, // 从15增加到20
        'good': 40, // 从30增加到40
        'excellent': 50,
        'unknown': 25 // 从20增加到25
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
        'fair': 10, // 从8增加到10
        'good': 20, // 从15增加到20
        'excellent': 30, // 从25增加到30
        'unknown': 15  // 从10增加到15
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
    let size = deviceConfig[networkStatus.toLowerCase()] || deviceConfig['unknown'];
    
    // 根据内存使用情况调整批量大小
    const memoryUsage = this._getMemoryUsage();
    this._state.memoryUsage = memoryUsage; // 更新内存使用状态
    
    // 当内存使用率高时降低批量大小
    if (memoryUsage > 0.7) {
      size = Math.floor(size * 0.7);
      logDebug(`检测到内存使用率高 (${memoryUsage.toFixed(2)}), 降低批量大小`);
    }
    
    return Math.max(size, 2); // 确保至少为2
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
      const memoryStatus = {
        used: performance.memory.usedJSHeapSize,
        total: performance.memory.totalJSHeapSize,
        limit: performance.memory.jsHeapSizeLimit
      };
      
      // 计算使用率及变化
      const usageRatio = memoryStatus.used / memoryStatus.limit;
      
      // 更新内存使用详情
      this._state.memoryDetails = {
        ...memoryStatus,
        usageRatio,
        timestamp: Date.now()
      };
      
      return usageRatio;
    }
    
    // 降级方案：如果无法获取内存信息，使用基于活跃请求的估算
    return Math.min(0.5 + (this._state.activeRequests.size * 0.01), 0.9);
  }
  
  /**
   * 内存使用过高时调整加载参数
   * @private
   */
  _adjustLoadParametersForMemory() {
    const memoryUsage = this._state.memoryDetails?.usageRatio || this._getMemoryUsage();
    
    // 内存压力分级
    let pressureLevel = 'normal';
    if (memoryUsage > 0.85) pressureLevel = 'critical';
    else if (memoryUsage > 0.7) pressureLevel = 'high';
    else if (memoryUsage > 0.5) pressureLevel = 'medium';
    
    // 根据内存压力等级调整参数
    switch (pressureLevel) {
      case 'critical':
        // 紧急释放缓存
        if (this.cache && typeof this.cache.pruneCache === 'function') {
          this.cache.pruneCache(0.5); // 释放50%的缓存
          logWarning('内存压力临界，释放50%缓存');
        }
        
        // 极度减小批量大小和并发数
        this._batchController.currentBatchSize = Math.max(3, Math.floor(this._batchController.currentBatchSize * 0.5));
        this._batchController.maxConcurrent = Math.max(2, Math.floor(this.config.maxConcurrentRequests * 0.5));
        break;
        
      case 'high':
        // 释放部分缓存
        if (this.cache && typeof this.cache.pruneCache === 'function') {
          this.cache.pruneCache(0.3); // 释放30%的缓存
          logInfo('内存压力高，释放30%缓存');
        }
        
        // 显著减小批量大小和并发数
        this._batchController.currentBatchSize = Math.max(5, Math.floor(this._batchController.currentBatchSize * 0.7));
        this._batchController.maxConcurrent = Math.max(3, Math.floor(this.config.maxConcurrentRequests * 0.7));
        break;
        
      case 'medium':
        // 轻微减小批量大小
        this._batchController.currentBatchSize = Math.max(10, Math.floor(this._batchController.currentBatchSize * 0.9));
        break;
        
      default:
        // 无需调整
        return;
    }
    
    logDebug(`内存压力调整(${pressureLevel}): 批量大小=${this._batchController.currentBatchSize}, 并发=${this._batchController.maxConcurrent}`);
    
    // 通知内存压力调整
    this.emit('memoryPressureAdjustment', {
      level: pressureLevel,
      usage: memoryUsage,
      batchSize: this._batchController.currentBatchSize,
      concurrentRequests: this._batchController.maxConcurrent
    });
  }

  /**
   * 根据网络状态调整加载参数
   * @private
   */
  _adjustLoadParametersForNetwork() {
    const networkCondition = this._state.networkCondition;
    const deviceType = this.config.deviceType;
    const isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
    
    // 网络状态对应的参数配置
    const networkParams = {
      'fast': {
        concurrentRequests: isMobile ? 8 : 15,
        retryDelay: 500,
        retryCount: 1,
        timeout: 8000
      },
      'medium': {
        concurrentRequests: isMobile ? 5 : 10,
        retryDelay: 1000,
        retryCount: 2,
        timeout: 15000
      },
      'slow': {
        concurrentRequests: isMobile ? 3 : 6,
        retryDelay: 2000,
        retryCount: 3,
        timeout: 30000
      },
      'normal': {
        concurrentRequests: isMobile ? 5 : 10,
        retryDelay: 1000,
        retryCount: 2,
        timeout: 15000
      }
    };
    
    // 获取对应的网络参数
    const params = networkParams[networkCondition] || networkParams.normal;
    
    // 调整配置参数
    const previousMaxConcurrent = this._batchController.maxConcurrent;
    this._batchController.maxConcurrent = params.concurrentRequests;
    
    // 更新重试策略
    this.config.retryStrategy = {
      ...this.config.retryStrategy,
      delay: params.retryDelay,
      count: params.retryCount
    };
    
    // 更新超时设置
    this.config.timeout = params.timeout;
    
    // 记录参数调整
    if (previousMaxConcurrent !== params.concurrentRequests) {
      logInfo(`网络状态(${networkCondition})参数调整: 并发数=${params.concurrentRequests}, 超时=${params.timeout}ms`);
      
      this.emit('networkParamsAdjusted', {
        condition: networkCondition,
        params: params,
        previousConcurrent: previousMaxConcurrent
      });
    }
  }

  /**
   * 收集性能指标并分析
   * @private
   */
  _collectPerformanceMetrics() {
    if (!this.config.enablePerformanceMonitoring) return;
    
    // 收集基本指标
    const metrics = {
      timestamp: Date.now(),
      memory: this._state.memoryDetails || { usageRatio: this._state.memoryUsage },
      network: {
        condition: this._state.networkCondition,
        status: this._state.networkStatus,
        activeRequests: this._state.activeRequests.size
      },
      resources: {
        totalLoaded: this._state.totalLoaded,
        totalFailed: this._state.totalFailed,
        totalCached: this._state.totalCached,
        totalMerged: this._state.totalMerged,
        successRate: this._state.totalLoaded > 0 ? 
                     this._state.totalLoaded / (this._state.totalLoaded + this._state.totalFailed) : 1
      },
      batches: {
        currentSize: this._batchController.currentBatchSize,
        inProgress: this._state.batchesInProgress
      }
    };
    
    // 加载中资源的状态分布
    const loadingResources = [...this._state.activeRequests.values()];
    if (loadingResources.length > 0) {
      // 计算各优先级的资源数量
      const priorityCounts = {};
      loadingResources.forEach(resource => {
        const priority = resource.options.priority || 5;
        priorityCounts[priority] = (priorityCounts[priority] || 0) + 1;
      });
      
      // 计算平均加载时间
      const now = Date.now();
      const loadingTimes = loadingResources.map(r => now - r.startTime);
      const avgLoadingTime = loadingTimes.reduce((sum, time) => sum + time, 0) / loadingTimes.length;
      
      metrics.activeLoads = {
        count: loadingResources.length,
        avgTimeMs: avgLoadingTime,
        priorityDistribution: priorityCounts
      };
    }
    
    // 计算峰值和变化率
    this._updatePerformancePeaks(metrics);
    
    // 发送指标
    this.emit(EVENTS.PERF_METRICS, metrics);
    
    // 如果配置了发送分析数据，则上报
    if (this.config.reportMetricsToAnalytics && this.performanceTracker) {
      this.performanceTracker.trackMetrics('resource-loader-metrics', metrics);
    }
    
    // 检查性能异常
    this._detectPerformanceAnomaly(metrics);
  }

  /**
   * 更新性能指标峰值记录
   * @private
   * @param {Object} metrics - 当前性能指标
   */
  _updatePerformancePeaks(metrics) {
    // 初始化峰值记录
    if (!this._state.performancePeaks) {
      this._state.performancePeaks = {
        memory: {
          peak: metrics.memory.usageRatio,
          timestamp: metrics.timestamp
        },
        concurrentRequests: {
          peak: metrics.network.activeRequests,
          timestamp: metrics.timestamp
        }
      };
      
      // 初始化性能历史
      this._state.performanceHistory = [];
    }
    
    // 更新峰值记录
    const peaks = this._state.performancePeaks;
    
    if (metrics.memory.usageRatio > peaks.memory.peak) {
      peaks.memory = {
        peak: metrics.memory.usageRatio,
        timestamp: metrics.timestamp
      };
    }
    
    if (metrics.network.activeRequests > peaks.concurrentRequests.peak) {
      peaks.concurrentRequests = {
        peak: metrics.network.activeRequests,
        timestamp: metrics.timestamp
      };
    }
    
    // 保存历史记录（最多保留50条）
    this._state.performanceHistory.push({
      timestamp: metrics.timestamp,
      memory: metrics.memory.usageRatio,
      activeRequests: metrics.network.activeRequests,
      batchSize: metrics.batches.currentSize
    });
    
    // 限制历史记录大小
    if (this._state.performanceHistory.length > 50) {
      this._state.performanceHistory.shift();
    }
    
    // 将峰值数据添加到指标中
    metrics.peaks = peaks;
  }

  /**
   * 检测性能异常
   * @private
   * @param {Object} metrics - 当前性能指标
   */
  _detectPerformanceAnomaly(metrics) {
    // 需要至少5个历史记录点才能检测异常
    if (!this._state.performanceHistory || this._state.performanceHistory.length < 5) {
      return;
    }
    
    const history = this._state.performanceHistory;
    const current = metrics;
    
    // 计算内存使用增长率
    const memoryHistory = history.slice(-5).map(h => h.memory);
    const avgMemory = memoryHistory.reduce((sum, m) => sum + m, 0) / memoryHistory.length;
    const memoryGrowthRate = (current.memory.usageRatio - memoryHistory[0]) / memoryHistory[0];
    
    // 检测内存泄漏
    if (memoryGrowthRate > 0.2 && current.memory.usageRatio > 0.7) {
      logWarning('检测到可能的内存泄漏: 5个检查点内存增长率超过20%');
      
      this.emit('performanceAnomaly', {
        type: 'memory-leak',
        growthRate: memoryGrowthRate,
        currentUsage: current.memory.usageRatio,
        avgUsage: avgMemory,
        timestamp: current.timestamp
      });
    }
    
    // 检测长时间挂起的请求
    const longRunningRequests = [...this._state.activeRequests.entries()]
      .filter(([id, details]) => {
        return Date.now() - details.startTime > this.config.timeout * 1.5;
      });
    
    if (longRunningRequests.length > 0) {
      logWarning(`检测到 ${longRunningRequests.length} 个长时间挂起的请求`);
      
      this.emit('performanceAnomaly', {
        type: 'hanging-requests',
        count: longRunningRequests.length,
        requests: longRunningRequests.map(([id, details]) => ({
          id,
          url: details.url,
          startTime: details.startTime,
          elapsed: Date.now() - details.startTime
        })),
        timestamp: current.timestamp
      });
    }
    
    // 检测过高失败率
    const recentTotal = metrics.resources.totalLoaded + metrics.resources.totalFailed;
    if (recentTotal > 10 && metrics.resources.successRate < 0.7) {
      logWarning(`检测到较高的请求失败率: ${((1 - metrics.resources.successRate) * 100).toFixed(1)}%`);
      
      this.emit('performanceAnomaly', {
        type: 'high-failure-rate',
        successRate: metrics.resources.successRate,
        networkStatus: metrics.network.status,
        timestamp: current.timestamp
      });
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
    // 请求合并增强逻辑
    if (this.config.enableRequestMerging && !options.bypassMerging) {
      // 检查是否已有相同URL的请求正在进行中
      if (this._state.pendingPromises.has(url)) {
        logDebug(`请求合并: ${url} 已有相同请求进行中，合并处理`);
        this._state.totalMerged++;
        
        // 分析合并类型（根据响应类型和参数）
        const originalOptions = this._state.activeRequests.get([...this._state.activeRequests.keys()].find(
          k => this._state.activeRequests.get(k).url === url
        )) || { responseType: 'unknown' };
        
        this.emit(EVENTS.REQUEST_MERGED, { 
          url, 
          originalOptions: originalOptions,
          mergedOptions: options,
          timestamp: Date.now()
        });
        
        // 返回已存在的请求Promise
        return this._state.pendingPromises.get(url);
      }
    }

    // 网络状态检查和超时优化
    if (this._state.networkStatus === 'poor' && !options.optimizedForPoorNetwork) {
      // 弱网环境下增加超时时间
      options.timeout = Math.min(options.timeout * 1.5, 60000); // 增加50%但不超过60秒
      options.optimizedForPoorNetwork = true;
      logDebug(`弱网环境优化: 为 ${url} 增加超时时间至 ${options.timeout}ms`);
    }

    // 以下是原有的请求逻辑
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

    // 创建请求Promise
    const fetchPromise = (async () => {
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
        
        // 从待处理Promise映射中移除
        if (this.config.enableRequestMerging) {
          this._state.pendingPromises.delete(url);
        }
      }
    })();

    // 如果启用了请求合并，将当前请求添加到pendingPromises
    if (this.config.enableRequestMerging) {
      this._state.pendingPromises.set(url, fetchPromise);
    }

    return fetchPromise;
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
      // 获取当前最优批量大小（根据网络和内存状态动态调整）
      const currentNetworkStatus = this._state.networkStatus;
      const deviceType = this.config.deviceType;
      const batchSize = this._batchController.currentBatchSize;
      
      // 根据优先级排序
      const sortedUrls = this._sortByPriority(urls, batchOptions.priority);
      
      // 去重URL以避免批处理中的重复请求
      const uniqueUrls = this._removeDuplicateUrls(sortedUrls);
      
      // 如果存在重复URL，记录去重信息
      if (uniqueUrls.length < sortedUrls.length) {
        logInfo(`批处理URL去重: 从 ${sortedUrls.length} 减少到 ${uniqueUrls.length} 个唯一URL`);
        this.emit('batchDeduplicated', {
          originalCount: sortedUrls.length,
          uniqueCount: uniqueUrls.length,
          duplicatesRemoved: sortedUrls.length - uniqueUrls.length
        });
      }
      
      // 按资源类型分组 (对大批量加载进行优化)
      let batches = [];
      
      if (uniqueUrls.length > 20 && this.config.enableTypeBasedBatching) {
        // 按资源类型分组
        const resourceTypes = this._groupResourcesByType(uniqueUrls);
        
        // 优先加载关键资源(CSS, JS)
        const criticalTypes = ['css', 'js', 'json'];
        const criticalUrls = [].concat(...criticalTypes.map(type => resourceTypes[type] || []));
        const nonCriticalUrls = [].concat(
          ...(Object.keys(resourceTypes)
            .filter(type => !criticalTypes.includes(type))
            .map(type => resourceTypes[type] || []))
        );
        
        // 为关键资源创建批次
        for (let i = 0; i < criticalUrls.length; i += batchSize) {
          batches.push(criticalUrls.slice(i, i + batchSize));
        }
        
        // 为非关键资源创建批次
        for (let i = 0; i < nonCriticalUrls.length; i += batchSize) {
          batches.push(nonCriticalUrls.slice(i, i + batchSize));
        }
      } else {
        // 标准批次处理
        for (let i = 0; i < uniqueUrls.length; i += batchSize) {
          batches.push(uniqueUrls.slice(i, i + batchSize));
        }
      }
      
      // 跟踪批处理状态
      this._state.batchesInProgress++;
      this.emit('batchStarted', { 
        batchCount: batches.length,
        urlCount: uniqueUrls.length,
        originalUrlCount: urls.length,
        batchSize 
      });
      
      // 存储结果
      const results = [];
      
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
      
      // 如果原始URLs有重复，则需要恢复重复项的结果
      // 这确保返回结果数组与输入URLs数组大小一致
      const finalResults = this._restoreDuplicateResults(sortedUrls, uniqueUrls, results);
      
      // 批处理完成
      this._state.batchesInProgress--;
      this.performanceTracker.endTracking(perfTrackingId, { success: true });
      this.emit('batchCompleted', { 
        urlCount: urls.length, 
        successCount: finalResults.filter(res => res !== null).length 
      });
      
      return finalResults;
    } catch (error) {
      this._state.batchesInProgress--;
      this.performanceTracker.endTracking(perfTrackingId, { success: false });
      this.emit('batchError', { error });
      throw error;
    }
  }
  
  /**
   * 按资源类型对URL进行分组
   * @private
   * @param {Array<string>} urls - URL数组
   * @return {Object} 按类型分组的URL对象
   */
  _groupResourcesByType(urls) {
    const groups = {
      css: [],
      js: [],
      json: [],
      image: [],
      font: [],
      other: []
    };
    
    urls.forEach(url => {
      const ext = url.split('.').pop().toLowerCase();
      
      if (['css'].includes(ext)) {
        groups.css.push(url);
      } else if (['js'].includes(ext)) {
        groups.js.push(url);
      } else if (['json'].includes(ext)) {
        groups.json.push(url);
      } else if (['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp', 'avif'].includes(ext)) {
        groups.image.push(url);
      } else if (['woff', 'woff2', 'ttf', 'eot', 'otf'].includes(ext)) {
        groups.font.push(url);
      } else {
        groups.other.push(url);
      }
    });
    
    return groups;
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
   * 从URL数组中移除重复项
   * @private
   * @param {Array<string>} urls - URL数组
   * @return {Array<string>} 去重后的URL数组
   */
  _removeDuplicateUrls(urls) {
    return [...new Set(urls)];
  }
  
  /**
   * 恢复重复URL的结果
   * @private
   * @param {Array<string>} originalUrls - 原始URL数组
   * @param {Array<string>} uniqueUrls - 去重后的URL数组
   * @param {Array<any>} uniqueResults - 去重URL的结果数组
   * @return {Array<any>} 恢复重复项后的结果数组
   */
  _restoreDuplicateResults(originalUrls, uniqueUrls, uniqueResults) {
    // 创建URL到结果的映射
    const urlToResultMap = new Map();
    uniqueUrls.forEach((url, index) => {
      urlToResultMap.set(url, uniqueResults[index]);
    });
    
    // 为每个原始URL检索对应的结果
    return originalUrls.map(url => urlToResultMap.get(url));
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

  /**
   * 检测网络状态
   * @private
   */
  _detectNetworkCondition() {
    // 使用navigator.connection API检测网络类型和速度
    if (navigator.connection) {
      const connection = navigator.connection;
      const previousCondition = this._state.networkCondition;
      
      // 根据网络类型调整网络状态
      let newCondition;
      if (connection.effectiveType === '4g') {
        newCondition = 'fast';
      } else if (connection.effectiveType === '3g') {
        newCondition = 'medium';
      } else if (connection.effectiveType === '2g' || connection.effectiveType === 'slow-2g') {
        newCondition = 'slow';
      } else {
        newCondition = 'normal';
      }
      
      // 只有在状态变化时才更新并触发调整
      if (newCondition !== previousCondition) {
        this._state.networkCondition = newCondition;
        this._adjustLoadParametersForNetwork();
        
        // 记录状态变化
        logInfo(`网络状况从 ${previousCondition || 'unknown'} 变为 ${newCondition}`);
        this.emit('networkConditionChange', { 
          previous: previousCondition, 
          current: newCondition,
          connectionInfo: {
            type: connection.type,
            effectiveType: connection.effectiveType,
            downlink: connection.downlink,
            rtt: connection.rtt,
            saveData: connection.saveData
          }
        });
      }
      
      // 同时检查内存使用情况
      this._checkMemoryStatus();
    }
  }

  /**
   * 检查内存状态并在必要时采取措施
   * @private
   */
  _checkMemoryStatus() {
    const memoryUsage = this._getMemoryUsage();
    const previousMemoryStatus = this._state.memoryStatus || 'normal';
    
    // 确定当前内存状态
    let currentMemoryStatus;
    if (memoryUsage > 0.85) {
      currentMemoryStatus = 'critical';
    } else if (memoryUsage > 0.7) {
      currentMemoryStatus = 'high';
    } else if (memoryUsage > 0.5) {
      currentMemoryStatus = 'medium';
    } else {
      currentMemoryStatus = 'normal';
    }
    
    // 更新状态
    this._state.memoryStatus = currentMemoryStatus;
    this._state.memoryUsage = memoryUsage;
    
    // 如果内存状态恶化，进行调整
    if (this._isMemoryStatusWorse(previousMemoryStatus, currentMemoryStatus)) {
      logDebug(`内存状态从 ${previousMemoryStatus} 变为 ${currentMemoryStatus}, 使用率: ${(memoryUsage * 100).toFixed(1)}%`);
      this._adjustLoadParametersForMemory();
    }
    
    // 如果内存处于危急状态，立即采取措施
    if (currentMemoryStatus === 'critical') {
      this._handleCriticalMemory();
    }
  }

  /**
   * 判断内存状态是否恶化
   * @private
   * @param {string} previous - 先前的内存状态
   * @param {string} current - 当前的内存状态
   * @return {boolean} 是否恶化
   */
  _isMemoryStatusWorse(previous, current) {
    const statusSeverity = {
      'normal': 0,
      'medium': 1,
      'high': 2,
      'critical': 3
    };
    
    return statusSeverity[current] > statusSeverity[previous];
  }

  /**
   * 处理内存危急状态
   * @private
   */
  _handleCriticalMemory() {
    logWarning('内存处于危急状态，执行紧急措施');
    
    // 1. 清除非必要缓存
    if (this.cache && typeof this.cache.pruneCache === 'function') {
      this.cache.pruneCache(0.7);
    }
    
    // 2. 取消低优先级进行中的请求
    const lowPriorityRequests = [];
    this._state.activeRequests.forEach((details, id) => {
      if (details.options.priority < 5) {
        lowPriorityRequests.push(id);
      }
    });
    
    // 取消低优先级请求
    if (lowPriorityRequests.length > 0) {
      logWarning(`取消 ${lowPriorityRequests.length} 个低优先级请求以释放内存`);
      lowPriorityRequests.forEach(id => {
        const details = this._state.activeRequests.get(id);
        if (details && details.options.abortController) {
          details.options.abortController.abort();
        }
      });
    }
    
    // 3. 触发紧急垃圾收集（如果环境支持）
    if (typeof global !== 'undefined' && global.gc) {
      logInfo('触发垃圾收集以缓解内存压力');
      global.gc();
    }
    
    // 4. 通知应用内存危急
    this.emit('criticalMemory', {
      usage: this._state.memoryUsage,
      details: this._state.memoryDetails,
      canceledRequests: lowPriorityRequests.length,
      timestamp: Date.now()
    });
  }

  /**
   * 初始化性能监控
   * @private
   */
  _initPerformanceMonitoring() {
    // 设置定期检查间隔
    const monitorInterval = this.config.monitorInterval || 10000; // 默认10秒
    
    // 周期性检查网络和内存状态
    this._monitorIntervalId = setInterval(() => {
      // 检查网络状态
      this._detectNetworkCondition();
      
      // 收集性能指标
      this._collectPerformanceMetrics();
    }, monitorInterval);
    
    // 监控内存变化的更高频率检查
    if (this.config.enableHighFrequencyMemoryMonitoring) {
      this._memoryMonitorId = setInterval(() => {
        this._checkMemoryStatus();
      }, 2000); // 每2秒检查一次内存
    }
    
    logDebug(`性能监控已初始化，检查间隔: ${monitorInterval}ms`);
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
    
    // 设备类型定义
    let deviceType;
    if (isLowMemoryDevice && isMobile) {
      deviceType = 'LOW_END_MOBILE';
    } else if (isLowMemoryDevice) {
      deviceType = 'LOW_END_DESKTOP';
    } else if (isMobile) {
      deviceType = 'MOBILE';
    } else {
      deviceType = 'DESKTOP';
    }
    
    // 更新设备类型配置
    this.config.deviceType = deviceType;
    
    logInfo(`设备类型检测: ${deviceType}, 移动设备: ${isMobile}, 低内存设备: ${isLowMemoryDevice}`);
    
    // 应用设备特定优化
    if (isMobile || isLowMemoryDevice) {
      // 根据测试结果优化移动设备参数
      this._batchController.maxConcurrent = Math.min(this._batchController.maxConcurrent, 5);
      
      // 移动设备特定优化
      if (isMobile) {
        // 减少内存使用和资源消耗
        this.config.enableHighFrequencyMemoryMonitoring = true;
      }
      
      // 低内存设备特定优化
      if (isLowMemoryDevice) {
        // 更激进的内存监控和管理
        this.config.enableHighFrequencyMemoryMonitoring = true;
        
        // 调整批量大小（根据测试结果）
        this._batchController.currentBatchSize = Math.min(this._batchController.currentBatchSize, 15);
      }
    }
    
    // 注册设备变化监听（屏幕旋转等）
    if (typeof window !== 'undefined' && window.matchMedia) {
      // 监听屏幕方向变化
      window.matchMedia('(orientation: portrait)').addListener(() => {
        logDebug('屏幕方向已变化，重新优化加载参数');
        this._adjustLoadParametersForNetwork();
      });
    }
  }

  /**
   * 完全销毁资源加载器实例，释放所有资源和监听器
   * 确保在页面切换或组件卸载时调用，以防止内存泄漏
   */
  destroy() {
    logInfo('ResourceLoader destroy: 释放所有资源和监听器');
    
    // 清除所有正在进行的请求
    this._state.activeRequests.forEach((details) => {
      if (details.options && details.options.abortController) {
        details.options.abortController.abort();
      }
    });
    
    // 清空队列
    this._state.requestQueue = [];
    this._state.activeRequests.clear();
    this._state.pendingPromises.clear();
    
    // 销毁网络监视器
    if (this.networkMonitor) {
      this.networkMonitor.removeAllListeners();
      this.networkMonitor.destroy();
    }
    
    // 销毁性能跟踪器
    if (this.performanceTracker) {
      this.performanceTracker.stopTracking();
    }
    
    // 销毁缓存
    if (this.cache && typeof this.cache.destroy === 'function') {
      this.cache.destroy();
    }
    
    // 清除所有定时器
    if (this._batchTimer) {
      clearTimeout(this._batchTimer);
      this._batchTimer = null;
    }
    
    if (this._memoryCheckTimer) {
      clearInterval(this._memoryCheckTimer);
      this._memoryCheckTimer = null;
    }
    
    if (this._batchSizeAdjustTimer) {
      clearTimeout(this._batchSizeAdjustTimer);
      this._batchSizeAdjustTimer = null;
    }
    
    // 移除所有事件监听器
    this.removeAllListeners();
    
    // 重置状态
    this._state = {
      isReady: false,
      isLoading: false,
      networkStatus: 'unknown',
      activeRequests: new Map(),
      pendingPromises: new Map(),
      requestQueue: [],
      batchesInProgress: 0,
      totalLoaded: 0,
      totalFailed: 0,
      totalCached: 0,
      totalMerged: 0,
      memoryUsage: 0,
      networkChanges: [],
      memoryDetails: null,
      memoryStatus: null
    };
  }
}

module.exports = ResourceLoader; 