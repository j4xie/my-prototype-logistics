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
   * @param {number} options.memoryTrackingInterval - 内存跟踪间隔（毫秒）
   */
  constructor(options = {}) {
    this.config = {
      sampleSize: options.sampleSize || 3,
      warmupRuns: options.warmupRuns || 1,
      cooldownMs: options.cooldownMs || 50,
      memoryTrackingInterval: options.memoryTrackingInterval || 60000 // 默认每60秒记录一次内存
    };
    
    this.isRecording = false;
    this.memorySnapshots = [];
    this.perfMarks = {};
    this.lastTestName = '';
    this.measurements = []; // 存储所有测量结果
    
    // 内存跟踪相关
    this.isTrackingMemory = false;
    this.memoryTrackingTimer = null;
    this.heapSamples = []; // 新增：堆内存采样数据
    
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
   * 比较两个测试结果
   * @param {string} test1 - 第一个测试名称
   * @param {string} test2 - 第二个测试名称
   * @returns {Object} 比较结果
   */
  compareResults(test1, test2) {
    const result1 = this.measurements.find(m => m.name === test1);
    const result2 = this.measurements.find(m => m.name === test2);
    
    if (!result1 || !result2) {
      console.error('找不到指定的测试结果');
      return null;
    }
    
    const diff = result2.average - result1.average;
    const percentDiff = (diff / result1.average) * 100;
    
    return {
      test1: {
        name: test1,
        average: result1.average
      },
      test2: {
        name: test2,
        average: result2.average
      },
      diff,
      percentDiff,
      isFaster: diff < 0,
      isSlower: diff > 0
    };
  }
  
  /**
   * 开始持续内存跟踪
   * @param {number} intervalMs - 跟踪间隔毫秒数
   * @returns {void} 
   */
  startMemoryTracking(intervalMs = this.config.memoryTrackingInterval) {
    if (this.isTrackingMemory) {
      console.warn('内存跟踪已经在运行');
      return;
    }
    
    this.isTrackingMemory = true;
    console.log(`开始内存跟踪，间隔${intervalMs}ms`);
    
    // 记录初始内存快照
    this._captureMemorySnapshot('memory_tracking_start');
    this._captureHeapSample(); // 新增：捕获堆内存样本
    
    // 设置定时器定期记录内存
    this.memoryTrackingTimer = setInterval(() => {
      this._captureMemorySnapshot(`memory_tracking_${Date.now()}`);
      this._captureHeapSample(); // 新增：定期捕获堆内存样本
    }, intervalMs);
  }
  
  /**
   * 停止内存跟踪
   * @returns {Object} 内存跟踪报告
   */
  stopMemoryTracking() {
    if (!this.isTrackingMemory) {
      console.warn('内存跟踪未运行');
      return null;
    }
    
    // 清除定时器
    clearInterval(this.memoryTrackingTimer);
    this.memoryTrackingTimer = null;
    
    // 记录最终内存快照
    this._captureMemorySnapshot('memory_tracking_end');
    this._captureHeapSample(); // 新增：捕获最终堆内存样本
    
    this.isTrackingMemory = false;
    console.log('停止内存跟踪');
    
    // 返回内存使用报告
    return this.getMemoryReport();
  }
  
  /**
   * 获取内存使用报告
   * @returns {Object} 内存使用报告
   */
  getMemoryReport() {
    const trackingSnapshots = this.memorySnapshots.filter(s => 
      s.label.startsWith('memory_tracking_')
    );
    
    if (trackingSnapshots.length < 2) {
      return {
        status: 'insufficient_data',
        message: '内存跟踪数据不足',
        snapshots: trackingSnapshots
      };
    }
    
    const first = trackingSnapshots[0];
    const last = trackingSnapshots[trackingSnapshots.length - 1];
    
    const elapsedMs = last.timestamp - first.timestamp;
    const elapsedMinutes = elapsedMs / (1000 * 60);
    
    const heapUsedGrowth = last.memory.heapUsed - first.memory.heapUsed;
    const heapUsedGrowthMB = heapUsedGrowth / (1024 * 1024);
    const growthRatePerMinuteMB = heapUsedGrowthMB / elapsedMinutes;
    
    // 计算内存峰值
    const maxHeapUsed = Math.max(...trackingSnapshots.map(s => s.memory.heapUsed));
    const maxHeapUsedMB = maxHeapUsed / (1024 * 1024);
    
    // 分析堆内存样本数据
    const heapAnalysis = this._analyzeHeapSamples();
    
    return {
      status: 'success',
      duration: {
        ms: elapsedMs,
        minutes: elapsedMinutes
      },
      snapshots: {
        count: trackingSnapshots.length,
        first: {
          timestamp: new Date(first.timestamp).toISOString(),
          heapUsedMB: first.memory.heapUsed / (1024 * 1024)
        },
        last: {
          timestamp: new Date(last.timestamp).toISOString(),
          heapUsedMB: last.memory.heapUsed / (1024 * 1024)
        }
      },
      heapUsed: {
        growthBytes: heapUsedGrowth,
        growthMB: heapUsedGrowthMB,
        ratePerMinuteMB: growthRatePerMinuteMB,
        maxMB: maxHeapUsedMB
      },
      // 新增：堆内存详细分析
      heapAnalysis: heapAnalysis,
      memoryData: trackingSnapshots.map(s => ({
        timestamp: s.timestamp,
        timeOffset: s.timestamp - first.timestamp,
        heapUsedMB: s.memory.heapUsed / (1024 * 1024),
        heapTotalMB: s.memory.heapTotal / (1024 * 1024),
        rss: s.memory.rss / (1024 * 1024)
      }))
    };
  }
  
  /**
   * 跟踪单次内存使用
   * @param {string} label - 标签名称
   * @returns {Object} 内存快照
   */
  trackMemory(label = 'memory_snapshot') {
    return this._captureMemorySnapshot(label);
  }
  
  /**
   * 创建性能标记
   * @param {string} name - 标记名称
   * @private
   */
  _mark(name) {
    this.perfMarks[name] = performance.now();
  }
  
  /**
   * 初始化性能标记
   * @private
   */
  _initPerfMarks() {
    this.perfMarks['init'] = performance.now();
  }
  
  /**
   * 捕获内存快照
   * @param {string} label - 快照标签
   * @private
   */
  _captureMemorySnapshot(label) {
    try {
      const snapshot = {
        label,
        timestamp: Date.now(),
        memory: process.memoryUsage()
      };
      
      this.memorySnapshots.push(snapshot);
      
      // 在内存跟踪模式下简化输出
      if (label.startsWith('memory_tracking_') && label !== 'memory_tracking_start' && label !== 'memory_tracking_end') {
        // 定期跟踪时不打印详细日志
      } else {
        console.log(`内存快照 [${label}]: 堆已用=${(snapshot.memory.heapUsed / 1024 / 1024).toFixed(2)}MB`);
      }
      
      return snapshot;
    } catch (error) {
      console.error('捕获内存快照失败:', error);
      return null;
    }
  }
  
  /**
   * 计算内存使用情况
   * @param {string} testName - 测试名称
   * @private
   */
  _calculateMemoryUsage(testName = '') {
    let snapshots = this.memorySnapshots;
    
    // 如果指定了测试名称，则仅包含该测试的快照
    if (testName) {
      snapshots = snapshots.filter(s => s.label.includes(testName));
    }
    
    if (snapshots.length < 2) {
      return {
        status: 'insufficient_data',
        message: '内存快照数据不足'
      };
    }
    
    const initialSnapshot = snapshots[0];
    const finalSnapshot = snapshots[snapshots.length - 1];
    
    // 计算内存变化
    const heapUsedDiff = finalSnapshot.memory.heapUsed - initialSnapshot.memory.heapUsed;
    const heapTotalDiff = finalSnapshot.memory.heapTotal - initialSnapshot.memory.heapTotal;
    const rssDiff = finalSnapshot.memory.rss - initialSnapshot.memory.rss;
    
    return {
      initial: {
        heapUsed: initialSnapshot.memory.heapUsed,
        heapTotal: initialSnapshot.memory.heapTotal,
        rss: initialSnapshot.memory.rss
      },
      final: {
        heapUsed: finalSnapshot.memory.heapUsed,
        heapTotal: finalSnapshot.memory.heapTotal,
        rss: finalSnapshot.memory.rss
      },
      diff: {
        heapUsed: heapUsedDiff,
        heapTotal: heapTotalDiff,
        rss: rssDiff
      },
      diffMB: {
        heapUsed: heapUsedDiff / (1024 * 1024),
        heapTotal: heapTotalDiff / (1024 * 1024),
        rss: rssDiff / (1024 * 1024)
      }
    };
  }
  
  /**
   * 计算标准差
   * @param {Array<number>} values - 数值数组
   * @param {number} avg - 平均值
   * @returns {number} 标准差
   * @private
   */
  _calculateStdDeviation(values, avg) {
    if (values.length <= 1) {
      return 0;
    }
    
    const squareDiffs = values.map(value => {
      const diff = value - avg;
      return diff * diff;
    });
    
    const avgSquareDiff = squareDiffs.reduce((sum, value) => sum + value, 0) / squareDiffs.length;
    return Math.sqrt(avgSquareDiff);
  }
  
  /**
   * 捕获堆内存样本
   * @private
   */
  _captureHeapSample() {
    try {
      const memory = process.memoryUsage();
      
      // 创建堆内存样本
      const sample = {
        timestamp: Date.now(),
        heapUsed: memory.heapUsed,
        heapTotal: memory.heapTotal,
        external: memory.external,
        rss: memory.rss,
        arrayBuffers: memory.arrayBuffers || 0 // Node.js 13.9.0+
      };
      
      this.heapSamples.push(sample);
      
      // 如果处于详细日志模式，可以输出
      if (process.env.VERBOSE_MEMORY_TRACKING === 'true') {
        console.log(`堆内存样本: 已用=${(sample.heapUsed / 1024 / 1024).toFixed(2)}MB, 总计=${(sample.heapTotal / 1024 / 1024).toFixed(2)}MB`);
      }
      
      return sample;
    } catch (error) {
      console.error('捕获堆内存样本失败:', error);
      return null;
    }
  }
  
  /**
   * 分析堆内存样本
   * @returns {Object} 堆内存分析结果
   * @private
   */
  _analyzeHeapSamples() {
    if (this.heapSamples.length < 2) {
      return {
        status: 'insufficient_data',
        message: '堆内存样本数据不足'
      };
    }
    
    const first = this.heapSamples[0];
    const last = this.heapSamples[this.heapSamples.length - 1];
    
    // 计算时间间隔（分钟）
    const elapsedMs = last.timestamp - first.timestamp;
    const elapsedMinutes = Math.max(0.001, elapsedMs / (1000 * 60)); // 避免除零
    
    // 计算增长率
    const heapUsedGrowth = last.heapUsed - first.heapUsed;
    const heapUsedGrowthMB = heapUsedGrowth / (1024 * 1024);
    const growthRatePerMinuteMB = heapUsedGrowthMB / elapsedMinutes;
    
    // 计算峰值
    const maxHeapUsed = Math.max(...this.heapSamples.map(s => s.heapUsed));
    const maxHeapUsedMB = maxHeapUsed / (1024 * 1024);
    
    // 计算波动
    const heapUsedValues = this.heapSamples.map(s => s.heapUsed);
    const avgHeapUsed = heapUsedValues.reduce((sum, val) => sum + val, 0) / heapUsedValues.length;
    const stdDevHeapUsed = this._calculateStdDeviation(heapUsedValues, avgHeapUsed);
    const varianceCoefficient = (stdDevHeapUsed / avgHeapUsed) * 100; // 变异系数（百分比）
    
    // 检测内存泄漏潜在风险
    const leakRisk = this._assessMemoryLeakRisk(growthRatePerMinuteMB, varianceCoefficient);
    
    // 采样统计
    const samplingStats = {
      count: this.heapSamples.length,
      intervalMs: elapsedMs / (this.heapSamples.length - 1),
      durationMinutes: elapsedMinutes
    };
    
    return {
      growth: {
        totalMB: heapUsedGrowthMB,
        ratePerMinuteMB: growthRatePerMinuteMB,
        percent: (heapUsedGrowth / first.heapUsed) * 100
      },
      stats: {
        minMB: Math.min(...heapUsedValues) / (1024 * 1024),
        maxMB: maxHeapUsedMB,
        avgMB: avgHeapUsed / (1024 * 1024),
        stdDevMB: stdDevHeapUsed / (1024 * 1024),
        varianceCoefficient: varianceCoefficient
      },
      leakAssessment: leakRisk,
      sampling: samplingStats
    };
  }
  
  /**
   * 评估内存泄漏风险
   * @param {number} growthRatePerMinuteMB - 每分钟内存增长率（MB）
   * @param {number} varianceCoefficient - 变异系数
   * @returns {Object} 泄漏风险评估
   * @private
   */
  _assessMemoryLeakRisk(growthRatePerMinuteMB, varianceCoefficient) {
    // 风险阈值定义
    const thresholds = {
      low: 0.05, // 小于0.05 MB/分钟为低风险
      medium: 0.2, // 小于0.2 MB/分钟为中等风险
      high: 0.5  // 大于0.5 MB/分钟为高风险
    };
    
    // 确定风险级别
    let riskLevel = 'none';
    if (growthRatePerMinuteMB > thresholds.high) {
      riskLevel = 'high';
    } else if (growthRatePerMinuteMB > thresholds.medium) {
      riskLevel = 'medium';
    } else if (growthRatePerMinuteMB > thresholds.low) {
      riskLevel = 'low';
    }
    
    // 确定稳定性（基于变异系数）
    let stability = 'stable';
    if (varianceCoefficient > 20) {
      stability = 'unstable';
    } else if (varianceCoefficient > 10) {
      stability = 'moderate';
    }
    
    return {
      riskLevel,
      growthRatePerMinuteMB,
      stability,
      varianceCoefficient,
      interpretation: this._getLeakRiskInterpretation(riskLevel, stability)
    };
  }
  
  /**
   * 获取内存泄漏风险解释
   * @param {string} riskLevel - 风险级别
   * @param {string} stability - 稳定性级别
   * @returns {string} 风险解释文本
   * @private
   */
  _getLeakRiskInterpretation(riskLevel, stability) {
    const interpretations = {
      none: {
        stable: '没有检测到内存泄漏风险，内存使用稳定。',
        moderate: '没有明显内存泄漏，但内存使用有轻微波动。',
        unstable: '没有持续增长的内存泄漏，但内存使用不稳定，可能存在暂时性分配问题。'
      },
      low: {
        stable: '存在微小内存增长，但速率较低且稳定，短期内不会造成问题。',
        moderate: '存在轻微内存泄漏，波动中等，建议在高负载场景下进一步监控。',
        unstable: '存在轻微内存泄漏，但波动较大，表明可能是间歇性问题。'
      },
      medium: {
        stable: '检测到持续内存增长，长时间运行可能导致问题。',
        moderate: '中等程度内存泄漏，具有一定波动性，需要进一步调查。',
        unstable: '中等程度内存泄漏，波动明显，可能与特定操作相关。'
      },
      high: {
        stable: '严重内存泄漏，持续稳定增长，应尽快解决。',
        moderate: '严重内存泄漏，有一定波动，可能导致应用崩溃。',
        unstable: '严重内存泄漏，且波动剧烈，表明可能存在多个泄漏源。'
      }
    };
    
    return interpretations[riskLevel][stability] || '无法确定内存泄漏风险。';
  }
}

module.exports = PerformanceTestTool;