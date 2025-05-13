/**
 * 批处理大小推荐系统
 * 基于设备特性和网络条件提供最佳资源加载批处理大小建议
 */

class BatchSizeRecommender {
  constructor(options = {}) {
    this.options = {
      // 默认配置
      defaultBatchSize: 10,
      minBatchSize: 5,
      maxBatchSize: 50,
      memoryThreshold: 0.7, // 内存使用率阈值（70%）
      cpuThreshold: 0.8,    // CPU使用率阈值（80%）
      adaptationInterval: 30000, // 自适应间隔（毫秒）
      ...options
    };

    // 保存各种设备类型的最佳批处理大小
    this.deviceProfiles = {
      highEnd: {
        batchSize: 30,
        memoryLimit: 4096, // MB
        cpuCores: 8,
        networkTier: 'fast'
      },
      midRange: {
        batchSize: 20,
        memoryLimit: 2048, // MB
        cpuCores: 4,
        networkTier: 'medium'
      },
      lowEnd: {
        batchSize: 10,
        memoryLimit: 1024, // MB
        cpuCores: 2,
        networkTier: 'slow'
      },
      ultraLowEnd: {
        batchSize: 5,
        memoryLimit: 512, // MB
        cpuCores: 1,
        networkTier: 'slow'
      }
    };

    this.lastRecommendation = null;
    this.adaptationTimer = null;
    this.performanceHistory = [];
    this.networkConditionHistory = [];
  }

  /**
   * 基于设备特性和当前条件获取推荐的批处理大小
   * @param {Object} deviceStats 设备统计信息
   * @param {Object} networkStats 网络统计信息
   * @returns {Number} 推荐的批处理大小
   */
  getRecommendedBatchSize(deviceStats, networkStats) {
    // 确保我们有有效的设备统计信息
    if (!deviceStats || !networkStats) {
      console.warn('缺少设备或网络统计信息，使用默认批处理大小');
      return this.options.defaultBatchSize;
    }

    // 保存此次性能数据用于历史分析
    this._recordPerformanceSnapshot(deviceStats, networkStats);

    // 检测设备类型
    const deviceType = this._detectDeviceType(deviceStats);
    let baseBatchSize = this.deviceProfiles[deviceType].batchSize;

    // 应用网络条件调整
    baseBatchSize = this._adjustForNetworkConditions(baseBatchSize, networkStats);

    // 应用当前资源使用率调整
    baseBatchSize = this._adjustForResourceUsage(baseBatchSize, deviceStats);

    // 确保在配置的范围内
    baseBatchSize = Math.max(this.options.minBatchSize, 
                    Math.min(this.options.maxBatchSize, Math.floor(baseBatchSize)));

    this.lastRecommendation = {
      batchSize: baseBatchSize,
      deviceType,
      timestamp: Date.now(),
      deviceStats: { ...deviceStats },
      networkStats: { ...networkStats }
    };

    // 如果尚未启动适应定时器，则启动
    if (!this.adaptationTimer) {
      this._startAdaptationTimer();
    }

    return baseBatchSize;
  }

  /**
   * 检测设备类型
   * @param {Object} deviceStats 设备统计信息
   * @returns {String} 设备类型 ('highEnd', 'midRange', 'lowEnd', 'ultraLowEnd')
   */
  _detectDeviceType(deviceStats) {
    const { memoryMB, cpuCores, deviceTier } = deviceStats;

    // 如果已经从设备提供了设备层，则使用它
    if (deviceTier && this.deviceProfiles[deviceTier]) {
      return deviceTier;
    }

    // 基于内存和CPU确定设备类型
    if (memoryMB >= 4000 && cpuCores >= 8) {
      return 'highEnd';
    } else if (memoryMB >= 2000 && cpuCores >= 4) {
      return 'midRange';
    } else if (memoryMB >= 1000 && cpuCores >= 2) {
      return 'lowEnd';
    } else {
      return 'ultraLowEnd';
    }
  }

  /**
   * 根据网络条件调整批处理大小
   * @param {Number} baseBatchSize 基础批处理大小
   * @param {Object} networkStats 网络统计信息
   * @returns {Number} 调整后的批处理大小
   */
  _adjustForNetworkConditions(baseBatchSize, networkStats) {
    const { bandwidthMbps, latencyMs, connectionType } = networkStats;
    
    // 记录网络条件以进行历史分析
    this.networkConditionHistory.push({
      timestamp: Date.now(),
      bandwidthMbps,
      latencyMs,
      connectionType
    });

    // 保持最近100个样本
    if (this.networkConditionHistory.length > 100) {
      this.networkConditionHistory.shift();
    }

    // 在不稳定的网络条件下减小批处理大小
    if (latencyMs > 200) {
      return baseBatchSize * 0.7; // 高延迟减少30%
    }

    // 在超快的网络上增加批处理大小
    if (bandwidthMbps > 50 && latencyMs < 50) {
      return baseBatchSize * 1.2; // 增加20%
    }

    // 针对不同的连接类型进行调整
    if (connectionType === '2g') {
      return Math.min(5, baseBatchSize); // 2G网络最多5个
    } else if (connectionType === '3g') {
      return Math.min(10, baseBatchSize); // 3G网络最多10个
    } else if (connectionType === 'slow-4g') {
      return Math.min(15, baseBatchSize); // 慢4G网络最多15个
    }

    return baseBatchSize;
  }

