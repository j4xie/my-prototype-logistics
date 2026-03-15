import { adminGet as get, adminPost as post, adminPut as put } from './request'

// === Workflow Node Schemas ===

export interface NodeSchema {
  nodeType: string
  displayName: string
  description: string
  icon: string
  color: string
  category: string
  configSchema: Record<string, unknown>
  defaultConfig: Record<string, unknown>
  allowedNextNodes: string[]
  availableGuards: string[]
}

export function getNodeSchemas() {
  return get<NodeSchema[]>('/api/workflow/node-schemas')
}

export function getNodeSchemasByCategory(category: string) {
  return get<NodeSchema[]>('/api/workflow/node-schemas/by-category', { params: { category } })
}

// === State Machine ===

export interface StateMachineConfig {
  id: number
  factoryId: string
  entityType: string
  version: number
  publishStatus: string
  statesJson: string
  transitionsJson: string
  createdAt: string
  updatedAt: string
}

export interface SMState {
  code: string
  name: string
  type: 'initial' | 'normal' | 'final'
  description?: string
  color?: string
  // Extended properties
  nodeSchemaType?: string
  nodeCategory?: string
  nodeConfig?: Record<string, unknown>
  assignedRoles?: string[]
  timeLimitMinutes?: number
  autoEscalate?: boolean
  entryGuard?: string
  onEnterAction?: string
  onExitAction?: string
}

export interface SMTransition {
  from: string
  to: string
  event: string
  guard?: string
  action?: string
  roles?: string[]
  description?: string
  notifyRoles?: string[]
}

export function getPublishedStateMachine(factoryId: string, entityType: string) {
  return get<StateMachineConfig>(`/api/mobile/${factoryId}/state-machines/${entityType}/published`)
}

export function getVersionHistory(factoryId: string, entityType: string) {
  return get<StateMachineConfig[]>(`/api/mobile/${factoryId}/state-machines/${entityType}/versions`)
}

export function publishDraft(factoryId: string, entityType: string, draftId: number) {
  return post<StateMachineConfig>(`/api/mobile/${factoryId}/state-machines/${entityType}/publish/${draftId}`)
}

export function saveStateMachine(factoryId: string, data: Partial<StateMachineConfig>) {
  return post<StateMachineConfig>(`/api/mobile/${factoryId}/state-machines`, data)
}

export function updateStateMachine(factoryId: string, id: number, data: Partial<StateMachineConfig>) {
  return put<StateMachineConfig>(`/api/mobile/${factoryId}/state-machines/${id}`, data)
}
