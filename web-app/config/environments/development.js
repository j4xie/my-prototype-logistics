/**
 * @module config/environments/development
 * @description 开发环境特定配置
 */

/**
 * 开发环境配置
 * 只包含与默认配置不同的部分
 */
module.exports = {
  app: {
    environment: "development",
    debugMode: true
  },
  
  api: {
    timeout: 60000, // 更长的超时时间
    retryAttempts: 5 // 更多重试次数
  },
  
  storage: {
    syncInterval: 60, // 更短的同步间隔
    compression: false // 关闭压缩，便于调试
  },
  
  performance: {
    monitoring: true,
    reportToServer: false,
    minLogLevel: "debug" // 更低的日志级别
  },
  
  integration: {
    blockchain: {
      // 使用测试网络
      networkUrl: "http://localhost:8545"
    }
  }
};