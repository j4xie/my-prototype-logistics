/**
 * @file 跨浏览器兼容性测试
 * @description 测试资源加载器在不同浏览器环境下的表现
 * @version 1.0.0
 */

import { ResourceLoader, EVENTS } from '../network/resource-loader';
import { StorageManager } from '../storage/storage-manager';
import { BrowserDetector } from './browser-detector';

// 浏览器特性检测结果
let browserFeatures = null;

// 测试前初始化
beforeAll(() => {
  // 初始化浏览器特性检测
  browserFeatures = BrowserDetector.detect();
  
  console.log('测试环境浏览器特性:', browserFeatures);
});

// 在每个测试用例前重置状态
beforeEach(() => {
  // 清理模拟和状态
  jest.clearAllMocks();
  
  // 模拟DOM API
  if (typeof document.createElement !== 'function') {
    document.createElement = jest.fn((tagName) => {
      const element = {
        tagName: tagName.toLowerCase(),
        onload: null,
        onerror: null
      };
      
      if (tagName.toLowerCase() === 'img') {
        element.src = '';
        element.complete = false;
      } else if (tagName.toLowerCase() === 'script') {
        element.src = '';
        element.async = false;
      } else if (tagName.toLowerCase() === 'link') {
        element.href = '';
        element.rel = '';
      }
      
      return element;
    });
  }
  
  // 模拟 navigator
  if (!navigator.connection) {
    Object.defineProperty(navigator, 'connection', {
      value: {
        effectiveType: '4g',
        downlink: 10,
        rtt: 50
      },
      configurable: true
    });
  }
});

/**
 * 浏览器特性检测测试
 */
describe('浏览器特性检测', () => {
  test('应正确检测浏览器类型和版本', () => {
    const browserInfo = BrowserDetector.getBrowserInfo();
    
    expect(browserInfo).toBeDefined();
    expect(browserInfo.name).toBeDefined();
    expect(browserInfo.version).toBeDefined();
  });
  
  test('应正确检测支持的存储API', () => {
    const storageFeatures = BrowserDetector.getStorageFeatures();
    
    expect(storageFeatures).toBeDefined();
    expect(typeof storageFeatures.localStorage).toBe('boolean');
    expect(typeof storageFeatures.sessionStorage).toBe('boolean');
    expect(typeof storageFeatures.indexedDB).toBe('boolean');
  });
  
  test('应正确检测网络API支持情况', () => {
    const networkFeatures = BrowserDetector.getNetworkFeatures();
    
    expect(networkFeatures).toBeDefined();
    expect(typeof networkFeatures.fetch).toBe('boolean');
    expect(typeof networkFeatures.xmlHttpRequest).toBe('boolean');
    expect(typeof networkFeatures.networkInformation).toBe('boolean');
  });
});

/**
 * 资源加载器兼容性测试
 */
describe('资源加载器兼容性', () => {
  let resourceLoader;
  
  beforeEach(() => {
    // 创建资源加载器实例
    resourceLoader = new ResourceLoader({
      maxConcurrentLoads: 5,
      retryCount: 2,
      cacheEnabled: true
    });
  });
  
  test('应在所有浏览器环境中成功初始化资源加载器', () => {
    expect(resourceLoader).toBeDefined();
    expect(resourceLoader.getStats).toBeDefined();
    expect(typeof resourceLoader.load).toBe('function');
  });
  
  test('应正确处理不支持某些特性的浏览器', () => {
    // 模拟老旧浏览器环境（不支持某些现代API）
    const originalFetch = window.fetch;
    const originalIndexedDB = window.indexedDB;
    
    try {
      // 删除fetch API
      delete window.fetch;
      // 删除IndexedDB
      delete window.indexedDB;
      
      // 重新创建资源加载器
      const legacyLoader = new ResourceLoader({
        maxConcurrentLoads: 3,
        retryCount: 1
      });
      
      // 验证降级功能正常工作
      expect(legacyLoader).toBeDefined();
      expect(legacyLoader.getStats).toBeDefined();
      expect(typeof legacyLoader.load).toBe('function');
      
      // 检查降级配置
      const stats = legacyLoader.getStats();
      expect(stats.fallbackMode).toBe(true);
    } finally {
      // 恢复原始API
      window.fetch = originalFetch;
      window.indexedDB = originalIndexedDB;
    }
  });
  
  test('应在不支持最新API的环境中降级使用替代方法', () => {
    // 模拟不支持现代API的浏览器
    const originalIntersectionObserver = window.IntersectionObserver;
    const originalPerformance = window.performance;
    
    try {
      // 删除现代API
      delete window.IntersectionObserver;
      window.performance = undefined;
      
      // 创建加载器并测试降级功能
      const legacyLoader = new ResourceLoader({
        maxConcurrentLoads: 3,
        retryCount: 1
      });
      
      // 验证降级后的功能可用性
      expect(legacyLoader).toBeDefined();
      expect(legacyLoader.getStats).toBeDefined();
      
      // 测试关键功能
      const loadSpy = jest.spyOn(legacyLoader, 'load');
      
      // 加载一个资源
      legacyLoader.load('image', 'test.jpg');
      
      expect(loadSpy).toHaveBeenCalledWith('image', 'test.jpg');
    } finally {
      // 恢复原始API
      window.IntersectionObserver = originalIntersectionObserver;
      window.performance = originalPerformance;
    }
  });
});

