/**
 * @file 网络监控器
 * @description 监控网络状态变化并提供网络信息
 */

/**
 * 网络监控器类
 * 负责检测网络连接状态变化，并发出相应事件
 */

const EventEmitter = require('../utils/common/event-emitter');
const { logInfo, logWarning, logDebug, logError } = require('../utils/common/logger');

class NetworkMonitor extends EventEmitter {
  /**
   * 创建网络监控器
   * @param {Object} options - 配置选项
   * @param {number} options.checkInterval - 检查间隔（毫秒）
   * @param {boolean} options.enableOfflineDetection - 是否启用离线检测
   * @param {string} options.pingUrl - 用于检测网络的ping URL
   * @param {number} options.pingTimeout - ping超时时间（毫秒）
   */
  constructor(options = {}) {
    super();
    
    this.config = {
      checkInterval: options.checkInterval || 10000, // 默认10秒
      enableOfflineDetection: options.enableOfflineDetection !== false,
      pingUrl: options.pingUrl || '/api/ping',
      pingTimeout: options.pingTimeout || 3000,
      maxConsecutiveFailures: options.maxConsecutiveFailures || 3
    };
    
    this._state = {
      status: 'unknown', // unknown, excellent, good, fair, poor, offline
      previousStatus: null,
      consecutiveFailures: 0,
      consecutiveSuccesses: 0,
      lastCheckTime: 0,
      connectionType: null,
      effectiveType: null,
      downlink: null,
      rtt: null,
      isChecking: false,
      checkTimer: null,
      isInitialized: false
    };
    
    // 绑定方法上下文
    this._bindMethods();
  }
  
  /**
   * 绑定方法上下文
   * @private
   */
  _bindMethods() {
    this._handleOnline = this._handleOnline.bind(this);
    this._handleOffline = this._handleOffline.bind(this);
    this._handleConnectionChange = this._handleConnectionChange.bind(this);
    this._checkNetworkStatus = this._checkNetworkStatus.bind(this);
  }
  
  /**
   * 初始化网络监控
   * @return {Promise<string>} 当前网络状态
   */
  async initialize() {
    if (this._state.isInitialized) {
      return this._state.status;
    }
    
    // 添加事件监听器
    if (this.config.enableOfflineDetection) {
      window.addEventListener('online', this._handleOnline);
      window.addEventListener('offline', this._handleOffline);
    }
    
    // 添加网络信息API的事件监听
    if (navigator.connection) {
      navigator.connection.addEventListener('change', this._handleConnectionChange);
      
      // 初始化网络信息
      this._updateNetworkInfo();
    }
    
    // 执行初始检查
    try {
      await this._checkNetworkStatus();
    } catch (error) {
      logWarning('Initial network status check failed:', error);
      // 如果初始检查失败，设置为未知状态
      this._updateStatus('unknown');
    }
    
    // 启动定期检查
    this._startPeriodicCheck();
    
    this._state.isInitialized = true;
    return this._state.status;
  }
  
  /**
   * 销毁网络监控器
   */
  destroy() {
    // 移除事件监听器
    if (this.config.enableOfflineDetection) {
      window.removeEventListener('online', this._handleOnline);
      window.removeEventListener('offline', this._handleOffline);
    }
    
    // 移除网络信息API的事件监听
    if (navigator.connection) {
      navigator.connection.removeEventListener('change', this._handleConnectionChange);
    }
    
    // 停止定期检查
    this._stopPeriodicCheck();
    
    this._state.isInitialized = false;
  }
  
  /**
   * 开始定期检查
   * @private
   */
  _startPeriodicCheck() {
    this._stopPeriodicCheck(); // 确保不会创建多个定时器
    
    this._state.checkTimer = setInterval(
      this._checkNetworkStatus,
      this.config.checkInterval
    );
  }
  
  /**
   * 停止定期检查
   * @private
   */
  _stopPeriodicCheck() {
    if (this._state.checkTimer) {
      clearInterval(this._state.checkTimer);
      this._state.checkTimer = null;
    }
  }
  
  /**
   * 处理在线事件
   * @private
   */
  _handleOnline() {
    logInfo('Browser reports online status');
    // 不立即更新状态，而是触发网络状态检查以确认
    this._checkNetworkStatus();
  }
  
  /**
   * 处理离线事件
   * @private
   */
  _handleOffline() {
    logInfo('Browser reports offline status');
    this._updateStatus('offline');
  }
  
  /**
   * 处理连接状态变化事件
   * @private
   */
  _handleConnectionChange() {
    this._updateNetworkInfo();
    
    // 估计网络状态
    const status = this._estimateNetworkStatus();
    
    // 如果估计的状态与当前状态不同，触发检查以确认
    if (status !== this._state.status) {
      logDebug(`Network info changed, estimated new status: ${status}`);
      this._checkNetworkStatus();
    }
  }
  
  /**
   * 更新网络信息
   * @private
   */
  _updateNetworkInfo() {
    if (!navigator.connection) {
      return;
    }
    
    const connection = navigator.connection;
    
    this._state.connectionType = connection.type;
    this._state.effectiveType = connection.effectiveType;
    this._state.downlink = connection.downlink;
    this._state.rtt = connection.rtt;
    
    logDebug('Network info updated:', {
      type: this._state.connectionType,
      effectiveType: this._state.effectiveType,
      downlink: this._state.downlink,
      rtt: this._state.rtt
    });
  }
  
