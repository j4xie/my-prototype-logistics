/**
 * @file 性能测试工具
 * @description 用于测量和记录性能指标的工具类
 */

class PerformanceTestTool {
  /**
   * 创建性能测试工具实例
   * @param {Object} options - 配置选项
   * @param {number} options.sampleSize - 每个测试的样本数量
   * @param {number} options.warmupRuns - 预热运行次数
   * @param {number} options.cooldownMs - 测试间的冷却时间（毫秒）
   */
  constructor(options = {}) {
    this.config = {
      sampleSize: options.sampleSize || 3,
      warmupRuns: options.warmupRuns || 1,
      cooldownMs: options.cooldownMs || 50
    };
    
    this.isRecording = false;
    this.memorySnapshots = [];
    this.perfMarks = {};
    this.lastTestName = '';
    this.measurements = []; // 存储所有测量结果
    
    // 初始化性能标记
    this._initPerfMarks();
  }
  
  /**
   * 开始记录性能数据
   * @returns {void}
   */
  startRecording() {
    this.isRecording = true;
    this._captureMemorySnapshot('initial');
    console.log('开始记录性能数据');
  }
  
  /**
   * 停止记录性能数据
   * @returns {Object} 最终性能报告
   */
  stopRecording() {
    this.isRecording = false;
    this._captureMemorySnapshot('final');
    
    const report = {
      memoryUsage: this._calculateMemoryUsage(),
      marks: this.perfMarks
    };
    
    console.log('停止记录性能数据，最终报告:', report);
    return report;
  }
  
  /**
   * 测量函数执行性能
   * @param {Function} fn - 要测量的函数
   * @param {string} name - 测试名称
   * @param {Object} params - 传递给测试函数的参数
   * @returns {Promise<Object>} 测试结果
   */
  async measure(fn, name, params = {}) {
    // 如果函数和名称位置互换，则调整参数顺序（向后兼容）
    if (typeof fn === 'string' && typeof name === 'function') {
      [fn, name] = [name, fn];
    }
    
    if (!this.isRecording) {
      console.warn('性能工具未启动记录，请先调用 startRecording()');
      this.startRecording();
    }
    
    this.lastTestName = name;
    console.log(`开始测量: ${name}`);
    
    // 预热运行
    if (this.config.warmupRuns > 0) {
      console.log(`执行 ${this.config.warmupRuns} 次预热运行...`);
      for (let i = 0; i < this.config.warmupRuns; i++) {
        await fn(params);
        await this.cooldown(this.config.cooldownMs / 2);
      }
    }
    
    // 收集样本
    const samples = [];
    const startMarkName = `${name}_start`;
    const endMarkName = `${name}_end`;
    
    for (let i = 0; i < this.config.sampleSize; i++) {
      console.log(`样本 ${i + 1}/${this.config.sampleSize}...`);
      
      // 创建性能标记
      this._mark(startMarkName);
      this._captureMemorySnapshot(`${name}_before_${i}`);
      
      // 执行测试函数
      const startTime = performance.now();
      const result = await fn(params);
      const endTime = performance.now();
      
      // 记录结果
      this._mark(endMarkName);
      this._captureMemorySnapshot(`${name}_after_${i}`);
      
      // 计算持续时间
      const duration = endTime - startTime;
      
      // 添加到样本
      samples.push({
        index: i,
        startTime, 
        endTime,
        duration,
        result
      });
      
      // 等待冷却
      if (i < this.config.sampleSize - 1) {
        await this.cooldown();
      }
    }
    
    // 计算结果
    const durations = samples.map(s => s.duration);
    const avgDuration = durations.reduce((sum, d) => sum + d, 0) / durations.length;
    const minDuration = Math.min(...durations);
    const maxDuration = Math.max(...durations);
    const stdDeviation = this._calculateStdDeviation(durations, avgDuration);
    
    // 获取中位数
    const sortedDurations = [...durations].sort((a, b) => a - b);
    const medianDuration = sortedDurations[Math.floor(sortedDurations.length / 2)];
    
    // 创建最终报告
    const report = {
      name,
      samples,
      sampleCount: samples.length,
      average: avgDuration,
      min: minDuration,
      max: maxDuration,
      median: medianDuration,
      stdDev: stdDeviation,
      memoryUsage: this._calculateMemoryUsage(name),
      timestamp: new Date().toISOString()
    };
    
    // 保存到测量结果数组
    this.measurements.push(report);
    
    console.log(`测量完成: ${name}`);
    console.log(`平均持续时间: ${avgDuration.toFixed(2)}ms (Min: ${minDuration.toFixed(2)}ms, Max: ${maxDuration.toFixed(2)}ms)`);
    
    return report;
  }
  
