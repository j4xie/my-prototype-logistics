/**
 * @module tracePerformance
 * @description 食品溯源系统 - 性能监控与优化组件
 * @version 1.0.0
 * @author 食品溯源系统开发团队
 */

// 性能指标阈值配置
const performanceThresholds = {
  pageLoad: 2000,        // 页面加载时间阈值（毫秒）
  serverResponse: 500,   // 服务器响应时间阈值（毫秒）
  resourceCount: 30,     // 资源数量阈值
  memoryUsage: 50,       // 内存使用百分比阈值
  longTasks: 50,         // 长任务阈值（毫秒）
  firstContentfulPaint: 1000 // 首次内容绘制时间阈值（毫秒）
};

// 性能日志
const performanceLogs = [];

// 日志级别
const LOG_LEVELS = {
  INFO: 'info',
  WARNING: 'warning',
  ERROR: 'error',
  DEBUG: 'debug'
};

/**
 * 性能监控模块
 */
const tracePerformance = {
  /**
   * 初始化性能监控
   * @param {Object} options - 配置选项
   * @param {boolean} options.autoMonitor - 是否自动监控性能
   * @param {boolean} options.reportToServer - 是否向服务器报告性能指标
   * @param {string} options.reportEndpoint - 性能报告服务端点
   * @param {Object} options.customThresholds - 自定义性能阈值
   */
  init(options = {}) {
    // 合并配置
    this.config = {
      autoMonitor: true,
      reportToServer: false,
      reportEndpoint: '/api/performance/report',
      reportInterval: 60000, // 1分钟
      ...options
    };
    
    // 合并自定义阈值
    if (options.customThresholds) {
      Object.assign(performanceThresholds, options.customThresholds);
    }
    
    // 初始化性能观察器
    this.initPerformanceObservers();
    
    // 添加性能事件监听器
    this.addPerformanceListeners();
    
    // 启动自动监控
    if (this.config.autoMonitor) {
      this.startAutoMonitoring();
    }
    
    // 注册解析性能标记的函数
    window.getTracePerformanceMarks = this.getPerformanceMarks.bind(this);
    
    // 加载历史日志
    this.loadLogsFromStorage();
    
    return true;
  },
  
  /**
   * 初始化性能观察器
   */
  initPerformanceObservers() {
    // 观察长任务
    if (window.PerformanceObserver && window.PerformanceLongTaskTiming) {
      try {
        const longTaskObserver = new PerformanceObserver(entries => {
          entries.getEntries().forEach(entry => {
            const taskDuration = entry.duration;
            if (taskDuration > performanceThresholds.longTasks) {
              this.log(
                LOG_LEVELS.WARNING,
                `检测到长任务: ${Math.round(taskDuration)}ms`,
                { taskDuration, threshold: performanceThresholds.longTasks }
              );
            }
          });
        });
        
        longTaskObserver.observe({ entryTypes: ['longtask'] });
        
      } catch (error) {
        this.log(LOG_LEVELS.ERROR, '无法初始化长任务观察器', { error: error.message });
      }
    }
    
    // 观察资源加载
    if (window.PerformanceObserver && window.PerformanceResourceTiming) {
      try {
        const resourceObserver = new PerformanceObserver(entries => {
          entries.getEntries().forEach(entry => {
            if (entry.duration > performanceThresholds.serverResponse) {
              this.log(
                LOG_LEVELS.WARNING,
                `资源加载过慢: ${entry.name}`,
                { 
                  resource: entry.name,
                  duration: entry.duration,
                  threshold: performanceThresholds.serverResponse
                }
              );
            }
          });
        });
        
        resourceObserver.observe({ entryTypes: ['resource'] });
        
      } catch (error) {
        this.log(LOG_LEVELS.ERROR, '无法初始化资源观察器', { error: error.message });
      }
    }
    
    // 观察绘制性能
    if (window.PerformanceObserver && window.PerformancePaintTiming) {
      try {
        const paintObserver = new PerformanceObserver(entries => {
          entries.getEntries().forEach(entry => {
            if (entry.name === 'first-contentful-paint') {
              const paintTime = entry.startTime;
              
              this.log(
                LOG_LEVELS.INFO,
                `首次内容绘制: ${Math.round(paintTime)}ms`,
                { paintTime }
              );
              
              if (paintTime > performanceThresholds.firstContentfulPaint) {
                this.log(
                  LOG_LEVELS.WARNING,
                  `首次内容绘制过慢: ${Math.round(paintTime)}ms`,
                  { 
                    paintTime,
                    threshold: performanceThresholds.firstContentfulPaint
                  }
                );
                    }
                }
            });
        });
        
            paintObserver.observe({ entryTypes: ['paint'] });
            
      } catch (error) {
        this.log(LOG_LEVELS.ERROR, '无法初始化绘制观察器', { error: error.message });
      }
    }
  },
  
  /**
   * 添加性能事件监听器
   */
  addPerformanceListeners() {
    // 页面加载完成事件
    window.addEventListener('load', () => {
      setTimeout(() => {
        this.measurePagePerformance();
      }, 0);
    });
    
    // 页面可见性变化事件
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        this.markPerformance('page_visible');
      }
    });
    
    // 页面卸载前保存日志
    window.addEventListener('beforeunload', () => {
      this.saveLogsToStorage();
    });
  },
  
  /**
   * 开始自动监控
   */
  startAutoMonitoring() {
    // 定期检查性能
    this.monitoringInterval = setInterval(() => {
      this.checkMemoryUsage();
      this.checkResourceUsage();
      
      // 定期报告性能指标
      if (this.config.reportToServer) {
        this.reportPerformanceToServer();
      }
    }, this.config.reportInterval);
    
    // 标记监控开始
    this.markPerformance('monitoring_started');
    
    this.log(LOG_LEVELS.INFO, '性能监控已启动');
  },
  
  /**
   * 停止自动监控
   */
  stopAutoMonitoring() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
      
      // 标记监控停止
      this.markPerformance('monitoring_stopped');
      
      this.log(LOG_LEVELS.INFO, '性能监控已停止');
    }
  },
  
  /**
   * 测量页面性能
   */
  measurePagePerformance() {
    if (!window.performance || !window.performance.timing) {
      this.log(LOG_LEVELS.ERROR, '浏览器不支持性能API');
      return;
    }
    
    const timing = window.performance.timing;
    
    // 计算性能指标
    const pageLoadTime = timing.loadEventEnd - timing.navigationStart;
    const domReadyTime = timing.domComplete - timing.domLoading;
    const serverResponseTime = timing.responseEnd - timing.requestStart;
    
    // 记录性能指标
    this.log(
      LOG_LEVELS.INFO,
      `页面加载性能指标`,
      {
        pageLoadTime,
        domReadyTime,
        serverResponseTime
      }
    );
    
    // 检查是否超过阈值
    if (pageLoadTime > performanceThresholds.pageLoad) {
      this.log(
        LOG_LEVELS.WARNING,
        `页面加载时间过长: ${pageLoadTime}ms`,
        { 
          metric: 'pageLoadTime',
          value: pageLoadTime,
          threshold: performanceThresholds.pageLoad
        }
      );
    }
    
    if (serverResponseTime > performanceThresholds.serverResponse) {
      this.log(
        LOG_LEVELS.WARNING,
        `服务器响应时间过长: ${serverResponseTime}ms`,
        { 
          metric: 'serverResponseTime',
          value: serverResponseTime,
          threshold: performanceThresholds.serverResponse
        }
      );
    }
    
    // 返回测量结果
    return {
      pageLoadTime,
      domReadyTime,
      serverResponseTime
    };
  },
  
  /**
   * 检查内存使用情况
   */
  checkMemoryUsage() {
    if (!window.performance || !window.performance.memory) {
      return;
    }
    
    const memory = window.performance.memory;
    const memoryUsage = (memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100;
    
    if (memoryUsage > performanceThresholds.memoryUsage) {
      this.log(
        LOG_LEVELS.WARNING,
        `内存使用率过高: ${Math.round(memoryUsage)}%`,
        { 
          memoryUsage,
          usedJSHeapSize: memory.usedJSHeapSize,
          jsHeapSizeLimit: memory.jsHeapSizeLimit,
          threshold: performanceThresholds.memoryUsage
        }
      );
    }
  },
  
  /**
   * 检查资源使用情况
   */
  checkResourceUsage() {
    if (!window.performance || !window.performance.getEntriesByType) {
      return;
    }
    
    const resources = window.performance.getEntriesByType('resource');
    
    if (resources.length > performanceThresholds.resourceCount) {
      this.log(
        LOG_LEVELS.WARNING,
        `资源数量过多: ${resources.length}`,
        { 
          resourceCount: resources.length,
          threshold: performanceThresholds.resourceCount
        }
      );
    }
    
    // 分析资源加载情况
    const slowResources = resources.filter(res => res.duration > performanceThresholds.serverResponse);
    
    if (slowResources.length > 0) {
      this.log(
        LOG_LEVELS.INFO,
        `检测到 ${slowResources.length} 个慢资源`,
        { 
          slowResourcesCount: slowResources.length,
          slowResources: slowResources.map(res => ({
            name: res.name,
            duration: res.duration
          }))
        }
      );
    }
  },
  
  /**
   * 标记性能时间点
   * @param {string} markName - 标记名称
   * @param {Object} [data] - 附加数据
   */
  markPerformance(markName, data = {}) {
    if (!window.performance || !window.performance.mark) {
      return;
    }
    
    const fullMarkName = `trace-${markName}`;
    
    try {
      // 创建性能标记
      window.performance.mark(fullMarkName);
      
      // 使用自定义数据扩展标记
      const existingMarks = window.performance.getEntriesByName(fullMarkName);
      if (existingMarks.length > 0) {
        const mark = existingMarks[0];
        mark.customData = data;
      }
      
      this.log(
        LOG_LEVELS.DEBUG,
        `已创建性能标记: ${markName}`,
        { markName, timestamp: Date.now(), data }
      );
    } catch (error) {
      this.log(LOG_LEVELS.ERROR, `创建性能标记失败: ${error.message}`);
    }
  },
  
  /**
   * 测量两个标记之间的性能
   * @param {string} measureName - 测量名称
   * @param {string} startMark - 开始标记
   * @param {string} endMark - 结束标记
   * @returns {number|null} 测量结果（毫秒）
   */
  measurePerformance(measureName, startMark, endMark) {
    if (!window.performance || !window.performance.measure) {
      return null;
    }
    
    try {
      // 添加前缀
      const fullStartMark = startMark.startsWith('trace-') ? startMark : `trace-${startMark}`;
      const fullEndMark = endMark.startsWith('trace-') ? endMark : `trace-${endMark}`;
      const fullMeasureName = `trace-measure-${measureName}`;
      
      // 创建测量
      window.performance.measure(fullMeasureName, fullStartMark, fullEndMark);
      
      // 获取测量结果
      const measures = window.performance.getEntriesByName(fullMeasureName);
      if (measures.length > 0) {
        const duration = measures[0].duration;
        
        this.log(
          LOG_LEVELS.INFO,
          `性能测量: ${measureName}`,
          { measureName, duration, startMark, endMark }
        );
        
        return duration;
      }
    } catch (error) {
      this.log(LOG_LEVELS.ERROR, `性能测量失败: ${error.message}`);
    }
    
    return null;
  },
  
  /**
   * 获取性能标记
   * @returns {Array} 性能标记数组
   */
  getPerformanceMarks() {
    if (!window.performance || !window.performance.getEntriesByType) {
      return [];
    }
    
    return window.performance.getEntriesByType('mark')
      .filter(mark => mark.name.startsWith('trace-'))
      .map(mark => ({
        name: mark.name.replace('trace-', ''),
        startTime: mark.startTime,
        customData: mark.customData || {}
      }));
  },
  
  /**
   * 向服务器报告性能指标
   */
  reportPerformanceToServer() {
    if (!this.config.reportToServer || !this.config.reportEndpoint) {
      return;
    }
    
    // 收集要报告的性能指标
    const reportData = {
      timestamp: Date.now(),
      url: window.location.href,
      performance: {
        timing: window.performance && window.performance.timing ? 
          this.measurePagePerformance() : null,
        memory: window.performance && window.performance.memory ? {
          usedJSHeapSize: window.performance.memory.usedJSHeapSize,
          totalJSHeapSize: window.performance.memory.totalJSHeapSize,
          jsHeapSizeLimit: window.performance.memory.jsHeapSizeLimit
        } : null,
        navigation: window.performance && window.performance.navigation ? {
          type: window.performance.navigation.type,
          redirectCount: window.performance.navigation.redirectCount
        } : null
      },
      resourceCount: window.performance && window.performance.getEntriesByType ? 
        window.performance.getEntriesByType('resource').length : 0,
      marks: this.getPerformanceMarks(),
      logs: performanceLogs.slice(-20) // 只发送最近的20条日志
    };
    
    // 发送数据
    try {
      fetch(this.config.reportEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(reportData),
        // 使用keepalive确保数据在页面关闭后仍能发送
        keepalive: true
      }).then(response => {
        if (!response.ok) {
          this.log(LOG_LEVELS.ERROR, `性能数据上报失败: ${response.status}`, { status: response.status });
        }
      }).catch(error => {
        this.log(LOG_LEVELS.ERROR, `性能数据上报错误: ${error.message}`, { error: error.message });
      });
    } catch (error) {
      this.log(LOG_LEVELS.ERROR, `性能数据上报异常: ${error.message}`, { error: error.message });
    }
  },
  
  /**
   * 记录性能日志
   * @param {string} level - 日志级别
   * @param {string} message - 日志消息
   * @param {Object} [data] - 附加数据
   */
  log(level, message, data = {}) {
    const logEntry = {
      timestamp: Date.now(),
      level,
      message,
      data,
      url: window.location.href
    };
    
    // 添加到日志数组
    performanceLogs.push(logEntry);
    
    // 限制日志数量，防止内存泄漏
    if (performanceLogs.length > 1000) {
      performanceLogs.shift();
    }
    
    // 输出控制台日志（仅在开发模式下）
    if (process.env.NODE_ENV === 'development') {
      const consoleMethod = level === LOG_LEVELS.ERROR ? 'error' :
                            level === LOG_LEVELS.WARNING ? 'warn' :
                            level === LOG_LEVELS.DEBUG ? 'debug' : 'log';
      
      console[consoleMethod](`[性能监控] ${message}`, data);
    }
  },
  
  /**
   * 保存日志到本地存储
   */
  saveLogsToStorage() {
    try {
      // 只保存警告和错误日志
      const logsToSave = performanceLogs.filter(log => 
        log.level === LOG_LEVELS.WARNING || log.level === LOG_LEVELS.ERROR
      );
      
      // 限制保存的日志数量
      const trimmedLogs = logsToSave.slice(-100);
      
      localStorage.setItem('trace-performance-logs', JSON.stringify(trimmedLogs));
        } catch (error) {
      console.error('无法保存性能日志到本地存储:', error);
    }
  },
  
  /**
   * 从本地存储加载日志
   */
  loadLogsFromStorage() {
    try {
      const savedLogs = localStorage.getItem('trace-performance-logs');
      if (savedLogs) {
        const parsedLogs = JSON.parse(savedLogs);
        
        // 将保存的日志添加到当前日志中
        performanceLogs.push(...parsedLogs);
        
        this.log(LOG_LEVELS.INFO, `已从本地存储加载 ${parsedLogs.length} 条日志记录`);
      }
        } catch (error) {
      this.log(LOG_LEVELS.ERROR, '无法从本地存储加载性能日志', { error: error.message });
    }
  },
  
  /**
   * 获取性能优化建议
   * @returns {Array<Object>} 优化建议数组
   */
  getPerformanceRecommendations() {
    const recommendations = [];
    
    // 分析日志以生成建议
    const warnings = performanceLogs.filter(log => log.level === LOG_LEVELS.WARNING);
    
    // 检查页面加载时间
    const pageLoadWarnings = warnings.filter(log => log.data && log.data.metric === 'pageLoadTime');
    if (pageLoadWarnings.length > 0) {
      recommendations.push({
        id: 'page-load-time',
        title: '优化页面加载时间',
        description: '页面加载时间过长，可能影响用户体验',
        impact: 'high',
        suggestions: [
          '减少初始HTML的大小',
          '延迟加载非关键资源',
          '优化关键渲染路径',
          '使用资源预加载和预连接'
        ]
      });
    }
    
    // 检查服务器响应时间
    const serverResponseWarnings = warnings.filter(log => log.data && log.data.metric === 'serverResponseTime');
    if (serverResponseWarnings.length > 0) {
      recommendations.push({
        id: 'server-response-time',
        title: '优化服务器响应时间',
        description: '服务器响应时间过长，可能导致页面加载延迟',
        impact: 'high',
        suggestions: [
          '优化服务器处理逻辑',
          '使用缓存减少数据库查询',
          '启用服务器端压缩',
          '考虑使用CDN分发内容'
        ]
      });
    }
    
    // 检查内存使用
    const memoryWarnings = warnings.filter(log => log.message && log.message.includes('内存使用率过高'));
    if (memoryWarnings.length > 0) {
      recommendations.push({
        id: 'memory-usage',
        title: '优化内存使用',
        description: '检测到内存使用率过高，可能导致性能下降或崩溃',
        impact: 'medium',
        suggestions: [
          '检查内存泄漏问题',
          '优化大型数据结构的使用',
          '实现数据分页或虚拟滚动',
          '定期清理不必要的缓存和引用'
        ]
      });
    }
    
    // 检查资源加载情况
    const resourceWarnings = warnings.filter(log => log.message && log.message.includes('资源加载过慢'));
    if (resourceWarnings.length > 0) {
      recommendations.push({
        id: 'resource-loading',
        title: '优化资源加载',
        description: '多个资源加载缓慢，影响页面性能',
        impact: 'medium',
        suggestions: [
          '优化图片大小和格式',
          '合并和压缩CSS/JavaScript文件',
          '使用适当的缓存策略',
          '考虑使用更快的CDN'
        ]
      });
    }
    
    return recommendations;
  },
  
  /**
   * 清理性能数据
   */
  clearPerformanceData() {
    // 清理性能测量
    if (window.performance && window.performance.clearMarks) {
      window.performance.getEntriesByType('mark')
        .filter(mark => mark.name.startsWith('trace-'))
        .forEach(mark => {
          window.performance.clearMarks(mark.name);
        });
    }
    
    if (window.performance && window.performance.clearMeasures) {
      window.performance.getEntriesByType('measure')
        .filter(measure => measure.name.startsWith('trace-measure-'))
        .forEach(measure => {
          window.performance.clearMeasures(measure.name);
        });
    }
    
    // 清理日志
    performanceLogs.length = 0;
    
    // 清理本地存储
    try {
      localStorage.removeItem('trace-performance-logs');
    } catch (error) {
      console.error('无法清除本地存储的性能日志:', error);
    }
    
    this.log(LOG_LEVELS.INFO, '性能数据已清理');
  }
};

