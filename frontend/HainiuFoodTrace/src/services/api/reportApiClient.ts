import { apiClient } from './apiClient';

// 报表模板接口类型
export interface ReportTemplate {
  id: string;
  name: string;
  description?: string;
  type: 'excel' | 'pdf';
  category: 'production' | 'quality' | 'equipment' | 'alerts' | 'custom';
  templateConfig: {
    columns?: string[];
    filters?: any[];
    dateRange?: boolean;
    groupBy?: string[];
    aggregations?: any[];
  };
  isActive: boolean;
  createdBy: number;
  createdAt: string;
  updatedAt: string;
}

// 报表生成请求接口
export interface ReportGenerateRequest {
  templateId?: string;
  type: 'excel' | 'pdf';
  name: string;
  description?: string;
  dataSource: 'batches' | 'quality' | 'equipment' | 'alerts' | 'users';
  filters?: {
    startDate?: string;
    endDate?: string;
    factoryId?: string;
    userId?: number;
    status?: string[];
    severity?: string[];
    batchIds?: string[];
    equipmentIds?: string[];
  };
  columns?: string[];
  groupBy?: string[];
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  includeCharts?: boolean;
  customConfig?: any;
}

// 报表文件信息接口
export interface ReportFile {
  id: string;
  filename: string;
  originalName: string;
  type: 'excel' | 'pdf';
  size: number;
  status: 'generating' | 'completed' | 'failed';
  downloadUrl?: string;
  expiresAt?: string;
  generatedAt: string;
  error?: string;
}

// API响应类型
export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  timestamp: string;
}

/**
 * 报表系统API客户端
 * 完全对接后端 /api/mobile/reports/* API
 */
export class ReportApiClient {
  private readonly BASE_PATH = '/api/mobile/reports';

  /**
   * 获取报表模板列表
   */
  async getReportTemplates(params?: {
    category?: ReportTemplate['category'];
    type?: ReportTemplate['type'];
    isActive?: boolean;
  }): Promise<ApiResponse<{
    templates: ReportTemplate[];
    total: number;
  }>> {
    try {
      console.log('获取报表模板列表:', params);

      const queryParams = new URLSearchParams();
      if (params?.category) queryParams.set('category', params.category);
      if (params?.type) queryParams.set('type', params.type);
      if (params?.isActive !== undefined) queryParams.set('isActive', params.isActive.toString());

      const url = queryParams.toString() 
        ? `${this.BASE_PATH}/templates?${queryParams.toString()}` 
        : `${this.BASE_PATH}/templates`;

      const response = await apiClient.get<ApiResponse<{
        templates: ReportTemplate[];
        total: number;
      }>>(url);

      console.log('报表模板列表获取成功:', response);
      return response;
    } catch (error) {
      console.error('获取报表模板列表失败:', error);
      throw error;
    }
  }

  /**
   * 创建自定义报表模板
   */
  async createReportTemplate(templateData: {
    name: string;
    description?: string;
    type: ReportTemplate['type'];
    category: ReportTemplate['category'];
    templateConfig: ReportTemplate['templateConfig'];
  }): Promise<ApiResponse<ReportTemplate>> {
    try {
      console.log('创建报表模板:', templateData);

      const response = await apiClient.post<ApiResponse<ReportTemplate>>(
        `${this.BASE_PATH}/templates`,
        templateData
      );

      console.log('报表模板创建成功:', response);
      return response;
    } catch (error) {
      console.error('创建报表模板失败:', error);
      throw error;
    }
  }

  /**
   * 生成Excel报表
   */
  async generateExcelReport(reportData: ReportGenerateRequest): Promise<ApiResponse<ReportFile>> {
    try {
      console.log('生成Excel报表:', reportData);

      const response = await apiClient.post<ApiResponse<ReportFile>>(
        `${this.BASE_PATH}/generate/excel`,
        { ...reportData, type: 'excel' }
      );

      console.log('Excel报表生成成功:', response);
      return response;
    } catch (error) {
      console.error('生成Excel报表失败:', error);
      throw error;
    }
  }

  /**
   * 生成PDF报表
   */
  async generatePDFReport(reportData: ReportGenerateRequest): Promise<ApiResponse<ReportFile>> {
    try {
      console.log('生成PDF报表:', reportData);

      const response = await apiClient.post<ApiResponse<ReportFile>>(
        `${this.BASE_PATH}/generate/pdf`,
        { ...reportData, type: 'pdf' }
      );

      console.log('PDF报表生成成功:', response);
      return response;
    } catch (error) {
      console.error('生成PDF报表失败:', error);
      throw error;
    }
  }