  /**
   * 估计当前网络状态
   * @private
   * @return {string} 估计的网络状态
   */
  _estimateNetworkStatus() {
    // 如果浏览器报告离线
    if (navigator.onLine === false) {
      return 'offline';
    }
    
    // 如果没有网络信息API，无法准确估计
    if (!this._state.effectiveType) {
      return navigator.onLine ? 'unknown' : 'offline';
    }
    
    // 基于effectiveType和RTT估计网络状态
    switch (this._state.effectiveType) {
      case 'slow-2g':
        return 'poor';
      case '2g':
        return 'poor';
      case '3g':
        return this._state.rtt > 500 ? 'poor' : 'fair';
      case '4g':
        if (this._state.rtt > 300) return 'fair';
        if (this._state.rtt > 100) return 'good';
        return 'excellent';
      default:
        return 'unknown';
    }
  }
  
  /**
   * 检查网络状态
   * @private
   * @return {Promise<string>} 网络状态
   */
  async _checkNetworkStatus() {
    // 防止并发检查
    if (this._state.isChecking) {
      return this._state.status;
    }
    
    this._state.isChecking = true;
    const startTime = Date.now();
    
    try {
      // 如果浏览器报告离线，不进行ping测试
      if (navigator.onLine === false) {
        this._updateStatus('offline');
        return 'offline';
      }
      
      // 执行ping测试
      const pingResult = await this._pingServer();
      
      // 重置连续失败计数
      this._state.consecutiveFailures = 0;
      
      // 增加连续成功计数
      this._state.consecutiveSuccesses++;
      
      // 计算ping响应时间
      const pingTime = pingResult.time;
      
      // 基于ping时间确定网络状态
      let newStatus;
      if (pingTime < 150) {
        newStatus = 'excellent';
      } else if (pingTime < 300) {
        newStatus = 'good';
      } else if (pingTime < 600) {
        newStatus = 'fair';
      } else {
        newStatus = 'poor';
      }
      
      // 更新状态
      this._updateStatus(newStatus);
      return newStatus;
    } catch (error) {
      // 增加连续失败计数
      this._state.consecutiveFailures++;
      
      // 重置连续成功计数
      this._state.consecutiveSuccesses = 0;
      
      // 如果连续失败次数超过阈值，标记为离线
      if (this._state.consecutiveFailures >= this.config.maxConsecutiveFailures) {
        this._updateStatus('offline');
        logWarning(`Network appears to be offline after ${this._state.consecutiveFailures} consecutive failures`);
      }
      
      logWarning('Network status check failed:', error);
      return this._state.status;
    } finally {
      this._state.lastCheckTime = Date.now();
      this._state.isChecking = false;
    }
  }
  
  /**
   * Ping服务器测试连接
   * @private
   * @return {Promise<Object>} ping结果
   */
  async _pingServer() {
    const startTime = Date.now();
    
    // 创建终止控制器
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, this.config.pingTimeout);
    
    try {
      // 执行ping请求
      const response = await fetch(this.config.pingUrl, {
        method: 'GET',
        cache: 'no-store',
        signal: controller.signal,
        headers: {
          'X-Requested-With': 'XMLHttpRequest',
          'Cache-Control': 'no-cache'
        }
      });
      
      // 检查响应状态
      if (!response.ok) {
        throw new Error(`Ping failed with status: ${response.status}`);
      }
      
      // 计算响应时间
      const pingTime = Date.now() - startTime;
      
      return { success: true, time: pingTime };
    } catch (error) {
      // 如果是超时错误
      if (error.name === 'AbortError') {
        throw new Error('Ping timeout');
      }
      
      throw error;
    } finally {
      // 清除超时计时器
      clearTimeout(timeoutId);
    }
  }
  
  /**
   * 更新网络状态
   * @private
   * @param {string} newStatus - 新状态
   */
  _updateStatus(newStatus) {
    // 如果状态没有变化，不做任何处理
    if (newStatus === this._state.status) {
      return;
    }
    
    // 更新状态
    this._state.previousStatus = this._state.status;
    this._state.status = newStatus;
    
    // 发出状态变化事件
    this.emit('statusChange', {
      status: newStatus,
      previousStatus: this._state.previousStatus,
      time: Date.now()
    });
    
    logInfo(`Network status changed from ${this._state.previousStatus} to ${newStatus}`);
  }
  
  /**
   * 获取当前网络状态
   * @return {Object} 网络状态信息
   */
  getStatus() {
    return {
      status: this._state.status,
      connectionType: this._state.connectionType,
      effectiveType: this._state.effectiveType,
      downlink: this._state.downlink,
      rtt: this._state.rtt,
      lastCheckTime: this._state.lastCheckTime
    };
  }
  
  /**
   * 强制检查网络状态
   * @return {Promise<string>} 网络状态
   */
  async checkNow() {
    return this._checkNetworkStatus();
  }
}

module.exports = NetworkMonitor; 