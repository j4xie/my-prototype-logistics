/**
 * Canvas Configuration System — TypeScript 类型定义
 */

// ========== 合并后有效配置 (API 响应) ==========

export interface EffectiveModuleConfig {
  moduleCode: string
  moduleName: string
  enabled: boolean
  fields: EffectiveField[]
  groups: FieldGroup[]
  workflowStates: WorkflowState[]
  workflowTransitions: WorkflowTransition[]
  workflowOptions: Record<string, unknown>
  customLabels: Record<string, string>
  renderingMode: 'LEGACY' | 'DYNAMIC' | 'DUAL'
}

export interface EffectiveField {
  code: string
  label: string
  type: FieldType
  required: boolean
  visible: boolean
  readonly: boolean
  defaultValue: unknown
  options: FieldOption[] | null
  group: string
  order: number
  extra: Record<string, unknown>
}

export type FieldType =
  | 'string'
  | 'text'
  | 'textarea'
  | 'decimal'
  | 'integer'
  | 'boolean'
  | 'date'
  | 'select'
  | 'reference'
  | 'json_array'
  | 'line_items'

export interface FieldOption {
  value: string | number
  label: string
}

export interface FieldGroup {
  code: string
  label: string
  order: number
  visible: boolean
}

export interface WorkflowState {
  code: string
  label: string
  enabled: boolean
  isInitial: boolean
  isFinal: boolean
  tagType: string
}

export interface WorkflowTransition {
  from: string
  to: string
  action: string
  label: string
  buttonType: string
  enabled: boolean
  condition: string | null
  allowedRoles: string[]
}

// ========== 模块摘要 ==========

export interface ModuleSummary {
  moduleCode: string
  moduleName: string
  moduleCategory: string
  enabled: boolean
  renderingMode: string
}

// ========== 写入 DTO ==========

export interface ModuleConfigDTO {
  enabled?: boolean
  fieldConfig?: Record<string, unknown>
  workflowConfig?: Record<string, unknown>
  validationConfig?: Record<string, unknown>
  permissionConfig?: Record<string, unknown>
  layoutConfig?: Record<string, unknown>
  customLabels?: Record<string, unknown>
  renderingMode?: string
}

export interface FieldConfigDTO {
  visible?: boolean
  required?: boolean
  defaultValue?: unknown
  options?: unknown
  label?: string
}

// ========== Reference 配置 ==========

export interface ReferenceConfig {
  entity: string
  displayField: string
  valueField: string
  searchFields?: string[]
  filter?: Record<string, unknown>
  apiEndpoint: string
}

// ========== 行项目 Schema ==========

export interface ItemSchemaField {
  code: string
  type: FieldType
  label: string
  required: boolean
  min?: number
  max?: number
  precision?: number
  options?: FieldOption[]
  computed?: string
}

// ========== 模块 API 路径映射 ==========

export const MODULE_API_PATHS: Record<string, string> = {
  sales_order: 'sales-orders',
  bom: 'bom-items',
  inbound: 'material-batches/inbound',
  outbound: 'material-batches/outbound',
  production_report: 'work-reports',
  production_plan: 'production-plans',
  purchase_order: 'purchase-orders',
  quality_inspection: 'quality-inspections',
  equipment: 'equipment',
  inventory: 'inventory',
  customer: 'customers',
  supplier: 'suppliers',
  finance_ar: 'finance/ar',
  finance_ap: 'finance/ap',
  hr_employee: 'hr/employees',
  transfer: 'transfers',
  traceability: 'traceability',
}
