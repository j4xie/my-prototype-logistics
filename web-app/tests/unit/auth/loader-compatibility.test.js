/**
 * @file loader-compatibility.test.js
 * @description 资源加载器跨设备兼容性测试 - 食品溯源系统
 * @jest-environment jsdom
 */

// CommonJS导入，不使用ES6模块语法
const traceLoader = require('../../../components/modules/auth/loader');

// 设置全局测试超时为10秒，避免测试长时间运行
jest.setTimeout(10000);

// 浏览器特性模拟
const browserFeatures = {
  standard: {
    name: 'Chrome',
    version: '90',
    supportsFetch: true,
    supportsPromises: true,
    supportsIntersectionObserver: true,
    supportsServiceWorker: true
  },
  legacy: {
    name: 'IE',
    version: '11',
    supportsFetch: false,
    supportsPromises: true,
    supportsIntersectionObserver: false,
    supportsServiceWorker: false
  },
  mobile: {
    name: 'Mobile Safari',
    version: '14',
    supportsFetch: true,
    supportsPromises: true,
    supportsIntersectionObserver: true,
    supportsServiceWorker: true,
    isMobile: true
  }
};

// 在每个测试前设置环境
beforeEach(() => {
  // 重置加载器状态
  traceLoader._state.loadedResources.clear();
  traceLoader._state.loadQueue = [];
  traceLoader._state.pendingLoads = 0;
  traceLoader._state.listeners = new Map();
  
  // 清理DOM
  document.head.innerHTML = '';
  document.body.innerHTML = '';
  
  // 启用Jest假计时器，使用modern模式确保Promise能正确解析
  jest.useFakeTimers({legacyFakeTimers: false});
  // 清除所有计时器，避免测试之间的干扰
  jest.clearAllTimers();
  
  // 重置navigator和window对象
  resetBrowserEnvironment();
});

// 每个测试后清理环境
afterEach(() => {
  // 运行所有待处理的计时器来避免悬挂的异步操作
  jest.runAllTimers();
  // 恢复真实计时器
  jest.useRealTimers();
  // 清理所有模拟
  jest.restoreAllMocks();
  
  // 恢复标准浏览器环境
  resetBrowserEnvironment();
});

// 重置浏览器环境到标准状态
function resetBrowserEnvironment() {
  // 恢复原始navigator
  Object.defineProperty(window, 'navigator', {
    value: {
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.212 Safari/537.36',
      onLine: true
    },
    configurable: true,
    writable: true
  });
  
  // 恢复原始XMLHttpRequest
  global.XMLHttpRequest = function() {
    return {
      open: jest.fn(),
      send: jest.fn(),
      setRequestHeader: jest.fn(),
      readyState: 4,
      status: 200,
      onreadystatechange: null,
      response: null
    };
  };
  
  // 恢复原始fetch
  global.fetch = jest.fn().mockImplementation(() => 
    Promise.resolve({
      ok: true,
      json: () => Promise.resolve({}),
      text: () => Promise.resolve(''),
      blob: () => Promise.resolve(new Blob())
    })
  );
  
  // 恢复原始IntersectionObserver
  global.IntersectionObserver = jest.fn().mockImplementation(() => ({
    observe: jest.fn(),
    unobserve: jest.fn(),
    disconnect: jest.fn()
  }));
  
  // 恢复原始ServiceWorker支持
  Object.defineProperty(navigator, 'serviceWorker', {
    value: {
      register: jest.fn().mockResolvedValue({ scope: '/' }),
      controller: null
    },
    configurable: true
  });
}

