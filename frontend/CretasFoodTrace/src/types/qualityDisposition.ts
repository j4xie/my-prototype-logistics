/**
 * 质检处置模块类型定义
 * Quality Disposition Module Types
 */

// ============================================
// 处置动作枚举
// ============================================

/**
 * 处置动作类型
 */
export enum DispositionAction {
  RELEASE = 'RELEASE',                     // 直接放行
  CONDITIONAL_RELEASE = 'CONDITIONAL_RELEASE', // 条件放行
  REWORK = 'REWORK',                       // 返工处理
  SCRAP = 'SCRAP',                         // 报废处理
  SPECIAL_APPROVAL = 'SPECIAL_APPROVAL',   // 特批放行
  HOLD = 'HOLD',                           // 暂扣待定
}

/**
 * 处置动作中文标签
 */
export const DISPOSITION_ACTION_LABELS: Record<DispositionAction, string> = {
  [DispositionAction.RELEASE]: '直接放行',
  [DispositionAction.CONDITIONAL_RELEASE]: '条件放行',
  [DispositionAction.REWORK]: '返工处理',
  [DispositionAction.SCRAP]: '报废处理',
  [DispositionAction.SPECIAL_APPROVAL]: '特批放行',
  [DispositionAction.HOLD]: '暂扣待定',
};

/**
 * 处置动作颜色映射
 */
export const DISPOSITION_ACTION_COLORS: Record<DispositionAction, string> = {
  [DispositionAction.RELEASE]: '#00C853',           // 绿色
  [DispositionAction.CONDITIONAL_RELEASE]: '#FFC107', // 黄色
  [DispositionAction.REWORK]: '#FF9800',            // 橙色
  [DispositionAction.SCRAP]: '#F44336',             // 红色
  [DispositionAction.SPECIAL_APPROVAL]: '#9C27B0',  // 紫色
  [DispositionAction.HOLD]: '#2196F3',              // 蓝色
};

/**
 * 处置动作图标映射
 */
export const DISPOSITION_ACTION_ICONS: Record<DispositionAction, string> = {
  [DispositionAction.RELEASE]: 'check-circle',
  [DispositionAction.CONDITIONAL_RELEASE]: 'alert-circle',
  [DispositionAction.REWORK]: 'refresh',
  [DispositionAction.SCRAP]: 'close-circle',
  [DispositionAction.SPECIAL_APPROVAL]: 'file-document-edit',
  [DispositionAction.HOLD]: 'pause-circle',
};

// ============================================
// 质检摘要
// ============================================

/**
 * 质检结果摘要
 */
export interface InspectionSummary {
  passRate: number;          // 合格率
  defectRate: number;        // 缺陷率
  inspectionResult: string;  // 检验结果: PASS, FAIL, CONDITIONAL
  qualityGrade: string;      // 质量等级: A, B, C, D
  sampleSize: number;        // 抽样数量
  passCount: number;         // 合格数量
  failCount: number;         // 不合格数量
}

// ============================================
// 备选动作
// ============================================

/**
 * 备选处置动作
 */
export interface AlternativeAction {
  action: DispositionAction;
  description: string;
  requiresApproval: boolean;
}

// ============================================
// 处置评估结果
// ============================================

/**
 * 处置评估 DTO
 * 对接后端: DispositionEvaluationDTO.java
 */
export interface DispositionEvaluation {
  // 基本信息
  inspectionId: string;
  productionBatchId: number;

  // 推荐动作
  recommendedAction: DispositionAction;
  recommendedActionDescription: string;
  requiresApproval: boolean;

  // 规则信息
  triggeredRuleName: string;
  ruleConfigId?: string;
  ruleVersion?: number;

  // 置信度和原因
  confidence: number;        // 0-100
  reason: string;

  // 备选方案
  alternativeActions?: AlternativeAction[];

  // 质检摘要
  inspectionSummary: InspectionSummary;
}

// ============================================
// 处置执行请求
// ============================================

/**
 * 执行处置请求
 * 对接后端: ExecuteDispositionRequest.java
 */
export interface ExecuteDispositionRequest {
  batchId: number;
  inspectionId: string;
  actionCode: DispositionAction;
  operatorComment?: string;
  executorId: number;
  approverId?: number;
}

// ============================================
// 处置执行结果
// ============================================

/**
 * 处置状态
 */
export enum DispositionStatus {
  EXECUTED = 'EXECUTED',
  PENDING_APPROVAL = 'PENDING_APPROVAL',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

/**
 * 处置状态中文标签
 */
export const DISPOSITION_STATUS_LABELS: Record<DispositionStatus, string> = {
  [DispositionStatus.EXECUTED]: '已执行',
  [DispositionStatus.PENDING_APPROVAL]: '待审批',
  [DispositionStatus.APPROVED]: '已批准',
  [DispositionStatus.REJECTED]: '已拒绝',
};

/**
 * 处置执行结果 DTO
 * 对接后端: DispositionResultDTO.java
 */
export interface DispositionResult {
  dispositionId: string;
  status: DispositionStatus;
  executedAction: DispositionAction;
  message: string;
  nextSteps?: string;
  newBatchStatus?: string;
  approvalInitiated?: boolean;
  approvalRequestId?: string;
  auditLogId?: string;
  executedAt: string; // ISO datetime string
}

// ============================================
// 处置历史记录
// ============================================

/**
 * 处置历史记录 DTO
 * 对接后端: DispositionHistoryDTO.java
 */
export interface DispositionHistory {
  id: string;
  batchId: number;
  inspectionId: string;

  // 处置信息
  action: DispositionAction;
  actionDescription: string;
  reason: string;

  // 质检数据
  passRate: number;
  defectRate: number;
  qualityGrade: string;

  // 执行人信息
  executorId: number;
  executorName: string;
  executorRole: string;

  // 审批信息
  requiresApproval: boolean;
  approvalStatus?: string;
  approverName?: string;
  approvedAt?: string;

  // 结果状态
  newStatus: string;
  createdAt: string;
}

// ============================================
// API 响应类型
// ============================================

export interface DispositionApiResponse<T> {
  success: boolean;
  code?: number;
  data: T;
  message: string;
}

// ============================================
// 工具函数
// ============================================

/**
 * 获取处置动作显示名称
 */
export function getActionLabel(action: DispositionAction): string {
  return DISPOSITION_ACTION_LABELS[action] || action;
}

/**
 * 获取处置动作颜色
 */
export function getActionColor(action: DispositionAction): string {
  return DISPOSITION_ACTION_COLORS[action] || '#9E9E9E';
}

/**
 * 获取处置动作图标
 */
export function getActionIcon(action: DispositionAction): string {
  return DISPOSITION_ACTION_ICONS[action] || 'help-circle';
}

/**
 * 判断动作是否需要审批
 */
export function requiresApproval(action: DispositionAction): boolean {
  return action === DispositionAction.SPECIAL_APPROVAL ||
         action === DispositionAction.SCRAP;
}

/**
 * 获取状态标签
 */
export function getStatusLabel(status: DispositionStatus): string {
  return DISPOSITION_STATUS_LABELS[status] || status;
}

/**
 * 格式化置信度
 */
export function formatConfidence(confidence: number): string {
  return `${confidence.toFixed(1)}%`;
}
