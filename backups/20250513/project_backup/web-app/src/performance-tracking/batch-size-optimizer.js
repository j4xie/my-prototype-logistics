/**
 * 批量大小优化器
 * 基于设备性能和网络状态自动调整资源加载批量大小
 */

const PerformanceMetricsCollector = require('./performance-metrics-collector');
const { EventEmitter } = require('events');

class BatchSizeOptimizer extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.options = {
      // 默认值
      initialBatchSize: 20,           // 初始批量大小
      minBatchSize: 5,                // 最小批量大小
      maxBatchSize: 100,              // 最大批量大小
      adaptationThreshold: 0.3,       // 触发批量大小调整的阈值差异
      samplingPeriod: 60000,          // 性能采样周期（毫秒）
      batchSizeHistory: 5,            // 保留的批量大小历史记录数
      enableDeviceBasedOptimization: true, // 启用基于设备的优化
      enableNetworkBasedOptimization: true, // 启用基于网络的优化
      enableMemoryBasedOptimization: true,  // 启用基于内存的优化
      aggressiveness: 'moderate',     // 调整激进程度: 'conservative', 'moderate', 'aggressive'
      ...options
    };
    
    // 初始化批量大小
    this.currentBatchSize = this.options.initialBatchSize;
    
    // 批量大小历史
    this.batchSizeHistory = [this.currentBatchSize];
    
    // 性能指标收集器
    this.metricsCollector = new PerformanceMetricsCollector({
      collectionInterval: Math.min(30000, this.options.samplingPeriod / 2),
      historySize: 10
    });
    
    // 批量大小调整计时器
    this.optimizationTimer = null;
    
    // 调整因素权重
    this.weights = this._getWeightsByAggressiveness(this.options.aggressiveness);
    
    // 批量大小调整锁定，防止过于频繁的调整
    this.adjustmentLock = false;
    this.lockTimeout = null;
  }

  /**
   * 启动批量大小优化
   * @returns {Promise<boolean>} 是否成功启动
   */
  async start() {
    try {
      // 启动性能指标收集
      const result = await this.metricsCollector.start();
      
      if (!result) {
        console.error('无法启动批量大小优化：性能指标收集器启动失败');
        return false;
      }
      
      // 初始批量大小调整
      await this._initialBatchSizeAdjustment();
      
      // 设置定期优化计时器
      this._setupOptimizationTimer();
      
      // 添加网络变化监听器
      this.metricsCollector.addListener(this._onMetricsUpdate.bind(this));
      
      console.log(`批量大小优化器已启动，初始批量大小: ${this.currentBatchSize}`);
      return true;
    } catch (error) {
      console.error('启动批量大小优化器失败:', error);
      return false;
    }
  }

  /**
   * 停止批量大小优化
   */
  stop() {
    // 停止性能指标收集
    this.metricsCollector.stop();
    
    // 清除优化计时器
    if (this.optimizationTimer) {
      clearInterval(this.optimizationTimer);
      this.optimizationTimer = null;
    }
    
    // 清除锁定计时器
    if (this.lockTimeout) {
      clearTimeout(this.lockTimeout);
      this.lockTimeout = null;
    }
    
    console.log('批量大小优化器已停止');
  }

  /**
   * 获取当前推荐的批量大小
   * @returns {number} 当前优化的批量大小
   */
  getCurrentBatchSize() {
    return this.currentBatchSize;
  }

  /**
   * 获取批量大小历史记录
   * @returns {Array<number>} 批量大小历史记录
   */
  getBatchSizeHistory() {
    return [...this.batchSizeHistory];
  }

  /**
   * 获取批量大小优化统计信息
   * @returns {Object} 优化统计信息
   */
  getOptimizationStats() {
    const lastDeviceStats = this.metricsCollector.getDeviceStats();
    const lastNetworkStats = this.metricsCollector.getNetworkStats();
    
    return {
      currentBatchSize: this.currentBatchSize,
      batchSizeHistory: this.getBatchSizeHistory(),
      deviceFactors: lastDeviceStats ? this._calculateDeviceFactors(lastDeviceStats) : null,
      networkFactors: lastNetworkStats ? this._calculateNetworkFactors(lastNetworkStats) : null,
      lastOptimizationTime: this.lastOptimizationTime || null,
      isLocked: this.adjustmentLock
    };
  }

  /**
   * 手动触发批量大小优化
   * @returns {Promise<number>} 调整后的批量大小
   */
  async forceOptimize() {
    // 即使锁定也强制执行优化
    const previousLockState = this.adjustmentLock;
    this.adjustmentLock = false;
    
    // 执行优化
    const result = await this._optimizeBatchSize();
    
    // 恢复之前的锁定状态
    this.adjustmentLock = previousLockState;
    
    return result;
  }

  /**
   * 重置批量大小为初始值
   */
  reset() {
    this.currentBatchSize = this.options.initialBatchSize;
    this.batchSizeHistory = [this.currentBatchSize];
    this._emitChange();
    console.log(`批量大小已重置为初始值: ${this.currentBatchSize}`);
  }

  /**
   * 设置批量大小调整的激进程度
   * @param {string} aggressiveness 激进程度: 'conservative', 'moderate', 'aggressive'
   */
  setAggressiveness(aggressiveness) {
    if (['conservative', 'moderate', 'aggressive'].includes(aggressiveness)) {
      this.options.aggressiveness = aggressiveness;
      this.weights = this._getWeightsByAggressiveness(aggressiveness);
      console.log(`批量大小调整激进程度已设置为: ${aggressiveness}`);
    } else {
      console.error(`无效的激进程度值: ${aggressiveness}`);
    }
  }

  /**
   * 基于指标更新回调
   * @private
   * @param {Object} deviceStats 设备统计信息
   * @param {Object} networkStats 网络统计信息
   */
  _onMetricsUpdate(deviceStats, networkStats) {
    // 如果网络状态变化显著，立即触发优化
    if (networkStats && this._hasSignificantNetworkChange(networkStats)) {
      this._optimizeBatchSize();
    }
    
    // 如果设备性能变化显著（如低内存或CPU使用率高），立即触发优化
    if (deviceStats && this._hasSignificantDeviceChange(deviceStats)) {
      this._optimizeBatchSize();
    }
  }

  /**
   * 设置优化计时器
   * @private
   */
  _setupOptimizationTimer() {
    if (this.optimizationTimer) {
      clearInterval(this.optimizationTimer);
    }
    
    this.optimizationTimer = setInterval(() => {
      this._optimizeBatchSize();
    }, this.options.samplingPeriod);
  }

  /**
   * 初始批量大小调整
   * @private
   * @returns {Promise<number>} 调整后的批量大小
   */
  async _initialBatchSizeAdjustment() {
    // 等待足够的指标收集
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const deviceStats = this.metricsCollector.getDeviceStats();
    const networkStats = this.metricsCollector.getNetworkStats();
    
    if (!deviceStats || !networkStats) {
      console.log('没有足够的指标用于初始批量大小调整，使用默认值');
      return this.currentBatchSize;
    }
    
    // 根据设备类型进行初始调整
    if (deviceStats.deviceTier === 'highEnd') {
      this.currentBatchSize = Math.min(this.options.maxBatchSize, this.options.initialBatchSize * 1.5);
    } else if (deviceStats.deviceTier === 'lowEnd' || deviceStats.deviceTier === 'ultraLowEnd') {
      this.currentBatchSize = Math.max(this.options.minBatchSize, this.options.initialBatchSize * 0.5);
    }
    
    // 根据网络类型进一步调整
    if (networkStats.effectiveType === '4g' || networkStats.effectiveType === 'wifi') {
      this.currentBatchSize = Math.min(this.options.maxBatchSize, this.currentBatchSize * 1.2);
    } else if (networkStats.effectiveType === '2g' || networkStats.effectiveType === 'slow-2g') {
      this.currentBatchSize = Math.max(this.options.minBatchSize, this.currentBatchSize * 0.6);
    }
    
    // 取整
    this.currentBatchSize = Math.round(this.currentBatchSize);
    
    // 更新历史记录
    this.batchSizeHistory = [this.currentBatchSize];
    
    // 触发变更事件
    this._emitChange();
    
    console.log(`初始批量大小已根据设备和网络调整为: ${this.currentBatchSize}`);
    return this.currentBatchSize;
  }

  /**
   * 优化批量大小
   * @private
   * @returns {Promise<number>} 优化后的批量大小
   */
  async _optimizeBatchSize() {
    if (this.adjustmentLock) {
      return this.currentBatchSize;
    }
    
    try {
      // 锁定调整，防止频繁更改
      this._lockAdjustment();
      
      const deviceStats = this.metricsCollector.getDeviceStats();
      const networkStats = this.metricsCollector.getNetworkStats();
      
      if (!deviceStats || !networkStats) {
        console.log('没有足够的指标用于批量大小优化');
        return this.currentBatchSize;
      }
      
      let adjustmentFactors = {};
      let weightSum = 0;
      
      // 计算设备因素影响
      if (this.options.enableDeviceBasedOptimization) {
        const deviceFactors = this._calculateDeviceFactors(deviceStats);
        Object.keys(deviceFactors).forEach(factor => {
          const weight = this.weights.device[factor] || 0;
          adjustmentFactors[factor] = deviceFactors[factor] * weight;
          weightSum += weight;
        });
      }
      
      // 计算网络因素影响
      if (this.options.enableNetworkBasedOptimization) {
        const networkFactors = this._calculateNetworkFactors(networkStats);
        Object.keys(networkFactors).forEach(factor => {
          const weight = this.weights.network[factor] || 0;
          adjustmentFactors[factor] = networkFactors[factor] * weight;
          weightSum += weight;
        });
      }
      
      // 确保有权重添加
      if (weightSum === 0) {
        return this.currentBatchSize;
      }
      
      // 计算总调整因子
      let totalAdjustmentFactor = 0;
      Object.values(adjustmentFactors).forEach(value => {
        totalAdjustmentFactor += value;
      });
      
      // 归一化调整因子
      totalAdjustmentFactor /= weightSum;
      
      // 仅当调整因子超过阈值时应用调整
      if (Math.abs(totalAdjustmentFactor) < this.options.adaptationThreshold) {
        return this.currentBatchSize;
      }
      
      // 计算新批量大小
      let newBatchSize = this.currentBatchSize;
      
      // 根据调整因子正负值增减批量大小
      if (totalAdjustmentFactor > 0) {
        // 增加批量大小
        const increase = Math.max(1, Math.round(this.currentBatchSize * totalAdjustmentFactor));
        newBatchSize = Math.min(this.options.maxBatchSize, this.currentBatchSize + increase);
      } else {
        // 减少批量大小
        const decrease = Math.max(1, Math.round(this.currentBatchSize * Math.abs(totalAdjustmentFactor)));
        newBatchSize = Math.max(this.options.minBatchSize, this.currentBatchSize - decrease);
      }
      
      // 记录调整
      if (newBatchSize !== this.currentBatchSize) {
        console.log(`批量大小从 ${this.currentBatchSize} 调整为 ${newBatchSize}（调整因子: ${totalAdjustmentFactor.toFixed(2)}）`);
        
        // 更新当前批量大小
        this.currentBatchSize = newBatchSize;
        
        // 更新历史记录
        this.batchSizeHistory.push(newBatchSize);
        if (this.batchSizeHistory.length > this.options.batchSizeHistory) {
          this.batchSizeHistory.shift();
        }
        
        // 记录最后优化时间
        this.lastOptimizationTime = Date.now();
        
        // 触发变更事件
        this._emitChange();
      }
      
      return this.currentBatchSize;
    } catch (error) {
      console.error('优化批量大小失败:', error);
      return this.currentBatchSize;
    }
  }

  /**
   * 锁定调整一段时间
   * @private
   */
  _lockAdjustment() {
    this.adjustmentLock = true;
    
    // 清除现有锁定计时器
    if (this.lockTimeout) {
      clearTimeout(this.lockTimeout);
    }
    
    // 设置新锁定，5秒后释放
    this.lockTimeout = setTimeout(() => {
      this.adjustmentLock = false;
      this.lockTimeout = null;
    }, 5000);
  }

  /**
   * 计算设备相关的调整因子
   * @private
   * @param {Object} deviceStats 设备统计信息
   * @returns {Object} 设备调整因子
   */
  _calculateDeviceFactors(deviceStats) {
    const factors = {};
    
    // CPU使用率因子（CPU使用率高推荐减小批量大小）
    factors.cpuUsage = deviceStats.cpuUsage > 0.7 ? -0.5 : 
                      deviceStats.cpuUsage > 0.5 ? -0.2 : 
                      deviceStats.cpuUsage < 0.2 ? 0.3 : 0;
    
    // 内存使用率因子（内存使用率高推荐减小批量大小）
    factors.memoryUsage = deviceStats.memoryUsage > 0.8 ? -0.7 : 
                         deviceStats.memoryUsage > 0.6 ? -0.4 : 
                         deviceStats.memoryUsage < 0.3 ? 0.2 : 0;
    
    // 设备层级因子
    factors.deviceTier = deviceStats.deviceTier === 'highEnd' ? 0.3 : 
                        deviceStats.deviceTier === 'midRange' ? 0 : 
                        deviceStats.deviceTier === 'lowEnd' ? -0.3 : -0.5;
    
    // 电池电量因子（如果可用）
    if (deviceStats.batteryLevel !== null) {
      factors.batteryLevel = deviceStats.batteryLevel < 0.2 ? -0.3 : 
                            deviceStats.batteryLevel < 0.5 ? -0.1 : 0;
    } else {
      factors.batteryLevel = 0;
    }
    
    // 帧率因子（如果可用）
    if (deviceStats.frameRate) {
      factors.frameRate = deviceStats.frameRate < 30 ? -0.4 : 
                         deviceStats.frameRate < 45 ? -0.2 : 
                         deviceStats.frameRate > 55 ? 0.2 : 0;
    } else {
      factors.frameRate = 0;
    }
    
    // 热状态因子（如果可用）
    if (deviceStats.thermalState) {
      factors.thermalState = deviceStats.thermalState === 'high' ? -0.6 : 
                            deviceStats.thermalState === 'elevated' ? -0.3 : 0;
    } else {
      factors.thermalState = 0;
    }
    
    return factors;
  }

  /**
   * 计算网络相关的调整因子
   * @private
   * @param {Object} networkStats 网络统计信息
   * @returns {Object} 网络调整因子
   */
  _calculateNetworkFactors(networkStats) {
    const factors = {};
    
    // 连接类型因子
    factors.connectionType = networkStats.effectiveType === '4g' || networkStats.effectiveType === 'wifi' ? 0.4 : 
                            networkStats.effectiveType === '3g' ? 0 : 
                            networkStats.effectiveType === '2g' ? -0.4 : 
                            networkStats.effectiveType === 'slow-2g' ? -0.8 : 0;
    
    // 带宽因子（如果可用）
    if (networkStats.bandwidthMbps) {
      factors.bandwidth = networkStats.bandwidthMbps > 10 ? 0.5 : 
                         networkStats.bandwidthMbps > 5 ? 0.3 : 
                         networkStats.bandwidthMbps > 2 ? 0 : 
                         networkStats.bandwidthMbps > 0.5 ? -0.3 : -0.6;
    } else if (networkStats.downlink) {
      // 使用navigator.connection.downlink作为后备
      factors.bandwidth = networkStats.downlink > 10 ? 0.5 : 
                         networkStats.downlink > 5 ? 0.3 : 
                         networkStats.downlink > 2 ? 0 : 
                         networkStats.downlink > 0.5 ? -0.3 : -0.6;
    } else {
      factors.bandwidth = 0;
    }
    
    // 延迟因子（如果可用）
    if (networkStats.latencyMs) {
      factors.latency = networkStats.latencyMs < 50 ? 0.4 : 
                       networkStats.latencyMs < 100 ? 0.2 : 
                       networkStats.latencyMs < 200 ? 0 : 
                       networkStats.latencyMs < 500 ? -0.3 : -0.5;
    } else if (networkStats.rtt) {
      // 使用navigator.connection.rtt作为后备
      factors.latency = networkStats.rtt < 50 ? 0.4 : 
                       networkStats.rtt < 100 ? 0.2 : 
                       networkStats.rtt < 200 ? 0 : 
                       networkStats.rtt < 500 ? -0.3 : -0.5;
    } else {
      factors.latency = 0;
    }
    
    // 可靠性因子
    factors.reliability = networkStats.reliability > 0.8 ? 0.3 : 
                         networkStats.reliability > 0.6 ? 0.1 : 
                         networkStats.reliability < 0.4 ? -0.3 : -0.1;
    
    // 计量连接因子（按流量计费的连接应该使用较小的批量大小）
    factors.isMetered = networkStats.isMetered ? -0.3 : 0;
    
    // 丢包率因子（如果可用）
    if (networkStats.packetLoss) {
      factors.packetLoss = networkStats.packetLoss > 0.05 ? -0.5 : 
                          networkStats.packetLoss > 0.02 ? -0.3 : 
                          networkStats.packetLoss > 0.01 ? -0.1 : 0;
    } else {
      factors.packetLoss = 0;
    }
    
    return factors;
  }

  /**
   * 检查是否有显著的网络变化
   * @private
   * @param {Object} networkStats 当前网络统计信息
   * @returns {boolean} 是否有显著变化
   */
  _hasSignificantNetworkChange(networkStats) {
    const history = this.metricsCollector.getNetworkStatsHistory(2);
    
    // 如果没有足够的历史数据，则无法判断变化
    if (history.length < 2) {
      return false;
    }
    
    const previous = history[history.length - 2];
    
    // 检查在线状态变化
    if (previous.online !== networkStats.online) {
      return true;
    }
    
    // 检查连接类型变化
    if (previous.effectiveType !== networkStats.effectiveType) {
      return true;
    }
    
    // 检查带宽变化（超过50%变化视为显著）
    if (previous.bandwidthMbps && networkStats.bandwidthMbps) {
      const bandwidthChange = Math.abs(previous.bandwidthMbps - networkStats.bandwidthMbps) / previous.bandwidthMbps;
      if (bandwidthChange > 0.5) {
        return true;
      }
    }
    
    // 检查延迟变化（超过100%变化视为显著）
    if (previous.latencyMs && networkStats.latencyMs) {
      const latencyChange = Math.abs(previous.latencyMs - networkStats.latencyMs) / previous.latencyMs;
      if (latencyChange > 1.0) {
        return true;
      }
    }
    
    return false;
  }

  /**
   * 检查是否有显著的设备性能变化
   * @private
   * @param {Object} deviceStats 当前设备统计信息
   * @returns {boolean} 是否有显著变化
   */
  _hasSignificantDeviceChange(deviceStats) {
    const history = this.metricsCollector.getDeviceStatsHistory(2);
    
    // 如果没有足够的历史数据，则无法判断变化
    if (history.length < 2) {
      return false;
    }
    
    const previous = history[history.length - 2];
    
    // 检查内存使用率变化（超过20%变化视为显著）
    if (Math.abs(previous.memoryUsage - deviceStats.memoryUsage) > 0.2) {
      return true;
    }
    
    // 检查CPU使用率变化（超过30%变化视为显著）
    if (Math.abs(previous.cpuUsage - deviceStats.cpuUsage) > 0.3) {
      return true;
    }
    
    // 检查热状态变化
    if (previous.thermalState && deviceStats.thermalState &&
        previous.thermalState !== deviceStats.thermalState) {
      // 如果热状态提高到"high"，视为显著变化
      if (deviceStats.thermalState === 'high') {
        return true;
      }
    }
    
    // 检查低电量模式变化
    if (previous.isLowPowerMode !== deviceStats.isLowPowerMode && deviceStats.isLowPowerMode) {
      return true;
    }
    
    return false;
  }

  /**
   * 根据激进程度获取权重配置
   * @private
   * @param {string} aggressiveness 激进程度
   * @returns {Object} 权重配置
   */
  _getWeightsByAggressiveness(aggressiveness) {
    switch (aggressiveness) {
      case 'conservative':
        return {
          device: {
            cpuUsage: 0.3,
            memoryUsage: 0.4,
            deviceTier: 0.5,
            batteryLevel: 0.1,
            frameRate: 0.1,
            thermalState: 0.2
          },
          network: {
            connectionType: 0.5,
            bandwidth: 0.4,
            latency: 0.3,
            reliability: 0.3,
            isMetered: 0.2,
            packetLoss: 0.2
          }
        };
      
      case 'aggressive':
        return {
          device: {
            cpuUsage: 0.7,
            memoryUsage: 0.8,
            deviceTier: 0.6,
            batteryLevel: 0.3,
            frameRate: 0.4,
            thermalState: 0.6
          },
          network: {
            connectionType: 0.8,
            bandwidth: 0.7,
            latency: 0.6,
            reliability: 0.5,
            isMetered: 0.4,
            packetLoss: 0.6
          }
        };
      
      case 'moderate':
      default:
        return {
          device: {
            cpuUsage: 0.5,
            memoryUsage: 0.6,
            deviceTier: 0.5,
            batteryLevel: 0.2,
            frameRate: 0.2,
            thermalState: 0.4
          },
          network: {
            connectionType: 0.6,
            bandwidth: 0.5,
            latency: 0.4,
            reliability: 0.4,
            isMetered: 0.3,
            packetLoss: 0.4
          }
        };
    }
  }

  /**
   * 触发批量大小变更事件
   * @private
   */
  _emitChange() {
    this.emit('batchSizeChange', {
      batchSize: this.currentBatchSize,
      previousSize: this.batchSizeHistory.length > 1 ? this.batchSizeHistory[this.batchSizeHistory.length - 2] : null,
      timestamp: Date.now(),
      deviceStats: this.metricsCollector.getDeviceStats(),
      networkStats: this.metricsCollector.getNetworkStats()
    });
  }
}

module.exports = BatchSizeOptimizer; 