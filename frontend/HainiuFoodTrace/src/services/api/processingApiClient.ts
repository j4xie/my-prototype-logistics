import { apiClient } from './apiClient';

// 生产批次接口
export interface ProcessingBatch {
  id: string;
  factoryId: string;
  batchNumber: string;
  productType: string;
  rawMaterials?: any;
  startDate: string;
  endDate?: string;
  status: 'planning' | 'in_progress' | 'quality_check' | 'completed' | 'failed';
  productionLine?: string;
  supervisorId?: number;
  targetQuantity?: number;
  actualQuantity?: number;
  qualityGrade?: 'A' | 'B' | 'C' | 'failed';
  notes?: string;
  createdAt: string;
}

// 质检记录接口
export interface QualityInspection {
  id: string;
  batchId: string;
  factoryId: string;
  inspectorId: number;
  inspectionType: 'raw_material' | 'process' | 'final_product';
  inspectionDate: string;
  testItems?: any;
  overallResult: 'pass' | 'fail' | 'conditional_pass';
  qualityScore?: number;
  defectDetails?: any;
  correctiveActions?: string;
  photos?: any;
  createdAt: string;
}

// 设备监控数据接口
export interface DeviceMonitoringData {
  id: string;
  equipmentId: string;
  factoryId: string;
  timestamp: string;
  metrics: any;
  status: 'normal' | 'warning' | 'error' | 'maintenance';
  alertTriggered: boolean;
  dataSource?: string;
  createdAt: string;
}

// 告警通知接口
export interface AlertNotification {
  id: string;
  factoryId: string;
  alertType: 'quality' | 'equipment' | 'production' | 'safety';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  message: string;
  sourceId?: string;
  sourceType?: string;
  assignedTo?: any;
  status: 'new' | 'acknowledged' | 'in_progress' | 'resolved' | 'closed';
  createdAt: string;
  resolvedAt?: string;
  resolvedBy?: number;
  resolutionNotes?: string;
}

// 设备信息接口
export interface Equipment {
  id: string;
  factoryId: string;
  equipmentCode: string;
  equipmentName: string;
  equipmentType?: string;
  department?: 'farming' | 'processing' | 'logistics' | 'quality' | 'management';
  status: 'active' | 'maintenance' | 'inactive';
  location?: string;
  specifications?: any;
  createdAt: string;
}

// 仪表板指标接口
export interface DashboardMetric {
  id: string;
  factoryId: string;
  metricType: string;
  metricDate: string;
  metricData: any;
  cacheExpiresAt: string;
  createdAt: string;
  updatedAt: string;
}

// API响应类型
export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  timestamp: Date;
}

/**
 * 加工模块API客户端
 * 完全匹配后端 /api/mobile/processing/* 路由结构
 */
class ProcessingApiClient {
  private readonly BASE_PATH = '/api/mobile/processing';

  // ==================== 批次CRUD操作 ====================
  
  /**
   * 创建新批次
   */
  async createBatch(batchData: {
    batchNumber: string;
    productType: string;
    rawMaterials?: any;
    startDate: string;
    productionLine?: string;
    supervisorId?: number;
    targetQuantity?: number;
    notes?: string;
  }): Promise<ApiResponse<ProcessingBatch>> {
    return await apiClient.post(`${this.BASE_PATH}/batches`, batchData);
  }

  /**
   * 查询批次列表 (支持分页、过滤)
   */
  async getBatches(params?: {
    page?: number;
    limit?: number;
    status?: ProcessingBatch['status'];
    productType?: string;
    startDate?: string;
    endDate?: string;
    supervisorId?: number;
  }): Promise<ApiResponse<{ batches: ProcessingBatch[]; total: number; page: number; limit: number }>> {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.set('page', params.page.toString());
    if (params?.limit) queryParams.set('limit', params.limit.toString());
    if (params?.status) queryParams.set('status', params.status);
    if (params?.productType) queryParams.set('productType', params.productType);
    if (params?.startDate) queryParams.set('startDate', params.startDate);
    if (params?.endDate) queryParams.set('endDate', params.endDate);
    if (params?.supervisorId) queryParams.set('supervisorId', params.supervisorId.toString());
    
    const url = queryParams.toString() ? `${this.BASE_PATH}/batches?${queryParams.toString()}` : `${this.BASE_PATH}/batches`;
    return await apiClient.get(url);
  }

  /**
   * 获取批次详情
   */
  async getBatchById(id: string): Promise<ApiResponse<ProcessingBatch>> {
    return await apiClient.get(`${this.BASE_PATH}/batches/${id}`);
  }

