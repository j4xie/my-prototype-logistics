/**
 * @module configManager
 * @description 食品溯源系统 - 配置管理工具
 * @version 1.0.0
 * @author 食品溯源系统开发团队
 */

// 默认配置
const defaultConfig = {
  // 应用基本信息
  app: {
    name: "食品溯源系统",
    version: "1.0.0",
    environment: "production", // production, development, testing
    debugMode: false,
    theme: "light", // light, dark, auto
    language: "zh-CN"
  },
  
  // API配置
  api: {
    endpoint: "/api",
    version: "v1",
    timeout: 30000, // 毫秒
    retryAttempts: 3,
    retryDelay: 1000, // 毫秒
    batchSize: 100, // 批量请求大小
    useCache: true,
    cacheTime: 300 // 秒
  },
  
  // 身份验证
  auth: {
    enabled: true,
    tokenStorage: "localStorage", // localStorage, sessionStorage, cookie
    tokenName: "trace_token",
    sessionTimeout: 1800, // 秒
    refreshThreshold: 300, // 秒，token刷新阈值
    loginUrl: "/auth/login.html",
    logoutUrl: "/auth/logout",
    authType: "jwt" // jwt, oauth, basic
  },

  // 数据存储
  storage: {
    type: "indexeddb", // indexeddb, localstorage, server
    dbName: "trace_db",
    dbVersion: 1,
    syncEnabled: true,
    syncInterval: 300, // 秒
    maxCacheSize: 10485760, // 10MB
    compression: true
  },
  
  // UI配置
  ui: {
    animationsEnabled: true,
    responsiveBreakpoints: {
      xs: 0,
      sm: 576,
      md: 768,
      lg: 992,
      xl: 1200,
      xxl: 1400
    },
    toastDuration: 3000, // 毫秒
    modalTransitionTime: 300, // 毫秒
    iconSet: "material", // material, fontawesome, custom
    dateFormat: "YYYY-MM-DD",
    timeFormat: "HH:mm:ss"
  },
  
  // 块链配置
  blockchain: {
    enabled: true,
    provider: "ethereum", // ethereum, hyperledger, custom
    networkUrl: "",
    contractAddress: "",
    apiKey: ""
  },
  
  // 地图配置
  map: {
    provider: "amap", // amap, google, baidu
    apiKey: "",
    defaultCenter: [116.397428, 39.90923], // 经度, 纬度
    defaultZoom: 12,
    clustersEnabled: true
  },
  
  // 扫描配置
  scanner: {
    enabled: true,
    supportedFormats: ["qr", "barcode", "datamatrix"],
    preferFrontCamera: false,
    scanInterval: 500, // 毫秒
    highlightScanResult: true
  },
  
  // 性能配置
  performance: {
    monitoring: true,
    reportToServer: false,
    reportEndpoint: "/api/performance/report",
    sampleRate: 0.1, // 0-1之间的值，表示采样率
    minLogLevel: "warning" // debug, info, warning, error
  },
  
  // 功能开关
  features: {
    offlineMode: true,
    exportData: true,
    importData: true,
    shareProduct: true,
    printLabels: true,
    batchOperations: true,
    dataAnalytics: true,
    notifications: true
  },
  
  // 第三方集成
  integrations: {
    analytics: {
      enabled: false,
      provider: "none", // none, google, baidu, custom
      trackingId: ""
    },
    payment: {
      enabled: false,
      providers: []
    },
    social: {
      enabled: false,
      platforms: []
    }
  }
};

