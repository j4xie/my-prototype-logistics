/**
 * @module configLoader
 * @description 食品溯源系统 - 统一配置加载工具
 * @version 1.0.0
 * @author 食品溯源系统开发团队
 */

/**
 * 深度合并对象
 * @param {Object} target - 目标对象
 * @param {Object} source - 源对象
 * @returns {Object} - 合并后的对象
 * @private
 */
function deepMerge(target, source) {
  const result = Object.assign({}, target);
  
  if (isObject(target) && isObject(source)) {
    for (const key in source) {
      if (isObject(source[key])) {
        if (!result[key]) Object.assign(result, { [key]: {} });
        result[key] = deepMerge(result[key], source[key]);
      } else {
        Object.assign(result, { [key]: source[key] });
      }
    }
  }
  
  return result;
}

/**
 * 检查是否为对象
 * @param {*} item - 待检查项
 * @returns {boolean} - 是否为对象
 * @private
 */
function isObject(item) {
  return (item && typeof item === 'object' && !Array.isArray(item));
}

/**
 * 获取当前环境
 * @returns {string} - 环境名称 (development|testing|production)
 * @private
 */
function getCurrentEnvironment() {
  // 首先检查环境变量
  if (typeof process !== 'undefined' && process.env) {
    if (process.env.NODE_ENV) {
      return process.env.NODE_ENV;
    }
  }

  // 其次检查全局变量
  if (typeof window !== 'undefined' && window.__APP_ENV__) {
    return window.__APP_ENV__;
  }

  // 再检查localStorage
  try {
    if (typeof localStorage !== 'undefined') {
      const storedEnv = localStorage.getItem('app_environment');
      if (storedEnv) {
        return storedEnv;
      }
    }
  } catch (error) {
    console.warn('无法访问localStorage:', error);
  }

  // 最后使用默认环境
  return 'development';
}

/**
 * 从对象中获取嵌套值
 * @param {Object} obj - 源对象
 * @param {string} path - 点分隔的路径
 * @param {*} defaultValue - 默认值
 * @returns {*} - 找到的值或默认值
 * @private
 */
function getNestedValue(obj, path, defaultValue) {
  const keys = path.split('.');
  let result = obj;
  
  for (const key of keys) {
    if (result === undefined || result === null || !result.hasOwnProperty(key)) {
      return defaultValue;
    }
    result = result[key];
  }
  
  return result === undefined ? defaultValue : result;
}

/**
 * 设置对象嵌套值
 * @param {Object} obj - 目标对象
 * @param {string} path - 点分隔的路径
 * @param {*} value - 要设置的值
 * @returns {boolean} - 是否设置成功
 * @private
 */
function setNestedValue(obj, path, value) {
  if (!obj || typeof obj !== 'object') return false;
  
  const keys = path.split('.');
  let current = obj;
  
  // 遍历到倒数第二级
  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i];
    if (!current[key] || typeof current[key] !== 'object') {
      current[key] = {};
    }
    current = current[key];
  }
  
  // 设置最后一级的值
  const lastKey = keys[keys.length - 1];
  current[lastKey] = value;
  
  return true;
}

/**
 * 配置加载器
 */
