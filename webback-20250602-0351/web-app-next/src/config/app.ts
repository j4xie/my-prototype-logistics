// 应用基础配置模块
// 基于2025-05-28正常状态恢复，简化版本

export interface ApiConfig {
  baseURL: string;
  timeout: number;
  retries: number;
}

export interface AppConfig {
  api: ApiConfig;
  auth: {
    tokenKey: string;
    refreshTokenKey: string;
  };
  ui: {
    theme: string;
    language: string;
  };
}

// 获取API配置
export function getApiConfig(): ApiConfig {
  return {
    baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000',
    timeout: 10000,
    retries: 3
  };
}

// 获取应用配置
export function getAppConfig(): AppConfig {
  return {
    api: getApiConfig(),
    auth: {
      tokenKey: 'auth_token',
      refreshTokenKey: 'refresh_token'
    },
    ui: {
      theme: 'light',
      language: 'zh-CN'
    }
  };
}

// 默认导出
export default getAppConfig;
