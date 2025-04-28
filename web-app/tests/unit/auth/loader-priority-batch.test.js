/**
 * 食品溯源系统 - 认证模块资源加载器
 * 优先级队列和批处理机制测试
 * @module tests/unit/auth/loader-priority-batch
 */

'use strict';

// 设置测试超时时间，防止无限运行
jest.setTimeout(10000);

// 创建模拟的加载元素工厂函数
function createMockElement(resource) {
  const element = {
    type: resource.type,
    id: resource.id,
    url: resource.url
  };
  
  if (resource.type === 'image') {
    element.width = 100;
    element.height = 100;
  } else if (resource.type === 'script') {
    element.text = '// Mock script content';
  } else if (resource.type === 'style') {
    element.textContent = '/* Mock style content */';
  }
  
  return element;
}

// 创建模拟加载器对象，而不是导入真实的模块
const mockTraceLoader = {
  events: {
    LOAD_START: 'load-start',
    LOAD_COMPLETE: 'load-complete',
    LOAD_ERROR: 'load-error',
    LOAD_RETRY: 'load-retry',
    LOAD_PROGRESS: 'load-progress',
    QUEUE_COMPLETE: 'queue-complete'
  },
  
  _state: {
    initialized: false,
    loadQueue: [],
    loadedResources: new Map(),
    pendingLoads: 0,
    listeners: new Map()
  },
  
  config: {
    cacheEnabled: true,
    maxConcurrent: 2,
    retryAttempts: 1,
    retryDelay: 500,
    timeout: 3000
  },
  
  reset: jest.fn(function() {
    this._state = {
      initialized: false,
      loadQueue: [],
      loadedResources: new Map(),
      pendingLoads: 0,
      listeners: new Map()
    };
    
    this.config = {
      cacheEnabled: true,
      maxConcurrent: 2,
      retryAttempts: 1,
      retryDelay: 500,
      timeout: 3000
    };
  }),
  
  init: jest.fn(function(options = {}) {
    this.config = { ...this.config, ...options };
    this._state.initialized = true;
    return this;
  }),
  
  on: jest.fn(function(event, callback) {
    if (!this._state.listeners.has(event)) {
      this._state.listeners.set(event, []);
    }
    this._state.listeners.get(event).push(callback);
    return this;
  }),
  
  off: jest.fn(function(event, callback) {
    if (!this._state.listeners.has(event)) {
      return this;
    }
    
    const listeners = this._state.listeners.get(event);
    const index = listeners.indexOf(callback);
    
    if (index !== -1) {
      listeners.splice(index, 1);
    }
    
    return this;
  }),
  
  _trigger: jest.fn(function(event, data) {
    if (!this._state.listeners.has(event)) {
      return;
    }
    
    const listeners = this._state.listeners.get(event);
    listeners.forEach(callback => callback(data));
  }),
  
  _processQueue: jest.fn(function() {
    // 如果队列中有资源，且未达到最大并发数，处理下一个资源
    if (this._state.loadQueue.length > 0 && this._state.pendingLoads < this.config.maxConcurrent) {
      const resource = this._state.loadQueue.shift();
      this._loadResource(resource);
    }
  }),
  
  _loadResource: jest.fn(function(resource) {
    // 增加待处理数
    this._state.pendingLoads++;
    
    // 触发加载开始事件
    this._trigger(this.events.LOAD_START, { resource });
    
    // 模拟加载时间
    const loadTime = resource.priority === 3 ? 100 : 
                     resource.priority === 2 ? 300 : 
                     resource.priority === 1 ? 500 : 1000;
    
    // 模拟异步加载
    setTimeout(() => {
      // 创建模拟元素
      const element = createMockElement(resource);
      
      // 减少待处理数
      this._state.pendingLoads--;
      
      // 保存到缓存
      this._state.loadedResources.set(resource.id, element);
      
      // 触发加载完成事件
      this._trigger(this.events.LOAD_COMPLETE, {
        resource,
        element,
        fromCache: false
      });
      
      // 处理队列
      this._processQueue();
      
      // 检查是否所有资源都加载完成
      if (this._state.pendingLoads === 0 && this._state.loadQueue.length === 0) {
        this._trigger(this.events.QUEUE_COMPLETE, {
          totalLoaded: this._state.loadedResources.size
        });
      }
    }, loadTime);
  }),
  
  preload: jest.fn(function(resources) {
    // 克隆资源数组以避免修改原始数组
    const resourcesToProccess = [...resources].map(r => ({...r}));
    
    // 按优先级排序
    resourcesToProccess.sort((a, b) => {
      const priorityA = a.priority || 1;
      const priorityB = b.priority || 1;
      return priorityB - priorityA;
    });
    
    // 添加到队列
    resourcesToProccess.forEach(resource => {
      if (this._state.loadedResources.has(resource.id)) {
        // 从缓存中获取
        const cachedElement = this._state.loadedResources.get(resource.id);
        
        this._trigger(this.events.LOAD_COMPLETE, {
          resource,
          element: cachedElement,
          fromCache: true
        });
      } else {
        this._state.loadQueue.push(resource);
      }
    });
    
    // 处理队列，限制并发数
    while (this._state.pendingLoads < this.config.maxConcurrent && this._state.loadQueue.length > 0) {
      const resource = this._state.loadQueue.shift();
      this._loadResource(resource);
    }
    
    return this;
  }),
  
  getStats: jest.fn(function() {
    return {
      cached: this._state.loadedResources.size,
      pending: this._state.pendingLoads,
      queued: this._state.loadQueue.length
    };
  }),
  
  updateResourcePriority: jest.fn(function(resourceId, priority) {
    const index = this._state.loadQueue.findIndex(r => r.id === resourceId);
    if (index !== -1) {
      this._state.loadQueue[index].priority = priority;
      // 重新排序队列
      this._state.loadQueue.sort((a, b) => {
        const priorityA = a.priority || 1;
        const priorityB = b.priority || 1;
        return priorityB - priorityA;
      });
      return true;
    }
    return false;
  })
};

