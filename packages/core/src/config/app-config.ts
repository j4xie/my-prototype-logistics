/**
 * 应用配置管理
 */

import { getCoreConfig } from '../index';
import { Platform } from '../utils/helpers';

/**
 * 应用配置接口
 */
export interface AppConfig {
  // 基础配置
  appName: string;
  version: string;
  environment: 'development' | 'staging' | 'production';
  
  // API配置
  api: {
    baseURL: string;
    timeout: number;
    retries: number;
    retryDelay: number;
  };
  
  // 缓存配置
  cache: {
    enabled: boolean;
    ttl: number; // 默认TTL（秒）
    maxSize: number; // 最大缓存大小（MB）
    strategy: 'lru' | 'ttl' | 'fifo';
  };
  
  // 日志配置
  logging: {
    enabled: boolean;
    level: 'debug' | 'info' | 'warn' | 'error';
    console: boolean;
    remote: boolean;
    maxStoredLogs: number;
  };
  
  // 存储配置
  storage: {
    prefix: string;
    encrypt: boolean;
    sync: boolean;
  };
  
  // 界面配置
  ui: {
    theme: 'light' | 'dark' | 'auto';
    language: string;
    animations: boolean;
    compactMode: boolean;
  };
  
  // 功能开关
  features: {
    offlineMode: boolean;
    biometricAuth: boolean;
    pushNotifications: boolean;
    analytics: boolean;
    crashReporting: boolean;
    betaFeatures: boolean;
  };
  
  // 安全配置
  security: {
    sessionTimeout: number; // 分钟
    maxLoginAttempts: number;
    requireDeviceAuth: boolean;
    allowScreenshots: boolean;
  };
  
  // 同步配置
  sync: {
    enabled: boolean;
    interval: number; // 分钟
    onlyOnWifi: boolean;
    backgroundSync: boolean;
  };
  
  // 性能配置
  performance: {
    imageOptimization: boolean;
    lazyLoading: boolean;
    preloadData: boolean;
    batchSize: number;
  };
}

/**
 * 默认配置
 */
const defaultConfig: AppConfig = {
  appName: 'Food Trace',
  version: '1.0.0',
  environment: 'development',
  
  api: {
    baseURL: 'https://api.foodtrace.com',
    timeout: 30000,
    retries: 3,
    retryDelay: 1000,
  },
  
  cache: {
    enabled: true,
    ttl: 300, // 5分钟
    maxSize: 50, // 50MB
    strategy: 'lru',
  },
  
  logging: {
    enabled: true,
    level: 'info',
    console: true,
    remote: false,
    maxStoredLogs: 1000,
  },
  
  storage: {
    prefix: 'foodtrace',
    encrypt: false,
    sync: true,
  },
  
  ui: {
    theme: 'auto',
    language: 'zh-CN',
    animations: true,
    compactMode: false,
  },
  
  features: {
    offlineMode: true,
    biometricAuth: Platform.isMobile,
    pushNotifications: Platform.isMobile,
    analytics: true,
    crashReporting: true,
    betaFeatures: false,
  },
  
  security: {
    sessionTimeout: 30,
    maxLoginAttempts: 5,
    requireDeviceAuth: Platform.isMobile,
    allowScreenshots: true,
  },
  
  sync: {
    enabled: true,
    interval: 15,
    onlyOnWifi: false,
    backgroundSync: Platform.isMobile,
  },
  
  performance: {
    imageOptimization: true,
    lazyLoading: true,
    preloadData: false,
    batchSize: 50,
  },
};

/**
 * 配置管理器
 */
export class AppConfigManager {
  private static instance: AppConfigManager;
  private config: AppConfig;
  private listeners: ((config: AppConfig) => void)[] = [];

  private constructor() {
    this.config = this.loadConfig();
  }

  static getInstance(): AppConfigManager {
    if (!AppConfigManager.instance) {
      AppConfigManager.instance = new AppConfigManager();
    }
    return AppConfigManager.instance;
  }

  /**
   * 加载配置
   */
  private loadConfig(): AppConfig {
    const coreConfig = getCoreConfig();
    const envConfig = this.getEnvironmentConfig();
    const platformConfig = this.getPlatformConfig();
    
    return {
      ...defaultConfig,
      ...envConfig,
      ...platformConfig,
      ...coreConfig,
    };
  }

