/**
 * @file loader-enhanced.test.js
 * @description 资源加载器优化版测试 - 食品溯源系统
 * @jest-environment jsdom
 */

// CommonJS导入，不使用ES6模块语法
const traceLoader = require('../../../components/modules/auth/loader');

// TODO: 此测试文件存在超时问题，暂时跳过
// 模拟DOM环境
beforeEach(() => {
  // 重置加载器状态
  traceLoader._state.loadedResources.clear();
  traceLoader._state.loadQueue = [];
  traceLoader._state.pendingLoads = 0;
  traceLoader._state.listeners = new Map();
  
  // 模拟document.head
  if (!document.head) {
    document.head = document.createElement('head');
    document.documentElement.appendChild(document.head);
  }
  
  // 重置文档头，移除之前测试添加的元素
  document.head.innerHTML = '';
  
  // 模拟Image对象
  global.Image = class {
    constructor() {
      this.onload = null;
      this.onerror = null;
      this.src = null;
      
      // 添加事件监听器支持
      this.addEventListener = jest.fn((event, callback) => {
        this['on' + event] = callback;
      });
    }
  };
  
  // 模拟setTimeout和clearTimeout
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

// 使用describe.skip跳过整个测试套件 - 移除这个跳过标记
describe('资源加载器 - 增强功能测试', () => {
  test('应该能正确初始化，并设置配置选项', () => {
    // 使用自定义配置初始化
    const loader = traceLoader.init({
      timeout: 10000,
      maxConcurrent: 3,
      retryAttempts: 1
    });
    
    expect(loader).toBe(traceLoader);
    expect(loader.config.timeout).toBe(10000);
    expect(loader.config.maxConcurrent).toBe(3);
    expect(loader.config.retryAttempts).toBe(1);
    expect(loader.config.cacheEnabled).toBe(true); // 默认值保持不变
  });
  
  test('事件系统应该能注册和触发事件', () => {
    const loader = traceLoader.init();
    const mockCallback = jest.fn();
    
    // 注册事件监听器
    const removeListener = loader.on(loader.events.LOAD_START, mockCallback);
    
    // 模拟触发事件
    loader._trigger(loader.events.LOAD_START, { resource: { url: 'test.png' } });
    
    // 验证回调被调用
    expect(mockCallback).toHaveBeenCalledWith({ resource: { url: 'test.png' } });
    
    // 移除监听器
    removeListener();
    
    // 再次触发事件
    loader._trigger(loader.events.LOAD_START, { resource: { url: 'test2.png' } });
    
    // 验证回调没有再次被调用
    expect(mockCallback).toHaveBeenCalledTimes(1);
  });
  
  test('预加载图标应该创建批量加载任务', () => {
    const loader = traceLoader.init();
    
    // 间谍loadResources方法
    const loadResourcesSpy = jest.spyOn(loader, 'loadResources');
    loadResourcesSpy.mockResolvedValue([]);
    
    // 预加载图标
    loader.preloadIcons(['home', 'user', 'settings'], 3);
    
    // 验证loadResources被调用，并且参数正确
    expect(loadResourcesSpy).toHaveBeenCalledWith([
      expect.objectContaining({
        type: 'image',
        url: expect.stringContaining('home.svg'),
        id: 'icon_home',
        priority: 3
      }),
      expect.objectContaining({
        type: 'image',
        url: expect.stringContaining('user.svg'),
        id: 'icon_user',
        priority: 3
      }),
      expect.objectContaining({
        type: 'image',
        url: expect.stringContaining('settings.svg'),
        id: 'icon_settings',
        priority: 3
      })
    ]);
    
    loadResourcesSpy.mockRestore();
  });
  
  test('加载脚本应该创建脚本元素并添加到document.head', async () => {
    const loader = traceLoader.init();
    
    // 模拟脚本加载成功
    jest.spyOn(document, 'createElement').mockImplementation((tag) => {
      if (tag === 'script') {
        const script = {
          type: '',
          src: '',
          async: false,
          defer: false,
          onload: null,
          onerror: null
        };
        
        // 模拟添加到DOM的行为
        Object.defineProperty(script, 'src', {
          set(value) {
            this._src = value;
            // 模拟脚本加载
            setTimeout(() => {
              if (this.onload) this.onload();
            }, 50);
          },
          get() {
            return this._src;
          }
        });
        
        return script;
      }
      return document.createElement(tag);
    });
    
    // 监视document.head.appendChild
    const appendChildSpy = jest.spyOn(document.head, 'appendChild');
    
    // 加载脚本
    const scriptPromise = loader.loadScript('test.js', { async: true, defer: true, priority: 5 });
    
    // 快进定时器
    jest.advanceTimersByTime(100);
    
    // 等待脚本加载完成
    const script = await scriptPromise;
    
    // 验证脚本元素被创建并添加到文档头
    expect(appendChildSpy).toHaveBeenCalledWith(expect.objectContaining({ 
      src: 'test.js', 
      async: true,
      defer: true
    }));
    
    // 验证返回的是脚本元素
    expect(script).toHaveProperty('src');
    expect(script.src).toBe('test.js');
    
    // 恢复原始实现
    document.createElement.mockRestore();
    appendChildSpy.mockRestore();
  });
  
  test('加载样式表应该创建链接元素并添加到document.head', async () => {
    const loader = traceLoader.init();
    
    // 模拟链接元素创建
    jest.spyOn(document, 'createElement').mockImplementation((tag) => {
      if (tag === 'link') {
        const link = {
          rel: '',
          type: '',
          href: '',
          onload: null,
          onerror: null
        };
        
        // 模拟添加到DOM的行为
        Object.defineProperty(link, 'href', {
          set(value) {
            this._href = value;
            // 模拟样式表加载
            setTimeout(() => {
              if (this.onload) this.onload();
            }, 50);
          },
          get() {
            return this._href;
          }
        });
        
        return link;
      }
      return document.createElement(tag);
    });
    
    // 监视document.head.appendChild
    const appendChildSpy = jest.spyOn(document.head, 'appendChild');
    
    // 加载样式表
    const stylePromise = loader.loadStylesheet('styles.css', { priority: 4 });
    
    // 快进定时器
    jest.advanceTimersByTime(100);
    
    // 等待样式表加载完成
    const link = await stylePromise;
    
    // 验证链接元素被创建并添加到文档头
    expect(appendChildSpy).toHaveBeenCalledWith(expect.objectContaining({ 
      href: 'styles.css', 
      rel: 'stylesheet'
    }));
    
    // 验证返回的是链接元素
    expect(link).toHaveProperty('href');
    expect(link.href).toBe('styles.css');
    
    // 恢复原始实现
    document.createElement.mockRestore();
    appendChildSpy.mockRestore();
  });
  
  test('资源加载超时应该触发错误处理', async () => {
    // 初始化加载器，设置较短超时时间
    const loader = traceLoader.init({ timeout: 100 });
    
    // 模拟图片加载，但不触发onload
    jest.spyOn(loader, '_loadImageResource').mockImplementation((resource) => {
      return new Promise((resolve, reject) => {
        const img = new Image();
        img.src = resource.url;
        
        // 这里不调用onload，让操作超时
        return img;
      });
    });
    
    // 监视错误处理
    const errorHandlerSpy = jest.spyOn(loader, 'handleResourceError').mockImplementation(() => {});
    
    // 预加载图片
    const imagePromise = loader.preloadImage('timeout-test.jpg');
    
    // 快进定时器超过超时时间
    jest.advanceTimersByTime(200);
    
    try {
      // 等待图片加载，应该抛出超时错误
      await imagePromise;
      // 如果没有抛出错误，测试失败
      expect(false).toBe(true);
    } catch (error) {
      // 验证错误处理被调用
      expect(errorHandlerSpy).toHaveBeenCalled();
    }
    
    // 恢复原始实现
    loader._loadImageResource.mockRestore();
    errorHandlerSpy.mockRestore();
  });
  
  test('资源队列应该限制并发加载数量', () => {
    const loader = traceLoader.init({ maxConcurrent: 2 });
    
    // 模拟资源加载
    const loadResourceSpy = jest.spyOn(loader, '_loadResource').mockImplementation(() => {
      return new Promise(resolve => setTimeout(resolve, 100));
    });
    
    // 添加5个资源到队列
    for (let i = 1; i <= 5; i++) {
      loader._queueResource({ type: 'image', url: `test${i}.jpg`, id: `test${i}` });
    }
    
    // 处理队列
    loader._processQueue();
    
    // 验证只有2个资源正在加载，其余的在队列中
    expect(loader._state.pendingLoads).toBe(2);
    expect(loader._state.loadQueue.length).toBe(3); // 剩余3个在队列中
    
    // 恢复原始实现
    loadResourceSpy.mockRestore();
  });
  
  test('资源队列应该按优先级排序', () => {
    const loader = traceLoader.init();
    
    // 模拟资源加载
    jest.spyOn(loader, '_loadResource').mockImplementation(() => {
      return new Promise(resolve => setTimeout(resolve, 100));
    });
    
    // 添加不同优先级的资源
    loader._queueResource({ type: 'image', url: 'low.jpg', priority: 1 });
    loader._queueResource({ type: 'script', url: 'highest.js', priority: 5 });
    loader._queueResource({ type: 'style', url: 'medium.css', priority: 3 });
    
    // 验证队列按优先级排序
    expect(loader._state.loadQueue[0].url).toBe('highest.js');
    expect(loader._state.loadQueue[1].url).toBe('medium.css');
    expect(loader._state.loadQueue[2].url).toBe('low.jpg');
  });
  
  test('资源缓存应该正常工作', async () => {
    const loader = traceLoader.init({ cacheEnabled: true });
    
    // 模拟图片加载成功
    jest.spyOn(loader, '_loadImageResource').mockImplementation((resource) => {
      return new Promise((resolve) => {
        const img = new Image();
        img.src = resource.url;
        
        // 模拟延迟加载完成
        setTimeout(() => {
          if (img.onload) img.onload();
          resolve(img);
        }, 50);
        
        return img;
      });
    });
    
    // 第一次加载图片
    const loadSpy = jest.spyOn(loader, '_loadImageResource');
    
    // 加载图片
    const imagePromise = loader.preloadImage('cached.jpg');
    
    // 快进定时器
    jest.advanceTimersByTime(100);
    
    // 等待图片加载
    await imagePromise;
    
    // 验证图片被缓存
    expect(loader._state.loadedResources.has('cached.jpg')).toBe(true);
    
    // 重置间谍计数
    loadSpy.mockClear();
    
    // 再次加载相同图片
    await loader.preloadImage('cached.jpg');
    
    // 验证第二次加载没有调用_loadImageResource（使用了缓存）
    expect(loadSpy).not.toHaveBeenCalled();
    
    // 获取缓存的资源
    const cachedResource = loader.getCachedResource('cached.jpg');
    expect(cachedResource).toBeDefined();
    
    // 清除特定资源缓存
    loader.clearCache('cached.jpg');
    expect(loader._state.loadedResources.has('cached.jpg')).toBe(false);
    
    // 添加多个资源到缓存
    await loader.preloadImage('test1.jpg');
    await loader.preloadImage('test2.jpg');
    expect(loader._state.loadedResources.size).toBe(2);
    
    loader.clearCache(); // 清除所有缓存
    expect(loader._state.loadedResources.size).toBe(0);
    
    // 恢复原始实现
    loader._loadImageResource.mockRestore();
  });
  
  test('应该能获取加载器统计信息', () => {
    const loader = traceLoader.init();
    
    // 模拟资源状态
    loader._state.loadedResources.set('test1.jpg', {});
    loader._state.loadedResources.set('test2.jpg', {});
    loader._state.pendingLoads = 3;
    loader._state.loadQueue = [{}, {}, {}, {}];
    
    // 获取统计信息
    const stats = loader.getStats();
    
    // 验证统计信息
    expect(stats.cached).toBe(2);
    expect(stats.pending).toBe(3);
    expect(stats.queued).toBe(4);
  });
  
  test('资源加载错误应该触发错误事件', async () => {
    const loader = traceLoader.init();
    
    // 模拟图片加载失败
    jest.spyOn(loader, '_loadImageResource').mockImplementation((resource) => {
      return new Promise((resolve, reject) => {
        const img = new Image();
        
        // 模拟延迟加载失败
        setTimeout(() => {
          const error = new Error('加载失败');
          if (img.onerror) img.onerror(error);
          reject(error);
        }, 50);
        
        return img;
      });
    });
    
    // 注册错误事件监听器
    const errorCallback = jest.fn();
    loader.on(loader.events.LOAD_ERROR, errorCallback);
    
    // 预加载图片，应该失败
    const imagePromise = loader.preloadImage('error.jpg');
    
    // 快进定时器
    jest.advanceTimersByTime(100);
    
    try {
      // 等待图片加载，应该抛出错误
      await imagePromise;
      // 如果没有抛出错误，测试失败
      expect(false).toBe(true);
    } catch (error) {
      // 验证错误回调被调用
      expect(errorCallback).toHaveBeenCalled();
      expect(error.message).toBe('加载失败');
    }
    
    // 恢复原始实现
    loader._loadImageResource.mockRestore();
  });
}); 