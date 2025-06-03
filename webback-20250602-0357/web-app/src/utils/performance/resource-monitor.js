/**
 * ResourceMonitor - 监控网页应用的资源使用情况
 * 包括内存使用、CPU使用和网络活动
 */
class ResourceMonitor {
  constructor(options = {}) {
    this.options = {
      interval: options.interval || 5000, // 默认监控间隔为5秒
      memoryWarningThreshold: options.memoryWarningThreshold || 0.8, // 内存警告阈值 (80%)
      cpuWarningThreshold: options.cpuWarningThreshold || 0.7, // CPU警告阈值 (70%)
      enableLogging: options.enableLogging !== undefined ? options.enableLogging : true,
      logLevel: options.logLevel || 'INFO',
      enableAlerts: options.enableAlerts !== undefined ? options.enableAlerts : true,
    };
    
    this.isMonitoring = false;
    this.monitoringInterval = null;
    this.networkRequests = {
      active: 0,
      completed: 0,
      failed: 0,
      totalBytes: 0
    };
    
    this.stats = {
      memory: {
        usage: 0,
        limit: 0,
        usagePercent: 0
      },
      cpu: {
        usage: 0,
        samples: []
      },
      network: {
        requestsPerMinute: 0,
        bytesReceived: 0,
        bytesSent: 0,
        activeConnections: 0,
        history: []
      }
    };
    
    this.listeners = {
      memory: [],
      cpu: [],
      network: [],
      alert: []
    };
    
    // 导入Logger (假设Logger类已在logger.js中实现)
    try {
      this.logger = require('./logger');
      if (this.options.enableLogging) {
        this.logger.configure({
          level: this.options.logLevel,
          useConsole: true,
          useLocalStorage: true,
          maxEntries: 1000
        });
      }
    } catch (e) {
      console.warn('无法加载Logger模块，将退回到基本控制台日志记录');
      this.logger = {
        debug: console.debug,
        info: console.info,
        warn: console.warn,
        error: console.error
      };
    }
    
    // 绑定网络请求拦截器
    this._setupNetworkMonitoring();
  }
  
  /**
   * 开始资源监控
   * @returns {boolean} 是否成功启动监控
   */
  start() {
    if (this.isMonitoring) {
      this.logger.warn('资源监控器已经在运行中');
      return false;
    }
    
    this.logger.info('启动资源监控器');
    this.isMonitoring = true;
    
    // 立即执行一次监控，然后设置定时器
    this._collectStats();
    
    this.monitoringInterval = setInterval(() => {
      this._collectStats();
    }, this.options.interval);
    
    return true;
  }
  
  /**
   * 停止资源监控
   */
  stop() {
    if (!this.isMonitoring) {
      this.logger.warn('资源监控器未在运行');
      return false;
    }
    
    this.logger.info('停止资源监控器');
    this.isMonitoring = false;
    
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    
    return true;
  }
  
  /**
   * 添加资源监控的事件监听器
   * @param {string} resourceType - 资源类型: 'memory', 'cpu', 'network', 'alert'
   * @param {Function} callback - 当资源状态更新时调用的回调函数
   */
  addEventListener(resourceType, callback) {
    if (!this.listeners[resourceType]) {
      this.logger.warn(`未知资源类型: ${resourceType}`);
      return false;
    }
    
    this.listeners[resourceType].push(callback);
    return true;
  }
  
  /**
   * 移除事件监听器
   * @param {string} resourceType - 资源类型
   * @param {Function} callback - 要移除的回调函数
   */
  removeEventListener(resourceType, callback) {
    if (!this.listeners[resourceType]) {
      return false;
    }
    
    const index = this.listeners[resourceType].indexOf(callback);
    if (index !== -1) {
      this.listeners[resourceType].splice(index, 1);
      return true;
    }
    
    return false;
  }
  
  /**
   * 获取当前资源使用统计
   * @returns {Object} 包含内存、CPU和网络统计的对象
   */
  getStats() {
    return {...this.stats};
  }
  
  /**
   * 记录网络请求开始
   * @param {string} url - 请求的URL
   * @param {Object} options - 请求选项
   */
  recordRequestStart(url, options = {}) {
    this.networkRequests.active++;
    this._notifyListeners('network', {
      type: 'request_start',
      url,
      options,
      timestamp: Date.now(),
      activeRequests: this.networkRequests.active
    });
  }
  
