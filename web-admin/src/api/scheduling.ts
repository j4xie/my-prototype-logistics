/**
 * 调度模块 API
 * 提供调度计划、排程、工人分配、告警等功能的API接口
 */
import { get, post, put, del } from './request';

// ==================== 类型定义 ====================

export interface SchedulingPlan {
  id: string;
  factoryId: string;
  planDate: string;
  status: 'draft' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled';
  totalBatches: number;
  totalWorkers: number;
  averageCompletionProbability: number;
  lineSchedules: LineSchedule[];
  createdBy: number;
  createdAt: string;
  confirmedBy?: number;
  confirmedAt?: string;
}

export interface LineSchedule {
  id: string;
  planId: string;
  productionLineId: string;
  productionLineName: string;
  batchId: number;
  batchNumber: string;
  sequenceOrder: number;
  plannedStartTime: string;
  plannedEndTime: string;
  actualStartTime?: string;
  actualEndTime?: string;
  assignedWorkerCount: number;
  completedQuantity: number;
  targetQuantity: number;
  predictedEfficiency: number;
  predictedCompletionProb: number;
  status: 'pending' | 'in_progress' | 'completed' | 'delayed';
  workerAssignments: WorkerAssignment[];
  completionRate: number;
  isDelayed: boolean;
}

export interface WorkerAssignment {
  id: string;
  scheduleId: string;
  userId: number;
  userName: string;
  role: string;
  skillLevel: number;
  isTemporary: boolean;
  assignedAt: string;
  checkedInAt?: string;
  checkedOutAt?: string;
  workedHours?: number;
  performanceScore?: number;
  laborCost?: number;
  status: 'assigned' | 'checked_in' | 'checked_out';
}

export interface ProductionLine {
  id: string;
  factoryId: string;
  departmentId?: number;
  name: string;
  lineType: string;
  minWorkers: number;
  maxWorkers: number;
  requiredSkillLevel: number;
  hourlyCapacity: number;
  status: 'active' | 'maintenance' | 'inactive';
  createdAt: string;
}

export interface SchedulingAlert {
  id: string;
  factoryId: string;
  scheduleId?: string;
  planId?: string;
  alertType: 'low_probability' | 'resource_conflict' | 'deadline_risk' | 'efficiency_drop';
  severity: 'info' | 'warning' | 'critical';
  message: string;
  suggestedAction?: string;
  isResolved: boolean;
  acknowledgedBy?: number;
  acknowledgedAt?: string;
  resolvedBy?: number;
  resolvedAt?: string;
  resolutionNotes?: string;
  createdAt: string;
}

export interface CompletionProbability {
  scheduleId: string;
  probability: number;
  meanHours: number;
  stdHours: number;
  percentile90: number;
  confidenceLower: number;
  confidenceUpper: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  suggestedActions: string[];
}

export interface SchedulingDashboard {
  planStats: {
    totalPlans: number;
    draftPlans: number;
    confirmedPlans: number;
    inProgressPlans: number;
    completedPlans: number;
  };
  workerStats: {
    totalAssigned: number;
    checkedIn: number;
    temporaryWorkers: number;
    averagePerformance: number;
  };
  lineStats: {
    activeLines: number;
    utilizationRate: number;
    averageEfficiency: number;
  };
  alerts: SchedulingAlert[];
  todaySchedules: LineSchedule[];
}

// ==================== API 函数 ====================

/**
 * 获取调度计划列表
 */
export function getSchedulingPlans(
  factoryId: string,
  params?: {
    startDate?: string;
    endDate?: string;
    status?: string;
    page?: number;
    size?: number;
  }
) {
  return get<{
    content: SchedulingPlan[];
    totalElements: number;
    totalPages: number;
  }>(`/${factoryId}/scheduling/plans`, { params });
}

/**
 * 获取调度计划详情
 */
export function getSchedulingPlan(factoryId: string, planId: string) {
  return get<SchedulingPlan>(`/${factoryId}/scheduling/plans/${planId}`);
}

