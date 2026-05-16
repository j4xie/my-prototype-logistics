/**
 * C-PRT-EDITOR-1 — print template CRUD + preview API client.
 *
 * Reuses existing FormTemplateController (/api/mobile/{factoryId}/form-templates/*)
 * with PRINT_* entityType. Print preview endpoint goes through new
 * /api/mobile/{factoryId}/print/preview-template (Day 4 backend ship).
 *
 * Storage shape (see design doc §3.2): schemaJson stores a Formily-wrapped
 *   {type: "object", properties: {_printSchema: PrintTemplateSchema}}
 * Use wrapForStorage / unwrapFromStorage from utils/printSchemaTypes.ts.
 */

import request from './request'
import type { AxiosError, AxiosRequestConfig, AxiosResponse } from 'axios'
import { ElMessage } from 'element-plus'
import type {
  PrintEntityType,
  PrintTemplateSchema,
  FormilyWrappedPrintSchema,
} from '@/views/platform/print-template-editor/utils/printSchemaTypes'
import { wrapForStorage, unwrapFromStorage } from '@/views/platform/print-template-editor/utils/printSchemaTypes'

export interface FormTemplateRow {
  id: string
  factoryId: string
  name: string
  entityType: string
  schemaJson: string
  uiSchemaJson: string | null
  description?: string | null
  version: number
  isActive: boolean
  source?: string | null
  createdBy?: number | null
  createdAt?: string
  updatedAt?: string
}

export interface PrintTemplateResponse {
  id: string
  entityType: string
  name: string
  schemaJson: string
  uiSchemaJson: string | null
  version: number
  source?: string | null
}

/**
 * Defensive envelope unwrap. The shared `request.ts` response interceptor
 * returns the full ApiResponse envelope {success, data, message} (see
 * canvasApi/permissionApi for sibling consumers that access `.data`).
 * Some legacy printTemplate code cast through assuming `resp` was already
 * unwrapped — that path made `resp.schemaJson` undefined (Issue #719),
 * because the envelope has no top-level schemaJson, only nested under
 * `resp.data.schemaJson`. Detect by checking for the `success` discriminant
 * so we tolerate both shapes if a future interceptor change rewires this.
 */
export function unwrapApiEnvelope<T>(resp: unknown): T | null {
  if (resp == null) return null
  if (
    typeof resp === 'object' &&
    'success' in (resp as Record<string, unknown>) &&
    'data' in (resp as Record<string, unknown>)
  ) {
    return ((resp as { data: T | null }).data) ?? null
  }
  return resp as T
}

/**
 * Fetch active template by factoryId + entityType, returning the unwrapped
 * PrintTemplateSchema (or null when no custom template exists).
 */
export async function getPrintTemplate(
  factoryId: string,
  entityType: PrintEntityType,
): Promise<{ id: string; name: string; schema: PrintTemplateSchema; version: number } | null> {
  const resp = await request.get<PrintTemplateResponse | null>(
    `/${factoryId}/form-templates/${entityType}`,
  )
  const data = unwrapApiEnvelope<PrintTemplateResponse>(resp)
  if (!data) return null
  const schema = unwrapFromStorage(data.schemaJson)
  if (!schema) {
    ElMessage.warning('模板格式异常 — schema 解析失败, 请检查或重新创建')
    return null
  }
  return { id: data.id, name: data.name, schema, version: data.version }
}

/**
 * Create-or-update (idempotent PUT by entityType). Returns the saved row.
 */
export async function savePrintTemplate(
  factoryId: string,
  entityType: PrintEntityType,
  name: string,
  schema: PrintTemplateSchema,
  uiSchema?: Record<string, unknown> | null,
): Promise<FormTemplateRow> {
  const wrapped: FormilyWrappedPrintSchema = wrapForStorage(schema)
  const body = {
    name,
    schemaJson: JSON.stringify(wrapped),
    uiSchemaJson: uiSchema ? JSON.stringify(uiSchema) : null,
  }
  const resp = await request.put<FormTemplateRow>(
    `/${factoryId}/form-templates/${entityType}`,
    body,
  )
  const saved = unwrapApiEnvelope<FormTemplateRow>(resp)
  if (!saved) {
    throw new Error('保存返回为空,请稍后重试')
  }
  return saved
}

/**
 * List versions for a template id (uses existing version history endpoint).
 */
export interface PrintTemplateVersionMeta {
  id: string
  version: number
  name: string
  changeSummary?: string | null
  source?: string | null
  createdAt: string
  createdBy?: number | null
}

export async function listVersions(
  factoryId: string,
  templateId: string,
): Promise<PrintTemplateVersionMeta[]> {
  const resp = await request.get<PrintTemplateVersionMeta[]>(
    `/${factoryId}/form-templates/id/${templateId}/versions`,
  )
  return unwrapApiEnvelope<PrintTemplateVersionMeta[]>(resp) ?? []
}

/**
 * Server-side PDF preview. Hits new Java endpoint (Day 4 ship). The Java
 * controller proxies to Python /api/printing/render-template which loads
 * the template from form_templates table (RLS-scoped via factoryId GUC)
 * and applies the schema to the supplied entity / mock data.
 *
 * Returns the PDF as a Blob — caller decides whether to open in modal or
 * trigger download.
 */
type BlobRequestConfig = AxiosRequestConfig & { _keepResponse?: boolean }

export interface PreviewTemplateRequest {
  /** Use existing template by id (preferred for saved templates). */
  templateId?: string | null
  /** Or send raw schema for live editor preview without persistence. */
  inlineSchema?: PrintTemplateSchema | null
  /** Real entity to fetch; mutually exclusive with mockData. */
  entityId?: string | null
  entityType: PrintEntityType
  /** Sample data for editor preview when no real entity selected. */
  mockData?: Record<string, unknown> | null
}

export async function previewPrintTemplate(
  factoryId: string,
  payload: PreviewTemplateRequest,
): Promise<Blob> {
  const body = {
    templateId: payload.templateId ?? null,
    inlineSchemaJson: payload.inlineSchema
      ? JSON.stringify(wrapForStorage(payload.inlineSchema))
      : null,
    entityId: payload.entityId ?? null,
    entityType: payload.entityType,
    mockData: payload.mockData ?? null,
  }
  const config: BlobRequestConfig = {
    responseType: 'blob',
    _keepResponse: true,
  }

  let response: AxiosResponse<Blob>
  try {
    response = await request.post(
      `/${factoryId}/print/preview-template`,
      body,
      config,
    ) as unknown as AxiosResponse<Blob>
  } catch (err) {
    const axErr = err as AxiosError
    const status = axErr?.response?.status
    if (status === 403) {
      ElMessage.error('当前角色无预览权限')
    } else if (status === 404) {
      ElMessage.error('模板未找到 — 请先保存或检查工厂归属')
    } else if (status === 502) {
      ElMessage.error('打印服务暂不可用 — 请稍后重试')
    } else {
      ElMessage.error(`预览失败 (${status ?? '网络异常'})`)
    }
    throw err
  }

  const blob = response.data instanceof Blob
    ? response.data
    : new Blob([response.data], { type: 'application/pdf' })
  if (blob.size === 0) {
    ElMessage.error('预览服务返回空 PDF')
    throw new Error('Empty PDF')
  }
  return blob
}