  /**
   * 记录网络请求完成
   * @param {string} url - 请求的URL
   * @param {number} status - HTTP状态码
   * @param {number} bytes - 接收的字节数
   */
  recordRequestComplete(url, status, bytes = 0) {
    this.networkRequests.active--;
    this.networkRequests.completed++;
    this.networkRequests.totalBytes += bytes;
    
    // 更新网络统计
    this.stats.network.bytesReceived += bytes;
    
    this._notifyListeners('network', {
      type: 'request_complete',
      url,
      status,
      bytes,
      timestamp: Date.now(),
      activeRequests: this.networkRequests.active
    });
  }
  
  /**
   * 记录网络请求失败
   * @param {string} url - 请求的URL
   * @param {Error} error - 错误对象
   */
  recordRequestFailed(url, error) {
    this.networkRequests.active--;
    this.networkRequests.failed++;
    
    this._notifyListeners('network', {
      type: 'request_failed',
      url,
      error: error.message,
      timestamp: Date.now(),
      activeRequests: this.networkRequests.active
    });
    
    this.logger.error(`网络请求失败: ${url}`, error);
  }
  
  /**
   * 收集所有资源统计信息
   * @private
   */
  _collectStats() {
    try {
      this._collectMemoryStats();
      this._collectCpuStats();
      this._collectNetworkStats();
      
      // 记录资源使用情况
      if (this.options.enableLogging) {
        this.logger.debug('资源使用统计', {
          memory: `${Math.round(this.stats.memory.usagePercent * 100)}%`,
          cpu: `${Math.round(this.stats.cpu.usage * 100)}%`,
          network: `${this.stats.network.activeConnections} 个活跃连接`
        });
      }
      
      // 检查资源警告
      this._checkResourceWarnings();
    } catch (error) {
      this.logger.error('收集资源统计时出错', error);
    }
  }
  
  /**
   * 收集内存使用统计
   * @private
   */
  _collectMemoryStats() {
    // 使用performance API收集内存信息（如果可用）
    if (window.performance && window.performance.memory) {
      const memoryInfo = window.performance.memory;
      this.stats.memory.usage = memoryInfo.usedJSHeapSize;
      this.stats.memory.limit = memoryInfo.jsHeapSizeLimit;
      this.stats.memory.usagePercent = memoryInfo.usedJSHeapSize / memoryInfo.jsHeapSizeLimit;
    } else {
      // 降级策略：无法获取精确内存使用情况
      // 可以考虑通过其他间接方式估算
      this.logger.debug('无法访问精确内存使用信息');
    }
    
    // 通知监听器
    this._notifyListeners('memory', this.stats.memory);
  }
  
  /**
   * 收集CPU使用统计
   * @private
   */
  _collectCpuStats() {
    // 注意：浏览器环境中难以直接获取CPU使用率
    // 这里使用一种近似方法：测量一段短时间内的JS执行时间
    
    const startTime = performance.now();
    const iterations = 1000000; // 执行一些计算来测量CPU负载
    
    // 执行一些繁重计算来估计CPU负载
    let result = 0;
    for (let i = 0; i < iterations; i++) {
      result += Math.sqrt(i);
    }
    
    const endTime = performance.now();
    const executionTime = endTime - startTime;
    
    // 计算CPU使用率的近似值（基于历史样本）
    const expectedTime = 20; // 基准执行时间（毫秒）
    const loadFactor = executionTime / expectedTime;
    
    // 限制在0-1范围内
    const normalizedLoad = Math.min(Math.max(loadFactor, 0), 1);
    
    // 存储样本并计算平均值
    this.stats.cpu.samples.push(normalizedLoad);
    if (this.stats.cpu.samples.length > 10) {
      this.stats.cpu.samples.shift();
    }
    
    // 计算平均CPU使用率
    this.stats.cpu.usage = this.stats.cpu.samples.reduce((sum, value) => sum + value, 0) / 
                          this.stats.cpu.samples.length;
    
    // 通知监听器
    this._notifyListeners('cpu', this.stats.cpu);
  }
  
