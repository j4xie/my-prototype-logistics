// 模拟MemoryMonitor类
class MemoryMonitor {
  constructor(options = {}) {
    this.options = options;
    this.isMonitoring = false;
    this.eventListeners = {};
    this.memoryData = {
      totalJSHeapSize: 50 * 1024 * 1024, // 50MB 初始值
      usedJSHeapSize: 20 * 1024 * 1024,  // 20MB 初始值
      jsHeapSizeLimit: 2048 * 1024 * 1024, // 2GB 最大限制
      deviceMemory: 8, // 假设设备有8GB内存
      resourceMemoryUsage: new Map()
    };
    this.samplingInterval = options.samplingInterval || 1000; // 默认1秒
    this.memoryPressureThreshold = options.memoryPressureThreshold || 0.7; // 70%
    this.memoryPressure = 'normal'; // normal, moderate, critical
    this.sampleCount = 0;
    this.samplingTimer = null;
  }

  start() {
    if (this.isMonitoring) return this;
    
    this.isMonitoring = true;
    this.startMemorySampling();
    return this;
  }

  stop() {
    this.isMonitoring = false;
    this.stopMemorySampling();
    return this;
  }

  startMemorySampling() {
    if (this.samplingTimer) clearInterval(this.samplingTimer);
    
    this.samplingTimer = setInterval(() => {
      this.sampleMemory();
    }, this.samplingInterval);
  }

  stopMemorySampling() {
    if (this.samplingTimer) {
      clearInterval(this.samplingTimer);
      this.samplingTimer = null;
    }
  }

  sampleMemory() {
    // 每次进行模拟内存采样时，模拟内存变化
    this.sampleCount++;
    
    // 模拟内存使用波动 (随着采样次数增加而增长，模拟内存泄漏)
    const baseMemory = 20 * 1024 * 1024; // 基础20MB
    const growthFactor = Math.min(this.sampleCount / 100, 10); // 最大增长10倍
    const randomVariation = (Math.random() * 5 - 2.5) * 1024 * 1024; // -2.5MB 到 +2.5MB的随机波动
    
    this.memoryData.usedJSHeapSize = baseMemory * (1 + growthFactor) + randomVariation;
    
    // 确保数值合理
    this.memoryData.usedJSHeapSize = Math.max(this.memoryData.usedJSHeapSize, 5 * 1024 * 1024); // 最小5MB
    this.memoryData.usedJSHeapSize = Math.min(this.memoryData.usedJSHeapSize, this.memoryData.jsHeapSizeLimit); // 不超过限制
    
    // 更新内存压力状态
    this.updateMemoryPressure();
    
    // 触发内存采样事件
    this._dispatchEvent('memory:sample', this.getMemoryInfo());
  }

  updateMemoryPressure() {
    const memoryUsageRatio = this.memoryData.usedJSHeapSize / this.memoryData.jsHeapSizeLimit;
    
    let newPressure = 'normal';
    if (memoryUsageRatio > 0.9) {
      newPressure = 'critical';
    } else if (memoryUsageRatio > this.memoryPressureThreshold) {
      newPressure = 'moderate';
    }
    
    if (newPressure !== this.memoryPressure) {
      const oldPressure = this.memoryPressure;
      this.memoryPressure = newPressure;
      this._dispatchEvent('memory:pressure', {
        previous: oldPressure,
        current: newPressure,
        usageRatio: memoryUsageRatio
      });
    }
  }

  getMemoryInfo() {
    return {
      ...this.memoryData,
      memoryPressure: this.memoryPressure,
      usageRatio: this.memoryData.usedJSHeapSize / this.memoryData.jsHeapSizeLimit
    };
  }

  simulateMemoryPressure(level) {
    const levels = {
      normal: 0.4,
      moderate: 0.75,
      critical: 0.95
    };
    
    if (!levels[level]) {
      throw new Error(`无效的内存压力级别: ${level}. 有效值为: normal, moderate, critical`);
    }
    
    // 设置模拟内存使用率
    this.memoryData.usedJSHeapSize = this.memoryData.jsHeapSizeLimit * levels[level];
    this.updateMemoryPressure();
    
    return this;
  }

  trackResourceMemory(resourceId, size) {
    this.memoryData.resourceMemoryUsage.set(resourceId, size);
    this.memoryData.usedJSHeapSize += size;
    this.updateMemoryPressure();
    return size;
  }

  untrackResourceMemory(resourceId) {
    if (this.memoryData.resourceMemoryUsage.has(resourceId)) {
      const size = this.memoryData.resourceMemoryUsage.get(resourceId);
      this.memoryData.resourceMemoryUsage.delete(resourceId);
      this.memoryData.usedJSHeapSize -= size;
      this.updateMemoryPressure();
    }
  }

  resetTracking() {
    this.memoryData.resourceMemoryUsage.clear();
    this.sampleCount = 0;
    this.memoryData.usedJSHeapSize = 20 * 1024 * 1024; // 重置为初始值
    this.updateMemoryPressure();
  }

  addEventListener(event, callback) {
    if (!this.eventListeners[event]) {
      this.eventListeners[event] = [];
    }
    this.eventListeners[event].push(callback);
  }

  removeEventListener(event, callback) {
    if (!this.eventListeners[event]) return;
    this.eventListeners[event] = this.eventListeners[event].filter(cb => cb !== callback);
  }

  _dispatchEvent(event, data) {
    const listeners = this.eventListeners[event] || [];
    listeners.forEach(callback => {
      try {
        callback(data);
      } catch (e) {
        console.error(`事件处理器错误: ${e.message}`, e);
      }
    });
  }
}

module.exports = { MemoryMonitor }; 