/**
 * @file 并发控制优化器
 * @description 提供资源加载并发控制的优化功能，包括设备性能检测、网络带宽分析和动态调整
 * @version 1.0.0
 */

/**
 * 设备性能检测模块
 * 分析设备硬件性能并提供性能评级
 */
class DevicePerformanceDetector {
  constructor() {
    this.metrics = {
      cpuScore: 0,
      memoryScore: 0,
      hardwareScore: 0,
      batteryStatus: null,
      deviceType: this._detectDeviceType(),
      cpuCores: navigator.hardwareConcurrency || 4
    };
    
    // 初始化性能分析
    this._analyzeDevicePerformance();
    
    // 监控电池状态
    this._initBatteryMonitoring();
  }

  /**
   * 获取设备性能评分
   * @returns {Object} 性能评分数据
   */
  getPerformanceScore() {
    return { ...this.metrics };
  }

  /**
   * 获取建议的并发连接数
   * @returns {number} 建议的并发连接数
   */
  getRecommendedConcurrency() {
    // 基于设备性能和类型计算建议的并发连接数
    const baseValue = this.metrics.deviceType === 'mobile' ? 4 : 10;
    
    // 根据CPU核心数和性能评分调整
    let concurrency = Math.min(this.metrics.cpuCores, 
                               Math.ceil(baseValue * (this.metrics.hardwareScore / 100)));
    
    // 电池电量低时减少并发数
    if (this.metrics.batteryStatus && 
        this.metrics.batteryStatus.level < 0.2 && 
        !this.metrics.batteryStatus.charging) {
      concurrency = Math.max(2, Math.floor(concurrency * 0.6));
    }
    
    return Math.max(2, Math.min(concurrency, 16)); // 最小2，最大16
  }

  /**
   * 检测设备类型
   * @private
   * @returns {string} 设备类型
   */
  _detectDeviceType() {
    const userAgent = navigator.userAgent;
    const isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(userAgent);
    const isTablet = /iPad|Tablet/i.test(userAgent) || 
                     (isMobile && Math.min(window.screen.width, window.screen.height) > 768);
    
    return isTablet ? 'tablet' : (isMobile ? 'mobile' : 'desktop');
  }

  /**
   * 分析设备性能
   * @private
   */
  _analyzeDevicePerformance() {
    // CPU性能评分
    const cpuCores = navigator.hardwareConcurrency || 4;
    this.metrics.cpuScore = this._normalizeCpuScore(cpuCores);
    
    // 内存性能评分
    if (navigator.deviceMemory) {
      this.metrics.memoryScore = this._normalizeMemoryScore(navigator.deviceMemory);
    } else {
      this.metrics.memoryScore = 70; // 默认值
    }
    
    // 尝试使用更高级的性能评估方法
    this._runPerformanceTest().then(score => {
      this.metrics.hardwareScore = score;
    });
  }

  /**
   * 规范化CPU评分
   * @private
   * @param {number} cores CPU核心数
   * @returns {number} 规范化的分数
   */
  _normalizeCpuScore(cores) {
    // 基于核心数的简单评分，最多8核为100分
    return Math.min(100, (cores / 8) * 100);
  }

  /**
   * 规范化内存评分
   * @private
   * @param {number} memory 设备内存（GB）
   * @returns {number} 规范化的分数
   */
  _normalizeMemoryScore(memory) {
    // 基于内存大小的简单评分，8GB为100分
    return Math.min(100, (memory / 8) * 100);
  }

  /**
   * 运行性能测试
   * @private
   * @returns {Promise<number>} 性能测试得分
   */
  async _runPerformanceTest() {
    try {
      // 基本计算性能测试
      const startTime = performance.now();
      let result = 0;
      
      // 执行一些基准计算操作
      for (let i = 0; i < 1000000; i++) {
        result += Math.sqrt(i * Math.sin(i));
      }
      
      const endTime = performance.now();
      const timeTaken = endTime - startTime;
      
      // 缩放和规范化性能评分
      // 500ms以下为100分，2000ms以上为20分
      const perfScore = Math.max(20, Math.min(100, 100 - (timeTaken - 500) / 15));
      
      // 综合CPU和内存评分
      return (perfScore * 0.7) + (this.metrics.cpuScore * 0.15) + (this.metrics.memoryScore * 0.15);
    } catch (e) {
      // 性能测试失败时返回基础评分
      return (this.metrics.cpuScore * 0.5) + (this.metrics.memoryScore * 0.5);
    }
  }

