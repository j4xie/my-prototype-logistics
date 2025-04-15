/**
 * 食品溯源系统 - 错误处理和日志记录模块
 * 版本：1.0.0
 */

class TraceErrorHandler {
  constructor() {
    // 日志配置
    this.config = {
      logLevel: 'debug', // debug, info, warn, error
      logRemote: false,
      logEndpoint: '/api/logs',
      maxLogSize: 500 // 最大日志条数
    };
    
    // 存储日志
    this.logs = [];
    
    // 日志级别映射
    this.logLevelMap = {
      'debug': 0,
      'info': 1,
      'warn': 2,
      'error': 3
    };
  }
  
  /**
   * 初始化错误处理
   * @returns {TraceErrorHandler} 实例
   */
  init() {
    this.setupErrorHandlers();
    this.setupPerformanceMonitoring();
    this.setupNetworkErrorHandling();
    this.setupStorageErrorHandling();
    
    console.log('错误处理模块已初始化');
    return this;
  }
  
  /**
   * 设置全局错误处理
   */
  setupErrorHandlers() {
    // 全局错误处理
    window.addEventListener('error', (event) => {
      const error = {
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        stack: event.error ? event.error.stack : '未知'
      };
      
      this.handleError(error);
      
      // 对于资源加载错误，尝试重新加载
      if (event.target && (event.target.tagName === 'IMG' || 
                          event.target.tagName === 'SCRIPT' || 
                          event.target.tagName === 'LINK')) {
        // 记录资源错误但不进行处理，由traceLoader处理
        this.log({
          level: 'warn',
          message: `资源加载失败: ${event.target.src || event.target.href}`,
          details: { tagName: event.target.tagName }
        });
        
        // 不要显示资源加载错误提示
        return;
      }
      
      // 显示友好的错误信息
      this.showErrorMessage(error);
    }, true);
    
    // 未捕获的Promise异常
    window.addEventListener('unhandledrejection', (event) => {
      const error = {
        message: '未处理的Promise异常',
        reason: event.reason ? (event.reason.message || String(event.reason)) : '未知原因',
        stack: event.reason && event.reason.stack ? event.reason.stack : '未知'
      };
      
      this.handleError(error);
      this.showErrorMessage(error);
    });
    
    // 未返回的fetch处理
    const originalFetch = window.fetch;
    window.fetch = (...args) => {
      return originalFetch(...args).catch(error => {
        this.handleError({
          message: 'Fetch请求失败',
          details: { url: args[0], error: error.message },
          stack: error.stack
        });
        
        this.showErrorMessage({
          message: '网络请求失败',
          details: { url: args[0], error: error.message }
        });
        
        throw error; // 继续抛出错误
      });
    };
  }
  
  /**
   * 设置性能监控
   */
  setupPerformanceMonitoring() {
    if (!window.performance || !window.performance.getEntriesByType) {
      this.log({
        level: 'warn',
        message: 'Performance API不可用，无法进行性能监控'
      });
      return;
    }
    
    // 监控加载时间
    window.addEventListener('load', () => {
      setTimeout(() => {
        const timing = performance.getEntriesByType('navigation')[0];
        if (!timing) return;
        
        const performanceData = {
          domComplete: timing.domComplete,
          domInteractive: timing.domInteractive,
          loadEventEnd: timing.loadEventEnd,
          responseEnd: timing.responseEnd,
          responseStart: timing.responseStart,
          fetchStart: timing.fetchStart
        };
        
        // 记录性能日志
        this.log({
          level: 'info',
          message: '页面加载性能数据',
          details: performanceData
        });
        
        // 响应时间过长警告
        if (timing.responseEnd - timing.fetchStart > 3000) {
          this.log({
            level: 'warn',
            message: '页面响应时间过长',
            details: {
              responseTime: timing.responseEnd - timing.fetchStart + 'ms'
            }
          });
        }
      }, 0);
    });
    
    // 监控长任务
    if (window.PerformanceObserver) {
      try {
        const observer = new PerformanceObserver((list) => {
          list.getEntries().forEach((entry) => {
            this.log({
              level: 'warn',
              message: '检测到长任务',
              details: {
                duration: entry.duration + 'ms',
                name: entry.name,
                startTime: entry.startTime
              }
            });
          });
        });
        
        observer.observe({ entryTypes: ['longtask'] });
      } catch (e) {
        this.log({
          level: 'warn',
          message: 'PerformanceObserver不支持长任务观察',
          details: { error: e.message }
        });
      }
    }
  }
  