/**
 * 创建调度计划
 */
export function createSchedulingPlan(
  factoryId: string,
  data: {
    planDate: string;
    batchIds: number[];
    autoAssignWorkers?: boolean;
    notes?: string;
  }
) {
  return post<SchedulingPlan>(`/${factoryId}/scheduling/plans`, data);
}

/**
 * 更新调度计划
 */
export function updateSchedulingPlan(
  factoryId: string,
  planId: string,
  data: {
    planDate?: string;
    batchIds?: number[];
    notes?: string;
  }
) {
  return put<SchedulingPlan>(`/${factoryId}/scheduling/plans/${planId}`, data);
}

/**
 * 确认调度计划
 */
export function confirmSchedulingPlan(factoryId: string, planId: string) {
  return post<SchedulingPlan>(`/${factoryId}/scheduling/plans/${planId}/confirm`);
}

/**
 * 取消调度计划
 */
export function cancelSchedulingPlan(factoryId: string, planId: string, reason: string) {
  return post<void>(`/${factoryId}/scheduling/plans/${planId}/cancel`, null, {
    params: { reason }
  });
}

/**
 * AI生成调度建议
 */
export function generateSchedule(
  factoryId: string,
  data: {
    planDate: string;
    batchIds: number[];
    optimizationGoal?: 'minimize_cost' | 'maximize_efficiency' | 'balanced';
    considerTemporaryWorkers?: boolean;
    minCompletionProbability?: number;
  }
) {
  return post<SchedulingPlan>(`/${factoryId}/scheduling/generate`, data);
}

/**
 * 获取排程详情
 */
export function getSchedule(factoryId: string, scheduleId: string) {
  return get<LineSchedule>(`/${factoryId}/scheduling/schedules/${scheduleId}`);
}

/**
 * 更新排程
 */
export function updateSchedule(
  factoryId: string,
  scheduleId: string,
  data: {
    plannedStartTime?: string;
    plannedEndTime?: string;
    sequenceOrder?: number;
  }
) {
  return put<LineSchedule>(`/${factoryId}/scheduling/schedules/${scheduleId}`, data);
}

/**
 * 开始排程生产
 */
export function startSchedule(factoryId: string, scheduleId: string) {
  return post<LineSchedule>(`/${factoryId}/scheduling/schedules/${scheduleId}/start`);
}

/**
 * 完成排程
 */
export function completeSchedule(factoryId: string, scheduleId: string, completedQuantity: number) {
  return post<LineSchedule>(`/${factoryId}/scheduling/schedules/${scheduleId}/complete`, null, {
    params: { completedQuantity }
  });
}

/**
 * 更新排程进度
 */
export function updateScheduleProgress(factoryId: string, scheduleId: string, completedQuantity: number) {
  return post<LineSchedule>(`/${factoryId}/scheduling/schedules/${scheduleId}/progress`, null, {
    params: { completedQuantity }
  });
}

/**
 * 计算完成概率
 */
export function calculateProbability(factoryId: string, scheduleId: string) {
  return get<CompletionProbability>(`/${factoryId}/scheduling/schedules/${scheduleId}/probability`);
}

/**
 * 批量计算完成概率
 */
export function calculateBatchProbabilities(factoryId: string, planId: string) {
  return get<CompletionProbability[]>(`/${factoryId}/scheduling/plans/${planId}/probabilities`);
}

/**
 * 分配工人
 */
export function assignWorkers(
  factoryId: string,
  data: {
    scheduleId: string;
    userIds: number[];
  }
) {
  return post<WorkerAssignment[]>(`/${factoryId}/scheduling/workers/assign`, data);
}

/**
 * 移除工人分配
 */
export function removeWorkerAssignment(factoryId: string, assignmentId: string) {
  return del<void>(`/${factoryId}/scheduling/workers/assignments/${assignmentId}`);
}

/**
 * 工人签到
 */