// 配置架构（用于验证）
const configSchema = {
  // 验证应用配置
  validateApp(config) {
    const errors = [];
    
    if (!config.name || typeof config.name !== 'string') {
      errors.push('app.name 必须是非空字符串');
    }
    
    if (!config.version || typeof config.version !== 'string') {
      errors.push('app.version 必须是非空字符串');
    }
    
    if (!['production', 'development', 'testing'].includes(config.environment)) {
      errors.push('app.environment 必须是 production, development 或 testing');
    }
    
    if (typeof config.debugMode !== 'boolean') {
      errors.push('app.debugMode 必须是布尔值');
    }
    
    if (!['light', 'dark', 'auto'].includes(config.theme)) {
      errors.push('app.theme 必须是 light, dark 或 auto');
    }
    
    return errors;
  },
  
  // 验证API配置
  validateApi(config) {
    const errors = [];
    
    if (!config.endpoint || typeof config.endpoint !== 'string') {
      errors.push('api.endpoint 必须是非空字符串');
    }
    
    if (!config.version || typeof config.version !== 'string') {
      errors.push('api.version 必须是非空字符串');
    }
    
    if (typeof config.timeout !== 'number' || config.timeout <= 0) {
      errors.push('api.timeout 必须是正数');
    }
    
    if (typeof config.retryAttempts !== 'number' || config.retryAttempts < 0) {
      errors.push('api.retryAttempts 必须是非负数');
    }
    
    if (typeof config.batchSize !== 'number' || config.batchSize <= 0) {
      errors.push('api.batchSize 必须是正数');
    }
    
    return errors;
  },
  
  // 验证认证配置
  validateAuth(config) {
    const errors = [];
    
    if (typeof config.enabled !== 'boolean') {
      errors.push('auth.enabled 必须是布尔值');
    }
    
    if (!['localStorage', 'sessionStorage', 'cookie'].includes(config.tokenStorage)) {
      errors.push('auth.tokenStorage 必须是 localStorage, sessionStorage 或 cookie');
    }
    
    if (!config.tokenName || typeof config.tokenName !== 'string') {
      errors.push('auth.tokenName 必须是非空字符串');
    }
    
    if (typeof config.sessionTimeout !== 'number' || config.sessionTimeout <= 0) {
      errors.push('auth.sessionTimeout 必须是正数');
    }
    
    return errors;
  },
  
  // 验证存储配置
  validateStorage(config) {
    const errors = [];
    
    if (!['indexeddb', 'localstorage', 'server'].includes(config.type)) {
      errors.push('storage.type 必须是 indexeddb, localstorage 或 server');
    }
    
    if (!config.dbName || typeof config.dbName !== 'string') {
      errors.push('storage.dbName 必须是非空字符串');
    }
    
    if (typeof config.dbVersion !== 'number' || config.dbVersion <= 0) {
      errors.push('storage.dbVersion 必须是正数');
    }
    
    if (typeof config.syncEnabled !== 'boolean') {
      errors.push('storage.syncEnabled 必须是布尔值');
    }
    
    if (typeof config.syncInterval !== 'number' || config.syncInterval <= 0) {
      errors.push('storage.syncInterval 必须是正数');
    }
    
    return errors;
  },
  
  // 验证UI配置
  validateUi(config) {
    const errors = [];
    
    if (typeof config.animationsEnabled !== 'boolean') {
      errors.push('ui.animationsEnabled 必须是布尔值');
    }
    
    if (typeof config.responsiveBreakpoints !== 'object') {
      errors.push('ui.responsiveBreakpoints 必须是对象');
    } else {
      const breakpoints = ['xs', 'sm', 'md', 'lg', 'xl', 'xxl'];
      breakpoints.forEach(bp => {
        if (typeof config.responsiveBreakpoints[bp] !== 'number') {
          errors.push(`ui.responsiveBreakpoints.${bp} 必须是数字`);
        }
      });
    }
    
    if (typeof config.toastDuration !== 'number' || config.toastDuration <= 0) {
      errors.push('ui.toastDuration 必须是正数');
    }
    
    if (!['material', 'fontawesome', 'custom'].includes(config.iconSet)) {
      errors.push('ui.iconSet 必须是 material, fontawesome 或 custom');
    }
    
    return errors;
  },
  
  // 验证块链配置
  validateBlockchain(config) {
    const errors = [];
    
    if (typeof config.enabled !== 'boolean') {
      errors.push('blockchain.enabled 必须是布尔值');
    }
    
    if (config.enabled) {
      if (!['ethereum', 'hyperledger', 'custom'].includes(config.provider)) {
        errors.push('blockchain.provider 必须是 ethereum, hyperledger 或 custom');
      }
      
      if (config.provider !== 'custom' && (!config.networkUrl || typeof config.networkUrl !== 'string')) {
        errors.push('blockchain.networkUrl 必须是非空字符串');
      }
    }
    
    return errors;
  },
  
  // 验证地图配置
  validateMap(config) {
    const errors = [];
    
    if (!['amap', 'google', 'baidu'].includes(config.provider)) {
      errors.push('map.provider 必须是 amap, google 或 baidu');
    }
    
    if (!config.apiKey || typeof config.apiKey !== 'string') {
      errors.push('map.apiKey 必须是非空字符串');
    }
    
    if (!Array.isArray(config.defaultCenter) || config.defaultCenter.length !== 2) {
      errors.push('map.defaultCenter 必须是包含两个元素的数组 [经度, 纬度]');
    } else {
      if (typeof config.defaultCenter[0] !== 'number' || typeof config.defaultCenter[1] !== 'number') {
        errors.push('map.defaultCenter 数组元素必须是数字');
      }
    }
    
    if (typeof config.defaultZoom !== 'number' || config.defaultZoom <= 0) {
      errors.push('map.defaultZoom 必须是正数');
    }
    
    return errors;
  },
  
  // 验证扫描配置
  validateScanner(config) {
    const errors = [];
    
    if (typeof config.enabled !== 'boolean') {
      errors.push('scanner.enabled 必须是布尔值');
    }
    
    if (!Array.isArray(config.supportedFormats) || config.supportedFormats.length === 0) {
      errors.push('scanner.supportedFormats 必须是非空数组');
    }
    
    if (typeof config.preferFrontCamera !== 'boolean') {
      errors.push('scanner.preferFrontCamera 必须是布尔值');
    }
    
    if (typeof config.scanInterval !== 'number' || config.scanInterval <= 0) {
      errors.push('scanner.scanInterval 必须是正数');
    }
    
    return errors;
  },
  
  // 验证性能配置
  validatePerformance(config) {
    const errors = [];
    
    if (typeof config.monitoring !== 'boolean') {
      errors.push('performance.monitoring 必须是布尔值');
    }
    
    if (typeof config.reportToServer !== 'boolean') {
      errors.push('performance.reportToServer 必须是布尔值');
    }
    
    if (config.reportToServer && (!config.reportEndpoint || typeof config.reportEndpoint !== 'string')) {
      errors.push('当 performance.reportToServer 为 true 时，performance.reportEndpoint 必须是非空字符串');
    }
    
    if (typeof config.sampleRate !== 'number' || config.sampleRate < 0 || config.sampleRate > 1) {
      errors.push('performance.sampleRate 必须是 0 到 1 之间的数字');
    }
    
    if (!['debug', 'info', 'warning', 'error'].includes(config.minLogLevel)) {
      errors.push('performance.minLogLevel 必须是 debug, info, warning 或 error');
    }
    
    return errors;
  },
  
  // 验证功能开关
  validateFeatures(config) {
    const errors = [];
    
    const featureKeys = [
      'offlineMode',
      'exportData',
      'importData',
      'shareProduct',
      'printLabels',
      'batchOperations',
      'dataAnalytics',
      'notifications'
    ];
    
    featureKeys.forEach(key => {
      if (typeof config[key] !== 'boolean') {
        errors.push(`features.${key} 必须是布尔值`);
      }
    });
    
    return errors;
  },
  
  // 验证集成配置
  validateIntegrations(config) {
    const errors = [];
    
    // 验证分析集成
    if (typeof config.analytics !== 'object') {
      errors.push('integrations.analytics 必须是对象');
    } else {
      if (typeof config.analytics.enabled !== 'boolean') {
        errors.push('integrations.analytics.enabled 必须是布尔值');
      }
      
      if (config.analytics.enabled) {
        if (!['none', 'google', 'baidu', 'custom'].includes(config.analytics.provider)) {
          errors.push('integrations.analytics.provider 必须是 none, google, baidu 或 custom');
        }
        
        if (config.analytics.provider !== 'none' && (!config.analytics.trackingId || typeof config.analytics.trackingId !== 'string')) {
          errors.push('integrations.analytics.trackingId 必须是非空字符串');
        }
      }
    }
    
    // 验证支付集成
    if (typeof config.payment !== 'object') {
      errors.push('integrations.payment 必须是对象');
    } else {
      if (typeof config.payment.enabled !== 'boolean') {
        errors.push('integrations.payment.enabled 必须是布尔值');
      }
      
      if (config.payment.enabled && (!Array.isArray(config.payment.providers) || config.payment.providers.length === 0)) {
        errors.push('当 integrations.payment.enabled 为 true 时，integrations.payment.providers 必须是非空数组');
      }
    }
    
    return errors;
  }
};

