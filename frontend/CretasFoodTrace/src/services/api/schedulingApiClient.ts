import { apiClient } from './apiClient';
import { requireFactoryId } from '../../utils/factoryIdHelper';
import type {
  SchedulingPlan,
  LineSchedule,
  WorkerAssignment,
  SchedulingAlert,
  SchedulingDashboard,
  PagedResponse,
  DispatcherEmployee,
  InsertSlot,
  MixedBatchGroup,
  MixedBatchRule,
  CreateScheduleRequest,
  AssignWorkersRequest,
  GetInsertSlotsRequest,
  ConfirmInsertRequest,
  DetectMixedBatchRequest,
} from '../../types/dispatcher';

/**
 * 调度管理API客户端
 * 路径：/api/mobile/{factoryId}/scheduling/*
 *
 * 核心功能：31个端点
 * - 调度计划 CRUD (6个)
 * - 产线排程管理 (5个)
 * - 工人分配管理 (5个)
 * - AI辅助功能 (5个)
 * - 告警管理 (4个)
 * - 产线管理 (4个)
 * - Dashboard (2个)
 *
 * @version 1.0.0
 * @since 2025-12-28
 */

// ========== 类型定义 ==========

export interface ApiResponse<T> {
  success: boolean;
  code?: number;
  message: string;
  data: T;
}

export interface ProductionLine {
  id: string;
  name: string;
  workshopId: string;
  workshopName?: string;
  capacity: number;
  status: 'active' | 'maintenance' | 'inactive';
  skillLevels: Record<string, number>;
  createdAt: string;
  updatedAt: string;
}

export interface CompletionProbabilityResponse {
  scheduleId: string;
  scheduleName?: string;
  probability: number;
  confidenceInterval: {
    lower: number;
    upper: number;
  };
  riskLevel: 'low' | 'medium' | 'high';
  factors: {
    workerEfficiency: number;
    equipmentStatus: number;
    materialAvailability: number;
    timeBuffer: number;
  };
  suggestions?: string[];
  llmAnalysis?: string;
}

// ========== API 客户端类 ==========

class SchedulingApiClient {
  private getPath(factoryId?: string) {
    const currentFactoryId = requireFactoryId(factoryId);
    return `/api/mobile/${currentFactoryId}/scheduling`;
  }

  // ==================== 调度计划 CRUD ====================

  /**
   * 1. 创建调度计划
   */
  async createPlan(
    data: CreateScheduleRequest,
    factoryId?: string
  ): Promise<ApiResponse<SchedulingPlan>> {
    return await apiClient.post(`${this.getPath(factoryId)}/plans`, data);
  }

  /**
   * 2. 获取调度计划详情
   */
  async getPlan(planId: string, factoryId?: string): Promise<ApiResponse<SchedulingPlan>> {
    return await apiClient.get(`${this.getPath(factoryId)}/plans/${planId}`);
  }

  /**
   * 3. 获取调度计划列表 (分页)
   */
  async getPlans(params?: {
    startDate?: string;
    endDate?: string;
    status?: string;
    page?: number;
    size?: number;
    factoryId?: string;
  }): Promise<ApiResponse<PagedResponse<SchedulingPlan>>> {
    const { factoryId, ...query } = params || {};
    return await apiClient.get(`${this.getPath(factoryId)}/plans`, { params: query });
  }

  /**
   * 4. 更新调度计划
   */
  async updatePlan(
    planId: string,
    data: Partial<CreateScheduleRequest>,
    factoryId?: string
  ): Promise<ApiResponse<SchedulingPlan>> {
    return await apiClient.put(`${this.getPath(factoryId)}/plans/${planId}`, data);
  }

  /**
   * 5. 确认调度计划
   */
  async confirmPlan(planId: string, factoryId?: string): Promise<ApiResponse<SchedulingPlan>> {
    return await apiClient.post(`${this.getPath(factoryId)}/plans/${planId}/confirm`);
  }

  /**
   * 6. 取消调度计划
   */
  async cancelPlan(
    planId: string,
    reason?: string,
    factoryId?: string
  ): Promise<ApiResponse<void>> {
    return await apiClient.post(`${this.getPath(factoryId)}/plans/${planId}/cancel`, null, {
      params: { reason },
    });
  }

