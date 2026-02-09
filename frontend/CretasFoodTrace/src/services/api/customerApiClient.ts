import { apiClient } from './apiClient';
import { getCurrentFactoryId } from '../../utils/factoryIdHelper';

/**
 * 客户管理API客户端 - MVP精简版
 * MVP保留：8个核心API（基础CRUD +活跃列表+搜索+状态切换）
 * 已移除：16个高级API（财务管理、评级系统、统计分析、导入导出等）
 * 路径：/api/mobile/{factoryId}/customers/*
 *
 * 业务场景：管理客户基本信息，用于生产计划选择目标客户
 */

// ========== 类型定义 ==========

export interface Customer {
  id: string;
  factoryId: string;
  customerCode: string;
  code: string; // 别名，指向customerCode
  name: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
  shippingAddress?: string;
  businessType?: string;
  customerType?: string;
  industry?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface CreateCustomerRequest {
  customerCode: string;
  name: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
  shippingAddress?: string;
  businessType?: string;
  customerType?: string;
  industry?: string;
}

export interface PageResponse<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  size: number;
  number: number;
}

// ========== API客户端类 ==========

class CustomerApiClient {
  private getPath(factoryId?: string) {
    const currentFactoryId = getCurrentFactoryId(factoryId);
    if (!currentFactoryId) {
      throw new Error('factoryId 是必需的，请先登录或提供 factoryId 参数');
    }
    return `/api/mobile/${currentFactoryId}/customers`;
  }

  /**
   * 1. 获取客户列表（分页）
   * GET /api/mobile/{factoryId}/customers
   */
  async getCustomers(params?: {
    factoryId?: string;
    page?: number;
    size?: number;
    sortBy?: string;
    sortDirection?: 'ASC' | 'DESC';
    keyword?: string;
    isActive?: boolean;
  }): Promise<{data: Customer[]}> {
    const { factoryId, ...queryParams } = params || {};
    // apiClient拦截器已统一返回data
    const apiResponse = await apiClient.get<any>(
      `${this.getPath(factoryId)}`,
      { params: queryParams }
    );

    // 处理后端返回的多层嵌套结构
    // 后端返回: { code: 200, data: { content: [...], totalElements, ... }, success: true, message: ... }
    if (apiResponse.data && apiResponse.data.content) {
      // 标准格式：response.data.content 是分页数据
      return { data: apiResponse.data.content };
    } else if (apiResponse.content) {
      // 兼容格式1：response.content 直接是数组
      return { data: apiResponse.content };
    } else if (Array.isArray(apiResponse.data)) {
      // 兼容格式2：response.data 直接是数组
      return { data: apiResponse.data };
    } else if (Array.isArray(apiResponse)) {
      // 兼容格式3：response 直接是数组
      return { data: apiResponse };
    }

    // 如果都不匹配，返回空数组
    console.warn('[CustomerApiClient] 未知的响应格式:', apiResponse);
    return { data: [] };
  }

  /**
   * 2. 创建客户
   * POST /api/mobile/{factoryId}/customers
   */
  async createCustomer(
    request: CreateCustomerRequest,
    factoryId?: string
  ): Promise<{data: Customer}> {
    const response = await apiClient.post<{ code: number; data: Customer; message: string; success: boolean }>(
      `${this.getPath(factoryId)}`,
      request
    );
    return { data: response.data };
  }

  /**
   * 3. 获取客户详情
   * GET /api/mobile/{factoryId}/customers/{customerId}
   */
  async getCustomerById(customerId: string, factoryId?: string): Promise<Customer> {
    const response = await apiClient.get<{ code: number; data: Customer; message: string; success: boolean }>(
      `${this.getPath(factoryId)}/${customerId}`
    );
    return response.data;
  }

  /**
   * 4. 更新客户
   * PUT /api/mobile/{factoryId}/customers/{customerId}
   */
  async updateCustomer(
    customerId: string,
    request: Partial<CreateCustomerRequest>,
    factoryId?: string
  ): Promise<Customer> {
    const response = await apiClient.put<{ code: number; data: Customer; message: string; success: boolean }>(
      `${this.getPath(factoryId)}/${customerId}`,
      request
    );
    return response.data;
  }

  /**
   * 5. 删除客户
   * DELETE /api/mobile/{factoryId}/customers/{customerId}
   */
  async deleteCustomer(customerId: string, factoryId?: string): Promise<void> {
    await apiClient.delete(`${this.getPath(factoryId)}/${customerId}`);
  }

  /**
   * 6. 获取活跃客户列表
   * GET /api/mobile/{factoryId}/customers/active
   */
  async getActiveCustomers(factoryId?: string): Promise<Customer[]> {
    const response = await apiClient.get<{ code: number; data: Customer[]; message: string; success: boolean }>(
      `${this.getPath(factoryId)}/active`
    );
    return response.data || [];
  }

  /**
   * 7. 搜索客户
   * GET /api/mobile/{factoryId}/customers/search
   */
  async searchCustomers(params: {
    keyword: string;
    factoryId?: string;
    customerType?: string;
    industry?: string;
    isActive?: boolean;
  }): Promise<Customer[]> {
    const { factoryId, ...queryParams } = params;
    const response = await apiClient.get<{ code: number; data: Customer[]; message: string; success: boolean }>(
      `${this.getPath(factoryId)}/search`,
      { params: queryParams }
    );
    return response.data || [];
  }

  /**
   * 8. 切换客户状态
   * PUT /api/mobile/{factoryId}/customers/{customerId}/status
   */
  async toggleCustomerStatus(
    customerId: string,
    isActive: boolean,
    factoryId?: string
  ): Promise<Customer> {
    const response = await apiClient.put<{ code: number; data: Customer; message: string; success: boolean }>(
      `${this.getPath(factoryId)}/${customerId}/status`,
      {},
      { params: { isActive: isActive } }
    );
    return response.data;
  }

  // ===== 以下方法在MVP中暂不使用，已注释保留供后续版本使用 =====

  /*
   * MVP暂不使用的功能（16个方法）：
   *
   * 财务管理相关（4个）：
   * - updateCreditLimit: 更新信用额度（MVP无财务功能）
   * - updateBalance: 更新余额（MVP无财务功能）
   * - getCustomersWithOutstandingBalance: 获取欠款客户（MVP无财务功能）
   * - getCustomerPurchaseHistory: 购买历史（MVP暂不需要）
   *
   * 评级系统相关（3个）：
   * - updateCustomerRating: 更新评级（MVP无评级系统）
   * - getVipCustomers: VIP客户（MVP无评级系统）
   * - getRatingDistribution: 评级分布（统计功能）
   *
   * 统计分析相关（4个）：
   * - getCustomerStatistics: 客户统计（后期添加）
   * - getOverallStatistics: 总体统计（后期添加）
   * - getTypeDistribution: 类型分布（后期添加）
   * - getIndustryDistribution: 行业分布（后期添加）
   *
   * 筛选查询相关（3个）：
   * - getCustomersByType: 按类型筛选（可用search或列表API筛选）
   * - getCustomersByIndustry: 按行业筛选（可用search或列表API筛选）
   * - checkCustomerCodeExists: 代码检查（前端可验证）
   *
   * 批量操作相关（2个）：
   * - exportCustomers: 导出（MVP数据量小）
   * - importCustomers: 导入（MVP数据量小，手动添加）
   *
   * 如需使用这些功能，请查看Git历史或参考完整版API文档
   */
}

export const customerApiClient = new CustomerApiClient();
export default customerApiClient;
