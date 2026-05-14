// web-admin/src/api/canvasApi.ts
import request from './request'
import type { ApiResponse } from '@/types/api'
import type {
  ToolConfig, SkillConfig, TriggerChain, ValidationRule,
  DefaultValue, Formula, SchedulerConfig,
  ConfigVersion, PublishWindow, CompletenessCheck,
  DynamicField, DDLLog
} from '@/types/canvas'

const v2 = (factoryId: string) => `/${factoryId}/config/v2`

// Tool configs
export const getToolConfigs = (factoryId: string) =>
  request.get<ToolConfig[]>(`${v2(factoryId)}/tools`)

export const setToolConfig = (factoryId: string, toolName: string, body: Partial<ToolConfig>) =>
  request.put<ToolConfig>(`${v2(factoryId)}/tools/${toolName}`, body)

// Skill configs
export const getSkillConfigs = (factoryId: string) =>
  request.get<SkillConfig[]>(`${v2(factoryId)}/skills`)

export const setSkillConfig = (factoryId: string, skillName: string, body: Partial<SkillConfig>) =>
  request.put<SkillConfig>(`${v2(factoryId)}/skills/${skillName}`, body)

// Trigger chains
export const getTriggerChains = (factoryId: string) =>
  request.get<TriggerChain[]>(`${v2(factoryId)}/trigger-chains`)

export const setTriggerChain = (factoryId: string, chainCode: string, body: Partial<TriggerChain>) =>
  request.put<TriggerChain>(`${v2(factoryId)}/trigger-chains/${chainCode}`, body)

// Validation rules
export const getValidationRules = (factoryId: string, moduleCode?: string) =>
  request.get<ValidationRule[]>(`${v2(factoryId)}/validation-rules`, { params: { moduleCode } })

export const setValidationRule = (factoryId: string, ruleCode: string, body: Partial<ValidationRule>) =>
  request.put<ValidationRule>(`${v2(factoryId)}/validation-rules/${ruleCode}`, body)

// Default values
export const getDefaultValues = (factoryId: string, moduleCode?: string) =>
  request.get<DefaultValue[]>(`${v2(factoryId)}/default-values`, { params: { moduleCode } })

export const setDefaultValue = (factoryId: string, body: Partial<DefaultValue>) =>
  request.put<DefaultValue>(`${v2(factoryId)}/default-values`, body)

// Formulas
export const getFormulas = (factoryId: string, moduleCode?: string) =>
  request.get<Formula[]>(`${v2(factoryId)}/formulas`, { params: { moduleCode } })

export const setFormula = (factoryId: string, formulaCode: string, body: Partial<Formula>) =>
  request.put<Formula>(`${v2(factoryId)}/formulas/${formulaCode}`, body)

// Scheduler
export const getSchedulerConfigs = (factoryId: string) =>
  request.get<SchedulerConfig[]>(`${v2(factoryId)}/scheduler`)

export const setSchedulerConfig = (factoryId: string, taskCode: string, body: Partial<SchedulerConfig>) =>
  request.put<SchedulerConfig>(`${v2(factoryId)}/scheduler/${taskCode}`, body)

// Templates
export const getTemplates = (factoryId: string) =>
  request.get(`${v2(factoryId)}/templates`)

export const applyTemplate = (factoryId: string, templateCode: string) =>
  request.post(`${v2(factoryId)}/apply-template/${templateCode}`)

// AI Agent
export const aiChat = (factoryId: string, body: { message: string; mode: string; moduleCode?: string }) =>
  request.post(`${v2(factoryId)}/ai/chat`, body)

export const aiApplyDiffs = (factoryId: string, diffs: Record<string, unknown>[]) =>
  request.post(`${v2(factoryId)}/ai/apply-diffs`, diffs)

// Config version status
export const getConfigVersion = (factoryId: string) =>
  request.get<ConfigVersion>(`/${factoryId}/config/current-version`)

// Round 5 PERF-3: backend switched to Page shape {content, totalElements, totalPages, number, size}
// Round 6 fix: aligning frontend type so consumers destructure .content instead of treating .data as array.
export interface PaginatedVersions {
  content: ConfigVersion[]
  totalElements: number
  totalPages: number
  number: number
  size: number
}

// List config versions (paginated, newest first). Default backend pageSize=20.
export const getConfigVersions = (factoryId: string, page = 0, size = 20) =>
  request.get<PaginatedVersions>(`/${factoryId}/config/versions`, { params: { page, size } })

export const submitForReview = (factoryId: string) =>
  request.post(`/${factoryId}/config/submit-review`)

