/**
 * 性能指标收集器
 * 收集和监控设备性能和网络状态指标
 */

const deviceDetector = require('../utils/device-detector');
const networkMonitor = require('../utils/network-monitor');

class PerformanceMetricsCollector {
  constructor(options = {}) {
    this.options = {
      // 默认配置
      collectionInterval: 30000, // 收集间隔（毫秒）
      historySize: 20,           // 保留历史记录数
      enableDetailedCollection: true, // 启用详细收集
      ...options
    };

    // 收集状态
    this.isCollecting = false;
    
    // 设备和网络指标历史
    this.deviceStatsHistory = [];
    this.networkStatsHistory = [];
    
    // 当前指标
    this.currentDeviceStats = null;
    this.currentNetworkStats = null;
    
    // 定时器
    this.collectionTimer = null;
    
    // 事件监听器
    this.listeners = [];
    
    // 设备类型检测
    this.deviceType = deviceDetector.getDeviceType();
    this.deviceTier = deviceDetector.getDeviceTier();
    
    // 性能监控标记
    this.marks = {};
  }

  /**
   * 启动性能指标收集
   * @returns {Promise<boolean>} 是否成功启动
   */
  async start() {
    if (this.isCollecting) {
      return true; // 已经在收集中
    }
    
    try {
      // 初始化设备和网络监控
      await this._initializeMonitors();
      
      // 立即收集一次指标
      await this._collectMetrics();
      
      // 设置定时器定期收集指标
      this._setupCollectionTimer();
      
      // 添加网络状态变化监听器
      this._setupNetworkChangeListener();
      
      this.isCollecting = true;
      console.log('性能指标收集器已启动');
      return true;
    } catch (error) {
      console.error('启动性能指标收集器失败:', error);
      return false;
    }
  }

  /**
   * 停止性能指标收集
   */
  stop() {
    // 清除定时器
    if (this.collectionTimer) {
      clearInterval(this.collectionTimer);
      this.collectionTimer = null;
    }
    
    // 移除网络变化监听器
    this._removeNetworkChangeListener();
    
    this.isCollecting = false;
    console.log('性能指标收集器已停止');
  }

  /**
   * 添加指标更新监听器
   * @param {Function} listener 监听器函数，接收(deviceStats, networkStats)参数
   */
  addListener(listener) {
    if (typeof listener === 'function' && !this.listeners.includes(listener)) {
      this.listeners.push(listener);
    }
  }

  /**
   * 移除指标更新监听器
   * @param {Function} listener 要移除的监听器函数
   */
  removeListener(listener) {
    const index = this.listeners.indexOf(listener);
    if (index !== -1) {
      this.listeners.splice(index, 1);
    }
  }

  /**
   * 获取当前设备统计信息
   * @returns {Object} 设备统计信息
   */
  getDeviceStats() {
    return this.currentDeviceStats ? { ...this.currentDeviceStats } : null;
  }

  /**
   * 获取当前网络统计信息
   * @returns {Object} 网络统计信息
   */
  getNetworkStats() {
    return this.currentNetworkStats ? { ...this.currentNetworkStats } : null;
  }

  /**
   * 获取设备统计历史记录
   * @param {number} limit 限制返回的记录数
   * @returns {Array} 设备统计历史记录
   */
  getDeviceStatsHistory(limit = null) {
    const history = [...this.deviceStatsHistory];
    return limit ? history.slice(-limit) : history;
  }

  /**
   * 获取网络统计历史记录
   * @param {number} limit 限制返回的记录数
   * @returns {Array} 网络统计历史记录
   */
  getNetworkStatsHistory(limit = null) {
    const history = [...this.networkStatsHistory];
    return limit ? history.slice(-limit) : history;
  }

  /**
   * 记录性能标记
   * @param {string} markName 标记名称
   * @param {Object} data 额外数据
   */
  mark(markName, data = {}) {
    this.marks[markName] = {
      timestamp: Date.now(),
      deviceStats: this.currentDeviceStats ? { ...this.currentDeviceStats } : null,
      networkStats: this.currentNetworkStats ? { ...this.currentNetworkStats } : null,
      ...data
    };
  }

