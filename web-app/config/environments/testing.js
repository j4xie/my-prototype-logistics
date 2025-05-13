/**
 * @module config/environments/testing
 * @description 测试环境特定配置
 */

/**
 * 测试环境配置
 * 只包含与默认配置不同的部分
 */
module.exports = {
  app: {
    environment: "testing",
    debugMode: false
  },
  
  api: {
    endpoint: "/api/test", // 测试API端点
    retryAttempts: 1 // 减少重试次数以加快测试
  },
  
  auth: {
    tokenName: "trace_test_token", // 测试专用令牌名称
    sessionTimeout: 3600 // 延长测试会话
  },
  
  storage: {
    dbName: "trace_test_db", // 测试数据库名称
    syncEnabled: false // 禁用同步以隔离测试
  },
  
  features: {
    // 确保所有功能都可测试
    offlineMode: true,
    exportData: true,
    importData: true,
    shareProduct: true,
    printLabels: true,
    batchOperations: true,
    dataAnalytics: true,
    notifications: true
  },
  
  performance: {
    monitoring: true,
    reportToServer: false,
    sampleRate: 1.0 // 收集所有性能数据
  },
  
  integration: {
    blockchain: {
      enabled: false // 测试时禁用区块链集成
    },
    map: {
      // 使用模拟数据
      provider: "mock"
    },
    scanner: {
      enabled: true,
      // 使用测试模式
      testMode: true
    }
  }
};