const configLoader = {
  // 内部状态
  _initialized: false,
  _config: {},
  _defaultConfig: {},
  _environment: 'development',
  _storage: {
    enabled: true,
    key: 'app_config'
  },
  
  /**
   * 初始化配置加载器
   * @param {Object} options - 初始化选项
   * @param {string} [options.environment] - 指定环境
   * @param {boolean} [options.useLocalStorage=true] - 是否使用本地存储
   * @param {string} [options.storageKey='app_config'] - 本地存储键名
   * @returns {Object} - 配置加载器实例
   */
  init(options = {}) {
    if (this._initialized) {
      console.warn('配置加载器已初始化，重新初始化将覆盖现有配置');
    }
    
    // 设置选项
    this._environment = options.environment || getCurrentEnvironment();
    this._storage.enabled = options.useLocalStorage !== false;
    this._storage.key = options.storageKey || 'app_config';
    
    // 加载配置
    this._loadDefaultConfig();
    this._loadEnvironmentConfig();
    
    if (this._storage.enabled) {
      this._loadFromStorage();
    }
    
    this._initialized = true;
    return this;
  },
  
  /**
   * 加载默认配置
   * @private
   */
  _loadDefaultConfig() {
    try {
      const appConfig = require('../../../config/default/app');
      const apiConfig = require('../../../config/default/api');
      const authConfig = require('../../../config/default/auth');
      const uiConfig = require('../../../config/default/ui');
      const featuresConfig = require('../../../config/default/features');
      const storageConfig = require('../../../config/default/storage');
      const performanceConfig = require('../../../config/default/performance');
      const integrationConfig = require('../../../config/default/integration');
      
      this._defaultConfig = {
        app: appConfig,
        api: apiConfig,
        auth: authConfig,
        ui: uiConfig,
        features: featuresConfig,
        storage: storageConfig,
        performance: performanceConfig,
        integration: integrationConfig
      };
      
      // 复制到当前配置
      this._config = deepMerge({}, this._defaultConfig);
    } catch (error) {
      console.error('加载默认配置失败:', error);
      this._config = {};
    }
  },
  
  /**
   * 加载环境特定配置
   * @private
   */
  _loadEnvironmentConfig() {
    try {
      const envConfigPath = `../../../config/environments/${this._environment}`;
      const envConfig = require(envConfigPath);
      
      // 合并环境配置
      this._config = deepMerge(this._config, envConfig);
      
      // 加载环境变量
      this._loadFromEnvironmentVars();
    } catch (error) {
      console.warn(`加载环境配置失败 (${this._environment}):`, error);
    }
  },
  
  /**
   * 从环境变量加载配置
   * @private
   */
  _loadFromEnvironmentVars() {
    if (typeof process === 'undefined' || !process.env) return;
    
    const envVarMappings = {
      'API_BASE_URL': 'api.baseUrl',
      'API_TIMEOUT': 'api.timeout',
      'AUTH_TOKEN_EXPIRY': 'auth.tokenExpiry',
      'STORAGE_PREFIX': 'storage.prefix',
      'DEBUG_MODE': 'app.debug',
      'LOG_LEVEL': 'app.logLevel'
    };
    
    for (const [envVar, configPath] of Object.entries(envVarMappings)) {
      const value = process.env[envVar];
      if (value !== undefined) {
        // 尝试解析为JSON，如果失败则作为字符串处理
        let parsedValue = value;
        try {
          parsedValue = JSON.parse(value);
        } catch (e) {
          // 保持原始字符串值
        }
        
        setNestedValue(this._config, configPath, parsedValue);
      }
    }
  },
  
  /**
   * 从本地存储加载配置
   * @private
   */
  _loadFromStorage() {
    try {
      if (typeof localStorage === 'undefined') return;
      
      const storedConfig = localStorage.getItem(this._storage.key);
      if (storedConfig) {
        const parsedConfig = JSON.parse(storedConfig);
        this._config = deepMerge(this._config, parsedConfig);
      }
    } catch (error) {
      console.warn('从本地存储加载配置失败:', error);
    }
  },
  
  /**
   * 获取完整配置对象
   * @returns {Object} - 完整配置对象
   */
  getConfig() {
    if (!this._initialized) {
      console.warn('配置加载器未初始化，返回空配置');
      return {};
    }
    
    return deepMerge({}, this._config);
  },
  
  /**
   * 获取指定域的配置
   * @param {string} domain - 配置域名 (app|api|auth|ui|features|storage|performance|integration)
   * @returns {Object} - 指定域的配置对象
   */
  getDomain(domain) {
    if (!this._initialized) {
      console.warn('配置加载器未初始化，返回空配置');
      return {};
    }
    
    if (!this._config[domain]) {
      console.warn(`配置域 '${domain}' 不存在`);
      return {};
    }
    
    return deepMerge({}, this._config[domain]);
  },
  
  /**
   * 获取配置值
   * @param {string} path - 配置路径 (点分隔)
   * @param {*} defaultValue - 默认值
   * @returns {*} - 配置值
   */
  get(path, defaultValue) {
    if (!this._initialized) {
      console.warn('配置加载器未初始化，返回默认值');
      return defaultValue;
    }
    
    return getNestedValue(this._config, path, defaultValue);
  },
  
  /**
   * 设置配置值
   * @param {string} path - 配置路径 (点分隔)
   * @param {*} value - 配置值
   * @returns {boolean} - 是否设置成功
   */
  set(path, value) {
    if (!this._initialized) {
      console.warn('配置加载器未初始化，无法设置配置');
      return false;
    }
    
    const success = setNestedValue(this._config, path, value);
    
    if (success && this._storage.enabled) {
      this.saveToStorage();
    }
    
    return success;
  },
  
  /**
   * 重置配置域
   * @param {string} [domain] - 要重置的域，不指定则重置全部
   * @returns {boolean} - 是否重置成功
   */
  reset(domain) {
    if (!this._initialized) {
      console.warn('配置加载器未初始化，无法重置配置');
      return false;
    }
    
    if (domain) {
      if (this._defaultConfig[domain]) {
        this._config[domain] = deepMerge({}, this._defaultConfig[domain]);
      } else {
        console.warn(`配置域 '${domain}' 不存在`);
        return false;
      }
    } else {
      this._config = deepMerge({}, this._defaultConfig);
    }
    
    if (this._storage.enabled) {
      this.saveToStorage();
    }
    
    return true;
  },
  
  /**
   * 保存配置到本地存储
   * @returns {boolean} - 是否保存成功
   */
  saveToStorage() {
    if (!this._storage.enabled) return false;
    
    try {
      if (typeof localStorage === 'undefined') return false;
      
      localStorage.setItem(this._storage.key, JSON.stringify(this._config));
      return true;
    } catch (error) {
      console.error('保存配置到本地存储失败:', error);
      return false;
    }
  },
  
  /**
   * 从本地存储加载配置
   * @returns {boolean} - 是否加载成功
   */
  loadFromStorage() {
    this._loadFromStorage();
    return true;
  },
  
  /**
   * 设置环境
   * @param {string} environment - 环境名称
   * @returns {boolean} - 是否设置成功
   */
  setEnvironment(environment) {
    if (!environment || typeof environment !== 'string') {
      console.error('环境名称必须是非空字符串');
      return false;
    }
    
    const oldEnvironment = this._environment;
    this._environment = environment;
    
    try {
      // 重新加载配置
      this._loadDefaultConfig();
      this._loadEnvironmentConfig();
      
      if (this._storage.enabled) {
        this._loadFromStorage();
      }
      
      return true;
    } catch (error) {
      console.error('设置环境失败:', error);
      this._environment = oldEnvironment;
      return false;
    }
  },
  
  /**
   * 获取当前环境
   * @returns {string} - 当前环境名称
   */
  getEnvironment() {
    return this._environment;
  },
  
  /**
   * 导出配置
   * @returns {string} - JSON格式的配置字符串
   */
  exportConfig() {
    return JSON.stringify(this._config, null, 2);
  },
  
  /**
   * 导入配置
   * @param {string|Object} config - 配置字符串或对象
   * @returns {boolean} - 是否导入成功
   */
  importConfig(config) {
    try {
      let configObj = config;
      if (typeof config === 'string') {
        configObj = JSON.parse(config);
      }
      
      this._config = deepMerge(this._config, configObj);
      
      if (this._storage.enabled) {
        this.saveToStorage();
      }
      
      return true;
    } catch (error) {
      console.error('导入配置失败:', error);
      return false;
    }
  }
};

// 导出配置加载器
module.exports = configLoader; 