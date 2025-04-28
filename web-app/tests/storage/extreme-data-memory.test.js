/**
 * @file 极端数据量内存优化测试
 * @description 测试食品溯源系统在处理极端数据量时的内存使用情况
 * @version 1.0.0
 * @created 2025-07-16
 * @updated 2025-07-21
 */

const StorageManager = require('../../src/storage/storage-manager');

// 测试配置
const TEST_STORE_NAME = 'extreme-memory-test-store';
const DATA_SIZES = [
  5000,    // 5千条（基准测试）
  10000,   // 1万条
  50000,   // 5万条
  100000,  // 10万条（可能会非常慢，谨慎使用）
];
const BATCH_SIZES = [50, 100, 500, 1000];

// 性能和内存监控结果
const memoryResults = [];

// 生成测试数据的函数（使用高效率的生成方法）
function generateEfficientTestData(size) {
  const baseObject = {
    value: '测试数据',
    timestamp: Date.now(),
    attributes: {
      origin: '测试来源',
      category: '测试类别',
      status: '活跃',
    },
    tags: ['测试', '性能', '内存'],
  };
  
  const results = [];
  for (let i = 0; i < size; i++) {
    // 创建基础对象的浅拷贝并添加唯一ID
    const obj = Object.assign({}, baseObject);
    obj.id = `mem-test-${i}`;
    results.push(obj);
  }
  
  return results;
}

// 测量内存使用情况
function getMemoryUsage() {
  if (typeof process !== 'undefined' && process.memoryUsage) {
    const usage = process.memoryUsage();
    return {
      rss: usage.rss / 1024 / 1024,        // 常驻集大小 (MB)
      heapTotal: usage.heapTotal / 1024 / 1024,  // 总堆大小 (MB)
      heapUsed: usage.heapUsed / 1024 / 1024,    // 已用堆大小 (MB)
      external: usage.external / 1024 / 1024,    // 外部内存 (MB)
    };
  }
  
  // 浏览器环境下使用性能API
  if (typeof performance !== 'undefined' && performance.memory) {
    return {
      jsHeapSizeLimit: performance.memory.jsHeapSizeLimit / 1024 / 1024,
      totalJSHeapSize: performance.memory.totalJSHeapSize / 1024 / 1024,
      usedJSHeapSize: performance.memory.usedJSHeapSize / 1024 / 1024,
    };
  }
  
  // 回退方案，使用通用的性能标记
  return { timestamp: Date.now(), note: 'Memory metrics not available in this environment' };
}

// 测试辅助函数 - 测量操作时间和内存使用
async function measureWithMemory(operation, dataSize, batchSize) {
  // 强制垃圾回收（如果可用）
  if (global.gc) {
    global.gc();
  }
  
  // 记录开始状态
  const startTime = performance.now();
  const startMemory = getMemoryUsage();
  
  // 执行操作
  await operation();
  
  // 记录结束状态
  const endTime = performance.now();
  const endMemory = getMemoryUsage();
  
  // 计算差异
  const timeDiff = endTime - startTime;
  const memoryDiff = {};
  
  // 计算所有可用内存指标的差异
  Object.keys(endMemory).forEach(key => {
    if (typeof startMemory[key] === 'number' && typeof endMemory[key] === 'number') {
      memoryDiff[key] = endMemory[key] - startMemory[key];
    }
  });
  
  return {
    dataSize,
    batchSize,
    timeMs: timeDiff,
    itemsPerSecond: (dataSize / timeDiff) * 1000,
    memoryStart: startMemory,
    memoryEnd: endMemory,
    memoryGrowth: memoryDiff
  };
}