  /**
   * 设置网络错误处理
   */
  setupNetworkErrorHandling() {
    // XHR错误处理
    const originalXHROpen = XMLHttpRequest.prototype.open;
    const originalXHRSend = XMLHttpRequest.prototype.send;
    const self = this;
    
    XMLHttpRequest.prototype.open = function(...args) {
      const url = args[1];
      this._traceUrl = url;
      originalXHROpen.apply(this, args);
    };
    
    XMLHttpRequest.prototype.send = function(...args) {
      const xhr = this;
      const url = xhr._traceUrl;
      
      xhr.addEventListener('error', function() {
        const error = {
          message: 'XHR请求失败',
          details: { url, status: xhr.status },
          type: 'network'
        };
        
        self.handleError(error);
        self.showErrorMessage(error);
      });
      
      xhr.addEventListener('timeout', function() {
        const error = {
          message: 'XHR请求超时',
          details: { url, timeout: xhr.timeout },
          type: 'network'
        };
        
        self.handleError(error);
        self.showErrorMessage(error);
      });
      
      // 监控4xx和5xx错误
      xhr.addEventListener('load', function() {
        if (xhr.status >= 400) {
          const error = {
            message: `HTTP错误: ${xhr.status}`,
            details: { url, status: xhr.status, response: xhr.responseText.substring(0, 500) },
            type: 'network'
          };
          
          self.handleError(error);
          self.showErrorMessage(error);
        }
      });
      
      originalXHRSend.apply(xhr, args);
    };
  }
  
  /**
   * 设置存储错误处理
   */
  setupStorageErrorHandling() {
    // LocalStorage错误处理
    const originalSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function(key, value) {
      try {
        originalSetItem.apply(this, arguments);
      } catch (e) {
        const error = {
          message: 'LocalStorage写入失败',
          details: { key, errorMessage: e.message },
          stack: e.stack,
          type: 'storage'
        };
        
        window.traceErrorHandler.handleError(error);
        window.traceErrorHandler.showErrorMessage({
          message: '数据存储失败，可能浏览器存储空间已满',
          type: 'storage'
        });
        
        // 尝试清理旧数据
        try {
          // 移除一些可能的缓存键
          const possibleCacheKeys = ['trace_cache', 'temp_data', 'user_preferences'];
          for (const cacheKey of possibleCacheKeys) {
            if (localStorage.getItem(cacheKey)) {
              localStorage.removeItem(cacheKey);
              break;
            }
          }
          // 再尝试保存
          originalSetItem.apply(this, arguments);
        } catch (retryError) {
          // 如果仍然失败，告知用户清理存储
          window.traceErrorHandler.showErrorMessage({
            message: '数据存储空间已满，请清理浏览器缓存',
            type: 'storage'
          });
        }
      }
    };
  }
  
  /**
   * 处理所有错误
   * @param {Object} error - 错误对象
   */
  handleError(error) {
    // 记录错误日志
    this.log({
      level: 'error',
      message: error.message || '未知错误',
      details: error.details || error,
      stack: error.stack,
      type: error.type || 'javascript'
    });
    
    // 开发环境控制台输出
    if (process.env.NODE_ENV !== 'production') {
      console.error('捕获到错误:', error);
    }
    
    // 上报错误（防抖动）
    this.reportErrors();
  }
  
  /**
   * 添加日志
   * @param {Object} log - 日志对象
   */
  log(log) {
    if (!log) return;
    
    // 确保log是对象
    if (typeof log === 'string') {
      log = { message: log, level: 'info' };
    }
    
    // 确保有日志级别
    if (!log.level) {
      log.level = 'info';
    }
    
    // 检查是否应该记录此级别
    if (!this.shouldLog(log.level)) return;
    
    // 添加时间戳
    const logEntry = {
      ...log,
      timestamp: new Date().toISOString()
    };
    
    // 添加到日志数组
    this.logs.push(logEntry);
    
    // 如果超出最大日志数量，移除最早的日志
    if (this.logs.length > this.config.maxLogSize) {
      this.logs.shift();
    }
    
    // 控制台输出
    this.consoleLog(logEntry);
  }
  
