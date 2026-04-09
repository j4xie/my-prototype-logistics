// web-admin/src/api/canvasApi.ts
import request from '@/utils/request'
import type {
  ToolConfig, SkillConfig, TriggerChain, ValidationRule,
  DefaultValue, Formula, SchedulerConfig
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
