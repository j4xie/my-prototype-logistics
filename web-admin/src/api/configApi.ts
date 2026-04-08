/**
 * Canvas 配置系统 API
 */
import request from './request'
import type { ApiResponse } from '@/types/api'
import type {
  EffectiveModuleConfig,
  ModuleSummary,
  ModuleConfigDTO,
  FieldConfigDTO,
} from '@/types/config'

const BASE = '/api/platform/config'

// ========== 配置消费 API (前端渲染器用) ==========

/** 获取合并后的有效配置 */
export function getEffectiveConfig(
  factoryId: string,
  moduleCode: string,
  roleCode?: string,
): Promise<ApiResponse<EffectiveModuleConfig>> {
  const params = roleCode ? { roleCode } : {}
  return request.get(`${BASE}/${factoryId}/modules/${moduleCode}/effective`, { params })
}

/** 获取所有模块摘要 */
export function getModules(factoryId: string): Promise<ApiResponse<ModuleSummary[]>> {
  return request.get(`${BASE}/${factoryId}/modules`)
}

// ========== 配置管理 API (画布编辑器用) ==========

/** 保存模块配置 */
export function saveModuleConfig(
  factoryId: string,
  moduleCode: string,
  dto: ModuleConfigDTO,
): Promise<ApiResponse<void>> {
  return request.put(`${BASE}/${factoryId}/modules/${moduleCode}`, dto)
}

/** 更新单个字段配置 */
export function updateFieldConfig(
  factoryId: string,
  moduleCode: string,
  fieldCode: string,
  dto: FieldConfigDTO,
): Promise<ApiResponse<void>> {
  return request.patch(`${BASE}/${factoryId}/modules/${moduleCode}/fields/${fieldCode}`, dto)
}

/** 开关模块 */
export function toggleModule(
  factoryId: string,
  moduleCode: string,
  enabled: boolean,
): Promise<ApiResponse<void>> {
  return request.patch(`${BASE}/${factoryId}/modules/${moduleCode}/toggle`, null, {
    params: { enabled },
  })
}

// ========== 发布与版本 ==========

/** 发布配置 */
export function publishConfig(
  factoryId: string,
  summary?: string,
): Promise<ApiResponse<void>> {
  return request.post(`${BASE}/${factoryId}/publish`, null, {
    params: summary ? { summary } : {},
  })
}

/** 回滚到指定版本 */
export function rollbackConfig(
  factoryId: string,
  version: number,
): Promise<ApiResponse<void>> {
  return request.post(`${BASE}/${factoryId}/rollback/${version}`)
}
