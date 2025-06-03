/**
 * @file 浏览器特性检测器
 * @description 检测当前运行环境的浏览器类型、版本和功能支持情况
 * @version 1.0.0
 */

/**
 * 浏览器检测器单例类
 * 用于检测浏览器类型、功能支持情况和设备性能
 */
class BrowserDetector {
  constructor() {
    this._features = null;
    this._performanceTestResults = {};
    this._initDefaultFeatures();
  }

  /**
   * 初始化默认特性对象
   * @private
   */
  _initDefaultFeatures() {
    this._defaultFeatures = {
      name: '未知浏览器',
      version: '0.0.0',
      isMobile: false,
      isTablet: false,
      isDesktop: true,
      isIOS: false,
      isAndroid: false,
      isWindows: false,
      isMac: false,
      isLinux: false,
      isChrome: false,
      isFirefox: false,
      isEdge: false,
      isSafari: false,
      isIE: false,
      isOpera: false,
      supportsLocalStorage: true,
      supportsSessionStorage: true,
      supportsIndexedDB: true,
      supportsServiceWorkers: false,
      supportsWebWorkers: true,
      supportsSharedWorkers: false,
      supportsWebSockets: true,
      supportsWebRTC: false,
      supportsCanvas: true,
      supportsWebGL: false,
      supportsTouch: false,
      deviceType: 'desktop',
      screenWidth: window.screen?.width || 1024,
      screenHeight: window.screen?.height || 768,
      devicePixelRatio: window.devicePixelRatio || 1,
      deviceMemory: navigator.deviceMemory || 4,
      isLowMemoryDevice: false,
      isOfflineCapable: false,
      isLowEndDevice: false,
      performanceScore: 50,
      devicePerformanceLevel: 'medium',
      benchmarkTime: 0
    };
  }

  /**
   * 重置检测器的状态
   * 仅用于测试
   * @private
   */
  _reset() {
    this._features = null;
    this._performanceTestResults = {};
  }

  /**
   * 检测当前浏览器环境特性
   * @param {boolean} [forceRefresh=false] 是否强制重新检测
   * @returns {Object} 浏览器特性对象
   */
  detect(forceRefresh = false) {
    // 如果已经检测过且不需要强制刷新，直接返回缓存的结果
    if (this._features && !forceRefresh) {
      return this._features;
    }

    try {
      // 创建新的特性对象，基于默认特性
      const features = { ...this._defaultFeatures };
      
      // 检测浏览器类型和版本
      Object.assign(features, this._detectBrowserType());
      
      // 检测设备类型
      Object.assign(features, this._detectDeviceType());
      
      // 检测操作系统
      Object.assign(features, this._detectOS());
      
      // 检测特性支持情况
      Object.assign(features, this._detectFeatureSupport());
      
      // 检测设备内存和性能
      Object.assign(features, this._detectMemory());
      Object.assign(features, this._detectPerformance());
      
      // 缓存检测结果
      this._features = features;
      
      return features;
    } catch (error) {
      console.error('浏览器检测失败:', error);
      return { ...this._defaultFeatures };
    }
  }

  /**
   * 检测浏览器类型和版本
   * @private
   * @returns {Object} 浏览器类型和版本信息
   */
  _detectBrowserType() {
    const ua = navigator.userAgent;
    let name = '未知浏览器';
    let version = '0.0.0';
    let isChrome = false;
    let isFirefox = false;
    let isEdge = false;
    let isSafari = false;
    let isIE = false;
    let isOpera = false;

    // Edge
    if (ua.indexOf('Edg') > -1) {
      name = 'Edge';
      isEdge = true;
      version = this._extractVersion(ua, 'Edg/');
    }
    // Chrome
    else if (ua.indexOf('Chrome') > -1 && ua.indexOf('Edg') === -1) {
      name = 'Chrome';
      isChrome = true;
      version = this._extractVersion(ua, 'Chrome/');
    }
    // Firefox
    else if (ua.indexOf('Firefox') > -1) {
      name = 'Firefox';
      isFirefox = true;
      version = this._extractVersion(ua, 'Firefox/');
    }
    // Safari
    else if (ua.indexOf('Safari') > -1 && ua.indexOf('Chrome') === -1) {
      name = 'Safari';
      isSafari = true;
      version = this._extractVersion(ua, 'Version/');
    }
    // Internet Explorer
    else if (ua.indexOf('Trident') > -1) {
      name = 'Internet Explorer';
      isIE = true;
      version = this._extractVersion(ua, 'rv:') || '11.0';
    }
    // Opera
    else if (ua.indexOf('Opera') > -1 || ua.indexOf('OPR') > -1) {
      name = 'Opera';
      isOpera = true;
      version = ua.indexOf('Opera') > -1 ? this._extractVersion(ua, 'Opera/') : this._extractVersion(ua, 'OPR/');
    }

    return {
      name,
      version,
      isChrome,
      isFirefox,
      isEdge,
      isSafari,
      isIE,
      isOpera
    };
  }

