/**
 * @file 垫片模块入口文件
 * @description 统一导出垫片相关类和工具函数
 * @version 1.0.0
 */

import PolyfillRegistry from './registry';
import PolyfillLoader from './loader';
import { detectBrowser } from '../browser-detector';

// 默认实例
let defaultLoader = null;

/**
 * 获取或创建默认加载器实例
 * @param {Object} options - 加载器配置选项
 * @returns {PolyfillLoader} - 默认加载器实例
 */
const getDefaultLoader = (options = {}) => {
  if (!defaultLoader) {
    defaultLoader = new PolyfillLoader({
      debug: options.debug || false,
      basePath: options.basePath || '/polyfills/',
      ...options
    });
  }
  return defaultLoader;
};

/**
 * 快速加载所需垫片
 * @param {Object} options - 加载选项
 * @param {Array<String>} [options.include=[]] - 强制包含的垫片
 * @param {Array<String>} [options.exclude=[]] - 排除的垫片
 * @param {Boolean} [options.autoDetect=true] - 是否自动检测所需垫片
 * @param {String} [options.basePath] - 垫片脚本的基础路径
 * @param {Boolean} [options.debug=false] - 是否启用调试模式
 * @returns {Promise<Object>} - 加载结果
 */
const loadPolyfills = async (options = {}) => {
  const loader = getDefaultLoader(options);
  
  // 如果启用自动检测，根据浏览器特性添加需要的垫片
  if (options.autoDetect !== false) {
    const browserInfo = detectBrowser();
    const include = [...(options.include || [])];
    
    // 检测是否需要 Promise 垫片
    if (!window.Promise) {
      include.push('promise');
    }
    
    // 检测是否需要 fetch 垫片
    if (!window.fetch) {
      include.push('fetch');
    }
    
    // 针对 IE 的特殊处理
    if (browserInfo.browser === 'ie' || (browserInfo.browser === 'edge' && browserInfo.version < 14)) {
      include.push('ie-xhr'); 
      include.push('raf');
      
      if (!window.Symbol) {
        include.push('symbol');
      }
      
      if (!Array.from) {
        include.push('array-from');
      }
      
      if (!Object.assign) {
        include.push('object-assign');
      }
    }
    
    // 合并自动检测的垫片和用户指定的垫片
    options.include = [...new Set(include)];
  }
  
  return loader.loadPolyfills(options);
};

/**
 * 获取已加载的垫片列表
 * @returns {Array<String>} - 已加载的垫片名称列表
 */
const getLoadedPolyfills = () => {
  const loader = getDefaultLoader();
  return Array.from(loader.loadedPolyfills);
};

/**
 * 检查特定垫片是否已加载
 * @param {String} name - 垫片名称
 * @returns {Boolean} - 是否已加载
 */
const isPolyfillLoaded = (name) => {
  const loader = getDefaultLoader();
  return loader.isPolyfillLoaded(name);
};

/**
 * 获取加载性能指标
 * @returns {Object} - 性能指标对象
 */
const getPolyfillMetrics = () => {
  const loader = getDefaultLoader();
  return loader.getMetrics();
};

/**
 * 重置垫片加载器
 * @param {Boolean} [keepRegistry=true] - 是否保留注册表
 */
const resetPolyfillLoader = (keepRegistry = true) => {
  if (defaultLoader) {
    defaultLoader.reset(keepRegistry);
  }
};

// 导出类和工具函数
export {
  PolyfillRegistry,
  PolyfillLoader,
  loadPolyfills,
  getLoadedPolyfills,
  isPolyfillLoaded,
  getPolyfillMetrics,
  resetPolyfillLoader,
  getDefaultLoader
};

// 默认导出快速加载函数
export default loadPolyfills; 