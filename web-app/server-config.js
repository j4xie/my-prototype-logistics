/**
 * 服务器配置管理 - 食品溯源系统
 * 版本: 1.0.0
 * 
 * 此模块管理本地开发服务器的配置。
 */

/**
 * 默认服务器配置
 */
const defaultConfig = {
  // 服务器基本设置
  port: 3000,               // 默认端口
  hostname: 'localhost',    // 主机名
  protocol: 'http',         // 协议
  
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
  },
  
  // 安全配置
  security: {
    // 内容安全策略
    contentSecurityPolicy: {
      enabled: false,
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:'],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"],
      },
    },
    
    // XSS保护
    xssProtection: {
      enabled: true,
      mode: 'block',
    },
    
    // 点击劫持保护
    frameguard: {
      enabled: true,
      action: 'SAMEORIGIN',
    },
    
    // HTTP严格传输安全
    hsts: {
      enabled: false,
      maxAge: 15552000,
      includeSubDomains: true,
      preload: false,
    },
    
    // X-Content-Type-Options
    noSniff: true,
  },
  
  // 开发模式设置
  development: {
    enabled: true,
    liveReload: true,
    errorDetails: true,
    testDataSeed: 42,      // 测试数据随机种子
    testProductCount: 50,  // 生成测试产品数量
  },
  
  // 测试模式设置
  testing: {
    enabled: false,
    mockResponses: false,
    mockDelay: 300,
  },
  
  // 错误页面
  errorPages: {
    notFound: './error-pages/404.html',
    serverError: './error-pages/500.html',
    forbidden: './error-pages/403.html',
  },
};

/**
 * 环境配置映射
 */
const envConfigs = {
  development: {
    development: { enabled: true, errorDetails: true },
    logging: { level: 'debug' },
  },
  
  testing: {
    testing: { enabled: true },
    logging: { level: 'info' },
    development: { enabled: false },
  },
  
  production: {
    development: { enabled: false, errorDetails: false },
    logging: { level: 'error', colorize: false },
    security: {
      contentSecurityPolicy: { enabled: true },
      hsts: { enabled: true },
    },
    cache: { maxAge: 86400 },
  },
};

/**
 * 从环境变量中获取端口
 * @returns {number} 端口号
 */
function getPortFromEnv() {
  const envPort = process.env.PORT;
  if (envPort) {
    const port = parseInt(envPort, 10);
    if (!isNaN(port) && port > 0) {
      return port;
    }
  }
  return defaultConfig.port;
}

/**
 * 深度合并对象
 * @param {Object} target 目标对象
 * @param {Object} source 源对象
 * @returns {Object} 合并后的对象
 */
function deepMerge(target, source) {
  if (!source) return target;
  
  const output = { ...target };
  
  if (isObject(target) && isObject(source)) {
    Object.keys(source).forEach(key => {
      if (isObject(source[key])) {
        if (!(key in target)) {
          Object.assign(output, { [key]: source[key] });
        } else {
          output[key] = deepMerge(target[key], source[key]);
        }
      } else {
        Object.assign(output, { [key]: source[key] });
      }
    });
  }
  
  return output;
}

/**
 * 检查值是否为对象
 * @param {any} item 要检查的项
 * @returns {boolean} 是否为对象
 */
function isObject(item) {
  return (item && typeof item === 'object' && !Array.isArray(item));
}

/**
 * 创建服务器配置
 * @param {Object} customConfig 自定义配置
 * @param {string} env 环境
 * @returns {Object} 合并后的配置
 */
function createServerConfig(customConfig = {}, env = process.env.NODE_ENV) {
  // 确定环境
  const environment = env || 'development';
  
  // 获取环境特定配置
  const envConfig = envConfigs[environment] || envConfigs.development;
  
  // 合并配置
  let config = deepMerge(defaultConfig, envConfig);
  
  // 应用端口环境变量
  config.port = getPortFromEnv();
  
  // 合并自定义配置
  config = deepMerge(config, customConfig);
  
  return config;
}

/**
 * 创建完整的服务器URL
 * @param {Object} config 服务器配置
 * @returns {string} 服务器URL
 */
function getServerUrl(config) {
  const { protocol, hostname, port } = config;
  return `${protocol}://${hostname}:${port}`;
}

/**
 * 创建API URL
 * @param {Object} config 服务器配置
 * @param {string} endpoint API终端路径
 * @returns {string} 完整API URL
 */
function getApiUrl(config, endpoint) {
  const serverUrl = getServerUrl(config);
  const apiPrefix = config.paths.apiPrefix || '/api';
  const path = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  return `${serverUrl}${apiPrefix}${path}`;
}

/**
 * 获取静态资源URL
 * @param {Object} config 服务器配置
 * @param {string} path 资源路径
 * @returns {string} 静态资源URL
 */
function getStaticUrl(config, path) {
  const serverUrl = getServerUrl(config);
  const resourcePath = path.startsWith('/') ? path : `/${path}`;
  return `${serverUrl}${resourcePath}`;
}

/**
 * 验证配置是否有效
 * @param {Object} config 配置
 * @returns {boolean} 是否有效
 */
function validateConfig(config) {
  // 检查必要配置是否存在
  if (!config.port || !config.hostname) {
    return false;
  }
  
  // 检查端口值是否有效
  if (isNaN(config.port) || config.port < 0 || config.port > 65535) {
    return false;
  }
  
  // 简单验证路径
  if (!Array.isArray(config.paths.static) || config.paths.static.length === 0) {
    return false;
  }
  
  return true;
}

module.exports = {
  defaultConfig,
  createServerConfig,
  getServerUrl,
  getApiUrl,
  getStaticUrl,
  validateConfig,
  
  // 工具函数（用于测试）
  deepMerge,
  isObject,
  getPortFromEnv
}; 