  /**
   * 测量两个标记之间的时间
   * @param {string} startMark 开始标记名称
   * @param {string} endMark 结束标记名称
   * @returns {Object|null} 测量结果
   */
  measure(startMark, endMark) {
    if (!this.marks[startMark] || !this.marks[endMark]) {
      return null;
    }
    
    const startTime = this.marks[startMark].timestamp;
    const endTime = this.marks[endMark].timestamp;
    const duration = endTime - startTime;
    
    return {
      duration,
      startMark: this.marks[startMark],
      endMark: this.marks[endMark],
      deviceStatsStart: this.marks[startMark].deviceStats,
      deviceStatsEnd: this.marks[endMark].deviceStats,
      networkStatsStart: this.marks[startMark].networkStats,
      networkStatsEnd: this.marks[endMark].networkStats
    };
  }

  /**
   * 清除所有标记
   */
  clearMarks() {
    this.marks = {};
  }

  /**
   * 初始化设备和网络监控
   * @private
   */
  async _initializeMonitors() {
    try {
      // 确保网络监控已初始化
      if (!networkMonitor.isInitialized()) {
        await networkMonitor.initialize();
      }
      
      return true;
    } catch (error) {
      console.error('初始化监控器失败:', error);
      return false;
    }
  }

  /**
   * 设置定时器定期收集指标
   * @private
   */
  _setupCollectionTimer() {
    if (this.collectionTimer) {
      clearInterval(this.collectionTimer);
    }
    
    this.collectionTimer = setInterval(async () => {
      await this._collectMetrics();
    }, this.options.collectionInterval);
  }

  /**
   * 设置网络变化监听器
   * @private
   */
  _setupNetworkChangeListener() {
    networkMonitor.addEventListener('change', async () => {
      // 网络状态变化时立即收集指标
      await this._collectMetrics();
    });
  }

  /**
   * 移除网络变化监听器
   * @private
   */
  _removeNetworkChangeListener() {
    networkMonitor.removeEventListener('change');
  }

  /**
   * 收集性能指标
   * @private
   */
  async _collectMetrics() {
    try {
      // 收集设备统计信息
      const deviceStats = await this._collectDeviceStats();
      this.currentDeviceStats = deviceStats;
      
      // 添加到历史记录
      this.deviceStatsHistory.push({
        timestamp: Date.now(),
        ...deviceStats
      });
      
      // 收集网络统计信息
      const networkStats = await this._collectNetworkStats();
      this.currentNetworkStats = networkStats;
      
      // 添加到历史记录
      this.networkStatsHistory.push({
        timestamp: Date.now(),
        ...networkStats
      });
      
      // 限制历史记录大小
      this._trimHistories();
      
      // 通知监听器
      this._notifyListeners();
      
      return true;
    } catch (error) {
      console.error('收集性能指标失败:', error);
      return false;
    }
  }

  /**
   * 收集设备统计信息
   * @private
   * @returns {Promise<Object>} 设备统计信息
   */
  async _collectDeviceStats() {
    const stats = {
      timestamp: Date.now(),
      deviceType: this.deviceType,
      deviceTier: this.deviceTier,
      cpuCores: navigator.hardwareConcurrency || 4,
      memoryLimit: this._getDeviceMemoryLimit(),
      memoryUsage: await this._estimateMemoryUsage(),
      cpuUsage: await this._estimateCpuUsage(),
      batteryLevel: await this._getBatteryLevel(),
      isLowPowerMode: this._isLowPowerMode(),
      isLowEndDevice: this.deviceTier === 'lowEnd' || this.deviceTier === 'ultraLowEnd'
    };
    
    // 添加详细收集的数据（如果启用）
    if (this.options.enableDetailedCollection) {
      stats.frameRate = await this._estimateFrameRate();
      stats.thermalState = await this._getThermalState();
    }
    
    return stats;
  }

  /**
   * 收集网络统计信息
   * @private
   * @returns {Promise<Object>} 网络统计信息
   */
  async _collectNetworkStats() {
    // 使用网络监控器获取状态
    const networkInfo = networkMonitor.getNetworkInfo();
    
    const stats = {
      timestamp: Date.now(),
      online: navigator.onLine,
      connectionType: networkInfo.connectionType || 'unknown',
      bandwidthMbps: networkInfo.bandwidthMbps || null,
      latencyMs: networkInfo.latencyMs || null,
      isMetered: networkInfo.isMetered || false,
      rtt: networkInfo.rtt || null,
      downlink: networkInfo.downlink || null,
      effectiveType: networkInfo.effectiveType || 'unknown',
      reliability: this._calculateNetworkReliability()
    };
    
    // 添加详细收集的数据（如果启用）
    if (this.options.enableDetailedCollection) {
      stats.packetLoss = await this._estimatePacketLoss();
      stats.jitter = await this._estimateJitter();
    }
    
    return stats;
  }

