/**
 * 资源加载器配置文件
 * 提供不同环境下的配置选项和默认设置
 */

// 设备类型检测
const detectDeviceType = () => {
  const memory = navigator.deviceMemory || 4; // 默认4GB
  const connection = navigator.connection || {};
  const isLowEndDevice = memory <= 2 || 
    (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4);
  const isMobileDevice = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i
    .test(navigator.userAgent);
  
  if (isLowEndDevice && isMobileDevice) return 'LOW_END_MOBILE';
  if (isLowEndDevice) return 'LOW_END_DESKTOP';
  if (isMobileDevice) return 'MOBILE';
  return 'DESKTOP';
};

// 网络环境检测
const detectNetworkType = () => {
  const connection = navigator.connection || {};
  
  if (!connection.type) {
    // 回退检测逻辑
    return 'UNKNOWN';
  }
  
  switch (connection.effectiveType || connection.type) {
    case 'slow-2g':
    case '2g':
      return 'POOR';
    case '3g':
      return 'FAIR';
    case '4g':
      return 'GOOD';
    case 'ethernet':
    case 'wifi':
      return 'EXCELLENT';
    default:
      return 'UNKNOWN';
  }
};

// 企业环境检测
const detectEnterpriseEnvironment = () => {
  // 简单的企业环境检测逻辑
  const hostname = window.location.hostname;
  const isEnterpriseNetwork = hostname.includes('corp.') || 
    hostname.includes('internal.') ||
    hostname.includes('intranet.');
  
  const hasProxy = Boolean(
    window.VPN_DETECTED || // 假设有全局检测标志
    document.cookie.includes('proxy_auth=') ||
    localStorage.getItem('enterprise_auth')
  );
  
  return isEnterpriseNetwork || hasProxy;
};

/**
 * 环境配置工厂函数
 * 根据当前环境返回最优配置
 */
const getEnvironmentConfig = () => {
  const deviceType = detectDeviceType();
  const networkType = detectNetworkType();
  const isEnterpriseEnv = detectEnterpriseEnvironment();
  
  // 基于环境智能选择配置
  return {
    deviceType,
    networkType,
    isEnterpriseEnv,
    batchSize: getBatchSizeForEnvironment(deviceType, networkType),
    cacheSize: getCacheSizeForDevice(deviceType),
    retryStrategy: getRetryStrategyForNetwork(networkType, isEnterpriseEnv),
    timeoutSettings: getTimeoutForNetwork(networkType, isEnterpriseEnv)
  };
};

// 根据环境获取最佳批量大小
const getBatchSizeForEnvironment = (deviceType, networkType) => {
  const batchSizeMatrix = {
    DESKTOP: {
      EXCELLENT: 50,
      GOOD: 30,
      FAIR: 15,
      POOR: 5,
      UNKNOWN: 20
    },
    MOBILE: {
      EXCELLENT: 30,
      GOOD: 20,
      FAIR: 10,
      POOR: 3,
      UNKNOWN: 10
    },
    LOW_END_DESKTOP: {
      EXCELLENT: 25,
      GOOD: 15,
      FAIR: 8,
      POOR: 3,
      UNKNOWN: 10
    },
    LOW_END_MOBILE: {
      EXCELLENT: 15,
      GOOD: 10,
      FAIR: 5,
      POOR: 2,
      UNKNOWN: 5
    }
  };
  
  return batchSizeMatrix[deviceType][networkType] || 10; // 安全默认值
};

// 根据设备获取最佳缓存大小(MB)
const getCacheSizeForDevice = (deviceType) => {
  const cacheSizeByDevice = {
    DESKTOP: 100,
    MOBILE: 50,
    LOW_END_DESKTOP: 50,
    LOW_END_MOBILE: 25
  };
  
  return cacheSizeByDevice[deviceType] || 50; // 默认50MB
};

// 获取网络环境的重试策略
const getRetryStrategyForNetwork = (networkType, isEnterpriseEnv) => {
  // 基本重试策略
  const retryCount = {
    EXCELLENT: 1,
    GOOD: 2,
    FAIR: 3,
    POOR: 5,
    UNKNOWN: 3
  };
  
  const retryDelay = {
    EXCELLENT: 500,
    GOOD: 1000,
    FAIR: 2000,
    POOR: 3000,
    UNKNOWN: 1500
  };
  
  // 企业环境特殊调整(增加重试次数和延迟)
  const enterpriseAdjustment = isEnterpriseEnv ? 1 : 0;
  
  return {
    count: retryCount[networkType] + enterpriseAdjustment,
    delay: retryDelay[networkType],
    backoffFactor: 1.5, // 退避因子
    maxDelay: 10000, // 最大延迟时间(ms)
    jitter: true // 添加随机抖动避免同时重试
  };
};

