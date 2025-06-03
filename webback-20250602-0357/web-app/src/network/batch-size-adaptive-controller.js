/**
 * @file 批处理大小自适应控制器
 * @description 根据设备性能、网络状况和历史性能数据自动调整资源加载的最佳批处理大小
 * @version 1.0.0
 */

const { DevicePerformanceDetector, NetworkBandwidthDetector } = require('./concurrency-optimizer');

/**
 * 批处理大小自适应控制器
 * 基于多种因素动态调整最佳批处理大小
 */
class BatchSizeAdaptiveController {
  /**
   * 创建批处理大小自适应控制器
   * @param {Object} options - 配置选项
   */
  constructor(options = {}) {
    this.config = {
      // 基础配置
      minBatchSize: options.minBatchSize || 5,
      maxBatchSize: options.maxBatchSize || 50,
      defaultBatchSize: options.defaultBatchSize || 20,
      updateInterval: options.updateInterval || 10000,      // 自动更新间隔(ms)
      
      // 调整因子权重
      deviceFactorWeight: options.deviceFactorWeight || 0.4,   // 设备性能因子权重
      networkFactorWeight: options.networkFactorWeight || 0.3, // 网络因子权重
      historyFactorWeight: options.historyFactorWeight || 0.2, // 历史性能因子权重
      memoryFactorWeight: options.memoryFactorWeight || 0.1,   // 内存压力因子权重
      
      // 设备类型默认值
      deviceTypeDefaults: options.deviceTypeDefaults || {
        'mobile': 15,
        'tablet': 20,
        'desktop': 30,
        'low-end': 10
      },
      
      // 历史性能分析
      performanceHistorySize: options.performanceHistorySize || 10,
      
      ...options
    };
    
    // 内部状态
    this.state = {
      currentBatchSize: this.config.defaultBatchSize,
      lastUpdateTime: 0,
      performanceHistory: [],
      batchSizeHistory: []
    };
    
    // 初始化子系统
    this.deviceDetector = new DevicePerformanceDetector();
    this.networkDetector = new NetworkBandwidthDetector({
      enableAutoDetect: true,
      autoDetectInterval: this.config.updateInterval * 2
    });
    
    // 初始化自动更新计时器
    if (options.enableAutoUpdate !== false) {
      this._autoUpdateTimer = setInterval(() => {
        this.updateBatchSize();
      }, this.config.updateInterval);
      
      // 初始更新
      this.updateBatchSize();
    }
  }
  
  /**
   * 获取当前推荐的批处理大小
   * @returns {number} 推荐的批处理大小
   */
  getCurrentBatchSize() {
    return this.state.currentBatchSize;
  }
  
  /**
   * 更新批处理大小设置
   * @returns {Object} 更新后的批处理大小信息
   */
  updateBatchSize() {
    // 获取基本因素
    const deviceFactor = this._calculateDeviceFactor();
    const networkFactor = this._calculateNetworkFactor();
    const historyFactor = this._calculateHistoryFactor();
    const memoryFactor = this._calculateMemoryFactor();
    
    // 计算基础批处理大小（基于设备类型）
    const deviceType = this.deviceDetector.metrics.deviceType;
    const baseBatchSize = this.config.deviceTypeDefaults[deviceType] || 
                          this.config.defaultBatchSize;
    
    // 应用所有因素的加权平均
    let adjustedBatchSize = baseBatchSize * (
      (deviceFactor * this.config.deviceFactorWeight) +
      (networkFactor * this.config.networkFactorWeight) +
      (historyFactor * this.config.historyFactorWeight) +
      (memoryFactor * this.config.memoryFactorWeight)
    );
    
    // 应用电池状态调整
    adjustedBatchSize = this._applyBatteryAdjustment(adjustedBatchSize);
    
    // 确保在配置的范围内
    const finalBatchSize = Math.max(
      this.config.minBatchSize, 
      Math.min(Math.round(adjustedBatchSize), this.config.maxBatchSize)
    );
    
    // 更新状态
    const oldBatchSize = this.state.currentBatchSize;
    this.state.currentBatchSize = finalBatchSize;
    this.state.lastUpdateTime = Date.now();
    
    // 记录批处理大小历史
    this.state.batchSizeHistory.push({
      timestamp: Date.now(),
      oldValue: oldBatchSize,
      newValue: finalBatchSize,
      deviceFactor,
      networkFactor,
      historyFactor,
      memoryFactor
    });
    
    // 保持历史记录在合理长度
    if (this.state.batchSizeHistory.length > 20) {
      this.state.batchSizeHistory.shift();
    }
    
    // 返回更新结果
    return {
      batchSize: finalBatchSize,
      factors: {
        deviceFactor,
        networkFactor,
        historyFactor,
        memoryFactor
      },
      change: finalBatchSize - oldBatchSize
    };
  }
  
