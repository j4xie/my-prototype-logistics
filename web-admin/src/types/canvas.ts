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
