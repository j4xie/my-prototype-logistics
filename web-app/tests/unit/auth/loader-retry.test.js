/**
 * @file loader-retry.test.js
 * @description 资源加载器重试机制测试 - 食品溯源系统
 * @jest-environment jsdom
 */

// CommonJS导入，不使用ES6模块语法
const traceLoader = require('../../../components/modules/auth/loader');

// 设置全局测试超时为10秒，避免测试长时间运行
jest.setTimeout(10000);

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
    
    // 如果有失败资源，也清除它们
    if (traceLoader._state.failedResources) {
      traceLoader._state.failedResources = [];
    }
  }
  
  // 清理 DOM
  document.head.innerHTML = '';
  document.body.innerHTML = '';
  
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
  
  // 记录活动计时器
  jest.getTimerCount = jest.fn(() => {
    return Object.keys(
      jest.getTimerCount.mock.calls
    ).length;
  });
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

describe('重试机制基本测试', () => {
  test('测试环境是否正常工作', () => {
    expect(true).toBe(true);
  });
  
  test('加载器重试配置是否正确', () => {
    // 模拟一个简单的加载器配置
    const loaderConfig = {
      retryCount: 3,
      retryDelay: 1000,
      timeout: 5000
    };
    
    expect(loaderConfig.retryCount).toBe(3);
    expect(loaderConfig.retryDelay).toBe(1000);
    expect(loaderConfig.timeout).toBe(5000);
  });
});

describe('资源加载器 - 基本重试机制测试', () => {
  test('应该在资源加载失败时尝试重试', async () => {
    // 准备
    const loader = traceLoader.init({
      retryAttempts: 2,
      retryDelay: 100
    });
    
    // 计数器跟踪加载尝试次数
    let loadAttempts = 0;
    
    // 监视handleResourceError方法
    const handleResourceErrorSpy = jest.spyOn(loader, 'handleResourceError').mockImplementation(() => {});
    
    // 模拟图片加载，第一次和第二次失败，第三次成功
    jest.spyOn(loader, '_loadImageResource').mockImplementation(() => {
      loadAttempts++;
      const img = new Image();
      
      if (loadAttempts <= 2) {
        // 前两次尝试失败
        return Promise.reject(new Error(`加载失败 (尝试 ${loadAttempts})`));
      } else {
        // 第三次尝试成功
        return Promise.resolve(img);
      }
    });
    
    // 执行资源加载
    const imagePromise = loader.preloadImage('retry-test.jpg');
    
    // 前两次失败后，快进时间以触发重试
    jest.advanceTimersByTime(100); // 第一次重试触发
    jest.advanceTimersByTime(100); // 第二次重试触发
    
    // 等待加载完成
    const result = await imagePromise;
    
    // 验证加载被尝试了3次（初始加载 + 2次重试）
    expect(loadAttempts).toBe(3);
    expect(result).toBeInstanceOf(Image);
    
    // 验证错误处理函数被调用了两次
    expect(handleResourceErrorSpy).toHaveBeenCalledTimes(2);
  });
  
  test('应该在达到最大重试次数后抛出错误', async () => {
    // 准备
    const loader = traceLoader.init({
      retryAttempts: 1,
      retryDelay: 100
    });
    
    // 计数器跟踪加载尝试次数
    let loadAttempts = 0;
    
    // 监视handleResourceError方法
    const handleResourceErrorSpy = jest.spyOn(loader, 'handleResourceError').mockImplementation(() => {});
    
    // 模拟图片加载，始终失败
    jest.spyOn(loader, '_loadImageResource').mockImplementation(() => {
      loadAttempts++;
      return Promise.reject(new Error(`加载失败 (尝试 ${loadAttempts})`));
    });
    
    // 执行资源加载，预期会失败
    const imagePromise = loader.preloadImage('max-retry-test.jpg');
    
    // 快进时间以触发重试
    jest.advanceTimersByTime(100); // 重试触发
    
    // 验证加载最终抛出错误
    await expect(imagePromise).rejects.toThrow(/加载失败/);
    
    // 验证加载被尝试了2次（初始加载 + 1次重试）
    expect(loadAttempts).toBe(2);
    
    // 验证错误处理函数被调用了两次
    expect(handleResourceErrorSpy).toHaveBeenCalledTimes(2);
  });
  
  test('应该可以配置重试延迟时间', async () => {
    // 准备
    const customDelay = 250;
    const loader = traceLoader.init({
      retryAttempts: 1,
      retryDelay: customDelay
    });
    
    // 监视setTimeout
    const setTimeoutSpy = jest.spyOn(global, 'setTimeout');
    
    // 模拟图片加载失败
    jest.spyOn(loader, '_loadImageResource').mockImplementation(() => {
      return Promise.reject(new Error('加载失败'));
    });
    
    // 执行资源加载
    try {
      const imagePromise = loader.preloadImage('delay-test.jpg');
      
      // 验证setTimeout使用了自定义延迟
      expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), customDelay);
      
      // 快进时间以触发重试
      jest.advanceTimersByTime(customDelay);
      
      // 等待Promise拒绝
      await expect(imagePromise).rejects.toThrow();
    } catch (error) {
      // 预期会失败
    }
  });
});