  // ==================== 产线排程管理 ====================

  /**
   * 7. 获取排程详情
   */
  async getSchedule(scheduleId: string, factoryId?: string): Promise<ApiResponse<LineSchedule>> {
    return await apiClient.get(`${this.getPath(factoryId)}/schedules/${scheduleId}`);
  }

  /**
   * 8. 更新排程
   */
  async updateSchedule(
    scheduleId: string,
    data: Partial<LineSchedule>,
    factoryId?: string
  ): Promise<ApiResponse<LineSchedule>> {
    return await apiClient.put(`${this.getPath(factoryId)}/schedules/${scheduleId}`, data);
  }

  /**
   * 9. 开始排程 (启动生产)
   */
  async startSchedule(scheduleId: string, factoryId?: string): Promise<ApiResponse<LineSchedule>> {
    return await apiClient.post(`${this.getPath(factoryId)}/schedules/${scheduleId}/start`);
  }

  /**
   * 10. 完成排程
   */
  async completeSchedule(
    scheduleId: string,
    completedQuantity: number,
    factoryId?: string
  ): Promise<ApiResponse<LineSchedule>> {
    return await apiClient.post(
      `${this.getPath(factoryId)}/schedules/${scheduleId}/complete`,
      null,
      { params: { completedQuantity } }
    );
  }

  /**
   * 11. 更新排程进度
   */
  async updateProgress(
    scheduleId: string,
    completedQuantity: number,
    factoryId?: string
  ): Promise<ApiResponse<LineSchedule>> {
    return await apiClient.post(
      `${this.getPath(factoryId)}/schedules/${scheduleId}/progress`,
      null,
      { params: { completedQuantity } }
    );
  }

  // ==================== 工人分配管理 ====================

  /**
   * 12. 分配工人
   */
  async assignWorkers(
    data: AssignWorkersRequest,
    factoryId?: string
  ): Promise<ApiResponse<WorkerAssignment[]>> {
    return await apiClient.post(`${this.getPath(factoryId)}/workers/assign`, data);
  }

  /**
   * 13. 移除工人分配
   */
  async removeWorkerAssignment(
    assignmentId: string,
    factoryId?: string
  ): Promise<ApiResponse<void>> {
    return await apiClient.delete(
      `${this.getPath(factoryId)}/workers/assignments/${assignmentId}`
    );
  }

  /**
   * 14. 工人签到
   */
  async workerCheckIn(
    assignmentId: string,
    factoryId?: string
  ): Promise<ApiResponse<WorkerAssignment>> {
    return await apiClient.post(
      `${this.getPath(factoryId)}/workers/assignments/${assignmentId}/check-in`
    );
  }

  /**
   * 15. 工人签退
   */
  async workerCheckOut(
    assignmentId: string,
    performanceScore?: number,
    factoryId?: string
  ): Promise<ApiResponse<WorkerAssignment>> {
    return await apiClient.post(
      `${this.getPath(factoryId)}/workers/assignments/${assignmentId}/check-out`,
      null,
      { params: performanceScore ? { performanceScore } : undefined }
    );
  }

  /**
   * 16. 获取工人分配列表
   */
  async getWorkerAssignments(params?: {
    userId?: number;
    date?: string;
    factoryId?: string;
  }): Promise<ApiResponse<WorkerAssignment[]>> {
    const { factoryId, ...query } = params || {};
    return await apiClient.get(`${this.getPath(factoryId)}/workers/assignments`, {
      params: query,
    });
  }

  // ==================== AI 辅助功能 ====================

  /**
   * 17. AI 生成调度计划
   */
  async generateSchedule(
    data: {
      planDate: string;
      shiftType?: 'day' | 'night' | 'full_day';
      productionPlanIds?: string[];
      optimizeFor?: 'efficiency' | 'cost' | 'balanced';
    },
    factoryId?: string
  ): Promise<ApiResponse<SchedulingPlan>> {
    return await apiClient.post(`${this.getPath(factoryId)}/generate`, data);
  }

  /**
   * 18. AI 优化人员分配
   */
  async optimizeWorkers(
    data: {
      planId?: string;
      scheduleId?: string;
      optimizeFor?: 'efficiency' | 'fairness' | 'cost';
    },
    factoryId?: string
  ): Promise<ApiResponse<WorkerAssignment[]>> {
    return await apiClient.post(`${this.getPath(factoryId)}/optimize-workers`, data);
  }

