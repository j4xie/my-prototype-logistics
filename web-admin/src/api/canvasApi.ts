// web-admin/src/api/canvasApi.ts
import request from './request'
import type {
  ToolConfig, SkillConfig, TriggerChain, ValidationRule,
  DefaultValue, Formula, SchedulerConfig,
  ConfigVersion, PublishWindow, CompletenessCheck
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

export const submitForReview = (factoryId: string) =>
  request.post(`/${factoryId}/config/submit-review`)

export const approveConfig = (factoryId: string, notes?: string) =>
  request.post(`/${factoryId}/config/approve`, { notes })

export const rejectConfig = (factoryId: string, reason: string) =>
  request.post(`/${factoryId}/config/reject`, { reason })

export const publishNow = (factoryId: string) =>
  request.post(`/${factoryId}/config/publish-now`)

export const cancelApproval = (factoryId: string) =>
  request.post(`/${factoryId}/config/cancel-approval`)

// Publish window
export const getPublishWindow = (factoryId: string) =>
  request.get<PublishWindow>(`/${factoryId}/config/publish-window`)

export const setPublishWindow = (factoryId: string, window: PublishWindow) =>
  request.put(`/${factoryId}/config/publish-window`, window)

// Completeness check
export const checkCompleteness = (factoryId: string) =>
  request.get<CompletenessCheck>(`/${factoryId}/config/completeness-check`)
