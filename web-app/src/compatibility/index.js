/**
 * @file 兼容性模块的主入口文件
 * @description 提供浏览器特性检测和兼容性垫片的统一接口
 * @version 1.0.0
 */

import browserDetector, { browserDetectorInstance } from './browser-detector';
import browserPolyfill from './browser-polyfill';

/**
 * 初始化兼容性检测和垫片
 * @param {Object} options - 初始化选项
 * @param {boolean} options.applyPolyfills - 是否应用垫片，默认为true
 * @param {boolean} options.applyStyles - 是否应用样式修复，默认为true
 * @param {Function} options.onComplete - 初始化完成时的回调
 * @param {Function} options.onWarning - 检测到兼容性问题时的回调
 * @returns {Object} 兼容性检测和优化的结果
 */
export function initCompatibility(options = {}) {
  const defaults = {
    applyPolyfills: true,
    applyStyles: true,
    onComplete: null,
    onWarning: null
  };
  
  const settings = { ...defaults, ...options };
  console.log('正在初始化兼容性模块...');
  
  // 运行浏览器特性检测
  const features = browserDetectorInstance.detect();
  const warnings = [];
  
  // 检查是否有兼容性警告
  if (features.isIE) {
    warnings.push(`检测到Internet Explorer ${features.version}，部分现代功能可能不可用`);
  }
  
  if (features.isMobile && features.isLowMemoryDevice) {
    warnings.push('检测到低端移动设备，已启用性能优化模式');
  }
  
  if (!features.supportsIndexedDB) {
    warnings.push('IndexedDB不可用，数据存储将降级使用备选方案');
  }
  
  if (!features.supportsLocalStorage && !features.supportsSessionStorage) {
    warnings.push('本地存储不可用，数据持久化功能将受限');
  }
  
  if (!features.supportsFetch && !features.supportsXMLHttpRequest) {
    warnings.push('网络请求API不可用，应用功能将受限');
  }
  
  // 应用垫片
  let polyfillResults = null;
  if (settings.applyPolyfills) {
    polyfillResults = browserPolyfill.applyBrowserPolyfills();
    console.log('已应用浏览器兼容性垫片');
  }
  
  // 应用样式修复
  if (settings.applyStyles) {
    browserPolyfill.applyBrowserSpecificStyles();
    console.log('已应用浏览器特定样式修复');
  }
  
  // 获取性能优化配置
  const optimizations = browserPolyfill.getPerformanceOptimizations();
  
  // 处理兼容性警告
  if (warnings.length > 0 && typeof settings.onWarning === 'function') {
    warnings.forEach(message => settings.onWarning(message));
  }
  
  // 完成回调
  if (typeof settings.onComplete === 'function') {
    settings.onComplete({
      features,
      warnings,
      optimizations
    });
  }
  
  return {
    features,
    warnings,
    optimizations,
    polyfillResults
  };
}

/**
 * 获取特定浏览器的CSS修复
 * @returns {string} CSS样式字符串
 */
export function getBrowserStyleFixes() {
  return browserPolyfill.getBrowserSpecificStyles();
}

/**
 * 检查浏览器是否支持特定功能
 * @param {string} featureName - 功能名称
 * @returns {boolean} 是否支持该功能
 */
export function supportsFeature(featureName) {
  const features = browserDetectorInstance.features;
  return !!features[`supports${featureName.charAt(0).toUpperCase() + featureName.slice(1)}`];
}

/**
 * 获取当前设备的性能等级
 * @returns {string} 性能等级：'high', 'medium', 'low'
 */
export function getDevicePerformanceLevel() {
  const features = browserDetectorInstance.features;
  
  if (features.isLowMemoryDevice || 
      (features.isMobile && features.browserPerformanceScore < 50)) {
    return 'low';
  } else if (features.isMobile || features.isTablet || 
             features.browserPerformanceScore < 80) {
    return 'medium';
  } else {
    return 'high';
  }
}

/**
 * 获取优化的资源加载配置
 * @returns {Object} 资源加载配置
 */
export function getResourceLoadingConfig() {
  const performanceLevel = getDevicePerformanceLevel();
  const features = browserDetectorInstance.features;
  
  // 根据设备性能和浏览器特性返回优化的配置
  return {
    // 批处理大小
    batchSize: performanceLevel === 'low' ? 3 : 
               performanceLevel === 'medium' ? 5 : 10,
    
    // 图片质量降级 (低端设备使用较低质量)
    imageQuality: performanceLevel === 'low' ? 'low' : 
                  performanceLevel === 'medium' ? 'medium' : 'high',
    
    // 是否预加载资源
    preload: performanceLevel !== 'low',
    
    // 缓存策略
    cacheStrategy: features.supportsIndexedDB ? 'indexeddb' : 
                   features.supportsLocalStorage ? 'localstorage' : 'memory',
    
    // 使用数据URI优化小图片加载
    inlineSmallResources: performanceLevel !== 'low',
    
    // 动画复杂度
    animationComplexity: performanceLevel === 'low' ? 'minimal' : 
                         performanceLevel === 'medium' ? 'reduced' : 'full'
  };
}

/**
 * 是否应该应用低资源模式
 * @returns {boolean} 是否应该应用低资源模式
 */
export function shouldUseLowResourceMode() {
  return getDevicePerformanceLevel() === 'low';
}

// 导出所有函数和模块
export {
  browserDetector,
  browserPolyfill
};

// 默认导出
export default {
  initCompatibility,
  getBrowserStyleFixes,
  supportsFeature,
  getDevicePerformanceLevel,
  getResourceLoadingConfig,
  shouldUseLowResourceMode,
  browserDetector,
  browserPolyfill
}; 