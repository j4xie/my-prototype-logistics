/**
 * @module config/server/default
 * @description 默认服务器配置
 */

/**
 * 服务器默认配置
 * @typedef {Object} ServerConfig
 * @property {number} port - 服务器端口
 * @property {string} hostname - 主机名
 * @property {string} protocol - 协议
 * @property {Object} paths - 路径配置
 * @property {Object} cors - CORS设置
 * @property {Object} cache - 缓存配置
 * @property {Object} compression - 压缩配置
 * @property {Object} logging - 日志配置
 */

/**
 * 服务器默认配置
 * @type {ServerConfig}
 */
module.exports = {
  // 服务器基本设置
  port: 3000,
  hostname: 'localhost',
  protocol: 'http',
  
  // 路径配置
  paths: {
    static: ['./'],         // 静态文件目录
    testPages: './test-pages', // 测试页面目录
    apiPrefix: '/api',      // API路径前缀
  },
  
  // CORS设置
  cors: {
    enabled: true,
    allowOrigin: '*',
    allowMethods: 'GET, POST, PUT, DELETE, OPTIONS',
    allowHeaders: 'Content-Type, Authorization, X-Requested-With',
    maxAge: 86400,
  },
  
  // 缓存配置
  cache: {
    enabled: true,
    maxAge: 3600,           // 默认缓存时间（秒）
    etagEnabled: true,      // 启用ETag
    extensions: ['.css', '.js', '.jpg', '.jpeg', '.png', '.gif', '.ico'],
  },
  
  // 压缩配置
  compression: {
    enabled: true,
    level: 6,               // 压缩级别 (0-9)
    threshold: 1024,        // 最小压缩阈值（字节）
    extensions: ['.html', '.css', '.js', '.json', '.xml', '.txt'],
  },
  
  // 日志配置
  logging: {
    enabled: true,
    level: 'info',          // 日志级别: 'error', 'warn', 'info', 'http', 'verbose', 'debug', 'silly'
    format: 'combined',     // 日志格式: 'combined', 'common', 'dev', 'short', 'tiny'
    colorize: true,         // 启用彩色日志
    requests: true,         // 记录请求
    errors: true,           // 记录错误
  }
}; 