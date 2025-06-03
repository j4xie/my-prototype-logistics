/**
 * @file 并发控制A/B测试框架
 * @description 提供对并发控制策略进行A/B测试的框架，收集性能指标并分析最佳策略
 * @version 1.0.0
 */

/**
 * 并发控制测试配置
 * @typedef {Object} ConcurrencyTestConfig
 * @property {string} id 测试策略ID
 * @property {string} name 测试策略名称
 * @property {string} description 策略描述
 * @property {Function} concurrencyProvider 提供并发限制数的函数
 * @property {number} [weight=1] 分配权重
 */

/**
 * 并发控制策略A/B测试框架
 */
class ConcurrencyABTest {
  /**
   * 创建A/B测试实例
   * @param {Object} options 配置选项
   * @param {string} [options.testId='concurrency-test'] A/B测试ID
   * @param {boolean} [options.persistResults=true] 是否持久化结果
   * @param {number} [options.resultStorageDays=30] 结果存储天数
   * @param {Function} [options.onResultsUpdated] 结果更新回调
   */
  constructor(options = {}) {
    this.config = {
      testId: 'concurrency-test',
      persistResults: true,
      resultStorageDays: 30,
      onResultsUpdated: null,
      ...options
    };
    
    // 测试策略集合
    this.strategies = new Map();
    
    // 当前活动的测试策略
    this.activeStrategy = null;
    this.activeStrategyId = null;
    
    // 性能结果
    this.results = new Map();
    
    // 从本地存储加载结果
    if (this.config.persistResults) {
      this._loadResultsFromStorage();
    }
    
    // 绑定方法
    this.recordResult = this.recordResult.bind(this);
  }
  
  /**
   * 添加测试策略
   * @param {ConcurrencyTestConfig} strategyConfig 策略配置
   * @returns {boolean} 是否添加成功
   */
  addStrategy(strategyConfig) {
    if (!strategyConfig.id || !strategyConfig.name || typeof strategyConfig.concurrencyProvider !== 'function') {
      console.error('无效的测试策略配置:', strategyConfig);
      return false;
    }
    
    this.strategies.set(strategyConfig.id, {
      id: strategyConfig.id,
      name: strategyConfig.name,
      description: strategyConfig.description || '',
      concurrencyProvider: strategyConfig.concurrencyProvider,
      weight: strategyConfig.weight || 1
    });
    
    return true;
  }
  
  /**
   * 添加多个测试策略
   * @param {Array<ConcurrencyTestConfig>} strategiesConfig 策略配置数组
   * @returns {number} 成功添加的策略数量
   */
  addStrategies(strategiesConfig) {
    if (!Array.isArray(strategiesConfig)) {
      return 0;
    }
    
    let added = 0;
    for (const config of strategiesConfig) {
      if (this.addStrategy(config)) {
        added++;
      }
    }
    
    return added;
  }
  
  /**
   * 初始化测试并选择策略
   * @returns {Object|null} 活动策略或null
   */
  initTest() {
    if (this.strategies.size === 0) {
      console.error('没有可用的测试策略');
      return null;
    }
    
    // 查看本地存储是否有已分配的策略
    const savedStrategyId = this._getSavedStrategyId();
    if (savedStrategyId && this.strategies.has(savedStrategyId)) {
      this.activeStrategyId = savedStrategyId;
      this.activeStrategy = this.strategies.get(savedStrategyId);
    } else {
      // 根据权重随机选择策略
      this.activeStrategy = this._selectRandomStrategy();
      this.activeStrategyId = this.activeStrategy.id;
      
      // 保存选择的策略
      if (this.config.persistResults) {
        this._saveStrategyId(this.activeStrategyId);
      }
    }
    
    console.log(`启用并发控制测试策略: ${this.activeStrategy.name}`);
    return this.activeStrategy;
  }
  
  /**
   * 获取当前建议的并发数
   * @param {Object} context 上下文信息
   * @returns {number} 建议的并发数
   */
  getRecommendedConcurrency(context = {}) {
    if (!this.activeStrategy) {
      this.initTest();
    }
    
    if (this.activeStrategy) {
      return this.activeStrategy.concurrencyProvider(context);
    }
    
    return 8; // 默认并发数
  }
  
  /**
   * 记录测试结果
   * @param {Object} metrics 性能指标
   */
  recordResult(metrics) {
    if (!this.activeStrategyId) {
      return;
    }
    
    const now = Date.now();
    const strategyId = this.activeStrategyId;
    
    // 初始化结果集
    if (!this.results.has(strategyId)) {
      this.results.set(strategyId, []);
    }
    
    const strategyResults = this.results.get(strategyId);
    
    // 添加结果
    strategyResults.push({
      timestamp: now,
      concurrencyUsed: metrics.concurrencyUsed || 0,
      totalTime: metrics.totalTime || 0,
      resourceCount: metrics.resourceCount || 0,
      successCount: metrics.successCount || 0,
      failureCount: metrics.failureCount || 0,
      timePerResource: metrics.resourceCount ? (metrics.totalTime / metrics.resourceCount) : 0,
      successRate: metrics.resourceCount ? (metrics.successCount / metrics.resourceCount) : 0,
      context: metrics.context || {}
    });
    
    // 限制结果数量
    const maxResults = 1000;
    if (strategyResults.length > maxResults) {
      strategyResults.splice(0, strategyResults.length - maxResults);
    }
    
    // 保存结果
    if (this.config.persistResults) {
      this._saveResultsToStorage();
    }
    
    // 触发结果更新回调
    if (typeof this.config.onResultsUpdated === 'function') {
      this.config.onResultsUpdated(this.getTestResults());
    }
  }
  
