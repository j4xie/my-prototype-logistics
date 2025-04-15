/**
 * 资源加载模块 (loader.js) 的扩展单元测试
 * 此测试文件关注尚未覆盖的loader.js功能，如资源队列、处理和加载特定类型的资源
 * @version 1.0.0
 * @jest-environment jsdom
 */

// 设置全局测试超时为15秒
jest.setTimeout(15000);

const traceLoader = require('../../../components/modules/auth/loader');

// 每次测试前重置模块和启用假计时器
beforeEach(() => {
  jest.resetModules();
  // 启用Jest假计时器
  jest.useFakeTimers();
  // 清除所有计时器，避免测试之间的干扰
  jest.clearAllTimers();
  
  // 重置 loader 状态
  if (traceLoader._state) {
    traceLoader._state.loadedResources.clear();
    traceLoader._state.pendingLoads = 0;
    traceLoader._state.loadQueue = [];
    traceLoader._state.listeners.clear();
  }
  
  // 清理 DOM
  document.head.innerHTML = '';
  document.body.innerHTML = '';
});

// 每次测试后恢复真实计时器并清理环境
afterEach(() => {
  // 恢复真实计时器
  jest.useRealTimers();
  // 清理所有模拟
  jest.restoreAllMocks();
  // 彻底清理DOM
  document.head.innerHTML = '';
  document.body.innerHTML = '';
});

describe('资源队列和批量加载测试', () => {
  test('loadResources应该能批量加载多个资源', () => {
    // 准备
    const loader = traceLoader.init();
    
    // 模拟_loadResource方法，避免实际加载资源
    jest.spyOn(loader, '_loadResource').mockImplementation((resource) => {
      return Promise.resolve({ ...resource, loaded: true });
    });
    
    // 测试批量加载多种资源类型
    const resources = [
      { type: 'image', url: 'test1.jpg', id: 'img1', priority: 1 },
      { type: 'script', url: 'test.js', id: 'script1', priority: 2 },
      { type: 'style', url: 'test.css', id: 'style1', priority: 3 }
    ];
    
    // 执行
    return loader.loadResources(resources)
      .then(results => {
        // 确保异步执行完成
        jest.runAllTimers();
        
        // 验证
        expect(results.length).toBe(3);
        expect(results[0].id).toBe('img1');
        expect(results[1].id).toBe('script1');
        expect(results[2].id).toBe('style1');
        expect(loader._loadResource).toHaveBeenCalledTimes(3);
      });
  });
  
  test('loadResources应该对非数组输入返回空数组', () => {
    const loader = traceLoader.init();
    return loader.loadResources('not-an-array')
      .then(result => {
        expect(result).toEqual([]);
      });
  });
  
  test('loadResources应该对空数组返回空数组', () => {
    const loader = traceLoader.init();
    return loader.loadResources([])
      .then(result => {
        expect(result).toEqual([]);
      });
  });
  
  test('_queueResource应该根据优先级对资源进行排序', () => {
    // 准备
    const loader = traceLoader.init();
    
    // 模拟资源
    const lowPriorityResource = { type: 'image', url: 'low.jpg', priority: 1 };
    const highPriorityResource = { type: 'image', url: 'high.jpg', priority: 5 };
    const mediumPriorityResource = { type: 'image', url: 'medium.jpg', priority: 3 };
    
    // 执行
    loader._queueResource(lowPriorityResource);
    loader._queueResource(highPriorityResource);
    loader._queueResource(mediumPriorityResource);
    
    // 验证队列排序
    expect(loader._state.loadQueue[0].priority).toBe(5); // 高优先级排在前面
    expect(loader._state.loadQueue[1].priority).toBe(3);
    expect(loader._state.loadQueue[2].priority).toBe(1);
  });
  
  test('_queueResource应该处理缓存资源', () => {
    // 准备
    const loader = traceLoader.init({ cacheEnabled: true });
    const cachedResource = { id: 'cached-img', loaded: true };
    loader._state.loadedResources.set('cached-img', cachedResource);
    
    // 验证缓存被添加
    expect(loader._state.loadedResources.has('cached-img')).toBe(true);
    
    // 执行 - 尝试加载已缓存的资源
    loader._queueResource({ type: 'image', url: 'test.jpg', id: 'cached-img' });
    
    // 验证缓存仍然存在
    expect(loader._state.loadedResources.has('cached-img')).toBe(true);
  });
});

