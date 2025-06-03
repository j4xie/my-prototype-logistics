/**
 * @file 批处理大小自适应控制器测试
 * @description 测试批处理大小自适应控制器在不同设备和网络条件下的调整行为
 */

const BatchSizeAdaptiveController = require('./batch-size-adaptive-controller');
const { DevicePerformanceDetector, NetworkBandwidthDetector } = require('./concurrency-optimizer');

// 模拟 DevicePerformanceDetector
jest.mock('./concurrency-optimizer', () => {
  const originalModule = jest.requireActual('./concurrency-optimizer');
  
  // 模拟设备性能检测器
  const mockDeviceDetector = {
    metrics: {
      deviceType: 'desktop',
      cpuScore: 80,
      memoryScore: 70,
      hardwareScore: 75,
      cpuCores: 4,
      batteryStatus: null
    },
    getPerformanceScore: function() {
      return { ...this.metrics };
    }
  };
  
  // 模拟网络带宽检测器
  const mockNetworkDetector = {
    metrics: {
      connectionType: 'wifi',
      downlink: 5,
      rtt: 50,
      effectiveType: '4g',
      lastMeasured: Date.now()
    },
    getNetworkMetrics: function() {
      return { ...this.metrics };
    },
    cleanup: jest.fn()
  };
  
  return {
    ...originalModule,
    DevicePerformanceDetector: jest.fn(() => mockDeviceDetector),
    NetworkBandwidthDetector: jest.fn(() => mockNetworkDetector)
  };
});

