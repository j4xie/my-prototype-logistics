/**
 * @module config/environments/production
 * @description 生产环境特定配置
 */

/**
 * 生产环境配置
 * 只包含与默认配置不同的部分
 */
module.exports = {
  app: {
    environment: "production",
    debugMode: false
  },
  
  api: {
    retryAttempts: 2, // 降低重试次数
    cacheTime: 600 // 增加缓存时间
  },
  
  performance: {
    monitoring: true,
    reportToServer: true, // 开启服务器报告
    sampleRate: 0.05, // 降低采样率以减少负载
    minLogLevel: "error" // 只记录错误
  },
  
  features: {
    // 可能禁用一些实验性功能
    dataAnalytics: false
  },
  
  storage: {
    syncInterval: 600, // 增加同步间隔
    compression: true // 确保启用压缩
  }
}; 