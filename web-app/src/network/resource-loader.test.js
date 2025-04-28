const ResourceLoader = require('./resource-loader').ResourceLoader;

/**
 * @file 资源加载器测试
 * @description 测试资源加载器的核心功能，包括资源加载、缓存管理、重试机制、离线资源处理和批处理能力
 */

// import { ResourceLoader } from './resource-loader';

// 模拟DOM环境
const mockCreateElement = jest.fn();
const mockAppendChild = jest.fn();
const mockRemoveChild = jest.fn();
const mockImage = jest.fn();
const mockAddEventListener = jest.fn();
const mockRemoveEventListener = jest.fn();

// 保存原始navigator.onLine属性
let originalOnLine;

beforeEach(() => {
  // 模拟DOM元素和方法
  document.createElement = mockCreateElement;
  document.head.appendChild = mockAppendChild;
  document.head.removeChild = mockRemoveChild;
  
  // 模拟Image构造函数
  window.Image = mockImage;
  
  // 模拟事件监听
  HTMLElement.prototype.addEventListener = mockAddEventListener;
  HTMLElement.prototype.removeEventListener = mockRemoveEventListener;
  
  // 保存并模拟navigator.onLine属性
  originalOnLine = navigator.onLine;
  Object.defineProperty(navigator, 'onLine', {
    configurable: true,
    get: jest.fn(() => true)
  });
  
  // 重置加载器状态
  traceLoader.reset();
  
  // 清除所有模拟函数的调用记录
  jest.clearAllMocks();
});

afterEach(() => {
  // 恢复原始navigator.onLine属性
  Object.defineProperty(navigator, 'onLine', {
    configurable: true,
    get: () => originalOnLine
  });
});

describe('资源加载器初始化和配置', () => {
  test('应该使用默认配置初始化', () => {
    const loader = new ResourceLoader();
    const config = loader.getConfig();
    
    expect(config.maxConcurrent).toBeDefined();
    expect(config.retryCount).toBeDefined();
    expect(config.retryDelay).toBeDefined();
    expect(config.timeout).toBeDefined();
  });
  
  test('应该接受自定义配置', () => {
    const customConfig = {
      maxConcurrent: 5,
      retryCount: 3,
      retryDelay: 1000,
      timeout: 10000
    };
    
    const loader = new ResourceLoader(customConfig);
    const config = loader.getConfig();
    
    expect(config.maxConcurrent).toBe(5);
    expect(config.retryCount).toBe(3);
    expect(config.retryDelay).toBe(1000);
    expect(config.timeout).toBe(10000);
  });
  
  test('应该能够更新配置', () => {
    const loader = new ResourceLoader();
    
    loader.configure({
      maxConcurrent: 10,
      timeout: 5000
    });
    
    const config = loader.getConfig();
    expect(config.maxConcurrent).toBe(10);
    expect(config.timeout).toBe(5000);
  });
});

describe('事件监听器管理', () => {
  test('应该添加和触发事件监听器', () => {
    const loader = new ResourceLoader();
    const mockCallback = jest.fn();
    
    loader.on('LOAD_COMPLETE', mockCallback);
    loader.emit('LOAD_COMPLETE', { url: 'test.jpg' });
    
    expect(mockCallback).toHaveBeenCalledWith({ url: 'test.jpg' });
  });
  
  test('应该移除特定事件监听器', () => {
    const loader = new ResourceLoader();
    const mockCallback = jest.fn();
    
    loader.on('LOAD_COMPLETE', mockCallback);
    loader.off('LOAD_COMPLETE', mockCallback);
    loader.emit('LOAD_COMPLETE', { url: 'test.jpg' });
    
    expect(mockCallback).not.toHaveBeenCalled();
  });
  
  test('应该移除所有事件监听器', () => {
    const loader = new ResourceLoader();
    const mockCallback1 = jest.fn();
    const mockCallback2 = jest.fn();
    
    loader.on('LOAD_COMPLETE', mockCallback1);
    loader.on('LOAD_ERROR', mockCallback2);
    
    loader.removeAllListeners();
    
    loader.emit('LOAD_COMPLETE', { url: 'test.jpg' });
    loader.emit('LOAD_ERROR', { url: 'test.jpg', error: 'Failed' });
    
    expect(mockCallback1).not.toHaveBeenCalled();
    expect(mockCallback2).not.toHaveBeenCalled();
  });
});

