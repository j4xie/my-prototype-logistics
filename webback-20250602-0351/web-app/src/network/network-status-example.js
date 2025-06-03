const NetworkMonitor = require('./network-monitor');

/**
 * @file 网络监控组件使用示例
 * @description 演示如何使用NetworkMonitor类监控网络状态、检测不稳定网络和测量网络延迟
 */

// import NetworkMonitor from './network-monitor';

/**
 * 基本使用示例
 */
function basicUsageExample() {
  console.log('===== 基本用法示例 =====');
  
  // 创建网络监控实例
  const networkMonitor = new NetworkMonitor({
    triggerInitialState: true,  // 初始化时触发当前网络状态
    onOnline: () => console.log('网络已连接'),
    onOffline: () => console.log('网络已断开')
  });
  
  // 检查当前网络状态
  console.log(`当前网络状态: ${networkMonitor.isOnline() ? '在线' : '离线'}`);
  
  // 添加自定义事件监听器
  const onlineHandler = () => console.log('自定义处理器: 网络已连接');
  const offlineHandler = () => console.log('自定义处理器: 网络已断开');
  
  networkMonitor.addStatusChangeListener('online', onlineHandler);
  networkMonitor.addStatusChangeListener('offline', offlineHandler);
  
  // 示例：5秒后移除一个特定的监听器
  setTimeout(() => {
    console.log('移除自定义在线事件监听器');
    networkMonitor.removeStatusChangeListener('online', onlineHandler);
  }, 5000);
  
  // 示例：10秒后移除所有监听器
  setTimeout(() => {
    console.log('移除所有网络状态监听器');
    networkMonitor.removeAllListeners();
  }, 10000);
}

/**
 * 网络不稳定检测示例
 */
function unstableNetworkExample() {
  console.log('===== 网络不稳定检测示例 =====');
  
  // 创建配置为检测不稳定网络的监控实例
  const networkMonitor = new NetworkMonitor({
    unstableThreshold: 3,  // 3秒内发生3次状态变化视为不稳定
    unstablePeriod: 3000,
    logUnstable: true      // 记录不稳定状态
  });
  
  // 定期检查网络是否稳定
  const stabilityChecker = setInterval(() => {
    console.log(`网络稳定状态: ${networkMonitor.isNetworkStable() ? '稳定' : '不稳定'}`);
  }, 2000);
  
  // 10秒后停止检查
  setTimeout(() => {
    clearInterval(stabilityChecker);
    networkMonitor.removeAllListeners();
  }, 10000);
}

/**
 * 网络延迟测量示例
 */
async function networkLatencyExample() {
  console.log('===== 网络延迟测量示例 =====');
  
  const networkMonitor = new NetworkMonitor();
  
  // 测量当前网络延迟
  try {
    const pingUrl = '/api/ping'; // 替换为实际可用的ping接口
    console.log('开始测量网络延迟...');
    
    const latency = await networkMonitor.measureNetworkLatency(pingUrl);
    
    if (latency >= 0) {
      console.log(`当前网络延迟: ${latency}ms`);
      
      // 根据延迟级别评估网络质量
      let quality = '极佳';
      if (latency > 200) quality = '较差';
      else if (latency > 100) quality = '一般';
      else if (latency > 50) quality = '良好';
      
      console.log(`网络质量评估: ${quality}`);
    } else {
      console.log('网络延迟测量失败，请检查网络连接或ping接口是否可用');
    }
  } catch (error) {
    console.error('网络延迟测量时发生错误:', error);
  }
  
  networkMonitor.removeAllListeners();
}

/**
 * 实际应用场景示例：资源预加载与网络状态结合
 */
function practicalExample() {
  console.log('===== 实际应用场景示例 =====');
  
  const networkMonitor = new NetworkMonitor({
    triggerInitialState: true,
    onOnline: () => startResourcePreload(),
    onOffline: () => pauseResourcePreload()
  });
  
  // 模拟资源预加载功能
  function startResourcePreload() {
    console.log('网络已连接，开始预加载资源...');
    // 这里可以实现实际的资源预加载逻辑
  }
  
  function pauseResourcePreload() {
    console.log('网络已断开，暂停预加载，保存当前进度');
    // 这里可以实现暂停预加载并保存进度的逻辑
  }
  
  // 定期检查网络延迟，调整资源加载策略
  const latencyInterval = setInterval(async () => {
    if (networkMonitor.isOnline()) {
      const latency = await networkMonitor.measureNetworkLatency();
      
      if (latency > 0) {
        console.log(`当前网络延迟: ${latency}ms`);
        
        // 根据网络延迟调整资源加载策略
        if (latency > 200) {
          console.log('网络延迟较高，切换到低质量资源');
          // 实现切换到低质量资源的逻辑
        } else {
          console.log('网络延迟正常，使用标准质量资源');
          // 实现使用标准质量资源的逻辑
        }
      }
    }
  }, 5000);
  
  // 示例运行30秒后清理
  setTimeout(() => {
    clearInterval(latencyInterval);
    networkMonitor.removeAllListeners();
    console.log('示例运行结束，已清理资源');
  }, 30000);
}

/**
 * 运行所有示例
 */
function runNetworkMonitorExamples() {
  console.log('========== 网络监控组件示例开始 ==========');
  
  // 依次运行各个示例
  basicUsageExample();
  
  setTimeout(() => {
    unstableNetworkExample();
  }, 12000);
  
  setTimeout(() => {
    networkLatencyExample();
  }, 24000);
  
  setTimeout(() => {
    practicalExample();
  }, 30000);
  
  console.log('示例程序已启动，请观察控制台输出...');
}

// 如果直接运行此文件，则启动示例
if (typeof window !== 'undefined' && window.location.search.includes('run-example')) {
  runNetworkMonitorExamples();
} 
// CommonJS导出
module.exports = {
  runNetworkMonitorExamples
};
