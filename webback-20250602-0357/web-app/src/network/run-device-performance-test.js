/**
 * @file 移动设备性能测试
 * @description 测试不同移动设备对网络资源加载的性能影响
 */

const fs = require('fs');
const path = require('path');
const { performance } = require('perf_hooks');
const ResourceLoader = require('./resource-loader');
const NetworkMonitor = require('./network-monitor');
const PerformanceTestTool = require('../utils/performance-test-tool');

// 解析命令行参数
const parseArgs = () => {
  const args = {};
  process.argv.slice(2).forEach(arg => {
    if (arg.startsWith('--')) {
      const [key, value] = arg.slice(2).split('=');
      args[key] = value === undefined ? true : value;
    }
  });
  return args;
};

// 命令行参数
const args = parseArgs();
const useMock = args.mock === true || args.mock === 'true';

// 如果使用mock，导入mockFetch
let mockFetch;
if (useMock) {
  try {
    mockFetch = require('../../../tests/integration/mock-server/mockFetch');
    console.log('使用模拟fetch进行测试');
  } catch (error) {
    console.error('加载mockFetch失败:', error.message);
    console.log('将使用真实fetch进行测试');
  }
}

// 性能测试工具配置
const perfTool = new PerformanceTestTool({
  sampleSize: 5,         // 每个测试场景运行次数
  warmupRuns: 2,         // 预热运行次数
  cooldownMs: 500,      // 每次测试间隔时间
  reportDir: path.resolve(__dirname, '../../reports')
});

// 移动设备配置
const deviceProfiles = {
  // 低端设备
  lowEndDevice: {
    name: '低端安卓设备',
    cpu: { cores: 2, speed: 'slow' },
    memory: { limit: 512 * 1024 * 1024 }, // 512MB
    connection: { 
      type: '3g',
      downlink: 1.5,
      uplink: 0.5,
      rtt: 300,
      jitter: 50,
      packetLoss: 3
    }
  },
  // 中端设备
  midRangeDevice: {
    name: '中端安卓设备',
    cpu: { cores: 4, speed: 'medium' },
    memory: { limit: 1024 * 1024 * 1024 }, // 1GB
    connection: { 
      type: '4g',
      downlink: 7,
      uplink: 2,
      rtt: 100,
      jitter: 20,
      packetLoss: 1
    }
  },
  // 高端设备
  highEndDevice: {
    name: '高端iOS设备',
    cpu: { cores: 6, speed: 'fast' },
    memory: { limit: 2048 * 1024 * 1024 }, // 2GB
    connection: { 
      type: '4g',
      downlink: 20,
      uplink: 5,
      rtt: 50,
      jitter: 10,
      packetLoss: 0.5
    }
  },
  // 平板设备
  tabletDevice: {
    name: '平板设备',
    cpu: { cores: 4, speed: 'medium' },
    memory: { limit: 1536 * 1024 * 1024 }, // 1.5GB
    connection: { 
      type: 'wifi',
      downlink: 15,
      uplink: 8,
      rtt: 30,
      jitter: 5,
      packetLoss: 0.1
    }
  },
  // 高端笔记本
  laptop: {
    name: '高端笔记本',
    cpu: { cores: 8, speed: 'fast' },
    memory: { limit: 4096 * 1024 * 1024 }, // 4GB
    connection: { 
      type: 'wifi',
      downlink: 50,
      uplink: 20,
      rtt: 10,
      jitter: 2,
      packetLoss: 0.05
    }
  }
};

// 资源类型
const resourceTypes = {
  image: { size: [10, 100, 1000], count: 20 }, // KB
  json: { size: [1, 10, 100], count: 20 }, // KB
  script: { size: [5, 50, 500], count: 15 }, // KB
  style: { size: [2, 20, 200], count: 10 } // KB
};