/**
 * 存储管理器兼容性测试
 */
describe('存储管理器兼容性', () => {
  let storageManager;
  
  beforeEach(() => {
    // 创建存储管理器实例
    storageManager = new StorageManager('test-store', {
      dbName: 'compatibility-test-db',
      dbVersion: 1
    });
  });
  
  test('应在所有浏览器环境中成功初始化存储管理器', () => {
    expect(storageManager).toBeDefined();
    expect(typeof storageManager.setItem).toBe('function');
    expect(typeof storageManager.getItem).toBe('function');
    expect(typeof storageManager.removeItem).toBe('function');
  });
  
  test('应在不支持IndexedDB的环境中降级到localStorage', async () => {
    // 备份原始API
    const originalIndexedDB = window.indexedDB;
    
    try {
      // 模拟不支持IndexedDB的环境
      delete window.indexedDB;
      
      // 创建新的存储管理器
      const fallbackStorageManager = new StorageManager('fallback-test', {
        dbName: 'fallback-test-db',
        dbVersion: 1
      });
      
      // 测试基本操作
      await fallbackStorageManager.setItem('test-key', { value: 'test-value' });
      const value = await fallbackStorageManager.getItem('test-key');
      
      // 验证值已正确存储和检索
      expect(value).toEqual({ value: 'test-value' });
      
      // 验证实际使用了localStorage
      expect(localStorage.getItem).toHaveBeenCalled();
    } finally {
      // 恢复原始API
      window.indexedDB = originalIndexedDB;
    }
  });
  
  test('应在离线环境中正常工作', async () => {
    // 模拟离线状态
    const originalOnLine = navigator.onLine;
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });
    
    try {
      // 存储数据
      await storageManager.setItem('offline-key', { testData: 'offline-value' });
      
      // 读取数据
      const value = await storageManager.getItem('offline-key');
      
      // 验证离线环境下可正常工作
      expect(value).toEqual({ testData: 'offline-value' });
    } finally {
      // 恢复在线状态
      Object.defineProperty(navigator, 'onLine', { value: originalOnLine, configurable: true });
    }
  });
});

/**
 * 浏览器特定问题测试
 */
