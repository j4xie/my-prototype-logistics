/**
 * Approval Workflow API client — Sprint 3 Track-I (C-APPROVAL-EDITOR-1).
 *
 * Backend: ApprovalWorkflowController @ /api/mobile/{factoryId}/approval-workflows
 * 服务 graph-native 审批工作流配置 (跟 ApprovalChainConfig flat-list 互补).
 *
 * @since 2026-05-16
 */
import request from './request'

// ==================== Wire types ====================

export type DecisionType =
  | 'FORCE_INSERT'
  | 'QUALITY_RELEASE'
  | 'QUALITY_EXCEPTION'
  | 'BATCH_STATUS_CHANGE'
  | 'SUPPLIER_APPROVAL'
  | 'SUPPLIER_STATUS_CHANGE'
  | 'MATERIAL_DISPOSAL'
  | 'PRODUCTION_PLAN_CHANGE'
  | 'EQUIPMENT_STATUS_CHANGE'
  | 'CUSTOM'

export type PublishStatus = 'draft' | 'published' | 'archived'

export type NodeType =
  | 'start'
  | 'approval'
  | 'condition'
  | 'parallel'
  | 'join'
  | 'notify'
  | 'end'

export interface NodePosition {
  x?: number
  y?: number
}

export interface ApprovalWorkflowNode {
  id: string
  type: NodeType
  label?: string
  position?: NodePosition
  config?: Record<string, unknown>
  allowedNextTypes?: string[]
}

export interface ApprovalWorkflowEdge {
  id: string
  source: string
  target: string
  condition?: string
  label?: string
  priority?: number
}

/**
 * Entity wire shape (matches backend ApprovalWorkflow entity).
 * Note: backend stores nodes/edges as JSONB strings; this DTO has
 * them deserialized as arrays for editor convenience.
 */
export interface ApprovalWorkflowDTO {
  id: string
  factoryId: string
  decisionType: DecisionType
  name: string
  description?: string
  nodesJson: string // backend JSONB column raw; editor parses
  edgesJson: string
  startNodeId: string
  version: number
  publishStatus: PublishStatus
  enabled: boolean
  priority: number
  createdAt?: string
  updatedAt?: string
}

export interface CreateWorkflowRequest {
  decisionType: DecisionType
  name: string
  description?: string
  nodes: ApprovalWorkflowNode[]
  edges: ApprovalWorkflowEdge[]
  startNodeId: string
  priority?: number
  enabled?: boolean
}

export interface UpdateWorkflowRequest {
  name?: string
  description?: string
  nodes?: ApprovalWorkflowNode[]
  edges?: ApprovalWorkflowEdge[]
  startNodeId?: string
  priority?: number
  enabled?: boolean
}

export interface ValidateResult {
  valid: boolean
  errors: string[]
  warnings: string[]
}

export interface StatisticsResult {
  data: Record<DecisionType, number>
  totalTypes: number
  totalWorkflows: number
}

export interface ApiResponse<T> {
  success: boolean
  data?: T
  message?: string
  code?: string
}

// ==================== API methods ====================

const base = (factoryId: string) => `/api/mobile/${factoryId}/approval-workflows`

export const getAllWorkflows = (factoryId: string) =>
  request.get<ApiResponse<ApprovalWorkflowDTO[]>>(base(factoryId))

export const getWorkflowsByDecisionType = (factoryId: string, decisionType: DecisionType) =>
  request.get<ApiResponse<ApprovalWorkflowDTO[]>>(`${base(factoryId)}/by-type/${decisionType}`)

export const getWorkflowById = (factoryId: string, id: string) =>
  request.get<ApiResponse<ApprovalWorkflowDTO>>(`${base(factoryId)}/${id}`)

export const createWorkflow = (factoryId: string, payload: CreateWorkflowRequest) =>
  request.post<ApiResponse<ApprovalWorkflowDTO>>(base(factoryId), payload)

export const updateWorkflow = (factoryId: string, id: string, payload: UpdateWorkflowRequest) =>
  request.put<ApiResponse<ApprovalWorkflowDTO>>(`${base(factoryId)}/${id}`, payload)

export const deleteWorkflow = (factoryId: string, id: string) =>
  request.delete<ApiResponse<void>>(`${base(factoryId)}/${id}`)

export const publishWorkflow = (factoryId: string, id: string) =>
  request.patch<ApiResponse<ApprovalWorkflowDTO>>(`${base(factoryId)}/${id}/publish`)

export const archiveWorkflow = (factoryId: string, id: string) =>
  request.patch<ApiResponse<ApprovalWorkflowDTO>>(`${base(factoryId)}/${id}/archive`)

export const toggleWorkflow = (factoryId: string, id: string, enabled: boolean) =>
  request.patch<ApiResponse<ApprovalWorkflowDTO>>(
    `${base(factoryId)}/${id}/toggle?enabled=${enabled}`,
  )

export const validateWorkflow = (factoryId: string, payload: CreateWorkflowRequest) =>
  request.post<ApiResponse<ValidateResult>>(`${base(factoryId)}/validate`, payload)

export const getStatistics = (factoryId: string) =>
  request.get<ApiResponse<StatisticsResult>>(`${base(factoryId)}/statistics`)

export const getDecisionTypes = (factoryId: string) =>
  request.get<ApiResponse<DecisionType[]>>(`${base(factoryId)}/decision-types`)