describe('BatchSizeAdaptiveController', () => {
  // 测试前的准备
  let controller;
  let deviceDetector;
  let networkDetector;
  
  beforeEach(() => {
    // 创建控制器实例
    controller = new BatchSizeAdaptiveController({
      enableAutoUpdate: false, // 禁用自动更新，以便于测试
      minBatchSize: 5,
      maxBatchSize: 50,
      defaultBatchSize: 20
    });
    
    // 获取模拟的检测器实例
    deviceDetector = controller.deviceDetector;
    networkDetector = controller.networkDetector;
    
    // 清除定时器
    jest.clearAllTimers();
  });
  
  afterEach(() => {
    // 清理资源
    controller.cleanup();
    jest.clearAllMocks();
  });
  
  it('应该使用默认值正确初始化', () => {
    expect(controller.state.currentBatchSize).toBe(20);
    expect(controller.config.minBatchSize).toBe(5);
    expect(controller.config.maxBatchSize).toBe(50);
    expect(controller.config.deviceTypeDefaults.desktop).toBe(30);
    expect(controller.config.deviceTypeDefaults.mobile).toBe(15);
  });
  
  it('应该基于设备类型设置不同的基础批处理大小', () => {
    // 设置为移动设备
    deviceDetector.metrics.deviceType = 'mobile';
    let result = controller.updateBatchSize();
    expect(result.batchSize).toBeLessThan(30); // 移动设备批处理大小应该小于桌面设备
    
    // 设置为桌面设备
    deviceDetector.metrics.deviceType = 'desktop';
    result = controller.updateBatchSize();
    expect(result.batchSize).toBeGreaterThan(15); // 桌面设备批处理大小应该大于移动设备
    
    // 设置为低端设备
    deviceDetector.metrics.deviceType = 'low-end';
    result = controller.updateBatchSize();
    expect(result.batchSize).toBeLessThan(15); // 低端设备批处理大小应该很小
  });
  
  it('应该根据网络条件调整批处理大小', () => {
    // 设置为4G网络
    networkDetector.metrics.effectiveType = '4g';
    networkDetector.metrics.downlink = 10;
    let result = controller.updateBatchSize();
    const fourGBatchSize = result.batchSize;
    
    // 设置为3G网络
    networkDetector.metrics.effectiveType = '3g';
    networkDetector.metrics.downlink = 2;
    result = controller.updateBatchSize();
    const threeGBatchSize = result.batchSize;
    
    // 设置为2G网络
    networkDetector.metrics.effectiveType = '2g';
    networkDetector.metrics.downlink = 0.5;
    result = controller.updateBatchSize();
    const twoGBatchSize = result.batchSize;
    
    // 验证网络条件影响
    expect(fourGBatchSize).toBeGreaterThan(threeGBatchSize);
    expect(threeGBatchSize).toBeGreaterThan(twoGBatchSize);
  });
  
  it('应该根据设备性能调整批处理大小', () => {
    // 设置为高性能设备
    deviceDetector.metrics.hardwareScore = 90;
    deviceDetector.metrics.cpuScore = 95;
    deviceDetector.metrics.cpuCores = 8;
    let result = controller.updateBatchSize();
    const highPerfBatchSize = result.batchSize;
    
    // 设置为中性能设备
    deviceDetector.metrics.hardwareScore = 60;
    deviceDetector.metrics.cpuScore = 65;
    deviceDetector.metrics.cpuCores = 4;
    result = controller.updateBatchSize();
    const mediumPerfBatchSize = result.batchSize;
    
    // 设置为低性能设备
    deviceDetector.metrics.hardwareScore = 30;
    deviceDetector.metrics.cpuScore = 35;
    deviceDetector.metrics.cpuCores = 2;
    result = controller.updateBatchSize();
    const lowPerfBatchSize = result.batchSize;
    
    // 验证设备性能影响
    expect(highPerfBatchSize).toBeGreaterThan(mediumPerfBatchSize);
    expect(mediumPerfBatchSize).toBeGreaterThan(lowPerfBatchSize);
  });
  
  it('应该在低电量状态下减少批处理大小', () => {
    // 设置为正常电量
    deviceDetector.metrics.batteryStatus = {
      level: 0.8,
      charging: false
    };
    let result = controller.updateBatchSize();
    const normalBatteryBatchSize = result.batchSize;
    
    // 设置为低电量 (20%)
    deviceDetector.metrics.batteryStatus = {
      level: 0.2,
      charging: false
    };
    result = controller.updateBatchSize();
    const lowBatteryBatchSize = result.batchSize;
    
    // 设置为极低电量 (5%)
    deviceDetector.metrics.batteryStatus = {
      level: 0.05,
      charging: false
    };
    result = controller.updateBatchSize();
    const veryLowBatteryBatchSize = result.batchSize;
    
    // 设置为充电状态 (即使电量低)
    deviceDetector.metrics.batteryStatus = {
      level: 0.05,
      charging: true
    };
    result = controller.updateBatchSize();
    const chargingBatchSize = result.batchSize;
    
    // 验证电池状态影响
    expect(normalBatteryBatchSize).toBeGreaterThan(lowBatteryBatchSize);
    expect(lowBatteryBatchSize).toBeGreaterThan(veryLowBatteryBatchSize);
    expect(chargingBatchSize).toBeGreaterThan(veryLowBatteryBatchSize);
  });
  
  it('应该记录性能历史并使用历史数据影响批处理大小', () => {
    // 记录一些性能历史数据
    // 批处理大小15的性能很好
    for (let i = 0; i < 3; i++) {
      controller.recordPerformance({
        batchSize: 15,
        loadTime: 100, // 非常快
        successRate: 0.98, // 非常高的成功率
        resourceCount: 15
      });
    }
    
    // 批处理大小30的性能一般
    for (let i = 0; i < 3; i++) {
      controller.recordPerformance({
        batchSize: 30,
        loadTime: 300, // 较慢
        successRate: 0.85, // 一般的成功率
        resourceCount: 30
      });
    }
    
    // 批处理大小45的性能很差
    for (let i = 0; i < 3; i++) {
      controller.recordPerformance({
        batchSize: 45,
        loadTime: 600, // 很慢
        successRate: 0.75, // 低成功率
        resourceCount: 45
      });
    }
    
    // 更新批处理大小
    const result = controller.updateBatchSize();
    
    // 验证历史数据影响
    // 应该更倾向于使用批处理大小15附近的值
    expect(result.batchSize).toBeLessThanOrEqual(25);
    expect(result.factors.historyFactor).toBeLessThan(1.0); // 应该降低批处理大小
  });
  
  it('应该处理极端情况并保持在配置的范围内', () => {
    // 测试极端低值
    deviceDetector.metrics.hardwareScore = 10;
    deviceDetector.metrics.deviceType = 'low-end';
    networkDetector.metrics.effectiveType = 'slow-2g';
    deviceDetector.metrics.batteryStatus = {
      level: 0.05,
      charging: false
    };
    
    let result = controller.updateBatchSize();
    expect(result.batchSize).toBeGreaterThanOrEqual(controller.config.minBatchSize);
    
    // 测试极端高值
    deviceDetector.metrics.hardwareScore = 100;
    deviceDetector.metrics.deviceType = 'desktop';
    deviceDetector.metrics.cpuCores = 16;
    networkDetector.metrics.effectiveType = '4g';
    networkDetector.metrics.downlink = 50;
    deviceDetector.metrics.batteryStatus = {
      level: 1.0,
      charging: true
    };
    
    result = controller.updateBatchSize();
    expect(result.batchSize).toBeLessThanOrEqual(controller.config.maxBatchSize);
  });
  
  it('应该在内存压力大时减少批处理大小', () => {
    // 模拟浏览器性能API
    const originalPerformance = global.performance;
    global.performance = {
      memory: {
        usedJSHeapSize: 0,
        totalJSHeapSize: 100
      }
    };
    
    // 测试低内存压力
    global.performance.memory.usedJSHeapSize = 50; // 50%
    let result = controller.updateBatchSize();
    const lowPressureBatchSize = result.batchSize;
    
    // 测试高内存压力
    global.performance.memory.usedJSHeapSize = 85; // 85%
    result = controller.updateBatchSize();
    const highPressureBatchSize = result.batchSize;
    
    // 恢复原始对象
    global.performance = originalPerformance;
    
    // 验证内存压力影响
    expect(lowPressureBatchSize).toBeGreaterThan(highPressureBatchSize);
  });
  
  it('应该提供完整的批处理大小调整历史记录', () => {
    // 执行多次批处理大小更新
    controller.updateBatchSize();
    
    // 改变一些条件
    deviceDetector.metrics.hardwareScore = 90;
    networkDetector.metrics.effectiveType = '3g';
    controller.updateBatchSize();
    
    // 再次改变条件
    deviceDetector.metrics.hardwareScore = 50;
    networkDetector.metrics.effectiveType = '4g';
    controller.updateBatchSize();
    
    // 验证历史记录
    expect(controller.state.batchSizeHistory.length).toBe(3);
    expect(controller.state.batchSizeHistory[0].factors).toBeDefined();
    expect(controller.state.batchSizeHistory[1].oldValue).toBe(controller.state.batchSizeHistory[0].newValue);
  });
  
  it('应该在cleanup后释放资源', () => {
    controller.cleanup();
    expect(networkDetector.cleanup).toHaveBeenCalled();
  });
});