describe('资源加载细节测试', () => {
  test('_loadImageResource应该创建Image元素并加载图片', () => {
    // 准备
    const loader = traceLoader.init();
    const mockImage = {};
    
    // 模拟全局Image构造函数
    global.Image = jest.fn(() => mockImage);
    
    // 资源对象
    const resource = { type: 'image', url: 'test.jpg', id: 'img1' };
    
    // 执行
    const promise = loader._loadImageResource(resource);
    
    // 模拟加载完成
    mockImage.onload && mockImage.onload();
    
    // 验证
    return promise.then(result => {
      expect(result).toBe(mockImage);
      expect(mockImage.src).toBe('test.jpg');
    });
  });
  
  test('_loadScriptResource应该创建script元素并添加到DOM', () => {
    // 准备
    const loader = traceLoader.init();
    
    // 模拟document.createElement
    const mockScript = document.createElement('script');
    
    // 为mockScript添加setAttribute方法的间谍
    mockScript.setAttribute = jest.fn(mockScript.setAttribute);
    
    // 资源对象
    const resource = { 
      type: 'script', 
      url: 'test.js', 
      id: 'script1',
      async: true,
      defer: false
    };
    
    // 监视document.head.appendChild并模拟脚本加载
    jest.spyOn(document.head, 'appendChild').mockImplementation((script) => {
      setTimeout(() => script.onload && script.onload(), 10);
      return script;
    });
    
    // 执行
    const promise = loader._loadScriptResource(resource);
    
    // 前进时间以触发setTimeout回调
    jest.advanceTimersByTime(20);
    
    // 验证
    return promise.then(result => {
      // 验证脚本元素被正确创建
      expect(result.tagName.toLowerCase()).toBe('script');
      // 验证属性被正确设置
      expect(result.src).toContain('test.js');
      expect(result.async).toBeTruthy();
      // 验证脚本被添加到DOM
      expect(document.head.appendChild).toHaveBeenCalled();
    });
  });
  
  test('_loadStyleResource应该创建link元素并添加到DOM', () => {
    // 准备
    const loader = traceLoader.init();
    
    // 模拟document.createElement以返回真实DOM元素
    const mockLink = document.createElement('link');
    
    // 为mockLink添加setAttribute方法的间谍
    mockLink.setAttribute = jest.fn(mockLink.setAttribute);
    
    // 资源对象
    const resource = { 
      type: 'style', 
      url: 'test.css', 
      id: 'style1'
    };
    
    // 监视document.head.appendChild并模拟样式表加载
    jest.spyOn(document.head, 'appendChild').mockImplementation((link) => {
      setTimeout(() => link.onload && link.onload(), 10);
      return link;
    });
    
    // 执行
    const promise = loader._loadStyleResource(resource);
    
    // 前进时间以触发setTimeout回调
    jest.advanceTimersByTime(20);
    
    // 验证
    return promise.then(result => {
      // 验证链接元素被正确创建
      expect(result.tagName.toLowerCase()).toBe('link');
      // 验证属性被正确设置
      expect(result.href).toContain('test.css');
      expect(result.rel).toBe('stylesheet');
      // 验证链接被添加到DOM
      expect(document.head.appendChild).toHaveBeenCalled();
    });
  });
  
  test('preloadIcons应该加载多个图标并批处理', () => {
    // 准备
    const loader = traceLoader.init();
    
    // 模拟loadResources方法
    jest.spyOn(loader, 'loadResources').mockResolvedValue([
      { id: 'icon_home', loaded: true },
      { id: 'icon_search', loaded: true }
    ]);
    
    // 执行
    return loader.preloadIcons(['home', 'search'])
      .then(results => {
        // 验证
        expect(results.length).toBe(2);
        expect(loader.loadResources).toHaveBeenCalledWith(
          expect.arrayContaining([
            expect.objectContaining({ id: 'icon_home' }),
            expect.objectContaining({ id: 'icon_search' })
          ])
        );
      });
  });
  
  test('preloadIcons应该拒绝非数组输入', () => {
    const loader = traceLoader.init();
    return expect(loader.preloadIcons('single-icon')).rejects.toThrow('图标名称必须是数组');
  });
});

describe('错误处理和统计功能测试', () => {
  test('handleResourceError应该正确记录错误信息', () => {
    // 准备
    const loader = traceLoader.init();
    const mockError = new Error('加载失败');
    const resource = { id: 'error-resource', url: 'error.jpg' };
    
    // 模拟console.error
    jest.spyOn(console, 'error').mockImplementation(() => {});
    // 模拟触发事件
    jest.spyOn(loader, '_trigger');
    
    // 执行
    loader.handleResourceError(resource, mockError);
    
    // 验证
    expect(console.error).toHaveBeenCalled();
    expect(loader._trigger).toHaveBeenCalledWith(
      loader.events.LOAD_ERROR,
      expect.objectContaining({ resource, error: mockError })
    );
  });
  
  test('getStats应该返回资源加载统计', () => {
    // 准备
    const loader = traceLoader.init();
    
    // 先测试基本功能 - getStats应该返回一个对象
    const stats = loader.getStats();
    
    // 验证返回值是对象
    expect(stats).toBeDefined();
    expect(typeof stats).toBe('object');
    
    // 验证返回对象的结构与实际观察到的一致
    expect(stats).toHaveProperty('cached');
    expect(stats).toHaveProperty('pending');
    expect(stats).toHaveProperty('queued');
    
    // 设置测试数据
    loader._state.loadedResources.set('res1', {});
    loader._state.loadedResources.set('res2', {});
    loader._state.pendingLoads = 3;
    loader._state.loadQueue = [{ id: 'queued1' }, { id: 'queued2' }];
    
    // 再次获取状态并验证
    const updatedStats = loader.getStats();
    expect(updatedStats.cached).toBe(2);
    expect(updatedStats.pending).toBe(3);
    expect(updatedStats.queued).toBe(2);
  });
  
  test('_processQueue应该处理队列中的资源', () => {
    // 准备
    const loader = traceLoader.init();
    
    // 模拟_loadResource立即解析Promise
    jest.spyOn(loader, '_loadResource').mockImplementation(resource => {
      return Promise.resolve({ ...resource, loaded: true });
    });
    
    // 设置模拟队列
    loader._state.loadQueue = [
      { id: 'res1', type: 'image', url: 'a.jpg' },
      { id: 'res2', type: 'image', url: 'b.jpg' }
    ];
    
    // 记录队列长度
    const originalQueueLength = loader._state.loadQueue.length;
    
    // 执行
    loader._processQueue();
    
    // 运行所有定时器以确保异步Promise全部完成
    jest.runAllTimers();
    
    // 验证_loadResource被调用
    expect(loader._loadResource).toHaveBeenCalled();
    
    // 验证队列已被处理（长度减少）
    expect(loader._state.loadQueue.length).toBeLessThan(originalQueueLength);
  });
}); 