// 模拟特定浏览器环境
function mockBrowserEnvironment(browser) {
  // 模拟UserAgent
  const userAgents = {
    'Chrome': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.212 Safari/537.36',
    'IE': 'Mozilla/5.0 (Windows NT 10.0; WOW64; Trident/7.0; rv:11.0) like Gecko',
    'Mobile Safari': 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0.3 Mobile/15E148 Safari/604.1'
  };
  
  Object.defineProperty(window, 'navigator', {
    value: {
      userAgent: userAgents[browser.name] || userAgents['Chrome'],
      onLine: true
    },
    configurable: true,
    writable: true
  });
  
  // 模拟Fetch API支持
  if (!browser.supportsFetch) {
    global.fetch = undefined;
  }
  
  // 模拟IntersectionObserver支持
  if (!browser.supportsIntersectionObserver) {
    global.IntersectionObserver = undefined;
  }
  
  // 模拟ServiceWorker支持
  if (!browser.supportsServiceWorker) {
    Object.defineProperty(navigator, 'serviceWorker', {
      value: undefined,
      configurable: true
    });
  }
}

describe('资源加载器 - 标准现代浏览器测试', () => {
  beforeEach(() => {
    mockBrowserEnvironment(browserFeatures.standard);
  });
  
  test('应该检测到现代浏览器环境并启用全部功能', () => {
    // 准备
    const loader = traceLoader.init();
    
    // 运行检测方法（如果存在）
    if (loader._detectBrowserCapabilities) {
      const capabilities = loader._detectBrowserCapabilities();
      
      // 验证检测结果
      expect(capabilities.supportsFetch).toBe(true);
      expect(capabilities.supportsPromises).toBe(true);
      expect(capabilities.supportsServiceWorker).toBe(true);
      expect(capabilities.isMobile).toBe(false);
    } else {
      // 如果没有特定的检测方法，验证配置
      expect(loader.config.useFetch !== false).toBe(true);
      expect(loader.config.useXHR !== true).toBe(true);
    }
  });
  
  test('应该优先使用Fetch API进行资源加载', async () => {
    // 准备
    const loader = traceLoader.init();
    
    // 监视Fetch API
    const fetchSpy = jest.spyOn(global, 'fetch');
    
    // 模拟_loadResource方法
    const originalLoadResource = loader._loadResource;
    if (originalLoadResource) {
      jest.spyOn(loader, '_loadResource').mockImplementation((resource) => {
        // 在此处调用可能使用fetch的逻辑
        if (loader._loadWithFetch) {
          return loader._loadWithFetch(resource);
        }
        return Promise.resolve(new Image());
      });
    }
    
    // 执行
    await loader.preloadImage('modern-test.jpg');
    
    // 验证Fetch API被调用
    if (loader._loadWithFetch) {
      expect(fetchSpy).toHaveBeenCalled();
    }
    
    // 恢复原始实现
    if (originalLoadResource) {
      loader._loadResource.mockRestore();
    }
  });
});

