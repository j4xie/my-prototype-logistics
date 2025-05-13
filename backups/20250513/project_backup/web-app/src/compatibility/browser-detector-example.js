/**
 * @file 浏览器检测器使用示例
 * @description 演示如何使用浏览器检测器来优化应用性能
 * @version 1.0.0
 */

import { browserDetectorInstance } from './browser-detector';

/**
 * 初始化应用的兼容性配置
 * 根据当前浏览器和设备的能力设置最佳配置
 */
export function initCompatibilityConfig() {
  // 检测当前浏览器环境
  const browserFeatures = browserDetectorInstance.detect();
  
  console.log('当前浏览器信息:', {
    名称: browserFeatures.name,
    版本: browserFeatures.version,
    设备类型: browserFeatures.deviceType,
    性能评分: browserFeatures.performanceScore,
    性能级别: browserFeatures.devicePerformanceLevel,
    内存: `${browserFeatures.deviceMemory}GB`,
    是否为低内存设备: browserFeatures.isLowMemoryDevice ? '是' : '否',
    是否为低端设备: browserFeatures.isLowEndDevice ? '是' : '否'
  });
  
  // 获取基于设备性能的优化配置
  const optimizedConfig = browserDetectorInstance.getDeviceOptimizedConfig();
  
  // 显示优化配置
  console.log('已应用的性能优化配置:', optimizedConfig);
  
  // 应用配置到全局设置
  applyOptimizedConfig(optimizedConfig);
  
  // 根据浏览器功能支持情况提供回退方案
  setupFallbacks(browserFeatures);
  
  return { browserFeatures, optimizedConfig };
}

/**
 * 应用优化配置到应用程序
 * @param {Object} config 优化配置对象
 */
function applyOptimizedConfig(config) {
  // 这里将配置应用到应用程序的不同部分
  
  // 设置批处理大小
  if (window.APP_CONFIG) {
    window.APP_CONFIG.batchSize = config.batchSize;
    window.APP_CONFIG.useHighResImages = config.useHighResImages;
    window.APP_CONFIG.useAnimations = config.useAnimations;
    window.APP_CONFIG.cacheExpiryMinutes = config.cacheExpiryMinutes;
    window.APP_CONFIG.preferIndexedDB = config.preferIndexedDB;
  }
  
  // 如果需要激进的垃圾回收，设置更频繁的内存释放
  if (config.aggressiveGarbageCollection) {
    setupAggressiveMemoryManagement();
  }
  
  // 根据配置设置图片加载策略
  if (!config.useHighResImages) {
    document.documentElement.classList.add('low-res-images');
  }
  
  // 根据配置开启或关闭动画
  if (!config.useAnimations) {
    document.documentElement.classList.add('reduce-animations');
    // 添加一个CSS类，可以通过CSS来禁用动画
    // 例如：.reduce-animations * { transition: none !important; animation: none !important; }
  }
  
  // 应用延迟加载配置
  if (window.lazyLoader) {
    window.lazyLoader.threshold = config.lazyLoadThreshold;
    window.lazyLoader.prefetchNext = config.prefetchNextData;
  }
}

/**
 * 设置更积极的内存管理策略
 */
function setupAggressiveMemoryManagement() {
  // 在低端设备上更频繁地清理内存
  if (window.storageManager) {
    // 降低缓存大小
    window.storageManager.setMaxCacheSize(window.APP_CONFIG.memoryLimitMB * 1024 * 1024);
    
    // 更频繁地释放内存
    setInterval(() => {
      console.log('执行内存优化...');
      window.storageManager.optimizeMemoryUsage();
    }, 60000); // 每分钟优化一次
    
    // 主动监听内存不足事件
    window.storageManager.setMemoryWarningCallback(() => {
      console.log('检测到内存不足，清理缓存...');
      window.storageManager.clearCache();
    });
  }
}

/**
 * 为不支持的功能设置回退方案
 * @param {Object} browserFeatures 浏览器特性对象
 */
function setupFallbacks(browserFeatures) {
  // 如果不支持IndexedDB，使用localStorage
  if (!browserFeatures.supportsIndexedDB && window.storageManager) {
    console.log('当前浏览器不支持IndexedDB，切换到localStorage');
    window.storageManager.useLocalStorageFallback(true);
  }
  
  // 如果不支持WebWorkers，切换到同步处理
  if (!browserFeatures.supportsWebWorkers && window.dataProcessor) {
    console.log('当前浏览器不支持WebWorkers，切换到同步处理模式');
    window.dataProcessor.disableWorkers();
  }
  
  // 如果在IE或旧版浏览器上，提供polyfill
  if (browserFeatures.isIE || parseInt(browserFeatures.version, 10) < 60) {
    console.log('检测到旧版浏览器，加载兼容性补丁');
    loadPolyfills();
  }
  
  // 如果不支持ServiceWorker，禁用离线功能
  if (!browserFeatures.supportsServiceWorkers) {
    console.log('当前浏览器不支持ServiceWorker，禁用离线功能');
    if (window.APP_CONFIG) {
      window.APP_CONFIG.enableOfflineSupport = false;
    }
  }
}

/**
 * 加载必要的polyfill
 */
function loadPolyfills() {
  // 这里根据需要动态加载polyfill
  const polyfills = [];
  
  // Promise polyfill
  if (typeof Promise === 'undefined') {
    polyfills.push('promises');
  }
  
  // Fetch polyfill
  if (typeof fetch === 'undefined') {
    polyfills.push('fetch');
  }
  
  // 如果需要polyfill，加载它们
  if (polyfills.length > 0) {
    const script = document.createElement('script');
    script.src = `/polyfills/bundle-${polyfills.join('-')}.js`;
    document.head.appendChild(script);
  }
}

/**
 * 等页面加载完成后初始化兼容性配置
 */
if (typeof window !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initCompatibilityConfig);
  } else {
    initCompatibilityConfig();
  }
}

// 导出辅助函数
export const getBrowserInfo = () => browserDetectorInstance.detect();
export const getOptimizedConfig = () => browserDetectorInstance.getDeviceOptimizedConfig();
export const forceDetectionRefresh = () => browserDetectorInstance.detect(true); 