  /**
   * 从用户代理字符串中提取版本号
   * @private
   * @param {string} ua 用户代理字符串
   * @param {string} prefix 版本号前缀
   * @returns {string} 版本号
   */
  _extractVersion(ua, prefix) {
    try {
      const startIndex = ua.indexOf(prefix);
      if (startIndex === -1) return '';
      const startPos = startIndex + prefix.length;
      const endPos = ua.indexOf(' ', startPos);
      if (endPos === -1) return ua.substring(startPos);
      return ua.substring(startPos, endPos);
    } catch (e) {
      return '';
    }
  }

  /**
   * 检测设备类型
   * @private
   * @returns {Object} 设备类型信息
   */
  _detectDeviceType() {
    const ua = navigator.userAgent;
    let isMobile = false;
    let isTablet = false;
    let isDesktop = true;
    let deviceType = 'desktop';
    let supportsTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

    // 移动设备检测
    if (/(android|iphone|ipod|mobile)/i.test(ua) && !/(tablet|ipad)/i.test(ua)) {
      isMobile = true;
      isDesktop = false;
      deviceType = 'mobile';
    } 
    // 平板设备检测
    else if (/(tablet|ipad)/i.test(ua) || (supportsTouch && Math.min(window.screen.width, window.screen.height) >= 768)) {
      isTablet = true;
      isDesktop = false;
      deviceType = 'tablet';
    }

    return {
      isMobile,
      isTablet,
      isDesktop,
      deviceType,
      supportsTouch
    };
  }

  /**
   * 检测操作系统
   * @private
   * @returns {Object} 操作系统信息
   */
  _detectOS() {
    const ua = navigator.userAgent;
    const platform = navigator.platform;
    let isIOS = false;
    let isAndroid = false;
    let isWindows = false;
    let isMac = false;
    let isLinux = false;

    // iOS
    if (/iPhone|iPad|iPod/i.test(ua) || /iPhone|iPad|iPod/i.test(platform)) {
      isIOS = true;
    }
    // Android
    else if (/Android/i.test(ua)) {
      isAndroid = true;
    }
    // Windows
    else if (/Win/i.test(platform)) {
      isWindows = true;
    }
    // Mac
    else if (/Mac/i.test(platform)) {
      isMac = true;
    }
    // Linux
    else if (/Linux/i.test(platform)) {
      isLinux = true;
    }

    return {
      isIOS,
      isAndroid,
      isWindows,
      isMac,
      isLinux
    };
  }

  /**
   * 检测功能支持情况
   * @private
   * @returns {Object} 功能支持情况
   */
  _detectFeatureSupport() {
    const supportInfo = {
      // 存储相关
      supportsLocalStorage: this._testLocalStorage(),
      supportsSessionStorage: this._testSessionStorage(),
      supportsIndexedDB: typeof window.indexedDB !== 'undefined',
      
      // Worker相关
      supportsServiceWorkers: 'serviceWorker' in navigator,
      supportsWebWorkers: typeof Worker !== 'undefined',
      supportsSharedWorkers: typeof SharedWorker !== 'undefined',
      
      // 网络相关
      supportsWebSockets: typeof WebSocket !== 'undefined',
      supportsWebRTC: navigator.mediaDevices && typeof navigator.mediaDevices.getUserMedia === 'function',
      
      // 图形相关
      supportsCanvas: this._testCanvas(),
      supportsWebGL: this._testWebGL(),
      
      // 离线功能
      isOfflineCapable: 'onLine' in navigator && typeof navigator.onLine === 'boolean'
    };

    return supportInfo;
  }