  /**
   * 更新批次信息
   */
  async updateBatch(id: string, updateData: Partial<ProcessingBatch>): Promise<ApiResponse<ProcessingBatch>> {
    return await apiClient.put(`${this.BASE_PATH}/batches/${id}`, updateData);
  }

  /**
   * 删除批次
   */
  async deleteBatch(id: string): Promise<ApiResponse<{ success: boolean; message: string }>> {
    return await apiClient.delete(`${this.BASE_PATH}/batches/${id}`);
  }

  // ==================== 批次流程操作 ====================
  
  /**
   * 开始生产
   */
  async startProduction(id: string, startData?: {
    actualStartDate?: string;
    initialParameters?: any;
    notes?: string;
  }): Promise<ApiResponse<ProcessingBatch>> {
    return await apiClient.post(`${this.BASE_PATH}/batches/${id}/start`, startData || {});
  }

  /**
   * 完成生产
   */
  async completeProduction(id: string, completionData: {
    endDate: string;
    actualQuantity?: number;
    qualityGrade?: ProcessingBatch['qualityGrade'];
    finalNotes?: string;
  }): Promise<ApiResponse<ProcessingBatch>> {
    return await apiClient.post(`${this.BASE_PATH}/batches/${id}/complete`, completionData);
  }

  /**
   * 暂停生产
   */
  async pauseProduction(id: string, pauseData?: {
    reason?: string;
    estimatedResumeTime?: string;
    notes?: string;
  }): Promise<ApiResponse<ProcessingBatch>> {
    return await apiClient.post(`${this.BASE_PATH}/batches/${id}/pause`, pauseData || {});
  }

  /**
   * 获取批次时间线
   */
  async getBatchTimeline(id: string): Promise<ApiResponse<{
    timeline: Array<{
      timestamp: string;
      event: string;
      description: string;
      userId?: number;
      data?: any;
    }>;
  }>> {
    return await apiClient.get(`${this.BASE_PATH}/batches/${id}/timeline`);
  }

  // ==================== 质检记录管理API ====================
  
  /**
   * 提交质检记录
   */
  async submitInspection(inspectionData: {
    batchId: string;
    inspectionType: QualityInspection['inspectionType'];
    inspectionDate: string;
    testItems?: any;
    overallResult: QualityInspection['overallResult'];
    qualityScore?: number;
    defectDetails?: any;
    correctiveActions?: string;
    photos?: any;
  }): Promise<ApiResponse<QualityInspection>> {
    return await apiClient.post(`${this.BASE_PATH}/quality/inspections`, inspectionData);
  }

  /**
   * 查询质检记录 (分页、过滤)
   */
  async getInspections(params?: {
    page?: number;
    limit?: number;
    batchId?: string;
    inspectionType?: QualityInspection['inspectionType'];
    overallResult?: QualityInspection['overallResult'];
    inspectorId?: number;
    startDate?: string;
    endDate?: string;
  }): Promise<ApiResponse<{ inspections: QualityInspection[]; total: number; page: number; limit: number }>> {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.set('page', params.page.toString());
    if (params?.limit) queryParams.set('limit', params.limit.toString());
    if (params?.batchId) queryParams.set('batchId', params.batchId);
    if (params?.inspectionType) queryParams.set('inspectionType', params.inspectionType);
    if (params?.overallResult) queryParams.set('overallResult', params.overallResult);
    if (params?.inspectorId) queryParams.set('inspectorId', params.inspectorId.toString());
    if (params?.startDate) queryParams.set('startDate', params.startDate);
    if (params?.endDate) queryParams.set('endDate', params.endDate);
    
    const url = queryParams.toString() ? `${this.BASE_PATH}/quality/inspections?${queryParams.toString()}` : `${this.BASE_PATH}/quality/inspections`;
    return await apiClient.get(url);
  }

  /**
   * 获取质检详情
   */
  async getInspectionById(id: string): Promise<ApiResponse<QualityInspection>> {
    return await apiClient.get(`${this.BASE_PATH}/quality/inspections/${id}`);
  }

  /**
   * 更新质检结果
   */
  async updateInspection(id: string, updateData: Partial<QualityInspection>): Promise<ApiResponse<QualityInspection>> {
    return await apiClient.put(`${this.BASE_PATH}/quality/inspections/${id}`, updateData);
  }

