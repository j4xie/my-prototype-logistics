/**
 * API端点配置
 * 管理Mock API和真实API的端点切换
 */

// 真实API配置
export const REAL_API_CONFIG = {
  baseURL: 'http://47.251.121.76:10010',
  timeout: 15000,
  retryAttempts: 3,
} as const;

// API端点定义
export const API_ENDPOINTS = {
  // 认证相关
  AUTH: {
    REGISTER: '/users/register',
    LOGIN: '/users/login',
    LOGOUT: '/users/logout',
    REFRESH: '/auth/refresh',
    STATUS: '/auth/status',
  },
  
  // 用户相关
  USERS: {
    PROFILE: '/users/profile',
    UPDATE_PROFILE: '/users/profile',
  },
} as const;

// 环境检测
export const getApiEnvironment = () => {
  if (typeof window !== 'undefined') {
    // 浏览器环境，检查URL参数
    const params = new URLSearchParams(window.location.search);
    const mockParam = params.get('mock');
    if (mockParam === 'false') return 'real';
    if (mockParam === 'true') return 'mock';
  }
  
  // 环境变量检测
  const env = process.env.NEXT_PUBLIC_API_ENV;
  if (env === 'real' || env === 'production') return 'real';
  
  return 'mock'; // 默认使用Mock
};

// 获取API基础URL
export const getApiBaseURL = (): string => {
  const environment = getApiEnvironment();
  
  if (environment === 'real') {
    return REAL_API_CONFIG.baseURL;
  }
  
  // Mock环境使用当前域名
  return typeof window !== 'undefined' 
    ? `${window.location.origin}/api`
    : '/api';
}; 