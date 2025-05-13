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
      const appConfig = require('../../config/default/app');
      const apiConfig = require('../../config/default/api');
      const authConfig = require('../../config/default/auth');
      const uiConfig = require('../../config/default/ui');
      const featuresConfig = require('../../config/default/features');
      const storageConfig = require('../../config/default/storage');
      const performanceConfig = require('../../config/default/performance');
      const integrationConfig = require('../../config/default/integration');
      
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
      // 确保至少有一个空对象
      this._defaultConfig = { app: { name: '食品溯源系统', version: '1.0.0' } };
      this._config = deepMerge({}, this._defaultConfig);
    }
  },
  
  /**
   * 加载环境特定配置
   * @private
   */
  _loadEnvironmentConfig() {
    try {
      // 加载环境配置
      const envConfig = require(`../../config/environments/${this._environment}`);
      // 深度合并到当前配置
      this._config = deepMerge(this._config, envConfig);
    } catch (error) {
      console.warn(`环境配置加载失败: ${this._environment}`, error);
    }
  },
  
  /**
   * 从环境变量加载配置
   * @private
   */
  _loadFromEnvironmentVars() {
    // 仅在服务器端可用
    if (typeof process !== 'undefined' && process.env) {
      const envVarPrefix = 'APP_CONFIG_';
      
      // 查找所有APP_CONFIG_前缀的环境变量
      Object.keys(process.env)
        .filter(key => key.startsWith(envVarPrefix))
        .forEach(key => {
          const configPath = key
            .slice(envVarPrefix.length)
            .toLowerCase()
            .split('__')
            .join('.');
          
          const value = process.env[key];
          
          // 尝试将字符串转换为适当的类型
          let typedValue = value;
          if (value === 'true') typedValue = true;
          else if (value === 'false') typedValue = false;
          else if (value === 'null') typedValue = null;
          else if (value === 'undefined') typedValue = undefined;
          else if (!isNaN(Number(value))) typedValue = Number(value);
          
          // 设置配置值
          this.set(configPath, typedValue);
        });
    }
  },
  
  /**
   * 从本地存储加载配置
   * @private
   */
  _loadFromStorage() {
    if (!this._storage.enabled) return;
    
    try {
      if (typeof localStorage !== 'undefined') {
        const storedConfig = localStorage.getItem(this._storage.key);
        
        if (storedConfig) {
          const parsedConfig = JSON.parse(storedConfig);
          // 合并到当前配置
          this._config = deepMerge(this._config, parsedConfig);
        }
      }
    } catch (error) {
      console.error('从本地存储加载配置失败:', error);
    }
  },
  
  /**
   * 获取完整配置
   * @returns {Object} - 完整的配置对象
   */
  getConfig() {
    if (!this._initialized) {
      this.init();
    }
    return deepMerge({}, this._config);
  },
  
  /**
   * 获取特定域的配置
   * @param {string} domain - 配置域（如'app', 'api'等）
   * @returns {Object} - 特定域的配置
   */
  getDomain(domain) {
    if (!this._initialized) {
      this.init();
    }
    
    if (this._config[domain]) {
      return deepMerge({}, this._config[domain]);
    }
    
    return {};
  },
  
  /**
   * 获取特定配置项
   * @param {string} path - 配置路径（点分隔，如'api.endpoint'）
   * @param {*} defaultValue - 未找到时的默认值
   * @returns {*} - 配置值
   */
  get(path, defaultValue) {
    if (!this._initialized) {
      this.init();
    }
    
    return getNestedValue(this._config, path, defaultValue);
  },
  
  /**
   * 覆盖配置值
   * @param {string} path - 配置路径
   * @param {*} value - 新值
   * @returns {boolean} - 是否成功
   */
  set(path, value) {
    if (!this._initialized) {
      this.init();
    }
    
    const result = setNestedValue(this._config, path, value);
    
    if (result && this._storage.enabled) {
      this.saveToStorage();
    }
    
    return result;
  },
  
  /**
   * 重置配置到默认值
   * @param {string} [domain] - 可选的配置域
   */
  reset(domain) {
    if (!this._initialized) {
      this.init();
      return;
    }
    
    if (domain) {
      // 重置特定域
      if (this._defaultConfig[domain]) {
        this._config[domain] = deepMerge({}, this._defaultConfig[domain]);
      } else {
        console.warn(`未知的配置域: ${domain}`);
        return;
      }
    } else {
      // 重置所有配置
      this._config = deepMerge({}, this._defaultConfig);
      // 重新加载环境配置
      this._loadEnvironmentConfig();
    }
    
    if (this._storage.enabled) {
      this.saveToStorage();
    }
  },
  
  /**
   * 保存用户配置到本地存储
   */
  saveToStorage() {
    if (!this._storage.enabled || typeof localStorage === 'undefined') {
      return;
    }
    
    try {
      const configToSave = JSON.stringify(this._config);
      localStorage.setItem(this._storage.key, configToSave);
    } catch (error) {
      console.error('保存配置到本地存储失败:', error);
    }
  },
  
  /**
   * 从本地存储加载用户配置
   */
  loadFromStorage() {
    this._loadFromStorage();
    return this;
  },
  
  /**
   * 设置当前环境
   * @param {string} environment - 环境名称
   * @returns {Object} - 配置加载器实例
   */
  setEnvironment(environment) {
    if (this._environment === environment) {
      return this;
    }
    
    this._environment = environment;
    
    // 重新加载配置
    this._config = deepMerge({}, this._defaultConfig);
    this._loadEnvironmentConfig();
    
    if (this._storage.enabled) {
      this._loadFromStorage();
    }
    
    return this;
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
   * @returns {string} - JSON格式的配置
   */
  exportConfig() {
    return JSON.stringify(this._config, null, 2);
  },
  
  /**
   * 导入配置
   * @param {string|Object} config - JSON字符串或配置对象
   * @returns {Object} - 配置加载器实例
   */
  importConfig(config) {
    try {
      const configObj = typeof config === 'string' ? JSON.parse(config) : config;
      
      // 验证配置对象
      if (!configObj || typeof configObj !== 'object') {
        throw new Error('无效的配置对象');
      }
      
      // 应用配置
      this._config = deepMerge(this._defaultConfig, configObj);
      
      if (this._storage.enabled) {
        this.saveToStorage();
      }
      
      return this;
    } catch (error) {
      console.error('导入配置失败:', error);
      throw error;
    }
  }
};

// 导出配置加载器
module.exports = configLoader; 