  /**
   * 记录批处理加载性能结果
   * @param {Object} data - 性能数据
   * @param {number} data.batchSize - 使用的批处理大小
   * @param {number} data.loadTime - 加载时间(ms)
   * @param {number} data.successRate - 成功率(0-1)
   * @param {number} data.resourceCount - 资源数量
   * @param {Object} [data.memory] - 内存使用信息
   */
  recordPerformance(data) {
    // 添加时间戳
    const record = {
      ...data,
      timestamp: Date.now()
    };
    
    // 添加到历史记录
    this.state.performanceHistory.push(record);
    
    // 限制历史记录大小
    if (this.state.performanceHistory.length > this.config.performanceHistorySize) {
      this.state.performanceHistory.shift();
    }
  }
  
  /**
   * 计算设备因素影响
   * @private
   * @returns {number} 设备因素(0.5-1.5)
   */
  _calculateDeviceFactor() {
    const devicePerformance = this.deviceDetector.getPerformanceScore();
    
    // 基于硬件性能得分调整因子
    const hardwareFactor = Math.min(1.5, Math.max(0.7, devicePerformance.hardwareScore / 70));
    
    // 考虑CPU核心数
    const cpuCores = devicePerformance.cpuCores || 4;
    const coreFactor = Math.min(1.3, Math.max(0.8, cpuCores / 4));
    
    // 综合设备因素
    return (hardwareFactor * 0.7) + (coreFactor * 0.3);
  }
  
  /**
   * 计算网络因素影响
   * @private
   * @returns {number} 网络因素(0.5-1.5)
   */
  _calculateNetworkFactor() {
    const networkMetrics = this.networkDetector.getNetworkMetrics();
    
    // 基于网络类型的基础因子
    let networkFactor;
    switch (networkMetrics.effectiveType) {
      case '4g':
        networkFactor = 1.2;
        break;
      case '3g':
        networkFactor = 1.0;
        break;
      case '2g':
        networkFactor = 0.7;
        break;
      case 'slow-2g':
        networkFactor = 0.5;
        break;
      default:
        networkFactor = 1.0;
    }
    
    // 根据下行速度微调
    if (networkMetrics.downlink > 0) {
      // 将下行速度考虑在内，但保持在合理范围内
      const speedAdjustment = Math.min(1.3, Math.max(0.7, networkMetrics.downlink / 2));
      networkFactor *= speedAdjustment;
    }
    
    return Math.min(1.5, Math.max(0.5, networkFactor));
  }
  
