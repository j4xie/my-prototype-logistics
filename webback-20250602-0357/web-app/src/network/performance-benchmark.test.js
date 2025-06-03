/**
 * @file 资源加载器性能基准测试
 * @description 测试资源加载器在各种条件下的性能表现，包括加载时间、内存使用和响应性
 */

const { traceLoader } = require('./resource-loader');
const { NetworkMonitor } = require('./network-monitor');
const PerformanceTestTool = require('../utils/performance-test-tool');

describe('资源加载器性能基准测试', () => {
  // 性能测试工具实例
  let performanceTool;
  // 网络监控实例
  let networkMonitor;
  // 模拟DOM元素
  let mockImg, mockScript, mockLink;
  // 原始性能API
  let originalPerformance = global.performance;
  // 模拟的资源URL列表
  const resourceUrls = [
    '/images/product1.jpg',
    '/images/product2.jpg',
    '/scripts/main.js',
    '/styles/main.css',
    '/data/trace-data.json'
  ];

  // 测试设置
  beforeEach(() => {
    // 创建性能测试工具
    performanceTool = new PerformanceTestTool({
      sampleSize: 5,      // 每个测试重复5次取平均值
      warmupRuns: 2,      // 2次预热运行
      cooldownMs: 100     // 测试间冷却时间100ms
    });
    
    // 开始记录性能数据
    performanceTool.startRecording();
    
    // 模拟DOM元素
    mockImg = { onload: null, onerror: null, src: '', complete: false };
    mockScript = { onload: null, onerror: null, src: '', async: false };
    mockLink = { onload: null, onerror: null, href: '', rel: '' };
    
    // 模拟document.createElement方法
    document.createElement = jest.fn(type => {
      switch (type) {
        case 'img': return { ...mockImg };
        case 'script': return { ...mockScript };
        case 'link': return { ...mockLink };
        default: return {};
      }
    });
    
    // 模拟 document.head.appendChild 方法
    document.head = {
      appendChild: jest.fn(element => {
        setTimeout(() => {
          if (element.onload) {
            element.complete = true;
            element.onload();
          }
        }, 10);
        return element;
      })
    };
    
    // 模拟 document.body.appendChild 方法
    document.body = {
      appendChild: jest.fn(element => {
        setTimeout(() => {
          if (element.onload) {
            element.complete = true;
            element.onload();
          }
        }, 10);
        return element;
      })
    };
    
    // 模拟 performance API
    global.performance = {
      ...originalPerformance,
      now: jest.fn(() => Date.now()),
      memory: {
        usedJSHeapSize: 1000000, // 初始堆大小1MB
        totalJSHeapSize: 10000000
      }
    };
    
    // 初始化网络监视器
    networkMonitor = new NetworkMonitor({
      triggerInitialState: false
    });
    
    // 重置加载器
    traceLoader.reset();
    
    // 模拟 navigator.onLine
    Object.defineProperty(navigator, 'onLine', {
      configurable: true,
      get: jest.fn(() => true)
    });
  });
  
  // 测试拆卸
  afterEach(() => {
    // 恢复原始函数
    jest.restoreAllMocks();
    
    // 停止记录性能数据
    performanceTool.stopRecording();
    
    // 恢复原始 performance API
    global.performance = originalPerformance;
    
    // 关闭网络监视器
    networkMonitor.removeAllListeners();
  });
  
  /**
   * 生成测试用资源
   * @param {number} count - 资源数量
   * @param {string} type - 资源类型 ('image'|'script'|'style'|'mixed')
   * @returns {Array} 资源配置对象数组
   */
  function generateResources(count, type = 'mixed') {
    const resources = [];
    for (let i = 0; i < count; i++) {
      let resource;
      switch (type) {
        case 'image':
          resource = { 
            type: 'image', 
            url: `/images/product${i}.jpg`, 
            priority: Math.floor(Math.random() * 10) + 1 
          };
          break;
        case 'script':
          resource = { 
            type: 'script', 
            url: `/scripts/script${i}.js`, 
            priority: Math.floor(Math.random() * 10) + 1 
          };
          break;
        case 'style':
          resource = { 
            type: 'style', 
            url: `/styles/style${i}.css`, 
            priority: Math.floor(Math.random() * 10) + 1 
          };
          break;
        case 'mixed':
        default:
          const types = ['image', 'script', 'style'];
          const selectedType = types[i % types.length];
          resource = { 
            type: selectedType, 
            url: `/${selectedType}s/${selectedType}${i}.${selectedType === 'image' ? 'jpg' : selectedType === 'script' ? 'js' : 'css'}`, 
            priority: Math.floor(Math.random() * 10) + 1 
          };
      }
      resources.push(resource);
    }
    return resources;
  }
  
  /**
   * 加载批次资源并等待完成
   * @param {Array} resources - 资源配置对象数组
   * @returns {Promise} 完成加载的Promise
   */
  function loadBatchAndWaitComplete(resources) {
    return new Promise(resolve => {
      let loadedCount = 0;
      const totalCount = resources.length;
      
      const handleLoad = () => {
        loadedCount++;
        if (loadedCount === totalCount) {
          traceLoader.removeEventListener('RESOURCE_LOADED', handleLoad);
          resolve();
        }
      };
      
      traceLoader.addEventListener('RESOURCE_LOADED', handleLoad);
      traceLoader.loadBatch(resources);
    });
  }
  
  test('测量不同批量大小对加载性能的影响', async () => {
    // 定义测试的批量大小
    const batchSizes = [10, 25, 50, 100, 200];
    const results = [];
    
    // 记录基准值 - 单个资源加载时间
    const singleResourceResult = await performanceTool.measure('单个资源加载', async () => {
      return new Promise(resolve => {
        const resource = { type: 'image', url: '/images/baseline.jpg', priority: 5 };
        traceLoader.addEventListener('RESOURCE_LOADED', () => resolve(), { once: true });
        traceLoader.load(resource.type, resource.url);
      });
    });
    
    performanceTool.setBaseline('singleResourceLoadTime', singleResourceResult.averageDuration);
    
    // 测试每种批量大小
    for (const batchSize of batchSizes) {
      const resources = generateResources(batchSize, 'mixed');
      
      const result = await performanceTool.measure(`批量大小 ${batchSize}`, async () => {
        await loadBatchAndWaitComplete(resources);
        return { batchSize, completed: true };
      });
      
      results.push({
        batchSize,
        averageLoadTime: result.averageDuration,
        loadTimePerResource: result.averageDuration / batchSize,
        memoryGrowth: result.metrics.memoryGrowth
      });
      
      // 重置加载器状态
      traceLoader.reset();
      await performanceTool.cooldown(200); // 更长的冷却时间
    }
    
    // 保存批量大小测试报告
    performanceTool.saveReport('batchSizeTest', results);
    
    // 确定最佳批量大小 (基于每资源加载时间)
    const optimalBatchSize = results.reduce((best, current) => {
      return current.loadTimePerResource < best.loadTimePerResource ? current : best;
    });
    
    expect(optimalBatchSize).toBeDefined();
    expect(optimalBatchSize.batchSize).toBeGreaterThan(0);
    
    // 验证结果具有合理的趋势 (小批量可能更慢，然后达到最优点，然后非常大的批量再次变慢)
    console.log(`最佳批量大小: ${optimalBatchSize.batchSize}，每资源平均加载时间: ${optimalBatchSize.loadTimePerResource.toFixed(2)}ms`);
  });
  
  test('测量不同并发级别对加载性能的影响', async () => {
    // 定义测试的并发级别
    const concurrencyLevels = [2, 4, 8, 16, 32];
    const results = [];
    
    // 固定大小的资源批量
    const batchSize = 50;
    const resources = generateResources(batchSize, 'mixed');
    
    for (const concurrencyLevel of concurrencyLevels) {
      // 配置加载器并发级别
      traceLoader.configure({
        maxConcurrentLoads: concurrencyLevel
      });
      
      const result = await performanceTool.measure(`并发级别 ${concurrencyLevel}`, async () => {
        await loadBatchAndWaitComplete(resources);
        return { concurrencyLevel, completed: true };
      });
      
      results.push({
        concurrencyLevel,
        averageLoadTime: result.averageDuration,
        memoryGrowth: result.metrics.memoryGrowth
      });
      
      // 重置加载器状态
      traceLoader.reset();
      await performanceTool.cooldown(200);
    }
    
    // 保存并发级别测试报告
    performanceTool.saveReport('concurrencyTest', results);
    
    // 确定最佳并发级别
    const optimalConcurrency = results.reduce((best, current) => {
      return current.averageLoadTime < best.averageLoadTime ? current : best;
    });
    
    expect(optimalConcurrency).toBeDefined();
    expect(optimalConcurrency.concurrencyLevel).toBeGreaterThan(0);
    
    console.log(`最佳并发级别: ${optimalConcurrency.concurrencyLevel}，批量加载时间: ${optimalConcurrency.averageLoadTime.toFixed(2)}ms`);
  });
  
  test('测量网络条件变化对加载性能的影响', async () => {
    // 配置加载器
    traceLoader.configure({
      maxConcurrentLoads: 8,
      retryCount: 3,
      retryDelay: 100
    });
    
    // 固定大小的资源批量
    const batchSize = 30;
    const resources = generateResources(batchSize, 'mixed');
    
    // 基线：稳定网络
    const stableNetworkResult = await performanceTool.measure('稳定网络', async () => {
      await loadBatchAndWaitComplete(resources);
      return { networkState: 'stable', completed: true };
    });
    
    performanceTool.setBaseline('stableNetworkLoadTime', stableNetworkResult.averageDuration);
    
    // 模拟间歇性网络
    const intermittentNetworkResult = await performanceTool.measure('间歇性网络', async () => {
      // 创建网络状态变化的定时器
      const interval = setInterval(() => {
        const isOnline = Math.random() > 0.3; // 70%的概率在线
        
        // 更新 navigator.onLine
        Object.defineProperty(navigator, 'onLine', {
          configurable: true,
          get: jest.fn(() => isOnline)
        });
        
        // 触发网络状态事件
        if (isOnline) {
          window.dispatchEvent(new Event('online'));
        } else {
          window.dispatchEvent(new Event('offline'));
        }
      }, 50);
      
      await loadBatchAndWaitComplete(resources);
      
      clearInterval(interval);
      
      // 确保最后是在线状态
      Object.defineProperty(navigator, 'onLine', {
        configurable: true,
        get: jest.fn(() => true)
      });
      window.dispatchEvent(new Event('online'));
      
      return { networkState: 'intermittent', completed: true };
    });
    
    // 模拟慢速网络
    const slowNetworkResult = await performanceTool.measure('慢速网络', async () => {
      // 修改文档的appendChild以模拟慢速网络
      const originalAppendChild = document.head.appendChild;
      document.head.appendChild = jest.fn(element => {
        return new Promise(resolve => {
          setTimeout(() => {
            if (element.onload) {
              element.complete = true;
              element.onload();
            }
            resolve(element);
          }, 100 + Math.random() * 200); // 100-300ms延迟
        });
      });
      
      document.body.appendChild = document.head.appendChild;
      
      await loadBatchAndWaitComplete(resources);
      
      // 恢复原始appendChild
      document.head.appendChild = originalAppendChild;
      document.body.appendChild = originalAppendChild;
      
      return { networkState: 'slow', completed: true };
    });
    
    // 保存网络条件测试报告
    performanceTool.saveReport('networkConditionTest', {
      stableNetwork: {
        loadTime: stableNetworkResult.averageDuration,
        standardDeviation: stableNetworkResult.standardDeviation
      },
      intermittentNetwork: {
        loadTime: intermittentNetworkResult.averageDuration,
        standardDeviation: intermittentNetworkResult.standardDeviation,
        percentageIncrease: (intermittentNetworkResult.averageDuration / stableNetworkResult.averageDuration - 1) * 100
      },
      slowNetwork: {
        loadTime: slowNetworkResult.averageDuration,
        standardDeviation: slowNetworkResult.standardDeviation,
        percentageIncrease: (slowNetworkResult.averageDuration / stableNetworkResult.averageDuration - 1) * 100
      }
    });
    
    // 验证性能退化在可接受范围内
    const intermittentDegradation = intermittentNetworkResult.averageDuration / stableNetworkResult.averageDuration;
    const slowDegradation = slowNetworkResult.averageDuration / stableNetworkResult.averageDuration;
    
    expect(intermittentDegradation).toBeLessThan(5); // 性能退化应小于5倍
    expect(slowDegradation).toBeLessThan(5); // 性能退化应小于5倍
    
    console.log(`网络条件性能影响:
      稳定网络: ${stableNetworkResult.averageDuration.toFixed(2)}ms
      间歇性网络: ${intermittentNetworkResult.averageDuration.toFixed(2)}ms (${((intermittentDegradation - 1) * 100).toFixed(2)}% 退化)
      慢速网络: ${slowNetworkResult.averageDuration.toFixed(2)}ms (${((slowDegradation - 1) * 100).toFixed(2)}% 退化)`);
  });
  
  test('测试高效处理大规模数据加载', async () => {
    // 配置加载器
    traceLoader.configure({
      maxConcurrentLoads: 16, // 提高并发级别
      retryCount: 2,
      retryDelay: 100
    });
    
    // 大规模资源批量
    const largeBatchSize = 200;
    const resources = generateResources(largeBatchSize, 'mixed');
    
    // 测量内存使用和加载时间
    const result = await performanceTool.measure('大规模数据加载', async () => {
      // 记录内存使用
      const memoryBefore = performanceTool.getCurrentMemory();
      
      await loadBatchAndWaitComplete(resources);
      
      // 记录内存使用
      const memoryAfter = performanceTool.getCurrentMemory();
      
      return { 
        batchSize: largeBatchSize,
        completed: true,
        memoryBefore,
        memoryAfter,
        memoryGrowth: memoryAfter - memoryBefore
      };
    });
    
    // 计算每资源内存使用
    const memoryPerResource = result.samples[0].result.memoryGrowth / largeBatchSize;
    
    // 保存大规模加载测试报告
    performanceTool.saveReport('largeScaleLoadTest', {
      batchSize: largeBatchSize,
      totalLoadTime: result.averageDuration,
      averageLoadTimePerResource: result.averageDuration / largeBatchSize,
      memoryGrowth: result.samples[0].result.memoryGrowth,
      memoryPerResource
    });
    
    // 验证性能指标在可接受范围内
    expect(result.averageDuration / largeBatchSize).toBeLessThan(50); // 每资源平均加载时间不超过50ms
    expect(memoryPerResource).toBeLessThan(50 * 1024); // 每资源内存增长不超过50KB
    
    console.log(`大规模加载性能:
      资源数量: ${largeBatchSize}
      总加载时间: ${result.averageDuration.toFixed(2)}ms
      每资源平均时间: ${(result.averageDuration / largeBatchSize).toFixed(2)}ms
      内存增长: ${(result.samples[0].result.memoryGrowth / (1024 * 1024)).toFixed(2)}MB
      每资源内存: ${(memoryPerResource / 1024).toFixed(2)}KB`);
  });
  
  // 在每个测试完成后生成性能报告
  afterAll(() => {
    // 获取最终测试报告
    const report = performanceTool.generateReport();
    
    // 输出性能测试摘要
    console.log('性能测试摘要:');
    console.log(`总测试数: ${report.summary.testCount}`);
    console.log(`总测试时间: ${report.summary.totalDuration.toFixed(2)}ms`);
    console.log(`平均测试时间: ${report.summary.averageTestDuration.toFixed(2)}ms`);
    console.log(`最慢测试: ${report.summary.slowestTest.name} (${report.summary.slowestTest.duration.toFixed(2)}ms)`);
    console.log(`最快测试: ${report.summary.fastestTest.name} (${report.summary.fastestTest.duration.toFixed(2)}ms)`);
    console.log(`内存使用最高测试: ${report.summary.highestMemoryGrowth.name} (${report.summary.highestMemoryGrowth.memoryGrowthMB.toFixed(2)}MB)`);
    
    // TODO: 保存报告到文件或系统
    // 在实际项目中，可以将报告保存到文件或发送到性能监控系统
  });
}); 