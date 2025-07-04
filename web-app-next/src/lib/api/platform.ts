/**
 * 平台管理API接口
 * 提供多租户工厂管理、订阅套餐、操作日志等功能的API封装
 */

import type {
  Factory,
  SubscriptionPlanInfo,
  OperationLog,
  PlatformOverview,
  FactoryStatus,
  SubscriptionPlan
} from '@/mocks/data/platform-data';

// API响应包装器类型
interface ApiResponse<T> {
  code: number;
  message: string;
  data: T;
}

interface PaginationResponse<T> {
  code: number;
  message: string;
  data: {
    factories?: T[];
    logs?: T[];
    pagination: {
      page: number;
      size: number;
      total: number;
      pages: number;
    };
  };
}

// 创建工厂请求参数
export interface CreateFactoryRequest {
  factory_name: string;
  industry: string;
  owner_name: string;
  owner_email: string;
  owner_phone: string;
  contact_address: string;
  subscription_plan: SubscriptionPlan;
  employee_count: number;
}

// 更新工厂状态请求参数
export interface UpdateFactoryStatusRequest {
  status: FactoryStatus;
  reason?: string;
}

// 创建订阅套餐请求参数
export interface CreatePlanRequest {
  name: string;
  display_name: string;
  price_monthly: number;
  price_yearly: number;
  max_users: number;
  max_storage_gb: number;
  features: string[];
}

// 模拟登录响应
export interface SimulateLoginResponse {
  token: string;
  factory_id: string;
  factory_name: string;
  redirect_url: string;
}

// 基础API配置
const API_BASE = '/api/platform';

// 通用fetch封装
async function fetchApi<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE}${endpoint}`;

  const defaultOptions: RequestInit = {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  };

  try {
    const response = await fetch(url, defaultOptions);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error(`API Error [${endpoint}]:`, error);
    throw error;
  }
}

/**
 * 平台概览统计API
 */
export const platformOverviewApi = {
  /**
   * 获取平台概览数据
   */
  getOverview: (): Promise<ApiResponse<PlatformOverview>> => {
    return fetchApi('/overview');
  },
};

/**
 * 工厂管理API
 */
export const factoryApi = {
  /**
   * 获取工厂列表
   */
  getFactories: (params: {
    keyword?: string;
    page?: number;
    size?: number;
  } = {}): Promise<PaginationResponse<Factory>> => {
    const searchParams = new URLSearchParams();

    if (params.keyword) searchParams.set('keyword', params.keyword);
    if (params.page) searchParams.set('page', params.page.toString());
    if (params.size) searchParams.set('size', params.size.toString());

    const query = searchParams.toString();
    return fetchApi(`/factories${query ? `?${query}` : ''}`);
  },

  /**
   * 创建工厂
   */
  createFactory: (data: CreateFactoryRequest): Promise<ApiResponse<Factory>> => {
    return fetchApi('/factories', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  /**
   * 更新工厂状态
   */
  updateFactoryStatus: (
    factoryId: string,
    data: UpdateFactoryStatusRequest
  ): Promise<ApiResponse<Factory>> => {
    return fetchApi(`/factories/${factoryId}/status`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  /**
   * 模拟登录到工厂
   */
  simulateLogin: (factoryId: string): Promise<ApiResponse<SimulateLoginResponse>> => {
    return fetchApi(`/factories/${factoryId}/simulate-login`, {
      method: 'POST',
    });
  },
};

/**
 * 订阅套餐管理API
 */
export const subscriptionApi = {
  /**
   * 获取订阅套餐列表
   */
  getPlans: (): Promise<ApiResponse<SubscriptionPlanInfo[]>> => {
    return fetchApi('/plans');
  },

  /**
   * 创建订阅套餐
   */
  createPlan: (data: CreatePlanRequest): Promise<ApiResponse<SubscriptionPlanInfo>> => {
    return fetchApi('/plans', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  /**
   * 更新订阅套餐
   */
  updatePlan: (
    planId: string,
    data: Partial<CreatePlanRequest>
  ): Promise<ApiResponse<SubscriptionPlanInfo>> => {
    return fetchApi(`/plans/${planId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },
};

/**
 * 操作日志API
 */
export const operationLogApi = {
  /**
   * 获取操作日志
   */
  getLogs: (params: {
    page?: number;
    size?: number;
  } = {}): Promise<PaginationResponse<OperationLog>> => {
    const searchParams = new URLSearchParams();

    if (params.page) searchParams.set('page', params.page.toString());
    if (params.size) searchParams.set('size', params.size.toString());

    const query = searchParams.toString();
    return fetchApi(`/logs${query ? `?${query}` : ''}`);
  },
};

// 导出所有API
export const platformApi = {
  overview: platformOverviewApi,
  factory: factoryApi,
  subscription: subscriptionApi,
  logs: operationLogApi,
};

export default platformApi;
