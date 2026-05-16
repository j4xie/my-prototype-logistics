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