// 测试自动更新功能
describe('BatchSizeAdaptiveController - 自动更新功能', () => {
  let controller;
  
  beforeEach(() => {
    jest.useFakeTimers();
    
    // 创建启用自动更新的控制器
    controller = new BatchSizeAdaptiveController({
      updateInterval: 5000
    });
    
    // 监视 updateBatchSize 方法
    controller.updateBatchSize = jest.fn();
  });
  
  afterEach(() => {
    controller.cleanup();
    jest.clearAllTimers();
    jest.useRealTimers();
  });
  
  it('应该根据配置的间隔自动更新批处理大小', () => {
    // 初始化后应该已经调用了一次
    expect(controller.updateBatchSize).toHaveBeenCalledTimes(1);
    
    // 快进时间
    jest.advanceTimersByTime(5000);
    expect(controller.updateBatchSize).toHaveBeenCalledTimes(2);
    
    // 再次快进时间
    jest.advanceTimersByTime(5000);
    expect(controller.updateBatchSize).toHaveBeenCalledTimes(3);
  });
  
  it('应该在cleanup后停止自动更新', () => {
    controller.cleanup();
    
    // 清除之前的计数
    controller.updateBatchSize.mockClear();
    
    // 快进时间
    jest.advanceTimersByTime(10000);
    
    // 不应该有新的调用
    expect(controller.updateBatchSize).not.toHaveBeenCalled();
  });
}); 