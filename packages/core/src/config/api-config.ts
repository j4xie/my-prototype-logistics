/**
 * API配置管理
 */

import { appConfig } from './app-config';

/**
 * API端点配置
 */
export interface ApiEndpoints {
  // 认证相关
  auth: {
    login: string;
    logout: string;
    register: string;
    refresh: string;
    profile: string;
    changePassword: string;
    resetPassword: string;
  };
  
  // 批次管理
  batches: {
    list: string;
    create: string;
    get: (id: string) => string;
    update: (id: string) => string;
    delete: (id: string) => string;
    search: string;
    qrcode: (id: string) => string;
    history: (id: string) => string;
  };
  
  // 产品管理
  products: {
    list: string;
    create: string;
    get: (id: string) => string;
    update: (id: string) => string;
    delete: (id: string) => string;
    categories: string;
    standards: (id: string) => string;
  };
  
  // 质量管理
  quality: {
    standards: string;
    checks: string;
    create: string;
    reports: string;
    generate: string;
  };
  
  // 供应商管理
  suppliers: {
    list: string;
    create: string;
    get: (id: string) => string;
    update: (id: string) => string;
    delete: (id: string) => string;
    audit: (id: string) => string;
    performance: (id: string) => string;
  };
  
  // 分析报表
  analytics: {
    dashboard: string;
    trends: string;
    export: string;
    metrics: string;
  };
  
  // 文件管理
  files: {
    upload: string;
    download: (id: string) => string;
    delete: (id: string) => string;
  };
}

/**
 * API配置
 */
export interface ApiConfig {
  baseURL: string;
  timeout: number;
  retries: number;
  retryDelay: number;
  headers: Record<string, string>;
  endpoints: ApiEndpoints;
}

/**
 * 默认API端点
 */
const defaultEndpoints: ApiEndpoints = {
  auth: {
    login: '/auth/login',
    logout: '/auth/logout',
    register: '/auth/register',
    refresh: '/auth/refresh',
    profile: '/auth/profile',
    changePassword: '/auth/change-password',
    resetPassword: '/auth/reset-password',
  },
  
  batches: {
    list: '/batches',
    create: '/batches',
    get: (id: string) => `/batches/${id}`,
    update: (id: string) => `/batches/${id}`,
    delete: (id: string) => `/batches/${id}`,
    search: '/batches/search',
    qrcode: (id: string) => `/batches/${id}/qrcode`,
    history: (id: string) => `/batches/${id}/history`,
  },
  
  products: {
    list: '/products',
    create: '/products',
    get: (id: string) => `/products/${id}`,
    update: (id: string) => `/products/${id}`,
    delete: (id: string) => `/products/${id}`,
    categories: '/products/categories',
    standards: (id: string) => `/products/${id}/standards`,
  },
  
  quality: {
    standards: '/quality/standards',
    checks: '/quality/checks',
    create: '/quality/checks',
    reports: '/quality/reports',
    generate: '/quality/reports/generate',
  },
  
  suppliers: {
    list: '/suppliers',
    create: '/suppliers',
    get: (id: string) => `/suppliers/${id}`,
    update: (id: string) => `/suppliers/${id}`,
    delete: (id: string) => `/suppliers/${id}`,
    audit: (id: string) => `/suppliers/${id}/audit`,
    performance: (id: string) => `/suppliers/${id}/performance`,
  },
  
  analytics: {
    dashboard: '/analytics/dashboard',
    trends: '/analytics/trends',
    export: '/analytics/export',
    metrics: '/analytics/metrics',
  },
  
  files: {
    upload: '/files/upload',
    download: (id: string) => `/files/${id}`,
    delete: (id: string) => `/files/${id}`,
  },
};

/**
 * API配置管理器
 */
export class ApiConfigManager {
  private static instance: ApiConfigManager;
  private config: ApiConfig;

  private constructor() {
    this.config = this.loadConfig();
  }

  static getInstance(): ApiConfigManager {
    if (!ApiConfigManager.instance) {
      ApiConfigManager.instance = new ApiConfigManager();
    }
    return ApiConfigManager.instance;
  }

  /**
   * 加载配置
   */
  private loadConfig(): ApiConfig {
    const appApiConfig = appConfig.get('api');
    
    return {
      baseURL: appApiConfig.baseURL,
      timeout: appApiConfig.timeout,
      retries: appApiConfig.retries,
      retryDelay: appApiConfig.retryDelay,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      endpoints: defaultEndpoints,
    };
  }

  /**
   * 获取配置
   */
  getConfig(): ApiConfig {
    return { ...this.config };
  }