  /**
   * 收集网络使用统计
   * @private
   */
  _collectNetworkStats() {
    // 更新网络统计
    this.stats.network.activeConnections = this.networkRequests.active;
    
    // 计算请求率（每分钟请求数）
    const now = Date.now();
    const oneMinuteAgo = now - 60000;
    
    // 清理旧的网络历史记录
    this.stats.network.history = this.stats.network.history.filter(entry => entry.timestamp > oneMinuteAgo);
    
    // 计算每分钟请求数
    this.stats.network.requestsPerMinute = this.stats.network.history.length;
    
    // 添加当前状态到历史记录
    this.stats.network.history.push({
      timestamp: now,
      activeConnections: this.stats.network.activeConnections,
      bytesReceived: this.stats.network.bytesReceived,
      bytesSent: this.stats.network.bytesSent
    });
    
    // 通知监听器
    this._notifyListeners('network', this.stats.network);
  }
  
  /**
   * 设置网络监控
   * @private
   */
  _setupNetworkMonitoring() {
    // 使用Performance API监控网络（如果可用）
    if (window.PerformanceObserver) {
      try {
        const observer = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (entry.entryType === 'resource') {
              // 更新网络统计
              this.stats.network.bytesReceived += entry.transferSize || 0;
              
              // 添加到历史记录
              this.stats.network.history.push({
                timestamp: Date.now(),
                url: entry.name,
                duration: entry.duration,
                size: entry.transferSize || 0
              });
            }
          }
        });
        
        observer.observe({ entryTypes: ['resource'] });
        this.logger.debug('已设置PerformanceObserver来监控网络资源');
      } catch (e) {
        this.logger.warn('设置PerformanceObserver失败', e);
      }
    }
  }
  
  /**
   * 检查资源警告
   * @private
   */
  _checkResourceWarnings() {
    // 检查内存使用警告
    if (this.stats.memory.usagePercent > this.options.memoryWarningThreshold) {
      this._triggerAlert('memory', {
        level: 'warning',
        message: `内存使用率高: ${(this.stats.memory.usagePercent * 100).toFixed(1)}%`,
        value: this.stats.memory.usagePercent,
        threshold: this.options.memoryWarningThreshold
      });
    }
    
    // 检查CPU使用警告
    if (this.stats.cpu.usage > this.options.cpuWarningThreshold) {
      this._triggerAlert('cpu', {
        level: 'warning',
        message: `CPU使用率高: ${(this.stats.cpu.usage * 100).toFixed(1)}%`,
        value: this.stats.cpu.usage,
        threshold: this.options.cpuWarningThreshold
      });
    }
    
    // 检查网络连接警告（如果有大量活跃连接）
    if (this.stats.network.activeConnections > 20) {
      this._triggerAlert('network', {
        level: 'info',
        message: `大量网络连接: ${this.stats.network.activeConnections}`,
        value: this.stats.network.activeConnections,
        threshold: 20
      });
    }
  }
  
  /**
   * 触发资源警报
   * @param {string} resourceType - 资源类型
   * @param {Object} alertInfo - 警报信息
   * @private
   */
  _triggerAlert(resourceType, alertInfo) {
    if (!this.options.enableAlerts) {
      return;
    }
    
    // 记录警报
    const logMethod = alertInfo.level === 'warning' ? 'warn' : 
                     (alertInfo.level === 'error' ? 'error' : 'info');
    
    this.logger[logMethod](`资源警报 [${resourceType}]: ${alertInfo.message}`);
    
    // 通知警报监听器
    this._notifyListeners('alert', {
      type: resourceType,
      ...alertInfo,
      timestamp: Date.now()
    });
  }
  
  /**
   * 通知所有特定资源类型的监听器
   * @param {string} resourceType - 资源类型
   * @param {Object} data - 要发送给监听器的数据
   * @private
   */
  _notifyListeners(resourceType, data) {
    if (!this.listeners[resourceType]) {
      return;
    }
    
    for (const callback of this.listeners[resourceType]) {
      try {
        callback(data);
      } catch (error) {
        this.logger.error(`执行${resourceType}监听器回调时出错`, error);
      }
    }
  }
}

// 导出ResourceMonitor类
module.exports = ResourceMonitor; 