export function workerCheckIn(factoryId: string, assignmentId: string) {
  return post<WorkerAssignment>(`/${factoryId}/scheduling/workers/assignments/${assignmentId}/check-in`);
}

/**
 * 工人签退
 */
export function workerCheckOut(factoryId: string, assignmentId: string, performanceScore?: number) {
  return post<WorkerAssignment>(`/${factoryId}/scheduling/workers/assignments/${assignmentId}/check-out`, null, {
    params: { performanceScore }
  });
}

/**
 * 获取工人分配
 */
export function getWorkerAssignments(factoryId: string, userId: number, date?: string) {
  return get<WorkerAssignment[]>(`/${factoryId}/scheduling/workers/${userId}/assignments`, {
    params: { date }
  });
}

/**
 * 优化工人分配 (OR-Tools)
 */
export function optimizeWorkers(
  factoryId: string,
  data: {
    scheduleIds: string[];
    objective?: 'minimize_cost' | 'maximize_efficiency' | 'balanced';
    maxTemporaryRatio?: number;
    minSkillMatch?: number;
  }
) {
  return post<WorkerAssignment[]>(`/${factoryId}/scheduling/optimize-workers`, data);
}

/**
 * 重新调度
 */
export function reschedule(
  factoryId: string,
  data: {
    planId: string;
    reason: string;
    adjustments?: Array<{
      scheduleId: string;
      newStartTime?: string;
      newEndTime?: string;
      additionalWorkers?: number;
    }>;
  }
) {
  return post<SchedulingPlan>(`/${factoryId}/scheduling/reschedule`, data);
}

/**
 * 获取告警列表
 */
export function getAlerts(
  factoryId: string,
  params?: {
    severity?: string;
    alertType?: string;
    page?: number;
    size?: number;
  }
) {
  return get<{
    content: SchedulingAlert[];
    totalElements: number;
    totalPages: number;
  }>(`/${factoryId}/scheduling/alerts`, { params });
}

/**
 * 获取未解决告警
 */
export function getUnresolvedAlerts(factoryId: string) {
  return get<SchedulingAlert[]>(`/${factoryId}/scheduling/alerts/unresolved`);
}

/**
 * 确认告警
 */
export function acknowledgeAlert(factoryId: string, alertId: string) {
  return post<SchedulingAlert>(`/${factoryId}/scheduling/alerts/${alertId}/acknowledge`);
}

/**
 * 解决告警
 */
export function resolveAlert(factoryId: string, alertId: string, resolutionNotes: string) {
  return post<SchedulingAlert>(`/${factoryId}/scheduling/alerts/${alertId}/resolve`, null, {
    params: { resolutionNotes }
  });
}

/**
 * 获取产线列表
 */
export function getProductionLines(factoryId: string, status?: string) {
  return get<ProductionLine[]>(`/${factoryId}/scheduling/production-lines`, {
    params: { status }
  });
}

/**
 * 创建产线
 */
export function createProductionLine(factoryId: string, data: Partial<ProductionLine>) {
  return post<ProductionLine>(`/${factoryId}/scheduling/production-lines`, data);
}

/**
 * 更新产线
 */
export function updateProductionLine(factoryId: string, lineId: string, data: Partial<ProductionLine>) {
  return put<ProductionLine>(`/${factoryId}/scheduling/production-lines/${lineId}`, data);
}

/**
 * 更新产线状态
 */
export function updateProductionLineStatus(factoryId: string, lineId: string, status: string) {
  return put<ProductionLine>(`/${factoryId}/scheduling/production-lines/${lineId}/status`, null, {
    params: { status }
  });
}

/**
 * 获取调度 Dashboard
 */
export function getSchedulingDashboard(factoryId: string, date?: string) {
  return get<SchedulingDashboard>(`/${factoryId}/scheduling/dashboard`, {
    params: { date }
  });
}

/**
 * 获取实时监控数据
 */
export function getRealtimeMonitor(factoryId: string, planId: string) {
  return get<SchedulingDashboard>(`/${factoryId}/scheduling/realtime/${planId}`);
}
