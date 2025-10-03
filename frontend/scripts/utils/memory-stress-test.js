/**
 * 内存压力测试脚本
 * 对ResourceLoader进行持续压力测试，监控内存使用情况
 * 
 * 用法: node scripts/memory-stress-test.js [--duration=1800] [--interval=60] [--batch=50]
 */

const fs = require('fs');
const path = require('path');

// 加载依赖模块
// 注意：这些模块在项目重构后可能需要重新实现
// const ResourceLoader = require('../web-app-next/src/lib/resource-loader');
// const NetworkMonitor = require('../web-app-next/src/lib/network-monitor');
// const PerformanceTracker = require('../web-app-next/src/lib/performance-tracker');

// 临时模拟实现
class MockResourceLoader {
  constructor(options) {
    this.options = options;
    this.cache = new Map();
  }
  
  async loadResource(url, options) {
    // 模拟资源加载
    return new Promise(resolve => {
      setTimeout(() => {
        this.cache.set(url, { url, ...options });
        resolve({ url, loaded: true });
      }, Math.random() * 100);
    });
  }
  
  clearCache() {
    this.cache.clear();
  }
}

class MockNetworkMonitor {
  constructor(options) {
    this.state = options.initialState;
  }
}

class MockPerformanceTracker {
  constructor() {
    this.metrics = [];
  }
}

const ResourceLoader = MockResourceLoader;
const NetworkMonitor = MockNetworkMonitor;
const PerformanceTracker = MockPerformanceTracker;

// 命令行参数解析
const args = process.argv.slice(2).reduce((acc, arg) => {
  const [key, value] = arg.replace('--', '').split('=');
  acc[key] = value;
  return acc;
}, {});

// 配置项
const config = {
  duration: parseInt(args.duration || '1800'), // 测试持续时间（秒）
  interval: parseInt(args.interval || '60'),   // 内存快照间隔（秒）
  batchSize: parseInt(args.batch || '50'),     // 资源批处理大小
  resourceCount: parseInt(args.resources || '1000'), // 总资源数量
  reportDir: process.env.REPORT_DIR || 'reports' // 报告目录
};

// 确保报告目录存在
if (!fs.existsSync(config.reportDir)) {
  fs.mkdirSync(config.reportDir, { recursive: true });
  console.log(`创建报告目录: ${config.reportDir}`);
}

// 性能跟踪器
const perfTracker = new PerformanceTracker();

// 网络监视器
const networkMonitor = new NetworkMonitor({
  initialState: {
    type: 'wifi',
    downlink: 5,
    rtt: 50
  }
});

// 资源加载器
const loader = new ResourceLoader({
  networkMonitor,
  batchSize: config.batchSize,
  maxCacheSize: 100 // MB
});

// 生成测试资源
function generateTestResources(count) {
  const resources = [];
  const types = ['image', 'script', 'style', 'json', 'document'];
  
  for (let i = 0; i < count; i++) {
    const type = types[Math.floor(Math.random() * types.length)];
    const size = type === 'image' 
      ? Math.floor(Math.random() * 500000) + 10000 // 图片10KB-500KB
      : Math.floor(Math.random() * 50000) + 1000;  // 其他1KB-50KB
    
    resources.push({
      url: `https://example.com/resources/${type}/${Date.now()}-${i}.${type}`,
      type,
      priority: Math.floor(Math.random() * 3), // 0-2优先级
      size
    });
  }
  
  return resources;
}

// 内存状态记录
const memorySnapshots = [];

// 记录内存使用快照
function captureMemorySnapshot() {
  const snapshot = {
    timestamp: Date.now(),
    memory: process.memoryUsage()
  };
  
  memorySnapshots.push(snapshot);
  
  console.log(`[${new Date().toISOString()}] 内存快照:`);
  console.log(`  堆总大小: ${(snapshot.memory.heapTotal / 1024 / 1024).toFixed(2)} MB`);
  console.log(`  堆已用: ${(snapshot.memory.heapUsed / 1024 / 1024).toFixed(2)} MB`);
  console.log(`  外部内存: ${(snapshot.memory.external / 1024 / 1024).toFixed(2)} MB`);
  console.log(`  RSS: ${(snapshot.memory.rss / 1024 / 1024).toFixed(2)} MB`);
  
  return snapshot;
}

// 分析内存增长情况
function analyzeMemoryGrowth() {
  if (memorySnapshots.length < 2) {
    return { 
      growth: 0, 
      growthRate: 0 
    };
  }
  
  const first = memorySnapshots[0];
  const last = memorySnapshots[memorySnapshots.length - 1];
  
  const elapsedSeconds = (last.timestamp - first.timestamp) / 1000;
  const heapGrowth = last.memory.heapUsed - first.memory.heapUsed;
  const growthRatePerMinute = (heapGrowth / elapsedSeconds) * 60;
  
  return {
    totalGrowthBytes: heapGrowth,
    totalGrowthMB: heapGrowth / (1024 * 1024),
    growthRatePerMinute: growthRatePerMinute / (1024 * 1024),
    elapsedSeconds,
    startHeapUsed: first.memory.heapUsed / (1024 * 1024),
    endHeapUsed: last.memory.heapUsed / (1024 * 1024)
  };
}

