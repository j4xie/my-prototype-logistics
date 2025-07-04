/**
 * @food-trace/core - 食品溯源核心业务逻辑包
 * 
 * 这个包提供了跨平台的核心业务逻辑，包括：
 * - 状态管理 (Zustand)
 * - 类型定义
 * - 工具函数
 * - 平台抽象层
 * 
 * 支持平台：Web (React), React Native
 */

// ========================= 类型定义导出 =========================
export * from './types';

// ========================= 工具函数导出 =========================
export * from './utils';

// ========================= 状态管理导出 =========================
export * from './store/base-store';
export * from './store/auth-store';

// ========================= 配置相关导出 =========================
export * from './config';

// ========================= 服务层导出 =========================
export * from './services';

// ========================= Hooks导出 =========================
export * from './hooks';

// ========================= 版本信息 =========================
export const VERSION = '1.0.0';
export const BUILD_DATE = new Date().toISOString();

// ========================= 包信息 =========================
export const PACKAGE_INFO = {
  name: '@food-trace/core',
  version: VERSION,
  description: 'Food traceability core business logic package',
  buildDate: BUILD_DATE,
  platforms: ['web', 'react-native'],
  features: [
    'cross-platform-state-management',
    'type-definitions',
    'utility-functions',
    'storage-abstraction',
    'logging',
    'error-handling',
    'validation',
    'date-utils',
  ],
} as const;

// ========================= 初始化函数 =========================

/**
 * 包初始化选项
 */
export interface CoreInitOptions {
  /** 是否启用调试模式 */
  debug?: boolean;
  /** 日志级别 */
  logLevel?: 'debug' | 'info' | 'warn' | 'error';
  /** 存储适配器 */
  storage?: any; // AsyncStorage for React Native, localStorage for Web
  /** API基础URL */
  apiBaseUrl?: string;
  /** 平台类型 */
  platform?: 'web' | 'react-native';
  /** 自定义配置 */
  config?: Record<string, any>;
}

/**
 * 包初始化函数
 * 在应用启动时调用以配置核心包
 */
export function initializeCore(options: CoreInitOptions = {}) {
  const {
    debug = process.env.NODE_ENV === 'development',
    logLevel = debug ? 'debug' : 'info',
    storage,
    apiBaseUrl,
    platform,
    config = {},
  } = options;

  // 设置全局配置
  if (typeof globalThis !== 'undefined') {
    globalThis.__FOOD_TRACE_CORE_CONFIG__ = {
      debug,
      logLevel,
      storage,
      apiBaseUrl,
      platform,
      ...config,
    };
  }

  // 初始化日志记录器
  const { logger } = require('./utils/logger');
  logger.configure({
    minLevel: logLevel,
    enabled: true,
    enableConsole: true,
    enableStorage: false,
  });

  if (debug) {
    logger.info('Food Trace Core initialized', 'Core', {
      version: VERSION,
      platform,
      config: { debug, logLevel, apiBaseUrl },
    });
  }

  return {
    version: VERSION,
    initialized: true,
    config: globalThis.__FOOD_TRACE_CORE_CONFIG__,
  };
}

/**
 * 获取全局配置
 */
export function getCoreConfig(): any {
  if (typeof globalThis !== 'undefined') {
    return globalThis.__FOOD_TRACE_CORE_CONFIG__ || {};
  }
  return {};
}

/**
 * 检查是否已初始化
 */
export function isCoreInitialized(): boolean {
  const config = getCoreConfig();
  return Boolean(config && Object.keys(config).length > 0);
}

// ========================= 类型声明增强 =========================

declare global {
  var __FOOD_TRACE_CORE_CONFIG__: any;
  
  namespace FoodTraceCore {
    interface Config {
      debug: boolean;
      logLevel: string;
      storage?: any;
      apiBaseUrl?: string;
      platform?: string;
      [key: string]: any;
    }
  }
}

// ========================= 默认导出 =========================
export default {
  VERSION,
  PACKAGE_INFO,
  initializeCore,
  getCoreConfig,
  isCoreInitialized,
};