  /**
   * 质检统计数据
   */
  async getQualityStatistics(params?: {
    startDate?: string;
    endDate?: string;
    productType?: string;
  }): Promise<ApiResponse<{
    totalInspections: number;
    passRate: number;
    avgQualityScore: number;
    byResult: Record<string, number>;
    byType: Record<string, number>;
    trends: Array<{ date: string; passRate: number; avgScore: number }>;
  }>> {
    const queryParams = new URLSearchParams();
    if (params?.startDate) queryParams.set('startDate', params.startDate);
    if (params?.endDate) queryParams.set('endDate', params.endDate);
    if (params?.productType) queryParams.set('productType', params.productType);
    
    const url = queryParams.toString() ? `${this.BASE_PATH}/quality/statistics?${queryParams.toString()}` : `${this.BASE_PATH}/quality/statistics`;
    return await apiClient.get(url);
  }

  /**
   * 质量趋势分析
   */
  async getQualityTrends(params?: {
    period?: 'week' | 'month' | 'quarter';
    productType?: string;
  }): Promise<ApiResponse<{
    trends: Array<{
      period: string;
      totalInspections: number;
      passRate: number;
      avgScore: number;
      issues: Array<{ type: string; count: number }>;
    }>;
  }>> {
    const queryParams = new URLSearchParams();
    if (params?.period) queryParams.set('period', params.period);
    if (params?.productType) queryParams.set('productType', params.productType);
    
    const url = queryParams.toString() ? `${this.BASE_PATH}/quality/trends?${queryParams.toString()}` : `${this.BASE_PATH}/quality/trends`;
    return await apiClient.get(url);
  }

  // ==================== 设备监控管理API ====================
  
  /**
   * 获取设备实时状态列表
   */
  async getEquipmentMonitoring(params?: {
    department?: Equipment['department'];
    status?: DeviceMonitoringData['status'];
    equipmentType?: string;
  }): Promise<ApiResponse<{
    equipment: Array<{
      equipment: Equipment;
      latestData: DeviceMonitoringData;
      alertCount: number;
    }>;
    summary: {
      total: number;
      active: number;
      warning: number;
      error: number;
      maintenance: number;
    };
  }>> {
    const queryParams = new URLSearchParams();
    if (params?.department) queryParams.set('department', params.department);
    if (params?.status) queryParams.set('status', params.status);
    if (params?.equipmentType) queryParams.set('equipmentType', params.equipmentType);
    
    const url = queryParams.toString() ? `${this.BASE_PATH}/equipment/monitoring?${queryParams.toString()}` : `${this.BASE_PATH}/equipment/monitoring`;
    return await apiClient.get(url);
  }

  /**
   * 获取设备指标历史数据
   */
  async getEquipmentMetrics(id: string, params?: {
    startTime?: string;
    endTime?: string;
    metrics?: string[];
    interval?: 'minute' | 'hour' | 'day';
  }): Promise<ApiResponse<{
    equipment: Equipment;
    metrics: Array<{
      timestamp: string;
      metrics: any;
      status: DeviceMonitoringData['status'];
    }>;
    summary: {
      avgMetrics: any;
      statusDistribution: Record<string, number>;
      alertsCount: number;
    };
  }>> {
    const queryParams = new URLSearchParams();
    if (params?.startTime) queryParams.set('startTime', params.startTime);
    if (params?.endTime) queryParams.set('endTime', params.endTime);
    if (params?.metrics) queryParams.set('metrics', params.metrics.join(','));
    if (params?.interval) queryParams.set('interval', params.interval);
    
    const url = queryParams.toString() ? `${this.BASE_PATH}/equipment/${id}/metrics?${queryParams.toString()}` : `${this.BASE_PATH}/equipment/${id}/metrics`;
    return await apiClient.get(url);
  }

  /**
   * 上报设备监控数据
   */
  async reportEquipmentData(id: string, data: {
    metrics: any;
    status?: DeviceMonitoringData['status'];
    dataSource?: string;
    timestamp?: string;
  }): Promise<ApiResponse<DeviceMonitoringData>> {
    return await apiClient.post(`${this.BASE_PATH}/equipment/${id}/data`, data);
  }

  /**
   * 获取设备告警列表
   */
  async getEquipmentAlerts(params?: {
    page?: number;
    limit?: number;
    equipmentId?: string;
    severity?: AlertNotification['severity'];
    status?: AlertNotification['status'];
  }): Promise<ApiResponse<{ alerts: AlertNotification[]; total: number; page: number; limit: number }>> {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.set('page', params.page.toString());
    if (params?.limit) queryParams.set('limit', params.limit.toString());
    if (params?.equipmentId) queryParams.set('equipmentId', params.equipmentId);
    if (params?.severity) queryParams.set('severity', params.severity);
    if (params?.status) queryParams.set('status', params.status);
    
    const url = queryParams.toString() ? `${this.BASE_PATH}/equipment/alerts?${queryParams.toString()}` : `${this.BASE_PATH}/equipment/alerts`;
    return await apiClient.get(url);
  }