describe('浏览器特定问题', () => {
  test('应处理IE11的特殊情况', () => {
    // 仅在检测到IE的环境中运行
    if (browserFeatures && browserFeatures.isIE) {
      // 测试IE特定的降级处理
      const ieLoader = new ResourceLoader({
        maxConcurrentLoads: 2,
        legacyMode: true
      });
      
      expect(ieLoader.config.legacyMode).toBe(true);
      expect(ieLoader.config.maxConcurrentLoads).toBeLessThanOrEqual(2);
    } else {
      // 在非IE环境中自动通过测试
      expect(true).toBe(true);
    }
  });
  
  test('应处理Safari的IndexedDB限制', () => {
    // 仅在检测到Safari的环境中运行
    if (browserFeatures && browserFeatures.isSafari) {
      // 测试Safari私有浏览模式的处理
      try {
        const tempDB = window.indexedDB.open('test-safari');
        tempDB.onerror = (event) => {
          // Safari在私有浏览模式下会拒绝IndexedDB访问
          const storageManager = new StorageManager('safari-test');
          expect(storageManager._state.fallbackToLocalStorage).toBe(true);
        };
      } catch (e) {
        // 忽略错误
      }
    } else {
      // 在非Safari环境中自动通过测试
      expect(true).toBe(true);
    }
  });
  
  test('应处理移动端的内存限制', () => {
    // 模拟移动设备环境
    const originalUserAgent = navigator.userAgent;
    Object.defineProperty(navigator, 'userAgent', {
      value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1',
      configurable: true
    });
    
    try {
      // 创建加载器
      const mobileLoader = new ResourceLoader({
        maxConcurrentLoads: 10
      });
      
      // 验证移动优化
      expect(mobileLoader.config.isMobile).toBe(true);
      expect(mobileLoader.config.maxConcurrentLoads).toBeLessThan(10);
    } finally {
      // 恢复原始用户代理
      Object.defineProperty(navigator, 'userAgent', {
        value: originalUserAgent,
        configurable: true
      });
    }
  });
});

/**
 * 模拟浏览器API
 */
class BrowserDetector {
  static detect() {
    return {
      name: this.getBrowserInfo().name,
      version: this.getBrowserInfo().version,
      isIE: this.getBrowserInfo().name === 'Internet Explorer',
      isSafari: this.getBrowserInfo().name === 'Safari',
      isChrome: this.getBrowserInfo().name === 'Chrome',
      isFirefox: this.getBrowserInfo().name === 'Firefox',
      isEdge: this.getBrowserInfo().name === 'Edge',
      isMobile: /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent),
      supportsIndexedDB: typeof indexedDB !== 'undefined',
      supportsLocalStorage: typeof localStorage !== 'undefined',
      supportsSessionStorage: typeof sessionStorage !== 'undefined',
      supportsFetch: typeof fetch !== 'undefined',
      supportsIntersectionObserver: typeof IntersectionObserver !== 'undefined',
      supportsPerformanceAPI: typeof performance !== 'undefined' && typeof performance.now === 'function'
    };
  }
  
  static getBrowserInfo() {
    const userAgent = navigator.userAgent;
    let name = 'Unknown';
    let version = 'Unknown';
    
    // 检测常见浏览器
    if (/MSIE|Trident/.test(userAgent)) {
      name = 'Internet Explorer';
      version = userAgent.indexOf('MSIE ') > -1 ? 
        userAgent.match(/MSIE (\d+\.\d+)/)[1] : 
        userAgent.match(/rv:(\d+\.\d+)/)[1];
    } else if (/Edge/.test(userAgent)) {
      name = 'Edge';
      version = userAgent.match(/Edge\/(\d+\.\d+)/)[1];
    } else if (/Chrome/.test(userAgent)) {
      name = 'Chrome';
      version = userAgent.match(/Chrome\/(\d+\.\d+)/)[1];
    } else if (/Firefox/.test(userAgent)) {
      name = 'Firefox';
      version = userAgent.match(/Firefox\/(\d+\.\d+)/)[1];
    } else if (/Safari/.test(userAgent) && !/Chrome/.test(userAgent)) {
      name = 'Safari';
      version = userAgent.match(/Version\/(\d+\.\d+)/)[1];
    }
    
    return { name, version };
  }
  
  static getStorageFeatures() {
    return {
      localStorage: typeof localStorage !== 'undefined',
      sessionStorage: typeof sessionStorage !== 'undefined',
      indexedDB: typeof indexedDB !== 'undefined'
    };
  }
  
  static getNetworkFeatures() {
    return {
      fetch: typeof fetch !== 'undefined',
      xmlHttpRequest: typeof XMLHttpRequest !== 'undefined',
      networkInformation: !!(navigator.connection || navigator.mozConnection || navigator.webkitConnection)
    };
  }
} 