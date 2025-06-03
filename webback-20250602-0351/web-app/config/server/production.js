/**
 * @module config/server/production
 * @description 生产环境服务器配置
 */

/**
 * 生产环境服务器配置
 * 只包含与默认配置不同的部分
 */
module.exports = {
  // 生产环境端口将从环境变量中读取
  
  // 禁用开发功能
  development: {
    enabled: false,
    errorDetails: false // 不显示详细错误信息
  },
  
  // 路径配置
  paths: {
    static: ['./dist', './public'], // 生产静态文件目录
  },
  
  // 缓存配置
  cache: {
    enabled: true,
    maxAge: 86400, // 更长的缓存时间（一天）
  },
  
  // 日志配置
  logging: {
    level: 'error', // 只记录错误
    format: 'combined',
    colorize: false, // 禁用彩色日志（生产环境通常使用日志文件）
    requests: true,
    errors: true
  },
  
  // 安全配置
  security: {
    contentSecurityPolicy: {
      enabled: true,
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:"],
        connectSrc: ["'self'"]
      }
    },
    hsts: {
      enabled: true,
      maxAge: 31536000, // 一年
      includeSubDomains: true,
      preload: true
    },
    xssProtection: {
      enabled: true,
    },
    frameguard: {
      enabled: true,
      action: 'deny'
    }
  },
  
  // 压缩配置
  compression: {
    enabled: true,
    level: 9, // 最高压缩级别
  }
}; 