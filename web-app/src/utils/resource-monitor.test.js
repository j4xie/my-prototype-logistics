/**
 * 资源监控器（ResourceMonitor）的单元测试
 */

const ResourceMonitor = require('./resource-monitor');

// 模拟 window.performance
const mockPerformance = {
  memory: {
    usedJSHeapSize: 50 * 1024 * 1024, // 50MB
    jsHeapSizeLimit: 100 * 1024 * 1024, // 100MB
    totalJSHeapSize: 60 * 1024 * 1024 // 60MB
  },
  now: jest.fn().mockImplementation(() => Date.now())
};

// 模拟 PerformanceObserver
const mockObserve = jest.fn();
const mockDisconnect = jest.fn();
class MockPerformanceObserver {
  constructor(callback) {
    this.callback = callback;
    this.observe = mockObserve;
    this.disconnect = mockDisconnect;
  }
  
  // 模拟触发性能条目通知
  triggerEntries(entries) {
    this.callback({
      getEntries: () => entries
    });
  }
}

describe('ResourceMonitor', () => {
  let originalPerformance;
  let originalPerformanceObserver;
  
  beforeEach(() => {
    // 保存原始对象
    originalPerformance = window.performance;
    originalPerformanceObserver = window.PerformanceObserver;
    
    // 模拟性能API
    window.performance = {...originalPerformance, ...mockPerformance};
    window.PerformanceObserver = MockPerformanceObserver;
    
    // 重置模拟函数
    mockObserve.mockClear();
    mockDisconnect.mockClear();
    performance.now.mockClear();
  });
  
  afterEach(() => {
    // 恢复原始对象
    window.performance = originalPerformance;
    window.PerformanceObserver = originalPerformanceObserver;
  });
  
  test('应正确初始化资源监控器', () => {
    const monitor = new ResourceMonitor();
    
    expect(monitor.isMonitoring).toBe(false);
    expect(monitor.options.interval).toBe(5000);
    expect(monitor.options.memoryWarningThreshold).toBe(0.8);
    expect(monitor.options.cpuWarningThreshold).toBe(0.7);
    expect(monitor.options.enableLogging).toBe(true);
  });
  
  test('应使用自定义选项初始化', () => {
    const customOptions = {
      interval: 10000,
      memoryWarningThreshold: 0.9,
      cpuWarningThreshold: 0.6,
      enableLogging: false,
      logLevel: 'DEBUG'
    };
    
    const monitor = new ResourceMonitor(customOptions);
    
    expect(monitor.options.interval).toBe(10000);
    expect(monitor.options.memoryWarningThreshold).toBe(0.9);
    expect(monitor.options.cpuWarningThreshold).toBe(0.6);
    expect(monitor.options.enableLogging).toBe(false);
    expect(monitor.options.logLevel).toBe('DEBUG');
  });
  
  test('应正确启动和停止监控', () => {
    jest.useFakeTimers();
    
    const monitor = new ResourceMonitor();
    
    // 测试启动
    const startResult = monitor.start();
    expect(startResult).toBe(true);
    expect(monitor.isMonitoring).toBe(true);
    expect(monitor.monitoringInterval).not.toBeNull();
    
    // 测试再次启动（应返回false）
    const secondStartResult = monitor.start();
    expect(secondStartResult).toBe(false);
    
    // 测试定时器
    jest.advanceTimersByTime(5000);
    // 5秒后应该调用了_collectStats至少一次
    
    // 测试停止
    const stopResult = monitor.stop();
    expect(stopResult).toBe(true);
    expect(monitor.isMonitoring).toBe(false);
    expect(monitor.monitoringInterval).toBeNull();
    
    // 测试再次停止（应返回false）
    const secondStopResult = monitor.stop();
    expect(secondStopResult).toBe(false);
    
    jest.useRealTimers();
  });
  
  test('应正确添加和移除事件监听器', () => {
    const monitor = new ResourceMonitor();
    const mockCallback = jest.fn();
    
    // 添加有效监听器
    const addResult = monitor.addEventListener('memory', mockCallback);
    expect(addResult).toBe(true);
    expect(monitor.listeners.memory).toContain(mockCallback);
    
    // 添加无效资源类型的监听器
    const invalidAddResult = monitor.addEventListener('invalid-type', mockCallback);
    expect(invalidAddResult).toBe(false);
    
    // 移除有效监听器
    const removeResult = monitor.removeEventListener('memory', mockCallback);
    expect(removeResult).toBe(true);
    expect(monitor.listeners.memory).not.toContain(mockCallback);
    
    // 移除已移除的监听器
    const secondRemoveResult = monitor.removeEventListener('memory', mockCallback);
    expect(secondRemoveResult).toBe(false);
    
    // 移除无效资源类型的监听器
    const invalidRemoveResult = monitor.removeEventListener('invalid-type', mockCallback);
    expect(invalidRemoveResult).toBe(false);
  });
  
  test('应正确获取资源统计', () => {
    const monitor = new ResourceMonitor();
    
    // 获取默认统计
    const initialStats = monitor.getStats();
    expect(initialStats).toEqual(monitor.stats);
    expect(initialStats).not.toBe(monitor.stats); // 应该是深拷贝
    
    // 修改内部状态后再检查
    monitor.stats.memory.usage = 1000;
    monitor.stats.cpu.usage = 0.5;
    
    const updatedStats = monitor.getStats();
    expect(updatedStats.memory.usage).toBe(1000);
    expect(updatedStats.cpu.usage).toBe(0.5);
  });
  
  test('应正确记录网络请求', () => {
    const monitor = new ResourceMonitor();
    const mockNetworkListener = jest.fn();
    
    monitor.addEventListener('network', mockNetworkListener);
    
    // 测试请求开始
    monitor.recordRequestStart('https://example.com/api', { method: 'GET' });
    expect(monitor.networkRequests.active).toBe(1);
    expect(mockNetworkListener).toHaveBeenCalledWith(expect.objectContaining({
      type: 'request_start',
      url: 'https://example.com/api',
      options: { method: 'GET' }
    }));
    
    mockNetworkListener.mockClear();
    
    // 测试请求完成
    monitor.recordRequestComplete('https://example.com/api', 200, 1024);
    expect(monitor.networkRequests.active).toBe(0);
    expect(monitor.networkRequests.completed).toBe(1);
    expect(monitor.networkRequests.totalBytes).toBe(1024);
    expect(monitor.stats.network.bytesReceived).toBe(1024);
    expect(mockNetworkListener).toHaveBeenCalledWith(expect.objectContaining({
      type: 'request_complete',
      url: 'https://example.com/api',
      status: 200,
      bytes: 1024
    }));
    
    mockNetworkListener.mockClear();
    
    // 测试请求失败
    const error = new Error('网络错误');
    monitor.recordRequestFailed('https://example.com/api', error);
    expect(monitor.networkRequests.active).toBe(-1); // 因为没有先调用recordRequestStart
    expect(monitor.networkRequests.failed).toBe(1);
    expect(mockNetworkListener).toHaveBeenCalledWith(expect.objectContaining({
      type: 'request_failed',
      url: 'https://example.com/api',
      error: error.message
    }));
  });
  
  test('应收集内存统计', () => {
    const monitor = new ResourceMonitor();
    const mockMemoryListener = jest.fn();
    
    monitor.addEventListener('memory', mockMemoryListener);
    
    // 直接调用私有方法进行测试
    monitor._collectMemoryStats();
    
    // 验证内存统计已更新
    expect(monitor.stats.memory.usage).toBe(50 * 1024 * 1024);
    expect(monitor.stats.memory.limit).toBe(100 * 1024 * 1024);
    expect(monitor.stats.memory.usagePercent).toBe(0.5);
    
    // 验证监听器已被调用
    expect(mockMemoryListener).toHaveBeenCalledWith(monitor.stats.memory);
  });
  
  test('应处理性能条目通知', () => {
    // 设置监控器
    const monitor = new ResourceMonitor();
    
    // 找到 PerformanceObserver 实例
    const observerInstance = window.PerformanceObserver.mock.instances[0];
    
    // 模拟性能条目
    const mockEntries = [
      {
        entryType: 'resource',
        name: 'https://example.com/image.jpg',
        duration: 200,
        transferSize: 5000
      },
      {
        entryType: 'resource',
        name: 'https://example.com/script.js',
        duration: 150,
        transferSize: 10000
      }
    ];
    
    // 触发条目通知
    observerInstance.triggerEntries(mockEntries);
    
    // 验证网络统计已更新
    expect(monitor.stats.network.bytesReceived).toBe(15000);
    expect(monitor.stats.network.history.length).toBe(2);
    expect(monitor.stats.network.history[0].url).toBe('https://example.com/image.jpg');
    expect(monitor.stats.network.history[0].size).toBe(5000);
    expect(monitor.stats.network.history[1].url).toBe('https://example.com/script.js');
    expect(monitor.stats.network.history[1].size).toBe(10000);
  });
  
  test('应触发资源警报', () => {
    const monitor = new ResourceMonitor({
      memoryWarningThreshold: 0.4, // 设为0.4以触发警报
      enableAlerts: true
    });
    
    const mockAlertListener = jest.fn();
    monitor.addEventListener('alert', mockAlertListener);
    
    // 直接调用私有方法进行测试
    monitor._collectMemoryStats();
    monitor._checkResourceWarnings();
    
    // 验证警报已触发（因为内存使用率为0.5，超过了0.4的阈值）
    expect(mockAlertListener).toHaveBeenCalledWith(expect.objectContaining({
      type: 'memory',
      level: 'warning',
      value: 0.5,
      threshold: 0.4
    }));
  });
  
  test('应在禁用警报时不触发警报', () => {
    const monitor = new ResourceMonitor({
      memoryWarningThreshold: 0.4, // 设为0.4以触发警报
      enableAlerts: false // 禁用警报
    });
    
    const mockAlertListener = jest.fn();
    monitor.addEventListener('alert', mockAlertListener);
    
    // 直接调用私有方法进行测试
    monitor._collectMemoryStats();
    monitor._checkResourceWarnings();
    
    // 验证警报未触发
    expect(mockAlertListener).not.toHaveBeenCalled();
  });
}); 