  /**
   * 初始化电池监控
   * @private
   */
  _initBatteryMonitoring() {
    if (navigator.getBattery) {
      navigator.getBattery().then(battery => {
        this.metrics.batteryStatus = {
          level: battery.level,
          charging: battery.charging
        };
        
        // 监听电池状态变化
        battery.addEventListener('levelchange', () => {
          this.metrics.batteryStatus.level = battery.level;
        });
        
        battery.addEventListener('chargingchange', () => {
          this.metrics.batteryStatus.charging = battery.charging;
        });
      });
    }
  }
}

/**
 * 网络带宽检测工具
 * 动态测量当前网络带宽和响应时间
 */
class NetworkBandwidthDetector {
  constructor(options = {}) {
    this.config = {
      probeURL: options.probeURL || '/pixel.gif',
      probeSizes: options.probeSizes || [1, 10, 50, 100], // KB
      probeTimeout: options.probeTimeout || 10000,
      autoDetectInterval: options.autoDetectInterval || 30000,
      enableAutoDetect: options.enableAutoDetect || false,
      ...options
    };
    
    this.metrics = {
      connectionType: 'unknown',
      downlink: 0,       // Mbps
      rtt: 0,            // ms
      effectiveType: 'unknown',
      lastMeasured: 0
    };
    
    this._updateConnectionInfo();
    
    // 自动定期检测网络带宽
    if (this.config.enableAutoDetect) {
      this._autoDetectionTimer = setInterval(() => {
        this.measureBandwidth();
      }, this.config.autoDetectInterval);
    }
  }
  
  /**
   * 获取网络指标
   * @returns {Object} 网络带宽和延迟指标
   */
  getNetworkMetrics() {
    this._updateConnectionInfo();
    return { ...this.metrics };
  }
  
  /**
   * 获取建议的并发请求数
   * @returns {number} 建议的并发请求数
   */
  getRecommendedConcurrency() {
    const { effectiveType, downlink } = this.metrics;
    
    // 基于网络类型的基础值
    let baseConcurrency;
    switch (effectiveType) {
      case '4g':
        baseConcurrency = 8;
        break;
      case '3g':
        baseConcurrency = 6;
        break;
      case '2g':
        baseConcurrency = 3;
        break;
      case 'slow-2g':
        baseConcurrency = 2;
        break;
      default:
        baseConcurrency = 6;
    }
    
    // 根据下行速度微调
    if (downlink > 0) {
      // 对下行速度进行加权调整
      const speedFactor = Math.min(2, Math.max(0.5, downlink / 2));
      return Math.floor(baseConcurrency * speedFactor);
    }
    
    return baseConcurrency;
  }
  
  /**
   * 更新连接信息
   * @private
   */
  _updateConnectionInfo() {
    if (navigator.connection) {
      const conn = navigator.connection;
      
      this.metrics.connectionType = conn.type || 'unknown';
      this.metrics.downlink = conn.downlink || 0;
      this.metrics.rtt = conn.rtt || 0;
      this.metrics.effectiveType = conn.effectiveType || 'unknown';
      
      // 添加监听器以捕获网络变化
      if (!this._hasAddedListeners) {
        conn.addEventListener('change', () => {
          this._updateConnectionInfo();
        });
        this._hasAddedListeners = true;
      }
    }
  }
  