// 模拟CPU限制
function simulateCpuProfile(profile) {
  const cpuSpeed = profile.cpu.speed;
  let cpuFactor = 1;
  
  // 根据CPU速度调整处理时间
  switch (cpuSpeed) {
    case 'slow':
      cpuFactor = 3; // 慢3倍
      break;
    case 'medium':
      cpuFactor = 1.5; // 慢1.5倍
      break;
    case 'fast':
      cpuFactor = 1; // 正常速度
      break;
    default:
      cpuFactor = 1;
  }
  
  // 应用CPU限制 - 通过阻塞主线程来模拟
  if (cpuFactor > 1) {
    const startTime = performance.now();
    while (performance.now() - startTime < 5 * cpuFactor) {
      // 刻意空循环来消耗CPU时间
    }
  }
  
  return cpuFactor;
}

// 生成测试资源
function generateTestResources(types = resourceTypes) {
  const resources = [];
  
  Object.entries(types).forEach(([type, config]) => {
    const { size, count } = config;
    
    // 为每种尺寸生成资源
    size.forEach(sizeKB => {
      for (let i = 0; i < count; i++) {
        resources.push({
          url: `https://example.com/${type}/${sizeKB}kb/resource-${i}.${type}`,
          type,
          size: sizeKB * 1024, // 转换为字节
          priority: i % 3 === 0 ? 'high' : i % 3 === 1 ? 'medium' : 'low'
        });
      }
    });
  });
  
  return resources;
}

// 模拟基于设备配置的资源加载
async function simulateResourceLoading(device, resources, batchSize = 10) {
  // 导入mockFetch
  const mockFetch = require('../../../tests/integration/mock-server/mockFetch').default;
  
  // 创建网络监视器和资源加载器实例
  const networkMonitor = new NetworkMonitor({
    // 应用设备的网络配置
    initialState: {
      type: device.connection.type,
      downlink: device.connection.downlink,
      rtt: device.connection.rtt
    },
    // 模拟网络不稳定性
    instabilityFactor: device.connection.jitter / 100, 
    packetLossRate: device.connection.packetLoss / 100
  });
  
  // 使用ResourceLoader.withMock创建加载器
  const loader = ResourceLoader.withMock(mockFetch, {
    networkMonitor,
    // 应用设备的内存限制
    maxCacheSize: device.memory.limit / (1024 * 1024) / 10, // 转换为MB，并设为内存的1/10
    batchSize,
    // 模拟设备处理速度
    processingDelay: (resource) => {
      // 应用CPU因子处理延迟
      const cpuFactor = simulateCpuProfile(device);
      // 根据资源大小和设备CPU能力计算处理延迟
      const baseDelay = resource.size / (100 * 1024); // 每100KB基础延迟1ms
      return baseDelay * cpuFactor;
    }
  });
  
  // 设置性能指标收集
  const metrics = {
    totalLoadTime: 0,
    firstResourceTime: 0,
    lastResourceTime: 0,
    resourcesLoaded: 0,
    resourcesFailed: 0,
    memoryUsage: [],
    timeToFirstResource: 0,
    timeToLastResource: 0,
    averageResourceTime: 0,
    averageThroughput: 0, // bytes per second
    percentiles: {
      p50: 0,
      p90: 0,
      p95: 0,
      p99: 0
    }
  };
  
  // 记录开始时间
  const startTime = performance.now();
  
  // 记录内存使用
  const startMemory = process.memoryUsage();
  metrics.memoryUsage.push({
    time: 0,
    memory: { ...startMemory }
  });
  
  // 临时存储各资源加载时间，用于计算百分位数
  const resourceTimes = [];
  
  try {
    // 准备资源URLs
    const urls = resources.map(resource => resource.url);
    const resourceMap = {};
    resources.forEach(resource => {
      resourceMap[resource.url] = resource;
    });
    
    // 开始加载资源
    const loadStartTime = performance.now();
    
    // 使用批量加载
    const results = await loader.loadBatch(urls, {
      onResourceLoad: (url, time) => {
        const resourceTime = time;
        resourceTimes.push(resourceTime);
        
        // 更新第一个加载完成的资源时间
        if (metrics.resourcesLoaded === 0) {
          metrics.timeToFirstResource = resourceTime;
          metrics.firstResourceTime = performance.now() - startTime;
        }
        
        // 更新最后一个资源时间
        metrics.timeToLastResource = resourceTime;
        metrics.lastResourceTime = performance.now() - startTime;
        
        metrics.resourcesLoaded++;
        
        // 定期记录内存使用（每10个资源）
        if (metrics.resourcesLoaded % 10 === 0) {
          metrics.memoryUsage.push({
            time: performance.now() - startTime,
            memory: { ...process.memoryUsage() }
          });
        }
      },
      onResourceError: (url, error) => {
        metrics.resourcesFailed++;
      }
    });
    
    // 计算总加载时间
    metrics.totalLoadTime = performance.now() - startTime;
    
    // 计算平均资源加载时间
    metrics.averageResourceTime = metrics.resourcesLoaded > 0 
      ? resourceTimes.reduce((sum, time) => sum + time, 0) / resourceTimes.length 
      : 0;
    
    // 计算平均吞吐量 (bytes per second)
    const totalBytes = resources.reduce((sum, r) => sum + r.size, 0);
    metrics.averageThroughput = totalBytes / (metrics.totalLoadTime / 1000);
    
    // 计算百分位数
    if (resourceTimes.length > 0) {
      resourceTimes.sort((a, b) => a - b);
      
      const getPercentile = (percent) => {
        const index = Math.ceil(resourceTimes.length * (percent / 100)) - 1;
        return resourceTimes[Math.max(0, Math.min(index, resourceTimes.length - 1))];
      };
      
      metrics.percentiles.p50 = getPercentile(50);
      metrics.percentiles.p90 = getPercentile(90);
      metrics.percentiles.p95 = getPercentile(95);
      metrics.percentiles.p99 = getPercentile(99);
    }
    
    // 最终内存使用
    metrics.memoryUsage.push({
      time: metrics.totalLoadTime,
      memory: { ...process.memoryUsage() }
    });
    
    // 返回结果
    return {
      success: true,
      metrics
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      metrics
    };
  } finally {
    // 清理资源
    loader.reset(true);
  }
}