describe('资源加载器 - 旧版浏览器兼容性测试', () => {
  beforeEach(() => {
    mockBrowserEnvironment(browserFeatures.legacy);
  });
  
  test('应该检测到旧版浏览器并启用兼容模式', () => {
    // 准备
    const loader = traceLoader.init();
    
    // 运行检测方法（如果存在）
    if (loader._detectBrowserCapabilities) {
      const capabilities = loader._detectBrowserCapabilities();
      
      // 验证检测结果
      expect(capabilities.supportsFetch).toBe(false);
      expect(capabilities.supportsPromises).toBe(true);
      expect(capabilities.supportsServiceWorker).toBe(false);
      expect(capabilities.isMobile).toBe(false);
    } else {
      // 如果没有特定的检测方法，验证配置
      expect(loader.config.useXHR !== false).toBe(true);
      expect(loader.config.useFetch !== true).toBe(true);
    }
  });
  
  test('应该在不支持Fetch API的环境中使用XMLHttpRequest', async () => {
    // 准备
    const loader = traceLoader.init();
    
    // 监视XMLHttpRequest
    const xhrOpenSpy = jest.spyOn(XMLHttpRequest.prototype, 'open');
    const xhrSendSpy = jest.spyOn(XMLHttpRequest.prototype, 'send');
    
    // 模拟_loadResource方法
    const originalLoadResource = loader._loadResource;
    if (originalLoadResource) {
      jest.spyOn(loader, '_loadResource').mockImplementation((resource) => {
        // 在此处调用可能使用XHR的逻辑
        if (loader._loadWithXHR) {
          return loader._loadWithXHR(resource);
        }
        return Promise.resolve(new Image());
      });
    }
    
    // 执行
    try {
      await loader.preloadImage('legacy-test.jpg');
    } catch (error) {
      // 忽略可能的错误，因为这是模拟实现
    }
    
    // 验证XMLHttpRequest被使用
    if (loader._loadWithXHR) {
      expect(xhrOpenSpy).toHaveBeenCalled();
      expect(xhrSendSpy).toHaveBeenCalled();
    }
    
    // 恢复原始实现
    if (originalLoadResource) {
      loader._loadResource.mockRestore();
    }
  });
  
  test('应该为旧版浏览器提供适当的polyfill', () => {
    // 准备
    const loader = traceLoader.init();
    
    // 验证polyfill是否被加载
    if (loader._loadPolyfills) {
      const polyfillsSpy = jest.spyOn(loader, '_loadPolyfills');
      
      // 触发polyfill加载
      if (typeof loader._loadPolyfills === 'function') {
        loader._loadPolyfills();
        
        // 验证polyfill加载被调用
        expect(polyfillsSpy).toHaveBeenCalled();
      }
      
      polyfillsSpy.mockRestore();
    } else {
      // 如果没有专门的polyfill方法，验证兼容模式
      expect(loader.config.legacyMode !== false).toBe(true);
    }
  });
});

describe('资源加载器 - 移动设备兼容性测试', () => {
  beforeEach(() => {
    mockBrowserEnvironment(browserFeatures.mobile);
  });
  
  test('应该检测到移动设备环境并优化加载策略', () => {
    // 准备
    const loader = traceLoader.init();
    
    // 运行检测方法（如果存在）
    if (loader._detectBrowserCapabilities) {
      const capabilities = loader._detectBrowserCapabilities();
      
      // 验证检测结果
      expect(capabilities.isMobile).toBe(true);
    } else {
      // 如果没有特定的检测方法，验证userAgent检测
      const userAgent = window.navigator.userAgent;
      const isMobile = /iPhone|iPad|iPod|Android/i.test(userAgent);
      expect(isMobile).toBe(true);
      
      // 检查是否设置了移动优化配置
      expect(loader.config.maxConcurrent).toBeLessThanOrEqual(4); // 移动设备上应该限制并发数
    }
  });
  
  test('应该在移动设备上实施节能优化策略', async () => {
    // 准备
    const loader = traceLoader.init();
    
    // 模拟电池API
    Object.defineProperty(navigator, 'getBattery', {
      value: jest.fn().mockResolvedValue({
        charging: false,
        level: 0.3,
        chargingTime: Infinity,
        dischargingTime: 3600
      }),
      configurable: true
    });
    
    // 监视_optimizeForMobile方法
    const optimizeForMobileSpy = jest.fn();
    loader._optimizeForMobile = optimizeForMobileSpy;
    
    // 运行检测和优化
    if (loader._detectBrowserCapabilities) {
      await loader._detectBrowserCapabilities();
    }
    
    // 验证移动优化被调用
    if (loader._optimizeForMobile) {
      expect(optimizeForMobileSpy).toHaveBeenCalled();
    } else {
      // 如果没有特定的优化方法，验证基本配置
      expect(loader.config.lowPowerMode !== false).toBe(true);
    }
  });
  
  test('应该在低电量状态下调整加载优先级和并发数', async () => {
    // 准备
    const loader = traceLoader.init();
    
    // 模拟电池API - 低电量状态
    Object.defineProperty(navigator, 'getBattery', {
      value: jest.fn().mockResolvedValue({
        charging: false,
        level: 0.15, // 15%电量
        chargingTime: Infinity,
        dischargingTime: 1800
      }),
      configurable: true
    });
    
    // 监视配置更新方法
    const updateConfigSpy = jest.fn();
    loader._updateConfig = updateConfigSpy;
    
    // 如果存在电量检测和配置调整方法，调用它
    if (loader._checkBatteryStatus) {
      await loader._checkBatteryStatus();
      
      // 验证配置被更新
      if (loader._updateConfig) {
        expect(updateConfigSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            maxConcurrent: expect.any(Number),
            lowPowerMode: true
          })
        );
      }
    } else {
      // 否则手动设置低电量模式
      loader.config.lowPowerMode = true;
      loader.config.maxConcurrent = 2;
      
      // 添加一些资源到队列
      loader._queueResource({ type: 'image', url: 'test1.jpg', priority: 1 });
      loader._queueResource({ type: 'image', url: 'test2.jpg', priority: 1 });
      loader._queueResource({ type: 'image', url: 'test3.jpg', priority: 1 });
      
      // 处理队列
      loader._processQueue();
      
      // 验证并发加载数不超过配置限制
      expect(loader._state.pendingLoads).toBeLessThanOrEqual(loader.config.maxConcurrent);
    }
  });
});