  /**
   * 19. 计算排程完成概率
   */
  async calculateCompletionProbability(
    scheduleId: string,
    factoryId?: string
  ): Promise<ApiResponse<CompletionProbabilityResponse>> {
    return await apiClient.get(
      `${this.getPath(factoryId)}/schedules/${scheduleId}/probability`
    );
  }

  /**
   * 20. 批量计算计划内所有排程的完成概率
   */
  async calculateBatchProbabilities(
    planId: string,
    factoryId?: string
  ): Promise<ApiResponse<CompletionProbabilityResponse[]>> {
    return await apiClient.get(`${this.getPath(factoryId)}/plans/${planId}/probabilities`);
  }

  /**
   * 21. 重新调度 (AI 辅助)
   */
  async reschedule(
    data: {
      planId: string;
      reason?: string;
      keepAssignments?: boolean;
    },
    factoryId?: string
  ): Promise<ApiResponse<SchedulingPlan>> {
    return await apiClient.post(`${this.getPath(factoryId)}/reschedule`, data);
  }

  // ==================== 告警管理 ====================

  /**
   * 22. 获取未解决告警列表
   */
  async getUnresolvedAlerts(factoryId?: string): Promise<ApiResponse<SchedulingAlert[]>> {
    return await apiClient.get(`${this.getPath(factoryId)}/alerts/unresolved`);
  }

  /**
   * 23. 获取告警列表 (分页)
   */
  async getAlerts(params?: {
    severity?: string;
    alertType?: string;
    page?: number;
    size?: number;
    factoryId?: string;
  }): Promise<ApiResponse<PagedResponse<SchedulingAlert>>> {
    const { factoryId, ...query } = params || {};
    return await apiClient.get(`${this.getPath(factoryId)}/alerts`, { params: query });
  }

  /**
   * 24. 确认告警
   */
  async acknowledgeAlert(
    alertId: string,
    factoryId?: string
  ): Promise<ApiResponse<SchedulingAlert>> {
    return await apiClient.post(`${this.getPath(factoryId)}/alerts/${alertId}/acknowledge`);
  }

  /**
   * 25. 解决告警
   */
  async resolveAlert(
    alertId: string,
    resolutionNotes?: string,
    factoryId?: string
  ): Promise<ApiResponse<SchedulingAlert>> {
    return await apiClient.post(`${this.getPath(factoryId)}/alerts/${alertId}/resolve`, null, {
      params: resolutionNotes ? { resolutionNotes } : undefined,
    });
  }

  // ==================== 产线管理 ====================

  /**
   * 26. 获取产线列表
   */
  async getProductionLines(params?: {
    status?: string;
    factoryId?: string;
  }): Promise<ApiResponse<ProductionLine[]>> {
    const { factoryId, ...query } = params || {};
    return await apiClient.get(`${this.getPath(factoryId)}/production-lines`, { params: query });
  }

  /**
   * 27. 创建产线
   */
  async createProductionLine(
    data: Partial<ProductionLine>,
    factoryId?: string
  ): Promise<ApiResponse<ProductionLine>> {
    return await apiClient.post(`${this.getPath(factoryId)}/production-lines`, data);
  }

  /**
   * 28. 更新产线
   */
  async updateProductionLine(
    lineId: string,
    data: Partial<ProductionLine>,
    factoryId?: string
  ): Promise<ApiResponse<ProductionLine>> {
    return await apiClient.put(`${this.getPath(factoryId)}/production-lines/${lineId}`, data);
  }

  /**
   * 29. 更新产线状态
   */
  async updateProductionLineStatus(
    lineId: string,
    status: string,
    factoryId?: string
  ): Promise<ApiResponse<ProductionLine>> {
    return await apiClient.put(
      `${this.getPath(factoryId)}/production-lines/${lineId}/status`,
      null,
      { params: { status } }
    );
  }

  // ==================== Dashboard ====================

