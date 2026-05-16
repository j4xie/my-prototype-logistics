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
