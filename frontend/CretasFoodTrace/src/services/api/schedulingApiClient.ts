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
  ProductionPlanDTO,
  ConfirmUrgentInsertRequest,
  UrgentInsertImpactAnalysis,
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

/** 排程配置 (用于 AI 排产) */
export interface ScheduleConfig {
  startDate?: string;
  endDate?: string;
  shiftType: 'day' | 'night' | 'full_day';
  autoAssignWorkers: boolean;
  enableLinUCB?: boolean;
  optimizeByLinUCB?: boolean;
  optimizeFor?: 'efficiency' | 'cost' | 'balanced';
  batchIds?: string[];
  planIds?: string[];
}

/** 产线分配建议 */
export interface LineAssignment {
  lineId: string;
  lineName: string;
  load: number;
  loadLevel: 'low' | 'medium' | 'high';
  batches: string[];
}

/** 工人优化建议 */
export interface WorkerSuggestion {
  workerId: number;
  workerName: string;
  currentPosition: string;
  skill: string;
  targetLine: string;
  ucbScore: number;
}

/** AI 排产结果（扩展 SchedulingPlan） */
export interface AISchedulingResult {
  plan: SchedulingPlan;
  completionProbability: number;
  simulationRuns: number;
  lineAssignments: LineAssignment[];
  workerSuggestions: WorkerSuggestion[];
  efficiencyImprovement: number;
  improvedProbability: number;
}

