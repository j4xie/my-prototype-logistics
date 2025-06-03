/**
 * @file 网络状态切换测试运行器
 * @description 测试网络状态快速变化时的资源加载性能
 */

// 首先加载测试环境配置
require('../utils/test-environment');

const { traceLoader } = require('./resource-loader');
const { NetworkMonitor } = require('./network-monitor');
const PerformanceTestTool = require('../utils/performance-test-tool');
const { CONNECTION_TYPES, simulateNetworkChange } = require('../utils/test-environment');
const fs = require('fs');
const path = require('path');

// 创建性能测试工具
const performanceTool = new PerformanceTestTool({
  sampleSize: 3,  // 每个测试重复3次取平均值
  warmupRuns: 1,  // 1次预热运行
  cooldownMs: 100 // 测试间冷却时间100ms
});

// 初始化网络监控和加载器
const networkMonitor = new NetworkMonitor();
traceLoader.reset();

// 开始记录性能数据
performanceTool.startRecording();

/**
 * 生成测试用资源
 * @param {number} count - 资源数量
 * @param {string} type - 资源类型 ('image'|'script'|'style'|'mixed')
 * @returns {Array} 资源配置对象数组
 */
function generateResources(count, type = 'mixed') {
  const resources = [];
  const types = type === 'mixed' ? ['image', 'script', 'style'] : [type];
  
  for (let i = 0; i < count; i++) {
    const resourceType = types[i % types.length];
    const priority = i % 3; // 0: 高, 1: 中, 2: 低
    
    resources.push({
      id: `resource-${i}`,
      url: `https://example.com/${resourceType}s/resource-${i}.${resourceType === 'image' ? 'png' : resourceType === 'script' ? 'js' : 'css'}`,
      type: resourceType,
      priority: priority,
      size: resourceType === 'image' ? 50000 + Math.random() * 100000 : 
            resourceType === 'script' ? 10000 + Math.random() * 20000 : 
            5000 + Math.random() * 10000
    });
  }
  
  return resources;
}

/**
 * 模拟网络状态变化
 * @param {Array} connectionTypes - 网络连接类型数组
 * @param {number} interval - 切换间隔（毫秒）
 * @param {number} duration - 总持续时间（毫秒）
 * @returns {Promise<void>}
 */
async function simulateNetworkChanges(connectionTypes, interval, duration) {
  const startTime = Date.now();
  let index = 0;
  
  // 注册网络变化监听器
  const changesDetected = [];
  networkMonitor.addEventListener('infoChange', (info) => {
    changesDetected.push({
      timestamp: Date.now(),
      type: info.type,
      effectiveType: info.effectiveType
    });
  });
  
  return new Promise((resolve) => {
    const changeInterval = setInterval(() => {
      const currentTime = Date.now();
      if (currentTime - startTime >= duration) {
        clearInterval(changeInterval);
        resolve(changesDetected);
        return;
      }
      
      // 切换到下一个网络类型
      const connectionType = connectionTypes[index % connectionTypes.length];
      console.log(`切换网络类型到: ${connectionType}`);
      simulateNetworkChange(connectionType);
      
      index++;
    }, interval);
  });
}

/**
 * 在网络变化期间加载资源
 * @param {Array} resources - 要加载的资源数组
 * @param {Array} connectionTypes - 网络连接类型数组
 * @param {number} changeInterval - 网络变化间隔（毫秒）
 * @param {number} duration - 总持续时间（毫秒）
 * @returns {Promise<Object>} 测试结果
 */
async function loadResourcesDuringNetworkChanges(resources, connectionTypes, changeInterval, duration) {
  // 同时开始网络变化模拟和资源加载
  const networkChangesPromise = simulateNetworkChanges(connectionTypes, changeInterval, duration);
  
  // 分批加载资源，确保加载过程持续足够长时间
  const batchSize = Math.max(5, Math.floor(resources.length / 5)); // 将资源分成至少5批
  const batches = [];
  
  for (let i = 0; i < resources.length; i += batchSize) {
    batches.push(resources.slice(i, i + batchSize));
  }
  
  // 记录加载结果
  const loadResults = {
    totalResources: resources.length,
    loadedResources: 0,
    failedResources: 0,
    batchResults: []
  };
  
  // 顺序加载每批资源
  for (let i = 0; i < batches.length; i++) {
    const batchStartTime = Date.now();
    try {
      console.log(`加载第 ${i+1}/${batches.length} 批资源 (${batches[i].length} 个)...`);
      const results = await traceLoader.loadBatch(batches[i]);
      
      // 记录批次结果
      loadResults.batchResults.push({
        batchIndex: i,
        batchSize: batches[i].length,
        duration: Date.now() - batchStartTime,
        success: true,
        successCount: results.length,
        networkType: navigator.connection.type
      });
      
      loadResults.loadedResources += results.length;
    } catch (error) {
      console.error(`批次 ${i+1} 加载失败:`, error);
      
      // 记录失败批次
      loadResults.batchResults.push({
        batchIndex: i,
        batchSize: batches[i].length,
        duration: Date.now() - batchStartTime,
        success: false,
        error: error.message,
        networkType: navigator.connection.type
      });
      
      loadResults.failedResources += batches[i].length;
    }
  }
  
  // 等待网络变化模拟完成
  const networkChanges = await networkChangesPromise;
  
  // 返回完整结果
  return {
    loadResults,
    networkChanges
  };
}

/**
 * 主测试函数
 */
