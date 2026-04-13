// web-admin/src/types/canvas.ts

export interface ToolConfig {
  id: number
  factoryId: string
  toolName: string
  enabled: boolean
  paramOverrides: Record<string, unknown>
  riskOverride?: string
  customDescription?: string
}

export interface SkillConfig {
  id: number
  factoryId: string
  skillName: string
  enabled: boolean
  customDag?: Record<string, unknown>
  customTriggers?: string[]
  priority: number
}

export interface TriggerChain {
  id: number
  factoryId: string | null
  chainCode: string
  eventType: string
  enabled: boolean
  steps: TriggerStep[]
  errorStrategy: 'CONTINUE' | 'STOP'
  description?: string
}

export interface TriggerStep {
  order: number
  tool: string
  condition: string
  enabled: boolean
  params: Record<string, unknown>
}

export interface ValidationRule {
  id: number
  factoryId: string | null
  moduleCode: string
  ruleCode: string
  operation?: string
  condition: string
  errorMessage: string
  enabled: boolean
  severity: 'BLOCK' | 'WARN' | 'INFO'
  sortOrder: number
}

export interface DefaultValue {
  id: number
  factoryId: string | null
  moduleCode: string
  fieldCode: string
  defaultValue: unknown
  condition?: string
  description?: string
}

export interface Formula {
  id: number
  factoryId: string | null
  moduleCode: string
  formulaCode: string
  expression: string
  variables?: Record<string, string>
  resultType: string
  precisionVal: number
  description?: string
}

export interface SchedulerConfig {
  id: number
  factoryId: string | null
  taskCode: string
  cronExpression: string
  enabled: boolean
  toolOrMethod?: string
  params: Record<string, unknown>
  description?: string
}

export type AIAgentMode = 'autopilot' | 'plan' | 'action'

export interface AIMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: number
  diffPreview?: ConfigDiff[]
}

export interface ConfigDiff {
  type: 'TOOL_TOGGLE' | 'TRIGGER_CHAIN_CHANGE' | 'VALIDATION_RULE_CHANGE' | 'DEFAULT_VALUE_CHANGE' | 'FIELD_CHANGE' | 'WORKFLOW_CHANGE'
  path: string
  before: unknown
  after: unknown
  description: string
}

export type ConfigStatus = 'DRAFT' | 'PENDING_REVIEW' | 'APPROVED' | 'PUBLISHED' | 'REJECTED'

export interface ConfigVersion {
  id: number
  factoryId: string
  configVersion: number
  // Round 10 Fix: JPA optimistic-lock counter on FactoryConfiguration. Used by
  // POST /reorder-fields as expectedVersion. The backend exposes this as
  // `rowVersion` (not `configVersion`) because configVersion is the business
  // version label, while rowVersion is the @Version row-level lock.
  rowVersion?: number
  status: ConfigStatus
  publishedAt?: string
  publishedBy?: number
  submittedBy?: number
  submittedAt?: string
  reviewedBy?: number
  reviewedAt?: string
  reviewNotes?: string
  changeSummary?: string
}

export interface PublishWindow {
  startHour: number   // 0-23, default 22
  startMinute: number // 0-59, default 0
  endHour: number     // 0-23, default 6
  endMinute: number   // 0-59, default 0
}

export interface OnboardingState {
  step: 1 | 2 | 3 | 4
  selectedTemplate: string | null
  enabledModules: string[]
  workflowsConfirmed: boolean
}

export interface CompletenessCheck {
  passed: boolean
  checks: {
    name: string
    passed: boolean
    message: string
  }[]
}

// Canvas V3 Dynamic Fields — Round 4 Fix P1-11: added TEXTAREA/DATETIME/BOOLEAN
export type DynamicFieldType =
  | 'TEXT' | 'TEXTAREA' | 'NUMBER' | 'DECIMAL' | 'SELECT'
  | 'DATE' | 'DATETIME' | 'BOOLEAN'
  | 'ATTACHMENT' | 'SUB_TABLE'
export type DynamicFieldStatus = 'PENDING_DDL' | 'ACTIVE' | 'DISABLED'

export interface DynamicFieldConfig {
  maxLength?: number
  min?: number
  max?: number
  precision?: number
  options?: Array<{ value: string; label: string }>
  accept?: string
  maxSize?: number
  maxCount?: number
  columns?: Array<{ code: string; label: string; type: string; required?: boolean }>
}

export interface DynamicField {
  id: string
  factoryId: string | null
  moduleCode: string
  fieldCode: string
  fieldType: DynamicFieldType
  label: string
  config: DynamicFieldConfig
  visibleWhen?: string
  computedWhen?: string
  sortOrder: number
  status: DynamicFieldStatus
  columnName?: string
}

export interface DDLLog {
  id: string
  factoryId: string
  configVersion: number
  ddlStatement: string
  targetTable: string
  status: 'PENDING' | 'EXECUTED' | 'FAILED' | 'ROLLED_BACK'
  executedAt?: string
  errorMessage?: string
}
