// 核心初始化逻辑
import { createStorageAdapter } from './platform/storage';
import { detectPlatform } from './platform/platform';
import { logger } from './utils/logger';

export interface CoreConfig {
  apiBaseUrl: string;
  enableMocks?: boolean;
  enableDevTools?: boolean;
  platform?: 'web' | 'mobile' | 'auto';
}

let isInitialized = false;

export async function initializeCore(config: CoreConfig): Promise<void> {
  if (isInitialized) {
    logger.warn('Core already initialized');
    return;
  }

  try {
    // 平台检测
    const platform = config.platform === 'auto' ? detectPlatform() : config.platform || 'web';
    logger.info(`Initializing core for platform: ${platform}`);

    // 存储适配器初始化
    const storage = createStorageAdapter(platform);
    
    // 设置全局配置
    globalThis.__FOOD_TRACE_CONFIG__ = {
      ...config,
      platform,
      storage
    };

    // 开发工具初始化
    if (config.enableDevTools && typeof window !== 'undefined') {
      // 仅在浏览器环境中启用开发工具
      if (typeof window.__REDUX_DEVTOOLS_EXTENSION__ !== 'undefined') {
        logger.info('DevTools enabled');
      }
    }

    isInitialized = true;
    logger.info('Core initialization completed');
  } catch (error) {
    logger.error('Core initialization failed:', error);
    throw error;
  }
}

export function getCoreConfig(): CoreConfig & { platform: string; storage: any } {
  if (!isInitialized) {
    throw new Error('Core not initialized. Call initializeCore() first.');
  }
  return globalThis.__FOOD_TRACE_CONFIG__;
}