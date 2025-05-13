/**
 * 批处理大小推荐器
 * 根据设备性能和网络状态动态推荐最佳的资源批处理大小
 */

const PerformanceMetricsCollector = require('./performance-metrics-collector');

class BatchSizeRecommender {
  constructor(options = {}) {
    this.options = {
      // 默认配置
      defaultBatchSize: 20,
      minBatchSize: 5,
      maxBatchSize: 50,
      adaptationInterval: 60000, // 批大小适应间隔（毫秒）
      performanceWeight: 0.7,    // 设备性能权重
      networkWeight: 0.3,        // 网络状态权重
      ...options
    };

    // 当前推荐的批处理大小
    this.currentRecommendedBatchSize = this.options.defaultBatchSize;
    
    // 性能历史记录
    this.performanceHistory = [];
    this.maxHistoryLength = 10;
    
    // 上次更新时间
    this.lastUpdateTime = null;
    
    // 初始化性能指标收集器（如果没有提供）
    this.metricsCollector = options.metricsCollector || 
                           new PerformanceMetricsCollector();
                           
    // 设置自动适应定时器
    this.adaptationTimer = null;
    
    // 各设备类型的基准批大小映射
    this.deviceTierBatchSizes = {
      'highEnd': 50,
      'midRange': 30,
      'lowEnd': 15,
      'ultraLowEnd': 5
    };
    
    // 网络类型的基准批大小映射
    this.networkTypeBatchSizes = {
      'slow-2g': 5,
      '2g': 10,
      '3g': 20,
      'slow-4g': 30,
      '4g': 40,
      'wifi': 50,
      'unknown': 20
    };
  }

  /**
   * 启动批大小推荐器
   * @returns {Promise<boolean>} 是否成功启动
   */
  async start() {
    try {
      // 确保性能指标收集器已启动
      if (!this.metricsCollector.isCollecting) {
        await this.metricsCollector.start();
      }
      
      // 添加性能指标更新监听器
      this.metricsCollector.addListener(this._handleMetricsUpdate.bind(this));
      
      // 设置定期适应批大小的定时器
      this._setupAdaptationTimer();
      
      // 立即进行一次初始计算
      this._updateRecommendedBatchSize();
      
      return true;
    } catch (error) {
      console.error('启动批大小推荐器失败:', error);
      return false;
    }
  }

  /**
   * 停止批大小推荐器
   */
  stop() {
    // 移除性能指标监听器
    this.metricsCollector.removeListener(this._handleMetricsUpdate.bind(this));
    
    // 清除适应定时器
    if (this.adaptationTimer) {
      clearInterval(this.adaptationTimer);
      this.adaptationTimer = null;
    }
  }

  /**
   * 获取当前推荐的批处理大小
   * @param {string} resourceType 可选的资源类型
   * @param {Object} customParams 可选的自定义参数，覆盖默认计算逻辑
   * @returns {number} 推荐的批大小
   */
  getRecommendedBatchSize(resourceType = null, customParams = null) {
    // 如果提供了自定义参数，使用它们进行特定的批大小计算
    if (customParams) {
      return this._calculateCustomBatchSize(customParams);
    }
    
    // 如果指定了资源类型，可以为不同类型的资源推荐不同的批大小
    if (resourceType) {
      return this._getResourceTypeSpecificBatchSize(resourceType);
    }
    
    // 否则返回当前通用推荐批大小
    return this.currentRecommendedBatchSize;
  }

  /**
   * 手动触发批大小更新
   * 在网络条件或设备状态显著变化时调用
   */
  updateRecommendation() {
    this._updateRecommendedBatchSize();
    this.lastUpdateTime = Date.now();
  }

  /**
   * 重置批大小推荐器到默认状态
   */
  reset() {
    this.currentRecommendedBatchSize = this.options.defaultBatchSize;
    this.performanceHistory = [];
    this.lastUpdateTime = null;
  }

  /**
   * 设置定期适应批大小的定时器
   * @private
   */
  _setupAdaptationTimer() {
    if (this.adaptationTimer) {
      clearInterval(this.adaptationTimer);
    }
    
    this.adaptationTimer = setInterval(() => {
      this._updateRecommendedBatchSize();
    }, this.options.adaptationInterval);
  }

