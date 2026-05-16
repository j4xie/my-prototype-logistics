/**
 * Workflow visualizer types — must stay in sync with
 * `frontend/CretasFoodTrace/src/types/workflow.ts` and the
 * backend `WorkflowStatsController` response.
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
 * Mirrors `frontend/CretasFoodTrace/src/types/workflow.ts` BUCKET_PRIMARY_STATUS.
 *
 * Workflow node id (pending/in_progress/done) 是 bucket — 后端将多个 status enum
 * 值归入同一 bucket. List view filter 是单值 statusFilter, 没法表达多状态.
 *
 * 此 map: bucket → **该 bucket 内的代表性 status enum 值** (lossy 单值).
 * 调用方拿到后 set statusFilter + 刷新 list. 用户看到子集 — 想看完整 bucket 时
 * 可以打开 status 下拉切其他值. UI 应该 toast 提示这是 lossy 子集.
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
 * Bucket label 中文 (toast 提示用). 跟后端 WorkflowStatsService 的 label 对齐.
 */
export const BUCKET_LABEL: Record<WorkflowModule, Record<string, string>> = {
  sales: { pending: '待审', in_progress: '进行中', done: '已完成' },
  purchase: { pending: '待审', in_progress: '进行中', done: '已完成' },
  production: { pending: '待生产', in_progress: '进行中', done: '已完成' },
  finance: { pending: '待开票', in_progress: '待回款', done: '已收款' },
  inventory: { pending: '需关注', in_progress: '使用中', done: '可用' },
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

/**
 * Lookup bucket → 中文 label.
 */
export function getBucketLabel(
  module: WorkflowModule | string,
  bucket: string,
): string {
  const moduleMap = BUCKET_LABEL[module as WorkflowModule];
  if (!moduleMap) return bucket;
  return moduleMap[bucket] ?? bucket;
}
