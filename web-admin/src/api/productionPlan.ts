/**
 * Production Plan API
 * Import/Export and reference data endpoints for production plans
 */
import request from './request'
import { get, post } from './request'

/** Download the Excel import template (returns Blob) */
export function downloadImportTemplate(factoryId: string) {
  return request.get(`/${factoryId}/production-plans/import-template`, {
    responseType: 'blob',
  })
}

/** Import production plans from an Excel file */
export function importProductionPlans(factoryId: string, formData: FormData) {
  return post<{
    totalCount: number
    successCount: number
    failureCount: number
    failureDetails?: Array<{ rowNumber: number; reason: string }>
  }>(`/${factoryId}/production-plans/import`, formData)
}

/** Export production plans as Excel (returns Blob) */
export function exportProductionPlans(factoryId: string, params?: Record<string, string>) {
  return request.get(`/${factoryId}/production-plans/export`, {
    params,
    responseType: 'blob',
  })
}

/** Get all production lines for a factory */
export function getProductionLines(factoryId: string) {
  return get<any[]>(`/${factoryId}/production-lines`)
}

/** Get supervisors (workshop supervisors) for a factory */
export function getSupervisors(factoryId: string) {
  return get<any[]>(`/${factoryId}/users`, {
    params: { role: 'WORKSHOP_SUPERVISOR' },
  })
}