  /**
   * 测试localStorage是否可用
   * @private
   * @returns {boolean} localStorage是否可用
   */
  _testLocalStorage() {
    try {
      const testKey = '__test_ls_support__';
      localStorage.setItem(testKey, 'test');
      localStorage.removeItem(testKey);
      return true;
    } catch (e) {
      return false;
    }
  }

  /**
   * 测试sessionStorage是否可用
   * @private
   * @returns {boolean} sessionStorage是否可用
   */
  _testSessionStorage() {
    try {
      const testKey = '__test_ss_support__';
      sessionStorage.setItem(testKey, 'test');
      sessionStorage.removeItem(testKey);
      return true;
    } catch (e) {
      return false;
    }
  }

  /**
   * 测试Canvas是否可用
   * @private
   * @returns {boolean} Canvas是否可用
   */
  _testCanvas() {
    try {
      const canvas = document.createElement('canvas');
      return !!(canvas && canvas.getContext && canvas.getContext('2d'));
    } catch (e) {
      return false;
    }
  }

  /**
   * 测试WebGL是否可用
   * @private
   * @returns {boolean} WebGL是否可用
   */
  _testWebGL() {
    try {
      const canvas = document.createElement('canvas');
      return !!(window.WebGLRenderingContext && 
                (canvas.getContext('webgl') || 
                 canvas.getContext('experimental-webgl')));
    } catch (e) {
      return false;
    }
  }

  /**
   * 检测设备内存
   * @private
   * @returns {Object} 内存相关信息
   */
  _detectMemory() {
    let deviceMemory = navigator.deviceMemory || 4;
    let isLowMemoryDevice = deviceMemory <= 2;

    return {
      deviceMemory,
      isLowMemoryDevice
    };
  }

  /**
   * 检测设备性能
   * @private
   * @returns {Object} 性能相关信息
   */
  _detectPerformance() {
    // 如果已经运行过性能测试，直接返回结果
    if (Object.keys(this._performanceTestResults).length > 0) {
      return this._performanceTestResults;
    }

    // 运行简单的性能基准测试
    const benchmarkTime = this._runSimpleBenchmark();
    
    // 根据基准测试时间计算性能分数和级别
    let performanceScore = 0;
    let devicePerformanceLevel = 'medium';
    
    if (benchmarkTime < 20) {
      performanceScore = 90 + Math.min(100 - 90, (20 - benchmarkTime) * 2);
      devicePerformanceLevel = 'high';
    } else if (benchmarkTime < 50) {
      performanceScore = 70 + Math.min(90 - 70, (50 - benchmarkTime) / 1.5);
      devicePerformanceLevel = 'medium-high';
    } else if (benchmarkTime < 100) {
      performanceScore = 40 + Math.min(70 - 40, (100 - benchmarkTime) / 1.7);
      devicePerformanceLevel = 'medium';
    } else if (benchmarkTime < 200) {
      performanceScore = 20 + Math.min(40 - 20, (200 - benchmarkTime) / 5);
      devicePerformanceLevel = 'medium-low';
    } else {
      performanceScore = Math.max(1, 20 - (benchmarkTime - 200) / 10);
      devicePerformanceLevel = 'low';
    }
    
    // 内存低的设备降低性能评分
    const { isLowMemoryDevice } = this._detectMemory();
    if (isLowMemoryDevice) {
      performanceScore = Math.max(1, performanceScore * 0.8);
      if (devicePerformanceLevel === 'medium') {
        devicePerformanceLevel = 'medium-low';
      } else if (devicePerformanceLevel === 'medium-high') {
        devicePerformanceLevel = 'medium';
      }
    }
    
    // 如果浏览器是IE，降低性能评分
    const { isIE } = this._detectBrowserType();
    if (isIE) {
      performanceScore = Math.max(1, performanceScore * 0.7);
      if (devicePerformanceLevel !== 'low') {
        devicePerformanceLevel = 'medium-low';
      }
    }
    
    const isLowEndDevice = performanceScore < 30;
    
    // 缓存性能测试结果
    this._performanceTestResults = {
      performanceScore: Math.round(performanceScore),
      devicePerformanceLevel,
      benchmarkTime,
      isLowEndDevice
    };
    
    return this._performanceTestResults;
  }

