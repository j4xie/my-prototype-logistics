/**
 * @file 浏览器检测工具类
 * @description 提供辅助方法来处理不同浏览器环境下的兼容性问题
 * @version 1.0.0
 */

/**
 * 浏览器检测工具类
 * 提供辅助方法来检测和处理浏览器兼容性问题
 */
export class BrowserDetectorUtils {
  /**
   * 检查当前环境是否为服务器端
   * @returns {boolean} 如果是服务器端环境则返回true
   */
  static isServer() {
    return typeof window === 'undefined';
  }

  /**
   * 检查当前环境是否为客户端
   * @returns {boolean} 如果是客户端环境则返回true
   */
  static isClient() {
    return !this.isServer();
  }

  /**
   * 获取用户代理字符串
   * @returns {string} 用户代理字符串，如果在服务器端则返回空字符串
   */
  static getUserAgent() {
    if (this.isServer()) {
      return '';
    }
    return navigator.userAgent || '';
  }

  /**
   * 获取浏览器语言
   * @returns {string} 浏览器语言
   */
  static getBrowserLanguage() {
    if (this.isServer()) {
      return '';
    }
    return (navigator.language || navigator.userLanguage || '').toLowerCase();
  }

  /**
   * 检测是否为移动设备
   * @returns {boolean} 如果是移动设备则返回true
   */
  static isMobileDevice() {
    if (this.isServer()) {
      return false;
    }
    const ua = this.getUserAgent();
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
  }

  /**
   * 检测是否为iOS设备
   * @returns {boolean} 如果是iOS设备则返回true
   */
  static isIOS() {
    if (this.isServer()) {
      return false;
    }
    const ua = this.getUserAgent();
    return /iPad|iPhone|iPod/.test(ua) && !window.MSStream;
  }

  /**
   * 检测是否为Android设备
   * @returns {boolean} 如果是Android设备则返回true
   */
  static isAndroid() {
    if (this.isServer()) {
      return false;
    }
    const ua = this.getUserAgent();
    return /Android/i.test(ua);
  }

  /**
   * 检测是否为Safari浏览器
   * @returns {boolean} 如果是Safari浏览器则返回true
   */
  static isSafari() {
    if (this.isServer()) {
      return false;
    }
    const ua = this.getUserAgent();
    return /^((?!chrome|android).)*safari/i.test(ua);
  }

  /**
   * 检测是否为IE浏览器
   * @returns {boolean} 如果是IE浏览器则返回true
   */
  static isIE() {
    if (this.isServer()) {
      return false;
    }
    const ua = this.getUserAgent();
    return /MSIE|Trident/.test(ua);
  }

  /**
   * 检测是否为Edge浏览器
   * @returns {boolean} 如果是Edge浏览器则返回true
   */
  static isEdge() {
    if (this.isServer()) {
      return false;
    }
    const ua = this.getUserAgent();
    return /Edge\/|Edg\//.test(ua);
  }

  /**
   * 检测是否为Chrome浏览器
   * @returns {boolean} 如果是Chrome浏览器则返回true
   */
  static isChrome() {
    if (this.isServer()) {
      return false;
    }
    const ua = this.getUserAgent();
    return /Chrome/.test(ua) && !/Edg\/|Edge\/|OPR\/|SamsungBrowser\//.test(ua);
  }

  /**
   * 检测是否为Firefox浏览器
   * @returns {boolean} 如果是Firefox浏览器则返回true
   */
  static isFirefox() {
    if (this.isServer()) {
      return false;
    }
    const ua = this.getUserAgent();
    return /Firefox/.test(ua) && !/Seamonkey\//.test(ua);
  }

  /**
   * 检测是否支持触摸事件
   * @returns {boolean} 如果支持触摸事件则返回true
   */
  static supportsTouchEvents() {
    if (this.isServer()) {
      return false;
    }
    return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  }

  /**
   * 检测是否支持WebGL
   * @returns {boolean} 如果支持WebGL则返回true
   */
  static supportsWebGL() {
    if (this.isServer()) {
      return false;
    }
    try {
      const canvas = document.createElement('canvas');
      return !!(window.WebGLRenderingContext && 
        (canvas.getContext('webgl') || canvas.getContext('experimental-webgl')));
    } catch (e) {
      return false;
    }
  }

  /**
   * 检测是否支持WebP图片格式
   * @returns {Promise<boolean>} 如果支持WebP则Promise解析为true
   */
  static supportsWebP() {
    if (this.isServer()) {
      return Promise.resolve(false);
    }
    return new Promise(resolve => {
      const webP = new Image();
      webP.onload = webP.onerror = function() {
        resolve(webP.height === 2);
      };
      webP.src = 'data:image/webp;base64,UklGRjoAAABXRUJQVlA4IC4AAACyAgCdASoCAAIALmk0mk0iIiIiIgBoSygABc6WWgAA/veff/0PP8bA//LwYAAA';
    });
  }

  /**
   * 检测是否支持特定CSS属性
   * @param {string} property 要检测的CSS属性
   * @returns {boolean} 如果支持该属性则返回true
   */
  static supportsCSS(property) {
    if (this.isServer()) {
      return false;
    }
    if (!window.CSS || !window.CSS.supports) {
      return false;
    }
    try {
      return window.CSS.supports(property);
    } catch (e) {
      return false;
    }
  }

  /**
   * 检测当前媒体查询是否匹配
   * @param {string} query 媒体查询字符串
   * @returns {boolean} 如果媒体查询匹配则返回true
   */
  static matchesMedia(query) {
    if (this.isServer()) {
      return false;
    }
    if (!window.matchMedia) {
      return false;
    }
    return window.matchMedia(query).matches;
  }

