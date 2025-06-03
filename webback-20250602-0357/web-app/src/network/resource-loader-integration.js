const ResourceLoader = require('./resource-loader').ResourceLoader;
const EVENTS = require('./resource-loader').EVENTS;
const ConcurrencyController = require('./concurrency-optimizer').ConcurrencyController;
const PriorityFactorCalculator = require('./concurrency-optimizer').PriorityFactorCalculator;
const ConcurrencyABTest = require('./ab-test-framework').ConcurrencyABTest;
const PredefinedStrategies = require('./ab-test-framework').PredefinedStrategies;

/**
 * @file 资源加载器集成
 * @description 将并发控制优化器集成到资源加载器中
 * @version 1.0.0
 */

// import { ResourceLoader, EVENTS } from './resource-loader';
// import { ConcurrencyController, PriorityFactorCalculator } from './concurrency-optimizer';
// import { ConcurrencyABTest, PredefinedStrategies } from './ab-test-framework';

/**
 * 优化资源加载器
 * 将并发控制优化功能集成到资源加载器中
 */
class OptimizedResourceLoader extends ResourceLoader {
  /**
   * 创建优化资源加载器实例
   * @param {Object} config 资源加载器配置
   * @param {Object} optimizerConfig 优化器配置
   */
  constructor(config = {}, optimizerConfig = {}) {
    super(config);
    
    // 初始化优化器配置
    this.optimizerConfig = {
      useABTesting: true,
      enablePriorityFactors: true,
      concurrencyUpdateInterval: 30000,
      ...optimizerConfig
    };
    
    // 创建并发控制器
    this.concurrencyController = new ConcurrencyController({
      updateInterval: this.optimizerConfig.concurrencyUpdateInterval,
      defaultConcurrency: this.config.maxConcurrentLoads
    });
    
    // 创建优先级因子计算器
    this.priorityCalculator = new PriorityFactorCalculator();
    
    // 如果启用A/B测试
    if (this.optimizerConfig.useABTesting) {
      this._initABTesting();
    }
    
    // 替换默认并发数
    this._updateConcurrencyLimit();
    
    // 注册性能结果回调
    this.addEventListener(EVENTS.PERF_METRICS, this._handlePerfMetrics.bind(this));
    
    // 注册导航事件监听
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', () => {
        this._recordNavigation();
      });
    }
    
    // 定期更新并发限制
    this._concurrencyUpdateTimer = setInterval(() => {
      this._updateConcurrencyLimit();
    }, this.optimizerConfig.concurrencyUpdateInterval);
  }
  
  /**
   * 初始化A/B测试
   * @private
   */
  _initABTesting() {
    this.abTest = new ConcurrencyABTest({
      testId: 'resource-loader-concurrency',
      onResultsUpdated: (results) => {
        // 如果有10个以上的样本且有明显更好的策略，则切换
        if (results.strategiesAnalyzed > 1) {
          const bestStrategy = results.strategyDetails[results.bestStrategyId];
          const currentStrategy = results.strategyDetails[this.abTest.activeStrategyId];
          
          if (bestStrategy && currentStrategy && 
              bestStrategy.totalSamples > 10 && 
              bestStrategy.score > currentStrategy.score * 1.2) {
            this.abTest.selectBestStrategy();
            this._updateConcurrencyLimit();
          }
        }
      }
    });
    
    // 添加测试策略
    this.abTest.addStrategies([
      PredefinedStrategies.fixed(Math.max(4, Math.floor(this.config.maxConcurrentLoads * 0.5))),
      PredefinedStrategies.fixed(this.config.maxConcurrentLoads),
      PredefinedStrategies.fixed(Math.min(16, Math.ceil(this.config.maxConcurrentLoads * 1.5))),
      PredefinedStrategies.deviceAdaptive(),
      PredefinedStrategies.networkAdaptive(),
      PredefinedStrategies.comprehensive()
    ]);
    
    // 初始化测试
    this.abTest.initTest();
  }
  
  /**
   * 更新并发限制
   * @private
   */
  _updateConcurrencyLimit() {
    let concurrency;
    
    if (this.optimizerConfig.useABTesting && this.abTest) {
      // 使用A/B测试结果
      concurrency = this.abTest.getRecommendedConcurrency({
        deviceType: this._state.deviceType,
        memoryUsage: this._state.memoryUsage,
        batteryLevel: this._state.batteryLevel,
        isCharging: this._state.isCharging,
        networkType: this._state.networkCondition
      });
    } else {
      // 使用并发控制器
      concurrency = this.concurrencyController.getRecommendedConcurrency();
    }
    
    // 更新配置
    if (concurrency !== this.config.maxConcurrentLoads) {
      console.log(`调整资源加载并发数: ${this.config.maxConcurrentLoads} → ${concurrency}`);
      this.config.maxConcurrentLoads = concurrency;
    }
  }
  
  /**
   * 处理性能指标
   * @private
   * @param {Object} metrics 性能指标
   */
  _handlePerfMetrics(metrics) {
    // 记录并发控制结果
    this.concurrencyController.recordPerformanceResult({
      loadTime: metrics.totalTime,
      successRate: metrics.resourceCount > 0 ? 
                  (metrics.resourceCount - metrics.failedCount) / metrics.resourceCount : 1,
      resourceCount: metrics.resourceCount
    });
    
    // 如果启用A/B测试，也记录结果
    if (this.optimizerConfig.useABTesting && this.abTest) {
      this.abTest.recordResult({
        concurrencyUsed: this.config.maxConcurrentLoads,
        totalTime: metrics.totalTime,
        resourceCount: metrics.resourceCount,
        successCount: metrics.resourceCount - metrics.failedCount,
        failureCount: metrics.failedCount,
        context: {
          deviceType: this._state.deviceType,
          memoryUsage: this._state.memoryUsage,
          networkCondition: this._state.networkCondition
        }
      });
    }
  }
  
  /**
   * 记录资源使用
   * @private
   * @param {Object} resource 资源对象
   * @param {Object} performance 性能指标
   */
  _recordResourceUsage(resource, performance) {
    if (!this.optimizerConfig.enablePriorityFactors) {
      return;
    }
    
    this.priorityCalculator.recordResourceUsage(
      resource.url,
      resource.type,
      {
        loadTime: performance.loadTime,
        size: performance.size || 0,
        status: performance.success ? 'success' : 'error'
      }
    );
  }
  
  /**
   * 记录导航
   * @private
   */
  _recordNavigation() {
    if (!this.optimizerConfig.enablePriorityFactors) {
      return;
    }
    
    const currentUrl = window.location.href;
    const referrerUrl = document.referrer;
    
    if (referrerUrl) {
      this.priorityCalculator.recordNavigation(referrerUrl, currentUrl);
    }
  }
  
  /**
   * 根据优先级和上下文调整资源队列
   * 覆盖基类方法
   * @private
   */
  _sortQueue() {
    if (!this.optimizerConfig.enablePriorityFactors) {
      // 使用默认排序
      return super._sortQueue();
    }
    
    // 获取可视范围内的元素
    const inViewportElements = this._getElementsInViewport();
    
    // 使用优先级因子计算器调整资源优先级
    this._state.loadQueue.sort((a, b) => {
      const aInViewport = a.element && inViewportElements.includes(a.element);
      const bInViewport = b.element && inViewportElements.includes(b.element);
      
      // 计算资源优先级因子
      const aPriority = this.priorityCalculator.calculatePriorityFactor(
        a,
        { 
          inViewport: aInViewport,
          pageUrl: window.location.href
        }
      );
      
      const bPriority = this.priorityCalculator.calculatePriorityFactor(
        b,
        { 
          inViewport: bInViewport,
          pageUrl: window.location.href
        }
      );
      
      // 合并原始优先级和优先级因子
      const aFinalPriority = a.priority * aPriority;
      const bFinalPriority = b.priority * bPriority;
      
      return bFinalPriority - aFinalPriority;
    });
  }
  
  /**
   * 获取可视范围内的元素
   * @private
   * @returns {Array} 可视范围内的元素数组
   */
  _getElementsInViewport() {
    const elements = [];
    
    if (typeof window === 'undefined' || !document.body) {
      return elements;
    }
    
    // 获取所有加载队列中的元素
    const queueElements = this._state.loadQueue
      .map(resource => resource.element)
      .filter(el => el && el instanceof HTMLElement);
    
    const uniqueElements = [...new Set(queueElements)];
    
    // 检查元素是否在可视范围内
    uniqueElements.forEach(element => {
      if (this._isElementInViewport(element)) {
        elements.push(element);
      }
    });
    
    return elements;
  }
  
  /**
   * 检查元素是否在可视范围内
   * @private
   * @param {HTMLElement} element DOM元素
   * @returns {boolean} 是否在可视范围内
   */
  _isElementInViewport(element) {
    if (!element || typeof window === 'undefined') {
      return false;
    }
    
    const rect = element.getBoundingClientRect();
    
    return (
      rect.top >= 0 &&
      rect.left >= 0 &&
      rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
      rect.right <= (window.innerWidth || document.documentElement.clientWidth)
    );
  }
  
  /**
   * 加载资源完成后的处理
   * 覆盖基类方法以记录资源使用
   * @private
   * @param {Object} resource 资源对象
   * @param {HTMLElement} element DOM元素
   * @param {Function} resolve Promise解析函数
   */
  _handleLoadSuccess(resource, element, resolve) {
    // 记录加载时间
    const loadTime = performance.now() - resource.startTime;
    
    // 记录资源使用
    this._recordResourceUsage(resource, {
      loadTime,
      success: true,
      size: resource.size || 0
    });
    
    // 调用基类方法
    super._handleLoadSuccess(resource, element, resolve);
  }
  
  /**
   * 加载资源失败后的处理
   * 覆盖基类方法以记录资源使用
   * @private
   * @param {Object} resource 资源对象
   * @param {Error} error 错误对象
   * @param {Function} resolve Promise解析函数
   * @param {Function} reject Promise拒绝函数
   */
  _handleLoadError(resource, error, resolve, reject) {
    // 记录资源使用
    this._recordResourceUsage(resource, {
      loadTime: performance.now() - resource.startTime,
      success: false,
      error: error.message || 'Unknown error'
    });
    
    // 调用基类方法
    super._handleLoadError(resource, error, resolve, reject);
  }
  
  /**
   * 清理资源
   */
  cleanup() {
    // 清理定时器
    if (this._concurrencyUpdateTimer) {
      clearInterval(this._concurrencyUpdateTimer);
      this._concurrencyUpdateTimer = null;
    }
    
    // 清理控制器
    if (this.concurrencyController) {
      this.concurrencyController.cleanup();
    }
    
    // 移除事件监听器
    if (typeof window !== 'undefined') {
      window.removeEventListener('beforeunload', this._recordNavigation);
    }
    
    this.removeEventListener(EVENTS.PERF_METRICS, this._handlePerfMetrics);
  }
}

/**
 * 创建优化资源加载器实例
 * @param {Object} config 资源加载器配置
 * @param {Object} optimizerConfig 优化器配置
 * @returns {OptimizedResourceLoader} 优化资源加载器实例
 */
function createOptimizedLoader(config = {}, optimizerConfig = {}) {
  return new OptimizedResourceLoader(config, optimizerConfig);
}

/**
 * 导出默认创建函数
 */
// export default createOptimizedLoader; 
// CommonJS导出
module.exports = createOptimizedLoader;
module.exports.OptimizedResourceLoader = OptimizedResourceLoader;
module.exports.createOptimizedLoader = createOptimizedLoader;