  /**
   * 处理性能指标更新事件
   * @private
   * @param {Object} deviceStats 设备统计信息
   * @param {Object} networkStats 网络统计信息
   */
  _handleMetricsUpdate(deviceStats, networkStats) {
    // 将更新的指标添加到历史记录
    this.performanceHistory.push({
      timestamp: Date.now(),
      deviceStats: { ...deviceStats },
      networkStats: { ...networkStats }
    });
    
    // 保持历史记录在限定长度内
    if (this.performanceHistory.length > this.maxHistoryLength) {
      this.performanceHistory.shift();
    }
    
    // 检查是否需要更新批大小推荐
    const now = Date.now();
    const timeSinceLastUpdate = now - (this.lastUpdateTime || 0);
    
    // 如果自上次更新以来已经过了足够长的时间，或者是首次更新
    if (!this.lastUpdateTime || timeSinceLastUpdate >= this.options.adaptationInterval) {
      this._updateRecommendedBatchSize();
      this.lastUpdateTime = now;
    }
  }

  /**
   * 更新推荐的批处理大小
   * @private
   */
  _updateRecommendedBatchSize() {
    try {
      // 获取当前设备和网络状态
      const deviceStats = this.metricsCollector.getDeviceStats();
      const networkStats = this.metricsCollector.getNetworkStats();
      
      // 如果没有足够的数据，使用默认批大小
      if (!deviceStats || !networkStats) {
        this.currentRecommendedBatchSize = this.options.defaultBatchSize;
        return;
      }
      
      // 基于设备性能计算批大小因子
      const deviceFactor = this._calculateDevicePerformanceFactor(deviceStats);
      
      // 基于网络状态计算批大小因子
      const networkFactor = this._calculateNetworkFactor(networkStats);
      
      // 综合设备和网络因子，应用权重
      const combinedFactor = (deviceFactor * this.options.performanceWeight) + 
                            (networkFactor * this.options.networkWeight);
      
      // 应用因子计算批大小
      const range = this.options.maxBatchSize - this.options.minBatchSize;
      let newBatchSize = Math.round(this.options.minBatchSize + (range * combinedFactor));
      
      // 确保在最小和最大限制内
      newBatchSize = Math.min(this.options.maxBatchSize, 
                    Math.max(this.options.minBatchSize, newBatchSize));
      
      // 应用平滑处理，避免批大小频繁变化
      this.currentRecommendedBatchSize = Math.round(
        this.currentRecommendedBatchSize * 0.7 + newBatchSize * 0.3
      );
      
      // 记录批大小更新
      console.log(`批大小更新: ${this.currentRecommendedBatchSize} (设备因子: ${deviceFactor.toFixed(2)}, 网络因子: ${networkFactor.toFixed(2)})`);
    } catch (error) {
      console.error('更新批大小推荐失败:', error);
      // 出错时保持当前批大小不变
    }
  }

  /**
   * 计算设备性能因子 (0-1)
   * @private
   * @param {Object} deviceStats 设备统计信息
   * @returns {number} 设备性能因子
   */
  _calculateDevicePerformanceFactor(deviceStats) {
    // 如果有设备等级信息，使用预定义的映射
    if (deviceStats.deviceTier && this.deviceTierBatchSizes[deviceStats.deviceTier]) {
      const tierBatchSize = this.deviceTierBatchSizes[deviceStats.deviceTier];
      return (tierBatchSize - this.options.minBatchSize) / 
             (this.options.maxBatchSize - this.options.minBatchSize);
    }
    
    // 否则基于CPU和内存状态计算因子
    const cpuFactor = 1 - (deviceStats.cpuUsage || 0.5); // CPU使用率越低，性能越好
    const memoryFactor = 1 - (deviceStats.memoryUsage || 0.5); // 内存使用率越低，性能越好
    
    // 考虑CPU核心数的影响
    const cpuCoresFactor = Math.min(1, (deviceStats.cpuCores || 4) / 8);
    
    // 综合因子
    return (cpuFactor * 0.4) + (memoryFactor * 0.3) + (cpuCoresFactor * 0.3);
  }

  /**
   * 计算网络状态因子 (0-1)
   * @private
   * @param {Object} networkStats 网络统计信息
   * @returns {number} 网络状态因子
   */
  _calculateNetworkFactor(networkStats) {
    // 如果有连接类型信息，使用预定义的映射
    if (networkStats.connectionType && this.networkTypeBatchSizes[networkStats.connectionType]) {
      const typeBatchSize = this.networkTypeBatchSizes[networkStats.connectionType];
      return (typeBatchSize - this.options.minBatchSize) / 
             (this.options.maxBatchSize - this.options.minBatchSize);
    }
    
    // 基于带宽计算因子 (带宽越高，批大小越大)
    // 假设带宽范围从0.1Mbps到10Mbps
    const bandwidthFactor = Math.min(1, 
      (networkStats.bandwidthMbps || 1) / 10);
      
    // 基于延迟计算因子 (延迟越低，批大小越大)
    // 假设延迟范围从10ms到500ms
    const latencyFactor = 1 - Math.min(1, 
      (networkStats.latencyMs || 100) / 500);
      
    // 综合网络因子
    return (bandwidthFactor * 0.7) + (latencyFactor * 0.3);
  }