  /**
   * 获取测试结果
   * @returns {Object} 测试结果分析
   */
  getTestResults() {
    const analysis = {};
    
    for (const [strategyId, results] of this.results.entries()) {
      if (results.length === 0) {
        continue;
      }
      
      const strategy = this.strategies.get(strategyId);
      
      // 计算指标平均值
      const avgTotalTime = results.reduce((sum, r) => sum + r.totalTime, 0) / results.length;
      const avgTimePerResource = results.reduce((sum, r) => sum + r.timePerResource, 0) / results.length;
      const avgSuccessRate = results.reduce((sum, r) => sum + r.successRate, 0) / results.length;
      const avgConcurrency = results.reduce((sum, r) => sum + r.concurrencyUsed, 0) / results.length;
      
      // 最近的结果（最后30条）
      const recentResults = results.slice(-30);
      const recentAvgTotalTime = recentResults.reduce((sum, r) => sum + r.totalTime, 0) / recentResults.length;
      const recentAvgSuccessRate = recentResults.reduce((sum, r) => sum + r.successRate, 0) / recentResults.length;
      
      // 分析结果
      analysis[strategyId] = {
        strategyId,
        strategyName: strategy ? strategy.name : 'Unknown',
        totalSamples: results.length,
        metrics: {
          avgTotalTime,
          avgTimePerResource,
          avgSuccessRate,
          avgConcurrency,
          recentAvgTotalTime,
          recentAvgSuccessRate
        },
        lastUpdated: Math.max(...results.map(r => r.timestamp))
      };
    }
    
    // 找出最佳策略
    let bestStrategyId = null;
    let bestScore = -Infinity;
    
    for (const strategyId in analysis) {
      // 评分公式：成功率 * 10 - 平均资源加载时间 / 100
      // 此公式更重视成功率，同时也考虑性能
      const metrics = analysis[strategyId].metrics;
      const score = (metrics.recentAvgSuccessRate * 10) - (metrics.recentAvgTotalTime / 100);
      
      analysis[strategyId].score = score;
      
      if (score > bestScore) {
        bestScore = score;
        bestStrategyId = strategyId;
      }
    }
    
    return {
      strategiesAnalyzed: Object.keys(analysis).length,
      strategyDetails: analysis,
      bestStrategyId,
      bestStrategyName: bestStrategyId ? (this.strategies.get(bestStrategyId)?.name || 'Unknown') : null,
      bestStrategyScore: bestScore === -Infinity ? null : bestScore
    };
  }
  
  /**
   * 根据测试结果选择最佳策略
   * @returns {string|null} 最佳策略ID
   */
  selectBestStrategy() {
    const results = this.getTestResults();
    
    if (!results.bestStrategyId) {
      return null;
    }
    
    this.activeStrategyId = results.bestStrategyId;
    this.activeStrategy = this.strategies.get(results.bestStrategyId);
    
    // 保存选择的策略
    if (this.config.persistResults) {
      this._saveStrategyId(this.activeStrategyId);
    }
    
    console.log(`切换到最佳并发控制策略: ${this.activeStrategy.name}`);
    return this.activeStrategyId;
  }
  
  /**
   * 重置当前测试
   * @param {boolean} [clearResults=false] 是否清除所有结果
   */
  resetTest(clearResults = false) {
    this.activeStrategy = null;
    this.activeStrategyId = null;
    
    if (clearResults) {
      this.results.clear();
      
      if (this.config.persistResults) {
        localStorage.removeItem(`${this.config.testId}-results`);
        localStorage.removeItem(`${this.config.testId}-strategy`);
      }
    }
    
    return this.initTest();
  }
  
  /**
   * 根据权重随机选择测试策略
   * @private
   * @returns {Object} 选中的策略
   */
  _selectRandomStrategy() {
    const strategies = Array.from(this.strategies.values());
    const totalWeight = strategies.reduce((sum, s) => sum + s.weight, 0);
    
    let random = Math.random() * totalWeight;
    for (const strategy of strategies) {
      random -= strategy.weight;
      if (random <= 0) {
        return strategy;
      }
    }
    
    // 默认返回第一个策略
    return strategies[0];
  }
  
