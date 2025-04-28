/**
 * resource-loader-instance.js
 * 提供应用全局共享的ResourceLoader单例
 * @version 1.0.0
 */

import ResourceLoader from './resource-loader';
import { logInfo } from '../utils/logger';

// 创建全局单例ResourceLoader实例
const resourceLoader = new ResourceLoader({
  // 默认配置，可以从环境变量或配置文件获取
  enableCache: true,
  persistCache: true,
  batchSize: 20,
  maxConcurrentRequests: 6,
  enableRequestMerging: true,
  enablePerformanceMonitoring: true
});

logInfo('创建全局ResourceLoader单例实例');

// 监听页面卸载事件，在页面离开时清理资源
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    logInfo('页面卸载: 清理ResourceLoader资源');
    resourceLoader.destroy();
  });
}

export default resourceLoader; 