  /**
   * 30. 获取调度 Dashboard
   */
  async getDashboard(params?: {
    date?: string;
    factoryId?: string;
  }): Promise<ApiResponse<SchedulingDashboard>> {
    const { factoryId, ...query } = params || {};
    return await apiClient.get(`${this.getPath(factoryId)}/dashboard`, { params: query });
  }

  /**
   * 31. 获取实时监控数据
   */
  async getRealtimeMonitor(
    planId: string,
    factoryId?: string
  ): Promise<ApiResponse<SchedulingDashboard>> {
    return await apiClient.get(`${this.getPath(factoryId)}/realtime/${planId}`);
  }

  // ==================== 员工管理 (扩展) ====================

  /**
   * 获取可用工人列表 (用于分配)
   */
  async getAvailableWorkers(params?: {
    workshopId?: string;
    skills?: string[];
    date?: string;
    factoryId?: string;
  }): Promise<ApiResponse<DispatcherEmployee[]>> {
    const { factoryId, ...query } = params || {};
    // 使用 users API 获取工人列表
    const currentFactoryId = requireFactoryId(factoryId);
    return await apiClient.get(`/api/mobile/${currentFactoryId}/users`, {
      params: {
        ...query,
        role: 'operator',
        isActive: true,
      },
    });
  }

  /**
   * 获取员工详情
   */
  async getEmployeeDetail(
    employeeId: number,
    factoryId?: string
  ): Promise<ApiResponse<DispatcherEmployee>> {
    const currentFactoryId = requireFactoryId(factoryId);
    return await apiClient.get(`/api/mobile/${currentFactoryId}/users/${employeeId}`);
  }

  /**
   * 获取员工技能
   */
  async getEmployeeSkills(
    employeeId: number,
    factoryId?: string
  ): Promise<ApiResponse<Record<string, number>>> {
    const currentFactoryId = requireFactoryId(factoryId);
    return await apiClient.get(`/api/mobile/${currentFactoryId}/users/${employeeId}/skills`);
  }

  /**
   * 更新员工技能
   */
  async updateEmployeeSkills(
    employeeId: number,
    skills: Record<string, number>,
    factoryId?: string
  ): Promise<ApiResponse<Record<string, number>>> {
    const currentFactoryId = requireFactoryId(factoryId);
    return await apiClient.put(
      `/api/mobile/${currentFactoryId}/users/${employeeId}/skills`,
      { skillLevels: skills }
    );
  }

  // ==================== 紧急插单 (扩展) ====================

  /**
   * 获取可插单时段
   */
  async getInsertSlots(
    data: GetInsertSlotsRequest,
    factoryId?: string
  ): Promise<ApiResponse<InsertSlot[]>> {
    const currentFactoryId = requireFactoryId(factoryId);
    return await apiClient.post(
      `/api/mobile/${currentFactoryId}/urgent-insert/slots`,
      data
    );
  }

  /**
   * 分析插单影响
   */
  async analyzeInsertImpact(
    slotId: string,
    data: { productTypeId: string; quantity: number },
    factoryId?: string
  ): Promise<ApiResponse<{ impactedPlans: Array<{ planId: string; delayMinutes: number }> }>> {
    const currentFactoryId = requireFactoryId(factoryId);
    return await apiClient.post(
      `/api/mobile/${currentFactoryId}/urgent-insert/analyze`,
      { slotId, ...data }
    );
  }

  /**
   * 确认紧急插单
   */
  async confirmInsert(
    data: ConfirmInsertRequest,
    factoryId?: string
  ): Promise<ApiResponse<SchedulingPlan>> {
    const currentFactoryId = requireFactoryId(factoryId);
    return await apiClient.post(
      `/api/mobile/${currentFactoryId}/urgent-insert/confirm`,
      data
    );
  }

  // ==================== 混批排产 (扩展) ====================

  /**
   * 检测可合批订单
   */
  async detectMixedBatch(
    data: DetectMixedBatchRequest,
    factoryId?: string
  ): Promise<ApiResponse<MixedBatchGroup[]>> {
    const currentFactoryId = requireFactoryId(factoryId);
    return await apiClient.post(
      `/api/mobile/${currentFactoryId}/mixed-batch/detect`,
      data
    );
  }

