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
  SubscriptionPlan,
  Employee,
  EmployeeStatus,
  Whitelist,
  WhitelistStatus
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
    employees?: T[];
    whitelists?: T[];
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
  name: string;                 // 工厂名称 (映射到backend的name)
  industry: string;             // 所属行业 (映射到backend的industry)
  contactName: string;          // 负责人姓名 (映射到backend的contactName)
  contactEmail: string;         // 联系邮箱 (映射到backend的contactEmail)
  contactPhone: string;         // 联系电话 (映射到backend的contactPhone)
  address: string;              // 工厂地址 (映射到backend的address)
  subscriptionPlan: SubscriptionPlan; // 订阅套餐 (映射到backend的subscriptionPlan)
  employeeCount: number;        // 员工数量 (映射到backend的employeeCount)
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
const API_BASE = 'http://localhost:3001/api/platform';

// 通用fetch封装
async function fetchApi<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE}${endpoint}`;

  // Get authorization token from localStorage
  const token = localStorage.getItem('auth_token');

  const defaultOptions: RequestInit = {
    headers: {
      'Content-Type': 'application/json',
      ...(token && { 'Authorization': `Bearer ${token}` }),
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
   * 更新工厂信息
   */
  updateFactory: (factoryId: string, data: any): Promise<ApiResponse<Factory>> => {
    return fetchApi(`/factories/${factoryId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  /**
   * 暂停工厂
   */
  suspendFactory: (factoryId: string, reason?: string): Promise<ApiResponse<Factory>> => {
    return fetchApi(`/factories/${factoryId}/suspend`, {
      method: 'PUT',
      body: JSON.stringify({ reason }),
    });
  },

  /**
   * 激活工厂
   */
  activateFactory: (factoryId: string): Promise<ApiResponse<Factory>> => {
    return fetchApi(`/factories/${factoryId}/activate`, {
      method: 'PUT',
    });
  },

  /**
   * 删除工厂
   */
  deleteFactory: (
    factoryId: string,
    password: string,
    confirmText: string
  ): Promise<ApiResponse<null>> => {
    return fetchApi(`/factories/${factoryId}`, {
      method: 'DELETE',
      body: JSON.stringify({ password, confirmText }),
    });
  },

  /**
   * 更新工厂状态（保留旧接口兼容性）
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
   * 模拟登录到工厂（保留旧接口兼容性）
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

/**
 * 员工管理API
 */
export const employeeApi = {
  /**
   * 获取指定工厂的员工列表
   */
  getEmployees: (factoryId: string, params: {
    keyword?: string;
    page?: number;
    size?: number;
  } = {}): Promise<PaginationResponse<Employee>> => {
    const searchParams = new URLSearchParams();

    if (params.keyword) searchParams.set('keyword', params.keyword);
    if (params.page) searchParams.set('page', params.page.toString());
    if (params.size) searchParams.set('size', params.size.toString());

    const query = searchParams.toString();
    return fetchApi(`/factories/${factoryId}/employees${query ? `?${query}` : ''}`);
  },

  /**
   * 更新员工状态
   */
  updateEmployeeStatus: (factoryId: string, employeeId: string, status: EmployeeStatus): Promise<ApiResponse<Employee>> => {
    return fetchApi(`/factories/${factoryId}/employees/${employeeId}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status }),
    });
  },

  /**
   * 删除员工
   */
  deleteEmployee: (factoryId: string, employeeId: string): Promise<ApiResponse<null>> => {
    return fetchApi(`/factories/${factoryId}/employees/${employeeId}`, {
      method: 'DELETE',
    });
  },
};

/**
 * 白名单管理API
 */
export const whitelistApi = {
  /**
   * 获取白名单列表
   */
  getWhitelists: (params: {
    factoryId?: string;
    keyword?: string;
    status?: WhitelistStatus;
    page?: number;
    size?: number;
  } = {}): Promise<PaginationResponse<Whitelist>> => {
    const searchParams = new URLSearchParams();

    if (params.factoryId) searchParams.set('factoryId', params.factoryId);
    if (params.keyword) searchParams.set('keyword', params.keyword);
    if (params.status) searchParams.set('status', params.status);
    if (params.page) searchParams.set('page', params.page.toString());
    if (params.size) searchParams.set('size', params.size.toString());

    const query = searchParams.toString();
    return fetchApi(`/whitelists${query ? `?${query}` : ''}`);
  },

  /**
   * 添加到白名单（单个或批量）
   * 使用批量导入接口实现
   */
  addToWhitelist: (data: {
    factoryId: string;
    phoneNumbers: string[];
    addedBy: string;
  }): Promise<ApiResponse<{
    success_count: number;
    failed_count: number;
    failed_records: Array<{ phoneNumber: string; reason: string }>;
  }>> => {
    // 转换为批量导入格式
    const whitelists = data.phoneNumbers.map(phone => ({
      identifier: phone,
      identifier_type: 'phone' as const,
      name: '',
      department: '',
      position: ''
    }));
    
    return fetchApi('/whitelists/batch-import', {
      method: 'POST',
      body: JSON.stringify({
        factory_id: data.factoryId,
        whitelists
      }),
    });
  },

  /**
   * 从白名单中移除
   */
  removeFromWhitelist: (whitelistId: string): Promise<ApiResponse<null>> => {
    return fetchApi(`/whitelists/${whitelistId}`, {
      method: 'DELETE',
    });
  },

  /**
   * 批量导入白名单
   */
  batchImport: (data: {
    factory_id: string;
    whitelists: Array<{
      identifier: string;
      identifier_type: 'phone' | 'email' | 'id_card';
      name?: string;
      department?: string;
      position?: string;
      expires_at?: string;
    }>;
  }): Promise<ApiResponse<{
    success_count: number;
    failed_count: number;
    failed_records: Array<{ identifier: string; reason: string }>;
  }>> => {
    return fetchApi('/whitelists/batch-import', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  /**
   * 更新白名单状态
   */
  updateStatus: (whitelistId: string, status: WhitelistStatus): Promise<ApiResponse<Whitelist>> => {
    return fetchApi(`/whitelists/${whitelistId}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status }),
    });
  },
  
  /**
   * 暂停白名单
   */
  suspendWhitelist: (whitelistId: string): Promise<ApiResponse<Whitelist>> => {
    return fetchApi(`/whitelists/${whitelistId}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status: 'suspended' }),
    });
  },
  
  /**
   * 激活白名单
   */
  activateWhitelist: (whitelistId: string): Promise<ApiResponse<Whitelist>> => {
    return fetchApi(`/whitelists/${whitelistId}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status: 'active' }),
    });
  },

  /**
   * 删除白名单记录
   */
  deleteWhitelist: (whitelistId: string): Promise<ApiResponse<null>> => {
    return fetchApi(`/whitelists/${whitelistId}`, {
      method: 'DELETE',
    });
  },

  /**
   * 批量删除白名单记录
   */
  batchDelete: (whitelistIds: string[]): Promise<ApiResponse<{
    success_count: number;
    failed_count: number;
  }>> => {
    return fetchApi('/whitelists/batch-delete', {
      method: 'POST',
      body: JSON.stringify({ ids: whitelistIds }),
    });
  },

  /**
   * 清理过期白名单记录
   */
  cleanupExpired: (): Promise<ApiResponse<{
    deleted_count: number;
  }>> => {
    return fetchApi('/whitelists/cleanup-expired', {
      method: 'POST',
    });
  },
};

// 导出所有API
export const platformApi = {
  overview: platformOverviewApi,
  factory: factoryApi,
  subscription: subscriptionApi,
  logs: operationLogApi,
  employee: employeeApi,
  whitelist: whitelistApi,
};

export default platformApi;
