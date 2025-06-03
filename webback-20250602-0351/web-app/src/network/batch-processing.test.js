/**
 * @file 资源批量处理测试
 * @description 测试资源批量加载功能，包括优先级处理、并发控制和重试机制
 */

const { traceLoader, EVENTS } = require('./resource-loader');
const { NetworkMonitor } = require('./network-monitor');

describe('资源批量处理测试', () => {
  // 模拟文档环境
  let mockImage, mockScript, mockLink;
  let mockOnloadCallback, mockOnerrorCallback;
  let originalCreateElement;
  
  // 在每个测试前设置
  beforeEach(() => {
    // 重置加载器状态
    traceLoader.reset();
    
    // 模拟DOM元素
    mockImage = {
      onload: null,
      onerror: null,
      src: ''
    };
    
    mockScript = {
      onload: null,
      onerror: null,
      src: '',
      async: false
    };
    
    mockLink = {
      onload: null,
      onerror: null,
      href: '',
      rel: ''
    };
    
    // 保存原始createElement方法
    originalCreateElement = document.createElement;
    
    // 模拟createElement方法
    document.createElement = (tagName) => {
      if (tagName === 'img') return mockImage;
      if (tagName === 'script') return mockScript;
      if (tagName === 'link') return mockLink;
      return originalCreateElement.call(document, tagName);
    };
    
    // 模拟性能计时器
    if (!window.performance) {
      window.performance = {};
    }
    window.performance.now = jest.fn(() => Date.now());
    
    // 设置导航器在线状态
    Object.defineProperty(navigator, 'onLine', {
      configurable: true,
      value: true
    });
  });
  
  // 在每个测试后清理
  afterEach(() => {
    // 恢复原始createElement方法
    document.createElement = originalCreateElement;
    
    // 清理事件监听器
    traceLoader.removeAllListeners();
    
    // 清理模拟函数
    jest.clearAllMocks();
  });
  
  // 测试批量加载初始化和配置
  test('应该使用默认配置初始化批处理', () => {
    expect(traceLoader.getMaxConcurrent()).toBe(4); // 默认最大并发数
    expect(traceLoader.getRetryCount()).toBe(3);    // 默认重试次数
  });
  
  test('应该可以自定义批处理配置', () => {
    traceLoader.configure({
      maxConcurrent: 8,
      maxRetries: 5
    });
    expect(traceLoader.getMaxConcurrent()).toBe(8);
    expect(traceLoader.getRetryCount()).toBe(5);
  });
  
  // 测试基本批量加载功能
  test('应该可以批量加载多个资源', (done) => {
    const resources = [
      { id: 'img1', type: 'image', url: 'img1.jpg', priority: 2 },
      { id: 'img2', type: 'image', url: 'img2.jpg', priority: 1 },
      { id: 'script1', type: 'script', url: 'script1.js', priority: 3 }
    ];
    
    const loadedResources = [];
    
    traceLoader.addEventListener(EVENTS.RESOURCE_LOADED, (event) => {
      loadedResources.push(event.detail.resource.id);
      
      if (loadedResources.length === resources.length) {
        // 验证加载顺序应该基于优先级（数字越小优先级越高）
        expect(loadedResources[0]).toBe('img2');
        expect(loadedResources[2]).toBe('script1');
        done();
      }
    });
    
    traceLoader.loadBatch(resources);
    
    // 触发模拟加载完成
    setTimeout(() => {
      mockImage.onload();
      setTimeout(() => {
        mockImage.onload();
        setTimeout(() => {
          mockScript.onload();
        }, 10);
      }, 10);
    }, 10);
  });
  
  test('应该遵守最大并发加载限制', () => {
    // 配置最大并发数为2
    traceLoader.configure({ maxConcurrent: 2 });
    
    // 创建5个资源
    const resources = Array.from({ length: 5 }, (_, i) => ({
      id: `res${i}`,
      type: 'image',
      url: `img${i}.jpg`,
      priority: i
    }));
    
    // 添加事件监听器追踪活动加载数
    let maxActiveLoads = 0;
    let currentActiveLoads = 0;
    
    traceLoader.addEventListener(EVENTS.LOAD_STARTED, () => {
      currentActiveLoads++;
      maxActiveLoads = Math.max(maxActiveLoads, currentActiveLoads);
    });
    
    traceLoader.addEventListener(EVENTS.RESOURCE_LOADED, () => {
      currentActiveLoads--;
    });
    
    // 加载批次
    traceLoader.loadBatch(resources);
    
    // 触发所有加载完成
    for (let i = 0; i < 5; i++) {
      mockImage.onload();
    }
    
    // 验证最大并发数未超过限制
    expect(maxActiveLoads).toBeLessThanOrEqual(2);
  });
  
  // 测试批处理重试机制
  test('应该在批处理期间重试失败的资源', (done) => {
    // 配置重试次数为2
    traceLoader.configure({ maxRetries: 2 });
    
    const resource = { id: 'img1', type: 'image', url: 'img1.jpg' };
    let retryCount = 0;
    
    traceLoader.addEventListener(EVENTS.LOAD_ERROR, () => {
      retryCount++;
    });
    
    traceLoader.addEventListener(EVENTS.RESOURCE_LOADED, () => {
      expect(retryCount).toBe(1); // 应该有1次重试
      done();
    });
    
    traceLoader.loadBatch([resource]);
    
    // 第一次加载失败
    mockImage.onerror();
    
    // 重试成功
    setTimeout(() => {
      mockImage.onload();
    }, 50);
  });
  
  // 测试队列完成事件
  test('应该在批处理完成后触发队列完成事件', (done) => {
    const resources = [
      { id: 'img1', type: 'image', url: 'img1.jpg' },
      { id: 'img2', type: 'image', url: 'img2.jpg' }
    ];
    
    traceLoader.addEventListener(EVENTS.QUEUE_COMPLETE, (event) => {
      expect(event.detail.successful).toBe(2);
      expect(event.detail.failed).toBe(0);
      expect(traceLoader.getQueueLength()).toBe(0); // 队列应该已清空
      done();
    });
    
    traceLoader.loadBatch(resources);
    
    // 触发所有加载完成
    mockImage.onload();
    mockImage.onload();
  });
  
  // 测试动态优先级调整
  test('应该能够在批处理过程中调整资源优先级', () => {
    const resources = [
      { id: 'img1', type: 'image', url: 'img1.jpg', priority: 3 },
      { id: 'img2', type: 'image', url: 'img2.jpg', priority: 2 },
      { id: 'img3', type: 'image', url: 'img3.jpg', priority: 1 }
    ];
    
    traceLoader.loadBatch(resources);
    
    // 改变优先级
    traceLoader.updatePriority('img1', 0); // 现在img1应该是最高优先级
    
    // 获取当前队列
    const queue = traceLoader.getQueue();
    
    // 验证队列顺序已更新
    expect(queue[0].id).toBe('img1');
  });
  
  // 性能测试
  test('批量加载应该比单个加载更高效', (done) => {
    // 创建10个资源
    const resources = Array.from({ length: 10 }, (_, i) => ({
      id: `res${i}`,
      type: 'image',
      url: `img${i}.jpg`
    }));
    
    let batchTime, individualTime;
    
    // 测试批量加载时间
    const batchStartTime = performance.now();
    
    traceLoader.addEventListener(EVENTS.QUEUE_COMPLETE, () => {
      batchTime = performance.now() - batchStartTime;
      
      // 重置加载器
      traceLoader.reset();
      
      // 测试单个加载时间
      const individualStartTime = performance.now();
      let loadedCount = 0;
      
      const loadNext = (index) => {
        if (index >= resources.length) {
          individualTime = performance.now() - individualStartTime;
          
          // 比较时间，批量加载应该更快
          // 注意：这是一个近似比较，因为模拟环境可能不会显示真正的性能差异
          expect(individualTime).toBeGreaterThanOrEqual(batchTime);
          done();
          return;
        }
        
        traceLoader.addEventListener(EVENTS.RESOURCE_LOADED, function onLoaded() {
          traceLoader.removeEventListener(EVENTS.RESOURCE_LOADED, onLoaded);
          loadNext(index + 1);
        });
        
        traceLoader.load(resources[index]);
        mockImage.onload();
      };
      
      loadNext(0);
    });
    
    traceLoader.loadBatch(resources);
    
    // 触发所有批量加载完成
    for (let i = 0; i < 10; i++) {
      mockImage.onload();
    }
  });
  
  // 压力测试
  test('应该能够处理大批量资源', (done) => {
    // 创建50个资源的大批次
    const resources = Array.from({ length: 50 }, (_, i) => ({
      id: `res${i}`,
      type: 'image',
      url: `img${i}.jpg`,
      priority: Math.floor(Math.random() * 10) // 随机优先级
    }));
    
    let loadedCount = 0;
    
    traceLoader.addEventListener(EVENTS.RESOURCE_LOADED, () => {
      loadedCount++;
    });
    
    traceLoader.addEventListener(EVENTS.QUEUE_COMPLETE, (event) => {
      expect(loadedCount).toBe(50);
      expect(event.detail.successful).toBe(50);
      expect(event.detail.failed).toBe(0);
      done();
    });
    
    traceLoader.loadBatch(resources);
    
    // 模拟所有资源加载完成
    for (let i = 0; i < 50; i++) {
      mockImage.onload();
    }
  });
  
  // 模拟网络状态变化的批处理测试
  test('应该正确处理批处理期间的网络状态变化', (done) => {
    const resources = [
      { id: 'img1', type: 'image', url: 'img1.jpg' },
      { id: 'img2', type: 'image', url: 'img2.jpg' }
    ];
    
    let loadedBeforeOffline = 0;
    let remainingAfterOnline = 0;
    
    traceLoader.addEventListener(EVENTS.RESOURCE_LOADED, () => {
      if (navigator.onLine) {
        remainingAfterOnline++;
      } else {
        loadedBeforeOffline++;
      }
    });
    
    traceLoader.addEventListener(EVENTS.QUEUE_COMPLETE, () => {
      expect(loadedBeforeOffline).toBe(1); // 断网前加载了1个
      expect(remainingAfterOnline).toBe(1); // 恢复网络后加载了1个
      done();
    });
    
    traceLoader.loadBatch(resources);
    
    // 第一个资源加载成功
    mockImage.onload();
    
    // 模拟网络断开
    Object.defineProperty(navigator, 'onLine', {
      configurable: true,
      value: false
    });
    
    // 触发网络状态变化事件
    window.dispatchEvent(new Event('offline'));
    
    // 模拟网络恢复
    setTimeout(() => {
      Object.defineProperty(navigator, 'onLine', {
        configurable: true,
        value: true
      });
      
      // 触发网络状态变化事件
      window.dispatchEvent(new Event('online'));
      
      // 完成剩余加载
      setTimeout(() => {
        mockImage.onload();
      }, 50);
    }, 100);
  });
});