  /**
   * 获取合批建议列表
   */
  async getMixedBatchGroups(params?: {
    status?: string;
    factoryId?: string;
  }): Promise<ApiResponse<MixedBatchGroup[]>> {
    const { factoryId, ...query } = params || {};
    const currentFactoryId = requireFactoryId(factoryId);
    return await apiClient.get(`/api/mobile/${currentFactoryId}/mixed-batch/groups`, {
      params: query,
    });
  }

  /**
   * 获取合批详情
   */
  async getMixedBatchGroupDetail(
    groupId: string,
    factoryId?: string
  ): Promise<ApiResponse<MixedBatchGroup>> {
    const currentFactoryId = requireFactoryId(factoryId);
    return await apiClient.get(`/api/mobile/${currentFactoryId}/mixed-batch/groups/${groupId}`);
  }

  /**
   * 确认合批
   */
  async confirmMixedBatch(
    groupId: string,
    factoryId?: string
  ): Promise<ApiResponse<MixedBatchGroup>> {
    const currentFactoryId = requireFactoryId(factoryId);
    return await apiClient.post(
      `/api/mobile/${currentFactoryId}/mixed-batch/groups/${groupId}/confirm`
    );
  }

  /**
   * 拒绝合批
   */
  async rejectMixedBatch(
    groupId: string,
    reason?: string,
    factoryId?: string
  ): Promise<ApiResponse<MixedBatchGroup>> {
    const currentFactoryId = requireFactoryId(factoryId);
    return await apiClient.post(
      `/api/mobile/${currentFactoryId}/mixed-batch/groups/${groupId}/reject`,
      { reason }
    );
  }

  /**
   * 获取合批规则
   */
  async getMixedBatchRules(factoryId?: string): Promise<ApiResponse<MixedBatchRule[]>> {
    const currentFactoryId = requireFactoryId(factoryId);
    return await apiClient.get(`/api/mobile/${currentFactoryId}/mixed-batch/rules`);
  }

  /**
   * 更新合批规则
   */
  async updateMixedBatchRules(
    rules: MixedBatchRule[],
    factoryId?: string
  ): Promise<ApiResponse<MixedBatchRule[]>> {
    const currentFactoryId = requireFactoryId(factoryId);
    return await apiClient.put(`/api/mobile/${currentFactoryId}/mixed-batch/rules`, rules);
  }

  // ==================== HR 模块方法 ====================

  /**
   * 获取批次分配列表 (HR模块)
   */
  async getBatchAssignments(params?: {
    status?: string;
    page?: number;
    size?: number;
    factoryId?: string;
  }): Promise<{
    content: {
      batchId: string;
      batchNumber: string;
      productName: string;
      status: string;
      assignedCount: number;
      requiredCount: number;
      totalWorkHours: number;
      laborCost: number;
    }[];
    totalElements: number;
    totalPages: number;
  }> {
    // TODO: 对接后端 API
    return { content: [], totalElements: 0, totalPages: 0 };
  }

  /**
   * 获取批次员工列表 (HR模块)
   */
  async getBatchWorkers(batchId: string, factoryId?: string): Promise<{
    content: {
      id: number;
      userId: number;
      userName: string;
      workType: string;
      workMinutes: number;
      status: string;
    }[];
    totalElements: number;
  }> {
    // TODO: 对接后端 API
    return { content: [], totalElements: 0 };
  }

  /**
   * 从批次移除工人 (HR模块)
   */
  async removeWorkerFromBatch(
    batchId: string,
    workerId: number,
    factoryId?: string
  ): Promise<{ success: boolean }> {
    // TODO: 对接后端 API
    console.log('[schedulingApiClient] removeWorkerFromBatch:', batchId, workerId);
    return { success: true };
  }

  /**
   * 获取排班计划列表 (HR模块)
   */
  async getWorkSchedules(params?: {
    startDate?: string;
    endDate?: string;
    shiftType?: string;
    page?: number;
    size?: number;
    factoryId?: string;
  }): Promise<{
    content: {
      id: string;
      date: string;
      shiftType: string;
      startTime: string;
      endTime: string;
      assignedCount: number;
      confirmedCount: number;
    }[];
    totalElements: number;
    totalPages: number;
  }> {
    // TODO: 对接后端 API
    return { content: [], totalElements: 0, totalPages: 0 };
  }
}

export const schedulingApiClient = new SchedulingApiClient();
