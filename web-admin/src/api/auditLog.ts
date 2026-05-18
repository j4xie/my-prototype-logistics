// PR #861 (Sprint 4 Wave 2 follow-up) — operation log query client.
//
// Backend: OperationLogController @RequestMapping
//   "/api/mobile/{factoryId}/operation-logs"
//   (Sprint 4 Chat K C-LOG-AUDIT-1, V20260525_03 migration, @Loggable AOP)
//
// axios baseURL = '/api/mobile' so caller-side URLs start at "/{factoryId}/...".
//
// Response envelope: Spring Page<OperationLog> wrapped in ApiResponse<>.
// AuditLogDrawer is the primary consumer (per-entity timeline view).

import { get } from './request';

/**
 * 1:1 mirror of backend `com.cretas.aims.entity.datacenter.OperationLog`
 * (V20260525_03 schema). Fields are nullable where the JPA entity allows null
 * (userId / oldValue on CREATE / newValue on DELETE / errorMessage on success).
 */
export interface OperationLog {
  id: number;
  factoryId: string;
  userId?: number | null;
  username?: string | null;
  /** 业务模块 (CUSTOMER / MATERIAL / PURCHASE / SALES / ...). */
  module: string;
  /** CREATE | UPDATE | DELETE | EXPORT | IMPORT | OTHER. */
  action: string;
  /** Entity 简单类名, e.g. "Customer" / "PurchaseOrder". */
  entityType?: string | null;
  /** Entity 主键 (字符串化, e.g. UUID 或 Long). */
  entityId?: string | null;
  /** Full snapshot before the change; null on CREATE. */
  oldValue?: Record<string, unknown> | null;
  /** Full snapshot after the change; null on DELETE. */
  newValue?: Record<string, unknown> | null;
  /** Field-level diff: [{"field":"name","from":"foo","to":"bar"}, ...]. */
  diff?: Array<Record<string, unknown>> | null;
  /** 业务级人类可读说明 (AOP fill-in if @Loggable supplies summary expression). */
  summary?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  /** AOP 测得耗时, ms. */
  elapsedMs?: number | null;
  success: boolean;
  errorMessage?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
}

/** Spring `Page<OperationLog>` shape. */
export interface OperationLogPage {
  content: OperationLog[];
  totalElements: number;
  totalPages: number;
  number: number; // 0-based current page
  size: number;
}

/** Query params for `GET /operation-logs`. All optional. */
export interface ListOperationLogsParams {
  module?: string;
  action?: string;
  userId?: number;
  entityType?: string;
  entityId?: string;
  /** ISO-8601 datetime, e.g. 2026-05-18T00:00:00. */
  start?: string;
  /** ISO-8601 datetime. */
  end?: string;
  /** 0-based page index. */
  page?: number;
  /** Default 50, max 200 (backend clamps). */
  size?: number;
}

function basePath(factoryId: string): string {
  return `/${factoryId}/operation-logs`;
}

/**
 * Paginated list query — primary entry for AuditLogDrawer.
 *
 * On API failure returns an empty page rather than throwing, mirroring the
 * pattern in customerTracking.ts so the drawer can render a graceful empty
 * state. (The axios interceptor surfaces error toasts/notifications already.)
 */
export async function listOperationLogs(
  factoryId: string,
  params: ListOperationLogsParams = {}
): Promise<OperationLogPage> {
  const res = await get<OperationLogPage>(basePath(factoryId), { params });
  if (!res.success || !res.data) {
    return { content: [], totalElements: 0, totalPages: 0, number: 0, size: params.size ?? 50 };
  }
  return res.data;
}

/**
 * Fetch one log by id (used by drawer expand → full diff view).
 *
 * RBAC: factory_super_admin / permission_admin only (backend @RequireRole).
 * Backend also enforces factoryId match defensively.
 */
export async function getOperationLog(
  factoryId: string,
  logId: number
): Promise<OperationLog> {
  const res = await get<OperationLog>(`${basePath(factoryId)}/${logId}`);
  if (!res.success || !res.data) {
    throw new Error(res.message || '加载操作日志失败');
  }
  return res.data;
}
