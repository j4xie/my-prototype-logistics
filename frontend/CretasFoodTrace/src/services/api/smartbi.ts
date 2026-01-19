/**
 * SmartBI API Client
 * 智能商业分析 API 调用
 *
 * 注意：所有方法都需要 factoryId
 * - 工厂用户：自动从登录信息获取
 * - 平台管理员：必须显式提供 factoryId 参数
 */

import { apiClient } from './apiClient';
import { requireFactoryId } from '../../utils/factoryIdHelper';
import type {
  AnalysisParams,
  DashboardResponse,
  ExecutiveDashboardData,
  NLQueryRequest,
  NLQueryResponse,
  DrillDownRequest,
  DrillDownResponse,
  SmartBIAlert,
  Recommendation,
  IncentivePlan,
  ExcelUploadRequest,
  ExcelUploadResponse,
  SalesAnalysisResponse,
  DepartmentAnalysisResponse,
  RegionAnalysisResponse,
  FinanceAnalysisResponse,
} from '../../types/smartbi';

/**
 * 标准 API 响应格式
 */
interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

/**
 * SmartBI API Client
 */
export const smartBIApi = {
  // ==================== Excel 上传 ====================

  /**
   * 上传 Excel 文件
   * @param request - 上传请求参数（包含文件、数据类型、factoryId）
   */
  uploadExcel: async (
    request: ExcelUploadRequest
  ): Promise<ApiResponse<ExcelUploadResponse>> => {
    const currentFactoryId = requireFactoryId(request.factoryId);

    // 创建 FormData
    const formData = new FormData();
    formData.append('file', {
      uri: request.file.uri,
      name: request.file.name,
      type: request.file.mimeType || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    } as unknown as Blob);
    formData.append('dataType', request.dataType);

    return apiClient.post<ApiResponse<ExcelUploadResponse>>(
      `/api/mobile/${currentFactoryId}/smart-bi/upload`,
      formData,
      {
        headers: { 'Content-Type': 'multipart/form-data' },
      }
    );
  },

  // ==================== 经营驾驶舱 ====================

  /**
   * 时间周期类型（前端使用）
   */
  // 'today' 会映射到 'day' 发送给后端

  /**
   * 获取经营驾驶舱数据
   * @param period - 时间周期: today, day, week, month, quarter, year
   * @param factoryId - 工厂ID（可选，工厂用户自动获取；平台管理员必须提供）
   */
  getExecutiveDashboard: async (
    period: 'today' | 'day' | 'week' | 'month' | 'quarter' | 'year' = 'month',
    factoryId?: string
  ): Promise<ApiResponse<ExecutiveDashboardData>> => {
    const currentFactoryId = requireFactoryId(factoryId);
    // 'today' 映射为 'day'
    const apiPeriod = period === 'today' ? 'day' : period;
    return apiClient.get<ApiResponse<ExecutiveDashboardData>>(
      `/api/mobile/${currentFactoryId}/smart-bi/dashboard/executive`,
      {
        params: { period: apiPeriod },
      }
    );
  },

  // ==================== 销售分析 ====================

  /**
   * 获取销售分析数据
   * @param params - 分析参数（可包含 factoryId）
   */
  getSalesAnalysis: async (
    params: AnalysisParams
  ): Promise<ApiResponse<SalesAnalysisResponse>> => {
    const { factoryId, ...queryParams } = params;
    const currentFactoryId = requireFactoryId(factoryId);
    return apiClient.get<ApiResponse<SalesAnalysisResponse>>(
      `/api/mobile/${currentFactoryId}/smart-bi/analysis/sales`,
      { params: queryParams }
    );
  },

  // ==================== 部门分析 ====================

  /**
   * 获取部门分析数据
   * @param params - 分析参数（可包含 factoryId）
   */
  getDepartmentAnalysis: async (
    params: AnalysisParams
  ): Promise<ApiResponse<DepartmentAnalysisResponse>> => {
    const { factoryId, ...queryParams } = params;
    const currentFactoryId = requireFactoryId(factoryId);
    return apiClient.get<ApiResponse<DepartmentAnalysisResponse>>(
      `/api/mobile/${currentFactoryId}/smart-bi/analysis/department`,
      { params: queryParams }
    );
  },

  // ==================== 区域分析 ====================

  /**
   * 获取区域分析数据
   * @param params - 分析参数（可包含 factoryId）
   */
  getRegionAnalysis: async (
    params: AnalysisParams
  ): Promise<ApiResponse<RegionAnalysisResponse>> => {
    const { factoryId, ...queryParams } = params;
    const currentFactoryId = requireFactoryId(factoryId);
    return apiClient.get<ApiResponse<RegionAnalysisResponse>>(
      `/api/mobile/${currentFactoryId}/smart-bi/analysis/region`,
      { params: queryParams }
    );
  },

  // ==================== 财务分析 ====================

  /**
   * 获取财务分析数据
   * @param params - 分析参数（可包含 factoryId、analysisType）
   */
  getFinanceAnalysis: async (
    params: AnalysisParams
  ): Promise<ApiResponse<FinanceAnalysisResponse>> => {
    const { factoryId, ...queryParams } = params;
    const currentFactoryId = requireFactoryId(factoryId);
    return apiClient.get<ApiResponse<FinanceAnalysisResponse>>(
      `/api/mobile/${currentFactoryId}/smart-bi/analysis/finance`,
      { params: queryParams }
    );
  },

  // ==================== 自然语言问答 ====================

  /**
   * 自然语言查询
   * @param request - 查询请求（可包含 factoryId）
   */
  query: async (
    request: NLQueryRequest
  ): Promise<ApiResponse<NLQueryResponse>> => {
    const { factoryId, ...queryBody } = request;
    const currentFactoryId = requireFactoryId(factoryId);
    return apiClient.post<ApiResponse<NLQueryResponse>>(
      `/api/mobile/${currentFactoryId}/smart-bi/query`,
      queryBody
    );
  },

  // ==================== 数据下钻 ====================

  /**
   * 数据下钻
   * @param request - 下钻请求
   * @param factoryId - 工厂ID（可选，工厂用户自动获取；平台管理员必须提供）
   */
  drillDown: async (
    request: DrillDownRequest,
    factoryId?: string
  ): Promise<ApiResponse<DrillDownResponse>> => {
    const currentFactoryId = requireFactoryId(factoryId);
    return apiClient.post<ApiResponse<DrillDownResponse>>(
      `/api/mobile/${currentFactoryId}/smart-bi/drill-down`,
      request
    );
  },

  // ==================== 预警管理 ====================

  /**
   * 获取预警列表
   * @param category - 预警类别（可选）
   * @param factoryId - 工厂ID（可选，工厂用户自动获取；平台管理员必须提供）
   */
  getAlerts: async (
    category?: string,
    factoryId?: string
  ): Promise<ApiResponse<SmartBIAlert[]>> => {
    const currentFactoryId = requireFactoryId(factoryId);
    return apiClient.get<ApiResponse<SmartBIAlert[]>>(
      `/api/mobile/${currentFactoryId}/smart-bi/alerts`,
      {
        params: category ? { category } : undefined,
      }
    );
  },

  // ==================== 建议管理 ====================

  /**
   * 获取建议列表
   * @param analysisType - 分析类型（可选）
   * @param factoryId - 工厂ID（可选，工厂用户自动获取；平台管理员必须提供）
   */
  getRecommendations: async (
    analysisType?: string,
    factoryId?: string
  ): Promise<ApiResponse<Recommendation[]>> => {
    const currentFactoryId = requireFactoryId(factoryId);
    return apiClient.get<ApiResponse<Recommendation[]>>(
      `/api/mobile/${currentFactoryId}/smart-bi/recommendations`,
      {
        params: analysisType ? { analysisType } : undefined,
      }
    );
  },

  // ==================== 激励方案 ====================

  /**
   * 获取激励方案
   * @param targetType - 目标类型: department, employee, region
   * @param targetId - 目标ID
   * @param factoryId - 工厂ID（可选，工厂用户自动获取；平台管理员必须提供）
   */
  getIncentivePlan: async (
    targetType: 'department' | 'employee' | 'region',
    targetId: string,
    factoryId?: string
  ): Promise<ApiResponse<IncentivePlan>> => {
    const currentFactoryId = requireFactoryId(factoryId);
    return apiClient.get<ApiResponse<IncentivePlan>>(
      `/api/mobile/${currentFactoryId}/smart-bi/incentive-plan/${targetType}/${targetId}`
    );
  },
};

// 别名导出，兼容旧代码
export const smartBIApiClient = smartBIApi;

export default smartBIApi;
