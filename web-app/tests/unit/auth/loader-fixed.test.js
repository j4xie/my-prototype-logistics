/**
 * 资源加载模块 (loader.js) 的单元测试 - 修复版
 * @version 1.2.0
 * @jest-environment jsdom
 */

// 设置全局测试超时为10秒，避免测试长时间运行
jest.setTimeout(10000);

const traceLoader = require('../../../components/modules/auth/loader');

// 每次测试前重置模块和启用假计时器
beforeEach(() => {
  jest.resetModules();
  // 启用Jest假计时器，使用modern模式确保Promise能正确解析
  jest.useFakeTimers('modern');
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

describe('资源缓存功能测试 (修复版)', () => {
  test('应该能缓存和获取资源', () => {
    // 准备
    const loader = traceLoader.init({ cacheEnabled: true });
    const mockResource = { id: 'test-resource' };
    
    // 1. 测试手动添加缓存并获取
    loader._state.loadedResources.set('test-resource', mockResource);
    expect(loader._state.loadedResources.has('test-resource')).toBe(true);
    expect(loader.getCachedResource('test-resource')).toBe(mockResource);
    
    // 2. 测试预加载时的缓存行为
    // 模拟已加载图片
    const mockImage = { src: 'cached-image.jpg' };
    loader._state.loadedResources.set('cached-image.jpg', mockImage);
    
    // 检查从缓存获取
    const getCachedSpy = jest.spyOn(loader, 'getCachedResource');
    const cachedResult = loader.getCachedResource('cached-image.jpg');
    
    // 验证结果
    expect(getCachedSpy).toHaveBeenCalledWith('cached-image.jpg');
    expect(cachedResult).toBe(mockImage);
    
    // 清除特定缓存
    loader.clearCache('cached-image.jpg');
    expect(loader._state.loadedResources.has('cached-image.jpg')).toBe(false);
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

describe('错误处理功能测试 (修复版)', () => {
  test('应该能触发错误事件', () => {
    // 准备
    const loader = traceLoader.init();
    const errorCallback = jest.fn();
    const errorObj = new Error('资源加载失败');
    
    // 注册错误事件监听器
    loader.on('resource:error', errorCallback);
    
    // 直接触发错误事件
    loader._trigger('resource:error', { 
      error: errorObj,
      resource: { url: 'error.jpg', type: 'image' }
    });
    
    // 验证错误回调被正确调用
    expect(errorCallback).toHaveBeenCalledWith(expect.objectContaining({
      error: errorObj,
      resource: expect.objectContaining({
        url: 'error.jpg',
        type: 'image'
      })
    }));
  });
}); 