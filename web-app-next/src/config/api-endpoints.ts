/**
 * API端点配置
 * 管理Mock API和真实API的端点切换
 * 生产环境默认使用真实API进行认证，其他功能使用Mock
 */

// 真实API配置
export const REAL_API_CONFIG = {
  baseURL: 'http://47.251.121.76:10010',
  timeout: 15000,
  retryAttempts: 3,
} as const;

// Mock API配置
export const MOCK_API_CONFIG = {
  baseURL: '', // 使用相对路径，指向当前域名的API路由
  timeout: 10000,
  retryAttempts: 2,
} as const;

// API端点定义
export const API_ENDPOINTS = {
  // 认证相关 - 使用真实API
  AUTH: {
    REGISTER: '/users/register',
    LOGIN: '/users/login',
    LOGOUT: '/users/logout',
    REFRESH: '/auth/refresh',
    STATUS: '/auth/status',
    PROFILE: '/users/profile',
  },
  
  // 其他功能 - 继续使用Mock API
  FARMING: {
    CROPS: '/api/farming/crops',
    FIELDS: '/api/farming/fields',
    ACTIVITIES: '/api/farming/farm-activities',
    HARVEST: '/api/farming/harvest-records',
    PLANNING: '/api/farming/planting-plans',
  },
  
  PROCESSING: {
    PRODUCTION: '/api/processing/production-batches',
    QUALITY: '/api/processing/quality-tests',
    MATERIALS: '/api/processing/raw-materials',
    PRODUCTS: '/api/processing/finished-products',
  },
  
  LOGISTICS: {
    ORDERS: '/api/logistics/transport-orders',
    VEHICLES: '/api/logistics/vehicles',
    DRIVERS: '/api/logistics/drivers',
    WAREHOUSES: '/api/logistics/warehouses',
    INVENTORY: '/api/logistics/inventory',
  },
  
  ADMIN: {
    USERS: '/api/admin/users',
    ROLES: '/api/admin/roles',
    AUDIT: '/api/admin/audit-logs',
    NOTIFICATIONS: '/api/admin/notifications',
  },
} as const;

/**
 * 判断是否为认证相关的API
 */
export const isAuthAPI = (endpoint: string): boolean => {
  const authEndpoints = Object.values(API_ENDPOINTS.AUTH);
  return authEndpoints.some(authEndpoint => endpoint.includes(authEndpoint));
};

/**
 * 获取API环境类型
 * 认证API：生产环境默认使用真实API，开发环境可通过参数切换
 * 其他API：继续使用Mock API
 */
export const getApiEnvironment = (endpoint?: string): 'real' | 'mock' => {
  // 如果是认证相关API
  if (endpoint && isAuthAPI(endpoint)) {
    // 生产环境检测
    if (typeof window !== 'undefined') {
      const isProduction = window.location.hostname !== 'localhost' && 
                          window.location.hostname !== '127.0.0.1';
      
      if (isProduction) {
        // 生产环境默认使用真实API，除非明确指定mock=true
        const params = new URLSearchParams(window.location.search);
        return params.get('mock') === 'true' ? 'mock' : 'real';
      } else {
        // 开发环境默认使用Mock，除非明确指定mock=false
        const params = new URLSearchParams(window.location.search);
        return params.get('mock') === 'false' ? 'real' : 'mock';
      }
    }
    
    // 服务端渲染时，检查环境变量
    const nodeEnv = process.env.NODE_ENV;
    const forceReal = process.env.NEXT_PUBLIC_USE_REAL_AUTH_API;
    
    if (nodeEnv === 'production' || forceReal === 'true') {
      return 'real';
    }
  }
  
  // 非认证API默认使用Mock
  return 'mock';
};

/**
 * 获取API基础URL
 */
export const getApiBaseURL = (endpoint?: string): string => {
  const environment = getApiEnvironment(endpoint);
  
  if (endpoint && isAuthAPI(endpoint)) {
    // 认证API根据环境返回对应URL
    return environment === 'real' ? REAL_API_CONFIG.baseURL : MOCK_API_CONFIG.baseURL;
  }
  
  // 其他API使用Mock
  return MOCK_API_CONFIG.baseURL;
};

/**
 * 获取完整的API URL
 */
export const getFullApiUrl = (endpoint: string): string => {
  const baseURL = getApiBaseURL(endpoint);
  return `${baseURL}${endpoint}`;
};

/**
 * API配置获取
 */
export const getApiConfig = (endpoint?: string) => {
  const environment = getApiEnvironment(endpoint);
  
  if (endpoint && isAuthAPI(endpoint)) {
    return environment === 'real' ? REAL_API_CONFIG : MOCK_API_CONFIG;
  }
  
  return MOCK_API_CONFIG;
}; 