/**
 * @file 数据库读写性能测试
 * @description 测试食品溯源系统在处理大规模数据时的数据库性能
 * @version 1.0.0
 * @created 2025-07-16
 */

const StorageManager = require('../../src/storage/storage-manager');

// 测试配置
const TEST_STORE_NAME = 'performance-test-store';
const SMALL_BATCH_SIZE = 100;
const MEDIUM_BATCH_SIZE = 1000;
const LARGE_BATCH_SIZE = 10000;
const EXTREME_BATCH_SIZE = 50000;

// 生成测试数据的函数
function generateTestData(size, complexity = 'simple') {
  const result = [];
  
  for (let i = 0; i < size; i++) {
    if (complexity === 'simple') {
      result.push({
        id: `item-${i}`,
        value: `测试数据-${i}`,
        timestamp: Date.now()
      });
    } else {
      // 复杂数据结构
      result.push({
        id: `complex-item-${i}`,
        metadata: {
          created: Date.now(),
          modified: Date.now(),
          version: 1,
          checksum: `checksum-${Math.random().toString(36).substring(2, 15)}`
        },
        data: {
          name: `测试产品-${i}`,
          description: `这是第${i}个测试产品的详细描述，包含更多信息...`,
          attributes: Array.from({ length: 10 }, (_, j) => ({
            key: `attribute-${j}`,
            value: `value-${j}-${Math.random()}`
          })),
          relationIds: Array.from({ length: 5 }, (_, j) => `relation-${i}-${j}`),
          tags: ['测试', '性能测试', `标签-${i}`],
        },
        traceRecords: Array.from({ length: 3 }, (_, j) => ({
          recordId: `record-${i}-${j}`,
          timestamp: Date.now() - j * 60000,
          location: {
            latitude: 30 + Math.random(),
            longitude: 120 + Math.random(),
            name: `位置-${i}-${j}`
          },
          operationType: ['创建', '更新', '检查'][j % 3],
          operator: `操作员-${i % 10}`,
          details: `操作详情记录-${i}-${j}...`
        }))
      });
    }
  }
  
  return result;
}

// 测试辅助函数 - 测量操作时间
async function measureOperationTime(operation) {
  const start = performance.now();
  await operation();
  const end = performance.now();
  return end - start;
}

// 测试辅助函数 - 格式化结果
function formatPerformanceResult(operation, size, time) {
  return {
    operation,
    dataSize: size,
    timeMs: time.toFixed(2),
    itemsPerSecond: ((size / time) * 1000).toFixed(2)
  };
}

