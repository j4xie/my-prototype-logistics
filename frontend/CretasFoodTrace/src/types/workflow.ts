/**
 * Workflow visualizer types — shared between RN client, hooks, and backend
 * response contract. Kept narrow so swapping data source is mechanical.
 */

export type WorkflowNodeStatus = 'PENDING' | 'IN_PROGRESS' | 'DONE';

export type WorkflowModule =
  | 'sales'
  | 'purchase'
  | 'production'
  | 'finance'
  | 'inventory';

export interface WorkflowNode {
  id: string;
  label: string;
  status: WorkflowNodeStatus;
  count: number;
}

export interface WorkflowStatsPayload {
  module: WorkflowModule | string;
  nodes: WorkflowNode[];
  lastRefreshedAt: string;
}

export interface WorkflowAIEntryContext {
  module: WorkflowModule | string;
  node?: string;
  factoryId?: string;
}

/**
 * FU Chat 3 — bucket→status filter mapping (2026-05-16).
 *
 * Workflow node id (pending/in_progress/done) 是 bucket — 后端将多个 status enum
 * 值归入同一 bucket. List view filter 是单值 statusFilter, 没法表达多状态.
 *
 * 此 map: bucket → **该 bucket 内的代表性 status enum 值** (lossy 单值).
 * 调用方拿到后 set statusFilter + 刷新 list. 用户看到子集 — 想看完整 bucket 时
 * 可以打开 status 下拉切其他值. UI 应该 toast 提示这是 lossy 子集.
 *
 * 选择原则:
 * - pending: 选最 actionable 的 (需用户审批/处理的状态)
 * - in_progress: 选有真实活动的状态
 * - done: 终态
 *
 * 这是临时方案; 后端列表 endpoint 加 ?statusIn=A,B,C 多值参数后可以淘汰.
 */
export const BUCKET_PRIMARY_STATUS: Record<WorkflowModule, Record<string, string>> = {
  sales: {
    pending: 'PENDING_FINANCE_REVIEW',
    in_progress: 'PROCESSING',
    done: 'COMPLETED',
  },
  purchase: {
    pending: 'PENDING_FINANCE_REVIEW',
    in_progress: 'PARTIAL_RECEIVED',
    done: 'COMPLETED',
  },
  production: {
    pending: 'PENDING',
    in_progress: 'IN_PROGRESS',
    done: 'COMPLETED',
  },
  finance: {
    // Invoice 视角: REQUESTED/APPROVED/ISSUED. Backend done 复合 Payment.VERIFIED,
    // 但 invoice list 不能筛 payment 状态 — done 暂取 ISSUED.
    pending: 'REQUESTED',
    in_progress: 'ISSUED',
    done: 'ISSUED',
  },
  inventory: {
    // MaterialBatchStatus: pending=异常(取 EXPIRED 最 urgent) / in_progress=活动(取 INSPECTING) / done=可用(取 AVAILABLE)
    pending: 'EXPIRED',
    in_progress: 'INSPECTING',
    done: 'AVAILABLE',
  },
};

/**
 * Lookup bucket → primary status enum value. 未知 module/bucket 返回 empty string.
 */
export function getBucketPrimaryStatus(
  module: WorkflowModule | string,
  bucket: string,
): string {
  const moduleMap = BUCKET_PRIMARY_STATUS[module as WorkflowModule];
  if (!moduleMap) return '';
  return moduleMap[bucket] ?? '';
}