  /**
   * 为特定资源类型获取推荐批大小
   * 不同类型的资源可能有不同的最佳批大小
   * @private
   * @param {string} resourceType 资源类型
   * @returns {number} 推荐的批大小
   */
  _getResourceTypeSpecificBatchSize(resourceType) {
    // 获取通用推荐批大小作为基准
    let batchSize = this.currentRecommendedBatchSize;
    
    // 根据资源类型调整批大小
    switch (resourceType.toLowerCase()) {
      case 'image':
        // 图片资源通常应该用较小的批大小
        batchSize = Math.max(this.options.minBatchSize, 
                  Math.floor(batchSize * 0.7));
        break;
        
      case 'video':
        // 视频资源应该用更小的批大小
        batchSize = Math.max(this.options.minBatchSize, 
                  Math.floor(batchSize * 0.5));
        break;
        
      case 'font':
        // 字体资源可以使用较大的批大小
        batchSize = Math.min(this.options.maxBatchSize, 
                  Math.ceil(batchSize * 1.2));
        break;
        
      case 'script':
        // 脚本资源应该使用中等批大小
        break;
        
      case 'stylesheet':
        // 样式表可以使用较大的批大小
        batchSize = Math.min(this.options.maxBatchSize, 
                  Math.ceil(batchSize * 1.1));
        break;
        
      case 'json':
      case 'api':
        // API请求应该使用较大的批大小
        batchSize = Math.min(this.options.maxBatchSize, 
                  Math.ceil(batchSize * 1.3));
        break;
        
      default:
        // 其他资源类型使用默认批大小
        break;
    }
    
    return batchSize;
  }

  /**
   * 使用自定义参数计算批大小
   * @private
   * @param {Object} customParams 自定义参数
   * @returns {number} 推荐的批大小
   */
  _calculateCustomBatchSize(customParams) {
    const {
      memoryUsage = 0.5,
      cpuUsage = 0.5,
      bandwidthMbps = 1,
      latencyMs = 100,
      resourceType = null,
      priority = 'normal'
    } = customParams;
    
    // 创建临时设备和网络状态对象
    const deviceStats = {
      memoryUsage,
      cpuUsage,
      deviceTier: null // 强制使用详细计算
    };
    
    const networkStats = {
      bandwidthMbps,
      latencyMs,
      connectionType: null // 强制使用详细计算
    };
    
    // 计算基本批大小
    const deviceFactor = this._calculateDevicePerformanceFactor(deviceStats);
    const networkFactor = this._calculateNetworkFactor(networkStats);
    
    // 综合设备和网络因子，应用权重
    const combinedFactor = (deviceFactor * this.options.performanceWeight) + 
                          (networkFactor * this.options.networkWeight);
    
    // 应用因子计算批大小
    const range = this.options.maxBatchSize - this.options.minBatchSize;
    let batchSize = Math.round(this.options.minBatchSize + (range * combinedFactor));
    
    // 应用资源类型调整（如果指定）
    if (resourceType) {
      // 保存当前推荐批大小
      const savedBatchSize = this.currentRecommendedBatchSize;
      
      // 临时设置当前批大小为计算值
      this.currentRecommendedBatchSize = batchSize;
      
      // 应用资源类型特定调整
      batchSize = this._getResourceTypeSpecificBatchSize(resourceType);
      
      // 恢复当前推荐批大小
      this.currentRecommendedBatchSize = savedBatchSize;
    }
    
    // 应用优先级调整
    switch (priority) {
      case 'high':
        // 高优先级资源使用较小批大小，以加快首个资源加载
        batchSize = Math.max(this.options.minBatchSize, 
                  Math.floor(batchSize * 0.7));
        break;
        
      case 'low':
        // 低优先级资源使用较大批大小，可以慢一些但更有效率
        batchSize = Math.min(this.options.maxBatchSize, 
                  Math.ceil(batchSize * 1.3));
        break;
        
      case 'normal':
      default:
        // 正常优先级不调整
        break;
    }
    
    // 确保在限制范围内
    return Math.min(this.options.maxBatchSize, 
            Math.max(this.options.minBatchSize, batchSize));
  }
}

module.exports = BatchSizeRecommender; 