describe('资源加载功能', () => {
  test('应该加载图片资源', (done) => {
    const loader = new ResourceLoader();
    const imageUrl = '/img/logo.png';
    
    loader.on('LOAD_COMPLETE', (data) => {
      expect(data.url).toBe(imageUrl);
      expect(data.type).toBe('image');
      done();
    });
    
    loader.loadImage(imageUrl);
    
    // 验证创建的元素
    expect(mockElements.length).toBe(1);
    expect(mockElements[0].tagName).toBe('IMG');
    expect(mockElements[0].src).toBe(imageUrl);
    
    // 模拟加载完成
    mockElements[0].onload();
  });
  
  test('应该加载脚本资源', (done) => {
    const loader = new ResourceLoader();
    const scriptUrl = '/js/main.js';
    
    loader.on('LOAD_COMPLETE', (data) => {
      expect(data.url).toBe(scriptUrl);
      expect(data.type).toBe('script');
      done();
    });
    
    loader.loadScript(scriptUrl);
    
    // 验证创建的元素
    expect(mockElements.length).toBe(1);
    expect(mockElements[0].tagName).toBe('SCRIPT');
    expect(mockElements[0].src).toBe(scriptUrl);
    
    // 模拟加载完成
    mockElements[0].onload();
  });
  
  test('应该加载样式表资源', (done) => {
    const loader = new ResourceLoader();
    const styleUrl = '/css/style.css';
    
    loader.on('LOAD_COMPLETE', (data) => {
      expect(data.url).toBe(styleUrl);
      expect(data.type).toBe('stylesheet');
      done();
    });
    
    loader.loadStylesheet(styleUrl);
    
    // 验证创建的元素
    expect(mockElements.length).toBe(1);
    expect(mockElements[0].tagName).toBe('LINK');
    expect(mockElements[0].href).toBe(styleUrl);
    expect(mockElements[0].rel).toBe('stylesheet');
    
    // 模拟加载完成
    mockElements[0].onload();
  });
  
  test('应该处理未知资源类型', () => {
    const loader = new ResourceLoader();
    const invalidType = 'invalid';
    
    expect(() => {
      loader.loadResource('/test.xyz', invalidType);
    }).toThrow(/不支持的资源类型/);
  });
  
  test('应该预加载图片资源', (done) => {
    const loader = new ResourceLoader();
    const imageUrl = '/img/logo.png';
    
    loader.on('LOAD_COMPLETE', (data) => {
      expect(data.url).toBe(imageUrl);
      expect(data.preloaded).toBeTruthy();
      done();
    });
    
    loader.preloadImage(imageUrl);
    
    // 验证创建的元素
    expect(mockElements.length).toBe(1);
    expect(mockElements[0].tagName).toBe('IMG');
    
    // 模拟加载完成
    mockElements[0].onload();
  });
});

describe('批量资源加载', () => {
  test('应该加载多个资源并按优先级排序', async () => {
    const loader = new ResourceLoader();
    const resources = [
      { url: '/img/logo.png', type: 'image', priority: 2 },
      { url: '/css/main.css', type: 'stylesheet', priority: 1 },
      { url: '/js/app.js', type: 'script', priority: 3 }
    ];
    
    const loadedResources = [];
    
    loader.on('LOAD_COMPLETE', (data) => {
      loadedResources.push(data.url);
    });
    
    const queueCompletePromise = new Promise((resolve) => {
      loader.on('QUEUE_COMPLETE', resolve);
    });
    
    loader.configure({ maxConcurrent: 1 }); // 一次只加载一个资源
    loader.loadBatch(resources);
    
    // 模拟所有资源加载完成
    mockElements.forEach(element => {
      simulateLoad(element);
    });
    
    await queueCompletePromise;
    
    // 验证加载顺序（按优先级）
    expect(loadedResources[0]).toBe('/css/main.css'); // 优先级 1
    expect(loadedResources[1]).toBe('/img/logo.png'); // 优先级 2
    expect(loadedResources[2]).toBe('/js/app.js');   // 优先级 3
  });
  
  test('应该限制最大并发加载数', () => {
    const loader = new ResourceLoader();
    const resources = [
      { url: '/img/1.png', type: 'image' },
      { url: '/img/2.png', type: 'image' },
      { url: '/img/3.png', type: 'image' },
      { url: '/img/4.png', type: 'image' }
    ];
    
    loader.configure({ maxConcurrent: 2 });
    loader.loadBatch(resources);
    
    // 验证只有两个资源被加载（因为maxConcurrent=2）
    expect(appendedElements.length).toBe(2);
  });
});

