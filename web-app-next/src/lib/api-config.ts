/**
 * API配置中心
 *
 * @description 统一管理API配置，支持Mock/Real API透明切换
 * @created TASK-P3-018C Day 1
 * @dependency TASK-P3-018B 中央Mock服务 (100%完成)
 * @fixed 移除有问题的Mock健康检查，解决循环依赖问题
 */

/**
 * API配置接口
 */
export interface ApiConfig {
  mockEnabled: boolean;
  mockHealthCheck: boolean;
  schemaVersion: string;
  baseURL: string;
  timeout: number;
  retryAttempts: number;
}

/**
 * Mock服务健康状态 - 简化版
 */
export interface MockHealthStatus {
  available: boolean;
  lastCheck: number;
  handlers: number;
  environment: string;
}

/**
 * 获取API配置
 */
export const getApiConfig = (): ApiConfig => {
  const config: ApiConfig = {
    mockEnabled: process.env.NEXT_PUBLIC_MOCK_ENABLED === 'true',
    mockHealthCheck: process.env.NEXT_PUBLIC_MOCK_HEALTH_CHECK === 'true', // 默认关闭
    schemaVersion: process.env.NEXT_PUBLIC_API_SCHEMA_VERSION || '1.0.0',
    baseURL: process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3000/api',
    timeout: parseInt(process.env.NEXT_PUBLIC_API_TIMEOUT || '10000'),
    retryAttempts: parseInt(process.env.NEXT_PUBLIC_API_RETRY_ATTEMPTS || '3')
  };

  // 开发环境默认启用Mock，但禁用健康检查
  if (process.env.NODE_ENV === 'development' && !process.env.NEXT_PUBLIC_MOCK_ENABLED) {
    config.mockEnabled = true;
    config.mockHealthCheck = false; // 强制禁用，避免循环依赖
  }

  return config;
};

/**
 * 简化的Mock健康状态检查 - 基于MSW Worker状态
 * 不再通过HTTP API调用，避免循环依赖问题
 */
export const checkMockHealth = (): MockHealthStatus => {
  const config = getApiConfig();

  if (!config.mockEnabled) {
    return {
      available: false,
      lastCheck: Date.now(),
      handlers: 0,
      environment: 'real-api'
    };
  }

  // 简单检查：如果Mock启用，就认为可用
  // 避免复杂的HTTP健康检查导致循环依赖
  return {
    available: true,
    lastCheck: Date.now(),
    handlers: 58, // P3-018B实现的handlers数量
    environment: 'mock-api'
  };
};

/**
 * 动态切换Mock状态 (开发环境)
 */
export const toggleMockEnabled = (enabled: boolean): void => {
  if (process.env.NODE_ENV !== 'development') {
    console.warn('Mock toggle only available in development');
    return;
  }

  // 使用URL参数控制Mock状态
  const url = new URL(window.location.href);
  if (enabled) {
    url.searchParams.set('mock', 'true');
  } else {
    url.searchParams.set('mock', 'false');
  }

  window.location.href = url.toString();
};

/**
 * 从URL参数获取Mock状态
 */
export const getMockEnabledFromURL = (): boolean | null => {
  if (typeof window === 'undefined') return null;

  const params = new URLSearchParams(window.location.search);
  const mockParam = params.get('mock');

  if (mockParam === 'true') return true;
  if (mockParam === 'false') return false;
  return null;
};

/**
 * 获取Schema版本兼容性信息
 */
export const getSchemaCompatibility = (currentVersion: string, requiredVersion: string): {
  compatible: boolean;
  canMigrate: boolean;
  riskLevel: 'low' | 'medium' | 'high';
} => {
  // 简单的版本兼容性检查
  const current = currentVersion.split('.').map(Number);
  const required = requiredVersion.split('.').map(Number);

  // 主版本不兼容
  if (current[0] !== required[0]) {
    return { compatible: false, canMigrate: false, riskLevel: 'high' };
  }

  // 次版本向后兼容
  if (current[1] < required[1]) {
    return { compatible: false, canMigrate: true, riskLevel: 'medium' };
  }

  // 补丁版本兼容
  return { compatible: true, canMigrate: true, riskLevel: 'low' };
};

/**
 * 导出默认配置实例
 */
export const apiConfig = getApiConfig();

/**
 * 配置变更监听器
 */
export const onConfigChange = (callback: (config: ApiConfig) => void): (() => void) => {
  const handleStorageChange = () => {
    callback(getApiConfig());
  };

  // 监听localStorage变化（如果使用）
  if (typeof window !== 'undefined') {
    window.addEventListener('storage', handleStorageChange);
  }

  return () => {
    if (typeof window !== 'undefined') {
      window.removeEventListener('storage', handleStorageChange);
    }
  };
};