  /**
   * 获取单个设备状态
   */
  async getEquipmentStatus(id: string): Promise<ApiResponse<{
    equipment: Equipment;
    latestData: DeviceMonitoringData;
    status: string;
    uptime: number;
    lastMaintenance?: string;
    nextMaintenance?: string;
    activeAlerts: AlertNotification[];
    recentMetrics: DeviceMonitoringData[];
  }>> {
    return await apiClient.get(`${this.BASE_PATH}/equipment/${id}/status`);
  }

  // ==================== 仪表板API ====================
  
  /**
   * 生产概览数据
   */
  async getDashboardOverview(): Promise<ApiResponse<{
    production: {
      activeBatches: number;
      completedToday: number;
      totalOutput: number;
      efficiency: number;
    };
    quality: {
      passRate: number;
      avgScore: number;
      inspectionsToday: number;
    };
    equipment: {
      totalEquipment: number;
      activeEquipment: number;
      alertsCount: number;
    };
    alerts: {
      total: number;
      critical: number;
      unresolved: number;
    };
  }>> {
    return await apiClient.get(`${this.BASE_PATH}/dashboard/overview`);
  }

  /**
   * 生产统计 (今日、本周、本月)
   */
  async getProductionStatistics(period?: 'today' | 'week' | 'month'): Promise<ApiResponse<{
    period: string;
    batches: {
      total: number;
      completed: number;
      inProgress: number;
      failed: number;
    };
    output: {
      target: number;
      actual: number;
      efficiency: number;
    };
    trends: Array<{
      date: string;
      completed: number;
      output: number;
    }>;
  }>> {
    const url = period ? `${this.BASE_PATH}/dashboard/production?period=${period}` : `${this.BASE_PATH}/dashboard/production`;
    return await apiClient.get(url);
  }

  /**
   * 质量统计和趋势
   */
  async getQualityDashboard(): Promise<ApiResponse<{
    overview: {
      totalInspections: number;
      passRate: number;
      avgScore: number;
    };
    byType: Record<string, { total: number; passRate: number }>;
    trends: Array<{
      date: string;
      inspections: number;
      passRate: number;
      avgScore: number;
    }>;
    issues: Array<{
      type: string;
      count: number;
      trend: 'up' | 'down' | 'stable';
    }>;
  }>> {
    return await apiClient.get(`${this.BASE_PATH}/dashboard/quality`);
  }

  /**
   * 设备状态统计
   */
  async getEquipmentDashboard(): Promise<ApiResponse<{
    summary: {
      total: number;
      active: number;
      maintenance: number;
      offline: number;
    };
    byDepartment: Record<string, { total: number; active: number; alerts: number }>;
    alerts: {
      total: number;
      critical: number;
      warning: number;
    };
    uptime: {
      average: number;
      byEquipment: Array<{ id: string; name: string; uptime: number }>;
    };
  }>> {
    return await apiClient.get(`${this.BASE_PATH}/dashboard/equipment`);
  }

  /**
   * 告警统计和分布
   */
  async getAlertsDashboard(): Promise<ApiResponse<{
    summary: {
      total: number;
      new: number;
      acknowledged: number;
      resolved: number;
    };
    bySeverity: Record<string, number>;
    byType: Record<string, number>;
    trends: Array<{
      date: string;
      total: number;
      resolved: number;
    }>;
    responseTime: {
      average: number;
      byType: Record<string, number>;
    };
  }>> {
    return await apiClient.get(`${this.BASE_PATH}/dashboard/alerts`);
  }

  /**
   * 关键指标趋势分析
   */
  async getTrendAnalysis(params?: {
    period?: 'week' | 'month' | 'quarter';
    metrics?: string[];
  }): Promise<ApiResponse<{
    period: string;
    trends: {
      production: Array<{ date: string; completed: number; efficiency: number }>;
      quality: Array<{ date: string; passRate: number; avgScore: number }>;
      equipment: Array<{ date: string; uptime: number; alertsCount: number }>;
    };
    insights: Array<{
      metric: string;
      trend: 'up' | 'down' | 'stable';
      change: number;
      description: string;
    }>;
  }>> {
    const queryParams = new URLSearchParams();
    if (params?.period) queryParams.set('period', params.period);
    if (params?.metrics) queryParams.set('metrics', params.metrics.join(','));
    
    const url = queryParams.toString() ? `${this.BASE_PATH}/dashboard/trends?${queryParams.toString()}` : `${this.BASE_PATH}/dashboard/trends`;
    return await apiClient.get(url);
  }

