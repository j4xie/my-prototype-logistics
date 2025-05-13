/**
 * @module config/server/testing
 * @description 测试环境服务器配置
 */

/**
 * 测试环境服务器配置
 * 只包含与默认配置不同的部分
 */
module.exports = {
  port: 3002, // 测试专用端口
  
  // 测试特定设置
  testing: {
    enabled: true,
    mockResponses: true,     // 启用模拟响应
    isolatedDb: true,        // 使用隔离数据库
    responseDelay: 0,        // 不添加人工延迟
    logRequests: true        // 记录所有请求
  },
  
  // 路径配置
  paths: {
    static: ['./test/static'], // 测试静态文件目录
    testData: './test/data',   // 测试数据目录
    mocks: './test/mocks'      // 模拟数据目录
  },
  
  // 缓存配置
  cache: {
    enabled: false, // 测试环境禁用缓存
  },
  
  // 日志配置
  logging: {
    level: 'info',  // 信息级别日志
    format: 'tiny', // 简洁格式
    errors: true,
    requests: true
  },
  
  // 安全设置
  security: {
    csrf: false,       // 禁用CSRF以简化测试
    rateLimit: false   // 禁用速率限制
  }
}; 