async function runTests() {
  console.log('====================================');
  console.log('网络状态切换测试');
  console.log('====================================');
  console.log(`运行时间: ${new Date().toISOString()}`);
  
  try {
    // 测试场景1：快速网络切换（WiFi/4G/3G之间快速切换）
    console.log('\n测试场景1: 快速网络切换（WiFi/4G/3G快速切换）...');
    
    const resources = generateResources(40, 'mixed');
    
    const result1 = await performanceTool.measure(async () => {
      return await loadResourcesDuringNetworkChanges(
        resources,
        [CONNECTION_TYPES.WIFI, CONNECTION_TYPES.CELL_4G, CONNECTION_TYPES.CELL_3G],
        1000, // 每1秒切换一次
        20000 // 总持续时间20秒
      );
    }, '快速网络切换-1秒间隔');
    
    console.log(`快速网络切换测试完成，成功加载: ${result1.result.loadResults.loadedResources}/${result1.result.loadResults.totalResources} 资源`);
    console.log(`检测到的网络变化次数: ${result1.result.networkChanges.length}`);
    
    // 测试场景2：更快速的网络切换
    console.log('\n测试场景2: 极快速网络切换（300ms间隔）...');
    
    const result2 = await performanceTool.measure(async () => {
      return await loadResourcesDuringNetworkChanges(
        resources,
        [CONNECTION_TYPES.WIFI, CONNECTION_TYPES.CELL_4G, CONNECTION_TYPES.CELL_3G],
        300, // 每300毫秒切换一次
        15000 // 总持续时间15秒
      );
    }, '极快速网络切换-300ms间隔');
    
    console.log(`极快速网络切换测试完成，成功加载: ${result2.result.loadResults.loadedResources}/${result2.result.loadResults.totalResources} 资源`);
    console.log(`检测到的网络变化次数: ${result2.result.networkChanges.length}`);
    
    // 测试场景3：网络质量剧烈变化
    console.log('\n测试场景3: 网络质量剧烈变化（WiFi/2G极端切换）...');
    
    const result3 = await performanceTool.measure(async () => {
      return await loadResourcesDuringNetworkChanges(
        resources,
        [CONNECTION_TYPES.WIFI, CONNECTION_TYPES.CELL_2G],
        2000, // 每2秒切换一次
        16000 // 总持续时间16秒
      );
    }, '网络质量剧烈变化');
    
    console.log(`网络质量剧烈变化测试完成，成功加载: ${result3.result.loadResults.loadedResources}/${result3.result.loadResults.totalResources} 资源`);
    console.log(`检测到的网络变化次数: ${result3.result.networkChanges.length}`);
    
    // 将结果保存到报告文件
    const reportData = {
      timestamp: new Date().toISOString(),
      testResults: {
        fastNetworkSwitching: {
          duration: result1.duration,
          loadedResources: result1.result.loadResults.loadedResources,
          totalResources: result1.result.loadResults.totalResources,
          networkChanges: result1.result.networkChanges.length,
          batchResults: result1.result.loadResults.batchResults
        },
        veryFastNetworkSwitching: {
          duration: result2.duration,
          loadedResources: result2.result.loadResults.loadedResources,
          totalResources: result2.result.loadResults.totalResources,
          networkChanges: result2.result.networkChanges.length,
          batchResults: result2.result.loadResults.batchResults
        },
        extremeNetworkQualityChanges: {
          duration: result3.duration,
          loadedResources: result3.result.loadResults.loadedResources,
          totalResources: result3.result.loadResults.totalResources,
          networkChanges: result3.result.networkChanges.length,
          batchResults: result3.result.loadResults.batchResults
        }
      },
      summary: {
        totalResourcesLoaded: result1.result.loadResults.loadedResources + 
                             result2.result.loadResults.loadedResources + 
                             result3.result.loadResults.loadedResources,
        totalResourcesFailed: result1.result.loadResults.failedResources + 
                             result2.result.loadResults.failedResources + 
                             result3.result.loadResults.failedResources,
        totalNetworkChanges: result1.result.networkChanges.length + 
                            result2.result.networkChanges.length + 
                            result3.result.networkChanges.length,
        averageLoadTime: (result1.duration + result2.duration + result3.duration) / 3
      },
      performanceData: performanceTool.getSummary(false)
    };
    
    // 确保目录存在
    const reportsDir = path.resolve(__dirname, '../../reports');
    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true });
    }
    
    // 写入报告文件
    const reportPath = path.join(reportsDir, 'run-network-switch-test-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(reportData, null, 2), 'utf8');
    
    console.log(`\n报告已生成: ${reportPath}`);
    
    // 输出格式化性能数据（用于生成报告解析）
    console.log('\nPERFORMANCE_DATA_START');
    console.log(JSON.stringify(reportData));
    console.log('PERFORMANCE_DATA_END');
    
    console.log('\n====================================');
    console.log('测试完成');
    console.log('====================================');
    
    return { success: true, data: reportData };
  } catch (error) {
    console.error('测试过程中发生错误:', error);
    
    // 停止记录性能数据
    performanceTool.stopRecording();
    
    // 清理资源
    networkMonitor.removeAllListeners();
    traceLoader.reset();
    
    return { success: false, error: error.message };
  } finally {
    // 停止记录性能数据
    performanceTool.stopRecording();
    
    // 清理资源
    networkMonitor.removeAllListeners();
    traceLoader.reset();
  }
}

// 运行测试
runTests()
  .then(result => {
    if (!result.success) {
      process.exit(1);
    }
  })
  .catch(error => {
    console.error('运行测试时发生错误:', error);
    process.exit(1);
  }); 