  /**
   * 检测是否为暗模式
   * @returns {boolean} 如果是暗模式则返回true
   */
  static isDarkMode() {
    return this.matchesMedia('(prefers-color-scheme: dark)');
  }

  /**
   * 检测是否为低电量模式
   * @returns {boolean} 如果是低电量模式则返回true
   */
  static isLowPowerMode() {
    return this.matchesMedia('(prefers-reduced-motion: reduce)');
  }

  /**
   * 检测可用的网络类型
   * @returns {string} 网络类型描述
   */
  static getNetworkType() {
    if (this.isServer()) {
      return 'unknown';
    }
    
    if (navigator.connection && navigator.connection.effectiveType) {
      return navigator.connection.effectiveType; // 4g, 3g, 2g, slow-2g
    }
    
    return 'unknown';
  }

  /**
   * 检测设备的内存大小
   * @returns {number} 设备内存大小（GB），如果无法检测则返回-1
   */
  static getDeviceMemory() {
    if (this.isServer()) {
      return -1;
    }
    
    if (navigator.deviceMemory) {
      return navigator.deviceMemory;
    }
    
    return -1;
  }

  /**
   * 检测硬件并发数（CPU核心数）
   * @returns {number} 硬件并发数，如果无法检测则返回1
   */
  static getHardwareConcurrency() {
    if (this.isServer()) {
      return 1;
    }
    
    if (navigator.hardwareConcurrency) {
      return navigator.hardwareConcurrency;
    }
    
    return 1;
  }

  /**
   * 基于设备特性生成性能配置
   * @returns {Object} 性能配置对象
   */
  static generatePerformanceConfig() {
    // 默认配置(高性能设备)
    const config = {
      batchSize: 10,
      imageQuality: 'high',
      useAnimations: true,
      useHighResImages: true,
      prefetchDistance: 5,
      maxCacheItems: 500,
      memoryLimitMB: 100,
      useBackgroundSync: true,
      useServiceWorker: true,
      aggressiveGarbageCollection: false,
      lazyLoadThreshold: 0.5
    };
    
    if (this.isServer()) {
      return config;
    }
    
    // 根据设备内存调整配置
    const memory = this.getDeviceMemory();
    if (memory > 0) {
      if (memory <= 1) {
        // 低内存设备
        config.batchSize = 3;
        config.imageQuality = 'low';
        config.useAnimations = false;
        config.useHighResImages = false;
        config.prefetchDistance = 1;
        config.maxCacheItems = 50;
        config.memoryLimitMB = 20;
        config.aggressiveGarbageCollection = true;
      } else if (memory <= 2) {
        // 中低内存设备
        config.batchSize = 5;
        config.imageQuality = 'medium';
        config.useAnimations = true;
        config.useHighResImages = false;
        config.prefetchDistance = 2;
        config.maxCacheItems = 100;
        config.memoryLimitMB = 40;
      } else if (memory <= 4) {
        // 中等内存设备
        config.batchSize = 8;
        config.imageQuality = 'medium';
        config.useHighResImages = true;
        config.prefetchDistance = 3;
        config.maxCacheItems = 300;
        config.memoryLimitMB = 70;
      }
    }
    
    // 根据网络类型调整配置
    const networkType = this.getNetworkType();
    if (networkType === 'slow-2g' || networkType === '2g') {
      config.batchSize = Math.min(config.batchSize, 2);
      config.imageQuality = 'low';
      config.useHighResImages = false;
      config.prefetchDistance = 1;
      config.useBackgroundSync = true;
    } else if (networkType === '3g') {
      config.batchSize = Math.min(config.batchSize, 5);
      config.imageQuality = 'medium';
      config.useHighResImages = false;
      config.prefetchDistance = 2;
    }
    
    // 根据浏览器类型调整配置
    if (this.isIE() || this.isSafari() && this.isIOS()) {
      config.useServiceWorker = false;
      config.useBackgroundSync = false;
      config.aggressiveGarbageCollection = true;
    }
    
    // 根据是否为移动设备调整配置
    if (this.isMobileDevice()) {
      config.batchSize = Math.min(config.batchSize, 6);
      config.prefetchDistance = Math.min(config.prefetchDistance, 3);
    }
    
    // 根据是否为低电量模式调整配置
    if (this.isLowPowerMode()) {
      config.useAnimations = false;
      config.prefetchDistance = 1;
      config.aggressiveGarbageCollection = true;
    }
    
    return config;
  }

  /**
   * 创建一个在不同浏览器中一致工作的事件监听器
   * @param {Element} element 要监听的DOM元素
   * @param {string} event 事件名称
   * @param {Function} callback 回调函数
   * @param {Object} options 选项对象
   * @returns {Object} 包含移除监听器方法的对象
   */
  static createEventListener(element, event, callback, options = {}) {
    if (this.isServer() || !element) {
      return { remove: () => {} };
    }
    
    if (element.addEventListener) {
      element.addEventListener(event, callback, options);
      return {
        remove: () => element.removeEventListener(event, callback, options)
      };
    } else if (element.attachEvent) {
      // 旧版IE支持
      element.attachEvent(`on${event}`, callback);
      return {
        remove: () => element.detachEvent(`on${event}`, callback)
      };
    }
    
    return { remove: () => {} };
  }
}

// 导出为默认和命名导出
export default BrowserDetectorUtils; 