  /**
   * 测量当前网络带宽
   * @returns {Promise<Object>} 带宽测量结果
   */
  async measureBandwidth() {
    try {
      const results = [];
      
      // 使用不同大小的探针测量下载速度
      for (const sizeKB of this.config.probeSizes) {
        const url = `${this.config.probeURL}?size=${sizeKB}&t=${Date.now()}`;
        
        const startTime = performance.now();
        const response = await fetch(url, { 
          method: 'GET',
          cache: 'no-store',
          signal: AbortSignal.timeout(this.config.probeTimeout)
        });
        
        if (response.ok) {
          const buffer = await response.arrayBuffer();
          const endTime = performance.now();
          
          const size = buffer.byteLength;
          const timeMs = endTime - startTime;
          
          // 计算带宽 (Mbps)
          const bandwidth = (size * 8) / (timeMs / 1000) / 1000000;
          
          results.push({
            sizeKB,
            timeMs,
            bandwidth
          });
        }
      }
      
      if (results.length > 0) {
        // 计算平均带宽，移除异常值
        results.sort((a, b) => a.bandwidth - b.bandwidth);
        const validResults = results.slice(Math.floor(results.length * 0.2), 
                                          Math.floor(results.length * 0.8));
        
        const avgBandwidth = validResults.reduce((sum, r) => sum + r.bandwidth, 0) / 
                             validResults.length;
        
        // 更新指标
        this.metrics.downlink = avgBandwidth;
        this.metrics.lastMeasured = Date.now();
        
        // 根据带宽推断有效连接类型
        if (avgBandwidth > 5) {
          this.metrics.effectiveType = '4g';
        } else if (avgBandwidth > 1) {
          this.metrics.effectiveType = '3g';
        } else if (avgBandwidth > 0.3) {
          this.metrics.effectiveType = '2g';
        } else {
          this.metrics.effectiveType = 'slow-2g';
        }
        
        return { 
          bandwidthMbps: avgBandwidth,
          measurements: results 
        };
      }
      
      return null;
    } catch (error) {
      console.error('测量带宽时出错:', error);
      return null;
    }
  }
  
  /**
   * 清理并停止自动检测
   */
  cleanup() {
    if (this._autoDetectionTimer) {
      clearInterval(this._autoDetectionTimer);
      this._autoDetectionTimer = null;
    }
  }
}

/**
 * 动态并发控制器
 * 综合设备性能和网络状况动态调整最佳并发请求数
 */
class ConcurrencyController {
  constructor(options = {}) {
    this.config = {
      defaultConcurrency: 8,
      minConcurrency: 2,
      maxConcurrency: 16,
      updateInterval: 10000,
      networkWeight: 0.6,    // 网络因素权重
      deviceWeight: 0.3,     // 设备因素权重
      batteryWeight: 0.1,    // 电池因素权重
      performanceHistory: 5, // 保存的历史性能记录数量
      ...options
    };
    
    this.metrics = {
      currentConcurrency: this.config.defaultConcurrency,
      networkConcurrency: this.config.defaultConcurrency,
      deviceConcurrency: this.config.defaultConcurrency,
      adjustmentHistory: [],
      performanceHistory: []
    };
    
    // 初始化检测器
    this.deviceDetector = new DevicePerformanceDetector();
    this.networkDetector = new NetworkBandwidthDetector({
      enableAutoDetect: true,
      autoDetectInterval: this.config.updateInterval * 2
    });
    
    // 定期更新并发设置
    this._updateTimer = setInterval(() => {
      this.updateConcurrencySettings();
    }, this.config.updateInterval);
    
    // 立即执行一次更新
    this.updateConcurrencySettings();
  }
  
  /**
   * 更新并发设置
   * @returns {Object} 更新后的并发设置
   */
  updateConcurrencySettings() {
    // 获取设备和网络建议
    const deviceConcurrency = this.deviceDetector.getRecommendedConcurrency();
    const networkConcurrency = this.networkDetector.getRecommendedConcurrency();
    
    // 更新指标
    this.metrics.deviceConcurrency = deviceConcurrency;
    this.metrics.networkConcurrency = networkConcurrency;
    
    // 计算加权平均值
    let concurrency = (deviceConcurrency * this.config.deviceWeight) + 
                      (networkConcurrency * this.config.networkWeight);
    
    // 电池因素
    const batteryStatus = this.deviceDetector.metrics.batteryStatus;
    if (batteryStatus && batteryStatus.level < 0.2 && !batteryStatus.charging) {
      concurrency *= (0.9 - (0.2 - batteryStatus.level));
    }
    
    // 应用历史性能调整
    concurrency = this._applyPerformanceHistory(concurrency);
    
    // 确保在范围内
    concurrency = Math.max(this.config.minConcurrency, 
                          Math.min(Math.round(concurrency), this.config.maxConcurrency));
    
    // 记录调整历史
    this.metrics.adjustmentHistory.push({
      timestamp: Date.now(),
      oldValue: this.metrics.currentConcurrency,
      newValue: concurrency,
      deviceConcurrency,
      networkConcurrency,
      batteryLevel: batteryStatus ? batteryStatus.level : null
    });
    
    // 限制历史记录长度
    if (this.metrics.adjustmentHistory.length > 20) {
      this.metrics.adjustmentHistory.shift();
    }
    
    // 更新当前值
    this.metrics.currentConcurrency = concurrency;
    
    return {
      concurrency,
      metrics: { ...this.metrics }
    };
  }
  