  /**
   * 下载报表文件
   */
  async downloadReport(filename: string): Promise<ApiResponse<{
    url: string;
    filename: string;
    size: number;
    contentType: string;
  }>> {
    try {
      console.log('下载报表文件:', filename);

      const response = await apiClient.get<ApiResponse<{
        url: string;
        filename: string;
        size: number;
        contentType: string;
      }>>(`${this.BASE_PATH}/download/${filename}`);

      console.log('报表下载链接获取成功:', response);
      return response;
    } catch (error) {
      console.error('获取报表下载链接失败:', error);
      throw error;
    }
  }

  /**
   * 获取报表生成历史
   */
  async getReportHistory(params?: {
    page?: number;
    limit?: number;
    type?: ReportFile['type'];
    status?: ReportFile['status'];
    startDate?: string;
    endDate?: string;
  }): Promise<ApiResponse<{
    reports: ReportFile[];
    total: number;
    page: number;
    limit: number;
  }>> {
    try {
      console.log('获取报表历史:', params);

      const queryParams = new URLSearchParams();
      if (params?.page) queryParams.set('page', params.page.toString());
      if (params?.limit) queryParams.set('limit', params.limit.toString());
      if (params?.type) queryParams.set('type', params.type);
      if (params?.status) queryParams.set('status', params.status);
      if (params?.startDate) queryParams.set('startDate', params.startDate);
      if (params?.endDate) queryParams.set('endDate', params.endDate);

      const url = queryParams.toString() 
        ? `${this.BASE_PATH}/history?${queryParams.toString()}` 
        : `${this.BASE_PATH}/history`;

      const response = await apiClient.get<ApiResponse<{
        reports: ReportFile[];
        total: number;
        page: number;
        limit: number;
      }>>(url);

      console.log('报表历史获取成功:', response);
      return response;
    } catch (error) {
      console.error('获取报表历史失败:', error);
      throw error;
    }
  }

  /**
   * 删除报表文件
   */
  async deleteReport(filename: string): Promise<ApiResponse<{
    success: boolean;
    message: string;
  }>> {
    try {
      console.log('删除报表文件:', filename);

      const response = await apiClient.delete<ApiResponse<{
        success: boolean;
        message: string;
      }>>(`${this.BASE_PATH}/files/${filename}`);

      console.log('报表文件删除成功:', response);
      return response;
    } catch (error) {
      console.error('删除报表文件失败:', error);
      throw error;
    }
  }

  /**
   * 获取报表生成状态
   */
  async getReportStatus(reportId: string): Promise<ApiResponse<ReportFile>> {
    try {
      console.log('获取报表状态:', reportId);

      const response = await apiClient.get<ApiResponse<ReportFile>>(
        `${this.BASE_PATH}/status/${reportId}`
      );

      console.log('报表状态获取成功:', response);
      return response;
    } catch (error) {
      console.error('获取报表状态失败:', error);
      throw error;
    }
  }

  /**
   * 获取可用的数据源和字段
   */
  async getDataSourceFields(dataSource: ReportGenerateRequest['dataSource']): Promise<ApiResponse<{
    dataSource: string;
    fields: Array<{
      key: string;
      label: string;
      type: 'string' | 'number' | 'date' | 'boolean';
      filterable: boolean;
      sortable: boolean;
    }>;
    filters: Array<{
      key: string;
      label: string;
      type: 'select' | 'date' | 'text' | 'number';
      options?: Array<{ value: string; label: string }>;
    }>;
  }>> {
    try {
      console.log('获取数据源字段:', dataSource);

      const response = await apiClient.get<ApiResponse<{
        dataSource: string;
        fields: Array<{
          key: string;
          label: string;
          type: 'string' | 'number' | 'date' | 'boolean';
          filterable: boolean;
          sortable: boolean;
        }>;
        filters: Array<{
          key: string;
          label: string;
          type: 'select' | 'date' | 'text' | 'number';
          options?: Array<{ value: string; label: string }>;
        }>;
      }>>(`${this.BASE_PATH}/data-sources/${dataSource}/fields`);

      console.log('数据源字段获取成功:', response);
      return response;
    } catch (error) {
      console.error('获取数据源字段失败:', error);
      throw error;
    }
  }

  /**
   * 预览报表数据
   */
  async previewReportData(reportData: Partial<ReportGenerateRequest>): Promise<ApiResponse<{
    headers: string[];
    rows: any[][];
    total: number;
    preview: boolean;
  }>> {
    try {
      console.log('预览报表数据:', reportData);

      const response = await apiClient.post<ApiResponse<{
        headers: string[];
        rows: any[][];
        total: number;
        preview: boolean;
      }>>(`${this.BASE_PATH}/preview`, reportData);

      console.log('报表数据预览成功:', response);
      return response;
    } catch (error) {
      console.error('预览报表数据失败:', error);
      throw error;
    }
  }
}

// 导出单例实例
export const reportApiClient = new ReportApiClient();