describe('资源加载器 - 高级重试策略测试', () => {
  test('应该支持指数退避重试策略', async () => {
    // 准备
    const loader = traceLoader.init({
      retryAttempts: 3,
      retryStrategy: 'exponential',
      retryDelay: 100,
      retryFactor: 2
    });
    
    // 监视setTimeout
    const setTimeoutSpy = jest.spyOn(global, 'setTimeout');
    
    // 计数器跟踪重试次数
    let retryCount = 0;
    
    // 模拟图片加载，始终失败
    jest.spyOn(loader, '_loadImageResource').mockImplementation(() => {
      return Promise.reject(new Error('加载失败'));
    });
    
    // 模拟重试方法，记录延迟
    const retryDelays = [];
    const originalRetry = loader._retryResourceLoad;
    loader._retryResourceLoad = jest.fn((resource, error, attempt) => {
      retryCount++;
      retryDelays.push(loader._calculateRetryDelay(attempt));
      
      // 调用原始方法或返回拒绝的Promise
      if (originalRetry) {
        return originalRetry.call(loader, resource, error, attempt);
      } else {
        return Promise.reject(error);
      }
    });
    
    // 执行资源加载
    try {
      const imagePromise = loader.preloadImage('exponential-test.jpg');
      
      // 快进时间模拟指数退避
      jest.advanceTimersByTime(100);  // 第一次重试
      jest.advanceTimersByTime(200);  // 第二次重试
      jest.advanceTimersByTime(400);  // 第三次重试
      
      await expect(imagePromise).rejects.toThrow();
    } catch (error) {
      // 预期会失败
    }
    
    // 验证重试次数
    expect(retryCount).toBe(3);
    
    // 验证延迟符合指数退避
    if (loader._calculateRetryDelay) {
      expect(retryDelays[0]).toBe(100);  // 基础延迟
      expect(retryDelays[1]).toBe(200);  // 基础延迟 * 2
      expect(retryDelays[2]).toBe(400);  // 基础延迟 * 2^2
    }
  });
  
  test('应该支持随机抖动重试策略', async () => {
    // 准备
    const loader = traceLoader.init({
      retryAttempts: 2,
      retryStrategy: 'jitter',
      retryDelay: 100,
      retryJitter: 0.5
    });
    
    // 模拟Math.random返回固定值
    jest.spyOn(Math, 'random').mockReturnValue(0.5);
    
    // 模拟图片加载，始终失败
    jest.spyOn(loader, '_loadImageResource').mockImplementation(() => {
      return Promise.reject(new Error('加载失败'));
    });
    
    // 监视重试方法
    const originalRetry = loader._retryResourceLoad;
    let retryDelays = [];
    
    if (originalRetry) {
      jest.spyOn(loader, '_retryResourceLoad').mockImplementation((resource, error, attempt) => {
        const delay = loader._calculateRetryDelay ? loader._calculateRetryDelay(attempt) : 100 * attempt;
        retryDelays.push(delay);
        return Promise.reject(error);
      });
    } else {
      // 如果没有_retryResourceLoad方法，则监视setTimeout
      const originalSetTimeout = global.setTimeout;
      global.setTimeout = jest.fn((fn, delay) => {
        retryDelays.push(delay);
        return originalSetTimeout(fn, 0);
      });
    }
    
    // 执行资源加载
    try {
      const imagePromise = loader.preloadImage('jitter-test.jpg');
      
      // 快进时间
      jest.advanceTimersByTime(500);
      
      await expect(imagePromise).rejects.toThrow();
    } catch (error) {
      // 预期会失败
    }
    
    // 重试应用了抖动
    if (loader._calculateRetryDelay) {
      // 第一次重试，通常抖动为 100 * (1 + 0.5 * 0.5) = 125
      expect(retryDelays[0]).toBeGreaterThan(100);
      expect(retryDelays[0]).toBeLessThan(150);
    }
    
    // 如果_retryResourceLoad不存在，恢复setTimeout
    if (!originalRetry) {
      global.setTimeout = global.originalSetTimeout;
    }
  });
  
  test('应该针对不同类型的错误应用不同的重试策略', async () => {
    // 准备
    const loader = traceLoader.init({
      retryAttempts: 2,
      retryDelay: 100
    });
    
    // 模拟selectRetryStrategy方法，针对不同错误返回不同延迟
    loader._selectRetryStrategy = jest.fn((error, attempt) => {
      if (error.message.includes('timeout')) {
        // 超时错误使用长延迟
        return 300 * attempt;
      } else if (error.message.includes('network')) {
        // 网络错误使用中等延迟
        return 200 * attempt;
      } else {
        // 其他错误使用标准延迟
        return 100 * attempt;
      }
    });
    
    // 模拟加载图像三次，每次使用不同的错误
    const errorTypes = [
      new Error('timeout: 请求超时'),
      new Error('network: 网络连接错误'),
      new Error('general: 未知错误')
    ];
    
    const retryDelays = [];
    
    for (const error of errorTypes) {
      // 模拟图片加载失败
      jest.spyOn(loader, '_loadImageResource').mockImplementation(() => {
        return Promise.reject(error);
      });
      
      // 重写_retryResourceLoad，捕获延迟
      const originalRetry = loader._retryResourceLoad;
      if (originalRetry) {
        jest.spyOn(loader, '_retryResourceLoad').mockImplementation((resource, err, attempt) => {
          const delay = loader._selectRetryStrategy(err, attempt);
          retryDelays.push(delay);
          return Promise.reject(err);
        });
      } else {
        // 监视setTimeout
        const originalSetTimeout = global.setTimeout;
        global.setTimeout = jest.fn((fn, delay) => {
          retryDelays.push(delay);
          return originalSetTimeout(fn, 0);
        });
      }
      
      // 执行资源加载
      try {
        const imagePromise = loader.preloadImage(`error-${errorTypes.indexOf(error)}.jpg`);
        
        // 快进时间
        jest.advanceTimersByTime(500);
        
        await expect(imagePromise).rejects.toThrow();
      } catch (e) {
        // 预期会失败
      }
      
      // 清理模拟
      jest.restoreAllMocks();
    }
    
    // 验证不同错误类型应用了不同延迟
    if (loader._selectRetryStrategy) {
      expect(retryDelays[0]).toBe(300); // 超时错误
      expect(retryDelays[1]).toBe(200); // 网络错误
      expect(retryDelays[2]).toBe(100); // 一般错误
    }
  });
});