// 获取网络环境的超时设置
const getTimeoutForNetwork = (networkType, isEnterpriseEnv) => {
  const baseTimeout = {
    EXCELLENT: 5000,
    GOOD: 10000,
    FAIR: 15000,
    POOR: 30000,
    UNKNOWN: 15000
  };
  
  // 企业环境特殊调整(增加超时时间)
  const enterpriseAdjustment = isEnterpriseEnv ? 1.5 : 1;
  
  return Math.round(baseTimeout[networkType] * enterpriseAdjustment);
};

/**
 * 默认配置
 */
const defaultConfig = {
  // 基本设置
  enableResourceLoader: true,
  logLevel: 'warn',
  analyticsEndpoint: '/api/resource-metrics',
  
  // 加载设置
  defaultBatchSize: 10,
  maxConcurrentRequests: 8,
  prioritizeCriticalResources: true,
  preloadLevel: 'medium', // none, minimal, medium, aggressive
  
  // 缓存设置
  enableCache: true,
  defaultCacheSize: 50 * 1024 * 1024, // 50MB
  cacheTTL: 24 * 60 * 60 * 1000, // 24小时
  persistCache: true,
  cacheStrategy: 'frequency-and-recency', // lru, frequency, recency, frequency-and-recency
  
  // 网络设置
  detectNetworkChanges: true,
  networkChangeInterval: 10000, // 每10秒检测一次网络变化
  offlineModeEnabled: true,
  
  // 性能监控
  enablePerformanceMonitoring: true, 
  performanceSampleRate: 0.1, // 10%的请求会被收集性能数据
  
  // 故障恢复
  enableRecoveryMode: true,
  maxRetries: 3,
  retryDelay: 1000,
  
  // 企业环境设置
  enterpriseMode: false,
  authTokenHeader: 'X-Auth-Token',
  proxyAwareness: true,
  
  // 高级设置
  compression: true,
  adaptiveTimeouts: true,
  batchingStrategy: 'adaptive', // fixed, adaptive, predictive
  requestDeduplication: true
};

/**
 * 环境特定配置
 */
const environmentConfigs = {
  development: {
    logLevel: 'debug',
    performanceSampleRate: 1.0,
    analyticsEndpoint: '/dev-api/resource-metrics',
    cacheTTL: 5 * 60 * 1000 // 5分钟（开发环境短TTL）
  },
  
  test: {
    logLevel: 'debug',
    performanceSampleRate: 1.0,
    cacheTTL: 60 * 60 * 1000, // 1小时
    enableMockResponses: true
  },
  
  production: {
    logLevel: 'error',
    performanceSampleRate: 0.1,
    enableRecoveryMode: true,
    compression: true
  },
  
  enterprise: {
    enterpriseMode: true,
    proxyAwareness: true,
    authTokenHeader: 'X-Enterprise-Auth',
    performanceSampleRate: 0.05,
    cacheTTL: 12 * 60 * 60 * 1000 // 12小时
  }
};

/**
 * 创建最终配置
 * 合并默认配置、环境配置和动态检测的配置
 */
const createResourceLoaderConfig = (env = 'production', customConfig = {}) => {
  // 获取环境配置
  const envConfig = environmentConfigs[env] || {};
  
  // 获取动态环境检测配置
  const detectedConfig = getEnvironmentConfig();
  
  // 合并配置 (自定义配置优先级最高)
  return {
    ...defaultConfig,
    ...envConfig,
    batchSize: detectedConfig.batchSize,
    memoryCacheSize: detectedConfig.cacheSize * 1024 * 1024,
    retryStrategy: detectedConfig.retryStrategy,
    timeout: detectedConfig.timeoutSettings,
    deviceType: detectedConfig.deviceType,
    networkType: detectedConfig.networkType,
    enterpriseMode: detectedConfig.isEnterpriseEnv || envConfig.enterpriseMode,
    ...customConfig
  };
};

// 导出配置生成器
module.exports = createResourceLoaderConfig;

// 导出检测函数和默认配置供其他模块使用
module.exports.detectDeviceType = detectDeviceType;
module.exports.detectNetworkType = detectNetworkType;
module.exports.detectEnterpriseEnvironment = detectEnterpriseEnvironment;
module.exports.defaultConfig = defaultConfig;
module.exports.environmentConfigs = environmentConfigs; 