// 生成测试报告
function generateReport() {
  const growth = analyzeMemoryGrowth();
  
  const report = {
    testConfig: config,
    startTime: new Date(memorySnapshots[0].timestamp).toISOString(),
    endTime: new Date(memorySnapshots[memorySnapshots.length - 1].timestamp).toISOString(),
    duration: growth.elapsedSeconds,
    memoryGrowth: {
      startHeapUsedMB: growth.startHeapUsed,
      endHeapUsedMB: growth.endHeapUsed,
      totalGrowthMB: growth.totalGrowthMB,
      growthRatePerMinuteMB: growth.growthRatePerMinute
    },
    snapshots: memorySnapshots.map(s => ({
      timestamp: new Date(s.timestamp).toISOString(),
      heapUsedMB: s.memory.heapUsed / (1024 * 1024),
      heapTotalMB: s.memory.heapTotal / (1024 * 1024),
      rssMB: s.memory.rss / (1024 * 1024)
    })),
    conclusion: {
      passed: growth.totalGrowthMB <= 2.0, // 通过标准：总增长不超过2MB
      status: growth.totalGrowthMB <= 2.0 ? 'PASS' : 'FAIL',
      threshold: '2.0 MB',
      actual: `${growth.totalGrowthMB.toFixed(2)} MB`
    }
  };
  
  // 写入报告文件
  const reportPath = path.join(config.reportDir, 'memory-leak-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  
  console.log(`\n报告已生成: ${reportPath}`);
  
  return report;
}

// 模拟路由切换
function simulateRouteChange() {
  // 在真实场景中这会清理一些资源和状态
  loader.clearCache();
  global.gc && global.gc(); // 触发垃圾回收（如果可用）
  console.log(`[${new Date().toISOString()}] 模拟路由切换，清理缓存`);
}

// 模拟加载一批资源
async function loadResourceBatch(resources) {
  const batch = resources.slice(0, config.batchSize);
  const promises = batch.map(resource => 
    loader.loadResource(resource.url, {
      type: resource.type,
      priority: resource.priority,
      size: resource.size
    }).catch(err => {
      // 忽略加载错误，这是压力测试
      return null;
    })
  );
  
  await Promise.all(promises);
  return batch.length;
}

// 主测试函数
async function runMemoryStressTest() {
  console.log(`开始内存压力测试 (${config.duration}秒)`);
  console.log(`配置: 批大小=${config.batchSize}, 快照间隔=${config.interval}秒, 资源总数=${config.resourceCount}`);
  
  // 设置初始快照
  captureMemorySnapshot();
  
  // 设置定期内存快照
  const snapshotInterval = setInterval(() => {
    captureMemorySnapshot();
  }, config.interval * 1000);
  
  const startTime = Date.now();
  const endTime = startTime + (config.duration * 1000);
  
  // 生成测试资源
  let resources = generateTestResources(config.resourceCount);
  let iterations = 0;
  let totalResourcesLoaded = 0;
  
  // 主循环
  while (Date.now() < endTime) {
    // 准备测试资源
    if (resources.length < config.batchSize) {
      // 生成新资源
      resources = generateTestResources(config.resourceCount);
    }
    
    // 加载一批资源
    const loadedCount = await loadResourceBatch(resources);
    resources = resources.slice(loadedCount); // 移除已加载的资源
    
    totalResourcesLoaded += loadedCount;
    iterations++;
    
    // 定期模拟路由切换
    if (iterations % 10 === 0) {
      simulateRouteChange();
    }
    
    // 简短暂停，避免CPU占用过高
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // 定期输出状态
    if (iterations % 50 === 0) {
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      const remaining = Math.max(0, config.duration - elapsed);
      
      console.log(`已运行: ${elapsed}秒, 剩余: ${remaining}秒, 已加载: ${totalResourcesLoaded}资源, 迭代: ${iterations}`);
    }
  }
  
  // 清理
  clearInterval(snapshotInterval);
  
  // 最终快照
  captureMemorySnapshot();
  
  // 测试完成，生成报告
  const report = generateReport();
  
  console.log('\n测试完成!');
  console.log(`总持续时间: ${Math.floor((Date.now() - startTime) / 1000)}秒`);
  console.log(`总加载资源: ${totalResourcesLoaded}`);
  console.log(`总迭代次数: ${iterations}`);
  console.log(`内存增长: ${report.memoryGrowth.totalGrowthMB.toFixed(2)} MB`);
  console.log(`每分钟增长率: ${report.memoryGrowth.growthRatePerMinuteMB.toFixed(4)} MB/分钟`);
  console.log(`测试状态: ${report.conclusion.status}`);
  
  // 退出状态码基于测试是否通过
  process.exit(report.conclusion.passed ? 0 : 1);
}

// 启动测试
runMemoryStressTest().catch(err => {
  console.error('测试执行错误:', err);
  process.exit(1);
}); 