  /**
   * 限制历史记录大小
   * @private
   */
  _trimHistories() {
    if (this.deviceStatsHistory.length > this.options.historySize) {
      this.deviceStatsHistory = this.deviceStatsHistory.slice(-this.options.historySize);
    }
    
    if (this.networkStatsHistory.length > this.options.historySize) {
      this.networkStatsHistory = this.networkStatsHistory.slice(-this.options.historySize);
    }
  }

  /**
   * 通知所有监听器
   * @private
   */
  _notifyListeners() {
    for (const listener of this.listeners) {
      try {
        listener(this.currentDeviceStats, this.currentNetworkStats);
      } catch (error) {
        console.error('通知监听器失败:', error);
      }
    }
  }

  /**
   * 获取设备内存限制
   * @private
   * @returns {number} 内存限制（MB）
   */
  _getDeviceMemoryLimit() {
    // 尝试使用 navigator.deviceMemory API (仅Chromium支持)
    if (navigator.deviceMemory) {
      return navigator.deviceMemory * 1024; // 转换为MB
    }
    
    // 根据设备类型估计
    switch (this.deviceTier) {
      case 'highEnd':
        return 4096; // 4GB
      case 'midRange':
        return 2048; // 2GB
      case 'lowEnd':
        return 1024; // 1GB
      case 'ultraLowEnd':
        return 512;  // 512MB
      default:
        return 2048; // 默认假设2GB
    }
  }

  /**
   * 估计内存使用率
   * @private
   * @returns {Promise<number>} 内存使用率 (0-1)
   */
  async _estimateMemoryUsage() {
    try {
      // 尝试使用 performance.memory API (仅Chromium支持)
      if (window.performance && performance.memory) {
        const used = performance.memory.usedJSHeapSize;
        const total = performance.memory.jsHeapSizeLimit;
        return Math.min(1, used / total);
      }
      
      // 备用方法：基于分配大量数组失败的可能性估计内存使用
      // 注意：这种方法不准确，仅用于粗略估计
      try {
        // 尝试分配一个大数组，如果内存不足将抛出异常
        const testSize = 1024 * 1024 * 10; // 10MB
        const arr = new Array(testSize);
        arr.fill(0);
        // 如果成功，释放数组并返回低使用率
        arr.length = 0;
        return 0.3; // 粗略估计为30%
      } catch (e) {
        // 如果分配失败，假设内存使用率较高
        return 0.8; // 粗略估计为80%
      }
    } catch (error) {
      console.warn('估计内存使用率失败:', error);
      return 0.5; // 默认返回50%
    }
  }

  /**
   * 估计CPU使用率
   * @private
   * @returns {Promise<number>} CPU使用率 (0-1)
   */
  async _estimateCpuUsage() {
    try {
      // 通过测量一定数量的操作所需时间来估计CPU负载
      const start = performance.now();
      const iterations = 1000000; // 循环次数
      
      let sum = 0;
      for (let i = 0; i < iterations; i++) {
        sum += Math.sqrt(i);
      }
      
      const end = performance.now();
      const duration = end - start;
      
      // 比较持续时间与基准时间估计CPU负载
      // 这是一个简化的估计，真实场景中可能需要更复杂的逻辑
      const baselineDuration = this.deviceTier === 'highEnd' ? 20 : 
                            this.deviceTier === 'midRange' ? 40 :
                            this.deviceTier === 'lowEnd' ? 80 : 120;
      
      // 计算使用率：持续时间越长，CPU负载越高
      const usage = Math.min(1, duration / (baselineDuration * 2));
      
      return usage;
    } catch (error) {
      console.warn('估计CPU使用率失败:', error);
      return 0.5; // 默认返回50%
    }
  }

  /**
   * 估计帧率
   * @private
   * @returns {Promise<number>} 估计的帧率
   */
  async _estimateFrameRate() {
    return new Promise((resolve) => {
      let frames = 0;
      let lastTime = performance.now();
      const duration = 500; // 测量时间(毫秒)
      
      function countFrame(now) {
        frames++;
        if (now - lastTime < duration) {
          requestAnimationFrame(countFrame);
        } else {
          // 计算平均帧率
          const fps = Math.round((frames * 1000) / (now - lastTime));
          resolve(fps);
        }
      }
      
      requestAnimationFrame(countFrame);
    });
  }

  /**
   * 获取电池电量
   * @private
   * @returns {Promise<number|null>} 电池电量 (0-1) 或 null
   */
  async _getBatteryLevel() {
    try {
      // 使用Battery Status API
      if (navigator.getBattery) {
        const battery = await navigator.getBattery();
        return battery.level;
      }
      return null;
    } catch (error) {
      return null;
    }
  }