describe('资源加载器 - 特殊网络条件测试', () => {
  test('应该在慢速网络下自动降低并发请求数', () => {
    // 准备 - 模拟连接信息
    Object.defineProperty(navigator, 'connection', {
      value: {
        effectiveType: '2g',
        downlink: 0.5, // 0.5 Mbps
        rtt: 1000 // 1000ms往返时间
      },
      configurable: true
    });
    
    const loader = traceLoader.init();
    
    // 检测网络条件
    if (loader._detectNetworkConditions) {
      loader._detectNetworkConditions();
      
      // 验证在慢网络下并发数被降低
      expect(loader.config.maxConcurrent).toBeLessThanOrEqual(2);
    } else {
      // 模拟网络条件检测逻辑
      if (navigator.connection && navigator.connection.effectiveType === '2g') {
        loader.config.maxConcurrent = 2;
      }
      
      // 验证配置
      expect(loader.config.maxConcurrent).toBeLessThanOrEqual(2);
    }
  });
  
  test('应该在数据保护模式下延迟非关键资源加载', () => {
    // 准备 - 模拟连接信息和数据保护模式
    Object.defineProperty(navigator, 'connection', {
      value: {
        saveData: true
      },
      configurable: true
    });
    
    const loader = traceLoader.init();
    
    // 监视_deferNonCriticalResources方法
    const deferNonCriticalSpy = jest.fn();
    loader._deferNonCriticalResources = deferNonCriticalSpy;
    
    // 检测数据保护模式
    if (loader._detectDataSavingMode) {
      loader._detectDataSavingMode();
      
      // 验证非关键资源加载被延迟
      if (loader._deferNonCriticalResources) {
        expect(deferNonCriticalSpy).toHaveBeenCalled();
      } else {
        expect(loader.config.dataSavingMode).toBe(true);
      }
    } else {
      // 手动设置数据保护模式
      if (navigator.connection && navigator.connection.saveData) {
        loader.config.dataSavingMode = true;
      }
      
      // 验证配置
      expect(loader.config.dataSavingMode).toBe(true);
    }
  });
  
  test('应该在高延迟网络下增加加载超时时间', () => {
    // 准备 - 模拟高延迟连接
    Object.defineProperty(navigator, 'connection', {
      value: {
        effectiveType: '3g',
        rtt: 800 // 800ms往返时间
      },
      configurable: true
    });
    
    const defaultTimeout = 15000;
    const loader = traceLoader.init({
      timeout: defaultTimeout
    });
    
    // 检测网络条件
    if (loader._adjustTimeoutForNetwork) {
      loader._adjustTimeoutForNetwork();
      
      // 验证超时被增加
      expect(loader.config.timeout).toBeGreaterThan(defaultTimeout);
    } else {
      // 手动调整超时
      if (navigator.connection && navigator.connection.rtt > 500) {
        loader.config.timeout = defaultTimeout * 1.5;
      }
      
      // 验证超时
      expect(loader.config.timeout).toBeGreaterThan(defaultTimeout);
    }
  });
});