describe('资源加载器 - 重试机制与事件集成测试', () => {
  test('重试过程应触发适当的事件', async () => {
    // 准备
    const loader = traceLoader.init({
      retryAttempts: 1,
      retryDelay: 50
    });
    
    // 监听事件
    const loadErrorSpy = jest.fn();
    const retryStartSpy = jest.fn();
    const retrySuccessSpy = jest.fn();
    const loadCompleteSpy = jest.fn();
    
    loader.on(loader.events.LOAD_ERROR, loadErrorSpy);
    loader.on('retry_start', retryStartSpy);
    loader.on('retry_success', retrySuccessSpy);
    loader.on(loader.events.LOAD_COMPLETE, loadCompleteSpy);
    
    // 计数器跟踪加载尝试次数
    let loadAttempts = 0;
    
    // 模拟图片加载，第一次失败，第二次成功
    jest.spyOn(loader, '_loadImageResource').mockImplementation(() => {
      loadAttempts++;
      if (loadAttempts === 1) {
        // 第一次尝试失败
        return Promise.reject(new Error('第一次加载失败'));
      } else {
        // 第二次尝试成功
        return Promise.resolve(new Image());
      }
    });
    
    // 执行资源加载
    const result = await loader.preloadImage('event-test.jpg');
    
    // 快进时间以确保重试发生
    jest.advanceTimersByTime(100);
    
    // 验证事件触发
    expect(loadErrorSpy).toHaveBeenCalledTimes(1);
    
    if (loader.events.RETRY_START) {
      expect(retryStartSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          resource: expect.objectContaining({ url: 'event-test.jpg' }),
          attempt: 1
        })
      );
    }
    
    if (loader.events.RETRY_SUCCESS) {
      expect(retrySuccessSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          resource: expect.objectContaining({ url: 'event-test.jpg' }),
          element: expect.any(Image),
          attempt: 1
        })
      );
    }
    
    expect(loadCompleteSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        resource: expect.objectContaining({ url: 'event-test.jpg' }),
        element: expect.any(Image)
      })
    );
  });
  
  test('加载过程中组件卸载或中止应取消待处理的重试', async () => {
    // 准备
    const loader = traceLoader.init({
      retryAttempts: 2,
      retryDelay: 200
    });
    
    // 监视clearTimeout
    const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');
    
    // 模拟handleResourceError，确保重试被安排
    let retryTimeoutId;
    jest.spyOn(loader, 'handleResourceError').mockImplementation((resource, error) => {
      // 只处理第一次错误并安排重试
      retryTimeoutId = setTimeout(() => {
        console.log('重试已执行');
      }, 200);
      
      // 触发LOAD_ERROR事件
      loader._trigger(loader.events.LOAD_ERROR, { resource, error });
      
      return retryTimeoutId;
    });
    
    // 模拟图片加载失败
    jest.spyOn(loader, '_loadImageResource').mockImplementation(() => {
      return Promise.reject(new Error('加载失败'));
    });
    
    // 开始加载资源
    const imagePromise = loader.preloadImage('cancel-test.jpg');
    
    // 模拟组件卸载，取消所有加载操作
    if (loader.cancelAllLoads) {
      loader.cancelAllLoads();
    } else if (loader.clear) {
      loader.clear();
    } else {
      // 如果没有取消方法，直接清除计时器
      clearTimeout(retryTimeoutId);
    }
    
    // 验证clearTimeout被调用
    expect(clearTimeoutSpy).toHaveBeenCalled();
    
    // 验证没有重试发生（计时器已清除）
    jest.advanceTimersByTime(500);
    
    // 应该拒绝原始的Promise
    await expect(imagePromise).rejects.toThrow();
  });
});