  /**
   * 检查设备是否处于低功耗模式
   * @private
   * @returns {boolean} 是否处于低功耗模式
   */
  _isLowPowerMode() {
    // 目前没有直接API检测低功耗模式
    // 可以基于一些启发式方法猜测，如电池电量低于20%
    try {
      const batteryLevel = this._getBatteryLevel();
      return batteryLevel !== null && batteryLevel < 0.2;
    } catch (error) {
      return false;
    }
  }

  /**
   * 获取设备热状态估计
   * @private
   * @returns {Promise<string>} 热状态: 'normal', 'elevated', 'high'
   */
  async _getThermalState() {
    // 目前没有直接API检测设备热状态
    // 可以基于CPU使用率和设备帧率猜测
    try {
      const cpuUsage = await this._estimateCpuUsage();
      const frameRate = await this._estimateFrameRate();
      
      if (cpuUsage > 0.8 && frameRate < 30) {
        return 'high';
      } else if (cpuUsage > 0.6 || frameRate < 45) {
        return 'elevated';
      } else {
        return 'normal';
      }
    } catch (error) {
      return 'normal';
    }
  }

  /**
   * 计算网络可靠性 (0-1)
   * @private
   * @returns {number} 网络可靠性分数
   */
  _calculateNetworkReliability() {
    // 检查历史记录中的网络波动
    if (this.networkStatsHistory.length < 2) {
      return 0.5; // 数据不足，返回中等可靠性
    }
    
    try {
      // 计算网络状态变化频率
      let changes = 0;
      for (let i = 1; i < this.networkStatsHistory.length; i++) {
        const prev = this.networkStatsHistory[i - 1];
        const curr = this.networkStatsHistory[i];
        
        if (prev.online !== curr.online || 
            prev.connectionType !== curr.connectionType ||
            Math.abs((prev.bandwidthMbps || 0) - (curr.bandwidthMbps || 0)) > 1) {
          changes++;
        }
      }
      
      // 变化越多，可靠性越低
      const changeFactor = changes / (this.networkStatsHistory.length - 1);
      const reliability = 1 - Math.min(1, changeFactor * 2);
      
      return reliability;
    } catch (error) {
      return 0.5; // 出错时返回中等可靠性
    }
  }

  /**
   * 估计网络丢包率
   * @private
   * @returns {Promise<number>} 丢包率估计 (0-1)
   */
  async _estimatePacketLoss() {
    // 在真实场景中，这需要通过网络探测实现
    // 这里使用简化的模拟方法
    try {
      const networkInfo = networkMonitor.getNetworkInfo();
      
      // 基于网络类型和延迟估计丢包率
      if (!navigator.onLine) return 1.0;
      
      switch (networkInfo.effectiveType) {
        case 'slow-2g':
          return 0.05 + Math.random() * 0.15; // 5-20%
        case '2g':
          return 0.02 + Math.random() * 0.08; // 2-10%
        case '3g':
          return 0.005 + Math.random() * 0.015; // 0.5-2%
        case '4g':
        case 'wifi':
          return Math.random() * 0.005; // 0-0.5%
        default:
          return 0.01; // 默认1%
      }
    } catch (error) {
      return 0.01; // 默认1%
    }
  }

  /**
   * 估计网络抖动
   * @private
   * @returns {Promise<number>} 抖动估计 (毫秒)
   */
  async _estimateJitter() {
    // 在真实场景中，这需要通过多次探测计算
    // 这里使用简化的模拟方法
    try {
      const networkInfo = networkMonitor.getNetworkInfo();
      const baseLatency = networkInfo.latencyMs || 50;
      
      // 基于网络类型估计抖动
      switch (networkInfo.effectiveType) {
        case 'slow-2g':
          return baseLatency * (0.3 + Math.random() * 0.2); // 30-50% of latency
        case '2g':
          return baseLatency * (0.2 + Math.random() * 0.1); // 20-30% of latency
        case '3g':
          return baseLatency * (0.1 + Math.random() * 0.1); // 10-20% of latency
        case '4g':
          return baseLatency * (0.05 + Math.random() * 0.05); // 5-10% of latency
        case 'wifi':
          return baseLatency * (0.02 + Math.random() * 0.03); // 2-5% of latency
        default:
          return baseLatency * 0.1; // 默认10% of latency
      }
    } catch (error) {
      return 5; // 默认5毫秒
    }
  }
}

module.exports = PerformanceMetricsCollector; 