describe('缓存管理', () => {
  test('应该缓存已加载的资源', (done) => {
    const loader = new ResourceLoader();
    const imageUrl = '/img/logo.png';
    
    // 第一次加载
    loader.loadImage(imageUrl);
    mockElements[0].onload();
    
    // 验证第二次加载时不会创建新元素
    setTimeout(() => {
      const initialElementsCount = mockElements.length;
      
      loader.on('LOAD_COMPLETE', (data) => {
        expect(data.url).toBe(imageUrl);
        expect(data.fromCache).toBeTruthy();
        expect(mockElements.length).toBe(initialElementsCount); // 没有创建新元素
        done();
      });
      
      loader.loadImage(imageUrl);
    }, 50);
  });
  
  test('应该检查资源是否已缓存', (done) => {
    const loader = new ResourceLoader();
    const imageUrl = '/img/logo.png';
    
    expect(loader.isCached(imageUrl)).toBe(false);
    
    loader.loadImage(imageUrl);
    mockElements[0].onload();
    
    setTimeout(() => {
      expect(loader.isCached(imageUrl)).toBe(true);
      done();
    }, 50);
  });
  
  test('应该从缓存中获取资源', (done) => {
    const loader = new ResourceLoader();
    const imageUrl = '/img/logo.png';
    
    loader.loadImage(imageUrl);
    mockElements[0].onload();
    
    setTimeout(() => {
      const cachedResource = loader.getFromCache(imageUrl);
      expect(cachedResource).toBeDefined();
      expect(cachedResource.url).toBe(imageUrl);
      done();
    }, 50);
  });
  
  test('应该清除缓存', (done) => {
    const loader = new ResourceLoader();
    const imageUrl = '/img/logo.png';
    
    loader.loadImage(imageUrl);
    mockElements[0].onload();
    
    setTimeout(() => {
      loader.clearCache();
      expect(loader.isCached(imageUrl)).toBe(false);
      done();
    }, 50);
  });
});

describe('错误处理和重试机制', () => {
  test('应该处理加载错误', (done) => {
    const loader = new ResourceLoader();
    const imageUrl = '/img/error.png';
    
    loader.configure({ retryCount: 0 }); // 禁用重试
    
    loader.on('LOAD_ERROR', (data) => {
      expect(data.url).toBe(imageUrl);
      expect(data.error).toBeDefined();
      done();
    });
    
    loader.loadImage(imageUrl);
    mockElements[0].onerror(new Error('加载失败'));
  });
  
  test('应该在加载失败时重试', (done) => {
    const loader = new ResourceLoader();
    const imageUrl = '/img/retry.png';
    
    loader.configure({ retryCount: 1, retryDelay: 100 });
    
    let retryCount = 0;
    loader.on('LOAD_ERROR', () => {
      retryCount++;
    });
    
    loader.on('LOAD_COMPLETE', (data) => {
      expect(data.url).toBe(imageUrl);
      expect(retryCount).toBe(1); // 应该只重试一次
      done();
    });
    
    loader.loadImage(imageUrl);
    
    // 第一次加载失败
    mockElements[0].onerror(new Error('第一次加载失败'));
    
    // 模拟重试后成功
    setTimeout(() => {
      expect(mockElements.length).toBe(2); // 应该创建第二个元素用于重试
      mockElements[1].onload(); // 第二次加载成功
    }, 150);
  });
  
  test('应该在达到最大重试次数后报告失败', (done) => {
    const loader = new ResourceLoader();
    const imageUrl = '/img/max-retry.png';
    
    loader.configure({ retryCount: 2, retryDelay: 50 });
    
    let errorCount = 0;
    loader.on('LOAD_ERROR', () => {
      errorCount++;
    });
    
    loader.on('LOAD_FAILURE', (data) => {
      expect(data.url).toBe(imageUrl);
      expect(errorCount).toBe(2); // 应该有2次错误（不包括原始尝试）
      done();
    });
    
    loader.loadImage(imageUrl);
    
    // 原始加载失败
    mockElements[0].onerror(new Error('初始加载失败'));
    
    // 第一次重试失败
    setTimeout(() => {
      mockElements[1].onerror(new Error('第一次重试失败'));
      
      // 第二次重试失败
      setTimeout(() => {
        mockElements[2].onerror(new Error('第二次重试失败'));
      }, 60);
    }, 60);
  });
});