/** 待排产批次 */
export interface PendingBatch {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  orderId?: string;
  deadline: string;
  priority: 'high' | 'normal' | 'low';
  isUrgent?: boolean;
  currentProbability?: number;
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
   * 支持两种调用方式:
   * - 传统方式: { planDate, shiftType, productionPlanIds, optimizeFor }
   * - 扩展方式: ScheduleConfig (包含 batchIds/planIds)
   */
  async generateSchedule(
    data: {
      planDate?: string;
      startDate?: string;
      endDate?: string;
      shiftType?: 'day' | 'night' | 'full_day';
      productionPlanIds?: string[];
      planIds?: string[];
      batchIds?: string[];
      optimizeFor?: 'efficiency' | 'cost' | 'balanced';
      autoAssignWorkers?: boolean;
      enableLinUCB?: boolean;
    },
    factoryId?: string
  ): Promise<ApiResponse<AISchedulingResult>> {
    // 构建后端所需的请求参数
    const requestData = {
      planDate: data.planDate || data.startDate || new Date().toISOString().split('T')[0],
      shiftType: data.shiftType,
      productionPlanIds: data.productionPlanIds || data.planIds,
      batchIds: data.batchIds,
      optimizeFor: data.optimizeFor,
      autoAssignWorkers: data.autoAssignWorkers,
      enableLinUCB: data.enableLinUCB,
    };
    return await apiClient.post(`${this.getPath(factoryId)}/generate`, requestData);
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

  // ==================== 待排产批次 (AI 排产) ====================

  /**
   * 获取待排产批次列表（带紧急状态）
   * 使用新的 /scheduling/pending-batches 端点
   * 返回包含紧急状态和完成概率的生产计划列表
   */
  async getPendingBatches(params?: {
    startDate?: string;  // YYYY-MM-DD
    endDate?: string;    // YYYY-MM-DD
    factoryId?: string;
  }): Promise<ApiResponse<ProductionPlanDTO[]>> {
    const { factoryId, ...query } = params || {};
    return await apiClient.get(`${this.getPath(factoryId)}/pending-batches`, {
      params: query
    });
  }

  /**
   * 获取紧急阈值配置
   * 返回当前工厂的紧急阈值设置（完成概率低于此值时标记为紧急）
   */
  async getUrgentThresholdConfig(factoryId?: string): Promise<ApiResponse<{
    threshold: number;
    factoryId: string;
    description: string;
  }>> {
    return await apiClient.get(`${this.getPath(factoryId)}/config/urgent-threshold`);
  }

  /**
   * 更新紧急阈值配置（仅限管理员）
   * @param threshold 新的阈值 (0-1之间)
   * @param factoryId 工厂ID（可选）
   */
  async updateUrgentThresholdConfig(
    threshold: number,
    factoryId?: string
  ): Promise<ApiResponse<{
    threshold: number;
    factoryId: string;
    updatedAt: string;
  }>> {
    return await apiClient.put(
      `${this.getPath(factoryId)}/config/urgent-threshold`,
      { threshold }
    );
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

  // ==================== 紧急插单 (Phase C 增强版) ====================

  /**
   * 获取可用插单时段 (新版 - 多维度评分)
   * GET /api/mobile/{factoryId}/scheduling/urgent-insert/slots
   *
   * @param days 查询天数 (1-7, 默认3)
   * @param factoryId 工厂ID
   * @returns 12个可用时段，包含多维度推荐评分和影响分析
   */
  async getAvailableSlots(
    days: number = 3,
    factoryId?: string
  ): Promise<ApiResponse<InsertSlot[]>> {
    return await apiClient.get(
      `${this.getPath(factoryId)}/urgent-insert/slots`,
      { params: { days } }
    );
  }

  /**
   * 分析时段插单影响 (链式影响分析)
   * GET /api/mobile/{factoryId}/scheduling/urgent-insert/slots/{slotId}/impact
   *
   * @param slotId 时段ID
   * @param productTypeId 产品类型ID
   * @param quantity 计划数量 (kg)
   * @param factoryId 工厂ID
   * @returns 完整的链式影响分析结果
   */
  async analyzeSlotImpact(
    slotId: string,
    productTypeId: string,
    quantity: number,
    factoryId?: string
  ): Promise<ApiResponse<UrgentInsertImpactAnalysis>> {
    return await apiClient.get(
      `${this.getPath(factoryId)}/urgent-insert/slots/${slotId}/impact`,
      { params: { productTypeId, quantity } }
    );
  }

  /**
   * 确认紧急插单 (创建紧急生产计划)
   * POST /api/mobile/{factoryId}/scheduling/urgent-insert/confirm
   *
   * @param request 确认插单请求
   * @param factoryId 工厂ID
   * @returns 创建的生产计划
   */
  async confirmUrgentInsert(
    request: ConfirmUrgentInsertRequest,
    factoryId?: string
  ): Promise<ApiResponse<ProductionPlanDTO>> {
    return await apiClient.post(
      `${this.getPath(factoryId)}/urgent-insert/confirm`,
      request
    );
  }

  /**
   * 强制插单 (需要审批)
   * POST /api/mobile/{factoryId}/scheduling/urgent-insert/force
   *
   * @param request 强制插单请求 (forceInsert=true)
   * @param factoryId 工厂ID
   * @returns 创建的待审批生产计划
   */
  async forceUrgentInsert(
    request: ConfirmUrgentInsertRequest,
    factoryId?: string
  ): Promise<ApiResponse<ProductionPlanDTO>> {
    return await apiClient.post(
      `${this.getPath(factoryId)}/urgent-insert/force`,
      { ...request, forceInsert: true }
    );
  }

  /**
   * [兼容] 获取可插单时段 (旧版API，保留向后兼容)
   * @deprecated 使用 getAvailableSlots 替代
   */
  async getInsertSlots(
    data: GetInsertSlotsRequest,
    factoryId?: string
  ): Promise<ApiResponse<InsertSlot[]>> {
    console.warn('[DEPRECATED] getInsertSlots is deprecated. Use getAvailableSlots instead.');
    return this.getAvailableSlots(3, factoryId);
  }

  /**
   * [兼容] 分析插单影响 (旧版API，保留向后兼容)
   * @deprecated 使用 analyzeSlotImpact 替代
   */
  async analyzeInsertImpact(
    slotId: string,
    data: { productTypeId: string; quantity: number },
    factoryId?: string
  ): Promise<ApiResponse<UrgentInsertImpactAnalysis>> {
    console.warn('[DEPRECATED] analyzeInsertImpact is deprecated. Use analyzeSlotImpact instead.');
    return this.analyzeSlotImpact(slotId, data.productTypeId, data.quantity, factoryId);
  }

  /**
   * [兼容] 确认紧急插单 (旧版API，保留向后兼容)
   * @deprecated 使用 confirmUrgentInsert 替代
   */
  async confirmInsert(
    data: ConfirmInsertRequest,
    factoryId?: string
  ): Promise<ApiResponse<ProductionPlanDTO>> {
    console.warn('[DEPRECATED] confirmInsert is deprecated. Use confirmUrgentInsert instead.');
    // 转换旧格式到新格式
    const request: ConfirmUrgentInsertRequest = {
      slotId: data.slotId,
      productTypeId: data.productTypeId,
      plannedQuantity: data.quantity,
      urgentReason: data.reason ?? '紧急订单',
      priority: data.priority,
    };
    return this.confirmUrgentInsert(request, factoryId);
  }

  // ==================== 强制插单审批 ====================

  /**
   * 获取待审批的强制插单列表
   * 返回所有 requires_approval=true 且 approval_status='PENDING' 的生产计划
   */
  async getPendingApprovals(factoryId?: string): Promise<ApiResponse<ProductionPlanDTO[]>> {
    return await apiClient.get(`${this.getPath(factoryId)}/approvals/pending`);
  }

  /**
   * 批准强制插单
   * @param planId 计划ID
   * @param comment 审批备注（可选）
   * @param factoryId 工厂ID（可选）
   */
  async approveForceInsert(
    planId: string,
    comment?: string,
    factoryId?: string
  ): Promise<ApiResponse<ProductionPlanDTO>> {
    return await apiClient.post(
      `${this.getPath(factoryId)}/approvals/${planId}/approve`,
      null,
      { params: comment ? { comment } : undefined }
    );
  }

  /**
   * 拒绝强制插单
   * @param planId 计划ID
   * @param reason 拒绝原因（可选）
   * @param factoryId 工厂ID（可选）
   */
  async rejectForceInsert(
    planId: string,
    reason?: string,
    factoryId?: string
  ): Promise<ApiResponse<ProductionPlanDTO>> {
    return await apiClient.post(
      `${this.getPath(factoryId)}/approvals/${planId}/reject`,
      null,
      { params: reason ? { reason } : undefined }
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
   * 调用 /processing/batches 获取批次列表，包含员工分配统计
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
    const fid = params?.factoryId || requireFactoryId();
    const response = await apiClient.get<ApiResponse<{
      content: Array<{
        id: number | string;
        batchNumber: string;
        productTypeName?: string;
        status: string;
        assignedWorkerCount?: number;
        plannedQuantity?: number;
        totalWorkMinutes?: number;
        laborCost?: number;
      }>;
      totalElements: number;
      totalPages: number;
    }>>(`/api/mobile/${fid}/processing/batches`, {
      params: {
        status: params?.status,
        page: params?.page || 1,
        size: params?.size || 20,
      },
    });

    if (response.success && response.data) {
      return {
        content: response.data.content.map(batch => ({
          batchId: String(batch.id),
          batchNumber: batch.batchNumber || '',
          productName: batch.productTypeName || '',
          status: batch.status || '',
          assignedCount: batch.assignedWorkerCount || 0,
          requiredCount: batch.plannedQuantity || 0,
          totalWorkHours: (batch.totalWorkMinutes || 0) / 60,
          laborCost: batch.laborCost || 0,
        })),
        totalElements: response.data.totalElements || 0,
        totalPages: response.data.totalPages || 0,
      };
    }
    return { content: [], totalElements: 0, totalPages: 0 };
  }

  /**
   * 获取批次员工列表 (HR模块)
   * 调用 /processing/batches/{batchId}/workers 获取批次员工列表
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
    const fid = factoryId || requireFactoryId();
    const response = await apiClient.get<ApiResponse<Array<{
      sessionId?: number;
      workerId: number;
      workerName?: string;
      workMinutes?: number;
      status?: string;
      statusText?: string;
      departmentName?: string;
    }>>>(`/api/mobile/${fid}/processing/batches/${batchId}/workers`);

    if (response.success && response.data) {
      const workers = Array.isArray(response.data) ? response.data : [];
      return {
        content: workers.map(worker => ({
          id: worker.sessionId || 0,
          userId: worker.workerId || 0,
          userName: worker.workerName || '',
          workType: worker.departmentName || '生产',
          workMinutes: worker.workMinutes || 0,
          status: worker.status || 'ASSIGNED',
        })),
        totalElements: workers.length,
      };
    }
    return { content: [], totalElements: 0 };
  }

  /**
   * 从批次移除工人 (HR模块)
   * 调用 DELETE /processing/batches/{batchId}/workers/{workerId} 取消员工分配
   */
  async removeWorkerFromBatch(
    batchId: string,
    workerId: number,
    factoryId?: string
  ): Promise<{ success: boolean }> {
    const fid = factoryId || requireFactoryId();
    const response = await apiClient.delete<ApiResponse<{
      success?: boolean;
      sessionId?: number;
      workerId?: number;
      message?: string;
    }>>(`/api/mobile/${fid}/processing/batches/${batchId}/workers/${workerId}`);

    return {
      success: response.success && (response.data?.success !== false),
    };
  }

  /**
   * 获取排班计划列表 (HR模块)
   * 调用 /scheduling/plans 获取调度计划列表，转换为排班格式
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
    const fid = params?.factoryId || requireFactoryId();
    const response = await apiClient.get<ApiResponse<{
      content: Array<{
        id: string;
        planDate?: string;
        shiftType?: string;
        startTime?: string;
        endTime?: string;
        totalWorkers?: number;
        confirmedWorkers?: number;
        status?: string;
      }>;
      totalElements: number;
      totalPages: number;
    }>>(`/api/mobile/${fid}/scheduling/plans`, {
      params: {
        startDate: params?.startDate,
        endDate: params?.endDate,
        status: params?.shiftType,  // 使用 status 过滤
        page: (params?.page || 1) - 1,  // 后端从 0 开始
        size: params?.size || 20,
      },
    });

    if (response.success && response.data) {
      return {
        content: response.data.content.map(plan => ({
          id: plan.id || '',
          date: plan.planDate || '',
          shiftType: plan.shiftType || 'day',
          startTime: plan.startTime || '08:00',
          endTime: plan.endTime || '18:00',
          assignedCount: plan.totalWorkers || 0,
          confirmedCount: plan.confirmedWorkers || 0,
        })),
        totalElements: response.data.totalElements || 0,
        totalPages: response.data.totalPages || 0,
      };
    }
    return { content: [], totalElements: 0, totalPages: 0 };
  }
}

export const schedulingApiClient = new SchedulingApiClient();