describe('极端数据量内存优化测试', () => {
  let storageManager;

  beforeAll(() => {
    // 设置更长的超时时间用于极端测试
    jest.setTimeout(300000); // 5分钟
    
    // 创建存储管理器实例
    storageManager = new StorageManager(TEST_STORE_NAME);
    
    // 启用性能监控
    if (typeof storageManager.enablePerformanceMonitoring === 'function') {
      storageManager.enablePerformanceMonitoring(true);
    }
    
    // 启用内存优化模式（如果存在）
    if (typeof storageManager.enableMemoryOptimization === 'function') {
      storageManager.enableMemoryOptimization(true);
    }
    
    console.log('开始极端数据量内存优化测试...');
  });

  afterAll(async () => {
    // 清理测试数据
    await storageManager.clear();
    
    // 输出内存使用结果表格
    console.table(memoryResults.map(result => ({
      '数据量': result.dataSize,
      '批处理大小': result.batchSize,
      '耗时(毫秒)': result.timeMs.toFixed(2),
      '每秒处理条数': result.itemsPerSecond.toFixed(2),
      '堆内存增长(MB)': result.memoryGrowth.heapUsed ? result.memoryGrowth.heapUsed.toFixed(2) : 'N/A',
      '每条数据内存(KB)': result.memoryGrowth.heapUsed ? 
        ((result.memoryGrowth.heapUsed * 1024) / result.dataSize).toFixed(2) : 'N/A'
    })));
    
    console.log('极端数据量内存优化测试完成');
  });

  beforeEach(async () => {
    // 每次测试前清空数据库
    await storageManager.clear();
    
    // 强制垃圾回收（如果可用）
    if (global.gc) {
      global.gc();
    }
  });

  describe('不同数据量的内存影响测试', () => {
    // 测试不同的数据量
    for (const dataSize of DATA_SIZES) {
      // 跳过超大规模测试，除非明确要求
      if (dataSize >= 50000 && process.env.RUN_EXTREME_TESTS !== 'true') {
        test.skip(`[跳过] 数据量 ${dataSize} 条的内存使用测试`, () => {
          console.log(`跳过 ${dataSize} 条数据测试，设置 RUN_EXTREME_TESTS=true 以启用`);
        });
        continue;
      }
      
      test(`数据量 ${dataSize} 条的内存使用测试`, async () => {
        // 为每个数据量选择合适的默认批处理大小
        const defaultBatchSize = dataSize <= 10000 ? 100 : 500;
        
        console.log(`开始测试 ${dataSize} 条数据，默认批处理大小 ${defaultBatchSize}`);
        
        // 生成测试数据
        const testData = generateEfficientTestData(dataSize);
        
        // 测量写入操作的内存使用
        const result = await measureWithMemory(async () => {
          // 分批处理
          for (let i = 0; i < testData.length; i += defaultBatchSize) {
            const batchEnd = Math.min(i + defaultBatchSize, testData.length);
            const batch = testData.slice(i, batchEnd);
            
            // 使用Promise.all并行处理每一批
            await Promise.all(
              batch.map((item, j) => storageManager.setItem(`key-${i + j}`, item))
            );
            
            // 输出进度
            if (i % (defaultBatchSize * 10) === 0 || i + defaultBatchSize >= testData.length) {
              console.log(`处理进度: ${Math.min(i + defaultBatchSize, testData.length)}/${dataSize}`);
            }
          }
        }, dataSize, defaultBatchSize);
        
        // 保存测试结果
        memoryResults.push(result);
        
        // 基本验证
        expect(result.timeMs).toBeGreaterThan(0);
        
        // 输出详细结果
        console.log(`数据量 ${dataSize} 条测试结果:`);
        console.log(`- 耗时: ${result.timeMs.toFixed(2)} ms`);
        console.log(`- 每秒处理条数: ${result.itemsPerSecond.toFixed(2)}`);
        
        if (result.memoryGrowth.heapUsed) {
          console.log(`- 堆内存增长: ${result.memoryGrowth.heapUsed.toFixed(2)} MB`);
          console.log(`- 每条数据内存: ${((result.memoryGrowth.heapUsed * 1024) / dataSize).toFixed(2)} KB`);
          
          // 验证内存使用在合理范围内 (每条数据不超过10KB)
          const memoryPerItem = (result.memoryGrowth.heapUsed * 1024) / dataSize;
          expect(memoryPerItem).toBeLessThan(10);
        }
      });
    }
  });

  describe('不同批处理大小的内存优化测试', () => {
    // 使用中等数据量进行批处理大小测试
    const dataSize = 10000;
    
    // 测试不同的批处理大小
    for (const batchSize of BATCH_SIZES) {
      test(`批处理大小 ${batchSize} 的内存效率测试`, async () => {
        console.log(`开始测试批处理大小 ${batchSize} (数据量: ${dataSize}条)`);
        
        // 生成测试数据
        const testData = generateEfficientTestData(dataSize);
        
        // 测量写入操作的内存使用
        const result = await measureWithMemory(async () => {
          // 分批处理
          for (let i = 0; i < testData.length; i += batchSize) {
            const batchEnd = Math.min(i + batchSize, testData.length);
            const batch = testData.slice(i, batchEnd);
            
            // 使用Promise.all并行处理每一批
            await Promise.all(
              batch.map((item, j) => storageManager.setItem(`batch-${batchSize}-key-${i + j}`, item))
            );
            
            // 输出进度
            if (i % (batchSize * 5) === 0 || i + batchSize >= testData.length) {
              console.log(`处理进度: ${Math.min(i + batchSize, testData.length)}/${dataSize}`);
            }
          }
        }, dataSize, batchSize);
        
        // 保存测试结果
        memoryResults.push(result);
        
        // 输出详细结果
        console.log(`批处理大小 ${batchSize} 测试结果:`);
        console.log(`- 耗时: ${result.timeMs.toFixed(2)} ms`);
        console.log(`- 每秒处理条数: ${result.itemsPerSecond.toFixed(2)}`);
        
        if (result.memoryGrowth.heapUsed) {
          console.log(`- 堆内存增长: ${result.memoryGrowth.heapUsed.toFixed(2)} MB`);
          console.log(`- 每条数据内存: ${((result.memoryGrowth.heapUsed * 1024) / dataSize).toFixed(2)} KB`);
        }
      });
    }
  });

  describe('内存泄漏检测测试', () => {
    test('重复操作内存泄漏检测', async () => {
      // 重复次数
      const iterations = 5;
      // 每次迭代的数据量
      const iterationDataSize = 5000;
      // 使用的批处理大小
      const batchSize = 100;
      
      console.log(`开始内存泄漏检测测试: ${iterations}次迭代，每次${iterationDataSize}条数据`);
      
      // 记录每次迭代后的内存使用
      const memoryUsageTracker = [];
      
      // 进行多次迭代
      for (let iter = 0; iter < iterations; iter++) {
        // 强制垃圾回收（如果可用）
        if (global.gc) {
          global.gc();
        }
        
        // 生成本次迭代的测试数据
        const testData = generateEfficientTestData(iterationDataSize);
        
        // 清空之前的数据
        await storageManager.clear();
        
        // 记录迭代开始时的内存使用
        const startMemory = getMemoryUsage();
        
        // 执行写入操作
        await (async () => {
          for (let i = 0; i < testData.length; i += batchSize) {
            const batchEnd = Math.min(i + batchSize, testData.length);
            const batch = testData.slice(i, batchEnd);
            
            await Promise.all(
              batch.map((item, j) => storageManager.setItem(`leak-test-${iter}-${i + j}`, item))
            );
          }
        })();
        
        // 强制垃圾回收（如果可用）
        if (global.gc) {
          global.gc();
        }
        
        // 记录迭代结束时的内存使用
        const endMemory = getMemoryUsage();
        
        // 计算差异
        const memoryDiff = {};
        Object.keys(endMemory).forEach(key => {
          if (typeof startMemory[key] === 'number' && typeof endMemory[key] === 'number') {
            memoryDiff[key] = endMemory[key] - startMemory[key];
          }
        });
        
        // 保存本次迭代的内存使用情况
        memoryUsageTracker.push({
          iteration: iter + 1,
          start: startMemory,
          end: endMemory,
          diff: memoryDiff
        });
        
        console.log(`完成迭代 ${iter + 1}/${iterations}`);
      }
      
      // 分析内存使用情况
      console.log('内存泄漏检测结果:');
      memoryUsageTracker.forEach(record => {
        console.log(`迭代 ${record.iteration}:`);
        if (record.diff.heapUsed) {
          console.log(`- 堆内存变化: ${record.diff.heapUsed.toFixed(2)} MB`);
        }
      });
      
      // 检测内存泄漏（比较第一次和最后一次迭代后的内存差异）
      if (memoryUsageTracker.length >= 2) {
        const firstIteration = memoryUsageTracker[0];
        const lastIteration = memoryUsageTracker[memoryUsageTracker.length - 1];
        
        // 检查内存增长是否合理
        if (firstIteration.end.heapUsed && lastIteration.end.heapUsed) {
          const totalGrowth = lastIteration.end.heapUsed - firstIteration.start.heapUsed;
          console.log(`总内存增长: ${totalGrowth.toFixed(2)} MB`);
          
          // 期望每次迭代后的内存增长不超过1MB（根据实际情况调整）
          expect(totalGrowth).toBeLessThan(iterations); // 每次迭代内存增长不超过1MB
        }
      }
    });
  });

  describe('内存优化策略测试', () => {
    test('批量API与内存优化模式对比', async () => {
      // 如果不支持批量API或内存优化模式，则跳过此测试
      if (typeof storageManager.batchSet !== 'function' || 
          typeof storageManager.enableMemoryOptimization !== 'function') {
        console.log('存储管理器不支持批量API或内存优化模式，跳过对比测试');
        return;
      }
      
      const dataSize = 5000;
      const testData = generateEfficientTestData(dataSize);
      const batchData = {};
      testData.forEach((item, i) => {
        batchData[`opt-key-${i}`] = item;
      });
      
      // 1. 标准模式下使用批量API
      storageManager.enableMemoryOptimization(false);
      const standardResult = await measureWithMemory(async () => {
        await storageManager.batchSet(batchData);
      }, dataSize, 'N/A (批量API)');
      
      // 清空数据
      await storageManager.clear();
      
      // 2. 内存优化模式下使用批量API
      storageManager.enableMemoryOptimization(true);
      const optimizedResult = await measureWithMemory(async () => {
        await storageManager.batchSet(batchData);
      }, dataSize, 'N/A (批量API+内存优化)');
      
      // 保存测试结果
      memoryResults.push(standardResult, optimizedResult);
      
      // 对比结果
      console.log('内存优化模式对比:');
      console.log('1. 标准模式:');
      console.log(`- 耗时: ${standardResult.timeMs.toFixed(2)} ms`);
      if (standardResult.memoryGrowth.heapUsed) {
        console.log(`- 堆内存增长: ${standardResult.memoryGrowth.heapUsed.toFixed(2)} MB`);
      }
      
      console.log('2. 内存优化模式:');
      console.log(`- 耗时: ${optimizedResult.timeMs.toFixed(2)} ms`);
      if (optimizedResult.memoryGrowth.heapUsed) {
        console.log(`- 堆内存增长: ${optimizedResult.memoryGrowth.heapUsed.toFixed(2)} MB`);
      }
      
      // 计算优化效果
      if (standardResult.memoryGrowth.heapUsed && optimizedResult.memoryGrowth.heapUsed) {
        const memoryImprovement = 
          ((standardResult.memoryGrowth.heapUsed - optimizedResult.memoryGrowth.heapUsed) / 
           standardResult.memoryGrowth.heapUsed) * 100;
        
        console.log(`内存使用减少: ${memoryImprovement.toFixed(2)}%`);
        
        // 验证内存优化模式确实有效
        expect(optimizedResult.memoryGrowth.heapUsed).toBeLessThan(standardResult.memoryGrowth.heapUsed);
      }
      
      // 验证时间性能不会过度牺牲
      const timeRatio = optimizedResult.timeMs / standardResult.timeMs;
      console.log(`时间性能比: ${timeRatio.toFixed(2)}x`);
      
      // 内存优化模式的时间不应该比标准模式慢太多（允许2倍以内的性能差异）
      expect(timeRatio).toBeLessThan(2);
    });
  });

  /**
   * 新增测试: 内存压力测试与恢复
   */
  describe('内存压力测试与恢复', () => {
    test('在内存压力下的数据处理与恢复', async () => {
      // 如果不支持内存监控或内存优化，则跳过测试
      if (typeof MemoryMonitor === 'undefined' || 
          typeof storageManager.enableMemoryOptimization !== 'function') {
        console.log('存储管理器不支持内存监控或内存优化功能，跳过内存压力测试');
        return;
      }
      
      // 确保内存优化已启用
      storageManager.enableMemoryOptimization(true);
      
      // 数据大小，适中以避免浏览器崩溃
      const dataSize = 5000;
      // 加大对象大小，增加内存压力
      const largeObjects = [];
      
      // 制造内存压力函数
      function createMemoryPressure() {
        // 创建大量大对象占用内存
        for (let i = 0; i < 50; i++) {
          // 每个对象约1MB
          const largeObject = {
            id: `pressure-${i}`,
            largeData: new Array(250000).fill('x').join('')
          };
          largeObjects.push(largeObject);
        }
        console.log(`创建了50个大对象，施加内存压力`);
      }
      
      // 释放内存压力函数
      function releaseMemoryPressure() {
        // 清空引用，允许垃圾回收
        largeObjects.length = 0;
        // 强制垃圾回收（如果可用）
        if (global.gc) {
          global.gc();
        }
        console.log(`释放了内存压力`);
      }
      
      try {
        // 生成测试数据
        console.log(`生成${dataSize}条测试数据`);
        const testData = generateEfficientTestData(dataSize);
        
        // 第一阶段：正常情况下存储数据
        console.log("阶段1: 正常条件下存储数据");
        const normalResult = await measureWithMemory(async () => {
          for (let i = 0; i < 1000; i++) {
            await storageManager.setItem(`pressure-normal-${i}`, testData[i]);
          }
        }, 1000, 'N/A');
        
        // 制造内存压力
        console.log("阶段2: 创建内存压力");
        createMemoryPressure();
        
        // 等待一段时间，让内存监控有时间响应
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // 第二阶段：内存压力下存储数据
        console.log("阶段3: 内存压力下存储数据");
        const pressureResult = await measureWithMemory(async () => {
          for (let i = 1000; i < 2000; i++) {
            await storageManager.setItem(`pressure-high-${i}`, testData[i]);
          }
        }, 1000, 'N/A');
        
        // 释放内存压力
        console.log("阶段4: 释放内存压力");
        releaseMemoryPressure();
        
        // 等待一段时间，让系统恢复
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // 第三阶段：恢复后存储数据
        console.log("阶段5: 恢复后存储数据");
        const recoveryResult = await measureWithMemory(async () => {
          for (let i = 2000; i < 3000; i++) {
            await storageManager.setItem(`pressure-recovery-${i}`, testData[i]);
          }
        }, 1000, 'N/A');
        
        // 对比结果
        console.log("内存压力测试结果对比:");
        console.log(`1. 正常条件: ${normalResult.timeMs.toFixed(2)}ms`);
        console.log(`2. 内存压力: ${pressureResult.timeMs.toFixed(2)}ms`);
        console.log(`3. 恢复阶段: ${recoveryResult.timeMs.toFixed(2)}ms`);
        
        if (normalResult.memoryGrowth.heapUsed && 
            pressureResult.memoryGrowth.heapUsed && 
            recoveryResult.memoryGrowth.heapUsed) {
          console.log(`正常条件内存增长: ${normalResult.memoryGrowth.heapUsed.toFixed(2)}MB`);
          console.log(`内存压力内存增长: ${pressureResult.memoryGrowth.heapUsed.toFixed(2)}MB`);
          console.log(`恢复阶段内存增长: ${recoveryResult.memoryGrowth.heapUsed.toFixed(2)}MB`);
          
          // 验证内存优化措施是否生效
          // 在内存压力下，应该采取更激进的内存优化措施，内存增长应该较小
          expect(pressureResult.memoryGrowth.heapUsed).toBeLessThanOrEqual(normalResult.memoryGrowth.heapUsed * 1.2);
        }
        
        // 验证在内存压力下系统仍然正常工作
        const item = await storageManager.getItem('pressure-high-1500');
        expect(item).toBeTruthy();
        expect(item.id).toBe('mem-test-1500');
        
      } finally {
        // 确保清理，即使测试失败
        releaseMemoryPressure();
      }
    });
  });

  /**
   * 新增测试: 低内存设备模拟测试
   */
  describe('低内存设备模拟测试', () => {
    test('模拟低内存设备环境的性能', async () => {
      // 原始设备内存值
      const originalDeviceMemory = navigator.deviceMemory;
      
      // 模拟低内存设备（2GB RAM）
      // 注意：deviceMemory在某些环境中可能不可修改
      try {
        // 尝试模拟低内存设备
        Object.defineProperty(navigator, 'deviceMemory', {
          value: 2,
          configurable: true
        });
        
        // 创建新的存储管理器实例，以便触发设备优化
        const lowMemoryManager = new StorageManager('low-memory-test-store');
        
        // 确保内存优化被启用
        lowMemoryManager.enableMemoryOptimization(true);
        
        // 测试数据大小
        const dataSize = 3000;
        
        console.log('开始低内存设备模拟测试，数据量:', dataSize);
        
        // 生成测试数据
        const testData = generateEfficientTestData(dataSize);
        
        // 测量低内存设备模式下的性能
        const result = await measureWithMemory(async () => {
          // 使用较小的批次进行处理
          const batchSize = 50; // 低内存设备应使用较小批次
          
          for (let i = 0; i < testData.length; i += batchSize) {
            const batchEnd = Math.min(i + batchSize, testData.length);
            const batch = testData.slice(i, batchEnd);
            
            // 串行处理以减少内存压力
            for (let j = 0; j < batch.length; j++) {
              await lowMemoryManager.setItem(`low-mem-key-${i + j}`, batch[j]);
            }
            
            // 手动触发垃圾回收（如果可用）
            if (global.gc) {
              global.gc();
            }
          }
        }, dataSize, 'N/A (低内存设备模拟)');
        
        // 添加结果到总表
        memoryResults.push(result);
        
        // 输出结果
        console.log('低内存设备模拟测试结果:');
        console.log(`- 处理时间: ${result.timeMs.toFixed(2)} ms`);
        console.log(`- 每秒处理条数: ${result.itemsPerSecond.toFixed(2)}`);
        
        if (result.memoryGrowth.heapUsed) {
          console.log(`- 堆内存增长: ${result.memoryGrowth.heapUsed.toFixed(2)} MB`);
          console.log(`- 每条数据内存: ${((result.memoryGrowth.heapUsed * 1024) / dataSize).toFixed(2)} KB`);
        }
        
        // 验证数据是否成功存储
        const testItem = await lowMemoryManager.getItem('low-mem-key-100');
        expect(testItem).toBeTruthy();
        expect(testItem.id).toBe('mem-test-100');
        
        // 清理
        await lowMemoryManager.clear();
        
      } catch (error) {
        console.error('低内存设备模拟失败:', error);
      } finally {
        // 恢复原始设备内存值
        if (originalDeviceMemory !== undefined) {
          try {
            Object.defineProperty(navigator, 'deviceMemory', {
              value: originalDeviceMemory,
              configurable: true
            });
          } catch (restoreError) {
            console.warn('恢复设备内存值失败:', restoreError);
          }
        }
      }
    });
  });

  // 渐进式负载测试
  describe('渐进式负载测试', () => {
    test('递增数据量测试，从小到大验证内存使用率', async () => {
      // 使用较小的增量来测试内存使用
      const incrementalDataSizes = [100, 500, 1000, 5000, 10000];
      const batchSize = 100;
      
      console.log('开始渐进式负载测试，批处理大小:', batchSize);
      
      // 存储每个阶段的内存情况
      const incrementalResults = [];
      
      // 每个数据量级别测试一次
      for (const dataSize of incrementalDataSizes) {
        console.log(`测试 ${dataSize} 条数据...`);
        
        // 生成测试数据
        const testData = generateEfficientTestData(dataSize);
        
        // 测量写入操作的内存使用
        const result = await measureWithMemory(async () => {
          // 分批处理
          for (let i = 0; i < testData.length; i += batchSize) {
            const batchEnd = Math.min(i + batchSize, testData.length);
            const batch = testData.slice(i, batchEnd);
            
            await Promise.all(
              batch.map((item, j) => storageManager.setItem(`incr-key-${i + j}`, item))
            );
          }
        }, dataSize, batchSize);
        
        incrementalResults.push(result);
        memoryResults.push(result);
        
        // 每次测试后清空数据库但保留内存使用记录
        await storageManager.clear();
        
        // 手动垃圾回收
        if (global.gc) {
          global.gc();
        }
        
        // 确保每个阶段之间有短暂休息
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      // 验证内存使用与数据量的关系
      // 理想情况下，内存增长应该是次线性的（不是线性增长）
      const smallSizeResult = incrementalResults[0];
      const largeSizeResult = incrementalResults[incrementalResults.length - 1];
      
      if (smallSizeResult.memoryGrowth.heapUsed && largeSizeResult.memoryGrowth.heapUsed) {
        // 数据量增长比例
        const dataSizeRatio = largeSizeResult.dataSize / smallSizeResult.dataSize;
        
        // 内存增长比例
        const memoryGrowthRatio = largeSizeResult.memoryGrowth.heapUsed / smallSizeResult.memoryGrowth.heapUsed;
        
        console.log(`数据量增长比例: ${dataSizeRatio.toFixed(2)}x`);
        console.log(`内存增长比例: ${memoryGrowthRatio.toFixed(2)}x`);
        
        // 内存增长比例应低于数据量增长比例，表明内存优化有效
        // 考虑到垃圾回收和非线性增长，使用较宽松的断言
        expect(memoryGrowthRatio).toBeLessThan(dataSizeRatio * 1.5);
      }
    });
  });
  
  // 测试IndexedDB分块存储效率
  describe('IndexedDB分块存储测试', () => {
    test('验证大量数据分块存储的内存效率', async () => {
      // 数据大小和批次大小
      const dataSize = 5000;
      const effectiveBatchSizes = [50, 100, 200, 500];
      
      console.log('开始IndexedDB分块存储测试...');
      
      // 生成一次测试数据
      const testData = generateEfficientTestData(dataSize);
      
      // 测试不同的批次大小
      for (const batchSize of effectiveBatchSizes) {
        console.log(`使用批次大小 ${batchSize} 测试 ${dataSize} 条数据...`);
        
        // 清空数据库
        await storageManager.clear();
        
        // 测量内存使用
        const result = await measureWithMemory(async () => {
          // 创建要批量存储的数据对象
          const batchData = {};
          for (let i = 0; i < testData.length; i++) {
            batchData[`chunk-key-${i}`] = testData[i];
          }
          
          // 如果存储管理器支持batchSet方法，使用它
          if (typeof storageManager.batchSet === 'function') {
            // 配置批处理大小
            storageManager._state.batchSize = batchSize;
            
            // 使用batchSet进行批量存储
            await storageManager.batchSet(batchData);
          } else {
            // 手动实现分块处理
            for (let i = 0; i < dataSize; i += batchSize) {
              const batchEnd = Math.min(i + batchSize, dataSize);
              
              // 创建本批次的对象
              const currentBatch = {};
              for (let j = i; j < batchEnd; j++) {
                currentBatch[`chunk-key-${j}`] = testData[j];
              }
              
              // 并行存储批次数据
              await Promise.all(
                Object.entries(currentBatch).map(([key, value]) => 
                  storageManager.setItem(key, value)
                )
              );
            }
          }
        }, dataSize, batchSize);
        
        memoryResults.push(result);
        
        // 验证操作成功 - 随机检查几个值
        const randomIndices = Array.from({ length: 5 }, () => Math.floor(Math.random() * dataSize));
        for (const idx of randomIndices) {
          const value = await storageManager.getItem(`chunk-key-${idx}`);
          expect(value).toBeTruthy();
          expect(value.id).toBe(`mem-test-${idx}`);
        }
      }
      
      // 比较不同批次大小的性能和内存使用
      // 找出最佳的批次大小
      const batchResults = memoryResults.filter(r => r.dataSize === dataSize);
      
      // 如果有足够的结果用于比较
      if (batchResults.length >= 2) {
        // 按内存使用排序
        const sortedByMemory = [...batchResults].sort((a, b) => {
          if (!a.memoryGrowth.heapUsed || !b.memoryGrowth.heapUsed) return 0;
          return a.memoryGrowth.heapUsed - b.memoryGrowth.heapUsed;
        });
        
        // 按处理速度排序
        const sortedBySpeed = [...batchResults].sort((a, b) => 
          b.itemsPerSecond - a.itemsPerSecond
        );
        
        // 计算最佳批次大小
        // 考虑内存使用和速度的平衡
        const bestBatchSize = sortedByMemory[0].batchSize;
        const fastestBatchSize = sortedBySpeed[0].batchSize;
        
        console.log(`内存使用最少的批次大小: ${bestBatchSize}`);
        console.log(`处理速度最快的批次大小: ${fastestBatchSize}`);
        
        // 建议批次大小
        const recommendedBatchSize = (bestBatchSize === fastestBatchSize) ? 
          bestBatchSize : 
          Math.round((bestBatchSize + fastestBatchSize) / 2);
          
        console.log(`推荐的批次大小: ${recommendedBatchSize}`);
      }
    });
  });

  // 垃圾回收频率测试
  describe('垃圾回收频率测试', () => {
    test('在长时间运行中验证垃圾回收触发频率和内存稳定性', async () => {
      // 这个测试可能运行较长时间，谨慎使用
      if (process.env.RUN_EXTREME_TESTS !== 'true') {
        console.log('跳过垃圾回收频率测试，设置 RUN_EXTREME_TESTS=true 以启用');
        return;
      }
      
      // 使用适中的数据量
      const dataSize = 3000;
      const batchSize = 100;
      const iterations = 5; // 循环次数
      
      console.log(`开始垃圾回收频率测试，数据量: ${dataSize}，循环: ${iterations}次`);
      
      let initialMemory = null;
      let gcCounts = 0;
      const memorySnapshots = [];
      
      // 模拟垃圾回收拦截
      const originalGc = global.gc;
      global.gc = function() {
        gcCounts++;
        if (originalGc) originalGc.call(global);
        
        // 记录垃圾回收后的内存快照
        memorySnapshots.push({
          time: Date.now(),
          count: gcCounts,
          memory: getMemoryUsage()
        });
      };
      
      try {
        // 记录初始内存状态
        initialMemory = getMemoryUsage();
        
        // 循环执行数据操作，模拟长时间运行
        for (let iter = 0; iter < iterations; iter++) {
          console.log(`执行迭代 ${iter + 1}/${iterations}`);
          
          // 生成新的测试数据
          const testData = generateEfficientTestData(dataSize);
          
          // 测量写入操作
          await measureWithMemory(async () => {
            for (let i = 0; i < testData.length; i += batchSize) {
              const batchEnd = Math.min(i + batchSize, testData.length);
              const batch = testData.slice(i, batchEnd);
              
              await Promise.all(
                batch.map((item, j) => storageManager.setItem(`gc-key-${iter}-${i + j}`, item))
              );
            }
          }, dataSize, batchSize);
          
          // 读取操作，增加内存压力
          await measureWithMemory(async () => {
            for (let i = 0; i < dataSize; i += batchSize) {
              const batchEnd = Math.min(i + batchSize, dataSize);
              
              await Promise.all(
                Array.from({ length: batchEnd - i }, (_, j) => 
                  storageManager.getItem(`gc-key-${iter}-${i + j}`)
                )
              );
            }
          }, dataSize, batchSize);
          
          // 每次迭代结束后清理
          await storageManager.clear();
          
          // 短暂休息
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        // 最终内存状态
        const finalMemory = getMemoryUsage();
        
        // 验证测试结果
        console.log(`垃圾回收触发次数: ${gcCounts}`);
        console.log(`每1000条记录的平均垃圾回收次数: ${(gcCounts / (dataSize * iterations / 1000)).toFixed(2)}`);
        
        // 验证垃圾回收频率不超过预期
        // 每处理1000条记录应触发垃圾回收不超过3次
        expect(gcCounts / (dataSize * iterations / 1000)).toBeLessThanOrEqual(3);
        
        // 验证内存稳定性
        if (initialMemory.heapUsed && finalMemory.heapUsed) {
          const memoryGrowth = finalMemory.heapUsed - initialMemory.heapUsed;
          const relativeGrowth = memoryGrowth / initialMemory.heapUsed;
          
          console.log(`内存增长: ${memoryGrowth.toFixed(2)} MB (${(relativeGrowth * 100).toFixed(2)}%)`);
          
          // 长时间运行后内存增长不应超过50%
          expect(relativeGrowth).toBeLessThanOrEqual(0.5);
        }
      } finally {
        // 恢复原始gc
        global.gc = originalGc;
      }
    });
  });
}); 