  /**
   * 检查是否应该记录此级别的日志
   * @param {string} level - 日志级别
   * @returns {boolean} 是否记录
   */
  shouldLog(level) {
    const configLevel = this.logLevelMap[this.config.logLevel] || 0;
    const messageLevel = this.logLevelMap[level] || 0;
    
    return messageLevel >= configLevel;
  }
  
  /**
   * 控制台输出日志
   * @param {Object} log - 日志对象
   */
  consoleLog(log) {
    if (!log) return;
    
    const timestamp = new Date(log.timestamp).toLocaleTimeString();
    const prefix = `[${timestamp}] [${log.level.toUpperCase()}]`;
    
    switch (log.level) {
      case 'debug':
        console.debug(prefix, log.message, log.details || '');
        break;
      case 'info':
        console.info(prefix, log.message, log.details || '');
        break;
      case 'warn':
        console.warn(prefix, log.message, log.details || '');
        break;
      case 'error':
        console.error(prefix, log.message, log.details || '');
        if (log.stack) console.error(log.stack);
        break;
      default:
        console.log(prefix, log.message, log.details || '');
    }
  }
  
  /**
   * 发送日志到远程服务器
   * @param {Object} log - 日志对象
   */
  async sendToRemote(log) {
    if (!this.config.logRemote || !this.config.logEndpoint) return;
    
    try {
      const response = await fetch(this.config.logEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ...log,
          userAgent: navigator.userAgent,
          url: window.location.href
        })
      });
      
      if (!response.ok) {
        console.error('日志上传失败:', response.status, response.statusText);
      }
    } catch (error) {
      console.error('日志上传异常:', error);
    }
  }
  
  /**
   * 显示错误消息
   * @param {Object} error - 错误对象
   */
  showErrorMessage(error) {
    if (!error) return;
    
    // 获取用户友好的错误消息
    const { message, type } = this.getUserFriendlyMessage(error);
    
    // 如果有traceUI可用，使用其toast功能
    if (window.traceUI && window.traceUI.showToast) {
      // 创建带有重试选项的UI
      if (type === 'network' || type === 'resource') {
        // 为网络和资源错误创建带有重试按钮的提示
        const toast = document.createElement('div');
        toast.className = 'trace-toast error-toast';
        
        toast.innerHTML = `
          <div class="flex items-center bg-red-50 text-red-800 px-4 py-3 rounded shadow-lg">
            <div class="mr-3">
              <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"></path>
              </svg>
            </div>
            <div class="flex-1">${message}</div>
            <button class="ml-3 px-2 py-1 bg-red-100 hover:bg-red-200 text-red-800 text-xs rounded retry-button">
              重试
            </button>
          </div>
        `;
        
        // 添加样式
        const style = document.createElement('style');
        style.textContent = `
          .trace-toast {
            position: fixed;
            bottom: 20px;
            left: 50%;
            transform: translateX(-50%);
            z-index: 9999;
            animation: fadeInUp 0.3s ease forwards;
          }
          .error-toast {
            max-width: 90%;
            width: 320px;
          }
          @keyframes fadeInUp {
            from {
              opacity: 0;
              transform: translate(-50%, 20px);
            }
            to {
              opacity: 1;
              transform: translate(-50%, 0);
            }
          }
        `;
        document.head.appendChild(style);
        
        // 添加到页面
        document.body.appendChild(toast);
        
        // 绑定重试按钮事件
        const retryButton = toast.querySelector('.retry-button');
        retryButton.addEventListener('click', () => {
          document.body.removeChild(toast);
          this.handleRetry(error);
        });
        
        // 自动移除
        setTimeout(() => {
          if (document.body.contains(toast)) {
            toast.style.opacity = '0';
            toast.style.transition = 'opacity 0.3s ease';
            
            setTimeout(() => {
              if (document.body.contains(toast)) {
                document.body.removeChild(toast);
              }
            }, 300);
          }
        }, 5000);
      } else {
        // 普通错误使用标准toast
        window.traceUI.showToast(message, 'error', 5000);
      }
    } else {
      // 降级到alert
      alert(message);
    }
  }
  
  /**
   * 获取用户友好的错误消息
   * @param {Object} error - 错误对象
   * @returns {Object} 用户友好的错误消息
   */
  getUserFriendlyMessage(error) {
    // 默认错误消息
    let message = '操作出现了问题';
    let type = error.type || 'javascript';
    
    if (error.message) {
      if (error.message.includes('NetworkError') || 
          error.message.includes('网络') || 
          error.message.includes('XHR') || 
          error.message.includes('Fetch')) {
        message = '网络连接异常，请检查您的网络';
        type = 'network';
      } else if (error.message.includes('资源') || error.message.includes('image') || error.message.includes('script')) {
        message = '资源加载失败，请刷新页面';
        type = 'resource';
      } else if (error.message.includes('存储') || error.message.includes('Storage')) {
        message = '数据存储失败，可能浏览器存储空间已满';
        type = 'storage';
      } else {
        // 普通JavaScript错误，使用原始消息
        message = error.message;
      }
    }
    
    return { message, type };
  }
  
  /**
   * 处理重试逻辑
   * @param {Object} error - 错误对象
   */
  handleRetry(error) {
    const type = error.type || 'javascript';
    
    switch (type) {
      case 'network':
        // 对于网络错误，刷新当前页面
        if (error.details && error.details.url) {
          // 如果是API请求，可以尝试重新发起请求
          if (window.traceUI && window.traceUI.showToast) {
            window.traceUI.showToast('正在重新请求...', 'info');
          }
          
          // 这里可以添加重试逻辑
          setTimeout(() => {
            window.location.reload();
          }, 1000);
        } else {
          // 普通网络错误，刷新页面
          window.location.reload();
        }
        break;
        
      case 'resource':
        // 对于资源加载错误，重新加载资源
        if (error.details && (error.details.src || error.details.href)) {
          // 如果是具体资源，重新加载该资源
          const resourceUrl = error.details.src || error.details.href;
          
          if (window.traceLoader && window.traceLoader.preloadImage) {
            window.traceLoader.preloadImage(resourceUrl)
              .then(() => {
                if (window.traceUI && window.traceUI.showToast) {
                  window.traceUI.showToast('资源已重新加载', 'success');
                }
              })
              .catch(() => {
                if (window.traceUI && window.traceUI.showToast) {
                  window.traceUI.showToast('资源加载仍然失败', 'error');
                }
              });
          } else {
            // 无法重新加载特定资源，刷新页面
            window.location.reload();
          }
        } else {
          // 不明确的资源错误，刷新页面
          window.location.reload();
        }
        break;
        
      default:
        // 对于其他类型的错误，刷新页面
        window.location.reload();
    }
  }
  
  /**
   * 上报错误（带防抖）
   */
  reportErrors() {
    // 防抖动：300ms内最多上报一次
    if (this._reportDebounce) {
      clearTimeout(this._reportDebounce);
    }
    
    this._reportDebounce = setTimeout(() => {
      // 获取最近的错误日志
      const errorLogs = this.logs
        .filter(log => log.level === 'error')
        .slice(-10); // 最近10条
      
      if (errorLogs.length === 0) return;
      
      // 上报错误日志
      if (this.config.logRemote) {
        // 批量上报
        this.sendToRemote({
          level: 'error',
          message: '批量错误上报',
          details: {
            errorCount: errorLogs.length,
            errors: errorLogs
          },
          userAgent: navigator.userAgent,
          url: window.location.href
        });
      }
    }, 300);
  }
  
  /**
   * 获取所有日志
   * @returns {Array} 所有日志
   */
  getLogs() {
    return [...this.logs];
  }
  
  /**
   * 清空日志
   */
  clearLogs() {
    this.logs = [];
    this.log({
      level: 'info',
      message: '日志已清空'
    });
  }
  
  /**
   * 设置配置项
   * @param {Object} config - 配置对象
   */
  setConfig(config) {
    this.config = {
      ...this.config,
      ...config
    };
    
    this.log({
      level: 'info',
      message: '错误处理配置已更新',
      details: this.config
    });
  }
}

// 创建全局实例
window.traceErrorHandler = new TraceErrorHandler().init();

// 导出模块
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { traceErrorHandler: window.traceErrorHandler };
} 