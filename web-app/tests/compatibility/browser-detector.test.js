/**
 * @file 浏览器检测器测试文件
 * @description 测试浏览器检测器的核心功能和特性检测能力
 * @version 1.0.0
 */

import { browserDetectorInstance } from '../../src/compatibility/browser-detector';

// 模拟navigator和window对象
const mockNavigator = {};
const mockWindow = {};

describe('浏览器检测器测试', () => {
  // 在每个测试前重置模拟对象
  beforeEach(() => {
    // 保存原始的全局对象
    global.originalNavigator = global.navigator;
    global.originalWindow = global.window;
    
    // 创建模拟对象
    global.navigator = {
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      platform: 'Win32',
      hardwareConcurrency: 4,
      deviceMemory: 8,
      connection: {
        effectiveType: '4g',
        downlink: 10
      }
    };
    
    global.window = {
      innerWidth: 1920,
      innerHeight: 1080,
      localStorage: {
        setItem: jest.fn(),
        getItem: jest.fn(),
        removeItem: jest.fn()
      },
      sessionStorage: {
        setItem: jest.fn(),
        getItem: jest.fn(),
        removeItem: jest.fn()
      },
      performance: {
        memory: {
          jsHeapSizeLimit: 2190000000,
          totalJSHeapSize: 21900000,
          usedJSHeapSize: 16300000
        },
        now: jest.fn(() => 100),
        getEntriesByType: jest.fn(() => []),
        mark: jest.fn(),
        measure: jest.fn()
      },
      document: {
        createElement: jest.fn((type) => {
          if (type === 'canvas') {
            return {
              getContext: jest.fn(() => ({
                getImageData: jest.fn()
              }))
            };
          }
          return {};
        })
      },
      indexedDB: {},
      Worker: function() {},
      WebSocket: function() {},
      requestAnimationFrame: jest.fn(),
      IntersectionObserver: function() {},
      fetch: jest.fn(),
      matchMedia: jest.fn(() => ({
        matches: false
      })),
      crypto: {
        subtle: {}
      }
    };
    
    // 重置检测器状态
    browserDetectorInstance._features = null;
  });
  
  // 在每个测试后恢复原始的全局对象
  afterEach(() => {
    global.navigator = global.originalNavigator;
    global.window = global.originalWindow;
  });

  test('应该正确检测到Chrome浏览器', () => {
    const features = browserDetectorInstance.detect();
    expect(features.name).toBe('Chrome');
    expect(features.isChrome).toBe(true);
    expect(features.isFirefox).toBe(false);
    expect(features.isSafari).toBe(false);
    expect(features.isIE).toBe(false);
    expect(features.isEdge).toBe(false);
  });
  
  test('应该正确检测到Firefox浏览器', () => {
    global.navigator.userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:89.0) Gecko/20100101 Firefox/89.0';
    
    const features = browserDetectorInstance.detect();
    expect(features.name).toBe('Firefox');
    expect(features.isChrome).toBe(false);
    expect(features.isFirefox).toBe(true);
    expect(features.isSafari).toBe(false);
    expect(features.isIE).toBe(false);
    expect(features.isEdge).toBe(false);
  });
  
  test('应该正确检测到Safari浏览器', () => {
    global.navigator.userAgent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.1 Safari/605.1.15';
    global.navigator.platform = 'MacIntel';
    
    const features = browserDetectorInstance.detect();
    expect(features.name).toBe('Safari');
    expect(features.isChrome).toBe(false);
    expect(features.isFirefox).toBe(false);
    expect(features.isSafari).toBe(true);
    expect(features.isIE).toBe(false);
    expect(features.isEdge).toBe(false);
  });
  
  test('应该正确检测到Edge浏览器', () => {
    global.navigator.userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36 Edg/91.0.864.59';
    
    const features = browserDetectorInstance.detect();
    expect(features.name).toBe('Edge');
    expect(features.isChrome).toBe(false);
    expect(features.isFirefox).toBe(false);
    expect(features.isSafari).toBe(false);
    expect(features.isIE).toBe(false);
    expect(features.isEdge).toBe(true);
  });
  
  test('应该正确检测到Internet Explorer浏览器', () => {
    global.navigator.userAgent = 'Mozilla/5.0 (Windows NT 10.0; WOW64; Trident/7.0; rv:11.0) like Gecko';
    
    const features = browserDetectorInstance.detect();
    expect(features.name).toBe('Internet Explorer');
    expect(features.isChrome).toBe(false);
    expect(features.isFirefox).toBe(false);
    expect(features.isSafari).toBe(false);
    expect(features.isIE).toBe(true);
    expect(features.isEdge).toBe(false);
  });
  
  test('应该正确检测到设备类型为桌面端', () => {
    const features = browserDetectorInstance.detect();
    expect(features.deviceType).toBe('desktop');
    expect(features.isDesktop).toBe(true);
    expect(features.isMobile).toBe(false);
    expect(features.isTablet).toBe(false);
  });
  
  test('应该正确检测到设备类型为移动端', () => {
    global.navigator.userAgent = 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1';
    global.window.innerWidth = 375;
    global.window.innerHeight = 812;
    
    const features = browserDetectorInstance.detect();
    expect(features.deviceType).toBe('mobile');
    expect(features.isDesktop).toBe(false);
    expect(features.isMobile).toBe(true);
    expect(features.isTablet).toBe(false);
  });
  
  test('应该正确检测到设备类型为平板', () => {
    global.navigator.userAgent = 'Mozilla/5.0 (iPad; CPU OS 14_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1';
    global.window.innerWidth = 768;
    global.window.innerHeight = 1024;
    
    const features = browserDetectorInstance.detect();
    expect(features.deviceType).toBe('tablet');
    expect(features.isDesktop).toBe(false);
    expect(features.isMobile).toBe(false);
    expect(features.isTablet).toBe(true);
  });
  
  test('应该正确检测操作系统', () => {
    const features = browserDetectorInstance.detect();
    expect(features.os).toBe('Windows');
    
    global.navigator.userAgent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.1 Safari/605.1.15';
    global.navigator.platform = 'MacIntel';
    browserDetectorInstance._features = null;
    
    const featuresMac = browserDetectorInstance.detect();
    expect(featuresMac.os).toBe('Mac OS');
  });
  
  test('应该检测到浏览器的特性支持情况', () => {
    const features = browserDetectorInstance.detect();
    
    expect(features.supportsLocalStorage).toBe(true);
    expect(features.supportsSessionStorage).toBe(true);
    expect(features.supportsIndexedDB).toBe(true);
    expect(features.supportsWebWorkers).toBe(true);
    expect(features.supportsWebSockets).toBe(true);
    expect(features.supportsWebGL).toBeTruthy();
    expect(features.supportsCanvas).toBeTruthy();
  });
  
  test('应该正确检测设备内存和性能', () => {
    const features = browserDetectorInstance.detect();
    
    expect(features.deviceMemory).toBe(8);
    expect(features.hardwareConcurrency).toBe(4);
    expect(features.isLowMemoryDevice).toBe(false);
    expect(features.isLowEndDevice).toBe(false);
  });
  
  test('应该正确检测到低内存设备', () => {
    global.navigator.deviceMemory = 1;
    
    const features = browserDetectorInstance.detect();
    expect(features.deviceMemory).toBe(1);
    expect(features.isLowMemoryDevice).toBe(true);
  });
  
  test('应该返回基于设备特性的优化配置', () => {
    // 标准配置 - 高端设备
    const standardConfig = browserDetectorInstance.getDeviceOptimizedConfig();
    expect(standardConfig.batchSize).toBeGreaterThan(0);
    expect(standardConfig.useHighResImages).toBe(true);
    expect(standardConfig.useAnimations).toBe(true);
    
    // 模拟低端设备
    global.navigator.deviceMemory = 1;
    global.navigator.hardwareConcurrency = 1;
    browserDetectorInstance._features = null;
    
    const lowEndConfig = browserDetectorInstance.getDeviceOptimizedConfig();
    expect(lowEndConfig.batchSize).toBeLessThan(standardConfig.batchSize);
    expect(lowEndConfig.useHighResImages).toBe(false);
    expect(lowEndConfig.useAnimations).toBe(false);
    expect(lowEndConfig.aggressiveGarbageCollection).toBe(true);
  });
  
  test('应该能够强制刷新检测结果', () => {
    const features1 = browserDetectorInstance.detect();
    
    // 修改用户代理
    global.navigator.userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:89.0) Gecko/20100101 Firefox/89.0';
    
    // 不强制刷新，应该返回缓存的结果
    const features2 = browserDetectorInstance.detect();
    expect(features2.name).toBe('Chrome');
    
    // 强制刷新，应该返回新的结果
    const features3 = browserDetectorInstance.detect(true);
    expect(features3.name).toBe('Firefox');
  });
}); 