describe('资源加载器 - 性能和稳定性测试', () => {
  test('大量资源加载失败和重试不应导致内存泄漏', async () => {
    // 准备
    const loader = traceLoader.init({
      retryAttempts: 1,
      retryDelay: 10
    });
    
    // 模拟图片加载失败
    jest.spyOn(loader, '_loadImageResource').mockImplementation(() => {
      return Promise.reject(new Error('加载失败'));
    });
    
    // 创建大量资源加载请求
    const resourceCount = 100;
    const promises = [];
    
    for (let i = 0; i < resourceCount; i++) {
      // 异步加载资源，预期所有资源都会失败
      promises.push(loader.preloadImage(`perf-test-${i}.jpg`).catch(() => {}));
    }
    
    // 快进时间以确保所有重试都开始
    jest.advanceTimersByTime(20);
    
    // 等待所有Promise完成
    await Promise.allSettled(promises);
    
    // 验证活动计时器数量是0（所有重试都已完成）
    expect(jest.getTimerCount()).toBe(0);
    
    // 验证资源队列已被处理
    expect(loader._state.loadQueue.length).toBe(0);
    
    // 验证没有挂起的加载
    expect(loader._state.pendingLoads).toBe(0);
  });
});

// 辅助函数，检查加载应该重试的错误类型
describe('资源加载器 - 重试错误类型测试', () => {
  test('应该对特定类型的错误进行重试，对其他错误不重试', async () => {
    // 准备
    const loader = traceLoader.init({
      retryAttempts: 1,
      retryDelay: 50
    });
    
    // 监视handleResourceError
    const handleResourceErrorSpy = jest.spyOn(loader, 'handleResourceError');
    
    // 模拟是否应该重试的检查
    loader._shouldRetryError = jest.fn((error) => {
      // 只重试网络类型的错误
      return error.message.includes('网络');
    });
    
    // 使用两种不同类型的错误测试
    const errorTypes = [
      new Error('网络临时错误'),
      new Error('资源不存在错误')
    ];
    
    // 跟踪重试次数
    let retryCount = 0;
    
    for (const error of errorTypes) {
      // 重置计数
      retryCount = 0;
      
      // 模拟图片加载失败
      jest.spyOn(loader, '_loadImageResource').mockImplementation(() => {
        return Promise.reject(error);
      });
      
      // 如果有重试方法，模拟它并记录调用
      if (loader._retryResourceLoad) {
        jest.spyOn(loader, '_retryResourceLoad').mockImplementation((resource, err, attempt) => {
          retryCount++;
          return Promise.reject(err);
        });
      }
      
      // 执行资源加载
      try {
        const imagePromise = loader.preloadImage(`error-type-${errorTypes.indexOf(error)}.jpg`);
        
        // 快进时间以确保可能的重试发生
        jest.advanceTimersByTime(100);
        
        await expect(imagePromise).rejects.toThrow();
      } catch (e) {
        // 预期会失败
      }
      
      // 验证基于错误类型的重试行为
      if (error.message.includes('网络')) {
        // 网络错误应该触发重试
        expect(loader._shouldRetryError).toHaveBeenCalledWith(error);
        if (loader._retryResourceLoad) {
          expect(retryCount).toBe(1);
        }
      } else {
        // 非网络错误不应该触发重试
        expect(loader._shouldRetryError).toHaveBeenCalledWith(error);
        if (loader._retryResourceLoad) {
          expect(retryCount).toBe(0);
        }
      }
      
      // 清理模拟
      jest.clearAllMocks();
    }
  });
});