describe('数据库读写性能测试', () => {
  let storageManager;
  let performanceResults = [];

  beforeAll(() => {
    jest.setTimeout(60000); // 延长超时时间为60秒
    
    // 创建一个专用于性能测试的存储管理器实例
    storageManager = new StorageManager(TEST_STORE_NAME);
    
    // 启用性能监控
    if (typeof storageManager.enablePerformanceMonitoring === 'function') {
      storageManager.enablePerformanceMonitoring(true);
    }
    
    // 清空性能结果
    performanceResults = [];
  });

  afterAll(async () => {
    // 清理测试数据
    await storageManager.clear();
    
    // 输出性能测试结果总结
    console.table(performanceResults);
  });

  beforeEach(async () => {
    // 每次测试前清空数据库
    await storageManager.clear();
  });

  describe('批量写入性能测试', () => {
    test('小批量数据写入性能 (100条)', async () => {
      // 生成测试数据
      const testData = generateTestData(SMALL_BATCH_SIZE, 'simple');
      
      // 测量批量写入性能
      const writeTime = await measureOperationTime(async () => {
        for (let i = 0; i < testData.length; i++) {
          await storageManager.setItem(`test-key-${i}`, testData[i]);
        }
      });
      
      // 记录性能结果
      performanceResults.push(
        formatPerformanceResult('写入(小批量/简单数据)', SMALL_BATCH_SIZE, writeTime)
      );
      
      // 验证性能符合预期 (根据实际情况调整)
      expect(writeTime).toBeLessThan(5000); // 小批量数据应该在5秒内完成
    });
    
    test('中批量数据写入性能 (1000条)', async () => {
      // 生成测试数据
      const testData = generateTestData(MEDIUM_BATCH_SIZE, 'simple');
      
      // 测量批量写入性能
      const writeTime = await measureOperationTime(async () => {
        for (let i = 0; i < testData.length; i++) {
          await storageManager.setItem(`test-key-${i}`, testData[i]);
        }
      });
      
      // 记录性能结果
      performanceResults.push(
        formatPerformanceResult('写入(中批量/简单数据)', MEDIUM_BATCH_SIZE, writeTime)
      );
      
      // 验证性能符合预期
      expect(writeTime).toBeLessThan(15000); // 中批量数据应该在15秒内完成
    });
    
    test('复杂数据结构写入性能 (1000条)', async () => {
      // 生成复杂测试数据
      const testData = generateTestData(MEDIUM_BATCH_SIZE, 'complex');
      
      // 测量批量写入性能
      const writeTime = await measureOperationTime(async () => {
        for (let i = 0; i < testData.length; i++) {
          await storageManager.setItem(`complex-key-${i}`, testData[i]);
        }
      });
      
      // 记录性能结果
      performanceResults.push(
        formatPerformanceResult('写入(中批量/复杂数据)', MEDIUM_BATCH_SIZE, writeTime)
      );
      
      // 验证性能符合预期
      expect(writeTime).toBeLessThan(20000); // 复杂数据应该在20秒内完成
    });
  });

  describe('批量读取性能测试', () => {
    test('小批量数据读取性能 (100条)', async () => {
      // 准备测试数据
      const testData = generateTestData(SMALL_BATCH_SIZE, 'simple');
      for (let i = 0; i < testData.length; i++) {
        await storageManager.setItem(`test-key-${i}`, testData[i]);
      }
      
      // 测量批量读取性能
      const readTime = await measureOperationTime(async () => {
        for (let i = 0; i < testData.length; i++) {
          await storageManager.getItem(`test-key-${i}`);
        }
      });
      
      // 记录性能结果
      performanceResults.push(
        formatPerformanceResult('读取(小批量)', SMALL_BATCH_SIZE, readTime)
      );
      
      // 验证性能符合预期
      expect(readTime).toBeLessThan(3000); // 小批量读取应该在3秒内完成
    });
    
    test('中批量数据读取性能 (1000条)', async () => {
      // 准备测试数据
      const testData = generateTestData(MEDIUM_BATCH_SIZE, 'simple');
      for (let i = 0; i < testData.length; i++) {
        await storageManager.setItem(`test-key-${i}`, testData[i]);
      }
      
      // 测量批量读取性能
      const readTime = await measureOperationTime(async () => {
        for (let i = 0; i < testData.length; i++) {
          await storageManager.getItem(`test-key-${i}`);
        }
      });
      
      // 记录性能结果
      performanceResults.push(
        formatPerformanceResult('读取(中批量)', MEDIUM_BATCH_SIZE, readTime)
      );
      
      // 验证性能符合预期
      expect(readTime).toBeLessThan(10000); // 中批量读取应该在10秒内完成
    });
    
    test('复杂数据结构读取性能 (1000条)', async () => {
      // 准备测试数据
      const testData = generateTestData(MEDIUM_BATCH_SIZE, 'complex');
      for (let i = 0; i < testData.length; i++) {
        await storageManager.setItem(`complex-key-${i}`, testData[i]);
      }
      
      // 测量批量读取性能
      const readTime = await measureOperationTime(async () => {
        for (let i = 0; i < testData.length; i++) {
          await storageManager.getItem(`complex-key-${i}`);
        }
      });
      
      // 记录性能结果
      performanceResults.push(
        formatPerformanceResult('读取(中批量/复杂数据)', MEDIUM_BATCH_SIZE, readTime)
      );
      
      // 验证性能符合预期
      expect(readTime).toBeLessThan(15000); // 复杂数据读取应该在15秒内完成
    });
  });

  describe('查询性能测试', () => {
    // 由于 StorageManager 可能需要扩展支持查询功能，这里添加条件测试
    test('批量查询性能 (如果支持)', async () => {
      // 检查是否支持查询功能
      if (typeof storageManager.query !== 'function') {
        console.log('存储管理器不支持查询功能，跳过查询性能测试');
        return;
      }
      
      // 准备测试数据
      const testData = generateTestData(MEDIUM_BATCH_SIZE, 'complex');
      for (let i = 0; i < testData.length; i++) {
        await storageManager.setItem(`complex-key-${i}`, testData[i]);
      }
      
      // 测量查询性能 (假设有查询方法)
      const queryTime = await measureOperationTime(async () => {
        // 按属性查询例子
        await storageManager.query({
          selector: { 'data.tags': '测试' }
        });
      });
      
      // 记录性能结果
      performanceResults.push(
        formatPerformanceResult('查询(按标签)', MEDIUM_BATCH_SIZE, queryTime)
      );
    });
  });

  describe('并发操作性能测试', () => {
    test('并发读写测试 (100个并发)', async () => {
      // 准备测试数据
      const testData = generateTestData(SMALL_BATCH_SIZE, 'simple');
      
      // 先写入一些数据
      for (let i = 0; i < testData.length / 2; i++) {
        await storageManager.setItem(`test-key-${i}`, testData[i]);
      }
      
      // 测量并发读写性能
      const operationTime = await measureOperationTime(async () => {
        // 创建100个并发操作
        const operations = [];
        
        // 50个读操作
        for (let i = 0; i < 50; i++) {
          operations.push(storageManager.getItem(`test-key-${i % (testData.length / 2)}`));
        }
        
        // 50个写操作
        for (let i = 0; i < 50; i++) {
          const index = testData.length / 2 + i;
          operations.push(storageManager.setItem(`test-key-${index}`, testData[index % testData.length]));
        }
        
        // 等待所有操作完成
        await Promise.all(operations);
      });
      
      // 记录性能结果
      performanceResults.push(
        formatPerformanceResult('并发读写(100个)', 100, operationTime)
      );
      
      // 验证性能符合预期
      expect(operationTime).toBeLessThan(10000); // 并发操作应该在10秒内完成
    });
  });

  describe('大规模数据处理性能测试', () => {
    // 注意：此测试可能需要较长时间，仅在需要时运行
    test.skip('大批量数据写入测试 (10000条)', async () => {
      // 生成大量测试数据
      const testData = generateTestData(LARGE_BATCH_SIZE, 'simple');
      
      // 测量批量写入性能
      const writeTime = await measureOperationTime(async () => {
        // 分批处理以避免内存问题
        const batchSize = 500;
        for (let i = 0; i < testData.length; i += batchSize) {
          const batch = testData.slice(i, i + batchSize);
          const promises = batch.map((item, j) => 
            storageManager.setItem(`large-key-${i + j}`, item)
          );
          await Promise.all(promises);
        }
      });
      
      // 记录性能结果
      performanceResults.push(
        formatPerformanceResult('写入(大批量)', LARGE_BATCH_SIZE, writeTime)
      );
    });
    
    test.skip('极端数据量处理 (50000条)', async () => {
      if (process.env.SKIP_EXTREME_TESTS === 'true') {
        console.log('跳过极端数据量测试');
        return;
      }
      
      // 生成极端数量测试数据
      const testData = generateTestData(EXTREME_BATCH_SIZE, 'simple');
      
      // 监控内存使用
      const memoryBefore = process.memoryUsage().heapUsed / 1024 / 1024;
      
      // 测量批量写入性能
      const writeTime = await measureOperationTime(async () => {
        // 分批处理以避免内存问题
        const batchSize = 100;
        for (let i = 0; i < testData.length; i += batchSize) {
          const batch = testData.slice(i, i + batchSize);
          const promises = batch.map((item, j) => 
            storageManager.setItem(`extreme-key-${i + j}`, item)
          );
          await Promise.all(promises);
          
          // 定期输出进度
          if (i % 1000 === 0) {
            console.log(`极端数据量测试进度: ${i}/${EXTREME_BATCH_SIZE}`);
          }
        }
      });
      
      // 计算内存增长
      const memoryAfter = process.memoryUsage().heapUsed / 1024 / 1024;
      const memoryGrowth = memoryAfter - memoryBefore;
      
      // 记录性能结果
      performanceResults.push({
        operation: '写入(极端批量)',
        dataSize: EXTREME_BATCH_SIZE,
        timeMs: writeTime.toFixed(2),
        itemsPerSecond: ((EXTREME_BATCH_SIZE / writeTime) * 1000).toFixed(2),
        memoryGrowthMB: memoryGrowth.toFixed(2)
      });
    });
  });
  
  describe('优化建议测试', () => {
    test('批量API性能对比 (如果支持)', async () => {
      // 检查是否支持批量API
      if (typeof storageManager.batchSet !== 'function') {
        console.log('存储管理器不支持批量API，跳过批量API性能对比测试');
        return;
      }
      
      // 准备测试数据
      const testData = generateTestData(MEDIUM_BATCH_SIZE, 'simple');
      const batchData = {};
      testData.forEach((item, i) => {
        batchData[`batch-key-${i}`] = item;
      });
      
      // 测量单个API顺序调用性能
      const singleApiTime = await measureOperationTime(async () => {
        for (let i = 0; i < testData.length; i++) {
          await storageManager.setItem(`single-key-${i}`, testData[i]);
        }
      });
      
      // 测量批量API性能
      const batchApiTime = await measureOperationTime(async () => {
        await storageManager.batchSet(batchData);
      });
      
      // 记录性能结果
      performanceResults.push(
        formatPerformanceResult('单个API顺序调用', MEDIUM_BATCH_SIZE, singleApiTime)
      );
      
      performanceResults.push(
        formatPerformanceResult('批量API调用', MEDIUM_BATCH_SIZE, batchApiTime)
      );
      
      // 计算性能提升
      const improvement = ((singleApiTime - batchApiTime) / singleApiTime) * 100;
      console.log(`批量API性能提升: ${improvement.toFixed(2)}%`);
      
      // 验证批量API性能更好
      expect(batchApiTime).toBeLessThan(singleApiTime);
    });
  });
}); 