/**
 * 配置管理工具
 */
const configManager = {
  // 当前配置
  currentConfig: JSON.parse(JSON.stringify(defaultConfig)),
  
  /**
   * 初始化配置管理器
   * @param {Object} userConfig - 用户配置
   * @returns {Object} 最终配置
   */
  init(userConfig = {}) {
    // 从本地存储加载配置
    this.loadFromStorage();
    
    // 合并用户配置
    this.merge(userConfig);
    
    // 验证配置
    this.validate();
    
    // 保存配置
    this.saveToStorage();
    
    return this.getConfig();
  },
  
  /**
   * 获取完整配置
   * @returns {Object} 配置对象
   */
  getConfig() {
    return JSON.parse(JSON.stringify(this.currentConfig));
  },
  
  /**
   * 获取特定部分的配置
   * @param {string} section - 配置部分名称
   * @returns {Object} 配置部分
   */
  getSection(section) {
    if (this.currentConfig[section]) {
      return JSON.parse(JSON.stringify(this.currentConfig[section]));
    }
    return null;
  },
  
  /**
   * 更新配置
   * @param {Object} config - 新配置
   * @returns {Object} 更新后的配置
   */
  update(config) {
    this.merge(config);
    this.validate();
    this.saveToStorage();
    return this.getConfig();
  },
  
  /**
   * 更新特定部分的配置
   * @param {string} section - 配置部分名称
   * @param {Object} config - 部分配置
   * @returns {Object} 更新后的配置部分
   */
  updateSection(section, config) {
    if (!this.currentConfig[section]) {
      throw new Error(`未知的配置部分: ${section}`);
    }
    
    // 创建要更新的配置对象
    const updateConfig = { [section]: config };
    
    // 更新配置
    this.merge(updateConfig);
    this.validate();
    this.saveToStorage();
    
    return this.getSection(section);
  },
  
  /**
   * 重置配置到默认值
   * @param {string} [section] - 可选，要重置的配置部分
   * @returns {Object} 重置后的配置
   */
  reset(section) {
    if (section) {
      if (defaultConfig[section]) {
        this.currentConfig[section] = JSON.parse(JSON.stringify(defaultConfig[section]));
      } else {
        throw new Error(`未知的配置部分: ${section}`);
      }
    } else {
      this.currentConfig = JSON.parse(JSON.stringify(defaultConfig));
    }
    
    this.saveToStorage();
    return this.getConfig();
  },
  
  /**
   * 合并配置
   * @param {Object} config - 要合并的配置
   * @private
   */
  merge(config) {
    // 深度合并配置
    const deepMerge = (target, source) => {
      for (const key in source) {
        if (source.hasOwnProperty(key)) {
          if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
            // 如果是对象，递归合并
            if (!target[key]) target[key] = {};
            deepMerge(target[key], source[key]);
          } else {
            // 基本类型或数组直接覆盖
            target[key] = source[key];
          }
        }
      }
    };
    
    deepMerge(this.currentConfig, config);
  },
  
  /**
   * 验证配置
   * @returns {Array} 错误信息数组
   * @private
   */
  validate() {
    const errors = [];
    
    // 验证各个配置部分
    if (this.currentConfig.app) {
      errors.push(...configSchema.validateApp(this.currentConfig.app));
    }
    
    if (this.currentConfig.api) {
      errors.push(...configSchema.validateApi(this.currentConfig.api));
    }
    
    if (this.currentConfig.auth) {
      errors.push(...configSchema.validateAuth(this.currentConfig.auth));
    }
    
    if (this.currentConfig.storage) {
      errors.push(...configSchema.validateStorage(this.currentConfig.storage));
    }
    
    if (this.currentConfig.ui) {
      errors.push(...configSchema.validateUi(this.currentConfig.ui));
    }
    
    if (this.currentConfig.blockchain) {
      errors.push(...configSchema.validateBlockchain(this.currentConfig.blockchain));
    }
    
    if (this.currentConfig.map) {
      errors.push(...configSchema.validateMap(this.currentConfig.map));
    }
    
    if (this.currentConfig.scanner) {
      errors.push(...configSchema.validateScanner(this.currentConfig.scanner));
    }
    
    if (this.currentConfig.performance) {
      errors.push(...configSchema.validatePerformance(this.currentConfig.performance));
    }
    
    if (this.currentConfig.features) {
      errors.push(...configSchema.validateFeatures(this.currentConfig.features));
    }
    
    if (this.currentConfig.integrations) {
      errors.push(...configSchema.validateIntegrations(this.currentConfig.integrations));
    }
    
    // 如果有错误，打印到控制台
    if (errors.length > 0) {
      console.warn('配置验证警告:', errors);
    }
    
    return errors;
  },
  
  /**
   * 将配置保存到本地存储
   * @private
   */
  saveToStorage() {
    try {
      localStorage.setItem('trace_config', JSON.stringify(this.currentConfig));
    } catch (error) {
      console.error('保存配置到本地存储失败:', error);
    }
  },
  
  /**
   * 从本地存储加载配置
   * @private
   */
  loadFromStorage() {
    try {
      const storedConfig = localStorage.getItem('trace_config');
      
      if (storedConfig) {
        const parsedConfig = JSON.parse(storedConfig);
        this.merge(parsedConfig);
      }
    } catch (error) {
      console.error('从本地存储加载配置失败:', error);
    }
  },
  
  /**
   * 导出配置
   * @returns {string} JSON字符串
   */
  exportConfig() {
    return JSON.stringify(this.currentConfig, null, 2);
  },
  
  /**
   * 导入配置
   * @param {string|Object} config - 配置 JSON 字符串或对象
   * @returns {Object} 导入后的配置
   */
  importConfig(config) {
    try {
      let configObj;
      
      if (typeof config === 'string') {
        configObj = JSON.parse(config);
      } else if (typeof config === 'object') {
        configObj = config;
      } else {
        throw new Error('配置必须是JSON字符串或对象');
      }
      
      // 重置并应用新配置
      this.reset();
      this.merge(configObj);
      this.validate();
      this.saveToStorage();
      
      return this.getConfig();
    } catch (error) {
      console.error('导入配置失败:', error);
      throw error;
    }
  },
  
  /**
   * 获取环境特定的配置
   * @param {string} env - 环境名称
   * @returns {Object} 环境特定的配置
   */
  getEnvConfig(env) {
    // 复制当前配置
    const envConfig = this.getConfig();
    
    // 设置环境
    envConfig.app.environment = env;
    
    // 根据环境进行调整
    switch (env) {
      case 'development':
        envConfig.app.debugMode = true;
        envConfig.api.timeout = 60000; // 更长的超时时间
        envConfig.performance.monitoring = true;
        envConfig.performance.reportToServer = false;
        envConfig.performance.minLogLevel = 'debug';
        break;
        
      case 'testing':
        envConfig.api.endpoint = '/api/test';
        envConfig.storage.dbName = 'trace_test_db';
        envConfig.auth.tokenName = 'trace_test_token';
        envConfig.blockchain.enabled = false;
        break;
        
      case 'production':
        envConfig.app.debugMode = false;
        envConfig.performance.sampleRate = 0.05; // 降低生产环境的采样率
        envConfig.performance.minLogLevel = 'error';
        break;
    }
    
    return envConfig;
  }
};

// 导出模块
window.configManager = configManager;

// 如果定义了模块系统，也通过模块系统导出
if (typeof module !== 'undefined' && module.exports) {
  module.exports = configManager;
} else if (typeof define === 'function' && define.amd) {
  define([], function() { return configManager; });
} 