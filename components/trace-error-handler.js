/**
 * 食品溯源系统 - 错误处理和日志记录组件
 * 提供全局错误处理、日志记录、错误报告等功能
 */

class TraceErrorHandler {
  constructor() {
    this.logs = [];
    this.errorCount = 0;
    this.maxLogs = 1000;
    this.config = {
      logLevel: 'info', // debug, info, warn, error
      enableConsole: true,
      enableRemoteLogging: false,
      remoteEndpoint: '/api/logs',
      errorThreshold: 10,
      autoReport: true
    };
  }

  /**
   * 初始化错误处理
   */
  init() {
    this.setupErrorHandlers();
    this.setupPerformanceMonitoring();
    this.setupNetworkErrorHandling();
    this.setupStorageErrorHandling();
    
    console.log('错误处理组件已初始化');
    return this;
  }

  /**
   * 设置错误处理器
   */
  setupErrorHandlers() {
    // 全局错误处理
    window.onerror = (message, source, lineno, colno, error) => {
      this.handleError({
        type: 'runtime',
        message,
        source,
        lineno,
        colno,
        error,
        timestamp: new Date().toISOString()
      });
      return false; // 允许错误继续传播
    };

    // Promise错误处理
    window.onunhandledrejection = (event) => {
      this.handleError({
        type: 'promise',
        message: event.reason?.message || 'Promise rejected',
        error: event.reason,
        timestamp: new Date().toISOString()
      });
    };

    // 自定义错误处理
    window.addEventListener('error', (event) => {
      if (event.target.tagName === 'SCRIPT' || event.target.tagName === 'LINK') {
        this.handleError({
          type: 'resource',
          message: `资源加载失败: ${event.target.src || event.target.href}`,
          timestamp: new Date().toISOString()
        });
      }
    });
  }

  /**
   * 设置性能监控
   */
  setupPerformanceMonitoring() {
    // 监控页面加载性能
    window.addEventListener('load', () => {
      const performance = window.performance;
      if (performance) {
        const timing = performance.timing;
        const loadTime = timing.loadEventEnd - timing.navigationStart;
        
        this.log({
          level: 'info',
          message: `页面加载时间: ${loadTime}ms`,
          data: {
            dnsTime: timing.domainLookupEnd - timing.domainLookupStart,
            tcpTime: timing.connectEnd - timing.connectStart,
            serverTime: timing.responseEnd - timing.requestStart,
            domTime: timing.domComplete - timing.domLoading
          }
        });
      }
    });

    // 监控内存使用
    if (performance.memory) {
      setInterval(() => {
        const memory = performance.memory;
        if (memory.usedJSHeapSize > memory.jsHeapSizeLimit * 0.8) {
          this.log({
            level: 'warn',
            message: '内存使用率过高',
            data: {
              used: memory.usedJSHeapSize,
              total: memory.totalJSHeapSize,
              limit: memory.jsHeapSizeLimit
            }
          });
        }
      }, 60000); // 每分钟检查一次
    }
  }

  /**
   * 设置网络错误处理
   */
  setupNetworkErrorHandling() {
    // 监控网络请求
    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
      const startTime = Date.now();
      try {
        const response = await originalFetch(...args);
        const endTime = Date.now();
        
        this.log({
          level: 'info',
          message: `网络请求: ${args[0]}`,
          data: {
            duration: endTime - startTime,
            status: response.status,
            ok: response.ok
          }
        });
        
        return response;
      } catch (error) {
        this.handleError({
          type: 'network',
          message: `网络请求失败: ${args[0]}`,
          error,
          timestamp: new Date().toISOString()
        });
        throw error;
      }
    };