  /**
   * 获取所有测量结果的摘要
   * @param {boolean} outputFormatted - 是否输出格式化数据（用于报告解析）
   * @returns {Array} 所有测量结果
   */
  getSummary(outputFormatted = true) {
    const summary = this.measurements.map(m => ({
      name: m.name,
      average: m.average,
      min: m.min,
      max: m.max,
      median: m.median,
      stdDev: m.stdDev,
      timestamp: m.timestamp
    }));
    
    // 如果启用了环境变量PERFORMANCE_DATA，或者请求格式化输出，则输出格式化数据
    if (process.env.PERFORMANCE_DATA === 'true' || outputFormatted) {
      console.log('PERFORMANCE_DATA_START');
      console.log(JSON.stringify({
        timestamp: new Date().toISOString(),
        testName: this.lastTestName,
        measurements: summary
      }));
      console.log('PERFORMANCE_DATA_END');
    }
    
    return summary;
  }
  
  /**
   * 等待指定时间（冷却）
   * @param {number} ms - 要等待的毫秒数
   * @returns {Promise<void>}
   */
  async cooldown(ms = this.config.cooldownMs) {
    await new Promise(resolve => setTimeout(resolve, ms));
  }
  
  /**
   * 比较两次测试的性能差异
   * @param {Object} test1 - 第一次测试结果
   * @param {Object} test2 - 第二次测试结果
   * @returns {Object} 性能差异
   */
  compareResults(test1, test2) {
    const durationDiff = test1.average - test2.average;
    const durationDiffPercent = (durationDiff / test1.average) * 100;
    
    const memoryDiff = test1.memoryUsage?.usedJSHeapSize - test2.memoryUsage?.usedJSHeapSize;
    const memoryDiffPercent = memoryDiff ? (memoryDiff / test1.memoryUsage.usedJSHeapSize) * 100 : 0;
    
    return {
      test1: test1.name,
      test2: test2.name,
      durationDiff,
      durationDiffPercent,
      memoryDiff,
      memoryDiffPercent,
      isFaster: durationDiff > 0,
      isMemoryEfficient: memoryDiff > 0
    };
  }
  
  /**
   * 创建性能标记
   * @param {string} name - 标记名称
   * @returns {void}
   */
  _mark(name) {
    if (performance && performance.mark) {
      performance.mark(name);
      this.perfMarks[name] = performance.now();
    }
  }
  
  /**
   * 初始化性能标记
   * @returns {void}
   */
  _initPerfMarks() {
    this.perfMarks = {};
    this._mark('init');
  }
  
  /**
   * 捕获内存快照
   * @param {string} label - 快照标签
   * @returns {void}
   */
  _captureMemorySnapshot(label) {
    if (!this.isRecording) return;
    
    // 获取当前内存使用情况
    const memory = performance && performance.memory 
      ? {
          usedJSHeapSize: performance.memory.usedJSHeapSize,
          totalJSHeapSize: performance.memory.totalJSHeapSize,
          jsHeapSizeLimit: performance.memory.jsHeapSizeLimit
        }
      : null;
    
    // 保存快照
    if (memory) {
      this.memorySnapshots.push({
        label,
        timestamp: new Date().toISOString(),
        performanceNow: performance.now(),
        memory
      });
    }
  }
  
  /**
   * 计算内存使用情况
   * @param {string} testName - 测试名称
   * @returns {Object} 内存使用统计
   */
  _calculateMemoryUsage(testName = '') {
    if (this.memorySnapshots.length === 0) {
      return null;
    }
    
    // 查找相关快照
    let snapshots = this.memorySnapshots;
    if (testName) {
      snapshots = this.memorySnapshots.filter(s => s.label.includes(testName));
    }
    
    if (snapshots.length === 0) {
      return null;
    }
    
    // 获取初始和最终快照
    const firstSnapshot = snapshots[0];
    const lastSnapshot = snapshots[snapshots.length - 1];
    
    // 计算差异
    const diff = {
      usedJSHeapSize: lastSnapshot.memory.usedJSHeapSize - firstSnapshot.memory.usedJSHeapSize,
      totalJSHeapSize: lastSnapshot.memory.totalJSHeapSize - firstSnapshot.memory.totalJSHeapSize,
      jsHeapSizeLimit: lastSnapshot.memory.jsHeapSizeLimit
    };
    
    // 计算使用率
    const usageRate = {
      initial: firstSnapshot.memory.usedJSHeapSize / firstSnapshot.memory.totalJSHeapSize,
      final: lastSnapshot.memory.usedJSHeapSize / lastSnapshot.memory.totalJSHeapSize,
      diff: diff.usedJSHeapSize / lastSnapshot.memory.totalJSHeapSize
    };
    
    return {
      initial: firstSnapshot.memory,
      final: lastSnapshot.memory,
      diff,
      usageRate,
      snapshotCount: snapshots.length
    };
  }
  
  /**
   * 计算标准差
   * @param {Array<number>} values - 数值数组
   * @param {number} avg - 平均值
   * @returns {number} 标准差
   */
  _calculateStdDeviation(values, avg) {
    const squaredDiffs = values.map(value => Math.pow(value - avg, 2));
    const variance = squaredDiffs.reduce((sum, sqDiff) => sum + sqDiff, 0) / values.length;
    return Math.sqrt(variance);
  }
}

module.exports = PerformanceTestTool; 