  /**
   * 根据资源使用情况调整批处理大小
   * @param {Number} baseBatchSize 基础批处理大小
   * @param {Object} deviceStats 设备统计信息
   * @returns {Number} 调整后的批处理大小
   */
  _adjustForResourceUsage(baseBatchSize, deviceStats) {
    const { memoryUsage, cpuUsage } = deviceStats;
    
    // 如果内存使用率接近阈值，减小批处理大小
    if (memoryUsage > this.options.memoryThreshold) {
      const reductionFactor = 1 - ((memoryUsage - this.options.memoryThreshold) / 
                               (1 - this.options.memoryThreshold));
      return baseBatchSize * Math.max(0.5, reductionFactor);
    }

    // 如果CPU使用率接近阈值，减小批处理大小
    if (cpuUsage > this.options.cpuThreshold) {
      const reductionFactor = 1 - ((cpuUsage - this.options.cpuThreshold) / 
                               (1 - this.options.cpuThreshold));
      return baseBatchSize * Math.max(0.6, reductionFactor);
    }

    // 如果资源使用率低，考虑增加批处理大小（但增加幅度较小，以免过度增加）
    if (memoryUsage < (this.options.memoryThreshold * 0.5) && 
        cpuUsage < (this.options.cpuThreshold * 0.5)) {
      return baseBatchSize * 1.1; // 增加10%
    }

    return baseBatchSize;
  }

  /**
   * 记录性能快照
   * @param {Object} deviceStats 设备统计信息
   * @param {Object} networkStats 网络统计信息
   */
  _recordPerformanceSnapshot(deviceStats, networkStats) {
    this.performanceHistory.push({
      timestamp: Date.now(),
      deviceStats: { ...deviceStats },
      networkStats: { ...networkStats }
    });

    // 保持最近100个样本
    if (this.performanceHistory.length > 100) {
      this.performanceHistory.shift();
    }
  }

  /**
   * 启动自适应计时器
   * 周期性分析性能历史以优化设备配置文件
   */
  _startAdaptationTimer() {
    this.adaptationTimer = setInterval(() => {
      this._analyzePerformanceHistory();
    }, this.options.adaptationInterval);
  }

  /**
   * 分析性能历史以改进设备配置文件
   */
  _analyzePerformanceHistory() {
    // 需要至少10个样本进行有意义的分析
    if (this.performanceHistory.length < 10) {
      return;
    }

    // 分析各种设备类型的性能模式
    const deviceTypeStats = {};
    
    this.performanceHistory.forEach(snapshot => {
      const deviceType = this._detectDeviceType(snapshot.deviceStats);
      
      if (!deviceTypeStats[deviceType]) {
        deviceTypeStats[deviceType] = {
          count: 0,
          totalMemoryUsage: 0,
          totalCpuUsage: 0,
          totalLatency: 0,
          totalBandwidth: 0
        };
      }
      
      deviceTypeStats[deviceType].count++;
      deviceTypeStats[deviceType].totalMemoryUsage += snapshot.deviceStats.memoryUsage;
      deviceTypeStats[deviceType].totalCpuUsage += snapshot.deviceStats.cpuUsage;
      deviceTypeStats[deviceType].totalLatency += snapshot.networkStats.latencyMs;
      deviceTypeStats[deviceType].totalBandwidth += snapshot.networkStats.bandwidthMbps;
    });

    // 更新设备配置文件
    for (const [deviceType, stats] of Object.entries(deviceTypeStats)) {
      if (stats.count >= 5) { // 至少需要5个样本
        const avgMemoryUsage = stats.totalMemoryUsage / stats.count;
        const avgCpuUsage = stats.totalCpuUsage / stats.count;
        const avgLatency = stats.totalLatency / stats.count;
        const avgBandwidth = stats.totalBandwidth / stats.count;

        // 根据最近的性能数据微调批处理大小
        let adjustedBatchSize = this.deviceProfiles[deviceType].batchSize;

        // 如果平均使用率低，考虑增加批量大小
        if (avgMemoryUsage < 0.4 && avgCpuUsage < 0.4) {
          adjustedBatchSize += 1;
        }
        
        // 如果平均使用率高，考虑减少批量大小
        if (avgMemoryUsage > 0.6 || avgCpuUsage > 0.7) {
          adjustedBatchSize -= 1;
        }

        // 网络条件调整
        if (avgLatency > 150) {
          adjustedBatchSize -= 1;
        } else if (avgBandwidth > 30 && avgLatency < 80) {
          adjustedBatchSize += 1;
        }

        // 确保批处理大小在合理范围内
        adjustedBatchSize = Math.max(this.options.minBatchSize, 
                           Math.min(this.options.maxBatchSize, adjustedBatchSize));
        
        // 只进行小幅度调整，避免大的波动
        const currentBatchSize = this.deviceProfiles[deviceType].batchSize;
        if (Math.abs(adjustedBatchSize - currentBatchSize) <= 2) {
          this.deviceProfiles[deviceType].batchSize = adjustedBatchSize;
        }
      }
    }
  }

  /**
   * 获取最后一次的批处理大小推荐及其上下文
   * @returns {Object|null} 最后的推荐信息
   */
  getLastRecommendation() {
    return this.lastRecommendation;
  }

  /**
   * 停止自适应计时器并清理资源
   */
  stop() {
    if (this.adaptationTimer) {
      clearInterval(this.adaptationTimer);
      this.adaptationTimer = null;
    }
    
    this.performanceHistory = [];
    this.networkConditionHistory = [];
  }
}

module.exports = BatchSizeRecommender; 