// 运行设备性能测试
async function runDevicePerformanceTest() {
  console.log('开始移动设备性能测试...');
  
  // 生成测试资源
  const resources = generateTestResources();
  console.log(`生成了 ${resources.length} 个测试资源`);
  
  // 测试结果
  const results = {};
  
  // 批量大小优化
  const batchSizes = [5, 10, 20, 50];
  
  // 对每种设备进行测试
  for (const [deviceKey, deviceProfile] of Object.entries(deviceProfiles)) {
    console.log(`\n测试设备: ${deviceProfile.name}`);
    results[deviceKey] = {
      deviceInfo: deviceProfile,
      batchSizeResults: {},
      optimalBatchSize: null,
      optimalLoadTime: Infinity
    };
    
    // 测试不同批量大小
    for (const batchSize of batchSizes) {
      console.log(`  测试批量大小: ${batchSize}`);
      
      // 使用性能测试工具运行多次测试取平均值
      const testResults = await perfTool.measure(
        () => simulateResourceLoading(deviceProfile, resources, batchSize),
        `${deviceKey}_batch_${batchSize}`
      );
      
      // 提取关键指标
      const avgLoadTime = testResults.result ? testResults.result.metrics.totalLoadTime : 0;
      const avgFirstResource = testResults.result ? testResults.result.metrics.timeToFirstResource : 0;
      const avgThroughput = testResults.result ? testResults.result.metrics.averageThroughput : 0;
      const p95LoadTime = testResults.result ? testResults.result.metrics.percentiles.p95 : 0;
      
      // 保存结果
      results[deviceKey].batchSizeResults[batchSize] = {
        avgLoadTime,
        avgFirstResource,
        avgThroughput,
        p95LoadTime,
        successRate: testResults.result ? (testResults.result.metrics.resourcesLoaded / resources.length) * 100 : 0
      };
      
      // 更新最佳批量大小
      if (avgLoadTime < results[deviceKey].optimalLoadTime) {
        results[deviceKey].optimalLoadTime = avgLoadTime;
        results[deviceKey].optimalBatchSize = batchSize;
      }
      
      console.log(`    平均加载时间: ${avgLoadTime.toFixed(2)}ms, 成功率: ${results[deviceKey].batchSizeResults[batchSize].successRate.toFixed(2)}%`);
    }
    
    console.log(`  最佳批量大小: ${results[deviceKey].optimalBatchSize}, 加载时间: ${results[deviceKey].optimalLoadTime.toFixed(2)}ms`);
  }
  
  // 汇总结果
  const summary = {
    timestamp: new Date().toISOString(),
    testResourceCount: resources.length,
    deviceResults: {},
    recommendations: {}
  };
  
  // 提取每个设备的关键结果
  Object.entries(results).forEach(([deviceKey, deviceResult]) => {
    summary.deviceResults[deviceKey] = {
      name: deviceResult.deviceInfo.name,
      optimalBatchSize: deviceResult.optimalBatchSize,
      optimalLoadTime: deviceResult.optimalLoadTime,
      averageThroughput: deviceResult.batchSizeResults[deviceResult.optimalBatchSize].avgThroughput,
      timeToFirstResource: deviceResult.batchSizeResults[deviceResult.optimalBatchSize].avgFirstResource,
      p95LoadTime: deviceResult.batchSizeResults[deviceResult.optimalBatchSize].p95LoadTime,
      successRate: deviceResult.batchSizeResults[deviceResult.optimalBatchSize].successRate
    };
  });
  
  // 生成设备类型建议
  Object.entries(summary.deviceResults).forEach(([deviceKey, result]) => {
    // 根据设备性能特点提供批量大小建议
    summary.recommendations[deviceKey] = {
      recommendedBatchSize: result.optimalBatchSize,
      recommendedCacheSize: Math.round(deviceProfiles[deviceKey].memory.limit / (1024 * 1024) / 10), // MB
      loadingStrategy: result.timeToFirstResource > 500 ? '渐进式加载' : '批量加载',
      prioritizationNeeded: deviceKey === 'lowEndDevice' || deviceKey === 'midRangeDevice'
    };
  });
  
  // 保存完整测试结果
  const reportData = {
    summary,
    testResults: results,
    testConfig: {
      deviceProfiles,
      resourceCount: resources.length,
      batchSizes
    }
  };
  
  // 确保报告目录存在
  const reportDir = path.resolve(__dirname, '../../reports');
  if (!fs.existsSync(reportDir)) {
    fs.mkdirSync(reportDir, { recursive: true });
  }
  
  // 输出报告
  const reportPath = path.join(reportDir, 'device-performance-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(reportData, null, 2));
  console.log(`\n设备性能测试完成，报告已保存到: ${reportPath}`);
  
  // 终端输出结果摘要
  console.log('\n===== 设备性能测试摘要 =====');
  Object.entries(summary.deviceResults).forEach(([deviceKey, result]) => {
    console.log(`\n${result.name}:`);
    console.log(`  最佳批量大小: ${result.optimalBatchSize}`);
    console.log(`  总加载时间: ${result.optimalLoadTime.toFixed(2)}ms`);
    console.log(`  首个资源加载时间: ${result.timeToFirstResource.toFixed(2)}ms`);
    console.log(`  P95 加载时间: ${result.p95LoadTime.toFixed(2)}ms`);
    console.log(`  平均吞吐量: ${Math.round(result.averageThroughput / 1024)} KB/s`);
    console.log(`  加载成功率: ${result.successRate.toFixed(2)}%`);
  });
  
  // 输出标记以便主运行脚本捕获性能数据
  console.log('\nPERFORMANCE_DATA_START');
  console.log(JSON.stringify({
    summary: {
      testType: 'devicePerformance',
      deviceCount: Object.keys(deviceProfiles).length,
      resourceCount: resources.length,
      recommendations: summary.recommendations
    },
    testResults: summary.deviceResults
  }));
  console.log('PERFORMANCE_DATA_END');
  
  return reportData;
}

// 直接运行或作为模块导出
if (require.main === module) {
  runDevicePerformanceTest().catch(error => {
    console.error('设备性能测试失败:', error);
    process.exit(1);
  });
} else {
  module.exports = { runDevicePerformanceTest };
} 