  /**
   * 记录性能结果
   * @param {Object} data 性能数据
   */
  recordPerformanceResult(data) {
    // 记录资源加载性能结果
    this.metrics.performanceHistory.push({
      timestamp: Date.now(),
      concurrency: this.metrics.currentConcurrency,
      loadTime: data.loadTime,
      successRate: data.successRate,
      resourceCount: data.resourceCount
    });
    
    // 限制历史记录长度
    if (this.metrics.performanceHistory.length > this.config.performanceHistory) {
      this.metrics.performanceHistory.shift();
    }
  }
  
  /**
   * 获取当前推荐的并发数
   * @returns {number} 推荐的并发请求数
   */
  getRecommendedConcurrency() {
    return this.metrics.currentConcurrency;
  }
  
  /**
   * 获取所有指标
   * @returns {Object} 所有指标数据
   */
  getAllMetrics() {
    return {
      concurrency: this.metrics,
      device: this.deviceDetector.getPerformanceScore(),
      network: this.networkDetector.getNetworkMetrics()
    };
  }
  
  /**
   * 基于历史性能应用调整
   * @private
   * @param {number} concurrency 初始并发数
   * @returns {number} 调整后的并发数
   */
  _applyPerformanceHistory(concurrency) {
    if (this.metrics.performanceHistory.length < 2) {
      return concurrency;
    }
    
    // 分析最近的性能历史来确定趋势
    const history = [...this.metrics.performanceHistory].sort((a, b) => b.timestamp - a.timestamp);
    
    // 计算成功率和加载时间的平均值
    const avgSuccessRate = history.reduce((sum, h) => sum + h.successRate, 0) / history.length;
    const avgLoadTime = history.reduce((sum, h) => sum + h.loadTime, 0) / history.length;
    
    // 根据性能指标调整并发数
    if (avgSuccessRate < 0.85) {
      // 成功率低，减少并发
      concurrency *= 0.9;
    } else if (avgSuccessRate > 0.98 && avgLoadTime < 1000) {
      // 性能良好，可以尝试增加并发
      concurrency *= 1.1;
    }
    
    return concurrency;
  }
  
  /**
   * 清理并释放资源
   */
  cleanup() {
    if (this._updateTimer) {
      clearInterval(this._updateTimer);
      this._updateTimer = null;
    }
    
    if (this.networkDetector) {
      this.networkDetector.cleanup();
    }
  }
}

/**
 * 资源优先级影响因子
 * 根据上下文和历史数据动态调整资源的优先级
 */
class PriorityFactorCalculator {
  constructor() {
    this.resourceStats = new Map();
    this.pageResourceStats = new Map();
    this.navigationPatterns = new Map();
    
    // 权重配置
    this.weights = {
      resourceType: {
        script: 0.8,
        style: 0.9,
        image: 0.6,
        font: 0.7,
        other: 0.5
      },
      visibleArea: 0.4,       // 可视区域因素权重
      historicalUsage: 0.3,   // 历史使用因素权重
      navigationPath: 0.2,    // 导航路径预测因素权重
      contentRelevance: 0.1   // 内容相关性因素权重
    };
  }
  