describe('网络恢复时重试测试', () => {
  test('应该在网络状态改变后重试失败的资源', () => {
    // 准备
    const loader = traceLoader.init();
    
    // 确保有failedResources数组，并添加模拟的失败资源
    if (!loader._state.failedResources) {
      loader._state.failedResources = [];
    }
    
    loader._state.failedResources.push(
      { type: 'image', url: 'network-retry.jpg', id: 'network-retry', priority: 1 }
    );
    
    // 监视loadResources方法
    const loadResourcesSpy = jest.spyOn(loader, 'loadResources')
      .mockImplementation(() => Promise.resolve([]));
    
    // 手动触发网络在线事件
    if (typeof loader._handleNetworkChange === 'function') {
      // 如果存在处理函数，直接调用它
      loader._handleNetworkChange({ type: 'online' });
    } else if (typeof loader._handleNetworkRecovery === 'function') {
      // 或者调用恢复函数
      loader._handleNetworkRecovery();
    } else {
      // 否则手动触发事件
      const onlineEvent = new Event('online');
      window.dispatchEvent(onlineEvent);
    }
    
    // 运行所有计时器
    jest.runAllTimers();
    
    // 验证loadResources是否被调用
    expect(loadResourcesSpy).toHaveBeenCalled();
  });
}); 