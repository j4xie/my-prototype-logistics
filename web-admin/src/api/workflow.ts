import { get, post, put, adminGet, adminPost, adminPut } from './request'

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

// URL moved from /api/workflow/node-schemas to /api/mobile/workflow/node-schemas
// to be proxied by 139 nginx gateway (old URL returned index.html silently,
// causing R20-F2 "766 empty 📦 tiles" bug). Switched from adminGet (absolute)
// to get (relative to /api/mobile baseURL).
export function getNodeSchemas() {
  return get<NodeSchema[]>('/workflow/node-schemas')
}

export function getNodeSchemasByCategory(category: string) {
  return get<NodeSchema[]>('/workflow/node-schemas/by-category', { params: { category } })
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
  return get<StateMachineConfig>(`/${factoryId}/rules/state-machines/${entityType}`, { _silent: true } as never)
}

export function getVersionHistory(factoryId: string, entityType: string) {
  return get<StateMachineConfig[]>(`/${factoryId}/state-machines/${entityType}/versions`)
}

export function publishDraft(factoryId: string, entityType: string, draftId: number) {
  return post<StateMachineConfig>(`/${factoryId}/state-machines/${entityType}/publish/${draftId}`)
}

export function saveStateMachine(factoryId: string, data: Partial<StateMachineConfig>) {
  return post<StateMachineConfig>(`/${factoryId}/state-machines`, data)
}

export function updateStateMachine(factoryId: string, id: number, data: Partial<StateMachineConfig>) {
  return put<StateMachineConfig>(`/${factoryId}/state-machines/${id}`, data)
}
