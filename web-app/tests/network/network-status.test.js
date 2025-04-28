/**
 * @file 网络状态监控测试
 * @description 测试网络状态监控和处理功能
 */

import NetworkMonitor from '../../src/network/network-monitor';

describe('网络状态监控', () => {
  let networkMonitor;
  let onlineHandlerMock;
  let offlineHandlerMock;

  beforeEach(() => {
    // 创建模拟处理函数
    onlineHandlerMock = jest.fn();
    offlineHandlerMock = jest.fn();
    
    // 创建网络监控实例
    networkMonitor = new NetworkMonitor();
    
    // 注册监听器
    networkMonitor.addStatusChangeListener('online', onlineHandlerMock);
    networkMonitor.addStatusChangeListener('offline', offlineHandlerMock);
    
    // 清除之前的模拟状态
    jest.clearAllMocks();
  });

  afterEach(() => {
    // 移除监听器，避免影响其他测试
    networkMonitor.removeAllListeners();
  });

  test('应该能够检测当前网络状态', () => {
    // 模拟在线状态
    window.navigator.onLine = true;
    
    // 检查状态
    expect(networkMonitor.isOnline()).toBe(true);
    
    // 模拟离线状态
    window.navigator.onLine = false;
    
    // 检查状态更新
    expect(networkMonitor.isOnline()).toBe(false);
  });

  test('应该在网络状态变化时触发事件', () => {
    // 模拟网络变化事件
    const onlineEvent = new Event('online');
    const offlineEvent = new Event('offline');
    
    // 触发事件
    window.dispatchEvent(onlineEvent);
    
    // 验证回调是否被调用
    expect(onlineHandlerMock).toHaveBeenCalledTimes(1);
    expect(offlineHandlerMock).not.toHaveBeenCalled();
    
    // 触发离线事件
    window.dispatchEvent(offlineEvent);
    
    // 验证离线回调是否被调用
    expect(offlineHandlerMock).toHaveBeenCalledTimes(1);
  });

  test('应该在初始化时根据当前状态触发回调', () => {
    // 清除现有实例
    networkMonitor.removeAllListeners();
    
    // 模拟离线状态
    window.navigator.onLine = false;
    
    // 创建新的处理函数
    const initialOnlineMock = jest.fn();
    const initialOfflineMock = jest.fn();
    
    // 创建新实例，应该触发初始状态回调
    const newMonitor = new NetworkMonitor({ 
      triggerInitialState: true,
      onOnline: initialOnlineMock,
      onOffline: initialOfflineMock
    });
    
    // 验证是否根据当前状态调用了正确的回调
    expect(initialOnlineMock).not.toHaveBeenCalled();
    expect(initialOfflineMock).toHaveBeenCalledTimes(1);
    
    // 模拟在线状态
    window.navigator.onLine = true;
    
    // 创建另一个新实例
    const anotherMonitor = new NetworkMonitor({ 
      triggerInitialState: true,
      onOnline: initialOnlineMock,
      onOffline: initialOfflineMock
    });
    
    // 验证是否调用了在线回调
    expect(initialOnlineMock).toHaveBeenCalledTimes(1);
    
    // 清理
    newMonitor.removeAllListeners();
    anotherMonitor.removeAllListeners();
  });

  test('应该能移除特定监听器', () => {
    // 添加额外的监听器
    const additionalHandler = jest.fn();
    networkMonitor.addStatusChangeListener('online', additionalHandler);
    
    // 删除其中一个监听器
    networkMonitor.removeStatusChangeListener('online', onlineHandlerMock);
    
    // 触发事件
    const onlineEvent = new Event('online');
    window.dispatchEvent(onlineEvent);
    
    // 验证结果 - 只有additionalHandler应该被调用
    expect(onlineHandlerMock).not.toHaveBeenCalled();
    expect(additionalHandler).toHaveBeenCalledTimes(1);
  });

  test('应该能处理频繁的网络状态变化', () => {
    // 测试节流功能，模拟快速的网络状态变化
    
    // 设置节流时间为100ms的新监视器
    const throttledMonitor = new NetworkMonitor({ throttleInterval: 100 });
    
    // 设置模拟回调
    const throttledOnlineCallback = jest.fn();
    const throttledOfflineCallback = jest.fn();
    
    throttledMonitor.addStatusChangeListener('online', throttledOnlineCallback);
    throttledMonitor.addStatusChangeListener('offline', throttledOfflineCallback);
    
    // 模拟5次快速的状态变化
    for (let i = 0; i < 5; i++) {
      window.dispatchEvent(new Event('online'));
      window.dispatchEvent(new Event('offline'));
    }
    
    // 由于节流，应该只调用一次
    expect(throttledOnlineCallback).toHaveBeenCalledTimes(1);
    expect(throttledOfflineCallback).toHaveBeenCalledTimes(1);
    
    // 模拟时间前进150ms
    jest.advanceTimersByTime(150);
    
    // 再次触发事件
    window.dispatchEvent(new Event('online'));
    
    // 现在应该再调用一次
    expect(throttledOnlineCallback).toHaveBeenCalledTimes(2);
    
    // 清理
    throttledMonitor.removeAllListeners();
  });

  test('应该在网络不稳定时记录状态变化次数', () => {
    // 添加控制台间谍
    const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    
    // 使用配置创建监视器，设置不稳定阈值
    const stabilityMonitor = new NetworkMonitor({ 
      unstableThreshold: 3,
      unstablePeriod: 1000,
      logUnstable: true
    });
    
    // 在短时间内频繁切换网络状态
    for (let i = 0; i < 5; i++) {
      window.dispatchEvent(new Event('online'));
      window.dispatchEvent(new Event('offline'));
    }
    
    // 验证不稳定警告被记录
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining('网络连接不稳定'),
      expect.any(Number)
    );
    
    // 验证不稳定状态被正确识别
    expect(stabilityMonitor.isNetworkStable()).toBe(false);
    
    // 模拟时间前进 1500ms (超过不稳定期)
    jest.advanceTimersByTime(1500);
    
    // 验证状态恢复稳定
    expect(stabilityMonitor.isNetworkStable()).toBe(true);
    
    // 清理
    stabilityMonitor.removeAllListeners();
    consoleWarnSpy.mockRestore();
  });
  
  test('应该能测量网络延迟', async () => {
    // 模拟fetch API
    global.fetch = jest.fn().mockImplementation(() => {
      return Promise.resolve({
        ok: true,
        status: 200
      });
    });
    
    // 模拟性能API
    const performanceNowMock = jest.fn()
      .mockReturnValueOnce(1000)  // 开始时间
      .mockReturnValueOnce(1050); // 结束时间
    
    const originalNow = performance.now;
    performance.now = performanceNowMock;
    
    // 测试延迟测量
    const latency = await networkMonitor.measureNetworkLatency();
    
    // 验证结果
    expect(latency).toBe(50); // 差值应该是50ms
    expect(fetch).toHaveBeenCalledWith(expect.any(String), { method: 'HEAD', cache: 'no-cache' });
    
    // 恢复原始函数
    performance.now = originalNow;
  });
  
  test('应该在离线状态下返回错误的延迟测量', async () => {
    // 设置离线状态
    window.navigator.onLine = false;
    
    // 测试延迟测量
    const latency = await networkMonitor.measureNetworkLatency();
    
    // 验证结果
    expect(latency).toBe(-1); // 离线时返回-1
  });
}); 