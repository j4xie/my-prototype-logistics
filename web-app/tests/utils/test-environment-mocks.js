/**
 * @file 测试环境配置
 * @description 为测试提供环境模拟，包括性能API和网络API
 */

// 全局性能API模拟
class PerformanceAPI {
  constructor() {
    this.marks = {};
    this.measures = {};
    this.now = () => Date.now();
    this.memory = {
      usedJSHeapSize: 10 * 1024 * 1024, // 10MB
      totalJSHeapSize: 100 * 1024 * 1024, // 100MB
      jsHeapSizeLimit: 2 * 1024 * 1024 * 1024 // 2GB
    };
  }
  
  mark(name) {
    this.marks[name] = this.now();
  }
  
  measure(name, startMark, endMark) {
    if (!this.marks[startMark] || !this.marks[endMark]) {
      throw new Error(`Mark not found: ${!this.marks[startMark] ? startMark : endMark}`);
    }
    
    this.measures[name] = {
      startTime: this.marks[startMark],
      endTime: this.marks[endMark],
      duration: this.marks[endMark] - this.marks[startMark]
    };
    
    return this.measures[name];
  }
}

// 如果全局性能API不存在，则创建
if (typeof global.performance === 'undefined') {
  global.performance = new PerformanceAPI();
} else {
  // 确保performance.memory存在
  if (!global.performance.memory) {
    global.performance.memory = {
      usedJSHeapSize: 10 * 1024 * 1024, // 10MB
      totalJSHeapSize: 100 * 1024 * 1024, // 100MB
      jsHeapSizeLimit: 2 * 1024 * 1024 * 1024 // 2GB
    };
  }
  
  // 确保performance.mark和measure方法存在
  if (!global.performance.mark) {
    global.performance.mark = function(name) {
      if (!global.performance._marks) global.performance._marks = {};
      global.performance._marks[name] = global.performance.now();
    };
  }
  
  if (!global.performance.measure) {
    global.performance.measure = function(name, startMark, endMark) {
      if (!global.performance._measures) global.performance._measures = {};
      if (!global.performance._marks) global.performance._marks = {};
      
      if (!global.performance._marks[startMark] || !global.performance._marks[endMark]) {
        throw new Error(`Mark not found: ${!global.performance._marks[startMark] ? startMark : endMark}`);
      }
      
      global.performance._measures[name] = {
        startTime: global.performance._marks[startMark],
        endTime: global.performance._marks[endMark],
        duration: global.performance._marks[endMark] - global.performance._marks[startMark]
      };
      
      return global.performance._measures[name];
    };
  }
}

// 模拟网络连接类型
const CONNECTION_TYPES = {
  UNKNOWN: 'unknown',
  ETHERNET: 'ethernet',
  WIFI: 'wifi',
  CELL_2G: '2g',
  CELL_3G: '3g',
  CELL_4G: '4g',
  CELL_5G: '5g'
};

// 模拟网络连接状态
class NetworkConnectionInfo {
  constructor(type = CONNECTION_TYPES.WIFI) {
    this.type = type;
    this.effectiveType = type;
    this.downlink = this._getDownlinkByType(type);
    this.rtt = this._getRttByType(type);
    this.saveData = false;
  }
  
  _getDownlinkByType(type) {
    switch (type) {
      case CONNECTION_TYPES.ETHERNET: return 100;
      case CONNECTION_TYPES.WIFI: return 30;
      case CONNECTION_TYPES.CELL_5G: return 20;
      case CONNECTION_TYPES.CELL_4G: return 10;
      case CONNECTION_TYPES.CELL_3G: return 2;
      case CONNECTION_TYPES.CELL_2G: return 0.5;
      default: return 1;
    }
  }
  
  _getRttByType(type) {
    switch (type) {
      case CONNECTION_TYPES.ETHERNET: return 10;
      case CONNECTION_TYPES.WIFI: return 30;
      case CONNECTION_TYPES.CELL_5G: return 50;
      case CONNECTION_TYPES.CELL_4G: return 100;
      case CONNECTION_TYPES.CELL_3G: return 200;
      case CONNECTION_TYPES.CELL_2G: return 500;
      default: return 100;
    }
  }
}

// 如果navigator.connection不存在，则模拟
if (typeof global.navigator === 'undefined') {
  global.navigator = {};
}

if (!global.navigator.connection) {
  global.navigator.connection = new NetworkConnectionInfo();
  
  // 添加change事件监听
  global.navigator.connection.addEventListener = function(event, handler) {
    if (!global.navigator.connection._listeners) {
      global.navigator.connection._listeners = {};
    }
    
    if (!global.navigator.connection._listeners[event]) {
      global.navigator.connection._listeners[event] = [];
    }
    
    global.navigator.connection._listeners[event].push(handler);
  };
  
  // 模拟网络变化
  global.navigator.connection.simulateChange = function(connectionType) {
    const oldType = this.type;
    this.type = connectionType;
    this.effectiveType = connectionType;
    this.downlink = this._getDownlinkByType(connectionType);
    this.rtt = this._getRttByType(connectionType);
    
    // 触发change事件
    if (this._listeners && this._listeners.change) {
      const event = { type: 'change', oldType, newType: connectionType };
      this._listeners.change.forEach(handler => handler(event));
    }
  };
}

// 模拟资源加载时间
function simulateResourceLoadTime(resource) {
  const type = resource.type;
  const size = resource.size || 1000;
  const priority = resource.priority || 0; // 0: 高, 1: 中, 2: 低
  
  // 基于资源类型、大小和优先级计算加载时间
  let baseTime = 0;
  
  // 根据类型调整基础加载时间
  switch (type) {
    case 'image':
      baseTime = 50 + size / 50000; // 图片加载速度较慢
      break;
    case 'script':
      baseTime = 30 + size / 30000; // 脚本加载速度中等
      break;
    case 'style':
      baseTime = 20 + size / 20000; // 样式加载速度较快
      break;
    default:
      baseTime = 40 + size / 40000;
  }
  
  // 根据优先级调整加载时间
  const priorityMultiplier = 1 + priority * 0.2; // 高优先级加载更快
  
  // 根据网络条件调整加载时间
  const connectionType = global.navigator.connection.type;
  let networkMultiplier = 1;
  
  switch (connectionType) {
    case CONNECTION_TYPES.ETHERNET:
      networkMultiplier = 0.5;
      break;
    case CONNECTION_TYPES.WIFI:
      networkMultiplier = 1;
      break;
    case CONNECTION_TYPES.CELL_5G:
      networkMultiplier = 1.5;
      break;
    case CONNECTION_TYPES.CELL_4G:
      networkMultiplier = 2;
      break;
    case CONNECTION_TYPES.CELL_3G:
      networkMultiplier = 4;
      break;
    case CONNECTION_TYPES.CELL_2G:
      networkMultiplier = 10;
      break;
    default:
      networkMultiplier = 2;
  }
  
  // 添加一些随机性
  const randomFactor = 0.8 + Math.random() * 0.4; // 0.8-1.2之间的随机数
  
  // 计算最终加载时间
  const loadTime = baseTime * priorityMultiplier * networkMultiplier * randomFactor;
  
  return Math.max(10, Math.round(loadTime)); // 最小10ms
}

// 导出工具函数 - 作为test-environment-mocks模块
module.exports = {
  CONNECTION_TYPES,
  simulateResourceLoadTime,
  simulateNetworkChange: (type) => {
    if (global.navigator && global.navigator.connection) {
      global.navigator.connection.simulateChange(type);
    }
  }
}; 