const NetworkMonitor = require('./network-monitor');

/**
 * @file 网络状态监控组件单元测试
 * @description 测试NetworkMonitor组件的各项功能
 */

// import NetworkMonitor from './network-monitor';

// 模拟浏览器的navigator.onLine属性
Object.defineProperty(window.navigator, 'onLine', {
  configurable: true,
  get: jest.fn()
});

// 模拟fetch函数
global.fetch = jest.fn().mockImplementation(() => {
  return Promise.resolve({
    ok: true
  });
});

// 模拟performance.now
const originalPerformanceNow = performance.now;
performance.now = jest.fn();

describe('NetworkMonitor', () => {
  let networkMonitor;
  
  beforeEach(() => {
    // 重置所有模拟
    jest.clearAllMocks();
    jest.useFakeTimers();
    performance.now = jest.fn();
    
    // 默认设置navigator.onLine为true
    window.navigator.onLine = true;
    Object.defineProperty(window.navigator, 'onLine', {
      configurable: true,
      get: jest.fn().mockReturnValue(true)
    });
    
    // 初始化networkMonitor实例
    networkMonitor = new NetworkMonitor();
  });
  
  afterEach(() => {
    // 清理
    networkMonitor.removeAllListeners();
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
    performance.now = originalPerformanceNow;
  });
  
  test('初始化时应正确添加事件监听器', () => {
    // 验证监听器已经添加
    expect(window.addEventListener).toHaveBeenCalledWith('online', expect.any(Function));
    expect(window.addEventListener).toHaveBeenCalledWith('offline', expect.any(Function));
  });
  
  test('isOnline方法应返回当前的在线状态', () => {
    // 模拟在线状态
    Object.defineProperty(window.navigator, 'onLine', {
      get: jest.fn().mockReturnValue(true)
    });
    expect(networkMonitor.isOnline()).toBe(true);
    
    // 模拟离线状态
    Object.defineProperty(window.navigator, 'onLine', {
      get: jest.fn().mockReturnValue(false)
    });
    expect(networkMonitor.isOnline()).toBe(false);
  });
  
  test('应正确处理online和offline事件', () => {
    // 模拟事件处理函数
    networkMonitor._triggerEvent = jest.fn();
    
    // 模拟触发事件
    const onlineEvent = new Event('online');
    window.dispatchEvent(onlineEvent);
    expect(networkMonitor._triggerEvent).toHaveBeenCalledWith('online');
    
    const offlineEvent = new Event('offline');
    window.dispatchEvent(offlineEvent);
    expect(networkMonitor._triggerEvent).toHaveBeenCalledWith('offline');
  });
  
  test('应能添加和移除自定义状态变化监听器', () => {
    // 创建模拟回调函数
    const onlineCallback = jest.fn();
    const offlineCallback = jest.fn();
    
    // 添加监听器
    networkMonitor.addStatusChangeListener('online', onlineCallback);
    networkMonitor.addStatusChangeListener('offline', offlineCallback);
    
    // 触发事件
    networkMonitor._triggerEvent('online');
    expect(onlineCallback).toHaveBeenCalled();
    
    networkMonitor._triggerEvent('offline');
    expect(offlineCallback).toHaveBeenCalled();
    
    // 重置模拟
    onlineCallback.mockClear();
    offlineCallback.mockClear();
    
    // 移除监听器
    networkMonitor.removeStatusChangeListener('online', onlineCallback);
    networkMonitor.removeStatusChangeListener('offline', offlineCallback);
    
    // 再次触发事件
    networkMonitor._triggerEvent('online');
    networkMonitor._triggerEvent('offline');
    
    // 验证回调未被调用
    expect(onlineCallback).not.toHaveBeenCalled();
    expect(offlineCallback).not.toHaveBeenCalled();
  });
  
  test('removeAllListeners方法应移除所有事件监听器', () => {
    // 监听移除事件
    window.removeEventListener = jest.fn();
    
    networkMonitor.removeAllListeners();
    
    // 验证全局事件监听器已移除
    expect(window.removeEventListener).toHaveBeenCalledWith('online', expect.any(Function));
    expect(window.removeEventListener).toHaveBeenCalledWith('offline', expect.any(Function));
    
    // 验证自定义监听器集合已清空
    expect(networkMonitor.listeners.online.size).toBe(0);
    expect(networkMonitor.listeners.offline.size).toBe(0);
  });
  
  test('measureNetworkLatency方法应正确测量网络延迟', async () => {
    // 模拟性能计时
    performance.now.mockReturnValueOnce(100).mockReturnValueOnce(150);
    
    // 模拟fetch响应
    fetch.mockImplementationOnce(() => Promise.resolve({ ok: true }));
    
    // 测量延迟
    const latency = await networkMonitor.measureNetworkLatency();
    
    // 验证
    expect(latency).toBe(50); // 150 - 100 = 50ms
    expect(fetch).toHaveBeenCalledWith('/ping', expect.objectContaining({
      method: 'HEAD',
      cache: 'no-cache'
    }));
  });
  
  test('当网络离线时，measureNetworkLatency应返回-1', async () => {
    // 模拟离线状态
    Object.defineProperty(window.navigator, 'onLine', {
      get: jest.fn().mockReturnValue(false)
    });
    
    // 测量延迟
    const latency = await networkMonitor.measureNetworkLatency();
    
    // 验证
    expect(latency).toBe(-1);
    expect(fetch).not.toHaveBeenCalled();
  });
  
  test('当fetch失败时，measureNetworkLatency应返回-1', async () => {
    // 模拟fetch失败
    fetch.mockImplementationOnce(() => Promise.reject(new Error('网络错误')));
    
    // 屏蔽控制台错误信息
    console.error = jest.fn();
    
    // 测量延迟
    const latency = await networkMonitor.measureNetworkLatency();
    
    // 验证
    expect(latency).toBe(-1);
    expect(console.error).toHaveBeenCalled();
  });
  
  test('_trackStatusChange方法应检测不稳定的网络状态', () => {
    // 模拟当前时间
    const now = Date.now();
    Date.now = jest.fn().mockReturnValue(now);
    
    // 设置配置参数
    networkMonitor.config.unstableThreshold = 3;
    networkMonitor.config.unstablePeriod = 1000;
    networkMonitor.config.logUnstable = true;
    
    // 模拟console.warn
    console.warn = jest.fn();
    
    // 初始状态应为稳定
    expect(networkMonitor.isNetworkStable()).toBe(true);
    
    // 模拟快速的状态变化
    networkMonitor._trackStatusChange(); // 第1次
    networkMonitor._trackStatusChange(); // 第2次
    
    // 网络状态仍应为稳定
    expect(networkMonitor.isNetworkStable()).toBe(true);
    
    // 第3次变化，超过阈值
    networkMonitor._trackStatusChange();
    
    // 网络状态应变为不稳定
    expect(networkMonitor.isNetworkStable()).toBe(false);
    expect(console.warn).toHaveBeenCalled();
    
    // 模拟时间过去了超过unstablePeriod
    Date.now = jest.fn().mockReturnValue(now + 1001);
    
    // 再次触发
    networkMonitor._trackStatusChange();
    
    // 应重置为稳定状态
    expect(networkMonitor.isNetworkStable()).toBe(true);
  });
  
  test('在初始化时应正确触发当前网络状态', () => {
    // 移除之前的实例
    networkMonitor.removeAllListeners();
    
    // 模拟在线状态
    Object.defineProperty(window.navigator, 'onLine', {
      get: jest.fn().mockReturnValue(true)
    });
    
    // 模拟回调函数
    const onlineCallback = jest.fn();
    const offlineCallback = jest.fn();
    
    // 创建带有triggerInitialState的实例
    const monitor = new NetworkMonitor({
      triggerInitialState: true,
      onOnline: onlineCallback,
      onOffline: offlineCallback
    });
    
    // 运行setTimeout宏任务
    jest.runAllTimers();
    
    // 验证在线回调被触发
    expect(onlineCallback).toHaveBeenCalled();
    expect(offlineCallback).not.toHaveBeenCalled();
    
    // 清理
    monitor.removeAllListeners();
    
    // 测试离线状态
    Object.defineProperty(window.navigator, 'onLine', {
      get: jest.fn().mockReturnValue(false)
    });
    
    // 重置模拟函数
    onlineCallback.mockClear();
    offlineCallback.mockClear();
    
    // 再次创建实例
    const offlineMonitor = new NetworkMonitor({
      triggerInitialState: true,
      onOnline: onlineCallback,
      onOffline: offlineCallback
    });
    
    // 运行setTimeout宏任务
    jest.runAllTimers();
    
    // 验证离线回调被触发
    expect(onlineCallback).not.toHaveBeenCalled();
    expect(offlineCallback).toHaveBeenCalled();
    
    // 清理
    offlineMonitor.removeAllListeners();
  });
  
  test('_triggerEvent方法应实现事件节流', () => {
    // 设置节流间隔为500ms
    networkMonitor.config.throttleInterval = 500;
    
    // 模拟回调函数
    const callback = jest.fn();
    networkMonitor.addStatusChangeListener('online', callback);
    
    // 模拟当前时间
    let currentTime = 1000;
    Date.now = jest.fn().mockReturnValue(currentTime);
    
    // 第一次触发事件
    networkMonitor._triggerEvent('online');
    expect(callback).toHaveBeenCalledTimes(1);
    
    // 100ms后再次触发，应被节流
    currentTime += 100;
    Date.now = jest.fn().mockReturnValue(currentTime);
    networkMonitor._triggerEvent('online');
    expect(callback).toHaveBeenCalledTimes(1); // 仍然是1次
    
    // 600ms后再次触发，超过节流间隔，应被执行
    currentTime += 600;
    Date.now = jest.fn().mockReturnValue(currentTime);
    networkMonitor._triggerEvent('online');
    expect(callback).toHaveBeenCalledTimes(2);
  });
}); 