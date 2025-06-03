/**
 * @module config/server/development
 * @description 开发环境服务器配置
 */

/**
 * 开发环境服务器配置
 * 只包含与默认配置不同的部分
 */
module.exports = {
  port: 3001, // 使用不同端口以避免冲突
  
  // 开发特定设置
  development: {
    enabled: true,
    errorDetails: true, // 显示详细错误信息
    liveReload: true,   // 启用热重载
    sourceMaps: true,   // 启用源码映射
    watchAssets: true   // 监控资源变化
  },
  
  // 路径配置
  paths: {
    static: ['./'], // 静态文件目录
  },
  
  // 缓存配置
  cache: {
    enabled: false, // 开发环境禁用缓存
    maxAge: 0
  },
  
  // 日志配置
  logging: {
    level: 'debug', // 更详细的日志
    format: 'dev',  // 开发友好的格式
    colorize: true,
    requests: true,
    errors: true,
    debug: true     // 启用调试日志
  }
}; 