describe('离线模式处理', () => {
  test('应该检测离线状态', () => {
    const loader = new ResourceLoader();
    
    // 模拟设备离线
    Object.defineProperty(navigator, 'onLine', {
      configurable: true,
      get: jest.fn(() => false),
    });
    
    expect(loader.isOnline()).toBe(false);
  });
  
  test('应该在离线时不发起网络请求', () => {
    const loader = new ResourceLoader();
    const imageUrl = '/img/offline.png';
    
    // 模拟设备离线
    Object.defineProperty(navigator, 'onLine', {
      configurable: true,
      get: jest.fn(() => false),
    });
    
    const mockCallback = jest.fn();
    loader.on('LOAD_OFFLINE', mockCallback);
    
    loader.loadImage(imageUrl);
    
    expect(mockCallback).toHaveBeenCalledWith(expect.objectContaining({
      url: imageUrl,
      type: 'image'
    }));
    expect(appendedElements.length).toBe(0); // 不应该添加元素到DOM
  });
  
  test('应该在网络恢复时加载挂起的请求', (done) => {
    const loader = new ResourceLoader();
    const imageUrl = '/img/pending.png';
    
    // 模拟设备离线
    Object.defineProperty(navigator, 'onLine', {
      configurable: true,
      get: jest.fn(() => false),
    });
    
    // 请求资源（会被添加到挂起队列）
    loader.loadImage(imageUrl);
    
    // 验证资源被添加到挂起队列
    expect(loader.getPendingRequests().length).toBe(1);
    
    // 模拟网络恢复
    Object.defineProperty(navigator, 'onLine', {
      configurable: true,
      get: jest.fn(() => true),
    });
    
    // 监听加载完成事件
    loader.on('LOAD_COMPLETE', (data) => {
      expect(data.url).toBe(imageUrl);
      expect(loader.getPendingRequests().length).toBe(0); // 挂起队列应该清空
      done();
    });
    
    // 触发网络恢复事件
    loader.handleOnlineEvent();
    
    // 模拟加载完成
    setTimeout(() => {
      expect(mockElements.length).toBe(1);
      mockElements[0].onload();
    }, 50);
  });
});

describe('性能和状态管理', () => {
  test('应该限制并发加载数', () => {
    const loader = new ResourceLoader();
    loader.configure({ maxConcurrent: 3 });
    
    // 加载5个资源
    for (let i = 0; i < 5; i++) {
      loader.loadImage(`/img/test${i}.png`);
    }
    
    // 应该只有3个资源被添加到DOM（因为maxConcurrent=3）
    expect(appendedElements.length).toBe(3);
    
    // 模拟一个资源加载完成
    mockElements[0].onload();
    
    // 应该加载下一个等待的资源
    expect(appendedElements.length).toBe(4);
  });
  
  test('应该跟踪加载统计信息', (done) => {
    const loader = new ResourceLoader();
    
    // 加载两个成功的资源和一个失败的资源
    loader.loadImage('/img/success1.png');
    loader.loadImage('/img/success2.png');
    loader.loadImage('/img/error.png');
    
    // 模拟两个成功一个失败
    mockElements[0].onload();
    mockElements[1].onload();
    mockElements[2].onerror(new Error('加载失败'));
    
    setTimeout(() => {
      const stats = loader.getStats();
      expect(stats.total).toBe(3);
      expect(stats.success).toBe(2);
      expect(stats.failed).toBe(1);
      done();
    }, 50);
  });
  
  test('应该重置加载器状态', (done) => {
    const loader = new ResourceLoader();
    
    // 加载一个资源并缓存
    loader.loadImage('/img/reset-test.png');
    mockElements[0].onload();
    
    setTimeout(() => {
      // 验证资源已缓存
      expect(loader.isCached('/img/reset-test.png')).toBe(true);
      
      // 重置加载器
      loader.reset();
      
      // 验证状态已重置
      expect(loader.isCached('/img/reset-test.png')).toBe(false);
      expect(loader.getStats().total).toBe(0);
      done();
    }, 50);
  });
}); 