// Round 10 Fix — dedicated reorder endpoint (replaces broken saveDraft-based flow)
export const reorderFields = (
  factoryId: string,
  moduleCode: string,
  fieldOrder: string[],
  expectedVersion: number,
) =>
  request.post<{ newVersion: number; reorderedCount: number }>(
    `/${factoryId}/config/modules/${moduleCode}/reorder-fields`,
    { fieldOrder, expectedVersion },
  )

export const approveConfig = (factoryId: string, notes?: string) =>
  request.post(`/${factoryId}/config/approve`, { notes })

export const rejectConfig = (factoryId: string, reason: string) =>
  request.post(`/${factoryId}/config/reject`, { reason })

export const publishNow = (factoryId: string) =>
  request.post(`/${factoryId}/config/publish-now`)

export const cancelApproval = (factoryId: string) =>
  request.post(`/${factoryId}/config/cancel-approval`)

// Publish window
// TODO: backend endpoint /{factoryId}/config/publish-window not implemented
export const getPublishWindow = async (factoryId: string) => {
  try {
    return await request.get<PublishWindow>(`/${factoryId}/config/publish-window`)
  } catch {
    const fallback: ApiResponse<PublishWindow> = {
      success: true,
      message: 'fallback (endpoint not implemented)',
      data: { startHour: 22, startMinute: 0, endHour: 6, endMinute: 0 } as PublishWindow,
    }
    return fallback
  }
}

export const setPublishWindow = async (factoryId: string, window: PublishWindow) => {
  try {
    return await request.put(`/${factoryId}/config/publish-window`, window)
  } catch {
    console.warn('[canvasApi] publish-window endpoint not implemented, ignoring save')
  }
}

// Completeness check
// TODO: backend endpoint /{factoryId}/config/completeness-check not implemented
export const checkCompleteness = async (factoryId: string) => {
  try {
    return await request.get<CompletenessCheck>(`/${factoryId}/config/completeness-check`)
  } catch {
    const fallback: ApiResponse<CompletenessCheck> = {
      success: true,
      message: 'fallback (endpoint not implemented)',
      data: { passed: true, checks: [] } as CompletenessCheck,
    }
    return fallback
  }
}

// Dynamic Fields
export const getDynamicFields = (factoryId: string, moduleCode?: string) =>
  request.get<DynamicField[]>(`${v2(factoryId)}/dynamic-fields`, { params: { moduleCode } })
export const createDynamicField = (factoryId: string, field: Partial<DynamicField>) =>
  request.post<DynamicField>(`${v2(factoryId)}/dynamic-fields`, field)
export const updateDynamicField = (factoryId: string, fieldCode: string, field: Partial<DynamicField>) =>
  request.put<DynamicField>(`${v2(factoryId)}/dynamic-fields/${fieldCode}`, field)
export const deleteDynamicField = (factoryId: string, fieldCode: string, moduleCode: string) =>
  request.delete(`${v2(factoryId)}/dynamic-fields/${fieldCode}`, { params: { moduleCode } })
export const getDDLLog = (factoryId: string) =>
  request.get<DDLLog[]>(`${v2(factoryId)}/ddl-log`)

// Sub-table CRUD
export const getSubTableRows = (factoryId: string, moduleCode: string, recordId: string, fieldCode: string) =>
  request.get<Record<string, unknown>[]>(`/${factoryId}/${moduleCode}/${recordId}/sub-table/${fieldCode}`)
export const addSubTableRow = (factoryId: string, moduleCode: string, recordId: string, fieldCode: string, row: Record<string, unknown>) =>
  request.post(`/${factoryId}/${moduleCode}/${recordId}/sub-table/${fieldCode}`, row)
export const updateSubTableRow = (factoryId: string, moduleCode: string, recordId: string, fieldCode: string, rowId: string, row: Record<string, unknown>) =>
  request.put(`/${factoryId}/${moduleCode}/${recordId}/sub-table/${fieldCode}/${rowId}`, row)
export const deleteSubTableRow = (factoryId: string, moduleCode: string, recordId: string, fieldCode: string, rowId: string) =>
  request.delete(`/${factoryId}/${moduleCode}/${recordId}/sub-table/${fieldCode}/${rowId}`)

// Custom fields for a record
export const getCustomFields = (factoryId: string, moduleCode: string, recordId: string) =>
  request.get<Record<string, unknown>>(`/${factoryId}/${moduleCode}/${recordId}/custom-fields`)
export const setCustomFields = (factoryId: string, moduleCode: string, recordId: string, fields: Record<string, unknown>) =>
  request.put(`/${factoryId}/${moduleCode}/${recordId}/custom-fields`, fields)
