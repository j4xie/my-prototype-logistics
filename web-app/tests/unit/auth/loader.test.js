/**
 * 资源加载模块 (loader.js) 的单元测试 - 简化版
 * @version 1.1.0
 * @jest-environment jsdom
 */

// 设置全局测试超时为10秒，避免测试长时间运行
jest.setTimeout(10000);

const traceLoader = require('../../../components/modules/auth/loader');

// 每次测试前重置模块和启用假计时器
beforeEach(() => {
  jest.resetModules();
  // 启用Jest假计时器，使用modern模式确保Promise能正确解析
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
  // 运行所有待处理的计时器来避免悬挂的异步操作
  jest.runAllTimers();
  // 恢复真实计时器
  jest.useRealTimers();
  // 清理所有模拟
  jest.restoreAllMocks();
  // 彻底清理DOM
  document.head.innerHTML = '';
  document.body.innerHTML = '';
});

describe('资源加载模块基础测试', () => {
  test('应该能正确初始化加载器', () => {
    // 执行
    const loader = traceLoader.init({
      cacheEnabled: true,
      timeout: 5000,
      maxConcurrent: 3
    });
    
    // 验证
    expect(loader).toBeDefined();
    expect(loader.config.cacheEnabled).toBe(true);
    expect(loader.config.timeout).toBe(5000);
    expect(loader.config.maxConcurrent).toBe(3);
  });
  
  test('应该能注册和触发事件', () => {
    // 准备
    const loader = traceLoader.init();
    const mockCallback = jest.fn();
    
    // 执行
    loader.on('test-event', mockCallback);
    loader._trigger('test-event', { testData: true });
    
    // 验证
    expect(mockCallback).toHaveBeenCalledWith({ testData: true });
    
    // 执行2 - 移除监听器
    loader.off('test-event', mockCallback);
    loader._trigger('test-event', { testData: false });
    
    // 验证2
    expect(mockCallback).toHaveBeenCalledTimes(1); // 不再被调用
  });
});

describe('资源加载功能测试', () => {
  test('应该能加载图片 (同步模拟)', async () => {
    // 准备
    const loader = traceLoader.init();
    const mockImg = { src: 'test.jpg' };

    // 直接模拟内部方法 _loadResource，确保它解析为同步结果
    jest.spyOn(loader, '_loadResource').mockImplementation(() => {
      return Promise.resolve(mockImg);
    });
    
    // 执行
    const imagePromise = loader.preloadImage('test.jpg');
    
    // 运行所有计时器确保异步操作完成
    jest.runAllTimers();
    
    // 等待Promise解析
    const image = await imagePromise;
    
    // 验证
    expect(image).toBe(mockImg);
    expect(loader._loadResource).toHaveBeenCalledWith({
      type: 'image',
      url: 'test.jpg',
      id: 'test.jpg',
      priority: 1
    });
  });
  
  test('应该能处理加载错误 (同步模拟)', async () => {
    // 准备
    const loader = traceLoader.init();
    const mockError = new Error('加载失败');
    
    // 确保错误处理被调用
    const handleResourceErrorSpy = jest.spyOn(loader, 'handleResourceError').mockImplementation(() => {});
    
    // 模拟 _loadResource 直接返回一个拒绝的Promise
    jest.spyOn(loader, '_loadResource').mockImplementation(() => {
      return Promise.reject(mockError);
    });
    
    // 执行
    const imagePromise = loader.preloadImage('fail.jpg');
    
    // 运行所有计时器确保异步操作完成
    jest.runAllTimers();
    
    // 验证Promise被拒绝且拒绝原因是预期的错误
    await expect(imagePromise).rejects.toEqual(mockError);
    
    // 验证相关方法被调用
    expect(loader._loadResource).toHaveBeenCalled();
  });
  
  test('应该能加载脚本 (同步模拟)', async () => {
    // 准备
    const loader = traceLoader.init();
    const mockScript = { src: 'test.js', async: true, defer: false };
    
    // 简化的脚本加载模拟，直接返回解析的Promise
    jest.spyOn(loader, '_loadResource').mockImplementation(() => {
      return Promise.resolve(mockScript);
    });
    
    // 执行
    const scriptPromise = loader.loadScript('test.js', { async: true });
    
    // 运行所有计时器确保异步操作完成
    jest.runAllTimers();
    
    // 等待Promise解析
    const script = await scriptPromise;
    
    // 验证
    expect(script).toBe(mockScript);
    expect(loader._loadResource).toHaveBeenCalledWith({
      type: 'script',
      url: 'test.js',
      id: 'test.js',
      async: true,
      defer: false,
      priority: 3
    });
  });
});

describe('资源缓存功能测试', () => {
  // 为缓存管理测试单独设置计时器
  beforeEach(() => {
    jest.useFakeTimers();
  });
  
  afterEach(() => {
    jest.runAllTimers();
    jest.useRealTimers();
  });
  
  test('应该能缓存和获取资源', () => {
    // 准备
    const loader = traceLoader.init({ cacheEnabled: true });
    const mockResource = { id: 'test-resource' };
    
    // 执行 - 添加资源到缓存
    loader._state.loadedResources.set('test-resource', mockResource);
    
    // 验证
    expect(loader._state.loadedResources.has('test-resource')).toBe(true);
    expect(loader.getCachedResource('test-resource')).toBe(mockResource);
  });
  
  test('应该能清除特定缓存', () => {
    // 准备
    const loader = traceLoader.init();
    loader._state.loadedResources.set('resource1', {});
    loader._state.loadedResources.set('resource2', {});
    
    // 执行
    loader.clearCache('resource1');
    
    // 验证
    expect(loader._state.loadedResources.has('resource1')).toBe(false);
    expect(loader._state.loadedResources.has('resource2')).toBe(true);
  });
  
  test('应该能清除所有缓存', () => {
    // 准备
    const loader = traceLoader.init();
    loader._state.loadedResources.set('resource1', {});
    loader._state.loadedResources.set('resource2', {});
    
    // 执行
    loader.clearCache();
    
    // 验证
    expect(loader._state.loadedResources.size).toBe(0);
  });
  
  test('应该能获取加载统计', () => {
    // 准备
    const loader = traceLoader.init();
    loader._state.loadedResources.set('resource1', {});
    loader._state.loadedResources.set('resource2', {});
    loader._state.pendingLoads = 3;
    loader._state.loadQueue = [{}, {}, {}];
    
    // 执行
    const stats = loader.getStats();
    
    // 验证
    expect(stats.cached).toBe(2);
    expect(stats.pending).toBe(3);
    expect(stats.queued).toBe(3);
  });
});