  /**
   * 计算历史性能因素影响
   * @private
   * @returns {number} 历史性能因素(0.7-1.3)
   */
  _calculateHistoryFactor() {
    if (this.state.performanceHistory.length < 2) {
      return 1.0; // 没有足够的历史数据，使用默认值
    }
    
    // 按批处理大小分组，找出性能最好的批处理大小范围
    const batchSizeGroups = {};
    
    this.state.performanceHistory.forEach(record => {
      // 将批处理大小分组
      const batchSizeGroup = Math.floor(record.batchSize / 5) * 5;
      if (!batchSizeGroups[batchSizeGroup]) {
        batchSizeGroups[batchSizeGroup] = [];
      }
      batchSizeGroups[batchSizeGroup].push(record);
    });
    
    // 计算每个批处理大小组的平均性能
    const groupPerformance = {};
    Object.entries(batchSizeGroups).forEach(([batchSize, records]) => {
      if (records.length > 0) {
        // 计算平均加载时间和成功率
        const avgLoadTime = records.reduce((sum, r) => sum + r.loadTime, 0) / records.length;
        const avgSuccessRate = records.reduce((sum, r) => sum + r.successRate, 0) / records.length;
        
        // 综合性能分数 (成功率越高越好，加载时间越短越好)
        groupPerformance[batchSize] = (avgSuccessRate * 10000) / avgLoadTime;
      }
    });
    
    // 查找性能最好的批处理大小组
    let bestBatchSizeGroup = this.state.currentBatchSize;
    let bestPerformance = 0;
    
    Object.entries(groupPerformance).forEach(([batchSize, performance]) => {
      if (performance > bestPerformance) {
        bestPerformance = performance;
        bestBatchSizeGroup = parseInt(batchSize);
      }
    });
    
    // 计算历史因子，向最佳批处理大小靠拢
    const currentGroup = Math.floor(this.state.currentBatchSize / 5) * 5;
    
    if (bestBatchSizeGroup > currentGroup) {
      // 当前批处理大小小于最佳值，应该增加
      return Math.min(1.3, 1 + ((bestBatchSizeGroup - currentGroup) / 100));
    } else if (bestBatchSizeGroup < currentGroup) {
      // 当前批处理大小大于最佳值，应该减少
      return Math.max(0.7, 1 - ((currentGroup - bestBatchSizeGroup) / 100));
    }
    
    return 1.0; // 当前批处理大小已经在最佳范围内
  }
  
  /**
   * 计算内存压力因素影响
   * @private
   * @returns {number} 内存压力因素(0.6-1.0)
   */
  _calculateMemoryFactor() {
    let memoryPressure = 0.5; // 默认中等内存压力
    
    // 如果有内存数据，计算内存压力
    if (typeof performance !== 'undefined' && performance.memory) {
      memoryPressure = performance.memory.usedJSHeapSize / performance.memory.totalJSHeapSize;
    }
    
    // 内存压力低时不调整
    if (memoryPressure < 0.6) {
      return 1.0;
    }
    
    // 内存压力高时减少批处理大小
    if (memoryPressure > 0.8) {
      return 0.6; // 高内存压力，大幅减少批处理大小
    } else if (memoryPressure > 0.7) {
      return 0.8; // 中高内存压力，中度减少批处理大小
    }
    
    return 0.9; // 轻度内存压力，轻微减少批处理大小
  }
  
  /**
   * 应用电池状态调整
   * @private
   * @param {number} batchSize - 初始批处理大小
   * @returns {number} 调整后的批处理大小
   */
  _applyBatteryAdjustment(batchSize) {
    const batteryStatus = this.deviceDetector.metrics.batteryStatus;
    
    // 如果没有电池信息或正在充电，不做调整
    if (!batteryStatus || batteryStatus.charging) {
      return batchSize;
    }
    
    // 基于电池电量进行调整
    if (batteryStatus.level < 0.1) {
      // 极低电量 (< 10%)
      return batchSize * 0.6;
    } else if (batteryStatus.level < 0.2) {
      // 低电量 (< 20%)
      return batchSize * 0.8;
    }
    
    return batchSize;
  }
  
  /**
   * 清理并释放资源
   */
  cleanup() {
    if (this._autoUpdateTimer) {
      clearInterval(this._autoUpdateTimer);
      this._autoUpdateTimer = null;
    }
    
    if (this.networkDetector) {
      this.networkDetector.cleanup();
    }
  }
}

module.exports = BatchSizeAdaptiveController; 