  /**
   * 获取完整URL
   */
  getUrl(endpoint: string): string {
    // 如果是完整URL，直接返回
    if (endpoint.startsWith('http://') || endpoint.startsWith('https://')) {
      return endpoint;
    }
    
    // 确保端点以/开头
    const normalizedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    
    return `${this.config.baseURL}${normalizedEndpoint}`;
  }

  /**
   * 获取端点
   */
  getEndpoint(path: string): string {
    const keys = path.split('.');
    let endpoint: any = this.config.endpoints;
    
    for (const key of keys) {
      endpoint = endpoint[key];
      if (!endpoint) {
        throw new Error(`Endpoint not found: ${path}`);
      }
    }
    
    if (typeof endpoint === 'function') {
      throw new Error(`Endpoint ${path} requires parameters`);
    }
    
    return endpoint;
  }

  /**
   * 获取带参数的端点
   */
  getEndpointWithParams(path: string, ...params: any[]): string {
    const keys = path.split('.');
    let endpoint: any = this.config.endpoints;
    
    for (const key of keys) {
      endpoint = endpoint[key];
      if (!endpoint) {
        throw new Error(`Endpoint not found: ${path}`);
      }
    }
    
    if (typeof endpoint === 'function') {
      return endpoint(...params);
    }
    
    return endpoint;
  }

  /**
   * 更新基础URL
   */
  setBaseURL(baseURL: string): void {
    this.config.baseURL = baseURL;
  }

  /**
   * 更新超时时间
   */
  setTimeout(timeout: number): void {
    this.config.timeout = timeout;
  }

  /**
   * 更新重试次数
   */
  setRetries(retries: number): void {
    this.config.retries = retries;
  }

  /**
   * 设置默认头部
   */
  setDefaultHeaders(headers: Record<string, string>): void {
    this.config.headers = {
      ...this.config.headers,
      ...headers,
    };
  }

  /**
   * 添加认证头部
   */
  setAuthHeader(token: string, type: string = 'Bearer'): void {
    this.config.headers['Authorization'] = `${type} ${token}`;
  }

  /**
   * 移除认证头部
   */
  removeAuthHeader(): void {
    delete this.config.headers['Authorization'];
  }

  /**
   * 设置语言头部
   */
  setLanguageHeader(language: string): void {
    this.config.headers['Accept-Language'] = language;
  }

  /**
   * 获取默认请求头
   */
  getDefaultHeaders(): Record<string, string> {
    return { ...this.config.headers };
  }

  /**
   * 更新端点配置
   */
  updateEndpoints(endpoints: Partial<ApiEndpoints>): void {
    this.config.endpoints = {
      ...this.config.endpoints,
      ...endpoints,
    };
  }

  /**
   * 重置配置
   */
  reset(): void {
    this.config = this.loadConfig();
  }
}

/**
 * API配置管理器实例
 */
export const apiConfig = ApiConfigManager.getInstance();

/**
 * 便捷函数
 */
export const getApiConfig = () => apiConfig.getConfig();
export const getApiUrl = (endpoint: string) => apiConfig.getUrl(endpoint);
export const getEndpoint = (path: string) => apiConfig.getEndpoint(path);
export const getEndpointWithParams = (path: string, ...params: any[]) => 
  apiConfig.getEndpointWithParams(path, ...params);

/**
 * API路径常量
 */
export const API_PATHS = {
  // 认证
  AUTH_LOGIN: 'auth.login',
  AUTH_LOGOUT: 'auth.logout',
  AUTH_REGISTER: 'auth.register',
  AUTH_REFRESH: 'auth.refresh',
  AUTH_PROFILE: 'auth.profile',
  
  // 批次
  BATCHES_LIST: 'batches.list',
  BATCHES_CREATE: 'batches.create',
  BATCHES_SEARCH: 'batches.search',
  
  // 产品
  PRODUCTS_LIST: 'products.list',
  PRODUCTS_CREATE: 'products.create',
  PRODUCTS_CATEGORIES: 'products.categories',
  
  // 质量
  QUALITY_STANDARDS: 'quality.standards',
  QUALITY_CHECKS: 'quality.checks',
  QUALITY_REPORTS: 'quality.reports',
  
  // 供应商
  SUPPLIERS_LIST: 'suppliers.list',
  SUPPLIERS_CREATE: 'suppliers.create',
  
  // 分析
  ANALYTICS_DASHBOARD: 'analytics.dashboard',
  ANALYTICS_TRENDS: 'analytics.trends',
  
  // 文件
  FILES_UPLOAD: 'files.upload',
} as const;

// 默认导出
export default apiConfig;