    // 监控WebSocket连接
    const originalWebSocket = window.WebSocket;
    window.WebSocket = function(url, protocols) {
      const ws = new originalWebSocket(url, protocols);
      
      ws.addEventListener('error', (event) => {
        this.handleError({
          type: 'websocket',
          message: 'WebSocket连接错误',
          error: event,
          timestamp: new Date().toISOString()
        });
      });
      
      ws.addEventListener('close', (event) => {
        this.log({
          level: 'info',
          message: 'WebSocket连接关闭',
          data: {
            code: event.code,
            reason: event.reason,
            wasClean: event.wasClean
          }
        });
      });
      
      return ws;
    };
  }

  /**
   * 设置存储错误处理
   */
  setupStorageErrorHandling() {
    // 监控localStorage
    const originalSetItem = localStorage.setItem;
    localStorage.setItem = function(key, value) {
      try {
        originalSetItem.call(this, key, value);
      } catch (error) {
        this.handleError({
          type: 'storage',
          message: `localStorage写入失败: ${key}`,
          error,
          timestamp: new Date().toISOString()
        });
        throw error;
      }
    };

    // 监控IndexedDB
    if ('indexedDB' in window) {
      const originalOpen = indexedDB.open;
      indexedDB.open = function(name, version) {
        const request = originalOpen.call(this, name, version);
        
        request.onerror = (event) => {
          this.handleError({
            type: 'indexeddb',
            message: `IndexedDB打开失败: ${name}`,
            error: event.target.error,
            timestamp: new Date().toISOString()
          });
        };
        
        return request;
      };
    }
  }

  /**
   * 处理错误
   * @param {Object} error - 错误对象
   */
  handleError(error) {
    this.errorCount++;
    
    // 记录错误
    this.log({
      level: 'error',
      message: error.message,
      data: error
    });
    
    // 检查错误阈值
    if (this.errorCount >= this.config.errorThreshold && this.config.autoReport) {
      this.reportErrors();
    }
    
    // 显示用户友好的错误提示
    this.showErrorMessage(error);
  }

  /**
   * 记录日志
   * @param {Object} log - 日志对象
   */
  log(log) {
    // 检查日志级别
    if (!this.shouldLog(log.level)) return;
    
    // 添加时间戳
    log.timestamp = new Date().toISOString();
    
    // 添加到日志数组
    this.logs.push(log);
    
    // 限制日志数量
    if (this.logs.length > this.config.maxLogs) {
      this.logs.shift();
    }
    
    // 控制台输出
    if (this.config.enableConsole) {
      this.consoleLog(log);
    }
    
    // 远程日志记录
    if (this.config.enableRemoteLogging) {
      this.sendToRemote(log);
    }
  }

  /**
   * 检查是否应该记录日志
   * @param {string} level - 日志级别
   * @returns {boolean} 是否应该记录
   */
  shouldLog(level) {
    const levels = ['debug', 'info', 'warn', 'error'];
    return levels.indexOf(level) >= levels.indexOf(this.config.logLevel);
  }

  /**
   * 控制台输出日志
   * @param {Object} log - 日志对象
   */
  consoleLog(log) {
    const { level, message, data } = log;
    const styles = {
      debug: 'color: #666;',
      info: 'color: #2196F3;',
      warn: 'color: #FF9800;',
      error: 'color: #F44336;'
    };
    
    console.log(
      `%c[${level.toUpperCase()}] ${message}`,
      styles[level],
      data || ''
    );
  }

  /**
   * 发送日志到远程服务器
   * @param {Object} log - 日志对象
   */
  async sendToRemote(log) {
    try {
      await fetch(this.config.remoteEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(log)
      });
    } catch (error) {
      console.error('远程日志记录失败:', error);
    }
  }

  /**
   * 显示用户友好的错误提示
   * @param {Object} error - 错误对象
   */
  showErrorMessage(error) {
    // 创建错误提示元素
    const notification = document.createElement('div');
    notification.className = 'trace-error-notification';
    notification.innerHTML = `
      <div class="error-icon">⚠️</div>
      <div class="error-content">
        <h3>出错了</h3>
        <p>${this.getUserFriendlyMessage(error)}</p>
        <button class="retry-button">重试</button>
      </div>
    `;
    
    // 添加样式
    const style = document.createElement('style');
    style.textContent = `
      .trace-error-notification {
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: white;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        padding: 16px;
        display: flex;
        align-items: flex-start;
        max-width: 400px;
        z-index: 1000;
        animation: slideIn 0.3s ease-out;
      }
      .error-icon {
        font-size: 24px;
        margin-right: 12px;
      }
      .error-content h3 {
        margin: 0 0 8px;
        color: #F44336;
      }
      .error-content p {
        margin: 0 0 12px;
        color: #666;
      }
      .retry-button {
        background: #2196F3;
        color: white;
        border: none;
        padding: 6px 12px;
        border-radius: 4px;
        cursor: pointer;
      }
      @keyframes slideIn {
        from { transform: translateX(100%); }
        to { transform: translateX(0); }
      }
    `;
    document.head.appendChild(style);
    
    // 添加到页面
    document.body.appendChild(notification);
    
    // 处理重试按钮点击
    const retryButton = notification.querySelector('.retry-button');
    retryButton.addEventListener('click', () => {
      this.handleRetry(error);
      notification.remove();
    });
    
    // 自动移除
    setTimeout(() => {
      notification.remove();
    }, 5000);
  }

  /**
   * 获取用户友好的错误消息
   * @param {Object} error - 错误对象
   * @returns {string} 用户友好的消息
   */
  getUserFriendlyMessage(error) {
    const messages = {
      network: '网络连接出现问题，请检查网络设置',
      storage: '数据保存失败，请检查存储空间',
      runtime: '系统运行出错，请刷新页面重试',
      promise: '操作失败，请重试',
      resource: '资源加载失败，请刷新页面',
      websocket: '连接断开，正在尝试重新连接',
      indexeddb: '数据存储失败，请检查浏览器设置'
    };
    
    return messages[error.type] || '发生未知错误，请重试';
  }

  /**
   * 处理重试操作
   * @param {Object} error - 错误对象
   */
  handleRetry(error) {
    switch (error.type) {
      case 'network':
        // 重试网络请求
        if (error.retryCallback) {
          error.retryCallback();
        }
        break;
      case 'storage':
        // 重试存储操作
        if (error.retryCallback) {
          error.retryCallback();
        }
        break;
      case 'websocket':
        // 重新连接WebSocket
        if (error.retryCallback) {
          error.retryCallback();
        }
        break;
      default:
        // 刷新页面
        window.location.reload();
    }
  }

  /**
   * 报告错误
   */
  reportErrors() {
    if (this.logs.length === 0) return;
    
    const errorReport = {
      timestamp: new Date().toISOString(),
      errorCount: this.errorCount,
      logs: this.logs.filter(log => log.level === 'error'),
      userAgent: navigator.userAgent,
      screenResolution: `${window.screen.width}x${window.screen.height}`,
      viewportSize: `${window.innerWidth}x${window.innerHeight}`
    };
    
    // 发送错误报告
    fetch('/api/error-report', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(errorReport)
    }).catch(error => {
      console.error('错误报告发送失败:', error);
    });
    
    // 重置错误计数
    this.errorCount = 0;
  }

  /**
   * 获取日志
   * @returns {Array} 日志数组
   */
  getLogs() {
    return this.logs;
  }

  /**
   * 清除日志
   */
  clearLogs() {
    this.logs = [];
    this.errorCount = 0;
  }

  /**
   * 设置配置
   * @param {Object} config - 配置对象
   */
  setConfig(config) {
    this.config = { ...this.config, ...config };
  }
}

// 创建单例并导出
export const traceErrorHandler = new TraceErrorHandler();

// 在文档加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
  traceErrorHandler.init();
}); 