  /**
   * 运行简单的性能基准测试
   * @private
   * @returns {number} 基准测试耗时（毫秒）
   */
  _runSimpleBenchmark() {
    try {
      const start = performance.now();
      let result = 0;
      
      // 执行一些计算密集型操作
      for (let i = 0; i < 100000; i++) {
        result += Math.sqrt(i) * Math.sin(i) / (1 + Math.cos(i));
      }
      
      const end = performance.now();
      return end - start;
    } catch (e) {
      console.error('性能基准测试失败:', e);
      return 100; // 返回中等性能的默认值
    }
  }

  /**
   * 获取当前设备优化配置
   * 根据设备性能和内存情况提供推荐配置
   * @returns {Object} 优化配置
   */
  getDeviceOptimizedConfig() {
    // 确保已经检测过设备特性
    const features = this.detect();
    
    // 基于性能和设备类型的基础配置
    const baseConfig = {
      // 批处理大小
      batchSize: 25,
      
      // UI相关设置
      useAnimations: true,
      useHighResImages: true,
      useProgressiveLoading: false,
      
      // 缓存设置
      cacheExpiryMinutes: 60,
      
      // 数据加载设置
      lazyLoadThreshold: 300,
      prefetchNextData: true,
      
      // 内存相关设置
      memoryLimitMB: 100,
      aggressiveGarbageCollection: false,
      
      // 离线支持
      enableOfflineSupport: true,
      
      // 网络相关
      maxRetryAttempts: 3,
      
      // 存储首选项
      preferIndexedDB: true
    };
    
    // 根据性能级别调整配置
    switch (features.devicePerformanceLevel) {
      case 'high':
        return {
          ...baseConfig,
          batchSize: 100,
          useHighResImages: true,
          useProgressiveLoading: false,
          cacheExpiryMinutes: 120,
          lazyLoadThreshold: 600,
          prefetchNextData: true,
          memoryLimitMB: 250,
          aggressiveGarbageCollection: false,
          maxRetryAttempts: 5
        };
        
      case 'medium-high':
        return {
          ...baseConfig,
          batchSize: 50,
          useHighResImages: true,
          useProgressiveLoading: false,
          cacheExpiryMinutes: 90,
          lazyLoadThreshold: 400,
          prefetchNextData: true,
          memoryLimitMB: 150,
          aggressiveGarbageCollection: false,
          maxRetryAttempts: 4
        };
        
      case 'medium':
        return baseConfig; // 使用默认配置
        
      case 'medium-low':
        return {
          ...baseConfig,
          batchSize: 15,
          useAnimations: features.isMobile ? false : true,
          useHighResImages: false,
          useProgressiveLoading: true,
          cacheExpiryMinutes: 45,
          lazyLoadThreshold: 200,
          prefetchNextData: false,
          memoryLimitMB: 75,
          aggressiveGarbageCollection: features.isLowMemoryDevice,
          maxRetryAttempts: 3
        };
        
      case 'low':
        return {
          ...baseConfig,
          batchSize: 10,
          useAnimations: false,
          useHighResImages: false,
          useProgressiveLoading: true,
          cacheExpiryMinutes: 30,
          lazyLoadThreshold: 150,
          prefetchNextData: false,
          memoryLimitMB: 40,
          aggressiveGarbageCollection: true,
          maxRetryAttempts: 2,
          enableOfflineSupport: !features.isLowMemoryDevice,
          preferIndexedDB: !features.isLowMemoryDevice && features.supportsIndexedDB
        };
        
      default:
        return baseConfig;
    }
  }
}

/**
 * 浏览器检测器单例实例
 * @type {BrowserDetector}
 */
const browserDetectorInstance = new BrowserDetector();

// 如果是在Node环境中（比如服务端渲染），提供默认的浏览器特性
if (typeof window === 'undefined') {
  browserDetectorInstance._features = {
    ...browserDetectorInstance._defaultFeatures,
    isBot: true,
    name: 'Server'
  };
}

export { browserDetectorInstance }; 