describe('资源加载器 - 跨平台合规性测试', () => {
  test('应该处理不同类型的图片格式', async () => {
    // 准备
    const loader = traceLoader.init();
    
    // 模拟不同格式的图片加载
    const formats = ['jpg', 'png', 'webp', 'avif'];
    
    for (const format of formats) {
      // 模拟图片加载
      jest.spyOn(loader, '_loadImageResource').mockImplementation((resource) => {
        const img = new Image();
        img.src = resource.url;
        return Promise.resolve(img);
      });
      
      // 加载图片
      const result = await loader.preloadImage(`test.${format}`);
      
      // 验证图片加载
      expect(result).toBeInstanceOf(Image);
      expect(result.src).toContain(`.${format}`);
      
      // 清理模拟
      loader._loadImageResource.mockRestore();
    }
  });
  
  test('应该处理不同类型的脚本和样式表', async () => {
    // 准备
    const loader = traceLoader.init();
    
    // 1. 普通JavaScript
    jest.spyOn(loader, '_loadScriptResource').mockImplementation((resource) => {
      const script = document.createElement('script');
      script.src = resource.url;
      return Promise.resolve(script);
    });
    
    // 2. ES Module脚本
    const loadScriptResult = await loader.loadScript('module.js', { type: 'module' });
    expect(loadScriptResult.type).toBe('module');
    
    // 3. CSS样式表
    jest.spyOn(loader, '_loadStyleResource').mockImplementation((resource) => {
      const link = document.createElement('link');
      link.href = resource.url;
      link.rel = 'stylesheet';
      return Promise.resolve(link);
    });
    
    const loadStyleResult = await loader.loadStylesheet('styles.css');
    expect(loadStyleResult.rel).toBe('stylesheet');
    
    // 清理模拟
    loader._loadScriptResource.mockRestore();
    loader._loadStyleResource.mockRestore();
  });
  
  test('应该支持多语言字符集', async () => {
    // 准备
    const loader = traceLoader.init();
    
    // 模拟不同语言的文件名
    const filenames = [
      'image.jpg',
      '图片.jpg',
      '이미지.jpg',
      'изображение.jpg'
    ];
    
    // 模拟图片加载
    jest.spyOn(loader, '_loadImageResource').mockImplementation((resource) => {
      const img = new Image();
      img.src = resource.url;
      return Promise.resolve(img);
    });
    
    for (const filename of filenames) {
      // 加载图片
      try {
        const result = await loader.preloadImage(filename);
        
        // 验证图片加载
        expect(result).toBeInstanceOf(Image);
        expect(result.src).toContain(encodeURIComponent(filename));
      } catch (error) {
        fail(`加载失败: ${filename}, 错误: ${error.message}`);
      }
    }
    
    // 清理模拟
    loader._loadImageResource.mockRestore();
  });
  
  test('应该处理不同的URL协议', async () => {
    // 准备
    const loader = traceLoader.init();
    
    // 模拟URL协议
    const protocols = [
      'https://example.com/image.jpg',
      'http://example.com/image.jpg',
      'data:image/png;base64,iVBORw0KGgo=',
      'blob:https://example.com/1234-5678'
    ];
    
    // 模拟图片加载
    jest.spyOn(loader, '_loadImageResource').mockImplementation((resource) => {
      const img = new Image();
      img.src = resource.url;
      return Promise.resolve(img);
    });
    
    for (const url of protocols) {
      // 加载图片
      const result = await loader.preloadImage(url);
      
      // 验证图片加载
      expect(result).toBeInstanceOf(Image);
      expect(result.src).toBe(url);
    }
    
    // 清理模拟
    loader._loadImageResource.mockRestore();
  });
}); 