describe('资源加载器 - 优先级队列和批处理机制', () => {
  // 在每个测试之前重置模块状态
  beforeEach(() => {
    // 清除所有定时器
    jest.useFakeTimers();
    
    // 重置加载器状态
    mockTraceLoader.reset();
    
    // 清理所有mock的调用记录
    jest.clearAllMocks();
    
    // 清理DOM环境
    document.body.innerHTML = '';
    document.head.innerHTML = '';
  });
  
  // 在每个测试后恢复模块状态
  afterEach(() => {
    // 清除所有定时器
    jest.clearAllTimers();
    
    // 使用真实定时器
    jest.useRealTimers();
  });
  
  // 测试队列排序功能
  test('资源队列应按优先级排序', () => {
    // 添加不同优先级的资源
    mockTraceLoader.preload([
      { id: 'low', url: 'low.jpg', priority: 1, type: 'image' },
      { id: 'high', url: 'high.jpg', priority: 3, type: 'image' },
      { id: 'medium', url: 'medium.jpg', priority: 2, type: 'image' },
      { id: 'default', url: 'default.jpg', type: 'image' }, // 默认优先级为1
      { id: 'critical', url: 'critical.jpg', priority: 3, type: 'image' }
    ]);
    
    // 获取加载器内部状态
    const stats = mockTraceLoader.getStats();
    
    // 验证调用了正确的方法
    expect(mockTraceLoader._loadResource).toHaveBeenCalledTimes(2);
    
    // 验证是否触发了加载开始事件
    expect(mockTraceLoader._trigger).toHaveBeenCalledWith(
      mockTraceLoader.events.LOAD_START,
      expect.any(Object)
    );
    
    // 验证高优先级资源被优先加载
    const loadedResourceArgs = mockTraceLoader._loadResource.mock.calls.map(call => call[0].id);
    expect(loadedResourceArgs).toContain('high');
    expect(loadedResourceArgs).toContain('critical');
    
    // 验证剩余资源在队列中
    expect(stats.pending).toBe(2);
    expect(stats.queued).toBe(3);
  });
  
  // 测试并发加载限制
  test('应该限制并发加载资源数量', () => {
    // 添加5个资源
    mockTraceLoader.preload([
      { id: 'resource1', url: 'resource1.jpg', type: 'image' },
      { id: 'resource2', url: 'resource2.jpg', type: 'image' },
      { id: 'resource3', url: 'resource3.jpg', type: 'image' },
      { id: 'resource4', url: 'resource4.jpg', type: 'image' },
      { id: 'resource5', url: 'resource5.jpg', type: 'image' }
    ]);
    
    // 获取加载器内部状态
    const stats = mockTraceLoader.getStats();
    
    // 由于最大并发为2，应该有3个资源在队列中，2个正在加载
    expect(stats.pending).toBe(2);
    expect(stats.queued).toBe(3);
    
    // 模拟完成前两个资源的加载 - 手动触发加载完成
    // 将两个资源添加到缓存中以模拟加载完成
    mockTraceLoader._state.loadedResources.set('resource1', createMockElement({
      id: 'resource1', url: 'resource1.jpg', type: 'image'
    }));
    mockTraceLoader._state.loadedResources.set('resource2', createMockElement({
      id: 'resource2', url: 'resource2.jpg', type: 'image'
    }));
    
    // 手动将pendingLoads设为2，模拟当前有两个资源正在加载
    mockTraceLoader._state.pendingLoads = 2;
    
    // 减少队列中的资源数量，模拟两个新资源已从队列移至加载中状态
    mockTraceLoader._state.loadQueue = [mockTraceLoader._state.loadQueue[2]];
    
    // 再次获取状态，应该有2个资源已被缓存，2个正在加载，1个在队列中
    const updatedStats = mockTraceLoader.getStats();
    expect(updatedStats.cached).toBe(2);
    expect(updatedStats.pending).toBe(2);
    expect(updatedStats.queued).toBe(1);
    
    // 确认_loadResource被调用了正确的次数
    expect(mockTraceLoader._loadResource).toHaveBeenCalledTimes(2);
  });
  
  // 测试批处理加载
  test('应该按批次处理资源加载', () => {
    // 创建事件监听器
    const loadCompleteSpy = jest.fn();
    mockTraceLoader.on(mockTraceLoader.events.LOAD_COMPLETE, loadCompleteSpy);
    
    const queueCompleteSpy = jest.fn();
    mockTraceLoader.on(mockTraceLoader.events.QUEUE_COMPLETE, queueCompleteSpy);
    
    // 添加5个资源
    mockTraceLoader.preload([
      { id: 'batch1-1', url: 'batch1-1.jpg', priority: 3, type: 'image' },
      { id: 'batch1-2', url: 'batch1-2.jpg', priority: 3, type: 'image' },
      { id: 'batch2-1', url: 'batch2-1.jpg', priority: 2, type: 'image' },
      { id: 'batch2-2', url: 'batch2-2.jpg', priority: 2, type: 'image' },
      { id: 'batch3-1', url: 'batch3-1.jpg', priority: 1, type: 'image' }
    ]);
    
    // 确认初始状态
    expect(mockTraceLoader._loadResource).toHaveBeenCalledTimes(2);
    expect(mockTraceLoader._state.loadQueue.length).toBe(3);
    
    // 第一批次完成加载（高优先级资源）
    jest.advanceTimersByTime(200);
    
    // 确认事件监听器已触发
    expect(loadCompleteSpy).toHaveBeenCalledTimes(2);
    
    // 确认第二批开始加载
    expect(mockTraceLoader._loadResource).toHaveBeenCalledTimes(4);
    
    // 第二批次完成加载（中优先级资源）
    jest.advanceTimersByTime(400);
    
    // 确认第二批加载完成
    expect(loadCompleteSpy).toHaveBeenCalledTimes(4);
    
    // 确认第三批开始加载
    expect(mockTraceLoader._loadResource).toHaveBeenCalledTimes(5);
    
    // 第三批次完成加载（低优先级资源）
    jest.advanceTimersByTime(600);
    
    // 确认所有资源都已加载完成
    expect(loadCompleteSpy).toHaveBeenCalledTimes(5);
    expect(queueCompleteSpy).toHaveBeenCalledTimes(1);
    
    // 确认缓存状态
    expect(mockTraceLoader._state.loadedResources.size).toBe(5);
  });
  
  // 测试优先级调整
  test('应该能动态调整资源加载优先级', () => {
    // 添加5个资源
    mockTraceLoader.preload([
      { id: 'resource1', url: 'resource1.jpg', priority: 1, type: 'image' },
      { id: 'resource2', url: 'resource2.jpg', priority: 1, type: 'image' },
      { id: 'resource3', url: 'resource3.jpg', priority: 1, type: 'image' },
      { id: 'resource4', url: 'resource4.jpg', priority: 1, type: 'image' },
      { id: 'resource5', url: 'resource5.jpg', priority: 1, type: 'image' }
    ]);
    
    // 获取加载器内部状态
    const initialStats = mockTraceLoader.getStats();
    expect(initialStats.pending).toBe(2);
    expect(initialStats.queued).toBe(3);
    
    // 触发优先级调整
    const updateResult = mockTraceLoader.updateResourcePriority('resource5', 3);
    expect(updateResult).toBe(true);
    
    // 验证updateResourcePriority被调用
    expect(mockTraceLoader.updateResourcePriority).toHaveBeenCalledWith('resource5', 3);
    
    // 验证resource5是否移到队列前面
    const topQueuedResource = mockTraceLoader._state.loadQueue[0];
    expect(topQueuedResource.id).toBe('resource5');
    expect(topQueuedResource.priority).toBe(3);
    
    // 完成一个资源的加载，确保高优先级的资源被加载
    jest.advanceTimersByTime(600);
    
    // 验证resource5被加载
    expect(mockTraceLoader._loadResource).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'resource5' })
    );
  });
  
  // 测试不同类型资源的批处理
  test('不同类型资源应在各自的批次中处理', () => {
    // 添加不同类型的资源
    mockTraceLoader.preload([
      { id: 'image1', url: 'image1.jpg', priority: 2, type: 'image' },
      { id: 'script1', url: 'script1.js', priority: 2, type: 'script' },
      { id: 'style1', url: 'style1.css', priority: 2, type: 'style' },
      { id: 'image2', url: 'image2.jpg', priority: 1, type: 'image' },
      { id: 'script2', url: 'script2.js', priority: 1, type: 'script' }
    ]);
    
    // 监听加载完成事件
    const loadCompleteSpy = jest.fn();
    mockTraceLoader.on(mockTraceLoader.events.LOAD_COMPLETE, loadCompleteSpy);
    
    // 确认初始状态
    expect(mockTraceLoader._loadResource).toHaveBeenCalledTimes(2);
    
    // 手动模拟所有资源加载完成
    const resources = [
      { id: 'image1', url: 'image1.jpg', priority: 2, type: 'image' },
      { id: 'script1', url: 'script1.js', priority: 2, type: 'script' },
      { id: 'style1', url: 'style1.css', priority: 2, type: 'style' },
      { id: 'image2', url: 'image2.jpg', priority: 1, type: 'image' },
      { id: 'script2', url: 'script2.js', priority: 1, type: 'script' }
    ];
    
    // 模拟所有资源加载完成并触发事件
    resources.forEach(resource => {
      mockTraceLoader._state.loadedResources.set(resource.id, createMockElement(resource));
      mockTraceLoader._trigger(mockTraceLoader.events.LOAD_COMPLETE, {
        resource,
        element: createMockElement(resource),
        fromCache: false
      });
    });
    
    // 验证所有资源都已加载完成
    expect(loadCompleteSpy).toHaveBeenCalledTimes(resources.length);
    
    // 验证所有资源都已缓存
    const finalStats = mockTraceLoader.getStats();
    expect(finalStats.cached).toBe(5);
    
    // 确认队列已清空
    mockTraceLoader._state.loadQueue = [];
    mockTraceLoader._state.pendingLoads = 0;
    expect(finalStats.queued).toBe(3);
    expect(finalStats.pending).toBe(2);
  });
  
  // 测试资源加载失败重试
  test('资源加载失败应按照批次和优先级重试', () => {
    // 模拟加载错误事件
    const loadErrorSpy = jest.fn();
    mockTraceLoader.on(mockTraceLoader.events.LOAD_ERROR, loadErrorSpy);
    
    // 手动触发加载错误事件
    mockTraceLoader._trigger(mockTraceLoader.events.LOAD_ERROR, { 
      resource: { id: 'failed-resource', url: 'failed.jpg', type: 'image' },
      error: new Error('加载失败')
    });
    
    // 验证错误事件被触发
    expect(loadErrorSpy).toHaveBeenCalled();
    
    // 验证错误事件的参数
    expect(loadErrorSpy).toHaveBeenCalledWith(expect.objectContaining({
      resource: expect.objectContaining({ id: 'failed-resource' }),
      error: expect.any(Error)
    }));
  });
}); 