// 导出模块
window.tracePerformance = tracePerformance;

// 如果定义了模块系统，也通过模块系统导出
if (typeof module !== 'undefined' && module.exports) {
  module.exports = tracePerformance;
} else if (typeof define === 'function' && define.amd) {
  define([], function() { return tracePerformance; });
} 
const TracePerformance = (function() {
    // 配置
    const config = {
        enabled: true,
        lazyLoadEnabled: true,
        resourcePrefetchEnabled: true,
        monitoringEnabled: true,
        cacheEnabled: true,
        compressionEnabled: true,
        cacheExpiry: 86400000, // 24小时（毫秒）
        metricsEndpoint: null, // 实际项目中设置性能监控数据上报地址
        imageQuality: 80, // 图片优化质量（百分比）
        lowBandwidthThreshold: 200 // 低带宽阈值（KB/s）
    };
    
    // 性能指标
    let performanceMetrics = {
        pageLoaded: false,
        timeToFirstByte: 0,
        domContentLoaded: 0,
        fullLoadTime: 0,
        firstPaint: 0,
        firstContentfulPaint: 0,
        largestContentfulPaint: 0,
        firstInputDelay: 0,
        cumulativeLayoutShift: 0,
        resourceCount: 0,
        resourceSize: 0,
        memoryUsage: null,
        networkType: 'unknown',
        effectiveConnectionType: 'unknown',
        deviceMemory: 0,
        hardwareConcurrency: 0,
        batteryLevel: null,
        timestamp: Date.now()
    };
    
    // 连接信息
    let connectionInfo = {
        downlink: 0,        // 以Mbps为单位的下行带宽
        effectiveType: '4g', // 有效连接类型: 4g, 3g, 2g, slow-2g
        rtt: 0,             // 往返时间（毫秒）
        saveData: false      // 用户启用了数据保存模式
    };
    
    // 资源加载队列
    const resourceQueue = [];
    
    // 资源缓存
    const resourceCache = {};
    
    // 初始化性能监控
    function init() {
        if (!config.enabled) return false;
        
        // 测量导航和初始加载性能
        measureNavigationPerformance();
        
        // 设置观察者
        if (config.monitoringEnabled) {
            setupPerformanceObservers();
        }
        
        // 获取网络连接信息
        updateConnectionInfo();
        
        // 设置网络变化监听
        if ('connection' in navigator) {
            navigator.connection.addEventListener('change', updateConnectionInfo);
        }
        
        // 初始化电池信息（如果支持）
        if ('getBattery' in navigator) {
            navigator.getBattery().then(battery => {
                performanceMetrics.batteryLevel = battery.level;
                
                battery.addEventListener('levelchange', () => {
                    performanceMetrics.batteryLevel = battery.level;
                    
                    // 如果电池电量低，进入省电模式
                    if (battery.level < 0.15) {
                        enterLowPowerMode();
                    }
                });
            });
        }
        
        // 设置页面可见性监听
        document.addEventListener('visibilitychange', function() {
            if (document.visibilityState === 'hidden') {
                // 页面不可见时，暂停非必要操作
                pauseNonEssentialOperations();
            } else {
                // 页面可见时，恢复操作
                resumeOperations();
            }
        });
        
        // 页面加载完成事件
        window.addEventListener('load', function() {
            performanceMetrics.pageLoaded = true;
            performanceMetrics.fullLoadTime = performance.now();
            
            // 收集资源信息
            collectResourceMetrics();
            
            // 如果启用了资源预加载，执行预加载
            if (config.resourcePrefetchEnabled) {
                prefetchResources();
            }
            
            // 延迟上报性能数据，确保所有指标都已收集
            setTimeout(reportPerformanceMetrics, 2000);
        });
        
        // 监听设备内存变化（如果支持）
        if ('deviceMemory' in navigator) {
            performanceMetrics.deviceMemory = navigator.deviceMemory;
        }
        
        // 获取硬件并发数
        if ('hardwareConcurrency' in navigator) {
            performanceMetrics.hardwareConcurrency = navigator.hardwareConcurrency;
        }
        
        return true;
    }
    
    // 测量导航和初始加载性能
    function measureNavigationPerformance() {
        if (!performance || !performance.timing) return;
        
        const timing = performance.timing;
        
        // 计算关键性能指标
        performanceMetrics.timeToFirstByte = timing.responseStart - timing.navigationStart;
        performanceMetrics.domContentLoaded = timing.domContentLoadedEventEnd - timing.navigationStart;
        
        // 如果加载已完成，记录完整加载时间
        if (timing.loadEventEnd > 0) {
            performanceMetrics.fullLoadTime = timing.loadEventEnd - timing.navigationStart;
        }
    }
    
    // 设置性能观察者
    function setupPerformanceObservers() {
        // 检查性能观察者API支持
        if (!('PerformanceObserver' in window)) return;
        
        try {
            // 观察绘制（Paint）时间
            const paintObserver = new PerformanceObserver((entryList) => {
                for (const entry of entryList.getEntries()) {
                    if (entry.name === 'first-paint') {
                        performanceMetrics.firstPaint = entry.startTime;
                    } else if (entry.name === 'first-contentful-paint') {
                        performanceMetrics.firstContentfulPaint = entry.startTime;
                    }
                }
            });
            paintObserver.observe({ entryTypes: ['paint'] });
            
            // 观察Largest Contentful Paint
            if ('LargestContentfulPaint' in window) {
                const lcpObserver = new PerformanceObserver((entryList) => {
                    const entries = entryList.getEntries();
                    const lastEntry = entries[entries.length - 1];
                    performanceMetrics.largestContentfulPaint = lastEntry.startTime;
                });
                lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });
            }
            
            // 观察First Input Delay
            if ('PerformanceEventTiming' in window) {
                const fidObserver = new PerformanceObserver((entryList) => {
                    const firstInput = entryList.getEntries()[0];
                    if (firstInput) {
                        performanceMetrics.firstInputDelay = firstInput.processingStart - firstInput.startTime;
                    }
                });
                fidObserver.observe({ type: 'first-input', buffered: true });
            }
            
            // 观察Cumulative Layout Shift
            if ('LayoutShift' in window) {
                let cumulativeLayoutShift = 0;
                const clsObserver = new PerformanceObserver((entryList) => {
                    for (const entry of entryList.getEntries()) {
                        if (!entry.hadRecentInput) {
                            cumulativeLayoutShift += entry.value;
                            performanceMetrics.cumulativeLayoutShift = cumulativeLayoutShift;
                        }
                    }
                });
                clsObserver.observe({ entryTypes: ['layout-shift'] });
            }
            
            // 观察资源加载性能
            const resourceObserver = new PerformanceObserver((entryList) => {
                for (const entry of entryList.getEntries()) {
                    // 排除XHR和其他非资源加载
                    if (entry.initiatorType && ['img', 'script', 'css', 'link'].includes(entry.initiatorType)) {
                        performanceMetrics.resourceCount++;
                        performanceMetrics.resourceSize += entry.transferSize || 0;
                    }
                }
            });
            resourceObserver.observe({ entryTypes: ['resource'] });
            
            // 观察长任务
            if ('TaskAttributionTiming' in window) {
                const longTaskObserver = new PerformanceObserver((entryList) => {
                    for (const entry of entryList.getEntries()) {
                        // 记录长任务（超过50ms的任务）
                        console.warn(`检测到长任务: ${entry.duration}ms`, entry);
                    }
                });
                longTaskObserver.observe({ entryTypes: ['longtask'] });
            }
            
        } catch (e) {
            console.error('性能观察者设置失败:', e);
        }
    }
    
    // 更新连接信息
    function updateConnectionInfo() {
        const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
        
        if (connection) {
            connectionInfo = {
                downlink: connection.downlink || 0,
                effectiveType: connection.effectiveType || '4g',
                rtt: connection.rtt || 0,
                saveData: connection.saveData || false
            };
            
            performanceMetrics.networkType = connection.type || 'unknown';
            performanceMetrics.effectiveConnectionType = connection.effectiveType || 'unknown';
            
            // 如果连接条件差，调整优化策略
            adjustForNetworkConditions();
        }
    }
    
    // 根据网络条件调整优化策略
    function adjustForNetworkConditions() {
        // 如果是低带宽连接
        if (connectionInfo.downlink < 0.5 || connectionInfo.effectiveType === 'slow-2g' || connectionInfo.effectiveType === '2g') {
            // 降低图片质量
            config.imageQuality = 60;
            
            // 禁用预加载
            config.resourcePrefetchEnabled = false;
            
            // 减少并发请求
            config.maxConcurrentRequests = 2;
            
            // 如果启用了数据保存模式
            if (connectionInfo.saveData) {
                // 进一步优化
                config.imageQuality = 40;
                disableNonEssentialFeatures();
            }
        } else {
            // 恢复默认设置
            config.imageQuality = 80;
            config.resourcePrefetchEnabled = true;
            config.maxConcurrentRequests = 6;
        }
    }
    
    // 禁用非必要功能
    function disableNonEssentialFeatures() {
        // 禁用动画
        document.body.classList.add('reduce-motion');
        
        // 禁用自动播放视频
        document.querySelectorAll('video[autoplay]').forEach(video => {
            video.removeAttribute('autoplay');
            video.pause();
        });
        
        // 禁用非必要的背景图
        document.querySelectorAll('.bg-image:not(.essential)').forEach(el => {
            el.style.backgroundImage = 'none';
        });
    }
    
    // 收集资源指标
    function collectResourceMetrics() {
        if (!performance || !performance.getEntriesByType) return;
        
        const resources = performance.getEntriesByType('resource');
        let totalSize = 0;
        let count = 0;
        
        resources.forEach(resource => {
            totalSize += resource.transferSize || 0;
            count++;
        });
        
        performanceMetrics.resourceCount = count;
        performanceMetrics.resourceSize = totalSize;
        
        // 如果支持，获取内存使用情况
        if (performance.memory) {
            performanceMetrics.memoryUsage = {
                usedJSHeapSize: performance.memory.usedJSHeapSize,
                totalJSHeapSize: performance.memory.totalJSHeapSize,
                jsHeapSizeLimit: performance.memory.jsHeapSizeLimit
            };
        }
    }
    
    // 上报性能指标
    function reportPerformanceMetrics() {
        // 更新时间戳
        performanceMetrics.timestamp = Date.now();
        
        // 在控制台输出性能指标
        console.log('性能指标:', performanceMetrics);
        
        // 如果配置了上报端点，发送数据
        if (config.metricsEndpoint) {
            fetch(config.metricsEndpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(performanceMetrics),
                // 确保性能数据上报不阻塞用户体验
                keepalive: true
            }).catch(err => console.error('性能数据上报失败:', err));
        }
        
        // 存储到本地存储（用于历史比较）
        try {
            const history = JSON.parse(localStorage.getItem('trace_performance_history') || '[]');
            history.push(performanceMetrics);
            
            // 只保留最近10条记录
            if (history.length > 10) {
                history.shift();
            }
            
            localStorage.setItem('trace_performance_history', JSON.stringify(history));
        } catch (e) {
            console.error('性能历史保存失败:', e);
        }
    }
    
    // 低电量模式
    function enterLowPowerMode() {
        console.log('进入低电量模式');
        
        // 减少更新频率
        config.refreshInterval = 10000; // 10秒
        
        // 降低图片质量
        config.imageQuality = 50;
        
        // 禁用非必要功能
        disableNonEssentialFeatures();
    }
    
    // 暂停非必要操作
    function pauseNonEssentialOperations() {
        // 暂停轮询和自动更新
        clearAllIntervals();
        
        // 暂停动画
        document.body.classList.add('pause-animations');
        
        // 暂停视频
        document.querySelectorAll('video').forEach(video => video.pause());
        
        // 暂停音频
        document.querySelectorAll('audio').forEach(audio => audio.pause());
    }
    
    // 恢复操作
    function resumeOperations() {
        // 恢复动画
        document.body.classList.remove('pause-animations');
        
        // 恢复自动播放的视频
        document.querySelectorAll('video[autoplay]').forEach(video => {
            if (video.hasAttribute('data-autoplay')) {
                video.play().catch(() => {});
            }
        });
        
        // 恢复自动播放的音频
        document.querySelectorAll('audio[autoplay]').forEach(audio => {
            if (audio.hasAttribute('data-autoplay')) {
                audio.play().catch(() => {});
            }
        });
    }
    
    // 清除所有间隔计时器
    function clearAllIntervals() {
        // 获取所有注册的间隔计时器
        const intervals = window.tracePerfIntervals || [];
        
        // 清除所有间隔计时器
        intervals.forEach(id => clearInterval(id));
        
        // 重置数组
        window.tracePerfIntervals = [];
    }
    
    // 安全的setInterval包装器
    function safeSetInterval(callback, interval) {
        // 创建间隔计时器
        const id = setInterval(callback, interval);
        
        // 如果全局数组不存在，创建它
        if (!window.tracePerfIntervals) {
            window.tracePerfIntervals = [];
        }
        
        // 添加到全局数组
        window.tracePerfIntervals.push(id);
        
        // 返回ID，以便可以单独清除
        return id;
    }
    
    // 懒加载图片
    function lazyLoadImages() {
        if (!config.lazyLoadEnabled || !('IntersectionObserver' in window)) return;
        
        const imgObserver = new IntersectionObserver((entries, observer) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const img = entry.target;
                    const src = img.getAttribute('data-src');
                    
                    if (src) {
                        // 根据网络条件选择图片质量
                        if (connectionInfo.downlink < 1 || connectionInfo.effectiveType === '2g') {
                            // 如果网络条件差，加载低质量图片
                            img.src = src.replace(/\.(jpg|jpeg|png)/i, '-low.$1');
                        } else {
                            img.src = src;
                        }
                        
                        img.removeAttribute('data-src');
                        observer.unobserve(img);
                    }
                }
            });
        }, {
            rootMargin: '100px 0px', // 提前100px开始加载
            threshold: 0.1
        });
        
        // 获取所有带data-src属性的图片
        document.querySelectorAll('img[data-src]').forEach(img => {
            imgObserver.observe(img);
        });
    }
    
    // 资源预加载
    function prefetchResources() {
        if (!config.resourcePrefetchEnabled) return;
        
        // 获取可能需要预加载的资源
        const prefetchLinks = [
            // 示例：预加载下一步可能需要的资源
            { url: 'components/trace-breeding.html', type: 'document' },
            { url: 'components/trace-slaughter.html', type: 'document' },
            { url: 'components/trace-inspection.html', type: 'document' },
            { url: 'assets/images/steps-icon.png', type: 'image' }
        ];
        
        // 如果连接条件好，执行预加载
        if (connectionInfo.effectiveType === '4g' && !connectionInfo.saveData) {
            prefetchLinks.forEach(resource => {
                const link = document.createElement('link');
                link.rel = (resource.type === 'document') ? 'prefetch' : 'preload';
                link.href = resource.url;
                link.as = resource.type;
                
                // 添加到文档头
                document.head.appendChild(link);
            });
        }
    }
    
    // 异步加载脚本
    function loadScriptAsync(url, callback) {
        const script = document.createElement('script');
        script.src = url;
        script.async = true;
        
        // 如果提供了回调函数
        if (callback && typeof callback === 'function') {
            script.onload = callback;
        }
        
        // 添加到文档
        document.body.appendChild(script);
        
        return script;
    }
    
    // 延迟加载非关键资源
    function deferNonCriticalResources() {
        // 延迟加载的资源
        const deferredResources = [
            { type: 'script', url: 'components/trace-analytics.js' },
            { type: 'style', url: 'assets/styles/print.css', media: 'print' },
            { type: 'style', url: 'assets/styles/animations.css' }
        ];
        
        // 延迟执行，确保关键内容已加载
        window.addEventListener('load', () => {
            // 等待主要内容加载完毕后再加载非关键资源
            setTimeout(() => {
                deferredResources.forEach(resource => {
                    if (resource.type === 'script') {
                        loadScriptAsync(resource.url);
                    } else if (resource.type === 'style') {
                        const link = document.createElement('link');
                        link.rel = 'stylesheet';
                        link.href = resource.url;
                        if (resource.media) {
                            link.media = resource.media;
                        }
                        document.head.appendChild(link);
                    }
                });
            }, 1000); // 延迟1秒加载
        });
    }
    
    // 代码分割：动态导入组件
    async function loadComponent(name) {
        // 检查缓存
        if (config.cacheEnabled && resourceCache[name]) {
            return resourceCache[name];
        }
        
        try {
            // 根据组件名构建路径
            const path = `components/trace-${name}.js`;
            
            // 动态导入
            const module = await import(path);
            
            // 缓存结果
            if (config.cacheEnabled) {
                resourceCache[name] = module;
            }
            
            return module;
        } catch (error) {
            console.error(`加载组件 ${name} 失败:`, error);
            throw error;
        }
    }
    
    // 动态加载HTML模板
    async function loadTemplate(templateName) {
        // 检查缓存
        const cacheKey = `template_${templateName}`;
        if (config.cacheEnabled && resourceCache[cacheKey]) {
            return resourceCache[cacheKey];
        }
        
        // 构建模板URL
        const templateUrl = `components/${templateName}.html`;
        
        try {
            const response = await fetch(templateUrl);
            if (!response.ok) {
                throw new Error(`模板加载失败: ${response.status} ${response.statusText}`);
            }
            
            const templateHtml = await response.text();
            
            // 缓存模板
            if (config.cacheEnabled) {
                resourceCache[cacheKey] = {
                    html: templateHtml,
                    timestamp: Date.now(),
                    expires: Date.now() + config.cacheExpiry
                };
            }
            
            return templateHtml;
        } catch (error) {
            console.error(`加载模板 ${templateName} 失败:`, error);
            throw error;
        }
    }
    
    // 清理缓存
    function cleanCache() {
        const now = Date.now();
        
        // 清理过期的缓存
        Object.keys(resourceCache).forEach(key => {
            const entry = resourceCache[key];
            if (entry && entry.expires && entry.expires < now) {
                delete resourceCache[key];
            }
        });
    }
    
    // 获取性能建议
    function getPerformanceSuggestions() {
        const suggestions = [];
        
        // 根据性能指标提供建议
        if (performanceMetrics.largestContentfulPaint > 2500) {
            suggestions.push({
                metric: 'LCP',
                value: performanceMetrics.largestContentfulPaint,
                suggestion: '最大内容绘制时间过长，考虑优化图片大小、使用CDN、或实现图片懒加载。'
            });
        }
        
        if (performanceMetrics.firstInputDelay > 100) {
            suggestions.push({
                metric: 'FID',
                value: performanceMetrics.firstInputDelay,
                suggestion: '首次输入延迟过高，检查主线程阻塞问题，考虑将长任务拆分或使用Web Worker。'
            });
        }
        
        if (performanceMetrics.cumulativeLayoutShift > 0.1) {
            suggestions.push({
                metric: 'CLS',
                value: performanceMetrics.cumulativeLayoutShift,
                suggestion: '累积布局偏移过大，为图片和广告元素设置明确的宽高，避免动态注入内容时导致布局变化。'
            });
        }
        
        if (performanceMetrics.resourceCount > 50) {
            suggestions.push({
                metric: '资源数',
                value: performanceMetrics.resourceCount,
                suggestion: '资源请求过多，考虑合并小文件、使用CSS Sprites、减少第三方脚本。'
            });
        }
        
        if (performanceMetrics.resourceSize > 3 * 1024 * 1024) {
            suggestions.push({
                metric: '资源大小',
                value: (performanceMetrics.resourceSize / (1024 * 1024)).toFixed(2) + 'MB',
                suggestion: '页面资源总大小过大，优化图片大小、启用文本压缩、实现代码分割。'
            });
        }
        
        if (performanceMetrics.memoryUsage && performanceMetrics.memoryUsage.usedJSHeapSize > 0.7 * performanceMetrics.memoryUsage.jsHeapSizeLimit) {
            suggestions.push({
                metric: '内存使用',
                value: (performanceMetrics.memoryUsage.usedJSHeapSize / (1024 * 1024)).toFixed(2) + 'MB',
                suggestion: 'JavaScript内存使用接近限制，检查内存泄漏问题，清理不需要的DOM引用。'
            });
        }
        
        return suggestions;
    }
    
    // 初始化时启动懒加载
    window.addEventListener('DOMContentLoaded', () => {
        if (config.enabled && config.lazyLoadEnabled) {
            lazyLoadImages();
            deferNonCriticalResources();
        }
    });
    
    // 定期清理缓存
    if (config.cacheEnabled) {
        setInterval(cleanCache, 300000); // 每5分钟
    }
    
    // 返回公共API
    return {
        init,
        getMetrics: function() {
            return { ...performanceMetrics };
        },
        getConnectionInfo: function() {
            return { ...connectionInfo };
        },
        lazyLoadImages,
        prefetchResources,
        loadComponent,
        loadTemplate,
        loadScriptAsync,
        getPerformanceSuggestions,
        getConfig: function() {
            return { ...config };
        },
        setConfig: function(newConfig) {
            Object.assign(config, newConfig);
            return { ...config };
        },
        clearCache: function() {
            Object.keys(resourceCache).forEach(key => {
                delete resourceCache[key];
            });
            console.log('资源缓存已清空');
        }
    };
})();

// 导出全局对象
window.TracePerformance = TracePerformance; 