  /**
   * 获取环境配置
   */
  private getEnvironmentConfig(): Partial<AppConfig> {
    const env = process.env.NODE_ENV || 'development';
    
    switch (env) {
      case 'production':
        return {
          environment: 'production',
          logging: {
            ...defaultConfig.logging,
            level: 'warn',
            console: false,
            remote: true,
          },
          features: {
            ...defaultConfig.features,
            betaFeatures: false,
          },
        };
      
      case 'staging':
        return {
          environment: 'staging',
          logging: {
            ...defaultConfig.logging,
            level: 'info',
            remote: true,
          },
        };
      
      default:
        return {
          environment: 'development',
          logging: {
            ...defaultConfig.logging,
            level: 'debug',
            console: true,
          },
          features: {
            ...defaultConfig.features,
            betaFeatures: true,
          },
        };
    }
  }

  /**
   * 获取平台配置
   */
  private getPlatformConfig(): Partial<AppConfig> {
    if (Platform.isReactNative) {
      return {
        features: {
          ...defaultConfig.features,
          biometricAuth: true,
          pushNotifications: true,
        },
        security: {
          ...defaultConfig.security,
          requireDeviceAuth: true,
        },
        sync: {
          ...defaultConfig.sync,
          backgroundSync: true,
        },
      };
    }
    
    if (Platform.isMobile) {
      return {
        ui: {
          ...defaultConfig.ui,
          compactMode: true,
        },
        performance: {
          ...defaultConfig.performance,
          imageOptimization: true,
          lazyLoading: true,
        },
      };
    }
    
    return {};
  }

  /**
   * 获取配置
   */
  getConfig(): AppConfig {
    return { ...this.config };
  }

  /**
   * 获取配置项
   */
  get<K extends keyof AppConfig>(key: K): AppConfig[K] {
    return this.config[key];
  }

  /**
   * 设置配置项
   */
  set<K extends keyof AppConfig>(key: K, value: AppConfig[K]): void {
    this.config = {
      ...this.config,
      [key]: value,
    };
    this.notifyListeners();
  }

  /**
   * 更新配置
   */
  update(updates: Partial<AppConfig>): void {
    this.config = {
      ...this.config,
      ...updates,
    };
    this.notifyListeners();
  }

  /**
   * 重置配置
   */
  reset(): void {
    this.config = this.loadConfig();
    this.notifyListeners();
  }

  /**
   * 添加配置变化监听器
   */
  addListener(listener: (config: AppConfig) => void): () => void {
    this.listeners.push(listener);
    
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  /**
   * 通知监听器
   */
  private notifyListeners(): void {
    this.listeners.forEach(listener => {
      try {
        listener(this.config);
      } catch (error) {
        console.error('Config listener error:', error);
      }
    });
  }

  /**
   * 验证配置
   */
  validate(): boolean {
    try {
      // API配置验证
      if (!this.config.api.baseURL) {
        throw new Error('API baseURL is required');
      }

      if (this.config.api.timeout <= 0) {
        throw new Error('API timeout must be positive');
      }

      // 缓存配置验证
      if (this.config.cache.ttl <= 0) {
        throw new Error('Cache TTL must be positive');
      }

      if (this.config.cache.maxSize <= 0) {
        throw new Error('Cache max size must be positive');
      }

      // 安全配置验证
      if (this.config.security.sessionTimeout <= 0) {
        throw new Error('Session timeout must be positive');
      }

      if (this.config.security.maxLoginAttempts <= 0) {
        throw new Error('Max login attempts must be positive');
      }

      return true;
    } catch (error) {
      console.error('Config validation failed:', error);
      return false;
    }
  }

  /**
   * 导出配置
   */
  export(): string {
    return JSON.stringify(this.config, null, 2);
  }

  /**
   * 导入配置
   */
  import(configJson: string): boolean {
    try {
      const importedConfig = JSON.parse(configJson);
      this.update(importedConfig);
      return this.validate();
    } catch (error) {
      console.error('Config import failed:', error);
      return false;
    }
  }
}

/**
 * 配置管理器实例
 */
export const appConfig = AppConfigManager.getInstance();

/**
 * 便捷函数
 */
export const getAppConfig = () => appConfig.getConfig();
export const setAppConfig = (updates: Partial<AppConfig>) => appConfig.update(updates);
export const getConfigValue = <K extends keyof AppConfig>(key: K) => appConfig.get(key);
export const setConfigValue = <K extends keyof AppConfig>(key: K, value: AppConfig[K]) => appConfig.set(key, value);

// 默认导出
export default appConfig;