  // ==================== 告警管理API ====================
  
  /**
   * 获取告警列表 (分页、过滤、排序)
   */
  async getAlerts(params?: {
    page?: number;
    limit?: number;
    severity?: AlertNotification['severity'];
    status?: AlertNotification['status'];
    alertType?: AlertNotification['alertType'];
    startDate?: string;
    endDate?: string;
    sortBy?: 'createdAt' | 'severity' | 'status';
    sortOrder?: 'asc' | 'desc';
  }): Promise<ApiResponse<{ alerts: AlertNotification[]; total: number; page: number; limit: number }>> {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.set('page', params.page.toString());
    if (params?.limit) queryParams.set('limit', params.limit.toString());
    if (params?.severity) queryParams.set('severity', params.severity);
    if (params?.status) queryParams.set('status', params.status);
    if (params?.alertType) queryParams.set('alertType', params.alertType);
    if (params?.startDate) queryParams.set('startDate', params.startDate);
    if (params?.endDate) queryParams.set('endDate', params.endDate);
    if (params?.sortBy) queryParams.set('sortBy', params.sortBy);
    if (params?.sortOrder) queryParams.set('sortOrder', params.sortOrder);
    
    const url = queryParams.toString() ? `${this.BASE_PATH}/alerts?${queryParams.toString()}` : `${this.BASE_PATH}/alerts`;
    return await apiClient.get(url);
  }

  /**
   * 确认告警
   */
  async acknowledgeAlert(id: string, notes?: string): Promise<ApiResponse<AlertNotification>> {
    return await apiClient.post(`${this.BASE_PATH}/alerts/${id}/acknowledge`, { notes });
  }

  /**
   * 解决告警
   */
  async resolveAlert(id: string, resolutionData: {
    resolutionNotes: string;
    correctiveActions?: string;
  }): Promise<ApiResponse<AlertNotification>> {
    return await apiClient.post(`${this.BASE_PATH}/alerts/${id}/resolve`, resolutionData);
  }

  /**
   * 告警统计数据
   */
  async getAlertStatistics(params?: {
    startDate?: string;
    endDate?: string;
    groupBy?: 'severity' | 'type' | 'status';
  }): Promise<ApiResponse<{
    total: number;
    byStatus: Record<string, number>;
    bySeverity: Record<string, number>;
    byType: Record<string, number>;
    responseTime: {
      average: number;
      median: number;
      byPriority: Record<string, number>;
    };
    trends: Array<{ date: string; count: number; resolved: number }>;
  }>> {
    const queryParams = new URLSearchParams();
    if (params?.startDate) queryParams.set('startDate', params.startDate);
    if (params?.endDate) queryParams.set('endDate', params.endDate);
    if (params?.groupBy) queryParams.set('groupBy', params.groupBy);
    
    const url = queryParams.toString() ? `${this.BASE_PATH}/alerts/statistics?${queryParams.toString()}` : `${this.BASE_PATH}/alerts/statistics`;
    return await apiClient.get(url);
  }

  /**
   * 告警摘要 (按严重级别)
   */
  async getAlertsSummary(): Promise<ApiResponse<{
    critical: { count: number; latest?: AlertNotification };
    high: { count: number; latest?: AlertNotification };
    medium: { count: number; latest?: AlertNotification };
    low: { count: number; latest?: AlertNotification };
    totalUnresolved: number;
    avgResponseTime: number;
  }>> {
    return await apiClient.get(`${this.BASE_PATH}/alerts/summary`);
  }

  // ==================== 文件上传相关 ====================
  
  /**
   * 上传加工相关照片 (复用移动端上传系统)
   */
  async uploadProcessingPhotos(files: File[] | any[], metadata: {
    recordId: string;
    recordType: 'processing' | 'work_record' | 'quality_check' | 'production';
    description?: string;
    [key: string]: any;
  }): Promise<ApiResponse<{ urls: string[]; fileIds: string[] }>> {
    const formData = new FormData();
    
    files.forEach((file, index) => {
      formData.append(`files`, file);
    });
    
    formData.append('metadata', JSON.stringify(metadata));

    return await apiClient.post('/api/mobile/upload/mobile', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  }
}

export const processingApiClient = new ProcessingApiClient();