  /**
   * 计算资源优先级因子
   * @param {Object} resource 资源对象
   * @param {Object} context 上下文信息
   * @returns {number} 优先级因子(0-1)
   */
  calculatePriorityFactor(resource, context = {}) {
    const resourceType = resource.type || 'other';
    const resourceUrl = resource.url;
    const pageUrl = context.pageUrl || window.location.href;
    
    // 基础优先级（基于资源类型）
    let priorityFactor = this.weights.resourceType[resourceType] || this.weights.resourceType.other;
    
    // 考虑可视区域因素
    if (context.inViewport) {
      priorityFactor += this.weights.visibleArea;
    }
    
    // 考虑历史使用
    const resourceKey = this._getResourceKey(resourceUrl);
    if (this.resourceStats.has(resourceKey)) {
      const stats = this.resourceStats.get(resourceKey);
      const usageScore = Math.min(1, stats.usageCount / 10) * this.weights.historicalUsage;
      priorityFactor += usageScore;
    }
    
    // 考虑导航路径
    if (this.navigationPatterns.has(pageUrl)) {
      const nextPages = this.navigationPatterns.get(pageUrl);
      for (const [nextPage, probability] of nextPages) {
        if (this.pageResourceStats.has(nextPage) && 
            this.pageResourceStats.get(nextPage).includes(resourceKey)) {
          priorityFactor += probability * this.weights.navigationPath;
          break;
        }
      }
    }
    
    // 考虑内容相关性（如果提供）
    if (context.contentRelevance) {
      priorityFactor += context.contentRelevance * this.weights.contentRelevance;
    }
    
    // 归一化到0-1范围
    return Math.min(1, Math.max(0, priorityFactor));
  }
  
  /**
   * 记录资源使用
   * @param {string} url 资源URL
   * @param {string} type 资源类型
   * @param {Object} performance 性能指标
   */
  recordResourceUsage(url, type, performance = {}) {
    const resourceKey = this._getResourceKey(url);
    const pageUrl = window.location.href;
    
    // 更新资源统计
    if (!this.resourceStats.has(resourceKey)) {
      this.resourceStats.set(resourceKey, {
        url,
        type,
        usageCount: 0,
        lastUsed: Date.now(),
        avgLoadTime: 0,
        loadHistory: []
      });
    }
    
    const stats = this.resourceStats.get(resourceKey);
    stats.usageCount++;
    stats.lastUsed = Date.now();
    
    // 更新性能指标
    if (performance.loadTime) {
      stats.loadHistory.push(performance.loadTime);
      // 保持历史记录在合理范围内
      if (stats.loadHistory.length > 10) {
        stats.loadHistory.shift();
      }
      stats.avgLoadTime = stats.loadHistory.reduce((sum, time) => sum + time, 0) / 
                          stats.loadHistory.length;
    }
    
    // 更新页面资源关联
    if (!this.pageResourceStats.has(pageUrl)) {
      this.pageResourceStats.set(pageUrl, []);
    }
    
    const pageResources = this.pageResourceStats.get(pageUrl);
    if (!pageResources.includes(resourceKey)) {
      pageResources.push(resourceKey);
    }
  }
  
  /**
   * 记录页面导航
   * @param {string} fromUrl 来源页面URL
   * @param {string} toUrl 目标页面URL
   */
  recordNavigation(fromUrl, toUrl) {
    if (!this.navigationPatterns.has(fromUrl)) {
      this.navigationPatterns.set(fromUrl, new Map());
    }
    
    const nextPages = this.navigationPatterns.get(fromUrl);
    const count = nextPages.get(toUrl) || 0;
    nextPages.set(toUrl, count + 1);
    
    // 计算概率
    let total = 0;
    for (const count of nextPages.values()) {
      total += count;
    }
    
    // 更新概率
    for (const [url, count] of nextPages.entries()) {
      nextPages.set(url, count / total);
    }
  }
  
  /**
   * 获取资源的唯一键
   * @private
   * @param {string} url 资源URL
   * @returns {string} 资源键
   */
  _getResourceKey(url) {
    // 移除查询参数和哈希
    return url.split('?')[0].split('#')[0];
  }
}

// 导出所有类
module.exports = {
  DevicePerformanceDetector,
  NetworkBandwidthDetector,
  ConcurrencyController,
  PriorityFactorCalculator
}; 