  /**
   * 从本地存储获取已保存的策略ID
   * @private
   * @returns {string|null} 策略ID
   */
  _getSavedStrategyId() {
    try {
      return localStorage.getItem(`${this.config.testId}-strategy`);
    } catch (e) {
      console.error('读取保存的策略ID时出错:', e);
      return null;
    }
  }
  
  /**
   * 保存策略ID到本地存储
   * @private
   * @param {string} strategyId 策略ID
   */
  _saveStrategyId(strategyId) {
    try {
      localStorage.setItem(`${this.config.testId}-strategy`, strategyId);
    } catch (e) {
      console.error('保存策略ID时出错:', e);
    }
  }
  
  /**
   * 从本地存储加载测试结果
   * @private
   */
  _loadResultsFromStorage() {
    try {
      const savedResults = localStorage.getItem(`${this.config.testId}-results`);
      if (savedResults) {
        const parsed = JSON.parse(savedResults);
        
        // 转换为Map结构
        for (const strategyId in parsed) {
          this.results.set(strategyId, parsed[strategyId]);
        }
        
        // 清理过期结果
        this._cleanupExpiredResults();
      }
    } catch (e) {
      console.error('从本地存储加载结果时出错:', e);
    }
  }
  
  /**
   * 保存测试结果到本地存储
   * @private
   */
  _saveResultsToStorage() {
    try {
      // 将Map转换为普通对象
      const resultsObj = {};
      for (const [strategyId, results] of this.results.entries()) {
        resultsObj[strategyId] = results;
      }
      
      localStorage.setItem(`${this.config.testId}-results`, JSON.stringify(resultsObj));
    } catch (e) {
      console.error('保存测试结果到本地存储时出错:', e);
    }
  }
  
  /**
   * 清理过期的测试结果
   * @private
   */
  _cleanupExpiredResults() {
    const now = Date.now();
    const expirationTime = now - (this.config.resultStorageDays * 24 * 60 * 60 * 1000);
    
    for (const [strategyId, results] of this.results.entries()) {
      const validResults = results.filter(result => result.timestamp >= expirationTime);
      
      // 更新结果集
      if (validResults.length !== results.length) {
        this.results.set(strategyId, validResults);
      }
    }
  }
}

/**
 * 预定义的并发控制策略
 */
const PredefinedStrategies = {
  /**
   * 固定并发数策略
   * @param {number} concurrency 并发数
   * @returns {Object} 策略配置
   */
  fixedConcurrency: (value) => ({
    id: `fixed-${value}`,
    name: `固定并发(${value})`,
    description: `使用固定的并发数 ${value}`,
    concurrencyProvider: () => value
  }),
  
  /**
   * 设备性能感知策略
   * @returns {Object} 策略配置
   */
  deviceAwareConcurrency: () => ({
    id: 'device-aware',
    name: '设备感知并发',
    description: '根据设备性能调整并发数',
    concurrencyProvider: (context) => {
      // 根据设备内存和CPU核心数确定并发数
      const memory = context.deviceMemory || 4; // 默认4GB
      const cores = context.cpuCores || 4; // 默认4核
      
      // 基础并发数计算公式
      return Math.max(2, Math.min(16, Math.floor(memory * 1.5 + cores * 0.5)));
    }
  }),
  
  /**
   * 网络感知策略
   * @returns {Object} 策略配置
   */
  networkAwareConcurrency: () => ({
    id: 'network-aware',
    name: '网络感知并发',
    description: '根据网络状况调整并发数',
    concurrencyProvider: (context) => {
      // 网络类型和有效类型
      const networkType = context.networkType || 'unknown';
      const effectiveType = context.effectiveType || '3g';
      
      // 根据网络类型确定基础并发数
      let baseConcurrency = 6;
      
      if (networkType === 'wifi' || networkType === 'ethernet') {
        baseConcurrency = 12;
      } else if (networkType === 'cellular') {
        if (effectiveType === '4g') {
          baseConcurrency = 8;
        } else if (effectiveType === '3g') {
          baseConcurrency = 4;
        } else {
          baseConcurrency = 2;
        }
      }
      
      return baseConcurrency;
    }
  }),
  
  /**
   * 自适应策略
   * @returns {Object} 策略配置
   */
  adaptiveConcurrency: () => ({
    id: 'adaptive',
    name: '自适应并发',
    description: '根据历史性能指标动态调整并发数',
    concurrencyProvider: (context) => {
      const lastSuccessRate = context.lastSuccessRate || 1.0;
      const lastConcurrency = context.lastConcurrency || 6;
      
      // 如果成功率低于阈值，降低并发数；如果成功率高，尝试提高并发数
      if (lastSuccessRate < 0.8) {
        return Math.max(2, lastConcurrency - 2);
      } else if (lastSuccessRate > 0.95) {
        return Math.min(16, lastConcurrency + 1);
      }
      return lastConcurrency;
    }
  })
};

// CommonJS导出
module.exports = {
  ConcurrencyABTest,
  PredefinedStrategies
};
